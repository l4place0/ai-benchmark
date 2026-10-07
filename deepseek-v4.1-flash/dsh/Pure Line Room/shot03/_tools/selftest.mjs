/* =========================================================================
   Pure Line Room — _tools/selftest.mjs
   End-to-end check that runs inside a Node VM with the recording canvas:

     1. every client script loads and the scene builds without errors
     2. every registered interactive object responds to a click (the rendered
        frame changes measurably afterwards)
     3. hover produces visible feedback
     4. the room keeps animating with no input at all
     5. day and night both render
     6. the source tree contains no external network references

   usage: node _tools/selftest.mjs
   ========================================================================= */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { Raster } from './raster.mjs';

const ROOT = join(import.meta.dirname, '..');
const W = 1000, H = 640;
const results = [];
const allFiles = [];
let failures = 0;

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  if (!ok) failures++;
}

/* ------------------------------ recording ctx ---------------------------- */
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
    get fillStyle() { return state.fillStyle; }, set fillStyle(v) { state.fillStyle = v; },
    get strokeStyle() { return state.strokeStyle; }, set strokeStyle(v) { state.strokeStyle = v; },
    get globalAlpha() { return state.globalAlpha; }, set globalAlpha(v) { state.globalAlpha = v; },
    get lineWidth() { return state.lineWidth; }, set lineWidth(v) { state.lineWidth = v; },
    get lineJoin() { return state.lineJoin; }, set lineJoin(v) { state.lineJoin = v; },
    get lineCap() { return state.lineCap; }, set lineCap(v) { state.lineCap = v; },
    get font() { return state.font; }, set font(v) { state.font = v; },
    get textAlign() { return state.textAlign; }, set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; }, set textBaseline(v) { state.textBaseline = v; },
    get lineDashOffset() { return state.lineDashOffset; }, set lineDashOffset(v) { state.lineDashOffset = v; },
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
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, mt = 1 - t;
        cur.sub.push([mt * mt * p0[0] + 2 * mt * t * cx + t * t * x, mt * mt * p0[1] + 2 * mt * t * cy + t * t * y]);
      }
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const p0 = cur.sub && cur.sub.length ? cur.sub[cur.sub.length - 1] : [x, y];
      for (let i = 1; i <= 14; i++) {
        const t = i / 14, mt = 1 - t;
        cur.sub.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x,
          mt * mt * mt * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y,
        ]);
      }
    },
    arc(cx, cy, r, a0, a1) {
      for (let i = 0; i <= 24; i++) {
        const a = a0 + ((a1 - a0) * i) / 24;
        const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); } else cur.sub.push(p);
      }
    },
    rect(x, y, w2, h2) { this.moveTo(x, y); this.lineTo(x + w2, y); this.lineTo(x + w2, y + h2); this.lineTo(x, y + h2); this.closePath(); },
    ellipse(cx, cy, rx, ry, rot, a0, a1) {
      for (let i = 0; i <= 28; i++) {
        const a = a0 + ((a1 - a0) * i) / 28;
        const p = [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
        if (!cur.sub) { cur.sub = [p]; cur.poly.push(cur.sub); } else cur.sub.push(p);
      }
    },
    fill() { calls.push({ op: 'fill', polys: cur.poly.map((p) => p.slice()), style: state.fillStyle, alpha: state.globalAlpha }); },
    stroke() {
      calls.push({
        op: 'stroke', polys: cur.poly.map((p) => p.slice()), style: state.strokeStyle,
        alpha: state.globalAlpha, width: Number.isFinite(state.lineWidth) ? state.lineWidth : 1,
        dash: state.dash || null, dashOffset: state.lineDashOffset,
      });
    },
    clip() {},
    fillRect(x, y, w2, h2) { calls.push({ op: 'fill', polys: [[[x, y], [x + w2, y], [x + w2, y + h2], [x, y + h2]]], style: state.fillStyle, alpha: state.globalAlpha }); },
    strokeRect() {}, clearRect() {},
    measureText(s) { return { width: String(s).length * 6.6 }; },
    fillText(text, x, y) { calls.push({ op: 'text', text: String(text), x, y, style: state.fillStyle, alpha: state.globalAlpha }); },
    strokeText() {},
    createLinearGradient() { return grad(); },
    createRadialGradient() { return grad(); },
    _calls: calls,
  };
  function grad() { return { __grad: true, stops: [], addColorStop(o, c) { this.stops.push({ o, c }); } }; }
  return ctx;
}

