// probe: camera + what's on screen at the default view
const r = app.renderer;
const it = app.interact;
const V = (x, y, z) => {
  const p = r.project([x, y, z]);
  return p ? [Math.round(p[0]), Math.round(p[1])] : null;
};
const R = app.sctx.ROOM;
const reach = [];
for (const o of it.reg) {
  const box = it.worldBox(o);
  const c = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const p = r.project(c);
  let hit = null;
  if (p && p[0] > 0 && p[0] < r.width && p[1] > 0 && p[1] < r.height) {
    const h = it.pick(p[0], p[1]);
    hit = h ? h.obj.id : null;
  }
  reach.push(o.id + '@' + (p ? Math.round(p[0]) + ',' + Math.round(p[1]) : 'off') + '->' + hit);
}
return {
  frontOpen: app.sctx.frontOpen,
  eye: r.eye.map((v) => +v.toFixed(2)),
  target: r.target.map((v) => +v.toFixed(2)),
  corners: {
    floorNW: V(R.x0, 0, R.z0), floorNE: V(R.x1, 0, R.z0),
    floorSE: V(R.x1, 0, R.z1), floorSW: V(R.x0, 0, R.z1),
    ceilNW: V(R.x0, R.h, R.z0), ceilSE: V(R.x1, R.h, R.z1),
    doorC: V(R.x0, 1.0, 1.33), bookC: V(-0.58, 1.0, -2.42),
    deskC: V(1.32, 0.74, -1.05), sofaC: V(-0.1, 0.4, 2.12)
  },
  selfHits: reach.filter((s) => s.split('->')[1] && s.split('@')[0] === s.split('->')[1]).length,
  reach
};
