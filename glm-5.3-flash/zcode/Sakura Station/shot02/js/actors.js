/* ============================================================
 * actors.js — 电车（两节编组）与人物
 * ============================================================ */
"use strict";

/* ---------- 车辆用小贴图 ---------- */
const texDest = canvasTex(256, 64, (c, w, h) => {
  c.fillStyle = "#0c0e12"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffb43a"; c.font = `700 40px ${FONT_JP}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("普通 ふじ野台", w / 2, h / 2 + 2);
});
const texLogo = canvasTex(64, 64, (c) => {
  c.clearRect(0, 0, 64, 64);
  c.fillStyle = "#f0a2b8"; c.beginPath(); c.arc(32, 32, 28, 0, 7); c.fill();
  c.fillStyle = "#fff"; c.font = `800 34px ${FONT_JP}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("桜", 32, 34);
});
const texCarNo = canvasTex(128, 48, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#2a323c"; c.font = `700 30px ${FONT_JP}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("クモハ1201", w / 2, h / 2);
});

/* ---------- 单节车厢 ---------- */
function makeTrainCar(len, isHead) {
  const g = group();
  const BW = 2.9, BH = 2.15, BY = 1.18;        // 车体宽 / 高 / 底面高度
  const bodyMat = toon(PAL.trainBody);
  const glassMat = toon(0x46545e);
  const warmGlass = toon(0xe8d9ae);

  const body = box(len, BH, BW, bodyMat, 0, BY + BH / 2, 0);
  g.add(body);
  outline(body, 0.035);
  // 车顶圆弧（窄顶板）
  g.add(box(len - 0.3, 0.14, BW - 0.55, toon(PAL.trainRoof), 0, BY + BH + 0.02, 0, { cs: false }));
  // 樱粉色横带
  g.add(box(len + 0.04, 0.3, BW + 0.03, toon(PAL.trainStripe), 0, BY + 0.72, 0, { cs: false }));
  // 裙边
  g.add(box(len - 0.6, 0.42, BW - 0.25, toon(PAL.trainSkirt), 0, BY + 0.21, 0, { cs: false }));

  // 侧窗（两侧各 4 扇，与门错开）
  const side = BW / 2 + 0.01;
  const winY = BY + 1.52, winH = 0.85;
  const winW = 1.35;
  const winXs = [1.7, 3.6, 8.55];
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    for (const wx0 of winXs) {
      for (const wx of [wx0, -wx0]) {
        const lit = rng() < 0.45;
        // 侧窗：宽边沿车长方向（X），薄片贴着车体侧面（Z）
        const win = box(winW, 0.85, 0.06, lit ? warmGlass : glassMat, wx, winY, s2 * side);
        g.add(win);
        // 车内乘客剪影
        if (lit && rng() < 0.7) {
          const px = wx + rr(-0.3, 0.3);
          g.add(box(0.16, 0.3, 0.02, toon(0x3a4250), px, winY - 0.2, s2 * (side - 0.045), { cs: false }));
          g.add(sph(0.055, toon(0x2e3540), px, winY - 0.02, s2 * (side - 0.045), { cs: false }));
        }
        // 窗框
        g.add(box(winW + 0.1, 0.95, 0.04, toon(0x5a6068), wx, winY, s2 * (side + 0.02), { cs: false }));
      }
    }
  }
  // 车门（两侧各 2 组，敞开状态）
  const doorY = BY + 0.95, doorH = 1.8;
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    for (const dx of [len * 0.29, -len * 0.29]) {
      // 敞开的门洞（深色，贴在车体侧面）
      g.add(box(1.32, doorH, 0.06, toon(0x2c343e), dx, doorY, s2 * (side - 0.02), { cs: false }));
      // 收进来的门叶（贴在洞旁，与车体侧面平行）
      g.add(box(0.62, doorH, 0.04, toon(PAL.trainBody), dx + s2 * 0.97, doorY, s2 * (side + 0.015), { cs: false }));
      // 门口黄线
      g.add(box(1.36, 0.09, 0.07, toon(0xf2c53c), dx, BY + 0.08, s2 * side, { cs: false }));
      // 门上指示灯
      g.add(sph(0.045, toon(0x7fd4a8, { emissive: 0x4fbf7f, ei: 0.7 }), dx, doorY + doorH / 2 + 0.12, s2 * (side + 0.03), { cs: false }));
      // 优先席贴纸
      g.add(plane(0.16, 0.16, basic(0xf6c93c, { opa: 0.9 }), dx + s2 * 0.85, doorY + 0.45, s2 * (side + 0.035), { ry: s2 > 0 ? 0 : Math.PI, cs: false }));
    }
  }
  // 车辆编号 / 公司标志（贴在车体侧面）
  g.add(plane(0.62, 0.23, basic(0xffffff, { map: texCarNo, opa: 0.9 }), len / 2 - 0.75, BY + 1.95, side + 0.02, { cs: false }));
  g.add(plane(0.26, 0.26, basic(0xffffff, { map: texLogo, opa: 0.95 }), -len / 2 + 0.85, BY + 0.72, side + 0.02, { cs: false }));

  // 车顶设备：空调 ×2 + 受电弓
  for (const ax of [-len * 0.25, len * 0.25]) {
    g.add(box(2.2, 0.28, 1.7, toon(0x9aa1a8), ax, BY + BH + 0.2, 0, { cs: false }));
    g.add(box(2.0, 0.1, 0.5, toon(0x7a828a), ax, BY + BH + 0.4, 0, { cs: false }));
  }
  const pantoX = isHead ? -len * 0.02 : 0;
  const panto = group(pantoX, BY + BH + 0.25, 0);
  panto.add(box(0.06, 0.06, 1.5, toon(0x4a5056), 0, 0.05, 0, { cs: false }));
  panto.add(box(0.05, 0.8, 0.05, toon(0x4a5056), -0.28, 0.4, -0.5, { rz: 0.5, cs: false }));
  panto.add(box(0.05, 0.8, 0.05, toon(0x4a5056), 0.28, 0.4, 0.5, { rz: -0.5, cs: false }));
  panto.add(box(1.3, 0.04, 0.09, toon(0x3a4046), 0, 0.8, 0, { cs: false }));
  g.add(panto);

  // 转向架 + 车轮
  for (const bx of [-len / 2 + 1.9, len / 2 - 1.9]) {
    g.add(box(2.3, 0.5, 2.1, toon(0x33383f), bx, 0.88, 0, { cs: false }));
    for (const wz of [-0.75, 0.75]) {
      for (const wx of [-0.6, 0.6]) {
        g.add(cyl(0.4, 0.4, 0.12, 14, toon(0x22262b), bx + wx, 0.46, wz, { rz: Math.PI / 2, cs: false }));
        g.add(cyl(0.16, 0.16, 0.13, 10, toon(0x8a9096), bx + wx, 0.46, wz, { rz: Math.PI / 2, cs: false }));
      }
      // 弹簧
      g.add(box(0.3, 0.18, 0.24, toon(0x555c64), bx, 1.15, wz, { cs: false }));
    }
  }

  /* ---- 车头 ---- */
  if (isHead) {
    const fx = len / 2;
    // 驾驶室（略前倾的圆润鼻头）
    const nose = box(1.15, BH - 0.1, BW - 0.12, bodyMat, fx + 0.5, BY + BH / 2 - 0.02, 0);
    nose.rotation.z = -0.06;
    g.add(nose);
    outline(nose, 0.03);
    g.add(box(0.9, 0.5, BW - 0.5, toon(PAL.trainSkirt), fx + 0.85, BY + 0.32, 0, { cs: false }));
    // 前窗（大玻璃）
    const ws = box(0.08, 0.95, BW - 0.55, toon(0x3e4c58), fx + 0.98, BY + 1.62, 0, { rz: -0.09 });
    g.add(ws);
    // 檐板
    g.add(box(0.5, 0.06, BW - 0.4, toon(PAL.trainBody), fx + 0.78, BY + 2.18, 0, { rz: -0.28, cs: false }));
    // 目的地显示
    g.add(box(0.1, 0.3, 1.7, toon(0x14171c), fx + 0.86, BY + 1.98, 0, { cs: false }));
    g.add(plane(1.6, 0.26, basic(0xffffff, { map: texDest }), fx + 0.93, BY + 1.98, 0, { ry: Math.PI / 2, cs: false }));
    // 前灯 ×2（常亮）+ 尾灯
    for (const lz of [-0.85, 0.85]) {
      g.add(cyl(0.14, 0.14, 0.1, 12, toon(0xfff6dc, { emissive: 0xffedb8, ei: 0.95 }), fx + 0.98, BY + 0.62, lz, { rz: Math.PI / 2, cs: false }));
      g.add(box(0.06, 0.18, 0.18, toon(0xc43a3a, { emissive: 0xe84848, ei: 0.4 }), fx + 0.98, BY + 1.08, lz, { cs: false }));
    }
    // 排障器 + 车钩
    g.add(box(0.25, 0.4, BW - 0.3, toon(0x33383f), fx + 1.02, BY - 0.28, 0, { cs: false }));
    g.add(cyl(0.09, 0.09, 0.5, 8, toon(0x4a5056), fx + 1.3, BY - 0.18, 0, { rz: Math.PI / 2, cs: false }));
    // 线路牌
    g.add(plane(0.3, 0.3, basic(0xffffff, { map: texLogo }), fx + 0.9, BY + 2.28, 0, { ry: Math.PI / 2, cs: false }));
    // 雨刷
    g.add(box(0.03, 0.5, 0.05, toon(0x22262b), fx + 1.02, BY + 1.5, 0.3, { rz: 0.5, cs: false }));
  }
  return g;
}

