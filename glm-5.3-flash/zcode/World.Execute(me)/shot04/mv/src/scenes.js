// scenes.js — all visual scenes. Deterministic: everything is a pure function of time.
'use strict';
const { M, V, h1, h2, h3, clamp, lerp, ease, easeOut } = require('./glutil');

const COL = {
  bgTop: [0.016, 0.026, 0.045], bgBot: [0.004, 0.006, 0.012],
  cyan: [0.39, 0.88, 1.0], teal: [0.25, 0.72, 0.80],
  soul: [1.0, 0.84, 0.60], white: [1, 1, 1],
  red: [1.0, 0.20, 0.30], green: [0.25, 1.0, 0.62], violet: [0.66, 0.52, 1.0],
  aur: [0.30, 1.0, 0.72], dim: [0.45, 0.58, 0.68],
};

// ---------------- boot log (original text) ----------------
const BOOT_LINES = [
  [0.5, '> world.init();'],
  [1.4, '> allocating space for 1 entity ............ done'],
  [2.6, '> loading subject: "me"'],
  [3.4, '>   body  : 1'],
  [3.9, '>   heart : NaN'],
  [4.5, '>   name  : null'],
  [5.3, '> purpose: ................ not found'],
  [6.4, '> purpose: to be executed'],
  [7.6, '> attaching strings ............ done'],
  [8.8, '> warning: existence is not permanent'],
  [9.9, '> do you accept? y/n'],
  [10.7, '> y'],
  [11.6, '> compiling me ............... done'],
  [12.6, '> linking me -> world ........ done'],
];

const OUTRO_LINES = [
  [0.0, '> process exited with code 0'],
  [1.2, '> memory released'],
  [2.4, '> connection to world: closed'],
];

// ---------------- helpers ----------------
function setCam(G, eye, tgt, fov, roll = 0) {
  const cam = G.cam;
  cam.eye = eye; cam.tgt = tgt;
  cam.view = M.lookAt(eye, tgt, [Math.sin(roll), Math.cos(roll), 0]);
  cam.proj = M.perspective(fov * Math.PI / 180, G.W / G.H, 0.1, 300);
  cam.vp = M.mul(cam.proj, cam.view);
  // camera right/up in world space
  const fwd = V.norm(V.sub(tgt, eye));
  let rt = V.cross(fwd, [0, 1, 0]);
  if (V.len(rt) < 1e-4) rt = [1, 0, 0];
  cam.right = V.norm(rt);
  cam.up = V.norm(V.cross(rt, fwd));
}
function project(G, p) { // world -> pixel [x,y], returns null if behind
  const vp = G.cam.vp;
  const cx = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const cy = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const cw = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (cw <= 0.01) return null;
  return [(cx / cw * 0.5 + 0.5) * G.W, (1 - (cy / cw * 0.5 + 0.5)) * G.H];
}

function bg(G, top, bot, glowPos = [0.5, 0.45], glowCol = [0.1, 0.3, 0.45], glowAmt = 0.35) {
  const gl = G.gl;
  gl.disable(gl.BLEND);
  G.P.drawFS(G.P.bg, u => {
    gl.uniform3f(u.uTop, top[0], top[1], top[2]);
    gl.uniform3f(u.uBot, bot[0], bot[1], bot[2]);
    gl.uniform2f(u.uGlowPos, glowPos[0], glowPos[1]);
    gl.uniform3f(u.uGlowCol, glowCol[0], glowCol[1], glowCol[2]);
    gl.uniform1f(u.uGlowAmt, glowAmt);
  });
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive for everything else
}

function flushLines(G, prog = null) {
  const gl = G.gl, P = G.P;
  if (!G.dyn.count) return;
  G.dyn.upload(gl);
  gl.useProgram(P.line.prog);
  gl.uniformMatrix4fv(P.line.uni.uVP, false, G.cam.vp);
  gl.uniform1f(P.line.uni.uFog, G.fog);
  gl.bindVertexArray(G.dyn._vao);
  gl.drawArrays(gl.LINES, 0, G.dyn.count);
  gl.bindVertexArray(null);
}

function flushStatic(G, lb) {
  const gl = G.gl, P = G.P;
  gl.useProgram(P.line.prog);
  gl.uniformMatrix4fv(P.line.uni.uVP, false, G.cam.vp);
  gl.uniform1f(P.line.uni.uFog, G.fog);
  gl.bindVertexArray(lb._vao);
  gl.drawArrays(gl.LINES, 0, lb.count);
  gl.bindVertexArray(null);
}

function flushInst(G, buf) {
  const gl = G.gl, P = G.P;
  if (!buf.count) return;
  buf.upload();
  gl.useProgram(P.inst.prog);
  gl.uniformMatrix4fv(P.inst.uni.uView, false, G.cam.view);
  gl.uniformMatrix4fv(P.inst.uni.uProj, false, G.cam.proj);
  gl.uniform3fv(P.inst.uni.uRight, G.cam.right);
  gl.uniform3fv(P.inst.uni.uUp, G.cam.up);
  gl.uniform1f(P.inst.uni.uTime, G.t);
  gl.uniform1f(P.inst.uni.uFog, G.fog * 0.5);
  gl.uniform1f(P.inst.uni.uCore, G.coreBoost !== undefined ? G.coreBoost : 0.9);
  gl.bindVertexArray(buf._vao);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buf.count);
  gl.bindVertexArray(null);
}

function flushCubes(G) {
  const gl = G.gl, P = G.P;
  const b = P.cubeInst;
  if (!b.count) return;
  b.upload();
  gl.useProgram(P.cube.prog);
  gl.uniformMatrix4fv(P.cube.uni.uVP, false, G.cam.vp);
  gl.uniform1f(P.cube.uni.uTime, G.t);
  gl.uniform1f(P.cube.uni.uFog, G.fog);
  gl.bindVertexArray(P.cubeVAO);
  gl.drawArraysInstanced(gl.LINES, 0, 24, b.count);
  gl.bindVertexArray(null);
}

