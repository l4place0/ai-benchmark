/**
 * 时光画廊 (Time Gallery) - 程序化纹理生成系统 (ProceduralTextures.js)
 * 1. 卡拉拉白大理石 (Carrara Marble): 漫反射、粗糙度、法线贴图 (2D Canvas 柏林/裂纹噪声)
 * 2. 万神殿天窗天穹 (Sky Dome Texture): 大气色阶渐变、自然云彩、温暖太阳光晕 (保证零黑洞、零外部依赖)
 * 3. 仿古镀金青铜/金箔 (Gold Leaf / Gilded Bronze): 拉丝金属、凹凸贴图、铜牌标牌贴图
 */

import * as THREE from 'three';

// ============================================================================
// 高性能程序化噪声引擎 (Fast 2D Gradient Noise + Fractional Brownian Motion)
// ============================================================================

class NoiseEngine {
  constructor(seed = 42) {
    this.p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;

    // LCG 伪随机打乱
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 11) % 2147483647;
      const j = s % (i + 1);
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
    }
  }

  // 五次平滑插值 (Ken Perlin's quintic polynomial)
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));
    return this.lerp(v, x1, x2) * 0.5 + 0.5; // 归一化至 [0, 1]
  }

  fbm(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let sum = 0, amp = 1.0, freq = 1.0, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      maxAmp += amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return sum / maxAmp;
  }
}

const defaultNoise = new NoiseEngine(1024);

// ============================================================================
// 1. 卡拉拉大理石贴图生成 (Carrara Marble PBR Textures)
// ============================================================================

/**
 * 生成卡拉拉白大理石全套 PBR 纹理 (Diffuse, Roughness, Normal)
 * @param {Object} options
 * @param {number} options.width 纹理宽度 (默认 1024)
 * @param {number} options.height 纹理高度 (默认 1024)
 * @param {number} options.scale 纹理缩放倍数
 * @returns {{ diffuse: THREE.CanvasTexture, roughness: THREE.CanvasTexture, normal: THREE.CanvasTexture }}
 */
