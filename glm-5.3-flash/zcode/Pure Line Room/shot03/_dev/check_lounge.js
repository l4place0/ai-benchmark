/* 客厅组冒烟自检：加载全部依赖 → 5 工厂各走一遍交互生命周期 → 打印关键几何验证 */
global.window = global;
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.join(__dirname, '..', 'js');
for (const f of ['math.js', 'style.js', 'builders.js', 'audio.js', 'engine.js', 'room.js',
  'objects/door.js', 'objects/sideboard.js', 'objects/player.js', 'objects/sofa.js', 'objects/table.js', 'objects/rug.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}

/* ---- 复刻引擎 worldPt：部件链(外→内) + root 变换 ---- */
const M = RLR.M;
function rotApply(q, yaw, pitch, roll) {
  if (yaw) q = M.rotY(q, yaw);
  if (pitch) q = M.rotX(q, pitch);
  if (roll) q = M.rotZ(q, roll);
  return q;
}
function xfPoint(q, xf) {
  if (xf.pivot) q = [q[0] - xf.pivot[0], q[1] - xf.pivot[1], q[2] - xf.pivot[2]];
  if (xf.scale) q = [q[0] * xf.scale[0], q[1] * xf.scale[1], q[2] * xf.scale[2]];
  q = rotApply(q, xf.yaw || 0, xf.pitch || 0, xf.roll || 0);
  if (xf.pivot) q = [q[0] + xf.pivot[0], q[1] + xf.pivot[1], q[2] + xf.pivot[2]];
  if (xf.off) q = [q[0] + xf.off[0], q[1] + xf.off[1], q[2] + xf.off[2]];
  return q;
}
function worldPt(obj, part, p) {
  let q = p;
  if (part && obj.parts[part]) {
    const chain = []; let nm = part, g = 0;
    while (nm && obj.parts[nm] && g++ < 8) { chain.push(obj.parts[nm]); nm = obj.parts[nm].parent; }
    for (let i = chain.length - 1; i >= 0; i--) q = xfPoint(q, chain[i]);
  }
  q = rotApply(q, obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
  return [q[0] + obj.pivot[0] + obj.off[0], q[1] + obj.pivot[1] + obj.off[1], q[2] + obj.pivot[2] + obj.off[2]];
}
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
let fails = 0;
function assert(ok, msg) { console.log((ok ? '  PASS' : '  FAIL') + ' ' + msg); if (!ok) fails++; }

/* ---- 生命周期冒烟 ---- */
const cases = [
  ['createSideboard', { pivot: [2.44, 0, -0.8] }],
  ['createPlayer', { pivot: [2.46, 0.78, -0.8] }],
  ['createSofa', { pivot: [2.18, 0, 0.95] }],
  ['createTable', { pivot: [1.45, 0, 0.95] }],
  ['createRug', { pivot: [1.35, 0, 0.75] }]
];
const objs = {};
for (const [fn, opts] of cases) {
  const o = RLR[fn](opts); RLR.Engine.add(o);
  objs[o.name] = o;
  if (o.onHover) o.onHover(true);
  o.update && o.update(0.016, 0.5);
  if (o.onHover) o.onHover(false);
  o.action && o.action();
  o.update && o.update(0.016, 0.6);
  console.log('OK', o.name, 'faces:' + o.faces.length, 'strokes:' + o.strokes.length, 'hits:' + o.hits.length);
}

/* ---- 验证 1：边柜双门开(90°+)自由端世界 x（朝 -x 外开、不穿柜体）---- */
console.log('[sideboard] doors open check');
{
  const o = objs.sideboard;
  o.dlT = 1; o.drT = 1; o.sdT = 1; o.update(0.016, 0);
  const dlFree = worldPt(o, 'dl', [-0.21, 0.30, 0.34]);
  const drFree = worldPt(o, 'dr', [-0.21, 0.30, -0.34]);
  console.log('  dl free-end world =', dlFree.map(v => v.toFixed(3)).join(','),
    ' dr free-end world =', drFree.map(v => v.toFixed(3)).join(','));
  /* 柜体前沿世界 x = 2.44-0.21 = 2.23；自由端须明显伸向 -x。
     注：规格字面 "x < -2.6" 需门长 2.4m 横穿全屋，与 pivot[2.44,0,-0.80] 几何不可能，
     此处按真实语义断言：自由端越过前沿 ≥0.5m 且不穿柜体(全部角点 local x ≤ -0.19)。 */
  assert(dlFree[0] < 1.73 && drFree[0] < 1.73, 'door free-end world x < 1.73 (beyond front plane 2.23 by >=0.5m, opens toward -x)');
  let worst = -1;
  for (const x of [-0.22, -0.20]) for (const y of [0.05, 0.55]) for (const z of [-0.34, 0.34]) {
    for (const [part, pt] of [['dl', [x, y, z]], ['dr', [x, -y === 0.05 ? 0.05 : y, z]]]) { /* 两门几何同构 */
      const w = worldPt(o, part, pt);
      worst = Math.max(worst, w[0] - o.pivot[0]);   /* 还原 object-local x */
    }
  }
  assert(worst <= -0.19, 'no door corner penetrates cabinet body (max local x=' + worst.toFixed(3) + ' <= -0.19)');
  const sdOut = worldPt(o, 'sd', [-0.21, 0.615, 0]);
  assert(Math.abs((sdOut[0] - o.pivot[0]) + 0.39) < 1e-6, 'drawer open offset -0.18 applied (front at local x=' + (sdOut[0] - o.pivot[0]).toFixed(3) + ')');
}

/* ---- 验证 2：唱臂 play 位唱头到盘心距离 < 0.09 ---- */
console.log('[player] stylus-on-record check');
{
  const o = objs.player;
  o.armT = 1; o.spdT = 1; o.update(0.016, 0);
  const head = worldPt(o, 'arm', [-0.115, 0.12, -0.155]);
  const d = dist(head, [2.44, 0.895, -0.74]);
  console.log('  stylus world =', head.map(v => v.toFixed(4)).join(','), ' dist to spindle-centre =', d.toFixed(4));
  assert(d < 0.09, 'stylus within 0.09 of disc centre [2.44,0.895,-0.74]');
  o.armT = 0; o.update(0.016, 0);
  const rest = worldPt(o, 'arm', [-0.115, 0.12, -0.155]);
  console.log('  rest head world =', rest.map(v => v.toFixed(3)).join(','), '(on deck, clear of wall x=2.58)');
  assert(rest[0] < 2.58 && rest[2] > -1.06, 'resting arm stays on the deck / out of the wall');
}

/* ---- 验证 3：地毯掀角自由角世界 y > 0.1 ---- */
console.log('[rug] flap lift check');
{
  const o = objs.rug;
  o.flapT = 1; o.update(0.016, 0);
  const corner = worldPt(o, 'flap', [-0.85, 0.006, 1.00]);
  console.log('  lifted corner world =', corner.map(v => v.toFixed(3)).join(','));
  assert(corner[1] > 0.1, 'lifted free corner world y > 0.1 (sign of roll verified)');
  o.flapT = 0; o.update(0.016, 0);
  const closed = worldPt(o, 'flap', [-0.85, 0.006, 1.00]);
  assert(Math.abs(closed[1] - 0.006) < 1e-6 && Math.abs(closed[0] - 0.50) < 1e-6, 'closed flap restores notch corner exactly');
}

/* ---- 验证 4：沙发抱枕压扁标量写回 ---- */
console.log('[sofa] pillow squish check');
{
  const o = objs.sofa;
  o.sq1 = 1; o.update(0.016, 0);
  assert(Math.abs(o.parts.pw1.scale[1] - 0.78) < 1e-6, 'pw1 scale y = 0.78 when sq1=1');
}

/* ---- 渲染冒烟：mock canvas 跑 6 帧（投影/画家排序/填充/排线/拾取全链路）---- */
console.log('[render] headless frame smoke');
{
  const realErr = console.error;
  let renderErr = null;
  console.error = (...a) => { renderErr = renderErr || a.join(' '); };
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createRadialGradient') return () => grad;
      if (k === 'canvas') return canvasMock;
      return () => {};
    },
    set() { return true; }
  });
  const canvasMock = {
    getContext: () => ctx, style: {},
    addEventListener() {}, setPointerCapture() {},
    width: 0, height: 0
  };
  global.document = { getElementById: () => null, addEventListener() {}, hidden: false };
  global.addEventListener = () => {};   /* window === global */
  let rafCb = null;
  global.requestAnimationFrame = cb => { rafCb = cb; };
  global.devicePixelRatio = 1;
  global.innerWidth = 1280; global.innerHeight = 800;
  try {
    RLR.Engine.init(canvasMock);
    let ts = 0;
    for (let i = 0; i < 150; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); }  /* 等相机收敛 */
    /* 相机稳定后正向拾取验证 */
    const pickAt = (p) => { const pr = RLR.Engine.project(p); return RLR.Engine.pick(pr.x, pr.y); };
    const h1 = pickAt([1.33, 0.44, 0.97]);
    assert(h1 && h1.obj.name === 'table' && h1.tag === 'book', 'pick at book -> table:book' + (h1 ? ' (got ' + h1.obj.name + ':' + h1.tag + ')' : ' (none)'));
    const h2 = pickAt([2.23, 0.615, -0.8]);
    assert(h2 && h2.obj.name === 'sideboard', 'pick at drawer front -> sideboard (' + (h2 ? 'tag ' + h2.tag : 'none') + ')');
    const h3 = pickAt([0.9, 0.004, 0.4]);
    assert(h3 && h3.obj.name === 'rug' && h3.tag === 'rug', 'pick at rug body -> rug:rug' + (h3 ? ' (got ' + h3.obj.name + ':' + h3.tag + ')' : ' (none)'));
    const sb = RLR.Engine.project([2.23, 0.39, -0.8]);
    console.log('  info: sideboard front centre projects to', sb ? sb.x.toFixed(0) + ',' + sb.y.toFixed(0) : 'off-screen',
      '(默认机位 yaw=+0.5 位于右墙外侧，右墙物件可能被墙面遮挡——集成者请确认初始机位)');
    /* 播放态再跑 3 帧（音符/盘旋转/抖毯路径） */
    const pl = objs.player; pl.action(); pl.update && pl.update(0.016, 3);
    const rg = objs.rug; rg.action('rug'); rg.action('flap');
    for (let i = 0; i < 3; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); }
  } catch (e) { renderErr = renderErr || String(e && e.stack || e); }
  console.error = realErr;
  assert(!renderErr, 'frames render without errors' + (renderErr ? ' -> ' + renderErr : ''));
}

console.log(fails ? 'CHECKS FAILED: ' + fails : 'ALL GEOMETRY CHECKS PASSED');
process.exit(fails ? 1 : 0);
