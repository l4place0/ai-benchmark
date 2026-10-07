/* =============================================================================
   _dev/lounge_preview.mjs — project the lounge module and write an SVG.

   Mirrors js/renderer.js: same default camera, same 40° fov, same painter sort
   (key = zavg*0.72 + zmin*0.28), same four stroke weights, same material
   resolution and baked shading.  Room.js is loaded too (with its back-face
   culling) so the furniture can be judged in place.

   Run: <node> _dev/lounge_preview.mjs   →  _dev/lounge_preview.svg
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

globalThis.window = globalThis;
const load = (f) => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try { (0, eval)(src); } catch (e) { console.error('load ' + f + ': ' + e.message); }
};
['js/math3d.js', 'js/scene.js', 'js/palette.js', 'js/anim.js', 'js/lounge.js'].forEach(load);

const PLR = globalThis.PLR;
const M3 = globalThis.M3;
const G = PLR.geom;

const FOV = 40, NEAR = 0.06, REF = 5.2;
const THEME = PLR.palette.build({ day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false });

/* ------------------------------------------------------------------ scene */
const registered = [];
const scene = new PLR.Scene();
const sctx = {
  scene,
  env: { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false },
  parts: {},
  WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
  ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 },
  toast: () => {},
  register: (o) => { registered.push(o); return o; }
};
const ctxStub = {
  env: sctx.env, time: 0, hover: false, anim: PLR.anim, mesh: null,
  setEnv: (p) => Object.assign(sctx.env, p),
  audio: { play: () => {} },
  toast: () => {}
};

let roomOK = false;
const wantRoom = process.argv.indexOf('--room') >= 0;
if (wantRoom) {
  try {
    load('js/room.js');
    if (typeof PLR.roomBuild === 'function') {
      PLR.roomBuild(sctx);
      roomOK = true;
    }
  } catch (e) {
    console.error('room.js unavailable: ' + e.message);
  }
}
const roomMeshes = scene.meshes.length;
PLR.loungeBuild(sctx);
const loungeMeshes = scene.meshes.slice(roomMeshes);
const allMeshes = scene.meshes;
scene.meshes = loungeMeshes;          // judge the module on its own by default
console.log('meshes: lounge ' + loungeMeshes.length + ', room ' + roomMeshes);

/* --------------------------------------------------------------- camera */
function makeCam(eye, target, W, H, fovDeg) {
  const f = 1 / Math.tan((fovDeg || FOV) * Math.PI / 360);
  const view = M3.lookAt(eye, target, [0, 1, 0]);
  const p0 = f / (W / H), p5 = f;
  return {
    eye, W, H,
    to(p) {
      const e = M3.xformPoint(view, p);
      const d = -e[2];
      if (d <= NEAR) return null;
      return [(e[0] * p0 / d) * 0.5 * W + W * 0.5, (0.5 - (e[1] * p5 / d) * 0.5) * H, d];
    }
  };
}

/* main.js camera: yaw 1.02, pitch 0.165, dist 5.4, target (0, 1.42, -0.30),
   clamped to the room box — this is what the viewer actually boots into. */
function mainCam(W, H) {
  const yaw = 1.02, pitch = 0.165, dist = 5.4;
  const cp = Math.cos(pitch);
  let e = [Math.sin(yaw) * dist * cp, 1.42 + Math.sin(pitch) * dist, -0.30 + Math.cos(yaw) * dist * cp];
  e = [Math.max(-3.1, Math.min(3.1, e[0])), Math.max(0.55, Math.min(3.5, e[1])),
    Math.max(-4.4, Math.min(5.4, e[2]))];
  return makeCam(e, [0, 1.42, -0.30], W, H, 46);
}

/* ------------------------------------------------------------- helpers */
function fmt(v) { return (Math.round(v * 10) / 10).toString(); }
function pts(list) { return list.map((p) => fmt(p[0]) + ',' + fmt(p[1])).join(' '); }

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) hit = !hit;
  }
  return hit;
}

/** Emit hatch strokes as plain polylines clipped by sampling (keeps the SVG dumb). */
function hatchLines(scr, spec, out) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of scr) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  const w = x1 - x0, h = y1 - y0;
  if (w <= 1 || h <= 1) return;
  const ang = (spec.angle || 45) * Math.PI / 180;
  const gap = spec.gap || 9;
  const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, span = Math.hypot(w, h);
  const n = Math.min(spec.max || 26, Math.ceil(span / gap) + 1);
  const alpha = spec.alpha === undefined ? 0.16 : spec.alpha;
  const step = span / 48;
  for (let k = -n; k <= n; k++) {
    const ox = cx + px * k * gap, oy = cy + py * k * gap;
    let run = [];
    for (let s = -24; s <= 24; s++) {
      const X = ox + dx * s * step, Y = oy + dy * s * step;
      if (inside(scr, X, Y)) run.push([X, Y]);
      else {
        if (run.length > 1) out.push(lineEl(run, alpha));
        run = [];
      }
    }
    if (run.length > 1) out.push(lineEl(run, alpha));
  }
}
function lineEl(run, alpha) {
  return '<polyline fill="none" stroke="' + THEME.line + '" stroke-opacity="' + alpha +
    '" stroke-width="0.7" points="' + pts(run) + '"/>';
}

