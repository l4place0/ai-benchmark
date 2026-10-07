/* 线之屋 · 茶杯：碟/杯体/茶面/把手 + 持续蒸汽（4 条动态 stroke） */
(function () {
  const B = RLR.B, E = RLR.E, STYLE = RLR.STYLE;

  function createCup(opts) {
    const o = {
      name: 'cup', label: '茶杯', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      burst: 0, hop: 0, dip: 0, hb: 0, _steam: [],

      build() {
        const F = o.faces, S = o.strokes;
        /* 碟 + 沿线 */
        F.push(...B.cyl([0, 0.005, 0], 0.062, 0.01, { seg: 18 }).faces);
        S.push(B.arc([0, 0.0105, 0], 0.062, 0, Math.PI * 2, { axis: 'y', seg: 22, w: 'detail', alpha: 0.8 }));
        S.push(B.arc([0, 0.0108, 0], 0.044, 0, Math.PI * 2, { axis: 'y', seg: 18, w: 'hair', alpha: 0.5 }));
        /* 杯体（frustum，口朝上）+ 2 条环线 */
        F.push(...B.cyl([0, 0.056, 0], 0.043, 0.092, { rBot: 0.031, rTop: 0.043, seg: 16, cap: false, capB: false }).faces);
        S.push(B.arc([0, 0.045, 0], 0.0356, 0, Math.PI * 2, { axis: 'y', seg: 16, w: 'hair', alpha: 0.5 }));
        S.push(B.arc([0, 0.075, 0], 0.0395, 0, Math.PI * 2, { axis: 'y', seg: 16, w: 'hair', alpha: 0.5 }));
        /* 茶面（杯口内）+ 内壁弧 2 条 */
        F.push(B.disc([0, 0.096, 0], 0.0435, { seg: 18, strokeRole: 'hair', fill: () => STYLE.c2('#4a3f33', '#3a3f4a') }));
        for (const phi of [2.3, 4.1]) {
          const pts = [];
          for (let i = 0; i <= 4; i++) {
            const y = 0.078 + i * 0.0045, r = 0.031 + 0.012 * (y - 0.01) / 0.092 - 0.0015;
            pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
          }
          S.push(B.stroke(pts, { w: 'hair', alpha: 0.45 }));
        }
        /* 把手：x-y 平面向 +x 鼓出的双弧 + 端点连接线 */
        S.push(B.arc([0.036, 0.06, 0], 0.026, -1.047, 1.047, { axis: 'z', seg: 10, w: 'detail' }));
        S.push(B.arc([0.036, 0.06, 0], 0.019, -1.047, 1.047, { axis: 'z', seg: 10, w: 'detail' }));
        const cn = (a, b) => S.push(B.stroke([a, b], { w: 'detail', alpha: 0.9 }));
        cn([0.049, 0.0825, 0], [0.0455, 0.0765, 0]);
        cn([0.049, 0.0375, 0], [0.0455, 0.0435, 0]);
        cn([0.0455, 0.0765, 0], [0.0397, 0.0745, 0]);
        cn([0.0455, 0.0435, 0], [0.0356, 0.0455, 0]);
        /* 蒸汽 stroke ×4（第 4 条仅 burst 时可见），pts/alpha 每帧重算 */
        for (let i = 0; i < 4; i++) {
          const st = B.stroke([[0, 0.115, 0]], { w: 'hair', col: null, alpha: 0, zBias: 0.012 });
          o._steam.push(st); S.push(st);
        }
        o.hits.push({ c: [0, 0.05, 0], h: [0.075, 0.085, 0.075] });
      },

      onPress(down) { if (down) { o.dip = 1; RLR.Engine.tw(o, 'dip', 0, 0.3, E.outQuad); o.burst = Math.max(o.burst, 0.5); } },
      action() {
        o.burst = 1;
        o.hop = 1; RLR.Engine.tw(o, 'hop', 0, 0.5, E.outBack);
        RLR.Audio.play('tink', { f: 2350 });
      },
      update(dt, t) {
        o.hb += ((o.hover ? 1 : 0) - o.hb) * (1 - Math.exp(-dt * 6)); /* hover 增幅缓动 */
        o.burst *= Math.exp(-1.2 * dt);
        o.off[1] = 0.014 * Math.sin(o.hop * Math.PI) - 0.005 * o.dip;
        for (let i = 0; i < 4; i++) {
          const bOnly = i === 3;
          const amp = 0.018 * (1 + 0.3 * o.hb) * (1 + 1.6 * o.burst) * (bOnly ? 1.5 : 1);
          const pts = [];
          for (let j = 0; j < 7; j++) {
            const h = j / 6;
            pts.push([
              Math.sin(h * 7 - t * 2.2 + i * 2.1) * amp * (0.3 + h),
              0.115 + h * 0.5,
              Math.cos(h * 5 - t * 1.7 + i) * amp * 0.65 * (0.3 + h)
            ]);
          }
          const pulse = 0.55 + 0.45 * Math.sin(((t * 0.24 + i * 0.37) % 1) * Math.PI);
          const al = bOnly
            ? (o.burst > 0.15 ? 0.5 * o.burst * pulse : 0)
            : 0.34 * 0.7 * pulse * (1 + 0.8 * o.burst);
          const st = o._steam[i];
          st.pts = pts; st.alpha = Math.min(1, al);
        }
      }
    };
    return o;
  }
  RLR.createCup = createCup;
})();
