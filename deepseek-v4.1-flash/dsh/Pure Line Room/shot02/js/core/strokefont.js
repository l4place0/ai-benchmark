/**
 * strokefont.js - dependency-free single-stroke (centreline) vector font.
 *
 * Everything in this module is pure data + math: no network, no fonts, no deps.
 * The source is ASCII-only (non-ASCII code points are written as \uXXXX escapes).
 *
 * ---------------------------------------------------------------------------
 * Coordinate convention
 * ---------------------------------------------------------------------------
 *   em box      : cap height = 1.0, baseline at y = 0, ascender 1.0, descender -0.25
 *   capitals    : y in [0, 1]
 *   digits      : y in [0, 1]
 *   lowercase   : x-height 0.62, ascenders to 1.0, descenders to -0.25
 *   horizontal  : x = 0 is the left side bearing; ink starts a little to the right
 *   stems       : ~0.09 em thick when stroked; only the centreline is emitted
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   FONT                       { 'A': [ [[x,y], ...], ... ], ... }  (em units)
 *   glyph(ch)            ->    array of polylines (em units); [] if unknown
 *   advance(ch, size)    ->    pen advance in world units
 *   measure(str, size, opts) -> total width in world units
 *   layout(str, size, opts)  -> { width, height, polylines }  (world units)
 *
 *   opts = {
 *     letterSpacing = 0.06,   // multiple of `size`, added BETWEEN glyphs
 *     align         = 'left' | 'center' | 'right',
 *     spaceWidth    = 0.5,    // multiple of `size`, advance of ' '
 *   }
 *
 *   layout(): polylines are already multiplied by `size` (cap height === size),
 *   the baseline stays at y = 0, and `align` only shifts them on x:
 *     'left'   starts the string at x = 0
 *     'center' centres the string on x = 0
 *     'right'  ends the string at x = 0
 *   `height` is the nominal em span 1.25 * size (1.0 ascender .. -0.25 descender).
 *   Unknown characters never throw: they emit no strokes and advance 0.5 * size.
 */

/* ------------------------------------------------------------------ *
 *  tiny geometry helpers
 * ------------------------------------------------------------------ */

const D = Math.PI / 180;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

/** Polyline along an ellipse arc. Angles in degrees, CCW, y-up, both ends included. */
function arc(cx, cy, rx, ry, a0, a1, steps) {
  const out = [];
  const n = Math.max(1, steps | 0);
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * (i / n)) * D;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** Rounded-rectangle right side: from (x0,yT) to (x0,yB), bulging out to xR. */
function bowl(x0, yT, yB, xR, r) {
  const rr = Math.min(r, (yT - yB) / 2, xR - x0);
  const p = [[x0, yT], [xR - rr, yT]];
  for (const q of arc(xR - rr, yT - rr, rr, rr, 90, 0, 3)) p.push(q);
  p.push([xR, yB + rr]);
  for (const q of arc(xR - rr, yB + rr, rr, rr, 0, -90, 3)) p.push(q);
  p.push([x0, yB]);
  return p;
}

/** Drop consecutive duplicate points and round to 5 decimals. */
function clean(p) {
  const o = [];
  for (let i = 0; i < p.length; i++) {
    const x = r5(p[i][0]), y = r5(p[i][1]);
    const l = o[o.length - 1];
    if (!l || l[0] !== x || l[1] !== y) o.push([x, y]);
  }
  return o;
}

/* ------------------------------------------------------------------ *
 *  metrics (em units)
 * ------------------------------------------------------------------ */

const XL = 0.075, XR = 0.705, XC = 0.39;    // capitals : left/right stem, centre
const LL = 0.075, LR = 0.615, LC = 0.345;   // lowercase: left/right stem, centre
const XH = 0.62;                            // x-height
const XP = 1.0;                             // ascender / cap height
const DESC = -0.25;                         // descender

/* ------------------------------------------------------------------ *
 *  glyph data
 * ------------------------------------------------------------------ */

