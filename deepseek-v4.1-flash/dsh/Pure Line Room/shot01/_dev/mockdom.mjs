/* =============================================================================
   mockdom.mjs — a browser substitute for verifying Canvas-2D pages headlessly.

   WHY THIS EXISTS
   ---------------
   Chromium cannot start in this sandbox (named pipes are blocked), so there is
   no real browser to run the page in. This module fakes just enough of the DOM
   + Canvas-2D API that an ordinary classic-script Canvas project runs, and it
   RECORDS every 2D drawing call so the frame can be replayed into an SVG or a
   PNG (via Python/Pillow) for human inspection.

   USAGE
   -----
     import { createPage } from './mockdom.mjs';
     const page = createPage({ width: 1440, height: 900, devicePixelRatio: 1 });
     page.loadHtml('index.html');
     page.loadScriptsInOrder('index.html');       // classic <script src> in order
     page.advance(180 * 1000 / 60);               // 180 rAF frames, virtual clock
     page.click(720, 450);                         // synthetic input
     const pngPath = page.renderToPNG({ width: 1440, height: 900, path: '_dev/shot.png' });
     const svgPath = page.renderToSVG({ width: 1440, height: 900, path: '_dev/shot.svg' });
     // both return the file path; richer metadata is on page.lastRenderPNG / lastRenderSVG

   FIDELITY / LIMITATIONS (read before trusting a result)
   -----------------------------------------------------
   * Scripts share ONE realm per page (node:vm context) and run as classic
     scripts, so top-level `var`/`function` become globals and `window` IS
     `globalThis` inside the page — matching a browser for classic scripts.
     ES modules are NOT supported (recorded as a page note, skipped).
   * The clock is virtual. `performance.now()`, `Date.now()` and the rAF
     timestamp all come from it. `new Date()` still uses real time.
   * DOM: a regex/stack tokenizer builds a parent/child tree (enough for event
     bubbling and querySelector). There is no layout engine: getBoundingClientRect
     returns the element's declared box (canvas = its bitmap size, origins at 0,0).
   * `innerHTML` is stored, never parsed. Reading it returns the raw source slice
     captured at parse time.
   * Canvas-2D: geometry is baked to device space with the CTM at the moment the
     path point is added (real canvas semantics). `fill`/`stroke` snapshot the
     resolved path + the style in effect. Gradients/patterns are approximated
     (all stops kept; first/last stop when only two colors are available).
   * measureText() is a deterministic estimate: width = len * fontSize * 0.55.
   * SVG/PNG output is geometrically faithful, not pixel-identical: shadows are
     approximated, `filter` is ignored, drawImage is a placeholder box, and
     `clearRect` paints the background color.
   * Only the LAST animation frame is replayed by default (`frame: 'last'`),
     so an animation shows its final state rather than every frame overlaid.

   All three output modes are deterministic: same page + same frame count =>
   same bytes (no wall-clock, no randomness in the harness).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const VERSION = '1.0.0';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ utils */

function isFin(n) { return typeof n === 'number' && Number.isFinite(n); }

/** Round to 2 decimals for output, normalising -0. */
function r2(n) {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
}

function mod2pi(a) { const t = a % TAU; return t < 0 ? t + TAU : t; }

function camel(s) { return String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function hyphen(s) { return String(s).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()); }

function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cloneSubpaths(sps) {
  const out = [];
  for (const sp of sps) {
    const pts = new Array(sp.pts.length);
    for (let i = 0; i < sp.pts.length; i++) pts[i] = [sp.pts[i][0], sp.pts[i][1]];
    out.push({ pts, closed: !!sp.closed, kind: sp.kind || 'poly' });
  }
  return out;
}

function bboxOfSubpaths(sps) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (const sp of sps) {
    for (const p of sp.pts) {
      n++;
      if (p[0] < x0) x0 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0];
      if (p[1] > y1) y1 = p[1];
    }
  }
  if (!n) return { x: 0, y: 0, w: 0, h: 0, empty: true };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, empty: false };
}

function intersectBox(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w), bt = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, bt - y) };
}

/* ----------------------------------------------------------------- colors */

const NAMED_COLORS = {
  transparent: [0, 0, 0, 0], black: [0, 0, 0, 1], silver: [192, 192, 192, 1],
  gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], white: [255, 255, 255, 1],
  maroon: [128, 0, 0, 1], red: [255, 0, 0, 1], purple: [128, 0, 128, 1],
  fuchsia: [255, 0, 255, 1], magenta: [255, 0, 255, 1], green: [0, 128, 0, 1],
  lime: [0, 255, 0, 1], olive: [128, 128, 0, 1], yellow: [255, 255, 0, 1],
  navy: [0, 0, 128, 1], blue: [0, 0, 255, 1], teal: [0, 128, 128, 1],
  aqua: [0, 255, 255, 1], cyan: [0, 255, 255, 1], orange: [255, 165, 0, 1],
  pink: [255, 192, 203, 1], brown: [165, 42, 42, 1], gold: [255, 215, 0, 1],
  indigo: [75, 0, 130, 1], violet: [238, 130, 238, 1], darkgray: [169, 169, 169, 1],
  darkgrey: [169, 169, 169, 1], lightgray: [211, 211, 211, 1],
  lightgrey: [211, 211, 211, 1], dimgray: [105, 105, 105, 1],
  dimgrey: [105, 105, 105, 1], slategray: [112, 128, 144, 1],
  slategrey: [112, 128, 144, 1], whitesmoke: [245, 245, 245, 1],
  gainsboro: [220, 220, 220, 1], beige: [245, 245, 220, 1], ivory: [255, 255, 240, 1],
  khaki: [240, 230, 140, 1], salmon: [250, 128, 114, 1], tomato: [255, 99, 71, 1],
  coral: [255, 127, 80, 1], crimson: [220, 20, 60, 1], turquoise: [64, 224, 208, 1],
  skyblue: [135, 206, 235, 1], steelblue: [70, 130, 180, 1],
  royalblue: [65, 105, 225, 1], midnightblue: [25, 25, 112, 1],
  seagreen: [46, 139, 87, 1], forestgreen: [34, 139, 34, 1],
  darkgreen: [0, 100, 0, 1], darkblue: [0, 0, 139, 1], darkred: [139, 0, 0, 1],
  saddlebrown: [139, 69, 19, 1], sienna: [160, 82, 45, 1], peru: [205, 133, 63, 1],
  tan: [210, 180, 140, 1], wheat: [245, 222, 179, 1], plum: [221, 160, 221, 1],
  orchid: [218, 112, 214, 1], lavender: [230, 230, 250, 1], azure: [240, 255, 255, 1],
  mintcream: [245, 255, 250, 1], honeydew: [240, 255, 240, 1],
};

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Parse a CSS color into [r,g,b,a] (a in 0..1).
 * Returns null when the string is not understood (caller decides how to warn).
 */
export function parseColor(input) {
  if (Array.isArray(input) && input.length >= 3) {
    return [input[0] | 0, input[1] | 0, input[2] | 0, input.length > 3 ? Number(input[3]) : 1];
  }
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, s)) return NAMED_COLORS[s].slice();

  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    const dup = (c) => parseInt(c + c, 16);
    if (h.length === 3 || h.length === 4) {
      return [dup(h[0]), dup(h[1]), dup(h[2]), h.length === 4 ? dup(h[3]) / 255 : 1];
    }
    if (h.length === 6 || h.length === 8) {
      const n = (i) => parseInt(h.substr(i, 2), 16);
      return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
    }
    return null;
  }

  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter((x) => x !== '');
    if (parts.length < 3) return null;
    const chan = (t) => {
      if (t.endsWith('%')) return Math.round(parseFloat(t) / 100 * 255);
      return Math.round(parseFloat(t));
    };
    const a = parts.length > 3
      ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
      : 1;
    const out = [chan(parts[0]), chan(parts[1]), chan(parts[2]), a];
    if (out.some((v) => !Number.isFinite(v))) return null;
    return [Math.max(0, Math.min(255, out[0])), Math.max(0, Math.min(255, out[1])),
      Math.max(0, Math.min(255, out[2])), Math.max(0, Math.min(1, out[3]))];
  }

  m = /^hsla?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter((x) => x !== '');
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]);
    const sat = parseFloat(parts[1]) / 100;
    const li = parseFloat(parts[2]) / 100;
    const a = parts.length > 3
      ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
      : 1;
    if (![h, sat, li, a].every(Number.isFinite)) return null;
    const rgb = hslToRgb(h, Math.max(0, Math.min(1, sat)), Math.max(0, Math.min(1, li)));
    return [rgb[0], rgb[1], rgb[2], Math.max(0, Math.min(1, a))];
  }
  return null;
}

function rgbaToCss(c) {
  const rr = Math.max(0, Math.min(255, Math.round(c[0])));
  const gg = Math.max(0, Math.min(255, Math.round(c[1])));
  const bb = Math.max(0, Math.min(255, Math.round(c[2])));
  return `rgb(${rr},${gg},${bb})`;
}

/* ------------------------------------------------------------------ style */

/**
 * A CSSStyleDeclaration stand-in: a plain object with a proxy-ish setter that
 * accepts anything and reads back '' for unknown properties (like the real one).
 */
function makeStyle() {
  const store = new Map();
  const target = {
    setProperty(name, value) {
      const k = String(name);
      store.set(k, String(value));
      target[camel(k)] = String(value);
      return undefined;
    },
    removeProperty(name) {
      const k = String(name);
      const prev = store.get(k) === undefined ? '' : store.get(k);
      store.delete(k);
      delete target[camel(k)];
      return prev;
    },
    getPropertyValue(name) {
      const v = store.get(String(name));
      return v === undefined ? '' : v;
    },
    getPropertyPriority() { return ''; },
    item(i) { return [...store.keys()][i] || ''; },
    get length() { return store.size; },
    get cssText() {
      return [...store.entries()].map(([k, v]) => `${k}: ${v}`).join('; ');
    },
    set cssText(text) {
      store.clear();
      for (const decl of String(text).split(';')) {
        const i = decl.indexOf(':');
        if (i < 0) continue;
        const k = decl.slice(0, i).trim();
        const v = decl.slice(i + 1).trim();
        if (k) { store.set(k, v); target[camel(k)] = v; }
      }
    },
  };
  return new Proxy(target, {
    get(t, p) {
      if (typeof p === 'symbol') return t[p];
      if (p in t) return t[p];
      const v = store.get(String(p));
      return v === undefined ? '' : v;
    },
    set(t, p, v) {
      if (typeof p === 'symbol') { t[p] = v; return true; }
      store.set(String(p), String(v));
      return true;
    },
    has(t, p) { return typeof p === 'symbol' ? p in t : true; },
    deleteProperty(t, p) {
      if (typeof p !== 'symbol') store.delete(String(p));
      return true;
    },
    ownKeys() { return [...store.keys()]; },
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === 'symbol') return undefined;
      return { value: store.get(String(p)) === undefined ? '' : store.get(String(p)), enumerable: true, configurable: true, writable: true };
    },
  });
}

/* ----------------------------------------------------------------- events */

class MockEvent {
  constructor(type, opts = {}) {
    this.type = String(type);
    this.bubbles = opts.bubbles !== false;
    this.cancelable = opts.cancelable !== false;
    this.composed = true;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.srcElement = null;
    this.eventPhase = 0;
    this.isTrusted = true;
    this.timeStamp = 0;
    this.__stopped = false;
    this.__stoppedImmediate = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.__stopped = true; }
  stopImmediatePropagation() { this.__stopped = true; this.__stoppedImmediate = true; }
}

function evt(type, fields) {
  const e = new MockEvent(type, fields || {});
  if (fields) {
    for (const k of Object.keys(fields)) {
      if (k === 'bubbles' || k === 'cancelable') continue;
      e[k] = fields[k];
    }
  }
  return e;
}

/** Build a PointerEvent-ish plain object; handlers just read the fields. */
export function makePointerEvent(type, o = {}) {
  const x = isFin(o.x) ? o.x : (isFin(o.clientX) ? o.clientX : 0);
  const y = isFin(o.y) ? o.y : (isFin(o.clientY) ? o.clientY : 0);
  const button = isFin(o.button) ? o.button : 0;
  const buttons = isFin(o.buttons) ? o.buttons : (o.type === 'pointerup' || type === 'pointerup' ? 0 : 1);
  return evt(type, {
    clientX: x, clientY: y, x, y, pageX: x, pageY: y, screenX: x, screenY: y,
    offsetX: x, offsetY: y, movementX: o.movementX || 0, movementY: o.movementY || 0,
    button, buttons,
    pointerId: isFin(o.pointerId) ? o.pointerId : 1,
    pointerType: o.pointerType || 'mouse',
    isPrimary: o.isPrimary !== false,
    width: 0, height: 0, pressure: o.pressure !== undefined ? o.pressure : (button >= 0 && buttons ? 0.5 : 0),
    tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0,
    altKey: !!o.altKey, ctrlKey: !!o.ctrlKey, shiftKey: !!o.shiftKey, metaKey: !!o.metaKey,
    detail: o.detail !== undefined ? o.detail : 1,
  });
}

export function makeMouseEvent(type, o = {}) {
  return makePointerEvent(type, o);
}

export function makeWheelEvent(o = {}) {
  const x = isFin(o.x) ? o.x : (isFin(o.clientX) ? o.clientX : 0);
  const y = isFin(o.y) ? o.y : (isFin(o.clientY) ? o.clientY : 0);
  return evt('wheel', {
    clientX: x, clientY: y, x, y, pageX: x, pageY: y, screenX: x, screenY: y,
    offsetX: x, offsetY: y,
    deltaX: isFin(o.deltaX) ? o.deltaX : 0,
    deltaY: isFin(o.deltaY) ? o.deltaY : 0,
    deltaZ: isFin(o.deltaZ) ? o.deltaZ : 0,
    deltaMode: isFin(o.deltaMode) ? o.deltaMode : 0,
    button: 0, buttons: 0,
    altKey: !!o.altKey, ctrlKey: !!o.ctrlKey, shiftKey: !!o.shiftKey, metaKey: !!o.metaKey,
  });
}

export function makeKeyEvent(type, o = {}) {
  const key = o.key !== undefined ? String(o.key) : '';
  const code = o.code !== undefined ? String(o.code) : '';
  const map = {
    Enter: 13, ' ': 32, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39,
    ArrowDown: 40, Backspace: 8, Tab: 9, Shift: 16, Control: 17, Alt: 18, Delete: 46,
  };
  const kc = o.keyCode !== undefined ? o.keyCode : (map[key] !== undefined ? map[key] : (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0));
  return evt(type, {
    key, code: code || (key.length === 1 ? 'Key' + key.toUpperCase() : key),
    keyCode: kc, which: kc, charCode: type === 'keypress' ? kc : 0,
    location: 0, repeat: !!o.repeat, isComposing: false,
    altKey: !!o.altKey, ctrlKey: !!o.ctrlKey, shiftKey: !!o.shiftKey, metaKey: !!o.metaKey,
  });
}

/* ------------------------------------------------------------------- dom */

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

let __nodeSeq = 1;

class ClassList {
  constructor(el) { this.__el = el; this.__set = new Set(); }
  add(...names) { for (const n of names) if (n) this.__set.add(String(n)); this.__sync(); }
  remove(...names) { for (const n of names) this.__set.delete(String(n)); this.__sync(); }
  contains(n) { return this.__set.has(String(n)); }
  toggle(n, force) {
    const name = String(n);
    let on;
    if (force === undefined) { on = !this.__set.has(name); }
    else { on = !!force; }
    if (on) this.__set.add(name); else this.__set.delete(name);
    this.__sync();
    return on;
  }
  replace(a, b) {
    if (!this.__set.has(String(a))) return false;
    this.__set.delete(String(a)); this.__set.add(String(b)); this.__sync(); return true;
  }
  item(i) { return [...this.__set][i] || null; }
  get length() { return this.__set.size; }
  get value() { return [...this.__set].join(' '); }
  toString() { return this.value; }
  [Symbol.iterator]() { return this.__set[Symbol.iterator](); }
  __sync() { this.__el.__setClassName(this.value); }
}

