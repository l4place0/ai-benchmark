/* ============================================================
 * Pure Line Room — objects_deco.js
 * 墙面与顶面装饰组（SPEC §7 B 组 6~10 号）。普通 <script> 全局脚本，
 * 零依赖、无模块语法、无网络资源；颜色全部取自 Env.C.*。
 *
 * 对象清单（工厂 → id / label）与交互说明：
 *  makeClock    → 'clock'   挂钟
 *    持续：时/分/秒针按 new Date() 每帧真实走时；秒针每秒步进，
 *          Tween 0.12s backOut 过冲追赶目标角（秒*6°），
 *          秒变化时 AudioKit.tick(秒%2)（tick/tock 交替）。
 *    点击：AudioKit.dong() + 整体 Spring 摆 rotZ ±2°。
 *    hover：钟体微倾 1°；press：下沉 4mm。
 *  makeWallArt  → 'art'    装饰画
 *    线稿山景：山脊折线 2 层 + 月亮圆 + 水面横线 3 条 + 飞鸟 2 只。
 *    点击：绕挂钉 Spring 摆 rotZ ±3.5° + AudioKit.wobble()。
 *    hover：微倾 1.2°；press：下沉 5mm。
 *  makeChime    → 'chime'  风铃
 *    持续：整体绕吊点 rotX=sin(t·0.9)·1.2° 常摆，5 根铝管相位差摆动；
 *          吊扇开启时摆幅 ×(1+1.2·fan.speed)（全速 ≈2.2 倍）。
 *    点击：Spring kick 阵风大摆（约 3s 衰减）+ AudioKit.chimeStrike(3)。
 *    hover：管子轻颤；press：轻坠 6mm。
 *  makeFan      → 'fan'    吊扇
 *    持续：this.speed 惯性趋近开关目标（加速 τ≈2.5s / 减速 τ≈3.5s），
 *          叶片 rotY=相位+累计角 自旋（this.angle += speed·6·dt），
 *          每帧 AudioKit.fanRate(speed)（容错），开机自动补 fanStart。
 *    点击：拉绳下拽 0.05 弹回（backOut）+ AudioKit.click()·thunk() +
 *          切换 on/off + fanStart()/fanStop()。
 *    hover：拉绳微摆；press：微沉 5mm。
 *  makePendant  → 'pendant' 吊灯
 *    持续：亮灯（=Env.lightsOn，每帧读取）时灯泡芯变暖、
 *          每帧 Engine.FX.glow 暖光晕（alpha 夜 0.20 / 昼 0.04，随 skyT 过渡）。
 *    点击：Env.setLights(!Env.lightsOn) + AudioKit.switchToggle(on) +
 *          罩体 Spring 轻晃。
 *    hover：罩体微转 4°；press：微沉 4mm。
 *
 * 实现说明：
 *  - 不可见拾取代理：fill:null + w:'none' + pick:true 的 panel 不产生
 *    笔画/填充但进入拾取表，用于给线框为主的物体提供可点区域。
 *  - 工厂可重复调用：全部状态挂在实例/闭包上，模块级无可变共享状态；
 *    伪随机只用确定性 h01(i)=fract(sin(i*127.1)*43758.5453)。
 * ============================================================ */