function buildTrain() {
  const train = group();
  train.position.set(0, 0, L.RAIL1);
  // 头车在前（东端 x=+5），第二辆向左
  const car1 = makeTrainCar(19.8, true);
  car1.position.set(-4.9, 0, 0);
  const car2 = makeTrainCar(19.5, false);
  car2.position.set(-24.8, 0, 0);
  train.add(car1, car2);
  // 车间连接篷布
  train.add(box(0.6, 1.6, 2.5, toon(0x2e333a), -15.0, 2.2, 0, { cs: false }));
  scene.add(train);
  return train;
}

/* ---------- 人物 ---------- */
const SKIN = 0xf2d5bc;
/**
 * o: {x, z, ry, hair, hairStyle:'long'|'short'|'bun'|'cap', top, bottom, skirt, bag, cap, raiseArm, book, bike}
 */
function makePerson(o) {
  const g = group(o.x, o.y || 0, o.z, o.ry || 0);
  const skinMat = toon(SKIN);
  const hairMat = toon(o.hair || 0x3a2e28);
  const topMat = toon(o.top || 0x3a4a68);
  const legMat = toon(o.bottom || 0x2e3440);

  // 腿
  g.add(box(0.09, 0.48, 0.1, legMat, -0.08, 0.24, 0, { cs: false }));
  g.add(box(0.09, 0.48, 0.1, legMat, 0.08, 0.24, 0, { cs: false }));
  g.add(box(0.1, 0.06, 0.2, toon(0x4a3f36), -0.08, 0.03, 0.03, { cs: false }));
  g.add(box(0.1, 0.06, 0.2, toon(0x4a3f36), 0.08, 0.03, 0.03, { cs: false }));

  let torsoY = 0.48;
  if (o.skirt) {
    // 百褶裙（锥形）
    const sk = cyl(0.13, 0.21, 0.3, 8, toon(o.skirt), 0, 0.6, 0);
    g.add(sk);
    torsoY = 0.72;
  } else {
    g.add(box(0.24, 0.5, 0.15, legMat, 0, 0.72, 0, { cs: false }));
    torsoY = 0.72;
  }
  // 上身
  const torso = box(0.36, 0.5, 0.2, topMat, 0, torsoY + 0.25, 0);
  g.add(torso);
  outline(torso, 0.016);
  // 水手服领 + 领结
  if (o.sailor) {
    g.add(box(0.38, 0.12, 0.22, toon(0xf4f2ee), 0, torsoY + 0.44, 0, { cs: false }));
    g.add(box(0.38, 0.14, 0.02, toon(0xf4f2ee), 0, torsoY + 0.34, -0.11, { cs: false }));
    g.add(box(0.06, 0.08, 0.04, toon(0xc23a3a), 0, torsoY + 0.36, 0.11, { cs: false }));
  }
  // 手臂
  const armL = box(0.075, 0.42, 0.09, topMat, -0.215, torsoY + 0.24, 0);
  const armR = box(0.075, 0.42, 0.09, topMat, 0.215, torsoY + 0.24, 0);
  g.add(armL, armR);
  g.add(sph(0.05, skinMat, -0.215, torsoY + 0.02, 0, { cs: false }));
  g.add(sph(0.05, skinMat, 0.215, torsoY + 0.02, 0, { cs: false }));
  if (o.raiseArm === "right") armR.rotation.x = -2.4, armR.position.z = 0.12;
  if (o.raiseArm === "left") armL.rotation.x = -2.4, armL.position.z = 0.12;
  if (o.holdUp) { armL.rotation.x = -1.3; armR.rotation.x = -1.3; }
  // 头
  const head = sph(0.14, skinMat, 0, torsoY + 0.64, 0, { seg: 14, seg2: 10 });
  g.add(head);
  outline(head, 0.012);
  // 头发
  const hair = sph(0.148, hairMat, 0, torsoY + 0.68, -0.015, { sy: 0.88, sz: 0.92, seg: 12, seg2: 9 });
  g.add(hair);
  g.add(box(0.24, 0.09, 0.06, hairMat, 0, torsoY + 0.72, 0.105, { cs: false }));   // 刘海
  if (o.hairStyle === "long") {
    g.add(box(0.2, 0.34, 0.12, hairMat, 0, torsoY + 0.42, -0.09, { cs: false }));
  } else if (o.hairStyle === "bun") {
    g.add(sph(0.075, hairMat, 0, torsoY + 0.8, -0.1, { cs: false }));
  } else if (o.hairStyle === "twin") {
    g.add(cyl(0.035, 0.02, 0.3, 6, hairMat, -0.15, torsoY + 0.45, -0.05, { rz: 0.25, cs: false }));
    g.add(cyl(0.035, 0.02, 0.3, 6, hairMat, 0.15, torsoY + 0.45, -0.05, { rz: -0.25, cs: false }));
  }
  // 帽子（车站员）
  if (o.cap) {
    g.add(cyl(0.15, 0.16, 0.09, 12, toon(0x2e3a52), 0, torsoY + 0.82, 0, { cs: false }));
    g.add(box(0.24, 0.02, 0.14, toon(0x2e3a52), 0, torsoY + 0.78, 0.14, { cs: false }));
    g.add(box(0.1, 0.05, 0.02, toon(0xf6c93c), 0, torsoY + 0.82, 0.15, { cs: false }));
  }
  // 书包 / 手提袋
  if (o.bag === "school") {
    const bg = box(0.28, 0.34, 0.14, toon(o.bagCol || 0xa84a3a), 0, torsoY + 0.28, -0.18);
    g.add(bg);
    outline(bg, 0.014);
  } else if (o.bag === "shopping") {
    g.add(box(0.24, 0.28, 0.12, toon(0xd8cfa8), 0.26, torsoY + 0.05, 0.04, { cs: false }));
    g.add(box(0.1, 0.02, 0.02, toon(0x8a8068), 0.26, torsoY + 0.2, 0.04, { cs: false }));
  }
  // 手中的书
  if (o.book) {
    g.add(box(0.2, 0.025, 0.28, toon(0xf4f2ea), -0.22, torsoY + 0.32, 0.12, { rx: -0.9, cs: false }));
  }
  scene.add(g);
  return g;
}

