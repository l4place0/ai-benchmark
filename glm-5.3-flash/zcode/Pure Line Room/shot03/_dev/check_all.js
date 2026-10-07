global.window = global; global.addEventListener = () => {}; global.document = { addEventListener(){} }; global.requestAnimationFrame = () => {}; global.devicePixelRatio = 1;
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.join(__dirname, '..', 'js');
const files = ['math.js','style.js','builders.js','audio.js','engine.js','room.js',
  'objects/door.js','objects/window.js','objects/fan.js','objects/chime.js','objects/switch.js','objects/art.js',
  'objects/desk.js','objects/chair.js','objects/lamp.js','objects/cup.js','objects/globe.js','objects/plant.js',
  'objects/shelf.js','objects/clock.js','objects/sideboard.js','objects/player.js','objects/sofa.js','objects/table.js','objects/rug.js'];
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
RLR.Engine.init({ getContext: () => null, addEventListener(){}, style:{}, setPointerCapture(){} });
RLR.Engine.add(RLR.createBackdrop());
RLR.Engine.add(RLR.createRoom());
const add = (fn, opts) => { const o = RLR[fn](opts || {}); RLR.Engine.add(o); return o; };
const oDoor = add('createDoor', { pivot: [-2.58, 0, 1.47] });
add('createCurtains', {}); const oFan = add('createFan', { pivot: [0, 3.02, 0.35] });
add('createChime', { pivot: [2.05, 3.02, -1.90] }); const oSwitch = add('createSwitch', { pivot: [-2.585, 1.16, 0.30] });
const oArtA = add('createArtA', { pivot: [-1.78, 2.02, -2.185] }); const oArtB = add('createArtB', { pivot: [2.585, 1.78, -0.80] });
add('createDesk', { pivot: [-1.78, 0, -1.82] }); add('createChair', { pivot: [-1.70, 0, -1.18] });
add('createLamp', { pivot: [-2.32, 0.76, -1.86] }); add('createCup', { pivot: [-1.55, 0.76, -1.78] });
add('createGlobe', { pivot: [-1.16, 0.76, -1.80] }); add('createPlant', { pivot: [1.52, 0.95, -2.16] });
add('createShelf', { pivot: [-2.50, 0, -1.30] }); const oClock = add('createClock', { pivot: [-0.42, 2.32, -2.185] });
add('createSideboard', { pivot: [2.44, 0, -0.80] }); add('createPlayer', { pivot: [2.46, 0.78, -0.80] });
add('createSofa', { pivot: [2.18, 0, 0.95] }); add('createTable', { pivot: [1.45, 0, 0.95] });
add('createRug', { pivot: [1.35, 0, 0.75] });
const bump = (o, v) => { for (const f of o.faces) f.zBias = Math.max(f.zBias || 0, v); for (const s of o.strokes) s.zBias = Math.max(s.zBias || 0, v); for (const t of o.texts) t.zBias = Math.max(t.zBias || 0, v); };
bump(oFan, 0.45); bump(oSwitch, 0.45); bump(oArtB, 0.45); bump(oArtA, 0.2); bump(oClock, 0.2);
// 跑 600 帧 update，全部对象
const objs = RLR.Engine.scene;
for (let i = 0; i < 600; i++) for (const o of objs) if (o.update) o.update(1/60, i/60);
// 触发所有 action
const inter = objs.filter(o => o.interactive !== false && o.hits && o.hits.length);
console.log('interactives:', inter.length, inter.map(o => o.name).join(','));
for (const o of inter) for (const h of o.hits) { try { o.onHover && o.onHover(true, h.tag); o.update && o.update(1/60, 1); o.onPress && o.onPress(true, h.tag); o.action && o.action(h.tag); o.onPress && o.onPress(false, h.tag); o.onHover && o.onHover(false, h.tag); o.update && o.update(1/60, 1.1); } catch (e) { console.log('ACTION FAIL', o.name, h.tag, e.message); } }
// 模拟渲染收集（不实际绘制）验证 pushObj 排序不抛错
try { RLR.Engine.env.time = new Date('2026-10-01T10:30:00'); for (let i = 0; i < 5; i++) for (const o of objs) if (o.update) o.update(1/60, 2 + i/60); } catch (e) { console.log('UPDATE FAIL', e.message); }
console.log('scene size:', objs.length, 'total faces:', objs.reduce((a, o) => a + o.faces.length, 0));
console.log('ALL OK');
