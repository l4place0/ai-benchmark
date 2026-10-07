// pixprobe.js — render t and report pixels at given coords (checks 2D layer)
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const t = parseFloat(process.argv[2] || '42');
  const pts = process.argv[3] ? JSON.parse(process.argv[3]) : [[660, 580], [960, 406], [960, 754], [100, 900], [960, 990]];
  const b = await puppeteer.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await p.goto('file:///' + path.resolve('../mv/index.html').replace(/\\/g, '/') + '?render=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__ready === true', { timeout: 120000, polling: 200 });
  const out = await p.evaluate((t, pts) => {
    window.__renderFrame(t);
    const c = document.getElementById('screen').getContext('2d');
    return pts.map(([x, y]) => Array.from(c.getImageData(x, y, 1, 1).data));
  }, t, pts);
  console.log('t=' + t, JSON.stringify(out));
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
