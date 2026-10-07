import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Japanese Vending Machines (自动贩卖机) placed across key town locations
export class VendingMachines {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'vending_machines';

    this.init();
  }

  init() {
    // 1. Station Entrance (Classic Red Theme)
    this.createMachine({
      x: -3.8, y: 0.15, z: 1.5,
      rotY: 0,
      theme: 'red',
      hasRecycleBin: true
    });

    // 2. Convenience Store Side (Modern Clean White Theme)
    this.createMachine({
      x: 14.2, y: 0.15, z: 19.5,
      rotY: -Math.PI / 2,
      theme: 'white',
      hasRecycleBin: true
    });

    // 3. Street Corner next to Cafe (Sakura Pink Limited Spring Edition)
    this.createMachine({
      x: 1.2, y: 0.15, z: 38.0,
      rotY: Math.PI / 2,
      theme: 'pink',
      hasRecycleBin: true
    });

    // 4. Quiet Street Corner near Sato Residence (Cool Blue Aqua Theme)
    this.createMachine({
      x: 1.2, y: 0.15, z: 50.0,
      rotY: Math.PI / 2,
      theme: 'blue',
      hasRecycleBin: true
    });

    this.scene.add(this.group);
  }

  createMachine({ x, y, z, rotY = 0, theme = 'red', hasRecycleBin = true }) {
    const vmGroup = new THREE.Group();
    vmGroup.position.set(x, y, z);
    vmGroup.rotation.y = rotY;

    // Vending Machine Dimensions: W = 1.15m, H = 2.1m, D = 0.8m
    const tex = TextureGenerator.createVendingMachineTexture(theme);
    const frontMat = new THREE.MeshBasicMaterial({ map: tex });

    const bodyColors = {
      red: 0xdc2626,
      blue: 0x0284c7,
      white: 0xf1f5f9,
      pink: 0xf472b6
    };
    const bodyMat = ToonMaterialFactory.getToonMaterial({
      color: bodyColors[theme] || 0xdc2626,
      roughness: 0.5
    });

    // Machine housing
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 0.78), bodyMat);
    housing.position.y = 1.05;
    housing.castShadow = true;
    housing.receiveShadow = true;
    vmGroup.add(housing);

    // Front illuminated panel
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.13, 2.03), frontMat);
    front.position.set(0, 1.05, 0.40);
    vmGroup.add(front);

    // Soft emissive front light
    const glowLight = new THREE.PointLight(0xffedd5, 1.0, 4);
    glowLight.position.set(0, 1.2, 0.8);
    vmGroup.add(glowLight);

    // Paired Beverage Recycling Bin (カン・ペットボトル回収ボックス)
    if (hasRecycleBin) {
      const binGroup = new THREE.Group();
      binGroup.position.set(0.85, 0, 0);

      const binMat = ToonMaterialFactory.getToonMaterial({
        color: bodyColors[theme] || 0x0284c7,
        roughness: 0.6
      });

      const binMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.95, 0.44), binMat);
      binMesh.position.y = 0.48;
      binMesh.castShadow = true;
      binGroup.add(binMesh);

      // Two disposal holes on top for cans and plastic bottles
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      [-0.1, 0.1].forEach(hx => {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), holeMat);
        hole.rotation.x = -Math.PI / 2;
        hole.position.set(hx, 0.96, 0);
        binGroup.add(hole);
      });

      vmGroup.add(binGroup);
    }

    this.group.add(vmGroup);
  }
}
