/* _dev/live_cam.js — set the camera live, for composition experiments. */
var a = window.PLR.app;
var spec = __SPEC__;
a.cam.target[0] = spec[3]; a.cam.target[1] = spec[4]; a.cam.target[2] = spec[5];
a.cam.tyaw = spec[0]; a.cam.tpitch = spec[1]; a.cam.tdist = spec[2];
a.cam.yaw = spec[0]; a.cam.pitch = spec[1]; a.cam.dist = spec[2];
a.cam.idle = -1e6;                      // suspend the idle drift for the shot
if (spec[6] > 0) a.renderer.fov = spec[6];
a.env.autoTime = false;
a.setEnv({ hour: spec[7] || 11, minute: 0 });
return { cam: { yaw: a.cam.yaw, pitch: a.cam.pitch, dist: a.cam.dist, target: a.cam.target }, fov: a.renderer.fov };
