// 3D world: particle "her", background shader, grid floor, stars, wireframe objects, camera direction
import * as THREE from 'three';
import { N } from './shapes.js';
import { section, clamp, lerp, smooth, easeInOut, easeOutCubic, win, hash, mulberry32 } from './timeline.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ particle keyframes
// [time, shape, transitionDuration, swirl]
const EXEC_SHAPES = ['lattice', 'circle', 'sine', 'infinity', 'eggplant', 'tomato', 'cat', 'eye', 'helix', 'clock', 'sphere', 'venus'];
const EXEC_TIMES = [147.52, 148.59, 149.78, 150.64, 151.53, 152.43, 153.32, 154.31, 155.20, 156.18, 157.12, 158.02];
export const KEYS = [
  [0, 'scatter', 0.1, 0],
  [5.16, 'girl', 4.4, 7],
  [16.04, 'title', 1.6, 5],
  [22.40, 'girl', 2.6, 5],
  [29.28, 'point', 0.9, 1],
  [30.70, 'lattice', 1.6, 2],
  [33.01, 'circle', 1.2, 3],
  [36.77, 'sine', 1.2, 3],
  [40.36, 'infinity', 1.3, 3],
  [44.04, 'coil', 1.0, 3],
  [47.27, 'vortex', 1.5, 4],
  [50.95, 'timeRings', 1.3, 3],
  [54.74, 'helix', 1.4, 3],
  [58.65, 'girl', 1.1, 6],
  [67.99, 'txtExec', 0.8, 4],
  [70.02, 'sphere', 1.1, 4],
  [73.53, 'eggplant', 1.0, 4],
  [77.16, 'tomato', 1.0, 4],
  [80.93, 'cat', 1.0, 4],
  [84.60, 'eye', 1.3, 5],
  [88.34, 'venus', 0.9, 3],
  [90.62, 'mars', 0.55, 2],
  [91.44, 'clock', 1.0, 3],
  [95.28, 'switchL', 0.9, 3],
  [97.95, 'switchR', 0.45, 1],
  [98.93, 'vortex', 1.6, 5],
  [102.93, 'girl', 1.1, 5],
  [121.80, 'face', 1.4, 3],
  [125.33, 'eyeRed', 1.3, 4],
  [130.74, 'txtIllegal', 0.8, 5],
  [134.38, 'storm', 1.6, 8],
  [141.00, 'girlRed', 2.2, 4],
  ...EXEC_TIMES.map((t, i) => [t, EXEC_SHAPES[i] + 'Red', 0.32, 2.5]),
  [158.79, 'n1', 0.22, 1], [159.22, 'n2', 0.22, 1], [159.66, 'n3', 0.22, 1], [160.05, 'n4', 0.22, 1], [160.45, 'n5', 0.22, 1], [160.88, 'n6', 0.22, 1],
  [161.31, 'txtExecRed', 0.3, 2],
  [162.23, 'girlRed', 0.8, 6],
  [169.61, 'faceRed', 1.0, 3],
  [173.11, 'girlcage', 1.0, 3],
  [176.96, 'heart', 1.4, 4],
  [187.97, 'girlcagePink', 1.2, 3],
  [190.24, 'heart', 1.2, 4],
  [193.46, 'girl', 2.0, 4],
  [199.00, 'ascend', 4.5, 1.5],
  [203.60, 'point', 1.8, 0],
];
// clamp durations to gaps
for (let i = 0; i < KEYS.length - 1; i++) KEYS[i][2] = Math.min(KEYS[i][2], KEYS[i + 1][0] - KEYS[i][0] - 0.01);

const SPIN = new Set(['lattice', 'sphere', 'helix', 'vortex', 'timeRings', 'heart', 'cage', 'storm', 'coil', 'infinity', 'ascend', 'point', 'scatter',
  'latticeRed', 'sphereRed', 'helixRed', 'infinityRed']);
const FLAT = new Set(['title', 'txtExec', 'txtIllegal', 'txtExecRed', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'venus', 'mars', 'clock', 'switchL', 'switchR', 'eye', 'eyeRed', 'circle', 'sine']);

// ------------------------------------------------------------------ shaders
const PARTICLE_VS = /* glsl */`
attribute vec4 aRand;
attribute vec3 color;
uniform float uTime, uSize, uScale, uNoise, uExplode, uErase, uGlitch, uOpacity, uVib, uTintMix, uBright;
uniform vec3 uTint;
varying vec3 vCol; varying float vA;
void main(){
  vec3 p = position;
  float ph = aRand.x * 6.2831;
  p += uNoise * vec3(sin(uTime*1.1+ph+p.y*.7), sin(uTime*1.3+ph*1.7+p.x*.6), sin(uTime*.9+ph*2.3+p.z*.5));
  vec3 dir = normalize(vec3(aRand.y-.5, aRand.z-.5, aRand.w-.5) + 1e-4);
  p += dir * uExplode * (0.3 + aRand.z * 1.4);
  p += dir * uVib * sin(uTime*55.*(0.6+aRand.x) + ph) * (0.5 + aRand.w);
  float sl = floor(p.y*1.3 + floor(uTime*14.)*7.13);
  float gh = fract(sin(sl*91.7)*43758.5);
  if (gh < uGlitch*0.4) p.x += (fract(gh*13.1)-.5)*uGlitch*7.;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.55 + aRand.w * 0.9) * uScale / max(0.5, -mv.z);
  float l = dot(color, vec3(.3,.59,.11));
  vCol = mix(color, uTint * (0.35 + l * 1.1), uTintMix);
  float er = fract(aRand.x * 7.31 + aRand.y * 3.7);
  vA = uOpacity * uBright * step(uErase, er) * smoothstep(0.3, 2.5, -mv.z);
}`;
const PARTICLE_FS = /* glsl */`
varying vec3 vCol; varying float vA;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .0, d);
  a = a * a;
  gl_FragColor = vec4(vCol, a * vA);
}`;

