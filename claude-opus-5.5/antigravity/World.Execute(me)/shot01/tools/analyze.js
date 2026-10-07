// Audio analysis: per-video-frame (60fps) energy bands + onset + tempo/beat grid
// Output: audio/analysis.json
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

const ROOT = path.join(__dirname, '..');
const SR = 24000, FPS = 60;
const r = spawnSync(ffmpeg, ['-v', 'error', '-i', path.join(ROOT, 'audio/song.wav'), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
const buf = r.stdout;
const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
const dur = x.length / SR;
const nF = Math.ceil(dur * FPS);
console.log('duration', dur, 'frames', nF);

// FFT
const N = 2048;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
const bandEdges = [20, 150, 400, 2000, 6000, 12000]; // bass, lowmid, mid, high, air
const hz = SR / N;
const rms = new Float32Array(nF), flux = new Float32Array(nF);
const bands = Array.from({ length: 5 }, () => new Float32Array(nF));
const spec = 32; const specArr = []; // log-spaced spectrum for visualizers
let prev = new Float32Array(N / 2);
for (let f = 0; f < nF; f++) {
  const c = Math.floor(f / FPS * SR);
  const re = new Float32Array(N), im = new Float32Array(N);
  let s2 = 0;
  for (let i = 0; i < N; i++) { const v = x[c - N / 2 + i] || 0; re[i] = v * win[i]; s2 += v * v; }
  rms[f] = Math.sqrt(s2 / N);
  fft(re, im);
  const mag = new Float32Array(N / 2);
  let fl = 0;
  for (let k = 0; k < N / 2; k++) {
    mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
    const d = mag[k] - prev[k]; if (d > 0) fl += d;
  }
  flux[f] = fl; prev = mag;
  for (let b = 0; b < 5; b++) {
    const k0 = Math.floor(bandEdges[b] / hz), k1 = Math.floor(bandEdges[b + 1] / hz);
    let s = 0; for (let k = k0; k < k1; k++) s += mag[k];
    bands[b][f] = s / (k1 - k0);
  }
  const row = [];
  for (let i = 0; i < spec; i++) {
    const f0 = 40 * Math.pow(10000 / 40, i / spec), f1 = 40 * Math.pow(10000 / 40, (i + 1) / spec);
    const k0 = Math.floor(f0 / hz), k1 = Math.max(k0 + 1, Math.floor(f1 / hz));
    let s = 0; for (let k = k0; k < k1; k++) s += mag[k];
    row.push(s / (k1 - k0));
  }
  specArr.push(row);
}
// normalize helpers
function norm(a, p = 0.98) {
  const s = Array.from(a).sort((m, n) => m - n); const hi = s[Math.floor(s.length * p)] || 1;
  return Array.from(a, v => Math.min(1, v / hi));
}
// onset: flux minus local mean
const on = new Float32Array(nF);
for (let f = 0; f < nF; f++) {
  let m = 0, c = 0; for (let k = -15; k <= 15; k++) { const v = flux[f + k]; if (v !== undefined) { m += v; c++; } }
  on[f] = Math.max(0, flux[f] - m / c);
}
// tempo via autocorrelation over 70..190 bpm
let best = 0, bestLag = 0; const acs = [];
for (let lag = Math.round(FPS * 60 / 190); lag <= Math.round(FPS * 60 / 70); lag++) {
  let s = 0; for (let f = 0; f + lag < nF; f++) s += on[f] * on[f + lag];
  acs.push([lag, s]); if (s > best) { best = s; bestLag = lag; }
}
// refine with fractional lag using comb over long range
let bestP = 0, bestBpm = 0;
for (let bpm = 70; bpm <= 190; bpm += 0.05) {
  const period = FPS * 60 / bpm; let s = 0;
  for (let ph = 0; ph < 1; ph += 1) {}
  // comb energy
  for (let m = 1; m <= 8; m++) { const lag = period * m; const l0 = Math.floor(lag), fr = lag - l0; let a = 0; for (let f = 0; f + l0 + 1 < nF; f += 2) a += on[f] * (on[f + l0] * (1 - fr) + on[f + l0 + 1] * fr); s += a; }
  if (s > bestP) { bestP = s; bestBpm = bpm; }
}
const period = FPS * 60 / bestBpm;
// phase
let bestPh = 0, bestPS = -1;
for (let ph = 0; ph < period; ph += 0.25) {
  let s = 0; for (let t = ph; t < nF; t += period) { const i = Math.round(t); s += on[i] || 0; }
  if (s > bestPS) { bestPS = s; bestPh = ph; }
}
const out = {
  fps: FPS, duration: dur, frames: nF, bpm: +bestBpm.toFixed(3), beatOffset: +(bestPh / FPS).toFixed(4),
  rms: norm(rms).map(v => +v.toFixed(3)), onset: norm(on, 0.995).map(v => +v.toFixed(3)),
  bands: bands.map(b => norm(b).map(v => +v.toFixed(3))),
  spec: (() => { const flat = specArr.flat(); const s = flat.slice().sort((a, b) => a - b); const hi = s[Math.floor(s.length * 0.99)]; return specArr.map(r => r.map(v => +Math.min(1, v / hi).toFixed(2))); })(),
};
fs.writeFileSync(path.join(ROOT, 'audio/analysis.json'), JSON.stringify(out));
console.log('bpm', out.bpm, 'beatOffset', out.beatOffset, 'autocorr lag bpm', (FPS * 60 / bestLag).toFixed(2));
// print rms per second for structure
let line = '';
for (let s = 0; s < Math.floor(dur); s++) { let m = 0; for (let k = 0; k < FPS; k++) m += out.rms[s * FPS + k] || 0; line += (s % 10 === 0 ? `\n${s}s: ` : '') + (m / FPS).toFixed(2) + ' '; }
console.log(line);
