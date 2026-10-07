/* =========================================================================
   Pure Line Room 閳?_tools/analyze.mjs
   Visual QA without eyes: renders frames and reports measurable properties of
   the plate (ink coverage by region, contrast, line density, uniformity), plus
   a per-object audit of screen coverage, so a reviewer can tell whether an
   object is present, correctly placed, and not an unholy black mass.

   usage: node _tools/analyze.mjs [--day|--night] [--time 6]
   ========================================================================= */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { Raster } from './raster.mjs';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const W = 1000, H = 620;
const NIGHT = argv.includes('--night');
const TIME = argv.includes('--time') ? Number(argv[argv.indexOf('--time') + 1]) : 6;

function makeRecorder(w, h) {
  const calls = [];
  let cur = { poly: [], sub: null };
  const state = {
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
    lineDashOffset: 0, font: '', textAlign: 'start', textBaseline: 'alphabetic',
  };
  const stack = [];
  const grad = () => ({ __grad: true, stops: [], addColorStop(o, c) { this.stops.push({ o, c }); } });
  const ctx = {
    canvas: { width: w, height: h },
    get fillStyle() { return state.fillStyle; }, set fillStyle(v) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; }, set strokeStyle(v) { state.strokeStyle = v; },
    get globalAlpha() { return state.globalAlpha; }, set globalAlpha(v) { state.globalAlpha = v; },
    get lineWidth() { return state.lineWidth; }, set lineWidth(v) { state.lineWidth = v; },
    get lineDashOffset() { return state.lineDashOffset; }, set lineDashOffset(v) { state.lineDashOffset = v; },
    get font() { return state.font; }, set font(v) { state.font = v; },
    get textAlign() { return state.textAlign; }, set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; }, set textBaseline(v) { state.textBaseline = v; },
    get lineJoin() { return 'round'; }, set lineJoin(v) {},
    get lineCap() { return 'round'; }, set lineCap(v) {},
    setLineDash(d) { state.dash = d && d.length ? d.slice() : null; },
    save() { stack.push(Object.assign({}, state)); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    setTransform() {}, resetTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() { cur.poly = []; cur.sub = null; },
    moveTo(x, y) { cur.sub = [[x, y]]; cur.poly.push(cur.sub); },
    lineTo(x, y) { if (!cur.sub) { cur.sub = []; cur.poly.push(cur.sub); } cur.sub.push([x, y]); },
    closePath() { if (cur.sub && cur.sub.length) cur.sub.push(cur.sub[0].slice()); },
    quadraticCurveTo(cx, cy, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, mt = 1 - t;
        cur.sub.push([mt * mt * p0[0] + 2 * mt * t * cx + t * t * x, mt * mt * p0[1] + 2 * mt * t * cy + t * t * y]);
      }
    },
    bezierCurveTo(a, b, c, d, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, mt = 1 - t;
        cur.sub.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * a + 3 * mt * t * t * c + t * t * t * x,
          mt * mt * mt * p0[1] + 3 * mt * mt * t * b + 3 * mt * t * t * d + t * t * t * y,
        ]);
      }
    },
    arc(cx, cy, r, a0, a1) {
      for (let i = 0; i <= 18; i++) {
        const a = a0 + ((a1 - a0) * i) / 18;
        const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); } else cur.sub.push(p);
      }
    },
    ellipse(cx, cy, rx, ry) { this.arc(cx, cy, rx, 0, Math.PI * 2); },
    rect(x, y, w2, h2) { this.moveTo(x, y); this.lineTo(x + w2, y); this.lineTo(x + w2, y + h2); this.lineTo(x, y + h2); this.closePath(); },
    fill() { calls.push({ op: 'fill', polys: cur.poly.map((p) => p.slice()), style: state.fillStyle, alpha: state.globalAlpha }); },
    stroke() { calls.push({ op: 'stroke', polys: cur.poly.map((p) => p.slice()), style: state.strokeStyle, alpha: state.globalAlpha, width: Number.isFinite(state.lineWidth) ? state.lineWidth : 1, dash: state.dash || null, dashOffset: state.lineDashOffset }); },
    clip() {},
    fillRect(x, y, w2, h2) { calls.push({ op: 'fill', polys: [[[x, y], [x + w2, y], [x + w2, y + h2], [x, y + h2]]], style: state.fillStyle, alpha: state.globalAlpha }); },
    strokeRect() {}, clearRect() {},
    measureText(s) { return { width: String(s).length * 6 }; },
    fillText(t, x, y) { calls.push({ op: 'text', text: String(t), x, y, style: state.fillStyle, alpha: state.globalAlpha }); },
    strokeText() {},
    createLinearGradient: grad, createRadialGradient: grad,
    _calls: calls,
  };
  return ctx;
}

