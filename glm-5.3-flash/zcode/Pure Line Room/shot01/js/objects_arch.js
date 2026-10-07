/* ============================================================
 * Pure Line Room — objects_arch.js（建筑组 · SPEC §7 A 组 1~5）
 * ------------------------------------------------------------
 * 对象清单（工厂 → id / label）与交互说明：
 *  makeShell       → 'shell'  房间壳体（无 label、pickable:false、layerBias −60）
 *    地板/天花/两墙 paper 面 + struct 轮廓线 + 近侧 contour 强调线；
 *    地板 12 条木纹分区线（z 每 0.72 一条）+ 每板 2~3 条错缝短线
 *    （确定性伪随机 h01）+ 两墙 y0.09 / y0.022 双踢脚线。全静态。
 *  makeDoor        → 'door'   门
 *    门框（左右梃 + 门楣 + 门止线 + 槛线 + 门楣线）；门扇 paper 盒体
 *    + 上下两块凹面板线 + 把手（玫瑰盘 + 压杆 + 端头）+ 锁孔；
 *    铰链在左侧。点击：openT 0↔1，门扇绕铰链 rotY −78°（cubicInOut
 *    0.9s）转入房间 +z，AudioKit.doorMove(open)，落位 AudioKit.thunk()；
 *    门洞常驻 fill:'void' 暗背板（pick:false），关门时仅露四周阴影缝。
 *    hover：把手绕玫瑰盘微转 15°；press：门扇下沉 6mm。
 *  makeWindow      → 'window' 窗
 *    窗框四边 + 进深暗示线 + 十字窗棂 + 外挑窗台；fill:'sky' 天空背板
 *    （z −0.01，pick:false）。昼：太阳双圈 + 10 根光芒短线 + 2 朵云
 *    （双弧 + 底线）；夜：双弧月牙 + 8 颗星（十字 / 圆点）逐颗 sin
 *    闪烁——两套内容 alpha 分别乘 (1−Env.skyT) / Env.skyT 交叉淡化。
 *    昼间：地板 fill:'sun' 光束四边形（bias −0.5）+ 两条窗棂投影细线
 *    + 每 0.7s 一粒 FX.puff 尘埃（Env.C.glowRgb、alpha 0.05、n1；
 *    窗帘合上时同步减弱）。点击：Env.setNight(!Env.isNight) +
 *    AudioKit.shift() + 窗框 Spring 轻震（rotZ 绕窗台线 + 微移）。
 *    hover：天空低 alpha 暖色高亮框（面板 + 描边，hoverT 渐变）。
 *  makeCurtains    → 'curtains' 窗帘
 *    帘杆 + 两端球头 + 墙架；每侧 5 条竖波纹布条（paper 多边形，
 *    update 内逐顶点重建：开态收拢于两侧 x 压缩 / 合态铺满窗宽，
 *    curtainT Tween 0.8s cubicInOut + AudioKit.swish()）。持续：底缘
 *    sin 波动 + z 向褶皱行波，摆幅 ×(1+1.2·fan.speed)（读
 *    Engine.scene.get('fan')，容错缺省 0），hover 摆幅 +30%。
 *    布条本体可拾取 + 帘杆隐形拾取代理。
 *  makeLightSwitch → 'switch' 电灯开关
 *    底板盒 + 内框线 + 上下螺钉 + 拨钮盒（带中线）。点击：拨钮
 *    rotX 翻转 ±11° 且 move y ±0.014（backOut 0.25s）+
 *    Env.setLights(!Env.lightsOn) + AudioKit.switchToggle(on)；
 *    update 与 Env.lightsOn 持续同步（吊灯 / 台灯开灯时拨钮跟随翻转）。
 *    hover：拨钮外探 0.004；press：整体沉入墙 4mm。
 * 约束：普通 <script> 全局脚本；颜色全部 Env.C.*（允许由 glowRgb 等
 *       派生 rgba 字符串）；工厂可重复调用（无模块级可变状态）；
 *       工厂内禁止 Math.random —— 确定性伪随机
 *       h01(i)=fract(sin(i·127.1)·43758.5453)（Math.random 仅存在于
 *       引擎 FX 粒子内部的运行期抖动）。
 * ============================================================ */
