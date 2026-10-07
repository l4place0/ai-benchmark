'use strict';
/* ============================================================
 * export_viewer.js — 生成自包含交互查看器 tulou_viewer.html
 * 将场景网格(含烘焙 AO/日照)打包为二进制并以 base64 内嵌,
 * 无任何外部依赖,双击即可在浏览器中拖拽/缩放浏览。
 * 用法: node src/export_viewer.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { VoxelGrid } = require('./voxel_core');
const { buildTerrain } = require('./scene_terrain');
const { buildTulou } = require('./scene_tulou');
const { buildEnvironment } = require('./scene_environment');
const { buildMesh } = require('./render_core');

/* 6 方向法向量(与 render_core 一致):0:+x 1:-x 2:+y 3:-y 4:+z 5:-z */
const DIR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/* ---------- 构建场景与网格 ---------- */
const grid = new VoxelGrid(68, 64, 30, -34, -32);
const ctx = buildTerrain(grid);
buildTulou(grid, ctx);
buildEnvironment(grid, ctx);
const SUN = [0.627, -0.440, 0.643];
const mesh = buildMesh(grid, SUN);
console.log('voxels:', grid.count, 'faces:', mesh.nF, 'vertices:', mesh.nV);
if (mesh.nV > 65535) throw new Error('顶点数超出 uint16 索引范围');

/* ---------- 二进制打包 ----------
 * 头部 24B: nV u32 | nQ u32 | target xyz f32 | orthoW f32
 * 顶点 nV×14B: pos i16×3(×2) | nrm i8×3 | col u8×3 | ao u8 | sh u8
 * 索引 nQ×12B: 每四边形展开为 2 三角形 u16×6
 * 注:顶点按(格点+朝向)去重,颜色取最后写入面(仅对角同向面共点,视觉无差异) */
const TARGET = [0, -3, 8.5], ORTHO_W = 64;
const header = Buffer.alloc(24);
header.writeUInt32LE(mesh.nV, 0);
header.writeUInt32LE(mesh.nF, 4);
for (let i = 0; i < 3; i++) header.writeFloatLE(TARGET[i], 8 + i * 4);
header.writeFloatLE(ORTHO_W, 20);

const verts = Buffer.alloc(mesh.nV * 14);
const idx = Buffer.alloc(mesh.nF * 12);
const QUAD_ORDER = [0, 1, 2, 0, 2, 3];
for (let f = 0; f < mesh.nF; f++) {
  const d = mesh.fN[f], n = DIR[d];
  const vis = [mesh.fV[f * 4], mesh.fV[f * 4 + 1], mesh.fV[f * 4 + 2], mesh.fV[f * 4 + 3]];
  for (let c = 0; c < 4; c++) {
    const vi = vis[c], vo = vi * 14;
    verts.writeInt16LE(mesh.vX[vi], vo);
    verts.writeInt16LE(mesh.vY[vi], vo + 2);
    verts.writeInt16LE(mesh.vZ[vi], vo + 4);
    verts[vo + 6] = n[0] * 127; verts[vo + 7] = n[1] * 127; verts[vo + 8] = n[2] * 127;
    verts[vo + 9] = mesh.fCol[f * 3];
    verts[vo + 10] = mesh.fCol[f * 3 + 1];
    verts[vo + 11] = mesh.fCol[f * 3 + 2];
    verts[vo + 12] = mesh.vAO[vi];
    verts[vo + 13] = mesh.vSH[vi];
  }
  for (let k = 0; k < 6; k++) idx.writeUInt16LE(vis[QUAD_ORDER[k]], f * 12 + k * 2);
}

const binary = Buffer.concat([header, verts, idx]);
console.log('binary:', binary.length, 'bytes');

/* ---------- 模板注入 ---------- */
const tpl = fs.readFileSync(path.join(__dirname, 'viewer_template.html'), 'utf8');
const b64 = binary.toString('base64');
const stats = `${grid.count.toLocaleString()} 体素 · ${mesh.nF.toLocaleString()} 面 · 交互式`;
const html = tpl
  .replace('__DATA__', b64)
  .replace('__STATS__', stats);
const out = path.join(__dirname, '..', 'tulou_viewer.html');
fs.writeFileSync(out, html);
console.log('viewer written:', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
