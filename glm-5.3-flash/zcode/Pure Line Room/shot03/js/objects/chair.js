/* 线之屋 · 椅子：可拉出/推回，坐垫/靠背横档装饰线 */
(function () {
  const B = RLR.B, E = RLR.E;

  function createChair(opts) {
    const o = {
      name: 'chair', label: '椅子', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0.22, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      out: 0, dip: 0,

      build() {
        const F = o.faces;
        /* 坐板（前沿细线）+ 坐垫（顶面沿线） */
        F.push(...B.box([0, 0.45, 0], [0.44, 0.035, 0.42], {
          face: (k, f) => {
            if (k !== 'pz') return;
            f.strokes = [{ pts: [[-0.19, 0.4375, -0.2085], [0.19, 0.4375, -0.2085]], w: 'hair', alpha: 0.6 }];
          }
        }).faces);
        F.push(...B.box([0, 0.4735, 0], [0.40, 0.012, 0.38], {
          face: (k, f) => {
            if (k !== 'py') return;
            f.strokes = [{ pts: [[-0.185, 0.4798, -0.175], [0.185, 0.4798, -0.175], [0.185, 0.4798, 0.175], [-0.185, 0.4798, 0.175], [-0.185, 0.4798, -0.175]], w: 'hair', alpha: 0.55 }];
          }
        }).faces);
        /* 四腿：上粗下细 */
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          F.push(...B.cyl([sx * 0.17, 0.225, sz * 0.16], 0.021, 0.45, { rTop: 0.021, rBot: 0.015, seg: 8 }).faces);
        /* 靠背双立柱 */
        for (const sx of [-1, 1])
          F.push(...B.cyl([sx * 0.18, 0.71, -0.17], 0.016, 0.5, { seg: 8 }).faces);
        /* 上横档 + 下横档（各 2 条装饰线） */
        F.push(...B.box([0, 0.90, -0.17], [0.42, 0.09, 0.026], {
          face: (k, f) => {
            if (k !== 'pz') return;
            f.strokes = [{ pts: [[-0.19, 0.872, -0.1565], [0.19, 0.872, -0.1565]], w: 'hair', alpha: 0.6 },
                         { pts: [[-0.19, 0.928, -0.1565], [0.19, 0.928, -0.1565]], w: 'hair', alpha: 0.6 }];
          }
        }).faces);
        F.push(...B.box([0, 0.70, -0.17], [0.42, 0.05, 0.024], {
          face: (k, f) => {
            if (k !== 'pz') return;
            f.strokes = [{ pts: [[-0.19, 0.689, -0.1575], [0.19, 0.689, -0.1575]], w: 'hair', alpha: 0.6 },
                         { pts: [[-0.19, 0.711, -0.1575], [0.19, 0.711, -0.1575]], w: 'hair', alpha: 0.6 }];
          }
        }).faces);
        o.hits.push({ c: [0, 0.5, 0], h: [0.28, 0.55, 0.28] });
      },

      onHover(on) { RLR.Engine.tw(o, 'pitch', on ? 0.02 : 0, 0.4, E.outCubic); },
      onPress(down) { if (down) { o.dip = 1; RLR.Engine.tw(o, 'dip', 0, 0.35, E.outQuad); } },
      action() {
        const pull = o.out < 0.5;
        RLR.Audio.play('scrape', { dur: 0.4 });
        RLR.Engine.tw(o, 'out', pull ? 1 : 0, 0.6, E.outCubic, () => RLR.Audio.play('thud', { pitch: 0.7 }));
      },
      update() {
        o.off = [0.16 * o.out, -0.008 * o.dip, 0.30 * o.out];
        o.yaw = 0.22 + 0.30 * o.out;
      }
    };
    return o;
  }
  RLR.createChair = createChair;
})();
