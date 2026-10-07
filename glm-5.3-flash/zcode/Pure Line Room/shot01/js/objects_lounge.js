/* ============================================================
 * Pure Line Room — objects_lounge.js（起居组 · SPEC §7 D 组 16~23）
 * ------------------------------------------------------------
 * 对象清单与交互说明：
 *  makeDresser       id:'dresser'  五斗柜 —— 柜体 1.6×0.52×0.95（含 0.075
 *                                  短腿，柜顶 y0.95 供唱片机/地球仪落座）。
 *                                  前脸 8 条骨架带留出两口：上排两只并排
 *                                  抽屉（各 0.76 宽×0.24 高）+ 下排对开门。
 *                                  三个可开合部件按 onClick(part) 分流
 *                                  （构建时把 part 组存入 this._st）：
 *                                  抽屉 move +z 0.30（cubicInOut 0.6s
 *                                  + AudioKit.drawerMove）；左门绕左铰链
 *                                  rotY -95°（AudioKit.doorMove）；右门
 *                                  固定，点击柜体 Spring 轻晃 + thunk。
 *                                  抽屉内腔 fill:'void' + 折叠衣物线条
 *                                  /小盒；开门见挂衣杆与衣架。hover：
 *                                  被悬停前脸部件微露（抽屉 +z 0.012、
 *                                  门 rotY -2.2°，update 读 Engine.hoverPart()
 *                                  比对身份）。press 下沉 6mm。
 *  makeRecordPlayer  id:'player'   唱片机 —— 机身 0.44×0.36×0.105 落于柜顶
 *                                  （local y -0.005 贴合 0.95 台面）+ 控制排
 *                                  （两旋钮+拨杆，播放时前翻 24°）+ 转盘
 *                                  （ellip r0.15 双圈+可拾取盘面）+ 黑胶
 *                                  （24 段 panel fill:'void' + 3 条纹路弧
 *                                  + 径向高光 + Env.C.glowRgb 淡暖标签
 *                                  + 主轴点，整组每帧 set rotY 累计角）
 *                                  + 两级唱臂（pivot 右后角底座，静置
 *                                  -22°、播放 +8°，Tween armT 0.7s）
 *                                  + 透明掀盖（烘焙斜立 100°，玻璃极低
 *                                  alpha，播放时轻微嗡振）。this.playing
 *                                  点击切换：vinylStart + 转速惯性趋近
 *                                  33⅓ 转/分（3.49rad/s，τ≈1.2s）；停止：
 *                                  抬臂归位 + 转速衰减（τ≈2s）+
 *                                  vinylStop（延迟 0.5s）。hover 唱臂微抬 2°。
 *  makeGlobe         id:'globe'    地球仪 —— 底座圆盘 + 斜柱 + 弧形子午
 *                                  半环（烘焙倾斜）+ 球体 r0.115（球心
 *                                  y0.19）：赤道 + 2 纬线 + 3 经线整圆 +
 *                                  5 条大陆感折线（'hair'）。球轴倾斜 23°：
 *                                  每帧 pts = xform(xform(base, rotY 自旋),
 *                                  rotX -23)。this.spin 摩擦 ×exp(-0.8dt)；
 *                                  点击 spin += 3.2（限幅 ±8）+ wobble。
 *                                  hover 整体微晃 1°（正弦）。
 *  makeSofa          id:'sofa'     三人沙发 —— 2.05 宽：底座箱体 + 3 坐垫
 *                                  （前缘圆角线+顶面缝线）+ 3 靠垫（微鼓
 *                                  面板烘焙后倾 8°）+ 两侧卷臂（横置 cyl
 *                                  r0.13）+ 4 车削短脚 + 卷臂下 hatch 轻影。
 *                                  点击 Spring 下沉回弹（scaleY≈0.987 绕
 *                                  地面）+ AudioKit.pop；hover 靠垫微鼓
 *                                  1.01；press 追加下沉 4mm。
 *  makePillow        id:opts.id    抱枕 —— 0.42×0.42×0.12 十二边微鼓薄枕
 *                    ('pillowA'/'  （front/back+四边面+斜切角缝线），表面
 *                     'pillowB')   2 条格纹线 + 4 圆点纹 + 内缩缝边；
 *                                  直立构建后整体 rotX -18° 烘焙成斜靠。
 *                                  点击 Spring 压扁 scaleY≈0.82 绕底缘回弹
 *                                  余振 + 微跳起 0.03 落回 + AudioKit.pop；
 *                                  hover 均匀微鼓 1.03。
 *  makeCoffeeTable   id:'table'    茶几 —— 椭圆面 rx0.62 rz0.42 y0.40
 *                                  （fill:'paper'）+ 下缘第二圈 y0.372 +
 *                                  沿厚刻线 + 4 斜腿（双线）+ 下层搁板
 *                                  y0.14（2 本平叠薄书 + 小碗双弧 + 圈足）。
 *                                  点击 Spring 晃 rotZ≈0.5° + wobble；
 *                                  hover 微沉 0.004；press 下沉 8mm。
 *  makePlant         id:'plant'    盆栽 —— 陶盆圆台 topR0.06 r0.045 h0.09
 *                                  + 盆沿双圈 + 'void' 土面 + 短茎 + 6 片
 *                                  细长叶（两段贝塞尔弧围合的窄面板+中脉，
 *                                  pivot 在盆口，相位错开）。常摆每叶
 *                                  rotZ = sin(t*1.3+i)*2°；点击 _excite=1
 *                                  （指数衰减）摆幅 ×(1+2*_excite) + swish；
 *                                  hover 摆幅 ×1.8。
 *  makeRug           id:'rug'      地毯 —— 3.4×2.4 切角八边形 panel
 *                                  y0.006（fill:'paper'）+ 双重边线
 *                                  （inset 0.06/0.12）+ 内部 45° 稀疏斜线
 *                                  （alpha 0.5，凸多边形精确裁弦）+ 四角
 *                                  回纹短线。点击整体 y 弹动 + 点击部件
 *                                  质心处 Engine.FX.puff 暖尘埃
 *                                  (Env.C.glowRgb, alpha 0.12, n4) + swish。
 *                                  hover 由引擎线宽自动加重。opts.layerBias
 *                                  透传 RoomObject（main 传 -0.6）。
 * 备注：引擎按深度降序绘制（d 大先画=更靠后），故同面叠绘细节用
 *       微小负 bias；线框件（唱臂/叶片/球面/壶圈）均补不可见拾取代理
 *       panel(fill:null + w:'none' + pick:true)。无 Math.random（仅引擎
 *       FX 粒子内部使用）；工厂可重复调用；颜色全部 Env.C.* 派生。
 * ============================================================ */
