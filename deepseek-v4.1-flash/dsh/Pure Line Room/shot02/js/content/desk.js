// desk.js — 书桌区 (owner region: x ∈ [-3.2,-0.85], z ∈ [-2.6,-1.0])
//
//   书桌 (桌面 / 四条车木腿 / 裙板 / 横撑 / 挡板)
//   台下储物柜 (两个抽屉 + 一扇柜门)
//   台灯 (拨动开关 / 灯罩 / 灯泡 / 电源线 / 拉线)
//   杯子 (蒸汽)   转椅 (拖动 + 惯性)   地球仪 (拖动旋转 + 摩擦)
//   书堆 (两本可抽出)   笔筒 (摇晃)
//
// COORDINATES
// -----------
// Every primitive is authored in WORLD space with no builder transform and
// every object anchor starts at the origin; motion is applied to Nodes only.
// A node that must spin about a point which is not its own origin uses
// pivot(node, c, rx, ry, rz), which writes the exact compensating translation:
//     world = T(c − R·c) ∘ R   ==   p ↦ R·(p − c) + c
// so the authored points always stay inside the module's allowed box while the
// parts still rotate about their real mechanical pivots.

import { ease, Spring, damp } from '../core/anim.js';
import { clamp, vcross, vnorm, m4euler, m4xformP, makeRng } from '../core/math3d.js';

/* ---------------------------------------------------------------- helpers */

const TAU = Math.PI * 2;
const OUT = 1.9;     // outer silhouette
const MAIN = 1.25;   // main structure
const DET = 0.78;    // detail

const P = 'paper', F1 = 'face1', F2 = 'face2', F3 = 'face3';

/** style record */
function sty(fill, stroke, width, extra) {
  const o = {
    fill: fill === undefined || fill === null ? 'none' : fill,
    stroke: stroke === undefined ? 'ink' : stroke,
    width: width === undefined ? MAIN : width,
  };
  if (extra) for (const k in extra) o[k] = extra[k];
  return o;
}

function mixRGB(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function basisOf(n) {
  const nn = vnorm(n);
  const ref = Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = vnorm(vcross(ref, nn));
  const w = vcross(nn, u);
  return [nn, u, w];
}

/** Solid of revolution about an arbitrary axis. profile = [[radius, t], ...] */
function lathe(b, ax, c, profile, style, opts) {
  const o = opts || {};
  const seg = o.seg || 8;
  const [n, u, w] = basisOf(ax);
  const at = (r, t, a) => {
    const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    return [
      c[0] + n[0] * t + u[0] * ca + w[0] * sa,
      c[1] + n[1] * t + u[1] * ca + w[1] * sa,
      c[2] + n[2] * t + u[2] * ca + w[2] * sa,
    ];
  };
  let prev = null;
  for (let k = 0; k < profile.length; k++) {
    const r = profile[k][0], t = profile[k][1];
    const ring = [];
    for (let i = 0; i < seg; i++) ring.push(at(r, t, (i / seg) * TAU));
    if (prev) {
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        b.quad(prev[i], prev[j], ring[j], ring[i], style);
      }
    } else if (o.capStart !== false && r > 1e-4) {
      b.poly(ring.slice(), style);
    }
    prev = ring;
  }
  if (prev && o.capEnd !== false && profile[profile.length - 1][0] > 1e-4) {
    b.poly(prev.slice(), style);
  }
  return b;
}

/** One flat collar / bead ring about an axis, at distance t. */
function bead(b, ax, c, t, rIn, rOut, style, seg) {
  const s = seg || 8;
  const [n, u, w] = basisOf(ax);
  const pt = (r, a) => [
    c[0] + n[0] * t + u[0] * r * Math.cos(a) + w[0] * r * Math.sin(a),
    c[1] + n[1] * t + u[1] * r * Math.cos(a) + w[1] * r * Math.sin(a),
    c[2] + n[2] * t + u[2] * r * Math.cos(a) + w[2] * r * Math.sin(a),
  ];
  for (let i = 0; i < s; i++) {
    const a0 = (i / s) * TAU, a1 = ((i + 1) / s) * TAU;
    b.quad(pt(rIn, a0), pt(rOut, a0), pt(rOut, a1), pt(rIn, a1), style);
  }
  return b;
}

/** Rotate a node about an arbitrary world pivot using Euler XYZ angles. */
function pivot(node, c, rx, ry, rz) {
  const R = m4euler(rx, ry, rz);
  const p = m4xformP(R, c);
  node.setRot(rx, ry, rz);
  node.setPos(c[0] - p[0], c[1] - p[1], c[2] - p[2]);
  return node;
}

/** Stacked prism from an XZ outline. layers = [{y, s, style}] (band below). */
function prism(b, cx, cz, poly, layers, topStyle, botStyle) {
  const rings = layers.map((L) => poly.map((q) => [cx + q[0] * L.s, L.y, cz + q[1] * L.s]));
  for (let k = 1; k < rings.length; k++) {
    const A = rings[k - 1], B = rings[k];
    const s = layers[k].style || layers[k - 1].style;
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      b.quad(A[i], A[j], B[j], B[i], s);
    }
  }
  if (topStyle) b.poly(rings[rings.length - 1].slice(), topStyle);
  if (botStyle) b.poly(rings[0].slice().reverse(), botStyle);
  return b;
}

/** Sagging catenary-ish run between two points (one polyline). */
function sagLine(b, a, z, drop, n, style) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(Math.PI * t);
    pts.push([
      a[0] + (z[0] - a[0]) * t,
      a[1] + (z[1] - a[1]) * t - drop * s * s,
      a[2] + (z[2] - a[2]) * t,
    ]);
  }
  b.polyline(pts, style);
  return pts;
}

/** Arc of a circle as a polyline. */
function arcPts(center, u, w, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([
      center[0] + (u[0] * Math.cos(a) + w[0] * Math.sin(a)) * r,
      center[1] + (u[1] * Math.cos(a) + w[1] * Math.sin(a)) * r,
      center[2] + (u[2] * Math.cos(a) + w[2] * Math.sin(a)) * r,
    ]);
  }
  return out;
}

/* ------------------------------------------------------------- ctx shims */

function getSt(ctx, k, dflt) {
  const s = ctx.state;
  if (!s) return dflt;
  if (typeof s.get === 'function') {
    const v = s.get(k);
    if (v !== undefined) return v;
  }
  if (s[k] !== undefined) return s[k];
  if (s.data && s.data[k] !== undefined) return s.data[k];
  return dflt;
}

function setSt(ctx, k, v) {
  if (typeof ctx.set === 'function') { ctx.set(k, v); return; }
  if (ctx.state && typeof ctx.state.set === 'function') { ctx.state.set(k, v); return; }
  if (ctx.state) ctx.state[k] = v;
}

function sfx(ctx, name) {
  try {
    if (ctx && ctx.audio && typeof ctx.audio.sfx === 'function') ctx.audio.sfx(name);
  } catch (e) { /* audio must never break the scene */ }
}

function addLight(ctx, x, y, z, r, col, i) {
  try {
    if (typeof ctx.light === 'function') ctx.light(x, y, z, r, col, i);
    else if (ctx.scene && typeof ctx.scene.light === 'function') ctx.scene.light(x, y, z, r, col, i);
  } catch (e) { /* ignore */ }
}

function mkObj(ctx, opts) {
  if (typeof ctx.object === 'function') return ctx.object(opts);
  return ctx.scene.object(opts);
}

/* ================================================================= build == */

