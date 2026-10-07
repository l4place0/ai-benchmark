// probe: sky quad + camera, to see where the pane really lands
const r = app.renderer;
const wb = app.sctx.windowBox;
const corners = [
  [wb[0] + 0.03, wb[1], wb[2]], [wb[0] + 0.03, wb[1], wb[4]],
  [wb[0] + 0.03, wb[3], wb[4]], [wb[0] + 0.03, wb[3], wb[2]]
];
const proj = corners.map((c) => { const s = r.project(c); return s ? [Math.round(s[0]), Math.round(s[1]), +s[2].toFixed(2)] : null; });
// where is the ceiling plane along those rays?
const ceilHit = corners.map((c) => {
  const d = [c[0] - r.eye[0], c[1] - r.eye[1], c[2] - r.eye[2]];
  const t = (2.72 - r.eye[1]) / d[1];
  return t > 0 ? +(t).toFixed(2) : null;
});
// is the eye inside the room footprint?
const R = app.sctx.ROOM;
return {
  eye: r.eye.map((v) => +v.toFixed(2)),
  insideFootprint: r.eye[0] > R.x0 && r.eye[0] < R.x1 && r.eye[2] > R.z0 && r.eye[2] < R.z1,
  eyeAboveCeiling: r.eye[1] > R.h,
  paneCornersPx: proj,
  distanceToPane: proj.map((p) => (p ? p[2] : null)),
  ceilingHitT: ceilHit,
  windowBox: wb
};
