'use strict';
/* ============================================================
 * render_core.js — 自研体素软件渲染器
 * 暴露面网格化 → 顶点AO → 体素阴影DDA → 正交等距投影 →
 * z-buffer 三角光栅化 → Lambert + 天空环境光 → 色调映射 →
 * SSAA 降采样 → PNG;另附 MagicaVoxel .vox 导出
 * ============================================================ */
const fs = require('fs');
const zlib = require('zlib');

/* ---------- 可增长类型化数组 ---------- */
class Grow {
  constructor(Ctor, cap) { this.a = new Ctor(cap); this.n = 0; this.Ctor = Ctor; }
  push(...vs) {
    for (const v of vs) {
      if (this.n === this.a.length) {
        const b = new this.Ctor(this.a.length * 2); b.set(this.a); this.a = b;
      }
      this.a[this.n++] = v;
    }
  }
  get arr() { return this.a.subarray(0, this.n); }
}

/* 6 个方向:0:+x 1:-x 2:+y 3:-y 4:+z 5:-z */
const DIR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const AXIS_OF = (d) => d >> 1;
/* AO 四级亮度 */
const AOMAP = [128, 179, 222, 255];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ---------- 光照常量 ---------- */
let SUNV = [0.627, -0.440, 0.643];          // 指向太阳的单位向量(东南偏高)
const SUN_COL = [1.06, 0.97, 0.85];
const AMB_SKY = [0.50, 0.57, 0.66];
const AMB_GND = [0.31, 0.28, 0.24];
const SKY_TOP = [0.62, 0.69, 0.78];
const SKY_HOR = [0.86, 0.88, 0.89];
const SKY_LOW = [0.77, 0.80, 0.82];

/* 色调映射查找表: v∈[0,2] → [0,1] */
const TONE = new Float32Array(2049);
for (let i = 0; i <= 2048; i++) {
  TONE[i] = Math.min(1, 1.16 * (1 - Math.exp(-1.30 * (i / 1024))));
}

/* ---------- Amanatides–Woo 体素步进:沿太阳方向是否被遮挡 ---------- */
function ddaBlocked(grid, px, py, pz, dir) {
  let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
  if (grid.solidForMesh(x, y, z)) return true;
  const stX = dir[0] > 0 ? 1 : -1, stY = dir[1] > 0 ? 1 : -1, stZ = dir[2] > 0 ? 1 : -1;
  const tdx = dir[0] !== 0 ? Math.abs(1 / dir[0]) : Infinity;
  const tdy = dir[1] !== 0 ? Math.abs(1 / dir[1]) : Infinity;
  const tdz = dir[2] !== 0 ? Math.abs(1 / dir[2]) : Infinity;
  let tmx = dir[0] !== 0 ? (stX > 0 ? x + 1 - px : px - x) * tdx : Infinity;
  let tmy = dir[1] !== 0 ? (stY > 0 ? y + 1 - py : py - y) * tdy : Infinity;
  let tmz = dir[2] !== 0 ? (stZ > 0 ? z + 1 - pz : pz - z) * tdz : Infinity;
  for (let i = 0; i < 400; i++) {
    if (tmx < tmy && tmx < tmz) { x += stX; tmx += tdx; }
    else if (tmy < tmz) { y += stY; tmy += tdy; }
    else { z += stZ; tmz += tdz; }
    if (z < 0 || z > grid.D + 40 || Math.abs(x) > 260 || Math.abs(y) > 260) return false;
    if (grid.solidForMesh(x, y, z)) return true;
  }
  return false;
}

/* ============================================================
 * buildMesh — 抽取暴露面,顶点按(格点+朝向)去重,预计算 AO 与日照
 * ============================================================ */
