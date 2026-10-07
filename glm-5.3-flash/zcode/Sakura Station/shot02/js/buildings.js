/* ============================================================
 * buildings.js — 车站 / 站台 / 日式住宅 / 商店街
 * ============================================================ */
"use strict";

/* ---------- 屋顶构建 ---------- */
/** 双坡屋顶：三角形棱柱，山墙朝 ±Z */
function gableRoof(w, d, h, mat, opt) {
  opt = opt || {};
  const ov = opt.ov === undefined ? 0.28 : opt.ov;
  const shape = new THREE.Shape();
  shape.moveTo(-(d / 2 + ov), 0);
  shape.lineTo(d / 2 + ov, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + ov * 2, bevelEnabled: false });
  geo.translate(0, 0, -(w + ov * 2) / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/** 四坡屋顶：四棱锥（近似） */
function hipRoof(w, d, h, mat) {
  const geo = new THREE.ConeGeometry(1, 1, 4);
  geo.rotateY(Math.PI / 4);
  geo.scale(w / 1.414, h, d / 1.414);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- 窗户单元 ---------- */
function windowUnit(w, h, opt) {
  opt = opt || {};
  const g = group();
  const frameMat = toon(opt.frame || 0x45484e);
  g.add(box(w + 0.12, h + 0.12, 0.1, frameMat, 0, 0, 0));
  const glassCol = opt.warm ? 0xe9e2d0 : (opt.glass || 0x46545e);
  const glass = plane(w, h, toon(glassCol), 0, 0, 0.06);
  g.add(glass);
  if (opt.curtain) {
    g.add(plane(w * 0.96, h * rr(0.4, 0.7), toon(pick([0xf2ede2, 0xf7e8e0, 0xdce8ee])), 0, h * 0.16, 0.075));
  }
  if (opt.visor) {
    const v = box(w + 0.2, 0.03, 0.26, toon(0x53565c), 0, h / 2 + 0.14, 0.16, { rx: 0.35 });
    g.add(v);
  }
  return g;
}

/* ---------- 程序化日式住宅 ---------- */
const WALLS = [PAL.wallCream, PAL.wallWhite, PAL.wallBlue, PAL.wallBeige, 0xdfe3d8, 0xefe0cf];
const ROOFS = [PAL.roofGray, PAL.roofBlue, PAL.roofGreen, PAL.roofDark];
/**
 * opts: { x,z,ry, w,d, floors, wall, roof, roofType:'gable'|'hip', fence:'block'|'wood'|'hedge'|'metal'|null }
 */
function makeHouse(o) {
  const g = group(o.x, 0, o.z, o.ry || 0);
  const w = o.w, d = o.d;
  const floors = o.floors || 2;
  const h1 = 2.7, h2 = 2.5;
  const bodyH = floors === 1 ? 3.2 : h1 + h2;
  const wallMat = toon(o.wall || pick(WALLS));
  const roofMat = toon(o.roof || pick(ROOFS));
  const trimMat = toon(0x5a5c62);

  // 墙体（分楼层微色差）
  if (floors === 1) {
    g.add(box(w, 3.2, d, wallMat, 0, 1.6, 0));
  } else {
    g.add(box(w, h1, d, wallMat, 0, h1 / 2, 0));
    g.add(box(w * 0.995, h2, d * 0.99, toon(o.wall2 || o.wall || 0xffffff), 0, h1 + h2 / 2, 0));
  }
  // 勒脚
  g.add(box(w + 0.1, 0.28, d + 0.1, toon(0x8e8f8a), 0, 0.14, 0));

  // 屋顶
  const roofH = o.roofH || rr(1.0, 1.5);
  const roof = o.roofType === "hip" ? hipRoof(w, d, roofH, roofMat) : gableRoof(w, d, roofH, roofMat);
  roof.position.y = bodyH;
  g.add(roof);
  // 屋檐封板（清晰檐口厚度）
  g.add(box(w + 0.62, 0.16, d + 0.62, trimMat, 0, bodyH - 0.02, 0, { cs: false }));
  if (o.roofType !== "hip") {
    g.add(box(w + 0.7, 0.1, 0.14, toon(0x3f4147), 0, bodyH + roofH + 0.03, 0, { cs: false }));
  }
  // 雨水管
  const pipeX = w / 2 - 0.35;
  g.add(cyl(0.045, 0.045, bodyH, 6, trimMat, pipeX, bodyH / 2, d / 2 + 0.12, { cs: false }));

  // 窗户（正面 +Z 朝向由 ry 控制）
  const winH1 = 1.15, winH2 = 1.0;
  const side = d / 2 + 0.06;
  const win1 = windowUnit(rr(1.1, 1.5), winH1, { curtain: rng() < 0.7, visor: rng() < 0.4 });
  win1.position.set(-w * 0.22, 1.55, side); g.add(win1);
  if (w > 5.5) {
    const win1b = windowUnit(rr(1.0, 1.3), winH1, { warm: rng() < 0.35, curtain: rng() < 0.5 });
    win1b.position.set(w * 0.25, 1.55, side); g.add(win1b);
  }
  // 大门
  const doorW = 0.95, doorH = 2.0;
  const door = box(doorW, doorH, 0.1, toon(pick([0x5d4a3a, 0x4a5058, 0x6b5a48])), -w * 0.05, doorH / 2, side + 0.02);
  g.add(door);
  // 北墙窗（面向主街与车站方向）
  const winN = windowUnit(rr(1.1, 1.5), floors === 1 ? 1.0 : 1.05, { warm: rng() < 0.5, curtain: rng() < 0.6 });
  winN.position.set(w * rr(-0.1, 0.25), floors === 1 ? 1.75 : 1.55, -side);
  winN.rotation.y = Math.PI;
  g.add(winN);
  // 玄关雨棚
  const porch = box(1.7, 0.09, 0.9, toon(0x7b7e84), -w * 0.05, doorH + 0.42, side + 0.42, { rx: 0.16 });
  g.add(porch);
  g.add(box(0.05, 0.5, 0.05, trimMat, -w * 0.05 + 0.75, doorH + 0.2, side + 0.8, { cs: false }));
  g.add(box(0.05, 0.5, 0.05, trimMat, -w * 0.05 - 0.75, doorH + 0.2, side + 0.8, { cs: false }));
  // 门灯
  const lampMat = toon(0xffe9b8, { emissive: 0xffd98f, ei: 0.85 });
  g.add(sph(0.07, lampMat, -w * 0.05 - 0.72, doorH + 0.1, side + 0.14, { cs: false }));
  // 门牌 + 邮箱
  g.add(box(0.3, 0.1, 0.04, toon(0xf4f2ea), -w * 0.05 + 0.72, 1.7, side + 0.04, { cs: false }));
  g.add(box(0.26, 0.16, 0.1, toon(0x8a4a42), -w * 0.05 + 0.72, 1.42, side + 0.05, { cs: false }));

  if (floors === 2) {
    const win2 = windowUnit(rr(1.1, 1.6), winH2, { curtain: rng() < 0.8, visor: rng() < 0.5 });
    win2.position.set(w * 0.2, h1 + 1.4, d / 2 * 0.985 + 0.06);
    g.add(win2);
    // 阳台 + 晾晒
    if (o.balcony !== false) {
      const bW = w * 0.44;
      g.add(box(bW, 0.1, 0.85, toon(0x9aa0a4), w * 0.2, h1 + 0.82, d / 2 + 0.42, { cs: false }));
      g.add(box(bW, 0.05, 0.05, trimMat, w * 0.2, h1 + 1.5, d / 2 + 0.8, { cs: false }));
      g.add(box(bW, 0.05, 0.05, trimMat, w * 0.2, h1 + 1.0, d / 2 + 0.8, { cs: false }));
      for (let i = 0; i <= 4; i++) {
        g.add(box(0.04, 0.55, 0.04, trimMat, w * 0.2 - bW / 2 + i * bW / 4, h1 + 1.25, d / 2 + 0.8, { cs: false }));
      }
      // 白衬衫 / 床单
      const clothMat = toon(0xf6f4ee, { side: THREE.DoubleSide });
      const nSheets = ri(1, 3);
      for (let i = 0; i < nSheets; i++) {
        const sh = plane(rr(0.4, 0.85), rr(0.55, 0.9), clothMat,
          w * 0.2 - bW / 2 + rr(0.15, bW - 0.15), h1 + 1.28, d / 2 + 0.82, { ry: rr(-0.15, 0.15), cs: false, rs: false });
        g.add(sh);
      }
    }
  }
  // 空调外机
  if (rng() < 0.8) {
    const ac = box(0.62, 0.5, 0.28, toon(0xcfd2d4), -w / 2 - 0.16, rr(1.0, 2.4), d * rr(-0.2, 0.2), { rz: 0 });
    ac.rotation.y = Math.PI / 2;
    g.add(ac);
    g.add(cyl(0.16, 0.16, 0.02, 12, toon(0x4a4d52), -w / 2 - 0.32, ac.position.y, ac.position.z, { rx: Math.PI / 2, cs: false }));
  }
  // 屋顶电视天线
  if (rng() < 0.6) {
    const ax = rr(-w * 0.3, w * 0.3);
    g.add(cyl(0.02, 0.02, 1.6, 4, trimMat, ax, bodyH + roofH * 0.7 + 0.8, 0, { cs: false }));
    g.add(box(0.9, 0.02, 0.02, trimMat, ax, bodyH + roofH * 0.7 + 1.35, 0, { cs: false }));
    g.add(box(0.6, 0.02, 0.02, trimMat, ax, bodyH + roofH * 0.7 + 1.15, 0, { cs: false }));
  }
  // 门口盆栽
  const potMat = toon(pick([0xb56a50, 0x8b6a4f, 0x9a9a94]));
  for (const px of [-w * 0.05 - 1.2, -w * 0.05 + 1.25]) {
    if (rng() < 0.75) {
      g.add(cyl(0.16, 0.12, 0.3, 8, potMat, px, 0.15, side + 0.5));
      g.add(sph(0.22, toon(PAL.leafDark), px, 0.45, side + 0.5, { sy: 1.25 }));
    }
  }

  // 围墙
  if (o.fence !== null) {
    const fMat = toon(0xb9b4a8);
    const fw = w + 1.6, fd = d * 0.5 + 1.2;
    const fz = d / 2 + fd / 2 + 0.4;
    if (o.fence === "wood") {
      const f = box(fw, 1.1, 0.08, toon(0xa08258), 0, 0.55, fz);
      g.add(f); outline(f, 0.018);
    } else if (o.fence === "hedge") {
      for (let i = 0; i < Math.floor(fw / 1.2); i++) {
        g.add(box(1.24, rr(0.9, 1.15), 0.7, toon(PAL.leafDark), -fw / 2 + 0.62 + i * 1.2, 0.5, fz, { cs: false }));
      }
    } else if (o.fence === "metal") {
      for (let i = 0; i <= Math.floor(fw / 0.9); i++) {
        g.add(box(0.05, 1.0, 0.05, toon(0x6d7681), -fw / 2 + i * 0.9, 0.5, fz, { cs: false }));
      }
      g.add(box(fw, 0.05, 0.05, toon(0x6d7681), 0, 0.95, fz, { cs: false }));
      g.add(box(fw, 0.05, 0.05, toon(0x6d7681), 0, 0.5, fz, { cs: false }));
    } else { // block
      const f = box(fw, 1.15, 0.24, fMat, 0, 0.575, fz);
      g.add(f);
      g.add(box(fw, 0.08, 0.32, toon(0xa8a396), 0, 1.18, fz, { cs: false }));
    }
    // 门柱
    g.add(box(0.3, 1.35, 0.3, toon(0x9c978c), fw / 2 - 0.5, 0.675, fz));
    g.add(box(0.3, 1.35, 0.3, toon(0x9c978c), fw / 2 - 1.7, 0.675, fz));
  }
  return g;
}

/* ============================================================
 * 车站主体
 * ============================================================ */
const texStationSign = canvasTex(1024, 280, (g, w, h) => {
  g.fillStyle = "#fbfbf8"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#20355e"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = "#20355e";
  g.font = `700 128px ${FONT_JP}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("桜ヶ丘駅", w / 2, h / 2 - 28);
  g.font = `500 44px ${FONT_JP}`;
  g.fillStyle = "#5a6478";
  g.fillText("S A K U R A G A O K A", w / 2, h - 62);
  g.fillStyle = "#f0a2b8"; g.fillRect(10, h - 20, w - 20, 10);
});

function buildStation() {
  const S = L.STATION;
  const g = group((S.x0 + S.x1) / 2, 0, (S.z0 + S.z1) / 2);
  const w = S.x1 - S.x0, d = S.z1 - S.z0;   // 36 × 5
  const wallH = 3.55;
  const wallMat = toon(PAL.wallCream);
  const trimMat = toon(0x6b7078);

  // 墙体
  g.add(box(w, wallH, d, wallMat, 0, wallH / 2, 0));
  outline(g.children[0], 0.035);
  // 裙边
  g.add(box(w + 0.06, 0.55, d + 0.06, toon(0x9d9c94), 0, 0.275, 0, { cs: false }));

  // 坡屋顶（双坡 + 檐口）
  const roof = gableRoof(w, d, 1.55, toon(PAL.roofBlue), { ov: 0.5 });
  roof.position.y = wallH;
  g.add(roof);
  g.add(box(w + 1.1, 0.12, 0.2, toon(0x3f4147), 0, wallH + 1.57, 0, { cs: false }));
  // 金属屋面板缝
  const seamMat = toon(0x525e6c);
  for (let x = -w / 2 + 1.5; x < w / 2; x += 1.5) {
    for (const s of [-1, 1]) {
      const zOff = s * d * 0.24;
      const seam = box(0.05, 0.02, d * 0.62, seamMat, x, wallH + 1.55 * (1 - Math.abs(zOff) / (d / 2 + 0.5)) + 0.02, zOff, { rx: s * 0.477, cs: false });
      g.add(seam);
    }
  }
  // 檐口封板 + 雨水槽
  g.add(box(w + 1.06, 0.2, 0.14, trimMat, 0, wallH - 0.04, d / 2 + 0.48, { cs: false }));
  g.add(box(w + 1.06, 0.2, 0.14, trimMat, 0, wallH - 0.04, -d / 2 - 0.48, { cs: false }));
  for (const px of [-w / 2 + 0.6, -1, w / 2 - 0.6]) {
    g.add(cyl(0.05, 0.05, wallH, 6, trimMat, px, wallH / 2, d / 2 + 0.56, { cs: false }));
  }

  /* ---- 东立面（正面，朝向马路） ---- */
  const FX = w / 2;   // 东墙 local x
  const glassMat = toon(0x9db6c4, { opa: 0.5, side: THREE.DoubleSide });
  // 玻璃门（双开，敞开；门叶与东墙平行、向外微微张开）
  for (const s of [-1, 1]) {
    const dr = box(0.05, 2.3, 1.05, glassMat, FX + 0.42, 1.15, s * 0.62, { ry: s * 0.42 });
    g.add(dr);
    g.add(box(0.06, 2.3, 0.06, toon(0x53565c), FX + 0.4, 1.15, s * 1.12, { cs: false }));
  }
  // 门楣窗
  g.add(box(0.12, 0.9, 4.6, toon(0x9db6c4, { opa: 0.55 }), FX + 0.02, 2.95, 0, { cs: false }));
  g.add(box(0.16, 0.1, 4.9, trimMat, FX + 0.02, 3.42, 0, { cs: false }));
  // 门廊雨棚
  const canopy = box(2.1, 0.16, 6.2, toon(0x4e5a55), FX + 1.0, 3.05, 0);
  g.add(canopy);
  outline(canopy, 0.03);
  for (const sz of [-2.6, 2.6]) {
    g.add(cyl(0.035, 0.035, 1.6, 6, toon(0x3c4640), FX + 1.85, 2.3, sz, { rz: -0.5, cs: false }));
  }
  // 大型站名牌（雨棚上方墙面，高于西侧店铺屋顶线，主街视线可直达）
  g.add(box(0.12, 1.72, 5.6, toon(0xfafaf8), FX + 0.05, 4.32, 0, { cs: false }));
  g.add(plane(5.4, 1.5, basic(0xffffff, { map: texStationSign }), FX + 0.13, 4.32, 0, { ry: Math.PI / 2, cs: false }));
  // 挂钟
  g.add(cyl(0.34, 0.34, 0.05, 20, toon(0x2e3540), FX + 0.07, 3.6, 2.1, { rz: Math.PI / 2, cs: false }));
  g.add(cyl(0.32, 0.32, 0.08, 20, toon(0xf6f6f2), FX + 0.12, 3.6, 2.1, { rz: Math.PI / 2, cs: false }));
  // 时刻表 / 票价表 / 海报（墙面）
  const texTT = canvasTex(384, 512, (c, cw, ch) => {
    c.fillStyle = "#fdfdfb"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#2c4a7c"; c.fillRect(0, 0, cw, 64);
    c.fillStyle = "#fff"; c.font = `700 30px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("時  別  表", cw / 2, 42);
    c.fillStyle = "#333"; c.font = `500 21px ${FONT_JP}`; c.textAlign = "left";
    const rows = ["5", "6", "7", "8", "9", "10", "11", "12", "13", "14"];
    rows.forEach((r, i) => {
      c.fillText(r, 26, 100 + i * 40);
      c.fillStyle = "#8899aa";
      for (let j = 0; j < 5; j++) c.fillText(String(ri(1, 59)).padStart(2, "0"), 70 + j * 60, 100 + i * 40);
      c.fillStyle = "#333";
    });
    c.fillStyle = "#f0a2b8"; c.fillRect(0, ch - 30, cw, 30);
  });
  const boardMat = toon(0xe8e6df);
  const tt = plane(1.15, 1.5, basic(0xffffff, { map: texTT }), -2.6, 1.75, d / 2 + 0.03, { cs: false });
  g.add(box(1.3, 1.66, 0.07, boardMat, -2.6, 1.75, d / 2 + 0.005, { cs: false }), tt);
  const texFare = canvasTex(256, 384, (c, cw, ch) => {
    c.fillStyle = "#fdfdfb"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#2c4a7c"; c.fillRect(0, 0, cw, 48);
    c.fillStyle = "#fff"; c.font = `700 26px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("運賃表", cw / 2, 34);
    c.fillStyle = "#333"; c.font = `500 20px ${FONT_JP}`; c.textAlign = "left";
    const st = ["当駅", "ふじ野台", "みなと橋", "東が丘", "終点"];
    st.forEach((s, i) => {
      c.fillText(s, 18, 84 + i * 56);
      c.fillText(i === 0 ? "—" : `${140 + i * 40}円`, 150, 84 + i * 56);
    });
  });
  const fare = plane(0.8, 1.2, basic(0xffffff, { map: texFare }), -3.85, 1.75, d / 2 + 0.03, { cs: false });
  g.add(box(0.94, 1.34, 0.07, boardMat, -3.85, 1.75, d / 2 + 0.005, { cs: false }), fare);
  // 春季祭典海报
  const texFest = canvasTex(384, 512, (c, cw, ch) => {
    const gr = c.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, "#bfe0f2"); gr.addColorStop(1, "#fdeef2");
    c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
    // 樱花树
    c.fillStyle = "#8a6a52"; c.fillRect(60, 300, 26, 160);
    c.fillStyle = "#ffc2d4";
    for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(40 + rr2(0, 200), 210 + rr2(-70, 90), rr2(16, 34), 0, 7); c.fill(); }
    c.fillStyle = "#fff";
    for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(rr2(0, cw), rr2(240, ch), rr2(2, 5), 0, 7); c.fill(); }
    c.fillStyle = "#c2557e"; c.font = `700 52px ${FONT_HAND}`; c.textAlign = "center";
    c.fillText("さくらまつり", cw / 2, 96);
    c.fillStyle = "#42506e"; c.font = `500 30px ${FONT_JP}`;
    c.fillText("4/4 — 4/13", cw / 2, 148);
    c.font = `500 22px ${FONT_JP}`;
    c.fillText("会場：桜ヶ丘公園", cw / 2, 188);
  });
  const fest = plane(1.05, 1.4, basic(0xffffff, { map: texFest }), 4.6, 1.8, d / 2 + 0.03, { cs: false });
  g.add(box(1.18, 1.54, 0.07, boardMat, 4.6, 1.8, d / 2 + 0.005, { cs: false }), fest);
  // 自动售票机 ×2（东墙外侧，面向马路）
  for (const [mz, col] of [[-1.85, 0x9fb4c2], [1.0, 0x8fa8b6]]) {
    const vm = box(0.6, 1.75, 0.95, toon(col), FX + 0.45, 0.875, mz);
    g.add(vm);
    outline(vm, 0.02);
    g.add(plane(0.62, 0.42, basic(0x1c2a38), FX + 0.76, 1.35, mz, { ry: Math.PI / 2, cs: false }));
    g.add(box(0.05, 0.16, 0.62, toon(0x3c4652), FX + 0.76, 0.72, mz, { cs: false }));
  }

  /* ---- 南北立面 ---- */
  // 南墙（背面）窗
  const winS = windowUnit(1.5, 1.1, { curtain: true });
  winS.position.set(-8, 1.8, -d / 2 - 0.06);
  winS.rotation.y = Math.PI;
  g.add(winS);
  const winS2 = windowUnit(1.5, 1.1, { curtain: true, warm: true });
  winS2.position.set(6, 1.8, -d / 2 - 0.06);
  winS2.rotation.y = Math.PI;
  g.add(winS2);

  /* ---- 内部（透过玻璃可见） ---- */
  const inner = group(0, 0, 0);
  inner.add(box(w - 1, 0.06, d - 1, toon(0xd8d4c8), 0, 0.12, 0, { cs: false }));
  inner.add(box(w - 2, 0.08, 0.3, toon(0xf5f2e8, { emissive: 0xfff2d0, ei: 0.65 }), 0, 3.3, 0, { cs: false }));  // 顶灯
  // 员工窗口
  const kiosk = box(3.2, 2.3, 0.5, toon(0xb9987a), -w / 2 + 2.2, 1.15, 0);
  inner.add(kiosk);
  inner.add(plane(2.2, 0.8, toon(0x31404c), -w / 2 + 2.2, 1.7, 0.28, { cs: false }));
  inner.add(box(0.9, 0.5, 0.2, toon(0x8a7258), -w / 2 + 1.6, 1.1, 0.1, { cs: false }));
  // 长椅 + 告示
  inner.add(box(1.8, 0.08, 0.45, toon(0x6a7a6a), -w / 2 + 6, 0.45, 1.4, { cs: false }));
  inner.add(plane(1.4, 0.9, basic(0xffffff, { map: texFest }), -w / 2 + 8.5, 1.9, d / 2 - 0.55, { ry: Math.PI, cs: false }));
  g.add(inner);

  /* ---- 检票口（北墙开口通向站台） ---- */
  for (const gx of [-3.2, -5.2]) {
    const gate = group(gx, 0, -d / 2 + 0.1);
    const ped = box(0.5, 1.05, 0.45, toon(0xd9dce0), 0, 0.52, 0);
    gate.add(ped);
    gate.add(box(0.56, 0.3, 0.5, toon(0x3d4750), 0, 1.18, 0, { cs: false }));
    gate.add(box(0.44, 0.08, 0.3, toon(0x7fd4a8, { emissive: 0x4fbf7f, ei: 0.5 }), 0, 0.78, 0.2, { cs: false }));
    g.add(gate);
  }
  // 北墙上沿雨棚梁
  g.add(box(w, 0.25, 0.2, trimMat, 0, wallH - 0.1, -d / 2 - 0.05, { cs: false }));

  scene.add(g);
  return g;
}

/* ============================================================
 * 站台
 * ============================================================ */
const texPlatName = canvasTex(1024, 400, (g, w, h) => {
  g.fillStyle = "#fdfdfb"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#f0a2b8"; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
  g.fillStyle = "#1e3a68";
  g.font = `700 170px ${FONT_JP}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("桜 ヶ 丘", w / 2, h / 2 - 24);
  g.font = `500 40px ${FONT_JP}`; g.fillStyle = "#5a6478";
  g.fillText("SAKURAGAOKA", w / 2, h - 62);
  g.font = `500 34px ${FONT_JP}`; g.fillStyle = "#3a4a66";
  g.textAlign = "left";
  g.fillText("← ふじ野台", 30, h / 2 - 60);
  g.textAlign = "right";
  g.fillText("みなと橋 →", w - 30, h / 2 - 60);
});

function buildPlatform() {
  const P = L.PLAT;
  const g = group((P.x0 + P.x1) / 2, 0, (P.z0 + P.z1) / 2);
  const w = P.x1 - P.x0, d = P.z1 - P.z0;   // 42 × 4.2
  const topY = P.y;

  // 站台体
  const body = box(w, topY, d, toon(PAL.platConcrete), 0, topY / 2, 0);
  g.add(body);
  outline(body, 0.03);
  // 白色安全线
  g.add(plane(w, 0.16, basic(PAL.lineWhite), 0, topY + 0.011, -d / 2 + 0.22, { rx: -Math.PI / 2, cs: false }));
  // 黄色触觉引导砖
  const tacMat = toon(PAL.tactile);
  g.add(box(w, 0.02, 0.3, tacMat, 0, topY + 0.012, -d / 2 + 0.52, { cs: false }));
  for (let x = -w / 2 + 0.3; x < w / 2; x += 0.36) {
    g.add(cyl(0.018, 0.018, 0.015, 6, tacMat, x, topY + 0.025, -d / 2 + 0.52, { cs: false }));
  }
  // 车门位置标
  const doorMarkMat = basic(0xe8e9e4);
  for (const dx of [-26, -12.5, 1]) {
    for (const off of [-0.9, 0.9]) {
      g.add(plane(0.5, 0.34, doorMarkMat, dx + off, topY + 0.012, -d / 2 + 1.15, { rx: -Math.PI / 2, cs: false }));
    }
    const numTex = canvasTex(64, 64, (c, cw, ch) => {
      c.fillStyle = "#ffffff"; c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#274a80"; c.font = `700 40px ${FONT_JP}`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(Math.round((dx + 26) / 14) + 1), cw / 2, ch / 2 + 2);
    });
    g.add(plane(0.4, 0.4, basic(0xffffff, { map: numTex }), dx, topY + 0.013, -d / 2 + 1.72, { rx: -Math.PI / 2, cs: false }));
  }
  // 磨损与裂纹
  const wear = basic(0xb2b6b8, { opa: 0.5 });
  for (let i = 0; i < 9; i++) {
    g.add(plane(rr(0.8, 2.6), rr(0.5, 1.6), wear, rr(-w / 2 + 1, w / 2 - 1), topY + 0.008, rr(-d / 2 + 1.2, d / 2 - 0.4), { rx: -Math.PI / 2, cs: false }));
  }
  const crack = basic(0x9a9ea0, { opa: 0.7 });
  for (let i = 0; i < 7; i++) {
    g.add(plane(0.035, rr(0.6, 1.6), crack, rr(-w / 2 + 1, w / 2 - 1), topY + 0.009, rr(-d / 2 + 1, d / 2 - 0.5), { rx: -Math.PI / 2, cs: false, ry: rr(0, 3.14) }));
  }

  /* ---- 候车雨棚 ---- */
  const colMat = toon(0x4c5a52);
  const roofMat = toon(0xc9cdd0);
  for (let x = -w / 2 + 3; x <= w / 2 - 2; x += 6.2) {
    const col = cyl(0.09, 0.11, 3.35, 8, colMat, x, topY + 1.675, -d / 2 + 0.55);
    g.add(col);
  }
  const canopyG = group(0, 0, 0);
  const can = box(w - 1.4, 0.1, d + 0.4, roofMat, 0, topY + 3.3, 0.15);
  can.rotation.x = 0.05;
  canopyG.add(can);
  outline(can, 0.028);
  // 雨棚边缘封板（厚度感）
  canopyG.add(box(w - 1.3, 0.18, 0.1, toon(0x4c5a52), 0, topY + 3.24, -d / 2 - 0.05, { cs: false }));
  canopyG.add(box(w - 1.3, 0.18, 0.1, toon(0x4c5a52), 0, topY + 3.24, d / 2 + 0.25, { cs: false }));
  canopyG.add(box(0.1, 0.18, d + 0.4, toon(0x4c5a52), -w / 2 + 0.75, topY + 3.24, 0.15, { cs: false }));
  canopyG.add(box(0.1, 0.18, d + 0.4, toon(0x4c5a52), w / 2 - 0.75, topY + 3.24, 0.15, { cs: false }));
  // 雨棚下荧光灯
  for (let x = -w / 2 + 4; x < w / 2 - 2; x += 6.2) {
    canopyG.add(box(1.6, 0.06, 0.16, toon(0xfdfbee, { emissive: 0xfff3c4, ei: 0.7 }), x, topY + 3.22, 0.1, { cs: false }));
  }
  g.add(canopyG);

  // 吊挂站名牌
  const sign = box(3.6, 1.42, 0.1, toon(0xfafaf8), -6, topY + 2.42, 0.35, { cs: false });
  g.add(sign);
  outline(sign, 0.02);
  g.add(plane(3.4, 1.28, basic(0xffffff, { map: texPlatName }), -6, topY + 2.42, 0.41, { cs: false }));
  g.add(plane(3.4, 1.28, basic(0xffffff, { map: texPlatName }), -6, topY + 2.42, 0.29, { ry: Math.PI, cs: false }));
  for (const sx of [-7.5, -4.5]) {
    g.add(cyl(0.02, 0.02, 0.75, 4, colMat, sx, topY + 3.05, 0.35, { cs: false }));
  }
  // 方向吊牌
  const dirTex = canvasTex(512, 128, (c, cw, ch) => {
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#2c7a4f"; c.fillRect(0, 0, cw, 18);
    c.fillStyle = "#1e3a68"; c.font = `700 58px ${FONT_JP}`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("1番線 ふじ野台方面", cw / 2, ch / 2 + 8);
  });
  const dirSign = plane(2.6, 0.65, basic(0xffffff, { map: dirTex }), -24, topY + 2.45, 0.3, { ry: Math.PI, cs: false });
  g.add(box(2.7, 0.75, 0.06, toon(0xfafaf8), -24, topY + 2.45, 0.36, { cs: false }), dirSign);
  const dirSign2 = dirSign.clone();
  dirSign2.rotation.y = 0; dirSign2.position.z = 0.42;
  g.add(dirSign2);

  // 站台时钟柱
  g.add(cyl(0.05, 0.05, 2.6, 6, colMat, 3.5, topY + 1.3, -d / 2 + 0.7, { cs: false }));
  g.add(cyl(0.26, 0.26, 0.07, 18, toon(0xf6f6f2), 3.5, topY + 2.72, -d / 2 + 0.7, { rx: Math.PI / 2 - 0.5, cs: false }));
  g.add(cyl(0.28, 0.28, 0.05, 18, toon(0x2e3540), 3.5, topY + 2.72, -d / 2 + 0.66, { rx: Math.PI / 2 - 0.5, cs: false }));

  // 站台端部护栏（东端）+ 禁入标志
  const railMat = toon(0xe8e9e6);
  const endX = w / 2 - 0.3;
  for (let z = -d / 2 + 0.3; z <= d / 2 - 0.3; z += 0.55) {
    g.add(cyl(0.035, 0.035, 1.0, 6, railMat, endX, topY + 0.5, z, { cs: false }));
  }
  g.add(box(0.07, 0.06, d - 0.6, railMat, endX, topY + 0.95, 0, { cs: false }));
  g.add(box(0.07, 0.06, d - 0.6, railMat, endX, topY + 0.5, 0, { cs: false }));
  const noTex = canvasTex(128, 128, (c, cw, ch) => {
    c.fillStyle = "#fdf6d8"; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = "#c4393c"; c.lineWidth = 10;
    c.beginPath(); c.arc(64, 64, 46, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(30, 98); c.lineTo(98, 30); c.stroke();
  });
  g.add(plane(0.42, 0.42, basic(0xffffff, { map: noTex }), endX - 0.06, topY + 1.35, 0, { ry: -Math.PI / 2, cs: false }));
  // 西端矮墙
  g.add(box(0.25, 0.9, d, toon(0xb4b8ba), -w / 2 + 0.1, topY + 0.45, 0));

  scene.add(g);
  return g;
}

/* ============================================================
 * 商店街建筑
 * ============================================================ */

/* --- 便利店 サクラマート --- */
function buildKonbini() {
  const g = group(23, 0, 7, Math.PI / 2);   // 旋转后正面朝西（马路）
  const w = 12, d = 10, h = 3.6;
  const wallMat = toon(0xf2f1ea);
  g.add(box(w, h, d, wallMat, 0, h / 2, 0));
  outline(g.children[0], 0.03);
  // 女儿墙 + 平屋顶设备
  g.add(box(w + 0.2, 0.5, d + 0.2, toon(0xd8d7d0), 0, h + 0.25, 0, { cs: false }));
  for (const [ax, az] of [[-w / 2 + 1.5, -d / 2 + 1.5], [w / 2 - 2, d / 2 - 2]]) {
    const ac = box(0.9, 0.6, 0.9, toon(0xc9ccce), ax, h + 0.3, az);
    g.add(ac);
    g.add(cyl(0.28, 0.28, 0.05, 12, toon(0x4a4d52), ax, h + 0.62, az, { cs: false }));
  }
  // 招牌横带
  const texSign = canvasTex(1024, 256, (c, cw, ch) => {
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#2f9e6e"; c.fillRect(0, 0, 130, ch);
    c.fillStyle = "#fff"; c.font = `900 96px ${FONT_JP}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("サ", 65, ch / 2);
    c.fillStyle = "#33415a"; c.font = `900 108px ${FONT_JP}`;
    c.fillText("サクラマート", 560, ch / 2 - 14);
    c.fillStyle = "#f0a2b8"; c.font = `700 44px ${FONT_JP}`;
    c.fillText("SAKURA-MART", 560, ch - 44);
    c.fillStyle = "#e8873c"; c.fillRect(cw - 210, 30, 180, 60);
    c.fillStyle = "#fff"; c.font = `700 34px ${FONT_JP}`;
    c.fillText("24時間", cw - 120, 62);
    c.fillStyle = "#f6c93c"; c.fillRect(cw - 210, 100, 180, 60);
    c.fillStyle = "#5a4a1a"; c.font = `700 30px ${FONT_JP}`;
    c.fillText("県道指定", cw - 120, 132);
  });
  const band = box(w, 1.35, 0.25, toon(0xd8d7d0), 0, h + 0.9, -d / 2 - 0.1, { cs: false });
  g.add(band);
  outline(band, 0.024);
  // 招牌贴面（独立平面朝外，避免盒体 UV 镜像文字）
  g.add(plane(w - 0.2, 1.25, basic(0xffffff, { map: texSign }), 0, h + 0.9, -d / 2 - 0.235, { ry: Math.PI, cs: false }));
  // 玻璃前面（朝外）
  const glass = plane(w - 0.8, 2.5, toon(0x9db8c6, { opa: 0.42, side: THREE.DoubleSide }), 0, 1.45, -d / 2 - 0.06, { ry: Math.PI, cs: false, rs: true });
  g.add(glass);
  // 玻璃海报
  const texPost = canvasTex(256, 320, (c, cw, ch) => {
    c.fillStyle = "#fff4f6"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#e85a7a"; c.beginPath(); c.arc(cw / 2, 110, 62, 0, 7); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(cw / 2, 96, 40, 0, 7); c.fill();
    c.fillStyle = "#d94a6a"; c.font = `700 30px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("新発売", cw / 2, 230);
    c.font = `600 26px ${FONT_JP}`;
    c.fillText("さくらサイダー", cw / 2, 270);
  });
  g.add(plane(0.72, 0.9, basic(0xffffff, { map: texPost }), -w / 2 + 2.1, 1.6, -d / 2 - 0.08, { cs: false }));
  const texPost2 = canvasTex(256, 320, (c, cw, ch) => {
    c.fillStyle = "#fdf3df"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#e8a23c"; c.beginPath(); c.roundRect ? c.roundRect(38, 60, 180, 110, 16) : c.rect(38, 60, 180, 110); c.fill();
    c.fillStyle = "#7a4a1a"; c.font = `700 30px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("弁当", cw / 2, 125);
    c.fillStyle = "#4a5a3a"; c.font = `600 26px ${FONT_JP}`;
    c.fillText("春のお弁当", cw / 2, 240);
    c.fillText("コレクション", cw / 2, 275);
  });
  g.add(plane(0.72, 0.9, basic(0xffffff, { map: texPost2 }), w / 2 - 2.1, 1.6, -d / 2 - 0.08, { cs: false }));

  // 室内（货架 + 冷柜 + 顶灯）
  const inner = group();
  inner.add(box(w - 1.4, 0.05, d - 1.4, toon(0xd4d2ca), 0, 0.1, 0, { cs: false }));
  const shelfMat = toon(0x8b9298);
  for (let i = 0; i < 3; i++) {
    const sh = box(0.7, 1.7, d - 3, shelfMat, -2.2 + i * 1.7, 0.95, 0.4);
    inner.add(sh);
    for (let r = 0; r < 3; r++) {
      inner.add(box(0.72, 0.34, d - 3.2, toon(pick([0xe8e2d4, 0xd4dce4, 0xe4d8c8])), -2.2 + i * 1.7, 0.55 + r * 0.55, 0.4, { cs: false }));
    }
  }
  // 冷柜（发光）
  const cooler = box(d - 4, 1.9, 0.8, toon(0xf4f6f2, { emissive: 0xdfe9ee, ei: 0.5 }), 0, 1.05, d / 2 - 1.2, { ry: Math.PI / 2 });
  inner.add(cooler);
  inner.add(box(d - 4.2, 1.2, 0.1, toon(0xbcd8e4, { emissive: 0xa8ccd8, ei: 0.6 }), 0, 1.3, d / 2 - 1.62, { ry: Math.PI / 2, cs: false }));
  // 收银台
  inner.add(box(2.2, 1.0, 0.8, toon(0xd0ccc2), w / 2 - 2, 0.6, -d / 2 + 1.6, { cs: false }));
  inner.add(box(w - 2, 0.1, 0.5, toon(0xfdf8e4, { emissive: 0xfff0c0, ei: 0.75 }), 0, 3.32, 0, { cs: false }));
  g.add(inner);
  // 门口台阶 + 无障碍斜坡 + 触觉砖
  g.add(box(6.5, 0.14, 1.6, toon(0xbcbfbd), 0, 0.07, -d / 2 - 0.8, { cs: false }));
  const ramp = box(1.3, 0.1, 1.5, toon(0xb2b5b3), -2.5, 0.1, -d / 2 - 1.6, { rx: -0.12, cs: false });
  g.add(ramp);
  g.add(box(0.5, 0.025, 1.5, toon(PAL.tactile), -2.5, 0.165, -d / 2 - 1.6, { rx: -0.12, cs: false }));

  // 冰淇淋旗帜
  const flagTex = canvasTex(128, 256, (c, cw, ch) => {
    c.fillStyle = "#ff8fae"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#fff"; c.font = `700 34px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("アイス", cw / 2, 80); c.fillText("クリーム", cw / 2, 122);
    c.fillStyle = "#fdeef2"; c.beginPath(); c.moveTo(0, ch); c.lineTo(cw, ch); c.lineTo(cw / 2, ch - 46); c.closePath(); c.fill();
  });
  g.add(cyl(0.03, 0.03, 4.6, 6, toon(0x9a9a94), -w / 2 - 1.3, 2.3, -d / 2 - 1.6, { cs: false }));
  const flag = plane(0.85, 1.7, basic(0xffffff, { map: flagTex, side: THREE.DoubleSide }), -w / 2 - 1.3, 3.85, -d / 2 - 1.19, { cs: false });
  g.add(flag);
  flag.rotation.y = Math.PI / 2; // 旗面朝东
  flag.position.x = -w / 2 - 0.9;
  _wavingFlags.push(flag);

  // 南侧山墙（朝向镜头方向）细节：两扇窗 + 外机
  const southWin = windowUnit(1.5, 1.05, { curtain: true });
  southWin.position.set(-w / 2 - 0.07, 1.7, -1.5);
  southWin.rotation.y = -Math.PI / 2;
  g.add(southWin);
  const southWin2 = windowUnit(1.2, 1.0, { warm: true });
  southWin2.position.set(-w / 2 - 0.07, 1.7, 2.2);
  southWin2.rotation.y = -Math.PI / 2;
  g.add(southWin2);
  const acS = box(0.62, 0.5, 0.3, toon(0xcfd2d4), -w / 2 - 0.2, 2.9, 0.4);
  g.add(acS);

  scene.add(g);
  return g;
}

/* --- 咖啡店 --- */
function buildCafe() {
  const g = group(-0.5, 0, 17.75);   // x -4.5..3.5, z 14..21.5，正面朝东（南侧，让开车站视线走廊）
  const w = 8, d = 7.5, h = 3.1;
  g.add(box(w, h, d, toon(0xf1e7d2), 0, h / 2, 0));
  outline(g.children[0], 0.03);
  // 平屋顶 + 女儿墙
  g.add(box(w + 0.25, 0.3, d + 0.25, toon(0x9a9184), 0, h + 0.12, 0, { cs: false }));
  // 深棕木框大玻璃窗（东面 = +X）
  const side = w / 2 + 0.05;
  const winMat = toon(0x53443a);
  g.add(box(0.12, 2.2, 4.6, winMat, side, 1.45, -0.6, { cs: false }));
  g.add(plane(4.3, 2.0, toon(0x9db8c6, { opa: 0.4 }), side + 0.02, 1.42, -0.6, { ry: Math.PI / 2, cs: false }));
  // 窗内暖光 + 吊灯
  g.add(box(4.2, 2.0, 0.06, toon(0xf5e3c0, { emissive: 0xffdca0, ei: 0.35 }), side - 0.06, 1.42, -0.6, { ry: Math.PI / 2, cs: false }));
  for (const lz of [-1.6, -0.6, 0.4]) {
    g.add(sph(0.1, toon(0xffe8b0, { emissive: 0xffcf80, ei: 0.9 }), side - 0.9, 2.2, lz, { cs: false }));
    g.add(cyl(0.008, 0.008, 0.6, 4, toon(0x4a4038), side - 0.9, 2.75, lz, { cs: false }));
  }
  // 门
  g.add(box(0.12, 2.2, 1.0, toon(0x6b4f3a), side, 1.1, 2.2, { cs: false }));
  g.add(plane(0.8, 1.9, toon(0x9db8c6, { opa: 0.4 }), side + 0.07, 1.15, 2.2, { ry: Math.PI / 2, cs: false }));
  // 布艺遮阳棚（墨绿）
  const awn = box(1.7, 0.08, 5.4, toon(0x3e5a4b), side + 0.8, 2.75, -0.2, { rz: 0.14 });
  g.add(awn);
  outline(awn, 0.025);
  for (const az of [-2.6, 0, 2.6]) {
    g.add(box(1.7, 0.03, 0.06, toon(0x35503f), side + 1.6, 2.44, az - 0.2, { rz: 0.14, cs: false }));
  }
  // 手写黑板菜单
  const texMenu = canvasTex(384, 512, (c, cw, ch) => {
    c.fillStyle = "#2e2b27"; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = "#7a6a4a"; c.lineWidth = 10; c.strokeRect(12, 12, cw - 24, ch - 24);
    c.fillStyle = "#f5f0e4"; c.font = `700 44px ${FONT_HAND}`; c.textAlign = "center";
    c.fillText("春の限定", cw / 2, 86);
    c.font = `500 33px ${FONT_HAND}`; c.textAlign = "left";
    const items = ["桜ラテ …… 480", "いちごケーキ . 520", "あんバター .. 450", "豆乳オレ . 420"];
    items.forEach((s, i) => c.fillText(s, 40, 168 + i * 62));
    c.fillStyle = "#f2b7c6";
    c.beginPath(); c.arc(310, 90, 30, 0, 7); c.fill();
    c.beginPath(); c.arc(292, 74, 22, 0, 7); c.fill();
  });
  g.add(box(0.06, 1.05, 0.8, toon(0x4a4038), side + 0.75, 1.05, 3.1, { ry: 0.3 }));
  const menu = plane(0.85, 1.13, basic(0xffffff, { map: texMenu }), side + 0.72, 1.12, 3.12, { ry: Math.PI / 2 + 0.3, cs: false });
  g.add(menu);
  // 室外圆桌 + 金属椅
  for (const [tx, tz] of [[side + 1.5, -1.6], [side + 1.5, 0.8]]) {
    g.add(cyl(0.5, 0.42, 0.06, 14, toon(0xd8d4ca), tx, 0.72, tz, { cs: false }));
    g.add(cyl(0.05, 0.05, 0.7, 6, toon(0x5a5f66), tx, 0.36, tz, { cs: false }));
    g.add(cyl(0.24, 0.24, 0.03, 10, toon(0x5a5f66), tx, 0.03, tz, { cs: false }));
    // 椅子
    for (const [ox, oz, r] of [[0.85, 0, Math.PI / 2], [-0.85, 0, -Math.PI / 2]]) {
      const ch1 = group(tx + ox, 0, tz + oz, r);
      ch1.add(cyl(0.26, 0.24, 0.05, 10, toon(0x6a7178), 0, 0.48, 0, { cs: false }));
      ch1.add(cyl(0.04, 0.04, 0.48, 6, toon(0x6a7178), 0, 0.24, 0, { cs: false }));
      ch1.add(box(0.4, 0.5, 0.05, toon(0x6a7178), 0.3, 0.72, 0, { cs: false }));
      g.add(ch1);
    }
  }
  // 窗台花盆
  for (const pz of [-2.1, 0.6]) {
    g.add(cyl(0.13, 0.1, 0.22, 8, toon(0xb56a50), side + 0.25, 2.62, pz));
    g.add(sph(0.18, toon(PAL.leafDark), side + 0.25, 2.82, pz, { sy: 1.2, cs: false }));
  }
  // 屋顶天线 + 风铃（门口）
  g.add(cyl(0.015, 0.015, 1.1, 4, toon(0x4a4038), -w / 2 + 1, h + 0.5, -1, { cs: false }));
  // 北墙窗（画面中可见的背立面）
  const cafeWinN = windowUnit(1.4, 1.05, { warm: true, curtain: true });
  cafeWinN.position.set(-1.2, 1.65, -d / 2 - 0.06);
  cafeWinN.rotation.y = Math.PI;
  g.add(cafeWinN);
  scene.add(g);
  return g;
}

/* --- 和菓子店 桜堂 --- */
function buildWagashi() {
  const g = group(20.5, 0, 18, 0);  // x 17..24, z 14.5..21.5，正面（局部 -X）朝西
  const w = 7, d = 7, h = 3.0;
  g.add(box(w, h, d, toon(0xa9825d), 0, h / 2, 0));
  outline(g.children[0], 0.03);
  // 双坡瓦屋顶
  const wRoof = gableRoof(w, d, 1.1, toon(0x5c6b62), { ov: 0.3 });
  wRoof.position.y = h;
  g.add(wRoof);
  // 深色木框推拉门 + 橱窗
  const side = -w / 2 - 0.05;
  g.add(box(0.12, 2.2, 2.0, toon(0x6a4a32), side, 1.1, -1.6, { cs: false }));
  g.add(plane(1.7, 1.9, toon(0x9db8c6, { opa: 0.4 }), side - 0.03, 1.2, -1.6, { ry: -Math.PI / 2, cs: false }));
  g.add(box(0.12, 2.4, 2.6, toon(0x6a4a32), side, 1.2, 1.8, { cs: false }));
  g.add(plane(2.3, 2.1, toon(0x9db8c6, { opa: 0.4 }), side - 0.03, 1.25, 1.8, { ry: -Math.PI / 2, cs: false }));
  // 橱窗内点心
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.09, 0.11, 0.12, 10, toon(0xf2d8c0), side - 0.15, 0.62, 0.9 + i * 0.42, { cs: false }));
  }
  g.add(box(2.2, 0.1, 2.4, toon(0x7a5a40), side - 0.15, 0.55, 1.8, { cs: false }));
  // 暖帘
  const texNoren = canvasTex(256, 384, (c, cw, ch) => {
    c.fillStyle = "#3a4a63"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#f5f2ea"; c.font = `700 96px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("桜", cw / 2, 130);
    c.fillText("堂", cw / 2, 260);
    c.beginPath(); c.arc(cw / 2, 330, 28, 0, 7); c.fill();
    c.fillStyle = "#e88aa8"; c.beginPath(); c.arc(cw / 2, 330, 20, 0, 7); c.fill();
  });
  const noren = plane(2.4, 1.2, basic(0xffffff, { map: texNoren, side: THREE.DoubleSide }), side - 0.55, 2.35, 1.8, { ry: -Math.PI / 2, cs: false });
  g.add(noren);
  // 纸灯笼
  const lant = sph(0.22, toon(0xf8f0dc, { emissive: 0xffdf9a, ei: 0.75 }), side - 0.5, 2.5, -1.6, { sy: 1.35, cs: false });
  g.add(lant);
  // 桜もち海报 + 红色长椅
  const texMochi = canvasTex(320, 420, (c, cw, ch) => {
    c.fillStyle = "#fdf0f3"; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = "#e88aa8"; c.lineWidth = 8; c.strokeRect(8, 8, cw - 16, ch - 16);
    c.fillStyle = "#f2a7ba"; c.beginPath(); c.ellipse(cw / 2, 160, 78, 54, 0, 0, 7); c.fill();
    c.fillStyle = "#7ba05a"; c.beginPath(); c.ellipse(cw / 2, 205, 95, 30, 0.3, 0, 7); c.fill();
    c.fillStyle = "#c2557e"; c.font = `700 44px ${FONT_JP}`; c.textAlign = "center";
    c.fillText("桜もち", cw / 2, 60);
    c.fillStyle = "#5a4a42"; c.font = `600 30px ${FONT_JP}`;
    c.fillText("春季限定", cw / 2, 108);
    c.fillText("新入荷", cw / 2, 320);
  });
  g.add(box(0.9, 1.2, 0.07, toon(0x8a6a4a), side - 1.0, 1.5, 3.1, { ry: Math.PI / 2 + 0.2 }));
  g.add(plane(0.78, 1.05, basic(0xffffff, { map: texMochi }), side - 1.06, 1.5, 3.1, { ry: -Math.PI / 2 + 0.2, cs: false }));
  const bench = box(1.5, 0.09, 0.42, toon(0xc23a3a), side - 0.9, 0.45, 4.2);
  g.add(bench);
  g.add(box(0.1, 0.45, 0.4, toon(0x8a2a2a), side - 0.9 - 0.6, 0.22, 4.2, { cs: false }));
  g.add(box(0.1, 0.45, 0.4, toon(0x8a2a2a), side - 0.9 + 0.6, 0.22, 4.2, { cs: false }));
  outline(bench, 0.018);
  // 竹帘（屋檐）
  g.add(box(2.4, 0.5, 0.06, toon(0xc8b088), side - 0.1, 2.72, 3.4, { ry: Math.PI / 2, cs: false }));
  // 木展示架
  g.add(box(1.0, 1.5, 0.5, toon(0xb08a63), side - 1.6, 0.75, -2.8, { cs: false }));
  for (let i = 0; i < 3; i++) {
    g.add(box(1.05, 0.06, 0.55, toon(0x8a6a4a), side - 1.6, 0.5 + i * 0.5, -2.8, { cs: false }));
  }
  // 北侧山墙小窗（面向主街方向）
  const wagWin = windowUnit(1.3, 1.0, { warm: true, curtain: true });
  wagWin.position.set(1.2, 1.6, -d / 2 - 0.06);
  wagWin.rotation.y = Math.PI;
  g.add(wagWin);
  scene.add(g);
  return g;
}