(function () {
'use strict';

var W = window;
W.ROOM_PARTS = W.ROOM_PARTS || {};

var X = Engine.X;            // 引擎变换（xform / clonePts）
var TE = Engine.E;           // 缓动函数集
var Tweens = W.Tweens;
var AK = (typeof AudioKit !== 'undefined') ? AudioKit : null;
var D2R = Math.PI / 180;

/* ---------------- 纯函数小工具（确定性、可重复调用） ---------------- */
function fract(x) { return x - Math.floor(x); }
function h01(i) { return fract(Math.sin(i * 127.1) * 43758.5453); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rgba(rgb, a) {
  return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')';
}
/* 闭合矩形折线（5 点，首尾相接） */
function rectZc(x0, y0, x1, y1, z) {
  return [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]];
}
/* z 平面圆盘点列（遮挡 / 玫瑰盘） */
function discZ(cx, cy, cz, r, n) {
  var p = [], i, a;
  for (i = 0; i < n; i++) {
    a = Math.PI * 2 * i / n;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
  }
  return p;
}
function pushAll(arr, lists) {
  for (var i = 0; i < lists.length; i++) {
    for (var j = 0; j < lists[i].length; j++) arr.push(lists[i][j]);
  }
}

/* hover / press 平滑过渡接线（各工厂复用） */
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

/* 两段式部件组变换：local（局部动画）→ body（机体反馈）；全零时复位一次 */
function applyGroup(ps, local, body, state, key) {
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

/* 机体反馈变换（角度制 / 位移米），幅度皆近零时返回 null */
function xfIf(pivot, rx, ry, rz, mv) {
  var has = (rx && Math.abs(rx) > 0.003) || (ry && Math.abs(ry) > 0.003) ||
            (rz && Math.abs(rz) > 0.003) ||
            (mv && (Math.abs(mv[0]) > 0.0004 || Math.abs(mv[1]) > 0.0004 || Math.abs(mv[2]) > 0.0004));
  if (!has) return null;
  var f = { pivot: pivot };
  if (rx) f.rotX = rx;
  if (ry) f.rotY = ry;
  if (rz) f.rotZ = rz;
  if (mv) f.move = mv;
  return f;
}

/* ============================================================
 * 1. makeShell — 房间壳体（x∈[0,10] z∈[0,9] y∈[0,4]）
 * 注：SPEC §7.1 写 layerBias:-60，但引擎实测排序为 d 大者先画
 * （正 bias = 更早画 / 更靠后层）。-60 会把壳体画到整个场景最上层。
 * 为实现"壳体永远是最底层背景"的意图，这里改用 +60，并用 +4 的
 * part.bias 把壳体大面填充压到壳体自身线稿之前（大面平均深度居中，
 * 不加正偏移会交替遮住贴近后墙的木纹线）。
 * 已在交付报告中向主控注明该符号偏离。
 * ============================================================ */
W.ROOM_PARTS.makeShell = function () {
  var o = new Engine.RoomObject({
    id: 'shell', label: '', pos: [0, 0, 0], rotY: 0,
    layerBias: 60, pickable: false
  });
  var RX = 10, RY = 4, RZ = 9, i, k, p;

  /* 体块面（paper 遮挡；bias +4 → 壳体大面的平均深度小于自身线稿，需正偏移压到最先画） */
  o.panel([[0, 0, 0], [RX, 0, 0], [RX, 0, RZ], [0, 0, RZ]],
    { fill: 'paper', w: 'none', pick: false, bias: 4 });            // 地板
  o.panel([[0, RY, 0], [RX, RY, 0], [RX, RY, RZ], [0, RY, RZ]],
    { fill: 'paper', w: 'none', pick: false, bias: 4 });            // 天花
  o.panel([[0, 0, 0], [RX, 0, 0], [RX, RY, 0], [0, RY, 0]],
    { fill: 'paper', w: 'none', pick: false, bias: 4 });            // 后墙 z=0
  o.panel([[0, 0, 0], [0, 0, RZ], [0, RY, RZ], [0, RY, 0]],
    { fill: 'paper', w: 'none', pick: false, bias: 4 });            // 左墙 x=0

  /* 轮廓线：地/天花矩形 + 两墙竖边（struct） */
  o.line([[0, 0, 0], [RX, 0, 0], [RX, 0, RZ], [0, 0, RZ], [0, 0, 0]],
    { w: 'struct', col: 'ink' });
  o.line([[0, RY, 0], [RX, RY, 0], [RX, RY, RZ], [0, RY, RZ], [0, RY, 0]],
    { w: 'struct', col: 'ink' });
  o.line([[0, 0, 0], [0, RY, 0]], { w: 'struct', col: 'ink' });   // 墙角竖线
  o.line([[RX, 0, 0], [RX, RY, 0]], { w: 'struct', col: 'ink' }); // 后墙东端
  o.line([[0, 0, RZ], [0, RY, RZ]], { w: 'struct', col: 'ink' }); // 左墙南端

  /* 近侧剪影强调（contour）：地板/天花南缘与东缘 + 开放角竖线 */
  o.line([[0, 0, RZ], [RX, 0, RZ]], { w: 'contour', col: 'ink' });
  o.line([[RX, 0, 0], [RX, 0, RZ]], { w: 'contour', col: 'ink' });
  o.line([[0, RY, RZ], [RX, RY, RZ]], { w: 'contour', col: 'ink' });
  o.line([[RX, RY, 0], [RX, RY, RZ]], { w: 'contour', col: 'ink' });
  o.line([[RX, 0, RZ], [RX, RY, RZ]], { w: 'contour', col: 'ink' });

  /* 地板木纹：12 条平行分区线（z 每 0.72）→ 13 块板 */
  for (i = 1; i <= 12; i++) {
    var zg = i * 0.72;
    o.line([[0.02, 0.0015, zg], [RX - 0.02, 0.0015, zg]],
      { w: 'hair', col: 'ink2', pick: false });
  }
  /* 每板 2~3 条错缝短线（板缝，确定性布点） */
  for (p = 0; p < 13; p++) {
    var z0 = p * 0.72;
    var nSeam = 2 + (h01(p * 3 + 1) > 0.5 ? 1 : 0);
    for (k = 0; k < nSeam; k++) {
      var sx = 0.4 + h01(p * 7 + k * 13 + 2) * 9.2;
      var zEnd = Math.min(RZ - 0.05, z0 + 0.65);
      o.line([[sx, 0.0018, z0 + 0.07], [sx, 0.0018, zEnd]],
        { w: 'hair', col: 'ink2', alpha: 0.85, pick: false });
    }
  }

  /* 两墙踢脚线（y0.09 主线 + y0.022 阴影线，hair/ink2） */
  o.line([[0.01, 0.09, 0.014], [RX - 0.01, 0.09, 0.014]],
    { w: 'hair', col: 'ink2', pick: false });
  o.line([[0.014, 0.09, 0.01], [0.014, 0.09, RZ - 0.01]],
    { w: 'hair', col: 'ink2', pick: false });
  o.line([[0.01, 0.022, 0.014], [RX - 0.01, 0.022, 0.014]],
    { w: 'hair', col: 'ink2', alpha: 0.7, pick: false });
  o.line([[0.014, 0.022, 0.01], [0.014, 0.022, RZ - 0.01]],
    { w: 'hair', col: 'ink2', alpha: 0.7, pick: false });

  return o;
};

/* ============================================================
 * 2. makeDoor — 门（后墙，铰链在左，开启转入房间 +z）
 * ============================================================ */
W.ROOM_PARTS.makeDoor = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'door', label: '门',
    pos: opts.pos || [8.62, 0, 0.02], rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var HINGE = [-0.45, 0, 0.06];       // 左侧铰链（局部）
  var HX = 0.30, HY = 1.03, HZ = 0.088; // 把手玫瑰盘心

  /* ---- 门框（静止）：左右门梃 + 门楣 ---- */
  var frame = [];
  pushAll(frame, [
    o.box(0.07, 2.19, 0.12, [-0.505, 0, 0.06], { w: 'struct' }).all,
    o.box(0.07, 2.19, 0.12, [0.505, 0, 0.06], { w: 'struct' }).all,
    o.box(1.08, 0.07, 0.12, [0, 2.12, 0.06], { w: 'struct' }).all
  ]);
  frame.push(o.line(rectZc(-0.545, 0, 0.545, 2.19, 0.121),
    { w: 'detail', col: 'ink2' }));                                    // 门头线
  frame.push(o.line(rectZc(-0.47, 0.005, 0.47, 2.115, 0.115),
    { w: 'hair', col: 'ink2', alpha: 0.8 }));                          // 门止内框线
  frame.push(o.line([[-0.52, 0.004, 0.135], [0.52, 0.004, 0.135]],
    { w: 'hair', col: 'ink2' }));                                      // 槛线

  /* ---- 门洞暗背板（fill:'void'，pick:false）----
   * 比门洞略宽，边缘塞进门梃之后；关门时门扇遮挡，四周只露阴影缝。
   * bias +2：背板是本物体最远背景板，避免斜视角下被门扇/门框反超 */
  o.panel([[-0.48, 0, -0.008], [0.48, 0, -0.008], [0.48, 2.13, -0.008], [-0.48, 2.13, -0.008]],
    { fill: 'void', w: 'none', pick: false, bias: 2 });

  /* ---- 门扇（铰链组）---- */
  var leafBase = [];
  pushAll(leafBase, [o.box(0.88, 2.06, 0.045, [-0.01, 0.03, 0.0575], { w: 'contour' }).all]);
  leafBase.push(o.line(rectZc(-0.31, 1.20, 0.29, 1.94, 0.081),
    { w: 'detail', col: 'ink' }));                                     // 上凹面板
  leafBase.push(o.line(rectZc(-0.325, 1.185, 0.325, 1.955, 0.081),
    { w: 'hair', col: 'ink2' }));
  leafBase.push(o.line(rectZc(-0.31, 0.20, 0.29, 1.00, 0.081),
    { w: 'detail', col: 'ink' }));                                     // 下凹面板
  leafBase.push(o.line(rectZc(-0.325, 0.185, 0.325, 1.015, 0.081),
    { w: 'hair', col: 'ink2' }));
  /* 玫瑰盘（随门扇转，但不随把手翻转） */
  leafBase.push(o.circ([HX, HY, HZ], 0.027, 'z', { w: 'detail', col: 'ink', segs: 14 }));
  leafBase.push(o.panel(discZ(HX, HY, HZ, 0.027, 14),
    { fill: 'paper', w: 'none', pick: false, bias: 0.004 }));
  /* 锁孔 */
  leafBase.push(o.circ([HX, HY - 0.16, HZ], 0.009, 'z', { w: 'hair', col: 'ink', segs: 10 }));
  leafBase.push(o.line([[HX, HY - 0.165, HZ], [HX, HY - 0.205, HZ]], { w: 'hair', col: 'ink' }));
  /* 门扇隐形拾取代理（略大于门扇，开门后依然易点） */
  leafBase.push(o.panel([[-0.465, 0.02, 0.092], [0.445, 0.02, 0.092], [0.445, 2.10, 0.092], [-0.465, 2.10, 0.092]],
    { fill: null, w: 'none', pick: true }));

  /* 把手压杆 + 端头（hover 绕玫瑰盘心 rotZ） */
  var handleParts = [
    o.line([[HX - 0.012, HY, HZ], [HX - 0.10, HY - 0.018, HZ + 0.007]],
      { w: 'struct', col: 'ink' }),
    o.circ([HX - 0.10, HY - 0.018, HZ + 0.007], 0.013, 'z',
      { w: 'detail', col: 'ink', segs: 10 })
  ];

  bindFeedback(o);
  o.openT = 0;
  o.isOpen = false;
  o.onClick = function () {
    this.isOpen = !this.isOpen;
    var self = this;
    Tweens.add(this, 'openT', this.isOpen ? 1 : 0, {
      dur: 0.9, ease: TE.cubicInOut,
      onDone: function () { if (AK) AK.thunk(); }
    });
    if (AK) AK.doorMove(this.isOpen);
  };
  o.update = function () {
    var open = this.openT;
    var hingeXf = open > 0.0005 ? { rotY: -78 * open, pivot: HINGE } : null;
    var sinkXf = xfIf([0, 0, 0.06], 0, 0, 0, [0, -0.006 * this.pressT, 0]);
    applyGroup(leafBase, hingeXf, sinkXf, this, '_lb');

    /* 把手：局部 rotZ（hover 15°）→ 铰链 → 下沉，三级复合 */
    var hz = -15 * this.hoverT;
    var hLocal = Math.abs(hz) > 0.05 ? { rotZ: hz, pivot: [HX, HY, HZ] } : null;
    for (var i = 0; i < handleParts.length; i++) {
      var q = hLocal ? X.xform(handleParts[i].base, hLocal) : X.clonePts(handleParts[i].base);
      if (hingeXf) q = X.xform(q, hingeXf);
      if (sinkXf) q = X.xform(q, sinkXf);
      handleParts[i].pts = q;
    }
  };

  return o;
};

/* ============================================================
 * 3. makeWindow — 窗（后墙，x 1.88..3.72 / y 1.02..2.78，厚 0.09）
 * ============================================================ */
W.ROOM_PARTS.makeWindow = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'window', label: '窗',
    pos: opts.pos || [2.8, 0, 0.02], rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var ZF = 0.095;        // 窗框前脸
  var ZS = -0.004;       // 天空内容平面
  var SUN = [0.40, 2.26];
  var MX = -0.34, MY = 2.30; // 月心

  /* ---- 窗框（Spring 震动组）---- */
  var frame = [];
  function fr(p) { frame.push(p); return p; }
  fr(o.panel(rectZc(-0.92, 2.71, 0.92, 2.78, ZF).slice(0, 4), { fill: 'paper', w: 'struct' })); // 上边
  fr(o.panel(rectZc(-0.92, 1.02, 0.92, 1.09, ZF).slice(0, 4), { fill: 'paper', w: 'struct' })); // 下边
  fr(o.panel(rectZc(-0.92, 1.09, -0.85, 2.71, ZF).slice(0, 4), { fill: 'paper', w: 'struct' })); // 左边
  fr(o.panel(rectZc(0.85, 1.09, 0.92, 2.71, ZF).slice(0, 4), { fill: 'paper', w: 'struct' }));  // 右边
  fr(o.line(rectZc(-0.85, 1.09, 0.85, 2.71, 0.018), { w: 'detail', col: 'ink2' })); // 进深暗示
  fr(o.panel(rectZc(-0.022, 1.09, 0.022, 2.71, 0.07).slice(0, 4), { fill: 'paper', w: 'detail' })); // 竖棂
  fr(o.panel(rectZc(-0.85, 1.878, 0.85, 1.922, 0.07).slice(0, 4), { fill: 'paper', w: 'detail' })); // 横棂
  pushAll(frame, [o.box(2.04, 0.05, 0.18, [0, 0.965, 0.10], { w: 'struct' }).all]);  // 窗台
  fr(o.panel(rectZc(-0.92, 1.02, 0.92, 2.78, 0.105).slice(0, 4),
    { fill: null, w: 'none', pick: true, bias: 2 }));                 // 全幅拾取代理（与天空同层）

  /* ---- 天空背板（+2：天空是本物体的最远背景板，压到所有前景之后，
   * 避免斜视角下大面平均深度与窗帘布条交错导致天空盖住布条）---- */
  o.panel(rectZc(-0.86, 1.08, 0.86, 2.72, -0.01).slice(0, 4),
    { fill: 'sky', w: 'none', pick: false, bias: 2 });

  /* ---- 昼间内容（alpha × (1−skyT)）---- */
  var dayParts = [];
  function fd(p) { p._a0 = p.alpha; dayParts.push(p); return p; }
  /* 太阳：双圈 + 10 光芒短线 */
  fd(o.circ([SUN[0], SUN[1], ZS], 0.075, 'z', { w: 'detail', col: 'ink', segs: 22 }));
  fd(o.circ([SUN[0], SUN[1], ZS], 0.052, 'z', { w: 'hair', col: 'ink2', segs: 18 }));
  var ri;
  for (ri = 0; ri < 10; ri++) {
    var ra = (ri * 36 + 8) * D2R;
    fd(o.line([
      [SUN[0] + Math.cos(ra) * 0.10, SUN[1] + Math.sin(ra) * 0.10, ZS],
      [SUN[0] + Math.cos(ra) * 0.135, SUN[1] + Math.sin(ra) * 0.135, ZS]
    ], { w: 'hair', col: 'ink' }));
  }
  /* 两朵云（双弧 + 底线） */
  function cloud(cx, cy, s) {
    fd(o.circ([cx - 0.05 * s, cy, ZS], 0.05 * s, 'z',
      { w: 'hair', col: 'ink', segs: 14, arc0: 0.15, arc1: Math.PI - 0.15 }));
    fd(o.circ([cx + 0.04 * s, cy + 0.012 * s, ZS], 0.038 * s, 'z',
      { w: 'hair', col: 'ink', segs: 12, arc0: 0.35, arc1: Math.PI - 0.4 }));
    fd(o.line([[cx - 0.105 * s, cy - 0.012 * s, ZS], [cx + 0.085 * s, cy - 0.012 * s, ZS]],
      { w: 'hair', col: 'ink2' }));
  }
  cloud(-0.38, 2.42, 1.0);
  cloud(0.18, 1.62, 0.8);

  /* ---- 夜间内容（alpha × skyT；颜色取 Env.C.glowRgb 派生——
   * 昼夜三套配色中唯一在深色夜空上恒为浅色的墨色）---- */
  var glowCol = function () {
    var g = Env.C.glowRgb;
    return 'rgb(' + Math.round(g[0]) + ',' + Math.round(g[1]) + ',' + Math.round(g[2]) + ')';
  };
  var nightInk = [];
  var moonParts = [
    /* 月牙外弧（左侧长弧，55.4°→304.6°） */
    o.circ([MX, MY, ZS], 0.085, 'z', { w: 'detail', col: 'ink', segs: 26, arc0: 55.4 * D2R, arc1: 304.6 * D2R }),
    /* 月牙内弧（咬口：沿咬合圆左侧 87.3°→272.7°，凹向月面） */
    o.circ([MX + 0.045, MY, ZS], 0.07, 'z', { w: 'detail', col: 'ink', segs: 20, arc0: 87.3 * D2R, arc1: 272.7 * D2R })
  ];
  nightInk.push(moonParts[0], moonParts[1]);
  var stars = [];
  var starDefs = [
    [0.38, 2.50, 1], [-0.02, 2.58, 0], [-0.58, 1.98, 1], [0.55, 1.78, 0],
    [0.10, 1.42, 1], [-0.48, 1.28, 0], [0.60, 2.14, 0], [-0.20, 2.20, 0]
  ];
  for (ri = 0; ri < starDefs.length; ri++) {
    var sd = starDefs[ri];
    var spd = 0.6 + h01(ri * 3 + 1) * 1.4;
    var ph = h01(ri * 7 + 2) * 6.28;
    var rec = { ps: [], spd: spd, ph: ph, a0: sd[2] ? 1 : 0.9 };
    if (sd[2]) { // 十字星
      rec.ps.push(o.line([[sd[0] - 0.016, sd[1], ZS], [sd[0] + 0.016, sd[1], ZS]], { w: 'hair', col: 'ink' }));
      rec.ps.push(o.line([[sd[0], sd[1] - 0.016, ZS], [sd[0], sd[1] + 0.016, ZS]], { w: 'hair', col: 'ink' }));
    } else {     // 圆点星
      rec.ps.push(o.circ([sd[0], sd[1], ZS], 0.007, 'z', { w: 'hair', col: 'ink', segs: 6 }));
    }
    for (var sp2 = 0; sp2 < rec.ps.length; sp2++) nightInk.push(rec.ps[sp2]);
    stars.push(rec);
  }

  /* ---- 昼间光束 + 窗棂投影（地板）---- */
  var beam = o.panel([[-0.82, 0.002, 0.035], [0.82, 0.002, 0.035], [0.48, 0.002, 1.30], [-0.48, 0.002, 1.30]],
    { fill: 'sun', w: 'none', pick: false, bias: -0.5 });
  var shV = o.line([[-0.005, 0.003, 0.05], [-0.06, 0.003, 1.24]],
    { w: 'hair', col: 'ink2', pick: false, bias: -0.45 });
  var shH = o.line([[-0.55, 0.003, 0.42], [0.52, 0.003, 0.52]],
    { w: 'hair', col: 'ink2', pick: false, bias: -0.45 });

  /* ---- hover 高亮框（低 alpha 暖色；负 bias = 引擎中更晚画 = 叠在天空内容之上）---- */
  var hlFill = o.panel(rectZc(-0.86, 1.08, 0.86, 2.72, -0.002).slice(0, 4),
    { fill: null, w: 'none', pick: false, bias: -0.03 });
  var hlLine = o.line(rectZc(-0.855, 1.085, 0.855, 2.715, 0.001),
    { w: 'detail', col: 'ink', pick: false, bias: -0.03 });

  bindFeedback(o);
  o.shakeS = new Engine.Spring(3.0, 0.3);
  o._dustAcc = 0.35;
  o._n = 0;
  o.onClick = function () {
    Env.setNight(!Env.isNight);
    if (AK) AK.shift();
    this.shakeS.kick(Env.isNight ? 12 : -12);
  };
  o.update = function (dt, t) {
    var skyT = Env.skyT || 0;
    var dayK = 1 - skyT;

    /* 窗帘状态影响光束强度（容错：窗帘不存在则全开） */
    var cur = Engine.scene.get('curtains');
    var ck = cur ? 1 - (cur.curtainT || 0) : 1;

    /* 窗框 Spring 轻震（绕窗台前缘） */
    var sh = this.shakeS.tick(dt);
    if (Math.abs(sh) < 0.01 && Math.abs(this.shakeS.v) < 0.15) { this.shakeS.reset(); sh = 0; }
    var fx = xfIf([0, 1.02, 0], 0, 0, sh, [sh * 0.004, 0, 0]);
    applyGroup(frame, null, fx, this, '_fr');

    /* 天空内容交叉淡化 */
    var i, j;
    var gc = glowCol();
    for (i = 0; i < dayParts.length; i++) dayParts[i].alpha = dayParts[i]._a0 * dayK;
    for (i = 0; i < moonParts.length; i++) { moonParts[i].alpha = skyT; moonParts[i].col = gc; }
    for (i = 0; i < nightInk.length; i++) nightInk[i].col = gc;
    for (i = 0; i < stars.length; i++) {
      var s2 = stars[i];
      var a = s2.a0 * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s2.spd + s2.ph))) * skyT;
      for (j = 0; j < s2.ps.length; j++) s2.ps[j].alpha = a;
    }

    /* 光束 / 投影 / 尘埃（昼间） */
    beam.alpha = 0.35 + 0.65 * ck;
    shV.alpha = 0.55 * dayK * ck;
    shH.alpha = 0.40 * dayK * ck;
    if (dayK > 0.3 && ck > 0.5) {
      this._dustAcc += dt;
      if (this._dustAcc >= 0.7) {
        this._dustAcc -= 0.7;
        this._n++;
        var k1 = h01(this._n * 3.7 + 11), k2 = h01(this._n * 7.3 + 5), k3 = h01(this._n * 5.1 + 2);
        var bz = 0.10 + 1.1 * k2;
        var kk = (bz - 0.035) / 1.265;
        var bx = lerp(lerp(-0.80, -0.45, kk), lerp(0.80, 0.45, kk), k1);
        Engine.FX.puff(this.world([bx, 0.04 + 0.5 * k3, bz]),
          { n: 1, spread: 0.05, rise: 0.045, size: 0.012, life: 2.4, alpha: 0.05, col: Env.C.glowRgb });
      }
    }

    /* 月晕（夜间轻微暖光，跟随天空淡入） */
    if (skyT > 0.25) {
      Engine.FX.glow(this.world([MX, MY, -0.004]), 0.5, Env.C.glowRgb, 0.09 * skyT);
    }

    /* hover 高亮框 */
    var hk = this.hoverT;
    hlFill.fill = hk > 0.004 ? rgba(Env.C.glowRgb, 0.06 * hk) : null;
    hlLine.alpha = 0.5 * hk;
    hlLine.col = rgba(Env.C.glowRgb, 1);
  };

  return o;
};

