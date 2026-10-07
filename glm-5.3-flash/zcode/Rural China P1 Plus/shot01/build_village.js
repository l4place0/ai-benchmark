'use strict';
/* ============================================================================
 * build_village.js — 「大型客家土楼村落」Voxel Art 场景生成器 + 渲染器
 * Hakka Tulou Village — procedural voxel scene builder & renderer (pure Node, no deps)
 *
 * 产物 outputs:
 *   render_01_main_view.png        主展示视图 (3/4 elevated isometric)
 *   render_02_full_diorama.png     全景 diorama
 *   render_03_tulou_detail.png     核心土楼细节
 *   render_04_village_relations.png 村落关系视图
 *   hakka_village.vox              MagicaVoxel 体素场景文件
 *   scene_stats.json               场景统计
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const DIR = __dirname;
let FLAT_DEBUG = process.argv.includes('--flat');

/* ---------------- deterministic RNG / noise ---------------- */
const SEED = 20261004;
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(SEED, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2246822519) + SEED) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; f *= 2.13; a *= 0.5; }
  return s / n;
}
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- material palette ----------------
 * 每个 material: [r,g,b, variation, kind]
 * kind: 0 solid / 1 water / 2 emissive / 3 foliage-light(透光感)                 */
const M = {
  AIR: 0, GRASS: 1, GRASS_DRY: 2, SOIL: 3, DARK_SOIL: 4, EARTH: 5, EARTH_DEEP: 6, ROCK: 7,
  STONE: 8, PATH_STONE: 9, PATH_DIRT: 10,
  WALL_EARTH_A: 11, WALL_EARTH_B: 12, WALL_EARTH_C: 13, WALL_BRICK: 14, PLASTER: 15,
  WOOD_DARK: 16, WOOD_MID: 17, WOOD_LIGHT: 18,
  ROOF_TILE: 19, ROOF_TILE_OLD: 20, ROOF_MOSS: 21, ROOF_RIDGE: 22,
  WATER: 23, PADDY_WATER: 24, FOAM: 25,
  RICE: 26, RICE_YOUNG: 27, TEA: 28, VEG_GREEN: 29, VEG_ORANGE: 30, VEG_LEAF: 31,
  BAMBOO: 32, BAMBOO_NODE: 33, BAMBOO_LEAF: 34,
  LEAF_DARK: 35, LEAF_MID: 36, LEAF_LIGHT: 37, LEAF_PINE: 38, LEAF_FRUIT: 39,
  FRUIT_ORANGE: 40, FRUIT_RED: 41, MOSS: 42, FLOWER: 43,
  CLAY: 44, STRAW: 45, CLOTH_INDIGO: 46, CLOTH_TAN: 47, CLOTH_RED: 48,
  LANTERN: 49, LANTERN_GLOW: 50, SKIN: 51, HAT: 52, CLOTHES_BLUE: 53, CLOTHES_GRAY: 54,
  HEN: 55, DUCK: 56, GRAIN: 57, WICKER: 58, METAL: 59
};
const PAL = [];
function def(m, r, g, b, v, kind) { PAL[m] = { c: [r / 255, g / 255, b / 255], v, kind: kind || 0 }; }
def(M.GRASS, 112, 146, 84, 0.10); def(M.GRASS_DRY, 152, 148, 96, 0.12);
def(M.SOIL, 138, 110, 76, 0.10); def(M.DARK_SOIL, 114, 92, 66, 0.10);
def(M.EARTH, 172, 138, 94, 0.08); def(M.EARTH_DEEP, 146, 114, 78, 0.07); def(M.ROCK, 136, 132, 124, 0.10);
def(M.STONE, 164, 160, 150, 0.08); def(M.PATH_STONE, 156, 148, 134, 0.10); def(M.PATH_DIRT, 146, 122, 90, 0.10);
def(M.WALL_EARTH_A, 199, 158, 106, 0.06); def(M.WALL_EARTH_B, 178, 148, 104, 0.06); def(M.WALL_EARTH_C, 158, 137, 106, 0.06);
def(M.WALL_BRICK, 148, 122, 94, 0.08); def(M.PLASTER, 212, 204, 188, 0.04);
def(M.WOOD_DARK, 90, 60, 38, 0.08); def(M.WOOD_MID, 128, 92, 58, 0.08); def(M.WOOD_LIGHT, 166, 130, 86, 0.08);
def(M.ROOF_TILE, 73, 73, 79, 0.07); def(M.ROOF_TILE_OLD, 88, 86, 84, 0.08);
def(M.ROOF_MOSS, 90, 103, 70, 0.10); def(M.ROOF_RIDGE, 55, 55, 59, 0.05);
def(M.WATER, 116, 154, 166, 0.045, 1); def(M.PADDY_WATER, 118, 146, 120, 0.045, 1); def(M.FOAM, 225, 229, 225, 0.04);
def(M.RICE, 94, 136, 62, 0.10); def(M.RICE_YOUNG, 116, 148, 78, 0.10); def(M.TEA, 76, 110, 64, 0.08);
def(M.VEG_GREEN, 108, 156, 82, 0.12); def(M.VEG_ORANGE, 194, 122, 56, 0.10); def(M.VEG_LEAF, 86, 124, 68, 0.12);
def(M.BAMBOO, 138, 158, 86, 0.10); def(M.BAMBOO_NODE, 106, 126, 68, 0.08); def(M.BAMBOO_LEAF, 108, 144, 70, 0.12);
def(M.LEAF_DARK, 72, 102, 56, 0.10); def(M.LEAF_MID, 94, 130, 64, 0.10); def(M.LEAF_LIGHT, 122, 154, 82, 0.10);
def(M.LEAF_PINE, 62, 92, 56, 0.10); def(M.LEAF_FRUIT, 102, 138, 68, 0.10);
def(M.FRUIT_ORANGE, 196, 116, 50, 0.08); def(M.FRUIT_RED, 164, 74, 50, 0.08);
def(M.MOSS, 102, 116, 72, 0.12); def(M.FLOWER, 220, 216, 202, 0.05);
def(M.CLAY, 120, 86, 62, 0.08); def(M.STRAW, 194, 170, 114, 0.10);
def(M.CLOTH_INDIGO, 74, 86, 108, 0.06); def(M.CLOTH_TAN, 184, 164, 128, 0.08); def(M.CLOTH_RED, 156, 64, 46, 0.06);
def(M.LANTERN, 176, 72, 42, 0.05, 2); def(M.LANTERN_GLOW, 230, 148, 70, 0.05, 2);
def(M.SKIN, 196, 146, 108, 0.05); def(M.HAT, 194, 166, 102, 0.08);
def(M.CLOTHES_BLUE, 82, 94, 108, 0.06); def(M.CLOTHES_GRAY, 108, 102, 94, 0.06);
def(M.HEN, 224, 218, 204, 0.05); def(M.DUCK, 208, 210, 206, 0.05);
def(M.GRAIN, 204, 178, 108, 0.08); def(M.WICKER, 152, 118, 76, 0.08); def(M.METAL, 108, 104, 100, 0.05);

/* ---------------- voxel grid ---------------- */
const W = 170, H = 150, D = 54;
const vox = new Uint8Array(W * H * D);
const ZSTR = W * H;
function inb(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D; }
function setV(x, y, z, m) { if (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D) vox[z * ZSTR + y * W + x] = m; }
function getV(x, y, z) { return (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D) ? vox[z * ZSTR + y * W + x] : 0; }
function isSolid(m) { return m !== 0 && m !== M.WATER && m !== M.PADDY_WATER; }   // 水不参与遮挡/AO
function fillBox(x0, y0, z0, x1, y1, z1, m) {
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setV(x, y, z, m);
}
function isWaterMat(m) { return m === M.WATER || m === M.PADDY_WATER; }

/* 占位表 reserved: 防止树/草长进建筑与道路 */
const reserved = new Uint8Array(W * H);
function reserve(x, y, r) {
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) reserved[yy * W + xx] = 1;
}
function isReserved(x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? 1 : reserved[y * W + x]; }

/* ---------------- heightfield & terrain ---------------- */
const hmap = new Float32Array(W * H);   // 地形高(生成期)
const waterSurf = new Float32Array(W * H); // >0 表示该列水体表面高度
const hCol = (x, y) => hmap[y * W + x];
function setH(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) hmap[y * W + x] = v; }

const CX = 88, CY = 64; // 村落盆地中心
function buildTerrain() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - CX) / 78, dy = (y - CY) / 62;
    let rim = Math.max(Math.abs(dx), Math.abs(dy));       // 方形衰减 → 山谷盆地
    rim = Math.pow(clamp(rim, 0, 1.35), 1.6);
    let h = 9 + rim * 12.5;
    // 北面(远景)抬升更多, 形成主山体
    if (y > 108) h += (y - 108) * 0.09;
    if (x < 26) h += (26 - x) * 0.08;
    if (x > 142) h += (x - 142) * 0.08;
    if (y < 20) h += (20 - y) * 0.03;
    const n = fbm(x * 0.045 + 7.3, y * 0.045 + 2.1, 4);
    h += (n - 0.5) * (3.0 + rim * 4.5);
    hmap[y * W + x] = Math.min(h, 30);
    // 南部谷口缓坡(村前田园带, 供稻田/村口道路)
    if (y < 34) { const t = 9.0 + (34 - y) * 0.03; if (hmap[y * W + x] > t) hmap[y * W + x] = t; }
    // 东部田谷缓坡(溪东田带)
    if (x > 112 && y > 40 && y < 96) { const t = 9.0 + (x - 112) * 0.055 + Math.max(0, x - 140) * 0.38; if (hmap[y * W + x] > t) hmap[y * W + x] = t; }
  }
}

/* 折线工具: 返回重采样点列 */
function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) out.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n), len]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/* ---------------- 溪流 / 泉塘 / 灌溉渠 ---------------- */
const STREAM = [[121, 149], [117, 134], [113, 120], [110, 106], [111, 92], [114, 78], [112, 64], [107, 52], [103, 40], [106, 24], [110, 10], [112, 0]];
const CHANNEL = [[103, 40], [100, 34], [92, 30], [84, 30], [76, 26], [64, 22], [58, 16]];
function buildWater() {
  // 泉塘(源头)
  carvePond(119, 140, 7, 19.5);
  // 溪流: 自北向南
  const sp = resample(STREAM, 0.7);
  const L = sp.length;
  for (let i = 0; i < L; i++) {
    const [x, y] = sp[i];
    const t = i / (L - 1);
    const z = lerp(19.5, 8.4, Math.pow(t, 0.82));       // 源头高 → 出口低(出口接近谷底, 避免深沟)
    const wob = (vnoise(x * 0.09, y * 0.09) - 0.5) * 1.4;
    carveStreamCol(x, y, z + wob, 2.1);
  }
  // 灌溉渠: 溪流西岸 → 南部稻田 (沿等高线)
  const cp = resample(CHANNEL, 0.8);
  for (let i = 0; i < cp.length; i++) {
    const [x, y] = cp[i];
    const t = i / (cp.length - 1);
    const z = lerp(10.2, 8.2, t);
    carveChannelCol(x, y, z);
  }
  // 渠边小水塘
  carvePond(84, 30, 4.5, 10.2);
}
function carvePond(cx, cy, r, surf) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = Math.hypot(x - cx, y - cy) + (vnoise(x * 0.3, y * 0.3) - 0.5) * 1.2;
    if (d < r) {
      setH(x, y, surf - 2.2); waterSurf[y * W + x] = surf; reserve(x, y, 0);
    } else if (d < r + 1.6) setH(x, y, Math.min(hCol(x, y), surf - 0.6));
  }
}
function carveStreamCol(x, y, z, r) {
  const xi = Math.round(x), yi = Math.round(y);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const xx = xi + dx, yy = yi + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const d = Math.hypot(xx - x, yy - y);
    if (d < r) { setH(xx, yy, Math.min(hCol(xx, yy), z - 1.4)); waterSurf[yy * W + xx] = Math.max(waterSurf[yy * W + xx], z); reserve(xx, yy, 0); }
    else if (d < r + 1.8) { setH(xx, yy, Math.min(hCol(xx, yy), z + 0.8 + (d - r) * 1.4)); }
  }
}
function carveChannelCol(x, y, z) {
  const xi = Math.round(x), yi = Math.round(y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = xi + dx, yy = yi + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const d = Math.max(Math.abs(xx - x), Math.abs(yy - y));
    if (d < 1.1) { setH(xx, yy, Math.min(hCol(xx, yy), z - 1.2)); waterSurf[yy * W + xx] = Math.max(waterSurf[yy * W + xx], z); reserve(xx, yy, 0); }
    else if (d < 2.1) setH(xx, yy, Math.min(hCol(xx, yy), z + 0.5));
  }
}

/* ---------------- 梯田 ---------------- */
function buildTerraces() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inNorth = (y > 96 && x > 12 && x < 102 && y < 146);
    const inEast = (x > 118 && y > 84 && y < 118 && x < 156);
    if (!inNorth && !inEast) continue;
    const h = hCol(x, y);
    const mask = fbm(x * 0.06 + 40, y * 0.06 + 9, 3);
    if (h < 12.5 || mask < 0.42) continue;               // 只在足够高的坡上
    const slope = Math.abs(hCol(Math.min(x + 3, W - 1), y) - hCol(Math.max(x - 3, 0), y)) + Math.abs(hCol(x, Math.min(y + 3, H - 1)) - hCol(x, Math.max(y - 3, 0)));
    if (slope < 2.2) continue;                           // 平地不成梯田
    const q = Math.round(h / 3) * 3;
    hmap[y * W + x] = lerp(h, q, 0.8);
  }
}

