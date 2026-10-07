'use strict';
/* ============================================================
 * scene_terrain.js — 地形：岛屿化山地、道路、池塘、梯田、菜园
 * 层级: Scene/Terrain (+ Scene/Water)
 * ============================================================ */
const { tone, hash2, hash3, fbm, clamp, lerp, smoothstep, GROUPS } = require('./voxel_core');

/* 岛屿边缘:极坐标半径 + 噪声抖动 → 有机的锯齿状微缩底盘 */
function islandR(theta) {
  return 27 + (fbm(Math.cos(theta) * 1.4 + 51, Math.sin(theta) * 1.4 + 47, 2) - 0.5) * 9;
}
function inIsland(x, y) {
  const re = Math.hypot(x / 1.06, y / 0.96);        // 轻微椭圆
  return re <= islandR(Math.atan2(y, x));
}

/* 道路折线（含各点设计标高，用于放坡） */
const PATH_PTS = [
  { x: 0, y: -17, h: 3 }, { x: 0, y: -22, h: 2 },
  { x: 3, y: -24, h: 2 }, { x: 8, y: -24, h: 2 }, { x: 13, y: -22, h: 2 },
  { x: 17, y: -18, h: 3 }, { x: 20, y: -13, h: 3 }, { x: 22, y: -8, h: 4 }, { x: 24, y: -4, h: 4 },
  { x: -3, y: -24, h: 2 }, { x: -9, y: -22, h: 2 }, { x: -12, y: -20, h: 2 }, { x: -14, y: -18.5, h: 2 },
];
/* 依次连接:0-1-2..8(东支) 与 1-9-10-11-12(西支到池塘) */
const PATH_SEGS = [];
for (let i = 0; i < 8; i++) PATH_SEGS.push([PATH_PTS[i], PATH_PTS[i + 1]]);
PATH_SEGS.push([PATH_PTS[1], PATH_PTS[9]]);
for (let i = 9; i < 12; i++) PATH_SEGS.push([PATH_PTS[i], PATH_PTS[i + 1]]);

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / L2;
  t = clamp(t, 0, 1);
  const qx = a.x + dx * t, qy = a.y + dy * t;
  return { d: Math.hypot(px - qx, py - qy), h: lerp(a.h, b.h, t) };
}
function pathInfo(x, y) {
  let best = { d: 1e9, h: 0 };
  for (const [a, b] of PATH_SEGS) {
    const r = distToSeg(x, y, a, b);
    if (r.d < best.d) best = r;
  }
  return best;
}

const POND = { cx: -13, cy: -14, rx: 6.0, ry: 4.4 };
function pondT(x, y) { return Math.hypot((x - POND.cx) / POND.rx, (y - POND.cy) / POND.ry); }

/* 梯田区域(东侧坡地) */
function terraceInfo(x, y) {
  if (x < 12 || x > 27 || y < -7 || y > 14) return null;
  const m = fbm(x * 0.09 + 7, y * 0.09 - 3, 2);
  if (m < 0.42) return null;
  return 4 + clamp(Math.floor((x - 12) / 4.5), 0, 3);
}
/* 菜园区域(入口东南侧) */
const GARDEN = { x0: 9, x1: 19, y0: -17, y1: -10 };
function inGarden(x, y) { return x >= GARDEN.x0 && x <= GARDEN.x1 && y >= GARDEN.y0 && y <= GARDEN.y1; }

