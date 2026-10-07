'use strict';
/* ============================================================
 * scene_tulou.js — 客家土楼主体
 * 圆形三层环楼:夯土外墙 → 木环廊 → 中央天井(含内环祖堂)
 * 层级: Tulou/OuterWall · Roof · Floors · Courtyard ·
 *        WoodenCorridor · Doors · Windows · Staircases ·
 *        Entrance · InnerRing
 * ============================================================ */
const { tone, hash2, hash3, fbm, clamp, lerp, GROUPS } = require('./voxel_core');

/* ---------- 主要参数(体素单位) ---------- */
const R_OUT = 15;      // 外墙外半径 → 外径 30 (任务建议 24~32)
const R_IN = 12;       // 外墙内半径 → 墙厚 3
const R_CORR = 8;      // 环廊内缘 → 天井半径 8 (直径 16)
const Z_PAD = 3;       // 场地/天井地面(顶面体素标高)
const WALL_Z0 = 4, WALL_Z1 = 14;   // 墙体高度范围 → 墙高 11
const SLAB2 = 7, SLAB3 = 10;       // 二层/三层木楼面
const STORIES = [ { z0: 4, z1: 6 }, { z0: 8, z1: 9 }, { z0: 11, z1: 12 } ]; // 三层净空
const N_UNIT = 20;     // 每环 20 开间(每间约 18°)
const TAU = Math.PI * 2;

/* 带夯筑层间随机错动的半径(手工感的关键:2 行一皮,皮皮错位) */
function wallRadiusJitter(x, y, z) {
  const band = (z - WALL_Z0) >> 1;
  return (hash3(x, y, band * 7 + 1) - 0.5) * 0.9 + (fbm(x * 0.33 + 9, y * 0.33 - 5, 2) - 0.5) * 0.7;
}

/* ---------- 夯土墙配色:风化斑 + 墙脚/檐下加深 + 青苔 ---------- */
function earthColor(x, y, z) {
  const patch = fbm(x * 0.35 + 31, y * 0.35 - 17, 2);
  if (z <= WALL_Z0 + 1 && hash3(x, y, 77) < 0.75) return tone('earthBase', x, y, z);
  if (z >= WALL_Z1 - 1) return tone('earthDark', x, y, z);
  if (patch > 0.63 && hash3(x, y, z * 3 + 5) < 0.8) return tone('earthStain', x, y, z);
  /* 北/西侧近地青苔 */
  if (z <= WALL_Z0 + 1) {
    const az = Math.atan2(y, x);
    if (Math.cos(az) < 0.35 && fbm(x * 0.5, y * 0.5, 2) > 0.56) return tone('mossWall', x, y, z);
  }
  return tone('earth', x, y, z);
}

function buildTulou(g, ctx) {
  buildOuterWall(g);
  buildEntrance(g);
  buildWindows(g);
  buildFloorsAndCorridor(g);
  buildRoof(g);
  buildInnerRingAndHall(g);
  buildCourtyard(g, ctx);
}

/* ============================================================
 * OuterWall — 厚重夯土外墙(r ∈ [12,15),z ∈ [4,13])
 * ============================================================ */
function buildOuterWall(g) {
  for (let x = -R_OUT - 2; x <= R_OUT + 2; x++) {
    for (let y = -R_OUT - 2; y <= R_OUT + 2; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < R_IN - 1.6 || r0 > R_OUT + 1.6) continue;
      for (let z = WALL_Z0; z <= WALL_Z1; z++) {
        const r = r0 + wallRadiusJitter(x, y, z);
        if (r < R_IN || r >= R_OUT) continue;
        g.set(x, y, z, earthColor(x, y, z), GROUPS.TULOU_WALL);
      }
    }
  }
  /* 石砌勒脚环(墙脚垫石,防潮) */
  for (let x = -R_OUT - 2; x <= R_OUT + 2; x++) {
    for (let y = -R_OUT - 2; y <= R_OUT + 2; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < R_IN - 1 || r0 > R_OUT + 1) continue;
      const r = r0 + wallRadiusJitter(x, y, WALL_Z0) * 0.6;
      if (r >= R_IN - 0.6 && r < R_OUT + 0.8 && !g.solid(x, y, Z_PAD)) {
        g.set(x, y, Z_PAD, tone('stoneDark', x, y, 0), GROUPS.TULOU_WALL);
      }
    }
  }
}

