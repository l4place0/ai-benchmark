/* =============================================================================
   ceiling_preview.mjs — project js/ceiling.js with a small hand-written
   perspective projection, painter-sort by depth, and emit
   _dev/ceiling_preview.svg (rasterised to PNG by _dev/ceiling_raster.py).

   The SVG is deliberately restricted to <polygon>, <polyline> and <text> so the
   Python side can replay it exactly with Pillow.

   Run:  <node> _dev/ceiling_preview.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

globalThis.window = globalThis;
for (const f of ['math3d.js', 'scene.js', 'palette.js', 'anim.js', 'ceiling.js']) {
  (0, eval)(fs.readFileSync(path.join(root, 'js', f), 'utf8'));
}
const PLR = globalThis.PLR;
const M = globalThis.M3;

/* --------------------------------------------------------------- the build */
const scene = new PLR.Scene();
const registered = [];
const parts = {};
const env = { day: 0.82, hour: 21, minute: 47, second: 0, lightsOn: true, lampOn: false };
const ctxStub = {
  env,
  setEnv(p) { Object.assign(env, p); },
  audio: { play() {} },
  time: 0,
  anim: PLR.anim,
  toast() {},
  mesh: null,
  hover: false
};
PLR.ceilingBuild({
  scene, env, parts,
  register(o) { registered.push(o); return o; },
  toast() {},
  WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
  ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 }
});

/* ------------------------------------------------- put it in a nice pose -- */
const byId = id => registered.find(r => r.id === id);
const step = (n = 1) => {
  for (let i = 0; i < n; i++) {
    ctxStub.time += 1 / 60;
    for (const r of registered) r.update(1 / 60, ctxStub);
  }
};
env.lightsOn = true;
byId('fan').onClick(ctxStub);          // off → low
byId('fan').onClick(ctxStub);          // → medium
step(240);                             // 4 s: fan up to speed, lamp glowing
byId('clock').onClick(ctxStub);        // give the pendulum a wide swing
byId('chime').onClick(ctxStub);        // and ring the chimes
step(18);
/* land on a blade angle that reads as a fan and not as a cross */
const q = Math.PI / 2;
let guard = 0;
while (guard++ < 400) {
  const m = ((parts.fan.angle % q) + q) % q;
  if (m > 0.34 && m < 1.23) break;
  step(1);
}
let g2 = 0;
while (Math.abs(parts.clock.pend) < 0.20 && g2++ < 200) step(1);
console.log(`pose: fan angle ${parts.fan.angle.toFixed(3)} rad (omega ${parts.fan.omega.toFixed(2)}), ` +
  `pendulum ${parts.clock.pend.toFixed(3)} rad, chime tube ${parts.chime.tubeAmp.toFixed(3)}, ` +
  `pendant.on ${parts.pendant.on.toFixed(2)}`);

/* ------------------------------------------------------------------ theme */
const theme = PLR.palette.build(env);
const KW = PLR.geom.KIND_W, KI = PLR.geom.KIND_INK;
const KIND_HEX = { sil: '#191a22', edge: '#191a22', fine: '#191a22', soft: '#191a22', far: '#191a22' };
function resolveFill(f) {
  if (!f) return null;
  if (f[0] === '@') return theme.mat[f.slice(1)] || theme.mat.paper;
  return f;
}

/* ----------------------------------------------------------- world faces */
const FACES = [];      // { pts:[[x,y,z]..], fill, kind, glow }
function pushMesh(mesh) {
  for (const f of mesh.faces) {
    if (f.hidden) continue;
    const pts = f.vi.map(i => mesh.verts[i]);
    if (pts.length < 2) continue;
    FACES.push({ pts, fill: f.fill, kind: f.kind, glow: f.glow || 0, shade: f.shade || 0, src: mesh.name });
  }
}
for (const m of scene.meshes) pushMesh(m);
const CEILING_FACES = FACES.length;

