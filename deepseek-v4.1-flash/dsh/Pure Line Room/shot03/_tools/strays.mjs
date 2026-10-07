/* Find vertices that are absurdly far from a solid's own centroid — the
   signature of a stray coordinate, a mis-scaled helper or a double transform.
   usage: node _tools/strays.mjs [nameFilter] */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const filter = process.argv[2] || '';
const noop = () => {};
const recCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'canvas') return { width: 10, height: 10 };
    if (k === 'measureText') return () => ({ width: 8 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    return noop;
  }, set() { return true; },
});
const canvas = { width: 10, height: 10, style: {}, getContext: () => recCtx, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), classList: { add: noop, remove: noop } };
const sb = {
  console, devicePixelRatio: 1, innerWidth: 10, innerHeight: 10,
  addEventListener: noop, removeEventListener: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  setTimeout: (f) => setTimeout(f, 0), clearTimeout, performance: { now: () => 0 },
};
sb.window = sb; sb.globalThis = sb;
sb.document = { readyState: 'complete', getElementById: (id) => (id === 'stage' ? canvas : { textContent: '', classList: { add: noop, remove: noop } }), addEventListener: noop, createElement: () => canvas, documentElement: { style: {} } };
createContext(sb);
const ENGINE = ['math', 'scene', 'graphics', 'renderer', 'palette', 'state', 'audio', 'interact', 'layout'];
const files = ENGINE.map((n) => 'js/' + n + '.js');
for (const n of readdirSync(join(ROOT, 'js', 'objects')).sort()) files.push('js/objects/' + n);
files.push('js/build.js', 'js/main.js');
for (const f of files) runInContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
const PLR = sb.PLR;
PLR.app.resize();
PLR.state.override = false; PLR.state.phase = 0;
for (let t = 0; t < 4; t += 1 / 60) {
  PLR.state.update(1 / 60);
  PLR.interact.Act.step(1 / 60);
  const p = PLR.app.renderer.palette; const q = PLR.palette.build(PLR.state.phase);
  for (const k in q) p[k] = q[k];
  PLR.app.scene.update(1 / 60, PLR.state);
}
const L = PLR.layout;
console.log('room x[' + L.x0 + ',' + L.x1 + '] y[0,' + L.y1 + '] z[' + L.z0 + ',' + L.z1 + ']');
console.log('name'.padEnd(18) + 'verts'.padEnd(8) + 'extent (max dist from centroid)'.padEnd(34) + 'worst vertex');
let flagged = 0;
for (const s of PLR.app.scene.solids) {
  const nm = s.name || ('#' + s.id);
  if (filter && nm.indexOf(filter) < 0) continue;
  const v = s.mesh.verts;
  if (!v.length) { console.log(nm.padEnd(18) + '0'.padEnd(8) + 'EMPTY MESH'); flagged++; continue; }
  // centroid of the LOCAL mesh
  let cx = 0, cy = 0, cz = 0, n = v.length / 3;
  for (let i = 0; i < v.length; i += 3) { cx += v[i]; cy += v[i + 1]; cz += v[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  let worst = 0, wi = -1;
  for (let i = 0; i < v.length; i += 3) {
    const d = Math.hypot(v[i] - cx, v[i + 1] - cy, v[i + 2] - cz);
    if (!(d >= 0)) { worst = Infinity; wi = i; break; }
    if (d > worst) { worst = d; wi = i; }
  }
  const bad = worst > 400 || !isFinite(worst);
  if (bad) {
    flagged++;
    console.log(nm.padEnd(18) + String(n).padEnd(8) + worst.toFixed(0).padEnd(34)
      + '[' + [v[wi], v[wi + 1], v[wi + 2]].map((x) => +(+x).toFixed(1)).join(',') + ']'
      + '  world-origin=[' + [s.world[12], s.world[13], s.world[14]].map((x) => +x.toFixed(0)).join(',') + ']'
      + '  local-extents=[' + [cx, cy, cz].map((x) => +x.toFixed(0)).join(',') + ']');
  }
}
console.log(flagged ? flagged + ' solid(s) with a suspicious extent' : 'no stray geometry');
