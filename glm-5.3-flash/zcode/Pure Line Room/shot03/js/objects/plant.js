/* 线之屋 · 绿植：窗台盆栽，6 片程序差异叶片（风摆/颤动） */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;

  function createPlant(opts) {
    const o = {
      name: 'plant', label: '绿植', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      shiver: 0, hov: 0, _bp: [], _br: [],

      build() {
        const F = o.faces, S = o.strokes;
        /* 盆体 + 沿口 + 土面 + 盆身环纹 */
        F.push(...B.cyl([0, 0.0525, 0], 0.056, 0.105, { rBot: 0.042, rTop: 0.056, seg: 14 }).faces);
        F.push(...B.cyl([0, 0.108, 0], 0.06, 0.014, { seg: 14 }).faces);
        F.push(B.disc([0, 0.112, 0], 0.05, { seg: 16, strokeRole: 'detail', fill: () => STYLE.c2('#4a3b2e', '#33302f') }));
        S.push(B.arc([0, 0.028, 0], 0.0457, 0, Math.PI * 2, { axis: 'y', seg: 14, w: 'hair', alpha: 0.5 }));
        S.push(B.arc([0, 0.075, 0], 0.052, 0, Math.PI * 2, { axis: 'y', seg: 14, w: 'hair', alpha: 0.5 }));

        /* 6 片叶：parts l0..l5，各自 yaw=径向+散乱；弯度/长宽/侧弯逐叶差异 */
        for (let i = 0; i < 6; i++) {
          const pn = 'l' + i;
          o.parts[pn] = { pivot: [0, 0.11, 0], yaw: i * Math.PI / 3 + (M.hash(i * 9.2) - 0.5) * 0.35, pitch: 0, roll: 0, off: [0, 0, 0] };
          o._bp[i] = (M.hash(i * 4.4) - 0.5) * 0.08;
          o._br[i] = (M.hash(i * 6.1) - 0.5) * 0.08;
          const L = 0.20 + 0.10 * M.hash(i * 7.3);
          const W = 0.016 + 0.007 * M.hash(i * 3.1);
          const bend = 0.05 + 0.075 * M.hash(i * 5.7);
          const sw = (M.hash(i * 2.9) - 0.5) * 0.10;
          const N = 4, right = [], left = [];
          for (let s = 0; s <= N; s++) {
            const u = s / N;
            const x = 0.02 + (L - 0.02) * u;
            const y = bend * u * u + (u > 0.85 ? (u - 0.85) * 0.10 : 0);
            const zc = sw * u * u;
            const w = W * (u < 0.15 ? u / 0.15 : 1) * (1 - 0.92 * u * u);
            right.push([x, y, zc + w]);
            left.push([x, y * 0.92, zc - w]);
          }
          const pts = right.slice();
          for (let s = N - 1; s >= 0; s--) pts.push(left[s]);
          const mid = [];
          for (let s = 0; s <= N; s++) {
            const u = s / N;
            mid.push([0.02 + (L - 0.02) * u, bend * u * u + (u > 0.85 ? (u - 0.85) * 0.10 : 0) + 0.002, sw * u * u]);
          }
          const f = B.face(pts, { dbl: true, fill: 'auto', stroke: 'edge', part: pn });
          f.strokes = [{ pts: mid, w: 'hair', alpha: 0.6 }]; /* 中脉 */
          F.push(f);
        }
        o.hits.push({ c: [0, 0.16, 0], h: [0.10, 0.21, 0.10] });
      },

      onHover(on) { RLR.Engine.tw(o, 'hov', on ? 1 : 0, 0.4, E.outCubic); },
      onPress(down) { if (down) o.shiver = Math.max(o.shiver, 0.6); },
      action() {
        o.shiver = 1;
        RLR.Audio.play('rustle');
      },
      update(dt, t) {
        o.shiver *= Math.exp(-2.2 * dt);
        const g = RLR.Engine.gustVal();
        /* 引擎 rotX 铰链是世界 x 轴：按叶片方位角把摆角分解到 pitch/roll，各叶摆幅一致 */
        for (let i = 0; i < 6; i++) {
          const p = o.parts['l' + i];
          const th = 0.025 * Math.sin(t * 1.2 + i * 2.1)
                   + 0.09 * g * Math.sin(t * 2.8 + i * 1.1)
                   + o.shiver * 0.12 * Math.sin(t * 16 + i)
                   + o.hov * 0.01 * Math.sin(t * 1.6);
          p.pitch = o._bp[i] + th * Math.sin(p.yaw);
          p.roll = o._br[i] + th * Math.cos(p.yaw);
        }
      }
    };
    return o;
  }
  RLR.createPlant = createPlant;
})();
