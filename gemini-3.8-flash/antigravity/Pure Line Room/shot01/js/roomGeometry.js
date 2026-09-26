// Pure Line Room - Procedural 3D Vector Line Art Geometry & Interactive Environment
// Ligne Claire / Architectural Sketch / Manga Background Aesthetic
import * as THREE from './libs/three.module.js';

/**
 * Helper: Create a Vector Line Art mesh pair (occluding backing mesh + silhouette/crease lines)
 * Uses polygonOffset to guarantee clean, crisp lines without z-fighting artifacts.
 */
function createVectorMesh(geometry, meshMat, lineMat, thresholdAngle = 24) {
  const group = new THREE.Group();

  // 1. Occluding backing mesh (solid fill matching room theme)
  const mesh = new THREE.Mesh(geometry, meshMat);
  group.add(mesh);

  // 2. Crease and silhouette line segments
  const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const lines = new THREE.LineSegments(edges, lineMat);
  group.add(lines);

  return { group, mesh, lines, geometry, edges };
}

/**
 * Helper: Create a polyline from an array of Vector3 points
 */
function createLine(points, lineMat) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geom, lineMat);
}

/**
 * Helper: Create independent line segments from an array of Vector3 point pairs
 */
function createLineSegments(points, lineMat) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geom, lineMat);
}

/**
 * Helper: Create a circle line on XZ, XY, or YZ plane
 */
function createCircleLine(radius, segments = 32, lineMat, plane = 'xz') {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'xz') pts.push(new THREE.Vector3(c, 0, s));
    else if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
    else pts.push(new THREE.Vector3(0, c, s));
  }
  return createLine(pts, lineMat);
}

/**
 * Helper: Create an arc line on XY plane
 */
function createArcLine(radius, startAngle, endAngle, segments = 16, lineMat, plane = 'xy') {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const theta = startAngle + (i / segments) * (endAngle - startAngle);
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'xy') pts.push(new THREE.Vector3(c, s, 0));
    else if (plane === 'xz') pts.push(new THREE.Vector3(c, 0, s));
    else pts.push(new THREE.Vector3(0, c, s));
  }
  return createLine(pts, lineMat);
}

/**
 * Helper: Create a 2D rectangle line outline
 */
function createRectOutline(width, height, lineMat, plane = 'xy') {
  const hw = width / 2;
  const hh = height / 2;
  let pts;
  if (plane === 'xy') {
    pts = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0)
    ];
  } else if (plane === 'xz') {
    pts = [
      new THREE.Vector3(-hw, 0, -hh),
      new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(hw, 0, hh),
      new THREE.Vector3(-hw, 0, hh),
      new THREE.Vector3(-hw, 0, -hh)
    ];
  } else {
    pts = [
      new THREE.Vector3(0, -hw, -hh),
      new THREE.Vector3(0, hw, -hh),
      new THREE.Vector3(0, hw, hh),
      new THREE.Vector3(0, -hw, hh),
      new THREE.Vector3(0, -hw, -hh)
    ];
  }
  return createLine(pts, lineMat);
}

/**
 * Setup material palette for Day and Night architectural vector styling
 */
function createMaterials() {
  // Day Palette defaults
  const dayBg = 0xf6f7f9;
  const dayLine = 0x22262e;
  const daySubtle = 0x64748b;
  const dayAccent = 0x2563eb;
  const dayBeam = 0xfef08a;

  // Solid backing mesh material (matches background color, pushed back by polygonOffset)
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: dayBg,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide
  });

  // Main silhouette and crease line material
  const lineMaterial = new THREE.LineBasicMaterial({
    color: dayLine,
    linewidth: 1
  });

  // Secondary structural / texture line material (for wood grain, tick marks, grooves)
  const subtleLineMaterial = new THREE.LineBasicMaterial({
    color: daySubtle,
    linewidth: 1
  });

  // Accent interactive line material
  const accentLineMaterial = new THREE.LineBasicMaterial({
    color: dayAccent,
    linewidth: 1
  });

  // Lamp volumetric light cone translucent material
  const lampBeamMaterial = new THREE.MeshBasicMaterial({
    color: dayBeam,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  // Coffee liquid surface material
  const coffeeMaterial = new THREE.MeshBasicMaterial({
    color: 0xc27838,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  return {
    bgMaterial,
    lineMaterial,
    subtleLineMaterial,
    accentLineMaterial,
    lampBeamMaterial,
    coffeeMaterial,
    isNight: false,
    updateTheme(night) {
      this.isNight = night;
      if (night) {
        this.bgMaterial.color.setHex(0x13161c);
        this.lineMaterial.color.setHex(0xe2e8f0);
        this.subtleLineMaterial.color.setHex(0x94a3b8);
        this.accentLineMaterial.color.setHex(0x38bdf8);
        this.lampBeamMaterial.color.setHex(0x38bdf8);
        this.lampBeamMaterial.opacity = 0.22;
        this.coffeeMaterial.color.setHex(0x9a5b28);
      } else {
        this.bgMaterial.color.setHex(0xf6f7f9);
        this.lineMaterial.color.setHex(0x22262e);
        this.subtleLineMaterial.color.setHex(0x64748b);
        this.accentLineMaterial.color.setHex(0x2563eb);
        this.lampBeamMaterial.color.setHex(0xfef08a);
        this.lampBeamMaterial.opacity = 0.14;
        this.coffeeMaterial.color.setHex(0xc27838);
      }
    }
  };
}

/**
 * Register an interactive item with user data and hit-test target mesh
 */
function tagInteractive(targetMesh, parentGroup, metadata, interactiveTargets) {
  const data = {
    id: metadata.id || '00',
    code: metadata.code || 'ITEM',
    name: metadata.name || 'Room Item',
    hint: metadata.hint || '点击互动',
    category: metadata.category || '室内陈设',
    interactive: true,
    parentGroup: parentGroup,
    targetMesh: targetMesh,
    onClick: metadata.onClick || null
  };

  targetMesh.userData = data;
  parentGroup.userData = data;
  interactiveTargets.push(targetMesh);
  return data;
}

// =========================================================================
// PROCEDURAL ARCHITECTURE & 20 REQUIRED ROOM ITEMS
// =========================================================================

/**
 * 0. Room Shell (Floor, Left Wall, Back Wall, Cornice, Parquet Grid)
 */
function buildArchitecture(root, mats) {
  const group = new THREE.Group();
  group.name = 'Architecture_Shell';

  // Floor (7.0m x 7.0m x 0.2m)
  const floorGeom = new THREE.BoxGeometry(7.0, 0.2, 7.0);
  const floor = createVectorMesh(floorGeom, mats.bgMaterial, mats.lineMaterial);
  floor.group.position.set(0, -0.1, 0);
  group.add(floor.group);

  // Parquet wood plank line art on floor surface
  const floorLines = [];
  const plankW = 0.28;
  const plankL = 0.875;
  for (let x = -3.5 + plankW; x < 3.5; x += plankW) {
    floorLines.push(new THREE.Vector3(x, 0.001, -3.5), new THREE.Vector3(x, 0.001, 3.5));
  }
  let row = 0;
  for (let z = -3.5; z <= 3.5; z += plankL) {
    row++;
    const xOffset = (row % 2) * (plankW * 0.5);
    for (let x = -3.5 + xOffset; x <= 3.5; x += plankW * 2) {
      floorLines.push(new THREE.Vector3(x, 0.001, z), new THREE.Vector3(Math.min(3.5, x + plankW), 0.001, z));
    }
  }
  const parquetSegments = createLineSegments(floorLines, mats.subtleLineMaterial);
  group.add(parquetSegments);

  // Left Wall (x = -3.5, height = 3.6m, depth = 7.0m)
  const leftWallGeom = new THREE.BoxGeometry(0.2, 3.6, 7.0);
  const leftWall = createVectorMesh(leftWallGeom, mats.bgMaterial, mats.lineMaterial);
  leftWall.group.position.set(-3.5, 1.8, 0);
  group.add(leftWall.group);

  // Back Wall (z = -3.5, height = 3.6m, width = 7.0m)
  const backWallGeom = new THREE.BoxGeometry(7.0, 3.6, 0.2);
  const backWall = createVectorMesh(backWallGeom, mats.bgMaterial, mats.lineMaterial);
  backWall.group.position.set(0, 1.8, -3.5);
  group.add(backWall.group);

  // Baseboards (Skirting)
  const baseboardLeft = createVectorMesh(new THREE.BoxGeometry(0.04, 0.12, 7.0), mats.bgMaterial, mats.lineMaterial);
  baseboardLeft.group.position.set(-3.38, 0.06, 0);
  group.add(baseboardLeft.group);

  const baseboardBack = createVectorMesh(new THREE.BoxGeometry(7.0, 0.12, 0.04), mats.bgMaterial, mats.lineMaterial);
  baseboardBack.group.position.set(0, 0.06, -3.38);
  group.add(baseboardBack.group);

  // Ceiling Perimeter Beams & Crown Moldings
  const crownLeft = createVectorMesh(new THREE.BoxGeometry(0.12, 0.12, 7.0), mats.bgMaterial, mats.lineMaterial);
  crownLeft.group.position.set(-3.34, 3.54, 0);
  group.add(crownLeft.group);

  const crownBack = createVectorMesh(new THREE.BoxGeometry(7.0, 0.12, 0.12), mats.bgMaterial, mats.lineMaterial);
  crownBack.group.position.set(0, 3.54, -3.34);
  group.add(crownBack.group);

  root.add(group);
  return group;
}

/**
 * 1. Door (Frame, Panel, Handle, Hinges, Opens smoothly on Hinge)
 */
function buildDoor(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_01_Door';
  group.position.set(-3.38, 0, 1.7);

  // Door Frame Casing (Jambs & Header)
  const leftJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 2.3, 0.06), mats.bgMaterial, mats.lineMaterial);
  leftJamb.group.position.set(0, 1.15, -0.48);
  group.add(leftJamb.group);

  const rightJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 2.3, 0.06), mats.bgMaterial, mats.lineMaterial);
  rightJamb.group.position.set(0, 1.15, 0.48);
  group.add(rightJamb.group);

  const topJamb = createVectorMesh(new THREE.BoxGeometry(0.08, 0.08, 1.02), mats.bgMaterial, mats.lineMaterial);
  topJamb.group.position.set(0, 2.31, 0);
  group.add(topJamb.group);

  // Door Hinge Pivot (rotates around hinge edge)
  const hingePivot = new THREE.Group();
  hingePivot.position.set(0, 0, -0.45);
  group.add(hingePivot);

  // Door Leaf Panel (Width: 0.90m, Height: 2.22m, Depth: 0.045m)
  const panelGeom = new THREE.BoxGeometry(0.045, 2.22, 0.90);
  const doorPanel = createVectorMesh(panelGeom, mats.bgMaterial, mats.lineMaterial);
  doorPanel.group.position.set(0, 1.11, 0.45);
  hingePivot.add(doorPanel.group);

  // 4 Recessed Decorative Panels on Door
  const panelPositions = [
    { y: 1.62, h: 0.72 },
    { y: 0.62, h: 0.72 }
  ];
  panelPositions.forEach(pos => {
    // Upper and lower raised moldings
    const trim = createVectorMesh(new THREE.BoxGeometry(0.052, pos.h, 0.72), mats.bgMaterial, mats.subtleLineMaterial);
    trim.group.position.set(0, pos.y, 0.45);
    hingePivot.add(trim.group);

    const innerLine = createRectOutline(0.64, pos.h - 0.08, mats.lineMaterial, 'zy');
    innerLine.position.set(0.027, pos.y, 0.45);
    hingePivot.add(innerLine);
  });

  // Cylindrical Hinges (top and bottom)
  [-0.45].forEach(hz => {
    [0.35, 1.85].forEach(hy => {
      const hinge = createVectorMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12), mats.bgMaterial, mats.lineMaterial);
      hinge.group.position.set(0, hy, hz);
      group.add(hinge.group);
    });
  });

  // Door Handle & Lock Plate (Brass Lever on both sides)
  const lockPlate = createVectorMesh(new THREE.BoxGeometry(0.065, 0.22, 0.06), mats.bgMaterial, mats.lineMaterial);
  lockPlate.group.position.set(0, 1.05, 0.82);
  hingePivot.add(lockPlate.group);

  // Lever Handle (L-shaped)
  const handleStem = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 12), mats.bgMaterial, mats.lineMaterial);
  handleStem.group.rotation.z = Math.PI / 2;
  handleStem.group.position.set(0.05, 1.08, 0.82);
  hingePivot.add(handleStem.group);

  const handleLever = createVectorMesh(new THREE.BoxGeometry(0.012, 0.016, 0.12), mats.bgMaterial, mats.lineMaterial);
  handleLever.group.position.set(0.08, 1.08, 0.76);
  hingePivot.add(handleLever.group);

  // Keyhole line detail
  const keyholeLine = createLine([
    new THREE.Vector3(0.034, 1.01, 0.82),
    new THREE.Vector3(0.034, 0.98, 0.82)
  ], mats.lineMaterial);
  hingePivot.add(keyholeLine);

  // Interactive state
  const doorState = {
    isOpen: false,
    currentAngle: 0,
    targetAngle: 0,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetAngle = this.isOpen ? -Math.PI * 0.45 : 0;
    }
  };

  tagInteractive(doorPanel.mesh, group, {
    id: '01',
    code: 'DOOR',
    name: '平开木门 / Wooden Door',
    hint: '点击推拉开关木门，感受线稿空间的虚实开合',
    category: '建筑构件 / Architectural',
    onClick: () => doorState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, hingePivot, doorState };
}

/**
 * 2. Window (Frame, Mullions, Sill, Outdoor Landscape Line Art)
 */
