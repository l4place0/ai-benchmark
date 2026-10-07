// score.js — the MV's "score": sections, lyric cues, camera choreography and
// every animated parameter. visualAt(t) is a PURE function of t.
//
// Musical grid (measured from the recording):
//   130.2 BPM pulse, 65.1 BPM beat, bar = 1.840 s, 4/4.
//   Section boundaries sit on bar lines; lyric lines occupy 2 bars each.

export const DURATION = 222.0;          // seconds of finished video (> song 211.91)
export const FPS = 60;
export const TOTAL_FRAMES = Math.round(DURATION * FPS);

export const BAR = 1.8404;
export const BAR0 = 0.3168;             // time of bar 0
export const bar = (n) => BAR0 + n * BAR;

const L = (t, text) => ({ t, text });

/* ------------------------------------------------------------------ *
 *  sections
 * ------------------------------------------------------------------ */
export const SECTIONS = [
  { id: 'boot', t0: 0.00, t1: 0.60, name: 'power on' },
  {
    id: 'v1', t0: 0.60, t1: 15.04, name: 'object creation',
    lines: [
      L(0.99, 'Switch on the power line,'),
      L(4.67, 'remember to put on protection'),
      L(8.35, 'Lay down your pieces and'),
      L(12.03, "let's begin object creation"),
    ],
  },
  { id: 'link', t0: 15.04, t1: 29.76, name: 'the world appears' },
  {
    id: 'v2', t0: 29.76, t1: 44.48, name: 'geometry of love',
    lines: [
      L(29.76, "If I'm a set of points,"),
      L(33.44, 'then I will give you my dimension'),
      L(37.12, "If I'm a circle, then I"),
      L(40.80, 'will give you my circumference'),
    ],
  },
  {
    id: 'pc1', t0: 44.48, t1: 59.20, name: 'ac / dc',
    lines: [
      L(44.48, 'Switch my current to AC to DC'),
      L(48.16, 'And then blind my vision,'),
      L(51.84, 'so dizzy, so dizzy'),
      L(55.52, 'Oh, we can travel to A.D to B.C'),
    ],
  },
  {
    id: 'ch1', t0: 59.20, t1: 73.92, name: 'run the execution',
    lines: [
      L(59.20, 'If I can, if I can,'),
      L(62.88, 'give you all the stimulations'),
      L(66.56, 'If I can make you happy,'),
      L(70.24, 'I will run the execution'),
    ],
  },
  {
    id: 'v3', t0: 73.92, t1: 88.64, name: 'eggplant / tomato / cat / god',
    lines: [
      L(73.92, "If I'm an eggplant,"),
      L(77.60, 'then I will give you my nutrients'),
      L(81.28, "If I'm a tabby cat,"),
      L(84.96, 'I will purr for your enjoyment'),
    ],
  },
  {
    id: 'pc2', t0: 88.64, t1: 103.36, name: 'f to m, am to pm, s to m',
    lines: [
      L(88.64, 'Switch my gender to F to M'),
      L(92.32, 'And then do whatever from AM to PM'),
      L(96.00, 'Oh, switch my role to S to M'),
      L(99.68, 'So we can enter the trance'),
    ],
  },
  {
    id: 'bridge', t0: 103.36, t1: 129.12, name: 'isolation',
    lines: [
      L(103.36, 'If I can, if I can, feel your vibrations'),
      L(107.04, 'Then I can, then I can finally be completion'),
      L(110.72, 'Though you have left, you have left'),
      L(114.40, 'You have left me in isolation'),
      L(118.08, 'If I can, if I can, erase all the pointless fragments'),
      L(121.76, 'Then maybe you will not leave me so disheartened'),
      L(125.44, 'Challenging your God — illegal arguments'),
    ],
  },
  { id: 'break', t0: 129.12, t1: 147.52, name: 'the void' },
  {
    id: 'exec', t0: 147.52, t1: 163.84, name: 'EXECUTION',
    lines: [
      L(147.52, 'Execution, execution'),
      L(151.20, 'Execution, execution'),
      L(154.88, 'Execution, execution'),
      L(158.56, 'Ein, dos, trois, 네, fem, 六'),
      L(162.24, 'EXECUTION'),
    ],
  },
  {
    id: 'ch3', t0: 163.84, t1: 175.68, name: 'final chorus',
    lines: [
      L(163.84, 'If I can, if I can give them all the execution'),
      L(167.52, 'Then I can be your only execution'),
      L(171.20, 'If I can have you back, I will run the execution'),
    ],
  },
  {
    id: 'outro', t0: 175.68, t1: 187.52, name: 'algebraic expression of love',
    lines: [
      L(175.68, "I've studied how to properly love"),
      L(178.68, 'Question me, I can answer all love'),
      L(181.68, 'I know the algebraic expression of love'),
      L(184.68, 'Though you are free, I am trapped in love'),
    ],
  },
  { id: 'coda', t0: 187.52, t1: 211.91, name: 'trapped in love' },
  { id: 'post', t0: 211.91, t1: DURATION, name: 'world.execute(me);' },
];

