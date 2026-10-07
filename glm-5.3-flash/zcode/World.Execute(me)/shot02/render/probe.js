// probe.js — node probe.js <t> : render one frame, dump diagnostics to files
const fs = require('fs');
const { launch } = require('./launch');
async function main() {
  const t = parseFloat(process.argv[2] || '16.15');
  const { browser, page } = await launch();
  const url = await page.url();
  const st = await page.evaluate(tt => window.__state(tt), t);
  const items = await page.evaluate(tt => window.__textdebug(tt), t);
  const a = await page.evaluate(tt => window.__renderFrame(tt), t);
  const b = await page.evaluate(tt => window.__renderFrame(tt), t);
  const c = await page.evaluate(tt => window.__renderFrame(tt), t + 1);
  const d = await page.evaluate(tt => window.__renderFrame(tt), t);
  fs.mkdirSync('./samples', { recursive: true });
  fs.writeFileSync('./samples/probe_' + t.toFixed(2) + '.png', Buffer.from(a.split(',')[1], 'base64'));
  const out = { url, st, items: items.slice(0, 600), det_consecutive: a === b, det_after_other: b === d, aLen: a.length, cLen: c.length };
  fs.writeFileSync('./probe_out_' + t.toFixed(2) + '.json', JSON.stringify(out, null, 1));
  await browser.close();
}
main().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
