/* 线之屋 · 地球仪：底座/立柱/支架弧 + 倾斜自转的线框球（经纬线 + 大陆） */
(function () {
  const B = RLR.B, STYLE = RLR.STYLE;
  const R = 0.115, C = [0, 0.175, 0], D2R = Math.PI / 180;
  /* 球面点（余纬 th、经度 lo，单位度）→ 对象局部坐标（球心 C） */
  const P = (th, lo) => {
    const t = th * D2R, l = lo * D2R;
    return [C[0] + R * Math.sin(t) * Math.cos(l), C[1] + R * Math.cos(t), C[2] + R * Math.sin(t) * Math.sin(l)];
  };
  /* 手写简化大陆（[经度, 余纬] 闭合环） */
  const LANDS = [
    [[-16, 55], [2, 50], [22, 50], [42, 56], [50, 72], [42, 95], [28, 115], [10, 126], [-6, 112], [-16, 84]],
    [[-8, 52], [12, 42], [40, 33], [72, 30], [105, 34], [135, 42], [152, 55], [138, 66], [108, 70], [72, 66], [38, 60], [8, 58]],
    [[-78, 44], [-62, 50], [-70, 62], [-80, 74], [-70, 90], [-58, 108], [-52, 128], [-68, 134], [-82, 118], [-90, 96], [-98, 70], [-92, 52]],
    [[112, 106], [120, 100], [132, 98], [143, 100], [152, 107], [148, 115], [137, 121], [125, 123], [115, 118], [109, 112]]
  ];
  const circle = (fn, n, o) => {
    const pts = [];
    for (let j = 0; j <= n; j++) pts.push(fn(j / n * Math.PI * 2));
    return B.stroke(pts, o);
  };

  function createGlobe(opts) {
    const o = {
      name: 'globe', label: '地球仪', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      vel: 0, hov: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 底座 + 立柱（不随球转） */
        F.push(...B.cyl([0, 0.009, 0], 0.05, 0.018, { seg: 16 }).faces);
        F.push(...B.cyl([0, 0.06, 0], 0.011, 0.10, { seg: 8 }).faces);
        /* 支架弧（x-y 平面）+ 顶帽/底帽 + 叉腿连线 */
        o._arc = B.arc(C, 0.135, -0.6, Math.PI + 0.6, { axis: 'z', seg: 22, w: 'edge', alpha: 0.85 });
        S.push(o._arc);
        F.push(B.disc([0, C[1] + 0.135, 0], 0.012, { axis: 'z', seg: 10 }));
        F.push(B.disc([0.111, 0.099, 0], 0.010, { axis: 'z', seg: 8 }));
        F.push(B.disc([-0.111, 0.099, 0], 0.010, { axis: 'z', seg: 8 }));
        S.push(B.stroke([[0.111, 0.099, 0], [0.075, 0.012, 0]], { w: 'detail', alpha: 0.7 }));
        S.push(B.stroke([[-0.111, 0.099, 0], [-0.075, 0.012, 0]], { w: 'detail', alpha: 0.7 }));

        /* 部件：引擎对外层先作用 → 用 tilt(parent=spin) 嵌套，合成 rotZ(倾角)∘rotY(自转)，两 pivot 均在球心 */
        o.parts.spin = { pivot: [0, 0.175, 0], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        o.parts.tilt = { pivot: [0, 0.175, 0], yaw: 0, pitch: 0, roll: 0.41, off: [0, 0, 0], parent: 'spin' };
        const TP = 'tilt';
        /* 6 条经线大圆（视觉 12 条半圆） */
        for (let i = 0; i < 6; i++) {
          const lon = i * Math.PI / 6;
          S.push(circle(a => [C[0] + R * Math.sin(a) * Math.cos(lon), C[1] + R * Math.cos(a), C[2] + R * Math.sin(a) * Math.sin(lon)], 24, { w: 'hair', alpha: 0.5, part: TP }));
        }
        /* 纬线 3 圈 */
        for (const th of [30, 90, 150]) {
          const r = R * Math.sin(th * D2R), y = C[1] + R * Math.cos(th * D2R);
          S.push(circle(a => [C[0] + r * Math.cos(a), y, C[2] + r * Math.sin(a)], 24, { w: 'hair', alpha: 0.5, part: TP }));
        }
        /* 大陆 blob */
        for (const land of LANDS) {
          const pts = land.map(([lo, th]) => P(th, lo));
          pts.push(pts[0]);
          S.push(B.stroke(pts, { w: 'hair', alpha: 0.8, part: TP }));
        }
        o.hits.push({ c: [0, 0.175, 0], h: [0.14, 0.145, 0.14] });
      },

      onHover(on) { RLR.Engine.tw(o, 'hov', on ? 1 : 0, 0.3, RLR.E.outCubic); },
      onPress(down) { if (down) { o.vel = Math.min(9, o.vel + 2); RLR.Audio.play('flick'); } },
      action() {
        o.vel = Math.min(9, o.vel + 5.5);
        RLR.Audio.play('flick');
      },
      update(dt, t) {
        o.parts.spin.yaw += o.vel * dt;
        o.vel *= Math.exp(-0.5 * dt);
        o._arc.alpha = 0.85 + 0.15 * o.hov;
        o.parts.tilt.off[1] = 0.008 * o.hov * (0.6 + 0.4 * Math.sin(t * 2.4)); /* 悬停轻浮 */
      }
    };
    return o;
  }
  RLR.createGlobe = createGlobe;
})();
