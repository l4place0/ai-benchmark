/* sky_harness.mjs - mock Canvas2D recorder + matrix verification + preview export.
 * Run: <node> _dev/sky_harness.mjs                                            */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const srcPath = path.join(root, 'js', 'sky.js');
const src = fs.readFileSync(srcPath, 'utf8');

/* ---------------------------------------------------------------- loading */
const fakeGlobal = {};
new Function('g', 'with (g) { ' + src + '\n g.drawSky = drawSky; }')(fakeGlobal);
const drawSky = fakeGlobal.drawSky;
if (typeof drawSky !== 'function') throw new Error('drawSky was not defined by js/sky.js');
if (Object.keys(fakeGlobal).length !== 1) throw new Error('module leaked globals: ' + Object.keys(fakeGlobal).join(','));

/* ------------------------------------------------------------- mock ctx -- */
const ident = () => [1, 0, 0, 1, 0, 0];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
          m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
          m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function xfRect(m, x, y, w, h) {
  const p = [apply(m, x, y), apply(m, x + w, y), apply(m, x + w, y + h), apply(m, x, y + h)];
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function makeCtx() {
  const ops = [];
  let M = ident();
  let clips = [];
  const stack = [];
  const st = {
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt',
    lineJoin: 'miter', globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '10px sans-serif', textAlign: 'start'
  };
  const GRAD_OPS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect']);
  const gradIds = new Map();
  const gradients = [];

  function gradRef(g) {
    if (!gradIds.has(g)) { gradIds.set(g, gradients.length); gradients.push({ id: gradients.length, type: g.type, args: g.args, stops: g.stops.slice() }); }
    return gradIds.get(g);
  }
  const norm = v => (v && typeof v === 'object' && Array.isArray(v.stops)) ? { grad: gradRef(v) } : v;

  function rec(op, args, extra) {
    const a = (args || []).map(norm);
    ctx.calls++;
    const e = { op, args: a };
    if (GRAD_OPS.has(op)) e.fillStyle = norm(st.fillStyle);
    if (op === 'stroke' || op === 'strokeRect') { e.strokeStyle = norm(st.strokeStyle); e.lineWidth = st.lineWidth; e.lineCap = st.lineCap; e.lineJoin = st.lineJoin; }
    if (op === 'fill' || op === 'fillRect') e.fillStyle = norm(st.fillStyle);
    e.globalAlpha = st.globalAlpha;
    if (extra) Object.assign(e, extra);
    ops.push(e);
    return e;
  }

  const ctx = {
    _ops: ops, _gradients: gradients, calls: 0,
    beginPath() { rec('beginPath', []); },
    closePath() { rec('closePath', []); },
    moveTo(...a) { rec('moveTo', a); },
    lineTo(...a) { rec('lineTo', a); },
    quadraticCurveTo(...a) { rec('quadraticCurveTo', a); },
    bezierCurveTo(...a) { rec('bezierCurveTo', a); },
    arc(...a) { rec('arc', a); },
    ellipse(...a) { rec('ellipse', a); },
    rect(...a) { rec('rect', a, { devRect: xfRect(M, a[0], a[1], a[2], a[3]) }); },
    clip() {
      const e = rec('clip', []);
      const last = [...ops].reverse().find(o => o.op === 'rect');
      let r = last && last.devRect ? last.devRect.slice() : null;
      if (r && clips.length) {
        const p = clips[clips.length - 1];
        if (p) r = [Math.max(r[0], p[0]), Math.max(r[1], p[1]), Math.min(r[2], p[2]), Math.min(r[3], p[3])];
      }
      clips = clips.slice();
      clips.push(r);
      e.clips = clips.length;
      ctx._clipRects = clips;
    },
    fill() { rec('fill', []); },
    stroke() { rec('stroke', []); },
    fillRect(...a) { rec('fillRect', a, { devRect: xfRect(M, a[0], a[1], a[2], a[3]) }); },
    strokeRect(...a) { rec('strokeRect', a, { devRect: xfRect(M, a[0], a[1], a[2], a[3]) }); },
    save() { stack.push({ M: M.slice(), clips: clips.slice(), s: Object.assign({}, st) }); rec('save', []); },
    restore() {
      if (!stack.length) throw new Error('restore() with empty state stack');
      const fst = stack.pop();
      M = fst.M; clips = fst.clips;
      for (const k of Object.keys(st)) st[k] = fst.s[k];
      ctx._clipRects = clips;
      rec('restore', []);
    },
    translate(x, y) { M = mul(M, [1, 0, 0, 1, x, y]); rec('translate', [x, y]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); M = mul(M, [c, s, -s, c, 0, 0]); rec('rotate', [a]); },
    scale(x, y) { M = mul(M, [x, 0, 0, y, 0, 0]); rec('scale', [x, y]); },
    setLineDash(a) { rec('setLineDash', [a]); }
  };
  for (const g of ['createLinearGradient', 'createRadialGradient']) {
    ctx[g] = (...a) => {
      rec(g, a);
      return { type: g, args: a, stops: [], addColorStop(p, c) { this.stops.push([p, c]); } };
    };
  }
  for (const p of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin',
                   'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign']) {
    Object.defineProperty(ctx, p, {
      get() { return st[p]; },
      set(v) { st[p] = v; ops.push({ op: 'set:' + p, value: norm(v) }); }
    });
  }
  ctx._stackDepth = () => stack.length;
  return ctx;
}

