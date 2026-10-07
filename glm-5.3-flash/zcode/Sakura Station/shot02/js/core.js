/* ============================================================
 * core.js — 渲染基座 / 三渲二材质 / 通用工具 / 相机控制
 * Sakura Station shot02
 * ============================================================ */
"use strict";

/* ---------- 颜色管理：开启 sRGB 正确管线 ---------- */
THREE.ColorManagement.legacyMode = false;

/* ---------- 确定性随机（固定种子，保证每次打开场景一致） ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260403);
const rr  = (a, b) => a + (b - a) * rng();
const rr2 = rr;   // canvas 绘制内的别名
const ri  = (a, b) => Math.floor(rr(a, b + 0.999999));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

/* ---------- 全局调色板 ---------- */
const PAL = {
  outline:   0x332a35,
  skyTop:    0x5aa8e8,
  skyMid:    0x9fd2f0,
  skyLow:    0xd9edf5,
  sunGlow:   0xffe6bb,
  fog:       0xd5e9f2,
  sunCol:    0xfff1d6,
  hemiSky:   0xb9d7f2,
  hemiGnd:   0xd9ccb9,

  road:      0x69707a,
  roadDark:  0x585f6a,
  curb:      0xc2c6c9,
  sidewalk:  0xb4b8bd,
  lineWhite: 0xf2f3f0,

  platConcrete: 0xccd0d3,
  tactile:      0xe6b83a,
  gravelA:      0x8d8d8a,
  gravelB:      0x7a7268,
  gravelC:      0x9d968a,
  sleeper:      0x4d3f34,
  railSide:     0x6f757c,
  railTop:      0xd6dde2,

  trainBody:  0xf3efe4,
  trainStripe:0xf0a2b8,
  trainRoof:  0x8b949d,
  trainSkirt: 0x3c4048,
  trainGlass: 0x8fa9bd,

  leaf:       0x9dc17c,
  leafDark:   0x7da86a,
  trunk:      0x5c4a3e,
  sakura1:    0xffe4ec,   // 近白浅粉
  sakura2:    0xffb9cf,   // 柔和樱花粉
  sakura3:    0xff9fbb,   // 桃粉
  sakura4:    0xe87e9e,   // 花蕊深粉
  sakuraBack: 0xd9a8c4,   // 背光淡紫灰

  wallCream:  0xf0e8d6,
  wallWhite:  0xf4f2ea,
  wallBlue:   0xd9e4e7,
  wallBeige:  0xe7dcc6,
  wallWood:   0xb08a63,
  roofGray:   0x6a7480,
  roofBlue:   0x5d6a78,
  roofGreen:  0x5c6b62,
  roofDark:   0x54565e,

  signBlue:   0x2e6cb0,
  signRed:    0xc4393c,
  vendingRed: 0xd9585a,
  vendingBlue:0x4d7fc4,
  vendingWhite:0xf0f2ee,
  vendingGreen:0x69a97e,

  water:      0x8fc3d9,
  hill:       0xa9c3cf,
  hillFar:    0xbdd4dc,
};

/* ---------- 渲染器 / 场景 / 相机 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 90, 300);

const camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(15.5, 4.6, 42);

/* ---------- 光照：春日午后 4 点，阳光自侧后方斜射 ---------- */
const sun = new THREE.DirectionalLight(PAL.sunCol, 1.28);
sun.position.set(-46, 58, 42);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 8;
sun.shadow.camera.far = 190;
sun.shadow.camera.left = -62;
sun.shadow.camera.right = 62;
sun.shadow.camera.top = 62;
sun.shadow.camera.bottom = -62;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xc3d7ec, PAL.hemiGnd, 0.55);
scene.add(hemi);

/* 相机一侧补一点冷色环境光，避免阴影死黑 */
const fill = new THREE.DirectionalLight(0xcfe2f4, 0.22);
fill.position.set(38, 20, 52);
scene.add(fill);