function buildWindow(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_02_Window';
  group.position.set(-0.7, 2.05, -3.42);

  const winW = 2.2;
  const winH = 1.6;
  const winD = 0.12;

  // Window Outer Frame
  const outerCasing = createVectorMesh(new THREE.BoxGeometry(winW + 0.16, winH + 0.16, winD), mats.bgMaterial, mats.lineMaterial);
  group.add(outerCasing.group);

  // Window Sill (Projecting ledge below)
  const sill = createVectorMesh(new THREE.BoxGeometry(winW + 0.28, 0.07, 0.24), mats.bgMaterial, mats.lineMaterial);
  sill.group.position.set(0, -(winH / 2 + 0.035), 0.06);
  group.add(sill.group);

  // Window Sky Backing Plane (Behind landscape)
  const windowBacking = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), mats.bgMaterial);
  windowBacking.position.set(0, 0, -0.055);
  group.add(windowBacking);

  // Mullions (Cross Divider: 1 vertical center, 1 horizontal transom at upper 1/3)
  const vertMullion = createVectorMesh(new THREE.BoxGeometry(0.04, winH, 0.05), mats.bgMaterial, mats.lineMaterial);
  group.add(vertMullion.group);

  const horizMullion = createVectorMesh(new THREE.BoxGeometry(winW, 0.04, 0.05), mats.bgMaterial, mats.lineMaterial);
  horizMullion.group.position.set(0, winH * 0.18, 0);
  group.add(horizMullion.group);

  // Vector Outdoor Landscape Lines (Drawn directly in front of sky backing plane)
  const landscapeGroup = new THREE.Group();
  landscapeGroup.position.set(0, 0, -0.04);

  // Horizon Line
  landscapeGroup.add(createLine([
    new THREE.Vector3(-winW / 2 + 0.05, -0.2, 0),
    new THREE.Vector3(winW / 2 - 0.05, -0.2, 0)
  ], mats.lineMaterial));

  // Mountain Ridge 1 (Distant Peaks)
  const mountain1Pts = [
    new THREE.Vector3(-1.1, -0.2, 0),
    new THREE.Vector3(-0.85, 0.18, 0),
    new THREE.Vector3(-0.6, -0.05, 0),
    new THREE.Vector3(-0.35, 0.32, 0),
    new THREE.Vector3(-0.1, 0.02, 0),
    new THREE.Vector3(0.2, 0.28, 0),
    new THREE.Vector3(0.55, -0.08, 0),
    new THREE.Vector3(0.85, 0.22, 0),
    new THREE.Vector3(1.1, -0.2, 0)
  ];
  landscapeGroup.add(createLine(mountain1Pts, mats.lineMaterial));

  // Mountain Ridge 2 (Foreground Rolling Hills)
  const mountain2Pts = [
    new THREE.Vector3(-1.1, -0.35, 0),
    new THREE.Vector3(-0.7, -0.08, 0),
    new THREE.Vector3(-0.2, -0.22, 0),
    new THREE.Vector3(0.35, -0.05, 0),
    new THREE.Vector3(0.75, -0.25, 0),
    new THREE.Vector3(1.1, -0.15, 0)
  ];
  landscapeGroup.add(createLine(mountain2Pts, mats.subtleLineMaterial));

  // Sun / Moon with Radiating Aura Rings
  const sunPos = new THREE.Vector3(0.58, 0.52, 0);
  const sunCircle = createCircleLine(0.12, 24, mats.lineMaterial, 'xy');
  sunCircle.position.copy(sunPos);
  landscapeGroup.add(sunCircle);

  const sunAura = createCircleLine(0.18, 24, mats.subtleLineMaterial, 'xy');
  sunAura.position.copy(sunPos);
  landscapeGroup.add(sunAura);

  // Stylized Clouds (Concentric curve arcs)
  [
    { x: -0.65, y: 0.55, r: 0.14 },
    { x: -0.45, y: 0.58, r: 0.18 },
    { x: -0.25, y: 0.53, r: 0.13 },
    { x: 0.1, y: 0.46, r: 0.12 }
  ].forEach(c => {
    const cloudArc = createArcLine(c.r, 0, Math.PI, 16, mats.subtleLineMaterial, 'xy');
    cloudArc.position.set(c.x, c.y, 0);
    landscapeGroup.add(cloudArc);
  });

  // Flying Birds (V-shapes)
  [
    { x: -0.1, y: 0.62, s: 0.035 },
    { x: 0.06, y: 0.68, s: 0.03 },
    { x: 0.18, y: 0.61, s: 0.025 }
  ].forEach(b => {
    const bird = createLine([
      new THREE.Vector3(b.x - b.s, b.y - b.s * 0.6, 0),
      new THREE.Vector3(b.x, b.y, 0),
      new THREE.Vector3(b.x + b.s, b.y - b.s * 0.6, 0)
    ], mats.lineMaterial);
    landscapeGroup.add(bird);
  });

  group.add(landscapeGroup);

  tagInteractive(sill.mesh, group, {
    id: '02',
    code: 'WINDOW',
    name: '建筑景观窗 / Architectural Window',
    hint: '点击远眺窗外群山、日月与飞鸟的矢量全景',
    category: '建筑构件 / Architectural'
  }, interactiveTargets);

  root.add(group);
  return { group, landscapeGroup };
}

/**
 * 3. Blinds (Slats Array, Top Header, Pull Cords, Tilt/Lift Capability)
 */
function buildBlinds(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_03_Blinds';
  group.position.set(-0.7, 2.75, -3.34);

  const blindsW = 2.12;
  const slatCount = 20;
  const slatH = 0.055;
  const dropLength = 1.30;

  // Top Valance / Headrail
  const headrail = createVectorMesh(new THREE.BoxGeometry(blindsW + 0.04, 0.06, 0.07), mats.bgMaterial, mats.lineMaterial);
  group.add(headrail.group);

  // Slats Group & Pivot Array
  const slatsContainer = new THREE.Group();
  group.add(slatsContainer);

  const slatGroups = [];
  for (let i = 0; i < slatCount; i++) {
    const slatPivot = new THREE.Group();
    const yPos = -0.06 - (i / (slatCount - 1)) * dropLength;
    slatPivot.position.set(0, yPos, 0);

    const slatGeom = new THREE.BoxGeometry(blindsW, 0.003, slatH);
    const slat = createVectorMesh(slatGeom, mats.bgMaterial, mats.lineMaterial);
    slatPivot.add(slat.group);

    slatsContainer.add(slatPivot);
    slatGroups.push({ pivot: slatPivot, defaultY: yPos });
  }

  // Vertical Braided Ladder Cords (3 cord pairs: left, center, right)
  const cordXPositions = [-blindsW * 0.38, 0, blindsW * 0.38];
  const cordLines = [];
  cordXPositions.forEach(x => {
    // Front and back cord strands
    cordLines.push(new THREE.Vector3(x, 0, 0.026), new THREE.Vector3(x, -dropLength - 0.08, 0.026));
    cordLines.push(new THREE.Vector3(x, 0, -0.026), new THREE.Vector3(x, -dropLength - 0.08, -0.026));
  });
  group.add(createLineSegments(cordLines, mats.subtleLineMaterial));

  // Pull Cord with Wooden Acorn on Right Side
  const pullCordPts = [
    new THREE.Vector3(blindsW * 0.48, 0, 0.03),
    new THREE.Vector3(blindsW * 0.48, -0.85, 0.03)
  ];
  group.add(createLine(pullCordPts, mats.lineMaterial));

  const acorn = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.006, 0.05, 10), mats.bgMaterial, mats.lineMaterial);
  acorn.group.position.set(blindsW * 0.48, -0.87, 0.03);
  group.add(acorn.group);

  // Bottom Weighted Rail
  const bottomRail = createVectorMesh(new THREE.BoxGeometry(blindsW, 0.03, 0.06), mats.bgMaterial, mats.lineMaterial);
  bottomRail.group.position.set(0, -dropLength - 0.08, 0);
  slatsContainer.add(bottomRail.group);

  // Interactive Blinds State
  const blindsState = {
    isOpen: true,
    tiltAngle: 1.15, // near horizontal
    targetAngle: 1.15,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetAngle = this.isOpen ? 1.15 : 0.08; // 0.08 = closed vertical
    }
  };

  tagInteractive(headrail.mesh, group, {
    id: '03',
    code: 'BLINDS',
    name: '百叶窗帘 / Venetian Blinds',
    hint: '点击拉绳调节百叶片倾角，控制室外采光入界',
    category: '室内陈设 / Furnishing',
    onClick: () => blindsState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, slatGroups, blindsState };
}

/**
 * 4. Desk (Desktop, Wooden Legs, Crossbars, Pen Holder with Pencils & Ruler)
 */
