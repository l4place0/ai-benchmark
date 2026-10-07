// ============================================================
// tools/compose.js — original procedural score for the MV.
// Pure Node.js DSP (no deps). D minor, 130 BPM, timeline from
// config/timeline.js. Output: assets/audio.wav (48k 16-bit stereo)
// NOTE: original arrangement *inspired by* the structure/mood of
// Mili's "world.execute(me);" — no copyrighted audio is used.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const TL = require('../config/timeline.js');

const { SR, BAR, BEAT, DURATION, N: _, SECTIONS, KEY } = TL;
const N = TL.AUDIO_SAMPLES; // master length in samples

// ---------- buses ----------
const L = new Float32Array(N), R = new Float32Array(N);
const rvL = new Float32Array(N), rvR = new Float32Array(N); // reverb send
const dlL = new Float32Array(N), dlR = new Float32Array(N); // delay send

// ---------- utils ----------
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
function sIdx(t) { return Math.round(t * SR); }

// additive write of a voice callback (stereo out), clamped to buffer
function render(startT, dur, fn) {
  const base = sIdx(startT);
  const i0 = Math.max(0, base);
  const i1 = Math.min(N, sIdx(startT + dur));
  for (let i = i0; i < i1; i++) {
    fn((i - base) / SR, i);
  }
}

// 1-pole LP coefficient for cutoff fc at SR (time-constant form, always stable)
function lpCoef(fc) { return 1 - Math.exp(-2 * Math.PI * clamp(fc, 10, 22000) / SR); }

