/* =============================================================================
   smoke_ceiling.mjs — self-test for js/ceiling.js (no browser available).

   Loads math3d / scene / palette / anim / ceiling exactly the way the page does
   (classic scripts, window === globalThis), builds the module against a stub
   sctx, then asserts geometry sanity and drives every interactive hard.

   Run:  <node> _dev/smoke_ceiling.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

globalThis.window = globalThis;
for (const f of ['math3d.js', 'scene.js', 'palette.js', 'anim.js', 'ceiling.js']) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  (0, eval)(src);
}
const PLR = globalThis.PLR;
if (!PLR || typeof PLR.ceilingBuild !== 'function') throw new Error('PLR.ceilingBuild missing');

/* ------------------------------------------------------------ assertions -- */
let pass = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; return true; }
  fails.push(msg);
  return false;
}
function near(a, b, eps, msg) { return ok(Math.abs(a - b) <= eps, `${msg} (got ${a}, want ${b}±${eps})`); }

const MATERIALS = new Set(['paper', 'wall', 'ceiling', 'floor', 'floorAlt', 'wood', 'woodDark',
  'metal', 'metalDark', 'fabric', 'fabricAlt', 'rug', 'rugAlt', 'accent', 'plant', 'screen']);
const KINDS = new Set(['sil', 'edge', 'fine', 'soft', 'far']);
const ROOMBOX = { x: [-1.75, 1.75], y: [-0.02, 2.75], z: [-2.65, 2.65] };
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function legalFill(f) {
  if (f === null || f === undefined) return true;
  if (typeof f !== 'string') return false;
  if (f[0] === '@') return MATERIALS.has(f.slice(1));
  return HEX.test(f);
}

/* ------------------------------------------------------------------ stub -- */
const toasts = [], sounds = [];
const scene = new PLR.Scene();
const registered = [];
const parts = {};
const env = { day: 1, hour: 21, minute: 47, second: 30, lightsOn: false, lampOn: false };
const ctxStub = {
  env,
  setEnv(patch) { Object.assign(env, patch); },
  audio: { play(name, opts) { sounds.push([name, opts || null]); } },
  time: 0,
  anim: PLR.anim,
  toast(t) { toasts.push(t); },
  mesh: null,
  hover: false
};
const sctx = {
  scene,
  env,
  parts,
  register(o) { registered.push(o); return o; },
  toast(t) { toasts.push(t); },
  WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
  ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 }
};

/* ------------------------------------------------------------------ build */
let built = true;
try {
  PLR.ceilingBuild(sctx);
} catch (e) {
  built = false;
  fails.push('build threw: ' + (e && e.stack || e));
}
ok(built, 'ceilingBuild did not throw');
ok(scene.meshes.length > 0, 'scene has meshes');

/* ------------------------------------------------- per-object face counts */
function groupOf(name) {
  if (!name) return 'other';
  if (name.startsWith('fan.')) return 'fan';
  if (name.startsWith('clock.')) return 'clock';
  if (name.startsWith('chime.')) return 'chime';
  if (name.startsWith('plant.')) return 'plant';
  if (name === 'pendant') return 'pendant';
  if (name === 'picture.big') return 'pictureBig';
  if (name === 'picture.small') return 'pictureSmall';
  return name;
}
const counts = {};
let totalFaces = 0, totalVerts = 0, lineFaces = 0, fillFaces = 0;
for (const m of scene.meshes) {
  const g = groupOf(m.name);
  counts[g] = (counts[g] || 0) + m.faces.length;
  totalFaces += m.faces.length;
  totalVerts += m.verts.length;
  for (const f of m.faces) (f.fill ? fillFaces++ : lineFaces++);
}
const FLOORS = { fan: 90, pendant: 60, clock: 110, pictureBig: 60, pictureSmall: 60, chime: 90, plant: 120 };

