/* ============================================================
 * Pure Line Room — engine.js
 * 线稿渲染内核：3D 投影 / 画家排序 / 白色填充遮挡 / 拾取 / 补间 /
 * 弹簧 / 粒子 / 灯光晕 / 昼夜配色。零依赖，普通 <script> 全局。
 * 暴露：window.Engine / window.Env / window.Tweens
 * ============================================================ */
(function () {
'use strict';

var W = window;
W.Engine = W.Engine || {};
W.Env = W.Env || {};
W.Tweens = W.Tweens || {};

/* ---------------- 数学 ---------------- */
var V = {
  add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  mul: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
  dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  cross: function (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  },
  len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
  norm: function (a) { var l = V.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
};
var D2R = Math.PI / 180;
var ZERO = [0, 0, 0];

function clonePts(pts) {
  var out = new Array(pts.length);
  for (var i = 0; i < pts.length; i++) out[i] = [pts[i][0], pts[i][1], pts[i][2]];
  return out;
}

/* 绕 pivot 的复合局部变换（角度制）
 * 顺序：scale(绕pivot) → rotX → rotY → rotZ(各绕pivot) → move */
function xform(pts, o) {
  o = o || {};
  var pv = o.pivot || ZERO;
  var sc = (o.scale == null) ? 1 : o.scale;
  var mv = o.move || null;
  var rx = (o.rotX || 0) * D2R, ry = (o.rotY || 0) * D2R, rz = (o.rotZ || 0) * D2R;
  var need = sc !== 1 || rx || ry || rz || mv;
  if (!need) return clonePts(pts);
  var cx = pv[0], cy = pv[1], cz = pv[2];
  var out = new Array(pts.length);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var x = (p[0] - cx) * sc + cx;
    var y = (p[1] - cy) * sc + cy;
    var z = (p[2] - cz) * sc + cz;
    var dx = x - cx, dy = y - cy, dz = z - cz;
    if (rx) { var c = Math.cos(rx), s = Math.sin(rx); var y2 = dy * c - dz * s, z2 = dy * s + dz * c; dy = y2; dz = z2; }
    if (ry) { var c2 = Math.cos(ry), s2 = Math.sin(ry); var x2 = dx * c2 + dz * s2, z3 = -dx * s2 + dz * c2; dx = x2; dz = z3; }
    if (rz) { var c3 = Math.cos(rz), s3 = Math.sin(rz); var x3 = dx * c3 - dy * s3, y3 = dx * s3 + dy * c3; dx = x3; dy = y3; }
    x = cx + dx; y = cy + dy; z = cz + dz;
    if (mv) { x += mv[0]; y += mv[1]; z += mv[2]; }
    out[i] = [x, y, z];
  }
  return out;
}

var X = { xform: xform, clonePts: clonePts };

/* ---------------- 缓动 ---------------- */
var E = {
  linear: function (t) { return t; },
  quadIn: function (t) { return t * t; },
  quadOut: function (t) { return t * (2 - t); },
  cubicIn: function (t) { return t * t * t; },
  cubicOut: function (t) { return 1 + (--t) * t * t; },
  cubicInOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 + 4 * (--t) * t * t; },
  quartOut: function (t) { return 1 - (--t) * t * t * t; },
  sineInOut: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
  backOut: function (t) { var s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  elasticOut: function (t) {
    if (t <= 0) return 0; if (t >= 1) return 1;
    var p = 0.4; return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  bounceOut: function (t) {
    var n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  }
};

/* ---------------- 补间 ---------------- */
var tweens = [];
var Tweens = {
  add: function (tgt, prop, to, opts) {
    opts = opts || {};
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      if (tw.tgt === tgt && tw.prop === prop) tweens.splice(i, 1); // 同目标同属性：旧的立即让位
    }
    var tw2 = {
      tgt: tgt, prop: prop, from: tgt[prop], to: to,
      dur: (opts.dur == null ? 0.45 : opts.dur),
      ease: opts.ease || E.cubicOut,
      delay: opts.delay || 0, t: 0,
      onDone: opts.onDone || null, onUpdate: opts.onUpdate || null
    };
    tweens.push(tw2);
    return tw2;
  },
  kill: function (tgt, prop) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      if (tw.tgt === tgt && (prop == null || tw.prop === prop)) tweens.splice(i, 1);
    }
  },
  tick: function (dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      var k = (tw.t - tw.delay) / tw.dur;
      if (k < 0) continue;
      if (k > 1) k = 1;
      var v = tw.from + (tw.to - tw.from) * tw.ease(k);
      tw.tgt[tw.prop] = v;
      if (tw.onUpdate) { try { tw.onUpdate(v); } catch (e) { console.warn('[tween onUpdate]', e); } }
      if (k >= 1) {
        tweens.splice(i, 1);
        if (tw.onDone) { try { tw.onDone(); } catch (e2) { console.warn('[tween onDone]', e2); } }
      }
    }
  }
};
W.Tweens = Tweens;
W.Tweens.E = E;

