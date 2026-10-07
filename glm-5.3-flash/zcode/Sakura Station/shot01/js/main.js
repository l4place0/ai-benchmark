import * as THREE from 'three';
import { gradientMap, mulberry32 } from './toon.js';
import { buildGround } from './ground.js';
import { buildBuildings } from './buildings.js';
import { buildStation } from './station.js';
import { buildProps, finishWires } from './props.js';
import { buildNature } from './nature.js';
import { buildTrain } from './train.js';
import { buildPeople } from './people.js';

// ---------- 场景装配 ----------
const canvas = document.getElementById('app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch(e){
  document.getElementById('err').style.display = 'block';
  document.getElementById('err').textContent = '当前环境不支持 WebGL：' + e.message;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdcebf3, 60, 250);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 800);
camera.rotation.order = 'YXZ';

// 春日午后四点：侧后方斜射阳光
const sunDir = new THREE.Vector3(0.52, 0.48, 0.7).normalize();
const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
sun.position.copy(sunDir).multiplyScalar(95);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 90, bottom: -80, near: 8, far: 300 });
sun.shadow.bias = -0.00018;
sun.shadow.normalBias = 0.05;
sun.target.position.set(5, 0, -12);
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xbcd7ee, 0xcabfa8, 1.0));

// 渐变天空穹顶
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(420, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun;
      void main(){
        float h = max(vDir.y, 0.0);
        vec3 top = vec3(0.36, 0.66, 0.90);
        vec3 hor = vec3(0.93, 0.97, 0.99);
        vec3 col = mix(hor, top, pow(h, 0.62));
        float s = max(dot(vDir, uSun), 0.0);
        col += vec3(1.0, 0.88, 0.66) * (pow(s, 30.0) * 0.38 + pow(s, 5.0) * 0.09);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

const ctx = {
  scene,
  grad: gradientMap(),
  rand: mulberry32(20260401),
  wires: [], gates: [], signals: [], canopy: [], treeSpots: [], blocks: [], updates: [],
  block(x0, z0, x1, z1){ ctx.blocks.push({ x0, z0, x1, z1 }); },
  groundY: () => 0,
  gateDown: false,
  trainMoving: false,
};

buildGround(ctx);
buildBuildings(ctx);
buildStation(ctx);
buildProps(ctx);
const natureUpdate = buildNature(ctx);
const train = buildTrain(ctx);
buildPeople(ctx);
finishWires(ctx);

// ---------- 预设机位 ----------
const VIEWS = [
  { p: [2.2, 42.5], t: [-0.6, -12.0] },    // 1 街道正面
  { p: [14.5, -16.9], t: [-16.0, -21.0] }, // 2 站台
  { p: [22.6, -9.0], t: [27.5, -30.0] },   // 3 道口
  { p: [10.6, -2.7], t: [-6.5, -9.8] },    // 4 广场樱花
  { p: [31.5, -17.5], t: [4.0, -21.8] },   // 5 电车正面
];
let yaw = 0, pitch = 0.03;
const eyeH = 1.58;
const player = new THREE.Vector3(2.2, 0, 42.5);
function setView(i){
  const v = VIEWS[i];
  player.set(v.p[0], 0, v.p[1]);
  const dx = v.t[0] - v.p[0], dz = v.t[1] - v.p[1];
  yaw = Math.atan2(-dx, -dz);
  pitch = 0.03;
}
setView(0);

// ---------- 第一人称漫游 ----------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if(e.code.startsWith('Digit')){
    const n = +e.code.slice(5);
    if(n >= 1 && n <= VIEWS.length) setView(n - 1);
  }
});
addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('click', () => { if(document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock(); });
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('mousedown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', e => {
  if(document.pointerLockElement === canvas){
    yaw -= e.movementX * 0.0023; pitch -= e.movementY * 0.0023;
  } else if(dragging){
    yaw -= (e.clientX - lx) * 0.0042; pitch -= (e.clientY - ly) * 0.0042;
    lx = e.clientX; ly = e.clientY;
  }
  pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.25);
});

function movePlayer(dt){
  const sp = (keys.ShiftLeft || keys.ShiftRight) ? 6.0 : 3.2;
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const sd = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if(fw || sd){
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const dx = fx * fw + (-fz) * sd, dz = fz * fw + fx * sd;
    const len = Math.hypot(dx, dz) || 1;
    player.x += dx / len * sp * dt;
    player.z += dz / len * sp * dt;
  }
  const R = 0.34;
  for(const c of ctx.blocks){
    if(player.x > c.x0 - R && player.x < c.x1 + R && player.z > c.z0 - R && player.z < c.z1 + R){
      const d1 = player.x - (c.x0 - R), d2 = (c.x1 + R) - player.x;
      const d3 = player.z - (c.z0 - R), d4 = (c.z1 + R) - player.z;
      const m = Math.min(d1, d2, d3, d4);
      if(m === d1) player.x = c.x0 - R;
      else if(m === d2) player.x = c.x1 + R;
      else if(m === d3) player.z = c.z0 - R;
      else player.z = c.z1 + R;
    }
  }
  player.x = THREE.MathUtils.clamp(player.x, -58, 62);
  player.z = THREE.MathUtils.clamp(player.z, -58, 58);
}

// ---------- 道口遮断机 / 信号机 ----------
function updateGates(dt, t){
  for(const gate of ctx.gates){
    if(gate.mix === undefined) gate.mix = 0;
    gate.mix += ((ctx.gateDown ? 1 : 0) - gate.mix) * Math.min(1, dt * 1.3);
    gate.pivot.rotation.z = gate.dir * THREE.MathUtils.lerp(1.42, 0.03, gate.mix);
    const blink = ctx.gateDown && Math.floor(t * 2.2) % 2 === 0;
    gate.lamp1.material.color.setHex(ctx.gateDown && blink ? 0xff4444 : 0x5a1e1e);
    gate.lamp2.material.color.setHex(ctx.gateDown && !blink ? 0xff4444 : 0x5a1e1e);
  }
  for(const s of ctx.signals){
    s.green.material.color.setHex(ctx.trainMoving ? 0x1c3424 : 0x58c078);
    s.red.material.color.setHex(ctx.trainMoving ? 0xe84848 : 0x3a1e1e);
  }
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let shown = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  train.update(dt, t);
  natureUpdate(dt, t);
  for(const u of ctx.updates) u(dt, t);
  updateGates(dt, t);
  movePlayer(dt);
  camera.position.set(player.x, ctx.groundY(player.x, player.z) + eyeH, player.z);
  camera.rotation.set(pitch, yaw, 0);
  renderer.render(scene, camera);
  if(!shown){
    shown = true;
    const ld = document.getElementById('loading');
    ld.classList.add('hide');
    setTimeout(() => ld.style.display = 'none', 1000);
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const qp = new URLSearchParams(location.search);
if(qp.get('view')) setView(Math.max(0, Math.min(VIEWS.length - 1, +qp.get('view') - 1)));
if(qp.get('ui') === '0'){
  document.getElementById('title').style.display = 'none';
  document.getElementById('hint').style.display = 'none';
}
