// ============================================================
// world.execute(me); fan MV (shot04) — single source of truth
// Used by BOTH tools/compose.js (audio) and mv/ (visuals).
// All timing derives from this file. Do not duplicate numbers.
// ============================================================
'use strict';

const FPS = 60;
const SR = 48000;
const BPM = 130;

const BEAT = 60 / BPM;          // 0.461538...
const BAR = BEAT * 4;           // 1.846153...
const TOTAL_BARS = 116;
const DURATION = TOTAL_BARS * BAR;                 // 214.1538 s  (>= official 3:33)
const FRAMES = Math.ceil(DURATION * FPS);          // 12850
const AUDIO_SAMPLES = Math.ceil(FRAMES / FPS * SR);// audio padded to video length

// ---- section map (bar offsets are 0-indexed start bars) ----
const SECTIONS = [
  { id: 'intro',   name: 'POWER-ON',         code: '// POWER-ON',            scene: 'boot',      bar: 0,   bars: 8,  i: 0.15 },
  { id: 'v1a',     name: 'OBJECT CREATION',  code: '// OBJECT CREATION',     scene: 'creation',  bar: 8,   bars: 8,  i: 0.32 },
  { id: 'v1b',     name: 'INITIALIZATION',   code: '// INITIALIZATION',      scene: 'init',      bar: 16,  bars: 8,  i: 0.42 },
  { id: 'pre1',    name: 'SIMULATION',       code: '// SIMULATION',          scene: 'run',       bar: 24,  bars: 8,  i: 0.62 },
  { id: 'cho1',    name: 'EXECUTION',        code: 'world.execute(me);',     scene: 'chamber',   bar: 32,  bars: 16, i: 1.00 },
  { id: 'v2',      name: 'TANGENTS',         code: '// TANGENTS',            scene: 'fragments', bar: 48,  bars: 8,  i: 0.50 },
  { id: 'pre2',    name: 'LIMITATIONS',      code: '// LIMITATIONS',         scene: 'hunt',      bar: 56,  bars: 8,  i: 0.66 },
  { id: 'cho2',    name: 'SATISFACTION',     code: 'world.execute(me);',     scene: 'chamber2',  bar: 64,  bars: 16, i: 0.92 },
  { id: 'bridge',  name: 'EXECUTION',        code: '// EXECUTION',           scene: 'countdown', bar: 80,  bars: 12, i: 0.55 },
  { id: 'cho3',    name: 'COMPLETION',       code: 'me.execute(world);',     scene: 'garden',    bar: 92,  bars: 16, i: 1.00 },
  { id: 'outro',   name: 'ISOLATION',        code: '// ISOLATION',           scene: 'outro',     bar: 108, bars: 8,  i: 0.20 },
];

// absolute times
for (const s of SECTIONS) {
  s.t0 = s.bar * BAR;
  s.t1 = (s.bar + s.bars) * BAR;
}

// key moments (seconds)
const KEY = {
  helloWorld: 5.2,        // "hello, world." typed
  executeTyped: 13.2,     // "world.execute(me);" typed in boot
  whiteout: SECTIONS[9].t0,   // 169.846 — the execution: white flash + audio drop
  whiteoutEnd: SECTIONS[9].t0 + 1.15,
  exitCode: SECTIONS[10].t0 + 4.0,
  goodbye: SECTIONS[10].t0 + 8.4,
};

// countdown numbers shown during bridge (one per bar, bars 84..92 of bridge area)
const COUNTDOWN = [
  { text: '1',   lang: 'EN' }, { text: '2',  lang: 'DE' }, { text: '3',  lang: 'FR' },
  { text: '4',   lang: 'ES' }, { text: '5',  lang: 'KR' }, { text: '6',  lang: 'SV' },
  { text: '7',   lang: 'CN' }, { text: '617', lang: 'MILI' },
];

// ---- derived helpers ----
function sectionAt(t) {
  for (let k = SECTIONS.length - 1; k >= 0; k--) if (t >= SECTIONS[k].t0) return SECTIONS[k];
  return SECTIONS[0];
}

// musical grid position: returns {bar, beat, barPhase (0..1), beatPhase (0..1)}
function grid(t) {
  const fb = t / BAR;
  const bar = Math.floor(fb);
  const barPhase = fb - bar;
  const beatF = barPhase * 4;
  return { bar, beat: Math.floor(beatF), barPhase, beatPhase: beatF - Math.floor(beatF) };
}

// how deep into current section (0..1)
function sectionProgress(t) {
  const s = sectionAt(t);
  return Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0)));
}

const TIMELINE = { FPS, SR, BPM, BEAT, BAR, TOTAL_BARS, DURATION, FRAMES, AUDIO_SAMPLES, SECTIONS, KEY, COUNTDOWN, sectionAt, grid, sectionProgress };

if (typeof module !== 'undefined') module.exports = TIMELINE;