(function () {
'use strict';

var W = window;
W.ROOM_PARTS = W.ROOM_PARTS || {};

var X = Engine.X;            // 引擎变换
var TE = Engine.E;           // 缓动函数集
var Tweens = W.Tweens;
var AK = (typeof AudioKit !== 'undefined') ? AudioKit : null;
var D2R = Math.PI / 180;

/* ---------------- 纯函数小工具 ---------------- */
function fract(x) { return x - Math.floor(x); }
function h01(i) { return fract(Math.sin(i * 127.1) * 43758.5453); } // 确定性伪随机 0..1
function lerp(a, b, t) { return a + (b - a) * t; }

/* x-y 平面圆盘点列（z=c[2]），用于表盘/珠心等填充面 */
function discZ(c, r, n) {
  var p = [];
  for (var i = 0; i < n; i++) {
    var a = Math.PI * 2 * i / n;
    p.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
  }
  return p;
}
/* 水平圆盘点列（y=c[1]），用于顶盘/拾取面 */
function discY(c, r, n) {
  var p = [];
  for (var i = 0; i < n; i++) {
    var a = Math.PI * 2 * i / n;
    p.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]);
  }
  return p;
}
function rectZ(x0, y0, x1, y1, z) {
  return [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
}

/* hover/press 平滑过渡接线（各工厂复用） */
function bindFeedback(o) {
  o.hoverT = 0;
  o.pressT = 0;
  o.setHover = function (h) {
    this.hovered = h;
    Tweens.add(this, 'hoverT', h ? 1 : 0, { dur: 0.22, ease: TE.cubicOut });
  };
  o.setPress = function (p) {
    this.pressed = p;
    Tweens.add(this, 'pressT', p ? 1 : 0, { dur: 0.09, ease: TE.linear });
  };
}

/* 把"本地动画 + 机体变换"两段式施加到一组部件；全零时如曾施加过则复位一次 */
function applyLocalBody(ps, local, body, state, key) {
  var i;
  if (local || body) {
    for (i = 0; i < ps.length; i++) {
      if (local && body) {
        var p1 = X.xform(ps[i].base, local);
        ps[i].pts = X.xform(p1, body);
      } else {
        ps[i].pts = X.xform(ps[i].base, local || body);
      }
    }
    state[key] = true;
  } else if (state[key]) {
    for (i = 0; i < ps.length; i++) ps[i].pts = X.xform(ps[i].base, {});
    state[key] = false;
  }
}

/* 机体反馈变换（hover 倾斜 / Spring 晃 / press 下沉），幅度皆近零时返回 null */
function bodyXfIf(rx, rz, ry, mvY, pivot) {
  if (Math.abs(rx) < 0.003 && Math.abs(rz) < 0.003 &&
      Math.abs(ry || 0) < 0.003 && Math.abs(mvY) < 0.0005) return null;
  var f = { pivot: pivot, move: [0, mvY, 0] };
  if (Math.abs(rx) >= 0.003) f.rotX = rx;
  if (Math.abs(rz) >= 0.003) f.rotZ = rz;
  if (ry && Math.abs(ry) >= 0.003) f.rotY = ry;
  return f;
}

/* ============================================================
 * 6. makeClock — 挂钟（后墙）
 * ============================================================ */
W.ROOM_PARTS.makeClock = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'clock', label: '挂钟',
    pos: opts.pos || [6.35, 2.78, 0.04],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var R_OUT = 0.245, R_IN = 0.2;
  var Z_DIAL = 0, Z_TICK = 0.005, Z_RING = 0.016;
  var Z_H = 0.02, Z_M = 0.027, Z_S = 0.034, Z_RIV = 0.04;
  var body = [];
  function reg(p) { body.push(p); return p; }

  /* 表盘（遮挡）+ 全幅不可见拾取面 */
  reg(o.panel(discZ([0, 0, Z_DIAL], R_OUT, 26), { fill: 'paper', w: 'none', pick: false }));
  reg(o.panel(discZ([0, 0, 0.022], R_OUT, 20), { fill: null, w: 'none', pick: true }));

  /* 木框双圈 */
  reg(o.circ([0, 0, Z_RING], R_OUT, 'z', { w: 'contour', col: 'ink' }));
  reg(o.circ([0, 0, Z_RING], R_IN, 'z', { w: 'struct', col: 'ink' }));
  reg(o.circ([0, 0, Z_RING], (R_OUT + R_IN) / 2, 'z', { w: 'hair', col: 'ink2' }));

  /* 12 时刻（粗）+ 48 分刻（细） */
  for (var i = 0; i < 60; i++) {
    var a = i * 6 * D2R;
    var sx = Math.sin(a), cx = Math.cos(a);
    var hour = (i % 5 === 0);
    var r1 = hour ? 0.158 : 0.174;
    reg(o.line([
      [sx * 0.186, cx * 0.186, Z_TICK],
      [sx * r1, cx * r1, Z_TICK]
    ], hour ? { w: 'detail', col: 'ink' } : { w: 'hair', col: 'ink2' }));
  }
  /* 框上四颗小螺钉 */
  for (var sc = 0; sc < 4; sc++) {
    var sa = (45 + sc * 90) * D2R;
    reg(o.circ([Math.sin(sa) * 0.2225, Math.cos(sa) * 0.2225, Z_RING], 0.008, 'z',
      { w: 'hair', col: 'ink2', segs: 8 }));
  }

  /* 时/分/秒针（沿 +y 直立建造，运行期绕表心 rotZ=-角 顺时针旋转） */
  var hourP = reg(o.panel([
    [0, -0.03, Z_H], [0.012, 0.01, Z_H], [0, 0.105, Z_H], [-0.012, 0.01, Z_H]
  ], { fill: 'paper', w: 'struct', col: 'ink' }));
  var minP = reg(o.panel([
    [0, -0.036, Z_M], [0.0095, 0.012, Z_M], [0, 0.172, Z_M], [-0.0095, 0.012, Z_M]
  ], { fill: 'paper', w: 'detail', col: 'ink' }));
  var secP = reg(o.line([[0, -0.048, Z_S], [0, 0.178, Z_S]], { w: 'hair', col: 'ink' }));
  var secT = reg(o.circ([0, -0.032, Z_S], 0.011, 'z', { w: 'hair', col: 'ink', segs: 12 }));
  /* 中心铆钉 */
  reg(o.panel(discZ([0, 0, Z_RIV], 0.015, 12), { fill: 'paper', w: 'hair', col: 'ink' }));
  reg(o.circ([0, 0, Z_RIV], 0.006, 'z', { w: 'hair', col: 'ink', segs: 8 }));

  bindFeedback(o);
  o.swingS = new Engine.Spring(2.3, 0.24);
  o._dir = 1;
  var d0 = new Date();
  o._sec = d0.getSeconds();
  o._secA = o._sec * 6;

  o.onClick = function () {
    this._dir = -this._dir;
    this.swingS.set(2.1 * this._dir);
    if (AK) AK.dong();
  };
  o.update = function (dt) {
    var d = new Date();
    var s = d.getSeconds();
    if (s !== this._sec) {
      this._sec = s;
      Tweens.add(this, '_secA', s * 6, { dur: 0.12, ease: TE.backOut });
      if (AK) AK.tick(s % 2);
    }
    var m = d.getMinutes();
    var hr = d.getHours() % 12;
    var hourA = hr * 30 + m * 0.5 + s * (0.5 / 60);
    var minA = m * 6 + (s + d.getMilliseconds() / 1000) * 0.1;

    var sway = this.swingS.tick(dt);
    if (Math.abs(sway) < 0.01 && Math.abs(this.swingS.v) < 0.12) { this.swingS.reset(); sway = 0; }
    var sink = -0.004 * this.pressT;
    var bodyXf = bodyXfIf(this.hoverT, sway, 0, sink, [0, 0, 0]);
    applyLocalBody(body, null, bodyXf, this, '_bodyOn');

    hourP.set({ rotZ: -hourA, pivot: [0, 0, 0] });
    minP.set({ rotZ: -minA, pivot: [0, 0, 0] });
    secP.set({ rotZ: -this._secA, pivot: [0, 0, 0] });
    secT.set({ rotZ: -this._secA, pivot: [0, 0, 0] });
    if (bodyXf) {
      hourP.pts = X.xform(hourP.pts, bodyXf);
      minP.pts = X.xform(minP.pts, bodyXf);
      secP.pts = X.xform(secP.pts, bodyXf);
      secT.pts = X.xform(secT.pts, bodyXf);
    }
  };

  o._body = body;
  return o;
};

