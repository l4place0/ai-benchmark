/* =========================================================================
   Pure Line Room — objects/clock.js
   The wall clock on the back wall (L.clock): a shallow turned case with a
   bevelled rim, a pale dial, sixty minute ticks (long ones every five), twelve
   short hour marks, a small brass bezel stud at the top and a little date
   window.

   The three hands are drawn in post() through renderer.overlay(fn) as real
   screen-space lines inside the dial, which is the only way to get a smooth
   sweep. They follow the real local time, read from app.state.clock(), which
   returns 12-hour form with fractional seconds.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;
  var clamp = PLR.math.clamp;

  var C = L.clock;
  var CX = C.cx, CY = C.cy, R = C.r;
  var CZ = L.z0;

  /* The case is a solid of revolution about Y, so the whole group is turned a
     quarter turn about X: local +Y becomes world +Z (out of the wall) and local
     +Z becomes world -Y. A profile ordered along +Y therefore builds outward
     from the wall, and a face whose normal points away from the lathe axis
     points out of the wall — exactly the winding the renderer wants. */
  var TURN = -Math.PI / 2;

  var DIAL = R - 6.6;      // radius of the pale dial
  var FACE = 4.45;         // depth in front of the wall of the printed marks
  var HANDSZ = 5.25;       // depth of the hands

  /* profile values are world distances measured out of the wall */
  function buildCase(node, g) {
    g.lathe([
      [R, 0],
      [R, 2.6],
      [R - 0.7, 4.2],
      [R - 2.6, 5.0],
      [R - 4.6, 4.9],
      [R - 6.4, 3.9],
      [0, 3.6],
    ], { segments: 34, mat: 'wood', edgeMat: 'fine', meridians: 8 });

    // the pale dial, sitting just inside the bevelled rim
    g.face(g.ringIds([0, 4.35, 0], DIAL, 'y', 44), 'paper');

    /* sixty minute ticks: every fifth is a long hour tick */
    for (var i = 0; i < 60; i++) {
      var a = (i / 60) * Math.PI * 2;
      var ca = Math.cos(a), sa = Math.sin(a);
      if ((i % 5) === 0) {
        g.edge(g.v(ca * (DIAL - 3.4), FACE, sa * (DIAL - 3.4)),
               g.v(ca * (DIAL + 1.2), FACE, sa * (DIAL + 1.2)), 'fine');
      } else {
        g.edge(g.v(ca * (DIAL - 1.7), FACE, sa * (DIAL - 1.7)),
               g.v(ca * (DIAL + 0.5), FACE, sa * (DIAL + 0.5)), 'hair');
      }
    }
    /* twelve short hour marks inboard of the long ones */
    for (var h = 0; h < 12; h++) {
      var ha = (h / 12) * Math.PI * 2;
      var hc = Math.cos(ha), hs = Math.sin(ha);
      g.edge(g.v(hc * (DIAL - 8.6), FACE, hs * (DIAL - 8.6)),
             g.v(hc * (DIAL - 6.2), FACE, hs * (DIAL - 6.2)), 'hair');
    }
    // the printed circle around the chapter ring, and the centre pin
    g.circleOutline([0, 4.42, 0], DIAL - 1.1, 'y', 'hair', 46);
    g.circleOutline([0, FACE, 0], 1.1, 'y', 'fine', 14);
  }

  function buildClock(app) {
    var node = app.scene.group(app.scene.root, {
      name: 'clock',
      p: [CX, CY, CZ],
      pitch: TURN,
      layer: 1,
    });
    buildCase(node, node._g);

    /* the bezel stud at twelve o'clock, standing proud of the rim */
    var stud = app.scene.group(node, {
      name: 'clockStud',
      p: [0, R - 1.4, 4.6],
    });
    stud._g.lathe([[0, 0], [1.35, 0], [1.75, 0.7], [1.75, 1.7], [0.95, 2.4], [0, 2.4]],
      { segments: 14, mat: 'brass', edgeMat: 'hair', meridians: 5 });

    var win = 0, wantWin = 0;      // date window easing

    /* ------------------------------------------------------------------ hands
       world point for a dial offset (u across, v up) */
    function dialPoint(u, v, z) {
      return [CX + u, CY + v, CZ + (z === undefined ? HANDSZ : z)];
    }

    function showDateWindow(o, t) {
      var w = 6.6 * t, h = 4.6 * t;
      if (w < 0.3) return;
      var cu = DIAL * 0.54;
      var z = CZ + 5.1;
      var x0 = CX + cu - w / 2, x1 = CX + cu + w / 2;
      var y0 = CY - h / 2, y1 = CY + h / 2;
      o.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], {
        fill: o.renderer.palette.paper.fill,
        fillAlpha: 0.96 * t + 0.04,
        stroke: o.renderer.palette.ink,
        strokeAlpha: 0.9 * t,
        width: 1.15,
      });
      // the date itself: two tiny bars
      o.seg([CX + cu - 1.2, CY - 1.0, z], [CX + cu + 0.5, CY - 1.0, z],
        { width: 0.5, alpha: 0.75 * t, color: o.renderer.palette.ink });
      o.seg([CX + cu - 1.2, CY + 1.0, z], [CX + cu + 1.2, CY + 1.0, z],
        { width: 0.5, alpha: 0.75 * t, color: o.renderer.palette.ink });
    }

    function drawHand(o, pts, color, alpha, width) {
      for (var i = 0; i < pts.length; i++) {
        if (!o.visible(pts[i])) return;   // skip if any endpoint is behind the camera
      }
      for (i = 0; i + 1 < pts.length; i++) {
        o.seg(pts[i], pts[i + 1], { color: color, alpha: alpha, width: width });
      }
    }

    var pr = PLR.interact.make(app.scene, node, {
      id: 'clock',
      label: '挂钟',
      hintDims: [R * 2, R * 2, 10],
      onClick: function (p) {
        wantWin = wantWin > 0.5 ? 0 : 1;
        PLR.audio.tick(true);
        PLR.audio.chime();
        p.setStatus(app.state.clockText());
      },
      press: function (p, down) { if (down) PLR.audio.resume(); },
      update: function (p, dt) { win = damp(win, wantWin, 6.5, dt); },
    });
    pr.setStatus(app.state.clockText());

    node.behavior = {
      post: function (n, renderer) {
        pr.setStatus(app.state.clockText());
        renderer.hitRegion(n);                 // every visible face of the case
        pr.hitRegion(renderer);                // hover outline and the label tag

        var c = app.state.clock();               // { h, m, s } in 12-hour form
        var th = (30 * (12 - (c.h % 12))) * Math.PI / 180;
        var tm = (6 * c.m) * Math.PI / 180;
        var ts = (6 * c.s) * Math.PI / 180;
        var ink = renderer.palette.ink;

        renderer.overlay(function (o) {
          showDateWindow(o, clamp(win, 0, 1));

          // hour hand — short, with a counterweight behind the pin
          drawHand(o, [
            dialPoint(-Math.sin(th) * 2.8, -Math.cos(th) * 2.8),
            dialPoint(0, 0),
            dialPoint(Math.sin(th) * (DIAL * 0.56), Math.cos(th) * (DIAL * 0.56)),
          ], ink, 0.95, 2.0);

          // minute hand — longer, lighter stroke
          drawHand(o, [
            dialPoint(-Math.sin(tm) * 3.4, -Math.cos(tm) * 3.4),
            dialPoint(0, 0),
            dialPoint(Math.sin(tm) * (DIAL * 0.82), Math.cos(tm) * (DIAL * 0.82)),
          ], ink, 0.95, 1.5);

          // second hand — thin, sweeping smoothly with the fractional second
          drawHand(o, [
            dialPoint(-Math.sin(ts) * 4.4, -Math.cos(ts) * 4.4),
            dialPoint(0, 0),
            dialPoint(Math.sin(ts) * (DIAL * 0.94), Math.cos(ts) * (DIAL * 0.94)),
          ], renderer.palette.accent.stroke, 0.9, 0.95);

          // brass centre boss over the hands
          o.circle([CX, CY, CZ + 5.4], 1.8, {
            axis: 'z', segments: 16,
            fill: renderer.palette.brass.fill, fillAlpha: 1,
            stroke: renderer.palette.brass.stroke, strokeAlpha: 1, width: 1.1,
          });
        });
      },
    };
    node.touch();
    return node;
  }

  PLR.objects.clock = {
    id: 'clock',
    build: function (app) {
      app.clockNode = buildClock(app);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
