/* =========================================================================
   Pure Line Room — audio.js
   Everything you hear is synthesised at runtime with the Web Audio API: no
   audio files, no network. Beds (room tone, fan, turntable, clock) are loops
   of oscillators and filtered noise; one-shots (switch, drawer, latch, chime,
   page) are short scheduled envelopes.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});

  var A = {
    ctx: null,
    master: null,
    bus: {},
    ready: false,
    enabled: true,
    started: false,
    _noise: null,
    levels: { master: 0.85, room: 0.5, sfx: 0.9, music: 0.7 },
    lastPlay: {},
  };

  function now() { return A.ctx ? A.ctx.currentTime : 0; }

  A.init = function () {
    if (A.ctx) return A.ctx;
    var C = root.AudioContext || root.webkitAudioContext;
    if (!C) { A.enabled = false; return null; }
    var ctx = (A.ctx = new C({ latencyHint: 'interactive' }));

    var master = (A.master = ctx.createGain());
    master.gain.value = A.levels.master * 0.9;

    // a gentle limiter keeps the synthesised layers from clipping
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;
    master.connect(comp);
    comp.connect(ctx.destination);

    A.bus.room = ctx.createGain(); A.bus.room.gain.value = A.levels.room; A.bus.room.connect(master);
    A.bus.sfx = ctx.createGain(); A.bus.sfx.gain.value = A.levels.sfx; A.bus.sfx.connect(master);
    A.bus.music = ctx.createGain(); A.bus.music.gain.value = 0; A.bus.music.connect(master);

    A._buildNoise();
    A._buildRoomTone();
    A._buildFan();
    A._buildTurntable();
    A._buildClock();
    A.ready = true;
    return ctx;
  };

  A.resume = function () {
    if (!A.ctx) A.init();
    if (!A.ctx) return;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    if (!A.started) {
      A.started = true;
      A._startBeds();
    }
  };

  A._buildNoise = function () {
    var ctx = A.ctx;
    var len = Math.floor(ctx.sampleRate * 2.2);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.55 + last * 2.4;
    }
    var pink = ctx.createBuffer(1, len, ctx.sampleRate);
    var pd = pink.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var j = 0; j < len; j++) {
      var wn = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + wn * 0.0990460;
      b1 = 0.96300 * b1 + wn * 0.2965164;
      b2 = 0.57000 * b2 + wn * 1.0526913;
      pd[j] = (b0 + b1 + b2 + wn * 0.1848) * 0.22;
    }
    A._noise = { white: buf, pink: pink };
  };

  A._noiseSource = function (kind, loop) {
    var ctx = A.ctx;
    var s = ctx.createBufferSource();
    s.buffer = A._noise[kind || 'pink'];
    s.loop = loop !== false;
    return s;
  };

  /* ------------------------------ room tone ------------------------------ */
  A._buildRoomTone = function () {
    var ctx = A.ctx;
    var src = A._noiseSource('pink');
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 60;
    var g = ctx.createGain(); g.gain.value = 0.16;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(A.bus.room);
    var pad = ctx.createOscillator();
    pad.type = 'sine'; pad.frequency.value = 58;
    var padG = ctx.createGain(); padG.gain.value = 0.05;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.03;
    lfo.connect(lfoG); lfoG.connect(padG.gain);
    pad.connect(padG); padG.connect(A.bus.room);
    A._room = { src: src, g: g, lp: lp, pad: pad, lfo: lfo };
  };

  /* --------------------------------- fan --------------------------------- */
  A._buildFan = function () {
    var ctx = A.ctx;
    var src = A._noiseSource('white');
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.9;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(A.bus.room);
    // motor hum
    var hum = ctx.createOscillator();
    hum.type = 'sawtooth'; hum.frequency.value = 41;
    var humLp = ctx.createBiquadFilter();
    humLp.type = 'lowpass'; humLp.frequency.value = 260;
    var humG = ctx.createGain(); humG.gain.value = 0;
    hum.connect(humLp); humLp.connect(humG); humG.connect(A.bus.room);
    // slow wobble gives the blades a physical presence
    var wob = ctx.createOscillator(); wob.frequency.value = 0.42;
    var wobG = ctx.createGain(); wobG.gain.value = 0.035;
    wob.connect(wobG); wobG.connect(g.gain);
    A._fan = { src: src, g: g, hum: hum, humG: humG, wob: wob, wobG: wobG, bp: bp };
  };

  /* ------------------------------ turntable ------------------------------ */
  A._buildTurntable = function () {
    var ctx = A.ctx;
    // vinyl surface noise: noise through a resonant highpass, amplitude modulated
    var src = A._noiseSource('white');
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2200;
    var g = ctx.createGain(); g.gain.value = 0.0;
    src.connect(hp); hp.connect(g); g.connect(A.bus.music);
    // crackle: random impulses on a gain we can automate from the update loop
    var crackle = ctx.createGain(); crackle.gain.value = 1;
    crackle.connect(g);
    // warm music bed: slow pentatonic drone with soft attack
    var music = ctx.createGain(); music.gain.value = 0.16;
    music.connect(g);
    A._tt = { src: src, g: g, hp: hp, music: music, crackle: crackle };
  };

  /* -------------------------------- clock -------------------------------- */
  A._buildClock = function () {
    A._clock = { on: true, last: -1 };
  };

  /* ------------------------------- helpers ------------------------------- */
  function env(gain, t, a, d, peak) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function blip(opts) {
    if (!A.ready || !A.enabled) return;
    var ctx = A.ctx, t = now() + (opts.delay || 0);
    var o = ctx.createOscillator();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1 && opts.f1 !== opts.f0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + (opts.sweep || 0.08));
    }
    var g = ctx.createGain();
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.value = opts.cutoff || 6000;
    o.connect(f); f.connect(g); g.connect(opts.bus || A.bus.sfx);
    env(g, t, opts.a === undefined ? 0.004 : opts.a, opts.d === undefined ? 0.09 : opts.d, opts.gain === undefined ? 0.22 : opts.gain);
    o.start(t);
    o.stop(t + (opts.a || 0.004) + (opts.d || 0.09) + 0.06);
  }

  function noiseHit(opts) {
    if (!A.ready || !A.enabled) return;
    var ctx = A.ctx, t = now() + (opts.delay || 0);
    var s = A._noiseSource(opts.kind || 'white', false);
    s.playbackRate.value = opts.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.f0 || 900, t);
    if (opts.f1 && opts.f1 !== opts.f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.f1), t + (opts.sweep || 0.1));
    f.Q.value = opts.q === undefined ? 1.1 : opts.q;
    var g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(opts.bus || A.bus.sfx);
    env(g, t, opts.a === undefined ? 0.002 : opts.a, opts.d === undefined ? 0.1 : opts.d, opts.gain === undefined ? 0.2 : opts.gain);
    s.start(t);
    s.stop(t + (opts.a || 0.002) + (opts.d || 0.1) + 0.08);
  }

  /* ------------------------------ one-shots ------------------------------ */
  A.click = function () {
    noiseHit({ f0: 2600, f1: 1200, d: 0.035, gain: 0.1, q: 0.8, rate: 1.6 });
  };

  A.tick = function (strong) {
    noiseHit({ f0: strong ? 2100 : 3200, f1: strong ? 900 : 1500, d: strong ? 0.05 : 0.032, gain: strong ? 0.11 : 0.07, q: 2.4, rate: 2.1 });
    blip({ type: 'triangle', f0: strong ? 640 : 880, f1: strong ? 380 : 520, d: 0.05, gain: strong ? 0.07 : 0.045, delay: 0.001 });
  };

  A.switchOn = function () {
    noiseHit({ f0: 3400, f1: 900, d: 0.045, gain: 0.16, q: 1.4, rate: 2.4 });
    blip({ type: 'square', f0: 420, f1: 190, d: 0.07, gain: 0.08, cutoff: 2600 });
  };

  A.switchOff = function () {
    noiseHit({ f0: 2400, f1: 700, d: 0.05, gain: 0.14, q: 1.2, rate: 1.7 });
    blip({ type: 'square', f0: 300, f1: 150, d: 0.08, gain: 0.07, cutoff: 2000 });
  };

  A.woodTap = function (pitch) {
    var f = pitch || 220;
    blip({ type: 'triangle', f0: f, f1: f * 0.62, d: 0.13, gain: 0.18, cutoff: 1800 });
    noiseHit({ f0: 1400, f1: 500, d: 0.06, gain: 0.09, q: 1.6, rate: 1.2 });
  };

  A.drawerOpen = function () {
    var t = now();
    var ctx = A.ctx;
    if (!A.ready) return;
    // a slide: band-passed noise sweeping up, then a soft stop
    noiseHit({ f0: 420, f1: 1150, d: 0.26, gain: 0.075, q: 0.9, rate: 0.85, filter: 'bandpass' });
    noiseHit({ f0: 1500, f1: 600, d: 0.05, gain: 0.07, q: 1.8, rate: 2.2, delay: 0.24 });
    blip({ type: 'sine', f0: 150, f1: 92, d: 0.1, gain: 0.1, delay: 0.25 });
  };

  A.drawerClose = function () {
    noiseHit({ f0: 1000, f1: 380, d: 0.22, gain: 0.08, q: 0.8, rate: 0.9 });
    noiseHit({ f0: 900, f1: 260, d: 0.07, gain: 0.13, q: 1.5, rate: 1.8, delay: 0.21 });
    blip({ type: 'sine', f0: 120, f1: 70, d: 0.14, gain: 0.14, delay: 0.22 });
  };

  A.doorSwing = function (open) {
    // hinge creak: a slow resonant sweep
    var dur = 0.55;
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    var s = A._noiseSource('white');
    s.playbackRate.value = 0.55;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 12;
    f.frequency.setValueAtTime(open ? 380 : 620, t);
    f.frequency.linearRampToValueAtTime(open ? 760 : 320, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.12);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.bus.sfx);
    s.start(t); s.stop(t + dur + 0.05);
    // latch
    noiseHit({ f0: 1700, f1: 500, d: 0.06, gain: 0.12, q: 1.9, rate: 2.0, delay: dur * 0.82 });
    blip({ type: 'sine', f0: 110, f1: 64, d: 0.16, gain: 0.12, delay: dur * 0.84 });
  };

  A.blindRustle = function (open) {
    var n = 3;
    for (var i = 0; i < n; i++) {
      noiseHit({
        f0: 2600 + i * 500, f1: 1200 + i * 300,
        d: 0.09, gain: 0.05, q: 0.7, rate: 1.3 + i * 0.15,
        delay: i * (open ? 0.055 : 0.045),
      });
    }
  };

  A.curtainSweep = function (open) {
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    var s = A._noiseSource('white');
    s.playbackRate.value = 0.7;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(open ? 700 : 2400, t);
    f.frequency.linearRampToValueAtTime(open ? 2400 : 700, t + 0.5);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    s.connect(f); f.connect(g); g.connect(A.bus.sfx);
    s.start(t); s.stop(t + 0.6);
  };

  A.chime = function (scale) {
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    var base = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5];
    var pick = scale === undefined ? Math.floor(Math.random() * base.length) : scale;
    var f0 = base[pick % base.length];
    var out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(A.bus.sfx);
    for (var i = 0; i < 4; i++) {
      var mult = 1 + i * 0.618;
      var o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f0 * mult * (1 + (Math.random() - 0.5) * 0.004);
      var g = ctx.createGain();
      var peak = 0.16 / (1 + i * 1.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9 - i * 0.3);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 2.2);
    }
    // metallic strike
    noiseHit({ f0: f0 * 5, f1: f0 * 2.2, d: 0.09, gain: 0.09, q: 1.1, rate: 2.6, a: 0.001 });
  };

  A.page = function (i) {
    noiseHit({
      f0: 3200 + (i % 3) * 900, f1: 900,
      d: 0.16, gain: 0.075, q: 0.6, rate: 1.0 + (i % 4) * 0.12,
    });
  };

  A.lampSwitch = function (on) {
    noiseHit({ f0: on ? 2900 : 2100, f1: on ? 1400 : 700, d: 0.03, gain: 0.11, q: 2.2, rate: 2.0 });
    blip({ type: 'sine', f0: on ? 520 : 330, d: 0.05, gain: 0.06, delay: 0.004 });
  };

  A.recordStart = function () {
    blip({ type: 'sine', f0: 90, f1: 210, d: 0.35, gain: 0.08, cutoff: 900 });
    noiseHit({ f0: 300, f1: 1800, d: 0.4, gain: 0.05, q: 0.7, rate: 0.8 });
  };

  A.recordStop = function () {
    blip({ type: 'sine', f0: 220, f1: 70, d: 0.4, gain: 0.08, cutoff: 800 });
    noiseHit({ f0: 1600, f1: 200, d: 0.3, gain: 0.05, q: 0.7, rate: 0.7 });
  };

  A.cupClink = function () {
    blip({ type: 'triangle', f0: 1750, f1: 1200, d: 0.18, gain: 0.09, cutoff: 5200 });
    blip({ type: 'triangle', f0: 2600, f1: 2100, d: 0.12, gain: 0.05, cutoff: 6000, delay: 0.004 });
  };

  A.pour = function () {
    noiseHit({ f0: 900, f1: 500, d: 0.9, gain: 0.05, q: 0.5, rate: 0.9 });
  };

  /* --------------------------- continuous levels -------------------------- */
  A.setChannels = function (state) {
    if (!A.ready) return;
    var t = now();
    var night = state.phase;
    A.bus.room.gain.setTargetAtTime(A.levels.room * (0.55 + night * 0.6), t, 0.4);
    if (A._room) {
      A._room.lp.frequency.setTargetAtTime(320 + night * 260, t, 0.6);
      A._room.g.gain.setTargetAtTime(0.12 + night * 0.1, t, 0.6);
    }
    var fan = state.ch.fan;
    if (A._fan) {
      A._fan.g.gain.setTargetAtTime(0.16 * fan, t, 0.25);
      A._fan.humG.gain.setTargetAtTime(0.05 * fan, t, 0.25);
    }
    var rec = state.ch.record;
    if (A._tt) {
      A._tt.g.gain.setTargetAtTime(0.9 * rec, t, 0.35);
    }
    A.bus.music.gain.setTargetAtTime(A.levels.music * rec, t, 0.5);
  };

  /* music bed: a slow, warm loop of notes scheduled while the record spins */
  A.updateMusic = function (state, dt) {
    if (!A.ready || state.ch.record < 0.05) { A._nextNote = 0; return; }
    var t = now();
    if (!A._nextNote || t >= A._nextNote) {
      var scale = [220, 246.94, 293.66, 329.63, 392.0, 440, 493.88, 587.33];
      var n = scale[Math.floor(Math.random() * scale.length)];
      A._note(n, t + 0.02, 1.6 + Math.random() * 1.4);
      if (Math.random() < 0.5) A._note(n * 2, t + 0.02 + 0.02, 1.1);
      if (Math.random() < 0.35) A._note(n / 2, t + 0.02, 2.2);
      A._nextNote = t + 0.55 + Math.random() * 0.9;
    }
    // vinyl crackle impulses
    if (Math.random() < dt * (6 + 8 * state.ch.record)) {
      noiseHit({ f0: 4000 + Math.random() * 3000, f1: 1500, d: 0.012, gain: 0.035, q: 0.9, rate: 3, bus: A.bus.music });
    }
  };

  A._note = function (f, t, dur) {
    var ctx = A.ctx;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 1.005;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(A.bus.music);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  };

  /* The clock is part of the room's pulse, so its tick is sparse — one tick
     every five seconds, with a heavier one on the minute. */
  A.updateClock = function (state, dt) {
    if (!A.ready) return;
    var s = Math.floor(state.seconds);
    if (A._clock.last !== s) {
      var first = A._clock.last === -1;
      A._clock.last = s;
      if (!first && A.enabled) {
        if (s % 60 === 0) A.tick(true);
        else if (s % 5 === 0) A.tick(false);
      }
    }
  };

  A._startBeds = function () {
    if (!A.ready) return;
    var r = A._room;
    if (r) { r.src.start(); r.pad.start(); r.lfo.start(); }
    var f = A._fan;
    if (f) { f.src.start(); f.hum.start(); f.wob.start(); }
    var tt = A._tt;
    if (tt) tt.src.start();
  };

  A.setEnabled = function (on) {
    A.enabled = !!on;
    if (!A.ready) return;
    var t = now();
    A.bus.sfx.gain.setTargetAtTime(on ? A.levels.sfx : 0, t, 0.05);
    A.bus.room.gain.setTargetAtTime(on ? A.levels.room : 0, t, 0.05);
    A.bus.music.gain.setTargetAtTime(on ? A.levels.music : 0, t, 0.05);
  };

  A.credits = function () { return 'procedural web audio'; };

  PLR.audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
