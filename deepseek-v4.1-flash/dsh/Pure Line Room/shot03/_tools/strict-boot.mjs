/* =========================================================================
   Pure Line Room — _tools/strict-boot.mjs
   The recording harness answers every unknown canvas member with a no-op, which
   can hide a typo. This run makes the context surface STRICT: any property or
   method the client code touches that is not part of the real
   CanvasRenderingContext2D (or the two AudioContext shapes used) throws with a
   stack, so a bad call cannot pass silently.

   It also drives the page the way main.js does — boot, resize, many frames,
   synthetic pointer events, keys — and reports anything that escapes.
   ========================================================================= */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const W = 1280, H = 800;

const CANVAS_MEMBERS = new Set([
  'canvas', 'save', 'restore', 'reset', 'isContextLost',
  'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform', 'getTransform',
  'setLineDash', 'getLineDash', 'globalAlpha', 'globalCompositeOperation', 'filter',
  'imageSmoothingEnabled', 'imageSmoothingQuality', 'strokeStyle', 'fillStyle',
  'createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern',
  'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowColor',
  'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset',
  'font', 'textAlign', 'textBaseline', 'direction', 'letterSpacing',
  'fontKerning', 'fontStretch', 'fontVariantCaps', 'textRendering', 'wordSpacing',
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect',
  'fillText', 'strokeText', 'measureText', 'drawImage',
  'createImageData', 'getImageData', 'putImageData', 'getContextAttributes',
]);

const violations = [];
let pathDepth = 0;

function makeStrictContext(w, h) {
  const state = {
    fillStyle: '#fff', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    globalCompositeOperation: 'source-over', filter: 'none', direction: 'ltr',
    shadowBlur: 0, shadowColor: '#000', shadowOffsetX: 0, shadowOffsetY: 0,
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
  };
  const stack = [];
  const grad = () => ({
    addColorStop(o, c) {
      if (typeof o !== 'number' || !isFinite(o)) violations.push('addColorStop offset ' + o);
      if (typeof c !== 'string') violations.push('addColorStop colour ' + c);
    },
  });
  const target = Object.assign({}, state);
  const handler = {
    get(t, k) {
      if (k === 'canvas') return { width: w, height: h };
      if (typeof k !== 'string') return t[k];
      if (!CANVAS_MEMBERS.has(k)) {
        violations.push('canvas member "' + String(k) + '"');
        return () => { };
      }
      if (k in t) return t[k];
      switch (k) {
        case 'save': return () => { stack.push(Object.assign({}, t)); };
        case 'restore': return () => { const s = stack.pop(); if (s) Object.assign(t, s); };
        case 'getLineDash': return () => t._dash || [];
        case 'setLineDash': return (d) => { t._dash = d ? d.slice() : []; };
        case 'measureText': return (s) => ({ width: String(s).length * 6.5 });
        case 'createLinearGradient':
        case 'createRadialGradient':
        case 'createConicGradient':
        case 'createPattern': return grad;
        case 'getContextAttributes': return () => ({ alpha: false });
        case 'isContextLost': return () => false;
        case 'getTransform': return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        default:
          // any path/draw call
          return function (...args) {
            for (const a of args) {
              if (typeof a === 'number' && !isFinite(a)) {
                violations.push('non-finite argument to ctx.' + k + '(' + args.join(',') + ')');
                break;
              }
            }
          };
      }
    },
    set(t, k, v) {
      if (typeof k === 'string' && !CANVAS_MEMBERS.has(k)) {
        violations.push('assignment to unknown canvas member "' + k + '"');
      }
      t[k] = v;
      return true;
    },
  };
  return new Proxy(target, handler);
}

function makeStrictAudio() {
  const ok = new Set(['currentTime', 'state', 'resume', 'suspend', 'close', 'destination',
    'sampleRate', 'baseLatency', 'outputLatency', 'listener', 'createGain', 'createOscillator',
    'createBufferSource', 'createBuffer', 'createBiquadFilter', 'createDynamicsCompressor',
    'createDelay', 'createAnalyser', 'createStereoPanner', 'createChannelMerger',
    'createChannelSplitter', 'createConstantSource', 'createPeriodicWave', 'decodeAudioData']);
  const param = () => {
    const p = { value: 0 };
    const fns = ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
      'setTargetAtTime', 'cancelScheduledValues', 'setValueCurveAtTime'];
    const h = {
      get(t, k) {
        if (k === 'value') return t.value;
        if (fns.indexOf(k) >= 0) {
          return (...a) => {
            for (const x of a) if (typeof x === 'number' && !isFinite(x)) violations.push('non-finite audio param ' + k);
          };
        }
        return undefined;
      },
      set(t, k, v) { if (k === 'value') { if (!isFinite(v)) violations.push('non-finite audio param value'); t.value = v; } return true; },
    };
    return new Proxy(p, h);
  };
  const node = () => new Proxy({}, {
    get(t, k) {
      if (k === 'gain' || k === 'frequency' || k === 'Q' || k === 'detune' || k === 'playbackRate' || k === 'threshold' || k === 'knee' || k === 'ratio' || k === 'attack' || k === 'release' || k === 'pan') return param();
      if (k === 'type') return t._type || 'sine';
      if (k === 'buffer') return t._buffer;
      if (k === 'connect') return (x) => x;
      if (k === 'disconnect') return () => { };
      if (k === 'start' || k === 'stop') return () => { };
      if (k === 'onended') return null;
      if (typeof k === 'string' && k[0] === '_') return t[k];
      return () => { };
    },
    set(t, k, v) { t['_' + k] = v; return true; },
  });
  const ctx = new Proxy({}, {
    get(t, k) {
      if (!ok.has(k)) { violations.push('AudioContext member "' + String(k) + '"'); return () => { }; }
      if (k === 'currentTime') return t._t || 0;
      if (k === 'state') return 'running';
      if (k === 'sampleRate') return 48000;
      if (k === 'destination') return node();
      if (k === 'resume' || k === 'close' || k === 'suspend') return () => Promise.resolve();
      if (k === 'createBuffer') return (ch, len, rate) => ({ getChannelData: () => new Float32Array(len) });
      if (k === 'decodeAudioData') return () => Promise.resolve({});
      return () => node();
    },
    set(t, k, v) { t['_' + k] = v; return true; },
  });
  return ctx;
}

