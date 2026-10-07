/* ============================================================
 * Pure Line Room — objects_study.js（书房组 · SPEC §7 C 组 11~15）
 * ------------------------------------------------------------
 * 对象清单与交互说明：
 *  makeDesk      id:'desk'  书桌 —— 桌面(1.7×0.72, 顶面 y0.76, 厚0.045)
 *                           + 4 条 0.05 方腿 + 背板 + 侧望板；桌面上摊开
 *                           笔记本(两页+书脊+字行)与细六棱铅笔(segs6)。
 *                           点击：桌面绕后上缘 Spring 轻晃 rotX≈0.6°
 *                           + AudioKit.wobble()。hover：整体下沉 0.004；
 *                           press：下沉 0.008（渐变趋近，无跳变）。
 *  makeChair     id:'chair' 木椅 —— 座面 0.46² 厚0.035(y0.46) + 前腿直/
 *                           后腿延伸成背柱 + 两横档 + 顶轨。点击：推进/
 *                           拉出往复（cubicInOut 0.7s，起步 AudioKit.slide()，
 *                           onDone AudioKit.thunk()），全部部件统一 move z。
 *                           hover：整体微转 2°（hoverK 渐变）；press 下沉。
 *  makeLamp      id:'lamp'  台灯 —— 底座圆台 + 两节微弯折立杆 + 纸罩
 *                           (fill:'paper') + 拉环。this.on 独立开关：亮时
 *                           每帧 Engine.FX.glow(罩下, 0.55, Env.C.glowRgb,
 *                           nightDark 0.30 / 夜间开灯 0.10 / 昼 0.05)
 *                           + 桌面光池椭圆(rgba(glowRgb,0.10)，nightDark 0.16)
 *                           + 灯泡小圆变亮。点击 AudioKit.switchToggle(on)
 *                           + 罩体 Spring 晃。hover：灯罩朝镜头微转 6°
 *                           （hoverK 渐变驱动）。
 *  makeCup       id:'cup'   杯子 —— 碟盘(ellip 0.075) + 杯体 cyl
 *                           (topR0.042 r0.036 h0.095) + 把手弧(circ arc,
 *                           axis 'z') + 杯口椭圆。持续蒸汽：update 计时
 *                           每 0.5s 一粒 Engine.FX.puff(world(0,0.112,0),
 *                           {n:1, rise:0.14, size:0.014, life:1.8, alpha:0.22,
 *                           col:Env.C.inkRgb})，hover 间隔缩至 0.22s；
 *                           点击蒸汽爆发(n8) + AudioKit.puff() + 杯身
 *                           Spring 微晃。
 *  makeBookshelf id:'bookshelf' 书架 —— 架体 1.6×0.32×2.05：侧板×2 +
 *                           底/顶板 + 4 层隔板 + 背板(fill:'paper')。
 *                           三层 16 本静态书（高 0.20..0.26、厚 0.030..0.050、
 *                           书脊 1~2 条 'hair' 竖线、一本 rotZ -8° 斜靠
 *                           右内侧板、一摞平放），位置用确定性伪随机
 *                           h1(i)=fract(sin(i*127.1)*43758.5453)；
 *                           第 4 层书立+小收纳盒；顶格小相框+收纳盒。
 *                           三本互动书（部件组：旧书/厚书/红封皮书——
 *                           引擎仅支持对象级 label，故书架 label='书架'，
 *                           书名以部件组实现）：点击拉出局部 +z 0.14
 *                           (Tween 0.45s cubicOut，拉出 AudioKit.pageFlip()、
 *                           推回 AudioKit.slide())；红封皮书 outT>0.7 时
 *                           信纸斜插出（alpha 淡入 + AudioKit.pageFlip()），
 *                           推回隐藏；红封皮书前脸 fill 为 rgba 暖色派生自
 *                           Env.C.glowRgb。书架本体点击 Spring 轻晃
 *                           + AudioKit.wobble()。hover：三本书各微探出
 *                           0.015（hoverK 渐变）。
 * 约束：普通 <script> 全局脚本；颜色全部 Env.C.*；工厂可重复调用；
 *       无 Math.random（仅引擎 FX 粒子内部使用）；AudioKit 直呼。
 * ============================================================ */
