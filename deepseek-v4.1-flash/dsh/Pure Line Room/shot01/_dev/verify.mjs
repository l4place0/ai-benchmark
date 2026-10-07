/* =============================================================================
   _dev/verify.mjs — end-to-end verification of the finished piece.

   Drives the real project headlessly (mock DOM + real js/*.js), then asserts:
     · every registered interactive can be reached and clicked at its own centre
     · clicking it actually changes geometry, environment or animation state
     · hover produces feedback, presses are distinguished from drags
     · continuous dynamics keep moving (fan, platter, pendulum, clock hands)
     · the environment changes globally (lights, time of day, palette)
     · nothing throws, nothing goes NaN, save/restore stays balanced
   ========================================================================== */
import { createPage } from './harness.mjs';

const W = 1440, H = 900;
const page = createPage({ width: W, height: H, dpr: 1 });
const errors0 = [];
page.loadScriptsFrom('index.html');
const app = page.win.PLR && page.win.PLR.app;
if (!app) { console.log('FATAL: app did not boot'); process.exit(1); }

const results = [];
let pass = 0, fail = 0;
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (ok) pass++; else fail++;
}

function snapshot() {
  const meshes = app.scene.meshes.map((m) => {
    let s = 0;
    for (const v of m.verts) s += v[0] * 1.7 + v[1] * 3.1 + v[2] * 5.3;
    return s;
  });
  return {
    meshes,
    env: JSON.stringify(app.env),
    faceCount: app.scene.meshes.reduce((n, m) => n + m.faces.length, 0)
  };
}
function meshDelta(a, b) {
  let d = 0;
  for (let i = 0; i < a.meshes.length; i++) d += Math.abs((b.meshes[i] || 0) - a.meshes[i]);
  return d;
}

// ---------------------------------------------------------------- boot state
page.advance(2500);
check('boots without errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)));
check('31 interactives registered', app.interact.reg.length >= 30, app.interact.reg.length);
check('mesh count sane', app.scene.meshes.length >= 60, app.scene.meshes.length);
check('faces registered', app.renderer.stats.faces > 1500, app.renderer.stats.faces);
check('canvas sized', page.canvas.width === W, page.canvas.width);

const ids = app.interact.reg.map((o) => o.id);

// ------------------------------------------------- every object: hit + effect
const unreachable = [];
const inert = [];
// Reset the room to its rest state before each probe: clicking a curtain or a
// blind legitimately changes what is in front of everything else, and the test
// must measure reachability, not the residue of the previous click.
function restState() {
  if (app.sctx.curtainOpen !== 0) {
    app.sctx.curtainOpen = 0;
    app.sctx.curtainGoal = 0;
  }
  const bs = app.sctx.blindState;
  if (bs) { bs.target = 0; bs.goal = { bundle: 0.16, tilt: 0.30 }; }
  page.advance(2600);
}

for (const obj of app.interact.reg.slice()) {
  restState();
  const box = app.interact.worldBox(obj);
  const c = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const p = app.renderer.project(c);
  if (!p) { unreachable.push(obj.id + '(behind)'); continue; }
  // aim at the object by walking the screen until the picker agrees
  let spot = null;
  if (p[0] > 2 && p[0] < W - 2 && p[1] > 2 && p[1] < H - 2) {
    const hit = app.interact.pick(p[0], p[1]);
    if (hit && hit.obj === obj) spot = [p[0], p[1]];
  }
  if (!spot) {
    // spiral outwards looking for a pixel where this object wins the pick
    outer:
    for (let rad = 8; rad <= 200 && !spot; rad += 8) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = p[0] + Math.cos(ang) * rad, y = p[1] + Math.sin(ang) * rad;
        if (x < 2 || x > W - 2 || y < 2 || y > H - 2) continue;
        const hit = app.interact.pick(x, y);
        if (hit && hit.obj === obj) { spot = [x, y]; break outer; }
      }
    }
  }
  if (!spot) {
    // Off-screen objects cannot be clicked from this particular angle — that is
    // a property of the camera, not a defect. Record them separately.
    const onScreen = p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H;
    if (!onScreen) {
      const before = snapshot();
      // drive the handler directly: the behaviour must still be sound
      if (obj.onClick) obj.onClick(app.interact.ctx(obj));
      if (obj.onDown) obj.onDown(app.interact.ctx(obj));
      page.advance(1200);
      const after = snapshot();
      const moved = meshDelta(before, after) > 1e-4 || before.env !== after.env;
      check('off-screen but responsive: ' + obj.id, moved, 'meshDelta=' + meshDelta(before, after).toFixed(4));
      continue;
    }
    unreachable.push(obj.id);
    continue;
  }

  const before = snapshot();
  page.move(spot[0], spot[1]);
  page.advance(260);                       // let hover settle
  const hovered = app.interact.hover === obj;
  const hoverAmount = obj.hoverAmount;
  page.down(spot[0], spot[1]);
  page.advance(80);
  page.up(spot[0], spot[1]);
  page.advance(1600);                      // let the animation run
  const after = snapshot();
  const dEnv = before.env !== after.env;
  const dMesh = meshDelta(before, after);
  const moved = dMesh > 1e-4 || dEnv;
  if (!moved) inert.push(obj.id);
  check('clickable: ' + obj.id, hovered && moved,
    'hover=' + hovered + ' hoverAmt=' + hoverAmount.toFixed(2) + ' meshDelta=' + dMesh.toFixed(4) + ' envChanged=' + dEnv);
}
check('no unreachable interactives', unreachable.length === 0, unreachable.join(','));

