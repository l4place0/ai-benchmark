import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';

// Japanese Cherry Blossom Trees (樱花树) with High Canopy & Multi-Tiered Anime Foliage
export class SakuraTrees {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'sakura_trees';

    this.init();
  }

  init() {
    // 1. Landmark Ancient Giant Sakura Tree in Station Plaza (Moved to X = -13.5 to not block entrance)
    this.createGrandTree({
      x: -13.5, y: 0.15, z: 8.5,
      scale: 1.25,
      trunkRotation: 0.3
    });

    // 2. High Arching Roadside Sakura Trees (Canopy at Y = 7.5 to 11m, high above street)
    this.createRoadsideTree({ x: 2.0, y: 0.1, z: 28, archDirection: 1 });
    this.createRoadsideTree({ x: 16.5, y: 0.1, z: 40, archDirection: -1 });
    this.createRoadsideTree({ x: 2.2, y: 0.1, z: 52, archDirection: 1 });

    // 3. Platform Perimeter Sakura Trees (Framing the train from behind platform)
    this.createPlatformTree({ x: -28, y: 0.1, z: -7.5 });
    this.createPlatformTree({ x: -2, y: 0.1, z: -7.5 });
    this.createPlatformTree({ x: 9, y: 0.1, z: -7.5 });

    // 4. Embankment Sakura Line (North of tracks, creating depth)
    this.createGrandTree({ x: 22, y: 1.5, z: -26, scale: 1.15 });
    this.createGrandTree({ x: -6, y: 1.5, z: -28, scale: 1.2 });
    this.createGrandTree({ x: -24, y: 1.5, z: -26, scale: 1.1 });
    this.createGrandTree({ x: 6, y: 1.5, z: -27, scale: 1.1 });

    // 5. Residential Garden Trees
    this.createGardenTree({ x: -9.5, y: 0.1, z: 42 });
    this.createGardenTree({ x: 24.0, y: 0.1, z: 42 });

    this.scene.add(this.group);
  }

  // --- 1. Landmark Ancient Giant Sakura Tree ---
  createGrandTree({ x, y, z, scale = 1.0, trunkRotation = 0 }) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);
    treeGroup.scale.set(scale, scale, scale);
    treeGroup.rotation.y = trunkRotation;

    const barkMat = ToonMaterialFactory.getToonMaterial({ color: 0x422d22 });

    // Upright tall weathered trunk (Height = 6.5m)
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 2.2, 0.1),
      new THREE.Vector3(-0.2, 4.2, -0.1),
      new THREE.Vector3(0.1, 6.2, 0.2)
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 16, 0.55, 8, false);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // Spreading boughs reaching high above (Y = 6.5 to 9.5m)
    const branchConfigs = [
      { start: [0.1, 5.8, 0.2], end: [3.2, 7.8, 1.6], radius: 0.26 },
      { start: [0.1, 5.8, 0.2], end: [-3.0, 7.6, 1.8], radius: 0.26 },
      { start: [0.1, 5.8, 0.2], end: [0.6, 8.4, -3.0], radius: 0.24 },
      { start: [0.1, 5.8, 0.2], end: [-2.0, 8.2, -2.2], radius: 0.24 },
      { start: [0.1, 6.2, 0.2], end: [0.2, 9.6, 0.3], radius: 0.22 }
    ];

    branchConfigs.forEach(b => {
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(...b.start),
        new THREE.Vector3(
          (b.start[0] + b.end[0]) / 2,
          (b.start[1] + b.end[1]) / 2 + 0.3,
          (b.start[2] + b.end[2]) / 2
        ),
        new THREE.Vector3(...b.end)
      ]);
      const branchGeo = new THREE.TubeGeometry(bCurve, 10, b.radius, 6, false);
      const branch = new THREE.Mesh(branchGeo, barkMat);
      branch.castShadow = true;
      treeGroup.add(branch);

      this.createFoliageClusters(treeGroup, b.end, 2.4);
    });

    // Crown cluster
    this.createFoliageClusters(treeGroup, [0.2, 10.0, 0.3], 3.0);

    this.group.add(treeGroup);
  }

  // --- 2. High Arching Roadside Sakura Tree ---
  createRoadsideTree({ x, y, z, archDirection = 1 }) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    const barkMat = ToonMaterialFactory.getToonMaterial({ color: 0x483327 });

    // Vertical trunk up to Y = 5.5m (keeps sidewalk unobstructed!), then gently leaning over street
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 3.0, 0),
      new THREE.Vector3(archDirection * 0.5, 5.5, 0.2),
      new THREE.Vector3(archDirection * 1.8, 7.5, 0.4)
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 14, 0.38, 8, false);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Overhanging canopy boughs high in the sky (Y = 7.5 to 10.5m)
    this.createFoliageClusters(treeGroup, [archDirection * 2.2, 8.2, 0.4], 2.4);
    this.createFoliageClusters(treeGroup, [archDirection * 1.2, 7.8, 1.8], 2.0);
    this.createFoliageClusters(treeGroup, [archDirection * 2.8, 8.4, -1.2], 2.0);

    this.group.add(treeGroup);
  }

  // --- 3. Platform & Station Framing Trees ---
  createPlatformTree({ x, y, z }) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    const barkMat = ToonMaterialFactory.getToonMaterial({ color: 0x422d22 });
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.1, 3.0, -0.2),
      new THREE.Vector3(0.1, 5.8, -0.3),
      new THREE.Vector3(0, 7.2, -0.1)
    ]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.34, 8, false);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.castShadow = true;
    treeGroup.add(trunk);

    this.createFoliageClusters(treeGroup, [0, 7.8, -0.1], 2.4);
    this.createFoliageClusters(treeGroup, [-1.6, 7.2, 0.8], 1.8);
    this.createFoliageClusters(treeGroup, [1.4, 7.4, -1.0], 1.8);

    this.group.add(treeGroup);
  }

  // --- 4. Garden Tree Peeking Over Wall ---
  createGardenTree({ x, y, z }) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    const barkMat = ToonMaterialFactory.getToonMaterial({ color: 0x422d22 });
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 5.5, 8);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.y = 2.75;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    this.createFoliageClusters(treeGroup, [0, 6.2, 0], 2.2);
    this.group.add(treeGroup);
  }

  // --- Soft Anime Blossom Foliage Clusters ---
  createFoliageClusters(parent, centerPos, baseRadius = 2.0) {
    const numPuffs = 5;

    for (let i = 0; i < numPuffs; i++) {
      const radius = baseRadius * (0.65 + Math.random() * 0.4);
      const geom = new THREE.IcosahedronGeometry(radius, 2);

      // Organic displacement for soft anime puff
      const pos = geom.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const vx = pos.getX(v);
        const vy = pos.getY(v);
        const vz = pos.getZ(v);
        const noise = 1.0 + (Math.sin(vx * 2.5) + Math.cos(vy * 2.5) + Math.sin(vz * 2.5)) * 0.08;
        pos.setXYZ(v, vx * noise, vy * noise, vz * noise);
      }
      geom.computeVertexNormals();

      // Translucent sakura foliage material
      const mat = ToonMaterialFactory.getSakuraMaterial(i);
      const mesh = new THREE.Mesh(geom, mat);

      const offsetDist = baseRadius * 0.4;
      mesh.position.set(
        centerPos[0] + (Math.random() - 0.5) * offsetDist * 2,
        centerPos[1] + (Math.random() - 0.3) * offsetDist * 1.5,
        centerPos[2] + (Math.random() - 0.5) * offsetDist * 2
      );

      mesh.scale.set(1.2, 0.85, 1.1);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }

    // Fresh spring green sprout
    const leafMat = ToonMaterialFactory.getToonMaterial({ color: 0x84cc16 });
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), leafMat);
    leaf.position.set(centerPos[0] + 0.5, centerPos[1] + baseRadius * 0.7, centerPos[2] + 0.3);
    parent.add(leaf);
  }
}
