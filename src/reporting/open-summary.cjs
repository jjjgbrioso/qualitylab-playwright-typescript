// Opens a summary report in Google Chrome, or in the default browser when Chrome is not found.
//   npm run report:summary            opens the latest report
//   node open-summary.cjs <file>      opens that file (HtmlPdfReporter uses this after each run)
// Set CHROME_PATH to use a Chrome installed somewhere unusual.
const { spawn, exec } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const report = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '..', 'reports', 'summary', 'test-report.html'));
if (!fs.existsSync(report)) {
  console.error('No summary report yet. Run the tests first, for example: npm run test:smoke');
  process.exit(1);
}

function chromeOnWindows() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function openDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => openDefault());
  child.unref();
}

function openDefault() {
  const quoted = `"${report}"`;
  const command =
    process.platform === 'win32' ? `start "" ${quoted}` : process.platform === 'darwin' ? `open ${quoted}` : `xdg-open ${quoted}`;
  exec(command);
}

const url = pathToFileURL(report).href;
let browser = 'Google Chrome';
if (process.platform === 'win32') {
  const chrome = chromeOnWindows();
  if (chrome) openDetached(chrome, [url]);
  else {
    browser = 'the default browser (Chrome was not found)';
    openDefault();
  }
} else if (process.platform === 'darwin') {
  openDetached('open', ['-a', process.env.CHROME_PATH || 'Google Chrome', report]);
} else {
  openDetached(process.env.CHROME_PATH || 'google-chrome', [url]);
}
console.log(`Opening ${path.relative(process.cwd(), report)} in ${browser}`);