// ---------- instruments ----------
// kick: pitch-swept sine + click
function kick(t0, gain, f0 = 150, tau = 0.11, pan = 0) {
  const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
  render(t0, 0.5, (t, i) => {
    const f = 45 + (f0 - 45) * Math.exp(-t / 0.032);
    const ph = 2 * Math.PI * (45 * t + (f0 - 45) * 0.032 * (1 - Math.exp(-t / 0.032)));
    const a = Math.exp(-t / tau);
    const click = t < 0.004 ? (hash(i) * 2 - 1) * Math.exp(-t / 0.0025) * 0.7 : 0;
    const s = Math.sin(ph) * a + click;
    L[i] += s * gl; R[i] += s * gr;
    if (t < 0.3) { rvL[i] += s * gl * 0.03; rvR[i] += s * gr * 0.03; }
  });
}
// heartbeat = soft double thump
function heart(t0, gain) {
  const thump = (dt, g) => {
    render(t0 + dt, 0.6, (t, i) => {
      const ph = 2 * Math.PI * (38 * t + 30 * 0.05 * (1 - Math.exp(-t / 0.05)));
      const a = Math.exp(-t / 0.13) * g;
      const s = Math.sin(ph) * a;
      L[i] += s * 0.9; R[i] += s * 0.9;
      rvL[i] += s * 0.12; rvR[i] += s * 0.12;
    });
  };
  thump(0, gain); thump(0.17, gain * 0.6);
}
function snare(t0, gain, revSend = 0.25) {
  render(t0, 0.4, (t, i) => {
    const nz = (hash(i * 1.7) * 2 - 1);
    const tone = Math.sin(2 * Math.PI * 189 * t) * Math.exp(-t / 0.045) * 0.6;
    const a = Math.exp(-t / 0.085);
    const s = (nz * 0.75 + tone) * a * gain;
    L[i] += s * 0.95; R[i] += nz * 0.05 * a * gain + s * 0.05;
    rvL[i] += s * revSend; rvR[i] += s * revSend;
  });
}
function clap(t0, gain) {
  render(t0, 0.5, (t, i) => {
    let e = Math.exp(-t / 0.14);
    if (t < 0.028) e = Math.max(e, Math.exp(-((t * 1000) % 12) / 3) * (t < 0.026 ? 1 : 0));
    const nz = (hash(i * 2.3) * 2 - 1);
    const s = nz * e * gain * 0.7;
    L[i] += s; R[i] += s;
    rvL[i] += s * 0.3; rvR[i] += s * 0.3;
  });
}
function hat(t0, gain, open = false, pan = 0) {
  const dur = open ? 0.32 : 0.09;
  const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
  render(t0, dur, (t, i) => {
    let nz = (hash(i * 3.1 + 7) * 2 - 1);
    // crude HP: subtract slow component
    nz -= (hash(Math.floor(i / 24) * 3.1 + 7) * 2 - 1) * 0.9;
    const s = nz * Math.exp(-t / (open ? 0.12 : 0.024)) * gain * 0.5;
    L[i] += s * gl; R[i] += s * gr;
  });
}
function crash(t0, gain, dur = 1.6) {
  render(t0, dur, (t, i) => {
    const a = Math.exp(-t / (dur * 0.62)) * gain;
    const nl = (hash(i * 4.3) * 2 - 1), nr = (hash(i * 5.9 + 3) * 2 - 1);
    const nzl = nl - (hash(Math.floor(i / 12) * 4.3) * 2 - 1) * 0.85;
    const nzr = nr - (hash(Math.floor(i / 12) * 5.9 + 3) * 2 - 1) * 0.85;
    L[i] += nzl * a * 0.5; R[i] += nzr * a * 0.5;
    rvL[i] += nzl * a * 0.25; rvR[i] += nzr * a * 0.25;
  });
}
function bassNote(t0, midi, dur, gain, bright = 0.5) {
  const f = midiHz(midi);
  render(t0, dur + 0.15, (t, i) => {
    if (t > dur) return;
    const ph = 2 * Math.PI * f * t;
    const saw = 2 * (((f * t) % 1)) - 1;
    const sub = Math.sin(ph) * 0.9;
    const cut = 150 + 950 * bright * Math.exp(-t / 0.22);
    const c = lpCoef(cut);
    // cheap per-sample LP state via deterministic approx: use fixed two-pole feel
    const sawF = saw * (1 - Math.exp(-t / 0.01)); // soften attack
    const env = t < 0.004 ? t / 0.004 : Math.min(1, 0.6 + 0.4 * Math.exp(-(t - 0.004) / 0.25));
    const rel = t > dur - 0.05 ? Math.max(0, (dur - t) / 0.05) : 1;
    const s = (sawF * 0.45 + sub * 0.55) * env * rel * gain;
    L[i] += s * 0.98; R[i] += s * 0.98;
  });
}
// FM electric piano
function ep(t0, midi, dur, gain, pan = 0) {
  const f = midiHz(midi);
  const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
  render(t0, dur + 0.4, (t, i) => {
    const idx = 3.4 * Math.exp(-t / 0.32);
    const s = Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * 2 * f * t));
    const env = t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) / Math.max(0.28, dur * 0.55));
    const rel = t > dur ? Math.exp(-(t - dur) / 0.12) : 1;
    const sv = s * env * rel;
    L[i] += sv * gl; R[i] += sv * gr;
    rvL[i] += sv * gl * 0.18; rvR[i] += sv * gr * 0.18;
    dlL[i] += sv * gl * 0.10; dlR[i] += sv * gr * 0.10;
  });
}
// detuned-saw pad chord (stereo spread)
function pad(t0, midis, dur, gain, bright = 0.4) {
  midis.forEach((m, k) => {
    const f = midiHz(m);
    const pn = hash(k * 9.7) * 1.2 - 0.6;
    const gl = Math.cos((pn + 1) * Math.PI / 4) * gain / midis.length;
    const gr = Math.sin((pn + 1) * Math.PI / 4) * gain / midis.length;
    const det = [-0.008, 0, 0.009];
    render(t0, dur + 1.6, (t, i) => {
      const att = t < 0.45 ? t / 0.45 : 1;
      const rel = t > dur ? Math.exp(-(t - dur) / 1.1) : 1;
      let s = 0;
      for (let d = 0; d < 3; d++) s += 2 * (((f * (1 + det[d]) * t) % 1)) - 1;
      s = s / 3 * 0.55 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.2;
      const cut = lpCoef(500 + 2200 * bright);
      // approximate static LP by mixing with slow hash-lerp is invalid; use sin-shaping instead:
      const soft = s * 0.7 + Math.tanh(s * 1.8) * 0.3 * (1 - bright);
      const sv = soft * att * rel;
      L[i] += sv * gl; R[i] += sv * gr;
      rvL[i] += sv * gl * 0.5; rvR[i] += sv * gr * 0.5;
    });
  });
}
// choir-ish stacked triangle chord
function choir(t0, midis, dur, gain) {
  midis.forEach((m, k) => {
    const f = midiHz(m);
    const pn = hash(k * 4.3 + 2) * 1.0 - 0.5;
    const gl = Math.cos((pn + 1) * Math.PI / 4) * gain / midis.length;
    const gr = Math.sin((pn + 1) * Math.PI / 4) * gain / midis.length;
    render(t0, dur + 1.2, (t, i) => {
      const att = t < 0.3 ? t / 0.3 : 1;
      const rel = t > dur ? Math.exp(-(t - dur) / 0.9) : 1;
      let s = 0;
      for (let d = 0; d < 4; d++) s += Math.sin(2 * Math.PI * f * (1 + (d - 1.5) * 0.0007) * t) * 0.5
        + Math.sin(2 * Math.PI * f * (1 + (d - 1.5) * 0.0007) * 2 * t) * 0.12;
      s = s / 4;
      // formant-ish tilt: emphasize 500-1400 Hz region via soft sat
      const sv = (Math.tanh(s * 2.2) * 0.8) * att * rel;
      L[i] += sv * gl; R[i] += sv * gr;
      rvL[i] += sv * gl * 0.65; rvR[i] += sv * gr * 0.65;
    });
  });
}
// lead synth (saw+tri, vibrato)
function lead(t0, midi, dur, gain, opts = {}) {
  const f = midiHz(midi);
  const { oct = 0, vib = 1, cut = 3200 } = opts;
  render(t0, dur + 0.3, (t, i) => {
    const att = t < 0.012 ? t / 0.012 : 1;
    const rel = t > dur ? Math.exp(-(t - dur) / 0.13) : 1;
    const vibF = f * (1 + 0.0035 * vib * Math.max(0, t - 0.16) * Math.sin(2 * Math.PI * 5.3 * t));
    const saw = 2 * (((vibF * t) % 1)) - 1;
    const tri = 4 * Math.abs(2 * (((vibF * t + 0.25) % 1))) - 1;
    const fo = f * Math.pow(2, oct);
    const saw2 = 2 * (((fo * t) % 1)) - 1;
    let s = (saw * 0.5 + tri * 0.5) + saw2 * (oct ? 0.16 : 0);
    const c = lpCoef(cut + 1500 * Math.exp(-t / 0.12));
    const sLP = s * 0.6 + Math.tanh(s * 1.5) * 0.4; // soft edge
    const sv = sLP * att * rel * gain;
    L[i] += sv * 0.92; R[i] += sv * 0.92;
    dlL[i] += sv * 0.32; dlR[i] += sv * 0.32;
    rvL[i] += sv * 0.3; rvR[i] += sv * 0.3;
  });
}
// noise riser with rising brightness + rising saw
function riser(t0, dur, gain) {
  render(t0, dur, (t, i) => {
    const p = t / dur;
    const nz = (hash(i * 6.7) * 2 - 1);
    const cut = lpCoef(400 + 7000 * p * p);
    const lp = nz * (0.35 + 0.65 * p); // approx brightening
    const fRise = midiHz(50 + 24 * p);
    const saw = 2 * (((fRise * t) % 1)) - 1;
    const s = (lp * 0.75 + saw * 0.22) * (p * p) * gain;
    L[i] += s * 0.9; R[i] += s * 0.9;
    rvL[i] += s * 0.2; rvR[i] += s * 0.2;
  });
}
// boom impact
function impact(t0, gain) {
  render(t0, 2.2, (t, i) => {
    const sub = Math.sin(2 * Math.PI * (30 + 25 * Math.exp(-t / 0.08)) * t);
    const nz = (hash(i * 7.7) * 2 - 1) * Math.exp(-t / 0.18) * 0.5;
    const a = Math.exp(-t / 0.5) * gain;
    const s = (sub * 0.85 + nz) * a;
    L[i] += s * 0.95; R[i] += s * 0.95;
    rvL[i] += s * 0.5; rvR[i] += s * 0.5;
  });
}
function blip(t0, f, gain) {
  render(t0, 0.09, (t, i) => {
    const s = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.02) * gain;
    L[i] += s * 0.8; R[i] += s * 0.8;
    dlL[i] += s * 0.5; dlR[i] += s * 0.2;
  });
}
// data tick (typing)
function tick(t0, gain) {
  render(t0, 0.03, (t, i) => {
    const nz = (hash(i * 8.9) * 2 - 1) - (hash(Math.floor(i / 6) * 8.9) * 2 - 1) * 0.9;
    L[i] += nz * gain; R[i] += nz * gain * 0.7;
  });
}
// reverse swell into a downbeat
function swell(t0, dur, gain) {
  render(t0, dur, (t, i) => {
    const p = t / dur;
    const nz = (hash(i * 9.3) * 2 - 1);
    const s = nz * p * p * gain * 0.4;
    L[i] += s * (1 - p * 0.3); R[i] += s * (0.7 + p * 0.3);
    rvL[i] += s * 0.3; rvR[i] += s * 0.3;
  });
}

