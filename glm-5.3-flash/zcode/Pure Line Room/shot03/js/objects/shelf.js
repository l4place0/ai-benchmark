/* 线之屋 · 书架：框体/四层书列(6 本可拉)/红皮书暗格/顶面小碗·斜靠相框·垂蔓 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;

  const BX = 0.04;                      /* 书列中心 x（书脊近层板前沿） */
  const SY = [0.40, 0.80, 1.20, 1.60];  /* 层板 y */

  const frontDouble = (f, x1, halfZ, yT) => {   /* 板前沿双线 */
    f.strokes = [
      { pts: [[x1 - 0.007, yT + 0.0012, -halfZ], [x1 - 0.007, yT + 0.0012, halfZ]], w: 'detail', alpha: 0.75 },
      { pts: [[x1 - 0.021, yT + 0.0012, -halfZ], [x1 - 0.021, yT + 0.0012, halfZ]], w: 'hair', alpha: 0.4 }
    ];
  };
  const rect = (x, y0, y1, z0, z1, w, a) =>
    ({ pts: [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], [x, y0, z0]], w, alpha: a });

  /* 单本书：c 中心 / th 厚(z) / h 高(y)；px 书脊标题 + py 顶棱线 */
  function bookFaces(c, th, h, seed, part, red, band) {
    return B.box(c, [0.19, h, th], {
      part,
      fill: red ? () => STYLE.c2('#a85448', '#6e4250') : 'auto',
      face: (k, f) => {
        if (k === 'px') {
          const xs = c[0] + 0.0965, yb = c[1] - h / 2;
          const z0 = c[2] - th / 2 + 0.005, z1 = c[2] + th / 2 - 0.005;
          f.strokes = [];
          if (M.hash(seed * 3.7) < 0.5) {          /* 两条短横线 */
            for (const q of [0.64, 0.56])
              f.strokes.push({ pts: [[xs, yb + h * q, z0], [xs, yb + h * q, z1]], w: 'hair', alpha: 0.85 });
          } else {                                 /* 小方块 */
            const y0 = yb + h * 0.58, y1 = y0 + Math.min(0.016, h * 0.07);
            f.strokes.push({ pts: [[xs, y0, z0], [xs, y1, z0], [xs, y1, z1], [xs, y0, z1], [xs, y0, z0]], w: 'hair', alpha: 0.8 });
          }
          if (band) f.strokes.push({ pts: [[xs, yb + h * 0.30, c[2] - th / 2], [xs, yb + h * 0.30, c[2] + th / 2]], w: 'detail', alpha: 0.55 });
        } else if (k === 'py') {
          f.strokes = [{ pts: [[c[0] - 0.07, c[1] + h / 2 + 0.0012, c[2]], [c[0] + 0.07, c[1] + h / 2 + 0.0012, c[2]]], w: 'hair', alpha: 0.45 }];
        }
      }
    }).faces;
  }

  /* 一层书列：从 z=-0.60 起排；pulls {位次(1起): 书号}；lean=末位斜靠 */
  function buildRow(o, row, count, pulls, lean) {
    let z = -0.60;
    for (let i = 1; i <= count; i++) {
      const pull = pulls[i], seed = row * 131 + i * 7;
      const th = pull ? 0.036 + M.hash(seed) * 0.012 : 0.020 + M.hash(seed) * 0.028;
      const h = 0.20 + M.hash(seed + 40) * 0.08;
      const band = i % 3 === 0;
      const cy = SY[row] + 0.011 + h / 2;
      if (pull != null) {
        const zc = z + th / 2, pn = 'bk' + pull;
        o.parts[pn] = { pivot: [BX, cy, zc], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        o.faces.push(...bookFaces([BX, cy, zc], th, h, seed, pn, false, band));
        o.hits.push({ c: [BX, cy, zc], h: [0.11, 0.16, 0.04], part: pn, tag: 'b' + pull });
      } else if (lean && i === count) {
        z += 0.014;                                        /* 斜靠前多留空 */
        const zc = z + th / 2, pn = 'lean' + row;
        o.parts[pn] = { pivot: [BX, cy + 0.002, zc], yaw: 0, pitch: -0.13, roll: 0, off: [0, 0, 0] };
        o.faces.push(...bookFaces([BX, cy + 0.002, zc], th, h, seed, pn, false, band));
      } else {
        o.faces.push(...bookFaces([BX, cy, z + th / 2], th, h, seed, null, false, band));
      }
      z += th + 0.020;
    }
  }

  function createShelf(opts) {
    const o = {
      name: 'shelf', label: '书架', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      pulls: [0, 0, 0, 0, 0, 0],          /* 6 本可拉书 0..1 */
      redT: 0, secT: 0, secTarget: 0, secFound: false,
      hpk: 0, hovTag: null, pr: 0, prTag: null,

      build() {
        const F = o.faces;
        /* 框体：左右侧板（z 两端）/ 顶板 / 底座 / 背板 / 四层板 */
        for (const sz of [-1, 1])
          F.push(...B.box([0, 1.01, sz * 0.6675], [0.32, 2.02, 0.025], {
            strokeRole: 'outline',
            face: (k, f) => {
              if (k !== 'pz' || sz > 0) return;            /* 后端侧板内面木纹 */
              f.strokes = [];
              for (let i = 0; i < 2; i++) {
                const pts = [];
                for (let j = 0; j <= 8; j++) {
                  const y = 0.10 + (j / 8) * 1.82;
                  pts.push([0.16 - 0.024 - i * 0.05, y, -0.6548 + Math.sin(y * 5.5 + i * 2.2) * 0.004]);
                }
                f.strokes.push({ pts, w: 'hair', alpha: 0.28 });
              }
            }
          }).faces);
        F.push(...B.box([0, 2.005, 0], [0.32, 0.03, 1.40], {
          strokeRole: 'outline',
          face: (k, f) => { if (k === 'py') frontDouble(f, 0.152, 0.69, 2.02); }
        }).faces);
        F.push(...B.box([0, 0.04, 0], [0.32, 0.08, 1.40], { strokeRole: 'outline' }).faces);
        F.push(...B.box([-0.15, 1.02, 0], [0.018, 1.90, 1.32]).faces);
        for (const y of SY)
          F.push(...B.box([0, y, 0], [0.30, 0.022, 1.32], {
            face: (k, f) => { if (k === 'py') frontDouble(f, 0.143, 0.65, y + 0.011); }
          }).faces);

        /* 四层书列（b1..b6 分布于 2-4 层；第 1、4 层末位斜靠） */
        buildRow(o, 0, 9, {}, true);
        buildRow(o, 1, 8, { 2: 1, 6: 2 }, false);
        buildRow(o, 2, 8, { 2: 3, 6: 4 }, false);
        buildRow(o, 3, 8, { 3: 5, 7: 6 }, true);

        /* 红皮书（y=0.80 层最右端，正对暗格；fill 红点缀色） */
        o.parts.bkR = { pivot: [BX, 0.811 + 0.13, 0.5], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...bookFaces([BX, 0.941, 0.5], 0.05, 0.26, 777, 'bkR', true, false));
        o.hits.push({ c: [BX, 0.941, 0.5], h: [0.11, 0.16, 0.05], part: 'bkR', tag: 'red' });

        /* 暗格：off x -0.10 藏于墙内面之后 → -0.02 显于墙面前 */
        o.parts.sec = { pivot: [-0.10, 0.91, 0.5], yaw: 0, pitch: 0, roll: 0, off: [-0.10, 0, 0] };
        const ry0 = 0.815, ry1 = 1.055, rz0 = 0.43, rz1 = 0.57, rx = -0.055;
        const rc = B.face([[rx, ry0, rz0], [rx, ry1, rz0], [rx, ry1, rz1], [rx, ry0, rz1]],
          { part: 'sec', fill: () => STYLE.c2('#3a3630', '#20232b'), stroke: null, hatch: false, dbl: true, zBias: 0.006 });
        rc.strokes = [
          rect(rx + 0.001, ry0, ry1, rz0, rz1, 'detail', 0.9),
          rect(rx + 0.0015, ry0 + 0.013, ry1 - 0.013, rz0 + 0.013, rz1 - 0.013, 'hair', 0.45)
        ];
        F.push(rc);
        /* 纸片：五角星 + 两行小字 */
        const nt = B.face([[rx + 0.008, 0.895, 0.445], [rx + 0.008, 0.975, 0.445], [rx + 0.008, 0.975, 0.555], [rx + 0.008, 0.895, 0.555]],
          { part: 'sec', fill: () => STYLE.c('paper'), stroke: 'hair', dbl: true, hatch: false, zBias: 0.012 });
        const star = [];
        for (let k = 0; k <= 5; k++) {
          const j = (k * 2) % 5, a = Math.PI / 2 + (j * 2 * Math.PI) / 5;
          star.push([rx + 0.0085, 0.952 + 0.02 * Math.sin(a), 0.5 + 0.02 * Math.cos(a)]);
        }
        nt.strokes = [
          { pts: star, w: 'hair', alpha: 0.9 },
          { pts: [[rx + 0.0085, 0.918, 0.468], [rx + 0.0085, 0.918, 0.532]], w: 'hair', alpha: 0.6 },
          { pts: [[rx + 0.0085, 0.908, 0.478], [rx + 0.0085, 0.908, 0.522]], w: 'hair', alpha: 0.5 }
        ];
        F.push(nt);
        o.hits.push({ c: [-0.06, 0.91, 0.52], h: [0.05, 0.13, 0.08], tag: 'sec' });

        /* 顶面：小碗（frustum + 口沿 + 内腔暗面） */
        F.push(...B.cyl([-0.02, 2.04, 0.4], 0.03, 0.045, { rTop: 0.05, seg: 12, cap: false }).faces);
        F.push(B.disc([-0.02, 2.0635, 0.4], 0.05, { axis: 'y', seg: 16 }));
        F.push(B.disc([-0.02, 2.0645, 0.4], 0.038, { axis: 'y', seg: 16, fill: () => STYLE.c('shade'), stroke: null, hatch: false, zBias: 0.002 }));

        /* 顶面：斜靠小相框（后仰靠背板面）+ 内画线 */
        o.parts.frame = { pivot: [-0.070, 2.022, -0.35], yaw: 0, pitch: 0, roll: 0.19, off: [0, 0, 0] };
        F.push(...B.box([-0.060, 2.10, -0.35], [0.02, 0.16, 0.12], {
          part: 'frame',
          face: (k, f) => {
            if (k !== 'px') return;
            f.strokes = [
              rect(-0.049, 2.040, 2.160, -0.392, -0.308, 'hair', 0.8),
              { pts: [[-0.0485, 2.062, -0.388], [-0.0485, 2.112, -0.336]], w: 'hair', alpha: 0.7 },
              { pts: [[-0.0485, 2.100, -0.384], [-0.0485, 2.130, -0.384]], w: 'hair', alpha: 0.6 }
            ];
          }
        }).faces);

        /* 顶板前沿垂蔓 ×3（update 中随风轻摆） */
        for (let i = 0; i < 3; i++) {
          const vz = 0.30 + i * 0.11, pn = 'vine' + i;
          o.parts[pn] = { pivot: [0.14, 2.015, vz], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
          const pts = [];
          for (let j = 0; j <= 6; j++) {
            const u = j / 6;
            pts.push([0.145 + 0.02 * Math.sin(u * Math.PI), 2.015 - u * 0.16, vz + 0.028 * Math.sin(u * 4.2 + i * 2.1)]);
          }
          o.strokes.push(B.stroke(pts, { w: 'hair', alpha: 0.75, part: pn }));
          for (let j = 1; j <= 3; j++) {
            const u = j / 4;
            const px = 0.145 + 0.02 * Math.sin(u * Math.PI), py = 2.015 - u * 0.16, pz = vz + 0.028 * Math.sin(u * 4.2 + i * 2.1);
            o.strokes.push(B.stroke([[px, py, pz], [px + 0.02, py - 0.014, pz + 0.016 * Math.sin(i * 3.1 + j)]], { w: 'hair', alpha: 0.5, part: pn }));
          }
        }
      },

      onHover(on, tag) {
        const book = on && (/^b[1-6]$/.test(tag) || tag === 'red') ? tag : null;
        if (book) o.hovTag = book;
        RLR.Engine.tw(o, 'hpk', book ? 1 : 0, 0.22, E.outCubic);   /* 对应书探出 0.02 */
      },
      onPress(down, tag) {
        if (down) { o.prTag = tag; o.pr = 1; RLR.Engine.tw(o, 'pr', 0, 0.3, E.outQuad); }
        else o.prTag = null;
      },
      action(tag) {
        if (/^b[1-6]$/.test(tag)) {
          const i = +tag[1] - 1, out = o.pulls[i] < 0.5;
          RLR.Engine.tw(o.pulls, i, out ? 1 : 0, 0.5, E.outCubic);
          RLR.Audio.play(out ? 'flick' : 'slide', out ? null : { dur: 0.2 });
        } else if (tag === 'red') {
          const out = o.redT < 0.5;
          RLR.Engine.tw(o, 'redT', out ? 1 : 0, 0.5, E.outCubic);
          RLR.Audio.play(out ? 'flick' : 'slide', out ? null : { dur: 0.2 });
        } else if (tag === 'sec') {                        /* 收回红皮书 + 暗格 */
          if (o.redT > 0.05 || o.secT > 0.05) {
            o.secTarget = 0;
            if (o.redT > 0.05) RLR.Engine.tw(o, 'redT', 0, 0.45, E.outCubic);
            RLR.Engine.tw(o, 'secT', 0, 0.4, E.outQuad);
            RLR.Audio.play('slide', { dur: 0.2 });
          }
        }
      },

      update(dt, t) {
        for (let i = 1; i <= 6; i++) {
          let x = 0.12 * o.pulls[i - 1];
          if (o.hovTag === 'b' + i) x += 0.02 * o.hpk;
          if (o.prTag === 'b' + i) x -= 0.014 * o.pr;
          o.parts['bk' + i].off = [x, 0, 0];
        }
        let rx = 0.20 * o.redT;
        if (o.hovTag === 'red') rx += 0.02 * o.hpk;
        if (o.prTag === 'red') rx -= 0.014 * o.pr;
        o.parts.bkR.off = [rx, 0, 0];
        o.parts.sec.off = [-0.10 + 0.08 * o.secT, 0, 0];
        /* 红皮书完全拉出 → 暗格弹出（首次 sparkle+toast）；推回 → 缩回 */
        if (o.redT > 0.97 && o.secTarget !== 1) {
          o.secTarget = 1;
          RLR.Engine.tw(o, 'secT', 1, 0.55, E.outCubic);
          RLR.Audio.play(o.secFound ? 'latch' : 'sparkle');
          if (!o.secFound) { o.secFound = true; RLR.Engine.toast('✦ 书架的暗格打开了'); }
        } else if (o.redT < 0.5 && o.secTarget !== 0) {
          o.secTarget = 0;
          RLR.Engine.tw(o, 'secT', 0, 0.4, E.outQuad);
        }
        /* 垂蔓随风 */
        const g = 0.4 + RLR.Engine.gustVal();
        for (let i = 0; i < 3; i++)
          o.parts['vine' + i].pitch = 0.055 * g * Math.sin(t * (0.9 + i * 0.23) + i * 2.1);
      }
    };
    return o;
  }

  RLR.createShelf = createShelf;
})();