console.log('mesh                       group          faces  verts');
for (const m of scene.meshes) {
  console.log(`  ${String(m.name || '?').padEnd(24)} ${groupOf(m.name).padEnd(13)} ${String(m.faces.length).padStart(5)} ${String(m.verts.length).padStart(6)}`);
}
console.log('');
for (const [g, min] of Object.entries(FLOORS)) {
  ok((counts[g] || 0) >= min, `${g}: ${counts[g] || 0} faces < floor ${min}`);
}
ok(totalFaces >= 550, `module total ${totalFaces} faces < 550`);
ok(totalFaces <= 1250, `module total ${totalFaces} faces > 1250 (budget)`);
console.log(`TOTAL faces ${totalFaces} (fills ${fillFaces}, lines ${lineFaces}), verts ${totalVerts}, meshes ${scene.meshes.length}`);
console.log('per object: ' + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  '));

/* -------------------------------------------------------- geometry checks */
function checkMeshes(label) {
  let bad = 0, nan = 0, outside = 0, badIdx = 0, degen = 0, badFill = 0, badKind = 0, badFace = 0;
  const examples = [];
  for (const m of scene.meshes) {
    for (const v of m.verts) {
      for (let k = 0; k < 3; k++) if (!Number.isFinite(v[k])) nan++;
      if (!(v[0] >= ROOMBOX.x[0] && v[0] <= ROOMBOX.x[1] &&
            v[1] >= ROOMBOX.y[0] && v[1] <= ROOMBOX.y[1] &&
            v[2] >= ROOMBOX.z[0] && v[2] <= ROOMBOX.z[1])) {
        outside++;
        if (examples.length < 5) examples.push(`[${m.name}] vert ${JSON.stringify(v)}`);
      }
    }
    const n = m.verts.length;
    for (const f of m.faces) {
      if (!f.vi || f.vi.length < 3) { badFace++; continue; }
      for (const i of f.vi) if (!(Number.isInteger(i) && i >= 0 && i < n)) badIdx++;
      if (!legalFill(f.fill)) { badFill++; if (examples.length < 8) examples.push(`[${m.name}] fill ${f.fill}`); }
      if (f.kind && !KINDS.has(f.kind)) badKind++;
      /* degenerate: a filled face needs >= 3 distinct indices and real area */
      const uniq = new Set(f.vi);
      if (f.fill !== null && f.fill !== undefined) {
        if (uniq.size < 3) { degen++; continue; }
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < f.vi.length; i++) {
          const a = m.verts[f.vi[i]], b = m.verts[f.vi[(i + 1) % f.vi.length]];
          nx += (a[1] - b[1]) * (a[2] + b[2]);
          ny += (a[2] - b[2]) * (a[0] + b[0]);
          nz += (a[0] - b[0]) * (a[1] + b[1]);
        }
        if (Math.hypot(nx, ny, nz) < 1e-7) { degen++; if (examples.length < 12) examples.push(`[${m.name}] zero-area filled face`); }
      } else if (uniq.size < 2) {
        degen++;
      }
      for (const i of f.vi) { const v = m.verts[i]; if (v && (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2]))) nan++; }
    }
  }
  bad = nan + outside + badIdx + degen + badFill + badKind + badFace;
  ok(nan === 0, `${label}: ${nan} NaN/non-finite coords`);
  ok(outside === 0, `${label}: ${outside} verts outside the room box`);
  ok(badIdx === 0, `${label}: ${badIdx} invalid face indices`);
  ok(degen === 0, `${label}: ${degen} degenerate faces`);
  ok(badFill === 0, `${label}: ${badFill} illegal fills`);
  ok(badKind === 0, `${label}: ${badKind} illegal stroke kinds`);
  ok(badFace === 0, `${label}: ${badFace} faces with <3 indices`);
  if (examples.length) console.log('  e.g. ' + examples.join(' | '));
  return bad;
}
checkMeshes('initial');

