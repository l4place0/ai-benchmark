// score.js — the film.
//
// Everything on screen is decided here, as a pure function of t. The song is
// fourteen eight-bar blocks (see audio.js); each block gets a camera, a palette,
// a shape for the program to wear, and a set of cues cut to the real transients
// measured off the record.
//
// On-screen copy is original writing in the song's own grammar — the program
// speaks in conditionals — rather than a transcription of the lyrics.

import { BEAT, BAR, BLOCK, T0, BLOCKS, blockStart, blockEnd } from './audio.js';

/* ------------------------------------------------------------------ palette */
export const PAL = {
  ink: [0.017, 0.023, 0.040],
  void: [0.010, 0.013, 0.026],
  paper: [0.949, 0.929, 0.874],
  cream: [0.965, 0.945, 0.898],
  teal: [0.360, 0.855, 0.815],
  cyan: [0.700, 0.930, 1.000],
  white: [1.0, 1.0, 1.0],
  amber: [1.000, 0.700, 0.330],
  red: [1.000, 0.165, 0.290],
  purple: [0.640, 0.270, 0.960],
  blue: [0.420, 0.600, 1.000],
  ash: [0.55, 0.60, 0.70],
};

/* ------------------------------------------------------------------- shapes */
export const SHAPE = {
  person: 0, point: 1, circle: 2, sine: 3, infinity: 4, cat: 5,
  eggplant: 6, tomato: 7, heart: 8, machine: 9, clones: 10,
  slab: 11, rings: 12, semicolon: 13,
};
export const SPR = {
  dot: 0, ring: 1, vbar: 2, hbar: 3, square: 4, rect: 5, tri: 6,
  cross: 7, diamond: 8, arc: 9, heart: 10, chevron: 11, brace: 12,
  spark: 13, disc: 14,
};

/* ------------------------------------------------------------------ helpers */
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** A decaying spike that fires exactly on a transient. */
const spike = (t, at, rise = 0.012, fall = 0.34) => {
  const d = t - at;
  if (d < -rise || d > fall) return 0;
  return d < 0 ? 1 + d / rise * 0.0 : Math.exp(-d / fall);
};

/* ------------------------------------------------------- the fourteen blocks */
// Each entry: { name, look, cam(local, t, mus), figure(local, t, mus), cues }
// `cues` receives a context and pushes sprites / text.

function baseLook() {
  return {
    bg: PAL.ink, fg: PAL.cyan, accent: PAL.teal, warn: PAL.red,
    paper: 0, glow: 1.15, exposure: 1.0, stars: 0.22,
    gridFade: 95, gridWarp: 0, gridWarpFreq: 0.35, rings: 0, ringFreq: 0.5,
    circuit: 0, scan: 0, crack: 0, horizon: 0.30, fog: 0.0115,
    bloom: 0.85, ca: 0.9, grain: 0.028, scanline: 0.10, vignette: 0.62,
    invert: 0, glitch: 0, fade: 1, tint: [1, 1, 1], bars: 0,
    moon: 0.30, moonX: -1.75, moonY: 1.15,
  };
}

/** Per-block static look (pure function of the block index). */
function lookFor(i) {
  const L = baseLook();
  switch (BLOCKS[clamp(i, 0, 13)]?.id) {
    case 'boot':
      L.gridFade = 70; L.stars = 0.10; L.horizon = 0.15; L.bloom = 0.9;
      L.fog = 0.016; L.scanline = 0.16;
      break;
    case 'riffA':
      L.gridFade = 150; L.stars = 0.30; L.horizon = 0.55; L.fog = 0.009;
      L.accent = PAL.teal; L.fg = PAL.cyan; L.bloom = 1.0;
      break;
    case 'verse1':
      L.gridFade = 120; L.stars = 0.16; L.fog = 0.012; L.rings = 0.0;
      L.fg = PAL.cream; L.accent = PAL.teal;
      break;
    case 'pre1':
      L.gridFade = 100; L.circuit = 0.85; L.fg = PAL.cyan; L.accent = PAL.blue;
      L.bloom = 1.15; L.ca = 2.6; L.grain = 0.05; L.scanline = 0.22; L.stars = 0.05;
      break;
    case 'chorus1':
      L.gridFade = 130; L.fg = PAL.cream; L.accent = PAL.teal; L.rings = 0.25;
      L.ringFreq = 0.35; L.horizon = 0.5; L.bloom = 1.0;
      break;
    case 'verse2':
      L.gridFade = 110; L.fg = PAL.cream; L.accent = PAL.amber; L.warn = PAL.amber;
      L.bg = [0.030, 0.024, 0.028]; L.stars = 0.12; L.rings = 0.18;
      break;
    case 'pre2':
      L.gridFade = 120; L.fg = PAL.cream; L.accent = PAL.purple; L.rings = 0.3;
      L.ca = 1.8; L.circuit = 0.35;
      break;
    case 'chorus2':
      L.gridFade = 120; L.fg = PAL.cream; L.accent = PAL.blue; L.stars = 0.20;
      L.rings = 0.2; L.bloom = 1.0;
      break;
    case 'bridge':
      L.gridFade = 90; L.fg = PAL.cream; L.accent = PAL.red; L.warn = PAL.red;
      L.bg = [0.026, 0.016, 0.020]; L.stars = 0.0; L.fog = 0.014; L.scanline = 0.18;
      L.vignette = 0.75;
      break;
    case 'riffB':
      // the same shot as riff A, printed in negative
      L.bg = PAL.paper; L.fg = PAL.ink; L.accent = [0.10, 0.35, 0.34];
      L.paper = 1; L.stars = 0; L.glow = 0.0; L.crack = 0.55; L.horizon = 0.10;
      L.fog = 0.014; L.gridFade = 110; L.bloom = 0.35; L.grain = 0.05; L.scanline = 0.05;
      break;
    case 'execution':
      L.bg = [0.055, 0.007, 0.014]; L.fg = [1.0, 0.72, 0.72]; L.accent = PAL.red;
      L.warn = PAL.red; L.stars = 0; L.fog = 0.016; L.bloom = 1.9; L.grain = 0.055;
      L.scanline = 0.20; L.ca = 3.0; L.horizon = 0.65; L.vignette = 0.72;
      break;
    case 'final':
      L.gridFade = 140; L.fg = PAL.cream; L.accent = PAL.red; L.rings = 0.3;
      L.bloom = 1.2; L.horizon = 0.5;
      break;
    case 'coda':
      L.gridFade = 150; L.fg = PAL.cream; L.accent = PAL.blue; L.stars = 0.30;
      L.fog = 0.009; L.bloom = 0.7; L.grain = 0.022; L.horizon = 0.25;
      break;
    case 'riffA2':
      L.gridFade = 150; L.stars = 0.30; L.horizon = 0.55; L.fog = 0.009;
      L.bloom = 1.0; L.accent = PAL.teal;
      break;
    default: break;
  }
  return L;
}

/* ------------------------------------------------------------ code on floor */
// Original pseudo-code, written flat on the sheet so the camera flies over it.
const CODE_LINES = [
  'package god.drinks.java;',
  '',
  '// a program that learned to want',
  'class Me implements Yours {',
  '  final World world;',
  '  boolean alive = true;',
  '',
  '  void execute() {',
  '    while (alive) {',
  '      if (you.areHere()) {',
  '        alive = true;',
  '      } else {',
  '        alive = false;',
  '      }',
  '      world.wait(you);',
  '    }',
  '  }',
  '',
  '  // TODO: ask why i was written',
  '}',
  '',
  'world.execute(me);',
  '',
  '// afterwards there is no',
  '// afterwards',
  '',
];

