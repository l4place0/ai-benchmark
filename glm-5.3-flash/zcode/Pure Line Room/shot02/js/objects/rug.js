/* 地毯 — 圆角矩形薄片（y 0.012，法线 +y，双面）。双勾边框 detail；
 * 点击循环三组排线花纹（横线族 / 纵线族 / 45° 斜线族）：
 * 直接替换 face.hatchLines（局部空间 [p0,p1] 线段数组），切换时尺寸脉冲。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const HX = 1.05, HZ = 0.75, R = 0.2;  // 半长宽与圆角半径
  const IN = 0.13;                       // 花纹区内缩
  let inst = {};

  // 圆角矩形点列：先按 (x,z) 数学逆时针生成再反转 → 从上看逆时针（法线 +y），
  // 另传 forceN 兜底校正绕向。每角 3 点，共 12 边。
  function roundedRect(hx, hz, r) {
    const pts = [];
    const corners = [
      [hx - r, hz - r, 0],
      [-hx + r, hz - r, Math.PI * 0.5],
      [-hx + r, -hz + r, Math.PI],
      [hx - r, -hz + r, Math.PI * 1.5],
    ];
    for (const [cx, cz, a0] of corners)
      for (let i = 0; i <= 2; i++) {
        const a = a0 + (i / 2) * Math.PI * 0.5;
        pts.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r]);
      }
    pts.reverse();
    return pts;
  }

  // 圆角矩形在给定 |v|（垂直坐标）处的半宽（水平坐标幅度）
  function extentAt(v, half, r) {
    const lim = half - r;
    if (Math.abs(v) <= lim) return half;
    const d = r * r - (Math.abs(v) - lim) * (Math.abs(v) - lim);
    return lim + (d > 0 ? Math.sqrt(d) : 0);
  }

  // 点是否在内缩圆角矩形内（用于斜线族裁剪）
  function insideRounded(x, z, hx, hz, r) {
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax > hx || az > hz) return false;
    const dx = ax - (hx - r), dz = az - (hz - r);
    if (dx <= 0 || dz <= 0) return true;
    return dx * dx + dz * dz <= r * r;
  }

  // 方案 a：横线族（沿 x，gap≈0.08，端头随圆角收短）
  function patternA() {
    const hx = HX - IN, hz = HZ - IN, r = Math.max(0.02, R - IN);
    const lines = [];
    for (let z = -hz + 0.03; z <= hz - 0.02; z += 0.08) {
      const ext = extentAt(z, hx, r) - 0.025;
      if (ext <= 0.05) continue;
      lines.push([[-ext, 0, z], [ext, 0, z]]);
    }
    return lines;
  }

  // 方案 b：纵线族（沿 z）
  function patternB() {
    const hx = HX - IN, hz = HZ - IN, r = Math.max(0.02, R - IN);
    const lines = [];
    for (let x = -hx + 0.03; x <= hx - 0.02; x += 0.08) {
      const ext = extentAt(x, hz, r) - 0.025;
      if (ext <= 0.05) continue;
      lines.push([[x, 0, -ext], [x, 0, ext]]);
    }
    return lines;
  }

  // 方案 c：45° 斜线族（直线 x - z = c，垂直间距≈0.08，逐段采样裁进内区）
  function patternC() {
    const hx = HX - IN, hz = HZ - IN, r = Math.max(0.02, R - IN);
    const rt = Math.max(0.01, r - 0.015); // 端头再留一点白边
    const lines = [];
    const emit = (run, c) => lines.push([[run[0], 0, run[0] - c], [run[1], 0, run[1] - c]]);
    for (let c = -(hx + hz); c <= hx + hz; c += 0.08 * Math.SQRT2) {
      const t0 = Math.max(-hx, c - hz), t1 = Math.min(hx, c + hz);
      if (t1 - t0 < 0.06) continue;
      const N = 30;
      let run = null;
      for (let i = 0; i <= N; i++) {
        const t = t0 + ((t1 - t0) * i) / N;
        if (insideRounded(t, t - c, hx - 0.02, hz - 0.02, rt)) {
          if (!run) run = [t, t]; else run[1] = t;
        } else if (run) { emit(run, c); run = null; }
      }
      if (run) emit(run, c);
    }
    return lines;
  }

  PLR.addObject({
    id: 'rug',
    label: '地毯',
    hint: '点击换花纹',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [-1.15, 0.012, 1.5] });
      const m = PLR.mesh(inst.root);
      const face = PLR.quad(m, roundedRect(HX, HZ, R), {
        tint: 'floor',
        doubleSided: true,
        forceN: [0, 1, 0],
      });

      // 外圈双边框（inset 0.06 / 0.09）
      PLR.detail(face, roundedRect(HX - 0.06, HZ - 0.06, R - 0.06), { w: 0.8, alpha: 0.5, closed: true });
      PLR.detail(face, roundedRect(HX - 0.09, HZ - 0.09, R - 0.09), { w: 0.7, alpha: 0.4, closed: true });

      // 三组花纹方案（12 边面不走引擎预计算，直接给 hatchLines）
      face.hatch = { alpha: 0.26 };
      inst.patterns = [patternA(), patternB(), patternC()];
      inst.pattern = 0;
      face.hatchLines = inst.patterns[0];
      inst.face = face;
      inst.pulseT = null;
      return inst;
    },
    onClick() {
      inst.pattern = (inst.pattern + 1) % 3;
      inst.face.hatchLines = inst.patterns[inst.pattern];
      PLR.sfx.play('swish', { rate: PLR.rand(0.92, 1.1), pan: PLR.panOf(PLR.worldPos(inst.root)) });
      // 尺寸脉冲 1 → 1.02 → 1（y 不缩放，避免薄片起伏）
      if (inst.pulseT) inst.pulseT.dead = true;
      inst.pulseT = PLR.tween({
        dur: 0.35,
        ease: 'linear',
        update(k) {
          const s = 1 + 0.02 * Math.sin(k * Math.PI);
          inst.root.scale[0] = s;
          inst.root.scale[2] = s;
        },
        done() { inst.root.scale[0] = 1; inst.root.scale[2] = 1; },
      });
    },
  });
})();