/* ---------------- 弹簧（阻尼谐振） ---------------- */
function Spring(freq, damp) {
  this.f = freq || 3;          // Hz
  this.d = (damp == null) ? 0.35 : damp; // 阻尼比 0..1
  this.x = 0; this.v = 0;
}
Spring.prototype.kick = function (v0) { this.v += v0; return this; };
Spring.prototype.set = function (x0) { this.x = x0; this.v = 0; return this; };
Spring.prototype.reset = function () { this.x = 0; this.v = 0; return this; };
Spring.prototype.tick = function (dt) {
  if (dt > 0.05) dt = 0.05;
  var w = 2 * Math.PI * this.f;
  var k = w * w, c = 2 * this.d * w;
  this.v += (-k * this.x - c * this.v) * dt;
  this.x += this.v * dt;
  return this.x;
};

/* ---------------- 昼夜配色 ---------------- */
var PAL = {
  day:       { bg: [243, 239, 231], fill: [251, 249, 244], void: [221, 215, 202], ink: [42, 39, 35],  sky: [246, 249, 247], glow: [255, 214, 150] },
  nightLit:  { bg: [232, 225, 211], fill: [243, 238, 227], void: [206, 198, 182], ink: [48, 44, 38],  sky: [30, 36, 54],   glow: [255, 204, 140] },
  nightDark: { bg: [19, 22, 28],    fill: [24, 28, 35],    void: [12, 14, 18],    ink: [213, 207, 193], sky: [14, 18, 29],  glow: [255, 196, 130] }
};
function rgbStr(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
function mixPal(a, b, t) {
  var out = {};
  for (var k in a) {
    out[k] = [0, 0, 0];
    for (var i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  }
  return out;
}

var Env = {
  isNight: false,
  lightsOn: true,
  skyT: 0,            // 0 昼 → 1 夜（已缓动）
  PAL: PAL,
  C: {},              // 当前配色（css 字符串）
  glowRgb: [255, 214, 150],
  _mode: 'day',
  _from: null, _to: null, _t: 1, _dur: 1.5,
  _listeners: [],
  onChange: function (cb) { this._listeners.push(cb); },
  _emit: function () {
    for (var i = 0; i < this._listeners.length; i++) {
      try { this._listeners[i](this); } catch (e) { console.warn('[Env.onChange]', e); }
    }
  },
  mode: function () { return this.isNight ? (this.lightsOn ? 'nightLit' : 'nightDark') : 'day'; },
  setNight: function (b) {
    b = !!b;
    if (b === this.isNight) return;
    this.isNight = b;
    this._retarget();
    this._emit();
  },
  setLights: function (b) {
    b = !!b;
    if (b === this.lightsOn) return;
    this.lightsOn = b;
    this._retarget();
    this._emit();
  },
  _retarget: function () {
    var m = this.mode();
    this._skyFrom = this.skyT;
    this._skyTo = this.isNight ? 1 : 0;
    if (m === this._mode) return;
    this._mode = m;
    this._from = this._snapshot();
    this._to = PAL[m];
    this._t = 0;
  },
  _snapshot: function () {
    var s = {};
    for (var k in PAL.day) s[k] = this._cur[k].slice();
    return s;
  },
  _cur: null,
  tick: function (dt) {
    if (this._t < 1) {
      this._t = Math.min(1, this._t + dt / this._dur);
      var k = E.cubicInOut(this._t);
      this._cur = mixPal(this._from, this._to, k);
      this.skyT = this._skyFrom + (this._skyTo - this._skyFrom) * k;
      this._apply();
    }
  },
  _apply: function () {
    var c = this._cur;
    this.C = {
      bg: rgbStr(c.bg),
      fill: rgbStr(c.fill),
      'void': rgbStr(c['void']),
      ink: rgbStr(c.ink),
      ink2: 'rgba(' + Math.round(c.ink[0]) + ',' + Math.round(c.ink[1]) + ',' + Math.round(c.ink[2]) + ',0.5)',
      sky: rgbStr(c.sky),
      glow: rgbStr(c.glow),
      glowRgb: c.glow.slice(),
      inkRgb: c.ink.slice(),
      sun: 'rgba(246,205,120,' + (0.11 * (1 - this.skyT)).toFixed(3) + ')'
    };
    this.glowRgb = c.glow.slice();
  }
};
Env._cur = mixPal(PAL.day, PAL.day, 0);
Env._apply();
W.Env = Env;

/* ---------------- 常量 ---------------- */
var NEAR = 0.14;
var LINEW = { contour: 2.4, struct: 1.6, detail: 1.05, hair: 0.72 };
var REF_DEPTH = 10;

function resolveColor(col) {
  if (!col) return null;
  if (col === 'ink') return Env.C.ink;
  if (col === 'ink2') return Env.C.ink2;
  return col;
}
function resolveFill(f) {
  if (!f) return null;
  if (f === 'paper') return Env.C.fill;
  if (f === 'void') return Env.C['void'];
  if (f === 'sky') return Env.C.sky;
  if (f === 'sun') return Env.C.sun;
  return f; // rgba(...) 字符串透传
}

/* ---------------- 房间物体基类 ---------------- */
var uid = 0;
function RoomObject(opts) {
  opts = opts || {};
  this.id = opts.id || ('obj' + (++uid));
  this.label = opts.label || '';
  this.pos = (opts.pos || [0, 0, 0]).slice();
  this.rotY = (opts.rotY || 0) * D2R;
  this.layerBias = opts.layerBias || 0;
  this.pickable = opts.pickable !== false;
  this.hidden = false;
  this.hovered = false;
  this.pressed = false;
  this.parts = [];
  this._cos = 1; this._sin = 0;
  this._updateTrig();
}
RoomObject.prototype._updateTrig = function () {
  this._cos = Math.cos(this.rotY);
  this._sin = Math.sin(this.rotY);
};
RoomObject.prototype.setRotY = function (deg) { this.rotY = deg * D2R; this._updateTrig(); };
RoomObject.prototype.world = function (p) {
  var x = p[0], z = p[2];
  return [
    this.pos[0] + x * this._cos + z * this._sin,
    this.pos[1] + p[1],
    this.pos[2] - x * this._sin + z * this._cos
  ];
};
RoomObject.prototype.hide = function () { this.hidden = true; };
RoomObject.prototype.show = function () { this.hidden = false; };

/* part 工厂（st: fill, w, wpx, col, dash, alpha, pick, bias, hidden） */
function mkPart(obj, kind, pts, st) {
  st = st || {};
  var p = {
    kind: kind,
    base: clonePts(pts),
    pts: clonePts(pts),
    fill: st.fill !== undefined ? st.fill : null,
    w: st.w || 'struct',
    wpx: st.wpx || 0,
    col: st.col || 'ink',
    dash: st.dash || null,
    alpha: (st.alpha == null) ? 1 : st.alpha,
    pick: !!st.pick,
    bias: st.bias || 0,
    hidden: !!st.hidden,
    owner: obj
  };
  p.set = function (o) { this.pts = xform(this.base, o); return this; };
  obj.parts.push(p);
  return p;
}

RoomObject.prototype.panel = function (pts, st) {
  st = st || {};
  if (st.pick === undefined) st.pick = true;
  return mkPart(this, 'poly', pts, st);
};
RoomObject.prototype.line = function (pts, st) {
  st = st || {};
  if (st.pick === undefined) st.pick = false;
  return mkPart(this, 'line', pts, st);
};
/* 3D 圆 / 弧。axis: 'x'|'y'|'z'；st: segs, arc0, arc1(弧度), 其余线样式 */
RoomObject.prototype.circ = function (c, r, axis, st) {
  st = st || {};
  var segs = st.segs || (r > 0.5 ? 44 : 26);
  var a0 = (st.arc0 == null) ? 0 : st.arc0;
  var a1 = (st.arc1 == null) ? Math.PI * 2 : st.arc1;
  var closed = (st.closed !== false) && (a1 - a0 >= Math.PI * 2 - 1e-6);
  var pts = [];
  for (var i = 0; i <= segs; i++) {
    var a = a0 + (a1 - a0) * i / segs;
    var ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    if (axis === 'y') pts.push([c[0] + ca, c[1], c[2] + sa]);
    else if (axis === 'x') pts.push([c[0], c[1] + ca, c[2] + sa]);
    else pts.push([c[0] + ca, c[1] + sa, c[2]]);
  }
  return this.line(pts, st);
};
/* 水平椭圆（y = c[1] 平面） */
RoomObject.prototype.ellip = function (c, rx, rz, st) {
  st = st || {};
  var segs = st.segs || 32;
  var pts = [];
  for (var i = 0; i <= segs; i++) {
    var a = Math.PI * 2 * i / segs;
    pts.push([c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz]);
  }
  return this.line(pts, st);
};
/* 轴对齐盒。at=[cx, yBottom, cz]。返回 {faces:[pz,nz,px,nx,py,ny], edges:[..12], all:[..]} */
RoomObject.prototype.box = function (w, h, d, at, st) {
  st = st || {};
  var x0 = at[0] - w / 2, x1 = at[0] + w / 2;
  var y0 = at[1], y1 = at[1] + h;
  var z0 = at[2] - d / 2, z1 = at[2] + d / 2;
  var fill = (st.fill === undefined) ? 'paper' : st.fill;
  var fw = st.faceW || st.w || 'struct';
  var ew = st.edgeW || st.w || 'struct';
  var ecol = st.edgeCol || st.col || 'ink';
  var self = this;
  function face(pts, extra) {
    var s2 = {};
    for (var k in st) s2[k] = st[k];
    s2.fill = fill; s2.w = fw; s2.pick = st.pick !== false;
    if (extra) for (var k2 in extra) s2[k2] = extra[k2];
    return self.panel(pts, s2);
  }
  var faces = [
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),        // pz 前
    face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], { pick: false }), // nz 后
    face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]),        // px 右
    face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]),        // nx 左
    face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]),        // py 顶
    face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], { pick: false })  // ny 底
  ];
  if (st.skipBottom === undefined) st.skipBottom = true;
  if (st.skipBottom) faces[5].hidden = true;
  var ec = st.skipBottom === false ? 12 : 9;
  var edges = [];
  function edge(a, b) { return self.line([a, b], { w: ew, col: ecol, pick: false }); }
  edges.push(edge([x0, y0, z1], [x1, y0, z1]));
  edges.push(edge([x1, y0, z1], [x1, y1, z1]));
  edges.push(edge([x1, y1, z1], [x0, y1, z1]));
  edges.push(edge([x0, y1, z1], [x0, y0, z1]));
  edges.push(edge([x1, y0, z0], [x0, y0, z0]));
  edges.push(edge([x0, y0, z0], [x0, y1, z0]));
  edges.push(edge([x0, y1, z0], [x1, y1, z0]));
  edges.push(edge([x1, y1, z0], [x1, y0, z0]));
  edges.push(edge([x0, y0, z0], [x0, y0, z1]));
  if (st.skipBottom === false) {
    edges.push(edge([x1, y0, z0], [x1, y0, z1]));
    edges.push(edge([x0, y1, z0], [x0, y1, z1]));
    edges.push(edge([x1, y1, z0], [x1, y1, z1]));
  }
  var all = faces.concat(edges);
  return { faces: faces, edges: edges, all: all, pz: faces[0], nz: faces[1], px: faces[2], nx: faces[3], py: faces[4], ny: faces[5] };
};
/* 圆柱/圆台。centerBottom=[x,y,z] 底面圆心，axis 'y'(默认)|'x'|'z'。
 * st: topR, segs, profiles(0|2|4), capFill。返回 {circles, profiles, caps, all} */
