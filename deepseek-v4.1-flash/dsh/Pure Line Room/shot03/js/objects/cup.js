/* =========================================================================
   Pure Line Room — objects/cup.js
   The ceramic mug on the desk at L.deskItems.cup: a lathed body with a rim and
   a foot ring, a strap handle swept from small prism segments along a Bezier
   arc, a saucer disc underneath, a tea surface inside the rim and a few fine
   horizontal creases on the body.

   Steam is drawn in post() through renderer.overlay(fn) as wispy vertical
   curves that drift, wobble and fade — the alpha is varied along each curve and
   the wisps continuously regenerate, so the plume never repeats obviously.

   Interaction: a click makes the mug hop, sloshes the tea inside it and
   intensifies the steam for a few seconds.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;
  var clamp = PLR.math.clamp;
  var hash01 = PLR.math.hash01;

  var CU = L.deskItems.cup;
  var CX = CU[0], CZ = CU[1];
  var TOP = L.deskTop;

  var RIM_Y = 8.4;          // height of the rim above the desk top
  var TEA_Y = 6.9;          // the tea surface
  var TEA_R = 3.02;

  /* -------------------------------- the body ------------------------------ */
  /* A mug with a real thickness: outer wall up, over the rim, inner wall down.
     The lathe profile runs along +Y, so its normals face outward and its caps
     face down at the foot and up at the rim — the winding the renderer wants. */
  function buildBody(node, g) {
    g.lathe([
      [3.02, 0.30],     // foot ring, underside
      [3.28, 0.42],
      [3.62, 1.05],     // flare into the body
      [3.50, 2.60],
      [3.52, 4.40],
      [3.60, 6.40],
      [3.58, RIM_Y - 0.35],
      [3.30, RIM_Y],    // over the rim
      [3.05, RIM_Y - 0.18],
      [3.00, 6.30],     // inner wall
      [2.98, 4.20],
      [3.00, 2.40],
      [3.02, 1.60],
      [0, 1.45],        // the bottom of the well
    ], { segments: 28, mat: 'white', edgeMat: 'fine', meridians: 1 });

    // fine horizontal creases thrown on the way up
    var creases = [[3.545, 3.0], [3.552, 4.6], [3.575, 5.8], [3.485, 2.2]];
    for (var i = 0; i < creases.length; i++) {
      g.circleOutline([0, creases[i][1], 0], creases[i][0] + 0.04, 'y', i === 3 ? 'hair' : 'fine', 30);
    }
    // the tight turn of the foot ring
    g.circleOutline([0, 0.36, 0], 3.2, 'y', 'fine', 28);
    g.circleOutline([0, 0.30, 0], 2.55, 'y', 'hair', 22);
  }

  /* --------------------------------- handle ------------------------------- */
  /* A Bezier arc swung out on the rim side that faces the room, swept as small
     box prisms so the line work stays crisp. */
  function buildHandle(node, g) {
    function bez(t) {
      var mt = 1 - t;
      var y = mt * mt * 1.9 + 2 * mt * t * 4.3 + t * t * 6.6;
      var z = mt * mt * 3.30 + 2 * mt * t * 7.15 + t * t * 3.30;
      return [0, y, z];
    }
    var N = 9;
    for (var i = 0; i < N; i++) {
      var a = bez(i / N), b = bez((i + 1) / N);
      var my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      var dy = b[1] - a[1], dz = b[2] - a[2];
      var len = Math.sqrt(dy * dy + dz * dz);
      // longer collars at the two ends, where the strap grips the body
      var wide = (i === 0 || i === N - 1) ? 1.15 : 0.58;
      g.boxAt(0, my, mz, 1.02, len + 0.30, wide * 2, 'white');
      if (i % 3 === 1) g.circleOutline([0, my, mz], 0.62, 'y', 'hair', 12);
    }
    g.circleOutline([0, 1.9, 3.42], 0.75, 'y', 'fine', 14);
    g.circleOutline([0, 6.6, 3.42], 0.75, 'y', 'fine', 14);
  }

  /* -------------------------------- the saucer ---------------------------- */
  function buildSaucer(app) {
    var node = app.scene.group(app.scene.root, { name: 'cupSaucer', p: [CX, TOP, CZ] });
    var g = node._g;

    g.lathe([
      [0, 0.28],
      [2.4, 0.42],
      [4.6, 0.86],
      [6.05, 1.50],
      [6.45, 1.86],
      [6.55, 2.02],
      [6.48, 2.10],
      [5.95, 1.80],
      [4.5, 1.24],
      [2.3, 0.92],
      [0, 0.80],
    ], { segments: 34, mat: 'whiteSoft', edgeMat: 'fine', meridians: 8 });
    g.circleOutline([0, 0.90, 0], 3.72, 'y', 'hair', 30);
    g.circleOutline([0, 2.02, 0], 6.50, 'y', 'fine', 34);

    var pr = PLR.interact.make(app.scene, node, {
      id: 'cupSaucer',
      label: '杯碟',
      hintDims: [13, 3, 13],
      press: function (p, down) { if (down) PLR.audio.resume(); },
      onClick: function (p) {
        PLR.audio.cupClink();
        p.setStatus('陶瓷');
      },
    });
    pr.setStatus('陶瓷');
    node.behavior = { post: function (n, renderer) { renderer.hitRegion(n); pr.hitRegion(renderer); } };
    return node;
  }

  /* --------------------------------- the mug ------------------------------ */
  function buildCup(app) {
    var node = app.scene.group(app.scene.root, { name: 'cup', p: [CX, TOP, CZ], layer: 2 });
    var g = node._g;

    var slosh = 0, hop = 0, hopT = 0, hopOn = 0, burst = 0;

    /* the tea surface is rebuilt every frame so it can slosh, which means the
       whole mesh is re-authored: the body and handle go in again here too. */
    function author(gg) {
      buildBody(node, gg);
      buildHandle(node, gg);

      var ids = [], seg = 26, i;
      for (i = 0; i < seg; i++) {
        var a = (i / seg) * Math.PI * 2;
        var bow = Math.sin(a) * slosh * 0.55;
        ids.push(gg.v(Math.cos(a) * TEA_R, TEA_Y + bow, Math.sin(a) * TEA_R));
      }
      gg.face(ids, 'paper');
      gg.ring(ids, 'fine');
      gg.circleOutline([0, TEA_Y + 0.55, 0], 3.0, 'y', 'hair', 26);
    }
    author(g);

    /* ------------------------------ the steam ----------------------------- */
    var wisps = [];
    function resetWisp(w, seed) {
      w.seed = seed;
      w.x0 = (hash01(seed * 3.1 + 1.7) - 0.5) * 4.4;
      w.z0 = (hash01(seed * 7.3 + 2.9) - 0.5) * 4.4;
      w.len = 22 + hash01(seed * 5.5 + 4.1) * 18;
      w.phase = hash01(seed * 11.3 + 0.3) * 6.28;
      w.freq = 0.55 + hash01(seed * 2.7 + 6.1) * 0.75;
      w.amp = 1.3 + hash01(seed * 9.1 + 3.3) * 1.9;
      w.speed = 9 + hash01(seed * 4.9 + 5.5) * 8;
      w.r = 0.60 + hash01(seed * 13.7 + 1.1) * 0.55;
      w.alpha = 0.30 + hash01(seed * 6.3 + 8.7) * 0.22;
      w.ttl = 2.2 + hash01(seed * 8.1 + 2.5) * 1.6;
      w.spin = (hash01(seed * 15.9 + 0.7) - 0.5) * 2.4;
      w.y = 0;
      w.age = 0;
    }
    for (var s = 0; s < 5; s++) {
      var w0 = {};
      resetWisp(w0, s + 1);
      w0.y = hash01(s * 4.4 + 1.3) * w0.len * 0.8;
      w0.age = hash01(s * 2.2 + 9.1) * w0.ttl * 0.8;
      wisps.push(w0);
    }

    var col = 'rgb(46,48,60)';

    function drawSteam(renderer, dt, time) {
      if (!(dt > 0)) dt = 1 / 60;
      if (dt > 0.1) dt = 0.1;
      var gain = 1 + burst * 1.15;
      renderer.overlay(function (o) {
        for (var i = 0; i < wisps.length; i++) {
          var w = wisps[i], j;
          w.age += dt;
          w.y += w.speed * dt;
          w.x0 += w.spin * dt * 0.06;
          if (w.age >= w.ttl || w.y > w.len) resetWisp(w, w.seed + 17.13);

          var life = clamp(w.age / w.ttl, 0.02, 1);
          var spread = 1 + life * 0.95;
          var seg = 8;
          var pts = [], alphas = [];
          var baseY = TOP + RIM_Y + 2.4 + w.y;
          for (j = 0; j <= seg; j++) {
            var t = j / seg;
            var wob = Math.sin(t * Math.PI * w.freq * 2 + w.phase + time * 0.9 + i) * w.amp * t;
            var wob2 = Math.sin(t * 3.7 + w.phase * 1.7 + time * 1.4) * w.amp * 0.4 * t;
            pts.push([
              CX + w.x0 * (0.45 + t * spread) + wob,
              baseY + t * w.len * 0.85,
              CZ + w.z0 * (0.45 + t * spread) + wob2,
            ]);
            alphas.push(0.10 + 0.62 * Math.sin(Math.PI * t) * (1 - life * 0.75));
          }
          for (j = 0; j < seg; j++) {
            var a0 = clamp(alphas[j] * w.alpha * gain, 0, 0.85);
            var a1 = clamp(alphas[j + 1] * w.alpha * gain, 0, 0.85);
            if (a0 < 0.015 && a1 < 0.015) continue;
            if (!o.visible(pts[j]) || !o.visible(pts[j + 1])) continue;
            o.seg(pts[j], pts[j + 1], {
              color: col,
              alpha: (a0 + a1) * 0.5,
              width: w.r * (0.55 + t * 0.9),
            });
          }
        }
        o.ctx.globalAlpha = 1;
      });
    }

    var pr = PLR.interact.make(app.scene, node, {
      id: 'cup',
      label: '马克杯',
      hintDims: [10, RIM_Y + 2, 10],
      press: function (p, down) { if (down) PLR.audio.resume(); },
      onClick: function (p) {
        hopT = 0; hopOn = 1;
        slosh = clamp(slosh + 0.6, 0, 1.1);
        burst = 1;
        PLR.audio.cupClink();
        PLR.audio.pour();
        p.setStatus('冒着热气');
      },
    });
    pr.setStatus('温热');

    node.behavior = {
      dynamic: true,
      build: function (n, gg) { author(gg); },
      update: function (dt) {
        if (hopOn > 0) {
          hopT += dt;
          hop = Math.sin(hopT * 15) * Math.exp(-hopT * 6.5) * 2.1;
          if (hopT > 0.9) { hopOn = 0; hop = 0; hopT = 0; }
        } else {
          hop = 0;
        }
        slosh = damp(slosh, 0, 2.3, dt);
        burst = damp(burst, 0, 0.55, dt);
        // the mug counter-rocks a little as it lands
        var rock = hopOn > 0 ? Math.sin(hopT * 15) * Math.exp(-hopT * 6.5) * 0.055 : 0;
        node.setTransform({ p: [CX, TOP + Math.abs(hop) * 0.6, CZ], roll: rock });
        node.touch();
      },
      post: function (n, renderer, scene) {
        drawSteam(renderer, scene ? scene.lastDt : 1 / 60, scene ? scene.time : 0);
        renderer.hitRegion(n);                 // every visible face of the mug
        pr.hitRegion(renderer);                // hover outline and the label tag
      },
    };
    node.touch();
    return node;
  }

  PLR.objects.cup = {
    id: 'cup',
    build: function (app) {
      buildSaucer(app);
      app.cupNode = buildCup(app);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
