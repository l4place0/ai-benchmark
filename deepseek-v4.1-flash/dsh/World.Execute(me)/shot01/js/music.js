// music.js — turns the baked analysis into smooth per-frame parameters.
// Everything here is a pure function of t and the frozen analysis table.

function smooth(arr, radius, passes = 1) {
  let a = arr;
  for (let p = 0; p < passes; p++) {
    const o = new Float32Array(a.length);
    let sum = 0;
    const w = radius * 2 + 1;
    for (let i = -radius; i <= radius; i++) sum += a[Math.min(a.length - 1, Math.max(0, i))];
    for (let i = 0; i < a.length; i++) {
      o[i] = sum / w;
      const add = a[Math.min(a.length - 1, i + radius + 1)];
      const sub = a[Math.max(0, i - radius)];
      sum += add - sub;
    }
    a = o;
  }
  return a;
}

export class Music {
  static async load(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('analysis load failed: ' + r.status);
    return new Music(await r.json());
  }

  constructor(d) {
    this.raw = d;
    this.fps = d.fps;
    this.frames = d.frames;
    this.duration = d.durationSec;
    this.bpm = d.bpm;
    this.beatFrames = d.beatFrames;
    this.barFrames = d.barFrames;
    this.beatPhase = d.beatPhaseSec;
    // gentle smoothing keeps the visuals from flickering; attack is preserved
    this.bass = smooth(Float32Array.from(d.bass, v => v / 255), 3, 1);
    this.mid = smooth(Float32Array.from(d.mid, v => v / 255), 3, 1);
    this.high = smooth(Float32Array.from(d.high, v => v / 255), 2, 1);
    this.rms = smooth(Float32Array.from(d.rms, v => v / 255), 4, 1);
    this.flux = Float32Array.from(d.flux, v => v / 255);
    this.curve = smooth(Float32Array.from(d.curve, v => v / 255), 12, 1);
    this.beatFramesArr = d.beats;
    this.beatTimes = d.beats.map(f => f / this.fps);
    this.downTimes = d.downbeats.map(f => f / this.fps);
    // slow-moving "energy" for long-arc shaping
    this.slow = smooth(Float32Array.from(d.rms, v => v / 255), 60, 2);
  }

  /** linear sample of a per-frame array at time t (seconds) */
  s(arr, t) {
    const f = t * this.fps;
    const i = Math.floor(f);
    if (i < 0) return arr[0];
    if (i >= arr.length - 1) return arr[arr.length - 1];
    const fr = f - i;
    return arr[i] * (1 - fr) + arr[i + 1] * fr;
  }

  bassAt(t) { return this.s(this.bass, t); }
  midAt(t) { return this.s(this.mid, t); }
  highAt(t) { return this.s(this.high, t); }
  rmsAt(t) { return this.s(this.rms, t); }
  curveAt(t) { return this.s(this.curve, t); }
  slowAt(t) { return this.s(this.slow, t); }

  /** index of the last beat at or before t (-1 if none) */
  lastBeat(t) {
    const a = this.beatTimes;
    let lo = 0, hi = a.length - 1, res = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= t) { res = m; lo = m + 1; } else hi = m - 1; }
    return res;
  }

  lastDown(t) {
    const a = this.downTimes;
    let lo = 0, hi = a.length - 1, res = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= t) { res = m; lo = m + 1; } else hi = m - 1; }
    return res;
  }

  /** beat pulse: sharp attack, exponential decay (kick) */
  pulse(t, decay = 6.0) {
    const i = this.lastBeat(t);
    if (i < 0) return 0;
    const dt = t - this.beatTimes[i];
    return Math.exp(-dt * decay);
  }

  /** bar pulse: slower, marks the downbeat */
  barPulse(t, decay = 2.2) {
    const i = this.lastDown(t);
    if (i < 0) return 0;
    const dt = t - this.downTimes[i];
    return Math.exp(-dt * decay);
  }

  /** phase within the current beat, 0..1 */
  beatPhaseAt(t) {
    const i = this.lastBeat(t);
    const bt = i < 0 ? this.beatPhase : this.beatTimes[i];
    const per = 60 / this.bpm;
    return Math.min(1, Math.max(0, (t - bt) / per));
  }

  /** fractional bar number at t (for musical scene changes) */
  barAt(t) { return (t - this.beatPhase) / (60 / this.bpm) / 4; }

  /** a snappy combined "energy" used for flashes */
  energyAt(t) {
    return Math.min(1, this.rmsAt(t) * 0.7 + this.bassAt(t) * 0.5 + this.pulse(t, 9) * 0.35);
  }
}
