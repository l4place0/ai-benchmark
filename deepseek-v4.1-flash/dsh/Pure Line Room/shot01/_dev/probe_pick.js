// probe: does screen->world picking work? sample the whole viewport.
const r = app.renderer;
const it = app.interact;
const look = it.pick(r.width / 2, r.height / 2);
const hits = {};
let hitCount = 0;
let total = 0;
for (let y = 40; y < r.height - 40; y += 40) {
  for (let x = 40; x < r.width - 40; x += 40) {
    total++;
    const h = it.pick(x, y);
    if (h) { hitCount++; hits[h.obj.id] = (hits[h.obj.id] || 0) + 1; }
  }
}
// sanity of the ray: the ray through the screen centre must pass near the
// renderer's own look-at target
const ray = r.unproject(r.width / 2, r.height / 2);
let distToTarget = null;
if (ray && r.target) {
  const t = ((r.target[0] - ray.origin[0]) * ray.dir[0] +
             (r.target[1] - ray.origin[1]) * ray.dir[1] +
             (r.target[2] - ray.origin[2]) * ray.dir[2]) /
            (ray.dir[0] * ray.dir[0] + ray.dir[1] * ray.dir[1] + ray.dir[2] * ray.dir[2]);
  const p = [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t, ray.origin[2] + ray.dir[2] * t];
  distToTarget = +Math.hypot(p[0] - r.target[0], p[1] - r.target[1], p[2] - r.target[2]).toFixed(4);
}
return {
  registered: it.reg.length,
  totalProbes: total, hitProbes: hitCount,
  centreHits: Object.keys(hits).length,
  byId: hits,
  rayDistToLookAt: distToTarget,
  centrePick: look ? look.obj.id : null
};
