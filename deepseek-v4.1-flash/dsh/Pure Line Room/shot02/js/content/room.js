/* ===========================================================================
 * Pure Line Room — js/content/room.js                                owner: room
 * ---------------------------------------------------------------------------
 * The room shell and everything fixed to the walls:
 *   floor + boards + AO, four walls, baseboards, ceiling line-work,
 *   window (opening, lining, sill, glass, outside view), venetian blinds,
 *   curtains, door (+architrave, leaf, lever, hinges), wall clock, wall art,
 *   light switch, socket, wall shelf with two objects, floor lamp,
 *   coat hooks + a hanging coat, and the triptych on the front wall.
 *
 * Coordinate notes
 *   Y up, metres. Room box  x[-3.2,3.2]  z[-2.6,2.6]  y[0,2.9].
 *   x=-3.2 left wall, x=+3.2 right wall, z=-2.6 back wall, z=+2.6 front wall.
 *   Every shell face uses cull:'back' with the winding of CONTRACT §10.1 so
 *   the near walls vanish and we can look straight into the room.
 *
 * Culling discipline (important)
 *   The painter's sorter draws near things last and only honours `cull` for
 *   polygons. Anything living on a wall that is culled by default (front wall,
 *   right wall) is therefore built as flat, inward-facing polygons so it
 *   disappears together with its wall instead of floating over the room.
 *   Back-wall / left-wall content is free to be real 3D because those walls
 *   are visible from the default camera.
 *   `cull` is only ever applied to builders whose winding is known:
 *   b.box (outward), quadN/polyN/ribbon/flatPoly (forced) — never to the
 *   builder's cylinder/disc/ring, whose faces wind inward by construction.
 * ========================================================================= */

import { Spring } from '../core/anim.js';

/* ------------------------------------------------------------------ maths */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const smooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------- geometry helpers */

/** Quad whose winding is forced so its normal points along `n`. */
function quadN(b, p, n, style) {
  const c = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  if (dot(c, n) < 0) b.quad(p[3], p[2], p[1], p[0], style);
  else b.quad(p[0], p[1], p[2], p[3], style);
}

/** Polygon whose winding is forced so its normal points along `n`. */
function polyN(b, p, n, style) {
  const c = cross(sub(p[1], p[0]), sub(p[2], p[0]));
  if (dot(c, n) < 0) b.poly(p.slice().reverse(), style);
  else b.poly(p, style);
}

/**
 * A "line" that is still a polygon: a thin ribbon inside the plane whose
 * normal is `n`. Needed for detail strokes on faces that must stay
 * back-face culled (a 2-point polyline can never be culled by the renderer).
 */
function ribbon(b, pts, n, w, style) {
  const h = w * 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const d = sub(c, a);
    const L = Math.hypot(d[0], d[1], d[2]);
    if (L < 1e-7) continue;
    const e = mul(cross(n, mul(d, 1 / L)), h);
    quadN(b, [sub(a, e), sub(c, e), add(c, e), add(a, e)], n, style);
  }
}

/** Flat polygon in a wall plane (kept as a polygon so culling applies). */
function flatPoly(b, pts, n, style) {
  polyN(b, pts, n, style);
}

/** Invisible polygon: shows up in the id/pick buffer only. */
function pickProxy(b, p0, p1, p2, p3, n) {
  const st = { fill: 'none', stroke: 'none' };
  quadN(b, [p0, p1, p2, p3], n, st);
}

/* ---------------------------------------------------------- shell helpers */

/** Wall descriptor: inward normal, point helper p(u,y), u range, hatch angle. */
function wallDef(kind) {
  switch (kind) {
    case 'back':
      return { n: [0, 0, 1], p: (u, y) => [u, y, -2.6], u0: -3.2, u1: 3.2, ang: 14 };
    case 'front':
      return { n: [0, 0, -1], p: (u, y) => [u, y, 2.6], u0: -3.2, u1: 3.2, ang: 14 };
    case 'left':
      return { n: [1, 0, 0], p: (u, y) => [-3.2, y, u], u0: -2.6, u1: 2.6, ang: -27 };
    default:
      return { n: [-1, 0, 0], p: (u, y) => [3.2, y, u], u0: -2.6, u1: 2.6, ang: -27 };
  }
}

/** Quad on a wall, pushed `off` along the inward normal. */
function wallQuad(b, w, uA, uB, y0, y1, off, style) {
  const P = (u, y) => {
    const q = w.p(u, y);
    return [q[0] + w.n[0] * off, q[1] + w.n[1] * off, q[2] + w.n[2] * off];
  };
  quadN(b, [P(uA, y0), P(uB, y0), P(uB, y1), P(uA, y1)], w.n, style);
}

/* -------------------------------------------------------------- constants */

const RX0 = -3.2, RX1 = 3.2, RZ0 = -2.6, RZ1 = 2.6, RY1 = 2.9;
const WT = 0.16;
const LXO = RX0 - WT;                                   // -3.36

const WX0 = -2.62, WX1 = -0.62, WY0 = 0.95, WY1 = 2.28; // window opening
const WZO = RZ0 - WT;                                   // -2.76
const WZG = -2.705;                                     // glass plane

const DZ0 = 1.02, DZ1 = 1.98, DY1 = 2.06;               // door opening

const BACK = [0, 0, 1];
const FRONT = [0, 0, -1];
const LEFT = [1, 0, 0];
const RIGHT = [-1, 0, 0];
const UP = [0, 1, 0];
const DOWN = [0, -1, 0];

/* ========================================================================= */

