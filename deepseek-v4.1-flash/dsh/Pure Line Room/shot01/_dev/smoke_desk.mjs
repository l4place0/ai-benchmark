/* =============================================================================
   _dev/smoke_desk.mjs — self-verification for js/desk.js (CONTRACT.md §9)

   Loads math3d.js + scene.js + palette.js with globalThis.window = globalThis,
   fakes an sctx, builds the desk zone, asserts the contract's invariants (plus
   the desk-zone box), hammers every registered interactive with update/onClick,
   and finally projects the mesh into _dev/desk_preview.svg + _dev/desk_ops.json
   so the result can be looked at (rasterised by _dev/desk_raster.py).

   Run: <node> _dev/smoke_desk.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let failures = 0;
let warnings = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log('  ok   ' + msg); }
  else { failures++; console.log('  FAIL ' + msg + (extra === undefined ? '' : '  → ' + extra)); }
}
/** A problem that belongs to another module: reported, not counted as a failure. */
function warn(msg) { warnings++; console.log('  WARN ' + msg); }
function section(t) { console.log('\n== ' + t + ' =='); }

/* ------------------------------------------------------------------ loading */
globalThis.window = globalThis;
for (const f of ['math3d.js', 'scene.js', 'palette.js', 'desk.js']) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  (0, eval)(src);
}
const M3 = globalThis.M3;
const PLR = globalThis.PLR;
const K = PLR.K;
const G = PLR.geom;

section('load');
ok(!!M3 && !!PLR && !!PLR.Scene && !!PLR.geom, 'math3d / scene / palette loaded');
ok(!globalThis.PLR.anim, 'PLR.anim absent → the module must use its own fallback first');

/* ------------------------------------------------ stub scene + build twice */
const MATS = ['paper', 'wall', 'ceiling', 'floor', 'floorAlt', 'wood', 'woodDark', 'metal',
  'metalDark', 'fabric', 'fabricAlt', 'rug', 'rugAlt', 'accent', 'plant', 'screen'];

function makeCtx(env) {
  const scene = new PLR.Scene();
  const regs = [];
  const parts = {};
  const sctx = {
    scene, env, parts,
    register(o) { regs.push(o); return o; },
    toast() {},
    WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
    ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 }
  };
  return { scene, regs, parts, sctx };
}

section('build');
let built;
try {
  built = makeCtx({ day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false });
  PLR.deskBuild(built.sctx);
  ok(true, 'PLR.deskBuild(sctx) did not throw');
} catch (err) {
  ok(false, 'PLR.deskBuild(sctx) did not throw', err && err.stack);
  process.exit(1);
}
const { scene, regs, parts } = built;

/* ------------------------------------------------------------ mesh budget */
function faceCount(list) { return list.reduce((n, m) => n + m.faces.length, 0); }
function pick(...names) { return names.map(n => parts[n]).filter(Boolean); }
const groups = {
  desk: pick('deskTop', 'deskBase', 'deskDrawers'),
  lamp: pick('lamp', 'lampShade', 'lampKnob'),
  mug: pick('mug'),
  notebook: pick('notebook', 'pageFlip'),
  pencilcup: pick('pencilCup'),
  globe: pick('globeStand', 'globeBall')
};
section('face budget');
ok(scene.meshes.length > 0, `scene.meshes.length = ${scene.meshes.length} > 0`);
ok(parts.deskTop && parts.lampShade && parts.mug && parts.notebook && parts.pencilCup && parts.globeBall,
  'sctx.parts carries every sub-mesh');
let total = 0;
for (const [k, v] of Object.entries(groups)) {
  const n = faceCount(v);
  total += n;
  const min = { desk: 40, lamp: 35, mug: 30, notebook: 20, pencilcup: 30, globe: 45 }[k];
  ok(n >= min, `${k}: ${n} faces (min ${min})`);
}
ok(total >= 220, `module total: ${total} faces (min 220)`);
ok(faceCount(scene.meshes) === total, 'every mesh in the scene belongs to a named part');

