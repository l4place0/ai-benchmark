/* 盆栽 — 右前角 (2.72, 0, 2.3)。6 片叶持续摇曳（随风/吊扇增大），点击爆发摇曳。
 * 叶 = 叶柄细柱 + doubleSided 细长叶面 + 中脉线；叶节点相对盆口 rotY 均布 + rotZ 外倾。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const leaves = [];
  const inst = { burst: 0 };

  PLR.addObject({
    id: 'plant',
    label: '绿植',
    hint: '点击让它摇曳',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [2.72, 0, 2.3] });
      const m = PLR.mesh(inst.root);

      // 盆体 + 盆沿 + 土面
      PLR.cyl(m, { p0: [0, 0, 0], p1: [0, 0.15, 0], r0: 0.082, r1: 0.112, n: 12, caps: { bottom: true } });
      PLR.cyl(m, { p0: [0, 0.15, 0], p1: [0, 0.172, 0], r0: 0.118, r1: 0.118, n: 12 });
      PLR.ngon(m, [0, 0.158, 0], 0.1, 12, { plane: 'xz', tint: 'ink', alpha: 0.28, doubleSided: true, noPick: true });

      // 8 片叶：rotY 均布错落，rotZ 外倾各不同；叶片双段渐弯渐尖
      const tilt = [0.42, 0.62, 0.36, 0.55, 0.7, 0.48, 0.58, 0.4];
      const len = [0.3, 0.27, 0.33, 0.29, 0.26, 0.32, 0.28, 0.31];
      const baseY = [0.165, 0.165, 0.16, 0.165, 0.17, 0.158, 0.15, 0.163];
      for (let i = 0; i < 8; i++) {
        const n = PLR.node(inst.root, { pos: [0, baseY[i], 0], rot: [0, (i * Math.PI) / 4 + 0.22, tilt[i]] });
        const lm = PLR.mesh(n);
        const L = len[i], w = 0.052 + (i % 3) * 0.012;
        // 叶柄
        PLR.cyl(lm, { p0: [0, 0, 0], p1: [0, 0.05, 0], r0: 0.004, r1: 0.003, n: 6, opts: { noPick: true } });
        // 叶面：下段宽、上段外弯收尖（rotZ 正角使叶尖朝 -x，弯向同侧）
        const y0 = 0.045, y1 = y0 + L * 0.52, y2 = y0 + L;
        const s1 = PLR.quad(lm, [
          [-w / 2, y0, 0], [w / 2, y0, 0], [w * 0.34 - 0.018, y1, 0], [-w * 0.34 - 0.018, y1, 0],
        ], { doubleSided: true });
        PLR.quad(lm, [
          [-w * 0.34 - 0.018, y1, 0], [w * 0.34 - 0.018, y1, 0], [0.005 - 0.055, y2, 0], [-0.005 - 0.055, y2, 0],
        ], { doubleSided: true });
        // 中脉（两段）
        PLR.detail(s1, [[0, y0 + 0.01, 0], [-0.018, y1, 0], [-0.055, y2 - 0.01, 0]], { w: 0.7, alpha: 0.38 });
        leaves.push({ n, base: tilt[i], ph: i * 1.3 });
      }

      PLR.shadow(2.72, 2.3, 0.3, 0.3, 0.45);
      return inst;
    },
    update(dt, t, env) {
      inst.burst *= Math.exp(-dt * 2.2);
      const amp = (0.5 + env.breeze * 2.2) * (1 + inst.burst * 3);
      for (let i = 0; i < leaves.length; i++) {
        const lf = leaves[i];
        lf.n.rot[2] = lf.base + Math.sin(t * 1.6 + lf.ph) * 0.035 * amp;
        lf.n.rot[0] = Math.sin(t * 1.25 + lf.ph * 1.7) * 0.02 * amp;
      }
    },
    onClick() {
      inst.burst = 1;
      PLR.sfx.play('rustle', { pan: PLR.panOf(PLR.worldPos(inst.root)) });
    },
  });
})();
