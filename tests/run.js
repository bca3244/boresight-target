// Runs the three test pages in headless Chromium and exits non-zero if any check fails.
//   node tests/run.js            all checks must pass (CI has network for the QR decoder)
//   node tests/run.js --offline  the QR checks that need the jsQR CDN are reported but not counted
// Needs Playwright with Chromium (preinstalled in Claude's cloud sessions; CI installs it).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['test', 'share', 'ui'];
const OFFLINE = process.argv.includes('--offline');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// A tiny static server for the repo root, so the run needs nothing but Node and Playwright.
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (rel.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let failed = 0;
  for (const name of PAGES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/tests/${name}.html`);
    try {
      await page.waitForFunction(() => /\d+ passed, \d+ failed/.test(document.getElementById('summary').textContent), null, { timeout: 300000 });
    } catch (e) {
      console.log(`${name}.html: no summary after 5 minutes`);
      failed++; await page.close(); continue;
    }
    const summary = await page.$eval('#summary', e => e.textContent.trim());
    const fails = await page.$$eval('#results tr', rows => rows.filter(r => r.cells[4] && r.cells[4].textContent === 'FAIL')
      .map(r => Array.from(r.cells).slice(0, 4).map(c => c.textContent).join(' | ')));
    const counted = OFFLINE ? fails.filter(f => !f.includes('decoder did not load')) : fails;
    console.log(`${name}.html: ${summary}${OFFLINE && counted.length < fails.length ? ` (${fails.length - counted.length} QR checks skipped offline)` : ''}`);
    counted.forEach(f => console.log('  FAIL ' + f));
    errors.forEach(e => console.log('  page error: ' + e));
    failed += counted.length + errors.length;
    await page.close();
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