/* ============================================================
 * 4. makeCurtains — 窗帘（帘杆 y2.92 宽 2.6，每侧 5 条布条）
 * ============================================================ */
W.ROOM_PARTS.makeCurtains = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'curtains', label: '窗帘',
    pos: opts.pos || [2.8, 0, 0.12], rotY: (opts.rotY == null) ? 0 : opts.rotY,
    /* −1：帘轨与布条是窗墙的最前景层（物理上悬在窗框/窗台/天空板之前）；
     * 斜视角下大面平均深度会与窗框交错，整体前移 1 个深度单位保证
     * 布条永远画在窗与天空内容之上（引擎实测 d 小者晚画/更靠前）。 */
    layerBias: -1
  });

  var N_COL = 6;   // 布条横向采样列数
  var Y_TOP = 2.86, Y_HEM = 1.04;

  /* ---- 帘杆 + 球头 + 墙架 ---- */
  o.line([[-1.3, 2.92, 0.03], [1.3, 2.92, 0.03]], { w: 'struct', col: 'ink' });
  o.line([[-1.3, 2.905, 0.03], [1.3, 2.905, 0.03]], { w: 'hair', col: 'ink2', alpha: 0.8 });
  var fin;
  for (fin = 0; fin < 2; fin++) {
    var fx = fin === 0 ? -1.3 : 1.3;
    o.panel(discZ(fx, 2.92, 0.03, 0.042, 12), { fill: 'paper', w: 'none', pick: false, bias: -0.004 });
    o.circ([fx, 2.92, 0.03], 0.042, 'z', { w: 'detail', col: 'ink', segs: 14, bias: -0.008 });
    o.circ([fx, 2.92, 0.03], 0.014, 'z', { w: 'hair', col: 'ink2', segs: 8, bias: -0.008 });
  }
  for (fin = 0; fin < 2; fin++) {
    var bx2 = fin === 0 ? -1.12 : 1.12;
    o.line([[bx2, 2.92, -0.115], [bx2, 2.92, 0.026]], { w: 'hair', col: 'ink2' });
    o.line([[bx2, 2.845, -0.11], [bx2, 2.92, -0.11]], { w: 'hair', col: 'ink2' });
  }
  /* 帘杆隐形拾取代理（布条之外也能点） */
  o.panel(rectZc(-1.32, 2.80, 1.32, 3.02, 0.0).slice(0, 4), { fill: null, w: 'none', pick: true });

  /* ---- 10 条布条（每侧 5 条）----
   * c0/c1 合态跨度（铺满窗宽），o0/o1 开态跨度（收拢两侧） */
  var strips = [];
  var side, idx, c0, c1, o0, o1;
  for (side = 0; side < 2; side++) {
    for (idx = 0; idx < 5; idx++) {
      if (side === 0) { // 左
        c0 = -0.98 + 0.196 * idx; c1 = c0 + 0.196;
        o0 = -1.27 + 0.098 * idx; o1 = o0 + 0.135;
      } else {          // 右（镜像）
        c0 = 0.98 - 0.196 * (idx + 1); c1 = c0 + 0.196;
        o1 = 1.27 - 0.098 * idx; o0 = o1 - 0.135;
      }
      strips.push({
        side: side, idx: idx,
        c0: c0, c1: c1, o0: o0, o1: o1,
        ph: h01(idx * 5 + side * 23 + 3) * 6.28,
        p: o.panel([[0, 0, 0]], { fill: 'paper', w: 'detail', col: 'ink', pick: true, bias: (side === 0 ? idx : 4 - idx) * 0.012 }),
        f: o.line([[0, 0, 0]], { w: 'hair', col: 'ink2', alpha: 0.8 })
      });
    }
  }

  /* 左右两块隐形拾取代理（随布条跨度移动） */
  var pickL = o.panel([[0, 0, 0]], { fill: null, w: 'none', pick: true });
  var pickR = o.panel([[0, 0, 0]], { fill: null, w: 'none', pick: true });

  bindFeedback(o);
  o.curtainT = 0; // 0 开 / 1 合
  o.onClick = function () {
    var to = this.curtainT < 0.5 ? 1 : 0;
    Tweens.add(this, 'curtainT', to, { dur: 0.8, ease: TE.cubicInOut });
    if (AK) AK.swish();
  };
  o.update = function (dt, t) {
    var fan = Engine.scene.get('fan');
    var fs = (fan && fan.speed) ? fan.speed : 0;
    var ampK = (1 + 1.2 * fs) * (1 + 0.3 * this.hoverT);
    var ct = this.curtainT;
    var pleatAmp = 0.018 + 0.02 * ct;

    var i, j;
    var lo = 1e9, lhi = -1e9, ro = 1e9, rhi = -1e9;
    for (i = 0; i < strips.length; i++) {
      var st = strips[i];
      var x0 = lerp(st.o0, st.c0, ct), x1 = lerp(st.o1, st.c1, ct);
      var xc = (x0 + x1) / 2;
      if (st.side === 0) { if (x0 < lo) lo = x0; if (x1 > lhi) lhi = x1; }
      else { if (x0 < ro) ro = x0; if (x1 > rhi) rhi = x1; }

      var top = [], hem = [];
      for (j = 0; j <= N_COL; j++) {
        var u = j / N_COL;
        var xb = x0 + (x1 - x0) * u;
        var xt = xc + (xb - xc) * 0.94;
        var pleat = pleatAmp * Math.sin(u * Math.PI * 2 + st.ph);
        var zH = 0.03 + pleat + ampK * 0.012 * Math.sin(t * 1.25 + st.ph * 1.3 + u * 4.2);
        var zT = 0.03 + pleat * 0.3;
        var taper = 0.3 + 0.7 * Math.sin(Math.PI * u);
        var yH = Y_HEM + ampK * 0.026 * Math.sin(t * 1.5 + st.ph * 1.7 + u * 2.4) * taper;
        var xH = xb + ampK * 0.01 * Math.sin(t * 0.85 + st.ph * 2.1 + u * 2.0);
        top.push([xt, Y_TOP, zT]);
        hem.push([xH, yH, zH]);
      }
      var pts = top.concat(hem.slice().reverse());
      st.p.pts = pts;
      var mf = hem[3];
      st.f.pts = [[top[3][0], Y_TOP - 0.02, top[3][2]], [mf[0], mf[1] - 0.015, mf[2]]];
    }

    pickL.pts = rectZc(lo - 0.03, 0.98, lhi + 0.03, 2.95, 0.02);
    pickR.pts = rectZc(ro - 0.03, 0.98, rhi + 0.03, 2.95, 0.02);
  };

  return o;
};

