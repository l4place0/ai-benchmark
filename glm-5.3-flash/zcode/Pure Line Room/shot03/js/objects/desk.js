/* 线之屋 · 书桌：台面/封沿板/四腿/右侧腿柜/抽屉(可拉出)/纸张/钢笔 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;

  /* A5 纸面片：预旋转角点 + 3 行字线（随面附属） */
  function sheet(cx, y, cz, yaw, zb) {
    const rp = (x, z) => { const q = M.rotY([x, 0, z], yaw); return [cx + q[0], y, cz + q[2]]; };
    const f = B.face([rp(-0.105, -0.1485), rp(0.105, -0.1485), rp(0.105, 0.1485), rp(-0.105, 0.1485)],
      { dbl: true, fill: () => STYLE.c('paper'), stroke: 'hair', hatch: false, zBias: zb });
    f.strokes = [];
    for (let i = 0; i < 3; i++) {
      const z = -0.055 + i * 0.05, ln = 0.13 - i * 0.025;
      f.strokes.push({ pts: [rp(-ln / 2, z), rp(ln / 2, z)], w: 'hair', alpha: 0.5 });
    }
    return f;
  }

  function createDesk(opts) {
    const o = {
      name: 'desk', label: '书桌', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      drT: 0, peek: 0, pr: 0,

      build() {
        const F = o.faces;
        /* 台面板：顶面沿口双线 + 3 条缓波木纹（附属线） */
        F.push(...B.box([0, 0.7375, 0], [1.5, 0.045, 0.68], {
          face: (k, f) => {
            if (k !== 'py') return;
            f.stroke = 'outline';
            f.strokes = [];
            for (const [ins, a] of [[0.012, 0.8], [0.026, 0.4]]) {
              const x0 = -0.75 + ins, x1 = 0.75 - ins, z0 = -0.34 + ins, z1 = 0.34 - ins;
              f.strokes.push({ pts: [[x0, 0.7602, z0], [x1, 0.7602, z0], [x1, 0.7602, z1], [x0, 0.7602, z1], [x0, 0.7602, z0]], w: 'detail', alpha: a });
            }
            for (let i = 0; i < 3; i++) {
              const pts = [];
              for (let j = 0; j <= 14; j++) {
                const x = -0.62 + j / 14 * 1.24;
                pts.push([x, 0.7606, -0.16 + i * 0.15 + Math.sin(x * 5.2 + i * 2.4) * 0.008]);
              }
              f.strokes.push({ pts, w: 'hair', alpha: 0.35 });
            }
          }
        }).faces);
        /* 底面封沿板 + 四条桌腿（四角内缩） */
        F.push(...B.box([0, 0.6875, 0], [1.40, 0.055, 0.56]).faces);
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          F.push(...B.box([sx * 0.665, 0.3575, sz * 0.255], [0.05, 0.715, 0.05]).faces);
        /* 右侧腿柜（pz 面留抽屉槽口线） */
        F.push(...B.box([0.53, 0.42, 0], [0.36, 0.60, 0.58], {
          face: (k, f) => {
            if (k !== 'pz') return;
            f.strokes = [{ pts: [[0.38, 0.48, 0.2895], [0.68, 0.48, 0.2895], [0.68, 0.62, 0.2895], [0.38, 0.62, 0.2895], [0.38, 0.48, 0.2895]], w: 'detail', alpha: 0.8 }];
          }
        }).faces);

        /* 抽屉（part 'dr'，off 沿 +z 拉出） */
        o.parts.dr = { pivot: [0.53, 0.55, 0.30], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        const DR = 'dr';
        F.push(...B.box([0.53, 0.55, 0.312], [0.30, 0.14, 0.02], {
          part: DR,
          face: (k, f) => {
            if (k !== 'pz') return;
            f.strokes = [{ pts: [[0.395, 0.495, 0.3225], [0.665, 0.495, 0.3225], [0.665, 0.605, 0.3225], [0.395, 0.605, 0.3225], [0.395, 0.495, 0.3225]], w: 'detail', alpha: 0.7 }];
          }
        }).faces);
        F.push(...B.cyl([0.53, 0.55, 0.35], 0.008, 0.10, { axis: 'z', seg: 8, part: DR }).faces);   /* 拉手横杆 */
        F.push(...B.box([0.388, 0.531, 0.192], [0.008, 0.11, 0.22], { part: DR }).faces);            /* 盒左壁 */
        F.push(...B.box([0.672, 0.531, 0.192], [0.008, 0.11, 0.22], { part: DR }).faces);            /* 盒右壁 */
        F.push(...B.box([0.53, 0.531, 0.086], [0.288, 0.11, 0.008], { part: DR }).faces);            /* 盒后壁 */
        F.push(...B.box([0.53, 0.472, 0.192], [0.30, 0.008, 0.22], { part: DR }).faces);             /* 盒底板 */
        F.push(...B.cyl([0.585, 0.481, 0.175], 0.005, 0.13, { axis: 'z', seg: 6, part: DR, fill: () => STYLE.c2('#c98a3a', '#8a6a48') }).faces);   /* 盒内铅笔 */
        F.push(...B.box([0.585, 0.481, 0.10], [0.035, 0.02, 0.02], { part: DR, fill: () => STYLE.c2('#d8a8a0', '#7a6a70') }).faces);               /* 橡皮 */

        /* 桌面纸张 + 钢笔 + 笔帽环 */
        F.push(sheet(-0.28, 0.762, 0.02, 0.18, 0.005));
        F.push(sheet(-0.22, 0.7635, -0.06, -0.10, 0.006));
        F.push(...B.cyl([-0.02, 0.769, 0.13], 0.006, 0.135, { axis: 'x', seg: 8, fill: () => STYLE.c2('#3f4a5c', '#7d8698') }).faces);
        o.strokes.push(B.arc([0.03, 0.769, 0.13], 0.0068, 0, Math.PI * 2, { axis: 'x', seg: 10, w: 'hair', alpha: 0.8 }));

        /* hits：随抽屉移动的一块 + 静态的一块（防止拉出后点空） */
        o.hits.push({ c: [0.53, 0.55, 0.312], h: [0.17, 0.08, 0.035], part: DR, tag: 'dr' });
        o.hits.push({ c: [0.53, 0.55, 0.31], h: [0.18, 0.09, 0.05], tag: 'dr' });
      },

      onHover(on) { RLR.Engine.tw(o, 'peek', on ? 1 : 0, 0.35, E.outCubic); },
      onPress(down) { if (down) { o.pr = 1; RLR.Engine.tw(o, 'pr', 0, 0.28, E.outQuad); } },
      action() {
        const open = o.drT < 0.5;
        RLR.Audio.play('slide', { dur: 0.5 });
        if (open) {
          RLR.Engine.tw(o, 'drT', 1, 0.7, E.outCubic);
          RLR.Engine.delay(() => RLR.Audio.play('thud', { pitch: 1.4 }), 0.55);
        } else {
          RLR.Engine.tw(o, 'drT', 0, 0.7, E.outCubic, () => RLR.Audio.play('thud', { pitch: 0.9 }));
        }
      },
      update() {
        o.parts.dr.off = [0, 0, 0.24 * o.drT + 0.03 * o.peek - 0.012 * o.pr];
      }
    };
    return o;
  }
  RLR.createDesk = createDesk;
})();
