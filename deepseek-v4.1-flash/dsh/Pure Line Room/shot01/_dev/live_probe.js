/* _dev/live_probe.js — full camera decomposition. */
var a = window.PLR.app;
var r = a.renderer;
var c = a.cam;
var cp = Math.cos(c.pitch);
var byHand = [
  c.target[0] + Math.sin(c.yaw) * c.dist * cp,
  c.target[1] + Math.sin(c.pitch) * c.dist,
  c.target[2] + Math.cos(c.yaw) * c.dist * cp
];
var raw = a.rawEye();
return {
  cam: { yaw: +c.yaw.toFixed(4), pitch: +c.pitch.toFixed(4), dist: +c.dist.toFixed(3), target: c.target.map(function (v) { return +v.toFixed(2); }) },
  sinPitch: +Math.sin(c.pitch).toFixed(4),
  byHand: byHand.map(function (v) { return +v.toFixed(2); }),
  rawEye: raw.map(function (v) { return +v.toFixed(2); }),
  rendererEye: r.eye.map(function (v) { return +v.toFixed(2); }),
  match: Math.abs(raw[0] - byHand[0]) < 1e-6 && Math.abs(raw[1] - byHand[1]) < 1e-6 && Math.abs(raw[2] - byHand[2]) < 1e-6,
  noAvoid: !!a.viewMode.noAvoid
};