/* ============================================================
 * 7. makeWallArt — 装饰画（左墙，rotY 90，局部 +z 朝房间外）
 * ============================================================ */
W.ROOM_PARTS.makeWallArt = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'art', label: '装饰画',
    pos: opts.pos || [0.05, 2.1, 3.7],
    rotY: (opts.rotY == null) ? 90 : opts.rotY
  });

  var Z_B = -0.006, Z_A = 0.004, Z_F = 0.014;
  var body = [];
  function reg(p) { body.push(p); return p; }

  /* 背板（遮挡）+ 全幅不可见拾取面 */
  reg(o.panel(rectZ(-0.39, -0.49, 0.39, 0.49, Z_B), { fill: 'paper', w: 'none', pick: false }));
  reg(o.panel(rectZ(-0.39, -0.49, 0.39, 0.49, 0.024), { fill: null, w: 'none', pick: true }));

  /* 画框：外框 + 内框 + 四角斜接线 */
  reg(o.line(rectZ(-0.39, -0.49, 0.39, 0.49, Z_F), { w: 'contour', col: 'ink' }));
  reg(o.line(rectZ(-0.31, -0.41, 0.31, 0.41, Z_F), { w: 'detail', col: 'ink' }));
  var mit = [
    [-0.39, -0.49, -0.31, -0.41], [0.39, -0.49, 0.31, -0.41],
    [0.39, 0.49, 0.31, 0.41], [-0.39, 0.49, -0.31, 0.41]
  ];
  for (var mi = 0; mi < 4; mi++) {
    reg(o.line([[mit[mi][0], mit[mi][1], Z_F], [mit[mi][2], mit[mi][3], Z_F]],
      { w: 'hair', col: 'ink2' }));
  }

  /* 山景：山脊折线 2 层 + 雪线短笔 */
  reg(o.line([
    [-0.28, 0.045, Z_A], [-0.185, 0.15, Z_A], [-0.09, 0.058, Z_A], [0, 0.178, Z_A],
    [0.095, 0.062, Z_A], [0.19, 0.128, Z_A], [0.28, 0.072, Z_A]
  ], { w: 'detail', col: 'ink' }));
  reg(o.line([
    [-0.28, -0.112, Z_A], [-0.17, -0.018, Z_A], [-0.075, -0.128, Z_A], [0.03, -0.028, Z_A],
    [0.135, -0.132, Z_A], [0.28, -0.048, Z_A]
  ], { w: 'detail', col: 'ink' }));
  reg(o.line([[-0.208, 0.1, Z_A], [-0.166, 0.121, Z_A]], { w: 'hair', col: 'ink2' }));
  reg(o.line([[-0.034, 0.128, Z_A], [0.008, 0.149, Z_A]], { w: 'hair', col: 'ink2' }));

  /* 月亮圆 + 环形山两点 */
  reg(o.circ([0.155, 0.225, Z_A], 0.052, 'z', { w: 'detail', col: 'ink', segs: 26 }));
  reg(o.circ([0.143, 0.238, Z_A], 0.01, 'z', { w: 'hair', col: 'ink2', segs: 10 }));
  reg(o.circ([0.168, 0.214, Z_A], 0.006, 'z', { w: 'hair', col: 'ink2', segs: 8 }));

  /* 水面横线 3 条（微波动，确定性相位） */
  var wl = [
    { y: -0.205, x0: -0.215, x1: 0.245, ph: 0 },
    { y: -0.262, x0: -0.135, x1: 0.18, ph: 2.1 },
    { y: -0.32, x0: -0.055, x1: 0.115, ph: 4.2 }
  ];
  for (var wi = 0; wi < 3; wi++) {
    var pts = [];
    for (var k = 0; k <= 6; k++) {
      pts.push([
        lerp(wl[wi].x0, wl[wi].x1, k / 6),
        wl[wi].y + Math.sin(k * 2.1 + wl[wi].ph) * 0.004,
        Z_A
      ]);
    }
    reg(o.line(pts, { w: 'hair', col: 'ink2' }));
  }

  /* 飞鸟 2 只 */
  reg(o.line([[-0.16, 0.3, Z_A], [-0.147, 0.311, Z_A], [-0.134, 0.302, Z_A]],
    { w: 'hair', col: 'ink' }));
  reg(o.line([[-0.075, 0.345, Z_A], [-0.062, 0.356, Z_A], [-0.049, 0.347, Z_A]],
    { w: 'hair', col: 'ink' }));

  /* 挂钉（静止）+ 挂绳（入机体组，铰点=钉位 → 摆动时绳框一体） */
  o.circ([0, 0.615, 0.004], 0.009, 'z', { w: 'detail', col: 'ink', segs: 10 });
  reg(o.line([[0, 0.6, 0.01], [-0.185, 0.492, 0.012]], { w: 'hair', col: 'ink2' }));
  reg(o.line([[0, 0.6, 0.01], [0.185, 0.492, 0.012]], { w: 'hair', col: 'ink2' }));

  bindFeedback(o);
  o.swingS = new Engine.Spring(1.7, 0.22);
  o._dir = 1;
  o.onClick = function () {
    this._dir = -this._dir;
    this.swingS.set(3.5 * this._dir);
    if (AK) AK.wobble();
  };
  o.update = function (dt) {
    var sway = this.swingS.tick(dt);
    if (Math.abs(sway) < 0.01 && Math.abs(this.swingS.v) < 0.12) { this.swingS.reset(); sway = 0; }
    var sink = -0.005 * this.pressT;
    var bodyXf = bodyXfIf(this.hoverT * 1.2, sway, 0, sink, [0, 0.6, 0]);
    applyLocalBody(body, null, bodyXf, this, '_bodyOn');
  };

  o._body = body;
  return o;
};

