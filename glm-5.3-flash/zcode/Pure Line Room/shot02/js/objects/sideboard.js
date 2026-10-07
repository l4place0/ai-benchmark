/* 储物柜 — 靠前墙（z=2.8 墙面朝 -z，立面朝房间即朝 -z）。
 * 占地 x -0.95..0.35，进深 z 2.36..2.8，柜体 y 0.1..0.88（高 0.78）+ 4 只 0.1 短腿。
 * 薄板围合空心内腔（中部隔板 y≈0.31），上排两抽屉位（y 0.52..0.72）、下排对开门位（y 0.1..0.5）。
 * 含 5 个定义：sideboard（纯柜体）/ drawerU1 / drawerU2 / doorL / doorR。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const panOf = (n) => PLR.panOf(PLR.worldPos(n)) || 0;

  /* ---------- 柜体（无 onClick，纯壳） ---------- */
  PLR.addObject({
    id: 'sideboard',
    label: '储物柜',
    build() {
      const inst = {};
      inst.root = PLR.node(PLR.root, { pos: [0, 0, 0] });
      const m = PLR.mesh(inst.root);

      // 4 只短腿
      for (const [lx, lz] of [[-0.9, 2.41], [0.3, 2.41], [-0.9, 2.75], [0.3, 2.75]]) {
        PLR.box(m, { pos: [lx, 0.05, lz], size: [0.05, 0.1, 0.05] });
      }
      // 空心内腔薄板围合：底板 / 顶板 / 左右侧板 / 背板 / 中部隔板
      const bottom = PLR.box(m, { pos: [-0.3, 0.112, 2.58], size: [1.3, 0.024, 0.44] });
      const top = PLR.box(m, { pos: [-0.3, 0.868, 2.58], size: [1.3, 0.024, 0.44] });
      const left = PLR.box(m, { pos: [-0.938, 0.49, 2.58], size: [0.024, 0.78, 0.44] });
      const right = PLR.box(m, { pos: [0.338, 0.49, 2.58], size: [0.024, 0.78, 0.44] });
      PLR.box(m, { pos: [-0.3, 0.31, 2.58], size: [1.252, 0.024, 0.392] });
      // 背板（稍离墙 2cm，剪屋视角下可见，加两条拼板缝）
      const backP = PLR.box(m, { pos: [-0.3, 0.49, 2.768], size: [1.252, 0.78, 0.024] });
      PLR.detail(backP.front, [[-0.72, 0.12, 2.781], [-0.72, 0.86, 2.781]], { w: 0.7, alpha: 0.3 });
      PLR.detail(backP.front, [[0.12, 0.12, 2.781], [0.12, 0.86, 2.781]], { w: 0.7, alpha: 0.3 });
      // 正面框架：顶沿 / 中沿 / 抽屉中梃（围出上排抽屉口与下排对开门口）
      PLR.box(m, { pos: [-0.3, 0.788, 2.372], size: [1.252, 0.136, 0.024] });
      const midRail = PLR.box(m, { pos: [-0.3, 0.51, 2.372], size: [1.252, 0.02, 0.024] });
      PLR.box(m, { pos: [-0.3, 0.62, 2.372], size: [0.04, 0.2, 0.024] });

      // 外立面细节：顶部檐口线 + 门缝线
      PLR.detail(top.back, [[-0.93, 0.862, 2.36], [0.33, 0.862, 2.36]], { w: 0.8, alpha: 0.5 });
      PLR.detail(right.right, [[0.35, 0.862, 2.38], [0.35, 0.862, 2.78]], { w: 0.8, alpha: 0.5 });
      PLR.detail(left.left, [[-0.95, 0.862, 2.38], [-0.95, 0.862, 2.78]], { w: 0.8, alpha: 0.5 });
      PLR.detail(midRail.back, [[-0.3, 0.5, 2.36], [-0.3, 0.52, 2.36]], { w: 0.8, alpha: 0.55 });
      PLR.detail(bottom.back, [[-0.3, 0.1, 2.36], [-0.3, 0.124, 2.36]], { w: 0.8, alpha: 0.55 });

      PLR.shadow(-0.3, 2.58, 1.4, 0.5, 0.5);
      return inst;
    },
  });

  /* ---------- 抽屉：关闭 z=0，开 = 沿 -z 平移 0.24 ---------- */
  function addDrawer(id, cx) {
    let inst = null;
    PLR.addObject({
      id: id,
      label: '抽屉',
      hint: '点击开合',
      build() {
        inst = { root: null, baseZ: 2.5, open: false, tw: null };
        inst.root = PLR.node(PLR.root, { pos: [cx, 0.62, 2.5] });
        const m = PLR.mesh(inst.root);
        // 面板（z≈2.375 稍凸）+ 小拉手横条
        PLR.box(m, { pos: [0, 0, -0.125], size: [0.6, 0.19, 0.026] });
        PLR.box(m, { pos: [0, 0.062, -0.15], size: [0.16, 0.02, 0.026] });
        // 盒体侧 / 底 / 背板（打开时可见，不参与拾取）
        const deco = { noPick: true, lw: 0.8 };
        PLR.box(m, { pos: [-0.258, -0.01, 0.0225], size: [0.012, 0.13, 0.265], opts: deco });
        PLR.box(m, { pos: [0.258, -0.01, 0.0225], size: [0.012, 0.13, 0.265], opts: deco });
        PLR.box(m, { pos: [0, -0.069, 0.0225], size: [0.504, 0.012, 0.265], opts: deco });
        PLR.box(m, { pos: [0, -0.004, 0.149], size: [0.528, 0.118, 0.012], opts: deco });
        return inst;
      },
      onClick() {
        inst.open = !inst.open;
        if (inst.tw) inst.tw.dead = true;
        const from = inst.root.pos[2];
        const to = inst.open ? inst.baseZ - 0.24 : inst.baseZ;
        const pan = panOf(inst.root);
        PLR.sfx.play('slide', { rate: inst.open ? 1 : 0.9, gain: 0.7, pan: pan });
        inst.tw = PLR.tween({
          dur: 0.5, ease: 'inOutCubic',
          update(k) { inst.root.pos[2] = from + (to - from) * k; },
          done() { PLR.sfx.play(inst.open ? 'slideStop' : 'latch', { gain: 0.7, pan: pan }); },
        });
      },
    });
  }
  addDrawer('drawerU1', -0.62);
  addDrawer('drawerU2', 0.02);

  /* ---------- 对开门：铰链在外侧竖边，朝房间（-z）张开 ---------- */
  // side=+1：doorL（门体在铰链 +x 侧，开为 rot[1]=+1.9）；side=-1：doorR（相反）
  function addDoor(id, hx, side) {
    let inst = null;
    PLR.addObject({
      id: id,
      label: '柜门',
      hint: '点击开合',
      build() {
        inst = { root: null, open: false, tw: null };
        inst.root = PLR.node(PLR.root, { pos: [hx, 0, 2.372] });
        const m = PLR.mesh(inst.root);
        // 门板（薄 box，双面）
        const slab = PLR.box(m, { pos: [side * 0.31, 0.312, 0], size: [0.62, 0.42, 0.02], opts: { doubleSided: true } });
        // 门内侧搁板沿线
        PLR.detail(slab.front, [[side * 0.06, 0.41, 0.011], [side * 0.56, 0.41, 0.011]], { w: 0.7, alpha: 0.5 });
        // 小圆拉手
        PLR.cyl(m, { p0: [side * 0.56, 0.312, -0.012], p1: [side * 0.56, 0.312, -0.044], r0: 0.011, r1: 0.011, n: 8, caps: { top: true } });
        return inst;
      },
      onClick() {
        inst.open = !inst.open;
        if (inst.tw) inst.tw.dead = true;
        const from = inst.root.rot[1];
        const to = inst.open ? side * 1.9 : 0;
        const pan = panOf(inst.root);
        PLR.sfx.play('creak', { rate: inst.open ? 1.25 : 0.85, gain: 0.5, pan: pan });
        inst.tw = PLR.tween({
          dur: 1.0, ease: 'inOutCubic',
          update(k) { inst.root.rot[1] = from + (to - from) * k; },
          done() { PLR.sfx.play('latch', { gain: 0.6, pan: pan }); },
        });
      },
    });
  }
  addDoor('doorL', -0.93, 1);
  addDoor('doorR', 0.33, -1);
})();