export function sectionAt(t) {
  for (const s of SECTIONS) if (t >= s.t0 && t < s.t1) return s;
  return SECTIONS[SECTIONS.length - 1];
}

/* ------------------------------------------------------------------ *
 *  helpers
 * ------------------------------------------------------------------ */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, x) => a + (b - a) * x;
/** smooth 0..1 ramp between t0 and t1 */
const seg = (t, t0, t1) => {
  const x = clamp((t - t0) / Math.max(1e-5, t1 - t0));
  return x * x * (3 - 2 * x);
};
/** 1 inside [a,b] with soft edges of width w */
const win = (t, a, b, w = 0.5) => seg(t, a - w, a + w) * (1 - seg(t, b - w, b + w));
const sin = Math.sin, cos = Math.cos, PI = Math.PI;

/* ------------------------------------------------------------------ *
 *  camera
 * ------------------------------------------------------------------ */
// each entry: [sectionId, azimuth(rad), radius, height, targetY, roll, fov]
const CAM = {
  boot: { az: -0.4, r: 9.5, y: 1.2, ty: 0.0, roll: 0.0, fov: 1.15, spin: 0.02 },
  v1: { az: -0.4, r: 8.2, y: 1.0, ty: 0.0, roll: 0.0, fov: 1.15, spin: 0.030 },
  link: { az: 0.5, r: 11.5, y: 2.6, ty: 0.0, roll: 0.02, fov: 1.05, spin: 0.028 },
  v2: { az: 2.1, r: 6.4, y: 1.6, ty: 0.1, roll: 0.0, fov: 1.05, spin: 0.045 },
  pc1: { az: 3.4, r: 4.6, y: 0.4, ty: 0.0, roll: 0.6, fov: 1.35, spin: 0.12 },
  ch1: { az: 4.6, r: 7.0, y: 2.2, ty: 0.0, roll: 0.0, fov: 1.10, spin: 0.055 },
  v3: { az: 6.0, r: 5.2, y: 0.8, ty: 0.1, roll: 0.0, fov: 1.20, spin: 0.050 },
  pc2: { az: 7.2, r: 4.2, y: 0.2, ty: 0.0, roll: -0.9, fov: 1.40, spin: 0.16 },
  bridge: { az: 8.4, r: 12.5, y: 5.0, ty: 0.6, roll: 0.1, fov: 1.00, spin: 0.020 },
  break: { az: 9.6, r: 17.0, y: 7.5, ty: 0.0, roll: 0.05, fov: 0.85, spin: 0.012 },
  exec: { az: 11.0, r: 6.0, y: 1.0, ty: 0.0, roll: 0.0, fov: 1.25, spin: 0.30 },
  ch3: { az: 12.6, r: 3.6, y: 0.6, ty: 0.0, roll: 0.2, fov: 1.30, spin: 0.10 },
  outro: { az: 14.0, r: 5.0, y: 0.9, ty: 0.1, roll: 0.0, fov: 1.15, spin: 0.035 },
  coda: { az: 15.4, r: 13.0, y: 3.4, ty: 0.2, roll: 0.0, fov: 0.95, spin: 0.018 },
  post: { az: 16.4, r: 7.0, y: 0.6, ty: 0.0, roll: 0.0, fov: 1.10, spin: 0.02 },
};