/* ---------------- 道路 ---------------- */
const ROADS = [
  { pts: [[46, 3], [47, 14], [52, 24], [62, 32], [72, 40], [80, 46], [86, 49]], w: 3.4, mat: M.PATH_STONE },
  { pts: [[80, 52], [72, 60], [66, 72], [60, 88], [56, 100], [53, 109]], w: 2.4, mat: M.PATH_STONE },
  { pts: [[90, 50], [98, 53], [105, 56], [116, 57], [119, 52], [118, 45]], w: 2.4, mat: M.PATH_STONE },
  { pts: [[118, 60], [124, 66], [130, 76], [136, 88]], w: 1.4, mat: M.PATH_DIRT },
  { pts: [[56, 20], [66, 18], [76, 15]], w: 1.4, mat: M.PATH_DIRT },
  { pts: [[96, 38], [104, 30], [108, 22]], w: 1.4, mat: M.PATH_DIRT },
  { pts: [[70, 96], [78, 100], [82, 108]], w: 1.2, mat: M.PATH_DIRT },
  { pts: [[42, 24], [46, 32], [52, 38]], w: 1.2, mat: M.PATH_DIRT }
];
function buildRoads() {
  for (const rd of ROADS) {
    const pts = resample(rd.pts, 0.6);
    // 先采集沿路地形高并平滑 → 缓坡
    const hs = pts.map(([x, y]) => hCol(Math.round(x), Math.round(y)));
    for (let it = 0; it < 24; it++) {
      for (let i = 1; i < hs.length - 1; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]; const hz = hs[i];
      stampRoad(x, y, rd.w, hz, rd.mat);
    }
  }
  // 广场
  stampPlaza(88, 50, 13.5, 10.5);
  // 祠堂前石坪
  stampPlaza(59, 46.5, 9, 4.2, 0.72);
}
function stampRoad(x, y, w, hz, mat) {
  const xi = Math.round(x), yi = Math.round(y);
  const R = Math.ceil(w + 1.6);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const xx = xi + dx, yy = yi + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    if (waterSurf[yy * W + xx] > 0) continue;            // 不覆盖水面(桥另建)
    const d = Math.hypot(xx - x, yy - y) + (hash2(xx * 3 + 1, yy * 3 + 7) - 0.5) * 1.2;
    if (d > w / 2 + 0.8) continue;
    const edge = d < w / 2 ? 1 : (d < w / 2 + 0.8 ? 0.45 : 0);
    const cur = hCol(xx, yy);
    const target = lerp(cur, hz, edge);
    if (edge > 0) {
      setH(xx, yy, target);
      if (edge === 1) reserve(xx, yy, 0);
    }
  }
}
function stampPlaza(cx, cy, rx, ry, keep) {
  const k = keep || 1;
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (vnoise(x * 0.35, y * 0.35) - 0.5) * 0.16;
    if (d > 1) continue;
    if (waterSurf[y * W + x] > 0) continue;
    setH(x, y, lerp(hCol(x, y), 9.0, k * (1 - d * 0.4)));
    reserve(x, y, 0);
  }
}

/* ---------------- 地形 → 体素 ---------------- */
/* 单列重铺(场地平整后保持地形体素与高度图一致) */
function restampColumn(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const h = hCol(x, y), top = Math.max(1, Math.round(h));
  const ws = waterSurf[y * W + x], wTop = ws > 0 ? Math.round(ws) : -1;
  for (let z = 0; z <= top; z++) {
    let m;
    if (z === 0) m = M.ROCK;
    else if (z === top) m = surfaceMat(x, y, top);
    else if (z >= top - 1 && wTop < 0) m = M.SOIL;
    else if (z >= top - 3) m = (z % 3 === 0) ? M.EARTH : M.EARTH_DEEP;
    else m = (z % 4 < 2) ? M.EARTH_DEEP : M.ROCK;
    setV(x, y, z, m);
  }
  for (let z = top + 1; z < D; z++) setV(x, y, z, 0);
  if (wTop > 0) for (let z = top + 1; z <= wTop; z++) setV(x, y, z, isPaddy(x, y) ? M.PADDY_WATER : M.WATER);
}
function voxelizeTerrain() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const h = hCol(x, y);
    const top = Math.max(1, Math.round(h));
    const ws = waterSurf[y * W + x];
    const wTop = ws > 0 ? Math.round(ws) : -1;
    // 地下与基座层
    for (let z = 0; z <= top; z++) {
      let m;
      if (z === 0) m = M.ROCK;
      else if (z === top) m = surfaceMat(x, y, top);
      else if (z >= top - 1 && wTop < 0) m = M.SOIL;
      else if (z >= top - 3) m = (z % 3 === 0) ? M.EARTH : M.EARTH_DEEP;
      else m = (z % 4 < 2) ? M.EARTH_DEEP : M.ROCK;
      setV(x, y, z, m);
    }
    // 水体
    if (wTop > 0) {
      for (let z = top + 1; z <= wTop; z++) setV(x, y, z, isPaddy(x, y) ? M.PADDY_WATER : M.WATER);
    }
  }
}
function isPaddy(x, y) {
  return (y < 30 && x > 50 && x < 116) || (x > 116 && y > 48 && y < 92);
}
function surfaceMat(x, y, z) {
  const ws = waterSurf[y * W + x];
  if (ws > 0) return M.STONE;                            // 水下河床
  const n = fbm(x * 0.11 + 3, y * 0.11 + 11, 3);
  const h = z;
  if (isPaddy(x, y) && h < 12) return M.DARK_SOIL;
  if (h < 10.6 && n > 0.42 && x > 64 && x < 112 && y > 26 && y < 96) return M.SOIL;               // 村落谷底多裸土
  if (n > 0.66) return M.GRASS_DRY;
  return M.GRASS;
}

/* ---------------- 夯土墙着色参数(渲染期用) ---------------- */

/* ============================================================
 * 建造器 BUILDERS
 * ============================================================ */

/* 通用: 平整场地 (disc) */
function flattenDisc(cx, cy, r, z) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d < r) { setH(x, y, z); restampColumn(x, y); reserve(x, y, 0); }
    else if (d < r + 2.2) { setH(x, y, lerp(z, hCol(x, y), (d - r) / 2.2)); restampColumn(x, y); }
  }
  return Math.round(z);
}
function flattenRect(cx, cy, hw, hh, z) {
  for (let y = Math.floor(cy - hh - 2); y <= cy + hh + 2; y++) for (let x = Math.floor(cx - hw - 2); x <= cx + hw + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const dx = Math.max(0, Math.abs(x - cx) - hw), dy = Math.max(0, Math.abs(y - cy) - hh);
    const d = Math.hypot(dx, dy);
    if (d < 0.6) { setH(x, y, z); restampColumn(x, y); reserve(x, y, 0); }
    else if (d < 2.2) { setH(x, y, lerp(z, hCol(x, y), (d - 0.6) / 1.6)); restampColumn(x, y); }
  }
  return Math.round(z);
}

/* ---------- CreateTulou: 参数化土楼 ---------- */
/* shape: 'round' | 'square' ; age: 0 较新 1 中等 2 陈旧 */
function buildTulou(o) {
  const shape = o.shape || 'round';
  const R = o.r, T = o.wallT, floors = o.floors, fh = o.floorH;
  const base = (shape === 'round') ? flattenDisc(o.cx, o.cy, R + 3, o.z) : flattenRect(o.cx, o.cy, R + 2, R2(o) + 2, o.z);
  function R2(q) { return q.ry != null ? q.ry : q.r; }
  const z0 = base;                     // 室内地坪
  const fnd = z0;                      // 石基座顶
  const topSlab = z0 + floors * fh;    // 顶层楼板
  const wallTop = topSlab + 1;
  const wallMat = o.wallMat;
  const age = o.age || 0;
  const gateA = (o.gateDir || 180) * Math.PI / 180;      // 门的方位角(世界): 180=朝南
  const cx = o.cx, cy = o.cy;

  // 距离场函数
  function dist(x, y) {
    if (shape === 'round') return Math.hypot(x - cx, y - cy);
    const hw = R, hh = R2(o);
    return Math.max(Math.abs(x - cx) / hw, Math.abs(y - cy) / hh) * Math.min(hw, hh); // 归一化方环距离
  }
  const isSquare = shape === 'square';

  // ---- 外墙 + 基座 ----
  const gateHalf = isSquare ? 2.2 : 2.4;   // 门洞半宽(距离)
  const gateH = 4;
  for (let y = Math.floor(cy - R - 3); y <= Math.ceil(cy + R + 3); y++) {
    for (let x = Math.floor(cx - R - 3); x <= Math.ceil(cx + R + 3); x++) {
      if (!inb(x, y, 0)) continue;
      const d = dist(x, y);
      const jit = (vnoise(x * 0.22 + cx, y * 0.22 + cy) - 0.5) * (isSquare ? 0.3 : 0.9);
      const inWall = d >= R - T + jit && d < R + jit * 0.5;
      if (!inWall) continue;
      // 门洞判断
      const ang = Math.atan2(y - cy, x - cx);
      let dA = Math.abs(ang - gateA); if (dA > Math.PI) dA = Math.PI * 2 - dA;
      const gateArc = dA * d;              // 弧长距离
      for (let z = fnd; z <= wallTop; z++) {
        if (gateArc < gateHalf && z > fnd && z <= fnd + gateH) {
          if (z === fnd + gateH) setV(x, y, z, M.STONE);              // 石门楣
          else if (gateArc > gateHalf - 1) setV(x, y, z, M.STONE);    // 门框侧石
          else if (z <= fnd + 1) setV(x, y, z, M.STONE);              // 门槛
          else setV(x, y, z, M.WOOD_DARK);                            // 门洞内木门
          continue;
        }
        setV(x, y, z, z === fnd ? M.STONE : wallMat);
      }
    }
  }
  reserve(cx, cy, R + 2);

  // ---- 内部半径参数 ----
  const roomD = o.roomD || 4;          // 房间环进深
  const corrW = 2;                     // 走廊宽
  const Ri = R - T - roomD;            // 房间环内半径(=走廊外缘)
  const Rc = Ri - corrW;               // 走廊内缘(=庭院半径)

  // ---- 各层楼板 / 走廊 / 栏杆 / 柱 / 门窗 ----
  for (let f = 1; f <= floors; f++) {
    const slabZ = Math.round(z0 + f * fh);         // 楼板顶面所在 z
    const r0 = Rc, r1 = R - T;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        if (!inb(x, y, 0)) continue;
        const d = dist(x, y);
        if (d < r0 - 0.5 || d >= r1) continue;
        // 楼板
        setV(x, y, slabZ, M.WOOD_MID);
        // 内缘栏杆(单层栏板, 顶部由屋檐覆盖)
        if (d < r0 + 1 && d >= r0 - 0.2) {
          setV(x, y, slabZ + 1, M.WOOD_DARK);       // 栏板
        }
        // 柱(走廊外缘)
        if (d >= Ri - 1.2 && d < Ri - 0.2) {
          const bay = Math.floor((isSquare ? (x * 3 + y * 3) : (Math.atan2(y - cy, x - cx) * 8))) % 4 === 0;
          if (bay || hash2(x + f * 31, y - f * 17) < 0.22) setV(x, y, slabZ + 1, M.WOOD_MID);
        }
      }
    }
    // 房间单元木隔墙(径向, 填充凹龛结构)
    const nBayP = isSquare ? 8 : Math.max(8, Math.round(2 * Math.PI * Ri / 7));
    for (let b = 0; b <= nBayP; b++) {
      const ang = gateA + Math.PI + b * (Math.PI * 2 / nBayP);
      for (let rr = Ri; rr < R - T; rr += 0.7) {
        const px = Math.round(cx + Math.cos(ang) * rr);
        const py = Math.round(cy + Math.sin(ang) * rr);
        if (!inb(px, py, 0)) continue;
        if (dist(px, py) < Ri - 0.2) continue;
        for (let k = 1; k < fh; k++) setV(px, py, Math.round(z0 + f * fh) + k, M.WOOD_MID);
      }
    }
    // 内院-facing 房间门 (ground: 朝庭院开门; 上层: 小窗)
    const nBay = nBayP;
    for (let b = 0; b < nBay; b++) {
      const ang = gateA + Math.PI + (b + 0.5) * (Math.PI * 2 / nBay);   // 避开大门一侧
      const px = Math.round(cx + Math.cos(ang) * (Ri - 1.4));
      const py = Math.round(cy + Math.sin(ang) * (Ri - 1.4));
      if (!inb(px, py, 0)) continue;
      if (f === 1) { setV(px, py, slabZ - 1, M.WOOD_DARK); setV(px, py, slabZ - 2, M.WOOD_DARK); } // 地面层门口(矮)
      else {
        setV(px, py, slabZ + 1, M.WOOD_DARK);       // 朝院内小窗
        if (hash3(px, py, f) < 0.18) setV(px, py, slabZ + 1, M.LANTERN_GLOW); // 少量暖光
      }
    }
    // 外墙窗 (二层以上)
    const nWin = isSquare ? 7 : Math.max(10, Math.round(2 * Math.PI * R / 8));
    for (let b = 0; b < nWin; b++) {
      const ang = (b + 0.5) * (Math.PI * 2 / nWin) + (isSquare ? Math.PI / 8 : 0);
      const wx = Math.round(cx + Math.cos(ang) * (R - 1.2));
      const wy = Math.round(cy + Math.sin(ang) * (R - 1.2));
      if (!inb(wx, wy, 0)) continue;
      if (f >= 2) { setV(wx, wy, slabZ + 1, M.WOOD_DARK); }
    }
  }

  // ---- 楼梯(沿内壁两跑) ----
  for (let f = 1; f < floors; f++) {
    const aSt = gateA + Math.PI * (0.7 + 0.35 * f);
    for (let s = 0; s < 6; s++) {
      const dd = lerp(Rc + 0.5, R - T - 1, s / 5);
      const px = Math.round(cx + Math.cos(aSt) * dd), py = Math.round(cy + Math.sin(aSt) * dd);
      const zz = z0 + f * fh - 1 + Math.round(s * fh / 6);
      setV(px, py, zz, M.WOOD_DARK); setV(px, py, zz - 1, M.WOOD_MID);
    }
  }

  // ---- 中央天井庭院(暖土色 + 石板) ----
  for (let y = Math.floor(cy - Rc); y <= Math.ceil(cy + Rc); y++) {
    for (let x = Math.floor(cx - Rc); x <= Math.ceil(cx + Rc); x++) {
      if (!inb(x, y, 0)) continue;
      if (dist(x, y) < Rc - 0.4) {
        const r = hash2(x * 5, y * 5);
        setV(x, y, z0, r < 0.5 ? M.PATH_STONE : (r < 0.8 ? M.PATH_DIRT : M.STRAW));
      }
    }
  }

  // ---- 环形屋顶(外高内低, 阶梯状; 内檐高于顶层栏杆) ----
  const rO = R + (isSquare ? 1.6 : 2.2);        // 外挑檐
  const rI = Rc - 1.2;                          // 内挑檐(悬于走廊上方)
  const zRO = topSlab + 4;
  const zRI = topSlab + 2;
  const steps = Math.max(3, Math.round((rO - rI) / 2.6));
  for (let y = Math.floor(cy - rO - 1); y <= Math.ceil(cy + rO + 1); y++) {
    for (let x = Math.floor(cx - rO - 1); x <= Math.ceil(cx + rO + 1); x++) {
      if (!inb(x, y, 0)) continue;
      const d = dist(x, y);
      if (d < rI - 0.8 || d > rO) continue;
      const t = clamp((rO - d) / (rO - rI), 0, 1);
      let zr = Math.round(lerp(zRO, zRI, t));
      const inGateArc = (() => { const ang = Math.atan2(y - cy, x - cx); let dA = Math.abs(ang - gateA); if (dA > Math.PI) dA = Math.PI * 2 - dA; return dA * d < gateHalf + 1.5 && d > R - 1; })();
      if (inGateArc && d > R) continue;         // 大门上方留出罩顶空间
      setV(x, y, zr, M.ROOF_TILE);
      if (d > rO - 1.3) { setV(x, y, zr - 1, M.WOOD_DARK); if (d > rO - 0.8) setV(x, y, zr, M.ROOF_RIDGE); } // 外檐封板+脊
      if (d < rI + 1.0) { setV(x, y, zr - 1, M.WOOD_DARK); if (d < rI + 0.5) setV(x, y, zr, M.ROOF_RIDGE); } // 内檐封板
    }
  }

  // ---- 门罩(门廊小顶) ----
  const gx = Math.round(cx + Math.cos(gateA) * (R + 1.2)), gy = Math.round(cy + Math.sin(gateA) * (R + 1.2));
  const gz = fnd + gateH + 1;
  for (let dy2 = -2; dy2 <= 2; dy2++) for (let dx2 = -2; dx2 <= 2; dx2++) {
    const px = gx + dx2, py = gy + dy2;
    if (!inb(px, py, 0)) continue;
    const per = (Math.abs(Math.sin(gateA) * dx2 - Math.cos(gateA) * dy2));  // 垂直于门轴
    const along = (Math.cos(gateA) * dx2 + Math.sin(gateA) * dy2);
    if (per > 2.2) continue;
    const zz = gz + Math.max(0, Math.round(1.6 - Math.abs(along)));
    setV(px, py, zz, along > 0.8 ? M.ROOF_RIDGE : M.ROOF_TILE);
    if (Math.abs(along) < 0.6 && per > 1.6) { setV(px, py, gz - 1, M.WOOD_MID); setV(px, py, gz - 2, M.WOOD_MID); } // 门柱
  }

  // ---- 庭院生活设施 ----
  if (o.courtyard) o.courtyard(cx, cy, Rc, z0, isSquare);
}