class MockElement {
  constructor(tagName, doc) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.ownerDocument = doc;
    this.__uid = __nodeSeq++;
    this.__children = [];
    this.__listeners = new Map();
    this.__attrs = new Map();
    this.__style = makeStyle();
    this.__dataset = {};
    this.__text = '';
    this.__htmlSet = false;
    this.__html = '';
    this.__rawHtml = '';
    this.__classList = new ClassList(this);
    this.__className = '';
    this.parentNode = null;
    this.parentElement = null;
    this.__id = '';
  }

  /* -- tree ------------------------------------------------------------- */
  get children() { return this.__children.filter((c) => c.nodeType === 1); }
  get childNodes() { return this.__children.slice(); }
  get childElementCount() { return this.children.length; }
  get firstChild() { return this.__children[0] || null; }
  get lastChild() { return this.__children[this.__children.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get nextSibling() {
    const p = this.parentNode;
    if (!p || !p.__children) return null;
    const i = p.__children.indexOf(this);
    return i < 0 ? null : (p.__children[i + 1] || null);
  }
  get previousSibling() {
    const p = this.parentNode;
    if (!p || !p.__children) return null;
    const i = p.__children.indexOf(this);
    return i <= 0 ? null : (p.__children[i - 1] || null);
  }
  get nextElementSibling() {
    const sib = this.parentNode ? this.parentNode.children : [];
    const i = sib.indexOf(this);
    return i < 0 ? null : (sib[i + 1] || null);
  }
  get previousElementSibling() {
    const sib = this.parentNode ? this.parentNode.children : [];
    const i = sib.indexOf(this);
    return i <= 0 ? null : (sib[i - 1] || null);
  }

  appendChild(node) {
    if (!node) return node;
    if (node.nodeType === 11) { // DocumentFragment
      for (const c of node.__children.slice()) this.appendChild(c);
      return node;
    }
    if (node.parentNode && node.parentNode !== this) node.parentNode.removeChild(node);
    else if (node.parentNode === this) {
      const i = this.__children.indexOf(node);
      if (i >= 0) this.__children.splice(i, 1);
    }
    this.__children.push(node);
    node.parentNode = this;
    if (node.nodeType === 1) node.parentElement = this;
    return node;
  }

  insertBefore(node, ref) {
    if (!ref) return this.appendChild(node);
    const i = this.__children.indexOf(ref);
    if (i < 0) return this.appendChild(node);
    if (node.parentNode) node.parentNode.removeChild(node);
    this.__children.splice(i, 0, node);
    node.parentNode = this;
    if (node.nodeType === 1) node.parentElement = this;
    return node;
  }

  replaceChild(newNode, oldNode) {
    const i = this.__children.indexOf(oldNode);
    if (i < 0) throw new Error('NotFoundError: node is not a child');
    this.__children[i] = newNode;
    newNode.parentNode = this;
    if (newNode.nodeType === 1) newNode.parentElement = this;
    oldNode.parentNode = null;
    return oldNode;
  }

  removeChild(node) {
    const i = this.__children.indexOf(node);
    if (i < 0) throw new Error('NotFoundError: node is not a child');
    this.__children.splice(i, 1);
    node.parentNode = null;
    node.parentElement = null;
    return node;
  }

  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n); }
  prepend(...nodes) {
    const first = this.__children[0] || null;
    for (const n of nodes) this.insertBefore(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n, first);
  }
  contains(node) {
    let n = node;
    while (n) { if (n === this) return true; n = n.parentNode; }
    return false;
  }
  cloneNode(deep) {
    const el = this.ownerDocument.createElement(this.tagName.toLowerCase());
    for (const [k, v] of this.__attrs) el.setAttribute(k, v);
    if (deep) for (const c of this.__children) el.appendChild(c.cloneNode(true));
    return el;
  }

  /* -- attributes ------------------------------------------------------- */
  setAttribute(name, value) {
    const n = String(name);
    const v = String(value);
    this.__attrs.set(n, v);
    const lower = n.toLowerCase();
    if (lower === 'id') { this.id = v; }
    else if (lower === 'class') { this.className = v; }
    else if (lower === 'style') { this.__style.cssText = v; }
    else if (lower.startsWith('data-')) { this.__dataset[camel(lower.slice(5))] = v; }
    else if (lower === 'width' && this.__isCanvas) { this.__setSize(v, this.__h); }
    else if (lower === 'height' && this.__isCanvas) { this.__setSize(this.__w, v); }
    else if (lower === 'value') { this.value = v; }
  }
  getAttribute(name) {
    const n = String(name);
    if (n === 'class') return this.className || (this.__attrs.has('class') ? this.__attrs.get('class') : null);
    if (this.__attrs.has(n)) return this.__attrs.get(n);
    return null;
  }
  hasAttribute(name) { return this.__attrs.has(String(name)); }
  removeAttribute(name) {
    const n = String(name);
    this.__attrs.delete(n);
    if (n === 'id') this.__id = '';
    if (n === 'class') this.className = '';
  }
  get attributes() {
    return [...this.__attrs.entries()].map(([name, value]) => ({ name, value }));
  }

  get id() { return this.__id; }
  set id(v) {
    this.__id = v === undefined || v === null ? '' : String(v);
    this.__attrs.set('id', this.__id);
    if (this.ownerDocument) this.ownerDocument.__indexId(this);
  }

  get className() { return this.__className; }
  set className(v) {
    this.__className = v === undefined || v === null ? '' : String(v);
    this.__attrs.set('class', this.__className);
    const set = new Set(String(this.__className).split(/\s+/).filter(Boolean));
    this.__classList.__set = set;
  }
  __setClassName(v) {
    this.__className = v;
    this.__attrs.set('class', v);
  }
  get classList() { return this.__classList; }

  get style() { return this.__style; }
  set style(v) { if (typeof v === 'string') this.__style.cssText = v; }
  get dataset() { return this.__dataset; }

  get textContent() {
    if (this.__children.length) return this.__children.map((c) => c.textContent || '').join('');
    return this.__text;
  }
  set textContent(v) {
    this.__children = [];
    this.__text = v === undefined || v === null ? '' : String(v);
    this.__html = '';
    this.__htmlSet = true;
  }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  get outerText() { return this.textContent; }

  get innerHTML() { return this.__htmlSet ? this.__html : (this.__rawHtml || ''); }
  set innerHTML(v) {
    this.__html = v === undefined || v === null ? '' : String(v);
    this.__htmlSet = true;
    this.__children = [];
    this.__text = '';
  }
  get outerHTML() { return this.__rawHtml || `<${this.tagName.toLowerCase()}>`; }

  /* -- misc element api -------------------------------------------------- */
  get offsetWidth() { return this.__boxW(); }
  get offsetHeight() { return this.__boxH(); }
  get clientWidth() { return this.__boxW(); }
  get clientHeight() { return this.__boxH(); }
  get clientLeft() { return 0; }
  get clientTop() { return 0; }
  get offsetLeft() { return 0; }
  get offsetTop() { return 0; }
  get offsetParent() { return this.parentElement; }
  /** Layout box: from the page's CSS model, or the canvas bitmap as fallback. */
  __boxW() { return this.__box().w; }
  __boxH() { return this.__box().h; }
  __box() {
    const page = this.ownerDocument && this.ownerDocument.__page;
    if (page && typeof page.elementBox === 'function') return page.elementBox(this);
    return { w: this.__w !== undefined ? this.__w : 0, h: this.__h !== undefined ? this.__h : 0 };
  }

  getBoundingClientRect() {
    const b = this.__box();
    const w = b.w, h = b.h;
    return {
      x: 0, y: 0, left: 0, top: 0, right: w, bottom: h, width: w, height: h,
      toJSON() { return { x: 0, y: 0, width: w, height: h }; },
    };
  }
  getClientRects() { return [this.getBoundingClientRect()]; }
  scrollIntoView() {}
  focus() { this.ownerDocument.__activeElement = this; }
  blur() { if (this.ownerDocument.__activeElement === this) this.ownerDocument.__activeElement = null; }
  click() {
    const t = this;
    t.ownerDocument.__page.fire(t, makePointerEvent('pointerdown', { buttons: 1 }), 'pointerdown');
    t.ownerDocument.__page.fire(t, makeMouseEvent('mousedown', { buttons: 1 }), 'mousedown');
    t.ownerDocument.__page.fire(t, makePointerEvent('pointerup', { buttons: 0 }), 'pointerup');
    t.ownerDocument.__page.fire(t, makeMouseEvent('mouseup', { buttons: 0 }), 'mouseup');
    t.ownerDocument.__page.fire(t, makeMouseEvent('click', { buttons: 0 }), 'click');
  }

  /* -- events ------------------------------------------------------------ */
  addEventListener(type, fn, opts) {
    if (typeof fn !== 'function' && !(fn && typeof fn.handleEvent === 'function')) return;
    const key = String(type);
    if (!this.__listeners.has(key)) this.__listeners.set(key, []);
    const capture = !!(opts === true || (opts && opts.capture));
    const once = !!(opts && opts.once);
    const list = this.__listeners.get(key);
    if (list.some((l) => l.fn === fn && l.capture === capture)) return;
    list.push({ fn, capture, once, passive: !!(opts && opts.passive) });
  }
  removeEventListener(type, fn, opts) {
    const list = this.__listeners.get(String(type));
    if (!list) return;
    const capture = !!(opts === true || (opts && opts.capture));
    const i = list.findIndex((l) => l.fn === fn && l.capture === capture);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(ev) { return this.ownerDocument.__page.__dispatch(this, ev); }
  __handlerFor(type) { return this['on' + type]; }
}

class MockCanvas extends MockElement {
  constructor(doc) {
    super('canvas', doc);
    this.__isCanvas = true;
    this.__w = 300;
    this.__h = 150;
    this.__explicitSize = false;
    this.__ctx2d = null;
    this.__contexts = [];
  }
  get width() { return this.__w; }
  set width(v) {
    const n = Math.max(0, Math.floor(Number(v)));
    if (!Number.isFinite(n)) return;
    this.__w = n;
    this.__explicitSize = true;
    this.__attrs.set('width', String(n));
  }
  get height() { return this.__h; }
  set height(v) {
    const n = Math.max(0, Math.floor(Number(v)));
    if (!Number.isFinite(n)) return;
    this.__h = n;
    this.__explicitSize = true;
    this.__attrs.set('height', String(n));
  }
  __setSize(w, h) {
    const nw = Math.max(0, Math.floor(Number(w)));
    const nh = Math.max(0, Math.floor(Number(h)));
    if (Number.isFinite(nw)) this.__w = nw;
    if (Number.isFinite(nh)) this.__h = nh;
    this.__explicitSize = true;
    this.__attrs.set('width', String(this.__w));
    this.__attrs.set('height', String(this.__h));
  }
  getContext(type, attrs) {
    const t = String(type || '2d').toLowerCase();
    if (t === '2d') {
      if (!this.__ctx2d) {
        this.__ctx2d = new RecordingContext2D(this, attrs || {});
        this.ownerDocument.__page.contexts.push(this.__ctx2d);
      }
      return this.__ctx2d;
    }
    const page = this.ownerDocument.__page;
    page.notes.push(`getContext('${t}') requested on canvas#${this.id || '?'} — mock provides only '2d'`);
    return null;
  }
  toDataURL() { return 'data:image/png;base64,'; }
  toBlob(cb) { if (typeof cb === 'function') cb(null); }
  transferControlToOffscreen() { throw new Error('mockdom: OffscreenCanvas is not supported'); }
}

class MockDocument {
  constructor(page) {
    this.__page = page;
    this.nodeType = 9;
    this.nodeName = '#document';
    this.parentNode = null;
    this.ownerDocument = null;
    this.readyState = 'complete';
    this.visibilityState = 'visible';
    this.hidden = false;
    this.cookie = '';
    this.title = '';
    this.__ids = new Map();
    this.__all = [];
    this.__listeners = new Map();
    this.__activeElement = null;
    this.__styleRules = [];
    this.documentElement = new MockElement('html', this);
    this.head = new MockElement('head', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.__all.push(this.documentElement, this.head, this.body);
  }
  get defaultView() { return this.__page.window; }
  /** Register a stylesheet's rules (used for canvas/box sizing). */
  addStyleSheet(cssText) {
    const rules = parseCssRules(cssText);
    for (const r of rules) this.__styleRules.push(r);
    return rules.length;
  }
  __indexId(el) {
    if (el.__id) this.__ids.set(el.__id, el);
  }
  createElement(tag) {
    const t = String(tag || 'div').toLowerCase();
    const el = t === 'canvas' ? new MockCanvas(this) : new MockElement(t, this);
    this.__all.push(el);
    return el;
  }
  createElementNS(ns, tag) { return this.createElement(tag); }
  createTextNode(text) {
    const t = { nodeType: 3, nodeName: '#text', textContent: text === undefined || text === null ? '' : String(text), parentNode: null, ownerDocument: this, __children: [] };
    return t;
  }
  createDocumentFragment() {
    const f = new MockElement('#fragment', this);
    f.nodeType = 11;
    f.tagName = '#fragment';
    f.nodeName = '#fragment';
    return f;
  }
  createEvent(type) {
    const e = new MockEvent(type || 'Event');
    e.initEvent = (t, b, c) => { e.type = t; e.bubbles = b !== false; e.cancelable = c !== false; };
    return e;
  }
  getElementById(id) {
    const key = String(id);
    const hit = this.__ids.get(key);
    if (hit) return hit;
    for (const el of this.__all) if (el.__id === key) { this.__ids.set(key, el); return el; }
    this.__page.missingIds.push(key);
    if (this.__page.opts.autoCreateMissingIds) {
      const el = new MockElement('div', this);
      el.id = key;
      this.body.appendChild(el);
      this.__page.notes.push(`auto-created missing element #${key} (harness option autoCreateMissingIds)`);
      return el;
    }
    return null;
  }
  getElementsByTagName(tag) {
    const t = String(tag).toUpperCase();
    return nodeList(this.__all.filter((el) => t === '*' || el.tagName === t));
  }
  getElementsByClassName(cls) {
    const wanted = String(cls).split(/\s+/).filter(Boolean);
    return nodeList(this.__all.filter((el) => wanted.every((c) => el.classList && el.classList.contains(c))));
  }
  querySelector(sel) { const r = this.querySelectorAll(sel); return r.length ? r[0] : null; }
  querySelectorAll(sel) { return nodeList(this.__all.filter((el) => el.nodeType === 1 && matchesSelector(el, sel))); }
  elementFromPoint(x, y) {
    for (const el of this.__all) {
      if (el.__isCanvas && x >= 0 && y >= 0 && x < el.width && y < el.height) return el;
    }
    return this.body;
  }
  hasFocus() { return true; }
  addEventListener(type, fn, opts) { MockElement.prototype.addEventListener.call(this, type, fn, opts); }
  removeEventListener(type, fn, opts) { MockElement.prototype.removeEventListener.call(this, type, fn, opts); }
  dispatchEvent(ev) { return this.__page.__dispatch(this, ev); }
  appendChild(n) { return this.body.appendChild(n); }
  removeChild(n) { return this.body.removeChild(n); }
  write() {}
  get fonts() { return { ready: Promise.resolve(), add() {}, check() { return true; } }; }
}

/** Array-with-an-item() so it behaves a bit like a NodeList. */
function nodeList(arr) {
  Object.defineProperty(arr, 'item', {
    value: (i) => (i >= 0 && i < arr.length ? arr[i] : null),
    enumerable: false,
  });
  return arr;
}

/* --------------------------------------------------------- selectors ---- */

function parseCompound(sel) {
  const out = { tag: null, id: null, classes: [], attrs: [], not: [] };
  let s = sel.trim();
  const nots = [];
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => { nots.push(inner); return ''; });
  s = s.replace(/\[([^\]]+)\]/g, (_, inner) => { out.attrs.push(inner.trim()); return ''; });
  const m = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(s);
  if (!m) return null;
  if (m[1]) out.tag = m[1].toUpperCase();
  const rest = m[2] || '';
  const re = /([.#])([\w-]+)/g;
  let mm;
  while ((mm = re.exec(rest))) {
    if (mm[1] === '#') out.id = mm[2];
    else out.classes.push(mm[2]);
  }
  out.not = nots;
  return out;
}

function matchCompound(el, c) {
  if (!c) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const cls of c.classes) if (!el.classList || !el.classList.contains(cls)) return false;
  for (const a of c.attrs) {
    const eq = a.indexOf('=');
    if (eq < 0) { if (!el.hasAttribute(a)) return false; continue; }
    const name = a.slice(0, eq).trim();
    const want = a.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (el.getAttribute(name) !== want) return false;
  }
  for (const n of c.not) if (matchesSelector(el, n)) return false;
  return true;
}

/** Supports comma lists, descendant (space) and child (>) combinators. */
export function matchesSelector(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  for (const part of String(selector).split(',')) {
    const tokens = part.trim().split(/\s*>\s*|\s+/).filter(Boolean);
    const combinators = [];
    const re = /\s*(>)\s*|\s+/g;
    let m;
    const raw = part.trim();
    while ((m = re.exec(raw))) combinators.push(m[1] ? '>' : ' ');
    if (!tokens.length) continue;
    const compounds = tokens.map(parseCompound);
    if (compounds.some((c) => !c)) continue;
    let node = el;
    let ti = compounds.length - 1;
    let ok = matchCompound(node, compounds[ti]);
    if (!ok) continue;
    ti--;
    let ci = combinators.length - 1;
    while (ti >= 0 && ci >= 0) {
      const comb = combinators[ci];
      const target = compounds[ti];
      if (comb === '>') {
        node = node.parentElement;
        if (!node || !matchCompound(node, target)) { ok = false; break; }
      } else {
        let anc = node.parentElement;
        let found = false;
        while (anc) { if (matchCompound(anc, target)) { found = true; break; } anc = anc.parentElement; }
        if (!found) { ok = false; break; }
        node = anc;
      }
      ti--; ci--;
    }
    if (ok && ti < 0) return true;
  }
  return false;
}