function cameraAt(t, music) {
  const s = sectionAt(t);
  const c = CAM[s.id];
  const local = t - s.t0;
  const dur = s.t1 - s.t0;
  const u = clamp(local / Math.max(0.001, dur));

  // continuous azimuth: 0 at t=0, then advance at the section's spin rate
  let az = c.az;
  az += local * c.spin;

  // radius breathes with the music and eases across the section
  const breathe = 1 + 0.10 * sin(t * 0.31) + 0.055 * music.pulse(t, 5.0);
  const r = c.r * breathe;

  // gentle handheld float, deterministic
  const fx = 0.16 * sin(t * 0.77) + 0.07 * sin(t * 1.93 + 1.1);
  const fy = 0.13 * sin(t * 0.61 + 2.2) + 0.05 * sin(t * 2.31);
  const fz = 0.18 * sin(t * 0.53 + 0.7);

  const px = cos(az) * r + fx;
  const pz = sin(az) * r + fz;
  const py = c.y + fy + (s.id === 'boot' ? 0.4 : 0);

  const ty = c.ty + 0.10 * sin(t * 0.41);
  const roll = c.roll + 0.05 * sin(t * 0.37);
  const fov = c.fov * (1 + 0.05 * music.bassAt(t));

  return { pos: [px, py, pz], target: [0, ty, 0], roll, fov, az, u, id: s.id };
}

/* ------------------------------------------------------------------ *
 *  shot grammar — per-section "look" of the world
 * ------------------------------------------------------------------ */
// morph kinds: 0 sphere, 1 cube, 2 torus, 3 helix, 4 grid, 5 line, 6 heart, 7 ring
const LOOK = {
  boot: { a: 5, b: 0, morph: 0.0, scale: 0.9, disperse: 0.10, grid: 0.0, box: 0.0, core: 0.10, glow: 0.4, stars: 0.7, sat: 0.9, exp: 0.9 },
  v1: { a: 5, b: 0, morph: 0.35, scale: 1.0, disperse: 0.14, grid: 0.5, box: 0.0, core: 0.16, glow: 1.0, stars: 0.8, sat: 1.0, exp: 1.0 },
  link: { a: 0, b: 1, morph: 0.0, scale: 1.25, disperse: 0.02, grid: 1.0, box: 0.0, core: 0.20, glow: 1.3, stars: 1.0, sat: 1.0, exp: 1.0 },
  v2: { a: 0, b: 4, morph: 0.15, scale: 1.10, disperse: 0.03, grid: 0.8, box: 0.15, core: 0.20, glow: 1.2, stars: 0.8, sat: 1.0, exp: 1.05 },
  pc1: { a: 4, b: 2, morph: 0.5, scale: 1.15, disperse: 0.08, grid: 0.7, box: 0.35, core: 0.24, glow: 1.5, stars: 0.5, sat: 1.0, exp: 1.1 },
  ch1: { a: 0, b: 1, morph: 0.25, scale: 1.45, disperse: 0.0, grid: 1.0, box: 1.0, core: 0.30, glow: 2.1, stars: 0.6, sat: 1.0, exp: 1.15 },
  v3: { a: 2, b: 6, morph: 0.5, scale: 1.15, disperse: 0.05, grid: 0.6, box: 0.5, core: 0.26, glow: 1.5, stars: 0.6, sat: 1.0, exp: 1.1 },
  pc2: { a: 6, b: 3, morph: 0.5, scale: 1.20, disperse: 0.10, grid: 0.5, box: 0.7, core: 0.28, glow: 1.6, stars: 0.4, sat: 1.0, exp: 1.1 },
  bridge: { a: 0, b: 7, morph: 0.7, scale: 1.30, disperse: 0.42, grid: 0.35, box: 0.9, core: 0.22, glow: 1.2, stars: 0.9, sat: 0.7, exp: 0.95 },
  break: { a: 7, b: 5, morph: 0.85, scale: 1.1, disperse: 0.85, grid: 0.10, box: 0.4, core: 0.14, glow: 0.5, stars: 1.0, sat: 0.35, exp: 0.85 },
  exec: { a: 0, b: 6, morph: 0.2, scale: 1.5, disperse: 0.0, grid: 0.5, box: 1.0, core: 0.42, glow: 2.6, stars: 0.5, sat: 0.9, exp: 1.2 },
  ch3: { a: 6, b: 0, morph: 0.15, scale: 1.7, disperse: 0.0, grid: 0.3, box: 0.8, core: 0.55, glow: 3.0, stars: 0.4, sat: 1.0, exp: 1.25 },
  outro: { a: 6, b: 6, morph: 0.0, scale: 1.55, disperse: 0.05, grid: 0.45, box: 0.5, core: 0.40, glow: 2.0, stars: 0.7, sat: 1.05, exp: 1.1 },
  coda: { a: 6, b: 0, morph: 0.6, scale: 1.8, disperse: 0.30, grid: 0.7, box: 0.3, core: 0.30, glow: 1.4, stars: 1.2, sat: 0.9, exp: 1.0 },
  post: { a: 0, b: 0, morph: 0.0, scale: 0.8, disperse: 0.55, grid: 0.25, box: 0.2, core: 0.12, glow: 0.6, stars: 1.0, sat: 0.5, exp: 0.85 },
};

