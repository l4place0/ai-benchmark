/* =========================================================================
   Pure Line Room 鈥?_tools/preview.mjs
   Runs the real client scripts inside a Node VM with a fallback Canvas2D
   context that records every draw call, then replays that stream through the
   software rasteriser to produce a PNG.

   usage: node _tools/preview.mjs <out.png> [--time 8] [--night] [--width 1440]
   ========================================================================= */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { Raster } from './raster.mjs';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const outPath = argv[0] && !argv[0].startsWith('--') ? argv[0] : join(ROOT, '_shots', 'preview.png');
function argNum(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
}
const TIME = argNum('time', 6);
const WIDTH = argNum('width', 1200);
const HEIGHT = argNum('height', 750);
const NIGHT = argv.includes('--night');
const DAY = argv.includes('--day');
const FRAME = argNum('frame', 0);
const HOVER = argNum('hover', 0);

/* ------------------------------ record ctx ------------------------------- */
function makeRecorder(w, h) {
  const calls = [];
  let cur = { poly: [], sub: null };
  const state = {
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
    lineJoin: 'round', lineCap: 'round', font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', lineDashOffset: 0,
  };
  const stack = [];
  const ctx = {
    canvas: { width: w, height: h },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v) { state.strokeStyle = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v) { state.globalAlpha = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v) { state.lineWidth = v; },
    get lineJoin() { return state.lineJoin; },
    set lineJoin(v) { state.lineJoin = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v) { state.lineCap = v; },
    get font() { return state.font; },
    set font(v) { state.font = v; },
    get textAlign() { return state.textAlign; },
    set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(v) { state.textBaseline = v; },
    get lineDashOffset() { return state.lineDashOffset; },
    set lineDashOffset(v) { state.lineDashOffset = v; },
    setLineDash(d) { state.dash = d && d.length ? d.slice() : null; },
    getLineDash() { return state.dash || []; },
    save() { stack.push(Object.assign({}, state)); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    setTransform() {}, resetTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() { cur.poly = []; cur.sub = null; },
    moveTo(x, y) { cur.sub = [[x, y]]; cur.poly.push(cur.sub); },
    lineTo(x, y) { if (!cur.sub) { cur.sub = []; cur.poly.push(cur.sub); } cur.sub.push([x, y]); },
    closePath() { if (cur.sub && cur.sub.length) cur.sub.push(cur.sub[0].slice()); },
    quadraticCurveTo(cx, cy, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      const n = 10;
      for (let i = 1; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        cur.sub.push([
          mt * mt * p0[0] + 2 * mt * t * cx + t * t * x,
          mt * mt * p0[1] + 2 * mt * t * cy + t * t * y,
        ]);
      }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      const n = 14;
      for (let i = 1; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        cur.sub.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x,
          mt * mt * mt * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y,
        ]);
      }
    },
    arc(cx, cy, r, a0, a1) {
      const n = 24;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        if (i === 0 && !cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); }
        else if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); }
        else cur.sub.push(p);
      }
    },
    rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); },
    ellipse(cx, cy, rx, ry, rot, a0, a1) {
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const p = [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
        if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); } else cur.sub.push(p);
      }
    },
    fill() { calls.push({ op: 'fill', polys: cur.poly.map((p) => p.slice()), style: state.fillStyle, alpha: state.globalAlpha }); },
    stroke() {
      const lw = state.lineWidth;
      if (!Number.isFinite(lw) || lw > 8) {
        const where = sandbox.__PLR_LAST_SOLID || '?';
        calls.push({ op: 'strokeBAD', stack: new Error('lineWidth ' + lw + ' solid=' + where).stack.slice(0, 420), width: String(lw) });
      }
      calls.push({
        op: 'stroke', polys: cur.poly.map((p) => p.slice()), style: state.strokeStyle,
        alpha: state.globalAlpha, width: state.lineWidth, dash: state.dash || null,
        dashOffset: state.lineDashOffset,
      });
    },
    clip() {},
    fillRect(x, y, w, h) {
      calls.push({ op: 'fill', polys: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]], style: state.fillStyle, alpha: state.globalAlpha });
    },
    strokeRect(x, y, w, h) {
      calls.push({ op: 'stroke', polys: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]], style: state.strokeStyle, alpha: state.globalAlpha, width: state.lineWidth, dash: state.dash || null });
    },
    clearRect() {},
    measureText(s) { return { width: String(s).length * 6.6 }; },
    fillText(text, x, y) {
      calls.push({ op: 'text', text: String(text), x, y, style: state.fillStyle, alpha: state.globalAlpha, font: state.font, align: state.textAlign, baseline: state.textBaseline });
    },
    strokeText() {},
    createLinearGradient() { return { __grad: true, stops: [] }; },
    createRadialGradient() { return { __grad: true, stops: [] }; },
    _calls: calls,
  };
  const grad = () => ({
    __grad: true, stops: [],
    addColorStop(o, c) { this.stops.push({ o, c }); },
  });
  ctx.createLinearGradient = grad;
  ctx.createRadialGradient = grad;
  return ctx;
}

