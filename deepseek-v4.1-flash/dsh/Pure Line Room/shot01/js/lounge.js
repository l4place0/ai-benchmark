/* =============================================================================
   Pure Line Room — lounge.js
   休闲区 (lounge zone: x -1.70…1.70, z 0.30…2.60) + the office chair.

   Everything is placed on the centimetre grid frozen in CONTRACT.md §3:
     sofa          (-0.10, 0,    2.12)   1.86 × 0.80 × 0.86  · back on the south wall
     throw pillows (-0.62, 0.50, 1.86) and (0.42, 0.50, 1.86)
     coffee table  (-0.10, 0,    1.02)   0.92 × 0.42 × 0.50  · magazines / tray
     rug           (-0.10, 0.006,1.42)   2.40 × 0.012 × 1.85
     sideboard     (-1.32, 0,    0.92)   0.62 × 0.90 × 0.42  · on the west wall
     record player (-1.32, 0.90, 0.92)   0.50 × 0.26 × 0.36  · on the sideboard
     office chair  (0.86, 0,   -1.05)     draggable inside x 0.10…1.20, z -2.10…-0.20

   House style: every face is filled *and* stroked.  The four line weights do all
   the work — K.SIL for a big object's outer silhouette, K.EDGE for panels and
   cushion surfaces, K.FINE for seams / piping / gaps / joints, K.SOFT for
   curvature hints and creases.  Soft things are built from segmented rings with
   a tucked base, a bulging belly and a bowed top, never from a box.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR = global.PLR || {};
  var K = P.K;
  var G = P.geom;

  /* ======================================================================
     §1  local drawing helpers
     ====================================================================== */

  /** Filled polygon. */
  function face(m, pts, o) {
    o = o || {};
    var vi = m.vertices(pts);
    return m.face(vi, {
      fill: o.fill === undefined ? null : o.fill,
      kind: o.kind || K.EDGE, glow: o.glow || 0, dot: o.dot || 0,
      hatch: o.hatch || null, shade: o.shade || 0
    });
  }

  function quad(m, a, b, c, d, o) { return face(m, [a, b, c, d], o); }
  function tri(m, a, b, c, o) { return face(m, [a, b, c], o); }

  /** A single hairline (degenerate face, the house convention). */
  function line(m, a, b, kind, glow) {
    return m.face(m.vertices([a, b, a]), { fill: null, kind: kind || K.FINE, glow: glow || 0 });
  }

  /**
   * A whole polyline (open) or outline (closed) as ONE face.  Same ink as a
   * chain of single lines, a fraction of the bookkeeping.
   */
  function path(m, pts, kind, closed, glow) {
    var list = closed ? pts.concat([pts[0]]) : pts.slice();
    if (list.length < 2) return -1;
    return m.face(m.vertices(list), { fill: null, kind: kind || K.FINE, glow: glow || 0 });
  }

  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }

  /** Circle in the XZ plane at height y. */
  function circleXZ(cx, cz, y, r, segs, phase) {
    var out = [], i, a;
    for (i = 0; i < segs; i++) {
      a = (i / segs) * Math.PI * 2 + (phase || 0);
      out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
    return out;
  }

  /** Axis-aligned box from bounds (no redundant box-edge strokes: the faces
      already carry their own outlines). */
  function boxAt(m, x0, y0, z0, x1, y1, z1, o) {
    o = o || {};
    var p = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]
    ];
    return G.hullBox(m, p, {
      fill: o.fill === undefined ? null : o.fill, kind: o.kind || K.EDGE,
      edges: false, open: o.open, cull: false, shade: o.shade, glow: o.glow
    });
  }

  /**
   * Surface of revolution about a vertical axis.  `profile` is [[y, r], …]
   * bottom→top; `bandKind` gives each band its own ink weight, so a turned
   * foot ring is drawn by the geometry itself and can never z-fight.
   */
  function revolve(m, cx, cz, profile, segs, o) {
    o = o || {};
    var rows = [], k, i, a;
    for (k = 0; k < profile.length; k++) {
      var ring = [];
      for (i = 0; i < segs; i++) {
        a = (i / segs) * Math.PI * 2 + (o.phase || 0);
        ring.push([cx + Math.cos(a) * profile[k][1], profile[k][0], cz + Math.sin(a) * profile[k][1]]);
      }
      rows.push(m.vertices(ring));
    }
    for (k = 0; k + 1 < rows.length; k++) {
      var kind = (o.bandKind && o.bandKind[k]) || o.kind || K.SOFT;
      for (i = 0; i < segs; i++) {
        var n = (i + 1) % segs;
        m.face([rows[k][i], rows[k][n], rows[k + 1][n], rows[k + 1][i]], {
          fill: o.fill ? G.shade(o.fill, (i % 4) * 0.012) : null,
          kind: kind, cull: false, glow: o.glow || 0
        });
      }
    }
    if (o.base) m.face(rows[0].slice().reverse(), { fill: o.fill || null, kind: K.FINE, cull: false });
    if (o.top) m.face(rows[rows.length - 1], { fill: o.topFill || o.fill || null, kind: K.FINE, cull: false });
    return rows;
  }

  /**
   * The turned foot ring of a leg, inked as separate arc segments so every
   * piece of it sorts at its own depth (a single loop would be swallowed by
   * the leg's own faces).  The arc faces the default camera.
   */
  function footRing(m, x, z, y, r, o) {
    o = o || {};
    var steps = o.steps || 6;
    var span = o.span === undefined ? 0.62 : o.span;
    var mid = o.face === undefined ? Math.atan2(3.30 - z, 2.5 - x) : o.face;
    var a0 = mid - Math.PI * span, total = Math.PI * 2 * span;
    var prev = null, i, a, p;
    for (i = 0; i <= steps; i++) {
      a = a0 + total * (i / steps);
      p = [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      if (prev) line(m, prev, p, o.kind || K.FINE);
      prev = p;
    }
  }

  /** A short tapered wooden leg with a turned foot ring (12 segments). */
  function legY(m, x, z, y0, y1, r0, r1, o) {
    o = o || {};
    var segs = o.segs || 12;
    revolve(m, x, z, [[y0, r0], [y1, r1]], segs, {
      fill: o.fill || '@woodDark', kind: o.kind || K.SOFT, top: false, base: false
    });
    if (o.ring !== false) {
      var ry = y0 + Math.min(0.022, (y1 - y0) * 0.24);
      var rr = r0 + (r1 - r0) * ((ry - y0) / (y1 - y0)) + 0.0016;
      footRing(m, x, z, ry, rr, { steps: o.ringSteps || 6, span: o.ringSpan, face: o.face });
    }
  }

  /** CCW chamfered rectangle in the XZ plane — the house outline for slabs. */
  function chamRect(cx, cz, w, d, ch) {
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    return [
      [x0 + ch, z0], [x1 - ch, z0], [x1, z0 + ch], [x1, z1 - ch],
      [x1 - ch, z1], [x0 + ch, z1], [x0, z1 - ch], [x0, z0 + ch]
    ];
  }

  /** A slab whose underside is inset: the chamfered top edge that reads as a bevel. */
  function bevelSlab(m, poly, yBot, yTop, inset, o) {
    o = o || {};
    var n = poly.length, i, cx = 0, cz = 0;
    for (i = 0; i < n; i++) { cx += poly[i][0]; cz += poly[i][1]; }
    cx /= n; cz /= n;
    var top = [], bot = [];
    for (i = 0; i < n; i++) {
      var dx = poly[i][0] - cx, dz = poly[i][1] - cz;
      var l = Math.sqrt(dx * dx + dz * dz) || 1;
      top.push([poly[i][0], yTop, poly[i][1]]);
      bot.push([poly[i][0] - (dx / l) * inset, yBot, poly[i][1] - (dz / l) * inset]);
    }
    face(m, top, { fill: o.fill, kind: o.kind || K.EDGE, shade: o.shade === undefined ? 0.01 : o.shade });
    face(m, bot.slice().reverse(), { fill: o.fillAlt || o.fill, kind: K.FINE });
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      quad(m, bot[i], bot[j], top[j], top[i], { fill: o.fill, kind: o.kind || K.EDGE });
    }
    return top;
  }

  /** A box rotated about Y (magazines, small stacked things). */
  function rotBox(m, cx, cy, cz, w, h, d, yaw, o) {
    var hw = w / 2, hd = d / 2;
    var base = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    var c = Math.cos(yaw), s = Math.sin(yaw), p = [], i;
    for (i = 0; i < 4; i++) {
      var px = base[i][0], pz = base[i][1];
      p.push([cx + px * c + pz * s, cy, cz - px * s + pz * c]);
    }
    for (i = 0; i < 4; i++) {
      var qx = base[i][0], qz = base[i][1];
      p.push([cx + qx * c + qz * s, cy + h, cz - qx * s + qz * c]);
    }
    return G.hullBox(m, p, {
      fill: o.fill, kind: o.kind || K.EDGE, edges: false, cull: false, shade: o.shade === undefined ? true : o.shade
    });
  }

  /** A caster wheel: a real disc (12 segments) on an arbitrary horizontal axle. */
  function wheel(m, c, ax, r, halfW, segs, o) {
    o = o || {};
    var t1 = [-ax[1], ax[0]];           // in-plane perpendicular (xz)
    var A = [], B = [], i, a;
    for (i = 0; i < segs; i++) {
      a = (i / segs) * Math.PI * 2;
      var ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      A.push([c[0] + t1[0] * ca - ax[0] * halfW, c[1] + sa, c[2] + t1[1] * ca - ax[1] * halfW]);
      B.push([c[0] + t1[0] * ca + ax[0] * halfW, c[1] + sa, c[2] + t1[1] * ca + ax[1] * halfW]);
    }
    var ai = m.vertices(A), bi = m.vertices(B);
    var fill = o.fill || '@metalDark';
    for (i = 0; i < segs; i++) {
      var n = (i + 1) % segs;
      m.face([ai[i], ai[n], bi[n], bi[i]], { fill: G.shade(fill, (i % 3) * 0.02), kind: K.SOFT, cull: false });
    }
    if (o.caps !== false) {
      if (o.caps !== 'outer') {
        m.face(ai.slice().reverse(), { fill: G.shade(fill, 0.05), kind: K.FINE, cull: false });
      }
      m.face(bi, { fill: G.shade(fill, 0.02), kind: K.FINE, cull: false });
    }
    // the hub, so the wheel reads as a wheel and not a barrel
    line(m, c, [c[0] + ax[0] * (halfW + 0.006), c[1], c[2] + ax[1] * (halfW + 0.006)], K.FINE);
    return { a: ai, b: bi };
  }

  /**
   * A soft upholstered panel — the heart of the sofa.
   * Segmented rings (8 sides, or 12 for the plumpest things), a tucked base, a
   * bulging belly, an inset rim and a bowed top grid; piped seams at every ring.
   * Options:
   *   cx, cy, cz  base-centre · w, d, h  size · yaw, lean (radians)
   *   segs (8 or 12) · corner (pull-in) · belly (side bulge) · rim · dome
   *   bellyRing:false for small panels · flatTop:true for pads
   *   creases: n crease lines across the top · piping:false to skip the seams
   */
  function softPanel(m, o) {
    var w = o.w, d = o.d, h = o.h;
    var corner = o.corner === undefined ? 0.30 : o.corner;
    var belly = o.belly === undefined ? 0.014 : o.belly;
    var rim = o.rim === undefined ? 0.15 : o.rim;
    var dome = o.dome === undefined ? 0.022 : o.dome;
    var fill = o.fill || '@fabric';
    var fillAlt = o.fillAlt || fill;
    var yaw = o.yaw || 0, lean = o.lean || 0;
    var withBelly = o.bellyRing !== false;
    var n = o.segs || 8;
    var i, q2;

    /** Ring outline. n=8 is the house octagon, n=12 a soft squircle. */
    function ring(scale, expand, y) {
      var ax = (w / 2) * scale, cz = (d / 2) * scale;
      var out = [];
      for (q2 = 0; q2 < n; q2++) {
        var px, pz, a;
        if (n === 8) {
          var ka = ax * corner, kc = cz * corner;
          var oct = [
            [ax, 0], [ax - ka, cz - kc], [0, cz], [-ax + ka, cz - kc],
            [-ax, 0], [-ax + ka, -cz + kc], [0, -cz], [ax - ka, -cz + kc]
          ];
          px = oct[q2][0]; pz = oct[q2][1];
        } else {
          a = (q2 / n) * Math.PI * 2;
          var ca = Math.cos(a), sa = Math.sin(a);
          px = (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 0.62) * ax;
          pz = (sa < 0 ? -1 : 1) * Math.pow(Math.abs(sa), 0.62) * cz;
          var pull = 1 - corner * 0.85 * Math.pow(Math.abs(Math.sin(2 * a)), 1.5);
          px *= pull; pz *= pull;
        }
        var nx = px / (ax * ax || 1), nz = pz / (cz * cz || 1);
        var nl = Math.sqrt(nx * nx + nz * nz) || 1;
        out.push([px + (nx / nl) * expand, y, pz + (nz / nl) * expand]);
      }
      return out;
    }

    function place(p) {
      var r = [p[0], p[1], p[2]];
      if (lean) {
        var cl = Math.cos(lean), sl = Math.sin(lean);
        r = [r[0], r[1] * cl - r[2] * sl, r[1] * sl + r[2] * cl];
      }
      if (yaw) r = rotY(r, yaw);
      return [o.cx + r[0], o.cy + r[1], o.cz + r[2]];
    }
    function add(pts, opts) {
      var w2 = [], k;
      for (k = 0; k < pts.length; k++) w2.push(place(pts[k]));
      return face(m, w2, opts);
    }
    function band(A, B, opts) {
      for (var k = 0; k < A.length; k++) {
        var nx2 = (k + 1) % A.length;
        add([A[k], A[nx2], B[nx2], B[k]], opts);
      }
    }

    var RB = ring(0.925, 0, 0);                            // tucked base
    var RM = withBelly ? ring(1, belly, h * 0.44) : RB;    // widest point
    var RT = ring(1 - rim, belly * 0.3, h - 0.016);        // rim: the piping runs here

    add(RB.slice().reverse(), { fill: fillAlt, kind: K.SOFT });          // underside
    if (withBelly) band(RB, RM, { fill: fill, kind: K.SOFT });
    band(RM, RT, { fill: fill, kind: K.EDGE });

    if (o.flatTop) {
      add(RT, { fill: G.lighten(fill, 0.03), kind: K.SOFT });
    } else {
      // the bowed top: an 8-point inner border sampled by angle, so any ring
      // resolution maps onto it one-to-one
      var ga = (w / 2) * (1 - rim - 0.09), gc = (d / 2) * (1 - rim - 0.09);
      var yb = h - 0.008 + dome * 0.45, yc = h + dome;
      var GB = [
        [ga, 0], [ga, gc], [0, gc], [-ga, gc],
        [-ga, 0], [-ga, -gc], [0, -gc], [ga, -gc]
      ];
      function gridAt(a) {
        var k = (a / (Math.PI * 2)) * 8;
        var i0 = ((Math.floor(k) % 8) + 8) % 8, f = k - Math.floor(k);
        var A = GB[i0], B = GB[(i0 + 1) % 8];
        return [A[0] + (B[0] - A[0]) * f, yb, A[1] + (B[1] - A[1]) * f];
      }
      var G8 = [], GT = [];
      for (i = 0; i < 8; i++) {
        G8.push([GB[i][0], yb, GB[i][1]]);
        GT.push([GB[i][0] * 0.98, yb + dome * 0.18, GB[i][1] * 0.98]);
      }
      for (i = 0; i < n; i++) {
        var gg = n === 8 ? G8[i] : gridAt((i / n) * Math.PI * 2);
        var gn = n === 8 ? G8[(i + 1) % 8] : gridAt(((i + 1) / n) * Math.PI * 2);
        add([RT[i], RT[(i + 1) % n], gn, gg], { fill: fill, kind: K.SOFT });
      }
      var C = [0, yc, 0];
      add([G8[0], G8[1], C, G8[7]], { fill: G.lighten(fill, 0.03), kind: K.SOFT });
      add([G8[1], G8[2], G8[3], C], { fill: G.lighten(fill, 0.025), kind: K.SOFT });
      add([G8[3], G8[4], G8[5], C], { fill: G.lighten(fill, 0.03), kind: K.SOFT });
      add([G8[5], G8[6], G8[7], C], { fill: G.lighten(fill, 0.025), kind: K.SOFT });
    }

    if (o.piping !== false) {
      // piping sits a hair proud of the surface so the painter's sort keeps it
      add(ring(1 - rim, belly * 0.3 + 0.005, h - 0.014), { fill: null, kind: K.FINE });
      if (withBelly) add(ring(1, belly + 0.005, h * 0.44), { fill: null, kind: K.FINE });
      add(ring(0.925, 0.004, 0.001), { fill: null, kind: K.SOFT });
    }

    // creases across the bowed top
    var n = o.creases || 0;
    for (i = 0; i < n; i++) {
      var fx = (i === 0 ? -1 : 1) * (w / 2) * (n === 1 ? 0 : 0.30);
      add([[fx, h - 0.004, d / 2 - 0.03], [fx * 1.04, h + dome * 0.86, 0],
        [fx, h - 0.004, -d / 2 + 0.03]], { fill: null, kind: K.SOFT });
    }
    if (o.cornerCrease) {
      add([[-w * 0.36, h - 0.012, d * 0.36], [-w * 0.18, h + dome * 0.75, d * 0.18]],
        { fill: null, kind: K.SOFT });
    }
    return null;
  }

  /** Remember a mesh's rest pose so an animation can re-derive it from scratch. */
  function rig(m) {
    var base = [], i;
    for (i = 0; i < m.verts.length; i++) base.push([m.verts[i][0], m.verts[i][1], m.verts[i][2]]);
    return {
      base: base,
      pose: function (fn) {
        for (var q = 0; q < base.length; q++) {
          var p = fn(base[q][0], base[q][1], base[q][2], q);
          var v = m.verts[q];
          v[0] = p[0]; v[1] = p[1]; v[2] = p[2];
        }
        m.invalidate();
      }
    };
  }

  function boundsOf(m, pad) {
    var b = m.getBounds();
    pad = pad || 0;
    return {
      min: [b.min[0] - pad, b.min[1] - pad, b.min[2] - pad],
      max: [b.max[0] + pad, b.max[1] + pad, b.max[2] + pad]
    };
  }

  function approach(cur, tgt, sp, dt) {
    var A = P.anim;
    return A ? A.approach(cur, tgt, sp, dt) : tgt;
  }
  function easeInOut(t) {
    var A = P.anim;
    if (A && A.ease && A.ease.inOut) return A.ease.inOut(t);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }
  function osc(t, period, phase) {
    var A = P.anim;
    if (A && A.osc) return A.osc(t, period, phase);
    return Math.sin((t / period) * Math.PI * 2 + (phase || 0));
  }
  function damped(t, life, freq, phase) {
    var A = P.anim;
    if (A && A.damped) return A.damped(t, life, freq, phase);
    if (t < 0 || t > life) return 0;
    return Math.exp(-4.2 * (t / life)) * Math.sin((t / life) * Math.PI * 2 * (freq || 2) + (phase || 0));
  }

  /* ======================================================================
     §2  the sofa  —  (-0.10, 0, 2.12), 1.86 × 0.80 × 0.86, facing -z
     ====================================================================== */

  var SOFA = {
    x0: -1.03, x1: 0.83,
    z0: 1.69, z1: 2.55,
    armIn: [-0.87, 0.67],      // inner faces of the two arms
    railY0: 0.10, railY1: 0.20,
    deckY: 0.28,
    seatTop: 0.50,
    armTop: 0.63,
    backZ: 2.36,               // front face of the back rest
    backTop: 0.80
  };

  /** One rolled arm, swept along z: genuinely round on top, seamed along the roll. */
  function armPanel(m, xIn, xOut, yBase, z0, z1, fill) {
    var sgn = xOut > xIn ? 1 : -1;
    var wid = Math.abs(xOut - xIn);
    var rr = wid * 0.5, straight = 0.35;
    var prof = [[0, 0], [wid, 0], [wid, straight]];
    for (var k = 1; k <= 5; k++) {
      var a = Math.PI * k / 6;
      prof.push([wid * 0.5 + Math.cos(a) * rr, straight + Math.sin(a) * rr]);
    }
    prof.push([0, straight]);
    G.outline(m, prof, function (u, v) { return [xIn + sgn * u, yBase + v, z0]; },
      [0, 0, 1], z1 - z0, { fill: fill, kind: K.EDGE, silhouette: false });
    var topY = yBase + straight + rr;
    // seam along the roll (slightly inboard of the crown, as on a real arm)
    line(m, [xIn + sgn * wid * 0.26, topY + 0.002, z0], [xIn + sgn * wid * 0.26, topY + 0.002, z1], K.FINE);
    // piping where the arm meets the seat platform
    line(m, [xIn + sgn * 0.004, yBase + 0.006, z0 + 0.01], [xIn + sgn * 0.004, yBase + 0.006, z1 - 0.01], K.SOFT);
    // the heavy outer silhouette of the arm
    line(m, [xOut, yBase + straight, z0 + 0.005], [xOut, yBase + straight, z1 - 0.005], K.SIL);
    line(m, [xOut, yBase + 0.012, z0 + 0.005], [xOut, yBase + 0.012, z1 - 0.005], K.SIL);
  }

  function buildSofa(m) {
    var S = SOFA, i, k;

    /* ---- four short turned legs, base lifted 0.10 off the floor ---- */
    var lx = [-0.93, 0.73], lz = [1.80, 2.44];
    for (i = 0; i < 2; i++) {
      for (k = 0; k < 2; k++) {
        legY(m, lx[i], lz[k], 0, S.railY0, 0.031, 0.024, {
          fill: '@woodDark',
          ring: !(i === 0 && k === 0)          // the far corner leg hides its own ring
        });
      }
    }
    /* ---- plinth / base rail, chamfered so it is not a slab ---- */
    G.prism(m, [
      [-0.94, 1.72], [0.74, 1.72], [0.80, 1.78], [0.80, 2.46],
      [0.74, 2.52], [-0.94, 2.52], [-1.00, 2.46], [-1.00, 1.78]
    ], S.railY0, S.railY1, { fill: '@fabricAlt', kind: K.EDGE, silhouette: false });
    // rail seam + shadow gap, on both the room side and the wall side
    path(m, [[-0.955, 0.168, 1.7205], [0.755, 0.168, 1.7205]], K.FINE);
    path(m, [[-0.955, 0.168, 2.5195], [0.755, 0.168, 2.5195]], K.FINE);
    path(m, [[-0.995, 0.196, 1.79], [-0.94, 0.196, 1.735], [0.74, 0.196, 1.735], [0.795, 0.196, 1.79]], K.SOFT);

    /* ---- seat platform (the deck the cushions sit on) ---- */
    boxAt(m, -0.865, S.railY1, 1.72, 0.665, S.deckY, 2.50, { fill: '@fabricAlt', shade: true });
    path(m, [[-0.865, 0.235, 1.7205], [0.665, 0.235, 1.7205]], K.FINE);        // front rail piping
    path(m, [[-0.865, 0.243, 2.4995], [0.665, 0.243, 2.4995]], K.SOFT);        // rear seam
    for (i = 0; i < 2; i++) {                                                  // stitch rows
      var stx = -0.55 + i * 0.74;
      line(m, [stx, 0.268, 1.722], [stx, 0.268, 2.498], K.SOFT);
    }

    /* ---- back rest: a panel plus a half-round top roll ---- */
    boxAt(m, -0.87, S.railY0, S.backZ, 0.67, 0.735, S.z1, { fill: '@fabric', shade: true });
    var rollC = (S.backZ + S.z1) / 2, rollR = (S.z1 - S.backZ) / 2 - 0.006;
    (function topRoll() {
      var prof = [[rollC - rollR, 0.735]];
      for (var q = 1; q <= 5; q++) {
        var a = Math.PI * q / 7 + Math.PI;                 // left → over the top → right
        prof.push([rollC + Math.cos(a) * rollR, 0.735 + Math.sin(a) * rollR * -1]);
      }
      prof.push([rollC + rollR, 0.735]);
      G.outline(m, prof, function (u, v) { return [-0.87, v, u]; }, [1, 0, 0], 1.54,
        { fill: '@fabric', kind: K.EDGE, silhouette: false });
    })();
    // the heavy top line of the sofa — its outer silhouette
    line(m, [-0.87, 0.796, rollC], [0.67, 0.796, rollC], K.SIL);
    line(m, [-0.87, 0.762, S.z1 - 0.004], [0.67, 0.762, S.z1 - 0.004], K.FINE);
    // back-rest seams, visible over the top from the room
    for (i = 0; i < 2; i++) {
      line(m, [-0.87 + 0.77 * (i + 1) * 0.5 - 0.385, 0.735, S.z1 - 0.003],
        [-0.87 + 0.77 * (i + 1) * 0.5 - 0.385, 0.20, S.z1 - 0.003], K.SOFT);
    }
    path(m, [[-0.87, 0.72, S.z1 - 0.0025], [0.67, 0.72, S.z1 - 0.0025]], K.FINE);

    /* ---- rolled arms ---- */
    armPanel(m, S.armIn[0], S.x0, S.railY1, 1.70, 2.54, '@fabric');
    armPanel(m, S.armIn[1], S.x1, S.railY1, 1.70, 2.54, '@fabric');

    /* ---- two seat cushions: segmented, bowed, creased, piped ---- */
    var seat = [
      { cx: -0.485, cz: 2.09, w: 0.74 },
      { cx: 0.285, cz: 2.09, w: 0.74 }
    ];
    for (i = 0; i < 2; i++) {
      softPanel(m, {
        cx: seat[i].cx, cy: S.deckY + 0.001, cz: seat[i].cz,
        w: seat[i].w, d: 0.66, h: 0.20,
        corner: 0.32, belly: 0.026, rim: 0.15, dome: 0.038,
        creases: 2, fill: i ? '@fabric' : '@fabric', fillAlt: '@fabricAlt'
      });
      // the front roll of the seat cushion, read at the cushion's leading edge
      path(m, [
        [seat[i].cx - seat[i].w / 2 + 0.08, 0.386, 1.7555],
        [seat[i].cx, 0.372, 1.7525],
        [seat[i].cx + seat[i].w / 2 - 0.08, 0.386, 1.7555]
      ], K.FINE);
    }

    /* ---- two back cushions, leaning ~17° into the back rest ---- */
    for (i = 0; i < 2; i++) {
      softPanel(m, {
        cx: i ? 0.29 : -0.47, cy: S.seatTop - 0.05, cz: S.backZ - 0.10,
        w: 0.72, d: 0.15, h: 0.33,
        lean: 0.30, corner: 0.34, belly: 0.013, rim: 0.16, dome: 0.018,
        bellyRing: false, creases: 2,
        fill: '@fabricAlt', fillAlt: '@fabric'
      });
      // a soft crease where the cushion folds over the seat cushion
      line(m, [i ? 0.29 - 0.30 : -0.47 - 0.30, 0.442, 2.21],
        [i ? 0.29 + 0.30 : -0.47 + 0.30, 0.442, 2.21], K.SOFT);
    }

    /* ---- sofa outline: the base's outer edge on the room side ---- */
    line(m, [-1.00, 0.104, 1.78], [-1.00, 0.104, 2.46], K.SIL);
    line(m, [0.80, 0.104, 1.78], [0.80, 0.104, 2.46], K.SIL);
    path(m, [[-0.94, 0.104, 1.7205], [0.74, 0.104, 1.7205]], K.SIL);
  }

  /* ======================================================================
     §3  the two throw pillows  —  click to puff
     ====================================================================== */

  var PILLOWS = [
    { id: 'cushionL', label: '抱枕 Cushion (左)', x: -0.62, y: 0.498, z: 1.86, rot: 18, lean: 0.34 },
    { id: 'cushionR', label: '抱枕 Cushion (右)', x: 0.42, y: 0.498, z: 1.86, rot: -24, lean: 0.38 }
  ];

  function pillowMesh(m, i) {
    var P0 = PILLOWS[i];
    softPanel(m, {
      cx: P0.x, cy: P0.y, cz: P0.z, w: 0.40, d: 0.40, h: 0.40,
      yaw: P0.rot * Math.PI / 180, lean: P0.lean, segs: 10,
      corner: 0.34, belly: 0.040, rim: 0.22, dome: 0.056,
      bellyRing: true, creases: 1, cornerCrease: true,
      fill: '@fabric', fillAlt: '@fabricAlt'
    });
    // the seam where the pillow is pinched at one corner
    var q = rotY([0.155, 0.30, -0.155], P0.rot * Math.PI / 180);
    q = [q[0], q[1] * Math.cos(P0.lean) - q[2] * Math.sin(P0.lean),
      q[1] * Math.sin(P0.lean) + q[2] * Math.cos(P0.lean)];
    line(m, [P0.x + q[0], P0.y + q[1], P0.z + q[2]],
      [P0.x + q[0] * 0.86, P0.y + q[1] * 0.98, P0.z + q[2] * 0.86], K.SOFT);
  }

  /* ======================================================================
     §4  coffee table  —  (-0.10, 0, 1.02), 0.92 × 0.42 × 0.50
         magazines · tray with a candle · coaster
     ====================================================================== */

  var TABLE = {
    cx: -0.10, cz: 1.02, x0: -0.56, x1: 0.36, z0: 0.77, z1: 1.27,
    topY: 0.42, botY: 0.36
  };

  function magazine(m, cx, cy, cz, yaw, fill) {
    var c = Math.cos(yaw), s = Math.sin(yaw);
    function P(px, pz, y) { return [cx + px * c + pz * s, y, cz - px * s + pz * c]; }
    rotBox(m, cx, cy, cz, 0.22, 0.013, 0.30, yaw, { fill: fill || '@paper' });
    // page block + spine, inked a hair proud of the cover
    path(m, [P(-0.106, 0.152, cy + 0.005), P(0.106, 0.152, cy + 0.005)], K.FINE);
    path(m, [P(-0.112, -0.148, cy + 0.002), P(-0.112, 0.148, cy + 0.002)], K.SOFT);
  }

  function buildTable(m, mags, magTop) {
    var T = TABLE, i;

    /* ---- top slab: chamfered outline, edge band, bevel underneath ---- */
    bevelSlab(m, chamRect(T.cx, T.cz, 0.92, 0.50, 0.055), T.botY, T.topY, 0.024,
      { fill: '@wood', fillAlt: '@woodDark' });
    path(m, chamRect(T.cx, T.cz, 0.906, 0.486, 0.052).map(function (p) {
      return [p[0], T.topY - 0.013, p[1]];
    }), K.FINE, true);
    // joinery dots on the top — dowel plugs at the leg positions
    for (i = 0; i < 4; i++) {
      var jx = T.cx + (i % 2 ? 0.335 : -0.335), jz = T.cz + (i < 2 ? 0.16 : -0.16);
      var dot = [];
      for (var q = 0; q < 8; q++) {
        var a = q / 8 * Math.PI * 2;
        dot.push([jx + Math.cos(a) * 0.013, T.topY + 0.0007, jz + Math.sin(a) * 0.013]);
      }
      face(m, dot, { fill: '@woodDark', kind: K.FINE });
    }

    /* ---- four round tapered legs with turned feet ---- */
    var lx = [-0.50, 0.30], lz = [0.83, 1.21];
    for (i = 0; i < 2; i++) {
      for (var k = 0; k < 2; k++) {
        legY(m, lx[i], lz[k], 0, T.botY, 0.029, 0.021,
          { fill: '@wood', ring: !(k === 0 && i === 0) });
      }
    }

    /* ---- lower shelf + stretcher rails ---- */
    bevelSlab(m, chamRect(T.cx, T.cz, 0.78, 0.36, 0.05), 0.150, 0.195, 0.014,
      { fill: '@woodDark', fillAlt: '@wood' });
    path(m, chamRect(T.cx, T.cz, 0.768, 0.348, 0.048).map(function (p) {
      return [p[0], 0.182, p[1]];
    }), K.FINE, true);
    for (i = 0; i < 2; i++) {
      var rz = lz[i];
      boxAt(m, -0.50, 0.104, rz - 0.016, 0.30, 0.146, rz + 0.016, { fill: '@woodDark', shade: true });
      path(m, [[-0.50, 0.125, rz - 0.0165], [0.30, 0.125, rz - 0.0165]], K.SOFT);
    }

    /* ---- a small round tray with a rim, and a candle in it ---- */
    var tcx = 0.055, tcz = 1.10, ty = T.topY, segs = 12;
    var inner = circleXZ(tcx, tcz, ty + 0.003, 0.086, segs);
    var outer = circleXZ(tcx, tcz, ty + 0.034, 0.100, segs);
    face(m, inner, { fill: '@woodDark', kind: K.SOFT, shade: 0.03 });
    for (i = 0; i < segs; i++) {
      quad(m, inner[i], inner[(i + 1) % segs], outer[(i + 1) % segs], outer[i],
        { fill: i % 3 ? '@woodDark' : '@wood', kind: K.SOFT });
    }
    path(m, outer, K.FINE, true);
    path(m, inner, K.SOFT, true);
    // the candle: a real little cylinder with a wick
    var cnd = circleXZ(0.02, 1.085, ty + 0.004, 0.021, segs);
    var cndT = circleXZ(0.02, 1.085, ty + 0.052, 0.020, segs);
    face(m, cndT, { fill: '@paper', kind: K.FINE });
    for (i = 0; i < segs; i++) {
      quad(m, cnd[i], cnd[(i + 1) % segs], cndT[(i + 1) % segs], cndT[i],
        { fill: i % 4 ? '@paper' : '@accent', kind: K.SOFT });
    }
    path(m, cnd, K.FINE, true);
    line(m, [0.02, ty + 0.052, 1.085], [0.02, ty + 0.061, 1.085], K.FINE);

    /* ---- coaster ---- */
    var co = circleXZ(0.205, 0.925, ty + 0.004, 0.042, segs);
    face(m, co, { fill: '@woodDark', kind: K.SOFT, shade: 0.02 });
    path(m, co, K.FINE, true);

    /* ---- the magazine stack (the top one is its own mesh: it flips) ---- */
    magazine(mags, -0.30, T.topY, 1.00, 0.055, '@paper');
    magazine(mags, -0.295, T.topY + 0.013, 1.005, -0.035, '@rugAlt');
    magazine(magTop, 0, 0.013, 0, 0, '@paper');
  }

  /* ======================================================================
     §5  rug  —  (-0.10, 0.006, 1.42), 2.40 × 0.012 × 1.85 (z 0.50…2.35)
     ====================================================================== */

  var RUG = { x0: -1.30, x1: 1.10, z0: 0.495, z1: 2.345, top: 0.012 };

  /** The travelling ripple: it only ever lifts, so the rug never sinks. */
  function rugLift(x, z, t) {
    if (!(t >= 0) || t > 1.15) return 0;
    var u = t / 1.15;
    var decay = (1 - u) * (1 - u);
    var front = -1.30 + u * 2.95;
    var d = (x - front) / 0.46;
    var env = Math.exp(-d * d);
    var ph = (x - front) / 0.20;
    var zmod = 0.86 + 0.14 * Math.cos((z - 1.42) * 3.1);
    return 0.030 * decay * env * zmod * (0.5 - 0.5 * Math.cos(ph));
  }

  function buildRug(m) {
    var R = RUG, i, j;
    var cols = 7, rows = 5;

    /* ---- knotted field: one grid, the outer ring hatched as the border ---- */
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        var x0 = R.x0 + (R.x1 - R.x0) * (i / cols), x1 = R.x0 + (R.x1 - R.x0) * ((i + 1) / cols);
        var z0 = R.z0 + (R.z1 - R.z0) * (j / rows), z1 = R.z0 + (R.z1 - R.z0) * ((j + 1) / rows);
        var border = (i === 0 || i === cols - 1 || j === 0 || j === rows - 1);
        face(m, [[x0, R.top, z0], [x1, R.top, z0], [x1, R.top, z1], [x0, R.top, z1]], {
          fill: border ? '@rugAlt' : '@rug',
          kind: K.FINE,
          hatch: border ? { angle: 45, gap: 9, alpha: 0.16 } : null,
          shade: border ? 0.022 : ((i + j) % 2) * 0.014
        });
      }
    }
    /* ---- the pile's edge, 12 mm of it ---- */
    var E = [[R.x0, R.z0], [R.x1, R.z0], [R.x1, R.z1], [R.x0, R.z1]];
    for (i = 0; i < 4; i++) {
      var a = E[i], b = E[(i + 1) % 4];
      quad(m, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], R.top, b[1]], [a[0], R.top, a[1]],
        { fill: '@rugAlt', kind: K.FINE, shade: 0.05 });
    }
    /* ---- fringe: 18 tapered tufts at each end, deterministic ---- */
    for (i = 0; i < 18; i++) {
      var tz = R.z0 + 0.03 + (R.z1 - R.z0 - 0.06) * (i / 17);
      var wob = G.rnd(i * 3.7 + 1.3) * 0.014 - 0.007;
      tri(m, [R.x0 + 0.006, 0.009, tz - 0.013], [R.x0 + 0.006, 0.009, tz + 0.013],
        [R.x0 - 0.034 - wob, 0.004, tz + wob * 0.6], { fill: '@rugAlt', kind: K.FINE });
      tri(m, [R.x1 - 0.006, 0.009, tz - 0.013], [R.x1 - 0.006, 0.009, tz + 0.013],
        [R.x1 + 0.034 + wob, 0.004, tz + wob * 0.6], { fill: '@rugAlt', kind: K.FINE });
    }
    /* ---- motif: nested fields and a row of dashes ---- */
    function rectPath(inset, y) {
      return [[R.x0 + inset, y, R.z0 + inset], [R.x1 - inset, y, R.z0 + inset],
        [R.x1 - inset, y, R.z1 - inset], [R.x0 + inset, y, R.z1 - inset]];
    }
    path(m, rectPath(0.34, R.top + 0.0012), K.FINE, true);
    path(m, rectPath(0.44, R.top + 0.0012), K.SOFT, true);
    for (i = 0; i < 9; i++) {
      var dx = -0.86 + i * 0.215;
      line(m, [dx, R.top + 0.0012, 1.30], [dx, R.top + 0.0012, 1.54], K.SOFT);
      if (i < 8) line(m, [dx, R.top + 0.0012, 1.60], [dx + 0.10, R.top + 0.0012, 1.60], K.SOFT);
    }
    for (i = 0; i < 3; i++) {
      var mx = -0.75 + i * 0.60, mz = i % 2 ? 0.90 : 1.95;
      path(m, [[mx, R.top + 0.0014, mz - 0.07], [mx + 0.05, R.top + 0.0014, mz],
        [mx, R.top + 0.0014, mz + 0.07], [mx - 0.05, R.top + 0.0014, mz]], K.SOFT, true);
    }
    /* ---- the pile is never perfectly flat: waviness along the near edge ---- */
    for (i = 0; i < 3; i++) {
      var wx = -0.95 + i * 0.72;
      path(m, [[wx, R.top + 0.0016, R.z0 + 0.16], [wx + 0.24, R.top + 0.0016, R.z0 + 0.115],
        [wx + 0.48, R.top + 0.0016, R.z0 + 0.16]], K.SOFT);
    }
  }

  /* ======================================================================
     §6  sideboard  —  (-1.32, 0, 0.92), 0.62 × 0.90 × 0.42, facing +x
         the left door is interactive and hides five upright records
     ====================================================================== */

  var SIDE = {
    x0: -1.62, x1: -1.03, z0: 0.72, z1: 1.12,
    y0: 0.14, y1: 0.86, topY: 0.90, front: -1.01, divZ: 0.92
  };

  /** One door: slab, fine gap all round, raised panel, bar handle. */
  function doorPanel(m, z0, z1, y0, y1, hingeZ, opening) {
    boxAt(m, SIDE.x1, y0, z0, SIDE.front, y1, z1, { fill: '@wood', shade: true });
    var fx = SIDE.front + 0.0008;
    path(m, [[fx, y0 + 0.004, z0 + 0.004], [fx, y1 - 0.004, z0 + 0.004],
      [fx, y1 - 0.004, z1 - 0.004], [fx, y0 + 0.004, z1 - 0.004]], K.FINE, true);
    var ip = 0.030;
    path(m, [[fx, y0 + ip, z0 + ip], [fx, y1 - ip, z0 + ip],
      [fx, y1 - ip, z1 - ip], [fx, y0 + ip, z1 - ip]], K.SOFT, true);
    // bar handle, set in from the opening edge
    var hz0 = opening > 0 ? z0 + 0.012 : z1 - 0.062, hz1 = hz0 + 0.050;
    var hy = (y0 + y1) / 2;
    boxAt(m, fx, hy - 0.013, hz0, fx + 0.020, hy + 0.013, hz1, { fill: '@metal', shade: true });
    path(m, [[fx + 0.0205, hy, hz0 + 0.004], [fx + 0.0205, hy, hz1 - 0.004]], K.FINE);
    return null;
  }

  function buildSideboard(m, door) {
    var S = SIDE, i, k;

    /* ---- four tapered legs on a mid-century plinth ---- */
    var lx = [-1.575, -1.065], lz = [0.775, 1.065];
    for (i = 0; i < 2; i++) {
      for (k = 0; k < 2; k++) {
        legY(m, lx[i], lz[k], 0, S.y0, 0.024, 0.017,
          { fill: '@woodDark', ring: !(i === 0), ringSteps: 5 });
      }
    }

    /* ---- carcass: outer shell, inner shell and the panel edges between ---- */
    var t = 0.022;
    // outer
    face(m, [[S.x0, S.y1, S.z0], [S.x1, S.y1, S.z0], [S.x1, S.y1, S.z1], [S.x0, S.y1, S.z1]],
      { fill: '@woodDark', kind: K.EDGE, shade: 0.02 });                   // top
    face(m, [[S.x0, S.y0, S.z1], [S.x1, S.y0, S.z1], [S.x1, S.y0, S.z0], [S.x0, S.y0, S.z0]],
      { fill: '@woodDark', kind: K.FINE, shade: 0.05 });                   // bottom
    face(m, [[S.x0, S.y0, S.z1], [S.x0, S.y0, S.z0], [S.x0, S.y1, S.z0], [S.x0, S.y1, S.z1]],
      { fill: '@wood', kind: K.EDGE, shade: 0.03 });                       // back
    face(m, [[S.x1, S.y0, S.z0], [S.x0, S.y0, S.z0], [S.x0, S.y1, S.z0], [S.x1, S.y1, S.z0]],
      { fill: '@wood', kind: K.EDGE, shade: 0.02 });                       // south side
    face(m, [[S.x0, S.y0, S.z1], [S.x1, S.y0, S.z1], [S.x1, S.y1, S.z1], [S.x0, S.y1, S.z1]],
      { fill: '@wood', kind: K.EDGE, shade: 0.02 });                       // north side
    // inner
    face(m, [[S.x0 + t, S.y1 - t, S.z1 - t], [S.x1, S.y1 - t, S.z1 - t],
      [S.x1, S.y1 - t, S.z0 + t], [S.x0 + t, S.y1 - t, S.z0 + t]],
      { fill: '@woodDark', kind: K.FINE, shade: 0.06 });
    face(m, [[S.x0 + t, S.y0 + t, S.z0 + t], [S.x1, S.y0 + t, S.z0 + t],
      [S.x1, S.y0 + t, S.z1 - t], [S.x0 + t, S.y0 + t, S.z1 - t]],
      { fill: '@wood', kind: K.FINE, shade: 0.03 });
    face(m, [[S.x0 + t, S.y0 + t, S.z0 + t], [S.x0 + t, S.y0 + t, S.z1 - t],
      [S.x0 + t, S.y1 - t, S.z1 - t], [S.x0 + t, S.y1 - t, S.z0 + t]],
      { fill: '@woodDark', kind: K.SOFT, shade: 0.04 });
    face(m, [[S.x1, S.y0 + t, S.z0 + t], [S.x0 + t, S.y0 + t, S.z0 + t],
      [S.x0 + t, S.y1 - t, S.z0 + t], [S.x1, S.y1 - t, S.z0 + t]],
      { fill: '@wood', kind: K.SOFT, shade: 0.02 });
    face(m, [[S.x0 + t, S.y0 + t, S.z1 - t], [S.x1, S.y0 + t, S.z1 - t],
      [S.x1, S.y1 - t, S.z1 - t], [S.x0 + t, S.y1 - t, S.z1 - t]],
      { fill: '@wood', kind: K.SOFT, shade: 0.02 });
    // front edges of the panels (the visible board thickness)
    face(m, [[S.x1, S.y1 - t, S.z0], [S.x1, S.y1 - t, S.z1], [S.x1, S.y1, S.z1], [S.x1, S.y1, S.z0]],
      { fill: '@wood', kind: K.FINE });
    face(m, [[S.x1, S.y0, S.z0], [S.x1, S.y0, S.z1], [S.x1, S.y0 + t, S.z1], [S.x1, S.y0 + t, S.z0]],
      { fill: '@wood', kind: K.FINE });
    face(m, [[S.x1, S.y0, S.z0], [S.x1, S.y0 + t, S.z0], [S.x1, S.y1 - t, S.z0], [S.x1, S.y1, S.z0]],
      { fill: '@woodDark', kind: K.FINE });
    face(m, [[S.x1, S.y0, S.z1], [S.x1, S.y0 + t, S.z1], [S.x1, S.y1 - t, S.z1], [S.x1, S.y1, S.z1]],
      { fill: '@woodDark', kind: K.FINE });
    // centre divider
    face(m, [[S.x0 + t, S.y0 + t, S.divZ - 0.011], [S.x1, S.y0 + t, S.divZ - 0.011],
      [S.x1, S.y1 - t, S.divZ - 0.011], [S.x0 + t, S.y1 - t, S.divZ - 0.011]],
      { fill: '@wood', kind: K.FINE, shade: 0.03 });
    face(m, [[S.x0 + t, S.y0 + t, S.divZ + 0.011], [S.x1, S.y0 + t, S.divZ + 0.011],
      [S.x1, S.y1 - t, S.divZ + 0.011], [S.x0 + t, S.y1 - t, S.divZ + 0.011]],
      { fill: '@wood', kind: K.FINE, shade: 0.03 });
    face(m, [[S.x1, S.y0 + t, S.divZ - 0.011], [S.x1, S.y0 + t, S.divZ + 0.011],
      [S.x1, S.y1 - t, S.divZ + 0.011], [S.x1, S.y1 - t, S.divZ - 0.011]],
      { fill: '@woodDark', kind: K.FINE });

    /* ---- top slab with a slight oversail and a shadow gap ---- */
    boxAt(m, -1.63, S.y1, 0.71, -1.01, S.topY, 1.13, { fill: '@wood', shade: true });
    path(m, [[-1.6295, S.topY - 0.011, 0.7105], [-1.0105, S.topY - 0.011, 0.7105],
      [-1.0105, S.topY - 0.011, 1.1295], [-1.6295, S.topY - 0.011, 1.1295]], K.FINE, true);

    /* ---- five upright records in the left bay (edge-on, in a row) ---- */
    for (i = 0; i < 5; i++) {
      var rz = 0.948 + i * 0.030, rec = [];
      for (k = 0; k < 12; k++) {
        var a2 = k / 12 * Math.PI * 2;
        rec.push([-1.42 + Math.cos(a2) * 0.155, 0.317 + Math.sin(a2) * 0.155, rz]);
      }
      face(m, rec, { fill: '#3a3d47', kind: K.SOFT, shade: 0.02 });
      line(m, [-1.42, 0.317, rz + 0.001], [-1.42 + 0.055, 0.317, rz + 0.001], K.SOFT);
    }
    // a slipcase behind them, so the bay does not read as an empty hole
    face(m, [[-1.598, 0.166, 1.098], [-1.598, 0.166, 0.922], [-1.598, 0.834, 0.922], [-1.598, 0.834, 1.098]],
      { fill: '@woodDark', kind: K.SOFT, shade: 0.05 });

    /* ---- the right bay: a small box and a coiled cable ---- */
    boxAt(m, -1.55, 0.162, 0.755, -1.31, 0.298, 0.885, { fill: '@rugAlt', shade: true });
    path(m, [[-1.549, 0.23, 0.756], [-1.311, 0.23, 0.756]], K.FINE);
    var coil = circleXZ(-1.415, 0.83, 0.19, 0.055, 8);
    var coilI = circleXZ(-1.415, 0.83, 0.19, 0.032, 8);
    for (i = 0; i < 8; i++) {
      quad(m, coilI[i], coil[i], coil[(i + 1) % 8], coilI[(i + 1) % 8],
        { fill: '#3a3d47', kind: K.SOFT, shade: 0.03 });
    }
    path(m, coil, K.FINE, true);
    path(m, coilI, K.FINE, true);
    line(m, [-1.415, 0.19, 0.83], [-1.30, 0.185, 0.90], K.SOFT);

    /* ---- case silhouette + panel joints ---- */
    line(m, [-1.63, S.topY, 0.71], [-1.63, S.topY, 1.13], K.SIL);
    line(m, [-1.01, S.topY, 0.71], [-1.01, S.topY, 1.13], K.SIL);
    line(m, [-1.63, 0.712, 0.71], [-1.01, 0.712, 0.71], K.SIL);
    line(m, [-1.63, 0.712, 1.13], [-1.01, 0.712, 1.13], K.SIL);
    path(m, [[-1.0195, 0.845, 0.725], [-1.0195, 0.845, 1.115]], K.FINE);
    line(m, [-1.5, 0.86, 1.1295], [-1.14, 0.86, 1.1295], K.SOFT);
    line(m, [-1.3, 0.90, 0.7105], [-1.3, 0.90, 1.1295], K.SOFT);

    /* ---- the doors (the left one lives in its own mesh: it swings) ---- */
    doorPanel(door, 0.935, 1.115, 0.17, 0.83, 1.115, 1);
    doorPanel(m, 0.725, 0.905, 0.17, 0.83, 0.725, -1);
  }

  /* ======================================================================
     §7  record player  —  (-1.32, 0.90, 0.92), 0.50 × 0.26 × 0.36
         plinth + panel · spinning platter & record · swinging tonearm
     ====================================================================== */

  var PLAY = {
    x0: -1.57, x1: -1.07, z0: 0.74, z1: 1.10, y0: 0.90, y1: 1.11,
    sx: -1.41, sz: 0.94,            // spindle
    px: -1.16, pz: 1.02,            // tonearm pivot
    armL: 0.17, rest: 1.658, play: 0.42, rpm: 0.62
  };
  var ARM_BASE = Math.atan2(PLAY.sz - PLAY.pz, PLAY.sx - PLAY.px);
  var ARM_DIR = [Math.cos(ARM_BASE), Math.sin(ARM_BASE)];
  var ARM_PERP = [-ARM_DIR[1], ARM_DIR[0]];

  function platterSpin(a) {
    return function (x, y, z) {
      var dx = x - PLAY.sx, dz = z - PLAY.sz;
      var c = Math.cos(a), s = Math.sin(a);
      return [PLAY.sx + dx * c + dz * s, y, PLAY.sz - dx * s + dz * c];
    };
  }
  function armSwing(phi) {
    return function (x, y, z) {
      var dx = x - PLAY.px, dz = z - PLAY.pz;
      var c = Math.cos(-phi), s = Math.sin(-phi);
      return [PLAY.px + dx * c + dz * s, y, PLAY.pz - dx * s + dz * c];
    };
  }

  function buildPlayer(base, platter, arm) {
    var i, k, a;
    var segs = 12;

    /* ---- the plinth and its front panel ---- */
    boxAt(base, PLAY.x0, PLAY.y0, PLAY.z0, PLAY.x1, PLAY.y1, PLAY.z1, { fill: '@wood', shade: true });
    path(base, [[PLAY.x1 + 0.0005, 1.078, PLAY.z0 + 0.004], [PLAY.x1 + 0.0005, 1.078, PLAY.z1 - 0.004],
      [PLAY.x0 - 0.0005, 1.078, PLAY.z1 - 0.004], [PLAY.x0 - 0.0005, 1.078, PLAY.z0 + 0.004]],
      K.FINE, false);
    // plinth chamfer line along the top edge
    path(base, [[PLAY.x1, PLAY.y1 - 0.012, PLAY.z0], [PLAY.x1, PLAY.y1 - 0.012, PLAY.z1]], K.SOFT);

    /* ---- front panel: power knob, speed switch, grille slots, LED ---- */
    var fx = PLAY.x1 + 0.0006;
    // power knob (a real little barrel)
    G.tube(base, [fx, 1.020, 0.795], [fx + 0.016, 1.020, 0.795], 0.018, 0.016, 10,
      { fill: '@metalDark', kind: K.FINE, caps: true });
    // a pointer on the knob
    line(base, [fx + 0.017, 1.020, 0.795], [fx + 0.017, 1.031, 0.795], K.FINE);
    // speed switch
    boxAt(base, fx, 0.955, 0.775, fx + 0.014, 0.980, 0.855, { fill: '@metal', shade: true });
    path(base, [[fx + 0.0145, 0.9675, 0.780], [fx + 0.0145, 0.9675, 0.850]], K.FINE);
    // speaker grille: eight fine slots
    for (i = 0; i < 8; i++) {
      var gz = 0.985 + i * 0.014;
      line(base, [fx, 0.905, gz], [fx, 0.925, gz], K.FINE);
    }
    // panel seams and the 45 rpm legend tick
    path(base, [[fx, 0.893, PLAY.z0 + 0.01], [fx, 0.893, PLAY.z1 - 0.01]], K.SOFT);
    line(base, [fx, 1.078, 0.862], [fx, 1.078, 0.874], K.SOFT);
    // the "playing" indicator lamp
    var led = face(base, [[fx, 1.030, 1.046], [fx, 1.030, 1.078], [fx, 1.046, 1.078], [fx, 1.046, 1.046]],
      { fill: '@metalDark', kind: K.FINE, glow: 0 });

    /* ---- the tonearm's rest clip, at the arm's parked position ---- */
    var ra = ARM_BASE + PLAY.rest;
    var rx = PLAY.px + Math.cos(ra) * PLAY.armL, rz = PLAY.pz + Math.sin(ra) * PLAY.armL;
    boxAt(base, rx - 0.010, PLAY.y1, rz - 0.010, rx + 0.010, PLAY.y1 + 0.030, rz + 0.010,
      { fill: '@metal', shade: true });
    line(base, [rx, PLAY.y1 + 0.030, rz], [rx, PLAY.y1 + 0.038, rz], K.FINE);

    /* ---- platter + record + label + grooves (all of it turns) ---- */
    var topY = PLAY.y1;
    // platter rim: a real cylinder
    var pr0 = circleXZ(PLAY.sx, PLAY.sz, topY + 0.001, 0.155, segs);
    var pr1 = circleXZ(PLAY.sx, PLAY.sz, topY + 0.020, 0.155, segs);
    face(platter, circleXZ(PLAY.sx, PLAY.sz, topY + 0.0205, 0.155, segs),
      { fill: '@metal', kind: K.FINE, shade: 0.01 });
    for (i = 0; i < segs; i++) {
      quad(platter, pr0[i], pr0[(i + 1) % segs], pr1[(i + 1) % segs], pr1[i],
        { fill: i % 3 ? '@metal' : '@metalDark', kind: K.SOFT });
    }
    path(platter, pr1, K.SOFT, true);
    // a strobe dot on the rim: the spin is legible because of it
    quad(platter, [PLAY.sx + 0.150, topY + 0.006, PLAY.sz + 0.036],
      [PLAY.sx + 0.150, topY + 0.006, PLAY.sz + 0.030],
      [PLAY.sx + 0.150, topY + 0.014, PLAY.sz + 0.030],
      [PLAY.sx + 0.150, topY + 0.014, PLAY.sz + 0.036], { fill: '#2a2b33', kind: K.FINE });
    // the record itself
    var recY = topY + 0.0225;
    var disc = [];
    for (i = 0; i < 16; i++) {
      a = i / 16 * Math.PI * 2;
      disc.push([PLAY.sx + Math.cos(a) * 0.150, recY, PLAY.sz + Math.sin(a) * 0.150]);
    }
    face(platter, disc, { fill: '#2a2b33', kind: K.EDGE, shade: 0.01 });
    for (i = 0; i < 6; i++) {                        // groove rings
      var gr = 0.060 + i * 0.0145, gp = [];
      for (k = 0; k < 14; k++) {
        a = k / 14 * Math.PI * 2;
        gp.push([PLAY.sx + Math.cos(a) * gr, recY + 0.0006, PLAY.sz + Math.sin(a) * gr]);
      }
      path(platter, gp, K.SOFT, true);
    }
    var lab = [];
    for (i = 0; i < 12; i++) {
      a = i / 12 * Math.PI * 2;
      lab.push([PLAY.sx + Math.cos(a) * 0.048, recY + 0.0008, PLAY.sz + Math.sin(a) * 0.048]);
    }
    face(platter, lab, { fill: '@accent', kind: K.FINE });
    path(platter, lab, K.FINE, true);
    // two marks on the label, so a turning record is unmistakable
    line(platter, [PLAY.sx - 0.030, recY + 0.0011, PLAY.sz - 0.012],
      [PLAY.sx - 0.046, recY + 0.0011, PLAY.sz - 0.018], K.FINE);
    line(platter, [PLAY.sx + 0.020, recY + 0.0011, PLAY.sz + 0.030],
      [PLAY.sx + 0.034, recY + 0.0011, PLAY.sz + 0.022], K.FINE);
    // spindle + 45 adapter
    G.tube(platter, [PLAY.sx, recY - 0.002, PLAY.sz], [PLAY.sx, recY + 0.036, PLAY.sz],
      0.007, 0.006, 10, { fill: '@metal', kind: K.FINE, caps: true });
    face(platter, circleXZ(PLAY.sx, PLAY.sz, recY + 0.011, 0.019, 10), { fill: '@metalDark', kind: K.FINE });
    path(platter, circleXZ(PLAY.sx, PLAY.sz, recY + 0.0115, 0.019, 10), K.FINE, true);

    /* ---- tonearm: pivot base, arm tube, headshell, counterweight ---- */
    var py = PLAY.y1;
    revolve(arm, PLAY.px, PLAY.pz, [[py, 0.024], [py + 0.038, 0.013]], 10,
      { fill: '@metalDark', kind: K.SOFT, bandKind: [K.FINE], top: true });
    var A = [PLAY.px + ARM_DIR[0] * 0.020, py + 0.044, PLAY.pz + ARM_DIR[1] * 0.020];
    var B = [PLAY.px + ARM_DIR[0] * PLAY.armL, py + 0.036, PLAY.pz + ARM_DIR[1] * PLAY.armL];
    G.tube(arm, A, B, 0.008, 0.006, 8, { fill: '@metal', kind: K.EDGE, caps: true, fills: true });
    // headshell: a small angled block carrying the stylus
    var hu = ARM_DIR, hv = ARM_PERP;
    var hb = [];
    for (i = 0; i < 2; i++) {
      var yy = py + 0.030 + i * 0.011;
      hb.push([B[0] - hv[0] * 0.013, yy, B[2] - hv[1] * 0.013]);
      hb.push([B[0] + hu[0] * 0.034 - hv[0] * 0.013, yy, B[2] + hu[1] * 0.034 - hv[1] * 0.013]);
      hb.push([B[0] + hu[0] * 0.034 + hv[0] * 0.013, yy, B[2] + hu[1] * 0.034 + hv[1] * 0.013]);
      hb.push([B[0] + hv[0] * 0.013, yy, B[2] + hv[1] * 0.013]);
    }
    G.hullBox(arm, hb, { fill: '@metalDark', kind: K.FINE, edges: false, cull: false });
    line(arm, [B[0] + hu[0] * 0.030, py + 0.030, B[2] + hu[1] * 0.030],
      [B[0] + hu[0] * 0.030, py + 0.022, B[2] + hu[1] * 0.030], K.FINE);
    // counterweight behind the pivot
    G.tube(arm, [PLAY.px - ARM_DIR[0] * 0.048, py + 0.046, PLAY.pz - ARM_DIR[1] * 0.048],
      [PLAY.px - ARM_DIR[0] * 0.086, py + 0.046, PLAY.pz - ARM_DIR[1] * 0.086],
      0.020, 0.018, 8, { fill: '@metalDark', kind: K.FINE, caps: true });
    line(arm, [PLAY.px - ARM_DIR[0] * 0.052, py + 0.046, PLAY.pz - ARM_DIR[1] * 0.052],
      [PLAY.px - ARM_DIR[0] * 0.082, py + 0.046, PLAY.pz - ARM_DIR[1] * 0.082], K.SOFT);

    return { led: led };
  }

  /* ======================================================================
     §8  office chair  —  (0.86, 0, -1.05), faces +x, draggable
     ====================================================================== */

  var CHAIR = {
    x: 0.86, z: -1.05, yaw: -Math.PI / 2,
    xMin: 0.10, xMax: 1.20, zMin: -2.05, zMax: -0.20,
    deskX: 1.02, keepX: 1.00, deskZ0: -1.95, deskZ1: -0.15,
    wheelR: 0.030, casterR: 0.225, casters: 5
  };
  var CHAIR_FACE = Math.atan2(3.30 - CHAIR.z, 2.5 - CHAIR.x);

  /** The keep-out rules: the desk's footprint and the bookshelf zone. */
  function clampChair(x, z) {
    x = M.clamp(x, CHAIR.xMin, CHAIR.xMax);
    z = M.clamp(z, CHAIR.zMin, CHAIR.zMax);
    if (z > CHAIR.deskZ0 && z < CHAIR.deskZ1) x = Math.min(x, CHAIR.keepX);
    return [x, z];
  }

  function buildChair(base, top) {
    var i, k, segs = 12;
    var wheels = [];

    /* ---- gas lift column with a chrome collar ---- */
    revolve(base, 0, 0, [[0.042, 0.040], [0.150, 0.031], [0.440, 0.026]], segs,
      { fill: '@metalDark', kind: K.SOFT, bandKind: [K.FINE, K.SOFT] });
    footRing(base, 0, 0, 0.152, 0.0325, { steps: 6, span: 0.62, face: CHAIR_FACE, kind: K.FINE });
    path(base, circleXZ(0, 0, 0.44, 0.026, segs), K.SOFT, true);

    /* ---- five-star base ---- */
    for (i = 0; i < 5; i++) {
      var th = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var ux = Math.cos(th), uz = Math.sin(th);
      var px = -uz, pz = ux;                       // perpendicular
      var hub = 0.052, tip = 0.255;
      var p = [];
      var w0 = 0.030, w1 = 0.019;
      // bottom ring (y at the hub / y at the tip), then the top ring
      p.push([ux * hub - px * w0, 0.030, uz * hub - pz * w0]);
      p.push([ux * tip - px * w1, 0.018, uz * tip - pz * w1]);
      p.push([ux * tip + px * w1, 0.018, uz * tip + pz * w1]);
      p.push([ux * hub + px * w0, 0.030, uz * hub + pz * w0]);
      p.push([ux * hub - px * w0, 0.058, uz * hub - pz * w0]);
      p.push([ux * tip - px * w1, 0.040, uz * tip - pz * w1]);
      p.push([ux * tip + px * w1, 0.040, uz * tip + pz * w1]);
      p.push([ux * hub + px * w0, 0.058, uz * hub + pz * w0]);
      G.hullBox(base, p, { fill: '@metalDark', kind: K.EDGE, edges: false, cull: false, open: { ny: true } });

      /* ---- caster: fork plate + a real 12-sided wheel ---- */
      var cx = ux * CHAIR.casterR, cz = uz * CHAIR.casterR;
      var v0 = base.verts.length;
      wheel(base, [cx, 0.030, cz], [px, pz], CHAIR.wheelR, 0.009, segs,
        { fill: '@metalDark', caps: 'outer' });
      wheels.push({ v0: v0, v1: base.verts.length, c: [cx, 0.030, cz], ax: [px, pz] });
      // the fork, drawn as a plate over the wheel's inboard side
      quad(base, [ux * 0.20 - px * 0.014, 0.048, uz * 0.20 - pz * 0.014],
        [ux * 0.255 - px * 0.014, 0.038, uz * 0.255 - pz * 0.014],
        [ux * 0.255 - px * 0.014, 0.012, uz * 0.255 - pz * 0.014],
        [ux * 0.20 - px * 0.014, 0.030, uz * 0.20 - pz * 0.014], { fill: '@metal', kind: K.FINE });
      line(base, [cx - px * 0.010, 0.030, cz - pz * 0.010], [cx + px * 0.010, 0.030, cz + pz * 0.010], K.FINE);
    }
    revolve(base, 0, 0, [[0.036, 0.050], [0.082, 0.046]], segs, { fill: '@metalDark', kind: K.SOFT, top: true });

    /* ---- seat pan: a shell with a padded top ---- */
    (function seat() {
      var p = [
        [-0.185, 0.435, -0.175], [0.185, 0.435, -0.175], [0.185, 0.435, 0.175], [-0.185, 0.435, 0.175],
        [-0.225, 0.480, -0.215], [0.225, 0.480, -0.215], [0.225, 0.480, 0.215], [-0.225, 0.480, 0.215]
      ];
      G.hullBox(top, p, { fill: '@metalDark', kind: K.EDGE, edges: false, cull: false, open: { ny: true } });
      path(top, [[-0.21, 0.452, -0.20], [0.21, 0.452, -0.20]], K.FINE);
      path(top, [[-0.21, 0.452, 0.20], [0.21, 0.452, 0.20]], K.FINE);
      softPanel(top, {
        cx: 0, cy: 0.478, cz: 0, w: 0.455, d: 0.435, h: 0.075,
        corner: 0.42, rim: 0.14, dome: 0.010, flatTop: true, bellyRing: false,
        creases: 0, fill: '@metal', fillAlt: '@metalDark'
      });
    })();

    /* ---- backrest on a bracket, with a slight recline ---- */
    boxAt(top, -0.045, 0.46, 0.155, 0.045, 0.60, 0.205, { fill: '@metalDark', shade: true });
    line(top, [-0.045, 0.53, 0.156], [0.045, 0.53, 0.156], K.FINE);
    softPanel(top, {
      cx: 0, cy: 0.575, cz: 0.175, w: 0.445, d: 0.085, h: 0.360,
      lean: 0.16, corner: 0.40, rim: 0.16, dome: 0.012, flatTop: true, bellyRing: false,
      creases: 0, fill: '@metal', fillAlt: '@metalDark'
    });
    // a horizontal lumbar seam across the back pad
    path(top, [[-0.16, 0.66, 0.195], [0, 0.672, 0.205], [0.16, 0.66, 0.195]], K.SOFT);

    /* ---- two armrests: bracket + padded pad ---- */
    for (i = 0; i < 2; i++) {
      var sgn = i ? 1 : -1;
      var ax = sgn * 0.205;
      // the post, read as a solid bracket rather than a pasted plate
      quad(top, [ax, 0.480, -0.120], [ax, 0.480, 0.100], [ax, 0.672, 0.100], [ax, 0.672, -0.120],
        { fill: '@metalDark', kind: K.FINE });
      quad(top, [ax - sgn * 0.030, 0.480, -0.120], [ax + sgn * 0.006, 0.480, -0.120],
        [ax + sgn * 0.006, 0.672, -0.120], [ax - sgn * 0.030, 0.672, -0.120],
        { fill: '@metalDark', kind: K.SOFT });
      line(top, [ax + sgn * 0.002, 0.480, -0.120], [ax + sgn * 0.002, 0.672, -0.120], K.SOFT);
      softPanel(top, {
        cx: ax + sgn * 0.008, cy: 0.668, cz: -0.010, w: 0.078, d: 0.250, h: 0.038,
        corner: 0.42, rim: 0.16, dome: 0.008, flatTop: true, bellyRing: false,
        creases: 0, fill: '@metal', fillAlt: '@metalDark'
      });
    }
    return wheels;
  }

  /**
   * The chair's rig: casters spin, the seat idles around the column, and the
   * whole thing yaws, leans into its direction of travel and settles back.
   */
  function chairWorld(st, x, y, z) {
    var c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    var wx = x * c + z * s, wy = y, wz = -x * s + z * c;
    if (st.lean) {
      var cl = Math.cos(st.lean), sl = Math.sin(st.lean);
      var ax = st.leanAx[0], az = st.leanAx[1];
      var d = ax * wx + az * wz;
      var rx = wx * cl - az * wy * sl + ax * d * (1 - cl);
      var ry = wy * cl + (az * wx - ax * wz) * sl;
      var rz = wz * cl + ax * wy * sl + az * d * (1 - cl);
      wx = rx; wy = ry; wz = rz;
    }
    return [st.x + wx, wy, st.z + wz];
  }

  function chairBaseRig(st, wheels) {
    return function (x, y, z, i) {
      for (var k = 0; k < wheels.length; k++) {
        var w = wheels[k];
        if (i >= w.v0 && i < w.v1) {
          var dx = x - w.c[0], dz = z - w.c[2];
          var c = Math.cos(st.wheel), s = Math.sin(st.wheel);
          var nx = dx * c + dz * s, nz = -dx * s + dz * c;
          x = w.c[0] + nx; z = w.c[2] + nz;
          break;
        }
      }
      return chairWorld(st, x, y, z);
    };
  }

  function chairTopRig(st) {
    return function (x, y, z) {
      var sw = Math.cos(st.swivel), ss = Math.sin(st.swivel);
      var nx = x * sw + z * ss, nz = -x * ss + z * sw;
      return chairWorld(st, nx, y, nz);
    };
  }

  /* ======================================================================
     §9  build — meshes, interactives, per-frame animation
     ====================================================================== */

  function idleCtx() {
    return {
      time: 0, hover: false,
      env: { lightsOn: false, lampOn: false, day: 1, hour: 12, minute: 0 },
      anim: P.anim,
      audio: { play: function () {} },
      toast: function () {},
      setEnv: function () {}
    };
  }

  function build(sctx) {
    var S = sctx.scene;
    var reg = sctx.register;
    var parts = sctx.parts || (sctx.parts = {});
    var i, k;
    var interactives = [];

    /* ---------------------------------------------------------- meshes */
    var sofa = S.addMesh();
    buildSofa(sofa);
    parts.sofa = sofa;

    var pillows = [], pillowRigs = [], pillSt = [];
    for (i = 0; i < 2; i++) {
      var pm = S.addMesh();
      pillowMesh(pm, i);
      pillows.push(pm);
      pillowRigs.push(rig(pm));
      pillSt.push({ t: 9, on: false, rot: 0, baseRot: 0 });
    }
    parts.pillowL = pillows[0];
    parts.pillowR = pillows[1];

    var table = S.addMesh(), mags = S.addMesh(), magTop = S.addMesh();
    buildTable(table, mags, magTop);
    parts.table = table;
    parts.magazines = mags;
    parts.magazineTop = magTop;
    var magTopRig = rig(magTop);
    var magSt = { yaw: 0.13, slide: 0, tYaw: 0.13, tSlide: 0, n: 0 };
    var magHome = { x: -0.30, z: 1.00, y: TABLE.topY + 0.026 };

    var rugM = S.addMesh();
    buildRug(rugM);
    parts.rug = rugM;
    var rugRig = rig(rugM);
    var rugSt = { t: 99, active: false, flat: true };

    var side = S.addMesh(), cabDoor = S.addMesh();
    buildSideboard(side, cabDoor);
    parts.sideboard = side;
    parts.sideboardDoor = cabDoor;
    var doorRig = rig(cabDoor);
    var doorSt = { open: 0, target: 0, moved: true, hit: null };

    var pBase = S.addMesh(), pPlat = S.addMesh(), pArm = S.addMesh();
    var playBits = buildPlayer(pBase, pPlat, pArm);
    parts.recordBase = pBase;
    parts.recordPlatter = pPlat;
    parts.recordArm = pArm;
    var ledFace = pBase.faces[playBits.led];
    var platRig = rig(pPlat), armRig = rig(pArm);
    var recSt = { on: false, angle: 0, speed: 0, armT: 0, creep: 0, t: 0, phi: PLAY.rest };

    var chairBase = S.addMesh(), chairTop = S.addMesh();
    var wheels = buildChair(chairBase, chairTop);
    parts.chairBase = chairBase;
    parts.chairTop = chairTop;
    var baseRig = rig(chairBase), topRig = rig(chairTop);
    var chairSt = {
      x: CHAIR.x, z: CHAIR.z, tx: CHAIR.x, tz: CHAIR.z, yaw: CHAIR.yaw,
      swivel: 0, lean: 0, leanGoal: 0, leanAx: [1, 0], wheel: 0,
      dragging: false, settleT: 9, t: 0
    };
    var chairHit = { min: [0, 0, 0], max: [0, 0, 0] };

    /* ---------------------------------------------------- interactives */

    /* two throw pillows: click to puff one */
    for (i = 0; i < 2; i++) {
      (function (idx) {
        var P0 = PILLOWS[idx], st = pillSt[idx], rg = pillowRigs[idx], mesh = pillows[idx];
        interactives.push(reg({
          id: P0.id, label: P0.label, hint: '点击拍一下',
          mesh: mesh, group: 'lounge', priority: 2,
          hit: boundsOf(mesh, 0.014),
          onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
          onClick: function (ctx) {
            st.t = 0;
            st.on = true;
            st.baseRot += (idx ? -0.15 : 0.13);
            ctx.audio.play('whoosh', { soft: true });
          },
          update: function (dt, ctx) {
            if (st.on) {
              st.t += dt;
              if (st.t > 0.62) st.on = false;
            }
            var s = st.on ? damped(st.t, 0.62, 2.4, 1.5708) : 0;
            st.rot = approach(st.rot, st.baseRot, 5.5, dt);
            var sq = 0.26 * s;
            var cy = P0.y;
            rg.pose(function (x, y, z) {
              var dx = x - P0.x, dz = z - P0.z;
              var c = Math.cos(st.rot), sn = Math.sin(st.rot);
              var nx = dx * c + dz * sn, nz = -dx * sn + dz * c;
              return [P0.x + nx * (1 + sq * 0.5), cy + (y - cy) * (1 - sq), P0.z + nz * (1 + sq * 0.5)];
            });
          }
        }));
      })(i);
    }

    /* the magazine stack: click flips the top issue */
    var magHit = { min: [-0.45, TABLE.topY - 0.01, 0.82], max: [-0.15, TABLE.topY + 0.075, 1.18] };
    interactives.push(reg({
      id: 'magazines', label: '杂志 Magazines', hint: '点击翻一本',
      mesh: magTop, group: 'lounge', priority: 3,
      hit: magHit,
      onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
      onClick: function (ctx) {
        var yaws = [0.13, -0.24, 0.32, -0.05];
        magSt.n++;
        magSt.tYaw = yaws[magSt.n % yaws.length];
        magSt.tSlide = (magSt.n % 2) ? 0.02 : -0.02;
        ctx.audio.play('page');
      },
      update: function (dt, ctx) {
        magSt.yaw = approach(magSt.yaw, magSt.tYaw, 7.5, dt);
        magSt.slide = approach(magSt.slide, magSt.tSlide, 7.5, dt);
        magTopRig.pose(function (x, y, z) {
          var c = Math.cos(magSt.yaw), s = Math.sin(magSt.yaw);
          return [
            magHome.x + x * c + z * s + magSt.slide,
            y + magHome.y,
            magHome.z - x * s + z * c + magSt.slide * 0.6
          ];
        });
      }
    }));

    /* the rug: click sends a ripple down its length */
    interactives.push(reg({
      id: 'rug', label: '地毯 Rug', hint: '点击掀起一道波纹',
      mesh: rugM, group: 'lounge', priority: 0,
      hit: { min: [RUG.x0 - 0.05, 0.0, RUG.z0 - 0.03], max: [RUG.x1 + 0.05, 0.05, RUG.z1 + 0.03] },
      onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
      onClick: function (ctx) {
        rugSt.t = 0;
        rugSt.active = true;
        ctx.audio.play('whoosh', { soft: true });
      },
      update: function (dt, ctx) {
        if (rugSt.active) {
          rugSt.t += dt;
          if (rugSt.t >= 1.15) {
            rugSt.active = false;
            rugSt.t = 99;
            rugRig.pose(function (x, y, z) { return [x, y, z]; });
            rugSt.flat = true;
          } else {
            var t = rugSt.t;
            rugRig.pose(function (x, y, z) { return [x, y + rugLift(x, z, t), z]; });
            rugSt.flat = false;
          }
        }
      }
    }));

    /* the left sideboard door: swings ~100° and shows the records */
    doorSt.hit = { min: [-1.04, 0.16, 0.92], max: [-0.99, 0.84, 1.13] };
    interactives.push(reg({
      id: 'cabinetDoor', label: '边柜门 Sideboard door', hint: '点击开关柜门',
      mesh: cabDoor, group: 'lounge', priority: 2, dynamicHit: true,
      hit: doorSt.hit,
      onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
      onClick: function (ctx) {
        doorSt.target = doorSt.target > 0.5 ? 0 : 1;
        ctx.audio.play('cabinet');
        ctx.toast(doorSt.target > 0.5 ? '柜门开了' : '柜门关上了');
      },
      update: function (dt, ctx) {
        var v = approach(doorSt.open, doorSt.target, 1.5, dt);
        if (Math.abs(v - doorSt.open) > 1e-5 || doorSt.moved) {
          doorSt.open = v;
          doorSt.moved = false;
          var a = -1.745 * v;
          doorRig.pose(function (x, y, z) {
            var dx = x + 1.01, dz = z - 1.115;
            var c = Math.cos(a), s = Math.sin(a);
            return [-1.01 + dx * c + dz * s, y, 1.115 - dx * s + dz * c];
          });
          var b = boundsOf(cabDoor, 0.012);
          doorSt.hit.min = b.min;
          doorSt.hit.max = b.max;
        }
      }
    }));

    /* the record player: play / stop */
    interactives.push(reg({
      id: 'record', label: '唱片机 Record player', hint: '点击播放 / 停止',
      mesh: pBase, group: 'lounge', priority: 2,
      hit: { min: [-1.60, 0.895, 0.70], max: [-1.03, 1.20, 1.14] },
      onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
      onClick: function (ctx) {
        recSt.on = !recSt.on;
        if (recSt.on) {
          ctx.audio.play('record');
          ctx.toast('唱片转起来了');
        } else {
          ctx.audio.play('recordStop');
          ctx.toast('唱片停了');
        }
      },
      update: function (dt, ctx) {
        recSt.t += dt;
        var target = recSt.on ? PLAY.rpm : 0;
        recSt.speed = approach(recSt.speed, target, recSt.on ? 1.15 : 2.3, dt);
        if (!recSt.on && recSt.speed < 0.004) recSt.speed = 0;
        recSt.angle += recSt.speed * Math.PI * 2 * dt;

        var dir = recSt.on ? 1 : -1;
        recSt.armT = M.clamp(recSt.armT + dir * dt / 1.1, 0, 1);
        if (recSt.on) recSt.creep = Math.min(0.17, recSt.creep + dt * 0.0016);
        else recSt.creep = approach(recSt.creep, 0, 0.9, dt);
        var e = easeInOut(recSt.armT);
        var phi = PLAY.rest + (PLAY.play - PLAY.rest) * e - recSt.creep * e;
        if (recSt.speed > 0.05) phi += 0.005 * osc(recSt.t, 3.1, 0);
        recSt.phi = phi;

        platRig.pose(platterSpin(recSt.angle));
        armRig.pose(armSwing(phi));

        ledFace.glow = recSt.on ? 1 : 0;
        ledFace.fill = recSt.on ? '@accent' : '@metalDark';

        parts.record = {
          spinning: recSt.on ? Math.min(1, recSt.speed / PLAY.rpm) : 0,
          speed: recSt.speed,
          pos: [PLAY.sx, 1.132, PLAY.sz],
          radius: 0.15
        };
      }
    }));

    /* the office chair: draggable, with an idle swivel */
    interactives.push(reg({
      id: 'chair', label: '办公椅 Office chair', hint: '按住拖动',
      mesh: chairTop, group: 'lounge', priority: 3, dynamicHit: true,
      hit: chairHit,
      onDown: function (ctx) { ctx.audio.play('click', { soft: true }); },
      onClick: function (ctx) { ctx.toast('按住椅子拖动，可以把它挪开'); },
      onDrag: function (ctx, info) {
        var st = chairSt;
        if (info.phase === 'start') {
          st.dragging = true;
          st.gx = info.startWorld[0];
          st.gz = info.startWorld[2];
          st.bx = st.x;
          st.bz = st.z;
          ctx.audio.play('whoosh', { soft: true });
          ctx.toast('椅子可以拖到别处');
        } else if (info.phase === 'move') {
          var c = clampChair(st.bx + (info.world[0] - st.gx), st.bz + (info.world[2] - st.gz));
          st.tx = c[0];
          st.tz = c[1];
        } else {
          st.dragging = false;
          st.settleT = 0;
          ctx.audio.play('click', { soft: true });
        }
      },
      update: function (dt, ctx) {
        var st = chairSt;
        st.t += dt;
        var ox = st.x, oz = st.z;
        var cc = clampChair(
          approach(st.x, st.tx, st.dragging ? 16 : 9, dt),
          approach(st.z, st.tz, st.dragging ? 16 : 9, dt)
        );
        st.x = cc[0];
        st.z = cc[1];
        var dx = st.x - ox, dz = st.z - oz;
        var dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1e-5) {
          var d = [dx / dist, dz / dist];
          st.leanAx = [d[1], -d[0]];
          st.leanGoal = Math.min(0.055, (dist / Math.max(dt, 1e-3)) * 0.011);
          if (st.dragging) {
            var fwd = -Math.sin(st.yaw) * dx - Math.cos(st.yaw) * dz;
            st.wheel += fwd / CHAIR.wheelR;
          }
        } else {
          st.leanGoal = 0;
        }
        var leanGoal = st.leanGoal;
        if (!st.dragging) {
          if (st.settleT < 1.2) {
            st.settleT += dt;
            leanGoal += 0.020 * Math.exp(-3.2 * st.settleT) * Math.sin(st.settleT * 13);
          }
        }
        st.lean = approach(st.lean, leanGoal, 10, dt);
        st.swivel = approach(st.swivel, st.dragging ? 0 : 0.026 * osc(st.t, 17, 0.7), 2.2, dt);

        baseRig.pose(chairBaseRig(st, wheels));
        topRig.pose(chairTopRig(st));

        var b1 = chairBase.getBounds(), b2 = chairTop.getBounds();
        // The box must not reach down to the floor: at a high three-quarter
        // camera the chair's footprint overlaps the desk area on screen, and a
        // floor-to-seat box there steals clicks aimed at the desk objects.
        // Clicking the seat and back is what "grab the chair" means anyway.
        var cy0 = Math.max(b2.min[1] - 0.10, 0.34);
        chairHit.min = [Math.min(b1.min[0], b2.min[0]) - 0.02, cy0, Math.min(b1.min[2], b2.min[2]) - 0.02];
        chairHit.max = [Math.max(b1.max[0], b2.max[0]) + 0.02, Math.max(b1.max[1], b2.max[1]) + 0.02,
          Math.max(b1.max[2], b2.max[2]) + 0.02];
      }
    }));

    /* --------------------------------------------- settle the rest poses */
    var warm = idleCtx();
    for (i = 0; i < interactives.length; i++) {
      if (interactives[i] && interactives[i].update) interactives[i].update(0, warm);
    }
    parts.record = { spinning: 0, speed: 0, pos: [PLAY.sx, 1.132, PLAY.sz], radius: 0.15 };

    sctx.lounge = {
      sofa: SOFA, table: TABLE, rug: RUG, side: SIDE, player: PLAY, chair: CHAIR,
      clampChair: clampChair, chairState: chairSt, recordState: recSt, doorState: doorSt
    };
    return { meshes: S.meshes.length, interactives: interactives.length };
  }

  P.loungeBuild = build;
})(typeof window !== 'undefined' ? window : globalThis);
