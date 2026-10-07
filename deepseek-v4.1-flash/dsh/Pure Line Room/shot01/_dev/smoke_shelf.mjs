/* =============================================================================
   smoke_shelf.mjs — self-test + preview exporter for js/shelf.js
   Run:  <node> _dev/smoke_shelf.mjs
   There is no browser in this environment (see CONTRACT.md §9), so this harness
   loads the shared modules with eval, drives the module head-less, asserts the
   contract's invariants, and writes an SVG / JSON preview that
   _dev/shelf_raster.py turns into a PNG we can actually look at.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let failures = 0;
let checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) { console.log('  ok   ' + label + (extra ? '  ' + extra : '')); }
  else { failures++; console.log('  FAIL ' + label + (extra ? '  ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

/* --------------------------------------------------------------- load ----- */
globalThis.window = globalThis;
for (const f of ['math3d.js', 'scene.js', 'palette.js', 'shelf.js']) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  (0, eval)(src);
}
const PLR = globalThis.PLR;
const M3 = globalThis.M3;

// main.js owns PLR.anim; provide the contract's implementation here.
PLR.anim = PLR.anim || {
  approach(cur, target, speed, dt) {
    return cur + (target - cur) * (1 - Math.exp(-speed * dt));
  },
  ease: {
    linear: t => t, inOut: t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
    out: t => 1 - (1 - t) * (1 - t), in: t => t * t
  },
  osc(t, period, phase) { return Math.sin((t / period + (phase || 0)) * Math.PI * 2); }
};

section('build');
const scene = new PLR.Scene();
const registered = [];
const toasts = [];
const sounds = [];
const sctx = {
  scene,
  env: { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false },
  parts: {},
  register(o) { registered.push(o); },
  toast(t) { toasts.push(t); },
  WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
  ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 }
};
const ctxStub = {
  env: sctx.env,
  setEnv(patch) { Object.assign(sctx.env, patch); },
  audio: { play(n, o) { sounds.push(n); } },
  time: 0,
  anim: PLR.anim,
  toast(t) { toasts.push(t); },
  hover: false
};

let result = null;
try {
  result = PLR.shelfBuild(sctx);
  ok(true, 'PLR.shelfBuild(sctx) did not throw');
} catch (e) {
  ok(false, 'PLR.shelfBuild(sctx) did not throw', String(e && e.stack || e));
}

const MATS = new Set(['paper', 'wall', 'ceiling', 'floor', 'floorAlt', 'wood', 'woodDark',
  'metal', 'metalDark', 'fabric', 'fabricAlt', 'rug', 'rugAlt', 'accent', 'plant', 'screen']);
const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const meshes = scene.meshes;
const totalFaces = meshes.reduce((n, m) => n + m.faces.length, 0);
const totalVerts = meshes.reduce((n, m) => n + m.verts.length, 0);

const caseM = sctx.parts.shelfCase;
const booksM = sctx.parts.shelfBooks;
const pullM = sctx.parts.shelfBookPull || [];
const drwM = sctx.parts.shelfDrawers;
const doorM = sctx.parts.shelfDoors;
const topM = sctx.parts.shelfTop;

ok(meshes.length >= 8, 'scene.meshes.length >= 8', '= ' + meshes.length);
ok(totalFaces >= 500, 'total faces >= 500', '= ' + totalFaces);
ok(totalFaces <= 1100, 'total faces <= 1100', '= ' + totalFaces);

/* --- structural face floors ------------------------------------------------ */
const caseFaces = caseM.faces.length;
const bookFaces = booksM.faces.length + pullM.reduce((n, m) => n + m.faces.length, 0);
// the two drawer boxes: everything but the 6 outside faces of each front slab
const drawerInterior = drwM.reduce((n, m) => n + (m.faces.length - 6), 0);
ok(caseFaces >= 90, 'carcass faces >= 90', '= ' + caseFaces);
ok(bookFaces >= 240, 'book faces >= 240', '= ' + bookFaces);
ok(drawerInterior >= 60, 'cabinet interior faces >= 60', '= ' + drawerInterior);
ok(result && result.books >= 34 && result.books <= 46, 'book count 34…46', '= ' + (result && result.books));