/* -------------------------------------------------------- html scanning - */

/* ------------------------------------------------------------- css ------ */
/* A deliberately tiny CSS layer: it exists so that canvas sizing (which almost
   every Canvas page derives from clientWidth/clientHeight or 100%/100vh CSS)
   resolves like it does in a browser. Selectors are matched with the same
   matcher querySelector uses; the cascade is approximated by source order
   (with !important winning). No shorthand expansion, no inheritance. */

function stripAtRules(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '@') {
      let j = i + 1;
      while (j < src.length && src[j] !== '{' && src[j] !== ';') j++;
      if (src[j] === ';') { i = j + 1; continue; }            // @import/@charset
      let k = j + 1;
      let depth = 1;
      while (k < src.length && depth > 0) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') depth--;
        k++;
      }
      out += stripAtRules(src.slice(j + 1, Math.max(j + 1, k - 1)));  // keep inner rules
      i = k;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/** Parse CSS text into [{selectors:[..], decls:{prop:{value,important}}}] */
export function parseCssRules(cssText) {
  const rules = [];
  const src = stripAtRules(String(cssText || '').replace(/\/\*[\s\S]*?\*\//g, ''));
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const sel = m[1].trim();
    const body = m[2].trim();
    if (!sel || !body || sel.startsWith('@')) continue;
    const decls = {};
    for (const part of body.split(';')) {
      const c = part.indexOf(':');
      if (c < 0) continue;
      const prop = part.slice(0, c).trim().toLowerCase();
      let value = part.slice(c + 1).trim();
      let important = false;
      if (/!important$/i.test(value)) { important = true; value = value.replace(/!important$/i, '').trim(); }
      if (prop) decls[prop] = { value, important };
    }
    const selectors = sel.split(',').map((s) => s.trim()).filter(Boolean);
    if (selectors.length) rules.push({ selectors, decls });
  }
  return rules;
}

/** Merge the declarations that apply to an element (source order, !important wins). */
function declsFor(el, rules) {
  const out = {};
  const locked = {};
  for (const rule of rules || []) {
    let hit = false;
    for (const sel of rule.selectors) {
      if (matchesSelector(el, sel)) { hit = true; break; }
    }
    if (!hit) continue;
    for (const prop of Object.keys(rule.decls)) {
      const d = rule.decls[prop];
      if (locked[prop] && !d.important) continue;
      out[prop] = d.value;
      if (d.important) locked[prop] = true;
    }
  }
  return out;
}

/** Element inline style in the same {property: value} shape as CSS rules. */
function inlineDecls(el) {
  const out = {};
  const st = el && el.__style;
  if (!st) return out;
  for (const k of Object.keys(st)) out[hyphen(k)] = st.getPropertyValue(k);
  return out;
}

function resolveLength(value, basis, vp) {  if (value === undefined || value === null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v || v === 'auto' || v === 'inherit' || v === 'initial' || v === 'unset' || v === 'content' || v === 'fit-content') return null;
  if (v.startsWith('calc(') && v.endsWith(')')) {
    const inner = v.slice(5, -1).trim();
    const parts = inner.split(/(?=[+-])/);
    let sum = 0;
    for (const p of parts) {
      const r = resolveLength(p.trim(), basis, vp);
      if (r === null) return null;
      sum += r;
    }
    return sum;
  }
  let m = /^(-?[\d.]+)px$/.exec(v);
  if (m) return parseFloat(m[1]);
  m = /^(-?[\d.]+)vw$/.exec(v);
  if (m) return parseFloat(m[1]) / 100 * vp.w;
  m = /^(-?[\d.]+)vh$/.exec(v);
  if (m) return parseFloat(m[1]) / 100 * vp.h;
  m = /^(-?[\d.]+)vmin$/.exec(v);
  if (m) return parseFloat(m[1]) / 100 * Math.min(vp.w, vp.h);
  m = /^(-?[\d.]+)vmax$/.exec(v);
  if (m) return parseFloat(m[1]) / 100 * Math.max(vp.w, vp.h);
  m = /^(-?[\d.]+)%$/.exec(v);
  if (m) return basis === null || basis === undefined ? null : parseFloat(m[1]) / 100 * basis;
  m = /^(-?[\d.]+)(em|rem)$/.exec(v);
  if (m) return parseFloat(m[1]) * 16;
  m = /^(-?[\d.]+)$/.exec(v);
  if (m) return parseFloat(m[1]);
  return null;
}

const TAG_RE = /^<([a-zA-Z][\w:-]*)/;
const CLOSE_RE = /^<\/([a-zA-Z][\w:-]*)>/;
const ATTR_RE = /([\w:.-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

function parseAttrs(text) {
  const out = [];
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(text))) {
    const name = m[1];
    if (!name || name === '/') continue;
    const value = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : ''));
    out.push([name, value]);
  }
  return out;
}

/**
 * Tokenize + build a crude element tree. Not a real HTML parser: comments and
 * script/style bodies are skipped, void elements are handled, and the tag stack
 * gives real parent/child links for bubbling + selectors.
 * Returns { scripts: [{kind:'src'|'inline', value, type, order}] }.
 */
export function parseHtmlInto(html, doc) {
  const src = String(html);
  const scripts = [];
  const stack = [{ el: null, tag: '#root', start: 0 }];
  let i = 0;
  const top = () => stack[stack.length - 1] || stack[0];

  const pushEl = (tag, attrs, startIdx) => {
    let el;
    const t = tag.toLowerCase();
    if (t === 'html') el = doc.documentElement;
    else if (t === 'head') el = doc.head;
    else if (t === 'body') el = doc.body;
    else {
      el = doc.createElement(t);
      for (const [name, value] of attrs) el.setAttribute(name, value);
    }
    if (t !== 'html' && t !== 'head' && t !== 'body') {
      for (const [name, value] of attrs) {
        if (name.toLowerCase() === 'id') el.id = value;
        else if (name.toLowerCase() === 'class') el.className = value;
        else if (name.toLowerCase() === 'style') el.style.cssText = value;
        else if (name.toLowerCase().startsWith('data-')) el.dataset[camel(name.slice(5))] = value;
        else if (name.toLowerCase() === 'width' && el.__isCanvas) el.__w = Math.max(0, parseInt(value, 10) || 0), el.__explicitSize = true;
        else if (name.toLowerCase() === 'height' && el.__isCanvas) el.__h = Math.max(0, parseInt(value, 10) || 0), el.__explicitSize = true;
        else if (name.toLowerCase() === 'value') el.value = value;
      }
      if (el.__isCanvas) { el.__attrs.set('width', String(el.__w)); el.__attrs.set('height', String(el.__h)); }
      if (el.parentNode == null && top().el) top().el.appendChild(el);
      else if (el.parentNode == null) doc.body.appendChild(el);
    }
    stack.push({ el, tag: t, start: startIdx });
    return el;
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      if (i < src.length) {
        const text = src.slice(i);
        const el = top().el;
        if (el) el.__text += text.replace(/\s+/g, ' ').trim();
      }
      break;
    }
    if (lt > i) {
      const text = src.slice(i, lt);
      const el = top().el;
      if (el && text.trim()) el.__text += (el.__text ? ' ' : '') + text.replace(/\s+/g, ' ').trim();
      i = lt;
      continue;
    }
    // i === lt
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const end = src.indexOf('>', i);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    const close = CLOSE_RE.exec(src.slice(i));
    if (close) {
      const tag = close[1].toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tag) {
          const popped = stack[k];
          if (popped.el) popped.el.__rawHtml = src.slice(popped.start, i + close[0].length);
          stack.length = Math.max(1, k);
          break;
        }
      }
      i += close[0].length;
      continue;
    }
    const open = TAG_RE.exec(src.slice(i));
    if (!open) { i++; continue; }
    const tag = open[1].toLowerCase();
    // find the end of the open tag, respecting quotes
    let j = i + open[0].length;
    let quote = null;
    while (j < src.length) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
      j++;
    }
    const attrText = src.slice(i + open[0].length, j);
    const selfClose = /\/\s*$/.test(attrText);
    const startIdx = i;
    i = j + 1;
    if (tag === 'script' || tag === 'style') {
      const endRe = new RegExp('</' + tag + '\\s*>', 'i');
      const rest = src.slice(i);
      const em = endRe.exec(rest);
      const body = em ? rest.slice(0, em.index) : rest;
      const attrs = parseAttrs(attrText);
      const attrMap = Object.fromEntries(attrs);
      if (tag === 'style') {
        doc.addStyleSheet(body);
      } else if (tag === 'script') {
        if (attrMap.src) scripts.push({ kind: 'src', value: attrMap.src, type: attrMap.type || '', attrs: attrMap });
        else scripts.push({ kind: 'inline', value: body, type: attrMap.type || '', attrs: attrMap });
      }
      i = em ? i + em.index + em[0].length : src.length;
      continue;
    }
    if (VOID_TAGS.has(tag) || selfClose) {
      const attrs = parseAttrs(attrText);
      const savedStack = stack.length;
      const el = pushEl(tag, attrs, startIdx);
      el.__rawHtml = src.slice(startIdx, i);
      stack.length = savedStack;   // void element: pop it again immediately
      continue;
    }
    pushEl(tag, parseAttrs(attrText), startIdx);
  }
  return { scripts };
}

/* ==================================================================== */
/* RecordingContext2D                                                    */
/* ==================================================================== */

const STATE_DEFAULTS = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  lineDashOffset: 0,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  filter: 'none',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  direction: 'inherit',
  letterSpacing: '0px',
  wordSpacing: '0px',
};

const STATE_KEYS = Object.keys(STATE_DEFAULTS);

function freshState() {
  const s = {};
  for (const k of STATE_KEYS) s[k] = STATE_DEFAULTS[k];
  s.m = [1, 0, 0, 1, 0, 0];
  s.dash = [];
  s.clip = [];
  s.clipBox = null;
  return s;
}

function copyState(s) {
  const o = {};
  for (const k of STATE_KEYS) o[k] = s[k];
  o.m = s.m.slice();
  o.dash = s.dash.slice();
  o.clip = s.clip.map(cloneSubpaths);
  o.clipBox = s.clipBox ? { ...s.clipBox } : null;
  return o;
}

