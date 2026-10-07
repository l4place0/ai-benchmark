/* 线之屋 · 边柜：贴右墙(front 朝 -x)——柜体/顶沿/底座小脚/上抽屉/双开柜门/柜内陈设 */
(function () {
  const B = RLR.B, M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;
  const YAW = 1.95;                       /* 门开角(弧度)，dl 负 / dr 正 → 朝 -x 外开 */

  function createSideboard(opts) {
    const o = {
      name: 'sideboard', label: '边柜', interactive: true,
      pivot: opts.pivot, off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      dlT: 0, drT: 0, sdT: 0, hovDl: 0, hovDr: 0, hovSd: 0, pr: 0, prTag: null,

      build() {
        const F = o.faces, S = o.strokes;
        /* 柜体：front(nx) 敞开只留边线，露出内壁 */
        F.push(...B.box([0, 0.39, 0], [0.42, 0.66, 1.50], {
          face: (k, f) => { if (k === 'nx') f.fill = null; }
        }).faces);
        /* 正面四周缝线 */
        S.push(B.stroke([[-0.2105, 0.082, -0.730], [-0.2105, 0.082, 0.730], [-0.2105, 0.698, 0.730],
          [-0.2105, 0.698, -0.730], [-0.2105, 0.082, -0.730]], { w: 'hair', alpha: 0.5, zBias: 0.003 }));
        /* 顶沿板 + 底座(略抬高让四脚可见) + 四角小脚 */
        F.push(...B.box([0, 0.7325, 0], [0.44, 0.025, 1.54]).faces);
        F.push(...B.box([0, 0.05, 0], [0.40, 0.04, 1.46]).faces);
        for (const sx of [-1, 1]) for (const sz of [-1, 1])
          F.push(...B.cyl([sx * 0.16, 0.015, sz * 0.655], 0.017, 0.03, { seg: 8 }).faces);
        /* 正面两侧固定门边板(留出中段 0.69 开口) + 上下窄梃 */
        for (const sz of [-1, 1]) {
          const z0 = sz < 0 ? -0.73 : 0.345, z1 = sz < 0 ? -0.345 : 0.73;
          F.push(B.face([[-0.215, 0.075, z0], [-0.215, 0.075, z1], [-0.215, 0.705, z1], [-0.215, 0.705, z0]],
            { dbl: true, stroke: 'edge', hatch: false }));
        }
        F.push(B.face([[-0.215, 0.685, -0.345], [-0.215, 0.685, 0.345], [-0.215, 0.705, 0.345], [-0.215, 0.705, -0.345]], { dbl: true, stroke: null, hatch: false }));
        F.push(B.face([[-0.215, 0.06, -0.345], [-0.215, 0.06, 0.345], [-0.215, 0.085, 0.345], [-0.215, 0.085, -0.345]], { dbl: true, stroke: null, hatch: false }));

        /* ---- 柜内壁面片 + 中层隔板 + 两叠布 + 碗 ---- */
        const inner = { dbl: true, fill: () => STYLE.c2('#efe9db', '#262a35'), stroke: 'hair', hatch: false, alpha: 0.96 };
        F.push(B.face([[0.19, 0.075, -0.725], [0.19, 0.075, 0.725], [0.19, 0.70, 0.725], [0.19, 0.70, -0.725]], inner));
        F.push(B.face([[-0.19, 0.095, -0.725], [0.19, 0.095, -0.725], [0.19, 0.095, 0.725], [-0.19, 0.095, 0.725]], inner));
        F.push(B.face([[-0.19, 0.685, -0.725], [0.19, 0.685, -0.725], [0.19, 0.685, 0.725], [-0.19, 0.685, 0.725]], inner));
        for (const sz of [-1, 1])
          F.push(B.face([[-0.19, 0.095, sz * 0.725], [0.19, 0.095, sz * 0.725], [0.19, 0.70, sz * 0.725], [-0.19, 0.70, sz * 0.725]], inner));
        F.push(...B.box([0, 0.30, 0], [0.375, 0.015, 1.44]).faces);          /* 中层隔板 */
        const cloth = (cx, cz, y, col, rot) => {
          const rp = (dx, dz) => { const q = M.rotY([dx, 0, dz], rot); return [cx + q[0], y, cz + q[2]]; };
          const f = B.face([rp(-0.105, -0.13), rp(0.105, -0.13), rp(0.105, 0.13), rp(-0.105, 0.13)],
            { dbl: true, fill: col, stroke: 'hair', hatch: false, zBias: 0.001 });
          f.strokes = [
            { pts: [rp(-0.095, -0.12), rp(0.095, -0.12), rp(0.095, 0.12), rp(-0.095, 0.12), rp(-0.095, -0.12)], w: 'hair', alpha: 0.55 },
            { pts: [rp(-0.105, 0.02), rp(0.105, -0.02)], w: 'detail', alpha: 0.7 }   /* 折痕 */
          ];
          return f;
        };
        F.push(cloth(0.05, -0.15, 0.3105, () => STYLE.c2('#eee6d2', '#343a49'), 0.06));
        F.push(cloth(0.05, -0.15, 0.3165, () => STYLE.c2('#e3d9c2', '#2e3444'), -0.10));
        F.push(cloth(0.05, 0.15, 0.3105, () => STYLE.c2('#e9e0cb', '#303748'), -0.05));
        F.push(cloth(0.05, 0.15, 0.3165, () => STYLE.c2('#efe7d3', '#383e4e'), 0.12));
        F.push(...B.cyl([-0.115, 0.3275, 0.0], 0.03, 0.04, { rTop: 0.05, seg: 12, cap: false, part: null }).faces);  /* 碗 */
        S.push(B.arc([-0.115, 0.3475, 0.0], 0.0505, 0, Math.PI * 2, { axis: 'y', seg: 14, w: 'hair', alpha: 0.7, zBias: 0.001 }));

        /* ---- 上抽屉 part 'sd'（off x 负向拉出）---- */
        o.parts.sd = { pivot: [-0.21, 0.615, 0], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        F.push(...B.box([-0.21, 0.615, 0], [0.02, 0.13, 0.68], {
          part: 'sd',
          face: (k, f) => {
            if (k !== 'nx') return;
            f.strokes = [{ pts: [[-0.2205, 0.562, -0.31], [-0.2205, 0.562, 0.31], [-0.2205, 0.668, 0.31], [-0.2205, 0.668, -0.31], [-0.2205, 0.562, -0.31]], w: 'detail', alpha: 0.7 }];
          }
        }).faces);
        F.push(...B.cyl([-0.225, 0.615, 0], 0.007, 0.10, { axis: 'z', seg: 8, part: 'sd' }).faces);          /* 拉手横杆 */
        for (const sz of [-1, 1]) F.push(...B.cyl([-0.221, 0.615, sz * 0.035], 0.004, 0.012, { axis: 'x', seg: 6, part: 'sd' }).faces);

        /* ---- 下两门 part 'dl'/'dr'：铰链 z=∓0.34，门板从铰链伸向中缝 ---- */
        o.parts.dl = { pivot: [-0.21, 0.30, -0.34], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        o.parts.dr = { pivot: [-0.21, 0.30, 0.34], yaw: 0, pitch: 0, roll: 0, off: [0, 0, 0] };
        const door = (part, hz) => {
          F.push(...B.box([-0.21, 0.30, 0], [0.02, 0.50, 0.68], {
            part,
            face: (k, f) => {
              if (k !== 'nx') return;
              f.strokes = [{ pts: [[-0.2205, 0.075, hz * 0.31], [-0.2205, 0.075, -hz * 0.31], [-0.2205, 0.525, -hz * 0.31], [-0.2205, 0.525, hz * 0.31], [-0.2205, 0.075, hz * 0.31]], w: 'detail', alpha: 0.7 }];
            }
          }).faces);
          /* 拉手：靠自由端小竖杆 */
          F.push(...B.cyl([-0.227, 0.30, -hz * 0.27], 0.007, 0.05, { axis: 'x', seg: 8, part }).faces);
          F.push(...B.cyl([-0.222, 0.30, -hz * 0.27], 0.004, 0.012, { axis: 'z', seg: 6, part }).faces);
        };
        door('dl', -1); door('dr', 1);

        /* hits（宁大勿小；门开着时 hit 随部件转走，另一扇即可点中） */
        o.hits.push({ c: [-0.21, 0.30, 0], h: [0.05, 0.26, 0.36], part: 'dl', tag: 'dl' });
        o.hits.push({ c: [-0.21, 0.30, 0], h: [0.05, 0.26, 0.36], part: 'dr', tag: 'dr' });
        o.hits.push({ c: [-0.21, 0.615, 0], h: [0.05, 0.08, 0.36], part: 'sd', tag: 'sd' });
      },

      onHover(on, tag) {
        const k = tag === 'dr' ? 'hovDr' : tag === 'sd' ? 'hovSd' : 'hovDl';
        RLR.Engine.tw(o, k, on ? 1 : 0, 0.3, E.outCubic);
      },
      onPress(down, tag) {
        if (down) { o.pr = 1; o.prTag = tag || 'sd'; RLR.Engine.tw(o, 'pr', 1, 0.1, E.outQuad); }
        else RLR.Engine.tw(o, 'pr', 0, 0.25, E.outQuad);
      },
      action(tag) {
        tag = tag || 'sd';
        if (tag === 'sd') {                                   /* 抽屉 */
          const open = o.sdT < 0.5;
          RLR.Audio.play('slide', { dur: 0.3 });
          RLR.Engine.tw(o, 'sdT', open ? 1 : 0, 0.8, E.inOutCubic,
            () => { if (!open) RLR.Audio.play('thud', { pitch: 1.2 }); });
        } else {                                              /* 门 */
          const key = tag === 'dr' ? 'drT' : 'dlT';
          const open = o[key] < 0.5;
          RLR.Audio.play('latch');
          RLR.Engine.delay(() => {
            RLR.Audio.play('creak', { dur: 0.4 });
            RLR.Engine.tw(o, key, open ? 1 : 0, 0.8, E.inOutCubic);
          }, 0.12);
        }
      },

      update() {
        const prDl = o.prTag === 'dl' ? o.pr : 0, prDr = o.prTag === 'dr' ? o.pr : 0, prSd = o.prTag === 'sd' ? o.pr : 0;
        o.parts.dl.yaw = -(YAW * o.dlT + 0.04 * o.hovDl + 0.03 * prDl);
        o.parts.dr.yaw = YAW * o.drT + 0.04 * o.hovDr + 0.03 * prDr;
        o.parts.sd.off = [-(0.18 * o.sdT + 0.012 * o.hovSd - 0.006 * prSd), 0, 0];
      }
    };
    return o;
  }
  RLR.createSideboard = createSideboard;
})();
