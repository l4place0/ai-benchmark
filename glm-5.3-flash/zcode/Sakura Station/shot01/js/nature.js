import * as THREE from 'three';
import { M, C, cnv, rpt, B, CYL, put } from './toon.js';
import { CROSS_X } from './cfg.js';

// ---------- 樱花树 / 灌木 / 草丛 / 地面花瓣 / 飘落花瓣 / 远山与云 ----------

function crossedPlanes(n = 3){
  const pos = [], uv = [], idx = []; let off = 0;
  for(let k = 0; k < n; k++){
    const p = new THREE.PlaneGeometry(1, 1); p.rotateY(k * Math.PI / n);
    const P = p.attributes.position, U = p.attributes.uv, I = p.index;
    for(let i = 0; i < P.count; i++){ pos.push(P.getX(i), P.getY(i), P.getZ(i)); uv.push(U.getX(i), U.getY(i)); }
    for(let i = 0; i < I.count; i++) idx.push(I.getX(i) + off);
    off += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function blossomTex(){
  return cnv(256, 256, c => {
    const pinks = ['#ffeaf1', '#ffd9e4', '#fcc9d8', '#f8b4c8', '#fde6ee'];
    for(let i = 0; i < 130; i++){
      const rr = Math.pow(Math.random(), 0.62) * 114, a = Math.random() * Math.PI * 2;
      const x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr * 0.92;
      const pr = 4.5 + Math.random() * 6;
      c.fillStyle = pinks[(Math.random() * pinks.length) | 0];
      for(let p = 0; p < 5; p++){
        const pa = p / 5 * Math.PI * 2 + Math.random() * 0.5;
        c.beginPath(); c.arc(x + Math.cos(pa) * pr * 0.82, y + Math.sin(pa) * pr * 0.82, pr * 0.78, 0, 7); c.fill();
      }
      c.fillStyle = 'rgba(243,164,190,0.9)';
      c.beginPath(); c.arc(x, y, pr * 0.34, 0, 7); c.fill();
    }
    for(let i = 0; i < 16; i++){
      const rr = Math.pow(Math.random(), 0.6) * 108, a = Math.random() * Math.PI * 2;
      c.fillStyle = 'rgba(198,219,142,0.9)';
      c.beginPath(); c.ellipse(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr * 0.9, 5.5, 3, a, 0, 7); c.fill();
    }
  });
}
function leafTex(){
  return cnv(256, 256, c => {
    const greens = ['#8fb56d', '#7ca95e', '#a3c47e', '#6d9c52', '#c4d98a'];
    for(let i = 0; i < 150; i++){
      const rr = Math.pow(Math.random(), 0.6) * 112, a = Math.random() * Math.PI * 2;
      c.fillStyle = greens[(Math.random() * greens.length) | 0];
      c.beginPath(); c.ellipse(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr * 0.9, 9 + Math.random() * 8, 6 + Math.random() * 5, a, 0, 7); c.fill();
    }
  });
}
function barkTex(){
  return rpt(cnv(128, 128, c => {
    c.fillStyle = '#6b5a4c'; c.fillRect(0, 0, 128, 128);
    for(let i = 0; i < 26; i++){
      c.strokeStyle = Math.random() < 0.5 ? 'rgba(50,40,32,0.5)' : 'rgba(142,122,100,0.4)';
      c.lineWidth = 1 + Math.random() * 2.5;
      const x = Math.random() * 128;
      c.beginPath(); c.moveTo(x, -8); c.bezierCurveTo(x + 8, 40, x - 8, 88, x + 5, 136); c.stroke();
    }
    for(let i = 0; i < 12; i++){
      c.strokeStyle = 'rgba(40,32,26,0.5)'; c.lineWidth = 2;
      const y = Math.random() * 128, x = Math.random() * 108;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10 + Math.random() * 15, y); c.stroke();
    }
  }), 1, 1);
}
function bladeTex(){
  return cnv(64, 64, c => {
    c.clearRect(0, 0, 64, 64);
    for(let i = 0; i < 9; i++){
      const x0 = 8 + i * 6 + Math.random() * 3;
      c.strokeStyle = ['#7ca95e', '#93b56e', '#6a9a50', '#a8c47e'][(Math.random() * 4) | 0];
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(x0, 64); c.quadraticCurveTo(x0 + (Math.random() - 0.5) * 14, 30, x0 + (Math.random() - 0.5) * 22, 4 + Math.random() * 14); c.stroke();
    }
  });
}
function petalTex(){
  return cnv(32, 32, c => {
    c.clearRect(0, 0, 32, 32);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(16, 2);
    c.bezierCurveTo(27, 8, 29, 22, 16, 30);
    c.bezierCurveTo(3, 22, 5, 8, 16, 2);
    c.fill();
  });
}
function cloudTex(){
  return cnv(256, 128, c => {
    c.clearRect(0, 0, 256, 128);
    const blob = (x, y, r) => {
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.65, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    };
    blob(78, 76, 46); blob(128, 60, 56); blob(182, 78, 44); blob(120, 90, 40); blob(225, 88, 30);
  });
}

// 一棵樱花树
function addTree(ctx, parent, { x, z, s = 1, lean = 0, rot = 0 }, barkMat, pitMat){
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = rot; g.rotation.z = lean;
  const th = 2.0 * s;
  const trunk = CYL(0.12 * s, 0.24 * s, th, barkMat, 8); trunk.position.y = th / 2; g.add(trunk);
  const root = CYL(0.27 * s, 0.36 * s, 0.4, barkMat, 8); root.position.y = 0.14; g.add(root);
  const base = new THREE.Vector3(0, th * 0.85, 0);
  const n = 6 + (ctx.rand() * 3 | 0);
  const up = new THREE.Vector3(0, 1, 0);
  for(let i = 0; i < n; i++){
    const ang = (i / n) * Math.PI * 2 + ctx.rand() * 0.9;
    const rr = (0.85 + ctx.rand() * 1.5) * s;
    const cy = th + (0.25 + ctx.rand() * 1.5) * s;
    const cp = new THREE.Vector3(Math.cos(ang) * rr, cy, Math.sin(ang) * rr);
    const dir = cp.clone().sub(base).normalize();
    const len = cp.distanceTo(base);
    const br = CYL(0.025 * s, 0.075 * s, len, barkMat, 5);
    br.position.copy(base).addScaledVector(dir, len / 2);
    br.quaternion.setFromUnitVectors(up, dir);
    g.add(br);
    const m = new THREE.Matrix4();
    const wpos = cp.clone().applyEuler(g.rotation).add(g.position);
    m.compose(wpos, new THREE.Quaternion().setFromAxisAngle(up, ctx.rand() * Math.PI * 2),
      new THREE.Vector3(1, 1, 1).multiplyScalar((2.0 + ctx.rand() * 1.2) * s));
    ctx.canopy.push(m);
    if(ctx.rand() > 0.45){
      const m2 = new THREE.Matrix4();
      const wp2 = cp.clone().multiplyScalar(1.28).add(new THREE.Vector3(0, -0.3 * s, 0)).applyEuler(g.rotation).add(g.position);
      m2.compose(wp2, new THREE.Quaternion().setFromAxisAngle(up, ctx.rand() * 6),
        new THREE.Vector3(1, 1, 1).multiplyScalar((1.15 + ctx.rand()) * s));
      ctx.canopy.push(m2);
    }
  }
  const mt = new THREE.Matrix4();
  const wtop = new THREE.Vector3(0, th + 1.5 * s, 0).applyEuler(g.rotation).add(g.position);
  mt.compose(wtop, new THREE.Quaternion().setFromAxisAngle(up, ctx.rand() * 6),
    new THREE.Vector3(1, 1, 1).multiplyScalar(2.7 * s));
  ctx.canopy.push(mt);
  // 树池
  const pit = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 0.07, 1.7 * s), pitMat);
  pit.position.set(x, 0.045, z); pit.receiveShadow = true; parent.add(pit);
  ctx.treeSpots.push({ x, z, r: 2.3 * s });
  parent.add(g);
}

