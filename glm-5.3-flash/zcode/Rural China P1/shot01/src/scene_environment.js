'use strict';
/* ============================================================
 * scene_environment.js — 植被与乡村道具
 * 层级: Scene/Vegetation · Scene/VillageProps · Scene/Lighting/Decor
 * ============================================================ */
const { tone, hash2, hash3, fbm, clamp, GROUPS } = require('./voxel_core');
const { POND, GARDEN } = require('./scene_terrain');

/* ---------- 松树:层叠圆盘 + 单柱干 ---------- */
function pine(g, x, y, hGround, s = 1) {
  const trunkH = 2 + ((hash2(x, y) * 2) | 0);
  for (let z = 1; z <= trunkH; z++) g.set(x, y, hGround + z, tone('trunk', x, y, z), GROUPS.VEGETATION);
  let z = hGround + trunkH + 1;
  const layers = [[2, 2], [2, 1], [1, 1], [1, 0], [0, 0]];
  for (const [r, drop] of layers) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.hypot(dx, dy) > r + 0.2) continue;
        if (r > 0 && Math.abs(dx) === r && Math.abs(dy) === r && hash3(dx, dy, z) < 0.5) continue;
        if (drop && z - drop < hGround + trunkH + 1) continue;
        g.set(x + dx, y + dy, z - drop, hash3(dx + x, dy + y, z) < 0.3 ? tone('pineDark', x + dx, y + dy, z) : tone('pine', x + dx, y + dy, z), GROUPS.VEGETATION);
      }
    }
    z++;
  }
}

/* ---------- 阔叶树:椭球树冠 ---------- */
function broadleaf(g, x, y, hGround, s = 1) {
  const trunkH = 2 + ((hash2(x, y) * 2) | 0);
  for (let z = 1; z <= trunkH; z++) g.set(x, y, hGround + z, tone('trunk', x, y, z), GROUPS.VEGETATION);
  const rx = 2 + (hash2(x * 3, y) < 0.4 ? 1 : 0), rz = 2, cy = hGround + trunkH + 2;
  for (let dx = -rx; dx <= rx; dx++) {
    for (let dy = -rx; dy <= rx; dy++) {
      for (let dz = -rz; dz <= rz; dz++) {
        const d = Math.hypot(dx / rx, dy / rx, dz / (rz + 0.5));
        if (d > 1 || hash3(dx + x * 7, dy + y * 7, dz * 3) < d * 0.35) continue;
        const c = d < 0.45 && hash2(dx, dy) < 0.4 ? 'leafLight' : 'leaf';
        g.set(x + dx, y + dy, cy + dz, tone(c, x + dx, y + dy, cy + dz), GROUPS.VEGETATION);
      }
    }
  }
}

/* ---------- 竹丛:细高竹竿 + 顶部疏叶 ---------- */
function bambooClump(g, cx, cy, hGround, n, seed) {
  const rnd = (i) => hash2(cx * 13 + i * 7 + seed, cy * 17 + i * 5);
  for (let i = 0; i < n; i++) {
    const ox = Math.round((rnd(i) - 0.5) * 4.4);
    const oy = Math.round((rnd(i + 40) - 0.5) * 4.4);
    const x = cx + ox, y = cy + oy;
    if (!g.solid(x, y, hGround)) continue;
    const h = 6 + ((rnd(i + 80) * 4) | 0);
    for (let z = 1; z <= h; z++) {
      g.set(x, y, hGround + z, (z & 1) ? tone('bambooDark', x, y, z) : tone('bamboo', x, y, z), GROUPS.VEGETATION);
    }
    for (let z = h - 2; z <= h + 1; z++) {
      if (hash2(x + z, y) < 0.55) g.set(x + (rnd(z) < 0.5 ? 1 : -1), y, hGround + z, tone('leafLight', x, y, z), GROUPS.VEGETATION);
      if (hash2(x, y + z) < 0.45) g.set(x, y + (rnd(z + 9) < 0.5 ? 1 : -1), hGround + z, tone('bamboo', x, y, z), GROUPS.VEGETATION);
    }
  }
}

/* ---------- 灌木 / 岩石 ---------- */
function shrub(g, x, y, hGround) {
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      g.set(x + dx, y + dy, hGround + 1, tone('leaf', x + dx, y + dy, 1), GROUPS.VEGETATION);
      if (hash2(x + dx, y + dy) < 0.6) g.set(x + dx, y + dy, hGround + 2, tone('leafLight', x + dx, y + dy, 2), GROUPS.VEGETATION);
    }
  }
}
function rock(g, x, y, hGround, w, d, hgt) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < d; dy++) {
      for (let dz = 0; dz < hgt; dz++) {
        if (dz === hgt - 1 && hash3(dx, dy, dz + x) < 0.35) continue;
        g.set(x + dx, y + dy, hGround + 1 + dz, tone(dz === 0 ? 'stoneDark' : 'rockOut', x + dx, y + dy, dz), GROUPS.TERRAIN);
      }
    }
  }
}

/* ---------- 村民(1 体素身 + 1 头 + 1 斗笠) ---------- */
function villager(g, x, y, hGround, clothM = 'clothBlue') {
  g.set(x, y, hGround + 1, tone(clothM, x, y, 1), GROUPS.DECOR);
  g.set(x, y, hGround + 2, tone('skin', x, y, 2), GROUPS.DECOR);
  g.set(x, y, hGround + 3, tone('strawHat', x, y, 3), GROUPS.DECOR);
}

