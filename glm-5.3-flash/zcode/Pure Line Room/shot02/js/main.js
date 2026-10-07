/* 纯线房间 — 主控：建筑结构（地板/墙/天花/踢脚线）+ 启动引导 */
(function () {
  'use strict';
  const PLR = window.PLR;

  /* ---------- 墙面工具：带洞口的墙板剖分 ---------- */
  // 生成 (u0..u1, y0..y1) 挖去 holes 后的矩形列表，并按 <=0.85m 细分
  function wallRects(u0, u1, y0, y1, holes) {
    let rects = [[u0, y0, u1, y1]];
    for (const h of holes) {
      const next = [];
      for (const r of rects) {
        const [a, b, c, d] = r; // u0,y0,u1,y1
        if (h.u1 <= a || h.u0 >= c || h.y1 <= b || h.y0 >= d) { next.push(r); continue; }
        if (h.u0 > a) next.push([a, b, h.u0, d]);
        if (h.u1 < c) next.push([h.u1, b, c, d]);
        const my0 = Math.max(b, h.y0), my1 = Math.min(d, h.y1);
        if (my0 > b) next.push([Math.max(a, h.u0), b, Math.min(c, h.u1), my0]);
        if (my1 < d) next.push([Math.max(a, h.u0), my1, Math.min(c, h.u1), d]);
      }
      rects = next;
    }
    // 细分宽条
    const out = [];
    for (const r of rects) {
      const w = r[2] - r[0];
      const n = Math.max(1, Math.ceil(w / 0.85));
      for (let i = 0; i < n; i++) out.push([r[0] + (w * i) / n, r[1], r[0] + (w * (i + 1)) / n, r[3]]);
    }
    return out;
  }

  // 各朝向墙面的 CCW 顶点序
  const WALLV = {
    '+z': (u0, y0, u1, y1, at) => [[u0, y0, at], [u1, y0, at], [u1, y1, at], [u0, y1, at]],
    '-z': (u0, y0, u1, y1, at) => [[u1, y0, at], [u0, y0, at], [u0, y1, at], [u1, y1, at]],
    '-x': (u0, y0, u1, y1, at) => [[at, y0, u0], [at, y0, u1], [at, y1, u1], [at, y1, u0]],
    '+x': (u0, y0, u1, y1, at) => [[at, y0, u1], [at, y0, u0], [at, y1, u0], [at, y1, u1]],
  };

  function buildWall(mesh, dir, at, u0, u1, y0, y1, holes) {
    for (const r of wallRects(u0, u1, y0, y1, holes || [])) {
      PLR.quad(mesh, WALLV[dir](r[0], r[1], r[2], r[3], at), { tint: 'paper' });
    }
  }

  function buildArchitecture() {
    const arch = PLR.node(PLR.root, {});
    const m = PLR.mesh(arch);

    // 地板（0.8m 网格，动态木纹排线）
    for (let ix = 0; ix < 8; ix++) {
      for (let iz = 0; iz < 7; iz++) {
        const x0 = -3.2 + ix * 0.8, x1 = x0 + 0.8;
        const z0 = -2.8 + iz * 0.8, z1 = z0 + 0.8;
        PLR.quad(m, [[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], { tint: 'floor', dynHatch: 'floor', noPick: true });
      }
    }

    // 天花 + 内框线
    const ceil = PLR.quad(m, [[-3.2, 3, -2.8], [3.2, 3, -2.8], [3.2, 3, 2.8], [-3.2, 3, 2.8]], { tint: 'ceil', noPick: true });
    PLR.detail(ceil, [[-2.95, 3, -2.55], [2.95, 3, -2.55], [2.95, 3, 2.55], [-2.95, 3, 2.55], [-2.95, 3, -2.55]], { w: 0.8, alpha: 0.35, closed: true });

    // 四壁（后墙带窗洞、右墙带门洞）
    buildWall(m, '+z', -2.8, -3.2, 3.2, 0, 3, [{ u0: -1.9, u1: -0.3, y0: 1.0, y1: 2.4 }]);   // 后墙
    buildWall(m, '-x', 3.2, -2.8, 2.8, 0, 3, [{ u0: -1.95, u1: -1.03, y0: 0, y1: 2.05 }]);   // 右墙（u=z）
    buildWall(m, '+x', -3.2, -2.8, 2.8, 0, 3, []);                                            // 左墙
    buildWall(m, '-z', 2.8, -3.2, 3.2, 0, 3, []);                                             // 前墙

    // 踢脚线（门洞处断开）
    const skH = 0.09, skT = 0.014;
    const skirt = (u0, u1, dir, at) => {
      if (u1 - u0 < 0.02) return;
      const off = (dir === '+z' || dir === '+x') ? -skT / 2 : skT / 2;
      if (dir === '+z' || dir === '-z') PLR.box(m, { pos: [(u0 + u1) / 2, skH / 2, at + off], size: [u1 - u0, skH, skT] });
      else PLR.box(m, { pos: [at + off, skH / 2, (u0 + u1) / 2], size: [skT, skH, u1 - u0] });
    };
    skirt(-3.2, 3.2, '+z', -2.8);            // 后墙
    skirt(-2.8, -1.97, '-x', 3.2);           // 右墙门洞前段
    skirt(-1.01, 2.8, '-x', 3.2);            // 右墙门洞后段
    skirt(-2.8, 2.8, '+x', -3.2);            // 左墙
    skirt(-3.2, 3.2, '-z', 2.8);             // 前墙
  }

  /* ---------- 启动 ---------- */
  function boot() {
    const canvas = document.getElementById('scene');
    PLR.initCanvas(canvas);
    buildArchitecture();
    PLR.buildObjects();
    PLR.start();

    // 进场镜头已在 engine 里用目标值平滑实现
    const intro = document.getElementById('intro');
    const enter = () => {
      if (!intro) return;
      intro.classList.add('gone');
      PLR.sfx.unlock();
      window.removeEventListener('pointerdown', enter);
      setTimeout(() => intro.remove(), 900);
    };
    if (intro) {
      intro.addEventListener('pointerdown', enter);
      window.addEventListener('keydown', enter);
    }

    // 静音按钮
    const mute = document.getElementById('muteBtn');
    if (mute) {
      mute.addEventListener('click', (e) => {
        e.stopPropagation();
        const muted = mute.classList.toggle('muted');
        PLR.sfx.setMuted(muted);
      });
    }

    // 底部提示淡出
    const hint = document.getElementById('hint');
    if (hint) setTimeout(() => hint.classList.add('fade'), 11000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
