/* =============================================================================
   _dev/shot.mjs — real-browser screenshot driver (Chrome DevTools Protocol).

   Now that the sandbox permits named pipes, this drives the actual bundled
   Chromium: it loads index.html from disk, waits for real animation frames,
   runs an optional interaction script, then captures real PNGs.

   node _dev/shot.mjs --out=_dev/live.png [--w=1440] [--h=900] [--wait=3500]
                      [--do=click@720,450;move@..;drag@..;key@L;wheel@..]
                      [--eval=js-file]
   ========================================================================== */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = process.env.PLR_CHROME ||
  'C:\\Users\\l4place\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const has = (n) => args.includes(`--${n}`);

const W = parseInt(opt('w', '1440'), 10);
const H = parseInt(opt('h', '900'), 10);
const waitMs = parseInt(opt('wait', '3500'), 10);
const out = opt('out', '_dev/live.png');
const port = 9200 + Math.floor(Math.random() * 700);
const profile = mkdtempSync(join(tmpdir(), 'plr-live-'));

const child = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-gpu', '--force-device-scale-factor=1',
  '--allow-file-access-from-files', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 150; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(120);
  }
  throw new Error('devtools endpoint never appeared');
}

const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 1;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push('[' + m.params.type + '] ' + (m.params.args || [])
      .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' '));
  } else if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[exception] ' + m.params.exceptionDetails.text + ' ' +
      (m.params.exceptionDetails.exception?.description || ''));
  } else if (m.method === 'Log.entryAdded') {
    logs.push('[log:' + m.params.entry.level + '] ' + m.params.entry.text);
  }
};
const send = (method, params = {}) => {
  const mid = id++;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const url = pathToFileURL(join(ROOT, 'index.html')).href;
await send('Page.navigate', { url });
await sleep(waitMs);

/** Dispatch a real input event through CDP. */
async function mouse(type, x, y, extra = {}) {
  await send('Input.dispatchMouseEvent', Object.assign({
    type, x, y, button: type === 'mouseMoved' ? 'none' : 'left',
    buttons: type === 'mouseReleased' ? 0 : (type === 'mousePressed' ? 1 : 0),
    clickCount: type === 'mouseMoved' ? 0 : 1
  }, extra));
}
async function key(k) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k });
}
async function shot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(ROOT, path), Buffer.from(r.data, 'base64'));
}

// optional scripted interaction: click@x,y  move@x,y  drag@x0,y0>x1,y1  wheel@x,y:d  key@L
for (const step of opt('do', '').split(';').filter(Boolean)) {
  const [kind, rest] = step.split('@');
  const nums = (rest || '').split(/[,>:]/).map(Number);
  if (kind === 'click') {
    await mouse('mouseMoved', nums[0], nums[1]);
    await sleep(450);
    await mouse('mousePressed', nums[0], nums[1]);
    await sleep(70);
    await mouse('mouseReleased', nums[0], nums[1]);
    await sleep(1500);
  } else if (kind === 'move') {
    await mouse('mouseMoved', nums[0], nums[1]);
    await sleep(900);
  } else if (kind === 'drag') {
    await mouse('mouseMoved', nums[0], nums[1]);
    await sleep(250);
    await mouse('mousePressed', nums[0], nums[1]);
    await sleep(120);
    const steps = 22;
    for (let i = 1; i <= steps; i++) {
      await mouse('mouseMoved', nums[0] + (nums[2] - nums[0]) * i / steps,
        nums[1] + (nums[3] - nums[1]) * i / steps, { buttons: 1 });
      await sleep(34);
    }
    await sleep(150);
    await mouse('mouseReleased', nums[2], nums[3]);
    await sleep(900);
  } else if (kind === 'wheel') {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: nums[0], y: nums[1], deltaX: 0, deltaY: nums[2]
    });
    await sleep(800);
  } else if (kind === 'key') {
    await key((rest || '').trim());
    await sleep(600);
  }
}

// optional in-page script (e.g. to force a time of day, or read state back)
let evalOut = null;
if (opt('eval', '')) {
  let src = readFileSync(join(ROOT, opt('eval', '')), 'utf8');
  src = src.replace(/__SPEC__/g, opt('spec', '[0.62,-0.098,4.45,0,1.30,-1.55,54]'));
  const r = await send('Runtime.evaluate', {
    expression: `(function(){ ${src} })()`, awaitPromise: true, returnByValue: true
  });
  evalOut = r.result?.value ?? r.result?.description ?? null;
  await sleep(700);
}

await shot(out);
if (has('also')) await shot(opt('also', '_dev/live2.png'));

// real state read-back from the live page
const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify((function(){
    var a = window.PLR && window.PLR.app;
    if (!a) return { booted:false };
    return {
      booted: true,
      stats: a.stats(),
      interactives: a.interact.reg.length,
      hour: a.env.hour, day: +a.env.day.toFixed(3),
      lightsOn: a.env.lightsOn, lampOn: a.env.lampOn,
      eye: a.renderer.eye.map(function(v){return +v.toFixed(2);}),
      sampleIds: a.interact.reg.slice(0,6).map(function(o){return o.id;})
    };
  })())`, returnByValue: true
});

console.log(JSON.stringify({
  shot: out,
  errors: logs.filter((l) => l.indexOf('[exception]') === 0 || l.indexOf('[error]') === 0),
  logCount: logs.length,
  logs: logs.slice(0, 12),
  evalOut,
  state: JSON.parse(state.result.value || '{}')
}, null, 1));

try { ws.close(); } catch { }
child.kill();
await sleep(250);
process.exit(0);
