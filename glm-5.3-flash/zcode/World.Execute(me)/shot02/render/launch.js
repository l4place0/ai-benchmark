// launch.js — headless Chrome with GPU, waits for window.__ready
const puppeteer = require('puppeteer-core');
const { MV } = require('./paths');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ARGS = ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];
async function launch() {
  let browser;
  try { browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ARGS }); }
  catch (e) { browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ARGS }); }
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const url = 'file:///' + MV.replace(/\\/g, '/') + '?render=1';
  await page.goto(url);
  await page.waitForFunction('window.__ready === true', { timeout: 60000, polling: 200 });
  const gpu = await page.evaluate('window.__gpuinfo');
  return { browser, page, gpu };
}
module.exports = { launch };
