/* _dev/interact_test.js — off-screen vs blocked, per interactive. */
var a = window.PLR.app;
var it = a.interact;
var r = a.renderer;
var W = r.width, H = r.height;
var out = [];
for (var i = 0; i < it.reg.length; i++) {
  var o = it.reg[i];
  var b = it.worldBox(o);
  var c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  var p = r.project(c);
  var onScreen = p && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H;
  var hits = 0, first = null, blocked = {};
  if (p) {
    for (var dy = -60; dy <= 60; dy += 12) {
      var y = p[1] + dy;
      if (y < 2 || y > H - 2) continue;
      for (var x = 2; x < W - 2; x += 6) {
        var h = it.pick(x, y);
        if (!h) continue;
        if (h.obj === o) { hits++; if (!first) first = [x, y]; }
        else blocked[h.obj.id] = (blocked[h.obj.id] || 0) + 1;
      }
    }
  }
  var top = Object.keys(blocked).sort(function (m, n) { return blocked[n] - blocked[m]; }).slice(0, 2);
  out.push(o.id + ' [' + (onScreen ? 'onscreen' : 'OFFSCREEN') + (p ? ' @' + Math.round(p[0]) + ',' + Math.round(p[1]) : '') +
    '] ' + (hits ? hits + 'px' : 'none') + (top.length ? ' blockedBy=' + top.join('/') : ''));
}
return out.join('\n');
