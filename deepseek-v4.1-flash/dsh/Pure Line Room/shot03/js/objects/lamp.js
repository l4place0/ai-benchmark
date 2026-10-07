/* =========================================================================
   Pure Line Room — objects/lamp.js
   The desk lamp (L.deskItems.lamp): a weighted round base, an upright stem, a
   two-piece articulated arm on visible hinge pins with tension springs wound
   as helices of edges, a conical shade that is open underneath with a bulb
   inside it, and a small inline switch on the cable.
   Clicking toggles app.state.lampOn: the switch rocks, the shade nods, the
   lining and the bulb warm up and a pool of light spreads over the desk.  The
   halo itself is drawn in post() through renderer.overlay() with a radial
   gradient and the 'lighter' composite, so it reads as light, not paint.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var M = PLR.math;
  var damp = M.ease.damp;

  var AT = L.deskItems.lamp;      // [-92, -206] : where it stands on the desk
  var TOP = L.deskTop;            // 74          : the surface it stands on
  var DEG = Math.PI / 180;

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

  /* Author through fn(), then push every vertex it created through xf.  Used
     for the hinge pins (a lathe turned to lie along Z) and for the shade's
     tilt; both are proper rotations, so the winding survives. */
  function placed(g, fn, xf) {
    var start = g.nv;
    fn(g);
    var v = g.mesh.verts;
    for (var i = start; i < g.nv; i++) {
      var p = xf(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
      v[i * 3] = p[0]; v[i * 3 + 1] = p[1]; v[i * 3 + 2] = p[2];
    }
  }

  /* Author through fn(), then turn every face it produced inside out — the
     lining of the shade has to look back at the bulb, not away from it. */
  function flipped(g, fn) {
    var start = g.faces.length, i;
    fn(g);
    for (i = start; i < g.faces.length; i++) g.faces[i].i.reverse();
  }

  /* A flat bar between two points of the XY plane, extruded along Z.  The arm
     sections are prisms, whose counter-clockwise profile the engine winds out
     correctly on its own. */
  function bar(g, ax, ay, bx, by, w, z0, z1, mat, edgeMat) {
    var dx = bx - ax, dy = by - ay;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = (-dy / len) * w, py = (dx / len) * w;
    g.prism([
      [ax - px, ay - py], [bx - px, by - py], [bx + px, by + py], [ax + px, ay + py],
    ], z0, z1, mat, { capMat: mat, wallEdges: true, edgeMat: edgeMat, name: 'arm' });
  }

  /* A horizontal disc that faces up (g.disc with axis 'y' faces down). */
  function upDisc(g, cx, cy, cz, r, mat, seg) {
    g.face(g.ringIds([cx, cy, cz], r, 'y', seg || 18).slice().reverse(), mat);
  }

  /* A helical spring between two points, drawn as one polyline of edges. */
  function spring(g, a, b, radius, turns, mat) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var tx = dx / len, ty = dy / len, tz = dz / len;
    var ux = -ty, uy = tx, uz = 0;
    var ul = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= ul; uy /= ul;
    var wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux;
    var n = Math.max(8, Math.round(turns * 12));
    var ids = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var ang = t * turns * Math.PI * 2;
      var c = Math.cos(ang) * radius, s = Math.sin(ang) * radius;
      ids.push(g.v(
        a[0] + dx * t + ux * c + wx * s,
        a[1] + dy * t + uy * c + wy * s,
        a[2] + dz * t + uz * c + wz * s
      ));
    }
    g.polyline(ids, mat);
    g.edge(g.v(a[0] - tx * 3.4, a[1] - ty * 3.4, a[2] - tz * 3.4), ids[0], mat);
    g.edge(ids[n], g.v(b[0] + tx * 3.4, b[1] + ty * 3.4, b[2] + tz * 3.4), mat);
  }

  /* --------------------------- the articulated arm ------------------------ */
  var A = [0, 12.5];              // lower hinge, on top of the stem
  var B = [15.0, 25.0];           // elbow
  var C = [7.0, 36.0];            // shade yoke
  var TILT = 27 * DEG;            // the shade's mouth tips out over the desk (+X)

  function shadeXf(x, y, z) {
    var c = Math.cos(TILT), s = Math.sin(TILT);
    return [x * c - y * s, x * s + y * c, z];
  }
  function bulbXf(x, y, z) { return shadeXf(x, y - 6.2, z); }
  var BULB_LOCAL = shadeXf(0, -6.2, 0);

  function pinAt(px, py, pz) {
    return function (x, y, z) { return [x + px, -z + py, y + pz]; };
  }
  var PIN = [[2.5, 1.9], [2.5, 1.2], [1.7, 0.7], [1.7, -0.7], [2.5, -1.2], [2.5, -1.9]];

  /* -------------------------------- build -------------------------------- */
  PLR.objects.lamp = {
    id: 'lamp',
    build: function (app) {
      var scene = app.scene;
      var state = app.state;

      /* Materials that answer to the dimmer.  g.face keeps the spec object by
         reference, so update() can retint the lining and the bulb in place,
         without the cost of a dynamic rebuild. */
      var shadeInMat = { m: 'shadeIn' };
      var bulbMat = { m: 'bulb' };

      var node = scene.group(scene.root, { name: 'lamp', p: [AT[0], TOP, AT[1]] });
      var g = node._g;

      /* ---- weighted round base ---- */
      g.lathe([
        [3.2, 6.0], [6.2, 5.2], [8.5, 3.7], [9.2, 2.2], [9.2, 0.9], [8.5, 0.0],
      ], { segments: 28, meridians: 7, mat: 'dark', capMat: 'dark', edgeMat: 'fine', name: 'lampBase' });
      g.circleOutline([0, 1.35, 0], 8.95, 'y', 'hair', 28);
      g.circleOutline([0, 4.5, 0], 6.9, 'y', 'hair', 28);

      /* ---- stem ---- */
      g.lathe([[1.7, 12.6], [1.7, 7.2], [3.1, 6.2], [3.1, 5.2]],
        { segments: 18, meridians: 4, mat: 'metal', edgeMat: 'hair' });

      /* ---- the three hinge pins: a lathe about Y, turned to lie along Z ---- */
      placed(g, function (G) {
        G.lathe(PIN, { segments: 18, meridians: 4, mat: 'metal', edgeMat: 'fine' });
      }, pinAt(A[0], A[1], 0));
      placed(g, function (G) {
        G.lathe(PIN, { segments: 18, meridians: 4, mat: 'metal', edgeMat: 'fine' });
      }, pinAt(B[0], B[1], 0));
      placed(g, function (G) {
        G.lathe([[2.1, 1.6], [2.1, 1.0], [1.4, 0.6], [1.4, -0.6], [2.1, -1.0], [2.1, -1.6]],
          { segments: 16, meridians: 4, mat: 'metal', edgeMat: 'fine' });
      }, pinAt(C[0], C[1], 0));

      /* ---- the two arm sections, each an open channel of two bars ---- */
      bar(g, A[0], A[1], B[0], B[1], 1.25, -2.1, -0.7, 'metal', 'hair');
      bar(g, A[0], A[1], B[0], B[1], 1.25, 0.7, 2.1, 'metal', 'hair');
      bar(g, B[0], B[1], C[0], C[1], 1.15, -1.9, -0.6, 'metal', 'hair');
      bar(g, B[0], B[1], C[0], C[1], 1.15, 0.6, 1.9, 'metal', 'hair');
      /* the webs that close each channel at both ends */
      solid(g, A[0] - 2.3, A[1] - 1.4, -2.1, A[0] + 2.3, A[1] + 1.4, 2.1, 'metal', 'hair');
      solid(g, B[0] - 2.5, B[1] - 1.5, -2.1, B[0] + 2.5, B[1] + 1.5, 2.1, 'metal', 'hair');

      /* ---- tension springs, wound along each arm ---- */
      spring(g, [
        A[0] + (B[0] - A[0]) * 0.16, A[1] + (B[1] - A[1]) * 0.16, -3.0,
      ], [
        A[0] + (B[0] - A[0]) * 0.88, A[1] + (B[1] - A[1]) * 0.88, -3.0,
      ], 0.95, 11, 'fine');
      spring(g, [
        B[0] + (C[0] - B[0]) * 0.18 + 1.0, B[1] + (C[1] - B[1]) * 0.18, -2.9,
      ], [
        B[0] + (C[0] - B[0]) * 0.92, B[1] + (C[1] - B[1]) * 0.92, -2.9,
      ], 0.8, 9, 'fine');

      /* ---- the cable and its inline switch, laid back along the desk ---- */
      var cable = [[7.4, 0.9, 4.2], [14.0, 0.7, 7.6], [25.0, 0.6, 7.6], [33.0, 0.7, 11.4]];
      var ci = [], k;
      for (k = 0; k < cable.length; k++) {
        ci.push(g.v(cable[k][0], cable[k][1], cable[k][2]));
      }
      g.polyline(ci, 'fine');
      g.circleOutline([33.0, 0.9, 11.4], 1.4, 'z', 'hair', 10);
      /* the switch body straddles the straight run of the cable */
      solid(g, 16.6, 0.0, 5.9, 22.4, 1.7, 9.3, 'whiteSoft', 'fine');
      solid(g, 17.4, 1.7, 6.6, 21.6, 2.5, 8.6, 'accent', 'hair');
      g.edge(g.v(17.8, 0.0, 7.6), g.v(21.2, 0.0, 7.6), 'hair');

      /* ================================ shade ================================
         A child group, so the little nod it gives when the switch is pressed
         can be eased about the yoke without rebuilding the lamp. */
      var shade = scene.group(node, { name: 'lampShade', p: [C[0], C[1], 0] });
      var sg = shade._g;

      /* outer cone, tilted out over the desk, open at the bottom */
      placed(sg, function (G) {
        G.lathe([
          [0.9, 0.5], [2.7, -0.9], [5.4, -4.6], [7.3, -8.9], [7.9, -10.4],
        ], { segments: 26, meridians: 7, mat: 'shade', capMat: 'shade', caps: false, edgeMat: 'fine', name: 'shade' });
      }, shadeXf);
      placed(sg, function (G) { upDisc(G, 0, 0.5, 0, 0.9, 'shade', 14); }, shadeXf);
      /* the lining, wound inwards so it faces the bulb */
      placed(sg, function (G) {
        flipped(G, function (H) {
          H.lathe([
            [0.7, 0.2], [2.5, -1.1], [5.1, -4.7], [6.9, -8.8], [7.4, -10.1],
          ], { segments: 26, meridians: 7, mat: shadeInMat, capMat: shadeInMat, caps: false, edgeMat: null });
        });
      }, shadeXf);
      placed(sg, function (G) {
        G.circleOutline([0, -10.4, 0], 7.9, 'y', 'sil', 26);
        G.circleOutline([0, -10.1, 0], 7.4, 'y', 'hair', 26);
      }, shadeXf);
      /* the yoke that ties the shade to the top of the arm */
      solid(sg, -1.3, 0.2, -3.5, 1.3, 3.8, -2.3, 'metal', 'hair');
      solid(sg, -1.3, 0.2, 2.3, 1.3, 3.8, 3.5, 'metal', 'hair');

      /* the bulb and its socket, inside the shade */
      placed(sg, function (G) {
        G.lathe([
          [0.55, 2.4], [1.7, 1.8], [2.5, 0.6], [2.5, -0.6], [1.7, -1.8], [0.55, -2.4],
        ], { segments: 18, meridians: 5, mat: bulbMat, capMat: bulbMat, edgeMat: 'hair', name: 'bulb' });
        G.edge(G.v(-0.9, -0.4, 0), G.v(0, 1.3, 0), 'hair');
        G.edge(G.v(0, 1.3, 0), G.v(0.9, -0.4, 0), 'hair');
        G.lathe([[1.25, 4.9], [1.25, 2.4], [0.8, 2.1]],
          { segments: 14, meridians: 4, mat: 'metal', edgeMat: 'hair' });
      }, bulbXf);

      /* ---------------------------- interaction ---------------------------- */
      var glow = 0;
      var nod = 0;
      var lastRoll = 0;

      var pr = PLR.interact.make(scene, node, {
        id: 'lamp',
        label: '台灯',
        hintDims: [22, 38, 22],
        enter: function (p) { p.setStatus(state.lampOn ? '亮着' : '关着'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
        onClick: function (p) {
          state.lampOn = !state.lampOn;
          PLR.audio.lampSwitch(state.lampOn);
          p.setStatus(state.lampOn ? '亮着' : '关着');
          nod = (state.lampOn ? -4.4 : 4.4) * DEG;
        },
      });

      function tint(dayCol, nightCol, k) {
        var base = PLR.palette.mix(dayCol, nightCol, state.phase);
        return PLR.palette.mix(base, PLR.palette.mix('#fff2c6', '#ffe6a8', state.phase), k);
      }

      node.behavior = {
        update: function (dt, t, n, st) {
          glow = damp(glow, st.ch.lamp, 5.4, dt);
          nod = damp(nod, 0, 4.2, dt);
          /* The lining and the bulb warm up as the channel rises.  Below one
             per cent the overrides are dropped and the palette's own day and
             night materials take over again. */
          if (glow > 0.01) {
            shadeInMat.fill = tint('#fffaf0', '#4a3d24', glow * 0.9);
            shadeInMat.stroke = PLR.palette.mix('#8a8378', '#f6e2ae', glow * 0.7);
            bulbMat.fill = tint('#fffdf6', '#fff3cf', glow);
          } else {
            shadeInMat.fill = undefined;
            shadeInMat.stroke = undefined;
            bulbMat.fill = undefined;
          }
        },
        post: function (n, renderer) {
          pr.hitRegion(renderer);        // hover outline and the label tag
          renderer.hitRegion(n);         // every visible face of the lamp
          renderer.hitRegion(shade);     // and of the shade
          if (glow < 0.02) return;

          var night = state.phase;
          var lift = 0.28 + 0.72 * night;

          renderer.overlay(function (o) {
            /* the pool of light on the desk, built from world-space rings so
               that it lies on the surface from any camera angle; eight steps
               read as one soft gradient rather than as banded discs */
            var rings = [
              [54, 0.019], [47, 0.025], [40, 0.034], [33, 0.044],
              [26, 0.059], [19, 0.077], [13, 0.100], [7, 0.128],
            ];
            for (var i = 0; i < rings.length; i++) {
              var a = rings[i][1] * glow * lift;
              if (a < 0.004) continue;
              var pts = [];
              for (var s = 0; s < 26; s++) {
                var ang = (s / 26) * Math.PI * 2;
                pts.push([
                  AT[0] + 7 + Math.cos(ang) * rings[i][0] * 1.35,
                  TOP + 0.3,
                  AT[1] + 3 + Math.sin(ang) * rings[i][0] * 0.85,
                ]);
              }
              o.poly(pts, { fill: '#ffe6b4', fillAlpha: a });
            }
            /* and the halo around the bulb itself */
            var p = o.project(M.m4.point(shade.world, BULB_LOCAL));
            if (p[2] <= renderer.near) return;
            var ctx = o.ctx;
            var rad = Math.max(24, (renderer.focal * 22) / p[2]);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            var grad = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], rad);
            grad.addColorStop(0, 'rgba(255,243,206,' + (0.60 * glow).toFixed(3) + ')');
            grad.addColorStop(0.32, 'rgba(255,226,160,' + (0.25 * glow).toFixed(3) + ')');
            grad.addColorStop(0.68, 'rgba(255,214,140,' + (0.09 * glow).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,208,130,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p[0], p[1], rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        },
      };

      /* the shade answers the switch with a small damped nod */
      shade.behavior = {
        update: function () {
          if (Math.abs(nod - lastRoll) < 1e-4) return;
          lastRoll = nod;
          shade.setTransform({ roll: nod });
          shade.touch();
        },
      };
      node.touch();
      shade.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