function addBush(ctx, parent, x, z, s, bushes){
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, 0.45 * s, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ctx.rand() * 6),
    new THREE.Vector3(1.3 * s, 0.9 * s, 1.3 * s));
  bushes.push(m);
}

// 飘落花瓣（点精灵 + 程序化花瓣形）
function makeFallingPetals(ctx, parent){
  const N = 1200;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
  for(let i = 0; i < N; i++){
    pos[i * 3] = -50 + ctx.rand() * 112;
    pos[i * 3 + 1] = ctx.rand() * 13.5;
    pos[i * 3 + 2] = -52 + ctx.rand() * 110;
    seed[i] = ctx.rand() * 997;
    size[i] = 4.5 + ctx.rand() * 7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      varying float vRot; varying float vTone; varying float vFade;
      void main(){
        float t = uTime;
        float H = 13.5;
        float sp = 0.5 + 0.55 * fract(aSeed * 0.731);
        float y = mod(position.y - t * sp, H);
        float ph = aSeed;
        vec3 p;
        p.x = position.x + sin(t * 0.9 + ph) * 0.7 + sin(t * 0.33 + ph * 1.7) * 1.3;
        p.y = y;
        p.z = position.z + cos(t * 0.7 + ph * 1.3) * 0.8 + sin(t * 0.27 + ph * 2.3) * 1.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(0.1, -mv.z);
        gl_PointSize = min(aSize * (115.0 / dist), 38.0);
        vRot = ph + t * (0.8 + 2.4 * fract(aSeed * 0.537)) * (fract(aSeed * 0.291) > 0.5 ? 1.0 : -1.0);
        vTone = fract(aSeed * 0.117);
        vFade = smoothstep(0.0, 0.7, y) * (1.0 - smoothstep(95.0, 135.0, dist));
      }`,
    fragmentShader: `
      varying float vRot; varying float vTone; varying float vFade;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float cs = cos(vRot), sn = sin(vRot);
        uv = mat2(cs, -sn, sn, cs) * uv;
        float r = length(uv * vec2(1.0, 1.28));
        float a = smoothstep(0.46, 0.34, r);
        float notch = smoothstep(0.16, 0.02, uv.y + 0.28) * smoothstep(0.13, 0.02, abs(uv.x + 0.02));
        a -= notch * 0.85;
        if(a < 0.04) discard;
        vec3 base = mix(vec3(1.0, 0.79, 0.86), vec3(1.0, 0.90, 0.94), vTone);
        float rim = smoothstep(0.26, 0.45, r);
        vec3 col = mix(base, vec3(1.0, 0.97, 0.98), rim * 0.75);
        gl_FragColor = vec4(col, a * 0.95 * vFade);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 20;
  parent.add(pts);
  return mat;
}

export function buildNature(ctx){
  const g = new THREE.Group(); ctx.scene.add(g);
  const bTex = blossomTex(), lTex = leafTex();
  const barkMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: barkTex(), gradientMap: ctx.grad });
  const pitMat = M(0x6a5648);
  const up = new THREE.Vector3(0, 1, 0);

  // ---- 樱花树分布 ----
  const TREES = [
    { x: -6.2, z: -8.0, s: 1.55 },                    // 广场主景树
    { x: -5.6, z: 17.5, s: 1.1 }, { x: -5.2, z: 30.5, s: 1.0 },
    { x: -4.6, z: 38.5, s: 1.3, lean: 0.2, rot: 0.5 }, // 越路拱枝
    { x: 16.8, z: 7.6, s: 0.9 }, { x: 15.2, z: 37.5, s: 1.0 },
    { x: -10.5, z: 46.5, s: 1.05 }, { x: 5.6, z: 51.5, s: 1.1 },
    { x: -13.5, z: -15.5, s: 1.0 }, { x: 27.5, z: -15.0, s: 0.95 },
    { x: 30.0, z: -32.5, s: 1.15 },
    { x: -19.0, z: -30.0, s: 1.1 }, { x: -5.5, z: -31.0, s: 1.0 },
    { x: 11.5, z: -31.0, s: 1.05 }, { x: 34.0, z: -27.0, s: 0.9 },
    { x: 44.0, z: -20.0, s: 1.0 }, { x: -30.0, z: -22.0, s: 1.1 },
  ];
  for(const t of TREES) addTree(ctx, g, t, barkMat, pitMat);

  // 花簇实例
  const cross = crossedPlanes(3);
  const canopyMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: bTex, alphaTest: 0.42, side: THREE.DoubleSide, gradientMap: ctx.grad });
  const canopy = new THREE.InstancedMesh(cross, canopyMat, ctx.canopy.length);
  ctx.canopy.forEach((m, i) => canopy.setMatrixAt(i, m));
  canopy.castShadow = true; canopy.frustumCulled = false;
  canopy.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: bTex, alphaTest: 0.5 });
  g.add(canopy);

  // ---- 灌木 ----
  const bushes = [];
  for(let i = 0; i < 16; i++) addBush(ctx, g, -34 + i * 4.6 + ctx.rand() * 2, TRACK_NORTH_Z(), 0.8 + ctx.rand() * 0.7, bushes);
  for(const [bx, bz, bs] of [[-12.5, 12.5, 1.1], [-13.2, 24.5, 0.9], [-12.0, 37.0, 1.0], [-14.8, 8.0, 0.8],
    [16.5, 16.5, 0.9], [12.5, 28.0, 0.8], [-15.5, -9.0, 1.1], [16.0, -10.5, 1.0], [22.5, -13.0, 0.8],
    [-1.0, -26.5, 0.9], [17.5, -27.5, 1.0], [30.0, -36.5, 1.1], [8.0, -36.0, 0.9], [-12.0, -36.5, 1.0]]){
    addBush(ctx, g, bx, bz, bs, bushes);
  }
  const bushMesh = new THREE.InstancedMesh(cross, new THREE.MeshToonMaterial({ color: 0xffffff, map: lTex, alphaTest: 0.42, side: THREE.DoubleSide, gradientMap: ctx.grad }), bushes.length);
  bushes.forEach((m, i) => bushMesh.setMatrixAt(i, m));
  bushMesh.castShadow = true; bushMesh.frustumCulled = false;
  bushMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lTex, alphaTest: 0.5 });
  g.add(bushMesh);

  // ---- 草丛 ----
  const tufts = [];
  const tuftAt = (x, z) => {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, 0.16, z),
      new THREE.Quaternion().setFromAxisAngle(up, ctx.rand() * 6),
      new THREE.Vector3(1, 1, 1).multiplyScalar(0.32 + ctx.rand() * 0.34));
    tufts.push(m);
  };
  for(let x = -60; x < 90; x += 1.15){
    if(ctx.rand() > 0.35) tuftAt(x + ctx.rand(), TRACK_NORTH_Z() - 2.2 - ctx.rand() * 2.4);
    if(x < -10 || x > 26){ if(ctx.rand() > 0.4) tuftAt(x + ctx.rand(), TRACK_NORTH_Z() + 4 + ctx.rand() * 2.5); }
  }
  for(let i = 0; i < 70; i++){
    const gx = -55 + ctx.rand() * 130, gz = -44 + ctx.rand() * 90;
    const onRoad = gz > -3 && gz < 52 && Math.abs(gx - ctx.roadFX(gz)) < 5.2;
    const onPlaza = gz > -13 && gz < -1 && gx > -15 && gx < 16;
    const onCross = gz > -32 && gz < -4 && Math.abs(gx - CROSS_X) < 4.6;
    if(onRoad || onPlaza || onCross) continue;
    tuftAt(gx, gz);
  }
  const tuftMesh = new THREE.InstancedMesh(crossedPlanes(2), new THREE.MeshToonMaterial({ color: 0xffffff, map: bladeTex(), alphaTest: 0.45, side: THREE.DoubleSide, gradientMap: ctx.grad }), tufts.length);
  tufts.forEach((m, i) => tuftMesh.setMatrixAt(i, m));
  tuftMesh.frustumCulled = false; tuftMesh.receiveShadow = true;
  g.add(tuftMesh);

  // ---- 地面花瓣（风聚条带与小堆）----
  const spots = [];
  const gauss = () => (ctx.rand() + ctx.rand() + ctx.rand() - 1.5) / 1.5;
  for(const t of ctx.treeSpots) for(let i = 0; i < 30; i++)
    spots.push([t.x + gauss() * t.r, t.z + gauss() * t.r * 0.8]);
  const fx = ctx.roadFX;
  for(let i = 0; i < 9; i++){ const z = 3 + i * 5.4; for(let k = 0; k < 10; k++) spots.push([fx(z) + 2.6 + gauss() * 0.5, z + gauss() * 1.8]); }
  for(let i = 0; i < 5; i++){ const z = 6 + i * 7; for(let k = 0; k < 8; k++) spots.push([fx(z) - 2.7 + gauss() * 0.5, z + gauss() * 2.2]); }
  for(let i = 0; i < 14; i++) spots.push([CROSS_X - 3.4 + gauss() * 0.8, -17.5 - i * 0.9]);
  for(let i = 0; i < 12; i++) spots.push([-6.2 + gauss() * 3.4, -8.0 + gauss() * 3.0]);
  for(let i = 0; i < 10; i++) spots.push([-2.4 + gauss() * 1.2, -12.6 + gauss() * 1.4]);
  const gpGeo = new THREE.PlaneGeometry(0.12, 0.16); gpGeo.rotateX(-Math.PI / 2);
  const gpMat = new THREE.MeshToonMaterial({ color: 0xffffff, map: petalTex(), alphaTest: 0.4, side: THREE.DoubleSide, gradientMap: ctx.grad });
  const gp = new THREE.InstancedMesh(gpGeo, gpMat, spots.length);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    const gy = ctx.groundY(s[0], s[1]);
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(s[0], gy + 0.015 + ctx.rand() * 0.015, s[1]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.rand() * 6, (ctx.rand() - 0.5) * 0.25)),
      new THREE.Vector3(0.8 + ctx.rand() * 0.7, 1, 0.8 + ctx.rand() * 0.7));
    gp.setMatrixAt(i, m);
    col.setHex(C.sak[(ctx.rand() * 4) | 0]).multiplyScalar(0.92 + ctx.rand() * 0.1);
    gp.setColorAt(i, col);
  });
  gp.frustumCulled = false; gp.receiveShadow = true;
  g.add(gp);

  // ---- 飘落花瓣 ----
  const petalMat = makeFallingPetals(ctx, g);

  // ---- 远山 / 北侧河堤 / 云 ----
  const hillMat = new THREE.MeshToonMaterial({ color: 0xa9c9d8, gradientMap: ctx.grad });
  const hillMat2 = new THREE.MeshToonMaterial({ color: 0xb7d2c4, gradientMap: ctx.grad });
  for(const [hx, hz, hr, hh2, m2] of [
    [-50, -235, 150, 30, hillMat], [70, -255, 170, 36, hillMat2], [170, -170, 120, 24, hillMat],
    [-160, -150, 130, 26, hillMat2], [155, 100, 125, 26, hillMat], [-165, 120, 135, 28, hillMat2],
  ]){
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), m2);
    hill.scale.set(hr, hh2, hr * 0.8); hill.position.set(hx, -3, hz);
    g.add(hill);
  }
  // 北侧河堤绿化带 + 小河
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(260, 7), new THREE.MeshToonMaterial({ color: 0x7fa063, gradientMap: ctx.grad }));
  belt.rotation.x = -Math.PI / 2; belt.position.set(10, 0.005, -51); belt.receiveShadow = true; g.add(belt);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(260, 0.5, 0.8), new THREE.MeshToonMaterial({ color: 0x9a968c, gradientMap: ctx.grad }));
  bank.position.set(10, 0.2, -54.4); g.add(bank);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(280, 5), new THREE.MeshToonMaterial({ color: 0x9fd0e2, gradientMap: ctx.grad }));
  water.rotation.x = -Math.PI / 2; water.position.set(10, 0.02, -57.5); g.add(water);
  const belt2 = new THREE.Mesh(new THREE.PlaneGeometry(280, 7), new THREE.MeshToonMaterial({ color: 0x88a86e, gradientMap: ctx.grad }));
  belt2.rotation.x = -Math.PI / 2; belt2.position.set(10, 0.005, -62); g.add(belt2);

  // 云（公告板）
  const cTex = cloudTex();
  const clouds = [];
  for(let i = 0; i < 9; i++){
    const sm = new THREE.SpriteMaterial({ map: cTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(sm);
    const w = 55 + ctx.rand() * 70;
    sp.scale.set(w, w * 0.32, 1);
    sp.position.set(-200 + ctx.rand() * 420, 60 + ctx.rand() * 45, -170 - ctx.rand() * 120);
    g.add(sp); clouds.push(sp);
  }

  return function update(dt, t){
    petalMat.uniforms.uTime.value = t;
    for(const sp of clouds){ sp.position.x += dt * 1.1; if(sp.position.x > 260) sp.position.x = -260; }
  };
}

// 北侧轨道围栏外的 z
function TRACK_NORTH_Z(){ return -27.6; }
