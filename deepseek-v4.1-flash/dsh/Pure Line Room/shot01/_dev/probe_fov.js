// probe: for the current camera, how centred is each key object?
const r = app.renderer;
const b = r.basis;
const key = {
  door: [-1.68, 1.05, 1.33],
  bookcase: [-0.58, 1.00, -2.42],
  window: [1.70, 1.60, -0.70],
  desk: [1.32, 0.60, -1.05],
  globe: [1.56, 0.85, -0.38],
  switch: [-1.69, 1.22, 0.62],
  sofa: [-0.10, 0.45, 2.12],
  table: [-0.10, 0.45, 1.02],
  record: [-1.32, 1.05, 0.92],
  fan: [0, 2.40, 0.30],
  clock: [1.66, 2.02, 0.42],
  chime: [1.42, 2.10, 1.30],
  plant: [-1.34, 0.40, 1.86],
  cushion: [-0.62, 0.55, 1.86],
  rug: [-0.10, 0.02, 1.42],
  picture: [-0.58, 1.72, -2.58]
};
const out = {};
for (const k in key) {
  const p = key[k];
  const d = [p[0] - r.eye[0], p[1] - r.eye[1], p[2] - r.eye[2]];
  const dist = Math.hypot(d[0], d[1], d[2]) || 1;
  const fwd = (d[0] * b.f[0] + d[1] * b.f[1] + d[2] * b.f[2]) / dist;
  const s = r.project(p);
  out[k] = {
    offAxisDeg: +(Math.acos(Math.max(-1, Math.min(1, fwd))) * 180 / Math.PI).toFixed(1),
    dist: +dist.toFixed(2),
    ndc: s ? [+(s[0] / r.width * 2 - 1).toFixed(2), +(1 - s[1] / r.height * 2).toFixed(2)] : null
  };
}
const inFrame = Object.keys(out).filter((k) => out[k].ndc && Math.abs(out[k].ndc[0]) <= 1 && Math.abs(out[k].ndc[1]) <= 1);
const halfX = Math.atan(r.tanX) * 180 / Math.PI;
const halfY = Math.atan(r.tanY) * 180 / Math.PI;
return {
  eye: r.eye.map((v) => +v.toFixed(2)),
  halfFov: { x: +halfX.toFixed(1), y: +halfY.toFixed(1) },
  inFrameCount: inFrame.length,
  inFrame,
  offFrame: Object.keys(out).filter((k) => inFrame.indexOf(k) < 0),
  detail: out
};