/* ------------------------------------------------------------ interactives */
const ids = registered.map(r => r.id);
console.log('\nregistered: ' + ids.join(', '));
ok(ids.length === 7, `expected 7 interactives, got ${ids.length}`);
for (const want of ['fan', 'pendant', 'clock', 'pictureBig', 'pictureSmall', 'chime', 'plant']) {
  ok(ids.includes(want), `missing interactive "${want}"`);
}
const AX = ['x', 'y', 'z'];
for (const r of registered) {
  ok(!!r.mesh, `${r.id}: no mesh`);
  ok(!!r.hit && !!r.hit.min && !!r.hit.max, `${r.id}: no hit box`);
  if (r.hit && r.hit.min && r.hit.max) {
    for (let k = 0; k < 3; k++) {
      ok(r.hit.min[k] < r.hit.max[k], `${r.id}: hit.min[${k}] !< hit.max[${k}]`);
      ok(r.hit.min[k] >= ROOMBOX[AX[k]][0] - 0.001 && r.hit.min[k] <= ROOMBOX[AX[k]][1] + 0.001,
        `${r.id}: hit.min[${k}]=${r.hit.min[k]} outside room`);
      ok(r.hit.max[k] >= ROOMBOX[AX[k]][0] - 0.001 && r.hit.max[k] <= ROOMBOX[AX[k]][1] + 0.001,
        `${r.id}: hit.max[${k}]=${r.hit.max[k]} outside room`);
    }
  }
  ok(typeof r.onClick === 'function', `${r.id}: no onClick`);
  ok(typeof r.update === 'function', `${r.id}: no update`);
}
ok(registered.find(r => r.id === 'fan').dynamicHit === true, 'fan should be dynamicHit');
ok(registered.find(r => r.id === 'chime').dynamicHit === true, 'chime should be dynamicHit');
ok(registered.find(r => r.id === 'fan').priority === 3, 'fan pick priority should be 3');
ok(registered.find(r => r.id === 'pictureBig').priority === 1, 'pictureBig pick priority should be 1');
ok(registered.find(r => r.id === 'pictureSmall').priority === 1, 'pictureSmall pick priority should be 1');

