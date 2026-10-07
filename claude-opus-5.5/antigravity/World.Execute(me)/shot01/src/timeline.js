// Timeline: lyrics (LRC from lrclib.net, aligned to the 212s release), sections, helpers
export const DURATION = 212.28;
export const FPS = 60;

// [start, text, keyword]
const RAW = [
  [0.03, 'Switch on the power line', 'POWER'],
  [1.33, 'Remember to put on protection', 'PROTECTION'],
  [3.58, 'Lay down your pieces', ''],
  [5.16, "And let's begin object creation", 'OBJECT CREATION'],
  [7.19, 'Fill in my data parameters', 'PARAMETERS'],
  [9.75, 'Initialization', 'INITIALIZATION'],
  [10.90, 'Set up our new world', ''],
  [12.47, "And let's begin the simulation", 'SIMULATION'],
  [16.04, '', ''],
  [29.28, "If I'm a set of points", ''],
  [30.89, 'Then I will give you my dimension', 'DIMENSION'],
  [33.01, "If I'm a circle", ''],
  [34.54, 'Then I will give you my circumference', 'CIRCUMFERENCE'],
  [36.77, "If I'm a sine wave", ''],
  [38.27, 'Then you can sit on all my tangents', 'TANGENTS'],
  [40.36, 'If I approach infinity', ''],
  [41.92, 'Then you can be my limitations', 'LIMITATIONS'],
  [44.04, 'Switch my current', ''],
  [45.52, 'To AC, to DC', 'AC / DC'],
  [47.27, 'And then blind my vision', ''],
  [49.11, 'So dizzy, so dizzy', 'DIZZY'],
  [50.95, 'Oh, we can travel', ''],
  [52.99, 'To A.D., to B.C.', 'A.D. / B.C.'],
  [54.74, 'And we can unite', ''],
  [56.79, 'So deeply, so deeply', 'DEEPLY'],
  [58.65, 'If I can, if I can', ''],
  [60.57, 'Give you all the simulations', 'SIMULATIONS'],
  [62.41, 'Then I can, then I can', ''],
  [64.29, 'Be your only satisfaction', 'SATISFACTION'],
  [66.17, 'If I can make you happy', ''],
  [67.99, 'I will run the execution', 'EXECUTION'],
  [70.02, 'Though we are trapped', ''],
  [71.20, 'In this strange, strange simulation', 'SIMULATION'],
  [73.53, "If I'm an eggplant", ''],
  [75.29, 'Then I will give you my nutrients', 'NUTRIENTS'],
  [77.16, "If I'm a tomato", ''],
  [78.93, 'Then I will give you antioxidants', 'ANTIOXIDANTS'],
  [80.93, "If I'm a tabby cat", ''],
  [82.56, 'Then I will purr for your enjoyment', 'ENJOYMENT'],
  [84.60, "If I'm the only god", ''],
  [86.21, "Then you're the proof of my existence", 'EXISTENCE'],
  [88.34, 'Switch my gender', ''],
  [89.91, 'To F, to M', 'F / M'],
  [91.44, 'And then do whatever', ''],
  [93.52, 'From AM to PM', 'AM / PM'],
  [95.28, 'Oh, switch my role', ''],
  [97.32, 'To S, to M', 'S / M'],
  [98.93, 'So we can enter', ''],
  [100.93, 'The trance, the trance', 'TRANCE'],
  [102.93, 'If I can, if I can', ''],
  [104.92, 'Feel your vibrations', 'VIBRATIONS'],
  [106.74, 'Then I can, then I can', ''],
  [108.69, 'Finally be completion', 'COMPLETION'],
  [110.30, 'Though you have left', ''],
  [111.98, 'You have left', ''],
  [112.89, 'You have left', ''],
  [113.75, 'You have left', ''],
  [114.65, 'You have left', ''],
  [115.60, 'You have left me in isolation', 'ISOLATION'],
  [117.95, 'If I can, if I can', ''],
  [119.81, 'Erase all the pointless fragments', 'FRAGMENTS'],
  [121.80, 'Then maybe, then maybe', ''],
  [123.55, "You won't leave me so disheartened", 'DISHEARTENED'],
  [125.33, 'Challenging your god', ''],
  [128.42, 'You have made some', ''],
  [130.74, 'Illegal arguments', 'ILLEGAL ARGUMENTS'],
  [134.38, '', ''],
  [147.52, 'Execution', 'EXECUTION'],
  [148.59, 'Execution', 'EXECUTION'],
  [149.78, 'Execution', 'EXECUTION'],
  [150.64, 'Execution', 'EXECUTION'],
  [151.53, 'Execution', 'EXECUTION'],
  [152.43, 'Execution', 'EXECUTION'],
  [153.32, 'Execution', 'EXECUTION'],
  [154.31, 'Execution', 'EXECUTION'],
  [155.20, 'Execution', 'EXECUTION'],
  [156.18, 'Execution', 'EXECUTION'],
  [157.12, 'Execution', 'EXECUTION'],
  [158.02, 'Execution', 'EXECUTION'],
  [158.79, 'Ein, dos', ''],
  [159.66, 'Tres, ne', ''],
  [160.45, 'Fem, liu', ''],
  [161.31, 'Execution', 'EXECUTION'],
  [162.23, 'If I can, if I can', ''],
  [164.07, 'Give them all the execution', 'EXECUTION'],
  [166.05, 'Then I can, then I can', ''],
  [167.75, 'Be your only execution', 'EXECUTION'],
  [169.61, 'If I can have you back', ''],
  [171.77, 'I will run the execution', 'EXECUTION'],
  [173.11, 'Though we are trapped', ''],
  [174.80, 'We are trapped, ah', 'TRAPPED'],
  [176.96, "I've studied, I've studied", ''],
  [178.79, 'How to properly lo-o-ove', 'LOVE'],
  [180.78, 'Question me, question me', ''],
  [182.43, 'I can answer all lo-o-ove', 'LOVE'],
  [184.33, 'I know the algebraic expression of lo-o-ove', 'LOVE'],
  [187.97, 'Though you are free', ''],
  [189.26, 'I am trapped', ''],
  [190.24, 'Trapped in lo-o-ove', 'LOVE'],
  [193.46, '', ''],
  [205.56, 'Execution', 'EXECUTION'],
  [206.30, '', ''],
];
export const LYRICS = RAW.map((r, i) => ({ t: r[0], e: i + 1 < RAW.length ? RAW[i + 1][0] : DURATION, text: r[1], key: r[2], i }));

