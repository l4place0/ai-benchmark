// start-chrome.mjs — bring up the long-lived headless Chrome used for rendering.
// Detached + stdio:'ignore' so it survives this process and never needs a pipe.
//
//   node _dev/start-chrome.mjs [--port=9333] [--w=1920] [--h=1080] [--headed]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME, sleep } from './chrome.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const PORT = Number(opt('port', '9333'));
const W = Number(opt('w', '1920'));
const H = Number(opt('h', '1080'));
const HEADED = argv.includes('--headed');
const PROFILE = path.resolve(ROOT, opt('profile', '_dev/tmp/chrome-profile'));

async function alive() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch { return false; }
}

if (await alive()) {
  console.log(`chrome already listening on ${PORT}`);
  fs.writeFileSync(path.join(HERE, '.chrome-endpoint.json'), JSON.stringify({ port: PORT, pid: null }));
  process.exit(0);
}

fs.mkdirSync(PROFILE, { recursive: true });

const args = [
  HEADED ? '' : '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  '--force-device-scale-factor=1',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  // Chrome's own sandbox and crashpad cannot start under the DSH file sandbox
  // (crashpad opens a process handle that is denied), so both are turned off.
  '--no-sandbox',
  '--disable-crash-reporter',
  '--disable-breakpad',
  '--enable-unsafe-swiftshader',
  '--enable-gpu-rasterization',
  '--allow-file-access-from-files',
  '--disable-dev-shm-usage',
  'about:blank',
].filter(Boolean);

const child = spawn(CHROME, args, { stdio: 'ignore', detached: true });
child.unref();
console.log(`launching chrome pid=${child.pid} debug=${PORT} profile=${path.relative(ROOT, PROFILE)}`);

for (let i = 0; i < 240; i++) {
  if (await alive()) {
    fs.writeFileSync(path.join(HERE, '.chrome-endpoint.json'), JSON.stringify({ port: PORT, pid: child.pid }));
    console.log('chrome ready');
    process.exit(0);
  }
  await sleep(250);
}
console.error('chrome never became ready');
process.exit(1);
