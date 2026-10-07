// main.js — the MV renderer. renderFrame(i) draws frame i at t = i/FPS and is
// a pure function of that t: no wall-clock time, no RNG, no feedback buffers.
import { program, fullscreenVAO, drawFullscreen, FS_TRIANGLE_VS, createFBO, bindFBO, canvasTexture } from './glutil.js';
import { WORLD_FS, POINTS_VS, POINTS_FS, GLYPH_VS, GLYPH_FS, BRIGHT_FS, BLUR_FS, COMPOSITE_FS } from './shaders.js';
import { loadFonts, buildAtlas, TextRenderer, CHARSET } from './text.js';
import { Music } from './music.js';
import { visualAt, lyricAt, DURATION, FPS, TOTAL_FRAMES, sectionAt, SECTIONS } from './score.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, x) => a + (b - a) * x;

/* ---------- tiny mat4 ---------- */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
function lookAt(eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1,
  ]);
}
function mul(a, b) { // a*b, column major
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const POINT_COUNT = 26000;
export const GLYPH_COUNT = 15000;

export class MV {
  constructor(gl, canvas, atlas, music) {
    this.gl = gl;
    this.canvas = canvas;
    this.atlas = atlas;
    this.music = music;
    this.W = canvas.width;
    this.H = canvas.height;
    this.text = new TextRenderer(gl, atlas);
    this.text.init();
    this.debug = { noGlyph: false, noPoints: false, noBox: false, noGrid: false, noWorld: false, noBloom: false, noStars: false, noText: false };
    this._build();
  }

  static async create(canvas, { assetBase = './assets' } = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      preserveDrawingBuffer: true, powerPreference: 'high-performance',
      desynchronized: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) console.warn('no EXT_color_buffer_float');
    await loadFonts(assetBase);
    const atlas = buildAtlas();
    const music = await Music.load(`${assetBase}/analysis.json`);
    return new MV(gl, canvas, atlas, music);
  }

  _build() {
    const gl = this.gl;
    const W = this.W, H = this.H;
    this.vaoEmpty = fullscreenVAO(gl);

    // programs
    this.pWorld = program(gl, FS_TRIANGLE_VS, WORLD_FS, 'world');
    this.pPoints = program(gl, POINTS_VS, POINTS_FS, 'points');
    this.pGlyph = program(gl, GLYPH_VS, GLYPH_FS, 'glyph');
    this.pBright = program(gl, FS_TRIANGLE_VS, BRIGHT_FS, 'bright');
    this.pBlur = program(gl, FS_TRIANGLE_VS, BLUR_FS, 'blur');
    this.pComp = program(gl, FS_TRIANGLE_VS, COMPOSITE_FS, 'composite');

    // render targets
    this.scene = createFBO(gl, W, H, { float: true });
    this.mips = [];
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < 3; i++) {
      this.mips.push({
        w, h,
        a: createFBO(gl, w, h, { float: true }),
        b: createFBO(gl, w, h, { float: true }),
        out: null,
      });
      w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
    }

    // glyph atlas texture for the 3-D letter particles
    this.atlasTex = canvasTexture(gl, this.atlas.canvas, { mipmap: true });

    // glyph instance cells (deterministic PRNG, built once)
    const rnd = mulberry32(0xC0FFEE);
    const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>/\\*+-=;:._'.split('');
    const cells = new Float32Array(GLYPH_COUNT * 4);
    for (let i = 0; i < GLYPH_COUNT; i++) {
      const ch = pool[Math.floor(rnd() * pool.length)];
      const uv = this.atlas.index.get(ch);
      cells.set(uv, i * 4);
    }
    this.glyphVAO = gl.createVertexArray();
    gl.bindVertexArray(this.glyphVAO);
    const corners = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);
    const cbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
    gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    this.glyphCells = cbo;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  /* ---------------- scene pass ---------------- */
  _drawScene(v) {
    const gl = this.gl;
    const D = this.debug;
    bindFBO(gl, this.scene);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | (this.scene._depth ? gl.DEPTH_BUFFER_BIT : 0));

    if (D.noWorld) return;

    // camera
    const roll = v.cam.roll;
    const up = [Math.sin(roll), Math.cos(roll), 0];
    const view = lookAt(v.cam.pos, v.cam.target, up);
    const aspect = this.W / this.H;
    const proj = perspective(v.cam.fov, aspect, 0.05, 200);
    const viewProj = mul(proj, view);
    const projY = proj[5];

    // world
    gl.useProgram(this.pWorld);
    gl.bindVertexArray(this.vaoEmpty);
    const u = this.pWorld.u;
    gl.uniform2f(u.uRes, this.W, this.H);
    gl.uniform1f(u.uTime, v.t);
    gl.uniform3fv(u.uCamPos, v.cam.pos);
    gl.uniform3fv(u.uCamTarget, v.cam.target);
    gl.uniform1f(u.uRoll, roll);
    gl.uniform1f(u.uFov, v.cam.fov);
    gl.uniform3fv(u.uBands, v.bands);
    gl.uniform1f(u.uPulse, v.pulse);
    gl.uniform1f(u.uCoreR, v.coreR);
    gl.uniform1f(u.uGlow, v.glow);
    gl.uniform1f(u.uDisperse, v.disperse);
    gl.uniform1f(u.uBoxShow, D.noBox ? 0 : v.box);
    gl.uniform1f(u.uGridShow, D.noGrid ? 0 : v.grid);
    gl.uniform1f(u.uStars, D.noStars ? 0 : v.stars);
    gl.uniform1f(u.uRings, v.rings);
    gl.uniform1f(u.uShock, v.shock);
    gl.uniform1f(u.uShock2, v.shock2);
    gl.uniform1f(u.uGlitch, 0.0);
    gl.uniform3fv(u.uTintA, v.tintA);
    gl.uniform3fv(u.uTintB, v.tintB);
    gl.uniform1f(u.uVoid, clamp(v.disperse * 0.9 + (v.section.id === 'break' ? 0.5 : 0)));
    gl.uniform1f(u.uInside, 0);
    gl.disable(gl.BLEND);
    drawFullscreen(gl);

    // particles (points)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pPoints);
    const pu = this.pPoints.u;
    gl.uniformMatrix4fv(pu.uViewProj, false, viewProj);
    gl.uniform3fv(pu.uCamPos, v.cam.pos);
    gl.uniform1f(pu.uPix, this.H / 1080 * 2.0);
    this._setParticleUniforms(this.pPoints, v);
    if (!D.noPoints) gl.drawArrays(gl.POINTS, 0, POINT_COUNT);

    // particles (glyph billboards) — the world is literally made of text
    gl.useProgram(this.pGlyph);
    const gu = this.pGlyph.u;
    gl.uniformMatrix4fv(gu.uViewProj, false, viewProj);
    gl.uniform3fv(gu.uCamPos, v.cam.pos);
    gl.uniform1f(gu.uProjY, projY);
    gl.uniform1f(gu.uGlyphSize, 0.048);
    this._setParticleUniforms(this.pGlyph, v, GLYPH_COUNT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(gu.uAtlas, 0);
    if (!D.noGlyph) {
      gl.bindVertexArray(this.glyphVAO);
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, GLYPH_COUNT);
      gl.bindVertexArray(null);
    }
    gl.disable(gl.BLEND);
  }

  _setParticleUniforms(p, v, count = POINT_COUNT) {
    const gl = this.gl, u = p.u;
    gl.uniform1f(u.uTime, v.t);
    gl.uniform1f(u.uCount, count);
    gl.uniform1i(u.uShapeA, v.shapeA);
    gl.uniform1i(u.uShapeB, v.shapeB);
    gl.uniform1f(u.uMorph, clamp(v.morph));
    gl.uniform1f(u.uSpin, v.t * 0.055 + v.section.t0 * 0.02);
    gl.uniform1f(u.uScale, v.scale);
    gl.uniform1f(u.uDisperse, v.disperse);
    gl.uniform1f(u.uPulse, v.pulse);
    gl.uniform3fv(u.uBands, v.bands);
    gl.uniform3fv(u.uTintA, v.tintA);
    gl.uniform3fv(u.uTintB, v.tintB);
    gl.uniform1f(u.uVoid, clamp(v.disperse * 0.8));
    gl.uniform1f(u.uAttract, v.attract);
    gl.uniform1f(u.uSeed, 7.31);
    gl.uniform3f(u.uOffset, 0, 0, 0);
  }

  /* ---------------- text overlay ---------------- */
  _drawText(v) {
    const T = this.text;
    const gl = this.gl;
    const s = v.section;
    T.begin();

    const cyan = [0.62, 0.95, 1.0];
    const warm = [1.0, 0.80, 0.52];
    const dim = [0.45, 0.62, 0.78];

    // --- HUD (top-left) ---
    if (v.t > 0.6 && s.id !== 'post') {
      const tc = `${String(Math.floor(v.t / 60)).padStart(2, '0')}:${(v.t % 60).toFixed(2).padStart(5, '0')}`;
      T.add(`> ${s.name.toUpperCase()}`, 64, 44, 22, dim, { alpha: 0.75 });
      T.add(tc, 64, 74, 18, dim, { alpha: 0.5 });
      const bar = Math.floor(v.bars - Math.floor(v.bars / 4) * 4) + 1;
      T.add(`BAR ${String(Math.floor(v.bars)).padStart(3, '0')}.${bar}`, 64, 98, 18, dim, { alpha: 0.4 });
    }

    // --- watermark (bottom-right) ---
    T.add('world.execute(me);  // Mili', this.W - 64, this.H - 56, 20, dim,
      { align: 'right', alpha: 0.45 });

    // --- lyric line ---
    const ly = lyricAt(v.t);
    if (ly && s.id !== 'post') {
      const chars = Math.min(ly.text.length, Math.floor(ly.age * 62) + 1);
      const shown = ly.text.slice(0, chars);
      const a = clamp(ly.age / 0.25) * clamp((9.0 - ly.age) / 1.6);
      const glow = 0.55 + 0.45 * v.pulse;
      const y = this.H - 232;
      T.add(shown, this.W / 2 + 3, y + 3, 56, [0, 0, 0], { align: 'center', alpha: 0.75 * a });
      T.add(shown, this.W / 2, y, 56, cyan.map(c => c * glow), { align: 'center', alpha: a, bold: true });
      // progress rule under the line
      const full = T.width('M'.repeat(ly.text.length), 56);
      const fill = clamp(ly.age / 2.6);
      T.rule(this.W / 2 - full / 2, y + 84, full, 2, cyan, 0.18 * a);
      T.rule(this.W / 2 - full / 2, y + 84, full * fill, 2, warm, 0.75 * a);
    }

    // --- fake code column (left) ---
    if (['v1', 'v2', 'pc1', 'ch1'].includes(s.id)) {
      const code = [
        'world.create(object);',
        'params.init(data);',
        'for (i in self) {',
        '  love.compute(i);',
        '}',
        'world.execute(me);',
      ];
      const n = Math.min(code.length, Math.floor((v.local % 12) / 2) + 1);
      for (let i = 0; i < n; i++) {
        T.add(code[i], 64, 190 + i * 30, 20, [0.45, 0.85, 0.75], { alpha: 0.55 });
      }
    }

    // --- EXECUTION section: big type ---
    if (s.id === 'exec') {
      const k = Math.floor(v.local / 3.68);
      const words = ['EXECUTION', 'EXECUTION', 'EXECUTION', 'EIN · DOS · TROIS · 네 · FEM · 六', 'EXECUTION'];
      const age = v.local % 3.68;
      const a = clamp(age / 0.12) * clamp((3.0 - age) / 0.9);
      const size = 96 + 26 * (1 - clamp(age / 0.7));
      T.add(words[Math.min(words.length - 1, k)], this.W / 2, 150, size, [1.0, 0.72, 0.45],
        { align: 'center', alpha: a * 0.9, bold: true });
    }

    // --- the title card ---
    if (s.id === 'post') {
      const age = v.local;
      const full = 'world.execute(me);';
      const chars = Math.min(full.length, Math.floor(age * 7));
      T.add(full.slice(0, chars), this.W / 2, this.H / 2 - 60, 84, [0.75, 0.95, 1.0],
        { align: 'center', bold: true, alpha: clamp(age / 0.6) * 0.95 });
      // blinking cursor
      if (Math.floor(age * 2) % 2 === 0) {
        const w = T.width(full.slice(0, chars), 84);
        T.add('_', this.W / 2 + w / 2 + 6, this.H / 2 - 60, 84, [1, 0.8, 0.5], { alpha: 0.9 });
      }
      T.add('Mili — Miracle Milk (2016)   ·   fan MV, procedurally rendered',
        this.W / 2, this.H / 2 + 90, 24, [0.5, 0.68, 0.85], { align: 'center', alpha: clamp((age - 1.2) / 1.5) * 0.8 });
    }

    // --- boot: power line text ---
    if (s.id === 'boot') {
      const age = v.t;
      T.add('> power on', 64, 44, 22, cyan, { alpha: clamp(age / 0.3) });
    }

    T.flush();
  }

  /* ---------------- bloom ---------------- */
  _drawBloom(v) {
    const gl = this.gl;
    // bright pass at the first mip
    const m0 = this.mips[0];
    bindFBO(gl, m0.a);
    gl.useProgram(this.pBright);
    gl.bindVertexArray(this.vaoEmpty);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.texture);
    gl.uniform1i(this.pBright.u.uTex, 0);
    // NB: uTexel maps the *destination* fragment grid to source UVs, so it must
    // be 1/targetSize (the bloom target is half resolution), not 1/sourceSize.
    gl.uniform2f(this.pBright.u.uTexel, 1 / m0.w, 1 / m0.h);
    gl.uniform1f(this.pBright.u.uThreshold, 0.62);
    gl.disable(gl.BLEND);
    drawFullscreen(gl);

    let src = m0.a;
    for (let i = 0; i < this.mips.length; i++) {
      const m = this.mips[i];
      // horizontal
      bindFBO(gl, m.b);
      gl.useProgram(this.pBlur);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      gl.uniform1i(this.pBlur.u.uTex, 0);
      gl.uniform2f(this.pBlur.u.uTexel, 1 / m.w, 1 / m.h);
      gl.uniform2f(this.pBlur.u.uDir, 1, 0);
      drawFullscreen(gl);
      // vertical
      bindFBO(gl, m.a);
      gl.bindTexture(gl.TEXTURE_2D, m.b.texture);
      gl.uniform2f(this.pBlur.u.uDir, 0, 1);
      drawFullscreen(gl);
      m.out = m.a;
      src = m.a;
    }
  }

  /* ---------------- composite ---------------- */
  _drawComposite(v) {
    const gl = this.gl;
    bindFBO(gl, null);
    gl.useProgram(this.pComp);
    gl.bindVertexArray(this.vaoEmpty);
    const u = this.pComp.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.texture); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips[0].out.texture); gl.uniform1i(u.uBloom1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.mips[1].out.texture); gl.uniform1i(u.uBloom2, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.mips[2].out.texture); gl.uniform1i(u.uBloom3, 3);
    gl.uniform2f(u.uRes, this.W, this.H);
    gl.uniform1f(u.uTime, v.t);
    gl.uniform1f(u.uBloom, v.bloom);
    gl.uniform1f(u.uFade, v.fade);
    gl.uniform1f(u.uWhite, v.white);
    gl.uniform1f(u.uChroma, v.chroma);
    gl.uniform1f(u.uScan, v.scan);
    gl.uniform1f(u.uGrain, v.grain);
    gl.uniform1f(u.uGlitch, v.glitch);
    gl.uniform1f(u.uExposure, v.exposure);
    gl.uniform1f(u.uSat, v.sat);
    gl.uniform3fv(u.uLift, v.lift);
    gl.uniform3fv(u.uGain, v.gain);
    gl.uniform1f(u.uBarrel, v.barrel);
    gl.uniform1f(u.uFlashCol, v.section.id === 'ch3' || v.section.id === 'exec' ? 1 : 0);
    gl.disable(gl.BLEND);
    drawFullscreen(gl);
  }

  /** draw the complete video frame for time t */
  renderTime(t) {
    const gl = this.gl;
    const v = visualAt(t, this.music);
    this._drawScene(v);
    if (!this.debug.noText) {
      // text is composited into the same scene buffer so bloom treats it as light
      bindFBO(gl, this.scene);
      this._drawText(v);
    }
    if (!this.debug.noBloom) this._drawBloom(v);
    else { this.mips.forEach(m => { gl.bindFramebuffer(gl.FRAMEBUFFER, m.a); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); m.out = m.a; }); }
    this._drawComposite(v);
    gl.flush();
    return v;
  }

  renderFrame(i) { return this.renderTime(i / FPS); }
}

export { DURATION, FPS, TOTAL_FRAMES, SECTIONS, sectionAt };