/* 庭院道具集 */
function courtProps(cx, cy, Rc, z0, kind) {
  if (kind === 'main') {
    buildWell(cx - 4, cy - 1, z0);
    buildStoneTable(cx + 4, cy, z0);
    buildJar(cx - 6, cy + 2, z0); buildJar(cx - 5, cy + 3, z0);
    buildClothesline(cx - 6, cy - 3, cx - 2, cy - 2, z0);
    // 祖堂(庭院北侧小殿)
    buildShrine(cx, cy + Math.round(Rc * 0.55), z0);
  } else if (kind === 'secondary') {
    buildWell(cx + 1, cy + 1, z0);
    buildJar(cx - 3, cy - 2, z0);
    buildFirewood(cx + 3, cy - 3, z0);
  } else if (kind === 'square') {
    buildWell(cx - 2, cy + 2, z0);
    buildDryingRack(cx + 3, cy - 2, z0, 0);
    buildGrainMat(cx - 4, cy - 3, z0);
  }
}

/* 祖堂小殿(核心土楼庭院内) */
function buildShrine(cx, cy, z0) {
  const w = 3, d = 1;
  for (let y = cy - d; y <= cy + d; y++) for (let x = cx - w; x <= cx + w; x++) {
    if (!inb(x, y, 0)) continue;
    setV(x, y, z0 + 1, M.WOOD_MID);
    if (Math.abs(x - cx) === w || y === cy - d) setV(x, y, z0 + 2, M.WOOD_DARK);
    if (y === cy + d && Math.abs(x - cx) < w) { setV(x, y, z0 + 1, M.WOOD_DARK); } // 正面开敞
  }
  for (let s = 0; s <= 2; s++) {
    const zz = z0 + 2 + s;
    for (let yy = cy - d - 1 + s; yy <= cy + d + 1 - s; yy++) {
      for (let xx = cx - w - 1 + s; xx <= cx + w + 1 - s; xx++) {
        setV(xx, yy, zz, s === 2 ? M.ROOF_RIDGE : M.ROOF_TILE);
        if (s === 0) setV(xx, yy, zz - 1, M.WOOD_DARK);
      }
    }
  }
}

/* ---------- 客家民居 CreateHakkaHouse ---------- */
/* w: 进深(x) d: 面宽(y) fl: 层数 rot: 0/90 面向 */
function buildHouse(o) {
  const { x, y, w, d, fl, facing } = o;
  const rot = (facing === 'E' || facing === 'W') ? 1 : 0;
  const hw = rot ? Math.floor(d / 2) : Math.floor(w / 2);
  const hd = rot ? Math.floor(w / 2) : Math.floor(d / 2);
  const z = flattenRect(x, y, hw + 1, hd + 1, o.z != null ? o.z : hCol(Math.round(x), Math.round(y)));
  const h1 = 3;                                  // 每层高
  const wallMat = o.wallMat || M.WALL_EARTH_B;
  const z0 = z;
  const top = z0 + fl * h1;
  for (let yy = y - hd; yy <= y + hd; yy++) for (let xx = x - hw; xx <= x + hw; xx++) {
    if (!inb(xx, yy, 0)) continue;
    // 石基 + 墙
    setV(xx, yy, z0, M.STONE);
    for (let f = 0; f < fl; f++) {
      const zz = z0 + 1 + f * h1;
      const isTop = f === fl - 1;
      for (let k = 1; k <= h1 - (isTop ? 0 : 1); k++) {
        const edge = (xx === x - hw || xx === x + hw || yy === y - hd || yy === y + hd);
        if (edge) setV(xx, yy, zz + k - 1, wallMat);
      }
    }
    reserve(xx, yy, 0);
  }
  // 楼板
  for (let f = 1; f < fl; f++) {
    for (let yy = y - hd + 1; yy <= y + hd - 1; yy++) for (let xx = x - hw + 1; xx <= x + hw - 1; xx++) setV(xx, yy, z0 + f * h1, M.WOOD_MID);
  }
  // 门(朝 facing)
  const dv = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[facing];
  const dx0 = x + dv[0] * (rot ? hd : hw), dy0 = y + dv[1] * (rot ? hd : hw);
  // 门开在面宽中央
  if (rot) { for (let k = 1; k <= 2; k++) { setV(dx0, y, z0 + k, M.WOOD_DARK); setV(dx0, y - (dv[0] > 0 ? 0 : 0), z0 + k, M.WOOD_DARK); } setV(dx0, y, z0 + 3, M.WOOD_MID); }
  else { for (let k = 1; k <= 2; k++) setV(x, dy0, z0 + k, M.WOOD_DARK); setV(x, dy0, z0 + 3, M.WOOD_MID); }
  // 小窗
  const wins = o.wins != null ? o.wins : 2;
  for (let i = 0; i < wins; i++) {
    const off = (i - (wins - 1) / 2) * 3;
    if (rot) { const wx = dx0, wy = clamp(y + off, y - hd + 1, y + hd - 1); setV(wx, wy, z0 + (fl > 1 ? h1 + 2 : 2), M.WOOD_DARK); }
    else { const wx = clamp(x + off, x - hw + 1, x + hw - 1), wy = dy0; setV(wx, wy, z0 + (fl > 1 ? h1 + 2 : 2), M.WOOD_DARK); }
  }
  // 二层木栏小阳台
  if (fl > 1) {
    for (let k = -1; k <= 1; k++) {
      if (rot) { setV(dx0 + dv[0], y + k, z0 + h1 + 1, M.WOOD_DARK); }
      else { setV(x + k, dy0 + dv[1], z0 + h1 + 1, M.WOOD_DARK); }
    }
  }
  // 坡屋顶 (沿长轴屋脊)
  buildGableRoof(x, y, hw, hd, top, o.roofMoss || 0);
}
function buildGableRoof(x, y, hw, hd, zBase, moss) {
  // 屋脊沿较长方向; 每层整带实心填充, 保证坡面闭合不镂空
  const alongX = hw >= hd;
  const R = alongX ? hd : hw;              // 坡向半径
  const L = alongX ? hw : hd;              // 脊向半径
  const steps = Math.min(R, 4);
  for (let s = 0; s <= steps; s++) {
    const zz = zBase + 1 + s;
    const bEdge = R + 1 - s;
    for (let a = -L - 1; a <= L + 1; a++) {
      for (let b = -bEdge; b <= bEdge; b++) {
        const px = alongX ? x + a : x + b, py = alongX ? y + b : y + a;
        if (!inb(px, py, 0)) continue;
        const m = (s === steps && b === 0) ? M.ROOF_RIDGE : M.ROOF_TILE;
        setV(px, py, zz, m);
        if (s === 0) setV(px, py, zz - 1, M.WOOD_DARK);   // 檐口封板
      }
    }
  }
  // 山墙(三角)
  const gableX = alongX;
  for (let s = 1; s <= steps; s++) {
    for (let b = -(alongX ? hd : hw) + s; b <= (alongX ? hd : hw) - s; b++) {
      const px = gableX ? x - hw : x + b, py = gableX ? y + b : y - hd;
      setV(px, py, zBase + 1 + s - 1, M.WALL_BRICK);
      const px2 = gableX ? x + hw : x + b, py2 = gableX ? y + b : y + hd;
      setV(px2, py2, zBase + 1 + s - 1, M.WALL_BRICK);
    }
  }
}

/* ---------- 祠堂 ---------- */
function buildAncestralHall(cx, cy) {
  const z = flattenRect(cx, cy, 9, 7, hCol(cx, cy) > 10 ? 10 : 9);
  const z0 = z;
  // 石平台
  for (let yy = cy - 7; yy <= cy + 6; yy++) for (let xx = cx - 9; xx <= cx + 8; xx++) {
    if (!inb(xx, yy, 0)) continue;
    setV(xx, yy, z0, M.STONE); reserve(xx, yy, 0);
  }
  // 台阶(南面)
  for (let s = 0; s < 2; s++) for (let xx = cx - 2; xx <= cx + 1; xx++) setV(xx, cy - 8 + s, z0 - 1 + s, M.STONE);
  // 正堂
  const hw = 6, hd = 3, top = z0 + 5;
  for (let yy = cy - 1; yy <= cy + 5; yy++) for (let xx = cx - hw; xx <= cx + hw; xx++) {
    const edge = (xx === cx - hw || xx === cx + hw || yy === cy + 5 || yy === cy - 1);
    for (let k = 1; k <= 4; k++) if (edge) setV(xx, yy, z0 + k, M.WALL_EARTH_B);
  }
  // 前廊柱 + 大门
  for (let xx = cx - hw; xx <= cx + hw; xx += 3) { setV(xx, cy - 1, z0 + 1, M.WOOD_DARK); setV(xx, cy - 1, z0 + 2, M.WOOD_DARK); setV(xx, cy - 1, z0 + 3, M.WOOD_MID); }
  for (let k = 1; k <= 3; k++) { setV(cx, cy - 1, z0 + k, M.WOOD_DARK); setV(cx + 1, cy - 1, z0 + k, M.WOOD_DARK); }
  setV(cx - 1, cy - 2, z0 + 4, M.CLOTH_RED); setV(cx + 2, cy - 2, z0 + 4, M.CLOTH_RED);   // 灯笼
  // 匾额
  for (let xx = cx - 1; xx <= cx + 2; xx++) setV(xx, cy - 2, z0 + 4, M.WOOD_DARK);
  // 石鼓
  setV(cx - 3, cy - 2, z0 + 1, M.STONE); setV(cx + 4, cy - 2, z0 + 1, M.STONE);
  // 歇山屋顶(实心阶梯, 带正脊 + 两端起翘)
  for (let s = 0; s <= 3; s++) {
    const zz = top + 1 + s;
    const rx = hw + 1 - s, ry = 5 - s;
    for (let yy = cy + 2 - ry; yy <= cy + 2 + ry; yy++) {
      for (let xx = cx - rx; xx <= cx + rx; xx++) {
        setV(xx, yy, zz, M.ROOF_TILE);
        if (s === 0) setV(xx, yy, zz - 1, M.WOOD_DARK);
      }
    }
  }
  // 正脊 + 鸱吻起翘(限制在顶层板范围内)
  for (let xx = cx - (hw - 2); xx <= cx + (hw - 2); xx++) setV(xx, cy + 2, top + 4, M.ROOF_RIDGE);
  setV(cx - (hw - 1), cy + 2, top + 5, M.ROOF_RIDGE); setV(cx + (hw - 1), cy + 2, top + 5, M.ROOF_RIDGE);
  // 院内香炉
  setV(cx, cy - 4, z0 + 1, M.STONE); setV(cx, cy - 4, z0 + 2, M.STONE);
}