/* --------------- staging / clearance facts other modules depend on ------- */
{
  const meshNamed = n => scene.meshes.find(m => m.name === n);
  /* 1. the big picture must not reach into the bookcase crown (max z <= -2.44) */
  const bigB = meshNamed('picture.big').getBounds();
  ok(bigB.max[2] <= -2.44, `picture.big max z ${bigB.max[2].toFixed(4)} must be <= -2.44 (bookcase crown)`);
  const smallB = meshNamed('picture.small').getBounds();
  ok(smallB.min[2] >= 2.44, `picture.small min z ${smallB.min[2].toFixed(4)} must be >= 2.44`);
  console.log(`picture.big z ${bigB.min[2].toFixed(3)}..${bigB.max[2].toFixed(3)} (bookcase crown front -2.218)`
    + ` | picture.small z ${smallB.min[2].toFixed(3)}..${smallB.max[2].toFixed(3)}`);

  /* 2. the fan must clear the ceiling plane (y = 2.72) with real margin */
  const spin = meshNamed('fan.spin');
  let bladeMaxY = -Infinity, bladeMinY = Infinity, tipR = 0;
  for (let i = 0; i < spin.__spinVertCount; i++) {          // hidden anchors excluded
    const v = spin.verts[i];
    bladeMaxY = Math.max(bladeMaxY, v[1]);
    bladeMinY = Math.min(bladeMinY, v[1]);
    tipR = Math.max(tipR, Math.hypot(v[0], v[2] - 0.30));
  }
  const statB = meshNamed('fan.static').getBounds();
  console.log(`fan blades y ${bladeMinY.toFixed(3)}..${bladeMaxY.toFixed(3)}, max radius ${tipR.toFixed(3)};`
    + ` whole fan top ${statB.max[1].toFixed(3)} (ceiling 2.72)`);
  ok(bladeMaxY <= 2.45, `blade tips reach y=${bladeMaxY.toFixed(3)} — too close to the ceiling`);
  ok(statB.max[1] <= 2.715, `fan hardware reaches y=${statB.max[1].toFixed(3)} — pokes through the ceiling`);
  ok(tipR <= 0.721, `blade tip radius ${tipR.toFixed(3)} exceeds the contract's 0.72`);

  /* 3. how far do the leaves actually reach? (door-clearance question) */
  const veg = meshNamed('plant.foliage');
  let vx0 = Infinity, vx1 = -Infinity, vz0 = Infinity, vz1 = -Infinity;
  for (let i = 0; i < veg.__vegVertCount; i++) {
    const v = veg.verts[i];
    vx0 = Math.min(vx0, v[0]); vx1 = Math.max(vx1, v[0]);
    vz0 = Math.min(vz0, v[2]); vz1 = Math.max(vz1, v[2]);
  }
  console.log(`plant foliage x ${vx0.toFixed(3)}..${vx1.toFixed(3)}, z ${vz0.toFixed(3)}..${vz1.toFixed(3)}`
    + ` (door clearance keeps leaves <= x -1.20)`);
  ok(vx1 <= -1.20, `foliage reaches x=${vx1.toFixed(3)}, further into the room than -1.20`);

  /* 3b. the west door leaf (hinge z=1.80, 0.94 long, 2.06 tall, opens inward).
         Checked two ways: the leaf's resting position at 72°, and the angle at
         which it first touches anything (the swing itself is unavoidable). */
  const HINGE = { x: -1.70, z: 1.80 }, LEAF_W = 0.94, LEAF_T = 0.04, LEAF_H = 2.06;
  function leafGap(mesh, count, deg) {
    const th = deg * Math.PI / 180;
    const dirX = Math.sin(th), dirZ = -Math.cos(th);
    const perpX = Math.cos(th), perpZ = Math.sin(th);
    let worst = Infinity, at = null;
    for (let i = 0; i < count; i++) {
      const v = mesh.verts[i];
      if (v[1] > LEAF_H) continue;
      const dx = v[0] - HINGE.x, dz = v[2] - HINGE.z;
      const d = dx * dirX + dz * dirZ;
      const s = dx * perpX + dz * perpZ;
      let gap;
      if (d < 0) gap = -d;
      else if (d > LEAF_W) gap = d - LEAF_W;
      else gap = Math.abs(s) - LEAF_T / 2;
      if (gap < worst) { worst = gap; at = [v[0].toFixed(3), v[1].toFixed(3), v[2].toFixed(3)]; }
    }
    return { gap: worst, at: at };
  }
  /* first angle (deg) at which the swept leaf would reach a vertex */
  function firstTouch(mesh, count) {
    let best = 90;
    for (let i = 0; i < count; i++) {
      const v = mesh.verts[i];
      if (v[1] > LEAF_H) continue;
      const dx = v[0] - HINGE.x, dz = v[2] - HINGE.z;
      if (dx <= 0 && dz >= 0) continue;
      const r = Math.hypot(dx, dz);
      if (r > LEAF_W || r < 0.06) continue;
      const phi = Math.atan2(dx, -dz) * 180 / Math.PI;    // 0° = closed, 90° = into the room
      if (phi > 0 && phi < best) best = phi;
    }
    return best;
  }
  const potM = meshNamed('plant.pot');
  const fg = leafGap(veg, veg.__vegVertCount, 72);
  const pg = leafGap(potM, potM.verts.length, 72);
  console.log(`door leaf at 72°: foliage gap ${fg.gap.toFixed(3)} m, pot gap ${pg.gap.toFixed(3)} m`
    + ` | first swept contact: foliage ${firstTouch(veg, veg.__vegVertCount).toFixed(1)}°,`
    + ` pot ${firstTouch(potM, potM.verts.length).toFixed(1)}°`);
  ok(fg.gap > 0.005, `foliage intersects the resting door leaf at 72° (gap ${fg.gap.toFixed(3)} m)`);
  ok(pg.gap > -0.02, `door leaf cuts ${(-pg.gap).toFixed(3)} m into the pot rim at 72°`);

  /* 4. blade shading: one silhouette, a soft under-side, fine rim edges */
  let under = 0, topEdge = 0, rimFine = 0;
  for (const f of spin.faces) {
    if (f.fill === '@paper') { under++; ok(f.kind === 'soft', 'blade underside must be stroked K.SOFT'); }
    if (f.fill === '@metal' && f.kind === 'edge' && f.vi.length === 11) topEdge++;
    if (f.fill === '@metalDark' && f.kind === 'fine' && f.vi.length === 4) rimFine++;
  }
  ok(under === 4, `expected 4 blade undersides, found ${under}`);
  ok(topEdge === 4, `expected 4 blade tops at K.EDGE, found ${topEdge}`);
  ok(rimFine >= 44, `expected at least 44 blade/iron rim faces at K.FINE, found ${rimFine}`);
  let heavyBlade = 0;
  for (const f of spin.faces) {
    if (f.vi.length === 11 && (f.kind === 'sil' || (f.kind === 'edge' && f.fill === '@paper'))) heavyBlade++;
  }
  ok(heavyBlade === 0, 'no blade face may pair a heavy outline with the light under-side fill');
}

