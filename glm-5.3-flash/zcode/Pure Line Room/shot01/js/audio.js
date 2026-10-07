/* ============================================================
 * Pure Line Room — audio.js
 * AudioKit：全部声音由 Web Audio API 现场合成（振荡器+噪声缓冲+滤波器+包络），
 * 零外部音频资源。普通 <script> 全局脚本，暴露 window.AudioKit（engine 首次手势调 init）。
 * 音效清单：环境底噪（昼=轻噪底+鸟鸣8~20s随机 / 夜=脉冲蝉鸣+更低棕噪底，交叉淡入淡出）
 *   click 三角波下滑blip | switchToggle 两段咔嗒(on高/off低) | drawerMove 带通噪声扫频+木碰
 *   doorMove 锯齿铰链滑音+慢幅颤+闷响(关更短) | thunk 低频正弦+噪声瞬态 | slide 带通噪声呼噜
 *   pageFlip 高通噪声脆响 | chimeStrike A宫五声加泛音铃(衰减2.5s) | pop 正弦下滑闷噗
 *   puff 带通噪声whoosh | wobble 低频颤音嗡 | swish 带通扫频呼喇 | shift 1.2s和声垫
 *   tick 两音高极低音量 | dong 非谐分音钟鸣(2~3s) | fan循环 棕噪+电机嗡(Rate调滤波/幅度)
 *   vinyl循环 炒豆噪声 + A小调五声74bpm旋律(Am7 Fmaj7 Cmaj7 G6, 1800Hz低通, ±6音分抖晃)
 * 主链：master gain(0.9) → 低通12kHz → DynamicsCompressor → destination
 * ============================================================ */
(function () {
'use strict';

var W = window;
var A = W.AudioKit = W.AudioKit || {};
A.ready = false;

var ctx = null, master = null;
var muted = false, night = false;
var whiteBuf = null, brownBuf = null, crackleBuf = null;
var lastVoice = {}, amb = null, fan = null, vinyl = null;   // 语音槽 / 循环句柄

/* ---------------- 基础工具 ---------------- */

function now() { return ctx.currentTime; }

function wake() { if (ctx && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* 忽略 */ } } }

function biq(type, f, q) {
  var b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q || 0.8;
  return b;
}

/* 包络：近零起 → peak（指数快攻 a 秒）→ 指数衰减 d 秒归零 */
function env(p, t, peak, a, d) {
  p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  p.exponentialRampToValueAtTime(0.0001, t + a + d);
}

/* ---------------- 噪声缓冲 ---------------- */

function mkNoise(sec, brown) {   // 白噪 / 棕噪（棕噪做峰值归一化）
  var len = Math.max(1, Math.floor(ctx.sampleRate * sec)), buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0), i, l = 0, m = 0, w;
  for (i = 0; i < len; i++) {
    w = Math.random() * 2 - 1;
    if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else { d[i] = w; }
  }
  if (brown) {
    for (i = 0; i < len; i++) { w = Math.abs(d[i]); if (w > m) m = w; }
    if (m > 0) for (i = 0; i < len; i++) d[i] /= m;
  }
  return buf;
}

function mkCrackle(sec) {   // 黑胶炒豆：稀疏尖脉冲 + 静默间隙
  var len = Math.max(1, Math.floor(ctx.sampleRate * sec)), buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0), i = 0, j, a, w;
  while (i < len) {
    if (Math.random() < 0.0006) {
      a = (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.7);
      w = 1 + ((Math.random() * 3) | 0);
      for (j = 0; j < w && i < len; j++) d[i++] = a * (1 - j / w);
      i += 60 + ((Math.random() * 400) | 0);
    } else { i++; }
  }
  return buf;
}

/* ---------------- 语音槽（一次性音效防重叠） ---------------- */

