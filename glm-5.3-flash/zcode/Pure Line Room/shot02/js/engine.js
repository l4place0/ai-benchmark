/* 纯线房间 — 引擎：场景图 / 隐藏线渲染器 / 拾取 / 相机 / 主题 / 环境
 * 视觉方案：Canvas2D 上的“技术制图”式渲染——所有面按深度排序（画家算法），
 * 背面剔除，面用纸色填充实现互相遮挡，边按 轮廓/边界/内部 三级线宽描墨，
 * 附着细节线与排线，得到矢量线稿质感。零依赖。 */
(function () {
  'use strict';
  const PLR = window.PLR;
  const { V, M4 } = PLR;

  /* ============================ 主题 ============================ */
  const DAY = {
    page: '#ece7d9', paper: '#faf6ec', paperFloor: '#f1eadb', ceil: '#f6f1e7',
    ink: '#2b261e', accent: '#c4573a', glow: '#ffd9a3',
    sky: '#fdfbf4', star: '#2b261e', moon: '#2b261e', cloud: '#2b261e',
  };
  const NIGHT = {
    page: '#0d1017', paper: '#171c26', paperFloor: '#141926', ceil: '#161b28',
    ink: '#c9d0e0', accent: '#e08a5e', glow: '#ffc978',
    sky: '#0a0f1e', star: '#e3e9f7', moon: '#edf1fa', cloud: '#7e879e',
  };
  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  const theme = { mode: 'day', k: 0, c: {} };
  function updateThemeColors() {
    const t = theme.k, a = DAY, b = NIGHT;
    for (const key in a) {
      const ca = hex2rgb(a[key]), cb = hex2rgb(b[key]);
      const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
      const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
      const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
      theme.c[key] = `rgb(${r},${g},${bl})`;
      theme.c[key + 'RGB'] = [r, g, bl];
    }
  }
  updateThemeColors();
  PLR.theme = theme;

  function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

  /* ============================ 环境 ============================ */
  const env = PLR.env = {
    mode: 'day', modeK: 0,
    breeze: 0, breezeT: 0,
    fanLevel: 0,
    lampOn: false, lampPos: [1.1, 1.35, -2.3], lampK: 0,
    seen: new Set(),
    time: null,
  };
  PLR.toggleEnv = function () {
    env.mode = env.mode === 'day' ? 'night' : 'day';
    document.body.classList.toggle('night', env.mode === 'night');
    PLR.sfx.play('clack', {});
    PLR.sfx.loopSet('amb', { mode: env.mode });
    return env.mode;
  };

  /* ============================ 场景图 ============================ */
  const sceneRoot = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], parent: null, children: [], mesh: null, world: M4.ident() };
  PLR.root = sceneRoot;

  PLR.node = function (parent, opts) {
    opts = opts || {};
    const n = {
      pos: opts.pos ? opts.pos.slice() : [0, 0, 0],
      rot: opts.rot ? opts.rot.slice() : [0, 0, 0],
      scale: opts.scale ? opts.scale.slice() : [1, 1, 1],
      parent: parent || sceneRoot,
      children: [], mesh: null, world: new Float64Array(16),
    };
    n.parent.children.push(n);
    return n;
  };

  /* -------- 网格与几何 -------- */
  const key3 = (p) => (Math.round(p[0] * 8192) + '|' + Math.round(p[1] * 8192) + '|' + Math.round(p[2] * 8192));

  PLR.mesh = function (node) {
    const m = { node, verts: [], vmap: new Map(), faces: [], edges: null };
    node.mesh = m;
    return m;
  };

  function getVert(m, p) {
    const k = key3(p);
    let i = m.vmap.get(k);
    if (i === undefined) {
      i = m.verts.length;
      m.verts.push([p[0], p[1], p[2]]);
      m.vmap.set(k, i);
    }
    return i;
  }

  function newell(pts) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  // 通用多边形面。pts 从正面看 CCW；opts.forceN 提供期望法线时自动校正绕向。
  PLR.polygon = function (m, pts, opts) {
    opts = opts || {};
    let idx = pts.map((p) => getVert(m, p));
    let n = newell(pts);
    if (opts.forceN && V.dot(n, opts.forceN) < 0) {
      idx = idx.slice().reverse();
      n = [n[0], n[1], n[2]];
      n = newell(idx.map((i) => m.verts[i]));
    }
    const f = {
      mesh: m, vi: idx, n,
      doubleSided: !!opts.doubleSided,
      tint: opts.tint || 'paper',
      alpha: opts.alpha !== undefined ? opts.alpha : 1,
      lw: opts.lw !== undefined ? opts.lw : 1,
      noPick: !!opts.noPick,
      bias: opts.bias || 0,
      hatch: (opts.hatch && (opts.hatch.count !== undefined || opts.hatch.gap !== undefined)) ? opts.hatch : null,
      hatchLines: null,
      details: [],
      edgeRefs: null,
      gid: -1,
      objId: -1,
      dynHatch: opts.dynHatch || null,
    };
    m.faces.push(f);
    return f;
  };

  PLR.quad = function (m, c, opts) { return PLR.polygon(m, c, opts); };
  PLR.tri = function (m, c, opts) { return PLR.polygon(m, c, opts); };

  PLR.detail = function (face, pts, opts) {
    opts = opts || {};
    face.details.push({ pts: pts.map((p) => p.slice()), w: opts.w || 0.8, alpha: opts.alpha !== undefined ? opts.alpha : 0.55, closed: !!opts.closed });
  };

  PLR.ngon = function (m, center, r, n, opts) {
    opts = opts || {};
    const plane = opts.plane || 'xy';
    const pts = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + (opts.rotZ || 0);
      const c = Math.cos(th) * r, s = Math.sin(th) * r;
      if (plane === 'xy') pts.push([center[0] + c, center[1] + s, center[2]]);
      else if (plane === 'xz') pts.push([center[0] + c, center[1], center[2] + s]);
      else pts.push([center[0], center[1] + c, center[2] + s]);
    }
    const fn = plane === 'xy' ? [0, 0, 1] : plane === 'xz' ? [0, 1, 0] : [1, 0, 0];
    return PLR.polygon(m, pts, Object.assign({}, opts, { forceN: opts.doubleSided ? null : fn }));
  };

  PLR.box = function (m, o) {
    const px = o.pos[0], py = o.pos[1], pz = o.pos[2];
    const w = o.size[0] / 2, h = o.size[1] / 2, d = o.size[2] / 2;
    const x0 = px - w, x1 = px + w, y0 = py - h, y1 = py + h, z0 = pz - d, z1 = pz + d;
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const skip = o.skip || [];
    const has = (s) => skip.indexOf(s) < 0;
    const faces = {};
    if (has('front')) faces.front = PLR.polygon(m, [v[4], v[5], v[6], v[7]], o.opts);
    if (has('back')) faces.back = PLR.polygon(m, [v[1], v[0], v[3], v[2]], o.opts);
    if (has('right')) faces.right = PLR.polygon(m, [v[5], v[1], v[2], v[6]], o.opts);
    if (has('left')) faces.left = PLR.polygon(m, [v[4], v[7], v[3], v[0]], o.opts);
    if (has('top')) faces.top = PLR.polygon(m, [v[3], v[7], v[6], v[2]], o.opts);
    if (has('bottom')) faces.bottom = PLR.polygon(m, [v[0], v[1], v[5], v[4]], o.opts);
    return faces;
  };

  PLR.cyl = function (m, o) {
    const n = o.n || 10;
    const axis = V.norm(V.sub(o.p1, o.p0));
    const ref = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = V.norm(V.cross(axis, ref));
    const w = V.cross(axis, u);
    const ring = (c, r) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        pts.push(V.add(c, V.add(V.scl(u, Math.cos(th) * r), V.scl(w, Math.sin(th) * r))));
      }
      return pts;
    };
    const r0 = ring(o.p0, o.r0), r1 = ring(o.p1, o.r1);
    const so = o.sideOpts || o.opts || {};
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      PLR.polygon(m, [r0[i], r0[j], r1[j], r1[i]], so);
    }
    const co = o.capOpts || o.opts || {};
    if (o.caps && (o.caps.top || o.caps.both))
      PLR.polygon(m, ring(o.p1, o.r1), Object.assign({}, co, { forceN: axis }));
    if (o.caps && (o.caps.bottom || o.caps.both))
      PLR.polygon(m, ring(o.p0, o.r0), Object.assign({}, co, { forceN: V.scl(axis, -1) }));
    return { r0, r1 };
  };

  PLR.sphere = function (m, o) {
    const nu = o.nu || 14, nv = o.nv || 8, r = o.r, c = o.c;
    const pt = (j, i) => {
      const ph = -Math.PI / 2 + Math.PI * (j / nv);
      const th = (i / nu) * Math.PI * 2;
      return [c[0] + r * Math.cos(ph) * Math.cos(th), c[1] + r * Math.sin(ph), c[2] + r * Math.cos(ph) * Math.sin(th)];
    };
    for (let j = 1; j < nv - 1; j++) {
      for (let i = 0; i < nu; i++) {
        const i2 = (i + 1) % nu;
        PLR.polygon(m, [pt(j, i), pt(j + 1, i), pt(j + 1, i2), pt(j, i2)], o.opts);
      }
    }
    PLR.polygon(m, Array.from({ length: nu }, (_, i) => pt(nv - 1, i)), Object.assign({}, o.opts, { forceN: [0, 1, 0] }));
    PLR.polygon(m, Array.from({ length: nu }, (_, i) => pt(1, i)), Object.assign({}, o.opts, { forceN: [0, -1, 0] }));
  };

  /* -------- finalize：边表 / 排线预计算 / 场景扁平化 -------- */
  const allNodes = [];
  const allMeshes = [];
  const allFaces = [];
  const facingBits = new Uint8Array(1 << 16);

  function objIdOfNode(n) {
    while (n) { if (n.objId !== undefined) return n.objId; n = n.parent; }
    return -1;
  }

  PLR.finalizeAll = function () {
    (function walk(n) {
      allNodes.push(n);
      if (n.mesh) allMeshes.push(n.mesh);
      n.children.forEach(walk);
    })(sceneRoot);

    for (const m of allMeshes) {
      // 边表
      const emap = new Map();
      for (let fi = 0; fi < m.faces.length; fi++) {
        const f = m.faces[fi];
        const nv = f.vi.length;
        for (let i = 0; i < nv; i++) {
          const a = f.vi[i], b = f.vi[(i + 1) % nv];
          const k = a < b ? a + '_' + b : b + '_' + a;
          let e = emap.get(k);
          if (!e) { e = { a, b, gset: new Set() }; emap.set(k, e); }
        }
      }
      m.edges = Array.from(emap.values());
      // 面 → 边引用
      for (let fi = 0; fi < m.faces.length; fi++) {
        const f = m.faces[fi];
        const nv = f.vi.length;
        f.edgeRefs = [];
        for (let i = 0; i < nv; i++) {
          const a = f.vi[i], b = f.vi[(i + 1) % nv];
          const k = a < b ? a + '_' + b : b + '_' + a;
          f.edgeRefs.push(emap.get(k));
        }
      }
      // 排线预计算（四边形，局部空间）
      for (const f of m.faces) {
        if (!f.hatch || f.vi.length !== 4) continue;
        const A = m.verts[f.vi[0]], B = m.verts[f.vi[1]], C = m.verts[f.vi[2]], D = m.verts[f.vi[3]];
        const inset = f.hatch.inset !== undefined ? f.hatch.inset : 0.06;
        let count = f.hatch.count;
        if (count === undefined && f.hatch.gap) {
          const len = f.hatch.dir === 'b' ? V.len(V.sub(A, B)) : V.len(V.sub(D, A));
          count = Math.max(1, Math.round(len / f.hatch.gap));
        }
        const lines = [];
        for (let i = 1; i <= count; i++) {
          const u = inset + (1 - 2 * inset) * (i / (count + 1));
          if (f.hatch.dir === 'b') lines.push([V.lerp(A, B, u), V.lerp(D, C, u)]);
          else lines.push([V.lerp(D, A, u), V.lerp(C, B, u)]);
        }
        f.hatchLines = lines;
      }
    }
    // 全局面注册（gid、objId）
    let gid = 0;
    for (const m of allMeshes) {
      const objId = objIdOfNode(m.node);
      for (const f of m.faces) {
        f.gid = gid++;
        f.objId = objId;
        allFaces.push(f);
      }
    }
    // 边 → 可见面集合（每帧更新）
    for (const m of allMeshes) {
      for (const f of m.faces) {
        for (const e of f.edgeRefs) e.gset.add(f.gid);
      }
    }
  };

  /* ============================ 物件注册 ============================ */
  const objectDefs = [];
  const objects = [];
  PLR.addObject = function (def) { objectDefs.push(def); return def; };

  function tagTree(n, id) { n.objId = id; for (const c of n.children) tagTree(c, id); }

  PLR.buildObjects = function () {
    const HANDLERS = ['update', 'onClick', 'onPress', 'onRelease', 'onHover', 'onDragMove', 'onDragEnd'];
    for (const def of objectDefs) {
      const inst = def.build(PLR) || {};
      inst.def = def;
      inst.id = def.id;
      inst.label = def.label || def.id;
      inst.hint = def.hint || '';
      for (const k of HANDLERS) if (typeof def[k] === 'function') inst[k] = def[k];
      if (inst.root) { inst.root.objId = objects.length; tagTree(inst.root, objects.length); }
      objects.push(inst);
    }
    PLR.finalizeAll();
    return objects;
  };
  PLR.objects = objects;
  PLR.objectById = (id) => objects.find((o) => o.id === id);
  PLR.worldPos = function (n) { return [n.world[12], n.world[13], n.world[14]]; };

  /* ============================ 补间与弹簧 ============================ */
  const tweens = [];
  const easeFns = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c = 1.70158 * 0.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  };
  PLR.ease = easeFns;
  PLR.tween = function (o) {
    o._t = 0; o.ease = typeof o.ease === 'function' ? o.ease : (easeFns[o.ease] || easeFns.outCubic);
    tweens.push(o);
    return o;
  };
  PLR.delay = function (sec, fn) { return PLR.tween({ dur: sec, update() {}, done: fn }); };
  function stepTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const o = tweens[i];
      if (o.dead) { tweens.splice(i, 1); continue; }
      o._t += dt / (o.dur || 0.4);
      const k = o.ease(Math.min(1, o._t));
      if (o.update) o.update(k);
      if (o._t >= 1) { tweens.splice(i, 1); if (o.done) o.done(); }
    }
  }
  // 阻尼弹簧：state={x,v}（x 为角度/位移，v 为速度）
  PLR.spring = function (state, target, opt, dt) {
    const f = (opt && opt.f) || 3, z = (opt && opt.z) || 0.5;
    const a = -2 * z * f * state.v - f * f * (state.x - target);
    state.v += a * dt;
    state.x += state.v * dt;
    return state.x;
  };

  /* ============================ 音频桩（audio.js 会替换） ============================ */
  PLR.sfx = {
    unlock() {}, setMuted() {},
    play() {}, loopSet() {},
  };

  /* ============================ 地面阴影注册 ============================ */
  PLR.shadowRects = [];
  PLR.shadow = function (x, z, w, d, s) {
    const r = { x, z, w, d, s: s || 0.5 };
    PLR.shadowRects.push(r);
    return r;
  };

  /* ============================ 相机 ============================ */
  const cam = PLR.camera = {
    target: [0, 1.02, 0.1], tTarget: [0, 1.02, 0.1],
    yaw: 0.34, pitch: 0.30, dist: 9.4,
    tYaw: 0.16, tPitch: 0.40, tDist: 7.1,
    fov: (46 * Math.PI) / 180,
    eye: [0, 0, 0],
  };
  PLR.setCamGoal = function (o) {
    if (o.yaw !== undefined) cam.tYaw = o.yaw;
    if (o.pitch !== undefined) cam.tPitch = o.pitch;
    if (o.dist !== undefined) cam.tDist = o.dist;
    if (o.target) cam.tTarget = o.target.slice();
  };
  function stepCamera(dt) {
    const k = Math.min(1, dt * 6);
    cam.yaw += (cam.tYaw - cam.yaw) * k;
    cam.pitch += (cam.tPitch - cam.pitch) * k;
    cam.dist += (cam.tDist - cam.dist) * k;
    for (let i = 0; i < 3; i++) cam.target[i] += (cam.tTarget[i] - cam.target[i]) * k;
    const cp = Math.cos(cam.pitch);
    cam.eye = [
      cam.target[0] + Math.sin(cam.yaw) * cp * cam.dist,
      cam.target[1] + Math.sin(cam.pitch) * cam.dist,
      cam.target[2] + Math.cos(cam.yaw) * cp * cam.dist,
    ];
  }

  /* ============================ 画布与渲染 ============================ */
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let viewM = new Float64Array(16), projM = new Float64Array(16);
  const NEAR = 0.14;
  let grainPat = null;

  PLR.initCanvas = function (c) {
    canvas = c;
    ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  };
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  function makeGrain() {
    const g = document.createElement('canvas');
    g.width = g.height = 160;
    const gc = g.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * 0.09 + 0.02;
      gc.fillStyle = Math.random() < 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,255,255,${a})`;
      gc.fillRect(Math.random() * 160, Math.random() * 160, 1.4, 1.4);
    }
    grainPat = ctx.createPattern(g, 'repeat');
  }

  function computeMats() {
    M4.lookAt(cam.eye, cam.target, [0, 1, 0], viewM);
    M4.perspective(cam.fov, W / H, NEAR, 60, projM);
  }
  function projectView(pv, out) {
    const cw = projM[3] * pv[0] + projM[7] * pv[1] + projM[11] * pv[2] + projM[15];
    const cx = projM[0] * pv[0] + projM[4] * pv[1] + projM[8] * pv[2] + projM[12];
    const cy = projM[1] * pv[0] + projM[5] * pv[1] + projM[9] * pv[2] + projM[13];
    const inv = 1 / cw;
    out[0] = (cx * inv * 0.5 + 0.5) * W;
    out[1] = (1 - (cy * inv * 0.5 + 0.5)) * H;
    out[2] = pv[2];
    return out;
  }
  PLR.projectPoint = function (wp) {
    const vx = viewM[0] * wp[0] + viewM[4] * wp[1] + viewM[8] * wp[2] + viewM[12];
    const vy = viewM[1] * wp[0] + viewM[5] * wp[1] + viewM[9] * wp[2] + viewM[13];
    const vz = viewM[2] * wp[0] + viewM[6] * wp[1] + viewM[10] * wp[2] + viewM[14];
    return projectView([vx, vy, vz], [0, 0, 0]);
  };
  PLR.panOf = function (wp) {
    const s = PLR.projectPoint(wp);
    return PLR.clamp((s[0] / W) * 2 - 1, -1, 1);
  };

  function clipNear(pts) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const ain = a[2] > NEAR, bin = b[2] > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    return out;
  }
  function clipLineNear(a, b) {
    const ain = a[2] > NEAR, bin = b[2] > NEAR;
    if (!ain && !bin) return null;
    if (ain && bin) return [a, b];
    const t = (NEAR - a[2]) / (b[2] - a[2]);
    const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
    return ain ? [a, m] : [m, b];
  }

  /* -------- 帧渲染 -------- */
  const drawList = [];
  const pickList = [];
  const objScreen = new Map();

  PLR.render = function () {
    computeMats();
    drawList.length = 0; pickList.length = 0;
    objScreen.clear();
    facingBits.fill(0);

    const ink = theme.c.inkRGB;

    for (const m of allMeshes) {
      const mw = m.node.world;
      for (const f of m.faces) {
        const nvi = f.vi.length;
        let cx = 0, cy = 0, cz = 0;
        const wpts = new Array(nvi);
        for (let i = 0; i < nvi; i++) {
          const lv = m.verts[f.vi[i]];
          const wx = mw[0] * lv[0] + mw[4] * lv[1] + mw[8] * lv[2] + mw[12];
          const wy = mw[1] * lv[0] + mw[5] * lv[1] + mw[9] * lv[2] + mw[13];
          const wz = mw[2] * lv[0] + mw[6] * lv[1] + mw[10] * lv[2] + mw[14];
          wpts[i] = [wx, wy, wz];
          cx += wx; cy += wy; cz += wz;
        }
        cx /= nvi; cy /= nvi; cz /= nvi;
        const wn = M4.dir(mw, f.n, [0, 0, 0]);
        if (!f.doubleSided) {
          if (wn[0] * (cam.eye[0] - cx) + wn[1] * (cam.eye[1] - cy) + wn[2] * (cam.eye[2] - cz) <= 0) continue;
        } else {
          const ed = wn[0] * (cam.eye[0] - cx) + wn[1] * (cam.eye[1] - cy) + wn[2] * (cam.eye[2] - cz);
          if (ed < 0) { wn[0] = -wn[0]; wn[1] = -wn[1]; wn[2] = -wn[2]; }
        }
        facingBits[f.gid] = 1;

        let pts = [], behind = 0, vzSum = 0;
        for (const w of wpts) {
          const vx = viewM[0] * w[0] + viewM[4] * w[1] + viewM[8] * w[2] + viewM[12];
          const vy = viewM[1] * w[0] + viewM[5] * w[1] + viewM[9] * w[2] + viewM[13];
          const vz = viewM[2] * w[0] + viewM[6] * w[1] + viewM[10] * w[2] + viewM[14];
          pts.push([vx, vy, vz]);
          if (vz <= NEAR) behind++;
          vzSum += vz;
        }
        if (behind === nvi) { facingBits[f.gid] = 0; continue; }
        if (behind > 0) pts = clipNear(pts);
        if (pts.length < 3) { facingBits[f.gid] = 0; continue; }
        const vz = vzSum / nvi + f.bias;
        const s2d = pts.map((p) => projectView(p, [0, 0, 0]));
        drawList.push({ f, wn, s2d, vz, cx, cy, cz });
        if (!f.noPick && f.objId >= 0) {
          pickList.push({ s2d, objId: f.objId });
          let bb = objScreen.get(f.objId);
          if (!bb) { bb = [1e9, 1e9, -1e9, -1e9]; objScreen.set(f.objId, bb); }
          for (const s of s2d) {
            if (s[0] < bb[0]) bb[0] = s[0]; if (s[0] > bb[2]) bb[2] = s[0];
            if (s[1] < bb[1]) bb[1] = s[1]; if (s[1] > bb[3]) bb[3] = s[1];
          }
        }
      }
    }

    drawList.sort((a, b) => b.vz - a.vz);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.c.page;
    ctx.fillRect(0, 0, W, H);

    const hovered = hoverObjId, pressed = pressObjId;
    const lampOn = env.lampK > 0.02;
    const lampP = env.lampPos;
    for (const d of drawList) drawFace(d, ink, hovered, pressed, lampOn, lampP);

    drawOverlays();

    if (grainPat) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grainPat;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    drawHUD();
    PLR._stats = { drawn: drawList.length, pick: pickList.length, faces: allFaces.length, meshes: allMeshes.length, nodes: allNodes.length };
  };

  function faceStrokeWidth(z, mult) {
    return PLR.clamp(2.7 / (0.9 + z * 0.30), 0.5, 1.75) * 1.35 * (mult || 1);
  }

  function drawFace(d, ink, hovered, pressed, lampOn, lampP) {
    const f = d.f, m = f.mesh, mw = m.node.world;
    const s2d = d.s2d;
    const isHover = f.objId >= 0 && f.objId === hovered;
    const isPress = f.objId >= 0 && f.objId === pressed;

    // --- 填充 ---
    ctx.beginPath();
    ctx.moveTo(s2d[0][0], s2d[0][1]);
    for (let i = 1; i < s2d.length; i++) ctx.lineTo(s2d[i][0], s2d[i][1]);
    ctx.closePath();
    if (f.alpha >= 0.999) {
      ctx.fillStyle = theme.c[f.tint] || theme.c.paper;
      ctx.fill();
      const ny = d.wn[1];
      const lam = PLR.clamp(d.wn[0] * 0.38 + d.wn[1] * 0.82 + d.wn[2] * 0.3, 0, 1);
      let sh = 0;
      if (ny < -0.5) sh = 0.10;
      else if (lam < 0.34) sh = 0.085;
      else if (lam < 0.62) sh = 0.04;
      if (f.tint === 'floor') sh += 0.02;
      if (sh > 0.001) { ctx.fillStyle = 'rgba(20,16,10,' + sh + ')'; ctx.fill(); }
      if (lampOn) {
        const dx = d.cx - lampP[0], dy = d.cy - lampP[1], dz = d.cz - lampP[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const k = env.lampK * Math.pow(PLR.clamp(1 - dist / 2.7, 0, 1), 2) * (env.mode === 'night' ? 0.42 : 0.16);
        if (k > 0.02) { ctx.fillStyle = rgba(theme.c.glowRGB, k); ctx.fill(); }
      }
      if (isHover) { ctx.fillStyle = rgba(theme.c.accentRGB, 0.07); ctx.fill(); }
      if (isPress) { ctx.fillStyle = rgba(theme.c.accentRGB, 0.1); ctx.fill(); }
    } else if (f.alpha > 0) {
      if (f.tint === 'glow') {
        ctx.fillStyle = rgba(theme.c.glowRGB, f.alpha * (0.3 + 0.7 * env.lampK));
      } else {
        ctx.fillStyle = rgba(ink, f.alpha);
      }
      ctx.fill();
      if (isHover) { ctx.fillStyle = rgba(theme.c.accentRGB, 0.06); ctx.fill(); }
    }

    // --- 排线 ---
    if (f.hatchLines && f.hatchLines.length) {
      ctx.strokeStyle = rgba(ink, f.hatch.alpha !== undefined ? f.hatch.alpha : 0.32);
      ctx.lineWidth = Math.max(0.5, 0.8 * (f.hatch.w || 1));
      ctx.beginPath();
      for (const seg of f.hatchLines) {
        const va = toView(xform(mw, seg[0])), vb = toView(xform(mw, seg[1]));
        const cl = clipLineNear(va, vb);
        if (!cl) continue;
        const pa = projectView(cl[0], [0, 0, 0]), pb = projectView(cl[1], [0, 0, 0]);
        ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
      }
      ctx.stroke();
    } else if (f.dynHatch === 'floor') {
      drawFloorHatch(f, mw, ink);
    }

    // --- 细节线 ---
    if (f.details.length) {
      for (const det of f.details) {
        ctx.strokeStyle = rgba(ink, det.alpha);
        ctx.lineWidth = Math.max(0.5, det.w * 0.9);
        ctx.beginPath();
        let started = false;
        const n = det.pts.length;
        const lim = det.closed ? n : n - 1;
        for (let i = 0; i < lim; i++) {
          const va = toView(xform(mw, det.pts[i])), vb = toView(xform(mw, det.pts[(i + 1) % n]));
          const cl = clipLineNear(va, vb);
          if (!cl) { started = false; continue; }
          const pa = projectView(cl[0], [0, 0, 0]), pb = projectView(cl[1], [0, 0, 0]);
          if (!started) { ctx.moveTo(pa[0], pa[1]); started = true; }
          ctx.lineTo(pb[0], pb[1]);
        }
        ctx.stroke();
      }
    }

    // --- 边（轮廓粗 / 边界中 / 内部细） ---
    // 注意：近平面裁剪会改变顶点数，此时按裁剪后多边形直接描边界线
    const nv = s2d.length;
    const clipped = nv !== f.vi.length;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < nv; i++) {
      let cls = 1;
      if (!clipped) {
        const e = f.edgeRefs[i];
        if (!e) continue;
        if (e.gset.size === 1) cls = 1;
        else {
          let vis = 0;
          for (const g of e.gset) if (facingBits[g] === 1) vis++;
          cls = vis === 1 ? 2 : 0;
        }
      }
      const a = s2d[i], b = s2d[(i + 1) % nv];
      const z = (a[2] + b[2]) / 2;
      const wm = cls === 2 ? 1.5 : cls === 1 ? 1.28 : 0.6;
      ctx.strokeStyle = (isHover || isPress) && cls !== 0 ? rgba(theme.c.accentRGB, 0.95) : rgba(ink, cls === 0 ? 0.78 : 1);
      ctx.lineWidth = faceStrokeWidth(z, wm * f.lw);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  function xform(mw, p) {
    return [
      mw[0] * p[0] + mw[4] * p[1] + mw[8] * p[2] + mw[12],
      mw[1] * p[0] + mw[5] * p[1] + mw[9] * p[2] + mw[13],
      mw[2] * p[0] + mw[6] * p[1] + mw[10] * p[2] + mw[14],
    ];
  }
  function toView(w) {
    return [
      viewM[0] * w[0] + viewM[4] * w[1] + viewM[8] * w[2] + viewM[12],
      viewM[1] * w[0] + viewM[5] * w[1] + viewM[9] * w[2] + viewM[13],
      viewM[2] * w[0] + viewM[6] * w[1] + viewM[10] * w[2] + viewM[14],
    ];
  }

  // 地板动态排线：木纹 + 家具落影
  function drawFloorHatch(f, mw, ink) {
    const wv = f.vi.map((i) => xform(mw, f.mesh.verts[i]));
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of wv) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    ctx.strokeStyle = rgba(ink, 0.15);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let z = Math.ceil(z0 / 0.145) * 0.145; z < z1; z += 0.145) {
      const a = projectView(toView([x0 + 0.01, 0, z]), [0, 0, 0]);
      const b = projectView(toView([x1 - 0.01, 0, z]), [0, 0, 0]);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    for (const r of PLR.shadowRects) {
      const ox0 = Math.max(x0, r.x - r.w / 2), ox1 = Math.min(x1, r.x + r.w / 2);
      const oz0 = Math.max(z0, r.z - r.d / 2), oz1 = Math.min(z1, r.z + r.d / 2);
      if (ox0 >= ox1 || oz0 >= oz1) continue;
      ctx.strokeStyle = rgba(ink, 0.22 * r.s);
      ctx.beginPath();
      for (let z = Math.ceil(oz0 / 0.058) * 0.058; z < oz1; z += 0.058) {
        const a = projectView(toView([ox0, 0.002, z]), [0, 0, 0]);
        const b = projectView(toView([ox1, 0.002, z]), [0, 0, 0]);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
  }

  /* ============================ 覆盖层 & HUD ============================ */
  const overlays = [];
  PLR.overlay = function (fn) { overlays.push(fn); };

  function drawOverlays() {
    for (const fn of overlays) {
      fn(lastDt, {
        ctx, W, H, theme: theme.c, env,
        project: (wp) => PLR.projectPoint(wp),
        ink: theme.c.inkRGB,
      });
    }
  }

  /* ---- 拾取 ---- */
  let hoverObjId = -1, pressObjId = -1;
  PLR.pickAt = function (x, y) { return pickAt(x, y); };
  function pickAt(x, y) {
    for (let i = pickList.length - 1; i >= 0; i--) {
      const p = pickList[i];
      if (pip(p.s2d, x, y)) return p.objId;
    }
    return -1;
  }
  function pip(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  /* ---- 输入 ---- */
  const pointer = { x: 0, y: 0, down: false };
  let mode = 'idle'; // idle | orbit | dragPending | dragObj | pinch
  let downObjId = -1, downX = 0, downY = 0, moved = 0;
  let dragInst = null, dragOffset = [0, 0, 0];
  const touches = new Map();
  let pinchD0 = 0, pinchDist0 = 0;
  let lastActivity = 0;
  let lastDt = 0.016;

  function planeHit(px, py, planeY) {
    const fwd = V.norm(V.sub(cam.target, cam.eye));
    const right = V.norm(V.cross(fwd, [0, 1, 0]));
    const up = V.cross(right, fwd);
    const th = Math.tan(cam.fov / 2);
    const ndcX = (px / W) * 2 - 1, ndcY = 1 - (py / H) * 2;
    const dir = V.norm(V.add(V.add(fwd, V.scl(right, ndcX * th * (W / H))), V.scl(up, ndcY * th)));
    if (Math.abs(dir[1]) < 1e-4) return null;
    const t = (planeY - cam.eye[1]) / dir[1];
    if (t < 0.1) return null;
    return V.add(cam.eye, V.scl(dir, t));
  }
  PLR.planeHit = planeHit;

  function bindInput() {
    canvas.addEventListener('pointerdown', (e) => {
      lastActivity = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2) {
        const ts = Array.from(touches.values());
        pinchD0 = Math.hypot(ts[0][0] - ts[1][0], ts[0][1] - ts[1][1]);
        pinchDist0 = cam.tDist;
        mode = 'pinch';
        return;
      }
      pointer.down = true;
      downX = e.clientX; downY = e.clientY; moved = 0;
      downObjId = pickAt(e.clientX, e.clientY);
      if (downObjId >= 0) {
        const inst = objects[downObjId];
        pressObjId = downObjId;
        if (inst.onPress) inst.onPress();
        if (inst.def && inst.def.drag === 'floor') {
          dragInst = inst;
          mode = 'dragPending';
        } else mode = 'clickPending';
      } else {
        mode = 'orbit';
        canvas.style.cursor = 'grabbing';
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      lastActivity = performance.now();
      if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (mode === 'pinch' && touches.size === 2) {
        const ts = Array.from(touches.values());
        const d = Math.hypot(ts[0][0] - ts[1][0], ts[0][1] - ts[1][1]);
        cam.tDist = PLR.clamp(pinchDist0 * (pinchD0 / Math.max(20, d)), 3.0, 11);
        return;
      }
      if (mode === 'orbit') {
        cam.tYaw = PLR.clamp(cam.tYaw - e.movementX * 0.0052, -1.95, 1.95);
        cam.tPitch = PLR.clamp(cam.tPitch + e.movementY * 0.0042, 0.05, 1.02);
        return;
      }
      if (mode === 'dragPending' || mode === 'dragObj') {
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (mode === 'dragPending' && moved > 7) {
          mode = 'dragObj';
          const hit = planeHit(e.clientX, e.clientY, 0);
          const rp = PLR.worldPos(dragInst.root);
          if (hit) dragOffset = [rp[0] - hit[0], 0, rp[2] - hit[2]];
          canvas.style.cursor = 'grabbing';
        }
        if (mode === 'dragObj' && dragInst.onDragMove) {
          const hit = planeHit(e.clientX, e.clientY, 0);
          if (hit) dragInst.onDragMove([hit[0] + dragOffset[0], 0, hit[2] + dragOffset[2]]);
        }
        return;
      }
      if (mode === 'idle' || mode === 'clickPending') {
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        const id = pickAt(e.clientX, e.clientY);
        if (id !== hoverObjId) {
          const prev = objects[hoverObjId];
          if (prev && prev.onHover) prev.onHover(false);
          hoverObjId = id;
          const cur = objects[id];
          if (cur && cur.onHover) cur.onHover(true);
        }
        canvas.style.cursor = id >= 0 ? 'pointer' : 'grab';
      }
    });
    const up = (e) => {
      touches.delete(e.pointerId);
      if (mode === 'pinch') { if (touches.size < 2) mode = 'idle'; return; }
      if (!pointer.down) return;
      pointer.down = false;
      const wasDown = downObjId;
      const wasDrag = mode === 'dragObj';
      const wasClick = (mode === 'clickPending' || mode === 'dragPending') && moved <= 8;
      if (pressObjId >= 0) {
        const inst = objects[pressObjId];
        if (inst && inst.onRelease) inst.onRelease();
      }
      pressObjId = -1;
      if (wasClick && wasDown >= 0) {
        const inst = objects[wasDown];
        if (inst) {
          env.seen.add(inst.id);
          if (inst.onClick) inst.onClick();
        }
      }
      if (wasDrag && dragInst && dragInst.onDragEnd) dragInst.onDragEnd();
      dragInst = null;
      downObjId = -1;
      mode = 'idle';
      canvas.style.cursor = hoverObjId >= 0 ? 'pointer' : 'grab';
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      lastActivity = performance.now();
      cam.tDist = PLR.clamp(cam.tDist * Math.exp(e.deltaY * 0.0011), 3.0, 11);
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      if (pickAt(e.clientX, e.clientY) < 0) PLR.setCamGoal({ yaw: 0.16, pitch: 0.40, dist: 7.1, target: [0, 1.02, 0.1] });
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---- HUD：引导脉冲 / 悬停提示牌 ---- */
  let pulse = null;
  let idlePulseTimer = 0;
  function drawHUD() {
    idlePulseTimer += lastDt;
    if (idlePulseTimer > 7) {
      idlePulseTimer = 0;
      const cands = objects.filter((o) => (o.onClick || (o.def && o.def.drag)) && !env.seen.has(o.id));
      if (cands.length) pulse = { id: PLR.pick(cands).id, t: 0 };
    }
    if (pulse) {
      pulse.t += lastDt;
      let bb = null, idx = -1;
      for (let i = 0; i < objects.length; i++) if (objects[i].id === pulse.id) { idx = i; break; }
      if (idx >= 0) bb = objScreen.get(idx);
      if (bb && bb[2] > bb[0]) {
        const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
        const r = 14 + pulse.t * 46;
        const a = PLR.clamp(1 - pulse.t / 1.5, 0, 1) * 0.55;
        ctx.strokeStyle = rgba(theme.c.accentRGB, a);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (pulse.t > 1.5) pulse = null;
    }

    if (hoverObjId >= 0 && mode !== 'orbit' && mode !== 'dragObj' && mode !== 'pinch') {
      const inst = objects[hoverObjId];
      if (inst) {
        const text = inst.label + (inst.hint ? ' · ' + inst.hint : '');
        ctx.font = 'italic 13px Georgia, "Times New Roman", serif';
        const tw = ctx.measureText(text).width;
        let px = pointer.x + 16, py = pointer.y + 18;
        if (px + tw + 24 > W) px = pointer.x - tw - 28;
        if (py + 28 > H) py = pointer.y - 36;
        ctx.save();
        ctx.translate(px + tw / 2, py + 12);
        ctx.rotate(-0.022);
        ctx.fillStyle = theme.k > 0.5 ? 'rgba(23,28,38,0.94)' : 'rgba(250,246,236,0.94)';
        ctx.strokeStyle = rgba(theme.c.inkRGB, 0.9);
        ctx.lineWidth = 1;
        roundRect(ctx, -tw / 2 - 10, -12, tw + 20, 24, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = theme.c.accent;
        ctx.beginPath();
        ctx.arc(-tw / 2 - 1, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.c.ink;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 4, 1);
        ctx.restore();
      }
    }
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ============================ 主循环 ============================ */
  let started = false, lastT = 0, frameT = 0;
  PLR.start = function () {
    if (started) return;
    started = true;
    makeGrain();
    bindInput();
    requestAnimationFrame(loop);
  };

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    stepFrame(dt);
  }

  // 单帧推进（供 rAF 被节流的自动化测试手动驱动）
  PLR.tick = function (dt) {
    stepFrame(dt || 0.016);
  };

  function stepFrame(dt) {
    lastDt = dt;
    frameT += dt;
    env.time = new Date();

    const targetK = env.mode === 'night' ? 1 : 0;
    if (Math.abs(theme.k - targetK) > 0.0001) {
      theme.k += (targetK - theme.k) * Math.min(1, dt * 2.2);
      if (Math.abs(theme.k - targetK) < 0.002) theme.k = targetK;
      updateThemeColors();
    }
    env.breeze += (env.breezeT - env.breeze) * Math.min(1, dt * 1.6);
    env.lampK += ((env.lampOn ? 1 : 0) - env.lampK) * Math.min(1, dt * 7);

    stepTweens(dt);
    stepCamera(dt);
    computeMats(); // 物件 update 里可能用 panOf/projectPoint，先备好矩阵
    for (const o of objects) if (o.update) o.update(dt, frameT, env);

    // 世界矩阵（DFS 序保证父先于子）
    for (const n of allNodes) {
      if (n === sceneRoot) continue;
      M4.compose(n.pos, n.rot, n.scale, n.world);
      if (n.parent !== sceneRoot) M4.mul(n.parent.world, n.world, n.world);
    }

    PLR.render();
  }
})();
