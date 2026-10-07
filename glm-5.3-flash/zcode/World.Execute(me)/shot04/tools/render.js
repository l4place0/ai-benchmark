// tools/render.js — deterministic frame-by-frame renderer.
// Modes:
//   node tools/render.js --probe                     : measure renderer speed for both GL backends
//   node tools/render.js --shots 0.5,7.2,60 --outdir frames_test
//   node tools/render.js --full [--start F] [--end F] [--out output/file.mp4] [--audio assets/audio.wav]
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
process.env.PUPPETEER_CACHE_DIR = path.join(ROOT, '.chrome');
process.env.PUPPETEER_USER_DATA_DIR = path.join(ROOT, '.userdata');
const puppeteer = require('puppeteer');
const { WebSocketServer } = require('ws');
const TL = require(path.join(ROOT, 'config', 'timeline.js'));

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = k => args.includes(k);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav' };

function startServer(port) {
  return new Promise(res => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/mv/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    const wss = new WebSocketServer({ server: srv, maxPayload: 0 });
    srv.listen(port, '127.0.0.1', () => res({ srv, wss }));
  });
}

async function launch(browserArgs) {
  return puppeteer.launch({
    headless: true,
    protocolTimeout: 600000,
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio',
      '--window-size=1920,1080', '--force-device-scale-factor=1',
      ...browserArgs,
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });
}

