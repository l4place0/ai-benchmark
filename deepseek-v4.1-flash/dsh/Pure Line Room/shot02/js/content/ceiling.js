/* ===========================================================================
 * ceiling.js — everything that hangs at y > 2.15                  owner: ceiling
 * ---------------------------------------------------------------------------
 * Contents
 *   • ceiling fan      (1.05, 2.90, 0.15)   canopy / rod / yoke / motor / 4 blades
 *   • pendant lamp     (-1.75, 2.90, -1.55) rose / braided cord / conical shade
 *   • wind chime       (-2.25, 2.88, -1.75) wooden disc / striker / sail / 5 tubes
 *   • two mobiles      (2.35, 2.88, 0.95) and (-0.35, 2.88, 0.35)
 *
 * The ceiling plane itself belongs to room.js: nothing here draws it.
 *
 * Notes for the integrator
 *   • main.js only exposes `scene` (there is no `ctx.object`), so objects are
 *     registered through `scene.object()` with a defensive fallback; `parts`
 *     are always `obj.part()`.
 *   • Geometry is emitted exactly once; every animation mutates Node
 *     transforms (pos / rot) or — for the lamp glow and the fan's motion-blur
 *     ghosts — the `alpha` (or `fill`) field of an already-emitted style
 *     record. `renderer.js` reads `rec.geo.style` fresh every frame, so that
 *     is the intended way to fade something without rebuilding geometry.
 * ========================================================================= */

import { ease, Spring, damp } from '../core/anim.js';
import { clamp } from '../core/math3d.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

/* ---------------------------------------------------------------- styles --
 * Line hierarchy: silhouette 1.7–2.0, structure 1.1–1.3, detail 0.7–0.85.
 * These helpers build a fresh object every call so nothing is shared by
 * accident — records whose style is mutated later get a dedicated object. */

const sil = (x) => Object.assign({ stroke: 'ink', width: 1.85 }, x);
const stru = (x) => Object.assign({ stroke: 'ink', width: 1.2 }, x);
const det = (x) => Object.assign({ stroke: 'inkSoft', width: 0.78 }, x);

/* ------------------------------------------------------------------ maths */

