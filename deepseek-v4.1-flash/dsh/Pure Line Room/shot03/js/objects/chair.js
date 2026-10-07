/* =========================================================================
   Pure Line Room — objects/chair.js
   The desk chair at L.chair. It faces the desk (the back wall, -Z), and it is
   the one thing in the room you can drag: a pointer drag slides it across the
   floor plane, clamped inside the room and kept clear of the desk. Hovering
   eases it a few centimetres toward the viewer. One proxy ('木椅').

   Geometry: tapered legs, rails, a shaped saddle seat with a visible edge
   profile, a woven rush pattern drawn as a cross-hatch of fine edges, two
   raked back stiles and three curved horizontal slats, plus stretchers.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;
  var clamp = PLR.math.clamp;

  var CH = L.chair;

  /* the desk's footprint on the floor, from the layout so the clamp stays honest */
  var DK_X0 = L.desk.x - L.desk.w / 2;
  var DK_X1 = L.desk.x + L.desk.w / 2;
  var DK_Z1 = L.z0 + 4 + L.desk.d;

  /* ------------------------- the chair's own dimensions -------------------- */
  var SW = 40, SD = 42;            // seat width / depth (local X / Z)
  var SH = 43, SDIP = 2.6;         // seat top at the rim, and how much it dips
  var FRAME_D = 4.0;               // seat frame depth below the rim
  var SEAT = SH + SDIP;            // 45.6 — the rim height
  var PI = Math.PI;

  /* The seat is drawn about a pivot at local z = PIVOT, so that the raked
     back can simply be rotated about it and stays put at the seat. */
  var PIVOT = SD / 2;
  var BACK_TILT = 0.10;            // radians of rake

  /* ------------------------------ small helpers ---------------------------- */
  function seatY(w, d) {
    // w, d are normalised to -1 .. 1 across the seat
    var r = Math.sqrt(w * w + d * d) / 1.414;
    return SEAT - SDIP * (1 - r) * (0.94 + 0.16 * d);
  }

  var WOOD_C = { m: 'wood', weight: 1.5 };
  var SEAM = { m: 'crease', weight: 1.1 };
  var HAIR = { m: 'hair' };
  var FINE = { m: 'fine' };

  /* ------------------------------ the geometry ----------------------------- */
  function draw(g) {
    var i, j;

    /* ---- legs: tapered square section, front pair shortest to the eye ---- */
    function leg(cx, cz, top, bot) {
      g.prism([
        [cx - top, 0.6], [cx + top, 0.6], [cx + top, SEAT - 9], [cx - top, SEAT - 9],
      ], cz - top, cz + top, 'wood');
      g.box(cx - bot - 0.5, 0, cz - bot - 0.5, cx + bot + 0.5, 1.4, cz + bot + 0.5, 'woodDark');
    }
    leg(-15.4, -17.4, 2.0, 1.5);
    leg(15.4, -17.4, 2.0, 1.5);
    leg(-15.4, 17.4, 2.0, 1.5);
    leg(15.4, 17.4, 2.0, 1.5);

    /* ---- stretchers: a box between the front legs and one between the back */
    g.box(-15.4 + 1.6, 13, -17.4 - 1.4, 15.4 - 1.6, 16.2, -17.4 + 1.4, 'woodDark', 'crease');
    g.box(-15.4 + 1.6, 17.6, 17.4 - 1.4, 15.4 - 1.6, 20.8, 17.4 + 1.4, 'woodDark', 'crease');
    // side stretchers, front leg to back leg
    for (i = 0; i < 2; i++) {
      var lx = i ? 15.4 : -15.4;
      g.box(lx - 1.3, 15, -17.4 + 1.5, lx + 1.3, 17.6, 17.4 - 1.5, 'woodDark', 'crease');
    }

    /* ---- the shaped saddle seat: a top grid, an edge profile, a frame ----- */
    var N = 6, cols = [], botCols = [];
    for (i = 0; i <= N; i++) {
      var col = [], bcol = [];
      for (j = 0; j <= N; j++) {
        var x = -SW / 2 + SW * (i / N);
        var z = -SD / 2 + SD * (j / N);
        col.push(g.v(x, seatY(x / (SW / 2), z / (SD / 2)), PIVOT + z));
        bcol.push(g.v(x, seatY(x / (SW / 2), z / (SD / 2)) - FRAME_D, PIVOT + z));
      }
      cols.push(col); botCols.push(bcol);
    }
    // top surface — wound so the normal points up, toward the camera above
    for (i = 0; i < N; i++) {
      for (j = 0; j < N; j++) {
        g.face([cols[i][j], cols[i + 1][j], cols[i + 1][j + 1], cols[i][j + 1]], WOOD_C);
      }
    }
    // the front edge profile: a light band under the rim on every side
    for (i = 0; i < N; i++) {
      g.face([cols[i][0], cols[i + 1][0], botCols[i + 1][0], botCols[i][0]], WOOD_C);            // -Z, front
      g.face([cols[i + 1][N], cols[i][N], botCols[i][N], botCols[i + 1][N]], WOOD_C);            // +Z, back
      g.face([cols[0][i + 1], cols[0][i], botCols[0][i], botCols[0][i + 1]], WOOD_C);            // -X, left
      g.face([cols[N][i], cols[N][i + 1], botCols[N][i + 1], botCols[N][i]], WOOD_C);            // +X, right
      g.face([botCols[i][N], botCols[i + 1][N], botCols[i + 1][0], botCols[i][0]], { m: 'woodDark', weight: 1.3 });
    }
    // a crease line where the frame meets the rim, all the way round
    g.polyline([cols[0][0], cols[N][0], cols[N][N], cols[0][N]], SEAM);

    /* ---- the woven rush top: a fine cross-hatch of edges ----------------- */
    var ribs = 9;
    for (i = 1; i < ribs; i++) {
      var u = i / ribs, k;
      // two diagonals per rib, sampled on the saddle so they hug the shape
      for (var s = 0; s < 2; s++) {
        for (k = 0; k < N; k++) {
          var a = s ? u : (k / N) * (1 - u);
          var b = s ? (k / N) * (1 - u) : u;
          var a1 = s ? u : ((k + 1) / N) * (1 - u);
          var b1 = s ? ((k + 1) / N) * (1 - u) : u;
          var xa = -SW / 2 + SW * a, za = -SD / 2 + SD * b;
          var xb = -SW / 2 + SW * a1, zb = -SD / 2 + SD * b1;
          var p1 = g.v(xa, seatY((xa / (SW / 2)) * 0.97, (za / (SD / 2)) * 0.97) + 0.12, PIVOT + za);
          var p2 = g.v(xb, seatY((xb / (SW / 2)) * 0.97, (zb / (SD / 2)) * 0.97) + 0.12, PIVOT + zb);
          g.edge(p1, p2, k % 2 ? HAIR : FINE);
        }
      }
    }
    // the rim binding, just inside the edge
    (function () {
      var r = 1.6;
      var pts = [
        [-SW / 2 + r, PIVOT - SD / 2 + r], [SW / 2 - r, PIVOT - SD / 2 + r],
        [SW / 2 - r, PIVOT + SD / 2 - r], [-SW / 2 + r, PIVOT + SD / 2 - r],
      ];
      var ids = [];
      for (var q = 0; q < pts.length; q++) {
        ids.push(g.v(pts[q][0], seatY((pts[q][0] / (SW / 2)) * 0.92, ((pts[q][1] - PIVOT) / (SD / 2)) * 0.92) + 0.14, pts[q][1]));
      }
      g.polyline(ids, FINE);
    })();

    /* ---- the back: two raked stiles and three curved slats --------------- */
    var stileTop = 88;
    function raked(p) {
      // rotate about the pivot line at local z = PIVOT
      var dz = p[2] - PIVOT;
      var c = Math.cos(BACK_TILT), s = Math.sin(BACK_TILT);
      return [p[0], p[1] + dz * s, PIVOT + dz * c];
    }
    for (i = 0; i < 2; i++) {
      var sx = i ? 14.4 : -14.4;
      var corner = [sx, stileTop];
      var base = raked([sx, SEAT - 4, PIVOT + 1.6]);
      var topP = raked([sx, corner[1], PIVOT + 1.6]);
      // a stile is a slab 10-odd deep in Z that follows the rake: draw it as a
      // five-point profile in the YZ plane, extruded in X. The profile runs
      // counter-clockwise as seen from +X, which is the winding the prism wants.
      var y0 = base[1], z0 = base[2], y1 = topP[1], z1 = topP[2];
      var prof = [
        [z0 + 5.5, y0], [z0 - 5.5, y0], [z1 - 5.5, y1],
        [z1 + 2.2, y1], [z1 + 4.4, y1 - 4],
      ];
      g.prism(prof, sx - 2.3, sx + 2.3, 'wood');
      // the top of the stile is rounded off with a soft crease
      g.edge(g.v(sx - 2.3, y1, z1 - 5.5), g.v(sx + 2.3, y1, z1 - 5.5), SEAM);
    }

    // three slats, each bowed toward the back (+Z) and raked with the stiles
    var slats = [[55.5, 8.6], [67.0, 8.0], [78.5, 7.2]];
    for (i = 0; i < slats.length; i++) {
      var cy = slats[i][0], hh = slats[i][1] / 2, M = 8;
      var topIds = [], botIds = [];
      for (j = 0; j <= M; j++) {
        var t = j / M;
        var x = -SW / 2 + SW * t;
        var zb = PIVOT + 0.6 + 5.4 * Math.pow(Math.abs(x) / (SW / 2), 1.7);
        var tp = raked([x, cy + hh, zb]);
        var bp = raked([x, cy - hh, zb]);
        topIds.push(g.v(tp[0], tp[1], tp[2]));
        botIds.push(g.v(bp[0], bp[1], bp[2]));
      }
      for (j = 0; j < M; j++) {
        g.face([topIds[j], topIds[j + 1], botIds[j + 1], botIds[j]], WOOD_C);
      }
      g.polyline(topIds, SEAM);
      g.polyline(botIds, HAIR);
      // a pair of fine rules floating on the slat face, for the drawing
      for (j = 0; j < M; j += 2) {
        var mid = raked([-SW / 2 + SW * ((j + 0.5) / M), cy, PIVOT + 0.5]);
        g.edge(g.v(mid[0] - 4, mid[1] + hh * 0.42, mid[2] - 0.2), g.v(mid[0] + 4, mid[1] + hh * 0.42, mid[2] - 0.2), HAIR);
      }
    }
    // the top rail, capping the stiles
    var capA = raked([-SW / 2 + 4, 89.4, PIVOT + 0.4]);
    var capB = raked([SW / 2 - 4, 89.4, PIVOT + 0.4]);
    var capC = raked([SW / 2 - 4, 89.4, PIVOT + 8.4]);
    var capD = raked([-SW / 2 + 4, 89.4, PIVOT + 8.4]);
    var capE = raked([-SW / 2 + 4, 86.4, PIVOT + 8.4]);
    var capF = raked([SW / 2 - 4, 86.4, PIVOT + 8.4]);
    g.face([g.v(capA[0], capA[1], capA[2]), g.v(capB[0], capB[1], capB[2]),
      g.v(capC[0], capC[1], capC[2]), g.v(capD[0], capD[1], capD[2])], WOOD_C);
    g.face([g.v(capD[0], capD[1], capD[2]), g.v(capC[0], capC[1], capC[2]),
      g.v(capF[0], capF[1], capF[2]), g.v(capE[0], capE[1], capE[2])], WOOD_C);
  }

  /* --------------------------------- module -------------------------------- */
  PLR.objects.chair = {
    id: 'chair',
    build: function (app) {
      var node = app.scene.group(app.scene.root, {
        name: 'chair',
        p: [CH.x, 0, CH.z],
        yaw: PI,               // face the desk: local -Z becomes world -Z
      });
      draw(node._g);

      /* --------------------------- drag behaviour -------------------------- */
      var px = CH.x, pz = CH.z;             // where the chair wants to be
      var cx = CH.x, cz = CH.z;             // where it is, this frame
      var lean = 0, wantLean = 0;
      var dragId = 0, dragging = false;

      var pr = PLR.interact.make(app.scene, node, {
        id: 'chair',
        label: '木椅',
        hit: 'main',
        hintDims: [SW, 90, SD],
        enter: function (p) { wantLean = 1; p.setStatus('拖动挪开'); },
        leave: function (p) { wantLean = 0; p.setStatus('拖动挪开'); },
        press: function (p, down) {
          if (down) {
            PLR.audio.resume();
            p.setStatus('木质 · 可拖动');
          }
          if (!down) { dragId++; dragging = false; p.setStatus('拖动挪开'); }
        },
        onClick: function (p) { p.setStatus('拖动挪开'); },
        onDrag: function (p, dx, dy) {
          if (app.drag && app.drag._chairId !== dragId) {
            dragId = app.drag._chairId;
            dragging = true;
            PLR.audio.woodTap(180);
          }
          // screen pixels -> a slide on the floor plane
          px = clamp(px + dx * 0.55, L.x0 + 30, L.x1 - 30);
          pz = clamp(pz + dy * 0.35, L.z0 + 40, L.z1 - 40);
          // ...and out of the desk's volume, along whichever axis is cheaper
          var HX = SW / 2 + 4, HZ = SD / 2 + 5;
          var ox = DK_X1 + HX - px, oy = DK_Z1 + HZ - pz;
          if (ox > 0 && oy > 0) {
            if (ox < oy) px += ox * 0.6; else pz += oy * 0.6;
          }
          return true;                // swallow the drag: the camera stays put
        },
        update: function (p, dt) {
          cx = damp(cx, px, 11, dt);
          cz = damp(cz, pz, 11, dt);
          var want = wantLean * (dragging ? 0.35 : 1);
          lean = damp(lean, want, 6.5, dt);
          node.setTransform({
            p: [cx, 0, cz + 7 * lean],
            yaw: PI + 0.02 * lean,
          });
          node.touch();
        },
      });
      pr.setStatus('拖动挪开');

      node.behavior = {
        post: function (n, renderer) { pr.hitRegion(renderer, 'main'); },
      };
      node.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