/* --------------------------------------------------------------- runner -- */
const DRAW_OPS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'moveTo', 'lineTo',
  'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'rect', 'clip']);

function checkNumbers(v, op, idx, problems) {
  if (Array.isArray(v)) { v.forEach((x, i) => checkNumbers(x, op, idx + '.' + i, problems)); return; }
  if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${op}: arg[${idx}] = ${v}`);
}

function runCase(label, box, env, t, clouds) {
  const ctx = makeCtx();
  const errs = [];
  try { drawSky(ctx, box, env, t, clouds); } catch (e) { errs.push('threw: ' + (e && e.message)); }
  const problems = [];
  const ops = ctx._ops;
  const saves = ops.filter(o => o.op === 'save').length;
  const restores = ops.filter(o => o.op === 'restore').length;
  if (saves !== restores) problems.push(`unbalanced save/restore: ${saves}/${restores}`);
  if (ctx._stackDepth() !== 0) problems.push(`state stack depth ${ctx._stackDepth()} at exit`);
  /* a degenerate pane is allowed to be a clean no-op (nothing may be drawn) */
  const b = box || {};
  const degenerate = !(isFinite(+b.w) && isFinite(+b.h)) || +b.w <= 0 || +b.h <= 0;
  if (degenerate) {
    const n = ops.filter(o => o.op === 'fill' || o.op === 'stroke' || o.op === 'fillRect' || o.op === 'strokeRect').length;
    if (n) problems.push(`${n} paint calls for a degenerate box`);
    if (ops.length && ops[ops.length - 1].op !== 'restore') problems.push('last op is not restore()');
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label.padEnd(50)} ops=${String(ops.length).padStart(4)} clean no-op (w=${b.w} h=${b.h})` +
      (problems.length ? '\n      - ' + problems.join('\n      - ') : ''));
    return { ok: problems.length === 0, ops, problems, box, degenerate: true };
  }
  if (restores < 1) problems.push('no restore() at all');
  if (ops.length && ops[ops.length - 1].op !== 'restore') problems.push('last op is not restore()');
  const clipIdx = ops.findIndex(o => o.op === 'clip');
  const firstPaint = ops.findIndex(o => o.op === 'fill' || o.op === 'stroke' || o.op === 'fillRect' || o.op === 'strokeRect');
  const rectBefore = clipIdx >= 0 && ops.slice(0, clipIdx).some(o => o.op === 'rect');
  if (clipIdx < 0) problems.push('no clip() call');
  else if (!rectBefore) problems.push('no rect() before clip()');
  else if (firstPaint >= 0 && clipIdx > firstPaint) problems.push('paint before clip()');
  let depth = 0, paintedOutside = 0;
  for (const o of ops) {
    if (o.op === 'clip') depth = o.clips || 1;
    if ((o.op === 'fill' || o.op === 'stroke' || o.op === 'fillRect' || o.op === 'strokeRect') && depth < 1) paintedOutside++;
  }
  if (paintedOutside) problems.push(`${paintedOutside} paint calls outside a clip`);
  const drawCalls = ops.filter(o => DRAW_OPS.has(o.op)).length;
  if (drawCalls <= 40) problems.push(`only ${drawCalls} draw calls (need > 40)`);
  for (const o of ops) {
    if (o.op.startsWith('set:') || o.op === 'setLineDash') continue;
    checkNumbers(o.args, o.op, '0', problems);
  }
  for (const o of ops) {
    if (o.lineWidth !== undefined && !(Number.isFinite(o.lineWidth) && o.lineWidth > 0)) problems.push(`${o.op}: bad lineWidth ${o.lineWidth}`);
    if (o.globalAlpha !== undefined && !(Number.isFinite(o.globalAlpha) && o.globalAlpha >= 0 && o.globalAlpha <= 1)) problems.push(`${o.op}: bad alpha ${o.globalAlpha}`);
  }
  const bad = errs.concat(problems);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${label.padEnd(50)} ops=${String(ops.length).padStart(4)} draw=${String(drawCalls).padStart(4)}` +
    (bad.length ? '\n      - ' + bad.join('\n      - ') : ''));
  return { ok: bad.length === 0, ops, problems: bad, box };
}
/* ------------------------------------------------------------ case matrix */
const boxes = [
  { x: 60, y: 40, w: 640, h: 420 },
  { x: 0, y: 0, w: 900, h: 300 },
  { x: 0, y: 0, w: 0, h: 0 },
  { x: 0, y: 0, w: -50, h: 40 },
  { x: -120, y: -80, w: 300, h: 200 },
  { x: 0, y: 0, w: 1, h: 1 },
  { x: 10.5, y: 20.25, w: 3, h: 900 }
];
const cloudSets = [
  undefined, [],
  [{ u: 0.12, v: 0.22, s: 1.0, seed: 3 }, { u: 0.55, v: 0.5, s: 0.8, seed: 7 }],
  [{ u: 0.5, v: 0.3, s: 2.5, seed: 99 }],
  [{ u: NaN, v: undefined, s: -3, seed: 'x' }]
];
let total = 0, failed = 0;
const failLabels = [];
const days = [0, 0.15, 0.3, 0.5, 0.75, 1];
const hours = [0, 6, 12, 18, 23];
let verbose = false;
const quiet = (label, box, env, t, clouds) => {
  const log = console.log; console.log = () => {};
  let r; try { r = runCase(label, box, env, t, clouds); } finally { console.log = log; }
  total++; if (!r.ok) { failed++; failLabels.push(label); if (!verbose) { console.log('FAIL ' + label + '\n      - ' + r.problems.join('\n      - ')); verbose = true; } }
  return r;
};

for (const day of days) for (const hour of hours) for (const t of [0, 100000]) {
  quiet(`day=${day} hour=${hour} t=${t}`, boxes[0], { day, hour, minute: 30 }, t, cloudSets[2]);
}
for (let bi = 0; bi < boxes.length; bi++) for (let ci = 0; ci < cloudSets.length; ci++) {
  quiet(`edge box#${bi} clouds#${ci}`, boxes[bi], { day: 0.62, hour: 9, minute: 5, tint: undefined }, 1234.5, cloudSets[ci]);
}
for (const d of [-4, -0.001, 1.0001, 7]) {
  quiet(`clamp day=${d} tint`, boxes[0], { day: d, hour: 33.5, minute: 99, tint: '#ffeedd' }, 1e6, cloudSets[2]);
}
/* the named edge cases, reported individually */
const named = [
  ['zero-size box', { x: 0, y: 0, w: 0, h: 0 }, { day: 0.5, hour: 12 }, 0, cloudSets[2]],
  ['negative coords', { x: -120, y: -80, w: 300, h: 200 }, { day: 0.5, hour: 12 }, 0, cloudSets[2]],
  ['clouds = []', boxes[0], { day: 0.5, hour: 12 }, 0, []],
  ['clouds = undefined', boxes[0], { day: 0.5, hour: 12 }, 0, undefined],
  ['t = 0', boxes[0], { day: 0.5, hour: 12 }, 0, cloudSets[2]],
  ['t = 100000', boxes[0], { day: 0.5, hour: 12 }, 100000, cloudSets[2]],
  ['env.tint undefined', boxes[0], { day: 0.5, hour: 12, tint: undefined }, 7, cloudSets[2]],
  ['env missing', boxes[0], undefined, 0, undefined],
  ['garbage env/clouds', boxes[0], { day: NaN, hour: undefined, minute: -3 }, -5, cloudSets[4]]
];
for (const [label, box, env, t, clouds] of named) {
  const r = runCase(label, box, env, t, clouds);
  total++; if (!r.ok) { failed++; failLabels.push(label); }
}