/* ============================================================
 * 8. makeChime — 风铃（吊顶，局部 y4 为天花板）
 * ============================================================ */
W.ROOM_PARTS.makeChime = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'chime', label: '风铃',
    pos: opts.pos || [4.25, 0, 0.55],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var Y_CEIL = 4.0, Y_PLATE = 3.1, R_PLATE = 0.15, R_HANG = 0.112;
  var body = [];
  function reg(p) { body.push(p); return p; }

  /* 吊点 / 吊绳 / 顶盘（ellip + 遮挡盘 + 内圈线 + 中心索座） */
  reg(o.circ([0, 3.984, 0], 0.028, 'y', { w: 'detail', col: 'ink', segs: 14 }));
  reg(o.line([[0, 3.984, 0], [0, Y_PLATE, 0]], { w: 'hair', col: 'ink' }));
  reg(o.panel(discY([0, Y_PLATE, 0], R_PLATE, 22), { fill: 'paper', w: 'none', pick: false }));
  reg(o.ellip([0, Y_PLATE, 0], R_PLATE, R_PLATE, { w: 'detail', col: 'ink', segs: 24 }));
  reg(o.ellip([0, Y_PLATE - 0.014, 0], R_PLATE * 0.8, R_PLATE * 0.8, { w: 'hair', col: 'ink2', segs: 20 }));
  reg(o.circ([0, Y_PLATE, 0], 0.03, 'y', { w: 'detail', col: 'ink', segs: 12 }));

  /* 不可见拾取代理（十字双面，任意视角可点） */
  reg(o.panel([[-0.15, 2.72, 0], [0.15, 2.72, 0], [0.15, 3.36, 0], [-0.15, 3.36, 0]],
    { fill: null, w: 'none', pick: true }));
  reg(o.panel([[0, 2.72, -0.15], [0, 2.72, 0.15], [0, 3.36, 0.15], [0, 3.36, -0.15]],
    { fill: null, w: 'none', pick: true }));

  /* 5 根长短不一铝管（r0.012, 长 0.16..0.30, 悬于盘缘, 各自 pivot=悬挂点） */
  var tubes = [];
  for (var i = 0; i < 5; i++) {
    var ang = i * (Math.PI * 2 / 5) + 0.55;
    var px = Math.cos(ang) * R_HANG, pz = Math.sin(ang) * R_HANG;
    var Li = 0.16 + h01(i * 3 + 1) * 0.14;
    var cy = o.cyl([px, Y_PLATE - 0.048, pz], 0.012, Li, 'y',
      { segs: 10, profiles: 2, capFill: 'paper', w: 'detail' });
    tubes.push({
      pivot: [px, Y_PLATE, pz],
      parts: [o.line([[px, Y_PLATE, pz], [px, Y_PLATE - 0.048, pz]], { w: 'hair', col: 'ink2' })]
        .concat(cy.all),
      on: false
    });
  }

  /* 中心垂坠小棱锥（吊绳 + 四面锥 + 顶盖） */
  var clap = {
    pivot: [0, Y_PLATE, 0], on: false,
    parts: [o.line([[0, Y_PLATE, 0], [0, 2.985, 0]], { w: 'hair', col: 'ink2' })]
  };
  var apex = [0, 2.885, 0];
  var sq = [[0.034, 2.985, 0.034], [-0.034, 2.985, 0.034],
            [-0.034, 2.985, -0.034], [0.034, 2.985, -0.034]];
  for (var k = 0; k < 4; k++) {
    clap.parts.push(o.panel([sq[k], sq[(k + 1) % 4], apex],
      { fill: 'paper', w: 'hair', pick: false }));
  }
  clap.parts.push(o.panel(discY([0, 2.985, 0], 0.042, 12), { fill: 'paper', w: 'detail', pick: true }));

  bindFeedback(o);
  o.gustS = new Engine.Spring(0.85, 0.2);
  o._dir = 1;
  o.onClick = function () {
    this._dir = -this._dir;
    this.gustS.kick(46 * this._dir);   // 起摆 ≈8.6°, ~3s 衰减
    if (AK) AK.chimeStrike(3);
  };
  o.update = function (dt, t) {
    var fan = Engine.scene.get('fan');
    var fs = fan ? (fan.speed || 0) : 0;
    var mul = 1 + 1.2 * fs;            // 吊扇全速 → 摆幅 ×2.2
    var gust = this.gustS.tick(dt);
    if (Math.abs(gust) < 0.02 && Math.abs(this.gustS.v) < 0.25) { this.gustS.reset(); gust = 0; }
    var gustK = 1 + Math.min(1.4, Math.abs(gust) * 0.22);
    var sink = -0.006 * this.pressT;

    /* 机体常摆（绕吊点）+ 阵风 */
    var bx = Math.sin(t * 0.9 + 0.4) * 1.2 * mul + gust;
    var bz = Math.sin(t * 0.63 + 1.7) * 0.55 * mul + gust * 0.35;
    var bodyXf = bodyXfIf(bx, bz, 0, sink, [0, Y_CEIL, 0]);
    applyLocalBody(body, null, bodyXf, this, '_bodyOn');

    /* 各管相位差摆动 + hover 轻颤（先绕悬挂点，再叠加机体） */
    for (var i2 = 0; i2 < tubes.length; i2++) {
      var g = tubes[i2];
      var lx = Math.sin(t * 1.13 + i2 * 1.9) * 1.5 * mul * gustK +
               Math.sin(t * 41 + i2 * 7.3) * 0.22 * this.hoverT;
      var lz = Math.sin(t * 0.87 + i2 * 2.6 + 1.1) * 1.0 * mul * gustK +
               Math.sin(t * 37 + i2 * 5.1) * 0.18 * this.hoverT;
      applyLocalBody(g.parts, { rotX: lx, rotZ: lz, pivot: g.pivot }, bodyXf, g, 'on');
    }
    /* 垂坠随阵风加重摆 */
    var cl = Math.sin(t * 1.02 + 2.2) * 0.9 * mul * gustK + gust * 0.5;
    applyLocalBody(clap.parts, { rotX: cl, rotZ: cl * 0.4, pivot: clap.pivot }, bodyXf, clap, 'on');
  };

  o._body = body;
  return o;
};

