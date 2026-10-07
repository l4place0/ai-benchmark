// Particle target shapes. Every shape = { pos: Float32Array(N*3), col: Float32Array(N*3) }
import { mulberry32 } from './timeline.js';

export const N = 65536;
const TAU = Math.PI * 2;

function alloc() { return { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
function hexRGB(h) { return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }

export async function loadImage(url) { const im = new Image(); im.src = url; await im.decode(); return im; }

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- image based sampling ----------
// mode: 'lum' (weight by luminance^pow), 'alpha' (weight by alpha), returns shape
function sampleRaster(data, blur, W, H, opt, seed) {
  const r = mulberry32(seed);
  const s = alloc();
  const weights = new Float32Array(W * H);
  let total = 0;
  for (let i = 0; i < W * H; i++) {
    const R = data[i * 4], G = data[i * 4 + 1], B = data[i * 4 + 2], A = data[i * 4 + 3];
    let w;
    if (opt.mode === 'alpha') w = A > 40 ? 1 : 0;
    else { const l = (0.3 * R + 0.59 * G + 0.11 * B) / 255; w = l > (opt.thresh ?? 0.12) ? Math.pow(l, opt.pow ?? 2) : 0; }
    total += w; weights[i] = total;
  }
  const scale = opt.height / H;
  const tint = opt.tint ? hexRGB(opt.tint) : null;
  for (let n = 0; n < N; n++) {
    const target = r() * total;
    let lo = 0, hi = W * H - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (weights[m] < target) lo = m + 1; else hi = m; }
    const px = lo % W, py = (lo / W) | 0;
    const x = (px + r() - W / 2) * scale + (opt.ox || 0);
    const y = -(py + r() - H / 2) * scale + (opt.oy || 0);
    const R = data[lo * 4] / 255, G = data[lo * 4 + 1] / 255, B = data[lo * 4 + 2] / 255;
    const l = 0.3 * R + 0.59 * G + 0.11 * B;
    let z;
    if (blur) { const b = blur[lo * 4 + 3] / 255; z = (r() < 0.5 ? -1 : 1) * Math.sqrt(b) * (opt.depth || 1); }
    else z = (l - 0.5) * (opt.depth || 0.5) + (r() - 0.5) * (opt.jitterZ || 0.25);
    s.pos.set([x, y, z], n * 3);
    if (tint) s.col.set([tint[0] * (0.35 + l), tint[1] * (0.35 + l), tint[2] * (0.35 + l)], n * 3);
    else s.col.set([R, G, B], n * 3);
  }
  return s;
}

export async function imageShape(url, opt, seed = 1) {
  const img = await loadImage(url);
  const W = opt.res || 420, H = Math.round(W * img.height / img.width);
  const c = canvasOf(W, H), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data;
  return sampleRaster(data, null, W, H, opt, seed);
}

// SVG emoji -> puffy 3D shape (z from blurred alpha)
export async function svgShape(url, opt, seed = 2) {
  const img = await loadImage(url);
  const W = 400, H = 400;
  const c = canvasOf(W, H), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 20, 20, W - 40, H - 40);
  const data = g.getImageData(0, 0, W, H).data;
  // eroded/blurred alpha for depth
  const c2 = canvasOf(W, H), g2 = c2.getContext('2d', { willReadFrequently: true });
  g2.filter = 'blur(18px)'; g2.drawImage(c, 0, 0);
  // multiply by original alpha to keep edges at 0 depth-ish
  const blur = g2.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) { const a = data[i * 4 + 3] / 255; blur[i * 4 + 3] = Math.max(0, (blur[i * 4 + 3] / 255 - 0.35) / 0.65) * 255 * a; }
  return sampleRaster(data, blur, W, H, { mode: 'alpha', ...opt }, seed);
}