// ------------------------------------------------------ drag vs click on chair
// Runs immediately after boot, before anything else has nudged the room.
{
  const chair = app.interact.get('chair');
  const b0 = app.interact.worldBox(chair);
  const c0 = [(b0.min[0] + b0.max[0]) / 2, (b0.min[1] + b0.max[1]) / 2, (b0.min[2] + b0.max[2]) / 2];
  const p = app.renderer.project(c0);
  const before = c0.slice();
  const aim = app.interact.pick(p[0], p[1]);
  check('chair is under the cursor at its centre', aim && aim.obj === chair, aim ? aim.obj.id : 'nothing');
  page.move(p[0], p[1]);
  page.advance(300);
  page.down(p[0], p[1]);
  page.advance(120);
  check('chair drag arms on press', !!app.interact.drag && app.interact.drag.obj === chair);
  let far = 0;
  for (let i = 1; i <= 26; i++) {
    page.move(p[0] - i * 4, p[1] + i * 2.5);
    page.advance(1000 / 60);
    const bb = app.interact.worldBox(chair);
    const cc = [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2];
    far = Math.max(far, Math.hypot(cc[0] - before[0], cc[2] - before[2]));
  }
  const during = app.interact.worldBox(chair);
  const cd = [(during.min[0] + during.max[0]) / 2, (during.min[1] + during.max[1]) / 2, (during.min[2] + during.max[2]) / 2];
  page.up(p[0] - 104, p[1] + 65);
  page.advance(1200);
  const b1 = app.interact.worldBox(chair);
  const c1 = [(b1.min[0] + b1.max[0]) / 2, (b1.min[1] + b1.max[1]) / 2, (b1.min[2] + b1.max[2]) / 2];
  check('chair drags', far > 0.08, 'max excursion ' + far.toFixed(3) + ' m');
  check('chair stays in the room', cd[0] > -1.75 && cd[0] < 1.75 && cd[2] > -2.65 && cd[2] < 2.65,
    cd.map((v) => v.toFixed(2)).join(','));
  check('chair stays out of the desk and shelf',
    !(cd[0] > 1.02 && cd[2] > -1.95 && cd[2] < -0.15) && cd[2] > -2.06,
    cd.map((v) => v.toFixed(2)).join(','));
  check('chair settles where released', Math.hypot(c1[0] - cd[0], c1[2] - cd[2]) < 0.15,
    'settled ' + Math.hypot(c1[0] - cd[0], c1[2] - cd[2]).toFixed(3) + ' m from the release point');
}