/* context: shell + the neighbours' volumes, from CONTRACT.md §3 */
const SHELL = [], BOXY = [];
function quad(pts, fill, kind, shade) { return { pts, fill, kind: kind || 'fine', glow: 0, shade: shade || 0 }; }
function pushBox(list, cx, cy, cz, sx, sy, sz, fill) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy, y1 = cy + sy, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const F = [[3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4], [4, 7, 6, 5], [0, 1, 2, 3]];
  for (const f of F) list.push(quad(f.map(i => p[i]), fill, 'fine', 0.02));
}
const R = { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 };
SHELL.push(quad([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, 0, R.z1], [R.x0, 0, R.z1]], '@floor', 'fine'));
SHELL.push(quad([[R.x0, R.h, R.z0], [R.x1, R.h, R.z0], [R.x1, R.h, R.z1], [R.x0, R.h, R.z1]], '@ceiling', 'fine'));
SHELL.push(quad([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, R.h, R.z0], [R.x0, R.h, R.z0]], '@wall', 'sil'));
SHELL.push(quad([[R.x1, 0, R.z1], [R.x0, 0, R.z1], [R.x0, R.h, R.z1], [R.x1, R.h, R.z1]], '@wall', 'sil'));
SHELL.push(quad([[R.x0, 0, R.z0], [R.x0, 0, R.z1], [R.x0, R.h, R.z1], [R.x0, R.h, R.z0]], '@wall', 'sil'));
const W = { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20 };
SHELL.push(quad([[R.x1, 0, R.z0], [R.x1, 0, W.z0], [R.x1, R.h, W.z0], [R.x1, R.h, R.z0]], '@wall', 'sil'));
SHELL.push(quad([[R.x1, 0, W.z1], [R.x1, 0, R.z1], [R.x1, R.h, R.z1], [R.x1, R.h, W.z1]], '@wall', 'sil'));
SHELL.push(quad([[R.x1, 0, W.z0], [R.x1, 0, W.z1], [R.x1, W.y0, W.z1], [R.x1, W.y0, W.z0]], '@wall', 'sil'));
SHELL.push(quad([[R.x1, W.y1, W.z0], [R.x1, W.y1, W.z1], [R.x1, R.h, W.z1], [R.x1, R.h, W.z0]], '@wall', 'sil'));
SHELL.push(quad([[R.x1, W.y0, W.z0], [R.x1, W.y0, W.z1], [R.x1, W.y1, W.z1], [R.x1, W.y1, W.z0]], theme.mat.sky, 'fine'));

pushBox(BOXY, -0.58, 0, -2.42, 2.20, 1.92, 0.34, '@wood');      // bookcase
pushBox(BOXY, 1.32, 0, -1.05, 0.72, 0.76, 1.75, '@woodDark');   // desk
pushBox(BOXY, -0.10, 0, 2.12, 1.86, 0.80, 0.86, '@fabric');     // sofa
pushBox(BOXY, -0.10, 0, 1.02, 0.92, 0.42, 0.50, '@wood');       // coffee table
pushBox(BOXY, -1.32, 0, 0.92, 0.42, 0.90, 0.62, '@wood');       // sideboard
BOXY.push(quad([[-1.30, 0.006, 0.50], [1.10, 0.006, 0.50], [1.10, 0.006, 2.35], [-1.30, 0.006, 2.35]], '@rugAlt', 'fine'));

/* -------------------------------------------------------------- projection */
const FOV = 40, NEAR = 0.06, REF = 5.2;
function project(eye, target, W0, H0) {
  const view = M.lookAt(eye, target, [0, 1, 0]);
  const f = 1 / Math.tan((FOV * Math.PI / 180) / 2);
  const aspect = W0 / H0;
  return {
    W: W0, H: H0,
    eye: p => M.xformPoint(view, p),
    toScreen(p) {
      const d = -p[2];
      return [(p[0] * (f / aspect) / d) * 0.5 * W0 + W0 * 0.5,
        (0.5 - (p[1] * f / d) * 0.5) * H0, d];
    }
  };
}
function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = -a[2], db = -b[2];
    const ina = da >= NEAR, inb = db >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (NEAR - da) / (db - da);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

