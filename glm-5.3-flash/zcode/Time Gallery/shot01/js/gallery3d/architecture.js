// architecture.js — 万神殿式圆厅：鼓座墙 + 藻井穹顶 + 天窗 + 拱券 + 壁柱 + 齿饰 + 线脚 + 地面拼花 + 门厅
// 全部真实几何（Shape+Extrude / Instanced / Lathe），零贴图伪装细节。

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const DEG = Math.PI / 180;

// ---- 全局尺寸 ----
export const DIM = {
  R: 15,            // 内半径
  WALL_H: 11,       // 鼓座墙高（穹顶起拱线）
  DOME_R: 15,       // 穹顶内表面半径
  OCULUS_R: 2.7,    // 天窗圆洞半径
  FLOOR_R: 15.4,    // 地面圆盘半径
  EYE: 1.7,         // 视高
  BAY: 30,          // 每 bay 角宽
  PAINT_THETAS: [30, 60, 90, 120, 150, 210, 240, 270, 300, 330], // 10 个挂画 bay（最多 9 幅也够放）
  ALTAR_THETA: 180, // 祭坛 bay（大壁龛 + 石瓮）
  DOOR_HALF_W: 1.7,
  DOOR_JAMB_H: 3.1,
  R_MAX: 13.8,      // 玩家活动半径
};

function polar(thetaDeg, r, y = 0) {
  const t = thetaDeg * DEG;
  return new THREE.Vector3(Math.sin(t) * r, y, Math.cos(t) * r);
}

