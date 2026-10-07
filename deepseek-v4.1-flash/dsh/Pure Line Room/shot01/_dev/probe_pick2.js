// probe: score breakdown at the chair's screen position
const r = app.renderer;
const it = app.interact;
const M = window.M3;
const chair = it.get('chair');
const b = it.worldBox(chair);
const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const p = r.project(c);
const ray = r.unproject(p[0], p[1]);
const rows = [];
for (const o of it.reg) {
  const box = it.worldBox(o);
  const t = M.rayAABB(ray.origin, ray.dir, box.min, box.max);
  if (t < 0) continue;
  rows.push({
    id: o.id, t: +t.toFixed(3), prio: o.priority || 0,
    score: +(t - (o.priority || 0) * 0.09).toFixed(3),
    box: [box.min.map((v) => +v.toFixed(2)), box.max.map((v) => +v.toFixed(2))]
  });
}
rows.sort((a, b2) => a.score - b2.score);
return { chairCentre: c.map((v) => +v.toFixed(2)), screen: [Math.round(p[0]), Math.round(p[1])], hits: rows.slice(0, 8) };
