/* 冒烟自检：node _dev/check_walls.js（无 DOM/无 AudioContext，Audio 自动空转） */
global.window = global;
/* 最小 document 垫片：Engine.toast 查 #toasts，返回 null 即安全退出 */
global.document = {
  getElementById: () => null,
  addEventListener() {},
  createElement() { return { classList: { add() {}, remove() {} }, remove() {}, style: {} }; }
};
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.join(__dirname, '..', 'js');
for (const f of ['math.js', 'style.js', 'builders.js', 'audio.js', 'engine.js', 'room.js',
  'objects/door.js', 'objects/window.js', 'objects/fan.js', 'objects/chime.js',
  'objects/switch.js', 'objects/art.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const cases = [
  ['createCurtains', { pivot: [0.95, 0, -2.13] }],
  ['createFan', { pivot: [0, 3.02, 0.35] }],
  ['createChime', { pivot: [2.05, 3.02, -1.9] }],
  ['createSwitch', { pivot: [-2.585, 1.16, 0.3] }],
  ['createArtA', { pivot: [-1.78, 2.02, -2.185] }],
  ['createArtB', { pivot: [2.585, 1.78, -0.8] }]
];
for (const [fn, opts] of cases) {
  const o = RLR[fn](opts); RLR.Engine.add(o);
  if (o.onHover) o.onHover(true);
  o.update && o.update(0.016, 0.5);
  if (o.onHover) o.onHover(false);
  o.action && o.action();
  o.update && o.update(0.016, 0.6);
  console.log('OK', o.name, 'faces:' + o.faces.length, 'strokes:' + o.strokes.length, 'hits:' + o.hits.length);
}

/* ---- 转动方向自测（无相机，仅数值逻辑） ---- */
const M = RLR.M, f3 = a => a.map(v => v.toFixed(3)).join(',');
console.log('[rotX] +y, a=+0.3 ->', f3(M.rotX([0, 1, 0], 0.3)), '(期望 z>0：+y 转向 +z)');
console.log('[rotY] +x, a=+0.3 ->', f3(M.rotY([1, 0, 0], 0.3)), '(期望 z<0：+x 转向 -z)');
console.log('[rotZ] +x, a=+0.3 ->', f3(M.rotZ([1, 0, 0], 0.3)), '(期望 y>0：+x 转向 +y)');

/* 吊扇：yaw=0.5 后叶尖（+x 侧）应转向 -z（俯视逆时针） */
const fan = RLR.Engine.byName['fan'];
fan.parts.blades.yaw = 0.5;
const blade = fan.faces.find(f => f.part === 'blades' && f.pts.length === 4);
const tip = blade.pts[2];                                  // 外端一角，对象坐标
const rel = [tip[0], tip[1] + 0.26, tip[2]];               // 相对 blades pivot [0,-0.26,0]
console.log('[fan] 叶尖局部 yaw0.5:', f3(M.rotY(rel, 0.5)), '(z 应为负)');

/* 窗帘：开合写回 off/scale */
const cu = RLR.Engine.byName['curtains'];
cu.action(); cu.t = 1; cu.update(0.016, 1);
console.log('[curtains] open  pl.off=' + f3(cu.parts.pl.off), 'scale=' + f3(cu.parts.pl.scale),
  '(期望 off x≈-0.37 → 中心 -0.85, scale0≈0.55)');
cu.action(); cu.t = 0; cu.update(0.016, 1);
console.log('[curtains] close pl.off=' + f3(cu.parts.pl.off), '(期望 x≈+0.05 → 中心 -0.43)');

/* 开关：env.t 只由它补间；nub.roll 目标 ±0.55（上方循环已 action 过一次，此处先复位再拨） */
const sw = RLR.Engine.byName['switch'];
sw.night = true;                                            // 复位到"夜"，下一步拨回"昼"
sw.action();
console.log('[switch] action 后 night=' + sw.night, '(期望 false)',
  'nub.roll 目标 -0.55(补间未跑帧)=' + sw.parts.nub.roll, 'env.t 目标 0(未跑帧)=' + RLR.Engine.env.t);

/* 挂画A/B */
const aa = RLR.Engine.byName['artA'];
console.log('[artA] pic.roll=' + aa.parts.pic.roll, '(未跑帧，初始 0.07 或已在循环中开始扶正补间)',
  'straight=' + aa.straight);
aa.parts.pic.roll = 0.07; aa.straight = false;              // 复位歪挂
aa.action();
console.log('[artA] 扶正后 straight=' + aa.straight, '(期望 true), roll 补间目标 0');
const ab = RLR.Engine.byName['artB'];
ab.set = 0; ab.sets.forEach((set, i) => set.forEach(s => { s.alpha = i === 0 ? 1 : 0; }));  // 复位第一套
console.log('[artB] 三套笔画数:', ab.sets.map(s => s.length).join('/'),
  'alpha:', ab.sets.map(s => s[0].alpha).join('/'), '(期望 1/0/0)');
ab.action();
console.log('[artB] 切换后 alpha:', ab.sets.map(s => s[0].alpha).join('/'), '(期望 0/1/0)');

/* ---- 世界坐标抽检（按引擎 xfPoint/worldPt 语义复算，验证与建筑对位） ---- */
function rotApply(q, y, p, r) { if (y) q = M.rotY(q, y); if (p) q = M.rotX(q, p); if (r) q = M.rotZ(q, r); return q; }
function xfPoint(p, xf) {
  let q = p;
  if (xf.pivot) q = [q[0] - xf.pivot[0], q[1] - xf.pivot[1], q[2] - xf.pivot[2]];
  if (xf.scale) q = [q[0] * xf.scale[0], q[1] * xf.scale[1], q[2] * xf.scale[2]];
  q = rotApply(q, xf.yaw || 0, xf.pitch || 0, xf.roll || 0);
  if (xf.pivot) q = [q[0] + xf.pivot[0], q[1] + xf.pivot[1], q[2] + xf.pivot[2]];
  if (xf.off) q = [q[0] + xf.off[0], q[1] + xf.off[1], q[2] + xf.off[2]];
  return q;
}
function worldPt(obj, partName, p) {
  let q = p;
  if (partName && obj.parts[partName]) {
    const chain = []; let nm = partName, g = 0;
    while (nm && obj.parts[nm] && g++ < 8) { chain.push(obj.parts[nm]); nm = obj.parts[nm].parent; }
    for (let i = chain.length - 1; i >= 0; i--) q = xfPoint(q, chain[i]);
  }
  if (obj.yaw || obj.pitch || obj.roll) q = rotApply(q, obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
  const pv = obj.pivot, off = obj.off;
  return [q[0] + pv[0] + (off ? off[0] : 0), q[1] + pv[1] + (off ? off[1] : 0), q[2] + pv[2] + (off ? off[2] : 0)];
}
const w3 = a => '[' + a.map(v => v.toFixed(3)).join(', ') + ']';

const cu2 = RLR.Engine.byName['curtains'];
cu2.t = 0; cu2.update(0.016, 1);
const plFace = cu2.faces.find(f => f.part === 'pl');
const plL = worldPt(cu2, 'pl', plFace.pts[0]), plR = worldPt(cu2, 'pl', plFace.pts[1]);
console.log('[world] 窗帘pl闭合左右上角:', w3(plL), w3(plR), '(窗洞世界 x 0.10..1.80，应覆盖其左半)');

const fan2 = RLR.Engine.byName['fan'];
const tipW = worldPt(fan2, 'blades', [0.58, -0.224, 0]);
console.log('[world] 扇叶尖:', w3(tipW), '(应距扇轴≈0.58, y≈2.76..2.80)');

const ch = RLR.Engine.byName['chime'];
const tb = worldPt(ch, 'tube4', [Math.cos(8 * Math.PI / 5) * 0.034, -0.84, Math.sin(8 * Math.PI / 5) * 0.034]);
console.log('[world] 最长铜管底:', w3(tb), '(静止期望 y≈2.18；此处含 action 后 imp 摆动分量，y 略高即正确)');

const aa2 = RLR.Engine.byName['artA'];
const frC = worldPt(aa2, 'pic', [0, 0, 0.0175]);
console.log('[world] 画A框前中心:', w3(frC), '(期望 x≈-1.78, y≈2.02, z≈-2.1675，歪0.07略偏)');

const ab2 = RLR.Engine.byName['artB'];
const liC = worldPt(ab2, 'pic', [-0.012, 0, 0]);
console.log('[world] 画B内衬中心:', w3(liC), '(期望 x≈2.573 < 墙面2.58, z≈-0.80)');

const sw2 = RLR.Engine.byName['switch'];
const pxW = worldPt(sw2, null, [0.007, 0, 0]);
console.log('[world] 开关面板面:', w3(pxW), '(期望 x≈-2.578，凸出墙面-2.58)');

/* 拾取盒随动抽检：窗帘 hit 中心在开/合两态的世界位置 */
function hitCenter(obj, h) {
  const c = worldPt(obj, h.part, h.c);
  return c;
}
cu2.t = 0; cu2.update(0.016, 1);
console.log('[world] pl hit中心(闭):', w3(hitCenter(cu2, cu2.hits[0])), '(期望世界 x≈0.52 = 0.95-0.43)');
cu2.t = 1; cu2.update(0.016, 1);
console.log('[world] pl hit中心(开):', w3(hitCenter(cu2, cu2.hits[0])), '(期望世界 x≈0.10 = 0.95-0.85)');
console.log('DONE');