/* ---------- 卡通材质 ---------- */
const _toonCache = new Map();
let _gradientMap = null;
function gradientMap4() {
  if (_gradientMap) return _gradientMap;
  const steps = [0.52, 0.72, 0.9, 1.0];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255); data[i * 4 + 3] = 255; });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradientMap = tex;
  return tex;
}
/** 获取（并缓存）卡通材质 */
function toon(color, opt) {
  opt = opt || {};
  const key = "t_" + color + "_" + (opt.emissive || 0) + "_" + (opt.ei || 0) + "_" +
              (opt.side || 0) + "_" + (opt.opa || 1) + "_" + (opt.map ? opt.map.uuid : 0) +
              "_" + (opt.flat ? 1 : 0);
  if (_toonCache.has(key)) return _toonCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color: color,
    gradientMap: gradientMap4(),
    side: opt.side || THREE.FrontSide,
    transparent: (opt.opa !== undefined && opt.opa < 1),
    opacity: opt.opa === undefined ? 1 : opt.opa,
  });
  if (opt.emissive) { m.emissive = new THREE.Color(opt.emissive); m.emissiveIntensity = opt.ei || 1; }
  if (opt.map) m.map = opt.map;
  if (opt.flat) m.flatShading = true;
  _toonCache.set(key, m);
  return m;
}
function basic(color, opt) {
  opt = opt || {};
  const key = "b_" + color + "_" + (opt.side || 0) + "_" + (opt.opa || 1) + "_" + (opt.map ? opt.map.uuid : 0) + "_" + (opt.fog ? 1 : 0);
  if (_toonCache.has(key)) return _toonCache.get(key);
  const m = new THREE.MeshBasicMaterial({
    color, side: opt.side || THREE.FrontSide,
    transparent: opt.opa !== undefined && opt.opa < 1,
    opacity: opt.opa === undefined ? 1 : opt.opa,
    map: opt.map || null,
    fog: opt.fog !== false,
  });
  _toonCache.set(key, m);
  return m;
}

/* ---------- 描边（反向外壳，恒定世界厚度） ---------- */
const _outlineMats = new Map();
function outlineMat(width, color) {
  const key = width + "_" + color;
  if (_outlineMats.has(key)) return _outlineMats.get(key);
  const mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.BackSide, fog: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOW = { value: width };
    shader.vertexShader = "uniform float uOW;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  transformed += normalize(normal) * uOW;"
    );
  };
  mat.customProgramCacheKey = () => "outline_" + width + "_" + color;
  _outlineMats.set(key, mat);
  return mat;
}
/** 给 mesh 加描边外壳；width 为世界单位厚度 */
function outline(mesh, width, color) {
  const w = width === undefined ? 0.03 : width;
  const o = new THREE.Mesh(mesh.geometry, outlineMat(w, color === undefined ? PAL.outline : color));
  o.castShadow = false; o.receiveShadow = false;
  mesh.add(o);
  return o;
}

/* ---------- 通用几何工具 ---------- */
function box(w, h, d, mat, x, y, z, opt) {
  opt = opt || {};
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (opt.ry) m.rotation.y = opt.ry;
  if (opt.rx) m.rotation.x = opt.rx;
  if (opt.rz) m.rotation.z = opt.rz;
  m.castShadow = opt.cs !== false;
  m.receiveShadow = opt.rs !== false;
  return m;
}
function cyl(rt, rb, h, seg, mat, x, y, z, opt) {
  opt = opt || {};
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (opt.rx) m.rotation.x = opt.rx;
  if (opt.rz) m.rotation.z = opt.rz;
  if (opt.ry) m.rotation.y = opt.ry;
  m.castShadow = opt.cs !== false;
  m.receiveShadow = opt.rs !== false;
  return m;
}
function sph(r, mat, x, y, z, opt) {
  opt = opt || {};
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, opt.seg || 12, opt.seg2 || 8), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (opt.sx || opt.sy || opt.sz) m.scale.set(opt.sx || 1, opt.sy || 1, opt.sz || 1);
  m.castShadow = opt.cs !== false;
  m.receiveShadow = opt.rs !== false;
  return m;
}
function plane(w, h, mat, x, y, z, opt) {
  opt = opt || {};
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (opt.rx) m.rotation.x = opt.rx;
  if (opt.ry) m.rotation.y = opt.ry;
  if (opt.rz) m.rotation.z = opt.rz;
  m.castShadow = opt.cs || false;
  m.receiveShadow = opt.rs !== false;
  return m;
}
function group(x, y, z, ry) {
  const g = new THREE.Group();
  if (x !== undefined) g.position.set(x, y || 0, z || 0);
  if (ry) g.rotation.y = ry;
  return g;
}

