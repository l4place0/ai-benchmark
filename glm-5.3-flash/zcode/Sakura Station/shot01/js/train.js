import * as THREE from 'three';
import { M, C, cnv, B, CYL, hull } from './toon.js';
import { TRACK_NEAR_Z } from './cfg.js';

// ---------- 樱花色带通勤电车（两节编组，到站开门 / 道口联动）----------

const L = 16.5, W = 2.86;

function destTex(){
  return cnv(256, 64, c => {
    c.fillStyle = '#15181d'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#ffb84a'; c.font = '700 36px "Yu Gothic", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('普通  春野行', 128, 34);
  });
}

export function buildTrain(ctx){
  const g = new THREE.Group();
  g.position.z = TRACK_NEAR_Z;
  ctx.scene.add(g);

  const bodyMat = M(C.trainBody);
  const stripeMat = M(C.trainStripe);
  const darkMat = M(C.trainDark);
  const roofMat = M(C.trainRoof);
  const glass = new THREE.MeshToonMaterial({ color: 0x93aab8, gradientMap: ctx.grad });
  const doorGlass = new THREE.MeshToonMaterial({ color: 0x7e95a4, gradientMap: ctx.grad });
  const dTex = destTex();
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });

  const cars = [];
  for(let ci = 0; ci < 2; ci++){
    const car = new THREE.Group();
    const isHead = ci === 1;
    const body = B(L, 2.3, W, bodyMat); body.position.y = 2.1; car.add(body); hull(body, 1.028, 0x39404e);
    const stripe = B(L + 0.04, 0.42, W + 0.06, stripeMat); stripe.position.y = 1.58; car.add(stripe);
    const skirt = B(L - 0.1, 0.5, W - 0.16, darkMat); skirt.position.y = 0.98; car.add(skirt);
    const roof = B(L, 0.14, W - 0.3, roofMat); roof.position.y = 3.32; car.add(roof);
    for(const ax of [-L / 4, L / 4]){ const ac = B(1.7, 0.26, 1.5, M(0xb9bdc0)); ac.position.set(ax, 3.5, 0); car.add(ac); }
    // 侧窗与内舱剪影
    const inner = B(L - 0.4, 0.95, 0.05, M(0x4e5a64)); inner.position.set(0, 2.5, 0); car.add(inner);
    for(let i = 0; i < 5; i++){
      const wx = -6.2 + i * 3.1;
      for(const sz of [1, -1]){
        const win = B(1.45, 0.92, 0.06, glass); win.position.set(wx, 2.52, sz * (W / 2)); car.add(win);
        const sill = B(1.55, 0.06, 0.09, M(0x5a626c)); sill.position.set(wx, 2.0, sz * (W / 2)); car.add(sill);
        const hanger = B(0.04, 0.16, 0.04, M(0x8a929a)); hanger.position.set(wx + 0.2, 2.85, sz * (W / 2 - 0.1)); car.add(hanger);
      }
    }
    // 对开门（可滑动）
    const doors = [];
    for(const dx of [-4.9, 4.9]){
      const dg = new THREE.Group();
      for(const s of [1, -1]){
        const panel = B(0.66, 1.85, 0.06, M(0xe9e6dd)); panel.position.set(s * 0.34, 1.95, 0); dg.add(panel);
        const dw = B(0.5, 0.72, 0.035, doorGlass); dw.position.set(s * 0.34, 2.42, 0.02); dg.add(dw);
      }
      dg.position.set(dx, 0, W / 2 + 0.03); car.add(dg); doors.push(dg);
      const warn = B(1.75, 0.05, 0.04, M(0xe0b84a)); warn.position.set(dx, 1.06, W / 2 + 0.06); car.add(warn);
    }
    // 转向架
    for(const bx of [-L / 2 + 1.9, L / 2 - 1.9]){
      const bog = B(2.2, 0.5, 2.1, M(0x3a4046)); bog.position.set(bx, 0.68, 0); car.add(bog);
      for(const wx of [-0.75, 0.75]) for(const wz of [-0.92, 0.92]){
        const wh = CYL(0.42, 0.42, 0.12, M(0x23262b), 14);
        wh.rotation.x = Math.PI / 2; wh.position.set(bx + wx, 0.42, wz); car.add(wh);
      }
    }
    // 公司标与车号
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), stripeMat);
    badge.position.set(-3.0, 2.32, W / 2 + 0.02); car.add(badge);
    const num = B(0.72, 0.18, 0.02, M(0x4a5058)); num.position.set(-1.7, 1.34, W / 2 + 0.02); car.add(num);

    if(isHead){
      const nose = B(1.35, 2.28, W - 0.14, bodyMat);
      nose.position.set(L / 2 + 0.5, 2.12, 0); nose.rotation.z = -0.1; car.add(nose); hull(nose, 1.03, 0x39404e);
      const shield = B(0.12, 1.05, W - 0.85, M(0x2c343c));
      shield.position.set(L / 2 + 1.06, 2.72, 0); shield.rotation.z = -0.1; car.add(shield);
      const wiper = B(0.05, 0.5, 0.03, M(0x1c2024)); wiper.position.set(L / 2 + 1.14, 2.6, 0.3); wiper.rotation.z = -0.1; car.add(wiper);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.36), new THREE.MeshBasicMaterial({ map: dTex }));
      disp.position.set(L / 2 + 0.98, 3.1, 0); disp.rotation.y = Math.PI / 2; car.add(disp);
      for(const s of [1, -1]){
        const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), lampMat);
        lp.rotation.z = Math.PI / 2; lp.position.set(L / 2 + 1.05, 1.5, s * 0.85); car.add(lp);
      }
      const cow = B(0.3, 0.5, W - 0.3, darkMat); cow.position.set(L / 2 + 0.98, 0.75, 0); car.add(cow);
      // 受电弓
      const pg = new THREE.Group();
      const b1 = B(0.05, 1.15, 0.05, M(0x5a6068)); b1.position.set(-0.35, 0.55, 0); b1.rotation.z = 0.5; pg.add(b1);
      const b2 = B(0.05, 1.15, 0.05, M(0x5a6068)); b2.position.set(0.35, 0.55, 0); b2.rotation.z = -0.5; pg.add(b2);
      const shoe = B(1.15, 0.05, 0.15, M(0x3e444a)); shoe.position.y = 1.12; pg.add(shoe);
      pg.position.set(L / 2 - 3.6, 3.4, 0); car.add(pg);
    } else {
      const noseB = B(1.0, 2.28, W - 0.14, bodyMat);
      noseB.position.set(-L / 2 - 0.35, 2.12, 0); noseB.rotation.z = 0.1; car.add(noseB);
      const tailWin = B(0.08, 0.6, W - 1.0, M(0x2c343c));
      tailWin.position.set(-L / 2 - 0.96, 2.55, 0); tailWin.rotation.z = 0.1; car.add(tailWin);
      for(const s of [1, -1]){
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.34), new THREE.MeshBasicMaterial({ color: 0xe04545 }));
        tl.position.set(-L / 2 - 1.0, 1.45, s * 0.8); car.add(tl);
      }
    }
    const ox = ci === 0 ? -L / 2 - 0.25 : L / 2 + 0.25;
    car.position.x = ox;
    g.add(car);
    cars.push({ car, doors });
  }
  // 车间风挡
  const gang = B(0.5, 1.9, W - 0.7, M(0x2c3238)); gang.position.set(0, 2.05, 0); g.add(gang);

  // ---- 运行状态机 ----
  const st = { mode: 'dwell', t: 2.0, v: 0, x: 6, doorT: 1 };
  const STOP_X = 6, TOP_V = 11, ACC = 1.7, DEC = 1.15;
  function update(dt, t){
    st.t += dt;
    if(st.mode === 'dwell'){
      st.v = 0;
      st.doorT = Math.min(1, st.doorT + dt * 0.8);
      ctx.gateDown = false; ctx.trainMoving = false;
      if(st.t > 9){ st.mode = 'out'; st.t = 0; }
    } else if(st.mode === 'out'){
      st.doorT = Math.max(0, st.doorT - dt * 0.9);
      st.v = Math.min(TOP_V, st.v + ACC * dt);
      st.x += st.v * dt;
      ctx.gateDown = true; ctx.trainMoving = true;
      if(st.x > 150){ st.mode = 'wait'; st.t = 0; }
    } else if(st.mode === 'wait'){
      ctx.gateDown = false; ctx.trainMoving = false;
      if(st.t > 7){ st.mode = 'in'; st.t = 0; st.v = 0; st.x = -140; }
    } else {
      const remain = STOP_X - st.x;
      const vLim = Math.sqrt(2 * DEC * Math.max(remain, 0)) + 0.4;
      st.v = Math.min(TOP_V, st.v + ACC * dt, vLim);
      st.x += st.v * dt;
      ctx.gateDown = true; ctx.trainMoving = true;
      if(remain < 0.06){ st.mode = 'dwell'; st.t = 0; st.v = 0; st.x = STOP_X; }
    }
    g.position.x = st.x;
    const open = st.doorT * 0.62;
    for(const c of cars) for(const d of c.doors){
      d.children[0].position.x = 0.34 + open;
      d.children[1].position.x = 0.34 + open;
      d.children[2].position.x = -0.34 - open;
      d.children[3].position.x = -0.34 - open;
    }
    lampMat.color.setHex(ctx.trainMoving ? 0xfff4d0 : 0x6a6458);
  }
  return { update };
}
