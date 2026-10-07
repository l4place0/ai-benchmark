// bake-audio.mjs — offline audio feature bake for the MV.
//
// Reads a 16-bit PCM WAV (44.1 kHz stereo), computes one feature vector per
// VIDEO FRAME (60 Hz), plus onset envelope / tempo / structural segmentation,
// and writes assets/analysis.json.
//
// Everything is deterministic: no randomness, no wall-clock, fixed float ops.
//
// usage: node _dev/bake-audio.mjs [--wav=...] [--out=...] [--fps=60]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};

const WAV = path.resolve(ROOT, arg('wav', '_dev/tmp/song.wav'));
const OUT = path.resolve(ROOT, arg('out', 'assets/analysis.json'));
const FPS = Number(arg('fps', '60'));

// ---------------------------------------------------------------- wav reader
function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not WAVE');
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    off = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('missing fmt/data chunk');
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error('expected 16-bit PCM, got fmt=' + fmt.audioFormat + ' bits=' + fmt.bitsPerSample);
  }
  const n = Math.floor(data.length / 2 / fmt.channels);
  const mono = new Float32Array(n);
  const ch = fmt.channels;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += data.readInt16LE((i * ch + c) * 2);
    mono[i] = s / (ch * 32768);
  }
  return { sampleRate: fmt.sampleRate, channels: ch, samples: mono };
}

// ------------------------------------------------------------------- FFT
// iterative radix-2 complex FFT, precomputed tables, no allocation per call
function makeFFT(n) {
  const levels = Math.log2(n) | 0;
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i, r = 0;
    for (let j = 0; j < levels; j++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  return function fft(input) {
    for (let i = 0; i < n; i++) { re[i] = input[rev[i]]; im[i] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const c = cos[k], s = sin[k];
          const tr = re[j + half] * c + im[j + half] * s;
          const ti = -re[j + half] * s + im[j + half] * c;
          re[j + half] = re[j] - tr; im[j + half] = im[j] - ti;
          re[j] += tr; im[j] += ti;
        }
      }
    }
    return { re, im };
  };
}

// ------------------------------------------------------------- main analysis
const t0 = Date.now();
const wav = readWav(WAV);
const sr = wav.sampleRate;
const sig = wav.samples;
const duration = sig.length / sr;
const nFrames = Math.floor((duration - 0.05) * FPS);

const N = 2048;                       // fft window
const HOP = sr / FPS;                 // samples per video frame (fractional)
const fft = makeFFT(N);
const win = new Float64Array(N);
for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); // hann

const bins = N / 2 + 1;
const binHz = sr / N;
const band = (lo, hi) => {
  const a = Math.max(1, Math.round(lo / binHz));
  const b = Math.min(bins - 1, Math.round(hi / binHz));
  return [a, b];
};
const BANDS = {
  sub: band(20, 60),
  bass: band(60, 160),
  lowMid: band(160, 400),
  mid: band(400, 1200),
  highMid: band(1200, 3000),
  high: band(3000, 7000),
  air: band(7000, 16000),
};

const frameBuf = new Float64Array(N);
const prevMag = new Float64Array(bins);
const bands = {};
for (const k of Object.keys(BANDS)) bands[k] = new Float32Array(nFrames);
const flux = new Float32Array(nFrames);      // half-wave rectified spectral flux
const rms = new Float32Array(nFrames);
const centroid = new Float32Array(nFrames);
const rolloff = new Float32Array(nFrames);

for (let f = 0; f < nFrames; f++) {
  const center = Math.round(f * HOP);
  const start = center - (N >> 1);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const idx = start + i;
    const v = idx >= 0 && idx < sig.length ? sig[idx] : 0;
    const w = v * win[i];
    frameBuf[i] = w;
    sum += v * v;
  }
  rms[f] = Math.sqrt(sum / N);

  const { re, im } = fft(frameBuf);
  let num = 0, den = 0, fl = 0, total = 0;
  for (let k = 1; k < bins; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    const d = mag - prevMag[k];
    if (d > 0) fl += d;
    prevMag[k] = mag;
    num += mag * k * binHz;
    den += mag;
    total += mag;
  }
  flux[f] = fl;
  centroid[f] = den > 0 ? num / den : 0;

  // 85% rolloff
  let acc = 0, ro = 0;
  const target = total * 0.85;
  for (let k = 1; k < bins; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    acc += mag;
    if (acc >= target) { ro = k * binHz; break; }
  }
  rolloff[f] = ro;

  for (const [name, [a, b]] of Object.entries(BANDS)) {
    let e = 0;
    for (let k = a; k <= b; k++) e += re[k] * re[k] + im[k] * im[k];
    bands[name][f] = Math.sqrt(e / (b - a + 1));
  }
}

