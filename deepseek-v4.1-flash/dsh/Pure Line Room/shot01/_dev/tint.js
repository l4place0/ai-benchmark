// before-hook: tint every mesh so it can be identified in the render
app.setView('tint');
app.env.autoTime = false;
app.setEnv({ hour: 10, minute: 0 });
return { tinted: app.scene.meshes.length, names: app.scene.meshes.map((m, i) => i + ':' + (m.name || '?')) };