function buildMesh(grid, sun) {
  SUNV = sun;
  const fPos = new Grow(Float32Array, 1 << 16);   // 12/face(4顶点×xyz)
  const fCol = new Grow(Uint8Array, 1 << 12);     // 3/face
  const fN = new Grow(Uint8Array, 1 << 10);       // 1/face
  const fV = new Grow(Uint32Array, 1 << 12);      // 4/face
  const vX = new Grow(Int16Array, 1 << 12);       // 顶点坐标×2(半整数格点)
  const vY = new Grow(Int16Array, 1 << 12);
  const vZ = new Grow(Int16Array, 1 << 12);
  const vAO = new Grow(Uint8Array, 1 << 12);
  const vSH = new Grow(Uint8Array, 1 << 12);
  const vMap = new Map();

  const solid = (x, y, z) => grid.solidForMesh(x, y, z);

  function vertex(px2, py2, pz2, d, s1s2, cell) {
    const key = (((px2 + 1024) * 2048 + (py2 + 1024)) * 128 + pz2) * 8 + d;
    let idx = vMap.get(key);
    if (idx !== undefined) return idx;
    /* 环境光遮蔽:面朝向格的三个角点邻域 */
    const a = AXIS_OF(d), n = DIR[d];
    const t1 = (a + 1) % 3, t2 = (a + 2) % 3;
    const bx = cell[0] + n[0], by = cell[1] + n[1], bz = cell[2] + n[2];
    const s1 = s1s2[0], s2 = s1s2[1];
    const o1x = t1 === 0 ? s1 : 0, o1y = t1 === 1 ? s1 : 0, o1z = t1 === 2 ? s1 : 0;
    const o2x = t2 === 0 ? s2 : 0, o2y = t2 === 1 ? s2 : 0, o2z = t2 === 2 ? s2 : 0;
    const side1 = solid(bx + o1x, by + o1y, bz + o1z) ? 1 : 0;
    const side2 = solid(bx + o2x, by + o2y, bz + o2z) ? 1 : 0;
    const cornr = solid(bx + o1x + o2x, by + o1y + o2y, bz + o1z + o2z) ? 1 : 0;
    const aoL = (side1 && side2) ? 0 : 3 - (side1 + side2 + cornr);
    /* 日照阴影(仅受光面) */
    let sh = 255;
    const lam = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
    if (lam > 0.02) {
      const sx0 = px2 / 2 + n[0] * 0.5 + sun[0] * 0.51;
      const sy0 = py2 / 2 + n[1] * 0.5 + sun[1] * 0.51;
      const sz0 = pz2 / 2 + n[2] * 0.5 + sun[2] * 0.51;
      if (ddaBlocked(grid, sx0, sy0, sz0, sun)) sh = 0;
    }
    idx = vX.n;
    vX.push(px2); vY.push(py2); vZ.push(pz2);
    vAO.push(AOMAP[aoL]); vSH.push(sh);
    vMap.set(key, idx);
    return idx;
  }

  for (let z = 0; z < grid.D; z++) {
    for (let y = grid.oy; y < grid.oy + grid.H; y++) {
      for (let x = grid.ox; x < grid.ox + grid.W; x++) {
        if (!grid.solid(x, y, z)) continue;
        const col = grid.colorAt(x, y, z);
        for (let d = 0; d < 6; d++) {
          const n = DIR[d];
          if (solid(x + n[0], y + n[1], z + n[2])) continue;
          const a = AXIS_OF(d), t1 = (a + 1) % 3, t2 = (a + 2) % 3;
          const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          const vi = [0, 0, 0, 0];
          for (let c = 0; c < 4; c++) {
            const u = signs[c][0], v = signs[c][1];
            const q = [0, 0, 0];
            q[a] = ((a === 0 ? x : a === 1 ? y : z) + n[a] * 0.5) * 2;
            q[t1] = ((t1 === 0 ? x : t1 === 1 ? y : z) + u * 0.5) * 2;
            q[t2] = ((t2 === 0 ? x : t2 === 1 ? y : z) + v * 0.5) * 2;
            vi[c] = vertex(q[0], q[1], q[2], d, signs[c], [x, y, z]);
          }
          for (let c = 0; c < 4; c++) fV.push(vi[c]);
          fN.push(d);
          fCol.push(col[0], col[1], col[2]);
          for (let c = 0; c < 4; c++) {
            fPos.push(vX.a[vi[c]] / 2, vY.a[vi[c]] / 2, vZ.a[vi[c]] / 2);
          }
        }
      }
    }
  }
  return {
    nF: fN.n,
    fPos: fPos.arr, fCol: fCol.arr, fN: fN.arr, fV: fV.arr,
    nV: vX.n, vX: vX.arr, vY: vY.arr, vZ: vZ.arr, vAO: vAO.arr, vSH: vSH.arr,
  };
}

/* ============================================================
 * render — 正交等距投影 + 光栅化 + 光照 + 后期
 * cam: {az, el, orthoW, target, res, ss}
 * ============================================================ */