// text -> flat shape
export function textShape(text, opt = {}, seed = 3) {
  const W = 2048, H = 640;
  const c = canvasOf(W, H), g = c.getContext('2d', { willReadFrequently: true });
  const size = opt.size || 300;
  g.font = `${opt.weight || 900} ${size}px ${opt.font || 'Orbitron'}`;
  const lines = text.split('\n');
  let mw = 0; for (const l of lines) mw = Math.max(mw, g.measureText(l).width);
  const fs = Math.min(size, size * (W * 0.92) / mw);
  g.font = `${opt.weight || 900} ${fs}px ${opt.font || 'Orbitron'}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
  const data = g.getImageData(0, 0, W, H).data;
  return sampleRaster(data, null, W, H, { mode: 'alpha', height: (opt.width || 18) * H / W, depth: 0.0, jitterZ: opt.jz ?? 0.35, tint: opt.tint || 0xffffff }, seed);
}

// ---------- procedural shapes ----------
// generic primitive sampler: prims = [{w, f:(r)=>[x,y,z], c:[r,g,b]|fn}]
function build(prims, seed) {
  const r = mulberry32(seed);
  const s = alloc();
  let tot = 0; const cum = prims.map(p => (tot += p.w));
  for (let n = 0; n < N; n++) {
    const k = r() * tot; let j = 0; while (cum[j] < k) j++;
    const p = prims[j];
    const v = p.f(r);
    s.pos.set(v, n * 3);
    const c = typeof p.c === 'function' ? p.c(v, r) : p.c;
    s.col.set(c, n * 3);
  }
  return s;
}
const seg = (a, b, th = 0.04) => r => { const k = r(); return [a[0] + (b[0] - a[0]) * k + gauss(r) * th, a[1] + (b[1] - a[1]) * k + gauss(r) * th, a[2] + (b[2] - a[2]) * k + gauss(r) * th]; };
const ring = (c, rad, th = 0.04, plane = 'xy') => r => { const a = r() * TAU; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; const v = plane === 'xy' ? [c[0] + x, c[1] + y, c[2]] : [c[0] + x, c[1], c[2] + y]; return [v[0] + gauss(r) * th, v[1] + gauss(r) * th, v[2] + gauss(r) * th]; };

const CYAN = hexRGB(0x5ef2ff), WHITE = [1, 1, 1], PINK = hexRGB(0xff6fa8), GOLD = hexRGB(0xffd27a), RED = hexRGB(0xff2a3a), VIOLET = hexRGB(0x9d7bff);
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function makeProcedural() {
  const S = {};
  S.scatter = build([{ w: 1, f: r => { const u = r() * 2 - 1, a = r() * TAU, rad = 18 + r() * 30; const q = Math.sqrt(1 - u * u); return [q * Math.cos(a) * rad, u * rad * 0.6, q * Math.sin(a) * rad]; }, c: (v, r) => mixc(CYAN, WHITE, r()) }], 11);
  S.point = build([{ w: 1, f: r => [gauss(r) * 0.05, gauss(r) * 0.05, gauss(r) * 0.05], c: WHITE }], 12);
  // 3D lattice: nodes + edges
  {
    const n = 9, L = 7, st = L / (n - 1);
    const node = r => [Math.floor(r() * n) * st - L / 2, Math.floor(r() * n) * st - L / 2, Math.floor(r() * n) * st - L / 2];
    S.lattice = build([
      { w: 4, f: r => { const p = node(r); return [p[0] + gauss(r) * 0.03, p[1] + gauss(r) * 0.03, p[2] + gauss(r) * 0.03]; }, c: WHITE },
      { w: 6, f: r => { const p = node(r); const ax = Math.floor(r() * 3); p[ax] = (r() - 0.5) * L; return p; }, c: (v) => mixc(CYAN, VIOLET, (v[1] + 3.5) / 7) },
    ], 13);
  }
  S.circle = build([
    { w: 7, f: ring([0, 0, 0], 4.2, 0.035), c: CYAN },
    { w: 1, f: seg([0, 0, 0], [4.2, 0, 0], 0.02), c: WHITE },
    { w: 2, f: r => { const a = r() * TAU, rr = Math.sqrt(r()) * 4.2; return [Math.cos(a) * rr, Math.sin(a) * rr, gauss(r) * 0.05]; }, c: [0.15, 0.35, 0.5] },
    { w: 0.4, f: r => [gauss(r) * 0.06, gauss(r) * 0.06, 0], c: WHITE },
  ], 14);
  S.sine = build([
    { w: 8, f: r => { const x = (r() - 0.5) * 22; return [x + gauss(r) * 0.02, 2.2 * Math.sin(x * 0.85) + gauss(r) * 0.04, gauss(r) * 0.06]; }, c: (v) => mixc(CYAN, PINK, (v[1] + 2.2) / 4.4) },
    { w: 1.5, f: seg([-11, 0, 0], [11, 0, 0], 0.015), c: [0.5, 0.6, 0.7] },
  ], 15);
  S.infinity = build([
    { w: 9, f: r => { const t = r() * TAU, a = 6.5, d = 1 + Math.sin(t) ** 2; return [a * Math.cos(t) / d + gauss(r) * 0.05, a * Math.sin(t) * Math.cos(t) / d + gauss(r) * 0.05, Math.sin(t * 2) * 0.8 + gauss(r) * 0.05]; }, c: (v) => mixc(GOLD, WHITE, Math.abs(v[0]) / 6.5) },
    { w: 1, f: r => [gauss(r) * 2.5, gauss(r) * 2.5, gauss(r) * 2.5], c: [0.3, 0.3, 0.4] },
  ], 16);
  S.coil = build([
    { w: 6, f: r => { const x = (r() - 0.5) * 22; return [x, 1.6 * Math.cos(x * 2.6) + 1.2 + gauss(r) * 0.04, 1.6 * Math.sin(x * 2.6) + gauss(r) * 0.04]; }, c: CYAN },
    { w: 3, f: seg([-11, -2.8, 0], [11, -2.8, 0], 0.05), c: GOLD },
    { w: 1, f: r => { const x = (r() - 0.5) * 22; return [x, -2.8 + (r() - 0.5) * 0.6 * Math.sin(x * 20), gauss(r) * 0.3]; }, c: WHITE },
  ], 17);
  S.vortex = build([{ w: 1, f: r => { const arm = Math.floor(r() * 4), k = Math.pow(r(), 0.7), a = arm * TAU / 4 + k * 7.5 + gauss(r) * 0.18, rad = 0.4 + k * 12; return [Math.cos(a) * rad, gauss(r) * (0.6 - k * 0.4), Math.sin(a) * rad]; }, c: (v) => { const d = Math.hypot(v[0], v[2]) / 12; return mixc(WHITE, mixc(VIOLET, CYAN, d), Math.min(1, d * 2)); } }], 18);
  S.timeRings = build([{ w: 1, f: r => { const k = Math.floor(r() * 14), a = r() * TAU, rad = 5 + Math.sin(k) * 0.5; return [Math.cos(a) * rad + gauss(r) * 0.03, Math.sin(a) * rad + gauss(r) * 0.03, -k * 3 + 8]; }, c: (v) => mixc(GOLD, CYAN, (8 - v[2]) / 40) }], 19);
  S.helix = build([
    { w: 4, f: r => { const y = (r() - 0.5) * 13, a = y * 1.1; return [Math.cos(a) * 2.2 + gauss(r) * 0.05, y, Math.sin(a) * 2.2 + gauss(r) * 0.05]; }, c: CYAN },
    { w: 4, f: r => { const y = (r() - 0.5) * 13, a = y * 1.1 + Math.PI; return [Math.cos(a) * 2.2 + gauss(r) * 0.05, y, Math.sin(a) * 2.2 + gauss(r) * 0.05]; }, c: PINK },
    { w: 2, f: r => { const y = Math.round(((r() - 0.5) * 13) / 0.55) * 0.55, a = y * 1.1, k = r() * 2 - 1; return [Math.cos(a) * 2.2 * k, y + gauss(r) * 0.02, Math.sin(a) * 2.2 * k]; }, c: (v) => mixc(PINK, CYAN, 0.5) },
  ], 20);
  S.sphere = build([
    { w: 6, f: r => { const u = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - u * u); return [q * Math.cos(a) * 5, u * 5, q * Math.sin(a) * 5]; }, c: (v) => mixc(CYAN, WHITE, (v[1] + 5) / 10) },
    { w: 2, f: r => { const lat = (Math.floor(r() * 9) - 4) / 5, a = r() * TAU, q = Math.sqrt(1 - lat * lat) * 5.05; return [q * Math.cos(a), lat * 5.05, q * Math.sin(a)]; }, c: WHITE },
    { w: 2, f: r => { const lon = Math.floor(r() * 12) * TAU / 12, u = r() * Math.PI; return [Math.sin(u) * Math.cos(lon) * 5.05, Math.cos(u) * 5.05, Math.sin(u) * Math.sin(lon) * 5.05]; }, c: WHITE },
  ], 21);
  // the eye of god
  {
    const lid = (top) => r => { const x = (r() * 2 - 1) * 6; const y = (top ? 1 : -1) * 2.6 * (1 - (x / 6) ** 2); return [x + gauss(r) * 0.04, y + gauss(r) * 0.04, gauss(r) * 0.05]; };
    S.eye = build([
      { w: 3, f: lid(true), c: GOLD }, { w: 3, f: lid(false), c: GOLD },
      { w: 3, f: r => { const a = r() * TAU, rr = 0.75 + Math.pow(r(), 0.8) * 1.3; return [Math.cos(a) * rr, Math.sin(a) * rr, gauss(r) * 0.05]; }, c: (v) => mixc(WHITE, GOLD, (Math.hypot(v[0], v[1]) - 0.75) / 1.3) },
      { w: 1, f: ring([0, 0, 0], 2.1, 0.03), c: WHITE },
      { w: 2.5, f: r => { const a = Math.floor(r() * 36) * TAU / 36, rr = 3.6 + r() * 6; return [Math.cos(a) * rr * 1.25, Math.sin(a) * rr, gauss(r) * 0.08]; }, c: (v) => mixc(GOLD, [0.4, 0.3, 0.1], (Math.hypot(v[0], v[1]) - 3.6) / 7) },
      { w: 1, f: r => { const a = TAU / 3, t = Math.floor(r() * 3); const p0 = [Math.cos(t * a + Math.PI / 2) * 9, Math.sin(t * a + Math.PI / 2) * 9 - 1, 0], p1 = [Math.cos((t + 1) * a + Math.PI / 2) * 9, Math.sin((t + 1) * a + Math.PI / 2) * 9 - 1, 0]; return seg(p0, p1, 0.04)(r); }, c: GOLD },
    ], 22);
  }
  // clock
  S.clock = build([
    { w: 5, f: ring([0, 0, 0], 4.6, 0.04), c: WHITE },
    { w: 2, f: r => { const k = Math.floor(r() * 12), a = k * TAU / 12, l = k % 3 === 0 ? 0.9 : 0.45, rr = 4.2 - r() * l; return [Math.cos(a) * rr + gauss(r) * 0.03, Math.sin(a) * rr + gauss(r) * 0.03, gauss(r) * 0.03]; }, c: CYAN },
    { w: 1.5, f: seg([0, 0, 0], [0, 3.6, 0], 0.05), c: GOLD },
    { w: 1.5, f: seg([0, 0, 0], [2.2, -1.2, 0], 0.07), c: GOLD },
    { w: 1, f: ring([0, 0, 0], 5.6, 0.12), c: [0.3, 0.5, 0.7] },
  ], 23);
  // gender symbols
  S.venus = build([
    { w: 6, f: ring([0, 1.6, 0], 2.6, 0.06), c: PINK },
    { w: 2, f: seg([0, -1.0, 0], [0, -5.6, 0], 0.07), c: PINK },
    { w: 1.4, f: seg([-1.7, -3.6, 0], [1.7, -3.6, 0], 0.07), c: PINK },
  ], 24);
  S.mars = build([
    { w: 6, f: ring([-1.0, -1.0, 0], 2.6, 0.06), c: CYAN },
    { w: 2, f: seg([0.85, 0.85, 0], [4.2, 4.2, 0], 0.07), c: CYAN },
    { w: 1, f: seg([4.2, 4.2, 0], [2.0, 4.2, 0], 0.07), c: CYAN },
    { w: 1, f: seg([4.2, 4.2, 0], [4.2, 2.0, 0], 0.07), c: CYAN },
  ], 25);
  // toggle switch (pill outline + knob)
  {
    const pill = r => { const u = r(); const R = 2.2, Lh = 3.0; const per = 2 * Math.PI * R + 4 * Lh; const d = u * per; let p;
      if (d < 2 * Lh) p = [-Lh + d, R, 0]; else if (d < 2 * Lh + Math.PI * R) { const a = Math.PI / 2 - (d - 2 * Lh) / R; p = [Lh + Math.cos(a) * R, Math.sin(a) * R, 0]; }
      else if (d < 4 * Lh + Math.PI * R) p = [Lh - (d - 2 * Lh - Math.PI * R), -R, 0]; else { const a = -Math.PI / 2 - (d - 4 * Lh - Math.PI * R) / R; p = [-Lh + Math.cos(a) * R, Math.sin(a) * R, 0]; }
      return [p[0] + gauss(r) * 0.04, p[1] + gauss(r) * 0.04, gauss(r) * 0.04]; };
    const knob = cx => r => { const a = r() * TAU, rr = Math.sqrt(r()) * 1.6; return [cx + Math.cos(a) * rr, Math.sin(a) * rr, gauss(r) * 0.1]; };
    S.switchL = build([{ w: 5, f: pill, c: VIOLET }, { w: 5, f: knob(-3.0), c: WHITE }], 30);
    S.switchR = build([{ w: 5, f: pill, c: VIOLET }, { w: 5, f: knob(3.0), c: PINK }], 30);
  }
  // cage (bars)
  S.cage = build([
    { w: 7, f: r => { const k = Math.floor(r() * 18), a = k * TAU / 18; return [Math.cos(a) * 4 + gauss(r) * 0.03, (r() - 0.5) * 13, Math.sin(a) * 4 + gauss(r) * 0.03]; }, c: WHITE },
    { w: 2, f: r => { const y = r() < 0.5 ? -6.5 : 6.5; return ring([0, y, 0], 4, 0.04, 'xz')(r); }, c: GOLD },
    { w: 1, f: r => { const a = r() * TAU, k = r(); return [Math.cos(a) * 4 * (1 - k), 6.5 + k * 2.5, Math.sin(a) * 4 * (1 - k)]; }, c: GOLD },
  ], 26);
  // 3D heart (implicit surface, found by bisection along rays)
  {
    const f = (x, y, z) => { const a = x * x + 2.25 * y * y + z * z - 1; return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z; };
    S.heart = build([{ w: 1, f: r => {
      const u = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - u * u); const d = [q * Math.cos(a), u, q * Math.sin(a)];
      let lo = 0, hi = 2; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (f(d[0] * m, d[1] * m, d[2] * m) < 0) lo = m; else hi = m; }
      const sh = r() < 0.85 ? 1 : 0.6 + r() * 0.4; const s = 4.2 * lo * sh;
      return [d[0] * s, d[2] * s + 0.6, d[1] * s];
    }, c: (v, r) => mixc(PINK, WHITE, Math.pow(r(), 3)) }], 27);
  }
  // ascend (particles rising, for shutdown)
  S.ascend = build([{ w: 1, f: r => [gauss(r) * 3.5, 6 + r() * 30, gauss(r) * 3.5], c: (v, r) => mixc(WHITE, CYAN, r()) }], 28);
  // red storm
  S.storm = build([{ w: 1, f: r => { const a = r() * TAU, rr = 3 + Math.pow(r(), 0.5) * 16; return [Math.cos(a) * rr, gauss(r) * 2.5 * (rr / 16) + Math.sin(a * 3) * 1.2, Math.sin(a) * rr]; }, c: (v, r) => mixc(RED, WHITE, Math.pow(r(), 6)) }], 29);
  return S;
}

// compose: first (1-f) of A + last f of B (both randomly ordered -> random subsets)
export function compose(A, B, f) {
  const s = alloc(); const cut = Math.floor(N * (1 - f)) * 3;
  s.pos.set(A.pos.subarray(0, cut), 0); s.pos.set(B.pos.subarray(cut), cut);
  s.col.set(A.col.subarray(0, cut), 0); s.col.set(B.col.subarray(cut), cut);
  return s;
}
export function recolor(A, hex, keep = 0.0) {
  const c = hexRGB(hex); const s = { pos: A.pos, col: new Float32Array(N * 3) };
  for (let i = 0; i < N; i++) { const l = 0.3 * A.col[i * 3] + 0.59 * A.col[i * 3 + 1] + 0.11 * A.col[i * 3 + 2]; for (let k = 0; k < 3; k++) s.col[i * 3 + k] = A.col[i * 3 + k] * keep + c[k] * (0.25 + l) * (1 - keep); }
  return s;
}