function approxStyle(style) {
  if (!style || typeof style !== 'object' || !style.stops) return style;
  let r = 0, g = 0, b = 0, a = 0, w = 0;
  for (const s of style.stops) {
    const q = String(s.color).match(/rgba?\(([^)]+)\)/);
    if (!q) continue;
    const p = q[1].split(',').map(Number);
    const al = p.length > 3 ? p[3] : 1;
    const wt = (1 - (s.o || 0) * 0.5) + 0.1;
    r += p[0] * wt; g += p[1] * wt; b += p[2] * wt; a += al * wt; w += wt;
  }
  if (!w) return 'rgba(0,0,0,0)';
  return 'rgba(' + Math.round(r / w) + ',' + Math.round(g / w) + ',' + Math.round(b / w) + ',' + (a / w).toFixed(3) + ')';
}

/* ------------------------------- boot ----------------------------------- */
const ctx = makeRecorder(W, H);
const canvas = {
  width: W, height: H, style: {},
  getContext: () => ctx,
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  classList: { add() {}, remove() {} },
};
const elements = {
  stage: canvas,
  toast: { textContent: '', classList: { add() {}, remove() {} } },
  hint: { classList: { add() {}, remove() {} } },
};
const sandbox = {
  console, devicePixelRatio: 1, innerWidth: W, innerHeight: H,
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  setTimeout: (f) => setTimeout(f, 0), clearTimeout, performance: { now: () => 0 },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || null,
  addEventListener() {}, createElement: () => canvas, documentElement: { style: {} },
};
createContext(sandbox);

const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio', 'interact', 'layout'];
const files = ENGINE.map((n) => 'js/' + n + '.js');
const { readdirSync } = await import('node:fs');
for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
files.push('js/build.js', 'js/main.js');
const buildErrors = [];
for (const f of files) {
  try { runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { buildErrors.push(f + ': ' + e.message); }
}
const PLR = sandbox.PLR;
PLR.app.resize();
if (NIGHT) { PLR.state.override = true; PLR.state.phase = 1; PLR.state.ch.room = 1; PLR.state.lampOn = true; }
else { PLR.state.override = false; PLR.state.phase = 0; PLR.state.ch.room = 0; }

function stepOnce() {
  PLR.state.update(1 / 60);
  PLR.interact.Act.step(1 / 60);
  const pal = PLR.app.renderer.palette;
  const target = PLR.palette.build(PLR.state.phase);
  for (const k in target) pal[k] = target[k];
  PLR.app.scene.update(1 / 60, PLR.state);
}
for (let t = 0; t < TIME; t += 1 / 60) stepOnce();

/* ------------------------- per-object coverage --------------------------- */
/* Render once with everything hidden, then once per solid, and measure how
   many pixels each solid actually puts on the plate. */
function renderMask(only) {
  for (const s of PLR.app.scene.solids) s.visible = !only || only.indexOf(s) >= 0;
  ctx._calls.length = 0;
  PLR.app.renderer.render(PLR.app.scene);
  const r = new Raster(W, H, '#ffffff');
  for (const c of ctx._calls) {
    if (c.op === 'fill') { for (const p of c.polys) if (p.length >= 3) r.fillPoly(p, approxStyle(c.style), c.alpha, 'source-over'); }
    else if (c.op === 'stroke') { for (const p of c.polys) if (p.length >= 2) r.strokePolyline(p, Math.max(1, c.width), approxStyle(c.style), c.alpha, c.dash, c.dashOffset, 'source-over', false); }
  }
  for (const s of PLR.app.scene.solids) s.visible = true;
  return r;
}

const full = renderMask(null);
/* "Ink" means contrast against the plate's own paper, not mere darkness: in
   night mode the whole plate is dark, so measuring luminance would call every
   pixel ink. The paper colour is sampled from the corner the camera never
   covers, and ink is the fraction of pixels that differ from it. */
function paperLum(buf) {
  let best = -1, bestLum = 0;
  for (const [px, py] of [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5]]) {
    const i = (py * W + px) * 4;
    const lum = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
    if (lum > bestLum) { bestLum = lum; }
  }
  return bestLum;
}
const PAPER = paperLum(full.buf);
function ink(buf) {
  let n = 0;
  const thr = 26;
  for (let i = 0; i < buf.length; i += 4) {
    const lum = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
    if (Math.abs(lum - PAPER) > thr) n++;
  }
  return n / (buf.length / 4);
}

