import * as THREE from 'three';
import { M, C, cnv, rpt, B, CYL, put, edges } from './toon.js';

// ---------- 街道两侧建筑：住宅 / 商店街 ----------

// 双坡屋顶（脊沿 x 轴，含挑檐）
function gableGeo(w, d, rh, ov = 0.4){
  const hw = w / 2 + ov, hd = d / 2 + ov, hw2 = w / 2;
  const A = [-hw, 0, hd], Bv = [hw, 0, hd], Cc = [hw, 0, -hd], D = [-hw, 0, -hd];
  const R1 = [-hw2, rh, 0], R2 = [hw2, rh, 0];
  const tri = (p, q, r) => [...p, ...q, ...r];
  const pos = [
    tri(A, Bv, R2), tri(A, R2, R1),        // 南坡
    tri(Cc, D, R1), tri(Cc, R1, R2),       // 北坡
    tri(Bv, Cc, R2),                       // 东端
    tri(D, A, R1),                         // 西端
  ].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// 窗户：深框 + 蓝灰玻璃 + 可选窗帘
function win(w, h, { frame = C.frame, curtain = false, frost = false } = {}){
  const g = new THREE.Group();
  const f = B(w + 0.1, h + 0.1, 0.08, M(frame)); g.add(f);
  const gl = B(w, h, 0.1, M(frost ? 0xd9e2e4 : C.glass)); gl.position.z = 0.01; g.add(gl);
  if(curtain){
    const c = B(w * 0.5, h * 0.9, 0.02, M(0xf1ede2)); c.position.set(w * 0.18, 0, -0.045); g.add(c);
  }
  return g;
}

function acUnit(x, y, z, parent, ry = 0){
  const a = B(0.72, 0.5, 0.28, M(0xd8d9d6));
  const grill = B(0.66, 0.4, 0.02, M(0xa9aaa6)); grill.position.z = 0.15; a.add(grill);
  a.position.set(x, y, z); a.rotation.y = ry; parent.add(a); return a;
}

function textSign(w, h, draw, opts = {}){
  const tex = cnv(Math.round(w * 110), Math.round(h * 110), draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: null, ...opts }));
  return m;
}

// 碰撞盒（朝向旋转时交换长宽）
function blockFor(ctx, x, z, w, d, ry){
  const sw = Math.abs(Math.sin(ry || 0)) > 0.5;
  const ew = (sw ? d : w) / 2 + 0.3, ed = (sw ? w : d) / 2 + 0.3;
  ctx.block(x - ew, z - ed, x + ew, z + ed);
}

