// probe: reachability of every registered interactive (pick at its screen centre)
const r = app.renderer;
const it = app.interact;
const rows = [];
const missing = [];
for (const o of it.reg) {
  const box = it.worldBox(o);
  const c = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const p = r.project(c);
  let hit = null, hitId = null;
  if (p) {
    hit = it.pick(p[0], p[1]);
    hitId = hit ? hit.obj.id : null;
  }
  const onScreen = p ? (p[0] > 0 && p[0] < r.width && p[1] > 0 && p[1] < r.height) : false;
  rows.push({ id: o.id, onScreen, px: p ? [Math.round(p[0]), Math.round(p[1])] : null, pick: hitId, self: hitId === o.id });
  if (!p || hitId !== o.id) missing.push(o.id + (onScreen ? '' : '(offscreen)') + '->' + hitId);
}
return {
  total: it.reg.length,
  selfHits: rows.filter((x) => x.self).length,
  onScreen: rows.filter((x) => x.onScreen).length,
  missing,
  table: rows
};
