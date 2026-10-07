/* 冒烟自检：加载引擎与 6 物件 → 实例化/交互冒烟 + NaN 扫描 + 灯头/地球仪部件世界坐标验证 */
global.window = global;
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.join(__dirname, '..', 'js');
for (const f of ['math.js', 'style.js', 'builders.js', 'audio.js', 'engine.js', 'room.js', 'objects/door.js',
  'objects/desk.js', 'objects/chair.js', 'objects/lamp.js', 'objects/cup.js', 'objects/globe.js', 'objects/plant.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}

const cases = [
  ['createDesk', { pivot: [-1.78, 0, -1.82] }],
  ['createChair', { pivot: [-1.7, 0, -1.18] }],
  ['createLamp', { pivot: [-2.32, 0.76, -1.86] }],
  ['createCup', { pivot: [-1.55, 0.76, -1.78] }],
  ['createGlobe', { pivot: [-1.16, 0.76, -1.8] }],
  ['createPlant', { pivot: [1.52, 0.95, -2.16] }]
];
let fail = 0;
for (const [fn, opts] of cases) {
  const o = RLR[fn](opts); RLR.Engine.add(o);
  if (o.onHover) o.onHover(true);
  o.update && o.update(0.016, 0.5);
  if (o.onHover) o.onHover(false);
  o.action && o.action();
  o.update && o.update(0.016, 0.6);
  o.update && o.update(0.016, 0.7); /* 再走一帧看持续动态 */
  /* NaN/维数扫描 */
  let bad = 0;
  const scan = pts => { if (!pts || pts.length < 2) { bad++; return; } for (const p of pts) for (const v of p) if (!isFinite(v)) bad++; };
  for (const f of o.faces) { scan(f.pts); if (f.strokes) for (const s of f.strokes) scan(s.pts); }
  for (const s of o.strokes) scan(s.pts);
  console.log('OK', o.name, 'faces:' + o.faces.length, 'strokes:' + o.strokes.length, 'hits:' + o.hits.length, bad ? ('BAD_PTS:' + bad) : '');
  if (bad || !o.faces.length || !o.hits.length) fail++;
}

/* 复刻引擎 worldPt 的部件链变换（外层先作用） */
function xfPart(obj, partName, p) {
  const chain = []; let nm = partName;
  while (nm && obj.parts[nm]) { chain.push(obj.parts[nm]); nm = obj.parts[nm].parent; }
  let q = p.slice();
  for (let i = chain.length - 1; i >= 0; i--) {
    const xf = chain[i];
    q = [q[0] - xf.pivot[0], q[1] - xf.pivot[1], q[2] - xf.pivot[2]];
    const ya = xf.yaw || 0, pi = xf.pitch || 0, ro = xf.roll || 0;
    if (ya) { const c = Math.cos(ya), s = Math.sin(ya); q = [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c]; }
    if (pi) { const c = Math.cos(pi), s = Math.sin(pi); q = [q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c]; }
    if (ro) { const c = Math.cos(ro), s = Math.sin(ro); q = [q[0] * c - q[1] * s, q[0] * s + q[1] * c, q[2]]; }
    q = [q[0] + xf.pivot[0], q[1] + xf.pivot[1], q[2] + xf.pivot[2]];
    if (xf.off) q = [q[0] + xf.off[0], q[1] + xf.off[1], q[2] + xf.off[2]];
  }
  const pv = obj.pivot, of = obj.off || [0, 0, 0];
  return [q[0] + pv[0] + of[0], q[1] + pv[1] + of[1], q[2] + pv[2] + of[2]];
}
const f3 = a => a.map(v => v.toFixed(3)).join(',');

/* 台灯：灯罩口沿最低点必须悬在桌面上方(>0.765) 且灯头伸向 +x */
const lamp = RLR.Engine.byName['lamp'];
const mouth = xfPart(lamp, 'head', [0, -0.0375, 0]);
let minY = 1e9, minPt = null;
for (let i = 0; i < 32; i++) {
  const t = i / 32 * Math.PI * 2;
  const w = xfPart(lamp, 'head', [0.085 * Math.cos(t), -0.0375, 0.085 * Math.sin(t)]);
  if (w[1] < minY) { minY = w[1]; minPt = w; }
}
const bulb = xfPart(lamp, 'head', [0, 0.04, 0]);
console.log('lamp 罩口沿中心世界:', f3(mouth));
console.log('lamp 罩口沿最低点世界:', f3(minPt), ' minY=' + minY.toFixed(4));
console.log('lamp 灯泡世界:', f3(bulb), ' head.roll=' + lamp.parts.head.roll.toFixed(4));
if (!(minY > 0.765)) { console.error('FAIL: 灯头低于桌面'); fail++; }
if (!(mouth[0] > lamp.pivot[0] + 0.12 && bulb[0] > lamp.pivot[0] + 0.12)) { console.error('FAIL: 灯头未伸向 +x'); fail++; }

/* 地球仪：球面点距球心恒 0.115；action 后自转已推进 */
const globe = RLR.Engine.byName['globe'];
const ctr = [globe.pivot[0], globe.pivot[1] + 0.175, globe.pivot[2]];
for (const [th, lo] of [[20, 40], [90, 130], [160, 250]]) {
  const w = xfPart(globe, 'tilt', [(0.115 * Math.sin(th * Math.PI / 180) * Math.cos(lo * Math.PI / 180)) , 0.175 + 0.115 * Math.cos(th * Math.PI / 180), 0.115 * Math.sin(th * Math.PI / 180) * Math.sin(lo * Math.PI / 180)]);
  const d = Math.hypot(w[0] - ctr[0], w[1] - ctr[1], w[2] - ctr[2]);
  if (Math.abs(d - 0.115) > 1e-6) { console.error('FAIL: 球面点距球心', d); fail++; }
}
console.log('globe 球顶世界:', f3(xfPart(globe, 'tilt', [0, 0.29, 0])), ' spin.yaw=' + globe.parts.spin.yaw.toFixed(4));
if (!(globe.parts.spin.yaw > 0.01)) { console.error('FAIL: 自转未生效'); fail++; }

/* 书桌抽屉 hit 世界位置（合上时应在柜门前缘） */
const desk = RLR.Engine.byName['desk'];
const dh = desk.hits[0];
console.log('desk 抽屉hit世界(合):', f3([desk.pivot[0] + dh.c[0] + desk.parts.dr.off[0], desk.pivot[1] + dh.c[1], desk.pivot[2] + dh.c[2] + desk.parts.dr.off[2]]));

console.log('lampPos:', RLR.Engine.light.lampPos, ' lampI:', RLR.Engine.light.lampI.toFixed(3));
if (fail) { console.error('SELF-CHECK FAILED:', fail); process.exit(1); }
console.log('SELF-CHECK PASSED');