/* ============================================================
 * Entrance — 主入口:凸出门脸 + 石框厚木门 + 匾额 + 门罩 + 石阶
 * ============================================================ */
function buildEntrance(g) {
  /* 门脸:南面 |x|≤3 一列找平(略凸出,形成入口开间) */
  for (let x = -3; x <= 3; x++)
    for (let z = WALL_Z0; z <= WALL_Z1; z++)
      if (!g.solid(x, -15, z)) g.set(x, -15, z, earthColor(x, -15, z), GROUPS.TULOU_WALL);
  /* 门洞贯通(z4~6,|x|≤1) */
  for (let y = -15; y <= -12; y++)
    for (let z = 4; z <= 6; z++)
      for (let x = -1; x <= 1; x++) g.clear(x, y, z);
  /* 石门框(两侧)与石过梁 */
  for (let y = -15; y <= -12; y++) {
    for (let z = 4; z <= 7; z++) {
      for (const x of [-2, 2]) g.paint(x, y, z, tone('stone', x, y, z), GROUPS.TULOU_ENTRANCE);
      if (z === 7) for (let x = -1; x <= 1; x++) g.paint(x, y, z, tone('stoneDark', x, y, z), GROUPS.TULOU_ENTRANCE);
    }
  }
  /* 厚重双开木门(通高齐门脸,中缝 + 门钉) */
  for (let z = 4; z <= 6; z++) {
    for (let x = -1; x <= 1; x++) {
      g.set(x, -15, z, x === 0 ? tone('door', x, -15, z) : tone('plank', x, -15, z), GROUPS.TULOU_DOOR);
    }
  }
  for (const [dx, dz] of [[-1, 4], [1, 4], [-1, 6], [1, 6]]) {
    if (hash2(dx, dz) < 0.6) g.paint(dx, -15, dz, tone('plaqueGold', dx, dz, 0), GROUPS.TULOU_DOOR);
  }
  /* 门洞内一盏暖光(入口厅) */
  g.set(0, -13, 5, tone('glow', 0, -13, 5), GROUPS.TULOU_ENTRANCE);
  /* 匾额(绘于门脸上方) */
  for (let x = -2; x <= 2; x++) g.paint(x, -15, 8, tone('plaque', x, 0, 8), GROUPS.TULOU_ENTRANCE);
  g.paint(-1, -15, 8, tone('plaqueGold', -1, 0, 8), GROUPS.TULOU_ENTRANCE);
  g.paint(1, -15, 8, tone('plaqueGold', 1, 0, 8), GROUPS.TULOU_ENTRANCE);
  /* 门罩:瓦面两排出挑 + 檐口封板 + 双柱 */
  for (let y = -15; y >= -17; y--)
    for (let x = -3; x <= 3; x++)
      g.set(x, y, 9, tone('tile', x, y, 9), GROUPS.TULOU_ROOF);
  for (let x = -3; x <= 3; x++) g.set(x, -17, 8, tone('fascia', x, -17, 8), GROUPS.TULOU_ROOF);
  for (const x of [-3, 3]) {
    for (let z = 4; z <= 7; z++) g.set(x, -17, z, tone('woodDark', x, -17, z), GROUPS.TULOU_ENTRANCE);
    g.set(x, -17, 4, tone('stoneDark', x, -17, 4), GROUPS.TULOU_ENTRANCE);   // 柱础
  }
  /* 檐下灯笼 */
  g.set(-2, -16, 8, tone('lanternLit', -2, -16, 8), GROUPS.TULOU_ENTRANCE);
  g.set(2, -16, 8, tone('lanternLit', 2, -16, 8), GROUPS.TULOU_ENTRANCE);
  /* 门前石阶(场地 z3 → 路面 z2) */
  for (let y = -18; y <= -19; y++)
    for (let x = -2; x <= 2; x++)
      g.set(x, y, 3, tone('stoneLight', x, y, 3), GROUPS.TULOU_ENTRANCE);
}