export function createCarraraMarbleTextures(options = {}) {
  const width = options.width || 1024;
  const height = options.height || 1024;
  const scale = options.scale || 3.2;

  // 1. 计算高度/裂纹场 (Height / Vein Field)
  const heightData = new Float32Array(width * height);
  const noise = defaultNoise;

  for (let y = 0; y < height; y++) {
    const ny = (y / height) * scale;
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * scale;

      // 坐标域扭曲 (Domain Warping) 模拟大理石熔融挤压流变
      const qx = noise.fbm(nx * 1.8, ny * 1.8, 3, 2.0, 0.5);
      const qy = noise.fbm(nx * 1.8 + 4.3, ny * 1.8 + 2.8, 3, 2.0, 0.5);

      const rx = noise.fbm(nx * 2.2 + 3.5 * qx + 1.2, ny * 2.2 + 3.5 * qy + 2.3, 4, 2.0, 0.5);
      const ry = noise.fbm(nx * 2.2 + 3.5 * qx + 8.1, ny * 2.2 + 3.5 * qy + 6.4, 4, 2.0, 0.5);

      // 大理石主裂纹波形
      const veinCoord = (nx * 2.5 + ny * 1.8) + (rx * 4.2 + ry * 3.8);
      const sinWave = Math.sin(veinCoord * 3.14159);
      
      // 尖锐裂隙衰减 (Sharp dendritic veins)
      let vein = 1.0 - Math.pow(Math.abs(sinWave), 0.35);
      vein = Math.max(0, (vein - 0.25) / 0.75);

      // 次级微细裂隙 (Fine veinlets)
      const fineNoise = noise.fbm(nx * 8.0 + rx * 2.0, ny * 8.0 + ry * 2.0, 3, 2.2, 0.45);
      const fineVein = Math.pow(fineNoise, 2.8) * 0.45;

      // 柔和烟雾云斑 (Soft smoky calcite clouds)
      const cloud = noise.fbm(nx * 1.2, ny * 1.2, 3, 2.0, 0.5);

      // 组合高度场 (0 = 平坦石面, 1 = 裂隙凹陷)
      const h = Math.min(1.0, vein * 0.75 + fineVein * 0.4 + cloud * 0.15);
      heightData[y * width + x] = h;
    }
  }

  // 2. 漫反射画布 (Diffuse Canvas)
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const diffCtx = diffCanvas.getContext('2d');
  const diffImgData = diffCtx.createImageData(width, height);
  const diffData = diffImgData.data;

  // 3. 粗糙度画布 (Roughness Canvas)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImgData = roughCtx.createImageData(width, height);
  const roughData = roughImgData.data;

  // 4. 法线贴图画布 (Normal Canvas - Sobel 算子)
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width;
  normCanvas.height = height;
  const normCtx = normCanvas.getContext('2d');
  const normImgData = normCtx.createImageData(width, height);
  const normData = normImgData.data;

  // 颜色基调: 意大利卡拉拉白大理石 (Carrara Bianco)
  // 基底: 暖象牙白 (248, 246, 242) ~ 纯净乳白 (253, 252, 250)
  // 浅灰纹理: (185, 180, 174)
  // 核心深色裂隙: (95, 92, 88)
  // 金色/琥珀微光杂质 (Calacatta Gold accents): (210, 185, 140)

  const normalStrength = 2.4;

  for (let y = 0; y < height; y++) {
    const yPrev = (y - 1 + height) % height;
    const yNext = (y + 1) % height;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x);
      const pIdx = idx * 4;
      const h = heightData[idx];

      const xPrev = (x - 1 + width) % width;
      const xNext = (x + 1) % width;

      // 漫反射颜色插值
      let r = 248 - h * 150;
      let g = 246 - h * 152;
      let b = 242 - h * 154;

      // 细微琥珀金箔矿脉点缀
      if (h > 0.4 && h < 0.75) {
        const goldWeight = Math.sin((h - 0.4) / 0.35 * Math.PI) * 0.25;
        r = r * (1 - goldWeight) + 215 * goldWeight;
        g = g * (1 - goldWeight) + 185 * goldWeight;
        b = b * (1 - goldWeight) + 135 * goldWeight;
      }

      diffData[pIdx] = Math.max(0, Math.min(255, r));
      diffData[pIdx + 1] = Math.max(0, Math.min(255, g));
      diffData[pIdx + 2] = Math.max(0, Math.min(255, b));
      diffData[pIdx + 3] = 255;

      // 粗糙度: 高光抛光石基面为低粗糙度 (0.16 左右)，裂隙微糙 (0.35 左右)
      const roughnessVal = Math.round((0.15 + h * 0.22) * 255);
      roughData[pIdx] = roughnessVal;
      roughData[pIdx + 1] = roughnessVal;
      roughData[pIdx + 2] = roughnessVal;
      roughData[pIdx + 3] = 255;

      // 法线向量计算 (Sobel 梯度)
      const dX = (heightData[y * width + xNext] - heightData[y * width + xPrev]) * normalStrength;
      const dY = (heightData[yNext * width + x] - heightData[yPrev * width + x]) * normalStrength;
      const dZ = 1.0;

      const len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
      const nx = -dX / len;
      const ny = -dY / len;
      const nz = dZ / len;

      normData[pIdx] = Math.round((nx * 0.5 + 0.5) * 255);
      normData[pIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normData[pIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normData[pIdx + 3] = 255;
    }
  }

  diffCtx.putImageData(diffImgData, 0, 0);
  roughCtx.putImageData(roughImgData, 0, 0);
  normCtx.putImageData(normImgData, 0, 0);

  // 构建 Three.js CanvasTexture
  const diffuseTexture = new THREE.CanvasTexture(diffCanvas);
  diffuseTexture.wrapS = THREE.RepeatWrapping;
  diffuseTexture.wrapT = THREE.RepeatWrapping;
  diffuseTexture.colorSpace = THREE.SRGBColorSpace;
  diffuseTexture.needsUpdate = true;

  const roughnessTexture = new THREE.CanvasTexture(roughCanvas);
  roughnessTexture.wrapS = THREE.RepeatWrapping;
  roughnessTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.colorSpace = THREE.NoColorSpace;
  roughnessTexture.needsUpdate = true;

  const normalTexture = new THREE.CanvasTexture(normCanvas);
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.colorSpace = THREE.NoColorSpace;
  normalTexture.needsUpdate = true;

  return { diffuse: diffuseTexture, roughness: roughnessTexture, normal: normalTexture };
}

