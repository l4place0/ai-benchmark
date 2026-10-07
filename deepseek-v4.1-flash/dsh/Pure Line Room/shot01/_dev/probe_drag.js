// probe: why doesn't the chair drag? (uses the harness event helpers)
const it = app.interact;
const r = app.renderer;
const chair = it.get('chair');
const b = it.worldBox(chair);
const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const p = r.project(c);
const log = [];
log.push('screen ' + Math.round(p[0]) + ',' + Math.round(p[1]) + ' pick=' + (it.pick(p[0], p[1]) || { obj: null }).obj.id);
log.push('onDrag=' + (typeof chair.onDrag) + ' dynamicHit=' + !!chair.dynamicHit);
page.move(p[0], p[1]);
page.advance(300);
page.down(p[0], p[1]);
log.push('after down: drag=' + (it.drag ? it.drag.obj.id : 'null') + ' pressed=' + (it.pressed && it.pressed.obj ? it.pressed.obj.id : 'null'));
for (let i = 1; i <= 20; i++) {
  page.move(p[0] - i * 5, p[1] + i * 3);
  page.advance(16);
}
log.push('after moves: started=' + (it.drag ? it.drag.started : 'gone') + ' last=' + (it.drag ? it.drag.last.map((v) => +v.toFixed(2)) : null));
page.up(p[0] - 100, p[1] + 60);
page.advance(900);
const b2 = it.worldBox(chair);
const c2 = [(b2.min[0] + b2.max[0]) / 2, (b2.min[1] + b2.max[1]) / 2, (b2.min[2] + b2.max[2]) / 2];
log.push('centre ' + c.map((v) => +v.toFixed(2)) + ' -> ' + c2.map((v) => +v.toFixed(2)));
return { log, moved: +Math.hypot(c2[0] - c[0], c2[2] - c[2]).toFixed(3) };
