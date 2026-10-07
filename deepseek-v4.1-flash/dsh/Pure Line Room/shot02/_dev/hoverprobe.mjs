// hoverprobe.mjs — reconcile partPoints(), renderer.pickAt() and the live hover.
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
  await browser.evaluate('window.__ROOM__.skipIntro(); window.__ROOM__.camera.driftAmp = 0;', { awaitPromise: false });
  await sleep(1200);

  const keys = ['mug/mug', 'wall-art/art-small-r', 'ceiling-fan/chain', 'shelf/shelf-plant', 'desk/drawer-a', 'rug/rug'];
  for (const key of keys) {
    const info = JSON.parse(await browser.evaluate(`(() => {
      const R = window.__ROOM__;
      const pts = R.partPoints();
      const p = pts.find(q => q.key === ${JSON.stringify(key)});
      if (!p) return JSON.stringify({ key: ${JSON.stringify(key)}, missing: true, all: pts.length });
      R.renderer.buildPickBuffer(R.scene, R.camera, R.ctx.theme);
      const direct = R.renderer.pickAt(p.x, p.y);
      return JSON.stringify({ key: p.key, x: +p.x.toFixed(1), y: +p.y.toFixed(1), px: p.px,
        eroded: p.eroded, directPick: direct ? direct.key : null,
        canvas: [R.renderer.w, R.renderer.h], pickScale: R.renderer.pickScale,
        idCanvas: [R.renderer.idCanvas.width, R.renderer.idCanvas.height] });
    })()`, { awaitPromise: false }));

    if (info.missing) { process.stdout.write(`${key}: MISSING (of ${info.all})\n`); continue; }
    await browser.mouseMove(info.x, info.y);
    await sleep(200);
    const live = JSON.parse(await browser.evaluate(`(() => {
      const R = window.__ROOM__;
      return JSON.stringify({ mouse: R.mouse, hovered: R.hovered ? R.hovered.key : null,
        directNow: (() => { const p = R.renderer.pickAt(R.mouse[0], R.mouse[1]); return p ? p.key : null; })() });
    })()`, { awaitPromise: false }));
    process.stdout.write(
      `${key.padEnd(22)} pt=(${info.x},${info.y}) px=${info.px} eroded=${info.eroded} ` +
      `pickAt(probe)=${info.directPick}  | mouse=(${live.mouse.map(v=>v.toFixed(0))}) ` +
      `liveHover=${live.hovered} pickAt(live)=${live.directNow}\n`);
  }
  const cfg = await browser.evaluate(
    'JSON.stringify({w:window.__ROOM__.renderer.w,h:window.__ROOM__.renderer.h,pickScale:window.__ROOM__.renderer.pickScale,idCanvas:[window.__ROOM__.renderer.idCanvas.width,window.__ROOM__.renderer.idCanvas.height],dpr:window.__ROOM__.renderer.dpr})',
    { awaitPromise: false });
  process.stdout.write('cfg ' + cfg + '\n');
} finally {
  await browser.close();
}