const BG_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const BG_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uAspect, uBeat, uNebula, uTunnel, uSpiral, uKaleido, uRed, uTunnelSpeed, uBright, uRain;
uniform vec3 uColA, uColB, uBase;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec2 p = (vUv - .5) * vec2(uAspect, 1.);
  float r = length(p), a = atan(p.y, p.x);
  vec3 col = uBase * (1. - r * .8);
  if (uNebula > 0.001) {
    float n = fbm(p * 2.0 + vec2(uTime * .03, -uTime * .02));
    float n2 = fbm(p * 3.6 - vec2(uTime * .05, uTime * .035) + n * 1.5);
    vec3 nc = uNebula * (uColA * smoothstep(.35, .95, n2) + uColB * smoothstep(.5, 1., n) * .9) * (1. - r * .5);
    float nl = max(nc.r, max(nc.g, nc.b));
    col += nc * min(1., 0.22 / max(nl, 1e-4));
  }
  if (uTunnel > 0.001) {
    float z = .32 / max(r, .015) + uTime * uTunnelSpeed;
    float ring = smoothstep(.47, .5, abs(fract(z) - .5));
    float seg = smoothstep(.475, .5, abs(fract(a / 6.2831 * 24.) - .5));
    float cells = step(.85, h21(vec2(floor(z), floor(a / 6.2831 * 24.))));
    float fade = smoothstep(0.02, .35, r) * smoothstep(1.1, .25, r);
    col += uTunnel * .45 * (uColA * ring * (0.7 + uBeat) + uColB * seg * .5 + uColB * cells * .18) * fade;
  }
  if (uSpiral > 0.001) {
    float s = sin(a * 5. + log(max(r, .001)) * 10. - uTime * 5.);
    float st = smoothstep(.55, .95, s);
    vec3 c = mix(uColA, uColB, .5 + .5 * sin(log(max(r,.001)) * 3. - uTime * 1.3));
    col += uSpiral * c * st * smoothstep(0., .25, r) * .35;
  }
  if (uKaleido > 0.001) {
    float seg = 6.2831 / 10.;
    float ka = mod(a + uTime * .15, seg); ka = abs(ka - seg * .5);
    vec2 q = r * vec2(cos(ka), sin(ka));
    q = q * 5. - vec2(uTime * 1.2, 0.);
    vec2 g = abs(fract(q) - .5);
    float lines = smoothstep(.025, 0., min(g.x, g.y)) + smoothstep(.03, 0., abs(fract(q.x + q.y) - .5) - .47) * .6;
    vec3 c = mix(uColA, uColB, .5 + .5 * sin(r * 6. - uTime * 2.));
    col += uKaleido * .4 * c * lines * (0.5 + uBeat) * smoothstep(0., .2, r);
  }
  if (uRain > 0.001) {
    vec2 g = vec2(floor(vUv.x * 96.), vUv.y);
    float sp = .3 + h21(vec2(g.x, 1.)) * .7;
    float y = fract(vUv.y * 1.2 + uTime * sp * .5 + h21(vec2(g.x, 7.)));
    float cell = step(.5, h21(vec2(g.x, floor(vUv.y * 54.) + floor(uTime * 8. * sp))));
    col += uRain * uColA * pow(y, 6.) * cell * .9;
  }
  if (uRed > 0.001) {
    float st = h21(floor(vUv * vec2(320., 180.)) + floor(uTime * 30.));
    float bars = step(.92, fract(vUv.y * 6. - uTime * 2.3)) * .5;
    float n = fbm(p * 3. + uTime * .4);
    col += uRed * vec3(1., .08, .12) * (st * .22 + bars * .4 + smoothstep(.45, .9, n) * .8) ;
  }
  col *= uBright;
  gl_FragColor = vec4(col, 1.);
}`;

const GRID_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GRID_FS = /* glsl */`
varying vec3 vW;
uniform vec3 uCol; uniform float uAlpha, uScroll, uPulseR, uPulseA, uCell, uWave, uTime;
void main(){
  vec2 g = vW.xz / uCell + vec2(0., uScroll);
  vec2 f = abs(fract(g - .5) - .5) / fwidth(g);
  float line = 1. - min(min(f.x, f.y), 1.);
  float d = length(vW.xz);
  float fade = exp(-d * .018);
  float pulse = smoothstep(2.5, 0., abs(d - uPulseR)) * uPulseA;
  vec3 c = uCol * (line * .8 + pulse * line * 3. + pulse * .12);
  gl_FragColor = vec4(c, (line + pulse * .4) * fade * uAlpha);
}`;

const STAR_VS = /* glsl */`
attribute float aR;
uniform float uTime, uSpeed, uScale, uTravel;
varying float vA;
void main(){
  vec3 p = position;
  p.z = mod(p.z + uTravel, 300.) - 250.;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.2 + aR * 2.5) * uScale / max(1., -mv.z) * 6.;
  vA = (0.4 + 0.6 * sin(uTime * (1. + aR * 3.) + aR * 50.)) * smoothstep(250., 120., -mv.z);
}`;
const STAR_FS = `uniform vec3 uCol; uniform float uAlpha; varying float vA; void main(){ float d = length(gl_PointCoord-.5); gl_FragColor = vec4(uCol, smoothstep(.5,0.,d) * vA * uAlpha); }`;

// ------------------------------------------------------------------ World
export class World {
  constructor(renderer, shapes) {
    this.renderer = renderer;
    this.shapes = shapes;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 800);
    // background
    this.bgScene = new THREE.Scene();
    this.bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VS, fragmentShader: BG_FS, depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uAspect: { value: 16 / 9 }, uBeat: { value: 0 }, uNebula: { value: 0 }, uTunnel: { value: 0 }, uSpiral: { value: 0 }, uKaleido: { value: 0 }, uRed: { value: 0 }, uRain: { value: 0 },
        uTunnelSpeed: { value: 1 }, uBright: { value: 1 }, uColA: { value: new THREE.Color(0x103050) }, uColB: { value: new THREE.Color(0x301040) }, uBase: { value: new THREE.Color(0x000000) },
      },
    });
    this.bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat));

    // particles
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.rand = new Float32Array(N * 4);
    const r = mulberry32(777);
    for (let i = 0; i < N * 4; i++) this.rand[i] = r();
    this.delay = new Float32Array(N); this.dir = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.delay[i] = (this.rand[i * 4] * 13.7) % 1;
      let x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; const l = Math.hypot(x, y, z) || 1;
      this.dir[i * 3] = x / l; this.dir[i * 3 + 1] = y / l; this.dir[i * 3 + 2] = z / l;
    }
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3); this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr); geo.setAttribute('color', this.colAttr);
    geo.setAttribute('aRand', new THREE.BufferAttribute(this.rand, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.pMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 1 }, uScale: { value: 1080 * 0.05 }, uNoise: { value: 0 }, uExplode: { value: 0 }, uErase: { value: 0 }, uGlitch: { value: 0 }, uOpacity: { value: 1 }, uBright: { value: 0.3 }, uVib: { value: 0 }, uTint: { value: new THREE.Color(1, 0.2, 0.2) }, uTintMix: { value: 0 } },
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.pGroup = new THREE.Group(); this.pGroup.add(this.points); this.scene.add(this.pGroup);

    // grid floor
    this.gridMat = new THREE.ShaderMaterial({
      vertexShader: GRID_VS, fragmentShader: GRID_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(0x5ef2ff) }, uAlpha: { value: 0 }, uScroll: { value: 0 }, uPulseR: { value: 0 }, uPulseA: { value: 0 }, uCell: { value: 2 }, uWave: { value: 0 }, uTime: { value: 0 } },
    });
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.gridMat);
    this.grid.rotation.x = -Math.PI / 2; this.grid.position.y = -6.2;
    this.scene.add(this.grid);
    this.ceil = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.gridMat);
    this.ceil.rotation.x = Math.PI / 2; this.ceil.position.y = 40; this.ceil.visible = false;
    this.scene.add(this.ceil);

    // stars
    const sg = new THREE.BufferGeometry(); const SN = 5000; const sp = new Float32Array(SN * 3), sr = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { sp[i * 3] = (r() - 0.5) * 300; sp[i * 3 + 1] = (r() - 0.5) * 200; sp[i * 3 + 2] = r() * 300; sr[i] = r(); }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aR', new THREE.BufferAttribute(sr, 1));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uSpeed: { value: 0 }, uScale: { value: 1 }, uTravel: { value: 0 }, uCol: { value: new THREE.Color(0xbfefff) }, uAlpha: { value: 0 } } });
    this.stars = new THREE.Points(sg, this.starMat); this.scene.add(this.stars);

    // wireframe "pieces"
    const geos = [new THREE.BoxGeometry(2, 2, 2), new THREE.IcosahedronGeometry(1.4, 0), new THREE.OctahedronGeometry(1.4), new THREE.TetrahedronGeometry(1.6), new THREE.TorusGeometry(1.1, 0.35, 8, 20), new THREE.DodecahedronGeometry(1.3)];
    this.pieces = geos.map((g, i) => {
      const m = new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), new THREE.LineBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.scene.add(m); return m;
    });
    // big wire world sphere and shield
    this.shield = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(8.5, 2), 1), new THREE.LineBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.shield);
    this._lastStatic = null;
  }

  // ---------------------------------------------------------------- particle morph
  shapeOf(name) { return this.shapes[name] || this.shapes.girl; }
  morph(t) {
    let k = 0; for (let i = 0; i < KEYS.length; i++) if (KEYS[i][0] <= t) k = i;
    const [t0, name, dur, swirl] = KEYS[k];
    const B = this.shapeOf(name), A = this.shapeOf(k > 0 ? KEYS[k - 1][1] : name);
    const local = (t - t0) / Math.max(dur, 1e-3);
    this.morphInfo = { k, name, prev: k > 0 ? KEYS[k - 1][1] : name, local: clamp(local), t0 };
    if (local >= 1 || A === B && swirl === 0) {
      if (this._lastStatic !== B) { this.pos.set(B.pos); this.col.set(B.col); this._lastStatic = B; this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; }
      return;
    }
    this._lastStatic = null;
    const S = 0.4, ap = A.pos, bp = B.pos, ac = A.col, bc = B.col, P = this.pos, C = this.col, D = this.dir, dl = this.delay;
    for (let i = 0; i < N; i++) {
      let e = (local - dl[i] * S) / (1 - S); e = e < 0 ? 0 : e > 1 ? 1 : e;
      e = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
      const sw = Math.sin(Math.PI * e) * swirl, j = i * 3;
      P[j] = ap[j] + (bp[j] - ap[j]) * e + D[j] * sw;
      P[j + 1] = ap[j + 1] + (bp[j + 1] - ap[j + 1]) * e + D[j + 1] * sw;
      P[j + 2] = ap[j + 2] + (bp[j + 2] - ap[j + 2]) * e + D[j + 2] * sw;
      C[j] = ac[j] + (bc[j] - ac[j]) * e; C[j + 1] = ac[j + 1] + (bc[j + 1] - ac[j + 1]) * e; C[j + 2] = ac[j + 2] + (bc[j + 2] - ac[j + 2]) * e;
    }
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true;
  }

  // ---------------------------------------------------------------- per-frame direction
  update(t, A) {
    const s = section(t);
    const beat = A.beatPulse(t), bar = A.barPulse(t), bass = A.bass(t), on = A.onset(t), rms = A.avg(A.d.rms, t, 8);
    this.morph(t);
    const U = this.pMat.uniforms, B = this.bgMat.uniforms, G = this.gridMat.uniforms, ST = this.starMat.uniforms;
    U.uTime.value = t; B.uTime.value = t; G.uTime.value = t; ST.uTime.value = t;
    B.uBeat.value = beat;

    // defaults
    const fx = { bloom: 0.9, bloomRadius: 0.5, rgb: 0.0015, glitch: 0, scan: 0.12, vignette: 0.55, grain: 0.06, flash: 0, invert: 0, sat: 1, crt: 0, fade: 0, tint: [1, 1, 1], tintMix: 0, mono: 0 };
    let size = 1.25, noise = 0.03, explode = 0, erase = 0, glitch = 0, opacity = 1, vib = 0, tintMix = 0, tint = [1, 0.15, 0.2];
    let neb = 0.5, tun = 0, spi = 0, kal = 0, red = 0, rain = 0, tspeed = 1, bright = 1;
    let colA = 0x0a2a48, colB = 0x2a0a40, base = 0x02040a;
    let gridA = 0, gridCol = 0x5ef2ff, gridScroll = 0, starA = 0, travel = t * 2;
    let cam = { pos: [0, 0, 22], look: [0, 0, 0], fov: 45, roll: 0 };
    let rotY = null, gpos = [0, 0, 0], gscale = 1;
    const mi = this.morphInfo;
    const pieceVis = [0, 0, 0, 0, 0, 0]; let piecePos = null; let shieldA = 0;

    switch (s.id) {
      case 'boot': {
        // CRT boot: particles assemble from 5.16
        opacity = smooth(4.6, 7.5, t);
        neb = 0.25 * smooth(8, 14, t); base = 0x010203;
        gridA = smooth(10.9, 12.4, t) * 0.9;
        starA = smooth(11, 14, t) * 0.6;
        shieldA = win(t, 1.33, 4.2, 0.4, 0.8);
        for (let i = 0; i < 6; i++) pieceVis[i] = win(t, 3.58 + i * 0.12, 9.5, 0.2, 1.5);
        piecePos = i => { const k = easeOutCubic((t - 3.58 - i * 0.12) / 0.9); const a = i / 6 * TAU + t * 0.2; return [Math.cos(a) * 7, lerp(14, -4.6, k) + Math.sin(t * 2 + i) * 0.15 * k, Math.sin(a) * 7 - 2]; };
        cam = { pos: [Math.sin(t * 0.15) * 3, 1.5 - t * 0.05, 30 - t * 0.5], look: [0, 0, 0], fov: 42, roll: 0 };
        if (t > 12.47) { const k = easeInOut((t - 12.47) / 3.5); cam.pos = [lerp(cam.pos[0], 0, k), lerp(cam.pos[1], 3, k), lerp(cam.pos[2], 34, k)]; }
        noise = 0.04 + (t > 12.47 ? smooth(14.6, 16, t) * 0.3 : 0);
        explode = smooth(15.0, 16.04, t) * 6;
        fx.crt = 1 - smooth(10.9, 13.5, t);
        fx.scan = 0.25 - smooth(10.9, 14, t) * 0.12;
        fx.flash = Math.max(0, 1 - Math.abs(t - 15.95) / 0.12) * 0.8;
        size = 1.15;
        break;
      }
      case 'title': {
        neb = 0.75; colA = 0x0d3b5c; colB = 0x3b1360; base = 0x03060f;
        gridA = 1; starA = 1; travel = t * 6;
        gridScroll = t * 1.2;
        noise = 0.05 + bass * 0.08;
        explode = (1 - smooth(16.04, 17.6, t)) * 6 + beat * 0.15;
        const lt = s.lt;
        if (t < 22.4) cam = { pos: [Math.sin(lt * 0.12) * 4, 0.5 + Math.sin(lt * 0.3) * 0.5, 26 - lt * 0.35], look: [0, 0, 0], fov: 45, roll: Math.sin(lt * 0.2) * 0.02 };
        else { const a = (t - 22.4) * 0.22 - 0.6; cam = { pos: [Math.sin(a) * 24, 2.5 + Math.sin(t * 0.5) * 1, Math.cos(a) * 24], look: [0, 0.5, 0], fov: 42, roll: 0 }; }
        for (let i = 0; i < 6; i++) pieceVis[i] = smooth(22.4, 24, t) * 0.9;
        piecePos = i => { const a = i / 6 * TAU + t * 0.35; return [Math.cos(a) * 9, Math.sin(t * 0.8 + i * 2) * 1.5 + 1, Math.sin(a) * 9]; };
        fx.bloom = 1.0 + beat * 0.25;
        fx.flash = Math.max(0, 1 - (t - 16.04) / 0.5) * 0.9;
        break;
      }
      case 'math': {
        neb = 0.55; colA = 0x0b1d4a; colB = 0x0b3a4a; base = 0x020414;
        gridA = 0.5; gridCol = 0x3a7bff; starA = 0.6; travel = t * 1.5;
        noise = 0.025; rain = 0.12;
        const a = s.lt * 0.15;
        cam = { pos: [Math.sin(a) * 4, 1 + Math.sin(a * 2) * 0.8, 20], look: [0, 0, 0], fov: 45, roll: 0 };
        if (t > 40.36) cam.pos[2] = 21 - smooth(40.36, 44, t) * 2;
        explode = beat * 0.12;
        fx.bloom = 1.0;
        break;
      }
      case 'pre1': {
        colA = 0x14306a; colB = 0x40107a; base = 0x030312; neb = 0.5; starA = 0.6;
        if (t < 47.27) { // AC/DC
          gridA = 0.6; gridCol = 0xffd27a; neb = 0.45;
          vib = 0.04 + bass * 0.12;
          cam = { pos: [0, 0.5, 21], look: [0, 0, 0], fov: 45, roll: 0 };
          fx.rgb = 0.002 + on * 0.004;
        } else if (t < 50.95) { // dizzy
          spi = 0.5 + 0.3 * smooth(47.27, 50, t); colA = 0x6a2cff; colB = 0x1ad6ff;
          const k = (t - 47.27);
          cam = { pos: [Math.sin(k * 1.4) * 22, 6 * Math.sin(k * 0.9), Math.cos(k * 1.4) * 22], look: [0, 0, 0], fov: 50, roll: Math.sin(k * 1.2) * 0.35 };
          fx.rgb = 0.004 + 0.004 * Math.sin(t * 3) ** 2; fx.bloom = 1.2;
          noise = 0.1;
        } else if (t < 54.74) { // AD/BC travel
          tun = 0.9; tspeed = 2.5 + smooth(50.95, 54, t) * 3; colA = 0xffd27a; colB = 0x3a8bff; neb = 0.2;
          starA = 1; travel = t * 40;
          cam = { pos: [0, 0, 16 + Math.sin(t * 2) * 0.3], look: [0, 0, -20], fov: 60, roll: (t - 50.95) * 0.25 };
          fx.rgb = 0.003;
        } else { // unite deeply
          neb = 0.8; colA = 0x0d4d6a; colB = 0x6a0d4d;
          const k = t - 54.74;
          cam = { pos: [Math.sin(k * 0.5) * 16, Math.sin(k * 0.3) * 3, Math.cos(k * 0.5) * 16], look: [0, 0, 0], fov: 45, roll: 0 };
          fx.bloom = 1.15;
        }
        break;
      }
      case 'cho1': {
        kal = 0.22 + bar * 0.15; neb = 0.3; colA = 0x18e0ff; colB = 0xff3fa8; base = 0x040010;
        gridA = 0.9; gridCol = 0xff6fa8; gridScroll = t * 3; starA = 1; travel = t * 12;
        noise = 0.04 + bass * 0.06; explode = beat * 0.35;
        const k = s.lt;
        cam = { pos: [Math.sin(k * 0.3) * 6, 1 + Math.sin(k * 0.5), 22 - Math.sin(k * 0.2) * 3], look: [0, 0.5, 0], fov: 44 - bar * 1.5, roll: Math.sin(k * 0.4) * 0.05 };
        if (t > 70.02) { cam.pos = [Math.sin(k * 0.4) * 18, 3, Math.cos(k * 0.4) * 18]; kal = 0.15; }
        fx.bloom = 0.8 + beat * 0.3; fx.rgb = 0.002 + beat * 0.003;
        fx.flash = Math.max(0, 1 - (t - 58.65) / 0.35) * 0.7 + Math.max(0, 1 - Math.abs(t - 68.2) / 0.15) * 0.4;
        for (let i = 0; i < 6; i++) pieceVis[i] = 0.7;
        piecePos = i => { const a = i / 6 * TAU - t * 0.6; return [Math.cos(a) * 10, Math.sin(t * 1.3 + i) * 3, Math.sin(a) * 10 - 2]; };
        break;
      }
      case 'verse2': {
        const obj = t < 77.16 ? 0 : t < 80.93 ? 1 : t < 84.6 ? 2 : 3;
        const pal = [[0x3b1466, 0x1d5a2a], [0x66140f, 0x1d5a2a], [0x5a3a10, 0x2a1a08], [0x5a4a10, 0x1a1030]][obj];
        colA = pal[0]; colB = pal[1]; neb = 0.7; base = 0x050308;
        gridA = 0.5; gridCol = [0xb48cff, 0xff6a4a, 0xffb347, 0xffd27a][obj]; starA = 0.5;
        const k = t - [73.53, 77.16, 80.93, 84.6][obj];
        cam = { pos: [Math.sin(k * 0.35) * 5, 0.5 + Math.sin(k * 0.6) * 0.5, 17 - k * 0.4], look: [0, 0, 0], fov: 45, roll: 0 };
        if (obj === 3) { cam = { pos: [0, -2 - k * 0.3, 19 - k * 0.6], look: [0, 1, 0], fov: 48, roll: 0 }; tun = 0.25; tspeed = 0.4; colA = 0xffd27a; }
        explode = beat * 0.15; noise = 0.03;
        fx.bloom = 1.0;
        fx.flash = obj > 0 ? Math.max(0, 1 - (t - [73.53, 77.16, 80.93, 84.6][obj]) / 0.25) * 0.35 : 0;
        break;
      }
      case 'pre2': {
        colA = 0xff6fa8; colB = 0x3a7bff; base = 0x05030c; neb = 0.55; starA = 0.6; gridA = 0.5; gridCol = 0x9d7bff;
        if (t < 91.44) { cam = { pos: [0, 0, 20], look: [0, 0, 0], fov: 45, roll: 0 }; fx.flash = Math.max(0, 1 - Math.abs(t - 90.62) / 0.12) * 0.5; }
        else if (t < 95.28) { tun = 0.35; tspeed = (t - 91.44) * 1.2; colA = 0xffd27a; cam = { pos: [0, 0, 19], look: [0, 0, 0], fov: 45, roll: -(t - 91.44) * 0.4 }; }
        else if (t < 98.93) { cam = { pos: [Math.sin(t) * 2, 0, 18], look: [0, 0, 0], fov: 45, roll: 0 }; fx.flash = Math.max(0, 1 - Math.abs(t - 97.95) / 0.12) * 0.4; }
        else { spi = 0.4 + smooth(98.93, 102.9, t) * 0.6; colA = 0xb44cff; colB = 0xff4ca8; const k = t - 98.93; cam = { pos: [Math.sin(k * 0.8) * 3, 14 + k, 6], look: [0, 0, 0], fov: 50 + k * 3, roll: k * 0.5 }; noise = 0.1 + k * 0.05; fx.rgb = 0.003 + k * 0.001; }
        explode = beat * 0.15;
        break;
      }
      case 'cho2': {
        const left = smooth(110.0, 111.0, t);
        colA = 0x18e0ff; colB = 0x7a3cff; base = 0x020410; neb = 0.6 - left * 0.3; kal = (0.45 + bar * 0.2) * (1 - left);
        gridA = 0.9 - left * 0.4; gridCol = 0x5ef2ff; gridScroll = t * 3 * (1 - left); starA = 1 - left * 0.6; travel = t * 10;
        vib = t < 110.3 ? bass * 0.25 : 0; noise = 0.04;
        const k = s.lt;
        cam = { pos: [Math.sin(k * 0.3) * 5, 1, 21], look: [0, 0.5, 0], fov: 44 - bar, roll: 0 };
        fx.bloom = 1.1 + beat * 0.3 * (1 - left);
        fx.flash = Math.max(0, 1 - (t - 102.93) / 0.35) * 0.6;
        if (t >= 110.3) {
          // "you have left" x5: each hit pushes particles away and desaturates
          const hits = [110.3, 111.98, 112.89, 113.75, 114.65, 115.6];
          let n = 0, last = 110.3; for (const h of hits) if (t >= h) { n++; last = h; }
          explode = n * 0.6 + Math.exp(-(t - last) * 5) * 2;
          fx.sat = Math.max(0.1, 1 - n * 0.18);
          fx.flash = Math.exp(-(t - last) * 9) * 0.35;
          fx.glitch = Math.exp(-(t - last) * 7) * 0.6;
          const iso = smooth(115.6, 117.9, t);
          cam = { pos: [0, 1 + iso * 10, 22 + n * 4 + iso * 40], look: [0, 0, 0], fov: 44, roll: 0 };
          kal = 0; neb = 0.2;
        }
        break;
      }
      case 'erase': {
        colA = 0x2a3a4a; colB = 0x1a1a2a; base = 0x020306; neb = 0.4; gridA = 0.35; gridCol = 0x8899aa; starA = 0.3;
        fx.sat = 0.25;
        erase = t < 121.8 ? smooth(119.81, 121.7, t) * 0.75 : 0;
        noise = 0.04; glitch = t < 121.8 ? smooth(119.5, 121.5, t) * 0.4 : 0;
        cam = { pos: [0, 0.5, 20 - s.lt * 0.2], look: [0, 0.3, 0], fov: 45, roll: 0 };
        if (t > 121.8) { cam = { pos: [Math.sin(t * 0.2) * 1.5, 0, 15 - (t - 121.8) * 0.3], look: [0, 0, 0], fov: 45, roll: 0 }; fx.sat = 0.3; }
        if (t > 125.33) { // god challenged -> red
          const k = smooth(125.33, 126.5, t);
          fx.sat = lerp(0.3, 1.1, k); colA = 0x5a0a10; colB = 0x200008; red = 0.25 * k; gridCol = 0xff2a3a; gridA = 0.5;
          cam = { pos: [0, 0, 21 - (t - 125.33) * 0.5], look: [0, 0, 0], fov: 46, roll: 0 };
          fx.glitch = (t > 128.42 ? 0.15 + on * 0.5 : 0);
        }
        if (t > 130.74) { red = 0.45; fx.rgb = 0.006; glitch = 0.3 + on * 0.6; fx.flash = Math.max(0, 1 - (t - 130.74) / 0.3) * 0.6; cam.pos = [0, 0, 22]; }
        break;
      }
      case 'break': {
        red = 0.55 + beat * 0.25; colA = 0x5a0008; colB = 0x200005; base = 0x080002; neb = 0.4;
        gridA = 0.8; gridCol = 0xff2a3a; gridScroll = t * 6; starA = 0.4; travel = t * 30;
        tintMix = 1; tint = [1, 0.12, 0.18];
        noise = 0.15 + bass * 0.2; glitch = 0.15 + on * 0.5;
        const k = s.lt;
        cam = { pos: [Math.sin(k * 0.5) * 20, 4 + Math.sin(k * 0.7) * 3, Math.cos(k * 0.5) * 20], look: [0, 0, 0], fov: 48, roll: Math.sin(k) * 0.1 };
        if (t > 141) cam = { pos: [Math.sin(k * 0.3) * 4, 0, 22 - (t - 141) * 0.6], look: [0, 0, 0], fov: 45, roll: 0 };
        fx.rgb = 0.004 + beat * 0.006; fx.glitch = 0.15 + on * 0.6; fx.bloom = 1.2;
        fx.flash = beat * 0.12 * smooth(144, 147.4, t);
        break;
      }
      case 'exec': {
        tintMix = 1; tint = [1, 0.1, 0.15];
        const hits = [...EXEC_TIMES, 158.79, 159.22, 159.66, 160.05, 160.45, 160.88, 161.31];
        let last = 147.48, idx = 0; for (let i = 0; i < hits.length; i++) if (t >= hits[i]) { last = hits[i]; idx = i; }
        const dt = t - last;
        const alt = idx % 2;
        red = alt ? 0.2 : 0.7; base = alt ? 0x100000 : 0x000000; neb = 0.3; colA = 0x5a0008; colB = 0x000000;
        gridA = 0.7; gridCol = 0xff2a3a; gridScroll = t * 8; starA = 0.5; travel = t * 50;
        explode = Math.exp(-dt * 6) * 3 + (dt > 0.55 ? (dt - 0.55) * 6 : 0);
        noise = 0.06;
        const ang = idx * 2.39996;
        cam = { pos: [Math.sin(ang) * 18, Math.cos(ang * 1.7) * 4, Math.cos(ang) * 18], look: [0, 0, 0], fov: 46, roll: Math.sin(ang * 3) * 0.15 };
        if (t > 158.79) cam = { pos: [0, 0, 20 - dt * 2], look: [0, 0, 0], fov: 45, roll: 0 };
        fx.flash = Math.exp(-dt * 10) * 0.7;
        fx.invert = (dt < 0.07 && alt) ? 1 : 0;
        fx.glitch = Math.exp(-dt * 8) * 0.8; fx.rgb = 0.004 + Math.exp(-dt * 6) * 0.01;
        fx.bloom = 1.3;
        break;
      }
      case 'cho3': {
        tintMix = t < 176 ? 0.85 : 0.85 * (1 - smooth(176, 176.96, t)); tint = [1, 0.25, 0.15];
        red = 0.25 + bar * 0.2; colA = 0xff3a1a; colB = 0x5a0010; base = 0x080100; neb = 0.7; kal = 0.25 + beat * 0.2;
        gridA = 1; gridCol = 0xff5a2a; gridScroll = t * 4; starA = 1; travel = t * 25;
        noise = 0.06 + bass * 0.1; explode = beat * 0.8;
        const k = s.lt;
        cam = { pos: [Math.sin(k * 0.35) * 8, 1.5 + Math.sin(k * 0.6), 22 - Math.sin(k * 0.3) * 2], look: [0, 0.5, 0], fov: 44 - bar * 2, roll: Math.sin(k * 0.5) * 0.06 };
        if (t > 169.61 && t < 173.11) cam = { pos: [0, 0, 15], look: [0, 0, 0], fov: 45, roll: 0 };
        if (t > 173.11) { const q = t - 173.11; cam = { pos: [Math.sin(q * 0.4) * 20, 4, Math.cos(q * 0.4) * 20], look: [0, 0, 0], fov: 45, roll: 0 }; }
        fx.bloom = 1.25 + beat * 0.3; fx.rgb = 0.003 + beat * 0.004; glitch = on * 0.3;
        fx.flash = Math.max(0, 1 - (t - 162.23) / 0.4) * 0.8;
        for (let i = 0; i < 6; i++) pieceVis[i] = 0.8;
        piecePos = i => { const a = i / 6 * TAU + t * 0.9; const rr = 11 + Math.sin(t * 2 + i) * 2; return [Math.cos(a) * rr, Math.sin(t * 1.7 + i * 1.3) * 4, Math.sin(a) * rr]; };
        break;
      }
      case 'love': {
        colA = 0xff6fa8; colB = 0xffc0d8; base = 0x0a0208; neb = 0.65; kal = 0.12; starA = 0.8; travel = t * 3;
        gridA = 0.5; gridCol = 0xff8fc0; noise = 0.03 + bass * 0.04; explode = beat * 0.25;
        const k = s.lt;
        cam = { pos: [Math.sin(k * 0.25) * 18, 2 + Math.sin(k * 0.4) * 2, Math.cos(k * 0.25) * 18], look: [0, 0.5, 0], fov: 45, roll: 0 };
        if (t > 187.97 && t < 190.24) cam = { pos: [Math.sin(k * 0.4) * 19, 3, Math.cos(k * 0.4) * 19], look: [0, 0, 0], fov: 45, roll: 0 };
        fx.bloom = 1.15 + beat * 0.2; fx.flash = Math.max(0, 1 - (t - 176.96) / 0.5) * 0.6;
        break;
      }
      case 'outro': {
        const k = s.lt;
        colA = 0x0d2a4a; colB = 0x200a30; base = 0x010206; neb = 0.5 * (1 - smooth(200, 205, t)); starA = 0.7 * (1 - smooth(201, 205, t));
        gridA = 0.4 * (1 - smooth(196, 202, t)); noise = 0.03;
        cam = { pos: [0, 1, 20 + k * 0.6], look: [0, 1 + smooth(199, 203, t) * 6, 0], fov: 45, roll: 0 };
        if (t > 203.6) cam = { pos: [0, 0, 18], look: [0, 0, 0], fov: 45, roll: 0 };
        fx.sat = 0.8; fx.bloom = 1.0;
        size = 1.2 + smooth(203.6, 205.4, t) * 3;
        fx.flash = Math.max(0, 1 - Math.abs(t - 205.56) / 0.08);
        break;
      }
      case 'end': {
        opacity = 0; neb = 0; gridA = 0; starA = 0; base = 0; fx.bloom = 0.6; fx.crt = 0; fx.scan = 0.1;
        break;
      }
    }

    // rotation policy (spin 3D shapes, sway flat ones)
    const rotFor = (n) => { const b = n.replace(/Red$|Pink$/, ''); if (SPIN.has(n) || SPIN.has(b)) return t * 0.35; if (FLAT.has(n) || FLAT.has(b)) return 0.12 * Math.sin(t * 0.5); return 0.35 * Math.sin(t * 0.4); };
    const tk = easeInOut(mi.local);
    rotY = lerp(rotFor(mi.prev), rotFor(mi.name), tk);
    this.pGroup.rotation.set(0, rotY, 0);
    this.pGroup.position.set(...gpos); this.pGroup.scale.setScalar(gscale);
    if (mi.name === 'timeRings') this.pGroup.rotation.set(0, 0, t * 0.6);

    U.uSize.value = size; U.uNoise.value = noise; U.uExplode.value = explode; U.uErase.value = erase; U.uGlitch.value = glitch; U.uOpacity.value = opacity; U.uVib.value = vib;
    const br = (n) => (this.shapes[n] && this.shapes[n].bright) || 0.3;
    U.uBright.value = lerp(br(mi.prev), br(mi.name), tk) * (1 + Math.min(1.5, explode * 0.12));
    U.uTint.value.setRGB(...tint); U.uTintMix.value = tintMix;
    B.uNebula.value = neb; B.uTunnel.value = tun; B.uSpiral.value = spi; B.uKaleido.value = kal; B.uRed.value = red; B.uRain.value = rain; B.uTunnelSpeed.value = tspeed; B.uBright.value = bright;
    B.uColA.value.setHex(colA); B.uColB.value.setHex(colB); B.uBase.value.setHex(base);
    G.uAlpha.value = gridA; G.uCol.value.setHex(gridCol); G.uScroll.value = gridScroll;
    const pb = A.beat(t) - Math.floor(A.beat(t)); G.uPulseR.value = pb * 40; G.uPulseA.value = (1 - pb) * 0.8 * (0.4 + bass);
    ST.uAlpha.value = starA; ST.uTravel.value = travel;

    // pieces
    this.pieces.forEach((m, i) => {
      m.material.opacity = pieceVis[i]; m.visible = pieceVis[i] > 0.001;
      if (m.visible && piecePos) { const p = piecePos(i); m.position.set(...p); m.rotation.set(t * 0.5 + i, t * 0.7 + i * 2, 0); m.scale.setScalar(1 + beat * 0.15); }
      m.material.color.setHex(s.id === 'cho3' ? 0xff5a2a : s.id === 'cho1' ? 0xff8fd0 : 0x5ef2ff);
    });
    this.shield.material.opacity = shieldA * (0.5 + 0.5 * Math.sin(t * 20) ** 2); this.shield.visible = shieldA > 0.001; this.shield.rotation.set(t * 0.2, t * 0.3, 0);
    this.shield.scale.setScalar(0.6 + easeOutCubic((t - 1.33) / 1.2) * 0.4);

    // camera with beat shake
    const shake = (s.id === 'break' || s.id === 'exec' || s.id === 'cho3') ? 0.12 * beat : 0.02 * beat;
    const c = this.camera;
    c.position.set(cam.pos[0] + (hash(t * 13.1) - 0.5) * shake, cam.pos[1] + (hash(t * 17.3) - 0.5) * shake, cam.pos[2]);
    c.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    c.lookAt(...cam.look);
    c.fov = cam.fov; c.updateProjectionMatrix();
    this.fx = fx; this.sectionId = s.id;
    return fx;
  }
}