export const SECTIONS = [
  { id: 'boot', t0: 0, t1: 16.04, label: 'BOOT::OBJECT_CREATION' },
  { id: 'title', t0: 16.04, t1: 29.28, label: 'SIM::WORLD_INIT' },
  { id: 'math', t0: 29.28, t1: 44.04, label: 'PROC::GEOMETRY' },
  { id: 'pre1', t0: 44.04, t1: 58.65, label: 'PROC::CURRENT' },
  { id: 'cho1', t0: 58.65, t1: 73.53, label: 'RUN::SIMULATION' },
  { id: 'verse2', t0: 73.53, t1: 88.34, label: 'PROC::OBJECTS' },
  { id: 'pre2', t0: 88.34, t1: 102.93, label: 'PROC::SWITCH' },
  { id: 'cho2', t0: 102.93, t1: 117.95, label: 'RUN::VIBRATION' },
  { id: 'erase', t0: 117.95, t1: 134.38, label: 'SYS::GARBAGE_COLLECT' },
  { id: 'break', t0: 134.38, t1: 147.48, label: 'SYS::KERNEL_PANIC' },
  { id: 'exec', t0: 147.48, t1: 162.23, label: 'EXEC::EXECUTION' },
  { id: 'cho3', t0: 162.23, t1: 176.96, label: 'EXEC::ALL' },
  { id: 'love', t0: 176.96, t1: 193.46, label: 'MEM::LOVE' },
  { id: 'outro', t0: 193.46, t1: 205.56, label: 'SYS::SHUTDOWN' },
  { id: 'end', t0: 205.56, t1: DURATION + 1, label: 'EXIT' },
];

export function section(t) {
  for (const s of SECTIONS) if (t >= s.t0 && t < s.t1) return { ...s, p: (t - s.t0) / (s.t1 - s.t0), lt: t - s.t0 };
  return { ...SECTIONS[SECTIONS.length - 1], p: 1, lt: 0 };
}
export function lyricAt(t) {
  let cur = null;
  for (const l of LYRICS) { if (l.t <= t) cur = l; else break; }
  return cur;
}

// ---------- math helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const easeOutCubic = k => 1 - Math.pow(1 - clamp(k), 3);
export const easeInCubic = k => Math.pow(clamp(k), 3);
export const easeInOut = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOutBack = k => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
export const win = (t, a, b, fi = 0.3, fo = 0.3) => smooth(a, a + fi, t) * (1 - smooth(b - fo, b, t));
export function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return n - Math.floor(n); }
export function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- audio-reactive helpers ----------
export class Audio {
  constructor(data) {
    this.d = data;
    this.bpm = data.bpm; this.period = 60 / data.bpm; this.offset = data.beatOffset;
    // find downbeat phase using bass energy at each beat mod 4
    const sums = [0, 0, 0, 0];
    for (let b = 0; ; b++) {
      const t = this.offset + b * this.period; const f = Math.round(t * data.fps);
      if (f >= data.frames) break;
      sums[b % 4] += data.bands[0][f] + data.onset[f];
    }
    this.downPhase = sums.indexOf(Math.max(...sums));
  }
  f(t) { return clamp(Math.round(t * this.d.fps), 0, this.d.frames - 1); }
  rms(t) { return this.d.rms[this.f(t)]; }
  onset(t) { return this.d.onset[this.f(t)]; }
  band(i, t) { return this.d.bands[i][this.f(t)]; }
  spec(t) { return this.d.spec[this.f(t)]; }
  // smoothed (window average) value
  avg(arr, t, w = 6) { const f = this.f(t); let s = 0, c = 0; for (let k = -w; k <= w; k++) { const v = arr[f + k]; if (v !== undefined) { s += v; c++; } } return s / c; }
  bass(t) { return this.avg(this.d.bands[0], t, 3); }
  beat(t) { return (t - this.offset) / this.period; }
  beatPulse(t, k = 6) { const b = this.beat(t); return Math.exp(-(b - Math.floor(b)) * k); }
  barPulse(t, k = 3) { const b = (this.beat(t) - this.downPhase) / 4; return Math.exp(-(b - Math.floor(b)) * k); }
  beatIndex(t) { return Math.floor(this.beat(t)); }
}
