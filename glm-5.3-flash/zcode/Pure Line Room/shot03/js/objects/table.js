/* 线之屋 · 茶几：双层板/四腿/横撑 + 可翻书(封面开合) + 粗陶碗 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;
  const BOOK_YAW = 0.35;

  function createTable(opts) {
    const o = {
      name: 'table', label: '茶几', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      bookT: 0, hov: 0, pr: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 顶板（顶面边缘双线）+ 下层板 + 四腿 + 两横撑 */
        F.push(...B.box([0, 0.4025, 0], [0.85, 0.035, 0.55], {
          face: (k, f) => {
            if (k !== 'py') return;
            f.strokes = [];
            for (const [ins, a] of [[0.014, 0.7], [0.03, 0.4]]) {
              f.strokes.push({ pts: [[-0.425 + ins, 0.4205, -0.275 + ins], [0.425 - ins, 0.4205, -0.275 + ins], [0.425 - ins, 0.4205, 0.275 - ins], [-0.425 + ins, 0.4205, 0.275 - ins], [-0.425 + ins, 0.4205, -0.275 + ins]], w: 'hair', alpha: a });
            }
          }
        }).faces);
        F.push(...B.box([0, 0.15, 0], [0.72, 0.02, 0.45]).faces);
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          F.push(...B.cyl([sx * 0.36, 0.20, sz * 0.21], 0.019, 0.40, { rBot: 0.014, seg: 10 }).faces);
        for (const sz of [-1, 1])
          F.push(...B.box([0, 0.14, sz * 0.21], [0.72, 0.03, 0.03]).faces);

        /* ---- 书 part 'bk'（object-local 已含 0.35 偏航的姿态基准）---- */
        o.parts.bk = { pivot: [-0.12, 0.443, 0.02], yaw: BOOK_YAW, pitch: 0, roll: 0, off: [0, 0, 0] };
        const BC = [-0.12, 0.443, 0.02];
        F.push(...B.box(BC, [0.20, 0.022, 0.15], {
          part: 'bk',
          face: (k, f) => {
            if (k === 'py') {                      /* 内页：纸色 + 小杯简笔 + 3 波线 */
              f.fill = () => STYLE.c('paper');
              f.hatch = false;
              f.strokes = [
                { pts: [[-0.185, 0.4545, 0.005], [-0.185, 0.4545, 0.035], [-0.155, 0.4545, 0.035], [-0.155, 0.4545, 0.005], [-0.185, 0.4545, 0.005]], w: 'hair', alpha: 0.8 },
                { pts: [[-0.155, 0.4545, 0.012], [-0.148, 0.4545, 0.014], [-0.155, 0.4545, 0.022], [-0.150, 0.4545, 0.026]], w: 'hair', alpha: 0.7 },
                { pts: [[-0.183, 0.4545, -0.008], [-0.157, 0.4545, -0.008]], w: 'hair', alpha: 0.6 }
              ];
              for (let i = 0; i < 3; i++) {
                const pts = [];
                for (let j = 0; j <= 10; j++) {
                  const x = -0.13 + j / 10 * 0.09;
                  pts.push([x, 0.4545, -0.03 + i * 0.035 + Math.sin(j * 1.4 + i) * 0.005]);
                }
                f.strokes.push({ pts, w: 'hair', alpha: 0.55 });
              }
            } else if (k === 'nz') {               /* 书脊 */
              f.stroke = 'edge';
              f.strokes = [{ pts: [[-0.212, 0.443, -0.0565], [-0.028, 0.443, -0.0565]], w: 'detail', alpha: 0.8 }];
            } else if (k === 'px') {               /* 页口 */
              f.strokes = [];
              for (let i = 0; i < 3; i++)
                f.strokes.push({ pts: [[-0.0195, 0.437 + i * 0.005, -0.05], [-0.0195, 0.437 + i * 0.005, 0.09]], w: 'hair', alpha: 0.5 });
            }
          }
        }).faces);

        /* 封面 part 'cov'（parent 'bk'，铰链在书脊边；roll→pitch 修正：绕书脊 x 向棱轴开合） */
        o.parts.cov = { parent: 'bk', pivot: [-0.1457, 0.456, -0.0505], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...B.box([-0.12, 0.456, 0.02], [0.20, 0.004, 0.15], {
          part: 'cov',
          face: (k, f) => {
            if (k !== 'py' && k !== 'nz') return;
            if (k === 'py') f.strokes = [{ pts: [[-0.205, 0.4585, -0.040], [-0.035, 0.4585, -0.040], [-0.035, 0.4585, 0.080], [-0.205, 0.4585, 0.080], [-0.205, 0.4585, -0.040]], w: 'hair', col: '#a08048', alpha: 0.9 }];
            else f.stroke = 'edge';
          }
        }).faces);

        /* ---- 粗陶碗 ---- */
        F.push(...B.cyl([0.20, 0.444, -0.08], 0.028, 0.048, { rTop: 0.052, seg: 14, cap: false }).faces);
        F.push(B.disc([0.20, 0.4685, -0.08], 0.052, { seg: 16, fill: null, strokeRole: 'detail' }));
        F.push(B.disc([0.20, 0.4202, -0.08], 0.030, { seg: 12, fill: null, strokeRole: 'hair', zBias: 0.001 }));
        for (const [y0, r] of [[0.452, 0.047], [0.445, 0.043]])
          S.push(B.arc([0.20, y0, -0.08], r, 0.5, 1.6, { axis: 'y', seg: 8, w: 'hair', alpha: 0.6 }));

        o.hits.push({ c: [-0.12, 0.44, 0.02], h: [0.14, 0.05, 0.11], part: 'bk', tag: 'book' });
        o.hits.push({ c: [-0.12, 0.456, 0.02], h: [0.12, 0.09, 0.10], part: 'cov', tag: 'book' });
      },

      onHover(on) { RLR.Engine.tw(o, 'hov', on ? 1 : 0, 0.3, E.outCubic); },
      onPress(down) { if (down) { o.pr = 1; RLR.Engine.tw(o, 'pr', 0, 0.3, E.outQuad); } },
      action() {
        const open = o.bookT < 0.5;
        RLR.Audio.play('flip');
        RLR.Engine.tw(o, 'bookT', open ? 1 : 0, 0.7, open ? E.outBack : E.inOutCubic);
      },

      update() {
        o.parts.cov.pitch = -(0.06 * o.hov + 2.05 * o.bookT);
        o.parts.bk.off = [0, 0.004 * Math.sin(o.pr * Math.PI), 0];
      }
    };
    return o;
  }
  RLR.createTable = createTable;
})();
