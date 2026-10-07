/**
 * sakura.js - Procedural Anime Sakura Trees & 3D Falling Petals Particle System
 * Features the majestic Plaza Arching Sakura Tree, embankment cherry trees,
 * soft cloud-like anime foliage canopy, and 2,500+ tumbling falling petals with wind physics.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getPetalTexture } from './textures.js';

export class SakuraSystem {
  constructor(scene) {
    this.scene = scene;
    this.treesGroup = new THREE.Group();
    this.petalsGroup = new THREE.Group();

    this.petalCount = 2400;
    this.petalSpeed = 1.0;

    this.initTrees();
    this.initFallingPetals();
    this.initGroundPetalDrifts();

    this.scene.add(this.treesGroup);
    this.scene.add(this.petalsGroup);
  }

  // -------------------------------------------------------------
  // 1. Procedural Anime Cherry Blossom Trees
  // -------------------------------------------------------------
  initTrees() {
    // 1. The Plaza Monarch (Huge ancient sakura tree arching over street and station)
    this.createSakuraTree({
      x: 11.5,
      y: 0.18,
      z: -9.0,
      scale: 1.45,
      leanAngle: 0.22,
      leanDir: -Math.PI * 0.75, // Leans gracefully towards street & station
      trunkRadius: 0.75,
      canopyRadius: 7.2
    });

    // 2. Railway Embankment Tree (Behind Platform)
    this.createSakuraTree({
      x: -12.0,
      y: 0.45,
      z: -32.5,
      scale: 1.2,
      leanAngle: 0.15,
      leanDir: 0.4,
      trunkRadius: 0.55,
      canopyRadius: 5.8
    });

    // 3. Station Approach Corner Tree (Near Cafe)
    this.createSakuraTree({
      x: -9.0,
      y: 0.1,
      z: 5.0,
      scale: 1.15,
      leanAngle: 0.18,
      leanDir: 0.8,
      trunkRadius: 0.5,
      canopyRadius: 5.2
    });

    // 4. Level Crossing Foreground Sakura Tree (Right side of crossing)
    this.createSakuraTree({
      x: 7.5,
      y: 0.1,
      z: -17.5,
      scale: 1.25,
      leanAngle: 0.16,
      leanDir: -0.6,
      trunkRadius: 0.6,
      canopyRadius: 6.0
    });

    // 5. Residential House B Garden Sakura Tree (Peeking over wall)
    this.createSakuraTree({
      x: 18.0,
      y: 0.1,
      z: 2.0,
      scale: 1.05,
      leanAngle: 0.12,
      leanDir: -1.2,
      trunkRadius: 0.45,
      canopyRadius: 4.8
    });

    // 6. Far Embankment Sakura Tree (East end of tracks)
    this.createSakuraTree({
      x: 35.0,
      y: 0.45,
      z: -33.0,
      scale: 1.3,
      leanAngle: 0.14,
      leanDir: 0.2,
      trunkRadius: 0.6,
      canopyRadius: 6.2
    });
  }

  createSakuraTree({ x, y, z, scale, leanAngle, leanDir, trunkRadius, canopyRadius }) {
    const treeGroup = new THREE.Group();

    // 1. Gnarled Anime Trunk & Main Boughs
    const trunkMat = materials.sakuraTrunk;
    const trunkHeight = 6.2 * scale;

    // Curved trunk spline
    const leanX = Math.cos(leanDir) * Math.sin(leanAngle) * trunkHeight;
    const leanZ = Math.sin(leanDir) * Math.sin(leanAngle) * trunkHeight;

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(leanX * 0.2, trunkHeight * 0.3, leanZ * 0.2),
      new THREE.Vector3(leanX * 0.6, trunkHeight * 0.65, leanZ * 0.6),
      new THREE.Vector3(leanX, trunkHeight, leanZ)
    ]);

    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 16, trunkRadius, 10, false);
    const trunkMesh = createOutlinedMesh(trunkGeo, trunkMat, 0.035);
    treeGroup.add(trunkMesh);

    // Major branches branching out
    const branches = [
      { start: 0.55, dir: leanDir + 0.8, len: 3.8 * scale, rad: trunkRadius * 0.55 },
      { start: 0.75, dir: leanDir - 0.9, len: 4.2 * scale, rad: trunkRadius * 0.5 },
      { start: 0.92, dir: leanDir + 2.2, len: 3.5 * scale, rad: trunkRadius * 0.45 }
    ];

    branches.forEach(b => {
      const startPt = trunkCurve.getPoint(b.start);
      const endX = startPt.x + Math.cos(b.dir) * b.len;
      const endY = startPt.y + (1.2 + Math.random() * 0.8) * scale;
      const endZ = startPt.z + Math.sin(b.dir) * b.len;

      const bCurve = new THREE.CatmullRomCurve3([
        startPt,
        new THREE.Vector3((startPt.x + endX) * 0.5, (startPt.y + endY) * 0.55, (startPt.z + endZ) * 0.5),
        new THREE.Vector3(endX, endY, endZ)
      ]);
      const bGeo = new THREE.TubeGeometry(bCurve, 10, b.rad, 8, false);
      const bMesh = createOutlinedMesh(bGeo, trunkMat, 0.025);
      treeGroup.add(bMesh);
    });

    // 2. Volumetric Soft Anime Blossom Cloud Clusters
    // We position multiple overlapping spheres and smooth their normals for soft anime cel-shading
    const canopyGroup = new THREE.Group();
    const clusterPositions = [
      { dx: leanX, dy: trunkHeight + 1.2 * scale, dz: leanZ, r: canopyRadius * 0.62 },
      { dx: leanX + 2.8 * scale, dy: trunkHeight + 0.5 * scale, dz: leanZ + 1.8 * scale, r: canopyRadius * 0.52 },
      { dx: leanX - 2.6 * scale, dy: trunkHeight + 0.8 * scale, dz: leanZ - 2.0 * scale, r: canopyRadius * 0.5 },
      { dx: leanX + 1.2 * scale, dy: trunkHeight + 2.2 * scale, dz: leanZ - 1.5 * scale, r: canopyRadius * 0.48 },
      { dx: leanX - 1.8 * scale, dy: trunkHeight + 0.2 * scale, dz: leanZ + 2.4 * scale, r: canopyRadius * 0.46 },
      { dx: leanX + 3.4 * scale, dy: trunkHeight - 0.4 * scale, dz: leanZ - 1.2 * scale, r: canopyRadius * 0.42 },
      { dx: leanX - 3.2 * scale, dy: trunkHeight - 0.2 * scale, dz: leanZ + 0.8 * scale, r: canopyRadius * 0.4 }
    ];

    const pinkMaterials = [
      materials.sakuraCanopyLight,
      materials.sakuraCanopyMid,
      materials.sakuraCanopyDeep
    ];

    clusterPositions.forEach((cl, idx) => {
      const geo = new THREE.DodecahedronGeometry(cl.r, 2);
      // Soften normals outward from center of tree for smooth studio Ghibli / Shinkai anime shading
      const pos = geo.attributes.position;
      const norm = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
        norm.setXYZ(i, v.x, v.y, v.z);
      }
      norm.needsUpdate = true;

      const mat = pinkMaterials[idx % pinkMaterials.length];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cl.dx, cl.dy, cl.dz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      canopyGroup.add(mesh);
    });

    treeGroup.add(canopyGroup);

    treeGroup.position.set(x, y, z);
    this.treesGroup.add(treeGroup);
  }

  // -------------------------------------------------------------
  // 2. Dynamic 3D Falling Petals Particle System (2,500+ Petals)
  // -------------------------------------------------------------
  initFallingPetals() {
    const geo = new THREE.PlaneGeometry(0.18, 0.18);
    const petalTex = getPetalTexture();

    const mat = new THREE.MeshBasicMaterial({
      map: petalTex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Instanced Mesh for high-performance 60FPS animation
    this.petalInstanced = new THREE.InstancedMesh(geo, mat, this.petalCount);

    this.petalData = [];
    const dummy = new THREE.Object3D();

    // Volume range where petals spawn and drift
    this.bounds = {
      minX: -45, maxX: 45,
      minY: 0.1, maxY: 26,
      minZ: -45, maxZ: 45
    };

    for (let i = 0; i < this.petalCount; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const y = THREE.MathUtils.randFloat(this.bounds.minY, this.bounds.maxY);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const scale = 0.7 + Math.random() * 0.8;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      this.petalInstanced.setMatrixAt(i, dummy.matrix);

      this.petalData.push({
        x, y, z,
        scale,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 2.2,
        rotSpeedY: (Math.random() - 0.5) * 3.0,
        rotSpeedZ: (Math.random() - 0.5) * 2.0,
        fallSpeed: 0.7 + Math.random() * 0.9,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 1.2 + Math.random() * 1.5,
        windInfluence: 0.8 + Math.random() * 0.6
      });
    }

    this.petalInstanced.instanceMatrix.needsUpdate = true;
    this.petalsGroup.add(this.petalInstanced);
    this.dummy = dummy;
  }

  // -------------------------------------------------------------
  // 3. Accumulated Ground Petal Drifts (Curbs, Benches, Roofs)
  // -------------------------------------------------------------
  initGroundPetalDrifts() {
    const driftPositions = [
      // Along platform shelter roof
      { x: -6, y: 3.56, z: -20.2, rx: 1.2, rz: 0.8 },
      { x: 4, y: 3.56, z: -20.2, rx: 1.5, rz: 0.9 },
      // On train roof
      { x: -9, y: 4.52, z: -23.2, rx: 1.4, rz: 1.1 },
      { x: 6, y: 4.52, z: -23.2, rx: 1.6, rz: 1.2 },
      // Around circular bench at plaza
      { x: 11.5, y: 0.22, z: -8.0, rx: 2.2, rz: 1.8 },
      { x: 12.8, y: 0.22, z: -9.8, rx: 1.8, rz: 2.0 },
      // Roadside corners
      { x: -3.8, y: 0.05, z: 12.0, rx: 1.2, rz: 0.6 },
      { x: 4.2, y: 0.05, z: 2.0, rx: 1.0, rz: 0.7 }
    ];

    const petalTex = getPetalTexture();
    const driftMat = new THREE.MeshBasicMaterial({
      map: petalTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    driftPositions.forEach(dp => {
      const geo = new THREE.CircleGeometry(1.0, 12);
      const mesh = new THREE.Mesh(geo, driftMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(dp.x, dp.y, dp.z);
      mesh.scale.set(dp.rx, dp.rz, 1);
      this.petalsGroup.add(mesh);
    });
  }

  setPetalCount(count) {
    this.petalCount = Math.min(count, this.petalData.length);
    this.petalInstanced.count = this.petalCount;
  }

  update(delta, time) {
    // Animate falling petals with realistic wind advection, flutter, and swirl
    const dummy = this.dummy;
    const baseWindX = 1.4; // Breeze blowing down the street
    const baseWindZ = -0.6;

    for (let i = 0; i < this.petalCount; i++) {
      const p = this.petalData[i];

      // Downward gravity fall
      p.y -= p.fallSpeed * delta * this.petalSpeed;

      // Spring breeze horizontal motion + sine wave flutter
      const driftX = Math.sin(time * p.driftSpeed + p.driftPhase) * 0.45;
      const driftZ = Math.cos(time * p.driftSpeed * 0.8 + p.driftPhase) * 0.35;

      p.x += (baseWindX + driftX) * p.windInfluence * delta * this.petalSpeed;
      p.z += (baseWindZ + driftZ) * p.windInfluence * delta * this.petalSpeed;

      // 3D tumbling rotation
      p.rotX += p.rotSpeedX * delta;
      p.rotY += p.rotSpeedY * delta;
      p.rotZ += p.rotSpeedZ * delta;

      // Wrap around bounds (respawn at top or upwind)
      if (p.y < this.bounds.minY) {
        p.y = this.bounds.maxY;
        p.x = THREE.MathUtils.randFloat(this.bounds.minX - 10, this.bounds.maxX + 10);
        p.z = THREE.MathUtils.randFloat(this.bounds.minZ - 10, this.bounds.maxZ + 10);
      }
      if (p.x > this.bounds.maxX) p.x = this.bounds.minX;
      if (p.z < this.bounds.minZ) p.z = this.bounds.maxZ;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();

      this.petalInstanced.setMatrixAt(i, dummy.matrix);
    }

    this.petalInstanced.instanceMatrix.needsUpdate = true;
  }
}
