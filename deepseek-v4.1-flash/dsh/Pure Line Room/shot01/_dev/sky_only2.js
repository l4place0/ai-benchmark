// before-hook: keep the default camera, show only the sky layer
const v = app.viewMode;
v.sky = true; v.room = false; v.only = null;
return { mode: 'sky-only at default camera' };