function voice(key) {
  var old = lastVoice[key]; if (old) old.kill();   // 同 key 重触发：先把旧的 10ms 内压掉
  var srcs = [], dead = false, g = ctx.createGain();
  g.connect(master);
  var v = {
    g: g,
    kill: function () {
      if (dead) return;
      dead = true;
      var t = now(), i;
      try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.01); } catch (e) { /* 忽略 */ }
      for (i = 0; i < srcs.length; i++) { try { srcs[i].stop(t + 0.06); } catch (e2) { /* 忽略 */ } }
      if (lastVoice[key] === v) delete lastVoice[key];
    }
  };
  v.osc = function (type, f0, t0, t1) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.start(t0); o.stop(t1);
    srcs.push(o);
    return o;
  };
  v.noise = function (buf, t0, t1) {
    var s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(t0, Math.random() * Math.max(0.01, buf.duration - 0.1));
    s.stop(t1);
    srcs.push(s);
    return s;
  };
  lastVoice[key] = v;
  return v;
}

function oneShot(key, fn) {
  if (!A.ready) return;   // 未 init 安全 no-op
  wake();
  var v = voice(key);
  try { fn(v, now()); } catch (e) { v.kill(); }
}

/* 复合小件：木碰 knock / 闷响 thud（多音效复用） */

function knock(v, t, mul) {
  var o = v.osc('sine', 190, t, t + 0.14);
  o.frequency.exponentialRampToValueAtTime(95, t + 0.1);
  var g = ctx.createGain(); env(g.gain, t, 0.3 * mul, 0.002, 0.11);
  o.connect(g); g.connect(v.g);
  var n = v.noise(whiteBuf, t, t + 0.05), lp = biq('lowpass', 900, 0.7), g2 = ctx.createGain();
  env(g2.gain, t, 0.13 * mul, 0.001, 0.04); n.connect(lp); lp.connect(g2); g2.connect(v.g);
}

function thud(v, t, mul) {
  var o = v.osc('sine', 96, t, t + 0.24);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.19);
  var g = ctx.createGain(); env(g.gain, t, 0.32 * mul, 0.004, 0.21);
  o.connect(g); g.connect(v.g);
  var n = v.noise(whiteBuf, t, t + 0.06), lp = biq('lowpass', 430, 0.7), g2 = ctx.createGain();
  env(g2.gain, t, 0.11 * mul, 0.001, 0.05); n.connect(lp); lp.connect(g2); g2.connect(v.g);
}

/* ---------------- 生命周期 / 静音 / 昼夜 ---------------- */

A.init = function () {
  if (A.ready) return;   // 幂等
  var AC = W.AudioContext || W.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC(); } catch (e) { return; }
  master = ctx.createGain();
  master.gain.value = muted ? 0.0001 : 0.9;
  var lp = biq('lowpass', 12000, 0.4), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.24;
  master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
  whiteBuf = mkNoise(2, false); brownBuf = mkNoise(3, true); crackleBuf = mkCrackle(4);
  A.ready = true; wake(); startAmbience();   // init 后自动开始昼间环境底噪
};

A.setMuted = function (b) {
  muted = !!b;
  if (!A.ready) return;
  var t = now();
  master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(muted ? 0.0001 : 0.9, t, 0.08);   // 平滑归零/恢复
};

A.toggleMuted = function () { A.setMuted(!muted); return muted; };
A.isMuted = function () { return muted; };

A.setNight = function (b) {
  b = !!b;
  if (b === night) return;
  night = b;   // 未 init 时仅记标记，init 后以正确底噪起步
  if (A.ready) applyNight();
};

/* ---------------- 一次性音效 ---------------- */

A.click = function () {
  oneShot('click', function (v, t) {
    var o = v.osc('triangle', 1500, t, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.06);
    o.connect(v.g); env(v.g.gain, t, 0.24, 0.003, 0.06);
  });
};

