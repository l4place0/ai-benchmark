// motion.mjs — sanity-check that the picture actually moves everywhere.
//
// Measures the mean absolute frame-to-frame luma difference with ffmpeg's
// tblend/signalstats, then reports any run of near-identical frames (a stall)
// and the motion profile across the song's blocks.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T0, BLOCK, BLOCKS } from '../js/audio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const FILE = path.resolve(ROOT, opt('file', 'out/world.execute(me)_MV_1080p60.mp4'));
const FROM = Number(opt('from', '0'));
const TO = Number(opt('to', '212.3'));

const args = [
  '-hide_banner', '-v', 'info',
  '-ss', String(FROM), '-t', String(TO - FROM), '-i', FILE,
  '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG',
  '-an', '-f', 'null', '-',
];

const vals = [];
await new Promise((res) => {
  const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let buf = '';
  p.stderr.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) {
      const m = l.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
      if (m) vals.push(Number(m[1]));
    }
  });
  p.on('exit', res);
});

if (!vals.length) { console.error('no stats produced'); process.exit(1); }

const fps = 60;
const at = (i) => FROM + (i + 1) / fps;
let stalls = 0, longest = 0, cur = 0, curStart = 0;
const runs = [];
for (let i = 0; i < vals.length; i++) {
  if (vals[i] < 0.08) {
    if (cur === 0) curStart = i;
    cur++; stalls++; longest = Math.max(longest, cur);
  } else if (cur) { runs.push([curStart, cur]); cur = 0; }
}
if (cur) runs.push([curStart, cur]);
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
const min = Math.min(...vals);
const max = Math.max(...vals);

console.log(`file      ${path.relative(ROOT, FILE)}`);
console.log(`window    ${FROM}..${TO} s   frames analysed ${vals.length}`);
console.log(`motion    mean ${mean.toFixed(3)}  min ${min.toFixed(3)}  max ${max.toFixed(3)}  (mean |Δluma| per frame)`);
console.log(`stalls    ${stalls} frames below 0.08, longest run ${longest}  ${longest > 4 ? '<-- SUSPICIOUS' : '(none)'}`);
if (runs.length) {
  console.log('          runs: ' + runs.slice(0, 12).map(([s, n]) => `${at(s).toFixed(2)}s x${n}`).join('  '));
}

// per-block motion profile
console.log('\nblock  time            mean motion   character');
for (let n = 0; n < 14; n++) {
  const a = T0 + n * BLOCK, b = a + BLOCK;
  const ia = Math.max(0, Math.round((a - FROM) * fps) - 1);
  const ib = Math.min(vals.length, Math.round((b - FROM) * fps) - 1);
  if (ib <= ia) continue;
  const slice = vals.slice(ia, ib);
  const m = slice.reduce((x, y) => x + y, 0) / slice.length;
  const bar = '#'.repeat(Math.min(46, Math.round(m * 26)));
  console.log(`${String(n).padStart(5)}  ${(a).toFixed(1).padStart(6)}-${(b).toFixed(1).padStart(6)}  ${m.toFixed(3).padStart(11)}   ${bar}  ${BLOCKS[n].id}`);
}
