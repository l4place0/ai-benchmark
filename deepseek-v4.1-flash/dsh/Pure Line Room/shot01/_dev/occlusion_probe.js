/* _dev/occlusion_probe.js — what genuinely occludes each small object?
   Traces the screen ray for each interactive and finds the nearest mesh whose
   faces actually contain the ray, then reports who owns it. */
var a = window.PLR.app;
var it = a.interact;
var r = a.renderer;
var W = r.width, H = r.height;
function meshOwner(m) {
  for (var i = 0; i < it.reg.length; i++) if (it.reg[i].mesh === m) return it.reg[i].id;
  return m.name || '?';
}
// ray/triangle intersection over every face of every mesh
function trace(ox, oy, oz, dx, dy, dz) {
  var best = null;
  for (var mi = 0; mi < a.scene.meshes.length; mi++) {
    var m = a.scene.meshes[mi];
    if (m.hidden) continue;
    var V = m.verts, F = m.faces;
    for (var fi = 0; fi < F.length; fi++) {
      var f = F[fi];
      if (f.hidden) continue;
      var vi = f.vi, n = vi.length;
      for (var k = 1; k + 1 < n; k++) {
        var A = V[vi[0]], B = V[vi[k]], C = V[vi[k + 1]];
        var e1x = B[0] - A[0], e1y = B[1] - A[1], e1z = B[2] - A[2];
        var e2x = C[0] - A[0], e2y = C[1] - A[1], e2z = C[2] - A[2];
        var px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        var det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-9 && det < 1e-9) continue;
        var inv = 1 / det;
        var tx = ox - A[0], ty = oy - A[1], tz = oz - A[2];
        var u = (tx * px + ty * py + tz * pz) * inv;
        if (u < -1e-6 || u > 1 + 1e-6) continue;
        var qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        var v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < -1e-6 || u + v > 1 + 1e-6) continue;
        var t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-4 && (!best || t < best.t)) best = { t: t, mesh: m };
      }
    }
  }
  return best;
}
var out = [];
for (var i = 0; i < it.reg.length; i++) {
  var o = it.reg[i];
  var b = it.worldBox(o);
  var c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  var p = r.project(c);
  if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) { out.push(o.id + ' OFFSCREEN'); continue; }
  var ray = r.unproject(p[0], p[1]);
  var hit = trace(ray.origin[0], ray.origin[1], ray.origin[2], ray.dir[0], ray.dir[1], ray.dir[2]);
  var who = hit ? meshOwner(hit.mesh) : 'nothing';
  out.push(o.id + ' -> ' + who + (who === o.id ? ' OK' : ' BLOCKED') + ' t=' + (hit ? hit.t.toFixed(2) : '-'));
}
return out.join('\n');
