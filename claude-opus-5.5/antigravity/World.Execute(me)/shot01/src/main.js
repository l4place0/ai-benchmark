// Bootstrap: assets, shapes, renderer, post-processing, deterministic frame API
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Audio, DURATION, FPS } from './timeline.js';
import { makeProcedural, imageShape, svgShape, textShape, compose, recolor, loadImage } from './shapes.js';
import { World } from './world.js';
import { Overlay, asciiFromImage } from './overlay.js';

THREE.ColorManagement.enabled = false;
const W = 1920, H = 1080;
const params = new URLSearchParams(location.search);

const OVERLAY_SHADER = {
  uniforms: { tDiffuse: { value: null }, tOver: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse, tOver; varying vec2 vUv;
    void main(){ vec4 b = texture2D(tDiffuse, vUv); vec4 o = texture2D(tOver, vUv); gl_FragColor = vec4(mix(b.rgb, o.rgb, o.a), 1.); }`,
};
const FINAL_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRgb: { value: 0 }, uGlitch: { value: 0 }, uScan: { value: 0 }, uVig: { value: 0 }, uGrain: { value: 0 }, uFlash: { value: 0 }, uInvert: { value: 0 }, uSat: { value: 1 }, uCrt: { value: 0 }, uFade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uRgb, uGlitch, uScan, uVig, uGrain, uFlash, uInvert, uSat, uCrt, uFade;
    varying vec2 vUv;
    float h(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    void main(){
      vec2 uv = vUv;
      if (uCrt > 0.) { vec2 c = uv*2.-1.; c *= 1. + uCrt*0.06*dot(c.yx, c.yx); uv = c*.5+.5; }
      float bt = floor(uTime*24.);
      float row = floor(uv.y*28.);
      float gn = h(vec2(row, bt));
      if (gn < uGlitch*0.45) uv.x += (h(vec2(bt, row)) - .5) * 0.18 * uGlitch;
      vec2 d = uv - .5;
      float sh = uRgb + uGlitch * 0.004 * step(gn, uGlitch*0.45);
      vec3 col = vec3(texture2D(tDiffuse, uv + d*sh*2. + vec2(sh, 0.)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*sh*2. - vec2(sh, 0.)).b);
      float l = dot(col, vec3(.299,.587,.114)); col = mix(vec3(l), col, uSat);
      col *= 1. - uScan * (0.5 + 0.5 * sin(vUv.y * 1080. * 3.14159));
      col *= 1. - uVig * pow(length(vUv - .5) * 1.3, 2.2);
      col += (h(vUv * 1000. + fract(uTime) * 100.) - .5) * uGrain;
      col = mix(col, 1. - col, uInvert);
      col += uFlash;
      col *= 1. - uFade;
      if (uCrt > 0. && (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.)) col = vec3(0.);
      gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
    }`,
};

async function loadFonts() {
  const list = [['JB', 'JetBrainsMono.ttf', '100 800'], ['Orb', 'Orbitron.ttf', '400 900'], ['VT', 'VT323-Regular.ttf', '400'], ['Cor', 'CormorantGaramond-Italic.ttf', '300 700'], ['STM', 'ShareTechMono-Regular.ttf', '400']];
  for (const [name, file, weight] of list) {
    const f = new FontFace(name, `url(../assets/fonts/${file})`, { weight });
    await f.load(); document.fonts.add(f);
  }
}

async function buildShapes() {
  const S = makeProcedural();
  S.girl = await imageShape('../assets/img/girl_full.jpg', { height: 12.6, pow: 1.5, thresh: 0.14, depth: 1.0, jitterZ: 0.35, res: 520 }, 101);
  S.face = await imageShape('../assets/img/girl_face.jpg', { height: 11.5, pow: 1.4, thresh: 0.16, depth: 1.2, jitterZ: 0.3, res: 520 }, 102);
  S.eggplant = await svgShape('../assets/emoji/twe_eggplant.svg', { height: 10.5, depth: 1.6 }, 103);
  S.tomato = await svgShape('../assets/emoji/twe_tomato.svg', { height: 10, depth: 1.8 }, 104);
  S.cat = await svgShape('../assets/emoji/twe_cat.svg', { height: 11, depth: 1.3 }, 105);
  S.title = textShape('world.execute(me);', { font: 'Orb', size: 230, width: 19, tint: 0xbff6ff }, 106);
  S.txtExec = textShape('EXECUTION', { font: 'Orb', size: 300, width: 19, tint: 0xffffff }, 107);
  S.txtIllegal = textShape('ILLEGAL\nARGUMENTS', { font: 'Orb', size: 230, width: 18, tint: 0xff3a4a }, 108);
  for (let i = 1; i <= 6; i++) S['n' + i] = textShape(String(i), { font: 'Orb', size: 560, width: 18, tint: 0xff2a3a }, 110 + i);
  S.girlcage = compose(S.girl, S.cage, 0.3);
  S.girlcagePink = recolor(S.girlcage, 0xff6fa8, 0.35);
  const RED = 0xff2a3a;
  for (const k of ['girl', 'face', 'eye', 'txtExec', 'lattice', 'circle', 'sine', 'infinity', 'eggplant', 'tomato', 'cat', 'helix', 'clock', 'sphere', 'venus']) S[k + 'Red'] = recolor(S[k], RED, 0.25);
  // density-normalized brightness
  for (const k in S) {
    const p = S[k].pos, cells = new Set();
    for (let i = 0; i < p.length; i += 3) cells.add(Math.round(p[i] / 0.25) * 100003 + Math.round(p[i + 1] / 0.25));
    const d = (p.length / 3) / cells.size;
    S[k].dens = d;
    S[k].bright = Math.min(0.6, Math.max(0.02, 2.4 / Math.sqrt(d)));
  }
  return S;
}

async function main() {
  const ui = document.getElementById('ui');
  ui.textContent = 'loading...';
  await loadFonts();
  const analysis = await (await fetch('../audio/analysis.json')).json();
  const A = new Audio(analysis);
  const shapes = await buildShapes();
  if (params.has('debug')) console.warn('bright ' + JSON.stringify(Object.fromEntries(Object.entries(shapes).map(([k, v]) => [k, +v.dens.toFixed(1) + '/' + v.bright.toFixed(3)]))));
  const catImg = await loadImage('../assets/img/tabby_photo.jpg');
  const ascii = asciiFromImage(catImg, 96, 60);

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const world = new World(renderer, shapes);

  const overCanvas = document.getElementById('over');
  const overlay = new Overlay(overCanvas, { ascii });
  const overTex = new THREE.CanvasTexture(overCanvas);
  overTex.minFilter = THREE.LinearFilter; overTex.generateMipmaps = false;

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(1); composer.setSize(W, H);
  const bgPass = new RenderPass(world.bgScene, world.bgCam);
  const scPass = new RenderPass(world.scene, world.camera); scPass.clear = false; scPass.clearDepth = true;
  const ovPass = new ShaderPass(OVERLAY_SHADER); ovPass.uniforms.tOver.value = overTex;
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0.5, 0.2);
  const fin = new ShaderPass(FINAL_SHADER);
  composer.addPass(bgPass); composer.addPass(scPass); composer.addPass(bloom); composer.addPass(ovPass); composer.addPass(fin);

  const v = new THREE.Vector3();
  const proj = (x, y, z) => { v.set(x, y, z).applyMatrix4(world.pGroup.matrixWorld).project(world.camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

  function renderAt(t) {
    const fx = world.update(t, A);
    world.scene.updateMatrixWorld(true);
    world.camera.updateMatrixWorld(true);
    overlay.draw(t, A, proj);
    overTex.needsUpdate = true;
    bloom.strength = fx.bloom * 0.75; bloom.radius = fx.bloomRadius; bloom.threshold = 0.22;
    const U = fin.uniforms;
    U.uTime.value = t; U.uRgb.value = fx.rgb; U.uGlitch.value = fx.glitch; U.uScan.value = fx.scan; U.uVig.value = fx.vignette; U.uGrain.value = fx.grain;
    U.uFlash.value = Math.min(1, fx.flash); U.uInvert.value = fx.invert; U.uSat.value = fx.sat; U.uCrt.value = fx.crt; U.uFade.value = fx.fade;
    composer.render();
  }

  window.TOTAL_FRAMES = Math.ceil(DURATION * FPS);
  window.renderFrame = (f) => { renderAt(f / FPS); return true; };
  window.captureFrame = (q = 0.95) => canvas.toDataURL('image/jpeg', q);
  window.READY = true;
  ui.textContent = '';

  if (params.has('preview')) {
    document.body.classList.add('preview');
    const audio = new window.Audio('../audio/song.wav');
    let start = parseFloat(params.get('t') || '0');
    audio.currentTime = start;
    const go = () => { audio.play(); document.removeEventListener('click', go); };
    document.addEventListener('click', go);
    window.addEventListener('keydown', e => { if (e.key === 'ArrowRight') audio.currentTime += 5; if (e.key === 'ArrowLeft') audio.currentTime -= 5; if (e.key === ' ') audio.paused ? audio.play() : audio.pause(); });
    const loop = () => { const t = audio.currentTime; renderAt(t); ui.textContent = t.toFixed(2) + (audio.paused ? '  (click to play)' : ''); requestAnimationFrame(loop); };
    loop();
  } else if (params.has('t')) {
    renderAt(parseFloat(params.get('t')));
  }
}
main().catch(e => { console.error(e); document.getElementById('ui').textContent = 'ERROR ' + e.message; window.LOAD_ERROR = String(e.stack || e); });
