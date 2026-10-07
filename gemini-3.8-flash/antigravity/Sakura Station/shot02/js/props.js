/**
 * props.js - Japanese Utility Poles, Overhead Wires, Plaza Amenities & Anime Life Details
 * Utility poles (电柱), transformers, sagging cables, red cylindrical postbox (丸型ポスト),
 * public phone booth, bus stop, parked bicycles, sleeping cat, sparrows on wires, traffic cones.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getCrossingStripeTexture } from './textures.js';

export class Props {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.initUtilityPolesAndWires();
    this.initPlazaAmenities();
    this.initLifeDetails();

    this.scene.add(this.group);
  }

  // -------------------------------------------------------------
  // 1. Japanese Utility Poles & Overhead Cable Network (电柱与空中线路)
  // -------------------------------------------------------------
  initUtilityPolesAndWires() {
    const polePositions = [
      { x: -5.2, z: 32, hasTransformer: true, hasLamp: true },
      { x: -5.0, z: 12, hasTransformer: false, hasLamp: true },
      { x: -4.8, z: -8, hasTransformer: true, hasLamp: false },
      { x: 5.5, z: 28, hasTransformer: false, hasLamp: true },
      { x: 5.2, z: 8, hasTransformer: true, hasLamp: true },
      { x: 5.0, z: -12, hasTransformer: false, hasLamp: false }
    ];

    const poleTops = [];

    polePositions.forEach(p => {
      const poleGroup = new THREE.Group();
      const h = 10.5;

      // Concrete Pole Body
      const pole = createOutlinedMesh(
        new THREE.CylinderGeometry(0.16, 0.22, h, 12),
        materials.utilityPoleGray,
        0.025
      );
      pole.position.y = h / 2;
      poleGroup.add(pole);

      // Yellow-black hazard sleeve at bottom
      const stripeTex = getCrossingStripeTexture();
      const hazardSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 1.8, 12),
        new THREE.MeshBasicMaterial({ map: stripeTex })
      );
      hazardSleeve.position.y = 1.0;
      poleGroup.add(hazardSleeve);

      // Metal Climbing Foot Pegs (Step rungs)
      const rungMat = materials.catenarySteel;
      for (let y = 2.2; y < h - 1.5; y += 0.8) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.03), rungMat);
        const side = (Math.floor(y / 0.8) % 2 === 0) ? 0.22 : -0.22;
        rung.position.set(side, y, 0);
        poleGroup.add(rung);
      }

      // Crossbars (横木) for insulators
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.8), rungMat);
      crossbar.position.set(0, h - 0.8, 0);
      poleGroup.add(crossbar);

      // Porcelain Insulators on crossbar
      for (let iz of [-0.7, 0, 0.7]) {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8), materials.wallStuccoWhite);
        ins.position.set(0, h - 0.65, iz);
        poleGroup.add(ins);
      }

      // Heavy Transformer (变压器)
      if (p.hasTransformer) {
        const trans = createOutlinedMesh(
          new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12),
          materials.concreteDark,
          0.02
        );
        trans.position.set(0.35, h - 2.4, 0.2);
        poleGroup.add(trans);
      }

      // Street Lamp attached to pole
      if (p.hasLamp) {
        const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), rungMat);
        lampArm.rotation.z = -0.55;
        lampArm.position.set(0.5, h - 3.8, 0);
        poleGroup.add(lampArm);

        // Lamp Shade & Bulb
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.15, 12), materials.wallStuccoWhite);
        shade.position.set(1.0, h - 4.2, 0);
        poleGroup.add(shade);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfffae0 }));
        bulb.position.set(1.0, h - 4.3, 0);
        poleGroup.add(bulb);
      }

      poleGroup.position.set(p.x, 0.1, p.z);
      this.group.add(poleGroup);

      poleTops.push({ x: p.x, y: h - 0.65, z: p.z });
    });

    // Connect Overhead Sagging Wires between poles
    const wireMat = new THREE.LineBasicMaterial({ color: 0x272e38, linewidth: 1.5 });

    // Connect poles along Left Side
    for (let i = 0; i < 2; i++) {
      this.createSaggingWire(poleTops[i], poleTops[i + 1], wireMat, 0.35);
    }
    // Connect poles along Right Side
    for (let i = 3; i < 5; i++) {
      this.createSaggingWire(poleTops[i], poleTops[i + 1], wireMat, 0.35);
    }
    // Diagonal Criss-cross wires across the street (iconic Japanese anime aesthetic)
    this.createSaggingWire(poleTops[0], poleTops[3], wireMat, 0.55);
    this.createSaggingWire(poleTops[1], poleTops[4], wireMat, 0.5);
    this.createSaggingWire(poleTops[2], poleTops[5], wireMat, 0.6);

    // Sparrow perched on the street wire!
    this.createSparrow(-0.2, 8.8, 10.0);
  }

  createSaggingWire(ptA, ptB, material, sagAmount) {
    const points = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(ptA.x, ptB.x, t);
      const z = THREE.MathUtils.lerp(ptA.z, ptB.z, t);
      // Parabolic sag
      const sag = Math.sin(t * Math.PI) * sagAmount;
      const y = THREE.MathUtils.lerp(ptA.y, ptB.y, t) - sag;
      points.push(new THREE.Vector3(x, y, z));
    }
    const wireGeo = new THREE.BufferGeometry().setFromPoints(points);
    const wire = new THREE.Line(wireGeo, material);
    this.group.add(wire);
  }

  createSparrow(x, y, z) {
    const sGroup = new THREE.Group();
    const bodyMat = materials.woodWarm;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bodyMat);
    body.scale.set(1, 0.8, 1.4);
    sGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), materials.woodDark);
    head.position.set(0, 0.04, 0.07);
    sGroup.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 4), materials.crossingArmYellow);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.04, 0.11);
    sGroup.add(beak);

    sGroup.position.set(x, y, z);
    this.group.add(sGroup);
  }

  // -------------------------------------------------------------
  // 2. Station Plaza Amenities (Postbox, Phonebooth, Bus stop, Bicycles)
  // -------------------------------------------------------------
  initPlazaAmenities() {
    // 1. Vintage Cylindrical Red Post Box (丸型ポスト 〒)
    const postGroup = new THREE.Group();
    const redMat = materials.postboxRed;

    // Pillar body
    const postBody = createOutlinedMesh(
      new THREE.CylinderGeometry(0.32, 0.34, 1.35, 16),
      redMat,
      0.02
    );
    postBody.position.y = 0.675;
    postGroup.add(postBody);

    // Domed cap
    const postDome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), redMat);
    postDome.position.y = 1.35;
    postGroup.add(postDome);

    // Mail slot & "〒" symbol
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.08), materials.crossingArmBlack);
    slot.position.set(0, 1.05, 0.32);
    postGroup.add(slot);

    postGroup.position.set(4.2, 0.18, -3.2);
    this.group.add(postGroup);

    // 2. Retro Green Glass Public Telephone Booth (公衆電話)
    const phoneGroup = new THREE.Group();
    const boothMat = materials.phoneBoothGreen;

    const frame = createOutlinedMesh(
      new THREE.BoxGeometry(1.0, 2.3, 1.0),
      boothMat,
      0.02
    );
    frame.position.y = 1.15;
    phoneGroup.add(frame);

    // Glass walls
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 1.9, 0.92),
      materials.animeGlass
    );
    glass.position.y = 1.15;
    phoneGroup.add(glass);

    // Illuminated Green Phone unit inside
    const phoneUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.32, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    phoneUnit.position.set(0, 1.2, 0);
    phoneGroup.add(phoneUnit);

    phoneGroup.position.set(6.2, 0.18, -3.2);
    this.group.add(phoneGroup);

    // 3. Bus Stop Signpost (バス停留所)
    const busSign = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2), materials.concreteLight);
    pole.position.y = 1.1;
    busSign.add(pole);

    const roundSign = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), materials.wallStuccoWhite);
    roundSign.rotation.x = Math.PI / 2;
    roundSign.position.set(0, 2.05, 0);
    busSign.add(roundSign);

    const busTimetable = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.02), materials.wallStuccoCream);
    busTimetable.position.set(0, 1.25, 0);
    busSign.add(busTimetable);

    busSign.position.set(2.8, 0.18, -1.2);
    this.group.add(busSign);

    // 4. Bicycle Parking Rack with 3 Commuter Bicycles
    const rack = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 0.8), materials.catenarySteel);
    rack.position.set(14.5, 0.3, -4.5);
    this.group.add(rack);

    const bikeColors = [materials.trainStripePink, materials.trainStripeBlue, materials.wallStuccoWhite];
    for (let i = 0; i < 3; i++) {
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 1.4), bikeColors[i]);
      bMesh.position.set(13.6 + i * 0.9, 0.58, -4.5);
      this.group.add(bMesh);
    }
  }

  // -------------------------------------------------------------
  // 3. Anime Life Details (Cat, Cones, Extinguisher, Boxes)
  // -------------------------------------------------------------
  initLifeDetails() {
    // 1. Sleeping Calico Cat on Residential Wall
    const catGroup = new THREE.Group();
    const catMat = materials.wallStuccoCream;

    // Cat Body (curled up sleeping)
    const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), catMat);
    catBody.scale.set(1.4, 0.8, 1.0);
    catGroup.add(catBody);

    // Cat Head
    const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), catMat);
    catHead.position.set(0.16, 0.05, 0);
    catGroup.add(catHead);

    // Cute Ears
    for (let ez of [-0.05, 0.05]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4), materials.woodWarm);
      ear.position.set(0.18, 0.13, ez);
      catGroup.add(ear);
    }

    // Cat Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), materials.woodWarm);
    tail.rotation.z = Math.PI / 3;
    tail.position.set(-0.2, 0, 0);
    catGroup.add(tail);

    // Place cat atop garden wall at House A (x: -12.5, y: 1.15, z: 19.8)
    catGroup.position.set(-8.1, 1.25, 18.5);
    catGroup.rotation.y = 0.5;
    this.group.add(catGroup);

    // 2. Japanese Traffic Cones (三角コーン)
    for (let cz of [14.0, 15.0]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 12), materials.trafficConeOrange);
      cone.position.set(-4.2, 0.325, cz);
      this.group.add(cone);
    }

    // 3. Red Fire Extinguisher Box ("消火器")
    const extBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 0.25), materials.postboxRed);
    extBox.position.set(-7.5, 0.45, 30.5);
    this.group.add(extBox);

    // 4. Cardboard Delivery Boxes outside Wagashi shop
    const boxMat = materials.woodWarm;
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), boxMat);
    box1.position.set(-7.8, 0.3, 38.0);
    this.group.add(box1);

    const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.45), boxMat);
    box2.position.set(-7.8, 0.68, 38.0);
    this.group.add(box2);
  }
}
