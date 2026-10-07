// js/scene/villageProps.js
// 乡村生活器物系统：稻草堆、柴火垛、水缸、推车与浣衣石

import { PALETTE } from '../voxel/palette.js';

export function buildVillageProps(voxelScene) {
  function createHaystack(hx, hy, hz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        voxelScene.set(hx + dx, hy, hz + dz, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Base');
      }
    }
    voxelScene.set(hx, hy + 1, hz, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Mid');
    voxelScene.set(hx + 1, hy + 1, hz, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Mid');
    voxelScene.set(hx, hy + 1, hz + 1, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Mid');
    voxelScene.set(hx + 1, hy + 1, hz + 1, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Mid');
    voxelScene.set(hx, hy + 2, hz, PALETTE.HAY_GOLD, 'VillageProps', 'Haystack_Peak');
  }

  function createFirewoodStack(fx, fy, fz, length = 4) {
    for (let l = 0; l < length; l++) {
      voxelScene.set(fx + l, fy, fz, PALETTE.FIREWOOD_LOG, 'VillageProps', 'Firewood_Log');
      voxelScene.set(fx + l, fy + 1, fz, PALETTE.FIREWOOD_BARK, 'VillageProps', 'Firewood_Log');
    }
  }

  function createWaterVat(vx, vy, vz) {
    voxelScene.set(vx, vy, vz, PALETTE.STONE_DARK, 'VillageProps', 'Vat_Stone_Base');
    voxelScene.set(vx, vy + 1, vz, PALETTE.TIMBER_LACQUER, 'VillageProps', 'Vat_Body');
    voxelScene.set(vx, vy + 1.2, vz, PALETTE.WATER_WELL, 'VillageProps', 'Vat_Water_Inside');
  }

  function createHandcart(cx, cy, cz) {
    voxelScene.set(cx, cy, cz - 1, PALETTE.TIMBER_OLD, 'VillageProps', 'Cart_Wheel');
    voxelScene.set(cx, cy, cz + 1, PALETTE.TIMBER_OLD, 'VillageProps', 'Cart_Wheel');
    voxelScene.set(cx, cy + 0.5, cz, PALETTE.TIMBER_MID, 'VillageProps', 'Cart_Frame');
    voxelScene.set(cx + 1, cy + 0.5, cz, PALETTE.TIMBER_MID, 'VillageProps', 'Cart_Bed');
    voxelScene.set(cx - 1, cy + 0.5, cz, PALETTE.TIMBER_MID, 'VillageProps', 'Cart_Handle');
    voxelScene.set(cx + 1, cy + 1, cz, PALETTE.HAY_GOLD, 'VillageProps', 'Cart_Cargo_Basket');
  }

  // 稻草堆布置在菜园外侧
  createHaystack(37, 0, 8);
  createHaystack(38, 0, 13);

  // 柴火垛布置在土楼外墙侧面阴凉处
  createFirewoodStack(22, 0, 16, 4);
  createFirewoodStack(-25, 0, 18, 4);
  createFirewoodStack(-26, 0, -6, 4);

  // 户外水缸
  createWaterVat(23, 0, 19);
  createWaterVat(-24, 0, 21);

  // 独轮车
  createHandcart(7, 0, 28);

  // 溪水边浣衣石
  voxelScene.set(-1, -0.5, 30, PALETTE.STONE_LIGHT, 'VillageProps', 'Washing_Stone');
  voxelScene.set(1, -0.5, 30, PALETTE.STONE_MID, 'VillageProps', 'Washing_Stone');

  console.log("Grand village life props generated.");
}
