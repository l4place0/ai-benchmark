// launch.js — headless chrome-for-testing (downloaded into workspace) with GPU
const puppeteer = require('puppeteer');
const { MV } = require('./paths');
const ARGS = ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--use-gl=angle', '--hide-scrollbars',
  '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-frame-rate-limit'];
async function launch() {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ARGS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  const url = 'file:///' + MV.replace(/\\/g, '/') + '?render=1';
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 120000, polling: 200 });
  const gpu = await page.evaluate('window.__gpuinfo');
  return { browser, page, gpu };
}
module.exports = { launch };
