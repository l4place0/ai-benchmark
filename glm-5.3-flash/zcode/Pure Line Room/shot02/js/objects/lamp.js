/* 台灯 — 示范物件 2：开关 + 灯泡发光 + 环境暖光耦合
 * 放在书桌台面左侧（书桌由 desk.js 提供，台面 y=0.75）。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let headNode, bulbNode, inst = {};

  PLR.addObject({
    id: 'lamp',
    label: '台灯',
    hint: '点击开关',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [1.1, 0.75, -2.32] });
      const m = PLR.mesh(inst.root);

      // 底座与立杆（bias：底座在大台面上方，保证后台面绘制）
      PLR.cyl(m, { p0: [0, 0, 0], p1: [0, 0.025, 0], r0: 0.1, r1: 0.11, n: 14, caps: { both: true }, sideOpts: { bias: -0.06 }, capOpts: { bias: -0.06 } });
      PLR.cyl(m, { p0: [0, 0.02, 0], p1: [0, 0.34, 0], r0: 0.012, r1: 0.01, n: 8 });
      PLR.detail(m.faces[m.faces.length - 1], [[0, 0.05, 0], [0, 0.33, 0]], { w: 0.6, alpha: 0.4 });

      // 灯头组（rotX 翻转朝下，点击时轻晃）
      headNode = PLR.node(inst.root, { pos: [0, 0.34, 0], rot: [2.42, 0, -0.28] });
      const hm = PLR.mesh(headNode);
      // 灯罩（圆台）
      PLR.cyl(hm, { p0: [0, 0, 0], p1: [0, 0.16, 0], r0: 0.028, r1: 0.085, n: 12 });
      // 灯罩口发光盘
      bulbNode = PLR.node(headNode, { pos: [0, 0.155, 0] });
      const bm = PLR.mesh(bulbNode);
      PLR.ngon(bm, [0, 0, 0], 0.078, 12, { plane: 'xy', tint: 'glow', alpha: 0.85, doubleSided: true, noPick: true });
      PLR.ngon(bm, [0, 0, 0], 0.026, 8, { plane: 'xy', tint: 'ink', doubleSided: true, noPick: true, lw: 0.7 });

      inst.on = false;
      return inst;
    },
    update() {
      PLR.env.lampOn = inst.on;
      if (bulbNode) PLR.env.lampPos = PLR.worldPos(bulbNode);
    },
    onClick() {
      inst.on = !inst.on;
      PLR.sfx.play('click', { pan: PLR.panOf(PLR.worldPos(inst.root)) });
      // 灯头轻晃一下
      const base = 2.42;
      PLR.tween({
        dur: 0.7, ease: 'outElastic',
        update(k) { headNode.rot[0] = base + Math.sin(k * Math.PI * 2) * 0.05 * (1 - k); },
      });
    },
  });
})();
