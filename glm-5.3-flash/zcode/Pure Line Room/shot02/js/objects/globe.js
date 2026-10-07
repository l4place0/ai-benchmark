/* 地球仪 — 底座/立柱 + 23.5° 倾斜轴 + 线框球自转；点击加速旋转，轴随之微晃。
 * 台面 (1.95, 0.75, -2.5)。经纬网格由 PLR.sphere 自带，赤道/经线圈/大陆为贴面细节线。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const R = 0.085, TILT = 0.41, RE = R * 1.012;
  let tiltNode, spinNode;
  const inst = { spin: 0, vel: 0 };

  // 球面局部坐标：纬度/经度（度）→ 点（y 为自转轴北极）
  function ll(lat, lon, rr) {
    const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
    return [rr * Math.cos(a) * Math.cos(b), rr * Math.sin(a), rr * Math.cos(a) * Math.sin(b)];
  }

  // 把一条折线贴到质心最近的球面片上（随该片的可见性出现/隐藏）
  function attachNear(m, pts, opt) {
    let cx = 0, cy = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    let best = null, bd = 1e9;
    for (const f of m.faces) {
      let fx = 0, fy = 0, fz = 0;
      for (const vi of f.vi) { const v = m.verts[vi]; fx += v[0]; fy += v[1]; fz += v[2]; }
      fx /= f.vi.length; fy /= f.vi.length; fz /= f.vi.length;
      const d = (fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) + (fz - cz) * (fz - cz);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) PLR.detail(best, pts, opt);
  }
  // 闭环折线分块贴附，块间共享端点
  function attachLoop(m, pts, opt) {
    for (let i = 0; i < pts.length - 1; i += 4) {
      attachNear(m, pts.slice(i, Math.min(pts.length, i + 5)), opt);
    }
  }

  PLR.addObject({
    id: 'globe',
    label: '地球仪',
    hint: '点击转起来',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [1.95, 0.75, -2.5] });
      const m = PLR.mesh(inst.root);

      // 底座 + 立柱（柱身一条阴影线）
      PLR.cyl(m, { p0: [0, 0, 0], p1: [0, 0.018, 0], r0: 0.052, r1: 0.06, n: 14, caps: { both: true } });
      PLR.cyl(m, { p0: [0, 0.018, 0], p1: [0, 0.118, 0], r0: 0.008, r1: 0.006, n: 8 });
      PLR.detail(m.faces[m.faces.length - 1], [[0, 0.03, 0], [0, 0.114, 0]], { w: 0.6, alpha: 0.4 });

      // 倾斜轴组（rotZ 23.5°）+ 轴杆 + 自转组
      tiltNode = PLR.node(inst.root, { pos: [0, 0.118, 0], rot: [0, 0, TILT] });
      const tm = PLR.mesh(tiltNode);
      PLR.cyl(tm, { p0: [0, -0.038, 0], p1: [0, 0.172, 0], r0: 0.0038, r1: 0.0038, n: 6 });
      spinNode = PLR.node(tiltNode, { pos: [0, 0.067, 0] });
      const sm = PLR.mesh(spinNode);
      PLR.sphere(sm, { c: [0, 0, 0], r: R, nu: 14, nv: 8, opts: { tint: 'paper' } });

      // 赤道圈（按网格 14 段贴附）
      for (let i = 0; i < 14; i++) {
        attachNear(sm, [ll(0, i * (360 / 14), RE), ll(0, (i + 1) * (360 / 14), RE)], { w: 0.9, alpha: 0.55 });
      }
      // 两条经线大圆（每条两半，各 8 段）
      for (const lon of [0, 90]) {
        for (let j = 0; j < 8; j++) {
          attachNear(sm, [ll(-90 + j * 22.5, lon, RE), ll(-90 + (j + 1) * 22.5, lon, RE)], { w: 0.8, alpha: 0.5 });
          attachNear(sm, [ll(90 - j * 22.5, lon + 180, RE), ll(90 - (j + 1) * 22.5, lon + 180, RE)], { w: 0.8, alpha: 0.5 });
        }
      }
      // 大陆：手放的近似闭环（首点重复闭合）
      const land = [
        [[55, -10], [48, 18], [35, 28], [20, 26], [12, 10], [18, -12], [32, -24], [46, -22]],
        [[-15, 95], [-28, 115], [-38, 140], [-32, 152], [-18, 146], [-8, 120]],
        [[8, -78], [-2, -82], [-18, -70], [-30, -58], [-22, -48], [-6, -50], [4, -62]],
        [[58, -118], [50, -96], [42, -82], [30, -88], [22, -100], [32, -116], [46, -124]],
        [[48, 142], [38, 152], [26, 148], [18, 138], [24, 124], [36, 118], [46, 128]],
      ];
      for (const loop of land) {
        const pts = loop.map((p) => ll(p[0], p[1], RE));
        pts.push(pts[0].slice());
        attachLoop(sm, pts, { w: 0.9, alpha: 0.6 });
      }
      return inst;
    },
    update(dt, t) {
      inst.spin += inst.vel * dt;
      inst.vel *= Math.exp(-dt * 0.6);
      spinNode.rot[1] = inst.spin;
      // 旋转时轴微晃（幅度随转速衰减）
      tiltNode.rot[2] = TILT + Math.sin(t * 6.2) * 0.02 * PLR.clamp(inst.vel / 9, 0, 1);
    },
    onClick() {
      inst.vel += PLR.rand(9, 12);
      PLR.sfx.play('swish', { rate: PLR.clamp(inst.vel / 10, 0.5, 1.4), pan: PLR.panOf(PLR.worldPos(inst.root)) });
    },
  });
})();
