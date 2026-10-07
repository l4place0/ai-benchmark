// Full video renderer: parallel headless-Chrome workers -> JPEG frames -> x264 segments -> concat + audio
// usage: node tools/render.js [--workers 3] [--from 0] [--to 12737] [--quality 0.95] [--crf 16]
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { start } = require('./server');
const { launch, openPage } = require('./snap');
const ROOT = path.join(__dirname, '..');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const FPS = 60;
const TOTAL = Math.ceil(212.28 * FPS);
const WORKERS = +(args.workers || 3);
const FROM = +(args.from || 0), TO = +(args.to || TOTAL);
const Q = +(args.quality || 0.95), CRF = String(args.crf || 16);
const SEGDIR = path.join(ROOT, 'out', 'segments'); fs.mkdirSync(SEGDIR, { recursive: true });
const LOG = path.join(ROOT, 'out', 'render.log');
const log = (...m) => { const s = `[${new Date().toISOString().slice(11, 19)}] ` + m.join(' '); console.log(s); fs.appendFileSync(LOG, s + '\n'); };

// split into segments of ~600 frames so work can resume and balance
const SEG = 600;
const segs = [];
for (let a = FROM; a < TO; a += SEG) segs.push([a, Math.min(TO, a + SEG)]);
const segFile = (s) => path.join(SEGDIR, `seg_${String(s[0]).padStart(6, '0')}_${String(s[1]).padStart(6, '0')}.mp4`);

async function renderSeg(page, s, stats) {
  const out = segFile(s), tmp = out + '.part.mp4';
  const ff = spawn(ffmpeg, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p', '-g', '120', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  for (let f = s[0]; f < s[1]; f++) {
    const url = await page.evaluate((f, q) => { window.renderFrame(f); return window.captureFrame(q); }, f, Q);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    stats.done++;
  }
  ff.stdin.end();
  await done;
  fs.renameSync(tmp, out);
}

(async () => {
  const todo = segs.filter(s => !fs.existsSync(segFile(s)));
  log(`render frames ${FROM}-${TO} (${TO - FROM}), segments ${segs.length}, todo ${todo.length}, workers ${WORKERS}`);
  const srv = await start(0); const port = srv.address().port;
  const stats = { done: 0, total: todo.reduce((a, s) => a + s[1] - s[0], 0) };
  const T0 = Date.now();
  const timer = setInterval(() => { const el = (Date.now() - T0) / 1000, fps = stats.done / el; log(`progress ${stats.done}/${stats.total}  ${fps.toFixed(2)} fps  ETA ${((stats.total - stats.done) / Math.max(fps, 0.01) / 60).toFixed(1)} min`); }, 30000);
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const browser = await launch();
    const page = await openPage(browser, port);
    while (next < todo.length) { const s = todo[next++]; const t = Date.now(); await renderSeg(page, s, stats); log(`worker ${w} seg ${s[0]}-${s[1]} done in ${((Date.now() - t) / 1000).toFixed(0)}s`); }
    await browser.close();
  }));
  clearInterval(timer); srv.close();
  log(`all segments rendered in ${((Date.now() - T0) / 60000).toFixed(1)} min`);
  if (FROM !== 0 || TO !== TOTAL) return;
  // concat + mux audio
  const list = path.join(SEGDIR, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${segFile(s).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const final = path.join(ROOT, 'out', 'world.execute(me)_procedural_MV_1080p60.mp4');
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, 'audio', 'song.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', final], { stdio: 'inherit' });
  log('mux exit', r.status, final);
  for (const d of fs.readdirSync(path.join(ROOT, '.cache'))) if (d.startsWith('chrome-profile-')) fs.rmSync(path.join(ROOT, '.cache', d), { recursive: true, force: true });
})().catch(e => { log('FATAL', e.stack || e); process.exit(1); });
