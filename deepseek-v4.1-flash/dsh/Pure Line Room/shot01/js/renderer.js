/* =============================================================================
   Pure Line Room — renderer.js
   A hand-written software renderer: 3D polygon soup → perspective projection →
   depth-sorted painter's algorithm → Canvas 2D strokes and fills.

   The look comes from three decisions:
     1. every face is filled with a near-white, so the silhouette of the fill
        carries the form and the ink stays readable on top;
     2. every face carries explicit *edges* with their own weight, so we can
        draw furniture outlines, construction lines and faint contour hints at
        three clearly different weights;
     3. line weight scales with the distance to the eye, which is what makes a
        flat drawing read as a room instead of an illustration.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;

  var FOV = 40;
  var NEAR = 0.06;
  var FAR = 90;

  function Renderer(canvas, scene, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = scene;
    this.width = canvas.width;
    this.height = canvas.height;
    this.refDepth = 5.2;      // eye distance at which stroke weights are 1:1
    this.quality = 1;         // 1 = full, 0.5 = reduced (drops dot patterns)
    this.fov = (opts && opts.fov) || FOV;
    this.eye = [0, 0, 0];
    this.target = [0, 0, 0];
    this.viewM = M.mk();
    this.projM = M.mk();
    this.viewProj = M.mk();
    this.stats = { fills: 0, strokes: 0, faces: 0, ms: 0 };
    this._acc = 0;
    this.frame = 0;
    this._screenCache = {};   // world point key → screen point (per frame)
    this._faceBuf = [];
    this._dirty = -1;
    this._prep = [];
  }

  Renderer.prototype.resize = function (w, h) {
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
  };

  Renderer.prototype.setCamera = function (eye, target) {
    this.eye = eye;
    this.target = target;
    this.fov = this.fov || FOV;
    this.projM = M.perspective(this.fov, Math.max(0.2, this.width / this.height), NEAR, FAR);
    this.viewM = M.lookAt(eye, target, [0, 1, 0]);
    this.viewProj = M.mul(this.projM, this.viewM);

    // Explicit camera basis. Projection and unprojection both go through this,
    // so a screen point and the ray through it can never disagree — which
    // matters a great deal, because picking depends on them being inverses.
    var f = M.norm(M.sub(target, eye));
    var up = Math.abs(f[1]) > 0.995 ? [0, 0, -1] : [0, 1, 0];
    var rt = M.norm(M.cross(f, up));
    var cu = M.cross(rt, f);
    this.basis = { f: f, r: rt, u: cu };

    var vh = 2 * Math.tan((this.fov * Math.PI / 180) / 2);   // view height at 1 m
    var vw = vh * (this.width / this.height);
    this.tanY = vh / 2;
    this.tanX = vw / 2;
    this._tanY = vh / 2;
    this._tanX = vw / 2;
  };

  /** Ray through a canvas pixel, built from the camera basis (exact inverse). */
  Renderer.prototype.unproject = function (sx, sy) {
    if (!this.basis) return null;
    var ndcX = (sx / this.width) * 2 - 1;
    var ndcY = 1 - (sy / this.height) * 2;
    var b = this.basis;
    var dir = [
      b.f[0] + b.r[0] * ndcX * this.tanX + b.u[0] * ndcY * this.tanY,
      b.f[1] + b.r[1] * ndcX * this.tanX + b.u[1] * ndcY * this.tanY,
      b.f[2] + b.r[2] * ndcX * this.tanX + b.u[2] * ndcY * this.tanY
    ];
    return { origin: [this.eye[0], this.eye[1], this.eye[2]], dir: dir };
  };

  /** Project a world point to canvas pixels. Returns null when behind the eye. */
  Renderer.prototype.project = function (p) {
    var v = M.xformPoint(this.viewM, p);
    if (v[2] > -NEAR) return null;
    var d = -v[2];
    return [
      (v[0] / (d * this.tanX) * 0.5 + 0.5) * this.width,
      (0.5 - v[1] / (d * this.tanY) * 0.5) * this.height,
      d
    ];
  };

  Renderer.prototype.invertViewProj = function () {
    var m = this.viewProj, inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (!det) return M.mk();
    det = 1 / det;
    for (var i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  };

  /* --------------------------------------------------------------------------
     Per-frame preparation: world → eye, face normals, depth keys, culling.
     -------------------------------------------------------------------------- */
  Renderer.prototype.prepare = function (theme, only) {
    var list = this._prep;
    list.length = 0;
    var meshes = this.scene.meshes;
    var eye = this.eye;

    for (var mi = 0; mi < meshes.length; mi++) {
      if (only && only.indexOf(mi) < 0) continue;
      var mesh = meshes[mi];
      if (mesh.hidden) continue;
      var b = mesh.getBounds();
      if (!b) continue;
      // cheap bounding-sphere reject
      var cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      var rad = 0.5 * Math.sqrt(
        (b.max[0] - b.min[0]) * (b.max[0] - b.min[0]) +
        (b.max[1] - b.min[1]) * (b.max[1] - b.min[1]) +
        (b.max[2] - b.min[2]) * (b.max[2] - b.min[2]));
      var dx = cx - eye[0], dy = cy - eye[1], dz = cz - eye[2];
      var distEye = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distEye - rad > FAR) continue;
      var inside = distEye < rad;

      var n = mesh.verts.length;
      var eyePts = new Array(n);
      var sx = new Array(n), sy = new Array(n), sd = new Array(n), ok = new Array(n);
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < n; i++) {
        var v = M.xformPoint(this.viewM, mesh.verts[i]);
        eyePts[i] = v;
        var d = -v[2];
        sd[i] = d;
        if (d > NEAR) {
          var k = this.projM[5] / d;
          var px = (v[0] * (this.projM[0] / 1) / d) * 0.5 * this.width + this.width * 0.5;
          var py = (0.5 - (v[1] * k) * 0.5) * this.height;
          sx[i] = px; sy[i] = py; ok[i] = true;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        } else { ok[i] = false; }
      }
      if (maxX < -40 || minX > this.width + 40 || maxY < -40 || minY > this.height + 40) continue;

      list.push({
        mesh: mesh, eyePts: eyePts, sx: sx, sy: sy, sd: sd, ok: ok,
        rev: mesh.rev, inside: inside, dist: distEye,
        minX: minX, maxX: maxX, minY: minY, maxY: maxY
      });
    }
    return list;
  };

  /* --------------------------------------------------------------------------
     Clipping
     -------------------------------------------------------------------------- */
  function clipPoly(pts, depth) {
    // Sutherland–Hodgman against d >= NEAR
    var out = [];
    var n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var da = depth(a), db = depth(b);
      var ina = da >= NEAR, inb = db >= NEAR;
      if (ina) out.push(a);
      if (ina !== inb) {
        var t = (NEAR - da) / (db - da);
        out.push([
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t
        ]);
      }
    }
    return out;
  }

  Renderer.prototype.toScreen = function (p) {
    // kept for the 2D overlay layers: same maths as project(), no depth test
    var v = M.xformPoint(this.viewM, p);
    var d = -v[2];
    if (d <= 1e-6) return [0, 0];
    return [
      (v[0] / (d * this.tanX) * 0.5 + 0.5) * this.width,
      (0.5 - v[1] / (d * this.tanY) * 0.5) * this.height
    ];
  };

  /* --------------------------------------------------------------------------
     The draw
     -------------------------------------------------------------------------- */
  Renderer.prototype.draw = function (theme, opts) {
    var t0 = (global.performance || Date).now();
    opts = opts || {};
    var ctx = this.ctx;
    var self = this;
    var W = this.width, H = this.height;

    this.frame++;
    // NOTE: the canvas is NOT cleared here — main.js clears once and then
    // composites the view through the window underneath this 3D pass, so
    // clearing would wipe the sky out from behind the window frame.
    if (opts.paintBackground !== false) {
      ctx.fillStyle = theme.mat.paper;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Meshes are grouped into paint layers. Everything defaults to layer 0; the
    // room shell is layer -1, which lets main.js slip the view through the
    // window in between the shell and the window frame — without an actual hole
    // cut in the wall, and without a per-pixel depth buffer.
    var layers = {};
    var i;
    for (i = 0; i < this.scene.meshes.length; i++) {
      var L = this.scene.meshes[i].layer || 0;
      (layers[L] = layers[L] || []).push(i);
    }
    var keys = Object.keys(layers).map(Number).sort(function (a, b) { return a - b; });
    var total = { fills: 0, strokes: 0, faces: 0 };

    for (var ki = 0; ki < keys.length; ki++) {
      if (opts.betweenLayers && ki > 0) opts.betweenLayers(keys[ki - 1], keys[ki]);
      var r = this.drawLayer(theme, layers[keys[ki]]);
      total.fills += r.fills; total.strokes += r.strokes; total.faces += r.faces;
    }
    if (opts.betweenLayers) opts.betweenLayers(keys[keys.length - 1], Infinity);

    this.stats.faces = total.faces;
    this.stats.fills = total.fills;
    this.stats.strokes = total.strokes;
    this.stats.ms = (global.performance || Date).now() - t0;
    this._acc = this._acc * 0.9 + this.stats.ms * 0.1;
    return total.faces;
  };

  Renderer.prototype.drawLayer = function (theme, meshIndices) {

    var self = this;
    var ctx = this.ctx;
    var W = this.width, H = this.height;
    var preps = this.prepare(theme, meshIndices);
    var bufs = this._faceBuf;
    var count = 0;

    for (var pi = 0; pi < preps.length; pi++) {
      var P0 = preps[pi];
      var mesh = P0.mesh;
      var faces = mesh.faces;
      for (var fi = 0; fi < faces.length; fi++) {
        var f = faces[fi];
        if (f.hidden) continue;
        var vi = f.vi;
        var nv = vi.length;

        // depth key + visibility
        var zsum = 0, zmin = Infinity, zmax = -Infinity, bad = false;
        for (var k = 0; k < nv; k++) {
          var z = P0.sd[vi[k]];
          if (z !== z) { bad = true; break; }
          zsum += z;
          if (z < zmin) zmin = z;
          if (z > zmax) zmax = z;
        }
        if (bad) continue;
        if (zmax < NEAR) continue;             // fully behind the eye
        var zavg = zsum / nv;
        if (nv < 3) continue;

        // back-face culling (only for faces that opted in)
        if (f.cull && !P0.inside) {
          var a = P0.eyePts[vi[0]], b2 = P0.eyePts[vi[1]], c2 = P0.eyePts[vi[2]];
          var ux = b2[0] - a[0], uy = b2[1] - a[1], uz = b2[2] - a[2];
          var vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          // the eye sits at the origin of eye space; a front-facing polygon has
          // its normal pointing back toward the viewer (negative dot with a)
          if (nx * a[0] + ny * a[1] + nz * a[2] > 0) continue;
        }

        var buf = bufs[count];
        if (!buf) { buf = bufs[count] = { m: null, f: null, z: 0, depth: 0, nv: 0, key: 0 }; }
        buf.m = mesh; buf.f = f; buf.z = zavg; buf.depth = zmin;
        buf.nv = nv; buf.key = zavg * 0.72 + zmin * 0.28;
        count++;
      }
    }

    var drawn = bufs.slice(0, count);
    drawn.sort(function (a, b) { return b.key - a.key; });

    var fills = 0, strokes = 0;
    this._screenCache = {};
    var screenCache = this._screenCache;

    for (var di = 0; di < drawn.length; di++) {
      var it = drawn[di];
      var face = it.f, pm = it.m, P1 = null;
      // re-find the prep entry (faces from the same mesh are usually adjacent
      // after sorting by depth, so a tiny cache keeps this cheap)
      if (this._lastPrepMesh !== pm) {
        for (var q = 0; q < preps.length; q++) { if (preps[q].mesh === pm) { P1 = preps[q]; break; } }
        this._lastPrepMesh = pm; this._lastPrep = P1;
      } else P1 = this._lastPrep;
      if (!P1) continue;

      var wvi = face.vi;
      var world = new Array(wvi.length);
      for (var w = 0; w < wvi.length; w++) world[w] = P1.eyePts[wvi[w]];

      var clipped;
      if (wvi.length === 3 && P1.sd[wvi[0]] >= NEAR && P1.sd[wvi[1]] >= NEAR && P1.sd[wvi[2]] >= NEAR) {
        clipped = world;
      } else {
        clipped = clipPoly(world, function (p) { return -p[2]; });
      }
      if (clipped.length < 3) continue;

      // project
      var scr = new Array(clipped.length);
      var depthSum = 0, minSX = Infinity, maxSX = -Infinity, minSY = Infinity, maxSY = -Infinity;
      for (var s = 0; s < clipped.length; s++) {
        var pt = clipped[s];
        var d = -pt[2];
        depthSum += d;
        var sp = self.toScreen(pt);
        scr[s] = sp;
        if (sp[0] < minSX) minSX = sp[0]; if (sp[0] > maxSX) maxSX = sp[0];
        if (sp[1] < minSY) minSY = sp[1]; if (sp[1] > maxSY) maxSY = sp[1];
      }
      if (maxSX < -8 || minSX > W + 8 || maxSY < -8 || minSY > H + 8) continue;
      var zdepth = depthSum / clipped.length;
      var wscale = M.clamp(self.refDepth / Math.max(0.35, zdepth), 0.34, 2.5);

      // ---- fill  (material keys are resolved against the live theme, which is
      // how the whole room re-inks itself when the environment changes)
      var fill = face.fill;
      if (mesh.debugTint) fill = mesh.debugTint;
      else if (fill && fill.charCodeAt && fill.charCodeAt(0) === 64) {
        fill = theme.mat[fill.slice(1)] || theme.mat.paper;
      }
      if (fill && face.shade) fill = P.geom.tone(fill, face.shade, theme.ink);
      if (fill && clipped.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(scr[0][0], scr[0][1]);
        for (var m2 = 1; m2 < scr.length; m2++) ctx.lineTo(scr[m2][0], scr[m2][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        fills++;
        if (face.dot && self.quality >= 1) {
          self.dotPattern(ctx, minSX, minSY, maxSX, maxSY, face.dot, theme);
        }
        if (face.hatch && self.quality >= 1) {
          self.hatchPattern(ctx, scr, face.hatch, theme);
        }
      }

      // ---- strokes
      if (face.kind) {
        var kind = face.kind;
        var wgt = P.geom.KIND_W[kind] || 1;
        var alpha = P.geom.KIND_INK[kind];
        if (alpha === undefined) alpha = 1;
        ctx.lineWidth = M.clamp(wgt * wscale, 0.4, 6.2);
        ctx.strokeStyle = face.glow > 0
          ? theme.glow
          : self.inkWithAlpha(theme.line, alpha);
        ctx.globalAlpha = face.glow > 0 ? M.clamp(face.glow, 0, 1) : 1;
        if (clipped.length === 2) {
          ctx.beginPath();
          ctx.moveTo(scr[0][0], scr[0][1]);
          ctx.lineTo(scr[1][0], scr[1][1]);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(scr[0][0], scr[0][1]);
          for (var m3 = 1; m3 < scr.length; m3++) ctx.lineTo(scr[m3][0], scr[m3][1]);
          if (face.fill) ctx.closePath();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        strokes++;
      }
    }

    this._lastPrepMesh = null;
    return { faces: drawn.length, fills: fills, strokes: strokes };
  };

  Renderer.prototype.inkWithAlpha = function (hex, alpha) {
    if (alpha >= 0.999) return hex;
    var c = P.geom.hexToRgb(hex);
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + alpha.toFixed(3) + ')';
  };

  /** Screen-space hatching inside an already-projected polygon. */
  Renderer.prototype.hatchPattern = function (ctx, scr, spec, theme) {
    var angle = (spec.angle || 45) * Math.PI / 180;
    var gap = spec.gap || 9;
    var maxLines = spec.max || 26;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < scr.length; i++) {
      if (scr[i][0] < x0) x0 = scr[i][0];
      if (scr[i][0] > x1) x1 = scr[i][0];
      if (scr[i][1] < y0) y0 = scr[i][1];
      if (scr[i][1] > y1) y1 = scr[i][1];
    }
    var w = x1 - x0, h = y1 - y0;
    if (w <= 1 || h <= 1 || w > 900 || h > 900) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(scr[0][0], scr[0][1]);
    for (var s = 1; s < scr.length; s++) ctx.lineTo(scr[s][0], scr[s][1]);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = this.inkWithAlpha(theme.line, spec.alpha === undefined ? 0.16 : spec.alpha);
    ctx.lineWidth = spec.width || 0.7;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var span = Math.sqrt(w * w + h * h);
    var dx = Math.cos(angle), dy = Math.sin(angle);
    var px = -dy, py = dx;
    var n = Math.min(maxLines, Math.ceil(span / gap) + 1);
    ctx.beginPath();
    for (var k = -n; k <= n; k++) {
      var ox = cx + px * k * gap, oy = cy + py * k * gap;
      ctx.moveTo(ox - dx * span, oy - dy * span);
      ctx.lineTo(ox + dx * span, oy + dy * span);
    }
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.dotPattern = function (ctx, x0, y0, x1, y1, density, theme) {
    var step = density > 1 ? 7 : 11;
    var w = Math.min(x1 - x0, 420), h = Math.min(y1 - y0, 420);
    if (w <= 0 || h <= 0) return;
    var x = Math.ceil(x0 / step) * step, y = Math.ceil(y0 / step) * step;
    var n = 0;
    ctx.fillStyle = this.inkWithAlpha(theme.line, 0.22);
    for (; y < y0 + h; y += step) {
      for (var xx = x; xx < x0 + w; xx += step) {
        if (((xx / step) | 0) % 2 === ((y / step) | 0) % 2) continue;
        ctx.fillRect(xx, y, 1, 1);
        if (++n > 320) return;
      }
    }
  };

  /** Draw a screen-space path (used by the 2D overlay layers). */
  Renderer.prototype.screenPath = function (ctx, pts, close) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  };

  P.Renderer = Renderer;
  P.RENDER_CONST = { FOV: FOV, NEAR: NEAR, FAR: FAR };
})(typeof window !== 'undefined' ? window : globalThis);
