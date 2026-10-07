// mat4/vec3 minimal math + GL helpers (WebGL2)
'use strict';
const M = {
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(eye, tgt, up) {
    let zx = eye[0] - tgt[0], zy = eye[1] - tgt[1], zz = eye[2] - tgt[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  },
  mul(a, b) { // a*b (column major)
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  translate(x, y, z) { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotY(a) { const m = M.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a) { const m = M.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  ortho(w, h) { const m = M.ident(); m[0] = 2 / w; m[5] = -2 / h; m[12] = -1; m[13] = 1; return m; },
};
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm(a) { const l = V.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

// deterministic hashes
function h1(n) { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }
function h2(a, b) { return h1(a * 127.1 + b * 311.7); }
function h3(a, b, c) { return h1(a * 127.1 + b * 311.7 + c * 74.7); }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };

function compile(gl, vsSrc, fsSrc, label) {
  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`[${label}] shader: ${gl.getShaderInfoLog(sh)}\n---\n${src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`);
    }
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[${label}] link: ${gl.getProgramInfoLog(p)}`);
  const uni = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); uni[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { prog: p, uni, use() { gl.useProgram(p); } };
}

function makeFBO(gl, w, h, float = false) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? (gl.RGBA16F || gl.RGBA) : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

// big dynamic line buffer
class LineBatch {
  constructor(gl, maxVerts = 200000) {
    this.gl = gl;
    this.data = new Float32Array(maxVerts * 7); // pos3 + col4
    this.count = 0;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
  }
  reset() { this.count = 0; }
  push(x, y, z, r, g, b, a) {
    const o = this.count * 7;
    if (o + 7 > this.data.length) return;
    const d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = a;
    this.count++;
  }
  seg(a, b, col) { // col = [r,g,b,a]
    this.push(a[0], a[1], a[2], col[0], col[1], col[2], col[3]);
    this.push(b[0], b[1], b[2], col[0], col[1], col[2], col[3]);
  }
  poly(pts, col, closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i], pts[i + 1], col);
    if (closed && pts.length > 2) this.seg(pts[pts.length - 1], pts[0], col);
  }
  circle(cx, cy, cz, r, col, segs = 64, rot = 0, plane = 'xz') {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = rot + i / segs * Math.PI * 2;
      if (plane === 'xz') pts.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
      else if (plane === 'xy') pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
      else pts.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r * 0.35]);
    }
    this.poly(pts, col, false);
  }
  upload(gl) {
    if (!this.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 7));
  }
}

module.exports = { M, V, h1, h2, h3, clamp, lerp, ease, easeOut, compile, makeFBO, LineBatch };
