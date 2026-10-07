'use strict';
/* ============================================================
 * voxel_core.js — 体素网格容器、确定性随机、值噪声、调色板
 * 场景:客家土楼体素景观 (Voxel Art Hakka Tulou Diorama)
 * ============================================================ */

/* ---------- 确定性随机 ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 整数坐标哈希 → [0,1)，保证同一坐标每次构建结果一致 */
function hash3(x, y, z) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const hash2 = (x, y) => hash3(x | 0, y | 0, 1013904223);

/* ---------- 值噪声（用于地形起伏与风化斑块） ---------- */
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = x - xi, ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, oct = 3) {
  let s = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += valueNoise(x * f, y * f) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ---------- 调色板：低饱和东方乡土色 ----------
 * 每种材质是 2~5 个近似色的离散集合，按体素坐标哈希取色，
 * 形成手工堆叠般的颗粒变化（不使用连续染色，保证 .vox 调色板无损） */
const PALETTE_DEF = {
  /* 夯土墙（暖黄/土褐/灰棕 + 风化深色） */
  earth:      ['#cfa76f', '#c39c64', '#b38c58', '#a67e4e', '#987450'],
  earthStain: ['#8a6742', '#7c5c3c', '#93724c'],
  earthBase:  ['#9c7a4e', '#8e6d46', '#93724c'],
  earthDark:  ['#8a6a46', '#7d5f3e'],
  /* 木材（深棕） */
  wood:       ['#7a5433', '#6d4a2c', '#85603b'],
  woodDark:   ['#573b22', '#4c3320'],
  plank:      ['#8a6539', '#7c5a33', '#93703f'],
  door:       ['#5a3d26', '#4e351f'],
  /* 屋顶瓦（灰黑/深灰 + 青苔/风化） */
  tile:       ['#4a4f58', '#40454d', '#545860', '#3a3e45'],
  tileMoss:   ['#5c6b52', '#51604a'],
  ridge:      ['#33363d', '#2e3138', '#3a3d44'],
  fascia:     ['#5f4327', '#54391f'],
  /* 石材（灰/灰白） */
  stone:      ['#9b978c', '#8f8b80', '#a7a399'],
  stoneDark:  ['#736f66', '#67635b'],
  stoneLight: ['#b4b0a6', '#aaa69b'],
  /* 地面（灰褐道路 / 泥土 / 庭院） */
  path:       ['#a08a68', '#93805f', '#ab9371'],
  soil:       ['#7c6242', '#6e563a'],
  soilDark:   ['#5e4a30', '#544229'],
  courtEarth: ['#a58a62', '#997e58', '#ae9268'],
  /* 草地与作物 */
  grass:      ['#7d9c52', '#71914a', '#8aa85c', '#658444'],
  grassDry:   ['#a3a05e', '#948f50'],
  grassLight: ['#93b064'],
  crop:       ['#7fa254', '#8fb35e'],
  cropLight:  ['#a9c273', '#b5c97e'],
  /* 植被 */
  leaf:       ['#5c8a44', '#4f7c3b', '#6a9750'],
  leafLight:  ['#7da75c', '#88b166'],
  pine:       ['#3c6a42', '#335c3a', '#2c5233'],
  pineDark:   ['#26462e', '#2b4c33'],
  bamboo:     ['#8aa954', '#7c9c4a', '#94b25e'],
  bambooDark: ['#63813c'],
  trunk:      ['#6b4a2c', '#5d3f24'],
  mossWall:   ['#6b7c4a', '#5c6d40'],
  reed:       ['#93a85a', '#84a04f'],
  /* 水体（暗青绿） */
  water:      ['#4e7d80', '#467275'],
  waterDeep:  ['#3a6164', '#345859'],
  /* 点缀 */
  lantern:    ['#a84434', '#943a2c'],
  lanternLit: ['#d05a34', '#e07044'],
  glow:       ['#f2c078', '#eab264'],
  plaque:     ['#3a2a1c', '#33241a'],
  plaqueGold: ['#c9a44c', '#bd9740'],
  cloth:      ['#ddd6c4', '#cfc8b6'],
  clothBlue:  ['#5f6b7a', '#525d6b'],
  skin:       ['#d8b08c'],
  strawHat:   ['#c2a55e', '#b3964f'],
  chicken:    ['#ddd6c4', '#c8b48e'],
  comb:       ['#b04a34'],
  persimmon:  ['#d07434', '#c26a2e'],
  /* 岛屿剖面（土层/岩层） */
  cliffSoil:  ['#8a6a44', '#7c5e3c', '#83643f'],
  cliffRock:  ['#6e6a60', '#625e54', '#585448'],
  rockOut:    ['#8b877c', '#7b776c', '#817d72'],
};

const MAT_CACHE = {};
function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mat(name) {
  let c = MAT_CACHE[name];
  if (!c) c = MAT_CACHE[name] = PALETTE_DEF[name].map(hexRgb);
  return c;
}
/* 按体素坐标确定性取色（颗粒抖动） */
function tone(name, x, y, z, w = 0) {
  const list = mat(name);
  return list[Math.min(list.length - 1, (hash3(x, y, z + w * 7919) * list.length) | 0)];
}

/* ---------- 建模分组（对应 README 中的对象层级） ---------- */
const GROUPS = {
  TERRAIN: 1, WATER: 2,
  TULOU_WALL: 10, TULOU_ROOF: 11, TULOU_FLOOR: 12, TULOU_COURTYARD: 13,
  TULOU_CORRIDOR: 14, TULOU_DOOR: 15, TULOU_WINDOW: 16, TULOU_STAIR: 17,
  TULOU_ENTRANCE: 18, TULOU_INNERRING: 19,
  VEGETATION: 30, VILLAGE: 31, DECOR: 32,
};
const GROUP_NAMES = {
  1: 'Terrain', 2: 'Water',
  10: 'Tulou/OuterWall', 11: 'Tulou/Roof', 12: 'Tulou/Floors', 13: 'Tulou/Courtyard',
  14: 'Tulou/WoodenCorridor', 15: 'Tulou/Doors', 16: 'Tulou/Windows', 17: 'Tulou/Staircases',
  18: 'Tulou/Entrance', 19: 'Tulou/InnerRing', 30: 'Vegetation', 31: 'VillageProps', 32: 'Lighting/Decor',
};

/* ---------- 体素网格 ---------- */
class VoxelGrid {
  constructor(W, H, D, ox, oy) {
    this.W = W; this.H = H; this.D = D; this.ox = ox; this.oy = oy;
    this.occ = new Uint8Array(W * H * D);
    this.rgb = new Uint8Array(W * H * D * 3);
    this.grp = new Uint8Array(W * H * D);
    this.count = 0;
  }
  inside(x, y, z) {
    const i = x - this.ox, j = y - this.oy, k = z;
    return i >= 0 && j >= 0 && k >= 0 && i < this.W && j < this.H && k < this.D;
  }
  _id(x, y, z) { return (x - this.ox) + (y - this.oy) * this.W + z * this.W * this.H; }
  /* 放置体素（rgb 为 [r,g,b] 数组） */
  set(x, y, z, rgb, grp = 0) {
    if (!this.inside(x, y, z)) return false;
    const id = this._id(x, y, z), o = id * 3;
    if (!this.occ[id]) this.count++;
    this.occ[id] = 1;
    this.rgb[o] = rgb[0]; this.rgb[o + 1] = rgb[1]; this.rgb[o + 2] = rgb[2];
    if (grp) this.grp[id] = grp;
    return true;
  }
  /* 仅当已有体素时重新着色 */
  paint(x, y, z, rgb, grp = 0) {
    if (!this.inside(x, y, z)) return false;
    const id = this._id(x, y, z);
    if (!this.occ[id]) return false;
    const o = id * 3;
    this.rgb[o] = rgb[0]; this.rgb[o + 1] = rgb[1]; this.rgb[o + 2] = rgb[2];
    if (grp) this.grp[id] = grp;
    return true;
  }
  clear(x, y, z) {
    if (!this.inside(x, y, z)) return;
    const id = this._id(x, y, z);
    if (this.occ[id]) { this.occ[id] = 0; this.count--; }
  }
  solid(x, y, z) { return this.inside(x, y, z) && this.occ[this._id(x, y, z)] > 0; }
  /* 供网格化/阴影使用：网格底面以下视为实体（剔除底面），水平越界视为空气 */
  solidForMesh(x, y, z) {
    if (z < 0) return true;
    return this.solid(x, y, z);
  }
  colorAt(x, y, z) {
    const o = this._id(x, y, z) * 3;
    return [this.rgb[o], this.rgb[o + 1], this.rgb[o + 2]];
  }
}

module.exports = { VoxelGrid, GROUPS, GROUP_NAMES, tone, mat, hash2, hash3, fbm, valueNoise, mulberry32, clamp, lerp, smoothstep };