/* ---------- Canvas 文字贴图 ---------- */
const FONT_JP = '"Yu Gothic","Yu Gothic UI","Meiryo","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
const FONT_HAND = '"Segoe Print","Hiragino Maru Gothic ProN","Yu Gothic",cursive,sans-serif';
function canvasTex(w, h, draw, opt) {
  opt = opt || {};
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, w, h); }
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.repeat[0], opt.repeat[1]); }
  return t;
}

/* ---------- 高度补丁（漫游模式脚底高度） ---------- */
const GroundPatches = [];
function registerGround(x1, x2, z1, z2, y) { GroundPatches.push({ x1, x2, z1, z2, y }); }
function groundHeight(x, z) {
  let h = 0;
  for (const p of GroundPatches) {
    if (x >= p.x1 && x <= p.x2 && z >= p.z1 && z <= p.z2) h = Math.max(h, p.y);
  }
  return h;
}

/* ---------- 架空线缆仓库（合并为一个 LineSegments） ---------- */
const WireBank = {
  pos: [],
  /** pts: Vector3[] 折线（含自然下垂的弧度） */
  add(pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      this.pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  },
  /** 两点间带下垂弧度的线 */
  sag(a, b, drop, n) {
    n = n || 8;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * drop,
        a.z + (b.z - a.z) * t
      ));
    }
    this.add(pts);
  },
  build(parent, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: color || 0x33313b });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    parent.add(lines);
    return lines;
  },
};

/* ============================================================
 * 相机控制：环绕 + 漫游（自实现，无外部依赖）
 * ============================================================ */
