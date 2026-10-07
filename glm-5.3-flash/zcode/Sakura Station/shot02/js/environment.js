/* ============================================================
 * environment.js — 天空 / 云 / 地面 / 道路 / 铁轨 / 接触网 / 远山
 * ============================================================ */
"use strict";

/* ---------- 全局布局常量（其他模块共用） ---------- */
const L = {
  ROAD: { x0: 6.9, x1: 13.1, cx: 10, zS: 68, zN: -66 },   // 主街（南北向）
  SIDEW_W: [4.2, 6.7],   // 西侧人行道 x 范围
  SIDEW_E: [13.3, 15.8], // 东侧人行道 x 范围
  RAIL1: -20.0,          // 近侧轨道中心线 z
  RAIL2: -24.6,          // 远侧轨道中心线 z
  TRACK_X: 78,           // 轨道沿 x 铺设的半长
  PLAT: { x0: -36, x1: 6, z0: -18.4, z1: -14.2, y: 1.02 },  // 站台
  STATION: { x0: -26, x1: -6, z0: -14.0, z1: -9.0 },          // 站房（偏西，东侧留出视线通廊）
  SQUARE: { x0: -6.5, x1: 7, z0: -8.0, z1: 2.6 },            // 站前广场
};

/* ---------- 天空穹顶 ---------- */
{
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top:   { value: new THREE.Color(PAL.skyTop) },
      mid:   { value: new THREE.Color(PAL.skyMid) },
      low:   { value: new THREE.Color(PAL.skyLow) },
      sunDir:{ value: new THREE.Vector3(-46, 58, 42).normalize() },
      sunCol:{ value: new THREE.Color(PAL.sunGlow) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol;
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 c = h > 0.14 ? mix(mid, top, smoothstep(0.14, 0.75, h))
                          : mix(low, mid, smoothstep(-0.02, 0.14, h));
        float s = pow(max(dot(vDir, sunDir), 0.0), 6.0);
        c += sunCol * s * 0.28;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(430, 28, 18), skyMat));
}

/* ---------- 太阳光晕 sprite ---------- */
{
  const t = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,244,214,0.85)");
    gr.addColorStop(0.4, "rgba(255,236,196,0.30)");
    gr.addColorStop(1, "rgba(255,236,196,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(150, 150, 1);
  sp.position.set(-215, 260, 200);
  scene.add(sp);
}

/* ---------- 薄云（被风拉长的动画云） ---------- */
const _clouds = [];
{
  const cloudTop = basic(0xffffff, { fog: false });
  const cloudBot = basic(0xdce9f3, { fog: false });
  const defs = [
    [-70, 52, -130, 26, 5, 9], [30, 62, -150, 34, 6, 11], [95, 48, -90, 22, 4.5, 8],
    [-130, 58, -20, 30, 5.5, 10], [60, 70, 40, 26, 5, 9], [-40, 75, 90, 38, 6, 12],
  ];
  for (const [x, y, z, w, h, d] of defs) {
    const g = group(x, y, z);
    const n = ri(3, 5);
    for (let i = 0; i < n; i++) {
      const sx = rr(0.5, 1.0);
      const top = sph(rr(w * 0.25, w * 0.45), cloudTop, rr(-w * 0.35, w * 0.35), rr(-h * 0.2, h * 0.35), rr(-d * 0.25, d * 0.25), { sx, sy: rr(0.35, 0.55), sz: rr(0.5, 0.9), cs: false, rs: false, seg: 10 });
      const bot = sph(rr(w * 0.3, w * 0.5), cloudBot, top.position.x, top.position.y - rr(0.5, 1.2), top.position.z, { sx: sx * 1.05, sy: rr(0.25, 0.4), sz: rr(0.6, 0.9), cs: false, rs: false, seg: 10 });
      g.add(top, bot);
    }
    g.userData.spd = rr(0.5, 1.1);
    _clouds.push(g);
    scene.add(g);
  }
}

/* ---------- 地面基色 ---------- */
{
  const ground = plane(460, 460, toon(0xa3ad8a), 0, -0.02, 0, { rx: -Math.PI / 2, cs: false });
  ground.name = "ground";
  scene.add(ground);
  // 大块色斑变化
  const patchCols = [0x9ca87b, 0xa9b28a, 0x99a678, 0xb0b795];
  for (let i = 0; i < 26; i++) {
    const r = rr(4, 14);
    const m = plane(r, r, basic(pick(patchCols), { opa: 0.22 }), rr(-95, 95), 0.005 + i * 0.0004, rr(-95, 60), { rx: -Math.PI / 2, cs: false });
    scene.add(m);
  }
}

