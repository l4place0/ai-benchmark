// probe: curtain mesh bounds vs its registered hit box, right now
const it = app.interact;
const M = window.M3;
const cur = it.get('curtain');
const mesh = cur.mesh;
// force a fresh bounds computation from the live vertices
const live = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
for (const v of mesh.verts) {
  for (let k = 0; k < 3; k++) { live.min[k] = Math.min(live.min[k], v[k]); live.max[k] = Math.max(live.max[k], v[k]); }
}
const cached = JSON.parse(JSON.stringify(mesh.bounds || null));
const dyn = it.worldBox(cur);
const same = Math.hypot(dyn.min[0] - live.min[0], dyn.min[2] - live.min[2]) < 0.01;
return {
  dynamicHit: !!cur.dynamicHit,
  curtainOpen: app.sctx.curtainOpen,
  gathered: app.sctx.curtainGathered,
  cachedBounds: cached,
  liveBounds: { min: live.min.map((v) => +v.toFixed(2)), max: live.max.map((v) => +v.toFixed(2)) },
  worldBox: { min: dyn.min.map((v) => +v.toFixed(2)), max: dyn.max.map((v) => +v.toFixed(2)) },
  dynMatchesLive: same,
  vertCount: mesh.verts.length
};
