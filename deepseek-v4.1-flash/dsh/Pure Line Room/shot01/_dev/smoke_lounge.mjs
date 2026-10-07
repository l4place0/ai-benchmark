/* =============================================================================
   _dev/smoke_lounge.mjs — headless self-test for js/lounge.js
   Run: <node> _dev/smoke_lounge.mjs
   Loads the real room runtime files with globalThis.window = globalThis, fakes
   an sctx, builds the lounge module and then hammers it: geometry sanity,
   registration contract, every click, a full synthetic drag and 600 frames of
   animation.  Exits non-zero on the first failed assertion.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ------------------------------------------------------------ tiny harness */
let failures = 0, checks = 0;
const notes = [];
function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error('  FAIL  ' + msg); }
  return !!cond;
}
function note(msg) { notes.push(msg); }

/* ------------------------------------------------------------- load runtime */
globalThis.window = globalThis;
const FILES = ['js/math3d.js', 'js/scene.js', 'js/palette.js', 'js/anim.js'];
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(src);
  } catch (e) {
    console.error('failed loading ' + f + ': ' + e.message);
    process.exit(1);
  }
}
const PLR = globalThis.PLR;
const M3 = globalThis.M3;
ok(!!PLR && !!PLR.geom && !!PLR.Scene && !!PLR.palette && !!PLR.anim, 'runtime files expose PLR/M3');

/* ------------------------------------------------------------------ sctx */
const registered = [];
const scene = new PLR.Scene();
const env = { day: 1, hour: 12, minute: 0, lightsOn: false, lampOn: false };
const sctx = {
  scene,
  env,
  parts: {},
  WIN: { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: 1.70 },
  ROOM: { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 },
  toast: () => {},
  register: (o) => { registered.push(o); return o; }
};
const ctxStub = {
  env, time: 0, hover: false, anim: PLR.anim, mesh: null,
  setEnv: (p) => Object.assign(env, p),
  audio: { play: () => {} },
  toast: () => {}
};

/* -------------------------------------------------------------------- load */
const loungeSrc = fs.readFileSync(path.join(ROOT, 'js', 'lounge.js'), 'utf8');
(0, eval)(loungeSrc);
ok(typeof PLR.loungeBuild === 'function', 'PLR.loungeBuild is a function');

/* ------------------------------------------------------------------- build */
let buildErr = null;
try { PLR.loungeBuild(sctx); } catch (e) { buildErr = e; }
ok(!buildErr, 'loungeBuild did not throw' + (buildErr ? ' — ' + buildErr.stack : ''));
if (buildErr) process.exit(1);

ok(scene.meshes.length > 0, 'scene.meshes.length > 0');
ok(registered.length === 7, 'registered 7 interactives (got ' + registered.length + ')');

/* ------------------------------------------------------------- invariants */
const MATS = ['@paper', '@wall', '@ceiling', '@floor', '@floorAlt', '@wood', '@woodDark',
  '@metal', '@metalDark', '@fabric', '@fabricAlt', '@rug', '@rugAlt', '@accent', '@plant', '@screen'];
const BOX = { x0: -1.75, x1: 1.75, y0: -0.02, y1: 2.75, z0: -2.65, z1: 2.65 };
const hexOK = (h) => /^#[0-9a-fA-F]{6}$/.test(h) || /^#[0-9a-fA-F]{3}$/.test(h);

