/**
 * 时光画廊 (Time Gallery) - 古典万神殿三维回廊建筑系统 (GalleryScene.js)
 * 1. 纯三维实体古典建筑细节:
 *    - 藻井穹顶 (Coffered Dome): 5环×28格真实镂空凹陷双阶梯藻井与镀金铜花 (140组高可见实体藻井)
 *    - 真实齿饰环列 (Dentils): 160块实体三维方齿阵列
 *    - 古典凹槽壁柱与复合柱头 (Fluted Pilasters & Corinthian Capitals)
 *    - 8大古典拱券展湾 (Arched Alcoves with Archivolt & Keystone)
 *    - 基座、墙裙与主檐口线脚 (Torus / Cyma Moldings)
 * 2. 真实 PBR 卡拉拉大理石材质、平面镜面地面反射 (Reflector)
 * 3. 真实万神殿圆形天窗 (Oculus) 与程序化无黑洞天幕 (Sky Dome)
 * 4. 专属穹顶向上补光系统与展湾独立聚光灯，保证画作和藻井均得到殿堂级照亮
 */

import * as THREE from 'three';
import { Reflector } from '../libs/Reflector.js';
import {
  getSharedCarraraMarbleTextures,
  getSharedSkyDomeTexture,
  getSharedGoldLeafTextures,
  getSharedFloorTexture
} from './ProceduralTextures.js';

export class GalleryScene {
  /**
   * @param {Object} options
   * @param {number} options.radius 回廊主半径 (米，默认 17.8)
   * @param {number} options.wallHeight 墙身高度 (米，默认 13.8)
   * @param {number} options.bayCount 展湾数量 (默认 8，严格契合 8 大艺术史时期)
   */
  constructor(options = {}) {
    this.radius = options.radius || 17.8;
    this.wallHeight = options.wallHeight || 13.8;
    this.bayCount = options.bayCount || 8;
    this.oculusRadius = 3.2;

    // 场景核心根节点
    this.scene = options.scene || new THREE.Scene();
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = 'PantheonRotunda';
    this.scene.add(this.roomGroup);

    // 展湾挂画锚点信息 [{ index, position, rotation, normal, standPosition, bayGroup }]
    this.bayAnchors = [];

    // 灯光引用
    this.sunlight = null;
    this.hemiLight = null;
    this.baySpotlights = [];

    // 反射地面
    this.reflector = null;

    // 建筑几何与材质列表 (便于销毁管理)
    this._disposables = [];

    // 初始化建造
    this._initMaterials();
    this._buildFloorAndReflector();
    this._buildWallsAndMoldings();
    this._buildPilasters();
    this._buildArchedAlcoves();
    this._buildEntablatureAndDentils();
    this._buildCofferedDome();
    this._buildOculusAndSkyDome();
    this._buildLighting();
  }

  // ==========================================================================
  // 材质初始化 (PBR Marble, Gilded Leaf, Sky)
  // ==========================================================================

