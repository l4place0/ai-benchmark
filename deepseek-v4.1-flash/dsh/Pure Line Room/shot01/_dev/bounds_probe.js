/* _dev/bounds_probe.js — exact mesh AABBs for the interactive objects. */
var a = window.PLR.app;
var it = a.interact;
var out = {};
for (var i = 0; i < it.reg.length; i++) {
  var o = it.reg[i];
  var m = o.mesh;
  var b = m && m.getBounds ? m.getBounds() : null;
  var hb = o.hit;
  out[o.id] = {
    mesh: b ? [b.min.map(function (v) { return +v.toFixed(2); }), b.max.map(function (v) { return +v.toFixed(2); })] : null,
    hit: hb ? [hb.min.map(function (v) { return +v.toFixed(2); }), hb.max.map(function (v) { return +v.toFixed(2); })] : null,
    dyn: !!o.dynamicHit, prio: o.priority || 0,
    size: b ? [(b.max[0] - b.min[0]).toFixed(2), (b.max[1] - b.min[1]).toFixed(2), (b.max[2] - b.min[2]).toFixed(2)] : null
  };
}
return out;