/** Parse a canvas font string: [style] [weight] size family. */
export function parseFont(str) {
  const out = { size: 10, family: 'sans-serif', weight: 'normal', style: 'normal' };
  const s = String(str || '');
  const wm = /\b(bold|bolder|lighter|[1-9]00)\b/.exec(s);
  if (wm) out.weight = wm[1];
  const sm = /\b(italic|oblique)\b/.exec(s);
  if (sm) out.style = sm[1];
  const szm = /(\d+(?:\.\d+)?)\s*(px|pt|pc|em|rem|%)?/.exec(s.replace(/^\s*(italic|oblique|bold|bolder|lighter|[1-9]00)\s*/g, ''));
  if (szm) {
    let v = parseFloat(szm[1]);
    const unit = szm[2] || 'px';
    if (unit === 'pt') v *= 4 / 3;
    else if (unit === 'pc') v *= 16;
    else if (unit === 'em' || unit === 'rem') v *= 16;
    else if (unit === '%') v *= 0.16;
    if (Number.isFinite(v) && v > 0) out.size = v;
  }
  const fam = s.split(/\d+(?:\.\d+)?\s*(?:px|pt|pc|em|rem|%)?\s*(?:\/\s*[^\s]+)?/).pop();
  if (fam && fam.trim()) out.family = fam.trim().replace(/^["']|["']$/g, '');
  return out;
}

export class RecordingContext2D {
  constructor(canvas, attrs = {}) {
    this.canvas = canvas;
    this.__attrs = attrs || {};
    this.__state = freshState();
    this.__stack = [];
    this.__calls = [];
    this.__sets = [];
    this.__warnings = [];
    this.__warnCount = 0;
    this.__gradients = [];
    this.__marks = [];
    this.__markSeq = 0;
    this.__subpaths = [];
    this.__current = null;
    this.__pathsRecorded = 0;
    this.__stats = {
      calls: 0, fills: 0, strokes: 0, texts: 0, strokeTexts: 0, saves: 0, restores: 0,
      restoreUnderflow: 0, clips: 0, rects: 0, fillRects: 0, strokeRects: 0, clearRects: 0,
      pathOps: 0, gradients: 0, patterns: 0, images: 0, transforms: 0, measures: 0,
      styleSets: 0, warnings: 0, fillsByColor: {}, strokesByColor: {}, frames: 0,
      clipsByKind: {}, paths: 0, roundRects: 0,
    };
    this.__finalized = null;
  }

  /* ----------------------------------------------------------- state --- */

  get __m() { return this.__state.m; }

  __warn(op, args, message) {
    this.__warnCount++;
    this.__stats.warnings = this.__warnCount;
    if (this.__warnings.length < 200) {
      this.__warnings.push({ op, args: args.map((a) => (typeof a === 'number' ? a : String(a))), message });
    } else if (this.__warnings.length === 200) {
      this.__warnings.push({ op, args: [], message: 'further warnings truncated (see __warnCount)' });
    }
  }

  /** Validate numeric args; returns false (and warns) when any is not finite. */
  __nums(op, args, names) {
    for (let i = 0; i < args.length; i++) {
      const v = args[i];
      if (typeof v === 'number' && !Number.isFinite(v)) {
        this.__warn(op, args, `${names ? names[i] || ('arg' + i) : 'arg' + i} is ${v}`);
        return false;
      }
      if (typeof v === 'number' || v === undefined || v === null) continue;
      if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) continue;
      this.__warn(op, args, `${names ? names[i] || ('arg' + i) : 'arg' + i} is not a number (${typeof v})`);
      return false;
    }
    return true;
  }

  __bake(x, y) {
    const m = this.__state.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  __snapStyle() {
    const s = this.__state;
    const st = {};
    for (const k of STATE_KEYS) st[k] = s[k];
    return st;
  }

  __rec(op, args, extra) {
    const rec = { op, args: args || [] };
    if (extra) for (const k of Object.keys(extra)) rec[k] = extra[k];
    this.__calls.push(rec);
    this.__stats.calls = this.__calls.length;
    return rec;
  }

  /* --------------------------------------------------------- path build */

  __newSubpath(pt, kind) {
    const sp = { pts: [pt], closed: false, kind: kind || 'poly' };
    this.__subpaths.push(sp);
    this.__current = sp;
    return sp;
  }

  __lastPoint() {
    const sp = this.__current;
    return sp && sp.pts.length ? sp.pts[sp.pts.length - 1] : null;
  }

  __pushDevice(pt, kind) {
    if (!this.__current) this.__newSubpath(pt, kind);
    else {
      const last = this.__current.pts[this.__current.pts.length - 1];
      if (last && last[0] === pt[0] && last[1] === pt[1]) return;
      this.__current.pts.push(pt);
    }
  }

  /** append a user-space point (baked through the CTM) */
  __pushUser(x, y, kind) {
    this.__pushDevice(this.__bake(x, y), kind);
  }

  __lineToUser(x, y) {
    if (!this.__current) this.moveTo(x, y);
    else this.__pushUser(x, y);
  }

  __sampleArcUser(cx, cy, rx, ry, rot, a0, sweep, steps, connect) {
    const cosR = Math.cos(rot || 0);
    const sinR = Math.sin(rot || 0);
    const pt = (t) => {
      const px = rx * Math.cos(t);
      const py = ry * Math.sin(t);
      return [cx + px * cosR - py * sinR, cy + px * sinR + py * cosR];
    };
    if (connect) {
      const first = pt(a0);
      const last = this.__lastPoint();
      const fb = this.__bake(first[0], first[1]);
      if (!this.__current) this.moveTo(first[0], first[1]);
      else if (!last || Math.abs(last[0] - fb[0]) > 1e-9 || Math.abs(last[1] - fb[1]) > 1e-9) {
        this.__pushUser(first[0], first[1]);
      }
    }
    for (let i = 1; i <= steps; i++) {
      const t = a0 + sweep * (i / steps);
      const p = pt(t);
      this.__pushUser(p[0], p[1], 'arc');
    }
  }

  /* ------------------------------------------------------- path commands */

  beginPath() {
    this.__subpaths = [];
    this.__current = null;
    this.__stats.pathOps++;
    this.__rec('beginPath', []);
  }

  closePath() {
    if (this.__current && this.__current.pts.length) this.__current.closed = true;
    this.__stats.pathOps++;
    this.__rec('closePath', []);
  }

  moveTo(x, y) {
    if (!this.__nums('moveTo', [x, y], ['x', 'y'])) return;
    this.__newSubpath(this.__bake(x, y));
    this.__stats.pathOps++;
    this.__rec('moveTo', [x, y]);
  }

  lineTo(x, y) {
    if (!this.__nums('lineTo', [x, y], ['x', 'y'])) return;
    this.__lineToUser(x, y);
    this.__stats.pathOps++;
    this.__rec('lineTo', [x, y]);
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    if (!this.__nums('quadraticCurveTo', [cpx, cpy, x, y], ['cpx', 'cpy', 'x', 'y'])) return;
    if (!this.__current) { this.moveTo(x, y); return; }
    const p0 = this.__unbake(this.__lastPoint());
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const px = u * u * p0[0] + 2 * u * t * cpx + t * t * x;
      const py = u * u * p0[1] + 2 * u * t * cpy + t * t * y;
      this.__pushUser(px, py, 'quad');
    }
    this.__stats.pathOps++;
    this.__rec('quadraticCurveTo', [cpx, cpy, x, y]);
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    if (!this.__nums('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y], ['cp1x', 'cp1y', 'cp2x', 'cp2y', 'x', 'y'])) return;
    if (!this.__current) { this.moveTo(x, y); return; }
    const p0 = this.__unbake(this.__lastPoint());
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const px = u * u * u * p0[0] + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * x;
      const py = u * u * u * p0[1] + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * y;
      this.__pushUser(px, py, 'cubic');
    }
    this.__stats.pathOps++;
    this.__rec('bezierCurveTo', [cp1x, cp1y, cp2x, cp2y, x, y]);
  }

  __unbake(pt) {
    // inverse of the CTM for control points (affine, invertible)
    const m = this.__state.m;
    const det = m[0] * m[3] - m[1] * m[2];
    if (!pt) return [0, 0];
    if (Math.abs(det) < 1e-12) return [pt[0], pt[1]];
    const x = pt[0] - m[4], y = pt[1] - m[5];
    return [(x * m[3] - y * m[2]) / det, (-x * m[1] + y * m[0]) / det];
  }

  arc(cx, cy, r, a0, a1, ccw) {
    if (!this.__nums('arc', [cx, cy, r, a0, a1], ['cx', 'cy', 'r', 'startAngle', 'endAngle'])) return;
    if (r < 0) throw new Error(`IndexSizeError: The radius provided (${r}) is negative.`);
    const start = a0, end = a1;
    let sweep;
    const absDelta = Math.abs(end - start);
    if (absDelta >= TAU - 1e-9) sweep = ccw ? -TAU : TAU;
    else if (ccw) sweep = -mod2pi(start - end);
    else sweep = mod2pi(end - start);
    if (sweep === 0 && absDelta > 0) sweep = ccw ? -TAU : TAU;
    const steps = Math.max(2, Math.min(512, Math.ceil(Math.abs(sweep) / (Math.PI / 48))));
    this.__sampleArcUser(cx, cy, r, r, 0, start, sweep, steps, true);
    this.__stats.pathOps++;
    this.__rec('arc', [cx, cy, r, a0, a1, !!ccw]);
  }

  arcTo(x1, y1, x2, y2, r) {
    if (!this.__nums('arcTo', [x1, y1, x2, y2, r], ['x1', 'y1', 'x2', 'y2', 'radius'])) return;
    if (r < 0) throw new Error(`IndexSizeError: The radius provided (${r}) is negative.`);
    if (!this.__current) { this.moveTo(x1, y1); return; }
    const p0 = this.__unbake(this.__lastPoint());
    if (r === 0 || (p0[0] === x1 && p0[1] === y1) || (x2 === x1 && y2 === y1)) { this.lineTo(x1, y1); return; }
    const v1 = [p0[0] - x1, p0[1] - y1];
    const v2 = [x2 - x1, y2 - y1];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 1e-9 || l2 < 1e-9) { this.lineTo(x1, y1); return; }
    const u1 = [v1[0] / l1, v1[1] / l1];
    const u2 = [v2[0] / l2, v2[1] / l2];
    let cosT = u1[0] * u2[0] + u1[1] * u2[1];
    cosT = Math.max(-1, Math.min(1, cosT));
    const theta = Math.acos(cosT);
    if (theta < 1e-6 || Math.PI - theta < 1e-6) { this.lineTo(x1, y1); return; }
    const dist = r / Math.tan(theta / 2);
    const t1 = [x1 + u1[0] * dist, y1 + u1[1] * dist];
    const t2 = [x1 + u2[0] * dist, y1 + u2[1] * dist];
    this.lineTo(t1[0], t1[1]);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(bis[0], bis[1]) || 1;
    const centreDist = r / Math.sin(theta / 2);
    const ccx = x1 + (bis[0] / bl) * centreDist;
    const ccy = y1 + (bis[1] / bl) * centreDist;
    const sa = Math.atan2(t1[1] - ccy, t1[0] - ccx);
    const ea = Math.atan2(t2[1] - ccy, t2[0] - ccx);
    const positive = mod2pi(ea - sa);
    const goCcw = positive > Math.PI;
    const sweep = goCcw ? -mod2pi(sa - ea) : positive;
    const steps = Math.max(2, Math.min(512, Math.ceil(Math.abs(sweep) / (Math.PI / 48))));
    this.__sampleArcUser(ccx, ccy, r, r, 0, sa, sweep, steps, false);
    this.__stats.pathOps++;
    this.__rec('arcTo', [x1, y1, x2, y2, r]);
  }

  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
    if (!this.__nums('ellipse', [cx, cy, rx, ry, rot, a0, a1], ['cx', 'cy', 'rx', 'ry', 'rotation', 'startAngle', 'endAngle'])) return;
    if (rx < 0 || ry < 0) throw new Error(`IndexSizeError: The radius provided (${Math.min(rx, ry)}) is negative.`);
    let sweep;
    const absDelta = Math.abs(a1 - a0);
    if (absDelta >= TAU - 1e-9) sweep = ccw ? -TAU : TAU;
    else if (ccw) sweep = -mod2pi(a0 - a1);
    else sweep = mod2pi(a1 - a0);
    const steps = Math.max(2, Math.min(512, Math.ceil(Math.abs(sweep) / (Math.PI / 48))));
    this.__sampleArcUser(cx, cy, rx, ry, rot, a0, sweep, steps, true);
    this.__stats.pathOps++;
    this.__rec('ellipse', [cx, cy, rx, ry, rot, a0, a1, !!ccw]);
  }

  rect(x, y, w, h) {
    if (!this.__nums('rect', [x, y, w, h], ['x', 'y', 'w', 'h'])) return;
    const sp = this.__newSubpath(this.__bake(x, y), 'rect');
    this.__pushUser(x + w, y, 'rect');
    this.__pushUser(x + w, y + h, 'rect');
    this.__pushUser(x, y + h, 'rect');
    sp.closed = true;
    this.__stats.pathOps++;
    this.__stats.rects++;
    this.__rec('rect', [x, y, w, h]);
  }

  roundRect(x, y, w, h, radii) {
    if (!this.__nums('roundRect', [x, y, w, h], ['x', 'y', 'w', 'h'])) return;
    const rr = normalizeRadii(radii, w, h);
    if (!rr) { this.__warn('roundRect', [x, y, w, h, radii], 'invalid radii argument'); return; }
    const { tl, tr, br, bl } = rr;
    const sp = this.__newSubpath(this.__bake(x + tl[0], y), 'roundRect');
    this.__pushUser(x + w - tr[0], y, 'roundRect');
    this.__cornerUser(x + w - tr[0], y + tr[1], tr[0], tr[1], -Math.PI / 2, Math.PI / 2);
    this.__pushUser(x + w, y + h - br[1], 'roundRect');
    this.__cornerUser(x + w - br[0], y + h - br[1], br[0], br[1], 0, Math.PI / 2);
    this.__pushUser(x + bl[0], y + h, 'roundRect');
    this.__cornerUser(x + bl[0], y + h - bl[1], bl[0], bl[1], Math.PI / 2, Math.PI / 2);
    this.__pushUser(x, y + tl[1], 'roundRect');
    this.__cornerUser(x + tl[0], y + tl[1], tl[0], tl[1], Math.PI, Math.PI / 2);
    sp.closed = true;
    this.__stats.pathOps++;
    this.__stats.roundRects++;
    this.__rec('roundRect', [x, y, w, h, radii === undefined ? null : radii]);
  }

  __cornerUser(cx, cy, rx, ry, a0, sweep) {
    if (rx <= 0 || ry <= 0) return;
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 32)));
    for (let i = 1; i <= steps; i++) {
      const t = a0 + sweep * (i / steps);
      this.__pushUser(cx + rx * Math.cos(t), cy + ry * Math.sin(t), 'arc');
    }
  }

  /* ------------------------------------------------------ path painting */

  clip(fillRule) {
    const sps = cloneSubpaths(this.__subpaths);
    const box = bboxOfSubpaths(sps);
    const s = this.__state;
    s.clip = s.clip.concat([sps]);
    s.clipBox = intersectBox(s.clipBox, box.empty ? { x: 0, y: 0, w: 0, h: 0 } : { x: box.x, y: box.y, w: box.w, h: box.h });
    this.__stats.clips++;
    const kind = box.empty ? 'empty' : (sps.length === 1 && sps[0].kind === 'rect' ? 'rect' : 'polygon');
    this.__stats.clipsByKind[kind] = (this.__stats.clipsByKind[kind] || 0) + 1;
    this.__rec('clip', [fillRule || 'nonzero'], {
      subpaths: sps,
      box: s.clipBox ? { ...s.clipBox } : null,
      kind,
      transform: s.m.slice(),
    });
  }

  fill(fillRule) {
    const s = this.__state;
    const sps = cloneSubpaths(this.__subpaths);
    const style = this.__snapStyle();
    const key = colorKey(style.fillStyle);
    this.__stats.fills++;
    this.__stats.fillsByColor[key] = (this.__stats.fillsByColor[key] || 0) + 1;
    if (sps.length) this.__stats.paths++;
    this.__rec('fill', [fillRule || 'nonzero'], {
      subpaths: sps,
      rule: fillRule || 'nonzero',
      style,
      transform: s.m.slice(),
      clip: s.clip.length,
      bbox: bboxOfSubpaths(sps),
      points: sps.reduce((n, sp) => n + sp.pts.length, 0),
    });
  }

  stroke() {
    const s = this.__state;
    const sps = cloneSubpaths(this.__subpaths);
    const style = this.__snapStyle();
    const key = colorKey(style.strokeStyle);
    this.__stats.strokes++;
    this.__stats.strokesByColor[key] = (this.__stats.strokesByColor[key] || 0) + 1;
    if (sps.length) this.__stats.paths++;
    this.__rec('stroke', [], {
      subpaths: sps,
      style,
      transform: s.m.slice(),
      clip: s.clip.length,
      bbox: bboxOfSubpaths(sps),
      points: sps.reduce((n, sp) => n + sp.pts.length, 0),
      dash: s.dash.slice(),
      dashOffset: s.lineDashOffset,
    });
  }

  fillRect(x, y, w, h) {
    if (!this.__nums('fillRect', [x, y, w, h], ['x', 'y', 'w', 'h'])) return;
    const s = this.__state;
    const style = this.__snapStyle();
    const key = colorKey(style.fillStyle);
    this.__stats.fillRects++;
    this.__stats.fills++;
    this.__stats.fillsByColor[key] = (this.__stats.fillsByColor[key] || 0) + 1;
    const box = this.__rectDeviceBox(x, y, w, h);
    this.__rec('fillRect', [x, y, w, h], { style, transform: s.m.slice(), clip: s.clip.length, bbox: box });
  }

  strokeRect(x, y, w, h) {
    if (!this.__nums('strokeRect', [x, y, w, h], ['x', 'y', 'w', 'h'])) return;
    const s = this.__state;
    const style = this.__snapStyle();
    const key = colorKey(style.strokeStyle);
    this.__stats.strokeRects++;
    this.__stats.strokes++;
    this.__stats.strokesByColor[key] = (this.__stats.strokesByColor[key] || 0) + 1;
    const box = this.__rectDeviceBox(x, y, w, h);
    this.__rec('strokeRect', [x, y, w, h], {
      style, transform: s.m.slice(), clip: s.clip.length, bbox: box,
      dash: s.dash.slice(), dashOffset: s.lineDashOffset,
    });
  }

  clearRect(x, y, w, h) {
    if (!this.__nums('clearRect', [x, y, w, h], ['x', 'y', 'w', 'h'])) return;
    const s = this.__state;
    const box = this.__rectDeviceBox(x, y, w, h);
    this.__stats.clearRects++;
    this.__rec('clearRect', [x, y, w, h], { transform: s.m.slice(), clip: s.clip.length, bbox: box });
    const cw = this.canvas.width, ch = this.canvas.height;
    if (box.x <= 0.5 && box.y <= 0.5 && box.x + box.w >= cw - 0.5 && box.y + box.h >= ch - 0.5) {
      this.__markFrame('clear');
    }
  }

  __rectDeviceBox(x, y, w, h) {
    const pts = [this.__bake(x, y), this.__bake(x + w, y), this.__bake(x + w, y + h), this.__bake(x, y + h)];
    return bboxOfSubpaths([{ pts, closed: true }]);
  }

  /* ------------------------------------------------------------ text --- */

  measureText(text) {
    const s = String(text === undefined || text === null ? '' : text);
    const f = parseFont(this.__state.font);
    const letterSpacing = parseFloat(this.__state.letterSpacing) || 0;
    const width = s.length * f.size * 0.55 + (s.length > 1 ? letterSpacing * (s.length - 1) : 0);
    const w = Number.isFinite(width) ? width : 0;
    this.__stats.measures++;
    return {
      width: w,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: w,
      actualBoundingBoxAscent: f.size * 0.8,
      actualBoundingBoxDescent: f.size * 0.2,
      fontBoundingBoxAscent: f.size * 0.8,
      fontBoundingBoxDescent: f.size * 0.2,
      emHeightAscent: f.size * 0.8,
      emHeightDescent: f.size * 0.2,
      hangingBaseline: f.size * 0.8,
      alphabeticBaseline: 0,
      ideographicBaseline: -f.size * 0.2,
    };
  }

  fillText(text, x, y, maxWidth) {
    if (!this.__nums('fillText', [x, y], ['x', 'y'])) return;
    if (maxWidth !== undefined && !this.__nums('fillText', [maxWidth], ['maxWidth'])) return;
    const s = this.__state;
    const style = this.__snapStyle();
    const f = parseFont(s.font);
    const str = String(text === undefined || text === null ? '' : text);
    this.__stats.texts++;
    this.__rec('fillText', [str, x, y, maxWidth === undefined ? null : maxWidth], {
      text: str, x, y, style, font: f, transform: s.m.slice(), clip: s.clip.length,
      width: this.measureText(str).width,
    });
  }

  strokeText(text, x, y, maxWidth) {
    if (!this.__nums('strokeText', [x, y], ['x', 'y'])) return;
    if (maxWidth !== undefined && !this.__nums('strokeText', [maxWidth], ['maxWidth'])) return;
    const s = this.__state;
    const style = this.__snapStyle();
    const f = parseFont(s.font);
    const str = String(text === undefined || text === null ? '' : text);
    this.__stats.texts++;
    this.__stats.strokeTexts++;
    this.__rec('strokeText', [str, x, y, maxWidth === undefined ? null : maxWidth], {
      text: str, x, y, style, font: f, transform: s.m.slice(), clip: s.clip.length,
      width: this.measureText(str).width,
    });
  }

  /* --------------------------------------------------------- images ---- */

  drawImage(image, ...rest) {
    if (!this.__nums('drawImage', rest, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])) return;
    const s = this.__state;
    let box;
    if (rest.length === 2) box = this.__rectDeviceBox(rest[0], rest[1], 0, 0);
    else if (rest.length === 4) box = this.__rectDeviceBox(rest[0], rest[1], rest[2], rest[3]);
    else if (rest.length === 8) box = this.__rectDeviceBox(rest[4], rest[5], rest[6], rest[7]);
    else box = { x: 0, y: 0, w: 0, h: 0 };
    this.__stats.images++;
    this.__rec('drawImage', [describeImage(image), ...rest], {
      transform: s.m.slice(), style: this.__snapStyle(), clip: s.clip.length,
      bbox: box, alpha: s.globalAlpha,
      args: rest.slice(),
    });
  }

  /* ---------------------------------------------------- paint objects -- */

  createLinearGradient(x0, y0, x1, y1) {
    this.__nums('createLinearGradient', [x0, y0, x1, y1], ['x0', 'y0', 'x1', 'y1']);
    const g = makeGradient('linear', { x0, y0, x1, y1 });
    this.__stats.gradients++;
    this.__rec('createLinearGradient', [x0, y0, x1, y1], { grad: g.__gradient });
    return g;
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    this.__nums('createRadialGradient', [x0, y0, r0, x1, y1, r1], ['x0', 'y0', 'r0', 'x1', 'y1', 'r1']);
    if (r0 < 0 || r1 < 0) throw new Error('IndexSizeError: The radius provided is negative.');
    const g = makeGradient('radial', { x0, y0, r0, x1, y1, r1 });
    this.__stats.gradients++;
    this.__rec('createRadialGradient', [x0, y0, r0, x1, y1, r1], { grad: g.__gradient });
    return g;
  }

  createConicGradient(startAngle, x, y) {
    this.__nums('createConicGradient', [startAngle, x, y], ['startAngle', 'x', 'y']);
    const g = makeGradient('conic', { x, y, startAngle });
    this.__stats.gradients++;
    this.__rec('createConicGradient', [startAngle, x, y], { grad: g.__gradient });
    return g;
  }

  createPattern(image, repetition) {
    const p = {
      setTransform() {},
      __pattern: { image: describeImage(image), repetition: repetition === undefined ? 'repeat' : String(repetition) },
    };
    this.__stats.patterns++;
    this.__rec('createPattern', [describeImage(image), repetition === undefined ? 'repeat' : repetition], { pattern: p.__pattern });
    return p;
  }

  /* ------------------------------------------------------- transforms -- */

  save() {
    this.__stack.push(copyState(this.__state));
    this.__stats.saves++;
    this.__rec('save', []);
  }

  restore() {
    if (!this.__stack.length) {
      this.__stats.restoreUnderflow++;
      this.__warn('restore', [], 'restore() with an empty state stack (no-op, matches browsers)');
      this.__rec('restore', [], { underflow: true });
      return;
    }
    this.__state = this.__stack.pop();
    this.__stats.restores++;
    this.__rec('restore', []);
  }

  translate(x, y) {
    if (!this.__nums('translate', [x, y], ['x', 'y'])) return;
    const m = this.__state.m;
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
    this.__stats.transforms++;
    this.__rec('translate', [x, y]);
  }

  rotate(angle) {
    if (!this.__nums('rotate', [angle], ['angle'])) return;
    const c = Math.cos(angle), s = Math.sin(angle);
    this.__mul(c, s, -s, c, 0, 0);
    this.__stats.transforms++;
    this.__rec('rotate', [angle]);
  }

  scale(x, y) {
    if (!this.__nums('scale', [x, y], ['x', 'y'])) return;
    this.__mul(x, 0, 0, y, 0, 0);
    this.__stats.transforms++;
    this.__rec('scale', [x, y]);
  }

  transform(a, b, c, d, e, f) {
    if (arguments.length === 1 && a && typeof a === 'object') { this.transform(a.a, a.b, a.c, a.d, a.e, a.f); return; }
    if (!this.__nums('transform', [a, b, c, d, e, f], ['a', 'b', 'c', 'd', 'e', 'f'])) return;
    this.__mul(a, b, c, d, e, f);
    this.__stats.transforms++;
    this.__rec('transform', [a, b, c, d, e, f]);
  }

  __mul(a, b, c, d, e, f) {
    const m = this.__state.m;
    const m0 = m[0] * a + m[2] * b;
    const m1 = m[1] * a + m[3] * b;
    const m2 = m[0] * c + m[2] * d;
    const m3 = m[1] * c + m[3] * d;
    const m4 = m[0] * e + m[2] * f + m[4];
    const m5 = m[1] * e + m[3] * f + m[5];
    m[0] = m0; m[1] = m1; m[2] = m2; m[3] = m3; m[4] = m4; m[5] = m5;
  }

  setTransform(a, b, c, d, e, f) {
    if (arguments.length === 1 && a && typeof a === 'object') { this.setTransform(a.a, a.b, a.c, a.d, a.e, a.f); return; }
    if (arguments.length === 0) { this.setTransform(1, 0, 0, 1, 0, 0); return; }
    if (!this.__nums('setTransform', [a, b, c, d, e, f], ['a', 'b', 'c', 'd', 'e', 'f'])) return;
    this.__state.m = [a, b, c, d, e, f];
    this.__stats.transforms++;
    this.__rec('setTransform', [a, b, c, d, e, f]);
  }

  resetTransform() {
    this.__state.m = [1, 0, 0, 1, 0, 0];
    this.__rec('resetTransform', []);
  }

  getTransform() {
    const m = this.__state.m;
    return {
      a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5], is2D: true, isIdentity: false,
      multiply(o) { return { ...this, ...o }; },
      toJSON() { return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; },
    };
  }

  setLineDash(arr) {
    let a = Array.isArray(arr) ? arr.slice() : [];
    if (!this.__nums('setLineDash', a, a.map((_, i) => 'dash[' + i + ']'))) return;
    if (a.length % 2 === 1) a = a.concat(a);
    this.__state.dash = a;
    this.__rec('setLineDash', [a]);
  }

  getLineDash() { return this.__state.dash.slice(); }

  reset() {
    this.__state = freshState();
    this.__stack = [];
    this.__subpaths = [];
    this.__current = null;
    this.__rec('reset', []);
  }

  isPointInPath(x, y, rule) {
    const box = bboxOfSubpaths(this.__subpaths);
    const p = this.__bake(x, y);
    if (box.empty) return false;
    return p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h;
  }

  isPointInStroke(x, y) {
    const box = bboxOfSubpaths(this.__subpaths);
    const p = this.__bake(x, y);
    if (box.empty) return false;
    const pad = this.__state.lineWidth / 2 + 1;
    return p[0] >= box.x - pad && p[0] <= box.x + box.w + pad && p[1] >= box.y - pad && p[1] <= box.y + box.h + pad;
  }

  getContextAttributes() {
    return {
      alpha: this.__attrs.alpha !== false,
      desynchronized: !!this.__attrs.desynchronized,
      colorSpace: this.__attrs.colorSpace || 'srgb',
      willReadFrequently: !!this.__attrs.willReadFrequently,
    };
  }

  /* ---------------------------------------------------------- frames --- */

  /** Mark the op index where the current animation frame starts. */
  __markFrame(kind) {
    const at = this.__calls.length;
    const last = this.__marks[this.__marks.length - 1];
    if (last && last.at === at) { last.kind = kind === 'clear' ? 'clear' : last.kind; return; }
    this.__marks.push({ at, kind: kind || 'raf', seq: ++this.__markSeq });
    this.__stats.frames = this.__marks.filter((m) => m.kind === 'raf').length;
  }

  /**
   * Assert save/restore balance and return a JSON-able summary.
   * `balanced` is false when restore() underflowed (a real bug).
   * With { strict: true } it throws instead of returning.
   */
  __finalize(opts = {}) {
    const drawingOps = this.__calls.filter((c) => isDrawingOp(c.op)).length;
    const summary = {
      version: VERSION,
      canvas: { width: this.canvas.width, height: this.canvas.height },
      calls: this.__calls.length,
      drawingOps,
      saveDepth: this.__stack.length,
      saves: this.__stats.saves,
      restores: this.__stats.restores,
      restoresUnderflow: this.__stats.restoreUnderflow,
      balanced: this.__stats.restoreUnderflow === 0 && this.__stack.length === 0,
      warnings: this.__warnCount,
      warningList: this.__warnings.slice(0, 20),
      frames: this.__marks.filter((m) => m.kind === 'raf').length,
      marks: this.__marks.length,
      clipBox: this.__clipBox,
      stats: JSON.parse(JSON.stringify(this.__stats)),
    };
    const problems = [];
    if (this.__stats.restoreUnderflow) problems.push(`restore() underflowed ${this.__stats.restoreUnderflow}x`);
    if (this.__stack.length) problems.push(`${this.__stack.length} unbalanced save() at end of run`);
    if (this.__warnCount) problems.push(`${this.__warnCount} numeric warning(s)`);
    summary.assertionErrors = problems;
    if (opts.strict && problems.length) {
      throw new Error('canvas finalize failed: ' + problems.join('; '));
    }
    this.__finalized = summary;
    return summary;
  }

  get __clipBox() {
    const b = this.__state.clipBox;
    return b ? { ...b } : null;
  }

  /* ------------------------------------------------ digest for renders - */

  /**
   * Normalise recorded calls into a replayable op stream (device space).
   * frame: 'last' (default) replays the final animation frame only, 'all' replays
   * everything. Clip state that was established BEFORE the chosen start index is
   * re-emitted so the replay stays clipped like the live canvas.
   */
  __digest(opts = {}) {
    const frame = opts.frame || 'last';
    const notes = [];
    let from = 0;
    if (frame === 'last') from = this.__pickFrameStart();
    const ops = [];
    // carry clip state established before `from`
    if (from > 0) {
      const clips = this.__clipsAt(from);
      for (const c of clips) ops.push({ t: 'clip', subpaths: cloneSubpaths(c) });
      if (clips.length) notes.push(`re-emitted ${clips.length} clip(s) that were active before the replayed frame`);
    }
    for (let i = from; i < this.__calls.length; i++) {
      const c = this.__calls[i];
      const d = this.__digestCall(c, notes);
      if (d) ops.push(d);
    }
    return {
      w: opts.width || this.canvas.width,
      h: opts.height || this.canvas.height,
      background: opts.background || '#ffffff',
      frame,
      from,
      ops,
      notes,
      stats: this.__stats,
    };
  }

  __pickFrameStart() {
    const marks = this.__marks.slice();
    if (!marks.length) return 0;
    for (let i = marks.length - 1; i >= 0; i--) {
      let count = 0;
      for (let k = marks[i].at; k < this.__calls.length; k++) {
        if (isDrawingOp(this.__calls[k].op)) { count++; if (count >= 1) break; }
      }
      if (count >= 1) return marks[i].at;
    }
    return 0;
  }

  __clipsAt(index) {
    const out = [];
    const stack = [];
    for (let i = 0; i < index && i < this.__calls.length; i++) {
      const c = this.__calls[i];
      if (c.op === 'save') stack.push(out.length);
      else if (c.op === 'restore') { if (stack.length) out.length = stack.pop(); }
      else if (c.op === 'clip' && c.subpaths) out.push(c.subpaths);
    }
    return out;
  }

  __digestCall(c, notes) {
    const s = c.style;
    switch (c.op) {
      case 'save': return { t: 'save' };
      case 'restore': return { t: 'restore' };
      case 'clip': return { t: 'clip', subpaths: cloneSubpaths(c.subpaths || []), kind: c.kind };
      case 'fill':
        if (!c.subpaths || !c.subpaths.length) return null;
        return {
          t: 'fill', subpaths: cloneSubpaths(c.subpaths), paint: digestPaint(s.fillStyle, notes),
          alpha: clamp01(s.globalAlpha), rule: c.rule || 'nonzero', shadow: digestShadow(s, notes),
          composite: s.globalCompositeOperation,
        };
      case 'stroke':
        if (!c.subpaths || !c.subpaths.length) return null;
        return {
          t: 'stroke', subpaths: cloneSubpaths(c.subpaths), paint: digestPaint(s.strokeStyle, notes),
          alpha: clamp01(s.globalAlpha), width: s.lineWidth, cap: s.lineCap, join: s.lineJoin,
          miter: s.miterLimit, dash: (c.dash || []).slice(), dashOffset: c.dashOffset || 0,
          shadow: digestShadow(s, notes), composite: s.globalCompositeOperation,
        };
      case 'fillRect': {
        const b = c.bbox;
        return {
          t: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, fill: digestPaint(s.fillStyle, notes),
          stroke: null, width: 0, alpha: clamp01(s.globalAlpha), shadow: digestShadow(s, notes),
          composite: s.globalCompositeOperation,
        };
      }
      case 'strokeRect': {
        const b = c.bbox;
        return {
          t: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, fill: null,
          stroke: digestPaint(s.strokeStyle, notes), width: s.lineWidth, cap: s.lineCap,
          join: s.lineJoin, dash: (c.dash || []).slice(), dashOffset: c.dashOffset || 0,
          alpha: clamp01(s.globalAlpha), shadow: digestShadow(s, notes),
          composite: s.globalCompositeOperation,
        };
      }
      case 'clearRect': {
        const b = c.bbox;
        return { t: 'clear', x: b.x, y: b.y, w: b.w, h: b.h };
      }
      case 'fillText':
      case 'strokeText':
        return {
          t: 'text', text: c.text, x: c.x, y: c.y, matrix: c.transform.slice(),
          font: c.font, align: s.textAlign, baseline: s.textBaseline,
          fill: c.op === 'fillText' ? digestPaint(s.fillStyle, notes) : null,
          stroke: c.op === 'strokeText' ? digestPaint(s.strokeStyle, notes) : null,
          strokeWidth: s.lineWidth, alpha: clamp01(s.globalAlpha),
          width: c.width, shadow: digestShadow(s, notes),
        };
      case 'drawImage': {
        const b = c.bbox || { x: 0, y: 0, w: 0, h: 0 };
        notes.push('drawImage replayed as a placeholder box');
        return {
          t: 'image', x: b.x, y: b.y, w: b.w, h: b.h, matrix: c.transform.slice(),
          alpha: clamp01(c.alpha === undefined ? 1 : c.alpha), label: c.args[0],
        };
      }
      default:
        return null;
    }
  }
}