/* ------------------------------------------------------------- parts API */
ok(!!parts.fan && !!parts.pendant && !!parts.clock && !!parts.chime && !!parts.plant,
  'sctx.parts missing one of fan/pendant/clock/chime/plant');
ok(Array.isArray(parts.pendant.pos) && parts.pendant.pos.length === 3, 'parts.pendant.pos must be [x,y,z]');
near(parts.pendant.pos[0], 0, 1e-9, 'parts.pendant.pos.x');
near(parts.pendant.pos[1], 2.05, 1e-9, 'parts.pendant.pos.y');
near(parts.pendant.pos[2], -0.90, 1e-9, 'parts.pendant.pos.z');
near(parts.pendant.radius, 0.26, 1e-9, 'parts.pendant.radius');
ok(typeof parts.pendant.on === 'number', 'parts.pendant.on must be numeric');

/* hit boxes must equal the mesh bounds where dynamicHit is used */
for (const r of registered) {
  if (!r.dynamicHit) continue;
  const b = r.mesh.getBounds();
  for (let k = 0; k < 3; k++) {
    const lo = r.hit.min[k], hi = r.hit.max[k];
    near(b.min[k], lo, 1e-6, `${r.id}: dynamic hit min[${k}] != mesh bounds`);
    near(b.max[k], hi, 1e-6, `${r.id}: dynamic hit max[${k}] != mesh bounds`);
  }
}

/* ================================ drive ================================== */
const snap = (m) => m.verts.map(v => v.slice());
const before = new Map(scene.meshes.map(m => [m.name, snap(m)]));
const beforeFanAngle = parts.fan ? parts.fan.angle : 0;

let threw = null;
try {
  for (let c = 0; c < 4; c++) for (const r of registered) r.onClick(ctxStub);
  for (const r of registered) if (r.onDown) r.onDown(ctxStub);
} catch (e) { threw = e; }
ok(!threw, 'onClick/onDown threw: ' + (threw && threw.stack));

/* fan: the required 4 clicks cycle it back to off; two more put it on
   "medium" — its blades must really turn, and the speed must ramp */