// -------------------------------------------------- normalise + smooth utils
const fluxS = smoothArr(flux, 2);
function smoothArr(a, radius) {
  const n = a.length;
  const out = new Float32Array(n);
  let acc = 0;
  const w = radius * 2 + 1;
  // moving average, clamped edges
  for (let i = -radius; i <= radius; i++) acc += a[Math.min(n - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
    out[i] = acc / w;
    const add = a[Math.min(n - 1, i + radius + 1)];
    const rem = a[Math.max(0, i - radius)];
    acc += add - rem;
  }
  return out;
}
function normalise(a, lo = 0.02, hi = 0.98) {
  const sorted = Float32Array.from(a).sort();
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
  const a0 = q(lo), a1 = q(hi);
  const out = new Float32Array(a.length);
  const inv = a1 > a0 ? 1 / (a1 - a0) : 0;
  for (let i = 0; i < a.length; i++) out[i] = Math.min(1, Math.max(0, (a[i] - a0) * inv));
  return out;
}

// low-band (kick) flux: the same positive spectral flux restricted to < 220 Hz
const kick = new Float32Array(nFrames);
{
  const kPrev = new Float64Array(bins);
  const kb = Math.max(2, Math.round(220 / binHz));
  for (let f = 0; f < nFrames; f++) {
    const center = Math.round(f * HOP);
    const start = center - (N >> 1);
    for (let i = 0; i < N; i++) {
      const idx = start + i;
      frameBuf[i] = (idx >= 0 && idx < sig.length ? sig[idx] : 0) * win[i];
    }
    const { re, im } = fft(frameBuf);
    let fl = 0;
    for (let k = 1; k <= kb; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const d = mag - kPrev[k];
      if (d > 0) fl += d;
      kPrev[k] = mag;
    }
    kick[f] = fl;
  }
}

// onset salience: spectral flux divided by its own slow-moving average. A ratio
// rather than a difference, so a drum hit in a dense loud chorus scores the same
// as one in the near-silent intro. Computed for the full band and for the kick
// band, then combined.
function salience(x) {
  const mean = smoothArr(x, Math.round(1.2 * FPS));
  const out = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) out[i] = x[i] / (mean[i] + 1e-7);
  return out;
}
const salFull = salience(fluxS);
const salKick = salience(smoothArr(kick, 1));
const onset = new Float32Array(nFrames);
for (let i = 0; i < nFrames; i++) onset[i] = Math.max(salFull[i], salKick[i]);
const onsetN = new Float32Array(nFrames);
{
  let m = 0;
  for (let i = 0; i < nFrames; i++) if (onset[i] > m && onset[i] < 1e6) m = onset[i];
  // robust cap: use the 99.5th percentile as "1.0" so a single outlier can't
  // squash the whole curve
  const sorted = Float32Array.from(onset).sort();
  const cap = sorted[Math.floor(sorted.length * 0.995)] || m;
  for (let i = 0; i < nFrames; i++) onsetN[i] = Math.min(1, onset[i] / cap);
}
const kickN = new Float32Array(nFrames);
{
  const cap = (() => { const s = Float32Array.from(salKick).sort(); return s[Math.floor(s.length * 0.995)] || 1; })();
  for (let i = 0; i < nFrames; i++) kickN[i] = Math.min(1, salKick[i] / cap);
}

// peak-picked transients: used so every on-screen hit lands on real audio.
const hits = [];
{
  const R = 2, MINGAP = 5, THRESH = 0.42;
  let last = -999;
  for (let i = R; i < nFrames - R; i++) {
    const v = onsetN[i];
    if (v < THRESH) continue;
    let isMax = true;
    for (let j = -R; j <= R; j++) if (onsetN[i + j] > v) { isMax = false; break; }
    if (!isMax) continue;
    if (i - last < MINGAP) {
      // keep the stronger of two adjacent candidates
      if (hits.length && v > hits[hits.length - 1][1]) {
        hits[hits.length - 1] = [Math.round((i / FPS) * 1000) / 1000, Math.round(v * 1000) / 1000];
        last = i;
      }
      continue;
    }
    last = i;
    hits.push([Math.round((i / FPS) * 1000) / 1000, Math.round(v * 1000) / 1000]);
  }
}

