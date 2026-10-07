// bake-audio.mjs — decode the song with ffmpeg, analyse it, and bake a compact
// per-frame table that the WebGL program reads so that render(t) stays a pure
// function of t (no runtime audio analysis, no randomness).
//
// out: assets/analysis.json
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FPS = 60;
const SR = 22050;

const flac = join(HERE, 'audio', 'world.execute(me).flac');
const mp3 = join(HERE, 'audio', 'world.execute(me).mp3');
const usable = (p) => { try { return statSync(p).size > 1_000_000; } catch { return false; } };
const SRC = usable(flac) ? flac : mp3;
console.log('[bake] source: ' + SRC);

// ---- decode to mono float32 ----
const pcm = await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', SRC, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const bufs = [];
  p.stdout.on('data', (d) => bufs.push(d));
  p.on('exit', (c) => c === 0 ? res(Buffer.concat(bufs)) : rej(new Error('ffmpeg exit ' + c)));
});
const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
const dur = x.length / SR;
console.log(`[bake] ${x.length} samples, ${dur.toFixed(3)} s`);

// ---- FFT (iterative radix-2) ----
const N = 2048;
const hann = new Float32Array(N);
for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
const rev = new Uint16Array(N);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < 11; b++) if (i & (1 << b)) r |= 1 << (10 - b); rev[i] = r; }
const cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(-2 * Math.PI * i / N); sinT[i] = Math.sin(-2 * Math.PI * i / N); }
function fft(re, im) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size) {
      for (let j = i, k = 0; j < i + half; j++, k += step) {
        const c = cosT[k], s = sinT[k];
        const tr = re[j + half] * c - im[j + half] * s;
        const ti = re[j + half] * s + im[j + half] * c;
        re[j + half] = re[j] - tr; im[j + half] = im[j] - ti;
        re[j] += tr; im[j] += ti;
      }
    }
  }
}

// ---- per-frame features at 60 Hz ----
const total = Math.round(dur * FPS);
const hop = SR / FPS;
const bass = new Float32Array(total), mid = new Float32Array(total),
  high = new Float32Array(total), rms = new Float32Array(total);
const flux = new Float32Array(total);
let prevMag = new Float32Array(N / 2);
const re = new Float32Array(N), im = new Float32Array(N);
const binHz = SR / N;

for (let f = 0; f < total; f++) {
  const center = Math.round(f * hop);
  const start = center - N / 2;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const idx = start + i;
    const v = (idx >= 0 && idx < x.length) ? x[idx] : 0;
    re[i] = v * hann[i]; im[i] = 0;
    sum += v * v;
  }
  rms[f] = Math.sqrt(sum / N);
  fft(re, im);
  let b = 0, m = 0, h = 0, fl = 0;
  for (let k = 1; k < N / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    const hz = k * binHz;
    if (hz < 250) b += mag;
    else if (hz < 2000) m += mag;
    else if (hz < 9000) h += mag;
    const d = mag - prevMag[k];
    if (d > 0) fl += d;
  }
  prevMag.set;
  for (let k = 1; k < N / 2; k++) prevMag[k] = Math.hypot(re[k], im[k]);
  bass[f] = b; mid[f] = m; high[f] = h; flux[f] = fl;
}

// ---- normalise helpers ----
function norm(a, lo = 0.02, hi = 0.98) {
  const s = Float32Array.from(a).sort();
  const l = s[Math.floor(lo * (s.length - 1))], h = s[Math.floor(hi * (s.length - 1))];
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = Math.min(1, Math.max(0, (a[i] - l) / (h - l || 1)));
  return o;
}
const nBass = norm(bass), nMid = norm(mid), nHigh = norm(high), nRms = norm(rms), nFlux = norm(flux);

// ---- tempo from autocorrelation of the onset envelope ----
// onset envelope: half-wave rectified flux, smoothed
const onset = new Float32Array(total);
for (let i = 0; i < total; i++) {
  let s = 0, c = 0;
  for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < total) { s += nFlux[j]; c++; } }
  onset[i] = s / c;
}
let bestLag = 0, bestVal = -1;
const lagMin = Math.round(0.30 * FPS), lagMax = Math.round(1.20 * FPS);
const ac = new Float32Array(lagMax + 1);
for (let lag = lagMin; lag <= lagMax; lag++) {
  let s = 0;
  for (let i = 0; i + lag < total; i++) s += onset[i] * onset[i + lag];
  ac[lag] = s / (total - lag);
  const bpm = 60 * FPS / lag;
  const w = (bpm >= 100 && bpm <= 170) ? 1.25 : 1.0;
  if (ac[lag] * w > bestVal) { bestVal = ac[lag] * w; bestLag = lag; }
}
let coarseBpm = 60 * FPS / bestLag;
while (coarseBpm < 90) coarseBpm *= 2;
while (coarseBpm > 180) coarseBpm /= 2;
console.log(`[bake] autocorrelation: ${coarseBpm.toFixed(2)} BPM (lag ${bestLag} frames)`);

