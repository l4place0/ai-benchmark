import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';

// Railway Tracks, Ballast Bed, Sleepers, Overhead Catenary & Rail Signals
export class TracksAndCatenary {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'tracks_and_catenary';

    this.init();
  }

  init() {
    this.createBallastBed();
    this.createRailsAndSleepers();
    this.createOverheadCatenary();
    this.createRailwaySignals();
    this.createWaysideEquipment();

    this.scene.add(this.group);
  }

  createBallastBed() {
    // Crushed stone ballast gravel bed (道床碎石)
    const ballastMat = ToonMaterialFactory.getToonMaterial({
      color: 0x595d66, // Slate gravel gray
      roughness: 0.95
    });

    // Elevated gravel bed for double tracks (Z = -12.5 to -20.5, length = 200m)
    const bedGeo = new THREE.BoxGeometry(200, 0.35, 8.5);
    const ballastBed = new THREE.Mesh(bedGeo, ballastMat);
    ballastBed.position.set(0, 0.15, -16.5);
    ballastBed.receiveShadow = true;
    this.group.add(ballastBed);

    // Beveled gravel slope shoulders
    const shoulderMat = ToonMaterialFactory.getToonMaterial({
      color: 0x4a4e56,
      roughness: 0.95
    });
    [-20.8, -12.2].forEach(z => {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(200, 0.2, 0.8),
        shoulderMat
      );
      shoulder.position.set(0, 0.1, z);
      this.group.add(shoulder);
    });

    // Scattered wild weeds & dandelions sprouting between ballast stones
    const weedMat = ToonMaterialFactory.getToonMaterial({ color: 0x65a30d });
    for (let i = 0; i < 45; i++) {
      const weed = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 + Math.random() * 0.08, 0.3, 4),
        weedMat
      );
      weed.position.set(
        -80 + Math.random() * 160,
        0.35,
        -16.5 + (Math.random() - 0.5) * 6.5
      );
      weed.rotation.y = Math.random() * Math.PI;
      this.group.add(weed);
    }
  }

  createRailsAndSleepers() {
    // Track 1 (Platform side): Z = -14.8
    // Track 2 (Far side): Z = -18.2
    // Standard gauge = 1.435m (visual gauge ~1.5m, spacing between inner rails = 1.5m)
    const trackZPositions = [-14.8, -18.2];
    const railGauge = 1.5;
    const trackLength = 200;

    // Materials
    // 1. Polished steel rail head (shiny top with specular anime highlight)
    const railHeadMat = ToonMaterialFactory.getToonMaterial({
      color: 0xe2e8f0, // Polished silver-white
      metalness: 0.7,
      roughness: 0.2
    });

    // 2. Weathered rusted rail base & web
    const railBaseMat = ToonMaterialFactory.getToonMaterial({
      color: 0x574338, // Rust brown-gray
      roughness: 0.8
    });

    // 3. Treated wooden / concrete sleepers (枕木)
    const sleeperMat = ToonMaterialFactory.getToonMaterial({
      color: 0x3f352e, // Dark creosote timber
      roughness: 0.85
    });

    // Create sleepers using InstancedMesh for high performance
    const sleeperSpacing = 0.7; // ~0.7m spacing
    const numSleepersPerTrack = Math.floor(trackLength / sleeperSpacing);
    const totalSleepers = numSleepersPerTrack * trackZPositions.length;

    const sleeperGeo = new THREE.BoxGeometry(0.24, 0.16, 2.4);
    const sleeperInstanced = new THREE.InstancedMesh(sleeperGeo, sleeperMat, totalSleepers);
    sleeperInstanced.castShadow = true;
    sleeperInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let instanceIdx = 0;

    trackZPositions.forEach(tz => {
      // Sleepers
      for (let i = 0; i < numSleepersPerTrack; i++) {
        const x = -trackLength / 2 + i * sleeperSpacing;
        dummy.position.set(x, 0.36, tz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        sleeperInstanced.setMatrixAt(instanceIdx++, dummy.matrix);
      }

      // Continuous Steel Rails (Two rails per track)
      [-railGauge / 2, railGauge / 2].forEach(offset => {
        const railZ = tz + offset;

        // Rail Web & Base
        const railBase = new THREE.Mesh(
          new THREE.BoxGeometry(trackLength, 0.16, 0.08),
          railBaseMat
        );
        railBase.position.set(0, 0.44, railZ);
        this.group.add(railBase);

        // Rail Top Head (Bright Specular)
        const railTop = new THREE.Mesh(
          new THREE.BoxGeometry(trackLength, 0.04, 0.06),
          railHeadMat
        );
        railTop.position.set(0, 0.54, railZ);
        this.group.add(railTop);
      });
    });

    this.group.add(sleeperInstanced);
  }

  createOverheadCatenary() {
    // Structural steel gantry portals (架线门型架) across both tracks
    const steelMat = ToonMaterialFactory.getToonMaterial({
      color: 0x475569, // Industrial steel
      metalness: 0.3,
      roughness: 0.6
    });

    const insulatorMat = ToonMaterialFactory.getToonMaterial({
      color: 0x93c5fd // Porcelain cyan insulators
    });

    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    const portalXs = [-72, -48, -24, 0, 24, 48, 72];

    portalXs.forEach(px => {
      // Upright steel lattice mast Left
      const mastL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 7.5, 8),
        steelMat
      );
      mastL.position.set(px, 3.75, -11.8);
      mastL.castShadow = true;
      this.group.add(mastL);

      // Upright steel lattice mast Right
      const mastR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 7.5, 8),
        steelMat
      );
      mastR.position.set(px, 3.75, -21.2);
      mastR.castShadow = true;
      this.group.add(mastR);

      // Horizontal Truss Gantry Beam spanning both tracks
      const gantryBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.45, 9.8),
        steelMat
      );
      gantryBeam.position.set(px, 7.2, -16.5);
      gantryBeam.castShadow = true;
      this.group.add(gantryBeam);

      // Drop arms & ceramic insulators for each track
      [-14.8, -18.2].forEach(tz => {
        // Insulator stack
        const insulator = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8),
          insulatorMat
        );
        insulator.position.set(px, 6.7, tz);
        this.group.add(insulator);

        // Cantilever registration arm
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.2),
          steelMat
        );
        arm.position.set(px, 6.2, tz);
        this.group.add(arm);
      });
    });

    // Continuous Overhead Contact Wire (接触线 at Y = 5.6m) and Messenger Wire (承力索 at Y = 6.4m)
    [-14.8, -18.2].forEach(tz => {
      // Contact wire
      const contactWire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 200, 4),
        wireMat
      );
      contactWire.rotation.z = Math.PI / 2;
      contactWire.position.set(0, 5.6, tz);
      this.group.add(contactWire);

      // Messenger wire
      const messengerWire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 200, 4),
        wireMat
      );
      messengerWire.rotation.z = Math.PI / 2;
      messengerWire.position.set(0, 6.5, tz);
      this.group.add(messengerWire);
    });
  }

  createRailwaySignals() {
    // Railway Color Light Signal Masts (信号機)
    const poleMat = ToonMaterialFactory.getToonMaterial({ color: 0x334155 });

    const signals = [
      { x: -32, z: -13.0, green: true },  // Track 1 departure green
      { x: 12, z: -13.0, green: true },   // Track 1 approach green
      { x: -5, z: -20.0, green: false }   // Track 2 red aspect
    ];

    signals.forEach(sig => {
      const sigGroup = new THREE.Group();
      sigGroup.position.set(sig.x, 0, sig.z);

      // Signal mast pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 4.2),
        poleMat
      );
      pole.position.y = 2.1;
      sigGroup.add(pole);

      // Signal head housing (Black with circular background shield)
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.8, 0.18),
        ToonMaterialFactory.getToonMaterial({ color: 0x0f172a })
      );
      head.position.set(0, 3.8, 0);
      sigGroup.add(head);

      // Circular back shield
      const shield = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 16),
        ToonMaterialFactory.getToonMaterial({ color: 0x0f172a })
      );
      shield.position.set(0.14, 3.8, 0);
      shield.rotation.y = Math.PI / 2;
      sigGroup.add(shield);

      // Aspect lamps: Top Green, Bottom Red
      const topLampMat = sig.green
        ? ToonMaterialFactory.getEmissiveMaterial(0x22c55e, 2.5) // Glowing Green
        : new THREE.MeshBasicMaterial({ color: 0x064e3b });

      const btmLampMat = !sig.green
        ? ToonMaterialFactory.getEmissiveMaterial(0xef4444, 2.5) // Glowing Red
        : new THREE.MeshBasicMaterial({ color: 0x450a0a });

      const topLamp = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), topLampMat);
      topLamp.position.set(0.15, 4.0, 0);
      topLamp.rotation.y = Math.PI / 2;
      sigGroup.add(topLamp);

      const btmLamp = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), btmLampMat);
      btmLamp.position.set(0.15, 3.6, 0);
      btmLamp.rotation.y = Math.PI / 2;
      sigGroup.add(btmLamp);

      this.group.add(sigGroup);
    });
  }

  createWaysideEquipment() {
    // Trackside Relay Cabinets, Milestone Markers & Cable Troughs
    const boxMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8, // Light industrial gray
      roughness: 0.6
    });

    // Milestone post ("14.8 km")
    const postMat = ToonMaterialFactory.getToonMaterial({ color: 0xf8fafc });
    const milestone = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.75, 0.14),
      postMat
    );
    milestone.position.set(-18, 0.6, -13.2);
    this.group.add(milestone);

    // Wayside equipment relay boxes (配電・継電器箱)
    [-38, 28].forEach(x => {
      const cabinet = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.4, 0.6),
        boxMat
      );
      cabinet.position.set(x, 0.95, -13.0);
      cabinet.castShadow = true;
      this.group.add(cabinet);
    });

    // Concrete cable trough running parallel to tracks
    const troughMat = ToonMaterialFactory.getToonMaterial({ color: 0x64748b });
    const trough = new THREE.Mesh(
      new THREE.BoxGeometry(160, 0.1, 0.25),
      troughMat
    );
    trough.position.set(0, 0.38, -13.4);
    this.group.add(trough);
  }
}
