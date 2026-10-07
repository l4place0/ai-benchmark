/* =============================================================================
   Pure Line Room — anim.js
   Frame-rate independent easing, approach, springs and tweens. Everything in
   the room that moves goes through here, so motion always has a shape: nothing
   in this piece is allowed to snap.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR = global.PLR || {};

  /* ---------------------------------------------------------------- easings */
  function bezier(p1x, p1y, p2x, p2y) {
    function a(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function b(a1, a2) { return 3 * a2 - 6 * a1; }
    function c(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t; }
    function slope(t, a1, a2) { return 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 5; i++) {
        var s = slope(t, p1x, p2x);
        if (Math.abs(s) < 1e-6) break;
        t -= (calc(t, p1x, p2x) - x) / s;
      }
      return calc(t, p1y, p2y);
    };
  }

  var ease = {
    linear: function (t) { return t; },
    inOut: bezier(0.42, 0, 0.58, 1),
    out: bezier(0.22, 0.61, 0.36, 1),
    in: bezier(0.55, 0.06, 0.68, 0.19),
    // a slow start, a long settle — reads as "heavy object", good for doors
    heavy: bezier(0.62, 0.02, 0.24, 1),
    // a small overshoot, a spring pull-back — good for latches and lids
    outBack: bezier(0.34, 1.42, 0.5, 1),
    outSoft: bezier(0.16, 0.84, 0.28, 1),
    inOutSoft: bezier(0.5, 0.05, 0.2, 1),
    outElastic: function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var p = 0.36;
      return Math.pow(2, -9 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },
    outBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
      if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
      t -= 2.625 / d1;
      return n1 * t * t + 0.984375;
    }
  };

  /* --------------------------------------------------------------- utilities */

  /** Frame-rate independent exponential approach. */
  function approach(cur, target, speed, dt) {
    if (speed <= 0) return target;
    var k = 1 - Math.exp(-speed * dt);
    return cur + (target - cur) * k;
  }

  /** Smooth -1..1 oscillation, always continuous in t. */
  function osc(t, period, phase) {
    return Math.sin((t / period) * Math.PI * 2 + (phase || 0));
  }

  /** Damped oscillation that decays to zero over `life` seconds. */
  function damped(t, life, freq, phase) {
    if (t < 0 || t > life) return 0;
    var decay = Math.exp(-4.2 * (t / life));
    return decay * Math.sin((t / life) * Math.PI * 2 * (freq || 2) + (phase || 0));
  }

  /** 0 → 1 → 0 bump, good for one-shot pokes. */
  function bump(t, life) {
    if (t < 0 || t > life) return 0;
    var x = t / life;
    return Math.sin(x * Math.PI);
  }

  function pulse(t, period) {
    // 0..1 ramp that resets every `period` seconds
    var x = (t % period) / period;
    return x;
  }

  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  /** Deterministic noise-ish smooth signal (sum of sines) for organic drift. */
  function drift(t, seed) {
    var s = seed || 0;
    return (Math.sin(t * 0.63 + s * 1.7) * 0.5 +
      Math.sin(t * 1.31 + s * 3.1) * 0.3 +
      Math.sin(t * 2.17 + s * 5.3) * 0.2);
  }

  /* ------------------------------------------------------------------ tweens */
  var tweens = [];

  /**
   * tween(obj, key, to, dur, easing, onUpdate)
   * Returns a handle: { cancel(), rewind(), get done(), get value() }
   */
  function tween(obj, key, to, dur, easingFn, onUpdate) {
    var from = obj[key];
    var h = {
      obj: obj, key: key, from: from, to: to, t: 0, dur: Math.max(0.0001, dur),
      ease: easingFn || ease.out, onUpdate: onUpdate || null, dead: false, delay: 0,
      value: from, done: false, delayLeft: 0
    };
    h.cancel = function () { h.dead = true; };
    h.setDelay = function (d) { h.delayLeft = d; return h; };
    tweens.push(h);
    return h;
  }

  /** Tween an arbitrary numeric value with an external setter. */
  function to(setter, from, to, dur, easingFn) {
    var box = { v: from };
    var h = tween(box, 'v', to, dur, easingFn, function (v) { setter(v); });
    setter(from);
    return h;
  }

  function tick(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var h = tweens[i];
      if (h.dead) { tweens.splice(i, 1); continue; }
      if (h.delayLeft > 0) { h.delayLeft -= dt; continue; }
      h.t += dt;
      var x = clamp01(h.t / h.dur);
      var e = h.ease(x);
      h.value = h.from + (h.to - h.from) * e;
      h.obj[h.key] = h.value;
      if (h.onUpdate) h.onUpdate(h.value, x);
      if (x >= 1) { h.done = true; tweens.splice(i, 1); }
    }
  }

  /** A tiny per-object state machine helper (used by doors, blinds, lids). */
  function Machine(states, initial) {
    this.states = states;
    this.current = initial;
    this.t = 0;
  }
  Machine.prototype.go = function (name) {
    if (this.current === name) return false;
    this.current = name; this.t = 0; return true;
  };
  Machine.prototype.update = function (dt) { this.t += dt; return this.t; };

  P.anim = {
    ease: ease,
    bezier: bezier,
    approach: approach,
    osc: osc,
    damped: damped,
    bump: bump,
    pulse: pulse,
    drift: drift,
    clamp01: clamp01,
    tween: tween,
    to: to,
    tick: tick,
    Machine: Machine,
    _tweens: tweens
  };
})(typeof window !== 'undefined' ? window : globalThis);