console.log('=== PLATE ===');
console.log('build errors: ' + (buildErrors.length ? JSON.stringify(buildErrors) : 'none'));
console.log('solids=' + PLR.app.scene.solids.length
  + ' faces(vis)=' + PLR.app.renderer.debug.faces
  + ' ink=' + (ink(full.buf) * 100).toFixed(2) + '%'
  + ' interactive=' + PLR.interact.Act.list.length);
{
  let dark = 0, white = 0, mid = 0;
  const n = full.buf.length / 4;
  for (let i = 0; i < full.buf.length; i += 4) {
    const lum = (full.buf[i] + full.buf[i + 1] + full.buf[i + 2]) / 3;
    if (lum < 60) dark++;
    else if (lum > 235) white++;
    else mid++;
  }
  console.log('tone: solid-dark=' + (dark / n * 100).toFixed(2) + '%  mid=' + (mid / n * 100).toFixed(2)
    + '%  near-white=' + (white / n * 100).toFixed(2) + '%');
}
/* nine-zone ink map: shows whether one region is an unreadable black mass */
{
  const zones = [];
  for (let zy = 0; zy < 3; zy++) {
    const row = [];
    for (let zx = 0; zx < 3; zx++) {
      let n = 0, inkN = 0;
      for (let y = Math.floor(zy * H / 3); y < Math.floor((zy + 1) * H / 3); y++) {
        for (let x = Math.floor(zx * W / 3); x < Math.floor((zx + 1) * W / 3); x++) {
          const i = (y * W + x) * 4;
          const lum = (full.buf[i] + full.buf[i + 1] + full.buf[i + 2]) / 3;
          n++;
          if (Math.abs(lum - PAPER) > 26) inkN++;
        }
      }
      row.push((inkN / n * 100).toFixed(1) + '%');
    }
    zones.push(row.join('  '));
  }
  console.log('ink by zone (top row first):');
  for (const z of zones) console.log('   ' + z);
}

/* --------------------------- object audit -------------------------------- */
console.log('=== OBJECTS ===');
const rows = [];
for (const s of PLR.app.scene.solids) {
  const only = renderMask([s]);
  const cov = ink(only.buf);
  const b = s.worldBounds();
  let minLum = 255, maxInk = 0;
  const n = only.buf.length / 4;
  for (let i = 0; i < only.buf.length; i += 4) {
    const lum = (only.buf[i] + only.buf[i + 1] + only.buf[i + 2]) / 3;
    if (lum < minLum) minLum = lum;
    if (lum < 150) maxInk++;
  }
  const bd = b ? [b.lo, b.hi].map((v) => '[' + v.map((x) => Math.round(x)).join(',') + ']').join('..') : 'n/a';
  rows.push({
    name: (s.name || ('#' + s.id)),
    faces: s.faces.length,
    verts: s.mesh.verts.length / 3,
    edges: s.mesh.edges.length,
    screenCov: +(cov * 100).toFixed(2),
    darkest: Math.round(minLum),
    bounds: bd,
  });
}
rows.sort((a, b) => b.screenCov - a.screenCov);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('solid', 16) + pad('faces', 7) + pad('verts', 7) + pad('edges', 7) + pad('cov%', 8) + pad('dark', 6) + 'bounds');
for (const r of rows) {
  console.log(pad(r.name, 16) + pad(r.faces, 7) + pad(r.verts, 7) + pad(r.edges, 7)
    + pad(r.screenCov, 8) + pad(r.darkest, 6) + r.bounds);
}