function buildDesk(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_04_Desk';
  group.position.set(-0.7, 0, -2.15);

  const deskW = 1.6;
  const deskD = 0.8;
  const deskH = 0.75;
  const topThick = 0.04;

  // Solid Desktop
  const topGeom = new THREE.BoxGeometry(deskW, topThick, deskD);
  const desktop = createVectorMesh(topGeom, mats.bgMaterial, mats.lineMaterial);
  desktop.group.position.set(0, deskH - topThick / 2, 0);
  group.add(desktop.group);

  // Under-desk Framing Beams
  const apronLongF = createVectorMesh(new THREE.BoxGeometry(deskW - 0.16, 0.06, 0.03), mats.bgMaterial, mats.lineMaterial);
  apronLongF.group.position.set(0, deskH - 0.06, deskD / 2 - 0.06);
  group.add(apronLongF.group);

  const apronLongB = createVectorMesh(new THREE.BoxGeometry(deskW - 0.16, 0.06, 0.03), mats.bgMaterial, mats.lineMaterial);
  apronLongB.group.position.set(0, deskH - 0.06, -deskD / 2 + 0.06);
  group.add(apronLongB.group);

  // 4 Tapered Wooden Legs
  const legH = deskH - topThick;
  const legOffsetX = deskW / 2 - 0.1;
  const legOffsetZ = deskD / 2 - 0.1;
  [
    { x: -legOffsetX, z: -legOffsetZ, rotZ: 0.04, rotX: -0.04 },
    { x: legOffsetX, z: -legOffsetZ, rotZ: -0.04, rotX: -0.04 },
    { x: -legOffsetX, z: legOffsetZ, rotZ: 0.04, rotX: 0.04 },
    { x: legOffsetX, z: legOffsetZ, rotZ: -0.04, rotX: 0.04 }
  ].forEach(legCfg => {
    const legGeom = new THREE.CylinderGeometry(0.024, 0.015, legH, 14);
    const leg = createVectorMesh(legGeom, mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(legCfg.x, legH / 2, legCfg.z);
    leg.group.rotation.z = legCfg.rotZ;
    leg.group.rotation.x = legCfg.rotX;
    group.add(leg.group);
  });

  // Crossbar Stretcher (Rear reinforcement)
  const crossbar = createVectorMesh(new THREE.BoxGeometry(deskW - 0.28, 0.025, 0.025), mats.bgMaterial, mats.lineMaterial);
  crossbar.group.position.set(0, 0.26, -legOffsetZ);
  group.add(crossbar.group);

  // Leather Desk Blotter / Pad with Double Stitch Lines
  const blotterW = 0.78;
  const blotterD = 0.48;
  const blotter = createVectorMesh(new THREE.BoxGeometry(blotterW, 0.005, blotterD), mats.bgMaterial, mats.lineMaterial);
  blotter.group.position.set(0.04, deskH + 0.003, 0.05);
  group.add(blotter.group);

  const stitchLine = createRectOutline(blotterW - 0.03, blotterD - 0.03, mats.subtleLineMaterial, 'xz');
  stitchLine.position.set(0.04, deskH + 0.006, 0.05);
  group.add(stitchLine);

  // Pen Holder Cup
  const penCup = createVectorMesh(new THREE.CylinderGeometry(0.042, 0.038, 0.11, 16), mats.bgMaterial, mats.lineMaterial);
  penCup.group.position.set(0.62, deskH + 0.055, -0.22);
  group.add(penCup.group);

  // Writing Pencils inside holder
  const pencils = [
    { x: 0.61, z: -0.21, rx: 0.15, rz: 0.1, len: 0.17 },
    { x: 0.63, z: -0.23, rx: -0.12, rz: -0.15, len: 0.15 },
    { x: 0.62, z: -0.24, rx: 0.08, rz: -0.12, len: 0.18 }
  ];
  pencils.forEach(p => {
    const shaft = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, p.len, 8), mats.bgMaterial, mats.lineMaterial);
    shaft.group.position.set(p.x, deskH + 0.07 + p.len / 2, p.z);
    shaft.group.rotation.x = p.rx;
    shaft.group.rotation.z = p.rz;
    group.add(shaft.group);

    // Sharpened cone tip
    const tip = createVectorMesh(new THREE.ConeGeometry(0.004, 0.016, 8), mats.bgMaterial, mats.lineMaterial);
    tip.group.position.set(p.x, deskH + 0.07 + p.len + 0.008, p.z);
    tip.group.rotation.x = p.rx;
    tip.group.rotation.z = p.rz;
    group.add(tip.group);
  });

  // Architectural 30-60-90 Drafting Triangle Ruler
  const rulerPts = [
    new THREE.Vector3(0.48, deskH + 0.005, -0.12),
    new THREE.Vector3(0.48, deskH + 0.005, 0.14),
    new THREE.Vector3(0.33, deskH + 0.005, -0.12),
    new THREE.Vector3(0.48, deskH + 0.005, -0.12)
  ];
  group.add(createLine(rulerPts, mats.lineMaterial));

  // Inner cutout for ruler
  const innerRulerPts = [
    new THREE.Vector3(0.46, deskH + 0.005, -0.09),
    new THREE.Vector3(0.46, deskH + 0.005, 0.08),
    new THREE.Vector3(0.36, deskH + 0.005, -0.09),
    new THREE.Vector3(0.46, deskH + 0.005, -0.09)
  ];
  group.add(createLine(innerRulerPts, mats.subtleLineMaterial));

  tagInteractive(desktop.mesh, group, {
    id: '04',
    code: 'DESK',
    name: '实木工作台 / Solid Wood Desk',
    hint: '极简北欧实木桌，配有皮质桌垫与精密绘图工具',
    category: '家具器物 / Furniture'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 5. Desk Lamp (Base, Dual Articulated Arms with Hinges, Shade, Bulb, Light Beam Cone Mesh)
 */
function buildDeskLamp(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_05_DeskLamp';
  group.position.set(-1.35, 0.75, -2.15);

  // Stepped Heavy Base
  const baseGeom = new THREE.CylinderGeometry(0.095, 0.105, 0.026, 24);
  const base = createVectorMesh(baseGeom, mats.bgMaterial, mats.lineMaterial);
  base.group.position.set(0, 0.013, 0);
  group.add(base.group);

  // Base Toggle Switch
  const toggle = createVectorMesh(new THREE.CylinderGeometry(0.007, 0.007, 0.016, 10), mats.bgMaterial, mats.lineMaterial);
  toggle.group.position.set(0.05, 0.028, 0);
  group.add(toggle.group);

  // Swivel Lower Joint
  const basePivot = new THREE.Group();
  basePivot.position.set(0, 0.026, 0);
  group.add(basePivot);

  // Lower Dual Articulated Rods (leaning towards center desk)
  const lowerArmLen = 0.36;
  const lowerArmPivot = new THREE.Group();
  lowerArmPivot.rotation.z = -0.45;
  lowerArmPivot.rotation.y = 0.25;
  basePivot.add(lowerArmPivot);

  [-0.012, 0.012].forEach(zOffset => {
    const rod = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, lowerArmLen, 10), mats.bgMaterial, mats.lineMaterial);
    rod.group.position.set(0, lowerArmLen / 2, zOffset);
    lowerArmPivot.add(rod.group);
  });

  // Lower Tension Spring Line Art
  const springPts = [];
  for (let s = 0; s <= 16; s++) {
    const sy = 0.08 + (s / 16) * 0.18;
    const sx = Math.sin(s * Math.PI) * 0.008;
    springPts.push(new THREE.Vector3(sx, sy, 0));
  }
  lowerArmPivot.add(createLine(springPts, mats.subtleLineMaterial));

  // Elbow Joint Hub with Wing Nut
  const elbowPivot = new THREE.Group();
  elbowPivot.position.set(0, lowerArmLen, 0);
  elbowPivot.rotation.z = 1.15; // Bends downward toward desk
  lowerArmPivot.add(elbowPivot);

  const elbowDisc = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.034, 16), mats.bgMaterial, mats.lineMaterial);
  elbowDisc.group.rotation.x = Math.PI / 2;
  elbowPivot.add(elbowDisc.group);

  // Upper Dual Arm Rods
  const upperArmLen = 0.34;
  [-0.012, 0.012].forEach(zOffset => {
    const rod = createVectorMesh(new THREE.CylinderGeometry(0.004, 0.004, upperArmLen, 10), mats.bgMaterial, mats.lineMaterial);
    rod.group.position.set(0, upperArmLen / 2, zOffset);
    elbowPivot.add(rod.group);
  });

  // Shade Pivot Joint
  const shadePivot = new THREE.Group();
  shadePivot.position.set(0, upperArmLen, 0);
  shadePivot.rotation.z = -0.70; // Directs shade downward to desk
  elbowPivot.add(shadePivot);

  // Bell / Cone Lamp Shade
  const shadeGeom = new THREE.CylinderGeometry(0.045, 0.11, 0.14, 20, 1, true);
  const shade = createVectorMesh(shadeGeom, mats.bgMaterial, mats.lineMaterial);
  shade.group.position.set(0, -0.07, 0);
  shadePivot.add(shade.group);

  // Shade Top Cap
  const shadeCap = createVectorMesh(new THREE.CylinderGeometry(0.025, 0.045, 0.03, 16), mats.bgMaterial, mats.lineMaterial);
  shadeCap.group.position.set(0, 0.01, 0);
  shadePivot.add(shadeCap.group);

  // Light Bulb inside shade
  const bulb = createVectorMesh(new THREE.SphereGeometry(0.032, 12, 12), mats.bgMaterial, mats.lineMaterial);
  bulb.group.position.set(0, -0.07, 0);
  shadePivot.add(bulb.group);

  // Light Beam Cone Mesh (Projects straight down onto the desktop)
  const beamHeight = 0.62;
  const beamGeom = new THREE.ConeGeometry(0.38, beamHeight, 18, 1, true);
  beamGeom.translate(0, -beamHeight / 2, 0); // apex at 0, base at -beamHeight
  const beamMesh = new THREE.Mesh(beamGeom, mats.lampBeamMaterial);
  beamMesh.position.set(0, -0.07, 0); // starts at bulb
  shadePivot.add(beamMesh);

  // Subtle Light Beam Radial Edge Lines
  const beamLinesGeom = new THREE.EdgesGeometry(beamGeom, 15);
  const beamLines = new THREE.LineSegments(beamLinesGeom, mats.subtleLineMaterial);
  beamMesh.add(beamLines);

  // Interactive Lamp Light Toggle
  const lampState = {
    isOn: true,
    toggle() {
      this.isOn = !this.isOn;
      beamMesh.visible = this.isOn;
    }
  };

  tagInteractive(base.mesh, group, {
    id: '05',
    code: 'DESK_LAMP',
    name: '铰接绘图台灯 / Drafting Lamp',
    hint: '点击开关台灯，点亮工作台上的聚焦光锥',
    category: '室内陈设 / Furnishing',
    onClick: () => lampState.toggle()
  }, interactiveTargets);

  // Also make the shade interactive
  shade.mesh.userData = base.mesh.userData;
  interactiveTargets.push(shade.mesh);

  root.add(group);
  return { group, beamMesh, lampState };
}

/**
 * 6. Cup (Mug, Handle, Coffee Liquid Surface, Saucer Coaster, Steam Lines)
 */
function buildCup(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_06_Cup';
  group.position.set(-0.42, 0.75, -1.95);

  // Saucer Coaster
  const saucer = createVectorMesh(new THREE.CylinderGeometry(0.065, 0.055, 0.012, 24), mats.bgMaterial, mats.lineMaterial);
  saucer.group.position.set(0, 0.006, 0);
  group.add(saucer.group);

  // Cup Rim Line on Saucer
  const saucerRing = createCircleLine(0.048, 20, mats.subtleLineMaterial, 'xz');
  saucerRing.position.set(0, 0.013, 0);
  group.add(saucerRing);

  // Mug Body
  const mugGeom = new THREE.CylinderGeometry(0.04, 0.034, 0.085, 20);
  const mug = createVectorMesh(mugGeom, mats.bgMaterial, mats.lineMaterial);
  mug.group.position.set(0, 0.054, 0);
  group.add(mug.group);

  // C-Curved Ergonomic Handle
  const handleGeom = new THREE.TorusGeometry(0.024, 0.005, 8, 16, Math.PI * 1.1);
  const handle = createVectorMesh(handleGeom, mats.bgMaterial, mats.lineMaterial);
  handle.group.rotation.y = Math.PI / 2;
  handle.group.rotation.z = -Math.PI / 1.1;
  handle.group.position.set(0.042, 0.054, 0);
  group.add(handle.group);

  // Coffee Liquid Surface
  const liquidMesh = new THREE.Mesh(new THREE.CircleGeometry(0.037, 20), mats.coffeeMaterial);
  liquidMesh.rotation.x = -Math.PI / 2;
  liquidMesh.position.set(0, 0.088, 0);
  group.add(liquidMesh);

  // Liquid Concentric Ripple Rings
  const ripple1 = createCircleLine(0.024, 16, mats.subtleLineMaterial, 'xz');
  ripple1.position.set(0, 0.089, 0);
  group.add(ripple1);

  const ripple2 = createCircleLine(0.012, 12, mats.subtleLineMaterial, 'xz');
  ripple2.position.set(0, 0.089, 0);
  group.add(ripple2);

  // Steam Group (Handled dynamically by DynamicsManager)
  const steamGroup = new THREE.Group();
  group.add(steamGroup);

  tagInteractive(mug.mesh, group, {
    id: '06',
    code: 'CUP',
    name: '咖啡杯与托盘 / Coffee Mug & Saucer',
    hint: '点击观察杯中手冲咖啡表面泛起的同心涟漪',
    category: '生活器物 / Living'
  }, interactiveTargets);

  root.add(group);
  return { group, steamGroup, ripple1, ripple2 };
}

/**
 * 7. Chair (Swivel Base, 5 Casters, Stem, Seat with Stitch Lines, Curved Backrest)
 */
function buildChair(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_07_Chair';
  group.position.set(-0.7, 0, -1.45);

  // 5-Star Swivel Base
  const baseCenter = createVectorMesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 16), mats.bgMaterial, mats.lineMaterial);
  baseCenter.group.position.set(0, 0.09, 0);
  group.add(baseCenter.group);

  // 5 Radiating Arched Legs & Caster Wheels
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const legLen = 0.28;
    const endX = Math.cos(angle) * legLen;
    const endZ = Math.sin(angle) * legLen;

    const legGeom = new THREE.BoxGeometry(0.026, 0.02, legLen);
    const leg = createVectorMesh(legGeom, mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(endX / 2, 0.08, endZ / 2);
    leg.group.rotation.y = -angle + Math.PI / 2;
    group.add(leg.group);

    // Hooded Caster Wheel
    const caster = createVectorMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
    caster.group.rotation.z = Math.PI / 2;
    caster.group.position.set(endX, 0.025, endZ);
    group.add(caster.group);
  }

  // Pneumatic Cylinder Stem
  const stem = createVectorMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 14), mats.bgMaterial, mats.lineMaterial);
  stem.group.position.set(0, 0.24, 0);
  group.add(stem.group);

  // Pneumatic Height Lever
  const lever = createVectorMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8), mats.bgMaterial, mats.lineMaterial);
  lever.group.rotation.z = Math.PI / 2;
  lever.group.position.set(0.09, 0.36, 0.06);
  group.add(lever.group);

  // Swivel Assembly (Entire upper seat and backrest rotates)
  const swivelGroup = new THREE.Group();
  swivelGroup.position.set(0, 0.42, 0);
  group.add(swivelGroup);

  // Contoured Ergonomic Seat Cushion
  const seatGeom = new THREE.BoxGeometry(0.48, 0.065, 0.46);
  const seat = createVectorMesh(seatGeom, mats.bgMaterial, mats.lineMaterial);
  seat.group.position.set(0, 0, 0);
  swivelGroup.add(seat.group);

  // Stitch Lines on Seat Cushion
  const seatStitch = createRectOutline(0.42, 0.4, mats.subtleLineMaterial, 'xz');
  seatStitch.position.set(0, 0.034, 0);
  swivelGroup.add(seatStitch);

  // Backrest Support Spine (Curved bar behind seat)
  const spineGeom = new THREE.BoxGeometry(0.04, 0.38, 0.03);
  const spine = createVectorMesh(spineGeom, mats.bgMaterial, mats.lineMaterial);
  spine.group.position.set(0, 0.22, 0.22);
  swivelGroup.add(spine.group);

  // Ergonomic Curved Lumbar Backrest
  const backGeom = new THREE.BoxGeometry(0.44, 0.34, 0.045);
  const backrest = createVectorMesh(backGeom, mats.bgMaterial, mats.lineMaterial);
  backrest.group.position.set(0, 0.36, 0.2);
  backrest.group.rotation.x = -0.1; // Gentle ergonomic recline
  swivelGroup.add(backrest.group);

  // Lumbar Seam Crease Line
  const lumbarLine = createLine([
    new THREE.Vector3(-0.18, 0.34, 0.176),
    new THREE.Vector3(0.18, 0.34, 0.176)
  ], mats.subtleLineMaterial);
  swivelGroup.add(lumbarLine);

  // Armrests (T-bar cantilever supports)
  [-0.26, 0.26].forEach(x => {
    // Upright post
    const post = createVectorMesh(new THREE.BoxGeometry(0.02, 0.18, 0.03), mats.bgMaterial, mats.lineMaterial);
    post.group.position.set(x, 0.1, 0.02);
    swivelGroup.add(post.group);

    // Padded Arm Pad
    const pad = createVectorMesh(new THREE.BoxGeometry(0.045, 0.02, 0.24), mats.bgMaterial, mats.lineMaterial);
    pad.group.position.set(x, 0.19, 0.02);
    swivelGroup.add(pad.group);
  });

  // Chair Spin State
  const chairState = {
    spinVelocity: 0,
    spin() {
      this.spinVelocity = 14.0;
    }
  };

  tagInteractive(seat.mesh, group, {
    id: '07',
    code: 'CHAIR',
    name: '人体工学转椅 / Swivel Office Chair',
    hint: '点击旋转椅子，观察五星脚轮与座面线稿',
    category: '家具器物 / Furniture',
    onClick: () => chairState.spin()
  }, interactiveTargets);

  root.add(group);
  return { group, swivelGroup, chairState };
}

/**
 * 8. Bookshelf & Books (Multi-shelf Frame, 15+ Books, Interactive Pull-out Book)
 */