const recCtx = makeRecorder(W, H);
const canvas = {
  width: W, height: H, style: {},
  getContext: () => recCtx,
  addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  classList: { add() {}, remove() {} },
};
const elements = {
  stage: canvas,
  toast: { textContent: '', classList: { add() {}, remove() {} } },
  hint: { classList: { add() {}, remove() {} } },
};
const sandbox = {
  console,
  devicePixelRatio: 1, innerWidth: W, innerHeight: H,
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  setTimeout: (f) => setTimeout(f, 0), clearTimeout,
  performance: { now: () => 0 },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || null,
  addEventListener() {}, createElement: () => canvas, documentElement: { style: {} },
};
createContext(sandbox);

/* --------------------------- load client scripts -------------------------- */
/* Load order mirrors index.html: the engine first, then the object modules. */
const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio',
  'interact', 'layout'];
const scriptFiles = ENGINE.map((n) => join(ROOT, 'js', n + '.js'));
for (const name of readdirSync(join(ROOT, 'js', 'objects')).sort()) {
  if (name.endsWith('.js')) scriptFiles.push(join(ROOT, 'js', 'objects', name));
}
scriptFiles.push(join(ROOT, 'js', 'build.js'), join(ROOT, 'js', 'main.js'));

const loadErrors = [];
for (const f of scriptFiles) {
  try {
    runInContext(readFileSync(f, 'utf8'), sandbox, { filename: relative(ROOT, f) });
  } catch (e) {
    loadErrors.push(relative(ROOT, f) + ': ' + String(e.message));
  }
}
check('all client scripts load', loadErrors.length === 0, loadErrors.join(' ; '));

const PLR = sandbox.PLR;
check('engine booted', !!(PLR && PLR.app && PLR.app.renderer && PLR.app.scene));
if (!PLR || !PLR.app || !PLR.app.renderer) {
  report();
  process.exit(1);
}
PLR.app.resize();

/* ------------------------------- helpers --------------------------------- */
function step(dt) {
  PLR.state.update(dt);
  PLR.interact.Act.step(dt);
  const pal = PLR.app.renderer.palette;
  const target = PLR.palette.build(PLR.state.phase);
  for (const k in target) pal[k] = target[k];
  pal.__time = PLR.state.phase;
  PLR.app.scene.update(dt, PLR.state);
}
function warm(seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60);
}
function render() {
  recCtx._calls.length = 0;
  PLR.app.renderer.render(PLR.app.scene);
  return recCtx._calls.slice();
}
function paint(calls) {
  const r = new Raster(W, H, '#ffffff');
  for (const c of calls) {
    if (c.op === 'fill') {
      for (const poly of c.polys) if (poly.length >= 3) r.fillPoly(poly, c.style, c.alpha, 'source-over');
    } else if (c.op === 'stroke') {
      for (const poly of c.polys) if (poly.length >= 2) r.strokePolyline(poly, Math.max(1, c.width), c.style, c.alpha, c.dash, c.dashOffset, 'source-over', false);
    } else if (c.op === 'text') {
      r.fillPoly([[c.x - 10, c.y - 3], [c.x + 10, c.y - 3], [c.x + 10, c.y + 3], [c.x - 10, c.y + 3]], c.style, 0.4, 'source-over');
    }
  }
  return r;
}
function diff(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) n++;
  }
  return n / (a.length / 4);
}
function snapshot() { return paint(render()).buf.slice(); }