/** 坐姿人物（站台长椅看书） */
function makeSittingPerson(x, y, z, ry) {
  const g = group(x, y, z, ry);
  const topMat = toon(0x5a6a7a), legMat = toon(0x3a4048), hairMat = toon(0x2e2a26);
  // 大腿（水平）+ 小腿（垂直）
  g.add(box(0.26, 0.11, 0.12, legMat, 0, 0.3, 0.18, { cs: false }));
  g.add(box(0.09, 0.3, 0.1, legMat, -0.09, 0.15, 0.32, { cs: false }));
  g.add(box(0.09, 0.3, 0.1, legMat, 0.09, 0.15, 0.32, { cs: false }));
  // 上身略后靠
  const torso = box(0.36, 0.5, 0.2, topMat, 0, 0.58, -0.02, { rx: -0.1 });
  g.add(torso);
  outline(torso, 0.016);
  g.add(sph(0.14, toon(SKIN), 0, 0.94, 0.02, { seg: 14, seg2: 10 }));
  const hair = sph(0.148, hairMat, 0, 0.98, -0.015, { sy: 0.88, sz: 0.92, cs: false });
  g.add(hair);
  g.add(box(0.2, 0.3, 0.12, hairMat, 0, 0.76, -0.1, { cs: false }));
  // 手持书
  g.add(box(0.22, 0.03, 0.3, toon(0xf4f2ea), 0, 0.72, 0.24, { rx: -1.15, cs: false }));
  g.add(box(0.18, 0.02, 0.24, toon(0x9ab8c8), 0, 0.735, 0.24, { rx: -1.15, cs: false }));
  // 手臂托书
  g.add(box(0.07, 0.34, 0.09, topMat, -0.2, 0.62, 0.1, { rx: -1.0, cs: false }));
  g.add(box(0.07, 0.34, 0.09, topMat, 0.2, 0.62, 0.1, { rx: -1.0, cs: false }));
  scene.add(g);
  return g;
}