const G = {
  /* ================= capitals ================= */
  A: [[[XL, 0], [XC, 1], [XR, 0]], [[0.17, 0.30], [0.61, 0.30]]],
  B: [[[XL, 0], [XL, 1]], bowl(XL, 1, 0.50, 0.665, 0.22), bowl(XL, 0.50, 0, 0.705, 0.25)],
  C: [arc(XC, 0.5, 0.315, 0.5, 55, 305, 8)],
  D: [[[XL, 0], [XL, 1]], bowl(XL, 1, 0, 0.705, 0.30)],
  E: [[[XL, 0], [XL, 1]], [[XL, 1], [XR, 1]], [[XL, 0.5], [0.63, 0.5]], [[XL, 0], [XR, 0]]],
  F: [[[XL, 0], [XL, 1]], [[XL, 1], [XR, 1]], [[XL, 0.5], [0.63, 0.5]]],
  G: [[...arc(XC, 0.5, 0.315, 0.5, 50, 340, 8), [0.44, 0.329]]],
  H: [[[XL, 0], [XL, 1]], [[XR, 0], [XR, 1]], [[XL, 0.5], [XR, 0.5]]],
  I: [[[0.15, 0], [0.15, 1]]],
  J: [[[0.545, 1], [0.545, 0.22], ...arc(0.31, 0.22, 0.235, 0.22, 0, -180, 4)]],
  K: [[[XL, 0], [XL, 1]], [[XL, 0.42], [XR, 1]], [[0.28, 0.437], [XR, 0]]],
  L: [[[XL, 1], [XL, 0], [0.625, 0]]],
  M: [[[XL, 0], [XL, 1], [0.51, 0.22], [0.945, 1], [0.945, 0]]],
  N: [[[XL, 0], [XL, 1], [XR, 0], [XR, 1]]],
  O: [arc(XC, 0.5, 0.315, 0.5, 90, 450, 10)],
  P: [[[XL, 0], [XL, 1]], bowl(XL, 1, 0.44, 0.70, 0.28)],
  Q: [arc(XC, 0.5, 0.315, 0.5, 90, 450, 10), [[0.44, 0.24], [0.72, -0.06]]],
  R: [[[XL, 0], [XL, 1]], bowl(XL, 1, 0.44, 0.70, 0.28), [[0.40, 0.44], [XR, 0]]],
  // S: the two bowls must share a tangent at the waist, so the lower one is
  // traversed clockwise (90 -> -150); otherwise the middle becomes a cusp.
  S: [[...arc(XC, 0.75, 0.315, 0.25, 30, 270, 5), ...arc(XC, 0.25, 0.315, 0.25, 90, -150, 5)]],
  T: [[[XL, 1], [0.685, 1]], [[0.38, 1], [0.38, 0]]],
  U: [[[XL, 1], [XL, 0.30], ...arc(XC, 0.30, 0.315, 0.30, 180, 360, 4), [XR, 1]]],
  V: [[[XL, 1], [XC, 0], [XR, 1]]],
  W: [[[XL, 1], [0.30, 0], [0.51, 0.72], [0.72, 0], [0.945, 1]]],
  X: [[[XL, 0], [XR, 1]], [[XL, 1], [XR, 0]]],
  Y: [[[XL, 1], [XC, 0.45], [XR, 1]], [[XC, 0.45], [XC, 0]]],
  Z: [[[XL, 1], [0.665, 1], [XL, 0], [0.665, 0]]],

  /* ================= digits (tabular: all advance 0.66) ================= */
  0: [arc(0.33, 0.5, 0.255, 0.5, 90, 450, 10)],
  1: [[[0.14, 0.76], [0.33, 1], [0.33, 0]], [[0.14, 0], [0.52, 0]]],
  2: [[...arc(0.33, 0.76, 0.255, 0.24, 160, -40, 5), [0.075, 0], [0.585, 0]]],
  3: [[...arc(0.33, 0.75, 0.26, 0.25, 160, -90, 5), ...arc(0.33, 0.25, 0.26, 0.25, 90, -160, 5)]],
  4: [[[0.60, 0.32], [0.075, 0.32], [0.47, 1], [0.47, 0]]],
  5: [[[0.575, 1], [0.135, 1], ...arc(0.33, 0.28, 0.255, 0.28, 145, -130, 6)]],
  6: [[...arc(0.33, 0.62, 0.255, 0.38, 40, 180, 5), [0.075, 0.32],
      ...arc(0.33, 0.32, 0.255, 0.32, 180, 540, 7)]],
  7: [[[0.075, 1], [0.585, 1], [0.28, 0]]],
  8: [arc(0.33, 0.76, 0.225, 0.24, 90, 450, 10), arc(0.33, 0.26, 0.255, 0.26, 90, 450, 10)],
  9: [[...arc(0.33, 0.68, 0.255, 0.32, 0, 360, 8), [0.585, 0.38],
      ...arc(0.33, 0.38, 0.255, 0.38, 0, -140, 5)]],

  /* ================= lowercase ================= */
  a: [arc(LC, 0.31, 0.27, 0.31, 90, 450, 10), [[LR, 0], [LR, XH]]],
  b: [[[LL, 0], [LL, 1]], arc(LC, 0.31, 0.27, 0.31, 90, 450, 10)],
  c: [arc(LC, 0.31, 0.27, 0.31, 55, 305, 8)],
  d: [[[LR, 0], [LR, 1]], arc(LC, 0.31, 0.27, 0.31, 90, 450, 10)],
  e: [arc(LC, 0.31, 0.27, 0.31, 30, 330, 8), [[0.087, 0.40], [0.603, 0.40]]],
  f: [[[0.22, 0], [0.22, 0.80], ...arc(0.35, 0.80, 0.13, 0.20, 180, 40, 4)],
      [[0.06, 0.44], [0.42, 0.44]]],
  g: [arc(LC, 0.31, 0.27, 0.31, 90, 450, 10),
      [[LR, XH], [LR, 0.02], ...arc(0.42, 0.02, 0.195, 0.18, 0, -170, 4)]],
  h: [[[LL, 0], [LL, 1]], [[LL, 0.44], ...arc(LC, 0.44, 0.27, 0.18, 180, 0, 4), [LR, 0]]],
  i: [[[0.15, 0], [0.15, XH]], [[0.15, 0.83], [0.15, 0.89]]],
  j: [[[0.20, XH], [0.20, -0.08], ...arc(0.10, -0.08, 0.10, 0.10, 0, -140, 4)],
      [[0.20, 0.83], [0.20, 0.89]]],
  k: [[[LL, 0], [LL, 1]], [[LL, 0.32], [0.60, XH]], [[0.28, 0.437], [LR, 0]]],
  l: [[[0.15, 0], [0.15, 1]]],
  m: [[[LL, 0], [LL, 0.44], ...arc(0.2325, 0.44, 0.1575, 0.18, 180, 0, 4), [0.39, 0],
      [0.39, 0.44], ...arc(0.5475, 0.44, 0.1575, 0.18, 180, 0, 4), [0.705, 0]]],
  n: [[[LL, 0], [LL, 0.44], ...arc(LC, 0.44, 0.27, 0.18, 180, 0, 4), [LR, 0]]],
  o: [arc(LC, 0.31, 0.27, 0.31, 90, 450, 10)],
  p: [[[LL, XH], [LL, DESC]], arc(LC, 0.31, 0.27, 0.31, 90, 450, 10)],
  q: [arc(LC, 0.31, 0.27, 0.31, 90, 450, 10), [[LR, XH], [LR, DESC]]],
  r: [[[LL, 0], [LL, 0.44], ...arc(0.26, 0.44, 0.185, 0.18, 180, 10, 4)]],
  s: [[...arc(0.315, 0.465, 0.24, 0.155, 30, 270, 5),
      ...arc(0.315, 0.155, 0.24, 0.155, 90, -150, 5)]],
  t: [[[0.20, 0.80], [0.20, 0.10], ...arc(0.33, 0.10, 0.13, 0.10, 180, 350, 4)],
      [[0.05, XH], [0.40, XH]]],
  u: [[[LL, XH], [LL, 0.18], ...arc(LC, 0.18, 0.27, 0.18, 180, 360, 4), [LR, XH]]],
  v: [[[LL, XH], [LC, 0], [LR, XH]]],
  w: [[[LL, XH], [0.27, 0], [0.45, 0.44], [0.63, 0], [0.825, XH]]],
  x: [[[LL, 0], [LR, XH]], [[LL, XH], [LR, 0]]],
  y: [[[LL, XH], [0.345, 0.06]], [[LR, XH], [0.345, 0.06], [0.205, -0.20]]],
  z: [[[LL, XH], [LR, XH], [LL, 0], [LR, 0]]],

  /* ================= punctuation & symbols ================= */
  ' ': [],
  '.': [[[0.15, 0], [0.15, 0.07]]],
  ',': [[[0.15, 0.08], [0.15, 0.01], [0.075, -0.12]]],
  ':': [[[0.15, 0.02], [0.15, 0.09]], [[0.15, 0.38], [0.15, 0.45]]],
  ';': [[[0.15, 0.09], [0.15, 0.02], [0.075, -0.12]], [[0.15, 0.38], [0.15, 0.45]]],
  '!': [[[0.14, 0.22], [0.14, 1]], [[0.14, 0], [0.14, 0.08]]],
  '?': [[...arc(0.30, 0.76, 0.19, 0.24, 170, -70, 6), [0.365, 0.32]],
        [[0.365, 0.02], [0.365, 0.10]]],
  '-': [[[0.06, 0.36], [0.38, 0.36]]],
  _: [[[0, -0.22], [0.60, -0.22]]],
  '+': [[[0.06, 0.36], [0.54, 0.36]], [[0.30, 0.12], [0.30, 0.60]]],
  '=': [[[0.06, 0.44], [0.54, 0.44]], [[0.06, 0.26], [0.54, 0.26]]],
  '/': [[[0.02, -0.06], [0.48, 1]]],
  '\\': [[[0.02, 1], [0.48, -0.06]]],
  '(': [arc(0.42, 0.36, 0.28, 0.62, 135, 225, 6)],
  ')': [arc(-0.06, 0.36, 0.28, 0.62, 45, -45, 6)],
  '[': [[[0.22, 0.80], [0.10, 0.80], [0.10, -0.08], [0.22, -0.08]]],
  ']': [[[0.10, 0.80], [0.22, 0.80], [0.22, -0.08], [0.10, -0.08]]],
  '{': [[[0.35, 0.80], [0.29, 0.80],
         ...arc(0.29, 0.72, 0.08, 0.08, 90, 180, 2),
         [0.21, 0.44],
         ...arc(0.13, 0.44, 0.08, 0.08, 0, -90, 2),
         ...arc(0.13, 0.28, 0.08, 0.08, 90, 0, 2),
         [0.21, 0],
         ...arc(0.29, 0, 0.08, 0.08, 180, 270, 2),
         [0.35, -0.08]]],
  '}': [[[0.36, 0.80], [0.30, 0.80],
         ...arc(0.30, 0.72, 0.08, 0.08, 90, 0, 2),
         [0.22, 0.44],
         ...arc(0.14, 0.44, 0.08, 0.08, 180, 270, 2),
         ...arc(0.14, 0.28, 0.08, 0.08, 90, 180, 2),
         [0.22, 0],
         ...arc(0.30, 0, 0.08, 0.08, 0, -90, 2),
         [0.36, -0.08]]],
  '<': [[[0.48, 0.58], [0.08, 0.32], [0.48, 0.06]]],
  '>': [[[0.08, 0.58], [0.48, 0.32], [0.08, 0.06]]],
  "'": [[[0.12, 1], [0.09, 0.72]]],
  '"': [[[0.10, 1], [0.07, 0.72]], [[0.24, 1], [0.21, 0.72]]],
  '`': [[[0.08, 1], [0.22, 0.76]]],
  '@': [arc(0.44, 0.45, 0.36, 0.45, 40, 305, 8),
        arc(0.40, 0.40, 0.13, 0.14, 20, 300, 5),
        [[0.53, 0.54], [0.53, 0.26], [0.70, 0.26]]],
  '#': [[[0.24, 0.06], [0.24, 0.84]], [[0.48, 0.06], [0.48, 0.84]],
        [[0.06, 0.28], [0.66, 0.28]], [[0.06, 0.60], [0.66, 0.60]]],
  $: [[...arc(0.36, 0.735, 0.29, 0.245, 30, 270, 5),
       ...arc(0.36, 0.245, 0.29, 0.245, 90, -150, 5)],
      [[0.36, -0.06], [0.36, 1.04]]],
  '%': [arc(0.20, 0.76, 0.15, 0.15, 90, 450, 8), arc(0.62, 0.24, 0.15, 0.15, 90, 450, 8),
        [[0.06, 0], [0.76, 1]]],
  // & : small loop up-left, wide bowl down-right, leg crossing the bowl's left
  // side and exiting at the baseline. The descent left of the loop is diagonal
  // on purpose, so the silhouette does not collapse into a 'b'.
  '&': [[...arc(0.30, 0.78, 0.16, 0.21, -20, 200, 5), [0.07, 0.40],
         ...arc(0.40, 0.24, 0.32, 0.24, 175, 350, 5), [0.78, 0.46]],
        [[0.46, 0.66], [0.0, 0.06]]],
  '*': [[[0.25, 0.44], [0.25, 0.76]], [[0.12, 0.50], [0.38, 0.70]],
        [[0.12, 0.70], [0.38, 0.50]]],
  '~': [[...arc(0.21, 0.30, 0.15, 0.10, 180, 0, 3), ...arc(0.51, 0.30, 0.15, 0.10, 180, 360, 3)]],
  '|': [[[0.15, -0.05], [0.15, 1]]],
  '\u00B7': [[[0.15, 0.32], [0.15, 0.40]]],                  // middle dot
  '\u00B0': [arc(0.20, 0.82, 0.13, 0.13, 90, 450, 8)],         // degree
  '\u00D7': [[[0.12, 0.50], [0.48, 0.14]], [[0.12, 0.14], [0.48, 0.50]]], // multiply
  '\u2026': [[[0.12, 0], [0.12, 0.07]], [[0.45, 0], [0.45, 0.07]],
             [[0.78, 0], [0.78, 0.07]]],                       // ellipsis
};

