/* 风铃 — 挂后窗左侧上空 (-2.5, ·, -2.35)，顶盘贴天花 y 2.98。
 * 摆体由 PLR.env.breeze / PLR.env.fanLevel 驱动（主弹簧 f1.6 z0.12，x/z 两组相位差），
 * 音管各自小弹簧（f4.5 z0.18）滞后追随；摆速大时敲响 chime。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const panOf = (n) => PLR.panOf(PLR.worldPos(n)) || 0;
  const MAIN = { f: 1.6, z: 0.12 };
  const TUBE = { f: 4.5, z: 0.18 };
  let swayerNode, inst = {};

  PLR.addObject({
    id: 'chime',
    label: '风铃',
    hint: '点击·听风',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [-2.5, 2.98, -2.35] });
      const m = PLR.mesh(inst.root);

      // 天花小吊座 + 顶盘（双面小圆盘）
      PLR.cyl(m, { p0: [0, 0.022, 0], p1: [0, 0.002, 0], r0: 0.009, r1: 0.009, n: 8 });
      const cap = PLR.ngon(m, [0, 0, 0], 0.045, 12, { plane: 'xz', doubleSided: true });
      // 吊绳（细节线，从顶盘到摆体 y 2.66）
      PLR.detail(cap, [[0, 0, 0], [0, -0.32, 0]], { w: 0.7, alpha: 0.6 });

      // 摆体：小圆木盘
      swayerNode = PLR.node(inst.root, { pos: [0, -0.32, 0] });
      const sm = PLR.mesh(swayerNode);
      PLR.cyl(sm, { p0: [0, -0.006, 0], p1: [0, 0.006, 0], r0: 0.05, r1: 0.05, n: 12, caps: { both: true } });

      // 5 根音管（顶端绕盘缘均布 r 0.038，len 0.16→0.30 由短到长）
      inst.tubes = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const len = 0.16 + i * 0.035;
        const tn = PLR.node(swayerNode, { pos: [Math.cos(a) * 0.038, -0.006, Math.sin(a) * 0.038] });
        const tm = PLR.mesh(tn);
        const tb = PLR.box(tm, { pos: [0, -len / 2, 0], size: [0.016, len, 0.016], opts: { doubleSided: true, lw: 0.8 } });
        // 底端小环线
        PLR.detail(tb.front, [
          [-0.006, -len / 2 + 0.018, 0.0081], [0.006, -len / 2 + 0.018, 0.0081],
          [0.006, -len / 2 + 0.034, 0.0081], [-0.006, -len / 2 + 0.034, 0.0081],
        ], { closed: true, w: 0.6, alpha: 0.5 });
        inst.tubes.push({ node: tn, sx: { x: 0, v: 0 }, sz: { x: 0, v: 0 } });
      }

      inst.ax = { x: 0, v: 0 };
      inst.az = { x: 0, v: 0 };
      inst.lastRing = -1;
      return inst;
    },
    update(dt, t, env) {
      const br = env.breeze || 0;
      const fl = env.fanLevel || 0;
      // 风目标角（x/z 两组，相位差）
      const wx = br * (0.55 + 0.35 * Math.sin(t * 0.7) + 0.25 * Math.sin(t * 1.9 + 1.7)) + fl * 0.3 * Math.sin(t * 1.3);
      const wz = br * (0.55 + 0.35 * Math.sin(t * 0.7 + 1.9) + 0.25 * Math.sin(t * 1.9 + 2.6)) + fl * 0.3 * Math.sin(t * 1.3 + 1.9);
      PLR.spring(inst.ax, wx, MAIN, dt);
      PLR.spring(inst.az, wz, MAIN, dt);
      swayerNode.rot[0] = inst.ax.x;
      swayerNode.rot[2] = inst.az.x;
      // 音管滞后：各管小弹簧追随摆角（tubeNode 是子节点，摆体 rot 自动叠加；
      // 目标取 -0.25× 使总摆角 ≈ 0.75× 摆体并滞后）
      for (const tb of inst.tubes) {
        PLR.spring(tb.sx, inst.ax.x * -0.25, TUBE, dt);
        PLR.spring(tb.sz, inst.az.x * -0.25, TUBE, dt);
        tb.node.rot[0] = tb.sx.x;
        tb.node.rot[2] = tb.sz.x;
      }
      // 摆动角速度够大 → 敲响一根管
      const vel = Math.abs(inst.ax.v) + Math.abs(inst.az.v);
      if (vel > 0.5 && t - inst.lastRing > 0.4) {
        inst.lastRing = t;
        PLR.sfx.play('chime', { rate: PLR.rand(0.85, 1.45), gain: PLR.clamp(vel, 0.3, 1) * 0.7, pan: panOf(inst.root) });
      }
    },
    onClick() {
      inst.az.v += 1.6; // 踢一脚摆体
      const pan = panOf(inst.root);
      PLR.sfx.play('chime', { rate: PLR.rand(0.85, 1.45), gain: 0.7, pan: pan });
      PLR.delay(0.18, () => PLR.sfx.play('chime', { rate: PLR.rand(0.85, 1.45), gain: 0.55, pan: pan }));
    },
  });
})();