export default function build(ctx) {
  if (!ctx || !ctx.scene) return;
  const scene = ctx.scene;
  const paper = scene.paper();
  const rng = makeRng(0x51de02);
  const themeOf = (c) => (c && c.theme) || ctx.theme || {};

  /* ---------------------------------------------------------- floor / wall
   * cast shadows + ambient occlusion; hatch only, never a solid fill.      */
  (function ground() {
    const H = (gap, angle, alpha, width) => ({
      gap, angle, width: width === undefined ? 0.52 : width, stroke: 'inkSoft', alpha,
    });
    paper.quad([-3.12, 0.004, -2.58], [-0.92, 0.004, -2.58], [-0.92, 0.004, -1.40], [-3.12, 0.004, -1.40],
      sty('none', 'none', 0, { hatch: H(8.0, 22, 0.30) }));
    paper.quad([-2.88, 0.006, -2.42], [-1.12, 0.006, -2.42], [-1.12, 0.006, -1.60], [-2.88, 0.006, -1.60],
      sty('none', 'none', 0, { hatch: H(4.8, 22, 0.28) }));
    paper.poly([
      [-2.22, 0.005, -1.30], [-2.08, 0.005, -1.16], [-1.84, 0.005, -1.09],
      [-1.66, 0.005, -1.22], [-1.72, 0.005, -1.42], [-1.92, 0.005, -1.48],
    ], sty('none', 'none', 0, { hatch: H(5.6, 40, 0.30) }));
    paper.quad([-3.18, 0.0, -2.594], [-0.86, 0.0, -2.594], [-0.86, 0.36, -2.594], [-3.18, 0.36, -2.594],
      sty('none', 'none', 0, { hatch: H(4.4, 78, 0.20) }));
    paper.quad([-2.00, 0.007, -2.40], [-1.08, 0.007, -2.40], [-1.08, 0.007, -1.86], [-2.00, 0.007, -1.86],
      sty('none', 'none', 0, { hatch: H(3.8, 12, 0.24) }));
  }());

  /* ================================================================ DESK == */
  const DX0 = -2.95, DX1 = -1.05, DZ0 = -2.46, DZ1 = -1.78, DTY = 0.75, DTH = 0.035;

  const desk = mkObj(ctx, { id: 'desk', label: '书桌' });
  const db = desk.builder;

  (function deskCarcass() {
    // top slab: top face paper, front edge face1, receding edges face2
    db.quad([DX0, DTY, DZ1], [DX1, DTY, DZ1], [DX1, DTY, DZ0], [DX0, DTY, DZ0], sty(P, 'ink', OUT));
    db.quad([DX0, DTY - DTH, DZ1], [DX1, DTY - DTH, DZ1], [DX1, DTY, DZ1], [DX0, DTY, DZ1], sty(F1, 'ink', OUT));
    db.quad([DX1, DTY - DTH, DZ0], [DX0, DTY - DTH, DZ0], [DX0, DTY, DZ0], [DX1, DTY, DZ0], sty(F2, 'ink', MAIN));
    db.quad([DX1, DTY - DTH, DZ1], [DX1, DTY - DTH, DZ0], [DX1, DTY, DZ0], [DX1, DTY, DZ1], sty(F2, 'ink', MAIN));
    db.quad([DX0, DTY - DTH, DZ0], [DX0, DTY - DTH, DZ1], [DX0, DTY, DZ1], [DX0, DTY, DZ0], sty(F2, 'ink', MAIN));
    db.quad([DX0, DTY - DTH, DZ0], [DX1, DTY - DTH, DZ0], [DX1, DTY - DTH, DZ1], [DX0, DTY - DTH, DZ1],
      sty(F3, 'inkSoft', DET));

    // --- wood grain: 4 long wavy polylines along the top
    const grain = sty('none', 'inkSoft', 0.6);
    for (let g = 0; g < 4; g++) {
      const z0 = DZ0 + 0.12 + g * 0.16;
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        pts.push([
          DX0 + 0.03 + t * 1.86,
          DTY + 0.0006,
          z0 + Math.sin(t * 5.1 + g * 1.7) * 0.012 + Math.sin(t * 13.0 + g) * 0.004,
        ]);
      }
      db.polyline(pts, grain);
    }
    // pale, wide grain hatch at a shallow angle
    db.quad([DX0 + 0.012, DTY + 0.0004, DZ0 + 0.012], [DX1 - 0.012, DTY + 0.0004, DZ0 + 0.012],
      [DX1 - 0.012, DTY + 0.0004, DZ1 - 0.012], [DX0 + 0.012, DTY + 0.0004, DZ1 - 0.012],
      sty('none', 'none', 0, { hatch: { gap: 18, angle: 7, width: 0.45, stroke: 'inkSoft', alpha: 0.14 } }));
    // visible shadow line under the overhanging top
    db.quad([DX0 + 0.02, 0.664, DZ1 - 0.004], [DX1 - 0.02, 0.664, DZ1 - 0.004],
      [DX1 - 0.02, DTY - DTH, DZ1 - 0.004], [DX0 + 0.02, DTY - DTH, DZ1 - 0.004],
      sty(F3, 'none', 0));

    // --- four turned legs
    const legStyle = sty(F1, 'ink', OUT);
    const legBead = sty(F2, 'ink', DET);
    for (const [lx, lz] of [[-2.88, -2.39], [-2.88, -1.85], [-1.10, -2.39], [-1.10, -1.85]]) {
      // tapered turned leg (cylinder + rTop gives the taper, beads the turning)
      db.cylinder(lx, (DTY - DTH) / 2, lz, 0.022, DTY - DTH, legStyle,
        { segments: 8, rTop: 0.030, capTop: false });
      bead(db, [0, 1, 0], [lx, 0, lz], 0.155, 0.023, 0.034, legBead, 6);
      bead(db, [0, 1, 0], [lx, 0, lz], 0.222, 0.023, 0.033, legBead, 6);
    }

    // --- aprons with a beaded lower edge
    db.boxOpen([-2.88, 0.60, -1.872], [-1.10, DTY - DTH, -1.822], sty(F1, 'ink', MAIN), ['nz', 'ny', 'py']);
    db.boxOpen([-2.892, 0.583, -1.879], [-1.088, 0.60, -1.815], sty(F2, 'ink', DET), ['nz', 'ny', 'py']);
    db.boxOpen([-2.905, 0.60, -2.40], [-2.86, DTY - DTH, -1.84], sty(F2, 'ink', MAIN), ['nx', 'ny', 'py']);
    db.boxOpen([-1.14, 0.60, -2.40], [-1.095, DTY - DTH, -1.84], sty(F2, 'ink', MAIN), ['px', 'ny', 'py']);
    for (const bx of [-2.60, -1.38]) {
      lathe(db, [0, 0, 1], [bx, 0.655, -1.872], [[0.008, 0], [0.008, 0.005], [0.0, 0.007]],
        sty(F2, 'ink', DET), { seg: 6 });
    }

    // --- cross rails
    db.boxOpen([-2.875, 0.13, -1.866], [-1.105, 0.19, -1.826], sty(F2, 'ink', MAIN), ['nz', 'ny', 'py', 'px', 'nx']);
    db.boxOpen([-2.90, 0.13, -2.37], [-2.86, 0.19, -1.88], sty(F2, 'ink', MAIN), ['nx', 'ny', 'py']);
    db.boxOpen([-1.14, 0.13, -2.37], [-1.10, 0.19, -1.88], sty(F2, 'ink', MAIN), ['px', 'ny', 'py']);

    // --- wall-side modesty panel with two vertical slats
    db.boxOpen([-2.86, 0.26, -2.42], [-1.14, 0.62, -2.40], sty(F2, 'ink', MAIN), ['nz']);
    for (const sx of [-2.60, -1.40]) {
      db.boxOpen([sx - 0.03, 0.28, -2.40], [sx + 0.03, 0.615, -2.386], sty(F1, 'ink', MAIN),
        ['nz', 'nx', 'px', 'ny', 'py']);
    }
    db.line([-2.86, 0.44, -2.399], [-1.14, 0.44, -2.399], sty('none', 'inkSoft', DET));
  }());

  /* ------------------------------------------------ under-desk pedestal -- */
  const CX0 = -1.95, CX1 = -1.13, CZ0 = -2.38, CZ1 = -1.92;
  const CXM = (CX0 + CX1) / 2;
  const DRAW = [
    { id: 'drawer-a', label: '抽屉', y0: 0.465, y1: 0.635, knob: 0.550 },
    { id: 'drawer-b', label: '抽屉', y0: 0.275, y1: 0.445, knob: 0.360 },
  ];

  (function pedestal() {
    const body = sty(F1, 'ink', OUT);
    const side = sty(F2, 'ink', MAIN);
    db.boxOpen([CX0, 0.03, CZ0], [CX0 + 0.03, 0.68, CZ1], side, ['nx', 'nz', 'ny']);
    db.boxOpen([CX1 - 0.03, 0.03, CZ0], [CX1, 0.68, CZ1], side, ['nx', 'nz', 'ny']);
    db.boxOpen([CX0, 0.65, CZ0], [CX1, 0.68, CZ1], body, ['nx', 'px', 'ny', 'nz']);
    db.boxOpen([CX0, 0.03, CZ0], [CX1, 0.055, CZ1], body, ['nx', 'px', 'py', 'nz']);
    db.boxOpen([CX0, 0.03, CZ0], [CX1, 0.68, CZ0 + 0.018], sty(F3, 'inkSoft', DET), ['nx', 'px', 'ny', 'py']);
    db.boxOpen([CX0 + 0.006, 0.0, CZ0 + 0.006], [CX1 - 0.006, 0.03, CZ1 - 0.02], sty(F2, 'ink', MAIN),
      ['nx', 'px', 'py', 'nz']);
    db.boxOpen([CX0 + 0.03, 0.445, CZ1 - 0.02], [CX1 - 0.03, 0.465, CZ1], sty(F1, 'ink', MAIN), ['nz', 'ny', 'py']);
    db.boxOpen([CX0 + 0.03, 0.250, CZ1 - 0.02], [CX1 - 0.03, 0.275, CZ1], sty(F1, 'ink', MAIN), ['nz', 'ny', 'py']);
    for (const by of [0.55, 0.36]) {
      lathe(db, [1, 0, 0], [CX1, by, CZ0 + 0.10], [[0.0, 0], [0.008, 0.004], [0.0, 0.007]], sty(F2, 'ink', DET), { seg: 6 });
    }
  }());

  // what lives inside the door compartment: shown only while the door is open
  const cabInner = desk.node('cab-inner');
  cabInner.visible = false;
  (function doorInterior() {
    const ib = cabInner.builder;
    ib.boxOpen([CX0 + 0.03, 0.115, CZ0 + 0.02], [CX1 - 0.03, 0.132, CZ1 - 0.02], sty(F3, 'inkSoft', DET),
      ['nx', 'px', 'ny', 'nz']);
    const boxSt = sty(F2, 'ink', DET);
    for (let i = 0; i < 3; i++) {
      const bx = CX0 + 0.10 + i * 0.24;
      ib.boxOpen([bx, 0.132, CZ0 + 0.05], [bx + 0.20, 0.208, CZ1 - 0.05], boxSt, ['nz', 'ny', 'px']);
      ib.line([bx, 0.132, CZ1 - 0.05], [bx + 0.20, 0.208, CZ1 - 0.05], sty('none', 'inkSoft', DET));
    }
    ib.boxOpen([CX0 + 0.03, 0.232, CZ0 + 0.02], [CX1 - 0.03, 0.250, CZ1 - 0.05], sty(F3, 'inkSoft', DET),
      ['nx', 'px', 'nz']);
  }());

  /* ---------------------------------------------------------- drawers ---- */
  const drawers = [];
  for (const D of DRAW) {
    const part = desk.part(D.id, { label: D.label, hint: '拉出/推回' });
    part.setAnchor(CXM, D.knob, CZ1);
    const b = part.builder;
    const zf0 = CZ1 - 0.024, zf1 = CZ1 + 0.006;

    b.boxOpen([CX0 + 0.02, D.y0, zf0], [CX1 - 0.02, D.y1, zf1], sty(F1, 'ink', OUT), ['nz']);
    // rebate: coplanar recessed field, pulled in front with a small +bias
    b.quad([CX0 + 0.042, D.y0 + 0.018, zf1 + 0.0015], [CX1 - 0.042, D.y0 + 0.018, zf1 + 0.0015],
      [CX1 - 0.042, D.y1 - 0.018, zf1 + 0.0015], [CX0 + 0.042, D.y1 - 0.018, zf1 + 0.0015],
      sty(F2, 'inkSoft', DET, { bias: 2.0 }));

    // dovetail seams at both ends of the front
    for (const sx of [CX0 + 0.02, CX1 - 0.02]) {
      const inward = sx === CX0 + 0.02 ? 1 : -1;
      for (let i = 0; i < 2; i++) {
        const t0 = D.y0 + 0.022 + i * (D.y1 - D.y0 - 0.044) / 2;
        const t1 = t0 + (D.y1 - D.y0 - 0.044) / 2;
        b.line([sx + inward * 0.004, t0, zf1 + 0.001], [sx + inward * 0.014, t1, zf1 + 0.001],
          sty('none', 'inkSoft', DET));
      }
    }

    // internal box (sides + bottom + back) + contents: only shown while open.
    // bias -0.5 = drawn EARLIER / BEHIND, so the box can never win the painter's
    // sort against its own (much larger) front panel and float over it.
    const inner = part.node('inner');
    inner.visible = false;
    const ib = inner.builder;
    const iz0 = zf0, iz1 = CZ1 - 0.36;
    const inSt = (fill, stroke, width) => sty(fill, stroke, width, { bias: -0.5 });
    ib.boxOpen([CX0 + 0.05, D.y0 + 0.006, iz1], [CX1 - 0.05, D.y0 + 0.016, iz0], inSt(F3, 'inkSoft', DET),
      ['nx', 'px', 'ny', 'nz']);
    ib.boxOpen([CX0 + 0.05, D.y0 + 0.016, iz1], [CX0 + 0.068, D.y1 - 0.012, iz0], inSt(F2, 'ink', DET),
      ['nx', 'nz', 'ny']);
    ib.boxOpen([CX1 - 0.068, D.y0 + 0.016, iz1], [CX1 - 0.05, D.y1 - 0.012, iz0], inSt(F2, 'ink', DET),
      ['px', 'nz', 'ny']);
    ib.boxOpen([CX0 + 0.05, D.y0 + 0.016, iz1], [CX1 - 0.05, D.y1 - 0.012, iz1 + 0.014], inSt(F3, 'inkSoft', DET),
      ['nz', 'ny', 'py']);

    // contents: folded papers, a pen tray, a small tin
    const py = D.y0 + 0.020;
    ib.quad([CX0 + 0.10, py, iz0 - 0.06], [CX0 + 0.30, py + 0.004, iz0 - 0.09],
      [CX0 + 0.33, py + 0.004, iz1 + 0.07], [CX0 + 0.13, py, iz1 + 0.10], inSt(P, 'inkSoft', DET));
    ib.line([CX0 + 0.30, py + 0.005, iz0 - 0.09], [CX0 + 0.13, py + 0.005, iz1 + 0.10],
      inSt('none', 'inkSoft', DET));
    ib.boxOpen([CX1 - 0.26, py, iz0 - 0.12], [CX1 - 0.09, py + 0.022, iz0 - 0.03], inSt(F2, 'ink', DET),
      ['nz', 'ny', 'px', 'nx']);
    ib.line([CX1 - 0.22, py + 0.022, iz0 - 0.12], [CX1 - 0.22, py + 0.022, iz0 - 0.03],
      inSt('none', 'inkSoft', DET));
    lathe(ib, [0, 1, 0], [CX1 - 0.15, py + 0.022, iz1 + 0.09],
      [[0.0, 0], [0.036, 0.003], [0.036, 0.040], [0.0, 0.046]], inSt(F1, 'ink', MAIN), { seg: 6 });

    // turned wooden knob on a small rose, on its own node so it can spin
    const knobs = [];
    const kn = part.node('knob');
    lathe(kn.builder, [0, 0, 1], [CXM, D.knob, zf1],
      [[0.012, 0], [0.022, 0.006], [0.017, 0.014], [0.0, 0.032]], sty(F2, 'ink', MAIN), { seg: 6, capStart: false });
    bead(kn.builder, [0, 0, 1], [CXM, D.knob, zf1], 0.001, 0.013, 0.023, sty(F2, 'ink', DET), 6);
    // radial tick: makes the 8° hover turn legible
    kn.builder.line([CXM, D.knob, zf1 + 0.0325], [CXM, D.knob + 0.014, zf1 + 0.0325], sty('none', 'ink', DET));
    knobs.push({ node: kn, c: [CXM, D.knob, zf1] });
    drawers.push({ part, D, knobs, inner, open: false, t: 0, hover: 0, hoverT: 0, settle: new Spring(0, 170, 9) });
  }

  /* ------------------------------------------------------ cabinet door --- */
  const doorPart = desk.part('door', { label: '柜门', hint: '开关' });
  const DOOR_X0 = CX0 + 0.035, DOOR_X1 = CX1 - 0.035, DOOR_Y0 = 0.062, DOOR_Y1 = 0.243;
  const DOOR_PIVOT = [DOOR_X0 + 0.008, 0.15, CZ1 - 0.014];
  const DOOR_ANGLE = -1.83;                      // ~105°
  const doorKnobNode = doorPart.node('knob');
  doorPart.setAnchor(CXM, 0.15, CZ1);
  (function doorGeo() {
    const b = doorPart.builder;
    const z0 = CZ1 - 0.026, z1 = CZ1 - 0.004;
    b.boxOpen([DOOR_X0, DOOR_Y0, z0], [DOOR_X1, DOOR_Y1, z1], sty(F1, 'ink', OUT), ['nz']);
    b.quad([DOOR_X0 + 0.028, DOOR_Y0 + 0.024, z1 + 0.0015], [DOOR_X1 - 0.028, DOOR_Y0 + 0.024, z1 + 0.0015],
      [DOOR_X1 - 0.028, DOOR_Y1 - 0.024, z1 + 0.0015], [DOOR_X0 + 0.028, DOOR_Y1 - 0.024, z1 + 0.0015],
      sty(F2, 'inkSoft', DET, { bias: 2.0 }));
    b.polyline([[DOOR_X0 + 0.014, DOOR_Y0 + 0.012, z1 + 0.001], [DOOR_X1 - 0.014, DOOR_Y0 + 0.012, z1 + 0.001],
      [DOOR_X1 - 0.014, DOOR_Y1 - 0.012, z1 + 0.001], [DOOR_X0 + 0.014, DOOR_Y1 - 0.012, z1 + 0.001]],
      sty('none', 'inkSoft', DET), true);
    for (const hy of [0.092, 0.212]) {
      lathe(b, [0, 1, 0], [DOOR_X0 + 0.014, hy - 0.016, z1 - 0.008],
        [[0.012, 0], [0.012, 0.032]], sty(F2, 'ink', MAIN), { seg: 6 });
      b.line([DOOR_X0 - 0.004, hy - 0.012, z1], [DOOR_X0 + 0.032, hy - 0.012, z1], sty('none', 'inkSoft', DET));
      b.line([DOOR_X0 - 0.004, hy + 0.012, z1], [DOOR_X0 + 0.032, hy + 0.012, z1], sty('none', 'inkSoft', DET));
    }
    // small catch on the free stile
    b.boxOpen([DOOR_X1 - 0.03, 0.146, z0 - 0.012], [DOOR_X1 - 0.008, 0.163, z0], sty(F2, 'ink', DET),
      ['nz', 'ny', 'px', 'nx']);
    // knob + rose + tick
    lathe(doorKnobNode.builder, [0, 0, 1], [DOOR_X1 - 0.05, 0.15, z1],
      [[0.011, 0], [0.019, 0.006], [0.0, 0.028]], sty(F2, 'ink', MAIN), { seg: 6, capStart: false });
    bead(doorKnobNode.builder, [0, 0, 1], [DOOR_X1 - 0.05, 0.15, z1], 0.001, 0.012, 0.020, sty(F2, 'ink', DET), 6);
    doorKnobNode.builder.line([DOOR_X1 - 0.05, 0.15, z1 + 0.0285], [DOOR_X1 - 0.05, 0.162, z1 + 0.0285],
      sty('none', 'ink', DET));
  }());

  /* desk update: drawers + cabinet door */
  const doorState = { open: false, hover: 0, hoverT: 0, spring: new Spring(0, 150, 9) };

  desk.onUpdate((dt, now, c) => {
    for (const d of drawers) {
      const target = d.open ? 1 : 0;
      const dur = 0.42;
      if (d.t !== target) {
        d.t = clamp(d.t + Math.sign(target - d.t) * dt / dur, 0, 1);
        if (d.t === 1 && target === 1 && d.settle.value === 0 && d.settle.vel === 0) {
          d.settle.value = 0.085;              // small overshoot, then settle
        }
      }
      d.settle.step(dt);
      let off = ease.cubicOut(d.t);
      if (d.t >= 1) off += d.settle.value * 0.22;
      d.hover = damp(d.hover, d.hoverT, 13, dt);
      d.part.setPos(0, 0, off * 0.22 + d.hover * 0.005);
      d.inner.visible = d.t > 0.03;
      for (const k of d.knobs) pivot(k.node, k.c, 0, 0, d.hover * 0.14);
    }
    doorState.spring.to(doorState.open ? 1 : 0);
    doorState.spring.step(dt);
    cabInner.visible = doorState.spring.value > 0.05;
    doorState.hover = damp(doorState.hover, doorState.hoverT, 13, dt);
    const ang = DOOR_ANGLE * doorState.spring.value - doorState.hover * 0.02;
    pivot(doorPart, DOOR_PIVOT, 0, ang, 0);
    doorPart.setPos(doorPart.pos[0], doorPart.pos[1], doorPart.pos[2] + doorState.hover * 0.004);
    doorKnobNode.setRot(0, 0, doorState.hover * 0.7);
  });

  for (const d of drawers) {
    d.part.onHover((isHover) => { d.hoverT = isHover ? 1 : 0; });
    d.part.onClick((c) => {
      d.open = !d.open;
      d.settle.value = 0; d.settle.vel = 0;
      sfx(c, d.open ? 'drawer' : 'thud');
    });
  }
  doorPart.onHover((isHover) => { doorState.hoverT = isHover ? 1 : 0; });
  doorPart.onClick((c) => {
    doorState.open = !doorState.open;
    if (!doorState.open) doorState.spring.vel -= 1.2;   // bounce against the stop
    sfx(c, doorState.open ? 'cabinet' : 'doorClose');
  });

  /* ============================================================ DESK LAMP */
  const lamp = mkObj(ctx, { id: 'desk-lamp', label: '台灯' });
  const lb = lamp.builder;
  const LX = -2.55, LZ = -2.20;
  const ELB = [-2.49, 1.135, -2.09];
  const SHC = [-2.42, 1.195, -2.00];
  const BULB = [-2.42, 1.168, -2.00];
  const SWP = [-2.615, DTY + 0.008, -1.905];

  const innerShadeStyle = sty('dark', 'inkSoft', DET);
  const bulbStyle = sty(F1, 'ink', MAIN);
  const poolNode = lamp.node('pool');
  const shadeNode = lamp.node('shade');
  const cordNode = lamp.node('pullcord');
  let rocker = null;

  (function lampGeo() {
    // weighted base: turned profile + column
    lathe(lb, [0, 1, 0], [LX, DTY + 0.0095, LZ],
      [[0.076, -0.0095], [0.074, 0.0045], [0.070, 0.0095]], sty(F1, 'ink', OUT), { seg: 10 });
    lathe(lb, [0, 1, 0], [LX, DTY + 0.11, LZ],
      [[0.026, -0.09], [0.020, 0.0], [0.017, 0.09]], sty(F2, 'ink', MAIN), { seg: 8, capStart: false, capEnd: false });
    bead(lb, [0, 1, 0], [LX, DTY, LZ], 0.056, 0.023, 0.033, sty(F2, 'ink', DET), 8);
    bead(lb, [0, 1, 0], [LX, DTY, LZ], 0.128, 0.022, 0.032, sty(F2, 'ink', DET), 8);

    // lower arm + elbow joint with a visible bolt
    const a0 = [LX, DTY + 0.19, LZ];
    const d1 = vnorm([ELB[0] - a0[0], ELB[1] - a0[1], ELB[2] - a0[2]]);
    const l1 = Math.hypot(ELB[0] - a0[0], ELB[1] - a0[1], ELB[2] - a0[2]);
    lathe(lb, d1, a0, [[0.012, 0], [0.012, l1]], sty(F1, 'ink', MAIN), { seg: 6 });
    lathe(lb, [1, 0, 0], [ELB[0] - 0.019, ELB[1], ELB[2]],
      [[0.0, 0], [0.017, 0.017], [0.0, 0.034]], sty(F2, 'ink', MAIN), { seg: 8 });
    lathe(lb, [1, 0, 0], [ELB[0] - 0.030, ELB[1], ELB[2]],
      [[0.0, 0], [0.010, 0], [0.010, 0.052], [0.0, 0.052]], sty(F2, 'ink', DET), { seg: 6 });
    lb.line([ELB[0] - 0.034, ELB[1] + 0.007, ELB[2]], [ELB[0] + 0.022, ELB[1] + 0.007, ELB[2]],
      sty('none', 'inkSoft', DET));

    // upper arm
    const b1 = [SHC[0], SHC[1] + 0.040, SHC[2]];
    const d2 = vnorm([b1[0] - ELB[0], b1[1] - ELB[1], b1[2] - ELB[2]]);
    const l2 = Math.hypot(b1[0] - ELB[0], b1[1] - ELB[1], b1[2] - ELB[2]);
    lathe(lb, d2, ELB, [[0.010, 0], [0.010, l2]], sty(F1, 'ink', MAIN), { seg: 6 });

    // --- shade (open cone) on its own swinging node
    const sb = shadeNode.builder;
    sb.cylinder(SHC[0], SHC[1], SHC[2], 0.095, 0.080, sty(F1, 'ink', OUT),
      { segments: 12, rTop: 0.030, capTop: false, capBottom: false });
    sb.ring(SHC[0], SHC[1] - 0.040, SHC[2], 0.088, 0.098, sty(F2, 'ink', MAIN), { segments: 12 });
    sb.disc(SHC[0], SHC[1] + 0.041, SHC[2], 0.031, sty(F2, 'ink', MAIN), { segments: 10 });
    // inner shade surface: a small ellipse, dark -> warm glow
    sb.disc(SHC[0], SHC[1] - 0.028, SHC[2], 0.060, innerShadeStyle, { segments: 12 });
    // visible bulb
    lathe(sb, [0, 1, 0], [BULB[0], BULB[1], BULB[2]],
      [[0.0, -0.018], [0.016, 0.0], [0.0, 0.020]], bulbStyle, { seg: 8 });
    sb.line([BULB[0], BULB[1] - 0.026, BULB[2]], [SHC[0], SHC[1] + 0.020, SHC[2]], sty('none', 'inkSoft', DET));

    // --- pull cord hanging from the arm
    const cb = cordNode.builder;
    const cp0 = [-2.468, 1.048, -2.075];
    const cpts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      cpts.push([cp0[0] + Math.sin(t * 3) * 0.004, cp0[1] - t * 0.075, cp0[2] + 0.006 * t]);
    }
    cb.polyline(cpts, sty('none', 'inkSoft', DET));
    lathe(cb, [0, 1, 0], [cp0[0] + 0.004, cp0[1] - 0.083, cp0[2] + 0.006],
      [[0.0, 0], [0.008, 0.008], [0.0, 0.014]], sty(F2, 'ink', DET), { seg: 6 });

    // --- power cord: catenary onto the desk, then over the edge
    const cordSt = sty('none', 'inkSoft', 0.9);
    sagLine(lb, [LX + 0.014, DTY + 0.198, LZ + 0.01], [-2.585, DTY + 0.006, -2.06], 0.026, 7, cordSt);
    sagLine(lb, [-2.585, DTY + 0.006, -2.06], [-2.612, DTY + 0.010, -1.905], 0.008, 5, cordSt);
    lb.polyline([
      [-2.612, DTY + 0.010, -1.905], [-2.628, DTY - 0.004, -1.852], [-2.640, DTY - 0.030, -1.812],
      [-2.652, DTY - 0.075, -1.792], [-2.664, DTY - 0.128, -1.800], [-2.672, DTY - 0.178, -1.828],
    ], cordSt);
    lathe(lb, [0, 1, 0], [LX + 0.014, DTY + 0.196, LZ + 0.01], [[0.008, 0], [0.010, 0.018]],
      sty(F2, 'ink', DET), { seg: 6 });

    // --- warm hatch cone on the desk under the lamp (only while lit)
    poolNode.visible = false;
    const pp = poolNode.builder;
    const pool = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      pool.push([-2.42 + Math.cos(a) * 0.215, DTY + 0.0012, -2.00 + Math.sin(a) * 0.215]);
    }
    pp.poly(pool, sty([255, 216, 150], 'none', 0,
      { alpha: 0.12, hatch: { gap: 6, angle: 34, width: 0.5, stroke: 'accent', alpha: 0.30 } }));
  }());

  /* inline rocker switch on the cord — the pickable part */
  const swPart = lamp.part('lamp-switch', { label: '台灯', hint: '开灯/关灯' });
  swPart.setAnchor(SWP[0], SWP[1], SWP[2]);
  const ROCK_PIVOT = [SWP[0], SWP[1] + 0.014, SWP[2]];
  (function switchGeo() {
    const b = swPart.builder;
    b.boxOpen([SWP[0] - 0.026, SWP[1] - 0.011, SWP[2] - 0.017], [SWP[0] + 0.026, SWP[1] + 0.012, SWP[2] + 0.017],
      sty(F1, 'ink', OUT), ['nz', 'ny']);
    b.line([SWP[0] - 0.026, SWP[1] - 0.011, SWP[2] - 0.017], [SWP[0] + 0.026, SWP[1] - 0.011, SWP[2] - 0.017],
      sty('none', 'inkSoft', DET));
    b.line([SWP[0] - 0.052, DTY + 0.004, SWP[2]], [SWP[0] - 0.026, SWP[1], SWP[2]], sty('none', 'inkSoft', 0.9));
    b.line([SWP[0] + 0.026, SWP[1], SWP[2]], [SWP[0] + 0.050, DTY - 0.006, SWP[2] - 0.010], sty('none', 'inkSoft', 0.9));
    // invisible pick proxies (the base area also toggles the lamp)
    b.disc(LX, DTY + 0.021, LZ, 0.080, sty('none', 'none', 0), { segments: 12 });
    b.quad([SWP[0] - 0.058, SWP[1] - 0.05, SWP[2] - 0.05], [SWP[0] + 0.058, SWP[1] - 0.05, SWP[2] - 0.05],
      [SWP[0] + 0.058, SWP[1] + 0.05, SWP[2] + 0.05], [SWP[0] - 0.058, SWP[1] + 0.05, SWP[2] + 0.05],
      sty('none', 'none', 0));
    rocker = swPart.node('rocker');
    rocker.builder.boxOpen([SWP[0] - 0.017, SWP[1] + 0.009, SWP[2] - 0.011],
      [SWP[0] + 0.017, SWP[1] + 0.020, SWP[2] + 0.011], sty(F2, 'ink', MAIN), ['nz', 'ny', 'nx', 'px']);
    rocker.builder.line([SWP[0] - 0.017, SWP[1] + 0.020, SWP[2]], [SWP[0] + 0.017, SWP[1] + 0.020, SWP[2]],
      sty('none', 'inkSoft', DET));
  }());

  /* lamp animation */
  const rockerSpring = new Spring(0.23, 120, 10);
  const shadeSpring = new Spring(0, 90, 7);
  const cordSpring = new Spring(0, 130, 7);
  const SHADE_PIVOT = [SHC[0], SHC[1] + 0.058, SHC[2]];
  let lampGlow = 0, swHover = 0, swHoverT = 0, swNudge = 0;

  lamp.onUpdate((dt, now, c) => {
    const on = !!getSt(c, 'lampOn', false);
    // glow ramps over ~0.45 s with cubicOut
    lampGlow = on ? Math.min(1, lampGlow + dt / 0.45) : Math.max(0, lampGlow - dt / 0.45);
    const g = ease.cubicOut(lampGlow);
    const th = themeOf(c);
    const darkC = (th.fill && th.fill.dark) || [46, 46, 52];
    const glowC = (th.fill && th.fill.glow) || [255, 246, 224];
    innerShadeStyle.fill = mixRGB(darkC, [255, 214, 142], g);
    innerShadeStyle.stroke = g > 0.45 ? 'accent' : 'inkSoft';
    bulbStyle.fill = mixRGB([236, 234, 227], glowC, g);
    bulbStyle.stroke = g > 0.45 ? 'accent' : 'ink';
    poolNode.visible = g > 0.02;

    rockerSpring.to(on ? -0.24 : 0.24);
    rockerSpring.step(dt);
    pivot(rocker, ROCK_PIVOT, 0, 0, rockerSpring.value);
    swHover = damp(swHover, swHoverT, 14, dt);
    swNudge = damp(swNudge, swHover * 0.003, 16, dt);
    rocker.setPos(rocker.pos[0], rocker.pos[1] + swNudge, rocker.pos[2]);

    cordSpring.step(dt);
    cordNode.setRot(0, 0, cordSpring.value * 0.10 + Math.sin(now * 19) * 0.007 * swHover);

    shadeSpring.step(dt);
    pivot(shadeNode, SHADE_PIVOT, 0, 0, shadeSpring.value * 0.035);

    if (on) addLight(c, BULB[0], BULB[1], BULB[2], 1.35, [255, 214, 150], 0.9);
  });

  swPart.onHover((isHover) => {
    swHoverT = isHover ? 1 : 0;
    if (isHover) cordSpring.impulse(3.4);
  });
  swPart.onClick((c) => {
    const next = !getSt(c, 'lampOn', false);
    setSt(c, 'lampOn', next);
    sfx(c, 'lampClick');
    shadeSpring.impulse(-2.8);
    cordSpring.impulse(5.2);
    rockerSpring.impulse(next ? -1.6 : 1.6);
  });

  /* ================================================================= MUG */
  const mug = mkObj(ctx, { id: 'mug', label: '杯子' });
  const mugPart = mug.part('mug', { label: '杯子', hint: '蒸汽' });
  const MX = -1.62, MZ = -2.15;
  mugPart.setAnchor(MX, DTY + 0.06, MZ);
  const coffeeStyle = sty('dark', 'inkSoft', DET, { alpha: 0.55 });
  const coffeeLineStyle = sty('none', 'inkSoft', 0.7);
  const steamNode = mugPart.node('steam');
  const steamRibbons = [];

  (function mugGeo() {
    const b = mugPart.builder;
    // saucer / coaster
    lathe(b, [0, 1, 0], [MX, DTY, MZ], [[0.0, 0], [0.058, 0.003], [0.030, 0.010]],
      sty(F2, 'ink', MAIN), { seg: 8, capEnd: false });
    // slightly tapered body (rTop > radius)
    b.cylinder(MX, DTY + 0.0525, MZ, 0.036, 0.085, sty(F1, 'ink', OUT),
      { segments: 8, rTop: 0.042, capTop: false });
    // rolled rim
    bead(b, [0, 1, 0], [MX, DTY + 0.098, MZ], 0.0, 0.040, 0.046, sty(F2, 'ink', MAIN), 8);
    b.line([MX - 0.046, DTY + 0.098, MZ], [MX + 0.046, DTY + 0.098, MZ], sty('none', 'inkSoft', DET));
    // coffee + surface line
    b.disc(MX, DTY + 0.086, MZ, 0.038, coffeeStyle, { segments: 12 });
    b.polyline(arcPts([MX, DTY + 0.0862, MZ], [1, 0, 0], [0, 0, 1], 0.030, 0.55, 2.6, 6), coffeeLineStyle);
    // C handle following a half torus
    const hy = DTY + 0.055;
    for (const dz of [-0.007, 0.007]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = -0.30 + (i / 10) * (Math.PI + 0.60);
        pts.push([MX + 0.032 + Math.sin(t) * 0.028, hy + Math.cos(t) * 0.030, MZ + dz]);
      }
      b.polyline(pts, sty('none', 'ink', MAIN));
    }
    b.line([MX + 0.036, DTY + 0.085, MZ - 0.007], [MX + 0.036, DTY + 0.085, MZ + 0.007], sty('none', 'ink', DET));
    b.line([MX + 0.036, DTY + 0.025, MZ - 0.007], [MX + 0.036, DTY + 0.025, MZ + 0.007], sty('none', 'ink', DET));

    // --- steam: 3 ribbons, each 3 polylines so alpha can fade with height
    steamNode.visible = false;
    const sb = steamNode.builder;
    for (let r = 0; r < 3; r++) {
      const info = { phase: r / 3, speed: 0.34 + r * 0.11, wob: 0.9 + r * 0.35, recs: [] };
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let i = 0; i <= 4; i++) pts.push([MX, DTY + 0.10 + i * 0.01, MZ]);
        sb.polyline(pts, sty('none', 'inkSoft', 0.8, { alpha: 0.5 - k * 0.14 }));
        info.recs.push(steamNode.geo[steamNode.geo.length - 1]);
      }
      steamRibbons.push(info);
    }
  }());

  const mugWobble = new Spring(0, 150, 7);
  let mugHover = 0, mugHoverT = 0, steamOn = false;

  function updateSteam(t) {
    for (const rib of steamRibbons) {
      const life = ((t * rib.speed + rib.phase) % 1 + 1) % 1;
      const fade = Math.sin(Math.PI * life);
      for (let k = 0; k < 3; k++) {
        const rec = rib.recs[k];
        const pts = rec.pts;
        for (let i = 0; i < pts.length; i++) {
          const u = k / 3 + (i / (pts.length - 1)) / 3;      // 0 bottom .. 1 top
          const y = DTY + 0.098 + life * 0.17 + u * 0.20;
          const amp = 0.010 + u * 0.026;
          const ang = u * 3.4 + life * 6.0 + rib.phase * 8.0;
          pts[i][0] = MX + Math.sin(ang) * amp * rib.wob;
          pts[i][1] = y;
          pts[i][2] = MZ + Math.cos(ang * 0.83 + 1.1) * amp * 0.85;
        }
        rec.style.alpha = Math.max(0.06, fade * (0.55 - k * 0.16));
      }
    }
  }

  mug.onUpdate((dt, now, c) => {
    mugHover = damp(mugHover, mugHoverT, 12, dt);
    mugWobble.step(dt);
    pivot(mugPart, [MX, DTY, MZ], mugWobble.value * 0.05, 0, mugWobble.value * 0.09);
    mugPart.setPos(mugPart.pos[0], mugPart.pos[1] + mugHover * 0.002, mugPart.pos[2]);
    steamNode.visible = steamOn;
    if (steamOn) updateSteam(now);
    coffeeLineStyle.stroke = mugHover > 0.3 ? 'ink' : 'inkSoft';
    coffeeLineStyle.width = 0.7 + mugHover * 0.6;
    coffeeStyle.alpha = 0.55 + mugHover * 0.12;
  });

  mugPart.onHover((isHover) => { mugHoverT = isHover ? 1 : 0; });
  mugPart.onClick((c) => {
    steamOn = !steamOn;
    mugWobble.impulse(3.2);
    sfx(c, 'ceramic');
  });

  /* ================================================================ CHAIR */
  const chair = mkObj(ctx, { id: 'chair', label: '椅子' });
  const chPart = chair.part('chair', { label: '椅子', hint: '拖动', cursor: 'grab' });
  const CHX = -1.95, CHZ = -1.32;
  chPart.setAnchor(CHX, 0.50, CHZ);
  const swivelNode = chPart.node('swivel');
  const castorNodes = [];

  (function chairGeo() {
    const b = chPart.builder;
    const hubY = 0.062;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.31;
      const dx = Math.cos(a), dz = Math.sin(a);
      const px = -dz, pz = dx;
      const r0 = 0.042, r1 = 0.245, w0 = 0.030, w1 = 0.021;
      const y0 = hubY, y1 = 0.048, yb = 0.026;
      const A = (r, w, y) => [CHX + dx * r + px * w, y, CHZ + dz * r + pz * w];
      const B = (r, w, y) => [CHX + dx * r - px * w, y, CHZ + dz * r - pz * w];
      const arm = sty(F1, 'ink', MAIN);
      b.quad(A(r0, w0, y0), A(r1, w1, y1), B(r1, w1, y1), B(r0, w0, y0), arm);
      b.quad(A(r0, w0, y0), A(r0, w0, yb), A(r1, w1, yb - 0.006), A(r1, w1, y1), arm);
      b.quad(B(r0, w0, y0), B(r1, w1, y1), B(r1, w1, yb - 0.006), B(r0, w0, yb), arm);
      b.quad(A(r1, w1, y1), A(r1, w1, yb - 0.006), B(r1, w1, yb - 0.006), B(r1, w1, y1), sty(F2, 'ink', DET));

      const wc = [CHX + dx * 0.255, 0.033, CHZ + dz * 0.255];
      const node = chPart.node('castor' + k);
      const wb = node.builder;
      lathe(wb, [px, 0, pz], [wc[0] - px * 0.011, wc[1], wc[2] - pz * 0.011],
        [[0.033, 0], [0.033, 0.022]], sty(F1, 'ink', MAIN), { seg: 6, capStart: false, capEnd: false });
      wb.line([wc[0] - px * 0.012, wc[1] + 0.033, wc[2] - pz * 0.012],
        [wc[0] - dx * 0.03, wc[1] + 0.052, wc[2] - dz * 0.03], sty('none', 'inkSoft', DET));
      wb.line([wc[0] + px * 0.012, wc[1] + 0.033, wc[2] + pz * 0.012],
        [wc[0] - dx * 0.03, wc[1] + 0.052, wc[2] - dz * 0.03], sty('none', 'inkSoft', DET));
      castorNodes.push({ node, c: wc, axis: [px, 0, pz] });
    }
    // hub + bolt heads
    lathe(b, [0, 1, 0], [CHX, 0.03, CHZ], [[0.0, 0], [0.058, 0], [0.052, 0.048], [0.030, 0.062]],
      sty(F2, 'ink', MAIN), { seg: 8 });
    bead(b, [0, 1, 0], [CHX, 0.03, CHZ], 0.058, 0.030, 0.040, sty(F2, 'ink', DET), 8);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.31;
      bead(b, [0, 1, 0], [CHX + Math.cos(a) * 0.075, 0.048, CHZ + Math.sin(a) * 0.075],
        0.002, 0.0, 0.008, sty(F2, 'ink', DET), 5);
    }
    // gas lift: two concentric cylinders + collar
    lathe(b, [0, 1, 0], [CHX, 0.06, CHZ], [[0.030, 0], [0.030, 0.30]], sty(F2, 'ink', MAIN), { seg: 8, capStart: false });
    lathe(b, [0, 1, 0], [CHX, 0.34, CHZ], [[0.021, 0], [0.021, 0.09]], sty(F1, 'ink', MAIN), { seg: 8, capStart: false });
    bead(b, [0, 1, 0], [CHX, 0.06, CHZ], 0.30, 0.021, 0.036, sty(F2, 'ink', MAIN), 8);
    b.line([CHX - 0.031, 0.20, CHZ], [CHX + 0.031, 0.20, CHZ], sty('none', 'inkSoft', DET));
    b.line([CHX, 0.20, CHZ - 0.031], [CHX, 0.20, CHZ + 0.031], sty('none', 'inkSoft', DET));

    /* ---- everything above the column swivels ---- */
    const s = swivelNode.builder;
    // tilt mechanism + visible lever
    s.boxOpen([CHX - 0.085, 0.395, CHZ - 0.075], [CHX + 0.085, 0.432, CHZ + 0.075], sty(F2, 'ink', MAIN),
      ['ny', 'nz', 'px', 'nx', 'py']);
    s.boxOpen([CHX - 0.06, 0.372, CHZ - 0.05], [CHX + 0.06, 0.398, CHZ + 0.05], sty(F3, 'inkSoft', DET),
      ['ny', 'nz', 'py']);
    lathe(s, [1, 0, 0], [CHX, 0.412, CHZ + 0.086], [[0.011, 0], [0.011, 0.20]], sty(F2, 'ink', MAIN), { seg: 6 });
    lathe(s, [1, 0, 0], [CHX + 0.20, 0.412, CHZ + 0.086],
      [[0.0, 0], [0.020, 0.006], [0.0, 0.020]], sty(F1, 'ink', MAIN), { seg: 8 });
    s.line([CHX - 0.085, 0.413, CHZ + 0.086], [CHX + 0.085, 0.413, CHZ + 0.086], sty('none', 'inkSoft', DET));

    // seat pan (rounded octagonal prism)
    const oct = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      oct.push([Math.cos(a) * 0.195, Math.sin(a) * 0.165]);
    }
    prism(s, CHX, CHZ, oct, [
      { y: 0.432, s: 0.90, style: sty(F3, 'inkSoft', DET) },
      { y: 0.456, s: 1.00, style: sty(F1, 'ink', OUT) },
      { y: 0.498, s: 0.92, style: sty(F1, 'ink', MAIN) },
    ], sty(P, 'ink', OUT), sty(F3, 'inkSoft', DET));
    // seat seams / stitch dashes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      s.line([CHX + Math.cos(a) * 0.176, 0.499, CHZ + Math.sin(a) * 0.148],
        [CHX + Math.cos(a) * 0.186, 0.470, CHZ + Math.sin(a) * 0.158], sty('none', 'inkSoft', DET));
    }

    // spine + curved backrest
    s.boxOpen([CHX - 0.030, 0.482, CHZ + 0.10], [CHX + 0.030, 0.560, CHZ + 0.155], sty(F2, 'ink', MAIN), ['nz', 'ny']);
    const rows = [0.520, 0.660, 0.820, 0.935];
    const grid = rows.map((y) => {
      const t = (y - 0.520) / 0.415;
      const zc = -1.148 + 0.086 * t;
      const out = [];
      for (let i = 0; i < 4; i++) {
        const u = i / 3;
        const x = CHX - 0.175 + u * 0.35;
        const dxu = (x - CHX) / 0.175;
        out.push([x, y, zc - 0.042 * dxu * dxu]);
      }
      return out;
    });
    const front = sty(F1, 'ink', OUT);
    const back = sty(F2, 'ink', MAIN);
    for (let r = 0; r < grid.length - 1; r++) {
      for (let i = 0; i < grid[r].length - 1; i++) {
        const a0 = grid[r][i], a1 = grid[r][i + 1], b0 = grid[r + 1][i], b1 = grid[r + 1][i + 1];
        s.quad(a0, a1, b1, b0, front);
        s.quad([b0[0], b0[1], b0[2] + 0.022], [b1[0], b1[1], b1[2] + 0.022],
          [a1[0], a1[1], a1[2] + 0.022], [a0[0], a0[1], a0[2] + 0.022], back);
      }
    }
    for (let i = 0; i < grid[0].length - 1; i++) {
      const a0 = grid[3][i], a1 = grid[3][i + 1];
      s.quad(a0, [a0[0], a0[1], a0[2] + 0.022], [a1[0], a1[1], a1[2] + 0.022], a1, sty(F2, 'ink', MAIN));
    }
    for (const i of [0, 3]) {
      for (let r = 0; r < 3; r++) {
        const a0 = grid[r][i], a1 = grid[r + 1][i];
        s.quad(a0, [a0[0], a0[1], a0[2] + 0.022], [a1[0], a1[1], a1[2] + 0.022], a1, sty(F2, 'ink', DET));
      }
    }
    s.polyline([grid[1][0], grid[2][0], grid[3][0]], sty('none', 'inkSoft', DET));
    s.polyline([grid[1][3], grid[2][3], grid[3][3]], sty('none', 'inkSoft', DET));

    // lumbar support
    lathe(s, [0, 1, 0], [CHX, 0.545, CHZ + 0.086],
      [[0.052, 0.014], [0.044, 0.040], [0.0, 0.058]], sty(F2, 'ink', MAIN), { seg: 8, capStart: false });
    s.line([CHX - 0.05, 0.575, CHZ + 0.098], [CHX + 0.05, 0.575, CHZ + 0.098], sty('none', 'inkSoft', DET));
  }());

  /* chair behaviour: drag with momentum, coast, spring settle, 180° spin */
  const chPos = [0, 0];                       // translation from the rest pose
  const chVel = [0, 0];
  const chSettle = [new Spring(0, 95, 11), new Spring(0, 95, 11)];
  let chCoast = false, chDragDist = 0, chDragging = false;
  let chSpin = 0, chHover = 0, chHoverT = 0, spinTween = null;
  const spinSpring = new Spring(0, 60, 7);

  function chairBasis(c) {
    const cam = c && c.camera;
    let right = [0.88, 0, -0.48], fwd = [-0.48, 0, -0.88];
    let dist = 12.4;
    if (cam && cam.eye) {
      const vx = (CHX + chPos[0]) - cam.eye[0], vy = 0.5 - cam.eye[1], vz = (CHZ + chPos[1]) - cam.eye[2];
      dist = Math.hypot(vx, vy, vz) || 12.4;
      const r = vcross(vnorm([vx, 0, vz]), [0, 1, 0]);
      if (Math.hypot(r[0], r[2]) > 1e-4) right = vnorm(r);
      const f = vnorm([vx, 0, vz]);
      if (Math.hypot(f[0], f[2]) > 1e-4) fwd = f;
    }
    return { right, fwd, scale: 0.0032 * dist };
  }
  function clampChair() {
    chPos[0] = clamp(chPos[0], -0.95, 0.80);
    chPos[1] = clamp(chPos[1], -0.98, 0.02);
  }

  let dragEvtSeen = null;
  const onChairDrag = (e, c) => {
    if (!e || !e.phase) return;
    if (e === dragEvtSeen) return;          // same event delivered twice
    dragEvtSeen = e;
    if (e.phase === 'start') {
      chDragging = true; chCoast = false; chDragDist = 0; chVel[0] = 0; chVel[1] = 0;
      sfx(c, 'cushion');
    } else if (e.phase === 'move') {
      const B = chairBasis(c);
      const wx = (B.right[0] * e.dx - B.fwd[0] * e.dy) * B.scale;
      const wz = (B.right[2] * e.dx - B.fwd[2] * e.dy) * B.scale;
      chDragDist += Math.abs(e.dx) + Math.abs(e.dy);
      chPos[0] += wx; chPos[1] += wz;
      chVel[0] = wx * 60; chVel[1] = wz * 60;
      clampChair();
      chSettle[0].set(0); chSettle[1].set(0);
    } else if (e.phase === 'end') {
      chDragging = false;
      chCoast = true;
      if (Math.abs(chVel[0]) + Math.abs(chVel[1]) > 0.4) spinSpring.impulse((rng() - 0.5) * 1.6);
    }
  };
  chPart.onDrag(onChairDrag);
  chair.onDrag(onChairDrag);
  chPart.onHover((isHover) => { chHoverT = isHover ? 1 : 0; });
  chPart.onClick((c) => {
    if (chDragDist > 0.6) { chDragDist = 0; return; }
    spinTween = { t: 0, dur: 1.25, from: chSpin, to: chSpin + Math.PI };
    sfx(c, 'cushion');
  });

  chair.onUpdate((dt, now, c) => {
    if (chCoast) {
      chPos[0] += chVel[0] * dt; chPos[1] += chVel[1] * dt;
      const k = Math.exp(-2.4 * dt);
      chVel[0] *= k; chVel[1] *= k;
      clampChair();
      if (Math.abs(chVel[0]) + Math.abs(chVel[1]) < 0.03) {
        chCoast = false;
        // hand the leftover motion to the settle springs
        chSettle[0].set(0); chSettle[0].vel = chVel[0] * 0.5;
        chSettle[1].set(0); chSettle[1].vel = chVel[1] * 0.5;
      }
    } else {
      chSettle[0].step(dt); chSettle[1].step(dt);
    }
    // castors roll with the travel
    const roll = 0.06 * (chPos[0] + chPos[1]) / 0.033;
    for (const cst of castorNodes) {
      pivot(cst.node, cst.c, cst.axis[2] * roll, 0, -cst.axis[0] * roll);
    }
    // swivel
    if (spinTween) {
      spinTween.t = Math.min(1, spinTween.t + dt / spinTween.dur);
      chSpin = spinTween.from + (spinTween.to - spinTween.from) * ease.backOut(spinTween.t);
      if (spinTween.t >= 1) { chSpin = spinTween.to; spinTween = null; }
    } else if (!chDragging && !chCoast) {
      // seat drifts back toward the desk
      const wrapped = Math.round(chSpin / Math.PI) * Math.PI;
      chSpin = damp(chSpin, wrapped, 0.9, dt);
    }
    spinSpring.step(dt);
    chHover = damp(chHover, chHoverT, 12, dt);
    pivot(swivelNode, [CHX, 0, CHZ], 0, chSpin + spinSpring.value * 0.10, 0);
    chair.setPos(chPos[0] + chSettle[0].value, chHover * 0.005, chPos[1] + chSettle[1].value);
  });

  /* =============================================================== GLOBE */
  const globe = mkObj(ctx, { id: 'globe', label: '地球仪' });
  const gPart = globe.part('globe', { label: '地球仪', hint: '拖动旋转', cursor: 'grab' });
  const GX = -1.25, GZ = -2.28;
  const GC = [GX, DTY + 0.215, GZ];
  const GTILT = 0.41;                       // ~23.5°
  gPart.setAnchor(GX, DTY + 0.16, GZ);
  const sphereNode = gPart.node('sphere');
  const ringStyle = sty('none', 'inkSoft', MAIN);

  (function globeGeo() {
    const b = gPart.builder;
    // turned wooden base with three beads
    lathe(b, [0, 1, 0], [GX, DTY, GZ],
      [[0.0, 0], [0.072, 0.004], [0.036, 0.016], [0.030, 0.036], [0.038, 0.066], [0.022, 0.108]],
      sty(F1, 'ink', OUT), { seg: 10, capEnd: false });
    bead(b, [0, 1, 0], [GX, DTY, GZ], 0.036, 0.030, 0.044, sty(F2, 'ink', DET), 8);
    bead(b, [0, 1, 0], [GX, DTY, GZ], 0.076, 0.026, 0.040, sty(F2, 'ink', DET), 8);
    bead(b, [0, 1, 0], [GX, DTY, GZ], 0.106, 0.022, 0.032, sty(F2, 'ink', DET), 8);
    b.line([GX - 0.026, DTY + 0.096, GZ], [GX + 0.026, DTY + 0.096, GZ], sty('none', 'inkSoft', DET));

    // tilted axis rod + meridian ring (both static)
    const ax = [Math.sin(GTILT), Math.cos(GTILT), 0];
    lathe(b, ax, [GC[0] - ax[0] * 0.135, GC[1] - ax[1] * 0.135, GC[2]],
      [[0.009, 0], [0.009, 0.30]], sty(F2, 'ink', MAIN), { seg: 6 });
    lathe(b, ax, [GC[0] + ax[0] * 0.100, GC[1] + ax[1] * 0.100, GC[2]],
      [[0.008, 0], [0.014, 0.008], [0.008, 0.016]], sty(F2, 'ink', MAIN), { seg: 8, capStart: false });
    const u = [0, 1, 0];
    const w = [Math.cos(GTILT), 0, -Math.sin(GTILT)];
    // meridian ring: a full circle in the tilted vertical plane, plunging into the base
    const outer = arcPts(GC, u, w, 0.128, 0, TAU, 28);
    const inner = arcPts(GC, u, w, 0.116, 0, TAU, 28);
    b.polyline(outer, ringStyle, true);
    b.polyline(inner, ringStyle, true);
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const p = (r) => [GC[0] + w[0] * sa * r, GC[1] + ca * r, GC[2] + w[2] * sa * r];
      b.line(p(0.116), p(0.128), sty('none', 'ink', DET));
    }
    lathe(b, [0, 1, 0], [GX, DTY + 0.11, GZ], [[0.024, 0], [0.024, 0.02]], sty(F2, 'ink', MAIN), { seg: 8, capEnd: false });
    b.boxOpen([GX - 0.020, DTY + 0.130, GZ - 0.030], [GX + 0.020, DTY + 0.145, GZ + 0.030], sty(F1, 'ink', MAIN), ['nz', 'ny']);

    // ---------------- sphere (spins about its own tilted axis)
    const sb = sphereNode.builder;
    const rs = 0.098;
    sb.sphereWire(GC[0], GC[1], GC[2], rs, sty('none', 'ink', MAIN),
      { meridians: 8, parallels: 5, segments: 20 });
    // 4 stylised continent outlines projected onto the sphere
    const conts = [
      [[52, -100], [46, -78], [30, -82], [18, -96], [30, -114], [44, -122]],
      [[10, -70], [-6, -52], [-22, -46], [-36, -58], [-28, -70], [-12, -78]],
      [[36, -8], [44, 6], [56, 22], [62, 50], [52, 74], [40, 62], [36, 30], [30, 8]],
      [[-8, 18], [-20, 26], [-32, 20], [-26, 8], [-12, 6]],
    ];
    const P3 = (lat, lon) => {
      const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
      return [
        GC[0] + rs * 1.006 * Math.cos(la) * Math.cos(lo),
        GC[1] + rs * 1.006 * Math.sin(la),
        GC[2] + rs * 1.006 * Math.cos(la) * Math.sin(lo),
      ];
    };
    for (const cont of conts) {
      sb.polyline(cont.map(([la, lo]) => P3(la, lo)), sty('none', 'inkMid', 0.85), true);
    }
  }());

  let gSpin = 0, gVel = 0, gDragging = false, gDragDist = 0, gHover = 0, gHoverT = 0, gClick = null;
  let gDragEvt = null;
  const onGlobeDrag = (e, c) => {
    if (!e || !e.phase) return;
    if (e === gDragEvt) return;
    gDragEvt = e;
    if (e.phase === 'start') {
      gDragging = true; gDragDist = 0; gClick = null; gVel = 0;
      sfx(c, 'globe');
    } else if (e.phase === 'move') {
      const d = e.dx * 0.011;
      gSpin += d;
      gVel = d * 60;
      gDragDist += Math.abs(e.dx);
    } else if (e.phase === 'end') {
      gDragging = false;
      gVel = clamp(gVel, -8, 8);
    }
  };
  gPart.onDrag(onGlobeDrag);
  globe.onDrag(onGlobeDrag);
  gPart.onHover((isHover) => { gHoverT = isHover ? 1 : 0; });
  gPart.onClick((c) => {
    if (gDragDist > 6) { gDragDist = 0; return; }
    gVel = 0;
    gClick = { t: 0, dur: 2.0, from: gSpin, total: 2.3 };
    sfx(c, 'globe');
  });

  globe.onUpdate((dt, now, c) => {
    if (gClick) {
      gClick.t = Math.min(1, gClick.t + dt / gClick.dur);
      gSpin = gClick.from + gClick.total * ease.expoOut(gClick.t);
      if (gClick.t >= 1) gClick = null;
    } else if (!gDragging) {
      gSpin += gVel * dt;
      gVel *= Math.exp(-0.55 * dt);          // friction decay
      if (Math.abs(gVel) < 0.0015) gVel = 0;
    }
    pivot(sphereNode, GC, 0, gSpin, GTILT);
    gHover = damp(gHover, gHoverT, 10, dt);
    ringStyle.stroke = gHover > 0.4 ? 'ink' : 'inkSoft';
    ringStyle.width = MAIN + gHover * 0.5;
  });

  /* =============================================================== BOOKS */
  const books = mkObj(ctx, { id: 'books', label: '书' });
  const BOOKX = -2.10, BOOKZ = -2.00;
  const stack = [
    { t: 0.052, w: 0.30, d: 0.23, rot: 0.06, fill: F2 },
    { t: 0.034, w: 0.28, d: 0.21, rot: -0.10, fill: F1 },
    { t: 0.044, w: 0.30, d: 0.22, rot: 0.14, fill: F1 },
    { t: 0.028, w: 0.26, d: 0.19, rot: -0.05, fill: P },
  ];
  const bookParts = [];

  function bookGeo(b, y0, t, w, d, rot, fillTok) {
    const co = Math.cos(rot), si = Math.sin(rot);
    const pt = (u, v, y) => [BOOKX + u * co - v * si, y, BOOKZ + u * si + v * co];
    const cover = sty(fillTok, 'ink', OUT);
    b.quad(pt(-w / 2, -d / 2, y0 + t), pt(w / 2, -d / 2, y0 + t), pt(w / 2, d / 2, y0 + t), pt(-w / 2, d / 2, y0 + t), cover);
    b.quad(pt(-w / 2, d / 2, y0 + t - 0.006), pt(w / 2, d / 2, y0 + t - 0.006), pt(w / 2, -d / 2, y0 + t - 0.006),
      pt(-w / 2, -d / 2, y0 + t - 0.006), sty(F3, 'inkSoft', DET));
    b.quad(pt(-w / 2, -d / 2, y0), pt(-w / 2, -d / 2, y0 + t), pt(w / 2, -d / 2, y0 + t), pt(w / 2, -d / 2, y0), cover);
    b.quad(pt(-w / 2, d / 2, y0), pt(w / 2, d / 2, y0), pt(w / 2, d / 2, y0 + t), pt(-w / 2, d / 2, y0 + t),
      sty(P, 'inkSoft', DET));
    b.quad(pt(-w / 2, -d / 2, y0), pt(-w / 2, d / 2, y0), pt(-w / 2, d / 2, y0 + t), pt(-w / 2, -d / 2, y0 + t), cover);
    for (let i = 1; i <= 2; i++) {
      const u = -w / 2 + (w * i) / 3;
      b.line(pt(u, d / 2 + 0.001, y0 + 0.004), pt(u, d / 2 + 0.001, y0 + t - 0.004), sty('none', 'inkSoft', 0.6));
    }
    b.line(pt(-w / 2 + 0.02, -d / 2 - 0.001, y0 + 0.006), pt(-w / 2 + 0.02, -d / 2 - 0.001, y0 + t - 0.006),
      sty('none', 'inkSoft', DET));
    b.line(pt(-w / 2 + 0.03, -d / 2 - 0.001, y0 + t * 0.5), pt(w / 2 - 0.03, -d / 2 - 0.001, y0 + t * 0.5),
      sty('none', 'inkSoft', 0.6));
  }

  let by = DTY;
  for (let i = 0; i < stack.length; i++) {
    const bk = stack[i];
    if (i < stack.length - 2) {
      bookGeo(books.builder, by, bk.t, bk.w, bk.d, bk.rot, bk.fill);
    } else {
      const part = books.part('book-' + (i === stack.length - 2 ? 'a' : 'b'), { label: '书', hint: '抽出/推回' });
      part.setAnchor(BOOKX, by + bk.t, BOOKZ);
      const holder = part.node('body');
      bookGeo(holder.builder, by, bk.t, bk.w, bk.d, bk.rot, bk.fill);
      bookParts.push({ part, holder, y0: by, open: false, v: 0, hover: 0, hoverT: 0 });
    }
    by += bk.t;
  }
  for (const bp of bookParts) {
    bp.part.onHover((isHover) => { bp.hoverT = isHover ? 1 : 0; });
    bp.part.onClick((c) => {
      bp.open = !bp.open;
      sfx(c, 'page');
    });
  }
  books.onUpdate((dt, now, c) => {
    for (const bp of bookParts) {
      bp.v = damp(bp.v, bp.open ? 1 : 0, 7, dt);
      bp.hover = damp(bp.hover, bp.hoverT, 12, dt);
      pivot(bp.holder, [BOOKX, bp.y0, BOOKZ], 0, 0, -bp.v * 0.105);
      const out = bp.v * 0.16 + bp.hover * 0.006;
      bp.holder.setPos(bp.holder.pos[0] + out, bp.holder.pos[1] + bp.hover * 0.003, bp.holder.pos[2]);
    }
  });

  /* ============================================================= PEN CUP */
  const cup = mkObj(ctx, { id: 'pen-cup', label: '笔筒' });
  const cupPart = cup.part('pen-cup', { label: '笔筒', hint: '晃动' });
  const UX = -1.42, UZ = -1.90;
  cupPart.setAnchor(UX, DTY + 0.08, UZ);
  const pens = [];

  (function cupGeo() {
    const b = cupPart.builder;
    // slightly tapered cup (rTop > radius)
    b.cylinder(UX, DTY + 0.054, UZ, 0.040, 0.104, sty(F1, 'ink', OUT),
      { segments: 10, rTop: 0.042, capTop: false });
    bead(b, [0, 1, 0], [UX, DTY, UZ], 0.100, 0.040, 0.045, sty(F2, 'ink', MAIN), 8);
    b.line([UX - 0.038, DTY + 0.030, UZ], [UX + 0.038, DTY + 0.030, UZ], sty('none', 'inkSoft', DET));
    b.line([UX - 0.041, DTY + 0.072, UZ], [UX + 0.041, DTY + 0.072, UZ], sty('none', 'inkSoft', DET));

    const defs = [
      { tilt: 0.20, az: 0.35, len: 0.20, r: 0.0055, ferrule: false, clip: true },
      { tilt: 0.30, az: 2.10, len: 0.17, r: 0.0050, ferrule: true, clip: false },
      { tilt: 0.12, az: 3.60, len: 0.23, r: 0.0060, ferrule: false, clip: false },
      { tilt: 0.34, az: 4.80, len: 0.145, r: 0.0052, ferrule: false, clip: true },
      { tilt: 0.24, az: 5.70, len: 0.19, r: 0.0072, ferrule: true, clip: false },
    ];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const dir = [Math.sin(d.tilt) * Math.cos(d.az), Math.cos(d.tilt), Math.sin(d.tilt) * Math.sin(d.az)];
      const p0 = [UX + dir[0] * 0.006, DTY + 0.055, UZ + dir[2] * 0.006];
      const node = cupPart.node('pen' + i);
      const pb = node.builder;
      lathe(pb, dir, p0, [[d.r, 0], [d.r, d.len]], sty(d.ferrule ? F2 : P, 'ink', MAIN), { seg: 6 });
      lathe(pb, dir, [p0[0] + dir[0] * d.len, p0[1] + dir[1] * d.len, p0[2] + dir[2] * d.len],
        [[d.r * 0.75, 0], [0.0, 0.018]], sty(F2, 'ink', DET), { seg: 6, capStart: false });
      if (d.ferrule) {
        lathe(pb, dir, [p0[0] + dir[0] * d.len * 0.3, p0[1] + dir[1] * d.len * 0.3, p0[2] + dir[2] * d.len * 0.3],
          [[d.r * 1.5, 0], [d.r * 1.5, d.len * 0.16]], sty(F2, 'ink', MAIN), { seg: 6, capEnd: false });
      }
      if (d.clip) {
        const cl = [p0[0] + dir[0] * d.len * 0.86, p0[1] + dir[1] * d.len * 0.86, p0[2] + dir[2] * d.len * 0.86];
        pb.line(cl, [cl[0] + 0.014, cl[1] - 0.020, cl[2] + 0.006], sty('none', 'ink', DET));
      }
      pens.push({ node, c: p0, spring: new Spring(0, 46 - i * 4, 3.4) });
    }
  }());

  let cupHover = 0, cupHoverT = 0;
  cupPart.onHover((isHover) => {
    cupHoverT = isHover ? 1 : 0;
    if (isHover) for (const p of pens) p.spring.impulse((rng() - 0.5) * 1.4);
  });
  cupPart.onClick((c) => {
    for (let i = 0; i < pens.length; i++) pens[i].spring.impulse((rng() - 0.5) * 7.5);
    sfx(c, 'penClick');
  });
  cup.onUpdate((dt, now, c) => {
    cupHover = damp(cupHover, cupHoverT, 12, dt);
    cupPart.setPos(0, cupHover * 0.002, 0);
    for (const p of pens) {
      p.spring.step(dt);
      const a = p.spring.value * 0.12;
      pivot(p.node, p.c, a * 0.8, 0, a);
    }
  });
}
