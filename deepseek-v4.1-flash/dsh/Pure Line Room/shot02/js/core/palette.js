// palette.js — the ink-on-paper colour system, with a smooth day <-> night blend.
//
// The whole piece is drawn as filled paper-coloured facets + dark ink strokes.
// Every fill token resolves to an actual css colour at draw time, which is what
// makes the painter's algorithm produce real occlusion.

const DAY = {
  paper: [247, 245, 240],   // wall / main surface
  face1: [240, 237, 230],   // plane turned slightly away
  face2: [231, 227, 218],   // shaded plane
  face3: [220, 215, 205],   // deep shade (inside a cupboard, under furniture)
  glass: [236, 240, 240],   // window pane
  glow: [255, 246, 224],    // emissive surface (lit lampshade)
  dark: [46, 46, 52],       // the rare deliberate dark fill
  ink: [23, 23, 28],
  inkMid: [70, 70, 78],
  inkSoft: [128, 128, 136],
  accent: [176, 92, 62],    // warm terracotta used very sparingly
  sky: [232, 240, 246],
  skyLow: [246, 244, 232],
  skyLine: [186, 196, 206],
  sun: [214, 158, 76],
  hatch: [168, 168, 176],
};

const NIGHT = {
  paper: [30, 33, 42],
  face1: [36, 39, 49],
  face2: [26, 29, 37],
  face3: [20, 22, 29],
  glass: [22, 27, 40],
  glow: [255, 214, 142],
  dark: [12, 13, 17],
  ink: [232, 227, 214],
  inkMid: [168, 167, 160],
  inkSoft: [104, 106, 116],
  accent: [226, 152, 104],
  sky: [16, 21, 38],
  skyLow: [30, 38, 58],
  skyLine: [72, 84, 110],
  sun: [226, 226, 214],
  hatch: [92, 96, 110],
};

const KEYS = Object.keys(DAY);

/** Smoothly blend the two palettes. t = 0 day, 1 night. */
function mix(a, b, t) {
  const out = {};
  for (const k of KEYS) {
    const A = a[k], B = b[k];
    out[k] = [
      Math.round(A[0] + (B[0] - A[0]) * t),
      Math.round(A[1] + (B[1] - A[1]) * t),
      Math.round(A[2] + (B[2] - A[2]) * t),
    ];
  }
  return out;
}

export function rgb(c, alpha) {
  if (alpha === undefined || alpha >= 1) return `rgb(${c[0]},${c[1]},${c[2]})`;
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function shade(c, amount) {
  // amount < 0 darkens, > 0 lightens toward paper white
  const t = Math.abs(amount);
  const target = amount < 0 ? 0 : 255;
  return [
    Math.round(c[0] + (target - c[0]) * t),
    Math.round(c[1] + (target - c[1]) * t),
    Math.round(c[2] + (target - c[2]) * t),
  ];
}

export function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function makeTheme(nightT) {
  const t = Math.max(0, Math.min(1, nightT));
  const c = mix(DAY, NIGHT, t);
  const th = {
    ...c,
    nightT: t,
    /** convenient css getters */
    css: {},
    /** 0 during the day, 1 at night — for glow strength */
    glowStrength: t,
  };
  for (const k of KEYS) th.css[k] = rgb(c[k]);

  // Pre-resolved fill / stroke tokens used by content code.
  th.fill = {
    paper: c.paper,
    face1: c.face1,
    face2: c.face2,
    face3: c.face3,
    glass: c.glass,
    glow: c.glow,
    dark: c.dark,
  };
  th.stroke = {
    ink: c.ink,
    inkMid: c.inkMid,
    inkSoft: c.inkSoft,
    accent: c.accent,
  };

  // Sky gradient stops for the window.
  th.skyTop = c.sky;
  th.skyBottom = c.skyLow;
  th.skyLine = c.skyLine;
  th.sunColor = c.sun;
  th.hatchColor = c.hatch;

  return th;
}

export const PALETTE = { DAY, NIGHT, makeTheme, rgb, shade, mixColor };
export default PALETTE;