function buildBookshelf(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_08_Bookshelf';
  group.position.set(2.45, 0, -3.22);

  const shelfW = 1.25;
  const shelfH = 2.4;
  const shelfD = 0.34;
  const boardThick = 0.032;

  // Left & Right Vertical Side Panels
  [-shelfW / 2 + boardThick / 2, shelfW / 2 - boardThick / 2].forEach(x => {
    const side = createVectorMesh(new THREE.BoxGeometry(boardThick, shelfH, shelfD), mats.bgMaterial, mats.lineMaterial);
    side.group.position.set(x, shelfH / 2, 0);
    group.add(side.group);
  });

  // Top Cap & Baseboard Plinth
  const topCap = createVectorMesh(new THREE.BoxGeometry(shelfW + 0.04, boardThick, shelfD + 0.02), mats.bgMaterial, mats.lineMaterial);
  topCap.group.position.set(0, shelfH - boardThick / 2, 0);
  group.add(topCap.group);

  const plinth = createVectorMesh(new THREE.BoxGeometry(shelfW, 0.08, shelfD), mats.bgMaterial, mats.lineMaterial);
  plinth.group.position.set(0, 0.04, 0);
  group.add(plinth.group);

  // Back Panel with Vertical Beadboard Grooves
  const backPanel = createVectorMesh(new THREE.BoxGeometry(shelfW - 0.06, shelfH - 0.1, 0.015), mats.bgMaterial, mats.lineMaterial);
  backPanel.group.position.set(0, shelfH / 2, -shelfD / 2 + 0.01);
  group.add(backPanel.group);

  const grooveLines = [];
  for (let gx = -shelfW / 2 + 0.12; gx <= shelfW / 2 - 0.12; gx += 0.12) {
    grooveLines.push(new THREE.Vector3(gx, 0.08, -shelfD / 2 + 0.02), new THREE.Vector3(gx, shelfH - 0.04, -shelfD / 2 + 0.02));
  }
  group.add(createLineSegments(grooveLines, mats.subtleLineMaterial));

  // 4 Horizontal Interior Shelves
  const shelfYLevels = [0.55, 1.05, 1.55, 2.0];
  shelfYLevels.forEach(y => {
    const shelf = createVectorMesh(new THREE.BoxGeometry(shelfW - boardThick * 2, boardThick, shelfD - 0.02), mats.bgMaterial, mats.lineMaterial);
    shelf.group.position.set(0, y, 0);
    group.add(shelf.group);
  });

  // Procedural Books Array (Over 18 distinct books with varying heights, spine details, titles)
  const booksContainer = new THREE.Group();
  group.add(booksContainer);

  let pullOutBookMesh = null;
  let pullOutBookGroup = null;

  // Shelf 1 (Bottom): Heavy monographs standing upright
  let currentX = -shelfW / 2 + 0.06;
  for (let i = 0; i < 7; i++) {
    const bW = 0.045 + (i % 3) * 0.01;
    const bH = 0.32 + (i % 2) * 0.04;
    const bD = 0.24 - (i % 2) * 0.02;

    const book = createVectorMesh(new THREE.BoxGeometry(bW, bH, bD), mats.bgMaterial, mats.lineMaterial);
    book.group.position.set(currentX + bW / 2, 0.08 + bH / 2, -0.02);
    booksContainer.add(book.group);

    // Spine horizontal groove lines
    const spineZ = -0.02 + bD / 2 + 0.001;
    const spineLine = createLine([
      new THREE.Vector3(currentX + 0.008, 0.08 + bH * 0.8, spineZ),
      new THREE.Vector3(currentX + bW - 0.008, 0.08 + bH * 0.8, spineZ)
    ], mats.subtleLineMaterial);
    booksContainer.add(spineLine);

    currentX += bW + 0.004;
  }

  // Shelf 2: Standing books + Interactive Pull-Out Book + Leaning books
  currentX = -shelfW / 2 + 0.08;
  for (let i = 0; i < 6; i++) {
    const bW = 0.038 + (i % 2) * 0.012;
    const bH = 0.26 + (i % 3) * 0.03;
    const bD = 0.22;

    const bookGeom = new THREE.BoxGeometry(bW, bH, bD);
    const book = createVectorMesh(bookGeom, mats.bgMaterial, mats.lineMaterial);

    if (i === 3) {
      // THE SPECIAL INTERACTIVE PULL-OUT BOOK ("Pure Line Architecture")
      pullOutBookGroup = new THREE.Group();
      pullOutBookGroup.position.set(currentX + bW / 2, 0.55 + boardThick / 2 + bH / 2, -0.02);

      const specialBook = createVectorMesh(new THREE.BoxGeometry(bW, bH, bD), mats.bgMaterial, mats.accentLineMaterial);
      specialBook.group.position.set(0, 0, 0);
      pullOutBookGroup.add(specialBook.group);

      // Spine title embossed line
      const titleLine = createLine([
        new THREE.Vector3(0, -bH * 0.28, bD / 2 + 0.002),
        new THREE.Vector3(0, bH * 0.28, bD / 2 + 0.002)
      ], mats.accentLineMaterial);
      pullOutBookGroup.add(titleLine);

      pullOutBookMesh = specialBook.mesh;
      booksContainer.add(pullOutBookGroup);
    } else {
      book.group.position.set(currentX + bW / 2, 0.55 + boardThick / 2 + bH / 2, -0.02);
      booksContainer.add(book.group);
    }
    currentX += bW + 0.004;
  }

  // 2 Leaning Books on Shelf 2
  const lean1 = createVectorMesh(new THREE.BoxGeometry(0.035, 0.25, 0.22), mats.bgMaterial, mats.lineMaterial);
  lean1.group.position.set(currentX + 0.06, 0.55 + 0.12, -0.02);
  lean1.group.rotation.z = -0.22;
  booksContainer.add(lean1.group);

  const lean2 = createVectorMesh(new THREE.BoxGeometry(0.03, 0.24, 0.21), mats.bgMaterial, mats.lineMaterial);
  lean2.group.position.set(currentX + 0.11, 0.55 + 0.11, -0.02);
  lean2.group.rotation.z = -0.22;
  booksContainer.add(lean2.group);

  // Minimalist Metal Bookend
  const bookend = createVectorMesh(new THREE.BoxGeometry(0.015, 0.16, 0.18), mats.bgMaterial, mats.lineMaterial);
  bookend.group.position.set(currentX + 0.18, 0.55 + 0.08, -0.02);
  booksContainer.add(bookend.group);

  // Shelf 3: Stack of 3 horizontal art books
  const stackBaseY = 1.05 + boardThick / 2;
  [
    { w: 0.26, h: 0.045, d: 0.28 },
    { w: 0.24, h: 0.038, d: 0.26 },
    { w: 0.22, h: 0.035, d: 0.24 }
  ].forEach((sb, idx) => {
    const stackBook = createVectorMesh(new THREE.BoxGeometry(sb.w, sb.h, sb.d), mats.bgMaterial, mats.lineMaterial);
    const y = stackBaseY + sb.h / 2 + idx * 0.042;
    stackBook.group.position.set(-0.25, y, -0.01);
    booksContainer.add(stackBook.group);
  });

  // Pull-Out Book Animation State
  const bookState = {
    isPulled: false,
    currentZ: 0,
    targetZ: 0,
    toggle() {
      this.isPulled = !this.isPulled;
      this.targetZ = this.isPulled ? 0.22 : 0;
    }
  };

  if (pullOutBookMesh) {
    tagInteractive(pullOutBookMesh, group, {
      id: '08',
      code: 'BOOKSHELF',
      name: '精装藏书《PURE LINE》 / Architectural Book',
      hint: '点击抽阅书架上的精装建筑特刊，观察书脊与纸页线构',
      category: '藏书文献 / Books',
      onClick: () => bookState.toggle()
    }, interactiveTargets);
  }

  root.add(group);
  return { group, pullOutBookGroup, bookState };
}

/**
 * 9. Storage Cabinet / Drawers (Sideboard, Upper/Lower Drawers with Handles)
 */
function buildCabinet(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_09_Cabinet';
  group.position.set(-3.18, 0, -0.5);

  const cabW = 0.52;
  const cabL = 1.45;
  const cabH = 0.82;
  const legH = 0.22;
  const bodyH = cabH - legH;

  // Cabinet Main Outer Body Box
  const bodyGeom = new THREE.BoxGeometry(cabW, bodyH, cabL);
  const body = createVectorMesh(bodyGeom, mats.bgMaterial, mats.lineMaterial);
  body.group.position.set(0, legH + bodyH / 2, 0);
  group.add(body.group);

  // 4 Mid-Century Tapered Dowel Legs with Ferrule Caps
  const legPositions = [
    { x: -cabW / 2 + 0.08, z: -cabL / 2 + 0.08 },
    { x: cabW / 2 - 0.08, z: -cabL / 2 + 0.08 },
    { x: -cabW / 2 + 0.08, z: cabL / 2 - 0.08 },
    { x: cabW / 2 - 0.08, z: cabL / 2 - 0.08 }
  ];
  legPositions.forEach(lp => {
    const leg = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.012, legH, 12), mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(lp.x, legH / 2, lp.z);
    group.add(leg.group);

    // Brass ferrule tip line
    const ferrule = createCircleLine(0.014, 12, mats.lineMaterial, 'xz');
    ferrule.position.set(lp.x, 0.04, lp.z);
    group.add(ferrule);
  });

  // Upper Sliding Drawer 1 (Left / Front side) - Interactive pull-out
  const drawerW = cabW - 0.04;
  const drawerH = 0.24;
  const drawerL = cabL / 2 - 0.04;

  const drawerPivot = new THREE.Group();
  drawerPivot.position.set(0, legH + bodyH - drawerH / 2 - 0.03, -cabL / 4);
  group.add(drawerPivot);

  const drawerFront = createVectorMesh(new THREE.BoxGeometry(drawerW, drawerH, drawerL), mats.bgMaterial, mats.lineMaterial);
  drawerPivot.add(drawerFront.group);

  // Minimalist Recessed Horizontal Handle Bar
  const handleBar = createVectorMesh(new THREE.BoxGeometry(0.02, 0.018, 0.22), mats.bgMaterial, mats.lineMaterial);
  handleBar.group.position.set(drawerW / 2 + 0.01, 0, 0);
  drawerPivot.add(handleBar.group);

  // Lower Tambour Slatted Face Lines
  const slatZLines = [];
  for (let z = -cabL / 2 + 0.05; z <= cabL / 2 - 0.05; z += 0.04) {
    slatZLines.push(
      new THREE.Vector3(cabW / 2 + 0.001, legH + 0.04, z),
      new THREE.Vector3(cabW / 2 + 0.001, legH + bodyH * 0.55, z)
    );
  }
  group.add(createLineSegments(slatZLines, mats.subtleLineMaterial));

  // Drawer Animation State
  const drawerState = {
    isOpen: false,
    currentX: 0,
    targetX: 0,
    toggle() {
      this.isOpen = !this.isOpen;
      this.targetX = this.isOpen ? 0.28 : 0;
    }
  };

  tagInteractive(drawerFront.mesh, group, {
    id: '09',
    code: 'CABINET',
    name: '收纳边柜与抽屉 / Sideboard Credenza',
    hint: '点击拉开上层收纳抽屉，观察精密滑轨与接缝线',
    category: '家具器物 / Furniture',
    onClick: () => drawerState.toggle()
  }, interactiveTargets);

  root.add(group);
  return { group, drawerPivot, drawerState };
}

/**
 * 10. Wall Clock (Circular Rim, Hour Ticks, Minute Ticks, Hour/Min/Sec Hands)
 */
function buildWallClock(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_10_WallClock';
  group.position.set(-3.37, 2.45, -0.45);

  const clockRadius = 0.25;

  // Stepped Bezel Rim
  const rimGeom = new THREE.CylinderGeometry(clockRadius, clockRadius + 0.02, 0.032, 36);
  const rim = createVectorMesh(rimGeom, mats.bgMaterial, mats.lineMaterial);
  rim.group.rotation.z = Math.PI / 2;
  group.add(rim.group);

  // Clock Face Dial (Circular occluder)
  const faceGeom = new THREE.CircleGeometry(clockRadius - 0.008, 36);
  const faceMesh = new THREE.Mesh(faceGeom, mats.bgMaterial);
  faceMesh.rotation.y = Math.PI / 2;
  faceMesh.position.set(0.017, 0, 0);
  group.add(faceMesh);

  // Hour and Minute Ticks on Face
  const hourTicks = [];
  const minTicks = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const isHour = i % 5 === 0;
    const len = isHour ? 0.038 : 0.016;
    const rOuter = clockRadius - 0.022;
    const rInner = rOuter - len;

    const z1 = Math.sin(angle) * rOuter;
    const y1 = Math.cos(angle) * rOuter;
    const z2 = Math.sin(angle) * rInner;
    const y2 = Math.cos(angle) * rInner;

    const p1 = new THREE.Vector3(0.018, y1, z1);
    const p2 = new THREE.Vector3(0.018, y2, z2);

    if (isHour) hourTicks.push(p1, p2);
    else minTicks.push(p1, p2);
  }
  group.add(createLineSegments(hourTicks, mats.lineMaterial));
  group.add(createLineSegments(minTicks, mats.subtleLineMaterial));

  // Center Pivot Pin Cap
  const pin = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 12), mats.bgMaterial, mats.lineMaterial);
  pin.group.rotation.z = Math.PI / 2;
  pin.group.position.set(0.022, 0, 0);
  group.add(pin.group);

  // Hour Hand Pivot & Needle
  const hourHandPivot = new THREE.Group();
  hourHandPivot.position.set(0.019, 0, 0);
  const hourHandLine = createLine([
    new THREE.Vector3(0, -0.02, 0),
    new THREE.Vector3(0, 0.11, 0)
  ], mats.lineMaterial);
  hourHandPivot.add(hourHandLine);
  group.add(hourHandPivot);

  // Minute Hand Pivot & Needle
  const minHandPivot = new THREE.Group();
  minHandPivot.position.set(0.02, 0, 0);
  const minHandLine = createLine([
    new THREE.Vector3(0, -0.028, 0),
    new THREE.Vector3(0, 0.165, 0)
  ], mats.lineMaterial);
  minHandPivot.add(minHandLine);
  group.add(minHandPivot);

  // Second Hand Pivot & Slender Needle
  const secHandPivot = new THREE.Group();
  secHandPivot.position.set(0.021, 0, 0);
  const secHandLine = createLine([
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(0, 0.18, 0)
  ], mats.accentLineMaterial);
  secHandPivot.add(secHandLine);
  group.add(secHandPivot);

  tagInteractive(faceMesh, group, {
    id: '10',
    code: 'WALL_CLOCK',
    name: '极简机械挂钟 / Minimalist Wall Clock',
    hint: '精准指针与现实时间同步静默走动',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group, hourHandPivot, minHandPivot, secHandPivot };
}

