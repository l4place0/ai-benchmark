/* =========================================================================
   Pure Line Room — _tools/interact.mjs
   Drives every interactive object the way a visitor would and reports what
   happens: does the click change the picture, does hover give feedback, does
   the room keep moving, and does any module throw or produce bad geometry.

   usage: node _tools/interact.mjs [--verbose]
   ========================================================================= */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { Raster } from './raster.mjs';

const ROOT = join(import.meta.dirname, '..');
const W = 760, H = 480;
const VERBOSE = process.argv.includes('--verbose');

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
      for (let i = 1; i <= 8; i++) { const t = i / 8, mt = 1 - t; cur.sub.push([mt * mt * p0[0] + 2 * mt * t * cx + t * t * x, mt * mt * p0[1] + 2 * mt * t * cy + t * t * y]); }
    },
    bezierCurveTo(a, b, c, d, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      for (let i = 1; i <= 10; i++) { const t = i / 10, mt = 1 - t; cur.sub.push([mt * mt * mt * p0[0] + 3 * mt * mt * t * a + 3 * mt * t * t * c + t * t * t * x, mt * mt * mt * p0[1] + 3 * mt * mt * t * b + 3 * mt * t * t * d + t * t * t * y]); }
    },
    arc(cx, cy, r, a0, a1) {
      for (let i = 0; i <= 18; i++) { const a = a0 + ((a1 - a0) * i) / 18; const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); } else cur.sub.push(p); }
    },
    ellipse(cx, cy, rx) { this.arc(cx, cy, rx, 0, Math.PI * 2); },
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

const ctx = makeRecorder(W, H);
const canvas = {
  width: W, height: H, style: {}, getContext: () => ctx,
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  classList: { add() {}, remove() {} },
};
const sandbox = {
  console, devicePixelRatio: 1, innerWidth: W, innerHeight: H,
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  setTimeout: (f) => setTimeout(f, 0), clearTimeout, performance: { now: () => 0 },
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  getElementById: (id) => (id === 'stage' ? canvas : { textContent: '', classList: { add() {}, remove() {} } }),
  addEventListener() {}, createElement: () => canvas, documentElement: { style: {} },
};
createContext(sandbox);

const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio', 'interact', 'layout'];
const files = ENGINE.map((n) => 'js/' + n + '.js');
for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
files.push('js/build.js', 'js/main.js');

const buildProblems = [];
for (const f of files) {
  try { runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { buildProblems.push(f + ': ' + e.message); }
}
const PLR = sandbox.PLR;
PLR.app.resize();

/* Catch non-finite coordinates as they are authored: this is the single most
   damaging class of bug (one NaN erases a whole solid). */
const badVerts = [];
const G = PLR.graphics.Graphics.prototype;
const origV = G.v;
G.v = function (x, y, z) {
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
    if (badVerts.length < 8) badVerts.push((this.node.name || this.node.id) + ' (' + x + ',' + y + ',' + z + ')');
  }
  return origV.call(this, x, y, z);
};

PLR.state.override = false; PLR.state.phase = 0; PLR.state.ch.room = 0;

function step(dt) {
  PLR.state.update(dt);
  PLR.interact.Act.step(dt);
  const pal = PLR.app.renderer.palette;
  const target = PLR.palette.build(PLR.state.phase);
  for (const k in target) pal[k] = target[k];
  PLR.app.scene.update(dt, PLR.state);
}
function warm(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); }
function shot() {
  ctx._calls.length = 0;
  PLR.app.renderer.render(PLR.app.scene);
  const r = new Raster(W, H, '#ffffff');
  for (const c of ctx._calls) {
    if (c.op === 'fill') { for (const p of c.polys) if (p.length >= 3) r.fillPoly(p, approxStyle(c.style), c.alpha, 'source-over'); }
    else if (c.op === 'stroke') { for (const p of c.polys) if (p.length >= 2) r.strokePolyline(p, Math.max(1, c.width), approxStyle(c.style), c.alpha, c.dash, c.dashOffset, 'source-over', false); }
  }
  return r.buf.slice();
}
function diff(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) n++;
  }
  return n / (a.length / 4);
}

warm(2);
const list = PLR.interact.Act.list.slice();
console.log('interactive objects: ' + list.length);
console.log('build problems: ' + (buildProblems.length ? JSON.stringify(buildProblems) : 'none'));

const broken = [];
const quiet = [];
for (const pr of list) {
  let before;
  try { before = shot(); } catch (e) { broken.push(pr.id + ' (snapshot failed: ' + e.message + ')'); continue; }
  let threw = '';
  try { pr.click({}); } catch (e) { threw = e.message; }
  warm(1.8);
  let after;
  try { after = shot(); } catch (e) { broken.push(pr.id + ' (post-click snapshot failed: ' + e.message + ')'); continue; }
  const d = diff(before, after);
  const ok = d > 0.0012;
  if (VERBOSE) console.log('  ' + pr.id.padEnd(16) + (ok ? 'changed ' : 'NO CHANGE ') + (d * 100).toFixed(2) + '%' + (threw ? '  threw: ' + threw : ''));
  if (!ok) quiet.push(pr.id + (threw ? ' (threw: ' + threw + ')' : ' (no visual change ' + (d * 100).toFixed(3) + '%)'));
  try { pr.click({}); } catch (e) { /* restore */ }
  warm(1.2);
}

/* hover feedback */
const noHover = [];
for (const pr of list) {
  PLR.interact.Act.hover = null;
  pr.hovered = false;
  warm(0.5);
  const plain = shot();
  pr.hovered = true;
  PLR.interact.Act.hover = pr;
  PLR.app.pointer.inside = true;
  warm(0.5);
  const hov = shot();
  if (diff(plain, hov) < 0.0004) noHover.push(pr.id);
  pr.hovered = false;
  PLR.interact.Act.hover = null;
}

/* ambient motion with no input at all */
PLR.state.fanOn = true; PLR.state.recordOn = true; PLR.state.lampOn = true;
warm(3);
const a1 = shot();
warm(0.8);
const a2 = shot();
const ambient = diff(a1, a2);

/* day / night */
PLR.state.override = true; warm(3.5);
const night = shot();
const nightDiff = diff(a1, night);
PLR.state.override = false; warm(3);

console.log('');
console.log('RESULTS');
console.log('  clicks with no visible effect : ' + (quiet.length ? quiet.join(', ') : 'none'));
console.log('  objects that threw            : ' + (broken.length ? broken.join(', ') : 'none'));
console.log('  hover with no feedback        : ' + (noHover.length ? noHover.join(', ') : 'none'));
console.log('  ambient animation             : ' + (ambient > 0.0008 ? 'yes (' + (ambient * 100).toFixed(3) + '% per 0.8s)' : 'NO — the room is static'));
console.log('  night changes the plate       : ' + (nightDiff > 0.08 ? 'yes (' + (nightDiff * 100).toFixed(1) + '%)' : 'NO (' + (nightDiff * 100).toFixed(1) + '%)'));
console.log('  non-finite vertices authored  : ' + (badVerts.length ? badVerts.join(' | ') : 'none'));

const fail = quiet.length + broken.length + noHover.length + badVerts.length +
  (ambient > 0.0008 ? 0 : 1) + (nightDiff > 0.08 ? 0 : 1) + buildProblems.length;
console.log('');
console.log(fail === 0 ? 'ALL INTERACTION CHECKS PASSED' : fail + ' PROBLEM(S)');
process.exit(fail === 0 ? 0 : 1);