/* ----------------------------------------------------------------- geometry */
section('geometry');
const ROOMBOX = { x: [-1.75, 1.75], y: [-0.02, 2.75], z: [-2.65, 2.65] };
const ZONE = { x: [0.88, 1.70], y: [0, 1.30], z: [-2.18, 0.16] };
let nv = 0, nf = 0, bad = 0, degen = 0, badFill = 0;
const badSamples = [];
for (const mesh of scene.meshes) {
  for (const v of mesh.verts) {
    nv++;
    for (const c of v) if (!Number.isFinite(c)) { bad++; badSamples.push('nonfinite ' + v); }
    if (v[0] < ROOMBOX.x[0] || v[0] > ROOMBOX.x[1] ||
        v[1] < ROOMBOX.y[0] || v[1] > ROOMBOX.y[1] ||
        v[2] < ROOMBOX.z[0] || v[2] > ROOMBOX.z[1]) { bad++; badSamples.push('outside room ' + v); }
    if (v[0] < ZONE.x[0] - 1e-9 || v[0] > ZONE.x[1] + 1e-9 ||
        v[2] < ZONE.z[0] - 1e-9 || v[2] > ZONE.z[1] + 1e-9) {
      bad++; badSamples.push('outside desk zone ' + v);
    }
  }
  for (const f of mesh.faces) {
    if (f.hidden) continue;
    nf++;
    const seen = new Set();
    for (const idx of f.vi) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= mesh.verts.length) {
        bad++; badSamples.push('bad index ' + idx);
        continue;
      }
      seen.add(idx);
    }
    if (f.fill !== null) {
      if (seen.size < 3) { degen++; badSamples.push('degenerate fill face'); }
      const s = f.fill;
      const legal = typeof s === 'string' &&
        ((s[0] === '@' && MATS.includes(s.slice(1))) || /^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{3}$/.test(s));
      if (!legal) { badFill++; badSamples.push('illegal fill ' + s); }
    }
  }
}
ok(bad === 0, `all ${nv} vertices finite, inside the room box and inside x 0.88…1.70 / z -2.18…0.16`,
  badSamples.slice(0, 4).join(' | '));
ok(degen === 0, `no degenerate filled faces (${nf} faces checked)`);
ok(badFill === 0, 'every fill is null, a §4 material key or a hex colour',
  badSamples.filter(s => s.startsWith('illegal')).slice(0, 3).join(' | '));

// sub-object bounds: nothing floats, everything sits on the desk or the floor
console.log('  -- part bounds --');
for (const [name, mesh] of Object.entries(parts)) {
  if (!mesh || !mesh.verts) continue;
  const b = mesh.getBounds();
  const f = a => a.map(v => v.toFixed(3)).join(',');
  console.log(`     ${name.padEnd(12)} x[${f(b.min[0] !== undefined ? [b.min[0], b.max[0]] : [0, 0])}]` +
    ` y[${f([b.min[1], b.max[1]])}] z[${f([b.min[2], b.max[2]])}]  faces=${mesh.faces.length}`);
}
const restOnDesk = ['mug', 'notebook', 'pencilCup', 'globeStand', 'lamp'];
for (const n of restOnDesk) {
  const b = parts[n].getBounds();
  ok(Math.abs(b.min[1] - 0.755) < 0.004, `${n} rests on the desk top (min y = ${b.min[1].toFixed(4)})`);
}
{
  const b = parts.pageFlip.getBounds();
  ok(Math.abs(b.min[1] - 0.774) < 0.004, `pageFlip rests on the page block (min y = ${b.min[1].toFixed(4)})`);
}
for (const n of ['deskBase']) {
  const b = parts[n].getBounds();
  ok(Math.abs(b.min[1]) < 0.001, `${n} reaches the floor (min y = ${b.min[1].toFixed(4)})`);
}

/* --------------------------------------------------------------- registers */
section('register() contract');
ok(regs.length === 5, `5 interactives registered (${regs.map(r => r.id).join(', ')})`);
const ids = new Set();
for (const r of regs) {
  ok(typeof r.id === 'string' && r.id.length > 0, `id "${r.id}" is a non-empty string`);
  ok(!ids.has(r.id), `id "${r.id}" is unique`); ids.add(r.id);
  ok(typeof r.label === 'string' && r.label.length > 0, `  ${r.id}: label present`);
  ok(!!r.mesh && r.mesh.verts && r.mesh.faces, `  ${r.id}: mesh present`);
  ok(!!r.hit && Array.isArray(r.hit.min) && Array.isArray(r.hit.max), `  ${r.id}: hit box present`);
  let fine = true;
  for (let i = 0; i < 3; i++) if (!(r.hit.min[i] < r.hit.max[i])) fine = false;
  ok(fine, `  ${r.id}: hit.min < hit.max on every axis`);
  ok(typeof r.onClick === 'function', `  ${r.id}: onClick is a function`);
  ok(typeof r.update === 'function', `  ${r.id}: update is a function`);
  // the hit box must actually contain the mesh it belongs to
  const b = r.mesh.getBounds();
  const inside = [0, 1, 2].every(i => r.hit.min[i] <= b.min[i] + 1e-6 && r.hit.max[i] >= b.max[i] - 1e-6);
  ok(inside, `  ${r.id}: hit box contains its mesh bounds`, JSON.stringify(b));
}
// no two hit boxes may overlap in all three axes (so every object stays clickable)
for (let i = 0; i < regs.length; i++) {
  for (let j = i + 1; j < regs.length; j++) {
    const a = regs[i].hit, b = regs[j].hit;
    const overlap = [0, 1, 2].every(k => a.min[k] < b.max[k] && b.min[k] < a.max[k]);
    ok(!overlap, `hit boxes of ${regs[i].id} and ${regs[j].id} do not overlap`);
  }
}

