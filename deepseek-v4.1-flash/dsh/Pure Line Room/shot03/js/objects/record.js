/* =========================================================================
   Pure Line Room — objects/record.js
   The turntable on the coffee table (L.recordPlayer, top at y = 40): a plinth
   with an edge band and four feet, a metal platter with a felt mat, a vinyl
   record with a label, a run-out groove and concentric groove rings, a
   spindle, a tonearm with pivot housing, counterweight, anti-skate stub and a
   cartridge with a stylus, a 33/45 speed button, a power switch and a speaker
   slot grille on the front.
   Clicking starts and stops playback: the platter, mat and record spin up and
   coast down from an accumulating angle (the label turns with them) while the
   tonearm eases on and off the disc.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var M = PLR.math;
  var damp = M.ease.damp;

  var P = L.recordPlayer;         // { x: 196, y: 40, z: 300, w: 62, d: 52, h: 15 }
  var HW = P.w / 2;               // 31
  var HD = P.d / 2;               // 26
  var TOPY = P.h;                 // 15 — the plinth's top surface
  var RPM = ((100 / 3) / 60) * Math.PI * 2;   // 33 1/3 rpm, in radians/second

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

  /* A horizontal disc that faces up (g.disc with axis 'y' faces down). */
  function upDisc(g, cx, cy, cz, r, mat, seg) {
    g.face(g.ringIds([cx, cy, cz], r, 'y', seg || 20).slice().reverse(), mat);
  }

  /* A lathe about Y, turned to lie along X and moved into place. */
  function alongX(px, py, pz) {
    return function (x, y, z) { return [-y + px, x + py, z + pz]; };
  }

  /* ------------------------------- the arm -------------------------------- */
  var PIVOT = [19.5, 19.4, -13.0];   // the tonearm pivot, in plinth space
  var REST = -0.30;                  // parked on its rest, off the disc
  var PLAY = 0.28;                   // stylus down on the outer groove

  /* -------------------------------- build -------------------------------- */
  PLR.objects.record = {
    id: 'record',
    build: function (app) {
      var scene = app.scene;
      var state = app.state;

      var node = scene.group(scene.root, { name: 'record', p: [P.x, P.y, P.z] });
      var g = node._g;

      /* ---- four small feet ---- */
      var fx, fz;
      for (fx = -1; fx <= 1; fx += 2) {
        for (fz = -1; fz <= 1; fz += 2) {
          placed(g, function (G) {
            G.lathe([
              [2.6, 2.5], [2.6, 0.9], [2.0, 0.3], [1.6, 0.0],
            ], { segments: 14, meridians: 4, mat: 'dark', capMat: 'dark', edgeMat: 'hair' });
          }, (function (cx, cz) {
            return function (x, y, z) { return [x + cx, y, z + cz]; };
          })(fx * 25.5, fz * 19.5));
        }
      }

      /* ---- plinth, with a proud edge band around its base ---- */
      solid(g, -HW, 2.4, -HD, HW, TOPY, HD, 'wood', 'fine');
      solid(g, -HW - 0.7, 2.4, -HD - 0.7, HW + 0.7, 5.2, HD + 0.7, 'woodDark', 'fine');
      g.edge(g.v(-HW + 0.2, 5.25, HD + 0.72), g.v(HW - 0.2, 5.25, HD + 0.72), 'hair');
      g.edge(g.v(HW + 0.72, 5.25, -HD + 0.2), g.v(HW + 0.72, 5.25, HD - 0.2), 'hair');

      /* ---- 33/45 speed selector and the power switch, on the top ---- */
      placed(g, function (G) {
        G.lathe([
          [2.3, 1.35], [2.3, 0.5], [1.9, 0.15], [1.9, 0.0],
        ], { segments: 16, meridians: 4, mat: 'accent', capMat: 'accent', edgeMat: 'fine' });
        upDisc(G, 0, 1.36, 0, 1.85, 'paper', 16);
      }, function (x, y, z) { return [x - 24.5, y + TOPY, z + 19.0]; });
      solid(g, 20.0, TOPY, 16.4, 28.0, TOPY + 1.5, 21.6, 'accent', 'fine');
      solid(g, 21.4, TOPY + 1.5, 18.6, 26.6, TOPY + 2.4, 19.4, 'dark', 'hair');

      /* ---- speaker slot grille, recessed into the front face ---- */
      solid(g, -24.0, 5.6, HD - 0.2, 6.0, 12.6, HD + 0.3, 'whiteSoft', 'hair');
      var slot;
      for (slot = 0; slot < 4; slot++) {
        solid(g, -21.8, 6.9 + slot * 1.55, HD + 0.05, 3.8, 7.7 + slot * 1.55, HD + 0.5, 'dark', 'hair');
      }

      /* ============================== the platter ==========================
         Platter, felt mat, record, label and grooves all ride in one child
         group, so a single yaw write turns the whole thing. */
      var platter = scene.group(node, { name: 'recordPlatter' });
      var pg = platter._g;

      pg.lathe([
        [18.0, 16.9], [18.0, 15.4], [18.6, 15.05], [18.6, 14.75], [0.0, 14.75],
      ], { segments: 30, meridians: 8, mat: 'metal', capMat: 'metal', caps: false, edgeMat: 'fine', name: 'platter' });
      upDisc(pg, 0, 16.9, 0, 18.0, 'metal', 30);
      pg.circleOutline([0, 16.9, 0], 17.6, 'y', 'hair', 30);
      /* the felt mat, a shade smaller than the platter */
      pg.lathe([
        [17.3, 17.30], [17.3, 16.95], [16.9, 16.92],
      ], { segments: 30, meridians: 6, mat: 'fabric', capMat: 'fabric', edgeMat: 'hair', name: 'mat' });
      /* the record itself */
      pg.lathe([
        [15.4, 17.75], [15.4, 17.35], [15.0, 17.33],
      ], { segments: 32, meridians: 8, mat: 'dark', capMat: 'dark', edgeMat: 'fine', name: 'vinyl' });
      pg.circleOutline([0, 17.76, 0], 15.15, 'y', 'hair', 32);
      /* label, run-out groove and the concentric groove rings */
      upDisc(pg, 0, 17.78, 0, 5.4, 'paper', 26);
      pg.circleOutline([0, 17.79, 0], 5.4, 'y', 'fine', 26);
      pg.circleOutline([0, 17.79, 0], 6.35, 'y', 'fine', 30);
      var ring;
      for (ring = 0; ring < 9; ring++) {
        pg.circleOutline([0, 17.79, 0], 7.3 + ring * 0.86, 'y', 'hair', 30);
      }
      /* the spindle */
      pg.lathe([
        [0.45, 19.1], [0.45, 17.4], [0.7, 17.2], [0.7, 16.9],
      ], { segments: 12, meridians: 4, mat: 'metal', capMat: 'metal', edgeMat: 'hair', name: 'spindle' });

      /* ============================== the tonearm ========================== */
      var arm = scene.group(node, { name: 'recordArm', p: [PIVOT[0], PIVOT[1], PIVOT[2]] });
      var ag = arm._g;

      /* the pivot housing, standing on the plinth top */
      ag.lathe([
        [2.3, 2.9], [3.2, 2.4], [3.2, -3.4], [3.7, -4.0], [3.7, -4.6],
      ], { segments: 20, meridians: 5, mat: 'metal', capMat: 'metal', edgeMat: 'fine', name: 'pivot' });
      ag.circleOutline([0, 2.5, 0], 3.05, 'y', 'hair', 20);
      ag.circleOutline([0, 1.2, 0], 2.9, 'z', 'fine', 16);
      /* the counterweight, out behind the pivot */
      placed(ag, function (G) {
        G.lathe([
          [2.5, 2.4], [2.5, 1.7], [1.6, 1.4], [1.6, -1.4], [2.5, -1.7], [2.5, -2.4],
        ], { segments: 18, meridians: 5, mat: 'dark', capMat: 'dark', edgeMat: 'fine', name: 'counterweight' });
      }, alongX(8.6, 1.6, 0));
      solid(ag, 2.6, 1.2, -0.5, 8.6, 2.0, 0.5, 'metal', 'hair');
      /* the anti-skate stub, out in front of the pivot */
      solid(ag, -0.5, 1.3, 3.2, 0.5, 2.1, 6.6, 'metal', 'hair');
      placed(ag, function (G) {
        G.lathe([[0.9, 0.7], [0.9, -0.7]],
          { segments: 12, meridians: 3, mat: 'dark', capMat: 'dark', edgeMat: null });
      }, alongX(0, 1.7, 6.6));
      /* the cueing lever that lifts the arm on and off the disc */
      solid(ag, 3.2, -0.4, 2.6, 4.4, 1.6, 5.0, 'metal', 'hair');

      /* the arm tube, its headshell and the stylus */
      ag.prism([
        [-29.5, -2.6], [-2.6, 0.1], [-2.0, 1.9], [-29.9, -0.5],
      ], 1.5, 2.4, 'metal', { capMat: 'metal', wallEdges: true, edgeMat: 'fine', name: 'armTube' });
      solid(ag, -34.0, -3.9, 1.1, -29.2, -0.4, 2.9, 'metal', 'hair');
      solid(ag, -33.2, -4.7, 1.4, -29.8, -3.9, 2.6, 'dark', 'hair');
      ag.edge(ag.v(-31.6, -4.7, 2.0), ag.v(-31.6, -6.0, 2.0), 'sil');
      ag.edge(ag.v(-31.9, -5.9, 2.0), ag.v(-31.3, -6.1, 2.0), 'fine');
      ag.circleOutline([-8.0, 1.0, 1.95], 1.1, 'z', 'fine', 12);
      ag.circleOutline([-22.0, -0.9, 1.95], 1.1, 'z', 'fine', 12);

      /* ---------------------------- interaction ---------------------------- */
      var spin = 0;                 // the platter's own accumulating angle
      var armYaw = REST;
      var lastSpin = -1, lastYaw = REST;

      var pr = PLR.interact.make(scene, node, {
        id: 'record',
        label: '唱片机',
        hintDims: [62, 26, 52],
        enter: function (p) { p.setStatus(state.recordOn ? '33 转' : '待机'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          state.recordOn = !state.recordOn;
          if (state.recordOn) {
            PLR.audio.recordStart();
            p.setStatus('33 转 · 放唱');
          } else {
            PLR.audio.recordStop();
            p.setStatus('抬臂 · 停机');
          }
        },
      });

      node.behavior = {
        post: function (n, renderer) {
          pr.hitRegion(renderer);
          renderer.hitRegion(n);
          renderer.hitRegion(platter);
          renderer.hitRegion(arm);
        },
      };

      platter.behavior = {
        update: function (dt, t, n, st) {
          spin += dt * st.ch.record * RPM;
          if (spin > 1e4) spin -= 1e4;
          if (Math.abs(spin - lastSpin) > 1e-4) {
            lastSpin = spin;
            n.setTransform({ yaw: spin });
            n.touch();
          }
        },
      };

      arm.behavior = {
        update: function (dt, t, n, st) {
          armYaw = damp(armYaw, st.recordOn ? PLAY : REST, 2.1, dt);
          if (Math.abs(armYaw - lastYaw) > 1e-4) {
            lastYaw = armYaw;
            n.setTransform({ yaw: armYaw });
            n.touch();
          }
        },
      };

      node.touch();
      platter.touch();
      arm.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
