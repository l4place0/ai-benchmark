/* 集成无头自测：全文件加载 + 场景装配 + 模拟帧 + 全对象点击 */
'use strict';
global.window = global;
global.performance = { now: () => Date.now() };
global.innerWidth = 1280;
global.innerHeight = 800;
global.devicePixelRatio = 1;
global.addEventListener = () => {};
global.requestAnimationFrame = (fn) => { global.__raf = fn; };

let warns = [];
const origWarn = console.warn;
console.warn = (...a) => { warns.push(a.map(String).join(' ')); };

// ---- 最小 DOM 桩 ----
function makeEl() {
  return {
    hidden: false, textContent: '', innerHTML: '', style: {},
    className: '', offsetWidth: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, setAttribute() {}, getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    getContext: () => fakeCtx()
  };
}
function fakeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const els = {};
global.document = {
  getElementById: (id) => (els[id] = els[id] || makeEl()),
  addEventListener() {}, removeEventListener() {},
  body: makeEl(),
  createElement: () => makeEl(),
  documentElement: makeEl()
};
const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }
};

const fs = require('fs');
const path = require('path');
let fails = 0;
function ok(cond, name) { if (cond) console.log('  ok -', name); else { fails++; console.log('  FAIL -', name); } }

for (const f of ['engine.js', 'audio.js', 'objects_arch.js', 'objects_deco.js', 'objects_study.js', 'objects_lounge.js', 'main.js']) {
  const code = fs.readFileSync(path.join(__dirname, 'js', f), 'utf8');
  try { eval(code); ok(true, '加载 ' + f); } catch (e) { ok(false, '加载 ' + f + ' → ' + e.message); }
}

const E = window.Engine;
const NEED = ['makeShell', 'makeDoor', 'makeWindow', 'makeCurtains', 'makeLightSwitch', 'makeClock',
  'makeWallArt', 'makeChime', 'makeFan', 'makePendant', 'makeDesk', 'makeChair', 'makeLamp', 'makeCup',
  'makeBookshelf', 'makeDresser', 'makeRecordPlayer', 'makeGlobe', 'makeSofa', 'makePillow',
  'makeCoffeeTable', 'makePlant', 'makeRug'];
ok(NEED.every(n => window.ROOM_PARTS && typeof window.ROOM_PARTS[n] === 'function'), 'ROOM_PARTS 工厂齐全');
ok(typeof window.AudioKit === 'object' && typeof window.AudioKit.init === 'function', 'AudioKit 存在');

// 工厂可重复调用
const ids = ['shell', 'door', 'window', 'curtains', 'switch', 'clock', 'art', 'chime', 'fan', 'pendant',
  'desk', 'chair', 'lamp', 'cup', 'bookshelf', 'dresser', 'player', 'globe', 'sofa', 'pillowA', 'pillowB',
  'table', 'plant', 'rug'];
ok(E.scene.objects.length === 24, '场景 24 个物体（实际 ' + E.scene.objects.length + '）');
ok(ids.every(id => E.scene.get(id)), '全部 id 就位');
let dupOk = true;
try { for (const n of NEED) window.ROOM_PARTS[n]({ pos: [5, 0, 5] }); } catch (e) { dupOk = false; }
ok(dupOk, '工厂可重复调用');

// 全部部件有限值检查
function finiteCheck() {
  for (const o of E.scene.objects) {
    for (const p of o.parts) {
      if (p.hidden) continue;
      for (const pt of p.pts) {
        if (!isFinite(pt[0]) || !isFinite(pt[1]) || !isFinite(pt[2])) {
          return o.id + ':' + p.kind + ' 出现非有限坐标';
        }
      }
    }
  }
  return null;
}

// 模拟帧
let T = 16;
function frames(n) { for (let i = 0; i < n; i++) { T += 16; global.__raf(T); } }

frames(120);
ok(finiteCheck() === null, '120 帧后全部坐标有限' + (finiteCheck() ? ' → ' + finiteCheck() : ''));

// 点击全部对象
let clickErr = null;
try {
  for (const id of ids) {
    const o = E.scene.get(id);
    o.onClick(null);
    frames(6);
  }
  // 再点击一次（往回切）
  for (const id of ids) { E.scene.get(id).onClick(null); frames(6); }
} catch (e) { clickErr = e; }
ok(clickErr === null, '全部对象 onClick 无异常' + (clickErr ? ' → ' + clickErr.message : ''));

// 昼夜与灯光切换
Env.setNight(true); frames(40);
Env.setLights(false); frames(40);
Env.setLights(true); frames(40);
Env.setNight(false); frames(40);
ok(finiteCheck() === null, '昼夜切换后坐标有限');

// 长时间运行（模拟 20 秒）
frames(1250);
ok(finiteCheck() === null, '20 秒运行后坐标有限');

// 无引擎捕获的 update 错误
const realWarns = warns.filter(w => w.includes('[update') || w.includes('[click') || w.includes('[hover'));
ok(realWarns.length === 0, '无运行时对象异常' + (realWarns.length ? ' → ' + realWarns.slice(0, 3).join(' | ') : ''));

console.warn = origWarn;
console.log(fails ? ('\n' + fails + ' 项失败') : '\n集成自测全部通过');
process.exit(fails ? 1 : 0);