/* ============================================================
 * 5. makeLightSwitch — 电灯开关（后墙，底板 0.09×0.13）
 * ============================================================ */
W.ROOM_PARTS.makeLightSwitch = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'switch', label: '电灯开关',
    pos: opts.pos || [7.78, 1.22, 0.03], rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var KNOB_PIV = [0, -0.014, -0.002];

  /* ---- 底板（press 沉墙组）---- */
  var plateParts = [];
  pushAll(plateParts, [o.box(0.09, 0.13, 0.014, [0, -0.065, -0.021], { w: 'detail' }).all]);
  plateParts.push(o.line(rectZc(-0.033, -0.053, 0.033, 0.053, -0.0135),
    { w: 'hair', col: 'ink2' }));
  plateParts.push(o.circ([0, 0.052, -0.013], 0.0045, 'z', { w: 'hair', col: 'ink2', segs: 6 }));
  plateParts.push(o.circ([0, -0.052, -0.013], 0.0045, 'z', { w: 'hair', col: 'ink2', segs: 6 }));
  /* 隐形拾取代理（放大点击区域） */
  plateParts.push(o.panel(rectZc(-0.075, -0.105, 0.075, 0.105, 0.0).slice(0, 4),
    { fill: null, w: 'none', pick: true }));

  /* ---- 拨钮（rotX 翻转 + move y ±0.014）---- */
  var knobParts = [];
  pushAll(knobParts, [o.box(0.034, 0.052, 0.02, [0, -0.04, -0.002], { w: 'detail' }).all]);
  knobParts.push(o.line([[0, -0.03, 0.0085], [0, 0.002, 0.0085]], { w: 'hair', col: 'ink' }));

  bindFeedback(o);
  o.knobT = Env.lightsOn ? 1 : 0;
  o._sync = !!Env.lightsOn;
  o.onClick = function () {
    var on = !Env.lightsOn;
    Env.setLights(on);
    this._sync = on;
    Tweens.add(this, 'knobT', on ? 1 : 0, { dur: 0.25, ease: TE.backOut });
    if (AK) AK.switchToggle(on);
  };
  o.update = function () {
    /* 与全局灯光状态持续同步（吊灯 / 台灯开灯时拨钮跟随） */
    var on = !!Env.lightsOn;
    if (on !== this._sync) {
      this._sync = on;
      Tweens.add(this, 'knobT', on ? 1 : 0, { dur: 0.25, ease: TE.backOut });
    }
    var rot = 11 - 22 * this.knobT;                    // off: +11° 顶外翘 / on: −11°
    var my = -0.014 + 0.028 * this.knobT;              // off: −0.014 / on: +0.014
    var knobXf = { rotX: rot, pivot: KNOB_PIV, move: [0, my, 0.004 * this.hoverT] };
    var pressXf = xfIf([0, 0, 0], 0, 0, 0, [0, 0, -0.004 * this.pressT]);
    var i;
    for (i = 0; i < knobParts.length; i++) {
      var q = X.xform(knobParts[i].base, knobXf);
      knobParts[i].pts = pressXf ? X.xform(q, pressXf) : q;
    }
    applyGroup(plateParts, null, pressXf, this, '_pl');
  };

  return o;
};

})();