A.switchToggle = function (on) {
  oneShot('switch', function (v, t) {
    for (var i = 0; i < 2; i++) {   // 两段咔嗒：断开+落位
      var tt = t + i * 0.055, f = on ? (i ? 2500 : 1700) : (i ? 820 : 1200);
      var o = v.osc('square', f, tt, tt + 0.03), bp = biq('bandpass', f * 1.2, 2.5), g = ctx.createGain();
      env(g.gain, tt, i ? 0.11 : 0.08, 0.002, 0.028); o.connect(bp); bp.connect(g); g.connect(v.g);
      var n = v.noise(whiteBuf, tt, tt + 0.02), hp = biq('highpass', 3000, 0.7), g2 = ctx.createGain();
      env(g2.gain, tt, 0.07, 0.001, 0.016); n.connect(hp); hp.connect(g2); g2.connect(v.g);
    }
  });
};

A.drawerMove = function (open) {
  oneShot('drawer', function (v, t) {
    var dur = 0.35, n = v.noise(whiteBuf, t, t + dur + 0.16), bp = biq('bandpass', open ? 380 : 950, 1.7);
    bp.frequency.setValueAtTime(open ? 380 : 950, t);   // 开=由暗到亮，关=反向
    bp.frequency.exponentialRampToValueAtTime(open ? 950 : 380, t + dur * 0.8);
    bp.frequency.exponentialRampToValueAtTime(open ? 620 : 480, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.06);
    g.gain.setValueAtTime(0.15, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(v.g);
    knock(v, t + dur + 0.02, open ? 0.85 : 0.65);   // 末端木碰
  });
};

A.doorMove = function (open) {
  oneShot('door', function (v, t) {
    var dur = open ? 0.6 : 0.42;
    var o = v.osc('sawtooth', open ? 145 : 235, t, t + dur);
    if (open) o.frequency.exponentialRampToValueAtTime(235, t + dur * 0.6);
    o.frequency.exponentialRampToValueAtTime(open ? 190 : 140, t + dur);
    var bp = biq('bandpass', 720, 2.4), trem = ctx.createGain(); trem.gain.value = 1;
    var lfo = v.osc('sine', 6.8, t, t + dur), lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain);   // 慢幅颤（铰链粘滑）
    var g = ctx.createGain(); env(g.gain, t, 0.12, 0.07, dur);
    o.connect(bp); bp.connect(trem); trem.connect(g); g.connect(v.g);
    thud(v, t + dur + 0.01, open ? 0.9 : 1.05);   // 末端闷响
  });
};

A.thunk = function () { oneShot('thunk', function (v, t) { knock(v, t, 1.35); }); };

A.slide = function () {
  oneShot('slide', function (v, t) {
    var n = v.noise(whiteBuf, t, t + 0.26), bp = biq('bandpass', 330, 1.1);
    bp.frequency.exponentialRampToValueAtTime(170, t + 0.22); n.connect(bp); bp.connect(v.g);
    env(v.g.gain, t, 0.13, 0.03, 0.2);
  });
};

A.pageFlip = function () {
  oneShot('page', function (v, t) {
    var n = v.noise(whiteBuf, t, t + 0.26), hp = biq('highpass', 2400, 0.7), bp = biq('bandpass', 4200, 0.8);
    n.connect(hp); hp.connect(bp); bp.connect(v.g);
    var p = v.g.gain;   // 双峰脆响
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.11, t + 0.03);
    p.exponentialRampToValueAtTime(0.03, t + 0.1); p.exponentialRampToValueAtTime(0.12, t + 0.14);
    p.exponentialRampToValueAtTime(0.0001, t + 0.23);
  });
};

function bell(v, t, f, vol) {   // 加正弦泛音铃声：基音+2.76x+5.4x，长衰减
  var P = [[1, 1, 2.5], [2.76, 0.4, 1.2], [5.4, 0.16, 0.5]];
  for (var i = 0; i < P.length; i++) {
    var o = v.osc('sine', f * P[i][0], t, t + P[i][2] + 0.2), g = ctx.createGain();
    env(g.gain, t, vol * P[i][1], 0.004, P[i][2]); o.connect(g); g.connect(v.g);
  }
}