(function () {
'use strict';

var ROOM_PARTS = window.ROOM_PARTS = window.ROOM_PARTS || {};

var X = Engine.X;      // 引擎变换
var TE = Engine.E;     // 缓动函数集

/* ---------------- 小工具（确定性、无随机、可重复调用） ---------------- */
function h1(i) { var s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }
function approach(v, tgt, dt, rate) { return v + (tgt - v) * (1 - Math.exp(-rate * dt)); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rgba(rgb, a) {
  return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')';
}
function applySet(ps, tr) { for (var i = 0; i < ps.length; i++) ps[i].set(tr); }
function inList(ps, p) {
  if (!p) return false;
  for (var i = 0; i < ps.length; i++) if (ps[i] === p) return true;
  return false;
}
/* 把一次性姿态烘进 base（此后每帧 set 均保留该姿态） */
function bake(ps, tr) {
  for (var i = 0; i < ps.length; i++) {
    ps[i].base = X.xform(ps[i].base, tr);
    ps[i].pts = X.clonePts(ps[i].base);
  }
}
/* 水平椭圆点列（y = c[1]） */
function ellipsePts(c, rx, rz, segs) {
  var pts = [], i, a;
  for (i = 0; i <= segs; i++) {
    a = Math.PI * 2 * i / segs;
    pts.push([c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz]);
  }
  return pts;
}
/* 水平圆盘点列（不闭合，供 panel 填充） */
function discY(c, r, n) {
  var p = [], i, a;
  for (i = 0; i < n; i++) {
    a = Math.PI * 2 * i / n;
    p.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]);
  }
  return p;
}
/* 二次贝塞尔采样 n 段（n+1 点） */
function quadBez(p0, p1, p2, n) {
  var out = [], i;
  for (i = 0; i <= n; i++) {
    var t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
              u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
              u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2]]);
  }
  return out;
}
/* 切角矩形（八边形）点列，y 指定高度 */
function octPts(hx, hz, c, y) {
  return [[-(hx - c), y, -hz], [hx - c, y, -hz], [hx, y, -(hz - c)], [hx, y, hz - c],
          [hx - c, y, hz], [-(hx - c), y, hz], [-hx, y, hz - c], [-hx, y, -(hz - c)]];
}

/* ================= 16. makeDresser 五斗柜 ================= */
ROOM_PARTS.makeDresser = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'dresser', label: '五斗柜',
    pos: opts.pos || [0.27, 0, 3.7],
    rotY: (opts.rotY == null) ? 90 : opts.rotY
  });

  var gBody = [], i, j;

  /* 柜帽（微出沿）+ 两侧板 + 底板 + 4 短腿 + 背板 */
  var cap = o.box(1.64, 0.05, 0.56, [0, 0.90, -0.01], { w: 'struct' });
  cap.py.bias = 0.3;   /* 大顶面提前绘制：防止盖住站在其远半侧的唱片机/地球仪 */
  gBody.push.apply(gBody, cap.all);
  gBody.push.apply(gBody, o.box(0.03, 0.795, 0.52, [-0.785, 0.105, 0], { w: 'struct' }).all);
  gBody.push.apply(gBody, o.box(0.03, 0.795, 0.52, [0.785, 0.105, 0], { w: 'struct' }).all);
  gBody.push.apply(gBody, o.box(1.6, 0.03, 0.52, [0, 0.075, 0], { w: 'struct' }).all);
  var lx = [-0.72, 0.72], lz = [-0.19, 0.19];
  for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
    gBody.push.apply(gBody, o.box(0.055, 0.075, 0.055, [lx[i], 0, lz[j]], { w: 'detail' }).all);
  }
  gBody.push(o.panel([[-0.785, 0.105, -0.235], [0.785, 0.105, -0.235], [0.785, 0.90, -0.235], [-0.785, 0.90, -0.235]],
    { fill: 'paper', w: 'none', pick: false }));

  /* 内腔：暗背板 + 层板 + 挂衣杆与两只衣架（开门可见） */
  gBody.push(o.panel([[-0.77, 0.11, -0.21], [0.77, 0.11, -0.21], [0.77, 0.885, -0.21], [-0.77, 0.885, -0.21]],
    { fill: 'void', w: 'none', pick: false }));
  gBody.push(o.panel([[-0.77, 0.615, -0.205], [0.77, 0.615, -0.205], [0.77, 0.615, 0.245], [-0.77, 0.615, 0.245]],
    { fill: 'paper', w: 'detail', pick: false }));
  gBody.push(o.line([[-0.62, 0.52, -0.14], [0.62, 0.52, -0.14]], { w: 'detail' }));
  gBody.push(o.line([[-0.30, 0.52, -0.14], [-0.30, 0.435, -0.14]], { w: 'hair', col: 'ink2' }));
  gBody.push(o.line([[-0.30, 0.475, -0.14], [-0.16, 0.475, -0.14]], { w: 'hair', col: 'ink2' }));
  gBody.push(o.line([[0.24, 0.52, -0.14], [0.24, 0.435, -0.14]], { w: 'hair', col: 'ink2' }));
  gBody.push(o.line([[0.24, 0.475, -0.14], [0.38, 0.475, -0.14]], { w: 'hair', col: 'ink2' }));

  /* 前脸骨架（8 条带，留出抽屉口与门洞）z=0.26 */
  function strip(x0, x1, y0, y1) {
    gBody.push(o.panel([[x0, y0, 0.26], [x1, y0, 0.26], [x1, y1, 0.26], [x0, y1, 0.26]],
      { fill: 'paper', w: 'struct' }));
  }
  strip(-0.8, 0.8, 0.885, 0.90);
  strip(-0.8, 0.8, 0.61, 0.645);
  strip(-0.8, 0.8, 0.075, 0.105);
  strip(-0.8, -0.765, 0.645, 0.885);
  strip(-0.005, 0.005, 0.105, 0.885);
  strip(0.765, 0.8, 0.645, 0.885);
  strip(-0.8, -0.745, 0.105, 0.61);
  strip(0.745, 0.8, 0.105, 0.61);

  /* 抽屉（前脸盒 + 底板 + 侧/背顶缘线 + 内物），可整体 move +z */
  function buildDrawer(xc) {
    var g = [];
    g.push.apply(g, o.box(0.76, 0.24, 0.035, [xc, 0.645, 0.2625], { w: 'struct' }).all);
    g.push(o.circ([xc, 0.765, 0.281], 0.016, 'z', { w: 'detail' }));
    g.push(o.panel([[xc - 0.355, 0.665, -0.09], [xc + 0.355, 0.665, -0.09], [xc + 0.355, 0.665, 0.245], [xc - 0.355, 0.665, 0.245]],
      { fill: 'paper', w: 'detail' }));
    g.push(o.line([[xc - 0.355, 0.735, -0.09], [xc - 0.355, 0.735, 0.245]], { w: 'hair', col: 'ink2' }));
    g.push(o.line([[xc + 0.355, 0.735, -0.09], [xc + 0.355, 0.735, 0.245]], { w: 'hair', col: 'ink2' }));
    g.push(o.line([[xc - 0.355, 0.735, -0.09], [xc + 0.355, 0.735, -0.09]], { w: 'hair', col: 'ink2' }));
    /* 折叠衣物线条 + 小盒（fill:'void' 腔内的 'detail' 线） */
    g.push(o.line([[xc - 0.22, 0.679, 0.03], [xc - 0.07, 0.687, 0.11], [xc + 0.09, 0.680, 0.02]], { w: 'detail' }));
    g.push(o.line([[xc - 0.15, 0.692, 0.15], [xc + 0.02, 0.698, 0.07], [xc + 0.19, 0.692, 0.16]], { w: 'detail' }));
    g.push(o.panel([[xc + 0.14, 0.666, -0.03], [xc + 0.30, 0.666, -0.03], [xc + 0.30, 0.666, 0.09], [xc + 0.14, 0.666, 0.09]],
      { fill: 'paper', w: 'hair', pick: false }));
    return g;
  }
  var gDL = buildDrawer(-0.385);
  var gDR = buildDrawer(0.385);

  /* 左门（可开，绕左铰链）+ 右门（固定，归入柜体组） */
  var gDoL = [];
  gDoL.push.apply(gDoL, o.box(0.74, 0.505, 0.03, [-0.375, 0.105, 0.2625], { w: 'struct' }).all);
  gDoL.push(o.circ([-0.075, 0.36, 0.281], 0.017, 'z', { w: 'detail' }));
  gDoL.push(o.line([[-0.70, 0.16, 0.278], [-0.05, 0.16, 0.278], [-0.05, 0.55, 0.278], [-0.70, 0.55, 0.278], [-0.70, 0.16, 0.278]],
    { w: 'hair', col: 'ink2' }));
  gBody.push.apply(gBody, o.box(0.74, 0.505, 0.03, [0.375, 0.105, 0.2625], { w: 'struct' }).all);
  gBody.push(o.circ([0.075, 0.36, 0.281], 0.017, 'z', { w: 'detail' }));
  gBody.push(o.line([[0.05, 0.16, 0.278], [0.70, 0.16, 0.278], [0.70, 0.55, 0.278], [0.05, 0.55, 0.278], [0.05, 0.16, 0.278]],
    { w: 'hair', col: 'ink2' }));

  o._spr = new Engine.Spring(2.4, 0.34);
  o._sink = 0;
  o._st = {
    dL: { g: gDL, t: 0, hk: 0 },
    dR: { g: gDR, t: 0, hk: 0 },
    dS: { g: gDoL, t: 0, hk: 0 }
  };

  o.update = function (dt) {
    var sink = approach(this._sink, this.pressed ? 1 : 0, dt, 14) * 0.006;
    var sway = this._spr.tick(dt) * 1.1;
    var hp = Engine.hoverPart();
    var k;
    for (k in this._st) {
      var s = this._st[k];
      s.hk = approach(s.hk, inList(s.g, hp) ? 1 : 0, dt, 12);
    }
    applySet(gBody, { rotZ: sway, pivot: [0, 0, 0], move: [0, -sink, 0] });
    applySet(gDL, { move: [0, -sink, this._st.dL.t * 0.30 + this._st.dL.hk * 0.012] });
    applySet(gDR, { move: [0, -sink, this._st.dR.t * 0.30 + this._st.dR.hk * 0.012] });
    applySet(gDoL, { rotY: -95 * this._st.dS.t - 2.2 * this._st.dS.hk, pivot: [-0.745, 0, 0.2625], move: [0, -sink, 0] });
  };

  o.onClick = function (part) {
    var s;
    for (s in this._st) {
      if (inList(this._st[s].g, part)) {
        var st = this._st[s];
        var to = st.t > 0.5 ? 0 : 1;
        if (s === 'dS') AudioKit.doorMove(to === 1);
        else AudioKit.drawerMove(to === 1);
        Tweens.add(st, 't', to, { dur: 0.6, ease: TE.cubicInOut });
        return;
      }
    }
    this._spr.kick(2.2);
    AudioKit.thunk();
  };
  return o;
};

