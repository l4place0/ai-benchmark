import * as THREE from 'three';
import { M, C, cnv, rpt, B, CYL, put, edges, hull } from './toon.js';
import { PLATFORM, TRACK_NEAR_Z } from './cfg.js';

// ---------- 车站主体：站房 / 站台 / 雨棚 / 站名标识 ----------

function textSign(w, h, draw, pw = 140){
  const tex = cnv(Math.round(w * pw), Math.round(h * pw), draw);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: null }));
}

export function buildStation(ctx){
  const g = new THREE.Group(); ctx.scene.add(g);

  // ---- 站台 ----
  const pfTex = rpt(cnv(128, 128, c => {
    c.fillStyle = '#b2b6ba'; c.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 160; i++){ c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(50,55,62,0.06)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    c.strokeStyle = 'rgba(70,75,82,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 84); c.lineTo(128, 84); c.stroke();
  }), 12, 1.2);
  const pf = B(PLATFORM.x1 - PLATFORM.x0, PLATFORM.h, PLATFORM.z1 - PLATFORM.z0, new THREE.MeshToonMaterial({ color: 0xffffff, map: pfTex, gradientMap: ctx.grad }));
  pf.position.set((PLATFORM.x0 + PLATFORM.x1) / 2, PLATFORM.h / 2, (PLATFORM.z0 + PLATFORM.z1) / 2);
  g.add(pf); edges(pf, { opacity: 0.3 });
  ctx.groundY = (x, z) => (x > PLATFORM.x0 && x < PLATFORM.x1 && z > PLATFORM.z0 - 0.4 && z < PLATFORM.z1 + 0.4) ? PLATFORM.h : 0;
  ctx.platformBenchY = PLATFORM.h + 0.455;

  // 黄色触觉警示砖 + 白色安全线
  const tacTex = rpt(cnv(64, 64, c => {
    c.fillStyle = '#e2bc4d'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#caa23a';
    for(let i = 0; i < 4; i++) for(let j = 0; j < 4; j++){ c.beginPath(); c.arc(8 + i * 16, 8 + j * 16, 4.5, 0, 7); c.fill(); }
  }), 30, 1);
  const tac = new THREE.Mesh(new THREE.PlaneGeometry(PLATFORM.x1 - PLATFORM.x0, 0.5), new THREE.MeshToonMaterial({ color: 0xffffff, map: tacTex, gradientMap: ctx.grad }));
  tac.rotation.x = -Math.PI / 2;
  tac.position.set((PLATFORM.x0 + PLATFORM.x1) / 2, PLATFORM.h + 0.012, PLATFORM.z0 + 0.35);
  g.add(tac);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(PLATFORM.x1 - PLATFORM.x0, 0.09), new THREE.MeshBasicMaterial({ color: 0xf2f4f0 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set((PLATFORM.x0 + PLATFORM.x1) / 2, PLATFORM.h + 0.012, PLATFORM.z0 + 0.78);
  g.add(line);
  // 车门候车标线
  for(const dx of [-7, 0, 7]){
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.08), new THREE.MeshBasicMaterial({ color: 0xe8ecec }));
    m1.rotation.x = -Math.PI / 2; m1.position.set(dx, PLATFORM.h + 0.011, PLATFORM.z0 + 1.1); g.add(m1);
  }

  // ---- 站房（位于站台与广场之间，正面朝广场）----
  const bx0 = -1, bx1 = 13.5, bd = 3.9, bh = 4.1;
  const bzA = PLATFORM.z1, bzB = PLATFORM.z1 + bd;   // 背面(站台侧) / 正面(广场侧)
  const cxm = (bx0 + bx1) / 2, bzm = (bzA + bzB) / 2, fz = bzB;   // fz = 正面墙 z
  const body = B(bx1 - bx0, bh, bd, M(0xefeadb));
  body.position.set(cxm, bh / 2, bzm);
  g.add(body); edges(body, { opacity: 0.26 });
  const base = B(bx1 - bx0 + 0.3, 0.35, bd + 0.3, M(0x9b968b));
  base.position.set(cxm, 0.17, bzm); g.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(bx1 - bx0 + 0.9, 0.16, bd + 1.2), M(C.metalRoof));
  roof.position.set(cxm, bh + 0.55, bzm); roof.rotation.x = -0.045; g.add(roof);
  const fas = B(bx1 - bx0 + 0.9, 0.42, bd + 1.1, M(0x4a5058));
  fas.position.set(cxm, bh + 0.18, bzm); g.add(fas);
  const ridgeCap = B(bx1 - bx0 + 0.9, 0.3, 0.14, M(0x43484f));
  ridgeCap.position.set(cxm, bh + 1.05, bzm); g.add(ridgeCap);
  // 站房入口（朝广场的门廊：侧墙 + 顶板 + 深色背景，闸机可见）
  const backP = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.7), M(0x272c33));
  backP.position.set(2.4, 1.45, fz + 0.05); g.add(backP);
  for(const s of [1, -1]){
    const post = B(0.16, 2.7, 0.6, M(0x4a5058));
    post.position.set(2.4 + s * 1.5, 1.45, fz + 0.3); g.add(post);
  }
  const lintel = B(3.16, 0.4, 0.6, M(0x4a5058));
  lintel.position.set(2.4, 2.9, fz + 0.3); g.add(lintel);
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.12), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  warm.position.set(2.4, 2.62, fz + 0.18); g.add(warm);
  for(let i = 0; i < 2; i++){
    const gate = B(0.5, 1.0, 0.3, M(0xd8dade));
    gate.position.set(1.9 + i * 1.15, 0.62, fz + 0.25); g.add(gate);
  }
  // 自动售票机（入口旁，淡蓝色）
  const tv = textSign(0.62, 0.5, (c, W, H) => {
    c.fillStyle = '#bcd8ea'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#3e6a8c'; c.font = `700 ${H * 0.2}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('きっぷ', W / 2, H * 0.3); c.fillText('うりば', W / 2, H * 0.55);
    c.fillStyle = '#7ba8c4'; c.fillRect(W * 0.12, H * 0.66, W * 0.76, H * 0.16);
  });
  const tm = B(0.9, 1.75, 0.6, M(0xaec6d4));
  tm.position.set(5.6, 0.88, fz - 0.12); g.add(tm); hull(tm, 1.05);
  tv.position.set(5.6, 1.35, fz + 0.19); g.add(tv);
  // 站名标（入口上方，日文 + 平假名 + 罗马字）
  const name = textSign(4.6, 1.05, (c, W, H) => {
    c.fillStyle = '#f8f7f2'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e05678'; c.fillRect(0, H * 0.86, W, H * 0.14);
    c.fillStyle = '#274a7a'; c.font = `800 ${H * 0.52}px "Yu Gothic","Meiryo",serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('桜町駅', W * 0.34, H * 0.42);
    c.font = `600 ${H * 0.17}px "Yu Gothic",sans-serif`;
    c.fillStyle = '#4a6a92';
    c.fillText('さくらまちえき', W * 0.72, H * 0.26);
    c.font = `500 ${H * 0.14}px "Arial",sans-serif`;
    c.fillText('SAKURAMACHI STATION', W * 0.72, H * 0.47);
    c.fillStyle = '#f2b8c8'; c.beginPath(); c.arc(W * 0.06, H * 0.38, H * 0.13, 0, 7); c.fill();
    // 两侧邻站
    c.fillStyle = '#37507a'; c.font = `600 ${H * 0.16}px "Yu Gothic",sans-serif`;
    c.fillText('かみさくら 上桜 ←', W * 0.22, H * 0.72);
    c.fillText('→ 春野 はるの', W * 0.78, H * 0.72);
  });
  name.position.set(2.4, 3.55, fz + 0.04); g.add(name);
  // 线路地图 / 时刻表 / 票价表 / 海报（外墙）
  const board = textSign(1.7, 1.15, (c, W, H) => {
    c.fillStyle = '#f4f3ee'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#37507a'; c.fillRect(0, 0, W, H * 0.14);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.09}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('さくら線 路線図', W / 2, H * 0.1);
    c.strokeStyle = '#e05678'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(W * 0.12, H * 0.55); c.lineTo(W * 0.88, H * 0.55); c.stroke();
    for(let i = 0; i < 5; i++){
      c.fillStyle = '#fff'; c.beginPath(); c.arc(W * (0.12 + i * 0.19), H * 0.55, 7, 0, 7); c.fill();
      c.strokeStyle = '#37507a'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#37507a'; c.font = `500 ${H * 0.07}px "Yu Gothic",sans-serif`;
      c.fillText(['上桜', '川端', '桜町', '緑岡', '春野'][i], W * (0.12 + i * 0.19), H * 0.42);
    }
  });
  board.position.set(7.6, 1.9, fz + 0.03); g.add(board);
  const fare = textSign(1.2, 0.9, (c, W, H) => {
    c.fillStyle = '#f4f3ee'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#8a94a2'; c.lineWidth = 2;
    for(let i = 1; i < 4; i++){ c.beginPath(); c.moveTo(0, H * i / 4); c.lineTo(W, H * i / 4); c.stroke(); c.beginPath(); c.moveTo(W * i / 4, 0); c.lineTo(W * i / 4, H); c.stroke(); }
    c.fillStyle = '#37507a'; c.font = `700 ${H * 0.1}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('運賃表', W / 2, H * 0.1);
  });
  fare.position.set(9.4, 1.85, fz + 0.03); g.add(fare);
  const poster1 = textSign(0.95, 1.3, (c, W, H) => {
    c.fillStyle = '#fde7ef'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f4b8c8'; for(let i = 0; i < 6; i++){ c.beginPath(); c.arc(W * (0.2 + (i % 3) * 0.3), H * (0.25 + ((i / 3) | 0) * 0.3), W * 0.13, 0, 7); c.fill(); }
    c.fillStyle = '#b04868'; c.font = `700 ${H * 0.11}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('さくらまち', W / 2, H * 0.78); c.fillText('春まつり 4/6', W / 2, H * 0.9);
  });
  poster1.position.set(11.2, 1.9, fz + 0.03); g.add(poster1);
  const poster2 = textSign(0.95, 1.3, (c, W, H) => {
    c.fillStyle = '#e8f0f6'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#37507a'; c.fillRect(0, 0, W, H * 0.16);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.09}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('線路内 立入禁止', W / 2, H * 0.1);
    c.fillStyle = '#d0433e'; c.beginPath(); c.moveTo(W / 2, H * 0.3); c.lineTo(W * 0.82, H * 0.72); c.lineTo(W * 0.18, H * 0.72); c.closePath(); c.fill();
    c.fillStyle = '#37507a'; c.font = `500 ${H * 0.08}px "Yu Gothic",sans-serif`;
    c.fillText('列車はすぐ近くを', W / 2, H * 0.86); c.fillText('走っています', W / 2, H * 0.95);
  });
  poster2.position.set(0.2, 1.9, fz + 0.03); g.add(poster2);
  // 站台侧外墙（面向轨道与站台）
  const nameB = name.clone(); nameB.rotation.y = Math.PI; nameB.position.set(9.8, 3.25, bzA - 0.05); g.add(nameB);
  const pw1 = poster1.clone(); pw1.rotation.y = Math.PI; pw1.position.set(1.2, 1.95, bzA - 0.05); g.add(pw1);
  const pw2 = poster2.clone(); pw2.rotation.y = Math.PI; pw2.position.set(2.6, 1.95, bzA - 0.05); g.add(pw2);
  const pw3 = board.clone(); pw3.rotation.y = Math.PI; pw3.position.set(4.4, 1.95, bzA - 0.05); g.add(pw3);
  // 壁挂时钟
  const clock = new THREE.Group();
  const face = CYL(0.34, 0.34, 0.06, M(0xf6f5f0), 24); face.rotation.x = Math.PI / 2; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), M(0x3e444c)); clock.add(rim);
  const hh = B(0.04, 0.18, 0.02, M(0x2c3138)); hh.position.y = 0.09; hh.rotation.z = -Math.PI / 3; hh.position.z = 0.05; clock.add(hh);
  const mh = B(0.025, 0.26, 0.02, M(0x2c3138)); mh.position.y = 0.13; mh.rotation.z = 0.35; mh.position.z = 0.05; clock.add(mh);
  clock.position.set(9.4, 3.1, fz + 0.07); g.add(clock);

  ctx.block(bx0 - 0.3, bzA - 0.3, bx1 + 0.3, bzB + 0.3);

  // ---- 站台雨棚 ----
  const colMat = M(0x6a7078);
  for(let i = 0; i < 5; i++){
    const cx = -4 + i * 5.6;
    const col = CYL(0.09, 0.11, 3.0, colMat, 10);
    col.position.set(cx, PLATFORM.h + 1.5, PLATFORM.z0 + 0.9); g.add(col);
    const beam = B(0.16, 0.14, 1.6, colMat); beam.position.set(cx, PLATFORM.h + 2.9, PLATFORM.z0 + 0.5); g.add(beam);
    // 荧光灯
    const ft = B(1.1, 0.05, 0.14, new THREE.MeshBasicMaterial({ color: 0xf4f8f4 }));
    ft.position.set(cx, PLATFORM.h + 2.72, PLATFORM.z0 + 0.5); g.add(ft);
  }
  const canMat = new THREE.MeshToonMaterial({ color: 0xd9dee2, transparent: true, opacity: 0.72, gradientMap: ctx.grad });
  const canopy = B(24.5, 0.09, 2.5, canMat);
  canopy.position.set(4, PLATFORM.h + 3.06, PLATFORM.z0 + 0.55); canopy.rotation.z = -0.02; g.add(canopy);
  const canopyBack = B(24.5, 0.5, 0.06, M(0xc3c9cd));
  canopyBack.position.set(4, PLATFORM.h + 2.85, PLATFORM.z0 - 0.65); g.add(canopyBack);
  // 悬挂站名牌与方向牌
  const pSign = textSign(2.2, 0.6, (c, W, H) => {
    c.fillStyle = '#f8f7f2'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e05678'; c.fillRect(0, H * 0.84, W, H * 0.16);
    c.fillStyle = '#274a7a'; c.font = `800 ${H * 0.5}px "Yu Gothic",serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('桜町', W * 0.5, H * 0.42);
    c.font = `500 ${H * 0.16}px sans-serif`; c.fillText('SAKURAMACHI', W * 0.5, H * 0.72);
  });
  pSign.rotation.y = Math.PI;
  pSign.position.set(-1.5, PLATFORM.h + 2.45, PLATFORM.z0 + 0.6); g.add(pSign);
  const dirSign = textSign(1.4, 0.4, (c, W, H) => {
    c.fillStyle = '#f8f7f2'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#274a7a'; c.font = `700 ${H * 0.34}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('← 上桜方面', W * 0.5, H * 0.35);
    c.fillStyle = '#e05678'; c.font = `700 ${H * 0.3}px "Yu Gothic",sans-serif`;
    c.fillText('1番のりば', W * 0.5, H * 0.75);
  });
  dirSign.rotation.y = Math.PI;
  dirSign.position.set(4.5, PLATFORM.h + 2.45, PLATFORM.z0 + 0.6); g.add(dirSign);
  // 时刻表立牌
  const tt = textSign(0.8, 1.1, (c, W, H) => {
    c.fillStyle = '#f6f5f0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#37507a'; c.fillRect(0, 0, W, H * 0.12);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.07}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('時刻表 平日', W / 2, H * 0.085);
    c.fillStyle = '#3a4048';
    for(let i = 0; i < 7; i++) c.fillText(`1${3 + i}:${[12, 27, 44][i % 3]}`, W * 0.5, H * (0.2 + i * 0.105));
  });
  tt.rotation.y = Math.PI;
  tt.position.set(7.2, PLATFORM.h + 1.3, PLATFORM.z0 + 1.4); g.add(tt);
  const ttLeg = B(0.06, 1.3, 0.06, M(0x5a6068)); ttLeg.position.set(7.2, PLATFORM.h + 0.65, PLATFORM.z0 + 1.4); g.add(ttLeg);

  // ---- 站台端部：警示围栏 ----
  for(let i = 0; i < 3; i++){
    const p = B(0.06, 1.0, 0.06, M(0xd8dade)); p.position.set(PLATFORM.x0 + 0.2, PLATFORM.h + 0.5, PLATFORM.z1 - 0.4 - i * 1.2); g.add(p);
  }
  const frail = B(0.05, 0.05, 2.6, M(0xd8dade)); frail.position.set(PLATFORM.x0 + 0.2, PLATFORM.h + 0.95, PLATFORM.z1 - 1.6); g.add(frail);

  return g;
}