A.chimeStrike = function (n) {
  oneShot('chime', function (v, t) {
    var scale = [440, 493.88, 554.37, 659.25, 739.99];   // A 宫调式: A B C# E F#
    var k = Math.max(1, Math.min(6, (n | 0) || 3)), tt = t;
    for (var i = 0; i < k; i++) {
      bell(v, tt, scale[(Math.random() * scale.length) | 0], 0.075 + Math.random() * 0.05);   // 音量错落
      tt += 0.08 + Math.random() * 0.08;   // 间隔 80~160ms
    }
  });
};

A.pop = function () {
  oneShot('pop', function (v, t) {
    var o = v.osc('sine', 320, t, t + 0.13);
    o.frequency.exponentialRampToValueAtTime(88, t + 0.09);
    o.connect(v.g); env(v.g.gain, t, 0.28, 0.004, 0.11);
    var n = v.noise(whiteBuf, t, t + 0.05), lp = biq('lowpass', 1100, 0.7), g2 = ctx.createGain();
    env(g2.gain, t, 0.07, 0.002, 0.035);
    n.connect(lp); lp.connect(g2); g2.connect(v.g);
  });
};

A.puff = function () {
  oneShot('puff', function (v, t) {
    var n = v.noise(whiteBuf, t, t + 0.32), bp = biq('bandpass', 3400, 0.8);
    bp.frequency.exponentialRampToValueAtTime(1900, t + 0.28); n.connect(bp); bp.connect(v.g);
    var p = v.g.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.07, t + 0.05);
    p.exponentialRampToValueAtTime(0.0001, t + 0.3);
  });
};

A.wobble = function () {
  oneShot('wobble', function (v, t) {
    var dur = 0.55;
    var o = v.osc('sine', 88, t, t + dur), o2 = v.osc('sine', 176, t, t + dur), g2 = ctx.createGain();
    o.frequency.linearRampToValueAtTime(76, t + dur);
    g2.gain.value = 0.22;
    o.connect(v.g); o2.connect(g2); g2.connect(v.g);
    var lfo = v.osc('sine', 6.5, t, t + dur), lg = ctx.createGain(); lg.gain.value = 5.5;   // 音高颤
    lfo.connect(lg); lg.connect(o.frequency);
    env(v.g.gain, t, 0.15, 0.025, dur - 0.03);
  });
};

A.swish = function () {
  oneShot('swish', function (v, t) {
    var dur = 0.3;
    var n = v.noise(whiteBuf, t, t + dur + 0.02), bp = biq('bandpass', 650, 0.9);
    bp.frequency.setValueAtTime(650, t); bp.frequency.exponentialRampToValueAtTime(2300, t + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(900, t + dur);
    n.connect(bp); bp.connect(v.g);
    var p = v.g.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.11, t + dur * 0.4);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
  });
};

A.shift = function () {
  oneShot('shift', function (v, t) {
    var fs = [220, 277.18, 329.63, 440];   // A3 C#4 E4 A4 柔和和声垫
    for (var i = 0; i < fs.length; i++) {
      var o = v.osc('sine', fs[i], t, t + 1.3);
      o.detune.value = (i - 1.5) * 2.6; o.connect(v.g);
    }
    var p = v.g.gain;
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(0.038, t + 0.45); p.linearRampToValueAtTime(0.0001, t + 1.2);
  });
};

A.tick = function (alt) {
  oneShot('tick', function (v, t) {
    var o = v.osc('sine', alt ? 1180 : 920, t, t + 0.045);
    o.connect(v.g); env(v.g.gain, t, 0.032, 0.001, 0.032);   // 音量极低 ≤0.05
    var n = v.noise(whiteBuf, t, t + 0.014), hp = biq('highpass', 3300, 0.7), g2 = ctx.createGain();
    env(g2.gain, t, 0.016, 0.001, 0.012);
    n.connect(hp); hp.connect(g2); g2.connect(v.g);
  });
};

