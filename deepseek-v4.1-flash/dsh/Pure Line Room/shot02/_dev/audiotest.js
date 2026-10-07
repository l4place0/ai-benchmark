// audiotest.js — browser rehearsal for the two foundation modules.
// Bundled to _dev/audiotest.bundle.js and driven by _dev/audiotest.mjs.

import { createAudio } from '../js/core/audio.js';
import * as SF from '../js/core/strokefont.js';

const out = [];
const audio = createAudio();

const SFX = ['click', 'switch', 'lampClick', 'drawer', 'cabinet', 'doorOpen', 'doorClose', 'thud',
  'page', 'chime', 'globe', 'ceramic', 'cushion', 'knock', 'vinylDrop', 'penClick'];
const LOOPS = ['vinyl', 'music', 'fan', 'night', 'day', 'tick', 'rain'];

function run() {
  const report = { sfx: [], loops: [], params: [], font: {}, errors: [] };
  try {
    audio.unlock();
  } catch (e) { report.errors.push('unlock: ' + e.message); }

  for (const n of SFX) {
    try { audio.sfx(n, { gain: 0.9, rate: 1, pan: 0 }); report.sfx.push(n); } catch (e) { report.errors.push('sfx ' + n + ': ' + e.message); }
  }
  try { audio.sfx('chime', { note: 5 }); } catch (e) { report.errors.push('chime note: ' + e.message); }

  for (const n of LOOPS) {
    try { audio.setLoop(n, true, { speed: 2, intensity: 0.5 }); report.loops.push(n); } catch (e) { report.errors.push('loop ' + n + ': ' + e.message); }
  }
  for (const [k, v] of [['fanSpeed', 1], ['fanSpeed', 3], ['musicVol', 0.4], ['ambienceVol', 0.3]]) {
    try { audio.param(k, v); report.params.push(k + '=' + v); } catch (e) { report.errors.push('param ' + k + ': ' + e.message); }
  }
  for (let i = 0; i < 240; i++) {
    try { audio.update(1 / 60); } catch (e) { report.errors.push('update: ' + e.message); break; }
  }
  try {
    audio.setMuted(true); audio.setMuted(false); audio.setMasterVolume(0.6);
  } catch (e) { report.errors.push('mute/vol: ' + e.message); }

  // font
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?-_+=/()[]<>%&*#@';
  const missing = [...chars].filter((c) => SF.glyph(c).length === 0 && c !== ' ');
  report.font.missing = missing.join('');
  const L = SF.layout('The Room 12:45', 0.1, { align: 'center' });
  report.font.width = +L.width.toFixed(3);
  report.font.polys = L.polylines.length;
  let nan = 0;
  for (const p of L.polylines) for (const pt of p) if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) nan++;
  report.font.nan = nan;
  report.ctxState = (() => { try { return audio.isMuted(); } catch (e) { return 'err'; } })();
  return report;
}

// stop the loops again so the page stays quiet
function stopAll() {
  for (const n of LOOPS) { try { audio.setLoop(n, false); } catch (e) { /* noop */ } }
}

window.__AUDIOTEST__ = { run, stopAll, SF, audio };
document.getElementById('tag').textContent = 'audio+font ready';