function isDrawingOp(op) {
  return op === 'fill' || op === 'stroke' || op === 'fillRect' || op === 'strokeRect'
    || op === 'fillText' || op === 'strokeText' || op === 'drawImage' || op === 'clearRect';
}

function clamp01(n) { return !Number.isFinite(n) ? 1 : n < 0 ? 0 : n > 1 ? 1 : n; }

function colorKey(style) {
  if (style && style.__gradient) return '__gradient:' + style.__gradient.type;
  if (style && style.__pattern) return '__pattern';
  return String(style);
}

function describeImage(image) {
  if (!image) return null;
  if (image.__isCanvas) return `<canvas#${image.id || '?'} ${image.width}x${image.height}>`;
  if (typeof image === 'object') {
    const tag = image.tagName ? image.tagName.toLowerCase() : (image.constructor ? image.constructor.name : 'object');
    return `<${tag} ${image.width || 0}x${image.height || 0}>`;
  }
  return String(image);
}

function makeGradient(type, params) {
  const grad = { type, stops: [], ...params, transform: [1, 0, 0, 1, 0, 0] };
  const obj = {
    __gradient: grad,
    addColorStop(offset, color) {
      const off = Number(offset);
      if (!Number.isFinite(off) || off < 0 || off > 1) {
        throw new Error(`IndexSizeError: The provided value (${offset}) is outside the range [0, 1]`);
      }
      const parsed = parseColor(color);
      grad.stops.push({ offset: off, color: String(color), rgba: parsed || [0, 0, 0, 1], unparsed: !parsed });
      grad.stops.sort((a, b) => a.offset - b.offset);
    },
    setTransform() {},
    toString() { return `[${type} gradient]`; },
  };
  return obj;
}

function digestPaint(style, notes) {
  if (style && style.__gradient) {
    const g = style.__gradient;
    return {
      kind: 'gradient',
      grad: {
        type: g.type,
        x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1,
        r0: g.r0, r1: g.r1, x: g.x, y: g.y, startAngle: g.startAngle,
        stops: g.stops.map((s) => [s.offset, s.rgba.slice()]),
        css: g.stops.length ? g.stops[0].color : '#000000',
        cssLast: g.stops.length ? g.stops[g.stops.length - 1].color : '#000000',
      },
    };
  }
  if (style && style.__pattern) {
    if (notes && !notes.includes('patterns rendered as a flat colour')) notes.push('patterns rendered as a flat colour');
    return { kind: 'color', rgba: [128, 128, 128, 1] };
  }
  const parsed = parseColor(style);
  if (!parsed) {
    if (notes && notes.length < 40 && !notes.includes(`unparsed colour "${String(style)}"`)) {
      notes.push(`unparsed colour "${String(style)}" (rendered black)`);
    }
    return { kind: 'color', rgba: [0, 0, 0, 1], raw: String(style) };
  }
  return { kind: 'color', rgba: parsed, raw: String(style) };
}

function digestShadow(s, notes) {
  const col = parseColor(s.shadowColor);
  if (!col || col[3] <= 0) return null;
  if (!(s.shadowBlur > 0) && !s.shadowOffsetX && !s.shadowOffsetY) return null;
  if (notes && !notes.includes('shadows are approximated')) notes.push('shadows are approximated');
  return { rgba: col, blur: Math.max(0, s.shadowBlur), dx: s.shadowOffsetX || 0, dy: s.shadowOffsetY || 0 };
}

