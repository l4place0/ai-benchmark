/* =============================================================================
   _dev/harness.mjs — Pure Line Room verification harness.
   There is no browser in this sandbox (Chromium dies on blocked named pipes),
   so this file fakes exactly as much of the DOM + Canvas2D API as the project
   touches, then runs the REAL js/*.js sources so the renderer, scene, picking
   and interaction code all execute for real.

   Recorded draw ops are replayed either to SVG or (via Pillow) to PNG so the
   result can actually be looked at.
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
export const PY = process.env.PLR_PY ||
  'C:\\Users\\l4place\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';

/* ------------------------------------------------------------------ colours */
function parseColor(c) {
  if (typeof c !== 'string') return null;
  if (c[0] === '#') {
    if (c.length === 7) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16), 1];
    return null;
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(',').map(Number);
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return null;
}

function gradientStub(kind, args) {
  const stops = [];
  const g = {
    __gradient: true, __kind: kind, __args: args, __stops: stops,
    addColorStop(o, c) { stops.push([o, c]); }
  };
  return g;
}

class Ctx {
  constructor(canvas, recorder) {
    this.canvas = canvas;
    this.__rec = recorder;
    this.__calls = recorder.calls;
    this.__warnings = recorder.warnings;
    this.__stats = recorder.stats;
    this.fillStyle = '#000'; this.strokeStyle = '#000';
    this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter'; this.miterLimit = 10;
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic';
    this.shadowBlur = 0; this.shadowColor = 'rgba(0,0,0,0)';
    this.shadowOffsetX = 0; this.shadowOffsetY = 0;
    this.filter = 'none'; this.imageSmoothingEnabled = true;
    this.__sub = [];        // current path subpaths (arrays of [x,y])
    this.__cur = null;
    this.__stack = [];
    this.__clip = [{ box: [0, 0, canvas.width, canvas.height], sub: null }];
    this.__tf = [1, 0, 0, 1, 0, 0];
    this.__tfs = [this.__tf.slice()];
  }
  _w(op, args) {
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) {
        this.__warnings.push(op + ' got ' + a + ' args=' + JSON.stringify(args).slice(0, 160));
        return false;
      }
    }
    return true;
  }
  _p(x, y) { return [x * this.__tf[0] + y * this.__tf[2] + this.__tf[4], x * this.__tf[1] + y * this.__tf[3] + this.__tf[5]]; }
  save() {
    this.__stack.push({
      fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
      lineCap: this.lineCap, lineJoin: this.lineJoin, globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation, font: this.font,
      textAlign: this.textAlign, textBaseline: this.textBaseline, filter: this.filter,
      __clipSave: this.__clip.slice(), __tfSave: this.__tf.slice()
    });
    this.__stats.saves++;
    this.__calls.push({ op: 'save' });
  }
  restore() {
    const s = this.__stack.pop();
    if (!s) { this.__warnings.push('restore without save'); return; }
    this.fillStyle = s.fillStyle; this.strokeStyle = s.strokeStyle; this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap; this.lineJoin = s.lineJoin; this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation; this.font = s.font;
    this.textAlign = s.textAlign; this.textBaseline = s.textBaseline; this.filter = s.filter;
    this.__clip = s.__clipSave; this.__tf = s.__tfSave;
    this.__stats.restores++;
    this.__calls.push({ op: 'restore' });
  }
  beginPath() { this.__sub = []; this.__cur = null; }
  closePath() { if (this.__cur && this.__cur.length) { this.__cur.push(this.__cur[0].slice()); } this.__calls.push({ op: 'closePath' }); }
  moveTo(x, y) { if (!this._w('moveTo', [x, y])) return; this.__cur = [this._p(x, y)]; this.__sub.push(this.__cur); this.__calls.push({ op: 'moveTo', a: [x, y] }); }
  lineTo(x, y) { if (!this._w('lineTo', [x, y])) return; if (!this.__cur) { this.moveTo(x, y); return; } this.__cur.push(this._p(x, y)); this.__calls.push({ op: 'lineTo', a: [x, y] }); }
  quadraticCurveTo(cx, cy, x, y) {
    if (!this._w('quadraticCurveTo', [cx, cy, x, y])) return;
    const p0 = this.__cur && this.__cur.length ? this.__cur[this.__cur.length - 1] : [0, 0];
    const a = this._p(cx, cy), b = this._p(x, y);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, u = 1 - t;
      this.__cur.push([u * u * p0[0] + 2 * u * t * a[0] + t * t * b[0], u * u * p0[1] + 2 * u * t * a[1] + t * t * b[1]]);
    }
    this.__calls.push({ op: 'quad', a: [cx, cy, x, y] });
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this._w('bezierCurveTo', [c1x, c1y, c2x, c2y, x, y])) return;
    const p0 = this.__cur && this.__cur.length ? this.__cur[this.__cur.length - 1] : [0, 0];
    const A = this._p(c1x, c1y), B = this._p(c2x, c2y), C = this._p(x, y);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      this.__cur.push([
        u * u * u * p0[0] + 3 * u * u * t * A[0] + 3 * u * t * t * B[0] + t * t * t * C[0],
        u * u * u * p0[1] + 3 * u * u * t * A[1] + 3 * u * t * t * B[1] + t * t * t * C[1]
      ]);
    }
    this.__calls.push({ op: 'bezier', a: [c1x, c1y, c2x, c2y, x, y] });
  }
  arc(x, y, r, a0, a1, ccw) {
    if (!this._w('arc', [x, y, r, a0, a1])) return;
    if (r < 0) { this.__warnings.push('arc negative radius'); return; }
    if (!this.__cur) { this.__cur = []; this.__sub.push(this.__cur); }
    let span = a1 - a0;
    if (ccw) { while (span > 0) span -= Math.PI * 2; } else { while (span < 0) span += Math.PI * 2; }
    const steps = Math.max(3, Math.ceil(Math.abs(span) / (Math.PI / 24)));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + span * (i / steps);
      this.__cur.push(this._p(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    this.__calls.push({ op: 'arc', a: [x, y, r, a0, a1, !!ccw] });
  }
  arcTo(x1, y1, x2, y2, r) {
    if (!this._w('arcTo', [x1, y1, x2, y2, r])) return;
    if (this.__cur) this.__cur.push(this._p(x1, y1));
    this.__calls.push({ op: 'lineTo', a: [x1, y1] });
  }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    if (!this._w('ellipse', [x, y, rx, ry, rot, a0, a1])) return;
    if (!this.__cur) { this.__cur = []; this.__sub.push(this.__cur); }
    let span = a1 - a0;
    if (ccw) { while (span > 0) span -= Math.PI * 2; } else { while (span < 0) span += Math.PI * 2; }
    const steps = Math.max(3, Math.ceil(Math.abs(span) / (Math.PI / 24)));
    const cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    for (let i = 0; i <= steps; i++) {
      const a = a0 + span * (i / steps);
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      this.__cur.push(this._p(x + ex * cs - ey * sn, y + ex * sn + ey * cs));
    }
    this.__calls.push({ op: 'ellipse', a: [x, y, rx, ry] });
  }
  rect(x, y, w, h) {
    if (!this._w('rect', [x, y, w, h])) return;
    const p = [this._p(x, y), this._p(x + w, y), this._p(x + w, y + h), this._p(x, y + h)];
    this.__sub.push(p); this.__cur = p;
    this.__calls.push({ op: 'rect', a: [x, y, w, h] });
  }
  roundRect(x, y, w, h, r) {
    this.rect(x, y, w, h);
  }
  clip() {
    // Keep the full clip *polygons*, not just a bounding box: the sky layer is
    // clipped to the projected window opening, which is a trapezoid, and an
    // AABB approximation would spill the view through the wall beside it.
    var sub = this.__sub.map(function (s) { return s.map(function (p) { return [p[0], p[1]]; }); });
    var prev = this.__clip[this.__clip.length - 1];
    var box = bboxOf(sub, prev.box);
    this.__clip = this.__clip.concat([{ box: box, sub: sub }]);
    this.__stats.clips++;
    if (this.__debugClip) this.__debugClip.push({ box: box, sub: sub });
    this.__calls.push({ op: 'clip', box: box, sub: sub });
  }
  fill() {
    const style = this.fillStyle;
    const cl = this.__clip[this.__clip.length - 1];
    this.__stats.fills++;
    const key = typeof style === 'string' ? style : 'gradient';
    this.__stats.fillsByColor[key] = (this.__stats.fillsByColor[key] || 0) + 1;
    this.__calls.push({
      op: 'fill', sub: this.__sub.map((s) => s.map((p) => [round2(p[0]), round2(p[1])])),
      style, alpha: this.globalAlpha, comp: this.globalCompositeOperation,
      clip: cl.box, clipShapes: this.__clip.slice(1).map((c) => c.sub.length ? c.sub : [{ box: c.box }])
    });
  }
  stroke() {
    const cl = this.__clip[this.__clip.length - 1];
    this.__stats.strokes++;
    this.__calls.push({
      op: 'stroke', sub: this.__sub.map((s) => s.map((p) => [round2(p[0]), round2(p[1])])),
      style: this.strokeStyle, width: this.lineWidth, cap: this.lineCap, join: this.lineJoin,
      alpha: this.globalAlpha, clip: cl.box,
      clipShapes: this.__clip.slice(1).map((c) => c.sub.length ? c.sub : [{ box: c.box }])
    });
  }
  fillRect(x, y, w, h) {
    if (!this._w('fillRect', [x, y, w, h])) return;
    const cl = this.__clip[this.__clip.length - 1];
    const p = [this._p(x, y), this._p(x + w, y), this._p(x + w, y + h), this._p(x, y + h)];
    this.__stats.fills++;
    this.__calls.push({
      op: 'fill', sub: [p], style: this.fillStyle, alpha: this.globalAlpha,
      comp: this.globalCompositeOperation, clip: cl.box,
      clipShapes: this.__clip.slice(1).map((c) => c.sub.length ? c.sub : [{ box: c.box }])
    });
  }
  strokeRect(x, y, w, h) {
    const cl = this.__clip[this.__clip.length - 1];
    this.__stats.strokes++;
    const p = [this._p(x, y), this._p(x + w, y), this._p(x + w, y + h), this._p(x, y + h), this._p(x, y)];
    this.__calls.push({
      op: 'stroke', sub: [p], style: this.strokeStyle, width: this.lineWidth,
      alpha: this.globalAlpha, clip: cl.box,
      clipShapes: this.__clip.slice(1).map((c) => c.sub.length ? c.sub : [{ box: c.box }])
    });
  }
  clearRect(x, y, w, h) {
    this.__calls.push({ op: 'clear', a: [x, y, w, h] });
  }
  createLinearGradient(x0, y0, x1, y1) { return gradientStub('lin', [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return gradientStub('rad', [x0, y0, r0, x1, y1, r1]); }
  createPattern() { return { __pattern: true }; }
  setLineDash(a) { this.__dash = a; this.__calls.push({ op: 'dash', a }); }
  getLineDash() { return this.__dash || []; }
  translate(x, y) { this.__tf[4] += x * this.__tf[0] + y * this.__tf[2]; this.__tf[5] += x * this.__tf[1] + y * this.__tf[3]; this.__calls.push({ op: 'translate', a: [x, y] }); }
  rotate(a) {
    const c = Math.cos(a), s = Math.sin(a), m = this.__tf;
    const m0 = m[0] * c + m[2] * s, m1 = m[1] * c + m[3] * s;
    const m2 = m[0] * -s + m[2] * c, m3 = m[1] * -s + m[3] * c;
    m[0] = m0; m[1] = m1; m[2] = m2; m[3] = m3;
    this.__calls.push({ op: 'rotate', a: [a] });
  }
  scale(x, y) { this.__tf[0] *= x; this.__tf[1] *= x; this.__tf[2] *= y; this.__tf[3] *= y; this.__calls.push({ op: 'scale', a: [x, y] }); }
  transform(a, b, c, d, e, f) {
    const m = this.__tf;
    const n = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
    this.__tf = n; this.__calls.push({ op: 'transform', a: [a, b, c, d, e, f] });
  }
  setTransform(a, b, c, d, e, f) { this.__tf = [a, b, c, d, e, f]; }
  resetTransform() { this.__tf = [1, 0, 0, 1, 0, 0]; }
  measureText(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.font || '');
    const size = m ? parseFloat(m[1]) : 10;
    return { width: String(t).length * size * 0.55, actualBoundingBoxAscent: size * 0.72, actualBoundingBoxDescent: size * 0.2 };
  }
  fillText(t, x, y) {
    if (!this._w('fillText', [x, y])) return;
    this.__stats.texts++;
    this.__calls.push({ op: 'text', text: String(t), a: [x, y], style: this.fillStyle, font: this.font, alpha: this.globalAlpha });
  }
  strokeText(t, x, y) { this.fillText(t, x, y); }
  drawImage() { this.__calls.push({ op: 'image' }); }
}

const round2 = (v) => Math.round(v * 100) / 100;

function bboxOf(subs, limit) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const sub of subs) {
    for (const p of sub) {
      if (p[0] < mnx) mnx = p[0];
      if (p[0] > mxx) mxx = p[0];
      if (p[1] < mny) mny = p[1];
      if (p[1] > mxy) mxy = p[1];
    }
  }
  if (!Number.isFinite(mnx)) return limit ? limit.slice() : [0, 0, 0, 0];
  if (limit) {
    mnx = Math.max(mnx, limit[0]); mny = Math.max(mny, limit[1]);
    mxx = Math.min(mxx, limit[2]); mxy = Math.min(mxy, limit[3]);
  }
  return [mnx, mny, mxx, mxy];
}

