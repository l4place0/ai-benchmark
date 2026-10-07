// render.js — the frame pipeline.
//
//   world shader  ->  sprites  ->  3D text  ->  the program  ->  screen text
//        ->  bloom (bright + 3 blur levels)  ->  composite / grade  ->  canvas
//
// Nothing is read back from the previous frame, so renderFrame(t) is a pure
// function of t.

import { program, target, screenQuad, instanceSet } from './gl.js';
import * as S from './shaders.js';
import { Text } from './text.js';
import { buildFrame, SPR } from './score.js';

/* ------------------------------------------------------------------- mat4 */
function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}
function lookAt(out, eye, ctr, up) {
  let zx = eye[0] - ctr[0], zy = eye[1] - ctr[1], zz = eye[2] - ctr[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}
function mul(out, a, b) {
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
    out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
    out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
    out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
}

/* ---------------------------------------------------------------- renderer */
export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;
    this.gl = gl;
    this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
    this.W = canvas.width; this.H = canvas.height;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    this.pWorld = program(gl, S.QUAD_VS, S.WORLD_FS, 'world');
    this.pSprite = program(gl, S.SPRITE_VS, S.SPRITE_FS, 'sprite');
    this.pFigure = program(gl, S.FIGURE_VS, S.FIGURE_FS, 'figure');
    this.pBright = program(gl, S.QUAD_VS, S.BRIGHT_FS, 'bright');
    this.pBlur = program(gl, S.QUAD_VS, S.BLUR_FS, 'blur');
    this.pDown = program(gl, S.QUAD_VS, S.DOWN_FS, 'down');
    this.pComp = program(gl, S.QUAD_VS, S.COMPOSITE_FS, 'composite');
    this.pPaper = program(gl, S.QUAD_VS, S.PAPER_FS, 'paper');

    this.quad = screenQuad(gl);
    this.text = new Text(gl);

    this.spriteSet = instanceSet(gl, [1, 2, 3, 4, 5, 6, 7], [3, 2, 4, 1, 1, 1, 2], 40000);
    this.figVao = this._makeQuad(gl);
    this._alloc(canvas.width, canvas.height);
    this.view = new Float32Array(16);
    this.proj = new Float32Array(16);
    this.vp = new Float32Array(16);
  }

  _makeQuad(gl) {
    const vao = gl.createVertexArray();
    const b = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  _alloc(w, h) {
    const gl = this.gl;
    this.W = w; this.H = h;
    for (const t of (this.targets || [])) { gl.deleteTexture(t.texture); gl.deleteFramebuffer(t); }
    this.targets = [];
    const fmt = this.floatOK
      ? { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }
      : { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    const mk = (ww, hh) => { const t = target(gl, { width: ww, height: hh, filter: gl.LINEAR, ...fmt }); this.targets.push(t); return t; };
    this.scene = mk(w, h);
    this.bright = mk(w >> 1, h >> 1);
    this.blurA = mk(w >> 1, h >> 1);
    this.blurB = mk(w >> 2, h >> 2);
    this.blurC = mk(w >> 3, h >> 3);
    this.tmpA = mk(w >> 1, h >> 1);
    this.tmpB = mk(w >> 2, h >> 2);
    this.tmpC = mk(w >> 3, h >> 3);
  }

  resize(w, h) { if (w !== this.W || h !== this.H) this._alloc(w, h); }

  /** Draw a fullscreen quad with the given program bound to the given target. */
  _pass(prog, dst) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst : null);
    const w = dst ? dst.width : this.W, h = dst ? dst.height : this.H;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  renderFrame(t, mus) {
    const gl = this.gl;
    const st = buildFrame(t, mus);
    const L = st.look;

    /* ---------------------------------------------------------- camera */
    const cam = st.cam;
    lookAt(this.view, cam.pos, cam.target, [0, 1, 0]);
    perspective(this.proj, (cam.fov * Math.PI) / 180, this.W / this.H, 0.05, 400);
    mul(this.vp, this.proj, this.view);
    // roll
    if (cam.roll) {
      const c = Math.cos(cam.roll), s = Math.sin(cam.roll);
      const r = new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      mul(this.vp, r, this.vp);
    }
    const right = [this.view[0], this.view[4], this.view[8]];
    const up = [this.view[1], this.view[5], this.view[9]];
    const fwd = [-this.view[2], -this.view[6], -this.view[10]];

    /* ----------------------------------------------------------- scene */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(L.bg[0], L.bg[1], L.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pw = this.pWorld;
    gl.useProgram(pw);
    gl.uniform2f(pw.u.uRes, this.W, this.H);
    gl.uniform3fv(pw.u.uCamPos, cam.pos);
    gl.uniform3fv(pw.u.uCamRight, right);
    gl.uniform3fv(pw.u.uCamUp, up);
    gl.uniform3fv(pw.u.uCamFwd, fwd);
    gl.uniform1f(pw.u.uTanHalf, Math.tan((cam.fov * Math.PI) / 360));
    gl.uniform1f(pw.u.uTime, t);
    gl.uniform3fv(pw.u.uBg, L.bg);
    gl.uniform3fv(pw.u.uFg, L.fg);
    gl.uniform3fv(pw.u.uAccent, L.accent);
    gl.uniform3fv(pw.u.uWarn, L.warn);
    gl.uniform1f(pw.u.uPaper, L.paper);
    gl.uniform1f(pw.u.uGlow, L.glow);
    gl.uniform1f(pw.u.uExposure, 1.0);
    gl.uniform1f(pw.u.uGridFade, L.gridFade);
    gl.uniform1f(pw.u.uGridWarp, L.gridWarp);
    gl.uniform1f(pw.u.uGridWarpFreq, L.gridWarpFreq);
    gl.uniform1f(pw.u.uRings, L.rings);
    gl.uniform1f(pw.u.uRingFreq, L.ringFreq);
    gl.uniform1f(pw.u.uCircuit, L.circuit);
    gl.uniform1f(pw.u.uScan, L.scan);
    gl.uniform1f(pw.u.uCrack, L.crack);
    gl.uniform1f(pw.u.uHorizon, L.horizon);
    gl.uniform1f(pw.u.uFog, L.fog);
    gl.uniform1f(pw.u.uStars, L.stars);
    gl.uniform1f(pw.u.uMoon, L.moon);
    gl.uniform1f(pw.u.uMoonX, L.moonX);
    gl.uniform1f(pw.u.uMoonY, L.moonY);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // paper backdrop is drawn inside the world shader (uPaper) — nothing to add here

    /* --------------------------------------------------------- sprites */
    const set = this.spriteSet;
    set.count = 0;
    const d = set.data;
    const stride = set.strideFloats;
    const maxN = Math.min(st.sprites.length, set.capacity);
    for (let i = 0; i < maxN; i++) {
      const s = st.sprites[i];
      const o = i * stride;
      d[o] = s.p[0]; d[o + 1] = s.p[1]; d[o + 2] = s.p[2];
      d[o + 3] = s.s[0]; d[o + 4] = s.s[1];
      d[o + 5] = s.c[0]; d[o + 6] = s.c[1]; d[o + 7] = s.c[2]; d[o + 8] = s.c[3];
      d[o + 9] = s.rot || 0;
      d[o + 10] = s.shape || 0;
      d[o + 11] = s.seed || 0;
      d[o + 12] = s.glow ?? 1;
      d[o + 13] = s.p2 ?? 0;
    }
    set.count = maxN;
    if (maxN > 0) {
      const ps = this.pSprite;
      gl.useProgram(ps);
      gl.uniformMatrix4fv(ps.u.uViewProj, false, this.vp);
      gl.uniform2f(ps.u.uRes, this.W, this.H);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      set.draw(maxN);
    }

    /* ------------------------------------------------- 3D text on the sheet */
    this.text.begin();
    for (const w of st.world) {
      this.text.pushWorld(this.text.world, w.str, {
        origin: w.origin, u: w.u, v: w.v, color: w.color, alpha: w.alpha, tracking: w.tracking,
      });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene);
    gl.viewport(0, 0, this.W, this.H);
    this.text.drawWorld(gl, this.vp);

    /* --------------------------------------------------- the program itself */
    const F = st.fig;
    if (F.show > 0.001) {
      const pf = this.pFigure;
      gl.useProgram(pf);
      const sx = F.sx * F.flip;
      gl.uniform2f(pf.u.uCenter, F.cx, F.cy);
      gl.uniform2f(pf.u.uScale, F.sx, F.sx * (this.W / this.H));
      gl.uniform1f(pf.u.uRot, F.rot + (F.flip < 0 ? Math.PI : 0));
      gl.uniform1f(pf.u.uAspect, this.H / this.W);
      gl.uniform1f(pf.u.uTime, t);
      gl.uniform1f(pf.u.uMorph, F.morph);
      gl.uniform1i(pf.u.uShapeA, F.a);
      gl.uniform1i(pf.u.uShapeB, F.b);
      gl.uniform1f(pf.u.uHalftone, F.halftone);
      gl.uniform1f(pf.u.uBands, F.bands);
      gl.uniform1f(pf.u.uGlow, F.glow);
      gl.uniform1f(pf.u.uReveal, F.reveal);
      gl.uniform1f(pf.u.uDissolve, F.dissolve);
      gl.uniform1f(pf.u.uSeed, Math.floor(st.block * 17.3));
      gl.uniform1f(pf.u.uOpacity, F.opacity);
      gl.uniform3fv(pf.u.uColorA, F.colA);
      gl.uniform3fv(pf.u.uColorB, F.colB);
      gl.uniform3fv(pf.u.uMatte, L.bg);
      gl.uniform1f(pf.u.uMatteAmt, F.matte ?? 0.85);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.figVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    /* -------------------------------------------------------- screen text */
    for (const s of st.screen) {
      this.text.pushScreen(this.text.screen, s.str, s);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene);
    gl.viewport(0, 0, this.W, this.H);
    this.text.drawScreen(gl, this.W, this.H);

    /* ------------------------------------------------------------- bloom */
    gl.disable(gl.BLEND);
    const bp = this.pBright;
    this._pass(bp, this.bright);
    gl.useProgram(bp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.texture);
    gl.uniform1i(bp.u.uTex, 0);
    gl.uniform1f(bp.u.uThreshold, 1.0);
    gl.uniform1f(bp.u.uKnee, 0.55);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // blur at three scales
    this._blur(this.bright, this.tmpA, this.blurA, 1.0);
    this._blur(this.bright, this.tmpB, this.blurB, 2.4);
    this._blur(this.bright, this.tmpC, this.blurC, 5.5);

    /* --------------------------------------------------------- composite */
    const pc = this.pComp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(pc);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurA.texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.blurB.texture);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.blurC.texture);
    gl.uniform1i(pc.u.uScene, 0);
    gl.uniform1i(pc.u.uBloom0, 1);
    gl.uniform1i(pc.u.uBloom1, 2);
    gl.uniform1i(pc.u.uBloom2, 3);
    gl.uniform3f(pc.u.uBloomW, 0.52, 0.32, 0.24);
    gl.uniform2f(pc.u.uRes, this.W, this.H);
    gl.uniform1f(pc.u.uTime, t);
    gl.uniform1f(pc.u.uBloomAmt, L.bloom);
    gl.uniform1f(pc.u.uCA, L.ca);
    gl.uniform1f(pc.u.uGrain, L.grain);
    gl.uniform1f(pc.u.uScanline, L.scanline);
    gl.uniform1f(pc.u.uVignette, L.vignette);
    gl.uniform1f(pc.u.uInvert, L.invert);
    gl.uniform1f(pc.u.uGlitch, L.glitch);
    gl.uniform1f(pc.u.uExposure, L.exposure);
    gl.uniform3fv(pc.u.uTint, L.tint);
    gl.uniform1f(pc.u.uBars, L.bars);
    gl.uniform1f(pc.u.uFade, L.fade);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return st;
  }

  /** Separable gaussian: src -> tmp (horizontal) -> dst (vertical). */
  _blur(src, tmp, dst, scale) {
    const gl = this.gl;
    const pb = this.pBlur;
    gl.useProgram(pb);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(pb.u.uTex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, tmp);
    gl.viewport(0, 0, tmp.width, tmp.height);
    gl.bindTexture(gl.TEXTURE_2D, src.texture);
    gl.uniform2f(pb.u.uDir, scale / tmp.width, 0);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
    gl.viewport(0, 0, dst.width, dst.height);
    gl.bindTexture(gl.TEXTURE_2D, tmp.texture);
    gl.uniform2f(pb.u.uDir, 0, scale / dst.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Read the rendered frame back as RGBA bytes (used by the QA tooling). */
  readPixels() {
    const gl = this.gl;
    const px = new Uint8Array(this.W * this.H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }
}

export { SPR };
