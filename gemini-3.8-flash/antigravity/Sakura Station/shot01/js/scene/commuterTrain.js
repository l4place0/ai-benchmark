import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// 2-Car Suburban Japanese Commuter Train EMU (近郊通勤电车)
export class CommuterTrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'commuter_train';

    this.doorsOpen = true;
    this.doorMeshes = [];
    this.headlights = [];
    this.swayTime = 0;

    this.init();
  }

  init() {
    // Parked on Track 1 (Z = -14.8), spanning X = -28 to +4
    this.group.position.set(-11, 0, -14.8);

    // Car 1 (Lead Car with Cab facing East towards Railway Crossing)
    this.createCarriage({ isLead: true, posX: 8.5 });

    // Car 2 (Trailing Passenger Car)
    this.createCarriage({ isLead: false, posX: -8.5 });

    // Gangway Coupler between cars
    this.createCoupler();

    this.scene.add(this.group);
  }

  createCarriage({ isLead = false, posX = 0 }) {
    const carGroup = new THREE.Group();
    carGroup.position.set(posX, 0, 0);

    const carLength = 16.0;
    const carWidth = 2.8;
    const carHeight = 3.2;

    // Materials
    const bodyMat = ToonMaterialFactory.getToonMaterial({
      color: 0xf8fafc, // Clean pearl white
      metalness: 0.2,
      roughness: 0.3
    });

    const skirtMat = ToonMaterialFactory.getToonMaterial({
      color: 0x475569, // Dark gray undercarriage skirt
      roughness: 0.7
    });

    const sakuraStripeMat = ToonMaterialFactory.getToonMaterial({
      color: 0xf472b6, // Vibrant Sakura Pink
      roughness: 0.4
    });

    const mintStripeMat = ToonMaterialFactory.getToonMaterial({
      color: 0x34d399, // Fresh Mint Green
      roughness: 0.4
    });

    const glassMat = ToonMaterialFactory.getGlassMaterial({
      color: 0x7dd3fc,
      opacity: 0.55
    });

    // 1. Main Car Body Shell
    const bodyGeo = new THREE.BoxGeometry(carLength, carHeight, carWidth);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 2.3, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    carGroup.add(body);

    // 2. Rounded Aerodynamic Cab Front (if lead car)
    if (isLead) {
      const noseGeo = new THREE.CylinderGeometry(1.4, 1.4, carHeight, 16, 1, false, 0, Math.PI);
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.rotation.z = Math.PI / 2;
      nose.rotation.y = Math.PI / 2;
      nose.position.set(carLength / 2, 2.3, 0);
      carGroup.add(nose);

      // Panoramic Cab Front Windshield (Curved)
      const cabGlassMat = ToonMaterialFactory.getGlassMaterial({
        color: 0x38bdf8,
        opacity: 0.7
      });
      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.4, 2.2),
        cabGlassMat
      );
      windshield.position.set(carLength / 2 + 0.65, 2.6, 0);
      carGroup.add(windshield);

      // Black anti-glare mask around cab windshield
      const mask = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.6, 2.4),
        ToonMaterialFactory.getToonMaterial({ color: 0x0f172a })
      );
      mask.position.set(carLength / 2 + 0.6, 2.6, 0);
      carGroup.add(mask);

      // Front Destination LED Rollsign ("快速 桜ヶ丘")
      const ledTex = TextureGenerator.createTrainLEDTexture();
      const ledMat = new THREE.MeshBasicMaterial({ map: ledTex });
      const ledSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.4),
        ledMat
      );
      ledSign.rotation.y = Math.PI / 2;
      ledSign.position.set(carLength / 2 + 0.76, 3.3, 0);
      carGroup.add(ledSign);

      // Dual Warm LED Headlights (Glowing)
      [-0.7, 0.7].forEach(z => {
        const headlight = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16),
          ToonMaterialFactory.getEmissiveMaterial(0xfef08a, 3.0)
        );
        headlight.rotation.z = Math.PI / 2;
        headlight.position.set(carLength / 2 + 0.74, 1.6, z);
        carGroup.add(headlight);

        // Spot light beam casting forward onto tracks
        const spot = new THREE.SpotLight(0xfef08a, 2.5, 35, Math.PI / 6, 0.4);
        spot.position.set(carLength / 2 + 0.8, 1.6, z);
        spot.target.position.set(carLength / 2 + 20, 0.4, z);
        carGroup.add(spot);
        carGroup.add(spot.target);
        this.headlights.push(spot);
      });

      // Red Tail Marker Lamps (Top corners)
      [-0.95, 0.95].forEach(z => {
        const tailLamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12),
          ToonMaterialFactory.getEmissiveMaterial(0xef4444, 2.0)
        );
        tailLamp.rotation.z = Math.PI / 2;
        tailLamp.position.set(carLength / 2 + 0.72, 3.4, z);
        carGroup.add(tailLamp);
      });

      // Front Coupler & Cowcatcher Skirt (密着連結器)
      const coupler = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.25, 0.35),
        skirtMat
      );
      coupler.position.set(carLength / 2 + 0.8, 0.75, 0);
      carGroup.add(coupler);
    }

    // 3. Iconic Sakura & Mint Double Waist Stripes (Running along car sides)
    [-carWidth / 2 - 0.02, carWidth / 2 + 0.02].forEach(sideZ => {
      // Pink stripe
      const pStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(carLength, 0.16),
        sakuraStripeMat
      );
      pStripe.position.set(0, 1.9, sideZ);
      if (sideZ < 0) pStripe.rotation.y = Math.PI;
      carGroup.add(pStripe);

      // Mint stripe
      const mStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(carLength, 0.08),
        mintStripeMat
      );
      mStripe.position.set(0, 1.76, sideZ);
      if (sideZ < 0) mStripe.rotation.y = Math.PI;
      carGroup.add(mStripe);
    });

    // 4. Passenger Windows & Sliding Doors (Platform side: Z = carWidth/2)
    // 3 Double-doors per carriage
    const doorXs = [-5.0, 0.0, 5.0];
    const windowXs = [-6.8, -3.2, -1.8, 1.8, 3.2, 6.8];

    // Windows
    windowXs.forEach(wx => {
      // Platform side window
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 1.05),
        glassMat
      );
      win.position.set(wx, 2.65, carWidth / 2 + 0.02);
      carGroup.add(win);

      // Far side window
      const winFar = win.clone();
      winFar.rotation.y = Math.PI;
      winFar.position.set(wx, 2.65, -carWidth / 2 - 0.02);
      carGroup.add(winFar);
    });

    // Sliding Doors (Open State on Platform Side)
    doorXs.forEach(dx => {
      // Door frame opening (Dark interior entry)
      const doorHole = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      doorHole.position.set(dx, 2.0, carWidth / 2 + 0.015);
      carGroup.add(doorHole);

      // Yellow threshold safety stripe at door edge
      const stepStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      stepStripe.rotation.x = -Math.PI / 2;
      stepStripe.position.set(dx, 0.91, carWidth / 2 + 0.1);
      carGroup.add(stepStripe);

      // Left & Right sliding door leaves (slid open)
      const doorLeafMat = ToonMaterialFactory.getToonMaterial({ color: 0xe2e8f0 });
      const leafL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.04), doorLeafMat);
      const leafR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 0.04), doorLeafMat);

      // Positioned slid apart by ~1.3m (Open)
      leafL.position.set(dx - 0.95, 2.0, carWidth / 2 + 0.04);
      leafR.position.set(dx + 0.95, 2.0, carWidth / 2 + 0.04);
      carGroup.add(leafL);
      carGroup.add(leafR);
      this.doorMeshes.push({ leafL, leafR, baseDx: dx });
    });

    // 5. Interior Amenities & Silhouettes
    this.createCarInterior(carGroup, carLength, carWidth);

    // 6. Rooftop Air Conditioners & Pantograph (on Lead Car)
    this.createRoofEquipment(carGroup, carLength, isLead);

    // 7. Bogies & Wheels (2 per car)
    [-5.0, 5.0].forEach(bx => {
      this.createBogie(carGroup, bx);
    });

    this.group.add(carGroup);
  }

  createCarInterior(parent, length, width) {
    // Warm interior ceiling lights
    const interiorLight = new THREE.PointLight(0xffedd5, 1.2, 8);
    interiorLight.position.set(0, 3.2, 0);
    parent.add(interiorLight);

    // Blue longitudinal upholstered seats along walls
    const seatMat = ToonMaterialFactory.getToonMaterial({ color: 0x1d4ed8 });
    const seatGeo = new THREE.BoxGeometry(length - 4, 0.35, 0.55);

    const seatL = new THREE.Mesh(seatGeo, seatMat);
    seatL.position.set(0, 1.25, -width / 2 + 0.4);
    parent.add(seatL);

    // Handrail stanchions & hanging straps (吊り革)
    const stanchionMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8,
      metalness: 0.7
    });
    for (let x = -5; x <= 5; x += 2.5) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 2.4),
        stanchionMat
      );
      pole.position.set(x, 2.2, 0);
      parent.add(pole);

      // Hanging ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.015, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      ring.position.set(x, 3.0, 0.4);
      parent.add(ring);
    }
  }

  createRoofEquipment(parent, length, hasPantograph) {
    const acMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8, // Stainless AU75 A/C housing
      metalness: 0.4
    });

    // Two rooftop A/C units per car
    [-3.8, 3.8].forEach(rx => {
      const acUnit = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.45, 1.6),
        acMat
      );
      acUnit.position.set(rx, 4.05, 0);
      acUnit.castShadow = true;
      parent.add(acUnit);

      // Grille slots on AC
      const grille = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshBasicMaterial({ color: 0x334155 })
      );
      grille.rotation.x = -Math.PI / 2;
      grille.position.set(rx, 4.28, 0);
      parent.add(grille);
    });

    // Single-arm / Diamond Pantograph (受电弓) reaching overhead contact wire at Y = 5.6m
    if (hasPantograph) {
      const pantoGroup = new THREE.Group();
      pantoGroup.position.set(6.2, 3.9, 0);

      const pantoMat = ToonMaterialFactory.getToonMaterial({
        color: 0xdc2626, // Classic red pantograph arms
        metalness: 0.5
      });

      // Base frame
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.4), pantoMat);
      pantoGroup.add(base);

      // Lower articulated arm
      const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), pantoMat);
      lowerArm.position.set(-0.25, 0.55, 0);
      lowerArm.rotation.z = 0.5;
      pantoGroup.add(lowerArm);

      // Upper articulated arm
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3), pantoMat);
      upperArm.position.set(0.1, 1.25, 0);
      upperArm.rotation.z = -0.6;
      pantoGroup.add(upperArm);

      // Collector contact shoe (touches contact wire at Y = 5.6)
      const shoeMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 1.8), shoeMat);
      shoe.position.set(0.35, 1.7, 0);
      pantoGroup.add(shoe);

      parent.add(pantoGroup);
    }
  }

  createBogie(parent, posX) {
    // 2-axle train bogie (转向架)
    const bogieMat = ToonMaterialFactory.getToonMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.6
    });

    const wheelMat = ToonMaterialFactory.getToonMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.3
    });

    const bogieGroup = new THREE.Group();
    bogieGroup.position.set(posX, 0.45, 0);

    // Bogie frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.2), bogieMat);
    bogieGroup.add(frame);

    // 4 Wheels (2 axles)
    [-1.0, 1.0].forEach(axleX => {
      [-1.0, 1.0].forEach(sideZ => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16),
          wheelMat
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(axleX, 0.1, sideZ * 0.95);
        bogieGroup.add(wheel);
      });
    });

    parent.add(bogieGroup);
  }

  createCoupler() {
    // Diaphragm gangway accordion cover between Car 1 & Car 2
    const gangwayMat = ToonMaterialFactory.getToonMaterial({
      color: 0x334155,
      roughness: 0.9
    });

    const gangway = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.8, 2.2),
      gangwayMat
    );
    gangway.position.set(0, 2.2, 0);
    this.group.add(gangway);
  }

  toggleDoors() {
    this.doorsOpen = !this.doorsOpen;
    const targetOffset = this.doorsOpen ? 0.95 : 0.38;

    this.doorMeshes.forEach(d => {
      d.leafL.position.x = d.baseDx - targetOffset;
      d.leafR.position.x = d.baseDx + targetOffset;
    });
    return this.doorsOpen;
  }

  update(delta) {
    this.swayTime += delta * 1.5;
    // Gentle anime train idle suspension breathing / vibration
    this.group.position.y = Math.sin(this.swayTime) * 0.015;
    this.group.rotation.z = Math.cos(this.swayTime * 0.7) * 0.0015;
  }
}
