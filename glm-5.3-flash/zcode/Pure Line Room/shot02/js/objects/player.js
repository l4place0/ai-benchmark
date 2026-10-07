/* 唱片机 — 放在储物柜顶面。柜体高 0.78 + 腿 0.1 → 实际台面 y=0.88，root 取 0.88。
 * 唱盘惯性旋转 + 唱臂摆动落盘 + vinyl 循环层。机身沿 x 放置。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const panOf = (n) => PLR.panOf(PLR.worldPos(n)) || 0;
  let platterNode, armNode, inst = {};

  PLR.addObject({
    id: 'player',
    label: '唱片机',
    hint: '点击播放/停止',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [-0.3, 0.88, 2.58] });
      const m = PLR.mesh(inst.root);

      // 四只小锥脚（0..0.014）+ 底箱（y 0.014..0.099）
      for (const [fx, fz] of [[-0.26, -0.16], [0.26, -0.16], [-0.26, 0.16], [0.26, 0.16]]) {
        PLR.cyl(m, { p0: [fx, 0, fz], p1: [fx, 0.014, fz], r0: 0.016, r1: 0.01, n: 8, caps: { bottom: true } });
      }
      const body = PLR.box(m, { pos: [0, 0.0565, 0], size: [0.62, 0.085, 0.42] });
      // 正面（朝 -z）细节排线 + 2 只小旋钮（轴沿 z）
      PLR.detail(body.back, [[-0.27, 0.035, -0.21], [0.27, 0.035, -0.21]], { w: 0.7, alpha: 0.45 });
      PLR.detail(body.back, [[-0.27, 0.078, -0.21], [0.27, 0.078, -0.21]], { w: 0.7, alpha: 0.45 });
      for (const kx of [-0.2, -0.08]) {
        PLR.cyl(m, { p0: [kx, 0.05, -0.206], p1: [kx, 0.05, -0.232], r0: 0.018, r1: 0.018, n: 10, caps: { top: true } });
      }

      // 唱盘组（随播放旋转）。bias：唱盘悬在大台面上方且中心偏移，
      // 需要负偏置保证在台面之后绘制（画家算法稳定性）
      platterNode = PLR.node(inst.root, { pos: [-0.12, 0.1, 0] });
      const pm = PLR.mesh(platterNode);
      PLR.cyl(pm, { p0: [0, 0, 0], p1: [0, 0.018, 0], r0: 0.148, r1: 0.148, n: 20, caps: { both: true }, sideOpts: { bias: -0.13 }, capOpts: { bias: -0.13 } });
      PLR.ngon(pm, [0, 0.0195, 0], 0.138, 20, { plane: 'xz', tint: 'ink', bias: -0.136 });
      // 3 圈 groove 同心圆（ink 细节线在 ink 填充上不可见 → 用细纸色环面表现）
      for (const gr of [0.06, 0.09, 0.12]) {
        const ring = [], N = 26;
        for (let i = 0; i < N * 2; i++) {
          const a = (i / (N * 2)) * Math.PI * 2;
          const r = i % 2 === 0 ? gr + 0.0022 : gr - 0.0022;
          ring.push([Math.cos(a) * r, 0.0196, Math.sin(a) * r]);
        }
        PLR.polygon(pm, ring, { tint: 'paper', alpha: 0.22, noPick: true, lw: 0.6, bias: -0.138 });
      }
      // 中心标签 + 中孔小点
      PLR.ngon(pm, [0, 0.0205, 0], 0.045, 12, { plane: 'xz', tint: 'paper', bias: -0.142 });
      PLR.ngon(pm, [0, 0.0215, 0], 0.008, 8, { plane: 'xz', tint: 'ink', bias: -0.148 });
      // 主轴
      PLR.cyl(m, { p0: [-0.12, 0.099, 0], p1: [-0.12, 0.118, 0], r0: 0.004, r1: 0.004, n: 6 });

      // 唱臂（基座坐在台面 0.099 上；臂管指向唱盘，rest 搁在臂架上）
      armNode = PLR.node(inst.root, { pos: [0.17, 0.114, -0.1], rot: [0, -0.45, 0] });
      const am = PLR.mesh(armNode);
      PLR.cyl(am, { p0: [0, -0.015, 0], p1: [0, 0.015, 0], r0: 0.024, r1: 0.024, n: 10, caps: { top: true } });
      PLR.cyl(am, { p0: [-0.01, 0.026, 0], p1: [-0.21, 0.026, 0], r0: 0.0055, r1: 0.0055, n: 6 });
      PLR.box(am, { pos: [-0.225, 0.028, 0], size: [0.045, 0.026, 0.026] });
      PLR.cyl(am, { p0: [0.028, 0.026, 0], p1: [0.058, 0.026, 0], r0: 0.012, r1: 0.012, n: 8 });
      // 臂架小柱（rest 位支柱）
      PLR.cyl(m, { p0: [-0.032, 0.099, -0.198], p1: [-0.032, 0.127, -0.198], r0: 0.009, r1: 0.009, n: 8 });

      inst.playing = false;
      inst.spin = 0;
      inst.tw = null;
      return inst;
    },
    update(dt, t) {
      // 唱盘惯性：播放时以 1.2/s 逼近 3.4，停止后以 0.8/s 衰减
      const target = inst.playing ? 3.4 : 0;
      const rate = inst.playing ? 1.2 : 0.8;
      if (inst.spin < target) inst.spin = Math.min(target, inst.spin + rate * dt);
      else inst.spin = Math.max(target, inst.spin - rate * dt);
      platterNode.rot[1] += inst.spin * dt;
      // 播放中唱臂极微颤
      armNode.rot[2] = inst.playing ? Math.sin(t * 9) * 0.002 : 0;
    },
    onClick() {
      const pan = panOf(inst.root);
      PLR.sfx.play('click', { pan: pan });
      inst.playing = !inst.playing;
      if (inst.tw) inst.tw.dead = true;
      if (!inst.playing) PLR.sfx.loopSet('vinyl', { on: false, gain: 0, pan: pan });
      const from = armNode.rot[1];
      const to = inst.playing ? -0.12 : -0.45;
      inst.tw = PLR.tween({
        dur: 0.9, ease: 'inOutCubic',
        update(k) { armNode.rot[1] = from + (to - from) * k; },
        done() { if (inst.playing) PLR.sfx.loopSet('vinyl', { on: true, gain: 1, pan: pan }); },
      });
    },
  });
})();
