// capture.mjs — render the whole MV in Chrome, chunk by chunk, then mux with the song.
//
//   node capture.mjs [--start=0] [--end=13320] [--chunk=1800] [--bitrate=24000000]
//                    [--out=out/....mp4] [--fresh] [--dry] [--no-mux]
//
// Progress is checkpointed to _dev/tmp/capture-state.json, so the render can be
// resumed after a crash simply by re-running the command (the H.264 stream is
// appended to, never truncated, unless --fresh is given).
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';
import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const PORT = Number(opt('port', '8791'));
const START = Number(opt('start', '0'));
const END = Number(opt('end', '13320'));
const CHUNK = Number(opt('chunk', '1800'));
const BITRATE = Number(opt('bitrate', '24000000'));
const OUT = resolve(ROOT, opt('out', 'out/world.execute(me)_MV_1080p60.mp4'));
const STREAM = resolve(ROOT, opt('stream', '_dev/tmp/mv.h264'));
const STATE = join(HERE, 'tmp', 'capture-state.json');
const fresh = args.includes('--fresh');
const dry = args.includes('--dry');
const noMux = args.includes('--no-mux');
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(dirname(STREAM), { recursive: true });

/* ---------- progress state ----------
 * {done, seq, bytes} is an exact checkpoint: the stream file is truncated back
 * to `bytes` before a chunk is (re)rendered, so a crash can never duplicate or
 * drop frames. */
let state = { done: START, seq: 0, bytes: 0 };
if (!fresh && existsSync(STATE)) {
  try {
    const s = JSON.parse(readFileSync(STATE, 'utf8'));
    if (s.done >= START && s.done <= END && typeof s.bytes === 'number') state = s;
  } catch {}
}
const saveState = () => writeFileSync(STATE, JSON.stringify(state));
if (fresh) { try { writeFileSync(STREAM, Buffer.alloc(0)); } catch {} state = { done: START, seq: 0, bytes: 0 }; }

/* ---------- audio ---------- */
function pickAudio() {
  const forced = opt('audio', 'auto');
  if (forced !== 'auto') return resolve(ROOT, forced);
  for (const c of [join(HERE, 'audio', 'world.execute(me).flac'), join(HERE, 'audio', 'world.execute(me).mp3')]) {
    try { if (statSync(c).size > 1_000_000) return c; } catch {}
  }
  throw new Error('no audio source found');
}

/* ---------- dev server ---------- */
const server = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: HERE, stdio: 'ignore' });
let up = false;
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/state`); if (r.ok) { up = true; break; } } catch {}
  await sleep(200);
}
if (!up) { console.error('server failed to start'); process.exit(1); }

const streamRel = '_dev/tmp/' + STREAM.split(/[\\/]/).pop();
await fetch(`http://127.0.0.1:${PORT}/reset?out=${encodeURIComponent(streamRel)}` +
  (fresh ? '' : `&resume=1&seq=${state.seq}`), { method: 'POST' });

/* ---------- browser lifecycle ----------
 * Chrome is launched detached so that it survives independently of this
 * process, and is restarted automatically if it dies mid-render. */
