/**
 * 时光画廊 (Time Gallery) - 画作装裱与展陈管理系统 (FrameManager.js)
 * 1. 自适应画作原始宽高比 (ADAPTIVE ASPECT RATIO):
 *    - 严格根据元数据中的 aspectRatio 计算宽高，宽幅画作得宽框，竖幅画作得高框
 *    - 杜绝强行拉伸、变形或统一竖版裁剪，100% 忠实还原世界传世名画原始构图
 * 2. 真实高清本地名画图像加载 (Local Masterpiece Loading):
 *    - 支持 item.localPath、item.image 与 assets/paintings/ 路径
 *    - sRGB 颜色空间、Mipmap 滤波与即时纹理更新
 * 3. 高规格古典三维雕花镀金斜面画框 (3D Gilded Beveled Picture Frame):
 *    - 实体三维线脚、斜切内衬条与四角复古雕花勋章
 * 4. 悬挂于每个展湾下方的博物馆双语黄铜展签铭牌 (Brass Nameplate)
 * 5. 完整的 userData 射线拾取元数据，支持无缝悬停与点击交互
 */

import * as THREE from 'three';
import {
  getSharedGoldLeafTextures,
  createBrassNameplateTexture,
  createPaintingPlaceholderTexture
} from './ProceduralTextures.js';

export class FrameManager {
  /**
   * @param {Object} options
   * @param {THREE.Scene|THREE.Group} options.scene 挂载画作的目标场景或根节点
   * @param {number} options.maxCanvasWidth 展湾最大可用画布宽度
   * @param {number} options.maxCanvasHeight 展湾最大可用画布高度
   */
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.maxCanvasWidth = options.maxCanvasWidth || 4.8;
    this.maxCanvasHeight = options.maxCanvasHeight || 3.4;

    // 纹理加载器
    this.textureLoader = new THREE.TextureLoader();