/* ---------- 村口门楼 ---------- */
function buildVillageGate(cx, cy, axis) {
  const z = Math.round(hCol(cx, cy));
  // axis 'x': 门横跨东西向道路(路沿x走) → 门柱沿y排列
  const span = 2;
  const posts = axis === 'x' ? [[cx, cy - span - 1], [cx, cy + span + 1]] : [[cx - span - 1, cy], [cx + span + 1, cy]];
  for (const [px, py] of posts) {
    for (let k = 1; k <= 5; k++) setV(px, py, z + k, k <= 2 ? M.STONE : M.WOOD_DARK);
    setV(px, py, z, M.STONE);
  }
  // 横梁
  if (axis === 'x') for (let py = cy - span - 1; py <= cy + span + 1; py++) setV(cx, py, z + 6, M.WOOD_DARK);
  else for (let px = cx - span - 1; px <= cx + span + 1; px++) setV(px, cy, z + 6, M.WOOD_DARK);
  // 小顶
  for (let s = 0; s <= 1; s++) {
    if (axis === 'x') for (let py = cy - span - 2 + s; py <= cy + span + 2 - s; py++) { setV(cx, py, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); setV(cx - 1, py, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); setV(cx + 1, py, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); }
    else for (let px = cx - span - 2 + s; px <= cx + span + 2 - s; px++) { setV(px, cy, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); setV(px, cy - 1, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); setV(px, cy + 1, z + 7 + s, s ? M.ROOF_RIDGE : M.ROOF_TILE); }
  }
  // 灯笼
  if (axis === 'x') { setV(cx, cy - span, z + 5, M.LANTERN); setV(cx, cy + span, z + 5, M.LANTERN); }
  else { setV(cx - span, cy, z + 5, M.LANTERN); setV(cx + span, cy, z + 5, M.LANTERN); }
  // 侧边石碑
  setV(cx + (axis === 'x' ? 4 : 0), cy + (axis === 'x' ? 0 : 4), z + 1, M.STONE);
  setV(cx + (axis === 'x' ? 4 : 0), cy + (axis === 'x' ? 0 : 4), z + 2, M.STONE);
  reserve(cx, cy, 4);
}

/* ---------- 石桥 ---------- */
function buildBridge(cx, cy, alongX, len) {
  const zb = Math.round(hCol(cx - (alongX ? Math.round(len / 2) + 2 : 0), cy - (alongX ? 0 : Math.round(len / 2) + 2)));
  const z = zb + 1;
  for (let i = -Math.floor(len / 2); i <= Math.floor(len / 2); i++) {
    const px = alongX ? cx + i : cx, py = alongX ? cy : cy + i;
    for (let s = -1; s <= 1; s++) {
      const qx = alongX ? px : px + s, qy = alongX ? py + s : py;
      setV(qx, qy, z, M.STONE);
      if (Math.abs(s) === 1) setV(qx, qy, z + 1, M.STONE);           // 低栏
    }
    // 桥墩
    if (Math.abs(i) === Math.floor(len / 2) - 2) {
      for (let k = -2; k < 0; k++) setV(alongX ? px : px, alongX ? py : py, z + k, M.STONE);
    }
  }
  reserve(cx, cy, 5);
}

/* ---------- 水井 / 石桌 / 水缸 / 柴堆 / 晒架 / 石磨 / 篱笆 ---------- */
function buildWell(cx, cy, z0) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { setV(cx + dx, cy + dy, z0 + 1, M.STONE); setV(cx + dx, cy + dy, z0, M.STONE); }
  setV(cx, cy, z0 + 2, M.STONE); setV(cx + 1, cy + 1, z0 + 2, M.STONE);
  setV(cx, cy, z0 + 1, M.WOOD_DARK); setV(cx + 1, cy, z0 + 1, M.WOOD_DARK);
  setV(cx - 1, cy, z0 + 3, M.WOOD_DARK); setV(cx + 2, cy + 1, z0 + 3, M.WOOD_DARK);
  setV(cx - 1, cy, z0 + 4, M.ROOF_TILE); setV(cx, cy, z0 + 4, M.ROOF_TILE); setV(cx + 1, cy + 1, z0 + 4, M.ROOF_TILE); setV(cx + 2, cy + 1, z0 + 4, M.ROOF_TILE);
}
function buildStoneTable(cx, cy, z0) {
  setV(cx, cy, z0 + 1, M.STONE);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setV(cx + dx, cy + dy, z0 + 1, M.WOOD_MID);
}
function buildJar(cx, cy, z0) {
  setV(cx, cy, z0 + 1, M.CLAY); setV(cx + 1, cy, z0 + 1, M.CLAY); setV(cx, cy + 1, z0 + 1, M.CLAY); setV(cx + 1, cy + 1, z0 + 1, M.CLAY);
  setV(cx, cy, z0 + 2, M.CLAY); setV(cx + 1, cy + 1, z0 + 2, M.CLAY);
  setV(cx, cy, z0 + 3, M.CLAY);
}
function buildFirewood(cx, cy, z0) {
  for (let k = 0; k < 4; k++) setV(cx + k, cy, z0 + 1, M.WOOD_MID);
  for (let k = 0; k < 4; k++) setV(cx + k, cy, z0 + 2, k % 2 ? M.WOOD_LIGHT : M.WOOD_MID);
  setV(cx + 1, cy, z0 + 3, M.WOOD_LIGHT); setV(cx + 2, cy, z0 + 3, M.WOOD_MID);
}
function buildDryingRack(cx, cy, z0, rot) {
  const len = 3;
  for (let i = 0; i <= len; i++) {
    const px = cx + (rot ? 0 : i), py = cy + (rot ? i : 0);
    setV(px, py, z0 + 1, M.WOOD_DARK); setV(px, py, z0 + 2, M.WOOD_DARK);
    setV(px, py, z0 + 3, i === 0 || i === len ? M.WOOD_DARK : M.CLOTH_TAN);   // 挂晒谷席
  }
}
function buildGrainMat(cx, cy, z0) {
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) setV(cx + dx, cy + dy, z0 + 1, M.STRAW);
}
function buildStoneMill(cx, cy, z0) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) setV(cx + dx, cy + dy, z0 + 1, M.STONE);
  setV(cx, cy, z0 + 2, M.STONE); setV(cx + 1, cy, z0 + 2, M.METAL);
}
function buildFence(x0, y0, x1, y1, bamboo) {
  const m = bamboo ? M.BAMBOO : M.WOOD_MID;
  const step = (a, b, vert) => {
    const n = Math.max(Math.abs(b - a), 1);
    for (let i = 0; i <= n; i++) {
      const t = a + (b - a) * i / n;
      const px = vert ? Math.round(t) : a, py = vert ? a : Math.round(t);
      const isPost = i % 2 === 0;
      setV(vert ? px : px, vert ? py : py, Math.round(hCol(clamp(px, 0, W - 1), clamp(py, 0, H - 1))) + 1, isPost ? m : m);
      if (!isPost) setV(px, py, Math.round(hCol(clamp(px, 0, W - 1), clamp(py, 0, H - 1))) + 2, m);
    }
  };
  step(x0, x1, false); step(y0, y1, true); step(x0, x1, false);
}

/* ---------- 菜园 ---------- */
function buildGarden(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const z = Math.round(hCol(x, y));
    setV(x, y, z, M.DARK_SOIL);
    reserve(x, y, 0);
    const edge = (x === x0 || x === x1 || y === y0 || y === y1);
    if (edge) { setV(x, y, z + 1, M.BAMBOO); continue; }
    const r = hash2(x * 13, y * 7);
    if ((x + y) % 2 === 0) setV(x, y, z + 1, r < 0.72 ? M.VEG_GREEN : (r < 0.86 ? M.VEG_LEAF : M.VEG_ORANGE));
  }
}

/* ---------- 稻田(平地) ---------- */
function buildPaddy(x0, y0, x1, y1, level) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (waterSurf[y * W + x] > 0) continue;             // 避开溪流
    reserve(x, y, 0);
    const edge = (x === x0 || x === x1 || y === y0 || y === y1);
    setH(x, y, level);
    restampColumn(x, y);
    if (edge) { setV(x, y, Math.round(level), M.SOIL); setV(x, y, Math.round(level) + 1, M.SOIL); continue; }  // 田埂
    setV(x, y, Math.round(level), M.DARK_SOIL);
    setV(x, y, Math.round(level) + 1, M.PADDY_WATER);
    if ((x % 2 === 0) && (y % 2 === 0) && hash2(x * 3, y * 5) < 0.7) setV(x, y, Math.round(level) + 2, hash2(x * 7, y * 3) < 0.85 ? M.RICE : M.RICE_YOUNG);
  }
}

/* ---------- 茶园(坡地) ---------- */
function buildTea(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (isReserved(x, y)) continue;
    const h = hCol(x, y);
    const q = Math.round(h / 3) * 3;
    setH(x, y, lerp(h, q, 0.85));
    restampColumn(x, y);
    if ((x % 3 === 0) && (y % 2 === 0)) {
      const z = Math.round(q);
      setV(x, y, z + 1, M.TEA); setV(x, y, z + 2, M.TEA);
      if (hash2(x, y) < 0.5) setV(x + 1, y, z + 1, M.TEA);
    }
  }
}

/* ---------- 树木 ---------- */
function buildTree(cx, cy, kind, s) {
  const scale = s || 1;
  const z = Math.round(hCol(clamp(cx, 0, W - 1), clamp(cy, 0, H - 1)));
  if (isReserved(cx, cy)) return false;
  const rnd = mulberry32((cx * 73856093 ^ cy * 19349663 ^ SEED) >>> 0);
  if (kind === 'pine') {
    const h = Math.round((7 + rnd() * 5) * scale);
    for (let k = 0; k < h; k++) setV(cx, cy, z + 1 + k, M.WOOD_MID);
    const lv = 4 + Math.round(rnd() * 2);
    for (let l = 0; l < lv; l++) {
      const r = Math.max(1, Math.round((lv - l) * 0.9 * scale));
      const zz = z + 2 + Math.floor((h - 2) * (l / lv)) + 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.5) continue;
        if (hash3(cx + dx, cy + dy, zz + l) < 0.08) continue;
        setV(cx + dx, cy + dy, zz, M.LEAF_PINE);
      }
    }
    setV(cx, cy, z + 1 + h, M.LEAF_PINE);
  } else if (kind === 'fruit') {
    const h = Math.round((4 + rnd() * 2) * scale);
    for (let k = 0; k < h; k++) setV(cx, cy, z + 1 + k, M.WOOD_MID);
    const r = 2 + Math.round(rnd() * scale);
    for (let dz = 0; dz <= 2; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy + dz * dz * 1.6 > r * r + 1) continue;
      if (hash3(cx + dx, cy + dy, z + h + dz) < 0.07) continue;
      setV(cx + dx, cy + dy, z + h + dz, M.LEAF_FRUIT);
    }
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2, rr = 1 + rnd() * (r - 0.5);
      setV(cx + Math.round(Math.cos(a) * rr), cy + Math.round(Math.sin(a) * rr), z + h + Math.round(rnd() * 2), rnd() < 0.5 ? M.FRUIT_ORANGE : M.FRUIT_RED);
    }
  } else if (kind === 'banyan') {
    const h = Math.round(5 * scale);
    for (let k = 0; k < h; k++) { setV(cx, cy, z + 1 + k, M.WOOD_DARK); setV(cx + 1, cy, z + 1 + k, M.WOOD_DARK); }
    const r = 4 + Math.round(rnd() * 2);
    for (let dz = 0; dz <= 4; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const dd = dx * dx + dy * dy + (dz - 1.4) * (dz - 1.4) * 2.4;
      if (dd > r * r + 1.5) continue;
      if (hash3(cx + dx, cy + dy, z + h + dz) < 0.06) continue;
      const hh = hash3(cx + dx * 3, cy + dy * 3, z + dz * 5);
      setV(cx + dx, cy + dy, z + h + dz, hh < 0.4 ? M.LEAF_DARK : (hh < 0.8 ? M.LEAF_MID : M.LEAF_LIGHT));
    }
  } else { // broadleaf 阔叶
    const h = Math.round((4 + rnd() * 4) * scale);
    for (let k = 0; k < h; k++) setV(cx, cy, z + 1 + k, k > h - 3 ? M.WOOD_MID : M.WOOD_DARK);
    const r = Math.round((2 + rnd() * 2.2) * scale);
    for (let dz = -1; dz <= 2; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const dd = dx * dx + dy * dy + (dz - 0.4) * (dz - 0.4) * 2.2;
      if (dd > r * r + 0.8) continue;
      if (hash3(cx + dx, cy + dy, z + h + dz) < 0.07) continue;
      const hh = hash3(cx + dx * 5, cy + dy * 5, z + dz * 3);
      setV(cx + dx, cy + dy, z + h + dz, hh < 0.35 ? M.LEAF_MID : (hh < 0.8 ? M.LEAF_LIGHT : M.LEAF_DARK));
    }
  }
  reserve(cx, cy, 2);
  return true;
}