class CameraRig {
  constructor(camera, dom) {
    this.cam = camera;
    this.dom = dom;
    this.mode = "orbit";

    this.target = new THREE.Vector3(-2.5, 2.4, -12);
    this.sph = new THREE.Spherical();           // 当前
    this.sphGoal = new THREE.Spherical();       // 目标（阻尼）
    this._syncFromCamera();

    this.walkPos = new THREE.Vector3(15.5, 1.55, 42);
    this.walkYaw = 0; this.walkPitch = 0;
    this.keys = {};

    this.minR = 3; this.maxR = 150;
    this._drag = null;

    dom.addEventListener("pointerdown", (e) => this._down(e));
    window.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", () => this._drag = null);
    dom.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.mode !== "orbit") return;
      this.sphGoal.radius = THREE.MathUtils.clamp(this.sphGoal.radius * Math.exp(e.deltaY * 0.0011), this.minR, this.maxR);
    }, { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => this._key(e, true));
    window.addEventListener("keyup", (e) => this._key(e, false));
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== dom && this.mode === "walk") this.setMode("orbit");
    });
  }

  _key(e, down) {
    this.keys[e.code] = down;
    if (down && e.code === "KeyC") this.setMode(this.mode === "orbit" ? "walk" : "orbit");
    if (e.code.startsWith("Arrow")) e.preventDefault();
  }

  _down(e) {
    if (this.mode === "walk") {
      if (document.pointerLockElement !== this.dom) this.dom.requestPointerLock();
      return;
    }
    this._drag = { b: e.button, x: e.clientX, y: e.clientY };
  }
  _move(e) {
    if (this.mode === "walk") {
      if (document.pointerLockElement === this.dom) {
        this.walkYaw -= e.movementX * 0.0023;
        this.walkPitch = THREE.MathUtils.clamp(this.walkPitch - e.movementY * 0.0021, -1.2, 1.2);
      }
      return;
    }
    if (!this._drag) return;
    const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
    this._drag.x = e.clientX; this._drag.y = e.clientY;
    if (this._drag.b === 0) {
      this.sphGoal.theta -= dx * 0.0052;
      this.sphGoal.phi = THREE.MathUtils.clamp(this.sphGoal.phi - dy * 0.0042, 0.14, 1.545);
    } else {
      // 右键平移
      const pr = this.sph.radius * 0.0011;
      const right = new THREE.Vector3().setFromSpherical(this.sph).cross(new THREE.Vector3(0, 1, 0)).normalize();
      this.targetGoal.addScaledVector(right, -dx * pr * 1.4);
      this.targetGoal.y = THREE.MathUtils.clamp(this.targetGoal.y + dy * pr * 1.1, 0.4, 30);
    }
  }

  _syncFromCamera() {
    const off = this.cam.position.clone().sub(this.target);
    this.sph.setFromVector3(off);
    this.sphGoal.copy(this.sph);
    this.targetGoal = this.target.clone();
  }

  setMode(m) {
    if (m === this.mode) return;
    if (m === "walk") {
      // 从当前相机位置进入漫游
      const dir = new THREE.Vector3();
      this.cam.getWorldDirection(dir);
      this.walkPos.copy(this.cam.position).addScaledVector(dir, 2.5);
      this.walkPos.y = Math.max(this.walkPos.y, 1.55);
      const g = groundHeight(this.walkPos.x, this.walkPos.z);
      this.walkPos.y = Math.max(g + 1.55, this.walkPos.y);
      this.walkYaw = Math.atan2(-dir.x, -dir.z);
      this.walkPitch = 0;
      this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -75, 75);
      this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -68, 68);
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      // 以漫游位置为环绕中心重建轨道
      this.target.copy(this.walkPos).add(new THREE.Vector3(Math.sin(this.walkYaw) * -6, 0.5, Math.cos(this.walkYaw) * -6));
      this._syncFromCamera();
    }
    this.mode = m;
  }

  /** 直接切换机位（阻尼滑入）；pos/look 支持数组或 {x,y,z} */
  flyTo(posV, lookV) {
    this.setMode("orbit");
    const P = (v) => Array.isArray(v) ? { x: v[0], y: v[1], z: v[2] } : v;
    const pos = P(posV), look = P(lookV);
    const off = new THREE.Vector3(pos.x, pos.y, pos.z).sub(new THREE.Vector3(look.x, look.y, look.z));
    this.sphGoal.setFromVector3(off);
    this.sphGoal.phi = THREE.MathUtils.clamp(this.sphGoal.phi, 0.14, 1.545);
    this.sphGoal.radius = THREE.MathUtils.clamp(this.sphGoal.radius, this.minR, this.maxR);
    this.targetGoal = new THREE.Vector3(look.x, look.y, look.z);
  }

  update(dt) {
    const dtr = Math.min(dt, 0.5);   // 低帧率下阻尼仍按真实时间收敛
    if (this.mode === "orbit") {
      const k = 1 - Math.exp(-dtr * 6.5);
      this.sph.theta += (this.sphGoal.theta - this.sph.theta) * k;
      this.sph.phi += (this.sphGoal.phi - this.sph.phi) * k;
      this.sph.radius += (this.sphGoal.radius - this.sph.radius) * k;
      this.target.lerp(this.targetGoal, k);
      const off = new THREE.Vector3().setFromSpherical(this.sph);
      this.cam.position.copy(this.target).add(off);
      this.cam.lookAt(this.target);
    } else {
      const run = this.keys.ShiftLeft || this.keys.ShiftRight ? 2.1 : 1;
      const sp = 3.4 * run * dtr;
      const fx = -Math.sin(this.walkYaw), fz = -Math.cos(this.walkYaw);
      const rx = Math.cos(this.walkYaw), rz = -Math.sin(this.walkYaw);
      let mx = 0, mz = 0;
      if (this.keys.KeyW) { mx += fx; mz += fz; }
      if (this.keys.KeyS) { mx -= fx; mz -= fz; }
      if (this.keys.KeyA) { mx -= rx; mz -= rz; }
      if (this.keys.KeyD) { mx += rx; mz += rz; }
      if (mx || mz) {
        const l = Math.hypot(mx, mz);
        this.walkPos.x += mx / l * sp; this.walkPos.z += mz / l * sp;
        this.walkPos.x = THREE.MathUtils.clamp(this.walkPos.x, -75, 75);
        this.walkPos.z = THREE.MathUtils.clamp(this.walkPos.z, -68, 68);
      }
      const gy = groundHeight(this.walkPos.x, this.walkPos.z) + 1.55;
      this.walkPos.y += (gy - this.walkPos.y) * (1 - Math.exp(-dtr * 10));
      this.cam.position.copy(this.walkPos);
      this.cam.lookAt(
        this.walkPos.x - Math.sin(this.walkYaw) * Math.cos(this.walkPitch),
        this.walkPos.y + Math.sin(this.walkPitch),
        this.walkPos.z - Math.cos(this.walkYaw) * Math.cos(this.walkPitch)
      );
    }
  }
}

const rig = new CameraRig(camera, renderer.domElement);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
