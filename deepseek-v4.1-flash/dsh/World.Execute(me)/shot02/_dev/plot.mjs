// plot.mjs — tiny dependency-free PNG plotter for the analysis curves.
// usage: node _dev/plot.mjs --out=_dev/tmp/curves.png [--from=0] [--to=212]
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
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/analysis.json'), 'utf8'));
const FPS = A.fps;
const from = Number(arg('from', 0)), to = Number(arg('to', A.duration));
const f0 = Math.floor(from * FPS), f1 = Math.min(A.frames, Math.ceil(to * FPS));
const N = f1 - f0;

const W = 1920, H = 900;
const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < img.length; i += 3) { img[i] = 8; img[i + 1] = 9; img[i + 2] = 14; }
const px = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 3; img[o] = r; img[o + 1] = g; img[o + 2] = b; };
const vline = (x, r, g, b) => { for (let y = 0; y < H; y++) px(x, y, r, g, b); };
const hline = (y, r, g, b) => { for (let x = 0; x < W; x++) px(x, y, r, g, b); };

function decode(name) {
  const b = Buffer.from(A.curves[name], 'base64');
  const u = new Uint16Array(b.buffer, b.byteOffset, b.length / 2);
  const out = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) out[i] = u[i] / 65535;
  return out;
}

// lanes
const lanes = [
  { key: 'rms', color: [255, 255, 255], label: 'rms' },
  { key: 'sub', color: [255, 90, 140], label: 'sub' },
  { key: 'bass', color: [255, 140, 60], label: 'bass' },
  { key: 'lowMid', color: [230, 220, 90], label: 'lowMid' },
  { key: 'mid', color: [110, 230, 120], label: 'mid' },
  { key: 'highMid', color: [80, 200, 255], label: 'highMid' },
  { key: 'high', color: [140, 120, 255], label: 'high' },
  { key: 'air', color: [220, 130, 255], label: 'air' },
  { key: 'onset', color: [255, 60, 60], label: 'onset' },
  { key: 'novelty', color: [255, 235, 130], label: 'novelty' },
];

const laneH = Math.floor(H / lanes.length);
const data = {};
for (const l of lanes) data[l.key] = decode(l.key);

// second ticks
for (let s = Math.ceil(from); s <= to; s += 5) {
  const x = Math.round(((s - from) / (to - from)) * (W - 1));
  const major = s % 10 === 0;
  const c = major ? [70, 78, 96] : [38, 42, 54];
  for (let y = 0; y < H; y += major ? 1 : 2) px(x, y, c[0], c[1], c[2]);
}
// bar grid (every 4 beats)
for (let i = 0; i < A.tempo.beats.length; i += 4) {
  const t = A.tempo.beats[i] / FPS;
  if (t < from || t > to) continue;
  const x = Math.round(((t - from) / (to - from)) * (W - 1));
  for (let y = 0; y < H; y += 3) px(x, y, 46, 56, 78);
}
// detected section boundaries
for (const s of A.sections) {
  if (s.t < from || s.t > to) continue;
  const x = Math.round(((s.t - from) / (to - from)) * (W - 1));
  vline(x, 0, 255, 200);
}

for (let i = 0; i < lanes.length; i++) {
  const y0 = i * laneH, y1 = y0 + laneH - 1;
  hline(y1, 30, 34, 44);
  const arr = data[lanes[i].key];
  const [r, g, b] = lanes[i].color;
  // autoscale over the visible window (2%..98% quantiles), dB-ish for bands
  const sample = [];
  for (let x = 0; x < W; x += 3) {
    const f = f0 + Math.floor((x / (W - 1)) * (N - 1));
    if (f >= f0 && f < f1) sample.push(arr[f] || 0);
  }
  sample.sort((p, q) => p - q);
  const qq = (p) => sample.length ? sample[Math.min(sample.length - 1, Math.max(0, Math.floor(p * (sample.length - 1))))] : 0;
  let lo = qq(0.02), hi = qq(0.995);
  if (hi - lo < 1e-6) { hi = lo + 1e-6; }
  const map = (v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  let prevY = null;
  for (let x = 0; x < W; x++) {
    const f = f0 + Math.floor((x / (W - 1)) * (N - 1));
    const v = map(arr[f] || 0);
    const yy = y1 - Math.round(v * (laneH - 3));
    if (prevY !== null) {
      const a = Math.min(prevY, yy), z = Math.max(prevY, yy);
      for (let y = a; y <= z; y++) { px(x, y, r, g, b); if (y === yy) px(x, y, 255, 255, 255); }
    } else px(x, yy, r, g, b);
    prevY = yy;
  }
  // lane label marks: 0%, 50%, 100% of the autoscaled range
  for (const q of [0, 0.5, 1]) {
    const y = y1 - Math.round(q * (laneH - 3));
    for (let x = 0; x < 6; x++) px(x, y, r, g, b);
  }
}

writePNG(path.resolve(ROOT, arg('out', '_dev/tmp/curves.png')), W, H, img);
console.log('wrote', arg('out', '_dev/tmp/curves.png'), 'lanes:', lanes.map((l) => l.label).join(','));
