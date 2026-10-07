// ssm.mjs — self-similarity matrix of the baked features, rendered as a PNG.
// Repeating musical sections show up as bright off-diagonal blocks, which lets
// us read the song's form directly off the picture.
// usage: node _dev/ssm.mjs [--step=8] [--out=_dev/tmp/ssm.png]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const h = argv.find((a) => a.startsWith('--' + k + '=')); return h ? h.slice(k.length + 3) : d; };

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) { table = crc32.t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; } }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/analysis.json'), 'utf8'));
const FPS = A.fps;
const names = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'high', 'air', 'rms', 'onset'];
const dec = (n) => { const b = Buffer.from(A.curves[n], 'base64'); const u = new Uint16Array(b.buffer, b.byteOffset, b.length / 2); const o = new Float32Array(u.length); for (let i = 0; i < u.length; i++) o[i] = u[i] / 65535; return o; };
const F = names.map(dec);

const STEP = Number(arg('step', 8));            // frames per cell (~0.133 s)
const cells = Math.floor(A.frames / STEP);
const D = names.length;
const feat = new Float32Array(cells * D);
for (let c = 0; c < cells; c++) {
  for (let d = 0; d < D; d++) {
    let s = 0;
    for (let i = 0; i < STEP; i++) s += F[d][c * STEP + i];
    feat[c * D + d] = s / STEP;
  }
}
// z-score each dimension so no single band dominates
for (let d = 0; d < D; d++) {
  let m = 0;
  for (let c = 0; c < cells; c++) m += feat[c * D + d];
  m /= cells;
  let v = 0;
  for (let c = 0; c < cells; c++) v += (feat[c * D + d] - m) ** 2;
  const sd = Math.sqrt(v / cells) || 1;
  for (let c = 0; c < cells; c++) feat[c * D + d] = (feat[c * D + d] - m) / sd;
}
// cosine similarity on the z-scored vectors
const norm = new Float32Array(cells);
for (let c = 0; c < cells; c++) { let s = 0; for (let d = 0; d < D; d++) s += feat[c * D + d] ** 2; norm[c] = Math.sqrt(s) || 1; }

const S = Math.min(760, cells);
const img = Buffer.alloc(S * S * 3);
for (let y = 0; y < S; y++) {
  const cy = Math.floor((y / S) * cells);
  for (let x = 0; x < S; x++) {
    const cx = Math.floor((x / S) * cells);
    let s = 0;
    for (let d = 0; d < D; d++) s += feat[cy * D + d] * feat[cx * D + d];
    const v = s / (norm[cy] * norm[cx]);
    // map -0.5..1 -> 0..1
    const u = Math.max(0, Math.min(1, (v + 0.4) / 1.4));
    const o = (y * S + x) * 3;
    // magma-ish ramp
    const r = Math.round(255 * Math.min(1, Math.max(0, u * 1.9 - 0.35)));
    const g = Math.round(255 * Math.min(1, Math.max(0, u * 1.5 - 0.55)));
    const b = Math.round(255 * Math.min(1, Math.max(0, u * 2.4 - 1.55)));
    img[o] = r; img[o + 1] = g; img[o + 2] = b;
  }
}
// tick marks every 10 s on both axes
for (let t = 0; t <= A.duration; t += 10) {
  const p = Math.round((t / A.duration) * (S - 1));
  const col = t % 30 === 0 ? [0, 255, 160] : [90, 110, 140];
  for (let i = 0; i < S; i++) { let o = (p * S + i) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; o = (i * S + p) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; }
}
const OUT = path.resolve(ROOT, arg('out', '_dev/tmp/ssm.png'));
fs.writeFileSync(OUT, Buffer.alloc(0));
{
  const W = S, H = S;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(OUT, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}
console.log('wrote', path.relative(ROOT, OUT), S + 'x' + S, 'cells', cells, '(step', STEP, 'frames =', (STEP / FPS).toFixed(3), 's)');