/**
 * 11. Sofa (2-Seater Frame, Plush Cushions with Crease Lines, Backrest, Armrests, Wooden Legs)
 */
function buildSofa(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_11_Sofa';
  group.position.set(-0.4, 0, 0.8);
  group.rotation.y = Math.PI / 2;

  const sofaW = 1.76;
  const sofaD = 0.88;
  const seatH = 0.42;

  // Solid Base Platform Plinth
  const baseGeom = new THREE.BoxGeometry(sofaW, 0.12, sofaD);
  const base = createVectorMesh(baseGeom, mats.bgMaterial, mats.lineMaterial);
  base.group.position.set(0, 0.22, 0);
  group.add(base.group);

  // 4 Tapered Wooden Legs
  const legW = sofaW / 2 - 0.12;
  const legD = sofaD / 2 - 0.12;
  [
    { x: -legW, z: -legD },
    { x: legW, z: -legD },
    { x: -legW, z: legD },
    { x: legW, z: legD }
  ].forEach(p => {
    const leg = createVectorMesh(new THREE.CylinderGeometry(0.024, 0.016, 0.16, 12), mats.bgMaterial, mats.lineMaterial);
    leg.group.position.set(p.x, 0.08, p.z);
    group.add(leg.group);
  });

  // Low-Profile Backrest with Tufting Crease Lines
  const backGeom = new THREE.BoxGeometry(sofaW, 0.46, 0.18);
  const back = createVectorMesh(backGeom, mats.bgMaterial, mats.lineMaterial);
  back.group.position.set(0, 0.51, -sofaD / 2 + 0.09);
  group.add(back.group);

  // Vertical Tufting Creases on Backrest
  const tuftLines = [];
  [-0.44, 0, 0.44].forEach(tx => {
    tuftLines.push(
      new THREE.Vector3(tx, 0.32, -sofaD / 2 + 0.181),
      new THREE.Vector3(tx, 0.7, -sofaD / 2 + 0.181)
    );
  });
  group.add(createLineSegments(tuftLines, mats.subtleLineMaterial));

  // Left & Right Armrests
  const armW = 0.18;
  const armH = 0.34;
  const armD = sofaD - 0.04;
  [-sofaW / 2 + armW / 2, sofaW / 2 - armW / 2].forEach(ax => {
    const armGeom = new THREE.BoxGeometry(armW, armH, armD);
    const arm = createVectorMesh(armGeom, mats.bgMaterial, mats.lineMaterial);
    arm.group.position.set(ax, 0.45, 0.02);
    group.add(arm.group);
  });

  // Two Thick Plush Seat Cushions
  const cushionW = (sofaW - armW * 2) / 2 - 0.015;
  const cushionD = sofaD - 0.22;
  const cushionH = 0.14;
  const cushionGroup = new THREE.Group();

  [-cushionW / 2 - 0.008, cushionW / 2 + 0.008].forEach(cx => {
    const cushionGeom = new THREE.BoxGeometry(cushionW, cushionH, cushionD);
    const cushion = createVectorMesh(cushionGeom, mats.bgMaterial, mats.lineMaterial);
    cushion.group.position.set(cx, seatH - cushionH / 2 + 0.02, 0.08);
    cushionGroup.add(cushion.group);

    // Welt Piping Edge Lines
    const piping = createRectOutline(cushionW - 0.02, cushionD - 0.02, mats.subtleLineMaterial, 'xz');
    piping.position.set(cx, seatH + 0.021, 0.08);
    cushionGroup.add(piping);
  });
  group.add(cushionGroup);

  // Sofa Bounce State
  const sofaState = {
    bounceY: 0,
    targetY: 0,
    sit() {
      this.targetY = -0.04;
      setTimeout(() => { this.targetY = 0; }, 220);
    }
  };

  tagInteractive(base.mesh, group, {
    id: '11',
    code: 'SOFA',
    name: '双人布艺沙发 / 2-Seater Modern Sofa',
    hint: '点击轻触体验座面回弹与细致缝线折痕',
    category: '家具器物 / Furniture',
    onClick: () => sofaState.sit()
  }, interactiveTargets);

  root.add(group);
  return { group, cushionGroup, sofaState };
}

/**
 * 12. Pillows (Geometric Patterned Throw Cushions on Sofa)
 */
function buildPillows(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_12_Pillows';
  group.position.set(-0.4, 0, 0.8);
  group.rotation.y = Math.PI / 2; // Same orientation as sofa

  // Pillow 1 (Left Corner, Tilted)
  const p1Group = new THREE.Group();
  p1Group.position.set(-0.54, 0.52, 0.06);
  p1Group.rotation.z = 0.28;
  p1Group.rotation.y = 0.22;
  p1Group.rotation.x = -0.15;

  const p1Geom = new THREE.BoxGeometry(0.32, 0.32, 0.12);
  const p1 = createVectorMesh(p1Geom, mats.bgMaterial, mats.lineMaterial);
  p1Group.add(p1.group);

  // Chevron / Diamond Pattern Lines on Pillow 1
  const chevronLines = [
    new THREE.Vector3(0, 0.12, 0.061), new THREE.Vector3(-0.12, 0, 0.061),
    new THREE.Vector3(-0.12, 0, 0.061), new THREE.Vector3(0, -0.12, 0.061),
    new THREE.Vector3(0, -0.12, 0.061), new THREE.Vector3(0.12, 0, 0.061),
    new THREE.Vector3(0.12, 0, 0.061), new THREE.Vector3(0, 0.12, 0.061),
    new THREE.Vector3(-0.12, 0, 0.061), new THREE.Vector3(0.12, 0, 0.061),
    new THREE.Vector3(0, -0.12, 0.061), new THREE.Vector3(0, 0.12, 0.061)
  ];
  p1Group.add(createLineSegments(chevronLines, mats.subtleLineMaterial));
  group.add(p1Group);

  // Pillow 2 (Right Corner, Tilted)
  const p2Group = new THREE.Group();
  p2Group.position.set(0.54, 0.52, 0.06);
  p2Group.rotation.z = -0.25;
  p2Group.rotation.y = -0.2;
  p2Group.rotation.x = -0.15;

  const p2Geom = new THREE.BoxGeometry(0.3, 0.3, 0.11);
  const p2 = createVectorMesh(p2Geom, mats.bgMaterial, mats.lineMaterial);
  p2Group.add(p2.group);

  // Concentric Diamond Lines on Pillow 2
  const diamondLines = [
    new THREE.Vector3(0, 0.09, 0.056), new THREE.Vector3(-0.09, 0, 0.056),
    new THREE.Vector3(-0.09, 0, 0.056), new THREE.Vector3(0, -0.09, 0.056),
    new THREE.Vector3(0, -0.09, 0.056), new THREE.Vector3(0.09, 0, 0.056),
    new THREE.Vector3(0.09, 0, 0.056), new THREE.Vector3(0, 0.09, 0.056)
  ];
  p2Group.add(createLineSegments(diamondLines, mats.subtleLineMaterial));
  group.add(p2Group);

  tagInteractive(p1.mesh, group, {
    id: '12',
    code: 'PILLOWS',
    name: '几何纹理抱枕 / Geometric Pillows',
    hint: '点击拍打抱枕，欣赏表面织造的包豪斯菱格纹理',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 13. Coffee Table (Minimalist Low Table, Wireframe Legs, Magazine & Tray on Top)
 */
function buildCoffeeTable(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_13_CoffeeTable';
  group.position.set(0.55, 0, 0.8);
  group.rotation.y = Math.PI / 2;

  const tableW = 1.05;
  const tableD = 0.54;
  const tableH = 0.38;

  // Solid Table Top
  const topGeom = new THREE.BoxGeometry(tableW, 0.032, tableD);
  const tabletop = createVectorMesh(topGeom, mats.bgMaterial, mats.lineMaterial);
  tabletop.group.position.set(0, tableH - 0.016, 0);
  group.add(tabletop.group);

  // Wireframe Hairpin Legs (4 Corners)
  const legOffsetX = tableW / 2 - 0.08;
  const legOffsetZ = tableD / 2 - 0.08;
  [
    { x: -legOffsetX, z: -legOffsetZ },
    { x: legOffsetX, z: -legOffsetZ },
    { x: -legOffsetX, z: legOffsetZ },
    { x: legOffsetX, z: legOffsetZ }
  ].forEach(p => {
    // Looped hairpin wireframe rod
    const legPts = [
      new THREE.Vector3(p.x, tableH - 0.032, p.z - 0.02),
      new THREE.Vector3(p.x * 0.95, 0.01, p.z * 0.95),
      new THREE.Vector3(p.x, tableH - 0.032, p.z + 0.02)
    ];
    group.add(createLine(legPts, mats.lineMaterial));
  });

  // Tray with Raised Rim on Table
  const tray = createVectorMesh(new THREE.BoxGeometry(0.34, 0.018, 0.24), mats.bgMaterial, mats.lineMaterial);
  tray.group.position.set(-0.2, tableH + 0.009, 0.02);
  group.add(tray.group);

  // Glass Carafe / Decanter on Tray
  const carafeGeom = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 16);
  const carafe = createVectorMesh(carafeGeom, mats.bgMaterial, mats.lineMaterial);
  carafe.group.position.set(-0.26, tableH + 0.088, 0.02);
  group.add(carafe.group);

  // Decanter Neck & Rim
  const neck = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.024, 0.04, 12), mats.bgMaterial, mats.lineMaterial);
  neck.group.position.set(-0.26, tableH + 0.178, 0.02);
  group.add(neck.group);

  // Open Architecture Magazines on Table
  const mag1 = createVectorMesh(new THREE.BoxGeometry(0.26, 0.01, 0.19), mats.bgMaterial, mats.lineMaterial);
  mag1.group.position.set(0.22, tableH + 0.005, -0.04);
  mag1.group.rotation.y = 0.14;
  group.add(mag1.group);

  const mag2 = createVectorMesh(new THREE.BoxGeometry(0.24, 0.01, 0.18), mats.bgMaterial, mats.lineMaterial);
  mag2.group.position.set(0.25, tableH + 0.015, 0.04);
  mag2.group.rotation.y = -0.22;
  group.add(mag2.group);

  // Magazine cover page layout lines
  const pageLine = createLine([
    new THREE.Vector3(0.18, tableH + 0.021, 0.02),
    new THREE.Vector3(0.31, tableH + 0.021, 0.02)
  ], mats.subtleLineMaterial);
  mag2.group.add(pageLine);

  tagInteractive(tabletop.mesh, group, {
    id: '13',
    code: 'COFFEE_TABLE',
    name: '极简发夹腿茶几 / Wireframe Coffee Table',
    hint: '纤细钢丝腿几面，陈列玻璃水器与现代设计刊物',
    category: '家具器物 / Furniture'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 14. Rug (Large Floor Area Rug with Intricate Geometric Vector Pattern & Edge Fringes)
 */
function buildRug(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_14_Rug';
  group.position.set(0.1, 0.002, 0.8);

  const rugW = 2.4;
  const rugD = 2.2;

  // Thin occluding floor rug mesh
  const rugGeom = new THREE.BoxGeometry(rugW, 0.004, rugD);
  const rug = createVectorMesh(rugGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(rug.group);

  // Outer Border Double Perimeter Line
  const outerBorder = createRectOutline(rugW - 0.14, rugD - 0.14, mats.lineMaterial, 'xz');
  outerBorder.position.set(0, 0.003, 0);
  group.add(outerBorder);

  const innerBorder = createRectOutline(rugW - 0.26, rugD - 0.26, mats.subtleLineMaterial, 'xz');
  innerBorder.position.set(0, 0.003, 0);
  group.add(innerBorder);

  // Intricate Central Geometric Bauhaus Motif (Concentric Diamonds & Diagonal Grid)
  const patternLines = [];
  // Central concentric diamonds
  [0.75, 0.5, 0.25].forEach(r => {
    patternLines.push(
      new THREE.Vector3(0, 0.003, -r), new THREE.Vector3(r * 1.3, 0.003, 0),
      new THREE.Vector3(r * 1.3, 0.003, 0), new THREE.Vector3(0, 0.003, r),
      new THREE.Vector3(0, 0.003, r), new THREE.Vector3(-r * 1.3, 0.003, 0),
      new THREE.Vector3(-r * 1.3, 0.003, 0), new THREE.Vector3(0, 0.003, -r)
    );
  });

  // Corner diagonal fretwork lines
  [-rugW / 2 + 0.35, rugW / 2 - 0.35].forEach(cx => {
    [-rugD / 2 + 0.35, rugD / 2 - 0.35].forEach(cz => {
      patternLines.push(
        new THREE.Vector3(cx - 0.2, 0.003, cz), new THREE.Vector3(cx + 0.2, 0.003, cz),
        new THREE.Vector3(cx, 0.003, cz - 0.2), new THREE.Vector3(cx, 0.003, cz + 0.2)
      );
    });
  });
  group.add(createLineSegments(patternLines, mats.subtleLineMaterial));

  // Edge Fringes (40+ individual tassel lines on left and right borders)
  const fringeLines = [];
  const fringeLen = 0.055;
  const fringeCount = 36;
  for (let i = 0; i <= fringeCount; i++) {
    const z = -rugD / 2 + (i / fringeCount) * rugD;
    // Left fringe
    fringeLines.push(new THREE.Vector3(-rugW / 2, 0.002, z), new THREE.Vector3(-rugW / 2 - fringeLen, 0.002, z));
    // Right fringe
    fringeLines.push(new THREE.Vector3(rugW / 2, 0.002, z), new THREE.Vector3(rugW / 2 + fringeLen, 0.002, z));
  }
  group.add(createLineSegments(fringeLines, mats.lineMaterial));

  tagInteractive(rug.mesh, group, {
    id: '14',
    code: 'RUG',
    name: '几何编织羊毛地毯 / Geometric Area Rug',
    hint: '包豪斯几何图腾密织羊毛地毯，两侧带细致手工流苏',
    category: '室内陈设 / Furnishing'
  }, interactiveTargets);

  root.add(group);
  return { group };
}

/**
 * 15. Record Player / Turntable (Wood Plinth, Metal Platter, Vinyl with Grooves, Tonearm, Knobs)
 */
function buildRecordPlayer(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_15_RecordPlayer';
  group.position.set(-3.18, 0.82, -0.45);

  const plinthW = 0.38;
  const plinthL = 0.46;
  const plinthH = 0.06;

  // Solid Wood Plinth
  const plinth = createVectorMesh(new THREE.BoxGeometry(plinthW, plinthH, plinthL), mats.bgMaterial, mats.lineMaterial);
  plinth.group.position.set(0, plinthH / 2, 0);
  group.add(plinth.group);

  // Anti-Vibration Rubber Feet
  [
    { x: -plinthW / 2 + 0.04, z: -plinthL / 2 + 0.04 },
    { x: plinthW / 2 - 0.04, z: -plinthL / 2 + 0.04 },
    { x: -plinthW / 2 + 0.04, z: plinthL / 2 - 0.04 },
    { x: plinthW / 2 - 0.04, z: plinthL / 2 - 0.04 }
  ].forEach(p => {
    const foot = createVectorMesh(new THREE.CylinderGeometry(0.016, 0.014, 0.012, 12), mats.bgMaterial, mats.lineMaterial);
    foot.group.position.set(p.x, -0.006, p.z);
    group.add(foot.group);
  });

  // Circular Turntable Platter (Rotates when playing)
  const turntablePlatter = new THREE.Group();
  turntablePlatter.position.set(0, plinthH + 0.012, -0.04);
  group.add(turntablePlatter);

  const platterMesh = createVectorMesh(new THREE.CylinderGeometry(0.145, 0.145, 0.016, 32), mats.bgMaterial, mats.lineMaterial);
  turntablePlatter.add(platterMesh.group);

  // Vinyl Record with Multiple Concentric Micro-Grooves
  const vinylDisc = createVectorMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.004, 32), mats.bgMaterial, mats.lineMaterial);
  vinylDisc.group.position.set(0, 0.01, 0);
  turntablePlatter.add(vinylDisc.group);

  // Micro-Groove Circles on Vinyl Surface
  [0.13, 0.118, 0.106, 0.094, 0.082, 0.07].forEach(r => {
    const groove = createCircleLine(r, 32, mats.subtleLineMaterial, 'xz');
    groove.position.set(0, 0.013, 0);
    turntablePlatter.add(groove);
  });

  // Center Record Label with Spindle Pin
  const labelCircle = createCircleLine(0.048, 24, mats.accentLineMaterial, 'xz');
  labelCircle.position.set(0, 0.013, 0);
  turntablePlatter.add(labelCircle);

  const spindle = createVectorMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
  spindle.group.position.set(0, 0.015, 0);
  turntablePlatter.add(spindle.group);

  // S-Shaped Tonearm Assembly with Pivot Base
  const tonearmPivot = new THREE.Group();
  tonearmPivot.position.set(plinthW / 2 - 0.065, plinthH + 0.02, 0.14);
  group.add(tonearmPivot);

  // Gimbal Tower Base
  const gimbal = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 14), mats.bgMaterial, mats.lineMaterial);
  tonearmPivot.add(gimbal.group);

  // Tonearm Bar (S-curved spline polyline)
  const armPivotHead = new THREE.Group();
  armPivotHead.position.set(0, 0.02, 0);
  tonearmPivot.add(armPivotHead);

  // Counterweight
  const counterweight = createVectorMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.026, 12), mats.bgMaterial, mats.lineMaterial);
  counterweight.group.rotation.x = Math.PI / 2;
  counterweight.group.position.set(0, 0, 0.03);
  armPivotHead.add(counterweight.group);

  // S-Curve Arm Tube
  const armTubePts = [
    new THREE.Vector3(0, 0, 0.02),
    new THREE.Vector3(0, 0, -0.06),
    new THREE.Vector3(-0.02, 0, -0.12),
    new THREE.Vector3(-0.01, 0, -0.18),
    new THREE.Vector3(-0.025, -0.015, -0.21)
  ];
  armPivotHead.add(createLine(armTubePts, mats.lineMaterial));

  // Headshell & Stylus Needle
  const headshell = createVectorMesh(new THREE.BoxGeometry(0.014, 0.012, 0.028), mats.bgMaterial, mats.lineMaterial);
  headshell.group.position.set(-0.025, -0.015, -0.22);
  armPivotHead.add(headshell.group);

  // Turntable Knobs & Pitch Slider
  const knob1 = createVectorMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), mats.bgMaterial, mats.lineMaterial);
  knob1.group.position.set(-plinthW / 2 + 0.06, plinthH + 0.005, 0.16);
  group.add(knob1.group);

  const knob2 = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 10), mats.bgMaterial, mats.lineMaterial);
  knob2.group.position.set(-plinthW / 2 + 0.1, plinthH + 0.005, 0.16);
  group.add(knob2.group);

  // Playback Animation State
  const turntableState = {
    isPlaying: false,
    rpmSpeed: 0,
    targetAngle: 0, // 0 = parked rest, 0.42 = active on vinyl
    currentAngle: 0,
    toggle() {
      this.isPlaying = !this.isPlaying;
      this.targetAngle = this.isPlaying ? 0.42 : 0;
    }
  };

  tagInteractive(plinth.mesh, group, {
    id: '15',
    code: 'RECORD_PLAYER',
    name: '复古黑胶唱机 / Turntable Record Player',
    hint: '点击落针播放黑胶唱片，观察唱盘微缝与唱臂旋转',
    category: '生活器物 / Living',
    onClick: () => turntableState.toggle()
  }, interactiveTargets);

  // Also make the platter interactive
  platterMesh.mesh.userData = plinth.mesh.userData;
  interactiveTargets.push(platterMesh.mesh);

  root.add(group);
  return { group, turntablePlatter, armPivotHead, turntableState };
}