/* orbit rings per section */
const RINGS = {
  boot: 0.15, v1: 0.40, link: 0.85, v2: 1.0, pc1: 0.35, ch1: 0.95,
  v3: 0.60, pc2: 0.40, bridge: 0.75, break: 0.20, exec: 1.0, ch3: 0.65,
  outro: 0.80, coda: 0.90, post: 0.30,
};

/* palettes per section: [tintA, tintB, lift, gain] */
const PAL = {
  boot: [[0.30, 0.55, 1.00], [0.55, 0.30, 1.00], [0.01, 0.012, 0.03], [1.0, 1.0, 1.06]],
  v1: [[0.35, 0.80, 1.00], [0.60, 0.35, 1.00], [0.006, 0.012, 0.028], [1.02, 1.02, 1.08]],
  link: [[0.30, 0.85, 1.00], [0.45, 0.40, 1.00], [0.006, 0.010, 0.026], [1.03, 1.03, 1.07]],
  v2: [[0.35, 0.90, 0.95], [0.85, 0.45, 0.70], [0.008, 0.010, 0.026], [1.04, 1.01, 1.05]],
  pc1: [[0.45, 0.95, 1.00], [1.00, 0.35, 0.55], [0.010, 0.008, 0.028], [1.08, 1.00, 1.04]],
  ch1: [[0.45, 0.95, 1.00], [1.00, 0.55, 0.30], [0.012, 0.012, 0.030], [1.10, 1.03, 1.02]],
  v3: [[0.55, 1.00, 0.85], [1.00, 0.70, 0.35], [0.010, 0.014, 0.026], [1.06, 1.04, 0.98]],
  pc2: [[0.75, 0.55, 1.00], [1.00, 0.40, 0.75], [0.012, 0.008, 0.030], [1.08, 1.00, 1.08]],
  bridge: [[0.30, 0.45, 0.85], [0.65, 0.30, 0.55], [0.004, 0.006, 0.020], [0.95, 0.95, 1.05]],
  break: [[0.25, 0.32, 0.60], [0.40, 0.25, 0.55], [0.002, 0.004, 0.014], [0.85, 0.88, 1.00]],
  exec: [[1.00, 0.55, 0.35], [1.00, 0.30, 0.25], [0.018, 0.010, 0.022], [1.20, 1.02, 0.96]],
  ch3: [[1.00, 0.80, 0.55], [1.00, 0.45, 0.35], [0.022, 0.016, 0.026], [1.25, 1.08, 0.98]],
  outro: [[0.55, 0.85, 1.00], [1.00, 0.62, 0.55], [0.012, 0.012, 0.028], [1.10, 1.04, 1.02]],
  coda: [[0.40, 0.60, 1.00], [0.75, 0.40, 0.85], [0.006, 0.008, 0.024], [1.0, 1.0, 1.06]],
  post: [[0.30, 0.70, 1.00], [0.40, 0.40, 1.00], [0.003, 0.006, 0.018], [0.9, 0.95, 1.05]],
};

/* ------------------------------------------------------------------ *
 *  the main entry point
 * ------------------------------------------------------------------ */