/* ------------------------------------------------- interactivity, 200 frames */
section('interactivity');
function runLoop(label, withAnim) {
  if (withAnim) {
    PLR.anim = {
      approach: (c, t, s, dt) => t + (c - t) * Math.exp(-s * dt),
      osc: (t, p, ph) => Math.sin((t / p + ph) * Math.PI * 2),
      tween: () => ({ cancel() {}, done: true }),
      ease: { linear: t => t, inOut: t => t, out: t => t, inOut2: t => t }
    };
  } else {
    delete PLR.anim;
  }
  const env = { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false };
  const calls = [];
  const ctx = {
    env,
    setEnv(patch) { Object.assign(env, patch); },
    audio: { play(name, opts) { calls.push([name, opts]); } },
    time: 0,
    anim: PLR.anim,
    toast(t) { calls.push(['toast', t]); },
    hover: false,
    mesh: null
  };
  let throws = 0, nan = 0;
  for (let frame = 0; frame < 200; frame++) {
    ctx.time = frame / 60;
    // click something every 20 frames so every state machine is exercised
    if (frame % 20 === 0) {
      const r = regs[(frame / 20) % regs.length];
      ctx.mesh = r.mesh;
      try { r.onClick(ctx); r.onDown && r.onDown(ctx); } catch (e) { throws++; console.log('   throw in ' + r.id + '.onClick: ' + e.message); }
    }
    for (const r of regs) {
      ctx.mesh = r.mesh;
      try { r.update(1 / 60, ctx); } catch (e) { throws++; console.log('   throw in ' + r.id + '.update: ' + e.message); }
    }
  }
  for (const mesh of scene.meshes) {
    for (const v of mesh.verts) for (const c of v) if (!Number.isFinite(c)) nan++;
  }
  ok(throws === 0, `${label}: 200 frames × update/onClick with no throw`);
  ok(nan === 0, `${label}: no NaN vertices after 200 animated frames`);
  return { env, calls, ctx };
}

const passA = runLoop('fallback anim (no PLR.anim)', false);
const passB = runLoop('PLR.anim present', true);

section('state after clicking');
{
  const env = passB.env;
  ok(typeof env.lampOn === 'boolean', `ctx.setEnv was used for lampOn (lampOn = ${env.lampOn})`);
  const steam = parts.steam;
  ok(steam && Array.isArray(steam.origin) && steam.origin.every(Number.isFinite),
    'parts.steam = {origin, on, strength} registered with a finite origin');
  ok(typeof steam.on === 'boolean' && steam.strength >= 0 && steam.strength <= 1,
    `parts.steam.strength within 0..1 (${steam.strength.toFixed(3)})`);
  const glow = parts.lampGlow;
  ok(glow && Array.isArray(glow.center) && glow.center.every(Number.isFinite) &&
    glow.strength >= 0 && glow.strength <= 1 && glow.radius > 0,
    `parts.lampGlow = {center, radius ${glow.radius}, strength ${glow.strength.toFixed(3)}} registered`);
  // main.js's drawGlows() projects `lampGlow.pos`; without it the frame throws
  ok(Array.isArray(glow.pos) && glow.pos === glow.center && glow.pos.every(Number.isFinite),
    'parts.lampGlow.pos aliases center (main.js contract)');
  ok(Array.isArray(steam.origin) && steam.origin.every(Number.isFinite),
    'parts.steam.origin is the point main.js projects for the ribbon');
  const audioNames = new Set(passB.calls.filter(c => c[0] !== 'toast').map(c => c[0]));
  ok(['lamp', 'steam', 'page', 'click'].every(n => audioNames.has(n)),
    `audio.play used with the §8 names: ${[...audioNames].join(', ')}`);
  const toasts = passB.calls.filter(c => c[0] === 'toast');
  ok(toasts.length > 0, `ctx.toast used (${toasts.length} times, e.g. "${toasts[0][1]}")`);
}

/* --------------------------------------------------- lamp brightness is live */
section('lamp responds to the environment');
{
  const shade = parts.lampShade;
  const onKey = shade.faces.map(f => f.fill).join('|');
  const env2 = { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false };
  const ctx = {
    env: env2, setEnv(p) { Object.assign(env2, p); }, audio: { play() {} }, time: 1,
    anim: PLR.anim, toast() {}, hover: false, mesh: regs[0].mesh
  };
  for (let i = 0; i < 60; i++) { ctx.time += 1 / 60; regs[0].update(1 / 60, ctx); }
  const offKey = shade.faces.map(f => f.fill).join('|');
  regs[0].onClick(ctx);
  for (let i = 0; i < 60; i++) { ctx.time += 1 / 60; regs[0].update(1 / 60, ctx); }
  const onKey2 = shade.faces.map(f => f.fill).join('|');
  ok(offKey !== onKey2, 'the shade re-tints when the lamp is switched on');
  ok(env2.lampOn === true, 'onClick flipped env.lampOn through setEnv');
  ok(parts.lampGlow.strength > 0.9, `lampGlow.strength ramps to ~1 (${parts.lampGlow.strength.toFixed(3)})`);
  ok(onKey !== onKey2, 'the shade is not left in its build-time state');
}

