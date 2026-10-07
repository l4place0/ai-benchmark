/* 书桌 — 台面/腿板/背梁/抽屉柜体 + 装饰（小书堆、纸页）；抽屉为独立可点击定义。
 * 靠后墙 z=-2.8：台面 y=0.75，x 0.85..2.35，z -2.75..-2.05。台灯位 (1.1,0.75,-2.32) 留空。 */
(function () {
  'use strict';
  const PLR = window.PLR;

  /* ---------- 书桌本体（家具，可悬停拾取） ---------- */
  PLR.addObject({
    id: 'desk',
    label: '书桌',
    build() {
      const root = PLR.node(PLR.root, {});
      const m = PLR.mesh(root);

      // 台面（顶面八角收边线 = 边缘斜切）
      const top = PLR.box(m, { pos: [1.6, 0.735, -2.4], size: [1.5, 0.03, 0.7] });
      PLR.detail(top.top, [
        [0.87, 0.7505, -2.70], [0.90, 0.7505, -2.73], [2.30, 0.7505, -2.73], [2.33, 0.7505, -2.70],
        [2.33, 0.7505, -2.10], [2.30, 0.7505, -2.07], [0.90, 0.7505, -2.07], [0.87, 0.7505, -2.10],
      ], { w: 0.8, alpha: 0.45, closed: true });

      // 两侧腿板 + 背横梁
      PLR.box(m, { pos: [0.92, 0.36, -2.4], size: [0.045, 0.72, 0.62] });
      PLR.box(m, { pos: [2.28, 0.36, -2.4], size: [0.045, 0.72, 0.62] });
      PLR.box(m, { pos: [1.6, 0.62, -2.69], size: [1.32, 0.1, 0.025] });

      // 抽屉柜体（开口 x 1.72..2.26 / y 0.495..0.68；右壁即右腿板）
      PLR.box(m, { pos: [1.7125, 0.59, -2.38], size: [0.015, 0.25, 0.6] });   // 左内壁
      PLR.box(m, { pos: [2.0, 0.465, -2.38], size: [0.56, 0.02, 0.6] });      // 底板
      PLR.box(m, { pos: [2.0, 0.59, -2.6725], size: [0.56, 0.25, 0.015] });   // 背板
      PLR.box(m, { pos: [2.0, 0.7, -2.0575], size: [0.56, 0.04, 0.015] });    // 开口上沿
      PLR.box(m, { pos: [2.0, 0.485, -2.0575], size: [0.56, 0.02, 0.015] });  // 开口下沿

      // 装饰：一小叠书（2 本 + 书脊线）
      const b1 = PLR.box(m, { pos: [1.62, 0.7675, -2.62], size: [0.2, 0.035, 0.15], opts: { noPick: true } });
      PLR.detail(b1.front, [[1.53, 0.776, -2.5445], [1.71, 0.776, -2.5445]], { w: 0.7, alpha: 0.4 });
      PLR.detail(b1.front, [[1.53, 0.759, -2.5445], [1.71, 0.759, -2.5445]], { w: 0.7, alpha: 0.28 });
      const b2n = PLR.node(root, { pos: [1.63, 0.8025, -2.61], rot: [0, 0.18, 0] });
      const b2 = PLR.box(PLR.mesh(b2n), { pos: [0, 0, 0], size: [0.17, 0.028, 0.125], opts: { noPick: true } });
      PLR.detail(b2.front, [[-0.075, 0.005, 0.062], [0.075, 0.005, 0.062]], { w: 0.7, alpha: 0.4 });

      // 装饰：一张微转角的纸 + 字迹线
      const pn = PLR.node(root, { pos: [1.42, 0.7515, -2.24], rot: [0, 0.12, 0] });
      const paper = PLR.quad(PLR.mesh(pn), [
        [-0.105, 0, 0.1485], [0.105, 0, 0.1485], [0.105, 0, -0.1485], [-0.105, 0, -0.1485],
      ], { doubleSided: true, noPick: true });
      for (let i = 0; i < 5; i++) {
        const z = 0.1 - i * 0.052;
        PLR.detail(paper, [[-0.075, 0.001, z], [i === 4 ? 0.03 : 0.075, 0.001, z]], { w: 0.7, alpha: 0.35 });
      }

      PLR.shadow(1.6, -2.38, 1.6, 0.8, 0.5);
      return { root };
    },
  });

  /* ---------- 抽屉（可点击开合） ---------- */
  let dRoot, dOpen = false;
  const dInst = { z: 0 };
  PLR.addObject({
    id: 'drawer',
    label: '抽屉',
    hint: '点击开合',
    build() {
      dRoot = PLR.node(PLR.root, { pos: [2.0, 0.59, -2.06] });
      dInst.root = dRoot;
      const m = PLR.mesh(dRoot);
      // 前面板（淡木纹排线）+ 拉手横条
      PLR.box(m, { pos: [0, 0, 0], size: [0.5, 0.17, 0.028], opts: { hatch: { dir: 'a', count: 3, alpha: 0.22 } } });
      PLR.box(m, { pos: [0, 0, 0.017], size: [0.16, 0.02, 0.015] });
      // 内盒：侧板/背板/底板（打开可见，不参与拾取）
      PLR.box(m, { pos: [-0.225, -0.01, -0.23], size: [0.012, 0.12, 0.44], opts: { noPick: true } });
      PLR.box(m, { pos: [0.225, -0.01, -0.23], size: [0.012, 0.12, 0.44], opts: { noPick: true } });
      PLR.box(m, { pos: [0, -0.01, -0.455], size: [0.45, 0.12, 0.012], opts: { noPick: true } });
      PLR.box(m, { pos: [0, -0.075, -0.23], size: [0.45, 0.01, 0.46], opts: { noPick: true } });
      return dInst;
    },
    onClick() {
      dOpen = !dOpen;
      const from = dInst.z, to = dOpen ? 0.3 : 0;
      PLR.sfx.play('slide', { rate: dOpen ? 1 : 0.9, pan: PLR.panOf(PLR.worldPos(dRoot)) });
      PLR.tween({
        dur: 0.55, ease: 'inOutCubic',
        update(k) {
          dInst.z = from + (to - from) * k;
          dRoot.pos[2] = -2.06 + dInst.z;
        },
        done() {
          PLR.sfx.play(dOpen ? 'slideStop' : 'latch', { pan: PLR.panOf(PLR.worldPos(dRoot)) });
        },
      });
    },
  });
})();