function renderPanel(cam, faces, ox, oy) {
  const out = [];
  for (const fc of faces) {
    const eyePts = fc.pts.map(cam.eye);
    let zmin = Infinity, zmax = -Infinity, anyFront = false;
    for (const p of eyePts) {
      const d = -p[2];
      if (d >= NEAR) anyFront = true;
      zmin = Math.min(zmin, d); zmax = Math.max(zmax, d);
    }
    if (!anyFront) continue;
    const cl = clipNear(eyePts);
    if (cl.length < 2) continue;
    let sum = 0;
    const scr = cl.map(p => { const s = cam.toScreen(p); sum += s[2]; return s; });
    const zavg = sum / scr.length;
    const key = zavg * 0.72 + Math.max(NEAR, zmin) * 0.28;
    const fill = resolveFill(fc.fill);
    const shaded = fill && fc.shade ? PLR.geom.tone(fill, fc.shade, theme.ink) : fill;
    const pts = scr.map(s => `${(s[0] + ox).toFixed(2)},${(s[1] + oy).toFixed(2)}`).join(' ');
    out.push({ key, pts, fill: shaded, kind: fc.kind, glow: fc.glow, n: scr.length });
  }
  out.sort((a, b) => b.key - a.key);
  const lines = [];
  for (const o of out) {
    if (o.fill) {
      lines.push(`<polygon points="${o.pts}" fill="${o.fill}"/>`);
    }
    if (o.kind && o.glow > 0) {
      const wgt = (KW[o.kind] || 1) * 1.15;
      lines.push(`<${o.fill ? 'polygon' : 'polyline'} points="${o.pts}" fill="none" stroke="${theme.glow}" stroke-opacity="${Math.min(1, o.glow).toFixed(2)}" stroke-width="${wgt.toFixed(2)}" stroke-linejoin="round"/>`);
    } else if (o.kind) {
      const wgt = KW[o.kind] || 1;
      const alpha = KI[o.kind] === undefined ? 1 : KI[o.kind];
      lines.push(`<${o.fill ? 'polygon' : 'polyline'} points="${o.pts}" fill="none" stroke="${KIND_HEX[o.kind] || '#191a22'}" stroke-opacity="${alpha}" stroke-width="${wgt.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------- the panels */
/* --zoom=a,b,c renders just those panels, larger, for close inspection */
const zoomArg = process.argv.find(a => a.startsWith('--zoom='));
const ZOOM = zoomArg ? zoomArg.slice(7).split(',').map(Number) : null;
const CELL_W = ZOOM ? 1180 : 1000, CELL_H = ZOOM ? 950 : 820;
/* dir = viewing direction (eye is placed along it, auto-framed to rx/ry) */
const PANELS = [
  { label: 'default camera (3.1,2.3,2.5) → (0,1.4,-0.3)', eye: [3.1, 2.3, 2.5], tgt: [0, 1.4, -0.3], all: true },
  { label: 'fan from the default camera', eye: [3.1, 2.3, 2.5], tgt: [0, 2.38, 0.30], rx: 0.80, ry: 0.40 },
  { label: 'ceiling fan from below', tgt: [0, 2.44, 0.30], dir: [0.52, -0.70, 0.62], rx: 0.80, ry: 0.34 },
  { label: 'ceiling fan 3/4', tgt: [0, 2.42, 0.30], dir: [0.72, 0.26, 0.65], rx: 0.80, ry: 0.34 },
  { label: 'pendant lamp', tgt: [0, 2.20, -0.90], dir: [0.40, 0.06, 0.92], rx: 0.30, ry: 0.44 },
  { label: 'clock (east wall)', tgt: [1.70, 2.03, 0.42], dir: [-1, 0.05, 0.02], rx: 0.20, ry: 0.34 },
  { label: 'big picture (north wall)', tgt: [-0.58, 1.72, -2.585], dir: [0.16, 0.0, 1], rx: 0.42, ry: 0.52 },
  { label: 'small picture (south wall)', tgt: [-1.10, 1.62, 2.585], dir: [0.12, 0.0, -1], rx: 0.30, ry: 0.26 },
  { label: 'wind chime', tgt: [1.42, 2.33, 1.30], dir: [-0.55, -0.15, -0.80], rx: 0.16, ry: 0.44 },
  { label: 'potted plant', tgt: [-1.34, 0.42, 1.86], dir: [0.66, 0.28, -0.70], rx: 0.34, ry: 0.44 },
  { label: 'wide: east wall, clock + window', tgt: [1.10, 1.95, -0.20], dir: [0.86, 0.02, 0.52], rx: 0.85, ry: 0.70 }
];
const COLS = 4, ROWS = ZOOM ? Math.ceil(ZOOM.length / COLS) : Math.ceil(PANELS.length / COLS);
const W_TOTAL = COLS * CELL_W, H_TOTAL = ROWS * CELL_H;
const F = 1 / Math.tan((FOV * Math.PI / 180) / 2);
function camOf(P, W0, H0) {
  if (P.eye) return { eye: P.eye, tgt: P.tgt };
  const dist = Math.max(P.ry * F, P.rx * (F / (W0 / H0))) * 1.10;
  const d = M.norm(P.dir);
  return { eye: [P.tgt[0] + d[0] * dist, P.tgt[1] + d[1] * dist, P.tgt[2] + d[2] * dist], tgt: P.tgt };
}

const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W_TOTAL}" height="${H_TOTAL}" viewBox="0 0 ${W_TOTAL} ${H_TOTAL}">`);
svg.push(`<rect width="${W_TOTAL}" height="${H_TOTAL}" fill="#e8e8ea"/>`);
const LIST = ZOOM ? ZOOM.map(i => PANELS[i]) : PANELS;
LIST.forEach((P, i) => {
  const col = i % COLS, row = (i / COLS) | 0;
  const ox = col * CELL_W, oy = row * CELL_H;
  svg.push(`<g id="panel-${i}">`);
  svg.push(`<polygon points="${ox},${oy} ${ox + CELL_W},${oy} ${ox + CELL_W},${oy + CELL_H} ${ox},${oy + CELL_H}" fill="#ffffff"/>`);
  const C = camOf(P, CELL_W, CELL_H);
  const cam = project(C.eye, C.tgt, CELL_W, CELL_H);
  /* the shell always sits behind everything inside the room */
  const shellOut = renderPanel(cam, SHELL.map(f => ({ pts: f.pts, fill: f.fill, kind: f.kind, glow: 0, shade: f.shade })), ox, oy);
  svg.push(`<g id="panel-${i}-shell">` + shellOut + `</g>`);
  const room = P.all ? FACES.concat(BOXY) : FACES;
  svg.push(`<g id="panel-${i}-body">` + renderPanel(cam, room, ox, oy) + `</g>`);
  svg.push('</g>');
  svg.push(`<text x="${ox + 10}" y="${oy + 20}" font-family="sans-serif" font-size="15" fill="#333">${i}: ${P.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
});
svg.push('</svg>');
fs.writeFileSync(path.join(here, 'ceiling_preview.svg'), svg.join('\n'));
console.log(`wrote _dev/ceiling_preview.svg (${W_TOTAL}x${H_TOTAL}), ceiling faces ${CEILING_FACES}, total pushed ${FACES.length}`);