async function openPage(browser, port, farm = false) {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[page-err]', m.text()); });
  page.on('pageerror', e => console.log('[page-x]', e.message));
  await page.goto(`http://127.0.0.1:${port}/mv/index.html?w=1920&h=1080${farm ? '&farm=1' : ''}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('document.title === "READY"', { timeout: 60000 });
  const err = await page.evaluate('window.__err');
  if (err) throw new Error('page init fail: ' + err);
  const info = await page.evaluate('window.__info()');
  console.log('[gl]', info.renderer, `${info.w}x${info.h}`);
  return page;
}

const SWIFT_ARGS = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'];
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader'];

async function probe() {
  for (const [name, a] of [['d3d11', GPU_ARGS], ['swiftshader', SWIFT_ARGS]]) {
    try {
      const { srv, wss } = await startServer(0);
      const port = srv.address().port;
      const browser = await launch(a);
      const page = await openPage(browser, port);
      await page.evaluate('window.__renderFrame(10.0, 600)'); // warmup + compile
      await page.evaluate('window.__renderFrame(60.0, 3600)');
      const N = 12;
      const t0 = Date.now();
      for (let i = 0; i < N; i++) {
        const t = 60 + (i % 10) * 1.9;
        await page.evaluate(`window.__renderFrame(${t}, ${Math.round(t * 60)})`);
        await page.evaluate('window.__readPixels()');
      }
      const per = (Date.now() - t0) / N;
      console.log(`[probe] ${name}: ${per.toFixed(1)} ms/frame -> full render ~${(per * TL.FRAMES / 60000).toFixed(1)} min`);
      await browser.close(); srv.close();
    } catch (e) {
      console.log(`[probe] ${name}: FAILED ${e.message.split('\n')[0]}`);
    }
  }
}

async function shots() {
  const list = argOf('--shots', '0.5,7,12,16,30,50,62,95,110,125,150,160,168,171,180,195,205,213.5').split(',').map(Number);
  const outdir = path.join(ROOT, argOf('--outdir', 'frames_test'));
  fs.mkdirSync(outdir, { recursive: true });
  const { srv } = await startServer(0);
  const port = srv.address().port;
  const browser = await launch(has('--swift') ? SWIFT_ARGS : GPU_ARGS);
  const page = await openPage(browser, port);
  for (const t of list) {
    await page.evaluate(`window.__renderFrame(${t}, ${Math.round(t * 60)})`);
    const f = path.join(outdir, `t${String(t).replace('.', '_').padStart(6, '0')}.png`);
    await page.screenshot({ path: f, type: 'png' });
    console.log('shot', t, '->', path.basename(f));
  }
  await browser.close(); srv.close();
}

async function full() {
  const start = parseInt(argOf('--start', '0'));
  const end = parseInt(argOf('--end', TL.FRAMES - 1));
  const out = path.join(ROOT, argOf('--out', 'output/world.executeme_fanMV_1080p60.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audio = path.join(ROOT, argOf('--audio', 'assets/audio.wav'));
  const ffPath = require('@ffmpeg-installer/ffmpeg').path;
  const nFrames = end - start + 1;

  const venc = has('--x264')
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']
    : ['-c:v', 'h264_nvenc', '-preset', 'hq', '-rc', 'vbr', '-cq', '20', '-b:v', '0', '-maxrate', '60M', '-bufsize', '120M', '-pix_fmt', 'yuv420p'];
  const spawnFF = (vArgs) => spawn(ffPath, [
    '-y', '-loglevel', 'warning', '-stats',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', '1920x1080', '-framerate', '60', '-i', 'pipe:0',
    '-i', audio,
    '-vf', 'vflip',
    ...vArgs,
    '-c:a', 'aac', '-b:a', '256k',
    '-movflags', '+faststart',
    '-frames:v', String(nFrames),
    '-shortest',
    out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  let ff = spawnFF(venc);
  // if NVENC init fails, fall back to libx264 (detected via early exit)
  const ffDone = new Promise(resolve => {
    let settled = false;
    ff.on('exit', code => {
      if (settled) { resolve(code); return; }
      settled = true;
      if (code !== 0 && !has('--x264') && doneFrames < 5) {
        console.log('[ffmpeg] nvenc failed, falling back to libx264');
        ff = spawnFF(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p']);
        ff.on('exit', c2 => resolve(c2));
      } else resolve(code);
    });
  });
  console.log('[ffmpeg] encoder:', venc.join(' '));

  const { srv, wss } = await startServer(0);
  const port = srv.address().port;

  let nextFrame = start;
  let doneFrames = 0;
  const t0 = Date.now();
  const sendNext = () => {
    if (nextFrame > end) return;
    const f = nextFrame++;
    wss.clients.forEach(c => c.send(JSON.stringify({ cmd: 'frame', frame: f, t: f / TL.FPS })));
  };
  // register BEFORE opening the page (page connects immediately)
  wss.on('connection', ws => {
    console.log('[ws] page connected');
    sendNext();
    ws.on('message', async data => {
      // header: 8-byte float64 frame index, then RGBA pixels
      const idx = data.readDoubleLE ? data.readDoubleLE(0) : null;
      if (idx === null || Math.abs(idx - doneFrames - start) > 0.5) { console.log('[ws] bad idx', idx, 'expect', doneFrames + start); }
      const ok = ff.stdin.write(data.subarray(8));
      doneFrames++;
      if (doneFrames % 300 === 0) {
        const rate = doneFrames / ((Date.now() - t0) / 1000);
        const eta = (nFrames - doneFrames) / rate;
        console.log(`[render] ${doneFrames}/${nFrames}  ${rate.toFixed(2)} f/s  eta ${Math.round(eta / 60)} min`);
      }
      if (!ok) await new Promise(r => ff.stdin.once('drain', r));
      if (doneFrames % 10 === 0) await new Promise(r => setImmediate(r)); // yield event loop
      sendNext();
    });
  });
  const browser = await launch(has('--swift') ? SWIFT_ARGS : GPU_ARGS);
  const page = await openPage(browser, port, true);
  await page.waitForFunction('window.__farmReady === true', { timeout: 30000 });
  console.log('[ws] farm client ready');
  // safety timeout watchdog
  await new Promise(res => {
    const iv = setInterval(() => {
      if (doneFrames >= nFrames) { clearInterval(iv); res(); }
    }, 500);
  });
  console.log('[render] frames done, waiting ffmpeg...');
  ff.stdin.end();
  await ffDone;
  await browser.close(); srv.close();
  console.log('[render] DONE ->', out);
}

(async () => {
  if (has('--probe')) await probe();
  else if (has('--shots')) await shots();
  else if (has('--full')) await full();
  else console.log('usage: --probe | --shots t,t,... | --full');
})().catch(e => { console.error(e); process.exit(1); });
