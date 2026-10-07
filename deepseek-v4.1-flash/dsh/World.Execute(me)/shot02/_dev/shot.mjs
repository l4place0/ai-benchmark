// shot.mjs — render still frames through the running Chrome and save PNGs.
//
//   node _dev/shot.mjs --at=12.5,30,60 --out=_dev/qa
//   node _dev/shot.mjs --every=15 --out=_dev/qa
//
// The page is asked for a data URL, which is written here; nothing large is
// transferred and no screenshot tooling is involved.
import { attach, close } from './chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const PORT = Number(opt('port', '8802'));
const DBG = Number(opt('debug-port', '9333'));
const OUT = path.resolve(ROOT, opt('out', '_dev/qa'));
const W = Number(opt('w', '1920'));
const H = Number(opt('h', '1080'));
const SCALE = Number(opt('scale', '1'));

let times = [];
if (opt('at', '')) times = opt('at', '').split(',').map(Number);
else if (opt('every', '')) {
  const step = Number(opt('every'));
  for (let t = 0; t <= 212.3; t += step) times.push(Math.round(t * 100) / 100);
}
if (!times.length) times = [0.5, 15, 32, 46, 60, 76, 90, 105, 120, 135, 150, 165, 180, 194, 208, 211];

fs.mkdirSync(OUT, { recursive: true });

const cdp = await attach({ width: W, height: H, port: DBG });

try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  let ok = false;
  for (let i = 0; i < 300; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) { ok = true; break; }
    const err = await cdp.eval('window.__error || null');
    if (err) throw new Error('page error: ' + err);
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ok) throw new Error('page never became ready');
  console.log('renderer:', (await cdp.eval('JSON.stringify(window.MV.info())')));

  const t0 = Date.now();
  const manifest = [];
  let idx = 0;
  for (const t of times) {
    const dataUrl = await cdp.eval(`window.MV.still(${t})`, { awaitPromise: true });
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const name = `f${String(idx).padStart(3, '0')}.png`;
    fs.writeFileSync(path.join(OUT, name), buf);
    manifest.push(`${name}\t${t}`);
    console.log(`  ${name}  t=${t}s  ${(buf.length / 1024).toFixed(0)} KB`);
    idx++;
  }
  fs.writeFileSync(path.join(OUT, 'times.txt'), manifest.join('\n') + '\n');
  console.log(`rendered ${times.length} stills in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(ROOT, OUT)}`);
  if (cdp.logs.length) console.log('page log:\n' + cdp.logs.slice(-20).join('\n'));
} catch (e) {
  console.error('SHOT FAILED: ' + e.message);
  if (cdp.logs.length) console.error(cdp.logs.slice(-30).join('\n'));
  process.exitCode = 1;
} finally {
  await close(cdp);
}
