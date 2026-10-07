// vocal.mjs — vocal presence via mid/side energy difference.
// Centre-panned lead vocal => mid (L+R) energy dominates when singing.
// Prints a readable timeline and the detected vocal phrases.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 22050, RES = 20;                  // 20 frames / second
const usable = (p) => { try { return statSync(p).size > 1_000_000; } catch { return false; } };
const flac = join(HERE, 'audio', 'world.execute(me).flac');
const SRC = usable(flac) ? flac : join(HERE, 'audio', 'world.execute(me).mp3');

const pcm = await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', SRC, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const b = []; p.stdout.on('data', d => b.push(d));
  p.on('exit', c => c === 0 ? res(Buffer.concat(b)) : rej(new Error('ffmpeg ' + c)));
});
const n = Math.floor(pcm.length / 8);
const L = new Float32Array(n), R = new Float32Array(n);
for (let i = 0; i < n; i++) { L[i] = pcm.readFloatLE(i * 8); R[i] = pcm.readFloatLE(i * 8 + 4); }
const dur = n / SR;
console.log(`${dur.toFixed(2)} s stereo`);

// band-limit both mid and side to the vocal formant range
const aLo = Math.exp(-2 * Math.PI * 280 / SR), aHi = Math.exp(-2 * Math.PI * 2000 / SR);
const aEnv = Math.exp(-1 / (0.025 * SR));
const stepN = Math.round(SR / RES), N = Math.floor(dur * RES);
const midE = new Float32Array(N), sideE = new Float32Array(N);
let mLo = 0, mHi = 0, sLo = 0, sHi = 0, mE = 0, sE = 0;
for (let f = 0; f < N; f++) {
  const s0 = f * stepN, s1 = Math.min(n, s0 + stepN);
  let mp = 0, sp = 0;
  for (let i = s0; i < s1; i++) {
    const m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5;
    mLo = mLo * aLo + (1 - aLo) * m; mHi = mHi * aHi + (1 - aHi) * m;
    sLo = sLo * aLo + (1 - aLo) * s; sHi = sHi * aHi + (1 - aHi) * s;
    mE = mE * aEnv + (1 - aEnv) * Math.abs(mHi - mLo);
    sE = sE * aEnv + (1 - aEnv) * Math.abs(sHi - sLo);
    if (mE > mp) mp = mE;
    if (sE > sp) sp = sE;
  }
  midE[f] = mp; sideE[f] = sp;
}
// vocal-likeness: mid energy above what the side channel predicts
const lik = new Float32Array(N);
for (let f = 0; f < N; f++) {
  const m = midE[f], s = sideE[f];
  lik[f] = Math.max(0, m - 1.35 * s) / (m + s + 1e-7);
}
// smooth
const sm = new Float32Array(N);
for (let f = 0; f < N; f++) {
  let a = 0, c = 0;
  for (let k = -3; k <= 3; k++) { const j = f + k; if (j >= 0 && j < N) { a += lik[j]; c++; } }
  sm[f] = a / c;
}

const ramp = ' .:-=+*#%@';
console.log('=== vocal presence (mid/side), 1 char = 0.05 s ===');
for (let f = 0; f < N; f += 100) {
  let s = '';
  for (let k = f; k < Math.min(N, f + 100); k++) s += ramp[Math.min(9, Math.floor(sm[k] * 10))];
  console.log(`${(f / RES).toFixed(1).padStart(6)}s ${s}`);
}

// phrase detection
const ON = 0.30, OFF = 0.18;
const phrases = [];
let inP = false, st = 0, q = 0;
for (let f = 0; f < N; f++) {
  if (!inP) { if (sm[f] > ON) { inP = true; st = f; q = 0; } }
  else {
    if (sm[f] < OFF) { q++; if (q > RES * 0.35) { inP = false; const en = f - q; if (en - st > RES * 0.25) phrases.push([st / RES, en / RES]); } }
    else q = 0;
  }
}
if (inP) phrases.push([st / RES, N / RES]);
console.log(`\n=== ${phrases.length} vocal phrases ===`);
for (const [a, b] of phrases) console.log(`  ${a.toFixed(2).padStart(7)} - ${b.toFixed(2).padStart(7)}  (${(b - a).toFixed(2)}s)`);
