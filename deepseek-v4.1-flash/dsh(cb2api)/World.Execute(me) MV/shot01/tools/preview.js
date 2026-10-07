// Boot render.html in headless Chrome, render sample frames, report errors + QC stats.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WS } = require('./ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = path.resolve(__dirname, '..');
const PORT = 9401;

const get = p => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});

async function openPage() {
  // Chrome leaves Singleton* lock files behind when it is force-killed, which
  // makes the NEXT launch fail with a bare "chrome start failed". Clear the
  // profile every time so runs are repeatable.
  const profile = path.join(BASE, 'tools', 'chrome-profile');
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }

  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    '--window-size=1920,1080', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check',
    '--disable-features=CalculateNativeWinOcclusion',
    '--user-data-dir=' + profile,
    'about:blank',
  ], { stdio: 'ignore' });

  let ver;
  for (let i = 0; i < 120; i++) {
    try { ver = JSON.parse(await get('/json/version')); break; }
    catch { await new Promise(r => setTimeout(r, 250)); }
    if (proc.exitCode !== null) break;
  }
  if (!ver) { try { proc.kill(); } catch {} throw new Error('chrome start failed'); }
  const ws = new WS(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const { targetId } = await ws.cmd('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await ws.cmd('Target.attachToTarget', { targetId, flatten: true });
  const S = sessionId;
  await ws.cmd('Page.enable', {}, S);
  await ws.cmd('Runtime.enable', {}, S);
  await ws.cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, S);
  return { ws, S, proc };
}

const evaluate = async (ws, S, expr) => {
  const r = await ws.cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S);
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

async function shoot(ws, S, out) {
  const r = await ws.cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, S);
  fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
}

module.exports = { openPage, evaluate, shoot, BASE, PORT };

if (require.main === module) {
  (async () => {
    const { ws, S, proc } = await openPage();
    const url = 'file:///' + path.join(BASE, 'render.html').replace(/\\/g, '/');
    console.log('loading', url);
    await ws.cmd('Page.navigate', { url }, S);
    await new Promise(r => setTimeout(r, 2500));

    const err = await evaluate(ws, S, 'window.__ERROR || document.getElementById("err").textContent || ""');
    if (err) { console.log('RENDER ERROR:\n', err); }
    const ready = await evaluate(ws, S, 'String(window.__READY)');
    console.log('ready =', ready);
    if (ready !== 'true') { ws.sock.end(); proc.kill(); process.exit(1); }

    const dur = await evaluate(ws, S, 'window.__DURATION');
    console.log('duration =', dur);

    // sample frames across the whole song
    const times = process.argv.slice(2).map(Number);
    const list = times.length ? times : [1, 8, 20, 35, 45, 60, 78, 90, 105, 120, 140, 155, 168, 180, 195, 209];
    const dir = path.join(BASE, 'frames', '_test');
    fs.mkdirSync(dir, { recursive: true });

    for (const t of list) {
      const t0 = Date.now();
      const bad = await evaluate(ws, S, `(function(){ try{ window.__RENDER(${t}); return ""; }catch(e){ return String(e.stack||e); } })()`);
      if (bad) { console.log(`t=${t}s ERROR`, bad); continue; }
      const out = path.join(dir, `t${String(t).padStart(4, '0')}.png`);
      await shoot(ws, S, out);
      console.log(`t=${String(t).padStart(4)}s  ${Date.now() - t0}ms  ${path.basename(out)}`);
    }
    ws.sock.end(); proc.kill();
    console.log('DONE');
    process.exit(0);
  })().catch(e => { console.error('FAIL', e); process.exit(1); });
}