/** 拼接多个 BufferGeometry（转 non-indexed，position/normal/uv） */
function mergeGeoms(geoms) {
  const list = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

function mesh(geo, mat, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** 门洞/拱轮廓：矩形门梃 + 半圆拱顶（顺时针，用作 hole），可带 x 偏移 */
function archPath(halfW, yBase, jambH, r, x0 = 0) {
  const p = new THREE.Path();
  p.moveTo(x0 - halfW, yBase);
  p.lineTo(x0 - halfW, yBase + jambH);
  p.absarc(x0, yBase + jambH, r, Math.PI, 0, true);
  p.lineTo(x0 + halfW, yBase);
  p.closePath();
  return p;
}

/** 拱洞轮廓（ShapeGeometry 用，含底边） */
function archOutline(halfW, yBase, jambH, r) {
  const s = new THREE.Shape();
  s.moveTo(-halfW, yBase);
  s.lineTo(-halfW, yBase + jambH);
  s.absarc(0, yBase + jambH, r, Math.PI, 0, true);
  s.lineTo(halfW, yBase);
  s.closePath();
  return s;
}

/* ==================================================================== */

export function buildArchitecture(scene, mats) {
  const { M } = mats;
  const group = new THREE.Group();
  group.name = 'rotunda';
  scene.add(group);
  const disposables = [];
  const track = (g) => { disposables.push(g); return g; };

  /* ---------- 天空 ---------- */
  const sky = new Sky();
  sky.scale.setScalar(450);
  const su = sky.material.uniforms;
  su.turbidity.value = 5;
  su.rayleigh.value = 2.2;
  su.mieCoefficient.value = 0.005;
  su.mieDirectionalG.value = 0.8;
  const sunPhi = DEG * (90 - 62);
  const sunTheta = DEG * 175;
  su.sunPosition.value.setFromSphericalCoords(1, sunPhi, sunTheta);
  group.add(sky);

  /* ---------- 半球穹顶（内表面） ---------- */
  const thetaOculus = Math.asin(DIM.OCULUS_R / DIM.DOME_R);
  const domeGeo = new THREE.SphereGeometry(
    DIM.DOME_R, 96, 48, 0, Math.PI * 2, thetaOculus, Math.PI / 2 - thetaOculus
  );
  const dome = mesh(track(domeGeo), M.dome, { receive: true });
  dome.position.set(0, DIM.WALL_H, 0);
  group.add(dome);

  /* ---------- 藻井：4 圈凹入方格（金描边框 + 凹入暗面板），越靠顶越密 ---------- */
  {
    const cofferRings = [
      [0.185, 0.50], [0.50, 0.82], [0.82, 1.16], [1.16, 1.55],
    ];
    const domeCenter = new THREE.Vector3(0, DIM.WALL_H, 0);
    const cofferBaseR = 14.9;
    for (const [t0, t1] of cofferRings) {
      const tC = (t0 + t1) / 2;
      const h = DIM.DOME_R * (t1 - t0) * 0.74;             // 格高
      const arc = 2 * Math.PI * DIM.DOME_R * Math.sin(tC); // 该纬线圈周长
      const n = Math.max(6, Math.floor(arc / (h * 1.06))); // 近正方
      const w = (arc / n) * 0.9;                           // 留 10% 缝
      const bar = 0.2, fd = 0.16;

      const frameGeo = track(mergeGeoms([
        new THREE.BoxGeometry(w, bar, fd).translate(0, (h - bar) / 2, fd / 2),
        new THREE.BoxGeometry(w, bar, fd).translate(0, -(h - bar) / 2, fd / 2),
        new THREE.BoxGeometry(bar, h - 2 * bar, fd).translate((w - bar) / 2, 0, fd / 2),
        new THREE.BoxGeometry(bar, h - 2 * bar, fd).translate(-(w - bar) / 2, 0, fd / 2),
      ]));
      const panelGeo = track(new THREE.BoxGeometry(w - 0.26, h - 0.26, 0.06).translate(0, 0, -0.02));

      const imFrame = new THREE.InstancedMesh(frameGeo, M.gold, n);
      const imPanel = new THREE.InstancedMesh(panelGeo, M.cofferPanel, n);
      imFrame.receiveShadow = true;
      imPanel.receiveShadow = true;

      const mat4 = new THREE.Matrix4();
      const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
      const P = new THREE.Vector3(), d = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2 + t0 * 3.7; // 各圈错缝
        d.set(Math.sin(tC) * Math.cos(phi), Math.cos(tC), Math.sin(tC) * Math.sin(phi));
        // 局部坐标：X=经线向、Y=纬线向、Z=指向穹顶圆心（右手系）
        X.set(Math.cos(tC) * Math.cos(phi), -Math.sin(tC), Math.cos(tC) * Math.sin(phi));
        Y.set(-Math.sin(phi), 0, Math.cos(phi));
        Z.copy(d).negate();
        mat4.makeBasis(X, Y, Z);
        P.copy(domeCenter).addScaledVector(d, cofferBaseR);
        mat4.setPosition(P);
        imFrame.setMatrixAt(i, mat4);
        imPanel.setMatrixAt(i, mat4);
      }
      imFrame.instanceMatrix.needsUpdate = true;
      imPanel.instanceMatrix.needsUpdate = true;
      group.add(imFrame, imPanel);
    }
  }

  /* ---------- 天窗圆洞边口 ---------- */
  {
    const rimBot = DIM.WALL_H + DIM.DOME_R * Math.cos(thetaOculus);
    const rimH = 1.2;
    const rim = mesh(track(new THREE.CylinderGeometry(3.35, 3.35, rimH, 48, 1, true)), M.trimWarmDS, { receive: true });
    rim.position.set(0, rimBot + rimH / 2, 0);
    group.add(rim);
    const rimCap = mesh(track(new THREE.RingGeometry(DIM.OCULUS_R, 3.35, 48)), M.trimWarmDS, { receive: false });
    rimCap.rotation.x = Math.PI / 2;
    rimCap.position.set(0, rimBot + rimH, 0);
    group.add(rimCap);
    const oculusRing = mesh(track(new THREE.TorusGeometry(3.0, 0.07, 10, 64)), M.gold, { receive: false });
    oculusRing.rotation.x = Math.PI / 2;
    oculusRing.position.set(0, rimBot + rimH - 0.05, 0);
    group.add(oculusRing);
    // 天窗周围金眉线（贴穹顶）
    const browT = thetaOculus + 0.035;
    const brow = mesh(track(new THREE.TorusGeometry(DIM.DOME_R * Math.sin(browT), 0.05, 8, 72)), M.gold, { receive: false });
    brow.rotation.x = Math.PI / 2;
    brow.position.set(0, DIM.WALL_H + DIM.DOME_R * Math.cos(browT), 0);
    group.add(brow);
  }

  /* ---------- 环形线脚：勒脚 / 腰线 / 檐口 ---------- */
  {
    const bands = [
      [0.0, 0.9, 14.9, M.trimHoneyDS],     // 勒脚
      [4.9, 5.1, 14.94, M.trimWarmDS],     // 腰线
      [9.89, 10.19, 14.92, M.trimWarmDS],  // 檐口下层
      [10.19, 10.41, 14.8, M.trimHoneyDS], // 檐口中层
      [10.41, 11.0, 14.7, M.trimWarmDS],   // 檐口上层（抵起拱线）
    ];
    for (const [y0, y1, r, mat] of bands) {
      const b = mesh(track(new THREE.CylinderGeometry(r, r, y1 - y0, 128, 1, true)), mat, { receive: true });
      b.position.y = (y0 + y1) / 2;
      group.add(b);
    }
    const torusBands = [
      [0.92, 14.84, 0.06, M.bandWarm],
      [5.12, 14.86, 0.05, M.bandWarm],
      [10.41, 14.8, 0.045, M.gold],
      [11.0, 15.0, 0.12, M.bandWarm],
    ];
    for (const [y, R, tube, mat] of torusBands) {
      const t = mesh(track(new THREE.TorusGeometry(R, tube, 12, 128)), mat, { receive: false });
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      group.add(t);
    }
  }

  /* ---------- 齿饰（instanced 小齿块，起拱线檐口下） ---------- */
  {
    const n = 222;
    const geo = track(new THREE.BoxGeometry(0.22, 0.34, 0.14));
    const im = new THREE.InstancedMesh(geo, M.trimWarm, n);
    im.castShadow = true;
    im.receiveShadow = true;
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      mat4.makeRotationY(a);
      mat4.setPosition(Math.sin(a) * 14.86, 9.71, Math.cos(a) * 14.86);
      im.setMatrixAt(i, mat4);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  /* ---------- 壁柱（instanced：柱础 + 柱腰 + 柱身 + 倒锥柱头 + 方板） ---------- */
  {
    const count = 12;
    function part(geo, mat, rotYQuarter = false) {
      const im = new THREE.InstancedMesh(track(geo), mat, count);
      im.castShadow = true;
      im.receiveShadow = true;
      const mat4 = new THREE.Matrix4();
      const e = new THREE.Euler();
      const q = new THREE.Quaternion();
      for (let i = 0; i < count; i++) {
        const a = 15 + i * 30;
        e.set(0, a * DEG + (rotYQuarter ? Math.PI / 4 : 0), 0);
        q.setFromEuler(e);
        mat4.makeRotationFromQuaternion(q);
        const p = polar(a, DIM.R, 0);
        mat4.setPosition(p.x, 0, p.z);
        im.setMatrixAt(i, mat4);
      }
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }
    part(new THREE.BoxGeometry(0.78, 0.5, 0.36).translate(0, 0.25, -0.18), M.trimWarm);
    part(new THREE.BoxGeometry(0.68, 0.24, 0.3).translate(0, 0.62, -0.15), M.trimHoney);
    part(new THREE.BoxGeometry(0.62, 8.3, 0.28).translate(0, 4.89, -0.14), M.shaftStone);
    part(new THREE.CylinderGeometry(0.34, 0.23, 0.26, 4, 1).translate(0, 9.17, -0.14), M.trimHoney, true);
    part(new THREE.BoxGeometry(0.74, 0.14, 0.32).translate(0, 9.37, -0.16), M.trimWarm);
  }

  /* ---------- bay 墙面板（挂画 bay；入口/祭坛 bay 用带洞实体墙，不在此列）---------- */
  {
    const panelGeo = track(new THREE.PlaneGeometry(7.2, 11));
    for (const th of DIM.PAINT_THETAS) {
      const p = mesh(panelGeo, M.wallWarm, { receive: true });
      p.position.copy(polar(th, DIM.R, 5.5));
      p.rotation.y = th * DEG + Math.PI;
      group.add(p);
    }
    // 背衬圆筒（封住相邻平面墙板之间的楔形缝；入口 bay 与祭坛 bay 用实体墙，留空）
    for (const [startDeg, lenDeg] of [[15.001, 149.998], [195.001, 149.998]]) {
      const backing = mesh(
        track(new THREE.CylinderGeometry(15.15, 15.15, 11, 96, 1, true, startDeg * DEG, lenDeg * DEG)),
        M.backingStone, { receive: true }
      );
      backing.position.y = 5.5;
      group.add(backing);
    }
  }

  /* ---------- 挂画 bay 拱券：石拱框 + 金拱ivolt + 暗板 + 金锁石 ---------- */
  for (const th of DIM.PAINT_THETAS) {
    const g = new THREE.Group();
    g.position.copy(polar(th, 14.72, 0));
    g.rotation.y = th * DEG;

    // 石拱框：外矩形 5.4×3.4（y 5.3–8.7），洞 = 拱（半宽1.85，楦高1.25，半径1.85）
    const outer = new THREE.Shape();
    outer.moveTo(-2.7, 5.3); outer.lineTo(2.7, 5.3);
    outer.lineTo(2.7, 8.7); outer.lineTo(-2.7, 8.7);
    outer.closePath();
    outer.holes.push(archPath(1.85, 5.3, 1.25, 1.85));
    const frameGeo = track(new THREE.ExtrudeGeometry(outer, { depth: 0.28, bevelEnabled: false, curveSegments: 28 }));
    const frame = mesh(frameGeo, M.trimWarm, { cast: true, receive: true });
    g.add(frame);

    // 金拱ivolt：洞轮廓外扩 0.16 的环带
    const band = new THREE.Shape();
    band.moveTo(-2.01, 5.3); band.lineTo(2.01, 5.3);
    band.lineTo(2.01, 6.55); band.absarc(0, 6.55, 2.01, 0, Math.PI, false);
    band.lineTo(-2.01, 5.3);
    band.closePath();
    band.holes.push(archPath(1.85, 5.3, 1.25, 1.85));
    const bandGeo = track(new THREE.ExtrudeGeometry(band, { depth: 0.3, bevelEnabled: false, curveSegments: 28 }));
    const bandMesh = mesh(bandGeo, M.gold, { receive: true });
    bandMesh.position.z = -0.02;
    g.add(bandMesh);

    // 拱洞内暗板（拱腹线脚内衬）
    const darkGeo = track(new THREE.ShapeGeometry(archOutline(1.85, 5.3, 1.25, 1.85), 24));
    const dark = mesh(darkGeo, M.trimDark, { receive: true });
    dark.rotation.y = Math.PI;
    dark.position.z = 0.09;
    g.add(dark);

    // 金锁石
    const key = mesh(track(new THREE.BoxGeometry(0.34, 0.52, 0.34)), M.gold, { cast: true });
    key.position.set(0, 8.62, -0.05);
    g.add(key);

    group.add(g);
  }

  /* ---------- 入口 bay：可通行大拱门洞（真实开洞，洞深 0.85m）+ 金拱ivolt + 门侧壁龛 ---------- */
  {
    const hw = DIM.DOOR_HALF_W, jh = DIM.DOOR_JAMB_H;
    const wall = new THREE.Shape();
    wall.moveTo(-3.88, 0); wall.lineTo(3.88, 0);
    wall.lineTo(3.88, 11); wall.lineTo(-3.88, 11);
    wall.closePath();
    wall.holes.push(archPath(hw, 0, jh, hw));
    // 门侧两个凹入壁龛孔（浮动拱形孔：y 1.1–3.05，半宽 0.55）
    for (const nx of [-2.72, 2.72]) wall.holes.push(archPath(0.55, 1.1, 1.4, 0.55, nx));
    const wallGeo = track(new THREE.ExtrudeGeometry(wall, { depth: 0.85, bevelEnabled: false, curveSegments: 32 }));
    const wallMesh = mesh(wallGeo, M.wallExtrude, { cast: true, receive: true });
    wallMesh.position.copy(polar(0, DIM.R, 0)); // 内面 z=15，向 +Z 加厚
    group.add(wallMesh);

    // 金拱ivolt（厅内侧）
    const band = new THREE.Shape();
    band.moveTo(-(hw + 0.24), 0); band.lineTo(hw + 0.24, 0);
    band.lineTo(hw + 0.24, jh);
    band.absarc(0, jh, hw + 0.24, 0, Math.PI, false);
    band.lineTo(-(hw + 0.24), 0);
    band.closePath();
    band.holes.push(archPath(hw, 0, jh, hw));
    const bandGeo = track(new THREE.ExtrudeGeometry(band, { depth: 0.16, bevelEnabled: false, curveSegments: 32 }));
    const bandMesh = mesh(bandGeo, M.gold, { receive: true });
    bandMesh.position.copy(polar(0, DIM.R - 0.16, 0));
    group.add(bandMesh);

    // 门侧壁龛内部（暗背板 + 括座 + 石瓮 + 暖点光），孔位于墙面 x=±2.72
    for (const nx of [-2.72, 2.72]) makeNicheInterior(group, M, disposables, nx, DIM.R, 0.55, 0.5);
  }

  /* ---------- 祭坛 bay：凹入大壁龛（真实开洞）+ 大石瓮 + 侧瓮 ---------- */
  {
    const g = new THREE.Group();
    g.position.copy(polar(DIM.ALTAR_THETA, DIM.R, 0));
    g.rotation.y = DIM.ALTAR_THETA * DEG;

    const nhw = 1.8, njh = 2.33, nr = 1.8, nyb = 0.55; // 孔底抬高，避免地面圆盘穿进龛内
    const wall = new THREE.Shape();
    wall.moveTo(-3.88, 0); wall.lineTo(3.88, 0);
    wall.lineTo(3.88, 11); wall.lineTo(-3.88, 11);
    wall.closePath();
    wall.holes.push(archPath(nhw, nyb, njh, nr));
    const wallGeo = track(new THREE.ExtrudeGeometry(wall, { depth: 0.85, bevelEnabled: false, curveSegments: 32 }));
    const wallMesh = mesh(wallGeo, M.wallExtrude, { cast: true, receive: true });
    g.add(wallMesh);

    // 金拱ivolt（厅内侧）
    const band = new THREE.Shape();
    band.moveTo(-(nhw + 0.2), nyb); band.lineTo(nhw + 0.2, nyb);
    band.lineTo(nhw + 0.2, nyb + njh);
    band.absarc(0, nyb + njh, nhw + 0.2, 0, Math.PI, false);
    band.lineTo(-(nhw + 0.2), nyb);
    band.closePath();
    band.holes.push(archPath(nhw, nyb, njh, nr));
    const bandGeo = track(new THREE.ExtrudeGeometry(band, { depth: 0.14, bevelEnabled: false, curveSegments: 32 }));
    const bandMesh = mesh(bandGeo, M.gold, { receive: true });
    bandMesh.position.z = -0.14;
    g.add(bandMesh);

    // 龛内：暗背板 + 石台 + 大石瓮 + 暖点光
    const back = mesh(track(new THREE.BoxGeometry(nhw * 2 - 0.12, njh + nr - 0.14, 0.08)), M.trimDark, { receive: true });
    back.position.set(0, nyb + (njh + nr) / 2, 0.74);
    g.add(back);
    const ped = mesh(track(new THREE.BoxGeometry(1.6, 1.0, 0.9)), M.stone, { cast: true, receive: true });
    ped.position.set(0, nyb + 0.5, 0.26);
    g.add(ped);
    const bigUrn = makeUrn(M, disposables, 1.3);
    bigUrn.position.set(0, nyb + 1.0, 0.26);
    g.add(bigUrn);
    const nl = new THREE.PointLight(0xffd9a8, 0.9, 7, 2);
    nl.position.set(0, nyb + 2.4, 0.32);
    g.add(nl);

    // 两侧石台石瓮（贴墙面，凸向厅内 = -Z 局部）
    for (const sx of [-2.62, 2.62]) {
      const pl = mesh(track(new THREE.BoxGeometry(0.85, 1.15, 0.85)), M.stoneHoney, { cast: true, receive: true });
      pl.position.set(sx, 0.575, -0.42);
      g.add(pl);
      const urn = makeUrn(M, disposables, 0.95);
      urn.position.set(sx, 1.15, -0.42);
      g.add(urn);
    }
    group.add(g);
  }

  /* ---------- 地面：镜面 + 半透明大理石面 + 中心拼花（半径越过墙洞，遮住镜面边缘） ---------- */
  const reflector = new Reflector(track(new THREE.CircleGeometry(16.9, 96)), {
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x9a9a9a,
    clipBias: 0.003,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0.002;
  const rawOBR = reflector.onBeforeRender;
  reflector.onBeforeRender = (renderer, sc, cam) => {
    if (sc.overrideMaterial) return; // SSAO 法线 pass 时跳过，防污染反射纹理
    rawOBR(renderer, sc, cam);
  };
  group.add(reflector);

  {
    const overlay = mesh(track(new THREE.CircleGeometry(16.9, 96)), M.floorOverlay, { receive: true });
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.y = 0.014;
    group.add(overlay);
  }

  // 中心拼花（同心环 + 放射条，错层防 z-fighting）
  {
    const medallion = new THREE.Group();
    function flatRing(r0, r1, y, mat) {
      const m = mesh(track(new THREE.RingGeometry(r0, r1, 96)), mat, { receive: true });
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      medallion.add(m);
    }
    flatRing(3.3, DIM.FLOOR_R, 0.03, M.floorMedallionB);
    flatRing(6.0, 6.08, 0.036, M.gold);
    flatRing(4.5, 6.0, 0.032, M.floorMedallionA);
    flatRing(4.42, 4.5, 0.036, M.gold);
    flatRing(3.6, 4.42, 0.034, M.floorMedallionHoney);
    flatRing(3.52, 3.6, 0.038, M.gold);
    flatRing(1.62, 3.52, 0.036, M.floorMedallionB);
    flatRing(1.5, 1.62, 0.04, M.gold);
    flatRing(0.001, 1.5, 0.038, M.floorMedallionA);
    // 放射条（3.6–4.42 之间，交替色）
    const stripGeo = track(new THREE.BoxGeometry(0.16, 0.014, 0.78));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const s = mesh(stripGeo, i % 2 ? M.floorMedallionA : M.stoneHoney, { receive: true });
      s.position.set(Math.sin(a) * 4.01, 0.044, Math.cos(a) * 4.01);
      s.rotation.y = a;
      medallion.add(s);
    }
    group.add(medallion);
  }

  /* ---------- 门厅（反黑洞）：短通道 + 尽头暖光渐变板 + 点光 ---------- */
  {
    const vz0 = DIM.R + 0.85; // 15.85
    const vz1 = 18.6;
    const vzC = (vz0 + vz1) / 2 + 0.2;

    const vFloor = mesh(track(new THREE.BoxGeometry(4.3, 0.04, vz1 - vz0 + 0.4)), M.floorMedallionB, { receive: true });
    vFloor.position.set(0, -0.002, vzC); // 顶面 y=0.018，盖住延伸进门厅的大理石圆盘（y=0.014）
    group.add(vFloor);

    const sideGeo = track(new THREE.BoxGeometry(0.3, 5.2, vz1 - vz0 + 0.3));
    for (const sx of [-2.0, 2.0]) {
      const w = mesh(sideGeo, M.wallHoney, { receive: true });
      w.position.set(sx, 2.6, vzC);
      group.add(w);
    }

    const ceil = mesh(track(new THREE.BoxGeometry(4.3, 0.3, vz1 - vz0 + 0.3)), M.wallWarm, { receive: true });
    ceil.position.set(0, 5.05, vzC);
    group.add(ceil);

    const end = mesh(track(new THREE.BoxGeometry(4.3, 5.2, 0.3)), M.wallWarm, { receive: true });
    end.position.set(0, 2.6, vz1);
    group.add(end);

    // 尽头发光渐变板（模拟室外天光）
    const glow = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 4.5)), M.glowPanel);
    glow.position.set(0, 2.35, vz1 - 0.16);
    glow.rotation.y = Math.PI;
    group.add(glow);

    const pLight = new THREE.PointLight(0xffd9a8, 46, 13, 2);
    pLight.position.set(0, 3.3, vzC);
    group.add(pLight);
  }

  /* ---------- 光照 ---------- */
  const hemi = new THREE.HemisphereLight(0xfff2dc, 0x8a7a5e, 0.3);
  group.add(hemi);
  const ambient = new THREE.AmbientLight(0xfff6e8, 0.1);
  group.add(ambient);

  const mainSpot = new THREE.SpotLight(0xfff0d8, 1500, 60, 0.5, 0.6, 2);
  mainSpot.position.set(0, 27, 0);
  mainSpot.target.position.set(0, 0, 0);
  mainSpot.castShadow = true;
  mainSpot.shadow.mapSize.set(2048, 2048);
  mainSpot.shadow.camera.near = 4;
  mainSpot.shadow.camera.far = 60;
  mainSpot.shadow.bias = -0.0002;
  mainSpot.shadow.normalBias = 0.03;
  group.add(mainSpot, mainSpot.target);

  /* ---------- 天窗光柱（倒锥，附加混合，纵向渐隐） ---------- */
  function cone(topR, botR, opacity) {
    const geo = track(new THREE.CylinderGeometry(topR, botR, 26, 48, 1, true));
    const mat = track(new THREE.MeshBasicMaterial({
      color: 0xffedc2, map: mats.T.coneFade, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    const c = new THREE.Mesh(geo, mat);
    c.position.y = 13.2;
    c.renderOrder = 5;
    group.add(c);
  }
  cone(2.75, 7.2, 0.03);
  cone(2.2, 4.6, 0.02);

  return {
    group, sky, mainSpot, hemi, ambient,
    doorCenter: new THREE.Vector3(0, 0, DIM.R),
    paintingSlots: DIM.PAINT_THETAS.map((t) => ({ thetaDeg: t })),
    dispose() {
      for (const d of disposables) d.dispose && d.dispose();
      scene.remove(group);
    },
  };
}

/** 石瓮（LatheGeometry） */
export function makeUrn(M, disposables, scale = 1) {
  const pts = [
    [0.0, 0.0], [0.3, 0.02], [0.46, 0.1], [0.56, 0.26], [0.6, 0.45],
    [0.55, 0.68], [0.44, 0.9], [0.32, 1.08], [0.27, 1.24], [0.28, 1.36],
    [0.36, 1.46], [0.4, 1.56], [0.37, 1.68], [0.26, 1.76], [0.3, 1.84],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.scale(scale, scale, scale);
  const urn = new THREE.Mesh(geo, M.stoneHoney);
  urn.castShadow = true;
  urn.receiveShadow = true;
  disposables.push(geo);
  // 金口沿线
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.3 * scale, 0.022 * scale, 8, 32), M.gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.84 * scale;
  urn.add(lip);
  disposables.push(lip.geometry);
  return urn;
}

/** 凹入壁龛内部：暗背板 + 金口槛 + 括座 + 小石瓮 + 暖点光（配合墙体真实开洞使用）
 *  (x, wallZ) 为墙面内表面上的孔位（入口 bay：世界坐标），孔洞轮廓 y 1.1–3.05、半宽 0.55 */
export function makeNicheInterior(group, M, disposables, x, wallZ, halfW, urnScale) {
  const back = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.06, 1.85, 0.06), M.trimDark);
  back.position.set(x, 2.07, wallZ + 0.66);
  back.receiveShadow = true;
  group.add(back);
  disposables.push(back.geometry);

  const sill = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.14, 0.06, 0.12), M.gold);
  sill.position.set(x, 1.1, wallZ - 0.05);
  group.add(sill);
  disposables.push(sill.geometry);

  const br = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.5, 0.55, halfW * 0.9), M.stone);
  br.position.set(x, 1.42, wallZ + 0.32);
  br.castShadow = true;
  br.receiveShadow = true;
  group.add(br);
  disposables.push(br.geometry);

  const urn = makeUrn(M, disposables, urnScale);
  urn.position.set(x, 1.7, wallZ + 0.32);
  group.add(urn);

  const l = new THREE.PointLight(0xffd9a8, 0.35, 4.5, 2);
  l.position.set(x, 2.72, wallZ + 0.42);
  group.add(l);
}