function render(mesh, cam) {
  const [RW, RH] = cam.res;
  const ss = cam.ss || 2;
  const w = RW * ss, h = RH * ss;
  const scale = w / cam.orthoW;
  const azR = cam.az * Math.PI / 180, elR = cam.el * Math.PI / 180;
  const f = [-Math.sin(azR) * Math.cos(elR), -Math.cos(azR) * Math.cos(elR), -Math.sin(elR)];
  const rLen = Math.hypot(f[0], f[1]);
  const R = [f[1] / rLen, -f[0] / rLen, 0];
  const U = [
    R[1] * f[2] - R[2] * f[1],
    R[2] * f[0] - R[0] * f[2],
    R[0] * f[1] - R[1] * f[0],
  ];
  const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2];

  /* --- 投影顶点 --- */
  const nV = mesh.nV;
  const sX = new Float32Array(nV), sY = new Float32Array(nV), sD = new Float32Array(nV);
  for (let i = 0; i < nV; i++) {
    const rx = mesh.vX[i] / 2 - tx, ry = mesh.vY[i] / 2 - ty, rz = mesh.vZ[i] / 2 - tz;
    sX[i] = w / 2 + (rx * R[0] + ry * R[1] + rz * R[2]) * scale;
    sY[i] = h / 2 - (rx * U[0] + ry * U[1] + rz * U[2]) * scale;
    sD[i] = rx * f[0] + ry * f[1] + rz * f[2];
  }

  /* --- 天空底色 + 深度缓冲 --- */
  const nPx = w * h;
  const zb = new Float32Array(nPx).fill(Infinity);
  const cb = new Uint8ClampedArray(nPx * 3);
  for (let py = 0; py < h; py++) {
    const t = clamp01(1 - py / (h * 0.72));
    const br = t > 0 ? lerp3(SKY_HOR, SKY_TOP, t) : lerp3(SKY_HOR, SKY_LOW, -t);
    let o = py * w * 3;
    for (let px = 0; px < w; px++) {
      cb[o++] = br[0] * 255; cb[o++] = br[1] * 255; cb[o++] = br[2] * 255;
    }
  }

  /* --- 逐面光栅化(每面拆两个三角形) --- */
  const { fCol, fN, fV, vAO, vSH } = mesh;
  const nF = mesh.nF;
  const bias = 2e-3;

  for (let fi = 0; fi < nF; fi++) {
    const d = fN[fi], n = DIR[d];
    const lam = Math.max(0, n[0] * SUNV[0] + n[1] * SUNV[1] + n[2] * SUNV[2]);
    const tt = n[2] * 0.5 + 0.5;
    const aR = (AMB_GND[0] + (AMB_SKY[0] - AMB_GND[0]) * tt) / 255;
    const aG = (AMB_GND[1] + (AMB_SKY[1] - AMB_GND[1]) * tt) / 255;
    const aB = (AMB_GND[2] + (AMB_SKY[2] - AMB_GND[2]) * tt) / 255;
    const sR = SUN_COL[0] * lam / 255, sG = SUN_COL[1] * lam / 255, sB = SUN_COL[2] * lam / 255;
    const bR = fCol[fi * 3], bG = fCol[fi * 3 + 1], bB = fCol[fi * 3 + 2];

    const i0 = fV[fi * 4], i1 = fV[fi * 4 + 1], i2 = fV[fi * 4 + 2], i3 = fV[fi * 4 + 3];
    const x0 = sX[i0], y0 = sY[i0], x1 = sX[i1], y1 = sY[i1];
    const x2 = sX[i2], y2 = sY[i2], x3 = sX[i3], y3 = sY[i3];
    const d0 = sD[i0], d1 = sD[i1], d2 = sD[i2], d3 = sD[i3];
    const a0 = vAO[i0], a1 = vAO[i1], a2 = vAO[i2], a3 = vAO[i3];
    const g0 = vSH[i0], g1 = vSH[i1], g2 = vSH[i2], g3 = vSH[i3];

    const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2, x3)));
    const maxx = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2, x3)));
    const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2, y3)));
    const maxy = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2, y3)));
    if (minx > maxx || miny > maxy) continue;

    tri(x0, y0, x1, y1, x2, y2, d0, d1, d2, a0, a1, a2, g0, g1, g2);
    tri(x0, y0, x2, y2, x3, y3, d0, d2, d3, a0, a2, a3, g0, g2, g3);

    function tri(ax, ay, bx, by, cx, cy, dd0, dd1, dd2, aa0, aa1, aa2, hh0, hh1, hh2) {
      const denom = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (denom === 0) return;
      const inv = 1 / denom;
      for (let py = miny; py <= maxy; py++) {
        const pyc = py + 0.5;
        const row = py * w;
        for (let px = minx; px <= maxx; px++) {
          const pxc = px + 0.5;
          const w0 = ((bx - pxc) * (cy - pyc) - (by - pyc) * (cx - pxc)) * inv;
          if (w0 < 0) continue;
          const w1 = ((cx - pxc) * (ay - pyc) - (cy - pyc) * (ax - pxc)) * inv;
          if (w1 < 0) continue;
          const w2 = 1 - w0 - w1;
          if (w2 < 0) continue;
          const zi = row + px;
          const dz = dd0 * w0 + dd1 * w1 + dd2 * w2;
          if (dz >= zb[zi] - bias) continue;
          zb[zi] = dz;
          const aoF = 0.40 + 0.60 * (aa0 * w0 + aa1 * w1 + aa2 * w2) * (1 / 255);
          const shF = 0.22 + 0.78 * (hh0 * w0 + hh1 * w1 + hh2 * w2) * (1 / 255);
          let o = zi * 3;
          const v0 = bR * (aR * aoF + sR * shF);
          cb[o] = TONE[Math.min(2048, (v0 * 1024) | 0)] * 255;
          const v1 = bG * (aG * aoF + sG * shF);
          cb[o + 1] = TONE[Math.min(2048, (v1 * 1024) | 0)] * 255;
          const v2 = bB * (aB * aoF + sB * shF);
          cb[o + 2] = TONE[Math.min(2048, (v2 * 1024) | 0)] * 255;
        }
      }
    }
  }

  /* --- 后期:SSAA 降采样 + 暗角 + 抖动 --- */
  const out = new Uint8ClampedArray(RW * RH * 4);
  for (let oy = 0; oy < RH; oy++) {
    for (let ox = 0; ox < RW; ox++) {
      const dx = (ox / RW - 0.5) * 2, dy = (oy / RH - 0.5) * 2;
      const vig = 1 - 0.16 * Math.min(1, dx * dx + dy * dy);
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const o = ((oy * ss + sy) * w + ox * ss + sx) * 3;
          r += cb[o]; g += cb[o + 1]; b += cb[o + 2];
        }
      }
      const inv = vig / (ss * ss);
      const dth = (hash2i(ox, oy) - 0.5) * 1.8;
      const oo = (oy * RW + ox) * 4;
      out[oo] = r * inv + dth;
      out[oo + 1] = g * inv + dth;
      out[oo + 2] = b * inv + dth;
      out[oo + 3] = 255;
    }
  }
  return { w: RW, h: RH, rgba: out };
}

