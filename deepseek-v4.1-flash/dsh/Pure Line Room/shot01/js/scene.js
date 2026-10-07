/* =============================================================================
   Pure Line Room — scene.js
   The shared geometry language. Every object in the room is described as an
   indexed polygon soup (flat-shaded faces + explicit line edges) built through
   this small API. Builders are pure: they receive a `ctx` bundle and a palette
   and return a mesh.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;

  /* ---------------------------------------------------------------------------
     The drawing language, in one place. Each element is a flat-shaded polygon
     plus explicit edge strokes, which is what gives the work its line-art
     character: silhouettes, interior construction lines and faint curvature
     lines all have their own weight.
     ------------------------------------------------------------------------- */
  var K = {
    SIL: 'sil',    // outer silhouette of a form        → heaviest, brightest
    EDGE: 'edge',  // strong structural edge             → normal furniture outline
    FINE: 'fine',  // interior construction line         → detail, lighter
    SOFT: 'soft',  // faint contour / curvature hint     → very light, thin
    FAR: 'far'     // edges belonging to far-away scenery→ lightest
  };

  // Default stroke weight (in css pixels at the reference eye depth) per kind.
  var KIND_W = { sil: 2.35, edge: 1.35, fine: 0.95, soft: 0.7, far: 0.75 };
  // Ink strength multiplier per kind (1 = full ink colour).
  var KIND_INK = { sil: 1.0, edge: 0.82, fine: 0.55, soft: 0.34, far: 0.42 };
  // How far a fill is pushed toward the ink colour (baked ambient occlusion).
  var KIND_SHADE = { sil: 0.0, edge: 0.0, fine: 0.0, soft: 0.02, far: 0.05 };

  function shade(hex, amount, inkHex) {
    if (!amount) return hex;
    var a = hexToRgb(hex), b = hexToRgb(inkHex || '#1b1c24');
    return rgbToHex(
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount
    );
  }

  function hexToRgb(h) {
    if (typeof h !== 'string') return [230, 230, 230];
    if (h[0] === '#' && h.length === 7) {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }
    if (h[0] === '#' && h.length === 4) {
      return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
    }
    var m = /rgba?\(([^)]+)\)/.exec(h);
    if (m) {
      var p = m[1].split(',').map(function (s) { return parseFloat(s); });
      return [p[0] || 0, p[1] || 0, p[2] || 0];
    }
    return [230, 230, 230];
  }

  function rgbToHex(r, g, b) {
    function c(v) {
      v = Math.round(M.clamp(v, 0, 255));
      return (v < 16 ? '0' : '') + v.toString(16);
    }
    return '#' + c(r) + c(g) + c(b);
  }

  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }

  // Slightly darken/lighten — used for cheap baked lighting per face.
  function tone(hex, amount, inkHex) { return shade(hex, amount, inkHex); }
  function lighten(hex, amount) { return mix(hex, '#ffffff', amount); }

  /* ---------------------------------------------------------------------------
     Mesh
     --------------------------------------------------------------------------- */
  function Mesh(verts, faces) {
    this.verts = verts || [];   // [[x,y,z], ...]
    this.faces = faces || [];   // [{vi:[..], fill, kind, glow, dot, cull}]
    this.bounds = null;         // lazy
    this.rev = 0;               // bumped whenever geometry changes
  }

  Mesh.prototype.vertex = function (p) {
    this.verts.push([p[0], p[1], p[2]]);
    this.rev++;
    return this.verts.length - 1;
  };

  Mesh.prototype.vertices = function (list) {
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(this.vertex(list[i]));
    return out;
  };

  Mesh.prototype.face = function (vi, opts) {
    if (!vi || vi.length < 3) return -1;
    opts = opts || {};
    this.faces.push({
      vi: vi,
      fill: opts.fill === undefined ? null : opts.fill,
      kind: opts.kind || K.EDGE,
      glow: opts.glow || 0,
      dot: opts.dot || 0,        // screen-space dot pattern: 0 none, 1 sparse, 2 dense
      hatch: opts.hatch || null, // screen-space diagonal hatching spec
      shade: opts.shade || 0,    // baked ambient occlusion, resolved at draw time
      cull: !!opts.cull,         // skip when facing away from the camera
      hidden: !!opts.hidden      // never drawn (used as an anchor)
    });
    this.rev++;
    return this.faces.length - 1;
  };

  Mesh.prototype.removeFace = function (index) {
    if (index >= 0 && index < this.faces.length) {
      this.faces[index] = { vi: [0, 0, 0], hidden: true, fill: null, kind: K.SOFT, glow: 0, dot: 0 };
      this.rev++;
    }
  };

  // Transform every vertex in place (used to open doors, slide drawers, ...).
  Mesh.prototype.transform = function (fn) {
    for (var i = 0; i < this.verts.length; i++) {
      var p = fn(this.verts[i][0], this.verts[i][1], this.verts[i][2]);
      this.verts[i][0] = p[0]; this.verts[i][1] = p[1]; this.verts[i][2] = p[2];
    }
    this.rev++;
    return this;
  };

  Mesh.prototype.setFaceFill = function (index, fill) {
    var f = this.faces[index];
    if (f) { f.fill = fill; this.rev++; }
  };

  Mesh.prototype.setVert = function (i, p) {
    var v = this.verts[i];
    if (!v) { this.verts[i] = [p[0], p[1], p[2]]; return; }
    v[0] = p[0]; v[1] = p[1]; v[2] = p[2];
  };

  Mesh.prototype.invalidate = function () { this.bounds = null; this.rev++; };

  Mesh.prototype.getBounds = function () {
    if (this.bounds) return this.bounds;
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    var any = false;
    for (var fi = 0; fi < this.faces.length; fi++) {
      var f = this.faces[fi];
      if (f.hidden) continue;                 // hidden geometry must not count
      for (var k = 0; k < f.vi.length; k++) {
        var v = this.verts[f.vi[k]];
        if (!v) continue;
        any = true;
        for (var c = 0; c < 3; c++) {
          if (v[c] < mn[c]) mn[c] = v[c];
          if (v[c] > mx[c]) mx[c] = v[c];
        }
      }
    }
    if (!any) { mn = [0, 0, 0]; mx = [0, 0, 0]; }
    this.bounds = { min: mn, max: mx };
    return this.bounds;
  };

  /** Mark every currently-unhidden face as part of a named group. */
  Mesh.prototype.tagFaces = function (from, to, tag) {
    for (var i = from; i <= to && i < this.faces.length; i++) {
      if (this.faces[i]) this.faces[i].tag = tag;
    }
    return this;
  };

  /** Show/hide everything carrying a tag. */
  Mesh.prototype.setTagVisible = function (tag, visible) {
    for (var i = 0; i < this.faces.length; i++) {
      var f = this.faces[i];
      if (f.tag === tag) f.hidden = !visible;
    }
    this.bounds = null;
  };

  /* ---------------------------------------------------------------------------
     Scene
     --------------------------------------------------------------------------- */
  function Scene() {
    this.meshes = [];
    this.interactives = [];
    this.env = {
      day: 1,             // 0 night … 1 full daylight outside
      hour: 12,
      minute: 0,
      lightsOn: false,
      lampOn: false,
      hue: 0             // small palette jitter for organic variety
    };
    this.time = 0;        // seconds since load
  }

  Scene.prototype.addMesh = function (verts, faces) {
    var m = new Mesh(verts, faces);
    this.meshes.push(m);
    return m;
  };

  // Build a mesh with a callback that receives a fresh builder.
  Scene.prototype.build = function (fn, arg) {
    var m = new Mesh();
    fn(m, arg);
    this.meshes.push(m);
    return m;
  };

  /* ---------------------------------------------------------------------------
     Geometry helpers — everything a builder needs.
     --------------------------------------------------------------------------- */
  var geom = {
    K: K,
    KIND_W: KIND_W,
    KIND_INK: KIND_INK,
    shade: shade, mix: mix, tone: tone, lighten: lighten,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex,

    /** A standalone polygon face. */
    quad: function (m, a, b, c, d, opts) {
      var vi = m.vertices([a, b, c, d]);
      return m.face(vi, opts);
    },

    tri: function (m, a, b, c, opts) {
      var vi = m.vertices([a, b, c]);
      return m.face(vi, opts);
    },

    poly: function (m, pts, opts) {
      var vi = m.vertices(pts);
      return m.face(vi, opts);
    },

    /** An explicit line, drawn as a degenerate face with no fill. */
    line: function (m, a, b, opts) {
      opts = opts || {};
      var vi = m.vertices([a, b, a]);
      return m.face(vi, {
        fill: null, kind: opts.kind || K.FINE, glow: opts.glow || 0, cull: false
      });
    },

    lineList: function (m, pts, opts) {
      for (var i = 0; i + 1 < pts.length; i++) geom.line(m, pts[i], pts[i + 1], opts);
    },

    /** Closed loop of explicit lines. */
    loop: function (m, pts, opts) {
      for (var i = 0; i < pts.length; i++) {
        geom.line(m, pts[i], pts[(i + 1) % pts.length], opts);
      }
    },

    /**
     * A rectangular box. The workhorse.
     * opts: fill, kind, cull, open{px,nx,py,ny,pz,nz}, edges (explicit edge
     * strokes on the 12 box edges), shade (baked face darkening by facing).
     */
    box: function (m, center, size, opts) {
      opts = opts || {};
      var cx = center[0], cy = center[1], cz = center[2];
      var hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
      var p = [
        [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
        [cx + hx, cy - hy, cz + hz], [cx - hx, cy - hy, cz + hz],
        [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz],
        [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]
      ];
      return geom.hullBox(m, p, opts);
    },

    /** Box from 8 arbitrary corner points (0..3 bottom ccw, 4..7 top ccw). */
    hullBox: function (m, p, opts) {
      opts = opts || {};
      var open = opts.open || {};
      var base = opts.fill === undefined ? null : opts.fill;
      var vi = m.vertices(p);
      var faces = [
        ['pz', [vi[3], vi[2], vi[6], vi[7]], 0],   // +z
        ['nz', [vi[1], vi[0], vi[4], vi[5]], 0],   // -z
        ['px', [vi[2], vi[1], vi[5], vi[6]], 0],   // +x
        ['nx', [vi[0], vi[3], vi[7], vi[4]], 0],   // -x
        ['py', [vi[4], vi[7], vi[6], vi[5]], 0],   // +y
        ['ny', [vi[0], vi[1], vi[2], vi[3]], 1]    // -y
      ];
      for (var i = 0; i < faces.length; i++) {
        var key = faces[i][0];
        if (open[key]) continue;
        var fill = base;
        if (fill && opts.shade && !opts.flat) {
          // cheap directional bake: top faces catch light, side faces fall off
          var f = faces[i][2];
          fill = shade(fill, f * 0.045);
        }
        m.face(faces[i][1], {
          fill: fill, kind: opts.kind || K.EDGE, cull: !!opts.cull,
          glow: opts.glow || 0, dot: opts.dot || 0
        });
      }
      if (opts.edges !== false) {
        var ek = opts.edgeKind || K.EDGE;
        var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (var e = 0; e < E.length; e++) {
          if (opts.openEdges && opts.openEdges.indexOf(E[e].join('-')) >= 0) continue;
          geom.line(m, p[E[e][0]], p[E[e][1]], { kind: ek, glow: opts.glow || 0 });
        }
      }
      return vi;
    },

    /**
     * An "outline" solid: a plate/beam/panel built from a 2D profile that is
     * swept a thickness along an axis. Perfect for frames, legs, shelves,
     * slats, table tops, book spines — anything that would otherwise be a
     * suspiciously perfect cube.
     *   profile : [[u,v], ...] convex polygon, CCW
     *   map     : function(u,v) -> [x,y,z] on the near face
     *   normal  : extrusion direction (unit) and `depth` its length
     */
    outline: function (m, profile, map, normal, depth, opts) {
      opts = opts || {};
      var n = profile.length;
      var front = [], back = [];
      var i;
      for (i = 0; i < n; i++) {
        front.push(map(profile[i][0], profile[i][1]));
      }
      for (i = 0; i < n; i++) {
        back.push([
          front[i][0] + normal[0] * depth,
          front[i][1] + normal[1] * depth,
          front[i][2] + normal[2] * depth
        ]);
      }
      var fvi = m.vertices(front);
      var bvi = m.vertices(back);
      var facing = normal[1] > 0.4 ? 1 : (normal[1] < -0.4 ? 0.5 : 0);
      var fv = opts.fill === undefined ? null : opts.fill;
      m.face(fvi, { fill: fv, kind: opts.kind || K.EDGE, cull: !!opts.cull, glow: opts.glow || 0 });
      m.face(bvi.slice().reverse(), { fill: fv, kind: opts.kind || K.EDGE, cull: !!opts.cull, glow: opts.glow || 0 });
      // side walls
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n;
        m.face([fvi[i], fvi[j], bvi[j], bvi[i]], {
          fill: fv ? shade(fv, 0.03 + (facing ? 0 : 0.02)) : null,
          kind: opts.sideKind || K.EDGE, glow: opts.glow || 0
        });
      }
      if (opts.silhouette !== false) {
        geom.loop(m, front, { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
        geom.loop(m, back, { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      }
      return { front: fvi, back: bvi };
    },

    /** Axis-aligned plate: spans x0..x1, y0..y1 at plane z, thickness t into +z. */
    plateZ: function (m, x0, y0, x1, y1, z, t, opts) {
      return geom.outline(m, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        function (u, v) { return [u, v, z]; }, [0, 0, 1], t, opts);
    },

    /** Points on a circle, in the XY plane at z, or oriented by a frame. */
    circlePts: function (cx, cy, cz, r, segs, axis) {
      var out = [];
      axis = axis || 'z';
      for (var i = 0; i < segs; i++) {
        var a = (i / segs) * Math.PI * 2;
        var c = Math.cos(a) * r, s = Math.sin(a) * r;
        if (axis === 'z') out.push([cx + c, cy + s, cz]);
        else if (axis === 'y') out.push([cx + c, cy, cz + s]);
        else out.push([cx, cy + c, cz + s]);
      }
      return out;
    },

    /** A flat annulus (ring) as a face strip — bezels, rims, halos. */
    ring: function (m, center, rIn, rOut, segs, opts) {
      opts = opts || {};
      var axis = opts.axis || 'z';
      var i0 = geom.circlePts(center[0], center[1], center[2], rIn, segs, axis);
      var o0 = geom.circlePts(center[0], center[1], center[2], rOut, segs, axis);
      for (var i = 0; i < segs; i++) {
        var j = (i + 1) % segs;
        m.face(m.vertices([i0[i], o0[i], o0[j], i0[j]]), {
          fill: opts.fill === undefined ? null : opts.fill,
          kind: K.SOFT, glow: opts.glow || 0
        });
      }
      return null;
    },

    /** Circle outline as explicit lines. */
    circleLines: function (m, center, r, segs, opts) {
      opts = opts || {};
      var pts = geom.circlePts(center[0], center[1], center[2], r, segs, opts.axis);
      geom.loop(m, pts, { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      return pts;
    },

    /** Flat disc face. */
    disc: function (m, center, r, segs, opts) {
      opts = opts || {};
      var pts = geom.circlePts(center[0], center[1], center[2], r, segs, opts.axis);
      var f = m.face(m.vertices(pts), {
        fill: opts.fill === undefined ? null : opts.fill,
        kind: opts.kind || K.EDGE, glow: opts.glow || 0, dot: opts.dot || 0
      });
      if (opts.rim !== false) geom.loop(m, pts, { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      return f;
    },

    /**
     * Cylinder between two arbitrary points. Produces a real tube with end caps
     * so legs, lamp arms, fan rods and knobs never look like pasted boxes.
     */
    tube: function (m, a, b, r0, r1, segs, opts) {
      opts = opts || {};
      segs = segs || 10;
      var axis = M.norm(M.sub(b, a));
      var up = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      var t1 = M.norm(M.cross(axis, up));
      var t2 = M.norm(M.cross(axis, t1));
      var ringA = [], ringB = [], i;
      for (i = 0; i < segs; i++) {
        var ang = (i / segs) * Math.PI * 2;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        ringA.push([
          a[0] + (t1[0] * ca + t2[0] * sa) * r0,
          a[1] + (t1[1] * ca + t2[1] * sa) * r0,
          a[2] + (t1[2] * ca + t2[2] * sa) * r0
        ]);
        ringB.push([
          b[0] + (t1[0] * ca + t2[0] * sa) * r1,
          b[1] + (t1[1] * ca + t2[1] * sa) * r1,
          b[2] + (t1[2] * ca + t2[2] * sa) * r1
        ]);
      }
      var ai = m.vertices(ringA), bi = m.vertices(ringB);
      var fill = opts.fill === undefined ? null : opts.fill;
      for (i = 0; i < segs; i++) {
        var j = (i + 1) % segs;
        m.face([ai[i], ai[j], bi[j], bi[i]], {
          fill: fill ? shade(fill, (i % 4 === 0 ? 0.02 : 0)) : null,
          kind: K.SOFT, glow: opts.glow || 0
        });
      }
      if (opts.caps !== false) {
        m.face(ai.slice().reverse(), { fill: fill ? shade(fill, 0.06) : null, kind: K.FINE, glow: opts.glow || 0 });
        m.face(bi, { fill: fill ? shade(fill, 0.02) : null, kind: K.FINE, glow: opts.glow || 0 });
      }
      // one silhouette line pair along the tube, so it reads as a drawn form
      geom.line(m, ringA[0], ringB[0], { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      geom.line(m, ringA[(segs / 2) | 0], ringB[(segs / 2) | 0], { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      if (opts.fills) {
        geom.circleLines(m, a, r0, segs, { kind: K.SOFT });
        geom.circleLines(m, b, r1, segs, { kind: K.SOFT });
      }
      return { a: ai, b: bi };
    },

    /**
     * Surface of revolution around the Y axis, defined by a radius profile.
     * Used for cups, lamp shades, vases, bowls, cones.
     * profile: [[y, radius], ...] bottom→top
     */
    lathe: function (m, center, profile, segs, opts) {
      opts = opts || {};
      segs = segs || 14;
      var rows = [];
      for (var k = 0; k < profile.length; k++) {
        var y = profile[k][0], r = profile[k][1];
        var ring = [];
        for (var i = 0; i < segs; i++) {
          var a = (i / segs) * Math.PI * 2;
          ring.push([center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r]);
        }
        rows.push(m.vertices(ring));
      }
      var fill = opts.fill === undefined ? null : opts.fill;
      for (var row = 0; row + 1 < rows.length; row++) {
        for (var s = 0; s < segs; s++) {
          var n = (s + 1) % segs;
          var facing = (s % 3 === 0) ? 0.03 : ((s % 3 === 1) ? 0.05 : 0.0);
          m.face([rows[row][s], rows[row][n], rows[row + 1][n], rows[row + 1][s]], {
            fill: fill ? shade(fill, facing) : null, kind: K.SOFT,
            glow: opts.glow || 0, cull: opts.cull !== false
          });
        }
      }
      if (opts.base !== false) {
        m.face(rows[0].slice().reverse(), { fill: fill ? shade(fill, 0.07) : null, kind: K.FINE });
      }
      if (opts.top) {
        m.face(rows[rows.length - 1], { fill: opts.topFill ? opts.topFill : (fill ? shade(fill, 0.1) : null), kind: K.FINE });
      }
      if (opts.contours) {
        // horizontal construction ellipses — the detail that makes round forms legible
        for (var q = (opts.contourStep || 1); q < rows.length; q += (opts.contourStep || 1)) {
          var pts = [];
          for (var s2 = 0; s2 < segs; s2++) {
            var a2 = (s2 / segs) * Math.PI * 2;
            var yv = profile[q][0], rv = profile[q][1];
            pts.push([center[0] + Math.cos(a2) * rv, center[1] + yv, center[2] + Math.sin(a2) * rv]);
          }
          geom.loop(m, pts, { kind: opts.contourKind || K.SOFT });
        }
      }
      return rows;
    },

    /**
     * Extrude a closed 2D polygon (in the XZ plane) upward into a prism — sofa
     * bodies, cabinets, plinths, rugs with thickness.
     */
    prism: function (m, poly2d, y0, y1, opts) {
      opts = opts || {};
      var n = poly2d.length, i;
      var bot = [], top = [];
      for (i = 0; i < n; i++) bot.push([poly2d[i][0], y0, poly2d[i][1]]);
      for (i = 0; i < n; i++) top.push([poly2d[i][0], y1, poly2d[i][1]]);
      var bi = m.vertices(bot), ti = m.vertices(top);
      var fill = opts.fill === undefined ? null : opts.fill;
      m.face(ti, { fill: fill ? shade(fill, 0.02) : null, kind: opts.kind || K.EDGE, glow: opts.glow || 0, dot: opts.dot || 0 });
      if (opts.bottom !== false) {
        m.face(bi.slice().reverse(), { fill: fill ? shade(fill, 0.08) : null, kind: K.FINE });
      }
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n;
        m.face([bi[i], bi[j], ti[j], ti[i]], {
          fill: fill ? shade(fill, i % 2 ? 0.045 : 0.025) : null,
          kind: opts.sideKind || K.EDGE, glow: opts.glow || 0
        });
      }
      if (opts.silhouette !== false) geom.loop(m, top, { kind: opts.kind || K.EDGE, glow: opts.glow || 0 });
      return { bot: bi, top: ti };
    },

    /** Bowed panel — an arc-swept surface for cushions, curtains, lampshades. */
    bowedPanel: function (m, corner, uDir, vDir, uLen, vLen, bow, uSegs, vSegs, opts) {
      opts = opts || {};
      uSegs = uSegs || 6; vSegs = vSegs || 3;
      var grid = [];
      for (var i = 0; i <= uSegs; i++) {
        var row = [];
        var tu = i / uSegs;
        var bulge = Math.sin(tu * Math.PI) * bow;
        for (var j = 0; j <= vSegs; j++) {
          var tv = j / vSegs;
          row.push([
            corner[0] + uDir[0] * uLen * tu + vDir[0] * vLen * tv + (opts.bowDir ? opts.bowDir[0] * bulge : 0),
            corner[1] + uDir[1] * uLen * tu + vDir[1] * vLen * tv + (opts.bowDir ? opts.bowDir[1] * bulge : 0),
            corner[2] + uDir[2] * uLen * tu + vDir[2] * vLen * tv + (opts.bowDir ? opts.bowDir[2] * bulge : 0)
          ]);
        }
        grid.push(m.vertices(row));
      }
      var fill = opts.fill === undefined ? null : opts.fill;
      for (var a = 0; a < uSegs; a++) {
        for (var b = 0; b < vSegs; b++) {
          m.face([grid[a][b], grid[a + 1][b], grid[a + 1][b + 1], grid[a][b + 1]], {
            fill: fill ? shade(fill, ((a + b) % 2) * 0.035) : null,
            kind: opts.kind || K.EDGE, glow: opts.glow || 0, dot: opts.dot || 0
          });
        }
      }
      if (opts.contours) {
        for (var c = 1; c < vSegs; c++) {
          var pts = [];
          for (var d = 0; d <= uSegs; d++) pts.push(grid[d][c]);
          geom.lineList(m, pts, { kind: K.SOFT });
        }
      }
      return grid;
    },

    /** Deterministic pseudo-random in [0,1) — same room every reload. */
    rnd: function (seed) {
      var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    },

    rndRange: function (seed, lo, hi) { return lo + geom.rnd(seed) * (hi - lo); },

    /** A pair of helper axes for building things along a direction. */
    frame: function (axis) {
      axis = M.norm(axis);
      var up = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      var t1 = M.norm(M.cross(axis, up));
      var t2 = M.norm(M.cross(axis, t1));
      return [t1, t2];
    }
  };

  global.PLR = global.PLR || {};
  global.PLR.Mesh = Mesh;
  global.PLR.Scene = Scene;
  global.PLR.geom = geom;
  global.PLR.K = K;
})(typeof window !== 'undefined' ? window : globalThis);
