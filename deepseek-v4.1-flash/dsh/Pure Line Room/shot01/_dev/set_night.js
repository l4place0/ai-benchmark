/* _dev/set_night.js — night outside with the room light and desk lamp on. */
var a = window.PLR.app;
PLR.anim._tweens.length = 0;
a.env.autoTime = false;
a.setEnv({ hour: 21, minute: 40, day: 0.14 });
a.setEnv({ lightsOn: true, lampOn: true });
a.cam.idle = -1e9;
return { day: a.env.day, lightsOn: a.env.lightsOn, lampOn: a.env.lampOn };
