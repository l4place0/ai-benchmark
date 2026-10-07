import * as THREE from 'three';
import { M, C, cnv, rpt, B, CYL, edges, hull } from './toon.js';
import { TRACK_NEAR_Z, TRACK_FAR_Z, CROSS_X, PLATFORM } from './cfg.js';

// ---------- 街道道具：电线杆 / 贩卖机 / 长椅 / 道口 / 生活小物 ----------

function textSign(w, h, draw, pw = 120){
  const tex = cnv(Math.round(w * pw), Math.round(h * pw), draw);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: null, transparent: true }));
}

// ---------- 电线杆 ----------
function pole(ctx, x, z, { ry = 0, light = false, transformer = false, h = 7.6 } = {}){
  const g = new THREE.Group();
  const p = CYL(0.11, 0.15, h, M(0xb6b9ba), 10);
  p.position.y = h / 2; g.add(p); edges(p, { opacity: 0.18 });
  const cap = CYL(0.13, 0.13, 0.1, M(0x8f9294), 10); cap.position.y = h; g.add(cap);
  const band = CYL(0.155, 0.155, 0.5, M(C.signYellow), 10); band.position.y = 1.05; g.add(band);
  const num = B(0.16, 0.22, 0.03, M(0xf2f0ea)); num.position.set(0.02, 2.2, 0.14); g.add(num);
  const arm = B(1.5, 0.07, 0.07, M(0x777c82)); arm.position.y = h - 0.7; g.add(arm);
  for(const s of [1, -1]){
    const ins = CYL(0.035, 0.05, 0.14, M(0x9fb4c4), 8); ins.position.set(s * 0.6, h - 0.56, 0); g.add(ins);
  }
  const arm2 = B(1.1, 0.06, 0.06, M(0x777c82)); arm2.position.y = h - 1.5; g.add(arm2);
  if(transformer){
    const t1 = CYL(0.32, 0.32, 0.75, M(0x8d9298), 12); t1.position.set(0.42, h - 1.7, 0); g.add(t1);
    const t2 = CYL(0.26, 0.26, 0.55, M(0x8d9298), 12); t2.position.set(0.42, h - 2.35, 0); g.add(t2);
  }
  if(light){
    const armL = B(1.1, 0.06, 0.06, M(0x5f656c)); armL.position.set(-0.5, h - 2.6, 0); armL.rotation.z = 0.5; g.add(armL);
    const lmp = B(0.55, 0.12, 0.22, M(0xd8dcdf)); lmp.position.set(-1.05, h - 3.02, 0); g.add(lmp);
    const glow = B(0.45, 0.04, 0.16, new THREE.MeshBasicMaterial({ color: 0xfdf6da })); glow.position.set(-1.05, h - 3.09, 0); g.add(glow);
  }
  const refl = B(0.1, 0.3, 0.02, M(0xe8b83c)); refl.position.set(0.14, 1.4, 0); g.add(refl);
  g.position.set(x, 0, z); g.rotation.y = ry;
  ctx.scene.add(g);
  return g;
}

