// capture.mjs — render the whole MV through Chrome and mux it with the song.
//
//   node _dev/capture.mjs [--start=0] [--end=12738] [--chunk=1200]
//                         [--bitrate=24000000] [--out=out/...] [--fresh] [--no-mux]
//
// Progress is checkpointed to _dev/tmp/capture-state.json as {done, seq, bytes},
// an exact byte offset into the H.264 stream. Re-running the same command after
// an interruption rolls the stream back to that byte and carries on, so no frame
// is ever duplicated or lost.
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const PORT = Number(opt('port', '8802'));
const DBG = Number(opt('debug-port', '9333'));
const START = Number(opt('start', '0'));
const END = Number(opt('end', '12738'));
const CHUNK = Number(opt('chunk', '1200'));
const BITRATE = Number(opt('bitrate', '26000000'));
const GOP = Number(opt('gop', '120'));
const OUT = path.resolve(ROOT, opt('out', 'out/world.execute(me)_MV_1080p60.mp4'));
const STREAM = path.resolve(ROOT, opt('stream', '_dev/tmp/mv.h264'));
const STATE = path.join(HERE, 'tmp', 'capture-state.json');
const FRESH = argv.includes('--fresh');
const DRY = argv.includes('--dry');
const NO_MUX = argv.includes('--no-mux');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(path.dirname(STREAM), { recursive: true });

let state = { done: START, seq: 0, bytes: 0 };
if (!FRESH && fs.existsSync(STATE)) {
  try {
    const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    if (s.done >= START && s.done <= END && typeof s.bytes === 'number') state = s;
  } catch { /* start clean */ }
}
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state));

/* --------------------------------------------------------------- lifecycle */
async function chromeAlive() {
  try { return (await fetch(`http://127.0.0.1:${DBG}/json/version`, { signal: AbortSignal.timeout(3000) })).ok; }
  catch { return false; }
}
async function ensureChrome() {
  if (await chromeAlive()) return true;
  await sleep(2000);
  if (await chromeAlive()) return true;
  console.log('  (re)launching Chrome…');
  const p = spawn(process.execPath, ['start-chrome.mjs', `--port=${DBG}`, '--w=1920', '--h=1080'], {
    cwd: HERE, stdio: 'ignore', detached: true,
  });
  p.unref();
  for (let i = 0; i < 240; i++) { if (await chromeAlive()) { await sleep(800); return true; } await sleep(300); }
  return false;
}

async function serverUp() {
  try { return (await fetch(`http://127.0.0.1:${PORT}/state`, { signal: AbortSignal.timeout(2000) })).ok; }
  catch { return false; }
}

async function openPage() {
  if (!await ensureChrome()) throw new Error('could not start Chrome');
  const cdp = await attach({ width: 1920, height: 1080, port: DBG });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  for (let i = 0; i < 400; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) return cdp;
    const err = await cdp.eval('window.__error || null');
    if (err) throw new Error('page error: ' + err);
    await sleep(250);
  }
  throw new Error('MV never became ready');
}

/** Evaluate an in-page promise, giving up quickly if the browser dies. */
async function evalWatchdog(cdp, expr, label, maxMs) {
  let settled = false;
  const p = cdp.eval(expr, { awaitPromise: true, timeout: 0 })
    .then((v) => { settled = true; return v; }, (e) => { settled = true; throw e; });
  p.catch(() => {});
  const t0 = Date.now();
  while (!settled) {
    await sleep(5000);
    if (settled) break;
    if (!await chromeAlive()) throw new Error(`${label}: browser died`);
    if (Date.now() - t0 > maxMs) throw new Error(`${label}: exceeded ${(maxMs / 1000) | 0}s`);
  }
  return p;
}

/* ------------------------------------------------------------------- main */
let server = null;
if (!await serverUp()) {
  server = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: HERE, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { if (await serverUp()) break; await sleep(200); }
  if (!await serverUp()) { console.error('server failed to start'); process.exit(1); }
}

