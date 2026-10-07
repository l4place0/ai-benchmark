// probe: verify project() against an independent reconstruction of the maths
const r = app.renderer;
const M = window.M3;
const p = [0, 0, 0];
const v = M.xformPoint(r.viewM, p);
const d = -v[2];
const manual = [
  (v[0] / (d * r.tanX) * 0.5 + 0.5) * r.width,
  (0.5 - v[1] / (d * r.tanY) * 0.5) * r.height
];
const got = r.project(p);
const paneCorner = [1.728, 2.198, -1.358];
const v2 = M.xformPoint(r.viewM, paneCorner);
const d2 = -v2[2];
const manual2 = [
  (v2[0] / (d2 * r.tanX) * 0.5 + 0.5) * r.width,
  (0.5 - v2[1] / (d2 * r.tanY) * 0.5) * r.height
];
return {
  origin: { manual: manual.map((x) => +x.toFixed(1)), got: got ? [+got[0].toFixed(1), +got[1].toFixed(1), +got[2].toFixed(2)] : null },
  paneCorner: {
    view: v2.map((x) => +x.toFixed(2)),
    depth: +d2.toFixed(2),
    manual: manual2.map((x) => +x.toFixed(1)),
    got: (() => { const s = r.project(paneCorner); return s ? [+s[0].toFixed(1), +s[1].toFixed(1), +s[2].toFixed(2)] : null; })()
  },
  tan: [r.tanX, r.tanY], fov: r.fov, wh: [r.width, r.height],
  basis: { f: r.basis.f.map((x) => +x.toFixed(3)), r: r.basis.r.map((x) => +x.toFixed(3)), u: r.basis.u.map((x) => +x.toFixed(3)) },
  eye: r.eye.map((x) => +x.toFixed(2))
};