// ============================================================================
// 2. 万神殿地板古典拼花纹理 (Inlaid Pantheon Marble Floor)
// ============================================================================

/**
 * 生成万神殿风格古典抛光镶嵌大理石地板纹理
 * 包含卡拉拉白石、维罗纳红石与金线铜嵌条网格
 */
export function createFloorMarbleTextures(options = {}) {
  const width = options.width || 1024;
  const height = options.height || 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 底色：深灰黑金波特罗大理石 (Portoro marble)
  ctx.fillStyle = '#1c1e22';
  ctx.fillRect(0, 0, width, height);

  // 绘制万神殿经典几何镶嵌方格 (Checkerboard & Round Medallions)
  const tileSize = width / 8;
  const noise = defaultNoise;

  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const isAlt = (tx + ty) % 2 === 0;
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;

      // 边框留缝 (铜嵌条间距)
      const inset = 3;
      const tw = tileSize - inset * 2;
      const th = tileSize - inset * 2;

      if (isAlt) {
        // 卡拉拉白色大理石方砖
        const grad = ctx.createLinearGradient(x0, y0, x0 + tw, y0 + th);
        grad.addColorStop(0, '#f2ede4');
        grad.addColorStop(0.5, '#eae4d8');
        grad.addColorStop(1, '#dfd7c9');
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + inset, y0 + inset, tw, th);

        // 内嵌圆形图案 (万神殿经典斑岩圆盘)
        ctx.fillStyle = '#6e382b'; // 斑岩红 (Porfido Rosso)
        ctx.beginPath();
        ctx.arc(x0 + tileSize / 2, y0 + tileSize / 2, tileSize * 0.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d4af37'; // 铜圈边框
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // 深绿色/黑色大理石方砖 (Verde Antico / Nero Marquina)
        const grad = ctx.createLinearGradient(x0, y0, x0 + tw, y0 + th);
        grad.addColorStop(0, '#222826');
        grad.addColorStop(0.5, '#1b201e');
        grad.addColorStop(1, '#151917');
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + inset, y0 + inset, tw, th);

        // 菱形小嵌片
        ctx.fillStyle = '#dcd5c7';
        ctx.beginPath();
        const cx = x0 + tileSize / 2;
        const cy = y0 + tileSize / 2;
        const r = tileSize * 0.25;
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#96781b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // 整体覆盖大理石流变纹理
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let y = 0; y < height; y++) {
    const ny = y * 0.01;
    for (let x = 0; x < width; x++) {
      const nx = x * 0.01;
      const idx = (y * width + x) * 4;
      const v = noise.fbm(nx, ny, 3, 2.0, 0.5) * 20 - 10;
      data[idx] = Math.max(0, Math.min(255, data[idx] + v));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + v));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + v));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

// ============================================================================
// 3. 万神殿天窗天穹全景贴图 (Realistic Procedural Sky Dome for Oculus)
// ============================================================================

/**
 * 生成天穹天窗 (Oculus) 专用的大气天幕纹理
 * 从穹顶天窗往外看：天蓝渐变、地中海明媚日光与柔和飘云 (绝不产生黑洞)
 * @param {Object} options
 * @param {number} options.width 纹理宽度 (默认 1024)
 * @param {number} options.height 纹理高度 (默认 512)
 * @returns {THREE.CanvasTexture}
 */
