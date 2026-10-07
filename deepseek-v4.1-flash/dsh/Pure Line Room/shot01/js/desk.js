/* =============================================================================
   Pure Line Room — desk.js   (书桌区 / the desk zone)
   x 0.90…1.70 , z -2.15…0.15   — nothing outside this box.

   Contents: the writing desk (top with an edge band, two-drawer box, apron,
   tapered legs, modesty panel, cable hole), the articulated desk lamp with a
   lathed shade, the mug with a tube-arc handle and steam, the notebook with a
   flipping page and a pen, the pencil cup with four sticks, and the globe on a
   meridian ring.

   Everything is authored the way the room is: every face is filled with a
   near-white material key and carries its own stroke, and every block is
   tapered, banded, inset or bevelled so nothing reads as a plain cube.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;
  var K = P.K;
  var G = P.geom;

  /* ---------------------------------------------------------------------------
     local fallbacks — the runtime supplies PLR.anim, but the module must still
     behave if it is loaded on its own (see _dev/smoke_desk.mjs).
     ------------------------------------------------------------------------- */
  var FALLBACK_ANIM = {
    approach: function (cur, target, speed, dt) {
      if (!(dt > 0)) return cur;
      return target + (cur - target) * Math.exp(-speed * dt);
    },
    osc: function (t, period, phase) {
      return Math.sin((t / (period || 1) + (phase || 0)) * Math.PI * 2);
    },
    ease: {
      linear: function (t) { return t; },
      inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
      out: function (t) { return 1 - Math.pow(1 - t, 3); }
    }
  };

  function animOf(ctx) {
    return (ctx && ctx.anim) || global.PLR.anim || FALLBACK_ANIM;
  }
  function easeInOut(t) {
    t = M.clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* ---------------------------------------------------------------------------
     drawing helpers (thin wrappers over PLR.geom so every face gets a stroke)
     ------------------------------------------------------------------------- */
  function face(m, pts, nrm, o) {
    o = o || {};
    var vi = m.vertices(pts);
    if (nrm) {
      var n = M.polyNormal(m.verts, vi);
      if (n[0] * nrm[0] + n[1] * nrm[1] + n[2] * nrm[2] < 0) vi.reverse();
    }
    return m.face(vi, {
      fill: o.fill === undefined ? null : o.fill,
      kind: o.kind || K.EDGE,
      cull: o.cull !== false,
      glow: o.glow || 0,
      shade: o.shade || 0
    });
  }

  function line(m, a, b, kind, glow) {
    return m.face(m.vertices([a, b, a]), { fill: null, kind: kind || K.FINE, glow: glow || 0 });
  }

  function loop(m, pts, kind, glow) {
    for (var i = 0; i < pts.length; i++) line(m, pts[i], pts[(i + 1) % pts.length], kind, glow);
  }

  function polyline(m, pts, kind, glow) {
    for (var i = 0; i + 1 < pts.length; i++) line(m, pts[i], pts[i + 1], kind, glow);
  }

  /**
   * A closed block with per-face material keys and a selectable set of explicit
   * edge strokes. `open` skips faces that can never be seen; `edges` is one of
   * 'all' | 'rim' | 'top' | 'vert' | false.
   */
  function slab(m, x0, x1, y0, y1, z0, z1, o) {
    o = o || {};
    var f = o.fill === undefined ? null : o.fill;
    var sf = o.sideFill === undefined ? f : o.sideFill;
    var tf = o.topFill === undefined ? f : o.topFill;
    var bf = o.botFill === undefined ? f : o.botFill;
    var k = o.kind || K.EDGE;
    var sk = o.sideKind || k;
    var sh = o.shade || 0;
    var op = o.open || {};
    var out = {};
    if (!op.px) out.px = face(m, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], { fill: sf, kind: sk, shade: sh + 0.02, glow: o.glow });
    if (!op.nx) out.nx = face(m, [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0], { fill: sf, kind: sk, shade: sh + 0.03, glow: o.glow });
    if (!op.pz) out.pz = face(m, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], { fill: sf, kind: sk, shade: sh, glow: o.glow });
    if (!op.nz) out.nz = face(m, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], { fill: sf, kind: sk, shade: sh + 0.04, glow: o.glow });
    if (!op.py) out.py = face(m, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], { fill: tf, kind: o.topKind || k, shade: sh, glow: o.glow });
    if (!op.ny) out.ny = face(m, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], { fill: bf, kind: o.botKind || K.FINE, shade: sh + 0.05, glow: o.glow });
    var e = o.edges;
    if (e) {
      var C = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
               [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      var top = [4, 5, 6, 7], bot = [0, 1, 2, 3], vert = [[0, 4], [1, 5], [2, 6], [3, 7]];
      var i;
      if (e === 'all' || e === 'rim' || e === 'top') for (i = 0; i < 4; i++) line(m, C[top[i]], C[top[(i + 1) % 4]], o.edgeKind || k);
      if (e === 'all' || e === 'rim') for (i = 0; i < 4; i++) line(m, C[bot[i]], C[bot[(i + 1) % 4]], o.edgeKind || K.FINE);
      if (e === 'all' || e === 'rim' || e === 'vert') for (i = 0; i < 4; i++) line(m, C[vert[i][0]], C[vert[i][1]], o.edgeKind || k);
    }
    return out;
  }

  /** Tapered post (leg): square section shrinking from the top to the floor. */
  function taperedPost(m, cx, cz, y0, y1, wTop, wBot, o) {
    o = o || {};
    var ht = wTop / 2, hb = wBot / 2;
    var X0 = cx - hb, X1 = cx + hb, Z0 = cz - hb, Z1 = cz + hb;
    var x0 = cx - ht, x1 = cx + ht, z0 = cz - ht, z1 = cz + ht;
    var bx0 = cx - ht * 1.06, bx1 = cx + ht * 1.06, bz0 = cz - ht * 1.06, bz1 = cz + ht * 1.06;
    var sh = o.fill === undefined ? null : o.fill;
    face(m, [[X1, y0, Z0], [X1, y0, Z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], { fill: sh, kind: K.EDGE, shade: 0.02 });
    face(m, [[X0, y0, Z1], [X0, y0, Z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0], { fill: sh, kind: K.EDGE, shade: 0.03 });
    face(m, [[X0, y0, Z1], [X1, y0, Z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], { fill: sh, kind: K.EDGE, shade: 0.0 });
    face(m, [[X1, y0, Z0], [X0, y0, Z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], { fill: sh, kind: K.EDGE, shade: 0.04 });
    face(m, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], { fill: sh, kind: K.EDGE });
    face(m, [[X0, y0, Z0], [X1, y0, Z0], [X1, y0, Z1], [X0, y0, Z1]], [0, -1, 0], { fill: sh, kind: K.FINE, shade: 0.06 });
    // the four arrises: the verticals are what make a tapered leg read
    line(m, [X0, y0, Z0], [x0, y1, z0], K.EDGE);
    line(m, [X1, y0, Z0], [x1, y1, z0], K.EDGE);
    line(m, [X1, y0, Z1], [x1, y1, z1], K.EDGE);
    line(m, [X0, y0, Z1], [x0, y1, z1], K.EDGE);
    line(m, [X0, y0, Z0], [X1, y0, Z0], K.FINE);
    line(m, [X1, y0, Z0], [X1, y0, Z1], K.FINE);
    line(m, [X1, y0, Z1], [X0, y0, Z1], K.FINE);
    line(m, [X0, y0, Z1], [X0, y0, Z0], K.FINE);
    // a turned collar under the top: a band that breaks the leg's plain run
    slab(m, bx0, bx1, y1 - 0.026, y1, bz0, bz1, { fill: o.fill, kind: K.EDGE, edges: 'top' });
  }

  /** Flat annulus (a real ring of faces, e.g. a mug rim or a cable grommet). */
  function annulus(m, cx, cy, cz, rIn, rOut, segs, o) {
    o = o || {};
    var i0 = G.circlePts(cx, cy, cz, rIn, segs, 'y');
    var o0 = G.circlePts(cx, cy, cz, rOut, segs, 'y');
    for (var i = 0; i < segs; i++) {
      var j = (i + 1) % segs;
      face(m, [i0[i], o0[i], o0[j], i0[j]], [0, 1, 0], { fill: o.fill, kind: o.kind || K.FINE, cull: o.cull });
    }
  }

  /* ---- rotation about an arbitrary axis through a point (Rodrigues) -------- */
  function rotAxis(p, c, u, ang) {
    var x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    var cs = Math.cos(ang), sn = Math.sin(ang);
    var d = u[0] * x + u[1] * y + u[2] * z;
    var ax = u[1] * z - u[2] * y, ay = u[2] * x - u[0] * z, az = u[0] * y - u[1] * x;
    var k = 1 - cs;
    return [
      c[0] + x * cs + ax * sn + u[0] * d * k,
      c[1] + y * cs + ay * sn + u[1] * d * k,
      c[2] + z * cs + az * sn + u[2] * d * k
    ];
  }

  /** Cache the untouched geometry of a mesh so it can be re-posed every frame. */
  function snapshot(mesh) {
    var out = [];
    for (var i = 0; i < mesh.verts.length; i++) out.push([mesh.verts[i][0], mesh.verts[i][1], mesh.verts[i][2]]);
    return out;
  }

  function poseFrom(mesh, base, fn) {
    for (var i = 0; i < base.length; i++) {
      var p = fn(base[i]);
      var v = mesh.verts[i];
      v[0] = p[0]; v[1] = p[1]; v[2] = p[2];
    }
    mesh.invalidate();
  }

  /** The live paper colour, so a lamp shade stays in step with the room. */
  function paperOf(env) {
    if (P.palette && P.palette.build) {
      try { return P.palette.build(env || {}).mat.paper; } catch (err) { /* fall through */ }
    }
    return '#f4f2ec';
  }

  /* ===========================================================================
     §3.1  the desk
     =========================================================================== */
  var DESK = {
    x0: 0.960, x1: 1.680, z0: -1.925, z1: -0.175,
    topY: 0.755, yBot: 0.720, cx: 1.320, cz: -1.050
  };
  var LIP = 0.0125;                    // height of the lipped edge band
  var INSET = 0.010;                   // carcass plane, inset from the top edge
  var CARC = { x0: DESK.x0 + INSET, x1: DESK.x1 - INSET, z0: DESK.z0 + INSET, z1: DESK.z1 - INSET };

  function buildDesk(S, parts) {
    /* ---- the top: three planks over a recessed sub-top (a real edge band) -- */
    var top = S.addMesh();
    var t0 = DESK.x0, t1 = DESK.x1, s0 = DESK.z0, s1 = DESK.z1;
    var y1 = DESK.topY, y0 = DESK.topY - LIP;
    var planks = [t0, 1.200, 1.440, t1];
    // The boards are cut into short lengths: one quad spanning the whole 1.75 m
    // would out-sort the objects standing on the far half of the desk and paint
    // over them (painter's algorithm), so each plank is 6 boards long.
    var ROWS = 6;
    var i, j, k;
    for (i = 0; i + 1 < planks.length; i++) {
      var px0 = planks[i], px1 = planks[i + 1];
      for (k = 0; k < ROWS; k++) {
        var rz0 = s0 + (s1 - s0) * k / ROWS, rz1 = s0 + (s1 - s0) * (k + 1) / ROWS;
        // The board joints along z are invisible (fill only, no stroke): they
        // exist purely to keep the depth sort local. The plank seams below are
        // what the eye reads.
        var fi = face(top, [[px0, y1, rz1], [px1, y1, rz1], [px1, y1, rz0], [px0, y1, rz0]], [0, 1, 0], {
          fill: (i % 2) ? '@woodDark' : '@wood', kind: K.SOFT, shade: i * 0.008
        });
        top.faces[fi].kind = null;
      }
      // grain: one wandering line per plank, floated a hair above the face
      var gx = px0 + 0.078 + i * 0.012;
      polyline(top, [
        [gx, y1 + 0.0006, s0 + 0.05],
        [gx + 0.014, y1 + 0.0006, (s0 + s1) / 2],
        [gx - 0.010, y1 + 0.0006, s1 - 0.07]
      ], K.SOFT);
    }
    // the two plank seams, drawn full length over the boards
    line(top, [1.200, y1 + 0.0005, s0], [1.200, y1 + 0.0005, s1], K.FINE);
    line(top, [1.440, y1 + 0.0005, s0], [1.440, y1 + 0.0005, s1], K.FINE);
    // chamfer hint just inside the silhouette, then the silhouette itself
    var cIn = 0.008;
    var yc = y1 + 0.0007;
    loop(top, [
      [t0 + cIn, yc, s1 - cIn], [t1 - cIn, yc, s1 - cIn],
      [t1 - cIn, yc, s0 + cIn], [t0 + cIn, yc, s0 + cIn]
    ], K.FINE);
    // the edge band: a 12.5 mm lip, then the recessed sub-top below it
    var lipE = 0.0002;
    slab(top, t0 - lipE, t1 + lipE, y0, y1, s0 - lipE, s1 + lipE, {
      fill: '@woodDark', sideFill: '@woodDark', kind: K.EDGE,
      open: { py: true, ny: true }, edges: 'rim', edgeKind: K.FINE
    });
    slab(top, CARC.x0, CARC.x1, DESK.yBot, y0, CARC.z0, CARC.z1, {
      fill: '@woodDark', kind: K.EDGE, open: { py: true }, edges: 'rim', edgeKind: K.FINE, shade: 0.03
    });
    // the end grain of the sub-top: a rabbet line and two fixing screws, which
    // is what the default camera actually sees of the desk's construction
    line(top, [CARC.x0, y0 - 0.008, CARC.z1 + 0.0005], [CARC.x1, y0 - 0.008, CARC.z1 + 0.0005], K.FINE);
    screw(top, 1.040, (DESK.yBot + y0) / 2, CARC.z1 + 0.0008, [0, 0, 1], 0.007);
    screw(top, 1.600, (DESK.yBot + y0) / 2, CARC.z1 + 0.0008, [0, 0, 1], 0.007);
    // the desk's one true silhouette: the rim of the top
    loop(top, [[t0, y1 + 0.0008, s1], [t1, y1 + 0.0008, s1], [t1, y1 + 0.0008, s0], [t0, y1 + 0.0008, s0]], K.SIL);
    // a cable hole near the south-east corner: grommet ring over a dark well
    var hx = 1.615, hz = -0.215, hr = 0.019;
    face(top, G.circlePts(hx, y1 - 0.004, hz, hr * 0.92, 10, 'y'), [0, 1, 0], { fill: '#3c3b42', kind: K.FINE });
    annulus(top, hx, y1 + 0.0005, hz, hr * 0.92, hr * 1.24, 10, { fill: '@metalDark', kind: K.FINE });
    loop(top, G.circlePts(hx, y1 + 0.0006, hz, hr * 1.24, 10, 'y'), K.FINE);
    parts.deskTop = top;

    /* ---- legs, apron, modesty panel ---------------------------------------- */
    var base = S.addMesh();
    var lw = CARC.x0 + 0.026, le = CARC.x1 - 0.026;
    var ls = CARC.z1 - 0.026, ln = CARC.z0 + 0.026;
    taperedPost(base, lw, ls, 0, DESK.yBot, 0.052, 0.034, { fill: '@wood' });
    taperedPost(base, le, ls, 0, DESK.yBot, 0.052, 0.034, { fill: '@wood' });
    taperedPost(base, lw, ln, 0, DESK.yBot, 0.052, 0.034, { fill: '@wood' });
    taperedPost(base, le, ln, 0, DESK.yBot, 0.052, 0.034, { fill: '@wood' });

    var ay0 = 0.652, ay1 = DESK.yBot, at = 0.024;
    // west apron (the user's side) — stops short of the drawer box
    slab(base, CARC.x0, CARC.x0 + at, ay0, ay1, -1.889, -0.211, { fill: '@wood', kind: K.EDGE, edges: 'all' });
    // south and north aprons
    slab(base, CARC.x0, CARC.x1, ay0, ay1, CARC.z1 - at, CARC.z1, { fill: '@wood', kind: K.EDGE, edges: 'all' });
    slab(base, CARC.x0, CARC.x1, ay0, ay1, CARC.z0, CARC.z0 + at, { fill: '@wood', kind: K.EDGE, edges: 'all' });
    // modesty panel against the wall side, with a pair of stiffening lines
    slab(base, CARC.x1 - 0.022, CARC.x1, 0.330, ay1, -1.880, -0.220, {
      fill: '@wood', sideFill: '@woodDark', kind: K.EDGE, edges: 'rim', edgeKind: K.FINE, shade: 0.03
    });
    line(base, [CARC.x1 - 0.011, 0.330, -1.880], [CARC.x1 - 0.011, 0.330, -0.220], K.FINE);
    line(base, [CARC.x1 - 0.011, 0.560, -1.880], [CARC.x1 - 0.011, 0.560, -0.220], K.SOFT);
    parts.deskBase = base;

    /* ---- drawer box on the north half (fronts face the user, i.e. -x) ------ */
    var bx = S.addMesh();
    var B = { x0: 1.000, x1: 1.640, y0: 0.548, y1: DESK.yBot, z0: -1.858, z1: -1.248 };
    slab(bx, B.x0, B.x1, B.y0, B.y1, B.z0, B.z1, {
      fill: '@wood', sideFill: '@woodDark', kind: K.EDGE, open: { py: true }, shade: 0.02
    });
    // the carcass' south end: rabbet lines and two screws
    line(bx, [B.x0, B.y0 + 0.012, B.z1], [B.x1, B.y0 + 0.012, B.z1], K.FINE);
    line(bx, [B.x0 + 0.030, B.y0, B.z1], [B.x0 + 0.030, B.y1, B.z1], K.FINE);
    screw(bx, B.x0 + 0.030, B.y0 + 0.006, B.z1 + 0.0006, [0, 0, 1], 0.006);
    screw(bx, B.x1 - 0.030, B.y0 + 0.006, B.z1 + 0.0006, [0, 0, 1], 0.006);

    var fronts = [[-1.850, -1.559], [-1.549, -1.258]];
    var fy0 = 0.560, fy1 = 0.688, fx0 = 0.992, fx1 = 1.002;
    for (i = 0; i < fronts.length; i++) {
      var fz0 = fronts[i][0], fz1 = fronts[i][1];
      slab(bx, fx0, fx1, fy0, fy1, fz0, fz1, {
        fill: '@wood', sideFill: '@woodDark', kind: K.EDGE, edges: 'rim', edgeKind: K.FINE
      });
      // the inset panel line, floated just proud of the drawer face
      var ix = fx0 - 0.0008;
      loop(bx, [
        [ix, fy0 + 0.014, fz1 - 0.016], [ix, fy1 - 0.014, fz1 - 0.016],
        [ix, fy1 - 0.014, fz0 + 0.016], [ix, fy0 + 0.014, fz0 + 0.016]
      ], K.FINE);
      // turned knob on a short stem
      var kz = (fz0 + fz1) / 2, ky = (fy0 + fy1) / 2;
      G.tube(bx, [fx0, ky, kz], [fx0 - 0.006, ky, kz], 0.006, 0.0045, 6, { fill: '@metalDark', caps: true, kind: K.FINE });
      G.tube(bx, [fx0 - 0.006, ky, kz], [fx0 - 0.020, ky, kz], 0.0075, 0.011, 8, { fill: '@metal', caps: true, kind: K.EDGE });
      if (i === 0) {
        face(bx, G.circlePts(fx0 - 0.0012, fy1 - 0.024, kz, 0.0055, 8, 'x'), [-1, 0, 0], { fill: '#4a4640', kind: K.FINE });
        line(bx, [fx0 - 0.0015, fy1 - 0.024, kz - 0.004], [fx0 - 0.0015, fy1 - 0.026, kz + 0.004], K.FINE);
      }
    }
    parts.deskDrawers = bx;
    return top;
  }

  /** A screw: two crossing slots read at almost no cost. */
  function screw(m, x, y, z, nrm, r) {
    var a = nrm[0] ? [0, r, 0] : (nrm[1] ? [r, 0, 0] : [r, 0, 0]);
    var b = nrm[1] ? [0, 0, r] : [0, r, 0];
    line(m, [x - a[0], y - a[1], z - a[2]], [x + a[0], y + a[1], z + a[2]], K.FINE);
    line(m, [x - b[0], y - b[1], z - b[2]], [x + b[0], y + b[1], z + b[2]], K.FINE);
  }

  /* ===========================================================================
     §3.2  the desk lamp — click to switch it on
     =========================================================================== */
  var LAMP = { x: 1.500, y: 0.755, z: -1.720 };
  var SHADE_ORIGIN = [1.470, 1.108, -1.576];
  var SHADE_TILT = -35 * Math.PI / 180;        // mouth tips south, over the desk
  var BULB_LOCAL = [0, -0.044, 0];

  function shadeXform(p) {
    var c = Math.cos(SHADE_TILT), s = Math.sin(SHADE_TILT);
    return [
      SHADE_ORIGIN[0] + p[0],
      SHADE_ORIGIN[1] + p[1] * c - p[2] * s,
      SHADE_ORIGIN[2] + p[1] * s + p[2] * c
    ];
  }

  function buildLamp(S, parts) {
    var m = S.addMesh();
    var bx = LAMP.x, by = LAMP.y, bz = LAMP.z;

    // dished base: a lathe, 12 sides, with a snapped edge.
    // (PLR.geom.lathe winds its quads inward, so these are drawn unculled: for a
    //  convex shell the painter sort is exact and the form still reads solid.)
    G.lathe(m, [bx, by, bz], [[0, 0.086], [0.010, 0.090], [0.030, 0.046]], 12,
      { fill: '@metalDark', top: true, topFill: '@metal', contourKind: K.SOFT, cull: false });
    loop(m, G.circlePts(bx, by + 0.010, bz, 0.0905, 12, 'y'), K.FINE);
    loop(m, G.circlePts(bx, by + 0.030, bz, 0.0465, 12, 'y'), K.FINE);

    // the arm: two tube segments with a real joint between them
    var a0 = [bx, by + 0.026, bz];
    var a1 = [1.478, 0.960, -1.660];
    var a2 = [1.470, 1.148, -1.624];
    G.tube(m, a0, a1, 0.009, 0.0075, 8, { fill: '@metal', kind: K.EDGE, fills: true });
    G.lathe(m, a1, [[-0.013, 0.008], [0.000, 0.016], [0.013, 0.008]], 8, { fill: '@metalDark', base: false, cull: false });
    loop(m, G.circlePts(a1[0], a1[1], a1[2], 0.0165, 8, 'y'), K.FINE);
    G.tube(m, a1, a2, 0.0075, 0.006, 8, { fill: '@metal', kind: K.EDGE, fills: true });
    line(m, [a1[0] + 0.0078, a1[1], a1[2]], [a2[0] + 0.0062, a2[1], a2[2]], K.FINE);

    // the shade, lathed around its own axis then tipped over the desk
    var shade = S.addMesh();
    var SEG = 14;
    // open mouth + no back-face culling: the convex cone then shows its own
    // inner wall when the eye looks up into it (and the painter sort is exact
    // for a convex shell, so nothing pops).
    var srows = G.lathe(shade, [0, 0, 0],
      [[-0.080, 0.072], [-0.058, 0.069], [0.020, 0.038], [0.080, 0.025]], SEG,
      { fill: '@paper', top: true, topFill: '@metalDark', base: false, cull: false });
    var coneFaces = (srows.length - 1) * SEG;      // the brightened surface
    var capFace = coneFaces;
    var mouth0 = shade.faces.length;
    loop(shade, G.circlePts(0, -0.080, 0, 0.0725, SEG, 'y'), K.FINE);
    var mouthFaces = [];
    for (i = mouth0; i < shade.faces.length; i++) mouthFaces.push(i);
    // the bulb, sitting in the mouth
    var bulb0 = shade.faces.length;
    G.tube(shade, [0, -0.062, 0], [0, -0.020, 0], 0.018, 0.013, 7, { fill: '#f3ecdc', caps: true, kind: K.FINE });
    var bulbFaces = [];
    for (var i = bulb0; i < shade.faces.length; i++) {
      if (shade.faces[i].fill !== null) bulbFaces.push(i);
    }
    poseFrom(shade, snapshot(shade), shadeXform);

    // the switch: a nub on the rim of the base, its own mesh so it can rock
    var knob = S.addMesh();
    var kdir = M.norm([-0.62, 0, 0.78]);
    var kPivot = [bx + kdir[0] * 0.086, by + 0.012, bz + kdir[2] * 0.086];
    var kt = [-kdir[2], 0, kdir[0]];               // tangential (rocking) axis
    slab(knob, -0.010, 0.010, -0.007, 0.007, -0.012, 0.002, {
      fill: '@metal', kind: K.EDGE, edges: 'rim', edgeKind: K.FINE, shade: 0.02
    });
    var kbase = snapshot(knob);
    (function () {
      for (var i = 0; i < kbase.length; i++) {
        var p = kbase[i];
        kbase[i] = [
          kPivot[0] + kdir[0] * (p[2] + 0.006) + kt[0] * p[0],
          kPivot[1] + p[1],
          kPivot[2] + kdir[2] * (p[2] + 0.006) + kt[2] * p[0]
        ];
      }
      poseFrom(knob, kbase, function (p) { return p; });
    })();

    var bulbWorld = shadeXform(BULB_LOCAL);
    parts.lamp = m;
    parts.lampShade = shade;
    parts.lampKnob = knob;
    parts.lampBulb = bulbWorld;
    return {
      mesh: m, shade: shade, knob: knob, knobBase: kbase, knobPivot: kPivot, knobAxis: kt,
      coneFaces: coneFaces, capFace: capFace, bulbFaces: bulbFaces, mouthFaces: mouthFaces, bulb: bulbWorld
    };
  }

  /* ===========================================================================
     §3.3  the mug — click to steam
     =========================================================================== */
  function buildMug(S, parts) {
    var m = S.addMesh();
    var cx = 1.440, cy = 0.755, cz = -1.300;
    var SEG = 14;
    var rows = G.lathe(m, [cx, cy, cz],
      [[0.000, 0.034], [0.006, 0.0455], [0.078, 0.0445], [0.095, 0.0462]], SEG,
      { fill: '@paper', base: true, cull: false });
    // rim: a flat annulus of porcelain, then the inner wall line
    annulus(m, cx, cy + 0.095, cz, 0.0405, 0.0462, SEG, { fill: '@paper', kind: K.FINE });
    loop(m, G.circlePts(cx, cy + 0.0955, cz, 0.0405, SEG, 'y'), K.FINE);
    loop(m, G.circlePts(cx, cy + 0.0955, cz, 0.0463, SEG, 'y'), K.SOFT);
    // coffee, a shade below the rim (wide enough to close the mouth)
    face(m, G.circlePts(cx, cy + 0.081, cz, 0.0448, SEG, 'y'), [0, 1, 0], { fill: '#5b3f2c', kind: K.FINE });
    face(m, G.circlePts(cx + 0.012, cy + 0.0815, cz - 0.010, 0.0175, 8, 'y'), [0, 1, 0], { fill: '#7d573b', kind: K.SOFT });
    // a blown-cream swirl, so the surface is not a flat disc
    face(m, G.circlePts(cx - 0.014, cy + 0.0813, cz + 0.014, 0.0115, 7, 'y'), [0, 1, 0], { fill: '@paper', kind: K.SOFT });

    // the handle: a tube arc swept along a half ellipse (7 segments)
    var dir = M.norm([0.72, 0, 0.69]);
    var pts = [], N = 7;
    for (var i = 0; i <= N; i++) {
      var th = (-90 + 180 * i / N) * Math.PI / 180;
      var rr = 0.045 + 0.040 * Math.cos(th);
      var yy = cy + 0.046 + 0.029 * Math.sin(th);
      pts.push([cx + dir[0] * rr, yy, cz + dir[2] * rr]);
    }
    for (i = 0; i < N; i++) {
      G.tube(m, pts[i], pts[i + 1], 0.0068, 0.0068, 5, { fill: '@paper', caps: false, kind: K.EDGE });
    }
    polyline(m, [pts[0], pts[1], pts[2]], K.SOFT);
    polyline(m, [pts[N - 2], pts[N - 1], pts[N]], K.SOFT);
    // a foot band, so the mug is not a bare tube
    loop(m, G.circlePts(cx, cy + 0.010, cz, 0.0452, SEG, 'y'), K.FINE);
    parts.mug = m;
    parts.mugRim = [cx, cy + 0.095, cz];
    // where the steam is anchored (main.js draws the ribbon from here)
    parts.steam = { origin: [cx, cy + 0.098, cz], on: true, strength: 0.0, radius: 0.045 };
    return { mesh: m, origin: [cx, cy + 0.098, cz] };
  }

  /* ===========================================================================
     §3.4  the notebook and the pen
     =========================================================================== */
  function buildNotebook(S, parts) {
    var m = S.addMesh();
    var X0 = 1.120, X1 = 1.320, Z0 = -1.160, Z1 = -0.880;
    var y0 = 0.755, y1 = 0.764, y2 = 0.776;
    // cover, slightly larger than the block, with a spine and a border
    slab(m, X0, X1, y0, y1, Z0, Z1, {
      fill: '@accent', sideFill: '@accent', kind: K.EDGE, edges: 'rim', edgeKind: K.FINE, shade: 0.015
    });
    line(m, [X0 + 0.009, y1 + 0.0006, Z0 + 0.003], [X0 + 0.009, y1 + 0.0006, Z1 - 0.003], K.EDGE);
    line(m, [X0 + 0.015, y1 + 0.0006, Z0 + 0.003], [X0 + 0.015, y1 + 0.0006, Z1 - 0.003], K.SOFT);
    loop(m, [
      [X1 - 0.012, y1 + 0.0007, Z1 - 0.028], [X1 - 0.030, y1 + 0.0007, Z1 - 0.028],
      [X1 - 0.030, y1 + 0.0007, Z0 + 0.028], [X1 - 0.012, y1 + 0.0007, Z0 + 0.028]
    ], K.SOFT);
    // the page block, with fore-edge lines that say "many sheets"
    slab(m, X0 + 0.006, X1 - 0.004, y1, y2, Z0 + 0.008, Z1 - 0.008, {
      fill: '@paper', sideFill: '@paper', kind: K.FINE, open: { ny: true, py: true }, edges: false
    });
    for (var i = 1; i <= 5; i++) {
      var yy = y1 + (y2 - y1) * i / 6;
      line(m, [X1 - 0.0032 + 0.0008, yy, Z0 + 0.008], [X1 - 0.0032 + 0.0008, yy, Z1 - 0.008], K.SOFT);
      line(m, [X0 + 0.006, yy, Z1 - 0.0072], [X1 - 0.004, yy, Z1 - 0.0072], K.SOFT);
    }
    line(m, [X0 + 0.006, y2, Z1 - 0.008], [X1 - 0.004, y2, Z1 - 0.008], K.FINE);
    line(m, [X0 + 0.006, y2, Z0 + 0.008], [X1 - 0.004, y2, Z0 + 0.008], K.FINE);

    // ribbon bookmark, folded over the south edge
    var rz = Z1 - 0.014, rx0 = 1.232, rx1 = 1.248;
    face(m, [[rx0, y2 + 0.0006, rz - 0.082], [rx1, y2 + 0.0006, rz - 0.082], [rx1, y2 + 0.0006, rz + 0.024], [rx0, y2 + 0.0006, rz + 0.024]], [0, 1, 0], { fill: '#c2604f', kind: K.FINE });
    face(m, [[rx0, y2 - 0.024, rz + 0.025], [rx1, y2 - 0.024, rz + 0.025], [rx1, y2 + 0.001, rz + 0.024], [rx0, y2 + 0.001, rz + 0.024]], [0, 0, 1], { fill: '#c2604f', kind: K.FINE });
    line(m, [rx0, y2 - 0.024, rz + 0.0252], [rx1, y2 - 0.024, rz + 0.0252], K.SOFT);

    // the pen, resting to the east of the block
    var px = 1.352, pz0 = -1.118, pz1 = -0.930;
    G.tube(m, [px, 0.7625, pz0], [px - 0.008, 0.7612, pz1], 0.0068, 0.0064, 8, { fill: '@accent', caps: true, kind: K.EDGE, fills: true });
    G.tube(m, [px - 0.008, 0.7612, pz1], [px - 0.012, 0.7604, pz1 + 0.026], 0.0064, 0.0009, 8, { fill: '@metalDark', caps: true, kind: K.FINE });
    line(m, [px + 0.0062, 0.7612, pz1 + 0.006], [px + 0.0062, 0.7612, pz1 - 0.026], K.FINE);
    polyline(m, [[px + 0.0055, 0.7682, pz0 + 0.004], [px + 0.0088, 0.7690, pz0 + 0.020], [px + 0.0088, 0.7630, pz0 + 0.023]], K.FINE);
    line(m, [px, 0.756, pz0], [px, 0.756, pz0 - 0.020], K.SOFT);

    /* the sheet that flips — its own mesh, hinged on the spine */
    var flip = S.addMesh();
    slab(flip, X0 + 0.010, X1 - 0.006, y2, y2 + 0.0016, Z0 + 0.014, Z1 - 0.016, {
      fill: '@paper', sideFill: '@paper', kind: K.FINE, open: { ny: true }, edges: 'top', edgeKind: K.FINE
    });
    parts.notebook = m;
    parts.pageFlip = flip;
    return { mesh: m, flip: flip, hingeX: X0 + 0.010, hingeY: y2, z0: Z0 + 0.014, z1: Z1 - 0.016, ribbon: null };
  }

  /* ===========================================================================
     §3.5  the pencil cup
     =========================================================================== */
  function buildPencilCup(S, parts) {
    var m = S.addMesh();
    var cx = 1.500, cy = 0.755, cz = -0.550;
    var SEG = 14;
    G.lathe(m, [cx, cy, cz], [[0.000, 0.036], [0.008, 0.040], [0.070, 0.0388], [0.100, 0.0408]], SEG,
      { fill: '@metalDark', cull: false });
    annulus(m, cx, cy + 0.100, cz, 0.0345, 0.0408, SEG, { fill: '@metal', kind: K.FINE });
    loop(m, G.circlePts(cx, cy + 0.1005, cz, 0.0345, SEG, 'y'), K.FINE);
    loop(m, G.circlePts(cx, cy + 0.052, cz, 0.0402, SEG, 'y'), K.SOFT);

    // four sticks at different leans, each with a body and a contrasting tip.
    // The two long ones clear the globe's ball, which stands between the cup and
    // the default camera — without them the cup would be a hidden object.
    var sticks = [
      { a: [1.494, 0.786, -0.556], t: [1.462, 1.048, -0.590], tip: '#2a2b33' },
      { a: [1.508, 0.787, -0.542], t: [1.524, 1.016, -0.512], tip: '#8d5a3c' },
      { a: [1.496, 0.790, -0.534], t: [1.472, 0.884, -0.508], tip: '@metalDark' },
      { a: [1.506, 0.788, -0.566], t: [1.520, 0.866, -0.594], tip: '#2a2b33' }
    ];
    for (var i = 0; i < sticks.length; i++) {
      var s = sticks[i];
      var tipLen = 0.020;
      var d = M.norm(M.sub(s.t, s.a));
      var b = [s.t[0] - d[0] * tipLen, s.t[1] - d[1] * tipLen, s.t[2] - d[2] * tipLen];
      G.tube(m, s.a, b, 0.0052, 0.0050, 6, { fill: i % 2 ? '@woodDark' : '@wood', caps: false, kind: K.EDGE });
      G.tube(m, b, s.t, 0.0050, 0.0016, 6, { fill: s.tip, caps: true, kind: K.FINE });
      line(m, [b[0], b[1] + 0.0052, b[2]], [s.t[0], s.t[1], s.t[2]], K.SOFT);
    }
    parts.pencilCup = m;
    return { mesh: m, pivot: [cx, cy, cz], base: snapshot(m), axis: M.norm([0.86, 0, 0.51]) };
  }

  /* ===========================================================================
     §3.6  the globe
     =========================================================================== */
  function buildGlobe(S, parts) {
    var stand = S.addMesh();
    var C = [1.560, 0.905, -0.380];
    var R = 0.085;
    var TILT = 23.5 * Math.PI / 180;
    var ex = M.norm([1, 0, 0.36]);
    var axis = M.norm([ex[0] * Math.sin(TILT), Math.cos(TILT), ex[2] * Math.sin(TILT)]);
    var planeN = M.norm(M.cross(ex, [0, 1, 0]));

    // foot + spindle
    G.lathe(stand, [C[0], 0.755, C[2]], [[0, 0.050], [0.010, 0.058], [0.032, 0.038]], 12, { fill: '@metalDark', top: true, topFill: '@metal', cull: false });
    loop(stand, G.circlePts(C[0], 0.765, C[2], 0.0585, 12, 'y'), K.FINE);
    G.tube(stand, [C[0], 0.782, C[2]], [C[0], 0.826, C[2]], 0.032, 0.026, 8, { fill: '@metal', caps: false, kind: K.EDGE });

    // meridian ring: a flat band in the plane that contains the polar axis
    var steps = 8, a0 = -168 * Math.PI / 180, a1 = 168 * Math.PI / 180;
    var rIn = 0.094, rOut = 0.106, th = 0.0022;
    var geo = [];
    for (var i = 0; i <= steps; i++) {
      var a = a0 + (a1 - a0) * i / steps;
      var ca = Math.cos(a), sa = Math.sin(a);
      geo.push({
        i: [C[0] + ex[0] * rIn * sa, C[1] + rIn * ca, C[2] + ex[2] * rIn * sa],
        o: [C[0] + ex[0] * rOut * sa, C[1] + rOut * ca, C[2] + ex[2] * rOut * sa]
      });
    }
    for (i = 0; i < steps; i++) {
      var A = geo[i], B = geo[i + 1];
      var f = function (p, s) { return [p[0] + planeN[0] * th * s, p[1] + planeN[1] * th * s, p[2] + planeN[2] * th * s]; };
      face(stand, [f(A.i, 1), f(A.o, 1), f(B.o, 1), f(B.i, 1)], planeN, { fill: '@metal', kind: K.EDGE });
      face(stand, [f(B.i, -1), f(B.o, -1), f(A.o, -1), f(A.i, -1)], M.scale(planeN, -1), { fill: '@metal', kind: K.EDGE });
      face(stand, [f(A.o, 1), f(A.o, -1), f(B.o, -1), f(B.o, 1)], [0, 0, 1], { fill: '@metalDark', kind: K.FINE, cull: false });
      face(stand, [f(B.i, 1), f(B.i, -1), f(A.i, -1), f(A.i, 1)], [0, 0, 1], { fill: '@metalDark', kind: K.FINE, cull: false });
    }
    parts.globeStand = stand;

    /* the ball: lathe rows every 30°, continents as raised patches on the very
       same lattice so nothing z-fights, then tilted onto its axis. */
    var ball = S.addMesh();
    var SEG = 12;
    var prof = [];
    for (var k = -3; k <= 3; k++) {
      var lat = k * 30 * Math.PI / 180;
      prof.push([R * Math.sin(lat), R * Math.cos(lat)]);
    }
    G.lathe(ball, [0, 0, 0], prof, SEG, { fill: '@paper', base: false, cull: false });
    // two construction rings, floated just clear of the facets
    ringLocal(ball, 0, R + 0.0032, SEG, K.FINE);
    ringLocal(ball, 35 * Math.PI / 180, R + 0.0032, SEG, K.SOFT);
    // continents as raised patches: irregular outlines rather than one grid
    var LAND = [
      [-100, 22, 42, 26], [-72, 44, 30, 18], [-58, -22, 24, 32],
      [8, 6, 30, 34], [58, 34, 46, 30], [118, -26, 26, 18]
    ];
    for (i = 0; i < LAND.length; i++) {
      continent(ball, R, LAND[i][0], LAND[i][1], LAND[i][2], LAND[i][3], K.FINE);
    }
    // pole stubs
    G.tube(ball, [axis[0] * 0.074, axis[1] * 0.074, axis[2] * 0.074],
      [axis[0] * 0.102, axis[1] * 0.102, axis[2] * 0.102], 0.005, 0.004, 6, { fill: '@metalDark', caps: true, kind: K.FINE });
    G.tube(ball, [-axis[0] * 0.074, -axis[1] * 0.074, -axis[2] * 0.074],
      [-axis[0] * 0.102, -axis[1] * 0.102, -axis[2] * 0.102], 0.005, 0.004, 6, { fill: '@metalDark', caps: true, kind: K.FINE });
    // tilt into place
    var nTilt = M.norm(M.cross([0, 1, 0], ex));
    var tiltM = function (p) {
      var q = rotAxis(p, [0, 0, 0], nTilt, TILT);
      return [C[0] + q[0], C[1] + q[1], C[2] + q[2]];
    };
    poseFrom(ball, snapshot(ball), tiltM);
    parts.globeBall = ball;
    return { stand: stand, ball: ball, centre: C, axis: axis };
  }

  /** A latitude ring drawn on the local sphere, lifted off the facets. */
  function ringLocal(m, lat, r, segs, kind) {
    var pts = [];
    var y = r * Math.sin(lat), rr = r * Math.cos(lat);
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
    }
    loop(m, pts, kind);
  }

  /** A small raised landmass built from spherical quads, culled to the near side. */
  function continent(m, R, lon0, lat0, dLon, dLat, kind) {
    var cols = 2, rows = 2;
    var r = R + 0.0034;
    var grid = [];
    for (var i = 0; i <= cols; i++) {
      var row = [];
      for (var j = 0; j <= rows; j++) {
        var lon = (lon0 + dLon * i / cols) * Math.PI / 180;
        var lat = (lat0 + dLat * j / rows) * Math.PI / 180;
        var cl = Math.cos(lat);
        row.push([r * cl * Math.cos(lon), r * Math.sin(lat), r * cl * Math.sin(lon)]);
      }
      grid.push(row);
    }
    for (i = 0; i < cols; i++) {
      for (var j2 = 0; j2 < rows; j2++) {
        face(m, [grid[i][j2], grid[i + 1][j2], grid[i + 1][j2 + 1], grid[i][j2 + 1]], grid[i][j2], {
          fill: '@plant', kind: kind || K.EDGE, cull: true
        });
      }
    }
  }

  /* ===========================================================================
     build
     =========================================================================== */
  function build(sctx) {
    var S = sctx.scene;
    var parts = sctx.parts || (sctx.parts = {});
    var reg = sctx.register || function () {};

    buildDesk(S, parts);
    var lamp = buildLamp(S, parts);
    var mug = buildMug(S, parts);
    var note = buildNotebook(S, parts);
    var cup = buildPencilCup(S, parts);
    var globe = buildGlobe(S, parts);

    var env0 = sctx.env || {};

    /* ---------------- 台灯 lamp: on / off with a warm halo ---------------- */
    var lampOn0 = !!env0.lampOn;
    var lampPhase = lampOn0 ? 1 : 0;
    var shadeBase = [], bulbBase = [], i;
    for (i = 0; i < lamp.coneFaces; i++) shadeBase.push(lamp.shade.faces[i].fill);
    for (i = 0; i < lamp.bulbFaces.length; i++) bulbBase.push(lamp.shade.faces[lamp.bulbFaces[i]].fill);
    // Registered for main.js, which draws the 2D halo and the pool of light.
    // It reads `.pos`; the task spec calls the same point `.center`, so both
    // names point at one array and can never drift apart.
    var glow = { center: [lamp.bulb[0], lamp.bulb[1], lamp.bulb[2]], radius: 0.62, strength: lampPhase, color: '#ffd79a' };
    glow.pos = glow.center;
    parts.lampGlow = glow;

    var knobPosed = lampPhase;
    function poseKnob(e) {
      var ang = (e - 0.5) * 0.46;
      poseFrom(lamp.knob, lamp.knobBase, function (p) {
        return rotAxis(p, lamp.knobPivot, lamp.knobAxis, ang);
      });
    }
    function tintLamp(e, env) {
      var paper = paperOf(env);
      var warm = G.mix(paper, '#ffd89a', 0.72);
      for (var k = 0; k < lamp.coneFaces; k++) {
        lamp.shade.faces[k].fill = e <= 0.001 ? shadeBase[k] : G.mix(shadeBase[k] === '@paper' ? paper : shadeBase[k], '#f7c877', e * 0.55);
      }
      lamp.shade.faces[lamp.capFace].fill = e <= 0.001 ? '@metalDark' : G.mix('#3a3a42', paper, e * 0.6);
      for (k = 0; k < lamp.bulbFaces.length; k++) {
        lamp.shade.faces[lamp.bulbFaces[k]].fill = e <= 0.001 ? bulbBase[k] : G.mix('#f3ecdc', warm, e);
      }
      // the mouth rim lights up as well (glow strokes are drawn in theme.glow)
      for (k = 0; k < lamp.mouthFaces.length; k++) {
        lamp.shade.faces[lamp.mouthFaces[k]].glow = e * 0.8;
      }
      lamp.shade.rev++;
    }
    poseKnob(lampPhase);
    tintLamp(lampPhase, env0);

    reg({
      id: 'lamp', label: '台灯 Desk lamp', hint: '点击开关', priority: 2,
      mesh: lamp.mesh,
      hit: { min: [1.388, 0.750, -1.820], max: [1.600, 1.196, -1.450] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        var on = !ctx.env.lampOn;
        ctx.setEnv({ lampOn: on });
        ctx.audio.play('lamp', { on: on });
        ctx.toast(on ? '台灯亮了' : '台灯关了');
      },
      update: function (dt, ctx) {
        var target = ctx.env.lampOn ? 1 : 0;
        var step = dt / 0.35;
        var next = lampPhase + (target > lampPhase ? step : -step);
        next = M.clamp(next, 0, 1);
        var changed = Math.abs(next - lampPhase) > 1e-5;
        lampPhase = next;
        var e = easeInOut(lampPhase);
        if (changed || knobPosed !== lampPhase) {
          poseKnob(e);
          tintLamp(e, ctx.env);
          knobPosed = lampPhase;
        }
        glow.strength = e;
        glow.color = G.mix('#fff3d8', '#ffc266', e);
      }
    });

    /* ---------------- 杯子 mug: steam ---------------- */
    var steam = parts.steam;
    var steamState = { on: true, level: 0.12 };
    steam.on = true;

    reg({
      id: 'mug', label: '杯子 Mug', hint: '点击开关蒸汽', priority: 1,
      mesh: mug.mesh,
      hit: { min: [1.386, 0.750, -1.360], max: [1.512, 0.870, -1.232] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        steamState.on = !steamState.on;
        steam.on = steamState.on;
        ctx.audio.play(steamState.on ? 'steam' : 'click');
        ctx.toast(steamState.on ? '热气冒起来了' : '热气停了');
      },
      update: function (dt, ctx) {
        var A = animOf(ctx);
        steamState.level = A.approach(steamState.level, steamState.on ? 1 : 0, 4.0, dt);
        // the ribbon must never sit still while it is on
        var breathe = 0.82 + 0.18 * A.osc(ctx.time || 0, 3.1, 0.0);
        var s = M.clamp(steamState.level * breathe, 0, 1);
        steam.strength = steamState.on ? Math.max(s, steamState.level * 0.55) : s;
        steam.on = steamState.on;
      }
    });

    /* ---------------- 笔记本 notebook: a page turns ---------------- */
    var pageState = { t: 0, flipping: false, turned: 0 };
    var flipBase = snapshot(note.flip);

    reg({
      id: 'notebook', label: '笔记本 Notebook', hint: '点击翻页', priority: 0,
      mesh: note.mesh,
      hit: { min: [1.110, 0.750, -1.172], max: [1.382, 0.790, -0.868] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        if (pageState.flipping) return;
        pageState.flipping = true;
        pageState.t = 0;
        ctx.audio.play('page');
      },
      update: function (dt, ctx) {
        if (!pageState.flipping) return;
        pageState.t += dt / 0.42;
        if (pageState.t >= 1) {
          pageState.t = 0;
          pageState.flipping = false;
          pageState.turned = (pageState.turned + 1) % 4;
          note.flip.faces[0].fill = '@paper';
        }
        var e = easeInOut(M.clamp(pageState.t, 0, 1));
        var lift = Math.sin(Math.PI * M.clamp(pageState.t, 0, 1));
        var ang = -1.15 * lift * (0.55 + 0.45 * e);
        var hx = note.hingeX, hy = note.hingeY;
        poseFrom(note.flip, flipBase, function (p) {
          var dy = p[1] - hy, dx = p[0] - hx;
          return [hx + dx * Math.cos(ang) + dy * Math.sin(ang), hy - dx * Math.sin(ang) + dy * Math.cos(ang), p[2]];
        });
      }
    });

    /* ---------------- 笔筒 pencil cup: tipped and rattled ---------------- */
    var cupState = { t: 99, amp: 0, running: false };

    reg({
      id: 'pencilcup', label: '笔筒 Pencil cup', hint: '点击晃动', priority: 2,
      mesh: cup.mesh,
      hit: { min: [1.436, 0.750, -0.624], max: [1.560, 1.072, -0.496] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        cupState.t = 0;
        cupState.amp = 0.17;
        cupState.running = true;
        ctx.audio.play('click');
      },
      update: function (dt, ctx) {
        if (!cupState.running) return;
        var A = animOf(ctx);
        cupState.t += dt;
        var decay = Math.exp(-2.6 * cupState.t);
        var ang = cupState.amp * A.osc(cupState.t, 0.30, 0.25) * decay;
        if (decay < 0.004) {
          cupState.running = false;
          ang = 0;
        }
        poseFrom(cup.mesh, cup.base, function (p) {
          return rotAxis(p, cup.pivot, cup.axis, ang);
        });
      }
    });

    /* ---------------- 地球仪 globe: spun and left to coast ---------------- */
    var spinState = { speed: 0.012, idle: 0.012, blast: 0.5, angle: 0 };
    var ballBase = null;

    reg({
      id: 'globe', label: '地球仪 Globe', hint: '点击旋转', priority: 1,
      mesh: globe.ball,
      // hugging the ball (not the whole object) keeps the pencil cup behind it
      // clickable where the cup is genuinely visible
      hit: { min: [1.472, 0.818, -0.470], max: [1.650, 1.012, -0.288] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        spinState.speed = spinState.blast;
        ctx.audio.play('globe');
        ctx.toast('地球转起来了');
      },
      update: function (dt, ctx) {
        var A = animOf(ctx);
        spinState.speed = A.approach(spinState.speed, spinState.idle, 0.75, dt);
        var d = spinState.speed * Math.PI * 2 * dt;
        spinState.angle += d;
        globe.ball.transform(function (x, y, z) {
          return rotAxis([x, y, z], globe.centre, globe.axis, d);
        });
        globe.ball.invalidate();   // moving verts by hand invalidates the bounds
      }
    });

    return {
      parts: parts,
      faces: (function () {
        var n = 0;
        for (var i = 0; i < S.meshes.length; i++) n += S.meshes[i].faces.length;
        return n;
      })()
    };
  }

  P.deskBuild = build;
  P.deskLayout = { DESK: DESK, CARC: CARC, LAMP: LAMP, plane: 'desk' };
})(typeof window !== 'undefined' ? window : globalThis);
