/* =============================================================================
   Pure Line Room — math3d.js
   Minimal, dependency-free 3D math for a hand-written software renderer.
   Everything is plain arrays so it stays allocation-light and easy to reason
   about. Convention: right-handed, +X right, +Y up, -Z "into the screen".
   ========================================================================== */
(function (global) {
  'use strict';

  var EPS = 1e-9;

  function mk() {
    // identity, column-major-ish but stored row-major: m[r*4+c]
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function perspective(fovYdeg, aspect, near, far) {
    var f = 1 / Math.tan((fovYdeg * Math.PI / 180) / 2);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, 2 * far * near * nf,
      0, 0, -1, 0
    ];
  }

  function mul(a, b) {
    var o = new Array(16);
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        o[r * 4 + c] =
          a[r * 4 + 0] * b[0 * 4 + c] +
          a[r * 4 + 1] * b[1 * 4 + c] +
          a[r * 4 + 2] * b[2 * 4 + c] +
          a[r * 4 + 3] * b[3 * 4 + c];
      }
    }
    return o;
  }

  // Build a view matrix looking from eye toward target with +Y up.
  function lookAt(eye, target, up) {
    var zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    var zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;

    up = up || [0, 1, 0];
    var xx = up[1] * zz - up[2] * zy;
    var xy = up[2] * zx - up[0] * zz;
    var xz = up[0] * zy - up[1] * zx;
    var xl = Math.sqrt(xx * xx + xy * xy + xz * xz);
    if (xl < EPS) { // looking straight up/down: pick another up vector
      xx = 1; xy = 0; xz = 0;
    } else { xx /= xl; xy /= xl; xz /= xl; }

    var yx = zy * xz - zz * xy;
    var yy = zz * xx - zx * xz;
    var yz = zx * xy - zy * xx;

    return [
      xx, xy, xz, -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      yx, yy, yz, -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      zx, zy, zz, -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      0, 0, 0, 1
    ];
  }

  function xformPoint(m, p, out) {
    var x = p[0], y = p[1], z = p[2];
    out = out || [0, 0, 0];
    out[0] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[1] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[2] = m[8] * x + m[9] * y + m[10] * z + m[11];
    return out;
  }

  function xformDir(m, p, out) {
    var x = p[0], y = p[1], z = p[2];
    out = out || [0, 0, 0];
    out[0] = m[0] * x + m[1] * y + m[2] * z;
    out[1] = m[4] * x + m[5] * y + m[6] * z;
    out[2] = m[8] * x + m[9] * y + m[10] * z;
    return out;
  }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function len(a) { return Math.sqrt(dot(a, a)); }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function norm(a) {
    var l = len(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  // Newell normal — robust for arbitrary (non-planar-ish) polygons.
  function polyNormal(pts, idx) {
    var nx = 0, ny = 0, nz = 0, n = idx.length;
    for (var i = 0; i < n; i++) {
      var a = pts[idx[i]], b = pts[idx[(i + 1) % n]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < EPS) return [0, 1, 0];
    return [nx / l, ny / l, nz / l];
  }

  function centroid(pts, idx) {
    var x = 0, y = 0, z = 0;
    for (var i = 0; i < idx.length; i++) {
      x += pts[idx[i]][0]; y += pts[idx[i]][1]; z += pts[idx[i]][2];
    }
    var n = idx.length || 1;
    return [x / n, y / n, z / n];
  }

  function dist(a, b) { return len(sub(a, b)); }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // Ray vs axis-aligned box. Returns t of entry (or -1). dir need not be normalized.
  function rayAABB(origin, dir, min, max) {
    var t0 = -Infinity, t1 = Infinity;
    for (var i = 0; i < 3; i++) {
      if (Math.abs(dir[i]) < EPS) {
        if (origin[i] < min[i] || origin[i] > max[i]) return -1;
      } else {
        var inv = 1 / dir[i];
        var ta = (min[i] - origin[i]) * inv;
        var tb = (max[i] - origin[i]) * inv;
        if (ta > tb) { var tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) return -1;
      }
    }
    return t0 >= 0 ? t0 : (t1 >= 0 ? 0 : -1);
  }

  // Ray vs sphere.
  function raySphere(origin, dir, center, radius) {
    var ox = origin[0] - center[0], oy = origin[1] - center[1], oz = origin[2] - center[2];
    var a = dot(dir, dir);
    var b = 2 * (ox * dir[0] + oy * dir[1] + oz * dir[2]);
    var c = ox * ox + oy * oy + oz * oz - radius * radius;
    var disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    var s = Math.sqrt(disc);
    var t0 = (-b - s) / (2 * a);
    var t1 = (-b + s) / (2 * a);
    return t0 >= 0 ? t0 : (t1 >= 0 ? t1 : -1);
  }

  // Ray vs floor plane y = level, returning parameter t (or -1).
  function rayPlaneY(origin, dir, level) {
    if (Math.abs(dir[1]) < EPS) return -1;
    var t = (level - origin[1]) / dir[1];
    return t >= 0 ? t : -1;
  }

  global.M3 = {
    EPS: EPS,
    mk: mk,
    mul: mul,
    perspective: perspective,
    lookAt: lookAt,
    xformPoint: xformPoint,
    xformDir: xformDir,
    sub: sub, add: add, scale: scale, dot: dot, cross: cross, len: len, norm: norm,
    polyNormal: polyNormal, centroid: centroid, dist: dist,
    lerp: lerp, clamp: clamp, smoothstep: smoothstep,
    rayAABB: rayAABB, raySphere: raySphere, rayPlaneY: rayPlaneY
  };
})(typeof window !== 'undefined' ? window : globalThis);