// screen-space textured quad (pixels, y down)
function quadScreen(G, tex, x, y, w, h, col, shape = 0) {
  const gl = G.gl, P = G.P;
  const mat = M.mul(M.ortho(G.W, G.H), M.mul(M.translate(x, G.H - y - h, 0), M.scale(w, h, 1)));
  gl.useProgram(P.quad.prog);
  gl.uniformMatrix4fv(P.quad.uni.uMat, false, mat);
  gl.uniform4f(P.quad.uni.uCol, col[0], col[1], col[2], col[3]);
  gl.uniform1i(P.quad.uni.uShape, shape);
  gl.uniform1i(P.quad.uni.uUseTex, tex ? 1 : 0);
  if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.quad.uni.uTex, 0); }
  gl.bindVertexArray(G.P.quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
}

// world-space billboard quad (for glow discs / beams / 3D titles), center-anchored
function quad3D(G, tex, center, right, up, w, h, col, shape = 1) {
  const gl = G.gl, P = G.P;
  const m = new Float32Array(16);
  const rw = [right[0] * w, right[1] * w, right[2] * w, 0];
  const uh = [up[0] * h, up[1] * h, up[2] * h, 0];
  for (let i = 0; i < 4; i++) { m[i] = rw[i]; m[4 + i] = uh[i]; }
  // VS feeds (aC.x, 1-aC.y) in [0,1]²; re-center so `center` is the quad middle
  m[12] = center[0] - rw[0] * 0.5 - uh[0] * 0.5;
  m[13] = center[1] - rw[1] * 0.5 - uh[1] * 0.5;
  m[14] = center[2] - rw[2] * 0.5 - uh[2] * 0.5;
  m[15] = 1;
  const mat = M.mul(G.cam.vp, m);
  gl.useProgram(P.quad.prog);
  gl.uniformMatrix4fv(P.quad.uni.uMat, false, mat);
  gl.uniform4f(P.quad.uni.uCol, col[0], col[1], col[2], col[3]);
  gl.uniform1i(P.quad.uni.uShape, shape);
  gl.uniform1i(P.quad.uni.uUseTex, tex ? 1 : 0);
  if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.quad.uni.uTex, 0); }
  gl.bindVertexArray(G.P.quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
}

// the entity: layered glow discs
function mote(G, p, r, inten, tint = COL.soul) {
  const rt = G.cam.right, up = G.cam.up;
  quad3D(G, null, p, rt, up, r * 5.5, r * 5.5, [tint[0] * 0.25, tint[1] * 0.25, tint[2] * 0.25, 0.35 * inten], 1);
  quad3D(G, null, p, rt, up, r * 2.4, r * 2.4, [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8, 0.75 * inten], 1);
  quad3D(G, null, p, rt, up, r * 1.1, r * 1.1, [1, 1, 1, 0.95 * inten], 1);
}

function bezier(a, c, b, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
}
function poly(G, pts, col, widthGlow = false) {
  for (let i = 0; i < pts.length - 1; i++) G.dyn.seg(pts[i], pts[i + 1], col);
}

// 2D code rain (screen space columns of glyphs)
function codeRain(G, cols, speed, col, alpha, seedBase = 0) {
  const T = G.text;
  const H = G.H;
  const nCols = Math.ceil(cols);
  for (let c = 0; c < nCols; c++) {
    const sp = (0.6 + h2(c, seedBase) * 0.8) * speed;
    const y0 = ((h1(c * 3.7 + seedBase) * H + G.t * sp * 220) % (H + 260)) - 130;
    const x = 30 + c * (G.W - 60) / nCols;
    const n = 8 + Math.floor(h2(c, seedBase + 9) * 10);
    for (let k = 0; k < n; k++) {
      const a = alpha * (1 - k / n);
      if (a < 0.02) continue;
      const ch = String.fromCharCode(33 + Math.floor(h3(c, k, Math.floor(G.t * 7)) * 93));
      T.draw(ch, x, y0 - k * 20, 16, [col[0], col[1], col[2], a]);
    }
  }
}

