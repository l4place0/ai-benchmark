/* engine.js 无头自测（仅开发期使用，不属于作品） */
'use strict';
global.window = global;
global.performance = { now: () => Date.now() };
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, 'js', 'engine.js'), 'utf8'));

const E = window.Engine, V = E.V;
let fails = 0;
function ok(cond, name) { if (cond) console.log('  ok -', name); else { fails++; console.log('  FAIL -', name); } }

// 1) 数学
ok(Math.abs(V.cross([1, 0, 0], [0, 1, 0])[2] - 1) < 1e-9, '叉积');
const xf = E.X.xform([[1, 0, 0]], { pivot: [0, 0, 0], rotY: 90 });
ok(Math.abs(xf[0][0]) < 1e-9 && Math.abs(xf[0][2] + 1) < 1e-9, 'rotY 90°: (1,0,0)->(0,0,-1)');
const xf2 = E.X.xform([[1, 0, 0]], { move: [1, 2, 3], scale: 2 });
ok(xf2[0][0] === 3 && xf2[0][1] === 2 && xf2[0][2] === 3, 'scale+move');

// 2) 对象构建
const obj = new E.RoomObject({ id: 'test', label: '测试', pos: [5, 0, 5] });
const b = obj.box(1, 2, 1, [0, 0, 0], {});
ok(b.faces.length === 6 && b.edges.length === 9, 'box: 6面+9边(跳过底)');
ok(b.faces[0].pick && b.faces[2].pick && b.faces[4].pick && !b.faces[1].pick, '前/右/左/顶可拾取');
const c = obj.circ([0, 1, 0], 0.5, 'y', {});
ok(c.kind === 'line' && c.pts.length === 27, 'circ 采样');
const cy = obj.cyl([0, 0, 0], 0.3, 1, 'y', { profiles: 2 });
ok(cy.circles.length === 2 && cy.profiles.length === 2, 'cyl 两圈两轮廓');
const hs = obj.hatch([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 4, {});
ok(hs.length === 4, 'hatch n 条');
const wp = obj.world([1, 0, 0]);
ok(Math.abs(wp[0] - 6) < 1e-9 && Math.abs(wp[2] - 5) < 1e-9, 'world() rotY=0');
obj.setRotY(90);
const wp2 = obj.world([1, 0, 0]);
ok(Math.abs(wp2[0] - 5) < 1e-9 && Math.abs(wp2[2] - 4) < 1e-9, 'world() rotY=90: +x→-z');

// 3) part 动画
const f0 = b.faces[0];
f0.set({ rotY: 45, pivot: [0, 0, 0], move: [0, 0.1, 0] });
ok(f0.pts[0][2] !== f0.base[0][2], 'part.set 生效');

// 4) 补间
const tgt = { v: 0 };
window.Tweens.add(tgt, 'v', 1, { dur: 0.1, ease: E.E.linear });
for (let i = 0; i < 20; i++) window.Tweens.tick(0.01);
ok(Math.abs(tgt.v - 1) < 0.01, 'tween 到位');

// 5) 弹簧
const sp = new E.Spring(3, 0.3);
sp.kick(2);
let maxX = 0;
for (let i = 0; i < 600; i++) maxX = Math.max(maxX, Math.abs(sp.tick(1 / 60)));
ok(maxX > 0.01 && Math.abs(sp.x) < 0.01, 'spring 起振并衰减');

// 6) Env 配色
ok(typeof Env.C.ink === 'string' && Env.C.ink.startsWith('rgb'), 'Env.C.ink');
Env.setNight(true);
for (let i = 0; i < 200; i++) Env.tick(0.016);
ok(Env.skyT > 0.99 && Env.C.bg.startsWith('rgb(232'), '夜色(开灯)过渡到位');
Env.setLights(false);
for (let i = 0; i < 200; i++) Env.tick(0.016);
ok(Env.C.ink.startsWith('rgb(213'), '关灯反相配色');
Env.setNight(false); Env.setLights(true);
for (let i = 0; i < 200; i++) Env.tick(0.016);

// 7) 近平面裁剪
const cv = (() => {
  // 直接调用内部逻辑：构造一个跨越近平面的多边形
  const pts = [[0, 0, 0.1], [1, 0, 0.1], [1, 1, 1], [0, 1, 1]];
  // 用 buildFrame 间接验证：把 obj 放到相机后面
  return null;
})();
void cv;

// 8) 用假 ctx 跑一帧渲染管线
const calls = {};
const grad = { addColorStop: () => {} };
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'createRadialGradient') return () => grad;
    if (k === 'measureText') return () => ({ width: 10 });
    if (!(k in t)) return (...a) => { calls[k] = (calls[k] || 0) + 1; };
    return t[k];
  },
  set(t, k, v) { t[k] = v; return true; }
});
global.window.innerWidth = 1280; global.window.innerHeight = 800;
global.window.devicePixelRatio = 1;
global.window.addEventListener = () => {};
global.requestAnimationFrame = (fn) => { global.__raf = fn; };
const fakeCanvas = { getContext: () => fakeCtx, style: {}, addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
E.scene.add(obj); // 先入场景再启动，首帧才有内容可画
E.start({ canvas: fakeCanvas });
global.__raf(16);
global.__raf(32);
ok(calls.fillRect >= 1, '清屏 fillRect');
ok(calls.stroke >= 1, '描边发生');
ok(calls.fill >= 1, '填充发生');

// 9) 场景拾取注册
ok(E.scene.get('test') === obj, 'scene.get 注册');

console.log(fails ? ('\n' + fails + ' 项失败') : '\n全部通过');
process.exit(fails ? 1 : 0);