/* ============================================================
 * Windows — 外墙木窗(二、三层,2 宽 1 高,个别缺失/暖光)
 * ============================================================ */
function buildWindows(g) {
  const NBUCKET = 28;
  const cellsByBucket = new Map();   // bucket → [[x,y],...]
  for (let x = -R_OUT - 1; x <= R_OUT + 1; x++) {
    for (let y = -R_OUT - 1; y <= R_OUT + 1; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < R_OUT - 0.8 || r0 > R_OUT + 0.6) continue;   // 仅最外圈墙面
      const az = (Math.atan2(y, x) + TAU) % TAU;
      const b = Math.floor(az / TAU * NBUCKET) % NBUCKET;
      if (!cellsByBucket.has(b)) cellsByBucket.set(b, []);
      cellsByBucket.get(b).push([x, y]);
    }
  }
  for (const zi of [0, 1]) {
    const z = zi === 0 ? 8 : 11;
    for (let b = 0; b < NBUCKET; b++) {
      if ((b + zi) % 2 !== 0) continue;                  // 隔桶开窗,保证窗间墙段
      if (hash2(b * 13 + 5, z) < 0.18) continue;         // 个别缺失
      const cells = cellsByBucket.get(b) || [];
      const lit = hash2(b * 7 + 3, z) < 0.22;            // 少量窗内暖光
      for (const [x, y] of cells) {
        g.paint(x, y, z, lit ? tone('glow', x, y, z) : tone('door', x, y, z), GROUPS.TULOU_WINDOW);
        if (!g.solid(x, y, z + 1)) continue;
        g.paint(x, y, z + 1, lit ? tone('glow', x, y, z + 1) : tone('door', x, y, z + 1), GROUPS.TULOU_WINDOW);
        /* 窗下雨痕 */
        if (!lit && hash3(x, y, z) < 0.5) {
          g.paint(x, y, z - 1, tone('earthStain', x, y, z), 0);
          if (hash3(x, y, z + 9) < 0.4) g.paint(x, y, z - 2, tone('earthStain', x, y, z), 0);
        }
      }
      /* 木窗框(相邻桶最靠外的体素) */
      for (const nb of [(b + 1) % NBUCKET, (b + NBUCKET - 1) % NBUCKET]) {
        const nc = cellsByBucket.get(nb) || [];
        if (nc.length) {
          const [x, y] = nc[hash2(nb, z) < 0.5 ? 0 : nc.length - 1];
          g.paint(x, y, z, tone('woodDark', x, y, z), 0);
          g.paint(x, y, z + 1, tone('woodDark', x, y, z + 1), 0);
        }
      }
    }
  }
  /* 底层:狭小通气缝(每隔数开间一个) */
  for (let b = 2; b < NBUCKET; b += 6) {
    const cells = cellsByBucket.get(b) || [];
    if (cells.length) {
      const [x, y] = cells[(cells.length / 2) | 0];
      g.paint(x, y, 5, tone('door', x, y, 5), GROUPS.TULOU_WINDOW);
    }
  }
  /* 朝向环廊一侧的内墙小窗(少量暖光) */
  for (let x = -R_IN - 1; x <= R_IN + 1; x++) {
    for (let y = -R_IN - 1; y <= R_IN + 1; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < R_IN - 0.6 || r0 > R_IN + 0.7) continue;
      if (hash3(x, y, 21) > 0.18) continue;
      for (const z of [5, 8, 11]) {
        const lit = hash3(x, y, z + 33) < 0.35 && z > 5;
        g.paint(x, y, z, lit ? tone('glow', x, y, z) : tone('door', x, y, z), GROUPS.TULOU_WINDOW);
      }
    }
  }
}

/* ============================================================
 * Floors + WoodenCorridor + Staircases + Doors
 * 木楼面(z7/z10)、通柱与栏杆(r≈8)、分户隔墙与户门、双跑楼梯
 * ============================================================ */
