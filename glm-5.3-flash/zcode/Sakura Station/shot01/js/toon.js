import * as THREE from 'three';

// ---------- 三渲二基础：色阶渐变、材质、画布纹理、描边 ----------

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _grad = null;
export function gradientMap(){
  if(_grad) return _grad;
  const d = new Uint8Array([86, 136, 190, 255]);   // 4 级色阶，柔和不死黑
  _grad = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  _grad.minFilter = THREE.NearestFilter; _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false; _grad.needsUpdate = true;
  return _grad;
}

const _matCache = new Map();
export function M(color){                 // 按颜色缓存的 toon 材质
  let m = _matCache.get(color);
  if(!m){ m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() }); _matCache.set(color, m); }
  return m;
}
export function toon(opts){ return new THREE.MeshToonMaterial({ gradientMap: gradientMap(), ...opts }); }

export function cnv(w, h, draw, { srgb = true } = {}){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if(srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function rpt(t, rx, ry){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; }

export function B(w, h, d, mat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function CYL(rt, rb, h, mat, seg = 14){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function put(mesh, x, y, z, ry = 0){
  mesh.position.set(x, y, z); if(ry) mesh.rotation.y = ry; return mesh;
}

// 棱线描边（建筑用，克制的深蓝灰线）
export function edges(mesh, { color = 0x3d4456, opacity = 0.3, angle = 30 } = {}){
  const l = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, angle),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(l); return l;
}
// 反向外壳描边（电车、贩卖机等圆润主体用）
export function hull(mesh, s = 1.04, color = 0x2f3547){
  const h = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  h.scale.setScalar(s); mesh.add(h); return h;
}

// 全局调色板：樱花粉 × 天空蓝 × 奶油白 × 灰，阴影偏蓝紫由光照保证
export const C = {
  asphalt: 0x5a616b, roadLine: 0xf0f2ee, centerYellow: 0xe6bd59,
  sidewalk: 0xb4b0a6, curb: 0x9a968c,
  plaza: 0xc3c6c9,
  platform: 0xb2b6ba, tactile: 0xe2bc4d,
  wallCream: 0xf3ecdd, wallBeige: 0xe7dcc3, wallBlue: 0xc9dbe0, wallGray: 0xcfd2d3,
  wallWood: 0x8a6a4e, wallPink: 0xe9d6d1, wallGreen: 0xd5deca, wallWhite: 0xf4f2ea,
  roofGray: 0x505862, roofBlue: 0x4c5b6a, roofGreen: 0x4e6459, roofBrown: 0x6d5243, metalRoof: 0x99a3aa,
  frame: 0x55606c, frameBrown: 0x6b4f3a, glass: 0x9db8c7, glassDark: 0x748d9e,
  wood: 0xa5805a, woodDark: 0x6f5238,
  rail: 0xcdd4da, sleeper: 0x6a5b4c,
  trainBody: 0xf3f0e7, trainStripe: 0xf2a7bd, trainRoof: 0x8b939c, trainDark: 0x4a5058,
  signBlue: 0x2f6bb0, signRed: 0xd94a4a, signYellow: 0xe8b83c,
  leaf: 0x7fae6a, leafDeep: 0x5f8f53, youngLeaf: 0xc4d98a, grass: 0x93b06b,
  trunk: 0x6b5a4c,
  sak: [0xffe9f0, 0xffd6e2, 0xfcc3d3, 0xf7b0c6],
};
