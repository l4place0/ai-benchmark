// js/voxel/voxelBuilder.js
import * as THREE from 'three';

export class VoxelScene {
  constructor(voxelSize = 1.0) {
    this.voxelSize = voxelSize;
    // Map to store unique voxels: key `${x},${y},${z}` -> { x, y, z, color, groupPath, name }
    this.voxels = new Map();
  }

  // Set or add a single voxel
  set(x, y, z, color, groupPath = 'Others', name = '') {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rz = Math.round(z);
    const key = `${rx},${ry},${rz}`;
    this.voxels.set(key, {
      x: rx,
      y: ry,
      z: rz,
      color: typeof color === 'string' ? color : (color.isColor ? '#' + color.getHexString() : '#ffffff'),
      groupPath,
      name
    });
  }

  // Delete a voxel
  delete(x, y, z) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    this.voxels.delete(key);
  }

  // Check if a voxel exists
  has(x, y, z) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    return this.voxels.has(key);
  }

  // Fill an axis-aligned voxel box
  fillBox(minX, minY, minZ, maxX, maxY, maxZ, colorFn, groupPath = 'Others', name = '') {
    const x0 = Math.min(minX, maxX);
    const x1 = Math.max(minX, maxX);
    const y0 = Math.min(minY, maxY);
    const y1 = Math.max(minY, maxY);
    const z0 = Math.min(minZ, maxZ);
    const z1 = Math.max(minZ, maxZ);

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const col = typeof colorFn === 'function' ? colorFn(x, y, z) : colorFn;
          if (col) {
            this.set(x, y, z, col, groupPath, name);
          }
        }
      }
    }
  }

  // Fill a discrete stepped circular ring
  fillRing(cx, cz, rInner, rOuter, minY, maxY, colorFn, groupPath = 'Others', name = '', angleFilter = null) {
    const rMaxCeil = Math.ceil(rOuter);
    for (let y = minY; y <= maxY; y++) {
      for (let dz = -rMaxCeil; dz <= rMaxCeil; dz++) {
        for (let dx = -rMaxCeil; dx <= rMaxCeil; dx++) {
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist >= rInner && dist <= rOuter) {
            if (angleFilter) {
              const angle = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360; // 0 south, 90 east, 180 north, 270 west
              if (!angleFilter(angle, dist, y)) continue;
            }
            const wx = cx + dx;
            const wz = cz + dz;
            const col = typeof colorFn === 'function' ? colorFn(wx, y, wz, dist) : colorFn;
            if (col) {
              this.set(wx, y, wz, col, groupPath, name);
            }
          }
        }
      }
    }
  }

  // Build the hierarchical Three.js scene matching Section 13
  buildHierarchy(rootScene) {
    // Collect voxels by groupPath
    const groups = new Map();

    for (const [key, v] of this.voxels.entries()) {
      if (!groups.has(v.groupPath)) {
        groups.set(v.groupPath, []);
      }
      groups.get(v.groupPath).push(v);
    }

    // Standard shared Box Geometry with subtle scale for distinct voxel art look
    const geom = new THREE.BoxGeometry(this.voxelSize * 0.985, this.voxelSize * 0.985, this.voxelSize * 0.985);

    // Create hierarchy nodes
    const nodeCache = new Map();

    const getNode = (path) => {
      if (nodeCache.has(path)) return nodeCache.get(path);
      const parts = path.split('/');
      let current = rootScene;
      let accum = '';
      for (const part of parts) {
        accum = accum ? `${accum}/${part}` : part;
        if (nodeCache.has(accum)) {
          current = nodeCache.get(accum);
        } else {
          const group = new THREE.Group();
          group.name = part;
          current.add(group);
          nodeCache.set(accum, group);
          current = group;
        }
      }
      return current;
    };

    // Material with stylized voxel shading
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.04,
      flatShading: true
    });

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    for (const [groupPath, vList] of groups.entries()) {
      const parentNode = getNode(groupPath);
      const count = vList.length;
      if (count === 0) continue;

      const instMesh = new THREE.InstancedMesh(geom, material.clone(), count);
      instMesh.name = `${parentNode.name}_VoxelMesh`;
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;

      for (let i = 0; i < count; i++) {
        const v = vList[i];
        dummy.position.set(v.x * this.voxelSize, v.y * this.voxelSize, v.z * this.voxelSize);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);

        tempColor.set(v.color);
        instMesh.setColorAt(i, tempColor);
      }

      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;

      parentNode.add(instMesh);
    }

    console.log(`VoxelScene built successfully: ${this.voxels.size} total voxels across ${groups.size} groups.`);
    return nodeCache;
  }

  // Export scene voxels as Wavefront OBJ with vertex colors
  toOBJString() {
    let out = "# Hakka Tulou Voxel Art Model\n";
    out += `# Total Voxels: ${this.voxels.size}\n\n`;

    const half = (this.voxelSize * 0.985) / 2;
    // 8 vertices for a cube offset by (x, y, z)
    const cubeVerts = [
      [-half, -half, -half],
      [ half, -half, -half],
      [ half,  half, -half],
      [-half,  half, -half],
      [-half, -half,  half],
      [ half, -half,  half],
      [ half,  half,  half],
      [-half,  half,  half]
    ];

    // 6 faces (quads converted to 2 triangles each)
    const faces = [
      [0, 1, 2, 3], // back
      [5, 4, 7, 6], // front
      [4, 0, 3, 7], // left
      [1, 5, 6, 2], // right
      [3, 2, 6, 7], // top
      [4, 5, 1, 0]  // bottom
    ];

    let vertIndex = 1;
    const c = new THREE.Color();

    for (const [key, v] of this.voxels.entries()) {
      c.set(v.color);
      const cr = c.r.toFixed(4);
      const cg = c.g.toFixed(4);
      const cb = c.b.toFixed(4);

      const px = v.x * this.voxelSize;
      const py = v.y * this.voxelSize;
      const pz = v.z * this.voxelSize;

      for (let i = 0; i < 8; i++) {
        const vx = (px + cubeVerts[i][0]).toFixed(3);
        const vy = (py + cubeVerts[i][1]).toFixed(3);
        const vz = (pz + cubeVerts[i][2]).toFixed(3);
        out += `v ${vx} ${vy} ${vz} ${cr} ${cg} ${cb}\n`;
      }

      out += `g ${v.groupPath.replace(/\//g, '_')}\n`;
      for (const f of faces) {
        const i0 = vertIndex + f[0];
        const i1 = vertIndex + f[1];
        const i2 = vertIndex + f[2];
        const i3 = vertIndex + f[3];
        out += `f ${i0} ${i1} ${i2}\n`;
        out += `f ${i0} ${i2} ${i3}\n`;
      }
      vertIndex += 8;
    }

    return out;
  }
}
