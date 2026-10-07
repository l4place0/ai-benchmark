/* =========================================================================
   Pure Line Room — objects/chime.js
   The wind chime (L.chime, hanging from L.y1): a ceiling plate and hook, a
   cord, a wooden top disc, five metal tubes of decreasing length each on its
   own cord, a central striker and a wind sail at the bottom.
   It never stands still — a slow ambient sway runs from the first frame — and
   a click adds a damped pendulum swing that decays over several seconds.  The
   tubes hang in a second, nested group so they lag a little behind the frame,
   and every time the swing sweeps through the centre it rings the next note.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;

  var AT = L.chime;               // the ceiling station, straight from layout
  var CEIL = L.y1;                // 286 — the plate is bolted to this

  /* -------------------------------- the chime ----------------------------- */
  var HOOK_Y = -5.0;              // the hook the whole assembly swings about
  var DISC_Y = -15.0;             // the wooden top disc, in swing coordinates
  var TUBE_N = 5;
  var TUBE_LEN = [28, 25, 22, 19, 16];
  var CORD_DROP = 3.0;            // how far each tube hangs below the disc

  function tubeAt(i) {
    var ang = (i / TUBE_N) * Math.PI * 2 + 0.55;
    var rad = 5.4 + i * 0.95;
    return { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad };
  }

  /* -------------------------------- build -------------------------------- */
  PLR.objects.chime = {
    id: 'chime',
    build: function (app) {
      var scene = app.scene;
      var state = app.state;

      var node = scene.group(scene.root, { name: 'chime', p: [AT.x, CEIL, AT.z] });
      var g = node._g;

      /* ---- ceiling plate and hook: the fixed half of the object ---- */
      g.lathe([
        [6.6, 0.0], [6.6, -1.2], [5.0, -1.9], [5.0, -2.7], [1.4, -3.1], [1.4, -3.9],
      ], { segments: 20, meridians: 5, mat: 'metal', capMat: 'metal', edgeMat: 'fine' });
      g.circleOutline([0, -0.7, 0], 5.6, 'y', 'hair', 20);
      g.edge(g.v(0, -3.9, 0), g.v(0, -5.0, 0), 'fine');
      g.circleOutline([0, -5.0, 0], 2.1, 'z', 'metal', 14);
      g.circleOutline([0, -5.0, 0], 2.1, 'z', 'hair', 14);

      /* ============================ the swinging half =======================
         Its local origin is the hook, so a roll about Z swings the whole
         assembly exactly the way a pendulum would. */
      var swing = scene.group(node, { name: 'chimeSwing', p: [0, HOOK_Y, 0] });
      var sg = swing._g;

      /* the cord down to the wooden disc */
      sg.lathe([
        [0.5, 0.0], [0.5, -1.4], [0.36, -2.4], [0.36, -9.0], [0.5, -10.0], [0.5, -11.4],
      ], { segments: 10, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: 'hair' });
      /* the wooden top disc that carries every tube */
      sg.lathe([
        [1.6, -13.2], [7.6, -13.5], [7.6, -14.8], [6.4, -15.6], [6.4, -16.4], [1.4, -16.7],
      ], { segments: 24, meridians: 6, mat: 'wood', capMat: 'wood', edgeMat: 'fine', name: 'chimeDisc' });
      sg.circleOutline([0, -14.1, 0], 7.2, 'y', 'hair', 24);
      sg.circleOutline([0, -15.8, 0], 6.1, 'y', 'hair', 24);

      /* the central striker: one cord straight through the middle of the tubes */
      sg.lathe([
        [0.4, -16.0], [0.4, -29.0], [0.6, -29.8], [0.6, -30.6],
      ], { segments: 10, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: null });
      sg.lathe([
        [3.4, -28.6], [3.4, -29.8], [3.1, -31.4], [0.7, -32.2],
      ], { segments: 20, meridians: 5, mat: 'wood', capMat: 'wood', edgeMat: 'fine', name: 'striker' });
      /* the wind sail, a flat plate on the end of the same cord */
      sg.lathe([
        [0.4, -32.2], [0.4, -50.4], [0.6, -51.0], [0.6, -51.8],
      ], { segments: 10, meridians: 3, mat: 'brass', capMat: 'brass', edgeMat: null });
      sg.prism([
        [-6.0, -59.0], [6.0, -59.0], [6.0, -50.2], [-6.0, -50.2],
      ], -0.5, 0.5, 'wood', { capMat: 'wood', wallEdges: true, edgeMat: 'fine', name: 'sail' });
      sg.circleOutline([0, -54.6, 0.6], 3.4, 'z', 'hair', 16);

      /* ============================== the tubes =============================
         A second, nested group: it lags behind the frame, so the tubes swing
         a little out of phase with the disc that carries them. */
      var tubes = scene.group(swing, { name: 'chimeTubes', p: [0, DISC_Y, 0] });
      var tg = tubes._g;
      for (var i = 0; i < TUBE_N; i++) {
        var p = tubeAt(i);
        var len = TUBE_LEN[i];
        var top = -CORD_DROP;
        /* the cord from the disc down to the tube's cap */
        tg.lathe([
          [0.3, 0.4], [0.3, -0.8], [0.2, -1.6], [0.2, top], [0.36, top - 0.5],
        ], { segments: 8, meridians: 2, mat: 'brass', capMat: 'brass', edgeMat: null });
        /* authored about the origin, then moved out to the tube's station */
        var moved = (function (px, pz) {
          return function (x, y, z) { return [x + px, y, z + pz]; };
        })(p.x, p.z);
        var start = tg.nv;
        tg.lathe([
          [1.65, top], [1.65, top - 0.9], [1.5, top - 1.8], [1.5, top - len + 1.0],
          [1.65, top - len + 0.25], [1.65, top - len],
        ], { segments: 14, meridians: 4, mat: 'metal', capMat: 'metal', edgeMat: 'fine', name: 'tube' });
        var v = tg.mesh.verts;
        for (var q = start; q < tg.nv; q++) {
          var pt = moved(v[q * 3], v[q * 3 + 1], v[q * 3 + 2]);
          v[q * 3] = pt[0]; v[q * 3 + 1] = pt[1]; v[q * 3 + 2] = pt[2];
        }
        tg.circleOutline([p.x, top - len + 0.2, p.z], 1.65, 'y', 'hair', 14);
        tg.circleOutline([p.x, top - 0.45, p.z], 1.65, 'y', 'hair', 14);
      }

      /* ---------------------------- interaction ---------------------------- */
      var angle = 0, vel = 0;        // the damped pendulum
      var lag = 0;                   // the tubes, trailing behind it
      var note = 0, armed = false, lastRing = -9, prev = 0;
      var lastLag = 9;

      var pr = PLR.interact.make(scene, node, {
        id: 'chime',
        label: '风铃',
        hintDims: [22, 62, 22],
        enter: function (p) { p.setStatus(armed ? '还在摆' : '安静'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          vel += 2.05;
          armed = true;
          p.setStatus('摆动 · 叮咚');
        },
      });

      node.behavior = {
        post: function (n, renderer) {
          pr.hitRegion(renderer);
          renderer.hitRegion(n);
          renderer.hitRegion(swing);
          renderer.hitRegion(tubes);
        },
      };

      swing.behavior = {
        update: function (dt, t, n) {
          /* a slow ambient sway that never stops … */
          var amb = 0.021 * Math.sin(t * 0.52) + 0.012 * Math.sin(t * 0.79 + 1.3);
          /* … plus the pendulum the click sets going, easing away over
             several seconds (omega ~ 2.5 rad/s, so a period of ~2.5 s) */
          vel += (-6.2 * angle - 0.52 * vel) * dt;
          angle += vel * dt;
          var roll = angle + amb;

          /* the swing sweeping through the centre is what rings the next tube */
          if (armed && Math.abs(vel) > 0.28 && Math.abs(roll) > 1e-6) {
            if ((roll > 0) !== (prev > 0) && t - lastRing > 0.14) {
              PLR.audio.chime(note);
              note = (note + 1) % 6;
              lastRing = t;
            }
          }
          prev = roll;
          if (Math.abs(vel) < 0.05) armed = false;

          /* the tubes trail the frame by a fraction of the swing */
          lag = damp(lag, angle, 3.1, dt);

          n.setTransform({ roll: roll, pitch: roll * 0.30 });
          n.touchTree();
          if (Math.abs(lag - lastLag) > 1e-4) {
            lastLag = lag;
            tubes.setTransform({ roll: -lag * 0.34, pitch: lag * 0.16 });
            tubes.touch();
          }
        },
      };

      node.touch();
      swing.touch();
      tubes.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
