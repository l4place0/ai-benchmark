/* =========================================================================
   Pure Line Room — objects/fan.js
   The ceiling fan (L.fan, hanging from L.y1): a ceiling plate and canopy, a
   downrod, a motor housing with cooling slots, a switch housing, four tapered
   blades on thin irons and a light kit, plus a pull chain with a ball on it.
   Clicking starts it, clicking again brakes it.  The whole rotor — four blades
   and their irons — lives in one child group whose yaw is written every frame
   from an accumulating angle, so it never snaps back, and while it turns the
   blades also lay a faint motion-blur arc over themselves in post().
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;

  var AT = L.fan;                 // { x: -6, y: 286, z: 196 }
  var CEIL = L.y1;                // 286 — the canopy is bolted to this

  /* ------------------------------- shapes -------------------------------- */
  /* g.box cannot be trusted: checked against the renderer's facing test, two
     of its six faces point into the solid (so the near one is dropped and the
     box reads as a flat card) and two more are skewed quads.  solid() authors
     the same box with all six wound outwards, and is used throughout. */
  function solid(g, x0, y0, z0, x1, y1, z1, mat, edgeMat) {
    var v = [
      g.v(x0, y0, z0), g.v(x1, y0, z0), g.v(x1, y1, z0), g.v(x0, y1, z0),
      g.v(x1, y0, z1), g.v(x0, y0, z1), g.v(x0, y1, z1), g.v(x1, y1, z1),
    ];
    g.face([v[0], v[3], v[2], v[1]], mat);   // -Z
    g.face([v[5], v[4], v[7], v[6]], mat);   // +Z
    g.face([v[0], v[5], v[6], v[3]], mat);   // -X
    g.face([v[1], v[2], v[7], v[4]], mat);   // +X
    g.face([v[3], v[6], v[7], v[2]], mat);   // +Y
    g.face([v[0], v[1], v[4], v[5]], mat);   // -Y
    if (edgeMat) {
      g.edge(v[0], v[1], edgeMat); g.edge(v[1], v[4], edgeMat);
      g.edge(v[4], v[5], edgeMat); g.edge(v[5], v[0], edgeMat);
      g.edge(v[3], v[2], edgeMat); g.edge(v[2], v[7], edgeMat);
      g.edge(v[7], v[6], edgeMat); g.edge(v[6], v[3], edgeMat);
      g.edge(v[0], v[3], edgeMat); g.edge(v[1], v[2], edgeMat);
      g.edge(v[4], v[7], edgeMat); g.edge(v[5], v[6], edgeMat);
    }
  }

  /* Author through fn(), then push every vertex it created through xf. */
  function placed(g, fn, xf) {
    var start = g.nv;
    fn(g);
    var v = g.mesh.verts;
    for (var i = start; i < g.nv; i++) {
      var p = xf(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
      v[i * 3] = p[0]; v[i * 3 + 1] = p[1]; v[i * 3 + 2] = p[2];
    }
  }

  /* ------------------------------- the rotor ------------------------------ */
  /* A blade (or an iron) is authored in its own little frame — a = out along
     the blade, b = across it, c = thickness — and then laid flat and swung to
     its station: Rx(-90) puts the profile in plan, Ry(theta) aims it.  Both
     are proper rotations, so the prism's winding arrives intact. */
  var ROTOR_Y = -44;                 // the blade plane, below the ceiling
  var BLADES = 4;
  var MAX_SPIN = 2.35 * Math.PI * 2; // revolutions per second at full speed

  function bladeXf(theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return function (a, b, z) {
      return [a * c + b * s, z + 0.75, a * s - b * c];
    };
  }
  function ironXf(theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    return function (a, b, z) {
      return [a * c + b * s, z + 0.75, a * s - b * c];
    };
  }
  /* a tapered paddle: narrower where it bolts to the iron, wide at the tip */
  var BLADE_PROFILE = [[19, -4.5], [52, -7.4], [52, 7.4], [19, 4.5]];

  function buildRotor(g) {
    for (var i = 0; i < BLADES; i++) {
      var th = (i / BLADES) * Math.PI * 2;
      var bxf = bladeXf(th), ixf = ironXf(th);
      /* the iron, a thin flat bar that carries the blade out from the hub */
      placed(g, function (G) {
        solid(G, 3.0, -2.0, -1.5, 25.5, 2.0, 0.0, 'metal', 'hair');
        /* a small stiffening spade where the blade bolts on */
        solid(G, 18.5, -3.2, -0.6, 25.0, 3.2, 0.2, 'metal', 'hair');
      }, ixf);
      /* the blade itself */
      placed(g, function (G) {
        G.prism(BLADE_PROFILE, -0.7, 0.7, 'wood', {
          capMat: 'wood', wallEdges: true, edgeMat: 'fine', name: 'blade',
        });
        /* two bolt heads, so the blade reads as bolted to its iron */
        G.circleOutline([20.6, -1.6, 0.7], 0.75, 'z', 'hair', 8);
        G.circleOutline([20.6, 1.6, 0.7], 0.75, 'z', 'hair', 8);
      }, bxf);
    }
  }

  /* -------------------------------- build -------------------------------- */
  PLR.objects.fan = {
    id: 'fan',
    build: function (app) {
      var scene = app.scene;
      var state = app.state;

      var node = scene.group(scene.root, {
        name: 'fan', p: [AT.x, CEIL, AT.z],
      });
      var g = node._g;

      /* ---- ceiling plate and canopy ---- */
      g.lathe([
        [6.0, 0.0], [9.8, 0.0], [9.8, -1.5], [6.0, -1.5],
      ], { segments: 26, meridians: 6, mat: 'trim', capMat: 'trim', edgeMat: 'hair' });
      g.lathe([
        [4.6, -1.5], [5.6, -2.8], [7.6, -5.8], [8.6, -8.2], [5.4, -9.3], [2.4, -9.7],
      ], { segments: 26, meridians: 6, mat: 'metal', capMat: 'metal', edgeMat: 'fine' });
      g.circleOutline([0, -2.9, 0], 6.6, 'y', 'hair', 26);

      /* ---- downrod, with its ball joint and lower collar ---- */
      g.lathe([
        [2.2, -8.6], [2.2, -11.0], [1.7, -12.2], [1.7, -29.0], [2.6, -30.2], [2.6, -31.4],
      ], { segments: 16, meridians: 4, mat: 'metal', capMat: 'metal', edgeMat: 'hair' });
      g.circleOutline([0, -28.4, 0], 2.5, 'y', 'hair', 16);
      g.circleOutline([0, -14.0, 0], 1.9, 'y', 'hair', 16);

      /* ---- motor housing, with cooling slots cut round its waist ---- */
      g.lathe([
        [3.4, -31.0], [6.2, -32.6], [10.0, -37.6], [10.8, -42.0],
        [10.2, -47.2], [7.0, -50.8], [5.4, -52.6], [5.4, -54.2],
      ], { segments: 28, meridians: 7, mat: 'metal', capMat: 'metal', edgeMat: 'fine', name: 'fanMotor' });
      var slot, ang;
      for (slot = 0; slot < 16; slot++) {
        ang = (slot / 16) * Math.PI * 2;
        g.edge(
          g.v(Math.cos(ang) * 10.7, -38.6, Math.sin(ang) * 10.7),
          g.v(Math.cos(ang) * 10.5, -45.4, Math.sin(ang) * 10.5),
          'fine'
        );
      }
      g.circleOutline([0, -38.6, 0], 10.72, 'y', 'hair', 28);
      g.circleOutline([0, -45.4, 0], 10.5, 'y', 'hair', 28);
      g.circleOutline([0, -33.6, 0], 7.4, 'y', 'hair', 28);

      /* ---- switch housing and the light kit under it ---- */
      g.lathe([
        [5.4, -54.2], [5.4, -57.4], [4.4, -58.4], [3.2, -59.2],
      ], { segments: 22, meridians: 5, mat: 'metal', capMat: 'metal', edgeMat: 'fine' });
      g.circleOutline([0, -56.0, 0], 5.5, 'y', 'hair', 22);
      g.lathe([
        [3.2, -59.2], [4.8, -60.4], [5.8, -62.8], [5.2, -65.2], [3.2, -66.6], [0.9, -67.2],
      ], { segments: 22, meridians: 5, mat: 'glass', capMat: 'glass', edgeMat: 'fine', name: 'fanGlobe' });
      g.lathe([
        [1.5, -67.0], [1.5, -68.4], [0.6, -68.9],
      ], { segments: 12, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: 'hair' });

      /* =============================== rotor ===============================
         Every blade and iron is authored into this one child group, so a
         single yaw write moves the whole rotor. */
      var rotor = scene.group(node, { name: 'fanRotor', p: [0, ROTOR_Y, 0] });
      buildRotor(rotor._g);

      /* ============================ pull chain =============================
         A second child group, hung from the switch housing; it swings on its
         own damped pendulum and settles. */
      var chain = scene.group(node, { name: 'fanChain', p: [3.9, -58.2, 0] });
      var cg = chain._g;
      cg.lathe([
        [0.5, 0.0], [0.5, -1.4], [0.28, -2.2], [0.28, -14.6], [0.5, -15.4], [0.5, -16.2],
      ], { segments: 10, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: 'hair' });
      var bead;
      for (bead = 1; bead <= 3; bead++) {
        cg.lathe([
          [0.75, -bead * 3.4], [0.75, -bead * 3.4 - 0.9], [0.3, -bead * 3.4 - 1.3],
        ], { segments: 10, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: null });
      }
      cg.lathe([
        [0.4, -16.2], [1.5, -17.0], [1.5, -18.4], [0.4, -19.2],
      ], { segments: 14, meridians: 4, mat: 'brass', capMat: 'brass', edgeMat: 'hair' });

      /* ---------------------------- interaction ---------------------------- */
      var angle = 0.9;               // the rotor's own accumulating angle
      var swing = 0, swingVel = 0;
      var lastYaw = angle, lastRoll = 0;
      var chainKick = 0;

      var pr = PLR.interact.make(scene, node, {
        id: 'fan',
        label: '吊扇',
        hintDims: [104, 68, 104],
        enter: function (p) { p.setStatus(state.fanOn ? '转动' : '静止'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          state.fanOn = !state.fanOn;
          PLR.audio.click();
          p.setStatus(state.fanOn ? '转动' : '刹车');
          chainKick = 3.4;
        },
      });

      node.behavior = {
        post: function (n, renderer) {
          pr.hitRegion(renderer);
          renderer.hitRegion(n);
          renderer.hitRegion(rotor);
          renderer.hitRegion(chain);

          /* motion blur: while the blades are moving fast they lay a few
             translucent arcs over their own radius */
          var fast = state.ch.fan;
          if (fast < 0.34) return;
          var alpha = Math.min(0.17, (fast - 0.34) * 0.28);
          var y = CEIL + ROTOR_Y + 0.8;
          renderer.overlay(function (o) {
            var ctx = o.ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            var rings = [[50, alpha, 3.2], [41, alpha * 0.55, 2.4]];
            for (var r = 0; r < rings.length; r++) {
              var pts = [];
              for (var s = 0; s < 44; s++) {
                var a = (s / 44) * Math.PI * 2;
                pts.push([AT.x + Math.cos(a) * rings[r][0], y, AT.z + Math.sin(a) * rings[r][0]]);
              }
              o.poly(pts, {
                stroke: 'rgba(255,255,255,0.85)', strokeAlpha: rings[r][1],
                width: rings[r][2] * (renderer.focal / 520),
              });
            }
            ctx.restore();
          });
        },
      };

      rotor.behavior = {
        update: function (dt, t, n, st) {
          angle += dt * st.ch.fan * MAX_SPIN;
          if (angle > 1e4) angle -= 1e4;
          if (Math.abs(angle - lastYaw) > 1e-4) {
            lastYaw = angle;
            n.setTransform({ yaw: angle });
            n.touch();
          }
        },
      };

      chain.behavior = {
        update: function (dt) {
          if (chainKick) { swingVel += chainKick; chainKick = 0; }
          swingVel += (-24 * swing - 1.5 * swingVel) * dt;
          swing += swingVel * dt;
          var roll = swing;
          if (Math.abs(roll - lastRoll) > 1e-4) {
            lastRoll = roll;
            chain.setTransform({ roll: roll, pitch: roll * 0.42 });
            chain.touch();
          }
        },
      };

      node.touch();
      rotor.touch();
      chain.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
