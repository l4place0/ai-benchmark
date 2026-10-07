/* 线之屋 · 挂钟：盘壳/刻度/数字/实时三针/按压回弹/敲击摆动/挂环轻晃 */
(function () {
  const B = RLR.B, E = RLR.E, STYLE = RLR.STYLE;
  const TAU = Math.PI * 2;

  function createClock(opts) {
    const o = {
      name: 'clock', label: '挂钟', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      wob: 0, sq: 0, ringA: 0, _ls: -1, _secStroke: null,

      build() {
        const F = o.faces, S = o.strokes, T = o.texts, CP = 'case';
        o.parts[CP] = { pivot: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0], scale: [1, 1, 1] };
        o.parts.hh = { pivot: [0, 0, 0.008], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0], parent: CP };
        o.parts.mh = { pivot: [0, 0, 0.012], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0], parent: CP };
        o.parts.sh = { pivot: [0, 0, 0.016], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0], parent: CP };
        o.parts.ring = { pivot: [0, 0.195, 0], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };

        /* 外盘 / 内盘 / 挂环 */
        F.push(B.disc([0, 0, 0], 0.195, { axis: 'z', seg: 28, fill: 'auto', strokeRole: 'outline', part: CP }));
        const dial = B.disc([0, 0, 0], 0.165, { axis: 'z', seg: 28, fill: () => STYLE.c('paper'), strokeRole: 'edge', hatch: false, part: CP });
        dial.zBias = 0.001;
        F.push(dial);
        F.push(B.disc([0, 0.215, 0], 0.018, { axis: 'z', seg: 12, fill: null, strokeRole: 'edge', part: 'ring' }));

        /* 刻度：4 主 + 8 副 */
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12, main = i % 3 === 0;
          const r0 = main ? 0.134 : 0.147, r1 = 0.163;
          const dx = Math.sin(a), dy = Math.cos(a);
          S.push(B.stroke([[dx * r0, dy * r0, 0.004], [dx * r1, dy * r1, 0.004]],
            { w: main ? 'detail' : 'hair', alpha: main ? 0.95 : 0.65, part: CP, zBias: 0.005 }));
        }
        /* 数字 12/3/6/9 */
        for (const [s, nx, ny] of [['12', 0, 1], ['3', 1, 0], ['6', 0, -1], ['9', -1, 0]])
          T.push(B.text([nx * 0.115, ny * 0.115, 0.004], s, 0.042, { part: CP, zBias: 0.005 }));

        /* 三针（几何沿 +y；roll = -角度）+ 中心销帽 */
        S.push(B.stroke([[0, -0.02, 0.008], [0, 0.085, 0.008]], { w: 'edge', part: 'hh' }));
        S.push(B.stroke([[0, -0.022, 0.012], [0, 0.135, 0.012]], { w: 'detail', part: 'mh' }));
        o._secStroke = B.stroke([[0, -0.03, 0.016], [0, 0.15, 0.016]], { w: 'hair', part: 'sh' });
        S.push(o._secStroke);
        const cap = B.disc([0, 0, 0.017], 0.011, { axis: 'z', seg: 12, fill: () => STYLE.c('ink'), stroke: false, hatch: false, part: CP });
        cap.zBias = 0.006;
        F.push(cap);

        o.hits.push({ c: [0, 0, 0.01], h: [0.21, 0.21, 0.035] });
      },

      onHover(on) { RLR.Engine.tw(o, 'ringA', on ? 1 : 0, 0.45, E.outCubic); },
      onPress(down) {
        if (down) { o.sq = 1; RLR.Audio.play('click'); RLR.Engine.tw(o, 'sq', 0, 0.38, E.outQuad); }
      },
      action() { o.wob = 1; RLR.Audio.play('tink', { f: 660 }); },

      update(dt, t) {
        /* 实时三针 */
        const d = RLR.Engine.env.time;
        const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
        o.parts.sh.roll = -(s / 60) * TAU;
        o.parts.mh.roll = -(m / 60) * TAU;
        o.parts.hh.roll = -(h / 12) * TAU;
        if (s !== o._ls) { o._ls = s; RLR.Audio.tick(); }
        o._secStroke.col = STYLE.c2('#a85448', '#8a5a70');   /* stroke.col 需为字符串，逐帧刷新 */
        /* 按压缩放回弹 + 敲击摆动 + 挂环轻晃 */
        const k = 1 - 0.02 * o.sq;
        o.parts['case'].scale = [k, k, k];
        o.roll = 0.05 * o.wob * Math.sin(t * 15);
        o.wob *= Math.exp(-2 * dt);
        o.parts.ring.roll = 0.16 * o.ringA * Math.sin(t * 3.2);
      }
    };
    return o;
  }

  RLR.createClock = createClock;
})();