RoomObject.prototype.cyl = function (cb, r, h, axis, st) {
  st = st || {};
  axis = axis || 'y';
  var topR = (st.topR == null) ? r : st.topR;
  var segs = st.segs || 24;
  var top = cb.slice();
  top[0] += (axis === 'x') ? h : 0;
  top[1] += (axis === 'y') ? h : 0;
  top[2] += (axis === 'z') ? h : 0;
  var cB = this.circ(cb, r, axis, { segs: segs, w: st.w || 'detail', col: st.col || 'ink', pick: false, bias: st.bias });
  var cT = this.circ(top, topR, axis, { segs: segs, w: st.w || 'detail', col: st.col || 'ink', pick: false, bias: st.bias });
  var profs = [];
  var angs = st.profiles === 4 ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5] : (st.profiles ? [Math.PI / 4, Math.PI * 1.25] : []);
  for (var i = 0; i < angs.length; i++) {
    var a = angs[i];
    var p0 = [cb[0] + Math.cos(a) * r, cb[1], cb[2]];
    var p1 = [top[0] + Math.cos(a) * topR, top[1], top[2]];
    if (axis === 'x') { p0 = [cb[0], cb[1] + Math.cos(a) * r, cb[2] + Math.sin(a) * r]; p1 = [top[0], top[1] + Math.cos(a) * topR, top[2] + Math.sin(a) * topR]; }
    else if (axis === 'z') { p0 = [cb[0] + Math.cos(a) * r, cb[1], cb[2]]; p1 = [top[0] + Math.cos(a) * topR, top[1], top[2]]; }
    else { p0 = [cb[0] + Math.cos(a) * r, cb[1], cb[2] + Math.sin(a) * r]; p1 = [top[0] + Math.cos(a) * topR, top[1], top[2] + Math.sin(a) * topR]; }
    profs.push(this.line([p0, p1], { w: st.w || 'detail', col: st.col || 'ink', pick: false }));
  }
  var caps = [];
  if (st.capFill) {
    var cp = [];
    for (var j = 0; j <= segs; j++) {
      var a2 = Math.PI * 2 * j / segs;
      cp.push([top[0] + Math.cos(a2) * topR, top[1], top[2] + Math.sin(a2) * topR]);
    }
    caps.push(this.panel(cp, { fill: st.capFill, w: st.w || 'detail', col: st.col || 'ink', pick: st.pick !== false }));
  }
  return { circles: [cB, cT], profiles: profs, caps: caps, all: [cB, cT].concat(profs, caps) };
};
/* 在四边形 [p0,p1,p2,p3] 内画 n 条平行细线（从边 p0p3 到边 p1p2） */
RoomObject.prototype.hatch = function (q, n, st) {
  st = st || {};
  var inset = (st.inset == null) ? 0.10 : st.inset;
  var out = [];
  for (var i = 0; i < n; i++) {
    var t = (i + 0.5) / n;
    var a = V.lerp(q[0], q[3], t);
    var b = V.lerp(q[1], q[2], t);
    var a2 = V.lerp(a, b, inset);
    var b2 = V.lerp(b, a, inset);
    out.push(this.line([a2, b2], { w: st.w || 'hair', col: st.col || 'ink2', pick: false }));
  }
  return out;
};

