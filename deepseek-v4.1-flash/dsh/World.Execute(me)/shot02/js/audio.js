// audio.js — everything the picture knows about the song.
//
// The song was analysed offline (see _dev/bake-audio.mjs) into one value per
// VIDEO FRAME at 60 Hz. This module only looks values up and smooths them, so
// rendering never depends on live audio state and every frame stays a pure
// function of t.

export const FPS = 60;

/** Musical constants measured from the record (see _dev/grid.mjs):
 *  130.00 BPM, first downbeat at 0.217 s, sections are 8-bar blocks. */
export const BPM = 130.0;
export const BEAT = 60 / BPM;              // 0.461538 s
export const BAR = 4 * BEAT;               // 1.846154 s
export const BLOCK = 8 * BAR;              // 14.769231 s  (one song section)
export const T0 = 0.217;                   // first downbeat

/** The 14 eight-bar blocks of the record. */
export const BLOCKS = [
  { i: 0, id: 'boot', label: 'switch on the power line' },
  { i: 1, id: 'riffA', label: 'instrumental' },
  { i: 2, id: 'verse1', label: 'a set of points' },
  { i: 3, id: 'pre1', label: 'ac / dc' },
  { i: 4, id: 'chorus1', label: 'the pledge' },
  { i: 5, id: 'verse2', label: 'eggplant / tomato / cat' },
  { i: 6, id: 'pre2', label: 'f to m / s to m' },
  { i: 7, id: 'chorus2', label: 'you have left' },
  { i: 8, id: 'bridge', label: 'illegal arguments' },
  { i: 9, id: 'riffB', label: 'instrumental' },
  { i: 10, id: 'execution', label: 'execution' },
  { i: 11, id: 'final', label: 'the reversal' },
  { i: 12, id: 'coda', label: 'trapped in love' },
  { i: 13, id: 'riffA2', label: 'instrumental' },
];

export function blockStart(i) { return T0 + i * BLOCK; }
export function blockEnd(i) { return blockStart(i + 1); }

/** Decoded analysis: curves are base64 uint16, resampled with linear
 *  interpolation and a small attack/release follower for a musical feel. */
export class Music {
  constructor(json) {
    this.fps = json.fps || FPS;
    this.duration = json.duration;
    this.frames = json.frames;
    this.hits = json.hits || [];
    this.tempo = json.tempo;
    this.c = {};
    for (const [k, b64] of Object.entries(json.curves)) {
      const bin = atob(b64);
      const u = new Uint16Array(bin.length / 2);
      for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
      const f = new Float32Array(u.length);
      for (let i = 0; i < u.length; i++) f[i] = u[i] / 65535;
      this.c[k] = f;
    }
    // envelope followers (attack/release) computed once, deterministically
    this.env = {};
    for (const k of ['rms', 'bass', 'sub', 'mid', 'high', 'air', 'onset', 'kick']) {
      if (this.c[k]) this.env[k] = follow(this.c[k], this.fps);
    }
  }

  raw(name, t) {
    const a = this.c[name];
    if (!a) return 0;
    const x = Math.max(0, Math.min(a.length - 1.001, t * this.fps));
    const i = x | 0;
    const f = x - i;
    return a[i] * (1 - f) + a[i + 1] * f;
  }

  /** Smoothed value (attack/release follower). */
  get(name, t) {
    const a = this.env[name] || this.c[name];
    if (!a) return 0;
    const x = Math.max(0, Math.min(a.length - 1.001, t * this.fps));
    const i = x | 0;
    const f = x - i;
    return a[i] * (1 - f) + a[i + 1] * f;
  }

  /** Signed beat phase in [-1,1): 0 on the beat, +1 just before the next. */
  beatPhase(t) {
    const b = (t - T0) / BEAT;
    return (b - Math.floor(b)) * 2 - 1;
  }
  /** Beat index since the first downbeat (may be negative). */
  beatIndex(t) { return Math.floor((t - T0) / BEAT + 0.5); }
  /** Bar index (4 beats). */
  barIndex(t) { return Math.floor((t - T0) / BAR + 0.5); }

  /** Strength of the nearest transient within +/- `window` seconds. */
  hitNear(t, window = 0.09) {
    let best = 0;
    for (const [ht, s] of this.hits) {
      const d = Math.abs(ht - t);
      if (d < window) best = Math.max(best, s * (1 - d / window));
      if (ht > t + window) break;
    }
    return best;
  }
  /** Every transient in [a,b). */
  hitsIn(a, b) { return this.hits.filter((h) => h[0] >= a && h[0] < b); }

  /** Index of the current 8-bar block, or -1 before the first downbeat. */
  blockAt(t) {
    const n = Math.floor((t - T0) / BLOCK);
    return n < 0 ? -1 : n;
  }
  /** Normalised position inside the current block (0..1). */
  blockPhase(t) {
    const n = (t - T0) / BLOCK;
    return n - Math.floor(n);
  }
}

/** Deterministic attack/release envelope follower. */
function follow(src, fps, attack = 0.02, release = 0.35) {
  const out = new Float32Array(src.length);
  const ka = Math.exp(-1 / (attack * fps));
  const kr = Math.exp(-1 / (release * fps));
  let v = 0;
  for (let i = 0; i < src.length; i++) {
    const k = src[i] > v ? ka : kr;
    v = src[i] + (v - src[i]) * k;
    out[i] = v;
  }
  return out;
}

export async function loadMusic(url = 'assets/analysis.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('analysis.json missing: ' + r.status);
  return new Music(await r.json());
}
