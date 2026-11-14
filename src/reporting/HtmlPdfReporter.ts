import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { env } from '../config/env';

/**
 * Writes a one-page HTML summary of every run, and a PDF of it, at the end of the run:
 *
 *   reports/summary/test-report.html   (with a "Download PDF" button)
 *   reports/summary/test-report.pdf
 *   reports/history/<date-time>/       a copy of both, so earlier runs are kept
 *
 * The PDF is printed by Playwright's own Chromium, so no extra packages are needed.
 */

interface Options {
  outputFolder?: string;
  historyFolder?: string;
  title?: string;
}

type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';

interface Row {
  module: string;
  file: string;
  title: string;
  results: Map<string, { outcome: Outcome; durationMs: number; retries: number }>;
}

interface Failure {
  title: string;
  browser: string;
  error: string;
  screenshot?: string;
  video?: string;
  trace?: string;
}

const OUTCOME_LABELS: Record<Outcome, string> = { passed: 'Passed', failed: 'Failed', flaky: 'Flaky', skipped: 'Skipped' };

export default class HtmlPdfReporter implements Reporter {
  private readonly outputFolder: string;
  private readonly historyFolder: string;
  private readonly title: string;
  private config!: FullConfig;
  private root!: Suite;
  private startedAt = new Date();

  constructor(options: Options = {}) {
    this.outputFolder = path.resolve(options.outputFolder ?? 'reports/summary');
    this.historyFolder = path.resolve(options.historyFolder ?? 'reports/history');
    this.title = options.title ?? 'QualityLab test report';
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.root = suite;
    this.startedAt = new Date();
  }

  async onEnd(result: FullResult): Promise<void> {
    const tests = this.root.allTests();
    if (tests.length === 0) return;

    const browsers = this.config.projects.map((project) => project.name).filter((name) => tests.some((test) => projectOf(test) === name));
    const rows = this.rows(tests);
    const failures = this.failures(tests);
    const counts = { total: tests.length, passed: 0, failed: 0, flaky: 0, skipped: 0 };
    for (const test of tests) counts[outcomeOf(test)] += 1;

    const stamp = fileStamp(this.startedAt);
    const report = { result, browsers, rows, failures, counts };

    fs.mkdirSync(this.outputFolder, { recursive: true });
    const htmlPath = path.join(this.outputFolder, 'test-report.html');
    const pdfPath = path.join(this.outputFolder, 'test-report.pdf');
    // First the page the PDF is printed from, then the final page with the PDF in its button.
    fs.writeFileSync(htmlPath, this.render(report), 'utf8');

    let pdfError: string | undefined;
    try {
      await printPdf(htmlPath, pdfPath, this.title, this.startedAt);
      const pdfHref = `data:application/pdf;base64,${fs.readFileSync(pdfPath).toString('base64')}`;
      fs.writeFileSync(htmlPath, this.render({ ...report, pdfHref }), 'utf8');
    } catch (error) {
      pdfError = error instanceof Error ? error.message.split('\n')[0] : String(error);
      // The button explains why there is no PDF.
      fs.writeFileSync(htmlPath, this.render({ ...report, pdfError }), 'utf8');
    }

    const history = path.join(this.historyFolder, stamp);
    fs.mkdirSync(history, { recursive: true });
    fs.copyFileSync(htmlPath, path.join(history, 'test-report.html'));
    if (!pdfError) fs.copyFileSync(pdfPath, path.join(history, 'test-report.pdf'));

    const where = path.relative(process.cwd(), htmlPath);
    console.log(`\n  Summary report: ${where}${pdfError ? `  (PDF not created: ${pdfError})` : `  and ${path.relative(process.cwd(), pdfPath)}`}`);

    if (shouldOpen(result)) openInChrome(htmlPath);
  }

  private rows(tests: TestCase[]): Row[] {
    const byKey = new Map<string, Row>();
    for (const test of tests) {
      const file = path.relative(this.config.rootDir, test.location.file).replace(/\\/g, '/');
      const titlePath = test.titlePath().slice(3); // drop root, project and file
      const key = `${file}::${titlePath.join(' › ')}`;
      if (!byKey.has(key)) {
        byKey.set(key, { module: moduleOf(file), file, title: titlePath.join(' › '), results: new Map() });
      }
      const last = test.results.at(-1);
      byKey.get(key)!.results.set(projectOf(test), {
        outcome: outcomeOf(test),
        durationMs: last?.duration ?? 0,
        retries: Math.max(0, test.results.length - 1),
      });
    }
    return [...byKey.values()];
  }

