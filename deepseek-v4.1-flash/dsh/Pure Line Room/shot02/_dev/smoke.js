// smoke.js — a self-contained renderer rehearsal used during development.
// It builds a miniature room with the same APIs the real content modules use,
// so a bug can be attributed to the engine rather than to content.
//
// Bundled to _dev/smoke.bundle.js and opened by _dev/smoke.html.

import Renderer from '../js/core/renderer.js';
import { Scene } from '../js/core/scene.js';
import { OrbitCamera } from '../js/core/camera.js';
import { makeTheme } from '../js/core/palette.js';
import * as anim from '../js/core/anim.js';
import { clamp } from '../js/core/math3d.js';

const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
const scene = new Scene();
const camera = new OrbitCamera({ yaw: 0.62, pitch: 0.37, radius: 12.4 });

const state = { night: false };
const ctx = {
  scene, camera, state: { get: (k) => state[k], set: (k, v) => { state[k] = v; } },
  ease: anim.ease, damp: anim.damp, clamp, time: 0, nightT: 0, theme: makeTheme(0),
  light: () => {}, audio: { sfx() {}, setLoop() {}, param() {} },
  on: () => {}, set: () => {}, paper: () => scene.paper(),
};

/* --- room shell -------------------------------------------------------- */
const shell = scene.paper();
const P = (x, y, z) => [x, y, z];
shell.quad(P(-3.2, 0, 2.6), P(3.2, 0, 2.6), P(3.2, 0, -2.6), P(-3.2, 0, -2.6), { fill: 'paper', stroke: 'ink', width: 1.6, cull: 'back' });
shell.quad(P(-3.2, 0, -2.6), P(3.2, 0, -2.6), P(3.2, 2.9, -2.6), P(-3.2, 2.9, -2.6), { fill: 'face1', stroke: 'ink', width: 1.6, cull: 'back' });
shell.quad(P(-3.2, 0, 2.6), P(-3.2, 0, -2.6), P(-3.2, 2.9, -2.6), P(-3.2, 2.9, 2.6), { fill: 'face2', stroke: 'ink', width: 1.6, cull: 'back' });
shell.quad(P(3.2, 0, -2.6), P(3.2, 0, 2.6), P(3.2, 2.9, 2.6), P(3.2, 2.9, -2.6), { fill: 'face2', stroke: 'ink', width: 1.6, cull: 'back' });
shell.quad(P(3.2, 0, 2.6), P(-3.2, 0, 2.6), P(-3.2, 2.9, 2.6), P(3.2, 2.9, 2.6), { fill: 'face2', stroke: 'ink', width: 1.6, cull: 'back' });
shell.quad(P(-3.2, 2.9, -2.6), P(3.2, 2.9, -2.6), P(3.2, 2.9, 2.6), P(-3.2, 2.9, 2.6), { fill: 'none', stroke: 'inkSoft', width: 0.7 });

/* --- a test object with interior detail -------------------------------- */
const table = scene.object({ id: 'smoke-table', label: '测试桌' });
const body = table.part('top', { label: '桌面' });
body.builder.box([-0.6, 0.68, -0.35], [0.6, 0.74, 0.35], { fill: 'paper', stroke: 'ink', width: 1.5 });
body.builder.box([-0.55, 0, -0.3], [-0.48, 0.68, -0.23], { fill: 'face1', stroke: 'ink', width: 1.1 });
body.builder.box([0.48, 0, -0.3], [0.55, 0.68, -0.23], { fill: 'face1', stroke: 'ink', width: 1.1 });
body.builder.box([-0.55, 0, 0.23], [-0.48, 0.68, 0.3], { fill: 'face1', stroke: 'ink', width: 1.1 });
body.builder.box([0.48, 0, 0.23], [0.55, 0.68, 0.3], { fill: 'face1', stroke: 'ink', width: 1.1 });
body.builder.cylinder(0, 0.9, 0, 0.16, 0.3, { fill: 'face1', stroke: 'ink', width: 1.1 });
body.builder.quad(P(-0.9, 0.005, -0.6), P(0.9, 0.005, -0.6), P(0.9, 0.005, 0.6), P(-0.9, 0.005, 0.6),
  { fill: 'none', stroke: 'none', hatch: { gap: 7, angle: 32, width: 0.8, alpha: 0.4 } });
table.setPos(0, 0, 0);
let t = 0;
table.onUpdate((dt) => {
  t += dt;
  body.setPos(0, Math.sin(t * 1.2) * 0.05, 0);
});

/* --- picking + loop ---------------------------------------------------- */
renderer.setPickMap(scene.pickMap);

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
}
window.addEventListener('resize', resize);
resize();

const tag = document.getElementById('tag');
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  renderer.buildPickBuffer(scene, camera, ctx.theme);
  const p = renderer.pickAt(e.clientX - r.left, e.clientY - r.top);
  tag.textContent = p ? p.label : '';
});

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  ctx.time += dt;
  scene.update(dt, ctx.time, ctx);
  scene.sync();
  camera.update(dt, window.innerWidth, window.innerHeight, {});
  renderer.draw(scene, camera, ctx.theme, {});
  requestAnimationFrame(frame);
}
requestAnimationFrame((t0) => { last = t0; frame(t0); });

window.__SMOKE__ = { scene, camera, renderer, partPoints: () => null };