(function () {
'use strict';

var ROOM_PARTS = window.ROOM_PARTS = window.ROOM_PARTS || {};

/* ---------------- 小工具（确定性、无随机、可重复调用） ---------------- */
function h1(i) { var s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }
function approach(v, tgt, dt, rate) { return v + (tgt - v) * (1 - Math.exp(-rate * dt)); }
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function rgba(rgb, a) {
  return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')';
}
function applySet(parts, tr) { for (var i = 0; i < parts.length; i++) parts[i].set(tr); }
function inList(parts, p) {
  if (!p) return false;
  for (var i = 0; i < parts.length; i++) if (parts[i] === p) return true;
  return false;
}
/* 把一次性姿态烘进 base（此后每帧 set 均保留该姿态） */
function bake(parts, tr) {
  for (var i = 0; i < parts.length; i++) {
    parts[i].base = Engine.X.xform(parts[i].base, tr);
    parts[i].pts = Engine.X.clonePts(parts[i].base);
  }
}
function ellipsePts(c, rx, rz, segs) {
  var pts = [], i, a;
  for (i = 0; i <= segs; i++) {
    a = Math.PI * 2 * i / segs;
    pts.push([c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz]);
  }
  return pts;
}
function circlePtsZ(c, r, segs) {
  var pts = [], i, a;
  for (i = 0; i <= segs; i++) {
    a = Math.PI * 2 * i / segs;
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
  }
  return pts;
}

/* ================= 11. makeDesk 书桌 ================= */
ROOM_PARTS.makeDesk = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({ id: 'desk', label: '书桌', pos: opts.pos || [2.8, 0, 0.52], rotY: opts.rotY || 0 });
  var topG = [], legG = [], i, j;

  /* 桌面：1.7×0.72 厚 0.045，顶面 y0.76 */
  var top = o.box(1.7, 0.045, 0.72, [0, 0.715, 0], { w: 'contour' });
  top.py.bias = 0.25;  /* 大顶面提前绘制：防止盖住台灯/杯子等立于其上的小件 */
  topG.push.apply(topG, top.all);

  /* 背板 + 侧望板 */
  var apB = o.box(1.51, 0.10, 0.028, [0, 0.615, -0.262], { w: 'detail' });
  var apL = o.box(0.028, 0.10, 0.51, [-0.762, 0.615, 0.015], { w: 'detail' });
  var apR = o.box(0.028, 0.10, 0.51, [0.762, 0.615, 0.015], { w: 'detail' });
  topG.push.apply(topG, apB.all);
  topG.push.apply(topG, apL.all);
  topG.push.apply(topG, apR.all);

  /* 四条 0.05 方腿 */
  var lx = [-0.78, 0.78], lz = [-0.28, 0.28];
  for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
    var leg = o.box(0.05, 0.715, 0.05, [lx[i], 0, lz[j]], { w: 'struct' });
    legG.push.apply(legG, leg.all);
  }

  /* 摊开的笔记本：两页 + 书脊 + 字行 */
  var nb = [];
  nb.push(o.panel([[-0.585, 0.7615, -0.02], [-0.318, 0.7615, -0.045], [-0.318, 0.7615, 0.185], [-0.585, 0.7615, 0.205]],
    { fill: 'paper', w: 'detail', pick: false, bias: -0.05 }));
  nb.push(o.panel([[-0.318, 0.7615, -0.045], [-0.052, 0.7615, -0.02], [-0.052, 0.7615, 0.205], [-0.318, 0.7615, 0.185]],
    { fill: 'paper', w: 'detail', pick: false, bias: -0.05 }));
  nb.push(o.line([[-0.318, 0.7622, -0.045], [-0.318, 0.7622, 0.185]], { w: 'detail', bias: -0.05 }));
  var tl = [
    [-0.552, -0.008, -0.352], [-0.552, 0.048, -0.398], [-0.552, 0.104, -0.372],
    [-0.286, -0.008, -0.086], [-0.286, 0.048, -0.140], [-0.286, 0.104, -0.106]
  ];
  for (i = 0; i < tl.length; i++) {
    nb.push(o.line([[tl[i][0], 0.7622, tl[i][1]], [tl[i][2], 0.7622, tl[i][1]]],
      { w: 'hair', col: 'ink2', bias: -0.05 }));
  }
  topG.push.apply(topG, nb);

  /* 细六棱铅笔（segs 6，微转 14° 烘进 base） */
  var pen = [];
  var p0 = [-0.235, 0.7665, 0.27];
  var pBody = o.cyl(p0, 0.006, 0.15, 'x', { segs: 6, profiles: 2, w: 'hair' });
  var pTip = o.cyl([-0.085, 0.7665, 0.27], 0.006, 0.02, 'x', { segs: 6, topR: 0.0015, profiles: 0, w: 'hair' });
  pen.push.apply(pen, pBody.all);
  pen.push.apply(pen, pTip.all);
  bake(pen, { rotY: 14, pivot: p0 });
  topG.push.apply(topG, pen);

  o._spr = new Engine.Spring(2.4, 0.35);
  o._sink = 0;

  o.update = function (dt) {
    var sv = this._spr.tick(dt) * 3.0;   /* kick 3 → 峰值约 0.6° */
    var tgt = this.pressed ? 0.008 : (this.hovered ? 0.004 : 0);
    this._sink = approach(this._sink, tgt, dt, 16);
    applySet(legG, { move: [0, -this._sink, 0] });
    applySet(topG, { rotX: sv, pivot: [0, 0.76, -0.36], move: [0, -this._sink, 0] });
  };
  o.onClick = function () {
    this._spr.kick(3.0);
    AudioKit.wobble();
  };
  return o;
};