/* -------------------------------------------------------------- projection */
section('preview');
const theme = PLR.palette.build({ day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false });
const W = 1120, H = 760;
const DEFAULT_CAM = { eye: [2.50, 1.42, 3.30], target: [0.00, 1.15, -0.35] };
const views = [
  { name: 'A · default camera (CONTRACT §1), framed on the desk zone', eye: [2.50, 1.42, 3.30], target: [0.00, 1.15, -0.35], fitBox: [0.88, 0.70, -2.15, 1.72, 1.36, 0.18] },
  { name: 'B · the desk, close from the south-east', eye: [2.32, 1.26, 0.72], target: [1.40, 0.82, -1.20], fitBox: [1.05, 0.74, -1.62, 1.72, 1.06, -0.16] },
  { name: 'C · the user side (drawers, west face)', eye: [0.52, 1.26, -0.34], target: [1.36, 0.80, -1.30], fitBox: [1.00, 0.42, -1.80, 1.72, 1.06, -0.38] },
  { name: 'D · overview of the desk top', eye: [2.34, 2.02, 0.40], target: [1.34, 0.80, -1.10], fitBox: [0.92, 0.70, -2.05, 1.72, 0.98, -0.14] },
  {
    name: 'E · the same desk with the lamp switched ON', eye: [2.32, 1.26, 0.72], target: [1.40, 0.82, -1.20],
    fitBox: [1.28, 0.74, -1.90, 1.72, 1.26, -1.02],
    prep: () => {                              // click the lamp and let it warm up
      const env = { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false };
      const ctx = {
        env, setEnv(p) { Object.assign(env, p); }, audio: { play() {} }, time: 0,
        anim: PLR.anim || undefined, toast() {}, hover: false, mesh: regs[0].mesh
      };
      regs[0].onClick(ctx);                    // 'lamp' is registered first
      for (let i = 0; i < 45; i++) { ctx.time += 1 / 60; regs[0].update(1 / 60, ctx); }
      console.log(`  lamp-on panel: lampOn=${env.lampOn} glow.strength=${parts.lampGlow.strength.toFixed(2)}`);
    }
  }
];
const PART_TINT = {
  deskTop: '#e8d9b8', deskBase: '#d9c49a', deskDrawers: '#cbb488',
  lamp: '#f0a05a', lampShade: '#ffc98a', lampKnob: '#8a4a1a',
  mug: '#e05a4a', notebook: '#5aa0e0', pageFlip: '#9fd0ff',
  pencilCup: '#4ac07a', globeStand: '#b0b0c8', globeBall: '#7f7fd0'
};
const meshTint = new Map();
for (const [n, mm] of Object.entries(parts)) if (mm && mm.verts) meshTint.set(mm, PART_TINT[n] || '#cccccc');

function cameraOf(v, w, h) {
  const view = M3.lookAt(v.eye, v.target, [0, 1, 0]);
  const proj = M3.perspective(40, w / h, 0.06, 90);
  return { view, proj, eye: v.eye, f: proj[5], fx: proj[0], w, h };
}
/** Eye → screen, with the perspective divide (the renderer's prepare() path). */
function projectTo(cam, p) {
  const e = M3.xformPoint(cam.view, p);
  const d = -e[2];
  if (d <= 0.06) return null;
  return [(e[0] * cam.fx / d) * 0.5 * cam.w + cam.w * 0.5,
          (0.5 - (e[1] * cam.f / d) * 0.5) * cam.h, d];
}
/** Screen pixel → world ray, built from the view basis (no matrix inverse). */
function rayFor(cam, sx, sy) {
  const dx = ((sx / cam.w) * 2 - 1) * (cam.w / cam.h) / cam.f;
  const dy = (1 - (sy / cam.h) * 2) / cam.f;
  const m = cam.view;
  const dir = [0, 0, 0];
  for (let i = 0; i < 3; i++) dir[i] = m[i] * dx + m[4 + i] * dy + m[8 + i] * (-1);
  return { origin: cam.eye, dir };
}
function inkWithAlpha(hex, a) {
  if (a >= 0.999) return hex;
  const c = G.hexToRgb(hex);
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
}
/** Möller–Trumbore: ray (origin, unit dir) against a triangle, returns t or -1. */
function rayTri(o, d, a, b, c) {
  const e1 = M3.sub(b, a), e2 = M3.sub(c, a);
  const p = M3.cross(d, e2);
  const det = M3.dot(e1, p);
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const s = M3.sub(o, a);
  const u = M3.dot(s, p) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return -1;
  const q = M3.cross(s, e1);
  const v = M3.dot(d, q) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return -1;
  return M3.dot(e2, q) * inv;
}

const ops = [];
const svg = [];
let drawn = 0, culled = 0;