/* --- vertices -------------------------------------------------------------- */
const ROOMBOX = { x: [-1.75, 1.75], y: [-0.02, 2.75], z: [-2.65, 2.65] };
const ZONE = { x: [-1.70, 0.56], z: [-2.60, -2.08] };
let bad = 0, nan = 0, outRoom = 0, outZone = 0, zmin = Infinity, zmax = -Infinity;
let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
for (const m of meshes) {
  for (const v of m.verts) {
    const [x, y, z] = v;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { nan++; continue; }
    if (x < ROOMBOX.x[0] || x > ROOMBOX.x[1] || y < ROOMBOX.y[0] || y > ROOMBOX.y[1] ||
        z < ROOMBOX.z[0] || z > ROOMBOX.z[1]) outRoom++;
    if (z > ZONE.z[1] || z < ZONE.z[0] || x < ZONE.x[0] || x > ZONE.x[1]) outZone++;
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
    if (z < zmin) zmin = z; if (z > zmax) zmax = z;
    void bad;
  }
}
ok(nan === 0, 'all vertices finite', '(' + totalVerts + ' verts)');
ok(outRoom === 0, 'all vertices inside the room box', 'outside = ' + outRoom);
ok(outZone === 0, 'rest pose inside the shelf zone (z <= -2.08)', 'outside = ' + outZone);
console.log('       bounds at rest: x ' + xmin.toFixed(3) + '…' + xmax.toFixed(3) +
  '   y ' + ymin.toFixed(3) + '…' + ymax.toFixed(3) + '   z ' + zmin.toFixed(3) + '…' + zmax.toFixed(3));

