/* 装饰画 — 后墙 x=2.15，中心 y=1.8，外框 0.72×0.92（墙面朝 +z）
 * 初始歪斜 rot[2]=0.045；首击摆正，之后每次点击翻页，循环 3 幅线稿。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  let artNode, board, dotFace;
  const inst = {};
  const Z = 0.012;                                  // 画芯平面（背板局部）
  const P = (pts) => pts.map((p) => [p[0], p[1], Z]);

  PLR.addObject({
    id: 'art',
    label: '装饰画',
    hint: '点击换一幅',
    build() {
      inst.root = PLR.node(PLR.root, { pos: [2.15, 1.8, -2.8], rot: [0, 0, 0.045] });
      const m = PLR.mesh(inst.root);

      // 画框：4 条细框条（截面 0.035×0.05，凸出墙面 0.03）
      PLR.box(m, { pos: [0, 0.4425, 0.005], size: [0.72, 0.035, 0.05] });
      PLR.box(m, { pos: [0, -0.4425, 0.005], size: [0.72, 0.035, 0.05] });
      PLR.box(m, { pos: [-0.3425, 0, 0.005], size: [0.035, 0.85, 0.05] });
      PLR.box(m, { pos: [0.3425, 0, 0.005], size: [0.035, 0.85, 0.05] });

      // 画布（翻页节点，rot[1] 0→π/2→0）
      artNode = PLR.node(inst.root, {});
      const am = PLR.mesh(artNode);
      board = PLR.quad(am, [
        [-0.34, -0.44, Z], [0.34, -0.44, Z], [0.34, 0.44, Z], [-0.34, 0.44, Z],
      ], { tint: 'paper', doubleSided: true });

      // 抽象画的实心圆点（仅第 3 幅入列；finalize 前先移出，需要时再放回）
      dotFace = PLR.ngon(am, [0.12, 0.14, Z + 0.004], 0.034, 12, { plane: 'xy', tint: 'ink', doubleSided: true, noPick: true });
      am.faces.splice(am.faces.indexOf(dotFace), 1);
      inst.dotIn = false;

      // 三幅画芯（用 PLR.detail 生成，换画时整组替换 board.details）
      const groups = [];
      const grab = (fn) => { const s = board.details.length; fn(); groups.push(board.details.splice(s)); };
      const mat = () => PLR.detail(board, P([[-0.28, -0.38], [0.28, -0.38], [0.28, 0.38], [-0.28, 0.38]]), { w: 0.8, alpha: 0.35, closed: true });
      const circle = (cx, cy, r, a) => {
        const pts = [];
        for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r, Z]); }
        PLR.detail(board, pts, { w: 0.8, alpha: a, closed: true });
      };

      grab(() => {  // (a) 远山两重 + 圆日 + 飞鸟两笔
        mat();
        PLR.detail(board, P([[-0.27, -0.05], [-0.14, 0.17], [0, 0.01], [0.13, 0.15], [0.27, -0.03]]), { w: 0.85, alpha: 0.55 });
        PLR.detail(board, P([[-0.27, -0.19], [-0.17, -0.01], [-0.03, -0.15], [0.1, -0.02], [0.27, -0.17]]), { w: 0.85, alpha: 0.6 });
        circle(0.18, 0.25, 0.05, 0.55);
        PLR.detail(board, P([[-0.17, 0.27], [-0.12, 0.31], [-0.07, 0.27]]), { w: 0.75, alpha: 0.5 });
        PLR.detail(board, P([[-0.02, 0.33], [0.02, 0.365], [0.06, 0.33]]), { w: 0.75, alpha: 0.5 });
      });
      grab(() => {  // (b) 瓶花：瓶轮廓折线 + 三枝茎 + 圆叶
        mat();
        PLR.detail(board, P([[-0.05, -0.36], [-0.11, -0.27], [-0.12, -0.12], [-0.06, -0.03], [-0.06, 0.04], [0.06, 0.04], [0.06, -0.03], [0.12, -0.12], [0.11, -0.27], [0.05, -0.36]]), { w: 0.85, alpha: 0.6 });
        PLR.detail(board, P([[0, 0.04], [-0.03, 0.13], [-0.05, 0.21]]), { w: 0.75, alpha: 0.5 });
        PLR.detail(board, P([[0.01, 0.04], [0.04, 0.15], [0.09, 0.25]]), { w: 0.75, alpha: 0.5 });
        PLR.detail(board, P([[-0.01, 0.04], [-0.01, 0.16], [-0.07, 0.27]]), { w: 0.75, alpha: 0.5 });
        circle(-0.07, 0.25, 0.036, 0.55);
        circle(0.11, 0.29, 0.03, 0.55);
        circle(-0.09, 0.32, 0.03, 0.55);
      });
      grab(() => {  // (c) 抽象：大圆弧 + 小实心圆（dotFace）+ 两根斜线
        mat();
        const arc = [];
        for (let i = 0; i <= 6; i++) {
          const a = (7 * Math.PI) / 6 + (i / 6) * ((2 * Math.PI) / 3);
          arc.push([Math.cos(a) * 0.27, Math.sin(a) * 0.27 - 0.02, Z]);
        }
        PLR.detail(board, arc, { w: 0.85, alpha: 0.55 });
        PLR.detail(board, P([[-0.2, 0.26], [0.1, -0.05]]), { w: 0.75, alpha: 0.5 });
        PLR.detail(board, P([[-0.08, 0.3], [0.22, -0.02]]), { w: 0.75, alpha: 0.5 });
      });

      board.details = groups[0];
      inst.groups = groups;
      inst.idx = 0;
      inst.straight = false;
      inst.busy = false;
      return inst;
    },
    onClick() {
      if (inst.busy) return;
      const pan = PLR.panOf(PLR.worldPos(inst.root));
      if (!inst.straight) {
        // 第一次：把歪斜的画框摆正
        inst.busy = true;
        PLR.sfx.play('squeak', { gain: 0.35, pan });
        const from = inst.root.rot[2];
        PLR.tween({
          dur: 0.5, ease: 'outBack',
          update(k) { inst.root.rot[2] = from * (1 - k); },
          done() { inst.straight = true; inst.busy = false; },
        });
        return;
      }
      // 翻页：转 90° 时换画，再转回；画框 ±0.03 衰减正弦弹跳
      inst.busy = true;
      PLR.sfx.play('flip', { rate: 1.05, pan });
      PLR.tween({
        dur: 0.5, ease: 'linear',
        update(k) { inst.root.rot[2] = 0.03 * Math.sin(k * Math.PI * 4) * (1 - k); },
      });
      PLR.tween({
        dur: 0.22, ease: 'inQuad',
        update(k) { artNode.rot[1] = (Math.PI / 2) * k; },
        done() {
          inst.idx = (inst.idx + 1) % inst.groups.length;
          board.details = inst.groups[inst.idx];
          const wantDot = inst.idx === 2;
          if (wantDot && !inst.dotIn) {
            board.mesh.faces.push(dotFace);
            inst.dotIn = true;
          } else if (!wantDot && inst.dotIn) {
            const i = board.mesh.faces.indexOf(dotFace);
            if (i >= 0) board.mesh.faces.splice(i, 1);
            inst.dotIn = false;
          }
          PLR.tween({
            dur: 0.26, ease: 'outCubic',
            update(k) { artNode.rot[1] = (Math.PI / 2) * (1 - k); },
            done() { artNode.rot[1] = 0; inst.busy = false; },
          });
        },
      });
    },
  });
})();
