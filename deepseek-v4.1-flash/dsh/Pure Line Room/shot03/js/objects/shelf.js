/* =========================================================================
   Pure Line Room — objects/shelf.js
   A tall open bookcase against the back wall (L.bookshelf): two sides, a top,
   a shaped plinth, a back panel with a vertical grain, four shelves drilled
   with shelf-pin holes, and a working library of books — groups standing
   upright, a few leaning, two lying flat in stacks — each drawn with a spine,
   a cover edge and a lighter page block. A pot plant and a brass bookend sit
   on the top shelf.

   Every book is its own child group, so it can ease out toward the viewer and
   tip back in again on a click, and each registers its own pick tag ('bk3'),
   which is what the proxy's post() hands to the renderer.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;
  var damp = PLR.math.ease.damp;

  var B = L.bookshelf;
  var HALF = B.w / 2;                 // 50
  var SD = 4;                         // board thickness
  var ZBACK = L.z0 + 2;               // back panel, a little proud of the wall
  var DEPTH = B.d - 2;                // front face sits at local z = 30
  var FZ = DEPTH;
  var IN0 = SD, IN1 = FZ - SD;        // clear inner width in z: 4 .. 26

  /* shelving: the top of each shelf board, and the space above it */
  var SHELF = [78, 98, 118, 138, 158];
  var TOPY = 166;
  var CEIL = 172;

  var BOOKX0 = -HALF + SD + 1.6, BOOKX1 = HALF - SD + 1.2;
  var BOOKZ = ZBACK + 13.2;           // book centre, so the spines sit at the front

  var BK_D = 13.4;                    // how deep a book is, front to back
  var PULL = 14;                      // how far a pulled book slides out

  /* ---------------------------- material shortcuts ------------------------- */
  var WOOD_C = { m: 'wood', weight: 1.5 };
  var SEAM = { m: 'crease', weight: 1.1 };
  var HAIR = { m: 'hair' };
  var FINE = { m: 'fine' };
  var PAINT = { m: 'accent', fill: '#efece6', weight: 1.25 };
  var PAGES = { m: 'paper', fill: '#fdfdfb', weight: 1.05 };
  var BRASS = { m: 'brass', weight: 1.3 };

  /* ------------------------------ small helpers ---------------------------- */
  /* A box authored face by face, so we can hang a pick tag on it and keep the
     material of every face explicit. Wound counter-clockwise from outside. */
  function box(g, x0, y0, z0, x1, y1, z1, mat, hit, edges) {
    var a = g.v(x0, y0, z0), b = g.v(x1, y0, z0), c = g.v(x1, y1, z0), d = g.v(x0, y1, z0);
    var e = g.v(x1, y0, z1), f = g.v(x0, y0, z1), h = g.v(x0, y1, z1), k = g.v(x1, y1, z1);
    g.face([a, b, c, d], mat, { hit: hit });      // -Z
    g.face([e, k, h, f], mat, { hit: hit });      // +Z
    g.face([b, e, k, c], mat, { hit: hit });      // +X
    g.face([f, h, d, a], mat, { hit: hit });      // -X
    g.face([d, h, k, c], mat, { hit: hit });      // +Y
    g.face([a, f, e, b], mat, { hit: hit });      // -Y
    if (edges !== null) {
      var em = edges === undefined ? 'crease' : edges;
      g.edge(a, b, em); g.edge(b, c, em); g.edge(c, d, em); g.edge(d, a, em);
      g.edge(f, e, em); g.edge(e, k, em); g.edge(k, h, em); g.edge(h, f, em);
      g.edge(a, f, em); g.edge(b, e, em); g.edge(c, k, em); g.edge(d, h, em);
    }
  }

  /* A single book. Origin at the centre of its spine, so a yaw about Y tips
     the book about its spine and the spine stays in place on the shelf. */
  function buildBook(g, w, h, d, mat, opts) {
    opts = opts || {};
    var hw = w / 2, hh = h / 2, hd = d / 2;
    box(g, -hw, -hh, -hd, hw, hh, hd, mat, null);
    // the page block: a slab just inside the fore edge, in the lighter paper
    box(g, hw - w * 0.34, -hh + 0.55, -hd + 0.5, hw + 0.12, hh - 0.55, hd - 0.5, PAGES, null, 'hair');
    if (opts.flat) {
      // a book lying flat shows its page edges along the top as well
      box(g, -hw + 0.6, hh - 0.4, -hd + 0.6, hw - 0.6, hh + 0.14, hd - 0.7, PAGES, null, 'hair');
    } else {
      // a label stripe on the spine, and a fine rule below it
      box(g, -hw - 0.04, hh * 0.40, -hd - 0.1, hw + 0.04, hh * 0.60, -hd + 0.14, PAINT, null, null);
      box(g, -hw - 0.04, -hh * 0.70, -hd - 0.1, hw + 0.04, -hh * 0.56, -hd + 0.14, mat, null, null);
    }
  }

  /* --------------------------- the bookcase itself ------------------------- */
  function drawCase(g) {
    var i, j;
    // two sides
    box(g, -HALF, 0, 0, -HALF + SD, TOPY, FZ, WOOD_C, 'main');
    box(g, HALF - SD, 0, 0, HALF, TOPY, FZ, WOOD_C, 'main');
    // the top board
    box(g, -HALF, TOPY, 0, HALF, CEIL, FZ, WOOD_C, 'main');
    // the shaped plinth: a canted profile running right across the case
    var plinth = [
      [-HALF, 0], [HALF, 0], [HALF - 3, 4], [HALF - 6, 15], [-HALF + 6, 15], [-HALF + 3, 4],
    ];
    g.prism(plinth, 0, FZ, 'woodDark');
    g.edge(g.v(-HALF + 6, 15, FZ), g.v(HALF - 6, 15, FZ), FINE);
    g.edge(g.v(-HALF + 3, 4, FZ), g.v(HALF - 3, 4, FZ), HAIR);
    // the back panel, with a vertical grain
    box(g, -HALF + SD, 15, ZBACK, HALF - SD, TOPY, ZBACK + 2, WOOD_C, 'main');
    for (i = 1; i < 11; i++) {
      var gx = -HALF + SD + (B.w - 2 * SD) * (i / 11);
      g.edge(g.v(gx, 16, ZBACK + 2.2), g.v(gx, TOPY - 0, ZBACK + 2.2), i % 3 ? HAIR : FINE);
    }
    // the four shelves, and their pin holes down the sides
    for (i = 0; i < SHELF.length; i++) {
      var y = SHELF[i];
      box(g, -HALF + SD, y - SD, IN0, HALF - SD, y, IN1, WOOD_C, 'main');
      g.edge(g.v(-HALF + SD + 1, y - SD + 1.2, IN1), g.v(HALF - SD - 1, y - SD + 1.2, IN1), HAIR);
      for (j = 0; j < 4; j++) {
        var yy = y - 10 + j * 5;
        g.circleOutline([-HALF + SD + 1.1, yy, IN1 - 3.2], 0.9, 'x', 'hair', 8);
        g.circleOutline([HALF - SD - 1.1, yy, IN1 - 3.2], 0.9, 'x', 'hair', 8);
        g.circleOutline([-HALF + SD + 1.1, yy, ZBACK + 4.4], 0.9, 'x', 'hair', 8);
        g.circleOutline([HALF - SD - 1.1, yy, ZBACK + 4.4], 0.9, 'x', 'hair', 8);
      }
    }
    // a shadow line in the reveal under each shelf
    for (i = 0; i < SHELF.length; i++) {
      g.edge(g.v(-HALF + SD, SHELF[i] - SD - 0.4, IN1), g.v(HALF - SD, SHELF[i] - SD - 0.4, IN1), HAIR);
    }
  }

  /* -------------------------------- the plant ------------------------------ */
  function drawPlant(g) {
    var px = -224, pz = ZBACK + 12, base = SHELF[4];
    g.lathe([[4.6, base + 0.8], [5.4, base + 1.4], [4.6, base + 1.8]], { segments: 14, mat: 'whiteSoft', edges: true, edgeMat: 'fine', meridians: 6 });
    g.lathe([[5.8, base + 1.6], [6.4, base + 2.4], [6.2, base + 8.6], [5.6, base + 9.4]], { segments: 14, mat: 'whiteSoft', edges: true, edgeMat: 'fine', meridians: 6 });
    g.lathe([[5.9, base + 9.4], [6.2, base + 10.1], [5.7, base + 10.4]], { segments: 14, mat: 'whiteSoft', edges: true, edgeMat: 'fine', meridians: 6 });
    g.circleOutline([px, base + 10.4, pz], 5.6, 'y', 'fine', 14);
    // five leaves, each a bowed blade in its own yaw
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2 + 0.4;
      var ca = Math.cos(a), sa = Math.sin(a);
      var lw = 2.6 + (i % 2) * 0.5, rise = 10.5 + (i % 3) * 3;
      (function (ca, sa) {
        var N = 6, k;
        function rim(side, t) {
          var rxv = (lw / 2) * side * (1 - t * 0.35);
          var bow = Math.sin(t * Math.PI) * 1.5;      // the blade bows outward
          var x = px + ca * rxv - sa * bow;
          var z = pz + sa * rxv + ca * bow;
          var y = base + 9.4 + rise * (1 - Math.pow(1 - t, 1.5));
          return g.v(x, y, z);
        }
        var left = [], right = [];
        for (k = 0; k <= N; k++) {
          var t = k / N;
          left.push(rim(-1, t));
          right.push(rim(1, t));
        }
        // wound so the normal turns toward the camera side of the blade
        for (k = 0; k < N; k++) {
          g.face([left[k], right[k], right[k + 1], left[k + 1]], 'leaf');
        }
        g.polyline(left, 'fine');
        g.polyline(right, 'hair');
        g.edge(left[0], right[0], 'hair');
      })(ca, sa);
    }
    g.edge(g.v(px, base + 10, pz - 2.4), g.v(px, base + 10 + 12, pz - 1.6), HAIR);
  }

  /* -------------------------------- the bookend ---------------------------- */
  function drawBookend(g) {
    var x = -152, z0 = ZBACK + 4, z1 = z0 + 11;
    var profile = [
      [0, 0], [4.2, 0], [4.2, 8.6], [1.3, 8.6], [1.3, 6.4], [0, 6.4],
    ];
    g.prism(profile, z0, z1, 'brass');
    g.edge(g.v(4.2, 8.6, z0), g.v(4.2, 8.6, z1), FINE);
    g.edge(g.v(0, 6.4, z1), g.v(1.3, 6.4, z1), FINE);
    g.circleOutline([x + 2.1, SHELF[4] + 0.15, z0 + 5.5], 1.5, 'y', 'hair', 10);
  }

  /* ------------------------------ the library ------------------------------ */
  /* Per-shelf run: how many books, their width and height ranges, and which of
     them lean. Deterministic, so the case always looks the same. */
  var RUNS = [
    { n: 7, w0: 2.4, w1: 3.6, h0: 15.5, h1: 19.4, lean: [3, 5, 6], seed: 11 },
    { n: 8, w0: 1.9, w1: 3.0, h0: 17.2, h1: 20.6, lean: [2, 6], seed: 23, stack: true },
    { n: 9, w0: 1.8, w1: 2.8, h0: 17.0, h1: 20.8, lean: [1, 2, 3], seed: 37 },
    { n: 8, w0: 2.4, w1: 3.5, h0: 18.6, h1: 22.6, lean: [2, 6, 7], seed: 53 },
  ];
  var SPAN = BOOKX1 - BOOKX0;         // ~86.4 of clear width

  /* the flat stacks: shelf index -> list of [w, h, d, lean, dx] */
  var STACKS = {
    1: [
      [12.2, 2.3, 17.6, 13, 0.000, 0.0],
      [11.4, 1.9, 16.4, 12.4, 0.038, 0.5],
      [10.8, 2.6, 15.2, 11.8, -0.030, -0.6],
    ],
  };

  /* Material variation: most books off-white, a few in a darker board. */
  var MATS = [
    { m: 'paper', fill: '#fdfdfb', weight: 1.15 },
    { m: 'whiteSoft', fill: '#f8f7f4', weight: 1.3 },
    { m: 'accent', fill: '#eceae2', weight: 1.3 },
    { m: 'fabric2', fill: '#f1eee8', weight: 1.35 },
    { m: 'dark', fill: '#e2e0dc', weight: 1.4 },
    { m: 'woodDark', fill: '#f1e9dd', weight: 1.35 },
  ];

  /* ------------------------------ the module ------------------------------- */
  PLR.objects.shelf = {
    id: 'shelf',
    build: function (app) {
      var scene = app.scene, state = app.state;
      var node = scene.group(scene.root, {
        name: 'bookshelf',
        p: [B.x, 0, L.z0],
      });
      drawCase(node._g);

      var books = [];
      var idx = 0;

      function addBook(px, boxOff, w, h, d, yaw, lift, mat, flat) {
        var bn = scene.group(node, {
          name: 'bk' + idx,
          p: [px, lift, BOOKZ + boxOff],
          yaw: yaw,
        });
        buildBook(bn._g, w, h, d, mat, { flat: flat });
        var rec = {
          p: [px, lift, BOOKZ + boxOff],
          yaw: yaw,
          out: 0,
          want: 0,
          hover: 0,
          wantHover: 0,
          i: idx,
        };
        var tag = 'bk' + idx;
        var pr = PLR.interact.make(scene, bn, {
          id: tag,
          label: '书',
          hit: tag,
          hintDims: [w, h, d],
          enter: function () { rec.wantHover = 1; },
          leave: function () { rec.wantHover = 0; },
          onClick: function (p) {
            rec.want = rec.want > 0.5 ? 0 : 1;
            PLR.audio.page(rec.i);
            p.setStatus(rec.want > 0.5 ? '抽出 · 待读' : '归架');
          },
        });
        rec.pr = pr;
        bn.behavior = {
          update: function (dt) {
            rec.out = damp(rec.out, rec.want, 4.2, dt);
            rec.hover = damp(rec.hover, rec.wantHover, 9, dt);
            bn.setTransform({
              p: [
                rec.p[0],
                rec.p[1] + PULL * rec.out * 0.16 + 0.6 * rec.hover,
                rec.p[2] + PULL * rec.out + 1.2 * rec.hover,
              ],
              yaw: rec.yaw + 0.06 * rec.out,
            });
            bn.touch();
          },
          post: function () { pr.hitRegion(app.renderer, tag); },
        };
        bn.touch();
        books.push(rec);
        idx++;
      }

      for (var s = 0; s < RUNS.length; s++) {
        var run = RUNS[s], y = SHELF[s];
        var n = run.n, wsum = 0, k;
        var widths = [], heights = [];
        var stackW = STACKS[s] ? 16.5 : 0;
        var startX = BOOKX0 + stackW;
        var avail = BOOKX1 - startX - (n - 1) * 0.7;
        for (k = 0; k < n; k++) {
          var r1 = PLR.math.hash01(run.seed + k * 3.1);
          var r2 = PLR.math.hash01(run.seed + k * 7.7 + 2.3);
          widths.push(run.w0 + (run.w1 - run.w0) * r1);
          heights.push(run.h0 + (run.h1 - run.h0) * r2);
          wsum += widths[k];
        }
        var scale = avail / wsum;
        // fill from the right end leftwards, so the tall books sit on the right
        var cursor = BOOKX1;
        for (k = 0; k < n; k++) {
          var w = widths[k] * scale;
          var h = heights[k];
          var px = cursor - w / 2;
          cursor -= w + 0.7;
          var leanIdx = run.lean ? run.lean.indexOf(k) : -1;
          var yaw = leanIdx >= 0 ? -(0.20 + leanIdx * 0.045) : 0;
          var lift = (1 - Math.cos(yaw)) * w / 2 + 0.05;
          var mat = MATS[(Math.floor(PLR.math.hash01(run.seed + k * 11.3) * 1000)) % MATS.length];
          addBook(px - B.x, 0, w, h, BK_D, yaw, lift + y, mat, false);
        }
        // the flat stack at the left end of its shelf
        if (STACKS[s]) {
          var st = STACKS[s], sy = y;
          for (k = 0; k < st.length; k++) {
            var b = st[k];
            addBook(startX + 8 - B.x + b[5], 0, b[0], b[1], b[2], b[4], sy + b[1] / 2 + 0.1, MATS[k % MATS.length], true);
            sy += b[1] + 0.15;
          }
        }
      }

      drawPlant(node._g);
      drawBookend(node._g);

      /* ------------------------------ the proxy ---------------------------- */
      var pr = PLR.interact.make(scene, node, {
        id: 'bookshelf',
        label: '书架',
        hit: 'main',
        hintDims: [B.w, B.h, B.d],
        enter: function (p) { p.setStatus(countOut() + ' 本抽出'); },
        leave: function (p) { p.setStatus(countOut() + ' 本抽出'); },
        press: function (p, down) { if (down) PLR.audio.resume(); },
      });

      function countOut() {
        var c = 0;
        for (var q = 0; q < books.length; q++) if (books[q].want > 0.5) c++;
        return c;
      }
      pr.setStatus('0 本抽出');

      node.behavior = {
        // post(node, renderer, scene)
        post: function (n, renderer) {
          // the case itself is the proxy's own target — registering it also
          // draws the hover outline and the label tag — then every book
          // registers its own pick tag ('bk0' … 'bk35')
          var q;
          for (q = 0; q < books.length; q++) {
            books[q].pr.hitRegion(renderer, books[q].pr.opts.hit);
          }
          pr.hitRegion(renderer, 'main');
        },
      };
      node.touch();
      return node;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