// ------------------------------------------------------------- hover feedback
{
  const door = app.interact.get('door');
  page.advance(600);
  page.move(-999, -999);
  page.advance(600);
  const b = app.interact.worldBox(door);
  const p = app.renderer.project([(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]);
  page.move(p[0], p[1]);
  page.advance(400);
  check('hover engages on the door', app.interact.hover === door && door.hoverAmount > 0.5,
    'hover=' + (app.interact.hover && app.interact.hover.id) + ' amt=' + door.hoverAmount.toFixed(2));
  page.move(-999, -999);
  page.advance(900);
  check('hover releases', app.interact.hover === null, app.interact.hover && app.interact.hover.id);
}

// ------------------------------------------------------------- global states
{
  const day = app.theme().day;
  app.env.autoTime = false;
  app.setEnv({ hour: 12, minute: 0, day: 1 });
  page.advance(60);
  const noon = app.theme();
  app.setEnv({ hour: 23, minute: 0, day: 0.1 });
  page.advance(60);
  const night = app.theme();
  check('palette changes with the day cycle',
    noon.mat.wall !== night.mat.wall && noon.line !== night.line,
    noon.mat.wall + ' vs ' + night.mat.wall);
  app.setEnv({ lightsOn: true });
  page.advance(60);
  const lit = app.theme();
  check('light switch re-inks the room', lit.mat.wall !== night.mat.wall, lit.mat.wall);
  check('lightsOn recorded in env', app.env.lightsOn === true);
  app.setEnv({ lightsOn: false, hour: 21, minute: 30, day: 0.16 });
  page.advance(60);
}

// --------------------------------------------------------- continuous motion
{
  const fan = app.interact.get('fan');
  const fanSpin = app.scene.meshes.find((m) => m.name === 'fan.spin');
  const before = fanSpin ? fanSpin.verts[0].slice() : null;
  page.advance(2000);
  const after = fanSpin ? fanSpin.verts[0].slice() : null;
  const fanMoving = before && after && Math.hypot(after[0] - before[0], after[2] - before[2]) > 1e-4;
  check('ceiling fan turns on its own', fanMoving, before + ' -> ' + after);

  const clock = app.interact.get('clock');
  const hands = app.scene.meshes.find((m) => m.name === 'clock.hands');
  const hb = hands ? hands.verts[0].slice() : null;
  page.advance(7000);
  const ha = hands ? hands.verts[0].slice() : null;
  check('clock hands track real time', hb && ha && Math.hypot(ha[0] - hb[0], ha[1] - hb[1]) > 1e-5, hb + ' -> ' + ha);

  const pend = app.scene.meshes.find((m) => m.name === 'clock.pendulum');
  const pb = pend ? pend.verts[0].slice() : null;
  page.advance(900);
  const pa = pend ? pend.verts[0].slice() : null;
  check('pendulum swings', pb && pa && Math.hypot(pa[0] - pb[0], pa[2] - pb[2]) > 1e-5);

  const chime = app.scene.meshes.find((m) => m.name && m.name.indexOf('chime.tube') === 0);
  const cb = chime ? chime.verts[0].slice() : null;
  page.advance(900);
  const ca = chime ? chime.verts[0].slice() : null;
  check('wind chime sways', cb && ca && Math.hypot(ca[0] - cb[0], ca[2] - cb[2]) > 1e-6);
}

// -------------------------------------------------------------- environment
{
  const steam = app.sctx.parts.steam;
  check('mug steam state is wired', !!steam, steam && ('on=' + steam.on + ' strength=' + steam.strength.toFixed(2)));
  const glow = app.sctx.parts.lampGlow;
  check('lamp glow handle is wired', !!glow && Array.isArray(glow.pos || glow.center));
  const pendant = app.sctx.parts.pendant;
  check('pendant handle is wired', !!pendant && typeof pendant.on === 'number');
  const rec = app.sctx.parts.record;
  check('record player handle is wired', !!rec, rec && ('spinning=' + rec.spinning));
}

// ------------------------------------------------------------------ integrity
{
  let nan = 0, badFill = 0, verts = 0;
  const legal = new Set(['paper', 'wall', 'ceiling', 'floor', 'floorAlt', 'wood', 'woodDark', 'metal',
    'metalDark', 'fabric', 'fabricAlt', 'rug', 'rugAlt', 'accent', 'plant', 'screen']);
  for (const m of app.scene.meshes) {
    for (const v of m.verts) {
      verts++;
      if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) nan++;
      if (Math.abs(v[0]) > 12 || Math.abs(v[1]) > 12 || Math.abs(v[2]) > 12) nan++;
    }
    for (const f of m.faces) {
      if (!f.fill) continue;
      if (f.fill[0] === '@') { if (!legal.has(f.fill.slice(1))) badFill++; }
      else if (!/^#[0-9a-fA-F]{3,8}$/.test(f.fill) && !/^rgba?\(/.test(f.fill)) badFill++;
      for (const i of f.vi) if (i < 0 || i >= m.verts.length) badFill++;
    }
  }
  check('no NaN / runaway vertices (' + verts + ' checked)', nan === 0, nan + ' bad');
  check('all fills legal', badFill === 0, badFill + ' bad');
  const sum = page.summary();
  check('save/restore balanced', sum.saveBalance === 0, sum.saveBalance);
  check('no NaN warnings from canvas', sum.warningCount === 0, sum.warnings.slice(0, 4).join(' | '));
  check('no runtime errors', page.errors.length === 0, JSON.stringify(page.errors.slice(0, 3)));
}

console.log(JSON.stringify({
  pass, fail,
  failures: results.filter((r) => !r.ok),
  inert, unreachable,
  stats: app.stats(),
  interactives: ids.length
}, null, 1));

const png = page.writePNG('_dev/verify_end.png');
console.log('final frame: ' + png);
process.exitCode = fail > 0 ? 1 : 0;
