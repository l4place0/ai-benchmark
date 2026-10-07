/* _dev/set_day.js — freeze the clock at mid-morning daylight. */
var a = window.PLR.app;
PLR.anim._tweens.length = 0;
a.env.autoTime = false;
a.setEnv({ hour: 11, minute: 0, day: 1 });
a.cam.idle = -1e9;
return { day: a.env.day, hour: a.env.hour };
