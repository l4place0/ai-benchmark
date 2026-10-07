import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';

// Station Front Plaza: Paved Courtyard, Ancient Sakura Tree, Retro Postbox, Phone Booth & Bikes
export class StationPlaza {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'station_plaza';

    this.init();
  }

  init() {
    this.createPlazaPaving();
    this.createPlazaCenterTreeBench();
    this.createRedPostbox();
    this.createPhoneBooth();
    this.createBicycleParking();
    this.createFlowerbeds();
    this.createBusStopSign();

    this.scene.add(this.group);
  }

  createPlazaPaving() {
    // Plaza courtyard paving (X = -15 to 2, Z = 1 to 14)
    const paveMat = ToonMaterialFactory.getToonMaterial({
      color: 0xd9dfe8, // Anime pale stone paving
      roughness: 0.8
    });

    const paveGeo = new THREE.BoxGeometry(17, 0.15, 13);
    const paving = new THREE.Mesh(paveGeo, paveMat);
    paving.position.set(-6.5, 0.075, 7.5);
    paving.receiveShadow = true;
    this.group.add(paving);

    // Subtle stone paver grid divisions
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    for (let x = -14; x <= 1; x += 2.5) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 13), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.155, 7.5);
      this.group.add(line);
    }
  }

  createPlazaCenterTreeBench() {
    // Octagonal wooden bench encircling the landmark plaza sakura tree
    const benchGroup = new THREE.Group();
    benchGroup.position.set(-13.5, 0.15, 8.5);

    const woodMat = ToonMaterialFactory.getToonMaterial({ color: 0x78350f, roughness: 0.7 });
    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x334155 });

    // Raised stone tree planter ring
    const ringMat = ToonMaterialFactory.getToonMaterial({ color: 0x94a3b8 });
    const planterRing = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.8, 0.35, 16),
      ringMat
    );
    planterRing.position.y = 0.17;
    benchGroup.add(planterRing);

    // Soil inside ring
    const soilMat = ToonMaterialFactory.getToonMaterial({ color: 0x451a03 });
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16),
      soilMat
    );
    soil.position.y = 0.35;
    benchGroup.add(soil);

    // 8 Wooden seat sections surrounding the tree
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), woodMat);
      seat.position.set(Math.cos(angle) * 2.2, 0.45, Math.sin(angle) * 2.2);
      seat.rotation.y = -angle + Math.PI / 2;
      seat.castShadow = true;
      benchGroup.add(seat);
    }

    // Story detail: Forgotten student schoolbag & soda can on bench
    const bagMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e3a8a }); // Navy student bag
    const schoolbag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.25), bagMat);
    schoolbag.position.set(2.2, 0.6, 0);
    schoolbag.rotation.y = 0.3;
    benchGroup.add(schoolbag);

    // Soda can
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12),
      ToonMaterialFactory.getToonMaterial({ color: 0xf472b6 })
    );
    can.position.set(2.0, 0.55, 0.3);
    benchGroup.add(can);

    this.group.add(benchGroup);
  }

  createRedPostbox() {
    // Classic Japanese Vermilion Red Cylindrical Postbox (〒 郵便差出箱)
    const postGroup = new THREE.Group();
    postGroup.position.set(-1.8, 0.15, 4.2);

    const redMat = ToonMaterialFactory.getToonMaterial({ color: 0xdc2626 });
    const capMat = ToonMaterialFactory.getToonMaterial({ color: 0xb91c1c });

    // Round pedestal base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.15, 16), redMat);
    base.position.y = 0.075;
    postGroup.add(base);

    // Main red cylinder pillar
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 16), redMat);
    body.position.y = 0.7;
    body.castShadow = true;
    postGroup.add(body);

    // Domed rounded cap
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 1.25;
    postGroup.add(cap);

    // Mail drop slot
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.06),
      ToonMaterialFactory.getToonMaterial({ color: 0x0f172a })
    );
    slot.position.set(0, 1.0, 0.31);
    postGroup.add(slot);

    // White Japanese Post Symbol (〒)
    const symbol = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    symbol.position.set(0, 0.75, 0.33);
    postGroup.add(symbol);

    this.group.add(postGroup);
  }

  createPhoneBooth() {
    // Nostalgic Dark Green NTT Public Telephone Booth (公用电话亭)
    const boothGroup = new THREE.Group();
    boothGroup.position.set(-1.8, 0.15, 8.5);

    const greenFrameMat = ToonMaterialFactory.getToonMaterial({ color: 0x065f46 });
    const glassMat = ToonMaterialFactory.getGlassMaterial({ opacity: 0.45, color: 0xa7f3d0 });

    // Corner vertical frame posts
    [-0.45, 0.45].forEach(x => {
      [-0.45, 0.45].forEach(z => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), greenFrameMat);
        post.position.set(x, 1.15, z);
        boothGroup.add(post);
      });
    });

    // Glass panel walls
    [-0.45, 0.45].forEach(x => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.0), glassMat);
      glass.rotation.y = Math.PI / 2;
      glass.position.set(x, 1.15, 0);
      boothGroup.add(glass);
    });

    // Rear glass
    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.0), glassMat);
    rearGlass.position.set(0, 1.15, -0.45);
    boothGroup.add(rearGlass);

    // Curved aluminum roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 1.0), greenFrameMat);
    roof.position.set(0, 2.35, 0);
    roof.castShadow = true;
    boothGroup.add(roof);

    // Interior green public payphone
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.4, 0.2),
      ToonMaterialFactory.getToonMaterial({ color: 0x10b981 })
    );
    phone.position.set(0, 1.15, -0.3);
    boothGroup.add(phone);

    // Warm glowing booth interior night light
    const boothLight = new THREE.PointLight(0xfef08a, 1.2, 3);
    boothLight.position.set(0, 2.1, 0);
    boothGroup.add(boothLight);

    this.group.add(boothGroup);
  }

  createBicycleParking() {
    // Bicycle Parking Area with commuter "Mamachari" bikes
    const bikeZone = new THREE.Group();
    bikeZone.position.set(-7.0, 0.15, 12.0);

    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x64748b });
    const wheelMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });

    // Parking rack rails
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 6.0), metalMat);
    rail.position.set(0, 0.2, 0);
    bikeZone.add(rail);

    // 4 Commuter Mamachari Bicycles
    const bikeColors = [0xdc2626, 0x2563eb, 0xf8fafc, 0x15803d]; // Red, Blue, White, Green

    bikeColors.forEach((col, idx) => {
      const bike = new THREE.Group();
      bike.position.set(0.6, 0, -2.2 + idx * 1.4);
      bike.rotation.y = (Math.random() - 0.5) * 0.15;

      const frameMat = ToonMaterialFactory.getToonMaterial({ color: col });

      // Front & Rear Wheels
      [-0.6, 0.6].forEach(wx => {
        const wheel = new THREE.Mesh(
          new THREE.TorusGeometry(0.3, 0.03, 8, 16),
          wheelMat
        );
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(wx, 0.3, 0);
        bike.add(wheel);
      });

      // Diagonal step-through frame tube
      const frameTube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9), frameMat);
      frameTube.rotation.z = -0.7;
      frameTube.position.set(-0.1, 0.45, 0);
      bike.add(frameTube);

      // Handlebars & Front Wire Basket
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.5), metalMat);
      handle.position.set(0.5, 0.85, 0);
      bike.add(handle);

      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.35), metalMat);
      basket.position.set(0.65, 0.72, 0);
      bike.add(basket);

      // Saddle Seat
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), wheelMat);
      saddle.position.set(-0.25, 0.7, 0);
      bike.add(saddle);

      bikeZone.add(bike);
    });

    this.group.add(bikeZone);
  }

  createFlowerbeds() {
    // Raised brick flowerbeds (红砖花坛) with blooming tulips & shrubs
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-13.0, 0.15, 12.0);

    const brickMat = ToonMaterialFactory.getToonMaterial({ color: 0x9a3412 });
    const soilMat = ToonMaterialFactory.getToonMaterial({ color: 0x3f2d21 });

    // Brick perimeter
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 1.8), brickMat);
    wall.position.y = 0.2;
    bedGroup.add(wall);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.5), soilMat);
    soil.position.y = 0.38;
    bedGroup.add(soil);

    // Multi-color blooming tulips (郁金香)
    const tulipColors = [0xef4444, 0xfacc15, 0xf472b6, 0xa855f7];
    for (let i = 0; i < 18; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.35),
        new THREE.MeshBasicMaterial({ color: 0x16a34a })
      );
      const px = -1.8 + Math.random() * 3.6;
      const pz = -0.5 + Math.random() * 1.0;
      stem.position.set(px, 0.55, pz);
      bedGroup.add(stem);

      const blossom = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.16, 6),
        new THREE.MeshBasicMaterial({ color: tulipColors[i % tulipColors.length] })
      );
      blossom.rotation.x = Math.PI;
      blossom.position.set(px, 0.75, pz);
      bedGroup.add(blossom);
    }

    this.group.add(bedGroup);
  }

  createBusStopSign() {
    // Bus stop signpost ("桜ヶ丘駅前 路線バス")
    const signGroup = new THREE.Group();
    signGroup.position.set(1.5, 0.15, 11.5);

    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x475569 });

    // Steel pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), metalMat);
    pole.position.y = 1.1;
    signGroup.add(pole);

    // Circular header sign
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 2.1, 0);
    signGroup.add(disc);

    // Rectangular timetable board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    board.position.set(0, 1.4, 0);
    signGroup.add(board);

    this.group.add(signGroup);
  }
}
