/* ============================================================
 * street.js — 电杆电线 / 贩卖机 / 道口 / 标志 / 街道道具
 * ============================================================ */
"use strict";

/* ---------- 自动贩卖机 ---------- */
function makeVending(x, z, ry, bodyCol, opt) {
  opt = opt || {};
  const gy = opt.y || 0;
  const g = group(x, gy, z, ry);
  const W = 1.12, H = 1.85, D = 0.78;
  // 混凝土垫台
  g.add(box(W + 0.3, 0.1, D + 0.26, toon(0xb6b9b6), 0, 0.05, 0, { cs: false }));
  const tex = canvasTex(256, 440, (c, cw, ch) => {
    c.fillStyle = "#f4f4f0"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = bodyColCss(bodyCol); c.fillRect(0, 0, cw, 64); c.fillRect(0, ch - 90, cw, 90);
    c.fillStyle = "#fff"; c.font = `800 34px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("ドリンク", cw / 2 - 40, 44);
    c.fillStyle = "#e84a6a"; c.beginPath(); c.arc(cw - 32, 32, 18, 0, 7); c.fill();
    // 饮品阵列 3×4
    const cols = ["#7ac48f", "#e85a5a", "#f2c53c", "#5a9ae8", "#f2f2ee", "#8ad0c8", "#e88ab8", "#c8e88a", "#f2a25a", "#9a8ae8", "#e8e2c8", "#6ab8e8"];
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q < 3; q++) {
        const cx = 34 + q * 52, cy = 92 + r * 62;
        c.fillStyle = "#20242c"; c.fillRect(cx - 24, cy - 26, 48, 52);
        c.fillStyle = cols[(r * 3 + q + (opt.seed || 0)) % cols.length];
        c.fillRect(cx - 20, cy - 22, 40, 44);
        c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(cx - 14, cy - 22, 7, 44);
        c.fillStyle = "#fff"; c.font = `700 13px ${FONT_JP}`; c.textAlign = "center";
        c.fillText("120", cx, cy + 40);
      }
    }
    // 右侧投币区
    c.fillStyle = "#20242c"; c.fillRect(cw - 52, 92, 40, 120);
    c.fillStyle = "#889098"; c.fillRect(cw - 44, 100, 24, 8);
    c.fillStyle = "#3d7ac8"; c.fillRect(cw - 44, 122, 24, 18);
    c.fillStyle = "#f2c53c"; c.fillRect(cw - 44, 152, 24, 10);
    c.fillStyle = "#fff"; c.font = `700 15px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("両替", cw - 32, 186);
    // 取货口
    c.fillStyle = "#3a3f47"; c.fillRect(24, ch - 150, 130, 44);
    c.fillStyle = "#fff"; c.font = `700 15px ${FONT_JP}`; c.textAlign = "left";
    c.fillText("とりだし口", 34, ch - 96);
    c.fillStyle = "#e84a6a"; c.fillRect(170, ch - 104, 58, 22);
  });
  const body = box(W, H, D, toon(bodyCol), 0, 0.1 + H / 2, 0);
  g.add(body);
  outline(body, 0.02);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, H - 0.12),
    new THREE.MeshToonMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.16, gradientMap: gradientMap4() }));
  face.position.set(0, 0.1 + H / 2, D / 2 + 0.012);
  g.add(face);
  // 顶部小雨棚
  g.add(box(W + 0.16, 0.06, D + 0.14, toon(0x5a6068), 0, 0.1 + H + 0.05, -0.02, { cs: false }));
  // 机顶花瓣
  for (let i = 0; i < 4; i++) {
    const p = plane(0.09, 0.13, basic(pick([PAL.sakura2, PAL.sakura3]), { side: THREE.DoubleSide, opa: 0.95 }),
      rr(-W / 2 + 0.1, W / 2 - 0.1), 0.1 + H + 0.1, rr(-D / 2 + 0.08, D / 2 - 0.08), { rx: -Math.PI / 2, ry: rr(0, 3), cs: false, rs: false });
    g.add(p);
  }
  scene.add(g);
  // 旁边的回收桶
  if (opt.bin !== false) {
    const bg = group(x + Math.sin(ry + Math.PI / 2) * 1.05, 0, z + Math.cos(ry + Math.PI / 2) * 1.05);
    const bin = cyl(0.28, 0.24, 0.85, 10, toon(0x8a9298), 0, 0.43, 0);
    bg.add(bin);
    bg.add(cyl(0.3, 0.3, 0.08, 10, toon(0x4a5158), 0, 0.88, 0, { cs: false }));
    bg.add(cyl(0.2, 0.2, 0.02, 10, toon(0x2e343a), 0, 0.93, 0, { cs: false }));
    scene.add(bg);
  }
  return g;
}
function bodyColCss(hex) { return "#" + hex.toString(16).padStart(6, "0"); }

