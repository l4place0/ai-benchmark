// chrome.mjs — minimal Chrome DevTools Protocol client (no external deps).
// Works around the DSH sandbox rule that forbids piped stdio: Chrome is spawned
// with stdio:'ignore' and driven purely over the localhost debugging socket.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CHROME = process.env.MV_CHROME ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.logs = [];
    this.events = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || [])
          .map((a) => (a.value !== undefined ? String(a.value)
            : a.preview ? JSON.stringify(a.preview)
              : a.description || a.type)).join(' ');
        this.logs.push(`[${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.logs.push(`[exception] ${d.text} ${d.exception?.description || ''}`);
      } else if (msg.method === 'Log.entryAdded') {
        this.logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
      } else {
        const hs = this.events.get(msg.method);
        if (hs) for (const h of hs) h(msg.params);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(handler);
  }

  /** Evaluate an expression in the page, returning the JSON value. */
  async eval(expression, { awaitPromise = true, timeout = 0 } = {}) {
    const params = { expression, awaitPromise, returnByValue: true };
    if (timeout > 0) params.timeout = timeout;
    const r = await this.send('Runtime.evaluate', params);
    if (r.exceptionDetails) {
      throw new Error('page exception: ' + (r.exceptionDetails.exception?.description ||
        r.exceptionDetails.text));
    }
    return r.result?.value;
  }
}

export async function launch({
  width = 1920, height = 1080, headless = true, extraArgs = [], port = 0,
  profileDir = null, gpu = true,
} = {}) {
  const dbgPort = port || (9200 + Math.floor(Math.random() * 700));
  const profile = profileDir || mkdtempSync(join(tmpdir(), 'mv-cdp-'));
  const args = [
    headless ? '--headless=new' : '',
    `--remote-debugging-port=${dbgPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--enable-unsafe-swiftshader',
    gpu ? '' : '--disable-gpu',
    ...extraArgs,
    'about:blank',
  ].filter(Boolean);

  const child = spawn(CHROME, args, { stdio: 'ignore', detached: false });

  let target = null;
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${dbgPort}/json/list`);
      const list = await res.json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  if (!target) { try { child.kill(); } catch {} throw new Error('devtools endpoint never appeared'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  cdp.child = child;
  cdp.port = dbgPort;
  cdp.profile = profile;

  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  return cdp;
}

export async function close(cdp) {
  try { cdp.ws.close(); } catch {}
  if (cdp.attached) {
    // Leave the tab parked instead of closing it: headless Chrome terminates
    // once its last tab goes away, which would kill the shared render service.
    try { await fetch(`http://127.0.0.1:${cdp.port}/json/activate/${cdp.targetId}`); } catch {}
  } else {
    try { cdp.child.kill(); } catch {}
  }
  await sleep(200);
}

/** Attach to the long-lived Chrome started by start-chrome.mjs (new tab). */
export async function attach({ width = 1920, height = 1080, port = null } = {}) {
  let p = port;
  if (!p) {
    const ep = JSON.parse(readFileSync(resolve(HERE, '.chrome-endpoint.json'), 'utf8'));
    p = ep.port;
  }
  let target = null;
  // newer Chrome requires PUT for /json/new
  for (const method of ['PUT', 'GET']) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/json/new?about:blank`, { method });
      if (r.ok) { target = await r.json(); break; }
    } catch {}
  }
  if (!target) throw new Error('could not open a new tab on port ' + p);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  cdp.attached = true;
  cdp.port = p;
  cdp.targetId = target.id;
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  return cdp;
}
