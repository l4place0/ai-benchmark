// hit.mjs — what is under a given point? Uses the real pick buffer.
//   node _dev/hit.mjs 0.55 0.62 0.58 0.70       (fractions of the canvas)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const nums = process.argv.slice(2).map(Number);
const pts = [];
for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);

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
  await sleep(1400);
  const res = await browser.evaluate(`(() => {
    const R = window.__ROOM__;
    R.renderer.buildPickBuffer(R.scene, R.camera, R.ctx.theme);
    const out = { canvas: [R.renderer.w, R.renderer.h], hits: [] };
    for (const [fx, fy] of ${JSON.stringify(pts)}) {
      const x = fx * R.renderer.w, y = fy * R.renderer.h;
      const p = R.renderer.pickAt(x, y);
      out.hits.push([+fx.toFixed(3), +fy.toFixed(3), Math.round(x), Math.round(y),
        p ? p.obj.id + '/' + p.id + ' (' + p.label + ')' : '—']);
    }
    return JSON.stringify(out);
  })()`, { awaitPromise: false });
  const o = JSON.parse(res);
  process.stdout.write('canvas ' + o.canvas.join('x') + '\n');
  for (const h of o.hits) process.stdout.write(`  ${h[0]},${h[1]}  ->px(${h[2]},${h[3]})  ${h[4]}\n`);
} finally {
  await browser.close();
}
