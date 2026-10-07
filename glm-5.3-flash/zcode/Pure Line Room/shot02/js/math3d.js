/* 纯线房间 — 3D 数学库（列主序 4x4 矩阵 + 向量工具） */
(function () {
  'use strict';
  const PLR = window.PLR = window.PLR || {};

  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scl: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };

  const M4 = {
    ident() {
      const m = new Float64Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    // out = a * b（先施加 b，再施加 a）
    mul(a, b, out) {
      out = out || new Float64Array(16);
      const o = out === a || out === b ? new Float64Array(16) : out;
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
          o[c * 4 + r] = s;
        }
      }
      if (o !== out) out.set(o);
      return out;
    },
    // T * Rx * Ry * Rz * S
    compose(pos, rot, scl, out) {
      out = out || new Float64Array(16);
      const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
      const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
      const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
      // Ry*Rz
      const a00 = cy * cz, a01 = -cy * sz, a02 = sy;
      const a10 = sz, a11 = cz, a12 = 0;
      const a20 = -sy * cz, a21 = sy * sz, a22 = cy;
      // Rx * (Ry*Rz)
      const b00 = a00, b01 = a01, b02 = a02;
      const b10 = cx * a10 + sx * a20, b11 = cx * a11 + sx * a21, b12 = cx * a12 + sx * a22;
      const b20 = -sx * a10 + cx * a20, b21 = -sx * a11 + cx * a21, b22 = -sx * a12 + cx * a22;
      const S = scl || [1, 1, 1];
      out[0] = b00 * S[0]; out[1] = b10 * S[0]; out[2] = b20 * S[0]; out[3] = 0;
      out[4] = b01 * S[1]; out[5] = b11 * S[1]; out[6] = b21 * S[1]; out[7] = 0;
      out[8] = b02 * S[2]; out[9] = b12 * S[2]; out[10] = b22 * S[2]; out[11] = 0;
      out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
      return out;
    },
    point(m, p, out) {
      const x = p[0], y = p[1], z = p[2];
      const r = out || [0, 0, 0];
      r[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      r[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      r[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      return r;
    },
    dir(m, v, out) {
      const x = v[0], y = v[1], z = v[2];
      const r = out || [0, 0, 0];
      r[0] = m[0] * x + m[4] * y + m[8] * z;
      r[1] = m[1] * x + m[5] * y + m[9] * z;
      r[2] = m[2] * x + m[6] * y + m[10] * z;
      return r;
    },
    // 本项目约定：视空间 +z 朝前（相机前方 z>0）。w 分量 = z。
    perspective(fovy, aspect, near, far, out) {
      out = out || new Float64Array(16);
      const f = 1 / Math.tan(fovy / 2);
      out.fill(0);
      out[0] = f / aspect; out[5] = f;
      out[11] = 1; // w = z
      return out;
    },
    lookAt(eye, center, up, out) {
      out = out || new Float64Array(16);
      const zb = V.norm(V.sub(eye, center));       // 相机后方
      const x = V.norm(V.cross(up, zb));           // 屏幕右
      const y = V.cross(zb, x);                    // 屏幕上
      out[0] = x[0]; out[1] = y[0]; out[2] = -zb[0]; out[3] = 0;
      out[4] = x[1]; out[5] = y[1]; out[6] = -zb[1]; out[7] = 0;
      out[8] = x[2]; out[9] = y[2]; out[10] = -zb[2]; out[11] = 0;
      out[12] = -V.dot(x, eye); out[13] = -V.dot(y, eye); out[14] = V.dot(zb, eye); out[15] = 1;
      return out;
    },
  };

  PLR.V = V;
  PLR.M4 = M4;
  PLR.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  PLR.lerp = (a, b, t) => a + (b - a) * t;
  PLR.rand = (a, b) => a + Math.random() * (b - a);
  PLR.pick = (arr) => arr[(Math.random() * arr.length) | 0];
})();