export default function build(ctx) {
  const scene = ctx.scene;
  const state = ctx.state;
  const audio = ctx.audio;
  const sfx = (name, o) => { try { audio.sfx(name, o); } catch (e) { /* silent */ } };
  // ctx.object() and ctx.scene.object() are equivalent; accept either.
  const newObj = (o) => (typeof ctx.object === 'function' ? ctx.object(o) : scene.object(o));

  /**
   * Anything fixed to a wall only exists while that wall is on the camera's
   * side — the same test the renderer's back-face cull uses on the wall
   * itself. Without this, wall furniture keeps floating once its wall has
   * been culled away (right/front/back wall, depending on the orbit angle).
   */
  function wallGate(obj, axis, limit, sign) {
    const cam = ctx.camera;
    if (!cam || !cam.eye) return;
    const v = cam.eye[axis];
    obj.visible = sign > 0 ? v > limit : v < limit;
  }

  /* =======================================================================
   * 1. SHELL — floor, walls (two openings), ceiling line-work, baseboards
   * ===================================================================== */
  const P = scene.paper();

  const shellBack = { fill: 'paper', stroke: 'inkSoft', width: 1.25, cull: 'back' };
  const shellSide = { fill: 'face1', stroke: 'inkSoft', width: 1.25, cull: 'back' };

  /* the five shell faces, winding per CONTRACT §10.1 */
  // floor  (normal +y)
  P.quad([RX0, 0, RZ1], [RX1, 0, RZ1], [RX1, 0, RZ0], [RX0, 0, RZ0],
    { fill: 'paper', stroke: 'inkSoft', width: 1.5, cull: 'back' });
  // back wall, split around the window  (normal +z)
  P.quad([RX0, 0, RZ0], [RX1, 0, RZ0], [RX1, WY0, RZ0], [RX0, WY0, RZ0], shellBack);
  P.quad([RX0, WY1, RZ0], [RX1, WY1, RZ0], [RX1, RY1, RZ0], [RX0, RY1, RZ0], shellBack);
  P.quad([RX0, WY0, RZ0], [WX0, WY0, RZ0], [WX0, WY1, RZ0], [RX0, WY1, RZ0], shellBack);
  P.quad([WX1, WY0, RZ0], [RX1, WY0, RZ0], [RX1, WY1, RZ0], [WX1, WY1, RZ0], shellBack);
  // left wall, split around the door  (normal +x)
  P.quad([RX0, 0, DZ0], [RX0, 0, RZ0], [RX0, RY1, RZ0], [RX0, RY1, DZ0], shellSide);
  P.quad([RX0, 0, RZ1], [RX0, 0, DZ1], [RX0, RY1, DZ1], [RX0, RY1, RZ1], shellSide);
  P.quad([RX0, DY1, DZ1], [RX0, DY1, DZ0], [RX0, RY1, DZ0], [RX0, RY1, DZ1], shellSide);
  // right wall  (normal -x)
  P.quad([RX1, 0, RZ0], [RX1, 0, RZ1], [RX1, RY1, RZ1], [RX1, RY1, RZ0], shellSide);
  // front wall  (normal -z)
  P.quad([RX1, 0, RZ1], [RX0, 0, RZ1], [RX0, RY1, RZ1], [RX1, RY1, RZ1], shellBack);

  /* wall thickness shown at the window opening */
  const rev = { fill: 'face1', stroke: 'inkSoft', width: 1.0, cull: 'back' };
  quadN(P, [[WX0, WY0, RZ0], [WX0, WY0, WZO], [WX0, WY1, WZO], [WX0, WY1, RZ0]], LEFT, rev);
  quadN(P, [[WX1, WY0, WZO], [WX1, WY0, RZ0], [WX1, WY1, RZ0], [WX1, WY1, WZO]], RIGHT, rev);
  quadN(P, [[WX0, WY1, WZO], [WX1, WY1, WZO], [WX1, WY1, RZ0], [WX0, WY1, RZ0]], DOWN, rev);
  quadN(P, [[WX0, WY0, RZ0], [WX1, WY0, RZ0], [WX1, WY0, WZO], [WX0, WY0, WZO]], UP, rev);

  /* wall thickness shown at the door opening */
  quadN(P, [[LXO, 0, DZ0], [RX0, 0, DZ0], [RX0, DY1, DZ0], [LXO, DY1, DZ0]], BACK, rev);
  quadN(P, [[RX0, 0, DZ1], [LXO, 0, DZ1], [LXO, DY1, DZ1], [RX0, DY1, DZ1]], FRONT, rev);
  quadN(P, [[LXO, DY1, DZ0], [LXO, DY1, DZ1], [RX0, DY1, DZ1], [RX0, DY1, DZ0]], DOWN, rev);
  quadN(P, [[LXO, 0, DZ1], [LXO, 0, DZ0], [RX0, 0, DZ0], [RX0, 0, DZ1]], UP,
    { fill: 'face2', stroke: 'inkSoft', width: 1.0, cull: 'back' });

  /* ceiling: line work only, never a filled solid */
  const ceil = { fill: 'none', stroke: 'inkSoft', width: 0.7, cull: 'back' };
  quadN(P, [[RX0, RY1, RZ0], [RX1, RY1, RZ0], [RX1, RY1, RZ0 + 0.14], [RX0, RY1, RZ0 + 0.14]], DOWN, ceil);
  quadN(P, [[RX0, RY1, RZ1 - 0.14], [RX1, RY1, RZ1 - 0.14], [RX1, RY1, RZ1], [RX0, RY1, RZ1]], DOWN, ceil);
  quadN(P, [[RX0, RY1, RZ0], [RX0, RY1, RZ1], [RX0 + 0.14, RY1, RZ1], [RX0 + 0.14, RY1, RZ0]], DOWN, ceil);
  quadN(P, [[RX1 - 0.14, RY1, RZ0], [RX1 - 0.14, RY1, RZ1], [RX1, RY1, RZ1], [RX1, RY1, RZ0]], DOWN, ceil);
  for (let i = 1; i <= 5; i++) {
    const x = -3.2 + (6.4 * i) / 6;
    quadN(P, [[x - 0.025, RY1, RZ0], [x + 0.025, RY1, RZ0], [x + 0.025, RY1, RZ1], [x - 0.025, RY1, RZ1]], DOWN, ceil);
  }

  /* floor boards + fake ambient occlusion */
  const seam = { stroke: 'inkSoft', width: 0.5, alpha: 0.42 };
  for (let x = -2.78; x < 3.19; x += 0.42) {
    P.polyline([[x, 0.003, RZ0 + 0.02], [x, 0.003, RZ1 - 0.02]], seam);
  }
  for (const [x, z] of [[-2.78, -1.15], [-1.52, 0.35], [-0.26, -0.9], [1.0, 1.4], [2.26, -0.2], [1.42, -2.0], [-1.94, 1.9]]) {
    P.polyline([[x, 0.003, z], [x + 0.42, 0.003, z]], seam);
  }
  for (const band of [
    { z0: -2.6, z1: -2.05, gap: 5.5, a: 0.30, ang: 14 },
    { z0: -2.05, z1: -1.62, gap: 9, a: 0.20, ang: 14 },
    { z0: -1.62, z1: -1.05, gap: 14, a: 0.12, ang: 14 },
  ]) {
    quadN(P, [[RX0, 0.004, band.z0], [RX1, 0.004, band.z0], [RX1, 0.004, band.z1], [RX0, 0.004, band.z1]], UP,
      { fill: 'none', cull: 'back', hatch: { gap: band.gap, angle: band.ang, width: 0.6, stroke: 'inkSoft', alpha: band.a } });
  }
  for (const band of [
    { x0: -3.2, x1: -2.72, gap: 5.5, a: 0.26 },
    { x0: -2.72, x1: -2.30, gap: 10, a: 0.16 },
  ]) {
    quadN(P, [[band.x0, 0.004, RZ0], [band.x1, 0.004, RZ0], [band.x1, 0.004, RZ1], [band.x0, 0.004, RZ1]], UP,
      { fill: 'none', cull: 'back', hatch: { gap: band.gap, angle: -27, width: 0.6, stroke: 'inkSoft', alpha: band.a } });
  }

  /* baseboards (踢脚线) */
  const BB_H = 0.088, BB_O = 0.022;
  const bbFace = { fill: 'face1', stroke: 'inkSoft', width: 1.0, cull: 'back' };
  const bbTop = { fill: 'face2', stroke: 'inkSoft', width: 0.7, cull: 'back' };
  const bbShadow = { fill: 'none', cull: 'back', hatch: { gap: 4.5, angle: 0, width: 0.55, stroke: 'inkSoft', alpha: 0.22 } };

  function baseboard(kind, a, c) {
    const w = wallDef(kind);
    wallQuad(P, w, a, c, 0, BB_H, BB_O, bbFace);
    wallQuad(P, w, a, c, BB_H, BB_H + 0.012, BB_O * 0.5, bbTop);
    wallQuad(P, w, a, c, BB_H + 0.012, BB_H + 0.014, 0, bbTop);
    if (kind === 'back' || kind === 'front') {
      const z = kind === 'back' ? RZ0 : RZ1;
      const zz = z + (kind === 'back' ? 0.03 : -0.03);
      quadN(P, [[a, 0.0015, z], [c, 0.0015, z], [c, 0.0015, zz], [a, 0.0015, zz]], UP, bbShadow);
    } else {
      const x = kind === 'left' ? RX0 : RX1;
      const xx = x + (kind === 'left' ? 0.03 : -0.03);
      quadN(P, [[x, 0.0015, a], [xx, 0.0015, a], [xx, 0.0015, c], [x, 0.0015, c]], UP, bbShadow);
    }
  }
  baseboard('back', RX0, RX1);
  baseboard('front', RX0, RX1);
  baseboard('right', RZ0, RZ1);
  baseboard('left', RZ0, DZ0);
  baseboard('left', DZ1, RZ1);

  /* wall shading bands + a few faint plaster strokes */
  function wallBands(kind) {
    const w = wallDef(kind);
    for (const band of [
      { y0: 0.10, y1: 0.46, gap: 8, a: 0.14 },
      { y0: 2.46, y1: 2.9, gap: 7, a: 0.17 },
      { y0: BB_H + 0.016, y1: BB_H + 0.13, gap: 5, a: 0.16 },
    ]) {
      wallQuad(P, w, w.u0, w.u1, band.y0, band.y1, 0.006,
        { fill: 'none', cull: 'back', hatch: { gap: band.gap, angle: w.ang, width: 0.55, stroke: 'inkSoft', alpha: band.a } });
    }
  }
  wallBands('back');
  wallBands('left');
  wallBands('right');
  wallBands('front');

  const plaster = { stroke: 'inkSoft', width: 0.45, alpha: 0.20 };
  for (let i = 0; i < 6; i++) {
    const x = -2.85 + i * 1.12;
    const pts = [];
    for (let k = 0; k <= 5; k++) pts.push([x + Math.sin(i * 2.1 + k * 1.3) * 0.035, 0.16 + k * 0.52, RZ0 + 0.004]);
    P.polyline(pts, plaster);
  }
  for (let i = 0; i < 6; i++) {
    const z = -2.3 + i * 0.92;
    const pts = [];
    for (let k = 0; k <= 5; k++) pts.push([RX0 + 0.004, 0.16 + k * 0.52, z + Math.sin(i * 1.7 + k * 1.1) * 0.035]);
    P.polyline(pts, plaster);
  }
  P.polyline([[-3.0, 2.34, RZ0 + 0.004], [-1.4, 2.37, RZ0 + 0.004], [0.2, 2.33, RZ0 + 0.004],
    [1.8, 2.36, RZ0 + 0.004], [3.0, 2.34, RZ0 + 0.004]], plaster);
  P.polyline([[RX0 + 0.004, 2.34, -2.4], [RX0 + 0.004, 2.36, -0.9], [RX0 + 0.004, 2.33, 0.6],
    [RX0 + 0.004, 2.35, 2.0]], plaster);

  /* =======================================================================
   * 2. THE VIEW OUTSIDE — one flat, inward-culled picture plane that sits
   *    just behind the glass and stays inside the room's silhouette, so it
   *    can only ever be seen through the window opening (never above the
   *    ceiling line or past the wall edges).
   * ===================================================================== */
  const VIEW_Z = -2.92;
  const VX0 = -3.28, VX1 = -0.22, VHOR = 1.06, VTOP = 2.68;
  const view = newObj({ id: 'window-view', label: '窗外', cursor: 'default' });
  // Sort key is (depth - bias), drawn far -> near, so a NEGATIVE bias pushes the
  // backdrop further away and keeps it behind every wall from any camera angle.
  // (The plane also sits 0.32 m behind the glass, so it is depth-correct anyway.)
  view.depthBias = -30;
  const vb = view.builder;
  const V = (x, y) => [x, y, VIEW_Z];

  const dayTop = [222, 235, 245], nightTop = [10, 14, 28];
  const dayLow = [240, 243, 240], nightLow = [24, 31, 50];
  const dayGround = [230, 226, 210], nightGround = [26, 30, 40];
  const dayHill = [209, 213, 211], nightHill = [30, 36, 50];
  const dayLine = [138, 148, 158], nightLine = [78, 90, 116];

  const cTop = dayTop.slice();
  const cLow = dayLow.slice();
  const cGround = dayGround.slice();
  const cHill = dayHill.slice();
  const cLine = dayLine.slice();

  const skyTopSt = { fill: cTop, cull: 'back' };
  const skyLowSt = { fill: cLow, cull: 'back' };
  const groundSt = { fill: cGround, cull: 'back' };
  const hillSt = { fill: cHill, stroke: cLine, width: 0.7, cull: 'back' };
  const vLineSt = { stroke: cLine, width: 0.7, cull: 'back' };
  const sunSt = { fill: [232, 186, 108], stroke: [206, 158, 76], width: 0.8, cull: 'back', alpha: 1 };
  const moonSt = { fill: [236, 238, 232], cull: 'back', alpha: 0 };
  const starSt = { stroke: [230, 232, 226], width: 0.7, cull: 'back', alpha: 0 };
  const cloudSt = { stroke: cLine, width: 0.8, cull: 'back', alpha: 1 };

  quadN(vb, [V(VX0, VHOR), V(VX1, VHOR), V(VX1, VTOP), V(VX0, VTOP)], BACK, skyTopSt);
  quadN(vb, [V(VX0, VHOR - 0.86), V(VX1, VHOR - 0.86), V(VX1, VHOR), V(VX0, VHOR)], BACK, skyLowSt);
  quadN(vb, [V(VX0, VHOR - 1.05), V(VX1, VHOR - 1.05), V(VX1, VHOR - 0.86), V(VX0, VHOR - 0.86)], BACK, groundSt);
  ribbon(vb, [V(VX0, VHOR), V(-2.4, VHOR), V(-1.2, VHOR), V(VX1, VHOR)], BACK, 0.012, vLineSt);
  // stylised hills
  flatPoly(vb, [V(VX0, VHOR), V(-2.80, 1.60), V(-2.42, 1.30), V(-1.90, 1.78), V(-1.20, VHOR)], BACK, hillSt);
  flatPoly(vb, [V(-1.55, VHOR), V(-1.12, 1.40), V(-0.78, 1.20), V(-0.42, 1.44), V(VX1, VHOR)], BACK, hillSt);
  // a small tree
  ribbon(vb, [V(-2.58, VHOR), V(-2.55, 1.32)], BACK, 0.034, vLineSt);
  ribbon(vb, [V(-2.55, 1.28), V(-2.68, 1.40)], BACK, 0.019, vLineSt);
  ribbon(vb, [V(-2.55, 1.32), V(-2.42, 1.43)], BACK, 0.019, vLineSt);
  flatPoly(vb, [V(-2.78, 1.36), V(-2.55, 1.64), V(-2.32, 1.42), V(-2.50, 1.28), V(-2.72, 1.38)], BACK, vLineSt);
  // clouds
  for (const [cx, cy, s] of [[-2.80, 1.80, 0.80], [-1.95, 1.98, 0.70], [-1.00, 1.74, 0.75], [-0.55, 1.96, 0.62]]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(V(cx - 0.42 * s + t * 0.84 * s,
        cy + Math.sin(t * Math.PI * 2) * 0.05 * s + Math.sin(t * Math.PI) * 0.055 * s));
    }
    ribbon(vb, pts, BACK, 0.014, cloudSt);
    ribbon(vb, [V(cx - 0.3 * s, cy - 0.045 * s), V(cx + 0.3 * s, cy - 0.045 * s)], BACK, 0.011, cloudSt);
  }
  // stars
  for (let i = 0; i < 22; i++) {
    const x = VX0 + 0.14 + (((i * 137) % 100) / 100) * (VX1 - VX0 - 0.28);
    const y = 1.30 + (((i * 71) % 100) / 100) * 0.90;
    const r = 0.016 + (((i * 29) % 10) / 10) * 0.014;
    flatPoly(vb, [V(x, y - r), V(x + r * 0.42, y), V(x, y + r), V(x - r * 0.42, y)], BACK, starSt);
  }
  // sun + rays (day)
  const sunPts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    sunPts.push(V(-1.58 + Math.cos(a) * 0.115, 1.80 + Math.sin(a) * 0.115));
  }
  flatPoly(vb, sunPts, BACK, sunSt);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.2;
    ribbon(vb, [V(-1.58 + Math.cos(a) * 0.155, 1.80 + Math.sin(a) * 0.155),
      V(-1.58 + Math.cos(a) * 0.215, 1.80 + Math.sin(a) * 0.215)], BACK, 0.013, vLineSt);
  }
  // crescent moon (night)
  const moonPts = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI * 0.62 + (i / 16) * Math.PI * 1.24;
    moonPts.push(V(-1.58 + Math.cos(a) * 0.120, 1.80 + Math.sin(a) * 0.120));
  }
  for (let i = 16; i >= 0; i--) {
    const a = -Math.PI * 0.62 + (i / 16) * Math.PI * 1.24;
    moonPts.push(V(-1.508 + Math.cos(a) * 0.111, 1.80 + Math.sin(a) * 0.111));
  }
  flatPoly(vb, moonPts, BACK, moonSt);

  view.onUpdate(() => {
    wallGate(view, 2, RZ0, 1);
    const t = clamp(ctx.nightT || 0, 0, 1);
    const mixInto = (dst, day, night) => {
      for (let i = 0; i < 3; i++) dst[i] = Math.round(lerp(day[i], night[i], t));
    };
    mixInto(cTop, dayTop, nightTop);
    mixInto(cLow, dayLow, nightLow);
    mixInto(cGround, dayGround, nightGround);
    mixInto(cHill, dayHill, nightHill);
    mixInto(cLine, dayLine, nightLine);
    sunSt.alpha = 1 - t;
    moonSt.alpha = t;
    starSt.alpha = t * 0.95;
    cloudSt.alpha = 1 - t * 0.72;
  });

  /* =======================================================================
   * 3. WINDOW — lining, muntins, sill with a bullnose, apron, glass
   * ===================================================================== */
  const win = newObj({ id: 'window', label: '窗', cursor: 'default' });
  const wb = win.builder;
  const frameSt = { fill: 'face1', stroke: 'ink', width: 1.1 };
  const frameIn = { fill: 'face2', stroke: 'inkSoft', width: 0.8 };
  const PT = 0.042;
  const LIN0 = WX0 - PT, LIN1 = WX1 + PT, LIY0 = WY0 - PT, LIY1 = WY1 + PT;
  const LZ0 = WZO + 0.012, LZ1 = RZ0 - 0.002;
  // lining ring (four strips, never a solid slab)
  wb.box([LIN0, LIY0, LZ0], [WX0, LIY1, LZ1], frameSt);
  wb.box([WX1, LIY0, LZ0], [LIN1, LIY1, LZ1], frameSt);
  wb.box([WX0, WY1 - 0.05, LZ0], [WX1, LIY1, LZ1], frameSt);
  wb.box([WX0, LIY0, LZ0], [WX1, WY0, LZ1], frameSt);
  wb.polyline([[WX0, WY0, RZ0 - 0.006], [WX0, WY1, RZ0 - 0.006]], { stroke: 'inkSoft', width: 0.6 });
  wb.polyline([[WX1, WY0, RZ0 - 0.006], [WX1, WY1, RZ0 - 0.006]], { stroke: 'inkSoft', width: 0.6 });
  // muntins: one vertical + one horizontal divider, plus glazing beads
  const MX = (WX0 + WX1) / 2, MY = (WY0 + WY1) / 2;
  wb.box([MX - 0.016, WY0, WZG + 0.014], [MX + 0.016, WY1, WZG + 0.034], frameSt);
  wb.box([WX0, MY - 0.014, WZG + 0.014], [WX1, MY + 0.014, WZG + 0.034], frameSt);
  wb.box([WX0, WY0, WZG + 0.008], [WX1, WY0 + 0.016, WZG + 0.032], frameIn);
  wb.box([WX0, WY1 - 0.016, WZG + 0.008], [WX1, WY1, WZG + 0.032], frameIn);
  // sill: top face, bullnose nose, front face
  const SX0 = WX0 - 0.10, SX1 = WX1 + 0.10;
  const sillNz = -2.44;
  const sillSt = { fill: 'face1', stroke: 'ink', width: 1.15 };
  quadN(wb, [[SX0, 0.95, RZ0], [SX1, 0.95, RZ0], [SX1, 0.95, sillNz + 0.014], [SX0, 0.95, sillNz + 0.014]], UP, sillSt);
  quadN(wb, [[SX0, 0.95, sillNz + 0.014], [SX1, 0.95, sillNz + 0.014], [SX1, 0.936, sillNz], [SX0, 0.936, sillNz]],
    unit([0, 0.7, -0.7]), sillSt);
  quadN(wb, [[SX0, 0.936, sillNz], [SX1, 0.936, sillNz], [SX1, 0.90, sillNz], [SX0, 0.90, sillNz]], FRONT, sillSt);
  quadN(wb, [[SX0, 0.90, sillNz], [SX1, 0.90, sillNz], [SX1, 0.90, RZ0], [SX0, 0.90, RZ0]], DOWN,
    { fill: 'face2', stroke: 'inkSoft', width: 0.8 });
  // apron under the sill
  const apronSt = { fill: 'face1', stroke: 'inkSoft', width: 1.0, cull: 'back' };
  quadN(wb, [[WX0 - 0.02, 0.79, RZ0 + 0.024], [WX1 + 0.02, 0.79, RZ0 + 0.024], [WX1 + 0.02, 0.90, RZ0 + 0.024],
    [WX0 - 0.02, 0.90, RZ0 + 0.024]], BACK, apronSt);
  quadN(wb, [[WX0 - 0.02, 0.775, RZ0 + 0.008], [WX1 + 0.02, 0.775, RZ0 + 0.008], [WX1 + 0.02, 0.79, RZ0 + 0.024],
    [WX0 - 0.02, 0.79, RZ0 + 0.024]], unit([0, 0.6, 1]), { fill: 'face2', stroke: 'inkSoft', width: 0.7, cull: 'back' });
  for (let i = 0; i <= 6; i++) {
    const x = WX0 + (i / 6) * (WX1 - WX0);
    wb.polyline([[x, 0.79, RZ0 + 0.026], [x, 0.895, RZ0 + 0.026]], { stroke: 'inkSoft', width: 0.45, alpha: 0.5 });
  }
  for (const sx of [WX0 + 0.06, WX1 - 0.06]) {
    quadN(wb, [[sx - 0.03, 0.90, RZ0], [sx + 0.03, 0.90, RZ0], [sx + 0.02, 0.845, RZ0 + 0.05], [sx - 0.02, 0.845, RZ0 + 0.05]],
      BACK, { fill: 'face1', stroke: 'ink', width: 0.9 });
  }
  // curtain rod above the window + rings
  const rodSt = { fill: 'face1', stroke: 'ink', width: 1.0 };
  wb.cylinder(-1.62, 2.44, -2.44, 0.014, 2.36, rodSt, { axis: 'x', segments: 12, capTop: false, capBottom: false });
  wb.cylinder(-2.80, 2.44, -2.44, 0.022, 0.05, rodSt, { axis: 'x', segments: 12 });
  wb.cylinder(-0.44, 2.44, -2.44, 0.022, 0.05, rodSt, { axis: 'x', segments: 12 });
  wb.cylinder(-2.72, 2.44, -2.44, 0.028, 0.03, rodSt, { axis: 'x', segments: 10 });
  wb.cylinder(-0.52, 2.44, -2.44, 0.028, 0.03, rodSt, { axis: 'x', segments: 10 });
  for (let i = 0; i < 4; i++) {
    wb.cylinder(-2.62 + i * 0.66, 2.44, -2.44, 0.03, 0.02, { fill: 'face2', stroke: 'inkSoft', width: 0.6 }, { axis: 'x', segments: 10 });
  }
  // glass (translucent so the view outside reads through it) + 3 glints
  const glassSt = { fill: 'glass', stroke: 'inkSoft', width: 0.9, alpha: 0.30, cull: 'back' };
  quadN(wb, [[WX0, WY0, WZG], [WX1, WY0, WZG], [WX1, WY1, WZG], [WX0, WY1, WZG]], BACK, glassSt);
  const glint = { stroke: 'inkSoft', width: 0.9, alpha: 0.55 };
  for (const [x0, y0, x1, y1] of [
    [WX0 + 0.16, WY0 + 0.18, WX0 + 0.62, WY1 - 0.22],
    [WX0 + 0.30, WY0 + 0.14, WX0 + 0.76, WY1 - 0.26],
    [MX + 0.22, WY0 + 0.26, MX + 0.58, MY - 0.10],
  ]) {
    wb.polyline([[x0, y0, WZG + 0.006], [x1, y1, WZG + 0.006]], glint);
  }
  // sun patch on the floor, animated by blinds x curtain x day
  const sunHatch = { gap: 7, angle: 14, width: 0.6, stroke: 'inkSoft', alpha: 0 };
  const sunPatchSt = { fill: 'none', cull: 'back', hatch: sunHatch };
  const sunEdgeSt = { stroke: 'inkSoft', width: 0.6, alpha: 0, cull: 'back' };
  const patchPts = [[-2.86, 0.012, -2.28], [-0.44, 0.012, -2.42], [-0.06, 0.012, -0.66], [-2.48, 0.012, -0.52]];
  quadN(wb, patchPts, UP, sunPatchSt);
  quadN(wb, patchPts.map((p) => [p[0], 0.013, p[2]]), UP, sunEdgeSt);

  let sunPatch = 1;
  win.onUpdate((dt) => {
    wallGate(win, 2, RZ0, 1);
    const open = clamp(state.blindsOpen === undefined ? 1 : state.blindsOpen, 0, 1) *
      clamp(state.curtainOpen === undefined ? 1 : state.curtainOpen, 0, 1);
    const k = open * (1 - clamp(ctx.nightT || 0, 0, 1)) * 0.9;
    sunPatch = ctx.damp ? ctx.damp(sunPatch, k, 2.2, dt) : k;
    sunHatch.alpha = sunPatch * 0.36;
    sunEdgeSt.alpha = sunPatch * 0.28;
    if (sunPatch > 0.03 && ctx.light) {
      ctx.light(-1.6, 0.16, -1.5, 2.7, [255, 236, 190], sunPatch * 0.55);
    }
  });

  /* =======================================================================
   * 4. VENETIAN BLINDS — 16 slats on staggered springs
   * ===================================================================== */
  const blinds = newObj({ id: 'blinds', label: '百叶帘', hint: '升降' });
  const bb = blinds.builder;
  const BX0 = WX0 + 0.02, BX1 = WX1 - 0.02;
  const BCX = (BX0 + BX1) / 2;
  const BZ = -2.645;
  const NS = 16;
  const HEAD_Y = 2.24;
  const Y_LOW = 1.02, Y_HIGH = 2.19;
  const Y_PACK0 = 2.03, Y_PACK1 = 2.205;
  const TILT_LOW = 0.34, TILT_HIGH = 1.22;

  bb.box([BX0 - 0.01, HEAD_Y, BZ - 0.035], [BX1 + 0.01, HEAD_Y + 0.062, BZ + 0.035],
    { fill: 'face1', stroke: 'ink', width: 1.15 });
  bb.box([BX0 - 0.01, HEAD_Y + 0.014, BZ + 0.030], [BX1 + 0.01, HEAD_Y + 0.05, BZ + 0.036],
    { fill: 'face2', stroke: 'inkSoft', width: 0.55 });
  bb.box([BX1 - 0.16, HEAD_Y + 0.02, BZ - 0.008], [BX1 - 0.02, HEAD_Y + 0.052, BZ + 0.026],
    { fill: 'face2', stroke: 'ink', width: 0.85 });
  bb.cylinder(BX1 - 0.09, HEAD_Y + 0.032, BZ - 0.010, 0.014, 0.03,
    { fill: 'face1', stroke: 'ink', width: 0.8 }, { axis: 'z', segments: 10 });

  const cordNode = blinds.node('pull-cord');
  cordNode.setPos(BX1 - 0.09, HEAD_Y + 0.02, BZ - 0.012);
  const cordPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    cordPts.push([Math.sin(t * 2.4) * 0.012 - t * 0.02, -t * 1.05, Math.sin(t * 1.7) * 0.01]);
  }
  cordNode.builder.polyline(cordPts, { stroke: 'ink', width: 0.75 });
  cordNode.builder.cylinder(cordPts[10][0], cordPts[10][1] - 0.018, cordPts[10][2], 0.016, 0.038,
    { fill: 'face1', stroke: 'ink', width: 0.8 }, { axis: 'y', segments: 10 });

  const wandNode = blinds.node('tilt-wand');
  wandNode.setPos(BX1 - 0.20, HEAD_Y + 0.02, BZ - 0.042);
  wandNode.builder.cylinder(0, -0.34, 0, 0.008, 0.68, { fill: 'face1', stroke: 'ink', width: 0.8 }, { axis: 'y', segments: 8 });
  wandNode.builder.cylinder(0, -0.70, 0, 0.014, 0.05, { fill: 'face2', stroke: 'ink', width: 0.8 }, { axis: 'y', segments: 10 });

  const ladderNode = blinds.node('ladder');
  ladderNode.setPos(0, HEAD_Y, 0);
  const lb = ladderNode.builder;
  const LAD_N = HEAD_Y - Y_LOW + 0.03;
  for (const lx of [BX0 + 0.38, BX1 - 0.38]) {
    lb.polyline([[lx, 0, BZ - 0.026], [lx, -LAD_N, BZ - 0.026]], { stroke: 'inkSoft', width: 0.7 });
    lb.polyline([[lx + 0.012, 0, BZ + 0.026], [lx + 0.012, -LAD_N, BZ + 0.026]], { stroke: 'inkSoft', width: 0.7 });
  }
  for (let i = 0; i < NS; i++) {
    const y = Y_LOW + (i / (NS - 1)) * (Y_HIGH - Y_LOW) - HEAD_Y;
    for (const lx of [BX0 + 0.38, BX1 - 0.38]) {
      lb.polyline([[lx, y, BZ - 0.026], [lx + 0.012, y, BZ + 0.026]], { stroke: 'inkSoft', width: 0.6 });
    }
  }

  let blindsOpen = clamp(state.blindsOpen === undefined ? 1 : state.blindsOpen, 0, 1);
  const slats = [];
  const rimStyles = [];
  const slatA = { fill: 'face1', stroke: 'inkSoft', width: 0.8 };
  const slatB = { fill: 'paper', stroke: 'inkSoft', width: 0.8 };
  for (let i = 0; i < NS; i++) {
    const n = blinds.node('slat' + i);
    const t = i / (NS - 1);
    const yLow = Y_LOW + t * (Y_HIGH - Y_LOW);
    const yHigh = Y_PACK0 + t * (Y_PACK1 - Y_PACK0);
    n.setPos(BCX, yLow, BZ);
    const st = i % 2 ? slatA : slatB;
    n.builder.box([-(BX1 - BX0) / 2, -0.004, -0.026], [(BX1 - BX0) / 2, 0.004, 0.026], st);
    n.builder.box([-(BX1 - BX0) / 2, -0.004, 0.026], [(BX1 - BX0) / 2, 0.0035, 0.033],
      { fill: 'face2', stroke: 'inkSoft', width: 0.55 });
    n.builder.box([-(BX1 - BX0) / 2, 0.0035, 0.020], [(BX1 - BX0) / 2, 0.0075, 0.026],
      { fill: 'face1', stroke: 'inkSoft', width: 0.45 });
    const rim = { stroke: 'accent', width: 0.9, alpha: 0 };
    rimStyles.push(rim);
    n.builder.polyline([[-(BX1 - BX0) / 2 + 0.02, 0.0085, 0.024], [(BX1 - BX0) / 2 - 0.02, 0.0085, 0.024]], rim);
    slats.push({ node: n, yLow, yHigh, sp: new Spring(blindsOpen, 108, 12.5), delay: 0 });
  }

  const rail = blinds.part('blinds-rail', { label: '百叶帘', hint: '升降' });
  rail.hitPadding = 0.015;
  rail.builder.box([BX0 - 0.005, -0.019, BZ - 0.038], [BX1 + 0.005, 0.019, BZ + 0.038],
    { fill: 'face1', stroke: 'ink', width: 1.2 });
  rail.builder.box([BX0 - 0.005, -0.019, BZ + 0.038], [BX1 + 0.005, 0.008, BZ + 0.044],
    { fill: 'face2', stroke: 'inkSoft', width: 0.55 });
  rail.setPos(0, Y_LOW - 0.03, 0);

  const stack = blinds.part('blinds-stack', { label: '百叶帘', hint: '升降' });
  pickProxy(stack.builder,
    [BX0, WY0 + 0.02, BZ - 0.05], [BX1, WY0 + 0.02, BZ - 0.05],
    [BX1, HEAD_Y - 0.02, BZ - 0.05], [BX0, HEAD_Y - 0.02, BZ - 0.05], BACK);

  let blindsSince = -99;
  let railHover = 0;
  function toggleBlinds() {
    blindsOpen = blindsOpen > 0.5 ? 0 : 1;
    blindsSince = ctx.time || 0;
    for (let i = 0; i < slats.length; i++) {
      slats[i].sp.to(blindsOpen);
      slats[i].delay = i * 0.03;
    }
    sfx('page', { rate: blindsOpen > 0.5 ? 1.15 : 0.85, pan: -0.25 });
  }
  rail.onClick(toggleBlinds);
  stack.onClick(toggleBlinds);
  rail.onHover((h) => { railHover = h ? 1 : 0; });

  blinds.onUpdate((dt, now) => {
    wallGate(blinds, 2, RZ0, 1);
    let lowest = Y_LOW;
    for (let i = 0; i < slats.length; i++) {
      const s = slats[i];
      if (now - blindsSince >= s.delay) s.sp.step(dt);
      const v = s.sp.value;
      const y = lerp(s.yLow, s.yHigh, v);
      const tilt = lerp(TILT_LOW, TILT_HIGH, v);
      const wob = Math.sin(now * 1.9 + i * 0.7) * 0.0011;
      s.node.setPos(BCX, y + wob, BZ);
      s.node.setRot(tilt, 0, Math.sin(now * 1.3 + i) * 0.004);
      if (i === 0) lowest = y;
    }
    rail.setPos(0, lowest - 0.024 - 0.003 * Math.max(rail.hoverT || 0, railHover), 0);
    rail.setRot(0, 0, Math.sin(now * 1.1) * 0.003);
    const span = HEAD_Y - Y_LOW;
    ladderNode.setScale(1, clamp((HEAD_Y - lowest - 0.03) / span, 0.05, 1), 1);
    const cordSway = Math.max(rail.hoverT || 0, railHover);
    cordNode.setRot(0.05 * cordSway + Math.sin(now * 1.4) * 0.03 * cordSway, 0,
      Math.sin(now * 1.7) * 0.02 + 0.06 * cordSway);
    wandNode.setRot(0, 0, lerp(0.02, 0.16, clamp(blindsOpen, 0, 1)) + Math.sin(now * 0.9) * 0.012);
    const rim = clamp(((ctx.nightT || 0) - 0.15) / 0.85, 0, 1) * 0.85;
    for (let i = 0; i < rimStyles.length; i++) rimStyles[i].alpha = rim;
    // the bottom slat's spring IS the openness (1 = raised / stacked open)
    const openNow = clamp(slats[0].sp.value, 0, 1);
    const prev = state.blindsOpen;
    if (prev === undefined || Math.abs(prev - openNow) > 0.002 ||
      ((openNow < 0.002 || openNow > 0.998) && prev !== openNow)) {
      ctx.set('blindsOpen', openNow);
    }
  });

  /* =======================================================================
   * 5. CURTAINS — two panels, nine procedural folds each
   * ===================================================================== */
  const curtain = newObj({ id: 'curtain', label: '窗帘', hint: '开合' });
  const CURT_Z = -2.415;
  const CURT_Y0 = 0.16, CURT_Y1 = 2.40;
  const PANELS = [
    { id: 'curtain-left', x0: -2.76, x1: -1.60, edge: -2.78, folds: 9, side: -1 },
    { id: 'curtain-right', x0: -1.64, x1: -0.48, edge: -0.44, folds: 9, side: 1 },
  ];
  const panels = [];
  for (const def of PANELS) {
    const part = curtain.part(def.id, { label: '窗帘', hint: '开合' });
    const n = def.folds;
    const span = def.x1 - def.x0;
    const verts = [];
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const depth = Math.sin(t * Math.PI * def.folds) * (0.030 + 0.014 * Math.sin(j * 2.3 + def.side));
      verts.push({ x: def.x0 + t * span, z: depth });
    }
    const strips = [];
    for (let j = 0; j < n; j++) {
      const a = verts[j], c = verts[j + 1];
      const xm = (a.x + c.x) * 0.5;
      const hw = (c.x - a.x) * 0.5;
      const node = part.node('fold' + j);
      const st = j % 2 ? { fill: 'face1', stroke: 'inkSoft', width: 0.85 }
        : { fill: 'paper', stroke: 'inkSoft', width: 0.85 };
      node.builder.quad([-hw, CURT_Y0, a.z], [hw, CURT_Y0, c.z], [hw, CURT_Y1, c.z], [-hw, CURT_Y1, a.z], st);
      node.builder.polyline([[-hw, CURT_Y0 + 0.045, a.z], [hw, CURT_Y0 + 0.045, c.z]], { stroke: 'inkSoft', width: 0.6 });
      node.setPos(xm, 0, CURT_Z);
      strips.push({ node, bx: xm, phase: j * 0.9 + def.side });
    }
    for (let j = 0; j <= n; j += 2) {
      part.builder.cylinder(verts[j].x, 2.414, -2.44, 0.018, 0.014,
        { fill: 'face2', stroke: 'ink', width: 0.7 }, { axis: 'y', segments: 8 });
    }
    // invisible pick strip over the cloth
    part.builder.quad([def.x0, CURT_Y0, CURT_Z + 0.07], [def.x1, CURT_Y0, CURT_Z + 0.07],
      [def.x1, CURT_Y1, CURT_Z + 0.07], [def.x0, CURT_Y1, CURT_Z + 0.07], { fill: 'none', stroke: 'none' });
    panels.push({ edge: def.edge, def, part, strips });
  }

  let curtainOpen = clamp(state.curtainOpen === undefined ? 1 : state.curtainOpen, 0, 1);
  const curtainSpring = new Spring(curtainOpen, 34, 8.5);
  function toggleCurtain() {
    curtainOpen = curtainOpen > 0.5 ? 0 : 1;
    curtainSpring.to(curtainOpen);
    sfx('page', { rate: curtainOpen ? 1.25 : 1.0, pan: -0.2 });
  }
  for (const p of panels) p.part.onClick(toggleCurtain);

  curtain.onUpdate((dt, now) => {
    wallGate(curtain, 2, RZ0, 1);
    curtainSpring.step(dt);
    const t = clamp(curtainSpring.value, 0, 1);
    const k = 1 - 0.86 * t;
    const zs = lerp(1, 0.34, t);
    for (const p of panels) {
      for (const s of p.strips) {
        const x = p.edge + (s.bx - p.edge) * k;
        const breath = Math.sin((now / 7) * TAU + s.phase) * 0.0015;
        s.node.setPos(x + breath, 0, CURT_Z);
        s.node.setScale(1, 1, zs);
      }
    }
    const prev = state.curtainOpen;
    if (prev === undefined || Math.abs(prev - t) > 0.002 || ((t < 0.002 || t > 0.998) && prev !== t)) {
      ctx.set('curtainOpen', t);
    }
  });

  /* =======================================================================
   * 6. DOOR — architrave, leaf with three recessed panels, lever, hinges
   * ===================================================================== */
  const door = newObj({ id: 'door', label: '门', hint: '开合' });
  const db = door.builder;
  const archO = 0.036;
  const archSt = { fill: 'face1', stroke: 'ink', width: 1.15 };
  db.box([RX0, 0, DZ0 - 0.075], [RX0 + archO, DY1 + 0.075, DZ0 - 0.005], archSt);
  db.box([RX0, 0, DZ1 + 0.005], [RX0 + archO, DY1 + 0.075, DZ1 + 0.075], archSt);
  db.box([RX0, DY1 + 0.005, DZ0 - 0.075], [RX0 + archO, DY1 + 0.075, DZ1 + 0.075], archSt);
  db.polyline([[RX0 + 0.001, 0.02, DZ0 - 0.076], [RX0 + 0.001, DY1 + 0.076, DZ0 - 0.076]], { stroke: 'inkSoft', width: 0.6 });
  db.polyline([[RX0 + 0.001, 0.02, DZ1 + 0.076], [RX0 + 0.001, DY1 + 0.076, DZ1 + 0.076]], { stroke: 'inkSoft', width: 0.6 });
  db.box([LXO, 0, DZ0], [RX0, 0.022, DZ1], { fill: 'face2', stroke: 'inkSoft', width: 0.9 });
  db.box([RX0 - 0.012, 0, DZ0], [RX0, DY1, DZ0 + 0.022], { fill: 'face2', stroke: 'inkSoft', width: 0.7 });
  db.box([RX0 - 0.012, 0, DZ1 - 0.022], [RX0, DY1, DZ1], { fill: 'face2', stroke: 'inkSoft', width: 0.7 });
  for (const hy of [0.35, 1.05, 1.75]) {
    db.cylinder(RX0 - 0.02, hy, DZ1 + 0.012, 0.013, 0.075, { fill: 'face1', stroke: 'ink', width: 0.9 }, { axis: 'y', segments: 10 });
    db.box([RX0 - 0.045, hy - 0.045, DZ1 + 0.004], [RX0 - 0.004, hy + 0.045, DZ1 + 0.03],
      { fill: 'face2', stroke: 'inkSoft', width: 0.7 });
  }

  const LEAF_T = 0.045;
  const leaf = door.part('door-leaf', { label: '门', hint: '点击开合' });
  leaf.setPos(RX0 - 0.006, 0, DZ1);
  const LFB = leaf.builder;
  LFB.box([-LEAF_T, 0.012, -0.958], [0, 2.052, -0.004], { fill: 'face1', stroke: 'ink', width: 1.35, cull: 'back' });
  const panelRanges = [[1.70, 1.97], [0.70, 1.60], [0.10, 0.60]];
  for (const [y0, y1] of panelRanges) {
    LFB.quad([-0.001, y0 - 0.02, -0.10], [-0.001, y0 - 0.02, -0.86], [-0.001, y1 + 0.02, -0.86], [-0.001, y1 + 0.02, -0.10],
      { fill: 'none', stroke: 'ink', width: 0.85 });
    LFB.quad([-0.006, y0, -0.12], [-0.006, y0, -0.84], [-0.006, y1, -0.84], [-0.006, y1, -0.12],
      { fill: 'face2', stroke: 'inkSoft', width: 0.8 });
    LFB.polyline([[-0.0065, y1 - 0.006, -0.13], [-0.0065, y1 - 0.006, -0.83]], { stroke: 'inkSoft', width: 0.5, alpha: 0.7 });
    LFB.quad([-LEAF_T + 0.006, y0, -0.12], [-LEAF_T + 0.006, y0, -0.84], [-LEAF_T + 0.006, y1, -0.84], [-LEAF_T + 0.006, y1, -0.12],
      { fill: 'face2', stroke: 'inkSoft', width: 0.7 });
  }
  LFB.quad([-0.004, 0.03, -0.10], [-0.004, 0.03, -0.86], [-0.004, 0.20, -0.86], [-0.004, 0.20, -0.10],
    { fill: 'face2', stroke: 'inkSoft', width: 0.9 });
  for (const [y, z] of [[0.05, -0.15], [0.05, -0.81], [0.18, -0.15], [0.18, -0.81]]) {
    LFB.cylinder(-0.0035, y, z, 0.006, 0.004, { fill: 'face1', stroke: 'ink', width: 0.5 }, { axis: 'x', segments: 6 });
  }
  for (const hy of [0.35, 1.05, 1.75]) {
    LFB.box([-0.0045, hy - 0.045, -0.06], [-0.004, hy + 0.045, -0.004], { fill: 'face2', stroke: 'inkSoft', width: 0.7 });
    for (const dy of [-0.028, 0.028]) {
      LFB.cylinder(-0.0035, hy + dy, -0.032, 0.005, 0.004, { fill: 'face1', stroke: 'ink', width: 0.45 }, { axis: 'x', segments: 6 });
    }
  }
  // rose (static, part of the leaf) + keyhole
  LFB.cylinder(0.007, 1.02, -0.87, 0.030, 0.014, { fill: 'face1', stroke: 'ink', width: 0.9 }, { axis: 'x', segments: 16 });
  LFB.cylinder(0.002, 0.955, -0.87, 0.011, 0.005, { fill: 'face2', stroke: 'ink', width: 0.7 }, { axis: 'x', segments: 12 });
  LFB.polyline([[-0.001, 0.943, -0.87], [-0.001, 0.966, -0.87]], { stroke: 'ink', width: 0.8 });

  // lever handle, pivoting on its own spindle
  const handle = leaf.part('door-handle', { label: '门把手', hint: '转动' });
  handle.hitPadding = 0.02;
  handle.setPos(0.020, 1.02, -0.87);
  const HB = handle.builder;
  HB.cylinder(0, 0, 0, 0.016, 0.022, { fill: 'face2', stroke: 'ink', width: 0.8 }, { axis: 'x', segments: 12 });
  HB.box([-0.008, -0.014, -0.088], [0.008, 0.014, 0.0], { fill: 'face1', stroke: 'ink', width: 1.0, cull: 'back' });
  HB.cylinder(0, 0, -0.082, 0.014, 0.016, { fill: 'face2', stroke: 'ink', width: 0.7 }, { axis: 'z', segments: 10 });

  const doorSpring = new Spring(0, 60, 10.5);
  let doorOpen = false;
  let handleHover = 0;
  function toggleDoor() {
    doorOpen = !doorOpen;
    doorSpring.to(doorOpen ? -1.80 : 0);      // negative Y rotation swings into the room
    sfx(doorOpen ? 'doorOpen' : 'doorClose', { pan: -0.35 });
  }
  leaf.onClick(toggleDoor);
  handle.onClick(toggleDoor);
  handle.onHover((h) => { handleHover = h ? 1 : 0; });
  door.onUpdate((dt, now) => {
    wallGate(door, 0, RX0, 1);
    doorSpring.step(dt);
    leaf.setRot(0, doorSpring.value, 0);
    handle.setRot(-0.30 * Math.max(handle.hoverT || 0, handleHover) + Math.sin(now * 0.7) * 0.004, 0, 0);
  });

  /* =======================================================================
   * 7. LIGHT SWITCH — plate (hover hint) + two-position rocker (click)
   * ===================================================================== */
  const sw = newObj({ id: 'switch', label: '灯光开关', hint: '切换昼夜' });
  const plate = sw.part('switch-plate', { label: '开关面板', cursor: 'default' });
  const SWX = RX0, SWY = 1.26, SWZ = 0.72;
  plate.builder.box([SWX - 0.006, SWY - 0.065, SWZ - 0.045], [SWX + 0.078, SWY + 0.065, SWZ + 0.045],
    { fill: 'face1', stroke: 'ink', width: 1.0, cull: 'back' });
  plate.builder.box([SWX + 0.078, SWY - 0.055, SWZ - 0.036], [SWX + 0.088, SWY + 0.055, SWZ + 0.036],
    { fill: 'face2', stroke: 'inkSoft', width: 0.75, cull: 'back' });
  plate.builder.cylinder(SWX + 0.05, SWY - 0.048, SWZ, 0.006, 0.02, { fill: 'face2', stroke: 'inkSoft', width: 0.5 }, { axis: 'x', segments: 6 });
  plate.builder.cylinder(SWX + 0.05, SWY + 0.048, SWZ, 0.006, 0.02, { fill: 'face2', stroke: 'inkSoft', width: 0.5 }, { axis: 'x', segments: 6 });
  plate.onHover(() => {});

  const rocker = sw.part('switch-rocker', { label: '灯光开关', hint: '切换昼夜' });
  rocker.hitPadding = 0.02;
  const RK = 0.042;
  rocker.builder.box([-0.004, -0.036, -RK], [0.012, 0.036, RK], { fill: 'face1', stroke: 'ink', width: 1.0, cull: 'back' });
  rocker.builder.quad([0.012, -0.036, -RK], [0.012, -0.036, RK], [0.012, 0.036, RK], [0.012, 0.036, -RK],
    { fill: 'face2', stroke: 'ink', width: 0.9 });
  rocker.builder.polyline([[0.013, -0.02, -RK + 0.006], [0.013, 0.02, -RK + 0.006]], { stroke: 'inkSoft', width: 0.5 });
  rocker.builder.polyline([[0.013, -0.02, RK - 0.006], [0.013, 0.02, RK - 0.006]], { stroke: 'inkSoft', width: 0.5 });
  const rockerSpring = new Spring(state.night ? 1 : 0, 150, 15);
  let rockerHover = 0;
  rocker.onHover((h) => { rockerHover = h ? 1 : 0; });
  rocker.onClick(() => {
    const next = !state.night;
    ctx.set('night', next);
    rockerSpring.to(next ? 1 : 0);
    sfx('switch', { pan: -0.4 });
  });
  sw.onUpdate((dt) => {
    wallGate(sw, 0, RX0, 1);
    rockerSpring.step(dt);
    rocker.setRot(0, 0, lerp(-0.14, 0.14, clamp(rockerSpring.value, 0, 1)));
    rocker.setPos(SWX + 0.088 + 0.003 * Math.max(rocker.hoverT || 0, rockerHover), SWY, SWZ);
  });

  /* =======================================================================
   * 8. SOCKET — low-key easter egg
   * ===================================================================== */
  const sock = newObj({ id: 'socket', label: '插座', hint: '试试看' });
  const sockPart = sock.part('socket', { label: '插座', hint: '试试看' });
  sockPart.hitPadding = 0.025;
  const SOX = RX0, SOY = 0.32, SOZ = -0.55;
  sockPart.builder.box([SOX - 0.004, SOY - 0.048, SOZ - 0.048], [SOX + 0.072, SOY + 0.048, SOZ + 0.048],
    { fill: 'face1', stroke: 'ink', width: 1.0, cull: 'back' });
  sockPart.builder.box([SOX + 0.072, SOY - 0.038, SOZ - 0.038], [SOX + 0.080, SOY + 0.038, SOZ + 0.038],
    { fill: 'face2', stroke: 'inkSoft', width: 0.75, cull: 'back' });
  const glowC = [226, 152, 104];
  const glowSt = { fill: glowC, stroke: 'none', alpha: 0 };
  for (const dz of [-0.016, 0.016]) {
    sockPart.builder.box([SOX + 0.079, SOY - 0.014, SOZ + dz - 0.005], [SOX + 0.086, SOY + 0.014, SOZ + dz + 0.005],
      { fill: 'dark', stroke: 'none' });
    sockPart.builder.quad([SOX + 0.081, SOY - 0.017, SOZ + dz - 0.009], [SOX + 0.081, SOY - 0.017, SOZ + dz + 0.009],
      [SOX + 0.081, SOY + 0.017, SOZ + dz + 0.009], [SOX + 0.081, SOY + 0.017, SOZ + dz - 0.009], glowSt);
  }
  const sparkSt = { stroke: 'accent', width: 1.0, alpha: 0 };
  sockPart.builder.polyline([[SOX + 0.09, SOY, SOZ], [SOX + 0.135, SOY + 0.03, SOZ + 0.03]], sparkSt);
  sockPart.builder.polyline([[SOX + 0.09, SOY, SOZ], [SOX + 0.12, SOY - 0.045, SOZ - 0.02]], sparkSt);
  sockPart.builder.polyline([[SOX + 0.09, SOY, SOZ], [SOX + 0.145, SOY - 0.005, SOZ + 0.05]], sparkSt);
  let sparkT = 0;
  sockPart.onClick(() => { sparkT = 1; sfx('click', { rate: 1.3, pan: -0.35 }); });
  sock.onUpdate((dt) => {
    wallGate(sock, 0, RX0, 1);
    sparkT = Math.max(0, sparkT - dt / 0.25);
    glowSt.alpha = sparkT * 0.95;
    sparkSt.alpha = sparkT * 0.8;
  });

  /* =======================================================================
   * 9. WALL CLOCK — real time, continuous sweep, 60-tick dial
   * ===================================================================== */
  const clock = newObj({ id: 'clock', label: '挂钟', hint: '点击报时' });
  clock.setPos(0.06, 2.14, -2.598);
  const CR = 0.21, BEZ = 0.055;
  const body = clock.node('body');
  const CB = body.builder;
  // shadow ring on the wall behind the case
  CB.ring(0, 0, 0.002, CR + 0.004, CR + 0.085, { fill: 'face2', stroke: 'none', alpha: 0.5 }, { axis: 'z', segments: 32 });
  const shHatch = { stroke: 'inkSoft', width: 0.5, alpha: 0.18, cull: 'back' };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2;
    ribbon(CB, [[Math.cos(a) * (CR + 0.012), Math.sin(a) * (CR + 0.012), 0.002],
      [Math.cos(a) * (CR + 0.072), Math.sin(a) * (CR + 0.072), 0.002]], BACK, 0.012, shHatch);
  }
  // conical case side + back plate + face
  CB.cylinder(0, 0, 0.031, CR, BEZ - 0.002, { fill: 'face1', stroke: 'ink', width: 1.2 }, { axis: 'z', segments: 34, rTop: CR - 0.014, capTop: false, capBottom: false });
  CB.disc(0, 0, 0.006, CR - 0.006, { fill: 'face2', stroke: 'none' }, { axis: 'z', segments: 34 });
  CB.disc(0, 0, BEZ, CR - 0.016, { fill: 'paper', stroke: 'ink', width: 1.0 }, { axis: 'z', segments: 40 });
  CB.ring(0, 0, BEZ + 0.0015, CR - 0.058, CR - 0.020, { fill: 'face1', stroke: 'inkSoft', width: 0.6 }, { axis: 'z', segments: 40 });
  // 60-tick dial
  const tickLong = { stroke: 'ink', width: 0.95, cull: 'back' };
  const tickShort = { stroke: 'inkSoft', width: 0.6, cull: 'back' };
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const long = i % 5 === 0;
    const r0 = CR - 0.026, r1 = CR - (long ? 0.052 : 0.040);
    ribbon(CB, [[Math.sin(a) * r0, Math.cos(a) * r0, BEZ + 0.003],
      [Math.sin(a) * r1, Math.cos(a) * r1, BEZ + 0.003]], BACK, long ? 0.006 : 0.004, long ? tickLong : tickShort);
  }
  // twelve numerals + brand
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * TAU;
    const rr = CR - 0.072;
    CB.push();
    CB.translate(Math.sin(a) * rr, Math.cos(a) * rr, BEZ + 0.0035);
    CB.text(String(h), { size: 0.026, align: 'center', baseline: 'middle', plane: 'xy', style: { stroke: 'ink', width: 0.8 } });
    CB.pop();
  }
  CB.push();
  CB.translate(0, -0.088, BEZ + 0.004);
  CB.text('PURE LINE', { size: 0.018, align: 'center', baseline: 'middle', plane: 'xy', style: { stroke: 'inkSoft', width: 0.55 } });
  CB.pop();
  // knurled bezel (its own node so hover can widen only the bezel)
  const bezelNode = clock.node('bezel');
  const ZB = bezelNode.builder;
  ZB.ring(0, 0, BEZ + 0.002, CR - 0.020, CR + 0.002, { fill: 'face1', stroke: 'ink', width: 1.1 }, { axis: 'z', segments: 48 });
  const knurlSt = { stroke: 'inkSoft', width: 0.5, cull: 'back' };
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    ribbon(ZB, [[Math.cos(a) * (CR - 0.016), Math.sin(a) * (CR - 0.016), BEZ + 0.0035],
      [Math.cos(a) * (CR + 0.001), Math.sin(a) * (CR + 0.001), BEZ + 0.0035]], BACK, 0.0045, knurlSt);
  }
  // hands (children of `body` so the knock wobble carries them along)
  function makeHand(name, len, w, tail, zed) {
    const n = body.node(name);
    n.setPos(0, 0, zed);
    const hb = n.builder;
    hb.poly([[-w * 0.5, -tail, 0], [w * 0.5, -tail, 0], [w * 0.34, len * 0.72, 0], [0, len, 0], [-w * 0.34, len * 0.72, 0]],
      { fill: 'face1', stroke: 'ink', width: 0.9, cull: 'back' });
    hb.polyline([[0, -tail, 0], [0, len, 0]], { stroke: 'inkSoft', width: 0.4, alpha: 0.6 });
    return n;
  }
  const hourHand = makeHand('hour', CR - 0.115, 0.020, 0.022, BEZ + 0.006);
  const minHand = makeHand('minute', CR - 0.052, 0.014, 0.026, BEZ + 0.0075);
  const secNode = body.node('second');
  secNode.setPos(0, 0, BEZ + 0.009);
  const secB = secNode.builder;
  secB.poly([[-0.0055, -0.048, 0], [0.0055, -0.048, 0], [0.0035, CR - 0.030, 0], [0, CR - 0.018, 0], [-0.0035, CR - 0.030, 0]],
    { fill: 'accent', stroke: 'accent', width: 0.7, cull: 'back' });
  secB.cylinder(0, -0.040, 0, 0.012, 0.005, { fill: 'accent', stroke: 'accent', width: 0.6 }, { axis: 'z', segments: 12 });
  CB.cylinder(0, 0, BEZ + 0.011, 0.017, 0.008, { fill: 'face1', stroke: 'ink', width: 0.8 }, { axis: 'z', segments: 14 });
  // glass highlight
  const glSt = { stroke: 'inkSoft', width: 1.0, alpha: 0.45, cull: 'back' };
  ribbon(CB, [[-0.10, -0.075, BEZ + 0.013], [0.055, 0.10, BEZ + 0.013]], BACK, 0.016, glSt);
  ribbon(CB, [[-0.055, -0.10, BEZ + 0.013], [0.085, 0.06, BEZ + 0.013]], BACK, 0.009, glSt);

  const knockSpring = new Spring(0, 210, 8);
  let tickOn = false;
  const clockPart = clock.part('clock-face', { label: '挂钟', hint: '点击报时' });
  pickProxy(clockPart.builder, [-CR, -CR, BEZ + 0.02], [CR, -CR, BEZ + 0.02], [CR, CR, BEZ + 0.02], [-CR, CR, BEZ + 0.02], BACK);
  clockPart.onClick(() => {
    tickOn = !tickOn;
    try { audio.setLoop('tick', tickOn); } catch (e) { /* silent */ }
    knockSpring.impulse(10);
    sfx('knock', { pan: 0.15, gain: 0.55 });
  });
  let bezelHover = 0;
  clockPart.onHover((h) => { bezelHover = h ? 1 : 0; });
  clock.onUpdate((dt, now) => {
    wallGate(clock, 2, RZ0, 1);
    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;
    secNode.setRot(0, 0, -(sec / 60) * TAU);
    minHand.setRot(0, 0, -(min / 60) * TAU);
    hourHand.setRot(0, 0, -(hr / 12) * TAU);
    knockSpring.step(dt);
    body.setRot(knockSpring.value * 0.020, 0, knockSpring.value * 0.030);
    body.setPos(0, knockSpring.value * 0.003, 0);
    const bz = 1 + 0.05 * Math.max(clockPart.hoverT || 0, bezelHover) + Math.sin(now * 1.1) * 0.0015;
    bezelNode.setScale(bz, bz, 1);
  });

  /* =======================================================================
   * 10. WALL ART — one big framed piece + two smaller frames
   * ===================================================================== */
  const art = newObj({ id: 'wall-art', label: '装饰画', hint: '换一幅' });

  function drawMountains(b, x0, x1, y0, y1, st, fillSt) {
    const w = x1 - x0, h = y1 - y0;
    const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
    b.poly([[X(0.04), Y(0.10), 0], [X(0.96), Y(0.10), 0], [X(0.96), Y(0.92), 0], [X(0.04), Y(0.92), 0]], fillSt);
    b.poly([[X(0.08), Y(0.16), 0], [X(0.34), Y(0.66), 0], [X(0.52), Y(0.42), 0], [X(0.72), Y(0.74), 0], [X(0.94), Y(0.22), 0]], st);
    b.polyline([[X(0.08), Y(0.30), 0], [X(0.30), Y(0.30), 0], [X(0.46), Y(0.30), 0], [X(0.70), Y(0.30), 0], [X(0.94), Y(0.30), 0]], st);
    b.polyline([[X(0.20), Y(0.16), 0], [X(0.26), Y(0.44), 0], [X(0.20), Y(0.56), 0]], st);
    b.polyline([[X(0.60), Y(0.22), 0], [X(0.64), Y(0.46), 0], [X(0.58), Y(0.58), 0]], st);
    b.polyline([[X(0.10), Y(0.62), 0], [X(0.18), Y(0.62), 0]], st);
    b.polyline([[X(0.14), Y(0.58), 0], [X(0.14), Y(0.66), 0]], st);
  }
  function drawArcs(b, x0, x1, y0, y1, st, fillSt) {
    const w = x1 - x0, h = y1 - y0;
    const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
    b.poly([[X(0.04), Y(0.08), 0], [X(0.96), Y(0.08), 0], [X(0.96), Y(0.94), 0], [X(0.04), Y(0.94), 0]], fillSt);
    for (let i = 0; i < 7; i++) {
      const r = 0.09 + i * 0.075;
      const pts = [];
      for (let k = 0; k <= 26; k++) {
        const a = Math.PI * 0.08 + (k / 26) * Math.PI * 0.84;
        pts.push([X(0.5) + Math.cos(a) * r * w * 0.92, Y(0.12) + Math.sin(a) * r * h * 0.98, 0]);
      }
      b.polyline(pts, st);
    }
    b.polyline([[X(0.16), Y(0.12), 0], [X(0.5), Y(0.12), 0], [X(0.84), Y(0.12), 0]], st);
    b.polyline([[X(0.5), Y(0.88), 0], [X(0.5), Y(0.14), 0]], { stroke: st.stroke, width: 0.5, alpha: 0.5 });
  }
  function drawBotanical(b, x0, x1, y0, y1, st, fillSt) {
    const w = x1 - x0, h = y1 - y0;
    const X = (u) => x0 + u * w, Y = (v) => y0 + v * h;
    b.poly([[X(0.05), Y(0.07), 0], [X(0.95), Y(0.07), 0], [X(0.95), Y(0.95), 0], [X(0.05), Y(0.95), 0]], fillSt);
    b.polyline([[X(0.5), Y(0.10), 0], [X(0.5), Y(0.52), 0], [X(0.48), Y(0.86), 0]], st);
    const branch = (bx, by, dx, dy, depth) => {
      const ex = bx + dx, ey = by + dy;
      b.polyline([[X(bx), Y(by), 0], [X(ex), Y(ey), 0]], st);
      if (depth > 0) {
        branch(ex, ey, dx * 0.62 - dy * 0.42, dy * 0.62 + dx * 0.42, depth - 1);
        branch(ex, ey, dx * 0.62 + dy * 0.42, dy * 0.62 - dx * 0.42, depth - 1);
      }
    };
    branch(0.5, 0.50, -0.11, 0.16, 2);
    branch(0.5, 0.44, 0.12, 0.17, 2);
    branch(0.49, 0.66, -0.07, 0.12, 1);
    branch(0.49, 0.72, 0.08, 0.11, 1);
    for (const [lx, ly] of [[0.30, 0.62], [0.70, 0.60], [0.36, 0.80], [0.64, 0.78], [0.50, 0.92]]) {
      b.poly([[X(lx), Y(ly), 0], [X(lx + 0.075), Y(ly + 0.03), 0], [X(lx + 0.055), Y(ly - 0.028), 0]], st);
    }
    b.polyline([[X(0.34), Y(0.10), 0], [X(0.66), Y(0.10), 0]], st);
  }
  const DRAWINGS = [drawMountains, drawArcs, drawBotanical];

  function buildFrame(def) {
    const part = art.part(def.id, { label: '装饰画', hint: '换一幅' });
    const f = def.box;
    const cx = (f.x0 + f.x1) * 0.5;
    const cy = (f.y0 + f.y1) * 0.5;
    const zBack = RZ0 + 0.012, zFront = RZ0 + 0.048;
    const n = part.node('tilt');
    n.setPos(cx, cy, zFront);
    const b = n.builder;
    const X = (v) => v - cx, Y = (v) => v - cy, Z = (v) => v - zFront;
    const fw = def.frame;
    const mould = { fill: 'face1', stroke: 'ink', width: 1.2, cull: 'back' };
    b.box([X(f.x0), Y(f.y0), Z(zBack)], [X(f.x0 + fw), Y(f.y1), 0], mould);
    b.box([X(f.x1 - fw), Y(f.y0), Z(zBack)], [X(f.x1), Y(f.y1), 0], mould);
    b.box([X(f.x0 + fw), Y(f.y1 - fw), Z(zBack)], [X(f.x1 - fw), Y(f.y1), 0], mould);
    b.box([X(f.x0 + fw), Y(f.y0), Z(zBack)], [X(f.x1 - fw), Y(f.y0 + fw), 0], mould);
    b.quad([X(f.x0 + fw), Y(f.y0 + fw), -0.004], [X(f.x1 - fw), Y(f.y0 + fw), -0.004],
      [X(f.x1 - fw), Y(f.y1 - fw), -0.004], [X(f.x0 + fw), Y(f.y1 - fw), -0.004],
      { fill: 'none', stroke: 'inkSoft', width: 0.7 });
    const ix0 = X(f.x0 + fw + 0.02), ix1 = X(f.x1 - fw - 0.02);
    const iy0 = Y(f.y0 + fw + 0.02), iy1 = Y(f.y1 - fw - 0.02);
    b.quad([ix0, iy0, -0.008], [ix1, iy0, -0.008], [ix1, iy1, -0.008], [ix0, iy1, -0.008],
      { fill: 'paper', stroke: 'inkSoft', width: 0.8 });
    const layers = [];
    for (let i = 0; i < DRAWINGS.length; i++) {
      const holder = n.node('draw' + i);
      const hb = holder.builder;
      const on = i === def.start ? 1 : 0;
      const stD = { stroke: 'ink', width: def.line, alpha: on };
      const stF = { fill: 'paper', stroke: 'inkSoft', width: 0.5, alpha: on };
      DRAWINGS[i](hb, ix0, ix1, iy0, iy1, stD, stF);
      holder.visible = i === def.start;
      layers.push({ stD, stF, holder });
    }
    b.quad([ix0, iy0, -0.002], [ix1, iy0, -0.002], [ix1, iy1, -0.002], [ix0, iy1, -0.002],
      { fill: 'glass', stroke: 'none', alpha: 0.10 });
    b.polyline([[ix0 + 0.05, iy0 + 0.06, -0.001], [ix1 - 0.12, iy1 - 0.08, -0.001]],
      { stroke: 'inkSoft', width: 0.8, alpha: 0.35 });
    const st = { index: def.start, from: -1, to: def.start, t: 1, dur: 0.42 };
    const tilt = new Spring(0, 150, 9);
    part.onClick(() => {
      st.from = st.index;
      st.index = (st.index + 1) % DRAWINGS.length;
      st.to = st.index;
      st.t = 0;
      layers[st.from].holder.visible = true;
      layers[st.to].holder.visible = true;
      tilt.impulse(6);
      sfx('page', { rate: 0.95, pan: 0.35 });
    });
    return { part, st, layers, tilt, node: n, cx, cy, zf: zFront };
  }

  const frames = [
    // NOTE (lead): the big picture was originally y[0.98,2.10], which put it
    // completely behind lounge.js's bookshelf. It now hangs as a wide print
    // above the shelf, where it is actually visible from the default camera.
    buildFrame({ id: 'art-big', box: { x0: 0.80, x1: 2.30, y0: 2.04, y1: 2.70 }, frame: 0.052, line: 0.9, start: 0 }),
    buildFrame({ id: 'art-small-l', box: { x0: -0.30, x1: 0.28, y0: 1.06, y1: 1.80 }, frame: 0.034, line: 0.75, start: 1 }),
    buildFrame({ id: 'art-small-r', box: { x0: 2.62, x1: 3.06, y0: 1.34, y1: 1.92 }, frame: 0.034, line: 0.75, start: 2 }),
  ];

  art.onUpdate((dt) => {
    wallGate(art, 2, RZ0, 1);
    for (let i = 0; i < frames.length; i++) {
      const fr = frames[i];
      fr.tilt.step(dt);
      fr.node.setRot(0, 0, fr.tilt.value * 0.05);
      fr.node.setPos(fr.cx + fr.tilt.value * 0.003, fr.cy + fr.tilt.value * 0.004, fr.zf);
      const s = fr.st;
      if (s.t < 1) {
        s.t = Math.min(1, s.t + dt / s.dur);
        const e = smooth(s.t);
        if (s.from >= 0) {
          fr.layers[s.from].stD.alpha = 1 - e;
          fr.layers[s.from].stF.alpha = 1 - e;
          if (e > 0.999) fr.layers[s.from].holder.visible = false;
        }
        fr.layers[s.to].stD.alpha = e;
        fr.layers[s.to].stF.alpha = e;
      }
    }
  });

  /* =======================================================================
   * 11. WALL SHELF with a small plant and two books (left wall)
   * ===================================================================== */
  const shelf = newObj({ id: 'shelf', label: '搁板', cursor: 'default' });
  const SH_Y = 1.72, SH_Z0 = -0.30, SH_Z1 = 0.90, SH_D = 0.16;
  const shb = shelf.builder;
  shb.box([RX0, SH_Y, SH_Z0], [RX0 + SH_D, SH_Y + 0.026, SH_Z1], { fill: 'face1', stroke: 'ink', width: 1.1, cull: 'back' });
  shb.quad([RX0 + 0.004, SH_Y + 0.0265, SH_Z0 + 0.006], [RX0 + SH_D - 0.006, SH_Y + 0.0265, SH_Z0 + 0.006],
    [RX0 + SH_D - 0.006, SH_Y + 0.0265, SH_Z1 - 0.006], [RX0 + 0.004, SH_Y + 0.0265, SH_Z1 - 0.006],
    { fill: 'face2', stroke: 'inkSoft', width: 0.6 });
  for (const bz of [SH_Z0 + 0.09, SH_Z1 - 0.09]) {
    quadN(shb, [[RX0, SH_Y - 0.10, bz], [RX0 + 0.11, SH_Y, bz], [RX0 + 0.11, SH_Y, bz + 0.018], [RX0, SH_Y - 0.10, bz + 0.018]],
      LEFT, { fill: 'face1', stroke: 'ink', width: 0.9 });
    quadN(shb, [[RX0, SH_Y - 0.10, bz + 0.018], [RX0 + 0.11, SH_Y, bz + 0.018], [RX0 + 0.11, SH_Y, bz], [RX0, SH_Y - 0.10, bz]],
      LEFT, { fill: 'face1', stroke: 'ink', width: 0.9 });
  }
  shb.polyline([[RX0 + 0.002, SH_Y + 0.028, SH_Z0 + 0.01], [RX0 + 0.002, SH_Y + 0.028, SH_Z1 - 0.01]],
    { stroke: 'inkSoft', width: 0.5, alpha: 0.7 });

  const plant = shelf.part('shelf-plant', { label: '小盆栽', hint: '碰一下' });
  plant.setPos(RX0 + 0.075, SH_Y + 0.026, 0.56);
  const plB = plant.builder;
  plB.cylinder(0, 0.038, 0, 0.043, 0.076, { fill: 'face1', stroke: 'ink', width: 1.0 }, { axis: 'y', segments: 14, rTop: 0.047 });
  plB.cylinder(0, 0.077, 0, 0.049, 0.012, { fill: 'face2', stroke: 'ink', width: 0.9 }, { axis: 'y', segments: 14 });
  plB.cylinder(0, 0.006, 0, 0.036, 0.012, { fill: 'face2', stroke: 'inkSoft', width: 0.7 }, { axis: 'y', segments: 14 });
  plB.cylinder(0, 0.16, 0, 0.006, 0.17, { fill: 'face2', stroke: 'ink', width: 0.7 }, { axis: 'y', segments: 6 });
  const leafSt = { fill: 'face1', stroke: 'ink', width: 0.85 };
  for (let i = 0; i < 7; i++) {
    const a = -0.4 + i * 0.62;
    const len = 0.075 + 0.03 * Math.sin(i * 1.7);
    const h = 0.20 + 0.055 * Math.sin(i * 2.3);
    plB.push();
    plB.translate(0, h, 0);
    plB.rotateZ(a);
    plB.poly([[0, 0, 0], [len, 0.022, 0], [len * 0.85, -0.012, 0]], leafSt);
    plB.polyline([[0, 0, 0], [len * 0.7, 0.004, 0]], { stroke: 'inkSoft', width: 0.4 });
    plB.pop();
  }
  const plantSpring = new Spring(0, 42, 3.6);
  plant.onClick(() => { plantSpring.impulse(1.6); sfx('cushion', { pan: -0.25, gain: 0.7 }); });

  const books = shelf.part('shelf-books', { label: '两本书', hint: '挪一下' });
  books.setPos(RX0 + 0.085, SH_Y + 0.026, 0.10);
  const bk = books.builder;
  bk.box([-0.055, 0, -0.085], [0.045, 0.021, 0.085], { fill: 'face1', stroke: 'ink', width: 1.0, cull: 'back' });
  bk.box([-0.053, 0.021, -0.083], [0.043, 0.023, 0.083], { fill: 'paper', stroke: 'inkSoft', width: 0.7 });
  bk.box([-0.048, 0.023, -0.079], [0.040, 0.044, 0.079], { fill: 'face2', stroke: 'ink', width: 1.0, cull: 'back' });
  bk.box([-0.046, 0.044, -0.077], [0.038, 0.046, 0.077], { fill: 'paper', stroke: 'inkSoft', width: 0.7 });
  for (const bx of [-0.05, -0.01, 0.03]) {
    bk.polyline([[bx, 0.006, -0.086], [bx, 0.006, 0.086]], { stroke: 'inkSoft', width: 0.45, alpha: 0.6 });
    bk.polyline([[bx, 0.027, -0.080], [bx, 0.027, 0.080]], { stroke: 'inkSoft', width: 0.45, alpha: 0.6 });
  }
  const bookSpring = new Spring(0, 220, 14);
  books.onClick(() => { bookSpring.impulse(1.4); sfx('thud', { pan: -0.2, gain: 0.35 }); });
  shelf.onUpdate((dt) => {
    wallGate(shelf, 0, RX0, 1);
    plantSpring.step(dt);
    const a = clamp(plantSpring.value, -0.5, 0.5);
    plant.setRot(0, 0, a * 0.30);
    plant.setPos(RX0 + 0.075 + a * 0.005, SH_Y + 0.026, 0.56);
    bookSpring.step(dt);
    books.setPos(RX0 + 0.085 + bookSpring.value * 0.02, SH_Y + 0.026, 0.10 + bookSpring.value * 0.02);
    books.setRot(0, 0, bookSpring.value * 0.03);
  });

  /* =======================================================================
   * 12. FLOOR LAMP — base (2.72, 0, -1.55)
   * ===================================================================== */
  const lamp = newObj({ id: 'floor-lamp', label: '落地灯', hint: '开关' });
  lamp.setPos(2.72, 0, -1.55);
  const lampPart = lamp.part('lamp-floor', { label: '落地灯', hint: '开关' });
  const LB = lampPart.builder;
  const metalSt = { fill: 'face1', stroke: 'ink', width: 1.1 };
  LB.cylinder(0, 0.012, 0, 0.155, 0.024, metalSt, { axis: 'y', segments: 24, rTop: 0.135 });
  LB.cylinder(0, 0.03, 0, 0.06, 0.02, { fill: 'face2', stroke: 'inkSoft', width: 0.7 }, { axis: 'y', segments: 14 });
  LB.cylinder(0, 0.70, 0, 0.016, 1.34, metalSt, { axis: 'y', segments: 10 });
  LB.cylinder(0, 1.36, 0, 0.022, 0.04, { fill: 'face2', stroke: 'ink', width: 0.8 }, { axis: 'y', segments: 12 });
  const shadeFill = [240, 237, 230];
  LB.cylinder(0, 1.50, 0, 0.20, 0.30, { fill: shadeFill, stroke: 'ink', width: 1.25 },
    { axis: 'y', segments: 28, rTop: 0.115, capTop: false, capBottom: false });
  LB.cylinder(0, 1.50, 0, 0.194, 0.30, { fill: 'face2', stroke: 'inkSoft', width: 0.7 },
    { axis: 'y', segments: 28, rTop: 0.111, capTop: false, capBottom: false });
  LB.ring(0, 1.35, 0, 0.185, 0.20, { fill: 'face1', stroke: 'ink', width: 0.9 }, { axis: 'y', segments: 28 });
  LB.ring(0, 1.65, 0, 0.10, 0.115, { fill: 'face1', stroke: 'ink', width: 0.9 }, { axis: 'y', segments: 28 });
  const bulbSt = { fill: 'glow', stroke: 'inkSoft', width: 0.7, alpha: 0.5 };
  LB.cylinder(0, 1.44, 0, 0.035, 0.075, bulbSt, { axis: 'y', segments: 12, rTop: 0.02 });
  LB.cylinder(0, 1.41, 0, 0.012, 0.03, { fill: 'face2', stroke: 'inkSoft', width: 0.6 }, { axis: 'y', segments: 8 });
  LB.polyline([[0.016, 0.06, 0], [0.016, 1.32, 0]], { stroke: 'inkSoft', width: 0.45, alpha: 0.55 });
  const lampCord = lamp.node('cord');
  lampCord.setPos(0.02, 1.30, 0.02);
  const cpts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    cpts.push([t * 0.02 + Math.sin(t * 2.2) * 0.012, -t * 0.24, t * 0.01]);
  }
  lampCord.builder.polyline(cpts, { stroke: 'ink', width: 0.7 });
  lampCord.builder.cylinder(cpts[8][0], cpts[8][1] - 0.02, cpts[8][2], 0.011, 0.04,
    { fill: 'face1', stroke: 'ink', width: 0.7 }, { axis: 'y', segments: 8 });

  let lampOn = !!state.lampFloorOn;
  let lampVal = lampOn ? 1 : 0;
  lampPart.onClick(() => {
    lampOn = !lampOn;
    ctx.set('lampFloorOn', lampOn);
    sfx('lampClick', { pan: 0.35 });
  });
  lamp.onUpdate((dt, now) => {
    const target = lampOn ? 1 : 0;
    lampVal = ctx.damp ? ctx.damp(lampVal, target, 6, dt) : target;
    const glow = [255, 246, 224];
    const base = [240, 237, 230];
    const nightBoost = 0.35 + 0.65 * clamp(ctx.nightT || 0, 0, 1);
    const k = lampVal * nightBoost;
    for (let i = 0; i < 3; i++) shadeFill[i] = Math.round(lerp(base[i], glow[i], k));
    bulbSt.alpha = 0.35 + 0.65 * lampVal;
    lampCord.setRot(0, 0, Math.sin(now * 1.05) * 0.022 + lampVal * 0.006);
    if (lampVal > 0.02 && ctx.light) {
      ctx.light(2.72, 1.48, -1.55, 2.6, [255, 214, 150], lampVal * (0.35 + 0.65 * clamp(ctx.nightT || 0, 0, 1)));
    }
  });

  /* =======================================================================
   * 13. FRONT WALL — coat hooks + coat, and the triptych.
   *     Flat and inward-culled so they vanish with the front wall instead of
   *     floating over the room from the default camera.
   * ===================================================================== */
  const coat = newObj({ id: 'coat-rack', label: '衣帽钩', hint: '摆一下' });
  const hooksPart = coat.part('coat-hooks', { label: '衣帽钩', hint: '摆一下' });
  const HB2 = hooksPart.builder;
  const FZ = RZ1 - 0.05;
  const plateSt = { fill: 'face1', stroke: 'ink', width: 1.1, cull: 'back' };
  flatPoly(HB2, [[-2.96, 1.80, FZ], [-1.74, 1.80, FZ], [-1.74, 1.885, FZ], [-2.96, 1.885, FZ]], FRONT, plateSt);
  flatPoly(HB2, [[-2.94, 1.814, FZ], [-1.76, 1.814, FZ], [-1.76, 1.871, FZ], [-2.94, 1.871, FZ]], FRONT,
    { fill: 'face2', stroke: 'inkSoft', width: 0.6, cull: 'back' });
  for (const hx of [-2.82, -2.35, -1.88]) {
    flatPoly(HB2, [[hx - 0.012, 1.815, FZ], [hx + 0.012, 1.815, FZ], [hx + 0.012, 1.845, FZ], [hx - 0.012, 1.845, FZ]], FRONT,
      { fill: 'face1', stroke: 'inkSoft', width: 0.5, cull: 'back' });
    const arm = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = -Math.PI * 0.5 + t * Math.PI * 1.15;
      arm.push([hx + Math.sin(a) * 0.032, 1.80 + Math.cos(a) * 0.030 + 0.018 * t, FZ]);
    }
    ribbon(HB2, arm, FRONT, 0.013, { stroke: 'ink', width: 0.85, cull: 'back' });
    flatPoly(HB2, [[hx - 0.028, 1.80, FZ], [hx + 0.028, 1.80, FZ], [hx + 0.022, 1.775, FZ], [hx - 0.022, 1.775, FZ]], FRONT,
      { fill: 'face1', stroke: 'inkSoft', width: 0.5, cull: 'back' });
  }
  for (const sx of [-2.90, -1.80]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ribbon(HB2, [[sx + Math.cos(a) * 0.006, 1.826 + Math.sin(a) * 0.006, FZ],
        [sx + Math.cos(a) * 0.010, 1.826 + Math.sin(a) * 0.010, FZ]], FRONT, 0.0035,
        { stroke: 'inkSoft', width: 0.5, cull: 'back' });
    }
  }
  hooksPart.hitPadding = 0.03;
  pickProxy(hooksPart.builder, [-2.98, 1.74, FZ], [-1.72, 1.74, FZ], [-1.72, 1.90, FZ], [-2.98, 1.90, FZ], FRONT);

  const coatPart = coat.part('coat', { label: '挂衣', hint: '摆一下' });
  coatPart.setPos(-2.35, 1.78, FZ - 0.03);
  const CB2 = coatPart.builder;
  const clothA = { fill: 'face1', stroke: 'ink', width: 1.05, cull: 'back' };
  const clothB = { fill: 'face2', stroke: 'inkSoft', width: 0.6, cull: 'back' };
  flatPoly(CB2, [[-0.18, 0.02, 0], [0.18, 0.02, 0], [0.22, -0.10, 0], [0.30, -0.20, 0],
    [0.32, -0.86, 0], [-0.32, -0.86, 0], [-0.30, -0.20, 0], [-0.22, -0.10, 0]], FRONT, clothA);
  const hk = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    hk.push([Math.sin(t * Math.PI * 0.9) * 0.05 - 0.05, 0.02 + t * 0.06, 0]);
  }
  ribbon(CB2, hk, FRONT, 0.012, { stroke: 'ink', width: 0.8, cull: 'back' });
  ribbon(CB2, [[-0.20, 0.015, 0], [0.20, 0.015, 0]], FRONT, 0.016, { stroke: 'ink', width: 0.9, cull: 'back' });
  flatPoly(CB2, [[-0.06, -0.06, 0], [0.02, -0.10, 0], [-0.02, -0.42, 0], [-0.10, -0.34, 0]], FRONT, clothB);
  flatPoly(CB2, [[0.06, -0.06, 0], [-0.02, -0.10, 0], [0.02, -0.42, 0], [0.10, -0.34, 0]], FRONT, clothB);
  for (const [fx, fw] of [[-0.20, 0.05], [-0.09, 0.04], [0.05, 0.045], [0.20, 0.05]]) {
    ribbon(CB2, [[fx, -0.16, 0], [fx + fw * 0.3, -0.5, 0], [fx + fw * 0.1, -0.83, 0]], FRONT, 0.006,
      { stroke: 'inkSoft', width: 0.5, cull: 'back' });
  }
  ribbon(CB2, [[-0.30, -0.30, 0], [-0.33, -0.55, 0], [-0.31, -0.84, 0]], FRONT, 0.006, { stroke: 'inkSoft', width: 0.5, cull: 'back' });
  ribbon(CB2, [[0.30, -0.30, 0], [0.33, -0.55, 0], [0.31, -0.84, 0]], FRONT, 0.006, { stroke: 'inkSoft', width: 0.5, cull: 'back' });
  ribbon(CB2, [[-0.32, -0.86, 0], [0.32, -0.86, 0]], FRONT, 0.010, { stroke: 'ink', width: 0.7, cull: 'back' });
  for (const by of [-0.30, -0.44]) {
    flatPoly(CB2, [[-0.02, by - 0.014, 0], [0.02, by - 0.014, 0], [0.02, by + 0.014, 0], [-0.02, by + 0.014, 0]], FRONT,
      { fill: 'face2', stroke: 'inkSoft', width: 0.5, cull: 'back' });
  }
  const coatSpring = new Spring(0, 22, 1.9);
  const coatClick = () => { coatSpring.impulse(1.2); sfx('cushion', { pan: 0.2, gain: 0.6 }); };
  coatPart.onClick(coatClick);
  hooksPart.onClick(coatClick);
  coat.onUpdate((dt, now) => {
    wallGate(coat, 2, RZ1, -1);
    coatSpring.step(dt);
    coatPart.setRot(0, 0, coatSpring.value * 0.45 + Math.sin(now * 0.62) * 0.012);
  });

  /* the tri-frame picture on the front wall */
  const triptych = newObj({ id: 'front-art', label: '三联画', cursor: 'default' });
  triptych.onUpdate(() => { wallGate(triptych, 2, RZ1, -1); });
  const TB = triptych.builder;
  const TZ = RZ1 - 0.06;
  const trio = [[-1.50, -0.60], [-0.45, 0.45], [0.60, 1.50]];
  for (let i = 0; i < trio.length; i++) {
    const fx0 = trio[i][0], fx1 = trio[i][1];
    const y0 = 1.15, y1 = 2.35, fw = 0.045;
    flatPoly(TB, [[fx0, y0, TZ], [fx1, y0, TZ], [fx1, y1, TZ], [fx0, y1, TZ]], FRONT,
      { fill: 'face1', stroke: 'ink', width: 1.15, cull: 'back' });
    flatPoly(TB, [[fx0 + fw, y0 + fw, TZ], [fx1 - fw, y0 + fw, TZ], [fx1 - fw, y1 - fw, TZ], [fx0 + fw, y1 - fw, TZ]], FRONT,
      { fill: 'paper', stroke: 'inkSoft', width: 0.7, cull: 'back' });
    flatPoly(TB, [[fx0 + fw, y1 - fw - 0.03, TZ], [fx1 - fw, y1 - fw - 0.03, TZ], [fx1 - fw, y1 - fw, TZ], [fx0 + fw, y1 - fw, TZ]], FRONT,
      { fill: 'face2', stroke: 'none', cull: 'back' });
    const cx = (fx0 + fx1) / 2;
    const st = { stroke: 'ink', width: 0.8, alpha: 0.85, cull: 'back' };
    const soft = { stroke: 'inkSoft', width: 0.55, cull: 'back' };
    if (i === 0) {
      ribbon(TB, [[cx - 0.3, 1.4, TZ], [cx, 2.06, TZ], [cx + 0.3, 1.42, TZ]], FRONT, 0.008, st);
      ribbon(TB, [[cx - 0.34, 1.6, TZ], [cx, 1.28, TZ], [cx + 0.34, 1.62, TZ]], FRONT, 0.008, st);
      flatPoly(TB, [[cx - 0.06, 1.72, TZ], [cx + 0.06, 1.72, TZ], [cx + 0.06, 1.84, TZ], [cx - 0.06, 1.84, TZ]], FRONT,
        { fill: 'face2', stroke: 'none', cull: 'back' });
    } else if (i === 1) {
      for (let k = 0; k < 5; k++) {
        const rr = 0.08 + k * 0.075;
        const pts = [];
        for (let j = 0; j <= 20; j++) {
          const a = Math.PI * 0.1 + (j / 20) * Math.PI * 0.8;
          pts.push([cx + Math.cos(a) * rr, 1.5 + Math.sin(a) * rr * 0.95, TZ]);
        }
        ribbon(TB, pts, FRONT, 0.006, st);
      }
      ribbon(TB, [[cx - 0.38, 1.34, TZ], [cx, 1.34, TZ], [cx + 0.38, 1.34, TZ]], FRONT, 0.007, st);
      ribbon(TB, [[cx - 0.05, 2.14, TZ], [cx - 0.05, 1.36, TZ]], FRONT, 0.005, soft);
    } else {
      ribbon(TB, [[cx - 0.02, 1.34, TZ], [cx - 0.02, 1.9, TZ]], FRONT, 0.007, st);
      ribbon(TB, [[cx - 0.02, 1.7, TZ], [cx - 0.22, 1.94, TZ]], FRONT, 0.006, st);
      ribbon(TB, [[cx - 0.02, 1.62, TZ], [cx + 0.22, 1.86, TZ]], FRONT, 0.006, st);
      ribbon(TB, [[cx - 0.02, 1.82, TZ], [cx - 0.18, 2.06, TZ]], FRONT, 0.006, st);
      flatPoly(TB, [[cx - 0.10, 1.30, TZ], [cx + 0.06, 1.30, TZ], [cx + 0.02, 1.20, TZ], [cx - 0.13, 1.20, TZ]], FRONT,
        { fill: 'face2', stroke: 'inkSoft', width: 0.6, cull: 'back' });
    }
  }
}