/* ------------------------------ fake canvas ------------------------------ */
function makeCanvas(w, h, ctx) {
  return {
    width: w, height: h, style: {},
    getContext() { return ctx; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: w, height: h, right: w, bottom: h }; },
    setPointerCapture() {}, releasePointerCapture() {},
    classList: { add() {}, remove() {} },
  };
}

/* --------------------------------- boot ---------------------------------- */
const ctx = makeRecorder(WIDTH, HEIGHT);
const canvas = makeCanvas(WIDTH, HEIGHT, ctx);
const elements = {
  stage: canvas,
  toast: { textContent: '', classList: { add() {}, remove() {} } },
  hint: { classList: { add() {}, remove() {} } },
};

const rafQueue = [];
let now = 0;
const window = {
  devicePixelRatio: 1,
  innerWidth: WIDTH,
  innerHeight: HEIGHT,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame() {},
  performance: { now: () => now },
  setTimeout: (fn, ms) => setTimeout(fn, 0),
  clearTimeout,
  console,
  AudioContext: undefined,
  webkitAudioContext: undefined,
};
window.window = window;
window.document = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || null,
  addEventListener() {},
  createElement: () => makeCanvas(1, 1, makeRecorder(1, 1)),
  documentElement: { style: {} },
  body: { appendChild() {} },
};
window.performance = { now: () => now };
window.navigator = { userAgent: 'node-preview' };
window.Math = Math;
window.Date = Date;
window.JSON = JSON;
window.parseInt = parseInt;
window.parseFloat = parseFloat;
window.isNaN = isNaN;
window.Array = Array;
window.Object = Object;
window.String = String;
window.Number = Number;
window.Boolean = Boolean;
window.Error = Error;
window.Set = Set;
window.Map = Map;
window.Float64Array = Float64Array;
window.Int32Array = Int32Array;
window.Uint8Array = Uint8Array;
window.Uint8ClampedArray = Uint8ClampedArray;
window.Infinity = Infinity;
window.NaN = NaN;
window.undefined = undefined;

const sandbox = window;
sandbox.globalThis = window;
sandbox.self = window;
createContext(sandbox);

const files = [
  'js/math.js', 'js/scene.js', 'js/graphics.js', 'js/renderer.js', 'js/palette.js',
  'js/state.js', 'js/audio.js', 'js/interact.js', 'js/layout.js',
  'js/objects/room.js', 'js/objects/window.js', 'js/objects/door.js', 'js/objects/desk.js',
  'js/objects/chair.js', 'js/objects/shelf.js', 'js/objects/sideboard.js', 'js/objects/sofa.js',
  'js/objects/table.js', 'js/objects/rug.js', 'js/objects/lamp.js', 'js/objects/cup.js',
  'js/objects/globe.js', 'js/objects/clock.js', 'js/objects/fan.js', 'js/objects/chime.js',
  'js/objects/record.js', 'js/objects/art.js', 'js/objects/switch.js',
  'js/build.js', 'js/main.js',
];

const errors = [];
for (const f of files) {
  try {
    runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f });
  } catch (e) {
    errors.push(f + ': ' + e.stack.split('\n').slice(0, 3).join(' | '));
  }
}