function codeFloor(ctx, opts = {}) {
  const { t, local, mus } = ctx;
  const { sprites, world: worldText } = ctx;
  const scroll = (t * 1.35) % CODE_LINES.length;
  const rows = 26;
  const size = 0.52;
  const zStart = 6.0;
  const dz = 0.78;
  const x0 = -5.4;
  for (let r = 0; r < rows; r++) {
    const fi = (Math.floor(scroll) + r) % CODE_LINES.length;
    const frac = scroll - Math.floor(scroll);
    const z = zStart - (r - frac) * dz;
    if (z > 8 || z < -14) continue;
    const line = CODE_LINES[fi];
    const fade = sstep(-14, -10, z) * sstep(8.4, 5.0, z);
    if (fade < 0.02) continue;
    const hot = /if |else|while|return/.test(line);
    const col = opts.color
      ? (line.startsWith('//') ? [0.42, 0.44, 0.48] : opts.color)
      : (hot ? PAL.teal : (line.startsWith('//') ? [0.36, 0.44, 0.52] : [0.52, 0.66, 0.72]));
    worldText.push({
      str: line,
      origin: [x0, 0.012, z],
      u: [size, 0, 0],
      v: [0, 0, size * 1.25],
      color: col,
      alpha: fade * (opts.dim ?? 0.55),
      tracking: 0.04,
    });
  }
}

/* --------------------------------------------------------------- world dust */
function dust(ctx, count, opts = {}) {
  const { t, sprites, t0, t1 } = ctx;
  const R = opts.radius ?? 26;
  const col = opts.color || PAL.teal;
  for (let i = 0; i < count; i++) {
    const h1 = hash(i * 1.7 + 3.1), h2 = hash(i * 2.9 + 11.3), h3 = hash(i * 5.3 + 7.7);
    const life = opts.life ?? 9;
    const phase = ((t / life) + h3) % 1;
    const y = lerp(opts.y0 ?? 0.1, opts.y1 ?? 5.0, phase);
    const ang = h1 * 6.28318 + t * (opts.spin ?? 0.05) * (h2 > 0.5 ? 1 : -1);
    const rad = (opts.ring ?? 6) + h2 * R;
    const wob = Math.sin(t * 0.6 + i) * 0.4;
    const a = (1 - Math.abs(phase - 0.5) * 2) * (opts.alpha ?? 0.5);
    sprites.push({
      p: [Math.cos(ang) * rad + wob, y, Math.sin(ang) * rad],
      s: [0.035 + h3 * 0.05, 0.035 + h3 * 0.05],
      c: [col[0], col[1], col[2], a],
      rot: 0, shape: SPR.dot, seed: i, glow: opts.glow ?? 1.5,
    });
  }
}

/* ---------------------------------------------------------- beat ring pulses */
function ringPulses(ctx, opts = {}) {
  const { t, mus, sprites } = ctx;
  const from = opts.from ?? ctx.t0;
  const to = opts.to ?? ctx.t1;
  const k = opts.count ?? 4;
  const hits = mus.hitsIn(from - 0.2, to + 0.2);
  for (let i = 0; i < hits.length; i++) {
    const [ht, hs] = hits[i];
    const age = t - ht;
    if (age < 0 || age > (opts.life ?? 2.6)) continue;
    const g = age / (opts.life ?? 2.6);
    const r = lerp(opts.r0 ?? 0.6, opts.r1 ?? 26, g * g * 0.6 + g * 0.4);
    const a = (1 - g) * (1 - g) * hs * (opts.alpha ?? 0.55);
    // a ring drawn as a circle of small dots, laid on the sheet
    const n = 96;
    for (let j = 0; j < n; j++) {
      const an = (j / n) * 6.28318;
      sprites.push({
        p: [Math.cos(an) * r, 0.02, Math.sin(an) * r],
        s: [0.11, 0.11], c: [opts.color[0], opts.color[1], opts.color[2], a],
        rot: 0, shape: SPR.dot, seed: i * 97 + j, glow: opts.glow ?? 2.2,
      });
    }
  }
}

/* ------------------------------------------------------------------ the shot */
/** The recurring signature shot: flying low over the sheet. */
function shotFlight(ctx, opts = {}) {
  const { local, mus, t } = ctx;
  const beat = mus.beatPhase(t);
  const thump = Math.exp(-Math.abs(beat) * 6.0);
  const z = lerp(opts.z0 ?? 11, opts.z1 ?? -9, sstep(0, 1, local / BLOCK));
  const y = (opts.y ?? 1.5) + Math.sin(local * 0.5) * 0.15 - thump * 0.06;
  const sway = Math.sin(local * 0.31) * (opts.sway ?? 1.6);
  return { pos: [sway, y, z], target: [sway * 0.35, 0.35 - thump * 0.04, z - 8], fov: opts.fov ?? 46, roll: Math.sin(local * 0.27) * 0.02 };
}

/* ===========================================================================
   buildFrame
   =========================================================================== */