/* ============================================================
 * 9. makeFan — 吊扇（吊顶）
 * ============================================================ */
W.ROOM_PARTS.makeFan = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'fan', label: '吊扇',
    pos: opts.pos || [7.0, 0, 1.9],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var Y_CEIL = 3.982, Y_MOTOR = 3.62, H_MOTOR = 0.1, R_MOTOR = 0.09, Y_HUB = 3.6;
  var CORD0 = [0.088, 3.628, 0.03];   // 拉绳悬挂点（电机缘）
  var body = [];
  function reg(p) { body.push(p); return p; }

  /* 吊杆 + 电机罩（顶盖 paper）+ 毂盖细圈 + 顶部拾取面 */
  reg(o.ellip([0, Y_CEIL, 0], 0.055, 0.055, { w: 'detail', col: 'ink', segs: 16 }));
  reg(o.line([[0, Y_CEIL, 0], [0, Y_MOTOR, 0]], { w: 'struct', col: 'ink' }));
  var motor = o.cyl([0, Y_MOTOR, 0], R_MOTOR, H_MOTOR, 'y',
    { segs: 20, profiles: 4, capFill: 'paper', w: 'detail' });
  for (var mi = 0; mi < motor.all.length; mi++) reg(motor.all[mi]);
  reg(o.circ([0, Y_MOTOR + H_MOTOR + 0.002, 0], 0.032, 'y', { w: 'hair', col: 'ink2', segs: 12 }));
  reg(o.panel(discY([0, Y_MOTOR + H_MOTOR, 0], 0.135, 16), { fill: null, w: 'none', pick: true }));

  /* 4 片斜置叶片（薄板 fill paper，外缘低 0.06 产生桨距；不入机体组，单独自旋） */
  var blades = [];
  for (var bi = 0; bi < 4; bi++) {
    blades.push(o.panel([
      [0.045, 3.616, 0.05], [0.575, 3.556, 0.042],
      [0.575, 3.556, -0.042], [0.045, 3.616, -0.05]
    ], { fill: 'paper', w: 'hair', col: 'ink', pick: true }));
  }

  /* 护圈：外圈 r0.58 + 内圈 r0.20 + 3 根辐条 */
  reg(o.circ([0, 3.552, 0], 0.58, 'y', { w: 'detail', col: 'ink', segs: 28 }));
  reg(o.circ([0, 3.588, 0], 0.205, 'y', { w: 'hair', col: 'ink', segs: 20 }));
  for (var si = 0; si < 3; si++) {
    var sa = si * (Math.PI * 2 / 3) + 0.4;
    reg(o.line([
      [Math.cos(sa) * 0.205, 3.588, Math.sin(sa) * 0.205],
      [Math.cos(sa) * 0.578, 3.553, Math.sin(sa) * 0.578]
    ], { w: 'hair', col: 'ink2' }));
  }

  /* 拉绳（细线 + 末端小珠 + 珠心盘 + 珠部拾取面），独立形变组不入机体 */
  var cordPs = [
    o.line([CORD0, [0.1, 3.3, 0.022]], { w: 'hair', col: 'ink' }),
    o.circ([0.1, 3.285, 0.022], 0.016, 'z', { w: 'detail', col: 'ink', segs: 12 }),
    o.panel(discZ([0.1, 3.285, 0.022], 0.016, 10), { fill: 'paper', w: 'none', pick: false }),
    o.panel(discZ([0.1, 3.285, 0.022], 0.03, 10), { fill: null, w: 'none', pick: true })
  ];

  bindFeedback(o);
  o.on = true;
  o.speed = 0;
  o.angle = 0;
  o.pullT = 0;
  o._fanSnd = false;
  o.onClick = function () {
    var self = this;
    Tweens.add(this, 'pullT', 1, {
      dur: 0.13, ease: TE.cubicOut,
      onDone: function () {
        Tweens.add(self, 'pullT', 0, { dur: 0.42, ease: TE.backOut });
      }
    });
    this.on = !this.on;
    if (AK) {
      AK.click();
      AK.thunk();
      if (this.on) AK.fanStart(); else AK.fanStop();
    }
  };
  o.update = function (dt, t) {
    /* 惯性转速：加速 τ2.5s / 减速 τ3.5s；累计角 = ∫speed·6 dt */
    var target = this.on ? 1 : 0;
    var tau = target > this.speed ? 2.5 : 3.5;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / tau));
    if (target === 0 && this.speed < 0.0004) this.speed = 0;
    this.angle += this.speed * 6 * dt;
    var aDeg = this.angle * 180 / Math.PI;

    var i;
    for (i = 0; i < 4; i++) {
      blades[i].set({ rotY: i * 90 + aDeg, pivot: [0, Y_HUB, 0] });
    }

    /* 旋转不平衡带来的轻微机体摇摆 + press 微沉 */
    var wobX = Math.sin(this.angle * 2.3) * 0.24 * this.speed;
    var wobZ = Math.cos(this.angle * 1.7) * 0.18 * this.speed;
    var sink = -0.005 * this.pressT;
    var bodyXf = bodyXfIf(wobX, wobZ, 0, sink, [0, Y_CEIL, 0]);
    applyLocalBody(body, null, bodyXf, this, '_bodyOn');
    if (bodyXf) {
      for (i = 0; i < 4; i++) blades[i].pts = X.xform(blades[i].pts, bodyXf);
    }

    /* 拉绳：hover 微摆 + 常微颤；下拽用绕悬挂点 scale 拉长（顶端不动） */
    var cz = Math.sin(t * 2.7) * 2.4 * this.hoverT + Math.sin(t * 1.31) * 0.35;
    var cordXf = null;
    if (Math.abs(cz) > 0.02 || this.pullT > 0.001 || sink < -0.0005) {
      cordXf = { rotZ: cz, pivot: CORD0, scale: 1 + 0.146 * this.pullT, move: [0, sink, 0] };
    }
    applyLocalBody(cordPs, cordXf, null, this, '_cordOn');

    /* 循环声句柄同步 + 每帧 rate（AudioKit 未就绪时全部安全 no-op） */
    if (AK) {
      AK.fanRate(this.speed);
      if (this.on && AK.ready && !this._fanSnd) { AK.fanStart(); this._fanSnd = true; }
      if (!this.on && this._fanSnd) { AK.fanStop(); this._fanSnd = false; }
    }
  };

  o._body = body;
  return o;
};

