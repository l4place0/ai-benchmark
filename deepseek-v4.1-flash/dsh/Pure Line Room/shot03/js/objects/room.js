/* =========================================================================
   Pure Line Room — objects/room.js
   The shell: floor, ceiling, four walls with a real window opening and a door
   opening, skirting, cornice, boarded floor and the landscape seen outside.
   Everything here is static and drawn first (keyOverride) so the rest of the
   room layers on top of it.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;

  var SHELL_KEY = -1e6;
  var OUT_KEY = SHELL_KEY + 10;

  PLR.objects.room = {
    id: 'shell',
    build: function (app) {
      var scene = app.scene;
      var g = scene.group(scene.root, { name: 'shell', keyOverride: SHELL_KEY });
      var G = g._g;

      var x0 = L.x0, x1 = L.x1, y0 = L.y0, y1 = L.y1, z0 = L.z0, z1 = L.z1;
      var i, t;

      /* ------------------------------- floor ------------------------------- */
      /* Winding convention: every surface of the shell faces into the room, so
         the renderer's facing test works from any camera angle inside. */
      G.face([G.v(x0, y0, z1), G.v(x1, y0, z1), G.v(x1, y0, z0), G.v(x0, y0, z0)], 'floor');
      var boards = 16;
      for (i = 1; i < boards; i++) {
        var zz = z0 + (z1 - z0) * (i / boards);
        G.edge(G.v(x0, y0, zz), G.v(x1, y0, zz), i % 3 === 0 ? 'fine' : 'hair');
      }
      for (i = 1; i < 4; i++) {
        var xx = x0 + (x1 - x0) * (i / 4);
        G.edge(G.v(xx, y0, z0), G.v(xx, y0, z1), 'hair');
      }

      /* ------------------------------ ceiling ------------------------------ */
      G.face([G.v(x0, y1, z0), G.v(x1, y1, z0), G.v(x1, y1, z1), G.v(x0, y1, z1)], 'ceiling');
      G.face([G.v(x0, y1, z1), G.v(x1, y1, z1), G.v(x1, y1, z0), G.v(x0, y1, z0)], 'ceilingEx');
      for (i = 1; i < 7; i++) {
        var cz = z0 + (z1 - z0) * (i / 7);
        G.edge(G.v(x0, y1, cz), G.v(x1, y1, cz), 'hair');
      }
      for (i = 1; i < 3; i++) {
        var bx = x0 + (x1 - x0) * (i / 3);
        var bh = 9, bw = 8;
        var top = [
          G.v(bx - bw / 2, y1, z0), G.v(bx + bw / 2, y1, z0),
          G.v(bx + bw / 2, y1, z1), G.v(bx - bw / 2, y1, z1),
        ];
        var bot = [
          G.v(bx - bw / 2, y1 - bh, z0), G.v(bx + bw / 2, y1 - bh, z0),
          G.v(bx + bw / 2, y1 - bh, z1), G.v(bx - bw / 2, y1 - bh, z1),
        ];
        G.face(top.slice().reverse(), 'ceiling');
        G.face(bot, 'trim');
        G.ring(top, 'hair');
        G.ring(bot, 'fine');
        G.edge(top[0], bot[0], 'fine'); G.edge(top[1], bot[1], 'fine');
        G.edge(top[2], bot[2], 'fine'); G.edge(top[3], bot[3], 'fine');
      }

      /* ------------------------------- walls ------------------------------- */
      var win = L.window;
      var wx0 = win.cx - win.w / 2, wx1 = win.cx + win.w / 2;
      var wy0 = win.y0, wy1 = win.y1;
      // interior skin of the back wall (+Z), with a hole for the window
      G.face([G.v(x0, y0, z0), G.v(x0, y1, z0), G.v(wx0, y1, z0), G.v(wx0, y0, z0)], 'wall');
      G.face([G.v(wx0, y0, z0), G.v(wx0, wy0, z0), G.v(wx1, wy0, z0), G.v(wx1, y0, z0)], 'wall');
      G.face([G.v(wx0, wy1, z0), G.v(wx0, y1, z0), G.v(wx1, y1, z0), G.v(wx1, wy1, z0)], 'wall');
      G.face([G.v(wx1, y0, z0), G.v(wx1, y1, z0), G.v(x1, y1, z0), G.v(x1, y0, z0)], 'wall');
      // outside skin of the back wall (-Z), seen if the camera swings past it
      G.face([G.v(x0, y0, z0), G.v(wx0, y0, z0), G.v(wx0, y1, z0), G.v(x0, y1, z0)], 'wallEx');
      G.face([G.v(wx0, y0, z0), G.v(wx1, y0, z0), G.v(wx1, wy0, z0), G.v(wx0, wy0, z0)], 'wallEx');
      G.face([G.v(wx0, wy1, z0), G.v(wx1, wy1, z0), G.v(wx1, y1, z0), G.v(wx0, y1, z0)], 'wallEx');
      G.face([G.v(wx1, y0, z0), G.v(x1, y0, z0), G.v(x1, y1, z0), G.v(wx1, y1, z0)], 'wallEx');

      // front wall faces -Z
      G.face([G.v(x0, y0, z1), G.v(x1, y0, z1), G.v(x1, y1, z1), G.v(x0, y1, z1)], 'wall');
      G.face([G.v(x1, y0, z1), G.v(x0, y0, z1), G.v(x0, y1, z1), G.v(x1, y1, z1)], 'wallEx');
      // left wall faces +X, with a hole for the door
      var dr = L.door;
      var dz0 = dr.cz - dr.w / 2, dz1 = dr.cz + dr.w / 2, dh = dr.h;
      G.face([G.v(x0, y0, z0), G.v(x0, y1, z0), G.v(x0, y1, dz0), G.v(x0, y0, dz0)], 'wallSide');
      G.face([G.v(x0, y0, dz0), G.v(x0, dh, dz0), G.v(x0, dh, dz1), G.v(x0, y0, dz1)], 'wallSide');
      G.face([G.v(x0, dh, dz0), G.v(x0, y1, dz0), G.v(x0, y1, dz1), G.v(x0, dh, dz1)], 'wallSide');
      G.face([G.v(x0, y0, dz1), G.v(x0, y1, dz1), G.v(x0, y1, z1), G.v(x0, y0, z1)], 'wallSide');
      // right wall faces -X
      G.face([G.v(x1, y0, z1), G.v(x1, y1, z1), G.v(x1, y1, z0), G.v(x1, y0, z0)], 'wallSide');

      /* --------------------------- skirting + cornice ---------------------- */
      var sk = 13, sd = 3, co = 9, cd = 3;
      G.box(x0, y0, z0, x1, y0 + sk, z0 + sd, 'trim', 'hair');
      G.box(x0, y1 - co, z0, x1, y1, z0 + cd, 'trim', 'hair');
      G.box(x0, y0, z1 - sd, x1, y0 + sk, z1, 'trim', 'hair');
      G.box(x0, y1 - co, z1 - cd, x1, y1, z1, 'trim', 'hair');
      G.box(x0, y0, z0, x0 + sd, y0 + sk, z1, 'trim', 'hair');
      G.box(x0, y1 - co, z0, x0 + cd, y1, z1, 'trim', 'hair');
      G.box(x1 - sd, y0, z0, x1, y0 + sk, z1, 'trim', 'hair');
      G.box(x1 - cd, y1 - co, z0, x1, y1, z1, 'trim', 'hair');

      /* ------------------------------ outside ------------------------------ */
      var out = scene.group(scene.root, { name: 'outside', keyOverride: OUT_KEY });
      var O = out._g;
      var oz = z0 - 700;
      var ground = 46;

      // far hills
      function hill(cx, w, h, mat) {
        var pts = [], n = 24, k;
        for (k = 0; k <= n; k++) {
          var u = k / n;
          var px = cx - w / 2 + w * u;
          var py = ground + h * Math.pow(Math.sin(u * Math.PI), 1.3) * (1 + 0.05 * Math.sin(u * 11));
          pts.push([px, py]);
        }
        var ring = [];
        for (k = pts.length - 1; k >= 0; k--) ring.push(O.v(pts[k][0], pts[k][1], oz + 6));
        ring.push(O.v(cx - w / 2, ground - 60, oz + 6));
        ring.push(O.v(cx + w / 2, ground - 60, oz + 6));
        O.face(ring, mat);
        for (k = 0; k + 1 < pts.length; k++) {
          var a = O.v(pts[k][0], pts[k][1], oz + 6);
          var b = O.v(pts[k + 1][0], pts[k + 1][1], oz + 6);
          O.edge(a, b, 'hair');
        }
      }
      hill(-180, 760, 210, 'hillFar');
      hill(430, 700, 150, 'hillMid');
      // ground band
      O.face([
        O.v(-900, ground - 60, oz + 10), O.v(900, ground - 60, oz + 10),
        O.v(900, ground, oz + 10), O.v(-900, ground, oz + 10),
      ], 'ground');
      O.edge(O.v(-900, ground, oz + 10), O.v(900, ground, oz + 10), 'fine');

      function tree(px, h, spread) {
        var base = O.v(px, ground, oz + 18);
        var top = O.v(px, ground + h * 0.42, oz + 18);
        O.edge(base, top, 'fine');
        var k, branches = 5;
        for (k = 0; k < branches; k++) {
          var yy = ground + h * (0.34 + k * 0.13);
          var sp = (spread || h * 0.3) * (1 - k * 0.14);
          var from = O.v(px, yy - sp * 0.35, oz + 18);
          O.edge(from, O.v(px - sp, yy + sp * 0.55, oz + 18), 'fine');
          O.edge(from, O.v(px + sp, yy + sp * 0.55, oz + 18), 'fine');
        }
        O.edge(O.v(px - spread * 0.22, ground, oz + 18), base, 'fine');
        O.edge(O.v(px + spread * 0.22, ground, oz + 18), base, 'fine');
      }
      tree(-330, 300, 70);
      tree(210, 220, 52);
      tree(560, 260, 62);

      // sky wash behind everything, plus a few cloud outlines
      O.face([
        O.v(-1000, ground - 4, oz + 2), O.v(1000, ground - 4, oz + 2),
        O.v(1000, ground + 620, oz + 2), O.v(-1000, ground + 620, oz + 2),
      ], 'sky');
      for (i = 0; i < 3; i++) {
        var cxx = -420 + i * 400, cyy = ground + 400 + (i % 2) * 90;
        var cids = [];
        for (var m = 0; m < 10; m++) {
          var ang = (m / 10) * Math.PI * 2;
          cids.push(O.v(cxx + Math.cos(ang) * 90, cyy + Math.sin(ang) * 22, oz + 24));
        }
        O.ring(cids, 'hair');
      }

      /* --------------------------- hanging lamp ---------------------------- */
      /* The room light: a cord, a dome and a bulb, with the pool of light it
         casts drawn as an overlay. This is what the wall switch turns on. */
      var lampAt = [L.pendant.x, L.pendant.z];
      var lampNode = scene.group(scene.root, {
        name: 'roomLamp',
        behavior: { post: lampPost },
      });
      var P = lampNode._g;
      var roseTop = L.y1, domeY = 202, cordR = 1.1;
      P.box(lampAt[0] - 5, roseTop - 3, lampAt[1] - 5, lampAt[0] + 5, roseTop, lampAt[1] + 5, 'trim', 'hair');
      P.lathe([[0, roseTop - 3], [3.4, roseTop - 5], [1.4, roseTop - 8]], {
        segments: 12, mat: 'whiteSoft', capMat: 'whiteSoft', meridians: 4, edges: true,
      });
      P.lathe([[cordR, roseTop - 8], [cordR, domeY + 26]], {
        segments: 6, mat: 'dark', capMat: 'dark', edges: false, meridians: 2,
      });
      // dome shade, open at the bottom
      P.lathe([[6, domeY + 24], [10, domeY + 16], [19, domeY + 5], [26, domeY - 3], [28, domeY - 6], [28, domeY - 5]], {
        segments: 20, mat: 'shade', capMat: 'shade', meridians: 6, edges: true,
      });
      // the lit inner cone, seen from below through the open mouth
      P.lathe([[24, domeY - 4], [16, domeY + 5], [8, domeY + 16], [2, domeY + 22]], {
        segments: 20, mat: 'shadeIn', capMat: 'shadeIn', caps: false, meridians: 5, edges: true,
      });
      P.circleOutline([lampAt[0], domeY - 5.5, lampAt[1]], 28, 'y', 'fine', 28);
      P.circleOutline([lampAt[0], domeY - 4, lampAt[1]], 24, 'y', 'hair', 24);
      // bulb
      P.lathe([[0, domeY + 20], [3, domeY + 17], [5.4, domeY + 12], [5.4, domeY + 2], [4, domeY - 1], [0, domeY - 2]], {
        segments: 12, mat: 'bulb', capMat: 'bulb', meridians: 4, edges: true,
      });
      P.box(lampAt[0] - 3, domeY + 20, lampAt[1] - 3, lampAt[0] + 3, domeY + 24, lampAt[1] + 3, 'metal', 'hair');

      function lampPost(node, renderer, sc) {
        var st = PLR.state;
        var k = st.ch.room;
        var on = 1 - st.phase;
        if (on < 0.02) return;
        var lightPos = [lampAt[0], domeY + 6, lampAt[1]];
        renderer.overlay(function (o) {
          var s = o.project(lightPos);
          if (s[2] <= renderer.near) return;
          var ctx = o.ctx;
          var r1 = Math.max(30, (170 * renderer.focal) / s[2]);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          var grd = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], r1);
          grd.addColorStop(0, 'rgba(255,236,196,' + (0.55 * on).toFixed(3) + ')');
          grd.addColorStop(0.45, 'rgba(255,226,170,' + (0.20 * on).toFixed(3) + ')');
          grd.addColorStop(1, 'rgba(255,220,160,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(s[0], s[1], r1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // the pool on the floor beneath
          var f = o.project([lampAt[0], 2, lampAt[1]]);
          if (f[2] > renderer.near) {
            var r2 = Math.max(24, (200 * renderer.focal) / f[2]);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            var g2 = ctx.createRadialGradient(f[0], f[1], 0, f[0], f[1], r2);
            g2.addColorStop(0, 'rgba(255,238,206,' + (0.30 * on).toFixed(3) + ')');
            g2.addColorStop(1, 'rgba(255,232,190,0)');
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.ellipse(f[0], f[1], r2, r2 * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

      return g;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
