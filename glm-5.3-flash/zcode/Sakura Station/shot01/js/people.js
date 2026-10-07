import * as THREE from 'three';
import { M, B } from './toon.js';

// ---------- 二次元比例的简约人物（站员 / 学生 / 乘客 / 行人）----------

function person(ctx, { x, z, ry = 0, shirt = 0x8a9aa8, pants = 0x4a5560, hair = 0x3a3230,
  skin = 0xf5d8c4, skirt = null, cap = null, bag = null, sit = false, benchY = 0 } = {}){
  const g = new THREE.Group();
  const shirtM = M(shirt), pantsM = M(pants), skinM = M(skin), hairM = M(hair);
  const torso = B(0.36, 0.5, 0.22, shirtM); torso.position.y = 1.06; g.add(torso);
  const hips = B(0.34, 0.14, 0.22, pantsM); hips.position.y = 0.78; g.add(hips);
  if(skirt){ const sk = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.36, 10), pantsM); sk.position.y = 0.64; g.add(sk); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), skinM); head.position.y = 1.47; g.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
  hairCap.position.y = 1.47; g.add(hairCap);
  if(cap){
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.158, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), M(cap));
    cp.position.y = 1.51; g.add(cp);
    const brim = B(0.16, 0.03, 0.13, M(cap)); brim.position.set(0, 1.53, 0.14); g.add(brim);
  }
  const legs = [], shoes = [];
  for(const s of [1, -1]){
    const leg = B(0.12, 0.58, 0.14, pantsM); leg.position.set(s * 0.09, 0.36, 0); g.add(leg); legs.push(leg);
    const shoe = B(0.13, 0.08, 0.2, M(0x3a3f45)); shoe.position.set(s * 0.09, 0.04, 0.02); g.add(shoe); shoes.push(shoe);
    const arm = B(0.09, 0.44, 0.11, shirtM); arm.position.set(s * 0.24, 1.0, 0); g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skinM); hand.position.set(s * 0.24, 0.76, 0); g.add(hand);
  }
  for(const s of [1, -1]){
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), M(0x2a2a30));
    eye.position.set(s * 0.05, 1.49, 0.125); g.add(eye);
  }
  if(bag){ const b = B(0.2, 0.24, 0.12, M(bag)); b.position.set(0.26, 0.66, 0.06); g.add(b); }
  if(sit){
    for(const leg of legs){ leg.rotation.x = -1.35; leg.position.y = 0.62; leg.position.z = 0.16; }
    for(const shoe of shoes){ shoe.position.set(shoe.position.x, 0.2, 0.46); }
    torso.rotation.x = 0.1;
    g.position.set(x, benchY - 0.78, z);   // benchY = 座面高度
  } else {
    g.position.set(x, 0, z);
  }
  g.rotation.y = ry;
  g.traverse(o => { if(o.isMesh) o.castShadow = true; });
  ctx.scene.add(g);
  return g;
}

export function buildPeople(ctx){
  // 站前引导的站员（深蓝制服 + 帽子）
  person(ctx, { x: 4.6, z: -10.6, ry: 0.2, shirt: 0x3a4e6e, pants: 0x2e3a50, cap: 0x3a4e6e, hair: 0x2c2622 });
  // 站台长椅上看书的乘客（面朝轨道）
  person(ctx, { x: 2.9, z: -17.75, ry: Math.PI + 0.25, shirt: 0x9a8a72, pants: 0x5a5a5e, hair: 0x4a4038,
    sit: true, benchY: ctx.platformBenchY ?? 1.0 });
  // 道口旁推着自行车等待的女学生（水手服；自行车在 props 中）
  person(ctx, { x: 21.4, z: -15.0, ry: Math.PI / 2 + 0.12, shirt: 0x2e3848, pants: 0x3e4a5e, skirt: 0x3e4a5e, hair: 0x2c2622 });
  // 贩卖机前挑选饮料的少年
  person(ctx, { x: -2.6, z: -11.7, ry: Math.PI, shirt: 0x6a7a8a, pants: 0x3e4450, hair: 0x2c2622 });
  // 提着购物袋慢慢走的老人
  const elder = person(ctx, { x: -1.6, z: 24.0, ry: -0.35, shirt: 0x8a7a6a, pants: 0x5a5248, hair: 0x9a9a96, bag: 0xc9a86a });
  // 咖啡店门口整理黑板菜单的店员
  person(ctx, { x: 5.0, z: 25.0, ry: 1.35, shirt: 0x6a5a48, pants: 0x3e3830, hair: 0x3a2e26 });
  // 放学同行的两名学生
  const st1 = person(ctx, { x: 1.3, z: 8.2, ry: -0.15, shirt: 0x2e3848, pants: 0x3e4a5e, skirt: 0x3e4a5e, hair: 0x4a3428 });
  const st2 = person(ctx, { x: 2.3, z: 7.4, ry: -0.15, shirt: 0x3e4450, pants: 0x3e4a5e, hair: 0x2c2622 });

  ctx.updates.push((dt, t) => {
    st1.position.y = Math.abs(Math.sin(t * 3.1)) * 0.035;
    st2.position.y = Math.abs(Math.sin(t * 3.1 + 2.1)) * 0.035;
    elder.position.y = Math.abs(Math.sin(t * 1.9 + 0.5)) * 0.02;
  });
}
