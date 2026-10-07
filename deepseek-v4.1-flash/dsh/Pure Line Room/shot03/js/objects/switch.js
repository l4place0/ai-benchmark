/* =========================================================================
   Pure Line Room — objects/switch.js
   The wall light switch beside the door (L.switchPlate), on the left wall: a
   chamfered plate with two screw heads and a faint finger scuff, and a rocker
   that tips about its own horizontal axis. Clicking flips the room light
   (app.state.toggleLight), clicks the matching sound, toasts the new mode and
   tips the rocker over on an eased damp.

   The plate's group is turned a quarter turn so its own +Z looks into the room
   (world +X): the plate is a prism through that axis, and the rocker a child
   group whose pitch is the tip. Detail lines are hairline faces — the renderer
   strokes every face outline, so a 0.25cm quad draws as a line.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;

  var X0 = L.x0;
  var CZ = L.switchPlate.cz, CY = L.switchPlate.cy;

  /* the plate (local x runs along the wall, local y up, local z into the room) */
  var PW = 4.4, PH = 4.4;        // half width / half height (an 8.8cm plate)
  var PC = 1.5;                  // corner chamfer
  var PD = 1.9;                  // how far the plate stands off the wall
  var RW = 2.5, RH = 2.5;        // rocker half width / half height
  var RC = 0.55;                 // rocker corner chamfer
  var RD = 0.75;                 // rocker half depth
  var PZ = PD + 0.8;             // the rocker's pivot, out from the wall
  var TILT = 0.17;               // how far the rocker tips, radians
  var SCREW = 3.5;               // screw centres, left and right of the rocker

  var SCUFF = { m: 'shadow', fill: '#1c1e26', fillOpacity: 0.09, strokeOpacity: 0 };
  var HAIR = { m: 'hair', strokeOpacity: 0.55 };

  /* ------------------------------- helpers ------------------------------- */
  /* A convex profile counter-clockwise in XY: an octagon with cut corners. */
  function oct(hw, hh, c) {
    return [
      [-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c],
      [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c],
    ];
  }

  /* A hairline quad on the plane z = Z, facing +Z (out of the left wall). */
  function lineZ(g, z, x0, y0, x1, y1, mat) {
    g.face([
      g.v(x0, y0, z), g.v(x1, y0, z), g.v(x1, y1, z), g.v(x0, y1, z),
    ], mat);
  }

  /* A hairline stroke of width w from (ax,ay) to (bx,by) on the plane z = Z. */
  function lineSeg(g, z, ax, ay, bx, by, w, mat) {
    var dx = bx - ax, dy = by - ay;
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = (-dy / l) * w, ny = (dx / l) * w;
    g.face([
      g.v(ax, ay, z), g.v(bx, by, z), g.v(bx + nx, by + ny, z), g.v(ax + nx, ay + ny, z),
    ], mat);
  }

  /* A polygon drawn as a ring of hairline quads (the profile is CCW). */
  function lineRing(g, z, pts, w, mat) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      lineSeg(g, z, a[0], a[1], b[0], b[1], w, mat);
    }
  }

  /* ------------------------------ the plate ------------------------------ */
  function drawPlate(g) {
    g.prism(oct(PW, PH, PC), 0, PD, 'white', { capMat: 'white', wallEdges: false });

    /* an inset line, so the plate reads as a moulded face rather than a slab */
    lineRing(g, PD + 0.03, oct(PW - 1.05, PH - 1.05, PC * 0.72), 0.22, { m: 'crease' });

    /* two screw heads: a small filled circle with a slot across it */
    for (var s = -1; s <= 1; s += 2) {
      var sx = s * SCREW;
      g.disc([sx, 0, PD + 0.03], 0.85, 'z', 'metal', 12);
      if (s < 0) lineSeg(g, PD + 0.05, sx - 0.55, 0, sx + 0.55, 0, 0.16, HAIR);
      else lineSeg(g, PD + 0.05, sx, -0.55, sx, 0.55, 0.16, HAIR);
    }

    /* a very faint scuff where a thumb rubs, low and left of the rocker */
    g.disc([0.75, -3.4, PD + 0.02], 0.95, 'z', SCUFF, 9);
    lineSeg(g, PD + 0.04, -0.5, -3.75, 1.5, -3.55, 0.2, HAIR);
    lineSeg(g, PD + 0.04, -0.35, -3.2, 1.35, -3.05, 0.16, HAIR);
  }

  /* ------------------------------ the rocker ----------------------------- */
  function drawRocker(g) {
    g.prism(oct(RW, RH, RC), -RD, RD, 'white', { capMat: 'white', wallEdges: false });
    lineRing(g, RD + 0.03, oct(RW - 0.62, RH - 0.62, RC * 0.7), 0.2, { m: 'crease' });
  }

  /* ================================ module =============================== */
  PLR.objects.switch = {
    id: 'lightswitch',
    build: function (app) {
      var scene = app.scene;

      /* the plate group: a quarter turn puts its +Z into the room */
      var plate = scene.group(scene.root, {
        name: 'switchPlate',
        p: [X0, CY, CZ],
        yaw: -Math.PI / 2,
      });
      var g = plate._g;
      var first = g.faces.length;
      drawPlate(g);
      for (var i = first; i < g.faces.length; i++) g.faces[i].hit = 'main';
      plate.touch();

      /* the rocker: its own group, tipped about the local X axis */
      var rocker = scene.group(plate, { name: 'switchRocker', p: [0, 0, PZ] });
      drawRocker(rocker._g);
      rocker.touch();

      /* the rocker follows the room light, which the clock and the switch both
         move, so it re-reads state.lightOn every frame */
      var ang = app.state.lightOn ? TILT : -TILT;
      var want = ang;

      var pr = PLR.interact.make(scene, plate, {
        id: 'lightswitch',
        label: '灯光开关',
        hit: 'main',
        hintDims: [PW * 2, PH * 2, PD + RD * 2],
        onClick: function () {
          var on = app.state.toggleLight();
          want = on ? TILT : -TILT;
          if (on) PLR.audio.switchOn(); else PLR.audio.switchOff();
          app.toast(on ? '灯光：开' : '灯光：关');
          pr.setStatus(on ? '开' : '关');
        },
        press: function (p, down) {
          if (down) PLR.audio.resume();
        },
      });
      pr.setStatus(app.state.lightOn ? '开' : '关');

      rocker.behavior = {
        update: function (dt) {
          want = app.state.lightOn ? TILT : -TILT;
          ang = damp(ang, want, 11, dt);
          rocker.tf.pitch = ang;
          rocker.setTransform({ pitch: ang });
          rocker.touch();
        },
      };
      plate.behavior = {
        post: function (node, renderer) {
          pr.setStatus(app.state.lightOn ? '开' : '关');
          pr.hitRegion(renderer);
        },
      };
      rocker.touch();
      return plate;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
