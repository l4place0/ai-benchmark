// probe: replicate the sky clip by hand and report each plane's effect
const r = app.renderer;
const R = app.sctx.ROOM;
const wb = app.sctx.windowBox;
const corners = [
  [wb[0] + 0.03, wb[1], wb[2]], [wb[0] + 0.03, wb[1], wb[4]],
  [wb[0] + 0.03, wb[3], wb[4]], [wb[0] + 0.03, wb[3], wb[2]]
];
const eye = r.eye;
const hull = [
  { name: 'x0', n: [-1, 0, 0], c: R.x0 }, { name: 'x1', n: [1, 0, 0], c: R.x1 },
  { name: 'z0', n: [0, 0, -1], c: R.z0 }, { name: 'z1', n: [0, 0, 1], c: R.z1 },
  { name: 'y0', n: [0, -1, 0], c: 0 }, { name: 'y1', n: [0, 1, 0], c: R.h }
];
const log = [];
let quad = corners.slice();
for (const pl of hull) {
  const d = (eye[0] * pl.n[0] + eye[1] * pl.n[1] + eye[2] * pl.n[2]) - pl.c;
  if (Math.abs(d) <= 0.02) { log.push(pl.name + ' skip d=' + d.toFixed(2)); continue; }
  const side = d > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < quad.length; i++) {
    const A = quad[i], B = quad[(i + 1) % quad.length];
    const va = (pl.n[0] * A[0] + pl.n[1] * A[1] + pl.n[2] * A[2] - pl.c) * side;
    const vb = (pl.n[0] * B[0] + pl.n[1] * B[1] + pl.n[2] * B[2] - pl.c) * side;
    const ina = va >= 0, inb = vb >= 0;
    if (ina) out.push(A);
    if (ina !== inb) {
      const t = va / (va - vb);
      out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
    }
  }
  log.push(pl.name + ' d=' + d.toFixed(2) + ' side=' + side + ' q=' + quad.length + '->' + out.length);
  quad = out;
  if (quad.length < 3) break;
}
const scr = quad.map((p) => { const s = r.project(p); return s ? [Math.round(s[0]), Math.round(s[1])] : null; });
// screen y of the ceiling plane at the window's depth
const ceilPoint = [1.728, R.h, -0.70];
const cs = r.project(ceilPoint);
return {
  eye: eye.map((v) => +v.toFixed(2)),
  log,
  clippedQuad: quad.map((p) => p.map((v) => +v.toFixed(2))),
  clippedScr: scr,
  ceilingAtWindowPx: cs ? [Math.round(cs[0]), Math.round(cs[1])] : null,
  windowTopPx: (() => { const s = r.project([1.728, wb[3], -0.70]); return s ? [Math.round(s[0]), Math.round(s[1])] : null; })()
};
