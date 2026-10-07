// text.js — glyph atlas (2 weights in one texture) + instanced screen-space text.
//
// Everything is laid out by the caller from data that is a pure function of t,
// so text is deterministic like the rest of the renderer.
import { program, canvasTexture } from './glutil.js';

export const CHARSET =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`' +
  'abcdefghijklmnopqrstuvwxyz{|}~' +
  '네六∞π×·—’“”❤█▓▒░▌▐●○◆◇★☆±≈≠≤≥∅←→↑↓⌁⌇⏎';

const FONT_SIZE = 88;      // px used when rasterising the atlas
const ADVANCE = 0.6;       // JetBrains Mono advance width in em
export const CELL_W = Math.ceil(FONT_SIZE * ADVANCE);   // 53
export const CELL_H = Math.ceil(FONT_SIZE * 1.35);      // 119
const BASELINE = Math.round(FONT_SIZE * 1.0);
const COLS = 18;
const PAD = 2;

export async function loadFonts(base = '../assets') {
  const specs = [
    ['MV Mono', `${base}/JetBrainsMono-Regular.ttf`],
    ['MV Mono Bold', `${base}/JetBrainsMono-Bold.ttf`],
  ];
  for (const [family, url] of specs) {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
    } catch (e) {
      console.warn('font load failed, falling back to monospace: ' + url, e);
    }
  }
}

export function buildAtlas() {
  const blocks = [
    { weight: 'normal', family: '"MV Mono", monospace' },
    { weight: 'bold', family: '"MV Mono Bold", "MV Mono", monospace' },
  ];
  const rowsPerBlock = Math.ceil(CHARSET.length / COLS);
  const totalRows = rowsPerBlock * blocks.length + 1;   // +1 row reserved for a solid patch
  const W = COLS * CELL_W;
  const H = totalRows * CELL_H;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';

  const index = new Map(); // char -> [u0,v0,u1,v1] normalised
  blocks.forEach((blk, b) => {
    ctx.font = `${blk.weight} ${FONT_SIZE}px ${blk.family}`;
    for (let i = 0; i < CHARSET.length; i++) {
      const col = i % COLS, row = Math.floor(i / COLS) + b * rowsPerBlock;
      const x = col * CELL_W, y = row * CELL_H + BASELINE;
      ctx.fillText(CHARSET[i], x + PAD, y);
      index.set(CHARSET[i] + (b ? '\u0000b' : ''), [x / W, y0(row), (x + CELL_W) / W, y1(row)]);
    }
  });
  function y0(row) { return (row * CELL_H) / H; }
  function y1(row) { return ((row + 1) * CELL_H) / H; }

  // solid patch: a fully opaque square used by rule()/bars
  const srow = rowsPerBlock * blocks.length;
  ctx.fillStyle = '#fff';
  ctx.fillRect(CELL_W * 0.2, srow * CELL_H + CELL_H * 0.2, CELL_W * 0.6, CELL_H * 0.6);
  const solid = [
    (CELL_W * 0.4) / W, (srow * CELL_H + CELL_H * 0.4) / H,
    (CELL_W * 0.6) / W, (srow * CELL_H + CELL_H * 0.6) / H,
  ];

  return { canvas: cv, index, W, H, cellW: CELL_W, cellH: CELL_H, solid };
}

const TEXT_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aRect;
layout(location=2) in vec4 aUV;
layout(location=3) in vec4 aColor;
uniform vec2 uRes;
out vec2 vUV; out vec4 vColor;
void main(){
  vec2 px = aRect.xy + aCorner * aRect.zw;
  vec2 ndc = vec2(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  vUV = mix(aUV.xy, aUV.zw, aCorner);
  vColor = aColor;
}`;