  _initMaterials() {
    const marbleTex = getSharedCarraraMarbleTextures();
    const goldTex = getSharedGoldLeafTextures();

    // 1. 卡拉拉白色大理石 PBR 材质
    this.marbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfcfaf6,
      map: marbleTex.diffuse,
      roughnessMap: marbleTex.roughness,
      normalMap: marbleTex.normal,
      roughness: 0.24,
      metalness: 0.04,
      normalScale: new THREE.Vector2(0.4, 0.4),
      side: THREE.DoubleSide
    });
    this._disposables.push(this.marbleMaterial);

    // 2. 稍深色调的大理石材质 (用于拱券线脚与壁柱底座)
    this.marbleTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0xeee8dc,
      map: marbleTex.diffuse,
      roughnessMap: marbleTex.roughness,
      normalMap: marbleTex.normal,
      roughness: 0.28,
      metalness: 0.05,
      normalScale: new THREE.Vector2(0.5, 0.5),
      side: THREE.DoubleSide
    });
    this._disposables.push(this.marbleTrimMaterial);

    // 3. 穹顶内部专用内表面大理石材质 (BackSide 保证内部法线朝内且光照正确)
    this.domeMarbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfcfaf6,
      map: marbleTex.diffuse,
      roughnessMap: marbleTex.roughness,
      normalMap: marbleTex.normal,
      roughness: 0.26,
      metalness: 0.04,
      side: THREE.BackSide
    });
    this._disposables.push(this.domeMarbleMaterial);

    // 4. 镀金青铜 / 金箔雕饰材质 (Gold Leaf)
    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      map: goldTex.diffuse,
      roughnessMap: goldTex.roughness,
      bumpMap: goldTex.bump,
      bumpScale: 0.05,
      roughness: 0.30,
      metalness: 0.88,
      side: THREE.DoubleSide
    });
    this._disposables.push(this.goldMaterial);

    // 5. 万神殿拼花大理石地板 PBR 材质
    const floorTex = getSharedFloorTexture();
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTex,
      roughness: 0.16,
      metalness: 0.08,
      side: THREE.FrontSide
    });
    this._disposables.push(this.floorMaterial);
  }

  // ==========================================================================
  // 1. 地面基座与平面大理石镜面反射 (Floor & Planar Reflector)
  // ==========================================================================

  _buildFloorAndReflector() {
    const floorRadius = this.radius + 1.5;

    // 地面基座
    const floorGeo = new THREE.CylinderGeometry(floorRadius, floorRadius, 0.4, 64);
    const floorMesh = new THREE.Mesh(floorGeo, this.floorMaterial);
    floorMesh.position.y = -0.2;
    floorMesh.receiveShadow = true;
    this.roomGroup.add(floorMesh);
    this._disposables.push(floorGeo);

    // 平面镜面反射器 (Planar Reflector)
    try {
      const reflectorGeo = new THREE.CircleGeometry(floorRadius - 0.2, 64);
      this.reflector = new Reflector(reflectorGeo, {
        clipBias: 0.003,
        textureWidth: 1024,
        textureHeight: 1024,
        color: 0xa8a29a,
        multisample: 4
      });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = 0.015;
      this.roomGroup.add(this.reflector);
      this._disposables.push(reflectorGeo);
    } catch (e) {
      console.warn('GalleryScene: Reflector initialization fallback', e);
    }
  }

  // ==========================================================================
  // 2. 圆形主回廊墙身与基座线脚 (Rotunda Walls & Base Moldings)
  // ==========================================================================

  _buildWallsAndMoldings() {
    const R = this.radius;

    // 主环形圆柱外墙 (采用 BackSide，内部完美可见，法线严格朝向大厅中心)
    const wallGeo = new THREE.CylinderGeometry(R, R, this.wallHeight, 64, 1, true);
    const wallMesh = new THREE.Mesh(wallGeo, this.domeMarbleMaterial);
    wallMesh.position.y = this.wallHeight / 2;
    wallMesh.receiveShadow = true;
    this.roomGroup.add(wallMesh);
    this._disposables.push(wallGeo);

    // 下层托座 (Plinth Block, y = 0 ~ 0.8m)
    const plinthGeo = new THREE.CylinderGeometry(R - 0.25, R - 0.25, 0.8, 64, 1, true);
    const plinthMesh = new THREE.Mesh(plinthGeo, this.marbleTrimMaterial);
    plinthMesh.position.y = 0.4;
    this.roomGroup.add(plinthMesh);
    this._disposables.push(plinthGeo);

    // 上层凸圆线脚 (Torus Ring Molding, y = 0.85m)
    const torusRingGeo = new THREE.TorusGeometry(R - 0.22, 0.12, 16, 64);
    const torusMesh = new THREE.Mesh(torusRingGeo, this.marbleTrimMaterial);
    torusMesh.rotation.x = Math.PI / 2;
    torusMesh.position.y = 0.85;
    this.roomGroup.add(torusMesh);
    this._disposables.push(torusRingGeo);

    // 镀金细线脚 (Gilded Stringcourse at y = 1.15m)
    const goldLineGeo = new THREE.TorusGeometry(R - 0.20, 0.04, 12, 64);
    const goldLineMesh = new THREE.Mesh(goldLineGeo, this.goldMaterial);
    goldLineMesh.rotation.x = Math.PI / 2;
    goldLineMesh.position.y = 1.15;
    this.roomGroup.add(goldLineMesh);
    this._disposables.push(goldLineGeo);
  }

  // ==========================================================================
  // 3. 展湾拱券、拱顶石与挂画锚点 (Arched Alcoves with Keystone for 8 Bays)
  // ==========================================================================

  _buildArchedAlcoves() {
    const bayCount = this.bayCount;
    const R = this.radius;

    for (let i = 0; i < bayCount; i++) {
      // i=0 设置在 -Z 方向（angle = Math.PI），玩家一进入大厅正对 0 号展湾！
      const angle = i * ((Math.PI * 2) / bayCount) + Math.PI;

      // 展湾挂画位置
      const wallX = Math.sin(angle) * (R - 0.18);
      const wallZ = Math.cos(angle) * (R - 0.18);
      const wallY = 2.4; // 黄金展陈高度

      const bayGroup = new THREE.Group();
      bayGroup.name = `Bay_${i}`;
      bayGroup.position.set(wallX, 0, wallZ);
      bayGroup.rotation.y = angle + Math.PI; // 正对圆心

      // (1) 展湾拱券楣梁 (Archivolt & Arch Springing)
      const archRadius = 3.2; // 跨度 6.4 米
      const archTorusGeo = new THREE.TorusGeometry(archRadius, 0.18, 16, 32, Math.PI);
      const archMesh = new THREE.Mesh(archTorusGeo, this.marbleTrimMaterial);
      archMesh.position.set(0, 7.8, -0.05);
      bayGroup.add(archMesh);

      // 拱券内圈细金边
      const archGoldGeo = new THREE.TorusGeometry(archRadius - 0.18, 0.04, 12, 32, Math.PI);
      const archGoldMesh = new THREE.Mesh(archGoldGeo, this.goldMaterial);
      archGoldMesh.position.set(0, 7.8, -0.04);
      bayGroup.add(archGoldMesh);

      // 拱顶石 (Keystone with Gold Accent)
      const keystoneShape = new THREE.Shape();
      keystoneShape.moveTo(-0.28, 0);
      keystoneShape.lineTo(0.28, 0);
      keystoneShape.lineTo(0.38, 0.75);
      keystoneShape.lineTo(-0.38, 0.75);
      keystoneShape.closePath();

      const extrudeSettings = { depth: 0.38, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.04, bevelThickness: 0.04 };
      const keystoneGeo = new THREE.ExtrudeGeometry(keystoneShape, extrudeSettings);
      const keystoneMesh = new THREE.Mesh(keystoneGeo, this.goldMaterial);
      keystoneMesh.position.set(0, 7.8 + archRadius - 0.22, -0.15);
      keystoneMesh.castShadow = true;
      bayGroup.add(keystoneMesh);

      this.roomGroup.add(bayGroup);

      // 最佳观赏站位坐标 (正对画作约 4.8 米处)
      const standDistance = R - 5.0;
      const standX = Math.sin(angle) * standDistance;
      const standZ = Math.cos(angle) * standDistance;

      this.bayAnchors.push({
        index: i,
        position: new THREE.Vector3(wallX, wallY, wallZ),
        rotation: new THREE.Euler(0, angle + Math.PI, 0),
        normal: new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
        standPosition: new THREE.Vector3(standX, 1.7, standZ),
        alcoveGroup: bayGroup
      });
    }
  }

  // ==========================================================================
  // 4. 古典壁柱与复合柱头 (Classical Fluted Pilasters)
  // ==========================================================================

  _buildPilasters() {
    const bayCount = this.bayCount;
    const R = this.radius;
    const pilasterHeight = 9.2;
    const baseY = 1.2;

    for (let i = 0; i < bayCount; i++) {
      const angle = i * ((Math.PI * 2) / bayCount) + Math.PI;
      const pilasterAngle = angle + (Math.PI / bayCount);
      const px = Math.sin(pilasterAngle) * (R - 0.15);
      const pz = Math.cos(pilasterAngle) * (R - 0.15);

      const pilasterGroup = new THREE.Group();
      pilasterGroup.position.set(px, baseY, pz);
      pilasterGroup.rotation.y = pilasterAngle + Math.PI;

      // 壁柱底座 (Attic Base)
      const baseGeo = new THREE.BoxGeometry(1.5, 0.45, 0.5);
      const baseMesh = new THREE.Mesh(baseGeo, this.marbleTrimMaterial);
      baseMesh.position.y = 0.225;
      pilasterGroup.add(baseMesh);

      // 柱身 (Fluted Shaft)
      const shaftWidth = 1.3;
      const shaftDepth = 0.4;
      const shaftGeo = new THREE.BoxGeometry(shaftWidth, pilasterHeight, shaftDepth);
      const shaftMesh = new THREE.Mesh(shaftGeo, this.marbleMaterial);
      shaftMesh.position.y = pilasterHeight / 2 + 0.45;
      shaftMesh.castShadow = true;
      pilasterGroup.add(shaftMesh);

      // 柱身三维立体凹槽 (5 Flutes)
      const fluteCount = 5;
      const fluteWidth = 0.12;
      const fluteDepth = 0.05;
      const fluteSpacing = shaftWidth / (fluteCount + 1);

      for (let f = 1; f <= fluteCount; f++) {
        const fx = -shaftWidth / 2 + f * fluteSpacing;
        const fluteGeo = new THREE.BoxGeometry(fluteWidth, pilasterHeight - 0.6, fluteDepth);
        const fluteMesh = new THREE.Mesh(fluteGeo, this.marbleTrimMaterial);
        fluteMesh.position.set(fx, pilasterHeight / 2 + 0.45, shaftDepth / 2 + 0.01);
        pilasterGroup.add(fluteMesh);
      }

      // 柱头 (Capital with Volute Scrolls & Gold Rosette)
      const capitalGroup = new THREE.Group();
      capitalGroup.position.y = pilasterHeight + 0.45;

      const capitalAbacusGeo = new THREE.BoxGeometry(1.6, 0.35, 0.6);
      const capitalAbacus = new THREE.Mesh(capitalAbacusGeo, this.marbleTrimMaterial);
      capitalAbacus.position.y = 0.45;
      capitalGroup.add(capitalAbacus);

      const voluteGeo = new THREE.TorusGeometry(0.22, 0.065, 12, 24);
      const voluteLeft = new THREE.Mesh(voluteGeo, this.goldMaterial);
      voluteLeft.position.set(-0.55, -0.15, shaftDepth / 2);
      capitalGroup.add(voluteLeft);

      const voluteRight = voluteLeft.clone();
      voluteRight.position.x = 0.55;
      capitalGroup.add(voluteRight);

      const rosetteGeo = new THREE.SphereGeometry(0.12, 16, 16);
      rosetteGeo.scale(1, 1, 0.5);
      const rosetteMesh = new THREE.Mesh(rosetteGeo, this.goldMaterial);
      rosetteMesh.position.set(0, -0.12, shaftDepth / 2 + 0.05);
      capitalGroup.add(rosetteMesh);

      pilasterGroup.add(capitalGroup);
      this.roomGroup.add(pilasterGroup);
    }
  }

  // ==========================================================================
  // 4. 檐部、线脚与三维齿饰环列 (Entablature, Dentils, Cornice)
  // ==========================================================================

  _buildEntablatureAndDentils() {
    const R = this.radius - 0.15;

    // 1. 额枋 (Architrave, y = 11.2m ~ 11.8m)
    const architraveGeo = new THREE.CylinderGeometry(R, R, 0.6, 64, 1, true);
    const architraveMesh = new THREE.Mesh(architraveGeo, this.marbleTrimMaterial);
    architraveMesh.position.y = 11.5;
    this.roomGroup.add(architraveMesh);
    this._disposables.push(architraveGeo);

    // 2. 雕带 (Frieze, y = 11.8m ~ 12.6m)
    const friezeGeo = new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.8, 64, 1, true);
    const friezeMesh = new THREE.Mesh(friezeGeo, this.marbleMaterial);
    friezeMesh.position.y = 12.2;
    this.roomGroup.add(friezeMesh);
    this._disposables.push(friezeGeo);

    // 雕带上下金色嵌线
    const friezeGold1 = new THREE.TorusGeometry(R, 0.04, 12, 64);
    const friezeGoldMesh1 = new THREE.Mesh(friezeGold1, this.goldMaterial);
    friezeGoldMesh1.rotation.x = Math.PI / 2;
    friezeGoldMesh1.position.y = 11.8;
    this.roomGroup.add(friezeGoldMesh1);

    const friezeGoldMesh2 = friezeGoldMesh1.clone();
    friezeGoldMesh2.position.y = 12.6;
    this.roomGroup.add(friezeGoldMesh2);

    // 3. 真实三维实体齿饰环列 (Dentil Course - 160 3D Rectangular Blocks)
    const dentilCount = 160;
    const dentilWidth = 0.22;
    const dentilHeight = 0.24;
    const dentilDepth = 0.35;
    const dentilRadius = R - 0.22;

    const dentilGeo = new THREE.BoxGeometry(dentilWidth, dentilHeight, dentilDepth);
    const dentilInstanced = new THREE.InstancedMesh(dentilGeo, this.marbleTrimMaterial, dentilCount);
    dentilInstanced.castShadow = true;
    dentilInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let d = 0; d < dentilCount; d++) {
      const theta = (d / dentilCount) * Math.PI * 2;
      dummy.position.set(
        Math.sin(theta) * dentilRadius,
        12.75,
        Math.cos(theta) * dentilRadius
      );
      dummy.rotation.set(0, theta + Math.PI, 0);
      dummy.updateMatrix();
      dentilInstanced.setMatrixAt(d, dummy.matrix);
    }
    dentilInstanced.instanceMatrix.needsUpdate = true;
    this.roomGroup.add(dentilInstanced);
    this._disposables.push(dentilGeo, dentilInstanced);

    // 4. 主檐口凸冠线脚 (Corona & Cyma Reversa Cornice, y = 13.0m ~ 13.6m)
    const corniceGeo = new THREE.CylinderGeometry(R - 0.45, R - 0.15, 0.6, 64, 1, true);
    const corniceMesh = new THREE.Mesh(corniceGeo, this.marbleTrimMaterial);
    corniceMesh.position.y = 13.2;
    this.roomGroup.add(corniceMesh);
    this._disposables.push(corniceGeo);

    // 5. 假阁楼层过渡环 (Attic Tier, y = 13.6m ~ 14.1m)
    const atticGeo = new THREE.CylinderGeometry(R - 0.35, R - 0.35, 0.5, 64, 1, true);
    const atticMesh = new THREE.Mesh(atticGeo, this.marbleMaterial);
    atticMesh.position.y = 13.85;
    this.roomGroup.add(atticMesh);
    this._disposables.push(atticGeo);
  }

  // ==========================================================================
  // 5. 万神殿经典藻井穹顶 (Coffered Dome, 5 Concentric Rings x 28 Coffers)
  // ==========================================================================

  _buildCofferedDome() {
    const domeRadius = this.radius - 0.35; // ~17.45 米
    const domeBaseY = 14.1;

    // 1. 穹顶半球形内壁基底 (Solid Marble Hemispherical Shell)
    // 极角从 minPhi (天窗边缘) 到 maxPhi = pi/2 (起拱线)
    const minPhi = Math.asin(this.oculusRadius / domeRadius);
    const maxPhi = Math.PI / 2;

    const domeShellGeo = new THREE.SphereGeometry(
      domeRadius, 64, 32,
      0, Math.PI * 2,
      minPhi, maxPhi - minPhi
    );
    // 使用 domeMarbleMaterial (side: THREE.BackSide)，内部完全实体可见，光线准确照亮！
    const domeShellMesh = new THREE.Mesh(domeShellGeo, this.domeMarbleMaterial);
    domeShellMesh.position.y = domeBaseY;
    domeShellMesh.receiveShadow = true;
    this.roomGroup.add(domeShellMesh);
    this._disposables.push(domeShellGeo);

    // 2. 罗马万神殿 5 环同心镂空阶梯藻井 (5 Rings of 28 Recessed Coffers = 140 Coffers)
    const ringCount = 5;
    const coffersPerRing = 28;
    const totalCoffers = ringCount * coffersPerRing;

    // (A) 外层阶梯中空方框
    const outerShape = new THREE.Shape();
    outerShape.moveTo(-1.05, -0.88);
    outerShape.lineTo(1.05, -0.88);
    outerShape.lineTo(1.05, 0.88);
    outerShape.lineTo(-1.05, 0.88);
    outerShape.closePath();

    const outerHole = new THREE.Path();
    outerHole.moveTo(-0.75, -0.62);
    outerHole.lineTo(0.75, -0.62);
    outerHole.lineTo(0.75, 0.62);
    outerHole.lineTo(-0.75, 0.62);
    outerHole.closePath();
    outerShape.holes.push(outerHole);

    const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.035,
      bevelThickness: 0.035
    });
    const outerInstanced = new THREE.InstancedMesh(outerGeo, this.marbleTrimMaterial, totalCoffers);

    // (B) 内层更深凹入的金色阶梯衬框
    const innerShape = new THREE.Shape();
    innerShape.moveTo(-0.72, -0.59);
    innerShape.lineTo(0.72, -0.59);
    innerShape.lineTo(0.72, 0.59);
    innerShape.lineTo(-0.72, 0.59);
    innerShape.closePath();

    const innerHole = new THREE.Path();
    innerHole.moveTo(-0.46, -0.36);
    innerHole.lineTo(0.46, -0.36);
    innerHole.lineTo(0.46, 0.36);
    innerHole.lineTo(-0.46, 0.36);
    innerHole.closePath();
    innerShape.holes.push(innerHole);

    const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.025
    });
    const innerInstanced = new THREE.InstancedMesh(innerGeo, this.goldMaterial, totalCoffers);

    // (C) 藻井底座中央金色雕花勋章
    const rosetteGeo = new THREE.CylinderGeometry(0.24, 0.10, 0.18, 8);
    rosetteGeo.rotateX(Math.PI / 2);
    const rosetteInstanced = new THREE.InstancedMesh(rosetteGeo, this.goldMaterial, totalCoffers);

    outerInstanced.castShadow = true;
    outerInstanced.receiveShadow = true;
    innerInstanced.castShadow = true;
    innerInstanced.receiveShadow = true;
    rosetteInstanced.castShadow = true;

    const dummy = new THREE.Object3D();
    let index = 0;

    // 极角分布 (从穹顶起拱线到天窗由低到高 5 环)
    const phiAngles = [1.28, 1.05, 0.82, 0.60, 0.38];

    for (let r = 0; r < ringCount; r++) {
      const phi = phiAngles[r];
      // 随着靠近天窗，藻井自然依光学透视规律逐环缩小
      const scaleFactor = 0.58 + (r / ringCount) * 0.44;

      for (let c = 0; c < coffersPerRing; c++) {
        const theta = (c / coffersPerRing) * Math.PI * 2;

        // 计算穹顶球面坐标
        const sx = domeRadius * Math.sin(phi) * Math.sin(theta);
        const sy = domeBaseY + domeRadius * Math.cos(phi);
        const sz = domeRadius * Math.sin(phi) * Math.cos(theta);

        // 1. 外层阶梯中空方框贴合在穹顶内壁
        dummy.position.set(sx * 0.990, domeBaseY + (sy - domeBaseY) * 0.990, sz * 0.990);
        dummy.scale.set(scaleFactor, scaleFactor, 1.0);
        dummy.lookAt(0, domeBaseY, 0);
        dummy.updateMatrix();
        outerInstanced.setMatrixAt(index, dummy.matrix);

        // 2. 内层金色方框深入内部
        dummy.position.set(sx * 0.995, domeBaseY + (sy - domeBaseY) * 0.995, sz * 0.995);
        dummy.scale.set(scaleFactor, scaleFactor, 1.0);
        dummy.lookAt(0, domeBaseY, 0);
        dummy.updateMatrix();
        innerInstanced.setMatrixAt(index, dummy.matrix);

        // 3. 中心镀金铜花位于藻井底部
        dummy.position.set(sx * 0.998, domeBaseY + (sy - domeBaseY) * 0.998, sz * 0.998);
        dummy.scale.set(scaleFactor * 1.15, scaleFactor * 1.15, scaleFactor * 1.15);
        dummy.lookAt(0, domeBaseY, 0);
        dummy.updateMatrix();
        rosetteInstanced.setMatrixAt(index, dummy.matrix);

        index++;
      }
    }

    outerInstanced.instanceMatrix.needsUpdate = true;
    innerInstanced.instanceMatrix.needsUpdate = true;
    rosetteInstanced.instanceMatrix.needsUpdate = true;

    this.roomGroup.add(outerInstanced);
    this.roomGroup.add(innerInstanced);
    this.roomGroup.add(rosetteInstanced);

    this._disposables.push(outerGeo, outerInstanced, innerGeo, innerInstanced, rosetteGeo, rosetteInstanced);
  }

  // ==========================================================================
  // 6. 万神殿圆形天窗与程序化天幕 (Oculus & Procedural Sky Dome)
  // ==========================================================================

  _buildOculusAndSkyDome() {
    const domeRadius = this.radius - 0.35;
    const domeBaseY = 14.1;
    const minPhi = Math.asin(this.oculusRadius / domeRadius);
    const oculusY = domeBaseY + domeRadius * Math.cos(minPhi);

    // 天窗青铜金边重叠圆环线脚 (Bronze Oculus Cornice Ring)
    const oculusRingGeo = new THREE.TorusGeometry(this.oculusRadius, 0.35, 24, 64);
    const oculusRingMesh = new THREE.Mesh(oculusRingGeo, this.goldMaterial);
    oculusRingMesh.rotation.x = Math.PI / 2;
    oculusRingMesh.position.set(0, oculusY, 0);
    this.roomGroup.add(oculusRingMesh);
    this._disposables.push(oculusRingGeo);

    // 广袤程序化天幕天穹 (Sky Dome - 仅在天窗外部可见，杜绝黑洞)
    const skyTex = getSharedSkyDomeTexture();
    const skyGeo = new THREE.SphereGeometry(65, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false
    });
    const skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    skyDomeMesh.position.set(0, oculusY + 6, 0);
    this.roomGroup.add(skyDomeMesh);
    this._disposables.push(skyGeo, skyMat);
  }

  // ==========================================================================
  // 7. 博物馆殿堂级光照系统 (PBR Museum Lighting & Shadows)
  // ==========================================================================

  _buildLighting() {
    // 1. 全局环境基底光 (AmbientLight, 确保画面温润，绝无死黑)
    const ambientLight = new THREE.AmbientLight(0xfff6ec, 0.75);
    this.roomGroup.add(ambientLight);

    // 2. 天顶斜照金色日光 (穿透天窗射入大厅的强烈自然光)
    this.sunlight = new THREE.DirectionalLight(0xfff8ee, 2.8);
    this.sunlight.position.set(10, 48, 8);
    this.sunlight.target.position.set(0, 0, 0);
    this.sunlight.castShadow = true;

    // 软阴影参数优化 (PCFSoftShadowMap)
    this.sunlight.shadow.mapSize.width = 2048;
    this.sunlight.shadow.mapSize.height = 2048;
    this.sunlight.shadow.camera.near = 10;
    this.sunlight.shadow.camera.far = 70;
    this.sunlight.shadow.camera.left = -24;
    this.sunlight.shadow.camera.right = 24;
    this.sunlight.shadow.camera.top = 24;
    this.sunlight.shadow.camera.bottom = -24;
    this.sunlight.shadow.bias = -0.0003;
    this.sunlight.shadow.radius = 2.0;

    this.roomGroup.add(this.sunlight);
    this.roomGroup.add(this.sunlight.target);

    // 3. 专属穹顶向上补光系统 (Dome Uplight - 定向照亮 140 藻井与金色花饰)
    const domeDirect = new THREE.DirectionalLight(0xfffaed, 2.2);
    domeDirect.position.set(0, 4, 0);
    domeDirect.target.position.set(0, 30, 0);
    this.roomGroup.add(domeDirect);
    this.roomGroup.add(domeDirect.target);

    // 穹顶中心点光源洗光 (无衰减扩散)
    const domePoint = new THREE.PointLight(0xffeed6, 2.5, 45, 0.0);
    domePoint.position.set(0, 14.0, 0);
    this.roomGroup.add(domePoint);

    // 4. 半球漫射环境光 (天窗天光 + 大理石反射)
    this.hemiLight = new THREE.HemisphereLight(0xdbe9ff, 0xe8dfd2, 1.0);
    this.hemiLight.position.set(0, 26, 0);
    this.roomGroup.add(this.hemiLight);

    // 5. 展厅地面柔和中心光
    const centerFill = new THREE.PointLight(0xfff0dd, 1.2, 30, 0.8);
    centerFill.position.set(0, 5.0, 0);
    this.roomGroup.add(centerFill);

    // 6. 8个展湾专属暖调画作射灯 (Bay Spotlights)
    for (let i = 0; i < this.bayCount; i++) {
      const anchor = this.bayAnchors[i];
      if (!anchor) continue;

      const angle = i * ((Math.PI * 2) / this.bayCount) + Math.PI;
      const lightR = this.radius - 2.6;
      const lx = Math.sin(angle) * lightR;
      const lz = Math.cos(angle) * lightR;
      const ly = 7.0;

      const spot = new THREE.SpotLight(0xfff8ea, 3.5, 18, 0.55, 0.60, 0.8);
      spot.position.set(lx, ly, lz);
      // 精准照射在画作中心 Y = 2.4 米处
      spot.target.position.set(anchor.position.x, 2.4, anchor.position.z);
      spot.castShadow = false;

      this.roomGroup.add(spot);
      this.roomGroup.add(spot.target);
      this.baySpotlights.push(spot);
    }
  }

  // ==========================================================================
  // 外部访问接口与生命周期
  // ==========================================================================

  getAllBayAnchors() {
    return this.bayAnchors;
  }

  getBayAnchor(index) {
    return this.bayAnchors[index % this.bayAnchors.length];
  }

  dispose() {
    if (this.roomGroup && this.roomGroup.parent) {
      this.roomGroup.parent.remove(this.roomGroup);
    }
    for (const item of this._disposables) {
      if (item && typeof item.dispose === 'function') {
        try {
          item.dispose();
        } catch (e) {}
      }
    }
    this._disposables = [];
    this.bayAnchors = [];
  }
}