/* ---------- 主街（道路 / 人行道 / 标线 / 排水沟） ---------- */
{
  const R = L.ROAD;
  const roadLen = R.zS - R.zN;
  const roadMat = toon(PAL.road);

  // 路面（分两段，中间铁轨区由道口覆盖）
  scene.add(plane(R.x1 - R.x0, roadLen, roadMat, R.cx, 0.02, (R.zS + R.zN) / 2, { rx: -Math.PI / 2, cs: false }));

  // 车辙磨损带
  const wearMat = basic(0x545b66, { opa: 0.35 });
  for (const lx of [7.9, 9.3, 10.7, 12.1]) {
    scene.add(plane(0.55, roadLen - 6, wearMat, lx, 0.031, (R.zS + R.zN) / 2, { rx: -Math.PI / 2, cs: false }));
  }
  // 修补痕迹
  const patchMat = basic(0x767d87, { opa: 0.5 });
  for (let i = 0; i < 7; i++) {
    const w = rr(1.2, 3.2), l = rr(1.5, 4);
    scene.add(plane(w, l, patchMat, rr(R.x0 + 1, R.x1 - 1), 0.032, rr(R.zN + 8, R.zS - 6), { rx: -Math.PI / 2, cs: false, ry: rr(-0.1, 0.1) }));
  }
  // 裂缝细线
  const crackMat = basic(0x4b515b, { opa: 0.55 });
  for (let i = 0; i < 10; i++) {
    scene.add(plane(0.05, rr(0.8, 2.4), crackMat, rr(R.x0 + 0.6, R.x1 - 0.6), 0.033, rr(R.zN + 8, R.zS - 6), { rx: -Math.PI / 2, cs: false, ry: rr(0, 3.14) }));
  }

  // 道路边缘白线
  const lineMat = basic(PAL.lineWhite);
  scene.add(plane(0.13, roadLen - 5.6, lineMat, R.x0 + 0.28, 0.036, (R.zS + R.zN) / 2, { rx: -Math.PI / 2, cs: false }));
  scene.add(plane(0.13, roadLen - 5.6, lineMat, R.x1 - 0.28, 0.036, (R.zS + R.zN) / 2, { rx: -Math.PI / 2, cs: false }));
  // 中央白实线（道口区断开）
  for (const [z0, z1] of [[R.zN + 4, -28.2], [-17.4, 1.6], [4.2, R.zS - 3]]) {
    scene.add(plane(0.14, z1 - z0, lineMat, R.cx, 0.036, (z0 + z1) / 2, { rx: -Math.PI / 2, cs: false }));
  }

  // 站前斑马线
  for (let i = 0; i < 8; i++) {
    scene.add(plane(0.55, 3.4, lineMat, R.x0 + 0.6 + i * 0.78, 0.037, 2.0, { rx: -Math.PI / 2, cs: false }));
  }

  // 「止まれ」路面文字（北上车道，道口南方）
  {
    const t = canvasTex(256, 256, (g) => {
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = "#f2f3ef";
      g.font = `900 92px ${FONT_JP}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("止", 128, 78);
      g.fillText("ま", 128, 178);
      g.font = `900 74px ${FONT_JP}`;
      g.fillText("れ", 128, 178 + 92);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), basic(0xffffff, { map: t, opa: 0.92 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(8.9, 0.038, -12.6);
    scene.add(m);
  }

  // 路缘石 + 人行道
  const curbMat = toon(PAL.curb), sideMat = toon(PAL.sidewalk);
  for (const [a, b] of [[L.SIDEW_W[1], R.x0], [R.x1, L.SIDEW_E[0]]]) {
    scene.add(box(b - a, 0.13, roadLen, curbMat, (a + b) / 2, 0.065, (R.zS + R.zN) / 2, { cs: false }));
  }
  scene.add(box(L.SIDEW_W[1] - L.SIDEW_W[0], 0.09, roadLen, sideMat, (L.SIDEW_W[0] + L.SIDEW_W[1]) / 2, 0.045, (R.zS + R.zN) / 2, { cs: false }));
  scene.add(box(L.SIDEW_E[1] - L.SIDEW_E[0], 0.09, roadLen, sideMat, (L.SIDEW_E[0] + L.SIDEW_E[1]) / 2, 0.045, (R.zS + R.zN) / 2, { cs: false }));

  // 排水沟（混凝土边 + 深色格栅盖板）
  const gutterMat = toon(0xa9adb2), grateMat = toon(0x565a60);
  for (const gx of [6.62, 13.38]) {
    scene.add(box(0.42, 0.1, roadLen, gutterMat, gx, 0.03, (R.zS + R.zN) / 2, { cs: false }));
    for (let z = R.zN + 2; z < R.zS; z += 2.6) {
      scene.add(box(0.34, 0.02, 0.62, grateMat, gx, 0.085, z + rr(-0.1, 0.1), { cs: false }));
    }
  }

  // 井盖
  const manMat = toon(0x4e545c);
  for (const [mx, mz] of [[9.1, 22.5], [11.2, -4.5]]) {
    scene.add(cyl(0.42, 0.42, 0.03, 16, manMat, mx, 0.042, mz, { cs: false }));
  }

  // 站前广场铺装（浅灰方砖 + 色差）
  {
    const S = L.SQUARE;
    const w = S.x1 - S.x0, d = S.z1 - S.z0;
    scene.add(box(w, 0.1, d, toon(0xc6c9c9), (S.x0 + S.x1) / 2, 0.05, (S.z0 + S.z1) / 2, { cs: false }));
    for (let i = 0; i < 8; i++) {
      scene.add(plane(rr(0.8, 2), rr(0.8, 2), basic(i % 2 ? 0xd2d5d4 : 0xbbbec0, { opa: 0.5 }),
        rr(S.x0 + 0.6, S.x1 - 0.6), 0.102, rr(S.z0 + 0.5, S.z1 - 0.5), { rx: -Math.PI / 2, cs: false }));
    }
  }
}

/* ---------- 铁轨系统（道床 / 枕木 / 钢轨 / 道口铺面） ---------- */
{
  const TX = L.TRACK_X;
  // 道床
  const bedMat = toon(0x857d72);
  for (const tz of [L.RAIL1, L.RAIL2]) {
    scene.add(box(TX * 2, 0.2, 3.9, bedMat, 0, 0.1, tz, { cs: false }));
  }
  // 碎石（实例化）
  {
    const N = 2600;
    const geo = new THREE.DodecahedronGeometry(0.075, 0);
    const mat = toon(0xffffff);
    const inst = new THREE.InstancedMesh(geo, mat, N);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const tz = rng() < 0.5 ? L.RAIL1 : L.RAIL2;
      const px = rr(-TX, TX);
      if (Math.abs(px) > 44 && rng() < 0.55) { i--; continue; }   // 远处稀疏
      v.set(px, rr(0.16, 0.24), tz + rr(-1.75, 1.75));
      e.set(rr(0, 3.1), rr(0, 3.1), rr(0, 3.1)); q.setFromEuler(e);
      const sc = rr(0.5, 1.7); s.set(sc, sc * rr(0.5, 0.9), sc);
      mtx.compose(v, q, s);
      inst.setMatrixAt(i, mtx);
      const c = pick([0x9a948c, 0x867e72, 0xa39a8a, 0x77706a, 0xb0a698]);
      col.setHex(c).multiplyScalar(rr(0.85, 1.08));
      inst.setColorAt(i, col);
    }
    inst.castShadow = false; inst.receiveShadow = true;
    scene.add(inst);
  }
  // 枕木
  {
    const N = 480;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.35, 0.14, 0.24), toon(PAL.sleeper), N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const tz of [L.RAIL1, L.RAIL2]) {
      for (let x = -TX + 1; x < TX && i < N; x += 0.63) {
        v.set(x + rr(-0.015, 0.015), 0.265, tz); mtx.compose(v, q, s);
        inst.setMatrixAt(i++, mtx);
      }
    }
    inst.castShadow = false; inst.receiveShadow = true;
    scene.add(inst);
  }
  // 钢轨（亮顶 + 深侧）
  const webMat = toon(PAL.railSide), headMat = toon(PAL.railTop);
  for (const tz of [L.RAIL1, L.RAIL2]) {
    for (const gz of [-0.5335, 0.5335]) {
      scene.add(box(TX * 2, 0.09, 0.075, webMat, 0, 0.375, tz + gz, { cs: false }));
      scene.add(box(TX * 2, 0.045, 0.095, headMat, 0, 0.44, tz + gz, { cs: false }));
    }
  }
  // 道口铺面（道路范围内）
  const paveMat = toon(0x9ba0a6), grooveMat = toon(0x4c5057);
  for (const tz of [L.RAIL1, L.RAIL2]) {
    // 两轨之间的面板
    scene.add(box(L.ROAD.x1 - L.ROAD.x0 + 1.2, 0.12, 0.95, paveMat, L.ROAD.cx, 0.385, tz, { cs: false }));
    // 两轨外侧的面板
    for (const s of [-1, 1]) {
      scene.add(box(L.ROAD.x1 - L.ROAD.x0 + 1.2, 0.12, 1.35, paveMat, L.ROAD.cx, 0.385, tz + s * (0.5335 + 0.75), { cs: false }));
    }
    // 轮缘槽
    for (const gz of [-0.5335, 0.5335]) {
      scene.add(box(L.ROAD.x1 - L.ROAD.x0 + 1.2, 0.1, 0.13, grooveMat, L.ROAD.cx, 0.4, tz + gz, { cs: false }));
    }
  }
}

/* ---------- 铁路接触网（电柱 / 横梁 / 悬线） ---------- */
{
  const poleMat = toon(0x77797d), beamMat = toon(0x5f636b), insuMat = toon(0x8f9aa4);
  const poleZ = -22.3;
  const poleXs = [-64, -42, -20, 26, 48, 70];
  for (const px of poleXs) {
    const g = group(px, 0, poleZ);
    const pole = cyl(0.11, 0.15, 6.4, 8, poleMat, 0, 3.2, 0);
    g.add(pole);
    outline(pole, 0.022);
    // 双轨横梁（跨越两条轨道）
    const beam = box(0.14, 0.12, 5.8, beamMat, 0, 5.35, 0);
    g.add(beam);
    outline(beam, 0.02);
    // 斜撑
    const strut = box(0.08, 1.5, 0.08, beamMat, 0.14, 4.8, -1.0, { rx: 0.45 });
    g.add(strut);
    // 绝缘子
    for (const bz of [L.RAIL1, L.RAIL2, poleZ]) {
      g.add(box(0.1, 0.16, 0.1, insuMat, 0, 5.5, bz - poleZ));
    }
    scene.add(g);
  }
  // 悬挂线（承力索带弧垂）+ 接触线（平直）
  for (const tz of [L.RAIL1, L.RAIL2]) {
    for (let i = 0; i < poleXs.length - 1; i++) {
      const a = new THREE.Vector3(poleXs[i], 5.62, tz), b = new THREE.Vector3(poleXs[i + 1], 5.62, tz);
      WireBank.sag(a, b, 0.4, 10);
    }
    // 接触线（直线段）
    WireBank.add([new THREE.Vector3(-TX, 5.06, tz), new THREE.Vector3(TX, 5.06, tz)]);
    // 回流线（沿柱较低处）
    WireBank.add([new THREE.Vector3(-TX, 2.6, poleZ + 0.35), new THREE.Vector3(TX, 2.6, poleZ + 0.35)]);
  }
}

/* ---------- 远山 / 远景房屋剪影 ---------- */
{
  const hillMat = toon(PAL.hill), hillFarMat = toon(PAL.hillFar);
  const hills = [
    [-120, -160, 95, 26, hillFarMat], [10, -175, 120, 30, hillFarMat], [130, -155, 100, 24, hillFarMat],
    [-70, -120, 70, 18, hillMat], [80, -128, 80, 20, hillMat],
  ];
  for (const [x, z, r, h, m] of hills) {
    scene.add(sph(r, m, x, 0, z, { sy: h / r, sz: r * 0.55, cs: false, seg: 14 }));
  }
  // 远景小房子剪影（实例化）
  {
    const N = 46;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff), N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      v.set(rr(-95, 95), 0, rr(-88, -58));
      e.set(0, rr(-0.3, 0.3), 0); q.setFromEuler(e);
      const w = rr(5, 10), h = rr(2.6, 5.2);
      s.set(w, h, rr(4, 7));
      mtx.compose(v, q, s);
      inst.setMatrixAt(i, mtx);
      col.setHex(pick([0x9fb4bf, 0xa8b8c0, 0x93a8b4, 0xb0bfc4]));
      inst.setColorAt(i, col);
    }
    inst.castShadow = false; inst.receiveShadow = false;
    scene.add(inst);
    // 屋顶
    const roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
    const roofs = new THREE.InstancedMesh(roofGeo, toon(0x74848e), N);
    for (let i = 0; i < N; i++) {
      inst.getMatrixAt(i, mtx);
      mtx.decompose(v, q, s);
      const e2 = new THREE.Euler().setFromQuaternion(q);
      const m2 = new THREE.Matrix4().compose(
        new THREE.Vector3(v.x, v.y + s.y + s.x * 0.16, v.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e2.y + Math.PI / 4, 0)),
        new THREE.Vector3(s.x * 0.92, s.x * 0.34, s.z * 0.92)
      );
      roofs.setMatrixAt(i, m2);
    }
    roofs.castShadow = false;
    scene.add(roofs);
  }
}

/* ---------- 漫游模式可站立区域注册 ---------- */
registerGround(L.PLAT.x0, L.PLAT.x1, L.PLAT.z0, L.PLAT.z1, L.PLAT.y);   // 站台
registerGround(L.SQUARE.x0, L.SQUARE.x1, L.SQUARE.z0, L.SQUARE.z1, 0.1); // 广场