// ------------------------------------------------------------- tempo search
// autocorrelation of the onset envelope over 60..200 BPM, with a log-normal
// tempo prior centred on 120 BPM to break octave ambiguity.
const fps = FPS;
const acMin = Math.max(4, Math.round((60 / 200) * fps));
const acMax = Math.round((60 / 60) * fps);
let best = { bpm: 0, score: -1 };
const acScore = [];
for (let lag = acMin; lag <= acMax; lag++) {
  let s = 0, n = 0;
  for (let i = 0; i + lag < nFrames; i++) { s += onset[i] * onset[i + lag]; n++; }
  s /= Math.max(1, n);
  const bpm = (60 * fps) / lag;
  const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
  const v = s * prior;
  acScore.push({ bpm, lag, s, v });
  if (v > best.score) best = { bpm, score: v, lag, raw: s };
}
// refine with parabolic interpolation around the peak
const peakIdx = acScore.findIndex((e) => e.lag === best.lag);
let refinedBpm = best.bpm;
if (peakIdx > 0 && peakIdx < acScore.length - 1) {
  const y0 = acScore[peakIdx - 1].v, y1 = acScore[peakIdx].v, y2 = acScore[peakIdx + 1].v;
  const d = (y0 - 2 * y1 + y2);
  if (Math.abs(d) > 1e-12) {
    const delta = (0.5 * (y0 - y2)) / d;
    refinedBpm = (60 * fps) / (best.lag + delta);
  }
}

// beat grid: pick a phase that maximises summed onset on the grid
const beatPeriod = (60 / refinedBpm) * fps;
let bestPhase = 0, bestPhaseScore = -1;
for (let p = 0; p < beatPeriod; p += 0.25) {
  let s = 0;
  for (let k = 0; ; k++) {
    const idx = Math.round(p + k * beatPeriod);
    if (idx >= nFrames) break;
    s += onset[idx];
  }
  if (s > bestPhaseScore) { bestPhaseScore = s; bestPhase = p; }
}
const beats = [];
for (let k = 0; ; k++) {
  const idx = bestPhase + k * beatPeriod;
  if (idx >= nFrames) break;
  beats.push(Math.round(idx * 1000) / 1000);
}

// --------------------------------------------------------- structural curve
// self-similarity-flavoured novelty: compare mean feature vectors of a
// 2-second window before vs after each instant (a "checkerboard" kernel).
function feature(frame) {
  return [
    bands.sub[frame], bands.bass[frame], bands.lowMid[frame], bands.mid[frame],
    bands.highMid[frame], bands.high[frame], bands.air[frame],
    rms[frame], centroid[frame] / 8000, rolloff[frame] / 16000,
  ];
}
const D = 10;
const W = Math.round(2.0 * FPS);            // 2 s half-window
const novelty = new Float32Array(nFrames);
const fmean = new Float32Array(nFrames * D);
for (let f = 0; f < nFrames; f++) {
  const v = feature(f);
  for (let d = 0; d < D; d++) fmean[f * D + d] = v[d];
}
// normalise each dimension across the whole track
for (let d = 0; d < D; d++) {
  const col = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) col[f] = fmean[f * D + d];
  const nz = normalise(col);
  for (let f = 0; f < nFrames; f++) fmean[f * D + d] = nz[f];
}
for (let f = W; f < nFrames - W; f++) {
  let s = 0;
  for (let d = 0; d < D; d++) {
    let a = 0, b = 0;
    for (let i = 1; i <= W; i++) {
      a += fmean[(f - i) * D + d];
      b += fmean[(f + i) * D + d];
    }
    a /= W; b /= W;
    s += (a - b) * (a - b);
  }
  novelty[f] = s;
}
const noveltyS = smoothArr(novelty, Math.round(0.35 * FPS));
const noveltyN = normalise(noveltyS, 0.05, 0.97);

