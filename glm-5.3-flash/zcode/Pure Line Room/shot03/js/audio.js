/* 线之屋 · Web Audio 合成音效（全部本地合成，无音频文件） */
(function () {
  let ctx = null, master, sfxBus, ambBus, musBus, noiseBuf;
  let started = false, muted = false;
  const A = { ready: false, muted: false };
  const loops = {};
  let musicOn = false, musTimer = null, nextT = 0, step = 0, birdTimer = null;

  function init() {
    if (started) return;
    started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.9; ambBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0; musBus.connect(master);
    const len = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    buildAmbience();
    A.ready = true;
  }
  A.init = init;

  function now() { return ctx ? ctx.currentTime : 0; }
  function pan(node, p) {
    if (!ctx.createStereoPanner) { node.connect(p === undefined ? sfxBus : sfxBus); return; }
    const sp = ctx.createStereoPanner(); sp.pan.value = p == null ? 0 : p;
    node.connect(sp); sp.connect(p === 'amb' ? ambBus : sfxBus);
  }

  function osc(type, f, t0, dur, peak, dest, a) {
    if (!ctx) return null;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return { o, g };
  }
  function noise(t0, dur, peak, dest, f) {
    if (!ctx) return null;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    let n = s;
    if (f) {
      const flt = ctx.createBiquadFilter();
      flt.type = f.type || 'bandpass';
      flt.frequency.setValueAtTime(f.f || 1000, t0);
      if (f.q) flt.Q.value = f.q;
      if (f.fEnd) flt.frequency.exponentialRampToValueAtTime(Math.max(30, f.fEnd), t0 + dur);
      n.connect(flt); n = flt;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (f && f.a || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(g); g.connect(dest || sfxBus);
    s.start(t0, Math.random() * 1.2); s.stop(t0 + dur + 0.05);
    return { s, g };
  }

  /* ---- 环境声 ---- */
  let gBreeze, gCricket, cricketGate;
  function buildAmbience() {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    gBreeze = ctx.createGain(); gBreeze.gain.value = 0.014;
    s.connect(lp); lp.connect(gBreeze); gBreeze.connect(ambBus); s.start();
    // 蟋蟀：载波被 22Hz 方波门控
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    cricketGate = ctx.createGain(); cricketGate.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 23;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    const base = ctx.createConstantSource ? ctx.createConstantSource() : null;
    if (base) { base.offset.value = 0.5; base.connect(cricketGate.gain); base.start(); }
    else cricketGate.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(cricketGate.gain); lfo.start();
    gCricket = ctx.createGain(); gCricket.gain.value = 0;
    cr.connect(cricketGate); cricketGate.connect(gCricket); gCricket.connect(ambBus);
    cr.start();
    // 白天鸟鸣（调度）
    birdTimer = setInterval(() => {
      if (!A.ready || A.muted || musicOn || RLR.Engine.env.t > 0.4) return;
      if (Math.random() < 0.55) bird();
    }, 8000);
  }
  function bird() {
    const t0 = now() + 0.1, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.16 + Math.random() * 0.05;
      const f = 2400 + Math.random() * 900;
      const o = osc('sine', f, t, 0.09, 0.018);
      if (o) {
        o.o.frequency.setValueAtTime(f, t);
        o.o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.05);
        o.o.frequency.linearRampToValueAtTime(f * 0.95, t + 0.09);
        pan(o.g, Math.random() * 1.6 - 0.8);
      }
    }
  }
  A.setNight = function (t) {
    if (!ctx) return;
    const tm = now();
    gBreeze.gain.setTargetAtTime(0.016 - t * 0.006, tm, 0.5);
    gCricket.gain.setTargetAtTime(t * 0.011, tm, 0.5);
  };
  A.tick = function () {
    if (!ctx || A.muted) return;
    const t0 = now();
    noise(t0, 0.015, 0.028, null, { type: 'highpass', f: 3200 });
    osc('square', 1700, t0, 0.02, 0.012);
  };

  /* ---- 音效库 ---- */
  const fx = {
    click() { osc('square', 1900, now(), 0.03, 0.05); noise(now(), 0.02, 0.04, null, { type: 'highpass', f: 3000 }); },
    snap() { const t = now(); noise(t, 0.03, 0.10, null, { type: 'bandpass', f: 2400, q: 1.4 }); osc('square', 640, t, 0.045, 0.05); },
    latch() { const t = now(); noise(t, 0.045, 0.09, null, { type: 'bandpass', f: 1300, q: 2 }); osc('sine', 220, t + 0.02, 0.06, 0.08); },
    thud(o) { const t = now(), p = (o && o.pitch) || 1;
      const x = osc('sine', 130 * p, t, 0.16, 0.22);
      if (x) x.o.frequency.exponentialRampToValueAtTime(52 * p, t + 0.14);
      noise(t, 0.05, 0.07, null, { type: 'lowpass', f: 500 }); },
    slide(o) { const d = (o && o.dur) || 0.35, t = now();
      noise(t, d, 0.045, null, { type: 'bandpass', f: 950, fEnd: 480, q: 1.6, a: 0.05 });
      noise(t, d, 0.03, null, { type: 'lowpass', f: 260, a: 0.06 }); },
    creak(o) { const d = (o && o.dur) || 0.7, t = now();
      for (let i = 0; i < 2; i++) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14;
        const f0 = 300 + i * 140 + Math.random() * 90;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.linearRampToValueAtTime(f0 * (0.75 + Math.random() * 0.2), t + d);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5 + i * 2.3;
        const lg = ctx.createGain(); lg.gain.value = 90;
        lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t); lfo.stop(t + d + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(i ? 0.045 : 0.085, t + 0.07);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(bp); bp.connect(g); g.connect(sfxBus);
        s.start(t, Math.random()); s.stop(t + d + 0.05);
      } },
    scrape(o) { const d = (o && o.dur) || 0.4, t = now();
      noise(t, d, 0.05, null, { type: 'bandpass', f: 1300, fEnd: 900, q: 2.2, a: 0.04 });
      noise(t, d, 0.03, null, { type: 'lowpass', f: 300, a: 0.05 }); },
    cloth(o) { const d = (o && o.dur) || 0.5, t = now();
      noise(t, d, 0.055, null, { type: 'lowpass', f: 850, fEnd: 380, a: 0.05 }); },
    flick() { noise(now(), 0.05, 0.07, null, { type: 'highpass', f: 1700 }); },
    puff() { noise(now(), 0.2, 0.09, null, { type: 'lowpass', f: 620, fEnd: 190, a: 0.012 }); },
    pop() { const t = now(); const x = osc('sine', 330, t, 0.1, 0.13); if (x) x.o.frequency.exponentialRampToValueAtTime(85, t + 0.09); },
    tink(o) { const f = (o && o.f) || 2093, t = now();
      osc('sine', f, t, 0.4, 0.045); osc('sine', f * 2.76, t, 0.14, 0.016); },
    sparkle() { const t = now(), fs = [880, 1108.7, 1318.5, 1760, 2217.5];
      fs.forEach((f, i) => { osc('sine', f, t + i * 0.07, 0.3, 0.035); }); },
    rustle() { const t = now();
      for (let i = 0; i < 4; i++) noise(t + i * 0.09, 0.07, 0.035, null, { type: 'lowpass', f: 1400, a: 0.015 }); },
    servo() { const t = now();
      const x = osc('sawtooth', 140, t, 0.32, 0.035, null, 0.03);
      if (x) { x.o.frequency.linearRampToValueAtTime(195, t + 0.14); x.o.frequency.linearRampToValueAtTime(150, t + 0.3); }
      noise(t, 0.3, 0.02, null, { type: 'lowpass', f: 700, a: 0.05 }); },
    flip() { const t = now(); noise(t, 0.06, 0.06, null, { type: 'highpass', f: 1400 });
      noise(t + 0.08, 0.07, 0.05, null, { type: 'bandpass', f: 2000, q: 1.5 }); }
  };
  A.play = function (name, opts) {
    if (!ctx || A.muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (fx[name]) fx[name](opts || {});
  };

  /* ---- 风铃 ---- */
  A.chime = function (strength) {
    if (!ctx || A.muted) return;
    const t0 = now() + 0.02, n = 2 + Math.floor(Math.random() * 3);
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.16 + Math.random() * 0.12);
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
      const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
      const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.01;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * 1.6, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 1.4);
      mod.connect(mg); mg.connect(car.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075 * strength, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      let tail = g;
      if (ctx.createStereoPanner) {
        const sp = ctx.createStereoPanner(); sp.pan.value = Math.random() * 1.4 - 0.7;
        g.connect(sp); tail = sp;
      }
      tail.connect(sfxBus);
      car.start(t); car.stop(t + 3); mod.start(t); mod.stop(t + 3);
    }
  };

  /* ---- 吊扇 ---- */
  A.fan = function (s01) {
    if (!ctx) return;
    const t = now();
    if (s01 <= 0.01) {
      if (loops.fan) {
        loops.fan.g.gain.setTargetAtTime(0.0001, t, 0.4);
        loops.fan.hum.gain.setTargetAtTime(0.0001, t, 0.4);
        const f = loops.fan; loops.fan = null;
        setTimeout(() => { try { f.s.stop(); f.h.stop(); } catch (e) {} }, 2000);
      }
      return;
    }
    if (!loops.fan) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      s.connect(lp); lp.connect(g); g.connect(ambBus); s.start();
      const h = ctx.createOscillator(); h.type = 'sine'; h.frequency.value = 90;
      const hum = ctx.createGain(); hum.gain.value = 0.0001;
      h.connect(hum); hum.connect(ambBus); h.start();
      loops.fan = { s, g, lp, h, hum };
    }
    const f = loops.fan;
    f.lp.frequency.setTargetAtTime(240 + 480 * s01, t, 0.3);
    f.g.gain.setTargetAtTime(0.02 + 0.075 * s01, t, 0.3);
    f.h.frequency.setTargetAtTime(88 + 40 * s01, t, 0.3);
    f.hum.gain.setTargetAtTime(0.008 + 0.018 * s01, t, 0.3);
  };

  /* ---- 台灯哼鸣 ---- */
  A.lampHum = function (on) {
    if (!ctx) return;
    const t = now();
    if (on && !loops.hum) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 100;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 200;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(ambBus);
      o.start(); o2.start();
      loops.hum = { o, o2, g };
    }
    if (loops.hum) loops.hum.g.gain.setTargetAtTime(on ? 0.006 : 0.0001, t, 0.25);
  };

  /* ---- 唱片机：生成式五声音阶 + 唱片噪声 ---- */
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  const BASS = [130.81, 98.0, 110.0, 87.31];
  let melIdx = 3;
  function pluck(f, t, vol, dur) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = f * (1 + (Math.random() * 10 - 5) / 6900);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(musBus);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function crackle(t) {
    const k = Math.random();
    if (k < 0.55) noise(t, 0.012, 0.012 + Math.random() * 0.03, musBus, { type: 'bandpass', f: 3000, q: 1 });
  }
  function schedule() {
    if (!musicOn) return;
    while (nextT < now() + 0.4) {
      const t = nextT;
      if (Math.random() < 0.74) {
        melIdx = Math.max(0, Math.min(SCALE.length - 1, melIdx + Math.floor(Math.random() * 5) - 2));
        pluck(SCALE[melIdx], t + Math.random() * 0.012, 0.085, 0.75);
      }
      if (step % 8 === 0) pluck(BASS[(step / 8) % 4], t, 0.06, 1.6);
      crackle(t); crackle(t + 0.16);
      step++; nextT += 0.32;
    }
  }
  A.music = function (on) {
    if (!ctx) return;
    musicOn = on;
    const t = now();
    if (on) {
      if (!loops.crackle) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
        const g = ctx.createGain(); g.gain.value = 0.004;
        s.connect(hp); hp.connect(g); g.connect(musBus); s.start();
        loops.crackle = { s, g };
      }
      if (musTimer) clearInterval(musTimer);
      nextT = t + 0.15; step = 0;
      musTimer = setInterval(schedule, 120);
    }
    musBus.gain.setTargetAtTime(on ? 0.55 : 0, t, on ? 0.5 : 0.6);
  };

  A.toggleMute = function () {
    muted = !muted; A.muted = muted;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.1);
    return muted;
  };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  window.RLR = window.RLR || {};
  RLR.Audio = A;
})();