    // 共享镀金画框材质
    const goldTex = getSharedGoldLeafTextures();
    this.goldFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      map: goldTex.diffuse,
      roughnessMap: goldTex.roughness,
      bumpMap: goldTex.bump,
      bumpScale: 0.05,
      roughness: 0.30,
      metalness: 0.88,
      side: THREE.DoubleSide
    });

    // 画框内衬条稍深沉的古铜金材质
    this.innerLinerMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a6818,
      roughness: 0.45,
      metalness: 0.75,
      side: THREE.DoubleSide
    });

    // 展出画作集合 [{ data, frameGroup, canvasMesh, nameplateMesh, bayIndex }]
    this.mountedPaintings = [];
    this.interactiveObjects = [];

    // 几何与材质销毁清单
    this._disposables = [];
  }

  // ==========================================================================
  // 画作挂载主入口 (Mount Paintings to Bay Anchors)
  // ==========================================================================

  /**
   * 将画作列表装裱并挂载在拱券展湾中
   * @param {Array<Object>} paintingsData 画作数据列表
   * @param {Array<Object>} bayAnchors 展湾挂画锚点列表
   */
  mountPaintings(paintingsData = [], bayAnchors = []) {
    // 清除先前的画作
    this.clear();

    const count = Math.min(paintingsData.length, bayAnchors.length);

    for (let i = 0; i < count; i++) {
      const rawItem = paintingsData[i];
      const item = rawItem.representative || rawItem;
      const anchor = bayAnchors[i];

      // 1. 构建单幅自适应画作总成 (含三维画框、画布、铭牌)
      const frameGroup = this._createAdaptiveFramedPainting(item, i);

      if (anchor.alcoveGroup) {
        // 挂载在展湾内部，处于展湾背墙正前方 Z = 0.12 米，黄金展陈高度 Y = 2.4 米
        anchor.alcoveGroup.add(frameGroup);
        frameGroup.position.set(0, 2.4, 0.12);
        frameGroup.rotation.set(0, 0, 0);
      } else if (this.scene) {
        frameGroup.position.copy(anchor.position);
        frameGroup.rotation.copy(anchor.rotation);
        this.scene.add(frameGroup);
      }

      this.mountedPaintings.push({
        data: item,
        frameGroup: frameGroup,
        canvasMesh: frameGroup.userData.canvasMesh,
        nameplateMesh: frameGroup.userData.nameplateMesh,
        bayIndex: i
      });
    }

    return this.mountedPaintings;
  }

  // ==========================================================================
  // 自适应画框与画布几何构建 (Adaptive Aspect Ratio Computation)
  // ==========================================================================

  _createAdaptiveFramedPainting(item, bayIndex) {
    const rootGroup = new THREE.Group();
    rootGroup.name = `FramedPainting_${item.id || bayIndex}`;

    // 1. 严格计算原始纵横比 (Aspect Ratio Verification)
    let ar = 1.0;
    if (typeof item.aspectRatio === 'number' && item.aspectRatio > 0) {
      ar = item.aspectRatio;
    } else if (item.width && item.height) {
      ar = item.width / item.height;
    }

    // 2. 自适应约束计算：宽幅限制最大宽，竖幅限制最大高，绝不拉伸变形！
    const maxW = this.maxCanvasWidth;
    const maxH = this.maxCanvasHeight;
    const maxAr = maxW / maxH;

    let canvasW, canvasH;
    if (ar >= maxAr) {
      // 横向画作 (Landscape, 如《春》ar=1.59, 《维纳斯的诞生》ar=1.59, 《日出·印象》ar=1.29)
      canvasW = maxW;
      canvasH = maxW / ar;
    } else if (ar < 1.0) {
      // 纵向高立画作 (Portrait, 如《蒙娜丽莎》ar=0.67, 《戴珍珠耳环的少女》ar=0.86)
      canvasH = maxH;
      canvasW = maxH * ar;
    } else {
      // 接近方形画作 (Square)
      canvasH = 3.0;
      canvasW = canvasH * ar;
    }

    // 3. 高规格三维金箔画框尺寸规范
    const borderWidth = 0.20;   // 画框边框宽度 (米)
    const frameDepth = 0.14;    // 画框凸出厚度 (米)
    const totalW = canvasW + borderWidth * 2;
    const totalH = canvasH + borderWidth * 2;

    const frameGroup = new THREE.Group();

    // (1) 实体四边斜面金箔雕花木框
    // 上下主梁
    const topBarGeo = new THREE.BoxGeometry(totalW, borderWidth, frameDepth);
    const topBar = new THREE.Mesh(topBarGeo, this.goldFrameMaterial);
    topBar.position.set(0, canvasH / 2 + borderWidth / 2, frameDepth / 2);
    topBar.castShadow = true;
    frameGroup.add(topBar);

    const bottomBar = topBar.clone();
    bottomBar.position.y = - (canvasH / 2 + borderWidth / 2);
    frameGroup.add(bottomBar);

    // 左右立柱
    const sideBarGeo = new THREE.BoxGeometry(borderWidth, canvasH, frameDepth);
    const leftBar = new THREE.Mesh(sideBarGeo, this.goldFrameMaterial);
    leftBar.position.set(- (canvasW / 2 + borderWidth / 2), 0, frameDepth / 2);
    leftBar.castShadow = true;
    frameGroup.add(leftBar);

    const rightBar = leftBar.clone();
    rightBar.position.x = canvasW / 2 + borderWidth / 2;
    frameGroup.add(rightBar);

    // (2) 画框内圈斜面深色阴影衬条 (Inner Beveled Gilt Liner)
    const linerWidth = 0.045;
    const linerDepth = 0.06;
    const linerTopGeo = new THREE.BoxGeometry(canvasW + linerWidth * 2, linerWidth, linerDepth);
    const linerTop = new THREE.Mesh(linerTopGeo, this.innerLinerMaterial);
    linerTop.position.set(0, canvasH / 2 + linerWidth / 2, linerDepth / 2);
    frameGroup.add(linerTop);

    const linerBottom = linerTop.clone();
    linerBottom.position.y = - (canvasH / 2 + linerWidth / 2);
    frameGroup.add(linerBottom);

    const linerSideGeo = new THREE.BoxGeometry(linerWidth, canvasH, linerDepth);
    const linerLeft = new THREE.Mesh(linerSideGeo, this.innerLinerMaterial);
    linerLeft.position.set(- (canvasW / 2 + linerWidth / 2), 0, linerDepth / 2);
    frameGroup.add(linerLeft);

    const linerRight = linerLeft.clone();
    linerRight.position.x = canvasW / 2 + linerWidth / 2;
    frameGroup.add(linerRight);

    // (3) 四角复古方框雕花勋章 (Corner Rosette Bosses)
    const bossGeo = new THREE.BoxGeometry(borderWidth * 1.1, borderWidth * 1.1, frameDepth * 1.2);
    const cornerOffsets = [
      [-1, 1], [1, 1], [-1, -1], [1, -1]
    ];
    for (const [cx, cy] of cornerOffsets) {
      const boss = new THREE.Mesh(bossGeo, this.goldFrameMaterial);
      boss.position.set(
        cx * (canvasW / 2 + borderWidth / 2),
        cy * (canvasH / 2 + borderWidth / 2),
        frameDepth / 2 + 0.015
      );
      boss.castShadow = true;
      frameGroup.add(boss);
    }

    // (4) 防漏光深色背板 (Canvas Backing Board)
    const backGeo = new THREE.PlaneGeometry(canvasW + 0.02, canvasH + 0.02);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, 0, 0.01);
    frameGroup.add(backMesh);

    rootGroup.add(frameGroup);

    // 4. 画布网格 (Canvas Mesh)
    const canvasGeo = new THREE.PlaneGeometry(canvasW, canvasH);

    // 默认展示高品位画布纹理底色
    const placeholderTex = createPaintingPlaceholderTexture(item, 1024, Math.max(512, Math.round(1024 / ar)));
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: placeholderTex,
      roughness: 0.35,
      metalness: 0.02,
      side: THREE.FrontSide
    });

    const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
    // 画布稍微凸出于背板，凹陷于画框内侧
    canvasMesh.position.set(0, 0, 0.045);
    canvasMesh.receiveShadow = true;
    rootGroup.add(canvasMesh);

    // 真实本地名画高清图像加载 (Strict Local Masterpiece Loader)
    const imagePath = item.localPath || item.image || (item.id ? `assets/paintings/${item.id}.jpg` : null);
    if (imagePath) {
      this.textureLoader.load(
        imagePath,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.needsUpdate = true;
          canvasMat.map = loadedTex;
          canvasMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`FrameManager: Failed to load painting image at "${imagePath}"`, err);
        }
      );
    }

    // 5. 博物馆双语黄铜展签铭牌 (Brass Nameplate)
    const nameplateW = Math.min(2.0, Math.max(1.3, canvasW * 0.72));
    const nameplateH = 0.34;
    const nameplateDepth = 0.025;
    const nameplateGeo = new THREE.BoxGeometry(nameplateW, nameplateH, nameplateDepth);

    // 生成精致刻字铭牌纹理
    const nameplateTex = createBrassNameplateTexture(item);
    const nameplateFrontMat = new THREE.MeshStandardMaterial({
      map: nameplateTex,
      roughness: 0.28,
      metalness: 0.88,
      side: THREE.FrontSide
    });
    const nameplateBodyMat = this.goldFrameMaterial;

    const nameplateMaterials = [
      nameplateBodyMat, nameplateBodyMat, // 左右
      nameplateBodyMat, nameplateBodyMat, // 上下
      nameplateFrontMat,                  // 正面
      nameplateBodyMat                   // 背面
    ];

    const nameplateMesh = new THREE.Mesh(nameplateGeo, nameplateMaterials);
    // 铭牌悬挂在画框正下方约 0.25 米处
    const nameplateY = - (canvasH / 2 + borderWidth + 0.25);
    nameplateMesh.position.set(0, nameplateY, 0.04);
    nameplateMesh.castShadow = true;
    rootGroup.add(nameplateMesh);

    // 6. 注册 userData 供射线拾取 (Raycasting Identification)
    const paintingMeta = {
      ...item,
      aspectRatio: ar,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      bayIndex: bayIndex
    };

    rootGroup.userData = {
      isPainting: true,
      paintingData: paintingMeta,
      canvasMesh: canvasMesh,
      nameplateMesh: nameplateMesh
    };

    canvasMesh.userData = {
      isCanvas: true,
      paintingData: paintingMeta,
      bayIndex: bayIndex
    };

    nameplateMesh.userData = {
      isNameplate: true,
      paintingData: paintingMeta,
      bayIndex: bayIndex
    };

    // 将可交互构件加入射线拾取列表
    this.interactiveObjects.push(canvasMesh, nameplateMesh);

    // 保存至清理清单
    this._disposables.push(
      topBarGeo, sideBarGeo, linerTopGeo, linerSideGeo,
      bossGeo, backGeo, canvasGeo, nameplateGeo,
      canvasMat, nameplateFrontMat
    );

    return rootGroup;
  }

  // ==========================================================================
  // 射线交互对象管理
  // ==========================================================================

  /**
   * 获取供控制器 Raycaster 拾取的所有画作对象
   * @returns {THREE.Object3D[]}
   */
  getInteractiveObjects() {
    return this.interactiveObjects;
  }

  /**
   * 根据时期 ID 或画作 ID 查找对应装配实体
   * @param {string} id
   */
  findPaintingById(id) {
    return this.mountedPaintings.find(m => m.data && (m.data.id === id || m.data.representativeWorkId === id));
  }

  // ==========================================================================
  // 清理与销毁 (Disposal)
  // ==========================================================================

  clear() {
    for (const item of this.mountedPaintings) {
      if (item.frameGroup && item.frameGroup.parent) {
        item.frameGroup.parent.remove(item.frameGroup);
      }
    }
    this.mountedPaintings = [];
    this.interactiveObjects = [];
  }

  dispose() {
    this.clear();
    for (const obj of this._disposables) {
      if (obj && typeof obj.dispose === 'function') {
        try {
          obj.dispose();
        } catch (e) {}
      }
    }
    this._disposables = [];
  }
}