// ---------- 自动贩卖机 ----------
function vending(ctx, x, z, ry = 0, bodyCol = 0xd84438, glow = false, y = 0){
  const g = new THREE.Group();
  const front = cnv(256, 420, (c, W, H) => {
    c.fillStyle = '#52565e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#' + bodyCol.toString(16).padStart(6, '0'); c.fillRect(0, 0, W, 64);
    c.fillStyle = '#fff'; c.font = '800 26px "Yu Gothic",sans-serif'; c.textAlign = 'center';
    c.fillText('ドリンクステーション', W / 2, 40);
    c.fillStyle = '#3c4046'; c.fillRect(10, 72, 176, 250);
    const items = [
      ['#8a5a3a', 1], ['#5a8a4a', 0], ['#e8d24a', 1],
      ['#f2a0b8', 0], ['#9ec8e0', 0], ['#e88a3a', 1],
      ['#f4b8c8', 0], ['#c86a5a', 1], ['#d8d8d8', 0],
      ['#e07a8a', 1], ['#7aa85a', 0], ['#e2b06a', 1],
    ];
    const prices = ['120', '140', '130', '150', '130', '120', '160', '130', '110', '120', '140', '130'];
    for(let i = 0; i < 12; i++){
      const px = 22 + (i % 3) * 54, py = 84 + ((i / 3) | 0) * 62;
      c.fillStyle = items[i][0];
      if(items[i][1]){ c.fillRect(px, py, 30, 40); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(px + 4, py + 6, 22, 8); }
      else { c.fillRect(px + 7, py - 4, 16, 46); c.fillRect(px + 11, py - 12, 8, 10); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(px + 9, py + 6, 4, 28); }
      c.fillStyle = '#f0f0ec'; c.fillRect(px, py + 44, 34, 14);
      c.fillStyle = '#33373d'; c.font = '700 11px Arial'; c.fillText('¥' + prices[i], px + 17, py + 55);
    }
    c.fillStyle = '#464a52'; c.fillRect(194, 72, 52, 250);
    c.fillStyle = '#2e3238'; c.fillRect(202, 84, 36, 30);
    c.fillStyle = '#c8ccd2'; c.fillRect(206, 90, 28, 5);
    c.fillStyle = '#2e3238'; c.fillRect(202, 124, 36, 10);
    c.fillStyle = '#8ec8a8'; c.fillRect(202, 144, 36, 16);
    c.fillStyle = '#e8eaee'; c.font = '600 12px "Yu Gothic",sans-serif'; c.textAlign = 'center';
    c.fillText('つめた〜い', 220, 178); c.fillText('あたたか〜い', 220, 194);
    c.fillStyle = '#2e3238'; c.fillRect(194, 330, 52, 66);
    c.fillStyle = '#181c20'; c.fillRect(200, 340, 40, 44);
    c.fillStyle = '#8a2e28'; c.fillRect(10, 360, 176, 30);
    c.fillStyle = '#f2e8d8'; c.font = '700 17px "Yu Gothic",sans-serif';
    c.fillText('さくらサイダー', 98, 381);
  });
  const bodyM = B(1.12, 1.85, 0.72, new THREE.MeshToonMaterial({
    color: 0xf0f1ee, gradientMap: ctx.grad,
    emissive: glow ? 0x8fb8cc : 0x000000, emissiveIntensity: glow ? 0.16 : 0,
  }));
  bodyM.position.y = 0.93; g.add(bodyM);
  const faceM = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.78), new THREE.MeshToonMaterial({
    map: front, gradientMap: ctx.grad,
    emissive: glow ? 0x7aa8bc : 0x000000, emissiveIntensity: glow ? 0.28 : 0,
  }));
  faceM.position.set(0, 0.93, 0.365); g.add(faceM);
  hull(bodyM, 1.045);
  g.position.set(x, y, z); g.rotation.y = ry;
  ctx.scene.add(g);
  ctx.block(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
  return g;
}