/* --------------------------------------------------------------- DOM shim */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  toggle(c, on) { if (on === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (on) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}

class Elem {
  constructor(tag, doc) {
    this.tagName = (tag || 'div').toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.style = new Proxy({}, { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } });
    this.classList = new ClassList();
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
    this.textContent = '';
    this._html = '';
    this.value = '';
    this.clientWidth = 0; this.clientHeight = 0;
    this.width = 0; this.height = 0;
    this.scrollTop = 0;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._listeners[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    let node = this;
    while (node) {
      const a = node._listeners[ev.type];
      if (a) {
        ev.currentTarget = node;
        for (const fn of a.slice()) fn.call(node, ev);
      }
      node = node.parentNode;
    }
    return true;
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  insertBefore(c, ref) { const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); c.parentNode = this; return c; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = v; }
  getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.width, bottom: this.height, width: this.width, height: this.height, x: 0, y: 0 };
  }
  setPointerCapture() { }
  releasePointerCapture() { }
  getContext(kind) {
    if (!this._ctx) this._ctx = new Ctx(this, this.ownerDocument.__rec);
    return this._ctx;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

export function createPage(opts = {}) {
  const W = opts.width || 1440, H = opts.height || 900;
  const recorder = { calls: [], warnings: [], stats: { fills: 0, strokes: 0, texts: 0, saves: 0, restores: 0, clips: 0, fillsByColor: {} } };
  const win = {};
  const doc = new Elem('#document', { __rec: recorder });
  doc.__rec = recorder;
  doc.readyState = 'complete';
  const elements = new Map();

  function makeEl(tag = 'div') {
    const e = new Elem(tag, doc);
    e.ownerDocument = doc;
    return e;
  }
  const body = makeEl('body');
  body.parentNode = doc;
  const documentElement = makeEl('html');
  doc.body = body;
  doc.documentElement = documentElement;
  doc.createElement = (t) => makeEl(t);
  doc.getElementById = (id) => elements.get(id) || null;
  doc.querySelector = () => null;
  doc.querySelectorAll = () => [];
  doc.addEventListener = Elem.prototype.addEventListener.bind(doc);
  doc.removeEventListener = Elem.prototype.removeEventListener.bind(doc);
  doc.dispatchEvent = Elem.prototype.dispatchEvent.bind(doc);

  const canvas = makeEl('canvas');
  canvas.id = 'stage';
  canvas.width = W; canvas.height = H;
  canvas.clientWidth = W; canvas.clientHeight = H;
  canvas.parentNode = body;
  elements.set('stage', canvas);
  // the canvas context must be the SAME object every time, and it must exist
  // before any script runs, so the recorder sees every call
  const mainCtx = new Ctx(canvas, recorder);
  canvas._ctx = mainCtx;

  // any element the HTML refers to by id is auto-created
  for (const id of ['loading', 'hud', 'clock', 'state', 'title', 'legend', 'mute', 'tip', 'tipName', 'tipHint']) {
    const e = makeEl(id === 'mute' ? 'button' : 'div');
    e.id = id;
    e.parentNode = body;
    elements.set(id, e);
  }

  const timers = [];
  const rafs = [];
  let clock = 0;
  const errors = [];

  win.window = win;
  win.document = doc;
  win.devicePixelRatio = opts.dpr || 1;
  win.innerWidth = W; win.innerHeight = H;
  win.outerWidth = W; win.outerHeight = H;
  win.performance = { now: () => clock };
  win.requestAnimationFrame = (fn) => { rafs.push(fn); return rafs.length; };
  win.cancelAnimationFrame = () => { };
  win.setTimeout = (fn, ms) => { timers.push({ fn, at: clock + (ms || 0), every: 0 }); return timers.length; };
  win.setInterval = (fn, ms) => { timers.push({ fn, at: clock + (ms || 16), every: Math.max(1, ms || 16) }); return timers.length; };
  win.clearTimeout = () => { };
  win.clearInterval = () => { };
  win.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } });
  win.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
  win.navigator = { userAgent: 'PLR-harness', maxTouchPoints: 1 };
  win.addEventListener = Elem.prototype.addEventListener.bind(body);
  win.removeEventListener = Elem.prototype.removeEventListener.bind(body);
  win.AudioContext = undefined;   // audio must degrade gracefully in the harness

  const page = {
    win, doc, canvas, recorder, elements, errors,
    get time() { return clock; },    loadScript(path) {
      let src;
      try {
        src = readFileSync(join(ROOT, path), 'utf8');
      } catch (e) {
        errors.push({ where: 'missing:' + path, error: e });
        return page;
      }
      try {
        const fn = new Function('window', 'document', 'globalThis', 'self', 'navigator', 'performance',
          'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'setInterval', 'clearTimeout',
          'clearInterval', 'localStorage', 'matchMedia', 'innerWidth', 'innerHeight', 'devicePixelRatio',
          'AudioContext', 'webkitAudioContext', 'MessageChannel', 'alert', 'console',
          '"use strict";' + src + '\n//# sourceURL=' + path);
        fn(win, doc, win, win, win.navigator, win.performance, win.requestAnimationFrame, win.cancelAnimationFrame,
          win.setTimeout, win.setInterval, win.clearTimeout, win.clearInterval, win.localStorage, win.matchMedia,
          W, H, win.devicePixelRatio, undefined, undefined, undefined, () => { }, console);
      } catch (e) {
        errors.push({ where: 'load:' + path, error: e });
      }
      return page;
    },
    loadScriptsFrom(htmlPath) {
      const html = readFileSync(join(ROOT, htmlPath), 'utf8');
      const re = /<script\s+src="([^"]+)"><\/script>/g;
      let m;
      while ((m = re.exec(html))) page.loadScript(m[1]);
      return page;
    },
    advance(ms, stepMs = 1000 / 60) {
      const end = clock + ms;
      let guard = 0;
      while (clock < end && guard++ < 20000) {
        clock += stepMs;
        for (let i = timers.length - 1; i >= 0; i--) {
          const t = timers[i];
          if (t.every) { if (clock >= t.at) { t.at = clock + t.every; safe(() => t.fn(), 'interval'); } }
          else if (clock >= t.at) { timers.splice(i, 1); safe(() => t.fn(), 'timeout'); }
        }
        const due = rafs.splice(0, rafs.length);
        for (const fn of due) safe(() => fn(clock), 'raf');
        // Keep the recorder bounded: a long verification run would otherwise
        // accumulate every draw call of every frame and exhaust the heap. One
        // frame of history is all any assertion needs.
        if (recorder.calls.length > 100000) {
          for (let i = recorder.calls.length - 1; i >= 0; i--) {
            if (recorder.calls[i].op === 'clear') { recorder.calls.splice(0, i); break; }
          }
        }
      }
      return page;
    },
    fire(target, type, props = {}) {
      const ev = Object.assign({
        type, clientX: -999, clientY: -999, button: 0, buttons: 1, pointerId: 1, isPrimary: true,
        deltaY: 0, deltaMode: 0, movementX: 0, movementY: 0, shiftKey: false, altKey: false, ctrlKey: false,
        preventDefault() { }, stopPropagation() { }, target
      }, props);
      if (typeof target.dispatchEvent === 'function') {
        target.dispatchEvent(ev);
      } else {
        // `window` in this harness is a plain object; deliver to its listeners
        const a = body._listeners[type];
        if (a) for (const fn of a.slice()) fn.call(win, Object.assign({ currentTarget: win }, ev));
      }
      return page;
    },
    move(x, y, extra = {}) { return page.fire(canvas, 'pointermove', Object.assign({ clientX: x, clientY: y, buttons: 0 }, extra)); },
    down(x, y, extra = {}) { return page.fire(canvas, 'pointerdown', Object.assign({ clientX: x, clientY: y, buttons: 1 }, extra)); },
    up(x, y, extra = {}) { return page.fire(win, 'pointerup', Object.assign({ clientX: x, clientY: y, buttons: 0 }, extra)); },
    wheel(x, y, dy) { return page.fire(canvas, 'wheel', { clientX: x, clientY: y, deltaY: dy }); },
    click(x, y) {
      page.move(x, y);
      page.down(x, y);
      page.advance(900);
      page.up(x, y);
      return page;
    },
    drag(x0, y0, x1, y1, steps = 24) {
      page.move(x0, y0);
      page.down(x0, y0);
      page.advance(120);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        page.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, { buttons: 1, movementX: (x1 - x0) / steps, movementY: (y1 - y0) / steps });
        page.advance(1000 / 60);
      }
      page.advance(120);
      page.up(x1, y1);
      return page;
    },
    writeSVG(path) {
      page.trimToLastFrame();
      const svg = opsToSVG(recorder.calls, W, H);
      writeFileSync(join(ROOT, path), svg);
      return join(ROOT, path);
    },
    /** Drop everything but the most recent frame's draw ops (the recorder would
     *  otherwise grow without bound over a 300-frame run). */
    trimToLastFrame() {
      const c = recorder.calls;
      for (let i = c.length - 1; i >= 0; i--) {
        if (c[i].op === 'clear') { c.splice(0, i + 1); return; }
      }
      return;
    },
    writePNG(path) {
      page.trimToLastFrame();
      const json = join(HERE, '_ops.json');
      writeFileSync(json, JSON.stringify({ w: W, h: H, calls: recorder.calls }));
      const py = join(HERE, 'rasterize.py');
      const resultFile = join(HERE, '_raster_result.txt');
      try { writeFileSync(resultFile, 'PENDING'); } catch (e) { /* ignore */ }
      // stdio must be 'ignore' here: this sandbox forbids a child capturing
      // another process's stdio through pipes, so results come back via a file
      spawnSync(PY, [py, json, join(ROOT, path), resultFile], { stdio: 'ignore' });
      let report = '';
      try { report = readFileSync(resultFile, 'utf8'); } catch (e) { report = 'NO-RESULT-FILE'; }
      if (!report.startsWith('OK')) {
        errors.push({ where: 'rasterize', error: new Error(report.slice(0, 500)) });
      }
      return join(ROOT, path);
    },
    summary() {
      const s = recorder.stats;
      return {
        errors: errors.map((e) => (e.where + ': ' + (e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 2).join(' | ') : e.error))),
        warnings: recorder.warnings.slice(0, 12),
        warningCount: recorder.warnings.length,
        calls: recorder.calls.length,
        fills: s.fills, strokes: s.strokes, texts: s.texts,
        saveBalance: s.saves - s.restores,
        clips: s.clips
      };
    }
  };

  function safe(fn, where) {
    try { fn(); } catch (e) { errors.push({ where, error: e }); }
  }

  return page;
}