export function createSkyDomeTexture(options = {}) {
  const width = options.width || 1024;
  const height = options.height || 512;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. 真实大气色彩梯度 (Rayleigh & Mie Scattering Palette)
  // 天顶 (Zenith, y=0): 深邃蔚蓝 #1b539c
  // 天空高层 (y=0.3): 蔚蓝天光 #3a85db
  // 中层 (y=0.65): 明媚淡青蓝 #7ebae8
  // 地平线边缘 (y=1.0): 温暖霞光与雾霭 #faecd7
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0.0, '#154e96');
  skyGrad.addColorStop(0.25, '#2973cc');
  skyGrad.addColorStop(0.55, '#5ea8ea');
  skyGrad.addColorStop(0.82, '#9bd0f7');
  skyGrad.addColorStop(1.0, '#fbeef0');

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. 温暖太阳与强烈日晕 (Warm Sun & Solar Flare)
  // 位于天窗仰视可见区域 (约 X=65%, Y=32%)，与主平行光朝向严格对应
  const sunX = width * 0.65;
  const sunY = height * 0.32;

  // 广域大气散射光晕 (Broad atmospheric glow)
  const haloGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, width * 0.45);
  haloGrad.addColorStop(0.0, 'rgba(255, 248, 220, 0.7)');
  haloGrad.addColorStop(0.15, 'rgba(255, 235, 175, 0.45)');
  haloGrad.addColorStop(0.45, 'rgba(255, 215, 140, 0.18)');
  haloGrad.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');
  ctx.fillStyle = haloGrad;
  ctx.fillRect(0, 0, width, height);

  // 太阳内圈光冕 (Solar Corona)
  const coronaGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
  coronaGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  coronaGrad.addColorStop(0.2, 'rgba(255, 252, 235, 0.95)');
  coronaGrad.addColorStop(0.5, 'rgba(255, 230, 160, 0.65)');
  coronaGrad.addColorStop(1.0, 'rgba(255, 210, 120, 0.0)');
  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
  ctx.fill();

  // 3. 细腻程序化卷云与积云 (Procedural Clouds)
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const noise = defaultNoise;

  for (let y = 0; y < height; y++) {
    const ny = (y / height);
    for (let x = 0; x < width; x++) {
      const nx = (x / width);
      const idx = (y * width + x) * 4;

      // 云层分布在天空不同高度，靠近地平线处拉长透视
      const cloudNoise = noise.fbm(nx * 5.0, ny * 3.5, 4, 2.1, 0.48);
      const cloudWarp = noise.fbm(nx * 10.0 + cloudNoise * 2.0, ny * 8.0, 3, 2.0, 0.5);

      // 云量阈值切分 (Thresholding with smooth feathering)
      let cloudDensity = (cloudWarp - 0.48) / 0.32;
      cloudDensity = Math.max(0, Math.min(1, cloudDensity));

      if (cloudDensity > 0) {
        // 计算与太阳的夹角距离，给予向阳面白亮受光与背阳面漫射蓝
        const dx = (x - sunX) / width;
        const dy = (y - sunY) / height;
        const distSun = Math.sqrt(dx * dx + dy * dy);
        const sunHighlight = Math.max(0, 1.0 - distSun * 2.2);

        // 云彩亮部 (纯白偏金)
        const cr = 245 + sunHighlight * 10;
        const cg = 245 + sunHighlight * 8;
        const cb = 250 - sunHighlight * 20;

        const alpha = cloudDensity * 0.65;
        data[idx] = Math.round(data[idx] * (1 - alpha) + cr * alpha);
        data[idx + 1] = Math.round(data[idx + 1] * (1 - alpha) + cg * alpha);
        data[idx + 2] = Math.round(data[idx + 2] * (1 - alpha) + cb * alpha);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

// ============================================================================
// 4. 古典镀金金箔 / 青铜金属材质贴图 (Gold Leaf & Brushed Bronze Textures)
// ============================================================================

/**
 * 生成画框与雕花线脚专用的古典金箔 PBR 贴图
 * @param {Object} options
 * @returns {{ diffuse: THREE.CanvasTexture, roughness: THREE.CanvasTexture, bump: THREE.CanvasTexture }}
 */
export function createGoldLeafTextures(options = {}) {
  const width = options.width || 512;
  const height = options.height || 512;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 古典金箔底色基调：富丽而典雅 (Antique Gold: #d4af37, #f3e5ab, #8c6f2d)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0.0, '#e8ca68');
  grad.addColorStop(0.35, '#d4af37');
  grad.addColorStop(0.7, '#f5e29f');
  grad.addColorStop(1.0, '#9e7b23');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 细致横向金属拉丝与微孔斑驳 (Brushed streaks & micro-leaf texture)
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const noise = defaultNoise;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // 水平拉丝细纹
      const streak = (Math.sin(y * 0.8) + (Math.random() - 0.5) * 0.5) * 8;
      const grain = noise.fbm(x * 0.08, y * 0.02, 3, 2.0, 0.5) * 24 - 12;
      const val = streak + grain;

      data[idx] = Math.max(0, Math.min(255, data[idx] + val));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + val * 0.85));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + val * 0.5));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const diffuseTexture = new THREE.CanvasTexture(canvas);
  diffuseTexture.wrapS = THREE.RepeatWrapping;
  diffuseTexture.wrapT = THREE.RepeatWrapping;
  diffuseTexture.colorSpace = THREE.SRGBColorSpace;
  diffuseTexture.needsUpdate = true;

  // 粗糙度画布 (金属度保持 0.85，粗糙度约 0.28~0.38)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d');
  roughCtx.fillStyle = '#525252'; // ~0.32
  roughCtx.fillRect(0, 0, width, height);

  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  roughTexture.wrapS = THREE.RepeatWrapping;
  roughTexture.wrapT = THREE.RepeatWrapping;
  roughTexture.colorSpace = THREE.NoColorSpace;
  roughTexture.needsUpdate = true;

  // 凹凸贴图画布 (微弱拉丝凹凸)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d');
  bumpCtx.drawImage(canvas, 0, 0);

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.needsUpdate = true;

  return { diffuse: diffuseTexture, roughness: roughTexture, bump: bumpTexture };
}