// ---------- 长椅 / 垃圾桶 / 邮筒 / 电话亭 ----------
function bench(ctx, x, z, ry = 0, len = 1.8, woodC = 0x9a744f, y = 0){
  const g = new THREE.Group();
  const seat = B(len, 0.07, 0.42, M(woodC)); seat.position.y = 0.42; g.add(seat);
  const back = B(len, 0.4, 0.06, M(woodC)); back.position.set(0, 0.72, -0.18); back.rotation.x = -0.12; g.add(back);
  for(const s of [1, -1]){
    const leg = B(0.06, 0.42, 0.4, M(0x4a5058)); leg.position.set(s * (len / 2 - 0.15), 0.21, 0); g.add(leg);
  }
  g.position.set(x, y, z); g.rotation.y = ry; g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  ctx.scene.add(g);
  return g;
}
function bin(ctx, x, z, col = 0x5a7a6a, y = 0){
  const g = new THREE.Group();
  const body = CYL(0.26, 0.22, 0.72, M(col), 12); body.position.y = 0.36; g.add(body);
  const rim = CYL(0.28, 0.28, 0.06, M(0x3e444a), 12); rim.position.y = 0.74; g.add(rim);
  const band = CYL(0.265, 0.265, 0.1, M(0xf0efe8), 12); band.position.y = 0.55; g.add(band);
  g.position.set(x, y, z); g.traverse(o => { if(o.isMesh) o.castShadow = true; }); ctx.scene.add(g);
  return g;
}
function mailbox(ctx, x, z, ry = 0){
  const g = new THREE.Group();
  const body = CYL(0.3, 0.34, 0.85, M(0xc8403a), 14); body.position.y = 0.75; g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc8403a));
  cap.position.y = 1.18; g.add(cap);
  const slot = B(0.26, 0.05, 0.02, M(0x3a3230)); slot.position.set(0, 1.0, 0.33); g.add(slot);
  const leg = CYL(0.06, 0.08, 0.35, M(0x4a5058), 8); leg.position.y = 0.17; g.add(leg);
  g.position.set(x, 0, z); g.rotation.y = ry; g.traverse(o => { if(o.isMesh) o.castShadow = true; }); ctx.scene.add(g);
  ctx.block(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  return g;
}
function phoneBooth(ctx, x, z, ry = 0){
  const g = new THREE.Group();
  const back = B(1.0, 2.3, 0.08, M(0x6e7a72)); back.position.set(0, 1.15, -0.46); g.add(back);
  const top = B(1.15, 0.16, 1.05, M(0x5d6a62)); top.position.y = 2.38; g.add(top);
  for(const s of [1, -1]){
    const side = B(0.06, 2.3, 0.9, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.45, gradientMap: ctx.grad }));
    side.position.set(s * 0.48, 1.15, 0); g.add(side);
  }
  const sign = textSign(0.85, 0.22, (c, W, H) => {
    c.fillStyle = '#2f6bb0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.55}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('公衆電話', W / 2, H * 0.55);
  });
  sign.position.set(0, 2.58, 0); g.add(sign);
  const phone = B(0.3, 0.45, 0.12, M(0x3e444a)); phone.position.set(0, 1.35, -0.36); g.add(phone);
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  ctx.block(x - 0.7, z - 0.7, x + 0.7, z + 0.7);
  return g;
}

