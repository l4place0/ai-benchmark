/* =========================================================================
   Pure Line Room — renderer.js

   A hand written hidden-line renderer for vector line art.

   Pipeline per frame
   ------------------
   1. classify  — transform each solid's vertices to camera space, work out
                  the signed distance from the camera to every face plane.
                  Positive = the face turns toward the camera.
   2. project   — screen-space vertices for front faces; near-plane clipping
                  for the ones that straddle the camera.
   3. sort      — solids far to near, then, inside a solid, faces far to near.
   4. paint     — opaque "paper" fills occlude everything behind them, then
                  crisp front-face edges are stroked on top. Back faces get a
                  light construction stroke *before* the fills, so they show
                  only where nothing covers them.
   5. detail    — objects may draw immediate-mode details (clock hands, art,
                  steam, book spines) in world space, depth aware.

   Line weight is expressed in world units per material and divided by the
   face depth, so a profile line stays the same visual weight at any distance.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;
  var v3 = M.v3;
  var m4 = M.m4;
  var clamp = M.clamp;

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return [0, 0, 0];
    if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toRgb(c) {
    return typeof c === 'string' ? hexToRgb(c) : (c || [0, 0, 0]);
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (+a.toFixed(3)) + ')';
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  var SEG_NL = [4, 5, 6, 7];
  var SEG_PL = [0, 1, 4, 5];
  var SEG_NT = [0, 1, 2, 3];
  var SEG_PT = [4, 5, 6, 7];
  var SEG_NX = [0, 3, 7, 4];
  var SEG_PX = [1, 2, 6, 5];
  var SEG_NZ = [0, 1, 2, 3];
  var SEG_PZ = [4, 5, 6, 7];
  var SEG_ALL = [0, 1, 2, 3, 4, 5, 6, 7];

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.w = 1; this.h = 1;
    this.focal = 430;
    this.near = 16;
    this.center = [0, 140, -40];
    this.cam = {
      pos: [0, 134, 320], yaw: 0, pitch: -0.16,
      targetPos: [0, 134, 320], targetYaw: 0, targetPitch: -0.16,
      lambda: 7.5,
    };
    this.palette = {};
    this.overlays = [];
    this.debug = { faces: 0, hidden: 0, solidCount: 0, ms: 0 };
    this.groundY = 0;

    this._vbuf = new Float64Array(60000);
    this._vcount = 0;
    this._faces = [];      // per-solid face records, reused
    this._solids = [];
    this._order = [];
    this._hits = [];
    this._matA = {}; this._matB = {};
    this._tmp = [0, 0, 0];
    this._fontScale = 1;
    this.interactiveOnly = true;
  }

  Renderer.prototype.resize = function (cssW, cssH, dpr, cap) {
    var d = clamp(dpr || 1, 1, cap || 1.75);
    this.dpr = d;
    this.w = Math.max(1, cssW);
    this.h = Math.max(1, cssH);
    this.canvas.width = Math.round(this.w * d);
    this.canvas.height = Math.round(this.h * d);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this._fontScale = clamp(Math.min(this.w, this.h) / 900, 0.72, 1.5);
  };

  Renderer.prototype.setCamera = function (pos, yaw, pitch) {
    var c = this.cam;
    c.pos[0] = pos[0]; c.pos[1] = pos[1]; c.pos[2] = pos[2];
    c.yaw = yaw; c.pitch = pitch;
    c.targetPos[0] = pos[0]; c.targetPos[1] = pos[1]; c.targetPos[2] = pos[2];
    c.targetYaw = yaw; c.targetPitch = pitch;
  };

  Renderer.prototype.updateCamera = function (dt) {
    var c = this.cam;
    c.pos[0] = M.ease.damp(c.pos[0], c.targetPos[0], c.lambda, dt);
    c.pos[1] = M.ease.damp(c.pos[1], c.targetPos[1], c.lambda, dt);
    c.pos[2] = M.ease.damp(c.pos[2], c.targetPos[2], c.lambda, dt);
    c.yaw = M.ease.damp(c.yaw, c.targetYaw, c.lambda, dt);
    c.pitch = M.ease.damp(c.pitch, c.targetPitch, c.lambda, dt);
  };

  Renderer.prototype.setPalette = function (p) { this.palette = p; };

  /* ------------------------------- materials ----------------------------- */
  Renderer.prototype.resolveMat = function (spec, out) {
    var pal = this.palette;
    var key, over = null;
    if (spec && typeof spec === 'object') { over = spec; key = spec.m || 'white'; }
    else key = spec || 'white';
    var def = pal[key] || pal.white || {};
    var fillC = (over && over.fill) || def.fill || '#ffffff';
    var strokeC = (over && over.stroke) || def.stroke || '#20202a';
    var fo = over && over.fillOpacity !== undefined ? over.fillOpacity : (def.fillOpacity !== undefined ? def.fillOpacity : 1);
    var so = over && over.strokeOpacity !== undefined ? over.strokeOpacity : (def.strokeOpacity !== undefined ? def.strokeOpacity : 1);
    var wgt = over && over.weight !== undefined ? over.weight : (def.weight !== undefined ? def.weight : 1);
    var shade = (over && over.shade !== undefined ? over.shade : (def.shade || 0)) + (pal.__shadeBias || 0);
    var dash = over && over.dash !== undefined ? over.dash : (def.dash || null);

    var fill = toRgb(fillC);
    var stroke = toRgb(strokeC);
    var dk = pal.__dark || 0;
    if (dk) {
      fill = mixRgb(fill, pal.__nightFill || [16, 18, 26], dk);
      stroke = mixRgb(stroke, pal.__nightStroke || [222, 226, 240], dk * (pal.__strokeLift || 0.34));
    }
    if (pal.__warm) fill = mixRgb(fill, pal.__warmFill || [255, 236, 206], pal.__warm);
    if (shade) fill = mixRgb(fill, pal.__shadeColor || [168, 170, 182], shade);
    out.fill = fill;
    out.stroke = stroke;
    out.fo = clamp(fo, 0, 1);
    out.so = clamp(so, 0, 1);
    out.w = wgt;
    out.dash = dash;
    out.font = (over && over.font) || def.font || null;
    return out;
  };

  /* ------------------------------- render -------------------------------- */
  Renderer.prototype.render = function (scene) {
    var t0 = (root.performance || Date).now();
    var ctx = this.ctx;
    var camM = M.cameraMatrix(this.cam.pos, this.cam.yaw, this.cam.pitch);
    var view = (this._view = camM.view);
    this._eye = camM.pos;
    this._cx = this.w / 2;
    this._cy = this.h / 2;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    var pal = this.palette;
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.__bg || '#fbfbfa';
    ctx.fillRect(0, 0, this.w, this.h);

    this._hits.length = 0;
    this.overlays.length = 0;
    this._vcount = 0;

    this._classify(scene, view);

    /* ---- fills, far to near ---- */
    var solids = this._solids;
    var i, k, n;
    for (i = 0; i < solids.length; i++) {
      var s = solids[i];
      var fb = s._front;
      n = fb.length;
      for (k = 0; k < n; k++) {
        var rec = fb[k];
        var m = this.resolveMat(rec.f.m, this._matA);
        ctx.globalAlpha = m.fo;
        ctx.fillStyle = rgba(m.fill, 1);
        this._path(ctx, rec.off, rec.cnt);
        ctx.fill();
      }
    }

    /* ---- global veil (softens / lifts the whole plate) ---- */
    if (pal.__veil) {
      ctx.globalAlpha = pal.__veil;
      ctx.fillStyle = pal.__veilColor || '#ffffff';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    /* ---- back faces: light construction lines under the fills ---- */
    var hiddenSeen = 0;
    this._beginBands();
    for (i = 0; i < solids.length; i++) {
      s = solids[i];
      var bk = s._back;
      for (k = 0; k < bk.length; k++) {
        var rb = bk[k];
        this._bandFace(ctx, rb, 'hidden');
        hiddenSeen += rb.cnt;
      }
    }
    this._flushBands(ctx);

    /* ---- front face outlines, batched by material and depth band ---- */
    this._beginBands();
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < solids.length; i++) {
        s = solids[i];
        var fr = s._front;
        for (k = 0; k < fr.length; k++) this._bandFace(ctx, fr[k], pass === 0 ? 'crease' : 'sil');
      }
    }
    /* ---- authored detail edges (floor boards, book spines, wires…) ---- */
    this._collectEdges(solids);
    this._flushBands(ctx);

    /* ---- immediate-mode detail passes ---- */
    for (i = 0; i < solids.length; i++) {
      var beh = solids[i].behavior;
      if (beh && typeof beh.post === 'function') beh.post(solids[i], this, scene);
    }

    /* ---- overlays: light pools, glows, HUD-ish feedback ---- */
    if (this.overlays.length) {
      ctx.save();
      for (i = 0; i < this.overlays.length; i++) this.overlays[i](ctx, this);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    this.debug.faces = this._faceCount;
    this.debug.hidden = hiddenSeen;
    this.debug.solidCount = solids.length;
    this.debug.ms = (root.performance || Date).now() - t0;
    return solids;
  };

  Renderer.prototype._path = function (ctx, off, cnt) {
    var p = this._vbufRef;
    ctx.beginPath();
    ctx.moveTo(p[off], p[off + 1]);
    for (var i = 1; i < cnt; i++) ctx.lineTo(p[off + i * 3], p[off + i * 3 + 1]);
    ctx.closePath();
  };

  Renderer.prototype._strokeFace = function (ctx, rec, kind) {
    var face = rec.f;
    var m = this.resolveMat(kind === 'hidden' ? 'hidden' : (kind === 'sil' ? face.m : (face.em ? face.em : face.m)), this._matA);
    var pv = this._vbufRef;
    ctx.strokeStyle = rgba(m.stroke, 1);
    ctx.globalAlpha = m.so;
    ctx.lineWidth = Math.max(0.35, (m.w * this.focal) / rec.depth);
    ctx.setLineDash(m.dash || []);
    ctx.beginPath();
    var cnt2 = rec.cnt;
    for (var j = 0; j < cnt2; j++) {
      var a2 = rec.off + j * 3, b2 = rec.off + ((j + 1) % cnt2) * 3;
      ctx.moveTo(pv[a2], pv[a2 + 1]);
      ctx.lineTo(pv[b2], pv[b2 + 1]);
    }
    ctx.stroke();
    if (m.dash) ctx.setLineDash([]);
  };

  /* ------------------------- batched line painting ------------------------ */
  /* Strokes are pooled per (material, depth band) and emitted as a handful of
     paths instead of tens of thousands of one-segment strokes. Depth bands are
     narrow (BANDS over the visible range) so the far-to-near result is
     indistinguishable from a strict per-line sort. */
  var BANDS = 26;
  var BAND_NEAR = 40;
  var BAND_FAR = 1600;

  Renderer.prototype._beginBands = function () {
    if (!this._bands) this._bands = new Map();
    else this._bands.clear();
    this._bandMin = Infinity;
    this._bandMax = 0;
  };

  Renderer.prototype._bandKey = function (depth) {
    if (depth < this._bandMin) this._bandMin = depth;
    if (depth > this._bandMax) this._bandMax = depth;
    var t = (Math.log(Math.max(BAND_NEAR, depth)) - Math.log(BAND_NEAR)) /
      (Math.log(BAND_FAR) - Math.log(BAND_NEAR));
    var b = Math.max(0, Math.min(BANDS - 1, Math.floor(t * BANDS)));
    return b;
  };

  Renderer.prototype._pushSeg = function (depth, style, alpha, width, x0, y0, x1, y1) {
    var b = this._bandKey(depth);
    var key = b + '|' + style + '|' + alpha.toFixed(2) + '|' + width.toFixed(2);
    var entry = this._bands.get(key);
    if (!entry) {
      entry = { band: b, style: style, alpha: alpha, width: width, pts: [] };
      this._bands.set(key, entry);
    }
    entry.pts.push(x0, y0, x1, y1);
  };

  Renderer.prototype._bandFace = function (ctx, rec, kind) {
    var face = rec.f;
    var m = this.resolveMat(kind === 'hidden' ? 'hidden' : (kind === 'sil' ? face.m : (face.em ? face.em : face.m)), this._matA);
    var style = rgba(m.stroke, 1);
    var p = this._vbufRef;
    var cnt = rec.cnt;
    for (var i = 0; i < cnt; i++) {
      var a = rec.off + i * 3, b = rec.off + ((i + 1) % cnt) * 3;
      var d = (p[a + 2] + p[b + 2]) / 2;
      this._pushSeg(d, style, m.so, Math.max(0.4, (m.w * this.focal) / Math.max(30, d)),
        p[a], p[a + 1], p[b], p[b + 1]);
    }
  };

  /* Walk the registered edges, classify each one against the faces that share
     its vertices (crease / silhouette / construction), and push the visible
     ones into the same bands as the face outlines. */
  Renderer.prototype._collectEdges = function (solids) {
    var mat = this._matA;
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      var edges = s.mesh.edges;
      if (!edges || !edges.length || !s.cv) continue;
      var map = s._edgeMap;
      var cv = s.cv;
      var near = this.near;
      for (var e = 0; e < edges.length; e++) {
        var ed = edges[e];
        if (ed.m === null || ed.m === false) continue;
        var kind = ed.k;
        if (kind === undefined || kind === 'hidden') continue;
        var za = cv[ed.a * 3 + 2], zb = cv[ed.b * 3 + 2];
        if (za > -near || zb > -near) continue;
        var d = -(za + zb) / 2;
        var spec = ed.m;
        this.resolveMat(typeof spec === 'string' ? spec : 'fine', mat);
        var w = mat.w;
        var so = mat.so;
        if (kind === 'sil') { w = Math.max(w, 2.3); so = 1; }
        else { w = Math.min(w, 1.35); }
        var z0 = -za, z1 = -zb;
        var x0 = this._cx + (this.focal * cv[ed.a * 3]) / z0;
        var y0 = this._cy - (this.focal * cv[ed.a * 3 + 1]) / z0;
        var x1 = this._cx + (this.focal * cv[ed.b * 3]) / z1;
        var y1 = this._cy - (this.focal * cv[ed.b * 3 + 1]) / z1;
        this._pushSeg(d, rgba(mat.stroke, 1), so, Math.max(0.4, (w * this.focal) / Math.max(30, d)),
          x0, y0, x1, y1);
      }
    }
  };

  Renderer.prototype._flushBands = function (ctx) {
    var arr = [];
    for (var entry of this._bands.values()) arr.push(entry);
    // far bands first so nearer paper and lines stay on top
    arr.sort(function (a, b) { return b.band - a.band; });
    ctx.lineCap = 'round';
    for (var i = 0; i < arr.length; i++) {
      var g = arr[i];
      ctx.strokeStyle = g.style;
      ctx.globalAlpha = g.alpha;
      ctx.lineWidth = g.width;
      ctx.setLineDash([]);
      ctx.beginPath();
      var pts = g.pts;
      for (var k = 0; k < pts.length; k += 4) {
        ctx.moveTo(pts[k], pts[k + 1]);
        ctx.lineTo(pts[k + 2], pts[k + 3]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  /* --------------------- transform / project / classify ------------------- */
  Renderer.prototype._classify = function (scene, view) {
    var list = [];
    scene.root.walk(function (node) {
      /* A node is drawable when it actually owns geometry. Parent containers
         that only carry a transform (a sofa root, a sideboard mount) are
         skipped so they never take a seat in the draw queue. */
      if (node.mesh && node.mesh.verts.length && node.faces.length && node.visible) list.push(node);
    });
    var eye = this._eye;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      // world vertices (cached until the node is touched)
      if (!s.wv || s._wvLen !== s.mesh.verts.length) {
        s.wv = new Float64Array(s.mesh.verts.length);
        s._wvLen = s.mesh.verts.length;
        s._dirty = true;
      }
      var lv = s.mesh.verts, wv = s.wv;
      if (s._dirty || !s._worldValid) {
        var wm = s.world;
        for (var j = 0; j < lv.length; j += 3) {
          var x = lv[j], y = lv[j + 1], z = lv[j + 2];
          wv[j] = wm[0] * x + wm[4] * y + wm[8] * z + wm[12];
          wv[j + 1] = wm[1] * x + wm[5] * y + wm[9] * z + wm[13];
          wv[j + 2] = wm[2] * x + wm[6] * y + wm[10] * z + wm[14];
        }
        s._dirty = false;
        s._worldValid = true;
        s._worldDirty = true;
      }
      var nv = wv.length / 3;
      if (!s.cv || s.cv.length < nv * 3) s.cv = new Float64Array(nv * 3);
      var cv = s.cv;
      for (j = 0; j < nv * 3; j += 3) {
        var px = wv[j], py = wv[j + 1], pz = wv[j + 2];
        cv[j] = view[0] * px + view[4] * py + view[8] * pz + view[12];
        cv[j + 1] = view[1] * px + view[5] * py + view[9] * pz + view[13];
        cv[j + 2] = view[2] * px + view[6] * py + view[10] * pz + view[14];
      }
      /* Draw order key. The painter's algorithm needs one representative depth
         per solid, and a solid's own origin is a bad one whenever the origin
         sits far from the geometry it carries — a door hinged at the room's
         left wall, a sofa anchored at the wall it backs onto, a group whose
         children are placed in world coordinates. Use the centroid of the
         camera-space mesh instead: always inside the object, always stable.
         `keyOverride` still wins, which is how the room shell forces itself to
         the back of the queue. */
      if (s.keyOverride !== undefined) {
        s._drawKey = s.keyOverride;
      } else {
        var nvc = cv.length / 3;
        if (!s._centroid || s._centroidN !== nvc || s._worldDirty) {
          s._centroidN = nvc;
          s._worldDirty = false;
          var ax = 0, ay = 0, az = 0;
          for (var ci = 0; ci < nvc; ci++) {
            ax += cv[ci * 3]; ay += cv[ci * 3 + 1]; az += cv[ci * 3 + 2];
          }
          s._centroid = [ax / nvc, ay / nvc, az / nvc];
        }
        s._drawKey = -s._centroid[2] + (s.layer || 0);
      }
    }
    list.sort(function (a, b) { return b._drawKey - a._drawKey; });

    var p = this._vbuf;
    var cx = this._cx, cy = this._cy, focal = this.focal, near = this.near;
    var faceCount = 0;
    var scratch = this._clip || (this._clip = []);

    for (i = 0; i < list.length; i++) {
      s = list[i];
      var faces = s.faces;
      if (!s._front) { s._front = []; s._back = []; }
      var front = s._front, back = s._back;
      front.length = 0; back.length = 0;
      var cvv = s.cv;
      var nv = cvv.length / 3;
      /* per-vertex facing flags, used to classify authored edges:
         a vertex on a front face is crisp, a vertex shared by a front and a
         back face is on the silhouette. */
      if (!s._vFront || s._vFront.length < nv) {
        s._vFront = new Uint8Array(nv);
        s._vSil = new Uint8Array(nv);
        s._vBack = new Uint8Array(nv);
      } else {
        s._vFront.fill(0);
        s._vSil.fill(0);
        s._vBack.fill(0);
      }
      var vFront = s._vFront, vSil = s._vSil, vBack = s._vBack;

      /* Prepare edge classification: every registered edge starts neutral, and
         each face marks up the edges of its own ring. An edge touched by a
         front face and a back face is a silhouette; two front faces make an
         interior crease; only back faces leave it as construction line. */
      var edgeMap = s._edgeMap;
      var edges = s.mesh.edges;
      if (edges && edges.length) {
        if (!edgeMap || edgeMap.size !== edges.length) edgeMap = s._edgeMap = new Map();
        else edgeMap.clear();
        for (var ei = 0; ei < edges.length; ei++) {
          var eo = edges[ei];
          eo.k = 'hidden';
          edgeMap.set(eo.a < eo.b ? (eo.a + ':' + eo.b) : (eo.b + ':' + eo.a), eo);
        }
      } else {
        edgeMap = null;
      }

      for (var f = 0; f < faces.length; f++) {
        var face = faces[f];
        var idx = face.i;
        var cnt = idx.length;
        if (cnt < 3) continue;
        var v0 = idx[0] * 3, v1 = idx[1] * 3, v2 = idx[2] * 3;
        var ux = cvv[v1] - cvv[v0], uy = cvv[v1 + 1] - cvv[v0 + 1], uz = cvv[v1 + 2] - cvv[v0 + 2];
        var wx = cvv[v2] - cvv[v0], wy = cvv[v2 + 1] - cvv[v0 + 1], wz = cvv[v2 + 2] - cvv[v0 + 2];
        var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nl < 1e-9) continue;
        var dist = -(nx * cvv[v0] + ny * cvv[v0 + 1] + nz * cvv[v0 + 2]) / nl;
        var isFront = dist > 0;

        // clip against the near plane, then project
        var cn = clipNear(cvv, idx, near, scratch);
        var m = cn.length;
        if (m < 3) continue;
        if (this._vcount + m * 3 > p.length) {
          this._vbuf = p = growBuf(p, this._vcount + m * 3);
        }
        var off = this._vcount;
        var minD = Infinity, maxD = 0, sumD = 0;
        for (var q = 0; q < m; q++) {
          var sp = cn[q];
          var d = sp[2];
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
          sumD += d;
          p[off + q * 3] = cx + (focal * sp[0]) / d;
          p[off + q * 3 + 1] = cy - (focal * sp[1]) / d;
          p[off + q * 3 + 2] = d;
        }
        this._vcount = off + m * 3;
        /* Stroke weight is divided by this depth. Averaging over the projected
           vertices keeps perspective honest: a wall receding away from the
           camera must not inherit the thickness of its nearest corner. */
        var meanD = sumD / m;
        var rec = { f: face, off: off, cnt: m, minD: minD, maxD: maxD, depth: meanD, solid: s, ring: null };
        if (isFront) front.push(rec); else back.push(rec);
        if (isFront) {
          for (var vi2 = 0; vi2 < cnt; vi2++) vFront[idx[vi2]] = 1;
        } else {
          for (var vi3 = 0; vi3 < cnt; vi3++) vBack[idx[vi3]] = 1;
        }
        // classify this face's ring edges: crease when only front faces touch
        // it, silhouette as soon as a face turned away also touches it
        if (edgeMap) {
          for (var ek = 0; ek < cnt; ek++) {
            var va = idx[ek], vb = idx[(ek + 1) % cnt];
            var eo2 = edgeMap.get(va < vb ? (va + ':' + vb) : (vb + ':' + va));
            if (!eo2) continue;
            if (isFront) {
              if (eo2.k === 'hidden') eo2.k = 'crease';
            } else if (eo2.k !== 'hidden') {
              eo2.k = 'sil';
            }
          }
        }
        faceCount++;
      }
      for (var vk = 0; vk < nv; vk++) {
        if (vFront[vk] && vBack[vk]) vSil[vk] = 1;
      }
      front.sort(function (a, b) { return b.minD - a.minD; });
      back.sort(function (a, b) { return b.minD - a.minD; });
    }
    this._faceCount = faceCount;
    this._vbuf = p;
    this._vbufRef = p;
    this._solids = list;
    return list;
  };

  /* Sutherland-Hodgman clip against the camera-space near plane (z = -near).
     `pts` is the polygon as a list of index numbers into the camera-space
     vertex array; returns camera-space points, each tagged with its depth.
     Anything crossing the plane is cut, so surfaces that reach past the camera
     still project correctly instead of disappearing. */
  function clipNear(cv, ids, near, out) {
    out.length = 0;
    var n = ids.length;
    var plane = -near;
    for (var i = 0; i < n; i++) {
      var cur = ids[i] * 3;
      var nxt = ids[(i + 1) % n] * 3;
      var az = cv[cur + 2], bz = cv[nxt + 2];
      var aIn = az <= plane, bIn = bz <= plane;
      if (aIn) out.push(cv[cur], cv[cur + 1], -az);
      if (aIn !== bIn) {
        var t = (plane - az) / (bz - az);
        out.push(
          cv[cur] + (cv[nxt] - cv[cur]) * t,
          cv[cur + 1] + (cv[nxt + 1] - cv[cur + 1]) * t,
          near
        );
      }
    }
    // regroup into [x, y, depth] triples
    var m = out.length / 3;
    var poly = new Array(m);
    for (var k = 0; k < m; k++) poly[k] = [out[k * 3], out[k * 3 + 1], out[k * 3 + 2]];
    return poly;
  }

  function growBuf(arr, need) {
    var n = arr.length;
    while (n < need) n *= 2;
    var out = new Float64Array(n);
    out.set(arr);
    return out;
  }

  /* ------------------------------- picking ------------------------------- */
  Renderer.prototype.projectPoint = function (p, out) {
    var view = this._view;
    var x = p[0], y = p[1], z = p[2];
    var a = view[0] * x + view[4] * y + view[8] * z + view[12];
    var b = view[1] * x + view[5] * y + view[9] * z + view[13];
    var c = view[2] * x + view[6] * y + view[10] * z + view[14];
    var d = -c;
    out[0] = this._cx + (this.focal * a) / d;
    out[1] = this._cy - (this.focal * b) / d;
    out[2] = d;
    return out;
  };

  /* Front-to-back test against every registered hit region. Regions are
     appended in back-to-front solid order, so scanning backwards finds the
     nearest one first. */
  Renderer.prototype.pick = function (x, y) {
    var p = this._vbufRef;
    for (var i = this._hits.length - 1; i >= 0; i--) {
      var h = this._hits[i];
      var off = h.off, cnt = h.cnt;
      var inside = false;
      for (var a = 0, b = cnt - 1; a < cnt; b = a++) {
        var xa = p[off + a * 3], ya = p[off + a * 3 + 1];
        var xb = p[off + b * 3], yb = p[off + b * 3 + 1];
        if (((ya > y) !== (yb > y)) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
      }
      if (inside) return h;
    }
    return null;
  };

  /* Register every face of `node` that was tagged as a hit face. */
  Renderer.prototype.hitRegion = function (node, tag) {
    var s = null, list = this._solids;
    for (var i = 0; i < list.length; i++) if (list[i] === node) { s = list[i]; break; }
    if (!s) return;
    for (var k = 0; k < s._front.length; k++) {
      var rec = s._front[k];
      if (tag === undefined || rec.f.hit === tag) {
        this._hits.push({ node: node, off: rec.off, cnt: rec.cnt, depth: rec.minD, face: rec.f });
      }
    }
  };

  /* --------------------------- world-space overlays ---------------------- */
  /* Objects call this from post() to draw immediate-mode detail in world
     space. The API receives a depth aware canvas wrapper. */
  Renderer.prototype.overlay = function (fn) {
    var self = this;
    this.overlays.push(function (ctx, r) {
      var tmp = [0, 0, 0], tmp2 = [0, 0, 0];
      var api = {
        ctx: ctx,
        renderer: r,
        project: function (pt) { r.projectPoint(pt, tmp); return [tmp[0], tmp[1], tmp[2]]; },
        visible: function (pt) { r.projectPoint(pt, tmp); return tmp[2] > r.near; },
        /* stroke a segment between two world points */
        seg: function (a, b, opt) {
          opt = opt || {};
          if (!r.projectPoint(a, tmp)) return;
          var ax = tmp[0], ay = tmp[1], ad = tmp[2];
          r.projectPoint(b, tmp2);
          var bx = tmp2[0], by = tmp2[1], bd = tmp2[2];
          if (ad < r.near || bd < r.near) return;
          ctx.strokeStyle = opt.color || r.palette.ink || '#20202a';
          ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
          ctx.lineWidth = Math.max(0.35, ((opt.width === undefined ? 1 : opt.width) * r.focal) / Math.max(50, (ad + bd) / 2));
          ctx.setLineDash(opt.dash || []);
          if (opt.cap) ctx.lineCap = opt.cap;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          if (opt.dash) ctx.setLineDash([]);
        },
        poly: function (pts, opt) {
          opt = opt || {};
          ctx.beginPath();
          for (var i = 0; i < pts.length; i++) {
            r.projectPoint(pts[i], tmp);
            if (tmp[2] < r.near) return;
            if (i === 0) ctx.moveTo(tmp[0], tmp[1]); else ctx.lineTo(tmp[0], tmp[1]);
          }
          ctx.closePath();
          if (opt.fill) {
            ctx.globalAlpha = opt.fillAlpha === undefined ? 1 : opt.fillAlpha;
            ctx.fillStyle = opt.fill;
            ctx.fill();
          }
          if (opt.stroke) {
            ctx.globalAlpha = opt.strokeAlpha === undefined ? 1 : opt.strokeAlpha;
            ctx.strokeStyle = opt.stroke;
            ctx.lineWidth = opt.width || 1;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        },
        circle: function (pt, rWorld, opt) {
          opt = opt || {};
          var seg = opt.segments || 28;
          var pts = [], i, a;
          var axis = opt.axis || 'z';
          for (i = 0; i < seg; i++) {
            a = (i / seg) * Math.PI * 2;
            var ca = Math.cos(a) * rWorld, sa = Math.sin(a) * rWorld;
            if (axis === 'z') pts.push([pt[0] + ca, pt[1] + sa, pt[2]]);
            else if (axis === 'y') pts.push([pt[0] + ca, pt[1], pt[2] + sa]);
            else pts.push([pt[0], pt[1] + ca, pt[2] + sa]);
          }
          this.poly(pts, opt);
        },
        text: function (pt, str, opt) {
          opt = opt || {};
          r.projectPoint(pt, tmp);
          if (tmp[2] < r.near) return;
          ctx.save();
          ctx.translate(tmp[0], tmp[1]);
          if (opt.rotate) ctx.rotate(opt.rotate);
          ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
          ctx.fillStyle = opt.color || r.palette.ink || '#20202a';
          ctx.font = opt.font || (Math.round(13 * r._fontScale) + 'px "Segoe UI", system-ui, sans-serif');
          ctx.textAlign = opt.align || 'center';
          ctx.textBaseline = opt.baseline || 'middle';
          if (opt.tracking) {
            var chars = String(str).split('');
            var total = 0, i;
            for (i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width + opt.tracking;
            var start = opt.align === 'left' ? 0 : opt.align === 'right' ? -total : -total / 2;
            for (i = 0; i < chars.length; i++) {
              ctx.fillText(chars[i], start, 0);
              start += ctx.measureText(chars[i]).width + opt.tracking;
            }
          } else {
            ctx.fillText(String(str), 0, 0);
          }
          ctx.restore();
        },
        rect: function (x0, y0, x1, y1, opt) {
          this.poly([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]].map(function (p) {
            return opt && opt.plane ? opt.plane(p[0], p[1]) : p;
          }), opt);
        },
      };
      fn(api, r);
    });
  };

  PLR.renderer = { Renderer: Renderer, hexToRgb: hexToRgb, rgba: rgba, mixRgb: mixRgb };
})(typeof window !== 'undefined' ? window : globalThis);
