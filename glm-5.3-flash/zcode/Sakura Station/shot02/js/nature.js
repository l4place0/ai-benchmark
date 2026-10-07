/* ============================================================
 * nature.js — 樱花树 / 草地 / 地面花瓣 / 飘落花瓣 / 猫与麻雀
 * ============================================================ */
"use strict";

/* ---------- 简易几何合并（同属性 indexed geometry） ---------- */
function mergeGeos(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv  = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo;
      io += a.length;
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) idx[io + i] = i + vo;
      io += g.attributes.position.count;
    }
    vo += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/* ---------- 花瓣贴图 ---------- */
const petalTex = canvasTex(64, 64, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  // 樱花瓣：心形带缺口
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(32, 58);
  c.bezierCurveTo(8, 42, 6, 18, 22, 12);
  c.bezierCurveTo(28, 9, 32, 14, 32, 18);   // 顶部缺口
  c.bezierCurveTo(32, 14, 36, 9, 42, 12);
  c.bezierCurveTo(58, 18, 56, 42, 32, 58);
  c.fill();
  // 淡淡的边缘描色
  c.strokeStyle = "rgba(240,150,180,0.55)"; c.lineWidth = 3; c.stroke();
  // 中心脉络
  c.strokeStyle = "rgba(235,170,195,0.5)"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(32, 52); c.lineTo(32, 26); c.stroke();
});

/* ---------- 樱花树 ---------- */
const blobGeo = new THREE.IcosahedronGeometry(1, 2);
const blobMat = toon(0xffffff);
const trunkMat = toon(0x6b5648);
const _treeOutMats = { blob: outlineMat(0.011, 0xb4688a), trunk: outlineMat(0.028, PAL.outline) };

function makeSakura(x, z, opt) {
  opt = opt || {};
  const R = opt.R || 4;              // 树冠半径
  const H = opt.h || R * 1.45;       // 干高
  const leanX = opt.leanX || 0;      // 倾斜方向（树冠偏移）
  const leanZ = opt.leanZ || 0;
  const nBlob = opt.n || Math.round(40 + R * 5);
  const g = group(x, 0, z);
  const s = R / 4.4;                  // 干粗比例

  /* --- 树干与枝条（合并为单几何） --- */
  const parts = [];
  const m1 = new THREE.Matrix4();
  const addPart = (geo, px, py, pz, rx, ry, rz, sx, sy, sz) => {
    const mm = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
      new THREE.Vector3(sx || 1, sy || 1, sz || 1)
    );
    const gg = geo.clone().applyMatrix4(m1.copy(mm));
    parts.push(gg);
  };
  const bend = 0.06 + rng() * 0.05;
  addPart(new THREE.CylinderGeometry(0.26 * s, 0.32 * s, 0.5, 7), 0, 0.22, 0);                       // 根部
  addPart(new THREE.CylinderGeometry(0.15 * s, 0.24 * s, H * 0.55, 7), bend * H, H * 0.26, 0, 0, 0, -bend * 1.2);
  const midX = bend * H * 1.55, topY = H * 0.62;
  addPart(new THREE.CylinderGeometry(0.09 * s, 0.15 * s, H * 0.5, 7),
    midX + leanX * 0.1, topY, leanZ * 0.1, leanZ * 0.1, 0, -bend * 0.5 - leanX * 0.05);
  // 主枝 ×4~6
  const nB = ri(4, 6);
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2 + rr(-0.3, 0.3);
    const bl = rr(0.16, 0.3) * R + 0.5;
    addPart(new THREE.CylinderGeometry(0.022 * s * 2, 0.05 * s * 2, bl, 5),
      midX + leanX * 0.35 + Math.cos(a) * bl * 0.28,
      topY + H * 0.18 + rr(0, 0.4),
      leanZ * 0.35 + Math.sin(a) * bl * 0.28,
      Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9 - 0.25);
  }
  const trunkGeo = mergeGeos(parts);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  const trunkOut = new THREE.Mesh(trunkGeo, _treeOutMats.trunk);
  trunk.add(trunkOut);

  /* --- 树冠（花簇团块，实例化 + 描边实例） --- */
  const cx = midX + leanX * 0.35, cy = H * 0.92 + R * 0.42, cz = leanZ * 0.35;
  const inst = new THREE.InstancedMesh(blobGeo, blobMat, nBlob);
  const outInst = new THREE.InstancedMesh(blobGeo, _treeOutMats.blob, nBlob);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < nBlob; i++) {
    // 球面偏外分布，底部收起，树冠下方留出街景视线
    let dx = rr(-1, 1), dy = rr(-0.55, 1), dz = rr(-1, 1);
    const l = Math.hypot(dx, dy, dz) || 1;
    const shell = 0.28 + 0.62 * Math.sqrt(rng());
    v.set(cx + (dx / l) * R * shell, cy + (dy / l) * R * shell * 0.75, cz + (dz / l) * R * shell);
    const outer = shell;
    const isLeaf = rng() < 0.02;                    // 少量低饱和新叶点缀
    const bs = R * (0.15 + 0.12 * (1 - outer)) * rr(0.85, 1.2);
    e.set(rr(0, 3.1), rr(0, 3.1), 0); q.setFromEuler(e);
    sc.set(bs, bs * rr(0.6, 0.75), bs);
    if (isLeaf) sc.multiplyScalar(0.55);            // 叶团更小
    mtx.compose(v, q, sc);
    inst.setMatrixAt(i, mtx);
    sc.multiplyScalar(1.045);
    mtx.compose(v, q, sc);
    outInst.setMatrixAt(i, mtx);
    // 色阶：受光面（西南）更亮，背光面（东北）偏紫灰
    const sunSide = (dx * -0.75 + dz * 0.55) / l;   // >0 朝太阳
    if (isLeaf) {
      col.setHex(pick([0x9fae82, 0x94a878]));
    } else if (sunSide > 0.3) {
      col.setHex(pick([PAL.sakura2, PAL.sakura2, PAL.sakura1]));
    } else if (sunSide < -0.35) {
      col.setHex(pick([PAL.sakuraBack, PAL.sakura3, PAL.sakuraBack]));
    } else {
      col.setHex(pick([PAL.sakura2, PAL.sakura3, PAL.sakura3, PAL.sakura4]));
    }
    col.multiplyScalar(0.92 + rng() * 0.14);
    inst.setColorAt(i, col);
  }
  inst.castShadow = true; inst.receiveShadow = true;
  outInst.castShadow = false; outInst.receiveShadow = false;
  g.add(inst, outInst);

  /* --- 树池 --- */
  if (opt.pool !== false) {
    const soil = cyl(R * 0.16 + 0.35, R * 0.16 + 0.4, 0.12, 12, toon(0x55483a), 0, 0.05, 0, { cs: false });
    g.add(soil);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(box(0.44, 0.16, 0.2, toon(0x8f918c), Math.cos(a) * (R * 0.16 + 0.52), 0.08, Math.sin(a) * (R * 0.16 + 0.52), { ry: -a, cs: false }));
    }
  }
  scene.add(g);
  return { crown: new THREE.Vector3(x + cx, cy, z + cz), R };
}