/* ================= 17. makeRecordPlayer 唱片机 ================= */
ROOM_PARTS.makeRecordPlayer = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'player', label: '唱片机',
    pos: opts.pos || [0.30, 0.955, 3.42],
    rotY: (opts.rotY == null) ? 90 : opts.rotY
  });

  var CX = -0.07, CZ = 0;            // 转盘/唱片中心（xz）
  var BX = 0.185, BZ = -0.16;        // 唱臂底座（xz，右后角）
  var U0X = -0.9135, U0Z = 0.4086;   // 建造方向单位向量（155.9°，播放 +8° 时正对盘心）
  var ARM_Y = 0.121;

  /* 机身（底缘贴柜顶）+ 顶面内衬线 */
  var all = [];
  var body = o.box(0.44, 0.105, 0.36, [0, -0.005, 0], { w: 'contour' });
  all.push.apply(all, body.all);
  all.push(o.line([[-0.20, 0.101, -0.16], [0.20, 0.101, -0.16], [0.20, 0.101, 0.16], [-0.20, 0.101, 0.16], [-0.20, 0.101, -0.16]],
    { w: 'hair', col: 'ink2' }));

  /* 控制排：两旋钮（圆+盘面+指针）+ 拨杆（播放时前翻 24°） */
  var knobX = 0.135;
  all.push(o.panel(discY([knobX, 0.1015, -0.055], 0.017, 12), { fill: 'paper', w: 'none', pick: false }));
  all.push(o.circ([knobX, 0.102, -0.055], 0.017, 'y', { w: 'detail', segs: 12 }));
  all.push(o.line([[knobX, 0.1025, -0.055], [knobX + 0.013, 0.1025, -0.049]], { w: 'hair' }));
  all.push(o.panel(discY([knobX, 0.1015, 0.03], 0.017, 12), { fill: 'paper', w: 'none', pick: false }));
  all.push(o.circ([knobX, 0.102, 0.03], 0.017, 'y', { w: 'detail', segs: 12 }));
  all.push(o.line([[knobX, 0.1025, 0.03], [knobX + 0.011, 0.1025, 0.021]], { w: 'hair' }));
  var leverG = [
    o.line([[knobX, 0.101, 0.115], [knobX, 0.112, 0.128]], { w: 'detail' }),
    o.circ([knobX, 0.112, 0.128], 0.005, 'z', { w: 'detail', segs: 8 })
  ];

  /* 转盘：盘面（可拾取）+ 双圈 */
  var platter = [];
  platter.push(o.panel(discY([CX, 0.101, CZ], 0.15, 26), { fill: 'paper', w: 'none' }));
  platter.push(o.ellip([CX, 0.1015, CZ], 0.15, 0.15, { w: 'detail', segs: 28 }));
  platter.push(o.ellip([CX, 0.102, CZ], 0.137, 0.137, { w: 'hair', col: 'ink2', segs: 26 }));

  /* 黑胶唱片（旋转组）：暗盘 + 3 条纹路弧 + 径向高光 + 淡暖标签 + 主轴 */
  var rec = [];
  rec.push(o.panel(discY([CX, 0.1035, CZ], 0.135, 24), { fill: 'void', w: 'detail', bias: -0.01 }));
  rec.push(o.circ([CX, 0.104, CZ], 0.052, 'y', { w: 'hair', col: 'ink2', segs: 14, arc0: 0.4, arc1: 2.8, closed: false, bias: -0.008 }));
  rec.push(o.circ([CX, 0.104, CZ], 0.086, 'y', { w: 'hair', col: 'ink2', segs: 16, arc0: 2.5, arc1: 4.9, closed: false, bias: -0.008 }));
  rec.push(o.circ([CX, 0.104, CZ], 0.117, 'y', { w: 'hair', col: 'ink2', segs: 18, arc0: 4.4, arc1: 6.8, closed: false, bias: -0.008 }));
  rec.push(o.line([[CX + 0.038, 0.104, CZ + 0.014], [CX + 0.122, 0.104, CZ + 0.045]], { w: 'hair', col: 'ink2', bias: -0.008 }));
  rec.push(o.panel(discY([CX, 0.1045, CZ], 0.047, 16), { fill: rgba(Env.C.glowRgb, 0.32), w: 'hair', pick: false, bias: -0.012 }));
  rec.push(o.circ([CX, 0.105, CZ], 0.006, 'y', { w: 'detail', segs: 8, bias: -0.014 }));

  /* 唱臂：底座盘 + 立轴 + 两级杆 + 唱头 + 针尖 + 配重；整组绕底座旋转 */
  var arm = [];
  var pxn = -U0Z, pzn = U0X;   // 臂向垂线
  arm.push(o.circ([BX, 0.101, BZ], 0.031, 'y', { w: 'detail', segs: 14 }));
  arm.push(o.panel(discY([BX, 0.101, BZ], 0.031, 14), { fill: 'paper', w: 'none', pick: false }));
  var post = o.cyl([BX, 0.101, BZ], 0.008, 0.02, 'y', { segs: 8, profiles: 2, w: 'hair' });
  arm.push.apply(arm, post.all);
  var EX = BX + 0.10 * U0X, EZ = BZ + 0.10 * U0Z;    // 肘点
  var HX = BX + 0.226 * U0X, HZ = BZ + 0.226 * U0Z;  // 唱头
  arm.push(o.line([[BX, ARM_Y, BZ], [EX, ARM_Y, EZ]], { w: 'struct' }));
  arm.push(o.circ([EX, ARM_Y, EZ], 0.007, 'y', { w: 'hair', segs: 8 }));
  arm.push(o.line([[EX, ARM_Y, EZ], [HX, 0.115, HZ]], { w: 'struct' }));
  arm.push(o.panel([[HX + pxn * 0.010 + U0X * 0.018, 0.1145, HZ + pzn * 0.010 + U0Z * 0.018],
                    [HX - pxn * 0.010 + U0X * 0.018, 0.1145, HZ - pzn * 0.010 + U0Z * 0.018],
                    [HX - pxn * 0.010 - U0X * 0.018, 0.1145, HZ - pzn * 0.010 - U0Z * 0.018],
                    [HX + pxn * 0.010 - U0X * 0.018, 0.1145, HZ + pzn * 0.010 - U0Z * 0.018]],
    { fill: 'paper', w: 'hair', pick: false }));
  arm.push(o.line([[HX, 0.1145, HZ], [HX, 0.108, HZ]], { w: 'hair' }));
  arm.push(o.line([[BX - 0.010 * U0X, 0.119, BZ - 0.010 * U0Z], [BX - 0.038 * U0X, 0.119, BZ - 0.038 * U0Z]], { w: 'detail' }));
  /* 唱臂拾取代理（线杆不可拾取，补一块沿臂窄面片） */
  arm.push(o.panel([[BX + pxn * 0.024, ARM_Y, BZ + pzn * 0.024],
                    [BX - pxn * 0.024, ARM_Y, BZ - pzn * 0.024],
                    [HX - pxn * 0.024, 0.116, HZ - pzn * 0.024],
                    [HX + pxn * 0.024, 0.116, HZ + pzn * 0.024]],
    { fill: null, w: 'none' }));

  /* 透明掀盖：铰在后上缘，烘焙开启 100°；播放时轻微嗡振 */
  var lid = [];
  lid.push(o.line([[-0.23, 0.106, -0.18], [0.23, 0.106, -0.18], [0.23, 0.106, 0.22], [-0.23, 0.106, 0.22], [-0.23, 0.106, -0.18]],
    { w: 'struct' }));
  lid.push(o.line([[-0.23, 0.106, 0.02], [0.23, 0.106, 0.02]], { w: 'hair', col: 'ink2' }));
  lid.push(o.line([[0, 0.106, -0.18], [0, 0.106, 0.22]], { w: 'hair', col: 'ink2' }));
  lid.push(o.panel([[-0.23, 0.106, -0.18], [0.23, 0.106, -0.18], [0.23, 0.106, 0.22], [-0.23, 0.106, 0.22]],
    { fill: rgba(Env.C.glowRgb, 0.06), w: 'none', pick: false }));
  bake(lid, { rotX: -100, pivot: [0, 0.10, -0.18] });

  o.playing = false;
  o.armT = 0;
  o._spd = 0;
  o._ang = 0;
  o._vstop = 0;
  o._sink = 0;
  o._hk = 0;
  o._pk = 0;

  o.update = function (dt, t) {
    this._pk = approach(this._pk, this.playing ? 1 : 0, dt, 8);
    this._hk = approach(this._hk, this.hovered ? 1 : 0, dt, 10);
    var sink = approach(this._sink, this.pressed ? 1 : 0, dt, 14) * 0.003;
    /* 转速惯性：播放趋近 33⅓ 转/分（3.49rad/s，τ≈1.2s），停止衰减 τ≈2s */
    this._spd = approach(this._spd, this.playing ? 3.49 : 0, dt, this.playing ? 1 / 1.2 : 1 / 2.0);
    this._ang += this._spd * 57.29578 * dt;
    rec[5].fill = rgba(Env.C.glowRgb, 0.32);
    lid[3].fill = rgba(Env.C.glowRgb, 0.06);
    applySet(all, { move: [0, -sink, 0] });
    applySet(platter, { move: [0, -sink, 0] });
    applySet(rec, { rotY: this._ang, pivot: [CX, 0, CZ], move: [0, -sink, 0] });
    applySet(arm, { rotY: -22 + 30 * this.armT, rotZ: -2 * this._hk, pivot: [BX, 0, BZ], move: [0, -sink, 0] });
    applySet(leverG, { rotX: 24 * this._pk, pivot: [knobX, 0.10, 0.115] });
    applySet(lid, { rotX: Math.sin(t * 34) * 0.12 * this._pk, pivot: [0, 0.10, -0.18], move: [0, -sink, 0] });
  };

  o.onClick = function () {
    this.playing = !this.playing;
    if (this.playing) {
      Tweens.kill(this, '_vstop');
      AudioKit.vinylStart();
      Tweens.add(this, 'armT', 1, { dur: 0.7, ease: TE.cubicInOut });
    } else {
      Tweens.add(this, 'armT', 0, { dur: 0.7, ease: TE.cubicInOut });
      Tweens.add(this, '_vstop', 1, { dur: 0.5, ease: TE.linear, onDone: function () { AudioKit.vinylStop(); } });
    }
  };
  return o;
};