// ---------- 独栋住宅 ----------
function house(ctx, { x, z, w = 6.4, d = 5.6, wall = C.wallBeige, roof = C.roofGray, ry = 0, two = true, fence = 'wall' }){
  const g = new THREE.Group();
  const h1 = 2.75, h2 = two ? 2.45 : 0;
  const body = B(w, h1 + h2, d, M(wall));
  body.position.y = (h1 + h2) / 2; g.add(body); edges(body, { opacity: 0.22 });
  // 深色基座
  const base = B(w + 0.12, 0.35, d + 0.12, M(0x8f8a80)); base.position.y = 0.17; g.add(base);
  // 屋顶
  const roofM = new THREE.MeshToonMaterial({ color: roof, gradientMap: ctx.grad, side: THREE.DoubleSide });
  const roofMesh = new THREE.Mesh(gableGeo(w, d, 1.5), roofM);
  roofMesh.position.y = h1 + h2; roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  g.add(roofMesh);
  // 脊与檐口
  const ridge = B(w + 0.7, 0.1, 0.22, M(0x3a4048)); ridge.position.y = h1 + h2 + 1.5; g.add(ridge);
  const fas = B(w + 0.75, 0.14, d + 0.75, M(0x464c55)); fas.position.y = h1 + h2 + 0.03; g.add(fas);
  // 雨水管
  const pipe = CYL(0.045, 0.045, h1 + h2, M(0xb9bcc0), 8);
  pipe.position.set(w / 2 + 0.28, (h1 + h2) / 2, -d / 2 + 0.3); g.add(pipe);
  // 一层窗、玄关、二层窗与晾晒
  const w1 = win(1.15, 1.0, { curtain: true }); w1.position.set(-w / 4, 1.55, d / 2 + 0.05); g.add(w1);
  const w2 = win(0.95, 0.85, { frost: true }); w2.position.set(w / 4 - 0.2, 1.55, d / 2 + 0.05); g.add(w2);
  // 玄关雨棚与门
  const door = B(0.95, 1.9, 0.08, M(0x6f5a46)); door.position.set(w / 2 - 1.1, 1.28, d / 2 + 0.06); g.add(door);
  const porch = B(1.5, 0.09, 0.9, M(roof)); porch.position.set(w / 2 - 1.1, 2.35, d / 2 + 0.42); porch.rotation.x = 0.12; g.add(porch);
  const lamp = B(0.12, 0.16, 0.1, new THREE.MeshToonMaterial({ color: 0xffe9b0, emissive: 0xffd890, emissiveIntensity: 0.55, gradientMap: ctx.grad }));
  lamp.position.set(w / 2 - 1.75, 2.1, d / 2 + 0.1); g.add(lamp);
  // 门牌与邮箱
  const plate = textSign(0.4, 0.16, (c, W, H) => { c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, W, H); c.fillStyle = '#3a4356'; c.font = `600 ${H * 0.52}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('桜木', W / 2, H * 0.56); });
  plate.position.set(w / 2 - 0.35, 1.95, d / 2 + 0.08); g.add(plate);
  if(two){
    for(const wx of [-w / 4, w / 4 - 0.3]){
      const ww = win(1.0, 0.9, { curtain: Math.random() > 0.4 }); ww.position.set(wx, h1 + 1.35, d / 2 + 0.05); g.add(ww);
    }
    // 阳台与晾晒
    const balc = B(2.1, 0.07, 0.75, M(0xc9ccce)); balc.position.set(-w / 4, h1 + 0.85, d / 2 + 0.4); g.add(balc);
    for(let i = 0; i <= 6; i++){
      const bar = B(0.035, 0.6, 0.035, M(0x9aa2a8)); bar.position.set(-w / 4 - 1 + i * 0.34, h1 + 1.16, d / 2 + 0.76); g.add(bar);
    }
    const rail = B(2.1, 0.045, 0.045, M(0x9aa2a8)); rail.position.set(-w / 4, h1 + 1.45, d / 2 + 0.76); g.add(rail);
    // 衬衫与床单
    const shirt = B(0.42, 0.55, 0.02, M(0xf6f4ee)); shirt.position.set(-w / 4 - 0.4, h1 + 1.25, d / 2 + 0.5); shirt.castShadow = false; g.add(shirt);
    const sheet = B(0.75, 0.6, 0.02, M(0xeee9dd)); sheet.position.set(-w / 4 + 0.55, h1 + 1.22, d / 2 + 0.5); sheet.castShadow = false; g.add(sheet);
    // 屋顶天线与热水器
    const ant = CYL(0.02, 0.02, 1.4, M(0x777d84), 6); ant.position.set(w / 4, h1 + h2 + 1.9, 0); g.add(ant);
    for(const s of [1, -1]){ const bar = B(1.1, 0.025, 0.025, M(0x777d84)); bar.position.set(w / 4, h1 + h2 + 2.35, s * 0.3); g.add(bar); }
    const boiler = CYL(0.34, 0.34, 0.85, M(0xd3d5d2), 12); boiler.position.set(-w / 4, h1 + h2 + 0.4, 0); g.add(boiler);
  }
  acUnit(-w / 2 + 0.55, 2.0, d / 2 + 0.18, g);
  // 空调外机（墙面）
  // 围墙 / 篱笆
  if(fence === 'wall'){
    const wl = B(0.28, 1.05, d * 0.72, M(0xcdc9bf)); wl.position.set(-w / 2 - 1.4, 0.52, 0); g.add(wl);
    const cap = B(0.4, 0.08, d * 0.72 + 0.1, M(0xb9b4aa)); cap.position.set(-w / 2 - 1.4, 1.08, 0); g.add(cap);
    if(Math.abs(Math.sin(ry)) > 0.5) ctx.block(x - d * 0.36, z + w / 2 + 1.1, x + d * 0.36, z + w / 2 + 1.7);
    else ctx.block(x - w / 2 - 1.65, z - d * 0.36, x - w / 2 - 1.15, z + d * 0.36);
  } else if(fence === 'hedge'){
    const hd2 = B(0.7, 0.85, d * 0.8, M(C.leafDeep)); hd2.position.set(-w / 2 - 1.2, 0.42, 0); hd2.castShadow = true; g.add(hd2);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

// ---------- 便利店 ----------
function convenienceStore(ctx, { x, z, ry = 0 }){
  const g = new THREE.Group();
  const w = 9.5, d = 6.5, h = 3.6;
  const body = B(w, h, d, M(0xf0f1ee)); body.position.y = h / 2; g.add(body); edges(body, { opacity: 0.25 });
  const apron = B(w + 0.4, 0.14, d + 0.4, M(0xc8cac6)); apron.position.y = 0.07; g.add(apron);
  const parapet = B(w + 0.3, 0.42, d + 0.3, M(0xd7d8d4)); parapet.position.y = h + 0.21; g.add(parapet);
  // 横向招牌带
  const band = textSign(w, 0.85, (c, W, H) => {
    c.fillStyle = '#2eae62'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff'; c.fillRect(0, H * 0.72, W, H * 0.1);
    c.font = `800 ${H * 0.5}px "Yu Gothic","Meiryo",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('さくらストア', W * 0.4, H * 0.4);
    c.font = `600 ${H * 0.2}px "Arial",sans-serif`;
    c.fillStyle = '#eafff1'; c.fillText('SAKURA STORE · 24H', W * 0.4, H * 0.62);
    c.fillStyle = '#ff8fb5'; c.font = `700 ${H * 0.34}px sans-serif`; c.fillText('🌸', W * 0.86, H * 0.42);
  });
  band.position.set(0, h - 0.25, d / 2 + 0.03); g.add(band);
  // 落地玻璃 + 室内
  const inner = B(w - 1.2, 2.5, 0.1, M(0xe8e4da)); inner.position.set(0, 1.45, d / 2 - 0.4); g.add(inner);
  for(let i = 0; i < 3; i++){
    const shelf = B(1.7, 1.15, 0.5, M(0xe3e5e6)); shelf.position.set(-2.6 + i * 2.6, 0.85, d / 2 - 1.1); g.add(shelf);
    for(let r = 0; r < 3; r++){
      const goods = B(1.5, 0.16, 0.4, M([0xf2b6c4, 0xaed68f, 0xf4d98c][i])); goods.position.set(-2.6 + i * 2.6, 0.62 + r * 0.34, d / 2 - 1.1); g.add(goods);
    }
  }
  const fridge = B(2.2, 1.7, 0.5, new THREE.MeshToonMaterial({ color: 0xdff2f8, emissive: 0xbfe6f2, emissiveIntensity: 0.5, gradientMap: ctx.grad }));
  fridge.position.set(2.6, 1.05, d / 2 - 1.0); g.add(fridge);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.4, 0.16), new THREE.MeshBasicMaterial({ color: 0xfff3d8 }));
  glow.position.set(0, 2.72, d / 2 - 0.35); g.add(glow);
  const glass = B(w - 1.4, 2.5, 0.06, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.34, gradientMap: ctx.grad }));
  glass.position.set(0, 1.45, d / 2 + 0.02); glass.castShadow = false; g.add(glass);
  // 自动门框
  const dfr = B(2.0, 2.3, 0.14, M(0x5d6873)); dfr.position.set(0.8, 1.3, d / 2 + 0.05); g.add(dfr);
  const dglass = B(1.7, 2.1, 0.05, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.4, gradientMap: ctx.grad }));
  dglass.position.set(0.8, 1.2, d / 2 + 0.1); g.add(dglass);
  // 无障碍斜坡 + 黄色引导砖
  const ramp = B(1.8, 0.1, 0.9, M(0xcfcbc2)); ramp.position.set(0.8, 0.06, d / 2 + 0.5); g.add(ramp);
  const tactile = B(1.2, 0.02, 0.4, M(C.tactile)); tactile.position.set(0.8, 0.13, d / 2 + 0.6); g.add(tactile);
  // 海报贴在玻璃上
  const poster = textSign(0.9, 1.2, (c, W, H) => {
    c.fillStyle = '#ffe3ec'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e8638e'; c.fillRect(0, 0, W, H * 0.2);
    c.fillStyle = '#fff'; c.font = `700 ${H * 0.12}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.fillText('春季新商品', W / 2, H * 0.13);
    c.fillStyle = '#f7a8c3'; c.beginPath(); c.arc(W / 2, H * 0.5, W * 0.3, 0, 7); c.fill();
    c.fillStyle = '#b04060'; c.font = `700 ${H * 0.11}px "Yu Gothic",sans-serif`; c.fillText('さくらサイダー', W / 2, H * 0.85);
  });
  poster.position.set(-1.6, 1.7, d / 2 + 0.06); g.add(poster);
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

// ---------- 咖啡店 ----------
function cafe(ctx, { x, z, ry = 0 }){
  const g = new THREE.Group();
  const w = 6.8, d = 5.6, h = 3.0;
  const body = B(w, h, d, M(0xf1e7d2)); body.position.y = h / 2; g.add(body); edges(body, { opacity: 0.22 });
  const roof = new THREE.Mesh(gableGeo(w, d, 1.1), new THREE.MeshToonMaterial({ color: C.roofBrown, gradientMap: ctx.grad, side: THREE.DoubleSide }));
  roof.position.y = h; roof.castShadow = true; g.add(roof);
  const ridge = B(w + 0.7, 0.09, 0.2, M(0x4c4038)); ridge.position.y = h + 1.1; g.add(ridge);
  // 大玻璃窗（店内可见）
  const inner = B(4.6, 1.9, 0.1, M(0xe8ddc8)); inner.position.set(-0.8, 1.35, d / 2 - 0.45); g.add(inner);
  const counter = B(3.4, 0.85, 0.5, M(0x7a5a40)); counter.position.set(-0.8, 0.45, d / 2 - 0.9); g.add(counter);
  for(let i = 0; i < 3; i++){
    const lamp = CYL(0.1, 0.16, 0.18, new THREE.MeshToonMaterial({ color: 0xffe2b0, emissive: 0xffc878, emissiveIntensity: 0.7, gradientMap: ctx.grad }), 10);
    lamp.position.set(-2 + i * 1.2, 2.45, d / 2 - 0.9); g.add(lamp);
    const pot = CYL(0.09, 0.07, 0.16, M(0xb87f6a), 8); pot.position.set(1.3, 1.15, d / 2 - 0.6); g.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshToonMaterial({ color: 0x74a35e, gradientMap: ctx.grad }));
    bush.position.set(1.3, 1.3, d / 2 - 0.6); g.add(bush);
  }
  const glass = B(4.6, 1.9, 0.06, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.3, gradientMap: ctx.grad }));
  glass.position.set(-0.8, 1.35, d / 2 + 0.02); glass.castShadow = false; g.add(glass);
  const dfr = B(1.0, 2.1, 0.1, M(0x5f4a38)); dfr.position.set(2.2, 1.05, d / 2 + 0.03); g.add(dfr);
  // 布艺遮阳棚（墨绿）
  const awn = B(w - 0.6, 0.07, 1.3, M(0x3f5949)); awn.position.set(0, 2.45, d / 2 + 0.62); awn.rotation.x = 0.28; g.add(awn);
  const awnSide1 = B(0.05, 0.5, 1.3, M(0x39513f)); awnSide1.position.set(-w / 2 + 0.3, 2.28, d / 2 + 0.62); awnSide1.rotation.x = 0.28; g.add(awnSide1);
  const awnSide2 = awnSide1.clone(); awnSide2.position.x = w / 2 - 0.3; g.add(awnSide2);
  // 招牌
  const sb = textSign(2.6, 0.5, (c, W, H) => {
    c.fillStyle = '#f6f1e4'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#4c5a4c'; c.lineWidth = 8; c.strokeRect(4, 4, W - 8, H - 8);
    c.fillStyle = '#41563f'; c.font = `700 ${H * 0.42}px "Yu Gothic","Meiryo",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('喫茶 ひだまり', W / 2, H * 0.5);
  });
  sb.position.set(0, 2.95, d / 2 + 0.05); g.add(sb);
  // 手写黑板菜单
  const bb = textSign(1.0, 1.4, (c, W, H) => {
    c.fillStyle = '#37413c'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#8a7a5c'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10);
    c.fillStyle = '#e8e4d4'; c.font = `600 ${H * 0.085}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('〜春の限定〜', W / 2, H * 0.16);
    c.fillText('桜ラテ ¥480', W / 2, H * 0.34);
    c.fillText('いちごケーキ', W / 2, H * 0.52);
    c.fillText(' ¥520', W / 2, H * 0.64);
    c.fillText('あんバター ¥460', W / 2, H * 0.82);
  });
  bb.position.set(2.9, 1.15, d / 2 + 0.35); bb.rotation.y = -0.25; g.add(bb);
  // 室外桌椅 + 窗台花盆
  for(let i = 0; i < 2; i++){
    const tbl = new THREE.Group();
    const top = CYL(0.42, 0.42, 0.05, M(0x8a6b4e), 16); top.position.y = 0.68; tbl.add(top);
    const leg = CYL(0.035, 0.05, 0.68, M(0x4a4f55), 8); leg.position.y = 0.34; tbl.add(leg);
    tbl.position.set(-2.2 + i * 1.7, 0, d / 2 + 1.5); tbl.rotation.y = i; g.add(tbl);
    for(const s of [1, -1]){
      const ch = new THREE.Group();
      const seat = CYL(0.2, 0.2, 0.04, M(0x5d666e), 10); seat.position.y = 0.45; ch.add(seat);
      const back = B(0.38, 0.42, 0.04, M(0x5d666e)); back.position.set(0, 0.68, -0.18); ch.add(back);
      const cl = CYL(0.028, 0.028, 0.45, M(0x43484e), 6); cl.position.y = 0.22; ch.add(cl);
      ch.position.set(-2.2 + i * 1.7 + s * 0.62, 0, d / 2 + 1.5); ch.rotation.y = -s * Math.PI / 2; g.add(ch);
    }
  }
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

// ---------- 和菓子店 ----------
function wagashi(ctx, { x, z, ry = 0 }){
  const g = new THREE.Group();
  const w = 5.8, d = 5.2, h = 2.9;
  const body = B(w, h, d, M(0x9a7a5a)); body.position.y = h / 2; g.add(body); edges(body, { opacity: 0.28 });
  const roof = new THREE.Mesh(gableGeo(w, d, 1.0), new THREE.MeshToonMaterial({ color: 0x4c5258, gradientMap: ctx.grad, side: THREE.DoubleSide }));
  roof.position.y = h; roof.castShadow = true; g.add(roof);
  // 深色木框推拉玻璃门
  const dfr = B(2.2, 2.05, 0.12, M(0x4f3c2c)); dfr.position.set(0, 1.08, d / 2 + 0.02); g.add(dfr);
  const dg = B(2.0, 1.9, 0.06, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.35, gradientMap: ctx.grad }));
  dg.position.set(0, 1.0, d / 2 + 0.08); dg.castShadow = false; g.add(dg);
  // 橱窗：点心盒与茶罐
  for(let i = 0; i < 4; i++){
    const box = B(0.4, 0.28, 0.3, M([0xf0e3c8, 0xe8b8c4, 0xcfe0c0, 0xf2d8a8][i])); box.position.set(-1.9 + i * 0.85, 0.62, d / 2 - 0.5); g.add(box);
  }
  // 暖帘
  const noren = textSign(2.1, 0.85, (c, W, H) => {
    c.fillStyle = '#3e4a63'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2ede2';
    c.font = `700 ${H * 0.62}px "Yu Gothic","Meiryo",serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('桜', W * 0.3, H * 0.54); c.fillText('堂', W * 0.7, H * 0.54);
    c.fillStyle = 'rgba(62,74,99,1)'; c.fillRect(0, 0, W, 3);
    c.fillStyle = '#3e4a63'; for(let i = 0; i < 5; i++) c.fillRect(i * (W / 4) + W / 8 - 4, H - 14, 8, 14);
  });
  noren.position.set(0, 2.35, d / 2 + 0.12); g.add(noren);
  // 纸灯笼
  const lt = CYL(0.24, 0.24, 0.55, new THREE.MeshToonMaterial({ color: 0xf2dfb4, emissive: 0xd8a860, emissiveIntensity: 0.4, gradientMap: ctx.grad }), 12);
  lt.position.set(1.7, 2.1, d / 2 + 0.2); g.add(lt);
  const ltt = textSign(0.4, 0.34, (c, W, H) => { c.clearRect(0, 0, W, H); c.fillStyle = '#8a4a3a'; c.font = `700 ${H * 0.6}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('菓', W / 2, H / 2); });
  ltt.position.set(1.7, 2.12, d / 2 + 0.46); g.add(ltt);
  // 招牌灯箱
  const sb = textSign(2.0, 0.42, (c, W, H) => {
    c.fillStyle = '#f4efe3'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#7a5a3e'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.fillStyle = '#6b4a30'; c.font = `700 ${H * 0.5}px "Yu Gothic",serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('和菓子 桜堂', W / 2, H * 0.52);
  });
  sb.position.set(0, 2.68, d / 2 + 0.04); g.add(sb);
  // 樱花麻薯海报
  const poster = textSign(0.85, 1.15, (c, W, H) => {
    c.fillStyle = '#ffeef4'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f4b8cc'; c.beginPath(); c.ellipse(W / 2, H * 0.42, W * 0.3, W * 0.24, 0.4, 0, 7); c.fill();
    c.fillStyle = '#8fd0a0'; c.beginPath(); c.ellipse(W * 0.42, H * 0.3, W * 0.16, W * 0.1, -0.5, 0, 7); c.fill();
    c.fillStyle = '#c46a86'; c.font = `700 ${H * 0.13}px "Yu Gothic",sans-serif`; c.textAlign = 'center';
    c.fillText('桜餅', W / 2, H * 0.78); c.fillText('販売中', W / 2, H * 0.92);
  });
  poster.position.set(-2.2, 1.35, d / 2 + 0.06); g.add(poster);
  // 红色长椅 + 竹帘
  const bench = B(1.5, 0.09, 0.42, M(0xc4544e)); bench.position.set(2.1, 0.42, d / 2 - 0.35); g.add(bench);
  for(const s of [1, -1]){ const leg = B(0.08, 0.42, 0.4, M(0xa84440)); leg.position.set(2.1 + s * 0.62, 0.21, d / 2 - 0.35); g.add(leg); }
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