A.dong = function () {
  oneShot('dong', function (v, t) {
    var P = [[1, 1, 2.7], [2, 0.5, 1.9], [2.92, 0.26, 1.2], [4.2, 0.12, 0.7]];   // 非谐分音，2~3s 衰减
    for (var i = 0; i < P.length; i++) {
      var o = v.osc('sine', 220 * P[i][0], t, t + P[i][2] + 0.2), g = ctx.createGain();
      env(g.gain, t, 0.15 * P[i][1], 0.004, P[i][2]); o.connect(g); g.connect(v.g);
    }
    var n = v.noise(whiteBuf, t, t + 0.03), hp = biq('highpass', 1600, 0.7), g2 = ctx.createGain();
    env(g2.gain, t, 0.035, 0.001, 0.02);   // 击槌瞬态
    n.connect(hp); hp.connect(g2); g2.connect(v.g);
  });
};

/* ---------------- 环境底噪（昼/夜交叉淡入淡出） ---------------- */

function startAmbience() {
  var dayG = ctx.createGain(), nightG = ctx.createGain();
  dayG.gain.value = 0; nightG.gain.value = 0; dayG.connect(master); nightG.connect(master);
  var dn = ctx.createBufferSource(), dlp = biq('lowpass', 750, 0.4), dg = ctx.createGain();   // 昼:极轻室内噪
  dn.buffer = whiteBuf; dn.loop = true; dg.gain.value = 0.4;
  dn.connect(dlp); dlp.connect(dg); dg.connect(dayG); dn.start();
  var sn = ctx.createBufferSource(), slp = biq('lowpass', 320, 0.4), sg = ctx.createGain();   // 夜:更低沉
  sn.buffer = brownBuf; sn.loop = true; sg.gain.value = 0.34;
  sn.connect(slp); slp.connect(sg); sg.connect(nightG); sn.start();
  amb = { dayG: dayG, nightG: nightG, srcs: [dn, sn] };
  applyNight(); armBird(); armBug();
}

function applyNight() {   // 交叉淡入淡出 ~1.5s
  if (!amb) return;
  var t = now();
  amb.dayG.gain.cancelScheduledValues(t); amb.nightG.gain.cancelScheduledValues(t);
  amb.dayG.gain.setTargetAtTime(night ? 0.0001 : 1, t, 0.5);
  amb.nightG.gain.setTargetAtTime(night ? 1 : 0.0001, t, 0.5);
}

function armBird() {   // 偶发鸟鸣：8~20s 随机（仅昼）
  setTimeout(function () {
    if (A.ready && !night) birdChirp();
    armBird();
  }, 8000 + Math.random() * 12000);
}

function birdChirp() {
  var t = now() + 0.05, count = 2 + ((Math.random() * 2) | 0), f0 = 2500 + Math.random() * 1200;
  var bus = ctx.createGain();
  bus.gain.value = 1; bus.connect(amb.dayG);
  var last = null;
  for (var i = 0; i < count; i++) {   // 2~3 音啁啾
    var f = f0 * (0.88 + Math.random() * 0.3);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.8, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
    o.frequency.exponentialRampToValueAtTime(f * 0.86, t + 0.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.13);
    last = o; t += 0.09 + Math.random() * 0.07;
  }
  last.onended = function () { try { bus.disconnect(); } catch (e) { /* 忽略 */ } };
}

function armBug() {   // 夜间蝉鸣脉冲串
  setTimeout(function () {
    if (A.ready && night) cicada();
    armBug();
  }, 1200 + Math.random() * 3600);
}

function cicada() {   // 带通噪声 × 方波 AM = 脉冲蝉声
  var dur = 0.35 + Math.random() * 0.5, t = now() + 0.05;
  var n = ctx.createBufferSource(), bp = biq('bandpass', 4600 + Math.random() * 1000, 3.5);
  n.buffer = whiteBuf; n.loop = true;
  var am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), eg2 = ctx.createGain();
  am.gain.value = 0.5;
  lfo.type = 'square'; lfo.frequency.value = 22 + Math.random() * 16; lg.gain.value = 0.5;
  lfo.connect(lg); lg.connect(am.gain);
  eg2.gain.setValueAtTime(0.0001, t); eg2.gain.exponentialRampToValueAtTime(0.032, t + 0.09);
  eg2.gain.setValueAtTime(0.032, t + dur - 0.09); eg2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp); bp.connect(am); am.connect(eg2); eg2.connect(amb.nightG);
  n.start(t, Math.random()); n.stop(t + dur + 0.02);
  lfo.start(t); lfo.stop(t + dur + 0.02);
  n.onended = function () { try { bp.disconnect(); am.disconnect(); eg2.disconnect(); } catch (e) { /* 忽略 */ } };
}

