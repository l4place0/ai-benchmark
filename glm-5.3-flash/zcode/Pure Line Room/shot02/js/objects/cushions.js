/* 两只抱枕 — 两层互转 45° 薄箱叠合。点击抛物线抛跳到座面随机新位置：
 * 途中绕 y 翻滚、rot[2] 向 -0.5 收敛；落地压扁弹回 + 弹簧残余晃动。
 * 再次点击可打断旧跳跃（tween 记 handle，dead=true），重入安全。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const REST_Y = 0.62;   // 座面上的静止高度

  // 顶面细节：4 角“耳朵”斜缝线（4 段独立折线，避免沿边误连）
  function cornerEars(top) {
    const e = 0.15, c = 0.045, y = 0.045;
    const segs = [
      [[e, y, e - c], [e - c, y, e]],
      [[-e + c, y, e], [-e, y, e - c]],
      [[-e, y, -e + c], [-e + c, y, -e]],
      [[e - c, y, -e], [e, y, -e + c]],
    ];
    for (const s of segs) PLR.detail(top, s, { w: 0.75, alpha: 0.55 });
  }

  function startJump(inst) {
    const root = inst.root;
    // 打断旧动画（跳跃 / 落地压扁 / 残余晃动）
    if (inst.jumpT) inst.jumpT.dead = true;
    if (inst.landT) { inst.landT.dead = true; inst.landT = null; }
    inst.wob = null;
    root.scale[0] = 1; root.scale[1] = 1; root.scale[2] = 1;

    const sx = root.pos[0], sy = root.pos[1], sz = root.pos[2];
    let tx, tz;
    do {
      tx = PLR.rand(-2.85, -2.45);
      tz = PLR.rand(0.95, 2.25);
    } while (Math.hypot(tx - sx, tz - sz) < 0.3);

    const spin = PLR.rand(2, 3.5) * (Math.random() < 0.5 ? -1 : 1);
    const r1_0 = root.rot[1], r2_0 = root.rot[2];
    PLR.sfx.play('pop', { rate: PLR.rand(0.9, 1.15), pan: PLR.panOf(PLR.worldPos(root)) });
    inst.jumpT = PLR.tween({
      dur: 0.75,
      ease: 'linear',
      update(k) {
        root.pos[0] = sx + (tx - sx) * k;
        root.pos[2] = sz + (tz - sz) * k;
        root.pos[1] = sy + (REST_Y - sy) * k + Math.sin(k * Math.PI) * 0.28;
        root.rot[1] = r1_0 + spin * k;
        root.rot[2] = r2_0 + (-0.5 - r2_0) * k;
      },
      done() { inst.jumpT = null; land(inst, r1_0 + spin); },
    });
  }

  function land(inst, r1Land) {
    const root = inst.root;
    root.pos[1] = REST_Y;
    PLR.sfx.play('plop', { rate: PLR.rand(0.9, 1.1), pan: PLR.panOf(PLR.worldPos(root)) });
    // 落地瞬间 squash → outElastic 弹回
    root.scale[1] = 0.8;
    inst.landT = PLR.tween({
      dur: 0.2,
      ease: 'outElastic',
      update(k) { root.scale[1] = 0.8 + 0.2 * k; },
      done() { root.scale[1] = 1; inst.landT = null; },
    });
    // 弹簧残余晃动（update 里推进，见 stepWobble）
    inst.wob = {
      r1: r1Land,
      s1: { x: PLR.rand(-0.1, 0.1), v: PLR.rand(-0.6, 0.6) },
      s2: { x: (Math.random() < 0.5 ? -1 : 1) * PLR.rand(0.12, 0.22), v: PLR.rand(-1.2, 1.2) },
    };
  }

  function stepWobble(inst, dt) {
    if (!inst.wob || inst.jumpT) return;
    const w = inst.wob, root = inst.root;
    const d1 = PLR.spring(w.s1, 0, { f: 7, z: 0.4 }, dt);
    const d2 = PLR.spring(w.s2, 0, { f: 8, z: 0.3 }, dt);
    root.rot[1] = w.r1 + d1;
    root.rot[2] = -0.5 + d2;
    if (Math.abs(d1) < 0.003 && Math.abs(d2) < 0.003 && Math.abs(w.s1.v) + Math.abs(w.s2.v) < 0.05) {
      root.rot[1] = w.r1;
      root.rot[2] = -0.5;
      inst.wob = null;
    }
  }

  function makeDef(id, pos, rot, hatched) {
    let inst = null;
    return {
      id,
      label: '抱枕',
      hint: '点击抛一下',
      build() {
        inst = { jumpT: null, landT: null, wob: null };
        inst.root = PLR.node(PLR.root, { pos: pos.slice(), rot: rot.slice() });
        const m = PLR.mesh(inst.root);
        // 第一层薄箱
        const b1 = PLR.box(m, { pos: [0, 0, 0], size: [0.3, 0.09, 0.3] });
        cornerEars(b1.top);
        PLR.detail(b1.top,
          [[0.035, 0.045, 0.035], [0.035, 0.045, -0.035], [-0.035, 0.045, -0.035], [-0.035, 0.045, 0.035]],
          { w: 0.7, alpha: 0.5, closed: true });
        if (hatched) b1.top.hatch = { dir: 'a', count: 4, alpha: 0.25 };
        // 第二层：同尺寸薄箱绕 y 转 45° 叠合
        const n2 = PLR.node(inst.root, { rot: [0, Math.PI / 4, 0] });
        const b2 = PLR.box(PLR.mesh(n2), { pos: [0, 0, 0], size: [0.3, 0.09, 0.3] });
        cornerEars(b2.top);
        return inst;
      },
      update(dt) { if (inst) stepWobble(inst, dt); },
      onClick() { if (inst) startJump(inst); },
    };
  }

  PLR.addObject(makeDef('cushionA', [-2.62, 0.62, 1.0], [0, 0.55, -0.62], true));
  PLR.addObject(makeDef('cushionB', [-2.58, 0.62, 2.15], [0, -0.35, -0.55], false));
})();
