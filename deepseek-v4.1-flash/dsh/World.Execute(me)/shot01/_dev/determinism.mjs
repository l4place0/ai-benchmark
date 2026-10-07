// determinism.mjs — prove that a frame depends only on t.
// Renders the same frame indices in two different orders (and with unrelated
// frames rendered in between) and compares pixel hashes.
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const PORT = 8795;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const srv = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: HERE, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/state`); if (r.ok) break; } catch {}
  await sleep(200);
}

const cdp = await attach({ width: 1920, height: 1080 });
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  for (let i = 0; i < 200; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) break;
    await sleep(250);
  }
  await cdp.eval(`window.__hashFrame = (i) => {
    MV.mv.renderFrame(i);
    const gl = MV.mv.gl, W = MV.mv.canvas.width, H = MV.mv.canvas.height;
    const px = new Uint8Array(W*H*4);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    let h = 2166136261 >>> 0;
    for (let k = 0; k < px.length; k += 7) { h ^= px[k]; h = Math.imul(h, 16777619) >>> 0; }
    return h;
  };`);

  const frames = [137, 1830, 3600, 5100, 6600, 8100, 9700, 11200, 12600, 13100];
  const orderA = [...frames];
  // second pass: reversed order, interleaved with frames that were never rendered
  const orderB = [];
  for (let i = frames.length - 1; i >= 0; i--) { orderB.push(frames[i], 999 + i * 37); }

  const runA = await cdp.eval(`JSON.stringify(${JSON.stringify(orderA)}.map(i => [i, window.__hashFrame(i)]))`);
  const runB = await cdp.eval(`JSON.stringify(${JSON.stringify(orderB)}.map(i => [i, window.__hashFrame(i)]))`);
  const a = new Map(JSON.parse(runA));
  const b = new Map(JSON.parse(runB));

  let bad = 0;
  console.log('frame        passA         passB         match');
  for (const f of frames) {
    const ok = a.get(f) === b.get(f);
    if (!ok) bad++;
    console.log(`${String(f).padStart(6)}  ${String(a.get(f)).padStart(11)}  ${String(b.get(f)).padStart(11)}  ${ok ? 'OK' : 'MISMATCH'}`);
  }
  console.log(bad === 0
    ? '\nDETERMINISTIC: every frame is a pure function of t (order-independent, no hidden state).'
    : `\nNOT DETERMINISTIC: ${bad} mismatches`);
  process.exitCode = bad === 0 ? 0 : 1;
} catch (e) {
  console.error('FAILED: ' + e.message);
  if (cdp.logs.length) console.error(cdp.logs.slice(-20).join('\n'));
  process.exitCode = 1;
} finally {
  await close(cdp);
  srv.kill();
}