/* ================= 18. makeGlobe 地球仪 ================= */
ROOM_PARTS.makeGlobe = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'globe', label: '地球仪',
    pos: opts.pos || [0.30, 0.955, 4.18],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var CY = 0.19, R = 0.115, TILT = -23;

  /* 底座圆盘 + 短柱斜撑（柱顶接半环下端） */
  var base = [];
  var bs = o.cyl([0, -0.005, 0], 0.068, 0.023, 'y', { topR: 0.055, segs: 20, profiles: 4, capFill: 'paper', w: 'detail' });
  base.push.apply(base, bs.all);
  base.push(o.line([[0, 0.018, 0], [0, 0.0685, 0.0516]], { w: 'struct' }));
  base.push(o.circ([0, 0.0685, 0.0516], 0.011, 'z', { w: 'hair', segs: 10 }));

  /* 弧形子午支架（前半环 r0.132）+ 端头 + 极点小环，整组烘焙倾斜 23° */
  var brk = [];
  brk.push(o.circ([0, CY, 0], 0.132, 'x', { arc0: 0, arc1: Math.PI, segs: 24, w: 'struct' }));
  brk.push(o.circ([0, CY + 0.132, 0], 0.011, 'z', { w: 'detail', segs: 10 }));
  brk.push(o.circ([0, CY - R, 0], 0.014, 'x', { w: 'hair', col: 'ink2', segs: 10 }));
  brk.push(o.circ([0, CY + R, 0], 0.014, 'x', { w: 'hair', col: 'ink2', segs: 10 }));
  bake(brk, { rotX: TILT, pivot: [0, CY, 0] });

  /* 球面线稿（自旋组）：赤道 + 2 纬线 + 3 经线 + 5 条大陆折线 */
  var sph = [];
  sph.push(o.ellip([0, CY, 0], R, R, { w: 'detail', segs: 26 }));
  sph.push(o.ellip([0, CY + 0.054, 0], 0.1015, 0.1015, { w: 'hair', col: 'ink2', segs: 22 }));
  sph.push(o.ellip([0, CY - 0.054, 0], 0.1015, 0.1015, { w: 'hair', col: 'ink2', segs: 22 }));
  var mi;
  for (mi = 0; mi < 3; mi++) {
    var lam = mi * Math.PI / 3;
    var e1x = Math.sin(lam), e1z = Math.cos(lam);
    var mp = [];
    for (var u = 0; u <= 20; u++) {
      var a = Math.PI * 2 * u / 20;
      mp.push([Math.cos(a) * e1x * R, CY + Math.sin(a) * R, Math.cos(a) * e1z * R]);
    }
    sph.push(o.line(mp, { w: 'hair', col: 'ink2' }));
  }
  var lands = [[38, -25], [8, 22], [-16, 92], [46, 112], [-30, 158]];
  for (mi = 0; mi < lands.length; mi++) {
    var lp = [];
    for (var q = 0; q <= 6; q++) {
      var lat = (lands[mi][0] + (h1(mi * 7 + q * 3) - 0.5) * 30) * Math.PI / 180;
      var lon = (lands[mi][1] + q * (34 + h1(mi * 5 + q) * 26)) * Math.PI / 180;
      lp.push([Math.cos(lat) * Math.sin(lon) * R, CY + Math.sin(lat) * R, Math.cos(lat) * Math.cos(lon) * R]);
    }
    sph.push(o.line(lp, { w: 'hair', col: 'ink' }));
  }

  /* 拾取代理（球面皆为线，补十字双面片） */
  var proxy = [];
  proxy.push(o.panel([[0, CY - R, -R], [0, CY - R, R], [0, CY + R, R], [0, CY + R, -R]], { fill: null, w: 'none' }));
  proxy.push(o.panel([[-R, CY - R, 0], [R, CY - R, 0], [R, CY + R, 0], [-R, CY + R, 0]], { fill: null, w: 'none' }));

  o.spin = 0.35;
  o._a = 0;
  o._hk = 0;
  o._sink = 0;

  o.update = function (dt, t) {
    this.spin *= Math.exp(-0.8 * dt);
    if (Math.abs(this.spin) < 0.004) this.spin = 0;
    this._a += this.spin * 57.29578 * dt;
    this._hk = approach(this._hk, this.hovered ? 1 : 0, dt, 10);
    var sink = approach(this._sink, this.pressed ? 1 : 0, dt, 14) * 0.004;
    var wob = Math.sin(t * 2.5) * 1.0 * this._hk;
    var spinXf = { rotY: this._a, pivot: [0, CY, 0] };
    var tiltXf = { rotX: TILT, pivot: [0, CY, 0] };
    var feedback = { rotZ: wob, pivot: [0, 0.09, 0], move: [0, -sink, 0] };
    var i, p;
    for (i = 0; i < sph.length; i++) {
      p = sph[i];
      p.pts = X.xform(X.xform(X.xform(p.base, spinXf), tiltXf), feedback);
    }
    applySet(brk, feedback);
    applySet(proxy, feedback);
    applySet(base, { move: [0, -sink, 0] });
  };

  o.onClick = function () {
    this.spin = clamp(this.spin + 3.2, -8, 8);
    AudioKit.wobble();
  };
  return o;
};