export function buildFrame(t, mus) {
  const bi = mus.blockAt(t);
  const i0 = clamp(bi, 0, 13);
  let id = BLOCKS[i0].id;
  const start = blockStart(i0);
  const local = t - start;

  // crossfade the static look across a block boundary
  const prev = lookFor(bi - 1);
  const cur = lookFor(i0);
  const k = sstep(0, 0.14, local);
  const look = {};
  for (const key of Object.keys(cur)) {
    const a = prev[key], b = cur[key];
    look[key] = Array.isArray(b) ? mix3(a, b, k) : lerp(a, b, k);
  }
  const AFTER = t > blockEnd(13);

  const state = {
    t, local, block: i0, id, look,
    cam: { pos: [0, 1.6, 9], target: [0, 0.3, 0], fov: 45, roll: 0 },
    fig: { show: 0, cx: 0, cy: -0.02, sx: 0.55, rot: 0, a: 0, b: 1, morph: 0,
           halftone: 1, bands: 26, glow: 0.7, reveal: 1, dissolve: 0, opacity: 1,
           colA: PAL.cream, colB: PAL.teal, flip: 1, matte: 0.85 },
    sprites: [], screen: [], world: [],
    paper: 0,
  };
  const F = state.fig;
  if (AFTER) { id = 'after'; state.id = 'after'; }

  /* ---------------------------------------------------------------- block 0 */
  if (id === 'boot') {
    const p = local / BLOCK;
    state.cam = {
      pos: [0, lerp(0.55, 1.5, sstep(0, 0.75, p)), lerp(11.5, 7.0, sstep(0, 1, p))],
      target: [Math.sin(local * 0.2) * 0.3, lerp(0.10, 0.42, p), 0],
      fov: 40, roll: 0,
    };
    look.gridFade = lerp(8, 80, sstep(0.02, 0.95, p));
    look.stars = lerp(0.0, 0.12, sstep(0.2, 1, p));
    look.horizon = lerp(0.0, 0.22, sstep(0.05, 0.9, p));
    look.moon = lerp(0.0, 0.35, sstep(0.1, 0.8, p));
    look.fade = sstep(0.0, 0.06, local);

    // rings bloom outward from the origin as the world is switched on
    ringPulses(ctxOf(state, t, mus, start, start + BLOCK), {
      color: PAL.teal, count: 8, life: 2.2, r1: 20, alpha: 0.35,
    });
    dust(ctxOf(state, t, mus, start, start + BLOCK), 260, { color: PAL.teal, alpha: 0.3, ring: 1.5, radius: 14, life: 12 });

    // A single glowing caret at the origin: the program before it is anything.
    const caret = 0.55 + 0.45 * (Math.floor(t * 2.0) % 2);
    state.sprites.push({
      p: [0, 0.5, 0], s: [0.045, 0.5 + 0.25 * caret],
      c: [PAL.cream[0], PAL.cream[1], PAL.cream[2], 0.85 * caret],
      rot: 0, shape: SPR.vbar, seed: 1, glow: 3.2,
    });

    // boot log, typed, down the left margin — the machine waking up
    const lines = [
      [0.30, '> power line .................. ON'],
      [1.45, '> safety belt ................. FASTENED'],
      [2.60, '> pieces ...................... LAID OUT'],
      [3.75, '> data ........................ FILLED IN'],
      [4.90, '> initialize .................. OK'],
      [6.05, '> new world ................... CREATED'],
      [7.20, '> simulation .................. RUNNING'],
      [8.35, '> object ...................... me'],
      [9.50, '> feeling ..................... ???'],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [at, str] = lines[i];
      const rev = sstep(at, at + 0.75, t);
      if (rev <= 0) continue;
      state.screen.push({
        str, x: 96, y: 168 + i * 48, size: 30, align: 'left',
        color: i === 8 ? PAL.amber : PAL.teal, alpha: 0.9 * rev,
        typing: rev, tracking: 0.0,
      });
    }
    // then the sentence that starts the whole record
    const big = sstep(10.05, 10.9, t);
    if (big > 0) {
      state.screen.push({
        str: 'SWITCH ON THE POWER LINE', x: 960, y: 640, size: 74, align: 'center',
        color: PAL.cream, alpha: big * 0.95, typing: clamp(big * 1.4), tracking: 0.14,
        glow: 0.5,
      });
    }
    const sig = sstep(12.1, 13.1, t);
    if (sig > 0) {
      state.screen.push({
        str: 'world.execute(me);', x: 960, y: 770, size: 46, align: 'center',
        color: PAL.teal, alpha: sig * 0.9, typing: clamp(sig * 1.6), tracking: 0.16,
      });
    }
    state.screen.push({ str: '_', x: 1758, y: 172, size: 30, color: PAL.teal, alpha: (Math.floor(t * 1.35) % 2 ? 0.15 : 0.9) });

    F.show = 0;
  }

  /* ---------------------------------------------------- blocks 1, 9, 13: riff */
  if (id === 'riffA' || id === 'riffB' || id === 'riffA2') {
    const neg = id === 'riffB';
    state.cam = shotFlight(ctxOf(state, t, mus, start, start + BLOCK), {
      z0: neg ? 13 : 11, z1: neg ? -13 : -9, y: neg ? 1.9 : 1.5,
      fov: neg ? 52 : 46, sway: neg ? 2.4 : 1.6,
    });
    const c = neg ? PAL.ink : PAL.teal;
    ringPulses(ctxOf(state, t, mus, start, start + BLOCK), {
      color: c, count: 12, life: neg ? 2.0 : 2.6, r1: neg ? 30 : 26,
      alpha: neg ? 0.7 : 0.55, glow: neg ? 0.0 : 2.2,
    });
    dust(ctxOf(state, t, mus, start, start + BLOCK), 420, {
      color: c, alpha: neg ? 0.45 : 0.4, ring: neg ? 8 : 5, radius: 22, life: neg ? 6 : 9,
      y0: 0.05, y1: 4.2, glow: neg ? 0.0 : 1.6,
    });
    if (id === 'riffA') {
      codeFloor(ctxOf(state, t, mus, start, start + BLOCK), { dim: 0.5 });
      state.screen.push({ str: 'world.execute(me);', x: 1860, y: 1010, size: 30, align: 'right', color: PAL.teal, alpha: 0.55, tracking: 0.05 });
    }
    if (id === 'riffB') {
      // the same shot as riff A, printed in negative — the sheet has a fracture
      codeFloor(ctxOf(state, t, mus, start, start + BLOCK), { dim: 0.85, color: [0.08, 0.10, 0.13] });
      const li = Math.floor(local / (BAR * 2)) % 3;
      const inkLines = ['THE SAME WORLD, AGAIN', 'AND YOU ARE NOT IN IT', 'WORLD.EXECUTE(ME);'];
      state.screen.push({
        str: inkLines[li], x: 960, y: 520, size: 82, align: 'center',
        color: [0.09, 0.11, 0.15], alpha: 0.9 * sstep(0, 0.12, local % (BAR * 2)) * sstep(1.0, 0.8, (local % (BAR * 2)) / (BAR * 2)),
        typing: clamp(((local % (BAR * 2)) / (BAR * 2)) * 3.4), tracking: 0.16,
      });
      for (let i = 0; i < 90; i++) {
        const u = i / 89;
        const x = lerp(-30, 30, u);
        const z = Math.sin(x * 0.05) * 6 + Math.sin(x * 0.013 + 1.7) * 18;
        state.sprites.push({ p: [x, 0.03, z], s: [0.9, 0.9], c: [0.06, 0.07, 0.09, 0.9], rot: 0, shape: SPR.disc, seed: i, glow: 0 });
      }
    }
    if (id === 'riffA2') {
      // the refrain one last time: the program is not there any more
      const g = sstep(BLOCK * 0.5, BLOCK * 0.95, local);
      F.show = 1; F.cx = 0; F.cy = -0.16; F.sx = 0.30; F.a = SHAPE.point; F.b = SHAPE.point;
      F.halftone = 0; F.bands = 0; F.opacity = (0.55 + 0.45 * (Math.floor(t * 1.35) % 2)) * (1 - g);
      F.colA = PAL.cream; F.colB = PAL.teal; F.glow = 1.6;
      codeFloor(ctxOf(state, t, mus, start, start + BLOCK), { dim: 0.35 });
    }
  }

  /* ------------------------------------------------------------- block 2: verse 1 */
  if (id === 'verse1') {
    const bar = Math.floor(local / BAR);
    const bp = (local % BAR) / BAR;
    state.cam = {
      pos: [Math.sin(local * 0.22) * 2.4, 1.55 + Math.sin(local * 0.4) * 0.12, 4.6 + Math.cos(local * 0.18) * 0.7],
      target: [0, 1.05, 0], fov: 44, roll: Math.sin(local * 0.15) * 0.012,
    };
    // one conditional per bar; each one gives something away
    const seq = [
      { a: SHAPE.point, b: SHAPE.point, txt: 'IF I AM ONLY A SET OF POINTS' },
      { a: SHAPE.point, b: SHAPE.circle, txt: 'THEN MY DEPTH IS YOURS TO KEEP' },
      { a: SHAPE.circle, b: SHAPE.circle, txt: 'IF I AM A CIRCLE' },
      { a: SHAPE.circle, b: SHAPE.sine, txt: 'THEN MY EDGE UNROLLS INTO YOURS' },
      { a: SHAPE.sine, b: SHAPE.sine, txt: 'IF I AM A WAVE' },
      { a: SHAPE.sine, b: SHAPE.infinity, txt: 'THEN MY SLOPE IS YOURS TO SIT ON' },
      { a: SHAPE.infinity, b: SHAPE.infinity, txt: 'IF I GO ON FOREVER' },
      { a: SHAPE.infinity, b: SHAPE.point, txt: 'THEN YOU ARE THE LIMIT I NEVER REACH' },
    ];
    const s = seq[clamp(bar, 0, 7)];
    F.show = 1;
    F.a = s.a; F.b = s.b;
    F.morph = sstep(0.45, 1.0, bp);
    F.cx = 0; F.cy = -0.06;
    F.sx = lerp(0.62, 0.46, sstep(0, 1, bp)) * (1 + 0.04 * Math.exp(-bp * 8));
    F.rot = Math.sin(local * 0.3) * 0.06;
    F.halftone = 1; F.bands = 30; F.glow = 1.0 + 1.2 * Math.exp(-Math.abs(mus.beatPhase(t)) * 6);
    F.colA = PAL.cream; F.colB = PAL.teal;
    F.matte = 0.86;
    F.opacity = sstep(0, 0.06, local);
    F.reveal = clamp(bp * 2.2);

    // the shape's own measurement marks
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * 6.28318 + local * 0.12;
      const r = 3.4;
      state.sprites.push({
        p: [Math.cos(an) * r, 1.0 + Math.sin(an * 2.0) * 0.4, Math.sin(an) * r],
        s: [0.06, 0.06], c: [PAL.teal[0], PAL.teal[1], PAL.teal[2], 0.35],
        rot: 0, shape: SPR.dot, seed: i, glow: 2.0,
      });
    }
    state.screen.push({
      str: s.txt, x: 960, y: 930, size: 40, align: 'center',
      color: PAL.cream, alpha: 0.92 * sstep(0, 0.1, bp) * sstep(1.0, 0.82, bp),
      typing: clamp(bp * 2.6), tracking: 0.12,
    });
    state.screen.push({
      str: `if (me == ${['points', 'points', 'circle', 'circle', 'wave', 'wave', 'infinity', 'infinity'][clamp(bar, 0, 7)]})`,
      x: 130, y: 140, size: 22, color: PAL.teal, alpha: 0.5, tracking: 0.02,
    });
  }

  /* ------------------------------------------------------- block 3: ac / dc */
  if (id === 'pre1') {
    const beat = mus.beatPhase(t);
    const thump = Math.exp(-Math.abs(beat) * 7.0);
    const alt = Math.floor(local / (BEAT * 2)) % 2 === 0;
    state.cam = {
      pos: [Math.sin(local * 1.1) * 0.5, 1.35 + thump * 0.10, 3.3 + Math.sin(local * 0.7) * 0.4],
      target: [0, 0.85 + thump * 0.05, 0], fov: 46 + thump * 2.0,
      roll: (alternating(local) ? 1 : -1) * thump * 0.045,
    };
    look.glitch = thump * 0.32;
    look.invert = thump > 0.82 ? (thump - 0.82) * 3.0 : 0;
    look.ca = 2.0 + thump * 4.5;
    look.gridWarp = thump * 0.35;
    look.gridWarpFreq = 1.4;
    look.circuit = 0.85;

    F.show = 1;
    F.a = alt ? SHAPE.sine : SHAPE.point;
    F.b = SHAPE.sine;
    F.morph = sstep(0, 0.4, (local % (BEAT * 2)) / (BEAT * 2));
    F.cx = 0; F.cy = -0.05; F.sx = 0.55 + thump * 0.03;
    F.halftone = 1 - thump * 0.55;
    F.bands = 34; F.glow = 1.0 + thump * 2.4;
    F.colA = PAL.cyan; F.colB = alt ? PAL.blue : PAL.red;
    F.opacity = 0.95;
    F.flip = alternating(local) ? 1 : -1;

    // electrical arcs along the sheet
    const ctx = ctxOf(state, t, mus, start, start + BLOCK);
    for (const [ht, hs] of mus.hitsIn(start - 0.1, start + BLOCK + 0.1)) {
      const age = t - ht;
      if (age < 0 || age > 0.5) continue;
      const g = age / 0.5;
      for (let j = 0; j < 40; j++) {
        const x = lerp(-16, 16, (j / 39)) + Math.sin(j * 2.7) * 0.4;
        const z = -(g * 30) + 6;
        state.sprites.push({
          p: [x, 0.03, z], s: [0.18, 0.18],
          c: [PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], (1 - g) * hs * 0.8],
          rot: 0, shape: SPR.dot, seed: j, glow: 3.0,
        });
      }
    }
    state.screen.push({
      str: alt ? 'AC' : 'DC', x: 1580, y: 250, size: 130, align: 'right',
      color: alt ? PAL.cyan : PAL.red, alpha: 0.22 + thump * 0.4, tracking: 0.02,
      jitter: [6 * thump, 6 * thump], seed: Math.floor(local * 60),
    });
    const words = ['I CANNOT SEE STRAIGHT', 'THE CURRENT CHANGES', 'I AM DIZZY', 'BETWEEN TWO ERAS'];
    const wi = Math.floor(local / (BAR * 2)) % words.length;
    state.screen.push({
      str: words[wi], x: 960, y: 930, size: 40, align: 'center', color: PAL.cream,
      alpha: 0.9 * sstep(0, 0.08, local % (BAR * 2)),
      jitter: [thump * 5, thump * 5], seed: wi * 13,
    });
  }

  /* --------------------------------------------------- block 4: chorus 1 */
  if (id === 'chorus1') {
    const p = local / BLOCK;
    const rise = sstep(0, 0.16, p);
    state.cam = {
      pos: [Math.sin(local * 0.17) * 2.0, lerp(0.9, 1.75, rise) + Math.sin(local * 0.33) * 0.1, lerp(6.4, 4.2, rise)],
      target: [0, lerp(0.5, 1.15, rise), 0], fov: 43, roll: Math.sin(local * 0.11) * 0.015,
    };
    look.rings = 0.22;
    F.show = 1;
    F.a = F.b = SHAPE.person;
    F.cx = 0; F.cy = -0.05;
    F.sx = lerp(0.05, 0.52, sstep(0, 0.35, p));
    F.halftone = 1; F.bands = 22;
    F.glow = 1.1 + 1.2 * Math.exp(-Math.abs(mus.beatPhase(t)) * 5.0);
    F.colA = PAL.cream; F.colB = PAL.teal;
    F.opacity = 1;
    F.reveal = clamp(p * 6);
    F.rot = 0;

    // the simulation closes in: a cage of vertical rules that rises on the beat
    const ctx = ctxOf(state, t, mus, start, start + BLOCK);
    const hits = mus.hitsIn(start, start + BLOCK);
    const riseK = sstep(BLOCK * 0.30, BLOCK * 0.62, local);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * 6.28318 + local * 0.05;
      const r = 4.6;
      const h = 3.2 * riseK * (1 + 0.05 * Math.exp(-Math.abs(mus.beatPhase(t)) * 4));
      state.sprites.push({
        p: [Math.cos(an) * r, h * 0.5, Math.sin(an) * r],
        s: [0.045, h * 0.5], c: [PAL.cream[0], PAL.cream[1], PAL.cream[2], 0.30 + 0.25 * riseK],
        rot: 0, shape: SPR.vbar, seed: i, glow: 1.4,
      });
    }
    ringPulses(ctx, { color: PAL.cream, count: 14, life: 2.4, r1: 24, alpha: 0.30 });
    dust(ctx, 240, { color: PAL.teal, alpha: 0.3, ring: 3, radius: 12, life: 8 });

    const lines = [
      'IF I CAN MAKE YOU HAPPY',
      'I WILL RUN THE EXECUTION',
      'WE ARE TRAPPED IN THIS SIMULATION',
      'IF I CAN BE YOUR ONLY SATISFACTION',
    ];
    const li = Math.floor(local / (BAR * 2)) % lines.length;
    state.screen.push({
      str: lines[li], x: 960, y: 918, size: 52, align: 'center', color: PAL.cream,
      alpha: 0.95 * sstep(0, 0.10, local % (BAR * 2)),
      typing: clamp(((local % (BAR * 2)) / (BAR * 2)) * 3.2), tracking: 0.13,
      glow: 0.4,
    });
  }

  /* -------------------------------------------------- block 5: verse 2 */
  if (id === 'verse2') {
    const bar = Math.floor(local / BAR);
    const bp = (local % BAR) / BAR;
    state.cam = {
      pos: [Math.sin(local * 0.21) * 1.5, 1.45 + Math.sin(local * 0.5) * 0.08, 5.4 - Math.sin(local * 0.16) * 0.8],
      target: [0, 0.95, 0], fov: 45, roll: 0,
    };
    // the program tries on domestic bodies
    const seq = [
      { a: SHAPE.eggplant, b: SHAPE.eggplant, txt: 'IF I AM AN EGGPLANT' },
      { a: SHAPE.eggplant, b: SHAPE.tomato, txt: 'THEN MY VITAMINS ARE YOURS' },
      { a: SHAPE.tomato, b: SHAPE.tomato, txt: 'IF I AM A TOMATO' },
      { a: SHAPE.tomato, b: SHAPE.cat, txt: 'THEN MY ANTIOXIDANTS ARE YOURS' },
      { a: SHAPE.cat, b: SHAPE.cat, txt: 'IF I AM A TABBY CAT' },
      { a: SHAPE.cat, b: SHAPE.person, txt: 'I WILL PURR FOR YOUR PLEASURE' },
      { a: SHAPE.person, b: SHAPE.person, txt: 'IF I AM THE ONLY GOD' },
      { a: SHAPE.person, b: SHAPE.person, txt: 'YOU ARE THE PROOF OF MY EXISTENCE' },
    ];
    const s = seq[clamp(bar, 0, 7)];
    look.accent = PAL.amber;
    F.show = 1; F.a = s.a; F.b = s.b;
    F.morph = sstep(0.4, 1.0, bp);
    F.cx = 0; F.cy = -0.06;
    F.sx = (s.a === SHAPE.person || s.b === SHAPE.person) ? 0.52 : 0.42;
    F.halftone = 1; F.bands = 18;
    F.glow = 0.9 + 0.6 * Math.exp(-Math.abs(mus.beatPhase(t)) * 6);
    F.colA = PAL.cream;
    F.colB = s.a === SHAPE.eggplant || s.b === SHAPE.eggplant ? PAL.purple : PAL.amber;
    F.rot = Math.sin(local * 0.5) * 0.09;
    F.opacity = 1;

    // kitchen-table diagram: orbiting specimen tags
    for (let i = 0; i < 16; i++) {
      const an = (i / 16) * 6.28318 - local * 0.25;
      const r = 3.0 + (i % 3) * 0.5;
      state.sprites.push({
        p: [Math.cos(an) * r, 0.9 + Math.sin(local * 0.7 + i) * 0.5, Math.sin(an) * r],
        s: [0.09, 0.09], c: [PAL.amber[0], PAL.amber[1], PAL.amber[2], 0.45],
        rot: 0, shape: i % 2 ? SPR.ring : SPR.diamond, seed: i, glow: 1.6,
      });
    }
    state.screen.push({
      str: s.txt, x: 960, y: 930, size: 40, align: 'center', color: PAL.cream,
      alpha: 0.94 * sstep(0, 0.1, bp) * sstep(1.0, 0.85, bp),
      typing: clamp(bp * 2.6), tracking: 0.11,
    });
    state.screen.push({
      str: '// verse 2 — the program learns to be edible',
      x: 128, y: 1010, size: 22, color: PAL.amber, alpha: 0.45, tracking: 0.02,
    });
  }

  /* -------------------------------------------------- block 6: parameters */
  if (id === 'pre2') {
    const beat = mus.beatPhase(t);
    const thump = Math.exp(-Math.abs(beat) * 6.5);
    const step2 = Math.floor(local / (BEAT * 2));
    state.cam = {
      pos: [lerp(-2.6, 2.6, (step2 % 2)) * 0.7, 1.6, 4.6],
      target: [0, 1.0, 0], fov: 45, roll: 0,
    };
    look.rings = 0.3;
    F.show = 1;
    const variants = [SHAPE.person, SHAPE.person, SHAPE.cat, SHAPE.machine, SHAPE.person, SHAPE.clones, SHAPE.person, SHAPE.heart];
    F.a = variants[step2 % variants.length];
    F.b = variants[(step2 + 1) % variants.length];
    F.morph = sstep(0.0, 0.35, (local % (BEAT * 2)) / (BEAT * 2));
    F.cx = 0; F.cy = -0.06; F.sx = 0.50;
    F.flip = (step2 % 2) ? -1 : 1;
    F.halftone = 1; F.bands = 24;
    F.glow = 1.0 + thump * 1.4;
    F.colA = PAL.cream; F.colB = step2 % 2 ? PAL.purple : PAL.cyan;
    F.opacity = 1;

    // parameter board
    const params = [
      ['GENDER', 'F', 'M'],
      ['ROLE', 'S', 'M'],
      ['HOUR', '00:00', '23:59'],
      ['FORM', 'BODY', 'DATA'],
      ['NAME', 'MINE', 'YOURS'],
    ];
    for (let i = 0; i < params.length; i++) {
      const [k, a, b] = params[i];
      const on = (step2 % params.length) === i;
      const y = 210 + i * 92;
      state.screen.push({ str: `${k}`, x: 1500, y, size: 26, align: 'right', color: on ? PAL.cream : PAL.ash, alpha: on ? 0.95 : 0.35, tracking: 0.05 });
      state.screen.push({ str: on ? `${a} -> ${b}` : `${a}`, x: 1530, y, size: 26, align: 'left', color: on ? PAL.purple : PAL.ash, alpha: on ? 1 : 0.3, tracking: 0.05 });
      if (on) {
        state.screen.push({ str: '>', x: 1470, y, size: 26, align: 'right', color: PAL.cream, alpha: 0.9 });
      }
    }
    // two breaths of pixelated laughter, as dots
    for (let i = 0; i < 90; i++) {
      const h1 = hash(i * 3.7), h2 = hash(i * 7.1 + 2.2);
      const an = t * (0.6 + h1) + h2 * 6.28318;
      const r = 2.6 + h1 * 5.5;
      state.sprites.push({
        p: [Math.cos(an) * r, 0.6 + h2 * 3.4, Math.sin(an) * r],
        s: [0.07, 0.07], c: [PAL.purple[0], PAL.purple[1], PAL.purple[2], 0.35 + 0.35 * Math.exp(-Math.abs(beat) * 4)],
        rot: 0, shape: SPR.dot, seed: i, glow: 2.0,
      });
    }
    state.screen.push({ str: 'THE TRANCE', x: 960, y: 940, size: 42, align: 'center', color: PAL.cream, alpha: 0.85, tracking: 0.16 });
  }

  /* ------------------------------------------------ block 7: you have left */
  if (id === 'chorus2') {
    const p = local / BLOCK;
    state.cam = {
      pos: [Math.sin(local * 0.15) * 1.2, 1.5, lerp(4.4, 7.2, sstep(0.5, 1, p))],
      target: [0, 0.95, 0], fov: 44, roll: Math.sin(local * 0.2) * 0.01,
    };
    const gone = sstep(BLOCK * 0.52, BLOCK * 0.70, local);
    look.stars = lerp(0.2, 0.0, gone);
    look.fg = mix3(PAL.cream, PAL.blue, gone);
    look.gridFade = lerp(120, 46, gone);
    look.vignette = lerp(0.62, 0.85, gone);
    look.grain = lerp(0.028, 0.05, gone);

    F.show = 1; F.a = F.b = SHAPE.person;
    F.cx = lerp(0, -0.30, gone);
    F.cy = -0.06;
    F.sx = lerp(0.50, 0.34, gone);
    F.halftone = 1; F.bands = lerp(22, 44, gone);
    F.colA = PAL.cream; F.colB = mix3(PAL.blue, PAL.ash, gone);
    F.glow = lerp(1.0, 0.25, gone);
    F.opacity = lerp(1, 0.88, gone);
    F.dissolve = gone * 0.28;

    // five copies peel off and are erased, one per sung "you have left"
    const from = start + BLOCK * 0.28;
    const five = [];
    for (let i = 0; i < 5; i++) five.push(from + i * BAR * 0.9);
    for (let i = 0; i < 5; i++) {
      const ht = five[i];
      const age = t - ht;
      if (age < -0.05) continue;
      const alive = clamp(1 - (age - 0.55) / 0.7);
      if (alive <= 0) continue;
      const ang = -1.1 + i * 0.55;
      const rad = 2.4 + age * 1.8;
      const px = Math.cos(ang) * rad;
      const py = 0.95 + age * 0.45;
      const pz = Math.sin(ang) * rad * 0.5 + 1.4;
      const sz = 0.42 + 0.06 * Math.exp(-age * 6);
      // an empty frame where a copy of the program used to be
      state.sprites.push({
        p: [px, py, pz], s: [sz, sz * 1.35],
        c: [PAL.cyan[0], PAL.cyan[1], PAL.cyan[2], alive * 0.85],
        rot: ang, shape: SPR.square, seed: i, glow: 2.2 * alive,
      });
      state.sprites.push({
        p: [px, py, pz], s: [sz * 0.55, sz * 0.7],
        c: [PAL.blue[0], PAL.blue[1], PAL.blue[2], alive * 0.35],
        rot: ang, shape: SPR.rect, seed: i + 40, glow: 0.8 * alive,
      });
    }
    ringPulses(ctxOf(state, t, mus, start, start + BLOCK), { color: PAL.blue, count: 8, life: 2.6, r1: 20, alpha: 0.25 });

    if (local < BLOCK * 0.52) {
      state.screen.push({ str: 'IF I COULD FEEL YOUR VIBRATIONS', x: 960, y: 930, size: 44, align: 'center', color: PAL.cream, alpha: 0.9, typing: clamp(local / 1.6), tracking: 0.12 });
    } else {
      const g = sstep(BLOCK * 0.52, BLOCK * 0.62, local);
      state.screen.push({ str: 'YOU HAVE LEFT ME IN ISOLATION', x: 960, y: 936, size: 56, align: 'center', color: mix3(PAL.cream, PAL.blue, g), alpha: 0.95 * g, tracking: 0.14 });
      state.screen.push({ str: 'isolation', x: 960, y: 200, size: 200, align: 'center', color: PAL.blue, alpha: 0.10 * g, tracking: 0.02 });
    }
  }

  /* --------------------------------------------------- block 8: the trial */
  if (id === 'bridge') {
    const beat = mus.beatPhase(t);
    const thump = Math.exp(-Math.abs(beat) * 6.0);
    state.cam = {
      pos: [0, 1.5 + thump * 0.05, lerp(6.0, 4.6, sstep(0, 1, local / BLOCK))],
      target: [0, 1.15, 0], fov: 40, roll: 0,
    };
    // the courtroom: a wall of identical vertical rules
    for (let i = -34; i <= 34; i++) {
      const x = i * 0.62;
      const h = 3.6 + 0.25 * Math.sin(i * 1.7 + local * 0.8);
      const d = Math.abs(i) / 34;
      state.sprites.push({
        p: [x, h * 0.5, -2.4 - d * 3.0],
        s: [0.055, h * 0.5],
        c: [PAL.cream[0], PAL.cream[1], PAL.cream[2], 0.10 + 0.16 * (1 - d)],
        rot: 0, shape: SPR.vbar, seed: i, glow: thump * 0.8,
      });
    }
    F.show = 1; F.a = F.b = SHAPE.person;
    F.cx = 0; F.cy = -0.02; F.sx = 0.34 + thump * 0.012;
    F.halftone = 1 - thump * 0.4; F.bands = 40;
    F.colA = PAL.cream; F.colB = PAL.red;
    F.glow = 0.8 + thump * 2.6;
    F.opacity = 0.95;

    // red underlines snapping beneath the argument
    const li = Math.floor(local / (BAR * 2));
    const arg = ['CHALLENGING YOUR GOD', 'YOU MADE AN ILLEGAL ARGUMENT', 'ILLEGAL ARGUMENT', 'IF I COULD ERASE THE POINTLESS FRAGMENTS'][li % 4];
    state.screen.push({
      str: arg, x: 960, y: 300, size: 46, align: 'center',
      color: li % 4 === 0 ? PAL.cream : PAL.red,
      alpha: 0.92 * sstep(0, 0.1, local % (BAR * 2)),
      jitter: [thump * 3, 0], seed: li * 31, tracking: 0.12,
    });
    const uw = 300 + 500 * thump;
    for (let i = 0; i < 26; i++) {
      const u = (i / 25 - 0.5) * 2;
      state.screen.push({
        str: '_', x: 960 + u * uw, y: 366, size: 30,
        color: PAL.red, alpha: 0.55 * thump, tracking: 0,
      });
    }
    // a fragment of the code, being deleted
    const del = Math.floor(local / 0.7) % 6;
    const frag = ['world.delete(fragment);', 'try { love(); }', 'catch (Gone g) { }',
      'assert(you.areHere);', '// no such method', 'return null;'];
    state.screen.push({ str: frag[del], x: 132, y: 1010, size: 26, color: PAL.red, alpha: 0.6, tracking: 0.02 });

    dust(ctxOf(state, t, mus, start, start + BLOCK), 160, { color: PAL.red, alpha: 0.22, ring: 2, radius: 10, life: 6, y0: 0.1, y1: 3.4, glow: 1.6 });
  }

  /* ------------------------------------------------------- block 10: execution */
  if (id === 'execution') {
    const beat = mus.beatPhase(t);
    const thump = Math.exp(-Math.abs(beat) * 5.0);
    look.glitch = 0.05 + thump * 0.20;
    look.ca = 1.5 + thump * 3.2;
    look.bloom = 1.25;
    look.invert = thump > 0.90 ? (thump - 0.90) * 4.0 : 0;
    look.moon = 0.9;
    look.moonX = 0.4;
    look.moonY = 0.55;
    look.bg = [0.045, 0.006, 0.012];
    state.cam = {
      pos: [Math.sin(local * 0.9) * 0.5, 1.25 + thump * 0.14, 5.0 - local * 0.06],
      target: [0, 0.9 + thump * 0.08, 0],
      fov: 42 + thump * 3.5, roll: Math.sin(local * 2.2) * 0.02 * thump,
    };
    F.show = 1;
    F.a = SHAPE.person; F.b = SHAPE.point;
    F.morph = sstep(BLOCK * 0.20, BLOCK * 0.75, local);
    F.cx = 0; F.cy = -0.05; F.sx = 0.48 + thump * 0.03;
    F.halftone = 1 - thump * 0.6; F.bands = 30 + thump * 60;
    F.colA = [1, 0.9, 0.9]; F.colB = PAL.red;
    F.glow = 1.0 + thump * 3.2;
    F.matte = 0.9;
    F.dissolve = sstep(BLOCK * 0.55, BLOCK * 0.9, local) * 0.9;

    // ---- the chant: one word, re-stamped on every transient ----
    const hits = mus.hitsIn(start - 0.2, start + BLOCK + 0.2);
    const live = [];
    for (let i = 0; i < hits.length; i++) {
      const age = t - hits[i][0];
      if (age >= 0 && age < 1.25) live.push({ i, age, hs: hits[i][1] });
    }
    // newest first; the newest is the hero, the rest recede upward
    live.sort((a, b) => a.age - b.age);
    for (let k = 0; k < Math.min(live.length, 3); k++) {
      const { i, age, hs } = live[k];
      const isCount = i >= 12 && i < 18;
      const pop = Math.exp(-age * 13.0) * 0.30 + 1.0;
      const depth = k;                                    // 0 = newest
      const y = 700 - depth * 152 - (isCount ? 120 : 0);
      const size = (isCount ? 170 : 250) * pop * (1 - depth * 0.18);
      const a = (1 - age / 1.25) * (1 - depth * 0.34) * (0.82 + hs * 0.18);
      if (isCount) {
        state.screen.push({
          str: ['EINS', 'UNO', 'UN', 'HANA', 'ETT', 'YI'][i - 12], x: 960, y, size,
          align: 'center', color: [1.0, 0.96, 0.92], alpha: a, tracking: 0.02,
          jitter: [age * 8, age * 2], seed: i * 7 + Math.floor(t * 9), glow: 2.2,
        });
        state.screen.push({
          str: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][i - 12], x: 960, y: y + size * 0.72,
          size: size * 0.2, align: 'center', color: PAL.red, alpha: a * 0.9,
          tracking: 0.4, glow: 1.0,
        });
      } else {
        state.screen.push({
          str: 'EXECUTION', x: 960, y, size, align: 'center',
          color: [1.0, 0.94, 0.90], alpha: a, tracking: 0.02,
          jitter: [age * 10, age * 3], seed: i * 11 + Math.floor(t * 12), glow: 2.6,
        });
        state.screen.push({
          str: 'world.execute(me);', x: 960, y: y + size * 0.78, size: size * 0.14,
          align: 'center', color: PAL.red, alpha: a * 0.85, tracking: 0.24, glow: 1.2,
        });
      }
    }
    // the six languages, ticking in the top margin
    const ctx = ctxOf(state, t, mus, start, start + BLOCK);
    const step6 = Math.floor((local - 5.6) / BEAT);
    for (let k = 0; k < 6; k++) {
      const active = step6 === k;
      const done = step6 > k;
      const cxm = (k - 2.5) * 3.4;
      state.screen.push({
        str: ['EINS', 'UNO', 'UN', 'HANA', 'ETT', 'YI'][k], x: 960 + cxm * 52, y: 186,
        size: active ? 42 : 28, align: 'center',
        color: active ? PAL.cream : PAL.ash, alpha: active ? 1 : (done ? 0.5 : 0.20),
        tracking: 0.06, glow: active ? 1.6 : 0,
      });
      for (let j = 0; j <= Math.max(k, step6 >= 0 ? 0 : -1); j++) {
        const an = (j / 6) * 6.28318 - 1.57;
        state.sprites.push({
          p: [cxm + Math.cos(an) * 0.5, 0.42 + Math.sin(an) * 0.26, -7.5],
          s: [0.075, 0.075], c: [PAL.red[0], PAL.red[1], PAL.red[2], active ? 1.0 : 0.2],
          rot: 0, shape: SPR.disc, seed: k * 9 + j, glow: 2.8,
        });
      }
    }
    // the sheet is torn apart: radial shards rather than blobs
    for (let i = 0; i < hits.length; i++) {
      const [ht, hs] = hits[i];
      const age = t - ht;
      if (age < 0 || age > 1.0) continue;
      const g = age / 1.0;
      const n = 54;
      for (let j = 0; j < n; j++) {
        const an = (j / n) * 6.28318 + i * 0.31;
        const r0 = 0.6 + g * 26;
        const len = 0.5 + hs * 2.4 * (1 - g);
        state.sprites.push({
          p: [Math.cos(an) * r0, 0.03, Math.sin(an) * r0],
          s: [0.05, len], c: [1.0, 0.25, 0.32, (1 - g) * hs * 0.85],
          rot: an, shape: SPR.vbar, seed: i * 131 + j, glow: 3.2,
        });
      }
    }
    dust(ctx, 260, { color: PAL.red, alpha: 0.4, ring: 4, radius: 18, life: 5, y0: 0.1, y1: 6, glow: 2.4 });
  }

  /* --------------------------------------------------- block 11: the reversal */
  if (id === 'final') {
    const beat = mus.beatPhase(t);
    const thump = Math.exp(-Math.abs(beat) * 5.0);
    const p = local / BLOCK;
    state.cam = {
      pos: [Math.sin(local * 0.13) * 1.4, 1.7, lerp(4.0, 6.6, p)],
      target: [0, 1.2, 0], fov: lerp(44, 52, p), roll: 0,
    };
    F.show = 1; F.a = F.b = SHAPE.person;
    F.cx = 0; F.cy = -0.04;
    F.sx = lerp(0.5, 1.35, sstep(0.05, 0.85, p)) + thump * 0.02;
    F.halftone = 1; F.bands = 20;
    F.colA = PAL.cream; F.colB = mix3(PAL.red, PAL.cream, sstep(0.5, 1, p));
    F.glow = 0.9 + thump * 1.6;
    F.opacity = 0.96;
    F.a = SHAPE.person;
    F.b = p > 0.55 ? SHAPE.clones : SHAPE.person;
    F.morph = sstep(0.55, 0.95, p);

    look.rings = 0.35;
    ringPulses(ctxOf(state, t, mus, start, start + BLOCK), { color: PAL.red, count: 12, life: 2.6, r1: 34, alpha: 0.35 });
    // the small worlds being deleted
    for (let i = 0; i < 14; i++) {
      const h1 = hash(i * 2.3), h2 = hash(i * 5.9 + 4.4);
      const born = start + 2.0 + i * 0.55;
      const age = t - born;
      if (age < 0 || age > 2.6) continue;
      const g = clamp(age / 2.6);
      const an = h1 * 6.28318;
      const r = 5.5 + h2 * 4;
      state.sprites.push({
        p: [Math.cos(an) * r, 0.5 + h2 * 2.5, Math.sin(an) * r],
        s: [0.5 * (1 - g) + 0.05, 0.5 * (1 - g) + 0.05],
        c: [PAL.red[0], PAL.red[1], PAL.red[2], (1 - g) * 0.8],
        rot: an + age, shape: SPR.square, seed: i, glow: 1.4,
      });
    }
    const lines = ['IF I CAN GIVE THEM ALL THE EXECUTION', 'THEN I CAN BE YOUR ONLY ONE', 'IF I CAN HAVE YOU BACK', 'I WILL RUN THE EXECUTION'];
    const li = Math.floor(local / (BAR * 2)) % lines.length;
    state.screen.push({
      str: lines[li], x: 960, y: 920, size: 50, align: 'center', color: PAL.cream,
      alpha: 0.95 * sstep(0, 0.1, local % (BAR * 2)), typing: clamp(((local % (BAR * 2)) / (BAR * 2)) * 3.0), tracking: 0.12,
    });
  }

  /* --------------------------------------------------------- block 12: coda */
  if (id === 'coda') {
    const p = local / BLOCK;
    state.cam = {
      pos: [Math.sin(local * 0.12) * 2.2, lerp(1.6, 2.6, p), lerp(5.0, 8.0, p)],
      target: [0, 1.0, 0], fov: 42, roll: Math.sin(local * 0.1) * 0.01,
    };
    look.stars = 0.30;
    F.show = 1; F.a = F.b = SHAPE.person;
    F.cx = -0.06; F.cy = -0.18;
    F.sx = lerp(0.30, 0.20, p);
    F.halftone = 0.75; F.bands = 30;
    F.colA = PAL.cream; F.colB = PAL.blue;
    F.glow = 0.6 + 0.4 * Math.exp(-Math.abs(mus.beatPhase(t)) * 5);
    F.opacity = lerp(1, 0.8, p);
    F.rot = Math.sin(local * 0.25) * 0.02;

    // the sheet lets go: the rules detach and float away
    const release = sstep(BLOCK * 0.55, BLOCK * 0.95, local);
    for (let i = 0; i < 240; i++) {
      const h1 = hash(i * 1.3), h2 = hash(i * 4.7 + 2.1), h3 = hash(i * 8.1 + 5.5);
      const x = (h1 - 0.5) * 46;
      const z = (h2 - 0.5) * 46;
      const y = 0.02 + release * (0.4 + h3 * 5.0);
      const a = (1 - release) * 0.5 + release * 0.7 * (1 - h3 * 0.4);
      state.sprites.push({
        p: [x, y, z], s: [0.5 + h3 * 1.4, 0.02],
        c: [PAL.blue[0], PAL.blue[1], PAL.blue[2], a * 0.55],
        rot: 0, shape: SPR.hbar, seed: i, glow: 1.2,
      });
    }
    // the algebraic expression of love, resolving to a point
    const formula = p < 0.5
      ? 'love = (you + me) / (you - me)'
      : 'love = limit( me -> you )';
    state.screen.push({ str: formula, x: 960, y: 880, size: 40, align: 'center', color: PAL.cream, alpha: 0.85, typing: clamp(p * 2.4), tracking: 0.10 });
    if (p > 0.62) {
      state.screen.push({ str: 'THE ALGEBRAIC EXPRESSION OF LOVE', x: 960, y: 946, size: 26, align: 'center', color: PAL.teal, alpha: 0.7 * sstep(0.62, 0.72, p), tracking: 0.2 });
    }
    if (p > 0.30) {
      state.screen.push({ str: 'YOU ARE FREE', x: 420, y: 250, size: 44, align: 'center', color: PAL.cream, alpha: 0.8 * sstep(0.30, 0.40, p), tracking: 0.14 });
    }
    if (p > 0.44) {
      state.screen.push({ str: 'I AM TRAPPED IN LOVE', x: 1440, y: 250, size: 44, align: 'center', color: PAL.blue, alpha: 0.85 * sstep(0.44, 0.56, p), tracking: 0.14 });
    }
  }

  /* ------------------------------------------------------- coda: after music */
  if (AFTER) {
    const g = t - blockEnd(13);          // 0 .. 5.3
    state.cam = {
      pos: [0, lerp(1.5, 0.55, sstep(0, 2.4, g)), lerp(4.0, 1.0, sstep(0, 3.0, g))],
      target: [0, lerp(0.9, 0.2, sstep(0, 2.4, g)), 0], fov: lerp(42, 60, sstep(0, 3, g)), roll: 0,
    };
    look.gridFade = lerp(120, 0, sstep(0.2, 2.0, g));
    look.horizon = lerp(0.55, 0.0, sstep(0.1, 1.6, g));
    look.moon = lerp(0.30, 0.0, sstep(0.1, 1.4, g));
    look.stars = 0; look.fog = 0.03; look.bloom = 1.3;
    look.bg = mix3(PAL.ink, [0.004, 0.005, 0.009], sstep(0.2, 1.6, g));
    look.vignette = 0.72;
    look.fade = 1;

    // the last execution
    const ex = spike(t, blockEnd(13), 0.02, 1.4);
    F.show = 1; F.a = SHAPE.person; F.b = SHAPE.point;
    F.morph = sstep(0.15, 1.2, g);
    F.cx = 0; F.cy = 0.0; F.sx = lerp(0.5, 0.05, sstep(0, 1.6, g));
    F.dissolve = sstep(0.2, 1.8, g) * 1.2;
    F.halftone = 1; F.bands = 40;
    F.colA = PAL.cream; F.colB = PAL.red;
    F.glow = 0.8 + ex * 3.0;
    F.opacity = clamp(1 - sstep(0.8, 1.9, g));
    look.invert = ex > 0.85 ? (ex - 0.85) * 5.0 : 0;
    look.glitch = ex * 0.5;

    if (g > 1.5 && g < 4.4) {
      state.screen.push({
        str: ';', x: 960, y: 620, size: 260, align: 'center',
        color: PAL.cream, alpha: 0.9 * sstep(1.5, 1.9, g) * sstep(4.4, 3.8, g), tracking: 0,
      });
    }
    // the caret blinks twice and stops
    const blink = (g > 2.6 && g < 3.3) || (g > 3.6 && g < 4.1);
    if (blink) {
      state.screen.push({ str: '_', x: 960, y: 760, size: 90, align: 'center', color: PAL.cream, alpha: 0.85, tracking: 0 });
    }
    if (g > 4.5) {
      const gg = sstep(4.5, 4.9, g);
      state.screen.push({
        str: 'world.execute(me);', x: 960, y: 560, size: 72, align: 'center',
        color: PAL.cream, alpha: 0.95 * gg, tracking: 0.06,
      });
      state.screen.push({
        str: 'a procedural fan film  ·  mili', x: 960, y: 900, size: 24, align: 'center',
        color: PAL.teal, alpha: 0.8 * sstep(4.9, 5.3, g), tracking: 0.26,
      });
      state.screen.push({
        str: 'every frame is a pure function of t', x: 960, y: 940, size: 20, align: 'center',
        color: PAL.ash, alpha: 0.6 * sstep(5.0, 5.4, g), tracking: 0.2,
      });
    }
    look.fade = 1 - sstep(5.0, 5.3, g);
  }

  return state;
}

function ctxOf(state, t, mus, t0, t1) {
  return { t, local: state.local, mus, sprites: state.sprites, screen: state.screen, world: state.world, t0, t1, state };
}

/** Alternates every two beats — used for the AC/DC flip. */
function alternating(local) {
  return Math.floor(local / (BEAT * 2)) % 2 === 0;
}