// ---------- 花店 ----------
function flowerShop(ctx, { x, z, ry = 0 }){
  const g = new THREE.Group();
  const w = 5.4, d = 5.0, h = 2.8;
  const body = B(w, h, d, M(0xdfe7d2)); body.position.y = h / 2; g.add(body); edges(body, { opacity: 0.22 });
  const roof = new THREE.Mesh(gableGeo(w, d, 0.95), new THREE.MeshToonMaterial({ color: 0x5d7266, gradientMap: ctx.grad, side: THREE.DoubleSide }));
  roof.position.y = h; roof.castShadow = true; g.add(roof);
  const awn = B(w - 0.3, 0.06, 1.1, M(0xa8c6a0)); awn.position.set(0, 2.35, d / 2 + 0.5); awn.rotation.x = 0.26; g.add(awn);
  const sb = textSign(2.4, 0.45, (c, W, H) => {
    c.fillStyle = '#f6f4ea'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5a7a52'; c.font = `700 ${H * 0.48}px "Yu Gothic",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('花よし 🌷', W / 2, H * 0.52);
  });
  sb.position.set(0, 2.62, d / 2 + 0.04); g.add(sb);
  const dg = B(1.8, 1.95, 0.08, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.4, gradientMap: ctx.grad }));
  dg.position.set(0.2, 1.05, d / 2 + 0.04); dg.castShadow = false; g.add(dg);
  // 门口木箱花桶与鲜花
  const bucketCols = [0xb87f6a, 0x8a9aa5, 0xc9b27a];
  for(let i = 0; i < 4; i++){
    const b = CYL(0.22, 0.17, 0.38, M(bucketCols[i % 3]), 10);
    b.position.set(-1.9 + i * 0.75, 0.19, d / 2 + 0.55 + (i % 2) * 0.5); g.add(b);
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshToonMaterial({ color: [0xe86a7a, 0xf2c04a, 0xf5f0e6, 0xdd7ba0][i], gradientMap: ctx.grad }));
    fl.position.set(b.position.x, 0.52, b.position.z); fl.castShadow = true; g.add(fl);
  }
  const crate = B(0.9, 0.4, 0.55, M(0xa5825a)); crate.position.set(1.6, 0.2, d / 2 + 0.6); g.add(crate);
  // 风铃
  const chime = CYL(0.05, 0.07, 0.09, M(0xd8e4ea), 8); chime.position.set(-1.6, 2.15, d / 2 + 0.18); g.add(chime);
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