// ---------- 自行车 ----------
function bicycle(ctx, x, z, ry = 0, col = 0x5a7a9a, basket = true){
  const g = new THREE.Group();
  const wheelG = new THREE.TorusGeometry(0.32, 0.032, 8, 20);
  for(const s of [1, -1]){
    const w = new THREE.Mesh(wheelG, M(0x2c3036)); w.position.set(0, 0.32, s * 0.52); w.rotation.y = Math.PI / 2;
    w.castShadow = true; g.add(w);
  }
  const bar = (a, b, r = 0.022) => {
    const v = new THREE.Vector3().subVectors(b, a);
    const m = CYL(r, r, v.length(), M(col), 6);
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    g.add(m);
  };
  const V = (a, b, c) => new THREE.Vector3(a, b, c);
  bar(V(0, 0.32, 0.5), V(0, 0.62, 0.12));
  bar(V(0, 0.62, 0.12), V(0, 0.88, -0.28));
  bar(V(0, 0.32, -0.5), V(0, 0.62, 0.12));
  bar(V(0, 0.32, -0.5), V(0, 0.78, -0.34));
  bar(V(0, 0.62, 0.12), V(0, 0.78, -0.34));
  bar(V(0, 0.9, -0.3), V(0, 0.98, -0.3), 0.018);
  bar(V(-0.2, 0.98, -0.3), V(0.2, 0.98, -0.3), 0.018);
  const seat = B(0.2, 0.05, 0.09, M(0x2c3036)); seat.position.set(0, 0.82, -0.32); g.add(seat);
  if(basket){
    const bk = B(0.3, 0.2, 0.24, new THREE.MeshToonMaterial({ color: 0xb8bcc2, transparent: true, opacity: 0.85, gradientMap: ctx.grad }));
    bk.position.set(0, 0.95, -0.55); g.add(bk);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  g.traverse(o => { if(o.isMesh) o.castShadow = true; });
  ctx.scene.add(g);
  return g;
}

// ---------- 轻自动车（白色 K-car）----------
function keiVan(ctx, x, z, ry, col = 0xf0f0ea){
  const g = new THREE.Group();
  const body = B(1.5, 1.15, 3.1, M(col)); body.position.y = 0.95; g.add(body); hull(body, 1.03, 0x3a4048);
  const cab = B(1.46, 0.75, 1.0, M(col)); cab.position.set(0, 1.5, -0.85); g.add(cab);
  const windshield = B(1.38, 0.6, 0.06, M(C.glassDark)); windshield.position.set(0, 1.5, -1.36); g.add(windshield);
  for(const s of [1, -1]){
    const sw = B(0.05, 0.5, 0.9, M(C.glassDark)); sw.position.set(s * 0.74, 1.55, -0.85); g.add(sw);
  }
  const bf = B(1.52, 0.18, 0.12, M(0x8a9096)); bf.position.set(0, 0.5, -1.58); g.add(bf);
  const bb = bf.clone(); bb.position.z = 1.58; g.add(bb);
  for(const zz of [-1.05, 1.05]) for(const s of [1, -1]){
    const wheel = CYL(0.28, 0.28, 0.16, M(0x33383e), 14);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 0.72, 0.3, zz); g.add(wheel);
    const hub = CYL(0.13, 0.13, 0.18, M(0x9aa0a6), 10);
    hub.rotation.z = Math.PI / 2; hub.position.set(s * 0.72, 0.3, zz); g.add(hub);
  }
  for(const s of [1, -1]){
    const light = B(0.3, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
    light.position.set(s * 0.5, 0.75, -1.57); g.add(light);
  }
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  ctx.block(x - 1.0, z - 1.8, x + 1.0, z + 1.8);
  return g;
}

// ---------- 铁路道口（遮断机可动，与电车联动）----------
function crossingGate(ctx, x, z, armDir = 1){
  const g = new THREE.Group();
  const poleC = CYL(0.09, 0.11, 3.9, M(0xd8d8d4), 10); poleC.position.y = 1.95; g.add(poleC);
  const stripeTex = rpt(cnv(32, 8, c => {
    c.fillStyle = '#e8e6e0'; c.fillRect(0, 0, 32, 8); c.fillStyle = '#d0433e'; c.fillRect(0, 0, 16, 8);
  }), 14, 1);
  const lampBox = B(0.5, 0.34, 0.2, M(0x3a3f45)); lampBox.position.set(0, 3.6, 0.16); g.add(lampBox);
  const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a1e1e }));
  lamp1.position.set(-0.13, 3.6, 0.27); g.add(lamp1);
  const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a1e1e }));
  lamp2.position.set(0.13, 3.6, 0.27); g.add(lamp2);
  const xb1 = B(0.85, 0.13, 0.05, M(0xf2f0ea)); xb1.position.set(0, 4.35, 0.05); xb1.rotation.z = 0.6; g.add(xb1);
  const xb2 = xb1.clone(); xb2.rotation.z = -0.6; g.add(xb2);
  const pivot = new THREE.Group(); pivot.position.set(0, 3.05, 0.12); g.add(pivot);
  const arm = B(armDir * 6.2, 0.16, 0.1, new THREE.MeshToonMaterial({ color: 0xffffff, map: stripeTex, gradientMap: ctx.grad }));
  arm.position.x = armDir * 3.1; pivot.add(arm);
  const tip = B(0.24, 0.24, 0.14, M(0xf2f0ea)); tip.position.x = armDir * 6.2; pivot.add(tip);
  g.position.set(x, 0, z); ctx.scene.add(g);
  ctx.gates.push({ pivot, lamp1, lamp2, dir: armDir });
  return g;
}

// ---------- 花坛 ----------
function flowerBed(ctx, x, z, w, d){
  const g = new THREE.Group();
  const soil = B(w, 0.32, d, M(0x503e30)); soil.position.set(x, 0.16, z); g.add(soil);
  for(const [ex, ez, ew, ed] of [[0, -d / 2, w + 0.24, 0.22], [0, d / 2, w + 0.24, 0.22], [-w / 2, 0, 0.22, d], [w / 2, 0, 0.22, d]]){
    const edge = B(ew, 0.4, ed, M(0xb5a998)); edge.position.set(x + ex, 0.2, z + ez); g.add(edge);
  }
  const cols = [0xe86a7a, 0xf2c04a, 0xf5f0e6, 0xdd7ba0, 0xe88a4a];
  const n = Math.floor(w * d * 26);
  for(let i = 0; i < n; i++){
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.048, 0), M(cols[(Math.random() * cols.length) | 0]));
    f.position.set(x + (Math.random() - 0.5) * (w - 0.35), 0.36 + Math.random() * 0.07, z + (Math.random() - 0.5) * (d - 0.35));
    f.castShadow = true; g.add(f);
  }
  ctx.scene.add(g);
  ctx.block(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
}

