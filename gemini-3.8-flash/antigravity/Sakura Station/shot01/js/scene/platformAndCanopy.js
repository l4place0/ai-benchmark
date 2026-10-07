import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Station Platform, Canopy Shelter, Benches, Signs & Platform Amenities
export class PlatformAndCanopy {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'platform_and_canopy';

    this.init();
  }

  init() {
    this.createPlatformBase();
    this.createTactileAndSafetyLines();
    this.createCanopyShelter();
    this.createSuspendedStationSign();
    this.createPlatformFurniture();
    this.createPlatformFencesAndEnds();

    this.scene.add(this.group);
  }

  createPlatformBase() {
    // Platform deck: Length = 54, Width = 3.6, Height = 0.85
    // Centered at X = -10, Y = 0.425, Z = -11.5
    const deckMat = ToonMaterialFactory.getToonMaterial({
      color: 0xc8cdd4, // Japanese platform concrete
      roughness: 0.7
    });

    const deckGeo = new THREE.BoxGeometry(54, 0.85, 3.6);
    const platformDeck = new THREE.Mesh(deckGeo, deckMat);
    platformDeck.position.set(-10, 0.425, -11.5);
    platformDeck.receiveShadow = true;
    platformDeck.castShadow = true;
    this.group.add(platformDeck);

    // Platform side wall bevel / edging
    const curbMat = ToonMaterialFactory.getToonMaterial({ color: 0x94a3b8 });
    const edgeBeam = new THREE.Mesh(
      new THREE.BoxGeometry(54, 0.15, 0.2),
      curbMat
    );
    edgeBeam.position.set(-10, 0.8, -13.2);
    this.group.add(edgeBeam);
  }

  createTactileAndSafetyLines() {
    // 1. Continuous Yellow Tactile Warning Pavers along track edge (Z = -13.0)
    const tactileTex = TextureGenerator.createTactilePavingTexture();
    tactileTex.repeat.set(100, 1);
    const tactileMat = new THREE.MeshBasicMaterial({
      map: tactileTex
    });

    const tactileBand = new THREE.Mesh(
      new THREE.PlaneGeometry(53.6, 0.35),
      tactileMat
    );
    tactileBand.rotation.x = -Math.PI / 2;
    tactileBand.position.set(-10, 0.86, -13.0);
    this.group.add(tactileBand);

    // 2. White Platform Safety Demarcation Line
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const safetyLine = new THREE.Mesh(
      new THREE.PlaneGeometry(53.6, 0.12),
      whiteLineMat
    );
    safetyLine.rotation.x = -Math.PI / 2;
    safetyLine.position.set(-10, 0.861, -12.65);
    this.group.add(safetyLine);

    // 3. Train Door Boarding Markers (▲ 1, ▲ 2, etc.) painted on platform
    const markerPositions = [-24, -16, -6, 2];
    markerPositions.forEach(x => {
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.862, -12.4);
      this.group.add(marker);
    });
  }

  createCanopyShelter() {
    // Modern steel-framed canopy shelter over central waiting zone (X = -28 to +6)
    const steelMat = ToonMaterialFactory.getToonMaterial({
      color: 0x334155, // Charcoal steel structure
      roughness: 0.5
    });

    const roofMat = ToonMaterialFactory.getToonMaterial({
      color: 0xecfdf5, // Translucent corrugated pale mint canopy
      transparent: true,
      opacity: 0.85
    });

    // Main canopy roof sheet
    const canopyRoof = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.12, 4.2),
      roofMat
    );
    canopyRoof.position.set(-11, 4.2, -11.5);
    canopyRoof.rotation.z = -0.02; // slight slope for rainwater
    canopyRoof.castShadow = true;
    this.group.add(canopyRoof);

    // Structural steel pillars and crossbeams
    for (let x = -26; x <= 4; x += 6) {
      // Y-shaped column
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.4),
        steelMat
      );
      pillar.position.set(x, 2.55, -11.5);
      pillar.castShadow = true;
      this.group.add(pillar);

      // Horizontal crossbeam
      const crossbeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.16, 4.0),
        steelMat
      );
      crossbeam.position.set(x, 4.1, -11.5);
      this.group.add(crossbeam);

      // Suspended fluorescent light tube under crossbeam
      const lightTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.2),
        ToonMaterialFactory.getEmissiveMaterial(0xffffff, 1.8)
      );
      lightTube.rotation.z = Math.PI / 2;
      lightTube.position.set(x, 3.92, -11.5);
      this.group.add(lightTube);
    }
  }

  createSuspendedStationSign() {
    // Suspended Japanese Platform Signboard (駅名標: 桜ヶ丘 / さくらがおか)
    const signTex = TextureGenerator.createStationSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });

    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.6, 0.12),
      signMat
    );
    signBoard.position.set(-11, 3.0, -11.5);
    this.group.add(signBoard);

    // Suspension steel cables
    const cableMat = ToonMaterialFactory.getToonMaterial({ color: 0x475569 });
    [-1.2, 1.2].forEach(ox => {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.1),
        cableMat
      );
      cable.position.set(-11 + ox, 3.65, -11.5);
      this.group.add(cable);
    });

    // Double-sided suspended platform clock
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-3.0, 3.3, -11.5);

    const clockBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16),
      ToonMaterialFactory.getToonMaterial({ color: 0x1e293b })
    );
    clockBody.rotation.z = Math.PI / 2;
    clockGroup.add(clockBody);

    const clockFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    clockFace.rotation.y = Math.PI / 2;
    clockFace.position.x = 0.11;
    clockGroup.add(clockFace);

    const clockFace2 = clockFace.clone();
    clockFace2.rotation.y = -Math.PI / 2;
    clockFace2.position.x = -0.11;
    clockGroup.add(clockFace2);

    this.group.add(clockGroup);
  }

  createPlatformFurniture() {
    // 1. Platform Waiting Benches (Deep green classic Japanese station benches)
    const benchMat = ToonMaterialFactory.getToonMaterial({ color: 0x166534 }); // Forest green
    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x334155 });

    const benchXs = [-20, -14, -8];
    benchXs.forEach(bx => {
      const benchGroup = new THREE.Group();
      benchGroup.position.set(bx, 0.85, -10.8);

      // Seat slats
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.06, 0.45),
        benchMat
      );
      seat.position.y = 0.45;
      benchGroup.add(seat);

      // Backrest
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.35, 0.05),
        benchMat
      );
      back.position.set(0, 0.75, -0.2);
      benchGroup.add(back);

      // Metal legs
      [-1.0, 1.0].forEach(lx => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.45),
          metalMat
        );
        leg.position.set(lx, 0.22, 0);
        benchGroup.add(leg);
      });

      this.group.add(benchGroup);
    });

    // 2. Platform Vending Machine (Blue theme, positioned against rear platform railing)
    const vmTex = TextureGenerator.createVendingMachineTexture('blue');
    const vmMat = new THREE.MeshBasicMaterial({ map: vmTex });

    const vmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.1, 0.8),
      vmMat
    );
    vmMesh.position.set(-2, 1.9, -10.5);
    vmMesh.castShadow = true;
    this.group.add(vmMesh);

    // Beverage recycling bin next to vending machine
    const binMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.9, 0.42),
      ToonMaterialFactory.getToonMaterial({ color: 0x0284c7 })
    );
    binMesh.position.set(-1.0, 1.3, -10.5);
    this.group.add(binMesh);
  }

  createPlatformFencesAndEnds() {
    // Rear safety railing (white metal fence along Z = -9.8 where not connecting to building)
    const fenceMat = ToonMaterialFactory.getToonMaterial({ color: 0xe2e8f0 });

    [-30, -24, 8, 12].forEach(fx => {
      const fenceSection = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 1.1, 0.05),
        fenceMat
      );
      fenceSection.position.set(fx, 1.4, -9.8);
      this.group.add(fenceSection);
    });

    // Platform End Safety Gate & "立入禁止" (Keep Out) Signs
    [16.8, -36.8].forEach(ex => {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.2, 3.4),
        fenceMat
      );
      barrier.position.set(ex, 1.45, -11.5);
      this.group.add(barrier);

      // Warning sign (Yellow/Red "立入禁止")
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      sign.position.set(ex + (ex > 0 ? -0.06 : 0.06), 1.5, -11.5);
      sign.rotation.y = ex > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(sign);

      // Dwarf track equipment junction box
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        ToonMaterialFactory.getToonMaterial({ color: 0x64748b })
      );
      box.position.set(ex, 1.2, -12.8);
      this.group.add(box);
    });
  }
}