let totalFaces = 0, totalVerts = 0, lines = 0, filled = 0;
let minY = Infinity, maxY = -Infinity;
for (const m of scene.meshes) {
  for (const v of m.verts) {
    totalVerts++;
    if (!ok(Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]),
      'vertex is finite: ' + JSON.stringify(v))) break;
    if (v[1] < minY) minY = v[1];
    if (v[1] > maxY) maxY = v[1];
    ok(v[0] >= BOX.x0 && v[0] <= BOX.x1, 'vertex x in room box: ' + v[0]);
    ok(v[1] >= BOX.y0 && v[1] <= BOX.y1, 'vertex y in room box: ' + v[1]);
    ok(v[2] >= BOX.z0 && v[2] <= BOX.z1, 'vertex z in room box: ' + v[2]);
  }
  for (const f of m.faces) {
    if (f.hidden) continue;
    totalFaces++;
    ok(Array.isArray(f.vi) && f.vi.length >= 2, 'face has >= 2 indices');
    for (const ix of f.vi) ok(Number.isInteger(ix) && ix >= 0 && ix < m.verts.length,
      'face index valid: ' + ix);
    const uniq = new Set(f.vi);
    if (f.fill === null || f.fill === undefined) {
      lines++;
      ok(uniq.size >= 2, 'line face has two distinct endpoints');
    } else {
      filled++;
      ok(uniq.size === f.vi.length, 'filled face has no duplicate indices');
      ok(uniq.size >= 3, 'filled face has >= 3 vertices');
      // non-degenerate: Newell area must be non-zero
      const n = M3.polyNormal(m.verts, f.vi);
      const area = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      ok(area > 1e-9, 'filled face is not degenerate (area ' + area.toFixed(6) + ')');
      ok(f.fill.charAt(0) === '@' ? MATS.indexOf(f.fill) >= 0 : hexOK(f.fill),
        'legal fill: ' + f.fill);
    }
  }
}
note('meshes ' + scene.meshes.length + ' · faces ' + totalFaces +
  ' (filled ' + filled + ', line ' + lines + ') · verts ' + totalVerts);
note('y range of all vertices: ' + minY.toFixed(3) + ' … ' + maxY.toFixed(3));

/* ------------------------------------------------- per-object face floors */
const parts = sctx.parts;
const count = (...ms) => ms.reduce((a, m) => a + (m ? m.faces.filter((f) => !f.hidden).length : 0), 0);
const groups = {
  sofa: count(parts.sofa),
  pillows: count(parts.pillowL, parts.pillowR),
  coffeeTable: count(parts.table, parts.magazines, parts.magazineTop),
  rug: count(parts.rug),
  sideboard: count(parts.sideboard, parts.sideboardDoor),
  recordPlayer: count(parts.recordBase, parts.recordPlatter, parts.recordArm),
  chair: count(parts.chairBase, parts.chairTop)
};
const FLOORS = { sofa: 90, sideboard: 50, recordPlayer: 70, coffeeTable: 40, rug: 60, chair: 60 };
for (const k of Object.keys(FLOORS)) {
  ok(groups[k] >= FLOORS[k], k + ' face count ' + groups[k] + ' >= ' + FLOORS[k]);
}
note('faces by object: ' + Object.keys(groups).map((k) => k + ' ' + groups[k]).join(' · '));
ok(totalFaces >= 450, 'module total ' + totalFaces + ' >= 450');
ok(totalFaces <= 1100, 'module total ' + totalFaces + ' <= 1100 (guideline)');
ok(!!parts.record && parts.record.radius === 0.15, 'parts.record exposed with radius 0.15');

/* the sofa must not push through the south wall, and nothing may sink */
let maxZ = -Infinity;
for (const m of scene.meshes) for (const v of m.verts) if (v[2] > maxZ) maxZ = v[2];
ok(maxZ <= 2.5501, 'nothing crosses the south wall plane (max z = ' + maxZ.toFixed(3) + ')');
ok(minY >= -0.0001, 'nothing sinks below the floor (min y = ' + minY.toFixed(4) + ')');

/* ------------------------------------------------------- registration rules */
const byId = {};
for (const o of registered) {
  ok(!!o.id && !!o.mesh && !!o.hit, 'interactive ' + o.id + ' has id/mesh/hit');
  ok(o.hit.min[0] < o.hit.max[0] && o.hit.min[1] < o.hit.max[1] && o.hit.min[2] < o.hit.max[2],
    'hit.min < hit.max for ' + o.id);
  ok(typeof o.label === 'string' && o.label.length > 0, 'label present for ' + o.id);
  ok(scene.meshes.indexOf(o.mesh) >= 0, 'mesh of ' + o.id + ' belongs to the scene');
  byId[o.id] = o;
}
for (const id of ['cushionL', 'cushionR', 'magazines', 'rug', 'cabinetDoor', 'record', 'chair']) {
  ok(!!byId[id], 'registered id ' + id);
}
ok(byId.chair.dynamicHit === true, 'chair is dynamicHit');
ok(byId.cabinetDoor.dynamicHit === true, 'cabinetDoor is dynamicHit');
ok(typeof byId.chair.onDrag === 'function', 'chair has onDrag');
ok(byId.rug.onDrag === undefined, 'rug is not a drag target');

