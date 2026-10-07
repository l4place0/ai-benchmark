/* 木门 — 示范物件 1：铰链动画 + 门框 + 吱呀声
 * 位于右墙门洞（x=3.2, z -1.95..-1.03），铰链在后缘 z=-1.95，向房间内开。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let hinge, inst = {};

  PLR.addObject({
    id: 'door',
    label: '木门',
    hint: '点击开合',
    build() {
      // 门框（静态，不随门转动）
      const fn = PLR.node(PLR.root, { pos: [3.2, 0, -1.95] });
      const fm = PLR.mesh(fn);
      // 两侧门套 + 顶梁（凸出墙面 0.022）
      PLR.box(fm, { pos: [0, 1.03, -0.02], size: [0.1, 2.1, 0.05] });
      PLR.box(fm, { pos: [0, 1.03, 0.94], size: [0.1, 2.1, 0.05] });
      PLR.box(fm, { pos: [0, 2.07, 0.46], size: [0.1, 0.06, 1.06] });

      // 门扇（铰链节点，rotY 动画）
      hinge = PLR.node(PLR.root, { pos: [3.2, 0, -1.95], rot: [0, 0, 0] });
      const m = PLR.mesh(hinge);
      const slab = PLR.box(m, { pos: [-0.024, 1.025, 0.46], size: [0.048, 2.05, 0.92] });
      // 门板上的拼框线（正反两面）
      PLR.detail(slab.front, [[-0.048, 0.35, 0.1], [-0.048, 1.7, 0.1], [-0.048, 1.7, 0.82], [-0.048, 0.35, 0.82], [-0.048, 0.35, 0.1]], { w: 0.9, alpha: 0.6, closed: true });
      PLR.detail(slab.front, [[-0.048, 0.92, 0.1], [-0.048, 0.92, 0.82]], { w: 0.9, alpha: 0.6 });
      PLR.detail(slab.back, [[0.0, 0.35, 0.1], [0.0, 1.7, 0.1], [0.0, 1.7, 0.82], [0.0, 0.35, 0.82], [0.0, 0.35, 0.1]], { w: 0.9, alpha: 0.6, closed: true });
      PLR.detail(slab.back, [[0.0, 0.92, 0.1], [0.0, 0.92, 0.82]], { w: 0.9, alpha: 0.6 });
      // 把手（远端）
      PLR.box(m, { pos: [-0.07, 1.02, 0.8], size: [0.05, 0.03, 0.14] });
      PLR.ngon(m, [-0.096, 1.02, 0.8], 0.028, 10, { plane: 'yz', tint: 'ink' });
      // 铰链小片
      PLR.box(m, { pos: [-0.02, 0.35, 0.02], size: [0.06, 0.09, 0.016], opts: { noPick: true, lw: 0.8 } });
      PLR.box(m, { pos: [-0.02, 1.7, 0.02], size: [0.06, 0.09, 0.016], opts: { noPick: true, lw: 0.8 } });

      inst.angle = 0;       // 当前开门角（负值=向房间内开）
      inst.open = false;
      inst.root = hinge;    // 拾取根（门框为静态饰边，不参与拾取）
      return inst;
    },
    update(dt, t) {
      hinge.rot[1] = inst.angle;
      // 微微的呼吸感：静止时门有极轻的悬浮角
    },
    onClick() {
      inst.open = !inst.open;
      const from = inst.angle;
      const to = inst.open ? -1.86 : 0;
      PLR.sfx.play('creak', { rate: inst.open ? 1 : 0.82, pan: PLR.panOf(PLR.worldPos(hinge)) });
      PLR.tween({
        dur: inst.open ? 1.15 : 0.85,
        ease: inst.open ? 'outBack' : 'inOutCubic',
        update(k) { inst.angle = from + (to - from) * k; },
        done() {
          if (!inst.open) PLR.sfx.play('latch', { pan: PLR.panOf(PLR.worldPos(hinge)) });
          else PLR.sfx.play('thunk', { gain: 0.4, pan: PLR.panOf(PLR.worldPos(hinge)) });
        },
      });
    },
  });
})();