function buildFloorsAndCorridor(g) {
  /* 收集环廊内缘(r≈8)体素,按角度排序 → 柱/栏杆交替 */
  const edge = [];
  for (let x = -9; x <= 9; x++) {
    for (let y = -9; y <= 9; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < 7.55 || r0 > 8.45) continue;
      if (!g.solid(x, y, Z_PAD)) continue;               // 必须落在庭院地面上
      edge.push({ x, y, az: Math.atan2(y, x) });
    }
  }
  edge.sort((a, b) => a.az - b.az);
  for (let i = 0; i < edge.length; i++) {
    const { x, y } = edge[i];
    const isPost = i % 3 === 0;
    /* 通柱:一层柱(z4-6)、二层柱(z8-9)、三层柱(z11-12) */
    if (isPost) {
      for (let z = 4; z <= 6; z++) g.set(x, y, z, tone('woodDark', x, y, z), GROUPS.TULOU_CORRIDOR);
      for (const z of [8, 9, 11, 12]) g.set(x, y, z, tone('woodDark', x, y, z), GROUPS.TULOU_CORRIDOR);
    } else {
      for (const z of [8, 11]) g.set(x, y, z, tone('wood', x, y, z), GROUPS.TULOU_CORRIDOR); // 栏杆扶手
    }
  }
  /* 木楼面(二层/三层环廊,宽 2) — 预留楼梯口 */
  const stairArc = (az) => (Math.abs(az) < 0.30 || Math.abs(Math.abs(az) - Math.PI) < 0.42);
  for (let x = -R_CORR - 1; x <= R_CORR + 1; x++) {
    for (let y = -R_CORR - 1; y <= R_CORR + 1; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < R_CORR - 0.2 || r0 >= R_IN - 0.6) continue;
      const az = Math.atan2(y, x);
      for (const z of [SLAB2, SLAB3]) {
        if (stairArc(az)) continue;                      // 楼梯井
        g.set(x, y, z, tone('plank', x, y, z), GROUPS.TULOU_FLOOR);
      }
    }
  }
  /* 分户隔墙(每 18° 一道,木) + 户门 */
  for (let u = 0; u < N_UNIT; u++) {
    const th = u * TAU / N_UNIT + TAU / (N_UNIT * 2);
    const opened = hash2(u * 31, 7) < 0.55;              // 一层部分敞开(灶间)
    for (const r of [10, 11]) {
      const x = Math.round(Math.cos(th) * r), y = Math.round(Math.sin(th) * r);
      for (const { z0, z1 } of STORIES) {
        for (let z = z0; z <= z1; z++) {
          if (r === 10 && ((z <= 5 && opened) || (z === z0 + 1 && !opened))) {
            g.set(x, y, z, tone(z0 === 4 ? 'door' : 'woodDark', x, y, z), GROUPS.TULOU_DOOR);
          } else {
            g.set(x, y, z, tone('wood', x, y, z), GROUPS.TULOU_CORRIDOR);
          }
        }
      }
    }
  }
  /* 楼梯:东梯(一层→二层) / 西梯(一层→三层) */
  for (let k = 0; k <= 3; k++) {
    const z = 4 + k, th = 0.06 + k * 0.055;
    for (let a = th; a < th + 0.16; a += 0.02) {
      for (const r of [8.8, 9.4]) {
        const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
        if (!g.solid(x, y, z)) g.set(x, y, z, tone('plank', x, y, z), GROUPS.TULOU_STAIR);
      }
    }
  }
  for (let k = 0; k <= 6; k++) {
    const z = 4 + k, th = Math.PI + 0.05 + k * 0.032;
    for (let a = th; a < th + 0.12; a += 0.02) {
      for (const r of [8.8, 9.4]) {
        const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
        if (!g.solid(x, y, z)) g.set(x, y, z, tone('plank', x, y, z), GROUPS.TULOU_STAIR);
      }
    }
  }
  /* 晾衣(竹竿衣物,西南侧二层栏杆上) */
  for (const [x, y] of [[-7, -4], [-6, -5]]) {
    g.set(x, y, 9, tone('cloth', x, y, 9), GROUPS.VILLAGE);
  }
}

/* ============================================================
 * Roof — 环形双坡瓦顶:内坡(向天井) + 正脊环 + 外坡(出檐)
 * ============================================================ */
