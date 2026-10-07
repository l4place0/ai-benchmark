/* =========================================================================
   Pure Line Room — objects/sideboard.js
   The sideboard on the left wall (L.sideboard). It stands at x = L.x0 and its
   front faces +X, so "out of the room" is +X for every drawer.
   Parts:
     · one carcass: recessed plinth, small adjustable feet, side stiles, top
       rail, mid rail, a central stile, an interior floor and back panel
     · the top slab with a slight overhang at the ends and a lip just proud of
       the fronts, plus a shadow line beneath it
     · three drawers across the top, each in its own child group so it can slide
       out on its own. Front, dovetailed box, brass bar handle and reveal gap.
     · a cupboard under them: two leaves hinged on their outer stiles, meeting
       at the central stile, each easing open about a vertical hinge edge
   Five independent interaction proxies (§4): drawerA/B/C and cupboardL/R.

   The carcass is kept a little lower than the nominal sideboard height so the
   drawer fronts always clear the top slab's shadow at the room's eye height:
   the slab must never cover what the pointer is meant to click.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;

  var SB = L.sideboard;
  var H = 78;                       // total height
  var D = SB.d;                     // how far it reaches into the room (+X)
  var Z0 = SB.cz - SB.d / 2;        // back corner along the wall
  var Z1 = SB.cz + SB.d / 2;        // front corner along the wall

  var PLINTH = 6;                   // plinth height (adjustable feet live here)
  var SLAB = 4;                     // top slab thickness
  var BODY = H - SLAB;
  var RAIL = 8;                     // top rail under the slab
  var MIDY = 36;                    // underside of the drawer bank / cupboard top
  var TOPY = BODY - RAIL;

  /* drawer bank: three across, side stiles and reveals */
  var DRAWER_FRONT = 3.2;           // how far the front stands proud of the box
  var DR_H0 = TOPY - 17.5, DR_H1 = TOPY - 1.0;
  var DR_SX0 = 4.2, DR_SX1 = 72.6;
  var DR_STILE = 2.6, DR_GAP = 2.2;
  var DR_W = (DR_SX1 - DR_SX0 - DR_STILE * 2 - DR_GAP * 2) / 3;
  var DR_DEPTH = 60;                // the box inside the carcass
  var DR_SLIDE = DR_DEPTH * 0.70;   // how far it comes out

  /* cupboard */
  var CD_Y0 = PLINTH + 2, CD_Y1 = MIDY - 1;
  var CD_SX0 = 4.2, CD_SX1 = 81.8, CD_GAP = 2.2;
  var CD_X0 = -2, CD_X1 = 1.8, CD_T = CD_X1 - CD_X0;

  /* ------------------------------ static box ------------------------------ */
  /* g.box handles the winding for us: the +X faces come out facing the room. */
  function carcass(node, g) {
    // back panel, interior floor and the top of the body
    g.box(0, PLINTH, Z0 + 2, 4, BODY, Z1 - 2, 'woodDark', 'hair');
    g.box(0, PLINTH, Z0, 30, MIDY + 2, Z1, 'wood', 'hair');
    g.box(0, TOPY, Z0, 5, BODY, Z1, 'wood', 'hair');

    // side stiles, top rail and the mid rail under the drawer bank
    g.box(0, PLINTH, Z0, 30, BODY, Z0 + 4, 'wood');
    g.box(0, PLINTH, Z1 - 4, 30, BODY, Z1, 'wood');
    g.box(0, TOPY, Z0, 30, BODY, Z1, 'wood');
    g.box(0, MIDY, Z0, 30, MIDY + 2, Z1, 'wood');
    // vertical divider between the drawer bank and the cupboard below
    g.box(2, PLINTH + 2, Z0 + 3, 5, MIDY, Z1 - 3, 'woodDark', 'hair');

    // stiles between and beside the drawers
    g.box(0, DR_H0 - 1.5, Z0 + 4, 3, DR_H1 + 1.5, Z0 + 4 + DR_STILE, 'wood');
    g.box(0, DR_H0 - 1.5, Z1 - 4 - DR_STILE, 3, DR_H1 + 1.5, Z1 - 4, 'wood');
    g.box(0, DR_H0 - 1.5, DR_SX0 - DR_STILE, 3, DR_H1 + 1.5, DR_SX0, 'wood');
    g.box(0, DR_H0 - 1.5, DR_SX0 + DR_W, 3, DR_H1 + 1.5, DR_SX0 + DR_W + DR_STILE, 'wood');
    g.box(0, DR_H0 - 1.5, DR_SX0 + DR_W + DR_STILE + DR_GAP, 3, DR_H1 + 1.5,
      DR_SX0 + 2 * DR_W + DR_STILE + DR_GAP, 'wood');
    g.box(0, DR_H0 - 1.5, DR_SX0 + 2 * (DR_W + DR_STILE + DR_GAP), 3, DR_H1 + 1.5,
      DR_SX0 + 2 * DR_W + 2 * DR_STILE + DR_GAP, 'wood');

    // the central stile the two cupboard leaves meet against
    g.box(0, CD_Y0 - 1, CD_SX0 + DR_W + DR_STILE + DR_GAP - 1.1, 2.6, CD_Y1 + 1,
      CD_SX0 + DR_W + DR_STILE + DR_GAP + 1.1, 'wood');

    // recessed plinth with a moulded top edge
    g.box(4, PLINTH - 2, Z0 + 4, 30, PLINTH, Z1 - 4, 'woodDark', 'hair');
    g.box(0, 0, Z0, 30, PLINTH - 2, Z1, 'wood');

    // top slab: a small overhang at the ends, its front lip just proud of the
    // carcass front, and a shadow line under the whole edge
    g.box(0, BODY, Z0 - 2, D - 10, H, Z1 + 2, 'wood');
    g.box(0, BODY - 1.3, Z0 - 1.5, D - 12, BODY, Z1 + 1.5, 'woodDark', 'hair');
  }

  /* ------------------------- small adjustable feet ------------------------ */
  function foot(node, g, x, z) {
    g.boxAt(x, PLINTH - 2.4, z, 3.4, 3.6, 3.4, 'metal', 'hair');
    g.boxAt(x, 0.9, z, 5.4, 1.8, 5.4, 'metal', 'hair');
    g.circleOutline([x, 0.9, z], 2.0, 'y', 'hair', 12);
  }

  /* --------------------------------- drawers ------------------------------ */
  function buildDrawer(app, parent, i) {
    var z0 = DR_SX0 + i * (DR_W + DR_STILE + DR_GAP);
    var z1 = z0 + DR_W;
    var y0 = DR_H0, y1 = DR_H1;
    var slide = 0, want = 0;

    var node = app.scene.group(parent, { name: 'sideboardDrawer' + i, layer: 3 });
    var g = node._g;

    // the box that rides in the carcass
    g.box(-2, y0 + 1.2, z0 + 1.4, D - 34, y1 - 1.2, z1 - 1.4, 'woodDark');
    // the reveal frame that travels with the box
    g.box(-2, y0 + 1.2, z0 + 1.4, DRAWER_FRONT, y0 + 2.6, z1 - 1.4, 'woodDark', 'hair');
    g.box(-2, y1 - 2.6, z0 + 1.4, DRAWER_FRONT, y1 - 1.2, z1 - 1.4, 'woodDark', 'hair');
    g.box(-2, y0 + 1.2, z0 + 1.4, DRAWER_FRONT, y1 - 1.2, z0 + 2.8, 'woodDark', 'hair');
    g.box(-2, y0 + 1.2, z1 - 2.8, DRAWER_FRONT, y1 - 1.2, z1 - 1.4, 'woodDark', 'hair');
    // runner rails it slides on
    g.box(2, y1 - 4.6, z0 + 1.4, D - 30, y1 - 3.6, z0 + 2.6, 'woodDark', 'hair');
    g.box(2, y1 - 4.6, z1 - 2.6, D - 30, y1 - 3.6, z1 - 1.4, 'woodDark', 'hair');

    // tapered dovetails down the visible +Z side of the box
    var teeth = 7, span = z1 - 1.4 - (z0 + 1.4);
    for (var k = 0; k < teeth; k++) {
      var t0 = (z0 + 1.4) + span * (k / teeth);
      var t1 = (z0 + 1.4) + span * ((k + 1) / teeth);
      var tA = (k % 2 === 0) ? t0 + span * 0.012 : t0 + span * 0.05;
      var tB = (k % 2 === 0) ? t1 - span * 0.05 : t1 - span * 0.012;
      g.edge(g.v(D - 34.2, y0 + 1.6, tA), g.v(D - 34.2, y1 - 1.6, tA), 'fine');
      g.edge(g.v(D - 34.2, y1 - 1.6, tA), g.v(D - 34.2, y1 - 1.6, tB), 'fine');
      g.edge(g.v(D - 34.2, y1 - 1.6, tB), g.v(D - 34.2, y0 + 1.6, tB), 'fine');
    }
    // the grooved bottom of the box
    g.edge(g.v(-2, y0 + 3.6, z0 + 1.4), g.v(D - 34, y0 + 3.6, z0 + 1.4), 'hair');
    g.edge(g.v(-2, y0 + 3.6, z1 - 1.4), g.v(D - 34, y0 + 3.6, z1 - 1.4), 'hair');

    // the front, standing proud with a raised panel line
    g.box(-2, y0, z0, DRAWER_FRONT, y1, z1, 'wood');
    g.box(DRAWER_FRONT - 0.3, y0 + 2.4, z0 + 2.4, DRAWER_FRONT + 0.05, y1 - 2.4, z1 - 2.4, 'woodSoft');
    // brass bar handle on two posts
    var zc = (z0 + z1) / 2;
    g.box(DRAWER_FRONT + 0.10, (y0 + y1) / 2 - 0.55, zc - 11.2, DRAWER_FRONT + 3.3, (y0 + y1) / 2 + 0.55, zc + 11.2, 'brass');
    g.box(DRAWER_FRONT + 0.05, (y0 + y1) / 2 - 0.5, zc - 10.0, DRAWER_FRONT + 1.1, (y0 + y1) / 2 + 0.5, zc - 8.6, 'brass', 'hair');
    g.box(DRAWER_FRONT + 0.05, (y0 + y1) / 2 - 0.5, zc + 8.6, DRAWER_FRONT + 1.1, (y0 + y1) / 2 + 0.5, zc + 10.0, 'brass', 'hair');

    var pr = PLR.interact.make(app.scene, node, {
      id: 'drawer' + 'ABC'.charAt(i),
      label: '抽屉',
      hintDims: [DR_DEPTH, y1 - y0, DR_W],
      onClick: function (p) {
        want = want > 0.5 ? 0 : 1;
        if (want) { PLR.audio.drawerOpen(); p.setStatus('拉开 · 黄铜拉手'); }
        else { PLR.audio.drawerClose(); p.setStatus('合上'); }
      },
      press: function (p, down) { if (down) PLR.audio.resume(); },
    });
    pr.setStatus('合上');

    node.behavior = {
      dynamic: true,
      update: function (dt) {
        slide = damp(slide, want, want ? 3.4 + i * 0.25 : 4.4 + i * 0.3, dt);
        node.tf.p[0] = slide * DR_SLIDE;
        node.touch();
      },
      post: function (n, renderer) {
        renderer.hitRegion(n);            // every visible face of this drawer
        pr.hitRegion(renderer);           // hover outline and the label tag
      },
    };
    node.touch();
    return node;
  }

  /* --------------------------------- doors -------------------------------- */
  function buildDoor(app, parent, side) {
    var zLo = side < 0 ? CD_SX0 : CD_SX0 + (CD_SX1 - CD_SX0 + CD_GAP) / 2;
    var zHi = zLo + (CD_SX1 - CD_SX0 - CD_GAP) / 2;
    var hz = side < 0 ? zLo : zHi;          // hinge edge, on the outer stile
    var y0 = CD_Y0, y1 = CD_Y1;
    var open = 0, want = 0;

    // local space: the hinge axis is the local Y axis, the leaf hangs along -Z
    var node = app.scene.group(parent, {
      name: side < 0 ? 'sideboardDoorL' : 'sideboardDoorR',
      layer: 3,
      p: [0, 0, hz],
    });
    var g = node._g;

    var zA = zLo - (side < 0 ? 0 : hz), zB = zHi - (side < 0 ? 0 : hz);
    // leaf, slightly proud of the carcass front
    g.box(CD_X0, y0, zA, CD_X1, y1, zB, 'wood');
    // recessed panel with a raised field
    g.box(CD_X1 - 0.3, y0 + 3.4, zA + 3.4, CD_X1 + 0.05, y1 - 3.4, zB - 3.4, 'woodSoft');
    // hinge knuckles on the hinge stile
    g.box(CD_X1, y0 + 1.6, zA - 0.3, CD_X1 + 1.1, y0 + 3.2, zA + 1.1, 'brass', 'hair');
    g.box(CD_X1, y1 - 3.2, zA - 0.3, CD_X1 + 1.1, y1 - 1.6, zA + 1.1, 'brass', 'hair');

    // small brass knob near the free edge
    var kz = zB - 1.6;
    g.boxAt(CD_X1 + 0.35, (y0 + y1) / 2, kz, 1.4, 2.6, 2.6, 'brass', 'hair');
    g.circleOutline([CD_X1 + 1.15, (y0 + y1) / 2, kz], 1.05, 'x', 'fine', 12);

    var pr = PLR.interact.make(app.scene, node, {
      id: side < 0 ? 'cupboardL' : 'cupboardR',
      label: '柜门',
      hintDims: [CD_T, y1 - y0, Math.abs(zB - zA)],
      onClick: function (p) {
        want = want > 0.5 ? 0 : 1;
        PLR.audio.doorSwing(want > 0.5);
        p.setStatus(want > 0.5 ? '敞开' : '关闭');
      },
      press: function (p, down) { if (down) PLR.audio.resume(); },
    });
    pr.setStatus('关闭');

    node.behavior = {
      dynamic: true,
      update: function (dt) {
        open = damp(open, want, 2.0, dt);
        node.tf.yaw = -side * open * 1.92;
        node.touch();
      },
      post: function (n, renderer) {
        renderer.hitRegion(n);            // every visible face of this leaf
        pr.hitRegion(renderer);           // hover outline and the label tag
      },
    };
    node.touch();
    return node;
  }

  /* -------------------------- things for scale ---------------------------- */
  function buildScaleProps(app, parent) {
    // two books lying on the slab
    var b1 = app.scene.group(parent, { name: 'sideboardBook1', p: [16, H + 1.3, 28], yaw: 0.34 });
    b1._g.box(-11, -1.3, -9, 11, 1.3, 9, 'paper');
    b1._g.box(11.2, -1.1, -8.4, 12.4, 1.1, 8.4, 'fabric2', 'hair');
    b1._g.edge(b1._g.v(-11, 1.3, 0), b1._g.v(11, 1.3, 0), 'hair');

    var b2 = app.scene.group(parent, { name: 'sideboardBook2', p: [16, H + 3.6, 30], yaw: -0.19 });
    b2._g.box(-9.5, -1.1, -8, 9.5, 1.1, 8, 'accent');
    b2._g.box(9.7, -0.9, -7.4, 11.2, 0.9, 7.4, 'fabric2', 'hair');
    b2._g.edge(b2._g.v(-9.5, 1.1, 0), b2._g.v(9.5, 1.1, 0), 'hair');

    // a shallow bowl, further along the slab
    var bowl = app.scene.group(parent, { name: 'sideboardBowl', p: [46, H, 60] });
    var bg = bowl._g;
    bg.lathe([
      [0, 0.2],
      [2.6, 0.35],
      [6.0, 1.5],
      [8.3, 3.7],
      [9.0, 6.2],
      [8.9, 6.5],
      [8.0, 6.3],
      [7.3, 4.0],
      [5.3, 1.9],
      [2.4, 1.1],
      [0, 1.0],
    ], { segments: 22, mat: 'white', edgeMat: 'fine', meridians: 8 });
    bg.circleOutline([0, 0.25, 0], 3.1, 'y', 'hair', 14);
    bg.lathe([[4.6, -0.8], [5.5, -0.55], [5.5, 0.15], [4.6, 0.15]],
      { segments: 20, mat: 'whiteSoft', edges: false, caps: false, edgeMat: null });
    bg.circleOutline([0, -0.85, 0], 5.2, 'y', 'hair', 20);
  }

  /* --------------------------------- module ------------------------------- */
  PLR.objects.sideboard = {
    id: 'sideboard',
    build: function (app) {
      var scene = app.scene;
      // local +X runs into the room, so the carcass stands hard against the wall
      var node = scene.group(scene.root, { name: 'sideboard', p: [L.x0, 0, 0] });
      var g = node._g;

      carcass(node, g);
      foot(node, g, 9, 8);
      foot(node, g, 9, 84);
      foot(node, g, D - 8, 8);
      foot(node, g, D - 8, 84);

      // the carcass answers the pointer only where no front covers it
      var pr = PLR.interact.make(scene, node, {
        id: 'sideboard',
        label: '边柜',
        hintDims: [D, H, Z1 - Z0 + 4],
        onClick: function (p) { PLR.audio.woodTap(180); p.setStatus('实木柜体'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
      });
      pr.setStatus('实木柜体');
      node.behavior = {
        post: function (n, renderer) {
          renderer.hitRegion(n);
          pr.hitRegion(renderer);
        },
      };

      // the moving parts share one mount so the whole sideboard stays together
      var mount = scene.group(scene.root, { name: 'sideboardMount', p: [L.x0, 0, 0] });
      for (var i = 0; i < 3; i++) buildDrawer(app, mount, i);
      buildDoor(app, mount, -1);
      buildDoor(app, mount, 1);
      buildScaleProps(app, mount);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
