/* 线之屋 · 风铃（吊绳 + 木顶盘 + 五铜管：整簇摆动 / 阵风自鸣） */
(function () {
  const B = RLR.B, E = RLR.E;

  function createChime(opts) {
    const o = {
      name: 'chime', label: '风铃', interactive: true,
      pivot: opts.pivot || [2.05, 3.02, -1.90], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      imp: 0, pg: 0, lastRing: -99, sagK: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 整簇摆动部件（绕天花板吊点） */
        o.parts.swing = { pivot: [0, 0, 0], off: [0, 0, 0], pitch: 0, roll: 0 };
        /* 吊绳 + 顶结 + 木顶盘（带厚度） */
        S.push(B.stroke([[0, -0.01, 0], [0, -0.515, 0]], { w: 'edge', part: 'swing' }));
        F.push(B.disc([0, -0.008, 0], 0.016, { axis: 'y', part: 'swing' }));
        F.push(B.disc([0, -0.52, 0], 0.05, { axis: 'y', part: 'swing' }));
        F.push(...B.cyl([0, -0.526, 0], 0.05, 0.012, { seg: 12, part: 'swing' }).faces);
        /* 5 根铜管：挂在顶盘下半径 0.034 圆上，pivot 在管顶，parent 'swing' */
        const LENS = [0.17, 0.20, 0.23, 0.26, 0.29];
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          const px = Math.cos(a) * 0.034, pz = Math.sin(a) * 0.034, L = LENS[i];
          o.parts['tube' + i] = { pivot: [px, -0.55, pz], parent: 'swing', pitch: 0 };
          F.push(...B.cyl([px, -0.55 - L / 2, pz], 0.011, L,
            { seg: 8, sideStroke: true, sideRole: 'hair', part: 'tube' + i }).faces);
          S.push(B.stroke([[px, -0.532, pz], [px, -0.55, pz]], { w: 'hair', alpha: 0.8, part: 'tube' + i }));
        }
        /* 中央击球小盘 + 坠片（挂最长管内侧） */
        S.push(B.stroke([[0, -0.532, 0], [0, -0.66, 0]], { w: 'hair', part: 'swing' }));
        F.push(B.disc([0, -0.675, 0], 0.025, { axis: 'y', part: 'swing' }));
        const qa = 4 * Math.PI * 2 / 5;
        const qx = Math.cos(qa) * 0.02, qz = Math.sin(qa) * 0.02;
        S.push(B.stroke([[qx, -0.532, qz], [qx, -0.70, qz]], { w: 'hair', part: 'swing' }));
        F.push(B.face([[qx + 0.004, -0.70, qz - 0.016], [qx + 0.004, -0.70, qz + 0.016],
          [qx + 0.004, -0.755, qz + 0.016], [qx + 0.004, -0.755, qz - 0.016]],
          { dbl: true, stroke: 'edge', part: 'swing' }));
        o.hits.push({ c: [0, -0.44, 0], h: [0.12, 0.42, 0.12] });
      },

      onHover(on) {
        /* 悬停拂过：轻推让它颤动（imp 进入每管相对摆公式） */
        if (on) o.imp = Math.max(o.imp, 0.35);
      },
      onPress(down) { RLR.Engine.tw(o, 'sagK', down ? 0.01 : 0, 0.3, E.outQuad); },
      action() {
        o.imp = 1;
        RLR.Audio.chime(0.5 + Math.random() * 0.4);
      },

      update(dt, t) {
        const g = RLR.Engine.gustVal();
        /* 阵风自鸣：gust 升破 0.55 且距上次 ≥8s */
        if (o.pg < 0.55 && g >= 0.55 && t - o.lastRing >= 8) { o.lastRing = t; RLR.Audio.chime(0.3); }
        o.pg = g;
        o.imp *= Math.exp(-0.9 * dt);
        const sw = o.parts.swing;
        sw.pitch = 0.02 * Math.sin(t * 1.05) + 0.085 * g * Math.sin(t * 2.6) + 0.20 * o.imp * Math.sin(t * 3.4);
        sw.roll = 0.016 * Math.sin(t * 0.83 + 1) + 0.06 * g * Math.sin(t * 3.1 + 0.7);
        sw.off[1] = -o.sagK;
        for (let i = 0; i < 5; i++) {
          o.parts['tube' + i].pitch = 0.05 * Math.sin(t * 3.0 + i * 1.3) * (0.35 + g + o.imp);
        }
      }
    };
    return o;
  }

  RLR.createChime = createChime;
})();