/* ---------- 竹林 ---------- */
function buildBamboo(cx, cy, r, density) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
    if (isReserved(x, y)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) continue;
    if (hash2(x * 17 + 3, y * 11 + 9) > density * (1 - d / (r + 2))) continue;
    const z = Math.round(hCol(x, y));
    setV(x, y, z, M.GRASS_DRY);
    const h = 6 + Math.floor(hash2(x * 3, y * 5) * 5);
    for (let k = 1; k <= h; k++) setV(x, y, z + k, (k % 3 === 0) ? M.BAMBOO_NODE : M.BAMBOO);
    const top = z + h;
    setV(x + 1, y, top, M.BAMBOO_LEAF); setV(x - 1, y, top - 1, M.BAMBOO_LEAF);
    setV(x, y + 1, top - 2, M.BAMBOO_LEAF); if (hash2(x, y) < 0.5) setV(x, y - 1, top - 1, M.BAMBOO_LEAF);
    if (hash2(x * 5, y) < 0.3) setV(x + 1, y + 1, top - 2, M.BAMBOO_LEAF);
    reserve(x, y, 0);
  }
}

/* ---------- 村民 ---------- */
function buildVillager(cx, cy, pose, dir) {
  const z = Math.round(hCol(clamp(cx, 0, W - 1), clamp(cy, 0, H - 1))) + 1;
  const cloth = pose === 'field' ? M.CLOTHES_BLUE : (hash2(cx, cy) < 0.5 ? M.CLOTHES_GRAY : M.CLOTHES_BLUE);
  if (pose === 'walk') {
    setV(cx, cy, z, M.CLOTHES_GRAY); setV(cx, cy, z + 1, cloth);
    setV(cx, cy, z + 2, M.SKIN); setV(cx, cy, z + 3, M.HAT);
    const dv = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[dir || 'N'];
    setV(cx + dv[0], cy + dv[1], z, cloth);          // 迈步
  } else if (pose === 'carry') {                      // 挑担
    setV(cx, cy, z, M.CLOTHES_GRAY); setV(cx, cy, z + 1, cloth);
    setV(cx, cy, z + 2, M.SKIN); setV(cx, cy, z + 3, M.HAT);
    setV(cx - 1, cy, z + 2, M.WOOD_MID); setV(cx + 1, cy, z + 2, M.WOOD_MID);   // 扁担
    setV(cx - 1, cy, z + 1, M.WICKER); setV(cx + 1, cy, z + 1, M.WICKER);       // 箩筐
  } else if (pose === 'field') {                      // 弯腰劳作
    setV(cx, cy, z, cloth); setV(cx + 1, cy, z, M.CLOTHES_GRAY);
    setV(cx + 1, cy, z + 1, M.SKIN); setV(cx, cy, z + 1, M.HAT);
  } else if (pose === 'sit') {                        // 门口休憩
    setV(cx, cy, z, cloth); setV(cx, cy, z + 1, M.CLOTHES_GRAY);
    setV(cx, cy, z + 2, M.SKIN);
  }
}

/* ---------- 家禽 ---------- */
function buildHen(cx, cy) {
  const z = Math.round(hCol(clamp(cx, 0, W - 1), clamp(cy, 0, H - 1))) + 1;
  setV(cx, cy, z, M.HEN); setV(cx + (hash2(cx, cy) < 0.5 ? 1 : 0), cy, z + 1, M.HEN);
  setV(cx, cy + 1, z, M.FRUIT_RED);
}
function buildDuck(cx, cy) {
  const ws = waterSurf[clamp(cy, 0, H - 1) * W + clamp(cx, 0, W - 1)];
  const z = ws > 0 ? Math.round(ws) + 1 : Math.round(hCol(clamp(cx, 0, W - 1), clamp(cy, 0, H - 1))) + 1;
  setV(cx, cy, z, M.DUCK); setV(cx, cy, z + 1, M.DUCK);
  setV(cx + 1, cy, z + 1, M.HEN);
}

/* ---------- 稻草人 / 鸡舍 / 谷仓 / 晾衣绳 ---------- */
function buildScarecrow(cx, cy) {
  const z = Math.round(hCol(clamp(cx, 0, W - 1), clamp(cy, 0, H - 1))) + 1;
  setV(cx, cy, z, M.WOOD_MID); setV(cx, cy, z + 1, M.WOOD_MID);
  setV(cx - 1, cy, z + 1, M.WOOD_MID); setV(cx + 1, cy, z + 1, M.WOOD_MID);
  setV(cx, cy, z + 2, M.STRAW); setV(cx, cy, z + 3, M.HAT);
}
function buildCoop(cx, cy) {
  const z = flattenRect(cx, cy, 2, 1, hCol(cx, cy));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
    const edge = Math.abs(dx) === 2 || Math.abs(dy) === 1;
    setV(cx + dx, cy + dy, z + 1, edge ? M.WOOD_DARK : M.AIR);
    if (edge) setV(cx + dx, cy + dy, z + 2, M.WOOD_MID);
    setV(cx + dx, cy + dy, z + 3, M.ROOF_TILE_OLD);
  }
  setV(cx, cy - 2, z + 1, M.WOOD_DARK);
}
function buildBarn(cx, cy) {
  const z = flattenRect(cx, cy, 3, 2, hCol(cx, cy));
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    const edge = Math.abs(dx) === 3 || Math.abs(dy) === 2;
    setV(cx + dx, cy + dy, z, M.STONE);
    for (let k = 1; k <= 3; k++) if (edge) setV(cx + dx, cy + dy, z + k, M.WALL_BRICK);
  }
  buildGableRoof(cx, cy, 3, 2, z + 3, 0.4);
}
function buildClothesline(x0, y0, x1, y1, z0) {
  setV(x0, y0, z0 + 1, M.WOOD_DARK); setV(x0, y0, z0 + 2, M.WOOD_DARK);
  setV(x1, y1, z0 + 1, M.WOOD_DARK); setV(x1, y1, z0 + 2, M.WOOD_DARK);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 1; i < n; i++) {
    const px = Math.round(lerp(x0, x1, i / n)), py = Math.round(lerp(y0, y1, i / n));
    if (i % 2 === 0) { setV(px, py, z0 + 1, i % 4 === 0 ? M.CLOTH_INDIGO : M.CLOTH_TAN); setV(px, py, z0 + 2, i % 4 === 0 ? M.CLOTH_INDIGO : M.CLOTH_TAN); }
  }
}

/* ============================================================
 * 场景组装 SCENE ASSEMBLY
 * ============================================================ */
const STATS = { tulous: [], houses: 0, props: 0 };
function assemble() {
  buildTerrain();
  buildWater();
  buildTerraces();
  buildRoads();
  voxelizeTerrain();

  /* ---- 三座土楼 ---- */
  // 一号: 核心大型圆楼 (R=17 → 外径34, 4层)
  buildTulou({
    cx: 88, cy: 76, r: 17, wallT: 3, floors: 4, floorH: 3, z: 9,
    wallMat: M.WALL_EARTH_A, gateDir: 270, age: 0, shape: 'round',
    courtyard: (cx, cy, Rc, z0) => courtProps(cx, cy, Rc, z0, 'main')
  });
  STATS.tulous.push({ name: 'Tulou_Main 振昌楼(核心圆楼)', shape: 'circle', outerDia: 34, floors: 4, wallH: 13, center: [88, 76] });

  // 二号: 中型圆楼 (R=12 → 外径24, 3层, 台地上, 较旧)
  buildTulou({
    cx: 52, cy: 120, r: 12, wallT: 3, floors: 3, floorH: 3, z: 13,
    wallMat: M.WALL_EARTH_B, gateDir: 268, age: 1, shape: 'round',
    courtyard: (cx, cy, Rc, z0) => courtProps(cx, cy, Rc, z0, 'secondary')
  });
  STATS.tulous.push({ name: 'Tulou_Secondary 环兴楼(中型圆楼)', shape: 'circle', outerDia: 24, floors: 3, wallH: 9, center: [52, 120] });

  // 三号: 方形土楼 (21×17, 3层, 风化明显)
  buildTulou({
    cx: 128, cy: 42, r: 10.5, ry: 8.5, wallT: 3, floors: 3, floorH: 3, z: 8, roomD: 2.5,
    wallMat: M.WALL_EARTH_C, gateDir: 168, age: 2, shape: 'square',
    courtyard: (cx, cy, Rc, z0) => courtProps(cx, cy, Rc, z0, 'square')
  });
  STATS.tulous.push({ name: 'Tulou_Small 庆成楼(方形土楼)', shape: 'square', outerW: 24, outerD: 20, floors: 3, wallH: 10, center: [128, 42] });

  /* ---- 公共建筑 ---- */
  buildAncestralHall(60, 55);          // 祠堂(广场西侧)
  buildVillageGate(47, 14, 'y');       // 村口(主路南北向穿过, 门楼横跨)
  buildBridge(111, 56, true, 9);       // 溪上石桥(东路)

  /* ---- 民居群 (13 栋 + 附属) ---- */
  const houses = [
    // A 组: 主路西侧
    { x: 58, y: 30, w: 6, d: 9, fl: 1, facing: 'E' },
    { x: 68, y: 26, w: 9, d: 6, fl: 2, facing: 'S' },
    { x: 80, y: 34, w: 6, d: 8, fl: 1, facing: 'W' },
    // B 组: 广场东侧(溪流西岸)
    { x: 94, y: 44, w: 6, d: 9, fl: 2, facing: 'W' },
    { x: 100, y: 52, w: 7, d: 6, fl: 1, facing: 'W' },
    { x: 92, y: 36, w: 8, d: 5, fl: 1, facing: 'S' },
    // C 组: 主楼与次级土楼之间
    { x: 70, y: 98, w: 7, d: 6, fl: 2, facing: 'SE' },
    { x: 80, y: 102, w: 6, d: 8, fl: 1, facing: 'S' },
    { x: 74, y: 112, w: 9, d: 5, fl: 1, facing: 'S' },
    // D 组: 方楼西侧
    { x: 118, y: 30, w: 6, d: 8, fl: 1, facing: 'NE' },
    { x: 127, y: 26, w: 8, d: 5, fl: 2, facing: 'N' },
    // E 组: 村口附近
    { x: 40, y: 24, w: 5, d: 8, fl: 1, facing: 'E' },
    { x: 36, y: 32, w: 8, d: 5, fl: 2, facing: 'E' }
  ];
  for (const hdef of houses) {
    const f2 = (hdef.facing === 'NE') ? 'E' : (hdef.facing === 'SE' ? 'S' : hdef.facing);
    buildHouse({ ...hdef, facing: f2 });
    STATS.houses++;
  }
  buildBarn(136, 30);                  // 谷仓
  buildCoop(140, 34);                  // 鸡舍
  // 磨坊小屋(村口)
  buildHouse({ x: 33, y: 18, w: 4, d: 5, fl: 1, facing: 'E', wallMat: M.WALL_BRICK, wins: 1 });
  buildStoneMill(38, 19, Math.round(hCol(38, 19)));

  /* ---- 农业 ---- */
  buildPaddy(54, 5, 66, 12, 10.8);     // 南部稻田组
  buildPaddy(70, 6, 84, 14, 10.6);
  buildPaddy(88, 8, 102, 16, 10.4);
  buildPaddy(60, 16, 72, 24, 10.2);
  buildPaddy(78, 18, 92, 26, 10.0);
  buildPaddy(120, 52, 134, 64, 9.6);   // 溪东稻田
  buildPaddy(122, 68, 136, 82, 10.2);
  buildPaddy(138, 54, 150, 66, 10.4);
  buildPaddy(94, 4, 104, 12, 10.3);
  buildPaddy(96, 18, 104, 26, 10.0);
  buildScarecrow(76, 10);
  buildGarden(52, 32, 57, 36);         // 菜园 ×3
  buildGarden(64, 116, 70, 121);
  buildGarden(94, 58, 99, 62);
  buildTea(132, 92, 154, 114);         // 东坡茶园
  // 梯田稻作(北坡已由地形量化, 撒稻苗)
  for (let y = 98; y < 144; y++) for (let x = 14; x < 100; x++) {
    if (isReserved(x, y)) continue;
    const z = Math.round(hCol(x, y));
    const m = getV(x, y, z);
    if (m !== M.GRASS && m !== M.SOIL && m !== M.GRASS_DRY) continue;
    if ((x + y) % 2 === 0 && hash2(x * 9, y * 5) < 0.42) { setV(x, y, z, M.DARK_SOIL); setV(x, y, z + 1, hash2(x * 3, y * 7) < 0.75 ? M.RICE : M.RICE_YOUNG); }
  }

  /* ---- 竹林 ×3 ---- */
  buildBamboo(34, 141, 8, 0.5);
  buildBamboo(120, 70, 9, 0.45);
  buildBamboo(26, 28, 9, 0.5);
  buildBamboo(33, 72, 6, 0.4);

  /* ---- 水体渲染(在稻田之后补: 保证溪流/渠/塘) ---- */
  voxelizeWaterBodies();

  /* ---- 桥(在水面之后) ---- */
  // (石桥已在 assemble 前段搭建, 此处补桥墩以下防漏水)

  /* ---- 树木 ---- */
  buildTree(101, 42, 'banyan', 1.15);      // 广场东南大榕树
  buildTree(56, 8, 'banyan', 1.0);         // 村口外侧
  buildTree(90, 33, 'fruit', 0.9);         // 塘边果树
  buildTree(116, 24, 'fruit', 1.0);
  buildTree(124, 22, 'fruit', 0.85);
  buildTree(118, 66, 'fruit', 0.9);
  buildTree(124, 78, 'fruit', 1.0);
  buildTree(66, 44, 'broadleaf', 0.9);     // 祠堂旁
  
  
  buildTree(46, 60, 'broadleaf', 0.9);
  buildTree(112, 100, 'pine', 1.1);
  buildTree(30, 78, 'pine', 1.0);
  // 山地森林
  let planted = 0;
  for (let i = 0; i < 2600 && planted < 560; i++) {
    const x = 4 + Math.floor(rand() * (W - 8)), y = 4 + Math.floor(rand() * (H - 8));
    const dx = (x - CX) / 78, dy = (y - CY) / 62;
    const rim = Math.max(Math.abs(dx), Math.abs(dy));
    const h = hCol(x, y);
    if (h < 12.5 || y < 26) continue;
    if (rim < 0.80) continue;                                   // 村内不密植
    if (Math.hypot(x - 52, y - 120) < 26) continue;             // 环兴楼周边留空
    const dens = fbm(x * 0.05 + 60, y * 0.05 + 21, 3);
    if (dens < 0.42) continue;
    if (isReserved(x, y)) continue;
    const kind = (y > 96 || x > 138) ? (rand() < 0.6 ? 'pine' : 'broadleaf') : (rand() < 0.45 ? 'pine' : 'broadleaf');
    if (buildTree(x, y, kind, 0.8 + rand() * 0.6)) planted++;
  }
  console.log('forest trees planted:', planted);

  /* ---- 散石 / 草花 ---- */
  for (let i = 0; i < 420; i++) {
    const x = 3 + Math.floor(rand() * (W - 6)), y = 3 + Math.floor(rand() * (H - 6));
    if (isReserved(x, y)) continue;
    const h = hCol(x, y);
    if (h < 10.5) continue;
    const z = Math.round(h);
    if (getV(x, y, z) === 0) continue;
    const r = rand();
    if (r < 0.55) { setV(x, y, z + 1, M.STONE); if (rand() < 0.4) setV(x + 1, y, z + 1, M.ROCK); }
    else if (r < 0.85) setV(x, y, z + 1, M.GRASS_DRY);
    else if (r < 0.93) setV(x, y, z + 1, M.FLOWER);
    else { setV(x, y, z + 1, M.MOSS); setV(x, y, z, M.MOSS); }
  }

  /* ---- 生活道具散布 ---- */
  scatterProps();

  /* ---- 村民 ---- */
  buildVillager(60, 28, 'walk', 'N');       // 主路行走
  buildVillager(111, 57, 'carry', 'E');     // 桥上挑担
  buildVillager(90, 78, 'sit', 'S');        // 主楼庭院
  buildVillager(76, 16, 'field', 'S');      // 稻田劳作
  buildVillager(93, 53, 'sit', 'W');        // 广场休憩
  buildVillager(53, 108, 'walk', 'N');      // 去次级土楼路上
}

