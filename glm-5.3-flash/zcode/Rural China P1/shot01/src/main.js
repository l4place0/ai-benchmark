'use strict';
/* ============================================================
 * main.js — 构建完整场景并渲染输出
 * 用法: node src/main.js [--preview]
 * ============================================================ */
const path = require('path');
const fs = require('fs');
const { VoxelGrid, GROUP_NAMES } = require('./voxel_core');
const { buildTerrain } = require('./scene_terrain');
const { buildTulou } = require('./scene_tulou');
const { buildEnvironment } = require('./scene_environment');
const { buildMesh, render, writePNG, writeVox } = require('./render_core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'renders');
const PREVIEW = process.argv.includes('--preview');

/* ---------- 1. 构建体素场景 ---------- */
console.time('build');
const grid = new VoxelGrid(68, 64, 30, -34, -32);   // 世界坐标 x∈[-34,33] y∈[-32,31] z∈[0,29]
const ctx = buildTerrain(grid);
buildTulou(grid, ctx);
buildEnvironment(grid, ctx);
console.timeEnd('build');
console.log('total voxels:', grid.count);

/* 分组统计(对象层级核对) */
const grpCount = new Map();
for (let i = 0; i < grid.occ.length; i++) {
  if (grid.occ[i]) grpCount.set(grid.grp[i], (grpCount.get(grid.grp[i]) || 0) + 1);
}
console.log('--- group counts ---');
for (const [g, c] of [...grpCount.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(String(g).padStart(3), (GROUP_NAMES[g] || '?').padEnd(22), c);
}

/* ---------- 2. 网格化(共享给所有相机) ---------- */
console.time('mesh');
const SUN = [0.627, -0.440, 0.643];   // 东南偏高上午斜射光
const mesh = buildMesh(grid, SUN);
console.timeEnd('mesh');
console.log('faces:', mesh.nF, 'vertices:', mesh.nV);

/* ---------- 3. 渲染 ---------- */
const CAMS = PREVIEW ? [
  { name: 'preview_hero', az: 150, el: 40, orthoW: 59, target: [0, -3, 8.5], res: [1100, 825], ss: 2 },
  { name: 'preview_top', az: 0, el: 89.9, orthoW: 62, target: [0, 0, 6], res: [900, 900], ss: 1 },
  { name: 'preview_detail', az: 148, el: 26, orthoW: 22, target: [3, -12, 8], res: [1000, 750], ss: 2 },
  { name: 'preview_full', az: 118, el: 52, orthoW: 74, target: [0, 1, 7], res: [1000, 750], ss: 2 },
] : [
  { name: 'render_01_isometric_hero', az: 150, el: 40, orthoW: 59, target: [0, -3, 8.5], res: [2400, 1800], ss: 2 },
  { name: 'render_02_full_scene', az: 100, el: 52, orthoW: 74, target: [0, 1, 7], res: [2000, 1500], ss: 2 },
  { name: 'render_03_detail_entrance', az: 148, el: 26, orthoW: 22, target: [3, -12, 8], res: [1800, 1350], ss: 2 },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
for (const cam of CAMS) {
  console.time('render ' + cam.name);
  const img = render(mesh, cam);
  writePNG(path.join(OUT, cam.name + '.png'), img);
  console.timeEnd('render ' + cam.name);
}

/* ---------- 4. 导出 .vox ---------- */
if (!PREVIEW) {
  const stats = writeVox(grid, path.join(ROOT, 'tulou_scene.vox'));
  console.log('vox exported:', stats);
}
console.log('done.');