/* advance widths (em units). Digits are tabular: all 0.66. */
const ADV = {
  A: 0.78, B: 0.78, C: 0.78, D: 0.78, E: 0.78, F: 0.78, G: 0.78, H: 0.78,
  I: 0.30, J: 0.62, K: 0.78, L: 0.70, M: 1.02, N: 0.78, O: 0.78, P: 0.78,
  Q: 0.78, R: 0.78, S: 0.78, T: 0.76, U: 0.78, V: 0.78, W: 1.02, X: 0.78,
  Y: 0.78, Z: 0.74,

  0: 0.66, 1: 0.66, 2: 0.66, 3: 0.66, 4: 0.66,
  5: 0.66, 6: 0.66, 7: 0.66, 8: 0.66, 9: 0.66,

  a: 0.70, b: 0.70, c: 0.70, d: 0.70, e: 0.70, f: 0.52, g: 0.70, h: 0.70,
  i: 0.30, j: 0.36, k: 0.70, l: 0.30, m: 0.85, n: 0.70, o: 0.70, p: 0.70,
  q: 0.70, r: 0.50, s: 0.62, t: 0.52, u: 0.70, v: 0.70, w: 0.90, x: 0.70,
  y: 0.70, z: 0.70,

  '.': 0.30, ',': 0.30, ':': 0.30, ';': 0.30, '!': 0.28, '?': 0.60,
  '-': 0.44, _: 0.60, '+': 0.60, '=': 0.60, '/': 0.50, '\\': 0.50,
  '(': 0.32, ')': 0.32, '[': 0.32, ']': 0.32, '{': 0.40, '}': 0.40,
  '<': 0.56, '>': 0.56, "'": 0.24, '"': 0.34, '`': 0.30, '@': 0.86,
  '#': 0.72, $: 0.72, '%': 0.86, '&': 0.78, '*': 0.50, '~': 0.70, '|': 0.30,
  '\u00B7': 0.30, '\u00B0': 0.40, '\u00D7': 0.60, '\u2026': 0.90,
};