export function visualAt(t, music) {
  const s = sectionAt(t);
  const look = LOOK[s.id];
  const pal = PAL[s.id];
  const cam = cameraAt(t, music);

  const bass = music.bassAt(t), mid = music.midAt(t), high = music.highAt(t);
  const rms = music.rmsAt(t), pulse = music.pulse(t, 6.0), barPulse = music.barPulse(t, 2.0);
  const local = t - s.t0;
  const u = cam.u;

  // ---- morph ----
  let morph = look.morph;
  let shapeA = look.a, shapeB = look.b;
  // per-section morph automation
  if (s.id === 'v1') morph = seg(t, s.t0, s.t1) * 0.9;            // line -> sphere
  if (s.id === 'link') morph = seg(t, 15.5, 28.5);
  if (s.id === 'v2') {                                             // 4 geometry demos
    const k = Math.floor((local) / 3.68);
    // points -> dimension | circle -> circumference | sine wave | infinity
    shapeA = [5, 7, 8, 3][Math.min(3, k)];
    shapeB = [4, 0, 7, 1][Math.min(3, k)];
    morph = seg(local % 3.68, 0.15, 1.15);
  }
  if (s.id === 'pc1') morph = 0.5 + 0.5 * sin(local * 1.9);
  if (s.id === 'ch1') morph = seg(local, 0.2, 2.2);
  if (s.id === 'v3') {                                             // playful object morphs
    const k = Math.floor(local / 3.68);
    shapeA = [2, 6, 3, 0][Math.min(3, k)];
    shapeB = [6, 3, 0, 6][Math.min(3, k)];
    morph = seg(local % 3.68, 0.2, 1.4);
  }
  if (s.id === 'pc2') morph = 0.5 + 0.5 * sin(local * 2.4);
  if (s.id === 'bridge') { shapeA = 0; shapeB = 7; morph = seg(local, 0, 12); }
  if (s.id === 'exec') {
    const k = Math.min(4, Math.floor(local / 3.68));
    shapeA = [0, 0, 2, 4, 0][k];
    shapeB = [2, 4, 0, 0, 6][k];
    morph = seg(local % 3.68, 0.0, 1.2);
  }
  if (s.id === 'ch3') morph = 1 - seg(local, 0, 6);
  if (s.id === 'outro') morph = 0;
  if (s.id === 'coda') morph = seg(local, 0, 18) * 0.7;
  if (s.id === 'post') morph = seg(local, 0, 6) * 0.5;

  // ---- dispersion: the world coming apart ----
  let disperse = look.disperse;
  if (s.id === 'bridge') disperse = 0.15 + 0.75 * seg(local, 4, 20);
  if (s.id === 'break') disperse = 0.9 - 0.55 * seg(local, 6, 17);
  if (s.id === 'exec') disperse = 0.35 * (1 - seg(local, 0, 3)) + 0.02;
  if (s.id === 'ch3') disperse = 0.02;
  if (s.id === 'coda') disperse = 0.25 + 0.75 * seg(local, 8, 22);
  if (s.id === 'post') disperse = 0.55 + 0.35 * seg(local, 0, 8);
  if (s.id === 'boot') disperse = 0.55 - 0.4 * seg(local, 0, 0.6);
  if (s.id === 'v1') disperse = 0.42 * (1 - seg(local, 0.5, 6.0));

  // ---- the box of the simulation ----
  let box = look.box;
  if (s.id === 'ch1') box = seg(local, 0.5, 5.0) * (0.85 + 0.15 * barPulse);
  if (s.id === 'break') box = 0.9 * (1 - seg(local, 8, 16));
  if (s.id === 'ch3') box = 0.8;
  if (s.id === 'coda') box = 0.8 * (1 - seg(local, 6, 20));
  if (s.id === 'post') box = 0.25 * (1 - seg(local, 2, 8));

  // ---- core ----
  let coreR = look.core * (1 + 0.16 * pulse + 0.10 * bass);
  let glow = look.glow * (0.7 + 0.5 * rms + 0.4 * pulse);
  if (s.id === 'exec') { coreR *= 1 + 1.6 * seg(local, 12, 16.2); glow *= 1 + 2.0 * seg(local, 12, 16.2); }
  if (s.id === 'ch3') { coreR *= 1.35; glow *= 1.5; }
  if (s.id === 'break') { coreR *= 0.5; glow *= 0.6; }
  if (s.id === 'post') { coreR *= 0.4; glow *= 0.5; }

  // ---- shockwaves on big beats ----
  const sinceDown = t - (music.downTimes[Math.max(0, music.lastDown(t))] ?? 0);
  const shock = clamp(sinceDown / 1.6);
  const shock2 = clamp((sinceDown - 0.92) / 1.6);

  // ---- glitch ----
  let glitch = 0;
  if (s.id === 'pc1') glitch = 0.35 * clamp(music.highAt(t) * 1.4);
  if (s.id === 'pc2') glitch = 0.45 * clamp(music.highAt(t) * 1.5);
  if (s.id === 'exec') glitch = 0.5 * clamp(music.fluxAt ? 0 : 0) + 0.35 * pulse;
  if (s.id === 'bridge') glitch = 0.3 * seg(local, 8, 18);
  if (s.id === 'post') glitch = 0.25 * (1 - seg(local, 0, 5));
  glitch += 0.12 * Math.max(0, high - 0.75);

  // ---- flashes ----
  let white = 0;
  if (s.id === 'exec') white = 0.85 * Math.pow(seg(local % 3.68, 0.0, 0.16) * (1 - seg(local % 3.68, 0.1, 0.55)), 0.7);
  if (s.id === 'ch3') white = 0.35 * Math.pow(1 - seg(local % 1.84, 0.0, 0.5), 2.0) * (1 - seg(local, 0, 1.5));
  if (s.id === 'boot') white = 0.5 * (1 - seg(local, 0.05, 0.5));
  white = Math.max(white, 0.20 * Math.pow(pulse, 6.0) * (s.id === 'ch1' ? 1 : 0.3));

  // ---- fades ----
  let fade = 1;
  if (t < 0.35) fade = seg(t, 0.0, 0.35);
  if (t > DURATION - 3.2) fade = 1 - seg(t, DURATION - 3.2, DURATION - 0.5);
  if (s.id === 'coda') fade *= 1 - 0.65 * seg(local, 14, 24);
  if (s.id === 'post') fade *= 1 - 0.75 * seg(local, 6, 9.5);

  // ---- scatter / attract (execution sucks the world in) ----
  let attract = 0;
  if (s.id === 'exec') attract = seg(local, 12.5, 16.2);
  if (s.id === 'ch3') attract = 1 - seg(local, 0, 4);
  if (s.id === 'outro') attract = 0;

  return {
    t, section: s, local, u,
    cam, shapeA, shapeB, morph,
    scale: look.scale * (1 + 0.03 * bass),
    disperse, box, grid: look.grid, stars: look.stars,
    rings: (RINGS[s.id] ?? 0.5) * (s.id === 'coda' ? 1 - seg(local, 14, 24) * 0.9 : 1),
    coreR: Math.max(0.02, coreR), glow, shock, shock2, glitch, white, fade,
    attract,
    tintA: pal[0], tintB: pal[1], lift: pal[2], gain: pal[3],
    sat: look.sat, exposure: look.exp * (1 + 0.10 * rms),
    bloom: 0.42 + 0.38 * rms + 0.30 * pulse,
    chroma: 0.5 + 1.4 * glitch + 0.3 * high,
    scan: 0.6 + 0.25 * Math.sin(t * 0.13),
    grain: 0.012 + 0.020 * (1 - rms),
    barrel: 0.030 + 0.070 * glitch,
    bars: music.barAt(t),
    bands: [bass, mid, high],
    pulse, barPulse,
  };
}

/** current lyric line (or null) and its age in seconds */
export function lyricAt(t) {
  let best = null;
  for (const s of SECTIONS) {
    if (!s.lines) continue;
    for (const l of s.lines) {
      if (t >= l.t - 0.05) {
        if (!best || l.t > best.t) best = l;
      }
    }
  }
  if (!best) return null;
  const age = t - best.t;
  if (age > 8.5) return null;
  return { text: best.text, t: best.t, age, section: sectionAt(best.t) };
}