/* ---------------- 循环声：吊扇 ---------------- */

A.fanStart = function () {
  if (!A.ready || fan) return;   // 防重入
  var bus = ctx.createGain();
  bus.gain.value = 0.0001; bus.connect(master);
  var n = ctx.createBufferSource(), lp = biq('lowpass', 300, 0.6), wind = ctx.createGain();
  n.buffer = brownBuf; n.loop = true; wind.gain.value = 0.3;
  n.connect(lp); lp.connect(wind); wind.connect(bus);
  var m1 = ctx.createOscillator(), m2 = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain();
  m1.type = 'triangle'; m1.frequency.value = 46; g1.gain.value = 0.3;   // 低频电机嗡
  m2.type = 'sine'; m2.frequency.value = 92; g2.gain.value = 0.12;
  m1.connect(g1); g1.connect(bus); m2.connect(g2); g2.connect(bus);
  var lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.type = 'sine'; lfo.frequency.value = 3.1; lg.gain.value = 0.07;   // 叶片掠气起伏
  lfo.connect(lg); lg.connect(wind.gain);
  n.start(); m1.start(); m2.start(); lfo.start();
  fan = { bus: bus, lp: lp, wind: wind, m1: m1, m2: m2, srcs: [n, m1, m2, lfo] };
  bus.gain.setTargetAtTime(0.3, now(), 0.3);
  A.fanRate(0.55);
};

A.fanRate = function (x) {   // 0..1 调滤波频率与幅度（风声随转速）
  if (!A.ready || !fan) return;
  x = Math.max(0, Math.min(1, +x || 0));
  var t = now();
  fan.lp.frequency.setTargetAtTime(180 + 540 * x, t, 0.18);
  fan.wind.gain.setTargetAtTime(0.22 + 0.55 * x, t, 0.18);
  fan.m1.frequency.setTargetAtTime(34 + 26 * x, t, 0.18);
  fan.m2.frequency.setTargetAtTime(68 + 52 * x, t, 0.18);
};

A.fanStop = function () {
  if (!A.ready || !fan) return;
  var f = fan, t = now(), i;
  fan = null;
  f.bus.gain.cancelScheduledValues(t);
  f.bus.gain.setTargetAtTime(0.0001, t, 0.12);   // ~0.4s 平滑淡出
  setTimeout(function () {
    for (i = 0; i < f.srcs.length; i++) { try { f.srcs[i].stop(); } catch (e) { /* 忽略 */ } }
    try { f.bus.disconnect(); } catch (e2) { /* 忽略 */ }
  }, 550);
};

/* ---------------- 循环声：唱片机 ---------------- */

var VIN_SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 659.25];   // A3 C4 D4 E4 G4 A4 C5 E5
var VIN_TONES = [[0, 1, 3, 4, 5, 6, 7], [0, 1, 3, 5, 6], [1, 3, 4, 6], [2, 3, 4, 7]];   // Am7/Fmaj7/Cmaj7/G6 和弦音(音阶序号)
var VIN_ROOT = [110, 87.31, 130.81, 98];   // 每小节低音根音: A2 F2 C3 G2
var VIN_EIGHTH = 30 / 74;                  // 74bpm 八分音符