RoomObject.prototype.update = function () {};
RoomObject.prototype.onClick = function (part) {};
RoomObject.prototype.setHover = function (h) { this.hovered = h; };
RoomObject.prototype.setPress = function (p) { this.pressed = p; };

/* ---------------- 场景 ---------------- */
var scene = {
  objects: [],
  add: function (o) { this.objects.push(o); return o; },
  get: function (id) {
    for (var i = 0; i < this.objects.length; i++) if (this.objects[i].id === id) return this.objects[i];
    return null;
  }
};

/* ---------------- 相机 ---------------- */
var cam = {
  target: [4.6, 1.55, 3.0],
  yaw: 0.55, pitch: 0.34, dist: 10.8,
  yawT: 0.55, pitchT: 0.34, distT: 10.8,
  targetT: [4.6, 1.55, 3.0],
  yawV: 0, pitchV: 0,
  fov: 40 * D2R,
  pos: [0, 0, 0], R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, -1],
  _fpx: 1, _cx: 0, _cy: 0
};
function camClamp() {
  if (cam.yawT < -0.12) cam.yawT = -0.12; if (cam.yawT > 1.30) cam.yawT = 1.30;
  if (cam.pitchT < 0.06) cam.pitchT = 0.06; if (cam.pitchT > 1.05) cam.pitchT = 1.05;
  if (cam.distT < 5.2) cam.distT = 5.2; if (cam.distT > 20) cam.distT = 20;
  cam.targetT[0] = Math.min(9.5, Math.max(0.5, cam.targetT[0]));
  cam.targetT[1] = Math.min(3.2, Math.max(0.4, cam.targetT[1]));
  cam.targetT[2] = Math.min(8.6, Math.max(0.4, cam.targetT[2]));
}
function camUpdate(dt) {
  // 平滑趋近目标值 + 惯性
  var k = Math.min(1, dt * 9);
  cam.yaw += (cam.yawT - cam.yaw) * k;
  cam.pitch += (cam.pitchT - cam.pitch) * k;
  cam.dist += (cam.distT - cam.dist) * k;
  for (var i = 0; i < 3; i++) cam.target[i] += (cam.targetT[i] - cam.target[i]) * k;
  if (!input.dragging) {
    cam.yawT += cam.yawV * dt;
    cam.pitchT += cam.pitchV * dt;
    camClamp();
    var dec = Math.exp(-4.2 * dt);
    cam.yawV *= dec; cam.pitchV *= dec;
  }
  var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  var off = [sy * cp * cam.dist, sp * cam.dist, cy * cp * cam.dist];
  cam.pos = V.add(cam.target, off);
  var F = V.norm(V.sub(cam.target, cam.pos));
  var R = V.norm(V.cross(F, [0, 1, 0]));
  var U = V.cross(R, F);
  cam.F = F; cam.R = R; cam.U = U;
  cam._fpx = (cam._vh / 2) / Math.tan(cam.fov / 2);
}
function toView(p) {
  var rx = p[0] - cam.pos[0], ry = p[1] - cam.pos[1], rz = p[2] - cam.pos[2];
  return [V.dot([rx, ry, rz], cam.R), V.dot([rx, ry, rz], cam.U), V.dot([rx, ry, rz], cam.F)];
}
function projPt(v) {
  return [cam._cx + cam._fpx * v[0] / v[2], cam._cy - cam._fpx * v[1] / v[2], v[2]];
}
function worldToScreen(p) {
  var v = toView(p);
  if (v[2] < NEAR) return null;
  return projPt(v);
}

