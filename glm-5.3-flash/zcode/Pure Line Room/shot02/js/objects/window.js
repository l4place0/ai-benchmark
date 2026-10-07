/* 窗户 + 窗帘 — 一个文件两个物件：'window' 与 'curtain'
 * 后墙窗洞 x∈[-1.9,-0.3]，y∈[1.0,2.4]，z=-2.8（墙面朝 +z）。 */
(function () {
  'use strict';
  const PLR = window.PLR;

  /* ==================== 窗 ==================== */
  let sash;
  const W = {};

  PLR.addObject({
    id: 'window',
    label: '窗户',
    hint: '点击开窗·有风进来',
    build() {
      W.root = PLR.node(PLR.root, { pos: [-1.1, 1.7, -2.8] });   // 洞口中心
      const m = PLR.mesh(W.root);

      // 框：两边梃 + 上冒头（截面 0.05×0.07，凸出墙 0.05 / 嵌入 0.02）
      PLR.box(m, { pos: [-0.775, 0, 0.015], size: [0.05, 1.46, 0.07] });
      PLR.box(m, { pos: [0.775, 0, 0.015], size: [0.05, 1.46, 0.07] });
      PLR.box(m, { pos: [0, 0.725, 0.015], size: [1.6, 0.05, 0.07] });
      // 下窗台板（宽出洞 0.08，凸出 0.06）
      const sill = PLR.box(m, { pos: [0, -0.7175, 0.025], size: [1.68, 0.035, 0.07] });
      PLR.detail(sill.front, [[-0.83, -0.712, 0.06], [0.83, -0.712, 0.06]], { w: 0.7, alpha: 0.3 });

      // 窗扇（顶部铰点 y=2.4 z=-2.77，rotX 开合：开 -0.42 底边向室内摆）
      sash = PLR.node(W.root, { pos: [0, 0.7, 0.03] });
      const sm = PLR.mesh(sash);
      // 玻璃 1.52×1.31（双面半透明）
      const glass = PLR.quad(sm, [
        [-0.76, -1.355, 0], [0.76, -1.355, 0], [0.76, -0.045, 0], [-0.76, -0.045, 0],
      ], { alpha: 0.13, doubleSided: true });
      // 中挺十字分格
      PLR.detail(glass, [[0, -1.355, 0], [0, -0.045, 0]], { w: 0.75, alpha: 0.5 });
      PLR.detail(glass, [[-0.76, -0.7, 0], [0.76, -0.7, 0]], { w: 0.75, alpha: 0.5 });
      // 对角反光斜线两笔
      PLR.detail(glass, [[-0.5, -1.3, 0], [0.28, -0.42, 0]], { w: 0.7, alpha: 0.25 });
      PLR.detail(glass, [[-0.18, -1.3, 0], [0.58, -0.46, 0]], { w: 0.7, alpha: 0.25 });
      // 窗扇四边细框条（正好填在边梃内口 ±0.75 之间）
      PLR.box(sm, { pos: [-0.7275, -0.7, -0.005], size: [0.045, 1.4, 0.05] });
      PLR.box(sm, { pos: [0.7275, -0.7, -0.005], size: [0.045, 1.4, 0.05] });
      PLR.box(sm, { pos: [0, -0.0225, -0.005], size: [1.41, 0.045, 0.05] });
      PLR.box(sm, { pos: [0, -1.3775, -0.005], size: [1.41, 0.045, 0.05] });
      // 内侧小把手
      PLR.box(sm, { pos: [0.69, -0.7, 0.015], size: [0.03, 0.028, 0.022] });

      W.open = false;
      return W;
    },
    update() {
      PLR.env.breezeT = W.open ? 1 : 0;   // 每帧与环境保持同步
    },
    onClick() {
      W.open = !W.open;
      const from = sash.rot[0], to = W.open ? -0.42 : 0;
      PLR.sfx.play('clack', { pan: PLR.panOf(PLR.worldPos(W.root)) });
      PLR.tween({
        dur: 0.9, ease: 'outBack',
        update(k) { sash.rot[0] = from + (to - from) * k; },
      });
    },
  });

  /* ==================== 窗帘 ==================== */
  let panelL, panelR;
  const C = {};

  PLR.addObject({
    id: 'curtain',
    label: '窗帘',
    hint: '点击拉合/拉开',
    build() {
      C.root = PLR.node(PLR.root, { pos: [-1.1, 2.52, -2.72] });  // 轨杆中心
      const m = PLR.mesh(C.root);

      // 轨杆（轴沿 x，两端小端头）
      PLR.cyl(m, { p0: [-0.95, 0, 0], p1: [0.95, 0, 0], r0: 0.012, r1: 0.012, n: 8, caps: { both: true } });
      PLR.cyl(m, { p0: [-0.99, 0, 0], p1: [-0.95, 0, 0], r0: 0.02, r1: 0.02, n: 8, caps: { both: true } });
      PLR.cyl(m, { p0: [0.95, 0, 0], p1: [0.99, 0, 0], r0: 0.02, r1: 0.02, n: 8, caps: { both: true } });

      // 两片帘：局部 quad（闭合宽 0.82，垂到 y 0.78），收/放靠 scale[0] + pos[0]
      const mkPanel = (side) => {
        const p = PLR.node(C.root, { pos: [side * 0.9, -0.02, 0.02], scale: [0.3, 1, 1] });
        const pm = PLR.mesh(p);
        const cloth = PLR.quad(pm, [
          [-0.41, -1.72, 0], [0.41, -1.72, 0], [0.41, 0, 0], [-0.41, 0, 0],
        ], { tint: 'paper', doubleSided: true });
        // 竖向褶皱（建在片局部空间，收拢时自动压缩）
        for (const px of [-0.31, -0.185, -0.06, 0.06, 0.185, 0.31]) {
          PLR.detail(cloth, [[px, -0.02, 0], [px, -1.71, 0]], { w: 0.7, alpha: 0.3 });
        }
        // 底摆线
        PLR.detail(cloth, [[-0.4, -1.7, 0], [0.4, -1.7, 0]], { w: 0.8, alpha: 0.45 });
        // 挂环（是片的子节点，随片一起收拢）
        for (const rx of [-0.31, -0.185, -0.06, 0.06, 0.185, 0.31]) {
          PLR.cyl(pm, {
            p0: [rx - 0.008, 0.02, -0.02], p1: [rx + 0.008, 0.02, -0.02],
            r0: 0.017, r1: 0.017, n: 8, caps: { both: true }, opts: { noPick: true, lw: 0.8 },
          });
        }
        return p;
      };
      panelL = mkPanel(-1);
      panelR = mkPanel(1);

      C.closed = false;
      C.phase = [0, 1.7];
      return C;
    },
    update(dt, t, env) {
      // 微摆：随风（开窗/吊扇）增幅
      const amp = 0.02 * (1 + env.breeze * 5);
      panelL.rot[2] = Math.sin(t * 1.3 + C.phase[0]) * amp;
      panelR.rot[2] = Math.sin(t * 1.3 + C.phase[1]) * amp;
    },
    onClick() {
      C.closed = !C.closed;
      const tS = C.closed ? 1 : 0.3;
      const fL = panelL.pos[0], tL = C.closed ? -0.41 : -0.9;   // 合拢时两片在中缝 -1.1 相接
      const fR = panelR.pos[0], tR = C.closed ? 0.41 : 0.9;
      const fS = panelL.scale[0];
      PLR.sfx.play('swish', { gain: 0.8, pan: PLR.panOf(PLR.worldPos(C.root)) });
      PLR.tween({
        dur: 1.1, ease: 'inOutCubic',
        update(k) {
          const s = fS + (tS - fS) * k;
          panelL.scale[0] = s;
          panelR.scale[0] = s;
          panelL.pos[0] = fL + (tL - fL) * k;
          panelR.pos[0] = fR + (tR - fR) * k;
        },
      });
    },
  });

  /* ==================== 窗外天空：日/月/星/云（真实时间 + 昼夜主题） ==================== */
  const S = {};
  PLR.addObject({
    id: 'sky',
    label: '窗外',
    build() {
      
      S.root = PLR.node(PLR.root, { pos: [0, 0, 0] });
      const m = PLR.mesh(S.root);
      // 天幕：墙面洞口后方，颜色随主题昼夜插值
      const sky = PLR.quad(m, [
        [-2.15, 0.82, -2.88], [-0.05, 0.82, -2.88], [-0.05, 2.6, -2.88], [-2.15, 2.6, -2.88],
      ], { tint: 'sky', noPick: true, doubleSided: true });

      const circle = (cx, cy, r, n) => {
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, -2.878]);
        }
        return pts;
      };
      // 太阳（圆 + 8 道光线）
      S.sunDisc = { pts: circle(-1.5, 2.0, 0.13, 14), w: 1.0, alpha: 0.7, closed: true };
      S.sunRays = { pts: (() => {
        const rays = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.4;
          rays.push([-1.5 + Math.cos(a) * 0.17, 2.0 + Math.sin(a) * 0.17, -2.878]);
          rays.push([-1.5 + Math.cos(a) * 0.245, 2.0 + Math.sin(a) * 0.245, -2.878]);
        }
        return rays;
      })(), w: 0.9, alpha: 0.5 };
      S.sunPos = [-1.5, 2.0];
      // 月亮（残月闭合轮廓）
      {
        const p = [], cx = -0.62, cy = 2.18, R = 0.11;
        for (let i = 0; i <= 10; i++) {
          const a = -Math.PI / 2 + Math.PI * (i / 10);
          p.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, -2.878]);
        }
        for (let i = 10; i >= 0; i--) {
          const a = -Math.PI / 2 + Math.PI * (i / 10);
          p.push([cx + 0.05 + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.9, -2.878]);
        }
        S.moon = { pts: p, w: 1.0, alpha: 0, closed: true };
      }
      // 星星（十字微光，闪烁）
      S.stars = [];
      for (let i = 0; i < 13; i++) {
        const sx = -1.82 + ((i * 0.947) % 1.45);
        const sy = 1.08 + ((i * 0.611) % 1) * 1.24;
        const r = i % 3 === 0 ? 0.024 : 0.014;
        S.stars.push({
          det: { pts: [[sx - r, sy, -2.878], [sx + r, sy, -2.878], [sx, sy - r, -2.878], [sx, sy + r, -2.878]], w: 0.9, alpha: 0 },
          ph: i * 1.7,
        });
      }
      // 云（两朵，缓慢漂移）
      const cloud = (cx, cy, s) => {
        const pts = [];
        const bumps = [[0, 0, 0.16], [0.14, 0.03, 0.12], [0.27, 0, 0.14], [0.1, -0.06, 0.13]];
        for (const [bx, by, br] of bumps) {
          for (let i = 0; i <= 6; i++) {
            const a = Math.PI * (i / 6);
            pts.push([cx + (bx + Math.cos(a) * br) * s, cy + (by + Math.sin(a) * br * 0.7) * s, -2.878]);
          }
        }
        pts.push([cx - 0.16 * s, cy - 0.055 * s, -2.878], [cx - 0.17 * s, cy - 0.02 * s, -2.878]);
        return pts;
      };
      S.clouds = [
        { det: { pts: cloud(-1.7, 1.78, 1), w: 0.9, alpha: 0, closed: true }, base: 0, speed: 0.009, x: null },
        { det: { pts: cloud(-1.15, 2.32, 0.7), w: 0.9, alpha: 0, closed: true }, base: 1.1, speed: 0.006, x: null },
      ];

      sky.details = [S.sunDisc, S.sunRays, S.moon,
        ...S.stars.map(s => s.det), ...S.clouds.map(c => c.det)];
      return S;
    },
    update(dt, t) {
      const k = PLR.theme.k; // 0 昼 → 1 夜
      const d = PLR.env.time || new Date();
      const h = d.getHours() + d.getMinutes() / 60;
      // 太阳沿弧线随真实时刻（7..19 点）移动
      const dayP = PLR.clamp((h - 7) / 12, 0, 1);
      const sx = -1.85 + dayP * 1.6, sy = 1.25 + Math.sin(dayP * Math.PI) * 1.05;
      const dx = sx - S.sunPos[0], dy = sy - S.sunPos[1];
      if (dx || dy) {
        for (const p of S.sunDisc.pts) { p[0] += dx; p[1] += dy; }
        for (const p of S.sunRays.pts) { p[0] += dx; p[1] += dy; }
        S.sunPos = [sx, sy];
      }
      S.sunDisc.alpha = 0.75 * (1 - k);
      S.sunRays.alpha = 0.5 * (1 - k);
      S.moon.alpha = 0.9 * k;
      for (const s of S.stars) {
        s.det.alpha = (0.25 + 0.65 * Math.max(0, Math.sin(t * 1.4 + s.ph))) * k;
      }
      for (const c of S.clouds) {
        c.det.alpha = 0.45 * (1 - k);
        const span = 2.3;
        const x = -2.1 + (((c.base + t * c.speed) % span) + span) % span;
        const dx = c.x === null ? 0 : x - c.x;
        if (dx && Math.abs(dx) < 0.5) for (const p of c.det.pts) p[0] += dx;
        c.x = x;
      }
    },
  });
})();
