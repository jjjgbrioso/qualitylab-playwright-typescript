// Prints an HTML file to PDF with Playwright's Chromium.
// Usage: node print-pdf.cjs <html file> <pdf file> <footer text>
//
// HtmlPdfReporter runs this as a separate process. Playwright's main process decides where the
// browsers are before .env is read, so a fresh process is needed to honour PLAYWRIGHT_BROWSERS_PATH.
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const [htmlFile, pdfFile, footerText = ''] = process.argv.slice(2);

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(fs.readFileSync(htmlFile, 'utf8'), { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#5d6b78;padding:0 12mm;display:flex;justify-content:space-between;">
        <span>${escape(footerText)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(String(error && error.message ? error.message : error).split('\n')[0]);
  process.exit(1);
});