/* 水体(在建筑之后填充, 避免被建筑覆盖) */
function voxelizeWaterBodies() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ws = waterSurf[y * W + x];
    if (ws <= 0) continue;
    const wTop = Math.round(ws);
    for (let z = 1; z <= wTop; z++) {
      if (getV(x, y, z) !== 0) continue;
      // 只填到高于地形的部分
      let below = false;
      for (let zz = z - 1; zz >= 0; zz--) { if (getV(x, y, zz) !== 0 && !isWaterMat(getV(x, y, zz))) { below = true; break; } }
      if (!below) continue;
      const above = getV(x, y, z + 1);
      if (above !== 0 && !isWaterMat(above)) continue;      // 上方被建筑占据 → 不填(桥洞等)
      setV(x, y, z, isPaddy(x, y) && z > 10 ? M.PADDY_WATER : M.WATER);
    }
  }
  // 溪流急滩泡沫
  const sp = resample(STREAM, 1.0);
  for (let i = 1; i < sp.length; i++) {
    const [x0, y0] = sp[i - 1], [x1, y1] = sp[i];
    const ws0 = waterSurf[Math.round(y0) * W + Math.round(x0)], ws1 = waterSurf[Math.round(y1) * W + Math.round(x1)];
    if (ws1 - ws0 > 0.5) {
      const wx = Math.round(x1), wy = Math.round(y1);
      const wz = Math.round(waterSurf[wy * W + wx]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (isWaterMat(getV(wx + dx, wy + dy, wz))) setV(wx + dx, wy + dy, wz, M.FOAM);
      }
    }
  }
}

function scatterProps() {
  const zAt = (x, y) => Math.round(hCol(clamp(x, 0, W - 1), clamp(y, 0, H - 1)));
  // 广场
  buildGrainMat(82, 45, zAt(82, 45)); buildGrainMat(95, 47, zAt(95, 47));
  buildDryingRack(79, 55, zAt(79, 55), 1);
  buildJar(97, 43, zAt(97, 43)); buildJar(98, 44, zAt(98, 44));
  // 主楼周边
  buildFirewood(70, 68, zAt(70, 68)); buildFirewood(104, 80, zAt(104, 80));
  buildJar(71, 88, zAt(71, 88));
  buildFence(63, 90, 68, 90, true);
  // 民居周边
  buildFirewood(56, 26, zAt(56, 26)); buildJar(62, 34, zAt(62, 34));
  buildFirewood(96, 40, zAt(96, 40)); buildJar(90, 47, zAt(90, 47));
  buildFirewood(122, 34, zAt(122, 34)); buildJar(114, 32, zAt(114, 32));
  buildFirewood(42, 28, zAt(42, 28)); buildJar(37, 27, zAt(37, 27));
  buildFirewood(72, 106, zAt(72, 106)); buildJar(78, 108, zAt(78, 108));
  // 柴垛+梯子
  const lz = zAt(84, 100);
  for (let k = 0; k < 4; k++) { setV(84, 100, lz + 1 + k, M.WOOD_LIGHT); setV(85, 100, lz + 1 + k, k % 2 ? M.WOOD_MID : M.WOOD_LIGHT); }
  // 鸡群
  buildHen(122, 33); buildHen(124, 35); buildHen(121, 36);
  // 鸭
  buildDuck(112, 90); buildDuck(85, 30); buildDuck(87, 31);
  // 石凳
  buildStoneTable(86, 47, zAt(86, 47));
  STATS.props = 30;
}

/* ============================================================
 * 渲染 RENDERER — 正交等轴 DDA 光线投射
 * ============================================================ */
let hTop;              // 每列最高实心z
let sunVis;            // 日照可见性
const SUN = { az: 225, el: 44 };   // 太阳方位/高度(西南方向, 上午侧光)
function sunDir() {
  const a = SUN.az * Math.PI / 180, e = SUN.el * Math.PI / 180;
  return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
}
function buildHTop() {
  hTop = new Int16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = 0;
    for (let z = D - 1; z >= 0; z--) { if (vox[z * ZSTR + y * W + x] !== 0) { t = z; break; } }
    hTop[y * W + x] = t;
  }
}
/* 日照可见性扫描: 按沿日方向深度递减处理 + memo */
function buildSunVis() {
  const [sx, sy, sz] = sunDir();
  sunVis = new Uint8Array(W * H * D).fill(255);
  // 计数排序(降序 s)
  const N = W * H * D;
  const key = new Float32Array(N);
  let kmin = Infinity, kmax = -Infinity;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) {
    const row = z * ZSTR + y * W;
    for (let x = 0; x < W; x++) {
      const s = x * sx + y * sy + z * sz;
      key[row + x] = s;
      if (s < kmin) kmin = s; if (s > kmax) kmax = s;
    }
  }
  const NB = 4096;
  const buckets = new Int32Array(NB + 2);
  const scale = (NB - 1) / (kmax - kmin + 1e-9);
  const bidx = new Int32Array(N);
  for (let i = 0; i < N; i++) { const b = ((key[i] - kmin) * scale) | 0; bidx[i] = b; buckets[b + 1]++; }
  for (let b = 0; b < NB; b++) buckets[b + 1] += buckets[b];
  const order = new Int32Array(N);
  const cursor = buckets.slice(0, NB);
  for (let i = 0; i < N; i++) order[cursor[bidx[i]]++] = i;
  // 降序处理
  for (let bi = NB - 1; bi >= 0; bi--) {
    const st = buckets[bi], en = (bi === NB - 1) ? N : buckets[bi + 1];
    for (let oi = st; oi < en; oi++) {
      const c = order[oi];
      if (vox[c] !== 0) { sunVis[c] = 0; continue; }
      // 向日方向步进
      const z = (c / ZSTR) | 0, rem = c - z * ZSTR, y = (rem / W) | 0, x = rem - y * W;
      sunVis[c] = marchSun(x, y, z, sx, sy, sz);
    }
  }
  function marchSun(x0, y0, z0, sx, sy, sz) {
    let px = x0 + 0.5, py = y0 + 0.5, pz = z0 + 0.5;
    let X = x0, Y = y0, Z = z0;
    const stX = sx > 0 ? 1 : -1, stY = sy > 0 ? 1 : -1, stZ = sz > 0 ? 1 : -1;
    const adx = Math.abs(sx), ady = Math.abs(sy), adz = Math.abs(sz);
    const tDX = 1 / adx, tDY = 1 / ady, tDZ = 1 / adz;
    let tMX = ((stX > 0 ? X + 1 - px : px - X)) * tDX;
    let tMY = ((stY > 0 ? Y + 1 - py : py - Y)) * tDY;
    let tMZ = ((stZ > 0 ? Z + 1 - pz : pz - Z)) * tDZ;
    for (let iter = 0; iter < 640; iter++) {
      let axis;
      if (tMX < tMY && tMX < tMZ) { X += stX; tMX += tDX; axis = 0; }
      else if (tMY < tMZ) { Y += stY; tMY += tDY; axis = 1; }
      else { Z += stZ; tMZ += tDZ; axis = 2; }
      if (X < 0 || Y < 0 || Z < 0 || X >= W || Y >= H || Z >= D) return 1;
      const c = Z * ZSTR + Y * W + X;
      if (sunVis[c] !== 255) return sunVis[c];
      if (vox[c] !== 0) return 0;
    }
    return 1;
  }
}

/* 颜色变化(材质特异性) */
function baseColor(m, x, y, z, out) {
  const p = PAL[m];
  let r = p.c[0], g = p.c[1], b = p.c[2];
  const v = p.v * (hash3(x, y, z) - 0.5);
  r += v; g += v; b += v;
  if (m === M.WALL_EARTH_A || m === M.WALL_EARTH_B || m === M.WALL_EARTH_C || m === M.EARTH || m === M.EARTH_DEEP) {
    // 夯土层理
    const band = Math.sin((z + vnoise(x * 0.3, y * 0.3) * 2.4) * 1.7);
    const s = 1 + band * 0.045;
    r *= s; g *= s; b *= s;
    // 风化斑
    const w = fbm(x * 0.07, y * 0.07, 2);
    if (w > 0.60) { const k = (w - 0.60) * 1.6; r *= 1 - 0.16 * k; g *= 1 - 0.10 * k; b *= 1 - 0.02 * k; }
    // 底部青苔
    if (z < 11 && fbm(x * 0.13 + 31, y * 0.13 + 17, 2) > 0.62) { r = lerp(r, 0.36, 0.5); g = lerp(g, 0.44, 0.5); b = lerp(b, 0.26, 0.5); }
  } else if (m === M.ROOF_TILE || m === M.ROOF_TILE_OLD) {
    const h = hash3(x, y, z);
    if (h > 0.94) { r *= 0.84; g *= 0.84; b *= 0.86; }                 // 缺瓦(轻微)
    else if (fbm(x * 0.09 + 5, y * 0.09 + 55, 2) > 0.68) { r = lerp(r, 0.34, 0.45); g = lerp(g, 0.40, 0.45); b = lerp(b, 0.26, 0.45); } // 青苔
    const row = Math.sin(y * 2.1 + x * 0.8) * 0.02; r += row; g += row; b += row;
  } else if (m === M.GRASS) {
    const w = fbm(x * 0.05 + 9, y * 0.05 + 44, 2);
    if (w > 0.62) { const k = Math.min(1, (w - 0.62) * 3); r = lerp(r, PAL[M.GRASS_DRY].c[0], k * 0.7); g = lerp(g, PAL[M.GRASS_DRY].c[1], k * 0.7); b = lerp(b, PAL[M.GRASS_DRY].c[2], k * 0.7); }
  } else if (m === M.PATH_STONE) {
    if (hash2(x * 3 + 1, y * 3 + 5) < 0.18) { r = PAL[M.PATH_DIRT].c[0]; g = PAL[M.PATH_DIRT].c[1]; b = PAL[M.PATH_DIRT].c[2]; }
  } else if (m === M.STONE) {
    if (hash3(x, y, z) < 0.14) { r *= 0.88; g *= 0.88; b *= 0.9; }
  }
  out[0] = clamp(r, 0, 4); out[1] = clamp(g, 0, 4); out[2] = clamp(b, 0, 4);
}

