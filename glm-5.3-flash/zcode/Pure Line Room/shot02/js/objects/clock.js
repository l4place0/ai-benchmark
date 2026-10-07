/* 挂钟 — 后墙 x=0.75，中心 y=2.12（墙面朝 +z）
 * 走真实时间；机械跳秒（弹簧过冲回弹）；点击报时并踢秒针一脚。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let hourN, minN, secN;
  const inst = {};
  const TAU = Math.PI * 2;

  PLR.addObject({
    id: 'clock',
    label: '挂钟',
    hint: '真实时间·点击报时',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [0.75, 2.12, -2.8] });
      const m = PLR.mesh(inst.root);

      // 钟体（圆柱轴沿 z：嵌墙 0.045 / 凸出 0.048）
      PLR.cyl(m, { p0: [0, 0, -0.045], p1: [0, 0, 0.048], r0: 0.17, r1: 0.17, n: 16, caps: { both: true } });
      // 表盘
      const face = PLR.ngon(m, [0, 0, 0.05], 0.155, 18, { plane: 'xy', tint: 'paper' });
      // 12 条径向刻度（12/3/6/9 加长）
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const r0 = i % 3 === 0 ? 0.105 : 0.12;
        const ca = Math.cos(a), sa = Math.sin(a);
        PLR.detail(face, [[ca * r0, sa * r0, 0.051], [ca * 0.143, sa * 0.143, 0.051]], { w: 0.8, alpha: 0.8 });
      }

      // 三根指针（局部 +y 指向 12 点；rot[2] 顺时针为负）
      hourN = PLR.node(inst.root, { pos: [0, 0, 0.054] });
      let hm = PLR.mesh(hourN);
      PLR.quad(hm, [[-0.0065, 0, 0], [0.0065, 0, 0], [0.0065, 0.078, 0], [-0.0065, 0.078, 0]], { tint: 'ink', doubleSided: true });

      minN = PLR.node(inst.root, { pos: [0, 0, 0.058] });
      hm = PLR.mesh(minN);
      PLR.quad(hm, [[-0.0045, 0, 0], [0.0045, 0, 0], [0.0045, 0.125, 0], [-0.0045, 0.125, 0]], { tint: 'ink', doubleSided: true });

      secN = PLR.node(inst.root, { pos: [0, 0, 0.062] });
      hm = PLR.mesh(secN);
      // 秒针（0.145 长 + 0.035 尾杆）与尾配重
      PLR.quad(hm, [[-0.002, -0.035, 0], [0.002, -0.035, 0], [0.002, 0.145, 0], [-0.002, 0.145, 0]], { tint: 'accent', doubleSided: true });
      PLR.ngon(hm, [0, -0.045, 0], 0.011, 10, { plane: 'xy', tint: 'accent', doubleSided: true, noPick: true });

      // 中心轴帽
      PLR.ngon(m, [0, 0, 0.066], 0.008, 10, { plane: 'xy', tint: 'ink', noPick: true, lw: 0.7 });

      inst.sec = { x: 0, v: 0 };
      inst.init = false;
      inst.lastSec = -1;
      return inst;
    },
    update(dt, t, env) {
      if (!env.time) return;
      const d = env.time;
      const h = d.getHours(), mi = d.getMinutes(), s = d.getSeconds();

      hourN.rot[2] = -(((h % 12) + mi / 60) / 12) * TAU;
      minN.rot[2] = -((mi + s / 60) / 60) * TAU;

      // 机械跳秒：弹簧追赶目标角 → 过冲回弹
      const target = -(s / 60) * TAU;
      if (!inst.init) { inst.sec.x = target; inst.sec.v = 0; inst.init = true; }
      secN.rot[2] = PLR.spring(inst.sec, target, { f: 9, z: 0.35 }, dt);

      // 每逢秒变：刷新 tick 循环层（按相机距离衰减）
      if (s !== inst.lastSec) {
        inst.lastSec = s;
        const wp = PLR.worldPos(inst.root);
        const e = PLR.camera.eye;
        const dist = Math.hypot(wp[0] - e[0], wp[1] - e[1], wp[2] - e[2]);
        PLR.sfx.loopSet('tick', { gain: 0.3 * PLR.clamp(2.4 / dist, 0, 1), pan: PLR.panOf(wp) });
      }
    },
    onClick() {
      inst.sec.v += 1.2;   // 秒针被踢一脚，弹簧自然回弹
      PLR.sfx.play('bell', { gain: 0.75, pan: PLR.panOf(PLR.worldPos(inst.root)) });
    },
  });
})();
