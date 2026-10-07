/* =========================================================================
   Pure Line Room — objects/desk.js
   The writing desk against the back wall (L.desk): a solid top slab with a
   real overhang and an edge band, an inlaid leather writing pad with a
   stitched border, a routed pen tray with a pencil cup, three drawers in the
   right-hand apron with brass cup handles, a modesty rail across the back,
   tapered square legs and two cross braces near the floor.

   The top surface is exactly y = L.deskTop, and it is left perfectly clear
   where the lamp, the mug, the globe and the book stack stand (L.deskItems).
   One proxy ('书桌') makes the pen tray / pencil cup a hover target.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;

  /* ---------------------------- plan dimensions ---------------------------- */
  var D = L.desk;
  var TOP = L.deskTop;                 // 74 — the top surface, used by everything on the desk
  var TOP_T = 3.4;                     // slab thickness
  var BOT = TOP - TOP_T;               // underside of the slab
  var OVER = 2;                        // overhang of the slab past the carcass
  var IN = 6;                          // leg inset from the slab edge
  var LEGS = 4;                        // leg square section at the top

  var X0 = D.x - D.w / 2;              // -104 : slab left
  var X1 = D.x + D.w / 2;              //  +36 : slab right
  var BX0 = X0 + OVER, BX1 = X1 - OVER; // carcass / leg outer faces
  var BZ = L.z0 + 4;                   // -226 : slab back edge
  var FZ = BZ + D.d;                   // -168 : slab front edge
  var PZ = FZ - OVER;                  // -170 : carcass front plane

  var LEGX0 = BX0 + IN, LEGX1 = BX1 - IN;   // -96 .. 28
  var LEGZ0 = BZ + IN, LEGZ1 = PZ - IN;     // -220 .. -176
  var LEGT = 71;                       // legs run up to the underside of the apron
  var APY0 = 11, APY1 = 70;            // apron band
  var RAIL_Y = 9, RAIL_T = 4;          // cross braces
  var KB0 = LEGX0 + LEGS;              // knee-hole opening, left  == -92
  var KB1 = LEGX1 - LEGS;              // knee-hole opening, right == 24

  /* soft interior lines (the slab / apron keep their own palette strokes) */
  var CREASE = { m: 'crease', weight: 1.15 };
  var FINE = { m: 'fine' };
  var HAIR = { m: 'hair' };
  var BRASS = { m: 'brass', weight: 1.35 };
  var INKBLUE = { m: 'ink', stroke: '#41465a', weight: 1.05 };
  var HILIGHT = { fill: '#ffffff', fillOpacity: 0.55, strokeOpacity: 0 };

  var PAD = { m: 'dark', fill: '#efe9e0', weight: 1.4 };
  var PAD_IN = { m: 'fine', stroke: '#6e6759' };
  var TRAY = { m: 'dark', fill: '#eae4da', weight: 1.2 };
  var STITCH = { m: 'fine', stroke: '#8b8273', weight: 0.85, dash: [2.4, 2.4] };

  /* ------------------------------ small helpers ---------------------------- */
  function stitchRing(g, pts, h) {
    for (var i = 0; i < pts.length; i++) {
      var n = pts[(i + 1) % pts.length];
      g.edge(g.v(pts[i][0], pts[i][1] + h, pts[i][2]), g.v(n[0], n[1] + h, n[2]), STITCH);
    }
  }

  function taperedLeg(g, cx, cz, top, bot, y0) {
    var profile = [
      [cx - top, y0], [cx + top, y0], [cx + top, y0 + LEGT], [cx - top, y0 + LEGT],
    ];
    g.prism(profile, cz - top, cz + top, 'wood');
    // the last of the taper: a small square foot pad
    g.box(cx - bot - 0.5, 0, cz - bot - 0.5, cx + bot + 0.5, 1.6, cz + bot + 0.5, 'woodDark');
  }

  /* a brass cup handle: a struck arc with two feet, on the drawer front */
  function cupHandle(g, cx, cy, cz, r) {
    var n = 9, ids = [], i, a;
    for (i = 0; i <= n; i++) {
      a = Math.PI * (1 - i / n);
      ids.push(g.v(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz - 0.5 - Math.sin(a) * 1.3));
    }
    g.polyline(ids, BRASS);
    g.edge(g.v(cx - r, cy, cz - 0.5), g.v(cx - r, cy - 1.7, cz + 0.4), BRASS);
    g.edge(g.v(cx + r, cy, cz - 0.5), g.v(cx + r, cy - 1.7, cz + 0.4), BRASS);
  }

  /* ------------------------------ the geometry ----------------------------- */
  function draw(g) {
    var i, j;

    /* ---- legs first, so everything that dies into them covers the joint --- */
    var legTop = 2.0, legBot = 1.35;
    taperedLeg(g, LEGX0, LEGZ0, legTop, legBot, 0);
    taperedLeg(g, LEGX1, LEGZ0, legTop, legBot, 0);
    taperedLeg(g, LEGX0, LEGZ1, legTop, legBot, 0);
    taperedLeg(g, LEGX1, LEGZ1, legTop, legBot, 0);

    /* ---- rails and aprons (the carcass under the slab) -------------------- */
    g.box(BX0, APY0, BZ, BX1, APY1, BZ + 5, 'wood', 'crease');            // back rail
    g.box(BX0, APY0, PZ - 5, BX1, APY1, PZ, 'wood', 'crease');            // front rail
    g.box(BX0, APY0, BZ + 5, BX0 + 6, APY1, PZ - 5, 'wood', 'crease');    // left end
    g.box(BX1 - 6, APY0, BZ + 5, BX1, APY1, PZ - 5, 'wood', 'crease');    // right end
    // the knee-hole back panel, shown as a frame with a rail across the middle
    g.box(BX0, 57, BZ + 5, BX1, 63, BZ + 7.5, 'wood', 'crease');
    g.box(BX0, 12, BZ + 5, BX1, 17, BZ + 7.5, 'wood', 'crease');
    g.box(BX0, 17, BZ + 6.4, BX0 + 3, 57, BZ + 7.5, 'wood', 'crease');
    g.box(BX1 - 3, 17, BZ + 6.4, BX1, 57, BZ + 7.5, 'wood', 'crease');

    /* ---- the modesty rail, across the back between the legs -------------- */
    g.box(LEGX0 + 2, 19, BZ + 14, LEGX1 - 2, 39, BZ + 18, 'wood', 'crease');
    g.edge(g.v(LEGX0 + 2, 21, BZ + 13.4), g.v(LEGX1 - 2, 21, BZ + 13.4), HAIR);
    g.edge(g.v(LEGX0 + 2, 37, BZ + 13.4), g.v(LEGX1 - 2, 37, BZ + 13.4), HAIR);

    /* ---- two cross braces just above the floor --------------------------- */
    for (i = 0; i < 2; i++) {
      var lz = i ? LEGZ1 : LEGZ0;
      g.box(LEGX0 + 1.6, RAIL_Y, lz - 1.6, LEGX1 - 1.6, RAIL_Y + RAIL_T, lz + 1.6, 'woodDark', 'crease');
      g.edge(g.v(LEGX0 + 1.6, RAIL_Y + 3.1, lz - 2.0), g.v(LEGX1 - 1.6, RAIL_Y + 3.1, lz - 2.0), HAIR);
    }
    // a pair of side stretchers, front leg to back leg, to stop the sway
    for (i = 0; i < 2; i++) {
      var lx = i ? LEGX1 : LEGX0;
      g.box(lx - 1.5, RAIL_Y + 1, LEGZ0 + 1.5, lx + 1.5, RAIL_Y + 3.6, LEGZ1 - 1.5, 'woodDark', 'crease');
    }

    /* ---- three drawers in the right-hand apron --------------------------- */
    var dScale = (BX1 - 6 - KB1) / 100;                 // 35.2 / 100
    var dH = 13.4 * dScale, dGap = 2.6 * dScale;
    var dTop = 66.4, dX0 = KB1, dX1 = BX1 - 6;
    for (j = 0; j < 3; j++) {
      var cy = dTop - dH / 2 - j * (dH + dGap);
      var y0 = cy - dH / 2, y1 = cy + dH / 2;
      g.box(dX0, y0, -173.6, dX1, y1, -175.6, 'wood', 'crease');
      // the reveal: a fine line following the joint all the way round
      var rv = [
        g.v(dX0 + 1.1, y0 + 1.1, -173.55), g.v(dX1 - 1.1, y0 + 1.1, -173.55),
        g.v(dX1 - 1.1, y1 - 1.1, -173.55), g.v(dX0 + 1.1, y1 - 1.1, -173.55),
      ];
      g.ring(rv, FINE);
      // dovetail shadow under the front edge, and the brass cup handle
      g.edge(g.v(dX0 + 2, y0 + 2.4, -173.5), g.v(dX1 - 2, y0 + 2.4, -173.5), HAIR);
      cupHandle(g, (dX0 + dX1) / 2, cy + 0.6, -173.4, 3.1 * dScale + 1.5);
    }

    /* ---- the leather writing pad, inlaid in the top ---------------------- */
    // x -92..-58, z -221..-182: clear of the lamp (-92,-206), the globe
    // (-66,-184) and the mug (-16,-200), which stand on the bare top.
    var px0 = -92, px1 = -58, pz0 = -221, pz1 = -182;
    g.box(px0, TOP, pz0, px1, TOP + 0.42, pz1, PAD, PAD_IN);
    stitchRing(g, [
      [px0 + 2.4, TOP + 0.42, pz0 + 2.4],
      [px1 - 2.4, TOP + 0.42, pz0 + 2.4],
      [px1 - 2.4, TOP + 0.42, pz1 - 2.4],
      [px0 + 2.4, TOP + 0.42, pz1 - 2.4],
    ], 0.16);
    // a fine score line just inside the stitched border
    g.polyline([
      g.v(px0 + 4.2, TOP + 0.44, pz0 + 4.2), g.v(px1 - 4.2, TOP + 0.44, pz0 + 4.2),
      g.v(px1 - 4.2, TOP + 0.44, pz1 - 4.2), g.v(px0 + 4.2, TOP + 0.44, pz1 - 4.2),
    ], HAIR);

    /* ---- the shallow pen tray routed into the top, right of the pad ------ */
    // x 6..34, z -200..-188: below the book stack (10,-190) is avoided by
    // keeping the tray's own floor flush and graphically inset.
    var tx0 = 6, tx1 = 34, tz0 = -200, tz1 = -188;
    var floor = [
      g.v(tx0, TOP + 0.04, tz0), g.v(tx1, TOP + 0.04, tz0),
      g.v(tx1, TOP + 0.04, tz1), g.v(tx0, TOP + 0.04, tz1),
    ];
    g.face(floor, TRAY);
    g.ring(floor, { m: 'sil', stroke: '#14161d', weight: 2.2 });
    // the routed lip: a light band on three sides, drawn slightly proud
    g.polyline([
      g.v(tx0 - 1.1, TOP + 0.06, tz0 - 1.1), g.v(tx1 + 1.1, TOP + 0.06, tz0 - 1.1),
      g.v(tx1 + 1.1, TOP + 0.06, tz1 + 1.1), g.v(tx0 - 1.1, TOP + 0.06, tz1 + 1.1),
    ], HILIGHT);
    g.edge(g.v(tx0, TOP + 0.08, tz1), g.v(tx1, TOP + 0.08, tz1), { m: 'fine', stroke: '#7c7566' });

    /* ---- the pencil cup, standing in the tray ---------------------------- */
    var ccx = 30, ccz = -194;
    g.cylinder(ccx, TOP + 2.7, ccz, 3.4, 5.4, { side: 'metal', cap: 'metal', segments: 16, edge: 'crease' });
    g.circleOutline([ccx, TOP + 5.4, ccz], 3.4, 'y', 'fine', 16);
    g.circleOutline([ccx, TOP + 0.1, ccz], 3.9, 'y', 'hair', 16);
    // three pencils, leaning out of the cup, as fine inked rods
    var pen = [
      [ccx - 1.5, ccz + 1.1, -0.30, 0.16],
      [ccx + 1.2, ccz - 0.9, 0.22, -0.20],
      [ccx - 0.3, ccz - 1.8, 0.06, 0.30],
    ];
    for (i = 0; i < pen.length; i++) {
      var bxp = pen[i][0] + 8.4 * Math.sin(pen[i][3]);
      var bzp = pen[i][1] + 8.4 * Math.sin(pen[i][2]);
      var top = g.v(bxp, TOP + 10.4, bzp);
      g.edge(g.v(pen[i][0], TOP + 3.6, pen[i][1]), top, INKBLUE);
      g.edge(top, g.v(bxp, TOP + 11.2, bzp + 0.5), { m: 'sil', weight: 1.6 });
    }

    /* ---- the top slab last, so the pad and tray sit cleanly in it -------- */
    g.box(X0, BOT, BZ, X1, TOP, FZ, 'wood', 'crease');
    // the edge band: a fine line all the way round the slab, just below the top
    var band = [
      g.v(X0 + 0.1, TOP - 0.9, BZ + 0.1), g.v(X1 - 0.1, TOP - 0.9, BZ + 0.1),
      g.v(X1 - 0.1, TOP - 0.9, FZ - 0.1), g.v(X0 + 0.1, TOP - 0.9, FZ - 0.1),
    ];
    g.ring(band, HAIR);
    // and the shadow line where the slab overhangs the carcass
    g.polyline([
      g.v(BX0, BOT - 0.5, BZ + 0.2), g.v(BX1, BOT - 0.5, BZ + 0.2),
      g.v(BX1, BOT - 0.5, PZ - 0.2), g.v(BX0, BOT - 0.5, PZ - 0.2),
    ], HAIR);
  }

  /* --------------------------------- module -------------------------------- */
  PLR.objects.desk = {
    id: 'desk',
    build: function (app) {
      var node = app.scene.group(app.scene.root, { name: 'desk' });
      var g = node._g;
      draw(g);

      var pr = PLR.interact.make(app.scene, node, {
        id: 'desk',
        label: '书桌',
        hit: 'main',
        hintDims: [D.w, D.h, D.d],
        enter: function (p) { p.setStatus('写字台 · 笔槽'); },
        leave: function (p) { p.setStatus(''); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
      });
      pr.setStatus('写字台 · 笔槽');

      node.behavior = {
        post: function (n, renderer) { pr.hitRegion(renderer, 'main'); },
      };
      node.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
