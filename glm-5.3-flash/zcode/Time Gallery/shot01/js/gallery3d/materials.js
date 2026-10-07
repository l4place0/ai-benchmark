// materials.js — 程序化大理石纹理（fBm/turbulence）与 PBR 材质库
// 3D Agent 专属。所有纹理 Canvas 程序生成，零外部请求。

import * as THREE from 'three';

/* ---------------- 噪声基础（hash 值噪声 + fBm） ---------------- */

function hash2(xi, yi, seed) {
  let h = (Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263) ^ Math.imul(seed, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) | 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, octaves) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 131);
    norm += amp;
    amp *= 0.52;
    freq *= 2.03;
  }
  return sum / norm;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/* ---------------- 大理石画布 ---------------- */

/**
 * 生成可平铺（镜像重复）的大理石纹理画布。
 * opts: { size, seed, base, base2, vein, vein2, veinSharp, veinFreq, warp, grain, grid }
 */
export function makeMarbleCanvas(opts = {}) {
  const size = opts.size || 512;
  const seed = opts.seed || 7;
  const base = opts.base || [242, 234, 217];
  const base2 = opts.base2 || mix3(base, [120, 104, 82], 0.18);
  const vein = opts.vein || [172, 152, 118];
  const vein2 = opts.vein2 || mix3(vein, base, 0.45);
  const veinSharp = opts.veinSharp || 4.2;
  const veinFreq = opts.veinFreq || 2.1;
  const warp = opts.warp || 2.4;
  const grain = opts.grain !== undefined ? opts.grain : 0.045;
  const veinStrength = opts.veinStrength || 0.72;
  const grid = opts.grid || null; // { step, color, alpha }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const S = 3.2; // 噪声坐标缩放
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * S;
      const ny = (y / size) * S;
      const t1 = fbm(nx, ny, seed, 5);
      const t2 = fbm(nx * 0.55 + 13.7, ny * 0.55 + 7.3, seed + 999, 3);

      // 主纹：域扭曲正弦脊线
      const phase = (nx * veinFreq + t1 * warp) * Math.PI;
      let m1 = 1 - Math.abs(Math.sin(phase));
      m1 = Math.pow(clamp01(m1), veinSharp);
      // 次纹：另一方向，更细更淡
      const phase2 = (ny * veinFreq * 0.7 - t1 * warp * 0.8 + 1.7) * Math.PI;
      let m2 = 1 - Math.abs(Math.sin(phase2));
      m2 = Math.pow(clamp01(m2), veinSharp * 1.6) * 0.55;

      // 大尺度色调起伏
      let col = mix3(base, base2, clamp01((t2 - 0.48) * 1.15));
      col = mix3(col, vein2, clamp01(m2 * 0.6));
      col = mix3(col, vein, clamp01(m1 * veinStrength));
      // 细颗粒
      const g = (hash2(x, y, seed + 55) - 0.5) * grain * 255;
      const r = clamp01((col[0] + g) / 255);
      const gg = clamp01((col[1] + g) / 255);
      const b = clamp01((col[2] + g) / 255);

      const i = (y * size + x) * 4;
      data[i] = r * 255;
      data[i + 1] = gg * 255;
      data[i + 2] = b * 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 石板拼缝（可选）
  if (grid) {
    const step = grid.step || 128;
    ctx.strokeStyle = grid.color || 'rgba(58,48,38,0.5)';
    ctx.lineWidth = grid.width || 2;
    ctx.beginPath();
    for (let p = 0; p <= size; p += step) {
      ctx.moveTo(p + 0.5, 0);
      ctx.lineTo(p + 0.5, size);
      ctx.moveTo(0, p + 0.5);
      ctx.lineTo(size, p + 0.5);
    }
    ctx.stroke();
    // 每格轻微明度差，模拟大板色差
    if (grid.tint) {
      ctx.globalAlpha = 0.05;
      for (let gy = 0; gy < size; gy += step) {
        for (let gx = 0; gx < size; gx += step) {
          const v = hash2(gx / step, gy / step, seed + 31);
          ctx.fillStyle = v > 0.5 ? '#ffffff' : '#3a3026';
          ctx.fillRect(gx, gy, step, step);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  return canvas;
}

/** 光柱纵向渐隐画布：附加混合下黑色=不可见 */
export function makeConeFadeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgb(70,70,70)');    // 穹顶稍暗
  grad.addColorStop(0.16, 'rgb(255,255,255)');
  grad.addColorStop(0.55, 'rgb(200,200,200)');
  grad.addColorStop(0.9, 'rgb(40,40,40)');
  grad.addColorStop(1, 'rgb(0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  return canvas;
}

/** 竖直暖色渐变画布（门厅尽头发光板） */
export function makeGlowCanvas(w = 256, h = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#fff8e6');
  grad.addColorStop(0.45, '#ffe9bd');
  grad.addColorStop(0.8, '#f7c987');
  grad.addColorStop(1, '#e8ab5f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // 中央更亮的“日光”椭圆
  const rg = ctx.createRadialGradient(w / 2, h * 0.34, 6, w / 2, h * 0.34, w * 0.52);
  rg.addColorStop(0, 'rgba(255,255,244,0.95)');
  rg.addColorStop(1, 'rgba(255,255,244,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

/** 铭牌画布：中文标题 + 作者 + 年代 */
export function makePlaqueCanvas({ title, artist, year }) {
  const w = 512;
  const h = 232;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 羊皮纸底
  ctx.fillStyle = '#f3ecdd';
  ctx.fillRect(0, 0, w, h);
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(200,162,75,0.16)');
  shade.addColorStop(0.5, 'rgba(200,162,75,0)');
  shade.addColorStop(1, 'rgba(120,90,40,0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  // 金边
  ctx.strokeStyle = '#c8a24b';
  ctx.lineWidth = 6;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.strokeStyle = 'rgba(163,130,58,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  const fontStack = '"Palatino Linotype", Georgia, "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2b4a9b';
  let fs = 46;
  ctx.font = `800 ${fs}px ${fontStack}`;
  let titleText = title || '无题';
  while (ctx.measureText(titleText).width > w - 96 && fs > 24) {
    fs -= 2;
    ctx.font = `800 ${fs}px ${fontStack}`;
  }
  ctx.fillText(titleText, w / 2, 78);
  ctx.fillStyle = '#3d2f22';
  ctx.font = `400 30px ${fontStack}`;
  ctx.fillText(`${artist || ''} · ${year || ''}`, w / 2, 148);
  ctx.strokeStyle = 'rgba(163,130,58,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 60, 182);
  ctx.lineTo(w / 2 + 60, 182);
  ctx.stroke();
  return canvas;
}

/** 占位画布：纹理加载失败时的灰底 + 标题 */
export function makePlaceholderCanvas(title, aspect) {
  const w = 768;
  const h = Math.max(128, Math.round(w / Math.max(0.35, aspect)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b9b2a4';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < h; i += 8) ctx.fillRect(0, i, w, 3);
  ctx.strokeStyle = '#8f887b';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.fillStyle = '#4a443a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontStack = '"Microsoft YaHei", "PingFang SC", sans-serif';
  let fs = Math.min(56, (h * 0.22) | 0);
  ctx.font = `700 ${fs}px ${fontStack}`;
  while (ctx.measureText(title).width > w - 120 && fs > 18) {
    fs -= 2;
    ctx.font = `700 ${fs}px ${fontStack}`;
  }
  ctx.fillText(title || '（图片缺失）', w / 2, h / 2);
  return canvas;
}

/* ---------------- 材质库 ---------------- */

export function createMaterialLibrary(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = [];
  const materials = [];

  function tex(canvas, { repeat, srgb = true, mirrored = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    textures.push(t);
    return t;
  }

  function std(params) {
    const m = new THREE.MeshStandardMaterial(params);
    materials.push(m);
    return m;
  }

  // ---- 大理石变体 ----
  const marbleWarmCanvas = makeMarbleCanvas({
    seed: 11, base: [240, 232, 215], base2: [216, 202, 176],
    vein: [186, 168, 136], vein2: [206, 190, 160], veinFreq: 2.0, warp: 2.2, veinSharp: 4.4,
  });
  const marbleHoneyCanvas = makeMarbleCanvas({
    seed: 23, base: [230, 212, 176], base2: [208, 182, 140],
    vein: [178, 134, 82], vein2: [198, 164, 112], veinFreq: 2.4, warp: 2.1, veinSharp: 4.6,
  });
  const marbleGrayCanvas = makeMarbleCanvas({
    seed: 37, base: [233, 229, 221], base2: [208, 206, 200],
    vein: [166, 168, 174], vein2: [186, 188, 192], veinFreq: 2.6, warp: 2.6, veinSharp: 5.0,
  });
  const marbleRossoCanvas = makeMarbleCanvas({
    seed: 51, base: [108, 44, 38], base2: [82, 30, 27],
    vein: [186, 148, 118], vein2: [140, 70, 56], veinFreq: 1.8, warp: 2.6, veinSharp: 4.2, grain: 0.06, veinStrength: 0.55,
  });
  const floorCanvas = makeMarbleCanvas({
    seed: 11, base: [236, 226, 206], base2: [212, 198, 170],
    vein: [176, 156, 124], vein2: [200, 184, 152], veinFreq: 1.7, warp: 2.0, veinSharp: 4.4,
    grid: { step: 128, color: 'rgba(66,55,42,0.45)', width: 2, tint: true },
  });
  const glowCanvas = makeGlowCanvas();

  const T = {
    marbleWallWarm: tex(marbleWarmCanvas, { repeat: [2.4, 3.4] }),
    marbleWallHoney: tex(marbleHoneyCanvas, { repeat: [1.8, 2.6] }),
    marbleWallGray: tex(marbleGrayCanvas, { repeat: [2.0, 2.0] }),
    marbleDome: tex(marbleWarmCanvas, { repeat: [6, 3] }),
    marbleRosso: tex(marbleRossoCanvas, { repeat: [1.4, 1.4] }),
    marbleFloor: tex(floorCanvas, { repeat: [9, 9] }),
    marbleFloorFine: tex(floorCanvas, { repeat: [2, 2] }),
    // ExtrudeGeometry 的 UV 以米为单位，需要更小的 repeat 密度
    marbleExtrudeWarm: tex(marbleWarmCanvas, { repeat: [0.75, 0.75] }),
    marbleShaftGray: tex(marbleGrayCanvas, { repeat: [1, 12] }),
    // 环带线脚：Cylinder/Torus 的 u 横跨整个圆周（~93m），需要极大的 u repeat
    marbleBandWarm: tex(marbleWarmCanvas, { repeat: [34, 1] }),
    marbleBandHoney: tex(marbleHoneyCanvas, { repeat: [34, 1] }),
    // 光柱纵向渐隐（linear 空间灰度）
    coneFade: tex(makeConeFadeCanvas(), { mirrored: false, srgb: false }),
    glow: tex(glowCanvas, { mirrored: false }),
  };

  const M = {
    // 墙身
    wallWarm: std({ map: T.marbleWallWarm, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.55 }),
    wallHoney: std({ map: T.marbleWallHoney, roughness: 0.34, metalness: 0.0, envMapIntensity: 0.5 }),
    wallGray: std({ map: T.marbleWallGray, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.55 }),
    wallExtrude: std({ map: T.marbleExtrudeWarm, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.55 }),
    shaftStone: std({ map: T.marbleShaftGray, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.55 }),
    // 穹顶
    dome: std({ map: T.marbleDome, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.6, side: THREE.BackSide }),
    // 线脚 / 齿饰 / 藻井框（暖白与蜜色交替层次）
    trimWarm: std({ map: T.marbleWallGray, roughness: 0.26, envMapIntensity: 0.7 }),
    trimHoney: std({ map: T.marbleWallHoney, roughness: 0.28, envMapIntensity: 0.65 }),
    trimDark: std({ map: T.marbleRosso, roughness: 0.35, envMapIntensity: 0.5 }),
    // 金箔
    gold: std({ color: 0xd4af37, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.15 }),
    bronze: std({ color: 0x8a6d2f, metalness: 1.0, roughness: 0.42, envMapIntensity: 0.9 }),
    // 藻井凹入面板（暖石色，凹入有深度但不得读作黑洞）
    cofferPanel: std({ color: 0x8a765c, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 }),
    // 墙板背衬圆筒（只从内侧可见）
    backingStone: std({ map: T.marbleWallHoney, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.4, side: THREE.BackSide }),
    // 石瓮 / 石台
    stone: std({ map: T.marbleWallGray, roughness: 0.5, envMapIntensity: 0.5 }),
    stoneHoney: std({ map: T.marbleWallHoney, roughness: 0.48, envMapIntensity: 0.5 }),
    // 地面
    floorOverlay: std({
      map: T.marbleFloor, roughness: 0.16, metalness: 0.0,
      transparent: true, opacity: 0.84, envMapIntensity: 0.9,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    floorMedallionA: std({ map: T.marbleRosso, roughness: 0.2, envMapIntensity: 0.8 }),
    floorMedallionB: std({ map: T.marbleFloorFine, roughness: 0.2, envMapIntensity: 0.8 }),
    floorMedallionHoney: std({ map: T.marbleWallHoney, roughness: 0.22, envMapIntensity: 0.8 }),
    // 画作
    canvasFace: std({ color: 0xffffff, roughness: 0.85, metalness: 0.0 }),
    backboard: std({ color: 0x2e2418, roughness: 0.8, metalness: 0.0 }),
    plaquePaper: std({ roughness: 0.9, metalness: 0.0 }),
    // 门厅发光板（不受光照，模拟室外天光）
    glowPanel: new THREE.MeshBasicMaterial({ map: T.glow, toneMapped: true }),
  };
  materials.push(M.glowPanel);

  // 双面变体（开口圆柱壳 / 环带等从内侧观看的构件），独立克隆避免污染共享材质
  const ds = (m) => {
    const c = m.clone();
    c.side = THREE.DoubleSide;
    materials.push(c);
    return c;
  };
  M.trimWarmDS = ds(std({ map: T.marbleBandWarm, roughness: 0.26, envMapIntensity: 0.7 }));
  M.trimHoneyDS = ds(std({ map: T.marbleBandHoney, roughness: 0.28, envMapIntensity: 0.65 }));
  M.bandWarm = std({ map: T.marbleBandWarm, roughness: 0.26, envMapIntensity: 0.7 });
  M.stoneHoneyDS = ds(M.stoneHoney);
  M.stoneDS = ds(M.stone);

  function cloneGold() {
    const m = M.gold.clone();
    m.emissive = new THREE.Color(0x000000);
    materials.push(m);
    return m;
  }

  function dispose() {
    for (const t of textures) t.dispose();
    for (const m of materials) m.dispose();
    textures.length = 0;
    materials.length = 0;
  }

  return { T, M, cloneGold, maxAniso, dispose };
}