/* ---------- 电线杆 ---------- */
const _poleWires = [];   // {a:Vector3, b:Vector3, drop} 用于连线
function makeUtilityPole(x, z, opt) {
  opt = opt || {};
  const g = group(x, 0, z);
  const H = 8.6;
  const poleMat = toon(0x8f9194);
  const pole = cyl(0.13, 0.19, H, 9, poleMat, 0, H / 2, 0);
  g.add(pole);
  outline(pole, 0.024);
  // 顶部深色段 + 金属箍
  g.add(cyl(0.125, 0.13, 0.7, 9, toon(0x6c6e72), 0, H - 0.35, 0, { cs: false }));
  g.add(cyl(0.155, 0.155, 0.06, 9, toon(0x5a5c60), 0, 0.55, 0, { cs: false }));
  g.add(cyl(0.15, 0.15, 0.06, 9, toon(0x5a5c60), 0, H - 1.1, 0, { cs: false }));
  // 基部黄黑护套 + 反光条
  g.add(cyl(0.2, 0.21, 1.15, 9, toon(0xe8c53c), 0, 0.58, 0, { cs: false }));
  g.add(cyl(0.215, 0.215, 0.16, 9, toon(0x2e2e30), 0, 0.95, 0, { cs: false }));
  g.add(box(0.05, 0.3, 0.02, basic(0xf2f2ee), 0.2, 1.5, 0.05, { cs: false }));
  // 电线横担
  const armY = H - 0.9;
  const dir = opt.armDir || 0;   // 横担朝向
  g.add(box(2.6, 0.09, 0.09, toon(0x55575c), 0, armY, 0));
  for (const wx of [-1.1, 0, 1.1]) {
    g.add(cyl(0.05, 0.05, 0.14, 6, toon(0x7a828c), wx, armY + 0.1, 0, { cs: false }));
  }
  // 第二横担（低压线）
  g.add(box(2.0, 0.07, 0.07, toon(0x55575c), 0, armY - 0.55, 0, { cs: false }));
  // 变压器
  if (opt.transformer) {
    const tz = opt.tSide || 1;
    g.add(box(1.5, 0.1, 0.5, toon(0x55575c), 0, 6.1, 0, { cs: false }));
    for (const tx of [-0.4, 0.4]) {
      const t = cyl(0.26, 0.26, 0.85, 10, toon(0x9aa0a4), tx, 6.6, tz * 0.3);
      g.add(t);
      g.add(cyl(0.1, 0.1, 0.2, 8, toon(0x777d84), tx, 7.1, tz * 0.3, { cs: false }));
    }
    g.add(box(0.7, 0.5, 0.35, toon(0x8a9094), 0, 5.6, tz * 0.32, { cs: false }));
  }
  // 路灯（下午未点亮）
  if (opt.lamp !== false) {
    const lz = opt.lampDir || 1;
    g.add(box(1.35, 0.08, 0.08, toon(0x55575c), lz * 0.62, 5.55, 0, { cs: false }));
    const head = sph(0.19, toon(0xdfe2e4), lz * 1.25, 5.48, 0, { sy: 0.62, sz: 0.72, cs: false });
    g.add(head);
  }
  // 编号牌
  g.add(box(0.16, 0.22, 0.02, basic(0xf2f2ee), 0.16, 2.1, 0.14, { cs: false }));
  // 附加标志（挂小圆牌 / 反光镜）
  if (opt.mirror) {
    g.add(box(0.7, 0.06, 0.06, toon(0x55575c), 0.35, 3.1, 0, { cs: false }));
    const mir = sph(0.36, toon(0xbfd4de, { emissive: 0x9cc2d4, ei: 0.25 }), 0.7, 2.72, 0, { sy: 0.92, cs: false });
    g.add(mir);
    outline(mir, 0.016, 0xd8dde2);
  }
  scene.add(g);
  // 记录电线挂点（稍后统一连线）
  const wp = { x, z, top: new THREE.Vector3(x, armY + 0.12, z), mid: new THREE.Vector3(x, armY - 0.62, z), opt };
  _poleWires.push(wp);
  return wp;
}

function buildUtilityPoles() {
  const wPts = [], ePts = [];
  wPts.push(makeUtilityPole(4.55, 36, { armDir: 0 }));
  wPts.push(makeUtilityPole(4.55, 22, { transformer: true, tSide: -1 }));
  wPts.push(makeUtilityPole(4.55, 8, {}));
  wPts.push(makeUtilityPole(4.55, -14.5, { mirror: true }));
  wPts.push(makeUtilityPole(4.55, -30, {}));
  wPts.push(makeUtilityPole(4.55, -44, { transformer: true, tSide: 1 }));
  ePts.push(makeUtilityPole(15.45, 29, {}));
  ePts.push(makeUtilityPole(15.45, 15, { transformer: true, tSide: 1 }));
  ePts.push(makeUtilityPole(15.45, 1, {}));
  ePts.push(makeUtilityPole(15.45, -13, {}));
  ePts.push(makeUtilityPole(15.45, -29, { transformer: true, tSide: -1 }));
  ePts.push(makeUtilityPole(15.45, -43, {}));
  // 同侧导线（3 根 + 低压 2 根）
  for (const pts of [wPts, ePts]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const dx of [-1.1, 0, 1.1]) {
        WireBank.sag(new THREE.Vector3(a.x + dx, a.top.y, a.z), new THREE.Vector3(b.x + dx, b.top.y, b.z), 0.42, 10);
      }
      for (const dx of [-0.7, 0.7]) {
        WireBank.sag(new THREE.Vector3(a.x + dx, a.mid.y, a.z), new THREE.Vector3(b.x + dx, b.mid.y, b.z), 0.3, 8);
      }
    }
  }
  // 跨街线
  for (const [za, zb] of [[8, 15], [22, 29]]) {
    const a = wPts.find(p => p.z === za), b = ePts.find(p => p.z === zb);
    for (const dx of [-0.4, 0.5]) {
      WireBank.sag(new THREE.Vector3(a.x + dx, a.mid.y, a.z), new THREE.Vector3(b.x + dx, b.mid.y, b.z), 0.6, 12);
    }
  }
  // 分支入户线
  const drops = [
    [wPts[1], 4.55, 16.5, 4.2], [wPts[2], -3.5, 9.5, 4.0],   // 至咖啡店 / 花店
    [ePts[0], 17.0, 24.5, 4.3], [ePts[2], 17.0, 5.5, 4.5],   // 至店铺
    [wPts[4], -16.0, -34.5, 4.4], [ePts[4], 21.0, -33.0, 4.4], // 至北侧住宅
    [wPts[0], -9.5, 30.5, 5.2], [ePts[1], 21.0, -11.5, 5.2],
  ];
  for (const [pole, hx, hz, hy] of drops) {
    WireBank.sag(new THREE.Vector3(pole.x + 0.6, pole.mid.y + 0.3, pole.z), new THREE.Vector3(hx, hy, hz), 0.5, 9);
  }
  // 与铁路接触网立柱的联络线
  WireBank.sag(new THREE.Vector3(4.55, 6.9, -30), new THREE.Vector3(26, 5.6, -22.3), 0.7, 12);
}