/**
 * 16. Wall Art / Painting (Framed Wall Prints, Hanging Cord, Switchable Artwork Designs)
 */
function buildWallArt(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_16_WallArt';
  group.position.set(1.11, 2.15, -3.37);

  const artW = 0.82;
  const artH = 1.15;

  // Outer Gallery Wood Frame
  const frameGeom = new THREE.BoxGeometry(artW, artH, 0.038);
  const frame = createVectorMesh(frameGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(frame.group);

  // Mat Board (Passe-partout)
  const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(artW - 0.12, artH - 0.12), mats.bgMaterial);
  matMesh.position.set(0, 0, 0.02);
  group.add(matMesh);

  // Inner Picture Window Border
  const innerMatLine = createRectOutline(artW - 0.24, artH - 0.24, mats.lineMaterial, 'xy');
  innerMatLine.position.set(0, 0, 0.021);
  group.add(innerMatLine);

  // Hanging Wire Cord & Wall Nail Hook above frame
  const wirePts = [
    new THREE.Vector3(-artW * 0.35, artH / 2, 0.015),
    new THREE.Vector3(0, artH / 2 + 0.18, 0.015),
    new THREE.Vector3(artW * 0.35, artH / 2, 0.015)
  ];
  group.add(createLine(wirePts, mats.lineMaterial));

  const nail = createVectorMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), mats.bgMaterial, mats.lineMaterial);
  nail.group.rotation.x = Math.PI / 2;
  nail.group.position.set(0, artH / 2 + 0.18, 0.015);
  group.add(nail.group);

  // Switchable Artwork Container (Contains 3 distinct vector art designs)
  const artworkGroup = new THREE.Group();
  artworkGroup.position.set(0, 0, 0.022);
  group.add(artworkGroup);

  // Art 1: "Bauhaus Modernism" - Intersecting Circles & Geometric Equilibrium
  const art1 = new THREE.Group();
  art1.add(createCircleLine(0.24, 32, mats.accentLineMaterial, 'xy'));
  art1.add(createCircleLine(0.14, 24, mats.lineMaterial, 'xy'));
  art1.add(createRectOutline(0.36, 0.52, mats.lineMaterial, 'xy'));
  art1.add(createLine([new THREE.Vector3(-0.3, -0.35, 0), new THREE.Vector3(0.3, 0.35, 0)], mats.subtleLineMaterial));
  art1.add(createLine([new THREE.Vector3(-0.25, 0.1, 0), new THREE.Vector3(0.25, 0.1, 0)], mats.lineMaterial));
  artworkGroup.add(art1);

  // Art 2: "Topographic Wave" - Flowing Contour Elevation Lines
  const art2 = new THREE.Group();
  art2.visible = false;
  for (let w = -5; w <= 5; w++) {
    const wavePts = [];
    const baseY = w * 0.07;
    for (let x = -0.32; x <= 0.32; x += 0.04) {
      const y = baseY + Math.sin(x * 6 + w * 0.4) * 0.04;
      wavePts.push(new THREE.Vector3(x, y, 0));
    }
    art2.add(createLine(wavePts, w === 0 ? mats.accentLineMaterial : mats.subtleLineMaterial));
  }
  artworkGroup.add(art2);

  // Art 3: "Axonometric Blueprint" - Architectural Isometric Wireframe Projection
  const art3 = new THREE.Group();
  art3.visible = false;
  const isoBoxGeom = new THREE.BoxGeometry(0.26, 0.38, 0.26);
  const isoLines = new THREE.LineSegments(new THREE.EdgesGeometry(isoBoxGeom), mats.accentLineMaterial);
  isoLines.rotation.x = Math.PI / 6;
  isoLines.rotation.y = Math.PI / 4;
  art3.add(isoLines);
  art3.add(createCircleLine(0.32, 32, mats.subtleLineMaterial, 'xy'));
  artworkGroup.add(art3);

  const artworks = [art1, art2, art3];
  let currentArtIdx = 0;

  function cycleArtwork() {
    artworks[currentArtIdx].visible = false;
    currentArtIdx = (currentArtIdx + 1) % artworks.length;
    artworks[currentArtIdx].visible = true;
  }

  tagInteractive(frame.mesh, group, {
    id: '16',
    code: 'WALL_ART',
    name: '画廊艺术挂画 / Framed Gallery Art',
    hint: '点击画框切换展出的三种现代主义矢量线稿艺术画作',
    category: '艺术陈列 / Art',
    onClick: cycleArtwork
  }, interactiveTargets);

  root.add(group);
  return { group, artworkGroup, cycleArtwork };
}

/**
 * 17. Globe (Circular Meridian Ring, Tilted Axis, Pedestal Base, Continent Contours)
 */