function roofRing(g, r0, r1, z, matName, group) {
  for (let x = -R_OUT - 4; x <= R_OUT + 4; x++) {
    for (let y = -R_OUT - 4; y <= R_OUT + 4; y++) {
      const r = Math.hypot(x, y) + (hash3(x, y, z) - 0.5) * 0.5;
      if (r < r0 || r >= r1) continue;
      let m = matName;
      if (matName === 'tile') {
        const inner = r < 13;
        if (fbm(x * 0.45 + 3, y * 0.45 - 2, 2) > (inner ? 0.55 : 0.66)) m = 'tileMoss';
      }
      g.set(x, y, z, tone(m, x, y, z), group);
    }
  }
}
function buildRoof(g) {
  const GR = GROUPS.TULOU_ROOF;
  /* 各环相互重叠 0.2~0.3,避免抖动产生破洞 */
  roofRing(g, 12.8, 14.6, 17, 'ridge', GR);    // 正脊环
  roofRing(g, 14.4, 16.1, 16, 'tile', GR);     // 外坡上层
  roofRing(g, 15.8, 17.3, 15, 'tile', GR);     // 外坡出檐
  roofRing(g, 16.5, 17.5, 14, 'fascia', GR);   // 外檐封板
  roofRing(g, 11.3, 13.2, 16, 'tile', GR);     // 内坡上层
  roofRing(g, 9.0, 11.5, 15, 'tile', GR);      // 内坡下檐(悬于环廊上)
  roofRing(g, 8.5, 9.6, 14, 'fascia', GR);     // 内檐封板
}

/* ============================================================
 * InnerRing + 祖堂 — 天井内的单层内环(缺南侧一段)与北端祖堂
 * ============================================================ */
function arcBetween(az, a0, a1) {
  az = (az + TAU) % TAU;
  return a1 <= TAU ? (az >= a0 && az < a1) : (az >= a0 || az < a1 - TAU);
}
/* 内环墙弧段:130°→255° 与 285°→50°(南面敞开) */
const RING_ARCS = [[130 * Math.PI / 180, 255 * Math.PI / 180], [285 * Math.PI / 180, 50 * Math.PI / 180 + TAU]];
function inRingArc(az) { return RING_ARCS.some(([a0, a1]) => arcBetween(az, a0, a1)); }
const HALL_ARC = [50 * Math.PI / 180, 130 * Math.PI / 180];
function inHallArc(az) { return arcBetween(az, HALL_ARC[0], HALL_ARC[1]); }

