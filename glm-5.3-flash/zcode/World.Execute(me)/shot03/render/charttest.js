// charttest.js — test charts() in isolation + inspect source
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  await p.goto('file:///' + path.resolve('../mv/index.html').replace(/\\/g, '/') + '?render=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__ready === true', { timeout: 120000, polling: 200 });
  const r = await p.evaluate(() => {
    const lt = 42 - SECTIONS[2].t0;
    const T0 = SECTIONS[2].t0;
    const info = { T0, lt, t0c: T0 + 8.6, t1c: T0 + 16.7 };
    const c2 = document.createElement('canvas'); c2.width = 1920; c2.height = 1080;
    const old = art.ctx; art.ctx = c2.getContext('2d');
    try { art.charts(42, lt); } catch (e) { art.ctx = old; return JSON.stringify({ err: e.message, info }); }
    art.ctx = old;
    const x = c2.getContext('2d');
    let hits = 0; const d = x.getImageData(0, 0, 1920, 1080).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) hits++;
    return JSON.stringify({ hits, info, srcHasStartsWith: art.charts.toString().includes('startsWith') });
  });
  console.log(r);
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
