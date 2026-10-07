// before-hook: apply a camera from the CLI (yaw,pitch,dist,tx,ty,tz,fov)
const spec = String(__ISOLATE__ || '0.19,-0.075,4.8,-0.1,1.05,-2.2,46').split(',').map(Number);
const c = app.cam;
if (spec.length >= 6) {
  c.target[0] = spec[3]; c.target[1] = spec[4]; c.target[2] = spec[5];
  c.tyaw = spec[0]; c.tpitch = spec[1]; c.tdist = spec[2];
  c.yaw = spec[0]; c.pitch = spec[1]; c.dist = spec[2];
  c.idle = 0;
}
if (spec.length >= 7 && spec[6] > 0) app.renderer.fov = spec[6];
app.env.autoTime = false;
app.setEnv({ hour: 10, minute: 0 });
return { cam: { yaw: c.yaw, pitch: c.pitch, dist: c.dist, target: c.target }, fov: app.renderer.fov };