/* ---------- 火柴垛(圆木段) ---------- */
function firewood(g, x, y, hGround) {
  for (let i = 0; i < 4; i++) {
    for (let z = 1; z <= 2; z++) {
      g.set(x + i, y, hGround + z, (i + z) % 2 ? tone('woodDark', x + i, y, z) : tone('wood', x + i, y, z), GROUPS.VILLAGE);
    }
  }
  g.set(x + 1, y, hGround + 3, tone('wood', x + 1, y, 3), GROUPS.VILLAGE);
  g.set(x + 2, y, hGround + 3, tone('woodDark', x + 2, y, 3), GROUPS.VILLAGE);
}

function buildEnvironment(g, ctx) {
  const h = ctx.h;
  const free = (x, y, dz = 1) => g.solid(x, y, h(x, y)) && !g.solid(x, y, h(x, y) + dz) && !ctx.isPath(x, y);

  /* ---- 植被Vegetation ---- */
  /* 松(北侧山脊与东坡) */
  for (const [x, y] of [[-17, 17], [-22, 11], [-7, 21], [4, 22], [11, 20], [19, 15], [24, 16], [-12, 23], [1, 20]]) {
    if (h(x, y) > 0) pine(g, x, y, h(x, y), 1);
  }
  /* 阔叶(西南/南/东南开阔处) */
  for (const [x, y] of [[-14, -22], [9, -24], [-24, 6], [21, 19], [0, 25], [-21, -5]]) {
    if (h(x, y) > 0) broadleaf(g, x, y, h(x, y), 1);
  }
  /* 竹丛(西、东北、池塘南) */
  bambooClump(g, -23, -2, h(-23, -2), 6, 1);
  bambooClump(g, 20, -3, h(20, -3), 5, 2);
  bambooClump(g, -19, -19, h(-19, -19), 4, 3);
  bambooClump(g, 12, 18, h(12, 18), 4, 4);
  /* 灌木(墙脚四周) */
  for (const [x, y] of [[17, 4], [-16, 9], [-14, -12], [6, 17], [-6, 17], [12, -14], [-10, 15], [14, 9]]) {
    if (free(x, y)) shrub(g, x, y, h(x, y));
  }
  /* 岩石 */
  rock(g, 18, 7, h(18, 7), 3, 2, 2);
  rock(g, -19, 10, h(-19, 10), 2, 2, 2);
  rock(g, -10, -23, h(-10, -23), 2, 1, 1);
  rock(g, 8, 21, h(8, 21), 1, 1, 2);
  rock(g, -23, -11, h(-23, -11), 2, 2, 1);
  /* 墙面藤蔓(两处攀援) */
  for (const [vx, vy] of [[10, 11], [-9, -12]]) {
    for (let z = 4; z <= 9; z++) {
      if (hash3(vx, vy, z) < 0.62) g.set(vx, vy, z, tone('mossWall', vx, vy, z), GROUPS.VEGETATION);
    }
  }
  /* 池塘芦苇与鸭子 */
  for (const [x, y] of [[-19, -13], [-10, -18], [-17, -10]]) {
    const hh = h(x, y);
    if (hh >= 2) { g.set(x, y, hh + 1, tone('reed', x, y, 1), GROUPS.VEGETATION); g.set(x, y, hh + 2, tone('reed', x, y, 2), GROUPS.VEGETATION); }
  }
  g.set(-14, -14, 3, tone('chicken', -14, -14, 3), GROUPS.DECOR);   // 水鸭

  /* ---- 乡村道具VillageProps ---- */
  /* 菜园篱笆(北侧留门) */
  for (let x = GARDEN.x0; x <= GARDEN.x1; x++) {
    for (const y of [GARDEN.y0, GARDEN.y1]) {
      const hh = h(x, y);
      if (hh < 1 || (y === GARDEN.y0 && x >= 14 && x <= 16)) continue;   // 入口
      const isPost = (x - GARDEN.x0) % 4 === 0;
      g.set(x, y, hh + 1, tone(isPost ? 'woodDark' : 'wood', x, y, 1), GROUPS.VILLAGE);
    }
  }
  for (let y = GARDEN.y0; y <= GARDEN.y1; y++) {
    for (const x of [GARDEN.x0, GARDEN.x1]) {
      const hh = h(x, y);
      if (hh < 1) continue;
      const isPost = (y - GARDEN.y0) % 4 === 0;
      g.set(x, y, hh + 1, tone(isPost ? 'woodDark' : 'wood', x, y, 1), GROUPS.VILLAGE);
    }
  }
  /* 园内水缸与农具(扁担) */
  g.set(18, -15, h(18, -15) + 1, tone('stoneDark', 18, -15, 1), GROUPS.VILLAGE);
  g.set(18, -15, h(18, -15) + 2, tone('wood', 18, -15, 2), GROUPS.VILLAGE);
  /* 火柴垛(东墙脚) */
  firewood(g, 17, -2, h(17, -2));
  /* 柴垛旁石磨盘 */
  g.set(16, -5, h(16, -5) + 1, tone('stone', 16, -5, 1), GROUPS.VILLAGE);
  /* 村民两位 */
  villager(g, 2, -21, h(2, -21));
  villager(g, 4, -4, 3, 'clothBlue');
  /* 渡埠石板(池塘西支路尽头) */
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      const x = -15 + dx, y = -19 + dy;
      g.set(x, y, Math.max(h(x, y), 2), tone('stoneLight', x, y, 2), GROUPS.VILLAGE);
    }
  }
  /* 水渠上的小石桥 */
  g.set(-8, -9, h(-8, -9) + 1, tone('stoneLight', -8, -9, 1), GROUPS.VILLAGE);
}

module.exports = { buildEnvironment };
