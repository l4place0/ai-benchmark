// Master timeline data, derived from the audio analysis. Requirable module.
// Pure Node, no deps. Consumed by build-html.js (inlined into render.html).
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const A = path.join(BASE, 'analysis');

function buildTimeline() {
  const grid = JSON.parse(fs.readFileSync(path.join(A, 'grid.json'), 'utf8'));
  const tl = JSON.parse(fs.readFileSync(path.join(A, 'timeline.json'), 'utf8'));

  const BPM = grid.bpm;            // 129.2
  const PERIOD = grid.period;      // 0.464396
  const OFF = grid.offset;         // 0.20944
  const BAR = PERIOD * 4;          // 1.85758
  const DUR = grid.duration;       // 212.277
  const FPS = 60;

  const atBar = b => OFF + b * BAR;

  // Section boundaries derived from ASR vocal blocks + bar-level spectral novelty.
  // Every boundary snapped to a bar line so cuts land musically.
  const SECTIONS = [
    { id: 'BOOT',      bar: 0,    color: [1.00, 0.62, 0.20], note: 'creation / power on' },
    { id: 'COMPILE',   bar: 8,    color: [0.25, 0.72, 1.00], note: 'instrumental: object creation' },
    { id: 'SIMULATE',  bar: 16,   color: [1.00, 0.72, 0.28], note: 'if I am a set of points' },
    { id: 'SWITCH',    bar: 27,   color: [1.00, 0.30, 0.72], note: 'switch my current, blind my vision' },
    { id: 'GARDEN',    bar: 40,   color: [0.55, 1.00, 0.45], note: 'eggplant / tomato / tabby cat' },
    { id: 'TRANCE',    bar: 52,   color: [0.78, 0.35, 1.00], note: 'switch my gender, enter the trance' },
    { id: 'ISOLATION', bar: 63,   color: [0.45, 0.52, 0.62], note: 'you have left me' },
    { id: 'VOID',      bar: 71.9, color: [0.16, 0.18, 0.22], note: 'the ground drops out' },
    { id: 'EXECUTION', bar: 88,   color: [1.00, 0.20, 0.18], note: 'execution' },
    { id: 'LOVEEXE',   bar: 103,  color: [1.00, 0.78, 0.45], note: 'algebraic expression of love' },
    { id: 'END',       bar: 110,  color: [0.10, 0.10, 0.12], note: 'fade' },
  ];

  // Lyric lines: text corrected against the official lyrics, timing from ASR.
  const LYRICS = [
    { t: 0.00,  line: 'Switch on the power line',    sub: 'remember to put on protection' },
    { t: 3.62,  line: 'Lay down your pieces',        sub: "and let's begin object creation" },
    { t: 7.46,  line: 'Fill in my data, parameters', sub: 'initialization' },
    { t: 12.78, line: 'Setup our new world',         sub: "and let's begin the simulation" },
    { t: 29.56, line: "If I'm a set of points",      sub: 'then I will give you my dimension' },
    { t: 33.14, line: "If I'm a circle",             sub: 'then I will give you my circumference' },
    { t: 36.90, line: "If I'm a sine wave",          sub: 'then you can sit on all my tangents' },
    { t: 40.64, line: 'If I approach infinity',      sub: 'then you can be my limitations' },
    { t: 44.10, line: 'Switch my current',           sub: 'to AC to DC' },
    { t: 47.82, line: 'And then blind my vision',    sub: 'so dizzy, so dizzy' },
    { t: 51.40, line: 'Oh, we can travel',           sub: 'to A.D to B.C' },
    { t: 54.88, line: 'And we can unite',            sub: 'so deeply, so deeply' },
    { t: 58.88, line: 'If I can, if I can',          sub: 'give you all the stimulations' },
    { t: 62.76, line: 'Then I can, then I can',      sub: 'be your only satisfaction' },
    { t: 66.82, line: 'If I can make you happy',     sub: 'I will run the execution' },
    { t: 70.05, line: 'Though we are trapped',       sub: 'in this strange, strange simulation' },
    { t: 73.39, line: "If I'm an eggplant",          sub: 'then I will give you my nutrients' },
    { t: 77.61, line: "If I'm a tomato",             sub: 'then I will give you antioxidants' },
    { t: 81.37, line: "If I'm a tabby cat",          sub: 'then I will purr for your enjoyment' },
    { t: 84.41, line: "If I'm the only god",         sub: "then you're the proof of my existence" },
    { t: 88.55, line: 'Switch my gender',            sub: 'to F to M' },
    { t: 93.81, line: 'And then do whatever',        sub: 'from AM to PM' },
    { t: 97.53, line: 'Oh, switch my role',          sub: 'to S to M' },
    { t: 99.55, line: 'So we can enter',             sub: 'the trance, the trance' },
    { t: 103.31,line: 'If I can, if I can',          sub: 'feel your vibrations' },
    { t: 107.01,line: 'Then I can, then I can',      sub: 'finally be completion' },
    { t: 110.91,line: 'Though you have left',        sub: 'you have left' },
    { t: 113.13,line: 'You have left',               sub: 'you have left' },
    { t: 115.01,line: 'You have left',               sub: 'you have left' },
    { t: 116.85,line: 'You have left me',            sub: 'in isolation' },
    { t: 118.51,line: 'If I can, if I can',          sub: 'erase all the pointless fragments' },
    { t: 121.81,line: 'Then maybe, then maybe',      sub: "you won't leave me so disheartened" },
    { t: 125.23,line: 'Challenging your God',        sub: 'you have made some illegal arguments' },
    { t: 163.69,line: 'If I can, if I can',          sub: 'give them all the execution' },
    { t: 166.65,line: 'Then I can, then I can',      sub: 'be your only execution' },
    { t: 170.11,line: 'If I can have you back',      sub: 'I will run the execution' },
    { t: 173.43,line: 'Though we are trapped',       sub: 'we are trapped' },
    { t: 177.19,line: "I've studied, I've studied",  sub: 'how to properly love' },
    { t: 180.35,line: 'Question me, question me',    sub: 'I can answer all love' },
    { t: 184.09,line: 'I know the algebraic',        sub: 'expression of love' },
    { t: 186.59,line: 'Though you are free',         sub: 'I am trapped, trapped in love' },
  ];

  // "execution" is chanted on every beat from the void's end until the chorus.
  const execHits = [];
  const h0 = 129.5, h1 = 163.69;
  for (let x = h0; x < h1; x += PERIOD) execHits.push(+x.toFixed(4));

  return {
    meta: { bpm: BPM, period: PERIOD, offset: OFF, bar: BAR, duration: DUR, fps: FPS,
            bars: tl.n_bars, beatsPerBar: 4 },
    sections: SECTIONS.map(s => ({ ...s, t: +atBar(s.bar).toFixed(4) })),
    lyrics: LYRICS,
    execHits,
    vocalBlocks: tl.vocal_blocks,
    marks: {
      silenceStart: 207.4,
      voidStart: +atBar(71.9).toFixed(4),
      voidEnd: +atBar(88).toFixed(4),
    },
  };
}

module.exports = { buildTimeline };

if (require.main === module) {
  const d = buildTimeline();
  console.log('sections:');
  for (const s of d.sections) console.log(`  ${s.t.toFixed(2).padStart(7)}s  bar ${String(s.bar).padStart(6)}  ${s.id}`);
  console.log(`\nlyric lines: ${d.lyrics.length}`);
  console.log(`exec hits: ${d.execHits.length}`);
  console.log(`bar = ${d.meta.bar.toFixed(4)}s   duration = ${d.meta.duration.toFixed(2)}s`);
}