/* ------------------------------ verdicts --------------------------------- */
console.log('=== VERDICT ===');
const problems = [];
const notes = [];
if (buildErrors.length) problems.push('build errors: ' + buildErrors.join(' | '));

/* A solid that shows nothing in isolation is fine when it is genuinely small or
   hidden behind something. Only flag it when it occupies a lot of screen area
   yet still contributes nothing. */
const empty = [];
for (const s of PLR.app.scene.solids) {
  if (!s.faces.length) continue;                       // transform-only container
  const only = renderMask([s]);
  const cov = ink(only.buf);
  if (cov > 0.00085) continue;                         // it draws something
  const b = s.worldBounds();
  if (!b) continue;
  const tmp = [0, 0, 0];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, front = 0;
  for (let i = 0; i < 8; i++) {
    const p = [(i & 1) ? b.hi[0] : b.lo[0], (i & 2) ? b.hi[1] : b.lo[1], (i & 4) ? b.hi[2] : b.lo[2]];
    const q = PLR.app.renderer.projectPoint(p, tmp);
    if (q[2] <= PLR.app.renderer.near) continue;
    front++;
    if (q[0] < minX) minX = q[0];
    if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1];
    if (q[1] > maxY) maxY = q[1];
  }
  if (!front) { empty.push(s.name + ' (entirely behind the camera)'); continue; }
  const bw = Math.max(0, Math.min(W, maxX) - Math.max(0, minX));
  const bh = Math.max(0, Math.min(H, maxY) - Math.max(0, minY));
  const area = bw * bh;
  if (area > 12000) {
    empty.push(s.name + ' (occupies ' + Math.round(area) + 'px yet draws nothing: off plate x[' +
      Math.round(minX) + ',' + Math.round(maxX) + '] y[' + Math.round(minY) + ',' + Math.round(maxY) + '])');
  } else {
    notes.push(s.name + ' too small or occluded (' + Math.round(area) + 'px box)');
  }
}
if (empty.length) problems.push('solids that should be visible but draw nothing: ' + empty.join('; '));

const huge = rows.filter((r) => r.screenCov > 65);
if (huge.length) problems.push('solids covering most of the plate: ' + huge.map((r) => r.name + ' ' + r.screenCov + '%').join(', '));
const black = rows.filter((r) => r.darkest < 18 && r.screenCov > 3);
if (black.length) problems.push('near-black masses: ' + black.map((r) => r.name + ' (min lum ' + r.darkest + ')').join(', '));
{
  let maxZone = 0;
  for (let zy = 0; zy < 3; zy++) {
    for (let zx = 0; zx < 3; zx++) {
      let n = 0, inkN = 0;
      for (let y = Math.floor(zy * H / 3); y < Math.floor((zy + 1) * H / 3); y++) {
        for (let x = Math.floor(zx * W / 3); x < Math.floor((zx + 1) * W / 3); x++) {
          const i = (y * W + x) * 4;
          n++;
          if (Math.abs((full.buf[i] + full.buf[i + 1] + full.buf[i + 2]) / 3 - PAPER) > 26) inkN++;
        }
      }
      maxZone = Math.max(maxZone, inkN / n);
    }
  }
  if (maxZone > 0.6) problems.push('one ninth of the plate is over-inked (' + (maxZone * 100).toFixed(1) + '%)');
  if (ink(full.buf) > 0.22) problems.push('plate is over-inked overall (' + (ink(full.buf) * 100).toFixed(1) + '%)');
}
console.log(problems.length ? problems.map((p) => 'PROBLEM: ' + p).join('\n') : 'no structural problems detected');
if (notes.length) console.log('notes (' + notes.length + '): ' + notes.slice(0, 6).join('; ') + (notes.length > 6 ? ' ...' : ''));