/* ================= 12. makeChair 木椅 ================= */
ROOM_PARTS.makeChair = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({ id: 'chair', label: '椅子', pos: opts.pos || [2.8, 0, 1.42], rotY: opts.rotY == null ? 12 : opts.rotY });
  var dyn = [];

  /* 座面 0.46² 厚 0.035（顶 y0.46） */
  var seat = o.box(0.46, 0.035, 0.46, [0, 0.425, 0], { w: 'contour' });
  dyn.push.apply(dyn, seat.all);

  /* 前腿直；后腿延伸成背柱；两横档 + 顶轨 */
  var fl = o.box(0.045, 0.425, 0.045, [-0.195, 0, 0.195], { w: 'struct' });
  var fr = o.box(0.045, 0.425, 0.045, [0.195, 0, 0.195], { w: 'struct' });
  var bl = o.box(0.045, 0.98, 0.045, [-0.195, 0, -0.195], { w: 'struct' });
  var br = o.box(0.045, 0.98, 0.045, [0.195, 0, -0.195], { w: 'struct' });
  var s1 = o.box(0.35, 0.055, 0.026, [0, 0.6525, -0.180], { w: 'detail' });
  var s2 = o.box(0.35, 0.055, 0.026, [0, 0.7925, -0.180], { w: 'detail' });
  var rail = o.box(0.44, 0.10, 0.042, [0, 0.88, -0.195], { w: 'struct' });
  var rest = [fl, fr, bl, br, s1, s2, rail];
  for (var i = 0; i < rest.length; i++) dyn.push.apply(dyn, rest[i].all);

  o.outT = 1;        /* 1 = 拉出（即 SPEC 锚点位）；0 = 推进 */
  o._hk = 0;
  o._sink = 0;

  o.update = function (dt) {
    this._hk = approach(this._hk, this.hovered ? 1 : 0, dt, 10);
    this._sink = approach(this._sink, this.pressed ? 0.007 : 0, dt, 16);
    applySet(dyn, {
      rotY: 2 * this._hk, pivot: [0, 0.23, 0],
      move: [0, -this._sink, (this.outT - 1) * 0.32]
    });
  };
  o.onClick = function () {
    var to = this.outT > 0.5 ? 0 : 1;
    AudioKit.slide();
    Tweens.add(this, 'outT', to, {
      dur: 0.7, ease: Engine.E.cubicInOut,
      onDone: function () { AudioKit.thunk(); }
    });
  };
  return o;
};