// ---------- harmony ----------
const CH = {
  Dm: [50, 57, 62, 65], Bb: [46, 53, 58, 62], F: [41, 48, 53, 57], C: [48, 55, 60, 64],
  Gm: [43, 50, 55, 58], A: [45, 52, 57, 61], Eb: [39, 46, 51, 55], E: [40, 47, 52, 56],
};
const BASS = { Dm: 38, Bb: 34, F: 41, C: 36, Gm: 31, A: 33, Eb: 39, E: 40 };
const barT = bar => bar * BAR;
const sec = id => SECTIONS.find(s => s.id === id);

// ---------- score ----------
function buildScore() {
  const prog = {
    verse: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
    pre: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
    chorus: ['Dm', 'F', 'C', 'Gm', 'Dm', 'F', 'C', 'Gm', 'Bb', 'F', 'Gm', 'A', 'Bb', 'F', 'Gm', 'A'],
    v2: ['Bb', 'C', 'Dm', 'A', 'Bb', 'C', 'Dm', 'A'],
    bridge: ['Dm', 'Dm', 'Dm', 'Dm', 'Dm', 'Eb', 'E', 'E', 'Dm', 'Eb', 'E', 'E'],
    cho3: ['Dm', 'F', 'C', 'Gm', 'Dm', 'F', 'C', 'Gm', 'Bb', 'C', 'Gm', 'A', 'Bb', 'C', 'Dm', 'Dm'],
    outro: ['Bb', 'F', 'Gm', 'Dm', 'Bb', 'C', 'Dm', 'Dm'],
  };

  // ===== INTRO (bars 0-8) =====
  {
    const s = sec('intro');
    pad(barT(0), [26, 38, 45], s.bars * BAR, 0.16, 0.1); // D drone (D1 D2 A2)
    for (let b = 2; b < 8; b++) if (b % 2 === 0) heart(barT(b) + 0.02, 0.5);
    // piano motif ×2
    const motif = [
      [0, 74, 1], [1.5, 69, 0.5], [2, 65, 1], [3, 64, 1],
      [4, 65, 1.5], [5.5, 67, 0.5], [6, 69, 2],
      [8, 72, 1], [9, 70, 1], [10, 69, 1], [11, 65, 1],
      [12, 64, 3.5],
    ];
    for (let rep = 0; rep < 2; rep++) for (const [bt, m, d] of motif)
      ep(barT(0) + (rep * 16 + bt) * BEAT, m, d * BEAT, rep ? 0.20 : 0.16, (hash(m) - 0.5) * 0.5);
    // boot data blips + typing ticks
    for (let t = 0.5; t < s.t1 - 1.2; t += BEAT / 2) {
      if (hash(t * 31) > 0.72) blip(t, 900 + hash(t * 17) * 1400, 0.05 + hash(t * 3) * 0.05);
    }
    for (let t = 0.8; t < 13.0; t += 0.125) if (hash(Math.floor(t * 8)) > 0.25) tick(t, 0.05);
    blip(KEY.executeTyped, 660, 0.14); blip(KEY.executeTyped + 0.12, 990, 0.12);
    swell(s.t1 - BEAT * 2, BEAT * 2, 0.25);
  }

  // ===== VERSE 1a / 1b (bars 8-24) =====
  for (const id of ['v1a', 'v1b']) {
    const s = sec(id);
    const p = prog.verse;
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 8];
      pad(t0, CH[ch], BAR * 1.05, 0.11, 0.25);
      bassNote(t0, BASS[ch], BEAT * 2, 0.34); bassNote(t0 + BEAT * 2.5, BASS[ch] + 12, BEAT * 1, 0.22);
      kick(t0, 0.8); kick(t0 + BEAT * 2, 0.75); if (b % 2 === 1) kick(t0 + BEAT * 3.5, 0.45);
      snare(t0 + BEAT * 2, 0.5);
      for (let h = 0; h < 8; h++) hat(t0 + h * BEAT * 0.5, h % 2 ? 0.16 : 0.3, false, h % 2 ? 0.3 : -0.3);
      if (hash(s.bar + b) > 0.6) hat(t0 + BEAT * 3.75, 0.2, true);
      // arp 16ths
      for (let st = 0; st < 16; st++) {
        if (hash((s.bar + b) * 16 + st) > 0.88) continue;
        const note = CH[ch][st % 4] + 12 + (st % 8 >= 4 ? 12 : 0);
        ep(t0 + st * BEAT * 0.25, note, BEAT * 0.3, 0.09 + hash(st * 5 + b) * 0.05, st % 2 ? 0.35 : -0.35);
      }
    }
    // sparse call motif
    ep(barT(s.bar) + 2 * BAR, 74, BEAT * 2, 0.16, 0.2);
    ep(barT(s.bar) + 6 * BAR, 72, BEAT * 2, 0.14, -0.2);
    if (id === 'v1b') { // echo higher
      ep(barT(s.bar) + 2 * BAR + 3 * BEAT, 77, BEAT, 0.1, 0.4);
      ep(barT(s.bar) + 6 * BAR + 3 * BEAT, 76, BEAT, 0.1, -0.4);
    }
    swell(s.t1 - BEAT * 2, BEAT * 2, 0.2);
  }

  // ===== PRE 1 / PRE 2 (bars 24-32, 56-64) =====
  for (const id of ['pre1', 'pre2']) {
    const s = sec(id);
    const p = prog.pre;
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 8];
      pad(t0, CH[ch], BAR * 1.05, 0.13, 0.45 + 0.3 * b / s.bars);
      bassNote(t0, BASS[ch], BEAT * 2, 0.36); bassNote(t0 + BEAT * 2.5, BASS[ch] + 12, BEAT, 0.24);
      kick(t0, 0.85); kick(t0 + BEAT * 2, 0.8);
      snare(t0 + BEAT * 2, 0.55);
      for (let h = 0; h < 8; h++) hat(t0 + h * BEAT * 0.5, h % 2 ? 0.18 : 0.32, false, h % 2 ? 0.3 : -0.3);
      for (let st = 0; st < 16; st++) {
        if (hash((s.bar + b) * 16 + st + 99) > 0.8) continue;
        const note = CH[ch][st % 4] + 12 + (st % 8 >= 4 ? 12 : 0);
        ep(t0 + st * BEAT * 0.25, note, BEAT * 0.3, 0.1 + hash(st * 3 + b) * 0.05, st % 2 ? 0.35 : -0.35);
      }
      // snare ramp last 2 bars
      if (b >= s.bars - 2) {
        const div = b === s.bars - 2 ? 4 : 8;
        for (let k = 0; k < div; k++) snare(t0 + k * BAR / div, 0.18 + 0.3 * k / div);
      }
    }
    riser(s.t1 - 4 * BAR, 4 * BAR, 0.4);
    swell(s.t1 - BEAT * 2, BEAT * 2, 0.35);
  }

  // ===== CHORUS 1 & 2 (bars 32-48, 64-80) =====
  for (const id of ['cho1', 'cho2']) {
    const s = sec(id);
    const p = prog.chorus;
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 16];
      pad(t0, CH[ch], BAR * 1.05, 0.16, 0.6);
      if (b % 4 === 0) choir(t0, CH[ch].map(m => m + 12), 4 * BAR, 0.055);
      bassNote(t0, BASS[ch], BEAT, 0.4, 0.6); bassNote(t0 + BEAT, BASS[ch], BEAT, 0.3, 0.6);
      bassNote(t0 + BEAT * 2, BASS[ch], BEAT, 0.4, 0.6); bassNote(t0 + BEAT * 3, BASS[ch] + 12, BEAT, 0.32, 0.6);
      for (let q = 0; q < 4; q++) kick(t0 + q * BEAT, q === 0 ? 0.95 : 0.85);
      clap(t0 + BEAT, 0.5); clap(t0 + BEAT * 3, 0.5);
      for (let h = 0; h < 4; h++) hat(t0 + h * BEAT + BEAT * 0.5, 0.3, true, h % 2 ? 0.25 : -0.25);
      for (let h = 0; h < 16; h++) hat(t0 + h * BEAT * 0.25, 0.1, false, h % 2 ? 0.4 : -0.4);
    }
    if (id === 'cho1') crash(barT(s.bar), 0.5), crash(barT(s.bar + 8), 0.4);
    else crash(barT(s.bar), 0.45), crash(barT(s.bar + 8), 0.4), impact(barT(s.bar), 0.5);
    // ===== lead melody (original) =====
    const mel = [
      // phrase A (bars 1-4): Dm F C Gm
      [0, 69, 1.5], [1.5, 65, 0.5], [2, 67, 1], [3, 69, 1],
      [4, 72, 2], [6, 69, 1], [7, 67, 1],
      [8, 67, 1.5], [9.5, 64, 0.5], [10, 65, 1], [11, 67, 1],
      [12, 70, 2.5], [14.5, 69, 0.5], [15, 67, 0.5],
      // phrase B (bars 5-8): Dm F C Gm
      [16, 74, 1.5], [17.5, 69, 0.5], [18, 70, 1], [19, 72, 1],
      [20, 69, 2], [22, 65, 1], [23, 67, 1],
      [24, 64, 1.5], [25.5, 67, 0.5], [26, 69, 2],
      [28, 67, 3], [31, 69, 1],
      // phrase C (bars 9-12): Bb F Gm A
      [32, 70, 1.5], [33.5, 67, 0.5], [34, 69, 1], [35, 70, 1],
      [36, 72, 2], [38, 69, 1], [39, 72, 1],
      [40, 74, 2.5], [42.5, 72, 0.5], [43, 70, 1],
      [44, 69, 4],
      // phrase D (bars 13-16): Bb F Gm A (tail resolve)
      [48, 70, 1.5], [49.5, 67, 0.5], [50, 69, 1], [51, 70, 1],
      [52, 72, 2], [54, 69, 1], [55, 70, 1],
      [56, 74, 2.5], [58.5, 72, 0.5], [59, 70, 1],
      [60, 69, 1], [61, 67, 1], [62, 65, 2],
    ];
    for (const [bt, m, d] of mel) {
      const g = (id === 'cho2' ? 0.16 : 0.18);
      lead(barT(s.bar) + bt * BEAT, m, d * BEAT * 0.95, g, { oct: id === 'cho2' ? 12 : 0, vib: 1 });
    }
    if (id === 'cho2') { // countermelody (low echo)
      const cm = [[4, 50, 2], [12, 53, 2], [20, 48, 2], [28, 55, 2], [36, 46, 2], [44, 45, 2], [52, 43, 2], [60, 45, 2]];
      for (const [bt, m, d] of cm) lead(barT(s.bar) + bt * BEAT, m, d * BEAT * 0.9, 0.08, { cut: 1400, vib: 0.4 });
    }
    swell(s.t1 - BEAT, BEAT, 0.3);
  }

  // ===== VERSE 2 (bars 48-56) =====
  {
    const s = sec('v2');
    const p = prog.v2;
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 8];
      pad(t0, CH[ch], BAR * 1.05, 0.12, 0.3);
      bassNote(t0, BASS[ch], BEAT * 3.5, 0.35, 0.35);
      kick(t0, 0.7); kick(t0 + BEAT * 2.75, 0.5);
      snare(t0 + BEAT * 2, 0.4);
      hat(t0, 0.25); hat(t0 + BEAT * 2, 0.2);
      for (let st = 0; st < 8; st++) {
        if (hash((s.bar + b) * 8 + st + 7) > 0.65) continue;
        ep(t0 + st * BEAT * 0.5, CH[ch][st % 4] + 12, BEAT * 0.45, 0.09, st % 2 ? 0.3 : -0.3);
      }
      // glitch accents
      if (hash(b * 13) > 0.5) for (let k = 0; k < 4; k++) tick(t0 + BEAT * 3 + k * 0.03, 0.3);
    }
    ep(barT(s.bar) + BAR * 2, 74, BEAT * 3, 0.15, 0.2);
    ep(barT(s.bar) + BAR * 6, 77, BEAT * 2, 0.13, -0.2);
    swell(s.t1 - BEAT * 2, BEAT * 2, 0.25);
  }

  // ===== BRIDGE (bars 80-92): countdown =====
  {
    const s = sec('bridge');
    const p = prog.bridge;
    pad(barT(80), [26, 38, 45], 4 * BAR, 0.15, 0.12);
    for (let b = 0; b < 4; b++) heart(barT(80 + b) + 0.02, 0.6);
    // countdown bars 84..92 (8 bars), chromatic bass climb
    const climb = [38, 38, 39, 40, 41, 42, 43, 44];
    for (let k = 0; k < 8; k++) {
      const t0 = barT(84 + k);
      bassNote(t0, climb[k], BAR * 0.9, 0.4, 0.3);
      pad(t0, [climb[k] + 12, climb[k] + 19], BAR * 1.05, 0.09, 0.3);
      const f = 620 * Math.pow(2, k / 8);
      blip(t0, f, 0.16); blip(t0 + 0.06, f * 1.5, 0.1);
      heart(t0 + 0.02, 0.5 + k * 0.06);
      for (let h = 0; h < 4; h++) hat(t0 + h * BEAT, 0.08 + k * 0.02, false, h % 2 ? 0.3 : -0.3);
    }
    riser(barT(88), 4 * BAR, 0.55);
    // snare roll crescendo bars 90-92 (16ths→32nds)
    for (let b = 0; b < 2; b++) {
      const div = b === 0 ? 8 : 16;
      for (let k = 0; k < div; k++) snare(barT(90 + b) + k * BAR / div, 0.1 + 0.35 * (b * div + k) / (2 * div));
    }
    impact(KEY.whiteout - 0.36, 0.75); // final breath, cut by the silence
  }

  // ===== FINAL CHORUS cho3 (bars 92-108) =====
  {
    const s = sec('cho3');
    const p = prog.cho3;
    impact(KEY.whiteout + 0.30, 0.95); // the slam, exactly as master reopens
    crash(KEY.whiteout + 0.32, 0.55);
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 16];
      pad(t0, CH[ch], BAR * 1.05, 0.18, 0.7);
      choir(t0, CH[ch].map(m => m + 12), BAR * 1.1, 0.075);
      bassNote(t0, BASS[ch], BEAT, 0.42, 0.7); bassNote(t0 + BEAT, BASS[ch], BEAT, 0.32, 0.7);
      bassNote(t0 + BEAT * 2, BASS[ch], BEAT, 0.42, 0.7); bassNote(t0 + BEAT * 3, BASS[ch] + 12, BEAT, 0.34, 0.7);
      for (let q = 0; q < 4; q++) kick(t0 + q * BEAT, 0.95);
      clap(t0 + BEAT, 0.55); clap(t0 + BEAT * 3, 0.55);
      for (let h = 0; h < 4; h++) hat(t0 + h * BEAT + BEAT * 0.5, 0.32, true, h % 2 ? 0.25 : -0.25);
      for (let h = 0; h < 16; h++) hat(t0 + h * BEAT * 0.25, 0.11, false, h % 2 ? 0.4 : -0.4);
      if (b % 4 === 0 && b > 0) crash(t0, 0.35);
    }
    for (const [bt, m, d] of [
      [0, 69, 1.5], [1.5, 65, 0.5], [2, 67, 1], [3, 69, 1],
      [4, 72, 2], [6, 69, 1], [7, 67, 1],
      [8, 67, 1.5], [9.5, 64, 0.5], [10, 65, 1], [11, 67, 1],
      [12, 70, 2.5], [14.5, 69, 0.5], [15, 67, 0.5],
      [16, 74, 1.5], [17.5, 69, 0.5], [18, 70, 1], [19, 72, 1],
      [20, 77, 2], [22, 74, 1], [23, 72, 1],
      [24, 72, 1.5], [25.5, 67, 0.5], [26, 69, 2],
      [28, 67, 3], [31, 69, 1],
      [32, 70, 1.5], [33.5, 67, 0.5], [34, 69, 1], [35, 70, 1],
      [36, 72, 2], [38, 74, 1], [39, 72, 1],
      [40, 74, 2.5], [42.5, 72, 0.5], [43, 70, 1],
      [44, 69, 2], [46, 72, 2],
      [48, 77, 1.5], [49.5, 74, 0.5], [50, 72, 1], [51, 74, 1],
      [52, 72, 2], [54, 70, 1], [55, 72, 1],
      [56, 74, 3.5], [59.5, 72, 0.5],
      [60, 74, 4],
    ]) {
      lead(barT(s.bar) + bt * BEAT, m, d * BEAT * 0.95, 0.17, { oct: 12, vib: 1 });
    }
  }

  // ===== OUTRO (bars 108-116) =====
  {
    const s = sec('outro');
    const p = prog.outro;
    for (let b = 0; b < s.bars; b++) {
      const t0 = barT(s.bar + b), ch = p[b % 8];
      pad(t0, CH[ch], BAR * 1.05, 0.13, 0.2);
      bassNote(t0, BASS[ch], BAR * 0.95, 0.3 - b * 0.02, 0.25);
      if (b < 6) heart(t0 + 0.02, 0.4 * (1 - b / 6));
      if (b < 4) for (let st = 0; st < 8; st++) {
        if (hash((s.bar + b) * 8 + st + 55) > 0.6) continue;
        ep(t0 + st * BEAT * 0.5, CH[ch][st % 4] + 12, BEAT * 0.5, 0.08 * (1 - b / 5), st % 2 ? 0.3 : -0.3);
      }
    }
    // piano motif reprise (last 4 bars)
    const motif = [
      [0, 74, 1], [1.5, 69, 0.5], [2, 65, 1], [3, 64, 1],
      [4, 65, 1.5], [5.5, 67, 0.5], [6, 69, 2],
      [8, 72, 1], [9, 70, 1], [10, 69, 1], [11, 65, 1],
      [12, 62, 4],
    ];
    for (const [bt, m, d] of motif) ep(barT(112) + bt * BEAT, m, d * BEAT, 0.17, (hash(m) - 0.5) * 0.4);
    blip(KEY.exitCode, 880, 0.1);
    blip(KEY.goodbye, 440, 0.09); blip(KEY.goodbye + 0.15, 330, 0.07);
  }
}
buildScore();

