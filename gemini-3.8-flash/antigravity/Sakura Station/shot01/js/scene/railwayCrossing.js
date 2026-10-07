import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Japanese Railroad Level Crossing (踏切 - Fumikiri)
export class RailwayCrossing {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'railway_crossing';

    this.flashTimer = 0;
    this.flashState = false;
    this.signalLamps = [];
    this.barriersLowered = true;
    this.barrierPoles = [];

    this.init();
  }

  init() {
    this.createCrossingPads();
    this.createCrossingGates();
    this.createCrossingRoadHatching();

    this.scene.add(this.group);
  }

  createCrossingPads() {
    // Heavy rubber / concrete flangeway panels (踏切渡り板) across rails at X = 22, Z = -12.5 to -20.5
    const padMat = ToonMaterialFactory.getToonMaterial({
      color: 0x27272a, // Heavy vulcanized black rubber
      roughness: 0.8
    });

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.22, 8.2),
      padMat
    );
    pad.position.set(22, 0.44, -16.5);
    pad.receiveShadow = true;
    this.group.add(pad);

    // Beveled yellow safety edges on the road crossing
    const yellowEdgeMat = ToonMaterialFactory.getToonMaterial({ color: 0xeab308 });
    [-4.1, 4.1].forEach(oz => {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.05, 0.2),
        yellowEdgeMat
      );
      edge.position.set(22, 0.56, -16.5 + oz);
      this.group.add(edge);
    });
  }

  createCrossingGates() {
    // Two Crossing Gate Masts:
    // South Mast: X = 17.5, Z = -11.5 (facing South)
    // North Mast: X = 26.5, Z = -21.5 (facing North)
    const positions = [
      { x: 17.5, z: -11.5, rotY: 0, barrierDir: 1 },
      { x: 26.5, z: -21.5, rotY: Math.PI, barrierDir: -1 }
    ];

    const mastMat = ToonMaterialFactory.getToonMaterial({
      color: 0x334155, // Steel dark gray
      metalness: 0.4
    });

    const stripeTex = TextureGenerator.createFumikiriStripesTexture();
    const barrierMat = new THREE.MeshBasicMaterial({ map: stripeTex });

    const crossbuckTex = TextureGenerator.createCrossbuckSignTexture();
    const crossbuckMat = new THREE.MeshBasicMaterial({
      map: crossbuckTex,
      transparent: true
    });

    positions.forEach((pos, idx) => {
      const mastGroup = new THREE.Group();
      mastGroup.position.set(pos.x, 0, pos.z);
      mastGroup.rotation.y = pos.rotY;

      // 1. Vertical Mast Pole (Steel cylinder)
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 5.0, 16),
        mastMat
      );
      pole.position.y = 2.5;
      pole.castShadow = true;
      mastGroup.add(pole);

      // Yellow/Black striped crash protection wrap around pole base
      const wrapMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 1.2, 16),
        barrierMat
      );
      wrapMesh.position.y = 0.6;
      mastGroup.add(wrapMesh);

      // 2. Crossbuck Railroad Warning Sign ("踏切注意" / X-Sign)
      const xSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        crossbuckMat
      );
      xSign.position.set(0, 4.4, 0.15);
      mastGroup.add(xSign);

      // 3. Dual Alternating Flashing Red Alert Lamps (警報灯)
      const lampHousingMat = ToonMaterialFactory.getToonMaterial({ color: 0x0f172a });
      const lampBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.1, 0.15),
        lampHousingMat
      );
      lampBar.position.set(0, 3.7, 0.12);
      mastGroup.add(lampBar);

      // Left & Right Red Lamps
      const lampL = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 16),
        ToonMaterialFactory.getEmissiveMaterial(0xef4444, 2.5)
      );
      lampL.position.set(-0.45, 3.7, 0.22);
      mastGroup.add(lampL);

      const lampR = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 16),
        new THREE.MeshBasicMaterial({ color: 0x450a0a }) // Initially dim
      );
      lampR.position.set(0.45, 3.7, 0.22);
      mastGroup.add(lampR);

      // Visors over lamps
      [-0.45, 0.45].forEach(lx => {
        const visor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12, 1, true, 0, Math.PI),
          lampHousingMat
        );
        visor.rotation.x = Math.PI / 2;
        visor.position.set(lx, 3.82, 0.22);
        mastGroup.add(visor);
      });

      this.signalLamps.push({ lampL, lampR });

      // 4. Acoustic Bell Chime Alarm Gong on top
      const gong = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.25, 12),
        mastMat
      );
      gong.position.set(0, 5.1, 0);
      mastGroup.add(gong);

      // 5. Motorized Boom Gate Mechanism & Striped Barrier Pole
      const motorBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.8, 0.5),
        ToonMaterialFactory.getToonMaterial({ color: 0x475569 })
      );
      motorBox.position.set(0, 1.1, 0);
      mastGroup.add(motorBox);

      // Counterweight arm
      const counterWeight = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.25, 0.4),
        ToonMaterialFactory.getToonMaterial({ color: 0x1e293b })
      );
      counterWeight.position.set(-0.5, 1.1, 0);
      mastGroup.add(counterWeight);

      // The Long Black & Yellow Striped Barrier Pole (遮断杆)
      // Spans ~7.5 meters across the road
      const polePivot = new THREE.Group();
      polePivot.position.set(0, 1.1, 0.2);

      const barrierPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 7.5, 12),
        barrierMat
      );
      barrierPole.rotation.z = Math.PI / 2;
      barrierPole.position.set(3.75, 0, 0);
      polePivot.add(barrierPole);

      // Hanging red reflector fringe ribbons along barrier
      for (let rx = 1.0; rx <= 6.5; rx += 1.2) {
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.4, 0.01),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        ribbon.position.set(rx, -0.2, 0);
        polePivot.add(ribbon);
      }

      mastGroup.add(polePivot);
      this.barrierPoles.push(polePivot);

      this.group.add(mastGroup);
    });
  }

  createCrossingRoadHatching() {
    // Yellow diagonal safety keep-clear markings (踏切内進入禁止)
    const hatchMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85
    });

    // Pavement stop line at crossing approaches
    [-11.2, -21.8].forEach(z => {
      const stopLine = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xf8fafc })
      );
      stopLine.rotation.x = -Math.PI / 2;
      stopLine.position.set(22, 0.04, z);
      this.group.add(stopLine);
    });
  }

  update(delta) {
    // Alternate blinking red signal lights (~1.4Hz)
    this.flashTimer += delta;
    if (this.flashTimer > 0.45) {
      this.flashTimer = 0;
      this.flashState = !this.flashState;

      this.signalLamps.forEach(pair => {
        if (this.flashState) {
          pair.lampL.material.color.setHex(0xef4444); // Bright
          pair.lampR.material.color.setHex(0x450a0a); // Dim
        } else {
          pair.lampL.material.color.setHex(0x450a0a); // Dim
          pair.lampR.material.color.setHex(0xef4444); // Bright
        }
      });
    }
  }
}
