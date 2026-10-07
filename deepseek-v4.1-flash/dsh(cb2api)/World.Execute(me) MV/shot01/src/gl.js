/* =====================================================================
   WebGL post-processing stack.
   The scene is drawn on a 2D canvas, uploaded as a texture, then run
   through a full-screen GLSL chain:
     bloom -> chromatic aberration -> grain -> vignette -> scanlines -> tone map
   This is what gives the film its physical, photographic texture rather
   than the flat look of raw canvas output.
   ===================================================================== */
'use strict';

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  // WebGL clip space has +Y up, but a canvas/texture has its origin at the
  // TOP-left, so v must be inverted here. Without the 1.0- flip the entire
  // film comes out mirrored top-to-bottom.
  vUv = vec2(aPos.x*0.5+0.5, 1.0 - (aPos.y*0.5+0.5));
  gl_Position = vec4(aPos,0.0,1.0);
}
`;

// bright-pass + downsample
const FS_BRIGHT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThresh;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = smoothstep(uThresh, uThresh+0.35, l);
  gl_FragColor = vec4(c*k, 1.0);
}`;

// separable gaussian blur (direction passed in)
const FS_BLUR = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec2 t = uDir;
  vec3 s = texture2D(uTex, vUv).rgb * 0.2270270270;
  s += texture2D(uTex, vUv + t*1.3846153846).rgb * 0.3162162162;
  s += texture2D(uTex, vUv - t*1.3846153846).rgb * 0.3162162162;
  s += texture2D(uTex, vUv + t*3.2307692308).rgb * 0.0702702703;
  s += texture2D(uTex, vUv - t*3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;

// final composite
const FS_FINAL = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform vec2  uRes;
uniform float uTime;
uniform float uBloom;
uniform float uAberr;
uniform float uGrain;
uniform float uVig;
uniform float uScan;
uniform float uWarp;     // barrel / cage distortion
uniform float uExpose;
uniform float uDesat;
uniform vec3  uTint;
uniform float uFlash;
uniform vec2  uShake;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

void main(){
  vec2 uv = vUv;
  // --- cage warp: the frame bends when she presses against it
  vec2 cc = uv - 0.5;
  float r2 = dot(cc,cc);
  uv = 0.5 + cc * (1.0 + uWarp*r2*2.2);
  uv += uShake;
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ gl_FragColor=vec4(0.0,0.0,0.0,1.0); return; }

  // --- chromatic aberration, radial
  vec2 dir = normalize(cc + 1e-6);
  float amt = uAberr * (0.35 + r2*3.0);
  vec3 col;
  col.r = texture2D(uScene, uv + dir*amt*0.0022).r;
  col.g = texture2D(uScene, uv).g;
  col.b = texture2D(uScene, uv - dir*amt*0.0022).b;

  // --- bloom
  vec3 b1 = texture2D(uBloom1, uv).rgb;
  vec3 b2 = texture2D(uBloom2, uv).rgb;
  col += (b1*0.65 + b2*1.15) * uBloom;

  // --- exposure + tint + desaturate
  col *= uExpose;
  float l = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(col, vec3(l), uDesat);
  col *= uTint;

  // --- flash (execution whiteout)
  col = mix(col, vec3(1.0), uFlash);

  // --- scanlines / raster
  float sl = sin(uv.y*uRes.y*1.5707963)*0.5+0.5;
  col *= 1.0 - uScan*sl*0.30;

  // --- vignette
  float v = 1.0 - uVig*smoothstep(0.18, 0.86, length(cc)*1.32);
  col *= v;

  // --- film grain (animated, luminance-weighted)
  float g = hash(uv*uRes + fract(uTime)*173.0) - 0.5;
  col += g * uGrain * (0.35 + 0.65*(1.0-l));

  // --- tone map: a soft shoulder that preserves midtones.
  // Chosen by evaluating candidate curves against measured scene luminance
  // (see tools/tonemap.js): ACES and Reinhard both crush the night scenes.
  col = max(col, 0.0);
  col = col / (col + 0.78) * 1.78;
  col = pow(col, vec3(0.86));

  gl_FragColor = vec4(col, 1.0);
}`;

class GL {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, premultipliedAlpha: false,
    });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.canvas = canvas;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.progs = {};
    this.targets = {};
    this._mk('bright', FS_BRIGHT);
    this._mk('blur', FS_BLUR);
    this._mk('final', FS_FINAL);
    this._mkTargets();
    this._tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
  }
  _sh(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  _mk(name, fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this._sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, this._sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    this.progs[name] = { p, u, a: gl.getAttribLocation(p, 'aPos') };
  }
  _rt(w, h) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f, t, w, h };
  }
  _mkTargets() {
    const w = this.canvas.width, h = this.canvas.height;
    this.targets.b1 = this._rt(w >> 1, h >> 1);
    this.targets.b1t = this._rt(w >> 1, h >> 1);
    this.targets.b2 = this._rt(w >> 2, h >> 2);
    this.targets.b2t = this._rt(w >> 2, h >> 2);
    this.targets.scene = this._rt(w, h);
  }
  _pass(prog, target, setup) {
    const gl = this.gl;
    const { p, u, a } = this.progs[prog];
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    const w = target ? target.w : this.canvas.width;
    const h = target ? target.h : this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    setup(u, gl);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  _bind(gl, unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  /** sceneCanvas: a 2D canvas holding the rendered frame */
  render(sceneCanvas, P) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);

    // bright pass
    this._pass('bright', this.targets.b1, u => {
      this._bind(gl, 0, this._tex, u.uTex);
      gl.uniform1f(u.uThresh, P.bloomThresh);
    });
    // blur chain
    const blur = (src, dst, dx, dy) => this._pass('blur', dst, u => {
      this._bind(gl, 0, src.t, u.uTex);
      gl.uniform2f(u.uDir, dx / src.w, dy / src.h);
    });
    blur(this.targets.b1, this.targets.b1t, 1, 0);
    blur(this.targets.b1t, this.targets.b1, 0, 1);
    // downsample to b2
    this._pass('blur', this.targets.b2, u => {
      this._bind(gl, 0, this.targets.b1.t, u.uTex);
      gl.uniform2f(u.uDir, 1.0 / this.targets.b1.w, 1.0 / this.targets.b1.h);
    });
    blur(this.targets.b2, this.targets.b2t, 2, 0);
    blur(this.targets.b2t, this.targets.b2, 0, 2);

    // final
    this._pass('final', null, u => {
      this._bind(gl, 0, this._tex, u.uScene);
      this._bind(gl, 1, this.targets.b1.t, u.uBloom1);
      this._bind(gl, 2, this.targets.b2.t, u.uBloom2);
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, P.time);
      gl.uniform1f(u.uBloom, P.bloom);
      gl.uniform1f(u.uAberr, P.aberration);
      gl.uniform1f(u.uGrain, P.grain);
      gl.uniform1f(u.uVig, P.vignette);
      gl.uniform1f(u.uScan, P.scan);
      gl.uniform1f(u.uWarp, P.warp);
      gl.uniform1f(u.uExpose, P.expose);
      gl.uniform1f(u.uDesat, P.desat);
      gl.uniform3f(u.uTint, P.tint[0], P.tint[1], P.tint[2]);
      gl.uniform1f(u.uFlash, P.flash);
      gl.uniform2f(u.uShake, P.shake[0], P.shake[1]);
    });
  }
}

if (typeof module !== 'undefined') module.exports = { GL };
