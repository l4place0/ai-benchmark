/* =========================================================================
   Pure Line Room — objects/door.js
   The door in the left wall opening (L.door): a lining that stands in for the
   wall's thickness, an architrave around the opening, a timber threshold, and
   a two-panel leaf hung on two hinge knuckles with a brass lever on a rose.
   Clicking the leaf swings it 78 degrees into the room about its hinge edge;
   hovering it lifts the brass of the handle.

   Drawing notes (see INTERFACES.md):
   · Detail lines are hairline faces. Every face outline is stroked by the
     renderer, so a 0.3cm quad draws as a crisp line and still takes part in
     the depth sort — the cheap way to get reveals and creases that behave.
   · Draw order is the distance from the camera to a node's own origin, so the
     case sits behind the wall plane and the leaf, hung on its own hinge group,
     always paints over it.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var DEG = Math.PI / 180;
  var damp = PLR.math.ease.damp;
  var mix = PLR.palette.mix;

  /* ------------------------- the opening (from L.door) ------------------- */
  var X0 = L.x0;                                  // the left wall
  var CZ = L.door.cz, W = L.door.w, H = L.door.h;
  var ZB = CZ - W / 2, ZF = CZ + W / 2;           // back / front jamb

  /* ------------------------------- the case ------------------------------ */
  var FD = 12;            // how far the lining reaches into the room
  var LT = 2.4;           // lining board thickness
  var AW = 9;             // architrave width
  var AP = 2.6;           // architrave projection off the wall
  var TH = 3.4;           // threshold height

  /* ------------------------------- the leaf ------------------------------ */
  var LTH = 4.6;                                // leaf thickness
  var LX0 = X0 + 4.2, LX1 = LX0 + LTH;          // leaf faces, out from the wall
  var HX = (LX0 + LX1) / 2;                     // hinge axis, x
  var HZ = ZB + LT + 0.8;                       // hinge axis, z (at the back jamb)
  var LW = (ZF - LT - 0.8) - HZ;                // leaf width, along the wall
  var LY0 = TH + 1.2, LY1 = H - LT - 0.5;       // leaf bottom and top
  var XF = LTH / 2, XC = XF - 1.25;             // front face / panel floor
  var STILE = 9.5, RAIL_B = 18, RAIL_T = 15, RAIL_M = 12;
  var MY = (LY0 + LY1) / 2;
  var OPEN = -78 * DEG;                         // swings into the room
  var HINGE_Y = [32, 166];

  /* the case group's origin, set back behind the wall so that the room always
     orders the case before the leaf */
  var FX = X0 - 30, FZ = CZ;

  var GAP = { m: 'shadow', fill: '#1c1e26', fillOpacity: 0.13, strokeOpacity: 0 };
  var CREASE = { m: 'crease' };

  /* ------------------------------- helpers ------------------------------- */
  /* A case box authored in world coordinates. */
  function cb(g, x0, y0, z0, x1, y1, z1, mats, edge) {
    g.box(x0 - FX, y0, z0 - FZ, x1 - FX, y1, z1 - FZ, mats, edge);
  }

  /* A hairline quad on the plane x = X, facing +X (out of the left wall). */
  function lineX(g, x, y0, y1, z0, z1, mat) {
    g.face([
      g.v(x, y0, z1), g.v(x, y0, z0), g.v(x, y1, z0), g.v(x, y1, z1),
    ], mat);
  }

  /* A hairline rectangle outline on the plane x = X: a panel reveal. */
  function creaseRect(g, x, y0, y1, z0, z1, w, mat) {
    lineX(g, x, y0, y0 + w, z0, z1, mat);
    lineX(g, x, y1 - w, y1, z0, z1, mat);
    lineX(g, x, y0, y1, z0, z0 + w, mat);
    lineX(g, x, y0, y1, z1 - w, z1, mat);
  }

  /* Tag every face authored since `from` as a face the proxy can pick. */
  function tagHits(g, from, tag) {
    for (var i = from; i < g.faces.length; i++) g.faces[i].hit = tag;
  }

  /* ---------------------------- the case mesh ---------------------------- */
  function drawCase(g) {
    /* lining: the reveal that stands in for the wall's thickness */
    cb(g, X0, 0, ZB, X0 + FD, H, ZB + LT, 'trim');
    cb(g, X0, 0, ZF - LT, X0 + FD, H, ZF, 'trim');
    cb(g, X0, H - LT, ZB + LT, X0 + FD, H, ZF - LT, 'trim');

    /* architrave: two legs standing on the threshold, a head across them */
    cb(g, X0, TH, ZB - AW, X0 + AP, H, ZB, 'trim');
    cb(g, X0, TH, ZF, X0 + AP, H, ZF + AW, 'trim');
    cb(g, X0, H, ZB - AW, X0 + AP, H + AW, ZF + AW, 'trim');

    /* threshold: one timber sill running under both legs */
    cb(g, X0, 0, ZB - AW, X0 + FD + 1, TH, ZF + AW, 'woodDark');

    /* the shadow gap the leaf closes against */
    cb(g, LX0 - 0.3, LY0, ZB + LT, LX1 + 0.3, LY1, HZ, GAP);
    cb(g, LX0 - 0.3, LY0, ZF - LT - 0.8, LX1 + 0.3, LY1, ZF - LT, GAP);
    cb(g, LX0 - 0.3, LY1, ZB + LT, LX1 + 0.3, H - LT, ZF - LT, GAP);
    cb(g, LX0 - 0.3, TH, ZB + LT, LX1 + 0.3, LY0, ZF - LT, GAP);

    /* two hinges: knuckles turning on the hinge axis itself */
    for (var i = 0; i < HINGE_Y.length; i++) {
      g.cylinder(HX - FX, HINGE_Y[i], HZ - FZ, 0.92, 9.4,
        { side: 'metal', cap: 'metal', segments: 12, edge: 'crease' });
    }
  }

  /* ---------------------------- the leaf mesh ---------------------------- */
  /* Authored in the hinge group's space: the hinge axis is the origin, the leaf
     runs from local z = 0 (hinge edge) to LW (leading edge). */
  function drawLeaf(g) {
    /* the body. Its room-facing face is the panel floor, and it is left
       unstroked so the recess reads as one quiet surface behind the frame. */
    g.box(-XF, LY0, 0, XC, LY1, LW,
      { all: 'whiteSoft', right: { m: 'whiteSoft', strokeOpacity: 0 } });

    /* the front frame, 1.25cm proud of the panel floors */
    g.box(XC, LY0, 0, XF, LY1, STILE, 'white');
    g.box(XC, LY0, LW - STILE, XF, LY1, LW, 'white');
    g.box(XC, LY0, STILE, XF, LY0 + RAIL_B, LW - STILE, 'white');
    g.box(XC, LY1 - RAIL_T, STILE, XF, LY1, LW - STILE, 'white');
    g.box(XC, MY - RAIL_M / 2, STILE, XF, MY + RAIL_M / 2, LW - STILE, 'white');

    /* 2 recessed panels: a light crease inboard of every reveal, and the
       soft shadow the top reveal throws across the panel */
    var pz0 = STILE + 1.3, pz1 = LW - STILE - 1.3;
    var px = XC + 0.03;
    var panels = [
      [LY0 + RAIL_B + 1.3, MY - RAIL_M / 2 - 1.3],
      [MY + RAIL_M / 2 + 1.3, LY1 - RAIL_T - 1.3],
    ];
    for (var i = 0; i < panels.length; i++) {
      var py0 = panels[i][0], py1 = panels[i][1];
      creaseRect(g, px, py0, py1, pz0, pz1, 0.3, CREASE);
      lineX(g, px + 0.01, py1 - 1.2, py1, pz0, pz1,
        { m: 'shadow', fill: '#1c1e26', fillOpacity: 0.10 });
    }

    /* the hinge straps, folded over the hinge edge and onto the face */
    for (var h = 0; h < HINGE_Y.length; h++) {
      var hy = HINGE_Y[h] - LY0;
      g.box(-XF, hy - 4.4, 0, XF + 0.5, hy + 4.4, 1.5, 'metal', 'hair');
    }
  }

  /* --------------------------- the handle mesh --------------------------- */
  /* A lever on a rose plate, mounted on the room side of the leaf, 9.5cm in
     from the leading edge and pointing back at the hinge. */
  function drawHandle(g, app, pr) {
    var pal = app.renderer.palette;
    var t = pr ? pr.hoverT : 0;
    var brass = { m: 'brass', fill: mix(pal.brass.fill, '#ffffff', 0.55 * t) };
    var XR = XF + 0.02;

    g.disc([XR, 0, 0], 3.3, 'x', brass, 18);
    g.disc([XR + 0.03, 0, 0], 2.15, 'x', CREASE, 14);       // the rose's inner ring

    g.box(XR, -1.35, -1.35, XR + 2.1, 1.35, 1.35, brass);   // neck
    g.box(XR + 0.75, -1.05, -14.6, XR + 2.1, 1.05, -1.35, brass);  // lever bar
    g.box(XR + 0.6, -1.25, -15.5, XR + 2.25, 1.25, -14.6, brass);  // lever tip
  }

  /* ================================ module =============================== */
  PLR.objects.door = {
    id: 'door',
    build: function (app) {
      var scene = app.scene;

      /* ---- the case (static) ---- */
      var frame = scene.group(scene.root, { name: 'doorCase', p: [FX, 0, FZ] });
      drawCase(frame._g);
      frame.touch();

      /* ---- the leaf: its own group, whose local transform is the hinge ---- */
      var leaf = scene.group(scene.root, { name: 'doorLeaf', p: [HX, 0, HZ] });
      var g = leaf._g;
      var first = g.faces.length;
      drawLeaf(g);
      tagHits(g, first, 'main');
      leaf.touch();

      /* the hinge angle: 0 shut, OPEN swung into the room */
      var open = false, ang = 0, want = 0;

      var pr = PLR.interact.make(scene, leaf, {
        id: 'door',
        label: '房门',
        hit: 'main',
        hintDims: [LW, LY1 - LY0, LTH],
        onClick: function () {
          open = !open;
          want = open ? OPEN : 0;
          pr.setStatus(open ? '敞开' : '关闭');
          PLR.audio.doorSwing(open);
        },
        press: function (p, down) {
          if (down) PLR.audio.resume();
        },
      });

      /* ---- the handle: rebuilt while hovered, so the brass lifts ---- */
      var HHY = 100, HRZ = LW - 9.5;
      var handle = scene.group(leaf, { name: 'doorHandle', p: [0, HHY, HRZ] });
      drawHandle(handle._g, app, pr);
      handle.behavior = {
        dynamic: true,
        build: function (n, gg) { drawHandle(gg, app, pr); },
      };

      /* ---- animation: the hinge angle, eased ---- */
      pr.setStatus('关闭');
      leaf.behavior = {
        update: function (dt) {
          ang = damp(ang, want, 3.3, dt);
          leaf.tf.yaw = ang;
          leaf.setTransform({ yaw: ang });
          leaf.touch();
        },
        post: function (node, renderer) { pr.hitRegion(renderer); },
      };
      leaf.touch();
      return leaf;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
