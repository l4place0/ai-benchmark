/* 吊扇 — 吸顶 (0.25, 3.0, 0.15)。本文件独占写 PLR.env.fanLevel（含加减速惯性）。
 * 开关惯性升降速 + 叶轮旋转 + 整机微摆 + 停转轻响。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const { V } = PLR;
  const panOf = (n) => PLR.panOf(PLR.worldPos(n)) || 0;
  let bladesNode, inst = {};

  PLR.addObject({
    id: 'fan',
    label: '吊扇',
    hint: '点击开关',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [0.25, 3.0, 0.15] });
      const m = PLR.mesh(inst.root);

      // 吸顶盘 + 吊杆（3.0→2.76）+ 电机舱（中心 y≈2.72）
      PLR.cyl(m, { p0: [0, 0.004, 0], p1: [0, 0.03, 0], r0: 0.046, r1: 0.03, n: 10, caps: { bottom: true } });
      PLR.cyl(m, { p0: [0, 0.004, 0], p1: [0, -0.236, 0], r0: 0.011, r1: 0.011, n: 8 });
      const motor = PLR.cyl(m, { p0: [0, -0.2425, 0], p1: [0, -0.3175, 0], r0: 0.052, r1: 0.052, n: 12, caps: { both: true } });
      // 舱体环线（附在 12 片侧面，中高一圈；cyl 先推侧面再推端盖 → 侧面为倒数第 14..3 个面）
      const base = m.faces.length - 14;
      for (let i = 0; i < 12; i++) {
        const j = (i + 1) % 12;
        PLR.detail(m.faces[base + i], [
          V.lerp(motor.r0[i], motor.r1[i], 0.5),
          V.lerp(motor.r0[j], motor.r1[j], 0.5),
        ], { w: 0.7, alpha: 0.5 });
      }

      // 4 叶均布（bladesNode 在 y 2.70 → 根局部 -0.30）
      bladesNode = PLR.node(inst.root, { pos: [0, -0.3, 0] });
      for (let i = 0; i < 4; i++) {
        const bn = PLR.node(bladesNode, { rot: [0, (i * Math.PI) / 2, 0] });
        const bm = PLR.mesh(bn);
        // 细长叶片（半径 0.1→0.62，外宽 0.13 内宽 0.07，rotX≈0.1 的微下倾直接烘进顶点）
        const blade = PLR.quad(bm, [
          [0.1, 0, 0.035], [0.62, -0.052, 0.065], [0.62, -0.052, -0.065], [0.1, 0, -0.035],
        ], { doubleSided: true });
        PLR.detail(blade, [[0.1, 0, 0], [0.62, -0.052, 0]], { w: 0.7, alpha: 0.45 });
        // 叶根小连接片
        PLR.box(bm, { pos: [0.075, -0.004, 0], size: [0.05, 0.01, 0.045] });
      }

      inst.target = 0;
      inst.speed = 0;
      inst.moving = false;
      return inst;
    },
    update(dt, t, env) {
      // 惯性逼近目标转速：升 0.3/s，降 0.2/s
      if (inst.speed < inst.target) inst.speed = Math.min(inst.target, inst.speed + 0.3 * dt);
      else inst.speed = Math.max(inst.target, inst.speed - 0.2 * dt);
      bladesNode.rot[1] += inst.speed * 8.5 * dt;
      // 开启时整机极微摆（z 轴 + x 轴相位差）
      inst.root.rot[2] = Math.sin(t * 2.1) * 0.006 * inst.speed;
      inst.root.rot[0] = Math.sin(t * 2.1 + 1.2) * 0.006 * inst.speed;
      // 环境写入 + 循环层
      env.fanLevel = inst.speed;
      const pan = panOf(inst.root);
      PLR.sfx.loopSet('fan', { on: inst.speed > 0.02, gain: inst.speed * 0.9, pan: pan });
      // 关闭惯性缓停，到停轻响一次
      if (inst.moving && inst.target === 0 && inst.speed <= 0.02) {
        inst.moving = false;
        PLR.sfx.play('clack', { gain: 0.35, pan: pan });
      }
      if (inst.speed > 0.02) inst.moving = true;
    },
    onClick() {
      inst.target = inst.target > 0 ? 0 : 1;
      PLR.sfx.play('click', { pan: panOf(inst.root) });
    },
  });
})();
