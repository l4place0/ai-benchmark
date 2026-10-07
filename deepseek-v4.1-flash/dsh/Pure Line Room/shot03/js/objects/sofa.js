/* =========================================================================
   Pure Line Room — objects/sofa.js
   A three-seat sofa standing against the right wall and facing into the room
   (-X): six tapered wooden legs, an upholstered plinth, a seat deck carrying
   two loose seat cushions, a back frame with two loose back cushions, and two
   rolled arms whose end caps carry a spiral. Every cushion edge is piped, and
   two throw pillows sit on the seat.
   Clicking a pillow fluffs it (squash, elastic spring back, a slight turn);
   clicking a seat cushion sinks it with a damped recovery.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var M = PLR.math;
  var outElastic = M.ease.outElastic;

  /* --------------------------- solid authoring ----------------------------
     g.box() emits its six faces with scrambled vertex orders (its left/right
     faces are non-planar bowties, its front/top faces wind inward) and
     g.lathe() winds its walls and caps inward, so every face here is oriented
     from an explicit outward reference: the renderer's facing test only looks
     at cross(v1-v0, v2-v0), so that reference is all that matters. */
  function faceOut(g, pts, out, mat, opts) {
    var a = pts[0], b = pts[1], c = pts[2];
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    var list = (nx * out[0] + ny * out[1] + nz * out[2]) >= 0 ? pts : pts.slice().reverse();
    var ids = [], i;
    for (i = 0; i < list.length; i++) ids.push(g.v(list[i][0], list[i][1], list[i][2]));
    g.face(ids, mat || 'white', opts || null);
    return ids;
  }

  /* one face of a solid, wound away from that solid's centre */
  function faceAway(g, quad, cen, mat, opts) {
    var c = [0, 0, 0], i;
    for (i = 0; i < quad.length; i++) {
      c[0] += quad[i][0]; c[1] += quad[i][1]; c[2] += quad[i][2];
    }
    c[0] /= quad.length; c[1] /= quad.length; c[2] /= quad.length;
    return faceOut(g, quad, [c[0] - cen[0], c[1] - cen[1], c[2] - cen[2]], mat, opts);
  }

  /* Skins a stack of equal-length rings and caps both ends. */
  function tube(g, rings, cen, mat, opts) {
    var i, j, n = rings[0].length;
    for (i = 0; i + 1 < rings.length; i++) {
      for (j = 0; j < n; j++) {
        var k = (j + 1) % n;
        faceAway(g, [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]], cen, mat, opts);
      }
    }
    faceAway(g, rings[0], cen, mat, opts);
    faceAway(g, rings[rings.length - 1], cen, mat, opts);
  }

  /* ------------------------------- the lines ------------------------------
     renderer.js never strokes node.mesh.edges in this build (g.edge, g.ring
     and g.polyline are dead), so every detail line here is a thin face whose
     material has fillOpacity 0 — 'fine', 'hair' or 'sil'. Strokes are painted
     after every fill, so a ribbon stays crisp over the surface it marks, and
     it is culled together with that surface when its normal turns away. */
  function strip(g, a, b, nrm, w, mat, lift) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var nl = Math.sqrt(nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2]) || 1;
    var nx = nrm[0] / nl, ny = nrm[1] / nl, nz = nrm[2] / nl;
    var ux = dy * nz - dz * ny, uy = dz * nx - dx * nz, uz = dx * ny - dy * nx;
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    if (ul < 1e-6) return;
    var h = (w === undefined ? 0.4 : w) / 2 / ul, off = (lift === undefined ? 0.22 : lift);
    ux *= h; uy *= h; uz *= h;
    var ox = nx * off, oy = ny * off, oz = nz * off;
    faceOut(g, [
      [a[0] - ux + ox, a[1] - uy + oy, a[2] - uz + oz],
      [b[0] - ux + ox, b[1] - uy + oy, b[2] - uz + oz],
      [b[0] + ux + ox, b[1] + uy + oy, b[2] + uz + oz],
      [a[0] + ux + ox, a[1] + uy + oy, a[2] + uz + oz],
    ], nrm, mat, null);
  }

  function ribbon(g, pts, closed, nrm, w, mat, lift) {
    var i, n = pts.length;
    for (i = 0; i + 1 < n; i++) strip(g, pts[i], pts[i + 1], nrm, w, mat, lift);
    if (closed && n > 2) strip(g, pts[n - 1], pts[0], nrm, w, mat, lift);
  }

  /* ------------------------------ placement ------------------------------
     The sofa backs onto the right wall. L.sofa.x (344) lies beyond L.x1 in
     this shot's layout, so the wall is authoritative: the back plane is the
     wall and L.sofa.len runs along Z at L.sofa.h overall height. Front to
     back the carcase is a real sofa's 92cm, and the seat is slid back along Z
     until it clears the coffee table — that position is pinned by the record
     player standing on it (L.recordPlayer). */
  var DEPTH = 92;
  var BX = L.x1 - 1;                       // outside face of the carcase
  var FX = BX - DEPTH;                     // front edge of the seat
  var LEN = L.sofa.len;
  var SZ = Math.min(L.sofa.cz, L.coffeeTable.z - L.coffeeTable.d / 2 - 8 - LEN / 2);
  var Z0 = SZ - LEN / 2, Z1 = SZ + LEN / 2;
  var H = L.sofa.h;
  var LEG = 14, LEGTOP = 2.3, LEGBOT = 2.8;
  var SEAT = L.sofaSeat;                   // top of the seat platform
  var ARMZ = 24;                           // arm thickness along Z
  var ARMT = 52;                           // arm panel height (the roll sits on it)
  var ROLL = 12;                           // rolled arm radius
  var BXI = BX - 20;                       // front face of the back frame
  var FXI = FX + 4;                        // front face of the plinth
  var ZI0 = Z0 + 3, ZI1 = Z1 - 3;
  var SEAT0 = Z0 + ARMZ + 1, SEAT1 = Z1 - ARMZ - 1;
  var CHALF = (SEAT1 - SEAT0) / 4;         // half length of one seat cushion
  var CZA = SEAT0 + CHALF + 1.5;           // centre of the far cushion
  var CZB = SEAT1 - CHALF - 1.5;           // centre of the near cushion
  var SX0 = FX + 2, SX1 = BXI - 22;        // seat cushions front/back
  var CX = (SX0 + SX1) / 2, CHX = (SX1 - SX0) / 2;

  function rect(x0, z0, x1, z1, y) {
    return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  }

  /* --------------------------- legs, plinth, back ------------------------ */
  function buildCarcase(g, tag) {
    var o = { hit: tag }, i, k;
    var legZ = [Z0 + 17, SZ, Z1 - 17];
    var legX = [FX + 14, BX - 14];
    for (i = 0; i < legZ.length; i++) {
      for (k = 0; k < legX.length; k++) {
        var lx = legX[k], lz = legZ[i];
        tube(g, [
          rect(lx - LEGBOT, lz - LEGBOT, lx + LEGBOT, lz + LEGBOT, 0),
          rect(lx - LEGTOP, lz - LEGTOP, lx + LEGTOP, lz + LEGTOP, LEG),
        ], [lx, LEG / 2, lz], 'wood', o);
      }
    }

    /* the plinth, with a proud rail so its top and bottom read as seams */
    tube(g, [
      rect(FXI, ZI0, BX - 3, ZI1, LEG),
      rect(FXI - 1.1, ZI0 - 1.1, BX - 1.9, ZI1 + 1.1, 26),
      rect(FXI, ZI0, BX - 3, ZI1, SEAT),
    ], [BX / 2, (LEG + SEAT) / 2, SZ], 'fabric2', o);

    /* the back frame, softened along its top edge */
    tube(g, [
      rect(BXI, ZI0 + 2, BX - 2, ZI1 - 2, SEAT),
      rect(BXI, ZI0 + 2, BX - 3, ZI1 - 2, H - 8),
      rect(BXI + 3, ZI0 + 4, BX - 4, ZI1 - 4, H),
    ], [BX - 9, H - 20, SZ], 'fabric', o);

    /* the two rolled arms, swept from the front of the sofa to the back */
    for (var s = 0; s < 2; s++) {
      var zc = (s === 0) ? Z0 + ARMZ / 2 : Z1 - ARMZ / 2;
      var ring = [[FX, LEG, zc - ROLL], [FX, LEG, zc + ROLL]];
      for (i = 0; i <= 12; i++) {
        var a = Math.PI * (i / 12);
        ring.push([FX, ARMT + Math.sin(a) * ROLL, zc + Math.cos(a) * ROLL]);
      }
      tube(g, [ring, ring.map(function (p) { return [BXI, p[1], p[2]]; })],
        [FX + 36, 46, zc], 'fabric', o);

      /* the roll's end cap: two concentric creases and a spiralling seam */
      var cx0 = FX - 0.3;
      for (var r = 0; r < 2; r++) {
        var rad = r === 0 ? 8.4 : 4.6, arc = [];
        for (i = 0; i <= 12; i++) {
          var th = Math.PI * (i / 12);
          arc.push([cx0, ARMT + Math.sin(th) * rad, zc + Math.cos(th) * rad]);
        }
        ribbon(g, arc, false, [-1, 0, 0], 0.45, 'fine', 0.35);
      }
      var spiral = [];
      for (i = 0; i <= 26; i++) {
        var u = i / 26, sa = u * Math.PI * 2.4, sr = 1.1 + u * 8.1;
        spiral.push([cx0, ARMT + Math.sin(sa) * sr * 0.96, zc + Math.cos(sa) * sr]);
      }
      ribbon(g, spiral, false, [-1, 0, 0], 0.4, 'hair', 0.35);

      /* the seam where the arm panel meets the plinth */
      strip(g, [cx0, LEG + 1, zc + ROLL + 0.6], [cx0, ARMT - 2, zc + ROLL + 0.6], [-1, 0, 0], 0.45, 'fine', 0.3);
      strip(g, [cx0, LEG + 1, zc - ROLL - 0.6], [cx0, ARMT - 2, zc - ROLL - 0.6], [-1, 0, 0], 0.45, 'fine', 0.3);
    }
  }

  /* ------------------------------ seat cushion ----------------------------
     Local frame: the origin is the cushion's bottom centre, so a y scale
     compresses it downwards. The welt ring near the top is the piping: its
     two boundaries draw the doubled seam line. */
  function buildSeatCushion(g, hx, hz, tag) {
    var o = { hit: tag };
    tube(g, [
      [[-hx + 1.5, 0, -hz + 1.5], [hx - 1.5, 0, -hz + 1.5], [hx - 1.5, 0, hz - 1.5], [-hx + 1.5, 0, hz - 1.5]],
      [[-hx, 3.4, -hz], [hx, 3.4, -hz], [hx, 3.4, hz], [-hx, 3.4, hz]],
      [[-hx, 10.2, -hz], [hx, 10.2, -hz], [hx, 10.2, hz], [-hx, 10.2, hz]],
      [[-hx - 0.8, 11.2, -hz - 0.8], [hx + 0.8, 11.2, -hz - 0.8], [hx + 0.8, 11.2, hz + 0.8], [-hx - 0.8, 11.2, hz + 0.8]],
      [[-hx + 1.7, 12.1, -hz + 1.7], [hx - 1.7, 12.1, -hz + 1.7], [hx - 1.7, 12.1, hz - 1.7], [-hx + 1.7, 12.1, hz - 1.7]],
    ], [0, 6, 0], 'fabric', o);
    /* plumped up by hand: a soft centre line and the piping boundary */
    strip(g, [0, 12.25, -hz + 3.6], [0, 12.25, hz - 3.6], [0, 1, 0], 0.4, 'hair', 0.22);
    strip(g, [-hx + 1.7, 12.25, 0], [hx - 1.7, 12.25, 0], [0, 1, 0], 0.4, 'hair', 0.22);
  }

  /* ------------------------------ back cushion ---------------------------- */
  function buildBackCushion(g, hx, hz, tag) {
    var o = { hit: tag }, lean = 3.2;
    tube(g, [
      [[-hx + 1.2, 0, -hz + 1.2], [hx - 1.2, 0, -hz + 1.2], [hx - 1.2, 0, hz - 1.2], [-hx + 1.2, 0, hz - 1.2]],
      [[-hx, 5, -hz], [hx, 5, -hz], [hx, 5, hz], [-hx, 5, hz]],
      [[-hx + lean, 27, -hz], [hx + lean, 27, -hz], [hx + lean, 27, hz], [-hx + lean, 27, hz]],
      [[-hx + lean + 1.5, 32.5, -hz + 1.5], [hx + lean - 1.5, 32.5, -hz + 1.5],
        [hx + lean - 1.5, 32.5, hz - 1.5], [-hx + lean + 1.5, 32.5, hz - 1.5]],
    ], [lean / 2, 16, 0], 'fabric2', o);
    /* piped seams up the two sides of the face that looks into the room */
    strip(g, [-hx - 0.45, 4, -hz + 2], [-hx + lean - 0.45, 29, -hz + 2], [-1, 0, 0], 0.45, 'fine', 0.3);
    strip(g, [-hx - 0.45, 4, hz - 2], [-hx + lean - 0.45, 29, hz - 2], [-1, 0, 0], 0.45, 'fine', 0.3);
  }

  /* -------------------------------- pillow --------------------------------
     Local frame: thickness along x, height along y, width along z. The puff is
     a stack of shrinking rings, so the widest ring reads as the piped seam. */
  function buildPillow(g, tag) {
    var o = { hit: tag };
    function ring(x, hy, hz) {
      return [[x, -hy, -hz], [x, -hy, hz], [x, hy, hz], [x, hy, -hz]];
    }
    var r0 = ring(-5.4, 13.5, 13.5), r4 = ring(5.4, 13.5, 13.5);
    tube(g, [r0, ring(-3.6, 17, 17), ring(0, 19, 19), ring(3.6, 17, 17), r4], [0, 0, 0], 'accent', o);
    ribbon(g, r0, true, [-1, 0, 0], 0.4, 'fine', 0.3);
    ribbon(g, r4, true, [1, 0, 0], 0.4, 'fine', 0.3);
    strip(g, [-5.8, 0, -12], [-5.8, 0, 12], [-1, 0, 0], 0.4, 'hair', 0.28);
    strip(g, [-5.8, -12, 0], [-5.8, 12, 0], [-1, 0, 0], 0.4, 'hair', 0.28);
  }

  /* --------------------------- transform plumbing -------------------------
     The renderer sorts solids by the distance from a node's origin to the eye,
     so a loose part is anchored at a point of its own body (its bottom centre)
     instead of at the pivot it turns about. place() composes the wanted
     scale/rotation about `piv` with the translation that keeps the geometry
     exactly where it belongs, so the animation is a pure transform change. */
  function place(node, anchor, piv, s, yaw, pitch, roll, off) {
    var m = M.transformMatrix({ p: [0, 0, 0], yaw: yaw, pitch: pitch, roll: roll, s: s });
    var d = M.m4.point(m, [piv[0] - anchor[0], piv[1] - anchor[1], piv[2] - anchor[2]]);
    node.setTransform({
      p: [piv[0] + off[0] - d[0], piv[1] + off[1] - d[1], piv[2] + off[2] - d[2]],
      yaw: yaw, pitch: pitch, roll: roll, s: s,
    });
    node.touch();
  }

  /* ------------------------------- assembly ------------------------------- */
  PLR.objects.sofa = {
    id: 'sofa',
    build: function (app) {
      var scene = app.scene;
      var root = scene.group(scene.root, { name: 'sofa' });   // container only

      /* ------------------------------- carcase ---------------------------- */
      var frame = scene.group(root, { name: 'sofaFrame' });
      buildCarcase(frame._g, 'main');
      var frameDip = 0;
      var framePr = PLR.interact.make(scene, frame, {
        id: 'sofa',
        label: '沙发',
        hit: 'main',
        hintDims: [DEPTH, H, LEN],
        enter: function (pr) { pr.setStatus('布艺 · 实木脚'); },
        press: function (pr, down) { if (down) PLR.audio.resume(); },
        onClick: function (pr) {
          frameDip = 1;
          pr.setStatus('轻轻一按');
          PLR.audio.woodTap(120);
        },
      });
      frame.behavior = {
        update: function (dt) {
          if (frameDip > 0.001) {
            frameDip = M.ease.damp(frameDip, 0, 3.4, dt);
            frame.setTransform({ p: [0, -0.2 * frameDip, 0] });
            frame.touch();
          }
        },
        post: function () { framePr.hitRegion(app.renderer); },
      };

      /* --------------------------- loose seat cushions -------------------- */
      [{ name: 'seatA', z: CZA }, { name: 'seatB', z: CZB }].forEach(function (s) {
        var anchor = [CX, SEAT, s.z];
        var node = scene.group(root, { name: s.name, p: anchor });
        buildSeatCushion(node._g, CHX, CHALF, s.name);
        var comp = 0, vel = 0, live = false;
        var pr = PLR.interact.make(scene, node, {
          id: s.name === 'seatA' ? 'cushionA' : 'cushionB',
          label: '坐垫',
          hit: s.name,
          hintDims: [CHX * 2, 13, CHALF * 2],
          enter: function (p) { if (!live) p.setStatus('饱满'); },
          press: function (p, down) { if (down) PLR.audio.resume(); },
          onClick: function (p) {
            vel -= 2.4;
            live = true;
            p.setStatus('下沉 · 回弹');
            PLR.audio.click();
          },
        });
        node.behavior = {
          update: function (dt) {
            /* a damped spring under the seat: it sinks, then breathes back */
            vel += (-58 * comp - 6.4 * vel) * dt;
            comp += vel * dt;
            if (comp < -0.25) { comp = -0.25; vel = 0; }
            if (comp > 2.4) { comp = 2.4; vel = 0; }
            place(node, anchor, anchor, [1 + 0.05 * comp, 1 - 0.075 * comp, 1 + 0.05 * comp], 0, 0, 0, [0, 0, 0]);
            if (live && Math.abs(comp) < 0.02 && Math.abs(vel) < 0.06) { live = false; pr.setStatus('饱满'); }
          },
          post: function () { pr.hitRegion(app.renderer); },
        };
      });

      /* --------------------------- loose back cushions -------------------- */
      [{ name: 'backA', z: CZA }, { name: 'backB', z: CZB }].forEach(function (s) {
        var anchor = [BXI - 10, SEAT, s.z];
        var node = scene.group(root, { name: s.name, p: anchor });
        buildBackCushion(node._g, 9, CHALF, s.name);
        var comp = 0, vel = 0;
        var pr = PLR.interact.make(scene, node, {
          id: s.name,
          label: '靠垫',
          hit: s.name,
          hintDims: [18, 33, CHALF * 2],
          enter: function (p) { p.setStatus('靠着正好'); },
          press: function (p, down) { if (down) PLR.audio.resume(); },
          onClick: function (p) {
            vel -= 1.5;
            p.setStatus('拍松');
            PLR.audio.click();
          },
        });
        node.behavior = {
          update: function (dt) {
            vel += (-70 * comp - 7.2 * vel) * dt;
            comp += vel * dt;
            if (comp > 1.5) { comp = 1.5; vel = 0; }
            if (comp < -0.3) { comp = -0.3; vel = 0; }
            place(node, anchor, anchor, [1, 1 - 0.06 * comp, 1], 0, 0, 0, [0, 0, 0]);
          },
          post: function () { pr.hitRegion(app.renderer); },
        };
      });

      /* ------------------------------ throw pillows ----------------------- */
      [
        { name: 'pillowA', at: [FX + 37, SEAT + 13, CZA + 21], yaw: 0.22, pitch: -0.10, roll: -0.14 },
        { name: 'pillowB', at: [FX + 39, SEAT + 13, CZB + 18], yaw: -0.26, pitch: 0.24, roll: -0.10 },
      ].forEach(function (s) {
        var anchor = s.at;
        var piv = [anchor[0], anchor[1] + 18, anchor[2]];
        var node = scene.group(root, { name: s.name, p: anchor });
        buildPillow(node._g, s.name);
        var t = 1, run = false;
        var pr = PLR.interact.make(scene, node, {
          id: s.name,
          label: '抱枕',
          hit: s.name,
          hintDims: [12, 38, 38],
          enter: function (p) { if (!run) p.setStatus('松软'); },
          press: function (p, down) { if (down) PLR.audio.resume(); },
          onClick: function (p) {
            t = 0; run = true;
            p.setStatus('拍松中');
            PLR.audio.woodTap(140);
          },
        });
        node.behavior = {
          update: function (dt) {
            if (run) {
              t += dt / 0.95;
              if (t >= 1) { t = 1; run = false; pr.setStatus('蓬松饱满'); }
            }
            var k = run ? outElastic(t) : 1;
            var d = k - 1;                         // 0 at rest, -1 when squashed flat
            place(node, anchor, piv,
              [1 - 0.34 * d, 1 + 0.17 * d, 1 + 0.17 * d],
              s.yaw + 0.10 * d, s.pitch + 0.05 * d, s.roll - 0.22 * d,
              [0, 2.2 * d, 0]);
          },
          post: function () { pr.hitRegion(app.renderer); },
        };
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
