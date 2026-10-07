/* 茶几 — 面板 + 斜削腿 + 置物板 + 围板一圈，台面小书与圆托盘。
 * drag:'floor' 可拖动：clamp x[-2.3,0.5] z[0.35,2.5]，落影跟随；
 * 拖动开始一次 slide，落位 thunk + 轻微 rot[2] 衰减摆动。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let inst = {};

  PLR.addObject({
    id: 'coffeetable',
    label: '茶几',
    hint: '按住拖动',
    drag: 'floor',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [-1.45, 0, 1.5] });
      const m = PLR.mesh(inst.root);

      // 面板（顶面 y 0.44）
      PLR.box(m, { pos: [0, 0.4225, 0], size: [0.5, 0.035, 0.95] });

      // 围板一圈（面板下沿）
      PLR.box(m, { pos: [0.225, 0.378, 0], size: [0.03, 0.05, 0.9] });
      PLR.box(m, { pos: [-0.225, 0.378, 0], size: [0.03, 0.05, 0.9] });
      PLR.box(m, { pos: [0, 0.378, 0.435], size: [0.42, 0.05, 0.03] });
      PLR.box(m, { pos: [0, 0.378, -0.435], size: [0.42, 0.05, 0.03] });

      // 4 条斜削腿（顶端外倾 ~0.05rad，六棱收分）
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          PLR.cyl(m, {
            p0: [sx * 0.168, 0, sz * 0.378],
            p1: [sx * 0.19, 0.405, sz * 0.4],
            r0: 0.02, r1: 0.016, n: 6,
            caps: { bottom: true },
          });

      // 下层置物板
      PLR.box(m, { pos: [0, 0.15, 0], size: [0.3, 0.018, 0.74] });

      // 台面装饰：两本叠放小书（noPick + 书脊线）
      const bk1 = PLR.node(inst.root, { pos: [0.13, 0.4525, -0.28], rot: [0, 0.28, 0] });
      const b1 = PLR.box(PLR.mesh(bk1), { pos: [0, 0, 0], size: [0.17, 0.025, 0.23], opts: { noPick: true, lw: 0.85 } });
      PLR.detail(b1.right, [[0.085, -0.009, -0.095], [0.085, 0.009, -0.095]], { w: 0.7, alpha: 0.55 });
      PLR.detail(b1.right, [[0.085, 0, -0.06], [0.085, 0, -0.01]], { w: 0.7, alpha: 0.4 });
      const bk2 = PLR.node(inst.root, { pos: [0.115, 0.475, -0.26], rot: [0, -0.35, 0] });
      const b2 = PLR.box(PLR.mesh(bk2), { pos: [0, 0, 0], size: [0.14, 0.02, 0.19], opts: { noPick: true, lw: 0.85 } });
      PLR.detail(b2.right, [[0.07, -0.007, -0.075], [0.07, 0.007, -0.075]], { w: 0.7, alpha: 0.55 });

      // 圆形小托盘（ngon 朝上）+ 内圈线
      const tray = PLR.ngon(m, [-0.1, 0.441, 0.2], 0.115, 14, { plane: 'xz', tint: 'paper' });
      const ring = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ring.push([-0.1 + Math.cos(a) * 0.085, 0.4415, 0.2 + Math.sin(a) * 0.085]);
      }
      PLR.detail(tray, ring, { w: 0.7, alpha: 0.5, closed: true });

      inst.dragging = false;
      inst.wobT = null;
      inst.shadow = PLR.shadow(-1.45, 1.5, 0.7, 1.1, 0.45);
      return inst;
    },
    onDragMove(wp) {
      if (!inst.dragging) {
        inst.dragging = true;
        PLR.sfx.play('slide', { rate: 1, pan: PLR.panOf(PLR.worldPos(inst.root)) });
      }
      inst.root.pos[0] = PLR.clamp(wp[0], -2.3, 0.5);
      inst.root.pos[2] = PLR.clamp(wp[2], 0.35, 2.5);
      inst.shadow.x = inst.root.pos[0];
      inst.shadow.z = inst.root.pos[2];
    },
    onDragEnd() {
      if (!inst.dragging) return;
      inst.dragging = false;
      PLR.sfx.play('thunk', { gain: 0.45, pan: PLR.panOf(PLR.worldPos(inst.root)) });
      // 轻微 rot[2] 衰减正弦摆动（幅度 0.02）
      if (inst.wobT) inst.wobT.dead = true;
      inst.wobT = PLR.tween({
        dur: 0.7,
        ease: 'linear',
        update(k) { inst.root.rot[2] = Math.sin(k * Math.PI * 3) * 0.02 * (1 - k); },
        done() { inst.root.rot[2] = 0; inst.wobT = null; },
      });
    },
  });
})();