const TEXT_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vColor;
uniform sampler2D uAtlas;
out vec4 outColor;
void main(){
  float a = texture(uAtlas, vUV).a;
  // poor-man's SDF: re-sharpen the alpha ramp so text stays crisp while scaling
  a = smoothstep(0.38, 0.62, a);
  if (a <= 0.001) discard;
  outColor = vec4(vColor.rgb * a * vColor.a, a * vColor.a);
}`;

export class TextRenderer {
  constructor(gl, atlas) {
    this.gl = gl;
    this.atlas = atlas;
    this.solid = atlas.solid;
    this.max = 24000;
    this.count = 0;
    this.data = new Float32Array(this.max * 12);
    this.prog = null;

    const g = gl;
    this.vao = g.createVertexArray();
    g.bindVertexArray(this.vao);
    const corners = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const vbo = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, vbo);
    g.bufferData(g.ARRAY_BUFFER, corners, g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    const idx = new Uint16Array([0, 1, 2, 2, 1, 3]);
    const ibo = g.createBuffer();
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ibo);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, idx, g.STATIC_DRAW);
    this.ibo = ibo;

    this.inst = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, this.inst);
    g.bufferData(g.ARRAY_BUFFER, this.data.byteLength, g.DYNAMIC_DRAW);
    const stride = 48;
    g.enableVertexAttribArray(1); g.vertexAttribPointer(1, 4, g.FLOAT, false, stride, 0); g.vertexAttribDivisor(1, 1);
    g.enableVertexAttribArray(2); g.vertexAttribPointer(2, 4, g.FLOAT, false, stride, 16); g.vertexAttribDivisor(2, 1);
    g.enableVertexAttribArray(3); g.vertexAttribPointer(3, 4, g.FLOAT, false, stride, 32); g.vertexAttribDivisor(3, 1);
    g.bindVertexArray(null);
  }

  init() {
    const g = this.gl;
    this.prog = program(g, TEXT_VS, TEXT_FS, 'text');
    this.tex = canvasTexture(g, this.atlas.canvas, { mipmap: true });
    this.res = [1920, 1080];
  }

  setRes(w, h) { this.res[0] = w; this.res[1] = h; }

  begin() { this.count = 0; }

  /** x,y = top-left of the text box, size = px font size. */
  add(text, x, y, size, color, { bold = false, align = 'left', alpha = 1, tracking = 0 } = {}) {
    const cellW = this.atlas.cellW, cellH = this.atlas.cellH;
    const w = size * (cellW / cellH) ;
    const qh = size * 1.35;
    const adv = qh * (cellW / cellH) * (1 + tracking);
    const total = adv * text.length;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const [r, gg, b] = color;
    for (const ch of text) {
      const uv = this.atlas.index.get(ch + (bold ? '\u0000b' : '')) || this.atlas.index.get(' ');
      if (ch !== ' ') {
        const o = this.count * 12;
        const d = this.data;
        d[o] = cx; d[o + 1] = y; d[o + 2] = adv; d[o + 3] = qh;
        d[o + 4] = uv[0]; d[o + 5] = uv[1]; d[o + 6] = uv[2]; d[o + 7] = uv[3];
        d[o + 8] = r; d[o + 9] = gg; d[o + 10] = b; d[o + 11] = alpha;
        this.count++;
        if (this.count >= this.max) return;
      }
      cx += adv;
    }
  }

  width(text, size, tracking = 0) {
    const qh = size * 1.35;
    return qh * (this.atlas.cellW / this.atlas.cellH) * (1 + tracking) * text.length;
  }

  /** solid rectangle in screen px (used for rules, bars and cursor blocks) */
  rule(x, y, w, h, color, alpha = 1) {
    if (this.count >= this.max) return;
    const o = this.count * 12, d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = w; d[o + 3] = h;
    const uv = this.solid;
    d[o + 4] = uv[0]; d[o + 5] = uv[1]; d[o + 6] = uv[2]; d[o + 7] = uv[3];
    d[o + 8] = color[0]; d[o + 9] = color[1]; d[o + 10] = color[2]; d[o + 11] = alpha;
    this.count++;
  }

  flush() {
    if (!this.count) return;
    const g = this.gl;
    g.useProgram(this.prog);
    g.bindVertexArray(this.vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.inst);
    g.bufferSubData(g.ARRAY_BUFFER, 0, this.data, 0, this.count * 12);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.tex);
    g.uniform1i(this.prog.u.uAtlas, 0);
    g.uniform2f(this.prog.u.uRes, this.res[0], this.res[1]);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawElementsInstanced(g.TRIANGLES, 6, g.UNSIGNED_SHORT, 0, this.count);
    g.bindVertexArray(null);
    this.count = 0;
  }
}