/** Normalise a roundRect radii argument (CSS-ish: [tl, tr, br, bl]). */
function normalizeRadii(radii, w, h) {
  const pairs = [];
  const asPair = (v) => {
    if (Array.isArray(v)) return [Number(v[0]) || 0, Number(v[1] === undefined ? v[0] : v[1]) || 0];
    if (v && typeof v === 'object') return [Number(v.x) || 0, Number(v.y === undefined ? v.x : v.y) || 0];
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return [n, n];
  };
  if (radii === undefined || radii === null) {
    pairs.push([0, 0], [0, 0], [0, 0], [0, 0]);
  } else if (typeof radii === 'number') {
    const p = asPair(radii);
    pairs.push(p, p.slice(), p.slice(), p.slice());
  } else if (Array.isArray(radii)) {
    if (!radii.length) return { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
    const ps = radii.map(asPair);
    if (ps.some((p) => !p)) return null;
    if (ps.length === 1) pairs.push(ps[0], ps[0].slice(), ps[0].slice(), ps[0].slice());
    else if (ps.length === 2) pairs.push(ps[0], ps[1].slice(), ps[0].slice(), ps[1].slice());
    else if (ps.length === 3) pairs.push(ps[0], ps[1].slice(), ps[2].slice(), ps[1].slice());
    else pairs.push(ps[0], ps[1].slice(), ps[2].slice(), ps[3].slice());
  } else if (typeof radii === 'object') {
    const p = asPair(radii);
    if (!p) return null;
    pairs.push(p, p.slice(), p.slice(), p.slice());
  } else return null;

  for (const p of pairs) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  for (const p of pairs) if (p[0] < 0 || p[1] < 0) throw new Error('RangeError: radii must be non-negative');

  let scale = 1;
  const limit = (a, b, total) => {
    const sum = a + b;
    if (sum > total && sum > 0) scale = Math.min(scale, total / sum);
  };
  limit(pairs[0][0], pairs[1][0], Math.abs(w));
  limit(pairs[3][0], pairs[2][0], Math.abs(w));
  limit(pairs[0][1], pairs[3][1], Math.abs(h));
  limit(pairs[1][1], pairs[2][1], Math.abs(h));
  if (scale < 1) for (const p of pairs) { p[0] *= scale; p[1] *= scale; }
  return { tl: pairs[0], tr: pairs[1], br: pairs[2], bl: pairs[3] };
}

/* ------------------------------------------- context state properties -- */

/** Every canvas state property is an accessor so save/restore really reverts it. */
for (const key of STATE_KEYS) {
  Object.defineProperty(RecordingContext2D.prototype, key, {
    enumerable: true,
    configurable: true,
    get() { return this.__state[key]; },
    set(v) {
      const s = this.__state;
      switch (key) {
        case 'lineWidth': {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0) return;   // browsers ignore invalid line widths
          s[key] = n;
          break;
        }
        case 'miterLimit':
        case 'shadowBlur': {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return;
          s[key] = n;
          break;
        }
        case 'shadowOffsetX':
        case 'shadowOffsetY':
        case 'lineDashOffset': {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          s[key] = n;
          break;
        }
        case 'globalAlpha': {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          s[key] = n < 0 ? 0 : n > 1 ? 1 : n;
          break;
        }
        case 'imageSmoothingEnabled':
          s[key] = !!v;
          break;
        default:
          s[key] = v;
      }
      this.__stats.styleSets++;
      if (this.__sets.length < 5000) {
        this.__sets.push({ key, value: (v && typeof v === 'object') ? colorKey(v) : v });
      }
    },
  });
}

/* ==================================================================== */
/* SVG writer                                                            */
/* ==================================================================== */

function svgPathD(subpaths, closeAll) {
  const parts = [];
  for (const sp of subpaths) {
    const pts = sp.pts || [];
    if (!pts.length) continue;
    parts.push(`M${r2(pts[0][0])} ${r2(pts[0][1])}`);
    for (let i = 1; i < pts.length; i++) parts.push(`L${r2(pts[i][0])} ${r2(pts[i][1])}`);
    if (closeAll || sp.closed) parts.push('Z');
  }
  return parts.join(' ');
}

function svgNumList(arr) {
  return arr.map((n) => r2(n)).join(' ');
}

function paintToSvg(paint, alpha, defs, seq) {
  if (!paint) return { attrs: '', opacity: alpha };
  if (paint.kind === 'gradient') {
    const g = paint.grad;
    const id = `grad${++seq.n}`;
    if (g.type === 'radial') {
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${r2(g.x0)}" cy="${r2(g.y0)}" r="${r2(Math.max(g.r0, 1e-3))}" fx="${r2(g.x1)}" fy="${r2(g.y1)}">`
        + g.stops.map((st) => `<stop offset="${r2(st[0] * 100)}%" stop-color="${rgbaToCss(st[1])}" stop-opacity="${r2(st[1][3])}"/>`).join('')
        + '</radialGradient>',
      );
    } else {
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(g.x0)}" y1="${r2(g.y0)}" x2="${r2(g.x1)}" y2="${r2(g.y1)}">`
        + g.stops.map((st) => `<stop offset="${r2(st[0] * 100)}%" stop-color="${rgbaToCss(st[1])}" stop-opacity="${r2(st[1][3])}"/>`).join('')
        + '</linearGradient>',
      );
    }
    return { attrs: `url(#${id})`, opacity: alpha };
  }
  const c = paint.rgba || [0, 0, 0, 1];
  return { attrs: rgbaToCss(c), opacity: r2(clamp01(alpha) * c[3]) };
}

function shadowToSvg(shadow, defs, cache) {
  if (!shadow) return '';
  const key = `${shadow.dx},${shadow.dy},${shadow.blur},${shadow.rgba.join(',')}`;
  if (cache.has(key)) return ` filter="url(#${cache.get(key)})"`;
  const id = 'shadow' + (cache.size + 1);
  cache.set(key, id);
  defs.push(
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">`
    + `<feDropShadow dx="${r2(shadow.dx)}" dy="${r2(shadow.dy)}" stdDeviation="${r2(shadow.blur / 2)}" `
    + `flood-color="${rgbaToCss(shadow.rgba)}" flood-opacity="${r2(shadow.rgba[3])}"/></filter>`,
  );
  return ` filter="url(#${id})"`;
}

