/**
 * train.js - Japanese Suburban Commuter EMU Train (Series 1000 - 2 Cars)
 * Cream-white body, sakura pink & sky blue stripes, curved cab, illuminated headlights,
 * destination LED, rooftop pantograph & AC units, open passenger doors at platform,
 * undercarriage bogies, passenger silhouettes, and gentle idling animation.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getTrainTexture } from './textures.js';

export class Train {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.enableAnimation = true;

    // Build 2-Car Commuter Train
    this.carLength = 19.5;
    this.carWidth = 2.9;
    this.carHeight = 3.4;

    this.car1 = this.createLeadCar(1);
    this.car1.position.x = -10.5;
    this.group.add(this.car1);

    this.car2 = this.createCoachCar(2);
    this.car2.position.x = 9.5;
    this.group.add(this.car2);

    // Place train on Track 1 (z = -23.2, standing at platform)
    this.group.position.set(0, 0.45, -23.2);
    this.scene.add(this.group);
  }

  createLeadCar(carNumber) {
    const carGroup = new THREE.Group();

    // 1. Car Body (Cream White Anime Stucco/Paint)
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(this.carLength, this.carHeight, this.carWidth),
      materials.trainBodyCream,
      0.03
    );
    body.position.y = this.carHeight / 2 + 0.65;
    carGroup.add(body);

    // 2. Sakura Pink & Sky Blue Horizontal Stripes
    const pinkStripe = new THREE.Mesh(
      new THREE.BoxGeometry(this.carLength + 0.04, 0.28, this.carWidth + 0.04),
      materials.trainStripePink
    );
    pinkStripe.position.y = 1.35;
    carGroup.add(pinkStripe);

    const blueStripe = new THREE.Mesh(
      new THREE.BoxGeometry(this.carLength + 0.04, 0.1, this.carWidth + 0.04),
      materials.trainStripeBlue
    );
    blueStripe.position.y = 1.12;
    carGroup.add(blueStripe);

    // 3. Rounded Aero Cab Nose (Front of Lead Car at -X end)
    const noseGeo = new THREE.CylinderGeometry(
      this.carWidth / 2,
      this.carWidth / 2,
      this.carHeight,
      16,
      1,
      false,
      -Math.PI / 2,
      Math.PI
    );
    const nose = createOutlinedMesh(noseGeo, materials.trainBodyCream, 0.03);
    nose.position.set(-this.carLength / 2, this.carHeight / 2 + 0.65, 0);
    carGroup.add(nose);

    // Front Windshield with subtle anime cyan tint
    const frontGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 1.3),
      materials.animeGlass
    );
    frontGlass.rotation.y = -Math.PI / 2;
    frontGlass.position.set(-this.carLength / 2 - 1.46, 2.5, 0);
    carGroup.add(frontGlass);

    // Heavy-duty Windshield Wiper
    const wiper = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.6, 0.02),
      materials.crossingArmBlack
    );
    wiper.rotation.z = 0.35;
    wiper.position.set(-this.carLength / 2 - 1.48, 2.2, 0.3);
    carGroup.add(wiper);

    // LED Destination Sign ("普通 桜ヶ丘")
    const destTex = getTrainTexture('destination');
    const destMat = new THREE.MeshBasicMaterial({ map: destTex });
    const destSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), destMat);
    destSign.rotation.y = -Math.PI / 2;
    destSign.position.set(-this.carLength / 2 - 1.47, 3.4, 0);
    carGroup.add(destSign);

    // Dual Warm Glowing Headlights
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    [-0.75, 0.75].forEach(zOffset => {
      const lampHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16),
        materials.catenarySteel
      );
      lampHousing.rotation.z = Math.PI / 2;
      lampHousing.position.set(-this.carLength / 2 - 1.47, 1.4, zOffset);
      carGroup.add(lampHousing);

      const lampLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 16),
        lightGlowMat
      );
      lampLens.rotation.y = -Math.PI / 2;
      lampLens.position.set(-this.carLength / 2 - 1.52, 1.4, zOffset);
      carGroup.add(lampLens);
    });

    // 4. Passenger Windows with Interior Silhouette
    this.addPassengerWindows(carGroup);

    // 5. Open Passenger Doors Facing Platform (Platform is at +Z side: z = -20.2)
    this.addOpenDoors(carGroup);

    // 6. Rooftop Pantograph & AC Pods
    this.addRoofEquipment(carGroup, true);

    // 7. Undercarriage Bogies & Wheels
    this.addBogies(carGroup);

    return carGroup;
  }

  createCoachCar(carNumber) {
    const carGroup = new THREE.Group();

    // Body
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(this.carLength, this.carHeight, this.carWidth),
      materials.trainBodyCream,
      0.03
    );
    body.position.y = this.carHeight / 2 + 0.65;
    carGroup.add(body);

    // Stripes
    const pinkStripe = new THREE.Mesh(
      new THREE.BoxGeometry(this.carLength + 0.04, 0.28, this.carWidth + 0.04),
      materials.trainStripePink
    );
    pinkStripe.position.y = 1.35;
    carGroup.add(pinkStripe);

    const blueStripe = new THREE.Mesh(
      new THREE.BoxGeometry(this.carLength + 0.04, 0.1, this.carWidth + 0.04),
      materials.trainStripeBlue
    );
    blueStripe.position.y = 1.12;
    carGroup.add(blueStripe);

    // Windows & Doors
    this.addPassengerWindows(carGroup);
    this.addOpenDoors(carGroup);

    // Roof AC pods (no pantograph on 2nd car)
    this.addRoofEquipment(carGroup, false);

    // Undercarriage Bogies
    this.addBogies(carGroup);

    // Red Tail Marker Lamps at the rear (+X end)
    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    [-0.8, 0.8].forEach(zOffset => {
      const tailLight = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), redGlowMat);
      tailLight.rotation.y = Math.PI / 2;
      tailLight.position.set(this.carLength / 2 + 0.02, 1.4, zOffset);
      carGroup.add(tailLight);
    });

    return carGroup;
  }

  addPassengerWindows(parent) {
    const silTex = getTrainTexture('interior_silhouette');
    const winMat = new THREE.MeshBasicMaterial({ map: silTex });

    const winSpacing = 4.2;
    for (let x = -6.5; x <= 6.5; x += winSpacing) {
      // Windows on both sides
      const winSouth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), winMat);
      winSouth.position.set(x, 2.3, this.carWidth / 2 + 0.02);
      parent.add(winSouth);

      const winNorth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), winMat);
      winNorth.rotation.y = Math.PI;
      winNorth.position.set(x, 2.3, -this.carWidth / 2 - 0.02);
      parent.add(winNorth);
    }
  }

  addOpenDoors(parent) {
    // Open passenger sliding doors on platform side (+Z)
    const doorMat = materials.trainBodyCream;
    const doorOpeningMat = new THREE.MeshBasicMaterial({ color: 0xfffaed }); // Warm interior light

    const doorPositions = [-4.2, 4.2];
    doorPositions.forEach(x => {
      // Door opening gap
      const doorway = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), doorOpeningMat);
      doorway.position.set(x, 1.8, this.carWidth / 2 + 0.01);
      parent.add(doorway);

      // Left slid open leaf
      const leafL = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.1, 0.05), doorMat);
      leafL.position.set(x - 0.9, 1.8, this.carWidth / 2 + 0.03);
      parent.add(leafL);

      // Right slid open leaf
      const leafR = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.1, 0.05), doorMat);
      leafR.position.set(x + 0.9, 1.8, this.carWidth / 2 + 0.03);
      parent.add(leafR);

      // Yellow safety threshold line on car floor
      const threshold = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.04, 0.1),
        materials.crossingArmYellow
      );
      threshold.position.set(x, 0.72, this.carWidth / 2 + 0.02);
      parent.add(threshold);
    });
  }

  addRoofEquipment(parent, hasPantograph) {
    const roofY = this.carHeight + 0.65;

    // Rooftop AC Pods (Large dual air conditioners)
    for (let x of [-4.5, 4.5]) {
      const acUnit = createOutlinedMesh(
        new THREE.BoxGeometry(3.2, 0.45, 1.6),
        materials.trainRoofGray,
        0.02
      );
      acUnit.position.set(x, roofY + 0.25, 0);
      parent.add(acUnit);
    }

    // Diamond Pantograph (受电弓)
    if (hasPantograph) {
      const pantoGroup = new THREE.Group();

      // Base mount
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.4), materials.catenarySteel);
      pantoGroup.add(base);

      // Diamond scissor arms
      const armMat = materials.catenarySteel;
      const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1), armMat);
      lowerArm.position.set(-0.35, 0.5, 0);
      lowerArm.rotation.z = -0.55;
      pantoGroup.add(lowerArm);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1), armMat);
      upperArm.position.set(0.15, 1.25, 0);
      upperArm.rotation.z = 0.55;
      pantoGroup.add(upperArm);

      // Contact shoe / collector horn (touching catenary overhead wire)
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.0), materials.catenarySteel);
      shoe.position.set(0.4, 1.7, 0);
      pantoGroup.add(shoe);

      pantoGroup.position.set(-7.5, roofY, 0);
      parent.add(pantoGroup);
    }
  }

  addBogies(parent) {
    // 2 Bogie trucks per car (-6.0m and +6.0m)
    for (let bx of [-6.0, 6.0]) {
      const bogie = new THREE.Group();

      // Bogie frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.25, 2.2),
        materials.trainUnderframe
      );
      frame.position.y = 0.35;
      bogie.add(frame);

      // 4 Steel Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
      wheelGeo.rotateX(Math.PI / 2);

      for (let wx of [-0.85, 0.85]) {
        for (let wz of [-1.0, 1.0]) {
          const wheel = new THREE.Mesh(wheelGeo, materials.railSteel);
          wheel.position.set(wx, 0.38, wz);
          bogie.add(wheel);
        }
      }

      bogie.position.set(bx, 0, 0);
      parent.add(bogie);
    }
  }

  update(time) {
    if (!this.enableAnimation) return;
    // Gentle idling breathing / micro vibration
    const sway = Math.sin(time * 3.0) * 0.003;
    const pitch = Math.cos(time * 2.2) * 0.002;
    this.car1.position.y = sway;
    this.car1.rotation.z = pitch;
    this.car2.position.y = sway * 0.8;
  }
}