/* ---------------- 近平面裁剪 ---------------- */
function clipPolyV(pts) {
  var out = [];
  var n = pts.length;
  for (var i = 0; i < n; i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    var ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      var t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}
function clipSegV(a, b) {
  var ain = a[2] >= NEAR, bin = b[2] >= NEAR;
  if (!ain && !bin) return null;
  if (ain && bin) return [a, b];
  var t = (NEAR - a[2]) / (b[2] - a[2]);
  var m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
  return ain ? [a, m] : [m, b];
}

/* ---------------- 粒子与光效 ---------------- */
var FX = {
  puffs: [],
  glows: [],
  _tmp: null,
  puff: function (wp, opts) {
    opts = opts || {};
    var n = opts.n || 5;
    var col = opts.col || [120, 116, 108];
    var alpha = (opts.alpha == null) ? 0.30 : opts.alpha;
    for (var i = 0; i < n; i++) {
      if (this.puffs.length > 260) break;
      this.puffs.push({
        p: [wp[0] + (Math.random() - 0.5) * (opts.spread || 0.05),
            wp[1] + (Math.random() - 0.5) * (opts.spread || 0.05) * 0.5,
            wp[2] + (Math.random() - 0.5) * (opts.spread || 0.05)],
        v: [(Math.random() - 0.5) * 0.06, (opts.rise || 0.16) * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 0.06],
        age: 0, life: (opts.life || 1.6) * (0.7 + Math.random() * 0.6),
        size: (opts.size || 0.016) * (0.7 + Math.random() * 0.7),
        col: col, alpha: alpha, seed: Math.random() * 10
      });
    }
  },
  glow: function (wp, rWorld, rgb, alpha) {
    this.glows.push({ p: [wp[0], wp[1], wp[2]], r: rWorld, rgb: rgb, a: alpha });
  },
  tick: function (dt) {
    var ps = this.puffs;
    for (var i = ps.length - 1; i >= 0; i--) {
      var q = ps[i];
      q.age += dt;
      if (q.age >= q.life) { ps.splice(i, 1); continue; }
      q.p[0] += q.v[0] * dt + Math.sin(q.age * 2.4 + q.seed) * 0.02 * dt;
      q.p[1] += q.v[1] * dt;
      q.p[2] += q.v[2] * dt;
      q.v[1] *= (1 - 0.12 * dt);
    }
  }
};
Engine.FX = FX;

/* ---------------- 输入 ---------------- */
var input = {
  dragging: false, panning: false,
  downX: 0, downY: 0, lastX: 0, lastY: 0, downT: 0,
  mx: -1, my: -1, mouseIn: false,
  pointers: {},
  pinchD: 0
};

/* ---------------- 渲染器状态 ---------------- */
var canvas = null, ctx = null;
var dpr = 1, vw = 0, vh = 0;
var entries = [], pickList = [];
var hoverObj = null, hoverPart = null, pressObj = null, pressPart = null;
var cbHover = null, cbInteract = null;

function buildFrame() {
  entries.length = 0; pickList.length = 0;
  var objs = scene.objects;
  for (var oi = 0; oi < objs.length; oi++) {
    var obj = objs[oi];
    if (obj.hidden) continue;
    var c = obj._cos, s = obj._sin, px = obj.pos[0], py = obj.pos[1], pz = obj.pos[2];
    var parts = obj.parts;
    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi];
      if (part.hidden) continue;
      var pts = part.pts;
      var vx = [], vy = [], vz = [];
      var np = pts.length;
      for (var i = 0; i < np; i++) {
        var p = pts[i];
        var wx = px + p[0] * c + p[2] * s;
        var wy = py + p[1];
        var wz = pz - p[0] * s + p[2] * c;
        wx -= cam.pos[0]; wy -= cam.pos[1]; wz -= cam.pos[2];
        vx.push(V.dot([wx, wy, wz], cam.R));
        vy.push(V.dot([wx, wy, wz], cam.U));
        vz.push(V.dot([wx, wy, wz], cam.F));
      }
      if (part.kind === 'poly') {
        var vp = [];
        for (i = 0; i < np; i++) vp.push([vx[i], vy[i], vz[i]]);
        var cv = clipPolyV(vp);
        if (cv.length < 3) continue;
        var d = 0, pts2 = [];
        for (i = 0; i < cv.length; i++) {
          d += cv[i][2];
          pts2.push([cam._cx + cam._fpx * cv[i][0] / cv[i][2], cam._cy - cam._fpx * cv[i][1] / cv[i][2]]);
        }
        d = d / cv.length + part.bias + obj.layerBias;
        entries.push({ d: d, kind: 'poly', pts: pts2, part: part, obj: obj });
        if (part.pick && obj.pickable) pickList.push({ obj: obj, part: part, pts: pts2, d: d });
      } else {
        // 折线：逐段裁剪并按连续段批量
        var run = null;
        for (i = 0; i < np - 1; i++) {
          var seg = clipSegV([vx[i], vy[i], vz[i]], [vx[i + 1], vy[i + 1], vz[i + 1]]);
          if (!seg) { run = null; continue; }
          var a2d = [cam._cx + cam._fpx * seg[0][0] / seg[0][2], cam._cy - cam._fpx * seg[0][1] / seg[0][2]];
          var b2d = [cam._cx + cam._fpx * seg[1][0] / seg[1][2], cam._cy - cam._fpx * seg[1][1] / seg[1][2]];
          var dd = (seg[0][2] + seg[1][2]) / 2;
          if (run && Math.abs(run.d - dd) < 0.35) {
            run.pts.push(b2d);
            run.d = (run.d + dd) / 2;
          } else {
            run = { d: dd + part.bias + obj.layerBias, kind: 'line', pts: [a2d, b2d], part: part, obj: obj };
            entries.push(run);
          }
        }
      }
    }
  }
  entries.sort(function (a, b) { return b.d - a.d; });
}