function hash2i(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ============================================================
 * PNG 编码(RGBA8,filter 0)
 * ============================================================ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function writePNG(path, img) {
  fs.writeFileSync(path, encodePNG(img.w, img.h, img.rgba));
}

/* ============================================================
 * writeVox — 导出 MagicaVoxel 体素文件(调色板量化,<255 色)
 * ============================================================ */
function writeVox(grid, path) {
  const palMap = new Map();
  const pal = [];
  const vox = [];
  for (let z = 0; z < grid.D; z++) {
    for (let y = grid.oy; y < grid.oy + grid.H; y++) {
      for (let x = grid.ox; x < grid.ox + grid.W; x++) {
        if (!grid.solid(x, y, z)) continue;
        const [r, g, b] = grid.colorAt(x, y, z);
        const key = (r << 16) | (g << 8) | b;
        let ci = palMap.get(key);
        if (ci === undefined) {
          if (pal.length < 255) {
            ci = pal.length;
            pal.push([r, g, b]);
            palMap.set(key, ci);
          } else {
            let bd = 1e9, bi = 0;
            for (let i = 0; i < pal.length; i++) {
              const p = pal[i];
              const dd = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b);
              if (dd < bd) { bd = dd; bi = i; }
            }
            ci = bi;
          }
        }
        vox.push(x - grid.ox, y - grid.oy, z, ci + 1);
      }
    }
  }
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); return b; };
  const sizeChunk = Buffer.concat([Buffer.from('SIZE'), u32(12), u32(0), u32(grid.W), u32(grid.H), u32(grid.D)]);
  const xyzi = Buffer.alloc(4 + vox.length);
  xyzi.writeUInt32LE(vox.length / 4, 0);
  for (let i = 0; i < vox.length; i++) xyzi[4 + i] = vox[i] & 0xFF;
  const xyziChunk = Buffer.concat([Buffer.from('XYZI'), u32(xyzi.length), u32(0), xyzi]);
  const rgba = Buffer.alloc(1024);
  for (let i = 0; i < 256; i++) {
    const c = pal[i] || [0, 0, 0];
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
  }
  const rgbaChunk = Buffer.concat([Buffer.from('RGBA'), u32(1024), u32(0), rgba]);
  const children = Buffer.concat([sizeChunk, xyziChunk, rgbaChunk]);
  const main = Buffer.concat([Buffer.from('MAIN'), u32(0), u32(children.length), children]);
  fs.writeFileSync(path, Buffer.concat([Buffer.from('VOX '), u32(150), main]));
  return { voxels: vox.length / 4, palette: pal.length };
}

module.exports = { buildMesh, render, writePNG, writeVox };