/* ---------------------------------------------------------------- clicking */
function snapshot() {
  const out = [];
  for (const m of scene.meshes) for (const v of m.verts) out.push(v[0], v[1], v[2]);
  return out;
}
function anyNaN() {
  for (const m of scene.meshes) for (const v of m.verts) {
    if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) return true;
  }
  return false;
}
function rugMaxAbsY() {
  let mx = 0;
  for (const v of parts.rug.verts) mx = Math.max(mx, Math.abs(v[1]));
  return mx;
}

const beforeClicks = snapshot();
for (const o of registered) {
  for (let c = 0; c < 3; c++) {
    try {
      if (o.onDown) o.onDown(ctxStub);
      if (o.onClick) o.onClick(ctxStub);
    } catch (e) {
      ok(false, o.id + '.onClick threw: ' + e.message);
    }
  }
}
ok(!anyNaN(), 'no NaN after clicking everything three times');
for (let f = 0; f < 12; f++) {
  ctxStub.time += 1 / 60;
  for (const o of registered) if (o.update) o.update(1 / 60, ctxStub);
}
const afterClicks = snapshot();
ok(afterClicks.some((v, i) => v !== beforeClicks[i]), 'clicking changed some geometry');

/* ------------------------------------------------------------ rug flatness */
const rugFlat = rugMaxAbsY();
ok(rugFlat < 0.05, 'rug stays flat after clicks (max |y| = ' + rugFlat.toFixed(4) + ')');

/* -------------------------------------------------------------- animation */
const platterBefore = parts.recordPlatter.verts[0].slice();
const chairBefore = sctx.lounge.chairState ? [sctx.lounge.chairState.x, sctx.lounge.chairState.z] : null;
let animErr = null;
try {
  for (let f = 0; f < 600; f++) {
    ctxStub.time += 1 / 60;
    for (const o of registered) if (o.update) o.update(1 / 60, ctxStub);
    if (anyNaN()) { ok(false, 'NaN appeared during animation at frame ' + f); break; }
    if (rugMaxAbsY() >= 0.05) { ok(false, 'rug exceeded 0.05 during the ripple at frame ' + f); break; }
  }
} catch (e) { animErr = e; }
ok(!animErr, '600 frames of update() did not throw' + (animErr ? ' — ' + animErr.stack : ''));
ok(!anyNaN(), 'no NaN after 600 frames');

const rec = parts.record;
ok(rec && rec.speed > 0.5 && rec.speed <= 0.63, 'record spun up to ' + (rec && rec.speed.toFixed(3)) + ' rev/s');
ok(rec && rec.spinning > 0.9, 'parts.record.spinning ~ 1 (' + (rec && rec.spinning) + ')');
const platterAfter = parts.recordPlatter.verts[0];
const platterMoved = Math.hypot(platterAfter[0] - platterBefore[0], platterAfter[2] - platterBefore[2]);
ok(platterMoved > 0.02, 'platter geometry actually rotated (' + platterMoved.toFixed(3) + ' m)');
const armPos = parts.recordArm.verts[0];
ok(Number.isFinite(armPos[0]), 'tonearm vertices finite while playing');