A.vinylStart = function () {
  if (!A.ready || vinyl) return;   // 防重入
  var bus = ctx.createGain(), tone = biq('lowpass', 3600, 0.4);
  bus.gain.value = 0.0001; bus.connect(tone); tone.connect(master);
  var cn = ctx.createBufferSource(), chp = biq('highpass', 2000, 0.7), cg = ctx.createGain();
  cn.buffer = crackleBuf; cn.loop = true; cg.gain.value = 0.013;   // 炒豆噪声很轻
  cn.connect(chp); chp.connect(cg); cg.connect(bus); cn.start();
  var wow = ctx.createOscillator(), wg = ctx.createGain();
  wow.type = 'sine'; wow.frequency.value = 0.5; wg.gain.value = 6;   // ±6 音分抖晃
  wow.connect(wg); wow.start();
  vinyl = { bus: bus, wow: wg, srcs: [cn, wow], grid: 0, hold: 0, mel: 3, nextT: now() + 0.15, timer: 0 };
  vinyl.timer = setInterval(vinylTick, 80);   // lookahead: 80ms 内排程未来 300ms
  bus.gain.setTargetAtTime(1, now(), 0.2);
};

function vinylTick() {
  if (!A.ready || !vinyl) return;
  var v = vinyl, ahead = now() + 0.3;
  while (v.nextT < ahead) {
    vinylStep(v, v.grid, v.nextT);
    v.grid++; v.nextT += VIN_EIGHTH;
  }
}

function vinylStep(v, grid, t) {
  var bar = Math.floor(grid / 8), c = Math.floor(bar / 2) % 4;   // 每 2 小节换和弦
  if (grid % 8 === 0) vinylBass(v, VIN_ROOT[c], t);   // 每小节一根低音
  if (v.hold > 0) { v.hold--; return; }
  if (Math.random() < 0.26) return;   // 呼吸留白
  var tones = VIN_TONES[c], i;
  if (Math.random() < 0.72) {         // 和弦音上随机游走（偏近距离）
    var best = tones[0], bd = 1e9;
    for (i = 0; i < tones.length; i++) {
      var d = Math.abs(tones[i] - v.mel) + Math.random() * 1.8;
      if (d < bd) { bd = d; best = tones[i]; }
    }
    v.mel = best;
  } else {                            // 偶尔经过音
    v.mel = Math.max(0, Math.min(7, v.mel + (Math.random() < 0.5 ? -1 : 1)));
  }
  vinylPluck(v, VIN_SCALE[v.mel], t, 0.055 + Math.random() * 0.025);
  if (Math.random() < 0.3) v.hold = 1;   // 偶尔拉长一拍
}

function vinylPluck(v, f, t, vol) {   // 三角波+正弦拨弦 → 1800Hz 低通，抖晃挂 detune
  var dur = 0.6 + Math.random() * 0.3;   // 指数衰减 0.6~0.9s
  var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), lp = biq('lowpass', 1800, 0.6);
  o1.type = 'triangle'; o1.frequency.value = f;
  o2.type = 'sine'; o2.frequency.value = f * 2.003;
  v.wow.connect(o1.detune); v.wow.connect(o2.detune);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g2.gain.value = 0.3; o1.connect(g); o2.connect(g2); g2.connect(g);
  g.connect(lp); lp.connect(v.bus);
  o1.start(t); o1.stop(t + dur + 0.05);
  o2.start(t); o2.stop(t + dur + 0.05);
}

function vinylBass(v, f, t) {   // 每小节一根正弦低音根音
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g); g.connect(v.bus); o.start(t); o.stop(t + 1.7);
}

A.vinylStop = function () {
  if (!A.ready || !vinyl) return;
  var v = vinyl, t = now(), i;
  vinyl = null;
  clearInterval(v.timer);   // 清掉调度器
  v.bus.gain.cancelScheduledValues(t);
  v.bus.gain.setTargetAtTime(0.0001, t, 0.12);   // ~0.4s 淡出
  setTimeout(function () {
    for (i = 0; i < v.srcs.length; i++) { try { v.srcs[i].stop(); } catch (e) { /* 忽略 */ } }
    try { v.bus.disconnect(); } catch (e2) { /* 忽略 */ }
  }, 550);
};

})();
