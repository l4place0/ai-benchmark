/* 线之屋 · 挂画 A（后墙，歪挂可扶正）与 B（右墙，三联简笔画切换） */
(function () {
  const B = RLR.B, E = RLR.E, STYLE = RLR.STYLE;

  /* ============ A：后墙，面朝 +z ============ */
  function createArtA(opts) {
    const o = {
      name: 'artA', label: '挂画', interactive: true,
      pivot: opts.pivot || [-1.78, 2.02, -2.185], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      straight: false, hyaw: 0, pressK: 0,

      build() {
        const F = o.faces, S = o.strokes;
        /* pic 部件：顶部挂点，初始歪 4°（0.07 rad） */
        o.parts.pic = { pivot: [0, 0.26, 0.012], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0.07 };
        /* 框体：前面不封板露出内衬，前缘内框线 */
        F.push(...B.box([0, 0, 0], [0.66, 0.50, 0.035], {
          part: 'pic',
          face: (k, f) => {
            if (k === 'pz') {
              f.fill = null; f.stroke = 'outline';
              f.strokes = [{ pts: [
                [-0.28, -0.20, 0.0175], [0.28, -0.20, 0.0175],
                [0.28, 0.20, 0.0175], [-0.28, 0.20, 0.0175], [-0.28, -0.20, 0.0175]
              ], w: 'detail', alpha: 0.85 }];
            } else if (k === 'nz') f.stroke = 'edge';
          }
        }).faces);
        /* 内衬 + 简笔画面（随框同歪） */
        const liner = B.face([[-0.28, -0.20, 0.012], [0.28, -0.20, 0.012], [0.28, 0.20, 0.012], [-0.28, 0.20, 0.012]],
          { fill: () => STYLE.c('paper'), stroke: 'hair', zBias: 0.002, part: 'pic' });
        liner.strokes = doodlesA();
        F.push(liner);
        /* 钉子（root，不随框动）+ 两根挂绳（pic 内，连钉到框顶两角） */
        S.push(B.stroke([[0, 0.285, 0.008], [0, 0.30, 0.008]], { w: 'detail' }));
        S.push(B.stroke([[-0.004, 0.293, 0.008], [0.004, 0.293, 0.008]], { w: 'hair' }));
        S.push(B.stroke([[0, 0.03, -0.004], [0.29, -0.015, -0.004]], { w: 'hair', alpha: 0.8, part: 'pic' }));
        S.push(B.stroke([[0, 0.03, -0.004], [-0.29, -0.015, -0.004]], { w: 'hair', alpha: 0.8, part: 'pic' }));
        o.hits.push({ c: [0, 0, 0.02], h: [0.36, 0.29, 0.05] });
      },

      onHover(on) { RLR.Engine.tw(o, 'hyaw', on ? 0.035 : 0, 0.4, E.outBack); },
      onPress(down) { RLR.Engine.tw(o, 'pressK', down ? -0.006 : 0, 0.25, E.outQuad); },
      action() {
        RLR.Audio.play('flick');
        if (!o.straight) {
          o.straight = true;
          RLR.Engine.tw(o.parts.pic, 'roll', 0, 0.9, E.outBack);   /* 第一次：扶正 */
        } else {
          const d = Math.random() < 0.5 ? -0.03 : 0.03;            /* 之后：弹 ±0.03 再回 */
          RLR.Engine.tw(o.parts.pic, 'roll', d, 0.16, E.outQuad,
            () => RLR.Engine.tw(o.parts.pic, 'roll', 0, 0.55, E.outBack));
        }
      },

      update() {
        o.parts.pic.yaw = o.hyaw;          /* 悬停轻转 */
        o.parts.pic.off[2] = o.pressK;     /* 按压时贴回墙面 */
      }
    };
    return o;
  }

  /* 画面：两座山 + 圆圈太阳 + 两只飞鸟（内衬面附属线） */
  function doodlesA() {
    const z = 0.0125, ds = [];
    const line = (pts, w, al) => ds.push({ pts, w, alpha: al == null ? 0.85 : al });
    line([[-0.26, -0.07, z], [0.26, -0.07, z]], 'hair', 0.5);
    line([[-0.24, -0.07, z], [-0.13, 0.055, z], [-0.03, -0.07, z]]);
    line([[-0.07, -0.07, z], [0.045, 0.025, z], [0.15, -0.07, z]]);
    const sun = [];
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * Math.PI * 2;
      sun.push([0.17 + Math.cos(a) * 0.035, 0.105 + Math.sin(a) * 0.035, z]);
    }
    line(sun, 'detail', 0.9);
    for (const [bx, by] of [[-0.16, 0.10], [-0.05, 0.145]])
      line([[bx - 0.028, by, z], [bx - 0.014, by + 0.014, z], [bx, by, z],
        [bx + 0.014, by + 0.014, z], [bx + 0.028, by, z]], 'detail', 0.9);
    return ds;
  }

  /* ============ B：右墙，面朝 -x，三套画面切换 ============ */
  function createArtB(opts) {
    const o = {
      name: 'artB', label: '挂画', interactive: true,
      pivot: opts.pivot || [2.585, 1.78, -0.80], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
      parts: {}, faces: [], strokes: [], texts: [], hits: [],
      hover: false, press: false,
      set: 0, bnc: 1, hroll: 0, pressK: 0,

      build() {
        const F = o.faces, S = o.strokes;
        o.parts.pic = { pivot: [0, 0, 0], off: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: [1, 1, 1] };
        /* 框体：x 薄，-x 面朝室内不封板 */
        F.push(...B.box([0, 0, 0], [0.035, 0.46, 0.60], {
          part: 'pic',
          face: (k, f) => {
            if (k === 'nx') {
              f.fill = null; f.stroke = 'outline';
              f.strokes = [{ pts: [
                [-0.0175, -0.18, -0.25], [-0.0175, -0.18, 0.25],
                [-0.0175, 0.18, 0.25], [-0.0175, 0.18, -0.25], [-0.0175, -0.18, -0.25]
              ], w: 'detail', alpha: 0.85 }];
            } else if (k === 'px') f.stroke = 'edge';
          }
        }).faces);
        F.push(B.face([[-0.012, -0.18, 0.25], [-0.012, -0.18, -0.25], [-0.012, 0.18, -0.25], [-0.012, 0.18, 0.25]],
          { dbl: true, fill: () => STYLE.c('paper'), stroke: 'hair', zBias: 0.002, part: 'pic' }));
        /* 三套简笔画全部建好，用 alpha 0/1 切换 */
        o.sets = [setBoat(), setCat(), setFlower()];
        o.sets.forEach((set, i) => set.forEach(s => { s.alpha = i === 0 ? 1 : 0; S.push(s); }));
        o.hits.push({ c: [0, 0, 0], h: [0.05, 0.26, 0.33] });
      },

      onHover(on) { RLR.Engine.tw(o, 'hroll', on ? 0.02 : 0, 0.4, E.outBack); },
      onPress(down) { RLR.Engine.tw(o, 'pressK', down ? 1 : 0, 0.2, E.outQuad); },
      action() {
        o.set = (o.set + 1) % 3;
        o.sets.forEach((set, i) => set.forEach(s => { s.alpha = i === o.set ? 1 : 0; }));
        RLR.Audio.play('flip');
        /* 弹跳：标量 1→0.94→1，update 写回 scale */
        RLR.Engine.tw(o, 'bnc', 0.94, 0.13, E.outQuad, () => RLR.Engine.tw(o, 'bnc', 1, 0.45, E.outBack));
      },

      update() {
        const p = o.parts.pic;
        p.roll = o.hroll;
        p.off[0] = o.pressK * 0.004;       /* 按压贴墙 */
        p.scale = [o.bnc, o.bnc, o.bnc];
      }
    };
    return o;
  }

  function stX() {
    const X = -0.0128;
    return (pts, w, al) => B.stroke(pts.map(p => [X, p[0], p[1]]),
      { w: w || 'detail', alpha: al == null ? 0.9 : al, part: 'pic', zBias: 0.003 });
  }
  function circleSt(st, cy, cz, r, n, w, al) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      pts.push([cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return st(pts, w, al);
  }
  /* 小船 + 波浪（坐标 [y,z]） */
  function setBoat() {
    const st = stX(), r = [];
    r.push(st([[0.01, -0.14], [0.01, 0.14], [-0.06, 0.06], [-0.06, -0.06], [0.01, -0.14]]));
    r.push(st([[0.01, 0], [0.15, 0]]));
    r.push(st([[0.15, 0], [0.045, 0.10], [0.045, 0], [0.15, 0]]));
    for (const [wy, wa] of [[-0.10, 0], [-0.135, 1.4]]) {
      const w = [];
      for (let i = 0; i <= 10; i++) w.push([wy + 0.008 * Math.sin(i * 1.9 + wa), -0.20 + i * 0.04]);
      r.push(st(w, 'hair', 0.6));
    }
    return r;
  }
  /* 猫：圆头 + 耳 + 须 + 身弧 + 尾 */
  function setCat() {
    const st = stX(), r = [];
    r.push(circleSt(st, 0.06, -0.06, 0.045, 14));
    r.push(st([[0.09, -0.095], [0.128, -0.105], [0.10, -0.055]]));
    r.push(st([[0.09, -0.025], [0.128, -0.015], [0.10, -0.065]]));
    r.push(st([[0.062, -0.078], [0.066, -0.072]], 'hair', 0.8));
    r.push(st([[0.062, -0.048], [0.066, -0.042]], 'hair', 0.8));
    for (const q of [[0.055, -0.10, 0.045, -0.125], [0.062, -0.102, 0.058, -0.128],
      [0.055, -0.02, 0.045, 0.005], [0.062, -0.018, 0.058, 0.008]])
      r.push(st([[q[0], q[1]], [q[2], q[3]]], 'hair', 0.7));
    r.push(st([[0.015, -0.045], [-0.05, -0.04], [-0.09, 0.01], [-0.055, 0.10], [0.01, 0.125]]));
    r.push(st([[-0.09, 0.01], [-0.13, 0.05], [-0.105, 0.105], [-0.06, 0.12]], 'detail', 0.8));
    r.push(st([[-0.045, 0.115], [-0.04, 0.03]], 'hair', 0.6));
    return r;
  }
  /* 盆花：盆梯形 + 茎 + 叶 + 三瓣 + 花心 */
  function setFlower() {
    const st = stX(), r = [];
    r.push(st([[-0.13, -0.03], [-0.13, 0.03], [-0.06, 0.05], [-0.06, -0.05], [-0.13, -0.03]]));
    r.push(st([[-0.062, -0.056], [-0.062, 0.056]], 'hair', 0.7));
    r.push(st([[-0.06, 0], [0.055, 0]]));
    r.push(st([[-0.01, 0], [0.005, -0.028], [0.015, -0.002]], 'hair', 0.7));
    for (const [py, pz] of [[0.10, -0.028], [0.078, 0.016], [0.122, 0.016]])
      r.push(circleSt(st, py, pz, 0.022, 10, 'detail', 0.9));
    r.push(circleSt(st, 0.10, 0, 0.009, 8, 'hair', 0.7));
    return r;
  }

  RLR.createArtA = createArtA;
  RLR.createArtB = createArtB;
})();
