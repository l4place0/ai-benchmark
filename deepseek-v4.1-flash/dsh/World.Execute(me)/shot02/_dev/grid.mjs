// grid.mjs — refine the musical grid from the baked onset curve and validate
// the section lattice against measured audio change points.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/analysis.json'), 'utf8'));
const FPS = A.fps;
const dec = (n) => { const b = Buffer.from(A.curves[n], 'base64'); const u = new Uint16Array(b.buffer, b.byteOffset, b.length / 2); const o = new Float32Array(u.length); for (let i = 0; i < u.length; i++) o[i] = u[i] / 65535; return o; };
const onset = dec('onset');
const rms = dec('rms');
const N = A.frames;

// ---- comb search over (period frames, phase frames) maximising onset energy on
// the beat lattice, with downbeats (every 4th) weighted extra.
let best = { score: -1 };
for (let bpm = 118; bpm <= 142; bpm += 0.01) {
  const period = (60 / bpm) * FPS;
  if (period < 8) continue;
  for (let ph = 0; ph < period; ph += 0.25) {
    let s = 0, k = 0;
    for (let t = ph; t < N; t += period, k++) {
      const i = Math.round(t);
      if (i >= N) break;
      // small window max so tiny phase errors don't kill the score
      const v = Math.max(onset[i], onset[i - 1] || 0, onset[i + 1] || 0);
      s += v * (k % 4 === 0 ? 2.2 : 1.0);
    }
    if (s > best.score) best = { score: s, bpm, period, phase: ph };
  }
}
console.log(`comb best: ${best.bpm.toFixed(2)} BPM  beat=${(best.period / FPS).toFixed(4)}s  phase=${(best.phase / FPS).toFixed(3)}s`);

// ---- first / last audible sample
let first = 0, last = N - 1;
for (let i = 0; i < N; i++) if (rms[i] > 0.02) { first = i; break; }
for (let i = N - 1; i >= 0; i--) if (rms[i] > 0.02) { last = i; break; }
console.log(`audible: ${(first / FPS).toFixed(3)}s .. ${(last / FPS).toFixed(3)}s  (duration ${A.duration}s)`);

// ---- strongest onset frames (transient starts) in the first 40 s, to check the
// downbeat phase independently of the section lattice
const peaks = [];
for (let i = 1; i < N - 1; i++) {
  if (onset[i] > 0.28 && onset[i] >= onset[i - 1] && onset[i] > onset[i + 1]) peaks.push({ t: i / FPS, v: onset[i] });
}
console.log('\nfirst 26 transients:');
console.log(peaks.slice(0, 26).map((p) => `${p.t.toFixed(2)}(${p.v.toFixed(2)})`).join('  '));

// ---- validate the 8-bar lattice: for each lattice point, report the strongest
// onset within +/- 1.2 s so we can see whether the lattice sits on the music.
const BLOCK = best.period * 4;                 // 8 bars = 4 * (2 beats)? no: period is one beat
const sec8 = best.period * 32;                 // one 8-bar block at 4/4 = 32 beats
const phase8 = best.phase;
console.log(`\n8-bar block = ${(sec8 / FPS).toFixed(3)} s   (bar = ${(best.period * 4 / FPS).toFixed(3)} s)`);
console.log('\n n     lattice    nearest onset   delta   onset-strength');
for (let n = 0; n <= Math.ceil(A.duration / (sec8 / FPS)); n++) {
  const t = (phase8 + n * sec8) / FPS;
  if (t > A.duration) break;
  let bi = -1, bv = -1;
  for (let i = Math.max(0, Math.round((t - 1.2) * FPS)); i < Math.min(N, Math.round((t + 1.2) * FPS)); i++) {
    if (onset[i] > bv) { bv = onset[i]; bi = i; }
  }
  console.log(`${String(n).padStart(3)}  ${t.toFixed(3).padStart(9)}  ${(bi / FPS).toFixed(3).padStart(12)}  ${((bi / FPS) - t).toFixed(3).padStart(7)}   ${bv.toFixed(3)}`);
}
console.log('\nbaked tempo was', A.tempo.bpm, 'BPM; novelty boundaries:', A.sections.map((s) => s.t.toFixed(2)).join(' '));