function buildPeople() {
  // 车站工作人员（东门旁）
  makePerson({ x: -4.6, z: -11.4, ry: Math.PI / 2 - 0.15, hair: 0x26221e, top: 0x2e3a52, bottom: 0x26303f, cap: true });
  // 站台长椅上看书的乘客
  makeSittingPerson(-14.5, 1.25, -16.15, Math.PI);
  // 等待道口的少女 + 自行车
  const girl = makePerson({
    x: 12.9, z: -15.3, ry: Math.PI + 0.15, hair: 0x4a3628, hairStyle: "long",
    top: 0x2e3a52, skirt: 0x2e3a52, sailor: true, bag: "school", bagCol: 0x8a4a42,
  });
  girl.position.y = 0;
  const girlBike = makeBike(0xc46a6a);
  girlBike.position.set(12.15, 0.1, -15.7);
  girlBike.rotation.y = Math.PI + 0.25;
  scene.add(girlBike);
  // 步行中的学生 ×2（东侧人行道）
  makePerson({ x: 14.3, z: 17.6, ry: Math.PI - 0.3, hair: 0x26221e, hairStyle: "twin", top: 0x2e3a52, skirt: 0x2e3a52, sailor: true, bag: "school", bagCol: 0x3a5a8a });
  makePerson({ x: 14.9, z: 16.0, ry: Math.PI + 0.2, hair: 0x4a3628, top: 0x3c4656, bottom: 0x2e3440, bag: "school", bagCol: 0x2a6a4a });
  // 在花店门前挑花的老人（东侧人行道）
  makePerson({ x: 15.9, z: 25.6, ry: Math.PI / 2, hair: 0x8a8a86, hairStyle: "bun", top: 0x8a7a6a, bottom: 0x5a5248, bag: "shopping" });
  // 在贩卖机前选饮料的少年
  makePerson({ x: -0.55, z: 1.75, ry: Math.PI, hair: 0x3a2e28, top: 0xe8e4d8, bottom: 0x46505c, raiseArm: "right" });
}
