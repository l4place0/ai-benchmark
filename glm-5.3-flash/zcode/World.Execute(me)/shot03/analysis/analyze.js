// analyze.js — BPM / beat phase / energy envelopes / onset flux / LRC offset for world.execute(me);
// usage: node analyze.js   (reads analysis/pcm.f32 + analysis/netease_lyric.json)
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const SR = 22050, FFT = 1024, HOP = 220; // hop = 10ms
const pcm = fs.readFileSync(path.join(DIR, 'pcm.f32'));
const N = pcm.length / 4;
const x = new Float32Array(N);
for (let i = 0; i < N; i++) x[i] = pcm.readFloatLE(i * 4);
const dur = N / SR;
console.error(`pcm ${N} samples, ${dur.toFixed(3)}s`);

// --- radix-2 FFT (iterative, real input via complex) ---
const REV = new Uint32Array(FFT);
for (let i = 0; i < FFT; i++) { let r = 0, v = i; for (let b = 0; b < 10; b++) { r = (r << 1) | (v & 1); v >>= 1; } REV[i] = r; }
const COS = new Float32Array(FFT / 2), SIN = new Float32Array(FFT / 2);
for (let i = 0; i < FFT / 2; i++) { COS[i] = Math.cos(-2 * Math.PI * i / FFT); SIN[i] = Math.sin(-2 * Math.PI * i / FFT); }
const HANN = new Float32Array(FFT);
for (let i = 0; i < FFT; i++) HANN[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT - 1)));
function fftMag(re, im, mag) { // in-place radix-2
  for (let i = 0; i < FFT; i++) { const j = REV[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= FFT; len <<= 1) {
    const half = len >> 1, step = FFT / len;
    for (let i = 0; i < FFT; i += len) for (let j = 0, k = 0; j < half; j++, k += step) {
      const wr = COS[k], wi = SIN[k], xr = re[i + j + half] * wr - im[i + j + half] * wi, xi = re[i + j + half] * wi + im[i + j + half] * wr;
      re[i + j + half] = re[i + j] - xr; im[i + j + half] = im[i + j] - xi;
      re[i + j] += xr; im[i + j] += xi;
    }
  }
  for (let i = 0; i < FFT / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
}

const nFrames = Math.floor((N - FFT) / HOP);
const BINS = FFT / 2, HZ = SR / FFT;
const BANDS = [[20, 250], [250, 1000], [1000, 4000], [4000, 11025]];
const bIdx = BANDS.map(([a, b]) => [Math.max(1, Math.round(a / HZ)), Math.min(BINS - 1, Math.round(b / HZ))]);
const rms = new Float32Array(nFrames), flux = new Float32Array(nFrames);
const bandE = BANDS.map(() => new Float32Array(nFrames));
let prev = new Float32Array(BINS);
const re = new Float32Array(FFT), im = new Float32Array(FFT), mag = new Float32Array(BINS);
for (let f = 0; f < nFrames; f++) {
  const off = f * HOP;
  let s = 0;
  for (let i = 0; i < FFT; i++) { const v = x[off + i] * HANN[i]; re[i] = v; im[i] = 0; s += v * v; }
  rms[f] = Math.sqrt(s / FFT);
  fftMag(re, im, mag);
  let fl = 0;
  for (let b = 0; b < BINS; b++) { const d = mag[b] - prev[b]; if (d > 0) fl += d; prev[b] = mag[b]; }
  flux[f] = fl;
  for (let k = 0; k < 4; k++) { let e = 0; for (let b = bIdx[k][0]; b <= bIdx[k][1]; b++) e += mag[b] * mag[b]; bandE[k][f] = Math.sqrt(e / (bIdx[k][1] - bIdx[k][0] + 1)); }
}
const RATE = SR / HOP; // 100 Hz analysis rate
console.error(`frames ${nFrames} @ ${RATE}Hz`);

// --- smooth helper ---
function smooth(a, win) { const o = new Float32Array(a.length), h = win >> 1; let acc = 0; const q = [];
  for (let i = 0; i < a.length; i++) { q.push(a[i]); acc += a[i]; if (q.length > win) acc -= q.shift(); o[i] = acc / q.length; } return o; }

// --- BPM via autocorrelation of flux ---
const fs_ = smooth(flux, 3);
let peak = 0; for (const v of fs_) peak = Math.max(peak, v);
const fn = new Float32Array(fs_.length); for (let i = 0; i < fs_.length; i++) fn[i] = fs_[i] / (peak || 1);
const MINLAG = Math.round(RATE * 60 / 200), MAXLAG = Math.round(RATE * 60 / 55);
const ac = new Float32Array(MAXLAG + 1);
for (let lag = MINLAG; lag <= MAXLAG; lag++) { let s = 0; for (let i = 0; i + lag < fn.length; i += 1) s += fn[i] * fn[i + lag]; ac[lag] = s / (fn.length - lag); }
// top peaks
const cands = [];
for (let lag = MINLAG + 1; lag < MAXLAG; lag++) if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) cands.push([lag, ac[lag]]);
cands.sort((a, b) => b[1] - a[1]);
const bpmOf = lag => 60 * RATE / lag;
console.error('top autocorr peaks: ' + cands.slice(0, 6).map(([l, v]) => `${bpmOf(l).toFixed(2)}bpm(${v.toFixed(3)})`).join(' '));
const best = cands[0][0];
const BPM_RAW = bpmOf(best);
// refine lag with parabola
const l0 = ac[best - 1], l1 = ac[best], l2 = ac[best + 1];
const denom = (l0 - 2 * l1 + l2);
const dlag = denom ? 0.5 * (l0 - l2) / denom : 0;
const LAG = best + dlag;
const BPM = 60 * RATE / LAG;
// snap to nearest 0.5
const BPMs = Math.round(BPM * 2) / 2;

// --- beat phase ---
const period = RATE * 60 / BPMs;
const fluxW = new Float32Array(fn.length); // weighted (soft max) for phase scoring
for (let i = 0; i < fn.length; i++) fluxW[i] = Math.pow(fn[i], 2);
let bestPhase = 0, bestScore = -1;
for (let p = 0; p < Math.round(period); p += 0.25) {
  let s = 0;
  for (let b = p; b < fn.length; b += period) { const i = Math.round(b); s += (fluxW[i] || 0) + 0.5 * (fluxW[i - 1] || 0) + 0.5 * (fluxW[i + 1] || 0); }
  if (s > bestScore) { bestScore = s; bestPhase = p; }
}
const beat0 = bestPhase / RATE;
console.error(`BPM raw=${BPM.toFixed(3)} snapped=${BPMs}  beat0=${beat0.toFixed(3)}s`);
// half/double sanity
const alt = [[BPMs / 2, beat0], [BPMs * 2 % 300, beat0]];

// --- LRC parse + offset alignment ---
const lrcJson = JSON.parse(fs.readFileSync(path.join(DIR, 'netease_lyric.json'), 'utf8'));
const lrcRaw = lrcJson.lyric?.lrc?.lyric || '';
const cues = [];
for (const line of lrcRaw.split('\n')) {
  const m = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
  if (m) cues.push({ t: (+m[1]) * 60 + (+m[2]), text: m[3].trim() });
}
cues.sort((a, b) => a.t - b.t);
// LRC onset density signal
const sigL = new Float32Array(Math.ceil(dur * RATE));
for (const c of cues) if (c.text && c.t < dur) sigL[Math.round(c.t * RATE)] = 1;
const sigLs = smooth(sigL, 30);
let bestOff = 0, bestC = -2;
for (let offMs = -4000; offMs <= 4000; offMs += 10) {
  const off = offMs / 1000; let s = 0, cnt = 0;
  for (let t = 5; t < dur - 5; t += 0.1) { const i = Math.round(t * RATE), j = Math.round((t + off) * RATE); if (j >= 0 && j < fn.length) { s += sigLs[i] * fn[j]; cnt++; } }
  s /= cnt || 1;
  if (s > bestC) { bestC = s; bestOff = off; }
}
console.error(`LRC offset = ${bestOff.toFixed(2)}s (corr ${bestC.toFixed(4)}), cues=${cues.filter(c => c.text).length}`);

// --- 60Hz envelopes (per video frame), song-aligned (audio starts at MV t=0) ---
const F60 = Math.ceil(dur * 60);
const env = { bass: new Uint8Array(F60), low: new Uint8Array(F60), mid: new Uint8Array(F60), high: new Uint8Array(F60), flux: new Uint8Array(F60), rms: new Uint8Array(F60) };
const mx = [0, 0, 0, 0, 0, 0];
const src = [bandE[0], bandE[1], bandE[2], bandE[3], fs_, rms];
for (let k = 0; k < 6; k++) for (const v of src[k]) mx[k] = Math.max(mx[k], v);
for (let f = 0; f < F60; f++) {
  const i0 = Math.floor(f * RATE / 60), i1 = Math.min(nFrames, Math.ceil((f + 1) * RATE / 60));
  for (let k = 0; k < 6; k++) { let s = 0; for (let i = i0; i < i1; i++) s += src[k][i]; const v = (i1 > i0 ? s / (i1 - i0) : 0) / mx[k]; env[k === 0 ? 'bass' : k === 1 ? 'low' : k === 2 ? 'mid' : k === 3 ? 'high' : k === 4 ? 'flux' : 'rms'][f] = Math.round(Math.min(1, v) * 255); }
}
// peak-normalized loudness per 2s for the report
const rmsMax = mx[5];
let rep = `DURATION: ${dur.toFixed(3)} s\nBPM: ${BPM.toFixed(3)} (snapped ${BPMs})\nBEAT0: ${beat0.toFixed(3)} s (period ${(60 / BPMs).toFixed(4)}s)\nLRC_OFFSET: ${bestOff.toFixed(2)} s (netease timeline -> local audio)\nPEAK_RMS: ${rmsMax.toFixed(4)}\n`;
rep += 'ENERGY(2s/char, rms/peak: "."=<5% "-"=<15% "#"=rest):\n';
const chars = [];
for (let t = 0; t < dur; t += 2) {
  const i0 = Math.round(t * RATE), i1 = Math.min(nFrames, Math.round((t + 2) * RATE));
  let s = 0; for (let i = i0; i < i1; i++) s += rms[i]; const e = (i1 > i0 ? s / (i1 - i0) : 0) / rmsMax;
  chars.push(e < 0.05 ? '.' : e < 0.15 ? '-' : '#');
}
for (let i = 0; i < chars.length; i += 78) rep += String(Math.round(i * 2 / 60)).padStart(3) + 'm|' + chars.slice(i, i + 78).join('') + '\n';
fs.writeFileSync(path.join(DIR, 'report.txt'), rep);
console.error(rep);

// --- save ---
const out = { duration: dur, bpm: +BPM.toFixed(3), bpm_snapped: BPMs, beat0: +beat0.toFixed(3), lrc_offset: +bestOff.toFixed(2), analysis_rate: RATE, env60: env, bpm_candidates: cands.slice(0, 6).map(([l, v]) => ({ bpm: +bpmOf(l).toFixed(2), score: +v.toFixed(3) })) };
fs.writeFileSync(path.join(DIR, 'analysis.json'), JSON.stringify(out));
console.log('SAVED analysis.json  BPM=' + BPMs + ' beat0=' + beat0.toFixed(3) + ' lrc_off=' + bestOff.toFixed(2));
