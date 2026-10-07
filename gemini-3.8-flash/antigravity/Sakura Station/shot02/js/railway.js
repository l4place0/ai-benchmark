/**
 * railway.js - Complete Double Track Railway & Overhead Catenary System (铁轨与铁路设施)
 * Double tracks, ballast gravel, steel rails with shiny top / rusted sides,
 * catenary steel poles, overhead wires, illuminated signals, relay cabinets, and weeds.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';

export class Railway {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.initBallast();
    this.initTracks();
    this.initCatenarySystem();
    this.initRailwaySignalsAndCabinets();
    this.initTrackWeeds();

    this.scene.add(this.group);
  }

  initBallast() {
    // Raised crushed gravel ballast bed (道床) stretching across the town
    const bedGeo = new THREE.BoxGeometry(160, 0.45, 12);
    const bedMat = materials.ballastGravel;
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, 0.15, -25.5);
    bed.receiveShadow = true;
    this.group.add(bed);

    // Ballast slope edges
    const slopeMat = materials.sleeperWood;
    const slope = new THREE.Mesh(new THREE.BoxGeometry(160, 0.25, 14), slopeMat);
    slope.position.set(0, 0.05, -25.5);
    this.group.add(slope);
  }

  initTracks() {
    // Double tracks: Track 1 at z = -23.2, Track 2 at z = -27.5
    const trackZPositions = [-23.2, -27.5];
    const railLength = 160;
    const gauge = 1.067; // Japanese 3ft 6in Cape gauge standard

    trackZPositions.forEach(z => {
      // 1. Sleepers / Ties (枕木)
      const sleeperGeo = new THREE.BoxGeometry(0.24, 0.14, 2.1);
      const sleeperMat = materials.sleeperWood;

      // Instanced or repeated sleepers every 0.65m
      for (let x = -80; x <= 80; x += 0.65) {
        // Skip crossing area (road passes through x: -1 to 5)
        if (x >= -2 && x <= 6) continue;

        const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
        sleeper.position.set(x, 0.38, z);
        sleeper.receiveShadow = true;
        this.group.add(sleeper);
      }

      // 2. Shiny Steel Rails (Left and Right rail)
      [-gauge / 2, gauge / 2].forEach(offset => {
        // Rail body (rusted dark sides)
        const railBody = new THREE.Mesh(
          new THREE.BoxGeometry(railLength, 0.15, 0.06),
          materials.railSideRust
        );
        railBody.position.set(0, 0.46, z + offset);
        this.group.add(railBody);

        // Rail top surface (polished shiny steel reflection)
        const railTop = new THREE.Mesh(
          new THREE.BoxGeometry(railLength, 0.02, 0.045),
          materials.railSteel
        );
        railTop.position.set(0, 0.54, z + offset);
        this.group.add(railTop);
      });
    });
  }

  initCatenarySystem() {
    // Overhead catenary electrification masts (架空接触网电杆)
    const poleSpacing = 28;
    const poleHeight = 8.5;
    const catenaryGroup = new THREE.Group();

    for (let x = -75; x <= 75; x += poleSpacing) {
      // Skip right inside the crossing roadway
      if (x > -3 && x < 5) continue;

      // Steel Lattice Mast
      const mast = createOutlinedMesh(
        new THREE.CylinderGeometry(0.12, 0.16, poleHeight, 8),
        materials.catenarySteel,
        0.02
      );
      mast.position.set(x, poleHeight / 2, -29.8);
      catenaryGroup.add(mast);

      // Horizontal Overhead Crossbeam spanning both tracks
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.18, 9.2),
        materials.catenarySteel
      );
      beam.position.set(x, poleHeight - 0.8, -25.4);
      catenaryGroup.add(beam);

      // Porcelain Insulators (白瓷绝缘子)
      for (let z of [-23.2, -27.5]) {
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8),
          materials.wallStuccoWhite
        );
        ins.position.set(x, poleHeight - 1.05, z);
        catenaryGroup.add(ins);
      }
    }

    // Overhead Wires (Messenger & Contact wires stretching across the scene)
    const wireMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1.5 });

    [-23.2, -27.5].forEach(z => {
      // Contact wire (horizontal)
      const contactGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-80, poleHeight - 1.4, z),
        new THREE.Vector3(80, poleHeight - 1.4, z)
      ]);
      const contactLine = new THREE.Line(contactGeo, wireMat);
      catenaryGroup.add(contactLine);

      // Messenger wire (catenary sagging curve)
      const curvePoints = [];
      for (let x = -80; x <= 80; x += 4) {
        // Slight catenary sag between poles
        const sag = Math.sin((x / 28) * Math.PI) * 0.22;
        curvePoints.push(new THREE.Vector3(x, poleHeight - 0.7 - Math.abs(sag), z));
      }
      const messengerGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const messengerLine = new THREE.Line(messengerGeo, wireMat);
      catenaryGroup.add(messengerLine);
    });

    this.group.add(catenaryGroup);
  }

  initRailwaySignalsAndCabinets() {
    // 1. Glowing Railway Signal Post (铁路信号机)
    const signalGroup = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5), materials.catenarySteel);
    mast.position.y = 2.25;
    signalGroup.add(mast);

    // Signal Head with Sun Hoods
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.2), materials.crossingArmBlack);
    head.position.set(0, 4.0, 0);
    signalGroup.add(head);

    // Glowing Green Lens (Clear track)
    const greenLens = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), materials.trafficGreenGlow);
    greenLens.position.set(0, 4.18, 0.11);
    signalGroup.add(greenLens);

    // Glowing Red Lens
    const redLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x450a0a }) // Unlit / dark red
    );
    redLens.position.set(0, 3.82, 0.11);
    signalGroup.add(redLens);

    signalGroup.position.set(-18, 0.4, -21.4);
    this.group.add(signalGroup);

    // 2. Trackside Electrical Equipment Cabinet (轨旁配电箱)
    const cabinet = createOutlinedMesh(
      new THREE.BoxGeometry(1.2, 1.4, 0.65),
      materials.concreteLight,
      0.02
    );
    cabinet.position.set(-15, 1.0, -21.2);
    this.group.add(cabinet);

    // 3. Track Boundary Fence (Wire Mesh / Steel Railing)
    const fenceMat = materials.catenarySteel;
    for (let x = -60; x <= 60; x += 3.5) {
      if (x > -3 && x < 6) continue; // Leave crossing gap
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4), fenceMat);
      post.position.set(x, 0.7, -19.5);
      this.group.add(post);
    }
    const railsTop = new THREE.Mesh(new THREE.BoxGeometry(120, 0.04, 0.04), fenceMat);
    railsTop.position.set(0, 1.35, -19.5);
    this.group.add(railsTop);
  }

  initTrackWeeds() {
    // Wild weeds, dandelions, and grass tufts sprouting between ballast rocks
    const weedMat = materials.grassGreen;
    const dandyMat = materials.flowerTulipYellow;

    for (let i = 0; i < 45; i++) {
      const x = -50 + Math.random() * 100;
      if (x > -3 && x < 6) continue;
      const z = -25.5 + (Math.random() - 0.5) * 6;

      const clump = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 5), weedMat);
      clump.position.set(x, 0.45, z);
      clump.rotation.y = Math.random() * Math.PI;

      // Small yellow dandelion flower
      if (Math.random() > 0.6) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), dandyMat);
        flower.position.y = 0.16;
        clump.add(flower);
      }

      this.group.add(clump);
    }
  }
}
