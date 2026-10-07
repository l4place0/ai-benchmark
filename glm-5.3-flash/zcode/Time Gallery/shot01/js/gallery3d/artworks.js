// artworks.js — 画作装配：金框（斜切条 + 内衬）+ 画面 + 背板 + 铭牌 + 每画一盏暖色射灯
// enterPeriod 时只换纹理/尺寸/铭牌，旧纹理与几何全部 dispose 防泄漏。

import * as THREE from 'three';
import { makePlaqueCanvas, makePlaceholderCanvas } from './materials.js';

const DEG = Math.PI / 180;
const CENTER_Y = 2.3;   // 画面中心高
const MAX_W = 5.6;      // bay 可用宽度
const HOVER_EMISSIVE = new THREE.Color(0x6b4e12);

function polarPos(thetaDeg, r, y = 0) {
  const t = thetaDeg * DEG;
  return new THREE.Vector3(Math.sin(t) * r, y, Math.cos(t) * r);
}

/** 斜切梯形截面挤出：单根画框条（局部坐标，画框中心为原点） */
function frameBarGeo(L, barW, depth) {
  // L=半长（外缘），梯形两端 45° 斜切
  const s = new THREE.Shape();
  s.moveTo(-L, 0);
  s.lineTo(L, 0);
  s.lineTo(L - barW, barW);
  s.lineTo(-L + barW, barW);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, -barW / 2, -depth / 2); // 条中心在原点，厚度向 ±z
  return g;
}

export class ArtworkRig {
  /**
   * @param scene 三维场景
   * @param mats  材质库（createMaterialLibrary 返回值）
   * @param slots [{thetaDeg}]
   */
  constructor(scene, mats, slots) {
    this.scene = scene;
    this.mats = mats;
    this.loader = new THREE.TextureLoader();
    this.canvasMeshes = [];
    this.items = [];
    this.hoverIndex = -1;

    for (const slot of slots) {
      const th = slot.thetaDeg;
      const root = new THREE.Group();
      root.position.copy(polarPos(th, 15, 0));
      root.rotation.y = th * DEG + Math.PI; // 局部 +Z 朝厅心
      scene.add(root);

      const content = new THREE.Group();
      content.position.y = CENTER_Y; // 画面中心高 2.3m
      content.visible = false;
      root.add(content);

      // 每画一盏暖色射灯（不投影）
      const spot = new THREE.SpotLight(0xffd9a8, 130, 16, 0.45, 0.7, 2);
      spot.position.copy(polarPos(th, 8.6, 6.3));
      spot.castShadow = false;
      scene.add(spot, spot.target);
      spot.target.position.copy(polarPos(th, 14.9, CENTER_Y));

      const frameMat = mats.cloneGold();
      frameMat.emissive = new THREE.Color(0x000000);

      this.items.push({
        thetaDeg: th, root, content, spot, frameMat,
        geos: [], texs: [], canvasMesh: null, painting: null,
      });
    }
  }

  /** 计算画作尺寸：目标高 2.7m，clamp [1.8,3.0]，宽超限则以宽定高 */
  static sizeOf(painting) {
    const pxW = Math.max(1, painting.width || 1);
    const pxH = Math.max(1, painting.height || 1);
    const aspect = pxW / pxH;
    let h = 2.7;
    let w = h * aspect;
    if (w > MAX_W) { w = MAX_W; h = w / aspect; }
    if (h > 3.0) { h = 3.0; w = h * aspect; }
    if (h < 1.8) { h = 1.8; w = h * aspect; }
    return { w, h, aspect };
  }

