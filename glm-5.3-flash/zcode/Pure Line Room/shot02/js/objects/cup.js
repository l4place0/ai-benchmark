/* 茶杯与热气 — 点击切换蒸汽开/关 + 杯体 Q 弹；蒸汽为 overlay 自绘持续动态。
 * 台面右侧 (2.18, 0.75, -2.25)，杯口世界 y≈0.846，蒸汽从 (2.18, 0.85, -2.25) 升起。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const BASE = [2.18, 0.85, -2.25];   // 蒸汽基准点（杯口）
  const RISE = 0.28;                  // 上升高度
  let root;
  const inst = { steam: true, steamK: 1, t: 0 };

  PLR.addObject({
    id: 'cup',
    label: '茶杯',
    hint: '点击 · 热气 开/关',
    build() {
      root = PLR.node(PLR.root, { pos: [2.18, 0.75, -2.25] });
      inst.root = root;
      const m = PLR.mesh(root);

      // 杯体（上宽下窄）+ 底
      PLR.cyl(m, { p0: [0, 0, 0], p1: [0, 0.088, 0], r0: 0.036, r1: 0.042, n: 10, caps: { bottom: true } });
      // 口沿（薄圈）
      PLR.cyl(m, { p0: [0, 0.088, 0], p1: [0, 0.096, 0], r0: 0.0435, r1: 0.0425, n: 10 });
      // 茶水面（水平盘，暖色微透）
      PLR.ngon(m, [0, 0.076, 0], 0.034, 12, { plane: 'xz', tint: 'glow', alpha: 0.6, doubleSided: true, noPick: true });

      // 杯柄：三段小面拼 C 形（局部 x-y 面，开口朝杯壁，整体转向右前）
      const hn = PLR.node(root, { rot: [0, 0.85, 0] });
      const hm = PLR.mesh(hn);
      const CX = 0.041, CY = 0.048, RO = 0.038, RI = 0.024;
      const segs = [[-Math.PI / 2, -Math.PI / 6], [-Math.PI / 6, Math.PI / 6], [Math.PI / 6, Math.PI / 2]];
      for (const [a0, a1] of segs) {
        PLR.quad(hm, [
          [CX + RO * Math.cos(a0), CY + RO * Math.sin(a0), 0],
          [CX + RO * Math.cos(a1), CY + RO * Math.sin(a1), 0],
          [CX + RI * Math.cos(a1), CY + RI * Math.sin(a1), 0],
          [CX + RI * Math.cos(a0), CY + RI * Math.sin(a0), 0],
        ], { doubleSided: true });
      }

      // 蒸汽自绘覆盖层（fn(dt, o)，o.project 把世界坐标投到屏幕）
      PLR.overlay(function (dt, o) { drawSteam(o); });
      return inst;
    },
    update(dt) {
      inst.t += dt;
      // 蒸汽淡入淡出
      inst.steamK += ((inst.steam ? 1 : 0) - inst.steamK) * Math.min(1, dt * 3.2);
    },
    onClick() {
      inst.steam = !inst.steam;
      PLR.sfx.play('clink', { pan: PLR.panOf(PLR.worldPos(root)) });
      // 杯体 squash：向桌面压扁后弹性回弹
      root.scale[1] = 0.92;
      PLR.tween({ dur: 0.6, ease: 'outElastic', update(k) { root.scale[1] = 0.92 + 0.08 * k; } });
    },
  });

  // 3 条粒子流，每条 6 个段点（相位循环上升），漂移 + 风（+x）
  function drawSteam(o) {
    if (inst.steamK < 0.02) return;
    const t = inst.t, breeze = PLR.env.breeze;
    const ctx = o.ctx;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = o.theme.ink;
    const N = 6;
    for (let s = 0; s < 3; s++) {
      const phase = s * 2.09, dz = (s - 1) * 0.02;
      let prev = null;
      for (let k = 0; k < N; k++) {
        const c = (k / (N - 1) + t * 0.11 + s * 0.37) % 1;
        const y = c * RISE, u = y / RISE;
        const wx = BASE[0] + Math.sin(y * 16 + t * 2.2 + phase) * 0.01 * u + breeze * 0.06 * u;
        const wy = BASE[1] + y;
        const wz = BASE[2] + dz * (1 - 0.35 * u) + Math.sin(y * 11 + t * 1.6 + phase * 1.7) * 0.004 * u;
        const sp = o.project([wx, wy, wz]);
        if (prev && Math.abs(y - prev.cy) < RISE * 0.5) {
          // 相位回绕处不连线；alpha 随高度衰减
          ctx.globalAlpha = Math.min(0.75, ((1 - u) * 0.55 + (1 - prev.u) * 0.55) * 0.6 * inst.steamK);
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(sp[0], sp[1]);
          ctx.stroke();
        }
        prev = { sx: sp[0], sy: sp[1], cy: y, u };
      }
    }
    ctx.globalAlpha = 1;
  }
})();
