// before-hook: isolate a set of meshes by name prefix (comma separated in ISOLATE)
const list = String(__ISOLATE__ || 'fan').split(',');
const idx = [];
const names = app.scene.meshes.map((m, i) => i + ':' + (m.name || '?'));
for (let i = 0; i < app.scene.meshes.length; i++) {
  const n = app.scene.meshes[i].name || '';
  if (list.some((p) => n.indexOf(p) === 0)) idx.push(i);
}
const v = app.viewMode;
v.only = idx; v.sky = false; v.room = true;
app.env.autoTime = false;
app.setEnv({ hour: 12, minute: 0, day: 1 });
return { isolate: list, idx, names };
