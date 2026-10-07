/* 书架 — 左墙（x=-3.2 朝 +x）家具：框体/隔板/背板/檐口 + 层内书籍、陶罐、平放书堆，
 * 以及 4 本可独立抽拉的书（bookA..bookD，bookC 为 accent 秘密红书）。
 * 只占 z -1.6..0.2（z>0.2 留给沙发），进深 x -3.17..-2.81，高 2.12。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const BX = -3.03;      // 书排中心 x（书深 0.22：x -3.14..-2.92）
  const SPINE = -2.92;   // 书脊面

  // 一排立书（书脊朝 +x，沿 +z 排布），返回排尾 z
  function row(m, yBase, z0, n, accentIdx) {
    let z = z0;
    for (let i = 0; i < n; i++) {
      const t = PLR.rand(0.018, 0.042), h = PLR.rand(0.17, 0.235);
      const opts = { noPick: true };
      if (i === accentIdx) opts.tint = 'accent';
      const b = PLR.box(m, { pos: [BX, yBase + h / 2, z + t / 2], size: [0.22, h, t], opts });
      PLR.detail(b.right, [[SPINE, yBase + h - 0.035, z + 0.005], [SPINE, yBase + h - 0.035, z + t - 0.005]], { w: 0.7, alpha: 0.3 });
      if (i === accentIdx) {
        PLR.detail(b.right, [
          [SPINE, yBase + h * 0.3, z + 0.006], [SPINE, yBase + h * 0.3, z + t - 0.006],
          [SPINE, yBase + h * 0.62, z + t - 0.006], [SPINE, yBase + h * 0.62, z + 0.006],
        ], { w: 0.7, alpha: 0.55, closed: true });
      }
      z += t + 0.004;
    }
    return z;
  }

  /* ---------- 书架本体 ---------- */
  PLR.addObject({
    id: 'shelf',
    label: '书架',
    build() {
      const root = PLR.node(PLR.root, {});
      const m = PLR.mesh(root);

      // 框体：侧板×2 / 顶板 / 底板 / 背板
      PLR.box(m, { pos: [-2.99, 1.06, -1.5875], size: [0.36, 2.12, 0.025] });
      const sideF = PLR.box(m, { pos: [-2.99, 1.06, 0.1875], size: [0.36, 2.12, 0.025] });
      PLR.box(m, { pos: [-2.99, 2.11, -0.7], size: [0.36, 0.02, 1.8] });
      PLR.box(m, { pos: [-2.99, 0.012, -0.7], size: [0.36, 0.024, 1.8] });
      PLR.box(m, { pos: [-3.155, 1.06, -0.7], size: [0.012, 2.12, 1.8] });
      // 3 层隔板
      for (const y of [0.52, 1.02, 1.52]) PLR.box(m, { pos: [-2.99, y, -0.7], size: [0.34, 0.018, 1.75] });
      // 顶部小檐口（外凸沿）+ 檐口下阴线
      PLR.box(m, { pos: [-2.8, 2.115, -0.7], size: [0.022, 0.03, 1.8] });
      PLR.detail(sideF.right, [[-2.8095, 2.085, -1.575], [-2.8095, 2.085, 0.175]], { w: 0.8, alpha: 0.45 });
      PLR.detail(sideF.right, [[-2.8095, 2.068, -1.575], [-2.8095, 2.068, 0.175]], { w: 0.7, alpha: 0.3 });

      // 底层（基面 0.024）：书排 + 陶罐 + 空位(bookD)
      row(m, 0.024, -1.55, 4);
      PLR.cyl(m, { p0: [-3.0, 0.024, -1.18], p1: [-3.0, 0.139, -1.18], r0: 0.042, r1: 0.058, n: 10, caps: { bottom: true }, opts: { noPick: true } });
      PLR.ngon(m, [-3.0, 0.135, -1.18], 0.052, 10, { plane: 'xz', tint: 'ink', alpha: 0.4, doubleSided: true, noPick: true });
      PLR.ngon(m, [-3.0, 0.058, -1.18], 0.049, 10, { plane: 'xz', doubleSided: true, noPick: true });
      PLR.ngon(m, [-3.0, 0.1, -1.18], 0.055, 10, { plane: 'xz', doubleSided: true, noPick: true });
      row(m, 0.024, -0.74, 4);

      // 第 2 层（0.529）：书排 + 空位(bookA) + 书排 + 斜靠书
      row(m, 0.529, -1.55, 3);
      row(m, 0.529, -1.09, 4);
      const ln = PLR.node(root, { pos: [-3.03, 0.529, -0.912], rot: [-0.14, 0, 0] });
      const lb = PLR.box(PLR.mesh(ln), { pos: [0, 0.095, 0], size: [0.22, 0.19, 0.03], opts: { noPick: true } });
      PLR.detail(lb.right, [[0.1095, 0.155, -0.011], [0.1095, 0.155, 0.011]], { w: 0.7, alpha: 0.3 });

      // 第 3 层（1.029）：书排(含 accent) + 平放书堆 + 书排 + 空位(bookB)
      row(m, 1.029, -1.55, 4, 2);
      const f1 = PLR.box(m, { pos: [-3.0, 1.046, -1.16], size: [0.21, 0.034, 0.17], opts: { noPick: true } });
      PLR.detail(f1.right, [[-2.8945, 1.046, -1.23], [-2.8945, 1.046, -1.09]], { w: 0.7, alpha: 0.3 });
      const f2n = PLR.node(root, { pos: [-2.995, 1.08, -1.14], rot: [0, 0.14, 0] });
      const f2 = PLR.box(PLR.mesh(f2n), { pos: [0, 0, 0], size: [0.19, 0.03, 0.15], opts: { noPick: true } });
      PLR.detail(f2.right, [[0.0945, 0, -0.066], [0.0945, 0, 0.066]], { w: 0.7, alpha: 0.3 });
      row(m, 1.029, -0.94, 3);

      // 顶层（1.529）：书排 + 空位(bookC) + 书排
      row(m, 1.529, -1.55, 4);
      row(m, 1.529, -1.04, 4);

      PLR.shadow(-2.99, -0.7, 0.5, 1.9, 0.5);
      return { root };
    },
  });

  /* ---------- 可抽拉的书 ---------- */
  function pullBook(id, yBase, z, h, accent) {
    let root;
    const inst = { out: false };
    PLR.addObject({
      id,
      label: '书',
      hint: '点击抽出',
      build() {
        root = PLR.node(PLR.root, { pos: [-3.03, yBase, z] });
        inst.root = root;
        const m = PLR.mesh(root);
        const b = PLR.box(m, { pos: [0, h / 2, 0], size: [0.22, h, 0.03], opts: accent ? { tint: 'accent' } : {} });
        PLR.detail(b.right, [[0.1095, h * 0.72, -0.0115], [0.1095, h * 0.72, 0.0115]], { w: 0.7, alpha: 0.4 });
        PLR.detail(b.right, [
          [0.1095, h * 0.28, -0.009], [0.1095, h * 0.28, 0.009],
          [0.1095, h * 0.55, 0.009], [0.1095, h * 0.55, -0.009],
        ], { w: 0.7, alpha: 0.55, closed: true });
        return inst;
      },
      onClick() {
        inst.out = !inst.out;
        const from = root.pos[0], to = inst.out ? -3.03 + 0.15 : -3.03;
        const rf = root.rot[2], rt = inst.out ? -0.06 : 0;
        PLR.sfx.play('book', { rate: inst.out ? 1 : 0.85, pan: PLR.panOf(PLR.worldPos(root)) });
        PLR.tween({
          dur: 0.45, ease: 'outCubic',
          update(k) {
            root.pos[0] = from + (to - from) * k;
            root.rot[2] = rf + (rt - rf) * k;
          },
        });
      },
    });
  }
  pullBook('bookA', 0.529, -1.27, 0.2, false);
  pullBook('bookB', 1.029, -0.62, 0.21, false);
  pullBook('bookC', 1.529, -1.22, 0.215, true);
  pullBook('bookD', 0.024, -0.92, 0.19, false);
})();