/** Replay a digest op-stream into an SVG string. */
export function digestToSVG(digest) {
  const w = digest.w, h = digest.h;
  const defs = [];
  const out = [];
  const seq = { n: 0 };
  const shadowCache = new Map();
  let openGroups = 0;
  const scopeStack = [];
  const closeTo = (n) => { while (openGroups > n) { out.push('</g>'); openGroups--; } };
  const clipCache = new Map();

  const clipFor = (subpaths) => {
    const d = svgPathD(subpaths, true);
    if (clipCache.has(d)) return clipCache.get(d);
    const id = `clip${clipCache.size + 1}`;
    clipCache.set(d, id);
    const single = subpaths.length === 1 ? subpaths[0] : null;
    if (single && single.kind === 'rect' && single.pts.length <= 5) {
      const xs = single.pts.map((p) => p[0]), ys = single.pts.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      defs.push(`<clipPath id="${id}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(...xs) - x)}" height="${r2(Math.max(...ys) - y)}"/></clipPath>`);
    } else {
      defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    }
    return id;
  };

  for (const op of digest.ops) {
    switch (op.t) {
      case 'save':
        scopeStack.push(openGroups);
        break;
      case 'restore':
        closeTo(scopeStack.length ? scopeStack.pop() : 0);
        break;
      case 'clip': {
        const id = clipFor(op.subpaths);
        out.push(`<g clip-path="url(#${id})">`);
        openGroups++;
        break;
      }
      case 'clear':
        out.push(`<rect x="${r2(op.x)}" y="${r2(op.y)}" width="${r2(op.w)}" height="${r2(op.h)}" fill="${digest.background}"/>`);
        break;
      case 'rect': {
        const sh = shadowToSvg(op.shadow, defs, shadowCache);
        if (op.fill) {
          const p = paintToSvg(op.fill, op.alpha, defs, seq);
          out.push(`<rect x="${r2(op.x)}" y="${r2(op.y)}" width="${r2(op.w)}" height="${r2(op.h)}" fill="${p.attrs}" fill-opacity="${p.opacity}"${sh}/>`);
        }
        if (op.stroke) {
          const p = paintToSvg(op.stroke, op.alpha, defs, seq);
          const dash = op.dash && op.dash.length ? ` stroke-dasharray="${svgNumList(op.dash)}"` : '';
          out.push(`<rect x="${r2(op.x)}" y="${r2(op.y)}" width="${r2(op.w)}" height="${r2(op.h)}" fill="none" stroke="${p.attrs}" stroke-opacity="${p.opacity}" stroke-width="${r2(op.width)}" stroke-linecap="${op.cap || 'butt'}" stroke-linejoin="${op.join || 'miter'}"${dash}${sh}/>`);
        }
        break;
      }
      case 'fill': {
        const p = paintToSvg(op.paint, op.alpha, defs, seq);
        const sh = shadowToSvg(op.shadow, defs, shadowCache);
        out.push(`<path d="${svgPathD(op.subpaths, true)}" fill="${p.attrs}" fill-opacity="${p.opacity}" fill-rule="${op.rule === 'evenodd' ? 'evenodd' : 'nonzero'}"${sh}/>`);
        break;
      }
      case 'stroke': {
        const p = paintToSvg(op.paint, op.alpha, defs, seq);
        const sh = shadowToSvg(op.shadow, defs, shadowCache);
        const dash = op.dash && op.dash.length ? ` stroke-dasharray="${svgNumList(op.dash)}"` : '';
        out.push(`<path d="${svgPathD(op.subpaths, false)}" fill="none" stroke="${p.attrs}" stroke-opacity="${p.opacity}" stroke-width="${r2(op.width)}" stroke-linecap="${op.cap || 'butt'}" stroke-linejoin="${op.join || 'miter'}" stroke-miterlimit="${r2(op.miter || 10)}"${dash}${sh}/>`);
        break;
      }
      case 'text': {
        const p = op.fill ? paintToSvg(op.fill, op.alpha, defs, seq) : { attrs: 'none', opacity: 0 };
        const sp = op.stroke ? paintToSvg(op.stroke, op.alpha, defs, seq) : null;
        const sh = shadowToSvg(op.shadow, defs, shadowCache);
        const m = op.matrix || [1, 0, 0, 1, 0, 0];
        const identity = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
        const anchor = { start: 'start', left: 'start', center: 'middle', right: 'end', end: 'end' }[op.align] || 'start';
        const baseline = { alphabetic: 'alphabetic', top: 'hanging', middle: 'central', bottom: 'text-bottom', hanging: 'hanging', ideographic: 'ideographic' }[op.baseline] || 'alphabetic';
        const attrs = `x="${r2(op.x)}" y="${r2(op.y)}" font-family="${xmlEsc(op.font.family)}" font-size="${r2(op.font.size)}"`
          + ` font-weight="${xmlEsc(op.font.weight)}" font-style="${xmlEsc(op.font.style)}"`
          + ` text-anchor="${anchor}" dominant-baseline="${baseline}"`
          + ` fill="${p.attrs}" fill-opacity="${p.opacity}"`
          + (sp ? ` stroke="${sp.attrs}" stroke-opacity="${sp.opacity}" stroke-width="${r2(op.strokeWidth)}"` : '')
          + sh;
        const text = `<text ${attrs}>${xmlEsc(op.text)}</text>`;
        if (identity) out.push(text);
        else {
          const mm = identity ? m : m;
          out.push(`<g transform="matrix(${r2(mm[0])} ${r2(mm[1])} ${r2(mm[2])} ${r2(mm[3])} ${r2(mm[4])} ${r2(mm[5])})">${text}</g>`);
        }
        break;
      }
      case 'image': {
        const m = op.matrix || [1, 0, 0, 1, 0, 0];
        const g = `<rect x="${r2(op.x)}" y="${r2(op.y)}" width="${r2(op.w)}" height="${r2(op.h)}" fill="#b0b0b0" fill-opacity="0.35" stroke="#808080" stroke-width="1" stroke-dasharray="4 3"/>`
          + `<text x="${r2(op.x + 4)}" y="${r2(op.y + 14)}" font-family="sans-serif" font-size="11" fill="#555">drawImage ${xmlEsc(op.label || '')}</text>`;
        out.push(`<g transform="matrix(${r2(m[0])} ${r2(m[1])} ${r2(m[2])} ${r2(m[3])} ${r2(m[4])} ${r2(m[5])})">${g}</g>`);
        break;
      }
      default:
        break;
    }
    out.push('\n');
  }
  closeTo(0);

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`
    + `<!-- generated by mockdom.mjs v${VERSION}; frame=${digest.frame}; ops=${digest.ops.length}; notes=${digest.notes.join(' | ')} -->\n`
    + `<rect x="0" y="0" width="${w}" height="${h}" fill="${digest.background}"/>\n`
    + (defs.length ? `<defs>\n${defs.join('\n')}\n</defs>\n` : '')
    + out.join('')
    + `</svg>\n`;
}

/* ==================================================================== */
/* PNG rasterisation via Python + Pillow                                 */
/* ==================================================================== */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PY_CANDIDATES = [
  process.env.MOCKDOM_PYTHON,
  process.env.PLR_PYTHON,
  'C:\\Users\\l4place\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe',
];

export function resolvePython(explicit) {
  const cands = [explicit, ...PY_CANDIDATES].filter(Boolean);
  for (const c of cands) {
    try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
  }
  return 'python';
}

/**
 * Rasterise a digest through Python/Pillow. Returns the PNG path.
 * The intermediate op-JSON is written next to the PNG as "<png>.ops.json".
 *
 * The rasterizer file is `mockdom_raster.py` by default ($MOCKDOM_RASTER or
 * opts.rasterizeScript override it). It is deliberately NOT called
 * `rasterize.py`: a sibling agent owns that filename in this `_dev/` folder
 * with an incompatible schema.
 */
export function rasterizeDigest(digest, outPath, opts = {}) {
  const script = opts.rasterizeScript || process.env.MOCKDOM_RASTER
    || path.join(__dirname, 'mockdom_raster.py');
  if (!fs.existsSync(script)) throw new Error('rasterizer script not found at ' + script);
  const jsonPath = outPath + '.ops.json';
  const logPath = outPath + '.log.json';
  const payload = {
    w: digest.w, h: digest.h, background: digest.background,
    frame: digest.frame, from: digest.from, notes: digest.notes,
    ops: digest.ops,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(payload));
  try { fs.rmSync(logPath, { force: true }); } catch { /* ignore */ }
  const py = resolvePython(opts.python);
  const res = spawnSync(py, [script, jsonPath, outPath, logPath], {
    stdio: ['ignore', 'ignore', 'ignore'],   // named pipes are blocked in this sandbox
    windowsHide: true,
  });
  let raster = { ok: false, errors: [], warnings: [] };
  try { raster = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { /* ignore */ }
  const ok = res.status === 0 && fs.existsSync(outPath);
  if (!ok) {
    let log = '';
    try { log = fs.readFileSync(logPath, 'utf8').slice(-4000); } catch { /* ignore */ }
    throw new Error(`rasterizer failed (status=${res.status}${res.error ? ', ' + res.error.message : ''})\n${log}`);
  }
  let bytes = 0;
  try { bytes = fs.statSync(outPath).size; } catch { /* ignore */ }
  return { path: outPath, bytes, opsPath: jsonPath, logPath, python: py, raster };
}

/* ==================================================================== */
/* page factory                                                          */
/* ==================================================================== */

function resolveFile(p, extraRoots = []) {
  const cands = [];
  if (path.isAbsolute(p)) cands.push(p);
  else {
    cands.push(path.resolve(process.cwd(), p));
    for (const r of extraRoots) if (r) cands.push(path.resolve(r, p));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  return cands[0];
}

function makeMatchMedia(page) {
  const evaluate = (query) => {
    const q = String(query || '').trim();
    if (!q) return false;
    const orParts = q.split(',');
    for (let part of orParts) {
      part = part.trim().toLowerCase();
      let negate = false;
      if (part.startsWith('not ')) { negate = true; part = part.slice(4).trim(); }
      else if (part.startsWith('only ')) { part = part.slice(5).trim(); }
      const conds = part.split(/\s+and\s+/);
      let all = true;
      for (const cond of conds) {
        const m = /^\(\s*([\w-]+)\s*(?::\s*([^)]+))?\)$/.exec(cond.trim());
        if (!m) { all = false; break; }
        const name = m[1];
        const value = (m[2] || '').trim();
        const px = parseFloat(value);
        switch (name) {
          case 'min-width': all = all && page.window.innerWidth >= px; break;
          case 'max-width': all = all && page.window.innerWidth <= px; break;
          case 'min-height': all = all && page.window.innerHeight >= px; break;
          case 'max-height': all = all && page.window.innerHeight <= px; break;
          case 'width': all = all && page.window.innerWidth === px; break;
          case 'height': all = all && page.window.innerHeight === px; break;
          case 'orientation': all = all && (value === 'landscape'
            ? page.window.innerWidth >= page.window.innerHeight
            : page.window.innerHeight > page.window.innerWidth); break;
          case 'prefers-color-scheme': all = all && value === (page.opts.colorScheme || 'light'); break;
          case 'prefers-reduced-motion': all = all && value === 'no-preference'; break;
          case 'pointer': all = all && value === 'fine'; break;
          case 'any-pointer': all = all && value === 'fine'; break;
          case 'hover': all = all && value === 'hover'; break;
          case 'any-hover': all = all && value === 'hover'; break;
          case 'display-mode': all = all && value === 'browser'; break;
          case 'min-resolution': all = all && page.window.devicePixelRatio >= 1; break;
          default: all = false;
        }
        if (!all) break;
      }
      if (negate ? !all : all) return true;
    }
    return false;
  };
  return (query) => {
    const matches = evaluate(query);
    const mql = {
      media: String(query), matches, onchange: null,
      __listeners: new Map(),
      addEventListener(type, fn) {
        if (!this.__listeners.has(type)) this.__listeners.set(type, []);
        this.__listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const l = this.__listeners.get(type);
        if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
      },
      addListener(fn) { this.addEventListener('change', fn); },
      removeListener(fn) { this.removeEventListener('change', fn); },
      dispatchEvent() { return true; },
    };
    page.mediaQueries.push({ query: String(query), matches });
    return mql;
  };
}

function defaultsFor(tag) {
  const t = String(tag || '').toLowerCase();
  if (t === 'canvas') return { width: '300px', height: '150px' };
  if (t === 'span' || t === 'a' || t === 'img' || t === 'button' || t === 'input' || t === 'label') return { display: 'inline' };
  return { display: 'block' };
}

/* One process-level rejection handler shared by every live page, so creating
   many pages in one process does not trip Node's listener warning. */
const LIVE_PAGES = new Set();
let rejectHandler = null;

function attachRejectionHandler(page) {
  LIVE_PAGES.add(page);
  if (!rejectHandler) {
    rejectHandler = (reason) => {
      const p = [...LIVE_PAGES].pop();
      if (p) p.__recordError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
    };
    process.on('unhandledRejection', rejectHandler);
  }
}

function detachRejectionHandler(page) {
  LIVE_PAGES.delete(page);
  if (LIVE_PAGES.size === 0 && rejectHandler) {
    process.removeListener('unhandledRejection', rejectHandler);
    rejectHandler = null;
  }
}

/**
 * Create a mock page. See the file header for the fidelity contract.
 * opts: { width, height, devicePixelRatio, verbose, seed, autoCreateMissingIds,
 *         colorScheme, userAgent, rootDir, python }
 */
export function createPage(opts = {}) {
  const o = Object.assign({
    width: 1440,
    height: 900,
    devicePixelRatio: 1,
    verbose: false,
    seed: 20240929,
    autoCreateMissingIds: false,
    colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MockDOM/1.0 Chrome/122.0.0.0 Safari/537.36',
    rootDir: path.resolve(__dirname, '..'),
    python: null,
  }, opts || {});

  /* ------------------------------------------------------------ clock --- */
  const clock = { now: 0, epoch: Date.now() };
  let seedState = (o.seed >>> 0) || 1;
  const seededRandom = () => {
    seedState |= 0; seedState = (seedState + 0x6D2B79F5) | 0;
    let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const page = {
    opts: o,
    version: VERSION,
    clock,
    errors: [],
    notes: [],
    warnings: [],
    missingIds: [],
    consoleLogs: [],
    mediaQueries: [],
    contexts: [],
    htmlPath: null,
    __htmlScripts: [],
    frameCount: 0,
    steps: 0,
    __raf: new Map(),
    __rafSeq: 1,
    __rafRuns: 0,
    __timers: new Map(),
    __timerSeq: 1,
    __closed: false,
  };

  /* -------------------------------------------------------------- dom --- */
  const document = new MockDocument(page);
  page.document = document;
  const ctxVm = vm.createContext({});
  const win = vm.runInContext('globalThis', ctxVm);
  page.window = win;
  page.vmContext = ctxVm;

  Object.defineProperty(page, 'canvasElement', {
    get() {
      for (const el of document.__all) if (el.__isCanvas) return el;
      return null;
    },
  });
  Object.defineProperty(page, 'canvas', {
    get() { return page.canvasElement; },
  });

  /**
   * Resolve an element's CSS box. There is no real layout engine: this walks the
   * parsed stylesheet rules (plus inline styles) and resolves px/%/vw/vh/em/calc
   * against the containing block, defaulting html/body to the viewport. That is
   * what makes `canvas.clientWidth` (the usual canvas-sizing idiom) faithful.
   */
  page.elementBox = (el) => {
    const vp = { w: win.innerWidth || o.width, h: win.innerHeight || o.height };
    const memo = new Map();
    const SKIP = new Set(['head', 'script', 'style', 'link', 'meta', 'title', 'base']);
    const walk = (node) => {
      if (!node || node.nodeType !== 1) return { w: 0, h: 0 };
      if (memo.has(node)) return memo.get(node);
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (SKIP.has(tag)) { const r = { w: 0, h: 0 }; memo.set(node, r); return r; }
      const decls = Object.assign(declsFor(node, document.__styleRules), inlineDecls(node));
      if (String(decls.display || '').toLowerCase() === 'none') {
        const r = { w: 0, h: 0 };
        memo.set(node, r);
        return r;
      }
      let pw = vp.w, ph = vp.h;
      if (tag !== 'html') {
        const parent = node.parentElement || document.documentElement;
        const pb = walk(parent);
        pw = pb.w || vp.w;
        ph = pb.h || 0;
      }
      if (node.__isCanvas && !decls.width) pw = node.__w;   // canvas fallback below
      let w = resolveLength(decls.width, pw, vp);
      let h = resolveLength(decls.height, ph, vp);
      const positioned = /(fixed|absolute)/.test(String(decls.position || ''));
      if (w === null) {
        if (node.__isCanvas) w = node.__w;              // browser default canvas box
        else if (tag === 'html' || tag === 'body') w = vp.w;
        else if (positioned && decls.inset !== undefined) w = pw;
        else w = pw;                                    // block boxes fill their container
      }
      if (h === null) {
        if (node.__isCanvas) h = node.__h;
        else if (tag === 'html' || tag === 'body') h = vp.h;
        else if (positioned && decls.inset !== undefined) h = ph || vp.h;
        else h = 0;                                     // height:auto
      }
      const r = { w: Math.max(0, Math.round(w)), h: Math.max(0, Math.round(h)) };
      memo.set(node, r);
      return r;
    };
    return walk(el);
  };

  page.mainContext = () => {
    let best = null, bestOps = -1;
    for (const c of page.contexts) {
      const n = c.__calls.filter((x) => isDrawingOp(x.op)).length;
      if (n > bestOps) { best = c; bestOps = n; }
    }
    return best || page.contexts[0] || null;
  };

  page.__recordError = (where, err) => {
    const entry = {
      where,
      name: err && err.name ? String(err.name) : 'Error',
      message: err && err.message !== undefined ? String(err.message) : String(err),
      stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : '',
      time: clock.now,
    };
    page.errors.push(entry);
    if (o.verbose) console.error(`[mockdom] ${where}: ${entry.name}: ${entry.message}`);
    return entry;
  };

  /* ---------------------------------------------------------- timers ---- */
  const EPS = 1e-6;

  page.setTimeout = (fn, delay, ...args) => {
    if (typeof fn !== 'function') return 0;
    const id = page.__timerSeq++;
    const d = Math.max(0, Number(delay) || 0);
    page.__timers.set(id, { id, time: clock.now + d, fn, args, interval: null });
    return id;
  };
  page.setInterval = (fn, delay, ...args) => {
    if (typeof fn !== 'function') return 0;
    const id = page.__timerSeq++;
    const d = Math.max(1, Number(delay) || 0);
    page.__timers.set(id, { id, time: clock.now + d, fn, args, interval: d });
    return id;
  };
  page.clearTimeout = (id) => { page.__timers.delete(Number(id)); };
  page.clearInterval = (id) => { page.__timers.delete(Number(id)); };

  page.__runTimers = () => {
    let guard = 0;
    for (;;) {
      let due = null;
      for (const t of page.__timers.values()) {
        if (t.time <= clock.now + EPS) {
          if (!due || t.time < due.time || (t.time === due.time && t.id < due.id)) due = t;
        }
      }
      if (!due) break;
      if (++guard > 20000) {
        page.__recordError('timer', new Error('timer loop guard tripped (>20000 callbacks in one clock step) — likely setTimeout(fn, 0) recursion'));
        break;
      }
      if (due.interval === null) page.__timers.delete(due.id);
      else due.time = due.time + due.interval;
      if (due.interval !== null && due.time <= clock.now + EPS) due.time = clock.now + due.interval;
      try { due.fn.apply(win, due.args); } catch (e) { page.__recordError('timer', e); }
    }
  };

  /* ------------------------------------------------------------- raf ---- */
  page.requestAnimationFrame = (cb) => {
    if (typeof cb !== 'function') return 0;
    const id = page.__rafSeq++;
    page.__raf.set(id, { id, cb });
    return id;
  };
  page.cancelAnimationFrame = (id) => { page.__raf.delete(Number(id)); };

  page.__runRaf = () => {
    const cbs = [...page.__raf.values()];
    page.__raf.clear();
    if (!cbs.length) return 0;
    page.frameCount++;
    for (const c of page.contexts) c.__markFrame('raf');
    for (const rec of cbs) {
      try { rec.cb.call(win, clock.now); } catch (e) { page.__recordError('raf', e); }
    }
    page.__rafRuns++;
    return cbs.length;
  };

  /**
   * Advance the virtual clock in ~16.667ms steps, firing due timers and every
   * registered rAF callback once per step. Returns the number of steps.
   */
  page.advance = (ms, advOpts = {}) => {
    const stepMs = advOpts.stepMs || (1000 / 60);
    const target = clock.now + Math.max(0, Number(ms) || 0);
    let steps = 0;
    while (target - clock.now > EPS) {
      const step = Math.min(stepMs, target - clock.now);
      clock.now += step;
      page.steps++;
      steps++;
      page.__runTimers();
      page.__runRaf();
      if (steps > 2000000) { page.__recordError('clock', new Error('advance() guard tripped')); break; }
    }
    return steps;
  };

  page.performanceNow = () => clock.now;

  /* ----------------------------------------------------------- events --- */

  page.__dispatch = (target, ev) => {
    if (!ev || typeof ev.type !== 'string') return true;
    const path = [];
    let node = target;
    while (node) {
      path.push(node);
      if (node === win) break;
      if (node === document) { node = win; continue; }
      node = node.parentNode || null;
    }
    if (path[path.length - 1] !== win) path.push(win);
    if (!path.includes(document)) path.splice(path.length - 1, 0, document);

    ev.timeStamp = clock.now;
    const invoke = (n, listener, phase) => {
      ev.currentTarget = n;
      ev.eventPhase = phase;
      try {
        if (typeof listener.fn === 'function') listener.fn.call(n, ev);
        else if (listener.fn && typeof listener.fn.handleEvent === 'function') listener.fn.handleEvent(ev);
      } catch (e) {
        page.__recordError('event:' + ev.type, e);
      }
    };
    const listenersOf = (n) => (n && n.__listeners) ? (n.__listeners.get(ev.type) || []).slice() : [];
    const handlerFor = (n) => {
      if (!n) return null;
      if (typeof n.__handlerFor === 'function') return n.__handlerFor(ev.type);
      const h = n['on' + ev.type];
      return typeof h === 'function' ? h : null;
    };

    // capture: window -> target's parent
    if (ev.bubbles !== false || true) {
      for (let i = path.length - 1; i >= 1; i--) {
        for (const l of listenersOf(path[i])) {
          if (!l.capture) continue;
          invoke(path[i], l, 1);
          if (l.once) path[i].removeEventListener(ev.type, l.fn, true);
          if (ev.__stoppedImmediate) break;
        }
        if (ev.__stopped) return !ev.defaultPrevented;
      }
    }
    // target
    for (const l of listenersOf(path[0])) {
      invoke(path[0], l, 2);
      if (l.once) path[0].removeEventListener(ev.type, l.fn, l.capture);
      if (ev.__stoppedImmediate) break;
    }
    const onTarget = handlerFor(path[0]);
    if (onTarget) invoke(path[0], { fn: onTarget }, 2);
    if (ev.__stopped) return !ev.defaultPrevented;

    // bubble
    for (let i = 1; i < path.length; i++) {
      for (const l of listenersOf(path[i])) {
        if (l.capture) continue;
        invoke(path[i], l, 3);
        if (l.once) path[i].removeEventListener(ev.type, l.fn, false);
        if (ev.__stoppedImmediate) break;
      }
      const h = handlerFor(path[i]);
      if (h) invoke(path[i], { fn: h }, 3);
      if (ev.__stopped) break;
    }
    return !ev.defaultPrevented;
  };

  page.fire = (target, ev, type) => {
    if (type && ev) ev.type = String(type);
    const t = target || page.canvasElement || document.body;
    return page.__dispatch(t, ev);
  };

  page.pointerTarget = () => page.canvasElement || document.body || document;

  page.move = (x, y, extra = {}) => {
    const t = page.pointerTarget();
    const p = makePointerEvent('pointermove', { ...extra, x, y, buttons: extra.buttons === undefined ? 0 : extra.buttons });
    page.fire(t, p);
    page.fire(t, makeMouseEvent('mousemove', { ...extra, x, y, buttons: extra.buttons === undefined ? 0 : extra.buttons }), 'mousemove');
    return p;
  };

  page.click = (x, y, extra = {}) => {
    const t = page.pointerTarget();
    const base = { x, y, ...extra };
    page.fire(t, makePointerEvent('pointerdown', { ...base, buttons: 1, button: extra.button === undefined ? 0 : extra.button }), 'pointerdown');
    page.fire(t, makeMouseEvent('mousedown', { ...base, buttons: 1 }), 'mousedown');
    page.fire(t, makePointerEvent('pointerup', { ...base, buttons: 0 }), 'pointerup');
    page.fire(t, makeMouseEvent('mouseup', { ...base, buttons: 0 }), 'mouseup');
    page.fire(t, makeMouseEvent('click', { ...base, buttons: 0 }), 'click');
    return true;
  };

  page.drag = (x1, y1, x2, y2, steps = 12, extra = {}) => {
    const t = page.pointerTarget();
    const n = Math.max(1, Math.floor(steps));
    page.fire(t, makePointerEvent('pointerdown', { ...extra, x: x1, y: y1, buttons: 1 }), 'pointerdown');
    page.fire(t, makeMouseEvent('mousedown', { ...extra, x: x1, y: y1, buttons: 1 }), 'mousedown');
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const x = x1 + (x2 - x1) * f;
      const y = y1 + (y2 - y1) * f;
      page.fire(t, makePointerEvent('pointermove', { ...extra, x, y, buttons: 1, movementX: (x2 - x1) / n, movementY: (y2 - y1) / n }), 'pointermove');
      page.fire(t, makeMouseEvent('mousemove', { ...extra, x, y, buttons: 1 }), 'mousemove');
    }
    page.fire(t, makePointerEvent('pointerup', { ...extra, x: x2, y: y2, buttons: 0 }), 'pointerup');
    page.fire(t, makeMouseEvent('mouseup', { ...extra, x: x2, y: y2, buttons: 0 }), 'mouseup');
    return true;
  };

  page.wheel = (x, y, deltaY, extra = {}) => {
    const t = page.pointerTarget();
    const e = makeWheelEvent({ ...extra, x, y, deltaY });
    page.fire(t, e, 'wheel');
    return e;
  };

  page.key = (type, kv = {}) => {
    const t = document.__activeElement || win;
    return page.fire(t, makeKeyEvent(type, kv), type);
  };
  page.press = (key, extra = {}) => {
    page.key('keydown', { key, ...extra });
    page.key('keypress', { key, ...extra });
    page.key('keyup', { key, ...extra });
  };

  page.resize = (w, h) => {
    if (Number.isFinite(w)) win.innerWidth = w;
    if (Number.isFinite(h)) win.innerHeight = h;
    page.fire(win, evt('resize', {}), 'resize');
  };

  /* ------------------------------------------------------- load + eval -- */

  page.loadHtml = (htmlPath) => {
    const abs = resolveFile(htmlPath, [o.rootDir]);
    if (!fs.existsSync(abs)) throw new Error('loadHtml: file not found: ' + abs);
    const html = fs.readFileSync(abs, 'utf8');
    page.htmlPath = abs;
    document.__styleRules = [];
    const res = parseHtmlInto(html, document);
    page.__htmlScripts = res.scripts;
    const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (tm) document.title = tm[1].trim();
    // local stylesheets (needed so clientWidth/Height resolve like a browser)
    for (const el of document.__all) {
      if (!el.tagName || el.tagName !== 'LINK') continue;
      if (!/stylesheet/i.test(el.getAttribute('rel') || '')) continue;
      const href = el.getAttribute('href') || '';
      if (!href || /^(https?:|data:|\/\/)/.test(href)) { page.notes.push('skipped external stylesheet: ' + href); continue; }
      const cssPath = path.resolve(path.dirname(abs), href);
      if (!fs.existsSync(cssPath)) { page.notes.push('stylesheet not found: ' + cssPath); continue; }
      document.addStyleSheet(fs.readFileSync(cssPath, 'utf8'));
    }
    return res.scripts;
  };

  page.evalInPage = (code, filename = '<eval>') => {
    try {
      return vm.runInContext(String(code), ctxVm, { filename, displayErrors: true });
    } catch (e) {
      page.__recordError('script:' + filename, e);
      return undefined;
    }
  };

  page.loadInlineScript = (code, name = 'inline') => page.evalInPage(code, name);

  page.loadScript = (jsPath) => {
    const abs = resolveFile(jsPath, [o.rootDir, page.htmlPath ? path.dirname(page.htmlPath) : null]);
    if (!fs.existsSync(abs)) {
      page.__recordError('script:' + jsPath, new Error('script file not found: ' + abs));
      return undefined;
    }
    const code = fs.readFileSync(abs, 'utf8');
    const dir = path.dirname(abs);
    const rel = page.htmlPath && dir.startsWith(path.dirname(page.htmlPath))
      ? path.relative(path.dirname(page.htmlPath), abs) : abs;
    return page.evalInPage(code, rel);
  };

  /**
   * Evaluate every <script> of the loaded HTML in document order.
   * Classic scripts only; type="module" is noted and skipped.
   */
  page.loadScriptsInOrder = (htmlPath) => {
    if (htmlPath) {
      const abs = resolveFile(htmlPath, [o.rootDir]);
      if (abs !== page.htmlPath) page.loadHtml(abs);
    }
    if (!page.htmlPath) throw new Error('loadScriptsInOrder: no HTML loaded');
    const dir = path.dirname(page.htmlPath);
    const loaded = [];
    let inline = 0;
    for (const s of page.__htmlScripts) {
      if (s.type && /module/i.test(s.type)) {
        page.notes.push(`skipped <script type="module"> (mockdom runs classic scripts only): ${s.value.slice(0, 80)}`);
        continue;
      }
      if (s.kind === 'src') {
        if (/^(https?:)?\/\//.test(s.value) || s.value.startsWith('data:')) {
          page.notes.push(`skipped non-local script src="${s.value}"`);
          continue;
        }
        const abs = path.resolve(dir, s.value);
        if (!fs.existsSync(abs)) {
          page.__recordError('script:' + s.value, new Error('script file not found: ' + abs));
          continue;
        }
        page.loadScript(abs);
        loaded.push(abs);
      } else {
        inline++;
        const body = s.value;
        if (body.trim()) page.evalInPage(body, `${path.basename(page.htmlPath)}#inline${inline}`);
        loaded.push(`<inline${inline}>`);
      }
    }
    return loaded;
  };

  /* ------------------------------------------------------------ render -- */
  /**
   * Replay the recorded ops into an SVG file.
   * Returns the SVG PATH (string); details land in page.lastRenderSVG.
   */
  page.renderToSVG = (rOpts = {}) => {
    const ctx2d = rOpts.context || page.mainContext();
    if (!ctx2d) throw new Error('renderToSVG: no 2d context was created by the page');
    const digest = ctx2d.__digest({
      width: rOpts.width || o.width,
      height: rOpts.height || o.height,
      background: rOpts.background || '#ffffff',
      frame: rOpts.frame || 'last',
    });
    const svg = digestToSVG(digest);
    const out = resolveFile(rOpts.path || path.join(o.rootDir, '_dev', 'render.svg'), [o.rootDir]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, svg);
    const elements = (svg.match(/<[a-zA-Z]/g) || []).length;
    page.lastRenderSVG = {
      path: out, bytes: Buffer.byteLength(svg), elements,
      ops: digest.ops.length, from: digest.from, notes: digest.notes, digest,
    };
    return out;
  };

  /**
   * Replay the recorded ops into a PNG through Python + Pillow.
   * Returns the PNG PATH (string); details land in page.lastRenderPNG.
   */
  page.renderToPNG = (rOpts = {}) => {
    const ctx2d = rOpts.context || page.mainContext();
    if (!ctx2d) throw new Error('renderToPNG: no 2d context was created by the page');
    const digest = ctx2d.__digest({
      width: rOpts.width || o.width,
      height: rOpts.height || o.height,
      background: rOpts.background || '#ffffff',
      frame: rOpts.frame || 'last',
    });
    const out = resolveFile(rOpts.path || path.join(o.rootDir, '_dev', 'render.png'), [o.rootDir]);
    const res = rasterizeDigest(digest, out, { python: rOpts.python || o.python, rasterizeScript: rOpts.rasterizeScript });
    page.lastRenderPNG = {
      ...res, ops: digest.ops.length, from: digest.from, notes: digest.notes,
      width: digest.w, height: digest.h, digest,
    };
    return out;
  };

  /* ----------------------------------------------------------- summary -- */

  page.allWarnings = () => {
    const out = page.warnings.slice();
    for (const c of page.contexts) {
      for (const w of c.__warnings) out.push({ where: 'canvas', ...w });
    }
    return out;
  };

  page.summary = () => {
    const ctx2d = page.mainContext();
    const finalize = ctx2d ? ctx2d.__finalize() : null;
    const warnings = page.allWarnings();
    const elapsedMs = clock.now;
    return {
      frames: page.frameCount,
      steps: page.steps,
      elapsedMs: r2(elapsedMs),
      errors: page.errors.map((e) => ({ where: e.where, name: e.name, message: e.message, stack: e.stack })),
      warnings: warnings.map((w) => ({ op: w.op, message: w.message, args: w.args })),
      notes: page.notes.slice(),
      missingIds: [...new Set(page.missingIds)],
      consoleErrors: page.consoleLogs.filter((l) => l.level === 'error').map((l) => l.text),
      canvas: page.canvasElement ? { width: page.canvasElement.width, height: page.canvasElement.height, explicitSize: page.canvasElement.__explicitSize } : null,
      viewport: { width: win.innerWidth, height: win.innerHeight, devicePixelRatio: win.devicePixelRatio },
      contexts: page.contexts.length,
      stats: finalize ? finalize.stats : null,
      finalize,
      fps_estimate: elapsedMs > 0 ? r2(page.frameCount / (elapsedMs / 1000)) : 0,
    };
  };

  page.close = () => {
    page.__closed = true;
    page.__raf.clear();
    page.__timers.clear();
    detachRejectionHandler(page);
  };

  /* ----------------------------------------------------- install globals */

  const g = win;
  const winListeners = new Map();
  g.__listeners = winListeners;
  g.__mockListeners = winListeners;
  g.addEventListener = (type, fn, opts2) => MockElement.prototype.addEventListener.call(g, type, fn, opts2);
  g.removeEventListener = (type, fn, opts2) => MockElement.prototype.removeEventListener.call(g, type, fn, opts2);
  g.dispatchEvent = (ev) => page.__dispatch(g, ev);

  g.document = document;
  g.navigator = {
    userAgent: o.userAgent,
    appVersion: o.userAgent,
    platform: 'Win32',
    vendor: 'MockDOM',
    language: 'en-US',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    onLine: true,
    cookieEnabled: true,
    webdriver: false,
    pdfViewerEnabled: false,
    clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
    permissions: { query: () => Promise.resolve({ state: 'granted', onchange: null }) },
    doNotTrack: 'unspecified',
  };
  g.location = {
    href: 'file:///' + (page.htmlPath || '').replace(/\\/g, '/'),
    protocol: 'file:', host: '', hostname: '', port: '', pathname: '', search: '', hash: '',
    origin: 'file://', reload() {}, assign() {}, replace() {}, toString() { return this.href; },
  };
  g.screen = { width: o.width, height: o.height, availWidth: o.width, availHeight: o.height, colorDepth: 24, pixelDepth: 24, orientation: { type: 'landscape-primary', angle: 0 } };
  g.history = { length: 1, state: null, pushState() {}, replaceState() {}, back() {}, forward() {}, go() {} };
  g.innerWidth = o.width;
  g.innerHeight = o.height;
  g.outerWidth = o.width;
  g.outerHeight = o.height;
  g.devicePixelRatio = o.devicePixelRatio;
  g.scrollX = 0;
  g.scrollY = 0;
  g.pageXOffset = 0;
  g.pageYOffset = 0;
  g.scrollTo = () => {};
  g.scrollBy = () => {};
  g.scroll = () => {};
  g.alert = (msg) => { page.consoleLogs.push({ level: 'log', text: 'alert: ' + msg }); };
  g.confirm = () => true;
  g.prompt = () => null;
  g.focus = () => {};
  g.blur = () => {};
  g.open = () => null;
  g.close = () => {};
  g.postMessage = () => {};
  g.print = () => {};

  g.performance = {
    now: () => clock.now,
    timeOrigin: clock.epoch,
    mark: () => {}, measure: () => {}, clearMarks: () => {}, clearMeasures: () => {},
    getEntries: () => [], getEntriesByName: () => [], getEntriesByType: () => [],
    memory: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 },
  };
  g.Date.now = () => clock.epoch + clock.now;
  g.Math.random = seededRandom;
  g.crypto = {
    getRandomValues(arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(seededRandom() * 256);
      return arr;
    },
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
  };

  const store = (map) => new Proxy({
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    __map: map,
  }, {
    get(t, p) {
      if (typeof p === 'symbol') return t[p];
      if (p in t) return t[p];
      const k = String(p);
      return map.has(k) ? map.get(k) : undefined;
    },
    set(t, p, v) { if (typeof p === 'symbol') { t[p] = v; return true; } map.set(String(p), String(v)); return true; },
    has(t, p) { return typeof p === 'symbol' ? p in t : true; },
    deleteProperty(t, p) { if (typeof p !== 'symbol') map.delete(String(p)); return true; },
    ownKeys() { return [...map.keys()]; },
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === 'symbol') return undefined;
      const k = String(p);
      return { value: map.get(k), enumerable: true, configurable: true, writable: true };
    },
  });
  g.localStorage = store(new Map());
  g.sessionStorage = store(new Map());

  g.console = {
    log: (...a) => { page.consoleLogs.push({ level: 'log', text: a.map(fmtArg).join(' ') }); if (o.verbose) console.log('[page]', ...a); },
    info: (...a) => { page.consoleLogs.push({ level: 'info', text: a.map(fmtArg).join(' ') }); if (o.verbose) console.log('[page]', ...a); },
    warn: (...a) => { page.consoleLogs.push({ level: 'warn', text: a.map(fmtArg).join(' ') }); if (o.verbose) console.warn('[page]', ...a); },
    error: (...a) => { page.consoleLogs.push({ level: 'error', text: a.map(fmtArg).join(' ') }); if (o.verbose) console.error('[page]', ...a); },
    debug: (...a) => { page.consoleLogs.push({ level: 'debug', text: a.map(fmtArg).join(' ') }); },
    trace: (...a) => { page.consoleLogs.push({ level: 'trace', text: a.map(fmtArg).join(' ') }); },
    dir: (...a) => { page.consoleLogs.push({ level: 'dir', text: a.map(fmtArg).join(' ') }); },
    table: (...a) => { page.consoleLogs.push({ level: 'table', text: a.map(fmtArg).join(' ') }); },
    group: () => {}, groupEnd: () => {}, groupCollapsed: () => {}, count: () => {}, time: () => {}, timeEnd: () => {},
    assert: () => {}, clear: () => {},
  };

  g.setTimeout = page.setTimeout;
  g.clearTimeout = page.clearTimeout;
  g.setInterval = page.setInterval;
  g.clearInterval = page.clearInterval;
  g.requestAnimationFrame = page.requestAnimationFrame;
  g.cancelAnimationFrame = page.cancelAnimationFrame;
  g.requestIdleCallback = (cb) => page.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 8 }), 1);
  g.cancelIdleCallback = (id) => page.clearTimeout(id);
  g.queueMicrotask = (cb) => { Promise.resolve().then(cb); };
  g.matchMedia = makeMatchMedia(page);
  g.getComputedStyle = (el, pseudo) => makeComputedStyle(el, pseudo, page);
  g.devicePixelRatio = o.devicePixelRatio;

  class MockImage {
    constructor(w, h) {
      this.width = w || 0;
      this.height = h || 0;
      this.complete = true;
      this.naturalWidth = w || 0;
      this.naturalHeight = h || 0;
      this.crossOrigin = null;
      this.onload = null;
      this.onerror = null;
      this.src = '';
      this.tagName = 'IMG';
    }
    set src(v) {
      this.__src = v;
      const mm = /(\d+)x(\d+)/.exec(String(v));
      if (mm) { this.width = +mm[1]; this.height = +mm[2]; }
    }
    get src() { return this.__src || ''; }
    addEventListener() {} removeEventListener() {}
    decode() { return Promise.resolve(); }
  }
  g.Image = MockImage;
  g.HTMLCanvasElement = MockCanvas;
  g.HTMLElement = MockElement;
  g.Element = MockElement;
  g.Node = MockElement;
  g.Event = MockEvent;
  g.CustomEvent = MockEvent;
  g.PointerEvent = MockEvent;
  g.MouseEvent = MockEvent;
  g.WheelEvent = MockEvent;
  g.KeyboardEvent = MockEvent;
  g.DOMPoint = class { constructor(x, y) { this.x = x || 0; this.y = y || 0; } };
  g.DOMMatrix = class { constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; } };
  g.URL = URL;
  g.URLSearchParams = URLSearchParams;
  g.TextEncoder = TextEncoder;
  g.TextDecoder = TextDecoder;
  g.structuredClone = (v) => JSON.parse(JSON.stringify(v));
  g.atob = (s) => Buffer.from(String(s), 'base64').toString('binary');
  g.btoa = (s) => Buffer.from(String(s), 'binary').toString('base64');
  g.OffscreenCanvas = class { constructor(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; } };
  g.fetch = () => {
    const err = new Error('mockdom: fetch() is not available in the verification harness');
    page.__recordError('fetch', err);
    return Promise.reject(err);
  };
  g.XMLHttpRequest = class {
    constructor() { this.readyState = 0; this.status = 0; this.responseText = ''; }
    open() { this.readyState = 1; }
    send() {
      page.__recordError('XMLHttpRequest', new Error('mockdom: XMLHttpRequest is not available in the verification harness'));
      this.readyState = 4;
      this.status = 0;
      if (typeof this.onerror === 'function') this.onerror(new MockEvent('error'));
    }
    setRequestHeader() {} addEventListener() {} removeEventListener() {}
  };

  page.__onUnhandled = (reason) => {
    page.__recordError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
  };
  attachRejectionHandler(page);

  // `window` is the page's global object — exactly like a browser's classic script scope.
  page.evalInPage('globalThis.window = globalThis; globalThis.self = globalThis; globalThis.top = globalThis; globalThis.parent = globalThis; globalThis.frames = globalThis;', '<bootstrap>');

  return page;
}

