/* Where does each solid actually land on screen?
   usage: node _tools/visibility.mjs [--day|--night] */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const W = 1000, H = 620;
const argv = process.argv.slice(2);
const NIGHT = argv.includes('--night');

const noop = () => {};
const recCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'canvas') return { width: W, height: H };
    if (k === 'measureText') return () => ({ width: 8 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    return noop;
  },
  set() { return true; },
});
const canvas = {
  width: W, height: H, style: {},
  getContext: () => recCtx,
  addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  classList: { add: noop, remove: noop },
};
const sandbox = {
  console, devicePixelRatio: 1, innerWidth: W, innerHeight: H,
  addEventListener: noop, removeEventListener: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  setTimeout: (f) => setTimeout(f, 0), clearTimeout, performance: { now: () => 0 },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  getElementById: (id) => (id === 'stage' ? canvas : { textContent: '', classList: { add: noop, remove: noop } }),
  addEventListener: noop, createElement: () => canvas, documentElement: { style: {} },
};
createContext(sandbox);

const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio', 'interact', 'layout'];
const files = ENGINE.map((n) => 'js/' + n + '.js');
for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
files.push('js/build.js', 'js/main.js');
for (const f of files) runInContext(readFileSync(join(ROOT, f), 'utf8'), sandbox, { filename: f });

const PLR = sandbox.PLR;
PLR.app.resize();
if (NIGHT) { PLR.state.override = true; PLR.state.phase = 1; PLR.state.ch.room = 1; }
else { PLR.state.override = false; PLR.state.phase = 0; PLR.state.ch.room = 0; }
for (let t = 0; t < 6; t += 1 / 60) {
  PLR.state.update(1 / 60);
  PLR.interact.Act.step(1 / 60);
  const pal = PLR.app.renderer.palette;
  const target = PLR.palette.build(PLR.state.phase);
  for (const k in target) pal[k] = target[k];
  PLR.app.scene.update(1 / 60, PLR.state);
}
PLR.app.renderer.render(PLR.app.scene);

const r = PLR.app.renderer;
const cam = r.cam;
console.log('camera pos=' + JSON.stringify(cam.pos.map((v) => +v.toFixed(1)))
  + ' yaw=' + cam.yaw.toFixed(3) + ' pitch=' + cam.pitch.toFixed(3) + ' focal=' + r.focal);
// the horizontal half-angle the plate actually covers
const halfX = Math.atan((W / 2) / r.focal);
const halfY = Math.atan((H / 2) / r.focal);
console.log('plate half-angle: x=' + (halfX * 180 / Math.PI).toFixed(1) + 'deg y=' + (halfY * 180 / Math.PI).toFixed(1) + 'deg');

const tmp = [0, 0, 0];
const overflow = [];
for (const s of PLR.app.scene.solids) {
  if (!s.faces.length) continue;
  const b = s.worldBounds();
  if (!b) continue;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, front = 0;
  for (let i = 0; i < 8; i++) {
    const p = [(i & 1) ? b.hi[0] : b.lo[0], (i & 2) ? b.hi[1] : b.lo[1], (i & 4) ? b.hi[2] : b.lo[2]];
    const q = r.projectPoint(p, tmp);
    if (q[2] <= r.near) continue;
    front++;
    if (q[0] < minX) minX = q[0];
    if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1];
    if (q[1] > maxY) maxY = q[1];
  }
  if (!front) continue;
  const over = Math.max(0, -minX) + Math.max(0, maxX - W) + Math.max(0, -minY) + Math.max(0, maxY - H);
  if (over > 1) {
    overflow.push({
      n: s.name || ('#' + s.id), over: Math.round(over),
      box: 'x[' + Math.round(minX) + ',' + Math.round(maxX) + '] y[' + Math.round(minY) + ',' + Math.round(maxY) + ']',
    });
  }
}
overflow.sort((a, b) => b.over - a.over);
console.log('--- solids whose projected box leaves the plate (worst first) ---');
for (const o of overflow.slice(0, 14)) {
  console.log('  ' + o.n.padEnd(16) + 'overflow=' + String(o.over).padEnd(8) + o.box);
}
console.log('  total overflowing: ' + overflow.length);

console.log('--- what fills the lower-left / lower-right of the plate ---');
console.log('left wall x=' + PLR.layout.x0 + '  right wall x=' + PLR.layout.x1);
const probes = [
  ['door centre', [-252, 101, 322]],
  ['switch', [-252, 128, 214]],
  ['sofa seat', [200, 42, 200]],
  ['coffee table', [182, 40, 300]],
  ['rug centre', [100, 1, 300]],
  ['record', [196, 47, 300]],
];
for (const [label, p] of probes) {
  const q = r.projectPoint(p, tmp);
  const vis = q[2] > r.near && q[0] > 0 && q[0] < W && q[1] > 0 && q[1] < H;
  console.log('  ' + label.padEnd(14) + ' -> screen [' + Math.round(q[0]) + ',' + Math.round(q[1]) + '] depth ' + Math.round(q[2]) + (vis ? '  ON SCREEN' : '  off screen'));
}