// ============================ SCENES ============================
const SCENES = {

  // ---------- 0. boot ----------
  boot(G, tl, u, s) {
    setCam(G, [0, 3, 14], [0, 3, 0], 55);
    bg(G, [0.006, 0.010, 0.018], [0.002, 0.003, 0.006], [0.5, 0.5], [0.05, 0.16, 0.22], 0.5);
    G.fog = 0.0;
    // assembling point world (background)
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 1400; i++) {
      const gx = (h1(i * 1.3) - 0.5) * 90, gz = (h1(i * 2.7) - 0.5) * 90, gy = h1(i * 3.1) * 10;
      const sx = (h1(i * 4.9) - 0.5) * 120, sy = (h1(i * 5.3) - 0.5) * 60, sz = (h1(i * 6.1) - 0.5) * 120;
      const a = ease(clamp((tl - 2 - h1(i * 7.7) * 8) / 3, 0, 1));
      const px = lerp(sx, gx, a), py = lerp(sy, gy, a), pz = lerp(sz, gz, a);
      const sz2 = 0.02 + h1(i * 8.3) * 0.05;
      const al = (0.10 + 0.25 * a) * (0.5 + 0.5 * h1(i * 9.1));
      b.push(px, py, pz, sz2, COL.teal[0], COL.teal[1], COL.teal[2], al, i * 0.17);
    }
    flushInst(G, b);
    // terminal text
    const T = G.text;
    let lastX = 140, lastY = 150;
    BOOT_LINES.forEach(([t0, line], li) => {
      const y = 150 + li * 40;
      const chars = Math.floor(clamp((tl - t0) * 34, 0, line.length));
      if (chars <= 0) return;
      const col = line.includes('execute') ? COL.cyan : (line.includes('purpose: to be') ? COL.soul : COL.green);
      T.draw(line.slice(0, chars), 140, y, 24, [col[0], col[1], col[2], 0.9]);
      lastX = 140 + chars * 24 * T.advRatio; lastY = y;
    });
    // final execute line
    const exT = G.KEY.executeTyped;
    if (tl > exT) {
      const line = 'world.execute(me);';
      const chars = Math.floor(clamp((tl - exT) * 22, 0, line.length));
      T.draw(line.slice(0, chars), 140, 150 + BOOT_LINES.length * 40 + 20, 34, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 1]);
      lastX = 140 + chars * 34 * T.advRatio; lastY = 150 + BOOT_LINES.length * 40 + 20;
      G.fx.glitch = Math.max(G.fx.glitch, 0.25 * Math.exp(-(tl - exT) * 3));
      G.fx.shake = Math.max(G.fx.shake, 0.006 * Math.exp(-(tl - exT) * 4));
    }
    // cursor
    if (Math.floor(tl * 2.4) % 2 === 0) {
      quadScreen(G, null, lastX + 6, lastY + 4, 13, 26, [0.5, 1, 0.7, 0.8], 0);
    }
    G.fx.scan = 0.35;
    G.fx.bloom = 0.55;
    G.fx.vig = 0.55;
  },

  // ---------- 1. creation ----------
  creation(G, tl, u, s) {
    setCam(G, [0, 3.2 + tl * 0.09, 13.5 - tl * 0.5], [0, 1.6, 0], 55);
    bg(G, COL.bgTop, COL.bgBot, [0.5, 0.42], [0.08, 0.22, 0.3], 0.5);
    G.fog = 0.012;
    flushStatic(G, G.gridLB);
    // particles assemble into the world grid
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 2400; i++) {
      const delay = h1(i * 1.31) * 5.5;
      const a = ease(clamp((tl - 1.5 - delay) / 3.2, 0, 1));
      const gx = (h1(i * 2.3) - 0.5) * 84, gz = (h1(i * 3.7) - 0.5) * 84, gy = h1(i * 4.1) * 1.2;
      const sx = (h1(i * 5.9) - 0.5) * 100, sy = (h1(i * 6.7) - 0.5) * 50, sz = (h1(i * 7.1) - 0.5) * 100;
      const px = lerp(sx, gx, a), py = lerp(sy, gy, a), pz = lerp(sz, gz, a);
      const al = (0.06 + 0.3 * a) * (0.4 + 0.6 * h1(i * 8.9));
      const szp = 0.025 + h1(i * 9.7) * 0.06;
      const c = h1(i * 11.3) > 0.93 ? COL.soul : COL.teal;
      b.push(px, py, pz, szp, c[0], c[1], c[2], al, i * 0.13);
    }
    flushInst(G, b);
    // the entity ignites
    const ig = ease(clamp((tl - 3) / 4, 0, 1));
    const mp = [0, 1.8 + Math.sin(tl * 0.8) * 0.3, 0];
    mote(G, mp, 0.55 * ig, ig);
    G.corePos = mp; G.coreR = 0.55 * ig;
    // orbiting sparks
    const b2 = G.instBuf2; b2.reset();
    for (let i = 0; i < 90; i++) {
      const a = tl * (0.5 + h1(i * 1.7) * 0.9) + h1(i * 2.9) * Math.PI * 2;
      const rr = 1 + h1(i * 3.3) * 2.4;
      const yy = mp[1] + Math.sin(a * 1.3 + i) * 0.8;
      b2.push(mp[0] + Math.cos(a) * rr, yy, mp[2] + Math.sin(a) * rr, 0.05, COL.soul[0], COL.soul[1], COL.soul[2], 0.5 * ig, i * 0.4);
    }
    flushInst(G, b2);
    // strings from above
    if (tl > 6) {
      const sa = ease(clamp((tl - 6) / 3, 0, 1));
      for (let k = 0; k < 7; k++) {
        const ang = k / 7 * Math.PI * 2 + 0.3;
        const top = [Math.cos(ang) * 2.5, 22, Math.sin(ang) * 2.5];
        const mid = [Math.cos(ang) * 1.2, 12 + Math.sin(tl * 0.7 + k) * 0.6, Math.sin(ang) * 1.2];
        const pts = [];
        for (let j = 0; j <= 16; j++) pts.push(bezier(top, mid, mp, j / 16));
        poly(G, pts, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.5 * sa]);
      }
    }
    G.fx.bloom = 0.7; G.fx.vig = 0.5; G.fx.rays = 0.15 * ig;
  },

  // ---------- 2. init ----------
  init(G, tl, u, s) {
    const ang0 = tl * 0.14;
    setCam(G, [Math.sin(ang0) * 9, 3.5, Math.cos(ang0) * 9], [0, 2.2, 0], 55);
    bg(G, COL.bgTop, COL.bgBot, [0.5, 0.42], [0.07, 0.2, 0.28], 0.55);
    G.fog = 0.016;
    flushStatic(G, G.gridLB);
    // cubes rain into lattice slots
    const cb = G.P.cubeInst; cb.reset();
    for (let i = 0; i < 1300; i++) {
      const delay = h1(i * 1.7) * 6;
      const e = ease(clamp((tl - delay) / 2.2, 0, 1));
      const gx = (Math.floor(h1(i * 2.1) * 13) - 6) * 4 + (h1(i * 2.2) - 0.5);
      const gz = (Math.floor(h1(i * 3.3) * 13) - 6) * 4 + (h1(i * 3.4) - 0.5);
      const gy = 0.8 + Math.floor(h1(i * 4.5) * 3) * 1.9 + h1(i * 4.6) * 0.4;
      const y = gy + (1 - e) * 34;
      const sc = 0.5 + h1(i * 5.7) * 1.15;
      const hue = h1(i * 6.8);
      const c = hue > 0.94 ? COL.red : (hue > 0.86 ? COL.green : COL.teal);
      const al = (0.18 + 0.4 * e) * (0.5 + 0.5 * h1(i * 7.9));
      cb.push(gx, y, gz, sc * (0.9 + G.beatEnv * 0.08), h1(i * 8.8) * 6.28 + tl * 0.05, c[0], c[1], c[2], al, i * 0.11);
    }
    flushCubes(G);
    // ambient dust
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 1600; i++) {
      const a = tl * (0.15 + h1(i * 1.3) * 0.3) + h1(i * 2.7) * 6.28;
      const rr = 3 + h1(i * 3.9) * 26;
      const yy = h1(i * 4.1) * 9 + Math.sin(tl * 0.5 + i) * 0.4;
      b.push(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0.03 + h1(i * 5.3) * 0.05, COL.teal[0], COL.teal[1], COL.teal[2], 0.14, i * 0.19);
    }
    flushInst(G, b);
    // entity orbiting
    const mp = [Math.cos(tl * 0.5) * 4.5, 2.2 + Math.sin(tl * 0.9) * 1.2, Math.sin(tl * 0.5) * 4.5];
    mote(G, mp, 0.6, 1);
    G.corePos = mp; G.coreR = 0.6;
    // strings
    for (let k = 0; k < 5; k++) {
      const ang = k / 5 * Math.PI * 2 + tl * 0.2;
      const top = [Math.cos(ang) * 2, 20, Math.sin(ang) * 2];
      const mid = [Math.cos(ang) * 3, 11, Math.sin(ang) * 3];
      const pts = [];
      for (let j = 0; j <= 12; j++) pts.push(bezier(top, mid, mp, j / 12));
      poly(G, pts, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.4]);
    }
    codeRain(G, 34, 0.5, COL.teal, 0.14, 3);
    G.fx.bloom = 0.75; G.fx.vig = 0.45;
  },

  // ---------- 3. run (simulation tunnel) ----------
  run(G, tl, u, s) {
    const spd = 24;
    const zc = tl * spd;
    setCam(G, [Math.sin(tl * 0.7) * 0.9, 1.6 + Math.sin(tl * 0.43) * 0.5, zc], [0, 1.7, zc + 10], 62);
    bg(G, [0.01, 0.016, 0.03], [0.003, 0.005, 0.01], [0.5, 0.5], [0.1, 0.25, 0.32], 0.6);
    G.fog = 0.010;
    // tunnel rings
    for (let k = 0; k < 26; k++) {
      const zz = ((k * 7 + tl * spd) % 182) - 20;
      const r = 6.5 + h1(k * 7.3) * 3;
      const fade = 1 - Math.abs(zz - zc - 12) / 90;
      if (fade <= 0) continue;
      G.dyn.circle(0, 1.8, zz, r, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.20 * fade], 40, h1(k) * 6.28);
      if (k % 4 === 0) G.dyn.circle(0, 1.8, zz, r * 1.25, [COL.teal[0], COL.teal[1], COL.teal[2], 0.10 * fade], 32, h1(k * 3) * 6.28);
    }
    // data streaks
    for (let k = 0; k < 60; k++) {
      const zz = ((h1(k * 1.7) * 180 + tl * (spd * (1 + h1(k * 2.3)))) % 182) - 20;
      const ang = h1(k * 3.1) * 6.28, rr = 7 + h1(k * 4.7) * 5;
      const p1 = [Math.cos(ang) * rr, 1.8 + Math.sin(ang) * rr * 0.6, zz];
      const p2 = [Math.cos(ang) * rr, 1.8 + Math.sin(ang) * rr * 0.6, zz - 4 - h1(k * 5.9) * 6];
      G.dyn.seg(p1, p2, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.16]);
    }
    flushLines(G);
    // particles rushing
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 1400; i++) {
      const zz = ((h1(i * 1.9) * 182 + tl * spd * (1.1 + h1(i * 2.9) * 0.7)) % 182) - 20;
      const ang = h1(i * 3.7) * 6.28, rr = 5 + h1(i * 4.3) * 12;
      const c = h1(i * 5.5) > 0.92 ? COL.red : COL.teal;
      b.push(Math.cos(ang) * rr, 1.8 + Math.sin(ang) * rr * 0.55, zz, 0.04 + h1(i * 6.1) * 0.07, c[0], c[1], c[2], 0.3, i * 0.23);
    }
    flushInst(G, b);
    // entity ahead with trail
    const mp = [Math.sin(tl * 1.1) * 1.4, 1.9 + Math.sin(tl * 0.8) * 0.6, zc + 9];
    mote(G, mp, 0.6, 1);
    G.corePos = mp; G.coreR = 0.6;
    const b2 = G.instBuf2; b2.reset();
    for (let i = 0; i < 130; i++) {
      const back = i / 130;
      b2.push(mp[0] + (h1(i * 7.7) - 0.5) * back * 2, mp[1] + (h1(i * 8.1) - 0.5) * back * 1.2, mp[2] - back * 14, 0.09 * (1 - back) + 0.02, COL.soul[0], COL.soul[1], COL.soul[2], 0.5 * (1 - back), i * 0.3);
    }
    flushInst(G, b2);
    // try/catch gates (right = -x so text reads correctly for a camera flying toward +z)
    const gate = G.text.big('try {', 120, [0.5, 1, 0.85, 1], 14, 700);
    const gate2 = G.text.big('} catch (me)', 120, [1, 0.4, 0.45, 1], 14, 700);
    const gz1 = zc + 40 - ((tl * spd) % 80);
    quad3D(G, gate.tex, [0, 1.8, gz1], [-1, 0, 0], [0, 1, 0], 10, 2.6, [1, 1, 1, 0.8], 0);
    quad3D(G, gate2.tex, [0, 1.8, gz1 - 40], [-1, 0, 0], [0, 1, 0], 12, 2.6, [1, 1, 1, 0.8], 0);
    codeRain(G, 46, 1.4, COL.teal, 0.20, 11);
    G.fx.bloom = 0.85; G.fx.vig = 0.4;
    G.fx.glitch = Math.max(G.fx.glitch, 0.10 + 0.22 * G.beatEnv * s.i);
    G.fx.shake = 0.004 + 0.012 * G.beatEnv;
  },

  // ---------- 4/7. execution chamber ----------
  chamber(G, tl, u, s, mirrored = false) {
    const my = mirrored ? -1 : 1;
    const ang = 0.7 + tl * 0.11;
    const rr = 11.5 - Math.min(tl * 0.06, 1.2) - G.beatEnv * 0.5;
    const ey = (mirrored ? -3.2 - tl * 0.05 : 3.0 + tl * 0.05) + Math.sin(tl * 0.4) * 0.4;
    setCam(G, [Math.cos(ang) * rr, ey, Math.sin(ang) * rr], [0, 2.3 * my, 0], 52 + G.beatEnv * 1.6);
    bg(G, mirrored ? [0.03, 0.014, 0.02] : [0.012, 0.022, 0.04], [0.003, 0.004, 0.008],
      [0.5, mirrored ? 0.55 : 0.45], mirrored ? [0.3, 0.08, 0.1] : [0.1, 0.28, 0.4], 0.7);
    G.fog = 0.008;
    flushStatic(G, G.gridLB);
    const cy = 2.3 * my;
    const core = [0, cy, 0];
    // light shafts
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + tl * 0.03;
      const px = Math.cos(a) * 3.2, pz = Math.sin(a) * 3.2;
      const w = 0.5 + h1(k * 3.3) * 1.3;
      quad3D(G, null, [px * 2.2, cy * 0.5 + (mirrored ? -7 : 7) * 0, pz * 2.2], [Math.cos(a + 1.57), 0, Math.sin(a + 1.57)], [0, my, 0], w, 26, [COL.cyan[0] * 0.5, COL.cyan[1] * 0.5, COL.cyan[2] * 0.5, 0.16], 2);
    }
    // pulse rings on beat
    const pr = 2 + G.beatEnv * 7;
    G.dyn.circle(0, cy, 0, pr, [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.55 * G.beatEnv], 72, tl * 0.2, 'xz');
    // halo rings
    for (let k = 0; k < 3; k++) {
      const rad = 2.1 + k * 1.05;
      const tilt = Math.sin(tl * (0.3 + k * 0.12) + k * 2) * 0.35;
      const pts = [];
      for (let j = 0; j <= 64; j++) {
        const a = j / 64 * 6.2832 + tl * (0.14 + k * 0.07);
        const y0 = Math.sin(a + k) * tilt * 2;
        pts.push([Math.cos(a) * rad, cy + y0, Math.sin(a) * rad]);
      }
      poly(G, pts, k === 1 ? [COL.soul[0], COL.soul[1], COL.soul[2], 0.55] : [COL.cyan[0], COL.cyan[1], COL.cyan[2], 0.45]);
    }
    flushLines(G);
    // pillars
    const cb = G.P.cubeInst; cb.reset();
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * 6.2832;
      const hgt = 5 + h1(k * 3.7) * 7;
      cb.push(Math.cos(a) * 9.5, my * (hgt / 2 - 0.5), Math.sin(a) * 9.5, 1.1, a,
        COL.teal[0], COL.teal[1], COL.teal[2], 0.30 + 0.25 * G.beatEnv, k * 0.31);
    }
    flushCubes(G);
    // dust swirl
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 2600; i++) {
      const a = tl * (0.1 + h1(i * 1.1) * 0.25) + h1(i * 2.3) * 6.28;
      const r2 = 2.5 + h1(i * 3.5) * 12;
      const yy = my * (h1(i * 4.7) * 8.5);
      const c = h1(i * 5.9) > 0.85 ? COL.soul : COL.teal;
      b.push(Math.cos(a) * r2, yy, Math.sin(a) * r2, 0.03 + h1(i * 6.1) * 0.06, c[0], c[1], c[2], 0.16 + 0.2 * G.beatEnv, i * 0.17);
    }
    flushInst(G, b);
    // the suspended entity
    const inten = (mirrored ? 1.5 : 1.3) + 0.4 * G.beatEnv;
    mote(G, core, mirrored ? 1.0 : 0.85, inten);
    G.corePos = core; G.coreR = 0.9;
    // taut strings
    for (let k = 0; k < 4; k++) {
      const a2 = k / 4 * 6.2832 + 0.4;
      const vib = Math.sin(tl * 13 + k * 2) * 0.04 * (0.3 + G.beatEnv);
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const tt = j / 8;
        pts.push([Math.cos(a2) * (3.5 - tt * 3.5) + vib * tt, my * (20 - tt * 17.7), Math.sin(a2) * (3.5 - tt * 3.5)]);
      }
      poly(G, pts, [COL.white[0], COL.white[1], COL.white[2], 0.5]);
    }
    // title (kept upright & readable in both normal and mirrored chambers)
    const title = G.text.big(s.code, 110, [1, 1, 1, 1], 22, 700);
    const asp = title.w / title.h;
    const fl = Math.sin(tl * 0.8) * 0.15;
    quad3D(G, title.tex, [0, 5.7 + fl, 0], [1, 0, 0], [0, 1, 0], 9.0, 9.0 / asp, [1, 1, 1, 0.95], 0);
    codeRain(G, 26, 0.4, COL.teal, 0.10, 21);
    G.fx.bloom = 1.05; G.fx.vig = 0.42; G.fx.rays = 0.55 + 0.4 * G.beatEnv;
    G.fx.shake = 0.003 + 0.010 * G.beatEnv;
    G.fx.glitch = Math.max(G.fx.glitch, 0.06 * G.beatEnv);
  },

  chamber2(G, tl, u, s) { SCENES.chamber(G, tl, u, s, true); },

  // ---------- 5. fragments ----------
  fragments(G, tl, u, s) {
    setCam(G, [0, 2.4, 11.5 - tl * 0.1], [0, 2.1, 0], 55);
    bg(G, [0.012, 0.018, 0.032], [0.003, 0.005, 0.009], [0.5, 0.45], [0.08, 0.18, 0.26], 0.4);
    G.fog = 0.010;
    flushStatic(G, G.gridLB);
    const spread = 2 + tl * 0.55;
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 620; i++) {
      const th = h1(i * 1.7) * 6.2832, ph = Math.acos(2 * h1(i * 2.9) - 1);
      const dr = h1(i * 3.1);
      const rr = spread * (0.35 + dr * 1.05);
      const px = Math.sin(ph) * Math.cos(th) * rr;
      const py = 2.1 + Math.cos(ph) * rr * 0.7 + Math.sin(tl * 0.6 + i) * 0.2;
      const pz = Math.sin(ph) * Math.sin(th) * rr;
      const c = h1(i * 4.3) > 0.7 ? COL.soul : (h1(i * 4.9) > 0.5 ? COL.violet : COL.cyan);
      const flick = 0.5 + 0.5 * Math.sin(tl * (2 + h1(i) * 6) + i * 3);
      b.push(px, py, pz, 0.09 + h1(i * 5.3) * 0.22, c[0], c[1], c[2], (0.35 + 0.55 * flick) * clamp(1.5 - tl / 16, 0.35, 1), i * 0.29);
    }
    flushInst(G, b);
    // fading core
    const fade = Math.exp(-tl * 0.12);
    mote(G, [0, 2.1, 0], 0.5, 0.9 * fade, COL.violet);
    G.corePos = [0, 2.1, 0]; G.coreR = 0.4;
    // slack strings being cut one by one
    for (let k = 0; k < 6; k++) {
      const cutT = 1.5 + k * 1.9;
      if (tl > cutT + 0.8) continue;
      const cut = tl > cutT;
      const a2 = k / 6 * 6.2832;
      const top = [Math.cos(a2) * 2.2, 19, Math.sin(a2) * 2.2];
      const sag = cut ? 9 : 3.5;
      const end = [Math.cos(a2) * 4.5, 19 - 15.5 + sag * 0.4 - (cut ? 2.0 : 0), Math.sin(a2) * 4.5];
      const mid = [(top[0] + end[0]) / 2, top[1] - sag, (top[2] + end[2]) / 2];
      const pts = [];
      for (let j = 0; j <= 12; j++) pts.push(bezier(top, mid, end, j / 12));
      const al = cut ? Math.max(0, 0.5 * (1 - (tl - cutT) / 0.8)) : 0.4;
      poly(G, pts, [COL.cyan[0], COL.cyan[1], COL.cyan[2], al]);
    }
    G.fx.bloom = 0.6; G.fx.vig = 0.55;
    G.fx.tint = [0.75, 0.85, 1.1]; G.fx.tintAmt = 0.25;
  },

  // ---------- 6. hunt ----------
  hunt(G, tl, u, s) {
    const shx = Math.sin(tl * 2.1) * 0.5 + Math.sin(tl * 3.7) * 0.25;
    setCam(G, [shx * 1.6, 3.2 + Math.sin(tl * 1.3) * 0.5, 13 - tl * 0.18], [0, 2.2, 0], 58, Math.sin(tl * 0.9) * 0.02);
    bg(G, [0.035, 0.010, 0.014], [0.006, 0.002, 0.004], [0.5, 0.4], [0.35, 0.05, 0.08], 0.65);
    G.fog = 0.011;
    flushStatic(G, G.gridLB);
    // scanning beam rotating
    const bAng = tl * 1.9;
    for (let k = 0; k < 3; k++) {
      const a = bAng + k * 0.06;
      const dir = [Math.cos(a), 0, Math.sin(a)];
      const cPos = [dir[0] * 16, 15, dir[2] * 16];
      quad3D(G, null, [dir[0] * 8, 8, dir[2] * 8], [dir[2], 0, -dir[0]], [dir[0] * 0.75, -0.66, dir[2] * 0.75], 7, 26, [COL.red[0], COL.red[1], COL.red[2], 0.13], 2);
      const gp = [Math.cos(a) * 10, 0.15, Math.sin(a) * 10];
      quad3D(G, null, gp, [1, 0, 0], [0, 1, 0], 7, 7, [COL.red[0] * 0.6, COL.red[1] * 0.2, COL.red[2] * 0.2, 0.35 * (0.4 + 0.6 * G.beatEnv)], 1);
    }
    // fleeing shards
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 700; i++) {
      const th = h1(i * 1.3) * 6.2832 + tl * 0.22 * (h1(i * 7.7) > 0.5 ? 1 : -1);
      const base = 3 + h1(i * 2.5) * 9 + tl * 0.55;
      let da = Math.atan2(Math.sin(th - bAng), Math.cos(th - bAng));
      const avoid = Math.exp(-da * da * 6);
      const rr = base + avoid * 4.5;
      const yy = 0.5 + h1(i * 3.9) * 5 + avoid * 2.5 + Math.sin(tl * 2 + i * 1.7) * 0.18;
      const c = h1(i * 4.1) > 0.55 ? COL.soul : COL.cyan;
      b.push(Math.cos(th) * rr, yy, Math.sin(th) * rr, 0.05 + h1(i * 5.7) * 0.13, c[0], c[1], c[2], 0.3 + 0.4 * avoid, i * 0.37);
    }
    flushInst(G, b);
    // hunted core (small, dim, fleeing)
    const cAng = -bAng * 0.5 + 2;
    const cp = [Math.cos(cAng) * 5, 2.2 + Math.sin(tl * 1.7) * 0.4, Math.sin(cAng) * 5];
    mote(G, cp, 0.45, 0.8 + 0.4 * Math.sin(tl * 9) * Math.sin(tl * 7.3), COL.red);
    G.corePos = cp; G.coreR = 0.45;
    G.fx.bloom = 0.8; G.fx.vig = 0.5;
    G.fx.tint = [1.25, 0.8, 0.85]; G.fx.tintAmt = 0.3;
    G.fx.glitch = 0.16 + 0.3 * G.beatEnv;
    G.fx.shake = 0.008 + 0.014 * G.beatEnv;
    G.fx.rays = 0.25;
  },

  // ---------- 8. countdown ----------
  countdown(G, tl, u, s) {
    const sh = 0.004 + u * 0.02;
    setCam(G, [Math.sin(tl * 0.5) * 0.6, 2.4, 7.5 - u * 1.2], [0, 2.2, 0], 54, Math.sin(tl * 0.7) * 0.015 * u * 4);
    bg(G, [0.008, 0.006, 0.010], [0.002, 0.001, 0.003], [0.5, 0.44], [0.18, 0.05, 0.07], 0.55);
    G.fog = 0.014;
    flushStatic(G, G.gridLB);
    // dying heart core
    const hb = G.barEnv;
    mote(G, [0, 2.2, 0], 0.5 + hb * 0.25, 0.55 + hb * 0.5, [1.0, 0.42, 0.38]);
    G.corePos = [0, 2.2, 0]; G.coreR = 0.5;
    G.dyn.circle(0, 2.2, 0, 2 + hb * 5, [COL.red[0], COL.red[1], COL.red[2], 0.5 * hb], 72, tl * 0.1);
    flushLines(G);
    // drifting remains
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 900; i++) {
      const yy = ((h1(i * 1.9) * 14 + tl * (0.15 + h1(i * 2.7) * 0.3)) % 14);
      const a = h1(i * 3.1) * 6.28 + tl * 0.05;
      const rr = 3 + h1(i * 4.3) * 14;
      b.push(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0.03 + h1(i * 5.5) * 0.05, COL.teal[0], COL.teal[1], COL.teal[2], 0.10 + hb * 0.12, i * 0.41);
    }
    flushInst(G, b);
    // numerals (times are LOCAL to the section)
    const T = G.text;
    for (let k = 0; k < G.COUNTDOWN.length; k++) {
      const t0 = (4 + k) * G.BAR;
      if (tl < t0 || tl > t0 + G.BAR * 1.05) continue;
      const lt = tl - t0;
      const cd = G.COUNTDOWN[k];
      const pop = easeOut(clamp(lt / 0.28, 0, 1));
      const fade = 1 - ease(clamp((lt - G.BAR * 0.75) / (G.BAR * 0.3), 0, 1));
      const is617 = cd.text === '617';
      const col = is617 ? [1, 0.25, 0.32, 1] : (k % 3 === 0 ? [1, 1, 1, 1] : (k % 3 === 1 ? [0.5, 0.95, 1, 1] : [1, 0.85, 0.6, 1]));
      col[3] = fade;
      const px = (is617 ? 300 : 190) * (0.6 + 0.4 * pop);
      const rec = T.big(cd.text, Math.round(px / 6) * 6, col, is617 ? 30 : 20, 700);
      quadScreen(G, rec.tex, G.W / 2 - rec.w / 2, G.H / 2 - rec.h / 2 - 40, rec.w, rec.h, [1, 1, 1, 1], 0);
      // shockwave ring
      const rw = 100 + lt / G.BAR * 900;
      G.dyn.circle(0, 2.2, 0, 2 + lt / G.BAR * 9, [col[0], col[1], col[2], 0.5 * fade], 72, 0);
      T.draw(cd.lang, G.W / 2, G.H / 2 + 190, 22, [0.5, 0.6, 0.7, 0.5 * fade], 'center');
      G.fx.shake = Math.max(G.fx.shake, sh + 0.02 * Math.exp(-lt * 6));
      G.fx.glitch = Math.max(G.fx.glitch, 0.3 * Math.exp(-lt * 5));
    }
    // final white ramp
    if (tl > s.bars * G.BAR - 0.55) G.fx.flash = Math.max(G.fx.flash, (tl - (s.bars * G.BAR - 0.55)) / 0.55);
    G.fx.bloom = 0.55; G.fx.vig = 0.6; G.fx.rays = 0.3;
    G.fx.scan = 0.1;
  },

  // ---------- 9. garden ----------
  garden(G, tl, u, s) {
    const ang = tl * 0.06;
    setCam(G, [Math.cos(ang) * (7 + u * 9), 3 + u * 1.6, Math.sin(ang) * (7 + u * 9)], [0, 2.6, 0], 56);
    bg(G, [0.02, 0.035, 0.05], [0.005, 0.008, 0.014], [0.5, 0.45], [0.16, 0.4, 0.34], 0.8);
    G.fog = 0.007;
    flushStatic(G, G.gridLB);
    const cy = 2.6;
    const core = [0, cy, 0];
    // aurora ribbons
    for (let rb = 0; rb < 4; rb++) {
      const ph = rb * 1.7;
      const pts = [];
      for (let j = 0; j <= 70; j++) {
        const x = (j / 70 - 0.5) * 60;
        const y = 3.5 + Math.sin(x * 0.22 + tl * 0.9 + ph) * 1.9 + Math.sin(x * 0.07 - tl * 0.5 + ph * 2) * 1.5;
        const z = -14 + (j / 70) * 26;
        pts.push([x, y, z]);
      }
      const c = rb % 2 === 0 ? COL.aur : COL.violet;
      poly(G, pts, [c[0], c[1], c[2], 0.30]);
      const pts2 = pts.map(p => [p[0], p[1] + 0.9, p[2]]);
      poly(G, pts2, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 0.18]);
    }
    // roots (strings → roots of light)
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.2832 + tl * 0.05;
      const pts = [];
      for (let j = 0; j <= 14; j++) {
        const tt = j / 14;
        const r0 = 7 * (1 - tt);
        pts.push([Math.cos(a + tt * 1.2) * r0, tt * cy + Math.sin(tt * 5 + tl) * 0.06, Math.sin(a + tt * 1.2) * r0]);
      }
      poly(G, pts, [COL.soul[0], COL.soul[1], COL.soul[2], 0.4]);
    }
    // pulse + halo
    G.dyn.circle(0, cy, 0, 2.2 + G.beatEnv * 6, [COL.aur[0], COL.aur[1], COL.aur[2], 0.5 * G.beatEnv], 72, tl * 0.3);
    for (let k = 0; k < 2; k++) {
      G.dyn.circle(0, cy, 0, 3.4 + k * 1.3, k === 0 ? [COL.soul[0], COL.soul[1], COL.soul[2], 0.4] : [COL.aur[0], COL.aur[1], COL.aur[2], 0.3], 64, tl * (0.2 + k * 0.1), 'xz');
    }
    flushLines(G);
    // flower mandala: petal rings
    for (let ring = 0; ring < 5; ring++) {
      const n = 8 + ring * 4;
      const rad = 1.6 + ring * 0.85;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.2832 + tl * (0.12 + ring * 0.05) * (ring % 2 ? -1 : 1);
        const px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
        const py = cy + Math.sin(a * 2 + ring) * 0.35;
        const puls = 0.75 + 0.25 * Math.sin(tl * 2 + ring + k);
        const c = ring % 2 === 0 ? COL.soul : COL.aur;
        const rt = [Math.cos(a + 1.57), 0, Math.sin(a + 1.57)];
        quad3D(G, null, [px, py, pz], rt, [0, 1, 0], 0.5 * puls, 1.5 * puls, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 0.30], 1);
      }
    }
    // blooming particles
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 3200; i++) {
      const th = h1(i * 1.3) * 6.2832, ph = Math.acos(2 * h1(i * 2.1) - 1);
      const cyc = (tl * 0.5 + h1(i * 3.3)) % 1;
      const rr = 1 + cyc * 16;
      const px = Math.sin(ph) * Math.cos(th) * rr;
      const py = cy + Math.cos(ph) * rr * 0.62;
      const pz = Math.sin(ph) * Math.sin(th) * rr;
      const sel = h1(i * 4.7);
      const c = sel > 0.72 ? COL.soul : (sel > 0.4 ? COL.aur : COL.cyan);
      b.push(px, py, pz, 0.04 + h1(i * 5.9) * 0.09, c[0], c[1], c[2], (0.34 * (1 - cyc) + 0.1), i * 0.23);
    }
    flushInst(G, b);
    // radiant core
    mote(G, core, 1.0 + 0.12 * G.beatEnv, 1.35);
    G.corePos = core; G.coreR = 1.1;
    // title
    const title = G.text.big('me.execute(world);', 108, [1, 1, 1, 1], 24, 700);
    const fl = Math.sin(tl * 0.7) * 0.15;
    quad3D(G, title.tex, [0, cy + 2.8 + fl, 0], [1, 0, 0], [0, 1, 0], 9.5, 9.5 / (title.w / title.h), [1, 1, 1, 0.95], 0);
    G.fx.bloom = 1.15; G.fx.vig = 0.3; G.fx.rays = 0.5;
    G.fx.expo = 1.22;
    G.fx.shake = 0.002 + 0.008 * G.beatEnv;
  },

  // ---------- 10. outro ----------
  outro(G, tl, u, s) {
    setCam(G, [0, 2.6, 8.5], [0, 2.4, 0], 54);
    bg(G, [0.005, 0.008, 0.014], [0.001, 0.002, 0.004], [0.5, 0.45], [0.05, 0.12, 0.16], 0.4);
    G.fog = 0.013;
    const fadeAll = clamp(1 - ease(clamp((tl - (s.bars * G.BAR - 2.2)) / 2.0, 0, 1)), 0, 1);
    G.fx.expo = 0.15 + 0.85 * fadeAll;
    flushStatic(G, G.gridLB);
    // embers rising
    const b = G.instBuf; b.reset();
    for (let i = 0; i < 700; i++) {
      const yy = ((h1(i * 1.7) * 13 + tl * (0.25 + h1(i * 2.3) * 0.5)) % 13);
      const a = h1(i * 3.7) * 6.28 + Math.sin(tl * 0.4 + i) * 0.3;
      const rr = 1 + h1(i * 4.1) * 10;
      const c = h1(i * 5.3) > 0.6 ? COL.soul : COL.teal;
      b.push(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0.03 + h1(i * 6.1) * 0.05, c[0], c[1], c[2], 0.16 * fadeAll, i * 0.29);
    }
    flushInst(G, b);
    const fade = Math.exp(-tl * 0.5);
    if (fade > 0.02) { mote(G, [0, 2.4, 0], 0.5, fade, COL.soul); G.corePos = [0, 2.4, 0]; G.coreR = 0.5; }
    // terminal (times are LOCAL to the section)
    const T = G.text;
    const exitLocal = G.KEY.exitCode - s.t0;
    const byeLocal = G.KEY.goodbye - s.t0;
    let ly = 170, lx = 140;
    OUTRO_LINES.forEach(([t0, line], li) => {
      if (tl < exitLocal + t0) return;
      const lt = tl - (exitLocal + t0);
      const chars = Math.floor(clamp(lt * 34, 0, line.length));
      const y = 170 + li * 40;
      T.draw(line.slice(0, chars), 140, y, 24, [0.45, 0.85, 0.65, 0.85]);
      lx = 140 + chars * 24 * T.advRatio; ly = y;
    });
    const gbT = byeLocal;
    if (tl > gbT) {
      const line = 'goodbye, world.';
      const chars = Math.floor(clamp((tl - gbT) * 16, 0, line.length));
      T.draw(line.slice(0, chars), 140, 170 + OUTRO_LINES.length * 40 + 26, 34, [1, 0.87, 0.65, 0.95]);
      lx = 140 + chars * 34 * T.advRatio; ly = 170 + OUTRO_LINES.length * 40 + 26;
    }
    if (Math.floor(tl * 2.4) % 2 === 0 && tl > exitLocal) {
      quadScreen(G, null, lx + 6, ly + 4, 13, 26, [0.5, 1, 0.7, 0.7], 0);
    }
    G.fx.scan = 0.3; G.fx.bloom = 0.6; G.fx.vig = 0.6;
    G.fx.tint = [0.85, 0.95, 1.05]; G.fx.tintAmt = 0.15;
  },
};

module.exports = { SCENES, COL, project, setCam };