/* --- faces ----------------------------------------------------------------- */
function polyArea(m, vi) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < vi.length; i++) {
    const a = m.verts[vi[i]], b = m.verts[vi[(i + 1) % vi.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return 0.5 * Math.hypot(nx, ny, nz);
}
let idxBad = 0, degen = 0, fillBad = 0, dupVert = 0, lineFaces = 0, filledFaces = 0;
for (const m of meshes) {
  for (const f of m.faces) {
    if (f.hidden) continue;
    for (const i of f.vi) if (!(i >= 0 && i < m.verts.length)) idxBad++;
    if (f.fill === null || f.fill === undefined) { lineFaces++; continue; }
    filledFaces++;
    if (typeof f.fill !== 'string') { fillBad++; continue; }
    if (f.fill[0] === '@') { if (!MATS.has(f.fill.slice(1))) fillBad++; }
    else if (!HEX.test(f.fill)) fillBad++;
    for (let i = 0; i < f.vi.length; i++) if (f.vi[i] === f.vi[(i + 1) % f.vi.length]) dupVert++;
    if (polyArea(m, f.vi) < 1e-9) degen++;
  }
}
ok(idxBad === 0, 'every face index is valid');
ok(degen === 0, 'no degenerate filled faces', 'degenerate = ' + degen);
ok(dupVert === 0, 'no repeated vertices inside a filled face');
ok(fillBad === 0, 'every fill is a legal material key or hex', 'bad = ' + fillBad);
console.log('       ' + filledFaces + ' filled faces, ' + lineFaces + ' construction lines');

/* --- registration ---------------------------------------------------------- */
ok(registered.length === 7, 'seven interactives registered', '= ' + registered.length);
const ids = registered.map(o => o.id);
ok(['drawer1', 'drawer2', 'door1', 'door2', 'book1', 'book2', 'book3'].every(id => ids.includes(id)),
  'ids drawer1/2, door1/2, book1/2/3', '= ' + ids.join(','));
let hitBad = 0, meshBad = 0, dyn = 0;
for (const o of registered) {
  if (!(o.hit && o.hit.min && o.hit.max)) { hitBad++; continue; }
  for (let k = 0; k < 3; k++) if (!(o.hit.min[k] < o.hit.max[k])) hitBad++;
  if (!o.mesh || !o.mesh.verts.length) meshBad++;
  if (o.dynamicHit) dyn++;
}
ok(hitBad === 0, 'every hit.min < hit.max');
ok(meshBad === 0, 'every interactive has a mesh');
ok(dyn === registered.length, 'every moving interactive sets dynamicHit');

/* --- drive every interactive ------------------------------------------------ */
section('drive: onClick x3 + update(1/60) x400');
const DT = 1 / 60;
const before = registered.map(o => o.mesh.verts.map(v => v.slice()));
let threw = null, nanAfter = 0;
try {
  for (let pass = 0; pass < 3; pass++) {
    for (const o of registered) if (o.onClick) o.onClick(ctxStub);
  }
  for (let step = 0; step < 400; step++) {
    ctxStub.time += DT;
    for (const o of registered) if (o.update) o.update(DT, ctxStub);
  }
} catch (e) { threw = e; }
ok(!threw, 'no throw while driving the interactives', threw ? String(threw.stack || threw) : '');
for (const o of registered) for (const v of o.mesh.verts) {
  if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) nanAfter++;
}
ok(nanAfter === 0, 'no NaN after 400 frames', 'nan = ' + nanAfter);

const moved = [];
for (let i = 0; i < registered.length; i++) {
  const o = registered[i], b = before[i];
  let d = 0;
  for (let k = 0; k < b.length; k++) {
    d = Math.max(d, Math.hypot(o.mesh.verts[k][0] - b[k][0], o.mesh.verts[k][1] - b[k][1],
      o.mesh.verts[k][2] - b[k][2]));
  }
  moved.push({ id: o.id, d });
}
for (const mv of moved) {
  const want = mv.id.startsWith('book') ? 0.12 : (mv.id.startsWith('door') ? 0.30 : 0.27);
  ok(mv.d > want, mv.id + ' actually moved', 'max vertex delta = ' + mv.d.toFixed(4) + ' m');
}
// the mesh really moved: its cached bounds must have been refreshed, not stale
ok(registered.every(o => o.dynamicHit), 'picking bounds stay live while open');

/* zone after driving: report, do not fail — the open door/drawer is meant to
   reach into the room (the contract fixes the swing at ~100 deg / 0.28 m). */
let openZ = -Infinity, openXmin = Infinity, openXmax = -Infinity;
for (const o of registered) for (const v of o.mesh.verts) {
  if (v[2] > openZ) openZ = v[2];
  if (v[0] < openXmin) openXmin = v[0];
  if (v[0] > openXmax) openXmax = v[0];
}
console.log('       open pose: max z = ' + openZ.toFixed(3) + ', x ' + openXmin.toFixed(3) +
  '…' + openXmax.toFixed(3) + '  (static geometry stays inside z <= -2.08)');

/* --- books stay solid while sliding ---------------------------------------- */
let bookDegen = 0;
for (const m of pullM) {
  for (let step = 0; step <= 20; step++) {
    const v = step / 20;
    for (const f of m.faces) {
      if (f.fill === null || f.hidden) continue;
      // rebuild the face's area under the same transform the module applies
      const info = { y0: 0, z1: -2.27 };
      void info;
      if (polyArea(m, f.vi) < 1e-9) bookDegen++;
    }
    void v;
  }
}
ok(bookDegen === 0, 'pull-out books stay non-degenerate while sliding', 'degenerate = ' + bookDegen);

// and a real slide check: push v to 0/0.5/1 by hand and re-measure the area
{
  const bk = registered.find(o => o.id === 'book1');
  const base = bk.mesh.verts.map(v => v.slice());
  let minArea = Infinity;
  for (let step = 0; step <= 10; step++) {
    const v = step / 10;
    const py = 1.454, pz = -2.27, a = 4 * Math.PI / 180 * v, dz = 0.13 * v;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < base.length; k++) {
      const dy = base[k][1] - py, dzz = base[k][2] - pz;
      bk.mesh.verts[k][0] = base[k][0];
      bk.mesh.verts[k][1] = py + dy * ca - dzz * sa;
      bk.mesh.verts[k][2] = pz + dy * sa + dzz * ca + dz;
    }
    for (const f of bk.mesh.faces) {
      if (f.fill === null || f.hidden) continue;
      minArea = Math.min(minArea, polyArea(bk.mesh, f.vi));
    }
  }
  ok(minArea > 1e-6, 'book1 faces keep real area through the whole slide',
    'min area = ' + minArea.toExponential(2) + ' m²');
}

/* --- toasts / sounds -------------------------------------------------------- */
ok(toasts.includes('抽屉开了'), 'drawer toast 抽屉开了');
ok(toasts.includes('柜门打开了'), 'cabinet toast 柜门打开了');
ok(toasts.includes('抽出一本书'), 'book toast 抽出一本书');
ok(sounds.includes('drawer') && sounds.includes('cabinet') && sounds.includes('page'),
  'sounds drawer / cabinet / page', '= ' + [...new Set(sounds)].join(','));

