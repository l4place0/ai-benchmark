// main.js — boot, preview player, and the in-page H.264 render service.
//
// In capture mode the page is driven entirely from outside over the DevTools
// protocol: it renders frame ranges, encodes them with WebCodecs and posts the
// resulting Annex-B byte stream to the local server. No screenshots are taken,
// so nothing large ever touches the disk.

import { loadMusic, FPS, BEAT, BLOCK, blockStart } from './audio.js';
import { Renderer } from './render.js';

const qs = new URLSearchParams(location.search);
const CAPTURE = qs.get('capture') === '1';
const FRAMES = Number(qs.get('frames') || 12738);   // 212.30 s

const canvas = document.getElementById('stage');
const hudEl = document.getElementById('hud');

let mus = null;
let renderer = null;
let playing = false;
let currentT = 0;
let audio = null;

/* ------------------------------------------------------------------ boot */
async function boot() {
  canvas.width = 1920;
  canvas.height = 1080;
  mus = await loadMusic('assets/analysis.json');
  renderer = new Renderer(canvas);
  await renderer.text.load('assets/JetBrainsMono-Regular.woff2', '400');

  if (!CAPTURE) {
    audio = new Audio('assets/world.execute(me).mp3');
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', () => { if (!playing) currentT = 0; });
    requestAnimationFrame(loop);
    window.addEventListener('keydown', onKey);
  } else {
    document.body.classList.add('capture');
  }
  return true;
}

/* ---------------------------------------------------------------- player */
let lastWall = 0;
function loop(ts) {
  if (playing && audio) currentT = audio.currentTime;
  renderer.renderFrame(currentT, mus);
  updateHud();
  requestAnimationFrame(loop);
}

function updateHud() {
  if (!hudEl) return;
  hudEl.textContent =
    `t ${currentT.toFixed(2)}s   frame ${Math.round(currentT * FPS)}/${FRAMES}   ` +
    `bar ${mus.barIndex(currentT)}   block ${mus.blockAt(currentT)}   ${mus.blockAt(currentT) >= 0 ? '' : ''}` +
    `${playing ? '  ▶' : '  ❚❚'}`;
}

function onKey(e) {
  if (e.code === 'Space') {
    e.preventDefault();
    playing = !playing;
    if (playing) { audio.currentTime = currentT; audio.play(); } else { audio.pause(); }
  } else if (e.code === 'ArrowRight') {
    currentT = Math.min(mus.duration, currentT + 1 / FPS);
    if (playing) audio.currentTime = currentT;
  } else if (e.code === 'ArrowLeft') {
    currentT = Math.max(0, currentT - 1 / FPS);
    if (playing) audio.currentTime = currentT;
  } else if (e.code === 'ArrowUp') { currentT = Math.min(mus.duration, currentT + 5); }
  else if (e.code === 'ArrowDown') { currentT = Math.max(0, currentT - 5); }
  else if (e.code === 'Home') { currentT = 0; }
}

/* ----------------------------------------------------------- still frames */
function readFramePixels() {
  const gl = renderer.gl;
  const w = renderer.W, h = renderer.H;
  const px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** FNV-1a over the rendered pixels — used to prove frames are pure functions of t. */
function hashFrame(t) {
  renderer.renderFrame(t, mus);
  const px = readFramePixels();
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i += 7) {
    h ^= px[i];
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function stillFrame(t) {
  renderer.renderFrame(t, mus);
  const gl = renderer.gl;
  const w = renderer.W, h = renderer.H;
  const px = readFramePixels();
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  // WebGL origin is bottom-left; flip while copying
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    img.data.set(px.subarray(src, src + w * 4), y * w * 4);
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

/* --------------------------------------------------------------- capture */
function makeEncoder(bitrate) {
  let err = null;
  const enc = new VideoEncoder({
    output: (chunk) => {
      if (!enc._sink) return;
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      enc._sink(buf);
    },
    error: (e) => { err = e; if (enc._onError) enc._onError(e); },
  });
  enc.configure({
    codec: 'avc1.640032',
    width: 1920, height: 1080,
    bitrate,
    framerate: 60,
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'quality',
    avc: { format: 'annexb' },
  });
  enc._getError = () => err;
  return enc;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(start, end, bitrate, seqStart, gop) {
  const t0 = performance.now();
  let seq = seqStart;
  let pending = [];
  let pendingBytes = 0;
  let total = 0;
  let fatal = null;
  const BATCH = 2 * 1024 * 1024;

  const enc = makeEncoder(bitrate);
  enc._onError = (e) => { fatal = e; };
  enc._sink = (buf) => { pending.push(buf); pendingBytes += buf.length; };

  async function flush() {
    if (!pendingBytes) return;
    let blob;
    if (pending.length === 1) blob = pending[0];
    else {
      blob = new Uint8Array(pendingBytes);
      let o = 0;
      for (const p of pending) { blob.set(p, o); o += p.length; }
    }
    pending = []; pendingBytes = 0;
    const r = await fetch(`/chunk?seq=${seq}`, { method: 'POST', body: blob });
    if (!r.ok) throw new Error('chunk ' + seq + ' rejected: ' + (await r.text()));
    seq++;
    total += blob.length;
  }

  const dt = Math.round(1e6 / FPS);
  for (let i = start; i < end; i++) {
    if (fatal) throw new Error('encoder: ' + fatal.message);
    renderer.renderFrame(i / FPS, mus);
    const vf = new VideoFrame(canvas, { timestamp: i * dt, duration: dt });
    enc.encode(vf, { keyFrame: (i % gop) === 0 });
    vf.close();
    let guard = 0;
    while (enc.encodeQueueSize > 6 && guard++ < 400) await wait(1);
    if (pendingBytes >= BATCH) await flush();
    if ((i - start) % 60 === 59) await wait(0);
  }
  await enc.flush();
  await flush();
  enc.close();
  const secs = (performance.now() - t0) / 1000;
  return { frames: end - start, bytes: total, fps: (end - start) / secs, seq, seconds: secs };
}

/* ------------------------------------------------------------- public API */
window.MV = {
  ready: false,
  frames: FRAMES,
  FPS,
  async renderAt(t) { renderer.renderFrame(t, mus); },
  still(t) { return stillFrame(t); },
  hash(t) { return hashFrame(t); },
  capture,
  blockStart,
  info() {
    const gl = renderer.gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      duration: mus.duration,
      hits: mus.hits.length,
    };
  },
};

boot()
  .then(() => { window.MV.ready = true; })
  .catch((e) => {
    window.__error = (e && e.stack) || String(e);
    console.error('BOOT FAILED', e);
    if (hudEl) hudEl.textContent = 'BOOT FAILED: ' + e.message;
  });

window.addEventListener('error', (e) => { window.__error = e.message; });
window.addEventListener('unhandledrejection', (e) => {
  window.__error = (e.reason && e.reason.stack) || String(e.reason);
});

export { FPS, BEAT, BLOCK };