function drawEntries() {
  var C = Env.C;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var part = e.part;
    var wmult = e.obj.hovered ? 1.35 : (e.obj.pressed ? 1.2 : 1);
    var wpx = part.wpx || LINEW[part.w] || 1.6;
    if (part.w === 'none') wpx = 0;
    var lw = 0;
    if (wpx > 0) {
      var scale = REF_DEPTH / Math.max(1.2, e.d);
      scale = Math.min(2.1, Math.max(0.55, scale));
      lw = Math.min(4.6, Math.max(0.45, wpx * scale * wmult));
    }
    var col = resolveColor(part.col);
    var alpha = part.alpha;
    ctx.globalAlpha = alpha;
    if (e.kind === 'poly') {
      var pts = e.pts;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
      var f = resolveFill(part.fill);
      if (f) { ctx.fillStyle = f; ctx.fill(); }
      if (lw > 0 && col) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = col;
        ctx.setLineDash(part.dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      if (lw > 0 && col) {
        var pts2 = e.pts;
        ctx.beginPath();
        ctx.moveTo(pts2[0][0], pts2[0][1]);
        for (var j2 = 1; j2 < pts2.length; j2++) ctx.lineTo(pts2[j2][0], pts2[j2][1]);
        ctx.lineWidth = lw;
        ctx.strokeStyle = col;
        ctx.setLineDash(part.dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }
  void C;
}

function drawFX() {
  var i, q;
  // 光晕（叠加）
  if (FX.glows.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < FX.glows.length; i++) {
      var g = FX.glows[i];
      var sc = worldToScreen(g.p);
      if (!sc) continue;
      var rpx = Math.max(4, g.r * cam._fpx / Math.max(0.5, sc[2]));
      var rgb = g.rgb;
      var grad = ctx.createRadialGradient(sc[0], sc[1], 0, sc[0], sc[1], rpx);
      grad.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + g.a + ')');
      grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sc[0], sc[1], rpx, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // 粒子
  for (i = 0; i < FX.puffs.length; i++) {
    q = FX.puffs[i];
    var s2 = worldToScreen(q.p);
    if (!s2) continue;
    var k = q.age / q.life;
    var a = q.alpha * (1 - k) * (k < 0.15 ? k / 0.15 : 1);
    var rpx2 = Math.max(0.8, q.size * (1 + k * 2.2) * cam._fpx / Math.max(0.5, s2[2]));
    ctx.fillStyle = 'rgba(' + q.col[0] + ',' + q.col[1] + ',' + q.col[2] + ',' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(s2[0], s2[1], rpx2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------- 拾取 ---------------- */
function pointInPoly(x, y, pts) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pickAt(mx, my) {
  var best = null;
  for (var i = 0; i < pickList.length; i++) {
    var it = pickList[i];
    if (it.obj.hidden) continue;
    if (mx < it.minX || mx > it.maxX || my < it.minY || my > it.maxY) continue;
    if (pointInPoly(mx, my, it.pts)) {
      if (!best || it.d < best.d) best = it;
    }
  }
  return best;
}
// 构建拾取包围盒
function buildPickBounds() {
  for (var i = 0; i < pickList.length; i++) {
    var it = pickList[i];
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    var pts = it.pts;
    for (var j = 0; j < pts.length; j++) {
      if (pts[j][0] < minX) minX = pts[j][0];
      if (pts[j][0] > maxX) maxX = pts[j][0];
      if (pts[j][1] < minY) minY = pts[j][1];
      if (pts[j][1] > maxY) maxY = pts[j][1];
    }
    it.minX = minX; it.maxX = maxX; it.minY = minY; it.maxY = maxY;
  }
}

function setHover(it) {
  var o = it ? it.obj : null;
  var p = it ? it.part : null;
  if (o === hoverObj && p === hoverPart) return;
  if (hoverObj && hoverObj.setHover) { try { hoverObj.setHover(false); } catch (e) { console.warn('[hover]', e); } }
  hoverObj = o; hoverPart = p;
  if (o && o.setHover) { try { o.setHover(true); } catch (e2) { console.warn('[hover2]', e2); } }
  if (cbHover) { try { cbHover(o, p); } catch (e3) { console.warn('[hoverCb]', e3); } }
  canvas.style.cursor = o ? 'pointer' : (input.dragging ? 'grabbing' : 'grab');
}

/* ---------------- 主循环 ---------------- */
var lastT = 0, elapsed = 0, running = false;

function frameBody(now) {
  var dt = Math.min(0.05, Math.max(0.0001, (now - lastT) / 1000 || 0.016));
  lastT = now;
  elapsed += dt;

  Tweens.tick(dt);
  Env.tick(dt);
  cam._vh = vh;
  cam._cx = vw / 2;
  cam._cy = vh * 0.46;
  camUpdate(dt);

  for (var i = 0; i < scene.objects.length; i++) {
    var o = scene.objects[i];
    if (o.hidden || !o.update) continue;
    try { o.update(dt, elapsed); } catch (e) { console.warn('[update ' + o.id + ']', e); }
  }
  FX.tick(dt);

  buildFrame();
  buildPickBounds();

  // 悬停检测
  if (input.mouseIn && !input.dragging && !input.panning) {
    setHover(pickAt(input.mx, input.my));
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = Env.C.bg;
  ctx.fillRect(0, 0, vw, vh);
  drawEntries();
  drawFX();
  FX.glows.length = 0; // glow 为每帧一次性提交：帧末清空（在绘制之后）
}

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  frameBody(now);
}

/* ---------------- 启动与事件 ---------------- */
function resize() {
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
}

function localPos(ev) {
  var r = canvas.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
}

function onDown(ev) {
  try { canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 合成指针/无活动指针时忽略 */ }
  input.pointers[ev.pointerId] = [ev.clientX, ev.clientY];
  var ids = Object.keys(input.pointers);
  if (ids.length === 2) { // 双指缩放
    var a = input.pointers[ids[0]], b = input.pointers[ids[1]];
    input.pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]);
    return;
  }
  var p = localPos(ev);
  input.downX = input.lastX = p[0]; input.downY = input.lastY = p[1];
  input.downT = performance.now();
  input.dragging = false;
  input.panning = (ev.button === 1 || ev.button === 2 || ev.ctrlKey || ev.metaKey);
  var hit = pickAt(p[0], p[1]);
  if (hit && !input.panning) {
    pressObj = hit.obj; pressPart = hit.part;
    try { pressObj.setPress(true); } catch (e) { console.warn('[press]', e); }
  } else {
    pressObj = null; pressPart = null;
  }
}

function onMove(ev) {
  if (input.pointers[ev.pointerId]) input.pointers[ev.pointerId] = [ev.clientX, ev.clientY];
  var ids = Object.keys(input.pointers);
  if (ids.length === 2) {
    var a = input.pointers[ids[0]], b = input.pointers[ids[1]];
    var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (input.pinchD > 0) {
      cam.distT *= input.pinchD / Math.max(1, d);
      camClamp();
    }
    input.pinchD = d;
    return;
  }
  var p = localPos(ev);
  input.mx = p[0]; input.my = p[1]; input.mouseIn = true;
  if (ev.buttons && (input.downT > 0)) {
    var dx = p[0] - input.lastX, dy = p[1] - input.lastY;
    if (!input.dragging && !input.panning && Math.hypot(p[0] - input.downX, p[1] - input.downY) > 7) {
      input.dragging = true;
      canvas.style.cursor = 'grabbing';
    }
    if (input.panning) {
      var s = cam.dist * 0.0011;
      cam.targetT = V.add(cam.targetT, V.add(V.mul(cam.R, -dx * s), V.mul(cam.U, dy * s)));
      camClamp();
    } else if (input.dragging) {
      cam.yawT += dx * 0.0052;
      cam.pitchT += dy * 0.0035;
      camClamp();
      cam.yawV = dx * 0.0052 * 60;
      cam.pitchV = dy * 0.0035 * 60;
    }
    input.lastX = p[0]; input.lastY = p[1];
  }
}

function onUp(ev) {
  delete input.pointers[ev.pointerId];
  input.pinchD = 0;
  var p = localPos(ev);
  var quick = (performance.now() - input.downT) < 600;
  var still = Math.hypot(p[0] - input.downX, p[1] - input.downY) < 7;
  if (pressObj && !input.dragging && !input.panning && quick && still) {
    var o = pressObj, part = pressPart;
    try { o.setPress(false); } catch (e) { console.warn('[up]', e); }
    try { o.onClick(part); } catch (e2) { console.warn('[click ' + o.id + ']', e2); }
    if (cbInteract) { try { cbInteract(o, part); } catch (e3) { console.warn('[interact]', e3); } }
  } else if (pressObj) {
    try { pressObj.setPress(false); } catch (e4) { console.warn('[up2]', e4); }
  }
  pressObj = null; pressPart = null;
  input.dragging = false; input.panning = false; input.downT = 0;
  canvas.style.cursor = hoverObj ? 'pointer' : 'grab';
}

function onWheel(ev) {
  ev.preventDefault();
  cam.distT *= Math.exp(ev.deltaY * 0.0011);
  camClamp();
}

function onLeave() { input.mouseIn = false; }

Engine.start = function (opts) {
  opts = opts || {};
  canvas = opts.canvas;
  if (!canvas) throw new Error('Engine.start: 需要 canvas');
  ctx = canvas.getContext('2d');
  cbHover = opts.onHover || null;
  cbInteract = opts.onInteract || null;
  if (opts.cam) {
    if (opts.cam.target) { cam.target = opts.cam.target.slice(); cam.targetT = opts.cam.target.slice(); }
    if (opts.cam.yaw != null) { cam.yaw = cam.yawT = opts.cam.yaw; }
    if (opts.cam.pitch != null) { cam.pitch = cam.pitchT = opts.cam.pitch; }
    if (opts.cam.dist != null) { cam.dist = cam.distT = opts.cam.dist; }
  }
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', function () {
    // 双击空白复位视角
    if (hoverObj) return;
    cam.yawT = 0.55; cam.pitchT = 0.34; cam.distT = 10.8; cam.targetT = [4.6, 1.55, 3.0];
  });
  window.addEventListener('pointerdown', function () {
    if (W.AudioKit && AudioKit.init && !AudioKit.ready) {
      try { AudioKit.init(); } catch (e) { console.warn('[audio init]', e); }
    }
  }, { capture: true });
  running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
  if (opts.onReady) opts.onReady();
};

Engine.scene = scene;
Engine.RoomObject = RoomObject;
Engine.Spring = Spring;
Engine.V = V;
Engine.X = X;
Engine.E = E;
Engine.worldToScreen = worldToScreen;
Engine.cam = cam;
Engine.hover = function () { return hoverObj; };
Engine.hoverPart = function () { return hoverPart; };
Engine.elapsed = function () { return elapsed; };
Engine.step = function (nowMs) { if (running && frameBody) frameBody(nowMs); }; // 测试/降频钩子

})();
