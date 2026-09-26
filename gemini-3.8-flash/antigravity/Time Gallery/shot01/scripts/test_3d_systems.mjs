/**
 * 自动化系统自检脚本: 测试 4 大核心 3D 系统在模拟环境下的实例化与运行状态
 */

// 1. 模拟浏览器 Canvas 与 DOM 环境
class MockContext2D {
  createImageData(w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }
  putImageData() {}
  getImageData(x, y, w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  arc() {}
  fillText() {}
  drawImage() {}
}

class MockCanvas {
  constructor(w = 100, h = 100) {
    this.width = w;
    this.height = h;
    this.style = {};
  }
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
  getContext() {
    return new MockContext2D();
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return new MockCanvas();
    return {
      style: {},
      classList: { add() {}, remove() {} },
      appendChild() {},
      removeChild() {},
      addEventListener() {},
      removeEventListener() {},
      parentNode: null
    };
  },
  createElementNS(ns, tag) {
    if (tag === 'img') return { src: '', addEventListener() {}, removeEventListener() {} };
    return this.createElement(tag);
  },
  getElementById() { return null; },
  body: {
    appendChild() {},
    removeChild() {},
    addEventListener() {},
    removeEventListener() {}
  },
  addEventListener() {},
  removeEventListener() {}
};

globalThis.window = globalThis;

console.log('Testing module loading...');

// 动态载入 Three.js
const THREE = await import('../js/libs/three.module.js');

// 导入 4 大核心系统
const {
  createCarraraMarbleTextures,
  createSkyDomeTexture,
  createGoldLeafTextures,
  createBrassNameplateTexture,
  createPaintingPlaceholderTexture
} = await import('../js/systems/ProceduralTextures.js');

const { FirstPersonControls } = await import('../js/systems/FirstPersonControls.js');
const { GalleryScene } = await import('../js/systems/GalleryScene.js');
const { FrameManager } = await import('../js/systems/FrameManager.js');
const { ART_PERIODS } = await import('../js/data/artHistoryData.js');

console.log('✓ All 4 modules imported successfully!');

// 测试 1: 程序化贴图生成
console.log('Testing ProceduralTextures...');
const marble = createCarraraMarbleTextures({ width: 64, height: 64 });
if (!marble.diffuse || !marble.roughness || !marble.normal) throw new Error('Marble textures missing');

const sky = createSkyDomeTexture({ width: 64, height: 32 });
if (!sky) throw new Error('Sky texture missing');

const gold = createGoldLeafTextures({ width: 64, height: 64 });
if (!gold.diffuse || !gold.roughness || !gold.bump) throw new Error('Gold textures missing');

const nameplate = createBrassNameplateTexture({ titleZh: '测试', titleEn: 'Test' });
if (!nameplate) throw new Error('Nameplate texture missing');

const placeholder = createPaintingPlaceholderTexture({ titleZh: '测试', titleEn: 'Test' });
if (!placeholder) throw new Error('Placeholder texture missing');

console.log('✓ ProceduralTextures passed!');

// 测试 2: GalleryScene 构造
console.log('Testing GalleryScene...');
const scene = new THREE.Scene();
const gallery = new GalleryScene({ scene, radius: 18.0, wallHeight: 14.0, bayCount: 8 });

const anchors = gallery.getAllBayAnchors();
if (anchors.length !== 8) throw new Error(`Expected 8 anchors, got ${anchors.length}`);
console.log(`✓ GalleryScene built with ${anchors.length} bay anchors!`);

// 测试 3: FrameManager 自适应宽高比挂载
console.log('Testing FrameManager...', 'ART_PERIODS length:', ART_PERIODS?.length, 'anchors length:', anchors?.length);
const frameManager = new FrameManager({ scene: gallery.roomGroup });
const mounted = frameManager.mountPaintings(ART_PERIODS, anchors);
console.log('Mounted count:', mounted.length);
if (mounted.length !== 8) throw new Error(`Expected 8 mounted paintings, got ${mounted.length}`);

for (const p of mounted) {
  const data = p.data;
  const canvasMesh = p.canvasMesh;
  const w = canvasMesh.geometry.parameters.width;
  const h = canvasMesh.geometry.parameters.height;
  const computedAr = w / h;
  const expectedAr = data.aspectRatio;
  const diff = Math.abs(computedAr - expectedAr);
  if (diff > 0.01) {
    throw new Error(`Aspect ratio mismatch for ${data.id}: expected ${expectedAr}, got ${computedAr}`);
  }
  console.log(`  - ${data.id}: ar=${expectedAr.toFixed(2)}, size=${w.toFixed(2)}x${h.toFixed(2)} (diff=${diff.toFixed(4)})`);
}
console.log('✓ FrameManager adaptive aspect ratios verified perfectly!');

// 测试 4: FirstPersonControls 方向控制与射线
console.log('Testing FirstPersonControls...');
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -10); // 视线朝向 -Z

const domMock = document.createElement('canvas');
const controls = new FirstPersonControls(camera, domMock, {
  maxRadius: 16.2,
  walkSpeed: 8.0,
  damping: 10.0
});
controls.setInteractiveObjects(frameManager.getInteractiveObjects());

// 测试前进 (W)
controls.keys.KeyW = true;
controls.update(0.1);
controls.keys.KeyW = false;
console.log(`  Forward pos: x=${camera.position.x.toFixed(3)}, z=${camera.position.z.toFixed(3)} (z should be negative)`);
if (camera.position.z >= 0) throw new Error('KeyW should move camera forward in -Z direction');

// 复位
camera.position.set(0, 1.7, 0);
controls.velocity.set(0, 0, 0);

// 测试后退 (S)
controls.keys.KeyS = true;
controls.update(0.1);
controls.keys.KeyS = false;
console.log(`  Backward pos: x=${camera.position.x.toFixed(3)}, z=${camera.position.z.toFixed(3)} (z should be positive)`);
if (camera.position.z <= 0) throw new Error('KeyS should move camera backward in +Z direction');

// 复位
camera.position.set(0, 1.7, 0);
controls.velocity.set(0, 0, 0);

// 测试向右平移 (D)
controls.keys.KeyD = true;
controls.update(0.1);
controls.keys.KeyD = false;
console.log(`  Strafe Right pos: x=${camera.position.x.toFixed(3)}, z=${camera.position.z.toFixed(3)} (x should be positive)`);
if (camera.position.x <= 0) throw new Error('KeyD should move camera right in +X direction');

// 复位
camera.position.set(0, 1.7, 0);
controls.velocity.set(0, 0, 0);

// 测试向左平移 (A)
controls.keys.KeyA = true;
controls.update(0.1);
controls.keys.KeyA = false;
console.log(`  Strafe Left pos: x=${camera.position.x.toFixed(3)}, z=${camera.position.z.toFixed(3)} (x should be negative)`);
if (camera.position.x >= 0) throw new Error('KeyA should move camera left in -X direction');

// 边缘碰撞测试
camera.position.set(25.0, 1.7, 0);
controls.update(0.016);
const clampedDist = Math.hypot(camera.position.x, camera.position.z);
console.log(`  Perimeter collision clamped distance: ${clampedDist.toFixed(2)}m (max=${controls.maxRadius}m)`);
if (clampedDist > controls.maxRadius + 0.01) throw new Error('Camera walked through rotunda wall!');

controls.dispose();
gallery.dispose();
frameManager.dispose();

console.log('\n========================================');
console.log('🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================');