// ---------- 小书店 ----------
function bookstore(ctx, { x, z, ry = 0 }){
  const g = new THREE.Group();
  const w = 5.0, d = 4.6, h = 3.0;
  const body = B(w, h, d, M(0xcfd4d6)); body.position.y = h / 2; g.add(body); edges(body, { opacity: 0.24 });
  const roof = new THREE.Mesh(gableGeo(w, d, 1.0), new THREE.MeshToonMaterial({ color: C.roofBlue, gradientMap: ctx.grad, side: THREE.DoubleSide }));
  roof.position.y = h; roof.castShadow = true; g.add(roof);
  const sb = textSign(2.6, 0.46, (c, W, H) => {
    c.fillStyle = '#2f3e52'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2f0e8'; c.font = `700 ${H * 0.5}px "Yu Gothic",serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('書房 めじろ', W / 2, H * 0.52);
  });
  sb.position.set(0, 2.72, d / 2 + 0.04); g.add(sb);
  const dg = B(1.7, 1.9, 0.08, new THREE.MeshToonMaterial({ color: C.glass, transparent: true, opacity: 0.4, gradientMap: ctx.grad }));
  dg.position.set(-0.4, 1.0, d / 2 + 0.04); dg.castShadow = false; g.add(dg);
  // 门口杂志架
  const rack = B(1.2, 1.0, 0.35, M(0x8a8f94)); rack.position.set(1.4, 0.5, d / 2 + 0.4); g.add(rack);
  for(let i = 0; i < 5; i++){
    const mag = B(0.2, 0.28, 0.03, M([0xe89aac, 0x9ab8d8, 0xf2d488, 0xa8d0a8, 0xd8b8e8][i]));
    mag.position.set(0.95 + i * 0.22, 0.85, d / 2 + 0.6); mag.rotation.y = 0.1; g.add(mag);
  }
  g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  blockFor(ctx, x, z, w, d, ry);
  return g;
}