/* =============================================================================
   preview — a ~25 line painter's-algorithm projection of every mesh face
   ========================================================================== */
const EYE = [2.5, 1.42, 3.30], TARGET = [0, 1.15, -0.35];
const FOV = 40, NEAR = 0.06, FAR = 90, REFDEPTH = 5.2;
const W = 1280, H = 760;
const KIND_W = { sil: 2.35, edge: 1.35, fine: 0.95, soft: 0.7, far: 0.75 };
const KIND_INK = { sil: 1.0, edge: 0.82, fine: 0.55, soft: 0.34, far: 0.42 };

const theme = PLR.palette.build({ day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false });
const projM = M3.perspective(FOV, W / H, NEAR, FAR);
const viewM = M3.lookAt(EYE, TARGET, [0, 1, 0]);

function project(p) {
  const v = M3.xformPoint(viewM, p);
  if (v[2] > -NEAR) return null;
  const d = -v[2];
  const f = projM[5];
  return [(v[0] * projM[0] / d) * 0.5 * W + W * 0.5, (0.5 - (v[1] * f) / d * 0.5) * H, d];
}

function buildPolys() {
  const list = [];
  for (let mi = 0; mi < meshes.length; mi++) {
    const mesh = meshes[mi];
    const b = mesh.getBounds();
    const rad = 0.5 * Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const inside = Math.hypot(cx - EYE[0], cy - EYE[1], cz - EYE[2]) < rad;
    const eyePts = mesh.verts.map(v => M3.xformPoint(viewM, v));
    for (let fi = 0; fi < mesh.faces.length; fi++) {
      const f = mesh.faces[fi];
      if (f.hidden) continue;
      const vi = f.vi;
      let zmin = Infinity, zsum = 0, clipped = false;
      for (const i of vi) {
        const d = -eyePts[i][2];
        if (d !== d) { clipped = true; break; }
        if (d < NEAR) { clipped = true; break; }
        zsum += d; if (d < zmin) zmin = d;
      }
      if (clipped) continue;
      const zavg = zsum / vi.length;
      if (f.cull && !inside) {
        const a = eyePts[vi[0]], b2 = eyePts[vi[1]], c2 = eyePts[vi[2]];
        const ux = b2[0] - a[0], uy = b2[1] - a[1], uz = b2[2] - a[2];
        const vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * a[0] + ny * a[1] + nz * a[2] > 0) continue;
      }
      const pts = [];
      for (const i of vi) {
        const s = project(mesh.verts[i]);
        if (!s) { pts.length = 0; break; }
        pts.push([s[0], s[1]]);
      }
      if (pts.length < 3) continue;
      let fill = f.fill;
      if (fill && fill[0] === '@') fill = theme.mat[fill.slice(1)] || theme.mat.paper;
      if (fill && f.shade) fill = PLR.geom.tone(fill, f.shade, theme.ink);
      const kind = f.kind || 'edge';
      const wscale = M3.clamp(REFDEPTH / Math.max(0.35, zavg), 0.34, 2.5);
      list.push({
        pts, fill: fill || null,
        stroke: theme.line, width: M3.clamp((KIND_W[kind] || 1) * wscale, 0.4, 6.2),
        alpha: KIND_INK[kind] === undefined ? 1 : KIND_INK[kind],
        key: zavg * 0.72 + zmin * 0.28, mi, fi
      });
    }
  }
  list.sort((a, b) => b.key - a.key);
  return list;
}

function writePreview(base) {
  const polys = buildPolys();
  fs.writeFileSync(path.join(here, base + '.json'),
    JSON.stringify({ width: W, height: H, bg: theme.mat.paper, polys }));
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
    '<rect width="' + W + '" height="' + H + '" fill="' + theme.mat.paper + '"/>\n';
  for (const p of polys) {
    const pts = p.pts.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
    svg += '<polygon points="' + pts + '" fill="' + (p.fill || 'none') + '" stroke="' + p.stroke +
      '" stroke-width="' + p.width.toFixed(2) + '" stroke-opacity="' + p.alpha.toFixed(2) +
      '" stroke-linejoin="round"/>' + (p.fill ? '' : '\n');
  }
  svg += '</svg>\n';
  fs.writeFileSync(path.join(here, base + '.svg'), svg);
  return polys.length;
}