const DBG = Number(opt('debug-port', '9333'));
async function chromeAlive() {
  try {
    const r = await fetch(`http://127.0.0.1:${DBG}/json/version`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}
async function ensureChrome() {
  if (await chromeAlive()) return true;
  // give an in-flight relaunch a moment to finish before starting another
  await sleep(2500);
  if (await chromeAlive()) return true;
  console.log('  (re)launching Chrome…');
  const p = spawn(process.execPath, ['start-chrome.mjs', `--port=${DBG}`, '--w=1920', '--h=1080'], {
    cwd: HERE, stdio: 'ignore', detached: true,
  });
  p.unref();
  for (let i = 0; i < 200; i++) {
    if (await chromeAlive()) { await sleep(800); return true; }
    await sleep(300);
  }
  return false;
}

/** Run an in-page promise, aborting as soon as the browser stops answering.
 *  Chrome occasionally dies under sustained GPU load, and a wedged render must
 *  not block the run: we poll liveness and give up quickly. */
async function evalWatchdog(cdp, expr, label, maxMs) {
  let settled = false;
  const p = cdp.eval(expr, { awaitPromise: true, timeout: 0 })
    .then(v => { settled = true; return v; }, e => { settled = true; throw e; });
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

/* ---------- render loop ---------- */
async function openPage() {
  if (!await ensureChrome()) throw new Error('could not start Chrome');
  const cdp = await attach({ width: 1920, height: 1080 });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  for (let i = 0; i < 200; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) return cdp;
    if (await cdp.eval('!!window.__error')) throw new Error('page error: ' + await cdp.eval('window.__error'));
    await sleep(250);
  }
  throw new Error('MV never became ready');
}

let cdp = null;
let failed = false;
try {
  if (dry) {
    cdp = await openPage();
    console.log('dry run ok — page ready, renderer: ' + await cdp.eval(
      `(()=>{const d=MV.mv.gl.getExtension('WEBGL_debug_renderer_info');return MV.mv.gl.getParameter(d.UNMASKED_RENDERER_WEBGL);})()`));
  } else {
    const t00 = Date.now();
    const TOTAL = END - START;
    while (state.done < END) {
      const a = state.done, b = Math.min(END, a + CHUNK);
      let ok = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          if (!cdp) cdp = await openPage();
          // roll the stream back to the exact checkpoint before rendering again
          const t = await (await fetch(
            `http://127.0.0.1:${PORT}/truncate?bytes=${state.bytes}&seq=${state.seq}`,
            { method: 'POST' })).json();
          const budget = Math.max(150000, (b - a) * 500);   // ~2x the observed rate
          const res = await evalWatchdog(cdp,
            `MV.capture(${a}, ${b}, ${BITRATE}, ${t.nextSeq})`, `chunk ${a}-${b}`, budget);
          const st2 = await (await fetch(`http://127.0.0.1:${PORT}/state`)).json();
          state.done = b; state.seq = st2.chunks; state.bytes = st2.bytes; saveState();
          const el = (Date.now() - t00) / 1000;
          const pct = (100 * (b - START) / TOTAL).toFixed(1);
          const remain = el / Math.max(1, b - START) * (END - b);
          console.log(`  frames ${a}..${b}  ok  ${(res.bytes / 1048576).toFixed(1)} MB  ` +
            `${res.fps.toFixed(1)} fps  total ${pct}%  eta ${(remain / 60).toFixed(1)} min`);
          ok = true;
          break;
        } catch (e) {
          console.error(`  chunk ${a}..${b} attempt ${attempt} failed: ${e.message}`);
          if (cdp) { try { await close(cdp); } catch {} cdp = null; }
          // the page may have died mid-chunk: make sure the browser is back
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

if (!dry && !failed && !noMux) {
  const st = await (await fetch(`http://127.0.0.1:${PORT}/state`)).json();
  console.log(`  sink: ${st.chunks} chunks, ${(st.bytes / 1048576).toFixed(1)} MB`);
  const audio = pickAudio();
  console.log('  audio: ' + audio.split(/[\\/]/).pop());
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'warning',
    '-r', '60', '-i', STREAM,
    '-i', audio,
    // NB: no `apad` — an endless audio filter would stop ffmpeg from ever
    // finishing. The video is the longer stream, so it defines the duration;
    // the song simply ends ~10 s before the picture does.
    '-map', '0:v:0', '-map', '1:a:0',
    '-t', String(END / 60),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
    '-movflags', '+faststart',
    '-metadata', 'title=world.execute(me); (procedural fan MV)',
    '-metadata', 'artist=Mili',
    '-metadata', 'comment=Procedurally generated in a WebGL program; every frame is a pure function of t.',
    OUT,
  ], { stdio: 'inherit' });
  const code = await new Promise(r => ff.on('exit', r));
  if (code !== 0) { console.error('ffmpeg mux failed: ' + code); process.exitCode = 1; }
  else console.log('  wrote ' + OUT);
}
server.kill();
