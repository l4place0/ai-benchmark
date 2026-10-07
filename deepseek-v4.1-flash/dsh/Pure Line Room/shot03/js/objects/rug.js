/* =========================================================================
   Pure Line Room — objects/rug.js
   A flat woven kilim on the living-room floor: a field in two near-white
   tones with a border band, a repeating geometric motif, fringe at both ends
   and a ripple that travels slowly across the weave so it never looks pasted
   down. One corner is lifted; clicking it presses the corner flat, and it
   eases back up a moment later.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var M = PLR.math;
  var damp = M.ease.damp;

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

  /* a stroked line: this engine never strokes mesh edges, so a line is a thin
     face with a fill-less material, lifted a hair above its surface */
  function strip(g, a, b, nrm, w, mat, lift) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var nl = Math.sqrt(nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2]) || 1;
    var nx = nrm[0] / nl, ny = nrm[1] / nl, nz = nrm[2] / nl;
    var ux = dy * nz - dz * ny, uy = dz * nx - dx * nz, uz = dx * ny - dy * nx;
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    if (ul < 1e-6) return;
    var h = (w === undefined ? 0.4 : w) / 2 / ul, off = (lift === undefined ? 0.3 : lift);
    ux *= h; uy *= h; uz *= h;
    var ox = nx * off, oy = ny * off, oz = nz * off;
    faceOut(g, [
      [a[0] - ux + ox, a[1] - uy + oy, a[2] - uz + oz],
      [b[0] - ux + ox, b[1] - uy + oy, b[2] - uz + oz],
      [b[0] + ux + ox, b[1] + uy + oy, b[2] + uz + oz],
      [a[0] + ux + ox, a[1] + uy + oy, a[2] + uz + oz],
    ], nrm, mat, null);
  }

  function ribbon(g, pts, closed, w, mat, lift) {
    var i, n = pts.length;
    for (i = 0; i + 1 < n; i++) strip(g, pts[i], pts[i + 1], [0, 1, 0], w, mat, lift);
    if (closed && n > 2) strip(g, pts[n - 1], pts[0], [0, 1, 0], w, mat, lift);
  }

  /* -------------------------------- layout -------------------------------- */
  var RX0 = L.rug.x - L.rug.w / 2, RX1 = L.rug.x + L.rug.w / 2;
  var RZ0 = L.rug.z - L.rug.d / 2, RZ1 = L.rug.z + L.rug.d / 2;
  var RW = RX1 - RX0, RD = RZ1 - RZ0;
  var RY = 0.6;                            // clear of the floor
  var BX0 = RX0 + 16, BX1 = RX1 - 16;      // the woven field inside the border
  var BZ0 = RZ0 + 16, BZ1 = RZ1 - 16;
  var NX = 10, NZ = 8;                     // weave cells

  var phase = 0;
  var curl = 1, curlWant = 1, settle = 0;

  /* The woven surface: a very low travelling ripple, a livelier edge so the
     rug is not a pasted-down rectangle, and the corner that stands up. */
  function surf(x, z) {
    var u = (x - RX0) / RW, v = (z - RZ0) / RD;
    var edge = Math.pow(Math.max(0, 1 - Math.min(u, 1 - u) * 5), 2)
      + Math.pow(Math.max(0, 1 - Math.min(v, 1 - v) * 5), 2);
    var y = RY + 0.15 * Math.sin(x * 0.052 + phase) * Math.sin(z * 0.041 - phase * 0.7);
    y += 0.28 * Math.min(1, edge) * Math.sin(x * 0.09 + z * 0.07 + phase * 1.3);
    if (curl > 0.001) {
      var dx = (x - RX0) / 54, dz = (z - RZ1) / 64;
      y += 4.4 * curl * Math.exp(-(dx * dx + dz * dz));
    }
    return y;
  }

  function P(x, z, lift) { return [x, surf(x, z) + (lift || 0), z]; }

  /* --------------------------------- drawing ------------------------------ */
  function draw(g) {
    var i, j;

    /* the woven field, cell by cell, so the weave itself shows */
    for (i = 0; i < NX; i++) {
      for (j = 0; j < NZ; j++) {
        var x0 = RX0 + (RW * i) / NX, x1 = RX0 + (RW * (i + 1)) / NX;
        var z0 = RZ0 + (RD * j) / NZ, z1 = RZ0 + (RD * (j + 1)) / NZ;
        var mid = 0.5 * (i / NX + i / NX + 1 / NX);
        var inner = (x0 > BX0 - 0.1 && x1 < BX1 + 0.1 && z0 > BZ0 - 0.1 && z1 < BZ1 + 0.1);
        faceOut(g, [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)],
          [0, 1, 0], inner ? 'rug' : 'fabric2', { hit: 'main', name: 'rug' });
      }
    }

    /* border band: a doubled line inside the field and one around the edge */
    var band0 = [], band1 = [], edge = [];
    var step = 14, k;
    for (k = 0; k <= RW / step; k++) {
      var bx = RX0 + (RW * k * step) / RW * 1;
      bx = RX0 + Math.min(RW, k * step);
      band0.push(P(bx, RZ0 + 11, 0.3)); band1.push(P(bx, RZ0 + 16, 0.3));
      edge.push(P(bx, RZ0 + 1.6, 0.3));
    }
    for (k = 0; k <= RD / step; k++) {
      var bz = RZ0 + Math.min(RD, k * step);
      band0.push(P(RX0 + 11, bz, 0.3)); band1.push(P(RX0 + 16, bz, 0.3));
      edge.push(P(RX0 + 1.6, bz, 0.3));
    }
    for (k = RW / step; k >= 0; k--) {
      var bx2 = RX0 + Math.min(RW, k * step);
      band0.push(P(bx2, RZ1 - 11, 0.3)); band1.push(P(bx2, RZ1 - 16, 0.3));
      edge.push(P(bx2, RZ1 - 1.6, 0.3));
    }
    for (k = RD / step; k >= 0; k--) {
      var bz2 = RZ0 + Math.min(RD, k * step);
      band0.push(P(RX1 - 11, bz2, 0.3)); band1.push(P(RX1 - 16, bz2, 0.3));
      edge.push(P(RX1 - 1.6, bz2, 0.3));
    }
    ribbon(g, band0, true, 0.5, 'fine', 0.34);
    ribbon(g, band1, true, 0.4, 'hair', 0.34);
    ribbon(g, edge, true, 0.45, 'hair', 0.34);

    /* the kilim motif: rows of diamonds with a zigzag band between them */
    var cols = 6, rows = 3;
    var fw = (BX1 - BX0) / cols, fh = (BZ1 - BZ0) / rows;
    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        var cx = BX0 + fw * (i + 0.5), cz = BZ0 + fh * (j + 0.5);
        var dw = fw * 0.31, dh = fh * 0.33;
        ribbon(g, [P(cx, cz - dh, 0.34), P(cx + dw, cz, 0.34), P(cx, cz + dh, 0.34), P(cx - dw, cz, 0.34)],
          true, 0.5, 'fine', 0.32);
        ribbon(g, [P(cx, cz - dh * 0.45, 0.34), P(cx + dw * 0.45, cz, 0.34),
          P(cx, cz + dh * 0.45, 0.34), P(cx - dw * 0.45, cz, 0.34)], true, 0.4, 'hair', 0.32);
      }
    }
    for (j = 1; j < rows; j++) {
      var zz = BZ0 + fh * j, zig = [];
      for (k = 0; k <= 24; k++) {
        var zx = BX0 + ((BX1 - BX0) * k) / 24;
        zig.push(P(zx, zz + (k % 2 ? 3.2 : -3.2), 0.32));
      }
      ribbon(g, zig, false, 0.5, 'fine', 0.32);
    }

    /* fringe at both ends: many short strands, each with a little wander */
    var strands = 30;
    for (i = 0; i <= strands; i++) {
      var fx = RX0 + (RW * i) / strands;
      var wob = Math.sin(i * 1.7) * 1.5;
      strip(g, P(fx, RZ0 + 1.2, 0.2), [fx + wob * 0.4, RY + 0.25, RZ0 - 4.5], [0, 1, 0], 0.4, 'fine', 0.25);
      strip(g, [fx + wob * 0.4, RY + 0.25, RZ0 - 4.5], [fx + wob, RY + 0.2, RZ0 - 9.2], [0, 1, 0], 0.35, 'hair', 0.25);
      strip(g, P(fx, RZ1 - 1.2, 0.2), [fx - wob * 0.4, RY + 0.25, RZ1 + 4.5], [0, 1, 0], 0.4, 'fine', 0.25);
      strip(g, [fx - wob * 0.4, RY + 0.25, RZ1 + 4.5], [fx - wob, RY + 0.2, RZ1 + 9.2], [0, 1, 0], 0.35, 'hair', 0.25);
    }
  }

  /* ------------------------------- assembly ------------------------------- */
  PLR.objects.rug = {
    id: 'rug',
    build: function (app) {
      var scene = app.scene;
      var node = scene.group(scene.root, { name: 'rug' });
      var g = node._g;

      var pr = PLR.interact.make(scene, node, {
        id: 'rug',
        label: '地毯',
        hit: 'main',
        hintDims: [RW, 3, RD],
        enter: function (p) { p.setStatus(curl > 0.5 ? '一角翘起' : '平铺'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          if (curlWant > 0.5) {
            curlWant = 0;
            settle = 2.2;
            p.setStatus('抚平');
          } else {
            curlWant = 1;
            settle = 0;
            p.setStatus('一角翘起');
          }
          PLR.audio.curtainSweep(false);
        },
      });

      node.behavior = {
        dynamic: true,
        init: function (n, gg) { draw(gg); },
        build: function (n, gg) { draw(gg); },
        update: function (dt) {
          phase += dt * 0.32;
          if (settle > 0) {
            settle -= dt;
            if (settle <= 0) { curlWant = 1; pr.setStatus('一角翘起'); }
          }
          curl = damp(curl, curlWant, 2.4, dt);
        },
        post: function () { pr.hitRegion(app.renderer); },
      };
      node.touch();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