export function buildBuildings(ctx){
  // 东侧商店街（面向西 / ry = -PI/2）
  bookstore(ctx, { x: 6.2, z: 2.6, ry: -Math.PI / 2 });
  convenienceStore(ctx, { x: 10.2, z: 11.5, ry: -Math.PI / 2 });
  cafe(ctx, { x: 8.8, z: 22.5, ry: -Math.PI / 2 });
  wagashi(ctx, { x: 7.6, z: 33.0, ry: -Math.PI / 2 });
  flowerShop(ctx, { x: 7.6, z: 43.5, ry: -Math.PI / 2 });
  // 西侧住宅（面向东 / ry = PI/2）
  house(ctx, { x: -9.2, z: 8.5, ry: Math.PI / 2, wall: C.wallCream, roof: C.roofBlue, fence: 'wall' });
  house(ctx, { x: -10.0, z: 20.5, ry: Math.PI / 2, wall: C.wallBlue, roof: C.roofGray, fence: 'hedge' });
  house(ctx, { x: -9.0, z: 33.0, ry: Math.PI / 2, wall: C.wallWood, roof: C.roofBrown, fence: 'wall' });
  house(ctx, { x: -11.5, z: 45.5, ry: Math.PI / 2, wall: C.wallPink, roof: C.roofGreen, two: false, fence: 'hedge' });
  // 轨道对岸（北侧）远景住宅（面向南）
  house(ctx, { x: 12.0, z: -33.0, wall: C.wallBeige, roof: C.roofGray });
  house(ctx, { x: 2.0, z: -36.0, wall: C.wallGray, roof: C.roofBlue, two: false });
  house(ctx, { x: 22.0, z: -38.0, wall: C.wallCream, roof: C.roofBrown });
  house(ctx, { x: -8.0, z: -34.0, wall: C.wallBlue, roof: C.roofGray, two: false });
  // 商店街背后住宅
  house(ctx, { x: 19.5, z: 27.0, ry: -Math.PI / 2, wall: C.wallWhite, roof: C.roofGray, two: false });
}