const SPACE_ADV = 0.5;      // em multiple used by advance(' ')
const UNKNOWN_ADV = 0.5;    // em multiple used for undrawable characters
const ASCENT = 1.0, DESCENT = -0.25;

/* ------------------------------------------------------------------ *
 *  public tables / API
 * ------------------------------------------------------------------ */

/** Glyph strokes in em units, keyed by character. Each glyph is a list of polylines. */
export const FONT = {};
for (const k in G) {
  const strokes = G[k].map(clean).filter((p) => p.length >= 2);
  FONT[k] = strokes;
}

/** Polylines for one character (em units). Empty array when the glyph is unknown. */
export function glyph(ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return [];
  const g = FONT[ch];
  return g === undefined ? [] : g;
}

function advEm(ch, spaceWidth) {
  if (ch === ' ') return spaceWidth;
  const a = ADV[ch];
  return a === undefined ? UNKNOWN_ADV : a;
}

/** Pen advance in world units for a glyph of cap height `size`. */
export function advance(ch, size) {
  const s = Number.isFinite(size) ? size : 1;
  if (typeof ch !== 'string' || ch.length === 0) return UNKNOWN_ADV * s;
  return advEm(ch, SPACE_ADV) * s;
}

function readOpts(opts) {
  const o = opts || {};
  return {
    letterSpacing: Number.isFinite(o.letterSpacing) ? o.letterSpacing : 0.06,
    align: o.align === 'center' || o.align === 'right' ? o.align : 'left',
    spaceWidth: Number.isFinite(o.spaceWidth) ? o.spaceWidth : SPACE_ADV,
  };
}