console.log(`\n${total - failed}/${total} cases passed` + (failed ? '  FAILED: ' + failLabels.join(' | ') : ''));
if (failed) process.exitCode = 1;

/* -------------------------------------------------------------- previews */
const PREVIEWS = [
  ['day', { day: 1.00, hour: 12.5, minute: 20 }, 40],
  ['dusk', { day: 0.42, hour: 18.4, minute: 5 }, 200],
  ['night', { day: 0.00, hour: 1.4, minute: 40 }, 90]
];
const BOX = { x: 20, y: 20, w: 360, h: 260 };
const CLOUDS = [{ u: 0.10, v: 0.16, s: 0.80, seed: 3 }, { u: 0.38, v: 0.60, s: 0.55, seed: 8 },
                { u: 0.64, v: 0.22, s: 0.90, seed: 5 }, { u: 0.90, v: 0.68, s: 0.65, seed: 12 }];
const panels = [];
for (const [label, env, t] of PREVIEWS) {
  const ctx = makeCtx();
  drawSky(ctx, BOX, env, t, CLOUDS);
  if (ctx._stackDepth() !== 0) throw new Error('preview case ' + label + ' left an open save()');
  panels.push({ label, box: BOX, env, t, ops: ctx._ops, gradients: ctx._gradients });
}
fs.writeFileSync(path.join(here, 'sky_ops.json'),
  JSON.stringify({ box: BOX, panels, gradients: panels.map(p => p.gradients) }));

