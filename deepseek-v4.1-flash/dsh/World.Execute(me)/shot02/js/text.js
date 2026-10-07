// text.js — a glyph atlas rasterised at boot from a bundled monospace webfont,
// plus two ways of drawing with it: screen-space (HUD, captions, stamps) and
// true 3D parallelograms (code written flat on the sheet, words standing up).
//
// The atlas is built once with Canvas2D, deterministically, and then never
// changes — so text rendering costs nothing per frame and never depends on the
// font being installed on the machine.

import { program, instanceSet } from './gl.js';
import { TEXT_VS, TEXT_FS, TEXT3D_VS } from './shaders.js';

const CHARS = (() => {
  let s = '';
  for (let c = 32; c < 127; c++) s += String.fromCharCode(c);
  return s;
})();
const COLS = 16;
const CELL = 96;                 // atlas cell size in px
const ATLAS_W = COLS * CELL;
const ATLAS_H = Math.ceil(CHARS.length / COLS) * CELL;

export class Text {
  constructor(gl) {
    this.gl = gl;
    this.ready = false;
    this.ascent = 0;
    this.cellPx = CELL;
    this.advance = 0.6;          // advance in em, set from the real metrics
    this.progScreen = program(gl, TEXT_VS, TEXT_FS, 'text');
    this.progWorld = program(gl, TEXT3D_VS, TEXT_FS, 'text3d');

    // screen-space instances: pos(2) size(2) uv(4) color(4) jitter(2) = 14
    this.screen = instanceSet(gl, [1, 2, 3, 4, 5], [2, 2, 4, 4, 2], 26000);
    // 3D instances: origin(3) U(3) V(3) uv(4) color(4) = 17
    this.world = instanceSet(gl, [1, 2, 3, 4, 5], [3, 3, 3, 4, 4], 12000);
  }

  async load(url, weight = '400') {
    const face = new FontFace('mvmono', `url(${url})`, { weight, style: 'normal' });
    await face.load();
    document.fonts.add(face);
    this.font = `${CELL * 0.78}px mvmono`;
    this.build();
    this.ready = true;
  }

  build() {
    const gl = this.gl;
    const cv = document.createElement('canvas');
    cv.width = ATLAS_W; cv.height = ATLAS_H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, ATLAS_W, ATLAS_H);
    g.font = this.font;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    this.uv = {};
    for (let i = 0; i < CHARS.length; i++) {
      const ch = CHARS[i];
      const cx = (i % COLS) * CELL;
      const cy = Math.floor(i / COLS) * CELL;
      g.fillText(ch, cx + CELL * 0.11, cy + CELL * 0.78);
      this.uv[ch] = [
        (cx + 2) / ATLAS_W, (cy + 2) / ATLAS_H,
        (cx + CELL - 2) / ATLAS_W, (cy + CELL - 2) / ATLAS_H,
      ];
    }
    const m = g.measureText('MMMMMMMMMM');
    this.advance = (m.width / 10) / CELL;

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = tex;
    this.atlasW = ATLAS_W;
    this.atlasH = ATLAS_H;
  }

  /* ---------------------------------------------------------------- screen */
  /** Measure a string in px at a given size. */
  measure(str, size, tracking = 0) {
    return str.length * size * this.advance + Math.max(0, str.length - 1) * tracking * size;
  }

  /**
   * Push a screen-space string.
   * opts: {x,y,size,color:[r,g,b],alpha,tracking,align:'left'|'center'|'right',
   *        typing:0..1, jitter:[x,y], lineHeight, glow, seed}
   */
  pushScreen(list, str, o = {}) {
    const size = o.size ?? 32;
    const tracking = o.tracking ?? 0.06;
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.001) return;
    const color = o.color || [1, 1, 1];
    const adv = size * this.advance * (1 + tracking);
    const w = str.length * adv - (str.length ? size * this.advance * tracking : 0);
    let x0 = o.x ?? 0;
    if (o.align === 'center') x0 -= w / 2;
    else if (o.align === 'right') x0 -= w;
    const y0 = o.y ?? 0;
    const lines = String(str).split('\n');
    const lh = o.lineHeight ?? size * 1.25;
    const shown = o.typing === undefined ? Infinity : o.typing * str.length;
    const seed = o.seed ?? 0;
    let n = 0;
    for (let li = 0; li < lines.length; li++) {
      for (let i = 0; i < lines[li].length; i++, n++) {
        if (n >= shown) return;
        const ch = lines[li][i];
        const uv = this.uv[ch] || this.uv[' '];
        const d = list.data;
        const o6 = list.count * list.strideFloats;
        const gx = x0 + i * adv;
        const gy = y0 + li * lh;
        let jx = 0, jy = 0;
        if (o.jitter) {
          const r = hash2(seed + n * 3.1 + li * 7.7);
          jx = (r[0] - 0.5) * o.jitter[0];
          jy = (r[1] - 0.5) * o.jitter[1];
        }
        d[o6 + 0] = gx; d[o6 + 1] = gy;
        d[o6 + 2] = size; d[o6 + 3] = size;
        d[o6 + 4] = uv[0]; d[o6 + 5] = uv[1]; d[o6 + 6] = uv[2]; d[o6 + 7] = uv[3];
        d[o6 + 8] = color[0]; d[o6 + 9] = color[1]; d[o6 + 10] = color[2]; d[o6 + 11] = alpha;
        d[o6 + 12] = jx; d[o6 + 13] = jy;
        list.count++;
      }
    }
  }

  /* ------------------------------------------------------------------- 3D */
  /**
   * Push a string standing in world space.
   * opts: {origin:[x,y,z], u:[x,y,z] (per-em advance direction * size),
   *        v:[x,y,z] (glyph height direction * size), color, alpha, tracking}
   */
  pushWorld(list, str, o) {
    const o0 = o.origin;
    const u = o.u, v = o.v;
    const tracking = o.tracking ?? 0.06;
    const color = o.color || [1, 1, 1];
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.001) return;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const uv = this.uv[ch] || this.uv[' '];
      const k = i * (1 + tracking);
      const d = list.data;
      const p = list.count * list.strideFloats;
      d[p + 0] = o0[0] + u[0] * k; d[p + 1] = o0[1] + u[1] * k; d[p + 2] = o0[2] + u[2] * k;
      d[p + 3] = u[0]; d[p + 4] = u[1]; d[p + 5] = u[2];
      d[p + 6] = v[0]; d[p + 7] = v[1]; d[p + 8] = v[2];
      d[p + 9] = uv[0]; d[p + 10] = uv[1]; d[p + 11] = uv[2]; d[p + 12] = uv[3];
      d[p + 13] = color[0]; d[p + 14] = color[1]; d[p + 15] = color[2]; d[p + 16] = alpha;
      list.count++;
    }
  }

  /* ---------------------------------------------------------------- drawing */
  begin() { this.screen.count = 0; this.world.count = 0; }

  drawScreen(gl, w, h) {
    if (!this.screen.count) return;
    const p = this.progScreen;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(p.u.uAtlas, 0);
    gl.uniform2f(p.u.uRes, w, h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.screen.draw(this.screen.count);
  }

  drawWorld(gl, viewProj) {
    if (!this.world.count) return;
    const p = this.progWorld;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(p.u.uAtlas, 0);
    gl.uniformMatrix4fv(p.u.uViewProj, false, viewProj);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.world.draw(this.world.count);
  }
}

function hash2(x) {
  const a = Math.sin(x * 12.9898) * 43758.5453;
  const b = Math.sin(x * 78.233 + 1.7) * 12345.6789;
  return [a - Math.floor(a), b - Math.floor(b)];
}
