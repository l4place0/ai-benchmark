// probe: where do the room's own corners land on screen?
const r = app.renderer;
const V = (x, y, z) => {
  const p = r.project([x, y, z]);
  return p ? [Math.round(p[0]), Math.round(p[1]), +p[2].toFixed(2)] : null;
};
const R = app.sctx.ROOM;
return {
  eye: r.eye.map((v) => +v.toFixed(3)),
  target: r.target.map((v) => +v.toFixed(3)),
  screen: [r.width, r.height],
  fov: r.fov, tanX: +r.tanX.toFixed(3), tanY: +r.tanY.toFixed(3),
  // floor corners
  floorNW: V(R.x0, 0, R.z0), floorNE: V(R.x1, 0, R.z0),
  floorSW: V(R.x0, 0, R.z1), floorSE: V(R.x1, 0, R.z1),
  // ceiling corners
  ceilNW: V(R.x0, R.h, R.z0), ceilNE: V(R.x1, R.h, R.z0),
  ceilSW: V(R.x0, R.h, R.z1), ceilSE: V(R.x1, R.h, R.z1),
  // the room's own centre at mid height
  centre: V(0, 1.35, 0),
  bookcaseRight: V(0.54, 1.0, -2.4),
  deskCentre: V(1.32, 0.74, -1.05),
  doorCentre: V(-1.68, 1.0, 1.33),
  sofaCentre: V(-0.1, 0.4, 2.12)
};
