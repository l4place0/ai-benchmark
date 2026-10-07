// main.js — MV orchestrator. render(tSec, frame) is a pure function of time.
'use strict';
const TL = (typeof TIMELINE !== 'undefined') ? TIMELINE : require('../../config/timeline.js');
const { M, V, h1, clamp, lerp, compile, makeFBO, LineBatch } = require('./glutil');
const { buildAll, InstBuf, UNIT_VERTS } = require('./programs');
const { TextRenderer } = require('./text');
const { SCENES, COL, project, setCam } = require('./scenes');

const MV = { ready: false, iso: null };

MV.init = function (canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 unavailable');
  MV.gl = gl; MV.canvas = canvas;
  const W = MV.W = canvas.width = parseInt(canvas.dataset.w || '1920');
  const H = MV.H = canvas.height = parseInt(canvas.dataset.h || '1080');

  const P = MV.P = buildAll(gl);
  MV.text = new TextRenderer(gl);

  // dynamic line batch + static grid
  MV.dyn = new LineBatch(gl, 120000);
  MV.gridLB = new LineBatch(gl, 200000);
  buildGrid(MV);
  MV.gridLB.upload(gl);
  MV.dyn._vao = makeLineVAO(gl, MV.dyn.vbo);
  MV.gridLB._vao = makeLineVAO(gl, MV.gridLB.vbo);

  // particle instance buffer (stride 9: pos3 size1 col4 seed1)
  MV.instBuf = new InstBuf(gl, 9000, 9);
  MV.instBuf2 = new InstBuf(gl, 900, 9);
  MV._cornerVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, MV._cornerVBO);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_VERTS, gl.STATIC_DRAW);
  MV.instBuf._vao = makeInstVAO(gl, MV.instBuf.vbo);
  MV.instBuf2._vao = makeInstVAO(gl, MV.instBuf2.vbo);

  // line VAO (pos3 col4)
  MV.lineVAO = gl.createVertexArray();
  gl.bindVertexArray(MV.lineVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, MV.dyn.vbo);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);

  // framebuffers
  MV.sceneFBO = makeFBO(gl, W, H);
  MV.outFBO = makeFBO(gl, W, H); // composite target — readPixels from FBOs is reliable;
  // the default-framebuffer readback drops additive draws on ANGLE/D3D11 headless.
  MV.bloomA = makeFBO(gl, W >> 1, H >> 1);
  MV.bloomB = makeFBO(gl, W >> 1, H >> 1);
  MV.bloomC = makeFBO(gl, W >> 2, H >> 2);
  MV.bloomD = makeFBO(gl, W >> 2, H >> 2);

  MV.cam = { eye: [0, 0, 10], tgt: [0, 0, 0], view: M.ident(), proj: M.ident(), vp: M.ident(), right: [1, 0, 0], up: [0, 1, 0] };
  // fullscreen blit matrix for P.quad (unit quad -> NDC, upright)
  MV._blitMat = new Float32Array([2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);
  MV.ready = true;
};

function makeLineVAO(gl, vbo) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);
  return vao;
}
function makeInstVAO(gl, vbo) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const iattr = [[0, 3, 0], [1, 1, 12], [2, 4, 16], [3, 1, 32]];
  for (const [loc, size, off] of iattr) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 36, off);
    gl.vertexAttribDivisor(loc, 1);
  }
  // per-vertex corner quad (divisor 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, MV._cornerVBO);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 8, 0);
  gl.vertexAttribDivisor(4, 0);
  gl.bindVertexArray(null);
  return vao;
}

function buildGrid(MV) {
  const lb = MV.gridLB; lb.reset();
  const N = 21, STEP = 4.6, HALF = N * STEP / 2;
  const c = [COL.teal[0], COL.teal[1], COL.teal[2], 0.5];
  for (let i = 0; i <= N; i++) {
    const p = -HALF + i * STEP;
    lb.push(p, 0, -HALF, ...c); lb.push(p, 0, HALF, ...c);
    lb.push(-HALF, 0, p, ...c); lb.push(HALF, 0, p, ...c);
  }
}

function beatInfo(t) {
  const g = TL.grid(t);
  const tau = g.beatPhase * TL.BEAT;
  const barTau = g.barPhase * TL.BAR;
  return {
    grid: g,
    beat: Math.exp(-tau * 6.5),
    bar: Math.exp(-barTau * 3.0),
  };
}

