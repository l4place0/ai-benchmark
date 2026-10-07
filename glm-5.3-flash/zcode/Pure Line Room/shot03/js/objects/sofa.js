/* 线之屋 · 沙发：背靠右墙面向 -x——底框/四脚/座垫/微仰靠背/扶手/两枚可压抱枕/扶手毯子 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;

  function createSofa(opts) {
    const o = {
      name: 'sofa', label: '沙发', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      sq1: 0, sq2: 0, hov1: 0, hov2: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 底框 + 四脚 */
        F.push(...B.box([0, 0.21, 0], [0.88, 0.18, 1.35]).faces);
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          F.push(...B.cyl([sx * 0.38, 0.06, sz * 0.58], 0.024, 0.12, { rBot: 0.018, seg: 8 }).faces);

        /* 座垫×2：顶面缝线 + 前沿双线 */
        for (const sz of [-1, 1]) {
          F.push(...B.box([-0.06, 0.375, sz * 0.30], [0.58, 0.15, 0.60], {
            face: (k, f) => {
              if (k !== 'py') return;
              f.strokes = [
                { pts: [[-0.335, 0.4505, sz * 0.30 - 0.275], [0.215, 0.4505, sz * 0.30 - 0.275], [0.215, 0.4505, sz * 0.30 + 0.275], [-0.335, 0.4505, sz * 0.30 + 0.275], [-0.335, 0.4505, sz * 0.30 - 0.275]], w: 'hair', alpha: 0.55 },
                { pts: [[-0.06, 0.4505, sz * 0.30 - 0.275], [-0.06, 0.4505, sz * 0.30 + 0.275]], w: 'detail', alpha: 0.6 },
                { pts: [[-0.325, 0.4505, sz * 0.30 - 0.265], [-0.325, 0.4505, sz * 0.30 + 0.265]], w: 'hair', alpha: 0.7 },
                { pts: [[-0.300, 0.4505, sz * 0.30 - 0.265], [-0.300, 0.4505, sz * 0.30 + 0.265]], w: 'hair', alpha: 0.45 }
              ];
            }
          }).faces);
        }

        /* 靠背：顶边 +x 偏 0.03 微仰 + 两条横向软包线 */
        const back = B.box([0.35, 0.55, 0], [0.18, 0.52, 1.35], {
          face: (k, f) => {
            if (k !== 'nx') return;
            f.strokes = [
              { pts: [[0.2615, 0.45, -0.62], [0.2615, 0.45, 0.62]], w: 'hair', alpha: 0.6 },
              { pts: [[0.2615, 0.63, -0.62], [0.2615, 0.63, 0.62]], w: 'hair', alpha: 0.6 }
            ];
          }
        });
        for (const f of back.faces) for (const p of f.pts) if (p[1] > 0.80) p[0] += 0.03;
        F.push(...back.faces);

        /* 扶手×2 + 顶沿圆角 strokes */
        for (const sz of [-1, 1]) {
          F.push(...B.box([-0.02, 0.46, sz * 0.60], [0.80, 0.30, 0.16]).faces);
          const r = 0.04, yT = 0.6105, x0 = -0.40, x1 = 0.36, z0 = sz * 0.60 - 0.058, z1 = sz * 0.60 + 0.058;
          const rr = [];
          const corner = (cx, cz, a0, a1) => {
            for (let i = 0; i <= 4; i++) {
              const a = a0 + (a1 - a0) * i / 4;
              rr.push([cx + Math.cos(a) * r, yT, cz + Math.sin(a) * r]);
            }
          };
          corner(x1 - r, z0 + r, -Math.PI / 2, 0);
          corner(x1 - r, z1 - r, 0, Math.PI / 2);
          corner(x0 + r, z1 - r, Math.PI / 2, Math.PI);
          corner(x0 + r, z0 + r, Math.PI, Math.PI * 1.5);
          rr.push(rr[0]);
          S.push(B.stroke(rr, { w: 'detail', alpha: 0.7 }));
        }

        /* ---- 抱枕 parts 'pw1'/'pw2'（scale 压扁、roll 微倾）---- */
        o.parts.pw1 = { pivot: [0.24, 0.60, -0.28], yaw: -0.12, pitch: 0, roll: -0.5, off: [0, 0, 0] };
        o.parts.pw2 = { pivot: [0.22, 0.59, 0.30], yaw: 0.15, pitch: 0, roll: -0.55, off: [0, 0, 0] };
        const pillow = (part, c, col) => {
          F.push(...B.box(c, [0.13, 0.36, 0.36], {
            part, fill: col,
            face: (k, f) => {
              if (k !== 'nx' && k !== 'px') return;
              const x = k === 'nx' ? c[0] - 0.0655 : c[0] + 0.0655;
              f.strokes = [
                { pts: [[x, c[1] - 0.155, c[2] - 0.155], [x, c[1] - 0.155, c[2] + 0.155], [x, c[1] + 0.155, c[2] + 0.155], [x, c[1] + 0.155, c[2] - 0.155], [x, c[1] - 0.155, c[2] - 0.155]], w: 'hair', alpha: 0.6 },
                { pts: [[x, c[1] - 0.05, c[2] - 0.05], [x, c[1] - 0.05, c[2] + 0.05], [x, c[1] + 0.05, c[2] + 0.05], [x, c[1] + 0.05, c[2] - 0.05], [x, c[1] - 0.05, c[2] - 0.05]], w: 'hair', alpha: 0.45 }
              ];
            }
          }).faces);
        };
        pillow('pw1', [0.24, 0.60, -0.28], 'auto');
        pillow('pw2', [0.22, 0.59, 0.30], () => STYLE.c2('#b99e7a', '#4a4a58'));

        /* ---- 毯子：搭面 + 垂面（3×3 格纹）---- */
        const zb = 0.012, yT2 = 0.615;
        const top = B.face([[-0.41, yT2, -0.67], [-0.41, yT2, -0.53], [0.30, yT2, -0.53], [0.30, yT2, -0.67]],
          { dbl: true, fill: () => STYLE.c('paper'), stroke: 'hair', hatch: false, zBias: zb });
        const hang = B.face([[-0.41, yT2, -0.67], [-0.41, yT2, -0.53], [-0.435, 0.28, -0.53], [-0.435, 0.28, -0.67]],
          { dbl: true, fill: () => STYLE.c('paper'), stroke: 'hair', hatch: false, zBias: zb });
        top.strokes = [
          { pts: [[-0.05, yT2 + 0.001, -0.67], [-0.05, yT2 + 0.001, -0.53]], w: 'hair', alpha: 0.5 },
          { pts: [[0.12, yT2 + 0.001, -0.67], [0.12, yT2 + 0.001, -0.53]], w: 'hair', alpha: 0.5 },
          { pts: [[-0.41, yT2 + 0.001, -0.623], [0.30, yT2 + 0.001, -0.623]], w: 'hair', alpha: 0.5 },
          { pts: [[-0.41, yT2 + 0.001, -0.576], [0.30, yT2 + 0.001, -0.576]], w: 'hair', alpha: 0.5 }
        ];
        hang.strokes = [
          { pts: [[-0.4227, 0.50, -0.67], [-0.4227, 0.50, -0.53]], w: 'hair', alpha: 0.5 },
          { pts: [[-0.4185, 0.39, -0.67], [-0.4185, 0.39, -0.53]], w: 'hair', alpha: 0.5 },
          { pts: [[-0.41, 0.56, -0.623], [-0.434, 0.395, -0.623]], w: 'hair', alpha: 0.5 },
          { pts: [[-0.41, 0.50, -0.576], [-0.434, 0.335, -0.576]], w: 'hair', alpha: 0.5 }
        ];
        F.push(top, hang);

        o.hits.push({ c: [0.24, 0.60, -0.28], h: [0.17, 0.24, 0.24], part: 'pw1', tag: 'pw1' });
        o.hits.push({ c: [0.22, 0.59, 0.30], h: [0.17, 0.24, 0.24], part: 'pw2', tag: 'pw2' });
      },

      onHover(on, tag) {
        const k = tag === 'pw2' ? 'hov2' : 'hov1';
        RLR.Engine.tw(o, k, on ? 1 : 0, 0.3, E.outCubic);
      },
      onPress(down, tag) {
        const k = tag === 'pw2' ? 'sq2' : 'sq1';
        if (down) RLR.Engine.tw(o, k, 1, 0.12, E.outQuad);
        else RLR.Engine.tw(o, k, 0, 0.65, E.outElastic);
      },
      action(tag) {
        const k = tag === 'pw2' ? 'sq2' : 'sq1';
        if (o[k] > 0.12) {
          RLR.Engine.tw(o, k, 0, 0.65, E.outElastic);
          RLR.Audio.play('puff');
        }
      },

      update() {
        o.parts.pw1.scale = [1, 1 - 0.22 * o.sq1, 1];
        o.parts.pw2.scale = [1, 1 - 0.22 * o.sq2, 1];
        o.parts.pw1.roll = -0.5 + 0.03 * o.hov1;
        o.parts.pw2.roll = -0.55 + 0.03 * o.hov2;
      }
    };
    return o;
  }
  RLR.createSofa = createSofa;
})();