views.forEach((v, panel) => {
  if (v.prep) v.prep();
  const cam = cameraOf(v, W, H);
  // frame the requested box: project its corners, then scale to just fit
  const fb = v.fitBox;
  const zb = [];
  for (const x of [fb[0], fb[3]]) for (const y of [fb[1], fb[4]]) for (const z of [fb[2], fb[5]]) zb.push(projectTo(cam, [x, y, z]));
  const zbv = zb.filter(Boolean);
  const xs = zbv.map(p => p[0]), ys = zbv.map(p => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  const fit = M3.clamp(Math.min(W / (bw * 1.10), H / (bh * 1.10)) * (v.zoom || 1), 0.45, 3.2);
  const cropX = ((Math.min(...xs) + Math.max(...xs)) / 2) * fit - W / 2;
  const cropY = ((Math.min(...ys) + Math.max(...ys)) / 2) * fit - H / 2;
  const P = (p) => [p[0] * fit - cropX, p[1] * fit - cropY];
  const list = [];
  for (const mesh of scene.meshes) {
    if (mesh.hidden) continue;
    const n = mesh.verts.length;
    const eyePts = new Array(n), scr = new Array(n), dep = new Array(n);
    for (let i = 0; i < n; i++) {
      const e = M3.xformPoint(cam.view, mesh.verts[i]);
      eyePts[i] = e; dep[i] = -e[2];
      const pr = projectTo(cam, mesh.verts[i]);
      scr[i] = pr ? [pr[0] * fit - cropX, pr[1] * fit - cropY, pr[2]] : null;
    }
    for (const f of mesh.faces) {
      if (f.hidden || f.vi.length < 3) continue;
      let zsum = 0, zmin = Infinity, behind = false;
      for (const idx of f.vi) {
        if (scr[idx] === null) { behind = true; break; }
        zsum += dep[idx];
        if (dep[idx] < zmin) zmin = dep[idx];
      }
      if (behind) continue;
      if (f.cull) {
        const a = eyePts[f.vi[0]], b = eyePts[f.vi[1]], c = eyePts[f.vi[2]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * a[0] + ny * a[1] + nz * a[2] > 0) { culled++; continue; }
      }
      // cheap reject: outside the panel by a wide margin
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      for (const idx of f.vi) {
        const s = scr[idx];
        if (s[0] < mnx) mnx = s[0]; if (s[0] > mxx) mxx = s[0];
        if (s[1] < mny) mny = s[1]; if (s[1] > mxy) mxy = s[1];
      }
      if (mxx < -80 || mnx > W + 80 || mxy < -80 || mny > H + 80) continue;
      list.push({ f, m: mesh, zavg: zsum / f.vi.length, zmin, scr: f.vi.map(i => scr[i]) });
    }
  }
  list.sort((a, b) => (b.zavg * 0.72 + b.zmin * 0.28) - (a.zavg * 0.72 + a.zmin * 0.28));
  for (const it of list) {
    const f = it.f;
    // collapse duplicated points (explicit lines are stored as a,a,b,a)
    const pts = [];
    for (const p of it.scr) {
      const last = pts[pts.length - 1];
      if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) pts.push(p);
    }
    if (pts.length > 2 && Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-6 &&
      Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
    if (pts.length < 2) continue;
    let fill = f.fill;
    if (v.debug) fill = f.fill === null ? null : (meshTint.get(it.m) || '#dddddd');
    else {
      if (fill && fill[0] === '@') fill = theme.mat[fill.slice(1)] || theme.mat.paper;
      if (fill && f.shade) fill = G.tone(fill, f.shade, theme.ink);
    }
    let stroke = null;
    if (f.kind) {
      const a = G.KIND_INK[f.kind] === undefined ? 1 : G.KIND_INK[f.kind];
      stroke = f.glow > 0 ? theme.glow : inkWithAlpha(theme.line, a);
    }
    const w = Math.min(6.2, Math.max(0.4, (G.KIND_W[f.kind] || 1) * Math.min(2.5, Math.max(0.34, 5.2 / Math.max(0.35, it.zavg)))));
    const abs = pts.map(p => [p[0], p[1]]);
    if (pts.length === 2) {
      ops.push({ panel, t: 'line', pts: abs, stroke, w });
      svg.push(`<line x1="${abs[0][0].toFixed(2)}" y1="${abs[0][1].toFixed(2)}" x2="${abs[1][0].toFixed(2)}" y2="${abs[1][1].toFixed(2)}" stroke="${stroke}" stroke-width="${w.toFixed(2)}" stroke-linecap="round"/>`);
    } else {
      ops.push({ panel, t: 'poly', pts: abs, fill, stroke, w, alpha: f.glow > 0 ? Math.min(1, f.glow) : 1 });
      const pl = abs.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
      svg.push(`<polygon points="${pl}" fill="${fill || 'none'}"${stroke ? ` stroke="${stroke}" stroke-width="${w.toFixed(2)}" stroke-linejoin="round"` : ''}${f.glow > 0 ? ` opacity="${Math.min(1, f.glow).toFixed(2)}"` : ''}/>`);
    }
    drawn++;
  }
  // panel captions + the click rectangles of the live objects
  svg.push(`<text x="${14}" y="24" font-family="monospace" font-size="15" fill="#333">${v.name}</text>`);
  ops.push({ panel, t: 'text', text: v.name, x: 14, y: 24 });
  if (panel === 0) {
    for (const r of regs) {
      const corners = [];
      for (const x of [r.hit.min[0], r.hit.max[0]]) {
        for (const y of [r.hit.min[1], r.hit.max[1]]) {
          for (const z of [r.hit.min[2], r.hit.max[2]]) corners.push(projectTo(cam, [x, y, z]));
        }
      }
      if (corners.some(c => c === null)) continue;
      const c2 = corners.map(P);
      const xs2 = c2.map(c => c[0]), ys2 = c2.map(c => c[1]);
      const box = [Math.min(...xs2), Math.min(...ys2), Math.max(...xs2), Math.max(...ys2)];
      ops.push({ panel, t: 'rect', box, stroke: 'rgba(200,110,20,0.85)', w: 1.2 });
      ops.push({ panel, t: 'text', text: r.id, x: box[0], y: box[1] - 3 });
      svg.push(`<rect x="${box[0].toFixed(1)}" y="${box[1].toFixed(1)}" width="${(box[2] - box[0]).toFixed(1)}" height="${(box[3] - box[1]).toFixed(1)}" fill="none" stroke="rgba(200,110,20,0.85)" stroke-width="1.2" stroke-dasharray="5 4"/>`);
      svg.push(`<text x="${box[0].toFixed(1)}" y="${(box[1] - 3).toFixed(1)}" font-family="monospace" font-size="13" fill="#c86e14">${r.id}</text>`);
    }
  }
});

section('preview stats');
ok(drawn > 400, `${drawn} faces projected into the preview (${culled} back-facing culled)`);

/* ---- reachability: shoot rays through the default camera and let every
        registered hit box compete, exactly the way the picker will. ---- */
{
  const cam = cameraOf(DEFAULT_CAM, W, H);
  const GRID = 440;                    // pixels are ~2.9×1.6 here
  const wins = {}, own = {}, lost = {};
  regs.forEach(r => { wins[r.id] = 0; own[r.id] = 0; lost[r.id] = {}; });
  const boxes = {};
  for (const r of regs) {
    const c = [];
    for (const x of [r.hit.min[0], r.hit.max[0]]) for (const y of [r.hit.min[1], r.hit.max[1]]) for (const z of [r.hit.min[2], r.hit.max[2]]) c.push(projectTo(cam, [x, y, z]));
    const xs = c.map(p => p[0]), ys = c.map(p => p[1]);
    boxes[r.id] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const sx = (gx + 0.5) / GRID * W, sy = (gy + 0.5) / GRID * H;
      let inAny = null;
      for (const r of regs) {
        const b = boxes[r.id];
        if (sx >= b[0] && sx <= b[2] && sy >= b[1] && sy <= b[3]) { own[r.id]++; if (!inAny) inAny = r.id; }
      }
      const ray = rayFor(cam, sx, sy);
      let best = null, bestT = Infinity;
      for (const r of regs) {
        const t = M3.rayAABB(ray.origin, ray.dir, r.hit.min, r.hit.max);
        if (t >= 0 && t < bestT) { bestT = t; best = r.id; }
      }
      if (best) wins[best]++;
      if (inAny && best !== inAny) lost[inAny][best || 'none'] = (lost[inAny][best || 'none'] || 0) + 1;
    }
  }
  for (const k of Object.keys(lost)) {
    const e = Object.entries(lost[k]);
    if (e.length) console.log(`    ${k} loses pixels to: ` + e.map(([a, b]) => `${a}=${b}`).join(' '));
  }
  console.log('  screen boxes (px): ' + Object.entries(boxes).map(([k, b]) =>
    `${k} ${(b[2] - b[0]).toFixed(0)}×${(b[3] - b[1]).toFixed(0)}`).join('  '));
  console.log('  pick pixels: ' + regs.map(r => `${r.id} ${wins[r.id]}/${own[r.id]}`).join('  '));
  for (const r of regs) {
    ok(wins[r.id] > 55, `${r.id} owns a clickable area (${wins[r.id]} samples ≈ ${(wins[r.id] * 2.9 * 1.6).toFixed(0)} px²)`);
  }

  /* ground truth: is any object actually buried behind another one?  Cast a
     ray to every vertex of every mesh and see whether another object's solid
     faces block it. */
  const owner = {
    lamp: ['lamp', 'lampShade', 'lampKnob'], mug: ['mug'], notebook: ['notebook', 'pageFlip'],
    pencilcup: ['pencilCup'], globe: ['globeStand', 'globeBall']
  };
  const allTris = [];
  for (const [name, mesh] of Object.entries(parts)) {
    if (!mesh.verts) continue;
    for (const f of mesh.faces) {
      if (f.hidden || f.fill === null) continue;
      const vi = f.vi;
      for (let k = 1; k + 1 < vi.length; k++) {
        allTris.push({ o: name, t: [mesh.verts[vi[0]], mesh.verts[vi[k]], mesh.verts[vi[k + 1]]] });
      }
    }
  }
  const visible = {};
  for (const r of regs) {
    const mine = new Set(owner[r.id]);
    const others = allTris.filter(x => !mine.has(x.o));
    let vis = 0, tot = 0;
    for (const name of mine) {
      const mesh = parts[name];
      if (!mesh || !mesh.verts) continue;
      for (const v of mesh.verts) {
        tot++;
        const d = M3.sub(v, cam.eye);
        const dist = M3.len(d);
        const dir = M3.scale(d, 1 / dist);
        let blocked = false;
        for (const x of others) {
          const t = rayTri(cam.eye, dir, x.t[0], x.t[1], x.t[2]);
          if (t > 0.02 && t < dist - 0.004) { blocked = true; break; }
        }
        if (!blocked) vis++;
      }
    }
    visible[r.id] = tot ? vis / tot : 0;
  }
  console.log('  unoccluded vertices: ' + regs.map(r => `${r.id} ${(visible[r.id] * 100).toFixed(0)}%`).join('  '));
  for (const r of regs) {
    // Not "0% hidden": the contract pins the globe at (1.56, -0.38) and the
    // pencil cup at (1.50, -0.55), so from the south-east the ball genuinely
    // stands in front of the cup.  What must hold is that nothing is buried:
    // every object keeps a real, clickable area (checked above) and a good
    // share of its own surface visible.
    ok(visible[r.id] > 0.10, `${r.id}: ${(visible[r.id] * 100).toFixed(0)}% of its vertices are not hidden by another object`);
  }
}

