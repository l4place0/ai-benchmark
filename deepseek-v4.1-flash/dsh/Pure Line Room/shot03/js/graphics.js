/* =========================================================================
   Pure Line Room — graphics.js
   Mesh authoring for a node: filled faces (which occlude), plus a global edge
   list (which is stroked once, classified as crease / silhouette / hidden).
   Faces reference vertices by id, edges are {a, b, m}.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;
  var v3 = M.v3;

  var CAP_FAN_LIMIT = 26;

  function Graphics(node) {
    this.node = node;
    this.mesh = node.mesh;
    this.faces = node.faces = [];
    this.nv = 0;
    this.bad = 0;          // non-finite coordinates rejected
  }

  Graphics.prototype.v = function (x, y, z) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
      /* One stray coordinate poisons a face's plane test and can silently erase
         a whole solid, so it is reported and pinned to the origin. An argument
         count slip (a missing value in a g.box call) lands here. */
      this.bad++;
      if (this.bad <= 3 && typeof console !== 'undefined' && console.warn) {
        console.warn('[PLR] non-finite vertex in "' + (this.node.name || this.node.id) +
          '": (' + x + ', ' + y + ', ' + z + ')');
      }
      x = 0; y = 0; z = 0;
    }
    this.mesh.verts.push(x, y, z);
    return this.nv++;
  };

  Graphics.prototype.vs = function (list) {
    var out = [], i;
    for (i = 0; i < list.length; i++) out.push(this.v(list[i][0], list[i][1], list[i][2]));
    return out;
  };

  /* face(vertexIds, material, opts) */
  Graphics.prototype.face = function (ids, mat, opts) {
    if (!ids || ids.length < 3) return null;
    opts = opts || {};
    var f = {
      i: ids,
      m: mat || 'white',
      es: opts .edgeMats || null,
      hit: opts.hit || null,
      name: opts.name || '',
      glow: !!opts.glow,
    };
    this.faces.push(f);
    return f;
  };

  Graphics.prototype.edge = function (a, b, mat) {
    this.mesh.edges.push({ a: a, b: b, m: mat === undefined ? 'fine' : mat });
    return this;
  };

  Graphics.prototype.ring = function (ids, mat) {
    for (var i = 0; i < ids.length; i++) this.edge(ids[i], ids[(i + 1) % ids.length], mat);
    return this;
  };

  Graphics.prototype.polyline = function (ids, mat) {
    for (var i = 0; i + 1 < ids.length; i++) this.edge(ids[i], ids[i + 1], mat);
    return this;
  };

  /* Box edges are emitted exactly once, in the same order the renderer expects
     for a box (v = [x0y0z0, x1y0z0, x1y1z0, x0y1z0, x1y0z1, x0y0z1, x0y1z1,
     x1y1z1]). Pass mat = null to emit no edges at all. */
  Graphics.prototype._boxEdges = function (v, mat) {
    if (mat === null) return this;
    this.edge(v[0], v[1], mat); this.edge(v[1], v[4], mat); this.edge(v[4], v[5], mat); this.edge(v[5], v[0], mat);
    this.edge(v[3], v[2], mat); this.edge(v[2], v[7], mat); this.edge(v[7], v[6], mat); this.edge(v[6], v[3], mat);
    this.edge(v[0], v[3], mat); this.edge(v[1], v[2], mat); this.edge(v[4], v[7], mat); this.edge(v[5], v[6], mat);
    return this;
  };

  /* mats may be: a palette key, {all,back,left,bottom,right,top,front}, or
     {faces:{...}, edge:'key'}. Nothing is filled twice. */
  Graphics.prototype.box = function (x0, y0, z0, x1, y1, z1, mats, edgeMat) {
    var g = this;
    var v = [
      g.v(x0, y0, z0), g.v(x1, y0, z0), g.v(x1, y1, z0), g.v(x0, y1, z0),
      g.v(x1, y0, z1), g.v(x0, y0, z1), g.v(x0, y1, z1), g.v(x1, y1, z1),
    ];
    var fmat = {}, emat, def;
    if (typeof mats === 'string' || mats === undefined || mats === null) {
      def = mats || 'white';
      fmat = { all: def };
      emat = edgeMat === undefined ? { all: def } : edgeMat;
    } else {
      fmat = mats.faces || mats;
      def = fmat.all || fmat.back || fmat.front || 'white';
      emat = edgeMat !== undefined ? edgeMat : (mats.edge !== undefined ? mats.edge : undefined);
    }
    function faceMat(key) {
      if (typeof emat === 'object' && emat !== null) { /* noop */ }
      if (fmat[key] !== undefined) return fmat[key];
      if (fmat.all !== undefined) return fmat.all;
      if (fmat.default !== undefined) return fmat.default;
      return def;
    }
    function edgeM(key) {
      if (emat === undefined || emat === null || emat === false) return null;
      if (typeof emat === 'string') return emat;
      if (emat[key] !== undefined) return emat[key];
      if (emat.all !== undefined) return emat.all;
      return 'crease';
    }
    g.face([v[0], v[1], v[2], v[3]], faceMat('back'));
    g.face([v[0], v[3], v[7], v[4]], faceMat('left'));
    g.face([v[0], v[4], v[5], v[1]], faceMat('bottom'));
    g.face([v[1], v[5], v[6], v[2]], faceMat('right'));
    g.face([v[3], v[2], v[6], v[7]], faceMat('top'));
    g.face([v[4], v[7], v[6], v[5]], faceMat('front'));
    // bottom face edges are back-left, left-front, front-right, right-back;
    // map them to per-face material overrides where given
    g.edge(v[0], v[1], edgeM('bottom'));
    g.edge(v[1], v[4], edgeM('right'));
    g.edge(v[4], v[5], edgeM('bottom'));
    g.edge(v[5], v[0], edgeM('left'));
    g.edge(v[3], v[2], edgeM('top'));
    g.edge(v[2], v[7], edgeM('right'));
    g.edge(v[7], v[6], edgeM('top'));
    g.edge(v[6], v[3], edgeM('left'));
    g.edge(v[0], v[3], edgeM('back') || edgeM('left'));
    g.edge(v[1], v[2], edgeM('back') || edgeM('right'));
    g.edge(v[4], v[7], edgeM('front') || edgeM('right'));
    g.edge(v[5], v[6], edgeM('front') || edgeM('left'));
    return g;
  };

  Graphics.prototype.boxAt = function (cx, cy, cz, sx, sy, sz, mats, edgeMat) {
    return this.box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, mats, edgeMat);
  };

  function centroid2(profile, axis) {
    var s = 0;
    for (var i = 0; i < profile.length; i++) s += profile[i][axis];
    return s / profile.length;
  }

  /* Convex profile in the local XY plane, extruded along Z from z0 to z1. */
  Graphics.prototype.prism = function (profile, z0, z1, mat, opts) {
    opts = opts || {};
    var n = profile.length, i, j;
    var back = [], front = [];
    for (i = 0; i < n; i++) back.push(this.v(profile[i][0], profile[i][1], z0));
    for (i = 0; i < n; i++) front.push(this.v(profile[i][0], profile[i][1], z1));
    var capMat = opts.capMat || mat;
    if (opts.caps !== false) {
      if (n <= CAP_FAN_LIMIT) {
        this.face(back.slice().reverse(), capMat, { name: opts.name });
        this.face(front.slice(), capMat, { name: opts.name });
      } else {
        var cb = this.v(centroid2(profile, 0), centroid2(profile, 1), z0);
        var cf = this.v(centroid2(profile, 0), centroid2(profile, 1), z1);
        for (i = 0; i < n; i++) {
          this.face([cb, back[(i + 1) % n], back[i]], capMat);
          this.face([cf, front[i], front[(i + 1) % n]], capMat);
        }
      }
    }
    // walls carry their own interior crease lines only where asked for
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      this.face([back[i], back[j], front[j], front[i]], mat, { name: opts.name });
      if (opts.wallEdges !== false) {
        this.edge(back[i], back[j], opts.edgeMat || null);
        this.edge(front[i], front[j], opts.edgeMat || null);
        this.edge(back[i], front[i], opts.edgeMat || null);
      }
    }
    return this;
  };

  /* Surface of revolution around Y. profile = [[radius, y], ...] */
  Graphics.prototype.lathe = function (profile, opts) {
    opts = opts || {};
    var seg = Math.max(4, opts.segments || 14);
    var arc = opts.arc === undefined ? Math.PI * 2 : opts.arc;
    var closed = Math.abs(arc - Math.PI * 2) < 1e-6;
    var cols = closed ? seg : seg + 1;
    var mat = opts.mat || 'white';
    var rows = [], r, s;
    for (r = 0; r < profile.length; r++) {
      var row = [];
      for (s = 0; s < cols; s++) {
        var a = (s / seg) * arc;
        row.push(this.v(Math.cos(a) * profile[r][0], profile[r][1], Math.sin(a) * profile[r][0]));
      }
      rows.push(row);
    }
    for (r = 0; r + 1 < profile.length; r++) {
      for (s = 0; s < (closed ? cols : cols - 1); s++) {
        var s2 = (s + 1) % cols;
        this.face([rows[r][s], rows[r][s2], rows[r + 1][s2], rows[r + 1][s]],
          typeof mat === 'function' ? mat(r, s, u01(s, cols), v01(r, profile.length)) : mat,
          { name: opts.name });
      }
    }
    if (opts.edges !== false && opts.edgeMat !== null) {
      var em = opts.edgeMat;
      var step = Math.max(1, Math.round(seg / (opts.meridians || 8)));
      for (s = 0; s < (closed ? cols : cols - 1); s += step) {
        var ids = [];
        for (r = 0; r < profile.length; r++) ids.push(rows[r][s]);
        this.polyline(ids, em);
      }
      var ringStep = Math.max(1, Math.round((profile.length - 1) / 3));
      for (r = 0; r < profile.length; r += ringStep) this.ring(rows[r], em);
    }
    if (opts.caps !== false) {
      var capMat = opts.capMat || mat;
      var first = rows[0], last = rows[profile.length - 1];
      /* Caps must face away from the surface. When the profile widens as it
         goes down (r increasing, as on a shade or a foot) the ring order has
         to be reversed to keep the outward normal. */
      var r0 = profile[0][0], r1 = profile[profile.length - 1][0];
      var widenDown = r1 > r0;
      if (r0 > 1e-4) {
        if (closed) this.face(widenDown ? first.slice() : first.slice().reverse(), capMat);
        else this.face(first.slice(), capMat);
      }
      if (r1 > 1e-4) {
        if (closed) this.face(widenDown ? last.slice().reverse() : last.slice(), capMat);
        else this.face(last.slice().reverse(), capMat);
      }
    }
    return this;
  };

  function u01(i, n) { return n > 1 ? i / (n - 1) : 0; }
  function v01(i, n) { return n > 1 ? i / (n - 1) : 0; }

  /* Cylinder around the Y axis. */
  Graphics.prototype.cylinder = function (cx, cy, cz, r, h, mats) {
    mats = mats || {};
    var g = this;
    var seg = Math.max(6, mats.segments || 18);
    var sideMat = mats.side || mats.all || 'wood';
    var capMat = mats.cap || mats.all || sideMat;
    var back = [], front = [], i;
    for (i = 0; i < seg; i++) {
      var a = (i / seg) * Math.PI * 2;
      back.push(g.v(cx + Math.cos(a) * r, cy - h / 2, cz + Math.sin(a) * r));
    }
    for (i = 0; i < seg; i++) {
      var a2 = (i / seg) * Math.PI * 2;
      front.push(g.v(cx + Math.cos(a2) * r, cy + h / 2, cz + Math.sin(a2) * r));
    }
    if (seg <= CAP_FAN_LIMIT && mats.fan !== true) {
      g.face(back.slice().reverse(), capMat);
      g.face(front.slice(), capMat);
    } else {
      var cb = g.v(cx, cy - h / 2, cz), cf = g.v(cx, cy + h / 2, cz);
      for (i = 0; i < seg; i++) {
        g.face([cb, back[(i + 1) % seg], back[i]], capMat);
        g.face([cf, front[i], front[(i + 1) % seg]], capMat);
      }
    }
    for (i = 0; i < seg; i++) {
      var j = (i + 1) % seg;
      g.face([back[i], back[j], front[j], front[i]], sideMat);
    }
    if (mats.edges !== false) {
      var em = mats.edge === undefined ? 'crease' : mats.edge;
      if (em) {
        for (i = 0; i < seg; i++) {
          var j2 = (i + 1) % seg;
          g.edge(front[i], front[j2], em);
        }
        g.edge(front[0], back[0], em);
      }
    }
    return this;
  };

  /* Free-form quad grid. uvFn(u, v, i, j) -> world/local point, or use the
     origin + du/dv basis. Emits per-cell faces from mat(a, b, u, v). */
  Graphics.prototype.panel = function (origin, du, dv, mat, opts) {
    opts = opts || {};
    var nu = Math.max(1, opts.nu || 1), nv = Math.max(1, opts.nv || 1);
    var grid = [], i, j;
    for (i = 0; i <= nu; i++) {
      var row = [];
      for (j = 0; j <= nv; j++) {
        var u = i / nu, w = j / nv;
        var pt = opts.uvFn ? opts.uvFn(u, w, i, j)
          : v3.add(origin, v3.add(v3.mul(du, u), v3.mul(dv, w)));
        row.push(this.v(pt[0], pt[1], pt[2]));
      }
      grid.push(row);
    }
    for (i = 0; i < nu; i++) {
      for (j = 0; j < nv; j++) {
        var cell = typeof mat === 'function' ? mat(i, j, i / nu, j / nv) : mat;
        this.face([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]], cell,
          { name: opts.name, hit: opts.hit });
      }
    }
    if (opts.edges !== false) {
      var em = opts.edgeMat === undefined ? null : opts.edgeMat;
      if (em) {
        for (i = 0; i <= nu; i++) this.polyline(grid[i], em);
        for (j = 0; j <= nv; j++) {
          var col = [];
          for (i = 0; i <= nu; i++) col.push(grid[i][j]);
          this.polyline(col, em);
        }
      }
    }
    if (opts.outline) {
      this.ring([grid[0][0], grid[nu][0], grid[nu][nv], grid[0][nv]], opts.outline);
    }
    return this;
  };

  /* Circle in a plane, returned as a list of vertex ids (also usable as an
     n-gon face). axis: 'x' | 'y' | 'z'. */
  Graphics.prototype.ringIds = function (c, r, axis, segments, phase) {
    var seg = segments || 22, ids = [], ph = phase || 0;
    for (var i = 0; i < seg; i++) {
      var a = (i / seg) * Math.PI * 2 + ph;
      var ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      if (axis === 'y') ids.push(this.v(c[0] + ca, c[1], c[2] + sa));
      else if (axis === 'x') ids.push(this.v(c[0], c[1] + ca, c[2] + sa));
      else ids.push(this.v(c[0] + ca, c[1] + sa, c[2]));
    }
    return ids;
  };

  Graphics.prototype.disc = function (c, r, axis, mat, segments) {
    var ids = this.ringIds(c, r, axis, segments);
    this.face(ids, mat);
    return ids;
  };

  Graphics.prototype.circleOutline = function (c, r, axis, mat, segments) {
    var ids = this.ringIds(c, r, axis, segments);
    this.ring(ids, mat);
    return ids;
  };

  PLR.graphics = { Graphics: Graphics };
})(typeof window !== 'undefined' ? window : globalThis);
