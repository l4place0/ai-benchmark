/**
 * buildings.js - Japanese Low-rise Suburban Architecture
 * Builds Detached Houses (with balconies & drying laundry), Wagashi Shop "さくら堂",
 * Convenience Store "DAILY POP", Cafe "CAFE CERISIER", and Flower Shop "花日和".
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getShopTexture, getPetalTexture } from './textures.js';

export class Buildings {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.animatedObjects = [];

    // Left Street Side Buildings
    this.createWagashiShop(-11.5, 34);
    this.createResidentialHouseA(-12.5, 14);
    this.createCafeCerisier(-11.8, -4);

    // Right Street Side Buildings
    this.createConvenienceStore(14.5, 26);
    this.createFlowerShop(13.8, 8);
    this.createResidentialHouseB(14.5, -8);

    this.scene.add(this.group);
  }

  // -------------------------------------------------------------
  // 1. Traditional Wagashi Shop "さくら堂" (和菓子店)
  // -------------------------------------------------------------
  createWagashiShop(x, z) {
    const bGroup = new THREE.Group();

    // 2-Story Timber Architecture
    const mainBody = createOutlinedMesh(
      new THREE.BoxGeometry(7.5, 6.2, 8.5),
      materials.wallStuccoCream
    );
    mainBody.position.y = 3.1;
    bGroup.add(mainBody);

    // Showa Style Timber Wall Panel Trim at ground floor
    const timberTrim = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 2.6, 8.6),
      materials.woodDark
    );
    timberTrim.position.y = 1.3;
    bGroup.add(timberTrim);

    // Sloped Japanese Tiled Roof
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(6.2, 2.4, 4),
      materials.roofTileSlate
    );
    roof.position.y = 7.4;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.15, 1, 1.25);
    bGroup.add(roof);

    // Front Sliding Glass Doors with Dark Timber Mullions
    const frontDoor = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.3, 0.15),
      materials.animeGlass
    );
    frontDoor.position.set(0, 1.15, 4.3);
    bGroup.add(frontDoor);

    // Fabric Noren (暖帘: "和菓子 さくら堂")
    const norenTex = getShopTexture('wagashi_noren');
    const norenMat = new THREE.MeshBasicMaterial({
      map: norenTex,
      transparent: true,
      side: THREE.DoubleSide
    });
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2), norenMat);
    noren.position.set(0, 2.2, 4.4);
    bGroup.add(noren);

    // Red Felt Bench Outside with Cherry Blossom Posters
    const redBenchMat = new THREE.MeshToonMaterial({
      color: 0xc92a2a,
      gradientMap: materials.wallStuccoWhite.gradientMap
    });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.65), redBenchMat);
    bench.position.set(-2.2, 0.225, 4.8);
    bench.castShadow = true;
    bGroup.add(bench);

    // Wooden Display Case with display sweets
    const displayCase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.5), materials.woodWarm);
    displayCase.position.set(2.2, 0.4, 4.7);
    bGroup.add(displayCase);

    // Wooden Overhang Eaves
    const eave = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 1.0), materials.woodDark);
    eave.position.set(0, 2.8, 4.7);
    eave.rotation.x = 0.1;
    bGroup.add(eave);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  // -------------------------------------------------------------
  // 2. Japanese Detached House A (Balcony, Laundry, AC unit)
  // -------------------------------------------------------------
  createResidentialHouseA(x, z) {
    const bGroup = new THREE.Group();

    // 2-Story House Body (Light Blue / Off-white siding)
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(8.2, 6.8, 9.2),
      materials.wallBlueSiding
    );
    body.position.y = 3.4;
    bGroup.add(body);

    // Traditional Gabled Roof
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(6.6, 2.6, 4),
      materials.roofTileDarkBlue
    );
    roof.position.y = 8.1;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 1.3);
    bGroup.add(roof);

    // 2nd Floor Balcony with Steel Railing
    const balconyFloor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 1.2), materials.concreteLight);
    balconyFloor.position.set(0, 3.5, 4.9);
    bGroup.add(balconyFloor);

    const balconyRail = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 0.08), materials.catenarySteel);
    balconyRail.position.set(0, 4.05, 5.45);
    bGroup.add(balconyRail);

    // Clothes Drying Rack & Laundry gently swaying in breeze
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6), materials.concreteLight);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 4.6, 5.0);
    bGroup.add(pole);

    // Hanging White Shirt & Towel (Animated)
    const shirtMat = new THREE.MeshToonMaterial({ color: 0xfafafa, side: THREE.DoubleSide });
    const towelMat = new THREE.MeshToonMaterial({ color: 0x93c5fd, side: THREE.DoubleSide });

    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), shirtMat);
    shirt.position.set(-1.0, 4.15, 5.0);
    bGroup.add(shirt);

    const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), towelMat);
    towel.position.set(1.1, 4.2, 5.0);
    bGroup.add(towel);

    this.animatedObjects.push({
      update: (time) => {
        const sway = Math.sin(time * 2.5) * 0.12;
        shirt.rotation.x = sway;
        towel.rotation.x = sway * 1.2;
      }
    });

    // 1st Floor Entry Porch & Mailbox
    const porchCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.0), materials.woodDark);
    porchCanopy.position.set(-1.8, 2.4, 4.9);
    bGroup.add(porchCanopy);

    const porchLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), materials.wallStuccoWhite);
    porchLight.position.set(-1.8, 2.25, 4.7);
    bGroup.add(porchLight);

    // Outdoor Air Conditioner Compressor (室外机) with spinning fan blades
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.45), materials.wallStuccoCream);
    acUnit.position.set(2.6, 0.325, 4.8);
    bGroup.add(acUnit);

    // Low Boundary Wall & Planter Pots with Hydrangea
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.1, 0.25), materials.concreteLight);
    wall.position.set(0, 0.55, 5.8);
    bGroup.add(wall);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 10), materials.woodWarm);
    pot.position.set(-1.8, 0.18, 5.2);
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), materials.flowerHydrangea);
    plant.position.y = 0.3;
    pot.add(plant);
    bGroup.add(pot);

    // TV Antenna on Roof (八木天线)
    const antenna = this.createTvAntenna();
    antenna.position.set(1.5, 9.4, 0);
    bGroup.add(antenna);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  // -------------------------------------------------------------
  // 3. Cafe Cerisier (樱花咖啡馆)
  // -------------------------------------------------------------
  createCafeCerisier(x, z) {
    const bGroup = new THREE.Group();

    // 2-Story Building
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(8.0, 6.5, 8.8),
      materials.wallStuccoCream
    );
    body.position.y = 3.25;
    bGroup.add(body);

    // Emerald Green Sloped Awning
    const awningMat = new THREE.MeshToonMaterial({
      color: 0x1b4332,
      gradientMap: materials.wallStuccoWhite.gradientMap
    });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.15, 1.6), awningMat);
    awning.position.set(0, 3.1, 4.8);
    awning.rotation.x = 0.15;
    bGroup.add(awning);

    // Large Cafe Display Window with cozy interior
    const windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.2, 0.15),
      materials.animeGlass
    );
    windowGlass.position.set(0, 1.5, 4.45);
    bGroup.add(windowGlass);

    // Dark Wood Window Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.4, 0.1), materials.woodDark);
    frame.position.set(0, 1.5, 4.4);
    bGroup.add(frame);

    // Chalkboard Easel Menu Outside ("CAFE CERISIER - 桜ラテ")
    const menuTex = getShopTexture('cafe_menu');
    const menuMat = new THREE.MeshBasicMaterial({ map: menuTex });
    const menuEasel = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.25), menuMat);
    menuEasel.position.set(-2.8, 0.75, 5.2);
    menuEasel.rotation.y = 0.25;
    menuEasel.castShadow = true;
    bGroup.add(menuEasel);

    // Outdoor Bistro Table & Metal Chairs with Fallen Petals
    const tableMat = materials.woodWarm;
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), tableMat);
    tableTop.position.set(2.4, 0.75, 5.3);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75), materials.catenarySteel);
    tableLeg.position.set(2.4, 0.375, 5.3);
    bGroup.add(tableTop);
    bGroup.add(tableLeg);

    // Petals resting on the cafe table
    const petalTex = getPetalTexture();
    const tablePetalMat = new THREE.MeshBasicMaterial({ map: petalTex, transparent: true });
    const tablePetals = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), tablePetalMat);
    tablePetals.rotation.x = -Math.PI / 2;
    tablePetals.position.set(2.4, 0.78, 5.3);
    bGroup.add(tablePetals);

    // Dark Tile Mansard Roof
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(6.4, 2.2, 4),
      materials.roofTileGreen
    );
    roof.position.y = 7.6;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 1.3);
    bGroup.add(roof);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  // -------------------------------------------------------------
  // 4. Convenience Store "DAILY POP" (便利店)
  // -------------------------------------------------------------
  createConvenienceStore(x, z) {
    const bGroup = new THREE.Group();

    // 1-Story Modern Commercial Building
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(10.5, 4.4, 9.0),
      materials.wallStuccoWhite
    );
    body.position.y = 2.2;
    bGroup.add(body);

    // Iconic Striped Signboard Fascia ("DAILY POP")
    const fasciaTex = getShopTexture('conbini_fascia');
    const fasciaMat = new THREE.MeshBasicMaterial({ map: fasciaTex });
    const fascia = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.4), fasciaMat);
    fascia.position.set(0, 3.5, 4.55);
    bGroup.add(fascia);

    // Large Plate Glass Storefront
    const storeGlass = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 2.4, 0.15),
      materials.animeGlass
    );
    storeGlass.position.set(0, 1.3, 4.52);
    bGroup.add(storeGlass);

    // Illuminated Interior Shelves & Coolers
    const interiorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 2.0, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfffaed })
    );
    interiorGlow.position.set(0, 1.3, 4.3);
    bGroup.add(interiorGlow);

    // Outdoor Garbage & Recycling Separation Bins (3 bins: Cans, PET, Burnable)
    const binColors = [0x3b82f6, 0xef4444, 0x10b981];
    for (let i = 0; i < 3; i++) {
      const bin = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.85, 0.45),
        new THREE.MeshToonMaterial({ color: binColors[i] })
      );
      bin.position.set(-3.2 + i * 0.55, 0.425, 4.9);
      bGroup.add(bin);
    }

    // Flat Commercial Roof with Parapet Trim
    const roofTrim = new THREE.Mesh(
      new THREE.BoxGeometry(10.7, 0.3, 9.2),
      materials.concreteDark
    );
    roofTrim.position.y = 4.45;
    bGroup.add(roofTrim);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  // -------------------------------------------------------------
  // 5. Flower Shop "花日和" (Flower Shop)
  // -------------------------------------------------------------
  createFlowerShop(x, z) {
    const bGroup = new THREE.Group();

    // 2-Story Pastel Shop
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(7.8, 6.2, 8.2),
      materials.wallStuccoCream
    );
    body.position.y = 3.1;
    bGroup.add(body);

    // Signboard "花日和 (Hanabiyori)"
    const flowerSignTex = getShopTexture('flower_sign');
    const signMat = new THREE.MeshBasicMaterial({ map: flowerSignTex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), signMat);
    sign.position.set(0, 3.2, 4.15);
    bGroup.add(sign);

    // Striped Canvas Awning (Green & White)
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.12, 1.4),
      new THREE.MeshToonMaterial({ color: 0x4ade80 })
    );
    awning.position.set(0, 2.4, 4.6);
    awning.rotation.x = 0.2;
    bGroup.add(awning);

    // Tiered Flower Display Racks Loaded with Colorful Buckets
    const rack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.2), materials.woodWarm);
    rack.position.set(0, 0.3, 4.8);
    bGroup.add(rack);

    // Zinc Buckets with Flowers
    const flowers = [materials.flowerTulipRed, materials.flowerTulipYellow, materials.flowerHydrangea, materials.sakuraCanopyMid];
    for (let i = -1.6; i <= 1.6; i += 0.8) {
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.45, 12), materials.concreteLight);
      bucket.position.set(i, 0.75, 4.8);
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        flowers[Math.floor(Math.random() * flowers.length)]
      );
      bloom.position.y = 0.3;
      bucket.add(bloom);
      bGroup.add(bucket);
    }

    // Japanese Tiled Roof
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(6.2, 2.2, 4),
      materials.roofTileSlate
    );
    roof.position.y = 7.3;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.2, 1, 1.25);
    bGroup.add(roof);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  // -------------------------------------------------------------
  // 6. Japanese Detached House B (Garden wall, sliding gate, Jizo)
  // -------------------------------------------------------------
  createResidentialHouseB(x, z) {
    const bGroup = new THREE.Group();

    // 2-Story House
    const body = createOutlinedMesh(
      new THREE.BoxGeometry(8.5, 6.6, 8.8),
      materials.wallGraySiding
    );
    body.position.y = 3.3;
    bGroup.add(body);

    // Dark Slate Gable Roof
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(6.6, 2.5, 4),
      materials.roofTileSlate
    );
    roof.position.y = 7.8;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.25, 1, 1.25);
    bGroup.add(roof);

    // Low Concrete Garden Wall
    const gardenWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.3, 0.25), materials.concreteLight);
    gardenWall.position.set(0, 0.65, 5.4);
    bGroup.add(gardenWall);

    // Cute Stone Lantern / Mini Shrine in front garden
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), materials.concreteDark);
    lanternBase.position.set(-2.8, 0.4, 4.6);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 4), materials.roofTileSlate);
    lanternCap.position.set(-2.8, 0.9, 4.6);
    bGroup.add(lanternBase);
    bGroup.add(lanternCap);

    bGroup.position.set(x, 0, z);
    this.group.add(bGroup);
  }

  createTvAntenna() {
    const group = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8), materials.catenarySteel);
    mast.position.y = 0.9;
    group.add(mast);

    // Cross bars
    for (let y = 0.6; y <= 1.4; y += 0.3) {
      const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), materials.catenarySteel);
      cross.rotation.z = Math.PI / 2;
      cross.position.y = y;
      group.add(cross);
    }
    return group;
  }

  update(time) {
    this.animatedObjects.forEach(obj => obj.update(time));
  }
}