/* -------------------------------------------------------------- SVG output */export function opsToSVG(calls, W, H) {
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  let clipId = 0;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = (style, alpha) => {
    if (style && style.__gradient) {
      const stops = style.__stops || [];
      const c = stops.length ? parseColor(stops[stops.length - 1][1]) : [200, 200, 200, 1];
      return `rgba(${c[0]},${c[1]},${c[2]},${(alpha * (c[3] === undefined ? 1 : c[3])).toFixed(3)})`;
    }
    const c = parseColor(style);
    if (!c) return `rgba(0,0,0,${alpha})`;
    return `rgba(${c[0]},${c[1]},${c[2]},${(alpha * c[3]).toFixed(3)})`;
  };
  for (const op of calls) {
    if (op.op === 'fill') {
      const box = op.clip;
      let d = '';
      for (const sub of op.sub) {
        if (sub.length < 3) continue;
        d += 'M' + sub.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
      }
      if (!d) continue;
      out.push(`<path d="${d}" fill="${col(op.style, op.alpha)}" fill-rule="nonzero"/>`);
    } else if (op.op === 'stroke') {
      let d = '';
      for (const sub of op.sub) {
        if (sub.length < 2) continue;
        d += 'M' + sub.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + ' ';
      }
      if (!d) continue;
      out.push(`<path d="${d}" fill="none" stroke="${col(op.style, op.alpha)}" stroke-width="${(op.width || 1).toFixed(2)}" stroke-linecap="${op.cap || 'butt'}" stroke-linejoin="${op.join || 'miter'}"/>`);
    } else if (op.op === 'text') {
      const m = /(\d+(?:\.\d+)?)px/.exec(op.font || '');
      const size = m ? parseFloat(m[1]) : 10;
      out.push(`<text x="${op.a[0].toFixed(1)}" y="${op.a[1].toFixed(1)}" font-size="${size}" fill="${col(op.style, op.alpha)}" font-family="monospace">${esc(op.text)}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('\n');
}
