/* 线之屋 · 装配与入口 */
(function () {
  window.__ERR = [];
  window.addEventListener('error', e => window.__ERR.push(String(e.message) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => window.__ERR.push('promise: ' + e.reason));

  const E = RLR.E;
  const canvas = document.getElementById('cv');
  RLR.Engine.init(canvas);
  RLR.Engine.add(RLR.createBackdrop());
  RLR.Engine.add(RLR.createRoom());

  const added = [];
  function add(fn, opts) {
    try {
      if (typeof RLR[fn] === 'function') {
        const o = RLR[fn](opts || {});
        RLR.Engine.add(o);
        added.push(o.name);
        return o;
      }
    } catch (err) { window.__ERR.push(fn + ': ' + err.message); }
    return null;
  }
  /* 墙面/天花板上的装饰物整体提前绘制（贴附面是大面，平均深度会把它们盖住） */
  function bump(o, v) {
    if (!o) return;
    for (const f of o.faces) f.zBias = Math.max(f.zBias || 0, v);
    for (const s of o.strokes) s.zBias = Math.max(s.zBias || 0, v);
    for (const t of o.texts) t.zBias = Math.max(t.zBias || 0, v);
  }

  const oDoor = add('createDoor', { pivot: [-2.58, 0, 1.47] });
  const oCurtains = add('createCurtains', {});
  const oFan = add('createFan', { pivot: [0, 3.02, 0.35] });
  const oChime = add('createChime', { pivot: [2.05, 3.02, -1.90] });
  const oSwitch = add('createSwitch', { pivot: [-2.585, 1.16, 0.30] });
  const oArtA = add('createArtA', { pivot: [-1.78, 2.02, -2.185] });
  const oArtB = add('createArtB', { pivot: [2.585, 1.78, -0.80] });
  add('createDesk', { pivot: [-1.78, 0, -1.82] });
  add('createChair', { pivot: [-1.70, 0, -1.18] });
  add('createLamp', { pivot: [-2.32, 0.76, -1.86] });
  add('createCup', { pivot: [-1.55, 0.76, -1.78] });
  add('createGlobe', { pivot: [-1.16, 0.76, -1.80] });
  add('createPlant', { pivot: [1.52, 0.95, -2.16] });
  add('createShelf', { pivot: [-2.50, 0, -1.30] });
  const oClock = add('createClock', { pivot: [-0.42, 2.32, -2.185] });
  add('createSideboard', { pivot: [2.44, 0, -0.80] });
  add('createPlayer', { pivot: [2.46, 0.78, -0.80] });
  add('createSofa', { pivot: [2.18, 0, 0.95] });
  add('createTable', { pivot: [1.45, 0, 0.95] });
  add('createRug', { pivot: [1.35, 0, 0.75] });
  bump(oFan, 0.45); bump(oChime, 0.45); bump(oSwitch, 0.45); bump(oArtB, 0.45); bump(oArtA, 0.2); bump(oClock, 0.2); bump(oCurtains, 0.3);

  /* 开场 */
  const ov = document.getElementById('intro');
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    RLR.Audio.init();
    ov.classList.add('hide');
    RLR.Engine.cam.rate = 1.15;
    RLR.Engine.delay(() => { RLR.Engine.cam.rate = 6.5; }, 3.0);
    RLR.Engine.delay(() => RLR.Engine.toast('拖动旋转 · 滚轮缩放 · 点击物件互动 · 按 H 显示可互动之物'), 3.1);
  }
  ov.addEventListener('click', enter);
  window.addEventListener('keydown', e => { if (!entered && (e.key === 'Enter' || e.key === ' ')) enter(); });

  window.RLR_DEBUG = {
    Engine: RLR.Engine, added,
    interactives: () => RLR.Engine.scene.filter(o => o.interactive !== false).map(o => o.name),
    step(n, dt) { for (let i = 0; i < (n || 1); i++) RLR.Engine.tick(dt || 1 / 60); }
  };
})();