/* --- 花店 --- */
function buildFlower() {
  const g = group(20.5, 0, 27, Math.PI);   // 东侧 x 17..24, z 24..30，正面（局部 +X 旋转后朝西）面向马路
  const w = 7, d = 6, h = 2.9;
  g.add(box(w, h, d, toon(0xdfe8d8), 0, h / 2, 0));
  outline(g.children[0], 0.03);
  // 平屋顶
  g.add(box(w + 0.25, 0.26, d + 0.25, toon(0x9aa892), 0, h + 0.1, 0, { cs: false }));
  const side = w / 2 + 0.05;
  // 大玻璃窗 + 门
  g.add(plane(4.4, 1.9, toon(0x9db8c6, { opa: 0.4 }), side, 1.5, -0.8, { ry: Math.PI / 2, cs: false }));
  g.add(box(0.1, 2.0, 4.7, toon(0x6a7a62), side, 1.45, -0.8, { cs: false }));
  g.add(box(0.12, 2.1, 0.95, toon(0x8a9a82), side, 1.05, 2.0, { cs: false }));
  // 浅绿遮阳棚
  const awn = box(1.5, 0.07, 5.2, toon(0x9ab88a), side + 0.7, 2.6, 0, { rz: 0.13 });
  g.add(awn);
  outline(awn, 0.022);
  // 风铃
  g.add(sph(0.05, toon(0xd8e8f0, { emissive: 0xbcdcec, ei: 0.4 }), side + 1.2, 2.35, 1.6, { cs: false }));
  // 门口花桶 + 花架
  const bucketMat = toon(0xb8bcc0);
  const flowerCols = [0xe86a8a, 0xf2c94c, 0xe898c8, 0xf4f4f0, 0xd9705a, 0xc8a8e8];
  for (let i = 0; i < 6; i++) {
    const bx = side + rr(0.3, 1.0), bz = -2.6 + i * 0.85 + rr(-0.1, 0.1);
    g.add(cyl(0.17, 0.13, 0.34, 10, bucketMat, bx, 0.17, bz));
    g.add(sph(0.15, toon(pick(flowerCols)), bx, 0.42, bz, { sy: 1.3, cs: false }));
  }
  const rack = box(0.5, 1.4, 2.4, toon(0xb08a63), side + 0.2, 0.7, -1.4, { cs: false });
  g.add(rack);
  for (let i = 0; i < 3; i++) {
    g.add(box(0.55, 0.05, 2.45, toon(0x8a6a4a), side + 0.2, 0.45 + i * 0.45, -1.4, { cs: false }));
    for (let j = 0; j < 3; j++) {
      g.add(cyl(0.1, 0.08, 0.18, 8, bucketMat, side + 0.2, 0.56 + i * 0.45, -2.2 + j * 0.8));
      g.add(sph(0.11, toon(pick(flowerCols)), side + 0.2, 0.72 + i * 0.45, -2.2 + j * 0.8, { sy: 1.35, cs: false }));
    }
  }
  // 手写价格牌
  const texPrice = canvasTex(128, 160, (c, cw, ch) => {
    c.fillStyle = "#fdfaf0"; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = "#a8b88a"; c.lineWidth = 6; c.strokeRect(6, 6, cw - 12, ch - 12);
    c.fillStyle = "#5a7a4a"; c.font = `700 34px ${FONT_HAND}`; c.textAlign = "center";
    c.fillText("チューリップ", cw / 2, 58);
    c.fillText("1本", cw / 2, 100);
    c.font = `700 44px ${FONT_HAND}`;
    c.fillText("¥120", cw / 2, 148);
  });
  for (const pz of [-1.8, 0.6]) {
    g.add(box(0.04, 0.5, 0.4, toon(0xf0ead8), side + 1.35, 0.25, pz, { ry: 0.5, cs: false }));
    g.add(plane(0.36, 0.46, basic(0xffffff, { map: texPrice }), side + 1.42, 0.28, pz, { ry: Math.PI / 2 + 0.5, cs: false }));
  }
  // 店内暖光
  g.add(box(4.2, 0.08, 0.4, toon(0xfdf6dc, { emissive: 0xffedbb, ei: 0.8 }), side - 0.6, 2.55, -0.5, { ry: Math.PI / 2, cs: false }));
  // 北墙窗
  const flWinN = windowUnit(1.3, 1.0, { curtain: true });
  flWinN.position.set(-1.4, 1.6, -d / 2 - 0.06);
  flWinN.rotation.y = Math.PI;
  g.add(flWinN);
  scene.add(g);
  return g;
}