// fine 2-D search (tempo, phase) maximising mean onset energy on the beat grid
const onsetAt = (t) => {
  const i = Math.floor(t), fr = t - i;
  if (i < 0 || i + 1 >= total) return 0;
  return onset[i] * (1 - fr) + onset[i + 1] * fr;
};
function score(bpm, phase) {
  const per = 60 / bpm * FPS;
  let s = 0, n = 0;
  for (let t = phase; t < total; t += per) { s += onsetAt(t); n++; }
  return n > 8 ? s / n : -1;
}
let bpm = coarseBpm, bestPhase = 0, bestScore = -1;
function sweep(lo, hi, step, phaseDiv) {
  let bb = bpm, bp = bestPhase, bs = -1;
  for (let b = lo; b <= hi; b += step) {
    const per = 60 / b * FPS;
    for (let k = 0; k < phaseDiv; k++) {
      const ph = per * k / phaseDiv;
      const sc = score(b, ph);
      if (sc > bs) { bs = sc; bb = b; bp = ph; }
    }
  }
  bpm = bb; bestPhase = bp; bestScore = bs;
}
sweep(coarseBpm - 6, coarseBpm + 6, 0.1, 24);
sweep(bpm - 0.3, bpm + 0.3, 0.01, 48);
sweep(bpm - 0.03, bpm + 0.03, 0.001, 96);
const beatFrames = FPS * 60 / bpm;
console.log(`[bake] refined tempo = ${bpm.toFixed(4)} BPM  beat=${beatFrames.toFixed(4)} frames  phase=${(bestPhase / FPS).toFixed(4)} s  score=${bestScore.toFixed(5)}`);
const beats = [];
for (let t = bestPhase; t < total; t += beatFrames) beats.push(Math.round(t));

// ---- downbeat (which beat starts the bar) ----
let bestOff = 0, bestB = -1;
for (let o = 0; o < 4; o++) {
  let s = 0, n = 0;
  for (let i = o; i < beats.length; i += 4) { s += nBass[beats[i]] + 0.5 * onset[beats[i]]; n++; }
  if (n && s / n > bestB) { bestB = s / n; bestOff = o; }
}
const downbeats = beats.filter((_, i) => (i - bestOff) % 4 === 0 && i >= bestOff);
console.log(`[bake] downbeat offset = ${bestOff} (score ${bestB.toFixed(4)}), ${downbeats.length} bars`);

// ---- section boundaries from a smoothed novelty curve ----
const sm = new Float32Array(total);
const W = 90;
for (let i = 0; i < total; i++) {
  let s = 0, c = 0;
  for (let k = -W; k <= W; k++) { const j = i + k; if (j >= 0 && j < total) { s += nRms[j] * 0.7 + nHigh[j] * 0.3; c++; } }
  sm[i] = s / c;
}

// ---- quantise to bytes and emit ----
const q = (a) => Array.from(a, (v) => Math.max(0, Math.min(255, Math.round(v * 255))));
const out = {
  fps: FPS, durationSec: dur, frames: total, src: SRC.split(/[\\/]/).pop(),
  bpm: +bpm.toFixed(4), beatFrames: +beatFrames.toFixed(4),
  beatPhaseSec: +(bestPhase / FPS).toFixed(4),
  beats, // frame indices of beats
  downbeats, // frame indices of bar starts (every 4th beat)
  barFrames: beatFrames * 4,
  bass: q(nBass), mid: q(nMid), high: q(nHigh), rms: q(nRms), flux: q(nFlux),
  curve: q(sm), // smoothed loudness+brilliance for section colouring
};
mkdirSync(join(ROOT, 'assets'), { recursive: true });
writeFileSync(join(ROOT, 'assets', 'analysis.json'), JSON.stringify(out));
console.log(`[bake] wrote assets/analysis.json (${total} frames, ${beats.length} beats)`);

// ---- ASCII structure printout (1 column == 1 second) ----
const ramp = ' .:-=+*#%@';
const perSec = FPS;
const rows = { rms: '', bass: '', high: '', barl: '' };
for (let s = 0; s < Math.ceil(total / perSec); s++) {
  const avg = (a) => {
    let v = 0;
    for (let i = 0; i < perSec; i++) v += a[Math.min(total - 1, s * perSec + i)];
    return v / perSec;
  };
  rows.rms += ramp[Math.min(9, Math.floor(avg(sm) * 10))];
  rows.bass += ramp[Math.min(9, Math.floor(avg(nBass) * 10))];
  rows.high += ramp[Math.min(9, Math.floor(avg(nHigh) * 10))];
  const db = downbeats.find(b => b >= s * perSec && b < (s + 1) * perSec);
  const bt = beats.find(b => b >= s * perSec && b < (s + 1) * perSec);
  rows.barl += db !== undefined ? '|' : (bt !== undefined ? ':' : ' ');
}
console.log('\n=== structure (1 char = 1 s) ===');
console.log('     ' + 'loudness (smoothed rms+high)'.padEnd(30) + '  bar=|  beat=:');
for (let i = 0; i < rows.rms.length; i += 60) {
  const a = i, b = Math.min(rows.rms.length, i + 60);
  console.log(String(a).padStart(3) + 's loud ' + rows.rms.slice(a, b));
  console.log('     bass ' + rows.bass.slice(a, b));
  console.log('     high ' + rows.high.slice(a, b));
  console.log('     grid ' + rows.barl.slice(a, b));
}

