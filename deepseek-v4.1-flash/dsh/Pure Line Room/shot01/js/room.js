/* =============================================================================
   Pure Line Room — room.js
   The architecture: floor boards, four walls, skirting, ceiling, the window
   bay with its frame / blinds / curtain, the door with its frame and handle,
   and the light switch plate by the door.

   Every surface here is a real 3D polygon with an explicit inward normal, so
   the shell occludes correctly from any camera angle.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;
  var K = P.K;

  // Room interior, in metres.
  var R = {
    x0: -1.70, x1: 1.70,          // west wall / east wall
    z0: -2.60, z1: 2.60,          // north wall / south wall
    h: 2.72,                       // ceiling height
    wall: 0.12                     // wall thickness
  };
  // Window opening (in the east wall).
  var WIN = { z0: -1.36, z1: -0.04, y0: 1.03, y1: 2.20, x: R.x1 };
  // Door opening (in the west wall).
  var DOOR = { z0: 0.86, z1: 1.80, h: 2.06, x: R.x0, hingeZ: 1.80 };

  /* ---------------------------------------------------------------------------
     small geometry helpers
     --------------------------------------------------------------------------- */
  function q(m, a, b, c, d, opts) {
    var vi = m.vertices([a, b, c, d]);
    var n = M.polyNormal(m.verts, vi);
    if (n[0] * opts.n[0] + n[1] * opts.n[1] + n[2] * opts.n[2] < 0) vi.reverse();
    return m.face(vi, {
      fill: opts.fill, kind: opts.kind || K.EDGE, cull: opts.cull !== false,
      dot: opts.dot || 0, shade: opts.shade || 0, hatch: opts.hatch || null
    });
  }

  function boxAt(m, cx, cy, cz, sx, sy, sz, opts) {
    opts = opts || {};
    var X0 = cx - sx / 2, X1 = cx + sx / 2;
    var Y0 = cy - sy / 2, Y1 = cy + sy / 2;
    var Z0 = cz - sz / 2, Z1 = cz + sz / 2;
    var quads = [
      [[X1, Y0, Z0], [X1, Y0, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [1, 0, 0]],   // +x
      [[X0, Y0, Z1], [X0, Y0, Z0], [X0, Y1, Z0], [X0, Y1, Z1], [-1, 0, 0]],  // -x
      [[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], [0, 0, 1]],   // +z
      [[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0], [0, 0, -1]],  // -z
      [[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0], [0, 1, 0]],   // +y
      [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1], [0, -1, 0]]   // -y
    ];
    for (var i = 0; i < quads.length; i++) {
      var f = quads[i];
      var nrm = f[4];
      if (opts.open && opts.open[(nrm[0] ? (nrm[0] > 0 ? 'px' : 'nx') : nrm[1] ? 'py' : 'pz')]) continue;
      q(m, f[0], f[1], f[2], f[3], {
        n: nrm, fill: opts.fill, kind: opts.kind || K.EDGE,
        cull: opts.cull !== false, shade: opts.shade || 0, dot: opts.dot
      });
    }
    if (opts.edges) {
      var c = [[X0, Y0, Z0], [X1, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z0], [X1, Y1, Z1], [X1, Y0, Z1], [X1, Y1, Z0], [X0, Y1, Z1]];
      var pairs = [[0, 1], [0, 2], [0, 3], [1, 5], [1, 6], [2, 5], [2, 7], [3, 6], [3, 7], [4, 5], [4, 6], [4, 7]];
      for (var e = 0; e < pairs.length; e++) {
        m.face(m.vertices([c[pairs[e][0]], c[pairs[e][1]], c[pairs[e][0]]]),
          { fill: null, kind: opts.kind || K.EDGE });
      }
    }
  }

  function rotY(p, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }

  /* ---------------------------------------------------------------------------
     Build
     --------------------------------------------------------------------------- */
  function build(sctx) {
    var S = sctx.scene;
    // meshes are named: the debug view modes select by name, and the names show
    // up in the render statistics
    function named(mesh, name) { mesh.name = name; return mesh; }

    /* ---------- floor: boards running front-to-back ---------- */
    var floor = named(S.addMesh(), 'room.floor');
    var cols = 6, colW = (R.x1 - R.x0) / cols;
    var rows = 4, rowD = (R.z1 - R.z0) / rows;
    for (var ci = 0; ci < cols; ci++) {
      for (var ri = 0; ri < rows; ri++) {
        var x0 = R.x0 + ci * colW, x1 = x0 + colW;
        // staggered joints, so the boards do not all line up
        var z0 = R.z0 + ri * rowD + (ci % 2 ? rowD * 0.22 : 0);
        var z1 = Math.min(R.z1, z0 + rowD);
        if (z0 > R.z1) continue;
        var alt = (ci + ri) % 2 === 0;
        q(floor, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], {
          n: [0, 1, 0], fill: alt ? '@floor' : '@floorAlt', kind: K.FINE,
          shade: (ci % 3) * 0.012 + (ri % 2) * 0.008
        });
        // a couple of grain lines per board
        for (var g = 1; g <= 2; g++) {
          var gx = x0 + colW * (g / 3);
          floor.face(floor.vertices([[gx, 0.0005, z0 + 0.04], [gx + 0.02, 0.0005, z1 - 0.06], [gx, 0.0005, z0 + 0.04]]),
            { fill: null, kind: K.SOFT });
        }
      }
    }
    sctx.parts.floor = floor;

    /* ---------- ceiling ---------- */
    var ceil = named(S.addMesh(), 'room.ceiling');
    for (var cxi = 0; cxi < 3; cxi++) {
      for (var czi = 0; czi < 3; czi++) {
        var ax0 = R.x0 + (R.x1 - R.x0) * (cxi / 3), ax1 = R.x0 + (R.x1 - R.x0) * ((cxi + 1) / 3);
        var az0 = R.z0 + (R.z1 - R.z0) * (czi / 3), az1 = R.z0 + (R.z1 - R.z0) * ((czi + 1) / 3);
        q(ceil, [ax0, R.h, az0], [ax1, R.h, az0], [ax1, R.h, az1], [ax0, R.h, az1], {
          n: [0, -1, 0], fill: '@ceiling', kind: K.SOFT, shade: 0.01
        });
      }
    }
    // cornice: a thin line where ceiling meets wall
    var corn = [[R.x0 + 0.001, R.h - 0.045, R.z0 + 0.001], [R.x1 - 0.001, R.h - 0.045, R.z0 + 0.001],
    [R.x1 - 0.001, R.h - 0.045, R.z1 - 0.001], [R.x0 + 0.001, R.h - 0.045, R.z1 - 0.001]];
    for (var cl = 0; cl < 4; cl++) {
      var a2 = corn[cl], b2 = corn[(cl + 1) % 4];
      ceil.face(ceil.vertices([a2, b2, a2]), { fill: null, kind: K.SOFT });
    }
    sctx.parts.ceiling = ceil;

    /* ---------- walls ---------- */
    var walls = named(S.addMesh(), 'room.walls');
    var t = R.wall;

    // NORTH (z = z0, inward normal +z)
    q(walls, [R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, R.h, R.z0], [R.x0, R.h, R.z0], {
      n: [0, 0, 1], fill: '@wall', kind: K.SIL
    });
    // SOUTH (z = z1, inward normal -z).
    // Modelled in full — wall, skirting, cornice — but hidden by default and
    // revealed by the "cutaway" toggle. A closed box cannot be looked into from
    // outside, and this piece is a room you look into; the near wall is present
    // so that orbiting around still gives a complete, sealed building.
    var southWallFace = q(walls, [R.x1, 0, R.z1], [R.x0, 0, R.z1], [R.x0, R.h, R.z1], [R.x1, R.h, R.z1], {
      n: [0, 0, -1], fill: '@wall', kind: K.SIL
    });
    // WEST (x = x0) split around the door opening
    q(walls, [R.x0, 0, R.z0], [R.x0, 0, DOOR.z0], [R.x0, R.h, DOOR.z0], [R.x0, R.h, R.z0], {
      n: [1, 0, 0], fill: '@wall', kind: K.SIL
    });
    q(walls, [R.x0, 0, DOOR.z1], [R.x0, 0, R.z1], [R.x0, R.h, R.z1], [R.x0, R.h, DOOR.z1], {
      n: [1, 0, 0], fill: '@wall', kind: K.SIL
    });
    q(walls, [R.x0, DOOR.h, DOOR.z0], [R.x0, DOOR.h, DOOR.z1], [R.x0, R.h, DOOR.z1], [R.x0, R.h, DOOR.z0], {
      n: [1, 0, 0], fill: '@wall', kind: K.SIL
    });
    // EAST (x = x1) split around the window opening
    q(walls, [R.x1, 0, R.z0], [R.x1, 0, WIN.z0], [R.x1, R.h, WIN.z0], [R.x1, R.h, R.z0], { n: [-1, 0, 0], fill: '@wall', kind: K.SIL });
    q(walls, [R.x1, 0, WIN.z1], [R.x1, 0, R.z1], [R.x1, R.h, R.z1], [R.x1, R.h, WIN.z1], { n: [-1, 0, 0], fill: '@wall', kind: K.SIL });
    q(walls, [R.x1, 0, WIN.z0], [R.x1, 0, WIN.z1], [R.x1, WIN.y0, WIN.z1], [R.x1, WIN.y0, WIN.z0], { n: [-1, 0, 0], fill: '@wall', kind: K.SIL });
    q(walls, [R.x1, WIN.y1, WIN.z0], [R.x1, WIN.y1, WIN.z1], [R.x1, R.h, WIN.z1], [R.x1, R.h, WIN.z0], { n: [-1, 0, 0], fill: '@wall', kind: K.SIL });

    // exterior sides of the shell (only visible through the window / door gaps,
    // but they stop the room from looking like cardboard when the camera moves)
    q(walls, [R.x1 + t, 0, WIN.z0], [R.x1 + t, 0, WIN.z1], [R.x1 + t, WIN.y1, WIN.z1], [R.x1 + t, WIN.y1, WIN.z0], {
      n: [-1, 0, 0], fill: '@wall', kind: K.FINE, shade: 0.05
    });
    sctx.parts.walls = walls;
    // the shell must never push the camera: its bounding box is the room itself
    walls.noCollide = true;
    floor.noCollide = true;
    ceil.noCollide = true;
    // and it paints before everything else, so the window view can be
    // composited between the shell and the furniture
    walls.layer = -1;
    floor.layer = -1;
    ceil.layer = -1;

    /* ---------- skirting board along the base of each wall ---------- */
    var skirt = named(S.addMesh(), 'room.skirt');
    var sh = 0.095, sd = 0.022;
    function skirtRun(ax, az, bx, bz, nx, nz) {
      var len = Math.hypot(bx - ax, bz - az);
      var dx = (bx - ax) / len, dz = (bz - az) / len;
      var idx = skirt.faces.length;
      q(skirt, [ax + nx * sd, 0, az + nz * sd], [ax + nx * sd, sh, az + nz * sd],
        [bx + nx * sd, sh, bz + nz * sd], [bx + nx * sd, 0, bz + nz * sd],
        { n: [nx, 0, nz], fill: '@wall', kind: K.EDGE, shade: 0.02 });
      q(skirt, [ax, sh, az], [ax + nx * sd, sh, az + nz * sd], [bx + nx * sd, sh, bz + nz * sd], [bx, sh, bz],
        { n: [0, 1, 0], fill: '@wall', kind: K.FINE, shade: 0.0 });
      q(skirt, [ax, 0, az], [ax, sh, az], [bx, sh, bz], [bx, 0, bz],
        { n: [-nx, 0, -nz], fill: '@wall', kind: K.SOFT, shade: 0.05 });
      return idx;
    }
    skirtRun(R.x0, R.z0, R.x0, DOOR.z0, 1, 0);          // west, north of door
    skirtRun(R.x0, DOOR.z1, R.x0, R.z1, 1, 0);          // west, south of door
    skirtRun(R.x1, R.z0, R.x1, R.z1, -1, 0);            // east
    skirtRun(R.x0, R.z0, R.x1, R.z0, 0, 1);             // north
    var southSkirtFace = skirtRun(R.x1, R.z1, R.x0, R.z1, 0, -1);   // south
    sctx.parts.skirt = skirt;
    skirt.noCollide = true;
    skirt.layer = -1;

    /* ---------- the cutaway ----------
       The piece is looked at from outside the south wall, so that wall (and its
       skirting) starts hidden; the wall it hides is the one directly behind the
       camera's default position. Pressing "C" closes the room again, which also
       makes the exterior view of the whole building read as complete. */
    walls.tagFaces(southWallFace, southWallFace + 7, 'front');
    ceil.tagFaces(14, 17, 'front');
    walls.setTagVisible('front', false);
    ceil.setTagVisible('front', false);
    function setFront(open) {
      sctx.frontOpen = !!open;
      walls.setTagVisible('front', !open);
      ceil.setTagVisible('front', !open);
      skirt.setTagVisible('front', !open);
    }
    skirt.tagFaces(southSkirtFace, southSkirtFace + 2, 'front');
    setFront(true);
    sctx.setFront = setFront;

    /* ---------- door ---------- */
    var doorGroup = named(S.addMesh(), 'room.doorFrame');
    var jamb = 0.055;
    // frame: two jambs + head, standing proud of the wall
    boxAt(doorGroup, R.x0 + 0.028, DOOR.h / 2, DOOR.z0 - jamb / 2, 0.14, DOOR.h, jamb, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    boxAt(doorGroup, R.x0 + 0.028, DOOR.h / 2, DOOR.z1 + jamb / 2, 0.14, DOOR.h, jamb, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    boxAt(doorGroup, R.x0 + 0.028, DOOR.h + jamb / 2, (DOOR.z0 + DOOR.z1) / 2, 0.14, jamb, DOOR.z1 - DOOR.z0 + jamb * 2, { fill: '@wood', kind: K.EDGE, shade: 0.02 });
    // architrave line on the room side of the opening
    doorGroup.face(doorGroup.vertices([
      [R.x0 + 0.001, 0, DOOR.z0 - jamb], [R.x0 + 0.001, DOOR.h + jamb, DOOR.z0 - jamb], [R.x0 + 0.001, 0, DOOR.z0 - jamb]
    ]), { fill: null, kind: K.FINE });
    sctx.parts.doorFrame = doorGroup;

    var leaf = named(S.addMesh(), 'room.doorLeaf');
    var lw = DOOR.z1 - DOOR.z0 - 0.012;   // leaf width along z
    var lt = 0.042;                       // leaf thickness along x
    var lx = R.x0 + 0.05;                 // leaf plane
    var zA = DOOR.z0 + 0.006, zB = zA + lw;
    function leafQuad(a, b, c, d, opts) {
      // panel recesses are drawn as inset quads with their own outline
      q(leaf, a, b, c, d, Object.assign({ n: [1, 0, 0], fill: '@wood', kind: K.EDGE }, opts));
    }
    // slab faces
    leafQuad([lx, 0.02, zA], [lx, DOOR.h - 0.02, zA], [lx, DOOR.h - 0.02, zB], [lx, 0.02, zB], { shade: 0.02 });
    leafQuad([lx + lt, 0.02, zB], [lx + lt, DOOR.h - 0.02, zB], [lx + lt, DOOR.h - 0.02, zA], [lx + lt, 0.02, zA], { shade: 0.05 });
    // stiles and rails as explicit panels
    var panelZ = [[zA + 0.015, zB - 0.015]];
    var panelY = [[0.16, 1.02], [1.10, DOOR.h - 0.16]];
    for (var py = 0; py < panelY.length; py++) {
      for (var pz = 0; pz < panelZ.length; pz++) {
        var y0 = panelY[py][0], y1 = panelY[py][1];
        var pz0 = panelZ[pz][0] + 0.10, pz1 = panelZ[pz][1] - 0.10;
        // recessed panel: a slightly inset quad plus four bevel lines
        q(leaf, [lx + 0.004, y0, pz0], [lx + 0.004, y1, pz0], [lx + 0.004, y1, pz1], [lx + 0.004, y0, pz1],
          { n: [1, 0, 0], fill: '@woodDark', kind: K.FINE, shade: 0.03 });
        var bevel = [[lx, y0, pz0], [lx, y1, pz0], [lx, y1, pz1], [lx, y0, pz1]];
        for (var bv = 0; bv < 4; bv++) {
          var pa = bevel[bv], pb = bevel[(bv + 1) % 4];
          var qa = [lx + 0.004, pa[1], pa[2]], qb = [lx + 0.004, pb[1], pb[2]];
          q(leaf, pa, pb, qb, qa, { n: [1, 0, 0], fill: '@wood', kind: K.SOFT });
        }
      }
    }
    // leaf edge (the thin side)
    boxAt(leaf, lx + lt / 2, DOOR.h / 2, zA + 0.004, lt, DOOR.h, 0.008, { fill: '@woodDark', kind: K.FINE });
    boxAt(leaf, lx + lt / 2, DOOR.h / 2, zB - 0.004, lt, DOOR.h, 0.008, { fill: '@woodDark', kind: K.FINE });
    boxAt(leaf, lx + lt / 2, DOOR.h - 0.005, (zA + zB) / 2, lt, 0.01, lw, { fill: '@woodDark', kind: K.FINE });
    boxAt(leaf, lx + lt / 2, 0.005, (zA + zB) / 2, lt, 0.01, lw, { fill: '@woodDark', kind: K.FINE });

    // handle: backplate + lever, on the leaf's inner face near the free edge
    var hz = zA + 0.09, hy = 1.02;
    boxAt(leaf, lx + lt + 0.006, hy, hz, 0.012, 0.11, 0.032, { fill: '@metal', kind: K.FINE });
    var rosette = P.geom.circlePts(lx + lt + 0.013, hy, hz, 0.026, 12, 'x');
    P.geom.loop(leaf, rosette, { kind: K.FINE });
    P.geom.tube(leaf, [lx + lt + 0.012, hy, hz], [lx + lt + 0.058, hy - 0.012, hz - 0.055], 0.012, 0.010, 8,
      { fill: '@metal', kind: K.FINE, caps: false });
    leaf.face(leaf.vertices([[lx + lt + 0.058, hy - 0.012, hz - 0.055], [lx + lt + 0.058, hy - 0.030, hz - 0.060], [lx + lt + 0.058, hy - 0.012, hz - 0.055]]), { fill: null, kind: K.FINE });
    sctx.parts.doorLeaf = leaf;
    sctx.parts.doorHinge = { x: lx + lt / 2, z: DOOR.hingeZ - 0.006 };

    /* ---------- window bay: reveal, frame, sill, mullions ---------- */
    var winM = named(S.addMesh(), 'room.window');
    var wx = R.x1;                    // glass plane
    var rev = 0.085;                  // reveal depth into the wall
    // reveal (the returns of the opening)
    q(winM, [wx, WIN.y0, WIN.z0], [wx + rev, WIN.y0, WIN.z0], [wx + rev, WIN.y1, WIN.z0], [wx, WIN.y1, WIN.z0], { n: [0, 0, 1], fill: '@wall', kind: K.EDGE, shade: 0.07 });
    q(winM, [wx + rev, WIN.y0, WIN.z1], [wx, WIN.y0, WIN.z1], [wx, WIN.y1, WIN.z1], [wx + rev, WIN.y1, WIN.z1], { n: [0, 0, -1], fill: '@wall', kind: K.EDGE, shade: 0.07 });
    q(winM, [wx, WIN.y1, WIN.z0], [wx + rev, WIN.y1, WIN.z0], [wx + rev, WIN.y1, WIN.z1], [wx, WIN.y1, WIN.z1], { n: [0, -1, 0], fill: '@wall', kind: K.EDGE, shade: 0.06 });
    // sill
    q(winM, [wx + rev, WIN.y0, WIN.z1], [wx + rev, WIN.y0, WIN.z0], [wx, WIN.y0, WIN.z0], [wx, WIN.y0, WIN.z1], { n: [0, 1, 0], fill: '@wall', kind: K.EDGE, shade: 0.0 });
    // wooden sill board oversailing the reveal
    boxAt(winM, wx + 0.005, WIN.y0 - 0.016, (WIN.z0 + WIN.z1) / 2, 0.20, 0.032, WIN.z1 - WIN.z0 + 0.10, { fill: '@wood', kind: K.EDGE, shade: 0.0, edges: true });
    // outer frame: four members, mitered look via explicit corner lines
    var ft = 0.032, fd = 0.05;
    boxAt(winM, wx + fd / 2, WIN.y0 + ft / 2, (WIN.z0 + WIN.z1) / 2, fd, ft, WIN.z1 - WIN.z0, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    boxAt(winM, wx + fd / 2, WIN.y1 - ft / 2, (WIN.z0 + WIN.z1) / 2, fd, ft, WIN.z1 - WIN.z0, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    boxAt(winM, wx + fd / 2, (WIN.y0 + WIN.y1) / 2, WIN.z0 + ft / 2, fd, WIN.y1 - WIN.y0, ft, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    boxAt(winM, wx + fd / 2, (WIN.y0 + WIN.y1) / 2, WIN.z1 - ft / 2, fd, WIN.y1 - WIN.y0, ft, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
    // sash bar: one horizontal + one vertical, offset for a casement look
    boxAt(winM, wx + fd / 2, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2, fd * 0.85, 0.026, WIN.z1 - WIN.z0 - ft * 2, { fill: '@wood', kind: K.FINE, shade: 0.04 });
    boxAt(winM, wx + fd / 2, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2 - 0.28, fd * 0.85, WIN.y1 - WIN.y0 - ft * 2, 0.024, { fill: '@wood', kind: K.FINE, shade: 0.04 });
    // latch on the meeting stile
    boxAt(winM, wx + fd + 0.008, (WIN.y0 + WIN.y1) / 2 - 0.02, (WIN.z0 + WIN.z1) / 2 - 0.28, 0.02, 0.05, 0.018, { fill: '@metal', kind: K.FINE });
    sctx.parts.window = winM;
    sctx.windowBox = [wx - 0.002, WIN.y0 + 0.002, WIN.z0 + 0.002, WIN.y1 - 0.002, WIN.z1 - 0.002];

    /* ---------- blinds ---------- */
    var blind = named(S.addMesh(), 'room.blinds');
    blind.dynamic = true;
    sctx.parts.blind = blind;
    var slatN = 12;
    var bundle = 0.16, tilt = 0.32;   // radians from horizontal
    function rebuildBlind() {
      var top = WIN.y1 - 0.045;
      var drop = (WIN.y1 - WIN.y0 - 0.09) * bundle;
      var spacing = drop / slatN;
      var half = Math.min(0.048, spacing * 0.62);
      blind.verts.length = 0;
      blind.faces.length = 0;
      var zc = (WIN.z0 + WIN.z1) / 2, halfW = (WIN.z1 - WIN.z0) / 2 - 0.022;
      var bx = wx + 0.055;
      // head rail + bottom rail
      boxAt(blind, bx + 0.014, top + 0.022, zc, 0.036, 0.044, halfW * 2 + 0.04, { fill: '@wood', kind: K.EDGE, shade: 0.03 });
      boxAt(blind, bx + 0.008, top - drop - 0.016, zc, 0.026, 0.030, halfW * 2 + 0.03, { fill: '@wood', kind: K.EDGE, shade: 0.02 });
      // the slats pivot about their long (z) axis
      for (var i = 0; i < slatN; i++) {
        var y = top - spacing * (i + 0.5);
        var dy = Math.sin(tilt) * half, dz = Math.cos(tilt) * half;
        var p = [
          [bx + 0.004, y - dy, zc - halfW], [bx + 0.004 + dz, y + dy, zc - halfW],
          [bx + 0.004 + dz, y + dy, zc + halfW], [bx + 0.004, y - dy, zc + halfW]
        ];
        q(blind, p[0], p[1], p[2], p[3], { n: [0.35, 0.94, 0], fill: '@fabric', kind: K.SOFT, shade: 0.03 });
        // under-side hint line
        blind.face(blind.vertices([p[0], p[3], p[0]]), { fill: null, kind: K.SOFT });
      }
      // ladder tapes
      for (var tpos = -1; tpos <= 1; tpos += 2) {
        var tz = zc + tpos * (halfW * 0.55);
        blind.face(blind.vertices([[bx + 0.016, top - drop - 0.02, tz], [bx + 0.016, top - 0.01, tz], [bx + 0.016, top - drop - 0.02, tz]]),
          { fill: null, kind: K.SOFT });
        P.geom.tube(blind, [bx + 0.016, top - drop - 0.02, tz], [bx + 0.016, top - 0.01, tz], 0.004, 0.004, 5, { fill: '@fabric', kind: K.SOFT, caps: false, fills: false });
      }
      blind.bounds = null;
      blind.rev++;
    }
    rebuildBlind();
    sctx.blindState = { bundle: bundle, tilt: tilt, rebuild: rebuildBlind, mesh: blind };

    /* ---------- curtain: rod, rings, two panels ---------- */
    var rodM = named(S.addMesh(), 'room.curtainRod');
    var rodY = 2.36, rodZ0 = WIN.z0 - 0.30, rodZ1 = WIN.z1 + 0.22;
    P.geom.tube(rodM, [wx - 0.10, rodY, rodZ0], [wx - 0.10, rodY, rodZ1], 0.014, 0.014, 10, { fill: '@metal', kind: K.EDGE, caps: true });
    P.geom.tube(rodM, [wx - 0.10, rodY, rodZ0 - 0.02], [wx - 0.10, rodY, rodZ0 - 0.05], 0.030, 0.008, 10, { fill: '@metal', kind: K.EDGE });
    P.geom.tube(rodM, [wx - 0.10, rodY, rodZ1 + 0.02], [wx - 0.10, rodY, rodZ1 + 0.05], 0.030, 0.008, 10, { fill: '@metal', kind: K.EDGE });
    sctx.parts.curtainRod = rodM;

    var curt = named(S.addMesh(), 'room.curtain');
    curt.dynamic = true;
    sctx.parts.curtain = curt;
    var CU = { top: rodY - 0.035, bottom: 0.70, uSegs: 20, vSegs: 6, width: 1.60, cx: wx - 0.105 };
    var curtGrid = [];      // grid of *vertex arrays* (mutated every frame)
    var curtIdx = [];       // matching grid of vertex *indices* (for faces)
    for (var iu = 0; iu <= CU.uSegs; iu++) {
      var row = [], irow = [];
      for (var iv = 0; iv <= CU.vSegs; iv++) {
        var vidx = curt.vertex([0, 1, 0]);
        irow.push(vidx);
        row.push(curt.verts[vidx]);
      }
      curtGrid.push(row);
      curtIdx.push(irow);
    }
    for (var iu2 = 0; iu2 < CU.uSegs; iu2++) {
      for (var iv2 = 0; iv2 < CU.vSegs; iv2++) {
        curt.face([curtIdx[iu2][iv2], curtIdx[iu2 + 1][iv2], curtIdx[iu2 + 1][iv2 + 1], curtIdx[iu2][iv2 + 1]],
          { fill: '@fabric', kind: K.EDGE, shade: (iu2 % 2) * 0.02, cull: false });
      }
    }
    // folds as explicit contour lines
    var foldLines = [];
    for (var fu = 1; fu < CU.uSegs; fu += 2) foldLines.push(fu);
    sctx.curtainFoldRows = foldLines;
    var curtFold = [];
    for (var fl = 0; fl < foldLines.length; fl++) {
      var col = [];
      for (var fv = 0; fv <= CU.vSegs; fv++) col.push(curt.verts[curt.vertex([0, 1, 0])]);
      curtFold.push({ u: foldLines[fl], vi: col });
    }
    sctx.curtain = CU;
    sctx.curtainGrid = curtGrid;
    sctx.curtainFold = curtFold;
    // The curtain starts drawn back to the side of the window: the room should
    // show its view out from the first frame. Clicking gathers or releases it.
    sctx.curtainOpen = 0;
    sctx.curtainGathered = 0;
    function updateCurtain(open) {
      // The panel hangs on a rod that runs past the north jamb, so "open" means
      // gathered into a bundle beside the window (and clear of the opening),
      // while "closed" draws it across the glass. 0 = drawn back, 1 = closed.
      var width = 0.70 - 0.44 * open;
      var left = -1.82 + 0.46 * open;
      var waveA = 0.030 * (1 - open * 0.45);
      var waveLen = 0.155;
      for (var i = 0; i <= CU.uSegs; i++) {
        var tu = i / CU.uSegs;
        var z = left + width * tu;
        var yTop = CU.top + Math.sin(tu * 7.1) * 0.012;
        for (var j = 0; j <= CU.vSegs; j++) {
          var tv = j / CU.vSegs;
          var amp = waveA * (0.35 + 0.65 * tv);
          var fold = Math.sin((z / waveLen) * Math.PI * 2) * amp;
          curtGrid[i][j][0] = CU.cx + fold * 0.9;
          curtGrid[i][j][1] = yTop + (CU.bottom - yTop) * tv;
          curtGrid[i][j][2] = z;
        }
      }
      // fold contour lines follow the wave
      for (var fl2 = 0; fl2 < curtFold.length; fl2++) {
        var u = curtFold[fl2].u;
        for (var vv = 0; vv <= CU.vSegs; vv++) {
          var src = curtGrid[u][vv], dst = curtFold[fl2].vi[vv];
          dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2];
        }
      }
      curt.bounds = null;
      curt.rev++;
    }    sctx.updateCurtain = updateCurtain;
    sctx.updateCurtain(0);

    /* ---------- light switch plate, beside the door ---------- */
    var sw = named(S.addMesh(), 'room.switch');
    var swz = DOOR.z0 - 0.24, swy = 1.22;
    boxAt(sw, R.x0 + 0.012, swy, swz, 0.024, 0.115, 0.075, { fill: '@paper', kind: K.EDGE, shade: 0.0 });
    P.geom.outline(sw, [[-0.024, -0.017], [0.024, -0.017], [0.024, 0.017], [-0.024, 0.017]],
      function (u, v) { return [R.x0 + 0.022, swy + v, swz + u]; }, [1, 0, 0], 0.014,
      { fill: '@metal', kind: K.FINE });
    sctx.parts.switch = sw;
    sctx.switchPivot = [R.x0 + 0.036, swy, swz];
    sctx.switchLever = null;

    // lever: a small pivoting paddle (its own mesh so it can rock)
    var lever = named(S.addMesh(), 'room.switchLever');
    boxAt(lever, R.x0 + 0.040, swy, swz, 0.012, 0.030, 0.026, { fill: '@metal', kind: K.FINE, shade: 0.03 });
    sctx.parts.switchLever = lever;

    /* ---------- register the room-level interactive objects ---------- */
    var reg = sctx.register;
    var doorState = { open: 0, target: 0 };
    // The sideboard stands at (-1.32, ·, 0.92) with a turntable on top, inside
    // the door's natural 90° swing. Rather than move either of them, the leaf
    // stops at 28° — the door still reads as open, and nothing passes through
    // the furniture.
    var DOOR_MAX = 0.50;
    sctx.doorState = doorState;

    reg({
      id: 'door', label: '房门 Door', hint: '点击开关门',
      mesh: leaf, group: 'room', priority: 2, dynamicHit: true,
      hit: { min: [lx - 0.02, 0.0, DOOR.z0], max: [lx + lt + 0.09, DOOR.h, DOOR.z1] },
      hover: { lineWidth: 0.5 },
      onDown: function (ctx) {
        ctx.audio.play('latch');
      },
      onClick: function (ctx) {
        doorState.target = doorState.target > 0.5 ? 0 : 1;
        ctx.audio.play('door', { open: doorState.target > 0.5 });
        ctx.toast(doorState.target > 0.5 ? '门开了（只开了一条缝，柜子挡着）' : '门关上了');
      },
      update: function (dt, ctx) {
        var v = global.PLR.anim.approach(doorState.open, doorState.target, 1.05, dt);
        if (Math.abs(v - doorState.open) > 1e-5) {
          var d = (v - doorState.open) * DOOR_MAX;
          doorState.open = v;
          var hinge = sctx.parts.doorHinge;
          leaf.transform(function (x, y, z) {
            var dx = x - hinge.x, dz = z - hinge.z;
            return [hinge.x + dx * Math.cos(d) + dz * Math.sin(d), y, hinge.z - dx * Math.sin(d) + dz * Math.cos(d)];
          });
        }
      }
    });

    reg({
      id: 'blinds', label: '百叶帘 Blinds', hint: '点击开合',
      mesh: blind, group: 'room', priority: 1,
      // the hit box tracks the actual slats, not the whole window opening, so
      // it cannot swallow clicks aimed at the desk beside it
      hit: { min: [wx + 0.01, WIN.y0, WIN.z0], max: [wx + 0.14, WIN.y1 + 0.08, WIN.z1] },
      onClick: function (ctx) {
        var s = sctx.blindState;
        s.target = (s.target === undefined ? 0 : s.target + 1) % 3;
        var steps = [
          { bundle: 0.16, tilt: 0.30, say: '百叶拉开，光线很好' },
          { bundle: 0.58, tilt: 1.05, say: '半掩着' },
          { bundle: 1.00, tilt: 1.40, say: '百叶合上了' }
        ];
        s.goal = steps[s.target];
        ctx.audio.play('blinds');
        ctx.toast(steps[s.target].say);
      },
      update: function (dt, ctx) {
        var s = sctx.blindState;
        if (s.goal) {
          var nb = global.PLR.anim.approach(s.bundle, s.goal.bundle, 1.6, dt);
          var nt = global.PLR.anim.approach(s.tilt, s.goal.tilt, 2.1, dt);
          if (Math.abs(nb - s.bundle) > 1e-4 || Math.abs(nt - s.tilt) > 1e-4) {
            s.bundle = nb; s.tilt = nt; s.rebuild();
          }
        }
      }
    });

    reg({
      id: 'curtain', label: '窗帘 Curtain', hint: '点击拉合',
      mesh: curt, group: 'room', priority: 4, dynamicHit: true,
      // dynamicHit matters here: gathered at the side, a fixed box spanning the
      // whole run would sit in front of half the room and swallow every click
      // aimed at anything behind it.
      hit: { min: [wx - 0.16, 0.68, rodZ0], max: [wx - 0.02, rodY, rodZ1] },
      onClick: function (ctx) {
        sctx.curtainOpen = sctx.curtainOpen ? 0 : 1;
        sctx.curtainGoal = sctx.curtainOpen;
        ctx.audio.play('curtain');
        ctx.toast(sctx.curtainOpen ? '窗帘拉上了' : '窗帘拉开了');
      },
      update: function (dt, ctx) {
        if (sctx.curtainGoal === undefined) return;
        var v = global.PLR.anim.approach(sctx.curtainGathered || 0, sctx.curtainGoal, 1.0, dt);
        if (Math.abs(v - (sctx.curtainGathered || 0)) > 1e-4) {
          sctx.curtainGathered = v;
          updateCurtain(v);
        }
      }
    });

    reg({
      id: 'lightswitch', label: '灯光开关 Light', hint: '点击开关灯',
      mesh: sw, group: 'room', priority: 3,
      hit: { min: [R.x0, swy - 0.07, swz - 0.05], max: [R.x0 + 0.05, swy + 0.07, swz + 0.05] },
      onDown: function (ctx) { ctx.audio.play('click'); },
      onClick: function (ctx) {
        ctx.setEnv({ lightsOn: !ctx.env.lightsOn });
        ctx.audio.play('switch', { on: ctx.env.lightsOn });
        ctx.toast(ctx.env.lightsOn ? '灯亮了' : '灯灭了');
      },
      update: function (dt, ctx) {
        var on = ctx.env.lightsOn ? 1 : -1;
        // the paddle rocks one way or the other — a small, physical detail
        var cur = lever.paddle === undefined ? on : lever.paddle;
        var nv = global.PLR.anim.approach(cur, on, 8, dt);
        if (Math.abs(nv - cur) > 1e-4) {
          var lx0 = R.x0 + 0.040;
          lever.transform(function (x, y, z) {
            var yy = y - swy;
            var dz = z - swz;
            var ang = (nv - cur) * 0.22;
            return [x, swy + yy * Math.cos(ang) - dz * Math.sin(ang), swz + yy * Math.sin(ang) + dz * Math.cos(ang)];
          });
          lever.paddle = nv;
        }
      }
    });

    // The window glass itself cycles the time of day. It is only reachable where
    // the glass is actually exposed — priority -3 means the blind and the
    // curtain always win where they overlap it, which is exactly right: with the
    // curtain drawn you are looking at the curtain, not through the glass.
    reg({
      id: 'window', label: '窗外 Outside', hint: '点击推移时间',
      mesh: winM, group: 'room', priority: -3,
      hit: { min: [wx - 0.01, WIN.y0 + 0.06, WIN.z0 + 0.02], max: [wx + 0.04, WIN.y1 - 0.04, WIN.z1 - 0.02] },
      onClick: function (ctx) {
        var h = Math.floor(ctx.env.hour - 0.001);
        var marks = [7, 10, 13, 17, 19.2, 22.5];
        var next = marks[0];
        for (var i = 0; i < marks.length; i++) { if (marks[i] > h + 0.05) { next = marks[i]; break; } }
        var frac = ctx.env.minute / 60;
        var hh = Math.floor(next), mm = Math.round((next - hh) * 60);
        ctx.setEnv({ hour: hh, minute: mm, autoTime: false, timeScrub: next - (h + frac) });
        ctx.toast('时间推移到 ' + ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2));
        ctx.audio.play('chime', { soft: true });
      }
    });

    sctx.ROOM = R;
    sctx.WIN = WIN;
    sctx.DOOR = DOOR;
    return { R: R, WIN: WIN, DOOR: DOOR };
  }

  P.roomBuild = build;
  P.ROOM_DIMS = R;
  P.rotY = rotY;
})(typeof window !== 'undefined' ? window : globalThis);
