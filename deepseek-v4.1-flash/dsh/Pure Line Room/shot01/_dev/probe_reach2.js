// probe: why are some interactives unreachable from the default view?
const r = app.renderer;
const it = app.interact;
const out = [];
for (const o of it.reg) {
  const b = it.worldBox(o);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const p = r.project(c);
  let best = null, bestId = null, found = null;
  if (p) {
    for (let rad = 0; rad <= 240 && !found; rad += 10) {
      for (let a = 0; a < 20; a++) {
        const ang = (a / 20) * Math.PI * 2;
        const x = p[0] + Math.cos(ang) * rad, y = p[1] + Math.sin(ang) * rad;
        if (x < 4 || x > r.width - 4 || y < 4 || y > r.height - 4) continue;
        const h = it.pick(x, y);
        if (h && h.obj === o) { found = [Math.round(x), Math.round(y), rad]; break; }
      }
    }
    best = it.pick(p[0], p[1]);
    bestId = best ? best.obj.id : null;
  }
  out.push({
    id: o.id,
    px: p ? [Math.round(p[0]), Math.round(p[1])] : null,
    onScreen: p ? (p[0] > 0 && p[0] < r.width && p[1] > 0 && p[1] < r.height) : false,
    picks: bestId, reach: found, prio: o.priority || 0
  });
}
return { items: out.filter((x) => !x.reach || x.picks !== x.id) };
