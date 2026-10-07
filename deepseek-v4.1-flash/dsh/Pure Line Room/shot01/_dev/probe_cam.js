// probe: camera state + which mesh is displacing it
const c = app.cam;
const r = app.renderer;
const raw = (() => {
  const cp = Math.cos(c.pitch);
  return [
    c.target[0] + Math.sin(c.yaw) * c.dist * cp,
    c.target[1] + Math.sin(c.pitch) * c.dist,
    c.target[2] + Math.cos(c.yaw) * c.dist * cp
  ];
})();
const push = [];
for (let i = 0; i < app.scene.meshes.length; i++) {
  const m = app.scene.meshes[i];
  if (m.noCollide) continue;
  const b = m.getBounds();
  const inside = [0, 1, 2].every((k) => raw[k] >= b.min[k] - 0.3 && raw[k] <= b.max[k] + 0.3);
  if (inside) push.push(i + ':' + (m.name || '?') + ' ' + JSON.stringify(b.min.map((v) => +v.toFixed(2))) + '..' + JSON.stringify(b.max.map((v) => +v.toFixed(2))));
}
return {
  cam: { yaw: +c.yaw.toFixed(3), pitch: +c.pitch.toFixed(3), dist: +c.dist.toFixed(3), target: c.target },
  rawEye: raw.map((v) => +v.toFixed(3)),
  actualEye: r.eye.map((v) => +v.toFixed(3)),
  displaced: push
};
