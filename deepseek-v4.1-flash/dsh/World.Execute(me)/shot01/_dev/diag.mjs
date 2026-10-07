// diag.mjs — find out what kills Chrome during capture.
//   node diag.mjs render [n]      : render only
//   node diag.mjs encode [n] [flushEvery]
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';
import { sleep } from './chrome.mjs';

const HERE = import.meta.dirname;
const PORT = 8793;
const mode = process.argv[2] || 'render';
const N = Number(process.argv[3] || 120);
const FLUSH = Number(process.argv[4] || 60);
const S0 = Number((process.argv.find(a => a.startsWith('--start=')) || '--start=0').split('=')[1]);

const srv = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: HERE, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/state`); if (r.ok) break; } catch {}
  await sleep(200);
}

const cdp = await attach({ width: 1920, height: 1080 });
cdp.ws.addEventListener('close', () => console.error('!! CDP socket closed'));
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  for (let i = 0; i < 200; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) break;
    await sleep(250);
  }
  console.log('page ready; mode=' + mode);
  const ACCEL = (process.argv.find(a => a.startsWith('--accel=')) || '--accel=no-preference').split('=')[1];
  const expr = mode === 'encode'
    ? `(async()=>{ const t0=performance.now(); const r = await MV.capture(${S0}, ${S0 + N}, 24000000, 0, ${JSON.stringify(ACCEL)}); return {...r, ms: performance.now()-t0}; })()`
    : `(()=>{ const t0=performance.now(); for(let i=${S0};i<${S0 + N};i++) MV.mv.renderFrame(i); return { frames:${N}, ms: performance.now()-t0 }; })()`;
  const res = await cdp.eval(expr, { awaitPromise: true, timeout: 0 });
  console.log('RESULT ' + JSON.stringify(res));
} catch (e) {
  console.error('DIAG FAILED: ' + e.message);
  process.exitCode = 1;
} finally {
  await close(cdp);
  srv.kill();
}
