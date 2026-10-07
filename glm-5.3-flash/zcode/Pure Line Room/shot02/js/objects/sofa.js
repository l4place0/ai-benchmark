/* 三人沙发 — 靠左墙（x=-3.2），面向 +x。底箱 + 短腿 + 靠背 + 扶手 + 座垫。
 * 按压：座垫下压；松手：弹性回位；轻点：整体下沉回弹；空置时极微呼吸。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let inst = {};

  PLR.addObject({
    id: 'sofa',
    label: '沙发',
    hint: '按一按',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [-2.64, 0, 1.6] });
      const m = PLR.mesh(inst.root);

      // 底箱 + 前立面踢脚线
      const base = PLR.box(m, { pos: [0, 0.27, 0], size: [0.88, 0.26, 1.7] });
      PLR.detail(base.right, [[0.44, 0.19, -0.83], [0.44, 0.19, 0.83]], { w: 0.8, alpha: 0.5 });

      // 4 短腿
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          PLR.box(m, { pos: [sx * 0.36, 0.07, sz * 0.76], size: [0.06, 0.14, 0.06], opts: { lw: 0.9 } });

      // 靠背板 + 顶部加厚沿 + 竖缝分割线
      const back = PLR.box(m, { pos: [-0.37, 0.64, 0], size: [0.14, 0.48, 1.7] });
      PLR.box(m, { pos: [-0.34, 0.83, 0], size: [0.18, 0.1, 1.7] });
      PLR.detail(back.right, [[-0.3, 0.43, 0], [-0.3, 0.86, 0]], { w: 0.8, alpha: 0.5 });

      // 两侧扶手 + 内侧缝线
      for (const sz of [-1, 1]) {
        const arm = PLR.box(m, { pos: [0, 0.51, sz * 0.74], size: [0.88, 0.22, 0.22] });
        const zi = sz * 0.63; // 内侧面
        PLR.detail(sz > 0 ? arm.back : arm.front,
          [[-0.38, 0.585, zi], [0.38, 0.585, zi]], { w: 0.75, alpha: 0.5 });
      }

      // 2 座垫（独立节点，原点钉在垫底 y=0.4，压扁时底边不悬空）
      inst.seats = [];
      for (const sz of [-1, 1]) {
        const c = PLR.node(inst.root, { pos: [0, 0.4, sz * 0.32] });
        const cm = PLR.mesh(c);
        const box = PLR.box(cm, { pos: [0, 0.065, 0], size: [0.6, 0.13, 0.6] });
        // 前缘倒角线
        PLR.detail(box.right, [[0.3, 0.098, -0.27], [0.3, 0.098, 0.27]], { w: 0.8, alpha: 0.5 });
        inst.seats.push(c);
      }

      // 2 靠垫（rot[2]=+0.13：顶部向 -x 倚向背板）
      for (const sz of [-1, 1]) {
        const bc = PLR.node(inst.root, { pos: [-0.22, 0.75, sz * 0.31], rot: [0, 0, 0.13] });
        PLR.box(PLR.mesh(bc), { pos: [0, 0, 0], size: [0.16, 0.44, 0.58] });
      }

      inst.pressK = 0;      // 按压量 0..1
      inst.pressT = null;
      inst.tapT = null;
      inst.shadow = PLR.shadow(-2.64, 1.6, 1.0, 1.9, 0.55);
      return inst;
    },
    update(dt, t) {
      // 呼吸 × 按压量（互不干扰：tween 只写 pressK，这里合成最终 scale）
      const s = (1 + 0.004 * Math.sin(t * 0.8)) * (1 - 0.16 * inst.pressK);
      for (const c of inst.seats) c.scale[1] = s;
    },
    onPress() {
      if (inst.pressT) inst.pressT.dead = true;
      const from = inst.pressK;
      inst.pressT = PLR.tween({ dur: 0.12, ease: 'outQuad', update(k) { inst.pressK = from + (1 - from) * k; } });
      PLR.sfx.play('squeak', { rate: 1, pan: PLR.panOf(PLR.worldPos(inst.root)) });
    },
    onRelease() {
      if (inst.pressT) inst.pressT.dead = true;
      const from = inst.pressK;
      inst.pressT = PLR.tween({ dur: 0.55, ease: 'outElastic', update(k) { inst.pressK = from * (1 - k); } });
    },
    onClick() {
      if (inst.tapT) inst.tapT.dead = true;
      PLR.sfx.play('squeak', { rate: 1.2, pan: PLR.panOf(PLR.worldPos(inst.root)) });
      inst.tapT = PLR.tween({
        dur: 0.6,
        ease: 'linear',
        update(k) {
          // 前 18% 短促下沉到 0.9，随后 outElastic 回弹
          if (k < 0.18) inst.root.scale[1] = 1 - 0.1 * (k / 0.18);
          else inst.root.scale[1] = 0.9 + 0.1 * PLR.ease.outElastic((k - 0.18) / 0.82);
        },
        done() { inst.root.scale[1] = 1; },
      });
    },
  });
})();
