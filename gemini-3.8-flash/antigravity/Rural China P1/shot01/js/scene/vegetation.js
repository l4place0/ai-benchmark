// js/scene/vegetation.js
// 东南乡村体素植被系统：毛竹林群落、苍劲古松与野趣灌木

import { PALETTE } from '../voxel/palette.js';

export function buildVegetation(voxelScene) {
  function createBamboo(bx, by, bz, height = 8) {
    for (let y = 0; y < height; y++) {
      const isJoint = (y % 2 === 0);
      const stalkCol = isJoint ? PALETTE.BAMBOO_STALK : PALETTE.BAMBOO_LEAF;
      voxelScene.set(bx, by + y, bz, stalkCol, 'Vegetation', 'Bamboo_Stalk');

      if (y >= 4) {
        const offsets = y % 2 === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
        for (const [ox, oz] of offsets) {
          voxelScene.set(bx + ox, by + y, bz + oz, PALETTE.BAMBOO_LEAF_LIGHT, 'Vegetation', 'Bamboo_Leaf');
        }
      }
    }
    voxelScene.set(bx, by + height, bz, PALETTE.BAMBOO_LEAF_LIGHT, 'Vegetation', 'Bamboo_Canopy');
    voxelScene.set(bx + 1, by + height - 1, bz, PALETTE.BAMBOO_LEAF, 'Vegetation', 'Bamboo_Leaf');
    voxelScene.set(bx - 1, by + height - 1, bz, PALETTE.BAMBOO_LEAF, 'Vegetation', 'Bamboo_Leaf');
    voxelScene.set(bx, by + height - 1, bz + 1, PALETTE.BAMBOO_LEAF, 'Vegetation', 'Bamboo_Leaf');
    voxelScene.set(bx, by + height - 1, bz - 1, PALETTE.BAMBOO_LEAF, 'Vegetation', 'Bamboo_Leaf');
  }

  function createPineTree(px, py, pz, trunkH = 9) {
    let curX = px;
    let curZ = pz;
    for (let y = 0; y < trunkH; y++) {
      voxelScene.set(curX, py + y, curZ, PALETTE.PINE_TRUNK, 'Vegetation', 'Pine_Trunk');
      if (y === 3) curX += 1;
      if (y === 6) curZ -= 1;
    }

    const layers = [
      { y: py + 5, rx: 3, rz: 3, col: PALETTE.PINE_NEEDLE_DARK },
      { y: py + 7, rx: 4, rz: 3, col: PALETTE.PINE_NEEDLE_MID },
      { y: py + 9, rx: 3, rz: 4, col: PALETTE.PINE_NEEDLE_DARK },
      { y: py + trunkH, rx: 3, rz: 3, col: PALETTE.PINE_NEEDLE_MID },
      { y: py + trunkH + 1, rx: 2, rz: 2, col: PALETTE.PINE_NEEDLE_MID }
    ];

    for (const l of layers) {
      for (let dz = -l.rz; dz <= l.rz; dz++) {
        for (let dx = -l.rx; dx <= l.rx; dx++) {
          if (Math.abs(dx) + Math.abs(dz) <= l.rx + 1) {
            voxelScene.set(curX + dx, l.y, curZ + dz, l.col, 'Vegetation', 'Pine_Needle_Canopy');
          }
        }
      }
    }
  }

  function createShrub(sx, sy, sz, hasFlower = false) {
    const col = PALETTE.TERRAIN_GRASS_DARK;
    voxelScene.set(sx, sy, sz, col, 'Vegetation', 'Shrub_Base');
    voxelScene.set(sx + 1, sy, sz, col, 'Vegetation', 'Shrub_Leaf');
    voxelScene.set(sx - 1, sy, sz, col, 'Vegetation', 'Shrub_Leaf');
    voxelScene.set(sx, sy, sz + 1, col, 'Vegetation', 'Shrub_Leaf');
    voxelScene.set(sx, sy, sz - 1, col, 'Vegetation', 'Shrub_Leaf');
    voxelScene.set(sx, sy + 1, sz, hasFlower ? PALETTE.SHRUB_FLOWER : PALETTE.TERRAIN_GRASS_MID, 'Vegetation', 'Shrub_Top');
  }

  // 后山大苍松
  createPineTree(28, 3, -27, 10);
  createPineTree(34, 4, -22, 9);
  createPineTree(-30, 2, -26, 9);

  // 毛竹林群落 (后山漫山翠竹)
  const bambooCoords = [
    [-34, 3, -20, 8], [-33, 3, -22, 9], [-31, 2, -19, 7], [-35, 3, -18, 8],
    [-28, 2, -23, 9], [-29, 2, -17, 7], [-25, 1, -24, 8], [-26, 1, -21, 9],
    [-21, 1, -27, 8], [-19, 1, -29, 9], [-16, 1, -28, 8], [-13, 2, -31, 9],
    [-10, 2, -30, 8], [-6, 2, -32, 9], [-3, 2, -31, 8], [1, 2, -32, 9],
    [7, 2, -31, 8], [11, 3, -30, 9], [15, 3, -29, 8], [19, 3, -28, 9]
  ];

  for (const [bx, by, bz, bh] of bambooCoords) {
    createBamboo(bx, by, bz, bh);
  }

  // 溪流边与前庭侧翼松树 (远离入口正轴线，保证主门完全无遮挡)
  createPineTree(-25, 0, 24, 8);
  createPineTree(26, 0, 32, 7);

  // 散布灌木
  const shrubCoords = [
    [-27, 0, 10, true], [-28, 0, 14, false],
    [27, 0, -8, false], [28, 0, -4, true],
    [-10, 0, 26, true], [-8, 0, 27, false],
    [10, 0, 27, true], [12, 0, 26, false],
    [-32, 0, 4, false], [-34, 0, 6, true]
  ];

  for (const [sx, sy, sz, fl] of shrubCoords) {
    createShrub(sx, sy, sz, fl);
  }

  console.log("Grand rural vegetation generated.");
}