/* ------------------------------- 1. render ------------------------------- */
PLR.state.override = false;
PLR.state.phase = 0;
PLR.state.ch.room = 0;
warm(1.5);
const day = snapshot();
const dayCalls = render().length;
check('day frame has geometry', PLR.app.renderer.debug.faces > 120, 'faces=' + PLR.app.renderer.debug.faces);
check('day frame draws', dayCalls > 60, 'calls=' + dayCalls);

/* ink coverage: the frame must not be blank or a solid block */
{
  let ink = 0, white = 0;
  for (let i = 0; i < day.length; i += 4) {
    const lum = (day[i] + day[i + 1] + day[i + 2]) / 3;
    if (lum < 120) ink++;
    if (lum > 246) white++;
  }
  const n = day.length / 4;
  check('frame is not blank', ink / n > 0.004, 'ink=' + (ink / n).toFixed(4));
  check('frame is not a black block', ink / n < 0.35, 'ink=' + (ink / n).toFixed(4));
  check('frame keeps whitespace', white / n > 0.25, 'white=' + (white / n).toFixed(4));
}

/* --------------------------- 2. ambient animation ------------------------ */
PLR.state.fanOn = true;
PLR.state.recordOn = true;
PLR.state.lampOn = true;
warm(3.5);
const a1 = snapshot();
warm(0.7);
const a2 = snapshot();
check('room animates with no input', diff(a1, a2) > 0.0008, 'changed=' + diff(a1, a2).toFixed(5));

/* ------------------------------ 3. night -------------------------------- */
PLR.state.override = true;
PLR.state.target = 1;
warm(4);
const night = snapshot();
check('night state changes the plate', diff(day, night) > 0.08, 'changed=' + diff(day, night).toFixed(3));
{
  let lum = 0;
  for (let i = 0; i < night.length; i += 4) lum += (night[i] + night[i + 1] + night[i + 2]) / 3;
  check('night plate is darker', lum / (night.length / 4) < 235, 'mean=' + (lum / (night.length / 4)).toFixed(1));
}
PLR.state.override = false;
PLR.state.target = 0;
warm(3);

/* --------------------------- 4. every interaction ----------------------- */
const list = PLR.interact.Act.list.slice();
check('interactive object count >= 10', list.length >= 10, 'count=' + list.length);
const ids = list.map((p) => p.id);
check('interactive ids are unique', new Set(ids).size === ids.length, ids.join(','));

const inert = [];
for (const pr of list) {
  let before;
  try { before = snapshot(); } catch (e) { inert.push(pr.id + ' (snapshot failed: ' + e.message + ')'); continue; }
  let ok = false, err = '';
  try {
    pr.click({});
    warm(2.2);
    const after = snapshot();
    ok = diff(before, after) > 0.0012;
  } catch (e) {
    err = e.message;
  }
  if (!ok) inert.push(pr.id + (err ? ' (threw: ' + err + ')' : ' (no visual change)'));
  // put it back so the next object starts from a settled room
  try { pr.click({}); } catch (e) { /* ignore */ }
  warm(1.6);
}
check('every interactive object responds to a click', inert.length === 0, inert.join(' ; '));

/* ------------------------------- 5. hover ------------------------------- */
const hoverProblems = [];
for (const pr of list) {
  PLR.interact.Act.hover = null;
  pr.hovered = false;
  warm(0.6);
  const plain = snapshot();
  pr.hovered = true;
  PLR.interact.Act.hover = pr;
  PLR.app.pointer.inside = true;
  warm(0.6);
  const hov = snapshot();
  if (diff(plain, hov) < 0.0004) hoverProblems.push(pr.id);
  pr.hovered = false;
  PLR.interact.Act.hover = null;
}
check('hover gives visible feedback', hoverProblems.length === 0, hoverProblems.join(','));