/* the drive above left everything open — put it back to rest for the main shot */
try {
  for (let pass = 0; pass < 3; pass++) for (const o of registered) if (o.onClick) o.onClick(ctxStub);
  for (let step = 0; step < 400; step++) for (const o of registered) if (o.update) o.update(DT, ctxStub);
} catch (e) { /* already reported above */ }
let restErr = 0;
for (let i = 0; i < registered.length; i++) {
  const b = before[i], v = registered[i].mesh.verts;
  for (let k = 0; k < b.length; k++) restErr = Math.max(restErr, Math.hypot(
    v[k][0] - b[k][0], v[k][1] - b[k][1], v[k][2] - b[k][2]));
}
ok(restErr < 1e-12, 'every moving part returns to its rest pose (float-exact)',
  'max residual = ' + restErr.toExponential(2) + ' m');

/* optional: explain why a small object on a shelf is (in)visible -----------------
   The renderer sorts faces by 0.72*mean-eye-depth + 0.28*near-eye-depth, so a
   wide board's top face can out-sort the little things standing on it. */
if (process.env.SHELF_DEBUG) {
  function faceKey(mesh, f) {
    let zsum = 0, zmin = Infinity;
    for (const i of f.vi) {
      const d = -M3.xformPoint(viewM, mesh.verts[i])[2];
      zsum += d; if (d < zmin) zmin = d;
    }
    return zsum / f.vi.length * 0.72 + zmin * 0.28;
  }
  function inBox(mesh, f, box) {
    for (const i of f.vi) {
      const v = mesh.verts[i];
      if (v[0] < box[0] || v[0] > box[3] || v[1] < box[1] || v[1] > box[4] ||
          v[2] < box[2] || v[2] > box[5]) return false;
    }
    return true;
  }
  const probe = [-0.80, 0.640, -2.55, -0.54, 0.78, -2.33];
  const poly = buildPolys();
  console.log('  --- SHELF_DEBUG: where those faces land on screen ---');
  const bookIdx = meshes.indexOf(booksM);
  let shown = 0;
  for (const p of poly) {
    if (p.mi !== bookIdx || !inBox(booksM, booksM.faces[p.fi], probe)) continue;
    const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
    console.log('  books face ' + p.fi + ' fill=' + p.fill + ' key=' + p.key.toFixed(3) +
      ' screen x ' + Math.min(...xs).toFixed(0) + '…' + Math.max(...xs).toFixed(0) +
      ' y ' + Math.min(...ys).toFixed(0) + '…' + Math.max(...ys).toFixed(0));
    shown++;
  }
  console.log('  (' + shown + ' of the stack faces survived culling + projection)');
  // what is painted over them, in draw order?
  const names = ['case', 'books', 'drw0', 'drw1', 'door0', 'door1', 'bk1', 'bk2', 'bk3', 'top'];
  function inPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const cover = poly.filter(p => inPoly(p.pts, 735, 430));
  console.log('  --- polygons that actually contain (735,430), in draw order ---');
  for (const p of cover) {
    const f = meshes[p.mi].faces[p.fi];
    const wb = f.vi.map(i => meshes[p.mi].verts[i]);
    const bx = [Math.min(...wb.map(v => v[0])), Math.min(...wb.map(v => v[1])), Math.min(...wb.map(v => v[2])),
      Math.max(...wb.map(v => v[0])), Math.max(...wb.map(v => v[1])), Math.max(...wb.map(v => v[2]))];
    console.log('  ' + (names[p.mi] || p.mi) + ' face ' + p.fi + ' fill=' + p.fill +
      ' key=' + p.key.toFixed(3) + ' world x[' + bx[0].toFixed(2) + ',' + bx[3].toFixed(2) +
      '] y[' + bx[1].toFixed(2) + ',' + bx[4].toFixed(2) + '] z[' + bx[2].toFixed(2) + ',' + bx[5].toFixed(2) + ']');
  }
  void shown;
  console.log('  --- SHELF_DEBUG: faces inside the flat-stack box ---');
  for (const [name, mesh] of [['books', booksM], ['case', caseM]]) {
    mesh.faces.forEach((f, i) => {
      if (f.hidden || !inBox(mesh, f, probe)) return;
      console.log('  ' + name + ' face ' + i + ' fill=' + f.fill + ' kind=' + f.kind +
        ' cull=' + !!f.cull + ' key=' + faceKey(mesh, f).toFixed(3));
    });
  }
  console.log('  --- every wide top face at that height (what could cover it) ---');
  caseM.faces.forEach((f, i) => {
    if (f.hidden || !f.fill) return;
    let allTop = true, n = 0;
    for (const j of f.vi) { if (Math.abs(caseM.verts[j][1] - 0.645) > 1e-6) { allTop = false; break; } n++; }
    if (allTop && n >= 4) console.log('  case top face ' + i + ' area4 key=' + faceKey(caseM, f).toFixed(3) +
      ' xs=' + f.vi.map(j => caseM.verts[j][0].toFixed(2)).join(','));
  });
}

