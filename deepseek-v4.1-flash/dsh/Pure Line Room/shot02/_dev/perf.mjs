// perf.mjs — frame-cost breakdown + screen-area histogram of the drawables.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const browser = await Browser.launch({ width: 1440, height: 900 });
try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (await browser.evaluate('!!window.__ROOM__', { awaitPromise: false }).catch(() => false)) break;
  }
  await browser.evaluate('window.__ROOM__.skipIntro()', { awaitPromise: false });
  await sleep(1500);

  const samples = [];
  for (let i = 0; i < 40; i++) {
    await sleep(60);
    samples.push(await browser.evaluate(
      'JSON.stringify({t:window.__ROOM__.renderer.stats.tms,r:window.__ROOM__.renderer.stats.rms,m:window.__ROOM__.renderer.stats.ms,d:window.__ROOM__.renderer.stats.drawn})',
      { awaitPromise: false },
    ));
  }
  const arr = samples.map((s) => JSON.parse(s));
  const avg = (k) => (arr.reduce((a, b) => a + b[k], 0) / arr.length).toFixed(2);
  process.stdout.write(`frames=${arr.length} transform=${avg('t')}ms raster=${avg('r')}ms total=${avg('m')}ms drawn=${avg('d')}\n`);

  // area histogram
  const info = await browser.evaluate(`(() => {
    const R = window.__ROOM__;
    let prims = 0, polys = 0, lines = 0, withFill = 0, withStroke = 0, hatched = 0, noStroke = 0, noFill = 0;
    const owners = {};
    const walk = (n, ownerName) => {
      for (const g of n.geo) {
        prims++;
        if (g.kind === 0) polys++; else lines++;
        const s = g.style;
        if (s.fill && s.fill !== 'none') withFill++; else noFill++;
        if (s.stroke && s.stroke !== 'none') withStroke++; else noStroke++;
        if (s.hatch) hatched++;
      }
      for (const c of n.children) walk(c, ownerName);
    };
    for (const o of R.scene.objects) {
      let c = 0;
      const count = (n) => { c += n.geo.length; for (const k of n.children) count(k); };
      count(o.root);
      owners[o.id] = c;
      walk(o.root, o.id);
    }
    const top = Object.entries(owners).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    return JSON.stringify({ prims, polys, lines, withFill, withStroke, hatched, noFill, noStroke, top });
  })()`, { awaitPromise: false });
  process.stdout.write('geometry: ' + info + '\n');
  // --- ablation: how much do fills vs strokes vs hatch actually cost? ----
  const measure = async (label) => {
    const acc = [];
    for (let i = 0; i < 24; i++) {
      await sleep(55);
      acc.push(JSON.parse(await browser.evaluate(
        'JSON.stringify({t:window.__ROOM__.renderer.stats.tms,r:window.__ROOM__.renderer.stats.rms,d:window.__ROOM__.renderer.stats.drawn})',
        { awaitPromise: false },
      )));
    }
    const a = (k) => (acc.reduce((x, y) => x + y[k], 0) / acc.length).toFixed(2);
    process.stdout.write(`  ${label.padEnd(18)} transform=${a('t')}  raster=${a('r')}  drawn=${a('d')}\n`);
  };
  const mutate = (js) => browser.evaluate(`(() => {
    const walk = (n) => { for (const g of n.geo) { ${js} } for (const c of n.children) walk(c); };
    for (const o of window.__ROOM__.scene.objects) walk(o.root);
  })()`, { awaitPromise: false });

  process.stdout.write('ablation (throwaway page instance):\n');
  await mutate('if (g.style.hatch) { g.style.__h = g.style.hatch; g.style.hatch = null; }');
  await measure('no hatch');
  await mutate('if (g.style.stroke !== "none") { g.style.__s = g.style.stroke; g.style.stroke = "none"; }');
  await measure('no stroke');
  await mutate('if (g.style.fill !== "none") { g.style.__f = g.style.fill; g.style.fill = "none"; }');
  await measure('no fill,no stroke');
} finally {
  await browser.close();
}