/* 渲染一个视图 */
function renderView(view) {
  const { name, tx, ty, tz, phi, el, halfW, resW, resH, ss } = view;
  const a = phi * Math.PI / 180, e = el * Math.PI / 180;
  const dx = -Math.cos(a) * Math.cos(e), dy = -Math.sin(a) * Math.cos(e), dz = -Math.sin(e);
  // right = normalize(cross(d, up))
  let rx = dy, ry = -dx, rz = 0;
  const rl = Math.hypot(rx, ry); rx /= rl; ry /= rl;
  // up2 = cross(right, d)
  const ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx;
  const halfH = halfW * resH / resW;
  const cw = resW * ss, ch = resH * ss;
  const img = new Float32Array(cw * ch * 3);
  const far = (W + H + D) * 1.5;
  const sun = sunDir();
  const tang = [Math.round(sun[1]) || 1, -Math.round(sun[0]) || 1, 0];
  const col = [0, 0, 0];
  const sunC = [1.06, 0.97, 0.82];         // 暖阳
  const skyZen = [0.52, 0.60, 0.68];       // 天光
  const skyHor = [0.72, 0.72, 0.68];       // 地平环境
  const gnd = [0.30, 0.26, 0.20];          // 地面反弹
  console.time('render ' + name);
  for (let py = 0; py < ch; py++) {
    const vv = (ch / 2 - py) / ch * 2 * halfH;
    for (let px = 0; px < cw; px++) {
      const uu = (px - cw / 2) / cw * 2 * halfW;
      let ox = tx + rx * uu + ux * vv - dx * far;
      let oy = ty + ry * uu + uy * vv - dy * far;
      let oz = tz + rz * uu + uz * vv - dz * far;
      // slab clip [0,W]x[0,H]x[0,D]
      let t0 = 0, t1 = 2 * far;
      {
        const b0 = [0 - ox, 0 - oy, 0 - oz], b1 = [W - ox, H - oy, D - oz];
        const dd = [dx, dy, dz];
        for (let i = 0; i < 3; i++) {
          const d = dd[i];
          if (Math.abs(d) < 1e-9) { if (b0[i] > 0 || b1[i] < 0) { t0 = 1e9; } continue; }
          let ta = b0[i] / d, tb = b1[i] / d;
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
        }
      }
      let r = 0, g = 0, b = 0;
      if (t0 < t1) {
        let t = t0 + 1e-4;
        ox += dx * t; oy += dy * t; oz += dz * t;
        let X = Math.floor(ox), Y = Math.floor(oy), Z = Math.floor(oz);
        const stX = dx > 0 ? 1 : -1, stY = dy > 0 ? 1 : -1, stZ = dz > 0 ? 1 : -1;
        const tDX = Math.abs(1 / dx), tDY = Math.abs(1 / dy), tDZ = Math.abs(1 / dz);
        let tMX = (stX > 0 ? X + 1 - ox : ox - X) * tDX;
        let tMY = (stY > 0 ? Y + 1 - oy : oy - Y) * tDY;
        let tMZ = (stZ > 0 ? Z + 1 - oz : oz - Z) * tDZ;
        let axis = -1, hit = 0, hitT = 0;
        const maxT = t1 - t0;
        for (let iter = 0; iter < 1024; iter++) {
          if (X < 0 || Y < 0 || Z < 0 || X >= W || Y >= H || Z >= D) break;
          const m = vox[Z * ZSTR + Y * W + X];
          if (m !== 0) { hit = m; hitT = t; break; }
          // 高度图快进(仅下行动且仍在地形上空; 沿射线路径逐列校验防穿透)
          if (dz < 0 && Z > hTop[Y * W + X]) {
            const skipZ = hTop[Y * W + X] + 0.5;
            const tsk = (oz - skipZ) / (-dz);
            if (tsk > 1 && tsk < 26) {
              const nx2 = ox + dx * tsk, ny2 = oy + dy * tsk;
              const nX = Math.floor(nx2), nY = Math.floor(ny2);
              if (nX >= 0 && nY >= 0 && nX < W && nY < H) {
                let safe = true;
                const hSteps = Math.max(1, Math.ceil(tsk * Math.max(Math.abs(dx), Math.abs(dy))));
                for (let hs = 1; hs <= hSteps; hs++) {
                  const ft = tsk * hs / hSteps;
                  const sz2 = oz + dz * ft;
                  const cX = Math.floor(ox + dx * ft), cY = Math.floor(oy + dy * ft);
                  if (cX < 0 || cY < 0 || cX >= W || cY >= H) { safe = false; break; }
                  if (hTop[cY * W + cX] > sz2 - 0.4) { safe = false; break; }
                }
                if (safe) {
                  t += tsk - 1e-4;
                  ox = nx2; oy = ny2; oz = oz + dz * tsk;
                  X = nX; Y = nY; Z = Math.floor(oz);
                  tMX = (stX > 0 ? X + 1 - ox : ox - X) * tDX;
                  tMY = (stY > 0 ? Y + 1 - oy : oy - Y) * tDY;
                  tMZ = (stZ > 0 ? Z + 1 - oz : oz - Z) * tDZ;
                  continue;
                }
              }
            }
          }
          if (tMX < tMY && tMX < tMZ) { X += stX; t = tMX; tMX += tDX; axis = 0; }
          else if (tMY < tMZ) { Y += stY; t = tMY; tMY += tDY; axis = 1; }
          else { Z += stZ; t = tMZ; tMZ += tDZ; axis = 2; }
          if (t > maxT) break;
        }
        if (hit) {
          shade(hit, X, Y, Z, axis, dx, dy, dz, sun, tang, col, sunC, skyZen, skyHor, gnd);
          r = col[0]; g = col[1]; b = col[2];
        } else {
          // 天空(按屏幕高度渐变)
          const k = clamp((vv / halfH + 1) / 2, 0, 1);
          const hk = clamp((vv / halfH + 1.4) / 2.4, 0, 1);
          r = lerp(0.845, 0.60, hk) + 0.012 * hash2(px, py);
          g = lerp(0.852, 0.70, hk) + 0.012 * hash2(px + 7, py);
          b = lerp(0.845, 0.79, hk) + 0.012 * hash2(px, py + 3);
        }
      } else {
        const hk = clamp((vv / halfH + 1.4) / 2.4, 0, 1);
        r = lerp(0.845, 0.60, hk); g = lerp(0.852, 0.70, hk); b = lerp(0.845, 0.79, hk);
      }
      const o = (py * cw + px) * 3;
      img[o] = r; img[o + 1] = g; img[o + 2] = b;
    }
  }
  console.timeEnd('render ' + name);
  // SSAA 降采样
  const ow = resW, oh = resH;
  const out = new Float32Array(ow * oh * 3);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const o = ((y * ss + sy) * cw + x * ss + sx) * 3;
      r += img[o]; g += img[o + 1]; b += img[o + 2];
    }
    const n = ss * ss, o = (y * ow + x) * 3;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  // 后期: 曝光/对比/暗角(调色板按 sRGB 直出, 不再做二次γ, 避免整体发灰)
  if (!FLAT_DEBUG) {
    for (let i = 0; i < ow * oh; i++) {
      const x = i % ow, y = (i / ow) | 0;
      const nx = x / ow - 0.5, ny = y / oh - 0.5;
      const vig = 1 - 0.14 * Math.pow(nx * nx + ny * ny, 1.2) * 2.2;
      for (let k = 0; k < 3; k++) {
        let c = out[i * 3 + k] * 1.05 * vig;
        c = c / (1 + 0.10 * c);                        // Reinhard 压高光
        c = clamp(c, 0, 1);
        c = c * c * (3 - 2 * c) * 0.30 + c * 0.70;     // S曲线加对比
        out[i * 3 + k] = c;
      }
    }
  }
  // 小鸟
  drawBirds(out, ow, oh, view.birds || []);
  // 输出 PNG
  const buf = Buffer.alloc(ow * oh * 3);
  for (let i = 0; i < ow * oh * 3; i++) buf[i] = clamp(Math.round(out[i] * 255), 0, 255);
  const file = path.join(DIR, name);
  writePNG(file, ow, oh, buf);
  console.log('saved', file);
}

function shade(m, X, Y, Z, axis, dx, dy, dz, sun, tang, out, sunC, skyZen, skyHor, gnd) {
  baseColor(m, X, Y, Z, out);
  if (FLAT_DEBUG) {   // 调试: 纯材质色 + 面向微差
    let nx = 0, ny = 0, nz = 0;
    if (axis === 0) nx = -Math.sign(dx); else if (axis === 1) ny = -Math.sign(dy); else nz = -Math.sign(dz);
    const k = nz > 0 ? 1 : (nx + ny !== 0 ? 0.8 : 0.6);
    out[0] *= k; out[1] *= k; out[2] *= k; return;
  }
  let r = out[0], g = out[1], b = out[2];
  const p = PAL[m];
  // 法线
  let nx = 0, ny = 0, nz = 0;
  if (axis === 0) nx = -Math.sign(dx); else if (axis === 1) ny = -Math.sign(dy); else nz = -Math.sign(dz);
  if (p.kind === 2) {           // 自发光
    out[0] = r * 1.25; out[1] = g * 1.15; out[2] = b * 1.05; return;
  }
  if (p.kind === 1) {           // 水
    const deep = isDeepWater(X, Y, Z);
    const ref = [0.55, 0.63, 0.67];
    const wm = m === M.PADDY_WATER ? 0.74 : 0.58;
    let rr = lerp(ref[0], r, wm), gg = lerp(ref[1], g, wm), bb = lerp(ref[2], b, wm);
    const sp = (m === M.WATER) ? Math.pow(clamp(nz * 0.9 + 0.35 - Math.abs(sun[0] + dx) * 0.5, 0, 1), 20) : 0;
    const glint = sp * 0.55 * (0.6 + 0.4 * hash3(X, Y, Z));
    rr += glint; gg += glint * 0.96; bb += glint * 0.9;
    const s = sunVis[Z * ZSTR + Y * W + X] !== undefined ? sunVis[Z * ZSTR + Y * W + X] : 1;
    const sh = 0.55 + 0.45 * s;
    out[0] = rr * sh; out[1] = gg * sh; out[2] = bb * sh; return;
  }
  // 日照
  const c = Z * ZSTR + Y * W + X;
  let s = 1;
  if (sunVis) {
    const ax = X + nx, ay = Y + ny, az = Z + nz;
    if (ax >= 0 && ay >= 0 && az >= 0 && ax < W && ay < H && az < D) {
      const c0 = az * ZSTR + ay * W + ax;
      const c1 = az * ZSTR + clamp(ay + tang[1], 0, H - 1) * W + clamp(ax + tang[0], 0, W - 1);
      const c2 = az * ZSTR + clamp(ay - tang[1], 0, H - 1) * W + clamp(ax - tang[0], 0, W - 1);
      s = (sunVis[c0] + sunVis[c1] + sunVis[c2]) / 3;
    }
  }
  const diff = Math.max(nx * sun[0] + ny * sun[1] + nz * sun[2], 0);
  // 环境(半球)
  let ar, ag, ab;
  if (nz > 0.5) { ar = skyZen[0] * 0.74; ag = skyZen[1] * 0.74; ab = skyZen[2] * 0.74; }
  else if (nz < -0.5) { ar = gnd[0]; ag = gnd[1]; ab = gnd[2]; }
  else {
    const side = (nx * sun[0] + ny * sun[1]) * 0.5 + 0.5;
    ar = lerp(skyHor[0] * 0.54, skyZen[0] * 0.66, side);
    ag = lerp(skyHor[1] * 0.54, skyZen[1] * 0.66, side);
    ab = lerp(skyHor[2] * 0.54, skyZen[2] * 0.66, side);
  }
  // AO (角点)
  const ao = cornerAO(X, Y, Z, nx, ny, nz);
  const lit = 1 - (1 - s) * 0.72;
  const lr = sunC[0] * diff * lit, lg = sunC[1] * diff * lit, lb = sunC[2] * diff * lit;
  r = r * (lr + ar * ao);
  g = g * (lg + ag * ao);
  b = b * (lb + ab * ao);
  // 距离雾(空气透视, 极轻)
  const dist = Math.abs((X + Y + Z) - (88 + 64 + 10));
  const fog = clamp((dist - 130) / 420, 0, 0.16);
  if (fog > 0) { r = lerp(r, 0.72, fog); g = lerp(g, 0.74, fog); b = lerp(b, 0.76, fog); }
  out[0] = r; out[1] = g; out[2] = b;
}
function isDeepWater(x, y, z) { return false; }
function cornerAO(X, Y, Z, nx, ny, nz) {
  const ax = X + nx, ay = Y + ny, az = Z + nz;
  let u0, v0, u1, v1;   // 两个切向单位向量(整数)
  if (nx !== 0) { u0 = 0; v0 = 1; u1 = 0; v1 = 0; return aoGen(ax, ay, az, 0, 1, 0, 0, 0, 1); }
  if (ny !== 0) { return aoGen(ax, ay, az, 1, 0, 0, 0, 0, 1); }
  return aoGen(ax, ay, az, 1, 0, 0, 0, 1, 0);
}
function aoGen(ax, ay, az, ux, uy, uz, vx, vy, vz) {
  let occ = 0;
  const s = (x, y, z) => { const m = getV(x, y, z); return (m !== 0 && !isWaterMat(m)) ? 1 : 0; };
  let sum = 0;
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const s1 = s(ax + ux * su, ay + uy * su, az + uz * su);
    const s2 = s(ax + vx * sv, ay + vy * sv, az + vz * sv);
    const sc = s(ax + ux * su + vx * sv, ay + uy * su + vy * sv, az + uz * su + vz * sv);
    const o = (s1 && s2) ? 1 : (s1 + s2 + sc) * 0.55;
    sum += 1 - o * 0.24;
  }
  return clamp(sum / 4, 0.50, 1);
}
function drawBirds(img, w, h, birds) {
  for (const [bx, by] of birds) {
    const x0 = Math.round(bx * w), y0 = Math.round(by * h);
    for (let k = -2; k <= 2; k++) {
      const yy = y0 + Math.abs(k) - 1;
      if (yy < 0 || yy >= h) continue;
      const o = (yy * w + clamp(x0 + k, 0, w - 1)) * 3;
      img[o] = img[o] * 0.4 + 0.06; img[o + 1] = img[o + 1] * 0.4 + 0.06; img[o + 2] = img[o + 2] * 0.4 + 0.08;
    }
  }
}

