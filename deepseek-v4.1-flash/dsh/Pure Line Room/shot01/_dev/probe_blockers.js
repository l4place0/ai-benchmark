// probe: state and blockers for the flickering unreachable set
const it = app.interact;
const r = app.renderer;
const M = window.M3;
const targets = ['lamp', 'mug', 'notebook', 'chair'];
const out = { curtainOpen: app.sctx.curtainOpen, curtainGathered: app.sctx.curtainGathered, blind: app.sctx.blindState && app.sctx.blindState.bundle };
out.items = {};
for (const id of targets) {
  const o = it.get(id);
  const b = it.worldBox(o);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const p = r.project(c);
  const ray = p ? r.unproject(p[0], p[1]) : null;
  const blockers = [];
  if (ray) {
    for (const q of it.reg) {
      if (q === o) continue;
      const qb = it.worldBox(q);
      const t = M.rayAABB(ray.origin, ray.dir, qb.min, qb.max);
      if (t >= 0) blockers.push({ id: q.id, t: +t.toFixed(2), score: +(t - (q.priority || 0) * 0.09).toFixed(2) });
    }
    blockers.sort((a, b2) => a.score - b2.score);
  }
  const hit = p ? it.pick(p[0], p[1]) : null;
  out.items[id] = {
    centre: c.map((v) => +v.toFixed(2)),
    box: [b.min.map((v) => +v.toFixed(2)), b.max.map((v) => +v.toFixed(2))],
    px: p ? [Math.round(p[0]), Math.round(p[1])] : null,
    winner: hit ? hit.obj.id : null,
    topBlockers: blockers.slice(0, 3)
  };
}
return out;
