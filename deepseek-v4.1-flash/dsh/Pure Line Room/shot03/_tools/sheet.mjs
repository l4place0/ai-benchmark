/* =========================================================================
   Pure Line Room — _tools/sheet.mjs
   Renders several camera setups in one process and tiles them into a contact
   sheet, so the whole room can be reviewed at a glance.

   usage: node _tools/sheet.mjs <out.png> [--night] [--time 6]
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { Raster } from './raster.mjs';
import { encodePNG } from './png.mjs';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const outPath = argv[0] || join(ROOT, '_shots', 'sheet.png');
const NIGHT = argv.includes('--night');
const TIME = argv.includes('--time') ? Number(argv[argv.indexOf('--time') + 1]) : 6;

const TILE_W = 620, TILE_H = 400;
const VIEWS = [
  { label: 'home', yaw: 0, pitch: -0.15, dolly: 0, camY: 136 },
  { label: 'left', yaw: 0.62, pitch: -0.10, dolly: -30, camY: 136 },
  { label: 'right', yaw: -0.62, pitch: -0.10, dolly: -30, camY: 136 },
  { label: 'up', yaw: 0, pitch: 0.34, dolly: -60, camY: 130 },
  { label: 'down', yaw: 0, pitch: -0.52, dolly: -20, camY: 140 },
  { label: 'close', yaw: 0.1, pitch: -0.22, dolly: -190, camY: 120 },
];

/* ------------------------------ recording ctx ---------------------------- */
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
      for (let i = 0; i <= 20; i++) {
        const a = a0 + ((a1 - a0) * i) / 20;
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

function renderView(cfg) {
  const ctx = makeRecorder(TILE_W, TILE_H);
  const canvas = {
    width: TILE_W, height: TILE_H, style: {},
    getContext: () => ctx,
    addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: TILE_W, height: TILE_H }),
    classList: { add() {}, remove() {} },
  };
  const elements = {
    stage: canvas,
    toast: { textContent: '', classList: { add() {}, remove() {} } },
    hint: { classList: { add() {}, remove() {} } },
  };
  const sandbox = {
    console, devicePixelRatio: 1, innerWidth: TILE_W, innerHeight: TILE_H,
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
  for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
  files.push('js/build.js', 'js/main.js');
  const errors = [];
  for (const f of files) {
    try { runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { errors.push(f + ': ' + e.message); }
  }
  const PLR = sandbox.PLR;
  if (!PLR || !PLR.app || !PLR.app.renderer) return { buf: null, errors: errors.concat('no boot') };
  PLR.app.resize();
  if (NIGHT) { PLR.state.override = true; PLR.state.phase = 1; PLR.state.ch.room = 1; PLR.state.lampOn = true; }
  else { PLR.state.override = false; PLR.state.phase = 0; PLR.state.ch.room = 0; }

  const home = PLR.layout.camera.home.slice();
  home[1] = cfg.camY;
  home[2] += cfg.dolly;
  PLR.app.renderer.setCamera(home, cfg.yaw, cfg.pitch);
  PLR.app.renderer.focal = PLR.layout.camera.focal;

  for (let t = 0; t < TIME; t += 1 / 60) {
    PLR.state.update(1 / 60);
    PLR.interact.Act.step(1 / 60);
    const pal = PLR.app.renderer.palette;
    const target = PLR.palette.build(PLR.state.phase);
    for (const k in target) pal[k] = target[k];
    PLR.app.scene.update(1 / 60, PLR.state);
  }
  // keep the camera where we asked, ignoring the damping history
  PLR.app.renderer.cam.pos[0] = home[0];
  PLR.app.renderer.cam.pos[1] = home[1];
  PLR.app.renderer.cam.pos[2] = home[2];
  PLR.app.renderer.cam.yaw = cfg.yaw;
  PLR.app.renderer.cam.pitch = cfg.pitch;

  ctx._calls.length = 0;
  PLR.app.renderer.render(PLR.app.scene);
  const r = new Raster(TILE_W, TILE_H, '#ffffff');
  for (const c of ctx._calls) {
    if (c.op === 'fill') {
      for (const p of c.polys) if (p.length >= 3) r.fillPoly(p, approxStyle(c.style), c.alpha, 'source-over');
    } else if (c.op === 'stroke') {
      for (const p of c.polys) if (p.length >= 2) r.strokePolyline(p, Math.max(1, c.width), approxStyle(c.style), c.alpha, c.dash, c.dashOffset, 'source-over', false);
    }
  }
  return { buf: r.buf, label: cfg.label, errors, faces: PLR.app.renderer.debug.faces };
}

/* --------------------------------- tile ---------------------------------- */
const cols = 2;
const rows = Math.ceil(VIEWS.length / cols);
const W = cols * TILE_W, H = rows * TILE_H;
const out = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  out[i * 4] = 250; out[i * 4 + 1] = 250; out[i * 4 + 2] = 249; out[i * 4 + 3] = 255;
}

let n = 0;
for (const v of VIEWS) {
  const res = renderView(v);
  const cx = (n % cols) * TILE_W, cy = Math.floor(n / cols) * TILE_H;
  if (res.buf) {
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        const si = (y * TILE_W + x) * 4, di = ((cy + y) * W + cx + x) * 4;
        out[di] = res.buf[si]; out[di + 1] = res.buf[si + 1]; out[di + 2] = res.buf[si + 2];
      }
    }
  }
  console.log('view ' + v.label + ' faces=' + (res.faces || 0) + (res.errors.length ? ' ERRORS ' + JSON.stringify(res.errors) : ''));
  n++;
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodePNG(W, H, out));
console.log('WROTE ' + outPath + ' (' + W + 'x' + H + ')');
