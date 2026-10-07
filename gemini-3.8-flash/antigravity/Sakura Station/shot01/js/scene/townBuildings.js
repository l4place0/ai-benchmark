import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Japanese Town Architecture: Traditional Shops, Conbini, Cafe, Flower Shop & Residences
export class TownBuildings {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'town_buildings';

    this.init();
  }

  init() {
    // === WEST STREET BUILDINGS (Facing +X towards the street) ===
    // 1. Traditional Wagashi Shop (さくら堂) - West Street
    this.createWagashiShop({ x: -1.5, z: 22 });

    // 2. Japanese Cafe (CAFE SAKURA) - West Street
    this.createCafe({ x: -1.5, z: 34 });

    // 3. Japanese Detached Residence (Sato House) - West Street
    this.createResidentialHouseWest({ x: -1.5, z: 46, name: '佐藤 (Sato)', wallColor: 0xf3ede2, roofColor: 0x334155 });

    // === EAST STREET BUILDINGS (Facing -X towards the street) ===
    // 4. Modern Convenience Store (SPRING MART) - East Street
    this.createConvenienceStore({ x: 19.5, z: 22 });

    // 5. Suburban Flower Shop - East Street
    this.createFlowerShop({ x: 19.5, z: 34 });

    // 6. Japanese Detached Residence (Tanaka House) - East Street
    this.createResidentialHouseEast({ x: 19.5, z: 46, name: '田中 (Tanaka)', wallColor: 0xdbeafe, roofColor: 0x1e293b });

    // === NORTH EMBANKMENT HOUSES (Beyond tracks, facing South) ===
    this.createEmbankmentHouse({ x: -18.0, z: -32, wallColor: 0xfef3c7, roofColor: 0x334155 });
    this.createEmbankmentHouse({ x: -4.0, z: -34, wallColor: 0xf1f5f9, roofColor: 0x1e3a8a });
    this.createEmbankmentHouse({ x: 10.0, z: -33, wallColor: 0xfce7f3, roofColor: 0x1e293b });
    this.createEmbankmentHouse({ x: 24.0, z: -35, wallColor: 0xe0e7ff, roofColor: 0x334155 });

    this.scene.add(this.group);
  }

  // --- 1. Traditional Wagashi Shop (さくら堂) - FACING +X (East towards Street) ---
  createWagashiShop(pos) {
    const shopGroup = new THREE.Group();
    shopGroup.position.set(pos.x, 0, pos.z);

    const timberMat = ToonMaterialFactory.getToonMaterial({ color: 0x3e2723 });
    const plasterMat = ToonMaterialFactory.getToonMaterial({ color: 0xf7eedb });
    const roofMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });

    // 2-Story Building Shell (W = 8m along X, D = 9m along Z, H = 6.5m)
    const building = new THREE.Mesh(new THREE.BoxGeometry(8, 6.5, 9), plasterMat);
    building.position.set(-4.0, 3.25, 0); // recessed behind sidewalk
    building.castShadow = true;
    building.receiveShadow = true;
    shopGroup.add(building);

    // Gabled Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 2.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.4, 1.0, 1.2);
    roof.position.set(-4.0, 7.4, 0);
    roof.castShadow = true;
    shopGroup.add(roof);

    // Facade is on the +X wall (x = 0) facing street!
    // Lower Shop Eaves over entrance
    const lowerEaves = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 8.8), timberMat);
    lowerEaves.position.set(1.0, 3.4, 0);
    shopGroup.add(lowerEaves);

    // Dark wood frame storefront
    const shopFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.8, 7.2),
      ToonMaterialFactory.getToonMaterial({ color: 0x271c19 })
    );
    shopFront.position.set(0.1, 1.4, 0);
    shopGroup.add(shopFront);

    // Glass display window with warm interior illumination
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.8),
      ToonMaterialFactory.getGlassMaterial({ opacity: 0.5, color: 0xffedd5 })
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(0.22, 1.4, -1.4);
    shopGroup.add(glass);

    // Japanese Indigo Fabric Noren Banner (さくら堂) facing the street!
    const norenTex = TextureGenerator.createWagashiNorenTexture();
    const norenMat = new THREE.MeshBasicMaterial({ map: norenTex, transparent: true, side: THREE.DoubleSide });
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), norenMat);
    noren.rotation.y = Math.PI / 2;
    noren.position.set(0.4, 2.6, 0);
    shopGroup.add(noren);

    // Outdoor Red Bench with Traditional Vermilion Parasol (野点傘)
    const redMat = ToonMaterialFactory.getToonMaterial({ color: 0xdc2626 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 2.0), redMat);
    bench.position.set(1.4, 0.25, 2.4);
    bench.castShadow = true;
    shopGroup.add(bench);

    const parasolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), timberMat);
    parasolPole.position.set(1.4, 1.3, 2.4);
    shopGroup.add(parasolPole);

    const parasolCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 16), redMat);
    parasolCanopy.position.set(1.4, 2.6, 2.4);
    shopGroup.add(parasolCanopy);

    // Hanging paper lanterns
    [-1.8, 1.8].forEach(lz => {
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.55, 12),
        ToonMaterialFactory.getEmissiveMaterial(0xfef08a, 1.6)
      );
      lantern.position.set(0.8, 3.0, lz);
      shopGroup.add(lantern);
    });

    this.group.add(shopGroup);
  }

  // --- 2. Japanese Cafe (CAFE SAKURA) - FACING +X (East towards Street) ---
  createCafe(pos) {
    const cafeGroup = new THREE.Group();
    cafeGroup.position.set(pos.x, 0, pos.z);

    const creamMat = ToonMaterialFactory.getToonMaterial({ color: 0xfdfbf7 });
    const timberMat = ToonMaterialFactory.getToonMaterial({ color: 0x451a03 });
    const roofMat = ToonMaterialFactory.getToonMaterial({ color: 0x475569 });

    // Main building
    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(8, 6.2, 9), creamMat);
    mainBox.position.set(-4.0, 3.1, 0);
    mainBox.castShadow = true;
    mainBox.receiveShadow = true;
    cafeGroup.add(mainBox);

    // Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 2.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.4, 1.0, 1.2);
    roof.position.set(-4.0, 7.1, 0);
    roof.castShadow = true;
    cafeGroup.add(roof);

    // Large picture window facing street
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 2.2),
      ToonMaterialFactory.getGlassMaterial({ opacity: 0.6, color: 0xffedd5 })
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(0.02, 1.8, 0);
    cafeGroup.add(glass);

    // Wine-red Striped Fabric Awning facing street
    const awningMat = ToonMaterialFactory.getToonMaterial({ color: 0x991b1b });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 5.4), awningMat);
    awning.rotation.z = -0.25;
    awning.position.set(0.9, 3.2, 0);
    awning.castShadow = true;
    cafeGroup.add(awning);

    // Outdoor Chalkboard Menu Standee facing street
    const menuTex = TextureGenerator.createCafeChalkboardTexture();
    const menuMat = new THREE.MeshBasicMaterial({ map: menuTex, side: THREE.DoubleSide });
    const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), menuMat);
    menuBoard.rotation.y = Math.PI / 2 + 0.2;
    menuBoard.position.set(1.5, 0.6, 2.6);
    cafeGroup.add(menuBoard);

    // Outdoor Bistro Table & Chairs with fallen sakura petals
    const metalMat = ToonMaterialFactory.getToonMaterial({ color: 0x334155 });
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16), metalMat);
    tableTop.position.set(1.5, 0.75, -2.2);
    cafeGroup.add(tableTop);

    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75), metalMat);
    tableLeg.position.set(1.5, 0.38, -2.2);
    cafeGroup.add(tableLeg);

    // Fallen petals on table
    const petalDrift = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide })
    );
    petalDrift.rotation.x = -Math.PI / 2;
    petalDrift.position.set(1.5, 0.78, -2.2);
    cafeGroup.add(petalDrift);

    this.group.add(cafeGroup);
  }

  // --- 3. Sato House (West Street, Facing +X towards Street) ---
  createResidentialHouseWest(config) {
    const houseGroup = new THREE.Group();
    houseGroup.position.set(config.x, 0, config.z);

    const wallMat = ToonMaterialFactory.getToonMaterial({ color: config.wallColor });
    const roofMat = ToonMaterialFactory.getToonMaterial({ color: config.roofColor });
    const woodMat = ToonMaterialFactory.getToonMaterial({ color: 0x422006 });
    const concreteMat = ToonMaterialFactory.getToonMaterial({ color: 0x94a3b8 });

    // Main 2-story box
    const house = new THREE.Mesh(new THREE.BoxGeometry(8, 6.2, 8.5), wallMat);
    house.position.set(-4.0, 3.1, 0);
    house.castShadow = true;
    house.receiveShadow = true;
    houseGroup.add(house);

    // Tiled roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.4, 1.0, 1.25);
    roof.position.set(-4.0, 7.2, 0);
    roof.castShadow = true;
    houseGroup.add(roof);

    // 2nd Floor Balcony facing Street (+X)
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 4.2), concreteMat);
    balcony.position.set(0.5, 4.2, 0);
    houseGroup.add(balcony);

    // Hanging laundry on balcony
    const laundryMat1 = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const laundryMat2 = new THREE.MeshBasicMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
    const laundryMat3 = new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide });

    const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), laundryMat1);
    c1.rotation.y = Math.PI / 2;
    c1.position.set(0.6, 4.4, -1.0);
    houseGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), laundryMat2);
    c2.rotation.y = Math.PI / 2;
    c2.position.set(0.6, 4.4, 0);
    houseGroup.add(c2);

    const c3 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), laundryMat3);
    c3.rotation.y = Math.PI / 2;
    c3.position.set(0.6, 4.3, 1.0);
    houseGroup.add(c3);

    // Entrance porch with nameplate facing street
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 2.4), woodMat);
    porchRoof.position.set(0.5, 2.5, -2.0);
    houseGroup.add(porchRoof);

    // Nameplate "佐藤"
    const nameplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.4, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    nameplate.position.set(0.05, 1.8, -1.0);
    houseGroup.add(nameplate);

    // Planters & Bonsai
    const potMat = ToonMaterialFactory.getToonMaterial({ color: 0x9a3412 });
    const plantMat = ToonMaterialFactory.getToonMaterial({ color: 0x15803d });
    [-2.6, -1.8, -1.2].forEach((pz, i) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 8), potMat);
      pot.position.set(0.6, 0.18, pz);
      houseGroup.add(pot);

      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.25 + i * 0.05, 8, 8), plantMat);
      plant.position.set(0.6, 0.45 + i * 0.05, pz);
      houseGroup.add(plant);
    });

    this.group.add(houseGroup);
  }

  // --- 4. Convenience Store (SPRING MART) - FACING -X (West towards Street) ---
  createConvenienceStore(pos) {
    const storeGroup = new THREE.Group();
    storeGroup.position.set(pos.x, 0, pos.z);

    const whiteMat = ToonMaterialFactory.getToonMaterial({ color: 0xffffff });
    const glassMat = ToonMaterialFactory.getGlassMaterial({ opacity: 0.6, color: 0xffedd5 });

    // Store building
    const building = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 9), whiteMat);
    building.position.set(5.0, 2.25, 0);
    building.castShadow = true;
    building.receiveShadow = true;
    storeGroup.add(building);

    // Glass Front Curtain Wall facing street (-X)
    const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.8), glassMat);
    glassFront.rotation.y = -Math.PI / 2;
    glassFront.position.set(-0.02, 1.6, 0);
    storeGroup.add(glassFront);

    // Illuminated Brand Sign ("SPRING MART / 桜マート 24H")
    const signTex = TextureGenerator.createConbiniSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const brandSign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 9.2), signMat);
    brandSign.position.set(-0.12, 3.8, 0);
    storeGroup.add(brandSign);

    // Warm interior light
    const storeLight = new THREE.PointLight(0xffedd5, 2.2, 12);
    storeLight.position.set(3, 2.8, 0);
    storeGroup.add(storeLight);

    // Interior shelves
    const shelfMat = ToonMaterialFactory.getToonMaterial({ color: 0x3b82f6 });
    for (let z = -2.5; z <= 2.5; z += 1.8) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.4), shelfMat);
      shelf.position.set(3.5, 0.75, z);
      storeGroup.add(shelf);
    }

    // Outdoor sorting trash cans
    const binColors = [0x2563eb, 0x16a34a, 0xdc2626];
    binColors.forEach((col, i) => {
      const bin = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.85, 0.4),
        ToonMaterialFactory.getToonMaterial({ color: col })
      );
      bin.position.set(-0.6, 0.42, 3.2 - i * 0.6);
      storeGroup.add(bin);
    });

    this.group.add(storeGroup);
  }

  // --- 5. Flower Shop (Flower Garden) - FACING -X (West towards Street) ---
  createFlowerShop(pos) {
    const shopGroup = new THREE.Group();
    shopGroup.position.set(pos.x, 0, pos.z);

    const plasterMat = ToonMaterialFactory.getToonMaterial({ color: 0xf0fdf4 });
    const awningMat = ToonMaterialFactory.getToonMaterial({ color: 0x16a34a }); // Sage green

    const building = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 8.5), plasterMat);
    building.position.set(4.5, 2.75, 0);
    building.castShadow = true;
    shopGroup.add(building);

    // Sage Green Awning facing street (-X)
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 7.5), awningMat);
    awning.rotation.z = -0.25;
    awning.position.set(-0.9, 3.0, 0);
    awning.castShadow = true;
    shopGroup.add(awning);

    // Outdoor Flower Display Racks & Buckets
    const woodCrateMat = ToonMaterialFactory.getToonMaterial({ color: 0x78350f });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 4.0), woodCrateMat);
    crate.position.set(-0.7, 0.25, 0);
    shopGroup.add(crate);

    // Blooming flowers in zinc buckets
    const flowerColors = [0xf43f5e, 0xfacc15, 0xa855f7, 0x38bdf8, 0xf472b6];
    flowerColors.forEach((col, i) => {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.14, 0.38, 8),
        ToonMaterialFactory.getToonMaterial({ color: 0x94a3b8 })
      );
      pot.position.set(-0.7, 0.65, -1.4 + i * 0.7);
      shopGroup.add(pot);

      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      bloom.position.set(-0.7, 0.95, -1.4 + i * 0.7);
      shopGroup.add(bloom);
    });

    this.group.add(shopGroup);
  }

  // --- 6. Tanaka House (East Street, Facing -X towards Street) ---
  createResidentialHouseEast(config) {
    const houseGroup = new THREE.Group();
    houseGroup.position.set(config.x, 0, config.z);

    const wallMat = ToonMaterialFactory.getToonMaterial({ color: config.wallColor });
    const roofMat = ToonMaterialFactory.getToonMaterial({ color: config.roofColor });
    const woodMat = ToonMaterialFactory.getToonMaterial({ color: 0x422006 });
    const concreteMat = ToonMaterialFactory.getToonMaterial({ color: 0x94a3b8 });

    const house = new THREE.Mesh(new THREE.BoxGeometry(8, 6.2, 8.5), wallMat);
    house.position.set(4.0, 3.1, 0);
    house.castShadow = true;
    house.receiveShadow = true;
    houseGroup.add(house);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.4, 1.0, 1.25);
    roof.position.set(4.0, 7.2, 0);
    roof.castShadow = true;
    houseGroup.add(roof);

    // Balcony facing street (-X)
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 4.2), concreteMat);
    balcony.position.set(-0.5, 4.2, 0);
    houseGroup.add(balcony);

    // Nameplate "田中"
    const nameplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.4, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    nameplate.position.set(-0.05, 1.8, 1.0);
    houseGroup.add(nameplate);

    this.group.add(houseGroup);
  }

  // --- 7. Embankment Houses beyond tracks (North side) ---
  createEmbankmentHouse(config) {
    const houseGroup = new THREE.Group();
    houseGroup.position.set(config.x, 1.5, config.z);

    const wallMat = ToonMaterialFactory.getToonMaterial({ color: config.wallColor });
    const roofMat = ToonMaterialFactory.getToonMaterial({ color: config.roofColor });

    const house = new THREE.Mesh(new THREE.BoxGeometry(7.5, 5.5, 7.0), wallMat);
    house.position.set(0, 2.75, 0);
    house.castShadow = true;
    houseGroup.add(house);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.3, 1.0, 1.2);
    roof.position.set(0, 6.4, 0);
    roof.castShadow = true;
    houseGroup.add(roof);

    this.group.add(houseGroup);
  }
}
