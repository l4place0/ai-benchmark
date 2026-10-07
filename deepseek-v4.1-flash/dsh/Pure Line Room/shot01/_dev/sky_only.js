// before-hook: aim the camera at the window from inside the room, sky only
app.cam.tyaw = 0; app.cam.tpitch = 0;
app.cam.target[0] = 1.00; app.cam.target[1] = 1.55; app.cam.target[2] = -0.70;
app.cam.tyaw = -1.35;      // look east (+x)
app.cam.tpitch = -0.03;
app.cam.tdist = 2.9;
app.cam.yaw = app.cam.tyaw; app.cam.pitch = app.cam.tpitch; app.cam.dist = app.cam.tdist;
const v = PLR.app.viewMode;
v.sky = true; v.room = false;
app.env.autoTime = false;
app.setEnv({ hour: 12, minute: 0, day: 1 });
return { mode: 'sky-only', eye: app.renderer.eye };
