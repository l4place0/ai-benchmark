// probe: the final unreachable set, and whether the window can be reached at all
const r = app.renderer;
const it = app.interact;
const ids = ['window', 'notebook', 'cushionL', 'cushionR', 'pictureSmall', 'chime', 'plant'];
const out = {};
for (const id of ids) {
  const o = it.get(id);
  if (!o) { out[id] = 'missing'; continue; }
  const b = it.worldBox(o);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const p = r.project(c);
  let reach = null, competitor = null;
  if (p) {
    const h = it.pick(p[0], p[1]);
    competitor = h ? h.obj.id : null;
    for (let rad = 0; rad <= 300 && !reach; rad += 6) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const x = p[0] + Math.cos(ang) * rad, y = p[1] + Math.sin(ang) * rad;
        if (x < 4 || x > r.width - 4 || y < 4 || y > r.height - 4) continue;
        const hh = it.pick(x, y);
        if (hh && hh.obj === o) { reach = [Math.round(x), Math.round(y)]; break; }
      }
    }
  }
  out[id] = {
    centre: c.map((v) => +v.toFixed(2)),
    px: p ? [Math.round(p[0]), Math.round(p[1])] : null,
    onScreen: p ? (p[0] > 0 && p[0] < r.width && p[1] > 0 && p[1] < r.height) : false,
    pickAtCentre: competitor, reachable: reach
  };
}
return out;
