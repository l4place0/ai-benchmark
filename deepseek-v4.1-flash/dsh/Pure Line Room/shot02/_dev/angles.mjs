// angles.mjs — sweep the camera around the room and save a contact sheet of PNGs.
//   node _dev/angles.mjs [prefix] [night]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(here, 'shots');
fs.mkdirSync(outDir, { recursive: true });
const prefix = process.argv[2] || 'a';
const night = process.argv[3] === 'night';

const VIEWS = [
  ['default', 0.62, 0.37, 12.4],
  ['front', 0.03, 0.30, 11.0],
  ['left', -1.05, 0.30, 11.0],
  ['right', 1.55, 0.32, 11.0],
  ['back', 3.05, 0.36, 11.5],
  ['high', 0.70, 0.95, 11.0],
  ['desk', -0.55, 0.26, 8.2],
  ['lounge', 1.05, 0.24, 8.4],
];

const browser = await Browser.launch({ width: 1440, height: 900 });
try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Log.enable');
  const errs = [];
  browser.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    errs.push((d.exception && d.exception.description) || d.text);
  });
  browser.on('Log.entryAdded', (p) => { if (p.entry && p.entry.level === 'error') errs.push(p.entry.text); });

  await browser.send('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const ok = await browser.evaluate('!!(window.__ROOM__ && window.__ROOM__.scene.parts.length)', { awaitPromise: false }).catch(() => false);
    if (ok) break;
  }
  const boot = await browser.evaluate('(document.getElementById("boot-error")||{}).textContent || ""', { awaitPromise: false });
  if (boot) process.stdout.write('BOOT ERROR: ' + boot + '\n');
  const modErrors = await browser.evaluate('JSON.stringify(window.__ROOM__ ? window.__ROOM__.errors : ["no __ROOM__"])', { awaitPromise: false });
  process.stdout.write('module errors: ' + modErrors + '\n');

  await browser.evaluate('window.__ROOM__.skipIntro()', { awaitPromise: false });
  await browser.evaluate(`window.__ROOM__.state.set('night', ${night})`, { awaitPromise: false });
  await sleep(2600);

  for (const [name, yaw, pitch, radius] of VIEWS) {
    await browser.evaluate(`window.__ROOM__.setCamera(${yaw}, ${pitch}, ${radius})`, { awaitPromise: false });
    await sleep(1100);
    const f = path.join(outDir, `${prefix}-${name}.png`);
    await browser.screenshot(f);
    process.stdout.write('  ' + name + '\n');
  }

  const stats = await browser.evaluate(`(() => {
    const R = window.__ROOM__; const s = R.renderer.stats;
    let prims = 0; const walk = (n) => { prims += n.geo.length; for (const c of n.children) walk(c); };
    for (const o of R.scene.objects) walk(o.root);
    return { prims, drawn: s.drawn, drawables: s.drawables, ms: +s.ms.toFixed(2), parts: R.scene.parts.length };
  })()`, { awaitPromise: false });
  process.stdout.write('stats: ' + JSON.stringify(stats) + '\n');
  process.stdout.write('page errors: ' + (errs.length ? errs.join(' | ') : 'none') + '\n');
} finally {
  await browser.close();
}
