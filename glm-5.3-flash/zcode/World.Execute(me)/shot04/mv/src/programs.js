// programs.js — all GL programs, static geometry, instance buffers
'use strict';
const { M, V, compile } = require('./glutil');

const FOG = `
  float fogF(float dist, float dens) { return exp(-dist * dens); }`;

const QUADVERT = `#version 300 es
  layout(location=0) in vec2 aPos;
  layout(location=1) in vec2 aUV;
  out vec2 vUV;
  void main() { vUV = aUV; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// fullscreen quad: NDC pos + uv (v=1 at top)
const FSQ_VERTS = new Float32Array([
  -1, 1, 0, 1, 1, 1, 1, 1, -1, -1, 0, 0,
  1, 1, 1, 1, 1, -1, 1, 0, -1, -1, 0, 0,
]);
// unit quad 0..1 for P.quad
const UNIT_VERTS = new Float32Array([
  0, 0, 1, 0, 0, 1,
  1, 0, 1, 1, 0, 1,
]);

function buildAll(gl) {
  const P = {};

  // fullscreen background gradient
  P.bg = compile(gl, QUADVERT, `#version 300 es
    precision mediump float; in vec2 vUV; out vec4 frag;
    uniform vec3 uTop; uniform vec3 uBot; uniform vec2 uGlowPos; uniform vec3 uGlowCol; uniform float uGlowAmt;
    void main() {
      vec3 c = mix(uBot, uTop, vUV.y);
      float d = length((vUV - uGlowPos) * vec2(1.7, 1.0));
      c += uGlowCol * exp(-d * 4.0) * uGlowAmt;
      frag = vec4(c, 1.0);
    }`, 'bg');

  // dynamic lines (pos3 col4)
  P.line = compile(gl, `#version 300 es
    layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol;
    uniform mat4 uVP; out vec4 vCol; out float vDist;
    void main() { gl_Position = uVP * vec4(aPos, 1.0); vCol = aCol; vDist = gl_Position.w; }`,
    `#version 300 es
    precision mediump float; in vec4 vCol; in float vDist; out vec4 frag;
    uniform float uFog;
    void main() { float a = vCol.a * exp(-vDist * uFog); if (a < 0.003) discard; frag = vec4(vCol.rgb * a, a); }`, 'line');

  // instanced cube wireframes: static edge VBO + instance attrs
  const edges = [];
  const C = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  for (const [a, b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) {
    edges.push(...C[a], ...C[b]);
  }
  P.cube = compile(gl, `#version 300 es
    layout(location=0) in vec3 aCorner;
    layout(location=1) in vec3 iPos;
    layout(location=2) in float iScale;
    layout(location=3) in float iRotY;
    layout(location=4) in vec4 iCol;
    layout(location=5) in float iSeed;
    uniform mat4 uVP; uniform float uTime;
    out vec4 vCol; out float vDist;
    void main() {
      float c = cos(iRotY), s = sin(iRotY);
      vec3 p = vec3(aCorner.x * c - aCorner.z * s, aCorner.y, aCorner.x * s + aCorner.z * c) * iScale + iPos;
      p.y += sin(uTime * (0.5 + iSeed) + iSeed * 40.0) * 0.15 * iScale;
      gl_Position = uVP * vec4(p, 1.0);
      vCol = iCol; vDist = gl_Position.w;
    }`,
    `#version 300 es
    precision mediump float; in vec4 vCol; in float vDist; out vec4 frag;
    uniform float uFog;
    void main() { float a = vCol.a * exp(-vDist * uFog); if (a < 0.003) discard; frag = vec4(vCol.rgb * a, a); }`, 'cube');
  P.cubeEdgeVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, P.cubeEdgeVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges), gl.STATIC_DRAW);
  P.cubeInst = new InstBuf(gl, 4000, 10); // iPos3 iScale1 iRotY1 iCol4 iSeed1
  P.cubeVAO = gl.createVertexArray();
  gl.bindVertexArray(P.cubeVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, P.cubeEdgeVBO);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, P.cubeInst.vbo);
  const cubeAttrs = [[1, 3, 0], [2, 1, 12], [3, 1, 16], [4, 4, 20], [5, 1, 36]];
  for (const [loc, size, off] of cubeAttrs) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);

  // instanced point sprites (billboard quads): iPos3 iSize1 iCol4 iSeed1 + per-vertex corner
  P.inst = compile(gl, `#version 300 es
    layout(location=0) in vec3 iPos;
    layout(location=1) in float iSize;
    layout(location=2) in vec4 iCol;
    layout(location=3) in float iSeed;
    layout(location=4) in vec2 aC;
    uniform mat4 uView; uniform mat4 uProj; uniform vec3 uRight; uniform vec3 uUp; uniform float uTime;
    out vec2 vUV; out vec4 vCol; out float vSeed;
    void main() {
      vec2 c = aC * 2.0 - 1.0;
      vec4 vp = uView * vec4(iPos, 1.0);
      vp.xy += c * iSize;
      gl_Position = uProj * vp;
      vUV = c;
      vCol = iCol; vSeed = iSeed;
    }`,
    `#version 300 es
    precision mediump float; in vec2 vUV; in vec4 vCol; in float vSeed; out vec4 frag;
    uniform float uTime; uniform float uFog; uniform float uCore;
    void main() {
      float d = length(vUV);
      float a = smoothstep(1.0, 0.05, d);
      a *= 0.75 + 0.25 * sin(uTime * (2.0 + vSeed * 6.0) + vSeed * 61.0);
      vec3 col = vCol.rgb + vec3(1.0) * pow(smoothstep(0.6, 0.0, d), 3.0) * uCore;
      float alpha = a * vCol.a;
      if (alpha < 0.004) discard;
      frag = vec4(col * alpha, alpha);
    }`, 'inst');

  // textured/solid quad with transform (big text, discs, beams)
  P.quad = compile(gl, `#version 300 es
    layout(location=0) in vec2 aC;
    out vec2 vUV;
    uniform mat4 uMat;
    void main() {
      vUV = aC;
      gl_Position = uMat * vec4(aC.x, 1.0 - aC.y, 0.0, 1.0);
    }`,
    `#version 300 es
    precision mediump float; in vec2 vUV; out vec4 frag;
    uniform sampler2D uTex; uniform vec4 uCol; uniform int uShape; uniform int uUseTex;
    void main() {
      float a = 1.0;
      if (uShape == 1) a = smoothstep(1.0, 0.0, length(vUV - 0.5) * 2.0);
      if (uShape == 2) a = pow(max(0.0, 1.0 - abs(vUV.x - 0.5) * 2.0), 2.2) * smoothstep(1.0, 0.2, abs(vUV.y - 0.5) * 2.0);
      vec4 c = uCol;
      if (uUseTex == 1) { vec4 t = texture(uTex, vUV); c = vec4(t.rgb * uCol.rgb, t.a) * uCol.a; }
      frag = vec4(c.rgb * a * c.a, a * c.a);
    }`, 'quad');

  // glyph text
  P.glyph = null; // built by TextRenderer

  // ---------- post ----------
  P.bright = compile(gl, QUADVERT, `#version 300 es
    precision mediump float; in vec2 vUV; out vec4 frag;
    uniform sampler2D uTex; uniform float uThresh;
    void main() {
      vec3 c = texture(uTex, vUV).rgb;
      float l = max(max(c.r, c.g), c.b);
      float k = max(0.0, l - uThresh) / max(l, 1e-4);
      frag = vec4(c * k, 1.0);
    }`, 'bright');

  P.blur = compile(gl, QUADVERT, `#version 300 es
    precision mediump float; in vec2 vUV; out vec4 frag;
    uniform sampler2D uTex; uniform vec2 uTexel; uniform vec2 uDir;
    void main() {
      vec3 s = texture(uTex, vUV).rgb * 0.227;
      vec2 o1 = uDir * uTexel * 1.385, o2 = uDir * uTexel * 3.230;
      s += (texture(uTex, vUV + o1).rgb + texture(uTex, vUV - o1).rgb) * 0.316;
      s += (texture(uTex, vUV + o2).rgb + texture(uTex, vUV - o2).rgb) * 0.070;
      frag = vec4(s, 1.0);
    }`, 'blur');

  P.comp = compile(gl, QUADVERT, `#version 300 es
    precision highp float; in vec2 vUV; out vec4 frag;
    uniform sampler2D uScene; uniform sampler2D uBloomA; uniform sampler2D uBloomC;
    uniform vec2 uRes; uniform float uFrame;
    uniform float uAber; uniform float uGrain; uniform float uVig; uniform float uBloom;
    uniform float uRays; uniform vec2 uLight; uniform float uFlash; uniform float uExpo;
    uniform float uScan; uniform float uSharp;
    uniform vec3 uTint; uniform float uTintAmt;
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUV;
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      // chromatic aberration (radial, energy driven)
      vec2 ab = cc * uAber * (0.6 + r2 * 2.0);
      vec3 col;
      col.r = texture(uScene, uv + ab).r;
      col.g = texture(uScene, uv).g;
      col.b = texture(uScene, uv - ab).b;
      // bloom
      col += texture(uBloomA, uv).rgb * uBloom;
      col += texture(uBloomC, uv).rgb * uBloom * 1.3;
      // radial light rays
      if (uRays > 0.001) {
        vec3 acc = vec3(0.0);
        vec2 dir = (uLight - uv);
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 8.0;
          vec2 sp = uv + dir * t * 0.85;
          acc += texture(uScene, sp).rgb;
        }
        col += acc * (0.030 * uRays);
      }
      // exposure + tint + tonemap
      col *= uExpo;
      col = mix(col, col * uTint * 1.6, uTintAmt);
      col = aces(col * 1.15);
      // vignette
      col *= 1.0 - uVig * smoothstep(0.15, 0.85, r2 * 1.8);
      // scanlines (terminal scenes)
      if (uScan > 0.001) {
        col *= 1.0 - uScan * 0.45 * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.6));
      }
      // grain
      float g = hash(uv * uRes + vec2(uFrame * 17.13, uFrame * 7.77));
      col += (g - 0.5) * uGrain;
      // sharpness-ish: skip (cost) — uSharp reserved
      col = mix(col, vec3(1.0), uFlash);
      frag = vec4(col, 1.0);
    }`, 'comp');

  // fullscreen quad VAO (real VBO — attrib-less gl_VertexID draws are broken under ANGLE)
  P.fsVAO = gl.createVertexArray();
  gl.bindVertexArray(P.fsVAO);
  P.fsVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, P.fsVBO);
  gl.bufferData(gl.ARRAY_BUFFER, FSQ_VERTS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);

  // unit quad VAO for P.quad
  P.quadVAO = gl.createVertexArray();
  gl.bindVertexArray(P.quadVAO);
  P.quadVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, P.quadVBO);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_VERTS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);

  P.drawFS = function (prog, setUniforms) {
    gl.useProgram(prog.prog);
    if (setUniforms) setUniforms(prog.uni);
    gl.bindVertexArray(P.fsVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  };
  return P;
}

// generic per-instance float buffer
class InstBuf {
  constructor(gl, maxInst, stride) {
    this.gl = gl; this.stride = stride;
    this.data = new Float32Array(maxInst * stride);
    this.count = 0;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
  }
  reset() { this.count = 0; }
  push(...vals) {
    const o = this.count * this.stride;
    if (o + this.stride > this.data.length) return;
    for (let i = 0; i < this.stride; i++) this.data[o + i] = vals[i] !== undefined ? vals[i] : 0;
    this.count++;
  }
  upload() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (!this._sized) { gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW); this._sized = true; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * this.stride));
  }
}

module.exports = { buildAll, InstBuf, QUADVERT, UNIT_VERTS };
