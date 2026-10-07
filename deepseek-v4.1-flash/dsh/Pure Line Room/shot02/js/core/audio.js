/* ===========================================================================
 * Pure Line Room — js/core/audio.js                          owner: agent-audio
 * ---------------------------------------------------------------------------
 * A 100% synthesised sound engine for the room: no files, no fetch, no libs.
 * Everything is built from OscillatorNode, AudioBufferSourceNode (procedural
 * noise), BiquadFilterNode, GainNode, StereoPannerNode and one shared
 * ConvolverNode fed by a generated impulse response.
 *
 *  • Lazy context: made on the first call to any method, but nothing starts
 *    until unlock() runs in a user gesture. Before that every method no-ops and
 *    requested loops are only remembered, so headless hosts are safe.
 *  • Buses: voice -> sfx | loop | mus | amb -> masterGain -> limiter ->
 *    destination, plus a reverb send from masterGain; param('musicVol' |
 *    'ambienceVol') fades whole families without touching single voices.
 *  • Voices: percEnv/holdEnv, noiseBuf, bed, noiseHit, blip, thump and creak
 *    build short node groups at absolute times and disconnect themselves when
 *    done; repeats randomise pitch, gain, pan and timing.
 *  • Loops: persistent layers whose time-based content (music, crackle,
 *    crickets, birds, ticks) runs on a lookahead scheduler pumped from
 *    update(dt), with a watchdog only if the host stops calling update().
 *  • Safety: every method is try/catch wrapped, no-ops while the context is
 *    missing/closed/suspended, and never writes a gain without a ramp.
 * ========================================================================= */

const BP = { type: 'bandpass' };   // shared filter descriptors for noiseHit()
const LP = { type: 'lowpass' };
const HP = { type: 'highpass' };