// peak-pick the novelty curve with a minimum spacing of ~6 s
const minGap = Math.round(6 * FPS);
const cand = [];
for (let f = Math.round(3 * FPS); f < nFrames - Math.round(1 * FPS); f++) {
  const v = noveltyN[f];
  if (v < 0.14) continue;
  let isMax = true;
  for (let j = -Math.round(0.8 * FPS); j <= Math.round(0.8 * FPS); j++) {
    const g = f + j;
    if (g >= 0 && g < nFrames && noveltyN[g] > v) { isMax = false; break; }
  }
  if (isMax) cand.push({ frame: f, t: f / FPS, strength: v });
}
cand.sort((a, b) => b.strength - a.strength);
const picked = [];
for (const c of cand) {
  if (picked.every((p) => Math.abs(p.frame - c.frame) >= minGap)) picked.push(c);
}
picked.sort((a, b) => a.frame - b.frame);

// snap boundaries onto the nearest beat
const snapped = picked.map((p) => {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < beats.length; i++) {
    const dd = Math.abs(beats[i] - p.frame);
    if (dd < bd) { bd = dd; bi = i; }
  }
  const target = bd <= beatPeriod * 0.5 ? beats[bi] : p.frame;
  return { t: Math.round((target / FPS) * 1000) / 1000, beats: bi, strength: p.strength, raw: p.t };
});

// ------------------------------------------------------------------ packing
const b64 = (arr, asInt = 1000) => {
  // quantise a float array to uint16 and base64 it — keeps analysis.json small
  const n = arr.length;
  const u = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.min(1, Math.max(0, arr[i])) * 65535);
    u[i] = v;
  }
  const bytes = Buffer.from(u.buffer, u.byteOffset, u.byteLength);
  return bytes.toString('base64');
};

const out = {
  generated: 'bake-audio.mjs',
  fps: FPS,
  sampleRate: sr,
  duration: Math.round(duration * 1000) / 1000,
  frames: nFrames,
  tempo: {
    bpm: Math.round(refinedBpm * 100) / 100,
    beatFrames: Math.round(beatPeriod * 10000) / 10000,
    beatSeconds: Math.round((60 / refinedBpm) * 10000) / 10000,
    phaseFrame: Math.round(bestPhase * 1000) / 1000,
    beats,
    confidence: Math.round(best.raw * 1e6) / 1e6,
  },
  sections: snapped,
  hits,
  // raw feature curves, quantised + base64 (little-endian uint16, 0..65535)
  curves: {
    rms: b64(normalise(smoothArr(rms, 1), 0.01, 0.99)),
    onset: b64(onsetN),
    kick: b64(kickN),
    novelty: b64(noveltyN),
    centroid: b64(normalise(centroid, 0.02, 0.98)),
    rolloff: b64(normalise(rolloff, 0.02, 0.98)),
    sub: b64(normalise(smoothArr(bands.sub, 2), 0.02, 0.99)),
    bass: b64(normalise(smoothArr(bands.bass, 2), 0.02, 0.99)),
    lowMid: b64(normalise(smoothArr(bands.lowMid, 2), 0.02, 0.99)),
    mid: b64(normalise(smoothArr(bands.mid, 2), 0.02, 0.99)),
    highMid: b64(normalise(smoothArr(bands.highMid, 2), 0.02, 0.99)),
    high: b64(normalise(smoothArr(bands.high, 2), 0.02, 0.99)),
    air: b64(normalise(smoothArr(bands.air, 2), 0.02, 0.99)),
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));

// ------------------------------------------------------------------ report
const loud = [];
{
  const r = normalise(smoothArr(rms, Math.round(0.5 * FPS)), 0.02, 0.98);
  for (let f = 0; f < nFrames; f += Math.round(0.5 * FPS)) loud.push(r[f].toFixed(2));
}
console.log('wav           :', path.relative(ROOT, WAV));
console.log('duration      :', duration.toFixed(3), 's   channels', wav.channels, '@', sr);
console.log('frames        :', nFrames, '@', FPS, 'fps');
console.log('tempo         :', out.tempo.bpm, 'BPM  (beat', out.tempo.beatSeconds.toFixed(3), 's)');
console.log('beats         :', beats.length);
console.log('boundaries    :', snapped.map((s) => s.t.toFixed(2)).join('  '));
console.log('novelty peaks :', picked.length);
console.log('out           :', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
console.log('elapsed       :', ((Date.now() - t0) / 1000).toFixed(1), 's');
