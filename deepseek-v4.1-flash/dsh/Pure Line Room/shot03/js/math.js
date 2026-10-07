/* =========================================================================
   Pure Line Room — math.js
   Tiny 3D math library. Plain arrays, no allocation tricks, no dependencies.
   Coordinate system: Y is up, X is right, Z is toward the viewer.
   Camera space: looking down -Z (so a vertex in front of the camera has z < 0).
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  /* the object registry lives here so that object modules loaded before
     build.js can still register themselves */
  PLR.objects = PLR.objects || {};

  var EPS = 1e-6;

  /* ------------------------------- vectors ------------------------------- */
  var v3 = {
    make: function (x, y, z) { return [x || 0, y || 0, z || 0]; },
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    mulv: function (a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    len2: function (a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; },
    dist: function (a, b) {
      var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    norm: function (a) {
      var l = v3.len(a);
      return l < EPS ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: function (a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    },
    neg: function (a) { return [-a[0], -a[1], -a[2]]; },
    copy: function (a) { return [a[0], a[1], a[2]]; },
    clone: function (a) { return [a[0], a[1], a[2]]; },
  };

  /* ------------------------------ 4x4 matrix -----------------------------
     Column-major: m[col * 4 + row], exactly like WebGL, so that
     m * v  uses rows:  out[r] = m[0*4+r]*x + m[1*4+r]*y + m[2*4+r]*z + m[3*4+r]
     ---------------------------------------------------------------------- */
  var m4 = {
    identity: function () {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    },
    fromTranslation: function (p) {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
    },
    fromScale: function (s) {
      return [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1];
    },
    /* out = a * b  (apply b first, then a) */
    mul: function (a, b) {
      var out = new Array(16);
      for (var c = 0; c < 4; c++) {
        var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        out[c * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return out;
    },
    mulAll: function () {
      var out = m4.identity();
      for (var i = 0; i < arguments.length; i++) out = m4.mul(out, arguments[i]);
      return out;
    },
    translationOf: function (m) { return [m[12], m[13], m[14]]; },
    point: function (m, p) {
      var x = p[0], y = p[1], z = p[2];
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
    },
    /* direction: ignores translation */
    dir: function (m, p) {
      var x = p[0], y = p[1], z = p[2];
      return [
        m[0] * x + m[4] * y + m[8] * z,
        m[1] * x + m[5] * y + m[9] * z,
        m[2] * x + m[6] * y + m[10] * z,
      ];
    },
    /* Rigid + uniform-scale inverse, built from the column basis vectors.
       Returns null when the matrix is degenerate. */
    invert: function (m) {
      var a = [m[0], m[1], m[2]], b = [m[4], m[5], m[6]], c = [m[8], m[9], m[10]];
      var det = v3.dot(a, v3.cross(b, c));
      if (Math.abs(det) < 1e-12) return null;
      var inv = 1 / det;
      var r0 = v3.mul(v3.cross(b, c), inv);
      var r1 = v3.mul(v3.cross(c, a), inv);
      var r2 = v3.mul(v3.cross(a, b), inv);
      var t = [m[12], m[13], m[14]];
      return [
        r0[0], r1[0], r2[0], 0,
        r0[1], r1[1], r2[1], 0,
        r0[2], r1[2], r2[2], 0,
        -v3.dot(r0, t), -v3.dot(r1, t), -v3.dot(r2, t), 1,
      ];
    },
    /* Determinant of the upper-left 3x3 — used to detect mirrored transforms. */
    det3: function (m) {
      var a = [m[0], m[1], m[2]], b = [m[4], m[5], m[6]], c = [m[8], m[9], m[10]];
      return v3.dot(a, v3.cross(b, c));
    },
  };

  /* ------------------------------ transforms ----------------------------- */
  /* A transform is {p:[x,y,z], yaw, pitch, roll (radians), s:[sx,sy,sz]}. */
  function transformMatrix(tf) {
    var y = tf.yaw || 0, p = tf.pitch || 0, r = tf.roll || 0;
    var cy = Math.cos(y), sy = Math.sin(y);
    var cp = Math.cos(p), sp = Math.sin(p);
    var cr = Math.cos(r), sr = Math.sin(r);

    // R = Ry(yaw) * Rx(pitch) * Rz(roll)
    var m00 = cy * cr + sy * sp * sr, m01 = cp * sr, m02 = -sy * cr + cy * sp * sr;
    var m10 = -cy * sr + sy * sp * cr, m11 = cp * cr, m12 = sy * sr + cy * sp * cr;
    var m20 = sy * cp, m21 = -sp, m22 = cy * cp;

    var s = tf.s || [1, 1, 1];
    var q = tf.p || [0, 0, 0];
    return [
      m00 * s[0], m10 * s[0], m20 * s[0], 0,
      m01 * s[1], m11 * s[1], m21 * s[1], 0,
      m02 * s[2], m12 * s[2], m22 * s[2], 0,
      q[0], q[1], q[2], 1,
    ];
  }

  /* Camera / view helpers ------------------------------------------------ */
  /* Builds the world->camera matrix for a camera looking along its own -Z.
     Returns {view, invView, pos, fwd}. */
  function cameraMatrix(pos, yaw, pitch) {
    var inv = transformMatrix({ p: pos, yaw: yaw, pitch: pitch });
    var view = m4.invert(inv);
    var fwd = m4.dir(inv, [0, 0, -1]);
    return { view: view, invView: inv, pos: v3.copy(pos), fwd: v3.norm(fwd) };
  }

  /* --------------------------- easing functions -------------------------- */
  var ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { var u = t - 1; return u * u * u + 1; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inOutQuart: function (t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outBack: function (t, k) {
      var c = k === undefined ? 1.55 : k;
      var u = t - 1;
      return 1 + (c + 1) * u * u * u + c * u * u;
    },
    outElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var c = (2 * Math.PI) / 3.2;
      return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
    /* critically damped follow — frame-rate independent smoothing */
    damp: function (current, target, lambda, dt) {
      return target + (current - target) * Math.exp(-lambda * dt);
    },
  };

  /* ------------------------------- helpers ------------------------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a || EPS), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function wrap01(t) { return t - Math.floor(t); }
  /* deterministic pseudo-random, handy for procedural detail */
  function hash01(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  PLR.math = {
    v3: v3,
    m4: m4,
    transformMatrix: transformMatrix,
    cameraMatrix: cameraMatrix,
    ease: ease,
    clamp: clamp,
    lerp: lerp,
    smoothstep: smoothstep,
    wrap01: wrap01,
    hash01: hash01,
    mulberry32: mulberry32,
    DEG: Math.PI / 180,
    EPS: EPS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
