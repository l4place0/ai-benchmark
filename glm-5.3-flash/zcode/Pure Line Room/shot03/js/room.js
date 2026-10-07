/* 线之屋 · 建筑结构 + 窗外景/走廊背景层 */
(function () {
  const B = RLR.B, M = RLR.M, STYLE = RLR.STYLE;

  const ROOM = RLR.ROOM = {
    W: 5.4, H: 3.02, T: 0.12,
    X: [-2.7, 2.7], Z: [-2.2, 2.2],
    WIN: { x0: 0.10, x1: 1.80, y0: 0.95, y1: 2.30 },
    DOOR: { z0: 0.55, z1: 1.47, h: 2.06 }
  };

  function wallBox(c, s, o) {
    return B.box(c, s, Object.assign({ fill: 'auto', strokeRole: 'edge' }, o || {}));
  }

  /* 矩形减矩形（用于门洞处的墙面瓦片）：a - b，返回子矩形列表 [z0,y0,z1,y1] */
  function rectMinus(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    const out = [];
    if (bx1 <= ax0 || bx0 >= ax1 || by0 >= ay1 || by1 <= ay0) return [[ax0, ay0, ax1, ay1]];
    if (bx0 > ax0) out.push([ax0, ay0, bx0, ay1]);
    if (bx1 < ax1) out.push([bx1, ay0, ax1, ay1]);
    const cx0 = Math.max(ax0, bx0), cx1 = Math.min(ax1, bx1);
    if (by1 < ay1) out.push([cx0, by1, cx1, ay1]);
    return out;
  }

  /* ============ 背景层：窗外景 + 门后走廊（最先绘制） ============ */
  function createBackdrop() {
    const o = {
      name: 'backdrop', label: '', interactive: false, background: true,
      pivot: [0, 0, 0], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      build, update
    };

    function build() {
      const F = o.faces, S = o.strokes;
      const Wx = ROOM.WIN, Dr = ROOM.DOOR;
      const bx0 = Wx.x0 - 0.75, bx1 = Wx.x1 + 0.75, by0 = Wx.y0 - 0.75, by1 = Wx.y1 + 0.7;

      /* 天空两层 */
      F.push(B.face([[bx0, by0, -2.42], [bx1, by0, -2.42], [bx1, by1, -2.42], [bx0, by1, -2.42]],
        { dbl: true, fill: () => STYLE.c('sky'), stroke: null, hatch: false }));
      F.push(B.face([[bx0, by0, -2.41], [bx1, by0, -2.41], [bx1, Wx.y0 + 0.5, -2.41], [bx0, Wx.y0 + 0.5, -2.41]],
        { dbl: true, fill: () => STYLE.c('skyLow'), stroke: null, hatch: false }));
      /* 远山两层 */
      S.push(B.stroke(hillPts(-2.40, 1.18, 0.16, 11), { w: 'detail', alpha: 0.75 }));
      S.push(B.stroke(hillPts(-2.395, 1.42, 0.10, 9), { w: 'hair', alpha: 0.55 }));
      /* 太阳（昼） */
      F.push(B.disc([1.30, 2.02, -2.40], 0.15, { axis: 'z', fill: () => STYLE.c('sun'), stroke: null, hatch: false, part: 'sun' }));
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        S.push(B.stroke([
          [1.30 + Math.cos(a) * 0.19, 2.02 + Math.sin(a) * 0.19, -2.40],
          [1.30 + Math.cos(a) * 0.24, 2.02 + Math.sin(a) * 0.24, -2.40]
        ], { w: 'hair', alpha: 0.7, part: 'sun' }));
      }
      /* 月亮（夜）：圆盘 + 遮圆成弯月 */
      F.push(B.disc([1.28, 2.00, -2.40], 0.13, { axis: 'z', fill: () => STYLE.c('sun'), stroke: null, hatch: false, part: 'moon' }));
      F.push(B.disc([1.345, 2.048, -2.399], 0.115, { axis: 'z', fill: () => STYLE.c('sky'), stroke: null, hatch: false, part: 'moon', zBias: 0.001 }));
      /* 星星 */
      o._stars = [];
      for (let i = 0; i < 22; i++) {
        const sx = bx0 + 0.2 + M.hash(i * 7.3) * (bx1 - bx0 - 0.4);
        const sy = Wx.y0 + 0.5 + M.hash(i * 3.1 + 5) * (by1 - Wx.y0 - 0.7);
        const st = B.stroke([[sx, sy, -2.40], [sx + 0.012, sy + 0.008, -2.40]], { w: 'hair', alpha: 0, part: 'stars' });
        o._stars.push(st);
        S.push(st);
      }
      /* 云（两组，缓慢漂移） */
      for (let ci = 0; ci < 2; ci++) {
        const cy0 = 1.86 + ci * 0.30, cx0 = 0.35 + ci * 0.75;
        for (let k = 0; k < 3; k++) {
          const dx = k * 0.16 - 0.16, dy = (k % 2) * 0.05, r = 0.09 - k * 0.015;
          const el = [];
          for (let i = 0; i <= 12; i++) {
            const a = i / 12 * Math.PI * 2;
            el.push([cx0 + dx + Math.cos(a) * r * 1.5, cy0 + dy + Math.sin(a) * r * 0.75, -2.395]);
          }
          S.push(B.stroke(el, { w: 'hair', alpha: 0.5, part: 'clouds' + ci, zBias: 0.001 }));
        }
      }

      /* ---- 门后走廊：暗色 fills 恰好填满门洞（背景层，不越出墙面投影） ---- */
      const cz0 = Dr.z0 + 0.01, cz1 = Dr.z1 - 0.01, cy1 = Dr.h - 0.01, cx = -2.581;
      F.push(B.face([
        [cx, 0, cz0], [cx, 0, cz1], [cx, cy1, cz1], [cx, cy1, cz0]
      ], { dbl: true, fill: () => STYLE.c('corridor'), stroke: null, hatch: false }));
      /* 走廊进深暗示：内缩矩形 + 远处门形（全部收在门洞投影内） */
      S.push(B.stroke([[cx - 0.002, 0.06, cz0 + 0.16], [cx - 0.002, 0.06, cz1 - 0.16],
        [cx - 0.002, 1.55, cz1 - 0.16], [cx - 0.002, 1.55, cz0 + 0.16], [cx - 0.002, 0.06, cz0 + 0.16]],
        { w: 'hair', alpha: 0.45 }));
      S.push(B.stroke([[cx - 0.004, 0, cz0 + 0.38], [cx - 0.004, 0, cz1 - 0.38],
        [cx - 0.004, 1.28, cz1 - 0.38], [cx - 0.004, 1.28, cz0 + 0.38], [cx - 0.004, 0, cz0 + 0.38]],
        { w: 'hair', alpha: 0.3 }));
      S.push(B.stroke([[cx - 0.006, 0.02, cz0 + 0.12], [cx - 0.006, 0.02, cz1 - 0.12]], { w: 'hair', alpha: 0.35 }));
    }

    function hillPts(z, baseY, amp, n) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = -0.7 + (i / n) * 3.1;
        pts.push([x, baseY + Math.sin(i * 2.1 + 1) * amp + Math.sin(i * 0.9) * amp * 0.6, z]);
      }
      return pts;
    }

    function update(dt, t) {
      const night = RLR.Engine.env.t;
      for (const f of o.faces) {
        if (f.part === 'sun') f.alpha = 1 - night;
        else if (f.part === 'moon') f.alpha = night;
      }
      for (const s of o.strokes) {
        if (s.part === 'sun') s.alpha = 0.7 * (1 - night);
        else if (s.part === 'stars') s.alpha = night * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + s.pts[0][0] * 13)));
        else if (s.part === 'clouds0') s.alpha = 0.5 * (1 - night);
        else if (s.part === 'clouds1') s.alpha = 0.45 * (1 - night);
      }
      const drift = (t * 0.012) % 1.6;
      if (!o.parts.clouds0) { o.parts.clouds0 = { pivot: [0, 0, 0], off: [0, 0, 0] }; o.parts.clouds1 = { pivot: [0, 0, 0], off: [0, 0, 0] }; }
      o.parts.clouds0.off[0] = drift - 0.4;
      o.parts.clouds1.off[0] = -drift * 0.7;
    }

    return o;
  }

  /* ============ 建筑本体 ============ */
  function createRoom() {
    const o = {
      name: 'room', label: '', interactive: false,
      pivot: [0, 0, 0], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      build
    };

    function build() {
      const F = o.faces, S = o.strokes;
      const W = ROOM.W, H = ROOM.H, T = ROOM.T;
      const Wx = ROOM.WIN, Dr = ROOM.DOOR;
      const XI = 2.58; // 左右墙内表面

      /* ---- 地板 slab（顶面瓦片化）---- */
      const fl = wallBox([0, -0.06, 0], [5.16, 0.12, 4.4], {
        face: (k, f) => {
          if (k === 'pz') { f.fill = () => STYLE.c('section'); f.stroke = 'outline'; }
          if (k === 'py') { f.fill = null; f.stroke = null; }
        }
      });
      F.push(...fl.faces);
      for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 5; iz++) {
        const x0 = -2.58 + ix * 0.86, z0 = -2.2 + iz * 0.88;
        F.push(B.face([[x0, 0, z0], [x0, 0, z0 + 0.88], [x0 + 0.86, 0, z0 + 0.88], [x0 + 0.86, 0, z0]],
          { fill: 'auto', stroke: null, hatch: false }));
      }
      for (let x = -2.4; x <= 2.41; x += 0.42) {
        S.push(B.stroke([[x, 0.0015, -2.2], [x, 0.0015, 2.2]], { w: 'hair', alpha: 0.4, zBias: 0.002 }));
      }
      for (let i = 0; i < 26; i++) {
        const lane = Math.floor(M.hash(i * 3.7) * 12);
        const x = -2.4 + lane * 0.42 + 0.21;
        const z = -2.2 + M.hash(i + 99) * 4.3;
        S.push(B.stroke([[x - 0.2, 0.0015, z], [x + 0.2, 0.0015, z]], { w: 'hair', alpha: 0.3, zBias: 0.002 }));
      }
      S.push(B.stroke([[-XI, 0, 2.2], [XI, 0, 2.2]], { w: 'outline', zBias: 0.02 }));
      S.push(B.stroke([[-XI, 0, -2.2], [-XI, 0, 2.2]], { w: 'hair', alpha: 0.5, zBias: 0.004 }));
      S.push(B.stroke([[XI, 0, -2.2], [XI, 0, 2.2]], { w: 'hair', alpha: 0.5, zBias: 0.004 }));

      /* ---- 后墙（带窗洞，保持厚度盒）---- */
      const bz = [-2.32, -2.2];
      const segs = [
        [[-2.7, Wx.x0], [0, H]],
        [[Wx.x1, 2.7], [0, H]],
        [[Wx.x0, Wx.x1], [Wx.y1, H]],
        [[Wx.x0, Wx.x1], [0, Wx.y0]]
      ];
      for (const [[x0, x1], [y0, y1]] of segs) {
        F.push(...wallBox([(x0 + x1) / 2, (y0 + y1) / 2, (bz[0] + bz[1]) / 2],
          [x1 - x0, y1 - y0, bz[1] - bz[0]]).faces);
      }
      /* 窗框与窗台 */
      const fw = 0.055;
      F.push(...wallBox([(Wx.x0 + Wx.x1) / 2, Wx.y1 + fw / 2, -2.24], [Wx.x1 - Wx.x0 + fw * 2, fw, 0.09]).faces);
      F.push(...wallBox([(Wx.x0 + Wx.x1) / 2, Wx.y0 - fw / 2, -2.24], [Wx.x1 - Wx.x0 + fw * 2, fw, 0.09]).faces);
      F.push(...wallBox([Wx.x0 - fw / 2, (Wx.y0 + Wx.y1) / 2, -2.24], [fw, Wx.y1 - Wx.y0, 0.09]).faces);
      F.push(...wallBox([Wx.x1 + fw / 2, (Wx.y0 + Wx.y1) / 2, -2.24], [fw, Wx.y1 - Wx.y0, 0.09]).faces);
      F.push(...wallBox([(Wx.x0 + Wx.x1) / 2, (Wx.y0 + Wx.y1) / 2, -2.235], [0.035, Wx.y1 - Wx.y0, 0.05]).faces);
      F.push(...wallBox([(Wx.x0 + Wx.x1) / 2, (Wx.y0 + Wx.y1) / 2, -2.235], [Wx.x1 - Wx.x0, 0.035, 0.05]).faces);
      F.push(...wallBox([(Wx.x0 + Wx.x1) / 2, Wx.y0 - 0.028, -2.15], [Wx.x1 - Wx.x0 + 0.22, 0.045, 0.15],
        { face: (k, f) => { if (k === 'py') f.stroke = 'edge'; } }).faces);
      S.push(B.stroke([[Wx.x0, Wx.y0, -2.199], [Wx.x1, Wx.y0, -2.199], [Wx.x1, Wx.y1, -2.199], [Wx.x0, Wx.y1, -2.199], [Wx.x0, Wx.y0, -2.199]],
        { w: 'edge', zBias: 0.004 }));

      /* ---- 左墙（剖切单面 + 瓦片，x=-2.58 朝 +x）---- */
      const lwSegs = rectMinus(-2.2, 0, 2.2, H, Dr.z0, 0, Dr.z1, Dr.h);
      for (const [z0, y0, z1, y1] of lwSegs) tilePlane(F, -XI, 'x+', z0, y0, z1, y1);
      // 门套线
      S.push(B.stroke([[-2.579, 0, Dr.z0 - 0.06], [-2.579, 0, Dr.z1 + 0.06]], { w: 'detail', zBias: 0.004 }));
      S.push(B.stroke([[-2.579, Dr.h + 0.06, Dr.z0 - 0.06], [-2.579, Dr.h + 0.06, Dr.z1 + 0.06]], { w: 'detail', zBias: 0.004 }));
      S.push(B.stroke([[-2.579, 0, Dr.z0 - 0.06], [-2.579, Dr.h + 0.06, Dr.z0 - 0.06]], { w: 'detail', zBias: 0.004 }));
      S.push(B.stroke([[-2.579, 0, Dr.z1 + 0.06], [-2.579, Dr.h + 0.06, Dr.z1 + 0.06]], { w: 'detail', zBias: 0.004 }));

      /* ---- 右墙（剖切单面 + 瓦片，x=+2.58 朝 -x）---- */
      tilePlane(F, XI, 'x-', -2.2, 0, 2.2, H);

      /* 墙面转角与顶沿线 */
      S.push(B.stroke([[-XI, 0, -2.2], [-XI, H, -2.2]], { w: 'edge', zBias: 0.004 }));
      S.push(B.stroke([[XI, 0, -2.2], [XI, H, -2.2]], { w: 'edge', zBias: 0.004 }));
      S.push(B.stroke([[-XI, H, -2.2], [-XI, H, 2.2]], { w: 'edge', zBias: 0.004 }));
      S.push(B.stroke([[XI, H, -2.2], [XI, H, 2.2]], { w: 'edge', zBias: 0.004 }));
      S.push(B.stroke([[-XI, H, -2.2], [XI, H, -2.2]], { w: 'edge', zBias: 0.004 }));

      /* ---- 天花 slab（底面瓦片化）---- */
      const ce = wallBox([0, H + 0.06, 0], [5.16, 0.12, 4.4], {
        face: (k, f) => {
          if (k === 'ny') { f.fill = null; f.stroke = null; }
          if (k === 'pz') { f.fill = () => STYLE.c('section'); f.stroke = 'outline'; }
        }
      });
      F.push(...ce.faces);
      for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 5; iz++) {
        const x0 = -2.58 + ix * 1.032, z0 = -2.2 + iz * 0.88;
        F.push(B.face([[x0, H, z0], [x0 + 1.032, H, z0], [x0 + 1.032, H, z0 + 0.88], [x0, H, z0 + 0.88]],
          { fill: 'auto', stroke: null, hatch: true }));
      }

      /* ---- 踢脚线 + 挂画线 + 剖切粗轮廓 ---- */
      const skirt = (a, b) => {
        S.push(B.stroke([[a[0], 0.085, a[1]], [b[0], 0.085, b[1]]], { w: 'detail', alpha: 0.85, zBias: 0.004 }));
        S.push(B.stroke([[a[0], 0.1, a[1]], [b[0], 0.1, b[1]]], { w: 'hair', alpha: 0.6, zBias: 0.004 }));
      };
      skirt([-2.7, -2.199], [2.7, -2.199]);
      skirt([-2.699, -2.2], [-2.699, Dr.z0 - 0.06]);
      skirt([-2.699, Dr.z1 + 0.06], [-2.699, 2.2]);
      skirt([2.699, -2.2], [2.699, 2.2]);
      S.push(B.stroke([[-2.7, 2.45, -2.199], [2.7, 2.45, -2.199]], { w: 'hair', alpha: 0.4, zBias: 0.004 }));
      S.push(B.stroke([[-2.699, 2.45, -2.2], [-2.699, 2.45, 2.2]], { w: 'hair', alpha: 0.4, zBias: 0.004 }));
      S.push(B.stroke([[2.699, 2.45, -2.2], [2.699, 2.45, 2.2]], { w: 'hair', alpha: 0.4, zBias: 0.004 }));
      S.push(B.stroke([[-XI, 0, 2.2], [-XI, H, 2.2]], { w: 'outline', zBias: 0.02 }));
      S.push(B.stroke([[XI, 0, 2.2], [XI, H, 2.2]], { w: 'outline', zBias: 0.02 }));
      S.push(B.stroke([[-XI, H, 2.2], [XI, H, 2.2]], { w: 'outline', zBias: 0.02 }));

      /* ---- 窗光落在地板上（zBias 压过大面平均深度偏差）---- */
      F.push(B.face([
        [Wx.x0 - 0.05, 0.004, -2.19], [Wx.x1 + 0.05, 0.004, -2.19],
        [Wx.x1 - 0.25, 0.004, -1.05], [Wx.x0 - 0.55, 0.004, -1.05]
      ], {
        dbl: true, stroke: null, hatch: false, zBias: 0.6,
        fill: () => {
          const t = RLR.Engine.env.t;
          return t < 0.5 ? 'rgba(233,222,190,' + (0.34 - t * 0.2).toFixed(3) + ')'
            : 'rgba(150,168,215,' + ((t - 0.5) * 0.2).toFixed(3) + ')';
        }
      }));
    }

    /* 在 x=const 平面上铺瓦片（朝向 +x 或 -x），自动避让门窗洞 */
    function tilePlane(F, x, dir, z0, y0, z1, y1) {
      const nz = 5, ny = 4;
      const dz = (z1 - z0) / nz, dy = (y1 - y0) / ny;
      for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) {
        const a0 = z0 + iz * dz, a1 = a0 + dz;
        const b0 = y0 + iy * dy, b1 = b0 + dy;
        for (const [c0, d0, c1, d1] of rectMinus(a0, b0, a1, b1, ROOM.DOOR.z0, 0, ROOM.DOOR.z1, ROOM.DOOR.h)) {
          let pts;
          if (dir === 'x+') pts = [[x, d0, c1], [x, d0, c0], [x, d1, c0], [x, d1, c1]];
          else pts = [[x, d0, c0], [x, d0, c1], [x, d1, c1], [x, d1, c0]];
          F.push(B.face(pts, { fill: 'auto', stroke: null, hatch: true }));
        }
      }
    }

    return o;
  }

  RLR.createRoom = createRoom;
  RLR.createBackdrop = createBackdrop;
})();