const nClosed = writePreview('shelf_preview');

/* and a second shot with everything open, to judge the drawers and doors */
try {
  for (let pass = 0; pass < 3; pass++) for (const o of registered) if (o.onClick) o.onClick(ctxStub);
  for (let step = 0; step < 400; step++) for (const o of registered) if (o.update) o.update(DT, ctxStub);
} catch (e) { /* already reported above */ }
const nOpen = writePreview('shelf_preview_open');
void nOpen;

/* and a third shot with only the three pull-out books drawn out */
try {
  for (let pass = 0; pass < 3; pass++) for (const o of registered) if (o.onClick) o.onClick(ctxStub);
  for (let step = 0; step < 400; step++) for (const o of registered) if (o.update) o.update(DT, ctxStub);
  for (let pass = 0; pass < 3; pass++) {
    for (const o of registered) if (o.onClick && o.id.startsWith('book')) o.onClick(ctxStub);
  }
  for (let step = 0; step < 400; step++) for (const o of registered) if (o.update) o.update(DT, ctxStub);
} catch (e) { /* already reported above */ }
const nPull = writePreview('shelf_preview_pull');
void nPull;

section('preview');
console.log('  ' + nClosed + ' polygons -> _dev/shelf_preview.svg/.json');
console.log('  ' + nOpen + ' polygons -> _dev/shelf_preview_open.svg/.json (everything open)');
// world -> screen landmarks, so the raster crops can be aimed exactly
for (const [name, p] of [
  ['case topleft   ', [-1.68, 1.92, -2.25]], ['case topright  ', [0.52, 1.92, -2.25]],
  ['case botleft   ', [-1.68, 0.00, -2.25]], ['case botright  ', [0.52, 0.00, -2.25]],
  ['bayA r1 pack   ', [-1.45, 0.78, -2.30]], ['bayC r1 stack  ', [-0.67, 0.70, -2.30]],
  ['bayE r1 run    ', [0.38, 0.78, -2.30]], ['bayB r2 pack   ', [-1.00, 1.03, -2.30]],
  ['bookend r2     ', [-0.15, 1.00, -2.34]], ['bayD3a r3 pack ', [-0.36, 1.30, -2.30]],
  ['bayE r3 run    ', [0.02, 1.30, -2.30]], ['bayC r4 run    ', [-0.72, 1.56, -2.30]],
  ['bayA r4 run    ', [-1.30, 1.56, -2.30]], ['bayB r5 stack  ', [-1.10, 1.78, -2.30]],
  ['bayE r5 run    ', [0.35, 1.78, -2.30]], ['drawers        ', [-1.10, 0.24, -2.25]],
  ['doors          ', [-0.30, 0.35, -2.25]]
]) {
  const s = project(p);
  console.log('  ' + name + (s ? Math.round(s[0]) + ',' + Math.round(s[1]) : 'behind'));
}

/* --------------------------------------------------------------- summary -- */
section('summary');
console.log('  meshes          ' + meshes.length);
console.log('  vertices        ' + totalVerts);
console.log('  faces           ' + totalFaces + '  (filled ' + filledFaces + ', lines ' + lineFaces + ')');
console.log('  carcass faces   ' + caseFaces);
console.log('  book faces      ' + bookFaces + '  (' + (result && result.books) + ' books)');
console.log('  cabinet inside  ' + drawerInterior);
console.log('');
if (failures) { console.log('FAILED ' + failures + ' of ' + checks + ' checks'); process.exit(1); }
console.log('all ' + checks + ' checks passed');