/* ---------------------------------------------------------------- render */
function renderPanel(cam, ox) {
  const out = [];
  const faces = [];
  for (const mesh of scene.meshes) {
    if (mesh.hidden) continue;
    for (const f of mesh.faces) {
      if (f.hidden) continue;
      const vi = f.vi;
      let zsum = 0, zmin = Infinity, zmax = -Infinity, bad = false;
      const sp = new Array(vi.length);
      for (let i = 0; i < vi.length; i++) {
        const p = cam.to(mesh.verts[vi[i]]);
        if (!p) { bad = true; break; }
        sp[i] = p;
        zsum += p[2];
        if (p[2] < zmin) zmin = p[2];
        if (p[2] > zmax) zmax = p[2];
      }
      if (bad || zmax < NEAR) continue;
      // back-face culling for faces that opt in (walls, round forms)
      if (f.cull) {
        const a = mesh.verts[vi[0]], b = mesh.verts[vi[1]], c = mesh.verts[vi[2]];
        const eye = cam.eye;
        const e0 = M3.sub(a, eye), e1 = M3.sub(b, eye), e2 = M3.sub(c, eye);
        const nrm = M3.cross(M3.sub(e1, e0), M3.sub(e2, e0));
        if (M3.dot(nrm, e0) > 0) continue;
      }
      const zavg = zsum / vi.length;
      faces.push({ f, sp, key: zavg * 0.72 + zmin * 0.28, zavg, nv: vi.length });
    }
  }
  faces.sort((a, b) => b.key - a.key);

  for (const it of faces) {
    const f = it.f;
    const scr = it.sp.map((p) => [p[0] + ox, p[1]]);
    let fill = f.fill;
    if (fill && fill.charCodeAt(0) === 64) fill = THEME.mat[fill.slice(1)] || THEME.mat.paper;
    if (fill && f.shade) fill = G.tone(fill, f.shade, THEME.ink);
    const kind = f.kind || 'edge';
    const wgt = G.KIND_W[kind] || 1;
    const ink = G.KIND_INK[kind] === undefined ? 1 : G.KIND_INK[kind];
    const lw = Math.max(0.4, Math.min(6.2, wgt * Math.max(0.34, Math.min(2.5, REF / Math.max(0.35, it.zavg)))));
    const stroke = f.glow > 0 ? THEME.glow : THEME.line;
    const alpha = f.glow > 0 ? Math.min(1, f.glow) : ink;
    if (fill && it.nv >= 3) {
      out.push('<polygon fill="' + fill + '" fill-opacity="' + (f.fillAlpha || 1) +
        '" stroke="' + stroke + '" stroke-opacity="' + alpha + '" stroke-width="' + lw.toFixed(2) +
        '" stroke-linejoin="round" points="' + pts(scr) + '"/>');
      if (f.hatch) hatchLines(scr, f.hatch, out);
    } else {
      out.push('<polyline fill="none" stroke="' + stroke + '" stroke-opacity="' + alpha +
        '" stroke-width="' + lw.toFixed(2) + '" stroke-linejoin="round" stroke-linecap="round" points="' +
        pts(scr) + '"/>');
    }
  }
  return out;
}

/* ------------------------------------------------------------------ panels */
const PW = 760, PH = 560;
const CAM_A = makeCam([2.5, 1.42, 3.30], [0, 1.15, -0.35], PW, PH);      // CONTRACT.md §1
const CAM_R = mainCam(PW, PH);                                            // the real runtime view
const CAM_C = makeCam([1.55, 1.35, -0.15], [-0.25, 0.55, 2.05], PW, PH);

function svg(panels, labels) {
  const W = PW * panels.length, H = PH;
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
    '" viewBox="0 0 ' + W + ' ' + H + '">',
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + THEME.mat.paper + '"/>'];
  panels.forEach((p, i) => {
    parts.push('<g data-panel="' + i + '" data-w="' + PW + '" data-h="' + PH + '" data-x="' + (i * PW) + '">');
    parts.push(...p);
    parts.push('</g>');
  });
  parts.push('</svg>');
  fs.writeFileSync(path.join(HERE, 'lounge_preview.svg'), parts.join('\n'));
  return { W, H, labels };
}

/* --------------------------------------------- panel A: the contract camera */
const panelA = renderPanel(CAM_A, 0);

/* ------------- panel B: the real runtime camera (main.js, with the room) */
scene.meshes = allMeshes;
const panelB = renderPanel(CAM_R, PW);
scene.meshes = loungeMeshes;

/* --------------------- panel C: after clicking (door open, record playing) */
for (const o of registered) {
  if (o.id === 'cabinetDoor' || o.id === 'record' || o.id === 'cushionR') {
    if (o.onDown) o.onDown(ctxStub);
    if (o.onClick) o.onClick(ctxStub);
  }
}
for (let f = 0; f < 150; f++) {
  ctxStub.time += 1 / 60;
  for (const o of registered) if (o.update) o.update(1 / 60, ctxStub);
}
const CAM_C2 = makeCam([0.10, 1.62, 1.62], [-1.36, 0.80, 0.90], PW, PH);
const panelC = renderPanel(CAM_C2, PW * 2);

/* ------------------------- panel D: from the room, looking at the sofa front */
const panelD = renderPanel(CAM_C, PW * 3);

/* ------------------------------- panel E: the plan, with the room around it */
scene.meshes = allMeshes;
const CAM_E = makeCam([-0.10, 4.30, 1.35], [-0.10, 0.0, 1.36], PW, PH);
const panelE = renderPanel(CAM_E, PW * 4);
scene.meshes = loungeMeshes;

/* ------------------ panel F: into the open cabinet (the records are in there) */
const CAM_F = makeCam([-0.28, 0.66, 1.00], [-1.46, 0.40, 1.02], PW, PH);
const panelF = renderPanel(CAM_F, PW * 5);

const info = svg([panelA, panelB, panelC, panelD, panelE, panelF],
  ['A contract camera', 'B runtime camera', 'C after clicking', 'D sofa front', 'E plan', 'F cabinet']);
console.log('wrote _dev/lounge_preview.svg  ' + info.W + '×' + info.H +
  '  (A ' + panelA.length + ' el, B ' + panelB.length + ' el, C ' + panelC.length + ' el)');