let fanMoved = 0;
{
  const fanReg = registered.find(r => r.id === 'fan');
  ok(parts.fan.level === 0, `4 clicks should cycle the fan back to off (level ${parts.fan.level})`);
  fanReg.onClick(ctxStub);
  fanReg.onClick(ctxStub);
  ok(parts.fan.level === 2, `fan should be on medium, level ${parts.fan.level}`);
  const m = scene.meshes.find(x => x.name === 'fan.spin');
  const a0 = parts.fan.angle;
  const w0 = parts.fan.omega;
  for (let i = 0; i < 60; i++) { ctxStub.time += 1 / 60; for (const r of registered) r.update(1 / 60, ctxStub); }
  ok(parts.fan.angle > a0 + 0.5, `fan angle did not advance (${a0} → ${parts.fan.angle})`);
  ok(parts.fan.omega > w0, 'fan omega should ramp up, not jump');
  ok(parts.fan.omega <= 4.6 + 1e-9, `fan omega overshot its target (${parts.fan.omega})`);
  fanMoved = parts.fan.angle - a0;
  const moved = m.verts.some((v, i) => Math.hypot(v[0] - before.get('fan.spin')[i][0], v[2] - before.get('fan.spin')[i][2]) > 1e-3);
  ok(moved, 'fan.spin vertices did not move');
}

/* long run: 900 frames @60fps = 15 s of animation */
let maxPend = 0, maxTube = 0, maxSway = 0, maxPlant = 0, boostSeen = 0;
threw = null;
try {
  for (let i = 0; i < 900; i++) {
    ctxStub.time += 1 / 60;
    for (const r of registered) r.update(1 / 60, ctxStub);
    if (!Number.isFinite(parts.fan.angle) || !Number.isFinite(parts.pendant.on)) throw new Error('NaN in parts');
    maxPend = Math.max(maxPend, Math.abs(parts.clock.pend));
    maxTube = Math.max(maxTube, Math.abs(parts.chime.tubeAmp));
    maxSway = Math.max(maxSway, Math.abs(parts.chime.sway));
    maxPlant = Math.max(maxPlant, Math.abs(parts.plant.sway));
    boostSeen = Math.max(boostSeen, Math.abs(parts.clock.pend));
  }
} catch (e) { threw = e; }
ok(!threw, 'update loop threw: ' + (threw && threw.stack));
ok(maxPend > 0.05, `pendulum barely moved (peak ${maxPend})`);
ok(maxPend <= 0.5, `pendulum exceeded ±0.5 rad (${maxPend})`);
ok(maxTube > 0.02 && maxTube <= 0.5, `chime tube amplitude out of bounds (${maxTube})`);
ok(maxSway > 0.005 && maxSway <= 0.5, `chime sway out of bounds (${maxSway})`);
ok(maxPlant > 0.001 && maxPlant <= 0.5, `plant sway out of bounds (${maxPlant})`);
checkMeshes('after 900 frames');

/* clock hands track the mocked environment */
function expectAngles(h, mi, s) {
  return [
    (((h % 12) + (mi + s / 60) / 60) % 12) * (Math.PI / 6),
    ((mi + s / 60) % 60) * (Math.PI / 30)
  ];
}
{
  env.hour = 21; env.minute = 47; env.second = 30;
  ctxStub.time = 1000;                       // t%1 === 0 → no sub-second term
  for (const r of registered) r.update(1 / 60, ctxStub);
  let [eh, em] = expectAngles(21, 47, 30);
  near(parts.clock.handHour, eh, 1e-6, 'hour hand @21:47:30');
  near(parts.clock.handMinute, em, 1e-6, 'minute hand @21:47:30');
  env.hour = 3; env.minute = 15; env.second = 0;
  ctxStub.time = 2000;
  for (const r of registered) r.update(1 / 60, ctxStub);
  [eh, em] = expectAngles(3, 15, 0);
  near(parts.clock.handHour, eh, 1e-6, 'hour hand @03:15:00');
  near(parts.clock.handMinute, em, 1e-6, 'minute hand @03:15:00');
  /* continuous, not jumping: a 1/60 s step moves the minute hand a hair */
  const m0 = parts.clock.handMinute;
  env.second = 1;
  ctxStub.time = 2001;
  for (const r of registered) r.update(1 / 60, ctxStub);
  const dm = Math.abs(parts.clock.handMinute - m0);
  ok(dm > 0 && dm < 0.01, `minute hand jumped by ${dm} rad in one frame`);
}

