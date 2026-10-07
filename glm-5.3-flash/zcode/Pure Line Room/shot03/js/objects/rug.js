/* 线之屋 · 地毯：1.7×2.0 织纹(边框/菱形网格/徽记/角花/流苏) + 可掀前左角 + 整毯轻抖 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;
  const HX = 0.85, HZ = 1.00;             /* 半长 */
  const GX = 0.72, GZ = 0.85;             /* 网格内框 */
  const NOTCH = [-0.86, 0.63, -0.49, 1.01]; /* 掀角区 x0,z0,x1,z1(略放大保证裁净) */
  const FP = [-0.49, 0.82];               /* flap 铰链：内边(x=-0.49)中点 */

  /* 线段与矩形求交(Liang-Barsky)，返回 [t0,t1] 或 null */
  function clipRect(x0, z0, x1, z1, a, b) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const p = [-dx, dx, -dz, dz], q = [a[0] - x0, x1 - a[0], a[1] - z0, z1 - a[1]];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return null; continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t0 < t1 ? [t0, t1] : null;
  }
  /* 生成被缺口裁断的线段 strokes（补集绘制） */
  function clipped(a, b, o) {
    const out = [];
    const inSeg = clipRect(-GX, -GZ, GX, GZ, a, b);
    if (!inSeg) return out;
    const nt = clipRect(NOTCH[0], NOTCH[1], NOTCH[2], NOTCH[3], a, b) || [1, 0];
    const spans = [[inSeg[0], Math.min(inSeg[1], nt[0])], [Math.max(inSeg[0], nt[1]), inSeg[1]]];
    for (const [s, e] of spans) {
      if (e - s < 0.02) continue;
      out.push(B.stroke([[a[0] + (b[0] - a[0]) * s, 0.006, a[1] + (b[1] - a[1]) * s],
        [a[0] + (b[0] - a[0]) * e, 0.006, a[1] + (b[1] - a[1]) * e]], o));
    }
    return out;
  }

  function createRug(opts) {
    const o = {
      name: 'rug', label: '地毯', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      flapT: 0, hovF: 0, prF: 0, shake: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* 主体（前左角留缺口）+ 缺口轮廓线 */
        F.push(B.face([[-HX, 0.004, -HZ], [HX, 0.004, -HZ], [HX, 0.004, HZ], [FP[0], 0.004, HZ], [FP[0], 0.004, 0.64], [-HX, 0.004, 0.64]],
          { dbl: true, fill: () => STYLE.c2('#efe7d3', '#2c3040'), stroke: null, hatch: false, zBias: 0.004 }));
        S.push(B.stroke([[-HX, 0.005, -HZ], [HX, 0.005, -HZ], [HX, 0.005, HZ], [FP[0], 0.005, HZ], [FP[0], 0.005, 0.64], [-HX, 0.005, 0.64], [-HX, 0.005, -HZ]],
          { w: 'detail', alpha: 0.9, zBias: 0.005 }));

        /* 外框双线（被缺口裁断） */
        for (const [ins, w, a] of [[0.06, 'detail', 0.85], [0.085, 'hair', 0.6]]) {
          const x0 = -HX + ins, x1 = HX - ins, z0 = -HZ + ins, z1 = HZ - ins;
          const opt = { w, alpha: a, zBias: 0.007 };
          S.push(...clipped([x0, z0], [x1, z0], opt));
          S.push(...clipped([x0, z1], [x1, z1], opt));
          S.push(...clipped([x0, z0], [x0, z1], opt));
          S.push(...clipped([x1, z0], [x1, z1], opt));
        }

        /* 菱形网格：两组 45° 平行线，间距 0.18(Δc=0.18√2) */
        const gOpt = { w: 'hair', alpha: 0.30, zBias: 0.006 };
        for (let c = -1.55; c <= 1.56; c += 0.18 * Math.SQRT2) {
          S.push(...clipped([c - 2, -2], [c + 2, 2], gOpt));    /* x - z = c */
          S.push(...clipped([c + 2, -2], [c - 2, 2], gOpt));    /* x + z = c */
        }

        /* 中心徽记：双菱形 + 小圆 */
        const em = { w: 'detail', alpha: 0.9, zBias: 0.008 };
        for (const r of [0.20, 0.29])
          S.push(B.stroke([[0, 0.006, -r], [r, 0.006, 0], [0, 0.006, r], [-r, 0.006, 0], [0, 0.006, -r]], em));
        const circ = [];
        for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; circ.push([Math.cos(a) * 0.095, 0.006, Math.sin(a) * 0.095]); }
        S.push(B.stroke(circ, { w: 'detail', alpha: 0.8, zBias: 0.008 }));

        /* 四角 L 形花纹（缺口角由 flap 自带边线） */
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          if (sx < 0 && sz > 0) continue;
          const cx = sx * GX, cz = sz * GZ;
          S.push(B.stroke([[cx, 0.006, cz - sz * 0.18], [cx, 0.006, cz], [cx - sx * 0.18, 0.006, cz]], { w: 'detail', alpha: 0.85, zBias: 0.007 }));
        }

        /* 流苏：z=±1.0 两侧每 0.065 一条；+z 侧缺口段挂在 flap 上 */
        const fringe = (x, zEnd, part) => S.push(B.stroke([[x, 0.004, zEnd], [x, 0.004, zEnd + (zEnd > 0 ? 0.04 : -0.04)]],
          { w: 'hair', alpha: 0.5, zBias: 0.005, part: part || null }));
        for (let x = -0.82; x <= 0.821; x += 0.065) fringe(x, -HZ);
        for (let x = -0.82; x <= -0.521; x += 0.065) fringe(x, HZ, 'flap');
        for (let x = -0.455; x <= 0.821; x += 0.065) fringe(x, HZ);

        /* ---- 掀角 part 'flap'（绕内边 roll 翻起，-0.55 抬向 +y）---- */
        o.parts.flap = { pivot: [FP[0], 0.006, FP[1]], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        const fl = B.face([[-HX, 0.006, 0.64], [FP[0], 0.006, 0.64], [FP[0], 0.006, HZ], [-HX, 0.006, HZ]],
          { part: 'flap', dbl: true, fill: () => STYLE.c2('#e6dcc4', '#262a38'), stroke: 'detail', hatch: false, zBias: 0.010 });
        fl.strokes = [
          { pts: [[-0.83, 0.0065, 0.66], [-0.51, 0.0065, 0.66], [-0.51, 0.0065, 0.98], [-0.83, 0.0065, 0.98], [-0.83, 0.0065, 0.66]], w: 'detail', alpha: 0.8 },
          { pts: [[-0.805, 0.0065, 0.685], [-0.535, 0.0065, 0.685], [-0.535, 0.0065, 0.955], [-0.805, 0.0065, 0.955], [-0.805, 0.0065, 0.685]], w: 'hair', alpha: 0.55 }
        ];
        F.push(fl);

        o.hits.push({ c: [-0.67, 0.008, 0.82], h: [0.22, 0.025, 0.22], part: 'flap', tag: 'flap' });
        o.hits.push({ c: [0, 0.004, 0], h: [0.85, 0.012, 1.0], tag: 'rug' });
      },

      onHover(on) { RLR.Engine.tw(o, 'hovF', on ? 1 : 0, 0.3, E.outCubic); },
      onPress(down, tag) {
        if (tag === 'flap') RLR.Engine.tw(o, 'prF', down ? 1 : 0, down ? 0.1 : 0.25, E.outQuad);
      },
      action(tag) {
        if (tag === 'rug') {                       /* 整毯轻抖两下 */
          if (o.shake <= 0 || o.shake >= 1) {
            o.shake = 1e-4;
            RLR.Audio.play('cloth', { dur: 0.25 });
            RLR.Engine.tw(o, 'shake', 1, 0.7, E.linear, () => { o.off[1] = 0; o.shake = 0; });
          }
          return;
        }
        const up = o.flapT < 0.5;                  /* 掀角 / 落回 */
        RLR.Audio.play(up ? 'rustle' : 'cloth', { dur: up ? 0.35 : 0.5 });
        RLR.Engine.tw(o, 'flapT', up ? 1 : 0, 0.5, up ? E.outBack : E.inOutCubic);
      },

      update() {
        o.parts.flap.roll = -(0.55 * o.flapT + 0.05 * o.hovF + 0.03 * o.prF);
        if (o.shake > 0 && o.shake < 1)
          o.off[1] = 0.012 * Math.sin(o.shake * Math.PI * 4) * (1 - o.shake);
      }
    };
    return o;
  }
  RLR.createRug = createRug;
})();