/* ================= 19. makeSofa 沙发 ================= */
ROOM_PARTS.makeSofa = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'sofa', label: '沙发',
    pos: opts.pos || [8.42, 0, 4.8],
    rotY: (opts.rotY == null) ? -90 : opts.rotY
  });

  var all = [], backs = [], i, j, xc;

  /* 4 只车削短脚 + 底座箱体 + 背板 + 两侧卷臂支座 */
  var fx = [-0.93, 0.93], fz = [-0.34, 0.34];
  for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
    var ft = o.cyl([fx[i], 0, fz[j]], 0.026, 0.06, 'y', { segs: 10, profiles: 2, w: 'detail' });
    all.push.apply(all, ft.all);
  }
  all.push.apply(all, o.box(2.05, 0.20, 0.85, [0, 0.06, 0], { w: 'contour' }).all);
  all.push.apply(all, o.box(2.05, 0.56, 0.16, [0, 0.26, -0.345], { w: 'struct' }).all);
  all.push.apply(all, o.box(0.26, 0.215, 0.85, [-0.895, 0.26, 0], { w: 'struct' }).all);
  all.push.apply(all, o.box(0.26, 0.215, 0.85, [0.895, 0.26, 0], { w: 'struct' }).all);

  /* 两侧卷臂（横置 cyl r0.13，前端封盖） */
  var rl = o.cyl([-0.895, 0.475, -0.425], 0.13, 0.85, 'z', { segs: 18, profiles: 2, capFill: 'paper', w: 'detail' });
  var rr = o.cyl([0.895, 0.475, -0.425], 0.13, 0.85, 'z', { segs: 18, profiles: 2, capFill: 'paper', w: 'detail' });
  all.push.apply(all, rl.all);
  all.push.apply(all, rr.all);

  /* 3 坐垫（盒体）+ 前缘圆角线 + 顶面缝线 */
  var seatCx = [-0.51, 0, 0.51];
  for (i = 0; i < 3; i++) {
    xc = seatCx[i];
    all.push.apply(all, o.box(0.51, 0.15, 0.62, [xc, 0.26, 0.095], { w: 'struct' }).all);
    all.push(o.line([[xc - 0.235, 0.384, 0.406], [xc + 0.235, 0.384, 0.406]], { w: 'hair', col: 'ink2' }));
    all.push(o.line([[xc - 0.235, 0.411, 0.29], [xc + 0.235, 0.411, 0.29]], { w: 'hair', col: 'ink2' }));
  }

  /* 3 靠垫（微鼓八边面板，烘焙后倾 8°）+ 中缝线；hover 微鼓 1.01 */
  for (i = 0; i < 3; i++) {
    xc = seatCx[i];
    var bg = [];
    bg.push(o.panel([
      [xc - 0.24, 0.415, -0.19], [xc + 0.24, 0.415, -0.19],
      [xc + 0.255, 0.50, -0.19], [xc + 0.255, 0.68, -0.19],
      [xc + 0.24, 0.765, -0.19], [xc - 0.24, 0.765, -0.19],
      [xc - 0.255, 0.68, -0.19], [xc - 0.255, 0.50, -0.19]
    ], { fill: 'paper', w: 'detail' }));
    bg.push(o.line([[xc - 0.22, 0.59, -0.186], [xc + 0.22, 0.59, -0.186]], { w: 'hair', col: 'ink2' }));
    bake(bg, { rotX: -8, pivot: [xc, 0.415, -0.19] });
    backs.push({ g: bg, c: [xc, 0.59, -0.19], hk: 0 });
  }

  /* 右卷臂下轻影（base 前脸 hatch）+ 底缘线由底座盒边给出 */
  var hs = o.hatch([[0.78, 0.09, 0.427], [1.005, 0.09, 0.427], [1.005, 0.235, 0.427], [0.78, 0.235, 0.427]], 5, { w: 'hair' });
  all.push.apply(all, hs);

  o._sq = new Engine.Spring(2.6, 0.30);
  o._pk = 0;

  o.update = function (dt) {
    var sq = 1 - clamp(this._sq.tick(dt), -0.02, 0.03);
    this._pk = approach(this._pk, this.pressed ? 1 : 0, dt, 14);
    var squash = sq - 0.004 * this._pk;
    var i2, p;
    for (i2 = 0; i2 < all.length; i2++) {
      p = all[i2];
      p.pts = X.xform(p.base, { scale: squash, pivot: [0, 0, 0] });
    }
    for (i2 = 0; i2 < backs.length; i2++) {
      var b = backs[i2];
      b.hk = approach(b.hk, this.hovered ? 1 : 0, dt, 10);
      var cs = 1 + 0.01 * b.hk;
      for (var q = 0; q < b.g.length; q++) {
        p = b.g[q];
        p.pts = X.xform(X.xform(p.base, { scale: cs, pivot: b.c }), { scale: squash, pivot: [0, 0, 0] });
      }
    }
  };

  o.onClick = function () {
    this._sq.kick(0.22);   // 峰值 ≈0.013 → scaleY≈0.987 下沉回弹
    AudioKit.pop();
  };
  return o;
};

