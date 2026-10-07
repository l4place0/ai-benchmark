/* =========================================================================
   Pure Line Room — objects/window.js
   The window: plaster reveal, frame, sash bars, glass, sill and apron, plus a
   venetian blind that tilts and lifts, and a curtain that is drawn aside.
   Two interactive objects (see INTERFACES.md §4):
     · the blind   — open -> blades shut -> lifted, by successive clicks
     · the curtain — drawn aside / closed, eased
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var lerp = PLR.math.lerp;
  var damp = PLR.math.ease.damp;

  var WIN = L.window;
  var WX0 = WIN.cx - WIN.w / 2, WX1 = WIN.cx + WIN.w / 2;
  var WY0 = WIN.y0, WY1 = WIN.y1;
  var WZ = L.z0;

  /* --------------------------- static woodwork ---------------------------- */
  function buildFrame(app) {
    var t = 7;          // how far the frame sits proud of the wall
    var b = 9;          // frame board width
    var node = app.scene.group(app.scene.root, { name: 'windowFrame', keyOverride: -9e5 });
    var g = node._g;

    // plaster reveal around the opening
    g.box(WX0 - 3, WY0 - 3, WZ, WX1 + 3, WY0, WZ + t, 'trim', 'hair');
    g.box(WX0 - 3, WY1, WZ, WX1 + 3, WY1 + 3, WZ + t, 'trim', 'hair');
    g.box(WX0 - 3, WY0, WZ, WX0, WY1, WZ + t, 'trim', 'hair');
    g.box(WX1, WY0, WZ, WX1 + 3, WY1, WZ + t, 'trim', 'hair');

    // outer frame boards
    g.box(WX0, WY0, WZ + 1, WX1, WY0 + b, WZ + t, 'wood');
    g.box(WX0, WY1 - b, WZ + 1, WX1, WY1, WZ + t, 'wood');
    g.box(WX0, WY0 + b, WZ + 1, WX0 + b, WY1 - b, WZ + t, 'wood');
    g.box(WX1 - b, WY0 + b, WZ + 1, WX1, WY1 - b, WZ + t, 'wood');

    // inner sash: two lights with a meeting rail and muntins
    var ix0 = WX0 + b, ix1 = WX1 - b, iy0 = WY0 + b, iy1 = WY1 - b;
    var midY = (iy0 + iy1) / 2;
    var mw = 4, cx = (WX0 + WX1) / 2;
    g.box(ix0, midY - mw, WZ + 3, ix1, midY + mw, WZ + 6, 'whiteSoft');
    g.box(cx - mw / 2, iy0, WZ + 3, cx + mw / 2, midY - mw, WZ + 6, 'whiteSoft');
    g.box(cx - mw / 2, midY + mw, WZ + 3, cx + mw / 2, iy1, WZ + 6, 'whiteSoft');
    g.box(ix0, iy0, WZ + 3, ix1, iy0 + 3, WZ + 6, 'whiteSoft');
    g.box(ix0, iy1 - 3, WZ + 3, ix1, iy1, WZ + 6, 'whiteSoft');
    g.box(ix0, iy0, WZ + 3, ix0 + 3, iy1, WZ + 6, 'whiteSoft');
    g.box(ix1 - 3, iy0, WZ + 3, ix1, iy1, WZ + 6, 'whiteSoft');

    // glass, set back behind the sash
    var gp = [
      g.v(ix0, iy0, WZ + 2.2), g.v(ix1, iy0, WZ + 2.2),
      g.v(ix1, iy1, WZ + 2.2), g.v(ix0, iy1, WZ + 2.2),
    ];
    g.face(gp, 'glass');
    g.ring(gp, 'fine');

    // sill and apron
    g.box(WX0 - 14, WY0 - 8, WZ, WX1 + 14, WY0 - 3, WZ + 16, 'wood');
    g.box(WX0 - 11, WY0 - 26, WZ, WX1 + 11, WY0 - 8, WZ + 5, 'whiteSoft');
    // a small bracket under each end of the sill
    var bz = WZ + 12;
    for (var sb = -1; sb <= 1; sb += 2) {
      var bx = (WX0 - 14 + 12) * (sb < 0 ? 1 : 0) + (WX1 + 14 - 12) * (sb < 0 ? 0 : 1);
      g.box(bx - 5, WY0 - 30, WZ, bx + 5, WY0 - 8, bz, 'whiteSoft', 'hair');
    }
    return node;
  }

  /* ------------------------------ the blind ------------------------------- */
  /* Closures keep the animation state, the geometry and the interaction proxy
     together; the group's behavior object is just the engine callback surface. */
  function makeBlind(app) {
    var x0 = WX0 + 7, x1 = WX1 - 7, span = x1 - x0;
    var top = WY1 - 7, bottom = WY0 + 12;
    var slats = 17;
    var tilt = 0.07, lift = 0;
    var wantTilt = 0.07, wantLift = 0;
    var step = 0;
    var stagger = 0;

    function angleOf(u) { return lerp(0.07, 1.50, u); }

    function draw(node, g) {
      // head rail and bracket
      g.box(x0 - 6, top - 4, WZ + 8, x1 + 6, top + 3, WZ + 15, 'whiteSoft');
      g.box(x0 - 3, top + 3, WZ + 9, x1 + 3, top + 6, WZ + 14, 'metal', 'hair');
      g.circleOutline([x0 - 4, top + 4.5, WZ + 13], 2.2, 'z', 'fine', 10);
      g.circleOutline([x1 + 4, top + 4.5, WZ + 13], 2.2, 'z', 'fine', 10);

      var hangTop = top - 7;
      var hang = bottom + (hangTop - bottom) * (1 - lift);
      var ang = angleOf(tilt);
      var proj = Math.cos(ang) * 5.6;
      var drop = Math.sin(ang) * 5.6;
      var zc = WZ + 11;

      for (var i = 0; i < slats; i++) {
        var v = (i + 0.5) / slats;
        var y = hangTop - (hangTop - hang) * v;
        if (y < bottom) continue;
        var ids = [
          g.v(x0, y + drop, zc + proj),
          g.v(x1, y + drop, zc + proj),
          g.v(x1, y, zc),
          g.v(x0, y, zc),
        ];
        g.face(ids, 'whiteSoft', { name: 'slat' });
        g.edge(ids[0], ids[1], 'fine');
        if (i % 3 === 0) g.edge(ids[2], ids[3], 'hair');
      }

      // lift cords
      var cordZ = zc + 1.4;
      for (var c = 0; c < 3; c++) {
        var cx = x0 + 13 + (span - 26) * (c / 2);
        g.edge(g.v(cx, hangTop, cordZ - 1.4), g.v(cx, hang + 1, cordZ - 1.4), 'hidden');
      }
      // head cord and tassel
      g.edge(g.v((x0 + x1) / 2, top + 3, WZ + 13), g.v((x0 + x1) / 2, top - 14, WZ + 15), 'fine');
      g.circleOutline([(x0 + x1) / 2, top - 17, WZ + 15], 3, 'z', 'whiteSoft', 10);

      // bottom rail
      g.box(x0 - 4, hang - 4, WZ + 9, x1 + 4, hang, WZ + 14, 'whiteSoft');
    }

    var node = app.scene.group(app.scene.root, { name: 'blinds', layer: 1 });
    var pr = PLR.interact.make(app.scene, node, {
      id: 'blinds',
      label: '百叶帘',
      hintDims: [WIN.w, WIN.y1 - WIN.y0, 22],
      onClick: function (p) {
        step = (step + 1) % 3;
        if (step === 0) {
          wantTilt = 0.07; wantLift = 0; stagger = 0.35;
          app.state.blindsOpen = true;
          status('放平 · 见风景');
          PLR.audio.blindRustle(true);
        } else if (step === 1) {
          wantTilt = 1; wantLift = 0; stagger = 0.5;
          app.state.blindsOpen = false;
          status('叶片闭合');
          PLR.audio.blindRustle(false);
        } else {
          wantTilt = 1; wantLift = 0.9; stagger = 0.7;
          app.state.blindsOpen = false;
          status('整幅拉起');
          PLR.audio.blindRustle(true);
        }
      },
      press: function (p, down) {
        if (down) PLR.audio.resume();
      },
    });
    function status(s) { pr.setStatus(s); }

    node.behavior = {
      dynamic: true,
      init: function (n, g) { draw(n, g); },
      build: function (n, g) { draw(n, g); },
      update: function (dt, t) {
        if (stagger > 0) { stagger = Math.max(0, stagger - dt); }
        var speed = 5.0 - stagger * 4.0;
        tilt = damp(tilt, wantTilt, speed, dt);
        lift = damp(lift, wantLift, 3.1 - stagger * 1.2, dt);
      },
      post: function () { pr.hitRegion(app.renderer); },
    };
    node.touch();
    return node;
  }

  /* ----------------------------- the curtain ------------------------------ */
  function makeCurtain(app) {
    var x0 = WX0 - 6, x1 = WX1 + 6;
    var y0 = WY0 - 6, y1 = WY1 + 10;
    var zc = WZ + 21;
    var folds = 14;
    var slide = 0, wantSlide = 0, phase = 0;

    function draw(node, g) {
      var railZ = zc + 5;
      g.box(x0 - 10, y1 + 2, railZ - 4, x1 + 10, y1 + 6, railZ + 4, 'metal', 'hair');
      for (var k = 0; k <= 12; k++) {
        var rx = x0 - 10 + (x1 - x0 + 20) * (k / 12);
        g.circleOutline([rx, y1 + 4, railZ], 1.5, 'z', 'hair', 8);
      }
      g.circleOutline([x0 - 12, y1 + 4, railZ], 3, 'z', 'fine', 12);
      g.circleOutline([x1 + 12, y1 + 4, railZ], 3, 'z', 'fine', 12);

      var full = (x1 - x0) * 0.5;
      var width = full * (1 - slide * 0.88);
      if (width < 3) return;
      for (var s = -1; s <= 1; s += 2) {
        var fx0 = s < 0 ? x0 : x1 - width;
        var top = [], bot = [];
        for (var i = 0; i <= folds; i++) {
          var f = i / folds;
          var x = fx0 + width * f;
          var wave = Math.sin(f * Math.PI * 3.2 + phase * 0.6 + (s < 0 ? 0 : 1.2));
          var depth = 4.2 + wave * 2.8;
          var hem = 0.18 + 0.82 * (1 - slide);
          top.push(g.v(x, y1, zc + depth * 0.35));
          bot.push(g.v(x, y0 + (y1 - y0) * 0.02, zc + depth * (0.55 + 0.45 * hem)));
        }
        for (var q = 0; q < folds; q++) {
          g.face([top[q], top[q + 1], bot[q + 1], bot[q]], 'fabric', { name: 'curtain', hit: 'main' });
          g.edge(top[q], bot[q], q % 2 ? 'hair' : 'fine');
        }
        g.edge(top[0], bot[0], 'fine');
        g.edge(top[folds], bot[folds], 'sil');
        // tieback band when the curtain is gathered
        if (slide > 0.25) {
          var mx = fx0 + width * 0.85;
          g.edge(g.v(mx - 5, y1 - (y1 - y0) * 0.46, zc + 5), g.v(mx + 5, y1 - (y1 - y0) * 0.46, zc + 5), 'brass');
        }
      }
    }

    var node = app.scene.group(app.scene.root, { name: 'curtain', layer: 2 });
    var pr = PLR.interact.make(app.scene, node, {
      id: 'curtain',
      label: '窗帘',
      hintDims: [WIN.w, WIN.y1 - WIN.y0, 26],
      onClick: function () {
        wantSlide = wantSlide > 0.5 ? 0 : 1;
        app.state.curtainOpen = wantSlide < 0.5;
        pr.setStatus(wantSlide < 0.5 ? '拉开 · 采光' : '合拢 · 遮光');
        PLR.audio.curtainSweep(wantSlide < 0.5);
      },
    });

    node.behavior = {
      dynamic: true,
      init: function (n, g) { draw(n, g); },
      build: function (n, g) { draw(n, g); },
      update: function (dt) {
        slide = damp(slide, wantSlide, 2.5, dt);
        phase += dt;
      },
      post: function () { pr.hitRegion(app.renderer); },
    };
    node.touch();
    return node;
  }

  PLR.objects.window = {
    id: 'window',
    build: function (app) {
      buildFrame(app);
      app.blindNode = makeBlind(app);
      app.curtainNode = makeCurtain(app);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
