/* =============================================================================
   Pure Line Room — shelf.js  ·  书柜区 (bookshelf zone)
   x -1.70…0.55, z -2.60…-2.15   (nothing is built north of z = -2.598)

   A 2.20 × 1.92 × 0.34 bookcase standing against the north wall:

     · carcass — two side panels with real thickness, a boarded back panel, a
       plinth with a recessed toe kick, a top board and a crown that oversails
       the sides;
     · five shelf boards with front edge bands, six unequal dividers (bays of
       0.36 / 0.72 / 0.60 / 0.42 m plus three short dividers that cut a single
       bay in half), shelf-pin columns and dowel heads at the joints;
     · a lower cabinet (y 0…0.62) — two drawers side by side with a fixed rail
       above them, two doors on the right half.  All four open smoothly onto a
       packed interior;
     · 43 books laid out by a hand-written plan with deterministic jitter,
       three of which pull out when clicked;
     · a small stack of books on top of the case, clear of the wall picture.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;
  var G = P.geom;
  var K = P.K;

  /* ---------------------------------------------------------------------------
     1. Layout — every number in metres, world space.
     ------------------------------------------------------------------------- */
  var C = {
    X0: -1.680, X1: 0.520,          // 2.20 wide
    ZB: -2.590, ZF: -2.250,         // 0.34 deep, back panel on the wall
    H: 1.920,                       // case height, crown included
    SIDE: 0.024,                    // carcass side thickness
    BACK: 0.014,                    // back panel
    TOPB: 0.024,                    // top board
    CROWN: 0.020,                   // crown / cornice
    PLINTH: 0.072,                  // plinth height
    SHELF: 0.024,                   // shelf board
    DIV: 0.018,                     // divider thickness
    CABTOP: 0.025,                  // board between cabinet and shelves
    FRONT: 0.020                    // drawer / door front thickness
  };
  var XL = C.X0 + C.SIDE;                    // -1.656 : inner face, left side
  var XR = C.X1 - C.SIDE;                    //  0.496 : inner face, right side
  var ZBI = C.ZB + C.BACK;                   // -2.576 : front face of back panel
  var ZFR = C.ZF - C.FRONT;                  // -2.270 : carcass front / back of fronts
  var TOPU = C.H - C.CROWN - C.TOPB;         //  1.876 : underside of the top board
  var TOPTOP = TOPU + C.TOPB;                //  1.900 : top board surface
  var CABT = 0.620;                          // underside of the cabinet top board
  var CABTOP = CABT + C.CABTOP;              //  0.645 : first shelf surface

  // The five shelf boards (bottom face of each) — the cabinet top board is the
  // fifth — and the five bays they make.  Every bay is a different height.
  var SHELF_Y = [0.900, 1.150, 1.430, 1.680];
  var ROW = [
    { f: CABTOP, c: 0.900 },   // 0.255 clear — big art books
    { f: 0.924, c: 1.150 },   // 0.226
    { f: 1.174, c: 1.430 },   // 0.256 — the tallest bay
    { f: 1.454, c: 1.680 },   // 0.226
    { f: 1.704, c: TOPU }     // 0.172 — the short paperback bay
  ];

  // Vertical dividers: {x: left face, y0, y1}.  Deliberately unequal — bays of
  // 0.44 / 0.38 / 0.32 / 0.48 / 0.46 — and three of them cut a single bay or a
  // single pair of bays, so nothing reads as a grid.
  var DIVS = [
    { x: -1.216, y0: CABTOP, y1: TOPU },     // full height
    { x: -0.818, y0: CABTOP, y1: 1.680 },    // shelves 1-4
    { x: -0.480, y0: CABTOP, y1: 1.430 },    // shelves 1-3
    { x: 0.018, y0: CABTOP, y1: TOPU },      // full height
    { x: -0.222, y0: 1.174, y1: 1.430 },     // shelf 3 only, inside bay D
    { x: -1.400, y0: 1.454, y1: TOPU },      // shelves 4-5, inside bay A
    { x: 0.270, y0: 1.704, y1: TOPU }        // shelf 5 only, inside bay E
  ];

  // Cabinet fronts.
  var DRW = [                                  // left half: two drawers
    { x0: -1.676, x1: -1.137 },
    { x0: -1.125, x1: -0.586 }
  ];
  var DRW_Y0 = 0.084, DRW_Y1 = 0.400;
  var RAIL_Y0 = 0.410, RAIL_Y1 = 0.616;        // fixed rail over the drawers
  var DOOR = [                                 // right half: two doors
    { x0: -0.574, x1: -0.035, hinge: -0.574, side: -1 },
    { x0: -0.023, x1: 0.516, hinge: 0.516, side: 1 }
  ];
  var DOOR_Y0 = 0.084, DOOR_Y1 = 0.616;
  var PART = [                                 // cabinet partitions
    { x0: -1.143, x1: -1.125 },                // between the two drawers
    { x0: -0.598, x1: -0.580 },                // drawers | doors
    { x0: -0.041, x1: -0.023 }                 // between the two doors
  ];
  var CABFLOOR = 0.086;                        // top face of the cabinet floor
  var MIDFIX = [0.395, 0.412];                 // fixed shelf in each door bay

  /* motion */
  var DRAW_TRAVEL = 0.28;                      // m toward +z, into the room
  var DOOR_SWING = 100 * Math.PI / 180;
  var BOOK_TRAVEL = 0.13;
  var BOOK_TILT = 4 * Math.PI / 180;

  /* ---------------------------------------------------------------------------
     2. Small helpers
     ------------------------------------------------------------------------- */
  // Exponential approach; prefers the runtime's PLR.anim and falls back to the
  // identical maths so the module also runs before main.js exists.  The tail is
  // snapped once it is under 0.1% of the travel — far below a pixel on screen —
  // so a closed drawer really does land back on its rest pose.
  function approach(cur, target, speed, dt) {
    var A = P.anim;
    var v = (A && typeof A.approach === 'function')
      ? A.approach(cur, target, speed, dt)
      : cur + (target - cur) * (1 - Math.exp(-speed * dt));
    if (Math.abs(target - v) < 1e-3) v = target;
    return v;
  }

  // Baked per-face shading, so no two faces of a panel are equally bright.
  var FSH = { pz: 0.016, nz: 0.058, px: 0.040, nx: 0.040, py: 0.000, ny: 0.068 };

  function shadeOf(base, key) {
    return M.clamp(base + FSH[key], 0, 0.08);
  }

  /** A box from two corners.  Returns the 8 vertex ids. */
  function bx(m, X0, Y0, Z0, X1, Y1, Z1, o) {
    o = o || {};
    return slab(m, [
      [X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1],
      [X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1]
    ], o);
  }

  /** A box from 8 corners in scene.js order (0..3 bottom ccw, 4..7 top ccw). */
  function slab(m, p, o) {
    o = o || {};
    var vi = m.vertices(p);
    var fill = o.fill === undefined ? '@wood' : o.fill;
    var kind = o.kind || K.EDGE;
    var cull = o.cull !== false;
    var base = o.shade || 0;
    var open = o.open || {};
    var F = [
      ['pz', [vi[3], vi[2], vi[6], vi[7]]],
      ['nz', [vi[1], vi[0], vi[4], vi[5]]],
      ['px', [vi[2], vi[1], vi[5], vi[6]]],
      ['nx', [vi[0], vi[3], vi[7], vi[4]]],
      ['py', [vi[4], vi[7], vi[6], vi[5]]],
      ['ny', [vi[0], vi[1], vi[2], vi[3]]]
    ];
    for (var i = 0; i < F.length; i++) {
      if (open[F[i][0]]) continue;
      m.face(F[i][1], {
        fill: fill, kind: kind, cull: cull,
        shade: shadeOf(base, F[i][0]),
        dot: o.dot || 0, glow: o.glow || 0
      });
    }
    if (o.lines) {
      for (var L = 0; L < o.lines.length; L++) {
        G.line(m, p[o.lines[L][0]], p[o.lines[L][1]], { kind: o.lineKind || K.EDGE });
      }
    }
    return vi;
  }

  /** A single quad, a,b,c,d counter-clockwise seen from the front side. */
  function quad(m, a, b, c, d, o) {
    o = o || {};
    return m.face(m.vertices([a, b, c, d]), {
      fill: o.fill === undefined ? null : o.fill,
      kind: o.kind || K.EDGE, cull: o.cull === true,
      shade: o.shade || 0, dot: o.dot || 0
    });
  }

  /** Copy of a mesh's vertex list — the rest pose every animation returns to. */
  function snap(m) {
    var out = new Array(m.verts.length);
    for (var i = 0; i < m.verts.length; i++) {
      out[i] = [m.verts[i][0], m.verts[i][1], m.verts[i][2]];
    }
    return out;
  }

  /** Write mesh vertices from the rest pose through a transform. */
  function pose(m, base, fn) {
    for (var i = 0; i < base.length; i++) {
      var v = fn(base[i][0], base[i][1], base[i][2]);
      m.verts[i][0] = v[0]; m.verts[i][1] = v[1]; m.verts[i][2] = v[2];
    }
    m.invalidate();
  }

  function hitOf(m, pad) {
    var b = m.getBounds();
    pad = pad || 0;
    return {
      min: [b.min[0] - pad, b.min[1] - pad, b.min[2] - pad],
      max: [b.max[0] + pad, b.max[1] + pad, b.max[2] + pad]
    };
  }

  function syncHit(o, m) {
    var b = m.getBounds();
    o.hit.min[0] = b.min[0]; o.hit.min[1] = b.min[1]; o.hit.min[2] = b.min[2];
    o.hit.max[0] = b.max[0]; o.hit.max[1] = b.max[1]; o.hit.max[2] = b.max[2];
  }

  /* ---------------------------------------------------------------------------
     3. Books — one deterministic book at a time.
     ------------------------------------------------------------------------- */
  var SPINE_LIGHT = ['@paper', '@fabric', '@rug', '@fabricAlt', '@rugAlt',
    '@screen', '@metal', '@floorAlt', '@wood', '@accent', '@paper', '@fabric'];
  var SPINE_DARK = ['#2a2b33', '#3b3f4d', '#37474f', '#54463c', '#2f3b33'];

  /**
   * o: {x, y (shelf surface), z1 (spine plane), t, h, d, fill, dark,
   *     lean: {s, px, py, a} | null, bands, title, cover}
   * Draws only the four faces that can be seen from the room — spine, fore
   * edge, far cover, top edges — plus the spine marks.
   */
  function addBook(m, o) {
    var x0 = o.x, x1 = o.x + o.t, y0 = o.y, y1 = o.y + o.h;
    var z1 = o.z1, z0 = z1 - o.d;
    var L = o.lean || null;
    var ca = L ? Math.cos(L.a) : 1, sa = L ? Math.sin(L.a) : 0;

    function T(x, y, z) {
      if (!L) return [x, y, z];
      var u = (x - L.px) * L.s, v = y - L.py;
      return [L.px + L.s * (u * ca + v * sa), L.py + (v * ca - u * sa), z];
    }
    var vi = m.vertices([
      T(x0, y0, z0), T(x1, y0, z0), T(x1, y0, z1), T(x0, y0, z1),
      T(x0, y1, z0), T(x1, y1, z0), T(x1, y1, z1), T(x0, y1, z1)
    ]);
    var dark = !!o.dark;
    m.face([vi[3], vi[2], vi[6], vi[7]], { fill: o.fill, kind: K.EDGE, cull: true, shade: 0.012 });
    m.face([vi[2], vi[1], vi[5], vi[6]], { fill: '@paper', kind: K.FINE, cull: true, shade: 0.05 });
    m.face([vi[0], vi[3], vi[7], vi[4]], { fill: o.fill, kind: K.FINE, cull: true, shade: 0.05 });
    m.face([vi[4], vi[7], vi[6], vi[5]], { fill: '@paper', kind: K.FINE, cull: true, shade: 0.02 });

    var em = 0.0008;
    // A spine mark: an ink line on a light spine, a light bar on a dark one.
    function mark(xa, xb, y, w) {
      if (dark) {
        quad(m, T(xa, y - w, z1 + em), T(xb, y - w, z1 + em),
          T(xb, y + w, z1 + em), T(xa, y + w, z1 + em),
          { fill: '@paper', kind: K.FINE, shade: 0.02 });
      } else {
        G.line(m, T(xa, y, z1 + em), T(xb, y, z1 + em), { kind: K.FINE });
      }
    }
    var bands = o.bands === undefined ? 2 : o.bands;
    var bandY = [0.82, 0.18, 0.50];
    for (var b = 0; b < bands && b < 3; b++) mark(x0, x1, y0 + o.h * bandY[b], 0.0024);
    var dashes = o.title === undefined ? 2 : o.title;
    for (var q = 0; q < dashes && q < 4; q++) {
      mark(x0 + o.t * 0.24, x0 + o.t * 0.76, y0 + o.h * (0.40 + q * 0.055), 0.0022);
    }
    if (o.cover) {
      G.line(m, T(x0 + o.t * 0.14, y1 + em, z1 - 0.014), T(x0 + o.t * 0.86, y1 + em, z1 - 0.014), { kind: K.SOFT });
      G.line(m, T(x0 + 0.003, y1 + em, z1 - 0.026), T(x1 - 0.003, y1 + em, z1 - 0.026), { kind: K.SOFT });
    } else {
      G.line(m, T(x0 + 0.002, y1 + em, z1 - 0.020), T(x1 - 0.002, y1 + em, z1 - 0.020), { kind: K.SOFT });
    }
    return { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1 };
  }

  /* ---------------------------------------------------------------------------
     4. Build
     ------------------------------------------------------------------------- */
  function build(sctx) {
    var S = sctx.scene;
    var reg = sctx.register;
    var parts = sctx.parts || (sctx.parts = {});
    var i;

    /* ======================= 4a. the carcass ============================== */
    var caseM = S.addMesh();
    parts.shelfCase = caseM;

    /* plinth with a recessed toe kick */
    var TOE = 0.030;
    bx(caseM, C.X0 + TOE, 0, C.ZB + 0.006, C.X1 - TOE, C.PLINTH, C.ZF - TOE,
      { fill: '@woodDark', kind: K.FINE, shade: 0.02 });
    G.line(caseM, [C.X0, C.PLINTH, C.ZF - TOE], [C.X1, C.PLINTH, C.ZF - TOE], { kind: K.FINE });

    /* side panels — the case silhouette takes the heavy ink */
    bx(caseM, C.X0, C.PLINTH, C.ZB, XL, TOPTOP, C.ZF, { fill: '@wood', kind: K.EDGE });
    bx(caseM, XR, C.PLINTH, C.ZB, C.X1, TOPTOP, C.ZF, { fill: '@wood', kind: K.EDGE });
    G.line(caseM, [C.X0, C.PLINTH, C.ZF], [C.X0, TOPTOP, C.ZF], { kind: K.SIL });
    G.line(caseM, [C.X1, C.PLINTH, C.ZF], [C.X1, TOPTOP, C.ZF], { kind: K.SIL });
    G.line(caseM, [C.X0, TOPTOP, C.ZF], [C.X0, TOPTOP, C.ZB + 0.002], { kind: K.FINE });
    G.line(caseM, [C.X1, TOPTOP, C.ZF], [C.X1, TOPTOP, C.ZB + 0.002], { kind: K.FINE });
    // end grain on each side panel, so the side is not one flat slab
    G.line(caseM, [C.X0 + 0.004, C.PLINTH + 0.004, C.ZF], [XL, C.PLINTH + 0.004, C.ZF], { kind: K.SOFT });
    G.line(caseM, [XR, C.PLINTH + 0.004, C.ZF], [C.X1 - 0.004, C.PLINTH + 0.004, C.ZF], { kind: K.SOFT });
    G.line(caseM, [C.X0 + 0.003, 1.100, C.ZF], [C.X0 + 0.003, TOPTOP - 0.02, C.ZF], { kind: K.SOFT });
    G.line(caseM, [C.X1 - 0.003, C.PLINTH + 0.02, C.ZF], [C.X1 - 0.003, 1.100, C.ZF], { kind: K.SOFT });

    /* back panel: four vertical boards, faintly drawn.  The face is split into
       patches on purpose — the renderer sorts faces by mean/near eye depth, and
       one 2.1 m wide quad out-sorts (and so paints over) most of the books in
       front of it.  Board-sized patches sort locally and stay behind them. */
    bx(caseM, XL, C.PLINTH, C.ZB, XR, TOPU, ZBI,
      { fill: '@woodDark', kind: K.FINE, shade: 0.03, open: { nz: true, pz: true } });
    var bz = ZBI;
    for (var bc = 0; bc < 7; bc++) {
      for (var br = 0; br < 2; br++) {
        var px0 = XL + (XR - XL) * (bc / 7), px1 = XL + (XR - XL) * ((bc + 1) / 7);
        var py0 = C.PLINTH + (TOPU - C.PLINTH) * (br / 2), py1 = C.PLINTH + (TOPU - C.PLINTH) * ((br + 1) / 2);
        quad(caseM, [px0, py0, bz], [px1, py0, bz], [px1, py1, bz], [px0, py1, bz],
          { fill: '@woodDark', kind: K.SOFT, shade: 0.03 });
      }
    }
    G.line(caseM, [XL + 0.01, 1.020, bz], [XR - 0.01, 1.020, bz], { kind: K.SOFT });

    /* top board, then the crown that oversails the sides */
    bx(caseM, XL, TOPU, C.ZB, XR, TOPTOP, C.ZF, { fill: '@wood', kind: K.EDGE });
    bx(caseM, C.X0 - 0.015, TOPTOP, C.ZB - 0.008, C.X1 + 0.015, C.H, C.ZF + 0.032,
      { fill: '@wood', kind: K.EDGE, shade: 0.008, open: { ny: true } });
    G.line(caseM, [C.X0 - 0.015, C.H, C.ZF + 0.032], [C.X1 + 0.015, C.H, C.ZF + 0.032], { kind: K.SIL });
    G.line(caseM, [C.X0 - 0.015, TOPTOP + 0.006, C.ZF + 0.032], [C.X1 + 0.015, TOPTOP + 0.006, C.ZF + 0.032], { kind: K.FINE });
    G.line(caseM, [C.X0 - 0.015, C.H, C.ZF + 0.032], [C.X0 - 0.015, TOPTOP, C.ZF + 0.032], { kind: K.SIL });
    G.line(caseM, [C.X1 + 0.015, C.H, C.ZF + 0.032], [C.X1 + 0.015, TOPTOP, C.ZF + 0.032], { kind: K.SIL });

    /* ======================= 4b. cabinet carcass ========================== */
    bx(caseM, XL, C.PLINTH, ZBI, XR, CABFLOOR, ZFR, { fill: '@woodDark', kind: K.FINE, shade: 0.02 });
    bx(caseM, XL, CABT, ZBI, XR, CABTOP, C.ZF - 0.002, { fill: '@wood', kind: K.EDGE, shade: 0.008 });
    G.line(caseM, [XL, CABT + 0.006, C.ZF - 0.002], [XR, CABT + 0.006, C.ZF - 0.002], { kind: K.FINE });

    for (i = 0; i < PART.length; i++) {
      bx(caseM, PART[i].x0, CABFLOOR, ZBI, PART[i].x1, CABT, ZFR, { fill: '@wood', kind: K.FINE });
    }
    // fixed shelves inside the two door bays
    bx(caseM, PART[1].x1, MIDFIX[0], ZBI, PART[2].x0, MIDFIX[1], ZFR, { fill: '@wood', kind: K.FINE });
    bx(caseM, PART[2].x1, MIDFIX[0], ZBI, XR, MIDFIX[1], ZFR, { fill: '@wood', kind: K.FINE });
    // the fixed rail over the drawers — it is also the drawer boxes' ceiling
    bx(caseM, C.X0, RAIL_Y0, ZBI, PART[1].x0, RAIL_Y1, C.ZF, { fill: '@wood', kind: K.EDGE, shade: 0.008 });
    G.line(caseM, [C.X0, RAIL_Y0, C.ZF], [PART[1].x0, RAIL_Y0, C.ZF], { kind: K.FINE });
    G.line(caseM, [C.X0, DRW_Y1, C.ZF], [DRW[0].x0, DRW_Y1, C.ZF], { kind: K.FINE });
    G.line(caseM, [DRW[1].x1, DRW_Y1, C.ZF], [PART[1].x0, DRW_Y1, C.ZF], { kind: K.FINE });
    G.line(caseM, [PART[1].x1, C.PLINTH, C.ZF], [PART[1].x1, RAIL_Y0, C.ZF], { kind: K.FINE });

    /* contents of the two door bays — revealed when a door swings open */
    function pageEdges(m, x, y0, y1, z0, z1, n) {
      for (var q = 1; q <= n; q++) {
        var zz = z0 + (z1 - z0) * (q / (n + 1));
        G.line(m, [x, y0 + 0.012, zz], [x, y1 - 0.022, zz], { kind: K.SOFT });
      }
    }
    // left bay: two upright folders / magazines with visible page edges
    var F1X = PART[1].x1 + 0.052;
    bx(caseM, F1X, CABFLOOR, -2.500, F1X + 0.036, CABFLOOR + 0.300, -2.296,
      { fill: '@fabricAlt', kind: K.EDGE, shade: 0.008 });
    pageEdges(caseM, F1X + 0.0364, CABFLOOR, CABFLOOR + 0.300, -2.296, -2.500, 3);
    G.line(caseM, [F1X, CABFLOOR + 0.300, -2.296], [F1X + 0.036, CABFLOOR + 0.300, -2.296], { kind: K.FINE });
    bx(caseM, F1X + 0.064, CABFLOOR, -2.468, F1X + 0.094, CABFLOOR + 0.276, -2.306,
      { fill: '@accent', kind: K.EDGE, shade: 0.008 });
    pageEdges(caseM, F1X + 0.0944, CABFLOOR, CABFLOOR + 0.276, -2.306, -2.468, 2);
    // ... and two flat books on the fixed shelf above them
    addBook(caseM, { x: F1X - 0.004, y: MIDFIX[1], z1: -2.336, t: 0.225, h: 0.030, d: 0.150, fill: '@rug', bands: 1, title: 2, cover: true });
    addBook(caseM, { x: F1X + 0.008, y: MIDFIX[1] + 0.032, z1: -2.342, t: 0.214, h: 0.028, d: 0.144, fill: '@metal', bands: 1, title: 2, cover: true });
    // right bay: a small box, and a stack beside it
    var BXX = PART[2].x1 + 0.070;
    bx(caseM, BXX, CABFLOOR, -2.480, BXX + 0.170, CABFLOOR + 0.205, -2.314,
      { fill: '@woodDark', kind: K.EDGE, shade: 0.008 });
    G.line(caseM, [BXX, CABFLOOR + 0.150, -2.314], [BXX + 0.170, CABFLOOR + 0.150, -2.314], { kind: K.FINE });
    G.line(caseM, [BXX + 0.085, CABFLOOR + 0.150, -2.314], [BXX + 0.085, CABFLOOR + 0.205, -2.314], { kind: K.FINE });
    addBook(caseM, { x: BXX + 0.218, y: CABFLOOR, z1: -2.326, t: 0.214, h: 0.034, d: 0.152, fill: '@fabric', bands: 1, title: 2, cover: true });
    addBook(caseM, { x: BXX + 0.230, y: CABFLOOR + 0.036, z1: -2.334, t: 0.204, h: 0.030, d: 0.146, fill: '@rug', bands: 2, title: 2, cover: true });
    addBook(caseM, { x: BXX + 0.247, y: CABFLOOR + 0.068, z1: -2.340, t: 0.188, h: 0.026, d: 0.140, fill: '@paper', bands: 1, title: 3, cover: true });

    /* ======================= 4c. shelves & dividers ======================= */
    for (i = 0; i < SHELF_Y.length; i++) {
      var sy = SHELF_Y[i];
      bx(caseM, XL, sy, ZBI, XR, sy + C.SHELF, ZFR, { fill: '@wood', kind: K.EDGE, shade: 0.008 });
      // the 0.02 edge band on the front of every shelf board
      G.line(caseM, [XL, sy + 0.006, ZFR], [XR, sy + 0.006, ZFR], { kind: K.FINE });
      G.line(caseM, [XL, sy + C.SHELF, ZFR], [XR, sy + C.SHELF, ZFR], { kind: K.SOFT });
    }
    for (i = 0; i < DIVS.length; i++) {
      var dv = DIVS[i];
      bx(caseM, dv.x, dv.y0, ZBI, dv.x + C.DIV, dv.y1, ZFR, { fill: '@wood', kind: K.EDGE, shade: 0.006 });
      G.line(caseM, [dv.x + 0.002, dv.y0 + 0.016, ZFR], [dv.x + C.DIV - 0.002, dv.y0 + 0.016, ZFR], { kind: K.SOFT });
      G.line(caseM, [dv.x + 0.002, dv.y1 - 0.016, ZFR], [dv.x + C.DIV - 0.002, dv.y1 - 0.016, ZFR], { kind: K.SOFT });
    }

    /* shelf-pin columns on the two side panels */
    var PIN_Y = [0.912, 1.062, 1.212, 1.362, 1.512, 1.662, 1.812];
    function pin(m, x, y, dir) {
      var s = 0.0035;
      var a = [x, y - s, ZFR - 0.020], b = [x, y - s, ZFR - 0.054];
      var c = [x, y + s, ZFR - 0.054], d = [x, y + s, ZFR - 0.020];
      if (dir > 0) quad(m, a, b, c, d, { fill: '#d5cec1', kind: K.FINE, shade: 0.03 });
      else quad(m, d, c, b, a, { fill: '#d5cec1', kind: K.FINE, shade: 0.03 });
    }
    for (i = 0; i < PIN_Y.length; i++) {
      pin(caseM, XL + 0.0008, PIN_Y[i], 1);
      pin(caseM, XR - 0.0008, PIN_Y[i], -1);
    }
    // dowel heads at a few joints, on the faces we can actually see
    function dowel(m, x, y, z) {
      var pts = G.circlePts(x, y, z, 0.0055, 6, 'x');
      m.face(m.vertices(pts), { fill: '#c9c1b2', kind: K.FINE, cull: false, shade: 0.04 });
      G.line(m, [x, y - 0.004, z], [x, y + 0.004, z], { kind: K.FINE });
    }
    dowel(caseM, XL + 0.0009, 0.912, ZFR - 0.13);
    dowel(caseM, XL + 0.0009, 1.362, ZFR - 0.13);
    dowel(caseM, XL + 0.0009, 1.674, ZFR - 0.13);
    dowel(caseM, DIVS[0].x + C.DIV + 0.0009, 0.912, ZFR - 0.16);
    dowel(caseM, DIVS[1].x + C.DIV + 0.0009, 1.362, ZFR - 0.16);
    dowel(caseM, DIVS[2].x + C.DIV + 0.0009, 1.138, ZFR - 0.16);

    /* ======================= 4d. the books ================================ */
    var booksM = S.addMesh();
    parts.shelfBooks = booksM;
    var bookCount = 0;
    var lastDark = false;
    var pullBooks = [];

    function spineFill(seed) {
      var wantDark = G.rnd(seed * 3.13 + 0.31) < 0.20 && !lastDark;
      lastDark = wantDark;
      if (wantDark) {
        var k = Math.floor(G.rnd(seed * 5.11 + 0.77) * SPINE_DARK.length) % SPINE_DARK.length;
        return { fill: SPINE_DARK[k], dark: true };
      }
      var j = Math.floor(G.rnd(seed * 4.37 + 1.93) * SPINE_LIGHT.length) % SPINE_LIGHT.length;
      return { fill: SPINE_LIGHT[j], dark: false };
    }

    function newPullBook() {
      var m = S.addMesh();
      var rec = { mesh: m, info: null, id: 'book' + (pullBooks.length + 1) };
      pullBooks.push(rec);
      return rec;
    }
    var BK1 = newPullBook();   // shelf 4, right-hand bay
    var BK2 = newPullBook();   // shelf 3, behind the short divider
    var BK3 = newPullBook();   // shelf 3, left bay

    /**
     * Lay a run of upright books from o.x rightwards.
     * o: {r, x, n, h:[lo,hi], t:[lo,hi], seed, leanLast, xMax, special:{i:rec}}
     * `xMax` stops the run before it grows into the next divider, so a packed
     * bay really is packed; `n` is the cap.
     */
    function addRun(o) {
      var row = ROW[o.r], f = row.f, top = row.c;
      var x = o.x;
      for (var n = 0; n < o.n; n++) {
        var s = o.seed + n * 17;
        var t = G.rndRange(s + 1, o.t[0], o.t[1]);
        if (o.xMax !== undefined && x + t > o.xMax) break;
        var h = Math.min(top - f - 0.010, G.rndRange(s + 2, o.h[0], o.h[1]));
        var d = G.rndRange(s + 3, 0.146, 0.206);
        var z1 = -2.272 + G.rndRange(s + 4, 0, 0.013);
        var lean = null, b0 = x;
        if (o.leanLast && n === o.n - 1) {
          var a = G.rndRange(s + 5, 8, 15.5) * Math.PI / 180;
          var px = x + t * Math.cos(a) + h * Math.sin(a);
          lean = { s: -1, px: px, py: f, a: a };
          b0 = px - t;
        }
        var target = (o.special && o.special[n]) ? o.special[n].mesh : booksM;
        var sp = spineFill(s + 6);
        var info = addBook(target, {
          x: b0, y: f, z1: z1, t: t, h: h, d: d,
          fill: sp.fill, dark: sp.dark, lean: lean,
          bands: 1 + Math.floor(G.rnd(s + 7) * 3),
          title: 2 + Math.floor(G.rnd(s + 8) * 3)
        });
        if (o.special && o.special[n]) o.special[n].info = info;
        bookCount++;
        x = lean ? lean.px : (b0 + t);
        // books in a packed run sit right up against each other
        x += G.rndRange(s + 9, 0.0012, o.tight ? 0.0022 : 0.006);
      }
    }

    function addFlat(m, o) {
      addBook(m, {
        x: o.x, y: o.y, z1: o.z1, t: o.w, h: o.t, d: o.d,
        fill: o.fill, dark: !!o.dark, bands: o.bands || 1, title: o.title || 2, cover: true
      });
      bookCount++;
    }

    /* A small metal bookend: an angled L, base plate + upright. */
    function addBookend(m, x, y) {
      bx(m, x, y + 0.002, -2.428, x + 0.098, y + 0.009, -2.302,
        { fill: '@metalDark', kind: K.FINE, shade: 0.02 });
      bx(m, x, y + 0.009, -2.420, x + 0.006, y + 0.152, -2.310,
        { fill: '@metal', kind: K.EDGE, shade: 0.02 });
      G.line(m, [x + 0.003, y + 0.009, -2.416], [x + 0.003, y + 0.148, -2.314], { kind: K.SOFT });
    }

    /* a book propped against a bookend, leaning right */
    function addPropped(m, o) {
      var a = o.a * Math.PI / 180, t = o.t, h = o.h;
      var px = o.at - t * Math.cos(a) - h * Math.sin(a);
      addBook(m, {
        x: px, y: o.y, z1: o.z1, t: t, h: h, d: o.d, fill: o.fill, dark: !!o.dark,
        bands: 2, title: o.title || 3, lean: { s: 1, px: px, py: o.y, a: a }
      });
      bookCount++;
    }

    /* ---- shelf 1 (0.645 … 0.900): heavy reference volumes ---------------- */
    // bay A (0.44) packed from the left side right up to the first divider
    addRun({ r: 0, x: -1.646, n: 11, h: [0.216, 0.246], t: [0.038, 0.048], seed: 11, xMax: -1.228, tight: true });
    // bay C (0.32): a flat stack of three, lying on the board
    var stkY = ROW[0].f;
    addFlat(booksM, { x: -0.790, y: stkY, z1: -2.352, w: 0.238, t: 0.034, d: 0.166, fill: '@rug' });
    stkY += 0.036;
    addFlat(booksM, { x: -0.782, y: stkY, z1: -2.344, w: 0.228, t: 0.030, d: 0.158, fill: '@paper' });
    stkY += 0.032;
    addFlat(booksM, { x: -0.788, y: stkY, z1: -2.356, w: 0.220, t: 0.036, d: 0.150, fill: '@fabricAlt' });
    // bay E (0.46): a short run pushed hard against the right side, with the
    // gap a pulled-out book left behind on the left of it
    addRun({ r: 0, x: 0.276, n: 4, h: [0.190, 0.234], t: [0.032, 0.044], seed: 71, xMax: 0.486, tight: true });

    /* the gap where a book was pulled out — its outline is still on the shelf */
    var gapX = 0.118;
    G.line(booksM, [gapX, ROW[0].f + 0.0009, ZFR - 0.030], [gapX + 0.042, ROW[0].f + 0.0009, ZFR - 0.030], { kind: K.SOFT });
    G.line(booksM, [gapX, ROW[0].f + 0.0009, ZFR - 0.170], [gapX + 0.042, ROW[0].f + 0.0009, ZFR - 0.170], { kind: K.SOFT });
    G.line(booksM, [gapX, ROW[0].f + 0.0009, ZFR - 0.030], [gapX, ROW[0].f + 0.0009, ZFR - 0.170], { kind: K.SOFT });
    G.line(booksM, [gapX + 0.042, ROW[0].f + 0.0009, ZFR - 0.030], [gapX + 0.042, ROW[0].f + 0.0009, ZFR - 0.170], { kind: K.SOFT });

    /* ---- shelf 2 (0.924 … 1.150) ----------------------------------------- */
    // bay B (0.38) packed solid
    addRun({ r: 1, x: -1.192, n: 11, h: [0.174, 0.212], t: [0.034, 0.044], seed: 131, xMax: -0.830, tight: true });
    // bay D (0.48): one book standing on its own, then a book leaning into a
    // bookend at the far end of the bay
    addRun({ r: 1, x: -0.444, n: 1, h: [0.184, 0.204], t: [0.034, 0.042], seed: 181 });
    addBookend(booksM, -0.176, ROW[1].f);
    addPropped(booksM, { at: -0.176, y: ROW[1].f, z1: -2.306, t: 0.032, h: 0.196, d: 0.170, a: 12, fill: '@accent' });

    /* ---- shelf 3 (1.174 … 1.430): the tall bay --------------------------- */
    addRun({ r: 2, x: -0.452, n: 5, h: [0.222, 0.248], t: [0.036, 0.046], seed: 211, xMax: -0.252, tight: true, special: { 1: BK2 } });
    addRun({ r: 2, x: -0.100, n: 4, h: [0.198, 0.238], t: [0.032, 0.044], seed: 271, special: { 0: BK3 }, leanLast: true });

    /* ---- shelf 4 (1.454 … 1.680) ----------------------------------------- */
    addRun({ r: 3, x: -1.372, n: 2, h: [0.178, 0.208], t: [0.032, 0.042], seed: 301 });
    addRun({ r: 3, x: -0.790, n: 3, h: [0.176, 0.208], t: [0.030, 0.044], seed: 331, special: { 1: BK1 } });
    addRun({ r: 3, x: 0.318, n: 1, h: [0.186, 0.206], t: [0.034, 0.042], seed: 341 });

    /* ---- shelf 5 (1.704 … 1.876): paperbacks ----------------------------- */
    var pbY = ROW[4].f;
    addFlat(booksM, { x: -1.190, y: pbY, z1: -2.356, w: 0.220, t: 0.030, d: 0.148, fill: '@accent' });
    addFlat(booksM, { x: -1.182, y: pbY + 0.032, z1: -2.348, w: 0.210, t: 0.028, d: 0.142, fill: '@screen' });
    addRun({ r: 4, x: 0.298, n: 3, h: [0.132, 0.158], t: [0.024, 0.036], seed: 391, xMax: 0.486, tight: true });

    parts.shelfBookPull = [BK1.mesh, BK2.mesh, BK3.mesh];

    /* ======================= 4e. the two drawers ========================== */
    function buildDrawer(idx) {
      var f = DRW[idx];
      var m = S.addMesh();
      var x0 = f.x0, x1 = f.x1;
      var y0 = DRW_Y0, y1 = DRW_Y1;
      // front slab, proud of the carcass, with a reveal line all round
      bx(m, x0, y0, ZFR, x1, y1, C.ZF, { fill: '@wood', kind: K.EDGE, shade: 0.008 });
      G.line(m, [x0 + 0.011, y0 + 0.011, C.ZF + 0.0005], [x1 - 0.011, y0 + 0.011, C.ZF + 0.0005], { kind: K.FINE });
      G.line(m, [x0 + 0.011, y1 - 0.011, C.ZF + 0.0005], [x1 - 0.011, y1 - 0.011, C.ZF + 0.0005], { kind: K.FINE });
      // bar handle on two stand-offs
      var hx = (x0 + x1) / 2, hy = y1 - 0.078;
      bx(m, hx - 0.098, hy - 0.008, C.ZF + 0.012, hx + 0.098, hy + 0.008, C.ZF + 0.028,
        { fill: '@metalDark', kind: K.FINE, shade: 0.03 });
      G.line(m, [hx - 0.062, hy, C.ZF], [hx - 0.062, hy, C.ZF + 0.014], { kind: K.FINE });
      G.line(m, [hx + 0.062, hy, C.ZF], [hx + 0.062, hy, C.ZF + 0.014], { kind: K.FINE });
      // the box
      var b0 = x0 + 0.020, b1 = x1 - 0.020;
      var zBack = ZFR - 0.280;
      bx(m, b0, 0.098, zBack, b1, 0.112, ZFR, { fill: '@wood', kind: K.FINE, shade: 0.03 });
      bx(m, b0, 0.112, zBack, b0 + 0.012, 0.396, ZFR, { fill: '@wood', kind: K.FINE, shade: 0.02 });
      bx(m, b1 - 0.012, 0.112, zBack, b1, 0.396, ZFR, { fill: '@wood', kind: K.FINE, shade: 0.02 });
      bx(m, b0, 0.112, zBack, b1, 0.396, zBack + 0.012, { fill: '@wood', kind: K.FINE, shade: 0.03 });
      G.line(m, [b0 + 0.006, 0.113, ZFR], [b0 + 0.006, 0.113, zBack + 0.02], { kind: K.SOFT });
      G.line(m, [b1 - 0.006, 0.113, ZFR], [b1 - 0.006, 0.113, zBack + 0.02], { kind: K.SOFT });

      if (idx === 0) {
        /* a neat stack of folded things, and a small box standing beside it.
           Both are packed up to the rim: with the drawer only 0.28 out, the
           sight line over the front's top edge is what shows the contents. */
        var fx = b0 + 0.048, fy = 0.112;
        var folds = [[0.268, 0.070, '@fabricAlt', -2.302], [0.256, 0.066, '@rug', -2.294],
        [0.248, 0.072, '@fabric', -2.308], [0.240, 0.066, '@rugAlt', -2.298]];
        for (var q = 0; q < folds.length; q++) {
          addBook(m, {
            x: fx + q * 0.004, y: fy, z1: folds[q][3], t: folds[q][0], h: folds[q][1], d: 0.194,
            fill: folds[q][2], bands: 1, title: 2, cover: true
          });
          fy += folds[q][1] + 0.002;
        }
        G.line(m, [fx, fy - folds[3][1] + 0.004, -2.400], [fx + 0.240, fy - folds[3][1] + 0.004, -2.400], { kind: K.SOFT });
        var qx = b1 - 0.192;
        bx(m, qx, 0.112, -2.500, qx + 0.162, 0.386, -2.330, { fill: '@woodDark', kind: K.EDGE, shade: 0.02 });
        G.line(m, [qx, 0.310, -2.330], [qx + 0.162, 0.310, -2.330], { kind: K.FINE });
        G.line(m, [qx + 0.081, 0.310, -2.330], [qx + 0.081, 0.386, -2.330], { kind: K.FINE });
      } else {
        /* a rolled mat standing up, two tools and a paint tin */
        var mx = b0 + 0.088;
        G.tube(m, [mx, 0.112, -2.430], [mx, 0.386, -2.432], 0.048, 0.048, 8,
          { fill: '@rugAlt', kind: K.FINE, caps: true });
        G.circleLines(m, [mx, 0.386, -2.432], 0.048, 8, { kind: K.SOFT });
        G.circleLines(m, [mx, 0.196, -2.431], 0.049, 8, { kind: K.SOFT });
        bx(m, b0 + 0.172, 0.112, -2.480, b0 + 0.202, 0.146, -2.318, { fill: '@metal', kind: K.FINE, shade: 0.03 });
        bx(m, b0 + 0.224, 0.112, -2.470, b0 + 0.254, 0.140, -2.332, { fill: '@metalDark', kind: K.FINE, shade: 0.03 });
        G.line(m, [b0 + 0.172, 0.142, -2.480], [b0 + 0.202, 0.142, -2.318], { kind: K.SOFT });
        var tx = b1 - 0.088;
        G.tube(m, [tx, 0.112, -2.498], [tx, 0.348, -2.498], 0.046, 0.046, 8,
          { fill: '@metal', kind: K.FINE, caps: true });
        G.circleLines(m, [tx, 0.348, -2.498], 0.046, 8, { kind: K.SOFT });
        G.circleLines(m, [tx, 0.250, -2.498], 0.047, 8, { kind: K.SOFT });
        G.line(m, [tx - 0.046, 0.348, -2.498], [tx + 0.046, 0.348, -2.498], { kind: K.FINE });
      }
      return m;
    }

    function buildDoor(idx) {
      var d = DOOR[idx];
      var m = S.addMesh();
      bx(m, d.x0, DOOR_Y0, ZFR, d.x1, DOOR_Y1, C.ZF, { fill: '@wood', kind: K.EDGE, shade: 0.008 });
      // recessed panel, so the door is not a bare slab
      var ix0 = d.x0 + 0.055, ix1 = d.x1 - 0.055;
      quad(m, [ix0, 0.150, C.ZF + 0.0007], [ix1, 0.150, C.ZF + 0.0007],
        [ix1, DOOR_Y1 - 0.055, C.ZF + 0.0007], [ix0, DOOR_Y1 - 0.055, C.ZF + 0.0007],
        { fill: '@woodDark', kind: K.FINE, shade: 0.03, cull: true });
      G.line(m, [ix0 - 0.008, 0.142, C.ZF + 0.0007], [ix1 + 0.008, 0.142, C.ZF + 0.0007], { kind: K.SOFT });
      G.line(m, [ix0 - 0.008, DOOR_Y1 - 0.047, C.ZF + 0.0007], [ix1 + 0.008, DOOR_Y1 - 0.047, C.ZF + 0.0007], { kind: K.SOFT });
      // knob on the free edge
      var kx = d.side > 0 ? d.x0 + 0.048 : d.x1 - 0.048;
      bx(m, kx - 0.017, 0.322, C.ZF, kx + 0.017, 0.356, C.ZF + 0.030, { fill: '@metalDark', kind: K.FINE, shade: 0.02 });
      G.line(m, [kx - 0.012, 0.339, C.ZF + 0.030], [kx + 0.012, 0.339, C.ZF + 0.030], { kind: K.SOFT });
      // two hinges on the hinge edge
      var hgx = d.side > 0 ? d.x1 - 0.013 : d.x0 + 0.013;
      bx(m, hgx - 0.015, 0.168, ZFR - 0.011, hgx + 0.015, 0.226, ZFR + 0.002, { fill: '@metal', kind: K.FINE, shade: 0.04 });
      bx(m, hgx - 0.015, 0.468, ZFR - 0.011, hgx + 0.015, 0.526, ZFR + 0.002, { fill: '@metal', kind: K.FINE, shade: 0.04 });
      return m;
    }

    var drwM = [buildDrawer(0), buildDrawer(1)];
    var doorM = [buildDoor(0), buildDoor(1)];
    parts.shelfDrawers = drwM;
    parts.shelfDoors = doorM;

    /* ======================= 4f. on top of the case ======================= */
    var shelfBookCount = bookCount;          // books on the shelves (the brief's count)
    var topM = S.addMesh();
    parts.shelfTop = topM;
    var tbY = C.H;
    addFlat(topM, { x: -1.404, y: tbY, z1: -2.242, w: 0.268, t: 0.040, d: 0.168, fill: '@fabric' });
    tbY += 0.042;
    addFlat(topM, { x: -1.396, y: tbY, z1: -2.248, w: 0.256, t: 0.034, d: 0.160, fill: '@rug' });
    tbY += 0.036;
    addFlat(topM, { x: -1.388, y: tbY, z1: -2.240, w: 0.246, t: 0.038, d: 0.166, fill: '@paper' });
    (function () {
      var a = 10 * Math.PI / 180, t = 0.028, h = 0.170;
      var xb = -1.118;
      var px = xb - t * Math.cos(a) - h * Math.sin(a);
      addBook(topM, {
        x: px, y: C.H, z1: -2.240, t: t, h: h, d: 0.150, fill: '#3b3f4d', dark: true,
        bands: 2, title: 2, lean: { s: 1, px: px, py: C.H, a: a }
      });
      bookCount++;
    })();

    /* ======================= 4g. interaction ============================== */
    function registerDrawer(idx) {
      var m = drwM[idx];
      var base = snap(m);
      var st = { v: 0, target: 0 };
      var o = {
        id: 'drawer' + (idx + 1),
        label: '书柜抽屉 Drawer ' + (idx + 1),
        hint: '点击拉开 / 推回',
        mesh: m,
        priority: 1,
        dynamicHit: true,
        hit: hitOf(m),
        onDown: function (ctx) { ctx.audio.play('click'); },
        onClick: function (ctx) {
          st.target = st.target > 0.5 ? 0 : 1;
          ctx.audio.play('drawer');
          ctx.toast(st.target > 0.5 ? '抽屉开了' : '抽屉关上了');
        },
        update: function (dt, ctx) {
          var v = approach(st.v, st.target, 1.8, dt);
          if (v === st.v) return;   // settled: approach snaps its last sub-millimetre
          st.v = v;
          var dz = DRAW_TRAVEL * v;
          pose(m, base, function (x, y, z) { return [x, y, z + dz]; });
          syncHit(o, m);
        }
      };
      reg(o);
      return o;
    }

    function registerDoor(idx) {
      var m = doorM[idx];
      var base = snap(m);
      var d = DOOR[idx];
      var hz = ZFR + C.FRONT / 2;
      var st = { v: 0, target: 0 };
      var o = {
        id: 'door' + (idx + 1),
        label: '书柜柜门 Cabinet door ' + (idx + 1),
        hint: '点击开合',
        mesh: m,
        priority: 1,
        dynamicHit: true,
        hit: hitOf(m),
        onDown: function (ctx) { ctx.audio.play('latch'); },
        onClick: function (ctx) {
          st.target = st.target > 0.5 ? 0 : 1;
          ctx.audio.play('cabinet');
          ctx.toast(st.target > 0.5 ? '柜门打开了' : '柜门关上了');
        },
        update: function (dt, ctx) {
          var v = approach(st.v, st.target, 1.2, dt);
          if (v === st.v) return;   // settled: approach snaps its last sub-millimetre
          st.v = v;
          var a = d.side * DOOR_SWING * v;
          var ca = Math.cos(a), sa = Math.sin(a);
          pose(m, base, function (x, y, z) {
            var dx = x - d.hinge, dz = z - hz;
            return [d.hinge + dx * ca + dz * sa, y, hz - dx * sa + dz * ca];
          });
          syncHit(o, m);
        }
      };
      reg(o);
      return o;
    }

    function registerPullBook(rec) {
      var m = rec.mesh;
      var base = snap(m);
      var info = rec.info || { y0: ROW[2].f, z1: -2.270 };
      var py = info.y0, pz = info.z1;
      var st = { v: 0, target: 0 };
      var o = {
        id: rec.id,
        label: '书 Book ' + rec.id,
        hint: '点击抽出 / 推回',
        mesh: m,
        priority: 2,
        dynamicHit: true,
        hit: hitOf(m, 0.004),
        onClick: function (ctx) {
          st.target = st.target > 0.5 ? 0 : 1;
          ctx.audio.play('page');
          ctx.toast(st.target > 0.5 ? '抽出一本书' : '把书推回去');
        },
        update: function (dt, ctx) {
          var v = approach(st.v, st.target, 1.6, dt);
          if (v === st.v) return;   // settled: approach snaps its last sub-millimetre
          st.v = v;
          var a = BOOK_TILT * v, ca = Math.cos(a), sa = Math.sin(a), dz = BOOK_TRAVEL * v;
          pose(m, base, function (x, y, z) {
            var dy = y - py, dzz = z - pz;
            return [x, py + dy * ca - dzz * sa, pz + dy * sa + dzz * ca + dz];
          });
          syncHit(o, m);
        }
      };
      reg(o);
      return o;
    }

    for (i = 0; i < 2; i++) registerDrawer(i);
    for (i = 0; i < 2; i++) registerDoor(i);
    for (i = 0; i < pullBooks.length; i++) registerPullBook(pullBooks[i]);

    return {
      books: shelfBookCount,
      topBooks: bookCount - shelfBookCount,
      meshes: S.meshes.length,
      interactives: ['drawer1', 'drawer2', 'door1', 'door2', 'book1', 'book2', 'book3']
    };
  }

  P.shelfBuild = build;
})(typeof window !== 'undefined' ? window : globalThis);