/* ============================================================
 * 10. makePendant — 吊灯（吊顶）
 * ============================================================ */
W.ROOM_PARTS.makePendant = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'pendant', label: '吊灯',
    pos: opts.pos || [4.8, 0, 3.3],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var Y_CEIL = 4.0, Y_TOP = 3.52, Y_RIM = 3.34, R_RIM = 0.3, Y_BULB = 3.4, Y_PIV = 3.43;
  var body = [], shade = [];
  function regB(p) { body.push(p); return p; }
  function regS(p) { shade.push(p); return p; }

  /* 吊杆（机体组）+ 顶部拾取面 */
  regB(o.ellip([0, 3.982, 0], 0.05, 0.05, { w: 'detail', col: 'ink', segs: 14 }));
  regB(o.line([[0, 3.982, 0], [0, Y_TOP, 0]], { w: 'struct', col: 'ink' }));
  regB(o.panel(discY([0, Y_TOP, 0], 0.09, 14), { fill: null, w: 'none', pick: true }));

  /* 灯罩圆台（开口向下, 顶盖 paper）+ 内壁示意圈 + 罩内拾取面 */
  var sh = o.cyl([0, Y_RIM, 0], R_RIM, Y_TOP - Y_RIM, 'y',
    { topR: 0.05, segs: 26, profiles: 4, capFill: 'paper', w: 'detail' });
  for (var ci = 0; ci < sh.all.length; ci++) regS(sh.all[ci]);
  regS(o.circ([0, Y_PIV, 0], 0.2, 'y', { w: 'hair', col: 'ink2', segs: 20 }));
  regS(o.panel(discY([0, Y_PIV, 0], 0.27, 20), { fill: null, w: 'none', pick: true }));

  /* 灯泡：球面双圈 + 灯座 + 芯盘（点亮时填暖光 rgba） */
  regS(o.circ([0, Y_BULB, 0], 0.038, 'z', { w: 'detail', col: 'ink', segs: 16 }));
  regS(o.circ([0, Y_BULB, 0], 0.038, 'x', { w: 'hair', col: 'ink', segs: 14 }));
  var sock = o.cyl([0, 3.438, 0], 0.02, 0.078, 'y', { segs: 10, profiles: 2, w: 'hair' });
  for (var sk = 0; sk < sock.all.length; sk++) regS(sock.all[sk]);
  var core = regS(o.panel(discZ([0, Y_BULB, 0], 0.03, 14),
    { fill: 'paper', w: 'none', pick: false, bias: 0.01 }));

  bindFeedback(o);
  o.swayS = new Engine.Spring(1.15, 0.28);
  o._dir = 1;
  o.onClick = function () {
    var on = !Env.lightsOn;
    Env.setLights(on);
    this._dir = -this._dir;
    this.swayS.set(1.7 * this._dir);
    if (AK) AK.switchToggle(on);
  };
  o.update = function (dt) {
    var lit = !!Env.lightsOn;
    var skyT = Env.skyT || 0;
    var sway = this.swayS.tick(dt);
    if (Math.abs(sway) < 0.008 && Math.abs(this.swayS.v) < 0.1) { this.swayS.reset(); sway = 0; }
    var spin = 4 * this.hoverT;
    var sink = -0.004 * this.pressT;
    var shadeXf = spin > 0.003 ? { rotY: spin, pivot: [0, Y_PIV, 0] } : null;
    var bodyXf = bodyXfIf(sway * 0.35, sway, 0, sink, [0, Y_CEIL, 0]);
    applyLocalBody(shade, shadeXf, bodyXf, this, '_shadeOn');
    applyLocalBody(body, null, bodyXf, this, '_bodyOn');

    if (lit) {
      /* 光晕跟随摆动后的灯泡位置；alpha 夜 0.20 / 昼 0.04 随 skyT 过渡 */
      var bp = X.xform([[0, Y_BULB, 0]], shadeXf || {});
      if (bodyXf) bp = X.xform(bp, bodyXf);
      Engine.FX.glow(o.world(bp[0]), 1.2, Env.C.glowRgb, 0.04 + 0.16 * skyT);
      var g = Env.C.glowRgb;
      core.fill = 'rgba(' + Math.round(g[0]) + ',' + Math.round(g[1]) + ',' + Math.round(g[2]) + ',' +
        (0.55 + 0.35 * skyT).toFixed(3) + ')';
    } else {
      core.fill = 'paper';
    }
  };

  o._body = body;
  return o;
};

})();