/* ================= 13. makeLamp 台灯 ================= */
ROOM_PARTS.makeLamp = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({ id: 'lamp', label: '台灯', pos: opts.pos || [2.12, 0.76, 0.48], rotY: opts.rotY || 0 });
  o.on = true;

  /* 底座圆台 + 两节微弯折立杆 + 关节箍 + 拉环 */
  var base = o.cyl([0, 0, 0], 0.085, 0.032, 'y', { topR: 0.056, segs: 22, profiles: 4, capFill: 'paper', w: 'detail' });
  o.line([[0, 0.030, 0], [0, 0.208, 0]], { w: 'struct' });
  o.line([[0, 0.208, 0], [0.032, 0.348, 0]], { w: 'struct' });
  o.circ([0.008, 0.208, 0], 0.015, 'z', { w: 'detail' });
  o.line([[0.118, 0.346, 0.055], [0.118, 0.298, 0.055]], { w: 'hair' });
  o.circ([0.118, 0.286, 0.055], 0.011, 'z', { w: 'detail' });

  /* 立杆拾取代理（线框不可拾取，补一块不可见面片） */
  o.panel([[-0.032, 0.03, 0], [0.072, 0.03, 0], [0.072, 0.35, 0], [-0.032, 0.35, 0]],
    { fill: null, w: 'none', pick: true });

  /* 灯罩圆台（fill:'paper'，顶盖封口） */
  var shade = o.cyl([0.032, 0.348, 0], 0.155, 0.168, 'y', { topR: 0.052, segs: 26, profiles: 4, capFill: 'paper', w: 'detail' });
  var shadeG = [];
  shadeG.push.apply(shadeG, shade.all);
  /* 灯罩拾取代理：过罩轴的纵切四边形（不可见、可拾取） */
  shadeG.push(o.panel([[0.032 - 0.155, 0.348, 0], [0.032 + 0.155, 0.348, 0], [0.032 + 0.052, 0.516, 0], [0.032 - 0.052, 0.516, 0]],
    { fill: null, w: 'none', pick: true }));
  /* 灯泡小圆（亮时填充暖色） */
  var bulb = o.panel(circlePtsZ([0.032, 0.356, 0], 0.024, 14), { fill: null, col: 'ink2', w: 'hair', pick: false });
  shadeG.push(bulb);

  /* 桌面光池椭圆（灯下，随开关显隐/换色） */
  var pool = o.panel(ellipsePts([0.05, 0.004, 0], 0.22, 0.16, 28),
    { fill: null, w: 'none', pick: false, bias: 0.02 });
  pool.hidden = true;

  o._spr = new Engine.Spring(2.8, 0.34);
  o._hk = 0;

  o.update = function (dt) {
    var sv = this._spr.tick(dt) * 1.8;
    this._hk = approach(this._hk, this.hovered ? 1 : 0, dt, 10);
    applySet(shadeG, { rotX: 6 * this._hk, rotZ: sv, pivot: [0.032, 0.348, 0] });
    if (this.on) {
      var m = Env.mode();
      var ga = m === 'nightDark' ? 0.30 : (Env.isNight ? 0.10 : 0.05);
      Engine.FX.glow(this.world([0.032, 0.342, 0]), 0.55, Env.C.glowRgb, ga);
      pool.hidden = false;
      pool.fill = rgba(Env.C.glowRgb, m === 'nightDark' ? 0.16 : 0.10);
      bulb.fill = rgba(Env.C.glowRgb, 0.5);
    } else {
      pool.hidden = true;
      bulb.fill = null;
    }
  };
  o.onClick = function () {
    this.on = !this.on;
    AudioKit.switchToggle(this.on);
    this._spr.kick(3.0);
  };
  return o;
};

/* ================= 14. makeCup 杯子 ================= */
ROOM_PARTS.makeCup = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({ id: 'cup', label: '杯子', pos: opts.pos || [3.28, 0.76, 0.6], rotY: opts.rotY || 0 });

  /* 碟盘：填充椭圆 + 内环 */
  o.panel(ellipsePts([0, 0.005, 0], 0.075, 0.075, 28), { fill: 'paper', w: 'detail', bias: 0.01 });
  o.ellip([0, 0.007, 0], 0.044, 0.044, { w: 'hair', col: 'ink2', segs: 20 });

  /* 杯体 cyl topR0.042 r0.036 h0.095 + 杯口内椭圆 + 把手弧(axis 'z') */
  var body = o.cyl([0, 0.012, 0], 0.036, 0.095, 'y', { topR: 0.042, segs: 20, profiles: 2, w: 'detail' });
  var bodyG = [];
  bodyG.push.apply(bodyG, body.all);
  bodyG.push(o.ellip([0, 0.099, 0], 0.034, 0.034, { w: 'hair', col: 'ink2', segs: 20 }));
  bodyG.push(o.circ([0.036, 0.062, 0], 0.027, 'z', { arc0: -1.31, arc1: 1.31, closed: false, w: 'detail' }));
  bodyG.push(o.line([[0.0365, 0.0357, 0], [0.0432, 0.0357, 0]], { w: 'hair' }));
  bodyG.push(o.line([[0.0418, 0.0883, 0], [0.0432, 0.0883, 0]], { w: 'hair' }));
  /* 杯体+把手拾取代理（cyl 圈线恒不可拾取，补不可见面片） */
  bodyG.push(o.panel([[-0.042, 0.012, 0], [0.066, 0.012, 0], [0.066, 0.110, 0], [-0.042, 0.110, 0]],
    { fill: null, w: 'none', pick: true }));

  o._spr = new Engine.Spring(3.2, 0.34);
  o._acc = 0.3;

  o.update = function (dt) {
    /* 持续蒸汽：0.5s 一粒，hover 加密至 0.22s */
    this._acc += dt;
    var iv = this.hovered ? 0.22 : 0.5;
    if (this._acc >= iv) {
      this._acc = 0;
      Engine.FX.puff(this.world([0, 0.112, 0]),
        { n: 1, spread: 0.012, rise: 0.14, size: 0.014, life: 1.8, alpha: 0.22, col: Env.C.inkRgb });
    }
    applySet(bodyG, { rotZ: this._spr.tick(dt) * 1.4, pivot: [0, 0.012, 0] });
  };
  o.onClick = function () {
    Engine.FX.puff(this.world([0, 0.112, 0]),
      { n: 8, spread: 0.03, rise: 0.20, size: 0.016, life: 1.3, alpha: 0.26, col: Env.C.inkRgb });
    AudioKit.puff();
    this._spr.kick(2.6);
  };
  return o;
};

