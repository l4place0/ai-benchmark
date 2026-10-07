// tempo.mjs — precise tempo/phase search over a wide BPM range, plus an
// inter-onset-interval histogram of the bass band as an independent check.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 22050, FPS = 60;
const usable = (p) => { try { return statSync(p).size > 1_000_000; } catch { return false; } };
const flac = join(HERE, 'audio', 'world.execute(me).flac');
const SRC = usable(flac) ? flac : join(HERE, 'audio', 'world.execute(me).mp3');
console.log('source: ' + SRC.split(/[\\/]/).pop());

const pcm = await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', SRC, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const b = []; p.stdout.on('data', d => b.push(d));
  p.on('exit', c => c === 0 ? res(Buffer.concat(b)) : rej(new Error('ffmpeg ' + c)));
});
const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
const dur = x.length / SR;
const total = Math.round(dur * FPS);
console.log(`${dur.toFixed(3)} s, ${total} frames`);

// bass-band onset envelope at 60 Hz via a simple 2-pole lowpass + envelope diff
const onset = new Float32Array(total);
{
  const hop = SR / FPS;
  // one-pole filters
  const lp = (fc) => { const a = Math.exp(-2 * Math.PI * fc / SR); return a; };
  const aLow = lp(180), aHigh = lp(3200);
  let yLow = 0, yHigh = 0;
  const env = new Float32Array(total);
  const step = Math.round(hop);
  for (let f = 0; f < total; f++) {
    const s0 = f * step, s1 = Math.min(x.length, s0 + step);
    let peak = 0;
    for (let i = s0; i < s1; i++) {
      yLow = yLow * aLow + (1 - aLow) * x[i];
      yHigh = yHigh * aHigh + (1 - aHigh) * x[i];
      const band = yHigh - yLow;       // ~180..3200 Hz
      const v = Math.abs(band);
      if (v > peak) peak = v;
    }
    env[f] = peak;
  }
  for (let f = 1; f < total; f++) onset[f] = Math.max(0, env[f] - env[f - 1]);
  // local mean removal
  const W = 20;
  const out = new Float32Array(total);
  for (let f = 0; f < total; f++) {
    let s = 0, n = 0;
    for (let k = -W; k <= W; k++) { const j = f + k; if (j >= 0 && j < total) { s += onset[j]; n++; } }
    out[f] = Math.max(0, onset[f] - s / n);
  }
  onset.set(out);
}

const at = (t) => {
  const i = Math.floor(t), fr = t - i;
  if (i < 0 || i + 1 >= total) return 0;
  return onset[i] * (1 - fr) + onset[i + 1] * fr;
};
function score(bpm, phase) {
  const per = 60 / bpm * FPS;
  let s = 0, n = 0;
  for (let t = phase; t < total; t += per) { s += at(t); n++; }
  return n > 20 ? s / n : -1;
}

const results = [];
for (let bpm = 60; bpm <= 200; bpm += 0.1) {
  const per = 60 / bpm * FPS;
  let best = -1, bp = 0;
  for (let k = 0; k < 32; k++) {
    const ph = per * k / 32;
    const sc = score(bpm, ph);
    if (sc > best) { best = sc; bp = ph; }
  }
  results.push({ bpm, phase: bp, score: best });
}
results.sort((a, b) => b.score - a.score);
console.log('\n=== top tempo candidates (wide search) ===');
const seen = [];
for (const r of results) {
  if (seen.some(s => Math.abs(s - r.bpm) < 3)) continue;
  seen.push(r.bpm);
  console.log(`  ${r.bpm.toFixed(2)} BPM  phase=${(r.phase / FPS).toFixed(4)}s  score=${r.score.toFixed(5)}`);
  if (seen.length >= 8) break;
}

// refine the best
let best = results[0];
for (const step of [0.01, 0.002, 0.0005]) {
  const c = best.bpm;
  let bb = best, bs = best.score;
  for (let bpm = c - 0.6; bpm <= c + 0.6; bpm += step) {
    const per = 60 / bpm * FPS;
    for (let k = 0; k < 64; k++) {
      const ph = per * k / 64;
      const sc = score(bpm, ph);
      if (sc > bs) { bs = sc; bb = { bpm, phase: ph, score: sc }; }
    }
  }
  best = bb;
}
console.log(`\n=== refined ===\n  ${best.bpm.toFixed(4)} BPM  phase=${(best.phase / FPS).toFixed(4)}s  score=${best.score.toFixed(5)}`);
console.log(`  beat = ${(60 / best.bpm).toFixed(4)} s   bar(4/4) = ${(240 / best.bpm).toFixed(4)} s`);

for (const mult of [0.5, 2]) {
  console.log(`  x${mult}: ${(best.bpm * mult).toFixed(3)} BPM -> bar ${(240 / (best.bpm * mult)).toFixed(3)} s`);
}