const total = END - START;
console.log(`capture   frames ${START}..${END}  (${(total / 60).toFixed(2)} s)  chunk ${CHUNK}  ${(BITRATE / 1e6).toFixed(1)} Mb/s`);
console.log(`stream    ${path.relative(ROOT, STREAM)}`);
console.log(`output    ${path.relative(ROOT, OUT)}`);
if (state.done > START) console.log(`resuming  from frame ${state.done} (${(state.bytes / 1048576).toFixed(1)} MB on disk)`);

let cdp = null;
let failed = false;
const t00 = Date.now();

try {
  if (DRY) {
    cdp = await openPage();
    console.log('dry run ok — ' + await cdp.eval('JSON.stringify(window.MV.info())'));
  } else {
    const streamRel = '_dev/tmp/' + path.basename(STREAM);
    while (state.done < END) {
      const a = state.done;
      const b = Math.min(END, a + CHUNK);
      let ok = false;
      for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
        try {
          if (!cdp) cdp = await openPage();
          const t = await (await fetch(
            `http://127.0.0.1:${PORT}/reset?out=${encodeURIComponent(streamRel)}` +
            `&resume=1&bytes=${state.bytes}&seq=${state.seq}`, { method: 'POST' })).json();
          const budget = Math.max(120000, (b - a) * 900);
          const res = await evalWatchdog(cdp,
            `MV.capture(${a}, ${b}, ${BITRATE}, ${t.seq}, ${GOP})`, `chunk ${a}-${b}`, budget);
          const st2 = await (await fetch(`http://127.0.0.1:${PORT}/state`)).json();
          state.done = b; state.seq = st2.chunks; state.bytes = st2.bytes; saveState();
          const el = (Date.now() - t00) / 1000;
          const pct = (100 * (b - START) / total).toFixed(1);
          const remain = el / Math.max(1, b - START) * (END - b);
          console.log(`  ${a}..${b}  ${(res.bytes / 1048576).toFixed(1)} MB  ${res.fps.toFixed(1)} fps  ` +
            `${pct}%  eta ${(remain / 60).toFixed(1)} min`);
          ok = true;
        } catch (e) {
          console.error(`  chunk ${a}..${b} attempt ${attempt}: ${e.message}`);
          if (cdp) { try { await close(cdp); } catch { /* ignore */ } cdp = null; }
          await ensureChrome();
          await sleep(3000);
        }
      }
      if (!ok) throw new Error(`chunk ${a}..${b} failed after 4 attempts`);
    }
  }
} catch (e) {
  failed = true;
  console.error('CAPTURE FAILED: ' + e.message);
  if (cdp && cdp.logs.length) console.error(cdp.logs.slice(-25).join('\n'));
  process.exitCode = 1;
} finally {
  if (cdp) await close(cdp);
}

/* ------------------------------------------------------------------- mux */
if (!DRY && !failed && !NO_MUX) {
  const st = await (await fetch(`http://127.0.0.1:${PORT}/state`)).json();
  console.log(`  bitstream: ${st.chunks} chunks, ${(st.bytes / 1048576).toFixed(1)} MB`);
  const audio = path.resolve(ROOT, opt('audio', 'assets/world.execute(me).mp3'));
  const dur = (END / 60).toFixed(3);
  console.log(`  muxing with ${path.basename(audio)} -> ${dur}s`);
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'warning',
    '-fflags', '+genpts', '-r', '60', '-i', STREAM,
    '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-t', dur,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '44100',
    '-movflags', '+faststart',
    '-metadata', 'title=world.execute(me); (procedural fan MV)',
    '-metadata', 'artist=Mili',
    '-metadata', 'comment=Every frame is computed by a WebGL program as a pure function of t.',
    OUT,
  ], { stdio: 'inherit' });
  const code = await new Promise((r) => ff.on('exit', r));
  if (code !== 0) { console.error('ffmpeg mux failed: ' + code); process.exitCode = 1; }
  else console.log('  wrote ' + path.relative(ROOT, OUT) + '  (' + (fs.statSync(OUT).size / 1048576).toFixed(0) + ' MB)');
}
if (server) server.kill();