// ============================================================================
// 5. 博物馆黄铜艺术说明牌贴图 (Museum Brass Nameplate)
// ============================================================================

/**
 * 绘制高分辨率黄铜展签铭牌纹理
 * @param {Object} info 画作元数据
 * @param {string} info.titleZh 中文标题
 * @param {string} info.titleEn 英文标题
 * @param {string} info.artistZh 中文艺术家
 * @param {string} info.artistEn 英文艺术家
 * @param {string} info.year 创作年份
 * @param {string} info.periodZh 时期名称
 * @returns {THREE.CanvasTexture}
 */
export function createBrassNameplateTexture(info = {}) {
  const width = 1024;
  const height = 300;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. 深调沉稳拉丝青铜板底色 (Dark Antique Brass Plaque)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0.0, '#2b2316');
  bgGrad.addColorStop(0.2, '#382e1c');
  bgGrad.addColorStop(0.5, '#453822');
  bgGrad.addColorStop(0.8, '#332918');
  bgGrad.addColorStop(1.0, '#241b10');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. 金属拉丝质感条纹
  ctx.fillStyle = 'rgba(212, 175, 55, 0.04)';
  for (let i = 0; i < height; i += 2) {
    if (Math.random() > 0.4) {
      ctx.fillRect(0, i, width, 1);
    }
  }

  // 3. 古典双金线雕刻边框 (Double Gilded Inset Border)
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 16, width - 36, height - 32);

  ctx.strokeStyle = 'rgba(245, 228, 168, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 24, width - 52, height - 48);

  // 四角金铆钉装饰 (Corner Rivets)
  const rivets = [
    [22, 20], [width - 22, 20],
    [22, height - 20], [width - 22, height - 20]
  ];
  ctx.fillStyle = '#f3e5ab';
  for (const [rx, ry] of rivets) {
    ctx.beginPath();
    ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#856417';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 4. 文字排版：纯正古典博物馆镌刻字体规范
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 时期小标 (Tag)
  const periodText = info.periodZh ? `✦  ${info.periodZh.toUpperCase()}  ✦` : 'WESTERN ART HISTORY';
  ctx.font = '600 20px "Cinzel", "Songti SC", "SimSun", serif';
  ctx.fillStyle = '#bfa15f';
  ctx.fillText(periodText, width / 2, 58);

  // 中文画作主标题 (大号沉稳加粗)
  const titleZh = info.titleZh || info.title || '传世经典名作';
  ctx.font = 'bold 44px "Cinzel", "Noto Serif SC", "Songti SC", "SimSun", serif';
  // 镌刻阴影效果
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText(titleZh, width / 2 + 1.5, 114 + 1.5);
  // 金箔字面
  ctx.fillStyle = '#fff4ce';
  ctx.fillText(titleZh, width / 2, 114);

  // 英文副标题与年代 (Italic / Serif)
  const titleEn = info.titleEn ? `${info.titleEn}  •  ${info.year || ''}` : (info.year || '');
  ctx.font = 'italic 24px "Cinzel", "Times New Roman", serif';
  ctx.fillStyle = '#dfcf9f';
  ctx.fillText(titleEn, width / 2, 172);

  // 艺术家大师名称 (中英对照)
  const artistText = (info.artistZh || '') + (info.artistEn ? `  /  ${info.artistEn}` : '');
  ctx.font = '500 22px "Noto Serif SC", "Songti SC", "Cinzel", serif';
  ctx.fillStyle = '#f0dfab';
  ctx.fillText(artistText, width / 2, 226);

  // 底部装饰金线
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, 258);
  ctx.lineTo(width / 2 + 140, 258);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

