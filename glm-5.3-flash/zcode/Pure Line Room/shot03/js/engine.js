/* 线之屋 · 渲染引擎：投影 / 画家算法 / 明暗与排线 / 拾取 / 相机 / 补间 */
(function () {
  const M = RLR.M, E = RLR.E, STYLE = RLR.STYLE;

  const Eng = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    scene: [], byName: {},
    env: { t: 0, reveal: false, hover: null, time: new Date() },
    cam: {
      yaw: 0.28, pitch: 0.30, dist: 7.2, target: [0, 0.95, -0.1],
      cyaw: 1.5, cpitch: 0.05, cdist: 10.8, ctarget: [0, 0.95, -0.1],
      fov: 45 * Math.PI / 180, rate: 6.5
    },
    light: { lampPos: null, lampI: 0 },
    tweens: [], dust: [],
    _eye: [0, 0, 0], _basis: { d: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] }, _focal: 600,
    _tGlob: 0, _gust: { amp: 0, age: 99, dur: 1 }, _gustNext: 5, _lastNight: -1
  };

  /* ---------- 相机与投影 ---------- */
  function updateCam(dt) {
    const c = Eng.cam, k = 1 - Math.exp(-dt * (c.rate || 6.5));
    c.cyaw += (c.yaw - c.cyaw) * k;
    c.cpitch += (c.pitch - c.cpitch) * k;
    c.cdist += (c.dist - c.cdist) * k;
    c.ctarget = M.lerp3(c.ctarget, c.target, k);
    let pitch = c.cpitch, dist = c.cdist;
    const ty = c.ctarget[1];
    const maxEye = 2.88;
    if (ty + dist * Math.sin(pitch) > maxEye) {
      pitch = Math.asin(Math.min(0.999, (maxEye - ty) / dist));
      c.cpitch = pitch;
    }
    // 偏航限位：保证机位不越过侧墙平面过深（剖切透视下越界会看到家具背面）
    const reach = Math.max(0.5, dist * Math.cos(pitch));
    const maxYaw = Math.asin(M.clamp((2.45 - Math.abs(c.ctarget[0])) / reach, 0.10, 1.05));
    c.yaw = M.clamp(c.yaw, -maxYaw, maxYaw);
    c.cyaw = M.clamp(c.cyaw, -maxYaw, maxYaw);
    const cp = Math.cos(pitch);
    Eng._eye = [
      c.ctarget[0] + dist * cp * Math.sin(c.cyaw),
      ty + dist * Math.sin(pitch),
      c.ctarget[2] + dist * cp * Math.cos(c.cyaw)
    ];
    const eye = Eng._eye;
    const d = M.norm(M.sub(c.ctarget, eye));
    let r = M.cross(d, [0, 1, 0]);
    if (M.len(r) < 1e-4) r = [1, 0, 0];
    r = M.norm(r);
    const u = M.cross(r, d);
    Eng._basis = { d, r, u };
    Eng._focal = (Eng.H / 2) / Math.tan(c.fov / 2);
  }

  function project(p) {
    const eye = Eng._eye, b = Eng._basis;
    const rel = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    const vz = M.dot(rel, b.d);
    if (vz < 0.06) return null;
    const s = Eng._focal / vz;
    return { x: Eng.W / 2 + M.dot(rel, b.r) * s, y: Eng.H / 2 - M.dot(rel, b.u) * s, s, vz };
  }

  /* ---------- 变换 ---------- */
  function rotApply(q, yaw, pitch, roll) {
    if (yaw) q = M.rotY(q, yaw);
    if (pitch) q = M.rotX(q, pitch);
    if (roll) q = M.rotZ(q, roll);
    return q;
  }
  function xfPoint(p, xf) {
    let q = p;
    if (xf.pivot) q = [q[0] - xf.pivot[0], q[1] - xf.pivot[1], q[2] - xf.pivot[2]];
    if (xf.scale) q = [q[0] * xf.scale[0], q[1] * xf.scale[1], q[2] * xf.scale[2]];
    q = rotApply(q, xf.yaw || 0, xf.pitch || 0, xf.roll || 0);
    if (xf.pivot) q = [q[0] + xf.pivot[0], q[1] + xf.pivot[1], q[2] + xf.pivot[2]];
    if (xf.off) q = [q[0] + xf.off[0], q[1] + xf.off[1], q[2] + xf.off[2]];
    return q;
  }
  function partChain(obj, partName) {
    const chain = [];
    let nm = partName, guard = 0;
    while (nm && obj.parts[nm] && guard++ < 8) { chain.push(obj.parts[nm]); nm = obj.parts[nm].parent; }
    return chain; // 内 → 外顺序需反转为 外→内? 实际应用：最内层先作用于点
  }
  function worldPt(obj, partName, p) {
    let q = p;
    if (partName && obj.parts[partName]) {
      const chain = partChain(obj, partName);
      for (let i = chain.length - 1; i >= 0; i--) q = xfPoint(q, chain[i]);
    }
    if (obj.yaw || obj.pitch || obj.roll) q = rotApply(q, obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
    const pv = obj.pivot, off = obj.off;
    return [q[0] + pv[0] + (off ? off[0] : 0), q[1] + pv[1] + (off ? off[1] : 0), q[2] + pv[2] + (off ? off[2] : 0)];
  }
  function worldDir(obj, partName, v) {
    let q = v;
    if (partName && obj.parts[partName]) {
      const chain = partChain(obj, partName);
      for (let i = chain.length - 1; i >= 0; i--) {
        const xf = chain[i];
        if (xf.scale) q = [q[0] * xf.scale[0], q[1] * xf.scale[1], q[2] * xf.scale[2]];
        q = rotApply(q, xf.yaw || 0, xf.pitch || 0, xf.roll || 0);
      }
    }
    if (obj.yaw || obj.pitch || obj.roll) q = rotApply(q, obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
    return q;
  }

  /* ---------- 明暗 ---------- */
  const L1day = M.norm([0.36, 0.80, -0.46]), L1night = M.norm([-0.28, 0.80, -0.42]);
  function shadeK(n, c) {
    const t = Eng.env.t;
    const amb = M.lerp(0.58, 0.30, t), dirI = M.lerp(0.42, 0.24, t);
    const L = M.lerp3(L1day, L1night, t);
    let lit = amb + dirI * Math.max(0, M.dot(n, L));
    const lp = Eng.light.lampPos, li = Eng.light.lampI;
    if (lp && li > 0.01) {
      const to = M.sub(lp, c), dist = M.len(to) || 1;
      lit += li * Math.max(0, M.dot(n, M.scale(to, 1 / dist))) / (1 + 6 * dist * dist);
    }
    return M.clamp(1 - lit, 0, 1);
  }

  function clipSegPoly(a, b, poly) {
    let t0 = 0, t1 = 1;
    const n = poly.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      area += p[0] * q[1] - q[0] * p[1];
    }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const q1 = poly[i], q2 = poly[(i + 1) % n];
      const ex = q2[0] - q1[0], ey = q2[1] - q1[1];
      const nx = sgn > 0 ? -ey : ey, ny = sgn > 0 ? ex : -ex;
      const den = (b[0] - a[0]) * nx + (b[1] - a[1]) * ny;
      const num = (q1[0] - a[0]) * nx + (q1[1] - a[1]) * ny;
      if (Math.abs(den) < 1e-9) { if (num < 0) return null; continue; }
      const t = num / den;
      if (den < 0) { if (t > t0) t0 = t; } else { if (t < t1) t1 = t; }
      if (t0 > t1) return null;
    }
    return [[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
            [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]];
  }

  /* ---------- 收集与绘制 ---------- */
  function pushObj(obj, buf) {
    for (const f of obj.faces) {
      const wp = new Array(f.pts.length);
      let z = 0, ok = true;
      for (let i = 0; i < f.pts.length; i++) {
        wp[i] = worldPt(obj, f.part, f.pts[i]);
        const pr = project(wp[i]);
        if (!pr) { ok = false; break; }
        z += pr.vz;
      }
      if (!ok) continue;
      z /= f.pts.length;
      const e1 = M.sub(wp[1], wp[0]), e2 = M.sub(wp[2], wp[1]);
      let n = M.norm(M.cross(e1, e2));
      if (!f.dbl) {
        const cx = (wp[0][0] + wp[2][0]) / 2, cy = (wp[0][1] + wp[2][1]) / 2, cz = (wp[0][2] + wp[2][2]) / 2;
        if (M.dot(n, [cx - Eng._eye[0], cy - Eng._eye[1], cz - Eng._eye[2]]) > 0) continue;
      }
      buf.push({ kind: 'face', z, zBias: f.zBias || 0, f, wp, obj, n });
    }
    for (const s of obj.strokes) {
      const wp = new Array(s.pts.length);
      let z = 0, ok = true;
      for (let i = 0; i < s.pts.length; i++) {
        wp[i] = worldPt(obj, s.part, s.pts[i]);
        const pr = project(wp[i]);
        if (!pr) { ok = false; break; }
        z += pr.vz;
      }
      if (!ok) continue;
      buf.push({ kind: 'stroke', z: z / s.pts.length, zBias: s.zBias || 0, s, wp, obj });
    }
    for (const tx of obj.texts) {
      const w = worldPt(obj, tx.part, tx.p);
      const pr = project(w);
      if (!pr) continue;
      buf.push({ kind: 'text', z: pr.vz, zBias: tx.zBias || 0, tx, pr, obj });
    }
  }

  function drawFace(d, ctx) {
    const f = d.f, obj = d.obj;
    const ink = STYLE.c('ink');
    ctx.globalAlpha = f.alpha;
    let k = 0;
    if (f.fill) {
      let col = f.fill;
      if (col === 'auto' || typeof col === 'function') {
        k = shadeK(d.n, d.wp[0]);
        col = (typeof col === 'function') ? col(k) : STYLE.shadeFill(k);
      }
      if (col) {
        ctx.beginPath();
        ctx.moveTo(d.scr[0].x, d.scr[0].y);
        for (let i = 1; i < d.scr.length; i++) ctx.lineTo(d.scr[i].x, d.scr[i].y);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    // 附属子面（贴在大面上的贴花，如地面光斑）：紧跟宿主面填充，避免大面平均深度排序遮挡
    if (f.subs && d.obj) {
      for (const sf of f.subs) {
        const wp = new Array(sf.pts.length);
        let ok2 = true;
        const scr2 = [];
        for (let i = 0; i < sf.pts.length; i++) {
          wp[i] = worldPt(d.obj, f.part, sf.pts[i]);
          const pr = project(wp[i]);
          if (!pr) { ok2 = false; break; }
          scr2.push(pr);
        }
        if (!ok2) continue;
        let col2 = typeof sf.fill === 'function' ? sf.fill() : sf.fill;
        if (!col2) continue;
        ctx.beginPath();
        ctx.moveTo(scr2[0].x, scr2[0].y);
        for (let i = 1; i < scr2.length; i++) ctx.lineTo(scr2[i].x, scr2[i].y);
        ctx.closePath();
        ctx.globalAlpha = sf.alpha != null ? sf.alpha : 1;
        ctx.fillStyle = col2;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    const sAvg = d.scr[0].s;
    if (k > 0.52 && f.hatch !== false && d.scr.length >= 3) hatch(d, k, ctx, sAvg);
    if (f.stroke) {
      const hoverW = obj && obj.hover ? 1.45 : 1;
      ctx.strokeStyle = ink;
      ctx.lineWidth = widthOf(f.stroke) * f.w * clampS(sAvg) * hoverW;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.moveTo(d.scr[0].x, d.scr[0].y);
      for (let i = 1; i < d.scr.length; i++) ctx.lineTo(d.scr[i].x, d.scr[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    if (f.strokes) for (const s of f.strokes) drawStrokePts(s.pts, s, ctx, obj, f.part);
  }

  function hatch(d, k, ctx, sAvg) {
    const n = d.n, t = Eng.env.t;
    const L = M.lerp3(L1day, L1night, t);
    let u = M.cross(n, L);
    if (M.len(u) < 0.25) u = [1, 0, 0];
    u = M.norm(u);
    const v = M.cross(n, u);
    const p2 = d.wp.map(p => [M.dot(p, u), M.dot(p, v)]);
    let minV = 1e9, maxV = -1e9, minU = 1e9, maxU = -1e9;
    for (const q of p2) { minV = Math.min(minV, q[1]); maxV = Math.max(maxV, q[1]); minU = Math.min(minU, q[0]); maxU = Math.max(maxU, q[0]); }
    const sp = 0.05 + 0.045 * k;
    const ink = STYLE.c('ink');
    ctx.strokeStyle = ink;
    ctx.globalAlpha = Math.min(0.5, (0.13 + 0.26 * k) * d.f.alpha);
    ctx.lineWidth = STYLE.widths.hair * clampS(sAvg);
    ctx.beginPath();
    for (let off = Math.ceil(minV / sp) * sp; off <= maxV; off += sp) {
      const seg = clipSegPoly([minU - 0.01, off], [maxU + 0.01, off], p2);
      if (!seg) continue;
      const a = project(M.add(M.scale(u, seg[0][0]), M.scale(v, seg[0][1])));
      const b = project(M.add(M.scale(u, seg[1][0]), M.scale(v, seg[1][1])));
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function widthOf(w) {
    if (typeof w === 'number') return STYLE.widths.detail * w;
    return STYLE.widths[w] || STYLE.widths.detail;
  }
  function clampS(s) { return M.clamp(s * 0.28, 0.72, 1.85); }

  function drawStrokePts(ptsIn, s, ctx, obj, partName, world) {
    const ink = s.col || STYLE.c('ink');
    ctx.strokeStyle = ink;
    ctx.globalAlpha = (s.alpha != null ? s.alpha : 1);
    const p0 = world ? ptsIn[0] : worldPt(obj, partName || s.part, ptsIn[0]);
    const pr0 = project(p0);
    ctx.lineWidth = widthOf(s.w) * clampS(pr0 ? pr0.s : 1) * (obj && obj.hover ? 1.3 : 1);
    if (s.dash) ctx.setLineDash(s.dash);
    ctx.beginPath();
    let started = false;
    for (const p of ptsIn) {
      const w = world ? p : worldPt(obj, partName || s.part, p);
      const pr = project(w);
      if (!pr) { started = false; continue; }
      if (!started) { ctx.moveTo(pr.x, pr.y); started = true; }
      else ctx.lineTo(pr.x, pr.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawStandalone(d, ctx) {
    const s = d.s;
    drawStrokePts(d.wp, s, ctx, d.obj, null, true); // d.wp 已是世界坐标，勿再变换
  }

  function drawText(d, ctx) {
    const tx = d.tx;
    const px = Math.max(6, tx.size * d.pr.s);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = tx.col || STYLE.c('ink');
    ctx.font = '600 ' + px.toFixed(1) + 'px Georgia, "Times New Roman", serif';
    ctx.textAlign = tx.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tx.s, d.pr.x, d.pr.y);
    ctx.globalAlpha = 1;
  }

  /* ---------- 渲染主循环 ---------- */
  const buf = [], bgBuf = [];
  function render() {
    const ctx = Eng.ctx;
    ctx.setTransform(Eng.dpr, 0, 0, Eng.dpr, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = STYLE.c('paper');
    ctx.fillRect(0, 0, Eng.W, Eng.H);
    buf.length = 0; bgBuf.length = 0;
    for (const obj of Eng.scene) pushObj(obj, obj.background ? bgBuf : buf);
    pushDust(buf);
    const drawBuf = (b) => {
      for (const d of b) {
        if (d.kind === 'face') {
          d.scr = new Array(d.wp.length);
          for (let i = 0; i < d.wp.length; i++) d.scr[i] = project(d.wp[i]);
        }
        d.key = d.z - (d.zBias || 0);
      }
      b.sort((a, b2) => b2.key - a.key);
      for (const d of b) {
        if (d.kind === 'face') drawFace(d, ctx);
        else if (d.kind === 'stroke') drawStandalone(d, ctx);
        else if (d.kind === 'dust') {
          ctx.globalAlpha = d.alpha;
          ctx.fillStyle = STYLE.c('ink');
          ctx.beginPath();
          ctx.arc(d.pr.x, d.pr.y, 0.9, 0, 6.29);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        else drawText(d, ctx);
      }
    };
    drawBuf(bgBuf);
    drawBuf(buf);
    drawGlow(ctx);
    drawOverlays(ctx);
  }

  function drawGlow(ctx) {
    const lp = Eng.light.lampPos, li = Eng.light.lampI;
    if (lp && li > 0.02) {
      const pr = project(lp);
      if (pr) {
        const r = 1.6 * pr.s;
        const a = 0.26 * li * (0.3 + 0.7 * Eng.env.t);
        const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, r);
        g.addColorStop(0, 'rgba(255,196,118,' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,196,118,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(pr.x - r, pr.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /* ---------- 尘埃 ---------- */
  function initDust() {
    for (let i = 0; i < 40; i++) {
      Eng.dust.push({
        p: [-0.4 + M.hash(i) * 2.2, 0.3 + M.hash(i + 50) * 1.9, -2.0 + M.hash(i + 90) * 1.0],
        ph: M.hash(i + 7) * 6.28, sp: 0.2 + M.hash(i + 13) * 0.5
      });
    }
  }
  function pushDust(buf) {
    const t = Eng._tGlob, day = 1 - Eng.env.t * 0.65;
    for (const d of Eng.dust) {
      const x = d.p[0] + Math.sin(t * 0.11 * d.sp + d.ph) * 0.12;
      const y = d.p[1] + Math.sin(t * 0.07 * d.sp + d.ph * 2) * 0.16 - (t * 0.008 * d.sp) % 0.4;
      const z = d.p[2] + Math.cos(t * 0.09 * d.sp + d.ph) * 0.08;
      const pr = project([x, (y - 0.3 + 2.4) % 2.2 + 0.25, z]);
      if (!pr) continue;
      buf.push({ kind: 'dust', z: pr.vz, zBias: 0, pr, obj: null, alpha: (0.03 + 0.06 * Math.abs(Math.sin(t * 0.5 + d.ph))) * day });
    }
  }

  function drawOverlays(ctx) {
    const t = Eng._tGlob;
    // 悬停浮签
    if (Eng.env.hover && !Eng.env.reveal) {
      const h = Eng.env.hover;
      ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
      const w = ctx.measureText(h.obj.label).width;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = STYLE.c('paper');
      ctx.strokeStyle = STYLE.c('ink');
      ctx.lineWidth = 1;
      roundRect(ctx, h.x + 12, h.y + 8, w + 14, 22, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = STYLE.c('ink');
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(h.obj.label, h.x + 19, h.y + 20);
      ctx.globalAlpha = 1;
    }
    // H 键标记所有可交互物件
    if (Eng.env.reveal) {
      ctx.font = '12px Georgia, "Times New Roman", serif';
      for (const obj of Eng.scene) {
        if (obj.interactive === false || !obj.hits || !obj.hits.length) continue;
        const h = obj.hits[0];
        const w = worldPt(obj, h.part, h.c);
        const pr = project(w);
        if (!pr) continue;
        const r = 9 + 2.5 * Math.sin(t * 4 + w[0]);
        ctx.strokeStyle = STYLE.c('ink');
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(pr.x, pr.y, r + 8, 0, 6.29); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 2, 0, 6.29);
        ctx.fillStyle = STYLE.c('ink'); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = STYLE.c('paper');
        const tw2 = ctx.measureText(obj.label).width;
        ctx.fillRect(pr.x - tw2 / 2 - 3, pr.y + r + 11, tw2 + 6, 16);
        ctx.fillStyle = STYLE.c('ink');
        ctx.fillText(obj.label, pr.x, pr.y + r + 12);
        ctx.globalAlpha = 1;
      }
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 拾取 ---------- */
  function pick(mx, my) {
    const b = Eng._basis, eye = Eng._eye;
    const ndcX = (mx - Eng.W / 2) / Eng._focal, ndcY = -(my - Eng.H / 2) / Eng._focal;
    const dir = M.norm([
      b.d[0] + b.r[0] * ndcX + b.u[0] * ndcY,
      b.d[1] + b.r[1] * ndcX + b.u[1] * ndcY,
      b.d[2] + b.r[2] * ndcX + b.u[2] * ndcY
    ]);
    let best = null, bestT = 1e9;
    for (const obj of Eng.scene) {
      if (obj.interactive === false || !obj.hits) continue;
      for (const h of obj.hits) {
        const c = worldPt(obj, h.part, h.c);
        const parts = h.part && obj.parts[h.part] ? partChain(obj, h.part) : [];
        const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(ax => {
          let q = ax;
          for (let i = parts.length - 1; i >= 0; i--) {
            const xf = parts[i];
            if (xf.scale) q = [q[0] * xf.scale[0], q[1] * xf.scale[1], q[2] * xf.scale[2]];
            q = rotApply(q, xf.yaw || 0, xf.pitch || 0, xf.roll || 0);
          }
          if (obj.yaw || obj.pitch || obj.roll) q = rotApply(q, obj.yaw || 0, obj.pitch || 0, obj.roll || 0);
          return q;
        });
        const o2 = M.sub(eye, c);
        let tmin = 0, tmax = bestT;
        let hit = true;
        for (let i = 0; i < 3; i++) {
          const axLen = M.len(axes[i]) || 1;
          const ax = [axes[i][0] / axLen, axes[i][1] / axLen, axes[i][2] / axLen];
          const he = h.h[i] * axLen + 0.01;
          const po = M.dot(o2, ax), pd = M.dot(dir, ax);
          if (Math.abs(pd) < 1e-9) { if (Math.abs(po) > he) { hit = false; break; } continue; }
          let t1 = (-he - po) / pd, t2 = (he - po) / pd;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          if (t1 > tmin) tmin = t1;
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) { hit = false; break; }
        }
        if (hit && tmin > 0.02 && tmin < bestT) {
          bestT = tmin;
          best = { obj, tag: h.tag, t: tmin };
        }
      }
    }
    return best;
  }

  /* ---------- 输入 ---------- */
  function setupInput(canvas) {
    const pointers = new Map();
    let pdown = null, pinch = null, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, true);
      lastX = e.clientX; lastY = e.clientY;
      if (pointers.size === 2) {
        const pts = [...pointers.keys()];
        pinch = true;
        if (pdown && pdown.hit) pdown.hit.obj.onPress(false, pdown.hit.tag);
        pdown = null;
        return;
      }
      const hit = (e.button === 0 && !e.shiftKey) ? pick(e.clientX, e.clientY) : null;
      pdown = { x: e.clientX, y: e.clientY, btn: e.button, moved: false, hit };
      if (hit && hit.obj.onPress) hit.obj.onPress(true, hit.tag);
    });
    canvas.addEventListener('pointermove', e => {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (pointers.has(e.pointerId)) {
        if (pointers.size === 2 && pinch) {
          pinch = null; // 简化：双指视为拖动
        }
        if (pdown) {
          if (!pdown.moved && Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) > 6) {
            pdown.moved = true;
            if (pdown.hit && pdown.hit.obj.onPress) pdown.hit.obj.onPress(false, pdown.hit.tag);
          }
          if (pdown.moved) {
            const c = Eng.cam;
            if (pdown.btn === 2 || e.shiftKey) {
              const s = c.cdist / Eng._focal;
              c.target = [
                M.clamp(c.target[0] - (Eng._basis.r[0] * dx + Eng._basis.u[0] * -dy) * s, -1.7, 1.7),
                M.clamp(c.target[1] + (Eng._basis.r[1] * dx + Eng._basis.u[1] * -dy) * s, 0.55, 1.9),
                M.clamp(c.target[2] - (Eng._basis.r[2] * dx + Eng._basis.u[2] * -dy) * s, -1.5, 1.4)
              ];
            } else {
              c.yaw = M.clamp(c.yaw + dx * 0.0052, -1.12, 1.12);
              c.pitch = M.clamp(c.pitch + dy * 0.0042, 0.05, 0.62);
            }
          }
          lastX = e.clientX; lastY = e.clientY;
          canvas.style.cursor = pdown.moved ? 'grabbing' : canvas.style.cursor;
        }
        return;
      }
      // 悬停
      const hit = pick(e.clientX, e.clientY);
      const old = Eng.env.hover;
      if ((old && old.obj) !== (hit && hit.obj)) {
        if (old && old.obj.onHover) old.obj.onHover(false, old.tag);
        if (hit && hit.obj.onHover) hit.obj.onHover(true, hit.tag);
      }
      Eng.env.hover = hit ? { obj: hit.obj, tag: hit.tag, x: e.clientX, y: e.clientY } : null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    });
    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pdown) {
        if (!pdown.moved && pdown.hit) {
          if (pdown.hit.obj.onPress) pdown.hit.obj.onPress(false, pdown.hit.tag);
          if (pdown.hit.obj.action) pdown.hit.obj.action(pdown.hit.tag, e.clientX, e.clientY);
        } else if (pdown.hit && pdown.hit.obj.onPress) {
          pdown.hit.obj.onPress(false, pdown.hit.tag);
        }
      }
      pdown = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const c = Eng.cam;
      c.dist = M.clamp(c.dist * Math.exp(e.deltaY * 0.0011), 3.2, 10.5);
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.key === 'h' || e.key === 'H') { Eng.env.reveal = !Eng.env.reveal; }
      else if (e.key === 'l' || e.key === 'L') {
        const sw = Eng.byName['switch'];
        if (sw && sw.action) sw.action();
      }
      else if (e.key === 'm' || e.key === 'M') {
        const m = RLR.Audio.toggleMute();
        Eng.toast(m ? '已静音' : '声音开启');
      }
    });
  }

  /* ---------- 补间 ---------- */
  function tw(target, key, to, dur, ease, done) {
    for (let i = Eng.tweens.length - 1; i >= 0; i--) {
      const t = Eng.tweens[i];
      if (t.target === target && t.key === key) Eng.tweens.splice(i, 1);
    }
    Eng.tweens.push({ target, key, from: target[key], to, t0: Eng._tGlob, dur, ease: ease || E.outCubic, done });
  }
  function updateTweens() {
    for (let i = Eng.tweens.length - 1; i >= 0; i--) {
      const t = Eng.tweens[i];
      let k = (Eng._tGlob - t.t0) / t.dur;
      if (k >= 1) { k = 1; }
      t.target[t.key] = t.from + (t.to - t.from) * t.ease(k);
      if (k >= 1) { Eng.tweens.splice(i, 1); if (t.done) t.done(); }
    }
  }
  const timers = [];
  function delay(fn, sec) { timers.push({ fn, t: Eng._tGlob + sec }); }

  /* ---------- toast ---------- */
  function toast(msg) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 2600);
  }

  /* ---------- 主循环 ---------- */
  let lastTs = 0;
  function tick(dt) {
    Eng._tGlob += dt;
    updateTweens();
    for (let i = timers.length - 1; i >= 0; i--) {
      if (Eng._tGlob >= timers[i].t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    }
    // 阵风
    const g = Eng._gust;
    g.age += dt;
    if (Eng._tGlob > Eng._gustNext) {
      g.amp = 0.45 + Math.random() * 0.55;
      g.age = 0; g.dur = 3 + Math.random() * 3.5;
      Eng._gustNext = Eng._tGlob + 13 + Math.random() * 22;
    }
    Eng.env.time = new Date();
    updateCam(dt);
    for (const obj of Eng.scene) if (obj.update) { try { obj.update(dt, Eng._tGlob); } catch (e) { console.error('update ' + obj.name, e); } }
    if (RLR.Audio.ready && Math.abs(Eng.env.t - Eng._lastNight) > 0.012) {
      Eng._lastNight = Eng.env.t;
      RLR.Audio.setNight(Eng.env.t);
    }
    render();
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    tick(dt);
  }

  Eng.gustVal = function () {
    const g = Eng._gust;
    const k = M.clamp(g.age / g.dur, 0, 1);
    return g.amp * Math.sin(Math.PI * k);
  };
  Eng.tick = tick;
  Eng.project = project;
  Eng.pick = pick;
  Eng.tw = tw;
  Eng.delay = delay;
  Eng.toast = toast;
  Eng.add = function (obj) {
    if (obj.build) obj.build();
    if (!obj.pivot) obj.pivot = [0, 0, 0];
    if (!obj.off) obj.off = [0, 0, 0];
    if (!obj.parts) obj.parts = {};
    Eng.scene.push(obj);
    if (obj.name) Eng.byName[obj.name] = obj;
    return obj;
  };
  Eng.init = function (canvas) {
    Eng.canvas = canvas;
    Eng.ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    setupInput(canvas);
    canvas.style.cursor = 'grab';
    initDust();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) RLR.Audio.suspend(); else RLR.Audio.resume();
    });
    requestAnimationFrame(frame);
  };
  function resize() {
    Eng.dpr = Math.min(2, window.devicePixelRatio || 1);
    Eng.W = window.innerWidth;
    Eng.H = window.innerHeight;
    Eng.canvas.width = Math.round(Eng.W * Eng.dpr);
    Eng.canvas.height = Math.round(Eng.H * Eng.dpr);
    Eng.canvas.style.width = Eng.W + 'px';
    Eng.canvas.style.height = Eng.H + 'px';
  }

  window.RLR = window.RLR || {};
  RLR.Engine = Eng;
})();