/* ---------- 飘落花瓣系统 ---------- */
const Nature = { petals: null, data: [] };
{
  // 出生区域（加权）
  const zones = [
    { x0: 2, x1: 19, z0: -30, z1: 56, y0: 0.5, y1: 9.5, w: 0.40 },     // 街道峡谷
    { x0: -14, x1: 1, z0: -9, z1: 6, y0: 1, y1: 11, w: 0.16 },         // 广场大树
    { x0: -37, x1: 9, z0: -31, z1: -11, y0: 1.5, y1: 9, w: 0.22 },     // 站台与电车
    { x0: -20, x1: 22, z0: -56, z1: -28, y0: 1, y1: 8, w: 0.10 },      // 铁轨北侧
    { x0: -60, x1: 60, z0: -60, z1: 62, y0: 2, y1: 12, w: 0.12 },      // 全局远景
  ];
  const totalW = zones.reduce((s, z) => s + z.w, 0);
  function pickZone() {
    let r = rng() * totalW;
    for (const z of zones) { if ((r -= z.w) <= 0) return z; }
    return zones[0];
  }

  const N = 1400;
  const geo = new THREE.PlaneGeometry(0.105, 0.15);
  const mat = new THREE.MeshBasicMaterial({
    map: petalTex, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  inst.frustumCulled = false;
  inst.castShadow = false; inst.receiveShadow = false;
  const col = new THREE.Color();
  const P = Nature.data;
  for (let i = 0; i < N; i++) {
    const z = pickZone();
    P.push({
      x: rr(z.x0, z.x1), y: rr(z.y0, z.y1), z: rr(z.z0, z.z1),
      fall: rr(0.32, 0.85),
      sf: rr(0.5, 1.6), ph: rr(0, 6.28),          // 摇摆频率 / 相位
      rx: rr(0, 6.28), ry: rr(0, 6.28), rz: rr(0, 6.28),
      wx: rr(0.6, 2.2), wz: rr(0.6, 2.2),          // 翻滚速度
      s: rr(0.6, 1.65),
      wind: rr(0.55, 1.35),
      zone: z,
    });
    col.setHex(pick([PAL.sakura2, PAL.sakura2, PAL.sakura1, PAL.sakura3, 0xffe4ec]));
    col.multiplyScalar(rr(0.9, 1.08));
    inst.setColorAt(i, col);
  }
  Nature.petals = inst;
  Nature.pickZone = pickZone;
  scene.add(inst);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  Nature.update = function (dt, t) {
    const gust = 0.75 + 0.45 * Math.sin(t * 0.23) + 0.22 * Math.sin(t * 0.61 + 1.7);
    const windX = 0.62 * gust, windZ = 0.24 * gust;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      p.y -= p.fall * dt;
      p.x += (windX * p.wind + Math.sin(t * p.sf + p.ph) * 0.34) * dt * 2.1;
      p.z += (windZ * p.wind + Math.cos(t * p.sf * 0.83 + p.ph) * 0.30) * dt * 2.1;
      p.rx += p.wx * dt; p.rz += p.wz * dt;
      const ground = (p.x > L.PLAT.x0 - 1 && p.x < L.PLAT.x1 + 1 && p.z > L.PLAT.z0 && p.z < L.PLAT.z1) ? 1.06 : 0.06;
      if (p.y < ground) {
        const z = Nature.pickZone();
        p.x = rr(z.x0, z.x1); p.y = rr(z.y0, z.y1); p.z = rr(z.z0, z.z1);
      }
      _v.set(p.x, p.y, p.z);
      _e.set(p.rx, p.ry + Math.sin(t * 0.7 + p.ph) * 0.8, p.rz);
      _q.setFromEuler(_e);
      _s.set(p.s, p.s, p.s);
      _m.compose(_v, _q, _s);
      inst.setMatrixAt(i, _m);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
}

/* ---------- 地面花瓣（随风聚集的条带与小堆） ---------- */
{
  const N = 1050;
  const geo = new THREE.PlaneGeometry(0.095, 0.13);
  const mat = new THREE.MeshBasicMaterial({ map: petalTex, alphaTest: 0.35, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  const put = (x, y, z) => {
    if (i >= N) return;
    v.set(x + rr(-0.06, 0.06), y + rr(0, 0.015), z + rr(-0.06, 0.06));
    e.set(-Math.PI / 2 + rr(-0.25, 0.25), rr(0, 3.14), rr(0, 3.14));
    q.setFromEuler(e);
    const sc = rr(0.7, 1.5); s.set(sc, sc, sc);
    mtx.compose(v, q, s);
    inst.setMatrixAt(i, mtx);
    col.setHex(pick([PAL.sakura3, PAL.sakura2, PAL.sakura4, 0xffc9d8, PAL.sakuraBack]));
    col.multiplyScalar(rr(0.85, 1.05));
    inst.setColorAt(i, col);
    i++;
  };
  const rect = (x0, x1, z0, z1, y, n, rot) => {
    for (let k = 0; k < n; k++) {
      let lx = rr(x0, x1), lz = rr(z0, z1);
      if (rot) {
        const a = rot;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        const dx = lx - mx, dz = lz - mz;
        lx = mx + dx * Math.cos(a) - dz * Math.sin(a);
        lz = mz + dx * Math.sin(a) + dz * Math.cos(a);
      }
      put(lx, y, lz);
    }
  };
  const ring = (cx, cz, r0, r1, y, n) => {
    for (let k = 0; k < n; k++) {
      const a = rr(0, 6.28), r = rr(r0, r1);
      put(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    }
  };
  // 排水沟旁的条带（人行道一侧略高）
  rect(6.42, 6.66, -27, 30, 0.098, 110);
  rect(13.34, 13.58, -27, 30, 0.098, 100);
  rect(6.95, 7.12, -27, 24, 0.042, 45);
  rect(12.88, 13.05, -27, 24, 0.042, 45);
  // 道口两角的堆积
  ring(7.5, -15.6, 0.4, 1.6, 0.045, 85);
  ring(12.7, -28.4, 0.4, 1.8, 0.045, 95);
  // 广场大树下的环 + 广场散落
  ring(-6.5, -1.5, 2.3, 3.5, 0.115, 125);
  rect(-6, 6.5, -7.5, 2.2, 0.112, 60);
  // 站台边缘与角落
  rect(-35.5, 5.5, -18.2, -17.8, 1.045, 100);
  rect(-36, -34, -18.2, -14.4, 1.045, 30);
  rect(4, 5.8, -18.2, -14.4, 1.045, 26);
  // 轨道碎石间
  rect(-42, 42, -22.4, -21.4, 0.27, 45);
  rect(-42, 42, -25.8, -24.8, 0.27, 40);
  // 咖啡店露台 / 便利店前
  ring(6.1, 17.6, 0.6, 2.0, 0.105, 55);
  rect(15.3, 16.8, 3, 11.5, 0.17, 55);
  // 路中央风痕（斜向条带，顺着风）
  rect(7.0, 9.5, 8, 30, 0.042, 45, -0.35);
  rect(10.5, 12.9, -6, 16, 0.042, 45, -0.35);
  rect(8, 11, -24, -10, 0.042, 40, 0.3);
  // 车站入口前 / 北侧路旁
  ring(3.2, -10.6, 0.5, 1.8, 0.055, 45);
  ring(10, -31.5, 0.5, 2.0, 0.05, 55);
  inst.castShadow = false; inst.receiveShadow = false;
  scene.add(inst);
}

/* ---------- 草丛 / 蒲公英 ---------- */
{
  const N = 1150;
  const geo = new THREE.ConeGeometry(0.055, 0.3, 4);
  geo.translate(0, 0.15, 0);
  const inst = new THREE.InstancedMesh(geo, toon(0xffffff, { flat: true }), N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  const put = (x, z, y, dense) => {
    if (i >= N || rng() > dense) return;
    v.set(x, y, z);
    e.set(rr(-0.2, 0.2), rr(0, 3.14), rr(-0.2, 0.2));
    q.setFromEuler(e);
    const sc = rr(0.6, 1.6); s.set(sc, sc, sc);
    mtx.compose(v, q, s);
    inst.setMatrixAt(i, mtx);
    col.setHex(pick([0xa3ad72, 0x98a86a, 0xaeb87e, 0x8f9e62]));
    inst.setColorAt(i, col);
    i++;
  };
  // 轨道两侧野草
  for (let x = -70; x < 70; x += 0.9) {
    if (x > 4 && x < 15.5) continue;
    for (const tz of [L.RAIL1, L.RAIL2]) {
      for (const sgn of [-1, 1]) {
        const dz = rr(1.5, 2.35);
        const gy = dz < 1.92 ? 0.2 : 0.05;
        put(x + rr(-0.4, 0.4), tz + sgn * dz, gy, 0.55);
      }
    }
  }
  // 北侧路旁 / 围栏边
  for (let k = 0; k < 130; k++) {
    put(rr(4.3, 6.5), rr(-34, -29), 0.12, 0.8);
    put(rr(13.5, 15.7), rr(-34, -29), 0.12, 0.8);
  }
  // 西侧住宅庭院
  for (let k = 0; k < 140; k++) {
    put(rr(-22, 2), rr(24, 56), 0.02, 0.75);
  }
  // 铁轨北侧开阔地
  for (let k = 0; k < 260; k++) {
    put(rr(-45, 45), rr(-58, -29), 0.02, 0.6);
  }
  // 树下与花坛边
  for (let k = 0; k < 60; k++) {
    const a = rr(0, 6.28), r = rr(2.8, 4.2);
    put(-6.5 + Math.cos(a) * r, -1.5 + Math.sin(a) * r, 0.13, 0.9);
  }
  inst.count = i;
  inst.castShadow = false; inst.receiveShadow = true;
  scene.add(inst);

  // 蒲公英与小白花
  const dN = 90;
  const dInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), toon(0xffffff, { flat: true }), dN);
  let di = 0;
  for (let k = 0; k < dN; k++) {
    let x, z, y;
    if (k % 3 === 0) { const dz = rr(1.9, 2.3); x = rr(-40, 40); z = L.RAIL1 + pick([1, -1]) * dz; y = dz < 1.95 ? 0.26 : 0.06; }
    else { x = rr(-30, 30); z = rr(-56, -30); y = 0.05; }
    if (x > 4 && x < 15.5) continue;
    v.set(x, y, z); q.set(0, 0, 0, 1); s.set(1, 1, 1);
    mtx.compose(v, q, s);
    dInst.setMatrixAt(di, mtx);
    col.setHex(pick([0xf4f4ea, 0xf6d84a, 0xfafae8]));
    dInst.setColorAt(di, col);
    di++;
  }
  dInst.count = di;
  scene.add(dInst);
}

/* ---------- 猫与麻雀 ---------- */
function makeCat(x, y, z, ry, col, patch) {
  const g = group(x, y, z, ry);
  const m = toon(col);
  const body = sph(0.11, m, 0, 0.11, 0, { sx: 0.82, sy: 1.15, sz: 1.0 });
  g.add(body);
  g.add(sph(0.075, m, 0, 0.24, 0.045, { cs: false }));
  g.add(box(0.028, 0.045, 0.02, m, -0.035, 0.3, 0.045, { rz: 0.25, cs: false }));
  g.add(box(0.028, 0.045, 0.02, m, 0.035, 0.3, 0.045, { rz: -0.25, cs: false }));
  // 尾巴（卷起）
  const tail = cyl(0.016, 0.02, 0.22, 5, m, 0, 0.14, -0.12, { rx: 1.1, rz: 0.4, cs: false });
  g.add(tail);
  if (patch) {
    g.add(sph(0.045, toon(patch), 0.02, 0.27, 0.05, { cs: false }));
  }
  outline(body, 0.01);
  scene.add(g);
}
function buildAnimals() {
  // 车站屋顶上的白猫
  makeCat(-8, 5.22, -11.5, -Math.PI / 2, 0xf4f2ee, null);
  // 咖啡店屋顶三花猫
  makeCat(2.5, 3.45, 19, Math.PI / 2, 0xf4f2ee, 0xe8944a);
  // 北侧围墙黑猫
  makeCat(19.5, 1.16, -29.5, Math.PI, 0x2e2c30, null);
  // 电线上的麻雀
  const sparrowMat = toon(0x6a5344);
  const wireY0 = 7.82;
  for (let i = 0; i < 5; i++) {
    const t = 0.18 + i * 0.16;
    const bz = 22 + (36 - 22) * t;
    const by = wireY0 - Math.sin(t * Math.PI) * 0.42;
    const b = group(4.55 + [-1.1, -1.1, 0, 1.1, 1.1][i], by + 0.05, bz, rr(0, 6.28));
    b.add(sph(0.055, sparrowMat, 0, 0, 0, { sx: 0.8, sy: 0.7, sz: 1.35, cs: false }));
    b.add(sph(0.03, sparrowMat, 0, 0.035, 0.06, { cs: false }));
    b.add(box(0.02, 0.015, 0.05, sparrowMat, 0, 0.02, -0.08, { cs: false }));
    scene.add(b);
  }
}

/* ---------- 汇总 ---------- */
function buildAllNature() {
  const trees = [
    { x: -6.5, z: -1.5, R: 6.0, h: 9.0, leanX: 1.6, leanZ: 0.8 },          // 站前广场大树
    { x: 5.0, z: 30, R: 4.2, h: 6.8, leanX: 2.6, leanZ: 0.3 },              // 街道西侧（越过马路上方）
    { x: 15.3, z: 20, R: 4.0, h: 6.2, leanX: -1.8, leanZ: 0.2 },            // 街道东侧
    { x: 15.4, z: -6.5, R: 3.0, h: 5.0, leanX: -1.2, leanZ: 0.3 },          // 道口旁小树
    { x: -38.5, z: -16.5, R: 4.6, h: 6.6, leanX: 1.5, leanZ: 0.4 },         // 站台西端
    { x: -28, z: -28.5, R: 5.2, h: 7.0, leanX: 0.8, leanZ: 1.8 },           // 铁轨北侧（探入画面）
    { x: 2, z: -29, R: 4.6, h: 6.8, leanX: -0.5, leanZ: 1.6 },
    { x: 19, z: -30.5, R: 4.2, h: 6.4, leanX: -1.0, leanZ: 1.4 },
    { x: 30, z: -28.5, R: 5.0, h: 7.0, leanX: -1.2, leanZ: 1.6 },
    { x: -30, z: -6, R: 5.0, h: 7.2, leanX: 1.0, leanZ: 0.4 },              // 车站西侧背景
    { x: -15, z: 35, R: 4.4, h: 6.6, leanX: 1.0, leanZ: -0.4 },
    { x: -2, z: 40.5, R: 5.0, h: 7.0, leanX: 0.8, leanZ: 0.6 },             // 前景右侧大树
    { x: -5, z: -48, R: 4.4, h: 6.6, leanX: 0.6, leanZ: 1.2 },
    { x: 10, z: -50, R: 4.6, h: 6.8, leanX: -0.6, leanZ: 1.0 },
  ];
  for (const t of trees) makeSakura(t.x, t.z, t);
  buildAnimals();
}
