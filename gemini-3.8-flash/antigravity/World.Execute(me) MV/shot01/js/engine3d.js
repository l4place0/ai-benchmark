/**
 * 3D / 4D Perspective Projection and Procedural Geometric Engine
 * Pure functional mathematical geometry: no mutable accumulative state.
 */

export class Engine3D {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.fov = 950;
    this.cx = width / 2;
    this.cy = height / 2;
  }

  // Project 3D point (x, y, z) to 2D screen coords (sx, sy, scale)
  project(x, y, z) {
    if (z <= 1) z = 1;
    const scale = this.fov / z;
    const sx = this.cx + x * scale;
    const sy = this.cy + y * scale;
    return { x: sx, y: sy, scale, z };
  }

  // Rotate point (x, y, z) around Euler angles (ax, ay, az)
  rotate3D(x, y, z, ax, ay, az) {
    // Rotate X
    const cosX = Math.cos(ax), sinX = Math.sin(ax);
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;

    // Rotate Y
    const cosY = Math.cos(ay), sinY = Math.sin(ay);
    let x2 = x * cosY + z1 * sinY;
    let z2 = -x * sinY + z1 * cosY;

    // Rotate Z
    const cosZ = Math.cos(az), sinZ = Math.sin(az);
    let x3 = x2 * cosZ - y1 * sinZ;
    let y3 = x2 * sinZ + y1 * cosZ;

    return { x: x3, y: y3, z: z2 };
  }

  /**
   * 4D Tesseract (Hypercube) Projection
   * Computes rotated 4D hypercube projected through 3D into 2D screen.
   */
  getTesseractEdges(t, scale = 220) {
    // Generate 16 vertices of a 4D hypercube: (±1, ±1, ±1, ±1)
    const vertices4D = [];
    for (let i = 0; i < 16; i++) {
      const x = (i & 1) ? 1 : -1;
      const y = (i & 2) ? 1 : -1;
      const z = (i & 4) ? 1 : -1;
      const w = (i & 8) ? 1 : -1;
      vertices4D.push({ x, y, z, w });
    }

    // 4D Rotations: X-W plane and Y-Z plane
    const angleXW = t * 1.2;
    const angleYZ = t * 0.8;
    const angleXY = t * 0.5;

    const cosXW = Math.cos(angleXW), sinXW = Math.sin(angleXW);
    const cosYZ = Math.cos(angleYZ), sinYZ = Math.sin(angleYZ);
    const cosXY = Math.cos(angleXY), sinXY = Math.sin(angleXY);

    const projected3D = vertices4D.map(v => {
      // Rotate in X-W
      let x = v.x * cosXW - v.w * sinXW;
      let w = v.x * sinXW + v.w * cosXW;

      // Rotate in Y-Z
      let y = v.y * cosYZ - v.z * sinYZ;
      let z = v.y * sinYZ + v.z * cosYZ;

      // Rotate in X-Y
      let x2 = x * cosXY - y * sinXY;
      let y2 = x * sinXY + y * cosXY;

      // Project 4D to 3D with 4D perspective: distance = 2.5
      const distance4D = 2.4;
      const pScale = 1.0 / (distance4D - w);
      return {
        x: x2 * pScale * scale,
        y: y2 * pScale * scale,
        z: z * pScale * scale + 580 // distance from 3D camera
      };
    });

    // 2D screen projection
    const screenPoints = projected3D.map(p => this.project(p.x, p.y, p.z));

    // Generate 32 edges (connecting vertices differing by exactly 1 bit)
    const edges = [];
    for (let i = 0; i < 16; i++) {
      for (let bit = 1; bit <= 8; bit <<= 1) {
        if (!(i & bit)) {
          const j = i | bit;
          edges.push({
            p1: screenPoints[i],
            p2: screenPoints[j],
            depth: (projected3D[i].z + projected3D[j].z) * 0.5
          });
        }
      }
    }
    return { points: screenPoints, edges };
  }

  /**
   * 3D Polyhedron / Icosahedron Wireframe
   */
  getIcosahedron(t, radius = 200, cameraDist = 600) {
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const rawVertices = [
      [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
      [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
      [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1]
    ];

    // Normalize and scale
    const vertices = rawVertices.map(v => {
      const len = Math.hypot(v[0], v[1], v[2]);
      return {
        x: (v[0] / len) * radius,
        y: (v[1] / len) * radius,
        z: (v[2] / len) * radius
      };
    });

    const ax = t * 0.9;
    const ay = t * 1.3;
    const az = t * 0.4;

    const screenPoints = vertices.map(v => {
      const r = this.rotate3D(v.x, v.y, v.z, ax, ay, az);
      return this.project(r.x, r.y, r.z + cameraDist);
    });

    // 30 edges of icosahedron
    const edgeIndices = [
      [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
      [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
      [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
      [4, 9], [2, 4], [6, 2], [8, 6], [9, 8],
      [4, 5], [5, 9], [8, 1], [1, 9], [7, 8],
      [6, 7], [10, 6], [2, 10], [11, 2], [4, 11]
    ];

    const edges = edgeIndices.map(([i, j]) => ({
      p1: screenPoints[i],
      p2: screenPoints[j]
    }));

    return { points: screenPoints, edges };
  }

  /**
   * 3D DNA Double Helix Generator
   * Pure function of time t
   */
  getDNAHelix(t, length = 800, turns = 4, basePairs = 48) {
    const pointsA = [];
    const pointsB = [];
    const rungs = [];
    const radius = 120;
    const rotSpeed = t * 1.5;

    for (let i = 0; i < basePairs; i++) {
      const fraction = i / basePairs;
      const y = (fraction - 0.5) * length;
      const angle = fraction * Math.PI * 2 * turns + rotSpeed;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius + 550;

      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius + 550;

      const pA = this.project(x1, y, z1);
      const pB = this.project(x2, y, z2);

      pointsA.push(pA);
      pointsB.push(pB);
      rungs.push({ p1: pA, p2: pB, z: (z1 + z2) * 0.5, i });
    }

    return { strandA: pointsA, strandB: pointsB, rungs };
  }

  /**
   * Infinite Cyber Grid Floor
   * Renders glowing perspective grid scrolling toward horizon
   */
  renderGridFloor(ctx, t, speed = 180, gridZDepth = 1400) {
    const horizonY = this.cy + 120;
    const groundY = 280;
    const numZLines = 24;
    const zSpacing = 80;
    const offsetZ = (t * speed) % zSpacing;

    ctx.save();
    ctx.lineWidth = 1.5;

    // Transverse lines (horizontal lines moving forward)
    for (let i = 0; i < numZLines; i++) {
      const z = i * zSpacing + offsetZ + 40;
      const pLeft = this.project(-1200, groundY, z);
      const pRight = this.project(1200, groundY, z);

      const alpha = Math.max(0, 1 - z / gridZDepth);
      ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.45})`;

      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();
    }

    // Longitudinal lines (perspective converging to horizon)
    const numXLines = 28;
    for (let i = -numXLines / 2; i <= numXLines / 2; i++) {
      const x = i * 100;
      const pNear = this.project(x, groundY, 40);
      const pFar = this.project(x, groundY, gridZDepth);

      ctx.strokeStyle = `rgba(0, 243, 255, 0.25)`;
      ctx.beginPath();
      ctx.moveTo(pNear.x, pNear.y);
      ctx.lineTo(pFar.x, pFar.y);
      ctx.stroke();
    }

    // Horizon glowing neon line
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f3ff';
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(this.width, horizonY);
    ctx.stroke();

    ctx.restore();
  }
}
