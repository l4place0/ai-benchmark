import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';

// Japanese Suburban Anime Life Elements, Utility Poles, Overhead Wires, Animals & Figures
export class AnimeDetails {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'anime_details';

    this.init();
  }

  init() {
    this.createUtilityPolesAndWires();
    this.createTrafficMirrorsAndSigns();
    this.createAnimals();
    this.createAnimeFigures();
    this.createJizoShrine();
    this.createSmallTownProps();

    this.scene.add(this.group);
  }

  // --- 1. Japanese Concrete Utility Poles (电线杆) & Overhead Sagging Wires ---
  createUtilityPolesAndWires() {
    const poleMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8, // Weathered concrete gray
      roughness: 0.8
    });

    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x334155 });
    const transformerMat = ToonMaterialFactory.getToonMaterial({ color: 0x64748b });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x18181b });

    // Pole locations set back along sidewalks
    const poleLocations = [
      { x: 2.6, z: 18, hasTrans: true, hasLamp: true },
      { x: 2.6, z: 36, hasTrans: false, hasLamp: true },
      { x: 2.6, z: 54, hasTrans: true, hasLamp: false },
      { x: 15.2, z: 24, hasTrans: false, hasLamp: true },
      { x: 15.2, z: 46, hasTrans: true, hasLamp: true }
    ];

    const poleTops = [];

    poleLocations.forEach(p => {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(p.x, 0, p.z);

      // Main concrete tapered pole (Height = 10m)
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 10, 16),
        poleMat
      );
      pole.position.y = 5.0;
      pole.castShadow = true;
      poleGroup.add(pole);

      // Yellow/Black protective hazard sleeve at base
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 1.4, 16),
        ToonMaterialFactory.getToonMaterial({ color: 0xeab308 })
      );
      wrap.position.y = 0.7;
      poleGroup.add(wrap);

      // Horizontal metal crossarms (横担)
      const crossarm1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), metalMat);
      crossarm1.position.set(0, 9.2, 0);
      poleGroup.add(crossarm1);

      const crossarm2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), metalMat);
      crossarm2.position.set(0, 8.4, 0);
      poleGroup.add(crossarm2);

      // Ceramic pin insulators (瓷瓶)
      [-0.7, -0.3, 0.3, 0.7].forEach(ox => {
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8),
          ToonMaterialFactory.getToonMaterial({ color: 0xf8fafc })
        );
        ins.position.set(ox, 9.35, 0);
        poleGroup.add(ins);
      });

      // Pole-mounted Distribution Transformer (变压器)
      if (p.hasTrans) {
        const trans = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 1.1, 14),
          transformerMat
        );
        trans.position.set(0.38, 7.6, 0);
        trans.castShadow = true;
        poleGroup.add(trans);
      }

      // Street Lamp bracket & warm lantern
      if (p.hasLamp) {
        const lampArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.1),
          metalMat
        );
        lampArm.rotation.z = Math.PI / 4;
        lampArm.position.set(-0.4, 6.2, 0);
        poleGroup.add(lampArm);

        // Lamp head
        const lampHead = new THREE.Mesh(
          new THREE.ConeGeometry(0.25, 0.15, 12),
          metalMat
        );
        lampHead.position.set(-0.75, 6.5, 0);
        poleGroup.add(lampHead);

        // Warm light source
        const lampBulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          ToonMaterialFactory.getEmissiveMaterial(0xfef08a, 2.0)
        );
        lampBulb.position.set(-0.75, 6.4, 0);
        poleGroup.add(lampBulb);

        const pointLight = new THREE.PointLight(0xfef08a, 0.9, 10);
        pointLight.position.set(-0.75, 6.2, 0);
        poleGroup.add(pointLight);
      }

      poleTops.push(new THREE.Vector3(p.x, 9.2, p.z));
      this.group.add(poleGroup);
    });

    // Overhead Hanging Drooping Catenary Wires connecting poles & stretching across street
    for (let i = 0; i < poleTops.length - 1; i++) {
      const p1 = poleTops[i];
      const p2 = poleTops[i + 1];

      // Create natural sag curve
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y -= 0.65; // Droop / sag

      const wireCurve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const wireGeo = new THREE.TubeGeometry(wireCurve, 16, 0.012, 4, false);
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      this.group.add(wireMesh);

      // Second wire with different sag
      const mid2 = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid2.y -= 0.45;
      mid2.x += 0.2;
      const wireCurve2 = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(p1.x, p1.y - 0.7, p1.z),
        mid2,
        new THREE.Vector3(p2.x, p2.y - 0.7, p2.z)
      );
      const wireMesh2 = new THREE.Mesh(new THREE.TubeGeometry(wireCurve2, 16, 0.012, 4, false), wireMat);
      this.group.add(wireMesh2);
    }
  }

  // --- 2. Convex Traffic Safety Mirrors & Directional Signs ---
  createTrafficMirrorsAndSigns() {
    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x475569 });

    // Convex Traffic Mirror (弯道反光镜) at Street Corner (X = 4.2, Z = 14)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(4.2, 0, 14);

    // Orange pole
    const orangeMat = ToonMaterialFactory.getToonMaterial({ color: 0xea580c });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), orangeMat);
    pole.position.y = 1.6;
    mirrorGroup.add(pole);

    // Orange mirror housing
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.1, 20),
      orangeMat
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 3.1, 0);
    mirrorGroup.add(housing);

    // Convex reflective mirror surface
    const mirrorSurf = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 3),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        metalness: 0.9,
        roughness: 0.1
      })
    );
    mirrorSurf.rotation.x = Math.PI / 2;
    mirrorSurf.position.set(0, 3.1, 0.04);
    mirrorGroup.add(mirrorSurf);

    this.group.add(mirrorGroup);

    // 30 km/h Speed Limit Sign (Blue & Red ring)
    const speedGroup = new THREE.Group();
    speedGroup.position.set(13.6, 0, 18);

    const speedPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.8), metalMat);
    speedPole.position.y = 1.4;
    speedGroup.add(speedPole);

    const speedPlate = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    speedPlate.position.set(0, 2.7, 0.02);
    speedGroup.add(speedPlate);

    const redRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.35, 20),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    redRing.position.set(0, 2.7, 0.025);
    speedGroup.add(redRing);

    this.group.add(speedGroup);
  }

  // --- 3. Anime Animals (Calico Cat & Perched Sparrows) ---
  createAnimals() {
    // 1. Cute Calico Cat (三花猫) sitting on garden wall (X = 0.5, Y = 1.0, Z = 24)
    const catGroup = new THREE.Group();
    catGroup.position.set(0.5, 1.0, 24);

    const catBodyMat = ToonMaterialFactory.getToonMaterial({ color: 0xffffff }); // White base
    const catCalicoMat = ToonMaterialFactory.getToonMaterial({ color: 0xd97706 }); // Orange spot
    const catDarkMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b }); // Black spot

    // Cat Body (Sitting loaf posture)
    const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), catBodyMat);
    catBody.scale.set(1.4, 0.9, 1.0);
    catGroup.add(catBody);

    // Calico patch
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), catCalicoMat);
    patch.position.set(0.08, 0.08, 0.05);
    catGroup.add(patch);

    // Cat Head
    const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), catBodyMat);
    catHead.position.set(0.22, 0.12, 0);
    catGroup.add(catHead);

    // Ears
    [-0.05, 0.05].forEach(ez => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 4), catDarkMat);
      ear.position.set(0.24, 0.22, ez);
      catGroup.add(ear);
    });

    // Cat Tail curled along body
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2, 0, 0),
      new THREE.Vector3(-0.28, 0.05, 0.1),
      new THREE.Vector3(-0.22, 0.15, 0.18)
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.025, 6, false), catCalicoMat);
    catGroup.add(tail);

    this.group.add(catGroup);

    // 2. Sparrows (麻雀) perched in a row along overhead telephone wire
    const sparrowMat = ToonMaterialFactory.getToonMaterial({ color: 0x78350f });
    [-0.3, 0, 0.35].forEach((offset, idx) => {
      const sparrow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), sparrowMat);
      sparrow.position.set(5.2 + offset, 8.6, 26 + offset * 0.4);
      sparrow.scale.set(1.4, 0.9, 0.9);
      this.group.add(sparrow);
    });
  }

  // --- 4. Stylized Anime Figures (Schoolgirl with Bike, Commuter, Station Master) ---
  createAnimeFigures() {
    // 1. Schoolgirl in Sailor Uniform (水手服少女) standing with bicycle at Railway Crossing (X = 18.5, Z = -10.5)
    const girlGroup = new THREE.Group();
    girlGroup.position.set(18.5, 0.1, -10.5);

    const skinMat = ToonMaterialFactory.getToonMaterial({ color: 0xffedd5 });
    const hairMat = ToonMaterialFactory.getToonMaterial({ color: 0x451a03 }); // Chestnut anime brown hair
    const navyMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e3a8a }); // Navy sailor skirt
    const whiteMat = ToonMaterialFactory.getToonMaterial({ color: 0xffffff }); // White sailor top
    const redMat = ToonMaterialFactory.getToonMaterial({ color: 0xdc2626 }); // Red neckerchief

    // Legs
    [-0.08, 0.08].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65), skinMat);
      leg.position.set(lx, 0.32, 0);
      girlGroup.add(leg);
    });

    // Pleated Navy Skirt
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 12), navyMat);
    skirt.position.y = 0.78;
    girlGroup.add(skirt);

    // Sailor Top (White shirt)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.18), whiteMat);
    torso.position.y = 1.1;
    girlGroup.add(torso);

    // Red neckerchief tie
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), redMat);
    tie.position.set(0, 1.12, 0.1);
    girlGroup.add(tie);

    // Anime Head & Hair
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    head.position.y = 1.42;
    girlGroup.add(head);

    // Long anime twin-tails / hair blowing in spring breeze
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), hairMat);
    hair.position.set(0, 1.45, -0.02);
    girlGroup.add(hair);

    // Arms holding bicycle handlebars
    [-0.18, 0.18].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45), whiteMat);
      arm.rotation.x = -0.5;
      arm.position.set(ax, 1.0, 0.15);
      girlGroup.add(arm);
    });

    // School satchel / shoulder bag
    const bagMat = ToonMaterialFactory.getToonMaterial({ color: 0x78350f });
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.1), bagMat);
    satchel.position.set(-0.2, 0.9, -0.05);
    girlGroup.add(satchel);

    // Schoolgirl's Commuter Bicycle beside her
    const bikeGroup = new THREE.Group();
    bikeGroup.position.set(0.45, 0, 0.1);
    const bikeMetal = ToonMaterialFactory.getToonMaterial({ color: 0x64748b });
    const bikeWheel = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });

    [-0.5, 0.5].forEach(bx => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 16), bikeWheel);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(bx, 0.28, 0);
      bikeGroup.add(wheel);
    });

    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), ToonMaterialFactory.getToonMaterial({ color: 0x0284c7 }));
    frame.rotation.z = -0.7;
    frame.position.set(-0.05, 0.4, 0);
    bikeGroup.add(frame);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.45), bikeMetal);
    handle.position.set(0.4, 0.78, 0);
    bikeGroup.add(handle);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.3), bikeMetal);
    basket.position.set(0.52, 0.68, 0);
    bikeGroup.add(basket);

    girlGroup.add(bikeGroup);
    girlGroup.rotation.y = -0.3;

    this.group.add(girlGroup);

    // 2. Station Master (駅長) on Platform (X = -4, Z = -11.8)
    const masterGroup = new THREE.Group();
    masterGroup.position.set(-4, 0.85, -11.8);

    const uniformMat = ToonMaterialFactory.getToonMaterial({ color: 0x0f172a }); // Navy JR uniform
    const capMat = ToonMaterialFactory.getToonMaterial({ color: 0xffffff }); // White service cap

    // Uniform body
    const masterBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.22), uniformMat);
    masterBody.position.y = 0.95;
    masterGroup.add(masterBody);

    // Head & Service Cap
    const masterHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skinMat);
    masterHead.position.y = 1.6;
    masterGroup.add(masterHead);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), capMat);
    cap.position.y = 1.72;
    masterGroup.add(cap);

    this.group.add(masterGroup);
  }

  // --- 5. Roadside Stone Jizo Shrine (地藏石像) ---
  createJizoShrine() {
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(3.5, 0.1, 16.5);

    const stoneMat = ToonMaterialFactory.getToonMaterial({ color: 0x78716c, roughness: 0.9 });
    const redClothMat = ToonMaterialFactory.getToonMaterial({ color: 0xdc2626 });

    // Stone base pedestal
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), stoneMat);
    base.position.y = 0.17;
    shrineGroup.add(base);

    // Jizo body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 10), stoneMat);
    body.position.y = 0.6;
    shrineGroup.add(body);

    // Jizo rounded serene head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), stoneMat);
    head.position.y = 0.95;
    shrineGroup.add(head);

    // Red cloth bib (前掛け)
    const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.25), redClothMat);
    bib.position.set(0, 0.72, 0.17);
    shrineGroup.add(bib);

    // Mini bamboo flower holder with cherry blossom sprig
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.2),
      ToonMaterialFactory.getToonMaterial({ color: 0x65a30d })
    );
    holder.position.set(0.18, 0.42, 0.2);
    shrineGroup.add(holder);

    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xf472b6 })
    );
    bloom.position.set(0.18, 0.55, 0.2);
    shrineGroup.add(bloom);

    this.group.add(shrineGroup);
  }

  // --- 6. Small Environmental Props (Traffic Cones, AC units) ---
  createSmallTownProps() {
    // Orange Traffic Cones (三角锥)
    const coneMat = ToonMaterialFactory.getToonMaterial({ color: 0xf97316 });
    const coneWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [
      { x: 3.8, z: 29.5 },
      { x: 4.1, z: 30.5 }
    ].forEach(cp => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 12), coneMat);
      cone.position.set(cp.x, 0.35, cp.z);
      this.group.add(cone);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), coneWhiteMat);
      stripe.position.set(cp.x, 0.32, cp.z);
      this.group.add(stripe);
    });
  }
}
