import * as THREE from 'three';
import { M, C, cnv, rpt, B, put } from './toon.js';
import { TRACK_NEAR_Z, TRACK_FAR_Z, PLAZA, CROSS_X } from './cfg.js';

// ---------- 地面：草地 / 道路 / 铁轨 / 站前广场 ----------

function ribbonGeo(pts, width, vLen){
  const n = pts.length, pos = [], uv = [], idx = [];
  for(let i = 0; i < n; i++){
    const p = pts[i], p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
    let dx = p1.x - p0.x, dz = p1.z - p0.z;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz, nz = dx, w = width / 2, v = i / (n - 1) * vLen;
    pos.push(p.x + nx * w, 0, p.z + nz * w, p.x - nx * w, 0, p.z - nz * w);
    uv.push(0, v, 1, v);
  }
  for(let i = 0; i < n - 1; i++){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const cnt = pos.length / 3, nor = new Float32Array(cnt * 3);
  for(let i = 0; i < cnt; i++) nor[i * 3 + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
function ribbon(pts, width, y, mat, vLen){
  const m = new THREE.Mesh(ribbonGeo(pts, width, vLen), mat);
  m.position.y = y; m.receiveShadow = true;
  return m;
}
function roadPts(z0, z1, step, fx){
  const pts = [];
  const dir = z1 >= z0 ? 1 : -1;
  for(let z = z0; dir > 0 ? z <= z1 : z >= z1; z += step * dir) pts.push({ x: fx(z), z });
  return pts;
}

export function buildGround(ctx){
  const g = new THREE.Group(); ctx.scene.add(g);

  // 大地草地
  const grassTex = rpt(cnv(256, 256, c => {
    c.fillStyle = '#93b06b'; c.fillRect(0, 0, 256, 256);
    for(let i = 0; i < 150; i++){
      c.fillStyle = Math.random() < 0.5 ? 'rgba(122,153,88,0.45)' : 'rgba(158,183,118,0.45)';
      c.beginPath(); c.ellipse(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 5 + Math.random() * 16, Math.random() * 3, 0, 7); c.fill();
    }
  }), 44, 44);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), new THREE.MeshToonMaterial({ color: 0xffffff, map: grassTex, gradientMap: ctx.grad }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true;
  g.add(ground);

  // ---- 沥青/混凝土纹理 ----
  const asphaltTex = rpt(cnv(128, 128, c => {
    c.fillStyle = '#5a616b'; c.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 420; i++){
      c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(20,24,30,0.06)';
      c.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
    }
    c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(14, 40, 44, 10); c.fillRect(78, 90, 36, 8);
  }), 1, 1);
  const sideTex = rpt(cnv(128, 128, c => {
    c.fillStyle = '#b4b0a6'; c.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 200; i++){ c.fillStyle = 'rgba(60,60,55,0.05)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    c.strokeStyle = 'rgba(70,70,62,0.28)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 64); c.lineTo(128, 64); c.stroke();
    c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 128); c.stroke();
  }), 1, 1);
  const plazaTex = rpt(cnv(128, 128, c => {
    c.fillStyle = '#c3c6c9'; c.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 120; i++){ c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(70,78,88,0.05)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2.4, 2.4); }
    c.strokeStyle = 'rgba(88,94,102,0.4)'; c.lineWidth = 2;
    for(let k = 0; k <= 2; k++){ c.beginPath(); c.moveTo(k * 64, 0); c.lineTo(k * 64, 128); c.stroke(); c.beginPath(); c.moveTo(0, k * 64); c.lineTo(128, k * 64); c.stroke(); }
    c.fillStyle = 'rgba(150,120,130,0.10)'; c.fillRect(70, 8, 40, 44);
  }), 1, 1);

  const roadMat  = new THREE.MeshToonMaterial({ color: 0xffffff, map: asphaltTex, gradientMap: ctx.grad });
  const sideMat  = new THREE.MeshToonMaterial({ color: 0xffffff, map: sideTex, gradientMap: ctx.grad });
  const plazaMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: plazaTex, gradientMap: ctx.grad });

  // ---- 主街（带轻微弯曲）：z 从 52 到 -2 ----
  const fx = z => Math.sin((z + 8) * 0.028) * 1.8;
  const road = roadPts(52, -2, 2, fx);
  g.add(Object.assign(ribbon(road, 6.2, 0.02, roadMat, 26), {}));
  // 人行道
  const east = roadPts(52, -2, 2, z => fx(z) + 4.0);
  const west = roadPts(52, -2, 2, z => fx(z) - 4.0);
  g.add(ribbon(east, 1.7, 0.055, sideMat, 26), ribbon(west, 1.7, 0.055, sideMat, 26));
  // 路缘石
  const curbGeo = new THREE.BoxGeometry(0.18, 0.1, 2.06);
  const curbs = new THREE.InstancedMesh(curbGeo, M(C.curb), (road.length - 1) * 2);
  curbs.receiveShadow = true; curbs.castShadow = true;
  let ci = 0; const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
  for(const side of [1, -1]) for(let i = 0; i < road.length - 1; i++){
    const a = road[i], b = road[i + 1];
    const mx = (a.x + b.x) / 2 + side * 3.2, mz = (a.z + b.z) / 2;
    q.setFromAxisAngle(up, Math.atan2(a.x - b.x, a.z - b.z));
    mm.compose(new THREE.Vector3(mx, 0.045, mz), q, sc); curbs.setMatrixAt(ci++, mm);
  }
  g.add(curbs);

  // ---- 道路标线 ----
  const lineMat = new THREE.MeshBasicMaterial({ color: C.roadLine });
  const ylMat   = new THREE.MeshBasicMaterial({ color: C.centerYellow });
  for(const s of [1, -1]) g.add(ribbon(roadPts(51, -1.5, 2, z => fx(z) + s * 2.95), 0.13, 0.031, lineMat, 26));
  // 黄色中心虚线（中段）
  for(let z = 12; z < 46; z += 5.6){
    const seg = roadPts(z, z + 3, 1, fx);
    g.add(ribbon(seg, 0.12, 0.031, ylMat, 1));
  }
  // 斑马线（站前入口，路面上）
  for(let k = 0; k < 4; k++){
    const zebra = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 0.55), lineMat);
    zebra.rotation.x = -Math.PI / 2; zebra.position.set(fx(0.9), 0.033, 1.35 - k * 1.05);
    g.add(zebra);
  }

  // ---- 站前东巷 + 南北向道路（通往道口）----
  const lane = [{ x: 12.5, z: -6.8 }, { x: 20, z: -6.8 }, { x: CROSS_X + 1.6, z: -6.8 }];
  g.add(ribbon(lane, 4.6, 0.02, roadMat, 6));
  g.add(ribbon([{ x: 12.5, z: -4.6 }, { x: CROSS_X + 1.6, z: -4.6 }], 1.6, 0.055, sideMat, 6));
  const cross = roadPts(-4.4, -46, 2.5, () => CROSS_X);
  const crossPts = cross.map(p => ({ x: p.x, z: p.z }));
  g.add(ribbon(crossPts, 5.4, 0.02, roadMat, 18));
  g.add(ribbon(crossPts.map(p => ({ x: p.x + 3.4, z: p.z })), 1.6, 0.055, sideMat, 18));
  g.add(ribbon(crossPts.map(p => ({ x: p.x - 3.4, z: p.z })), 1.6, 0.055, sideMat, 18));
  // 道口前“止まれ”
  const stopTex = cnv(256, 256, c => {
    c.clearRect(0, 0, 256, 256);
    c.beginPath(); c.moveTo(24, 46); c.lineTo(232, 46); c.lineTo(128, 226); c.closePath();
    c.fillStyle = '#f5f3ee'; c.fill(); c.lineWidth = 13; c.strokeStyle = '#d0433e'; c.stroke();
    c.fillStyle = '#c93a34'; c.font = '700 56px "Yu Gothic","Meiryo",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('止まれ', 128, 108);
  });
  for(const [sx, sz, rot] of [[CROSS_X, -13.5, Math.PI], [CROSS_X, -34.5, 0]]){
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: stopTex, transparent: true }));
    d.rotation.x = -Math.PI / 2; d.rotation.z = rot; d.position.set(sx, 0.032, sz); g.add(d);
  }

  // ---- 站前广场 ----
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0), plazaMat);
  plaza.material.map = rpt(plazaTex.clone(), (PLAZA.x1 - PLAZA.x0) / 1.6, (PLAZA.z1 - PLAZA.z0) / 1.6);
  plaza.material.map.needsUpdate = true;
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set((PLAZA.x0 + PLAZA.x1) / 2, 0.04, (PLAZA.z0 + PLAZA.z1) / 2);
  plaza.receiveShadow = true; g.add(plaza);

  // ---- 道床与轨道 ----
  const ballastTex = rpt(cnv(256, 256, c => {
    c.fillStyle = '#84817b'; c.fillRect(0, 0, 256, 256);
    const cols = ['#6e6b65', '#787570', '#8d8a83', '#9a968d', '#5d5a55', '#a8a399', '#7c7568'];
    for(let i = 0; i < 900; i++){
      c.fillStyle = cols[(Math.random() * cols.length) | 0];
      const x = Math.random() * 256, y = Math.random() * 256, r = 1.5 + Math.random() * 3;
      c.beginPath(); c.ellipse(x, y, r, r * 0.75, Math.random() * 3, 0, 7); c.fill();
    }
  }), 1, 1);
  const ballastMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: ballastTex, gradientMap: ctx.grad });
  const bz = (TRACK_NEAR_Z + TRACK_FAR_Z) / 2;
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(200, 0.14, 8.4), ballastMat);
  ballast.material.map = rpt(ballastTex.clone(), 115, 5); ballast.material.map.needsUpdate = true;
  ballast.position.set(10, 0.05, bz); ballast.receiveShadow = true; g.add(ballast);

  // 枕木（实例化）
  const slGeo = new THREE.BoxGeometry(2.6, 0.13, 0.28);
  const nS = Math.floor(200 / 0.72);
  const sleepers = new THREE.InstancedMesh(slGeo, M(C.sleeper), nS * 2);
  sleepers.receiveShadow = true; sleepers.castShadow = true;
  let si = 0;
  for(const tz of [TRACK_NEAR_Z, TRACK_FAR_Z])
    for(let i = 0; i < nS; i++){
      mm.compose(new THREE.Vector3(-90 + i * 0.72, 0.14, tz), q.identity(), sc); sleepers.setMatrixAt(si++, mm);
    }
  g.add(sleepers);

  // 钢轨（微金属质感）
  const railMat = new THREE.MeshStandardMaterial({ color: 0xc6ccd2, metalness: 0.75, roughness: 0.35 });
  for(const tz of [TRACK_NEAR_Z, TRACK_FAR_Z]) for(const s of [1, -1]){
    const rail = new THREE.Mesh(new THREE.BoxGeometry(200, 0.17, 0.14), railMat);
    rail.position.set(10, 0.28, tz + s * 0.72); rail.castShadow = true; rail.receiveShadow = true;
    g.add(rail);
  }
  // 轨道接缝亮斑
  const jointMat = new THREE.MeshBasicMaterial({ color: 0xe8edf1 });
  for(let i = 0; i < 26; i++){
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.15), jointMat);
    j.position.set(-84 + i * 7.4, 0.28, (i % 2 ? TRACK_NEAR_Z : TRACK_FAR_Z) + (i % 3 - 1) * 0.72);
    g.add(j);
  }

  // ---- 道口铺面 ----
  const plateTex = rpt(cnv(64, 64, c => {
    c.fillStyle = '#43464c'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#e0b23c'; c.fillRect(0, 0, 64, 7); c.fillRect(0, 57, 64, 7);
  }), 1, 1);
  for(const tz of [TRACK_NEAR_Z, TRACK_FAR_Z]){
    const plate = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 2.1), new THREE.MeshToonMaterial({ color: 0xffffff, map: plateTex, gradientMap: ctx.grad }));
    plate.position.set(CROSS_X, 0.12, tz); plate.receiveShadow = true; g.add(plate);
  }

  // ---- 排水沟格栅（路边）+ 井盖 ----
  const grateMat = new THREE.MeshToonMaterial({ color: 0x55585e, gradientMap: ctx.grad });
  for(let i = 0; i < 7; i++){
    const z = 4 + i * 7.5;
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 1.1), grateMat);
    gr.position.set(fx(z) + 2.55, 0.062, z); g.add(gr);
  }
  const mhMat = new THREE.MeshToonMaterial({ color: 0x4c4f55, gradientMap: ctx.grad });
  for(const [mx, mz] of [[fx(18) - 0.8, 18], [fx(30) + 1.1, 30], [CROSS_X - 1, -14], [2.5, -6]]){
    const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 18), mhMat);
    mh.position.set(mx, 0.028, mz); g.add(mh);
  }

  ctx.roadFX = fx;
  return g;
}