/* SVG replay ------------------------------------------------------------- */
const ARC_LIMIT = 1024, K = 0.5522847498307936;
const f = v => Math.round(v * 100) / 100;
const P = (m, x, y) => [f(m[0] * x + m[2] * y + m[4]), f(m[1] * x + m[3] * y + m[5])];

function pathOf(e, m) {
  const A = e.args;
  switch (e.op) {
    case 'moveTo': { const q = P(m, A[0], A[1]); return `M ${q[0]} ${q[1]}`; }
    case 'lineTo': { const q = P(m, A[0], A[1]); return `L ${q[0]} ${q[1]}`; }
    case 'quadraticCurveTo': { const c = P(m, A[0], A[1]), q = P(m, A[2], A[3]); return `Q ${c[0]} ${c[1]} ${q[0]} ${q[1]}`; }
    case 'bezierCurveTo': { const a = P(m, A[0], A[1]), b = P(m, A[2], A[3]), q = P(m, A[4], A[5]); return `C ${a[0]} ${a[1]} ${b[0]} ${b[1]} ${q[0]} ${q[1]}`; }
    case 'closePath': return 'Z';
    case 'arc': {
      const [cx, cy, r, sa, ea] = A;
      const n = Math.min(ARC_LIMIT, Math.max(8, Math.ceil(Math.abs(ea - sa) / (Math.PI / 24))));
      let s = '';
      for (let i = 0; i <= n; i++) {
        const a = sa + (ea - sa) * i / n;
        const q = P(m, cx + r * Math.cos(a), cy + r * Math.sin(a));
        s += `${i === 0 ? 'M' : 'L'} ${q[0]} ${q[1]} `;
      }
      return s.trim();
    }
    case 'ellipse': {
      const [cx, cy, rx, ry] = A;
      const kx = rx * K, ky = ry * K;
      const a = P(m, cx + rx, cy), b = P(m, cx, cy + ry), c = P(m, cx - rx, cy), d = P(m, cx, cy - ry);
      const c1 = P(m, cx + rx, cy + ky), c2 = P(m, cx + kx, cy + ry);
      const c3 = P(m, cx - kx, cy + ry), c4 = P(m, cx - rx, cy + ky);
      const c5 = P(m, cx - rx, cy - ky), c6 = P(m, cx - kx, cy - ry);
      const c7 = P(m, cx + kx, cy - ry), c8 = P(m, cx + rx, cy - ky);
      return `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${b[0]} ${b[1]} ` +
             `C ${c3[0]} ${c3[1]} ${c4[0]} ${c4[1]} ${c[0]} ${c[1]} ` +
             `C ${c5[0]} ${c5[1]} ${c6[0]} ${c6[1]} ${d[0]} ${d[1]} ` +
             `C ${c7[0]} ${c7[1]} ${c8[0]} ${c8[1]} ${a[0]} ${a[1]} Z`;
    }
    default: return '';
  }
}
function styleAttrs(e, stroke, panelIdx) {
  const c = stroke ? e.strokeStyle : e.fillStyle;
  let color = 'none';
  let alpha = e.globalAlpha == null ? 1 : e.globalAlpha;
  if (typeof c === 'string') {
    const m = /^rgba?\(([^)]+)\)$/.exec(c.replace(/\s/g, ''));
    if (m) {
      const p = m[1].split(',').map(Number);
      color = `rgb(${p[0] | 0},${p[1] | 0},${p[2] | 0})`;
      if (p.length > 3) alpha *= p[3];
    } else color = c;
  } else if (c && typeof c === 'object' && typeof c.grad === 'number') {
    color = `url(#g${panelIdx}_${c.grad})`;
  }
  let out = (stroke ? ' stroke="' : ' fill="') + color + '"';
  if (alpha < 0.999) out += ` ${stroke ? 'stroke-opacity' : 'fill-opacity'}="${f(alpha)}"`;
  if (stroke) out += ` stroke-width="${f(e.lineWidth)}" stroke-linecap="${e.lineCap || 'butt'}" stroke-linejoin="${e.lineJoin || 'miter'}"`;
  return out;
}
function rectSvg(e, m, stroke, panelIdx) {
  const r = e.devRect || xfRect(m, e.args[0], e.args[1], e.args[2], e.args[3]);
  const w = Math.max(0, r[2] - r[0]), h = Math.max(0, r[3] - r[1]);
  const fill = stroke ? ' fill="none"' : '';
  const st = stroke ? styleAttrs(e, true, panelIdx) : styleAttrs(e, false, panelIdx);
  return `<rect x="${f(r[0])}" y="${f(r[1])}" width="${f(w)}" height="${f(h)}"${fill}${st}/>`;
}
function replay(panel, pi) {
  const m = [1, 0, 0, 1, pi * panel.box.w, 0];
  const out = [];
  let d = '';
  for (const e of panel.ops) {
    if (e.op === 'moveTo' || e.op === 'lineTo' || e.op === 'quadraticCurveTo' ||
        e.op === 'bezierCurveTo' || e.op === 'closePath' || e.op === 'arc' || e.op === 'ellipse') {
      d += ' ' + pathOf(e, m);
    } else if (e.op === 'rect') {
      d = rectSvg(e, m, false, pi).replace('/>', '/>');
      d = `M ${f(e.devRect[0])} ${f(e.devRect[1])} L ${f(e.devRect[2])} ${f(e.devRect[1])} L ${f(e.devRect[2])} ${f(e.devRect[3])} L ${f(e.devRect[0])} ${f(e.devRect[3])} Z`;
    } else if (e.op === 'fill') {
      if (d.trim()) out.push(`<path d="${d.trim()}"${styleAttrs(e, false, pi)}/>`);
      d = '';
    } else if (e.op === 'stroke') {
      if (d.trim()) out.push(`<path d="${d.trim()}" fill="none"${styleAttrs(e, true, pi)}/>`);
      d = '';
    } else if (e.op === 'fillRect') {
      out.push(rectSvg(e, m, false, pi));
    } else if (e.op === 'strokeRect') {
      out.push(rectSvg(e, m, true, pi));
    }
  }
  return out.join('\n');
}
const W = BOX.w * PREVIEWS.length, H = BOX.h;
let defs = '';
for (let pi = 0; pi < panels.length; pi++) {
  for (const g of panels[pi].gradients) {
    if (g.type !== 'createLinearGradient') continue;
    const [x0, y0, x1, y1] = g.args;
    defs += `<linearGradient id="g${pi}_${g.id}" gradientUnits="userSpaceOnUse" x1="${f(x0 + pi * BOX.w)}" y1="${f(y0)}" x2="${f(x1 + pi * BOX.w)}" y2="${f(y1)}">`;
    for (const [o, c] of g.stops) defs += `<stop offset="${o}" stop-color="${c}"/>`;
    defs += '</linearGradient>\n';
  }
}
const clips = panels.map((p, i) => `<clipPath id="c${i}"><rect x="${f(p.box.x + i * p.box.w)}" y="${f(p.box.y)}" width="${f(p.box.w)}" height="${f(p.box.h)}"/></clipPath>`).join('\n');
const body = panels.map((p, i) => `<g clip-path="url(#c${i})">\n${replay(p, i)}\n</g>`).join('\n');
const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#cfcfcf"/>
${clips}
${defs}${body}
</svg>`;
fs.writeFileSync(path.join(here, 'sky_preview.svg'), svg);
console.log(`wrote _dev/sky_preview.svg (${W}x${H}) and _dev/sky_ops.json`);