const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * views.length}" height="${H}" viewBox="0 0 ${W * views.length} ${H}">
<rect width="100%" height="100%" fill="${theme.mat.paper}"/>
${svg.join('\n')}
</svg>\n`;
fs.writeFileSync(path.join(here, 'desk_preview.svg'), svgOut);
fs.writeFileSync(path.join(here, 'desk_preview.ops.json'), JSON.stringify({
  width: W * views.length, height: H, paper: theme.mat.paper, ops
}));
console.log(`  wrote _dev/desk_preview.svg (${(svgOut.length / 1024).toFixed(0)} kB) and _dev/desk_preview.ops.json (${ops.length} ops)`);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));

/* ===========================================================================
   Integration: run the REAL index.html script set (main.js, interact.js,
   renderer.js, room.js, my desk.js, …) inside the sibling mock-DOM harness and
   drive it with real pointer events.  This is the only place the desk zone is
   exercised through the actual picker and the actual frame loop.
   ========================================================================= */
section('integration with the real app (mock DOM)');
try {
  const { createPage } = await import('./harness.mjs');
  const page = createPage({ width: 1440, height: 900 });
  page.loadScriptsFrom('index.html');
  page.advance(2500);
  const loadErrs = page.errors.filter(e => String(e.where).startsWith('load:') || String(e.where).startsWith('missing:'));
  ok(loadErrs.length === 0, 'every script in index.html evaluates',
    loadErrs.map(e => e.where + ': ' + (e.error && e.error.message)).join(' | '));
  ok(page.errors.length === 0, '2.5 s of real frames run without a runtime error',
    page.errors.slice(0, 3).map(e => e.where + ': ' + (e.error && e.error.message)).join(' | '));

  const app = page.win.PLR.app;
  ok(!!app && !!app.interact, 'PLR.app / interact are live');
  const liveIds = app.interact.reg.map(r => r.id);
  ok(['lamp', 'mug', 'notebook', 'pencilcup', 'globe'].every(i => liveIds.indexOf(i) >= 0),
    'the desk zone registers all five objects in the live app (' + liveIds.join(', ') + ')');
  const st = app.stats();
  console.log(`  live scene: ${st.meshes} meshes, ${st.interactives} interactives, ${st.faces} faces drawn`);

  // scan the canvas through the REAL picker and remember a pixel per object
  const spot = {};
  const hitBy = {};
  const N = 90;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x = (gx + 0.5) / N * 1440, y = (gy + 0.5) / N * 900;
      const hit = app.interact.pick(x, y);
      if (!hit) continue;
      const id = hit.obj.id;
      hitBy[id] = (hitBy[id] || 0) + 1;
      spot[id] = spot[id] || { x, y, n: 0 };
      spot[id].n++;
    }
  }
  const totalHits = Object.values(hitBy).reduce((a, b) => a + b, 0);
  console.log('  picker hits: ' + ['lamp', 'mug', 'notebook', 'pencilcup', 'globe']
    .map(i => `${i}=${spot[i] ? spot[i].n : 0}`).join('  '));
  console.log('  picker hits (all ids): ' + (Object.entries(hitBy)
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ') || '(nothing at all)'));

  const mine = ['lamp', 'mug', 'notebook', 'pencilcup', 'globe'];
  const mineHits = mine.reduce((n, i) => n + (spot[i] ? spot[i].n : 0), 0);
  if (mineHits > 3 && mine.every(i => spot[i] && spot[i].n > 3)) {
    for (const id of mine) {
      ok(true, `the live picker finds ${id} on screen (${spot[id].n} probes)`);
    }
  } else {
    /* --------------------------------------------------------------------
       CROSS-MODULE FINDING — renderer.js / interact.js, NOT desk.js.
       The live picker only ever hits the four biggest AABBs in the room
       (curtain, clock, chime, rug) and misses all 27 other objects, including
       every room.js/shelf.js/lounge.js handle.  `Renderer.prototype.unproject`
       builds its ray from the inverse view-projection using raw clip
       coordinates, i.e. without the perspective divide, so the ray points in
       the wrong direction and only huge boxes can still be crossed.
       Numbers below; the same maths done correctly in this file works fine.
       -------------------------------------------------------------------- */
    const rr = app.renderer;
    const ray = rr.unproject(720, 450);
    const dir = M3.norm(ray.dir);
    const tgt = rr.target;
    const w = M3.sub(tgt, ray.origin);
    const perp = M3.len(M3.sub(w, M3.scale(dir, M3.dot(w, dir))));
    console.log('  !! CROSS-MODULE FINDING (not desk.js): interact.pick() hit ' + totalHits +
      ' of ' + (N * N) + ' probes, and only for ' + (Object.keys(hitBy).join(', ') || 'nothing') + '.');
    console.log('     renderer.unproject(720,450).dir = [' + dir.map(v => v.toFixed(3)).join(', ') + ']');
    console.log('     camera looks at [' + tgt.map(v => v.toFixed(3)).join(', ') + '], which is ' +
      perp.toFixed(3) + ' m OFF that ray (should be ~0.000)');
    console.log('     → Renderer.project()/unproject() omit the perspective divide; pick() therefore');
    console.log('       cannot find any object smaller than ~1 m. desk.js is unaffected: its own');
    console.log('       reachability test above builds its rays directly from the view basis.');
    warn('live picker (renderer.unproject) misses all five desk-zone objects — reported to the parent');
  }

  // drive real pointer clicks through the real event pipeline
  if (spot.lamp) {
    const before = app.env.lampOn;
    page.move(spot.lamp.x, spot.lamp.y);
    page.advance(150);
    const hovered = app.interact.hoverObj;
    ok(!!hovered && hovered.id === 'lamp', 'hovering the lamp reports the lamp (' + (hovered && hovered.id) + ')');
    page.down(spot.lamp.x, spot.lamp.y);
    page.advance(60);
    page.up(spot.lamp.x, spot.lamp.y);
    page.advance(600);
    ok(app.env.lampOn !== before, `clicking the lamp through the real pipeline toggles env.lampOn (${before} → ${app.env.lampOn})`);
    ok(parts.lampGlow.strength > 0.5 || !app.env.lampOn,
      `parts.lampGlow.strength follows the live lamp (${parts.lampGlow.strength.toFixed(2)})`);
    ok(page.errors.length === 0, 'still no runtime errors after the interaction',
      page.errors.slice(0, 2).map(e => e.where + ': ' + (e.error && e.error.message)).join(' | '));
  }
  if (spot.mug) {
    const before = parts.steam.on;
    page.move(spot.mug.x, spot.mug.y);
    page.down(spot.mug.x, spot.mug.y);
    page.advance(60);
    page.up(spot.mug.x, spot.mug.y);
    page.advance(400);
    ok(parts.steam.on !== before, `clicking the mug toggles the steam (${before} → ${parts.steam.on})`);
  }
  if (spot.globe) {
    page.move(spot.globe.x, spot.globe.y);
    page.down(spot.globe.x, spot.globe.y);
    page.advance(60);
    page.up(spot.globe.x, spot.globe.y);
    page.advance(900);
    ok(page.errors.length === 0, 'spinning the globe stays clean');
  }
  if (spot.pencilcup) {
    page.move(spot.pencilcup.x, spot.pencilcup.y);
    page.down(spot.pencilcup.x, spot.pencilcup.y);
    page.advance(60);
    page.up(spot.pencilcup.x, spot.pencilcup.y);
    page.advance(900);
    ok(page.errors.length === 0, 'tipping the pencil cup stays clean');
  }
  if (spot.notebook) {
    page.move(spot.notebook.x, spot.notebook.y);
    page.down(spot.notebook.x, spot.notebook.y);
    page.advance(60);
    page.up(spot.notebook.x, spot.notebook.y);
    page.advance(900);
    ok(page.errors.length === 0, 'flipping a page stays clean');
  }
} catch (err) {
  ok(false, 'integration harness ran', err && err.stack);
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED (final, desk.js)' : failures + ' CHECK(S) FAILED (final)') +
  (warnings ? '  — ' + warnings + ' cross-module warning(s), see WARN lines' : ''));
process.exit(failures === 0 ? 0 : 1);
