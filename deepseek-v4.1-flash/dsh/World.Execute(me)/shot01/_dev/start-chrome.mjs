// start-chrome.mjs — launch ONE long-lived Chrome with a remote debugging port and
// keep it alive. All other dev scripts attach to it over localhost TCP (CDP),
// so no further sandbox escalations are needed.
//
// Usage: node start-chrome.mjs [--port=9333] [--headed] [--w=1920] [--h=1080]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const port = Number(arg('port', '9333'));
const width = Number(arg('w', '1920'));
const height = Number(arg('h', '1080'));
const headed = process.argv.includes('--headed');

const CHROME = process.env.MV_CHROME ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// A unique profile per launch: two Chrome instances sharing one profile refuse
// to start, which is what made the render service flap.
const profile = join(here, 'tmp', `chrome-${process.pid}-${Date.now() % 100000}`);
mkdirSync(profile, { recursive: true });

const args = [
  headed ? '' : '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  '--force-device-scale-factor=1',
  '--allow-file-access-from-files',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  '--no-sandbox',
  '--disable-crash-reporter',
  '--disable-breakpad',
  '--enable-unsafe-swiftshader',
  '--enable-gpu-rasterization',
  'about:blank',
].filter(Boolean);

const child = spawn(CHROME, args, { stdio: 'ignore', detached: false });
let restarts = 0;
child.on('exit', (code) => {
  console.error(`[chrome] exited code=${code}`);
  process.exit(0);
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let info = null;
for (let i = 0; i < 240; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
    info = await r.json();
    break;
  } catch { await sleep(250); }
}
if (!info) { console.error('FATAL: chrome devtools never came up'); process.exit(1); }

const endpoint = { port, ws: info.webSocketDebuggerUrl, browser: info.Browser, profile, pid: child.pid };
writeFileSync(join(here, '.chrome-endpoint.json'), JSON.stringify(endpoint, null, 2));
console.log('[chrome] up: ' + info.Browser);
console.log('[chrome] endpoint -> ' + endpoint.ws);

// Keep one tab alive forever: headless Chrome exits when its last tab closes,
// which would tear down this service in the middle of a long render.
try {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const t = await r.json();
  console.log('[chrome] keeper tab ' + t.id);
} catch (e) {
  console.error('[chrome] keeper tab failed: ' + e.message);
}

process.on('SIGINT', () => { try { child.kill(); } catch {} process.exit(0); });
setInterval(() => {}, 1 << 30); // keep alive
