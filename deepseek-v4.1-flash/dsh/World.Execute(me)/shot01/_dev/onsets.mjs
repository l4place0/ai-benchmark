// onsets.mjs — high-resolution onset peaks in the vocal formant range,
// used to locate lyric-line entries. usage: node onsets.mjs <t0> <t1>
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 22050, RES = 100;                       // 100 envelope frames / second
const t0 = Number(process.argv[2] ?? 0), t1 = Number(process.argv[3] ?? 30);
const usable = (p) => { try { return statSync(p).size > 1_000_000; } catch { return false; } };
const flac = join(HERE, 'audio', 'world.execute(me).flac');
const SRC = usable(flac) ? flac : join(HERE, 'audio', 'world.execute(me).mp3');

const pcm = await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', SRC, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const b = []; p.stdout.on('data', d => b.push(d));
  p.on('exit', c => c === 0 ? res(Buffer.concat(b)) : rej(new Error('ffmpeg ' + c)));
});
const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
const dur = x.length / SR;
const N = Math.floor(dur * RES);

// vocal formant band: 250..1600 Hz (one-pole high-pass minus low-pass)
const aLo = Math.exp(-2 * Math.PI * 250 / SR);
const aHi = Math.exp(-2 * Math.PI * 1600 / SR);
const aEnv = Math.exp(-1 / (0.012 * SR));
const stepN = Math.round(SR / RES);
const env = new Float32Array(N);
let yLo = 0, yHi = 0, e = 0;
for (let f = 0; f < N; f++) {
  const s0 = f * stepN, s1 = Math.min(x.length, s0 + stepN);
  let peak = 0;
  for (let i = s0; i < s1; i++) {
    yLo = yLo * aLo + (1 - aLo) * x[i];
    yHi = yHi * aHi + (1 - aHi) * x[i];
    e = e * aEnv + (1 - aEnv) * Math.abs(yHi - yLo);
    if (e > peak) peak = e;
  }
  env[f] = peak;
}
// spectral-flux style onset: positive difference of a log-ish envelope
const on = new Float32Array(N);
for (let f = 2; f < N; f++) on[f] = Math.max(0, Math.log(1 + env[f] * 400) - Math.log(1 + env[f - 2] * 400));

const i0 = Math.max(0, Math.floor(t0 * RES)), i1 = Math.min(N, Math.floor(t1 * RES));
const peaks = [];
for (let f = i0 + 3; f < i1 - 3; f++) {
  const w = on[f];
  let isMax = true;
  for (let k = -3; k <= 3; k++) if (k && on[f + k] > w) { isMax = false; break; }
  if (isMax && w > 0.09) peaks.push([f / RES, w]);
}
peaks.sort((a, b) => b[1] - a[1]);
const top = peaks.slice(0, 60).sort((a, b) => a[0] - b[0]);
console.log(`=== onsets in ${t0}..${t1}s (top ${top.length}) ===`);
for (const [t, w] of top) console.log(`  ${t.toFixed(2).padStart(8)}  ${w.toFixed(3)}`);

// ASCII envelope, 1 char = 0.05 s
console.log(`\n=== envelope 1 char = 0.05 s (${t0}..${t1}s) ===`);
const ramp = ' .:-=+*#%@';
let mx = 0; for (let f = i0; f < i1; f++) mx = Math.max(mx, env[f]);
for (let f = i0; f < i1; f += 100) {
  let s = '';
  for (let k = f; k < Math.min(i1, f + 100); k++) s += ramp[Math.min(9, Math.floor(env[k] / (mx * 0.55) * 9))];
  console.log(`${(f / RES).toFixed(1).padStart(6)}s ${s}`);
}
