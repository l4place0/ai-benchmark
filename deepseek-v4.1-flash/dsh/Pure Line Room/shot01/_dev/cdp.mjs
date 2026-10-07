// Minimal Chrome DevTools Protocol driver (no external deps).
// Usage: node cdp.mjs <fileUrl> <outPng> [--width=1440] [--height=900] [--wait=2000] [--eval=script]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.PLR_CHROME ||
  'C:\\Users\\l4place\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
function opt(name, def) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}
const width = parseInt(opt('width', '1440'), 10);
const height = parseInt(opt('height', '900'), 10);
const waitMs = parseInt(opt('wait', '2500'), 10);
const evalScript = opt('eval', '');
const port = 9000 + Math.floor(Math.random() * 900);
const profile = mkdtempSync(join(tmpdir(), 'plr-cdp-'));

const child = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-gpu',
  '--force-device-scale-factor=1',
  '--allow-file-access-from-files',
  '--mute-audio',
  'about:blank',
], { stdio: 'ignore', detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('chrome devtools endpoint never appeared');
}

const logs = [];
let ws;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function fail(msg) {
  console.error('CDP-ERROR: ' + msg);
  try { child.kill(); } catch {}
  process.exit(2);
}

const target = await getTarget();
ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || [])
      .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ');
    logs.push(`[${msg.params.type}] ${text}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push(`[exception] ${d.text} ${d.exception?.description || ''}`);
  } else if (msg.method === 'Log.entryAdded') {
    logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
  }
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url });
await sleep(waitMs);

if (evalScript) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: evalScript, awaitPromise: true, returnByValue: true,
    });
    console.log('EVAL: ' + JSON.stringify(r.result?.value ?? r.result?.description ?? null));
  } catch (e) {
    console.log('EVAL-ERROR: ' + e.message);
  }
}

if (out && out !== '-') {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SHOT: ' + out);
}

console.log('--- console (' + logs.length + ') ---');
for (const l of logs) console.log(l);

try { ws.close(); } catch {}
child.kill();
await sleep(300);
process.exit(0);