/* pendant glow follows the room light, softly */
{
  env.lightsOn = false;
  for (let i = 0; i < 120; i++) { ctxStub.time += 1 / 60; for (const r of registered) r.update(1 / 60, ctxStub); }
  ok(parts.pendant.on < 0.02, `pendant.on should be ~0 with lights off (${parts.pendant.on})`);
  env.lightsOn = true;
  for (let i = 0; i < 10; i++) { ctxStub.time += 1 / 60; for (const r of registered) r.update(1 / 60, ctxStub); }
  const mid = parts.pendant.on;
  ok(mid > 0.05 && mid < 0.997, `pendant.on should ramp softly, got ${mid} after 10 frames`);
  for (let i = 0; i < 120; i++) { ctxStub.time += 1 / 60; for (const r of registered) r.update(1 / 60, ctxStub); }
  ok(parts.pendant.on > 0.99, `pendant.on should reach 1 (${parts.pendant.on})`);
}

/* fan ramps, never snaps: after a stop click the omega decays smoothly */
{
  const fanReg = registered.find(r => r.id === 'fan');
  while (parts.fan.level !== 0) fanReg.onClick(ctxStub);
  fanReg.onClick(ctxStub);                            // off → low
  fanReg.onClick(ctxStub); fanReg.onClick(ctxStub);   // → high
  for (let i = 0; i < 120; i++) fanReg.update(1 / 60, ctxStub);   // let it spin up
  const w0 = parts.fan.omega;
  ok(w0 > 5.0, `fan should be near its high speed before stopping (omega ${w0})`);
  fanReg.onClick(ctxStub);                            // → off
  fanReg.update(1 / 60, ctxStub);
  ok(parts.fan.omega < w0, 'fan omega should start dropping when switched off');
  ok(parts.fan.omega > w0 * 0.9, `fan omega snapped instead of ramping (${w0} → ${parts.fan.omega})`);
  let frames = 0;
  while (parts.fan.omega > 0.01 && frames < 3000) { fanReg.update(1 / 60, ctxStub); frames++; }
  ok(frames > 60 && frames < 3000, `fan spin-down took ${frames} frames (should ramp, not snap)`);
}

/* the clock's pendulum really widens for a few seconds after a click */
{
  const clockReg = registered.find(r => r.id === 'clock');
  clockReg.onClick(ctxStub);
  let peak = 0;
  for (let i = 0; i < 260; i++) { ctxStub.time += 1 / 60; clockReg.update(1 / 60, ctxStub); peak = Math.max(peak, Math.abs(parts.clock.pend)); }
  ok(peak > 0.24, `boosted pendulum should exceed its calm amplitude (peak ${peak})`);
  ok(peak <= 0.5, `boosted pendulum exceeded ±0.5 rad (${peak})`);
  let calmPeak = 0;
  for (let i = 0; i < 300; i++) { ctxStub.time += 1 / 60; clockReg.update(1 / 60, ctxStub); calmPeak = Math.max(calmPeak, Math.abs(parts.clock.pend)); }
  ok(calmPeak <= 0.23, `pendulum should return to its calm amplitude (${calmPeak})`);
}

/* chime: click → a real ring, then quiet again */
{
  const chimeReg = registered.find(r => r.id === 'chime');
  const soundsBefore = sounds.length;
  chimeReg.onClick(ctxStub);
  let peak = 0;
  for (let i = 0; i < 200; i++) { ctxStub.time += 1 / 60; chimeReg.update(1 / 60, ctxStub); peak = Math.max(peak, Math.abs(parts.chime.tubeAmp)); }
  ok(peak > 0.2, `chime should ring hard when clicked (peak ${peak})`);
  ok(sounds.length > soundsBefore + 1, 'chime click should play a sound (and an echo)');
  let latePeak = 0;
  for (let i = 0; i < 200; i++) { ctxStub.time += 1 / 60; chimeReg.update(1 / 60, ctxStub); latePeak = Math.max(latePeak, Math.abs(parts.chime.tubeAmp)); }
  ok(latePeak < 0.09, `chime ring should decay away (${latePeak})`);
}

