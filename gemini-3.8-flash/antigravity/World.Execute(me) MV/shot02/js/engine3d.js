/**
 * Pure Mathematical 3D & 4D Procedural Geometry Engine
 * Deterministic frame = f(t) geometry generator
 */

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

export class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
}

// 4D Tesseract (Hypercube) generator: 16 vertices, 32 edges
export const TESSERACT_VERTICES = [];
for (let i = 0; i < 16; i++) {
  TESSERACT_VERTICES.push(new Vector4(
    (i & 1) ? 1 : -1,
    (i & 2) ? 1 : -1,
    (i & 4) ? 1 : -1,
    (i & 8) ? 1 : -1
  ));
}

export const TESSERACT_EDGES = [];
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    const diff = i ^ j;
    // Edge exists if indices differ by exactly 1 bit (Hamming distance 1)
    if ((diff & (diff - 1)) === 0) {
      TESSERACT_EDGES.push([i, j]);
    }
  }
}

// Regular Icosahedron (Golden Ratio phi)
const PHI = (1 + Math.sqrt(5)) / 2;
export const ICOSAHEDRON_VERTICES = [
  new Vector3(-1,  PHI, 0), new Vector3( 1,  PHI, 0), new Vector3(-1, -PHI, 0), new Vector3( 1, -PHI, 0),
  new Vector3( 0, -1,  PHI), new Vector3( 0,  1,  PHI), new Vector3( 0, -1, -PHI), new Vector3( 0,  1, -PHI),
  new Vector3( PHI, 0, -1), new Vector3( PHI, 0,  1), new Vector3(-PHI, 0, -1), new Vector3(-PHI, 0,  1)
];

export const ICOSAHEDRON_EDGES = [];
for (let i = 0; i < ICOSAHEDRON_VERTICES.length; i++) {
  for (let j = i + 1; j < ICOSAHEDRON_VERTICES.length; j++) {
    const v1 = ICOSAHEDRON_VERTICES[i];
    const v2 = ICOSAHEDRON_VERTICES[j];
    const distSq = (v1.x - v2.x)**2 + (v1.y - v2.y)**2 + (v1.z - v2.z)**2;
    // For normalized icosahedron, edge length squared is 4
    if (Math.abs(distSq - 4) < 0.1) {
      ICOSAHEDRON_EDGES.push([i, j]);
    }
  }
}

/**
 * Rotate a 4D point in the XW and ZY planes, then project to 3D and 2D.
 */
export function projectTesseract(cx, cy, scale, t) {
  const rotXW = t * 0.9;
  const rotZY = t * 0.7;
  const rotXY = t * 0.5;

  const cosXW = Math.cos(rotXW), sinXW = Math.sin(rotXW);
  const cosZY = Math.cos(rotZY), sinZY = Math.sin(rotZY);
  const cosXY = Math.cos(rotXY), sinXY = Math.sin(rotXY);

  const projected3D = [];
  const projected2D = [];

  for (let i = 0; i < TESSERACT_VERTICES.length; i++) {
    const v = TESSERACT_VERTICES[i];
    let x = v.x, y = v.y, z = v.z, w = v.w;

    // Rotation in XW plane
    const x1 = x * cosXW - w * sinXW;
    const w1 = x * sinXW + w * cosXW;

    // Rotation in ZY plane
    const y1 = y * cosZY - z * sinZY;
    const z1 = y * sinZY + z * cosZY;

    // Rotation in XY plane
    const x2 = x1 * cosXY - y1 * sinXY;
    const y2 = x1 * sinXY + y1 * cosXY;

    // 4D to 3D perspective projection
    const d4 = 2.4;
    const p4 = d4 / (d4 - w1);
    const pX = x2 * p4;
    const pY = y2 * p4;
    const pZ = z1 * p4;

    projected3D.push({ x: pX, y: pY, z: pZ, w: w1 });

    // 3D to 2D perspective projection
    const d3 = 3.5;
    const p3 = d3 / (d3 + pZ);
    const screenX = cx + pX * scale * p3;
    const screenY = cy + pY * scale * p3;

    projected2D.push({ x: screenX, y: screenY, z: pZ, w: w1 });
  }

  return { vertices: projected2D, edges: TESSERACT_EDGES };
}