/* ------------------------------------------------------- synthetic drag */
const chair = byId.chair;
const st = sctx.lounge.chairState;
ok(!!st, 'chair state exposed for verification');
if (st) {
  const start = { x: st.x, z: st.z };
  chair.onDrag(ctxStub, { phase: 'start', world: [start.x, 0, start.z], delta: [0, 0, 0], screen: [0, 0], startWorld: [start.x, 0, start.z] });
  let worst = null;
  for (let k = 1; k <= 40; k++) {
    const wx = start.x + (k / 40) * 1.2;      // push it straight at the desk
    const wz = start.z + (k / 40) * 0.9;
    chair.onDrag(ctxStub, {
      phase: 'move', world: [wx, 0, wz], delta: [wx - start.x, 0, wz - start.z],
      screen: [0, 0], startWorld: [start.x, 0, start.z]
    });
    chair.update(1 / 60, ctxStub);
    const x = st.x, z = st.z;
    if (x < 0.10 - 1e-9 || x > 1.20 + 1e-9 || z < -2.10 - 1e-9 || z > -0.20 + 1e-9) {
      worst = 'out of drag range at (' + x.toFixed(3) + ', ' + z.toFixed(3) + ')';
    }
    if (z < -2.05 + 1e-9) worst = 'entered the bookshelf zone at z=' + z.toFixed(3);
    if (x > 1.02 && z > -1.95 && z < -0.15) {
      worst = 'entered the desk footprint at (' + x.toFixed(3) + ', ' + z.toFixed(3) + ')';
    }
    if (worst) break;
  }
  ok(!worst, 'chair stayed legal through the drag: ' + (worst || 'ok'));
  chair.onDrag(ctxStub, { phase: 'end', world: [st.x, 0, st.z], delta: [0, 0, 0], screen: [0, 0], startWorld: [start.x, 0, start.z] });
  for (let f = 0; f < 120; f++) chair.update(1 / 60, ctxStub);
  ok(Math.abs(st.x - start.x) > 0.05 || Math.abs(st.z - start.z) > 0.05,
    'chair actually moved (from ' + start.x.toFixed(2) + ',' + start.z.toFixed(2) +
    ' to ' + st.x.toFixed(2) + ',' + st.z.toFixed(2) + ')');
  ok(st.x <= 1.02 || st.z <= -1.95 || st.z >= -0.15, 'chair parked outside the desk footprint');
  ok(st.z >= -2.05, 'chair parked outside the shelf zone');
  ok(!anyNaN(), 'no NaN after the drag');
  // drag it the other way, hard, to make sure both clamps hold
  chair.onDrag(ctxStub, { phase: 'start', world: [st.x, 0, st.z], delta: [0, 0, 0], screen: [0, 0], startWorld: [st.x, 0, st.z] });
  for (let k = 1; k <= 30; k++) {
    chair.onDrag(ctxStub, {
      phase: 'move', world: [st.x - k * 0.1, 0, st.z - k * 0.1], delta: [-0.1, 0, -0.1],
      screen: [0, 0], startWorld: [st.x, 0, st.z]
    });
    chair.update(1 / 60, ctxStub);
  }
  chair.onDrag(ctxStub, { phase: 'end', world: [st.x, 0, st.z], delta: [0, 0, 0], screen: [0, 0], startWorld: [st.x, 0, st.z] });
  ok(st.x >= 0.10 - 1e-9 && st.x <= 1.20 + 1e-9, 'chair x clamped low (' + st.x.toFixed(3) + ')');
  ok(st.z >= -2.05 - 1e-9 && st.z <= -0.20 + 1e-9, 'chair z clamped low (' + st.z.toFixed(3) + ')');
  const hb = chair.hit;
  ok(hb.min[0] < hb.max[0] && hb.min[2] < hb.max[2], 'chair hit box still valid after dragging');
}

/* ------------------------------------------------------- door + count check */
const door = byId.cabinetDoor;
door.onClick(ctxStub);
for (let f = 0; f < 200; f++) door.update(1 / 60, ctxStub);
ok(door.hit.min[0] < door.hit.max[0], 'open door hit box valid');
ok(door.hit.max[0] > -1.0, 'door swung out into the room (max x ' + door.hit.max[0].toFixed(3) + ')');
ok(!anyNaN(), 'no NaN after the door animation');

/* ------------------------------------------------------------------ report */
console.log('lounge smoke test');
console.log('  assertions : ' + checks + (failures ? '  (' + failures + ' FAILED)' : '  all passed'));
for (const n of notes) console.log('  · ' + n);
console.log('  interactives: ' + registered.map((o) => o.id).join(', '));
for (const o of registered) {
  console.log('    ' + o.id.padEnd(12) + ' hit [' +
    o.hit.min.map((v) => v.toFixed(2)).join(', ') + '] … [' +
    o.hit.max.map((v) => v.toFixed(2)).join(', ') + ']' +
    (o.dynamicHit ? '  dynamicHit' : ''));
}
if (failures) { console.error('SMOKE TEST FAILED (' + failures + ')'); process.exit(1); }
console.log('SMOKE TEST PASSED');