function fmtArg(a) {
  try {
    if (typeof a === 'string') return a;
    if (a === undefined) return 'undefined';
    if (a === null) return 'null';
    if (typeof a === 'object') {
      if (a.__isCanvas) return `<canvas ${a.width}x${a.height}>`;
      if (a.__gradient) return `[${a.__gradient.type} gradient]`;
      return JSON.stringify(a, (k, v) => (typeof v === 'function' ? '[fn]' : v));
    }
    return String(a);
  } catch { return '[object]'; }
}

function makeComputedStyle(el, pseudo, page) {
  const inline = inlineDecls(el);
  const fromCss = (page && page.document) ? declsFor(el, page.document.__styleRules) : {};
  const tag = el && el.tagName ? el.tagName.toLowerCase() : 'div';
  const box = defaultsFor(tag);
  const resolved = {};
  if (page && el && el.nodeType === 1) {
    try {
      const b = page.elementBox(el);
      if (b.w) resolved.width = b.w + 'px';
      if (b.h) resolved.height = b.h + 'px';
    } catch { /* ignore */ }
  }
  const base = {
    display: box.display || 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'static',
    overflow: 'visible',
    transform: 'none',
    transformOrigin: '50% 50%',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'rgb(0, 0, 0)',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 'normal',
    zIndex: 'auto',
    pointerEvents: 'auto',
    cursor: 'auto',
    border: '0px none rgb(0, 0, 0)',
    margin: '0px',
    padding: '0px',
    width: 'auto',
    height: 'auto',
    ...box,
    ...fromCss,
    ...inline,
    ...resolved,
  };
  const api = {
    getPropertyValue: (n) => {
      const k = camel(String(n));
      return base[k] === undefined ? '' : String(base[k]);
    },
    getPropertyPriority: () => '',
    item: (i) => Object.keys(base)[i] || '',
    length: Object.keys(base).length,
    cssText: Object.entries(base).map(([k, v]) => `${hyphen(k)}: ${v}`).join('; '),
  };
  return new Proxy(api, {
    get(t, p) {
      if (typeof p === 'symbol') return t[p];
      if (p in t) return t[p];
      const k = String(p);
      return base[k] === undefined ? '' : String(base[k]);
    },
    has() { return true; },
    ownKeys() { return Object.keys(base); },
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === 'symbol') return undefined;
      return { value: base[String(p)], enumerable: true, configurable: true, writable: true };
    },
  });
}

export default createPage;

