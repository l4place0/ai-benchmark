/* =========================================================================
   Pure Line Room — objects/globe.js
   A desk globe standing on the desk at L.deskItems.globe. Everything hangs off
   one tilt group so the polar axis leans, and the sphere itself is a separate
   child that spins.

   Geometry: a turned wooden base (lathe), a brass meridian ring, a tilted axis
   pin, the sphere built with g.lathe (16 segments x 7 rows) on a 'paper' fill,
   the latitude/longitude graticule stroked as edges over that fill, a handful
   of simplified coastlines as extra closed edges, and a small brass finial.

   Interaction: dragging spins it — onDrag feeds dx into a yaw velocity that
   decays in update() — and it drifts very slowly by itself when idle.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var clamp = PLR.math.clamp;

  var G = L.deskItems.globe;
  var GX = G[0], GZ = G[1];
  var TOP = L.deskTop;

  var TILT = 0.410;          // 23.5 degrees
  var SR = 7.5;              // sphere radius
  var AXIS = 13.0;           // height of the sphere centre above the desk top
  var RING = SR + 0.45;      // meridian ring radius
  var ct = Math.cos(TILT), st = Math.sin(TILT);

  /* tilt is a roll about Z: it leans the pole in the XY plane and keeps the
     meridian ring (polar axis + X axis) visible from the room. */
  function lp(x, y, z) {
    return [x * ct - y * st, x * st + y * ct, z];
  }

  /* ------------------------------- the base ------------------------------- */
  function buildBase(app) {
    var node = app.scene.group(app.scene.root, {
      name: 'globeBase',
      p: [GX, TOP, GZ],
    });
    var g = node._g;

    // turned wooden pedestal
    g.lathe([
      [3.0, 0.0],
      [3.05, 1.4],
      [2.85, 2.2],
      [2.45, 3.0],
      [2.05, 3.9],
      [1.85, 5.0],
      [1.75, 6.2],
    ], { segments: 20, mat: 'wood', edgeMat: 'fine', meridians: 8 });
    // brass collar the meridian ring rests in
    g.lathe([[1.8, 4.35], [2.75, 4.55], [2.85, 4.95], [2.15, 5.25], [1.75, 5.25]],
      { segments: 20, mat: 'brass', edgeMat: 'hair', meridians: 6 });
    // stepped foot with a shadow ring where it meets the desk
    g.lathe([[4.2, -0.9], [4.35, -0.2], [4.2, 0.05], [3.1, 0.05]],
      { segments: 20, mat: 'woodDark', edgeMat: 'hair', meridians: 6 });
    g.circleOutline([0, -0.85, 0], 4.3, 'y', 'hair', 20);
    return node;
  }

  /* ------------------------------ the ring -------------------------------- */
  function buildRing(app) {
    var node = app.scene.group(app.scene.root, {
      name: 'globeRing',
      p: [GX, TOP + AXIS, GZ],
    });
    var g = node._g;

    // the meridian: a band following the tilted great circle, as a ring of faces
    var N = 48, inner = [], outer = [];
    for (var i = 0; i < N; i++) {
      var psi = (i / N) * Math.PI * 2;
      var u = RING * Math.sin(psi), v = RING * Math.cos(psi);
      var a = lp(u, v, -0.45), b = lp(u, v, 0.45);
      inner.push(g.v(a[0], a[1], a[2]));
      outer.push(g.v(b[0], b[1], b[2]));
    }
    for (i = 0; i < N; i++) {
      var j = (i + 1) % N;
      // wound so the band's outward normal points away from the sphere
      g.face([inner[i], outer[i], outer[j], inner[j]], 'brass', { hit: 'main' });
    }
    g.ring(inner, 'fine');
    g.ring(outer, 'fine');

    // graduation marks down one side of the ring
    for (var k = 0; k <= 12; k++) {
      var ang = (k / 12) * Math.PI * 2;
      var p0 = lp(RING * Math.sin(ang), RING * Math.cos(ang), -0.5);
      var p1 = lp(RING * Math.sin(ang) * 0.955, RING * Math.cos(ang) * 0.955, -0.5);
      g.edge(g.v(p0[0], p0[1], p0[2]), g.v(p1[0], p1[1], p1[2]), 'hair');
    }
    return node;
  }

  /* ------------------------------ the sphere ------------------------------ */
  function buildSphere(app) {
    var node = app.scene.group(app.scene.root, {
      name: 'globeSphere',
      p: [GX, TOP + AXIS, GZ],
      pitch: TILT,
      layer: 1,
    });
    var g = node._g;

    /* the ball: a lathe, 16 segments x 7 rows, on a paper fill */
    g.lathe([
      [0, -SR],
      [3.10, -6.85],
      [5.62, -4.95],
      [7.02, -2.35],
      [SR, 0],
      [6.58, 3.60],
      [4.15, 6.15],
      [0, SR],
    ], { segments: 16, mat: 'paper', edges: false, caps: false, edgeMat: null });

    /* the graticule, stroked as edges at a slightly larger radius. It is kept
       light: at desk scale a dense mesh of strokes reads as a cage, not a globe. */
    var GR = SR + 0.05, LON = 24;
    function band(lat, mat) {
      var r = GR * Math.cos(lat), y = GR * Math.sin(lat);
      var ids = [];
      for (var i = 0; i < LON; i++) {
        var a = (i / LON) * Math.PI * 2;
        ids.push(g.v(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      g.ring(ids, mat);
    }
    band(0, 'fine');                          // the equator, the one strong line
    for (var m = 0; m < 8; m++) {
      var lon = (m / 8) * Math.PI * 2;
      var ids2 = [];
      for (var q = -3; q <= 3; q++) {
        var la = (q / 3) * (Math.PI / 2) * 0.92;
        var r2 = GR * Math.cos(la), y2 = GR * Math.sin(la);
        ids2.push(g.v(Math.cos(lon) * r2, y2, Math.sin(lon) * r2));
      }
      g.polyline(ids2, 'hair');
    }
    // the two tropics, drawn only across the side that faces the room
    for (var b = 0; b < 2; b++) {
      var lat = b === 0 ? 0.41 : -0.41;
      var idb = [];
      for (var k = 0; k <= 8; k++) {
        var aa = -1.15 + (k / 8) * 2.30;
        var rb = GR * Math.cos(lat), yb = GR * Math.sin(lat);
        idb.push(g.v(Math.cos(aa) * rb, yb, Math.sin(aa) * rb));
      }
      g.polyline(idb, 'hair');
    }

    /* simplified coastlines, as blobby closed polylines over the fill */
    var CR = SR + 0.09;
    function coast(pts) {
      var ids = [], i;
      for (i = 0; i < pts.length; i++) {
        var la = pts[i][0] * Math.PI / 180, lo = pts[i][1] * Math.PI / 180;
        ids.push(g.v(Math.cos(la) * Math.sin(lo) * CR, Math.sin(la) * CR,
                     Math.cos(la) * Math.cos(lo) * CR));
      }
      for (i = 0; i < ids.length; i++) g.edge(ids[i], ids[(i + 1) % ids.length], 'fine');
    }

    /* Africa + Europe */
    coast([[-34, 18], [-30, 31], [-15, 40], [-2, 43], [10, 44], [14, 33], [20, 30],
           [32, 33], [36, 26], [36, 10], [31, -3], [23, -8], [15, -12], [4, -8],
           [0, 8], [-10, 12], [-22, 12]]);
    /* Asia */
    coast([[38, 28], [44, 42], [52, 55], [60, 68], [66, 90], [70, 115], [63, 140],
           [52, 142], [42, 128], [34, 122], [24, 112], [20, 100], [10, 98], [12, 82],
           [22, 70], [24, 58], [30, 48]]);
    /* North America */
    coast([[66, -22], [72, -60], [70, -95], [58, -125], [42, -124], [30, -112],
           [18, -102], [10, -84], [20, -70], [30, -60], [44, -54], [56, -44]]);
    /* South America */
    coast([[12, -60], [4, -60], [-6, -78], [-18, -72], [-30, -62], [-42, -66],
           [-50, -68], [-40, -50], [-22, -42], [-8, -36], [2, -50]]);
    /* Australia */
    coast([[-14, 128], [-22, 114], [-34, 116], [-38, 142], [-30, 152], [-18, 146],
           [-12, 136]]);

    /* the tilted axis pin, top and bottom */
    g.cylinder(0, SR + 0.35, 0, 0.85, 0.9, { side: 'brass', cap: 'brass', segments: 12, edge: 'hair' });
    g.cylinder(0, -(SR + 0.35), 0, 0.85, 0.9, { side: 'brass', cap: 'brass', segments: 12, edge: 'hair' });
    return node;
  }

  /* ------------------------------ the finial ------------------------------ */
  function buildFinial(app) {
    var p = lp(0, RING + 0.15, 0);
    var node = app.scene.group(app.scene.root, {
      name: 'globeFinial',
      p: [GX + p[0], TOP + AXIS + p[1], GZ + p[2]],
      pitch: TILT,
    });
    node._g.lathe([
      [1.55, 0],
      [1.0, 0.4],
      [1.1, 0.75],
      [0.45, 1.1],
      [0.55, 1.5],
      [0, 1.85],
    ], { segments: 14, mat: 'brass', edgeMat: 'hair', meridians: 5 });
    return node;
  }

  PLR.objects.globe = {
    id: 'globe',
    build: function (app) {
      buildBase(app);
      buildRing(app);
      var sphere = buildSphere(app);
      buildFinial(app);

      var yaw = 0, vel = 0, dragging = 0;

      var pr = PLR.interact.make(app.scene, sphere, {
        id: 'globe',
        label: '地球仪',
        hintDims: [SR * 2.4, SR * 2.4, SR * 2.4],
        press: function (p, down) { if (down) PLR.audio.resume(); },
        enter: function (p) { p.setStatus('拖动旋转'); },
        onClick: function (p) { p.setStatus('拖动可旋转'); },
        onDrag: function (p, dx, dy, dt, ev) {
          dragging = 0.55;
          vel = clamp(vel + dx * 0.0016, -4.5, 4.5);
          return true;                      // swallow the drag
        },
      });
      pr.setStatus('缓慢自转');

      sphere.behavior = {
        update: function (dt) {
          if (dragging > 0) dragging = Math.max(0, dragging - dt);
          var idle = dragging > 0.02 ? 0 : 0.055;
          yaw += (vel + idle) * dt;
          vel *= Math.exp(-2.4 * dt);       // inertia decays
          if (vel > -1e-4 && vel < 1e-4) vel = 0;
          sphere.tf.yaw = yaw;
          sphere.touch();
        },
        post: function (n, renderer) {
          renderer.hitRegion(n);                  // every visible face of the globe
          pr.hitRegion(renderer);                 // hover outline and the label tag
        },
      };
      sphere.touch();
      app.globeNode = sphere;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
