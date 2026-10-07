/* 线之屋 · 台灯：弯臂灯头(roll 0.85 甩向 +x 桌面上方)/灯泡/拉绳/光池，负责 light.lampPos 与 lampI */
(function () {
  const B = RLR.B, E = RLR.E, STYLE = RLR.STYLE;
  const ROLL = 1.25, SN = Math.sin(ROLL), CS = Math.cos(ROLL);

  function createLamp(opts) {
    const o = {
      name: 'lamp', label: '台灯', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      on: false, bounce: 0, hov: 0, li: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 底座 puck + 小圆顶 + 立杆 + 弯头 */
        F.push(...B.cyl([0, 0.011, 0], 0.075, 0.022, { seg: 18 }).faces);
        F.push(...B.cyl([0, 0.037, 0], 0.06, 0.03, { rTop: 0.03, rBot: 0.06, seg: 18 }).faces);
        F.push(...B.cyl([0, 0.16, 0], 0.011, 0.30, { seg: 8 }).faces);
        F.push(B.disc([0, 0.31, 0], 0.016, { seg: 10 }));

        /* head 部件（pivot=弯头旋转中心，几何为对象局部坐标） */
        o.parts.head = { pivot: [0, 0.31, 0], yaw: 0, pitch: 0, roll: ROLL, off: [0, 0, 0] };
        const HP = 'head';
        F.push(...B.cyl([0, 0.18, 0], 0.010, 0.26, { seg: 8, part: HP }).faces);                            /* 上臂 */
        F.push(...B.cyl([0, 0.01, 0], 0.085, 0.095, { rTop: 0.032, rBot: 0.085, seg: 16, cap: false, capB: false, part: HP }).faces); /* 灯罩 */
        S.push(B.arc([0, -0.0375, 0], 0.085, 0, Math.PI * 2, { axis: 'y', seg: 20, w: 'edge', part: HP })); /* 罩口沿（线圆，不封面） */
        F.push(B.disc([0, 0.0575, 0], 0.032, { seg: 12, part: HP }));                                       /* 罩顶小盘 */
        S.push(B.arc([0, 0.02, 0], 0.053, 0, Math.PI * 2, { axis: 'y', seg: 16, w: 'hair', alpha: 0.6, part: HP }));
        S.push(B.arc([0, -0.01, 0], 0.070, 0, Math.PI * 2, { axis: 'y', seg: 16, w: 'hair', alpha: 0.6, part: HP }));
        o._bulb = B.disc([0, 0.04, 0], 0.03, { seg: 12, part: HP, stroke: false, fill: () => STYLE.c2('#f2d38a', '#e8c27a') });
        o._bulb.alpha = 0.25;
        F.push(o._bulb);
        /* 拉绳：局部方向取 rotZ(-ROLL)·(0,-1,0)，旋转后在世界内垂直；末端小珠 */
        const d = [-SN, -CS, 0], p0 = [0.055, -0.025, 0.028];
        S.push(B.stroke([p0, [p0[0] + d[0] * 0.06, p0[1] + d[1] * 0.06, p0[2]]], { w: 'detail', alpha: 0.9, part: HP }));
        F.push(B.disc([p0[0] + d[0] * 0.062, p0[1] + d[1] * 0.062, p0[2]], 0.006, { axis: 'z', seg: 8, part: HP }));

        /* 桌面光池（局部 y 0.0035 = 世界 0.7635；zBias 需压过大台面平均深度偏差） */
        o._pool = B.disc([0.30, 0.0035, 0.06], 0.30, {
          axis: 'y', seg: 20, stroke: false, hatch: false, zBias: 0.35,
          fill: () => RLR.Engine.env.t > 0.5 ? 'rgba(255,205,140,0.30)' : 'rgba(255,225,170,0.17)'
        });
        o._pool.alpha = 0;
        F.push(o._pool);

        /* 灯头（灯泡）世界坐标，供引擎局部照明与光晕 */
        RLR.Engine.light.lampPos = [opts.pivot[0] + 0.27 * SN, opts.pivot[1] + 0.31 - 0.27 * CS, opts.pivot[2]];

        o.hits.push({ c: [0, 0.15, 0], h: [0.10, 0.20, 0.10] });
        o.hits.push({ c: [0.16, 0.165, 0.01], h: [0.20, 0.18, 0.13] }); /* 覆盖实际灯臂+灯罩区域 */
      },

      onHover(on) { RLR.Engine.tw(o, 'hov', on ? 1 : 0, 0.35, E.outCubic); },
      onPress(down) { if (down) o.bounce = Math.max(o.bounce, 0.6); },
      action() {
        o.on = !o.on;
        RLR.Audio.play('click');
        RLR.Audio.lampHum(o.on);
        o.bounce = 1;
      },
      update(dt) {
        const k = 1 - Math.exp(-dt * 8);
        o.li += ((o.on ? 1 : 0) - o.li) * k;
        RLR.Engine.light.lampI = o.li;
        o._bulb.alpha = 0.25 + 0.75 * o.li;
        o._pool.alpha = 0.9 * o.li;
        o.bounce = Math.max(0, o.bounce - dt * 1.5);
        o.parts.head.roll = ROLL + 0.045 * Math.sin(o.bounce * 6) * o.bounce + 0.05 * o.hov;
      }
    };
    return o;
  }
  RLR.createLamp = createLamp;
})();