/** Total advance width of `str` in world units, including letter spacing. */
export function measure(str, size, opts) {
  const s = Number.isFinite(size) ? size : 1;
  const { letterSpacing, spaceWidth } = readOpts(opts);
  const chars = [...String(str === undefined || str === null ? '' : str)];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    w += advEm(chars[i], spaceWidth) * s;
    if (i < chars.length - 1) w += letterSpacing * s;
  }
  return w;
}

/** Lay a string out in world units: { width, height, polylines }. */
export function layout(str, size, opts) {
  const s = Number.isFinite(size) ? size : 1;
  const { letterSpacing, align, spaceWidth } = readOpts(opts);
  const chars = [...String(str === undefined || str === null ? '' : str)];
  const width = measure(chars.join(''), s, opts);

  const polylines = [];
  let pen = 0;
  for (let i = 0; i < chars.length; i++) {
    const g = FONT[chars[i]];
    if (g !== undefined) {
      for (let k = 0; k < g.length; k++) {
        const src = g[k];
        const out = new Array(src.length);
        for (let j = 0; j < src.length; j++) out[j] = [src[j][0] * s + pen, src[j][1] * s];
        polylines.push(out);
      }
    }
    pen += advEm(chars[i], spaceWidth) * s;
    if (i < chars.length - 1) pen += letterSpacing * s;
  }

  let dx = 0;
  if (align === 'center') dx = -width / 2;
  else if (align === 'right') dx = -width;
  if (dx !== 0) {
    for (let i = 0; i < polylines.length; i++) {
      const p = polylines[i];
      for (let j = 0; j < p.length; j++) p[j][0] = r5(p[j][0] + dx);
    }
  }

  return { width, height: (ASCENT - DESCENT) * s, polylines };
}
