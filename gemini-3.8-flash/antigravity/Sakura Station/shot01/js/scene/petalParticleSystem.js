import * as THREE from 'three';

// 3D Instanced Falling Sakura Petals Particle System (飘落樱花与花吹雪)
export class PetalParticleSystem {
  constructor(scene, count = 2800) {
    this.scene = scene;
    this.count = count;
    this.stormMode = false;
    this.windIntensity = 1.0;

    this.instancedMesh = null;
    this.particleData = [];
    this.dummy = new THREE.Object3D();

    this.init();
  }

  init() {
    this.createPetalMesh();
    this.createGroundPetalDrifts();
  }

  createPetalMesh() {
    // 3D Organic Curved Sakura Petal Geometry
    // Creates a double-lobed notched cherry blossom petal
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.06, 0.08, -0.12, 0.22, -0.06, 0.32);
    shape.bezierCurveTo(-0.03, 0.38, -0.02, 0.40, 0, 0.36); // Center notch
    shape.bezierCurveTo(0.02, 0.40, 0.03, 0.38, 0.06, 0.32);
    shape.bezierCurveTo(0.12, 0.22, 0.06, 0.08, 0, 0);

    const petalGeo = new THREE.ShapeGeometry(shape, 6);

    // Subtle 3D curvature: bend petal along center
    const pos = petalGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, (1.0 - Math.abs(x) * 4.0) * y * 0.08);
    }
    petalGeo.computeVertexNormals();

    // Petal Anime Material (Semi-translucent with soft spring pink and delicate specular)
    const petalMat = new THREE.MeshToonMaterial({
      color: 0xffb7c8,
      emissive: 0xff8fa3,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });

    this.instancedMesh = new THREE.InstancedMesh(petalGeo, petalMat, this.count);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Bounding bounds for falling petals:
    // X: -45 to 35
    // Y: 0.1 to 18
    // Z: -35 to 55
    for (let i = 0; i < this.count; i++) {
      const p = {
        x: -45 + Math.random() * 80,
        y: 0.2 + Math.random() * 18,
        z: -35 + Math.random() * 90,
        scale: 0.6 + Math.random() * 0.8,
        // Angular tumble velocities
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 4.0,
        rotSpeedY: (Math.random() - 0.5) * 5.0,
        rotSpeedZ: (Math.random() - 0.5) * 3.0,
        // Fall & drift velocities
        fallSpeed: 0.6 + Math.random() * 0.8,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 1.5 + Math.random() * 2.0,
        swayAmp: 0.8 + Math.random() * 0.8
      };

      this.particleData.push(p);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      this.dummy.scale.set(p.scale, p.scale, p.scale);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.instancedMesh);
  }

  createGroundPetalDrifts() {
    // Drifts of fallen petals naturally accumulated on ground edges, curbs & rails
    const driftMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    // Petal patches along curbs & wall corners
    const driftLocations = [
      { x: 5.4, z: 24, w: 0.6, l: 3.2, rot: 0.1 },
      { x: 12.6, z: 32, w: 0.5, l: 4.0, rot: -0.05 },
      { x: -5.8, z: 8.5, w: 1.8, l: 1.8, rot: 0.4 }, // Under plaza tree
      { x: -9.2, z: 6.8, w: 2.2, l: 1.4, rot: -0.2 },
      { x: 21.5, z: -14.2, w: 1.2, l: 2.5, rot: 0 },  // Railroad crossing edge
      { x: -12.0, z: -12.4, w: 0.4, l: 6.0, rot: 0 }  // Platform edge
    ];

    driftLocations.forEach(d => {
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(d.w, d.l),
        driftMat
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = d.rot;
      patch.position.set(d.x, 0.08, d.z);
      this.scene.add(patch);
    });
  }

  setStormMode(enabled) {
    this.stormMode = enabled;
    this.windIntensity = enabled ? 3.5 : 1.0;
  }

  update(delta) {
    if (!this.instancedMesh) return;

    const windSpeedX = (1.4 + Math.sin(Date.now() * 0.001) * 0.6) * this.windIntensity;
    const windSpeedZ = (0.8 + Math.cos(Date.now() * 0.0012) * 0.4) * this.windIntensity;

    for (let i = 0; i < this.count; i++) {
      const p = this.particleData[i];

      // Update position
      p.swayPhase += delta * p.swayFreq;
      p.y -= p.fallSpeed * delta * (this.stormMode ? 1.4 : 1.0);
      p.x += (windSpeedX + Math.sin(p.swayPhase) * p.swayAmp) * delta;
      p.z += (windSpeedZ + Math.cos(p.swayPhase) * p.swayAmp * 0.6) * delta;

      // Update 3D tumbling rotation
      p.rotX += p.rotSpeedX * delta * this.windIntensity;
      p.rotY += p.rotSpeedY * delta * this.windIntensity;
      p.rotZ += p.rotSpeedZ * delta * this.windIntensity;

      // Respawn when hitting ground or moving out of bounds
      if (p.y < 0.1 || p.x > 38 || p.z > 58) {
        p.y = 14 + Math.random() * 5;
        p.x = -45 + Math.random() * 40;
        p.z = -35 + Math.random() * 50;
      }

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      this.dummy.scale.set(p.scale, p.scale, p.scale);
      this.dummy.updateMatrix();

      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