MV.render = function (tSec, frame) {
  const gl = MV.gl, W = MV.W, H = MV.H;
  const s = TL.sectionAt(tSec);
  const tl = tSec - s.t0;
  const u = clamp(tl / (s.t1 - s.t0), 0, 1);
  const bi = beatInfo(tSec);

  // shared state for scenes
  const G = MV;
  G.t = tSec; G.frame = frame; G.sec = s; G.tl = tl; G.u = u;
  G.beatEnv = bi.beat; G.barEnv = bi.bar;
  G.KEY = TL.KEY; G.COUNTDOWN = TL.COUNTDOWN; G.BAR = TL.BAR; G.BEAT = TL.BEAT;
  G.fog = 0.01;
  G.coreBoost = 0.9;
  G.fx = { bloom: 0.8, vig: 0.5, rays: 0, glitch: 0, shake: 0, flash: 0, scan: 0, expo: 1.0, tint: [1, 1, 1], tintAmt: 0 };

  // render into scene FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, MV.sceneFBO.fbo);
  gl.viewport(0, 0, W, H);

  if (MV.iso === 'atlas') {
    gl.disable(gl.BLEND);
    const T = MV.text;
    const mat = new Float32Array([2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);
    gl.useProgram(MV.P.quad.prog);
    gl.uniformMatrix4fv(MV.P.quad.uni.uMat, false, mat);
    gl.uniform4f(MV.P.quad.uni.uCol, 1, 1, 1, 1);
    gl.uniform1i(MV.P.quad.uni.uShape, 0);
    gl.uniform1i(MV.P.quad.uni.uUseTex, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.atlas); gl.uniform1i(MV.P.quad.uni.uTex, 0);
    gl.bindVertexArray(MV.P.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    G.fx.bloom = 0; G.fx.vig = 0; G.fx.rays = 0; G.fx.flash = 0; G.fx.glitch = 0; G.fx.scan = 0;
    MV.text.items.length = 0;
  } else if (MV.iso === 'bg') {
    const gl2 = gl;
    gl2.disable(gl2.BLEND);
    const P = MV.P;
    P.drawFS(P.bg, un => {
      gl2.uniform3f(un.uTop, 0.02, 0.05, 0.09);
      gl2.uniform3f(un.uBot, 0.004, 0.006, 0.012);
      gl2.uniform2f(un.uGlowPos, 0.5, 0.45);
      gl2.uniform3f(un.uGlowCol, 0.1, 0.3, 0.45);
      gl2.uniform1f(un.uGlowAmt, 0.5);
    });
    G.fx.bloom = 0.4; G.fx.vig = 0.5; G.fx.rays = 0; G.fx.flash = 0; G.fx.glitch = 0; G.fx.scan = 0;
    MV.text.items.length = 0;
  } else if (MV.iso === 'text') {
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const T = MV.text;
    T.draw('ABC abc 012 ;:/ world.execute(me);', 100, 100, 42, [1, 1, 1, 1]);
    T.draw('小测试', 100, 200, 42, [0.4, 1, 0.8, 1]);
    T.draw(s.code, 40, H - 64, 20, [0.42, 0.72, 0.85, 0.8]);
    G.fx.bloom = 0.4; G.fx.vig = 0.1; G.fx.rays = 0; G.fx.flash = 0; G.fx.glitch = 0; G.fx.scan = 0;
    T.flush(gl, W, H);
  } else {
  const fn = SCENES[s.scene] || SCENES.boot;
  fn(G, tl, u, s);

  // camera shake (applied post-hoc: re-render with shake is costly — instead shake via glitch/uv in comp)
  // captions layer
  const T = MV.text;
  T.draw(s.code, 40, H - 64, 20, [0.42, 0.72, 0.85, 0.55]);
  const mm = Math.floor(tSec / 60), ss = (tSec % 60).toFixed(1).padStart(4, '0');
  T.draw(`bar ${String(bi.grid.bar).padStart(3, '0')}  t=${mm}:${ss}`, W - 40, H - 60, 15, [0.35, 0.5, 0.6, 0.42], 'right');
  T.draw('world.execute(me); - fan program', W - 40, H - 38, 13, [0.3, 0.42, 0.5, 0.3], 'right');
  // whiteout flash override
  if (tSec >= TL.KEY.whiteout - 0.02 && tSec < TL.KEY.whiteoutEnd) {
    G.fx.flash = Math.max(G.fx.flash, 1 - Math.abs((tSec - TL.KEY.whiteout) / (TL.KEY.whiteoutEnd - TL.KEY.whiteout) - 0.18) * 1.4);
  }
  T.flush(gl, W, H);
  }

  // ---------- post ----------
  gl.disable(gl.BLEND);
  // bright pass → bloomA
  gl.bindFramebuffer(gl.FRAMEBUFFER, MV.bloomA.fbo);
  gl.viewport(0, 0, MV.bloomA.w, MV.bloomA.h);
  P_draw(MV, MV.P.bright, { uTex: [0, MV.sceneFBO.tex], uThresh: 0.62 });
  // blur A
  blurPass(MV, MV.bloomA, MV.bloomB, [1, 0]);
  blurPass(MV, MV.bloomB, MV.bloomA, [0, 1]);
  // downsample to C
  gl.bindFramebuffer(gl.FRAMEBUFFER, MV.bloomC.fbo);
  gl.viewport(0, 0, MV.bloomC.w, MV.bloomC.h);
  P_draw(MV, MV.P.blur, { uTex: [0, MV.bloomA.tex], uDir: [0, 0], uTexel: [1 / MV.bloomA.w, 1 / MV.bloomA.h] });
  blurPass(MV, MV.bloomC, MV.bloomD, [1, 0]);
  blurPass(MV, MV.bloomD, MV.bloomC, [0, 1]);

  // composite into outFBO (reliable for readPixels), then copy to canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, MV.outFBO.fbo);
  gl.viewport(0, 0, W, H);
  let light = [0.5, 0.45];
  if (MV.corePos) { const p = project(MV, MV.corePos); if (p) light = [p[0] / W, 1 - p[1] / H]; }
  const beat = MV.beatEnv;
  const use = MV.P.comp;
  MV.P.drawFS(use, un => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, MV.sceneFBO.tex); gl.uniform1i(un.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, MV.bloomA.tex); gl.uniform1i(un.uBloomA, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, MV.bloomC.tex); gl.uniform1i(un.uBloomC, 2);
    gl.uniform2f(un.uRes, W, H);
    gl.uniform1f(un.uFrame, frame % 997);
    gl.uniform1f(un.uAber, 0.0012 + 0.010 * beat + (MV.fx.glitch || 0) * 0.02);
    gl.uniform1f(un.uGrain, 0.045);
    gl.uniform1f(un.uVig, MV.fx.vig || 0.5);
    gl.uniform1f(un.uBloom, (MV.fx.bloom || 0.8) * 0.85);
    gl.uniform1f(un.uRays, MV.fx.rays || 0);
    gl.uniform2f(un.uLight, light[0], light[1]);
    gl.uniform1f(un.uFlash, clamp(MV.fx.flash || 0, 0, 1));
    gl.uniform1f(un.uExpo, (MV.fx.expo || 1.0) * (1 - (MV.fx.glitch || 0) * 0.1 * h1(frame)));
    gl.uniform1f(un.uScan, MV.fx.scan || 0);
    gl.uniform3f(un.uTint, MV.fx.tint[0], MV.fx.tint[1], MV.fx.tint[2]);
    gl.uniform1f(un.uTintAmt, MV.fx.tintAmt || 0);
    gl.uniform1f(un.uSharp, 0);
  });
  // blit outFBO -> default framebuffer so the visible canvas matches the encoded frame
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(MV.P.quad.prog);
  gl.uniformMatrix4fv(MV.P.quad.uni.uMat, false, MV._blitMat);
  gl.uniform4f(MV.P.quad.uni.uCol, 1, 1, 1, 1);
  gl.uniform1i(MV.P.quad.uni.uShape, 0);
  gl.uniform1i(MV.P.quad.uni.uUseTex, 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, MV.outFBO.tex); gl.uniform1i(MV.P.quad.uni.uTex, 0);
  gl.bindVertexArray(MV.P.quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);
};

