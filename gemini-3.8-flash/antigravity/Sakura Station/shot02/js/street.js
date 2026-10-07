/**
 * street.js - Japanese Suburban Main Street & Station Plaza (站前广场)
 * Features curved asphalt road, Japanese road markings ("止まれ", "30"), curbs,
 * drainage gutters with metal grates, convex mirror, signs, flowerbeds, and plaza props.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import {
  getAsphaltTexture,
  getRoadMarkingTexture,
  getManholeTexture,
  getPetalTexture
} from './textures.js';

export class Street {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.initRoad();
    this.initSidewalksAndGutters();
    this.initPlaza();
    this.initRoadSignsAndMirror();
    this.scene.add(this.group);
  }

  initRoad() {
    // 0. Base Ground Terrain (Town ground with lush anime spring lawn)
    const baseGeo = new THREE.PlaneGeometry(220, 220);
    const baseMesh = new THREE.Mesh(baseGeo, materials.grassGreen);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.y = 0.0;
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    // 1. Curved Road Geometry (S-bend from foreground z = 45 to station z = -12)
    const points = [];
    const roadLength = 65;
    const segments = 40;
    const roadWidth = 8.5;

    // Define curve spline
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(6, 0.02, 45),
      new THREE.Vector3(4, 0.02, 30),
      new THREE.Vector3(-1.5, 0.02, 15),
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(2, 0.02, -15),
      new THREE.Vector3(2, 0.02, -28) // Crossing section
    ]);

    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, segments);
    roadGeo.rotateX(-Math.PI / 2);

    // Warp plane along spline
    const pos = roadGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const zRatio = (pos.getZ(i) + roadLength / 2) / roadLength; // 0 to 1
      const point = curve.getPoint(1.0 - zRatio);
      const tangent = curve.getTangent(1.0 - zRatio);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const xOffset = pos.getX(i);
      pos.setX(i, point.x + normal.x * xOffset);
      pos.setZ(i, point.z + normal.z * xOffset);
      pos.setY(i, 0.02);
    }
    roadGeo.computeVertexNormals();

    const asphaltTex = getAsphaltTexture();
    const roadMat = new THREE.MeshToonMaterial({
      map: asphaltTex,
      gradientMap: materials.wallStuccoWhite.gradientMap,
      roughness: 0.8
    });

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // 2. Road Markings: "止まれ" (Stop), "30", Crosswalk, Center Lines
    this.addRoadMarkings();

    // 3. Manhole Covers
    this.addManholes();
  }

  addRoadMarkings() {
    // White boundary lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const centerLineMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 }); // Yellow/Orange center

    // Road Markings overlay meshes
    const tomareTex = getRoadMarkingTexture('tomare');
    const tomareMat = new THREE.MeshBasicMaterial({
      map: tomareTex,
      transparent: true,
      depthWrite: false
    });
    const tomareMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), tomareMat);
    tomareMesh.rotation.x = -Math.PI / 2;
    tomareMesh.position.set(0.6, 0.035, -16.5);
    this.group.add(tomareMesh);

    // Speed 30 marking
    const speed30Tex = getRoadMarkingTexture('speed30');
    const speed30Mat = new THREE.MeshBasicMaterial({
      map: speed30Tex,
      transparent: true,
      depthWrite: false
    });
    const speed30Mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), speed30Mat);
    speed30Mesh.rotation.x = -Math.PI / 2;
    speed30Mesh.position.set(-0.8, 0.035, 18);
    this.group.add(speed30Mesh);

    // Crosswalk zebra stripes in front of station entrance
    const crosswalkTex = getRoadMarkingTexture('crosswalk');
    const crosswalkMat = new THREE.MeshBasicMaterial({
      map: crosswalkTex,
      transparent: true,
      depthWrite: false
    });
    const crosswalk = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.0), crosswalkMat);
    crosswalk.rotation.x = -Math.PI / 2;
    crosswalk.position.set(1.5, 0.035, -5);
    this.group.add(crosswalk);
  }

  addManholes() {
    const manholeTex = getManholeTexture();
    const manholeMat = new THREE.MeshBasicMaterial({
      map: manholeTex,
      transparent: true,
      depthWrite: false
    });

    const positions = [
      { x: 2.2, z: 24, r: 0.5 },
      { x: -1.2, z: 2, r: 0.5 },
      { x: 3.0, z: -12, r: 0.5 }
    ];

    positions.forEach(p => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2, p.r * 2), manholeMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.032, p.z);
      this.group.add(mesh);
    });
  }

  initSidewalksAndGutters() {
    // Concrete Sidewalk Curbs along both sides of the main street
    const curbMat = materials.concreteLight;
    const gutterMat = materials.concreteDark;

    // Left Sidewalk
    const leftWalkGeo = new THREE.BoxGeometry(4.5, 0.16, 55);
    const leftWalk = new THREE.Mesh(leftWalkGeo, curbMat);
    leftWalk.position.set(-6.5, 0.08, 12);
    leftWalk.receiveShadow = true;
    this.group.add(leftWalk);

    // Right Sidewalk
    const rightWalkGeo = new THREE.BoxGeometry(4.5, 0.16, 55);
    const rightWalk = new THREE.Mesh(rightWalkGeo, curbMat);
    rightWalk.position.set(6.8, 0.08, 12);
    rightWalk.receiveShadow = true;
    this.group.add(rightWalk);

    // Concrete Drainage Gutter Grates along the road edges
    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.7,
      metalness: 0.4
    });

    for (let z = 38; z >= -18; z -= 7) {
      // Left gutter grate
      const leftGrate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.9), grateMat);
      leftGrate.position.set(-4.0, 0.02, z);
      this.group.add(leftGrate);

      // Right gutter grate
      const rightGrate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.9), grateMat);
      rightGrate.position.set(4.3, 0.02, z);
      this.group.add(rightGrate);

      // Clustered fallen sakura petals gathered near grates
      this.addPetalCluster(-3.9, 0.025, z + 0.2);
      this.addPetalCluster(4.2, 0.025, z - 0.2);
    }
  }

  addPetalCluster(x, y, z) {
    const clusterGeo = new THREE.CircleGeometry(0.35 + Math.random() * 0.2, 8);
    const petalTex = getPetalTexture();
    const clusterMat = new THREE.MeshBasicMaterial({
      map: petalTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(clusterGeo, clusterMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
  }

  initPlaza() {
    // 1. Station Plaza Interlocking Paving (站前广场)
    const plazaGeo = new THREE.BoxGeometry(22, 0.18, 18);
    const plazaMat = materials.wallStuccoWhite;
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.set(8.5, 0.09, -8.5);
    plazaMesh.receiveShadow = true;
    this.group.add(plazaMesh);

    // Yellow tactile paving guidance path leading to station entrance
    const tactileTex = getRoadMarkingTexture('tactile');
    const tactileMat = new THREE.MeshToonMaterial({
      map: tactileTex,
      roughness: 0.6
    });
    const tactilePath = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 14), tactileMat);
    tactilePath.rotation.x = -Math.PI / 2;
    tactilePath.position.set(4.8, 0.185, -8.5);
    this.group.add(tactilePath);

    // 2. Brick Flowerbeds with blooming tulips and bushes
    this.createFlowerbed(16, -14, 4.5, 2.2);
    this.createFlowerbed(16, -3, 4.5, 2.2);

    // 3. Circular Wooden Bench surrounding the Plaza Sakura Tree
    this.createCircularBench(11.5, -9.0, 2.2);
  }

  createFlowerbed(x, z, w, d) {
    const bedGroup = new THREE.Group();
    // Brick border
    const brickMat = materials.woodWarm;
    const border = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), brickMat);
    border.position.y = 0.225;
    bedGroup.add(border);

    // Soil
    const soilMat = materials.sleeperWood;
    const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.46, d - 0.3), soilMat);
    soil.position.y = 0.23;
    bedGroup.add(soil);

    // Tulips / Flowers
    const flowerColors = [materials.flowerTulipRed, materials.flowerTulipYellow, materials.flowerHydrangea];
    for (let fx = -w / 2 + 0.4; fx < w / 2 - 0.3; fx += 0.5) {
      for (let fz = -d / 2 + 0.4; fz < d / 2 - 0.3; fz += 0.5) {
        const mat = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), materials.grassGreen);
        stem.position.set(fx + Math.random() * 0.1, 0.52, fz + Math.random() * 0.1);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat);
        bulb.position.y = 0.14;
        stem.add(bulb);
        bedGroup.add(stem);
      }
    }

    bedGroup.position.set(x, 0.18, z);
    this.group.add(bedGroup);
  }

  createCircularBench(x, z, radius) {
    const benchGroup = new THREE.Group();
    const segments = 12;
    const woodMat = materials.woodWarm;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.28), woodMat);
      slat.position.set(Math.cos(angle) * radius, 0.45, Math.sin(angle) * radius);
      slat.rotation.y = -angle + Math.PI / 2;
      slat.castShadow = true;
      benchGroup.add(slat);

      // Support legs
      if (i % 3 === 0) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), materials.catenarySteel);
        leg.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
        benchGroup.add(leg);
      }
    }

    benchGroup.position.set(x, 0.18, z);
    this.group.add(benchGroup);
  }

  initRoadSignsAndMirror() {
    // 1. Curved Convex Traffic Mirror (カーブミラー) at street corner
    const mirrorGroup = new THREE.Group();
    // Orange/white pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4), materials.trafficConeOrange);
    pole.position.y = 1.7;
    pole.castShadow = true;
    mirrorGroup.add(pole);

    // Mirror disc with curved anime sky reflection
    const mirrorBack = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 24), materials.trafficConeOrange);
    mirrorBack.rotation.x = Math.PI / 2;
    mirrorBack.position.set(0, 3.2, 0.15);
    mirrorBack.rotation.y = -0.4;
    mirrorGroup.add(mirrorBack);

    // Convex reflective glass
    const mirrorGlassMat = new THREE.MeshStandardMaterial({
      color: 0xbedcf0,
      metalness: 0.9,
      roughness: 0.1
    });
    const mirrorGlass = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3), mirrorGlassMat);
    mirrorGlass.rotation.x = Math.PI / 2;
    mirrorGlass.position.set(0, 3.2, 0.18);
    mirrorGlass.rotation.y = -0.4;
    mirrorGroup.add(mirrorGlass);

    mirrorGroup.position.set(-4.6, 0.1, 10);
    this.group.add(mirrorGroup);

    // 2. Blue Road Direction Signpost ("駅前通り")
    const signGroup = new THREE.Group();
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.0), materials.utilityPoleGray);
    signPole.position.y = 1.5;
    signGroup.add(signPole);

    const signBoardMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.04), signBoardMat);
    signBoard.position.set(0, 2.7, 0);
    signGroup.add(signBoard);

    signGroup.position.set(4.5, 0.1, 26);
    this.group.add(signGroup);
  }
}