const PLR = sandbox.PLR;
if (!PLR || !PLR.app || !PLR.app.renderer) {
  console.error('BOOT FAILED');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

// the page normally calls this on load and on window resize
PLR.app.resize();

// environment
function approxStyle(style) {
  /* The preview rasteriser has no gradient support, so a gradient is flattened
     to the offset-weighted mean of its stops. The result reads as a soft wash
     of the right colour and brightness. */
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
if (argv.includes('--camY') || argv.includes('--pitch') || argv.includes('--focal')) {
  const home = PLR.layout.camera.home.slice();
  if (argv.includes('--camY')) home[1] = argNum('camY', home[1]);
  PLR.layout.camera.home = home;
  if (argv.includes('--pitch')) PLR.layout.camera.pitch = argNum('pitch', PLR.layout.camera.pitch);
  if (argv.includes('--focal')) PLR.layout.camera.focal = argNum('focal', PLR.layout.camera.focal);
  PLR.app.renderer.focal = PLR.layout.camera.focal;
  PLR.app.renderer.setCamera(home, 0, PLR.layout.camera.pitch);
}
if (NIGHT) {
  PLR.state.override = true;
  PLR.state.phase = 1;
  PLR.state.ch.room = 1;
  PLR.state.lampOn = true;
}
if (DAY) {
  PLR.state.override = false;
  PLR.state.phase = 0;
  PLR.state.ch.room = 0;
}
if (HOVER) {
  const list = PLR.interact.Act.list;
  if (list[HOVER - 1]) {
    list[HOVER - 1].hovered = true;
    PLR.app.pointer.inside = true;
  }
}

// advance the simulation to TIME seconds, then draw one frame
const tSim = Date.now();
const step = 1 / 60;
for (let t = 0; t < TIME; t += step) {
  now += step * 1000;
  PLR.state.update(step);
  PLR.interact.Act.step(step);
  const pal = PLR.app.renderer.palette;
  const target = PLR.palette.build(PLR.state.phase);
  for (const k in target) pal[k] = target[k];
  pal.__time = PLR.state.phase;
  PLR.app.scene.update(step, PLR.state);
}
now += step * 1000;
PLR.interact.Act.step(step);
PLR.app.scene.update(step, PLR.state);
const simMs = Date.now() - tSim;
ctx._calls.length = 0;
PLR.app.renderer.render(PLR.app.scene);
const tReplay = Date.now();

const info = {
  calls: ctx._calls.length,
  faces: PLR.app.renderer.debug.faces,
  solids: PLR.app.renderer.debug.solidCount,
  sceneSolids: PLR.app.scene.solids.length,
  totalFaces: PLR.app.scene.countFaces(),
  interactive: PLR.interact.Act.list.length,
  phase: +PLR.state.phase.toFixed(3),
  errors,
};
console.log(JSON.stringify(info));

/* --------------------------------- replay -------------------------------- */
const r = new Raster(WIDTH, HEIGHT, '#ffffff');
const dpr = PLR.app.renderer.dpr;
const calls = ctx._calls;
const onlyFills = argv.includes('--fillsonly');
const onlyStrokes = argv.includes('--strokesonly');
let strokeSegs = 0, fillPolys = 0, skipped = 0, badWidth = 0;
for (const c of calls) {
  if (c.op === 'fill') {
    if (onlyStrokes) continue;
    for (const poly of c.polys) {
      if (poly.length < 3) { skipped++; continue; }
      r.fillPoly(poly, approxStyle(c.style), c.alpha, 'source-over');
      fillPolys++;
    }
  } else if (c.op === 'stroke') {
    if (onlyFills) continue;
    if (!Number.isFinite(c.width) || c.width <= 0) badWidth++;
    for (const poly of c.polys) {
      if (poly.length < 2) { skipped++; continue; }
      r.strokePolyline(poly, Math.max(1, c.width * dpr), approxStyle(c.style), c.alpha, c.dash, c.dashOffset, 'source-over', false);
      strokeSegs++;
    }
  } else if (c.op === 'text') {
    r.fillPoly([
      [c.x - 12, c.y - 3], [c.x + 12, c.y - 3], [c.x + 12, c.y + 3], [c.x - 12, c.y + 3],
    ], c.style, Math.min(0.35, c.alpha), 'source-over');
  }
}
if (skipped || badWidth) {
  console.log('WARN skipped=' + skipped + ' badWidth=' + badWidth);
}
console.log('COST pxWrites=' + r.pxWrites + ' spanRows=' + r.spanRows + ' fills=' + fillPolys + ' strokes=' + strokeSegs);
console.log('TIMING sim=' + simMs + 'ms render=' + (tReplay - tSim - simMs) + 'ms replay=' + (Date.now() - tReplay) + 'ms');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, r.toPNG());
if (argv.includes('--strokesonly')) {
  const r2 = new Raster(WIDTH, HEIGHT, '#ffffff');
  for (const c of calls) {
    if (c.op !== 'stroke') continue;
    for (const poly of c.polys) {
      if (poly.length < 2) continue;
      r2.strokePolyline(poly, Math.max(1, c.width * dpr), approxStyle(c.style), c.alpha, c.dash, c.dashOffset, 'source-over', false);
    }
  }
  writeFileSync(outPath.replace(/\.png$/, '-strokes.png'), r2.toPNG());
}
if (argv.includes('--fillsonly')) {
  const r3 = new Raster(WIDTH, HEIGHT, '#ffffff');
  for (const c of calls) {
    if (c.op !== 'fill') continue;
    for (const poly of c.polys) {
      if (poly.length < 3) continue;
      r3.fillPoly(poly, approxStyle(c.style), c.alpha, 'source-over');
    }
  }
  writeFileSync(outPath.replace(/\.png$/, '-fills.png'), r3.toPNG());
}
if (argv.includes('--dumpcalls')) {
  writeFileSync(outPath.replace(/\.png$/, '.calls.json'), JSON.stringify(calls));
  console.log('DUMPED calls json');
}
console.log('WROTE ' + outPath + '  (fills=' + fillPolys + ' strokes=' + strokeSegs + ')');