/* ================= 15. makeBookshelf 书架 ================= */
ROOM_PARTS.makeBookshelf = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({ id: 'bookshelf', label: '书架', pos: opts.pos || [0.17, 0, 1.55], rotY: opts.rotY == null ? 90 : opts.rotY });

  var T = 0.028, IW = 0.772, D2 = 0.16, H = 2.05;
  var struct = [];   /* 随架体一起 Spring 轻晃的静态部件 */

  /* 侧板 ×2 + 背板（fill:'paper' 遮挡）+ 底板 + 顶板 */
  var sdL = o.box(T, H, 0.32, [-0.786, 0, 0], { w: 'struct' });
  var sdR = o.box(T, H, 0.32, [0.786, 0, 0], { w: 'struct' });
  struct.push.apply(struct, sdL.all);
  struct.push.apply(struct, sdR.all);
  struct.push(o.panel([[-IW, 0.02, -0.145], [IW, 0.02, -0.145], [IW, H - 0.02, -0.145], [-IW, H - 0.02, -0.145]],
    { fill: 'paper', w: 'none' }));
  var bt = o.box(1.6, 0.05, 0.32, [0, 0, 0], { w: 'struct' });
  var tc = o.box(1.6, 0.03, 0.32, [0, H - 0.03, 0], { w: 'struct' });
  struct.push.apply(struct, bt.all);
  struct.push.apply(struct, tc.all);

  /* 4 层隔板（顶面 + 前缘，各一面片） */
  function board(y) {
    struct.push(o.panel([[-IW, y, -0.15], [IW, y, -0.15], [IW, y, D2], [-IW, y, D2]],
      { fill: 'paper', w: 'detail' }));
    struct.push(o.panel([[-IW, y - 0.028, D2], [IW, y - 0.028, D2], [IW, y, D2], [-IW, y, D2]],
      { fill: 'paper', w: 'detail' }));
  }
  board(0.42); board(0.79); board(1.16); board(1.53);

  /* 立书：前脸(书脊) + 顶面 + 侧面(-x) + 1~2 条 'hair' 书脊线 */
  function buildBook(xc, y0, t, h, seed, proud) {
    var z1 = proud ? 0.106 : 0.10, z0 = -0.13;
    var x0 = xc - t / 2, x1 = xc + t / 2;
    var ps = [];
    ps.push(o.panel([[x0, y0, z1], [x1, y0, z1], [x1, y0 + h, z1], [x0, y0 + h, z1]],
      { fill: 'paper', w: 'detail' }));
    ps.push(o.panel([[x0, y0 + h, z1], [x1, y0 + h, z1], [x1, y0 + h, z0], [x0, y0 + h, z0]],
      { fill: 'paper', w: 'hair' }));
    ps.push(o.panel([[x0, y0, z1], [x0, y0, z0], [x0, y0 + h, z0], [x0, y0 + h, z1]],
      { fill: 'paper', w: 'hair' }));
    var n = h1(seed + 91) > 0.55 ? 2 : 1;
    for (var k = 0; k < n; k++) {
      var lx = xc + (k === 0 ? -t * 0.22 : t * 0.22);
      ps.push(o.line([[lx, y0 + 0.03, z1 + 0.002], [lx, y0 + h - 0.03, z1 + 0.002]],
        { w: 'hair', col: 'ink2' }));
    }
    return ps;
  }

  /* 平放书（一摞）：顶面 + 前缘 + 侧面 */
  function flatSlab(x0, y0, w, h, d, z1) {
    var z0 = z1 - d, x1 = x0 + w, y1 = y0 + h;
    return [
      o.panel([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], { fill: 'paper', w: 'detail' }),
      o.panel([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], { fill: 'paper', w: 'detail' }),
      o.panel([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], { fill: 'paper', w: 'hair' })
    ];
  }

  /* 三本互动书（部件组；引擎仅对象级 label，书名在此备注） */
  var recs = [
    { name: '旧书', t: 0.036, h: 0.222, letter: false, red: false },
    { name: '厚书', t: 0.052, h: 0.260, letter: false, red: false },
    { name: '红封皮书', t: 0.038, h: 0.238, letter: true, red: true }
  ];
  var ri;
  for (ri = 0; ri < recs.length; ri++) {
    recs[ri].outT = 0;
    recs[ri].hoverK = 0;
    recs[ri].letterShown = false;
    recs[ri].parts = [];
    recs[ri].slip = [];
  }
  var recIdx = 0;

  /* 一层书：'S' 静态书（疏密/高低节奏来自确定性伪随机），'I' 互动书 */
  function row(y0, seed, plan) {
    var cursor = -0.74;
    for (var p = 0; p < plan.length; p++) {
      var id = seed + p * 13;
      if (h1(id + 71) > 0.8) cursor += 0.055;   /* 偶尔留一口呼吸空隙 */
      var t, h, ps2;
      if (plan[p] === 'I') {
        var rec = recs[recIdx++];
        t = rec.t; h = rec.h;
        var bx = cursor + t / 2;
        rec.parts = buildBook(bx, y0, t, h, id, true);
        /* 隐形拾取代理：前脸外 19mm，保证书在屏幕重叠时优先命中 */
        rec.parts.push(o.panel(
          [[bx - t / 2 - 0.012, y0 - 0.008, 0.125], [bx + t / 2 + 0.012, y0 - 0.008, 0.125],
           [bx + t / 2 + 0.012, y0 + h + 0.012, 0.125], [bx - t / 2 - 0.012, y0 + h + 0.012, 0.125]],
          { fill: null, w: 'none', pick: true }));
        if (rec.letter) {   /* 夹信的书：信纸斜插出（默认 alpha 0） */
          var yT = y0 + h;
          rec.slip.push(o.panel(
            [[bx - 0.026, yT - 0.055, 0.055], [bx + 0.026, yT - 0.055, 0.055],
             [bx + 0.036, yT + 0.060, 0.105], [bx - 0.036, yT + 0.060, 0.105]],
            { fill: 'paper', w: 'hair', col: 'ink2', pick: false, alpha: 0 }));
          rec.slip.push(o.line([[bx - 0.031, yT + 0.005, 0.079], [bx + 0.031, yT + 0.005, 0.079]],
            { w: 'hair', col: 'ink2', alpha: 0 }));
        }
        cursor += t + 0.014;
      } else {
        t = 0.030 + h1(id) * 0.020;
        h = 0.200 + h1(id + 37) * 0.060;
        ps2 = buildBook(cursor + t / 2, y0, t, h, id, false);
        struct.push.apply(struct, ps2);
        cursor += t + 0.012 + h1(id + 53) * 0.028;
      }
    }
  }

  row(0.05, 11, ['S', 'S', 'S', 'I', 'S', 'S']);   /* 底层 · 旧书 */
  row(0.42, 29, ['S', 'S', 'I', 'S', 'S', 'S']);   /* 二层 · 厚书 */
  row(0.79, 47, ['S', 'S', 'I', 'S']);             /* 三层 · 红封皮书 */

  /* 斜靠书：rotZ -8° 绕右下角烘焙（倚右内侧板，左下角微微翘起） */
  var lean = buildBook(0.714, 0.42, 0.042, 0.245, 77, false);
  bake(lean, { rotZ: -8, pivot: [0.735, 0.42, 0] });
  struct.push.apply(struct, lean);

  /* 三层右侧平放一摞（两本，错位叠放） */
  var fs1 = flatSlab(0.06, 0.79, 0.20, 0.034, 0.15, 0.085);
  var fs2 = flatSlab(0.076, 0.824, 0.185, 0.030, 0.14, 0.078);
  struct.push.apply(struct, fs1);
  struct.push.apply(struct, fs2);

  /* 第 4 层：书立 + 小收纳盒 */
  struct.push(o.panel([[-0.12, 1.16, 0.02], [-0.12, 1.16, 0.13], [-0.12, 1.31, 0.13], [-0.12, 1.31, 0.02]],
    { fill: 'paper', w: 'detail' }));
  struct.push(o.panel([[-0.12, 1.16, 0.02], [-0.055, 1.16, 0.02], [-0.055, 1.168, 0.02], [-0.12, 1.168, 0.02]],
    { fill: 'paper', w: 'detail' }));
  var mini = o.box(0.16, 0.15, 0.14, [-0.48, 1.16, -0.02], { w: 'detail' });
  struct.push.apply(struct, mini.all);

  /* 顶格：小相框（框+衬线+山脊线+小圆月）+ 收纳盒 */
  struct.push(o.panel([[-0.385, 1.53, 0.025], [-0.215, 1.53, 0.025], [-0.215, 1.715, 0.025], [-0.385, 1.715, 0.025]],
    { fill: 'paper', w: 'detail' }));
  struct.push(o.line([[-0.365, 1.55, 0.026], [-0.235, 1.55, 0.026], [-0.235, 1.695, 0.026], [-0.365, 1.695, 0.026], [-0.365, 1.55, 0.026]],
    { w: 'hair', col: 'ink2' }));
  struct.push(o.line([[-0.362, 1.585, 0.027], [-0.325, 1.645, 0.027], [-0.30, 1.612, 0.027], [-0.262, 1.662, 0.027], [-0.24, 1.618, 0.027]],
    { w: 'hair' }));
  struct.push(o.circ([-0.243, 1.668, 0.027], 0.011, 'z', { w: 'hair', col: 'ink2' }));
  var stBox = o.box(0.30, 0.21, 0.24, [0.34, 1.53, -0.005], { w: 'detail' });
  struct.push.apply(struct, stBox.all);
  struct.push(o.line([[0.205, 1.660, 0.116], [0.475, 1.660, 0.116]], { w: 'hair', col: 'ink2' }));
  struct.push(o.circ([0.34, 1.605, 0.117], 0.013, 'z', { w: 'hair', col: 'ink2' }));

  o._spr = new Engine.Spring(2.2, 0.38);
  o._books = recs;
  o._struct = struct;

  o.update = function (dt) {
    var sv = this._spr.tick(dt) * 3.0;
    var hp = Engine.hoverPart();
    var i, k, s;
    for (i = 0; i < recs.length; i++) {
      var rec = recs[i];
      var hov = inList(rec.parts, hp);
      rec.hoverK = approach(rec.hoverK, hov ? 1 : 0, dt, 12);
      var tr = { rotZ: sv, pivot: [0, 1.02, 0], move: [0, 0, rec.outT * 0.14 + rec.hoverK * 0.015] };
      applySet(rec.parts, tr);
      applySet(rec.slip, tr);
      if (rec.red) rec.parts[0].fill = rgba(Env.C.glowRgb, 0.26);   /* 暖色封面派生自 Env.C.glowRgb */
      if (rec.letter) {
        k = clamp01((rec.outT - 0.7) / 0.25);
        for (s = 0; s < rec.slip.length; s++) rec.slip[s].alpha = k;
        if (rec.outT > 0.7 && !rec.letterShown) {
          rec.letterShown = true;
          AudioKit.pageFlip();
        } else if (rec.outT < 0.4 && rec.letterShown) {
          rec.letterShown = false;
        }
      }
    }
    applySet(struct, { rotZ: sv, pivot: [0, 1.02, 0] });
  };

  o.onClick = function (part) {
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i];
      if (inList(rec.parts, part) || inList(rec.slip, part)) {
        var to = rec.outT > 0.5 ? 0 : 1;
        if (to === 1) AudioKit.pageFlip(); else AudioKit.slide();
        Tweens.add(rec, 'outT', to, { dur: 0.45, ease: Engine.E.cubicOut });
        return;
      }
    }
    this._spr.kick(2.4);
    AudioKit.wobble();
  };
  return o;
};

})();
