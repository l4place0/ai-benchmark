/* 纯线房间 — 音频系统：全部 Web Audio 运行时合成（零外部资源）
 * 总线：voice → (panner) → master → compressor → destination
 * 房间感：voice --send--> roomIn → delay(0.16s) → lowpass →(+fb 0.32 回环)→ master
 * 循环层 fan / vinyl / amb / tick：loopSet 可每帧调用（状态去抖 + 短 ramp 防爆音）。
 * ctx 未解锁前一切调用静默安全。 */
(function () {
  'use strict';
  const PLR = window.PLR;

  let ctx = null;        // AudioContext（unlock 后创建）
  let master = null;     // 总增益（静音在此平滑 ramp）
  let roomIn = null;     // 房间感 send 总线入口
  let muted = false;

  let whiteBuf = null, pinkBuf = null, brownBuf = null;
  let satCurve = null;

  const now = () => (ctx ? ctx.currentTime : 0);
  const clamp = (v, a, b) => (PLR.clamp ? PLR.clamp(v, a, b) : v < a ? a : v > b ? b : v);
  const rand = (a, b) => (PLR.rand ? PLR.rand(a, b) : a + Math.random() * (b - a));

  /* ============================ 基础小工具 ============================ */
  function noiseSrc(buf, loop) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop !== false;
    return s;
  }
  function filt(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }
  function gn(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function osc(type, freq) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; }

  // 声像：无 StereoPanner 时返回 null（直连降级）
  function makePan(v) {
    if (!ctx.createStereoPanner) return null;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(v, -1, 1);
    return p;
  }
  function setPan(p, v, tc) {
    if (!p) return;
    if (!isFinite(v)) v = 0; // 首帧相机矩阵未就绪时 panOf 可能产生 NaN
    if (tc) p.pan.setTargetAtTime(clamp(v, -1, 1), now(), tc);
    else p.pan.value = clamp(v, -1, 1);
  }
  // 串接节点链（跳过 null），尾节点接 dest
  function wire(nodes, dest) {
    let prev = null;
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i]) continue;
      if (prev) prev.connect(nodes[i]);
      prev = nodes[i];
    }
    if (prev && dest && prev !== dest) prev.connect(dest);
  }
  // 去抖 ramp：值几乎没变就不动；从当前实际值线性滑到目标（防爆音）
  function rampTo(p, v, dur) {
    if (Math.abs(p.value - v) < 0.0008) return;
    const t = now();
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + dur);
  }
  // 一次性声源结束后的节点回收
  function autoGC(src, nodes) {
    src.onended = function () {
      for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* 已断开 */ } }
    };
  }

  /* ============================ 主链 / 房间感 / 噪声库 ============================ */
  function buildGraph() {
    master = gn(muted ? 0 : 1);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;
    master.connect(comp);
    comp.connect(ctx.destination);

    // 廉价“房间感”：单延迟 slap 版混响（send 总线）
    roomIn = gn(1);
    const dl = ctx.createDelay(0.5);
    dl.delayTime.value = 0.16;
    const lp = filt('lowpass', 2400, 0.4);
    const fb = gn(0.32);
    const wet = gn(0.5);
    roomIn.connect(dl);
    dl.connect(lp);
    lp.connect(fb); fb.connect(dl);   // 反馈回路（内含低通，逐次变暗）
    lp.connect(wet); wet.connect(master);

    makeBuffers();
  }

  function makeBuffers() {
    const sr = ctx.sampleRate, len = 2 * sr;
    whiteBuf = ctx.createBuffer(1, len, sr);
    const wd = whiteBuf.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    // 粉噪声（Paul Kellet 滤波器）
    pinkBuf = ctx.createBuffer(1, len, sr);
    const pd = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // 棕噪声（积分白噪声）
    brownBuf = ctx.createBuffer(1, len, sr);
    const nd = brownBuf.getChannelData(0);
    let lastV = 0;
    for (let i = 0; i < len; i++) {
      lastV = (lastV + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      nd[i] = lastV * 3.2;
    }
  }

  function getSatCurve() {
    if (!satCurve) {
      satCurve = new Float32Array(257);
      for (let i = 0; i <= 256; i++) satCurve[i] = Math.tanh(1.6 * ((i / 128) - 1));
    }
    return satCurve;
  }

  /* ============================ 一次性音效：通用件 ============================ */
  // 线性包络 pts = [[dt, value], ...]
  function lenv(param, t, pts) {
    param.setValueAtTime(pts[0][1], t + pts[0][0]);
    for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t + pts[i][0]);
  }

  // 噪声颗粒：src → filter → 包络 → bus；o = {buf,type,f0,f1,q,t,dur,peak,a}
  function burst(bus, nodes, o) {
    const n = noiseSrc(o.buf || whiteBuf);
    const f = filt(o.type || 'bandpass', o.f0, o.q !== undefined ? o.q : 1);
    const g = gn(0);
    if (o.f1) {
      f.frequency.setValueAtTime(o.f0, o.t);
      f.frequency.linearRampToValueAtTime(o.f1, o.t + o.dur);
    }
    const a = o.a !== undefined ? o.a : Math.min(0.008, o.dur * 0.3);
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.peak, o.t + a);
    g.gain.linearRampToValueAtTime(0, o.t + o.dur);
    n.connect(f); f.connect(g); g.connect(bus);
    n.start(o.t, rand(0, 1.7));
    n.stop(o.t + o.dur + 0.03);
    nodes.push(n, f, g);
    return n;
  }

  // 单音：osc → 包络 → bus；o = {type,f0,f1,fT,t,dur,peak,a,tau}
  // tau 存在时：快起 + 指数衰减（打击/铃音），否则线性进出
  function tone(bus, nodes, o) {
    const s = osc(o.type || 'sine', o.f0);
    const g = gn(0.0001);
    if (o.f1) {
      s.frequency.setValueAtTime(o.f0, o.t);
      s.frequency.linearRampToValueAtTime(o.f1, o.t + (o.fT || o.dur));
    }
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, o.t);
    if (o.tau) {
      g.gain.exponentialRampToValueAtTime(Math.max(o.peak, 0.0002), o.t + a);
      g.gain.setTargetAtTime(0.0001, o.t + a, o.tau);
    } else {
      g.gain.linearRampToValueAtTime(o.peak, o.t + a);
      g.gain.linearRampToValueAtTime(0, o.t + o.dur);
    }
    s.connect(g); g.connect(bus);
    s.start(o.t);
    s.stop(o.t + o.dur + (o.tau ? o.tau * 6 : 0.03));
    nodes.push(s, g);
    return s;
  }

  // 一次性音效统一出口：bus → (panner) → master，另送房间总线；最后一个声源负责回收
  function finishShot(bus, p, nodes, lastSrc) {
    const panN = Math.abs(p.pan) > 0.001 ? makePan(p.pan) : null;
    wire([bus, panN], master);
    if (panN) nodes.push(panN);
    if (p.send > 0.001 && roomIn) {
      const s = gn(p.send);
      bus.connect(s);
      s.connect(roomIn);
      nodes.push(s);
    }
    if (lastSrc) autoGC(lastSrc, nodes);
  }

  // 钟式发声体：基音 + 2.7 倍分音（bell 用）
  function bellVoice(bus, nodes, ts, f, vol, dec) {
    const mk = (mul, v, d) => {
      const o = osc('sine', f * mul);
      o.detune.value = rand(-3, 3);
      const g = gn(0.0001);
      g.gain.setValueAtTime(0.0001, ts);
      g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), ts + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0004, ts + d);
      o.connect(g); g.connect(bus);
      o.start(ts); o.stop(ts + d + 0.08);
      nodes.push(o, g);
      return o;
    };
    mk(2.7, vol * 0.28, dec * 0.4);
    return mk(1, vol, dec);
  }

  /* ============================ 一次性音效：各合成器 ============================ */
  // click：25ms 带通噪声(2400) + 1800→1400 正弦 blip，轻快
  function sfxClick(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    burst(bus, nodes, { type: 'bandpass', f0: 2400 * p.rate, q: 1.4, t, dur: 0.025 * k, peak: 0.15 * p.g });
    const last = tone(bus, nodes, { f0: 1800 * p.rate, f1: 1400 * p.rate, t, dur: 0.05 * k, peak: 0.2 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // clack：低通噪声(900, 45ms) + 140Hz 正弦 thump(80ms)，开关手感
  function sfxClack(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    burst(bus, nodes, { type: 'lowpass', f0: 900 * p.rate, q: 0.7, t, dur: 0.045 * k, peak: 0.22 * p.g });
    const last = tone(bus, nodes, { f0: 140 * p.rate, f1: 92 * p.rate, t, dur: 0.08 * k, peak: 0.26 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // creak：门轴吱呀——锯齿 160→95Hz + 8Hz±12Hz 颤音 + 少量带通噪声
  function sfxCreak(p) {
    const t = now(), k = 1 / p.rate, dur = 0.7 * k;
    const bus = gn(1), nodes = [bus];
    const o = osc('sawtooth', 160 * p.rate);
    o.frequency.setValueAtTime(160 * p.rate, t);
    o.frequency.linearRampToValueAtTime(95 * p.rate, t + dur);
    const lfo = osc('sine', 8 * p.rate), lg = gn(12 * p.rate);
    lfo.connect(lg); lg.connect(o.frequency);
    const lp = filt('lowpass', 1100, 0.5), g = gn(0);
    lenv(g.gain, t, [[0, 0], [0.14 * k, 0.11 * p.g], [0.45 * k, 0.06 * p.g], [0.62 * k, 0.095 * p.g], [dur, 0]]);
    o.connect(lp); lp.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    nodes.push(o, lfo, lg, lp, g);
    const last = burst(bus, nodes, { type: 'bandpass', f0: 720 * p.rate, q: 1.1, t, dur: dur * 0.85, peak: 0.022 * p.g, a: 0.1 * k });
    finishShot(bus, p, nodes, last);
  }

  // latch：短 click + 90Hz 快速 thump，锁扣到位
  function sfxLatch(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    burst(bus, nodes, { type: 'bandpass', f0: 2400 * p.rate, q: 1.5, t, dur: 0.02 * k, peak: 0.1 * p.g });
    const last = tone(bus, nodes, { f0: 90 * p.rate, f1: 60 * p.rate, t, dur: 0.075 * k, peak: 0.24 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // slide：0.32s 带通噪声 500→900Hz 扫频，淡入淡出
  function sfxSlide(p) {
    const t = now(), k = 1 / p.rate, dur = 0.32 * k;
    const bus = gn(1), nodes = [bus];
    const last = burst(bus, nodes, { type: 'bandpass', f0: 500 * p.rate, f1: 900 * p.rate, q: 1, t, dur, peak: 0.16 * p.g, a: 0.08 * k });
    finishShot(bus, p, nodes, last);
  }

  // slideStop：短 slide(0.12s) + thunk 尾
  function sfxSlideStop(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    burst(bus, nodes, { type: 'bandpass', f0: 500 * p.rate, f1: 900 * p.rate, q: 1, t, dur: 0.12 * k, peak: 0.13 * p.g, a: 0.03 * k });
    const last = tone(bus, nodes, { f0: 110 * p.rate, f1: 70 * p.rate, t: t + 0.1 * k, dur: 0.1 * k, peak: 0.2 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // book：0.16s 高通噪声(1200)，很轻
  function sfxBook(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const last = burst(bus, nodes, { type: 'highpass', f0: 1200 * p.rate, q: 0.7, t, dur: 0.16 * k, peak: 0.07 * p.g, a: 0.04 * k });
    finishShot(bus, p, nodes, last);
  }

  // clink：2093 + 3520Hz 正弦短衰减 + 一点噪声，瓷杯轻碰
  function sfxClink(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    tone(bus, nodes, { f0: 2093 * p.rate, tau: 0.028, t, dur: 0.006, peak: 0.12 * p.g });
    tone(bus, nodes, { f0: 3520 * p.rate, tau: 0.02, t, dur: 0.005, peak: 0.055 * p.g });
    const last = burst(bus, nodes, { type: 'highpass', f0: 5500, q: 0.7, t, dur: 0.008 * k, peak: 0.045 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // plop：正弦 320→130Hz(0.15s) + 低通噪声(60ms)，软物落地
  function sfxPlop(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    tone(bus, nodes, { f0: 320 * p.rate, f1: 130 * p.rate, t, dur: 0.15 * k, peak: 0.2 * p.g, a: 0.005 });
    const last = burst(bus, nodes, { type: 'lowpass', f0: 420 * p.rate, q: 0.7, t, dur: 0.06 * k, peak: 0.1 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // squeak：700Hz±120 随机摆(0.22s)，很轻，弹簧吱呀
  function sfxSqueak(p) {
    const t = now(), k = 1 / p.rate, dur = 0.22 * k;
    const bus = gn(1), nodes = [bus];
    const o = osc('sine', 700 * p.rate);
    o.frequency.setValueAtTime(700 * p.rate, t);
    for (let i = 1; i <= 4; i++) o.frequency.linearRampToValueAtTime((700 + rand(-120, 120)) * p.rate, t + (dur * i) / 4);
    const g = gn(0);
    lenv(g.gain, t, [[0, 0], [0.03 * k, 0.05 * p.g], [dur * 0.7, 0.04 * p.g], [dur, 0]]);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    nodes.push(o, g);
    finishShot(bus, p, nodes, o);
  }

  // flip：带通噪声 1200→2400Hz 扫(0.2s)，翻页
  function sfxFlip(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const last = burst(bus, nodes, { type: 'bandpass', f0: 1200 * p.rate, f1: 2400 * p.rate, q: 0.9, t, dur: 0.2 * k, peak: 0.14 * p.g, a: 0.05 * k });
    finishShot(bus, p, nodes, last);
  }

  // swish：带通噪声 600→1200→800Hz(0.3s) 柔，布料/挥动
  function sfxSwish(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const n = noiseSrc(whiteBuf);
    const bp = filt('bandpass', 600 * p.rate, 0.8);
    const g = gn(0);
    bp.frequency.setValueAtTime(600 * p.rate, t);
    bp.frequency.linearRampToValueAtTime(1200 * p.rate, t + 0.14 * k);
    bp.frequency.linearRampToValueAtTime(800 * p.rate, t + 0.3 * k);
    lenv(g.gain, t, [[0, 0], [0.1 * k, 0.12 * p.g], [0.18 * k, 0.1 * p.g], [0.3 * k, 0]]);
    n.connect(bp); bp.connect(g); g.connect(bus);
    n.start(t, rand(0, 1.5)); n.stop(t + 0.33 * k);
    nodes.push(n, bp, g);
    finishShot(bus, p, nodes, n);
  }

  // chime：风铃管——基音 1050*rate + 2.76 + 5.4 分音，指数衰减 1.8s，轻微失谐
  function sfxChime(p) {
    const t = now();
    const bus = gn(1), nodes = [bus];
    const base = 1050 * p.rate;
    const parts = [[1, 0.16, 1], [2.76, 0.05, 0.72], [5.4, 0.026, 0.5]];
    let last = null;
    for (let i = 0; i < parts.length; i++) {
      const mul = parts[i][0], vol = parts[i][1], dec = parts[i][2];
      const o = osc('sine', base * mul);
      o.detune.value = rand(-6, 6);
      const g = gn(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(vol * p.g, 0.0002), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 1.8 * dec);
      o.connect(g); g.connect(bus);
      o.start(t); o.stop(t + 1.8 * dec + 0.1);
      nodes.push(o, g);
      last = o;
    }
    burst(bus, nodes, { type: 'highpass', f0: 5000, q: 0.7, t, dur: 0.006, peak: 0.04 * p.g });
    finishShot(bus, p, nodes, last);
  }

  // bell：三音动机 E5→C5→G4(低八度)，每音隔 0.26s，钟式音色（正弦+2.7 分音，衰减 1.2s）
  function sfxBell(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const notes = [659.26, 523.25, 392.0];
    let last = null;
    for (let i = 0; i < 3; i++) {
      last = bellVoice(bus, nodes, t + i * 0.26 * k, notes[i] * p.rate, 0.13 * p.g, 1.2 * k);
    }
    finishShot(bus, p, nodes, last);
  }

  // rustle：0.4s 内 6~8 个高通噪声小颗粒，叶擦声
  function sfxRustle(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const n = noiseSrc(whiteBuf);
    const hp = filt('highpass', rand(1800, 2600), 0.7);
    const g = gn(0);
    g.gain.setValueAtTime(0, t);
    const cnt = 6 + Math.floor(rand(0, 2.99));
    let tt = t + rand(0, 0.04);
    for (let i = 0; i < cnt; i++) {
      const d = rand(0.02, 0.05) * k;
      g.gain.linearRampToValueAtTime(rand(0.025, 0.06) * p.g, tt + d * 0.35);
      g.gain.linearRampToValueAtTime(0, tt + d);
      tt += d * rand(0.9, 1.6);
    }
    n.connect(hp); hp.connect(g); g.connect(bus);
    n.start(t, rand(0, 1.5)); n.stop(tt + 0.05);
    nodes.push(n, hp, g);
    finishShot(bus, p, nodes, n);
  }

  // pop：正弦上滑 300→520Hz(60ms)，起跳
  function sfxPop(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    const last = tone(bus, nodes, { f0: 300 * p.rate, f1: 520 * p.rate, t, dur: 0.06 * k, peak: 0.16 * p.g, a: 0.004 });
    finishShot(bus, p, nodes, last);
  }

  // thunk：80Hz 正弦衰减(0.12s) + 低通噪声(40ms)，重物落位
  function sfxThunk(p) {
    const t = now(), k = 1 / p.rate;
    const bus = gn(1), nodes = [bus];
    tone(bus, nodes, { f0: 80 * p.rate, tau: 0.035, t, dur: 0.005, peak: 0.24 * p.g });
    const last = burst(bus, nodes, { type: 'lowpass', f0: 260 * p.rate, q: 0.7, t, dur: 0.04 * k, peak: 0.12 * p.g });
    finishShot(bus, p, nodes, last);
  }

  const SHOT = {
    click: sfxClick, clack: sfxClack, creak: sfxCreak, latch: sfxLatch,
    slide: sfxSlide, slideStop: sfxSlideStop, book: sfxBook, clink: sfxClink,
    plop: sfxPlop, squeak: sfxSqueak, flip: sfxFlip, swish: sfxSwish,
    chime: sfxChime, bell: sfxBell, rustle: sfxRustle, pop: sfxPop, thunk: sfxThunk,
  };

  function play(name, opts) {
    if (!ctx || muted) return;
    const fn = SHOT[name];
    if (!fn) return;
    const o = opts || {};
    const p = {
      rate: o.rate > 0 ? o.rate : 1,
      gain: clamp(o.gain !== undefined && o.gain !== null ? o.gain : 1, 0, 2),
      pan: clamp(o.pan || 0, -1, 1),
      send: (name === 'chime' || name === 'bell') ? 0.3 : 0.12,   // 房间感送量
    };
    p.g = isFinite(p.gain) ? p.gain : 1; // 音效函数内部约定用 p.g
    fn(p);
  }

  /* ============================ 循环层：fan ============================ */
  // 粉噪声→低通 420 + 10Hz 叶片拍频调幅（深度 0.35）；off 时 0.8s 淡出后停源
  const fanLoop = { st: { on: false, gain: 0, pan: 0 }, built: false, running: false, stopTimer: 0 };
  fanLoop.build = function () {
    const L = fanLoop;
    L.lp = filt('lowpass', 420, 0.7);
    L.am = gn(0.65);                       // 基线 0.65 ± 0.35 调幅
    L.lfo = osc('sine', 10);
    L.lfoG = gn(0.35);
    L.lfo.connect(L.lfoG); L.lfoG.connect(L.am.gain);
    L.lfo.start();
    L.trim = gn(1.2);
    L.g = gn(0);
    L.panN = makePan(0);
    L.lp.connect(L.am); L.am.connect(L.trim); L.trim.connect(L.g);
    wire([L.g, L.panN], master);
  };
  function fanStart() {
    const L = fanLoop;
    L.src = noiseSrc(pinkBuf);
    L.src.connect(L.lp);
    L.src.start(now(), rand(0, 1.5));
    L.running = true;
  }
  fanLoop.apply = function () {
    const L = fanLoop, st = L.st;
    if (st.on) {
      if (L.stopTimer) { clearTimeout(L.stopTimer); L.stopTimer = 0; }
      if (!L.running) fanStart();
      rampTo(L.g.gain, clamp(st.gain, 0, 1.5), 0.15);   // gain 平滑跟随（0.15s ramp）
    } else if (L.running) {
      rampTo(L.g.gain, 0, 0.8);                          // 0.8s 淡出
      if (L.stopTimer) clearTimeout(L.stopTimer);
      L.stopTimer = setTimeout(function () {
        L.stopTimer = 0;
        if (!L.st.on && L.running) {
          try { L.src.stop(); L.src.disconnect(); } catch (e) { /* ignore */ }
          L.running = false;
        }
      }, 900);
    }
    setPan(L.panN, st.pan, 0.12);
  };

  /* ============================ 循环层：vinyl ============================ */
  // 炒豆声 + 沟槽沙沙 + lo-fi 五声音阶随机游走（唱头慢转走调 + 低音根音进行）
  const vinylLoop = { st: { on: false, gain: 1, pan: 0 }, built: false, beat: 0, melIdx: 2, nextBeat: 0 };
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];  // C4 D4 E4 G4 A4 C5
  const ROOTS = [65.41, 110.0, 87.31, 98.0];                     // C2 A2 F2 G2（C-Am-F-G）

  vinylLoop.build = function () {
    const L = vinylLoop;
    L.out = gn(0);                          // on/off 1s 淡入淡出 × st.gain，总增益 ~0.14
    L.panN = makePan(0);
    wire([L.out, L.panN], master);

    // 沟槽沙沙：持续极低（×out ≈ 0.013，符合 0.015 规格）
    const hiss = noiseSrc(whiteBuf);
    const hbp = filt('bandpass', 4600, 0.6);
    const hg = gn(0.09);
    hiss.connect(hbp); hbp.connect(hg); hg.connect(L.out);
    hiss.start(now(), rand(0, 1.5));

    // 音乐总线：低通 1800 → 轻微 waveshaper 饱和
    L.lp = filt('lowpass', 1800, 0.4);
    const sat = ctx.createWaveShaper();
    sat.curve = getSatCurve();
    L.lp.connect(sat); sat.connect(L.out);

    // 唱头慢转：0.4Hz 全局 detune ±7 音分（旋律/低音共享）
    L.det = osc('sine', 0.4);
    L.detG = gn(7);
    L.det.connect(L.detG);
    L.det.start();

    L.nextBeat = now() + 0.25;
    L.musicTimer = setInterval(vinylSchedule, 220);   // 前瞻调度（后台节流安全）
    L.crackleTimer = setInterval(vinylCrackle, 60);   // 炒豆声调度
  };
  vinylLoop.apply = function () {
    const L = vinylLoop, st = L.st;
    rampTo(L.out.gain, st.on ? clamp(st.gain, 0, 2) * 0.14 : 0, 1);
    setPan(L.panN, st.pan, 0.25);
  };

  // 音乐节拍前瞻调度：每 0.55s 一拍；低音每两拍一个根音；旋律 30% 休止随机游走
  function vinylSchedule() {
    const L = vinylLoop;
    if (!ctx) return;
    if (L.nextBeat < now() - 0.05) L.nextBeat = now() + 0.05;   // 后台回来重新对齐
    const horizon = now() + 1.0;
    while (L.nextBeat < horizon) {
      const bt = L.nextBeat;
      if (L.st.on && !muted) {
        if (L.beat % 2 === 0) bassNote(ROOTS[(L.beat >> 1) % 4], bt);
        if (Math.random() > 0.3) {
          if (Math.random() < 0.72) L.melIdx += Math.random() < 0.5 ? -1 : 1;
          else L.melIdx += (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 2 : 3);
          L.melIdx = clamp(L.melIdx, 0, PENTA.length - 1);
          melodyNote(PENTA[L.melIdx], bt);
        }
      }
      L.beat++;
      L.nextBeat += 0.55;
    }
  }
  function melodyNote(f, bt) {
    const L = vinylLoop;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    L.detG.connect(o.detune);                 // 慢转走调
    const g = gn(0.0001);
    g.gain.setValueAtTime(0.0001, bt);
    g.gain.exponentialRampToValueAtTime(rand(0.45, 0.7), bt + 0.035);
    g.gain.setTargetAtTime(0.0001, bt + 0.09, 0.17);
    o.connect(g); g.connect(L.lp);
    o.start(bt); o.stop(bt + 1.1);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }
  function bassNote(f, bt) {
    const L = vinylLoop;
    const o = osc('sine', f);
    L.detG.connect(o.detune);
    const g = gn(0.0001);
    g.gain.setValueAtTime(0.0001, bt);
    g.gain.exponentialRampToValueAtTime(0.32, bt + 0.05);      // 低音 0.5 倍相对音量
    g.gain.setTargetAtTime(0.0001, bt + 0.3, 0.35);
    o.connect(g); g.connect(L.lp);
    o.start(bt); o.stop(bt + 2.2);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }
  // 炒豆声：每 ~60ms 概率放极短噪声 tick（密度/音量随机，偶发大尘粒）
  function vinylCrackle() {
    const L = vinylLoop;
    if (!ctx || muted || !L.st.on) return;
    if (Math.random() > 0.8) return;
    const t = now() + rand(0.005, 0.03);
    const big = Math.random() < 0.1;
    const n = noiseSrc(whiteBuf, false);
    const bp = filt('bandpass', big ? rand(1300, 2600) : rand(2800, 6500), 1.2);
    const g = gn(0);
    const d = big ? rand(0.01, 0.022) : rand(0.003, 0.01);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(big ? rand(0.12, 0.2) : rand(0.03, 0.14), t + 0.001);
    g.gain.setTargetAtTime(0, t + 0.001, d * 0.4);
    n.connect(bp); bp.connect(g); g.connect(L.out);
    n.start(t, rand(0, 1.9));
    n.stop(t + d + 0.03);
    n.onended = function () { try { n.disconnect(); bp.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* ============================ 循环层：amb ============================ */
  // 昼夜两套底噪交叉淡化 2s；风读 PLR.env.breeze；远处鸟鸣/蟋蟀/夜风由调度器触发
  const ambLayer = { st: { mode: 'day', gain: 1 }, built: false };
  ambLayer.build = function () {
    const L = ambLayer;
    L.out = gn(clamp(L.st.gain, 0, 2));
    L.panN = makePan(0);
    wire([L.out, L.panN], master);

    // 昼：棕噪声远风（低通 300）+ 0.08Hz 起伏（独立节点，避免与 breeze ramp 抢参数）
    const dsrc = noiseSrc(brownBuf);
    L.dayLP = filt('lowpass', 300, 0.4);
    L.dayWind = gn(0.055);
    L.dayUnd = gn(1);
    L.dayLFO = osc('sine', 0.08);
    const dLFOG = gn(0.3);
    L.dayLFO.connect(dLFOG); dLFOG.connect(L.dayUnd.gain);
    L.dayX = gn(L.st.mode === 'day' ? 1 : 0);
    dsrc.connect(L.dayLP); L.dayLP.connect(L.dayWind); L.dayWind.connect(L.dayUnd);
    L.dayUnd.connect(L.dayX); L.dayX.connect(L.out);
    dsrc.start(now(), rand(0, 1.5)); L.dayLFO.start();

    // 夜：更沉（低通 160）
    const nsrc2 = noiseSrc(brownBuf);
    L.nightLP = filt('lowpass', 160, 0.4);
    L.nightWind = gn(0.06);
    L.nightX = gn(L.st.mode === 'night' ? 1 : 0);
    nsrc2.connect(L.nightLP); L.nightLP.connect(L.nightWind); L.nightWind.connect(L.nightX);
    L.nightX.connect(L.out);
    nsrc2.start(now(), rand(0, 1.5));

    // 偶发夜风（专用通路，避免和底噪参数打架）
    const gsrc = noiseSrc(brownBuf);
    const gbp = filt('bandpass', 300, 0.5);
    L.gustG = gn(0);
    gsrc.connect(gbp); gbp.connect(L.gustG); L.gustG.connect(L.out);
    gsrc.start(now(), rand(0, 1.5));

    // 调度器
    setInterval(ambBreath, 600);
    ambBirdNext();
    ambCricketNext();
    ambGustNext();
  };
  ambLayer.apply = function () {
    const L = ambLayer, st = L.st;
    const dayV = st.mode === 'day' ? 1 : 0;
    rampTo(L.dayX.gain, dayV, 2);            // 昼夜交叉淡化 2s
    rampTo(L.nightX.gain, 1 - dayV, 2);
    rampTo(L.out.gain, clamp(st.gain, 0, 2), 0.5);
  };
  // 每 600ms 读 breeze：breeze>0 时昼间风声最多上浮 1.8 倍
  function ambBreath() {
    const L = ambLayer;
    if (!ctx || !L.built) return;
    const br = PLR.env ? clamp(PLR.env.breeze || 0, 0, 1) : 0;
    rampTo(L.dayWind.gain, 0.055 * (1 + 0.8 * br), 0.9);
  }
  function ambBirdNext() {
    setTimeout(function () {
      if (ctx && !muted && ambLayer.st.mode === 'day' && ambLayer.dayX.gain > 0.5) birdSong();
      ambBirdNext();
    }, rand(9000, 22000));
  }
  // 远处鸟鸣：2~4 个上滑 FM 短音 2600~4200Hz，极轻
  function birdSong() {
    const t0 = now() + 0.05;
    const bus = gn(1), nodes = [bus];
    const cnt = 2 + Math.floor(rand(0, 2.99));
    let f = rand(2600, 3400);
    let last = null;
    for (let i = 0; i < cnt; i++) {
      const ts = t0 + i * rand(0.11, 0.19);
      const o = osc('sine', f);
      const mod = osc('sine', rand(55, 95));
      const mg = gn(f * 0.05);
      mod.connect(mg); mg.connect(o.frequency);
      const g = gn(0);
      g.gain.setValueAtTime(0, ts);
      g.gain.linearRampToValueAtTime(rand(0.02, 0.036), ts + 0.015);
      g.gain.linearRampToValueAtTime(0, ts + rand(0.06, 0.1));
      o.frequency.setValueAtTime(f, ts);
      o.frequency.linearRampToValueAtTime(Math.min(4200, f * rand(1.18, 1.4)), ts + 0.08);
      o.connect(g); g.connect(bus);
      o.start(ts); o.stop(ts + 0.14);
      mod.start(ts); mod.stop(ts + 0.14);
      nodes.push(o, mod, mg, g);
      last = o;
      f = Math.min(4200, f * rand(1.04, 1.12));
    }
    finishShot(bus, { pan: rand(-0.45, 0.45), send: 0.25 }, nodes, last);
  }
  function ambCricketNext() {
    setTimeout(function () {
      if (ctx && !muted && ambLayer.st.mode === 'night' && ambLayer.nightX.gain > 0.5) cricketSong();
      ambCricketNext();
    }, rand(6000, 14000));
  }
  // 蟋蟀：~4300Hz 载波 × 38Hz 幅度调制，0.35s 一串 ×3 声，极轻
  function cricketSong() {
    const t0 = now() + 0.05;
    const bus = gn(1), nodes = [bus];
    const f = rand(4100, 4600);
    const am = gn(0.5), lfo = osc('sine', 38), lg = gn(0.5);
    lfo.connect(lg); lg.connect(am.gain);
    lfo.start(t0); lfo.stop(t0 + 0.6);
    nodes.push(am, lfo, lg);
    let last = null;
    for (let i = 0; i < 3; i++) {
      const ts = t0 + i * 0.115;
      const o = osc('sine', f);
      const g = gn(0);
      g.gain.setValueAtTime(0, ts);
      g.gain.linearRampToValueAtTime(rand(0.02, 0.032), ts + 0.012);
      g.gain.linearRampToValueAtTime(0, ts + 0.09);
      o.connect(am); am.connect(g); g.connect(bus);
      o.start(ts); o.stop(ts + 0.1);
      nodes.push(o, g);
      last = o;
    }
    finishShot(bus, { pan: rand(-0.3, 0.3), send: 0.12 }, nodes, last);
  }
  function ambGustNext() {
    setTimeout(function () {
      const L = ambLayer;
      if (ctx && !muted && L.st.mode === 'night' && L.nightX.gain > 0.5) {
        const t = now(), g = L.gustG.gain, dur = rand(4, 7);
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(rand(0.018, 0.04), t + dur * 0.45);
        g.linearRampToValueAtTime(0, t + dur);
      }
      ambGustNext();
    }, rand(18000, 40000));
  }

  /* ============================ 循环层：tick ============================ */
  // 每 250ms 检查：跨秒边界且 gain>0.001 时播一声极短点击（tick/tock 交替音高）
  const tickLayer = { st: { gain: 0, pan: 0 }, built: false, alt: false, lastSec: 0 };
  tickLayer.build = function () {
    const L = tickLayer;
    L.g = gn(0);
    L.panN = makePan(0);
    wire([L.g, L.panN], master);
    L.lastSec = Math.floor(Date.now() / 1000);
    setInterval(tickCheck, 250);
  };
  tickLayer.apply = function () {
    const L = tickLayer, st = L.st;
    rampTo(L.g.gain, clamp(st.gain, 0, 1), 0.08);
    setPan(L.panN, st.pan, 0.1);
  };
  function tickCheck() {
    const L = tickLayer;
    if (!ctx || !L.built) return;
    const s = Math.floor(Date.now() / 1000);   // 对齐真实时钟秒
    if (s === L.lastSec) return;
    L.lastSec = s;
    if (muted || L.st.gain <= 0.001) return;
    L.alt = !L.alt;
    const t = now();
    const o = osc('sine', L.alt ? 2100 : 1900);
    const g = gn(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.004, 0.009);   // ~30ms
    o.connect(g); g.connect(L.g);
    o.start(t); o.stop(t + 0.06);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }

  /* ============================ 对外 API ============================ */
  const LAYERS = { fan: fanLoop, vinyl: vinylLoop, amb: ambLayer, tick: tickLayer };

  // 持续层参数（可每帧调用）：状态去抖，值变化才碰节点
  function loopSet(id, params) {
    const L = LAYERS[id];
    if (!L || !params) return;
    let changed = false;
    for (const k in params) {
      if (L.st[k] !== params[k]) { L.st[k] = params[k]; changed = true; }
    }
    if (!changed) return;
    if (ctx && L.built) L.apply();
  }

  function setMuted(m) {
    muted = !!m;
    if (ctx && master) rampTo(master.gain, muted ? 0 : 1, 0.25);
  }

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      buildGraph();
      for (const id in LAYERS) {
        const L = LAYERS[id];
        L.build();
        L.built = true;
        L.apply();          // 把解锁前缓存的状态一次性推入
      }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { /* ignore */ });
  }

  // 后台切回等场景 AudioContext 可能被再次挂起：任何点击时顺手恢复
  window.addEventListener('pointerdown', function () {
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { /* ignore */ });
  }, { passive: true });

  PLR.sfx = { unlock, setMuted, play, loopSet };
})();