/* --- 花店门前空地改成的收费停车场（车站视线走廊） --- */
function buildParking() {
  const g = group(-0.25, 0, 9.75);   // x -3.75..3.25, z 6..13.5
  g.add(plane(7, 7.5, toon(0x71767e), 0, 0.036, 0, { rx: -Math.PI / 2, cs: false }));
  // 白色停车位线
  const lineMat = basic(PAL.lineWhite);
  for (const lx of [-3.0, -1.0, 1.0, 3.0]) {
    g.add(plane(0.1, 5.6, lineMat, lx, 0.042, 0.3, { rx: -Math.PI / 2, cs: false }));
  }
  scene.add(g);
  return g;
}

/* ============================================================
 * 布置全部建筑
 * ============================================================ */
function buildAllBuildings() {
  buildStation();
  buildPlatform();
  buildKonbini();
  buildCafe();
  buildWagashi();
  buildFlower();
  buildParking();

  /* ---- 街道两侧住宅 ---- */
  const houses = [
    // 西侧（路西）
    { x: -9.5, z: 30.5, ry: 0.06, w: 7, d: 5.5, floors: 2, wall: 0xd9e4e7, roof: 0x5d6a78, roofType: "gable", fence: "block" },
    { x: -15, z: 41, ry: -0.04, w: 6.5, d: 5.5, floors: 2, wall: 0xefe0cf, roof: 0x6a7480, roofType: "hip", fence: "hedge" },
    { x: -1, z: 33.5, ry: -0.02, w: 7.5, d: 6, floors: 2, wall: 0xf0e8d6, roof: 0x5c6b62, roofType: "gable", fence: "wood" },
    { x: -13, z: 52, ry: 0.03, w: 8, d: 6, floors: 1, wall: 0xf4f2ea, roof: 0x54565e, roofType: "hip", fence: "metal" },
    // 东侧
    { x: 21, z: -11.5, ry: -0.05, w: 8, d: 6, floors: 2, wall: 0xe7dcc6, roof: 0x54565e, roofType: "gable", fence: "block" },
    { x: 22, z: 38.5, ry: 0.04, w: 7, d: 6, floors: 2, wall: 0xdfe3d8, roof: 0x6a7480, roofType: "hip", fence: "hedge" },
    { x: 29, z: 27, ry: -0.03, w: 6.5, d: 5, floors: 1, wall: 0xf0e8d6, roof: 0x5d6a78, roofType: "gable", fence: null },
    // 铁轨北侧住宅区
    { x: -21, z: -38, ry: 0.05, w: 7.5, d: 6, floors: 2, wall: 0xf4f2ea, roof: 0x5c6b62, roofType: "gable", fence: "block" },
    { x: -5, z: -42, ry: -0.06, w: 6.5, d: 5.5, floors: 2, wall: 0xd9e4e7, roof: 0x6a7480, roofType: "hip", fence: "hedge" },
    { x: 9, z: -39.5, ry: 0.04, w: 8, d: 6, floors: 2, wall: 0xefe0cf, roof: 0x54565e, roofType: "gable", fence: "wood" },
    { x: 24, z: -44, ry: -0.05, w: 7, d: 6, floors: 2, wall: 0xf0e8d6, roof: 0x5d6a78, roofType: "hip", fence: "block" },
    { x: -30, z: -50, ry: 0.03, w: 7, d: 5.5, floors: 1, wall: 0xe7dcc6, roof: 0x6a7480, roofType: "gable", fence: "hedge" },
    { x: 16, z: -56, ry: 0.05, w: 7.5, d: 6, floors: 2, wall: 0xdfe3d8, roof: 0x54565e, roofType: "gable", fence: "wood" },
    { x: -14, z: -58, ry: -0.04, w: 8, d: 6, floors: 2, wall: 0xf4f2ea, roof: 0x5c6b62, roofType: "hip", fence: "hedge" },
  ];
  for (const h of houses) scene.add(makeHouse(h));

  /* ---- 北侧路旁连续矮墙与绿化 ---- */
  const wallMat = toon(0xb9b4a8);
  scene.add(box(9, 1.1, 0.24, wallMat, 19.5, 0.55, -29.5, { cs: false }));
  for (let i = 0; i < 7; i++) {
    scene.add(box(1.3, rr(0.75, 1.0), 0.8, toon(PAL.leafDark), 15.8 + i * 1.28, 0.45, -31.2, { cs: false }));
  }
}