function buildInnerRingAndHall(g) {
  /* --- 内环居室墙 r∈[6,8),z4~7 --- */
  for (let x = -9; x <= 9; x++) {
    for (let y = -9; y <= 9; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < 5.6 || r0 > 8.6) continue;
      const az = Math.atan2(y, x);
      if (!inRingArc(az)) continue;
      for (let z = 4; z <= 7; z++) {
        const r = r0 + (hash3(x, y, z) - 0.5) * 0.5;
        if (r < 6.1 || r >= 8.1) continue;
        g.set(x, y, z, earthColor(x, y, z), GROUPS.TULOU_INNERRING);
      }
      /* 内环瓦顶(向天井单坡,两叠) */
      if (r0 >= 6.9 && r0 < 8.5) g.set(x, y, 8, tone('tile', x, y, 8), GROUPS.TULOU_ROOF);
      if (r0 >= 5.4 && r0 < 6.9) g.set(x, y, 7, tone('tile', x, y, 7), GROUPS.TULOU_ROOF);
      if (r0 >= 4.9 && r0 < 5.7) g.set(x, y, 6, tone('fascia', x, y, 6), GROUPS.TULOU_ROOF);
      /* 前檐木柱 */
      if (r0 >= 5.9 && r0 < 6.3) {
        const k = Math.round(az / (TAU / 60));
        if (((k % 3) + 3) % 3 === 0) {
          for (let z = 4; z <= 6; z++) g.set(x, y, z, tone('woodDark', x, y, z), GROUPS.TULOU_INNERRING);
        }
      }
      /* 内环户门(朝天井,个别敞开) */
      if (r0 >= 6.1 && r0 < 7.2 && hash2(Math.round(az * 20), 3) < 0.35) {
        g.paint(x, y, 4, tone('door', x, y, 4), GROUPS.TULOU_DOOR);
        g.paint(x, y, 5, tone('door', x, y, 5), GROUPS.TULOU_DOOR);
      }
    }
  }
  /* --- 祖堂(北端,凸出天井):实墙后部 + 前廊列柱 + 龛位 --- */
  for (let x = -9; x <= 9; x++) {
    for (let y = -9; y <= 9; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 < 4.4 || r0 > 8.6) continue;
      const az = Math.atan2(y, x);
      if (!inHallArc(az)) continue;
      /* 后墙(实) */
      if (r0 >= 6.8 && r0 < 8.3) {
        for (let z = 4; z <= 8; z++) g.set(x, y, z, earthColor(x, y, z), GROUPS.TULOU_INNERRING);
      }
      /* 前廊柱(r≈6,每 2 格一柱) */
      if (r0 >= 5.7 && r0 < 6.35) {
        const k = Math.round(az / (TAU / 48));
        if (((k % 2) + 2) % 2 === 0) {
          for (let z = 4; z <= 8; z++) g.set(x, y, z, tone('woodDark', x, y, z), GROUPS.TULOU_INNERRING);
        }
      }
      /* 堂内供桌与烛光 */
      if (r0 >= 7.0 && r0 < 7.6) {
        g.set(x, y, 4, tone('woodDark', x, y, 4), GROUPS.TULOU_INNERRING);
        if (hash2(x, y) < 0.3) g.set(x, y, 5, tone('glow', x, y, 5), GROUPS.TULOU_INNERRING);
      }
      /* 祖堂匾额 */
      if (r0 >= 5.7 && r0 < 6.4) {
        const k = Math.round(az / (TAU / 48));
        if (Math.abs(k - 24) < 4) {
          g.set(x, y, 8, tone(Math.abs(k - 24) === 1 ? 'plaqueGold' : 'plaque', x, y, 8), GROUPS.TULOU_INNERRING);
        }
      }
      /* 祖堂瓦顶(比内环高一档) */
      if (r0 >= 6.6 && r0 < 8.6) g.set(x, y, 9, tone('tile', x, y, 9), GROUPS.TULOU_ROOF);
      if (r0 >= 5.0 && r0 < 6.6) g.set(x, y, 8, tone('tile', x, y, 8), GROUPS.TULOU_ROOF);
      if (r0 >= 6.6 && r0 < 8.0) g.set(x, y, 10, tone('ridge', x, y, 10), GROUPS.TULOU_ROOF);
      if (r0 >= 4.4 && r0 < 5.2) g.set(x, y, 7, tone('fascia', x, y, 7), GROUPS.TULOU_ROOF);
    }
  }
}

/* ============================================================
 * Courtyard — 中央天井:夯土地面 + 石板十字甬路 + 水井 + 石桌
 * ============================================================ */
