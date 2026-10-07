/* 线之屋 · 唱片机：边柜顶——底箱/木面板/转盘黑胶(随播放旋转)/唱臂(落针)/旋钮拨杆/斜倚开盖/音符 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;
  const ARM_YAW = 0.79;                   /* play 位唱臂偏航：自检唱头到盘心距 ~0.077 < 0.09 */

  function createPlayer(opts) {
    const o = {
      name: 'player', label: '唱片机', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      playing: false, armT: 0, spdT: 0, spd: 0, hov: 0, pr: 0, _seq: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 底箱 + 木上面板 + 转盘座圈 + 面板散热线 */
        F.push(...B.box([-0.03, 0.035, 0], [0.32, 0.07, 0.50]).faces);
        F.push(...B.box([-0.03, 0.08, 0], [0.28, 0.02, 0.44], {
          face: (k, f) => {
            if (k !== 'py') return;
            f.fill = () => STYLE.c2('#5a4636', '#3a3a44');
            f.strokes = [{ pts: [[-0.155, 0.0905, -0.20], [0.095, 0.0905, -0.20], [0.095, 0.0905, 0.20], [-0.155, 0.0905, 0.20], [-0.155, 0.0905, -0.20]], w: 'hair', alpha: 0.5 }];
          }
        }).faces);
        F.push(...B.cyl([-0.02, 0.099, 0.06], 0.15, 0.018, { seg: 28 }).faces);       /* 转盘基座 */
        for (const sx of [-0.14, 0.08]) for (const sz of [-0.19, 0.19])
          F.push(B.disc([sx, 0.0905, sz], 0.005, { seg: 8, stroke: false, hatch: false, fill: () => STYLE.c2('#8a8578', '#6a6f7d') }));
        /* 皮革垫(垫在底箱与柜顶之间) */
        F.push(...B.box([-0.03, -0.015, 0], [0.34, 0.03, 0.54], {
          face: (k, f) => { if (k === 'py') f.stroke = 'hair'; }
        }).faces);

        /* ---- 唱盘 part 'disc'（盘心世界 [2.44,0.895,-0.74]）---- */
        o.parts.disc = { pivot: [-0.02, 0.115, 0.06], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...B.cyl([-0.02, 0.115, 0.06], 0.145, 0.014, { seg: 28, part: 'disc' }).faces);        /* 盘体 */
        F.push(...B.cyl([-0.02, 0.1255, 0.06], 0.138, 0.005, { seg: 30, cap: false, capB: false, part: 'disc', fill: () => STYLE.c2('#26241f', '#1c1e26') }).faces);
        const vinyl = B.disc([-0.02, 0.1281, 0.06], 0.138, { seg: 30, part: 'disc', hatch: false, fill: () => STYLE.c2('#26241f', '#1c1e26'), strokeRole: 'hair' });
        vinyl.strokes = [
          B.arc([-0.02, 0.1283, 0.06], 0.095, 0, Math.PI * 2, { axis: 'y', seg: 24, w: 'hair', alpha: 0.5 }),
          B.arc([-0.02, 0.1283, 0.06], 0.062, 0, Math.PI * 2, { axis: 'y', seg: 20, w: 'hair', alpha: 0.5 }),
          { pts: [[-0.02 + 0.05 * Math.cos(0.52), 0.1283, 0.06 + 0.05 * Math.sin(0.52)], [-0.02 + 0.132 * Math.cos(0.52), 0.1283, 0.06 + 0.132 * Math.sin(0.52)]], w: 'hair', col: '#b7b1a0', alpha: 0.85 }  /* 径向亮线，随盘转 */
        ];
        F.push(vinyl);
        F.push(B.disc([-0.02, 0.1292, 0.06], 0.048, { seg: 20, part: 'disc', hatch: false, strokeRole: 'hair', fill: () => STYLE.c2('#a85448', '#6e4250') }));
        F.push(...B.cyl([-0.02, 0.136, 0.06], 0.004, 0.026, { seg: 8, part: 'disc' }).faces);         /* 主轴 */

        /* ---- 唱臂 part 'arm'（几何沿 -x 伸向盘心，rest yaw=0 停于臂架）---- */
        o.parts.arm = { pivot: [0.09, 0.12, -0.155], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...B.cyl([0.09, 0.105, -0.155], 0.014, 0.03, { seg: 10 }).faces);                      /* 臂座柱 */
        F.push(...B.cyl([-0.01, 0.12, -0.155], 0.006, 0.20, { axis: 'x', seg: 8, part: 'arm' }).faces);/* 臂管 */
        F.push(...B.box([-0.115, 0.12, -0.155], [0.032, 0.02, 0.022], { part: 'arm' }).faces);        /* 唱头 */
        F.push(...B.cyl([0.115, 0.12, -0.155], 0.012, 0.03, { axis: 'x', seg: 10, part: 'arm' }).faces);/* 配重 */
        S.push(B.stroke([[0.02, 0.1235, -0.152], [-0.095, 0.1235, -0.152]], { w: 'detail', alpha: 0.7, part: 'arm' }));
        S.push(B.stroke([[0.02, 0.1165, -0.158], [-0.095, 0.1165, -0.158]], { w: 'detail', alpha: 0.7, part: 'arm' }));
        F.push(...B.cyl([-0.02, 0.10, -0.155], 0.009, 0.02, { seg: 8 }).faces);                       /* 臂架 */

        /* ---- 控件：旋钮(part 'kn' 悬停转)/刻度/拨杆/45转适配器 ---- */
        o.parts.kn = { pivot: [0.09, 0.095, -0.17], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...B.cyl([0.09, 0.095, -0.17], 0.02, 0.022, { seg: 12, part: 'kn' }).faces);
        S.push(B.stroke([[0.09, 0.1065, -0.17], [0.09 + 0.016 * Math.cos(0.8), 0.1065, -0.17 + 0.016 * Math.sin(0.8)]], { w: 'hair', alpha: 0.9, part: 'kn' }));  /* 旋钮指示线 */
        for (let i = 0; i < 5; i++) {
          const a = -0.6 + i * 0.3;
          S.push(B.stroke([[0.09 + 0.024 * Math.cos(a), 0.1065, -0.17 + 0.024 * Math.sin(a)],
            [0.09 + 0.031 * Math.cos(a), 0.1065, -0.17 + 0.031 * Math.sin(a)]], { w: 'hair', alpha: 0.8 }));
        }
        F.push(...B.box([0.125, 0.1, -0.06], [0.014, 0.02, 0.045], { face: (k, f) => { if (k === 'py') f.stroke = 'detail'; } }).faces);
        F.push(B.disc([0.10, 0.0955, 0.20], 0.02, { seg: 14, strokeRole: 'detail', hatch: false, fill: () => STYLE.c2('#c9c2ae', '#6a7080') }));

        /* ---- 开盖：盖板斜倚背后（part 'lid'，pitch -2.0 仰起）---- */
        o.parts.lid = { pivot: [0, 0.095, -0.22], yaw: 0, pitch: -2.0, roll: 0, off: [0, 0, 0] };
        const lid = B.face([[-0.15, 0.095, -0.22], [0.15, 0.095, -0.22], [0.15, 0.095, 0.20], [-0.15, 0.095, 0.20]],
          { part: 'lid', dbl: true, fill: null, stroke: 'detail', hatch: false });
        lid.strokes = [{ pts: [[-0.13, 0.0952, -0.14], [0.13, 0.0952, 0.13]], w: 'hair', alpha: 0.5 }];  /* 对角高光 */
        F.push(lid);

        /* ---- 音符 text（update 中驱动；引擎 text 不读 alpha，用 rgba col 控制显隐）---- */
        o._notes = [];
        for (let i = 0; i < 3; i++) {
          const t = B.text([-0.02 + i * 0.06, 0.25, 0.06], '♪', 0.05, { zBias: 0.02 });
          o._notes.push(t); o.texts.push(t);
        }

        o.hits.push({ c: [0, 0.06, 0], h: [0.19, 0.10, 0.27] });
      },

      onHover(on) {
        RLR.Engine.tw(o.parts.kn, 'yaw', on ? 0.8 : 0, 0.4, E.outBack);
        RLR.Engine.tw(o, 'hov', on ? 1 : 0, 0.35, E.outCubic);
      },
      onPress(down) {
        RLR.Engine.tw(o, 'pr', down ? 1 : 0, down ? 0.12 : 0.3, E.outQuad);
      },
      action() {
        o.playing = !o.playing;
        const tk = ++o._seq;
        if (o.playing) {
          RLR.Audio.play('servo');
          RLR.Engine.tw(o, 'armT', 1, 0.9, E.outCubic);
          RLR.Engine.delay(() => { if (tk !== o._seq) return; RLR.Audio.music(true); o.spdT = 1; }, 0.9);
        } else {
          RLR.Audio.play('click');
          RLR.Audio.music(false);
          o.spdT = 0;
          RLR.Engine.delay(() => { if (tk !== o._seq) return; RLR.Engine.tw(o, 'armT', 0, 0.7, E.inOutCubic); }, 0.7);
        }
      },

      update(dt, t) {
        o.spd += (o.spdT - o.spd) * (1 - Math.exp(-1.6 * dt));
        o.parts.disc.yaw += 3.4 * o.spd * dt;
        o.parts.arm.yaw = ARM_YAW * o.armT + 0.04 * o.pr * (1 - o.armT);
        o.parts.kn.pitch = 0.5 * o.pr;
        o.parts.lid.pitch = -2.0 + 0.05 * o.hov;
        const on = o.spd > 0.03 ? Math.min(1, o.spd * 3) : 0;
        const ink = on > 0.01 ? STYLE.c('ink').slice(4, -1) : null;   /* 'r,g,b' */
        for (let i = 0; i < 3; i++) {
          const n = o._notes[i];
          if (!ink) { n.col = 'rgba(0,0,0,0)'; continue; }
          const h = ((t * 0.5) + i / 3) % 1;
          n.p = [-0.02 + i * 0.06, 0.25 + h * 0.18, 0.06];
          n.col = 'rgba(' + ink + ',' + (0.8 * (1 - h) * on).toFixed(3) + ')';
        }
      }
    };
    return o;
  }
  RLR.createPlayer = createPlayer;
})();
