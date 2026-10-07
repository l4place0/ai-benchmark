// Render still frames at given times for review: node tools/snap.js 5 12.5 30 ...
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { start } = require('./server');
const { findChrome } = require('./chrome');
const ROOT = path.join(__dirname, '..');

let launchCount = 0;
async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(), headless: true,
    userDataDir: path.join(ROOT, '.cache', 'chrome-profile-' + process.pid + '-' + (launchCount++)),
    args: ['--no-proxy-server', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    protocolTimeout: 600000,
  });
}
async function openPage(browser, port) {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  for (let i = 0; i < 4; i++) {
    try { await page.goto(`http://localhost:${port}/src/index.html${process.env.Q ? '?' + process.env.Q : ''}`, { waitUntil: 'load' }); break; }
    catch (e) { console.log('nav retry', i, e.message); await new Promise(r => setTimeout(r, 500)); }
  }
  await page.waitForFunction('window.READY === true || window.LOAD_ERROR', { timeout: 300000 });
  const err = await page.evaluate('window.LOAD_ERROR');
  if (err) throw new Error(err);
  return page;
}
module.exports = { launch, openPage };

if (require.main === module) (async () => {
  const times = process.argv.slice(2).map(Number);
  const srv = await start(0); const port = srv.address().port;
  const browser = await launch();
  const T0 = Date.now();
  const page = await openPage(browser, port);
  console.log('loaded in', Date.now() - T0, 'ms');
  const dir = path.join(ROOT, 'out', 'snaps'); fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const t1 = Date.now();
    await page.evaluate(f => window.renderFrame(f), Math.round(t * 60));
    const url = await page.evaluate(() => window.captureFrame(0.9));
    fs.writeFileSync(path.join(dir, `snap_${t.toFixed(2).padStart(7, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('t=', t, Date.now() - t1, 'ms');
  }
  await browser.close(); srv.close();
  for (const d of fs.readdirSync(path.join(ROOT, '.cache'))) if (d.startsWith(`chrome-profile-${process.pid}-`)) fs.rmSync(path.join(ROOT, '.cache', d), { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