/* ================= 20. makePillow 抱枕 ================= */
ROOM_PARTS.makePillow = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: opts.id || 'pillowA', label: '抱枕',
    pos: opts.pos || [7.95, 0, 3.85],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  /* 直立薄枕（十二边微鼓轮廓），整体后倾 18° 烘焙 → 斜靠姿态 */
  var FR = 0.06, BK = -0.06, S = 0.93;
  var ring = [[-0.13, -0.21], [0, -0.218], [0.13, -0.21], [0.21, -0.13], [0.218, 0], [0.21, 0.13],
              [0.13, 0.21], [0, 0.218], [-0.13, 0.21], [-0.21, 0.13], [-0.218, 0], [-0.21, -0.13]];
  var all = [], i;
  var fp = [], bp = [];
  for (i = 0; i < ring.length; i++) {
    fp.push([ring[i][0], ring[i][1], FR]);
    bp.push([ring[i][0] * S, ring[i][1] * S, BK]);
  }
  all.push(o.panel(fp, { fill: 'paper', w: 'struct' }));
  all.push(o.panel(bp, { fill: 'paper', w: 'detail' }));

  /* 四个边面（上下左右） */
  all.push(o.panel([[-0.13, 0.21, FR], [0.13, 0.21, FR], [0.13 * S, 0.21 * S, BK], [-0.13 * S, 0.21 * S, BK]],
    { fill: 'paper', w: 'hair', pick: false }));
  all.push(o.panel([[0.13, -0.21, FR], [-0.13, -0.21, FR], [-0.13 * S, -0.21 * S, BK], [0.13 * S, -0.21 * S, BK]],
    { fill: 'paper', w: 'hair', pick: false }));
  all.push(o.panel([[-0.21, -0.13, FR], [-0.21, 0.13, FR], [-0.21 * S, 0.13 * S, BK], [-0.21 * S, -0.13 * S, BK]],
    { fill: 'paper', w: 'hair', pick: false }));
  all.push(o.panel([[0.21, 0.13, FR], [0.21, -0.13, FR], [0.21 * S, -0.13 * S, BK], [0.21 * S, 0.13 * S, BK]],
    { fill: 'paper', w: 'hair', pick: false }));

  /* 斜切角连接缝线 8 条 */
  var di = [0, 2, 3, 5, 6, 8, 9, 11];
  for (i = 0; i < di.length; i++) {
    var rv = ring[di[i]];
    all.push(o.line([[rv[0], rv[1], FR], [rv[0] * S, rv[1] * S, BK]], { w: 'hair', pick: false }));
  }

  /* 表面纹样：2 条格纹线 + 4 圆点纹 + 内缩缝边（前脸） */
  all.push(o.line([[0, -0.19, 0.063], [0, 0.19, 0.063]], { w: 'hair', col: 'ink2' }));
  all.push(o.line([[-0.19, 0, 0.063], [0.19, 0, 0.063]], { w: 'hair', col: 'ink2' }));
  var dx = [-0.105, 0.105];
  for (i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    all.push(o.circ([dx[i], dx[j], 0.063], 0.008, 'z', { w: 'hair', segs: 8 }));
  }
  var seam = [];
  for (i = 0; i < ring.length; i++) seam.push([ring[i][0] * 0.86, ring[i][1] * 0.86, 0.062]);
  seam.push([seam[0][0], seam[0][1], seam[0][2]]);
  all.push(o.line(seam, { w: 'hair', col: 'ink2', pick: false }));

  bake(all, { rotX: -18, pivot: [0, 0, -0.06] });

  o._sq = new Engine.Spring(2.2, 0.28);
  o._hop = 0;
  o._hk = 0;

  o.update = function (dt) {
    var x = clamp(this._sq.tick(dt), -0.03, 0.30);
    var sy = 1 - x;
    this._hk = approach(this._hk, this.hovered ? 1 : 0, dt, 10);
    var hs = 1 + 0.03 * this._hk;
    for (var i2 = 0; i2 < all.length; i2++) {
      var p = all[i2];
      p.pts = X.xform(p.base, { scale: hs, pivot: [0, 0.19, 0] });
      for (var q = 0; q < p.pts.length; q++) {
        var yy = p.pts[q][1] * sy;
        p.pts[q][1] = yy + this._hop;
        p.pts[q][2] = p.pts[q][2] + yy * (1 - sy) * 0.22;
      }
    }
  };

  o.onClick = function () {
    this._sq.kick(2.5);   // 峰值 ≈0.18 → scaleY≈0.82，弹簧回弹自带余振
    AudioKit.pop();
    var self = this;
    Tweens.add(self, '_hop', 0.03, { dur: 0.13, ease: TE.cubicOut, onDone: function () {
      Tweens.add(self, '_hop', 0, { dur: 0.18, ease: TE.quadIn });
    } });
  };
  return o;
};