function ringPts(cx, cy, cz, r, n, axis, phase) {
  const out = [];
  const p0 = phase || 0;
  for (let i = 0; i < n; i++) {
    const a = p0 + (i / n) * TAU;
    if (axis === 'x') out.push([cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
    else if (axis === 'z') out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
    else out.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
  }
  return out;
}

function rotYp(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

/** rotZ(rz) * rotX(rx) applied to a point — matches Node.setRot(rx,0,rz). */
function rotXZp(p, rx, rz) {
  const y1 = p[1] * Math.cos(rx) - p[2] * Math.sin(rx);
  const z1 = p[1] * Math.sin(rx) + p[2] * Math.cos(rx);
  return [p[0] * Math.cos(rz) - y1 * Math.sin(rz),
    p[0] * Math.sin(rz) + y1 * Math.cos(rz), z1];
}

/* ==================================================================== build */

export default function build(ctx) {
  const scene = ctx.scene;

  // main.js hands us a bare `scene`; be tolerant of the contract's ctx.object().
  const newObject = (o) => (typeof ctx.object === 'function' ? ctx.object(o) : scene.object(o));

  /* scene.js exports State as an object with .get()/.set() (main.js uses
     state.get('night')), while CONTRACT §6 describes it as a plain record.
     Read through this helper so both shapes work. */
  const S = (c, k, dflt) => {
    const s = (c && c.state) || {};
    const v = (typeof s.get === 'function') ? s.get(k) : s[k];
    return v === undefined ? dflt : v;
  };

  /* Hover flags: main.js calls the part's handler with (isHover, ctx). Part.hoverT
     is the smoothed value, so both agree. */
  const hovered = Object.create(null);
  const track = (part, key) => {
    part.onHover((h) => { hovered[key] = (h === true); });
  };
  const hv = (part, key) => Math.max(part.hoverT || 0, hovered[key] ? 1 : 0);

  /* ======================================================================
   * 1. CEILING FAN — centre (1.05, 2.90, 0.15)
   * ==================================================================== */
  const fan = newObject({ id: 'ceiling-fan', label: '吊扇', hint: '点击切换档位' });
  fan.setPos(1.05, 2.90, 0.15);

  const fanBody = fan.part('body', { label: '吊扇', hint: '点击切换档位' });
  const fanBlades = fan.part('blades', { label: '扇叶', hint: '点击切换档位' });
  const fanChain = fan.part('chain', { label: '风扇拉链', hint: '点击切换档位' });

  /* ---- 1a. canopy + down-rod + yoke + motor housing ------------------- */
  {
    const b = fanBody.builder;

    // flared canopy pressed to the ceiling
    b.cylinder(0, -0.016, 0, 0.056, 0.03, sil({ fill: 'face1' }), { segments: 12, rTop: 0.078 });
    for (let i = 0; i < 2; i++) {                       // 2 visible screws
      const a = 0.7 + i * Math.PI;
      const sx = Math.cos(a) * 0.049, sz = Math.sin(a) * 0.049;
      b.disc(sx, -0.0325, sz, 0.0068, det({ fill: 'face2', stroke: 'inkMid' }), { segments: 8 });
      b.line([sx - 0.004, -0.0328, sz], [sx + 0.004, -0.0328, sz], det({ stroke: 'inkMid' }));
    }

    // down-rod, 0.42 long, ball joint on top / yoke below
    b.cylinder(0, -0.245, 0, 0.0085, 0.43, stru({ fill: 'face2', stroke: 'inkMid' }), { segments: 8 });
    b.sphereWire(0, -0.052, 0, 0.019, det({ stroke: 'inkMid' }),
      { meridians: 4, parallels: 2, segments: 10 });
    for (const sz of [-1, 1]) {
      b.quad([-0.032, -0.450, sz * 0.023], [0.032, -0.450, sz * 0.023],
        [0.032, -0.489, sz * 0.023], [-0.032, -0.489, sz * 0.023], stru({ fill: 'face2' }));
    }
    b.line([0, -0.470, -0.031], [0, -0.470, 0.031], det({ stroke: 'inkMid' }));

    // squat motor housing
    b.cylinder(0, -0.535, 0, 0.105, 0.115, sil({ fill: 'face1' }), { segments: 14 });
    for (let k = 0; k < 5; k++) {                       // 5 cooling ribs
      const y = -0.494 - k * 0.0175;
      b.polyline(ringPts(0, y, 0, 0.1075, 20), det({ width: 0.72 }), true);
    }
    for (let k = 0; k < 6; k++) {                       // vent slots between ribs
      const a = 0.25 + (k / 6) * TAU;
      const cx = Math.cos(a) * 0.1075, cz = Math.sin(a) * 0.1075;
      b.line([cx, -0.492, cz], [cx, -0.578, cz], det({ stroke: 'inkMid', width: 0.66 }));
    }
    // lower cap + nameplate badge
    b.cylinder(0, -0.6035, 0, 0.087, 0.022, sil({ fill: 'face1' }), { segments: 12 });
    b.disc(0, -0.522, 0.109, 0.019, det({ fill: 'face2', stroke: 'inkMid' }), { segments: 10, axis: 'z' });
    b.line([-0.011, -0.518, 0.1095], [0.011, -0.526, 0.1095], det({ width: 0.6 }));
  }

  /* ---- 1b. four blades on stamped irons, each pitched about its own
   *          long axis, alternating sign --------------------------------- */
  const BLADE_Y = -0.585;
  const bladeOutline = (y) => ([
    [0.205, y, 0.050], [0.340, y, 0.058], [0.480, y, 0.052], [0.575, y, 0.034],
    [0.622, y, 0.000], [0.575, y, -0.034], [0.480, y, -0.052], [0.340, y, -0.058],
    [0.205, y, -0.050],
  ]);

  const ghostRecs = [];
  {
    const b = fanBlades.builder;
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i / 4) * TAU;
      const pitch = (i % 2 ? -1 : 1) * 11 * D2R;
      b.push();
      b.rotateY(ang);
      b.translate(0, BLADE_Y, 0);
      // blade iron (small stamped bracket, stays flat) + 2 screws
      b.box([0.095, -0.019, -0.026], [0.212, -0.007, 0.026], stru({ fill: 'face2', cull: 'back' }));
      for (const sz of [-1, 1]) {
        b.disc(0.128, -0.0065, sz * 0.015, 0.0055, det({ fill: 'face1', stroke: 'inkMid' }), { segments: 8 });
      }
      b.push();
      b.rotateX(pitch);
      // thin tapered plate: two faces + a closing outline
      b.poly(bladeOutline(0.004), sil({ fill: 'face1', cull: 'back' }));
      b.poly(bladeOutline(-0.004).slice().reverse(), stru({ fill: 'face2', cull: 'back' }));
      b.polyline(bladeOutline(0.0), det({ stroke: 'inkMid', width: 0.7 }), true);
      // pressed rib down the centre + stamped root step
      b.polyline([[0.235, 0.0075, 0], [0.400, 0.0095, 0], [0.560, 0.0070, 0], [0.606, 0.0025, 0]],
        det({ stroke: 'inkMid', width: 0.72 }));
      b.line([0.216, 0.005, -0.049], [0.216, 0.005, 0.049], det({ width: 0.62 }));
      b.pop();
      b.pop();
    }

    /* Motion blur: two extra faint blade outlines at trailing angles. Their
       alpha is written every frame from the current angular speed. */
    for (let k = 1; k <= 2; k++) {
      const from = b.geo.length;
      b.push();
      b.rotateY(Math.PI / 4 - k * 0.24);
      b.translate(0, BLADE_Y, 0);
      b.rotateX(11 * D2R * (k === 1 ? 1 : -1));
      b.poly(bladeOutline(0.002), {
        fill: 'none', stroke: 'ink', width: 0.75, alpha: 0,
        hatch: { gap: 4.5, angle: 36, width: 0.62, stroke: 'inkSoft', alpha: 0.6 },
      });
      b.pop();
      for (let i = from; i < b.geo.length; i++) ghostRecs.push(b.geo[i]);
    }
  }

  /* ---- 1c. pull chain with a swinging bead ---------------------------- */
  const chainBeadRecs = [];
  {
    const b = fanChain.builder;
    b.polyline([[0, 0, 0], [-0.002, -0.03, 0.001], [0.002, -0.06, -0.001], [0, -0.09, 0], [0, -0.118, 0]],
      stru({ stroke: 'inkMid', width: 1.0 }));
    for (let i = 1; i <= 5; i++) {
      b.disc(0, -i * 0.022, 0, 0.0062, det({ fill: 'face1', stroke: 'inkMid', width: 0.7 }),
        { segments: 7, axis: 'x' });
    }
    const from = b.geo.length;
    b.disc(0, -0.130, 0, 0.012, sil({ fill: 'face1' }), { segments: 9, axis: 'y' });
    b.polyline(ringPts(0, -0.130, 0, 0.012, 9, 'z'), det({ stroke: 'inkMid', width: 0.7 }), true);
    for (let i = from; i < b.geo.length; i++) chainBeadRecs.push(b.geo[i]);
    fanChain.setPos(0.06, -0.605, 0);
  }

  /* ---- 1d. fan behaviour ---------------------------------------------- */
  const FAN_TARGET = [0, 2.6, 5.4, 9.0];              // rad/s per speed step
  const chainSpring = new Spring(0, 58, 4.6);
  let fanAngle = 0;
  let fanVel = 0;
  let chainWasHot = false;
  track(fanChain, 'fan-chain');

  const fanClick = (c) => {
    const n = (((S(c, 'fanSpeed', 0) | 0) + 1) % 4);
    c.set('fanSpeed', n);
    c.audio.setLoop('fan', n > 0, { speed: n });
    c.audio.sfx('click');
    chainSpring.impulse(1.5);
  };
  fanBody.onClick(fanClick);
  fanBlades.onClick(fanClick);
  fanChain.onClick(fanClick);
  fan.onClick(fanClick);

  fan.onUpdate((dt, now, c) => {
    const sp = clamp(S(c, 'fanSpeed', 0) | 0, 0, 3);
    fanVel = damp(fanVel, FAN_TARGET[sp], 1.15, dt);       // spins up + coasts down
    if (fanVel < 0.004) fanVel = 0;
    fanAngle = (fanAngle + fanVel * dt) % TAU;

    // the whole fixture breathes very slightly, always
    const wob = Math.sin(now * 0.62) * 0.0022 + Math.sin(now * 1.37) * 0.0011;
    const wobZ = Math.sin(now * 0.71 + 1.2) * 0.0019;
    fanBody.setRot(wob, 0, wobZ);
    fanBlades.setRot(wob, fanAngle, wobZ);

    const blur = clamp((fanVel - 2.0) / 6.5, 0, 1);        // visible at speed 3
    for (let i = 0; i < ghostRecs.length; i++) {
      ghostRecs[i].style.alpha = 0.58 * blur;
    }

    // chain: idle sway, springs sideways while hovered
    const h = hv(fanChain, 'fan-chain');
    if (h > 0.5 && !chainWasHot) chainSpring.impulse(1.4);
    chainWasHot = h > 0.5;
    chainSpring.to(h * 0.30);
    chainSpring.step(dt);
    const idleSway = Math.sin(now * 1.65) * 0.012 + Math.sin(now * 0.47) * 0.018;
    fanChain.setRot(chainSpring.value + idleSway * (1 + 1.6 * h), 0,
      Math.sin(now * 1.13 + 0.6) * 0.012 * (1 + 1.4 * h));

    const cool = { fill: 'face1', stroke: 'inkMid', width: 0.7 };
    const hot = { fill: 'glow', stroke: 'accent', width: 1.05 };
    const beadStyle = h > 0.35 ? hot : cool;
    for (let i = 0; i < chainBeadRecs.length; i++) chainBeadRecs[i].style = beadStyle;
  });

  /* ======================================================================
   * 2. PENDANT LAMP — centre (-1.75, 2.90, -1.55), shade bottom y ≈ 2.18
   * ==================================================================== */
  const pendant = newObject({ id: 'pendant-lamp', label: '吊灯', hint: '点击开关' });
  pendant.setPos(-1.75, 2.90, -1.55);

  const shadePart = pendant.part('shade', { label: '吊灯', hint: '点击开关' });
  const pullPart = pendant.part('pull', { label: '拉线开关', hint: '点击开关' });
  const glowNode = pendant.node('glow');            // plain Node — never pickable

  const bulbRecs = [];
  const rimRecs = [];
  {
    const b = shadePart.builder;

    // ceiling rose + 2 screws
    b.cylinder(0, -0.009, 0, 0.075, 0.018, sil({ fill: 'face1' }), { segments: 14 });
    for (const sx of [-1, 1]) {
      b.disc(sx * 0.044, -0.020, 0.0, 0.006, det({ fill: 'face2', stroke: 'inkMid' }), { segments: 8 });
      b.line([sx * 0.044, -0.0215, -0.004], [sx * 0.044, -0.0215, 0.004], det({ width: 0.6 }));
    }

    // braided cord — two crossing strands
    for (let s = 0; s < 2; s++) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const a = t * 7.5 + s * Math.PI;
        pts.push([Math.sin(a) * 0.0062, -0.018 - t * 0.302, Math.cos(a) * 0.0055]);
      }
      b.polyline(pts, det({ stroke: 'inkMid', width: 0.85 }));
    }
    // cord grip
    b.cylinder(0, -0.335, 0, 0.016, 0.032, stru({ fill: 'face2' }), { segments: 8 });

    // 10-facet conical shade
    const N = 10, yTop = -0.355, yBot = -0.72, rTop = 0.052, rBot = 0.20;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
      const p = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
      b.quad(p(rTop, yTop, a0), p(rTop, yTop, a1), p(rBot, yBot, a1), p(rBot, yBot, a0),
        stru({ fill: 'face1' }));
    }
    // rolled bottom rim + one spun-metal ring line
    b.ring(0, -0.719, 0, 0.186, 0.206, stru({ fill: 'face2' }), { segments: 12 });
    b.polyline(ringPts(0, -0.550, 0, 0.1340, 16), det({ stroke: 'inkSoft', width: 0.72 }), true);

    // interior: ONE small dark ellipse near the top (never a black block)
    b.disc(0, -0.420, 0, 0.042, { fill: 'dark', stroke: 'inkMid', width: 0.85 }, { segments: 12 });

    // socket + screw base
    b.cylinder(0, -0.435, 0, 0.024, 0.045, stru({ fill: 'face2' }), { segments: 8 });
    b.cylinder(0, -0.468, 0, 0.022, 0.045, det({ fill: 'face2', stroke: 'inkMid' }), { segments: 8 });

    // visible bulb: 2 filled ellipses + wire rings + meridians + filament
    const cy = -0.545, rx = 0.036, ry = 0.050;
    const glassStyle = { fill: 'glass', stroke: 'none', alpha: 0.5 };
    const from = b.geo.length;
    for (const pl of ['xy', 'yz']) {
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const u = Math.cos(a) * rx, v = Math.sin(a) * ry;
        pts.push(pl === 'xy' ? [u, cy + v, 0] : [0, cy + v, u]);
      }
      b.poly(pts, glassStyle);
    }
    b.polyline([[0, cy - ry, 0], [0, cy - ry + 0.012, 0]], det({ stroke: 'inkMid', width: 0.8 }));
    for (let m = 0; m < 4; m++) {
      const a = (m / 4) * Math.PI;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const f = -Math.PI / 2 + (i / 8) * Math.PI;
        const rr = Math.cos(f) * rx;
        pts.push([Math.cos(a) * rr, cy + Math.sin(f) * ry, Math.sin(a) * rr]);
      }
      b.polyline(pts, det({ stroke: 'inkMid', width: 0.72 }));
    }
    for (const t of [-0.86, -0.44, 0, 0.44, 0.86]) {
      const rr = rx * Math.sqrt(1 - t * t);
      b.polyline(ringPts(0, cy + ry * t, 0, rr, 12), det({ stroke: 'inkSoft', width: 0.62 }), true);
    }
    // filament zig-zag
    b.polyline([[-0.010, cy - 0.026, 0], [0.010, cy - 0.010, 0], [-0.010, cy + 0.006, 0],
      [0.010, cy + 0.020, 0]], det({ stroke: 'inkMid', width: 0.78 }));
    for (let i = from; i < b.geo.length; i++) bulbRecs.push(b.geo[i]);

    // accent rim that catches the light at night
    const rf = b.geo.length;
    b.polyline(ringPts(0, -0.7235, 0, 0.2075, 18), { stroke: 'accent', width: 1.35, alpha: 0 });
    for (let i = rf; i < b.geo.length; i++) rimRecs.push(b.geo[i]);
  }

  /* ---- 2a. the dedicated glow node ------------------------------------
   * Emitted once with {fill:'glow', alpha:0}; every frame only the style alpha
   * is written. No geometry is rebuilt, and the node is not pickable so the
   * halo never steals clicks from the shade. */
  const glowRecs = [];
  const shadowRecs = [];
  {
    const b = glowNode.builder;
    for (const ax of ['y', 'z', 'x']) {
      const from = b.geo.length;
      b.disc(0, -0.545, 0, ax === 'y' ? 0.30 : 0.195,
        { fill: 'glow', stroke: 'none', alpha: 0 },
        { segments: 18, axis: ax });
      for (let i = from; i < b.geo.length; i++) glowRecs.push(b.geo[i]);
    }
    // soft radial shadow hatch just under the shade, fades out when lit
    const from = b.geo.length;
    b.disc(0, -0.735, 0, 0.245, {
      fill: 'none', stroke: 'none', alpha: 0,
      hatch: { gap: 5.5, angle: 30, width: 0.7, stroke: 'inkSoft', alpha: 0.42 },
    }, { segments: 16 });
    for (let i = from; i < b.geo.length; i++) shadowRecs.push(b.geo[i]);
  }

  /* ---- 2b. pull cord (own pivot at the shade rim) ---------------------- */
  const PULL_AT = [0.052, -0.714, 0.052];
  const pullBeadRecs = [];
  {
    const b = pullPart.builder;
    b.line([0, 0, 0], [0, -0.055, 0], det({ stroke: 'inkMid', width: 0.8 }));
    b.polyline([[0, -0.055, 0], [0.003, -0.20, 0.001], [-0.002, -0.34, -0.001], [0, -0.400, 0]],
      det({ stroke: 'inkMid', width: 0.85 }));
    const from = b.geo.length;
    b.disc(0, -0.412, 0, 0.013, sil({ fill: 'face1' }), { segments: 9, axis: 'y' });
    b.polyline(ringPts(0, -0.412, 0, 0.013, 9, 'z'), det({ stroke: 'inkMid', width: 0.7 }), true);
    for (let i = from; i < b.geo.length; i++) pullBeadRecs.push(b.geo[i]);
    pullPart.setPos(PULL_AT[0], PULL_AT[1], PULL_AT[2]);
  }

  /* ---- 2c. behaviour --------------------------------------------------- */
  const shadeSpring = new Spring(0, 42, 3.1);     // settles a ~3.5° swing
  const yankSpring = new Spring(0, 90, 4.2);      // 35 mm yank + wobble
  let glowRaw = S(ctx, 'pendantOn', false) ? 1 : 0;
  let shadeWasHot = false, pullWasHot = false;
  track(pullPart, 'pendant-pull');

  const togglePendant = (c, fromCord) => {
    const on = !S(c, 'pendantOn', false);
    c.set('pendantOn', on);
    c.audio.sfx('lampClick');
    shadeSpring.impulse(fromCord ? 0.22 : 0.42);   // ≈3.5° for the shade click
    if (fromCord) yankSpring.impulse(-0.34);       // ≈35 mm downward
  };
  shadePart.onClick((c) => togglePendant(c, false));
  pullPart.onClick((c) => togglePendant(c, true));
  pendant.onClick((c) => togglePendant(c, false));

  pendant.onUpdate((dt, now, c) => {
    const h = hv(pullPart, 'pendant-pull');
    if (h > 0.5 && !pullWasHot) yankSpring.impulse(-0.10);
    pullWasHot = h > 0.5;
    if (shadePart.hoverT > 0.5 && !shadeWasHot) shadeSpring.impulse(0.10);
    shadeWasHot = shadePart.hoverT > 0.5;

    shadeSpring.step(dt);
    yankSpring.step(dt);
    const rx = shadeSpring.value;
    const rz = shadeSpring.value * 0.28 + Math.sin(now * 0.83) * 0.004;
    shadePart.setRot(rx, 0, rz);
    glowNode.setRot(rx, 0, rz);
    pullPart.setRot(rx * 1.15 + yankSpring.value * 0.9, 0,
      rz * 1.1 + Math.sin(now * 1.21) * 0.02);
    pullPart.setPos(PULL_AT[0], PULL_AT[1] - yankSpring.value, PULL_AT[2]);

    // on/off with a 0.5 s cubic fade-in
    const on = !!S(c, 'pendantOn', false);
    glowRaw = clamp(glowRaw + (on ? dt / 0.5 : -dt / 0.40), 0, 1);
    const g = ease.cubicOut(glowRaw);
    const nightT = clamp(typeof c.nightT === 'number' ? c.nightT : (S(c, 'night', false) ? 1 : 0), 0, 1);
    const lit = g * (0.40 + 0.60 * nightT);

    for (let i = 0; i < bulbRecs.length; i++) {
      const st = bulbRecs[i].style;
      st.alpha = 0.45 + 0.5 * lit;
      if (st.fill === 'glass' || st.fill === 'glow') st.fill = lit > 0.3 ? 'glow' : 'glass';
    }
    for (let i = 0; i < glowRecs.length; i++) glowRecs[i].style.alpha = 0.26 * lit;
    for (let i = 0; i < shadowRecs.length; i++) shadowRecs[i].style.alpha = 0.55 * (1 - g);
    for (let i = 0; i < rimRecs.length; i++) rimRecs[i].style.alpha = 0.95 * lit;

    // the pull bead warms up when hovered
    const beadStyle = h > 0.35
      ? { fill: 'glow', stroke: 'accent', width: 1.05 }
      : { fill: 'face1', stroke: 'inkMid', width: 0.75 };
    for (let i = 0; i < pullBeadRecs.length; i++) pullBeadRecs[i].style = beadStyle;

    if (g > 0.02) {
      c.light(-1.75, 2.72, -1.55, 2.6, [255, 222, 168], 1.0 * g);
      c.light(-1.95, 1.05, -2.05, 1.7, [255, 224, 170], 0.45 * g);
    }
  });

  /* ======================================================================
   * 3. WIND CHIME — hanging point (-2.25, 2.88, -1.75)
   * ==================================================================== */
  const chime = newObject({ id: 'wind-chime', label: '风铃', hint: '点击拨动' });
  chime.setPos(-2.25, 2.88, -1.75);

  const TUBE_LEN = [0.34, 0.30, 0.26, 0.22, 0.18];
  const TUBE_R = 0.062;
  const TUBE_Y = -0.052;
  const tubeAng = (i) => -Math.PI / 2 + (i / 5) * TAU;

  const chimeFrame = chime.part('frame', { label: '风铃', hint: '点击拨动' });
  const woodRecs = [];
  {
    const b = chimeFrame.builder;
    const from = b.geo.length;
    b.cylinder(0, -0.008, 0, 0.076, 0.016, sil({ fill: 'face2' }), { segments: 14 });
    b.polyline(ringPts(0, -0.0165, 0, 0.076, 14), det({ stroke: 'inkMid', width: 0.7 }), true);
    for (let i = from; i < b.geo.length; i++) woodRecs.push(b.geo[i]);

    // 3 catenary suspension cords
    for (let k = 0; k < 3; k++) {
      const a = tubeAng(k * 2);
      const p0 = [Math.cos(a) * 0.068, -0.016, Math.sin(a) * 0.068];
      const p2 = [Math.cos(a) * TUBE_R, TUBE_Y - 0.006, Math.sin(a) * TUBE_R];
      const p1 = [(p0[0] + p2[0]) * 0.47, -0.047, (p0[2] + p2[2]) * 0.47];
      b.polyline([p0, p1, p2], det({ stroke: 'inkMid', width: 0.72 }));
    }
    // striker on its own cord
    b.line([0, -0.016, 0], [0, -0.205, 0], det({ stroke: 'inkMid', width: 0.72 }));
    b.disc(0, -0.215, 0, 0.043, sil({ fill: 'face1' }), { segments: 14 });
    b.polyline(ringPts(0, -0.2155, 0, 0.029, 12), det({ width: 0.65 }), true);
    // wind-catcher sail
    b.line([0, -0.222, 0], [0, -0.452, 0], det({ stroke: 'inkMid', width: 0.72 }));
    b.poly([[-0.040, -0.462, 0], [0.040, -0.462, 0], [0.048, -0.508, 0], [0, -0.536, 0],
      [-0.048, -0.508, 0]], sil({ fill: 'face1' }));
    b.line([0, -0.462, 0], [0, -0.536, 0], det({ width: 0.62 }));
    b.line([-0.040, -0.487, 0], [0.040, -0.487, 0], det({ width: 0.62 }));
  }

  // 5 graduated metal tubes, each on its own pivot so it can lag the frame
  const tubes = [];
  for (let i = 0; i < 5; i++) {
    const p = chime.part('tube-' + i, { label: '风铃管', hint: '点击拨动' });
    const L = TUBE_LEN[i];
    const b = p.builder;
    b.cylinder(0, -L / 2, 0, 0.0085, L, sil({ fill: 'face1', stroke: 'inkMid', width: 1.0 }), { segments: 8 });
    b.disc(0, -0.021, 0, 0.0038, { fill: 'dark', stroke: 'none', width: 0 }, { segments: 6 });
    b.line([0.0086, -0.036, 0], [0.0086, -L + 0.016, 0], det({ stroke: 'inkSoft', width: 0.55 }));
    b.polyline(ringPts(0, -L, 0, 0.0085, 8), det({ width: 0.6 }), true);
    const a = tubeAng(i);
    const base = [Math.cos(a) * TUBE_R, TUBE_Y, Math.sin(a) * TUBE_R];
    tubes.push({ part: p, base, ang: 0, phase: i * 0.34 });
  }

  /* ---- 3a. behaviour --------------------------------------------------- */
  const chimeSpring = new Spring(0, 9.0, 0.95);   // big swing, decays over seconds
  const NOTES = [0, 2, 4, 7, 9];                  // pentatonic offsets per tube
  const NAT_W = TAU / 3.4;                        // natural period ≈ 3.4 s
  const NAT_A = 1.2 * D2R;                        // natural amplitude ≈ 1.2°
  let lastChimeAt = -10;
  const chimeClick = (c) => {
    chimeSpring.impulse((Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.25));
    c.audio.sfx('chime', { note: NOTES[2 + ((Math.random() * 3) | 0) - 1] });
    lastChimeAt = -10;
  };
  chimeFrame.onClick(chimeClick);
  for (const t of tubes) t.part.onClick(chimeClick);
  chime.onClick(chimeClick);

  chime.onUpdate((dt, now, c) => {
    chimeSpring.step(dt);
    const sp = chimeSpring.value;
    const h = chimeFrame.hoverT || 0;

    // lean ~1.5° toward the viewer while hovered (the pointer is always on the
    // near side of the object, and ctx.camera is available in the real app)
    let leanX = 0, leanZ = 0;
    const eye = c.camera && c.camera.eye;
    if (eye) {
      const dx = eye[0] + 2.25, dz = eye[2] + 1.75;
      const l = Math.hypot(dx, dz) || 1;
      leanX = -1.5 * D2R * h * (dz / l);
      leanZ = 1.5 * D2R * h * (dx / l);
    }

    const fx = NAT_A * Math.sin(NAT_W * now) + sp + leanX;
    const fz = 0.55 * D2R * Math.sin(NAT_W * now + 1.7) + sp * 0.25 + leanZ;
    chimeFrame.setRot(fx, 0, fz);

    for (let i = 0; i < tubes.length; i++) {
      const t = tubes[i];
      const lag = t.phase;
      const tx = 1.7 * D2R * Math.sin(NAT_W * (now - lag)) + sp * 0.35;
      const tz = 0.9 * D2R * Math.sin(NAT_W * (now - lag) + 2.1);
      t.ang = tx;
      const p = rotXZp(t.base, fx, fz);
      t.part.setPos(p[0], p[1], p[2]);
      t.part.setRot(fx + tx, 0, fz + tz);
    }

    // ring while the swing is fast, staggered so it sounds like a real chime
    const speed = Math.abs(chimeSpring.vel) + NAT_A * NAT_W;
    if (speed > 0.30 && now - lastChimeAt > clamp(0.60 - speed * 0.9, 0.13, 0.60)) {
      let bi = 0, bv = -1;
      for (let i = 0; i < tubes.length; i++) {
        const v = Math.abs(tubes[i].ang);
        if (v > bv) { bv = v; bi = i; }
      }
      lastChimeAt = now;
      c.audio.sfx('chime', { note: NOTES[bi] });
    }

    const ws = h > 0.35
      ? { fill: 'face2', stroke: 'accent', width: 1.85 }
      : { fill: 'face2', stroke: 'ink', width: 1.85 };
    for (let i = 0; i < woodRecs.length; i++) woodRecs[i].style = ws;
  });

  /* ======================================================================
   * 4. HANGING MOBILE A — a branch with 3 origami cranes, (2.35, 2.88, 0.95)
   * ==================================================================== */
  const mobA = newObject({ id: 'mobile-cranes', label: '纸鹤挂饰', hint: '点击旋转' });
  mobA.setPos(2.35, 2.88, 0.95);

  const branchPart = mobA.part('branch', { label: '纸鹤挂饰', hint: '点击旋转' });
  const CRANE_HANG = [[-0.120, -0.200, 0.004], [0.020, -0.320, -0.005], [0.130, -0.250, 0.003]];
  {
    const b = branchPart.builder;
    b.line([0, 0, 0], [0, -0.112, 0], det({ stroke: 'inkMid', width: 0.8 }));
    b.cylinder(0, -0.118, 0, 0.009, 0.30, stru({ fill: 'face2' }),
      { segments: 6, axis: 'x', rTop: 0.005 });
    b.polyline([[-0.10, -0.112, 0.006], [-0.075, -0.090, 0.014], [-0.055, -0.074, 0.020]],
      det({ stroke: 'inkMid', width: 0.7 }));
    b.polyline([[0.06, -0.112, -0.006], [0.085, -0.088, -0.012], [0.108, -0.072, -0.016]],
      det({ stroke: 'inkMid', width: 0.7 }));
    for (const h of CRANE_HANG) {
      b.line([h[0], -0.118, h[2]], h, det({ stroke: 'inkSoft', width: 0.6 }));
      b.disc(h[0], -0.120, h[2], 0.004, det({ fill: 'face3', stroke: 'none', width: 0 }), { segments: 6 });
    }
  }

  const cranes = [];
  for (let i = 0; i < 3; i++) {
    const p = mobA.part('crane-' + i, { label: '纸鹤', hint: '点击旋转' });
    const b = p.builder;
    const s = 1.0;
    const A = [0, -0.012 * s, 0];              // ridge
    const C = [0, -0.048 * s, 0];              // belly
    const N = [0.052 * s, -0.030 * s, 0];      // neck
    const T = [-0.055 * s, -0.038 * s, 0];     // tail
    const L = [0.004 * s, -0.040 * s, 0.027 * s];
    const R = [0.004 * s, -0.040 * s, -0.027 * s];
    const F = { fill: 'face1', stroke: 'ink', width: 0.9 };
    b.tri(A, N, L, F); b.tri(A, L, T, F); b.tri(A, T, R, F); b.tri(A, R, N, F);
    b.tri(C, L, N, F); b.tri(C, T, L, F); b.tri(C, R, T, F); b.tri(C, N, R, F);
    b.quad(N, [0.072, -0.020, 0], [0.082, -0.029, 0], [0.058, -0.037, 0], F);      // head
    b.tri(T, [-0.084, -0.050, 0.018], [-0.088, -0.045, -0.014], F);                // tail flap
    b.tri(A, [0.012, -0.020, 0.076], [-0.020, -0.034, 0.058], F);                  // wing +
    b.tri(A, [-0.020, -0.034, -0.058], [0.012, -0.020, -0.076], F);                // wing −
    b.polyline([[0.068, -0.024, 0], [0.080, -0.028, 0]], det({ width: 0.6 }));     // beak line
    cranes.push({ part: p, base: CRANE_HANG[i], phase: i * 2.1, spin: 0 });
  }

  /* ======================================================================
   * 5. HANGING MOBILE B — a spiral of 7 stars, (-0.35, 2.88, 0.35)
   * ==================================================================== */
  const mobB = newObject({ id: 'mobile-stars', label: '星星挂饰', hint: '点击旋转' });
  mobB.setPos(-0.35, 2.88, 0.35);

  const spiralSize = (t) => {
    const a = t * TAU * 1.35;
    const r = 0.035 + t * 0.135;
    return [Math.cos(a) * r, -0.045 - t * 0.30, Math.sin(a) * r];
  };

  const spiralPart = mobB.part('spiral', { label: '星星挂饰', hint: '点击旋转' });
  {
    const b = spiralPart.builder;
    b.line([0, 0, 0], [0, -0.045, 0], det({ stroke: 'inkMid', width: 0.72 }));
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(spiralSize(i / 40));
    b.polyline(pts, det({ stroke: 'inkMid', width: 0.85 }));
  }

  const stars = [];
  for (let i = 0; i < 7; i++) {
    const p = mobB.part('star-' + i, { label: '星星', hint: '点击旋转' });
    const b = p.builder;
    const t = (i + 0.5) / 7;
    const top = spiralSize(t);
    b.line([0, 0, 0], [0, -0.030, 0], det({ stroke: 'inkSoft', width: 0.55 }));
    const pts = [];
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k / 8) * TAU;
      const r = (k % 2 ? 0.016 : 0.038);
      pts.push([Math.cos(a) * r, -0.068 + Math.sin(a) * r, 0]);
    }
    b.poly(pts, sil({ fill: 'face1', width: 1.1 }));
    b.line([0, -0.106, 0], [0, -0.030, 0], det({ width: 0.6 }));
    b.line([-0.038, -0.068, 0], [0.038, -0.068, 0], det({ width: 0.6 }));
    stars.push({ part: p, base: [top[0], top[1] - 0.008, top[2]], phase: i * 1.7, spin: 0 });
  }

  /* ---- mobiles behaviour: slow continuous turn + decaying click spin ---- */
  const mobiles = [
    { def: mobA, root: branchPart, bits: cranes, period: 40 },
    { def: mobB, root: spiralPart, bits: stars, period: 26 },
  ];
  for (const m of mobiles) {
    m.spinV = 0;
    m.spinOff = 0;
    const click = (c) => {
      m.spinV += (Math.random() < 0.5 ? -1 : 1) * 4.2;
      c.audio.sfx('chime', { note: 12 + ((Math.random() * 3) | 0) });
    };
    m.root.onClick(click);
    for (const bit of m.bits) bit.part.onClick(click);
    m.def.onClick(click);
    m.def.onUpdate((dt, now) => {
      m.spinV *= Math.exp(-1.15 * dt);
      if (Math.abs(m.spinV) < 0.002) m.spinV = 0;
      m.spinOff += m.spinV * dt;
      const base = (TAU * (now / m.period) + m.spinOff) % TAU;
      m.root.setRot(0, base, 0);
      for (let i = 0; i < m.bits.length; i++) {
        const bit = m.bits[i];
        const p = rotYp(bit.base, base);
        bit.part.setPos(p[0], p[1], p[2]);
        bit.part.setRot(0, base + TAU * (now / (13 + i * 3.5)) + bit.phase, 0);
      }
    });
  }
}