function buildTerrain(g) {
  const W = g.W, ox = g.ox, oy = g.oy;
  const heights = new Int16Array(W * g.H);
  const isPath = new Uint8Array(W * g.H);
  const idOf = (x, y) => (x - ox) + (y - oy) * W;
  const ctx = {
    h: (x, y) => (g.inside(x, y, 0) ? heights[idOf(x, y)] : -1),
    isPath: (x, y) => (g.inside(x, y, 0) ? isPath[idOf(x, y)] : 0),
    garden: GARDEN, pond: POND,
  };

  /* ---- 1. 逐列计算高度 ---- */
  for (let x = ox; x < ox + W; x++) {
    for (let y = oy; y < oy + g.H; y++) {
      if (!inIsland(x, y)) { heights[idOf(x, y)] = -1; continue; }
      let h = 3
        + 5.2 * smoothstep((y - 0) / 26)            // 北侧山体抬升
        + 1.6 * smoothstep((-x - 4) / 20)           // 西侧缓坡
        + 2.0 * smoothstep((x - 8) / 22) * smoothstep((y + 6) / 14) // 东北坡
        + (fbm(x * 0.055 + 31, y * 0.055 - 17, 3) - 0.5) * 4.6;  // 起伏噪声
      /* 土楼周围整平为场地 (z=3) */
      const r = Math.hypot(x, y);
      h = lerp(3, h, smoothstep((r - 16.5) / 6));
      /* 梯田台阶 */
      const th = terraceInfo(x, y);
      if (th !== null) h = th + (hash2(x, y) < 0.25 ? 0 : 0);
      /* 道路放坡 */
      const pi = pathInfo(x, y);
      if (pi.d < 6) h = lerp(h, pi.h, smoothstep((6 - pi.d) / 4.5));
      /* 池塘下挖 */
      const pt = pondT(x, y);
      if (pt < 1.15) h = Math.min(h, pt < 1 ? 1 : 2);
      /* 入口前道路整平 */
      if (Math.abs(x) <= 3 && y <= -17 && y >= -23) h = 2;
      h = Math.round(clamp(h, 1, 9));
      if (pi.d <= 1.7) isPath[idOf(x, y)] = 1;
      heights[idOf(x, y)] = h;
    }
  }

  /* ---- 2. 填充柱体与着色 ---- */
  for (let x = ox; x < ox + W; x++) {
    for (let y = oy; y < oy + g.H; y++) {
      const h = heights[idOf(x, y)];
      if (h < 0) continue;
      const boundary = !(inIsland(x + 1, y) && inIsland(x - 1, y) && inIsland(x, y + 1) && inIsland(x, y - 1));
      const pi = pathInfo(x, y);
      const pt = pondT(x, y);
      const th = terraceInfo(x, y);
      for (let z = 0; z <= h; z++) {
        let rgb, grp = GROUPS.TERRAIN;
        const depth = h - z;
        if (pt < 1 && depth === 0) {
          /* 池塘:池底与水面 */
          rgb = tone('waterDeep', x, y, z);
          grp = GROUPS.WATER;
        } else if (depth === 0) {
          if (pi.d <= 1.7) {
            rgb = hash2(x, y) < 0.1 ? tone('stoneLight', x, y, z) : tone('path', x, y, z);
          } else if (pt < 1.35) {
            rgb = tone('stoneLight', x, y, z);           // 池塘砂石驳岸
          } else if (th !== null) {
            /* 梯田:田埂石棱 + 作物行(带随机休耕) */
            const riser = terraceInfo(x + 1, y) !== th;
            if (riser) rgb = tone('stoneDark', x, y, z);
            else if (hash2(x, y) < 0.10) rgb = tone('grassDry', x, y, z);
            else if ((x & 3) === 3) rgb = tone('soilDark', x, y, z);
            else rgb = (((x + (y >> 1)) & 1) === 0) ? tone('crop', x, y, z) : tone('cropLight', x, y, z);
            grp = GROUPS.VILLAGE;
          } else if (inGarden(x, y)) {
            /* 菜园:深色畦土 + 垄作作物 */
            if ((y & 1) === 0) rgb = hash2(x, y) < 0.14 ? tone('cropLight', x, y, z) : tone('crop', x, y, z);
            else rgb = tone('soilDark', x, y, z);
            grp = GROUPS.VILLAGE;
          } else {
            /* 草地:干湿斑块 */
            rgb = fbm(x * 0.12 + 5, y * 0.12 + 9, 2) > 0.62 ? tone('grassDry', x, y, z) : tone('grass', x, y, z);
          }
        } else if (boundary) {
          /* 剖面地层:草皮缘 → 土层 → 岩层 */
          if (depth <= 1) rgb = tone('cliffSoil', x, y, z);
          else if (depth <= 2 + Math.floor(2 * fbm(x * 0.3, y * 0.3, 2) + z * 0.31) % 2) rgb = tone('cliffSoil', x, y, z);
          else rgb = tone('cliffRock', x, y, z * 7);
        } else {
          rgb = tone('soilDark', x, y, z);
        }
        g.set(x, y, z, rgb, grp);
      }
      /* 水面(池塘 z=h+1) */
      if (pt < 1 && heights[idOf(x, y)] === 1) {
        g.set(x, y, 2, tone('water', x, y, 2), GROUPS.WATER);
      }
      /* 草丛点缀 */
      if (!isPath[idOf(x, y)] && pt > 1.35 && th === null && !inGarden(x, y) && hash2(x, y) > 0.965) {
        g.set(x, y, h + 1, tone('grassLight', x, y, h), GROUPS.VEGETATION);
      }
    }
  }

  /* ---- 3. 水渠(池塘北缘 → 田地,凹槽) ---- */
  const CH = [[-9, -11], [-8, -9], [-7, -7.5], [-6, -6]];
  for (let i = 0; i < CH.length - 1; i++) {
    const [ax, ay] = CH[i], [bx, by] = CH[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(lerp(ax, bx, k / n)), y = Math.round(lerp(ay, by, k / n));
      const h = ctx.h(x, y);
      if (h >= 1 && g.solid(x, y, h)) {
        g.clear(x, y, h);
        g.set(x, y, h - 1 >= 0 ? h - 1 : 0, tone('water', x, y, 3), GROUPS.WATER);
      }
    }
  }

  return ctx;
}

module.exports = { buildTerrain, inIsland, pathInfo, pondT, terraceInfo, inGarden, GARDEN, POND };