/* ================= 21. makeCoffeeTable 茶几 ================= */
ROOM_PARTS.makeCoffeeTable = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'table', label: '茶几',
    pos: opts.pos || [6.55, 0, 4.8],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var all = [], i, j;

  /* 椭圆桌面 + 下缘第二圈 + 沿厚刻线 */
  all.push(o.panel(ellipsePts([0, 0.40, 0], 0.62, 0.42, 30), { fill: 'paper', w: 'contour' }));
  all.push(o.ellip([0, 0.372, 0], 0.595, 0.40, { w: 'detail', segs: 28 }));
  for (i = 0; i < 12; i++) {
    var a = Math.PI * 2 * i / 12 + 0.13;
    var c1 = Math.cos(a), s1 = Math.sin(a);
    all.push(o.line([[c1 * 0.607, 0.372, s1 * 0.412], [c1 * 0.617, 0.40, s1 * 0.418]], { w: 'hair', col: 'ink2' }));
  }

  /* 4 斜腿（主线 + 发丝伴随线） */
  var lxa = [-0.40, 0.40], lza = [-0.26, 0.26];
  for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
    var ax = lxa[i], az = lza[j];
    var fx2 = ax * 1.26, fz2 = az * 1.25;
    var sx = ax >= 0 ? 0.022 : -0.022;
    all.push(o.line([[ax, 0.374, az], [fx2, 0.008, fz2]], { w: 'struct' }));
    all.push(o.line([[ax + sx, 0.374, az], [fx2 + sx, 0.008, fz2]], { w: 'hair', col: 'ink2' }));
  }

  /* 下层搁板 + 内圈 + 两本平叠薄书 + 小碗 */
  all.push(o.panel(ellipsePts([0, 0.14, 0], 0.50, 0.34, 26), { fill: 'paper', w: 'detail', pick: false }));
  all.push(o.ellip([0, 0.142, 0], 0.475, 0.32, { w: 'hair', col: 'ink2', segs: 24 }));
  var b1 = [
    o.panel([[-0.08, 0.147, 0.02], [0.09, 0.147, 0.02], [0.09, 0.147, 0.19], [-0.08, 0.147, 0.19]],
      { fill: 'paper', w: 'hair', pick: false }),
    o.panel([[-0.08, 0.147, 0.19], [0.09, 0.147, 0.19], [0.09, 0.133, 0.19], [-0.08, 0.133, 0.19]],
      { fill: 'paper', w: 'hair', pick: false })
  ];
  bake(b1, { rotY: 14, pivot: [0.005, 0, 0.105] });
  var b2 = [
    o.panel([[-0.05, 0.163, 0.045], [0.07, 0.163, 0.045], [0.07, 0.163, 0.175], [-0.05, 0.163, 0.175]],
      { fill: 'paper', w: 'hair', pick: false }),
    o.panel([[-0.05, 0.163, 0.175], [0.07, 0.163, 0.175], [0.07, 0.151, 0.175], [-0.05, 0.151, 0.175]],
      { fill: 'paper', w: 'hair', pick: false })
  ];
  bake(b2, { rotY: -9, pivot: [0.01, 0, 0.11] });
  all.push.apply(all, b1);
  all.push.apply(all, b2);
  all.push(o.ellip([0.27, 0.176, -0.08], 0.058, 0.05, { w: 'detail', segs: 16 }));
  all.push(o.circ([0.27, 0.206, -0.08], 0.058, 'x', { arc0: 2.11, arc1: 4.17, closed: false, w: 'detail', segs: 12 }));
  all.push(o.circ([0.27, 0.200, -0.08], 0.047, 'x', { arc0: 2.11, arc1: 4.17, closed: false, w: 'hair', col: 'ink2', segs: 10 }));
  all.push(o.ellip([0.27, 0.147, -0.08], 0.028, 0.024, { w: 'hair', col: 'ink2', segs: 10 }));

  /* 朝向镜头两条腿的拾取代理 */
  all.push(o.panel([[-0.55, 0, 0.30], [-0.36, 0, 0.30], [-0.36, 0.40, 0.30], [-0.55, 0.40, 0.30]], { fill: null, w: 'none' }));
  all.push(o.panel([[0.36, 0, 0.30], [0.55, 0, 0.30], [0.55, 0.40, 0.30], [0.36, 0.40, 0.30]], { fill: null, w: 'none' }));

  o._spr = new Engine.Spring(2.8, 0.32);
  o._sink = 0;

  o.update = function (dt) {
    var wob = this._spr.tick(dt) * 11;   /* 峰值 ≈0.5° */
    var sink = approach(this._sink, (this.pressed ? 0.008 : 0) + (this.hovered ? 0.004 : 0), dt, 16);
    applySet(all, { rotZ: wob, pivot: [0, 0.38, 0], move: [0, -sink, 0] });
  };

  o.onClick = function () {
    this._spr.kick(0.8);
    AudioKit.wobble();
  };
  return o;
};

