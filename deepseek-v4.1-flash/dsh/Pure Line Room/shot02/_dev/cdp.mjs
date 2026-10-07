// cdp.mjs — a very small Chrome DevTools Protocol client used only by the
// development verification scripts. Node 22+ ships a global WebSocket, so this
// needs no dependencies at all.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

export function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('no chrome/edge found');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Browser {
  constructor(proc, ws, info) {
    this.proc = proc;
    this.ws = ws;
    this.info = info;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.events = [];
  }

  static async launch(opts = {}) {
    const port = opts.port || 9333 + Math.floor(Math.random() * 400);
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plr-chrome-'));
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--hide-scrollbars',
      '--mute-audio',
      '--force-device-scale-factor=1',
      '--window-size=' + (opts.width || 1440) + ',' + (opts.height || 900),
      '--remote-debugging-port=' + port,
      '--user-data-dir=' + userDir,
      'about:blank',
    ];
    const proc = spawn(findChrome(), args, { stdio: 'ignore', windowsHide: true });

    let target = null;
    for (let i = 0; i < 120; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        target = list.find((t) => t.type === 'page');
        if (target && target.webSocketDebuggerUrl) break;
      } catch (e) { /* not up yet */ }
    }
    if (!target) { try { proc.kill(); } catch (e) {} throw new Error('chrome did not start'); }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    const b = new Browser(proc, ws, { port, userDir, target });
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id !== undefined) {
        const p = b.pending.get(msg.id);
        if (p) {
          b.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message + ' :: ' + JSON.stringify(msg.error.data || '')));
          else p.resolve(msg.result);
        }
        return;
      }
      b.events.push(msg);
      const arr = b.listeners.get(msg.method);
      if (arr) for (const fn of arr) { try { fn(msg.params); } catch (e) {} }
      const any = b.listeners.get('*');
      if (any) for (const fn of any) { try { fn(msg); } catch (e) {} }
    });
    return b;
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('timeout: ' + method));
        }
      }, 30000);
    });
  }

  async evaluate(expr, opts = {}) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: opts.awaitPromise !== false,
      userGesture: true,
    });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error('page exception: ' + (d.exception && d.exception.description ? d.exception.description : d.text));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(file) {
    const res = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
    return file;
  }

  async mouseMove(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  }

  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(40);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }

  async close() {
    try { this.ws.close(); } catch (e) {}
    try { this.proc.kill(); } catch (e) {}
  }
}

export { sleep };