function buildGlobe(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_17_Globe';
  group.position.set(-3.18, 0.82, 0.16);

  const globeRadius = 0.13;
  const totalBaseH = 0.14;

  // Turned Wooden Round Pedestal Base
  const base1 = createVectorMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.024, 20), mats.bgMaterial, mats.lineMaterial);
  base1.group.position.set(0, 0.012, 0);
  group.add(base1.group);

  const stem = createVectorMesh(new THREE.CylinderGeometry(0.016, 0.024, 0.12, 14), mats.bgMaterial, mats.lineMaterial);
  stem.group.position.set(0, 0.07, 0);
  group.add(stem.group);

  // Meridian C-Arc Ring (Tilted at 23.5° Earth axis)
  const meridianPivot = new THREE.Group();
  meridianPivot.position.set(0, totalBaseH + globeRadius, 0);
  group.add(meridianPivot);

  // C-Shaped Semi-Meridian Arch
  const meridianGeom = new THREE.TorusGeometry(globeRadius + 0.02, 0.008, 8, 32, Math.PI * 1.15);
  const meridianRing = createVectorMesh(meridianGeom, mats.bgMaterial, mats.lineMaterial);
  meridianRing.group.rotation.z = -Math.PI / 2.3;
  meridianPivot.add(meridianRing.group);

  // 23.5° Tilted Axis Spindle
  const earthAxisTilt = (23.5 * Math.PI) / 180;
  const sphereAxisPivot = new THREE.Group();
  sphereAxisPivot.rotation.z = earthAxisTilt;
  meridianPivot.add(sphereAxisPivot);

  // Globe Occluding Sphere
  const globeSphere = createVectorMesh(new THREE.SphereGeometry(globeRadius, 24, 24), mats.bgMaterial, mats.lineMaterial);
  sphereAxisPivot.add(globeSphere.group);

  // Procedural Continental Contours & Longitude / Latitude Rings
  const worldLinesGroup = new THREE.Group();
  sphereAxisPivot.add(worldLinesGroup);

  // Equator, Tropics, and Polar Circles
  worldLinesGroup.add(createCircleLine(globeRadius + 0.001, 32, mats.accentLineMaterial, 'xz'));
  [0.055, -0.055].forEach(y => {
    const r = Math.sqrt(globeRadius * globeRadius - y * y);
    const tropic = createCircleLine(r + 0.001, 24, mats.subtleLineMaterial, 'xz');
    tropic.position.set(0, y, 0);
    worldLinesGroup.add(tropic);
  });

  // Longitude Meridians
  for (let m = 0; m < 4; m++) {
    const meridian = createCircleLine(globeRadius + 0.001, 32, mats.subtleLineMaterial, 'xy');
    meridian.rotation.y = (m / 4) * Math.PI;
    worldLinesGroup.add(meridian);
  }

  // Stylized Vector Continental Outlines (Americas, Eurasia, Africa)
  const continentLines = [
    // Eurasia / Africa outline
    new THREE.Vector3(0.06, 0.08, 0.09), new THREE.Vector3(0.09, 0.04, 0.07),
    new THREE.Vector3(0.09, 0.04, 0.07), new THREE.Vector3(0.08, -0.06, 0.07),
    new THREE.Vector3(0.08, -0.06, 0.07), new THREE.Vector3(0.03, -0.09, 0.08),
    new THREE.Vector3(0.03, -0.09, 0.08), new THREE.Vector3(0.02, 0.02, 0.12),
    new THREE.Vector3(0.02, 0.02, 0.12), new THREE.Vector3(0.06, 0.08, 0.09),
    // Americas outline
    new THREE.Vector3(-0.08, 0.09, 0.06), new THREE.Vector3(-0.06, 0.03, 0.1),
    new THREE.Vector3(-0.06, 0.03, 0.1), new THREE.Vector3(-0.08, -0.06, 0.08),
    new THREE.Vector3(-0.08, -0.06, 0.08), new THREE.Vector3(-0.05, -0.09, 0.07),
    new THREE.Vector3(-0.05, -0.09, 0.07), new THREE.Vector3(-0.1, 0.01, 0.06),
    new THREE.Vector3(-0.1, 0.01, 0.06), new THREE.Vector3(-0.08, 0.09, 0.06)
  ];
  worldLinesGroup.add(createLineSegments(continentLines, mats.lineMaterial));

  // Globe Spin State
  const globeState = {
    spinVelocity: 0,
    spin() {
      this.spinVelocity = 12.0;
    }
  };

  tagInteractive(globeSphere.mesh, group, {
    id: '17',
    code: 'GLOBE',
    name: '复古桌面地球仪 / Desktop Globe',
    hint: '点击拨动地球仪，观察沿 23.5° 地轴旋转的经纬线网',
    category: '藏书文献 / Books',
    onClick: () => globeState.spin()
  }, interactiveTargets);

  root.add(group);
  return { group, worldLinesGroup, sphereAxisPivot, globeState };
}

/**
 * 18. Ceiling Fan (Ceiling Canopy, Downrod, Motor Housing, 3 Aerodynamic Blades, Pull Chain)
 */
function buildCeilingFan(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_18_CeilingFan';
  group.position.set(0, 3.48, 0);

  // Ceiling Mounting Canopy
  const canopy = createVectorMesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), mats.bgMaterial, mats.lineMaterial);
  canopy.group.position.set(0, -0.03, 0);
  group.add(canopy.group);

  // Downrod Suspension Tube
  const rodLen = 0.38;
  const downrod = createVectorMesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 12), mats.bgMaterial, mats.lineMaterial);
  downrod.group.position.set(0, -0.06 - rodLen / 2, 0);
  group.add(downrod.group);

  // Rotating Assembly (Motor Housing + Blades)
  const fanRotor = new THREE.Group();
  fanRotor.position.set(0, -0.06 - rodLen, 0);
  group.add(fanRotor);

  // Cylindrical Motor Housing with Cooling Vents
  const motorGeom = new THREE.CylinderGeometry(0.18, 0.16, 0.12, 24);
  const motor = createVectorMesh(motorGeom, mats.bgMaterial, mats.lineMaterial);
  fanRotor.add(motor.group);

  // Vent Slot Lines around motor
  const ventLines = [];
  for (let v = 0; v < 16; v++) {
    const angle = (v / 16) * Math.PI * 2;
    const r = 0.181;
    ventLines.push(
      new THREE.Vector3(Math.cos(angle) * r, -0.03, Math.sin(angle) * r),
      new THREE.Vector3(Math.cos(angle) * r, 0.03, Math.sin(angle) * r)
    );
  }
  fanRotor.add(createLineSegments(ventLines, mats.subtleLineMaterial));

  // 3 Aerodynamic Wooden Blades (120° apart)
  const bladeCount = 3;
  const bladeLen = 0.58;
  const bladeW = 0.13;
  for (let b = 0; b < bladeCount; b++) {
    const bAngle = (b / bladeCount) * Math.PI * 2;
    const bladeArm = new THREE.Group();
    bladeArm.rotation.y = bAngle;

    // Metal Mounting Iron Bracket with Rivet Lines
    const bracket = createVectorMesh(new THREE.BoxGeometry(0.08, 0.014, 0.05), mats.bgMaterial, mats.lineMaterial);
    bracket.group.position.set(0.18, 0, 0);
    bladeArm.add(bracket.group);

    // Paddle Blade with Aerodynamic Pitch Tilt
    const bladeGeom = new THREE.BoxGeometry(bladeLen, 0.012, bladeW);
    const blade = createVectorMesh(bladeGeom, mats.bgMaterial, mats.lineMaterial);
    blade.group.position.set(0.18 + bladeLen / 2, 0, 0);
    blade.group.rotation.x = 0.18; // Pitch angle
    bladeArm.add(blade.group);

    fanRotor.add(bladeArm);
  }

  // Dangling Center Pull Chain with Wooden Fob Bead
  const chainPts = [
    new THREE.Vector3(0, -0.06 - rodLen - 0.06, 0),
    new THREE.Vector3(0, -0.06 - rodLen - 0.42, 0)
  ];
  group.add(createLine(chainPts, mats.lineMaterial));

  const fob = createVectorMesh(new THREE.CylinderGeometry(0.01, 0.007, 0.045, 10), mats.bgMaterial, mats.lineMaterial);
  fob.group.position.set(0, -0.06 - rodLen - 0.44, 0);
  group.add(fob.group);

  // Fan Speed State
  const fanState = {
    speedMode: 1, // 0: Off, 1: Low, 2: High
    speeds: [0, 2.5, 6.0],
    toggle() {
      this.speedMode = (this.speedMode + 1) % this.speeds.length;
    }
  };

  tagInteractive(fob.mesh, group, {
    id: '18',
    code: 'CEILING_FAN',
    name: '三叶吊扇 / Aerodynamic Ceiling Fan',
    hint: '点击拉动悬垂珠链，切换吊扇转速或停止送风',
    category: '室内陈设 / Furnishing',
    onClick: () => fanState.toggle()
  }, interactiveTargets);

  // Also make the motor housing interactive
  motor.mesh.userData = fob.mesh.userData;
  interactiveTargets.push(motor.mesh);

  root.add(group);
  return { group, fanRotor, fanState };
}

/**
 * 19. Wind Chime (Top Wooden Hanger, 5 Tubular Chimes of Graduated Lengths, Clapper, Wind Sail)
 */
function buildWindChime(root, mats, interactiveTargets) {
  const group = new THREE.Group();
  group.name = 'Item_19_WindChime';
  group.position.set(0.53, 3.12, -3.20);

  // Top Suspension String from Ceiling
  group.add(createLine([
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(0, 0, 0)
  ], mats.lineMaterial));

  // Top Round Wooden Hanger Disc
  const hanger = createVectorMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.014, 20), mats.bgMaterial, mats.lineMaterial);
  group.add(hanger.group);

  // Harmonic Pendulum Assembly (Swings naturally in breeze)
  const chimePivot = new THREE.Group();
  group.add(chimePivot);

  // 5 Tubular Chimes of Graduated Lengths
  const tubeCount = 5;
  const tubeRadius = 0.045;
  const tubeLengths = [0.24, 0.29, 0.34, 0.40, 0.46];

  for (let i = 0; i < tubeCount; i++) {
    const angle = (i / tubeCount) * Math.PI * 2;
    const tx = Math.cos(angle) * tubeRadius;
    const tz = Math.sin(angle) * tubeRadius;
    const len = tubeLengths[i];

    // Suspension Cord
    chimePivot.add(createLine([
      new THREE.Vector3(tx, -0.007, tz),
      new THREE.Vector3(tx, -0.08, tz)
    ], mats.subtleLineMaterial));

    // Metallic Hollow Tube
    const tubeGeom = new THREE.CylinderGeometry(0.008, 0.008, len, 12, 1, true);
    const tube = createVectorMesh(tubeGeom, mats.bgMaterial, mats.lineMaterial);
    tube.group.position.set(tx, -0.08 - len / 2, tz);
    chimePivot.add(tube.group);
  }

  // Central Cord
  chimePivot.add(createLine([
    new THREE.Vector3(0, -0.007, 0),
    new THREE.Vector3(0, -0.62, 0)
  ], mats.lineMaterial));

  // Central Wooden Clapper / Striker Disc (hangs in center of tubes)
  const clapper = createVectorMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 16), mats.bgMaterial, mats.lineMaterial);
  clapper.group.position.set(0, -0.26, 0);
  chimePivot.add(clapper.group);

  // Wind Sail / Catcher Pendant at the Bottom
  const sail = createVectorMesh(new THREE.BoxGeometry(0.045, 0.085, 0.006), mats.bgMaterial, mats.lineMaterial);
  sail.group.position.set(0, -0.66, 0);
  chimePivot.add(sail.group);

  // Chime Gentle Sway State
  const chimeState = {
    swayImpulse: 0,
    chime() {
      this.swayImpulse = 1.6;
    }
  };

  tagInteractive(sail.mesh, group, {
    id: '19',
    code: 'WIND_CHIME',
    name: '五音金属风铃 / Harmonic Wind Chime',
    hint: '点击轻拂风铃，聆听微风中空灵悠扬的金属余韵',
    category: '生活器物 / Living',
    onClick: () => chimeState.chime()
  }, interactiveTargets);

  root.add(group);
  return { group, chimePivot, chimeState };
}

/**
 * 20. Light Switch (Dual Rocker Wall Switch Plate, Toggle Paddles, Screws)
 */
function buildLightSwitch(root, mats, interactiveTargets, callbacks) {
  const group = new THREE.Group();
  group.name = 'Item_20_LightSwitch';
  group.position.set(-3.37, 1.35, 0.85);

  const plateW = 0.085;
  const plateH = 0.13;
  const plateD = 0.012;

  // Beveled Wall Switch Faceplate
  const plateGeom = new THREE.BoxGeometry(plateD, plateH, plateW);
  const plate = createVectorMesh(plateGeom, mats.bgMaterial, mats.lineMaterial);
  group.add(plate.group);

  // Slotted Mounting Screws (Top and Bottom)
  [0.05, -0.05].forEach(sy => {
    const screwCircle = createCircleLine(0.004, 10, mats.lineMaterial, 'zy');
    screwCircle.position.set(plateD / 2 + 0.001, sy, 0);
    group.add(screwCircle);

    // Slot Line
    const slot = createLine([
      new THREE.Vector3(plateD / 2 + 0.002, sy - 0.003, 0),
      new THREE.Vector3(plateD / 2 + 0.002, sy + 0.003, 0)
    ], mats.lineMaterial);
    group.add(slot);
  });

  // Dual Rocker Paddles:
  // Rocker 1 (Left / Front): Toggles Desk Lamp Spotlight
  // Rocker 2 (Right / Back): Toggles Day / Night Room Mode
  const rockerW = 0.024;
  const rockerH = 0.048;

  const rocker1Pivot = new THREE.Group();
  rocker1Pivot.position.set(plateD / 2 + 0.004, 0, -0.018);
  const rocker1 = createVectorMesh(new THREE.BoxGeometry(0.008, rockerH, rockerW), mats.bgMaterial, mats.lineMaterial);
  rocker1Pivot.add(rocker1.group);
  rocker1Pivot.rotation.z = -0.15; // default ON
  group.add(rocker1Pivot);

  const rocker2Pivot = new THREE.Group();
  rocker2Pivot.position.set(plateD / 2 + 0.004, 0, 0.018);
  const rocker2 = createVectorMesh(new THREE.BoxGeometry(0.008, rockerH, rockerW), mats.bgMaterial, mats.lineMaterial);
  rocker2Pivot.add(rocker2.group);
  rocker2Pivot.rotation.z = -0.15; // default Day
  group.add(rocker2Pivot);

  const switchState = {
    lampActive: true,
    nightActive: false,
    toggleSwitch() {
      this.nightActive = !this.nightActive;
      rocker2Pivot.rotation.z = this.nightActive ? 0.15 : -0.15;
      if (callbacks && callbacks.onToggleTheme) {
        callbacks.onToggleTheme(this.nightActive);
      }
    }
  };

  tagInteractive(plate.mesh, group, {
    id: '20',
    code: 'LIGHT_SWITCH',
    name: '双联墙面开关 / Dual Rocker Switch',
    hint: '点击按动开关，切换昼夜采光模式与室内灯效',
    category: '建筑构件 / Architectural',
    onClick: () => switchState.toggleSwitch()
  }, interactiveTargets);

  // Also make rockers clickable
  rocker1.mesh.userData = plate.mesh.userData;
  rocker2.mesh.userData = plate.mesh.userData;
  interactiveTargets.push(rocker1.mesh, rocker2.mesh);

  root.add(group);
  return { group, rocker1Pivot, rocker2Pivot, switchState };
}

