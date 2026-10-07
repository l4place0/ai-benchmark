// diag.js — page init diagnostics
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--use-gl=angle', '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  p.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  const url = 'file:///' + path.resolve('../mv/index.html').replace(/\\/g, '/') + '?render=1';
  console.log('goto', url);
  await p.goto(url, { waitUntil: 'load' });
  console.log('loaded; readyState =', await p.evaluate('document.readyState'));
  for (const expr of ['typeof init', 'typeof Engine', 'typeof SECTIONS', 'document.fonts.status']) {
    try { console.log(expr, '=', await p.evaluate(expr)); } catch (e) { console.log(expr, 'ERR', e.message.slice(0, 100)); }
  }
  await new Promise(r => setTimeout(r, 8000));
  console.log('after 8s: __ready =', await p.evaluate('window.__ready === true'), ' fonts =', await p.evaluate('document.fonts.status'));
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