/**
 * 3D DNA Double Helix Generator
 */
export function generateDNA(cx, cy, scale, t, length = 28) {
  const pointsA = [];
  const pointsB = [];
  const rungs = [];

  const rotSpeed = t * 1.5;
  const stepY = 22 * (scale / 100);
  const radius = 65 * (scale / 100);

  for (let i = 0; i < length; i++) {
    const theta = rotSpeed + i * 0.35;
    const y = cy - (length * stepY) / 2 + i * stepY;

    // Strand A
    const xA = cx + Math.cos(theta) * radius;
    const zA = Math.sin(theta) * radius;
    // Strand B (180 deg shifted)
    const xB = cx + Math.cos(theta + Math.PI) * radius;
    const zB = Math.sin(theta + Math.PI) * radius;

    // Perspective factor
    const pA = 1000 / (1000 + zA);
    const pB = 1000 / (1000 + zB);

    const ptA = { x: cx + (xA - cx) * pA, y: cy + (y - cy) * pA, z: zA };
    const ptB = { x: cx + (xB - cx) * pB, y: cy + (y - cy) * pB, z: zB };

    pointsA.push(ptA);
    pointsB.push(ptB);

    if (i % 2 === 0) {
      rungs.push({ a: ptA, b: ptB, index: i });
    }
  }

  return { strandA: pointsA, strandB: pointsB, rungs };
}

/**
 * Parametric 3D Cardioid Heart Generator
 * (x² + y² - 1)³ - x² y³ = 0
 */
export function generateCardioidHeart(cx, cy, scale, t, count = 72) {
  const points = [];
  const rotY = t * 1.2;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  for (let i = 0; i < count; i++) {
    const u = (i / count) * Math.PI * 2;
    // Standard parametric heart formula
    const hx = 16 * Math.pow(Math.sin(u), 3);
    const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
    
    // Rotate in 3D around Y axis
    const worldX = hx * cosY * scale;
    const worldZ = hx * sinY * scale;
    const worldY = hy * scale;

    const p = 800 / (800 + worldZ);
    points.push({
      x: cx + worldX * p,
      y: cy + worldY * p,
      z: worldZ
    });
  }

  return points;
}

/**
 * Icosahedron 3D projection
 */
export function projectIcosahedron(cx, cy, scale, t) {
  const rx = t * 0.8;
  const ry = t * 1.1;
  const rz = t * 0.5;

  const cx_rot = Math.cos(rx), sx_rot = Math.sin(rx);
  const cy_rot = Math.cos(ry), sy_rot = Math.sin(ry);
  const cz_rot = Math.cos(rz), sz_rot = Math.sin(rz);

  const projected2D = [];

  for (let i = 0; i < ICOSAHEDRON_VERTICES.length; i++) {
    const v = ICOSAHEDRON_VERTICES[i];
    // Rotate around X
    let y1 = v.y * cx_rot - v.z * sx_rot;
    let z1 = v.y * sx_rot + v.z * cx_rot;
    // Rotate around Y
    let x2 = v.x * cy_rot + z1 * sy_rot;
    let z2 = -v.x * sy_rot + z1 * cy_rot;
    // Rotate around Z
    let x3 = x2 * cz_rot - y1 * sz_rot;
    let y3 = x2 * sz_rot + y1 * cz_rot;

    const dist = 4.0;
    const p = dist / (dist + z2);

    projected2D.push({
      x: cx + x3 * scale * p,
      y: cy + y3 * scale * p,
      z: z2
    });
  }

  return { vertices: projected2D, edges: ICOSAHEDRON_EDGES };
}