  private failures(tests: TestCase[]): Failure[] {
    const failures: Failure[] = [];
    for (const test of tests) {
      if (outcomeOf(test) !== 'failed') continue;
      const last = test.results.at(-1);
      if (!last) continue;
      const attachment = (name: string) => last.attachments.find((item) => item.name === name && item.path)?.path;
      const screenshot = attachment('screenshot');
      failures.push({
        title: test.titlePath().slice(3).join(' › '),
        browser: projectOf(test),
        error: stripAnsi(last.errors.map((error) => error.message ?? error.value ?? '').join('\n\n')).trim(),
        screenshot: screenshot && fs.existsSync(screenshot) ? `data:image/png;base64,${fs.readFileSync(screenshot).toString('base64')}` : undefined,
        video: relativeLink(this.outputFolder, attachment('video')),
        trace: relativeLink(this.outputFolder, attachment('trace')),
      });
    }
    return failures;
  }

  private render(data: {
    result: FullResult;
    browsers: string[];
    rows: Row[];
    failures: Failure[];
    counts: { total: number; passed: number; failed: number; flaky: number; skipped: number };
    pdfError?: string;
    pdfHref?: string;
  }): string {
    const { result, browsers, rows, failures, counts, pdfError, pdfHref } = data;
    const ran = counts.total - counts.skipped;
    const passRate = ran === 0 ? 0 : Math.round(((counts.passed + counts.flaky) / ran) * 1000) / 10;
    const overall = result.status === 'passed' ? 'passed' : result.status === 'failed' ? 'failed' : result.status;
    const modules = [...new Set(rows.map((row) => row.module))];

    const tables = modules
      .map((module) => {
        const moduleRows = rows.filter((row) => row.module === module);
        const body = moduleRows
          .map(
            (row) => `<tr>
              <td class="test"><span class="name">${escape(row.title)}</span><span class="file">${escape(row.file)}</span></td>
              ${browsers.map((browser) => cell(row.results.get(browser))).join('')}
            </tr>`,
          )
          .join('');
        return `<section class="module">
          <h2>${escape(module)} <span class="muted">${moduleRows.length} ${moduleRows.length === 1 ? 'test' : 'tests'}</span></h2>
          <table>
            <thead><tr><th>Test</th>${browsers.map((browser) => `<th class="browser">${escape(browserName(browser))}</th>`).join('')}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </section>`;
      })
      .join('');

    const failureSection =
      failures.length === 0
        ? ''
        : `<section class="failures">
          <h2>Failures <span class="muted">${failures.length}</span></h2>
          ${failures
            .map(
              (failure) => `<article class="failure">
                <h3>${escape(failure.title)} <span class="pill failed">${escape(browserName(failure.browser))}</span></h3>
                <pre>${escape(failure.error || 'No error message.')}</pre>
                ${failure.screenshot ? `<img src="${failure.screenshot}" alt="Screenshot at the moment of failure">` : ''}
                <p class="links no-print">
                  ${failure.video ? `<a href="${escape(failure.video)}">Video</a>` : ''}
                  ${failure.trace ? `<a href="${escape(failure.trace)}">Trace</a> <span class="muted">(open with npx playwright show-trace)</span>` : ''}
                </p>
              </article>`,
            )
            .join('')}
        </section>`;

    // The PDF is embedded in the link itself. Chrome ignores the download attribute on a link to a
    // local file and only shows it, but it always saves an embedded file.
    const pdfButton = pdfError
      ? `<span class="button disabled" title="${escape(pdfError)}">PDF not available</span>`
      : pdfHref
        ? `<a class="button" href="${pdfHref}" download="qualitylab-test-report-${fileStamp(this.startedAt)}.pdf">Download PDF</a>`
        : '<span class="button disabled">Preparing PDF</span>';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(this.title)}</title>
<style>
  :root { --ink:#16202a; --muted:#5d6b78; --line:#dde3e9; --bg:#f6f8fa; --card:#fff;
    --pass:#137a4b; --pass-bg:#e3f5ec; --fail:#b42318; --fail-bg:#fdeceb; --flaky:#9a6200; --flaky-bg:#fff4dc;
    --skip:#5d6b78; --skip-bg:#eef1f4; --accent:#0f6e6e; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 "Segoe UI", system-ui, -apple-system, Arial, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:28px 16px 48px; }
  header { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
  h1 { margin:0 0 4px; font-size:24px; }
  h2 { font-size:17px; margin:0 0 10px; }
  h3 { font-size:14px; margin:0 0 8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .muted { color:var(--muted); font-weight:400; font-size:13px; }
  .meta { color:var(--muted); font-size:13px; }
  .meta b { color:var(--ink); font-weight:600; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .button { display:inline-block; padding:9px 16px; border-radius:6px; background:var(--accent); color:#fff; text-decoration:none; font-weight:600; }
  .button.secondary { background:var(--card); color:var(--accent); border:1px solid var(--line); }
  .button.disabled { background:var(--skip-bg); color:var(--muted); cursor:not-allowed; }
  .status { display:inline-block; margin-top:6px; padding:2px 10px; border-radius:999px; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .status.passed { background:var(--pass-bg); color:var(--pass); }
  .status.failed, .status.timedout, .status.interrupted { background:var(--fail-bg); color:var(--fail); }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:24px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
  .tile .value { font-size:24px; font-weight:700; font-variant-numeric:tabular-nums; }
  .tile .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .tile.passed .value { color:var(--pass); } .tile.failed .value { color:var(--fail); } .tile.flaky .value { color:var(--flaky); }
  section { margin-bottom:26px; }
  .module { break-inside:auto; }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  th, td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:#eef2f5; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
  th.browser, td.result { width:120px; text-align:center; }
  tr { break-inside:avoid; }
  td.test .name { display:block; }
  td.test .file { display:block; color:var(--muted); font-size:12px; }
  .pill { display:inline-block; min-width:64px; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; text-align:center; }
  .pill.passed { background:var(--pass-bg); color:var(--pass); }
  .pill.failed { background:var(--fail-bg); color:var(--fail); }
  .pill.flaky { background:var(--flaky-bg); color:var(--flaky); }
  .pill.skipped, .pill.none { background:var(--skip-bg); color:var(--skip); }
  .duration { display:block; color:var(--muted); font-size:11px; font-variant-numeric:tabular-nums; }
  .failure { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--fail); border-radius:8px; padding:14px; margin-bottom:12px; break-inside:avoid; }
  pre { white-space:pre-wrap; word-break:break-word; background:#f3f5f7; border-radius:6px; padding:10px; font:12px/1.45 Consolas, "Cascadia Mono", monospace; margin:0 0 10px; max-height:none; }
  .failure img { max-width:100%; border:1px solid var(--line); border-radius:6px; }
  .links a { margin-right:12px; color:var(--accent); }
  footer { color:var(--muted); font-size:12px; border-top:1px solid var(--line); padding-top:12px; }
  @media (max-width:640px) { th.browser, td.result { width:auto; } .tile .value { font-size:20px; } }
  @media print {
    body { background:#fff; }
    main { padding:0; max-width:none; }
    .no-print, .actions { display:none !important; }
    table, .tile, .failure { border-color:#c9d1d9; }
    .failure { border-left-color:var(--fail); }
    a { color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>${escape(this.title)}</h1>
      <div class="meta">
        <b>${escape(formatDate(this.startedAt))}</b> &middot; ${escape(env.name.toUpperCase())} &middot; ${escape(env.baseUrl)}<br>
        ${plural(rows.length, 'test')} &times; ${plural(browsers.length, 'browser')} &middot; Browsers: ${escape(browsers.map(browserName).join(', '))} &middot; Workers: ${this.config.workers} &middot; Duration: ${escape(formatDuration(result.duration))}
      </div>
      <span class="status ${escape(overall.toLowerCase())}">Run ${escape(overall)}</span>
    </div>
    <div class="actions">
      ${pdfButton}
      <a class="button secondary" href="../html/index.html">Full Playwright report</a>
    </div>
  </header>

  <div class="tiles">
    <div class="tile"><div class="value">${counts.total}</div><div class="label">Test runs</div></div>
    <div class="tile passed"><div class="value">${counts.passed}</div><div class="label">Passed</div></div>
    <div class="tile failed"><div class="value">${counts.failed}</div><div class="label">Failed</div></div>
    <div class="tile flaky"><div class="value">${counts.flaky}</div><div class="label">Flaky</div></div>
    <div class="tile"><div class="value">${counts.skipped}</div><div class="label">Skipped</div></div>
    <div class="tile"><div class="value">${passRate}%</div><div class="label">Pass rate</div></div>
  </div>

  ${failureSection}
  ${tables.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')}

  <footer>Flaky = failed first, passed on retry. Pass rate counts passed and flaky tests out of those that ran. Generated by src/reporting/HtmlPdfReporter.ts.</footer>
</main>
</body>
</html>`;
  }
}

function cell(result: { outcome: Outcome; durationMs: number; retries: number } | undefined): string {
  if (!result) return '<td class="result"><span class="pill none">Not run</span></td>';
  const retry = result.retries > 0 ? ` &middot; ${result.retries} retr${result.retries === 1 ? 'y' : 'ies'}` : '';
  return `<td class="result"><span class="pill ${result.outcome}">${OUTCOME_LABELS[result.outcome]}</span><span class="duration">${formatDuration(result.durationMs)}${retry}</span></td>`;
}

function outcomeOf(test: TestCase): Outcome {
  switch (test.outcome()) {
    case 'expected':
      return 'passed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    default:
      return 'failed';
  }
}

function projectOf(test: TestCase): string {
  return test.parent.project()?.name ?? 'default';
}

/** "tests/ecommerce/catalog.spec.ts" -> "E-commerce" */
function moduleOf(file: string): string {
  const folder = file.split('/').at(-2) ?? 'tests';
  const names: Record<string, string> = { auth: 'Authentication', ecommerce: 'E-commerce', banking: 'Banking', travel: 'Travel' };
  return names[folder] ?? capitalize(folder);
}

/**
 * OPEN_REPORT decides whether the report opens after the run: always (default), on-failure, or never.
 * It never opens on CI.
 */
function shouldOpen(result: FullResult): boolean {
  if (env.isCI) return false;
  const mode = (process.env.OPEN_REPORT ?? 'always').trim().toLowerCase();
  if (mode === 'never' || mode === 'false') return false;
  if (mode === 'on-failure') return result.status !== 'passed';
  return true;
}

/** Opens the report in Chrome (or the default browser when Chrome is not found), without waiting for it. */
function openInChrome(htmlPath: string): void {
  try {
    const child = spawn(process.execPath, [path.join(__dirname, 'open-summary.cjs'), htmlPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
    child.unref();
  } catch {
    // Opening the report is a convenience; the run's result does not depend on it.
  }
}

/**
 * Prints the saved HTML to PDF in a separate Node process (print-pdf.cjs). That process reads the
 * browser location after .env has been loaded, exactly like the test workers do.
 */
async function printPdf(htmlPath: string, pdfPath: string, title: string, startedAt: Date): Promise<void> {
  const script = path.join(__dirname, 'print-pdf.cjs');
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      [script, htmlPath, pdfPath, `${title} · ${formatDate(startedAt)}`],
      { env: process.env, timeout: 120_000 },
      (error, _stdout, stderr) => (error ? reject(new Error(stderr.trim() || error.message)) : resolve()),
    );
  });
}

function relativeLink(fromFolder: string, target?: string): string | undefined {
  if (!target || !fs.existsSync(target)) return undefined;
  return path.relative(fromFolder, target).replace(/\\/g, '/');
}

/** Removes terminal colour codes, and hides session tokens that Playwright call logs can include. */
function stripAnsi(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[hidden]')
    .replace(/(ql_session=)[^;\s]+/gi, '$1[hidden]');
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Display names for Playwright projects. */
function browserName(project: string): string {
  const names: Record<string, string> = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' };
  return names[project] ?? capitalize(project);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds - minutes * 60)}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function fileStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
