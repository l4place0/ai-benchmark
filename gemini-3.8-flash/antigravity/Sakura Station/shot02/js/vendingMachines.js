/**
 * vendingMachines.js - Japanese Beverage Vending Machines (自动贩卖机)
 * Detailed 3D models with illuminated drink showcase windows, red/blue hot/cold tags,
 * coin slots, collection door, attached recycling bins, and plastic drink crates.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getVendingDisplayTexture } from './textures.js';

export class VendingMachines {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // 1. Platform Vending Machine (Blue Coffee Theme)
    this.createMachine({
      x: -4.5,
      y: 0.75, // On platform
      z: -20.2,
      rotY: 0,
      bodyColor: 0x1d4ed8,
      theme: 'boss',
      hasRecycleBin: true
    });

    // 2. Convenience Store Front Vending Machine (Red Refresh Theme)
    this.createMachine({
      x: 9.8,
      y: 0.16,
      z: 21.5,
      rotY: -Math.PI / 2,
      bodyColor: 0xdc2626,
      theme: 'coca',
      hasRecycleBin: true
    });

    // 3. Convenience Store Front Second Machine (Green Tea Theme)
    this.createMachine({
      x: 9.8,
      y: 0.16,
      z: 23.0,
      rotY: -Math.PI / 2,
      bodyColor: 0x15803d,
      theme: 'tea',
      hasRecycleBin: false
    });

    // 4. Station Entrance Vending Machine (White & Sakura Theme)
    this.createMachine({
      x: 5.6,
      y: 0.18,
      z: -14.2,
      rotY: 0,
      bodyColor: 0xf8fafc,
      theme: 'coca',
      hasRecycleBin: true
    });

    // 5. Quiet Street Corner Vending Machine (Warm Cream Vintage Theme)
    this.createMachine({
      x: -8.8,
      y: 0.16,
      z: 25.0,
      rotY: Math.PI / 2,
      bodyColor: 0xfef08a,
      theme: 'boss',
      hasRecycleBin: true
    });

    this.scene.add(this.group);
  }

  createMachine({ x, y, z, rotY, bodyColor, theme, hasRecycleBin }) {
    const mGroup = new THREE.Group();

    const w = 1.1;
    const h = 2.0;
    const d = 0.85;

    // 1. Machine Outer Cabinet (Outlined)
    const cabinetMat = new THREE.MeshToonMaterial({
      color: bodyColor,
      gradientMap: materials.wallStuccoWhite.gradientMap
    });
    const cabinet = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), cabinetMat, 0.02);
    cabinet.position.y = h / 2;
    mGroup.add(cabinet);

    // 2. Illuminated Glass Drink Showcase Window
    const displayTex = getVendingDisplayTexture(theme);
    const displayMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const showcase = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.25), displayMat);
    showcase.position.set(0, 1.15, d / 2 + 0.015);
    mGroup.add(showcase);

    // Subtle glass cover
    const glassCover = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.28),
      materials.animeGlass
    );
    glassCover.position.set(0, 1.15, d / 2 + 0.02);
    mGroup.add(glassCover);

    // 3. Lower Front Panel (Coin slot, button, delivery port)
    const lowerPanelMat = new THREE.MeshToonMaterial({ color: 0x334155 });

    // Delivery flap door (取货口)
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.06), lowerPanelMat);
    flap.position.set(0, 0.32, d / 2 + 0.01);
    mGroup.add(flap);

    // Coin slot & refund cup on right side
    const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.04), lowerPanelMat);
    coinSlot.position.set(0.36, 0.95, d / 2 + 0.01);
    mGroup.add(coinSlot);

    // 4. Attached Empty Can & Bottle Recycling Bin
    if (hasRecycleBin) {
      const binGroup = new THREE.Group();
      const binMat = new THREE.MeshToonMaterial({
        color: 0x475569,
        gradientMap: materials.wallStuccoWhite.gradientMap
      });
      const binBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), binMat);
      binBody.position.y = 0.55;
      binGroup.add(binBody);

      // Dual circular throw-in ports for cans & plastic bottles
      const portMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      for (let px of [-0.1, 0.1]) {
        const port = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), portMat);
        port.position.set(px, 0.88, 0.215);
        binGroup.add(port);
      }

      binGroup.position.set(w / 2 + 0.28, 0, 0);
      mGroup.add(binGroup);
    }

    // 5. Plastic Drink Crate stacked nearby
    const crateMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.38), crateMat);
    crate.position.set(-w / 2 - 0.28, 0.16, 0.1);
    mGroup.add(crate);

    mGroup.position.set(x, y, z);
    mGroup.rotation.y = rotY;
    this.group.add(mGroup);
  }
}