/* picture rock returns exactly to level */
{
  const pic = registered.find(r => r.id === 'pictureBig');
  const m = scene.meshes.find(x => x.name === 'picture.big');
  const restZ = m.getBounds().max[2];
  pic.onClick(ctxStub);
  let peakZ = restZ;
  for (let i = 0; i < 60; i++) { pic.update(1 / 60, ctxStub); peakZ = Math.max(peakZ, m.getBounds().max[2]); }
  ok(peakZ > restZ + 0.02, `clicked picture should rock off the wall (Δz ${(peakZ - restZ).toFixed(4)})`);
  ok(peakZ < restZ + 0.08, `picture rock should stay subtle (Δz ${(peakZ - restZ).toFixed(4)})`);
  for (let i = 0; i < 400; i++) pic.update(1 / 60, ctxStub);
  near(m.getBounds().max[2], restZ, 0.0015, 'picture should settle back to level');
}

/* plant shiver decays */
{
  const plant = registered.find(r => r.id === 'plant');
  plant.onClick(ctxStub);
  let peak = 0;
  for (let i = 0; i < 110; i++) { ctxStub.time += 1 / 60; plant.update(1 / 60, ctxStub); peak = Math.max(peak, Math.abs(parts.plant.sway)); }
  ok(peak > 0.018, `plant should shiver when clicked (peak ${peak})`);
  ok(peak < 0.06, `plant shiver should stay subtle (peak ${peak})`);
  /* ambient sway keeps it alive afterwards */
  let amb = 0;
  for (let i = 0; i < 600; i++) { ctxStub.time += 1 / 60; plant.update(1 / 60, ctxStub); amb = Math.max(amb, Math.abs(parts.plant.sway)); }
  ok(amb > 0.002, `plant should keep a slow ambient sway (${amb})`);
}

/* audio + toast coverage */
const soundNames = new Set(sounds.map(s => s[0]));
console.log('\nsounds played: ' + [...soundNames].join(', '));
console.log('toasts: ' + [...new Set(toasts)].join(' | '));
for (const s of ['fan', 'fanStop', 'switch', 'chime', 'plant', 'click']) {
  ok(soundNames.has(s), `expected sound "${s}" to be playable`);
}
ok(toasts.some(t => t.indexOf('吊扇') === 0), 'expected a fan toast');
ok(toasts.includes('灯亮了') && toasts.includes('灯灭了'), 'expected lamp toasts');
ok(toasts.includes('风铃响了'), 'expected chime toast');
ok(toasts.includes('叶子抖了抖'), 'expected plant toast');
ok(toasts.some(t => /^现在 \d\d:\d\d$/.test(t)), 'expected a clock toast with the time');

/* the fan's dynamic hit box must not pulse with the blade phase */
{
  const fanReg = registered.find(r => r.id === 'fan');
  const sizes = [];
  for (let i = 0; i < 24; i++) {
    ctxStub.time += 1 / 60;
    fanReg.update(1 / 60, ctxStub);
    const b = fanReg.mesh.getBounds();
    sizes.push(b.max[0] - b.min[0]);
  }
  const lo = Math.min(...sizes), hi = Math.max(...sizes);
  near(lo, hi, 1e-9, 'fan dynamic hit box must stay constant while spinning');
}

/* ------------------------------------------------------------------ report */
console.log('');
if (fails.length) {
  console.log(`FAILED ${fails.length} check(s), ${pass} passed:`);
  for (const f of fails) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log(`ALL OK — ${pass} checks passed.`);
  console.log(`fan spin after 1 s of "medium": ${fanMoved.toFixed(2)} rad; pendulum peak ${maxPend.toFixed(3)} rad; chime tube peak ${maxTube.toFixed(3)} rad`);
}
