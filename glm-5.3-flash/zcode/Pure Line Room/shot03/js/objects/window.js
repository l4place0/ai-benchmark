/* 线之屋 · 窗帘（帘杆 + 双片布帘：开合 / 微摆 / 阵风） */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E;

  function createCurtains(opts) {
    const o = {
      name: 'curtains', label: '窗帘', interactive: true,
      pivot: opts.pivot || [0.95, 0, -2.13], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      open: true, t: 1, hrollL: 0, hrollR: 0, pull: 0, pullTag: null,

      build() {
        const F = o.faces;
        /* 帘杆 + 两端球头 + 支架短杆到墙 */
        F.push(...B.cyl([0, 2.44, 0], 0.012, 2.14, { axis: 'x', seg: 10 }).faces);
        F.push(B.disc([-1.07, 2.44, 0], 0.02, { axis: 'x' }));
        F.push(B.disc([1.07, 2.44, 0], 0.02, { axis: 'x' }));
        for (const sx of [-0.98, 0.98]) {
          F.push(...B.cyl([sx, 2.44, -0.035], 0.008, 0.08, { axis: 'z', seg: 8 }).faces);
          F.push(B.disc([sx, 2.44, -0.068], 0.016, { axis: 'z' }));
        }
        /* 两片帘：pivot 挂在杆上（局部 x ∓0.48, y 2.44），初始闭合盖住窗洞 */
        o.parts.pl = { pivot: [-0.48, 2.44, 0], off: [0.05, 0, 0], roll: 0, scale: [1, 1, 1] };
        o.parts.pr = { pivot: [0.48, 2.44, 0], off: [-0.05, 0, 0], roll: 0, scale: [1, 1, 1] };
        F.push(panel(-0.48, 0.9, 'pl'), panel(0.48, 2.3, 'pr'));
        /* hits 用部件局部坐标（随 off/scale 自动跟随开合） */
        o.hits.push({ c: [-0.48, 1.55, 0], h: [0.5, 0.94, 0.08], part: 'pl', tag: 'pl' });
        o.hits.push({ c: [0.48, 1.55, 0], h: [0.5, 0.94, 0.08], part: 'pr', tag: 'pr' });
      },

      onHover(on) {
        /* 悬停：两片轻微反向 roll 摆（标量补间，update 里与常微摆合成） */
        RLR.Engine.tw(o, 'hrollL', on ? 0.02 : 0, 0.5, E.outBack);
        RLR.Engine.tw(o, 'hrollR', on ? -0.02 : 0, 0.5, E.outBack);
      },
      onPress(down, tag) {
        o.pullTag = tag || o.pullTag;
        RLR.Engine.tw(o, 'pull', down ? 0.012 : 0, 0.2, E.outQuad);
      },
      action() {
        o.open = !o.open;
        RLR.Engine.tw(o, 't', o.open ? 1 : 0, 0.9, E.inOutCubic);
        RLR.Audio.play('cloth', { dur: 0.55 });
      },

      update(dt, t) {
        const g = RLR.Engine.gustVal(), k = o.t;
        const pl = o.parts.pl, pr = o.parts.pr;
        pl.off[0] = M.lerp(0.05, -0.37, k);            /* 闭合中心 ∓0.43 ↔ 收拢 ±0.85 */
        pr.off[0] = M.lerp(-0.05, 0.37, k);
        pl.scale[0] = pr.scale[0] = M.lerp(1, 0.55, k); /* 收拢时横向压缩 */
        pl.off[2] = o.pullTag === 'pl' ? o.pull : 0;
        pr.off[2] = o.pullTag === 'pr' ? o.pull : 0;
        /* 常微摆 + 阵风 */
        pl.roll = o.hrollL + 0.012 * Math.sin(t * 1.7 + 0.9) + 0.05 * g * Math.sin(t * 2.3 + 0.9);
        pr.roll = o.hrollR + 0.012 * Math.sin(t * 1.7 + 2.3) + 0.05 * g * Math.sin(t * 2.3 + 2.3);
      }
    };

    /* 一片帘：cx = 杆上 pivot 的局部 x，ph = 波浪相位，part = 部件名。
       几何为对象坐标（宽 0.86，y 2.42→0.70，上缘平直、下缘 7 段微波浪） */
    function panel(cx, ph, part) {
      const f = B.face(panelPts(cx, ph), { dbl: true, stroke: 'outline', part });
      f.strokes = [];
      for (let k = 1; k <= 5; k++) {          /* 5 条竖向褶皱，z 微波动显布褶 */
        const x = cx - 0.43 + 0.86 * k / 6, pts = [];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          pts.push([x + 0.006 * Math.sin(u * 5 + k), M.lerp(2.42, 0.70, u),
            0.02 * Math.sin(u * 4.2 + k * 1.3 + ph)]);
        }
        f.strokes.push({ pts, w: 'hair', alpha: 0.55 });
      }
      return f;
    }
    function panelPts(cx, ph) {
      const pts = [[cx - 0.43, 2.42, 0], [cx + 0.43, 2.42, 0]];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7, x = cx + 0.43 - 0.86 * u;
        pts.push([x, 0.70 + 0.03 * Math.sin(u * 9.4 + ph), 0.014 * Math.sin(u * 7.1 + ph * 1.7)]);
      }
      return pts;
    }

    return o;
  }

  RLR.createCurtains = createCurtains;
})();
