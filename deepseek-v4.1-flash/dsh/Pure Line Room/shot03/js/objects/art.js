/* =========================================================================
   Pure Line Room — objects/art.js
   Two wall pieces: a large framed landscape on the right wall (L.painting) and
   a small botanical sprig on the back wall (L.smallFrame). Each has a bevelled
   moulding, a recessed mat and a printed image drawn as real screen-space line
   art through renderer.overlay(). Clicking a frame knocks it a few degrees off
   the wall; it settles back with a damped wobble.
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

  /* sweep a cross-section along one wall-plane coordinate.
     mk(a, b, s) turns section coordinates (a, b) plus the sweep coordinate s
     into a world point, so the same code builds every moulding bar. */
  function bar(g, prof, mk, s0, s1, cen, mat, opts) {
    var lo = [], hi = [], i;
    for (i = 0; i < prof.length; i++) {
      lo.push(mk(prof[i][0], prof[i][1], s0));
      hi.push(mk(prof[i][0], prof[i][1], s1));
    }
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
    var h = (w === undefined ? 0.4 : w) / 2 / ul, off = (lift === undefined ? 0.2 : lift);
    ux *= h; uy *= h; uz *= h;
    var ox = nx * off, oy = ny * off, oz = nz * off;
    faceOut(g, [
      [a[0] - ux + ox, a[1] - uy + oy, a[2] - uz + oz],
      [b[0] - ux + ox, b[1] - uy + oy, b[2] - uz + oz],
      [b[0] + ux + ox, b[1] + uy + oy, b[2] + uz + oz],
      [a[0] + ux + ox, a[1] + uy + oy, a[2] + uz + oz],
    ], nrm, mat, null);
  }

  /* ------------------------------ the drawing -----------------------------
     Every line of the printed image is authored in the paper's own 2D
     centimetres and then projected through the frame's (tilted) plane, so the
     picture is real screen-space line art and never leaves the mat opening. */
  function makeCanvas2D(aw, ah, project) {
    var api = {
      aw: aw, ah: ah,
      inside: function (p) {
        return p[0] >= -aw / 2 - 0.01 && p[0] <= aw / 2 + 0.01 &&
          p[1] >= -ah / 2 - 0.01 && p[1] <= ah / 2 + 0.01;
      },
      stroke: function (pts, opt) {
        var i, world = [];
        for (i = 0; i < pts.length; i++) {
          if (!api.inside(pts[i])) return;          // clip: skip strokes that leave the paper
          world.push(project(pts[i][0], pts[i][1]));
        }
        opt.pts = world;
        api.emit(world, opt);
      },
      poly: function (fn, n, opt) {
        var pts = [], i;
        for (i = 0; i <= n; i++) pts.push(fn(i / n));
        api.stroke(pts, opt);
      },
      emit: null,
    };
    return api;
  }

  var TAU = Math.PI * 2;

  /* --------------------------------- the art ------------------------------ */
  function landscape(paper) {
    /* a minimal continuous-line landscape: contours, a low sun, one bird */
    var i, k;
    for (i = 0; i < 3; i++) {
      var amp = 11 - i * 3.2, base = -14 + i * 5.5;
      paper.poly(function (u) {
        var x = (u - 0.5) * paper.aw;
        var v = base + amp * Math.sin(u * (2.1 + i * 0.7) + 1.1 + i) * 0.5
          + amp * 0.35 * Math.sin(u * 5.3 + i * 2.2);
        return [x, v];
      }, 46, { w: i === 0 ? 1.5 : 1.1 });
    }
    /* the sun, low on the horizon, with two rings */
    var sx = -paper.aw * 0.28, sy = 4;
    for (i = 0; i < 2; i++) {
      var rr = 10 - i * 3.4;
      paper.poly(function (u) {
        var a = u * TAU;
        return [sx + Math.cos(a) * rr, sy + Math.sin(a) * rr];
      }, 40, { w: 1.2 });
    }
    /* one bird mark, two quick strokes */
    for (i = 0; i < 2; i++) {
      var bx = paper.aw * 0.17 + i * 7.5, by = 20 - i * 2.5;
      paper.stroke([[bx - 4.5, by - 2.2], [bx - 2.1, by + 0.6], [bx, by - 1.4]], { w: 1.3 });
      paper.stroke([[bx, by - 1.4], [bx + 2.1, by + 0.6], [bx + 4.5, by - 2.2]], { w: 1.3 });
    }
  }

  function sprig(paper) {
    /* a botanical sprig: one stem, paired leaves, a seed head */
    var i, k;
    paper.poly(function (u) {
      var y = (u - 0.5) * paper.ah * 0.92;
      return [Math.sin(u * 3.1 - 0.4) * paper.aw * 0.11, y];
    }, 40, { w: 1.4 });
    for (i = 0; i < 5; i++) {
      var t = 0.18 + i * 0.165;
      var y = (t - 0.5) * paper.ah * 0.92;
      var x = Math.sin(t * 3.1 - 0.4) * paper.aw * 0.11;
      for (k = -1; k <= 1; k += 2) {
        var len = paper.aw * (0.30 - i * 0.028) * (i === 4 ? 0.7 : 1);
        var tipx = x + k * len, tipy = y + len * 0.42;
        paper.poly(function (u) {
          var px = x + (tipx - x) * u;
          var py = y + (tipy - y) * u;
          var bulge = Math.sin(u * Math.PI) * 2.6;
          return [px, py + bulge * (k > 0 ? 1 : -1) * 0.85 + bulge * 0.35];
        }, 16, { w: 1.1 });
        paper.stroke([[x, y], [tipx, tipy]], { w: 0.9 });
      }
    }
    paper.poly(function (u) {
      var y = paper.ah * 0.44 + u * 5.4;
      return [Math.sin(u * 2.2) * 2.2, y];
    }, 8, { w: 1.0 });
  }

  /* ------------------------------- one frame ------------------------------
     cfg: { node, id, label, mat (n/u/v mapping), sizes and tilt axis } */
  function makeFrame(app, cfg) {
    var scene = app.scene;
    var node = scene.group(scene.root, { name: cfg.name });
    var g = node._g;
    var tilt = 0, tiltV = 0, live = false;
    var K = 150, C = 7.4;

    function rot(p) {
      if (Math.abs(tilt) < 1e-5) return p;
      var c = Math.cos(tilt), s = Math.sin(tilt);
      if (cfg.spin === 'z') {
        var dx = p[0] - cfg.piv[0], dy = p[1] - cfg.piv[1];
        return [cfg.piv[0] + dx * c - dy * s, cfg.piv[1] + dx * s + dy * c, p[2]];
      }
      var dy2 = p[1] - cfg.piv[1], dz = p[2] - cfg.piv[2];
      return [p[0], cfg.piv[1] + dy2 * c - dz * s, cfg.piv[2] + dy2 * s + dz * c];
    }

    function draw() {
      var o = { hit: 'main' };
      /* mkV / mkU map a section point plus the sweep coordinate to a world
         point and apply the frame's tilt, so every moulding leans with it. */
      var mkVr = function (a, b, s) { return rot(cfg.mkV(a, b, s)); };
      var mkUr = function (a, b, s) { return rot(cfg.mkU(a, b, s)); };
      var nIn = cfg.nInner, nOut = cfg.nOuter;         // frame front / recess depth
      var u0 = cfg.uc - cfg.ow / 2, u1 = cfg.uc + cfg.ow / 2;
      var v0 = cfg.vc - cfg.oh / 2, v1 = cfg.vc + cfg.oh / 2;
      var iu0 = cfg.uc - cfg.wi / 2, iu1 = cfg.uc + cfg.wi / 2;
      var iv0 = cfg.vc - cfg.hi / 2, iv1 = cfg.vc + cfg.hi / 2;
      var cen = cfg.mk((cfg.nInner + cfg.nOuter) / 2, cfg.uc, cfg.vc + 0.5);
      var i;

      /* the four moulding bars, each bevelled back towards the opening.
         The section profiles are authored in the wall plane's own 2D
         coordinates and mapped to world points by mkV / mkU, which also apply
         the frame's current tilt, so the moulding leans with the frame. */
      var sV = [[cfg.nFront, iv1], [nIn, iv1], [nOut, v1], [cfg.nFront, v1]];
      var sVb = [[cfg.nFront, iv0], [nIn, iv0], [nOut, v0], [cfg.nFront, v0]];
      var sU = [[cfg.nFront, iu1], [nIn, iu1], [nOut, u1], [cfg.nFront, u1]];
      var sUb = [[cfg.nFront, iu0], [nIn, iu0], [nOut, u0], [cfg.nFront, u0]];
      bar(g, sV, mkVr, u0, u1, cen, 'wood', o);
      bar(g, sVb, mkVr, u0, u1, cen, 'wood', o);
      bar(g, sU, mkUr, v0, v1, cen, 'wood', o);
      bar(g, sUb, mkUr, v0, v1, cen, 'wood', o);

      /* the mat board, filling the opening just inside the bevel */
      var mat = [cfg.mk(cfg.nMat, iu0, iv0), cfg.mk(cfg.nMat, iu1, iv0),
        cfg.mk(cfg.nMat, iu1, iv1), cfg.mk(cfg.nMat, iu0, iv1)];
      faceAway(g, rot2(mat), cen, 'paper', o);
      /* a fine line where the mat meets the bevel */
      for (i = 0; i < 4; i++) {
        var a = rot(mat[i]), b = rot(mat[(i + 1) % 4]);
        strip(g, a, b, cfg.nrm, 0.45, 'fine', 0.25);
      }
      /* and the window of the printed image */
      var aw = cfg.aw, ah = cfg.ah;
      var win = [cfg.mk(cfg.nMat - 0.15, cfg.uc - aw / 2, cfg.vc - ah / 2),
        cfg.mk(cfg.nMat - 0.15, cfg.uc + aw / 2, cfg.vc - ah / 2),
        cfg.mk(cfg.nMat - 0.15, cfg.uc + aw / 2, cfg.vc + ah / 2),
        cfg.mk(cfg.nMat - 0.15, cfg.uc - aw / 2, cfg.vc + ah / 2)];
      for (i = 0; i < 4; i++) {
        strip(g, rot(win[i]), rot(win[(i + 1) % 4]), cfg.nrm, 0.4, 'hair', 0.28);
      }
    }

    /* rotate a ring of points about the frame's hanging point */
    function rot2(ring) {
      var out = [], i;
      for (i = 0; i < ring.length; i++) out.push(rot(ring[i]));
      return out;
    }

    function paint(renderer) {
      var pal = renderer.palette || {};
      var t = pal.__time || 0;
      var ink = PLR.palette.ink(t);
      var paper = makeCanvas2D(cfg.aw, cfg.ah, function (u, v) {
        return rot(cfg.mk(cfg.nMat - 0.5, cfg.uc + u, cfg.vc + v));
      });
      paper.emit = function (world, opt) {
        renderer.overlay(function (o2) {
          o2.poly(world, { stroke: ink, width: opt.w || 1.1, strokeAlpha: 0.92 });
        });
      };
      cfg.art(paper);
    }

    var pr = PLR.interact.make(scene, node, {
      id: cfg.id,
      label: cfg.label,
      hit: 'main',
      hintDims: [cfg.ow, cfg.oh, 8],
      enter: function (p) { if (!live) p.setStatus(cfg.status); },
      press: function (p, down) { if (down) PLR.audio.resume(); },
      onClick: function (p) {
        tiltV += 0.95;
        live = true;
        p.setStatus('歪了一下');
        PLR.audio.woodTap(300);
      },
    });

    node.behavior = {
      dynamic: true,
      init: function () { draw(); },
      build: function () { draw(); },
      update: function (dt, time, n, state, sc) {
        tiltV += (-K * tilt - C * tiltV) * dt;
        tilt += tiltV * dt;
        if (Math.abs(tilt) < 0.0006 && Math.abs(tiltV) < 0.004) {
          tilt = 0; tiltV = 0;
          if (live) { live = false; pr.setStatus(cfg.status); }
        }
      },
      post: function (n, renderer) { paint(renderer); pr.hitRegion(renderer); },
    };
    node.touch();
  }

  /* ------------------------------- assembly ------------------------------- */
  PLR.objects.art = {
    id: 'art',
    build: function (app) {
      var P = L.painting, S = L.smallFrame;

      /* ------------------- the large piece, right wall ------------------- */
      (function () {
        var w = P.w, h = P.h, bord = 9, matW = 17;
        var nx = L.x1 - 0.4;                       // the wall face
        makeFrame(app, {
          name: 'painting', id: 'painting', label: '挂画', status: '小幅风景',
          spin: 'z',
          nFront: nx - 7.2, nInner: nx - 4.4, nOuter: nx - 2.0, nMat: nx - 4.0,
          nrm: [-1, 0, 0],
          uc: P.cz, vc: P.cy, ow: w + bord * 2, oh: h + bord * 2, wi: w, hi: h,
          aw: w - matW * 2, ah: h - matW * 2,
          piv: [nx, P.cy + h / 2 + bord, P.cz],
          mk: function (n, u, v) { return [n, v, u]; },
          mkV: function (n, v, u) { return [n, v, u]; },
          mkU: function (n, u, v) { return [n, v, u]; },
          art: landscape,
        });
      })();

      /* -------------------- the small piece, back wall ------------------- */
      (function () {
        var w = S.w, h = S.h, bord = 5, matW = 8;
        var nz = L.z0 + 0.4;
        makeFrame(app, {
          name: 'smallFrame', id: 'smallframe', label: '小挂画', status: '手绘小画',
          spin: 'x',
          nFront: nz + 4.6, nInner: nz + 2.8, nOuter: nz + 1.2, nMat: nz + 3.0,
          nrm: [0, 0, 1],
          uc: S.x, vc: S.y, ow: w + bord * 2, oh: h + bord * 2, wi: w, hi: h,
          aw: w - matW * 2, ah: h - matW * 2,
          piv: [S.x, S.y + h / 2 + bord, nz],
          mk: function (n, u, v) { return [u, v, n]; },
          mkV: function (n, v, u) { return [u, v, n]; },
          mkU: function (n, u, v) { return [u, v, n]; },
          art: sprig,
        });
      })();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
