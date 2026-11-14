// Turns failure screenshots (PNG) into smaller JPEG copies for the summary report.
// Usage: node shrink-screenshots.cjs <png file> [<png file> ...]
// Prints JSON: { "<png file>": "data:image/jpeg;base64,...", ... }. Files it cannot convert are left out.
//
// HtmlPdfReporter runs this as a separate process for the same reason as print-pdf.cjs: only a fresh
// process honours PLAYWRIGHT_BROWSERS_PATH from .env. The original PNG files are not changed.
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const MAX_WIDTH = 1000;
const QUALITY = 70;

/** Width and height from the PNG header (IHDR chunk). */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

(async () => {
  const files = process.argv.slice(2);
  const result = {};
  if (files.length === 0) {
    process.stdout.write('{}');
    return;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const file of files) {
      try {
        const png = fs.readFileSync(file);
        const { width, height } = pngSize(png);
        const scale = Math.min(1, MAX_WIDTH / width);
        const size = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
        await page.setViewportSize(size);
        await page.setContent(
          `<html><body style="margin:0"><img style="display:block;width:${size.width}px;height:${size.height}px" src="data:image/png;base64,${png.toString('base64')}"></body></html>`,
          { waitUntil: 'load' },
        );
        const jpeg = await page.screenshot({ type: 'jpeg', quality: QUALITY });
        result[file] = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
      } catch {
        // Leave this file out; the reporter then embeds the original PNG.
      }
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(JSON.stringify(result));
})().catch((error) => {
  console.error(String(error && error.message ? error.message : error).split('\n')[0]);
  process.exit(1);
});