// ---------- fx processing ----------
function schroeder() {
  const combLens = [1487, 1861, 2053, 2251].map(x => Math.round(x * SR / 44100));
  const apLens = [347, 113].map(x => Math.round(x * SR / 44100));
  const fb = 0.80, damp = 0.28;
  const wet = [new Float32Array(N), new Float32Array(N)];
  const input = [rvL, rvR];
  for (let chn = 0; chn < 2; chn++) {
    const inp = input[chn], out = wet[chn];
    for (let ci = 0; ci < combLens.length; ci++) {
      const len = combLens[ci] + chn * 23;
      const buf = new Float32Array(len);
      let filt = 0;
      const c = lpCoef(5000);
      for (let i = 0; i < N; i++) {
        const o = buf[i % len];
        filt = filt + c * (o - filt);
        buf[i % len] = inp[i] * 0.9 + filt * fb;
        out[i] += o * (1 / combLens.length);
      }
    }
    for (const alen0 of apLens) {
      const len = alen0 + chn * 11;
      const buf = new Float32Array(len);
      let g = 0.5;
      for (let i = 0; i < N; i++) {
        const o = buf[i % len];
        const v = out[i] + o * g;
        buf[i % len] = v;
        out[i] = o - v * g;
      }
    }
  }
  // pre-delay + mix into master
  const pd = Math.round(0.019 * SR);
  for (let i = 0; i < N - pd; i++) {
    L[i] += wet[0][i] * 0.42; R[i] += wet[1][i] * 0.42;
  }
}
function pingpong() {
  const d = Math.round(BEAT * 0.75 * SR);
  const bufL = new Float32Array(N + d), bufR = new Float32Array(N + d);
  const fb = 0.44;
  const c = lpCoef(3400);
  let fl = 0, fr = 0;
  for (let i = 0; i < N; i++) {
    const ol = bufL[i], or_ = bufR[i];
    fl += c * (or_ - fl); fr += c * (ol - fr);
    bufL[i + d] = dlL[i] + fr * fb;
    bufR[i + d] = dlR[i] + fl * fb;
    L[i] += ol * 0.5; R[i] += or_ * 0.5;
  }
}
schroeder();
pingpong();