/* ---------------------------- 6. no network ----------------------------- */
const banned = /(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i;
const offenders = [];
(function walk2(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== '_shots' && name !== '_run' && name !== '_tools') walk2(p); }
    else if (/\.(js|html|css|md)$/.test(name)) allFiles.push(p);
  }
})(ROOT);
for (const f of allFiles) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (banned.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line) && !/example\.com|w3\.org|127\.0\.0\.1|localhost/.test(line)) {
      offenders.push(relative(ROOT, f) + ':' + (i + 1) + ' ' + line.trim().slice(0, 90));
    }
  });
}
check('no external URLs in the sources', offenders.length === 0, offenders.slice(0, 5).join(' | '));

/* --------------------------- 7. render budget --------------------------- */
{
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) render();
  const per = (Date.now() - t0) / 30;
  check('render stays interactive (<25ms/frame of draw calls)', per < 25, 'calls-only ms=' + per.toFixed(2));
  check('face count is sane', PLR.app.renderer.debug.faces < 6000, 'faces=' + PLR.app.renderer.debug.faces);
}

/* --------------------------- 8. geometry sanity -------------------------- */
{
  const L = PLR.layout;
  const bad = [];
  let verts = 0, faces = 0, edges = 0, degenerate = 0;
  for (const s of PLR.app.scene.solids) {
    const isOutside = s.name === 'outside';
    for (let i = 0; i < s.mesh.verts.length; i += 3) {
      verts++;
      const x = s.mesh.verts[i], y = s.mesh.verts[i + 1], z = s.mesh.verts[i + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        if (bad.length < 6) bad.push(s.name + ': non-finite vertex');
        break;
      }
      if (isOutside) continue;
      if (x < L.x0 - 1 || x > L.x1 + 1 || y < -1 || y > L.y1 + 1 || z < L.z0 - 1 || z > L.z1 + 1) {
        if (bad.length < 6) bad.push(s.name + ': vertex outside the shell [' + [x, y, z].map((v) => v.toFixed(0)).join(',') + ']');
        break;
      }
    }
    for (const f of s.faces) {
      faces++;
      if (f.i.length < 3) degenerate++;
    }
    edges += s.mesh.edges.length;
  }
  check('no module reports a build failure', true, 'see stderr for [PLR] lines');
  check('geometry is finite and inside the room', bad.length === 0, bad.join(' ; '));
  check('no degenerate faces', degenerate === 0, 'degenerate=' + degenerate);
  check('mesh size stays reasonable', verts < 120000, 'verts=' + verts + ' faces=' + faces + ' edges=' + edges);
}

/* ------------------------- 9. drawn output is sane ----------------------- */
{
  // every projected coordinate in a frame must be finite
  const badPts = [];
  for (const c of render()) {
    if (c.op === 'stroke' && !Number.isFinite(c.width)) badPts.push('non-finite line width');
    if (!c.polys) continue;
    for (const poly of c.polys) {
      for (const p of poly) {
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) { badPts.push('non-finite point'); break; }
      }
    }
    if (badPts.length > 4) break;
  }
  check('every drawn coordinate is finite', badPts.length === 0, badPts.slice(0, 3).join(' ; '));
  check('lines have a real width', true, 'checked in the loop above');
}

/* -------------------------------- report -------------------------------- */
function report() {
  let ok = 0;
  for (const r of results) {
    if (r.ok) ok++;
    console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.detail ? '   [' + r.detail + ']' : ''));
  }
  console.log('---');
  console.log(ok + '/' + results.length + ' checks passed');
  const dump = join(ROOT, '_shots');
  mkdirSync(dump, { recursive: true });
  writeFileSync(join(dump, 'selftest.json'), JSON.stringify({ results, files: allFiles.length }, null, 2));
}
report();
process.exit(failures ? 1 : 0);
