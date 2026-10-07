// anim.js — easing curves and small animation primitives shared by content.
// Everything is frame-rate independent; nothing allocates per frame.

export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => t * (2 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  quartOut: (t) => 1 - Math.pow(1 - t, 4),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => {
    const c = 1.70158, c3 = c + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  backInOut: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.36;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },
  bounceOut: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  },
  smoothstep: (t) => t * t * (3 - 2 * t),
  smootherstep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  /** overshoot a little then settle: nice for latches */
  snap: (t) => 1 - Math.pow(1 - t, 2.2) * Math.cos(t * 5.2),
};

/** Exponential smoothing that is stable for any dt. */
export function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** A critically-damped-ish spring, integrated semi-implicitly. */
export class Spring {
  constructor(value = 0, stiffness = 120, damping = 14) {
    this.value = value;
    this.vel = 0;
    this.target = value;
    this.k = stiffness;
    this.d = damping;
  }
  set(v) { this.value = v; this.vel = 0; this.target = v; return this; }
  to(v) { this.target = v; return this; }
  /** give it a kick (e.g. a wind-chime swing) */
  impulse(v) { this.vel += v; return this; }
  step(dt) {
    const steps = Math.max(1, Math.min(6, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.k * (this.value - this.target) - this.d * this.vel;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
  get settled() { return Math.abs(this.vel) < 1e-3 && Math.abs(this.value - this.target) < 1e-3; }
}

/** Ping-pong a 0..1 phase value. */
export function pingPong(t, period) {
  const x = ((t / period) % 1 + 1) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

/** A tiny tween: start a value, get a 0..1 progress each frame. */
export class Tween {
  constructor(duration = 0.5, easing = ease.cubicOut) {
    this.dur = duration;
    this.easing = easing;
    this.t = 0;
    this.dir = 1;      // 1 forward, -1 backward
    this.value = 0;
    this.from = 0;
    this.to = 1;
  }
  play(to = 1, dur) {
    this.from = this.value;
    this.to = to;
    if (dur !== undefined) this.dur = dur;
    this.t = 0;
    this.dir = to >= this.value ? 1 : -1;
    this.dur = Math.max(1e-4, this.dur * Math.max(0.15, Math.abs(to - this.from)));
    return this;
  }
  step(dt) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      this.value = this.from + (this.to - this.from) * this.easing(this.t);
    }
    return this.value;
  }
  get done() { return this.t >= 1; }
}

export default ease;