export function createAudio() {
  /* ----------------------------------------------------------------- state */
  let ctx = null, master = null, limiter = null, revSend = null, revRet = null;
  let disposed = false, timer = null, lastUpdate = 0;
  let masterVol = 0.8, muted = false;
  const params = { fanSpeed: 1.2, musicVol: 0.62, ambienceVol: 0.7 };
  const buses = {};          // sfx | loop | mus | amb
  const loops = new Map();   // live loop instances
  const want = new Map();    // requested loop state, applied on unlock()
  const noiseCache = new Map();
  const pending = new Map(); // cleanup timer id -> nodes still to disconnect
  const graph = [];          // long-lived master-chain nodes (freed in dispose)

  /* ----------------------------------------------------------------- utils */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clamp01 = (v) => clamp(num(v, 0), 0, 1);
  const rand = (a, b) => a + Math.random() * (b - a);
  const rnd = (a) => (Math.random() * 2 - 1) * a;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const bus = (name) => buses[name] || buses.sfx || null;
  function isLive() {
    if (disposed || !ctx || !master) return false;
    return ctx.state === 'running' || ctx.state === undefined;
  }
  function disc(nodes) {
    for (const n of nodes) { try { if (n) n.disconnect(); } catch (e) { /* gone */ } }
  }
  function kill(nodes) {
    for (const n of nodes) {
      try { if (n && typeof n.stop === 'function') n.stop(); } catch (e) { /* stopped */ }
      try { if (n && typeof n.disconnect === 'function') n.disconnect(); } catch (e) { /* gone */ }
    }
    nodes.length = 0;
  }
  function loopObj(nodes, sched) {
    return { nodes, sched, stop() { kill(nodes); } };
  }

  /* --------------------------------------------------- lazy context + graph */
  function ensure() {
    if (disposed) return null;
    if (ctx) return ctx;
    let AC = null;
    try { const g = globalThis; AC = g.AudioContext || g.webkitAudioContext || null; } catch (e) { AC = null; }
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    try { build(); } catch (e) { /* stay alive but silent */ }
    return ctx;
  }
  function build() {
    const c = ctx, sendAmt = { sfx: 0.16, loop: 0.1, mus: 0.24, amb: 0.18 };
    master = c.createGain(); graph.push(master);
    master.gain.value = muted ? 0 : masterVol;
    let tail = master;
    if (typeof c.createDynamicsCompressor === 'function') {   // soft limiter
      limiter = c.createDynamicsCompressor(); graph.push(limiter);
      limiter.threshold.value = -8; limiter.knee.value = 14; limiter.ratio.value = 6;
      limiter.attack.value = 0.004; limiter.release.value = 0.2;
      master.connect(limiter); tail = limiter;
    }
    tail.connect(c.destination);
    if (typeof c.createConvolver === 'function') {            // subtle room
      const conv = c.createConvolver();
      conv.buffer = makeIR(1.6, 2.8);
      revSend = c.createGain(); revSend.gain.value = 1;
      revRet = c.createGain(); revRet.gain.value = 0.24;
      master.connect(revSend); revSend.connect(conv); conv.connect(revRet);
      revRet.connect(c.destination); graph.push(conv, revSend, revRet);
    }
    buses.sfx = c.createGain();  buses.sfx.gain.value = 0.9;
    buses.loop = c.createGain(); buses.loop.gain.value = 0.85;
    buses.mus = c.createGain();  buses.mus.gain.value = params.musicVol;
    buses.amb = c.createGain();  buses.amb.gain.value = params.ambienceVol;
    for (const k of Object.keys(buses)) {
      buses[k].connect(master); graph.push(buses[k]);
      if (revSend) {
        const tap = c.createGain();
        tap.gain.value = sendAmt[k];
        buses[k].connect(tap); tap.connect(revSend); graph.push(tap);
      }
    }
  }

  /* Short exponential-decay noise burst used as the room impulse response. */
  function makeIR(dur, decay) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.002 ? 0.25 : 1);
      }
    }
    return buf;
  }

  /* Procedural noise beds (white / pink / brown), cached per kind+length. */
  function noiseBuf(kind, sec) {
    const s = Math.max(0.25, num(sec, 2)), key = kind + ':' + s;
    const hit = noiseCache.get(key);
    if (hit) return hit;
    const len = Math.max(64, Math.floor(ctx.sampleRate * s));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = clamp(last * 3.2, -1, 1);
      }
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = clamp((b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11, -1, 1);
        b6 = w * 0.115926;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    noiseCache.set(key, buf);
    return buf;
  }

  /* ----------------------------------------------------------- voice helpers */
  function bq(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = Math.max(10, freq);
    f.Q.value = num(q, 1);
    return f;
  }

  /* Persistent noise bed: looping buffer -> biquad -> gain -> bus. */
  function bed(kind, sec, type, freq, q, gain, dest) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(kind, sec);
    src.loop = true;
    const f = bq(type, freq, q), g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(dest || bus('amb'));
    try { src.start(ctx.currentTime); } catch (e) { /* ignore */ }
    return { nodes: [src, f, g], src, filter: f, gain: g };
  }

  /* 0 -> peak -> exponential tail. Returns the voice's end time. */
  function percEnv(g, t0, peak, atk, dec) {
    const p = g.gain, a = Math.max(0.0008, num(atk, 0.004)), d = Math.max(0.008, num(dec, 0.1));
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    p.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    return t0 + a + d;
  }

  /* attack -> sustain -> exponential release (for creaks/pads). */
  function holdEnv(g, t0, peak, atk, sus, rel) {
    const p = g.gain, a = Math.max(0.001, num(atk, 0.05));
    const s = Math.max(a + 0.005, num(sus, 0.2)), r = Math.max(0.01, num(rel, 0.1));
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    p.setValueAtTime(Math.max(0.0002, peak), t0 + s);
    p.exponentialRampToValueAtTime(0.0001, t0 + s + r);
    return t0 + s + r;
  }

  /* Disconnect a finished one-shot once its tail has played out. */
  function cleanup(t, ...nodes) {
    if (!ctx) return;
    const id = setTimeout(() => { pending.delete(id); disc(nodes); },
      Math.max(40, (t - ctx.currentTime) * 1000 + 140));
    pending.set(id, nodes);
  }

  /* Per-voice output: gain -> (optional pan) -> bus. */
  function voiceOut(o) {
    o = o || {};
    const g = ctx.createGain();
    g.gain.value = num(o.gain, 1);
    const nodes = [g];
    let tail = g;
    const pv = num(o.pan, 0);
    if (Math.abs(pv) > 0.004 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pv, -1, 1);
      tail.connect(p); tail = p; nodes.push(p);
    }
    const b = bus(o.bus || 'sfx');
    if (b) tail.connect(b);
    return { input: g, nodes };
  }

  /* Open a one-shot voice: gain scalar E, rate scalar R, node v, start time. */
  function openSfx(o, panAmt) {
    return {
      E: num(o.gain, 1), R: clamp(num(o.rate, 1), 0.3, 3),
      v: voiceOut({ bus: 'sfx', pan: o.pan === undefined ? rnd(panAmt) : o.pan }),
      t0: ctx.currentTime + 0.003 + Math.random() * 0.004,
    };
  }

  /* Tonal blip with optional pitch glide and percussive decay. */
  function blip(dest, t0, o) {
    if (!ctx || !dest) return t0;
    const osc = ctx.createOscillator();
    try { osc.type = o.type || 'sine'; } catch (e) { /* keep default */ }
    const f0 = Math.max(20, num(o.freq, 440)), f1 = Math.max(20, num(o.freq2, f0));
    osc.frequency.setValueAtTime(f0, t0);
    if (Math.abs(f1 - f0) > 0.05) {
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + Math.max(0.005, num(o.glide, num(o.dur, 0.1))));
    }
    const g = ctx.createGain();
    const end = percEnv(g, t0, num(o.gain, 0.15), num(o.atk, 0.004), num(o.dec, 0.1));
    osc.connect(g); g.connect(dest);
    try { osc.start(t0); osc.stop(end + 0.03); } catch (e) { /* ignore */ }
    cleanup(end + 0.06, g, osc);
    return end;
  }

  /* Filtered noise hit with optional cutoff sweep (o.f0 -> o.f1). */
  function noiseHit(dest, t0, o) {
    if (!ctx || !dest) return t0;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf(o.kind || 'white', o.bufSec || 2);
    src.loop = false;
    src.playbackRate.value = clamp(num(o.rate, 1), 0.25, 4);
    const g = ctx.createGain(), dur = Math.max(0.004, num(o.dur, 0.08));
    let filt = null;
    if (o.filter) {
      filt = ctx.createBiquadFilter();
      filt.type = o.filter.type || 'bandpass';
      const f0 = Math.max(20, num(o.f0, num(o.filter.freq, 1000)));
      filt.frequency.setValueAtTime(f0, t0);
      if (o.f1) filt.frequency.exponentialRampToValueAtTime(Math.max(20, num(o.f1, f0)), t0 + dur);
      filt.Q.value = num(o.q, num(o.filter.q, 1));
      g.connect(filt); filt.connect(dest);
    } else g.connect(dest);
    const end = percEnv(g, t0, num(o.gain, 0.2), num(o.atk, 0.003), dur);
    src.connect(g);
    try { src.start(t0, Math.random() * 1.2); src.stop(end + 0.03); } catch (e) { /* ignore */ }
    cleanup(end + 0.06, g, src, filt);
    return end;
  }

  /* Low impact: pitched body drop plus a low-passed noise layer. */
  function thump(dest, t0, o) {
    const gain = num(o.gain, 0.3), f0 = Math.max(24, num(o.freq, 120)), dec = num(o.dec, 0.3);
    let e = blip(dest, t0, {
      type: o.type || 'sine', freq: f0, freq2: Math.max(20, num(o.freq2, f0 * 0.45)),
      glide: dec * 0.6, gain, atk: num(o.atk, 0.005), dec,
    });
    e = Math.max(e, noiseHit(dest, t0, {
      kind: 'brown', filter: LP, f0: num(o.cut, 400), q: 0.8,
      dur: dec * 0.45, gain: gain * 0.34, atk: 0.002,
    }));
    return e;
  }

  /* Hinge creak: sawtooth with vibrato through a resonant band. */
  function creak(dest, t0, o) {
    if (!ctx || !dest) return t0;
    const dur = num(o.dur, 1);
    const osc = ctx.createOscillator();
    try { osc.type = o.type || 'sawtooth'; } catch (e) { /* default */ }
    const f0 = Math.max(30, num(o.f0, 220)), f1 = Math.max(30, num(o.f1, 380));
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = num(o.vib, 6.5);
    const lg = ctx.createGain();
    lg.gain.value = num(o.vibDepth, 14);
    lfo.connect(lg); lg.connect(osc.frequency);
    const bp = bq('bandpass', num(o.band, 1000), num(o.q, 9));
    const g = ctx.createGain();
    const end = holdEnv(g, t0, num(o.gain, 0.08), num(o.atk, 0.12), dur * 0.8, dur * 0.35);
    osc.connect(bp); bp.connect(g); g.connect(dest);
    try { osc.start(t0); osc.stop(end + 0.04); lfo.start(t0); lfo.stop(end + 0.04); } catch (e) { /* ignore */ }
    cleanup(end + 0.08, g, osc, lfo, lg, bp);
    return end;
  }

  /* ------------------------------------------------------------- one-shots */
  const SFX = {
    // tiny dry UI tick: very short filtered noise + high sine blip
    click(o) {
      const { E, R, v, t0 } = openSfx(o, 0.12);
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(2400, 3100) * R, q: 1.9, atk: 0.001, dur: (0.014 + Math.random() * 0.006) / R, gain: 0.5 * E * rand(0.85, 1.15) });
      e = Math.max(e, blip(v.input, t0 + 0.002, { freq: rand(3000, 3500) * R, freq2: rand(1900, 2300) * R, dur: 0.03 / R, gain: 0.09 * E, atk: 0.001, dec: 0.026 / R }));
      cleanup(e + 0.08, ...v.nodes);
    },
    // light switch: bright two-stage snap (latch click + body thock)
    switch(o) {
      const { E, R, v, t0 } = openSfx(o, 0.1);
      const t2 = t0 + 0.032 + Math.random() * 0.012;
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(3400, 4300) * R, q: 2.2, atk: 0.0008, dur: 0.012 / R, gain: 0.45 * E * rand(0.85, 1.15) });
      e = Math.max(e, blip(v.input, t0, { type: 'square', freq: rand(2200, 2700) * R, freq2: rand(1200, 1500) * R, dur: 0.02 / R, gain: 0.05 * E, atk: 0.001, dec: 0.018 / R }));
      e = Math.max(e, thump(v.input, t2, { freq: rand(180, 230) * R, freq2: rand(90, 120) * R, dec: 0.075 / R, gain: 0.2 * E, cut: 700 }));
      e = Math.max(e, noiseHit(v.input, t2, { filter: LP, f0: 900, q: 0.8, dur: 0.05 / R, gain: 0.14 * E, atk: 0.002 }));
      cleanup(e + 0.08, ...v.nodes);
    },
    // small rotary/plunger switch under the lamp: warm, quiet, no high band
    lampClick(o) {
      const { E, R, v, t0 } = openSfx(o, 0.08);
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(1500, 1900) * R, q: 1.4, atk: 0.002, dur: 0.026 / R, gain: 0.26 * E });
      e = Math.max(e, blip(v.input, t0 + 0.004, { freq: rand(1200, 1500) * R, freq2: rand(700, 900) * R, dur: 0.05 / R, gain: 0.07 * E, atk: 0.002, dec: 0.045 / R }));
      e = Math.max(e, thump(v.input, t0 + 0.006, { freq: 150 * R, freq2: 80 * R, dec: 0.05 / R, gain: 0.08 * E, cut: 500 }));
      cleanup(e + 0.08, ...v.nodes);
    },
    // wooden drawer sliding open: noise sweep + body resonance + soft end thud
    drawer(o) {
      const { E, R, v, t0 } = openSfx(o, 0.15);
      const dur = (0.32 + Math.random() * 0.1) / R;
      let e = noiseHit(v.input, t0, { kind: 'pink', filter: BP, f0: 1500 * R, f1: 420 * R, q: 1.1, dur, gain: 0.22 * E, atk: 0.05 });
      e = Math.max(e, noiseHit(v.input, t0 + 0.01, { filter: LP, f0: 2200 * R, f1: 700 * R, q: 0.9, dur: dur * 0.9, gain: 0.12 * E, atk: 0.06 }));
      e = Math.max(e, blip(v.input, t0 + 0.02, { type: 'triangle', freq: rand(190, 230) * R, freq2: rand(150, 175) * R, dur: 0.22 / R, gain: 0.07 * E, atk: 0.02, dec: 0.2 / R }));
      e = Math.max(e, blip(v.input, t0 + 0.26 / R, { type: 'triangle', freq: 320 * R, freq2: 260 * R, dur: 0.12 / R, gain: 0.04 * E, atk: 0.01, dec: 0.11 / R }));
      e = Math.max(e, thump(v.input, t0 + dur * 0.92, { freq: 130 * R, freq2: 62 * R, dec: 0.16 / R, gain: 0.26 * E, cut: 420 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // cabinet door: lower wood knock + a short hinge squeak
    cabinet(o) {
      const { E, R, v, t0 } = openSfx(o, 0.15);
      let e = thump(v.input, t0, { freq: rand(150, 190) * R, freq2: rand(70, 95) * R, dec: 0.18 / R, gain: 0.34 * E, cut: 500 });
      e = Math.max(e, noiseHit(v.input, t0, { filter: LP, f0: 900 * R, q: 1, dur: 0.06 / R, gain: 0.16 * E, atk: 0.002 }));
      e = Math.max(e, creak(v.input, t0 + 0.05, { f0: 900 * R, f1: 1500 * R, dur: 0.28 / R, band: 1600 * R, q: 10, vib: 11, vibDepth: 40, gain: 0.035 * E, atk: 0.03 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // long rising hinge creak over a low wooden groan
    doorOpen(o) {
      const { E, R, v, t0 } = openSfx(o, 0.18);
      const dur = 1.15 + Math.random() * 0.4;
      let e = creak(v.input, t0, { f0: rand(190, 240) * R, f1: rand(380, 460) * R, dur, band: 1050 * R, q: 9, vib: 6.5, vibDepth: 16, gain: 0.085 * E, atk: 0.16 });
      e = Math.max(e, blip(v.input, t0, { type: 'sawtooth', freq: rand(72, 86) * R, freq2: 55 * R, glide: dur * 0.8, dur, gain: 0.09 * E, atk: 0.25, dec: dur * 0.8 }));
      e = Math.max(e, noiseHit(v.input, t0, { kind: 'brown', filter: LP, f0: 220, q: 0.9, dur: dur * 0.9, gain: 0.1 * E, atk: 0.3 }));
      cleanup(e + 0.12, ...v.nodes);
    },
    // latch mechanism: mechanical clack then a low boom with short decay
    doorClose(o) {
      const { E, R, v, t0 } = openSfx(o, 0.14);
      const t2 = t0 + 0.055 + Math.random() * 0.02;
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(2600, 3400) * R, q: 1.6, atk: 0.001, dur: 0.018 / R, gain: 0.42 * E });
      e = Math.max(e, blip(v.input, t0 + 0.004, { type: 'square', freq: rand(1800, 2200) * R, freq2: rand(900, 1200) * R, dur: 0.025 / R, gain: 0.06 * E, atk: 0.001, dec: 0.022 / R }));
      e = Math.max(e, thump(v.input, t2, { freq: rand(95, 115) * R, freq2: 42 * R, dec: 0.45 / R, gain: 0.42 * E, atk: 0.006, cut: 260 }));
      e = Math.max(e, noiseHit(v.input, t2, { kind: 'brown', filter: LP, f0: 400, q: 0.9, dur: 0.22 / R, gain: 0.16 * E, atk: 0.004 }));
      cleanup(e + 0.12, ...v.nodes);
    },
    // soft low impact
    thud(o) {
      const { E, R, v, t0 } = openSfx(o, 0.12);
      let e = thump(v.input, t0, { freq: rand(115, 140) * R, freq2: 50 * R, dec: (0.3 + Math.random() * 0.12) / R, gain: 0.4 * E, cut: 300 });
      e = Math.max(e, noiseHit(v.input, t0, { kind: 'brown', filter: LP, f0: 500, q: 0.8, dur: 0.07 / R, gain: 0.12 * E, atk: 0.003 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // paper flip: three high-passed crinkle bursts, fast decay
    page(o) {
      const { E, R, v, t0 } = openSfx(o, 0.25);
      const d = (0.1 + Math.random() * 0.06) / R;
      let e = noiseHit(v.input, t0, { filter: HP, f0: rand(1600, 2200) * R, q: 0.7, dur: d, gain: 0.2 * E, atk: 0.006 });
      e = Math.max(e, noiseHit(v.input, t0 + d * 0.45, { filter: BP, f0: 3200 * R, q: 0.9, dur: d * 0.5, gain: 0.09 * E, atk: 0.004 }));
      e = Math.max(e, noiseHit(v.input, t0 + d * 0.75, { filter: HP, f0: 2400 * R, q: 0.7, dur: d * 0.4, gain: 0.05 * E, atk: 0.003 }));
      cleanup(e + 0.08, ...v.nodes);
    },
    // wind-chime tube strike; opts.note = semitone offset (pentatonic use)
    chime(o) {
      const { E, R, v, t0 } = openSfx(o, 0.3);
      const semi = Number.isFinite(o.note) ? o.note : 0;
      const base = 660 * Math.pow(2, semi / 12) * R;
      const parts = [1, 2.756, 5.404], amps = [1, 0.34, 0.14];
      let e = t0;
      for (let i = 0; i < 3; i++) {
        e = Math.max(e, blip(v.input, t0 + i * 0.002, {
          freq: base * parts[i] * (1 + rnd(0.002)), atk: 0.004, dec: 3.2 - i * 0.7,
          gain: (i === 0 ? 0.14 : 0.05) * amps[i] * E * rand(0.85, 1.15),
        }));
      }
      e = Math.max(e, noiseHit(v.input, t0, { filter: BP, f0: base * 4.2, q: 4, dur: 0.02, gain: 0.05 * E, atk: 0.001 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // spinning globe: soft whoosh + faint metallic ring
    globe(o) {
      const { E, R, v, t0 } = openSfx(o, 0.2);
      const d = 0.9 + Math.random() * 0.3;
      let e = noiseHit(v.input, t0, { filter: BP, f0: 320 * R, f1: 900 * R, q: 1.4, dur: d * 0.5, gain: 0.16 * E, atk: 0.18 });
      e = Math.max(e, noiseHit(v.input, t0 + d * 0.45, { filter: BP, f0: 950 * R, f1: 380 * R, q: 1.2, dur: d * 0.55, gain: 0.12 * E, atk: 0.06 }));
      e = Math.max(e, blip(v.input, t0 + 0.05, { freq: 1720 * R * (1 + rnd(0.01)), gain: 0.018 * E, atk: 0.05, dec: 1.1 }));
      e = Math.max(e, blip(v.input, t0 + 0.07, { freq: 2580 * R * (1 + rnd(0.01)), gain: 0.012 * E, atk: 0.06, dec: 0.9 }));
      cleanup(e + 0.12, ...v.nodes);
    },
    // porcelain cup set down on wood: short bright clink + low thud
    ceramic(o) {
      const { E, R, v, t0 } = openSfx(o, 0.15);
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(4800, 5600) * R, q: 2.4, atk: 0.001, dur: 0.02 / R, gain: 0.26 * E });
      e = Math.max(e, blip(v.input, t0 + 0.001, { freq: rand(2900, 3200) * R, gain: 0.055 * E, atk: 0.002, dec: 0.28 }));
      e = Math.max(e, blip(v.input, t0 + 0.002, { freq: rand(4300, 4800) * R, gain: 0.03 * E, atk: 0.002, dec: 0.18 }));
      e = Math.max(e, thump(v.input, t0 + 0.018, { freq: rand(120, 150) * R, freq2: 62 * R, dec: 0.22 / R, gain: 0.22 * E, cut: 380 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // soft fabric puff: low-passed noise with a slow attack
    cushion(o) {
      const { E, R, v, t0 } = openSfx(o, 0.18);
      const d = 0.3 + Math.random() * 0.12;
      let e = noiseHit(v.input, t0, { kind: 'pink', filter: LP, f0: 700 * R, f1: 320 * R, q: 0.8, dur: d, gain: 0.22 * E, atk: 0.09 });
      e = Math.max(e, noiseHit(v.input, t0 + 0.02, { filter: BP, f0: 1100 * R, q: 0.9, dur: d * 0.4, gain: 0.05 * E, atk: 0.05 }));
      e = Math.max(e, blip(v.input, t0, { freq: 90 * R, freq2: 70 * R, dur: d, gain: 0.05 * E, atk: 0.06, dec: d * 0.8 }));
      cleanup(e + 0.1, ...v.nodes);
    },
    // knuckles on wood (one or two raps)
    knock(o) {
      const { E, R, v, t0 } = openSfx(o, 0.15);
      const n = Math.random() < 0.5 ? 1 : 2;
      let e = t0;
      for (let i = 0; i < n; i++) {
        const t = t0 + i * (0.085 + Math.random() * 0.03);
        e = Math.max(e, thump(v.input, t, { freq: rand(240, 300) * R, freq2: rand(120, 150) * R, dec: 0.09 / R, gain: 0.3 * E, cut: 900 }));
        e = Math.max(e, noiseHit(v.input, t, { filter: BP, f0: 700 * R, q: 3.5, atk: 0.001, dur: 0.03 / R, gain: 0.16 * E }));
        e = Math.max(e, blip(v.input, t + 0.004, { type: 'triangle', freq: rand(400, 460) * R, freq2: rand(220, 260) * R, dur: 0.08 / R, gain: 0.08 * E, atk: 0.002, dec: 0.07 / R }));
      }
      cleanup(e + 0.1, ...v.nodes);
    },
    // tonearm lowered onto a record: mechanical tick then a soft pop
    vinylDrop(o) {
      const { E, R, v, t0 } = openSfx(o, 0.1);
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(2600, 3200) * R, q: 1.7, atk: 0.001, dur: 0.014 / R, gain: 0.28 * E });
      const tp = t0 + 0.05 + Math.random() * 0.03;
      e = Math.max(e, noiseHit(v.input, tp, { filter: LP, f0: 1800, q: 0.8, dur: 0.02, gain: 0.3 * E, atk: 0.0015 }));
      e = Math.max(e, blip(v.input, tp, { freq: 180 * R, freq2: 90 * R, dur: 0.09, gain: 0.12 * E, atk: 0.002, dec: 0.08 }));
      for (let i = 0; i < 3; i++) {                    // stylus settling crackle
        e = Math.max(e, noiseHit(v.input, tp + 0.06 + i * rand(0.03, 0.08), { filter: HP, f0: 2500 * R, q: 0.8, dur: 0.006, gain: 0.05 * E * rand(0.5, 1.3), atk: 0.0008 }));
      }
      cleanup(e + 0.1, ...v.nodes);
    },
    // ballpoint pen click: two crisp stages
    penClick(o) {
      const { E, R, v, t0 } = openSfx(o, 0.1);
      let e = noiseHit(v.input, t0, { filter: BP, f0: rand(3800, 4600) * R, q: 2.6, atk: 0.0008, dur: 0.008 / R, gain: 0.32 * E });
      const t2 = t0 + 0.028 + Math.random() * 0.012;
      e = Math.max(e, noiseHit(v.input, t2, { filter: BP, f0: rand(2400, 2900) * R, q: 2, atk: 0.001, dur: 0.014 / R, gain: 0.2 * E }));
      e = Math.max(e, blip(v.input, t2, { freq: rand(1700, 2000) * R, freq2: rand(1100, 1300) * R, dur: 0.03 / R, gain: 0.05 * E, atk: 0.001, dec: 0.026 / R }));
      cleanup(e + 0.08, ...v.nodes);
    },
  };

  /* ------------------------------------------ lookahead voices for the loops */
  function popVoice(t, inten) {                    // vinyl crackle pop
    const v = voiceOut({ bus: 'loop', pan: rnd(0.85) });
    const big = Math.random() < 0.12;
    const g = (big ? rand(0.1, 0.2) : rand(0.02, 0.08)) * (0.5 + inten);
    let e = noiseHit(v.input, t, {
      filter: big ? LP : HP, f0: big ? 2600 : rand(2000, 5200), q: 0.8,
      dur: big ? 0.012 : 0.004, gain: g, atk: 0.0006,
    });
    if (big) e = Math.max(e, blip(v.input, t, { freq: rand(160, 260), freq2: 90, dur: 0.05, gain: g * 0.5, atk: 0.001, dec: 0.05 }));
    cleanup(e + 0.06, ...v.nodes);
  }
  function cricket(t) {                            // ~4 kHz burst train
    const v = voiceOut({ bus: 'amb', pan: rnd(0.8) });
    const f = rand(3600, 4800), n = 4 + ((Math.random() * 3) | 0), step = rand(0.026, 0.038);
    let e = t;
    for (let i = 0; i < n; i++) {
      e = Math.max(e, noiseHit(v.input, t + i * step, {
        filter: BP, f0: f * (1 + rnd(0.012)), q: 16, dur: 0.012,
        gain: 0.22 * (1 - i / (n + 2)) * rand(0.7, 1.1), atk: 0.001,
      }));
    }
    cleanup(e + 0.08, ...v.nodes);
  }
  function bird(t) {                               // 2-4 swept sine notes
    const v = voiceOut({ bus: 'amb', pan: rnd(0.75) });
    const base = [2000, 2300, 2700, 3100, 3500][(Math.random() * 5) | 0];
    const n = 2 + ((Math.random() * 3) | 0);
    let e = t, tt = t;
    for (let i = 0; i < n; i++) {
      const f = base * rand(0.92, 1.1), d = rand(0.06, 0.11);
      e = Math.max(e, blip(v.input, tt, {
        freq: f, freq2: f * rand(1.15, 1.42), glide: d * 0.5, dur: d,
        gain: 0.05 * rand(0.7, 1.2), atk: 0.008, dec: d,
      }));
      tt += d + rand(0.04, 0.12);
    }
    cleanup(e + 0.15, ...v.nodes);
  }
  function tickAt(t, alt) {                        // alt = tick / tock timbre
    const v = voiceOut({ bus: 'amb', pan: alt ? 0.06 : -0.06 });
    const f = (alt ? 2400 : 1750) * (1 + rnd(0.02));
    let e = noiseHit(v.input, t, { filter: BP, f0: f, q: 3.5, dur: 0.012, gain: 0.16 * rand(0.85, 1.15), atk: 0.0008 });
    e = Math.max(e, blip(v.input, t, { type: 'square', freq: f * 0.6, freq2: f * 0.45, dur: 0.02, gain: 0.03, atk: 0.001, dec: 0.018 }));
    e = Math.max(e, blip(v.input, t + 0.002, { freq: f * 1.5, gain: 0.02, atk: 0.001, dec: 0.01 }));
    cleanup(e + 0.06, ...v.nodes);
  }

  /* ------------------------------------------------------------ loop layers */
  function startVinyl(o) {                         // surface noise + crackle
    let inten = clamp(num(o && o.intensity, 0.5), 0, 1);
    const hiss = bed('white', 3, 'bandpass', 2600, 0.55, 0.004 + 0.014 * inten, bus('loop'));
    const rum = bed('brown', 3, 'lowpass', 120, 0.8, 0.02, bus('loop'));
    const nodes = hiss.nodes.concat(rum.nodes);
    let next = ctx.currentTime + rand(0.05, 0.4);
    const L = loopObj(nodes, (t) => {
      while (next < t + 0.45) {
        if (next > t + 0.005) popVoice(next, inten);
        next += rand(0.12, 0.9) * (1.35 - inten);
      }
    });
    L.setOpts = (no) => {
      if (no && no.intensity != null) {
        inten = clamp(num(no.intensity, inten), 0, 1);
        hiss.gain.gain.setTargetAtTime(0.004 + 0.014 * inten, ctx.currentTime, 0.25);
      }
    };
    return L;
  }
  function startMusic() {                          // lo-fi 4-chord loop @ 68 BPM
    const out = bus('mus'), tails = [], nodes = [];
    const step = (60 / 68) * 4;                    // one chord per bar
    const chords = [
      { notes: [50, 53, 57, 64], bass: 38 },       // Dm9
      { notes: [55, 58, 62, 65], bass: 43 },       // Gm7
      { notes: [48, 52, 59, 62], bass: 36 },       // Cmaj9
      { notes: [57, 60, 64, 67], bass: 45 },       // Am7
    ];
    const scale = [62, 65, 67, 69, 72, 74, 77];    // D minor pentatonic
    let idx = 0, next = ctx.currentTime + 0.12;
    function pad(dest, t, freq, span, gain, type, detune) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      try { osc.type = type; } catch (e) { /* default */ }
      osc.frequency.value = Math.max(20, freq);
      osc.detune.value = detune;
      const end = holdEnv(g, t, gain, 0.7, span * 0.6, span * 0.55);
      osc.connect(g); g.connect(dest);
      try { osc.start(t); osc.stop(end + 0.05); } catch (e) { /* ignore */ }
      cleanup(end + 0.1, g, osc);
    }
    function chord(t) {
      const ch = chords[idx % chords.length], span = step * 0.95;
      const cg = ctx.createGain(), lp = bq('lowpass', 1700, 0.6);
      cg.gain.setValueAtTime(0.0001, t);
      cg.gain.linearRampToValueAtTime(0.85, t + 0.7);
      cg.gain.setValueAtTime(0.85, t + span * 0.6);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + span + 1.8);
      cg.connect(lp); lp.connect(out);
      const blp = bq('lowpass', 300, 0.7);
      blp.connect(out);
      for (const m of ch.notes) {
        pad(cg, t, midi(m), span, 0.05, 'triangle', -5 + rnd(4));
        pad(cg, t, midi(m), span, 0.032, 'sine', 6 + rnd(4));
      }
      pad(blp, t, midi(ch.bass), span * 0.9, 0.16, 'triangle', 0);
      pad(blp, t, midi(ch.bass) * 2, span * 0.45, 0.035, 'sine', 0);
      const nM = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
      for (let i = 0; i < nM; i++) {               // occasional sparse melody note
        const v = voiceOut({ bus: 'mus', pan: rnd(0.45) });
        const mf = midi(scale[(Math.random() * scale.length) | 0]);
        cleanup(blip(v.input, t + rand(0.35, Math.max(0.6, span - 0.7)), {
          freq: mf, freq2: mf * 0.997, glide: 0.6, gain: 0.05, atk: 0.06, dec: rand(0.9, 1.6),
        }) + 0.1, ...v.nodes);
      }
      tails.push({ cg, at: t + span + 2 });
      cleanup(t + span + 2.2, cg, lp, blp);
    }
    const L = loopObj(nodes, (t) => {
      while (next < t + 0.9) { chord(next); idx++; next += step; }
      for (let i = tails.length - 1; i >= 0; i--) if (tails[i].at < t - 0.4) tails.splice(i, 1);
    });
    L.stop = () => {                               // fade the scheduled tails out
      const t = ctx.currentTime;
      for (const s of tails) {
        try { s.cg.gain.cancelScheduledValues(t); s.cg.gain.setTargetAtTime(0.0001, t, 0.06); } catch (e) { /* ignore */ }
      }
      tails.length = 0;
      kill(nodes);
    };
    return L;
  }
  function startFan(o) {                           // whoosh + hum + blade AM
    let speed = clamp(num(o && o.speed, params.fanSpeed), 0, 3);
    const w = bed('white', 3, 'lowpass', 600, 0.9, 0.16, bus('loop'));
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth'; hum.frequency.value = 60;
    const hlp = bq('lowpass', 240, 0.8), hg = ctx.createGain();
    hum.connect(hlp); hlp.connect(hg);
    const lfo = ctx.createOscillator();             // blade passing
    lfo.type = 'sine'; lfo.frequency.value = 5;
    const lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg); lg.connect(w.gain.gain); lg.connect(hg.gain);
    const lfo2 = ctx.createOscillator();            // slow wander
    lfo2.type = 'sine'; lfo2.frequency.value = 0.17;
    const lg2 = ctx.createGain(); lg2.gain.value = 0.03;
    lfo2.connect(lg2); lg2.connect(w.gain.gain);
    const mix = ctx.createGain();
    w.gain.connect(mix); hg.connect(mix); mix.connect(bus('loop'));
    const t0 = ctx.currentTime;
    try { hum.start(t0); lfo.start(t0); lfo2.start(t0); } catch (e) { /* ignore */ }
    const nodes = w.nodes.concat([hum, hlp, hg, lfo, lg, lfo2, lg2, mix]);
    const fan = loopObj(nodes, null);
    fan.apply = (v, tc) => {                        // smooth ramp on fanSpeed
      speed = clamp(num(v, speed), 0, 3);
      const t = ctx.currentTime, k = Math.max(0.02, num(tc, 0.12)), base = 0.16 + 0.1 * speed;
      const ramp = (p, val) => p.setTargetAtTime(val, t, k);
      ramp(w.filter.frequency, 240 + speed * 460);  // whoosh brightness
      ramp(lfo.frequency, 1.3 + speed * 3.3);       // blade rate
      ramp(lg.gain, base * 0.55); ramp(lg2.gain, base * 0.18);
      ramp(w.gain.gain, base); ramp(w.src.playbackRate, 0.85 + speed * 0.12);
      ramp(hum.frequency, 46 + speed * 15); ramp(hg.gain, 0.012 + speed * 0.028);
    };
    fan.setOpts = (no) => { if (no && no.speed != null) fan.apply(no.speed, 0.2); };
    fan.apply(speed, 0.05);
    return fan;
  }
  function startNight() {                          // room tone + crickets
    const tone = bed('brown', 4, 'lowpass', 260, 0.8, 0.05);
    const air = bed('white', 3, 'highpass', 3000, 0.7, 0.006);
    let next = ctx.currentTime + rand(0.3, 1.4);
    return loopObj(tone.nodes.concat(air.nodes), (t) => {
      while (next < t + 1.2) {
        if (next > t + 0.01) cricket(next);
        next += rand(0.45, 2.2);
      }
    });
  }
  function startDay() {                            // room tone + soft birds
    const tone = bed('pink', 4, 'lowpass', 520, 0.8, 0.035);
    let next = ctx.currentTime + rand(1.5, 4);
    return loopObj(tone.nodes, (t) => {
      while (next < t + 3) {
        if (next > t + 0.01) bird(next);
        next += rand(2.2, 7.5);
      }
    });
  }
  function startTick() {                           // one mechanical tick per second
    let alt = false, next = ctx.currentTime + 0.2;
    return loopObj([], (t) => {
      while (next < t + 0.4) {
        if (next > t + 0.005) tickAt(next, alt);
        next += 1; alt = !alt;
      }
    });
  }
  function startRain(o) {                          // soft rain, slow wander
    const inten = clamp(num(o && o.intensity, 0.6), 0, 1);
    const rain = bed('white', 4, 'bandpass', 1400, 0.35, 0.0001);
    const l1 = ctx.createOscillator(); l1.type = 'sine'; l1.frequency.value = 0.06;
    const l1g = ctx.createGain(); l1g.gain.value = 600;
    l1.connect(l1g); l1g.connect(rain.filter.frequency);
    const l2 = ctx.createOscillator(); l2.type = 'sine'; l2.frequency.value = 0.11;
    const l2g = ctx.createGain(); l2g.gain.value = 0.012;
    l2.connect(l2g); l2g.connect(rain.gain.gain);
    const t0 = ctx.currentTime;
    try { l1.start(t0); l2.start(t0); } catch (e) { /* ignore */ }
    rain.gain.gain.setTargetAtTime(0.022 + 0.03 * inten, t0, 0.8);
    return loopObj(rain.nodes.concat([l1, l1g, l2, l2g]), null);
  }
  function startLoop(name, o) {
    let L = null;
    switch (name) {
      case 'vinyl': L = startVinyl(o); break;
      case 'music': L = startMusic(); break;
      case 'fan': L = startFan(o); break;
      case 'night': L = startNight(); break;
      case 'day': L = startDay(); break;
      case 'tick': L = startTick(); break;
      case 'rain': L = startRain(o); break;
      default: return null;
    }
    if (L) loops.set(name, L);
    return L;
  }

  /* Watchdog: only advances the schedulers if update() goes quiet. */
  function pump() {
    if (!isLive()) return;
    try {
      const t = ctx.currentTime;
      for (const L of loops.values()) if (L && typeof L.sched === 'function') L.sched(t);
    } catch (e) { /* ignore */ }
  }
  function syncWatchdog() {
    let need = false;
    for (const L of loops.values()) if (L && typeof L.sched === 'function') need = true;
    if (need && !timer && typeof setInterval === 'function') {
      timer = setInterval(() => {
        try {
          if (!isLive() || Date.now() - lastUpdate < 400) return;
          pump();
        } catch (e) { /* ignore */ }
      }, 400);
    } else if (!need && timer) { clearInterval(timer); timer = null; }
  }
  function applyWanted() {
    if (!isLive()) return;
    for (const [name, o] of want) {
      if (!o) continue;
      const cur = loops.get(name);
      if (cur) { if (cur.setOpts) cur.setOpts(o); } else startLoop(name, o);
    }
    syncWatchdog();
  }
  function applyMaster() {
    if (!master) return;
    try { master.gain.setTargetAtTime(muted ? 0 : masterVol, ctx.currentTime, 0.02); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------- public API */
  function unlock() {
    try {
      const c = ensure();
      if (!c) return;
      const go = () => { try { applyWanted(); } catch (e) { /* ignore */ } };
      if (c.state === 'running') { go(); return; }
      if (typeof c.resume === 'function') {
        const p = c.resume();
        if (p && typeof p.then === 'function') p.then(go, () => {});
        else go();
      } else go();
    } catch (e) { /* silent */ }
  }
  function sfx(name, opts) {
    try {
      if (!isLive()) return;
      const f = SFX[name];
      if (typeof f === 'function') f(opts || {});
    } catch (e) { /* silent */ }
  }
  function setLoop(name, on, opts) {
    try {
      const o = opts || {};
      if (!on) {
        want.set(name, null);
        const cur = loops.get(name);
        if (cur) { try { cur.stop(); } catch (e) { /* ignore */ } loops.delete(name); }
        syncWatchdog();
        return;
      }
      want.set(name, o);
      if (!isLive()) return;                       // remembered, applied on unlock()
      const cur = loops.get(name);
      if (cur) { if (cur.setOpts) cur.setOpts(o); } else startLoop(name, o);
      syncWatchdog();
    } catch (e) { /* silent */ }
  }
  function param(name, value) {
    try {
      if (name === 'fanSpeed') {
        params.fanSpeed = clamp(num(value, params.fanSpeed), 0, 3);
        const L = loops.get('fan');
        if (L && L.apply) L.apply(params.fanSpeed, 0.18);
      } else if (name === 'musicVol') {
        params.musicVol = clamp01(value);
        if (buses.mus) buses.mus.gain.setTargetAtTime(params.musicVol, ctx.currentTime, 0.08);
      } else if (name === 'ambienceVol') {
        params.ambienceVol = clamp01(value);
        if (buses.amb) buses.amb.gain.setTargetAtTime(params.ambienceVol, ctx.currentTime, 0.08);
      }
    } catch (e) { /* silent */ }
  }
  function setMasterVolume(v) {
    try { masterVol = clamp01(v); applyMaster(); } catch (e) { /* silent */ }
  }
  function setMuted(b) {
    try { muted = !!b; applyMaster(); } catch (e) { /* silent */ }
  }
  function isMuted() { return muted; }
  function update(dt) {
    try {
      if (!isLive()) return;
      lastUpdate = Date.now();
      pump();
    } catch (e) { /* silent */ }
  }
  function dispose() {
    try {
      disposed = true;
      for (const L of loops.values()) { try { if (L && L.stop) L.stop(); } catch (e) { /* ignore */ } }
      loops.clear(); want.clear();
      if (timer) { clearInterval(timer); timer = null; }
      for (const [id, nodes] of pending) { clearTimeout(id); disc(nodes); }
      pending.clear();
      disc(graph); graph.length = 0; noiseCache.clear();
      if (ctx) {
        try {
          if (ctx.state !== 'closed' && typeof ctx.close === 'function') {
            const p = ctx.close();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        } catch (e) { /* ignore */ }
      }
      ctx = null; master = null; limiter = null; revSend = null; revRet = null;
    } catch (e) { /* silent */ }
  }
  return { unlock, sfx, setLoop, param, setMasterVolume, setMuted, isMuted, update, dispose };
}

export default createAudio;