function buildCourtyard(g, ctx) {
  /* 地面重着色:夯土 + 环廊边石板 + 十字甬道 */
  for (let x = -R_CORR; x <= R_CORR; x++) {
    for (let y = -R_CORR; y <= R_CORR; y++) {
      const r0 = Math.hypot(x, y);
      if (r0 >= R_CORR - 0.2) continue;
      if (!g.solid(x, y, Z_PAD)) continue;
      let rgb;
      if (r0 > R_CORR - 1.6) rgb = tone('stone', x, y, Z_PAD);                       // 环廊柱脚石板
      else if (Math.abs(x) <= 0 && Math.abs(y) <= R_CORR - 2) rgb = tone('path', x, y, Z_PAD);      // 南北甬道
      else if (Math.abs(y) <= 0 && Math.abs(x) <= R_CORR - 2) rgb = tone('path', x, y, Z_PAD);      // 东西甬道
      else if (inHallArc(Math.atan2(y, x)) && r0 > 4.6) rgb = tone('stone', x, y, Z_PAD);           // 祖堂前石铺
      else rgb = tone('courtEarth', x, y, Z_PAD);
      g.paint(x, y, Z_PAD, rgb, GROUPS.TULOU_COURTYARD);
    }
  }
  /* 水井(石井圈 + 井水 + 木质井架) */
  for (let x = -3; x <= 3; x++) {
    for (let y = -3; y <= 3; y++) {
      const r0 = Math.hypot(x, y + 1);
      if (r0 >= 1.5 && r0 < 2.6) g.set(x, y, 4, tone('stone', x, y, 4), GROUPS.TULOU_COURTYARD);
      else if (r0 < 1.5) g.set(x, y, 4, tone('waterDeep', x, y, 4), GROUPS.WATER);
    }
  }
  for (const x of [-2, 2]) for (let z = 5; z <= 8; z++) g.set(x, -1, z, tone('woodDark', x, -1, z), GROUPS.TULOU_COURTYARD);
  for (let x = -2; x <= 2; x++) g.set(x, -1, 9, tone('wood', x, -1, 9), GROUPS.TULOU_COURTYARD);
  g.set(0, -1, 8, tone('wood', 0, -1, 8), GROUPS.TULOU_COURTYARD);   // 吊桶
  /* 井台石铺环 */
  for (let x = -4; x <= 4; x++) {
    for (let y = -5; y <= 3; y++) {
      const rr = Math.hypot(x, y + 1);
      if (rr >= 2.6 && rr < 3.9 && g.solid(x, y, Z_PAD)) g.paint(x, y, Z_PAD, tone('stone', x, y, Z_PAD), GROUPS.TULOU_COURTYARD);
    }
  }
  /* 石桌石凳 */
  g.set(3, -1, 4, tone('stoneLight', 3, -1, 4), GROUPS.VILLAGE);
  g.set(4, -1, 4, tone('stoneLight', 4, -1, 4), GROUPS.VILLAGE);
  g.set(3, -2, 4, tone('woodDark', 3, -2, 4), GROUPS.VILLAGE);
  g.set(5, -2, 4, tone('woodDark', 5, -2, 4), GROUPS.VILLAGE);
  /* 天井树(东南角,冠在屋顶开口内) */
  for (let z = 4; z <= 6; z++) g.set(4, -4, z, tone('trunk', 4, -4, z), GROUPS.VEGETATION);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const rr = Math.hypot(dx, dy);
      for (let z = 7; z <= 9; z++) {
        if (rr <= 2.1 - (z - 7) * 0.2 && hash3(dx, dy, z) > 0.14) {
          g.set(4 + dx, -4 + dy, z, hash3(dx, dy, z + 5) < 0.25 ? tone('leafLight', dx, dy, z) : tone('leaf', dx, dy, z), GROUPS.VEGETATION);
        }
      }
    }
  }
  g.set(4, -4, 10, tone('leafLight', 4, -4, 10), GROUPS.VEGETATION);
  /* 鸡(三只,井台边) */
  g.set(-4, -2, 4, tone('chicken', -4, -2, 4), GROUPS.DECOR);
  g.set(-4, -2, 5, tone('comb', -4, -2, 5), GROUPS.DECOR);
  g.set(-3, -1, 4, tone('chicken', -3, -1, 4), GROUPS.DECOR);
  g.set(5, 0, 4, tone('chicken', 5, 0, 4), GROUPS.DECOR);
  /* 水缸(灶间前) */
  for (const [x, y] of [[-4, -5], [-3, -7]]) {
    g.set(x, y, 4, tone('stoneDark', x, y, 4), GROUPS.VILLAGE);
    g.set(x, y, 5, tone('stoneDark', x, y, 5), GROUPS.VILLAGE);
  }
  /* 祖堂前水缸一对 + 晒垫 */
  g.set(-2, 5, 4, tone('stoneDark', -2, 5, 4), GROUPS.VILLAGE);
  g.set(3, 5, 4, tone('stoneDark', 3, 5, 4), GROUPS.VILLAGE);
  for (const [x, y] of [[3, 2], [4, 2], [3, 3], [4, 3]]) {
    g.paint(x, y, Z_PAD, tone('cropLight', x, y, Z_PAD), GROUPS.VILLAGE);
  }
  /* 檐下吊晒柿饼(东侧内檐口) */
  g.set(6, -7, 13, tone('persimmon', 6, -7, 13), GROUPS.DECOR);
  g.set(6, -7, 12, tone('persimmon', 6, -7, 12), GROUPS.DECOR);
}

module.exports = { buildTulou, R_OUT, R_IN, R_CORR, Z_PAD, WALL_Z0, WALL_Z1, SLAB2, SLAB3 };