// ============================================================================
// 6. 画作备用程序化画布贴图 (Stylized Masterpiece Fallback Canvas)
// ============================================================================

/**
 * 当画作图片仍在加载中或离线时，展示典雅高规格的古典油画色泽画布
 * 杜绝任何黑块或白块破损！
 */
export function createPaintingPlaceholderTexture(info = {}, width = 1024, height = 768) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 油画厚涂底色 (暖调暗褐与古典金棕暗角)
  const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.7);
  grad.addColorStop(0.0, '#363028');
  grad.addColorStop(0.6, '#231e19');
  grad.addColorStop(1.0, '#120f0c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 织布亚麻布纹 (Linen Canvas Weave Simulation)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
  for (let x = 0; x < width; x += 4) {
    ctx.fillRect(x, 0, 1, height);
  }

  // 艺术馆馆藏水印边框
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // 中心徽标与典雅标题
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '600 24px "Cinzel", serif';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.75)';
  ctx.fillText('✦  TIME GALLERY COLLECTION  ✦', width / 2, height / 2 - 80);

  const titleZh = info.titleZh || info.title || '艺术大师传世画作';
  ctx.font = 'bold 50px "Noto Serif SC", "Songti SC", serif';
  ctx.fillStyle = '#f8f4ea';
  ctx.fillText(titleZh, width / 2, height / 2 - 10);

  const titleEn = info.titleEn || '';
  ctx.font = 'italic 26px "Cinzel", "Times New Roman", serif';
  ctx.fillStyle = '#c5bea9';
  ctx.fillText(titleEn, width / 2, height / 2 + 50);

  const artist = (info.artistZh || '') + (info.artistEn ? ` · ${info.artistEn}` : '');
  ctx.font = '22px "Noto Serif SC", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(artist, width / 2, height / 2 + 105);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

// ============================================================================
// 全局贴图单例缓存 (Texture Cache)
// ============================================================================

let cachedMarbleTextures = null;
let cachedSkyTexture = null;
let cachedGoldTextures = null;
let cachedFloorTexture = null;

export function getSharedCarraraMarbleTextures() {
  if (!cachedMarbleTextures) {
    cachedMarbleTextures = createCarraraMarbleTextures();
  }
  return cachedMarbleTextures;
}

export function getSharedSkyDomeTexture() {
  if (!cachedSkyTexture) {
    cachedSkyTexture = createSkyDomeTexture();
  }
  return cachedSkyTexture;
}

export function getSharedGoldLeafTextures() {
  if (!cachedGoldTextures) {
    cachedGoldTextures = createGoldLeafTextures();
  }
  return cachedGoldTextures;
}

export function getSharedFloorTexture() {
  if (!cachedFloorTexture) {
    cachedFloorTexture = createFloorMarbleTextures();
  }
  return cachedFloorTexture;
}
