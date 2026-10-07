/**
 * crossing.js - Japanese Railroad Level Crossing (踏切 / Fumikiri)
 * Alternating flashing red warning lights, yellow-black diagonal boom barriers,
 * crossbuck "踏切注意" sign, rubber crossing pads, and waiting student bicycle.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getCrossingStripeTexture } from './textures.js';

export class Crossing {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.enableBlink = true;
    this.blinkingLamps = [];

    this.initCrossingPads();
    this.initCrossingBarriers();
    this.initWaitingElements();

    this.scene.add(this.group);
  }

  initCrossingPads() {
    // Heavy rubber / concrete pads embedded flush with the rails across the roadway
    const padMat = new THREE.MeshToonMaterial({
      color: 0x27272a,
      roughness: 0.9
    });

    const pad = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 10.5), padMat);
    pad.position.set(2.0, 0.42, -25.4);
    pad.receiveShadow = true;
    this.group.add(pad);

    // White painted pedestrian / vehicle STOP line before the crossing
    const stopLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stopLine = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.02, 0.4), stopLineMat);
    stopLine.position.set(2.0, 0.04, -18.8);
    this.group.add(stopLine);
  }

  initCrossingBarriers() {
    // 2 Crossing Warning Masts: South side (z = -19.2) and North side (z = -31.6)
    const southCrossing = this.createCrossingMast(false);
    southCrossing.position.set(-2.5, 0, -19.2);
    this.group.add(southCrossing);

    const northCrossing = this.createCrossingMast(true);
    northCrossing.position.set(6.5, 0, -31.6);
    northCrossing.rotation.y = Math.PI;
    this.group.add(northCrossing);
  }

  createCrossingMast(isNorth) {
    const mastGroup = new THREE.Group();

    // 1. Steel Mast Pole with Yellow-Black Base Wrapping
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.8),
      materials.catenarySteel
    );
    pole.position.y = 2.4;
    mastGroup.add(pole);

    // Base Hazard Stripes
    const stripeTex = getCrossingStripeTexture();
    const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTex });
    const baseStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.6, 16),
      stripeMat
    );
    baseStripe.position.y = 0.8;
    mastGroup.add(baseStripe);

    // 2. Crossbuck Sign (✕ 踏切警戒标)
    const crossGroup = new THREE.Group();
    crossGroup.position.set(0, 4.3, 0);

    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.04), stripeMat);
    arm1.rotation.z = Math.PI / 4;
    crossGroup.add(arm1);

    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.04), stripeMat);
    arm2.rotation.z = -Math.PI / 4;
    crossGroup.add(arm2);

    mastGroup.add(crossGroup);

    // 3. Dual Alternating Flashing Red LED Warning Lamps
    const lampY = 3.6;
    const lampBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), materials.catenarySteel);
    lampBeam.position.set(0, lampY, 0.1);
    mastGroup.add(lampBeam);

    // Left and Right Red Warning Lamps
    const lampMatL = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const lampMatR = new THREE.MeshBasicMaterial({ color: 0x450a0a }); // Initially dimmed

    const lampGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    lampGeo.rotateX(Math.PI / 2);

    const lampL = new THREE.Mesh(lampGeo, lampMatL);
    lampL.position.set(-0.45, lampY, 0.15);
    mastGroup.add(lampL);

    const lampR = new THREE.Mesh(lampGeo, lampMatR);
    lampR.position.set(0.45, lampY, 0.15);
    mastGroup.add(lampR);

    // Register lamps for alternating blink animation
    this.blinkingLamps.push({ left: lampL, right: lampR });

    // 4. Overhead Alarm Bell Gong (警报器)
    const bellGong = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.catenarySteel
    );
    bellGong.position.set(0, 4.75, 0);
    mastGroup.add(bellGong);

    // 5. Barrier Boom Arm (遮断桿 - Yellow & Black stripes)
    const armGroup = new THREE.Group();
    armGroup.position.set(0, 1.1, 0.2);

    const pivotBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), materials.crossingArmBlack);
    armGroup.add(pivotBox);

    const boomArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 6.2, 12),
      stripeMat
    );
    boomArm.rotation.z = Math.PI / 2;
    boomArm.position.set(3.1, 0, 0);
    armGroup.add(boomArm);

    // Hanging warning fringe curtain along boom
    for (let bx = 0.8; bx < 5.8; bx += 0.45) {
      const fringe = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.45, 0.02),
        materials.crossingArmYellow
      );
      fringe.position.set(bx, -0.25, 0);
      armGroup.add(fringe);
    }

    // Lowered state
    armGroup.rotation.z = -0.06;
    mastGroup.add(armGroup);

    return mastGroup;
  }

  initWaitingElements() {
    // A Japanese Commuter Bicycle (Mamachari) parked waiting by the crossing gate
    const bike = this.createMamachari();
    bike.position.set(-1.2, 0.05, -17.5);
    bike.rotation.y = 0.2;
    this.group.add(bike);

    // Waiting Student / Pedestrian Silhouette Figure
    const figure = this.createAnimeFigure();
    figure.position.set(-1.8, 0, -17.3);
    figure.rotation.y = 0.3;
    this.group.add(figure);
  }

  createMamachari() {
    const bike = new THREE.Group();
    const frameMat = materials.trainStripePink;
    const metalMat = materials.catenarySteel;

    // Wheels (Front & Rear)
    const wheelGeo = new THREE.TorusGeometry(0.35, 0.02, 8, 24);
    const wheelR = new THREE.Mesh(wheelGeo, metalMat);
    wheelR.position.set(-0.6, 0.35, 0);
    bike.add(wheelR);

    const wheelF = new THREE.Mesh(wheelGeo, metalMat);
    wheelF.position.set(0.6, 0.35, 0);
    bike.add(wheelF);

    // Step-through Frame
    const frameTube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8), frameMat);
    frameTube.rotation.z = 0.6;
    frameTube.position.set(-0.1, 0.45, 0);
    bike.add(frameTube);

    // Handlebar & Wire Basket
    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.48), metalMat);
    handlebar.position.set(0.48, 0.85, 0);
    bike.add(handlebar);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.32), materials.concreteDark);
    basket.position.set(0.62, 0.72, 0);
    bike.add(basket);

    // School Bag inside front basket
    const schoolBag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.26), materials.woodDark);
    schoolBag.position.set(0.62, 0.76, 0);
    bike.add(schoolBag);

    // Saddle Seat
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.16), materials.crossingArmBlack);
    saddle.position.set(-0.35, 0.76, 0);
    bike.add(saddle);

    return bike;
  }

  createAnimeFigure() {
    const group = new THREE.Group();

    // Sailor suit / student silhouette
    const skirtMat = materials.roofTileDarkBlue;
    const blouseMat = materials.wallStuccoWhite;
    const skinMat = new THREE.MeshToonMaterial({ color: 0xffebd7 });
    const hairMat = materials.woodDark;

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.7), skirtMat);
    legL.position.set(-0.08, 0.35, 0);
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.7), skirtMat);
    legR.position.set(0.08, 0.35, 0);
    group.add(legR);

    // Pleated Skirt
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 8), skirtMat);
    skirt.position.set(0, 0.85, 0);
    group.add(skirt);

    // Blouse Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.2), blouseMat);
    torso.position.set(0, 1.15, 0);
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), skinMat);
    head.position.set(0, 1.48, 0);
    group.add(head);

    // Anime Hair with Ponytail
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), hairMat);
    hair.position.set(0, 1.52, -0.02);
    group.add(hair);

    const ponytail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), hairMat);
    ponytail.position.set(0, 1.42, -0.16);
    ponytail.rotation.x = -0.4;
    group.add(ponytail);

    return group;
  }

  update(time) {
    if (!this.enableBlink) return;

    // Alternating red warning lamp blink (1.2 Hz classic Japanese railway timing)
    const isLeftLit = (Math.floor(time * 2.4) % 2 === 0);
    const litColor = 0xff1744;
    const dimColor = 0x450a0a;

    this.blinkingLamps.forEach(lampPair => {
      lampPair.left.material.color.setHex(isLeftLit ? litColor : dimColor);
      lampPair.right.material.color.setHex(isLeftLit ? dimColor : litColor);
    });
  }
}