/* ================= 22. makePlant 盆栽 ================= */
ROOM_PARTS.makePlant = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'plant', label: '盆栽',
    pos: opts.pos || [6.28, 0.40, 5.12],
    rotY: (opts.rotY == null) ? 0 : opts.rotY
  });

  var potG = [], leaves = [], i;

  /* 陶盆圆台 + 盆沿双圈 + 土面（void）+ 短茎 */
  var pot = o.cyl([0, 0, 0], 0.045, 0.09, 'y', { topR: 0.06, segs: 16, profiles: 4, w: 'detail' });
  potG.push.apply(potG, pot.all);
  potG.push(o.ellip([0, 0.09, 0], 0.063, 0.063, { w: 'detail', segs: 18 }));
  potG.push(o.ellip([0, 0.078, 0], 0.0605, 0.0605, { w: 'hair', col: 'ink2', segs: 16 }));
  potG.push(o.panel(discY([0, 0.082, 0], 0.054, 16), { fill: 'void', w: 'none', pick: false }));
  potG.push(o.line([[0, 0.085, 0], [0.012, 0.165, 0.006]], { w: 'detail' }));

  /* 6 片细长叶（两段贝塞尔弧围合窄面板 + 中脉），pivot 在盆口，相位错开 */
  for (i = 0; i < 6; i++) {
    var phi = -10 + i * 62;
    var L = 0.16 + h1(i * 7 + 3) * 0.10;
    var bx = 0.048, by = 0.092;
    var tx = bx + L * 0.58, ty = by + L * 0.86;
    var g = [];
    var sideA = quadBez([bx, by, 0], [bx + L * 0.85, by + L * 0.30, 0], [tx, ty, 0], 6);
    var sideB = quadBez([tx, ty, 0], [bx + L * 0.30, by + L * 0.52, 0], [bx, by, 0], 6);
    g.push(o.panel(sideA.concat(sideB.slice(1)), { fill: 'paper', w: 'hair', pick: false }));
    g.push(o.line(quadBez([bx, by, 0], [bx + L * 0.55, by + L * 0.46, 0], [tx, ty, 0], 5), { w: 'hair', col: 'ink2' }));
    leaves.push({ g: g, phi: phi, pivot: [bx, by, 0] });
  }

  /* 拾取代理：盆身纵片 + 叶冠水平盘 + 叶冠竖片 */
  var proxy = [];
  proxy.push(o.panel([[-0.065, 0, 0], [0.065, 0, 0], [0.065, 0.095, 0], [-0.065, 0.095, 0]], { fill: null, w: 'none' }));
  proxy.push(o.panel(discY([0, 0.21, 0], 0.27, 18), { fill: null, w: 'none' }));
  proxy.push(o.panel([[0, 0.09, -0.27], [0, 0.09, 0.27], [0, 0.33, 0.27], [0, 0.33, -0.27]], { fill: null, w: 'none' }));

  o._excite = 0;
  o._sink = 0;

  o.update = function (dt, t) {
    this._excite *= Math.exp(-2.2 * dt);
    if (this._excite < 0.003) this._excite = 0;
    var sink = approach(this._sink, this.pressed ? 1 : 0, dt, 14) * 0.003;
    var amp = (1 + 2 * this._excite) * (this.hovered ? 1.8 : 1);
    applySet(potG, { move: [0, -sink, 0] });
    applySet(proxy, { move: [0, -sink, 0] });
    for (var i2 = 0; i2 < leaves.length; i2++) {
      var lf = leaves[i2];
      var sw = Math.sin(t * 1.3 + i2 * 1.05) * 2 * amp;
      var local = { rotZ: sw, pivot: lf.pivot };
      var spread = { rotY: lf.phi, pivot: [0, 0.09, 0], move: [0, -sink, 0] };
      for (var q = 0; q < lf.g.length; q++) {
        lf.g[q].pts = X.xform(X.xform(lf.g[q].base, local), spread);
      }
    }
  };

  o.onClick = function () {
    this._excite = 1;
    AudioKit.swish();
  };
  return o;
};

/* ================= 23. makeRug 地毯 ================= */
ROOM_PARTS.makeRug = function (opts) {
  opts = opts || {};
  var o = new Engine.RoomObject({
    id: 'rug', label: '地毯',
    pos: opts.pos || [6.75, 0, 4.8],
    rotY: (opts.rotY == null) ? 0 : opts.rotY,
    layerBias: opts.layerBias || 0
  });

  var all = [], i;
  var Y1 = 0.006, Y2 = 0.0075, Y3 = 0.009, Y4 = 0.0095;

  /* 切角八边形毯面 + 双重边线（inset 0.06 / 0.12） */
  var o1 = octPts(1.7, 1.2, 0.24, Y1);
  all.push(o.panel(o1, { fill: 'paper', w: 'struct' }));
  var b1 = octPts(1.64, 1.14, 0.22, Y2);
  b1.push([b1[0][0], b1[0][1], b1[0][2]]);
  all.push(o.line(b1, { w: 'detail', pick: false }));
  var b2 = octPts(1.58, 1.08, 0.20, Y3);
  b2.push([b2[0][0], b2[0][1], b2[0][2]]);
  all.push(o.line(b2, { w: 'hair', pick: false }));

  /* 内部 45° 稀疏斜线：凸八边形内精确取弦（alpha 0.5） */
  function inside(x, z) {
    return Math.abs(x) <= 1.54 && Math.abs(z) <= 1.04 && (Math.abs(x) + Math.abs(z)) <= 2.40;
  }
  for (var c = -2.24; c <= 2.25; c += 0.28) {
    var s0 = null, s1 = null;
    for (var s = -1.6; s <= 1.601; s += 0.02) {
      if (inside(s, s - c)) { if (s0 === null) s0 = s; s1 = s; }
    }
    if (s0 !== null && s1 - s0 > 0.12) {
      var m = (s0 + s1) / 2, half = (s1 - s0) * 0.485;
      all.push(o.line([[m - half, Y4, m - half - c], [m + half, Y4, m + half - c]],
        { w: 'hair', col: 'ink2', alpha: 0.5, pick: false }));
    }
  }

  /* 四角回纹短线 */
  var fsg = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (i = 0; i < 4; i++) {
    var sx = fsg[i][0], sz = fsg[i][1];
    var bx = sx * 1.42, bz = sz * 0.92;
    all.push(o.line([[bx, Y4, bz], [bx - sx * 0.15, Y4, bz]], { w: 'hair', col: 'ink2', pick: false }));
    all.push(o.line([[bx - sx * 0.15, Y4, bz], [bx - sx * 0.15, Y4, bz - sz * 0.11]], { w: 'hair', col: 'ink2', pick: false }));
    all.push(o.line([[bx - sx * 0.15, Y4, bz - sz * 0.11], [bx - sx * 0.29, Y4, bz - sz * 0.11]], { w: 'hair', col: 'ink2', pick: false }));
  }

  o._yT = 0;
  o._sink = 0;

  o.update = function (dt) {
    var sink = approach(this._sink, this.pressed ? 1 : 0, dt, 14) * 0.002;
    applySet(all, { move: [0, this._yT - sink, 0] });
  };

  o.onClick = function (part) {
    /* 点击处暖尘埃：取被点部件质心（局部）→ 世界坐标 */
    var wp;
    if (part && part.pts && part.pts.length) {
      var cx = 0, cy = 0, cz = 0;
      for (var q = 0; q < part.pts.length; q++) {
        cx += part.pts[q][0]; cy += part.pts[q][1]; cz += part.pts[q][2];
      }
      wp = this.world([cx / part.pts.length, cy / part.pts.length + 0.02, cz / part.pts.length]);
    } else {
      wp = this.world([0, 0.02, 0]);
    }
    Engine.FX.puff(wp, { n: 4, spread: 0.07, rise: 0.05, size: 0.02, life: 1.2, alpha: 0.12, col: Env.C.glowRgb });
    AudioKit.swish();
    var self = this;
    Tweens.add(self, '_yT', 0.013, { dur: 0.10, ease: TE.cubicOut, onDone: function () {
      Tweens.add(self, '_yT', 0, { dur: 0.40, ease: TE.backOut });
    } });
  };
  return o;
};

})();
