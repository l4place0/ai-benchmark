// phrases.mjs — vocal-band energy timeline + phrase segmentation.
// Prints an ASCII envelope (1 char = 0.25 s) so phrase onsets can be read off.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 22050, RES = 4;              // 4 envelope frames per second
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
const frames = Math.floor(dur * RES);

// band-pass 300..3000 Hz using two one-pole low-passes, then envelope
const fcLo = 300, fcHi = 3000;
const aLo = Math.exp(-2 * Math.PI * fcLo / SR), aHi = Math.exp(-2 * Math.PI * fcHi / SR);
const aEnv = Math.exp(-1 / (0.020 * SR));
const step = Math.round(SR / RES);
const env = new Float32Array(frames);
let yLo = 0, yHi = 0, e = 0;
for (let f = 0; f < frames; f++) {
  const s0 = f * step, s1 = Math.min(x.length, s0 + step);
  let peak = 0;
  for (let i = s0; i < s1; i++) {
    yLo = yLo * aLo + (1 - aLo) * x[i];
    yHi = yHi * aHi + (1 - aHi) * x[i];
    const v = Math.abs(yHi - yLo);
    e = e * aEnv + (1 - aEnv) * v;
    if (e > peak) peak = e;
  }
  env[f] = peak;
}
// normalise by a long-window median-ish reference so quiet and loud parts compare
const ref = new Float32Array(frames);
{
  const W = RES * 4;
  const tmp = [];
  for (let f = 0; f < frames; f++) {
    tmp.length = 0;
    for (let k = -W; k <= W; k++) { const j = f + k; if (j >= 0 && j < frames) tmp.push(env[j]); }
    tmp.sort((a, b) => a - b);
    ref[f] = tmp[Math.floor(tmp.length * 0.75)] || 1e-6;
  }
}
const norm = new Float32Array(frames);
for (let f = 0; f < frames; f++) norm[f] = Math.min(1, env[f] / (ref[f] * 2.2 + 1e-9));

const ramp = ' .:-=+*#%@';
console.log('=== vocal-band envelope (1 char = 0.25 s, 160 chars = 40 s) ===');
for (let f = 0; f < frames; f += 160) {
  let line = '';
  for (let i = f; i < Math.min(frames, f + 160); i++) line += ramp[Math.min(9, Math.floor(norm[i] * 10))];
  const t0 = (f / RES).toFixed(0).padStart(3);
  console.log(`${t0}s ${line}`);
}
console.log('\n=== every 10 s marker ===');
let ruler = '';
for (let s = 0; s * RES < frames; s++) ruler += (s % 10 === 0) ? String(Math.floor(s / 10) % 10) : ' ';
console.log('     ' + ruler);

// ---- phrase segmentation ----
const phrases = [];
let inPhrase = false, start = 0, quiet = 0;
const ON = 0.30, OFF = 0.16, MINLEN = RES * 0.22, MAXGAP = RES * 0.30;
for (let f = 0; f < frames; f++) {
  if (!inPhrase) {
    if (norm[f] > ON) { inPhrase = true; start = f; quiet = 0; }
  } else {
    if (norm[f] < OFF) { quiet++; if (quiet > MAXGAP) { inPhrase = false; const end = f - quiet; if (end - start >= MINLEN) phrases.push([start / RES, end / RES]); } }
    else quiet = 0;
  }
}
if (inPhrase) phrases.push([start / RES, frames / RES]);
console.log(`\n=== ${phrases.length} vocal phrases ===`);
for (const [a, b] of phrases) console.log(`  ${a.toFixed(2).padStart(7)} - ${b.toFixed(2).padStart(7)}   (${(b - a).toFixed(2)}s)`);
