/* =============================================================================
   Pure Line Room — ceiling.js
   Ceiling-mounted objects + wall decorations. Owns exactly six things, all
   placed from CONTRACT.md §3:

     · 吊扇  ceiling fan  (0, 2.40, 0.30)  — 3 speeds + off, ramped spin
     · 吊灯  pendant lamp (0, 2.20, -0.90) — toggles the room light, breathes
     · 摆钟  wall clock   (1.70, 2.02, 0.42) — real time, always-running pendulum
     · 挂画  pictures ×2  (north wall big, south wall small) — rock when poked
     · 风铃  wind chime   (1.42, 2.30, 1.30) — per-tube sway, real swing on click
     · 盆栽  potted plant (-1.34, 0, 1.86) — ambient sway + shiver

   Everything animated is re-derived every frame from a pristine copy of the
   rest-pose vertices (see `rig`), so long sessions never drift or accumulate
   error. Line language: K.SIL only for the fan blades and the clock case,
   K.EDGE for structure, K.FINE for ticks/screws/slots/seams/veins/mitres,
   K.SOFT for every meridian on a round form.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR = global.PLR || {};

  var G = null;    // PLR.geom   — bound by ceilingBuild (scene.js loads first)
  var K = null;    // PLR.K

  /* ------------------------------------------------------------------ maths */
  var _s0 = [0, 0, 0], _s1 = [0, 0, 0];

  function rotX(x, y, z, a, out) {
    var c = Math.cos(a), s = Math.sin(a);
    out[0] = x; out[1] = y * c - z * s; out[2] = y * s + z * c;
    return out;
  }
  function rotZ(x, y, z, a, out) {
    var c = Math.cos(a), s = Math.sin(a);
    out[0] = x * c - y * s; out[1] = x * s + y * c; out[2] = z;
    return out;
  }
  function rotY(x, y, z, a, out) {
    var c = Math.cos(a), s = Math.sin(a);
    out[0] = x * c + z * s; out[1] = y; out[2] = -x * s + z * c;
    return out;
  }

  /* ------------------------------------------------------- animation access */
  function approach(cur, target, speed, dt) {
    var A = P.anim;
    if (A && A.approach) return A.approach(cur, target, speed, dt);
    return cur + (target - cur) * (1 - Math.exp(-speed * dt));
  }
  function osc(t, period, phase) {
    var A = P.anim;
    if (A && A.osc) return A.osc(t, period, phase);
    return Math.sin((t / period) * Math.PI * 2 + (phase || 0));
  }
  /** 1 → 0 ringing envelope that is exactly zero after `life` seconds. */
  function damped(t, life, freq, phase) {
    if (t < 0 || t > life) return 0;
    return Math.exp(-4.2 * (t / life)) * Math.sin((t / life) * Math.PI * 2 * (freq || 2) + (phase || 0));
  }

  /* --------------------------------------------------------------- the rig */
  /**
   * rig(mesh, pivot[, fixedFrom]) → apply(fn)
   * Remembers the rest pose, then re-builds every frame from it with a rigid
   * transform about `pivot`. Vertices from index `fixedFrom` on are left alone
   * (used for hidden anchor points that keep an AABB stable while a part spins).
   */
  function rig(mesh, pivot, fixedFrom) {
    var base = [], i;
    for (i = 0; i < mesh.verts.length; i++) {
      base.push([mesh.verts[i][0], mesh.verts[i][1], mesh.verts[i][2]]);
    }
    var lim = fixedFrom === undefined ? base.length : fixedFrom;
    var px = pivot[0], py = pivot[1], pz = pivot[2];
    var out = [0, 0, 0];
    return function (fn) {
      for (var k = 0; k < lim; k++) {
        var b = base[k];
        fn(b[0] - px, b[1] - py, b[2] - pz, out);
        var v = mesh.verts[k];
        v[0] = px + out[0]; v[1] = py + out[1]; v[2] = pz + out[2];
      }
      mesh.invalidate();
    };
  }

  /* Hidden anchor triangle: contributes to mesh.getBounds() but is never drawn,
     so a registered dynamicHit box stays exactly as authored. */
  function anchorBox(m, min, max) {
    var p = [
      [min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], max[1], min[2]],
      [max[0], max[1], max[2]], [min[0], max[1], max[2]], [min[0], min[1], max[2]]
    ];
    for (var i = 0; i < 6; i++) {
      var j = (i + 1) % 6;
      m.face(m.vertices([p[i], p[j], p[(i + 2) % 6]]), { hidden: true, fill: null, kind: null });
    }
  }

  /* ------------------------------------------------------- geom shorthand */
  function line(m, a, b, kind) { return G.line(m, a, b, { kind: kind || K.FINE }); }
  function loopXZ(m, c, r, segs, kind) {
    var pts = [], i;
    for (i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      pts.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]);
    }
    G.loop(m, pts, { kind: kind || K.SOFT });
  }
  function loopYZ(m, x, cy, cz, r, segs, kind) {
    G.circleLines(m, [x, cy, cz], r, segs, { axis: 'x', kind: kind || K.SOFT });
  }
  /** A plate lying parallel to a wall: profile in (u=along wall, v=height).
      `zdir` is the direction the plate grows in (into the wall). */
  function plateZ(m, zFront, x0, y0, x1, y1, depth, zdir, opts) {
    return G.outline(m, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
      function (u, v) { return [u, v, zFront]; }, [0, 0, zdir], depth, opts);
  }
  /** A plate lying in a YZ plane (the wall clock family). */
  function plateX(m, xFront, z0, y0, z1, y1, depth, opts) {
    return G.outline(m, [[z0, y0], [z1, y0], [z1, y1], [z0, y1]],
      function (u, v) { return [xFront, v, u]; }, [1, 0, 0], depth, opts);
  }

  /* ==========================================================================
     BUILD
     ========================================================================== */
  P.ceilingBuild = function (sctx) {
    G = P.geom;
    K = P.K;
    if (!G || !K) throw new Error('ceiling.js: PLR.geom/PLR.K missing — load scene.js first');

    var S = sctx.scene;
    var reg = sctx.register;
    var parts = sctx.parts || (sctx.parts = {});
    var ROOM = sctx.ROOM || { x0: -1.70, x1: 1.70, z0: -2.60, z1: 2.60, h: 2.72 };
    var CEIL = ROOM.h;

    /* ======================================================================
       1. 吊扇 CEILING FAN — hub (0, 2.40, 0.30), blade radius 0.72
       ====================================================================== */
    var FAN = { x: 0, y: 2.40, z: 0.30, R: 0.72 };
    var BLADE_Y = 2.396;                 // blade mid-plane, well under the ceiling
    var CANT = 12 * Math.PI / 180;       // angle of attack
    var CANT_C = Math.cos(CANT), CANT_S = Math.sin(CANT);

    /* hub-local point: u = radial, v = tangential, ang = blade station angle */
    function hubPoint(u, v, ang, y, out) {
      var c = Math.cos(ang), s = Math.sin(ang);
      out[0] = FAN.x + u * c + v * s;
      out[1] = y;
      out[2] = FAN.z - u * s + v * c;
      return out;
    }
    /* blade surface point: (u along the blade, v across the chord) */
    function bladePoint(u, v, ang, out) {
      var c = Math.cos(ang), s = Math.sin(ang);
      var lx = u, lz = v * CANT_C;
      out[0] = FAN.x + lx * c + lz * s;
      out[1] = BLADE_Y + v * CANT_S;
      out[2] = FAN.z - lx * s + lz * c;
      return out;
    }
    /* blade slab thickness direction (blade normal), rotated to the station */
    function bladeNormal(ang, out) {
      var c = Math.cos(ang), s = Math.sin(ang);
      var lx = 0, lz = -CANT_S;
      out[0] = lx * c + lz * s;
      out[1] = -CANT_C;
      out[2] = -lx * s + lz * c;
      return out;
    }

    /* --- shaped paddle outline (11 pts): tapered, rounded tip, blunt root --- */
    function bladeProfile() {
      var root = 0.135, len = 0.575;
      var st = [0.00, 0.30, 0.62, 0.90];
      var hw = [0.072, 0.082, 0.076, 0.058];
      var pts = [], i;
      for (i = 0; i < 4; i++) pts.push([root + len * st[i], -hw[i]]);      // leading edge out
      var u1 = root + len * 0.90, r1 = hw[3];
      pts.push([u1 + r1 * 0.7071, -r1 * 0.7071]);                          // rounded tip
      pts.push([u1 + r1, 0]);
      pts.push([u1 + r1 * 0.7071, r1 * 0.7071]);
      for (i = 3; i >= 0; i--) pts.push([root + len * st[i], hw[i]]);      // trailing edge home
      return pts;
    }

    var fanStatic = S.build(function (m) {
      m.name = 'fan.static';
      /* canopy plate against the ceiling: boss, flare, ceiling fluff */
      G.lathe(m, [FAN.x, CEIL - 0.010, FAN.z], [
        [-0.038, 0.032], [-0.016, 0.092], [0.001, 0.058]
      ], 14, { fill: '@metal', top: true, topFill: '@metalDark', cull: false });
      line(m, [FAN.x - 0.070, CEIL - 0.026, FAN.z], [FAN.x + 0.070, CEIL - 0.026, FAN.z], K.SOFT);
      line(m, [FAN.x, CEIL - 0.026, FAN.z - 0.070], [FAN.x, CEIL - 0.026, FAN.z + 0.070], K.SOFT);
      /* downrod + coupling collar */
      G.tube(m, [FAN.x, CEIL - 0.046, FAN.z], [FAN.x, 2.505, FAN.z], 0.012, 0.012, 6,
        { fill: '@metalDark', kind: K.FINE });
      G.tube(m, [FAN.x, 2.522, FAN.z], [FAN.x, 2.494, FAN.z], 0.024, 0.022, 6,
        { fill: '@metal', kind: K.FINE });
      /* motor housing: rounded cylinder r 0.10 h 0.12 + meridian hints */
      var mf0 = m.faces.length;
      G.lathe(m, [FAN.x, 2.415, FAN.z], [
        [-0.016, 0.058], [0.012, 0.100], [0.070, 0.100], [0.106, 0.066]
      ], 14, { fill: '@metal', top: true, topFill: '@metalDark', cull: false });
      for (var mi = 0; mi < 4; mi++) {
        var ma = (mi / 4) * Math.PI * 2 + 0.4;
        line(m, [FAN.x + Math.cos(ma) * 0.099, 2.427, FAN.z + Math.sin(ma) * 0.099],
          [FAN.x + Math.cos(ma) * 0.099, 2.485, FAN.z + Math.sin(ma) * 0.099], K.SOFT);
      }
      /* cooling slots (fine radial-ish lines around the upper band) */
      for (var sl = 0; sl < 5; sl++) {
        var sa = (sl / 5) * Math.PI * 2 + 0.26;
        line(m, [FAN.x + Math.cos(sa) * 0.101, 2.462, FAN.z + Math.sin(sa) * 0.101],
          [FAN.x + Math.cos(sa) * 0.101, 2.492, FAN.z + Math.sin(sa) * 0.101], K.FINE);
      }
      /* inspection screw on the motor body */
      var scx = FAN.x + Math.cos(0.9) * 0.100, scz = FAN.z + Math.sin(0.9) * 0.100;
      var sp = [], si;
      for (si = 0; si < 5; si++) {
        var sca = (si / 5) * Math.PI * 2;
        sp.push([scx + Math.cos(sca) * 0.011, 2.437, scz + Math.sin(sca) * 0.011]);
      }
      G.loop(m, sp, { kind: K.FINE });
      line(m, [scx - 0.008, 2.437, scz], [scx + 0.008, 2.437, scz], K.FINE);
      m.__fanMotorFaces = [mf0, m.faces.length];
    });

    var fanSpin = S.build(function (m) {
      m.name = 'fan.spin';
      /* hub / blade spider disc (r 0.11 h 0.02) */
      G.lathe(m, [FAN.x, FAN.y, FAN.z], [
        [-0.014, 0.104], [0.004, 0.112], [0.012, 0.080]
      ], 14, { fill: '@metalDark', top: true, topFill: '@metal', cull: false });
      var prof = bladeProfile();
      for (var b = 0; b < 4; b++) {
        var ang = (b / 4) * Math.PI * 2 + 0.18;
        var nrm = bladeNormal(ang, [0, 0, 0]);
        /* The paddle itself — a real slab, tapered and canted, built face by
           face so the two big faces never double up their outlines: the top
           carries the one true silhouette (K.EDGE) over a light @metal fill,
           the under-side is distinctly lighter (@paper) and only K.SOFT, and
           the thin leading/trailing rim is K.FINE. Seen from below at a
           glancing angle the blade stays a light paddle with a dark edge
           instead of collapsing into a black stripe. */
        var topPts = [], botPts = [], pi;
        for (pi = 0; pi < prof.length; pi++) {
          var tp = bladePoint(prof[pi][0], prof[pi][1], ang, [0, 0, 0]);
          topPts.push(tp);
          botPts.push([tp[0] + nrm[0] * 0.012, tp[1] + nrm[1] * 0.012, tp[2] + nrm[2] * 0.012]);
        }
        var topIdx = m.vertices(topPts), botIdx = m.vertices(botPts);
        m.face(topIdx, { fill: '@metal', kind: K.EDGE });
        m.face(botIdx.slice().reverse(), { fill: '@paper', kind: K.SOFT });
        for (pi = 0; pi < prof.length; pi++) {
          var pj = (pi + 1) % prof.length;
          m.face([topIdx[pi], topIdx[pj], botIdx[pj], botIdx[pi]],
            { fill: '@metalDark', kind: K.FINE });
        }
        /* blade iron: a small tapered strap under the blade root */
        var iron = [[0.075, -0.026], [0.178, -0.021], [0.178, 0.021], [0.075, 0.026]];
        G.outline(m, iron,
          function (u, v) { var p = hubPoint(u, v, ang, BLADE_Y - 0.013, [0, 0, 0]); return p; },
          [0, -1, 0], 0.009,
          { fill: '@metalDark', kind: K.FINE, sideKind: K.FINE, silhouette: false });
        /* two screws per iron */
        for (var s2 = 0; s2 < 2; s2++) {
          var vv = s2 ? 0.017 : -0.017;
          var cp = hubPoint(0.152, vv, ang, BLADE_Y - 0.004, [0, 0, 0]);
          var ring = [], q;
          for (q = 0; q < 4; q++) {
            var qa = (q / 4) * Math.PI * 2;
            ring.push([cp[0] + Math.cos(qa) * 0.007, cp[1], cp[2] + Math.sin(qa) * 0.007]);
          }
          G.loop(m, ring, { kind: K.FINE });
        }
        /* a fine centre line + two contour lines along the blade */
        var l0 = bladePoint(0.170, 0, ang, [0, 0, 0]);
        var l1 = bladePoint(0.690, 0, ang, [0, 0, 0]);
        line(m, l0, l1, K.FINE);
        for (var c2 = 0; c2 < 2; c2++) {
          var sgn = c2 ? 1 : -1;
          var a0 = bladePoint(0.240, sgn * 0.049, ang, [0, 0, 0]);
          var a1 = bladePoint(0.610, sgn * 0.042, ang, [0, 0, 0]);
          line(m, a0, a1, K.FINE);
        }
      }
      /* keep the fan's hit box steady while the blades turn (never drawn) */
      m.__spinVertCount = m.verts.length;
      anchorBox(m, [FAN.x - 0.735, 2.345, FAN.z - 0.735], [FAN.x + 0.735, 2.585, FAN.z + 0.735]);
    });
    var fanApply = rig(fanSpin, [FAN.x, 0, FAN.z], fanSpin.__spinVertCount);

    var fanState = { level: 0, omega: 0, angle: 0, target: 0, speeds: [0, 2.3, 4.6, 7.6] };
    parts.fan = {
      hub: [FAN.x, FAN.y, FAN.z], radius: FAN.R, level: 0, omega: 0, angle: 0,
      mesh: fanSpin, staticMesh: fanStatic
    };
    var fanPart = parts.fan;

    reg({
      id: 'fan',
      label: '吊扇 Ceiling fan',
      hint: '点击换挡（关/低/中/高）',
      mesh: fanSpin,
      hit: { min: [FAN.x - 0.735, 2.345, FAN.z - 0.735], max: [FAN.x + 0.735, 2.585, FAN.z + 0.735] },
      dynamicHit: true,
      priority: 3,
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        fanState.level = (fanState.level + 1) % 4;
        fanState.target = fanState.speeds[fanState.level];
        fanPart.level = fanState.level;
        var names = ['关', '低', '中', '高'];
        if (fanState.level === 0) ctx.audio.play('fanStop');
        else ctx.audio.play('fan', { level: fanState.level });
        ctx.toast('吊扇：' + names[fanState.level]);
      },
      update: function (dt) {
        /* speed ramps through approach() — it never snaps to a new value */
        fanState.omega = approach(fanState.omega, fanState.target, 1.2, dt);
        if (fanState.omega < 1e-3 && fanState.target === 0) fanState.omega = 0;
        fanState.angle += fanState.omega * dt;
        if (fanState.angle > 6.283185307 * 2048) fanState.angle -= 6.283185307 * 2048;
        fanPart.omega = fanState.omega;
        fanPart.angle = fanState.angle;
        fanApply(function (x, y, z, out) { return rotY(x, y, z, fanState.angle, out); });
      }
    });

    /* ======================================================================
       2. 吊灯 PENDANT LAMP — centre (0, 2.20, -0.90), shade r 0.24
       ====================================================================== */
    var LAMP = { x: 0, y: 2.20, z: -0.90, r: 0.24 };
    var shadeFaces = null, bulbFaces = null, rimGlowFaces = null;

    var lampMesh = S.build(function (m) {
      m.name = 'pendant';
      /* ceiling rose: plate + dome */
      G.lathe(m, [LAMP.x, CEIL - 0.010, LAMP.z], [
        [-0.030, 0.026], [-0.012, 0.075], [0.000, 0.048]
      ], 14, { fill: '@metal', top: true, topFill: '@metalDark', cull: false });
      /* fabric-covered cord */
      G.tube(m, [LAMP.x, CEIL - 0.020, LAMP.z], [LAMP.x, 2.400, LAMP.z], 0.0055, 0.0055, 6,
        { fill: '@fabric', kind: K.SOFT });
      /* finial / cap nut where the cord meets the shade */
      G.tube(m, [LAMP.x, 2.372, LAMP.z], [LAMP.x, 2.408, LAMP.z], 0.030, 0.012, 6,
        { fill: '@metalDark', kind: K.FINE });
      /* the shade: wide shallow dome, rolled bottom rim, 14 segments */
      var f0 = m.faces.length;
      G.lathe(m, [LAMP.x, 2.055, LAMP.z], [
        [0.000, 0.222], [0.010, 0.240], [0.030, 0.234], [0.170, 0.146], [0.325, 0.092]
      ], 14, { fill: '@paper', top: true, topFill: '@fabricAlt', cull: false });
      shadeFaces = [f0, m.faces.length];
      /* 4 meridian seams on the shade */
      for (var mi = 0; mi < 4; mi++) {
        var ma = (mi / 4) * Math.PI * 2 + 0.35;
        line(m, [LAMP.x + Math.cos(ma) * 0.238, 2.062, LAMP.z + Math.sin(ma) * 0.238],
          [LAMP.x + Math.cos(ma) * 0.093, 2.378, LAMP.z + Math.sin(ma) * 0.093], K.SOFT);
      }
      /* the rolled rim gets its own fine circle so the roll reads */
      var rf0 = m.faces.length;
      loopXZ(m, [LAMP.x, 2.065, LAMP.z], 0.240, 14, K.FINE);
      rimGlowFaces = [rf0, m.faces.length];
      /* socket + bulb hint inside */
      G.tube(m, [LAMP.x, 2.078, LAMP.z], [LAMP.x, 2.120, LAMP.z], 0.030, 0.026, 8,
        { fill: '@metalDark', kind: K.FINE });
      var bf0 = m.faces.length;
      G.lathe(m, [LAMP.x, 2.038, LAMP.z], [
        [-0.042, 0.014], [-0.012, 0.042], [0.028, 0.030]
      ], 10, { fill: '@paper', top: true, topFill: '@metalDark', cull: false });
      bulbFaces = [bf0, m.faces.length];
    });
    var lampApply = rig(lampMesh, [LAMP.x, CEIL - 0.010, LAMP.z]);

    var lampState = { level: 0.14, on: 0, glow: 0 };
    parts.pendant = { pos: [LAMP.x, 2.05, LAMP.z], radius: 0.26, on: 0, mesh: lampMesh };

    reg({
      id: 'pendant',
      label: '吊灯 Pendant lamp',
      hint: '点击开关主灯',
      mesh: lampMesh,
      hit: { min: [LAMP.x - 0.255, 1.985, LAMP.z - 0.255], max: [LAMP.x + 0.255, 2.400, LAMP.z + 0.255] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        ctx.setEnv({ lightsOn: !ctx.env.lightsOn });
        var on = !!ctx.env.lightsOn;
        ctx.audio.play('switch', { on: on });
        ctx.toast(on ? '灯亮了' : '灯灭了');
      },
      update: function (dt, ctx) {
        var want = ctx.env && ctx.env.lightsOn ? 1 : 0;
        lampState.level = approach(lampState.level, want, 5.2, dt);
        var on = M.smoothstep(lampState.level);       /* soft ~0.4 s glow */
        lampState.on = on;
        parts.pendant.on = on;
        /* the shade's inside + the bulb warm up with it */
        var i, f = lampMesh.faces;
        for (i = shadeFaces[0]; i < shadeFaces[1]; i++) {
          if (f[i]) f[i].glow = on * 0.42;
        }
        for (i = rimGlowFaces[0]; i < rimGlowFaces[1]; i++) {
          if (f[i]) f[i].glow = on * 0.85;
        }
        var warm = G.mix('#f4f2ee', '#ffe6bb', on);
        for (i = bulbFaces[0]; i < bulbFaces[1]; i++) {
          if (!f[i]) continue;
          f[i].glow = on * 0.95;
          if (f[i].fill) f[i].fill = warm;
        }
        lampMesh.rev++;
        /* the lamp is never dead still: a very slow two-axis sway */
        var t = ctx.time || 0;
        var a1 = 0.008 * osc(t, 6.0, 0.0) + 0.0022 * osc(t, 2.7, 1.1);
        var a2 = 0.0055 * osc(t, 7.4, 1.4);
        lampApply(function (x, y, z, out) {
          rotX(x, y, z, a1, _s0);
          return rotZ(_s0[0], _s0[1], _s0[2], a2, out);
        });
      }
    });

    /* ======================================================================
       3. 摆钟 PENDULUM WALL CLOCK — (1.70, 2.02, 0.42), on the east wall
          case 0.30 × 0.62 × 0.16, facing -x, south of the window reveal
       ====================================================================== */
    var CLK = {
      x: 1.700, z: 0.42, y0: 1.775, y1: 2.245,
      z0: 0.285, z1: 0.555, fz0: 0.275, fz1: 0.565,
      face: 1.565, dialX: 1.606, dialY: 2.085, dialR: 0.115,
      back: 1.672, pivY: 2.100, pivX: 1.628
    };
    CLK.pivZ = CLK.z;

    var clockMesh = S.build(function (m) {
      m.name = 'clock.case';
      /* back board */
      plateX(m, CLK.back, CLK.z0, CLK.y0, CLK.z1, CLK.y1, 0.028,
        { fill: '@woodDark', kind: K.EDGE, silhouette: false });
      /* case stiles */
      plateX(m, CLK.face, CLK.z0, CLK.y0, CLK.z0 + 0.020, CLK.y1, 0.125,
        { fill: '@wood', kind: K.SIL, sideKind: K.EDGE, silhouette: false });
      plateX(m, CLK.face, CLK.z1 - 0.020, CLK.y0, CLK.z1, CLK.y1, 0.125,
        { fill: '@wood', kind: K.SIL, sideKind: K.EDGE, silhouette: false });
      /* top + bottom rails */
      plateX(m, CLK.face, CLK.z0, CLK.y1 - 0.048, CLK.z1, CLK.y1, 0.125,
        { fill: '@wood', kind: K.SIL, sideKind: K.EDGE, silhouette: false });
      plateX(m, CLK.face, CLK.z0, CLK.y0, CLK.z1, CLK.y0 + 0.060, 0.125,
        { fill: '@wood', kind: K.EDGE, sideKind: K.EDGE, silhouette: false });
      /* dial board behind the dial */
      plateX(m, CLK.face + 0.047, CLK.z0 + 0.022, 1.960, CLK.z1 - 0.022, CLK.y1 - 0.045, 0.058,
        { fill: '@paper', kind: K.FINE, silhouette: false });
      /* moulding lines on the stiles + a latch on the lower door */
      line(m, [CLK.face + 0.004, CLK.y0 + 0.02, CLK.z0 + 0.013], [CLK.face + 0.004, CLK.y1 - 0.02, CLK.z0 + 0.013], K.FINE);
      line(m, [CLK.face + 0.004, CLK.y0 + 0.02, CLK.z1 - 0.013], [CLK.face + 0.004, CLK.y1 - 0.02, CLK.z1 - 0.013], K.FINE);
      line(m, [CLK.face + 0.004, CLK.y0 + 0.030, CLK.z0 + 0.021], [CLK.face + 0.004, CLK.y1 - 0.030, CLK.z0 + 0.021], K.FINE);
      line(m, [CLK.face + 0.004, CLK.y0 + 0.030, CLK.z1 - 0.021], [CLK.face + 0.004, CLK.y1 - 0.030, CLK.z1 - 0.021], K.FINE);
      line(m, [CLK.face + 0.002, CLK.y0 + 0.066, CLK.z0 + 0.020], [CLK.face + 0.002, CLK.y0 + 0.066, CLK.z1 - 0.020], K.FINE);
      /* lower door outline (the pendulum shows through the glass) */
      line(m, [CLK.face + 0.002, CLK.y0 + 0.070, CLK.z0 + 0.030], [CLK.face + 0.002, 1.955, CLK.z0 + 0.030], K.FINE);
      line(m, [CLK.face + 0.002, 1.955, CLK.z0 + 0.030], [CLK.face + 0.002, 1.955, CLK.z1 - 0.030], K.FINE);
      line(m, [CLK.face + 0.002, 1.955, CLK.z1 - 0.030], [CLK.face + 0.002, CLK.y0 + 0.070, CLK.z1 - 0.030], K.FINE);
      /* pediment: cornice + a shaped crest + a brass ball */
      plateX(m, 1.552, CLK.fz0, CLK.y1, CLK.fz1, CLK.y1 + 0.027, 0.136,
        { fill: '@wood', kind: K.SIL, sideKind: K.EDGE, silhouette: false });
      G.outline(m, [[0.300, CLK.y1 + 0.027], [0.345, CLK.y1 + 0.060], [CLK.z, CLK.y1 + 0.073],
        [0.495, CLK.y1 + 0.060], [0.540, CLK.y1 + 0.027]],
        function (u, v) { return [1.590, v, u]; }, [1, 0, 0], 0.075,
        { fill: '@wood', kind: K.SIL, sideKind: K.EDGE, silhouette: false });
      G.tube(m, [CLK.z, CLK.y1 + 0.073, CLK.z], [CLK.z, CLK.y1 + 0.087, CLK.z], 0.009, 0.006, 8,
        { fill: '@accent', kind: K.FINE });
      /* bottom finial (turned drop) */
      G.lathe(m, [CLK.pivX, CLK.y0, CLK.z], [
        [-0.080, 0.005], [-0.050, 0.030], [-0.006, 0.012]
      ], 8, { fill: '@wood', top: false, cull: false });
      line(m, [CLK.pivX - 0.032, CLK.y0 - 0.032, CLK.z], [CLK.pivX + 0.032, CLK.y0 - 0.032, CLK.z], K.FINE);
      /* bezel ring around the dial */
      G.ring(m, [CLK.dialX - 0.006, CLK.dialY, CLK.z], 0.104, 0.126, 16,
        { axis: 'x', fill: '@metal' });
      loopYZ(m, CLK.dialX - 0.006, CLK.dialY, CLK.z, 0.126, 16, K.EDGE);
    });

    /* ---- dial face: ticks only, no text anywhere ---- */
    var dialMesh = S.build(function (m) {
      m.name = 'clock.dial';
      var cz = CLK.z, cy = CLK.dialY;
      /* dial disc */
      G.disc(m, [CLK.dialX, cy, cz], CLK.dialR, 20, { axis: 'x', fill: '@paper', kind: K.FINE, rim: false });
      var tx = CLK.dialX - 0.004;
      function tick(th, rin, rout, kind) {
        var c = Math.cos(th), s = Math.sin(th);
        line(m, [tx, cy + c * rin, cz - s * rin], [tx, cy + c * rout, cz - s * rout], kind);
      }
      /* 60 minute ticks (short, thin) + 12 hour ticks (long, thicker).
         12 / 3 / 6 / 9 get a doubled, longer tick instead of a numeral. */
      var i;
      for (i = 0; i < 60; i++) {
        tick((i / 60) * Math.PI * 2, 0.094, 0.104, K.FINE);
      }
      for (i = 0; i < 12; i++) {
        var th = (i / 12) * Math.PI * 2;
        if (i % 3 === 0) {
          tick(th - 0.040, 0.080, 0.104, K.FINE);
          tick(th + 0.040, 0.080, 0.104, K.FINE);
        } else {
          tick(th, 0.080, 0.104, K.EDGE);
        }
      }
      /* glass hint: two grazing highlight lines, in front of the hands */
      var gx = CLK.dialX - 0.008;
      line(m, [gx, cy - 0.070, cz + 0.084], [gx, cy + 0.048, cz - 0.104], K.SOFT);
      line(m, [gx, cy + 0.052, cz + 0.076], [gx, cy + 0.092, cz + 0.016], K.SOFT);
    });

    /* ---- hands (own mesh so they can be re-derived every frame) ---- */
    function dialPt(th, r, s, x, out) {
      out[0] = x;
      out[1] = CLK.dialY + r * Math.cos(th) - s * Math.sin(th);
      out[2] = CLK.z - r * Math.sin(th) - s * Math.cos(th);
      return out;
    }
    function handPoly(pts, rScale) {
      var out = [], i;
      for (i = 0; i < pts.length; i++) {
        out.push(dialPt(0, pts[i][0] * rScale, pts[i][1], CLK.dialX - 0.014, [0, 0, 0]));
      }
      return out;
    }
    var HOUR_SHAPE = [[-0.021, -0.0055], [-0.021, 0.0055], [0.004, 0.0090], [0.046, 0.0072],
      [0.062, 0.0000], [0.046, -0.0072], [0.004, -0.0090]];
    var MIN_SHAPE = [[-0.026, -0.0048], [-0.026, 0.0048], [0.006, 0.0070], [0.074, 0.0055],
      [0.098, 0.0000], [0.074, -0.0055], [0.006, -0.0070]];
    var handsMesh = S.build(function (m) {
      m.name = 'clock.hands';
      m.__hourFaces = [0, 0];
      var h0 = m.faces.length;
      G.poly(m, handPoly(HOUR_SHAPE, 1), { fill: '@metalDark', kind: K.EDGE });
      m.__hourFaces = [h0, m.faces.length];
      m.__minFaces = [m.faces.length, 0];
      var m0 = m.faces.length;
      G.poly(m, handPoly(MIN_SHAPE, 1), { fill: '@metalDark', kind: K.EDGE });
      m.__minFaces = [m0, m.faces.length];
      /* centre boss */
      G.tube(m, [CLK.dialX - 0.020, CLK.dialY, CLK.z], [CLK.dialX - 0.008, CLK.dialY, CLK.z], 0.012, 0.010, 8,
        { fill: '@metal', kind: K.FINE });
    });
    /* the hands live at 12 o'clock in their rest pose; every frame they are
       re-derived from those point lists, so the motion is drift-free */
    var hourBase = [], minBase = [], i2;
    for (i2 = 0; i2 < 7; i2++) {
      hourBase.push([HOUR_SHAPE[i2][0], HOUR_SHAPE[i2][1]]);
      minBase.push([MIN_SHAPE[i2][0], MIN_SHAPE[i2][1]]);
    }

    /* ---- pendulum (own mesh, swings about a pivot inside the case top) ---- */
    var pendMesh = S.build(function (m) {
      m.name = 'clock.pendulum';
      G.tube(m, [CLK.pivX, CLK.pivY - 0.006, CLK.z], [CLK.pivX, 1.902, CLK.z], 0.005, 0.005, 6,
        { fill: '@accent', kind: K.FINE });
      G.tube(m, [CLK.pivX - 0.007, 1.880, CLK.z], [CLK.pivX + 0.007, 1.880, CLK.z], 0.036, 0.036, 14,
        { fill: '@accent', kind: K.EDGE });
      line(m, [CLK.pivX, CLK.pivY - 0.008, CLK.z - 0.020], [CLK.pivX, CLK.pivY - 0.008, CLK.z + 0.020], K.FINE);
      line(m, [CLK.pivX, CLK.pivY - 0.014, CLK.z - 0.014], [CLK.pivX, CLK.pivY - 0.014, CLK.z + 0.014], K.FINE);
      m.__pendLen = CLK.pivY - 1.880;
    });
    var pendApply = rig(pendMesh, [CLK.pivX, CLK.pivY, CLK.z]);

    var clockState = { pendT: 0.35, boost: 0, ph: 0.4, hour: 0, min: 0, pend: 0 };
    parts.clock = {
      pos: [CLK.x, 2.02, CLK.z], mesh: clockMesh, dial: dialMesh,
      handHour: 0, handMinute: 0, pend: 0, hour: 0, minute: 0
    };
    var clockPart = parts.clock;

    reg({
      id: 'clock',
      label: '摆钟 Pendulum clock',
      hint: '点击让它报时',
      mesh: clockMesh,
      hit: { min: [1.548, 1.700, 0.265], max: [1.700, 2.340, 0.575] },
      priority: 1,
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        clockState.boost = 4.2;
        var h = Math.round(ctx.env.hour || 0) % 24;
        var mnt = Math.round(ctx.env.minute || 0) % 60;
        ctx.audio.play('chime', { hour: true });
        ctx.toast('现在 ' + (h < 10 ? '0' : '') + h + ':' + (mnt < 10 ? '0' : '') + mnt);
      },
      update: function (dt, ctx) {
        var env = ctx.env || {};
        var t = ctx.time || 0;
        var hh = env.hour === undefined ? 0 : env.hour;
        var mm = env.minute === undefined ? 0 : env.minute;
        var ss = (typeof env.second === 'number') ? env.second + (t % 1) : (t % 60);
        var hourAng = (((hh % 12) + (mm + ss / 60) / 60) % 12) * (Math.PI / 6);
        var minAng = ((mm + ss / 60) % 60) * (Math.PI / 30);
        clockState.hour = hourAng; clockState.min = minAng;
        clockPart.handHour = hourAng; clockPart.handMinute = minAng;
        clockPart.hour = hh; clockPart.minute = mm;
        /* the hands are re-derived from their rest pose every frame, so they
           move continuously and never accumulate or jump */
        var fam = handsMesh.faces;
        var ia, ib;
        ia = handsMesh.__hourFaces[0]; ib = handsMesh.__hourFaces[1];
        for (var i = ia; i < ib; i++) {
          var vi = fam[i].vi;
          for (var k = 0; k < vi.length; k++) {
            var p = dialPt(-hourAng, hourBase[k][0], hourBase[k][1], CLK.dialX - 0.014, _s0);
            handsMesh.setVert(vi[k], p);
          }
        }
        ia = handsMesh.__minFaces[0]; ib = handsMesh.__minFaces[1];
        for (var i3 = ia; i3 < ib; i3++) {
          var vi3 = fam[i3].vi;
          for (var k3 = 0; k3 < vi3.length; k3++) {
            var p3 = dialPt(-minAng, minBase[k3][0], minBase[k3][1], CLK.dialX - 0.014, _s0);
            handsMesh.setVert(vi3[k3], p3);
          }
        }
        handsMesh.invalidate();
        /* pendulum: calm and always running, wider for a few seconds on click */
        clockState.boost = Math.max(0, clockState.boost - dt);
        var amp = 0.22 + 0.20 * Math.min(1, clockState.boost / 4.2);
        var pa = amp * osc(t, 1.2, clockState.ph);
        clockPart.pend = pa;
        pendApply(function (x, y, z, out) { return rotX(x, y, z, pa, out); });
      }
    });

    /* ======================================================================
       4. 挂画 PICTURES — big on the north wall, small on the south wall
       ====================================================================== */
    /* moulding cross-section: [depth from the front face, distance from the
       outer edge] — outer bevel, recessed field, inner bevel, wall gap. */
    var MOULD = [
      [0.000, 0.000], [0.016, 0.011], [0.036, 0.016], [0.036, 0.039],
      [0.016, 0.044], [0.000, 0.055], [0.058, 0.055], [0.058, 0.000]
    ];

    /**
     * spec: { id, label, hint, toast, cx, cy, zFront, zin, w, h, art(fn) }
     *  zin = +1 when the wall is at greater z (south wall), -1 for the north.
     */
    function buildPicture(spec) {
      var hw = spec.w / 2, hh = spec.h / 2;
      var x0 = spec.cx - hw, x1 = spec.cx + hw;
      var y0 = spec.cy - hh, y1 = spec.cy + hh;
      var zin = spec.zin, zf = spec.zFront;
      var bw = 0.055;
      var ox0 = x0 + bw, ox1 = x1 - bw, oy0 = y0 + bw, oy1 = y1 - bw;

      var mesh = S.build(function (m) {
        m.name = spec.id;
        function rail(edgeX, yEdge, up) {
          G.outline(m, MOULD,
            function (u, v) { return [edgeX, yEdge + up * v, zf + zin * u]; },
            [1, 0, 0], spec.w,
            { fill: '@wood', kind: K.EDGE, sideKind: K.FINE, silhouette: false });
        }
        function stile(edgeY, xEdge, inward) {
          G.outline(m, MOULD,
            function (u, v) { return [xEdge + inward * v, edgeY, zf + zin * u]; },
            [0, 1, 0], spec.h,
            { fill: '@wood', kind: K.EDGE, sideKind: K.FINE, silhouette: false });
        }
        rail(x0, y1, -1);              // top rail
        rail(x0, y0, 1);               // bottom rail
        stile(y0, x0, 1);              // left stile
        stile(y0, x1, -1);             // right stile
        /* mitre joints, drawn where the mouldings meet */
        var mz = zf - zin * 0.002;
        line(m, [x0, y1, mz], [ox0, oy1, mz], K.FINE);
        line(m, [x1, y1, mz], [ox1, oy1, mz], K.FINE);
        line(m, [x0, y0, mz], [ox0, oy0, mz], K.FINE);
        line(m, [x1, y0, mz], [ox1, oy0, mz], K.FINE);
        /* mount board + a light inner line */
        plateZ(m, zf + zin * 0.038, ox0, oy0, ox1, oy1, 0.018, zin,
          { fill: '@paper', kind: K.FINE, silhouette: false });
        var az = zf + zin * 0.026;
        var inner = [[ox0 + 0.012, oy0 + 0.012, az], [ox1 - 0.012, oy0 + 0.012, az],
          [ox1 - 0.012, oy1 - 0.012, az], [ox0 + 0.012, oy1 - 0.012, az]];
        G.loop(m, inner, { kind: K.FINE });
        /* hanging wire + two hooks behind the top edge */
        var wz = zf + zin * 0.052;
        line(m, [x0 + 0.06, y1 - 0.05, wz], [spec.cx, y1 - 0.12, wz], K.FINE);
        line(m, [x1 - 0.06, y1 - 0.05, wz], [spec.cx, y1 - 0.12, wz], K.FINE);
        for (var hI = 0; hI < 2; hI++) {
          var hx = hI ? x1 - 0.06 : x0 + 0.06;
          var hk = [], q;
          for (q = 0; q < 4; q++) {
            var qa = (q / 4) * Math.PI * 2;
            hk.push([hx + Math.cos(qa) * 0.009, y1 - 0.05 + Math.sin(qa) * 0.009, wz]);
          }
          G.loop(m, hk, { kind: K.FINE });
        }
        spec.art(m, ox0 + 0.012, oy0 + 0.012, ox1 - 0.012, oy1 - 0.012, az);
      });
      return { mesh: mesh, x0: x0, x1: x1, y0: y0, y1: y1 };
    }

    /* --- big picture: minimal contour landscape ------------------------- */
    function artLandscape(m, ax0, ay0, ax1, ay1, z) {
      var w = ax1 - ax0, h = ay1 - ay0;
      var X = function (u) { return ax0 + w * u; };
      var Y = function (v) { return ay0 + h * v; };
      line(m, [X(0.0), Y(0.265), z], [X(1.0), Y(0.280), z], K.FINE);       // horizon
      /* four flowing contours: the far ridge, two nearer spurs, one peak */
      var hills = [
        [[0.00, 0.265], [0.15, 0.360], [0.32, 0.300], [0.50, 0.370], [0.70, 0.295], [1.00, 0.275]],
        [[0.06, 0.268], [0.22, 0.470], [0.38, 0.380], [0.54, 0.268]],
        [[0.44, 0.270], [0.60, 0.430], [0.76, 0.350], [0.94, 0.270]],
        [[0.20, 0.268], [0.36, 0.585], [0.52, 0.455], [0.68, 0.268]],
        [[0.60, 0.270], [0.74, 0.385], [0.88, 0.330], [1.00, 0.272]]
      ];
      for (var i = 0; i < hills.length; i++) {
        var p = hills[i], q;
        for (q = 0; q + 1 < p.length; q++) {
          line(m, [X(p[q][0]), Y(p[q][1]), z], [X(p[q + 1][0]), Y(p[q + 1][1]), z], K.FINE);
        }
      }
      /* low water lines under the ridge */
      for (var g = 0; g < 3; g++) {
        var yy = 0.175 - g * 0.050;
        line(m, [X(0.05 + g * 0.03), Y(yy), z], [X(0.40 + g * 0.04), Y(yy + 0.004), z], K.FINE);
        line(m, [X(0.55), Y(yy - 0.020), z], [X(0.94 - g * 0.05), Y(yy - 0.016), z], K.FINE);
      }
      /* a small sun */
      var sc = [], k, sr = Math.min(w, h) * 0.070;
      var scx = X(0.775), scy = Y(0.800);
      for (k = 0; k < 9; k++) {
        var a = (k / 9) * Math.PI * 2;
        sc.push([scx + Math.cos(a) * sr, scy + Math.sin(a) * sr, z]);
      }
      G.loop(m, sc, { kind: K.FINE });
      /* two birds */
      for (var b = 0; b < 2; b++) {
        var bx = X(0.24 + b * 0.15), by = Y(0.775 - b * 0.055), bs = w * 0.032;
        line(m, [bx - bs, by, z], [bx, by - bs * 0.55, z], K.FINE);
        line(m, [bx, by - bs * 0.55, z], [bx + bs, by, z], K.FINE);
      }
    }

    /* --- small picture: botanical sprig --------------------------------- */
    function artSprig(m, ax0, ay0, ax1, ay1, z) {
      var w = ax1 - ax0, h = ay1 - ay0;
      var X = function (u) { return ax0 + w * u; };
      var Y = function (v) { return ay0 + h * v; };
      var cx = X(0.52);
      line(m, [cx, Y(0.12), z], [cx - w * 0.03, Y(0.88), z], K.FINE);        // stem
      /* leaves: two shoulders per node, pointed outlines + a centre vein */
      var SH = [[0.02, 0.00], [0.22, 0.40], [0.48, 0.52], [0.74, 0.36], [0.99, 0.02]];
      for (var i = 0; i < 4; i++) {
        var v = 0.28 + i * 0.155;
        for (var s = 0; s < 2; s++) {
          var side = s ? 1 : -1;
          var bx = cx - w * 0.03 * (v - 0.15), by = Y(v);
          var L = w * (0.30 + 0.05 * (i % 2)), W = h * (0.16 + 0.03 * (i % 2));
          var up = 0.40 + 0.10 * i;                 // both sides reach up
          var cs = Math.sqrt(Math.max(0.05, 1 - up * up));
          var dx = side * cs, dy = up, nx = -dy, ny = dx;
          var pts = [], q;
          for (q = 0; q < SH.length; q++) {
            var t = SH[q][0], ss = SH[q][1];
            pts.push([bx + dx * L * t + nx * W * ss, by + dy * L * t + ny * W * ss, z]);
          }
          for (q = SH.length - 2; q >= 1; q--) {
            var t2 = SH[q][0], s2 = SH[q][1];
            pts.push([bx + dx * L * t2 - nx * W * s2, by + dy * L * t2 - ny * W * s2, z]);
          }
          G.poly(m, pts, { fill: '@plant', kind: K.FINE });
          line(m, [bx, by, z], [bx + dx * L * 0.96, by + dy * L * 0.96, z], K.FINE);
        }
      }
      /* three berries at the crown */
      for (var b = 0; b < 3; b++) {
        var bx2 = cx - w * 0.03 + (b - 1) * w * 0.075, by2 = Y(0.90) + (b === 1 ? h * 0.055 : 0);
        var bp = [], k;
        for (k = 0; k < 5; k++) {
          var a = (k / 5) * Math.PI * 2 + 0.4;
          bp.push([bx2 + Math.cos(a) * w * 0.024, by2 + Math.sin(a) * h * 0.024, z]);
        }
        G.poly(m, bp, { fill: '@plant', kind: K.FINE });
      }
      /* a baseline so the sprig sits on something */
      line(m, [X(0.16), Y(0.10), z], [X(0.84), Y(0.095), z], K.FINE);
    }

    var bigPic = buildPicture({
      id: 'picture.big', label: '挂画 Picture', hint: '点击扶正',
      toast: '画有点歪', cx: -0.58, cy: 1.72, zFront: -2.538, zin: -1,
      w: 0.72, h: 0.92, art: artLandscape
    });
    var smallPic = buildPicture({
      id: 'picture.small', label: '小挂画 Small picture', hint: '点击扶正',
      toast: '画正了', cx: -1.10, cy: 1.62, zFront: 2.538, zin: 1,
      w: 0.50, h: 0.40, art: artSprig
    });

    var picState = [
      { t: 99, life: 2.4, freq: 2.2, peak: 0.070 },
      { t: 99, life: 2.0, freq: 2.6, peak: 0.060 }
    ];
    /* the hit boxes are authored explicitly (z spans the frame's depth) */
    function pictureHit(pic, zA, zB) {
      return { min: [pic.x0 - 0.01, pic.y0 - 0.01, Math.min(zA, zB)],
        max: [pic.x1 + 0.01, pic.y1 + 0.01, Math.max(zA, zB)] };
    }
    (function () {
      var applyBig = rig(bigPic.mesh, [0, bigPic.y1, -2.538]);
      var applySmall = rig(smallPic.mesh, [0, smallPic.y1, 2.538]);
      parts.pictureBig = { mesh: bigPic.mesh, box: [bigPic.x0, bigPic.y0, bigPic.x1, bigPic.y1] };
      parts.pictureSmall = { mesh: smallPic.mesh, box: [smallPic.x0, smallPic.y0, smallPic.x1, smallPic.y1] };
      reg({
        id: 'pictureBig',
        label: '挂画 Picture', hint: '点击扶正', mesh: bigPic.mesh,
        hit: pictureHit(bigPic, -2.596, -2.520), priority: 1,
        onDown: function (ctx) { ctx.audio.play('click'); },
        onClick: function (ctx) {
          picState[0].t = 0; ctx.audio.play('click'); ctx.toast('画有点歪');
        },
        update: function (dt) {
          picState[0].t += dt;
          var a = picState[0].peak * damped(picState[0].t, picState[0].life, picState[0].freq, 0);
          applyBig(function (x, y, z, out) { return rotX(x, y, z, -a, out); });
        }
      });
      reg({
        id: 'pictureSmall',
        label: '小挂画 Small picture', hint: '点击扶正', mesh: smallPic.mesh,
        hit: pictureHit(smallPic, 2.520, 2.596),
        priority: 1,
        onDown: function (ctx) { ctx.audio.play('click'); },
        onClick: function (ctx) {
          picState[1].t = 0; ctx.audio.play('click'); ctx.toast('画扶正了');
        },
        update: function (dt) {
          picState[1].t += dt;
          var a = picState[1].peak * damped(picState[1].t, picState[1].life, picState[1].freq, 0);
          applySmall(function (x, y, z, out) { return rotX(x, y, z, a, out); });
        }
      });
    })();

    /* ======================================================================
       5. 风铃 WIND CHIME — (1.42, 2.30, 1.30), longest tube 0.42
       ====================================================================== */
    var CH = { x: 1.42, z: 1.30, top: CEIL - 0.010 };
    var chPivot = [CH.x, CH.top, CH.z];
    var discY = 2.548, tubeTop = 2.542, rimR = 0.048, tubeR = 0.010;
    var chLens = [0.42, 0.38, 0.34, 0.30, 0.26];
    var chTube = [];
    var chPhi = [], i3;
    for (i3 = 0; i3 < 5; i3++) chPhi.push((i3 / 5) * Math.PI * 2 + 0.32);

    var chimeAsm = S.build(function (m) {
      m.name = 'chime.assembly';
      G.lathe(m, [CH.x, CH.top, CH.z], [
        [-0.030, 0.036], [-0.012, 0.068]
      ], 14, { fill: '@metal', top: true, topFill: '@metalDark', cull: false });
      G.tube(m, [CH.x, CH.top - 0.026, CH.z], [CH.x, discY + 0.012, CH.z], 0.005, 0.005, 6,
        { fill: '@fabricAlt', kind: K.FINE });
      /* wooden disc the tubes hang from */
      G.lathe(m, [CH.x, discY, CH.z], [
        [0.000, 0.055], [0.024, 0.062]
      ], 14, { fill: '@wood', top: true, topFill: '@woodDark', cull: false });
      for (var q = 0; q < 3; q++) {
        var qa = (q / 3) * Math.PI * 2 + 0.5;
        line(m, [CH.x + Math.cos(qa) * 0.055, discY + 0.002, CH.z + Math.sin(qa) * 0.055],
          [CH.x + Math.cos(qa) * 0.045, discY + 0.020, CH.z + Math.sin(qa) * 0.045], K.SOFT);
      }
      /* centre cord, striker and the wind-catcher sail */
      G.tube(m, [CH.x, discY + 0.010, CH.z], [CH.x, 2.112, CH.z], 0.0035, 0.0035, 5,
        { fill: '@fabricAlt', kind: K.SOFT });
      G.tube(m, [CH.x, 2.090, CH.z], [CH.x, 2.114, CH.z], 0.018, 0.016, 8,
        { fill: '@wood', kind: K.FINE });
      G.tube(m, [CH.x, 2.030, CH.z], [CH.x, 2.090, CH.z], 0.0035, 0.0035, 5,
        { fill: '@fabricAlt', kind: K.SOFT });
      G.outline(m, [[0, 0], [1, 0], [0.9, 0.6], [0.35, 1.0], [-0.35, 1.0], [-0.9, 0.6]],
        function (u, v) {
          return [CH.x + u * 0.040, 2.030 - v * 0.088, CH.z + (v > 0.5 ? -0.004 : 0)];
        }, [0, 0, 1], 0.003,
        { fill: '@fabric', kind: K.EDGE, sideKind: K.FINE, silhouette: false });
      line(m, [CH.x, 2.028, CH.z + 0.002], [CH.x, 1.946, CH.z + 0.002], K.FINE);
      m.__asmVertCount = m.verts.length;
      anchorBox(m, [CH.x - 0.105, 1.930, CH.z - 0.105], [CH.x + 0.105, CH.top, CH.z + 0.105]);
    });
    var chimeApply = rig(chimeAsm, chPivot, chimeAsm.__asmVertCount);

    var chimeState = { t: 9, echo: -1, swayX: 0, swayZ: 0, tubes: [] };
    for (i3 = 0; i3 < 5; i3++) {
      (function (idx) {
        var phi = chPhi[idx];
        var ax = CH.x + Math.cos(phi) * rimR;
        var az = CH.z + Math.sin(phi) * rimR;
        var len = chLens[idx];
        var tm = S.build(function (m) {
          m.name = 'chime.tube' + idx;
          G.tube(m, [ax, tubeTop, az], [ax, tubeTop - len, az], tubeR * 1.25, tubeR * 0.85, 6,
            { fill: '@metal', kind: K.FINE });
        });
        var apply = rig(tm, chPivot);
        chTube.push({ mesh: tm, apply: apply, ax: ax, az: az, phi: phi, i: idx });
        chimeState.tubes.push({ a: 0 });
      })(i3);
    }
    parts.chime = {
      pos: [CH.x, 2.30, CH.z], mesh: chimeAsm, tubes: chTube,
      sway: 0, tubeAmp: 0, ring: 0
    };

    reg({
      id: 'chime',
      label: '风铃 Wind chime',
      hint: '点击让它响',
      mesh: chimeAsm,
      hit: { min: [CH.x - 0.105, 1.930, CH.z - 0.105], max: [CH.x + 0.105, CH.top, CH.z + 0.105] },
      dynamicHit: true,
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        chimeState.t = 0;
        chimeState.echo = 0.12;
        ctx.audio.play('chime');
        ctx.toast('风铃响了');
      },
      update: function (dt, ctx) {
        var t = ctx.time || 0;
        chimeState.t += dt;
        if (chimeState.echo > 0) {
          chimeState.echo -= dt;
          if (chimeState.echo <= 0) { chimeState.echo = -1; ctx.audio.play('chime', { soft: true }); }
        }
        /* very slow whole-assembly sway + the damped swing from a click */
        var kick = damped(chimeState.t, 3.0, 1.5, 0);
        var sX = 0.020 * osc(t, 9.0, 0.0) + 0.014 * osc(t, 13.7, 2.2) + 0.105 * kick;
        var sZ = 0.014 * osc(t, 11.3, 1.7) + 0.070 * kick;
        chimeState.swayX = sX; chimeState.swayZ = sZ;
        chimeApply(function (x, y, z, out) {
          rotX(x, y, z, sX, _s0);
          return rotZ(_s0[0], _s0[1], _s0[2], sZ, out);
        });
        /* each tube swings about its own rim point, phase-shifted */
        var ampMax = 0;
        for (var k = 0; k < chTube.length; k++) {
          var tb = chTube[k];
          var amb = 0.05 * osc(t, 1.6 + k * 0.21, 0.7 + k * 1.31);
          var ring = 0.30 * damped(chimeState.t, 3.0, 1.8 + k * 0.24, k * 0.9) * (k % 2 ? -1 : 1);
          var a = amb + ring;
          chimeState.tubes[k].a = a;
          if (Math.abs(a) > ampMax) ampMax = Math.abs(a);
          var ca = Math.cos(tb.phi), sa = Math.sin(tb.phi);
          (function (tube, ang, cc, ss) {
            tube.apply(function (x, y, z, out) {
              var px = x - (tube.ax - chPivot[0]), py = y - (tubeTop - chPivot[1]), pz = z - (tube.az - chPivot[2]);
              rotX(px, py, pz, -ang * ss, _s0);
              rotZ(_s0[0], _s0[1], _s0[2], ang * cc, _s1);
              var qx = _s1[0] + (tube.ax - chPivot[0]);
              var qy = _s1[1] + (tubeTop - chPivot[1]);
              var qz = _s1[2] + (tube.az - chPivot[2]);
              rotX(qx, qy, qz, sX, out);
              return rotZ(out[0], out[1], out[2], sZ, out);
            });
          })(tb, a, ca, sa);
        }
        parts.chime.sway = Math.max(Math.abs(sX), Math.abs(sZ));
        parts.chime.tubeAmp = ampMax;
        parts.chime.ring = chimeState.t;
      }
    });

    /* ======================================================================
       6. 盆栽 POTTED PLANT — (-1.34, 0, 1.86), pot r 0.17 h 0.26, total 0.78
       ====================================================================== */
    var PL = { x: -1.34, z: 1.86, potR: 0.17, potH: 0.262, soilY: 0.222 };

    var potMesh = S.build(function (m) {
      m.name = 'plant.pot';
      G.lathe(m, [PL.x, 0, PL.z], [
        [0.000, 0.112], [0.016, 0.121], [0.038, 0.106], [0.232, 0.166], [PL.potH, 0.172]
      ], 14, { fill: '@accent', top: false, cull: false });
      for (var i = 0; i < 3; i++) {
        var a = (i / 3) * Math.PI * 2 + 0.4;
        line(m, [PL.x + Math.cos(a) * 0.126, 0.030, PL.z + Math.sin(a) * 0.126],
          [PL.x + Math.cos(a) * 0.168, 0.240, PL.z + Math.sin(a) * 0.168], K.SOFT);
      }
      loopXZ(m, [PL.x, PL.potH, PL.z], 0.172, 14, K.EDGE);
      /* soil surface + a few pebbles */
      G.disc(m, [PL.x, PL.soilY, PL.z], 0.157, 14, { axis: 'y', fill: '#3a332c', kind: K.FINE, rim: false });
      var peb = [[0.10, 0.32, 0.013], [-0.07, 0.61, 0.010], [0.04, -0.12, 0.014],
        [-0.11, -0.05, 0.009], [0.13, 0.78, 0.008]];
      for (var p = 0; p < peb.length; p++) {
        var px = PL.x + Math.cos(peb[p][1]) * 0.10 * (0.4 + peb[p][0] * 4),
          pz = PL.z + Math.sin(peb[p][1]) * 0.10 * (0.4 + peb[p][0] * 4);
        var s = peb[p][2], q, pts = [];
        for (q = 0; q < 4; q++) {
          var qa = (q / 4) * Math.PI * 2 + p;
          pts.push([px + Math.cos(qa) * s, PL.soilY + 0.005 + (q % 2) * 0.002, pz + Math.sin(qa) * s]);
        }
        G.poly(m, pts, { fill: p % 2 ? '#7d7466' : '#635b50', kind: K.FINE });
      }
    });

    /* leaf outline: (fraction along the leaf, half-width factor) — a pointed,
       gently curved blade that reads as a leaf and not as a spike */
    var LEAF = [[0.02, 0.00], [0.20, 0.40], [0.46, 0.52], [0.72, 0.38], [0.99, 0.02]];
    /* The west door leaf (hinge z = 1.80, 0.94 long, opens inward) sweeps right
       across the plant, so the foliage is laid out to respect two rules:
         · nothing may reach further into the room than LIMX, and
         · nothing may sit where that leaf comes to rest at 72°.
       Leaves are *steered* (their heading is rotated, keeping the blade shape
       and size) rather than squashed, so the plant keeps a full silhouette. */
    var LIMX = -1.205, LIMX_STEM = -1.245, LEAF_MARGIN = 0.02;
    var DOOR = { hx: -1.70, hz: 1.80, ang: 72 * Math.PI / 180, half: 0.055, len: 0.94, top: 2.06 };
    var dsin = Math.sin(DOOR.ang), dcos = Math.cos(DOOR.ang);
    var dpx = Math.cos(DOOR.ang), dpz = Math.sin(DOOR.ang);
    function inDoor(x, z, margin) {
      var dx = x - DOOR.hx, dz = z - DOOR.hz;
      var d = dx * dsin - dz * dcos;                     // along the resting leaf
      if (d <= -0.02 || d >= DOOR.len + 0.02) return false;
      return Math.abs(dx * dpx + dz * dpz) < DOOR.half + 0.02 + (margin || 0);
    }
    /* a leaf is acceptable when its whole body stays west of LIMX and clear of
       the resting door leaf */
    function leafFits(bx, bz, dx, dz, L, W) {
      for (var t = 0.30; t <= 1.001; t += 0.35) {
        var px = bx + dx * L * t, pz = bz + dz * L * t;
        if (px + W > LIMX) return false;
        if (inDoor(px, pz, W)) return false;
      }
      return true;
    }
    var HEADINGS = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6, 3.1416];
    var leafFaces = 0;
    var foliage = S.build(function (m) {
      m.name = 'plant.foliage';
      var stems = [
        [0.35, 0.030, 0.755, 0.16, 0.10],
        [1.30, 0.048, 0.700, -0.20, 0.06],
        [2.35, 0.026, 0.640, 0.24, -0.12],
        [3.25, 0.052, 0.585, -0.14, -0.22],
        [4.20, 0.034, 0.690, -0.26, 0.14],
        [5.15, 0.044, 0.540, 0.18, -0.20]
      ];
      var i;
      for (i = 0; i < stems.length; i++) {
        var st = stems[i];
        var ba = st[0];
        var br = st[1];
        var bx = PL.x + Math.cos(ba) * br * 0.45, bz = PL.z + Math.sin(ba) * br * 0.45;
        var mx = PL.x + Math.cos(ba) * br * 1.9 + st[3] * 0.22;
        var mz = PL.z + Math.sin(ba) * br * 1.9 + st[4] * 0.22;
        var my = PL.soilY + (st[2] - PL.soilY) * 0.52;
        var tx = PL.x + Math.cos(ba) * br * 2.9 + st[3] * 0.78;
        var tz = PL.z + Math.sin(ba) * br * 2.9 + st[4] * 0.78;
        var ty = st[2];
        if (tx > LIMX_STEM) tx = LIMX_STEM;
        if (mx > LIMX_STEM) mx = LIMX_STEM;
        /* a stem tip that would lean into the resting leaf is drawn back */
        for (var sk = 0; sk < 4 && inDoor(tx, tz, 0.012); sk++) {
          tx = bx + (tx - bx) * 0.72; tz = bz + (tz - bz) * 0.72;
          if (tx > LIMX_STEM) tx = LIMX_STEM;
        }
        G.tube(m, [bx, PL.soilY - 0.03, bz], [mx, my, mz], 0.0125, 0.0092, 3,
          { fill: '@plant', kind: K.FINE, caps: false });
        G.tube(m, [mx, my, mz], [tx, ty, tz], 0.0092, 0.0055, 3,
          { fill: '@plant', kind: K.FINE, caps: false });
        /* 4 leaves per stem, alternating sides, varied size and droop */
        for (var lf = 0; lf < 4; lf++) {
          var tip = lf === 3;
          var t01 = tip ? 1.0 : (0.30 + lf * 0.24);
          var lx = mx + (tx - mx) * t01, ly = my + (ty - my) * t01, lz = mz + (tz - mz) * t01;
          var side = (i + lf) % 2 ? 1 : -1;
          var ang0 = tip ? (ba + 0.5) : (ba + side * (0.95 + 0.30 * lf) + 0.4 * G.rnd(i * 7.3 + lf));
          var L = (tip ? 0.055 : 0.085) + 0.045 * G.rnd(i * 3.1 + lf * 5.7) + (lf === 1 ? 0.014 : 0);
          var W = (tip ? 0.023 : 0.033) + 0.016 * G.rnd(i * 9.7 + lf * 2.3);
          var droop = 0.010 + 0.020 * G.rnd(i * 1.9 + lf) + (lf === 1 ? 0.010 : 0);
          var up = tip ? 0.88 : (0.58 - lf * 0.16);
          var cs = Math.sqrt(Math.max(0.05, 1 - up * up));
          var dy = up;
          var ang2 = ang0;
          var dx = Math.cos(ang0) * cs, dz = Math.sin(ang0) * cs;
          for (var ci = 0; ci < HEADINGS.length; ci++) {
            var a2 = ang0 + HEADINGS[ci];
            var ddx = Math.cos(a2) * cs, ddz = Math.sin(a2) * cs;
            if (leafFits(lx, lz, ddx, ddz, L, W)) { ang2 = a2; dx = ddx; dz = ddz; break; }
          }
          if (!leafFits(lx, lz, dx, dz, L, W)) {
            for (var shrink = 0; shrink < 3 && !leafFits(lx, lz, dx, dz, L, W); shrink++) L *= 0.74;
          }
          var sxs = -Math.sin(ang2), szs = Math.cos(ang2);
          var pts = [], q;
          for (q = 0; q < LEAF.length; q++) {
            var tt = LEAF[q][0], ss = LEAF[q][1];
            pts.push([lx + dx * L * tt + sxs * W * ss,
              ly + dy * L * tt - droop * tt * tt,
              lz + dz * L * tt + szs * W * ss]);
          }
          for (q = LEAF.length - 2; q >= 1; q--) {
            var t2 = LEAF[q][0], s2 = LEAF[q][1];
            pts.push([lx + dx * L * t2 - sxs * W * s2,
              ly + dy * L * t2 - droop * t2 * t2,
              lz + dz * L * t2 - szs * W * s2]);
          }
          G.poly(m, pts, { fill: '@plant', kind: K.FINE });
          line(m, [lx, ly, lz], [lx + dx * L * 0.97, ly + dy * L * 0.97 - droop, lz + dz * L * 0.97], K.FINE);
          leafFaces += 2;
        }
      }
      /* four leaves drooping over the pot rim */
      for (var d = 0; d < 4; d++) {
        var da0 = 0.7 + d * 1.65;
        var L2 = 0.098 + 0.022 * G.rnd(d * 4.4), W2 = 0.034 + 0.008 * G.rnd(d * 8.1);
        var da = da0, dx2 = Math.cos(da0), dz2 = Math.sin(da0);
        for (var cj = 0; cj < HEADINGS.length; cj++) {
          var b2 = da0 + HEADINGS[cj];
          var edx = Math.cos(b2), edz = Math.sin(b2);
          if (leafFits(PL.x + edx * 0.128, PL.z + edz * 0.128, edx, edz, L2, W2)) {
            da = b2; dx2 = edx; dz2 = edz; break;
          }
        }
        var rx = PL.x + dx2 * 0.128, rz = PL.z + dz2 * 0.128;
        var sxs2 = -dz2, szs2 = dx2;
        var pts2 = [], q2;
        for (q2 = 0; q2 < LEAF.length; q2++) {
          var t3 = LEAF[q2][0], s3 = LEAF[q2][1];
          pts2.push([rx + dx2 * L2 * t3 + sxs2 * W2 * s3,
            PL.potH - 0.014 - 0.070 * t3 * t3,
            rz + dz2 * L2 * t3 + szs2 * W2 * s3]);
        }
        for (q2 = LEAF.length - 2; q2 >= 1; q2--) {
          var t4 = LEAF[q2][0], s4 = LEAF[q2][1];
          pts2.push([rx + dx2 * L2 * t4 - sxs2 * W2 * s4,
            PL.potH - 0.014 - 0.070 * t4 * t4,
            rz + dz2 * L2 * t4 - szs2 * W2 * s4]);
        }
        G.poly(m, pts2, { fill: '@plant', kind: K.FINE });
        line(m, [rx, PL.potH - 0.014, rz],
          [rx + dx2 * L2 * 0.97, PL.potH - 0.014 - 0.066, rz + dz2 * L2 * 0.97], K.FINE);
      }
      /* stable hit volume for pot + foliage (never drawn); its east face is
         already inside LIMX so the final clamp leaves the anchors alone */
      m.__vegVertCount = m.verts.length;
      anchorBox(m, [PL.x - 0.340, 0.000, PL.z - 0.340], [LIMX, 0.800, PL.z + 0.340]);
    });
    /* Safety net only — the leaves above are already steered clear. It clamps
       anything east of LIMX and nudges any stray vertex out of the resting
       door leaf's corridor (5.5 cm half-width at 72°). */
    foliage.transform(function (x, y, z) {
      var px = x > LIMX ? LIMX : x;
      if (y < DOOR.top) {
        var dx = px - DOOR.hx, dz = z - DOOR.hz;
        var d = dx * dsin - dz * dcos;
        if (d > 0 && d < DOOR.len) {
          var s = dx * dpx + dz * dpz;
          if (Math.abs(s) < DOOR.half) {
            var ex = px + (DOOR.half - s) * dpx;
            if (ex <= LIMX) { px = ex; z += (DOOR.half - s) * dpz; }
            else { px += (-DOOR.half - s) * dpx; z += (-DOOR.half - s) * dpz; }
          }
        }
      }
      return [px, y, z];
    });
    var plantApply = rig(foliage, [PL.x, 0.02, PL.z], foliage.__vegVertCount);

    var plantState = { t: 9, sway: 0 };
    parts.plant = {
      pos: [PL.x, 0, PL.z], radius: PL.potR, height: 0.78,
      mesh: foliage, potMesh: potMesh, sway: 0
    };

    reg({
      id: 'plant',
      label: '盆栽 Potted plant',
      hint: '点击抖一抖',
      mesh: foliage,
      hit: { min: [PL.x - 0.340, 0.000, PL.z - 0.340], max: [LIMX, 0.800, PL.z + 0.340] },
      dynamicHit: true,
      onDown: function (ctx) { ctx.audio.play('plant'); },
      onClick: function (ctx) {
        plantState.t = 0;
        ctx.audio.play('plant');
        ctx.toast('叶子抖了抖');
      },
      update: function (dt, ctx) {
        var t = ctx.time || 0;
        plantState.t += dt;
        var ambA = 0.0070 * osc(t, 7.0, 0.35);
        var ambB = 0.0052 * osc(t, 8.3, 2.10);
        var sh = damped(plantState.t, 1.8, 2.3, 0);
        var aX = ambA + 0.040 * sh;
        var aZ = ambB + 0.030 * sh;
        plantState.sway = Math.max(Math.abs(aX), Math.abs(aZ));
        parts.plant.sway = plantState.sway;
        plantApply(function (x, y, z, out) {
          rotX(x, y, z, aX, _s0);
          return rotZ(_s0[0], _s0[1], _s0[2], aZ, out);
        });
      }
    });

    /* ---------------------------------------------------------------------- */
    /* parts.fan / .pendant / .clock / .pictureBig / .pictureSmall / .chime /
       .plant are the handles other modules and main.js may read. */
    return parts;
  };
})(typeof window !== 'undefined' ? window : globalThis);