  /** 切换时期画作（list 可短于 slot 数） */
  setPaintings(list, assetBase = '') {
    this.clearHover();
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      this.disposeItem(it);
      const painting = list && list[i];
      if (!painting) { it.painting = null; it.content.visible = false; continue; }
      it.painting = painting;
      this.buildItem(it, painting, assetBase);
      it.content.visible = true;
    }
  }

  disposeItem(it) {
    const c = it.content;
    while (c.children.length) {
      const child = c.children.pop();
      child.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m && m !== it.frameMat && m !== this.mats.M.bronze && m !== this.mats.M.backboard && m !== this.mats.M.gold) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
    }
    if (it.canvasMesh) {
      const idx = this.canvasMeshes.indexOf(it.canvasMesh);
      if (idx >= 0) this.canvasMeshes.splice(idx, 1);
    }
    it.canvasMesh = null;
  }

  buildItem(it, painting, assetBase) {
    const { w, h, aspect } = ArtworkRig.sizeOf(painting);
    const barW = Math.min(0.22, Math.max(0.15, 0.15 + Math.max(w, h) * 0.012));
    const depth = 0.09;
    const c = it.content;

    /* 背板 */
    const backGeo = new THREE.BoxGeometry(w + 0.26, h + 0.26, 0.05);
    const back = new THREE.Mesh(backGeo, this.mats.M.backboard);
    back.position.z = 0.025;
    back.castShadow = true;
    c.add(back);
    it.geos.push(backGeo);

    /* 画面（raycast 目标） */
    const canvasGeo = new THREE.PlaneGeometry(w, h);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.85, metalness: 0.0,
    });
    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    canvasMesh.position.z = 0.055;
    canvasMesh.castShadow = true;
    canvasMesh.userData.painting = painting;
    canvasMesh.userData.slotIndex = this.items.indexOf(it);
    c.add(canvasMesh);
    it.canvasMesh = canvasMesh;
    this.canvasMeshes.push(canvasMesh);
    it.geos.push(canvasGeo);

    // 纹理加载（失败 → 灰底标题占位）
    const tex = this.loader.load(
      assetBase + painting.file,
      (t) => { t.anisotropy = this.mats.maxAniso; },
      undefined,
      () => {
        console.warn(`[gallery3d] 画作纹理加载失败，使用占位图：${painting.file}`);
        const phCanvas = makePlaceholderCanvas(painting.titleZh || painting.titleEn || '画作', aspect);
        const phTex = new THREE.CanvasTexture(phCanvas);
        phTex.colorSpace = THREE.SRGBColorSpace;
        phTex.anisotropy = this.mats.maxAniso;
        it.texs.push(phTex);
        canvasMat.map = phTex;
        canvasMat.needsUpdate = true;
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.mats.maxAniso;
    canvasMat.map = tex;
    it.texs.push(tex);

    /* 金框：4 根斜切条 + 内衬线脚 */
    const L = w / 2 + barW;
    const H = h / 2 + barW;
    const barLong = frameBarGeo(L, barW, depth);
    const barShort = frameBarGeo(H, barW, depth);
    it.geos.push(barLong, barShort);
    const bars = [
      { g: barLong, x: 0, y: h / 2 + barW / 2, rz: Math.PI },
      { g: barLong, x: 0, y: -(h / 2 + barW / 2), rz: 0 },
      { g: barShort, x: w / 2 + barW / 2, y: 0, rz: Math.PI / 2 },
      { g: barShort, x: -(w / 2 + barW / 2), y: 0, rz: -Math.PI / 2 },
    ];
    for (const b of bars) {
      const m = new THREE.Mesh(b.g, it.frameMat);
      m.position.set(b.x, b.y, 0.03 + depth / 2);
      m.rotation.z = b.rz;
      m.castShadow = true;
      c.add(m);
    }
    // 内衬（深金细条）
    const linerMat = this.mats.M.bronze;
    const linerH = new THREE.BoxGeometry(w + 0.1, 0.05, 0.06);
    const linerV = new THREE.BoxGeometry(0.05, h + 0.1, 0.06);
    it.geos.push(linerH, linerV);
    for (const [geo, x, y] of [
      [linerH, 0, h / 2 + 0.025], [linerH, 0, -h / 2 - 0.025],
      [linerV, w / 2 + 0.025, 0], [linerV, -w / 2 - 0.025, 0],
    ]) {
      const m = new THREE.Mesh(geo, linerMat);
      m.position.set(x, y, 0.05);
      c.add(m);
    }

    /* 铭牌：下方墙面 → 侧方墙面 → 画框底条 三级回退 */
    const bottomY = CENTER_Y - h / 2;
    let plaque = null;
    if (bottomY - 0.36 >= 1.0) {
      plaque = this.makePlaque(painting, it, 1.0);
      plaque.position.set(0, bottomY - 0.36, 0.012);
    } else if (w / 2 + barW + 0.95 <= 3.55) {
      plaque = this.makePlaque(painting, it, 1.0);
      plaque.position.set(w / 2 + barW + 0.52, 1.5, 0.012);
    } else {
      plaque = this.makePlaque(painting, it, 0.8);
      plaque.position.set(0, -h / 2 - barW / 2 - 0.02, 0.03 + depth + 0.012);
    }
    c.add(plaque);
  }

  makePlaque(painting, it, scale) {
    const g = new THREE.Group();
    const plateGeo = new THREE.BoxGeometry(0.68, 0.36, 0.03);
    const plate = new THREE.Mesh(plateGeo, this.mats.M.gold);
    g.add(plate);
    const paperGeo = new THREE.PlaneGeometry(0.62, 0.3);
    const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 }));
    const tex = new THREE.CanvasTexture(makePlaqueCanvas({
      title: painting.titleZh,
      artist: painting.artistZh,
      year: painting.year,
    }));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.mats.maxAniso;
    paper.material.map = tex;
    paper.position.z = 0.017;
    g.add(paper);
    g.scale.setScalar(scale);
    it.texs.push(tex);
    it.geos.push(plateGeo, paperGeo);
    return g;
  }

  /* ---------- 交互态 ---------- */

  setHover(index) {
    if (this.hoverIndex === index) return;
    this.hoverIndex = index;
  }

  clearHover() { this.setHover(-1); }

  /** 每帧：hover 金框 emissive 渐变 */
  update(dt) {
    const k = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.frameMat) continue;
      const target = i === this.hoverIndex ? HOVER_EMISSIVE : BLACK;
      it.frameMat.emissive.lerp(target, k);
    }
  }

  getPaintingMeshes() {
    return this.canvasMeshes.filter((m) => m.parent && m.parent.visible);
  }

  dispose() {
    for (const it of this.items) {
      this.disposeItem(it);
      this.scene.remove(it.root);
      this.scene.remove(it.spot, it.spot.target);
      it.spot.dispose();
      it.frameMat.dispose();
    }
    this.items.length = 0;
    this.canvasMeshes.length = 0;
  }
}

const BLACK = new THREE.Color(0x000000);
