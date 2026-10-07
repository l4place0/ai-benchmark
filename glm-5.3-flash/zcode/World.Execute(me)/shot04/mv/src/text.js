// text.js — monospace glyph atlas + big-text texture cache. All text GPU-drawn.
'use strict';

class TextRenderer {
  constructor(gl) {
    this.gl = gl;
    this.items = [];       // per-frame small-glyph draw list
    this._buildAtlas();
    this._buildProgram();
    this._bigTex = new Map();
  }

  _buildAtlas() {
    const gl = this.gl;
    const CHARS = [];
    for (let c = 32; c < 127; c++) CHARS.push(String.fromCharCode(c));
    this.chars = CHARS;
    const COLS = 10, ROWS = 10, CELL = 128;
    this.cols = COLS; this.cell = CELL;
    const cv = document.createElement('canvas');
    cv.width = COLS * CELL; cv.height = ROWS * CELL;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 74px Consolas, "Courier New", monospace';
    const adv = ctx.measureText('M').width;
    this.advRatio = adv / 74; // advance per 1px of font size
    CHARS.forEach((ch, i) => {
      const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
      ctx.fillText(ch, x + CELL / 2, y + CELL / 2 + 4);
    });
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.debugCanvas = cv;
    this.atlas = tex;
    this.buf = new Float32Array(9 * 6000); // per-glyph: x,y,px,u0,v0,r,g,b,a
    // non-instanced vertex stream: 6 verts/glyph, pos2+uv2+col4
    this.MAXG = 6000;
    this.vdata = new Float32Array(this.MAXG * 6 * 8);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vdata.byteLength, gl.DYNAMIC_DRAW);
  }

  _buildProgram() {
    const gl = this.gl;
    const vsFixed = `#version 300 es
      layout(location=0) in vec2 aPos;
      layout(location=1) in vec2 aUV;
      layout(location=2) in vec4 aCol;
      uniform vec2 uRes;
      out vec2 vUV; out vec4 vCol;
      void main() {
        vec2 ndc = vec2(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0);
        gl_Position = vec4(ndc, 0.0, 1.0);
        vUV = aUV; vCol = aCol;
      }`;
    const fs = `#version 300 es
      precision mediump float;
      in vec2 vUV; in vec4 vCol; out vec4 frag;
      uniform sampler2D uTex;
      void main() {
        float a = texture(uTex, vUV).a;
        frag = vec4(vCol.rgb * vCol.a * a, a * vCol.a);
      }`;
    this.prog = require('./glutil').compile(gl, vsFixed, fs, 'text');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.bindVertexArray(null);
  }

  // queue a string; y = top of text, x = left (or centered/right via align)
  draw(str, x, y, px, col, align = 'left') {
    if (!str) return;
    let w = str.length * px * this.advRatio;
    if (align === 'center') x -= w / 2;
    else if (align === 'right') x -= w;
    for (let i = 0; i < str.length; i++) {
      const ci = this.chars.indexOf(str[i]);
      if (ci < 0) continue;
      const o = (this.items.length) * 9;
      this.items.push(x + i * px * this.advRatio, y, px,
        (ci % this.cols) / this.cols, Math.floor(ci / this.cols) / this.cols,
        col[0], col[1], col[2], col[3]);
    }
  }

  flush(gl, W, H) {
    if (!this.items.length) return;
    const nG = Math.min(this.items.length / 9, this.MAXG) | 0;
    const v = this.vdata;
    const cell = 1 / this.cols;
    for (let g = 0; g < nG; g++) {
      const o = g * 9;
      const x = this.items[o], y = this.items[o + 1], px = this.items[o + 2];
      const u0 = this.items[o + 3], v0 = this.items[o + 4];
      const r = this.items[o + 5], gg = this.items[o + 6], b = this.items[o + 7], a = this.items[o + 8];
      const w = px, h = px * 1.18;
      const x0 = x, x1 = x + w, yT = y - h * 0.14, yB = y + h * 0.86;
      const u1 = u0 + cell, v1 = v0 + cell;
      const vo = g * 48; // 6 verts * 8 floats
      // vert: posX,posY, u,v, r,g,b,a  — two triangles
      const tri = (k, X, Y, U, V) => {
        const b0 = vo + k * 8;
        v[b0] = X; v[b0 + 1] = Y; v[b0 + 2] = U; v[b0 + 3] = V;
        v[b0 + 4] = r; v[b0 + 5] = gg; v[b0 + 6] = b; v[b0 + 7] = a;
      };
      tri(0, x0, yT, u0, v0); tri(1, x1, yT, u1, v0); tri(2, x0, yB, u0, v1);
      tri(3, x1, yT, u1, v0); tri(4, x1, yB, u1, v1); tri(5, x0, yB, u0, v1);
    }
    gl.useProgram(this.prog.prog);
    gl.uniform2f(this.prog.uni.uRes, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(this.prog.uni.uTex, 0);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, v.subarray(0, nG * 48));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, nG * 6);
    gl.bindVertexArray(null);
    this.items.length = 0;
  }

  // ---- big text as cached texture ----
  big(str, px, col, glow = 18, weight = 700, maxW = 2048) {
    const key = `${str}|${px}|${col.join(',')}|${glow}|${weight}`;
    if (this._bigTex.has(key)) return this._bigTex.get(key);
    const gl = this.gl;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const font = `${weight} ${px}px Consolas, "Courier New", monospace`;
    ctx.font = font;
    let w = Math.min(ctx.measureText(str).width, maxW - 60);
    // re-measure with fitting
    let fitPx = px;
    if (ctx.measureText(str).width > maxW - 60) { fitPx = px * (maxW - 60) / ctx.measureText(str).width; ctx.font = `${weight} ${fitPx}px Consolas, "Courier New", monospace`; w = ctx.measureText(str).width; }
    cv.width = Math.ceil(w + glow * 4 + 40);
    cv.height = Math.ceil(fitPx * 1.5 + glow * 4);
    const ctx2 = cv.getContext('2d');
    ctx2.font = `${weight} ${fitPx}px Consolas, "Courier New", monospace`;
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    const cx = cv.width / 2, cy = cv.height / 2;
    const hex = c => Math.round(clamp01(c) * 255);
    const rgba = `rgba(${hex(col[0])},${hex(col[1])},${hex(col[2])},`;
    for (let g = glow; g > 0; g -= Math.max(1, glow / 6)) {
      ctx2.shadowColor = `${rgba}${0.22})`;
      ctx2.shadowBlur = g;
      ctx2.fillStyle = `${rgba}${0.28})`;
      ctx2.fillText(str, cx, cy);
    }
    ctx2.shadowColor = 'transparent';
    ctx2.fillStyle = `${rgba}${col[3]})`;
    ctx2.fillText(str, cx, cy);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rec = { tex, w: cv.width, h: cv.height };
    if (this._bigTex.size > 48) { // evict oldest (all small textures)
      const first = this._bigTex.keys().next().value;
      const old = this._bigTex.get(first);
      gl.deleteTexture(old.tex);
      this._bigTex.delete(first);
    }
    this._bigTex.set(key, rec);
    return rec;
  }
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

module.exports = { TextRenderer };