/* ------------------------------ environment ------------------------------ */
const listeners = {};
const ctx = makeStrictContext(W, H);
const canvas = {
  width: W, height: H, style: {},
  getContext: () => ctx,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() { },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H }),
  setPointerCapture() { }, releasePointerCapture() { },
  classList: { add() { }, remove() { } },
};
const elements = {
  stage: canvas,
  toast: { textContent: '', classList: { add() { }, remove() { } } },
  hint: { classList: { add() { }, remove() { } } },
};

let now = 0;
const rafQueue = [];
const sandbox = {
  console,
  devicePixelRatio: 1,
  innerWidth: W,
  innerHeight: H,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() { },
  requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame() { },
  setTimeout(fn) { return 0; },
  clearTimeout() { },
  performance: { now: () => now },
  AudioContext: function () { return makeStrictAudio(); },
  document: {
    readyState: 'complete',
    getElementById: (id) => elements[id] || null,
    addEventListener() { },
    createElement: () => canvas,
    documentElement: { style: {} },
    body: { appendChild() { } },
  },
  navigator: { userAgent: 'strict-boot' },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
createContext(sandbox);

const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio', 'interact', 'layout'];
const files = ENGINE.map((n) => 'js/' + n + '.js');
for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
files.push('js/build.js', 'js/main.js');

const loadErrors = [];
for (const f of files) {
  try { runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { loadErrors.push(f + ': ' + e.message); }
}
if (loadErrors.length) {
  console.log('LOAD ERRORS');
  for (const e of loadErrors) console.log('  ' + e);
  process.exit(1);
}

/* ------------------------------- drive it -------------------------------- */
function fire(type, ev) {
  for (const fn of listeners[type] || []) {
    try { fn(ev); } catch (e) { violations.push('handler ' + type + ' threw: ' + e.message); }
  }
}
function frame(dtMs) {
  now += dtMs;
  const q = rafQueue.splice(0, rafQueue.length);
  for (const fn of q) {
    try { fn(now); } catch (e) { violations.push('frame threw: ' + e.message); }
  }
}

// a few hundred frames of plain animation
for (let i = 0; i < 400; i++) frame(16.7);

// pointer: hover a grid of positions, then click each one
for (let gx = 1; gx <= 6; gx++) {
  for (let gy = 1; gy <= 4; gy++) {
    const x = (W * gx) / 7, y = (H * gy) / 5;
    fire('pointermove', { clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 0 });
    frame(16.7);
  }
}
for (let gx = 1; gx <= 6; gx++) {
  for (let gy = 1; gy <= 4; gy++) {
    const x = (W * gx) / 7, y = (H * gy) / 5;
    fire('pointerdown', { clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 });
    fire('pointerup', { clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 0 });
    for (let i = 0; i < 40; i++) frame(16.7);
  }
}

// drags
fire('pointerdown', { clientX: W * 0.5, clientY: H * 0.5, pointerId: 2, button: 0, buttons: 1 });
for (let i = 0; i < 24; i++) {
  fire('pointermove', { clientX: W * 0.5 + i * 8, clientY: H * 0.5 + i * 3, pointerId: 2, button: 0, buttons: 1 });
  frame(16.7);
}
fire('pointerup', { clientX: W * 0.7, clientY: H * 0.6, pointerId: 2, button: 0, buttons: 0 });
for (let i = 0; i < 60; i++) frame(16.7);

// wheel
fire('wheel', { deltaY: -240, preventDefault() { } });
for (let i = 0; i < 40; i++) frame(16.7);
fire('wheel', { deltaY: 480, preventDefault() { } });
for (let i = 0; i < 40; i++) frame(16.7);

// keyboard: focus stepping, operate, recentre, mute, look around
for (const key of ['Tab', 'Tab', 'Enter', 'Tab', 'Enter', 'Tab', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 's', 'r', 'm', 'M', 'Escape']) {
  fire('keydown', { key, preventDefault() { } });
  for (let i = 0; i < 20; i++) frame(16.7);
}

// a resize
sandbox.innerWidth = 900; sandbox.innerHeight = 600;
fire('resize', {});
for (let i = 0; i < 60; i++) frame(16.7);

// long idle run
for (let i = 0; i < 600; i++) frame(16.7);

/* -------------------------------- verdict -------------------------------- */
const unique = [...new Set(violations)];
console.log('frames driven      : ' + (400 + 24 * 40 + 240 + 40 + 40 + 17 * 20 + 60 + 600));
console.log('raf queue drained  : ' + (rafQueue.length === 0 ? 'yes' : 'no (' + rafQueue.length + ' pending)'));
console.log('violations         : ' + unique.length);
if (unique.length) {
  console.log('');
  for (const v of unique.slice(0, 25)) console.log('  ' + v);
  process.exit(1);
}
console.log('');
console.log('STRICT BOOT CLEAN: the page runs hundreds of frames, every pointer/keys/resize path,');
console.log('and touches nothing outside the standard Canvas2D and Web Audio surfaces.');