// ---------- master ----------
function master() {
  // duck envelope: whiteout gap
  const w0 = KEY.whiteout - 0.015, w1 = KEY.whiteout + 0.30;
  const i0 = sIdx(w0), i1 = sIdx(w1);
  // HP 24Hz + LP 15k (1-pole each), then gain env + softclip
  const cHP = lpCoef(26), cLP = lpCoef(15500);
  let hpL = 0, hpR = 0, lpL = 0, lpR = 0, prevL = 0, prevR = 0;
  const outL = new Float32Array(N), outR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const inL = L[i], inR = R[i];
    hpL += cHP * (inL - hpL); hpR += cHP * (inR - hpR);
    const bL = inL - hpL, bR = inR - hpR;
    lpL += cLP * (bL - lpL); lpR += cLP * (bR - lpR);
    let g = 1;
    if (i >= i0 && i < i1) g = 0.04;
    else if (i >= i1 && i < i1 + sIdx(0.004)) g = 0.04 + 0.96 * (i - i1) / sIdx(0.004);
    let sL = lpL * g, sR = lpR * g;
    outL[i] = Math.tanh(sL * 1.25) * 0.94;
    outR[i] = Math.tanh(sR * 1.25) * 0.94;
  }
  // normalize to 0.97 peak
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
  const gn = 0.97 / Math.max(peak, 1e-6);
  // fades
  const fi = sIdx(0.05), fo = sIdx(2.2), f0 = N - fo;
  for (let i = 0; i < N; i++) {
    let g = gn;
    if (i < fi) g *= i / fi;
    if (i > f0) g *= Math.pow(Math.max(0, (N - i) / fo), 1.6);
    outL[i] *= g; outR[i] *= g;
  }
  return { outL, outR };
}
const { outL, outR } = master();

