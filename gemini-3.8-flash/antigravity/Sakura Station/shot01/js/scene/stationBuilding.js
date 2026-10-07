import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Station Building, Interior Foyer, Ticket Gates, Machines & Signage
export class StationBuilding {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'station_building';

    this.init();
  }

  init() {
    this.createBuildingShell();
    this.createRoofAndEaves();
    this.createEntranceAndSign();
    this.createInteriorFoyer();
    this.createTicketGates();
    this.createTicketMachines();
    this.createBulletinBoard();
    this.createStationClock();
    this.createTactilePaving();
    this.createStationAmenities();

    this.scene.add(this.group);
  }

  createBuildingShell() {
    // Station main volume: X = -8, Y = 2.5, Z = -4. Width = 14, Height = 5.2, Depth = 9
    const wallMat = ToonMaterialFactory.getToonMaterial({
      color: 0xf3eee3, // Warm anime cream plaster
      roughness: 0.7
    });

    const woodTrimMat = ToonMaterialFactory.getToonMaterial({
      color: 0x4a3728, // Dark Japanese cedar wood
      roughness: 0.6
    });

    // Main station box
    const mainWalls = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5.0, 9.0),
      wallMat
    );
    mainWalls.position.set(-8, 2.5, -4);
    mainWalls.castShadow = true;
    mainWalls.receiveShadow = true;
    this.group.add(mainWalls);

    // Dark wood structural corner pillars & horizontal trims
    const pillarGeo = new THREE.BoxGeometry(0.35, 5.2, 0.35);
    const corners = [
      { x: -15, z: 0.5 }, { x: -1, z: 0.5 },
      { x: -15, z: -8.5 }, { x: -1, z: -8.5 }
    ];
    corners.forEach(c => {
      const pillar = new THREE.Mesh(pillarGeo, woodTrimMat);
      pillar.position.set(c.x, 2.6, c.z);
      pillar.castShadow = true;
      this.group.add(pillar);
    });

    // Horizontal timber beams
    const beamGeo = new THREE.BoxGeometry(14.2, 0.25, 0.3);
    const frontBeam = new THREE.Mesh(beamGeo, woodTrimMat);
    frontBeam.position.set(-8, 3.8, 0.52);
    this.group.add(frontBeam);

    // Windows with glass and wooden frames
    const glassMat = ToonMaterialFactory.getGlassMaterial();
    // Front windows (flanking entrance)
    [-12.5, -3.5].forEach(x => {
      const windowFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.0, 0.15),
        woodTrimMat
      );
      windowFrame.position.set(x, 2.2, 0.52);
      this.group.add(windowFrame);

      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.8),
        glassMat
      );
      glass.position.set(x, 2.2, 0.61);
      this.group.add(glass);
    });
  }

  createRoofAndEaves() {
    // Traditional dark metal/tile hipped roof with broad eaves
    const roofMat = ToonMaterialFactory.getToonMaterial({
      color: 0x334155, // Deep slate roof tile color
      roughness: 0.5
    });

    // Sloped hipped roof
    const roofGeo = new THREE.ConeGeometry(10.5, 3.2, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1.0, 0.85);
    roof.position.set(-8, 6.2, -4);
    roof.castShadow = true;
    this.group.add(roof);

    // Overhanging canopy eaves over the front entrance
    const canopyMat = ToonMaterialFactory.getToonMaterial({
      color: 0x475569,
      roughness: 0.5
    });
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.25, 2.5),
      canopyMat
    );
    canopy.position.set(-8, 3.9, 1.6);
    canopy.castShadow = true;
    this.group.add(canopy);

    // Canopy support steel brackets
    const bracketMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });
    [-11.2, -4.8].forEach(x => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.8),
        bracketMat
      );
      pole.position.set(x, 1.9, 2.7);
      pole.castShadow = true;
      this.group.add(pole);
    });

    // Rain gutter along front roof edge
    const gutter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 8.2),
      bracketMat
    );
    gutter.rotation.z = Math.PI / 2;
    gutter.position.set(-8, 3.85, 2.85);
    this.group.add(gutter);

    // Downspout connected to ground
    const downspout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.8),
      bracketMat
    );
    downspout.position.set(-4.75, 1.9, 2.85);
    this.group.add(downspout);
  }

  createEntranceAndSign() {
    // Front Grand Entrance Signboard "桜ヶ丘駅 / SAKURAGAOKA STATION"
    const signTex = TextureGenerator.createStationEntranceSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });

    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.3, 0.15),
      signMat
    );
    signBoard.position.set(-8, 4.2, 1.65);
    this.group.add(signBoard);

    // Soft warm sign illumination light
    const signLight = new THREE.PointLight(0xfef08a, 1.2, 6);
    signLight.position.set(-8, 4.0, 2.2);
    this.group.add(signLight);

    // Recessed entrance opening
    const openMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const entranceCutout = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 3.2),
      openMat
    );
    entranceCutout.position.set(-8, 1.6, 0.53);
    this.group.add(entranceCutout);
  }

  createInteriorFoyer() {
    // Inside station warm ambient lighting & floor
    const foyerLight = new THREE.PointLight(0xffedd5, 1.8, 12);
    foyerLight.position.set(-8, 2.8, -3.5);
    this.group.add(foyerLight);

    // Station Master Office Window (Left of entrance)
    const officeBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.2, 0.2),
      ToonMaterialFactory.getToonMaterial({ color: 0x4a3728 })
    );
    officeBox.position.set(-11.5, 1.8, -1.0);
    this.group.add(officeBox);

    // Glass counter & "精算・案内" (Fare Adjustment / Information)
    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.2),
      ToonMaterialFactory.getGlassMaterial({ opacity: 0.6 })
    );
    windowGlass.position.set(-11.5, 2.0, -0.88);
    this.group.add(windowGlass);
  }

  createTicketGates() {
    // 3 Automatic Ticket Gates (自動改札機) leading to the platform
    const gateBodyMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8, // Brushed stainless steel
      metalness: 0.5,
      roughness: 0.4
    });

    const icSensorMat = ToonMaterialFactory.getEmissiveMaterial(0x38bdf8, 2.0); // Glowing cyan IC touch pad
    const flapMat = ToonMaterialFactory.getToonMaterial({ color: 0x3b82f6 }); // Blue flap gates

    for (let i = 0; i < 3; i++) {
      const x = -9.2 + i * 1.2;

      // Gate housing
      const gate = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.95, 1.8),
        gateBodyMat
      );
      gate.position.set(x, 0.48, -4.5);
      gate.castShadow = true;
      this.group.add(gate);

      // Glowing IC card reader pad
      const icPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.04, 0.3),
        icSensorMat
      );
      icPad.position.set(x, 0.97, -4.2);
      this.group.add(icPad);

      // Status indicator light (Green arrow)
      const arrowLight = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 8),
        ToonMaterialFactory.getEmissiveMaterial(0x22c55e, 2.0)
      );
      arrowLight.position.set(x, 0.85, -3.59);
      this.group.add(arrowLight);

      // Retractable gate flaps (if not last)
      if (i < 2) {
        const flap = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.6, 0.05),
          flapMat
        );
        flap.position.set(x + 0.6, 0.5, -4.5);
        this.group.add(flap);
      }
    }
  }

  createTicketMachines() {
    // 2 Automatic Ticket Vending Machines (自動券売機) on the right wall
    const machineBodyMat = ToonMaterialFactory.getToonMaterial({
      color: 0x3b82f6, // Classic JR light blue / teal housing
      roughness: 0.5
    });

    [-5.8, -4.6].forEach(x => {
      // Machine Cabinet
      const machine = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 1.8, 0.4),
        machineBodyMat
      );
      machine.position.set(x, 1.2, -1.0);
      machine.castShadow = true;
      this.group.add(machine);

      // Touchscreen interface (Glowing)
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      );
      screen.position.set(x, 1.45, -0.79);
      this.group.add(screen);

      // Coin/card tray
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.15, 0.1),
        ToonMaterialFactory.getToonMaterial({ color: 0x1e293b })
      );
      tray.position.set(x, 0.8, -0.76);
      this.group.add(tray);
    });

    // Fare Chart Board above ticket machines
    const fareBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    fareBoard.position.set(-5.2, 2.7, -0.79);
    this.group.add(fareBoard);
  }

  createBulletinBoard() {
    // Station Bulletin Board with Spring Festival posters and Town Map
    const bulletinTex = TextureGenerator.createBulletinPosterTexture();
    const bulletinMat = new THREE.MeshBasicMaterial({ map: bulletinTex });

    const bulletin = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.8, 0.08),
      bulletinMat
    );
    bulletin.position.set(-13.0, 2.0, 0.55);
    this.group.add(bulletin);
  }

  createStationClock() {
    // Round Wall Clock on the entrance facade
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-8, 3.2, 1.7);

    // Clock bezel
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24),
      ToonMaterialFactory.getToonMaterial({ color: 0x1e293b })
    );
    bezel.rotation.x = Math.PI / 2;
    clockGroup.add(bezel);

    // Clock face (White dial)
    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    dial.position.z = 0.045;
    clockGroup.add(dial);

    // Hands showing ~4:02 PM
    const hourHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.22, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    hourHand.position.set(0.08, -0.06, 0.05);
    hourHand.rotation.z = -2.1; // ~4 o'clock
    clockGroup.add(hourHand);

    const minHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.32, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    minHand.position.set(0.04, 0.12, 0.055);
    minHand.rotation.z = -0.2; // ~2 minutes
    clockGroup.add(minHand);

    this.group.add(clockGroup);
  }

  createTactilePaving() {
    // Yellow Tactile Paving (盲道) leading from Station Plaza through entrance to Platform
    const tactileTex = TextureGenerator.createTactilePavingTexture();
    const tactileMat = new THREE.MeshBasicMaterial({
      map: tactileTex,
      transparent: true
    });

    // Path segment from plaza into entrance (Z = 5 to Z = -4.5)
    const tactileStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 9.5),
      tactileMat
    );
    tactileStrip.rotation.x = -Math.PI / 2;
    tactileStrip.position.set(-8.0, 0.04, 0.2);
    this.group.add(tactileStrip);
  }

  createStationAmenities() {
    // 1. Umbrella Stand outside entrance
    const umbrellaStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12),
      ToonMaterialFactory.getToonMaterial({ color: 0x64748b, metalness: 0.3 })
    );
    umbrellaStand.position.set(-5.6, 0.35, 1.2);
    this.group.add(umbrellaStand);

    // 2. Recycling & Waste Sorting Cans (燃えるゴミ, カン・ビン, ペットボトル)
    const binColors = [0x2563eb, 0x16a34a, 0xdc2626]; // Blue, Green, Red
    binColors.forEach((col, idx) => {
      const bin = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.85, 0.38),
        ToonMaterialFactory.getToonMaterial({ color: col })
      );
      bin.position.set(-13.8 + idx * 0.45, 0.42, 1.2);
      bin.castShadow = true;
      this.group.add(bin);

      // Bin lid hole
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 12),
        new THREE.MeshBasicMaterial({ color: 0x0f172a })
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(-13.8 + idx * 0.45, 0.85, 1.2);
      this.group.add(hole);
    });
  }
}