/* ---------------- PNG 写出 ---------------- */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) { raw[o++] = 0; rgb.copy(raw, o, y * w * 3, (y + 1) * w * 3); o += w * 3; }
  const idat = zlib.deflateSync(raw, { level: 6 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

/* ---------------- VOX 导出 ---------------- */
function writeVox(file) {
  const cells = [];
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = vox[z * ZSTR + y * W + x];
    if (m !== 0) cells.push(x, y, z, (m % 255) + 1);
  }
  const n = cells.length / 4;
  const xyzi = Buffer.alloc(4 + n * 4);
  xyzi.writeInt32LE(n, 0);
  for (let i = 0; i < n; i++) {
    xyzi[4 + i * 4] = cells[i * 4]; xyzi[5 + i * 4] = cells[i * 4 + 1]; xyzi[6 + i * 4] = cells[i * 4 + 2]; xyzi[7 + i * 4] = cells[i * 4 + 3];
  }
  const size = Buffer.alloc(12);
  size.writeInt32LE(W, 0); size.writeInt32LE(H, 4); size.writeInt32LE(D, 8);
  const rgba = Buffer.alloc(1024);
  for (let m = 1; m <= 255; m++) {
    const p = PAL[m - 1] || { c: [0.5, 0.5, 0.5] };
    rgba[m * 4] = Math.round(p.c[0] * 255); rgba[m * 4 + 1] = Math.round(p.c[1] * 255); rgba[m * 4 + 2] = Math.round(p.c[2] * 255); rgba[m * 4 + 3] = 255;
  }
  const pack = Buffer.alloc(4); pack.writeInt32LE(1);
  const mainKids = Buffer.concat([chunk('SIZE', size), chunk('XYZI', xyzi), chunk('RGBA', rgba)]);
  const mainBody = Buffer.concat([chunk('PACK', pack), mainKids]);
  const out = Buffer.concat([Buffer.from('VOX ', 'ascii'), Buffer.from([150, 0, 0, 0]), chunk('MAIN', mainBody)]);
  fs.writeFileSync(file, out);
  console.log('saved', file, 'voxels:', n);
}

/* ---------------- 主流程 ---------------- */
const t0 = Date.now();
console.log('building scene...');
assemble();
console.log('scene built in', ((Date.now() - t0) / 1000).toFixed(1), 's');

/* 调试模式: --slice 导出主土楼区域水平切片 */
if (process.argv.includes('--slice')) {
  const matColor = (m) => {
    const p = PAL[m] || { c: [1, 0, 1] };
    return [Math.round(p.c[0] * 255), Math.round(p.c[1] * 255), Math.round(p.c[2] * 255)];
  };
  for (const z of [20, 21, 22, 23, 24, 25, 26]) {
    const buf = Buffer.alloc(70 * 70 * 3);
    for (let y = 0; y < 70; y++) for (let x = 0; x < 70; x++) {
      const wx = 60 + x, wy = 45 + y;
      const m = getV(wx, wy, z);
      const [r, g, b] = m === 0 ? [24, 24, 30] : matColor(m);
      const o = (y * 70 + x) * 3;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
    }
    writePNG(path.join(DIR, `debug_slice_z${z}.png`), 70, 70, buf);
  }
  console.log('debug slices written');
  process.exit(0);
}
buildHTop();
console.time('sunvis'); buildSunVis(); console.timeEnd('sunvis');

const VIEWS = [
  { name: 'render_01_main_view.png', tx: 74, ty: 76, tz: 12, phi: 207, el: 31, halfW: 80, resW: 1680, resH: 1260, ss: 2, birds: [[0.18, 0.16], [0.23, 0.20], [0.84, 0.12]] },
  { name: 'render_02_full_diorama.png', tx: 85, ty: 72, tz: 9, phi: 207, el: 38, halfW: 110, resW: 1680, resH: 1260, ss: 2, birds: [[0.15, 0.14], [0.80, 0.10]] },
  { name: 'render_03_tulou_detail.png', tx: 88, ty: 76, tz: 14, phi: 197, el: 55, halfW: 24, resW: 1600, resH: 1200, ss: 2, birds: [] },
  { name: 'render_04_village_relations.png', tx: 80, ty: 78, tz: 13, phi: 232, el: 34, halfW: 80, resW: 1680, resH: 1260, ss: 2, birds: [[0.75, 0.15]] }
];
if (FLAT_DEBUG) { FLAT_DEBUG=false; renderView({ name: 'debug_lit_tulou.png', tx: 88, ty: 76, tz: 15, phi: 197, el: 50, halfW: 26, resW: 1200, resH: 900, ss: 1, birds: [] }); process.exit(0); }
for (const v of VIEWS) renderView(v);

writeVox(path.join(DIR, 'hakka_village.vox'));

/* ---------------- 交互查看器 viewer.html ---------------- */
function writeViewer(file) {
  // 只导出暴露体素(至少一面邻空), 4字节/体素: x,y,z,mat
  const cells = [];
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = vox[z * ZSTR + y * W + x];
    if (m === 0) continue;
    if (getV(x + 1, y, z) && getV(x - 1, y, z) && getV(x, y + 1, z) && getV(x, y - 1, z) && getV(x, y, z + 1) && getV(x, y, z - 1)) continue;
    cells.push(x, y, z, m);
  }
  const raw = Buffer.alloc(cells.length);
  for (let i = 0; i < cells.length; i++) raw[i] = cells[i];
  const b64 = raw.toString('base64');
  const palJS = PAL.map(p => p ? [Math.round(p.c[0] * 255), Math.round(p.c[1] * 255), Math.round(p.c[2] * 255)] : [255, 0, 255]);
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>客家土楼村落 · Hakka Tulou Village — Voxel Diorama</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#0e1116;font-family:system-ui,sans-serif}
  #c{width:100%;height:100%;display:block}
  #hud{position:fixed;left:14px;top:14px;color:#dfe6ee;background:rgba(10,14,20,.55);padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.55;pointer-events:none}
  #hud b{font-size:15px}
  #btns{position:fixed;left:14px;bottom:14px;display:flex;gap:8px;flex-wrap:wrap}
  #btns button{background:rgba(20,28,38,.8);color:#dfe6ee;border:1px solid #3a4a5c;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer}
  #btns button:hover{background:#2a3a4c}
</style>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
</head>
<body>
<div id="hud"><b>大型客家土楼村落 · Hakka Tulou Village</b><br>
体素场景 ${W}×${H}×${D} · 暴露体素 ${cells.length / 4}<br>左键旋转 / 滚轮缩放</div>
<div id="btns">
  <button data-v="0">主视图</button><button data-v="1">全景</button>
  <button data-v="2">土楼细节</button><button data-v="3">村落关系</button>
</div>
<canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
const DATA = "${b64}";
const PAL = ${JSON.stringify(palJS)};
const W=${W},H=${H},D=${D};
const bin = Uint8Array.from(atob(DATA), c => c.charCodeAt(0));
const n = bin.length / 4;
const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshLambertMaterial();
const mesh = new THREE.InstancedMesh(geo, mat, n);
mesh.castShadow = true; mesh.receiveShadow = true;
const dummy = new THREE.Object3D();
const color = new THREE.Color();
for (let i = 0; i < n; i++) {
  const x = bin[i*4], y = bin[i*4+1], z = bin[i*4+2], m = bin[i*4+3];
  dummy.position.set(x - W/2 + .5, z + .5, y - H/2 + .5);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  const c = PAL[m] || [200,60,200];
  color.setRGB(c[0]/255, c[1]/255, c[2]/255);
  mesh.setColorAt(i, color);
}
mesh.instanceMatrix.needsUpdate = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd0da);
scene.fog = new THREE.Fog(0xbfd0da, 260, 460);
scene.add(mesh);
const base = new THREE.Mesh(new THREE.BoxGeometry(W+2, 4, H+2), new THREE.MeshLambertMaterial({color:0x4a3f33}));
base.position.set(0, -2.01, 0); base.receiveShadow = true;
scene.add(base);
const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x8a7a60, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 1.9);
sun.position.set(-70, 90, -40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left=-130; sc.right=130; sc.top=130; sc.bottom=-130; sc.near=10; sc.far=320;
scene.add(sun); scene.add(sun.target);
const VIEWS = [
  {phi:207, el:31, zoom:2.1, tx:84-W/2, tz:12, ty:72-H/2},
  {phi:207, el:38, zoom:1.32, tx:85-W/2, tz:9, ty:72-H/2},
  {phi:197, el:55, zoom:6.2, tx:88-W/2, tz:14, ty:76-H/2},
  {phi:232, el:34, zoom:2.35, tx:80-W/2, tz:13, ty:78-H/2}
];
let cur = VIEWS[0], az = cur.phi, elv = cur.el;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const camera = new THREE.OrthographicCamera(-1,1,1,-1,1,1600);
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h); renderer.setPixelRatio(devicePixelRatio);
  const a=w/h; const hw=90/cur.zoom; camera.left=-hw*a; camera.right=hw*a; camera.top=hw; camera.bottom=-hw; camera.near=1; camera.far=1600; camera.updateProjectionMatrix(); }
function applyCam(){
  const a=az*Math.PI/180, e=elv*Math.PI/180, R=330;
  camera.position.set(cur.tx+R*Math.cos(a)*Math.cos(e), cur.tz+R*Math.sin(e), cur.ty+R*Math.sin(a)*Math.cos(e));
  camera.lookAt(cur.tx, cur.tz, cur.ty);
}
function loop(){ requestAnimationFrame(loop); applyCam(); renderer.render(scene,camera); }
addEventListener('resize', resize); resize(); loop();
let drag=null,btn=0;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};btn=e.button;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',e=>{drag=null;});
addEventListener('pointermove',e=>{ if(!drag)return;
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag={x:e.clientX,y:e.clientY};
  if(btn!==2){ az-=dx*0.4; elv=Math.min(85,Math.max(5,elv+dy*0.3)); }
});
addEventListener('wheel',e=>{ cur.zoom*= (e.deltaY>0?0.9:1.1); cur.zoom=Math.min(14,Math.max(0.6,cur.zoom)); resize(); },{passive:true});
document.querySelectorAll('#btns button').forEach(b=>b.onclick=()=>{
  cur=VIEWS[+b.dataset.v]; az=cur.phi; elv=cur.el; resize();
});
</script>
</body>
</html>`;
  fs.writeFileSync(file, html);
  console.log('saved', file, 'exposed voxels:', cells.length / 4);
}
writeViewer(path.join(DIR, 'viewer.html'));

// 统计
let total = 0; const byGroup = { terrain: 0, building: 0, vegetation: 0, water: 0, other: 0 };
for (let i = 0; i < vox.length; i++) {
  const m = vox[i]; if (!m) continue; total++;
  if (isWaterMat(m)) byGroup.water++;
  else if ([M.GRASS, M.GRASS_DRY, M.SOIL, M.DARK_SOIL, M.EARTH, M.EARTH_DEEP, M.ROCK, M.STONE, M.PATH_STONE, M.PATH_DIRT].includes(m)) byGroup.terrain++;
  else if ([M.LEAF_DARK, M.LEAF_MID, M.LEAF_LIGHT, M.LEAF_PINE, M.LEAF_FRUIT, M.BAMBOO, M.BAMBOO_NODE, M.BAMBOO_LEAF, M.RICE, M.RICE_YOUNG, M.TEA, M.VEG_GREEN, M.VEG_LEAF, M.VEG_ORANGE].includes(m)) byGroup.vegetation++;
  else if ([M.WOOD_DARK, M.WOOD_MID, M.WOOD_LIGHT, M.ROOF_TILE, M.ROOF_TILE_OLD, M.ROOF_RIDGE, M.ROOF_MOSS, M.WALL_EARTH_A, M.WALL_EARTH_B, M.WALL_EARTH_C, M.WALL_BRICK, M.PLASTER].includes(m)) byGroup.building++;
  else byGroup.other++;
}
STATS.totalVoxels = total; STATS.byGroup = byGroup;
STATS.sceneSize = [W, H, D];
STATS.camera = VIEWS.map(v => ({ view: v.name, target: [v.tx, v.ty, v.tz], azimuthDeg: v.phi, elevationDeg: v.el, orthoHalfWidth: v.halfW }));
STATS.lighting = { sunAzimuthDeg: SUN.az, sunElevationDeg: SUN.el, sunColor: [1.06, 0.97, 0.82], skyAmbient: 'hemisphere', shadows: 'raycast sun-visibility + 3-tap soft' };
fs.writeFileSync(path.join(DIR, 'scene_stats.json'), JSON.stringify(STATS, null, 2));
console.log('DONE in', ((Date.now() - t0) / 1000).toFixed(1), 's');