// =========================================================================
// CATALOG DATA FOR MODAL UI (All 20+ Items Bilingual Info)
// =========================================================================
export const ROOM_CATALOG = [
  { id: '01', code: 'DOOR', name: '平开木门 / Wooden Door', hint: '点击推拉开关木门，感受线稿空间的虚实开合', category: '建筑构件 / Architectural' },
  { id: '02', code: 'WINDOW', name: '建筑景观窗 / Architectural Window', hint: '点击远眺窗外群山、日月与飞鸟的矢量全景', category: '建筑构件 / Architectural' },
  { id: '03', code: 'BLINDS', name: '百叶窗帘 / Venetian Blinds', hint: '点击拉绳调节百叶片倾角，控制室外采光入界', category: '室内陈设 / Furnishing' },
  { id: '04', code: 'DESK', name: '实木工作台 / Solid Wood Desk', hint: '极简北欧实木桌，配有皮质桌垫与精密绘图工具', category: '家具器物 / Furniture' },
  { id: '05', code: 'DESK_LAMP', name: '铰接绘图台灯 / Drafting Lamp', hint: '点击开关台灯，点亮工作台上的聚焦光锥', category: '室内陈设 / Furnishing' },
  { id: '06', code: 'CUP', name: '咖啡杯与托盘 / Coffee Mug & Saucer', hint: '点击观察杯中手冲咖啡表面泛起的同心涟漪', category: '生活器物 / Living' },
  { id: '07', code: 'CHAIR', name: '人体工学转椅 / Swivel Office Chair', hint: '点击旋转椅子，观察五星脚轮与座面线稿', category: '家具器物 / Furniture' },
  { id: '08', code: 'BOOKSHELF', name: '建筑书架与藏书 / Bookshelf & Books', hint: '点击抽阅书架上的精装建筑特刊，观察书脊与纸页线构', category: '藏书文献 / Books' },
  { id: '09', code: 'CABINET', name: '收纳边柜与抽屉 / Sideboard Credenza', hint: '点击拉开上层收纳抽屉，观察精密滑轨与接缝线', category: '家具器物 / Furniture' },
  { id: '10', code: 'WALL_CLOCK', name: '极简机械挂钟 / Minimalist Wall Clock', hint: '精准指针与现实时间同步静默走动', category: '室内陈设 / Furnishing' },
  { id: '11', code: 'SOFA', name: '双人布艺沙发 / 2-Seater Modern Sofa', hint: '点击轻触体验座面回弹与细致缝线折痕', category: '家具器物 / Furniture' },
  { id: '12', code: 'PILLOWS', name: '几何纹理抱枕 / Geometric Pillows', hint: '点击拍打抱枕，欣赏表面织造的包豪斯菱格纹理', category: '室内陈设 / Furnishing' },
  { id: '13', code: 'COFFEE_TABLE', name: '极简发夹腿茶几 / Wireframe Coffee Table', hint: '纤细钢丝腿几面，陈列玻璃水器与现代设计刊物', category: '家具器物 / Furniture' },
  { id: '14', code: 'RUG', name: '几何编织羊毛地毯 / Geometric Area Rug', hint: '包豪斯几何图腾密织羊毛地毯，两侧带细致手工流苏', category: '室内陈设 / Furnishing' },
  { id: '15', code: 'RECORD_PLAYER', name: '复古黑胶唱机 / Turntable Record Player', hint: '点击落针播放黑胶唱片，观察唱盘微缝与唱臂旋转', category: '生活器物 / Living' },
  { id: '16', code: 'WALL_ART', name: '画廊艺术挂画 / Framed Gallery Art', hint: '点击画框切换展出的三种现代主义矢量线稿艺术画作', category: '艺术陈列 / Art' },
  { id: '17', code: 'GLOBE', name: '复古桌面地球仪 / Desktop Globe', hint: '点击拨动地球仪，观察沿 23.5° 地轴旋转的经纬线网', category: '藏书文献 / Books' },
  { id: '18', code: 'CEILING_FAN', name: '三叶吊扇 / Aerodynamic Ceiling Fan', hint: '点击拉动悬垂珠链，切换吊扇转速或停止送风', category: '室内陈设 / Furnishing' },
  { id: '19', code: 'WIND_CHIME', name: '五音金属风铃 / Harmonic Wind Chime', hint: '点击轻拂风铃，聆听微风中空灵悠扬的金属余韵', category: '生活器物 / Living' },
  { id: '20', code: 'LIGHT_SWITCH', name: '双联墙面开关 / Dual Rocker Switch', hint: '点击按动开关，切换昼夜采光模式与室内灯效', category: '建筑构件 / Architectural' }
];

// =========================================================================
// MAIN EXPORT FUNCTION: buildRoom(scene, callbacks)
// =========================================================================
/**
 * Builds the complete 3D vector line art room and all 20 required room items.
 *
 * @param {THREE.Scene} scene - The main Three.js scene
 * @param {Object} [callbacks] - Optional event hooks (e.g. onToggleTheme)
 * @returns {Object} Complete room instance with interactive targets, materials, and update hooks
 */
export function buildRoom(scene, callbacks = {}) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PureLineRoom_Root';
  scene.add(rootGroup);

  // Initialize line art material system
  const materials = createMaterials();

  // Raycastable interactive meshes list
  const interactiveTargets = [];

  // Theme change callback relay
  const relayCallbacks = {
    onToggleTheme: (isNight) => {
      materials.updateTheme(isNight);
      if (callbacks.onToggleTheme) {
        callbacks.onToggleTheme(isNight);
      }
    }
  };

  // Build Room Shell and all 20 items
  const architecture = buildArchitecture(rootGroup, materials);
  const door = buildDoor(rootGroup, materials, interactiveTargets);
  const windowObj = buildWindow(rootGroup, materials, interactiveTargets);
  const blinds = buildBlinds(rootGroup, materials, interactiveTargets);
  const desk = buildDesk(rootGroup, materials, interactiveTargets);
  const deskLamp = buildDeskLamp(rootGroup, materials, interactiveTargets);
  const cup = buildCup(rootGroup, materials, interactiveTargets);
  const chair = buildChair(rootGroup, materials, interactiveTargets);
  const bookshelf = buildBookshelf(rootGroup, materials, interactiveTargets);
  const cabinet = buildCabinet(rootGroup, materials, interactiveTargets);
  const wallClock = buildWallClock(rootGroup, materials, interactiveTargets);
  const sofa = buildSofa(rootGroup, materials, interactiveTargets);
  const pillows = buildPillows(rootGroup, materials, interactiveTargets);
  const coffeeTable = buildCoffeeTable(rootGroup, materials, interactiveTargets);
  const rug = buildRug(rootGroup, materials, interactiveTargets);
  const recordPlayer = buildRecordPlayer(rootGroup, materials, interactiveTargets);
  const wallArt = buildWallArt(rootGroup, materials, interactiveTargets);
  const globe = buildGlobe(rootGroup, materials, interactiveTargets);
  const ceilingFan = buildCeilingFan(rootGroup, materials, interactiveTargets);
  const windChime = buildWindChime(rootGroup, materials, interactiveTargets);
  const lightSwitch = buildLightSwitch(rootGroup, materials, interactiveTargets, relayCallbacks);

  const items = {
    architecture,
    door,
    window: windowObj,
    blinds,
    desk,
    deskLamp,
    cup,
    chair,
    bookshelf,
    cabinet,
    wallClock,
    sofa,
    pillows,
    coffeeTable,
    rug,
    recordPlayer,
    wallArt,
    globe,
    ceilingFan,
    windChime,
    lightSwitch
  };

  /**
   * Main per-frame animation and dynamic physics update
   */
  function update(delta, elapsed) {
    // 1. Door smooth swing
    door.doorState.currentAngle = THREE.MathUtils.lerp(
      door.doorState.currentAngle,
      door.doorState.targetAngle,
      delta * 6
    );
    door.hingePivot.rotation.y = door.doorState.currentAngle;

    // 2. Blinds slat tilt
    blinds.blindsState.tiltAngle = THREE.MathUtils.lerp(
      blinds.blindsState.tiltAngle,
      blinds.blindsState.targetAngle,
      delta * 7
    );
    blinds.slatGroups.forEach(sg => {
      sg.pivot.rotation.x = blinds.blindsState.tiltAngle;
    });

    // 3. Chair spin with friction damping
    if (chair.chairState.spinVelocity !== 0) {
      chair.swivelGroup.rotation.y += chair.chairState.spinVelocity * delta;
      chair.chairState.spinVelocity *= Math.pow(0.2, delta); // exponential damping
      if (Math.abs(chair.chairState.spinVelocity) < 0.01) {
        chair.chairState.spinVelocity = 0;
      }
    }

    // 4. Bookshelf special pull-out book animation
    if (bookshelf.pullOutBookGroup) {
      bookshelf.bookState.currentZ = THREE.MathUtils.lerp(
        bookshelf.bookState.currentZ,
        bookshelf.bookState.targetZ,
        delta * 6
      );
      bookshelf.pullOutBookGroup.position.z = -0.02 + bookshelf.bookState.currentZ;
    }

    // 5. Cabinet sliding drawer animation
    cabinet.drawerState.currentX = THREE.MathUtils.lerp(
      cabinet.drawerState.currentX,
      cabinet.drawerState.targetX,
      delta * 6
    );
    cabinet.drawerPivot.position.x = cabinet.drawerState.currentX;

    // 6. Wall Clock continuous sweeping hands synchronized with system time
    const now = new Date();
    const secFrac = now.getSeconds() + now.getMilliseconds() / 1000;
    const minFrac = now.getMinutes() + secFrac / 60;
    const hourFrac = (now.getHours() % 12) + minFrac / 60;

    wallClock.secHandPivot.rotation.x = -(secFrac / 60) * Math.PI * 2;
    wallClock.minHandPivot.rotation.x = -(minFrac / 60) * Math.PI * 2;
    wallClock.hourHandPivot.rotation.x = -(hourFrac / 12) * Math.PI * 2;

    // 7. Sofa cushion bounce
    sofa.sofaState.bounceY = THREE.MathUtils.lerp(
      sofa.sofaState.bounceY,
      sofa.sofaState.targetY,
      delta * 12
    );
    sofa.cushionGroup.position.y = sofa.sofaState.bounceY;

    // 8. Turntable vinyl spinning and tonearm movement
    recordPlayer.turntableState.currentAngle = THREE.MathUtils.lerp(
      recordPlayer.turntableState.currentAngle,
      recordPlayer.turntableState.targetAngle,
      delta * 4
    );
    recordPlayer.armPivotHead.rotation.y = recordPlayer.turntableState.currentAngle;

    if (recordPlayer.turntableState.isPlaying) {
      recordPlayer.turntablePlatter.rotation.y += delta * 3.48; // 33 RPM approx
    }

    // 9. Globe spin inertia
    if (globe.globeState.spinVelocity !== 0) {
      globe.worldLinesGroup.rotation.y += globe.globeState.spinVelocity * delta;
      globe.globeState.spinVelocity *= Math.pow(0.35, delta);
      if (Math.abs(globe.globeState.spinVelocity) < 0.01) {
        globe.globeState.spinVelocity = 0;
      }
    }

    // 10. Ceiling fan spinning
    const fanSpeed = ceilingFan.fanState.speeds[ceilingFan.fanState.speedMode];
    if (fanSpeed > 0) {
      ceilingFan.fanRotor.rotation.y += fanSpeed * delta;
    }

    // 11. Wind chime harmonic sway
    if (windChime.chimeState.swayImpulse > 0) {
      windChime.chimeState.swayImpulse *= Math.pow(0.4, delta);
      if (windChime.chimeState.swayImpulse < 0.01) {
        windChime.chimeState.swayImpulse = 0;
      }
    }
    const naturalSway = Math.sin(elapsed * 1.8) * 0.024;
    const impulseSway = Math.sin(elapsed * 9.0) * windChime.chimeState.swayImpulse * 0.08;
    windChime.chimePivot.rotation.z = naturalSway + impulseSway;
    windChime.chimePivot.rotation.x = Math.cos(elapsed * 1.4) * 0.018;

    // 12. Coffee steam wafting
    cup.steamGroup.position.y = 0.1 + Math.sin(elapsed * 2.5) * 0.006;
    cup.steamGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.12;
  }

  /**
   * Set theme (Day or Night)
   *
   * @param {boolean} isNight
   */
  function setTheme(isNight) {
    materials.updateTheme(isNight);
    lightSwitch.switchState.nightActive = isNight;
    lightSwitch.rocker2Pivot.rotation.z = isNight ? 0.15 : -0.15;
    scene.background = new THREE.Color(isNight ? 0x13161c : 0xf6f7f9);
  }

  /**
   * Handle user click interaction with raycasted hit mesh
   *
   * @param {THREE.Object3D} intersectedObject
   * @returns {Object|null} The userData of interacted item
   */
  function handleInteraction(intersectedObject) {
    if (!intersectedObject) return null;
    const data = intersectedObject.userData;
    if (data && data.interactive) {
      if (typeof data.onClick === 'function') {
        data.onClick();
      }
      return data;
    }
    return null;
  }

  /**
   * Get metadata info for hovered object
   */
  function getHoverInfo(intersectedObject) {
    if (!intersectedObject || !intersectedObject.userData) return null;
    return intersectedObject.userData.interactive ? intersectedObject.userData : null;
  }

  return {
    rootGroup,
    materials,
    items,
    interactiveTargets,
    catalog: ROOM_CATALOG,
    update,
    setTheme,
    handleInteraction,
    getHoverInfo
  };
}

/**
 * Convenience OOP Wrapper Class
 */
export class Room {
  constructor(scene, callbacks) {
    const room = buildRoom(scene, callbacks);
    Object.assign(this, room);
  }
}