// ---------- 装配 ----------
export function buildProps(ctx){
  const fx = ctx.roadFX;

  // ----- 主街电线杆（两侧交错）+ 电线 -----
  const eastZ = [0, 11, 22, 33, 44], westZ = [5, 16, 27, 38, 49];
  const eP = eastZ.map(z => pole(ctx, fx(z) + 4.6, z, { transformer: z === 22, light: z === 0 || z === 33 }));
  const wP = westZ.map(z => pole(ctx, fx(z) - 4.6, z, { light: z === 16 || z === 49 }));
  const wireAlong = (poles, heights) => {
    for(let i = 0; i < poles.length - 1; i++){
      const a = poles[i].position, b = poles[i + 1].position;
      for(const hy of heights) ctx.wires.push({ a: new THREE.Vector3(a.x, hy, a.z), b: new THREE.Vector3(b.x, hy, b.z), sag: 0.55 });
    }
  };
  wireAlong(eP, [6.9, 6.1, 5.3]);
  wireAlong(wP, [6.9, 6.1, 5.3]);
  for(let i = 0; i < 4; i++){
    const a = eP[i].position, b = wP[i].position;
    ctx.wires.push({ a: new THREE.Vector3(a.x, 5.3, a.z), b: new THREE.Vector3(b.x, 5.3, b.z), sag: 0.8 });
  }
  const drops = [
    [eP[0].position, 5.4, 10.0, 2.6], [eP[1].position, 5.0, 22.5, 2.8], [eP[2].position, 4.4, 33.5, 2.5], [eP[3].position, 4.4, 43.5, 2.6],
    [wP[0].position, -6.2, 8.5, 3.0], [wP[1].position, -6.6, 20.5, 3.0], [wP[2].position, -5.8, 33.0, 3.0],
  ];
  for(const [p, bx, bz, bh] of drops){
    ctx.wires.push({ a: new THREE.Vector3(p.x, 5.3, p.z), b: new THREE.Vector3(bx, bh, bz), sag: 0.3 });
    ctx.wires.push({ a: new THREE.Vector3(p.x, 6.1, p.z), b: new THREE.Vector3(bx, bh + 0.3, bz), sag: 0.3 });
  }

  // ----- 轨道旁电力杆 + 接触网 -----
  for(const tx of [-28, -12, 4, 20, 36]){
    const p = pole(ctx, tx, TRACK_FAR_Z - 2.4, { h: 8.6 });
    const arm = B(0.07, 0.07, 5.8, M(0x5f656c)); arm.position.set(0, 7.0, 2.9); p.add(arm);
    ctx.wires.push({ a: new THREE.Vector3(tx - 16, 5.0, TRACK_NEAR_Z), b: new THREE.Vector3(tx + 16, 5.0, TRACK_NEAR_Z), sag: 0.22 });
    ctx.wires.push({ a: new THREE.Vector3(tx - 16, 5.6, TRACK_NEAR_Z + 0.35), b: new THREE.Vector3(tx + 16, 5.6, TRACK_NEAR_Z + 0.35), sag: 0.22 });
    ctx.wires.push({ a: new THREE.Vector3(tx, 7.0, TRACK_NEAR_Z), b: new THREE.Vector3(tx, 5.05, TRACK_NEAR_Z + 0.35), sag: 0.02 });
  }

  // ----- 自动贩卖机（5 台：站房两侧 / 站台 / 便利店旁 / 街角）-----
  vending(ctx, -2.6, -12.6, 0, 0xc84a42);                       // 站房西墙（向阳）
  vending(ctx, 14.6, -12.7, 0, 0x4a7ab8);                       // 站房东角
  vending(ctx, 21.2, -18.4, -Math.PI / 2, 0x4a9a72, true, PLATFORM.h); // 站台（背阴自发光）
  vending(ctx, 6.3, 17.2, -Math.PI / 2, 0xd84438);              // 便利店旁
  vending(ctx, -4.8, 42.6, Math.PI / 2, 0x3e7a8c, true);        // 安静街角（背阴自发光）

  // ----- 站前广场 -----
  phoneBooth(ctx, 11.8, -4.2, -0.4);
  mailbox(ctx, 9.8, -5.4, 0.3);
  bench(ctx, -3.5, -3.4, Math.PI, 2.0, 0x7a8a6a);
  bin(ctx, -4.8, -3.2);
  flowerBed(ctx, 6.2, -6.4, 2.6, 1.5);
  flowerBed(ctx, -8.6, -6.2, 2.2, 1.5);
  // 站前地图牌
  const map = textSign(1.3, 1.7, (c, W, H) => {
    c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#5a6572'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.fillStyle = '#37507a'; c.fillRect(0, 0, W, H * 0.12);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.07}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('桜町駅周辺マップ', W / 2, H * 0.085);
    c.strokeStyle = '#b8b2a4'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(W * 0.2, H * 0.3); c.lineTo(W * 0.8, H * 0.3); c.stroke();
    c.beginPath(); c.moveTo(W * 0.5, H * 0.2); c.lineTo(W * 0.5, H * 0.75); c.stroke();
    c.fillStyle = '#e05678'; c.beginPath(); c.arc(W * 0.5, H * 0.32, 10, 0, 7); c.fill();
    c.fillStyle = '#8a949e'; for(const [hx, hz] of [[0.3, 0.45], [0.66, 0.5], [0.28, 0.62], [0.7, 0.68]]) c.fillRect(W * hx - 14, H * hz - 10, 28, 20);
    c.fillStyle = '#7aa86a'; c.beginPath(); c.arc(W * 0.22, H * 0.72, 14, 0, 7); c.fill();
  });
  map.position.set(2.0, 1.55, -4.6); ctx.scene.add(map);
  const mapLeg = B(0.08, 1.5, 0.08, M(0x5a6068)); mapLeg.position.set(2.0, 0.75, -4.6); ctx.scene.add(mapLeg);
  // 巴士站牌
  const bus = textSign(0.5, 1.1, (c, W, H) => {
    c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2f8a5a'; c.fillRect(0, 0, W, H * 0.3);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.13}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('バス', W / 2, H * 0.16);
    c.fillStyle = '#3a4048'; c.font = `600 ${H * 0.1}px "Yu Gothic",sans-serif`;
    c.fillText('桜町駅前', W / 2, H * 0.45);
    c.fillText('↓ 春野行', W / 2, H * 0.6);
  });
  bus.position.set(3.4, 1.9, 0.5); ctx.scene.add(bus);
  const busPole = CYL(0.035, 0.035, 2.4, M(0x777c82), 8); busPole.position.set(3.4, 1.2, 0.5); ctx.scene.add(busPole);
  bench(ctx, 4.6, 1.2, Math.PI / 2, 1.4);
  // 出租车候车牌
  const taxi = textSign(0.6, 0.6, (c, W, H) => {
    c.fillStyle = '#f2c04a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2c3036'; c.font = `800 ${H * 0.4}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('タクシー', W / 2, H * 0.5);
  });
  taxi.position.set(-6.4, 2.0, -4.8); ctx.scene.add(taxi);
  const taxiPole = CYL(0.035, 0.035, 2.2, M(0x777c82), 8); taxiPole.position.set(-6.4, 1.1, -4.8); ctx.scene.add(taxiPole);
  // 社区公告栏
  const notice = textSign(1.6, 1.1, (c, W, H) => {
    c.fillStyle = '#8a6a4e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f4f2ea'; c.fillRect(8, 8, W / 2 - 12, H - 16);
    c.fillStyle = '#fde7ef'; c.fillRect(W / 2 + 4, 8, W / 2 - 12, H - 16);
    c.fillStyle = '#b04868'; c.font = `700 ${H * 0.1}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('桜まつり', W * 0.75, H * 0.4);
    c.fillStyle = '#5a6572'; c.font = `600 ${H * 0.09}px "Yu Gothic",sans-serif`;
    c.fillText('回覧板', W * 0.25, H * 0.4);
  });
  notice.position.set(-10.2, 1.45, -5.6); ctx.scene.add(notice);
  const nPole = B(0.1, 1.4, 0.1, M(0x6b5238)); nPole.position.set(-10.2, 0.7, -5.6); ctx.scene.add(nPole);

  // 自行车停放区
  for(let i = 0; i < 3; i++){
    const rack = B(0.06, 0.3, 1.8, M(0x8a9096)); rack.position.set(11.6 + i * 0.9, 0.15, -9.6); ctx.scene.add(rack);
  }
  bicycle(ctx, 11.4, -9.3, 0.06, 0x5a7a9a);
  bicycle(ctx, 12.3, -9.5, -0.08, 0xc05a5a);
  bicycle(ctx, 13.1, -9.2, 0.1, 0x6a8a5a, false);
  // 主街生活物件（靠墙自行车 / 停车）
  bicycle(ctx, fx(18) + 4.2, 18.4, Math.PI / 2 + 0.15, 0x4a6a8a);
  bicycle(ctx, fx(29) - 4.2, 29.2, Math.PI / 2 - 0.1, 0x8a5a7a);
  bicycle(ctx, fx(44) + 4.2, 44.3, Math.PI / 2, 0x5a8a6a, false);
  keiVan(ctx, fx(37) + 4.3, 37.0, 0);
  bin(ctx, 15.0, 13.6, 0x5a6a7a);
  bin(ctx, 13.2, 10.4, 0x7a5a4a);
  // 道口等待学生的自行车
  bicycle(ctx, 20.4, -15.4, Math.PI / 2 + 0.1, 0x7a5a8a);
  // 站台家具
  bench(ctx, 2.8, -17.8, Math.PI, 2.0, 0x4a6a5a, PLATFORM.h);
  bench(ctx, 9.2, -17.8, Math.PI, 2.0, 0x4a6a5a, PLATFORM.h);
  bin(ctx, 7.0, -17.3, 0x5a6a7a, PLATFORM.h);

  // ----- 铁路道口 -----
  crossingGate(ctx, CROSS_X + 2.6, -18.6, -1);
  crossingGate(ctx, CROSS_X - 2.6, -28.2, 1);
  for(const zz of [-16.8, -30.2]){
    const wait = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.14), new THREE.MeshBasicMaterial({ color: 0xf2f4f0 }));
    wait.rotation.x = -Math.PI / 2; wait.position.set(CROSS_X, 0.031, zz); ctx.scene.add(wait);
  }
  const ctrl = B(0.6, 1.0, 0.4, M(0x9aa0a6)); ctrl.position.set(CROSS_X + 3.4, 0.5, -18.2); ctx.scene.add(ctrl);

  // ----- 轨旁信号机（与电车联动）-----
  const sig = (sx, sz) => {
    const sg = new THREE.Group();
    const sp = CYL(0.06, 0.08, 2.6, M(0x3e444a), 8); sp.position.y = 1.3; sg.add(sp);
    const head = B(0.3, 0.7, 0.22, M(0x2c3036)); head.position.y = 2.75; sg.add(head);
    const gr = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: 0x58c078 }));
    gr.position.set(0, 2.92, 0.12); sg.add(gr);
    const rd = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: 0x3a1e1e }));
    rd.position.set(0, 2.6, 0.12); sg.add(rd);
    sg.position.set(sx, 0, sz); sg.rotation.y = Math.PI; ctx.scene.add(sg);
    ctx.signals.push({ green: gr, red: rd });
  };
  sig(-8.8, TRACK_FAR_Z - 1.8);
  sig(25.2, TRACK_FAR_Z - 1.8);

  // ----- 街角小物 -----
  // 凸面镜
  const mir = new THREE.Group();
  const mirPole = CYL(0.05, 0.06, 2.4, M(0x9aa0a6), 8); mirPole.position.y = 1.2; mir.add(mirPole);
  const mirB = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
    new THREE.MeshToonMaterial({ color: 0xcfe0ea, gradientMap: ctx.grad }));
  mirB.rotation.x = Math.PI * 0.72; mirB.position.y = 2.5; mir.add(mirB);
  mir.position.set(23.4, 0, -5.2); ctx.scene.add(mir);
  // 扭蛋机
  const gacha = new THREE.Group();
  const gb = B(0.5, 0.9, 0.45, M(0xd84a5a)); gb.position.y = 0.65; gacha.add(gb);
  const gd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), new THREE.MeshToonMaterial({ color: 0xf2d8de, transparent: true, opacity: 0.7, gradientMap: ctx.grad }));
  gd.position.y = 1.28; gacha.add(gd);
  gacha.position.set(-7.6, 0, -10.6); gacha.traverse(o => { if(o.isMesh) o.castShadow = true; }); ctx.scene.add(gacha);
  // 地藏与小型神龛
  const jizo = new THREE.Group();
  const jb = CYL(0.14, 0.17, 0.55, M(0x9a9a94), 10); jb.position.y = 0.28; jizo.add(jb);
  const jh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M(0xa8a8a0)); jh.position.y = 0.62; jizo.add(jh);
  const bib = CYL(0.16, 0.16, 0.14, M(0xc84a4a), 10); bib.position.y = 0.46; jizo.add(bib);
  jizo.position.set(-7.0, 0, 47.5); ctx.scene.add(jizo);
  const shrine = new THREE.Group();
  const sb = B(0.8, 0.9, 0.7, M(0x8a6a4e)); sb.position.y = 0.75; shrine.add(sb);
  const sr = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.45, 4), M(0x4c5a52)); sr.position.y = 1.42; sr.rotation.y = Math.PI / 4; shrine.add(sr);
  shrine.position.set(-8.4, 0, 48.2); shrine.traverse(o => { if(o.isMesh) o.castShadow = true; }); ctx.scene.add(shrine);
  // 猫（墙头白猫 + 围栏黑猫）与电线上的麻雀
  const cat = (cx2, cy2, cz2, col) => {
    const cg = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M(col)); cb.scale.set(1, 0.85, 1.35); cg.add(cb);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M(col)); ch.position.set(0, 0.14, -0.16); cg.add(ch);
    for(const s of [1, -1]){
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 4), M(col));
      ear.position.set(s * 0.055, 0.24, -0.16); cg.add(ear);
    }
    const tail = CYL(0.025, 0.035, 0.3, M(col), 6); tail.position.set(0, 0.1, 0.24); tail.rotation.x = 0.8; cg.add(tail);
    cg.position.set(cx2, cy2, cz2); cg.traverse(o => { if(o.isMesh) o.castShadow = true; }); ctx.scene.add(cg);
  };
  cat(-9.2, 1.18, 12.6, 0xf5f2ec);
  cat(11.5, 1.08, -27.6, 0x2c2c30);
  for(const [sx, sz] of [[fx(20) + 4.6, 20], [fx(20) + 4.6, 20.4], [fx(31) - 4.6, 31]]){
    const sp = new THREE.Group();
    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M(0x6a5a4c)); sb2.scale.set(1, 0.9, 1.4); sp.add(sb2);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0x5a4c40)); sh.position.set(0, 0.05, -0.06); sp.add(sh);
    const st = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), M(0x4c4038)); st.position.set(0, 0.02, 0.1); st.rotation.x = 1.4; sp.add(st);
    sp.position.set(sx, 5.5, sz); ctx.scene.add(sp);
  }
  // 门口盆栽
  for(const [px, pz, pc] of [[-6.0, 11.2, 0xb87f6a], [-6.8, 23.4, 0x8a9aa5], [3.4, 30.8, 0xc9b27a]]){
    const pot = CYL(0.18, 0.14, 0.28, M(pc), 10); pot.position.set(px, 0.14, pz); ctx.scene.add(pot);
    const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), M(0x6d9c58)); pl.position.set(px, 0.44, pz); pl.castShadow = true; ctx.scene.add(pl);
  }
  // 交通锥与灭火器箱
  for(const [cx2, cz2] of [[CROSS_X - 3.6, -20.2], [14.2, -12.4]]){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10), M(0xe06a3a));
    cone.position.set(cx2, 0.21, cz2); cone.castShadow = true; ctx.scene.add(cone);
    const cbase = B(0.3, 0.04, 0.3, M(0xd05a30)); cbase.position.set(cx2, 0.02, cz2); ctx.scene.add(cbase);
  }
  const fe = B(0.4, 0.6, 0.16, M(0xc0392b)); fe.position.set(12.9, 0.9, -12.02); ctx.scene.add(fe);
}

// ---------- 电线汇总（悬链线近似）----------
export function finishWires(ctx){
  const pts = [];
  for(const w of ctx.wires){
    const prev = w.a.clone();
    for(let i = 1; i <= 10; i++){
      const t2 = i / 10;
      const p = new THREE.Vector3().lerpVectors(w.a, w.b, t2);
      p.y -= w.sag * (1 - Math.pow(2 * t2 - 1, 2));
      pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      prev.copy(p);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x23272e, transparent: true, opacity: 0.85 }));
  lines.frustumCulled = false;
  ctx.scene.add(lines);
}
