// js/scene/terrain.js
// 宏伟山地乡村体素地形 - 适配大体量客家土楼微缩底座

import { PALETTE } from '../voxel/palette.js';

export function buildTerrain(voxelScene) {
  const SIZE = 40; // 80x80 体素范围，宽广舒展

  function hash(x, z) {
    const s = Math.sin(x * 17.13 + z * 53.71) * 43758.5453;
    return s - Math.floor(s);
  }

  function getGroundHeight(x, z) {
    const distToCenter = Math.sqrt(x * x + z * z);
    // 土楼主体与檐下散水平整化 (半径 26 以内平整为高程 0)
    if (distToCenter <= 26.0) {
      return 0;
    }

    let h = 0;
    // 后山北侧 (Z < -22) 缓坡梯田茶山
    if (z < -22) {
      const hillDist = (-z - 22);
      h += Math.floor(hillDist * 0.32);
      h += Math.floor((Math.sin(x * 0.12) + Math.cos(z * 0.1) + 1) * 0.7);
    }

    // 西北角高台
    if (x < -24 && z < -16) {
      h += Math.floor((-x - 24) * 0.25);
    }

    // 南侧向下平缓过渡
    if (z > 28) {
      h = Math.max(-1, Math.floor(Math.sin(x * 0.08) * 0.5));
    }

    return Math.max(0, Math.min(6, h));
  }

  // 蜿蜒山溪
  function isStream(x, z) {
    const streamCenterZ = 0.45 * x + 31 + Math.sin(x * 0.18) * 3.0;
    return Math.abs(z - streamCenterZ) <= 2.0 && Math.sqrt(x * x + z * z) > 26.5;
  }

  // 青石板主路
  function isStonePath(x, z) {
    // 从南大门 (0, 24) 蜿蜒向前穿过木桥
    if (z >= 24 && z <= 38) {
      const pathCenterX = Math.sin(z * 0.2) * 4.0;
      return Math.abs(x - pathCenterX) <= 1.5;
    }
    // 环土楼外散水通道
    const d = Math.sqrt(x * x + z * z);
    return d >= 25.5 && d <= 27.2;
  }

  // 溪流木桥
  function isBridge(x, z) {
    return isStream(x, z) && isStonePath(x, z);
  }

  // 1. 生成大尺度体素底座
  for (let z = -SIZE; z <= SIZE; z++) {
    for (let x = -SIZE; x <= SIZE; x++) {
      const topY = getGroundHeight(x, z);
      const dist = Math.sqrt(x * x + z * z);
      const isWater = isStream(x, z);
      const isPath = isStonePath(x, z);
      const isBr = isBridge(x, z);

      if (isBr) {
        // 木桥桥面 (Y=1) 与木栏杆 (Y=2)
        voxelScene.set(x, 1, z, PALETTE.TIMBER_FLOOR, 'Terrain', 'Wooden_Bridge_Plank');
        if (Math.abs(x) >= 2 || Math.abs(z) % 2 === 0) {
          voxelScene.set(x, 2, z, PALETTE.TIMBER_MID, 'Terrain', 'Wooden_Bridge_Railing');
        }
        voxelScene.set(x, -1, z, PALETTE.WATER_STREAM, 'Terrain', 'Bridge_Stream_Water');
      } else if (isWater) {
        voxelScene.set(x, -1, z, PALETTE.WATER_STREAM, 'Terrain', 'Stream_Water');
        voxelScene.set(x, -2, z, PALETTE.STONE_PEBBLE, 'Terrain', 'Stream_Bed');
      } else if (isPath) {
        const col = (x + z) % 2 === 0 ? PALETTE.STONE_LIGHT : PALETTE.STONE_MID;
        voxelScene.set(x, topY, z, col, 'Terrain', 'Flagstone_Path');
      } else if (dist <= 26.0) {
        // 土楼正下方台基与散水
        const apronCol = dist > 23.5 ? PALETTE.STONE_MID : PALETTE.TERRAIN_DIRT;
        voxelScene.set(x, 0, z, apronCol, 'Terrain', 'Tulou_Apron');
      } else {
        let groundCol = PALETTE.TERRAIN_GRASS_MID;
        const hVal = hash(x, z);

        if (z < -24 && topY >= 2) {
          groundCol = (x % 3 === 0) ? PALETTE.TERRAIN_CROP : PALETTE.TERRAIN_GRASS_DARK;
        } else if (hVal > 0.6) {
          groundCol = PALETTE.TERRAIN_GRASS_DARK;
        } else if (hVal < 0.2) {
          groundCol = PALETTE.TERRAIN_DIRT;
        }

        voxelScene.set(x, topY, z, groundCol, 'Terrain', 'Terrain_Surface');

        // 梯田石坎
        const northY = getGroundHeight(x, z - 1);
        if (topY < northY) {
          for (let sy = topY; sy < northY; sy++) {
            voxelScene.set(x, sy, z, PALETTE.STONE_DARK, 'Terrain', 'Terrace_Stone_Wall');
          }
        }
      }

      // 底座切面
      for (let y = (isWater ? -3 : topY - 1); y >= -3; y--) {
        const subCol = y === -3 ? PALETTE.TERRAIN_TOPSOIL : PALETTE.TERRAIN_DIRT;
        if (Math.abs(x) === SIZE || Math.abs(z) === SIZE || y === -3 || dist > 28) {
          voxelScene.set(x, y, z, subCol, 'Terrain', 'Diorama_Base_Subsurface');
        }
      }
    }
  }

  // 2. 梯田小菜园与竹篱笆 (东南侧 X: 27..35, Z: 6..16)
  for (let cz = 7; cz <= 15; cz++) {
    for (let cx = 28; cx <= 34; cx++) {
      if (cz % 2 === 0) {
        voxelScene.set(cx, 0.5, cz, PALETTE.TERRAIN_TOPSOIL, 'Terrain', 'Garden_Soil_Furrow');
        voxelScene.set(cx, 1, cz, PALETTE.TERRAIN_CROP, 'Terrain', 'Garden_Vegetable_Crop');
      } else {
        voxelScene.set(cx, 0, cz, PALETTE.TERRAIN_DIRT, 'Terrain', 'Garden_Path');
      }
    }
  }

  for (let cx = 27; cx <= 35; cx++) {
    voxelScene.set(cx, 1, 6, PALETTE.TIMBER_MID, 'VillageProps', 'Garden_Fence');
    voxelScene.set(cx, 1, 16, PALETTE.TIMBER_MID, 'VillageProps', 'Garden_Fence');
  }
  for (let cz = 6; cz <= 16; cz++) {
    voxelScene.set(35, 1, cz, PALETTE.TIMBER_MID, 'VillageProps', 'Garden_Fence');
  }

  console.log("Grand rural mountain terrain generated.");
}