// ---------- stats + wav ----------
function rms(buf, a, b) { let s = 0; for (let i = a; i < b; i++) s += buf[i] * buf[i]; return Math.sqrt(s / (b - a)); }
console.log('== section RMS (dynamics check) ==');
for (const s of SECTIONS) {
  const a = Math.max(0, sIdx(s.t0) + SR * 0.5), b = Math.min(N, sIdx(s.t1) - SR * 0.2);
  if (b <= a) continue;
  console.log(`${s.id.padEnd(8)} t=${s.t0.toFixed(1).padStart(6)}-${s.t1.toFixed(1).padStart(6)} rms=${rms(outL, a, b).toFixed(4)}`);
}
const w0 = sIdx(KEY.whiteout + 0.03), w1 = sIdx(KEY.whiteout + 0.27);
console.log(`whiteout gap rms: ${rms(outL, w0, w1).toFixed(5)}`);

const bytes = Buffer.alloc(44 + N * 4);
bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + N * 4, 4); bytes.write('WAVE', 8);
bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(SR, 24); bytes.writeUInt32LE(SR * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
bytes.write('data', 36); bytes.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  bytes.writeInt16LE(clamp(Math.round(outL[i] * 32767), -32768, 32767), 44 + i * 4);
  bytes.writeInt16LE(clamp(Math.round(outR[i] * 32767), -32768, 32767), 44 + i * 4 + 2);
}
const outPath = path.join(__dirname, '..', 'assets', 'audio.wav');
fs.writeFileSync(outPath, bytes);
console.log(`WAV written: ${outPath}  dur=${(N / SR).toFixed(3)}s  size=${(bytes.length / 1e6).toFixed(1)}MB  frames=${TL.FRAMES}`);
