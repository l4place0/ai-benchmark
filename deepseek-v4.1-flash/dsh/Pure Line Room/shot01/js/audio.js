/* =============================================================================
   Pure Line Room — audio.js
   The whole sound engine of the room. Every noise in the piece is synthesised
   here at runtime: there are no audio files and nothing is fetched.

   A small vocabulary of primitives — a filtered noise burst, an oscillator with
   an ADSR gain, a swelling air layer, a decaying "body" tone, a click
   transient — is composed into the named sounds, so each sound differs in
   ENVELOPE SHAPE, SPECTRAL CENTRE and LENGTH rather than in loudness alone.

   Signal path:  voice gain -> master (0.55) -> soft saturator -> compressor ->
                 destination.  Continuous beds hang off the master too; they are
                 built once in init() and only ever retuned, so setBed() never
                 grows the graph. One-shots get short-lived nodes that are
                 stopped and disconnected as soon as they are over.
   ========================================================================== */
(function (global) {
  'use strict';

  var P = global.PLR = global.PLR || {};

  var MAX_VOICES = 28;     // simultaneous short-lived sounds; extra ones are dropped
  var EPS = 0.0001;        // floor for exponential ramps (a target of 0 throws in the real API)
  var MASTER = 0.55;       // default master trim in front of the compressor
  var NOISE_SECONDS = 1.5; // length of the cached noise buffers

  /* ---------------------------------------------------------------- numbers */
  function fin(v, d) { v = +v; return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function noop() { }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tag(node, label) { try { node.__plr = label; } catch (e) { } return node; }

  /* ------------------------------------------------------------- envelopes */
  /* Safe for the real API: linear ramps may land on 0, exponential ramps never
     do, and every peak is bounded below 1. */

  /** 0 -> peak (linear attack) -> exponential decay -> 0. Returns the end time. */
  function perc(p, t0, peak, atk, dec, hold) {
    var a = Math.max(0.0004, fin(atk, 0.002));
    var h = Math.max(0, fin(hold, 0));
    var d = Math.max(0.005, fin(dec, 0.06));
    var pk = clamp(fin(peak, 0.1), 0, 0.95);
    p.setValueAtTime(EPS, t0);
    p.linearRampToValueAtTime(pk, t0 + a);
    if (h > 0) p.setValueAtTime(pk, t0 + a + h);
    p.exponentialRampToValueAtTime(Math.max(EPS, pk * 0.0006), t0 + a + h + d);
    p.setValueAtTime(0, t0 + a + h + d + 0.002);
    return t0 + a + h + d + 0.004;
  }

  /** fade in -> hold -> fade out (linear throughout, so it may end on exactly 0). */
  function swell(p, t0, peak, atk, sus, rel) {
    var a = Math.max(0.004, fin(atk, 0.2));
    var s = Math.max(0.005, fin(sus, 0.15));
    var r = Math.max(0.008, fin(rel, 0.25));
    var pk = clamp(fin(peak, 0.1), 0, 0.95);
    p.setValueAtTime(EPS, t0);
    p.linearRampToValueAtTime(pk, t0 + a);
    p.setValueAtTime(pk, t0 + a + s);
    p.linearRampToValueAtTime(0, t0 + a + s + r);
    return t0 + a + s + r + 0.006;
  }

  /** Exponential sweep: pts = [[dt, value], ...] relative to t0 (first is a jump). */
  function glides(p, t0, pts) {
    var i, t, v, last = 0;
    if (!pts || !pts.length) return;
    for (i = 0; i < pts.length; i++) {
      t = t0 + Math.max(0, fin(pts[i][0], 0));
      if (t < last) t = last;
      last = t;
      v = fin(pts[i][1], 0);
      if (i === 0) p.setValueAtTime(Math.max(EPS, v), t);
      else if (v > 0) p.exponentialRampToValueAtTime(v, t);
      else p.linearRampToValueAtTime(0, t);
    }
  }

  /** Smooth parameter move (beds, master): never a hard cut. */
  function rampTo(ctx, p, target, tau) {
    var now = fin(ctx.currentTime, 0);
    p.cancelScheduledValues(now);
    p.setTargetAtTime(fin(target, 0), now, Math.max(0.01, fin(tau, 0.2)));
  }

  /* =============================================================== the engine */
  function Audio() {
    this.available = false;
    this.ctx = null;
    this.master = null;
    this.shaper = null;
    this.comp = null;

    this.muted = false;
    this.volume = 1;
    this.masterLevel = MASTER;

    this._failed = false;
    this._voices = [];
    this._beds = {};
    this._want = {};                 // bed levels asked for before init()
    this._buffers = {};

    this._env = { day: true, hour: 12, lightsOn: true, lampOn: false };
    this._lastSec = -1;
    this._lastNow = null;
    this._tickUntil = -1;
    this._cricketT = 2.2 + Math.random() * 2;
    this._popAcc = 0;
    this._r = mulberry32(0x5eed1a7);
  }

  /* ------------------------------------------------------------------- init */

  Audio.prototype.init = function () {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'closed') { this.available = false; return false; }
        if (this.ctx.state === 'suspended' && this.ctx.resume) {
          var pr = this.ctx.resume();
          if (pr && pr.catch) pr.catch(noop);
        }
        this.available = true;
        return true;
      }
      if (this._failed) return false;

      var AC = (typeof global.AudioContext !== 'undefined' && global.AudioContext) ||
        (typeof global.webkitAudioContext !== 'undefined' && global.webkitAudioContext);
      if (!AC) { this._failed = true; this.available = false; return false; }

      var ctx = new AC({ latencyHint: 'interactive' });
      if (!ctx) { this._failed = true; this.available = false; return false; }
      this.ctx = ctx;

      var master = tag(ctx.createGain(), 'master');
      master.gain.value = this.masterLevel;
      var shaper = ctx.createWaveShaper();
      var curve = new Float32Array(1024);
      for (var i = 0; i < curve.length; i++) {
        var x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.35) / Math.tanh(1.35);
      }
      shaper.curve = curve;
      try { shaper.oversample = '2x'; } catch (e) { }
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 3;
      comp.attack.value = 0.006;
      comp.release.value = 0.24;
      master.connect(shaper);
      shaper.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;
      this.shaper = shaper;
      this.comp = comp;

      this._buildBeds();
      this.available = true;

      // some browsers hand back a suspended context even inside a gesture
      if (ctx.state === 'suspended' && ctx.resume) {
        var pr2 = ctx.resume();
        if (pr2 && pr2.catch) pr2.catch(noop);
      }

      // apply anything that was asked for before the context existed
      for (var k in this._want) {
        if (Object.prototype.hasOwnProperty.call(this._want, k)) {
          this.setBed(k, this._want[k].level, this._want[k].opts);
        }
      }
      this._want = {};
      this._defaultBeds();
      this._rampMaster(0.05);
      return true;
    } catch (e) {
      this.ctx = null;
      this.master = null;
      this.shaper = null;
      this.comp = null;
      this.available = false;
      this._failed = true;
      return false;
    }
  };

  Audio.prototype._hz = function (f) {
    var sr = this.ctx && this.ctx.sampleRate ? this.ctx.sampleRate : 44100;
    return clamp(fin(f, 220), 12, sr * 0.45);
  };

  /* ------------------------------------------------------- node constructors */
  /* Every one of these files its node in the voice so it can be torn down. */

  Audio.prototype._gain = function (v, level) {
    var g = this.ctx.createGain();
    g.gain.value = clamp(fin(level, 1), 0, 4);
    v.nodes.push(g);
    return g;
  };

  Audio.prototype._osc = function (v, type, freq, detune) {
    var o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = this._hz(freq);
    if (fin(detune, 0)) o.detune.value = clamp(fin(detune, 0), -2400, 2400);
    v.nodes.push(o);
    return o;
  };

  Audio.prototype._noise = function (v, kind, rate) {
    var s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuffer(kind);
    s.loop = true;
    s.playbackRate.value = clamp(fin(rate, 1), 0.25, 4);
    v.nodes.push(s);
    return s;
  };

  Audio.prototype._filter = function (v, type, freq, q) {
    var f = this.ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = this._hz(freq);
    if (q !== undefined) f.Q.value = clamp(fin(q, 1), 0.0001, 40);
    v.nodes.push(f);
    return f;
  };

  Audio.prototype._pan = function (v, pos) {
    if (!this.ctx.createStereoPanner) return null;
    var p = this.ctx.createStereoPanner();
    p.pan.value = clamp(fin(pos, 0), -1, 1);
    v.nodes.push(p);
    return p;
  };

  /** Destination for a voice layer: v.out, possibly through a stereo panner. */
  Audio.prototype._dest = function (v, o, t0) {
    if (o.pan === undefined && o.panTo === undefined) return v.out;
    var p = this._pan(v, fin(o.pan, 0));
    if (!p) return v.out;
    p.connect(v.out);
    var p0 = clamp(fin(o.pan, 0), -1, 1);
    if (o.panTo !== undefined) {
      var p1 = clamp(fin(o.panTo, p0), -1, 1);
      var d = Math.max(0.01, fin(o.panTime, fin(o.glide, 0.3)));
      p.pan.setValueAtTime(p0, t0);
      p.pan.linearRampToValueAtTime(p1, t0 + d);
    } else {
      p.pan.setValueAtTime(p0, t0);
    }
    return p;
  };

  Audio.prototype._noiseBuffer = function (kind) {
    var key = kind === 'pink' ? 'pink' : 'white';
    var cached = this._buffers[key];
    if (cached) return cached;
    var ctx = this.ctx;
    var sr = ctx.sampleRate || 44100;
    var len = Math.max(2048, Math.floor(sr * NOISE_SECONDS));
    var buf = ctx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    var rnd = mulberry32(key === 'pink' ? 0x9e3779b9 : 0x01234567);
    var b0 = 0, b1 = 0, b2 = 0, i, w, s;
    for (i = 0; i < len; i++) {
      w = rnd() * 2 - 1;
      if (key === 'pink') {
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        s = (b0 + b1 + b2 + w * 0.1848) * 0.32;
      } else {
        s = w * 0.7;
      }
      data[i] = isFinite(s) ? clamp(s, -1, 1) : 0;
    }
    this._buffers[key] = buf;
    return buf;
  };

  /* ------------------------------------------------------------ voice pool */

  /** Start a voice (or return null when too many are already ringing). */
  Audio.prototype._open = function (name, level) {
    if (!this.ctx) return null;
    if (this._voices.length >= MAX_VOICES) return null;
    var out = this.ctx.createGain();
    out.gain.value = clamp(fin(level, 0.5), 0, 2);
    out.__plr = 'sfx:' + name;
    out.connect(this.master);
    var v = { name: name, end: fin(this.ctx.currentTime, 0) + 0.4, nodes: [out], out: out };
    this._voices.push(v);
    return v;
  };

  /** Seal a voice: everything is torn down once ctx.currentTime passes `end`. */
  Audio.prototype._close = function (v, end) {
    v.end = Math.max(fin(end, 0), fin(this.ctx.currentTime, 0) + 0.05) + 0.08;
    return true;
  };

  Audio.prototype._prune = function () {
    if (!this.ctx) return;
    var now = fin(this.ctx.currentTime, 0), i, j, v;
    for (i = this._voices.length - 1; i >= 0; i--) {
      v = this._voices[i];
      if (v.end <= now) {
        for (j = 0; j < v.nodes.length; j++) {
          try { v.nodes[j].disconnect(); } catch (e) { }
        }
        this._voices.splice(i, 1);
      }
    }
  };

  /* --------------------------------------------------------- synth primitives */

  /**
   * _burst — filtered noise with a percussive (or swelling) envelope.
   * o: {t0, kind, rate, filter, freq, freqTo, glide, q, peak, atk, dec, hold,
   *     swell, pan, panTo, panTime}
   */
  Audio.prototype._burst = function (v, o) {
    var t0 = fin(o.t0, this.ctx.currentTime);
    var peak = clamp(fin(o.peak, 0.2), 0, 0.95);
    var atk = Math.max(0.0004, fin(o.atk, 0.001));
    var dec = Math.max(0.005, fin(o.dec, 0.05));
    var f0 = this._hz(fin(o.freq, 1200));
    var dest = this._dest(v, o, t0);
    var fl = this._filter(v, o.filter || 'bandpass', f0, fin(o.q, 1));
    var g = this._gain(v, 0);
    var src = this._noise(v, o.kind, o.rate);
    src.connect(fl);
    fl.connect(g);
    g.connect(dest);
    if (o.freqTo) {
      glides(fl.frequency, t0, [[0, f0], [Math.max(0.01, fin(o.glide, 0.08)), this._hz(o.freqTo)]]);
    } else {
      fl.frequency.setValueAtTime(f0, t0);
    }
    var end = o.swell
      ? swell(g.gain, t0, peak, atk, fin(o.hold, 0.1), dec)
      : perc(g.gain, t0, peak, atk, dec, o.hold);
    src.start(t0);
    src.stop(end + 0.02);
    return end;
  };

  /**
   * _tone — oscillator (optionally a detuned pair) through an optional filter,
   * with a percussive or swelling envelope and an optional pitch/filter glide.
   * o: {t0, type, freq, freqTo, glide, pairs, detune, peak, atk, dec, hold,
   *     swell, filter, filterFreq, filterTo, fglide, q, pan, panTo, panTime}
   */
  Audio.prototype._tone = function (v, o) {
    var t0 = fin(o.t0, this.ctx.currentTime);
    var peak = clamp(fin(o.peak, 0.12), 0, 0.95);
    var f0 = this._hz(fin(o.freq, 220));
    var dest = this._dest(v, o, t0);
    var g = this._gain(v, 0);
    g.connect(dest);

    var sink = g;
    if (o.filter) {
      var ff = this._hz(fin(o.filterFreq, f0 * 2.2));
      var fl = this._filter(v, o.filter, ff, fin(o.q, 1));
      fl.connect(g);
      sink = fl;
      if (o.filterTo) {
        glides(fl.frequency, t0, [[0, ff], [Math.max(0.01, fin(o.fglide, fin(o.glide, 0.2))), this._hz(o.filterTo)]]);
      } else {
        fl.frequency.setValueAtTime(ff, t0);
      }
    }

    var n = o.pairs ? 2 : 1, i, osc, dt, oscs = [];
    for (i = 0; i < n; i++) {
      dt = i === 0 ? fin(o.detune, 0) : -(fin(o.detune, 8) + 3);
      osc = this._osc(v, o.type || 'sine', f0, dt);
      osc.connect(sink);
      if (o.freqTo) {
        glides(osc.frequency, t0, [[0, f0], [Math.max(0.01, fin(o.glide, 0.2)), this._hz(o.freqTo)]]);
      }
      osc.start(t0);
      oscs.push(osc);
    }

    var end = o.swell
      ? swell(g.gain, t0, peak, fin(o.atk, 0.15), fin(o.hold, 0.15), fin(o.dec, 0.3))
      : perc(g.gain, t0, peak, fin(o.atk, 0.002), fin(o.dec, 0.1), o.hold);
    for (i = 0; i < oscs.length; i++) oscs[i].stop(end + 0.03);
    return end;
  };

  /* ================================================================== sounds */

  Audio.prototype._sClick = function (t0) {
    var v = this._open('click', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.5, filter: 'highpass', freq: 2100, q: 0.7,
      peak: 0.34, atk: 0.0008, dec: 0.015
    });
    var b = this._tone(v, {
      t0: t0, type: 'triangle', freq: 1750, freqTo: 900, glide: 0.02,
      peak: 0.09, atk: 0.0008, dec: 0.022
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sSwitch = function (t0, on) {
    var v = this._open('switch', 0.55); if (!v) return false;
    var body = on ? 196 : 162;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.2, filter: 'highpass', freq: 1050, q: 0.8,
      peak: 0.3, atk: 0.001, dec: 0.032
    });
    var b = this._tone(v, {
      t0: t0 + 0.011, type: 'triangle', freq: body, freqTo: body * 0.7, glide: 0.1,
      filter: 'lowpass', filterFreq: on ? 620 : 520, q: 0.9,
      peak: 0.3, atk: 0.002, dec: 0.12
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sLatch = function (t0) {
    var v = this._open('latch', 0.4); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.6, filter: 'bandpass', freq: 4300, q: 9,
      peak: 0.22, atk: 0.0006, dec: 0.03
    });
    var b = this._tone(v, {
      t0: t0, type: 'sine', freq: 2450, pairs: true, detune: 26,
      peak: 0.1, atk: 0.001, dec: 0.07
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sDoor = function (t0, open) {
    var v = this._open('door', 0.5); if (!v) return false;
    var dur = 0.66 + this._r() * 0.26;                 // 0.66 .. 0.92 s of creak
    var fA = open ? 250 : 880;
    var fB = open ? 900 : 235;
    var src = this._noise(v, 'white', 1.0);
    var bp1 = this._filter(v, 'bandpass', fA, 13);
    var bp2 = this._filter(v, 'bandpass', fA * 2.2, 8);
    var g = this._gain(v, 0);
    g.connect(v.out);
    src.connect(bp1); bp1.connect(g);
    src.connect(bp2); bp2.connect(g);

    // stick-slip: uneven steps instead of one smooth sweep
    var steps = 5 + Math.floor(this._r() * 3), i, x, t, f, last = t0;
    for (i = 0; i < steps; i++) {
      x = i / (steps - 1);
      t = Math.max(last, t0 + dur * x + (this._r() - 0.5) * 0.05);
      last = t;
      f = fA + (fB - fA) * x;
      bp1.frequency.setValueAtTime(this._hz(f), t);
      bp2.frequency.setValueAtTime(this._hz(f * 2.2), t);
    }
    var e = swell(g.gain, t0, 0.2, 0.09, dur * 0.72, 0.2);
    src.start(t0);
    src.stop(e + 0.03);

    var thud = this._burst(v, {
      t0: t0 + dur, kind: 'white', filter: 'lowpass', freq: 210, q: 0.8,
      peak: 0.26, atk: 0.002, dec: 0.11
    });
    var body = this._tone(v, {
      t0: t0 + dur, type: 'triangle', freq: 92, freqTo: 64, glide: 0.12,
      peak: 0.18, atk: 0.002, dec: 0.14
    });
    return this._close(v, Math.max(e, thud, body));
  };

  Audio.prototype._sDrawer = function (t0) {
    var v = this._open('drawer', 0.5); if (!v) return false;
    var dur = 0.3 + this._r() * 0.13;                  // 0.30 .. 0.43 s of slide
    var a = this._burst(v, {
      t0: t0, kind: 'pink', rate: 0.85, filter: 'lowpass', freq: 700, freqTo: 360,
      glide: dur, q: 1.1, peak: 0.24, atk: 0.07, dec: 0.1, hold: dur * 0.75, swell: true
    });
    var b = this._tone(v, {
      t0: t0 + 0.02, type: 'triangle', freq: 96, freqTo: 78, glide: dur,
      filter: 'lowpass', filterFreq: 260, q: 1.4,
      peak: 0.1, atk: 0.06, dec: 0.12, hold: dur * 0.7, swell: true
    });
    var stop = t0 + dur;
    var c = this._burst(v, {
      t0: stop, kind: 'white', filter: 'lowpass', freq: 240, q: 0.8,
      peak: 0.24, atk: 0.002, dec: 0.09
    });
    var d = this._tone(v, {
      t0: stop, type: 'triangle', freq: 132, freqTo: 96, glide: 0.1,
      peak: 0.16, atk: 0.002, dec: 0.11
    });
    return this._close(v, Math.max(a, b, c, d));
  };

  Audio.prototype._sCabinet = function (t0) {
    var v = this._open('cabinet', 0.45); if (!v) return false;
    var dur = 0.14 + this._r() * 0.07;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.1, filter: 'bandpass', freq: 900, freqTo: 620,
      glide: dur, q: 1.2, peak: 0.16, atk: 0.02, dec: 0.09, hold: dur, swell: true
    });
    var b = this._tone(v, {
      t0: t0 + 0.01, type: 'triangle', freq: 250, freqTo: 200, glide: 0.1,
      peak: 0.12, atk: 0.004, dec: 0.09
    });
    var c = this._burst(v, {
      t0: t0 + dur, kind: 'white', filter: 'lowpass', freq: 380, q: 0.8,
      peak: 0.14, atk: 0.002, dec: 0.07
    });
    return this._close(v, Math.max(a, b, c));
  };

  Audio.prototype._sBlinds = function (t0) {
    var v = this._open('blinds', 0.45); if (!v) return false;
    var n = 5, i, t, end = t0;
    for (i = 0; i < n; i++) {
      t = t0 + i * (0.052 + this._r() * 0.028) + this._r() * 0.012;
      end = this._burst(v, {
        t0: t, kind: 'white', rate: 1.3, filter: 'highpass', freq: 1500 + this._r() * 1500, q: 0.7,
        peak: 0.1 + this._r() * 0.08, atk: 0.0006, dec: 0.016 + this._r() * 0.03,
        pan: (this._r() - 0.5) * 0.5
      });
    }
    return this._close(v, end);
  };

  Audio.prototype._sCurtain = function (t0) {
    var v = this._open('curtain', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'pink', rate: 1.2, filter: 'bandpass', freq: 560, freqTo: 1150,
      glide: 0.24, q: 0.75, peak: 0.17, atk: 0.13, dec: 0.26, hold: 0.14, swell: true,
      pan: 0.28, panTo: -0.22, panTime: 0.42
    });
    var b = this._burst(v, {
      t0: t0 + 0.06, kind: 'white', filter: 'lowpass', freq: 3800, q: 0.7,
      peak: 0.06, atk: 0.1, dec: 0.2, hold: 0.12, swell: true
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sLamp = function (t0, on) {
    var v = this._open('lamp', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.5, filter: 'highpass', freq: 2400, q: 0.7,
      peak: 0.2, atk: 0.0006, dec: 0.013
    });
    var hum = on ? 102 : 82;
    var b = this._tone(v, {
      t0: t0 + 0.006, type: 'sine', freq: hum, pairs: true, detune: 8,
      filter: 'lowpass', filterFreq: on ? 700 : 420, q: 0.9,
      peak: on ? 0.11 : 0.07, atk: 0.006, dec: on ? 0.17 : 0.09, hold: on ? 0.05 : 0
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sSteam = function (t0, on) {
    var v = this._open('steam', 0.45); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: on ? 1.0 : 0.7, filter: 'highpass', freq: 3200, q: 0.7,
      peak: 0.1, atk: on ? 0.22 : 0.02, dec: on ? 0.2 : 0.3, hold: on ? 0.14 : 0.04, swell: true
    });
    var b = this._tone(v, {
      t0: t0 + 0.05, type: 'sine', freq: on ? 2100 : 1500, freqTo: on ? 2600 : 900, glide: 0.3,
      peak: 0.02, atk: on ? 0.18 : 0.02, dec: on ? 0.14 : 0.24, hold: 0.05, swell: true
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sPage = function (t0) {
    var v = this._open('page', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.25, filter: 'bandpass', freq: 3200, freqTo: 1300,
      glide: 0.12, q: 1.1, peak: 0.2, atk: 0.004, dec: 0.11, pan: -0.2, panTo: 0.25
    });
    var b = this._burst(v, {
      t0: t0 + 0.1, kind: 'white', rate: 1.4, filter: 'highpass', freq: 1800, q: 0.7,
      peak: 0.075, atk: 0.002, dec: 0.055, pan: 0.2
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sRecord = function (t0) {
    var v = this._open('record', 0.5); if (!v) return false;
    // motor spin-up: a saw through a lowpass that opens with the speed
    var a = this._tone(v, {
      t0: t0, type: 'sawtooth', freq: 26, freqTo: 82, glide: 0.9,
      filter: 'lowpass', filterFreq: 300, filterTo: 820, fglide: 0.9, q: 2.6,
      peak: 0.17, atk: 0.22, dec: 0.24, hold: 0.6, swell: true
    });
    var b = this._tone(v, {
      t0: t0, type: 'triangle', freq: 41, freqTo: 62, glide: 0.9, pairs: true, detune: 14,
      peak: 0.07, atk: 0.3, dec: 0.22, hold: 0.5, swell: true
    });
    // needle drop
    var c = this._burst(v, {
      t0: t0 + 0.22, kind: 'white', filter: 'lowpass', freq: 260, q: 0.8,
      peak: 0.3, atk: 0.001, dec: 0.11
    });
    var d = this._tone(v, {
      t0: t0 + 0.22, type: 'triangle', freq: 96, freqTo: 58, glide: 0.14,
      peak: 0.2, atk: 0.001, dec: 0.15
    });
    // surface noise arrives with the platter
    var f = this._burst(v, {
      t0: t0 + 0.3, kind: 'white', rate: 1.3, filter: 'highpass', freq: 3400, q: 0.7,
      peak: 0.035, atk: 0.35, dec: 0.3, hold: 0.1, swell: true
    });
    // ... and the crackle bed begins to spin
    this._nudgeBed('record', 0.6);
    return this._close(v, Math.max(a, b, c, d, f));
  };

  Audio.prototype._sRecordStop = function (t0) {
    var v = this._open('recordStop', 0.5); if (!v) return false;
    var a = this._tone(v, {
      t0: t0, type: 'sawtooth', freq: 78, freqTo: 22, glide: 0.72,
      filter: 'lowpass', filterFreq: 760, filterTo: 240, fglide: 0.72, q: 2.4,
      peak: 0.15, atk: 0.01, dec: 0.5, hold: 0.1, swell: true
    });
    var b = this._tone(v, {
      t0: t0, type: 'triangle', freq: 58, freqTo: 30, glide: 0.7,
      peak: 0.06, atk: 0.02, dec: 0.4, hold: 0.08, swell: true
    });
    var c = this._burst(v, {
      t0: t0 + 0.72, kind: 'white', rate: 1.5, filter: 'highpass', freq: 1700, q: 0.8,
      peak: 0.14, atk: 0.0008, dec: 0.03
    });
    this._nudgeBed('record', 0);
    return this._close(v, Math.max(a, b, c));
  };

  Audio.prototype._sFan = function (t0, level) {
    var v = this._open('fan', 0.6); if (!v) return false;
    var lv = clamp(Math.round(fin(level, 1)), 1, 3);
    var base = [44, 58, 74][lv - 1];
    var loud = 0.55 + 0.2 * lv;
    var a = this._tone(v, {
      t0: t0, type: 'sawtooth', freq: base * 0.6, freqTo: base, glide: 0.55,
      filter: 'lowpass', filterFreq: 200, filterTo: base * 9, fglide: 0.6, q: 3.4,
      peak: 0.12 * loud, atk: 0.06, dec: 0.3, hold: 0.22, swell: true
    });
    var b = this._tone(v, {
      t0: t0 + 0.02, type: 'triangle', freq: base * 1.98, pairs: true, detune: 12,
      peak: 0.028 * loud, atk: 0.1, dec: 0.26, hold: 0.18, swell: true
    });
    var c = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.0, filter: 'bandpass', freq: 420, freqTo: 1450,
      glide: 0.45, q: 0.6, peak: 0.1 * loud, atk: 0.05, dec: 0.42, hold: 0.06, swell: true,
      pan: -0.22, panTo: 0.26, panTime: 0.5
    });
    return this._close(v, Math.max(a, b, c));
  };

  Audio.prototype._sFanStop = function (t0, level) {
    var v = this._open('fanStop', 0.55); if (!v) return false;
    var lv = clamp(Math.round(fin(level, 2)), 1, 3);
    var base = [40, 54, 68][lv - 1];
    var a = this._tone(v, {
      t0: t0, type: 'sawtooth', freq: base, freqTo: 15, glide: 0.8,
      filter: 'lowpass', filterFreq: base * 8, filterTo: 150, fglide: 0.85, q: 3,
      peak: 0.095 * (0.6 + 0.18 * lv), atk: 0.01, dec: 0.5, hold: 0.12, swell: true
    });
    var b = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.4, filter: 'highpass', freq: 1500, q: 0.8,
      peak: 0.08, atk: 0.001, dec: 0.04
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sChime = function (t0, o) {
    var v = this._open('chime', 0.55); if (!v) return false;
    var soft = !!o.soft, hour = !!o.hour;
    var base = soft ? 440 : 523.25;
    var ratios = [1, 2.76, 5.4, 8.93, 13.34];
    var peaks = [0.17, 0.1, 0.062, 0.04, 0.026];
    var i, end = t0, e;
    for (i = 0; i < ratios.length; i++) {
      e = this._tone(v, {
        t0: t0 + i * 0.028 + this._r() * 0.055,
        type: i % 2 ? 'triangle' : 'sine',
        freq: base * ratios[i],
        pairs: true, detune: 4 + this._r() * 7,
        peak: (soft ? 0.55 : 1) * peaks[i],
        atk: 0.002,
        dec: (soft ? 0.85 : 1.5) + 0.95 * Math.pow(0.72, i),
        pan: i % 2 ? 0.16 : -0.14
      });
      if (e > end) end = e;
    }
    if (hour) {
      e = this._tone(v, {
        t0: t0 + 0.05, type: 'sine', freq: base / 4, pairs: true, detune: 5,
        filter: 'lowpass', filterFreq: 900, q: 0.8,
        peak: 0.22, atk: 0.006, dec: 2.4
      });
      if (e > end) end = e;
    }
    return this._close(v, end);
  };

  Audio.prototype._sTick = function (t0) {
    if (fin(this.ctx.currentTime, 0) < this._tickUntil) return false;  // one at a time
    var v = this._open('tick', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'white', rate: 1.6, filter: 'bandpass', freq: 3600, q: 6.5,
      peak: 0.03, atk: 0.0004, dec: 0.009
    });
    var b = this._tone(v, {
      t0: t0, type: 'triangle', freq: 3200, freqTo: 2500, glide: 0.015,
      peak: 0.02, atk: 0.0006, dec: 0.013
    });
    var end = Math.max(a, b);
    this._tickUntil = end + 0.02;
    return this._close(v, end);
  };

  Audio.prototype._sGlobe = function (t0) {
    var v = this._open('globe', 0.5); if (!v) return false;
    var a = this._burst(v, {
      t0: t0, kind: 'pink', rate: 1.1, filter: 'bandpass', freq: 950, freqTo: 470,
      glide: 0.3, q: 2.4, peak: 0.14, atk: 0.05, dec: 0.22, hold: 0.1, swell: true,
      pan: -0.18, panTo: 0.2, panTime: 0.35
    });
    var b = this._tone(v, {
      t0: t0, type: 'sine', freq: 190, freqTo: 128, glide: 0.3,
      peak: 0.06, atk: 0.04, dec: 0.16, hold: 0.08, swell: true
    });
    return this._close(v, Math.max(a, b));
  };

  Audio.prototype._sPlant = function (t0) {
    var v = this._open('plant', 0.45); if (!v) return false;
    var i, t, end = t0, e;
    for (i = 0; i < 3; i++) {
      t = t0 + i * (0.03 + this._r() * 0.055);
      e = this._burst(v, {
        t0: t, kind: 'white', rate: 1.35, filter: 'highpass', freq: 2600 + this._r() * 1400, q: 0.8,
        peak: 0.055 + this._r() * 0.045, atk: 0.0006, dec: 0.012 + this._r() * 0.02,
        pan: (this._r() - 0.5) * 0.7
      });
      if (e > end) end = e;
    }
    e = this._burst(v, {
      t0: t0 + 0.04, kind: 'pink', rate: 1.2, filter: 'bandpass', freq: 2200, freqTo: 1500,
      glide: 0.18, q: 0.9, peak: 0.07, atk: 0.05, dec: 0.16, hold: 0.05, swell: true
    });
    return this._close(v, Math.max(end, e));
  };

  Audio.prototype._sWhoosh = function (t0) {
    var v = this._open('whoosh', 0.5); if (!v) return false;
    var src = this._noise(v, 'white', 0.9);
    var lp = this._filter(v, 'lowpass', 260, 1.2);
    var g = this._gain(v, 0);
    src.connect(lp); lp.connect(g);
    var p = this._pan(v, -0.35);
    if (p) {
      p.pan.setValueAtTime(-0.35, t0);
      p.pan.linearRampToValueAtTime(0.3, t0 + 0.45);
      g.connect(p); p.connect(v.out);
    } else {
      g.connect(v.out);
    }
    glides(lp.frequency, t0, [[0, 260], [0.2, 1900], [0.52, 340]]);
    var end = swell(g.gain, t0, 0.26, 0.14, 0.1, 0.32);
    src.start(t0);
    src.stop(end + 0.02);
    return this._close(v, end);
  };

  Audio.prototype._sThud = function (t0) {
    var v = this._open('thud', 0.55); if (!v) return false;
    var a = this._tone(v, {
      t0: t0, type: 'sine', freq: 78, freqTo: 46, glide: 0.16,
      peak: 0.34, atk: 0.002, dec: 0.2
    });
    var b = this._tone(v, {
      t0: t0, type: 'triangle', freq: 152, freqTo: 110, glide: 0.1,
      peak: 0.12, atk: 0.001, dec: 0.09
    });
    var c = this._burst(v, {
      t0: t0, kind: 'white', filter: 'lowpass', freq: 190, q: 0.9,
      peak: 0.16, atk: 0.001, dec: 0.07
    });
    return this._close(v, Math.max(a, b, c));
  };

  /* ------------------------------------------------------------- dispatcher */

  Audio.prototype.play = function (name, opts) {
    if (!this.available || !this.ctx) return false;
    try {
      var o = (opts && typeof opts === 'object') ? opts : {};
      this._prune();
      var t0 = fin(this.ctx.currentTime, 0) + 0.012;
      switch (name) {
        case 'click': return this._sClick(t0);
        case 'switch': return this._sSwitch(t0, o.on === undefined ? true : !!o.on);
        case 'latch': return this._sLatch(t0);
        case 'door': return this._sDoor(t0, o.open === undefined ? true : !!o.open);
        case 'drawer': return this._sDrawer(t0);
        case 'cabinet': return this._sCabinet(t0);
        case 'blinds': return this._sBlinds(t0);
        case 'curtain': return this._sCurtain(t0);
        case 'lamp': return this._sLamp(t0, o.on === undefined ? true : !!o.on);
        case 'steam': return this._sSteam(t0, o.on === undefined ? true : !!o.on);
        case 'page': return this._sPage(t0);
        case 'record': return this._sRecord(t0);
        case 'recordStop': return this._sRecordStop(t0);
        case 'fan': return this._sFan(t0, o.level);
        case 'fanStop': return this._sFanStop(t0, o.level);
        case 'chime': return this._sChime(t0, o);
        case 'tick': return this._sTick(t0);
        case 'globe': return this._sGlobe(t0);
        case 'plant': return this._sPlant(t0);
        case 'whoosh': return this._sWhoosh(t0, o);
        case 'thud': return this._sThud(t0, o);
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  /* ==================================================================== beds */
  /* Beds are built once, in init(), and only ever retuned afterwards, so
     calling setBed() a thousand times never grows the graph. */

  Audio.prototype._buildBeds = function () {
    var ctx = this.ctx;
    var t = fin(ctx.currentTime, 0);

    function makeOut(self, name) {
      var out = tag(ctx.createGain(), 'bed:' + name);
      out.gain.value = 0;
      out.connect(self.master);
      return out;
    }

    /* room: a very quiet interior air tone plus a low hum */
    var roomOut = makeOut(this, 'room');
    var roomAir = ctx.createGain(); roomAir.gain.value = 0.5;
    var roomLp = ctx.createBiquadFilter(); roomLp.type = 'lowpass'; roomLp.frequency.value = 260; roomLp.Q.value = 0.6;
    var roomSrc = ctx.createBufferSource(); roomSrc.buffer = this._noiseBuffer('pink'); roomSrc.loop = true;
    roomSrc.connect(roomLp); roomLp.connect(roomAir); roomAir.connect(roomOut);
    roomSrc.start(t);
    var roomHum = ctx.createOscillator(); roomHum.type = 'sine'; roomHum.frequency.value = 96;
    var roomHumG = ctx.createGain(); roomHumG.gain.value = 0.12;
    roomHum.connect(roomHumG); roomHumG.connect(roomOut); roomHum.start(t);
    this._beds.room = { out: roomOut, level: 0, userSet: false, p: { air: roomAir, hum: roomHumG } };

    /* outside: a day band and a night band crossfading into each other */
    var outOut = makeOut(this, 'outside');
    var dayBp = tag(ctx.createBiquadFilter(), 'bed:outside.bp');
    dayBp.type = 'bandpass'; dayBp.frequency.value = 700; dayBp.Q.value = 0.7;
    var dayG = tag(ctx.createGain(), 'bed:outside.day'); dayG.gain.value = 0;
    var daySrc = ctx.createBufferSource(); daySrc.buffer = this._noiseBuffer('pink'); daySrc.loop = true;
    daySrc.connect(dayBp); dayBp.connect(dayG); dayG.connect(outOut);
    daySrc.start(t);
    var nightLp = ctx.createBiquadFilter(); nightLp.type = 'lowpass'; nightLp.frequency.value = 240; nightLp.Q.value = 0.5;
    var nightG = tag(ctx.createGain(), 'bed:outside.night'); nightG.gain.value = 0;
    var nightSrc = ctx.createBufferSource(); nightSrc.buffer = this._noiseBuffer('pink'); nightSrc.loop = true;
    nightSrc.connect(nightLp); nightLp.connect(nightG); nightG.connect(outOut);
    nightSrc.start(t);
    // slow movement: one LFO on the band centre, one on the day level
    var lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.055;
    var lfo1G = ctx.createGain(); lfo1G.gain.value = 90;
    lfo1.connect(lfo1G); lfo1G.connect(dayBp.frequency); lfo1.start(t);
    var lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.031;
    var lfo2G = ctx.createGain(); lfo2G.gain.value = 0.05;
    lfo2.connect(lfo2G); lfo2G.connect(dayG.gain); lfo2.start(t);
    this._beds.outside = {
      out: outOut, level: 0, userSet: false, crickets: false,
      p: { bp: dayBp, day: dayG, night: nightG, nightLp: nightLp }
    };

    /* record: rumble + surface hiss (the crackle pops are scheduled while it spins) */
    var recOut = makeOut(this, 'record');
    var rumLp = ctx.createBiquadFilter(); rumLp.type = 'lowpass'; rumLp.frequency.value = 90; rumLp.Q.value = 0.7;
    var rumG = ctx.createGain(); rumG.gain.value = 0.55;
    var rumSrc = ctx.createBufferSource(); rumSrc.buffer = this._noiseBuffer('pink'); rumSrc.loop = true;
    rumSrc.connect(rumLp); rumLp.connect(rumG); rumG.connect(recOut); rumSrc.start(t);
    var rumOsc = ctx.createOscillator(); rumOsc.type = 'sine'; rumOsc.frequency.value = 30.5;
    var rumOscG = ctx.createGain(); rumOscG.gain.value = 0.1;
    rumOsc.connect(rumOscG); rumOscG.connect(recOut); rumOsc.start(t);
    var hissHp = ctx.createBiquadFilter(); hissHp.type = 'highpass'; hissHp.frequency.value = 3200; hissHp.Q.value = 0.6;
    var hissG = ctx.createGain(); hissG.gain.value = 0.05;
    var hissSrc = ctx.createBufferSource(); hissSrc.buffer = this._noiseBuffer('white'); hissSrc.loop = true;
    hissSrc.connect(hissHp); hissHp.connect(hissG); hissG.connect(recOut); hissSrc.start(t);
    this._beds.record = { out: recOut, level: 0, userSet: false, p: { rumble: rumG, hiss: hissG } };

    /* fan: motor whir + air noise (opts.rate shifts the whir) */
    var fanOut = makeOut(this, 'fan');
    var motLp = tag(ctx.createBiquadFilter(), 'bed:fan.lp');
    motLp.type = 'lowpass'; motLp.frequency.value = 420; motLp.Q.value = 3.4;
    var motG = ctx.createGain(); motG.gain.value = 0.2;
    var motOsc = tag(ctx.createOscillator(), 'bed:fan.osc');
    motOsc.type = 'sawtooth'; motOsc.frequency.value = 42;
    motOsc.connect(motLp); motLp.connect(motG); motG.connect(fanOut); motOsc.start(t);
    var mot2 = ctx.createOscillator(); mot2.type = 'triangle'; mot2.frequency.value = 63; mot2.detune.value = 11;
    var mot2G = ctx.createGain(); mot2G.gain.value = 0.075;
    mot2.connect(mot2G); mot2G.connect(fanOut); mot2.start(t);
    var airBp = ctx.createBiquadFilter(); airBp.type = 'bandpass'; airBp.frequency.value = 900; airBp.Q.value = 0.5;
    var airG = ctx.createGain(); airG.gain.value = 0.13;
    var airSrc = ctx.createBufferSource(); airSrc.buffer = this._noiseBuffer('white'); airSrc.loop = true;
    airSrc.connect(airBp); airBp.connect(airG); airG.connect(fanOut); airSrc.start(t);
    this._beds.fan = {
      out: fanOut, level: 0, userSet: false, rate: 1.4,
      p: { lp: motLp, motor: motG, osc: motOsc, osc2: mot2, air: airBp, airG: airG }
    };

    /* lamp: an extremely subtle electrical hum */
    var lampOut = makeOut(this, 'lamp');
    var hum1 = ctx.createOscillator(); hum1.type = 'sine'; hum1.frequency.value = 120;
    var hum1G = ctx.createGain(); hum1G.gain.value = 0.012;
    hum1.connect(hum1G); hum1G.connect(lampOut); hum1.start(t);
    var hum2 = ctx.createOscillator(); hum2.type = 'sine'; hum2.frequency.value = 180;
    var hum2G = ctx.createGain(); hum2G.gain.value = 0.005;
    hum2.connect(hum2G); hum2G.connect(lampOut); hum2.start(t);
    var hum3Lp = ctx.createBiquadFilter(); hum3Lp.type = 'lowpass'; hum3Lp.frequency.value = 420; hum3Lp.Q.value = 0.6;
    var hum3G = ctx.createGain(); hum3G.gain.value = 0.01;
    var hum3Src = ctx.createBufferSource(); hum3Src.buffer = this._noiseBuffer('pink'); hum3Src.loop = true;
    hum3Src.connect(hum3Lp); hum3Lp.connect(hum3G); hum3G.connect(lampOut); hum3Src.start(t);
    this._beds.lamp = { out: lampOut, level: 0, userSet: false, p: { hum: hum1G, hum2: hum2G, air: hum3G } };
  };

  /** Recompute every parameter of a bed from its level and the environment. */
  Audio.prototype._applyBed = function (name, tau) {
    var b = this._beds[name];
    if (!b || !this.ctx) return;
    var L = clamp(fin(b.level, 0), 0, 1);
    var e = this._env;
    var night = !e.day;
    rampTo(this.ctx, b.out.gain, L, tau);

    if (name === 'room') {
      rampTo(this.ctx, b.p.air.gain, L * (e.lightsOn ? 0.17 : 0.055), tau);
      rampTo(this.ctx, b.p.hum.gain, L * (e.lightsOn ? 0.13 : 0.05), tau);
    } else if (name === 'outside') {
      rampTo(this.ctx, b.p.day.gain, L * (night ? 0.06 : 0.42), tau);
      rampTo(this.ctx, b.p.night.gain, L * (night ? 0.16 : 0.03), tau);
      rampTo(this.ctx, b.p.bp.frequency, night ? 320 : 700, tau);
      rampTo(this.ctx, b.p.nightLp.frequency, night ? 240 : 460, tau);
      b.crickets = night && L > 0.02;
    } else if (name === 'record') {
      rampTo(this.ctx, b.p.rumble.gain, L * 0.55, tau);
      rampTo(this.ctx, b.p.hiss.gain, L * 0.05, tau);
    } else if (name === 'fan') {
      var rate = clamp(fin(b.rate, 1.4), 0, 12);
      var f = clamp(16 + rate * 19, 16, 220);
      rampTo(this.ctx, b.p.osc.frequency, f, tau);
      rampTo(this.ctx, b.p.osc2.frequency, f * 1.51, tau);
      rampTo(this.ctx, b.p.lp.frequency, clamp(f * 10, 120, 2600), tau);
      rampTo(this.ctx, b.p.motor.gain, L * 0.1, tau);
      rampTo(this.ctx, b.p.airG.gain, L * 0.12, tau);
      rampTo(this.ctx, b.p.air.frequency, clamp(500 + rate * 320, 300, 4000), tau);
    } else if (name === 'lamp') {
      rampTo(this.ctx, b.p.hum.gain, L * 0.012, tau);
      rampTo(this.ctx, b.p.hum2.gain, L * 0.005, tau);
      rampTo(this.ctx, b.p.air.gain, L * 0.01, tau);
    }
  };

  /** A bed nobody has driven explicitly simply follows the room. */
  Audio.prototype._defaultBeds = function () {
    if (!this.ctx) return;
    var e = this._env, b;
    b = this._beds.room; if (b && !b.userSet) b.level = e.lightsOn ? 0.85 : 0.25;
    b = this._beds.outside; if (b && !b.userSet) b.level = 1;
    b = this._beds.lamp; if (b && !b.userSet) b.level = e.lampOn ? 1 : 0;
    this._applyBed('room', 0.7);
    this._applyBed('outside', 0.7);
    this._applyBed('lamp', 0.7);
  };

  /** Raise (or drop) a bed only as far as the sound itself needs. */
  Audio.prototype._nudgeBed = function (name, level) {
    var b = this._beds[name];
    if (!b) return false;
    var want = clamp(fin(level, 0), 0, 1);
    if (want <= 0) {
      if (b.level <= 0) return false;
      b.level = 0;
    } else {
      if (b.level >= want) return false;
      b.level = want;
    }
    b.userSet = true;
    this._applyBed(name, 0.4);
    return true;
  };

  Audio.prototype.setBed = function (name, level, opts) {
    var lv = clamp(fin(level, 0), 0, 1);
    var o = (opts && typeof opts === 'object') ? opts : null;
    if (!this.available || !this.ctx) {
      if (this._beds[name] || name === 'room' || name === 'outside' || name === 'record' ||
        name === 'fan' || name === 'lamp') {
        this._want[name] = { level: lv, opts: o };
      }
      return false;
    }
    try {
      var b = this._beds[name];
      if (!b) return false;
      this._prune();
      b.level = lv;
      b.userSet = true;
      if (o && name === 'fan' && o.rate !== undefined) b.rate = clamp(fin(o.rate, b.rate), 0, 12);
      this._applyBed(name, o && o.tau !== undefined ? fin(o.tau, 0.25) : 0.25);
      return true;
    } catch (e) {
      return false;
    }
  };

  /* ---------------------------------------------------------------- master */

  Audio.prototype._rampMaster = function (tau) {
    if (!this.master || !this.ctx) return;
    var target = this.muted ? 0 : this.masterLevel * clamp(fin(this.volume, 1), 0, 1);
    rampTo(this.ctx, this.master.gain, target, tau);
  };

  Audio.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (!this.available || !this.ctx) return;
    try { this._rampMaster(0.12); } catch (e) { }
  };

  Audio.prototype.setMasterVolume = function (v) {
    this.volume = clamp(fin(v, this.volume), 0, 1);
    if (!this.available || !this.ctx) return;
    try { this._rampMaster(0.08); } catch (e) { }
  };

  /* ----------------------------------------------------------- environment */

  Audio.prototype.setEnv = function (env) {
    if (!env || typeof env !== 'object') return;
    var e = this._env;
    if (env.day !== undefined) e.day = !!env.day;
    if (env.hour !== undefined) {
      e.hour = fin(env.hour, e.hour);
      if (env.day === undefined) e.day = !(e.hour < 6.5 || e.hour > 19.5);
    }
    if (env.lightsOn !== undefined) e.lightsOn = !!env.lightsOn;
    if (env.lampOn !== undefined) e.lampOn = !!env.lampOn;

    if (!this.available || !this.ctx) return;
    try {
      this._prune();
      this._defaultBeds();
    } catch (err) { }
  };

  /* --------------------------------------------------------------- ticking */

  Audio.prototype.tick = function (nowSeconds) {
    if (!this.available || !this.ctx) return;
    try {
      var t = fin(nowSeconds, this._lastNow === null ? 0 : this._lastNow);
      this._prune();

      // exactly one watch tick per whole second of wall time, room light on
      var sec = Math.floor(t);
      if (sec !== this._lastSec) {
        this._lastSec = sec;
        if (this._env.lightsOn) this.play('tick');
      }

      var dt = this._lastNow === null ? 0 : clamp(t - this._lastNow, 0, 0.25);
      this._lastNow = t;
      this._ambient(dt);
    } catch (e) { }
  };

  /** Sparse, randomly timed continuations of the beds: crickets, crackle. */
  Audio.prototype._ambient = function (dt) {
    if (dt <= 0) return;
    var ob = this._beds.outside, rb = this._beds.record, i;

    if (ob && ob.crickets) {
      this._cricketT -= dt;
      if (this._cricketT <= 0) {
        this._cricketT = 1.1 + this._r() * 3.4;
        this._cricket();
      }
    }

    if (rb && rb.level > 0.03) {
      this._popAcc += dt * (2.5 + 5.5 * rb.level);
      for (i = 0; i < 3 && this._popAcc >= 1; i++) {
        this._popAcc -= 1;
        this._crackle();
      }
      if (this._popAcc > 3) this._popAcc = 3;
    } else {
      this._popAcc = 0;
    }
  };

  /** A sparse high chirp: three to five blips of a resonant tone. */
  Audio.prototype._cricket = function () {
    if (!this.ctx) return false;
    var v = this._open('cricket', 0.4); if (!v) return false;
    var t0 = fin(this.ctx.currentTime, 0) + 0.02;
    var f = 3900 + this._r() * 900;
    var osc = this._osc(v, 'sine', f, 0);
    var bp = this._filter(v, 'bandpass', f, 18);
    var g = this._gain(v, 0);
    osc.connect(bp); bp.connect(g); g.connect(v.out);
    glides(osc.frequency, t0, [[0, f], [0.16, f * 1.02]]);
    var n = 3 + Math.floor(this._r() * 3), end = t0, e;
    for (var i = 0; i < n; i++) {
      e = perc(g.gain, t0 + i * 0.042, 0.035, 0.003, 0.016);
      if (e > end) end = e;
    }
    osc.start(t0);
    osc.stop(end + 0.03);
    return this._close(v, end);
  };

  /** One vinyl pop. */
  Audio.prototype._crackle = function () {
    if (!this.ctx) return false;
    var v = this._open('crackle', 0.35); if (!v) return false;
    var t0 = fin(this.ctx.currentTime, 0) + 0.01;
    var end = this._burst(v, {
      t0: t0, kind: 'white', rate: 0.9 + this._r() * 0.7,
      filter: 'bandpass', freq: 1100 + this._r() * 2800, q: 1.2 + this._r() * 3,
      peak: 0.02 + this._r() * 0.05, atk: 0.0004, dec: 0.005 + this._r() * 0.018
    });
    return this._close(v, end);
  };

  P.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
