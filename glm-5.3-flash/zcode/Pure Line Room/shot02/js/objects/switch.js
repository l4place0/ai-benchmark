/* 墙面电灯开关 — 全局昼夜总开关（唯一允许调用 PLR.toggleEnv 的物件）
 * 右墙 x=3.2（墙面朝 -x），z=-0.72，中心高 y=1.15。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let lever;
  const inst = {};

  PLR.addObject({
    id: 'switch',
    label: '电灯开关',
    hint: '点击切换 昼/夜',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [3.2, 1.15, -0.72] });
      const m = PLR.mesh(inst.root);

      // 底板（厚 0.02 凸出墙面，面板 0.09 宽 × 0.13 高）
      const plate = PLR.box(m, { pos: [-0.012, 0, 0], size: [0.02, 0.13, 0.09] });
      // 面板内框线
      PLR.detail(plate.left, [
        [-0.022, -0.05, -0.031], [-0.022, -0.05, 0.031],
        [-0.022, 0.05, 0.031], [-0.022, 0.05, -0.031],
      ], { w: 0.7, alpha: 0.4, closed: true });
      // 上下小螺丝
      PLR.ngon(m, [-0.023, 0.049, 0], 0.005, 8, { plane: 'yz', tint: 'ink', doubleSided: true, noPick: true, lw: 0.7 });
      PLR.ngon(m, [-0.023, -0.049, 0], 0.005, 8, { plane: 'yz', tint: 'ink', doubleSided: true, noPick: true, lw: 0.7 });

      // 拨杆（绕 x 轴拨动：夜 +0.5 / 昼 -0.5，铰点在板面）
      lever = PLR.node(inst.root, { pos: [-0.022, 0, 0] });
      const lm = PLR.mesh(lever);
      PLR.box(lm, { pos: [-0.011, 0, 0], size: [0.022, 0.05, 0.014], opts: { tint: 'ink' } });

      lever.rot[0] = -0.5;   // 初始为昼
      return inst;
    },
    onClick() {
      PLR.toggleEnv();       // 内部已播 'clack'，这里不重复出声
      const to = PLR.env.mode === 'night' ? 0.5 : -0.5;
      const from = lever.rot[0];
      PLR.tween({
        dur: 0.4, ease: 'outBack',
        update(k) { lever.rot[0] = from + (to - from) * k; },
      });
    },
  });
})();
