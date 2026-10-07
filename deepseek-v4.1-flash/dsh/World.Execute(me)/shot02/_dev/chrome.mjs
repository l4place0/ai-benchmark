// chrome.mjs — minimal Chrome DevTools Protocol client, zero npm dependencies.
//
// The DSH file sandbox forbids piped stdio, so Chrome is spawned with
// stdio:'ignore' and driven entirely over its localhost debugging socket.
// Node's built-in global WebSocket provides the transport.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
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
        const text = (msg.params.args || []).map((a) => (a.value !== undefined ? String(a.value)
          : a.preview ? JSON.stringify(a.preview) : a.description || a.type)).join(' ');
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
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(handler);
  }

  async eval(expression, { awaitPromise = true, timeout = 0 } = {}) {
    const params = { expression, awaitPromise, returnByValue: true };
    if (timeout > 0) params.timeout = timeout;
    const r = await this.send('Runtime.evaluate', params);
    if (r.exceptionDetails) {
      throw new Error('page exception: ' +
        (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result?.value;
  }
}

/** Attach to the long-lived Chrome started by start-chrome.mjs (opens a new tab). */
export async function attach({ width = 1920, height = 1080, port = null, endpointFile = null } = {}) {
  let p = port;
  if (!p) {
    const f = endpointFile || resolve(HERE, '.chrome-endpoint.json');
    p = JSON.parse(readFileSync(f, 'utf8')).port;
  }
  let target = null;
  for (const method of ['PUT', 'GET']) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/json/new?about:blank`, { method });
      if (r.ok) { target = await r.json(); break; }
    } catch { /* try next verb */ }
  }
  if (!target) throw new Error('could not open a tab on debug port ' + p);

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

/** Close the socket but park the tab, so a shared Chrome stays alive. */
export async function close(cdp) {
  try { cdp.ws.close(); } catch { /* already gone */ }
  if (cdp.attached && cdp.targetId) {
    try { await fetch(`http://127.0.0.1:${cdp.port}/json/activate/${cdp.targetId}`); } catch { /* ignore */ }
  } else if (cdp.child) {
    try { cdp.child.kill(); } catch { /* ignore */ }
  }
  await sleep(150);
}

/** One-shot headless launch (used by smoke tests). */
export async function launch({ width = 1920, height = 1080, port = 0, profileDir = null, extraArgs = [] } = {}) {
  const dbgPort = port || (9200 + Math.floor(Math.random() * 700));
  const profile = profileDir || mkdtempSync(join(HERE, 'tmp', 'mv-cdp-'));
  const args = [
    '--headless=new',
    `--remote-debugging-port=${dbgPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required',
    '--mute-audio', '--enable-unsafe-swiftshader',
    ...extraArgs, 'about:blank',
  ];
  const child = spawn(CHROME, args, { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 200; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  if (!target) { try { child.kill(); } catch { /* ignore */ } throw new Error('devtools endpoint never appeared'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const cdp = new CDP(ws);
  cdp.child = child; cdp.port = dbgPort; cdp.profile = profile;
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  return cdp;
}
