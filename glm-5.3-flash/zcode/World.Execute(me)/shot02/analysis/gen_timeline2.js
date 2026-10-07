// gen_timeline2.js — builds shot02/mv/timeline.js (take 02: paper doll / marionette)
// Reuses verified analysis (bpm 128, beat0 0.32, energy env) + NetEase LRC (+0.10s offset).
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'analysis.json'), 'utf8'));
const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'netease_lyric.json'), 'utf8'));
const OFF = 0.10;
const SECTIONS = [
  { id: 'wake',      name: 'wake — paper theatre',   t0: 0.00,   t1: 16.10,  i: 0.35 },
  { id: 'title',     name: 'world.execute(me);',     t0: 16.10,  t1: 29.81,  i: 0.90 },
  { id: 'thread',    name: 'red thread / geometry',  t0: 29.81,  t1: 59.32,  i: 0.50 },
  { id: 'mandala',   name: 'stimulations mandala',   t0: 59.32,  t1: 74.15,  i: 0.85 },
  { id: 'specimen',  name: 'specimen rewrite',       t0: 74.15,  t1: 103.59, i: 0.55 },
  { id: 'ripples',   name: 'vibrations',             t0: 103.59, t1: 117.37, i: 0.80 },
  { id: 'isolation', name: 'isolation',              t0: 117.37, t1: 125.81, i: 0.25 },
  { id: 'error',     name: 'illegal arguments',      t0: 125.81, t1: 147.76, i: 0.70 },
  { id: 'exec',      name: 'execution',              t0: 147.76, t1: 162.63, i: 1.00 },
  { id: 'love',      name: 'love / thread heart',    t0: 162.63, t1: 205.91, i: 0.50 },
  { id: 'final',     name: 'final execution',        t0: 205.91, t1: 212.33, i: 0.40 },
  { id: 'outro',     name: 'outro',                  t0: 212.33, t1: 217.50, i: 0.10 },
];
const RED = new Set(['ILLEGAL ARGUMENTS']);
const COUNT = { 'EIN': 6, 'DOS': 5, 'TROIS': 4, 'NE': 3, 'FEM': 2, 'LIU': 1 };
const raw = L.lrc.lyric.split(/\r?\n/).map(s => {
  const m = s.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
  return m ? [+(+m[1] * 60 + +m[2]).toFixed(3), m[3].trim()] : null;
}).filter(Boolean).filter(a => a[1]);
const cues = [];
for (const [t, text] of raw) {
  const at = +(t + OFF).toFixed(3);
  if (text === 'world.execute(me);') { cues.push({ t: at, type: 'title', text }); continue; }
  if (COUNT[text] != null) { cues.push({ t: at, type: 'count', text, num: COUNT[text] }); continue; }
  if (/^EXECUTION$/.test(text)) { cues.push({ t: at, type: 'exec', text }); continue; }
  if (/^[A-Z0-9 \-O]+$/.test(text) && text.length >= 4) {
    cues.push({ t: at, type: 'stamp', text, red: RED.has(text) }); continue;
  }
  cues.push({ t: at, type: 'cap', text });
}
// stage notes (top-left, small) during wake
const sys = [
  [0.55, 'paper theatre — take 02 : marionette'],
  [2.20, 'loading marionette.dll ............ ok'],
  [4.40, 'strings: 5/5 attached'],
  [6.80, 'gravity (stage): 0.00 m/s^2'],
  [9.40, 'subject: asleep — dreaming in ink'],
  [12.20, 'curtain up in 3 . . 2 . . .'],
];
for (const [t, text] of sys) cues.push({ t, type: 'sys', text });
// outro epilogue (centered typewriter)
const epi = [
  [212.90, 'the world ran her one more time.'],
  [214.30, 'exit code 0 — nothing left to execute.'],
  [215.30, 'Mili — world.execute(me); (Miracle Milk, 2016)'],
  [216.00, 'procedural fan MV · every frame is f(t) · non-commercial'],
];
for (const [t, text] of epi) cues.push({ t, type: 'epi', text });
cues.sort((a, b) => a.t - b.t);
const energy = D.energy.map(v => +v.toFixed(4));
const TL = {
  bpm: 128, beat0: 0.32, songDuration: +D.duration.toFixed(2), mvDuration: 217.5,
  lrcOffset: OFF, energy, sections: SECTIONS, cues
};
const out = 'window.MV_TIMELINE=' + JSON.stringify(TL) + ';';
fs.writeFileSync(path.join(__dirname, '..', 'mv', 'timeline.js'), out);
console.log('timeline.js written:', SECTIONS.length, 'sections,', cues.length, 'cues, energy', energy.length);