/* ---------- 铁路道口 ---------- */
const _crossLamps = [];  // 交替闪烁的警示灯材质
function buildCrossing() {
  const zS = -17.2, zN = -27.4;
  for (const [z, side] of [[zS, 1], [zN, -1]]) {
    const g = group(L.ROAD.cx, 0, z);
    const dir = side; // 臂伸出方向：南端朝西拦北侧来车…简化：两侧均横跨道路
    // 控制箱
    const boxM = box(0.9, 1.5, 0.55, toon(0xd6d9dc), side * 3.9, 0.75, 0);
    g.add(boxM);
    outline(boxM, 0.022);
    // 交叉形警示标志
    for (const rz of [0.7, -0.7]) {
      const b = box(0.18, 1.5, 0.06, toon(0xf2f2ee), side * 3.9, 2.3, 0.05, { rz });
      g.add(b);
    }
    g.add(plane(0.5, 0.5, basic(0xffffff, { map: canvasTex(128, 128, (c) => {
      c.fillStyle = "#fdfdfd"; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "#c4393c"; c.lineWidth = 9;
      c.strokeRect(8, 8, 112, 112);
      c.fillStyle = "#c4393c"; c.font = `800 46px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("踏切", 64, 50);
      c.font = `700 30px ${FONT_JP}`;
      c.fillText("あり", 64, 96);
    }) }), side * 3.9, 3.35, 0.09, { cs: false }));
    // 警示灯柱 + 两灯
    g.add(cyl(0.07, 0.09, 2.6, 8, toon(0x8a8f94), side * 3.9, 1.3, -0.5, { cs: false }));
    g.add(box(0.5, 0.34, 0.3, toon(0x555a60), side * 3.9, 2.85, -0.5, { cs: false }));
    for (const lx of [-0.13, 0.13]) {
      const lampMat = toon(0xe85a5a, { emissive: 0xff3a3a, ei: 0.0 });
      _crossLamps.push(lampMat);
      g.add(sph(0.11, lampMat, side * 3.9 + lx, 2.85, -0.34, { cs: false }));
    }
    // 遮断杆（放下的黄黑条纹臂）
    const armG = group(side * 3.9, 1.0, -0.5);
    const armLen = 7.4;
    const segN = 10, segL = armLen / segN;
    for (let i = 0; i < segN; i++) {
      const c = i % 2 === 0 ? 0xf2c53c : 0x3a3d42;
      const seg = box(segL * 1.04, 0.11, 0.1, toon(c), -side * (i + 0.5) * segL, 0, 0, { cs: false });
      armG.add(seg);
    }
    // 臂端小灯
    const tipMat = toon(0xe85a5a, { emissive: 0xff4444, ei: 0.85 });
    armG.add(sph(0.07, tipMat, -side * armLen, 0, 0, { cs: false }));
    g.add(armG);
    // 卷轴箱
    g.add(box(0.3, 0.35, 0.4, toon(0x555a60), side * 3.9, 1.05, -0.5, { cs: false }));
    scene.add(g);
  }
  // 行人引导围栏（防止误入）
  for (const [x0, x1, z] of [[6.0, 6.9, -16.2], [13.2, 14.1, -16.2], [6.0, 6.9, -28.4], [13.2, 14.1, -28.4]]) {
    scene.add(box(x1 - x0, 0.06, 0.06, toon(0x9aa2a8), (x0 + x1) / 2, 0.95, z, { cs: false }));
    scene.add(box(x1 - x0, 0.06, 0.06, toon(0x9aa2a8), (x0 + x1) / 2, 0.5, z, { cs: false }));
    for (const px of [x0, x1]) scene.add(cyl(0.035, 0.035, 1.0, 6, toon(0x9aa2a8), px, 0.5, z, { cs: false }));
  }
  // 警报器箱
  const alarm = box(0.5, 0.7, 0.35, toon(0xb0b6ba), 5.6, 2.4, -17.0, { cs: false });
  scene.add(alarm);
  scene.add(cyl(0.06, 0.06, 2.4, 6, toon(0x8a8f94), 5.6, 1.2, -17.0, { cs: false }));
  // 小型控制箱（轨旁）
  scene.add(box(0.8, 1.1, 0.5, toon(0x8fa398), 4.9, 0.55, -28.6));
}

/* ---------- 交通标志 ---------- */
function signBoard(w, h, drawFn, x, y, z, ry, opt) {
  opt = opt || {};
  const tex = canvasTex(opt.pw || 256, opt.ph || 256, drawFn);
  const g = group(x, 0, z, ry);
  g.add(box(0.07, y, 0.07, toon(0x77797d), 0, y / 2, -0.02, { cs: false }));
  const bd = plane(w, h, basic(0xffffff, { map: tex }), 0, y, 0, { cs: false });
  g.add(bd);
  if (opt.double) {
    const bd2 = plane(w, h, basic(0xffffff, { map: tex }), 0, y, -0.045, { ry: Math.PI, cs: false });
    g.add(bd2);
  }
  scene.add(g);
  return g;
}

function buildSigns() {
  // 蓝色路名牌
  signBoard(1.5, 0.45, (c, w, h) => {
    c.fillStyle = "#2e6cb0"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#fff"; c.lineWidth = 6; c.strokeRect(7, 7, w - 14, h - 14);
    c.fillStyle = "#fff"; c.font = `700 52px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("さくら通り", w / 2, h / 2 - 12);
    c.font = `500 26px ${FONT_JP}`;
    c.fillText("SAKURA-DORI", w / 2, h / 2 + 30);
  }, 6.0, 2.7, 3.2, 0, { pw: 512, ph: 160 });
  // 限速 40
  signBoard(0.55, 0.55, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#fdfdfd"; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
    c.strokeStyle = "#c4393c"; c.lineWidth = 14; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke();
    c.fillStyle = "#22304a"; c.font = `800 56px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("40", 64, 66);
  }, 14.9, 2.5, -9.0, 0, {});
  // 禁止停车
  signBoard(0.5, 0.5, (c) => {
    c.fillStyle = "#2e6cb0"; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
    c.strokeStyle = "#c4393c"; c.lineWidth = 12; c.beginPath(); c.arc(64, 64, 42, 0, 7); c.stroke();
    c.strokeStyle = "#c4393c"; c.lineWidth = 10;
    c.beginPath(); c.moveTo(26, 102); c.lineTo(102, 26); c.stroke();
  }, 6.1, 2.45, 24.0, 0, {});
  // 通学路（黄色）
  signBoard(0.62, 0.5, (c, w, h) => {
    c.fillStyle = "#f6c93c"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#3a3d42"; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = "#2a2e34"; c.font = `700 46px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("通学路", w / 2, h / 2);
  }, 13.5, 2.6, 8.5, Math.PI, { pw: 384, ph: 320 });
  // 巴士站牌
  signBoard(0.55, 1.1, (c, w, h) => {
    c.fillStyle = "#fdfdfd"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2e6cb0"; c.fillRect(0, 0, w, 66);
    c.fillStyle = "#fff"; c.font = `700 30px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("バスのりば", w / 2, 44);
    c.fillStyle = "#2a2e34"; c.font = `600 27px ${FONT_JP}`;
    c.fillText("さくら循環", w / 2, 130);
    c.fillText("東廻り", w / 2, 175);
    c.fillStyle = "#e8873c"; c.fillRect(14, 220, w - 28, 40);
    c.fillStyle = "#fff"; c.font = `700 24px ${FONT_JP}`;
    c.fillText("1", w / 2, 248);
  }, 14.7, 2.6, -1.5, 0, { pw: 192, ph: 384 });
  // 出租车候车
  signBoard(0.6, 0.4, (c, w, h) => {
    c.fillStyle = "#f6c93c"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#2a2e34"; c.font = `700 34px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("タクシー", w / 2, h / 2 - 10);
    c.fillText("のりば", w / 2, h / 2 + 22);
  }, 7.5, 2.35, -7.6, -0.4, { pw: 256, ph: 180 });
}

/* ---------- 站前广场设备 ---------- */
function buildSquareProps() {
  // 站前地图牌
  const mapTex = canvasTex(512, 384, (c, w, h) => {
    c.fillStyle = "#f4f0e4"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#8a8478"; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = "#2a2e34"; c.font = `700 34px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("駅前案内図", w / 2, 46);
    c.strokeStyle = "#c8c2b2"; c.lineWidth = 14;
    c.beginPath(); c.moveTo(60, 340); c.lineTo(60, 120); c.lineTo(452, 120); c.stroke();
    c.strokeStyle = "#f0a2b8"; c.lineWidth = 10;
    c.beginPath(); c.moveTo(40, 260); c.lineTo(472, 260); c.stroke();
    c.fillStyle = "#8fb8d8";
    c.fillRect(90, 150, 80, 60); c.fillRect(210, 150, 90, 60); c.fillRect(340, 150, 80, 60);
    c.fillRect(90, 300, 80, 26); c.fillRect(340, 300, 80, 26);
    c.fillStyle = "#c2557e"; c.font = `700 26px ${FONT_JP}`;
    c.fillText("桜ヶ丘駅", 256, 266);
  });
  const mapG = group(3.4, 0, -6.9, 0.15);
  mapG.add(box(1.7, 1.25, 0.08, toon(0x6a7a6a), 0, 1.45, 0));
  mapG.add(plane(1.6, 1.15, basic(0xffffff, { map: mapTex }), 0, 1.45, 0.05, { cs: false }));
  mapG.add(box(0.08, 0.9, 0.08, toon(0x5a6a5a), -0.7, 0.45, 0, { cs: false }));
  mapG.add(box(0.08, 0.9, 0.08, toon(0x5a6a5a), 0.7, 0.45, 0, { cs: false }));
  scene.add(mapG);
  // 社区公告栏
  const noG = group(-9.2, 0, -6.6, 0.1);
  noG.add(box(1.9, 1.3, 0.1, toon(0x7a5f46), 0, 1.4, 0));
  noG.add(box(1.7, 1.1, 0.04, toon(0xf2efe6), 0, 1.4, 0.06, { cs: false }));
  for (let i = 0; i < 4; i++) {
    noG.add(plane(0.5, 0.68, basic(pick([0xffffff, 0xfdf6d8, 0xeef4f8])), -0.6 + (i % 2) * 1.0, 1.62 - Math.floor(i / 2) * 0.72, 0.09, { ry: rr(-0.05, 0.05), cs: false }));
  }
  noG.add(box(0.08, 0.8, 0.08, toon(0x5f4a38), -0.8, 0.4, 0, { cs: false }));
  noG.add(box(0.08, 0.8, 0.08, toon(0x5f4a38), 0.8, 0.4, 0, { cs: false }));
  scene.add(noG);
  // 公共电话亭
  const ph = group(5.6, 0, -6.6, Math.PI / 2);
  const frameMat = toon(0xa8b8ae);
  ph.add(box(0.1, 2.3, 0.1, frameMat, -0.48, 1.15, -0.48, { cs: false }));
  ph.add(box(0.1, 2.3, 0.1, frameMat, 0.48, 1.15, -0.48, { cs: false }));
  ph.add(box(0.1, 2.3, 0.1, frameMat, -0.48, 1.15, 0.48, { cs: false }));
  ph.add(box(0.1, 2.3, 0.1, frameMat, 0.48, 1.15, 0.48, { cs: false }));
  ph.add(box(1.1, 0.35, 1.1, toon(0x3a5a4a), 0, 2.5, 0, { cs: false }));
  ph.add(plane(0.86, 1.7, toon(0x9db8c6, { opa: 0.3 }), 0, 1.25, -0.5, { cs: false }));
  ph.add(plane(0.86, 1.7, toon(0x9db8c6, { opa: 0.3 }), -0.5, 1.25, 0, { ry: Math.PI / 2, cs: false }));
  ph.add(box(0.5, 0.7, 0.16, toon(0x37414b), 0, 1.35, 0.38, { cs: false }));
  ph.add(box(0.4, 0.24, 0.05, toon(0x22303c), 0, 1.45, 0.46, { cs: false }));
  scene.add(ph);
  // 红色邮筒
  const mb = group(6.5, 0, -3.8, -0.3);
  const redMat = toon(0xc23a3a);
  const bodyM = cyl(0.32, 0.34, 1.05, 12, redMat, 0, 0.53, 0);
  mb.add(bodyM);
  outline(bodyM, 0.018);
  mb.add(sph(0.33, redMat, 0, 1.1, 0, { sy: 0.55, cs: false }));
  mb.add(box(0.05, 0.03, 0.3, toon(0x2a2e34), 0, 1.18, 0.28, { cs: false }));
  const markTex = canvasTex(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.fillStyle = "#fff"; c.font = `800 44px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("〒", 32, 34);
  });
  mb.add(plane(0.26, 0.26, basic(0xffffff, { map: markTex, opa: 0.95 }), 0, 0.72, 0.325, { cs: false }));
  mb.add(cyl(0.4, 0.42, 0.1, 12, toon(0x2e3238), 0, 0.05, 0, { cs: false }));
  scene.add(mb);
  // 矮柱 + 链条（广场边缘）
  const posts = [];
  for (const bz of [-7.2, -4.2, -1.2, 1.8]) {
    const p = cyl(0.07, 0.09, 0.78, 8, toon(0xe8e4d8), 6.75, 0.39, bz);
    scene.add(p);
    scene.add(cyl(0.075, 0.075, 0.1, 8, toon(0xe8873c), 6.75, 0.72, bz, { cs: false }));
    posts.push(new THREE.Vector3(6.75, 0.66, bz));
  }
  for (let i = 0; i < posts.length - 1; i++) {
    WireBank.sag(posts[i], posts[i + 1], 0.1, 6);
  }
  // 扭蛋机 ×2
  for (const [gx, gz, col] of [[5.7, 1.4, 0xd9585a], [6.35, 0.7, 0x4d7fc4]]) {
    const gch = group(gx, 0, gz, -0.2);
    gch.add(box(0.5, 0.75, 0.45, toon(0xf0f0ec), 0, 0.38, 0));
    gch.add(sph(0.2, toon(col, { opa: 0.85 }), 0, 0.92, 0, { sy: 0.85, cs: false }));
    gch.add(box(0.3, 0.12, 0.1, toon(0x3a3f45), 0, 0.55, 0.22, { cs: false }));
    outline(gch.children[0], 0.014);
    scene.add(gch);
  }
  // 花坛 ×2
  for (const [fx, fz] of [[-5.2, 1.4], [4.0, -7.8]]) {
    const bed = group(fx, 0, fz);
    const ringN = 12;
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2;
      bed.add(box(0.52, 0.32, 0.26, toon(0xa85a48), Math.cos(a) * 1.42, 0.16, Math.sin(a) * 1.42, { ry: -a }));
    }
    bed.add(cyl(1.3, 1.3, 0.1, 16, toon(0x4a3f34), 0, 0.28, 0, { cs: false }));
    const tulips = [0xe85a5a, 0xf6c93c, 0xc86ae8, 0xfafafa, 0xf09a5a];
    for (let i = 0; i < 14; i++) {
      const a = rr(0, Math.PI * 2), r = rr(0.15, 1.05);
      const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
      bed.add(cyl(0.02, 0.02, rr(0.25, 0.4), 4, toon(0x5a8a4a), tx, 0.5, tz, { cs: false }));
      const fc = pick(tulips);
      bed.add(sph(0.075, toon(fc), tx, 0.68, tz, { sy: 1.5, cs: false }));
    }
    scene.add(bed);
  }
}

/* ---------- 长椅 / 垃圾桶 / 自行车 / 汽车 ---------- */
function makeBench(x, z, ry, col, y) {
  const g = group(x, y || 0, z, ry);
  const woodMat = toon(col || 0x2e5a46);
  const legMat = toon(0x3a3f45);
  g.add(box(1.8, 0.07, 0.5, woodMat, 0, 0.44, 0));
  g.add(box(1.8, 0.45, 0.06, woodMat, 0, 0.72, -0.24, { rx: -0.18 }));
  for (const lx of [-0.75, 0.75]) {
    g.add(box(0.07, 0.44, 0.42, legMat, lx, 0.22, 0, { cs: false }));
  }
  outline(g.children[0], 0.014);
  scene.add(g);
  return g;
}
function makeTrashCan(x, y, z, ry) {
  const g = group(x, y, z, ry || 0);
  const b = cyl(0.26, 0.22, 0.8, 10, toon(0x6a7178), 0, 0.4, 0);
  g.add(b);
  g.add(cyl(0.28, 0.28, 0.07, 10, toon(0x4a5056), 0, 0.84, 0, { cs: false }));
  g.add(box(0.3, 0.02, 0.14, toon(0x2e343a), 0, 0.885, 0.1, { cs: false }));
  outline(b, 0.014);
  scene.add(g);
  return g;
}
/** 自行车（可复用） */
function makeBike(col) {
  const g = group();
  const m = toon(col);
  const tireMat = toon(0x2e3238);
  for (const wx of [-0.52, 0.52]) {
    const wh = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.032, 8, 20), tireMat);
    wh.position.set(wx, 0.31, 0);
    wh.rotation.y = Math.PI / 2;
    wh.castShadow = true;
    g.add(wh);
    g.add(cyl(0.05, 0.05, 0.06, 8, toon(0x8a9298), wx, 0.31, 0, { rx: Math.PI / 2, cs: false }));
  }
  // 车架
  g.add(box(0.06, 0.06, 0.85, m, 0, 0.52, 0, { rx: 0.12 }));
  g.add(cyl(0.028, 0.028, 0.6, 6, m, -0.18, 0.48, 0.05, { rx: 0.9, cs: false }));
  g.add(cyl(0.028, 0.028, 0.62, 6, m, 0.2, 0.46, -0.06, { rx: -0.85, cs: false }));
  // 车把 / 车座
  g.add(box(0.44, 0.04, 0.04, toon(0x3a3f45), -0.34, 0.98, 0.06, { cs: false }));
  g.add(box(0.22, 0.05, 0.1, toon(0x2a2622), 0.32, 0.92, -0.04, { cs: false }));
  // 前篮
  const basket = box(0.3, 0.22, 0.26, toon(0xd8d4c8, { wireframe: false }), -0.4, 0.78, 0.06);
  g.add(basket);
  outline(basket, 0.012, 0x9a968c);
  // 脚撑（倾斜靠放由外部旋转）
  g.rotation.z = 0.1;
  return g;
}
function placeBikes() {
  const spots = [
    [0.4, 2.1, 0.3, 0xc47a3a], [1.3, 2.05, 0.25, 0x3a6ac4], [2.2, 2.0, 0.3, 0x4a8a5a], [3.1, 2.05, 0.2, 0xd8d4c8],  // 广场车棚
    [15.0, 6.0, Math.PI / 2 + 0.1, 0x8a5ac4], [15.1, 6.9, Math.PI / 2, 0xd0a83a], [14.9, 7.8, Math.PI / 2 - 0.1, 0x5a8ac4], // 便利店前
    [4.0, -8.8, 0.5, 0xc45a5a], [3.0, -9.1, 0.4, 0x3ac4a8],   // 车站东侧
    [6.6, 23.3, 1.9, 0x3a6ac4], [5.8, 23.1, 2.1, 0xd8d4c8],   // 前景贩卖机旁
  ];
  for (const [x, z, ry, c] of spots) {
    const b = makeBike(c);
    b.position.set(x, 0.1, z);
    b.rotation.y = ry + rr(-0.15, 0.15);
    scene.add(b);
  }
  // 自行车停放架
  for (const [rx, rz, len, ang] of [[1.75, 2.05, 3.6, 0], [15.0, 6.9, 2.8, Math.PI / 2]]) {
    const r = box(len, 0.05, 0.5, toon(0x8a9298), rx, 0.14, rz, { ry: ang, cs: false });
    scene.add(r);
  }
}
/** 轻自动车 / 小型面包车 */
function makeKeiCar(x, z, ry, col, opt) {
  opt = opt || {};
  const g = group(x, 0, z, ry);
  const bodyMat = toon(col);
  const body = box(1.45, 0.85, 2.5, bodyMat, 0, 0.62, 0);
  g.add(body);
  outline(body, 0.03);
  const cabin = box(1.38, 0.72, 1.5, bodyMat, 0, 1.32, 0.1);
  g.add(cabin);
  outline(cabin, 0.026);
  // 车窗
  const glass = toon(0x7e99ac, { opa: 0.75 });
  g.add(box(1.42, 0.5, 1.2, glass, 0, 1.35, 0.12, { cs: false }));
  g.add(box(1.3, 0.5, 0.06, toon(0xf4f2ee), 0, 1.28, -0.66, { cs: false }));  // 后窗偏白
  // 保险杠 / 车灯
  g.add(box(1.5, 0.18, 0.12, toon(0x3a3f45), 0, 0.35, 1.26, { cs: false }));
  g.add(box(1.5, 0.18, 0.12, toon(0x3a3f45), 0, 0.35, -1.26, { cs: false }));
  g.add(box(0.3, 0.12, 0.05, toon(0xfff6d8, { emissive: 0xffeeb0, ei: 0.55 }), -0.5, 0.72, 1.26, { cs: false }));
  g.add(box(0.3, 0.12, 0.05, toon(0xfff6d8, { emissive: 0xffeeb0, ei: 0.55 }), 0.5, 0.72, 1.26, { cs: false }));
  g.add(box(0.28, 0.12, 0.05, toon(0xc43a3a, { emissive: 0xd84a4a, ei: 0.35 }), -0.5, 0.72, -1.27, { cs: false }));
  g.add(box(0.28, 0.12, 0.05, toon(0xc43a3a, { emissive: 0xd84a4a, ei: 0.35 }), 0.5, 0.72, -1.27, { cs: false }));
  // 黄色号牌（轻自动车）
  g.add(plane(0.26, 0.13, basic(0xf6c93c), 0, 0.5, 1.32, { cs: false }));
  // 车轮
  for (const [wx, wz] of [[-0.72, 0.78], [0.72, 0.78], [-0.72, -0.78], [0.72, -0.78]]) {
    g.add(cyl(0.26, 0.26, 0.14, 12, toon(0x2a2e33), wx, 0.27, wz, { rz: Math.PI / 2, cs: false }));
    g.add(cyl(0.12, 0.12, 0.15, 8, toon(0xb8bcc0), wx, 0.27, wz, { rz: Math.PI / 2, cs: false }));
  }
  if (opt.waiting) {
    // 等待通行：刹车灯亮
  }
  scene.add(g);
  return g;
}

/* ---------- 街道小物动画登记 ---------- */
const _wavingFlags = [];

/* ---------- 街角小物 ---------- */
function buildStreetLife() {
  // 站台长椅 ×3（背靠站房，面向轨道）
  makeBench(-26, -16.1, 0, 0x2e5a46, L.PLAT.y);
  makeBench(-14.5, -16.1, 0, 0x2e5a46, L.PLAT.y);
  makeBench(-3, -16.1, 0, 0x2e5a46, L.PLAT.y);
  // 长椅上的书 + 饮料罐
  scene.add(box(0.22, 0.03, 0.3, toon(0xf4f2ea), -14.9, 1.49, -16.05, { ry: 0.4, cs: false }));
  scene.add(box(0.2, 0.02, 0.28, toon(0xc2557e), -14.9, 1.52, -16.05, { ry: 0.4, cs: false }));
  scene.add(cyl(0.033, 0.033, 0.12, 10, toon(0x5a9ae8), -13.9, 1.5, -16.1, { cs: false }));
  // 站台垃圾桶 ×2
  makeTrashCan(-20.5, 1.02, -17.5, 0);
  makeTrashCan(-1.5, 1.02, -17.5, 0);
  // 广场长椅（樱花树下环形座椅中的一段 + 杂物）
  makeBench(-4.9, 0.9, 2.4, 0x8a6a4f);
  scene.add(box(0.32, 0.24, 0.2, toon(0x9a5a4a), -4.6, 1.02, 0.62, { ry: 0.4, cs: false }));   // 购物袋
  scene.add(cyl(0.036, 0.036, 0.11, 10, toon(0xf2c53c), -5.3, 0.95, 0.5, { cs: false }));      // 没喝完的饮料
  // 广场垃圾分类桶
  makeTrashCan(2.6, 0.1, -0.6, 0);
  // 轻自动车
  makeKeiCar(16.6, 11.5, Math.PI / 2, 0xf4f2ee);
  makeKeiCar(9.0, -13.0, 0.06, 0xd8e2e8, { waiting: true });   // 等待道口的汽车
  // 停车场内的车 ×2
  makeKeiCar(-2.0, 7.6, 0, 0xf4f2ee);
  makeKeiCar(-2.0, 11.2, 0.03, 0x9fb4c2);
  // 交通锥 + 灭火器箱 + 防灾柜
  const cone = group(12.4, 0, -12.2);
  cone.add(cyl(0.16, 0.2, 0.04, 10, toon(0xe8642a), 0, 0.02, 0, { cs: false }));
  cone.add(cyl(0.03, 0.13, 0.42, 10, toon(0xe8642a), 0, 0.24, 0, { cs: false }));
  cone.add(cyl(0.045, 0.045, 0.05, 8, toon(0xf2f2ee), 0, 0.26, 0, { cs: false }));
  scene.add(cone);
  scene.add(box(0.4, 0.6, 0.2, toon(0xc23a3a), 15.72, 1.0, 9.0, { ry: Math.PI / 2 }));
  scene.add(box(0.6, 0.9, 0.3, toon(0x9aa8a0), 17.2, 0.45, 13.2));
  // 地藏石像（道口旁）
  const jizo = group(15.4, 0, -30.6, -0.4);
  jizo.add(cyl(0.22, 0.26, 0.55, 10, toon(0x9a9c98), 0, 0.28, 0));
  jizo.add(sph(0.17, toon(0xa8aaa6), 0, 0.62, 0, { cs: false }));
  const bib = cyl(0.17, 0.2, 0.18, 10, toon(0xc23a3a), 0, 0.42, 0);
  jizo.add(bib);
  jizo.add(box(0.3, 0.04, 0.3, toon(0x8a8c88), 0, 0.03, 0, { cs: false }));
  for (let i = 0; i < 5; i++) {
    jizo.add(sph(rr(0.05, 0.09), toon(0x8e908c), rr(-0.3, 0.3), 0.05, rr(-0.25, 0.3), { cs: false }));
  }
  outline(jizo.children[0], 0.014);
  scene.add(jizo);
  // 招财猫（和菓子店门口）
  const neko = group(17.5, 0, 15.4, Math.PI / 2);
  neko.add(box(0.26, 0.24, 0.2, toon(0xf4f2ea), 0, 0.12, 0));
  neko.add(box(0.2, 0.17, 0.18, toon(0xf4f2ea), 0, 0.31, 0.01));
  neko.add(box(0.05, 0.06, 0.03, toon(0xf4f2ea), -0.08, 0.41, 0.01, { rz: 0.3 }));
  neko.add(box(0.05, 0.06, 0.03, toon(0xf4f2ea), 0.08, 0.41, 0.01, { rz: -0.3 }));
  neko.add(box(0.04, 0.14, 0.04, toon(0xf4d8a8), 0.1, 0.36, 0.02, { rz: -0.6 }));  // 招手前爪
  neko.add(box(0.1, 0.02, 0.06, toon(0xc23a3a), 0, 0.2, 0.11, { cs: false }));
  scene.add(neko);
  // 鲷鱼烧宣传旗（咖啡店街角）
  const taiTex = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = "#e8944a"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#7a4a1a"; c.font = `700 40px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("たい", w / 2, 84); c.fillText("焼き", w / 2, 132);
    c.fillStyle = "#5a3410";
    c.beginPath(); c.ellipse(w / 2, 200, 34, 24, 0, 0, 7); c.fill();
  });
  scene.add(cyl(0.025, 0.025, 3.6, 6, toon(0x9a9a94), 4.9, 1.8, 5.4, { cs: false }));
  const taiFlag = plane(0.7, 1.4, basic(0xffffff, { map: taiTex, side: THREE.DoubleSide }), 5.25, 2.7, 5.4, { ry: Math.PI / 2.3, cs: false });
  scene.add(taiFlag);
  _wavingFlags.push(taiFlag);
  // 里程牌 + 轨旁设备箱
  const mileTex = canvasTex(96, 96, (c) => {
    c.fillStyle = "#f4f4ee"; c.fillRect(0, 0, 96, 96);
    c.strokeStyle = "#2a2e34"; c.lineWidth = 5; c.strokeRect(4, 4, 88, 88);
    c.fillStyle = "#2a2e34"; c.font = `700 34px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("12", 48, 36); c.fillText("4370", 48, 68);
  });
  scene.add(plane(0.34, 0.34, basic(0xffffff, { map: mileTex }), -24, 0.9, -27.9, { cs: false }));
  scene.add(box(0.1, 1.0, 0.1, toon(0x8a8f94), -24, 0.5, -27.98, { cs: false }));
  scene.add(box(1.3, 1.05, 0.55, toon(0x8fa398), -18, 0.53, -27.7));
  scene.add(box(1.0, 0.85, 0.5, toon(0x9aa8a0), -4, 0.43, -27.8));
  // 电缆槽（低矮长条）
  scene.add(box(70, 0.16, 0.3, toon(0x77797d), -20, 0.08, -28.1, { cs: false }));
  // 铁路信号灯（站台东端）
  const sig = group(6.6, 0, -19.6, Math.PI / 2);
  sig.add(cyl(0.06, 0.08, 2.3, 8, toon(0x4a5056), 0, 1.15, 0, { cs: false }));
  sig.add(box(0.34, 0.72, 0.28, toon(0x3a4046), 0, 2.5, 0, { cs: false }));
  sig.add(sph(0.085, toon(0x5a2a2a), 0, 2.72, 0.15, { cs: false }));
  sig.add(sph(0.085, toon(0x3adf7a, { emissive: 0x35c86e, ei: 0.9 }), 0, 2.42, 0.15, { cs: false }));
  sig.add(box(0.5, 0.1, 0.1, toon(0x4a5056), 0, 1.9, 0, { cs: false }));
  scene.add(sig);
  // 便利店旁的塑料筐和纸箱
  scene.add(box(0.5, 0.3, 0.36, toon(0x4a8ac4), 15.9, 0.2, 12.6, { ry: 0.3 }));
  scene.add(box(0.42, 0.3, 0.32, toon(0xb08a5a), 16.4, 0.35, 12.9, { ry: -0.2, cs: false }));
  // 咖啡店门口水桶
  scene.add(cyl(0.16, 0.13, 0.26, 10, toon(0x8aa8b8), 4.6, 0.13, 11.6, { cs: false }));
}

/* ---------- 汇总 ---------- */
function buildAllStreet() {
  buildUtilityPoles();
  buildCrossing();
  buildSigns();
  buildSquareProps();
  buildStreetLife();
  placeBikes();
  // 自动贩卖机 ×5（站前广场 / 站台 / 便利店旁 / 道口北 / 前景街角）
  makeVending(-0.8, 0.6, 0, 0xd9585a, { seed: 0 });
  makeVending(-24, -17.55, 0, 0x4d7fc4, { seed: 1, bin: false, y: L.PLAT.y });
  makeVending(15.95, 0.6, -Math.PI / 2, 0xf0f2ee, { seed: 2 });
  makeVending(14.9, -29.6, 0, 0x69a97e, { seed: 3 });
  makeVending(5.9, 24.5, Math.PI / 2, 0xd9585a, { seed: 4 });
}
