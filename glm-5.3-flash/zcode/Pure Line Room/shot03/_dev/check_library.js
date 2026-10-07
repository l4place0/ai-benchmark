/* 书架/挂钟 冒烟自检：加载依赖 → 两工厂走完整交互生命周期 → 几何/状态验证 → 渲染链路冒烟 */
global.window = global;
global.document = { getElementById: () => null, addEventListener() {}, hidden: false };
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.join(__dirname, '..', 'js');
for (const f of ['math.js', 'style.js', 'builders.js', 'audio.js', 'engine.js', 'room.js',
  'objects/door.js', 'objects/shelf.js', 'objects/clock.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}

let fails = 0;
const assert = (ok, msg) => { console.log((ok ? '  PASS ' : '  FAIL ') + msg); if (!ok) fails++; };

/* ---- 生命周期冒烟 ---- */
for (const [fn, opts] of [['createShelf', { pivot: [-2.5, 0, -1.3] }], ['createClock', { pivot: [-0.42, 2.32, -2.185] }]]) {
  const o = RLR[fn](opts); RLR.Engine.add(o);
  if (o.onHover) o.onHover(true);
  o.update && o.update(0.016, 0.5);
  if (o.onHover) o.onHover(false);
  o.action && o.action('b2'); o.action && o.action('red');
  o.update && o.update(0.016, 0.6);
  console.log('OK', o.name, 'faces:' + o.faces.length, 'strokes:' + o.strokes.length, 'hits:' + o.hits.length);
}

/* ---- 挂钟：10:30:00 三针角度 ---- */
console.log('[clock] hands at 2026-10-01T10:30:00');
{
  const ck = RLR.Engine.byName.clock;
  RLR.Engine.env.time = new Date('2026-10-01T10:30:00');
  ck._ls = -1; ck.update(0.016, 1.0);
  const hh = ck.parts.hh.roll, mh = ck.parts.mh.roll, sh = ck.parts.sh.roll;
  console.log('  hh=' + hh.toFixed(4), 'mh=' + mh.toFixed(4), 'sh=' + sh.toFixed(4));
  assert(Math.abs(hh - (-(10.5 / 12) * 2 * Math.PI)) < 1e-9, 'hh = -(10.5/12)*2PI (' + (-(10.5 / 12) * 2 * Math.PI).toFixed(4) + ')');
  assert(Math.abs(mh + Math.PI) < 1e-9, 'mh = -PI');
  assert(Math.abs(sh) < 1e-9, 'sh = 0 (second hand at 12)');
  assert(Math.abs(ck.parts['case'].scale[0] - 1) < 1e-9, 'case scale idle = 1');
}

/* ---- 书架：可拉书/红皮书/暗格 parts + 标量写回 ---- */
console.log('[shelf] parts & scalar write-back');
{
  const sf = RLR.Engine.byName.shelf;
  assert(sf.pulls.length === 6, 'pulls.length === 6');
  const need = ['bk1', 'bk2', 'bk3', 'bk4', 'bk5', 'bk6', 'bkR', 'sec', 'lean0', 'lean3', 'frame', 'vine0', 'vine1', 'vine2'];
  const missing = need.filter(p => !sf.parts[p]);
  assert(missing.length === 0, 'all expected parts exist' + (missing.length ? ' (missing: ' + missing.join(',') + ')' : ''));
  sf.pulls[1] = 1; sf.hpk = 0; sf.update(0.016, 0);
  assert(Math.abs(sf.parts.bk2.off[0] - 0.12) < 1e-9, 'bk2.off x = 0.12 when pulls[1]=1');
  sf.redT = 1; sf.update(0.016, 0);
  assert(sf.secTarget === 1, 'full red pull triggers secret open (target=1)');
  sf.secT = 1; sf.update(0.016, 0);
  assert(Math.abs(sf.parts.sec.off[0] + 0.02) < 1e-9, 'sec.off x = -0.02 when open');
  sf.redT = 0.3; sf.update(0.016, 0);
  assert(sf.secTarget === 0, 'red push-back retracts secret (target=0)');
  sf.redT = 0; sf.secT = 0; sf.update(0.016, 0);
  assert(Math.abs(sf.parts.sec.off[0] + 0.10) < 1e-9, 'sec.off x = -0.10 when hidden');
  assert(Math.abs(sf.parts.bkR.off[0]) < 1e-9, 'bkR.off x = 0 when closed');
  sf.onHover(true, 'b3'); sf.hpk = 1; sf.update(0.016, 0);
  assert(Math.abs(sf.parts.bk3.off[0] - 0.02) < 1e-9, 'hover peek bk3 x = 0.02');
  sf.onHover(false, 'b3'); sf.hpk = 0; sf.update(0.016, 0);
  assert(Math.abs(sf.parts.bk3.off[0]) < 1e-9, 'bk3 back to 0 after hover out');
}

/* ---- 渲染冒烟：mock canvas 跑数帧（投影/排序/填充/描线全链路） ---- */
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
      return () => {};
    },
    set() { return true; }
  });
  const canvasMock = { getContext: () => ctx, style: {}, addEventListener() {}, setPointerCapture() {}, width: 0, height: 0 };
  global.addEventListener = () => {};
  let rafCb = null;
  global.requestAnimationFrame = cb => { rafCb = cb; };
  global.devicePixelRatio = 1;
  global.innerWidth = 1280; global.innerHeight = 800;
  try {
    RLR.Engine.init(canvasMock);
    let ts = 0;
    for (let i = 0; i < 150; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); }
    /* 相机收敛后正向拾取：红皮书 / 暗格 / 挂钟盘面 */
    const pickAt = p => { const pr = RLR.Engine.project(p); return RLR.Engine.pick(pr.x, pr.y); };
    const h1 = pickAt([-2.26, 0.94, -0.8]);
    assert(h1 && h1.obj.name === 'shelf' && (h1.tag === 'red' || h1.tag === 'sec' || /^b\d$/.test(h1.tag || '')),
      'pick at shelf front -> shelf (' + (h1 ? h1.obj.name + ':' + h1.tag : 'none') + ')');
    const h2 = pickAt([-0.42, 2.32, -2.18]);
    assert(h2 && h2.obj.name === 'clock', 'pick at dial -> clock (' + (h2 ? h2.obj.name + ':' + h2.tag : 'none') + ')');
    const sf = RLR.Engine.byName.shelf, ck = RLR.Engine.byName.clock;
    sf.action('b1'); ck.action();
    for (let i = 0; i < 3; i++) { ts += 16.7; const cb = rafCb; rafCb = null; cb(ts); }
  } catch (e) { renderErr = renderErr || String(e && e.stack || e); }
  console.error = realErr;
  assert(!renderErr, 'frames render without errors' + (renderErr ? ' -> ' + renderErr : ''));
}

console.log(fails ? 'CHECKS FAILED: ' + fails : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
