/**
 * station.js - Sakuragaoka Station Building & Platform (车站主体与站台)
 * Complete ground suburban station with ticket hall, IC gates, staff window,
 * posters, platform shelter canopy, station nameboards, benches, and safety lines.
 */
import * as THREE from 'three';
import { materials, createOutlinedMesh } from './materials.js';
import { getStationSignTexture, getRoadMarkingTexture } from './textures.js';

export class Station {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.initStationBuilding();
    this.initPlatform();

    this.scene.add(this.group);
  }

  initStationBuilding() {
    const sGroup = new THREE.Group();

    // 1. Main Station House (车站本屋 - 1.5 stories)
    const buildingBody = createOutlinedMesh(
      new THREE.BoxGeometry(14.0, 5.2, 7.5),
      materials.wallStuccoCream
    );
    buildingBody.position.set(0, 2.6, 0);
    sGroup.add(buildingBody);

    // Traditional Gabled Roof with Ridge Ornaments
    const roof = createOutlinedMesh(
      new THREE.ConeGeometry(9.8, 2.5, 4),
      materials.roofTileDarkBlue
    );
    roof.position.set(0, 6.2, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.45, 1, 0.95);
    sGroup.add(roof);

    // Station Name Plaque ("桜ヶ丘駅 / SAKURAGAOKA STATION")
    const signTex = getStationSignTexture('building_name');
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const namePlaque = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2), signMat);
    namePlaque.position.set(0, 4.4, 3.8);
    sGroup.add(namePlaque);

    // Wide Entrance Opening with Entrance Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.15, 1.8), materials.woodDark);
    canopy.position.set(0, 3.5, 4.4);
    sGroup.add(canopy);

    // Inside Ticket Hall Opening
    const doorCutout = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 3.0, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x1f2937 })
    );
    doorCutout.position.set(0, 1.5, 3.75);
    sGroup.add(doorCutout);

    // Yellow Tactile Entrance Guide Line
    const tactileTex = getRoadMarkingTexture('tactile');
    const tactileMat = new THREE.MeshToonMaterial({ map: tactileTex });
    const tactileGuide = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 4.0), tactileMat);
    tactileGuide.rotation.x = -Math.PI / 2;
    tactileGuide.position.set(0, 0.05, 4.2);
    sGroup.add(tactileGuide);

    // 2. Ticket Vending Machines (自动售票机)
    for (let i = 0; i < 2; i++) {
      const ticketMachine = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.6, 0.5),
        new THREE.MeshToonMaterial({ color: 0x64748b })
      );
      ticketMachine.position.set(-3.8 + i * 1.0, 0.8, 3.5);
      // Glowing green touch screen
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      screen.position.set(0, 0.2, 0.26);
      ticketMachine.add(screen);
      sGroup.add(ticketMachine);
    }

    // 3. Automatic IC Card Ticket Gates (自动检票口 / 改札機)
    for (let i = 0; i < 3; i++) {
      const gate = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.85, 1.6),
        materials.concreteLight
      );
      gate.position.set(-1.2 + i * 1.2, 0.425, 2.6);
      // Glowing blue IC sensor pad
      const icSensor = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.25),
        new THREE.MeshBasicMaterial({ color: 0x0ea5e9 })
      );
      icSensor.rotation.x = -Math.PI / 2;
      icSensor.position.set(0, 0.43, 0.3);
      gate.add(icSensor);
      sGroup.add(gate);
    }

    // 4. Station Master Attendant Window (駅務室 / 有人改札)
    const staffWindow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.1), materials.woodWarm);
    staffWindow.position.set(3.8, 1.6, 3.6);
    sGroup.add(staffWindow);

    // 5. Tourism & Safety Posters on Station Wall
    const posterTex = getStationSignTexture('poster_sakura');
    const posterMat = new THREE.MeshBasicMaterial({ map: posterTex });
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), posterMat);
    poster.position.set(5.2, 2.5, 3.78);
    sGroup.add(poster);

    // Timetable on wall
    const timeTableTex = getStationSignTexture('timetable');
    const timeTableMat = new THREE.MeshBasicMaterial({ map: timeTableTex });
    const timetable = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), timeTableMat);
    timetable.position.set(-5.4, 2.5, 3.78);
    sGroup.add(timetable);

    // Wall Clock
    const clock = this.createClock();
    clock.position.set(0, 4.2, 4.6);
    sGroup.add(clock);

    // Position Station Building at z = -14.5
    sGroup.position.set(-1.0, 0, -14.5);
    this.group.add(sGroup);
  }

  initPlatform() {
    const pGroup = new THREE.Group();

    // 1. Concrete Platform (Raised +0.75m above track ballast)
    const platLength = 54;
    const platWidth = 4.2;
    const platHeight = 0.75;

    const platMesh = new THREE.Mesh(
      new THREE.BoxGeometry(platLength, platHeight, platWidth),
      materials.concreteLight
    );
    platMesh.position.set(0, platHeight / 2, 0);
    platMesh.receiveShadow = true;
    pGroup.add(platMesh);

    // Tactile Warning Line & White Safety Line along Platform Edge
    const tactileTex = getRoadMarkingTexture('tactile');
    const tactileEdgeMat = new THREE.MeshToonMaterial({ map: tactileTex });
    const tactileEdge = new THREE.Mesh(
      new THREE.PlaneGeometry(platLength, 0.35),
      tactileEdgeMat
    );
    tactileEdge.rotation.x = -Math.PI / 2;
    tactileEdge.position.set(0, platHeight + 0.01, -platWidth / 2 + 0.35);
    pGroup.add(tactileEdge);

    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const whiteLine = new THREE.Mesh(
      new THREE.PlaneGeometry(platLength, 0.12),
      whiteLineMat
    );
    whiteLine.rotation.x = -Math.PI / 2;
    whiteLine.position.set(0, platHeight + 0.012, -platWidth / 2 + 0.7);
    pGroup.add(whiteLine);

    // 2. Platform Waiting Shelter Canopy (月台雨棚)
    this.createPlatformShelter(pGroup, platLength, platHeight);

    // 3. Platform Signboards ("桜ヶ丘 / SAKURAGAOKA")
    const signTex = getStationSignTexture('main_board');
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });

    const sign1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), signMat);
    sign1.position.set(-8, platHeight + 2.3, 0);
    pGroup.add(sign1);

    const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), signMat);
    sign2.position.set(12, platHeight + 2.3, 0);
    pGroup.add(sign2);

    // 4. Platform Waiting Benches (Green wooden slats)
    for (let x = -16; x <= 16; x += 14) {
      const bench = this.createPlatformBench();
      bench.position.set(x, platHeight, 0.4);
      pGroup.add(bench);
    }

    // 5. Platform End Safety Barrier & "No Entry" Sign
    const endBarrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.1, platWidth),
      materials.catenarySteel
    );
    endBarrier.position.set(platLength / 2 - 0.2, platHeight + 0.55, 0);
    pGroup.add(endBarrier);

    // Position Platform at z = -20.2 (adjacent to Track 1 at z = -22.8)
    pGroup.position.set(0, 0, -20.2);
    this.group.add(pGroup);
  }

  createPlatformShelter(parent, length, platHeight) {
    const shelterLength = 32;
    const shelterWidth = 3.6;
    const shelterGroup = new THREE.Group();

    // Steel Pillars
    for (let x = -shelterLength / 2 + 2; x <= shelterLength / 2 - 2; x += 7) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 2.7, 0.15),
        materials.catenarySteel
      );
      col.position.set(x, 1.35, 0);
      shelterGroup.add(col);

      // Cantilever beam
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.15, shelterWidth - 0.2),
        materials.catenarySteel
      );
      beam.position.set(x, 2.7, 0);
      shelterGroup.add(beam);
    }

    // Corrugated Translucent Roof Canopy (Anime Blue-Gray)
    const roofMat = new THREE.MeshToonMaterial({
      color: 0x94a3b8,
      gradientMap: materials.wallStuccoWhite.gradientMap
    });
    const canopyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(shelterLength, 0.08, shelterWidth),
      roofMat
    );
    canopyMesh.position.set(0, 2.8, 0);
    shelterGroup.add(canopyMesh);

    // Hanging Fluorescent Tube Lights
    for (let x = -10; x <= 10; x += 10) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.08, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      lamp.position.set(x, 2.65, 0);
      shelterGroup.add(lamp);
    }

    shelterGroup.position.y = platHeight;
    parent.add(shelterGroup);
  }

  createPlatformBench() {
    const benchGroup = new THREE.Group();
    const benchMat = materials.woodDark;

    // Seat slats
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.45), benchMat);
    seat.position.y = 0.45;
    benchGroup.add(seat);

    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.06), benchMat);
    back.position.set(0, 0.72, 0.2);
    benchGroup.add(back);

    // Metal legs
    for (let x of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), materials.catenarySteel);
      leg.position.set(x, 0.225, 0);
      benchGroup.add(leg);
    }

    return benchGroup;
  }

  createClock() {
    const clockGroup = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 24), materials.catenarySteel);
    rim.rotation.x = Math.PI / 2;
    clockGroup.add(rim);

    const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    face.position.z = 0.045;
    clockGroup.add(face);

    // Clock Hands (4:00 PM)
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.01), new THREE.MeshBasicMaterial({ color: 0x111827 }));
    hourHand.position.set(0.06, -0.06, 0.05);
    hourHand.rotation.z = -Math.PI / 3;
    clockGroup.add(hourHand);

    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.01), new THREE.MeshBasicMaterial({ color: 0x111827 }));
    minHand.position.set(0, 0.12, 0.055);
    clockGroup.add(minHand);

    return clockGroup;
  }
}
