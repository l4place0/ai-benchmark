/* =============================================================================
   _dev/sweep.mjs — one browser launch, many camera candidates, many PNGs.
   Loads the page, then for each spec: sets the camera, waits a few real frames,
   screenshots. Prints a coverage summary per candidate.
   ========================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = 'C:\\Users\\l4place\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const args = process.argv.slice(2);
const opt = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const W = 1440, H = 900;
const port = 9400 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'plr-sweep-'));
const child = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', '--disable-gpu',
  '--force-device-scale-factor=1', '--allow-file-access-from-files', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 150; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p) return p;
    } catch { }
    await sleep(120);
  }
  throw new Error('no devtools');
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 1; const pend = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('ERR ' + m.params.entry.text);
};
const send = (method, params = {}) => { const i = id++; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { resolve: res, reject: rej })); };

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'index.html')).href });
await sleep(3000);

const probeSrc = readFileSync(join(HERE, 'live_probe.js'), 'utf8');
const specs = JSON.parse(readFileSync(join(ROOT, opt('specs', '_dev/specs.json')), 'utf8'));
const results = [];
for (const s of specs) {
  const camJs = `(function(){
    var a = window.PLR.app;
    PLR.anim._tweens.length = 0;            // kill the boot intro tween
    a.cam.orbit[0]=${s.orbit[0]}; a.cam.orbit[1]=${s.orbit[1]}; a.cam.orbit[2]=${s.orbit[2]};
    a.cam.look[0]=${s.look[0]}; a.cam.look[1]=${s.look[1]}; a.cam.look[2]=${s.look[2]};
    a.cam.target[0]=${s.look[0]}; a.cam.target[1]=${s.look[1]}; a.cam.target[2]=${s.look[2]};
    a.cam.tyaw=${s.yaw}; a.cam.tpitch=${s.pitch}; a.cam.tdist=${s.dist};
    a.cam.yaw=${s.yaw}; a.cam.pitch=${s.pitch}; a.cam.dist=${s.dist};
    a.cam.idle=-1e9;
    a.viewMode.noAvoid=${s.noavoid ? 'true' : 'false'};
    a.renderer.fov=${s.fov};
    a.env.autoTime=false; a.setEnv({hour:${s.hour === undefined ? 11 : s.hour},minute:0,day:${s.day === undefined ? 1 : s.day}});
    return 1; })()`;
  await send('Runtime.evaluate', { expression: camJs, returnByValue: true });
  await sleep(s.wait || 1400);
  // screenshot FIRST, then read geometry: both land in the same settled state
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ROOT, s.out), Buffer.from(shot.data, 'base64'));
  const pr = await send('Runtime.evaluate', { expression: `(function(){ ${probeSrc} })()`, returnByValue: true });
  const v = pr.result.value || {};
  results.push({
    name: s.name, out: s.out, fov: s.fov,
    eye: v.eye, windowOpeningPx: v.windowOpeningPx, windowOpeningSize: v.windowOpeningSize,
    inFrame: v.inFrameCount, off: v.offFrame
  });
}
console.log(JSON.stringify({ errors: logs, results }, null, 1));
try { ws.close(); } catch { }
child.kill();
await sleep(200);
process.exit(0);
