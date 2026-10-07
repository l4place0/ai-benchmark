/* 书桌椅 — 座面 + 外撇细腿 + 双横枋靠背 + 搭脑板。位于书桌前 (1.5,0,-1.45)，面向 -z。
 * drag:'floor' 可拖动：clamp x[0.6,2.9] z[-2.0,0.6]，落影跟随；
 * 拖动开始一次 slide，落位 thunk。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let inst = {};

  PLR.addObject({
    id: 'chair',
    label: '椅子',
    hint: '按住拖动',
    drag: 'floor',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [1.5, 0, -1.45] });
      const m = PLR.mesh(inst.root);

      // 座面 + 座面下前望板线（椅子前面 = -z，即 box 的 back 面）
      const seat = PLR.box(m, { pos: [0, 0.45, 0], size: [0.42, 0.04, 0.4] });
      PLR.detail(seat.back, [[-0.19, 0.424, -0.201], [0.19, 0.424, -0.201]], { w: 0.8, alpha: 0.5 });

      // 4 条外撇细腿：顶端铰在座面四角，绕顶端外倾 0.05rad
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const n = PLR.node(inst.root, { pos: [sx * 0.18, 0.43, sz * 0.17], rot: [-sz * 0.05, 0, sx * 0.05] });
          PLR.box(PLR.mesh(n), { pos: [0, -0.215, 0], size: [0.03, 0.43, 0.03] });
        }

      // 靠背：两根立柱（座面后角 → y 0.95）
      for (const sx of [-1, 1])
        PLR.box(m, { pos: [sx * 0.18, 0.69, 0.175], size: [0.032, 0.52, 0.032] });
      // 双横枋
      PLR.box(m, { pos: [0, 0.775, 0.175], size: [0.315, 0.05, 0.024] });
      PLR.box(m, { pos: [0, 0.88, 0.175], size: [0.315, 0.04, 0.024] });
      // 顶部搭脑板（略宽略厚）
      PLR.box(m, { pos: [0, 0.925, 0.175], size: [0.37, 0.055, 0.036] });

      inst.dragging = false;
      inst.shadow = PLR.shadow(1.5, -1.45, 0.55, 0.55, 0.45);
      return inst;
    },
    onDragMove(wp) {
      if (!inst.dragging) {
        inst.dragging = true;
        PLR.sfx.play('slide', { rate: 1, pan: PLR.panOf(PLR.worldPos(inst.root)) });
      }
      inst.root.pos[0] = PLR.clamp(wp[0], 0.6, 2.9);
      inst.root.pos[2] = PLR.clamp(wp[2], -2.0, 0.6);
      inst.shadow.x = inst.root.pos[0];
      inst.shadow.z = inst.root.pos[2];
    },
    onDragEnd() {
      if (!inst.dragging) return;
      inst.dragging = false;
      PLR.sfx.play('thunk', { gain: 0.35, pan: PLR.panOf(PLR.worldPos(inst.root)) });
    },
  });
})();