function P_draw(MV, prog, set) {
  const gl = MV.gl;
  gl.useProgram(prog.prog);
  for (const k in set) {
    const v = set[k];
    if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' && v.length === 2 && k === 'uTex') { /* noop */ }
  }
  // simple assignment (uTex special-cased above)
  if (set.uTex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, set.uTex[1]); gl.uniform1i(prog.uni.uTex, 0); }
  if (set.uThresh !== undefined) gl.uniform1f(prog.uni.uThresh, set.uThresh);
  if (set.uDir !== undefined) gl.uniform2f(prog.uni.uDir, set.uDir[0], set.uDir[1]);
  if (set.uTexel !== undefined) gl.uniform2f(prog.uni.uTexel, set.uTexel[0], set.uTexel[1]);
  MV.P.drawFS(prog, null);
}

function blurPass(MV, src, dst, dir) {
  const gl = MV.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
  gl.viewport(0, 0, dst.w, dst.h);
  P_draw(MV, MV.P.blur, { uTex: [0, src.tex], uDir: dir, uTexel: [1 / src.w, 1 / src.h] });
}

MV.readPixelsRGBA = function () {
  const gl = MV.gl;
  const buf = new Uint8Array(MV.W * MV.H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, MV.outFBO.fbo);
  gl.readPixels(0, 0, MV.W, MV.H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return buf;
};

if (typeof module !== 'undefined') module.exports = MV;
