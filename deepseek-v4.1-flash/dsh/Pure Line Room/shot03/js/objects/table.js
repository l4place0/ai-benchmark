/* =========================================================================
   Pure Line Room — objects/table.js
   A low coffee table: a chamfered slab top with an end-grain band, an apron
   set back under a shadow gap, four square tapered legs with a slight splay,
   and a stretcher shelf carrying two stacked magazines and a folded
   newspaper. A coaster sits on the top surface, which is otherwise left clear
   for the record player (the plinth of L.recordPlayer is centred on the top).
   Clicking the top taps out a wood note and the whole table gives a small
   damped bounce.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var M = PLR.math;

  /* --------------------------- solid authoring ---------------------------- */
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

  function faceAway(g, quad, cen, mat, opts) {
    var c = [0, 0, 0], i;
    for (i = 0; i < quad.length; i++) {
      c[0] += quad[i][0]; c[1] += quad[i][1]; c[2] += quad[i][2];
    }
    c[0] /= quad.length; c[1] /= quad.length; c[2] /= quad.length;
    return faceOut(g, quad, [c[0] - cen[0], c[1] - cen[1], c[2] - cen[2]], mat, opts);
  }

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

  /* extrude a ring along one axis */
  function slab2(g, prof, ax, a0, a1, cen, mat, opts) {
    var lo = prof.map(function (p) { var q = p.slice(); q[ax] = a0; return q; });
    var hi = prof.map(function (p) { var q = p.slice(); q[ax] = a1; return q; });
    tube(g, [lo, hi], cen, mat, opts);
  }

  /* a stroked line, as a thin fill-less face */
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

  function rect(x0, z0, x1, z1, y) {
    return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  }

  /* -------------------------------- layout -------------------------------- */
  var CT = L.coffeeTable;
  var TOP = CT.h;                                     // 40
  var CX = Math.min(CT.x, L.x1 - CT.w / 2 - 4);       // clear of the right wall
  var CZ = CT.z;
  var X0 = CX - CT.w / 2, X1 = CX + CT.w / 2;         // the slab
  var Z0 = CZ - CT.d / 2, Z1 = CZ + CT.d / 2;
  var THICK = 4.4;                                    // slab thickness
  var LEGTOP = 3.2, LEGBOT = 2.6;                     // leg half sections
  var LEGH = TOP - 10.5;                              // legs meet the apron
  var SPLAY = 1.5;
  var APX0 = X0 + 2.4, APX1 = X1 - 2.4, APZ0 = Z0 + 2.4, APZ1 = Z1 - 2.4;
  var APT = TOP - THICK - 0.7;                        // apron top (shadow gap)
  var APB = APT - 6.4;
  var SHY = 13;                                       // shelf underside height
  var SX0 = X0 + 11, SX1 = X1 - 11, SZ0 = Z0 + 11, SZ1 = Z1 - 11;

  /* --------------------------------- drawing ------------------------------ */
  function draw(g, tag) {
    var o = { hit: tag }, i;
    var yb = TOP - THICK;

    /* the slab: chamfered along its top edge, with an end-grain band */
    tube(g, [
      rect(X0 + 0.5, Z0 + 0.5, X1 - 0.5, Z1 - 0.5, yb),
      rect(X0, Z0, X1, Z1, TOP - 0.9),
      rect(X0 + 1.4, Z0 + 1.4, X1 - 1.4, Z1 - 1.4, TOP),
    ], [CX, TOP - THICK / 2, CZ], 'wood', o);
    /* end grain: the sawn ends of the boards show along the front edge */
    for (i = 0; i <= 22; i++) {
      var gx = X0 + 3 + ((X1 - X0 - 6) * i) / 22;
      strip(g, [X0 + 0.15, yb + 0.7, gx], [X0 + 0.15, TOP - 1.3, gx + 0.8], [-1, 0, 0], 0.4, 'hair', 0.2);
    }
    strip(g, [X0 + 0.2, yb + 0.5, Z0 + 2], [X0 + 0.2, yb + 0.5, Z1 - 2], [-1, 0, 0], 0.45, 'fine', 0.22);
    strip(g, [X0 + 0.2, TOP - 1.5, Z0 + 2], [X0 + 0.2, TOP - 1.5, Z1 - 2], [-1, 0, 0], 0.4, 'hair', 0.22);

    /* apron, set back under the slab so a shadow gap reads between them */
    for (i = 0; i < 2; i++) {
      var zz = i ? Z1 - 2.4 : Z0 + 2.4;
      var px = i ? X1 - 2.4 : X0 + 2.4, dir = i ? -1 : 1;
      /* the two rails that run along X */
      slab2(g, [[0, APT, zz - 1.6], [0, APT, zz + 1.6], [0, APB, zz + 1.6], [0, APB, zz - 1.6]],
        0, X0 + 2.4, X1 - 2.4, [CX, (APT + APB) / 2, zz], 'woodDark', o);
      /* the two rails that run along Z */
      slab2(g, [[px, APT, Z0 + 3.8], [px, APT, Z1 - 3.8], [px, APB, Z1 - 3.8], [px, APB, Z0 + 3.8]],
        0, px, px + dir * 3.2, [px + dir * 1.6, (APT + APB) / 2, CZ], 'woodDark', o);
      /* the reveal under each rail */
      strip(g, [X0 + 4, APB + 0.7, zz + (i ? 0.25 : -0.25)], [X1 - 4, APB + 0.7, zz + (i ? 0.25 : -0.25)],
        [0, 0, i ? 1 : -1], 0.42, 'hair', 0.22);
      strip(g, [px + dir * 1.6, APB + 0.7, Z0 + 4], [px + dir * 1.6, APB + 0.7, Z1 - 4],
        [dir, 0, 0], 0.42, 'hair', 0.22);
    }

    /* four square tapered legs, splayed slightly outwards */
    var lx = [X0 + 10, X1 - 10], lz = [Z0 + 10, Z1 - 10];
    for (i = 0; i < 2; i++) {
      for (var k = 0; k < 2; k++) {
        var ux = lx[i], uz = lz[k], sxi = i ? 1 : -1, szi = k ? 1 : -1;
        tube(g, [
          rect(ux - LEGBOT + sxi * SPLAY, uz - LEGBOT + szi * SPLAY,
            ux + LEGBOT + sxi * SPLAY, uz + LEGBOT + szi * SPLAY, 0),
          rect(ux - LEGTOP, uz - LEGTOP, ux + LEGTOP, uz + LEGTOP, LEGH),
        ], [ux, LEGH / 2, uz], 'wood', o);
      }
    }

    /* stretcher shelf */
    tube(g, [
      rect(SX0, SZ0, SX1, SZ1, SHY - 2.6),
      rect(SX0 + 0.8, SZ0 + 0.8, SX1 - 0.8, SZ1 - 0.8, SHY),
    ], [CX, SHY - 1.3, CZ], 'woodDark', o);
    strip(g, [SX0 + 1.2, SHY + 0.1, SZ0 + 1.2], [SX0 + 1.2, SHY + 0.1, SZ1 - 1.2], [0, 1, 0], 0.42, 'hair', 0.22);
    strip(g, [SX1 - 1.2, SHY + 0.1, SZ0 + 1.2], [SX1 - 1.2, SHY + 0.1, SZ1 - 1.2], [0, 1, 0], 0.42, 'hair', 0.22);

    /* two stacked magazines, each with a cover and a visible page edge */
    for (i = 0; i < 2; i++) {
      var my = SHY + 0.15 + i * 1.35, mcx = CX - 6 + (i ? 3.4 : -1.2), mcz = CZ + (i ? 3.2 : -2.4);
      var mw = 23 - i * 1.6, md = 31 - i * 2.2, rot = i ? 0.22 : -0.14;
      var c = Math.cos(rot), s = Math.sin(rot);
      function mp(px, pz, py) {
        return [mcx + px * c - pz * s, my + py, mcz + px * s + pz * c];
      }
      tube(g, [
        [mp(-mw / 2, -md / 2, 0), mp(mw / 2, -md / 2, 0), mp(mw / 2, md / 2, 0), mp(-mw / 2, md / 2, 0)],
        [mp(-mw / 2 + 0.3, -md / 2 + 0.3, 1.3), mp(mw / 2 - 0.3, -md / 2 + 0.3, 1.3),
          mp(mw / 2 - 0.3, md / 2 - 0.3, 1.3), mp(-mw / 2 + 0.3, md / 2 - 0.3, 1.3)],
      ], [mcx, my + 0.6, mcz], i ? 'whiteSoft' : 'accent', o);
      /* page edges along both long sides */
      for (var p = 0; p <= 6; p++) {
        var pu = -mw / 2 + 1.4 + ((mw - 2.8) * p) / 6;
        strip(g, mp(pu, -md / 2 + 0.1, 0.35), mp(pu, -md / 2 + 0.1, 1.0), [0, 0, -1], 0.4, 'hair', 0.2);
      }
      strip(g, mp(-mw / 2 + 0.9, -md / 2 + 0.35, 1.34), mp(mw / 2 - 0.9, -md / 2 + 0.35, 1.34),
        [0, 1, 0], 0.45, 'fine', 0.2);
    }

    /* a folded newspaper sharing the shelf */
    var ny = SHY + 0.2, ncx = CX + 27, ncz = CZ - 8, nrot = 0.34;
    var nc = Math.cos(nrot), ns = Math.sin(nrot);
    function np(px, pz, py) { return [ncx + px * nc - pz * ns, ny + py, ncz + px * ns + pz * nc]; }
    tube(g, [
      [np(-12, -8.5, 0), np(12, -8.5, 0), np(12, 8.5, 0), np(-12, 8.5, 0)],
      [np(-11.6, -8.1, 0.8), np(11.6, -8.1, 0.8), np(11.6, 8.1, 0.8), np(-11.6, 8.1, 0.8)],
    ], [ncx, ny + 0.4, ncz], 'paper', o);
    strip(g, np(0, -8.5, 0.85), np(0, 8.5, 0.85), [0, 1, 0], 0.42, 'fine', 0.2);
    for (i = 0; i < 5; i++) {
      var ly = -6 + i * 3;
      strip(g, np(-10.5, ly, 0.85), np(-1, ly, 0.85), [0, 1, 0], 0.38, 'hair', 0.2);
      strip(g, np(1, ly, 0.85), np(10.5, ly, 0.85), [0, 1, 0], 0.38, 'hair', 0.2);
    }

    /* a coaster on the top surface, well clear of the record player's plinth */
    var kx = X0 + 22, kz = CZ - 26, kr = 5;
    tube(g, [
      [[kx - kr, TOP + 0.02, kz], [kx + kr, TOP + 0.02, kz], [kx + kr, TOP + 0.02, kz + kr * 1.4], [kx - kr, TOP + 0.02, kz + kr * 1.4]],
      [[kx - kr + 0.6, TOP + 0.45, kz + 0.5], [kx + kr - 0.6, TOP + 0.45, kz + 0.5],
        [kx + kr - 0.6, TOP + 0.45, kz + kr * 1.4 - 0.5], [kx - kr + 0.6, TOP + 0.45, kz + kr * 1.4 - 0.5]],
    ], [kx, TOP + 0.2, kz + 3], 'woodDark', o);
    ribbon(g, [[kx - kr + 0.6, TOP + 0.5, kz + 0.5], [kx + kr - 0.6, TOP + 0.5, kz + 0.5],
      [kx + kr - 0.6, TOP + 0.5, kz + kr * 1.4 - 0.5], [kx - kr + 0.6, TOP + 0.5, kz + kr * 1.4 - 0.5]],
      true, [0, 1, 0], 0.4, 'fine', 0.22);
  }

  /* ------------------------------- assembly ------------------------------- */
  PLR.objects.table = {
    id: 'table',
    build: function (app) {
      var scene = app.scene;
      var node = scene.group(scene.root, { name: 'coffeeTable' });
      draw(node._g, 'main');

      var dy = 0, vel = 0, live = false;
      var pr = PLR.interact.make(scene, node, {
        id: 'table',
        label: '茶几',
        hit: 'main',
        hintDims: [CT.w, TOP, CT.d],
        enter: function (p) { if (!live) p.setStatus('实木 · 清漆'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          vel -= 5.4;
          live = true;
          p.setStatus('轻叩一声');
          PLR.audio.woodTap(240);
        },
      });

      node.behavior = {
        update: function (dt) {
          /* a fraction of a centimetre of bounce, damping out in half a second */
          vel += (-165 * dy - 12.5 * vel) * dt;
          dy += vel * dt;
          if (dy < -0.7) { dy = -0.7; vel = 0; }
          if (dy > 0.35) { dy = 0.35; vel = 0; }
          node.setTransform({ p: [0, dy, 0] });
          node.touch();
          if (live && Math.abs(dy) < 0.01 && Math.abs(vel) < 0.08) { live = false; pr.setStatus('实木 · 清漆'); }
        },
        post: function () { pr.hitRegion(app.renderer); },
      };
      node.touch();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
