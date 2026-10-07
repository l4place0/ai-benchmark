/* ============================================================
 * Pure Line Room — main.js
 * 场景装配 · 昼夜/声音联动 · HUD · 名牌提示 · 发现计数
 * ============================================================ */
(function () {
'use strict';

/* ---------------- 场景装配 ---------------- */
var P = window.ROOM_PARTS;
var scene = Engine.scene;

function place(factory, o) {
  var obj = factory(o || {});
  scene.add(obj);
  return obj;
}

place(P.makeShell, { pos: [0, 0, 0] });
place(P.makeDoor, { pos: [8.62, 0, 0.02] });
place(P.makeWindow, { pos: [2.8, 0, 0.02] });
place(P.makeCurtains, { pos: [2.8, 0, 0.12] });
place(P.makeLightSwitch, { pos: [7.78, 1.22, 0.03] });
place(P.makeClock, { pos: [6.35, 2.78, 0.04] });
place(P.makeWallArt, { pos: [0.05, 2.1, 3.7], rotY: 90 });
place(P.makeChime, { pos: [4.25, 0, 0.55] });
place(P.makeFan, { pos: [7.0, 0, 1.9] });
place(P.makePendant, { pos: [4.8, 0, 3.3] });
place(P.makeDesk, { pos: [2.8, 0, 0.52] });
place(P.makeChair, { pos: [2.8, 0, 1.42], rotY: 12 });
place(P.makeLamp, { pos: [2.12, 0.76, 0.48] });
place(P.makeCup, { pos: [3.28, 0.76, 0.6] });
place(P.makeBookshelf, { pos: [0.17, 0, 1.55], rotY: 90 });
place(P.makeDresser, { pos: [0.27, 0, 3.7], rotY: 90 });
place(P.makeRecordPlayer, { pos: [0.30, 0.955, 3.42], rotY: 90 });
place(P.makeGlobe, { pos: [0.30, 0.955, 4.18] });
place(P.makeSofa, { pos: [8.42, 0, 4.8], rotY: -90 });
place(P.makePillow, { id: 'pillowA', pos: [8.38, 0.54, 4.15], rotY: -80 });
place(P.makePillow, { id: 'pillowB', pos: [8.38, 0.54, 5.35], rotY: -100 });
place(P.makeCoffeeTable, { pos: [6.55, 0, 4.8] });
place(P.makePlant, { pos: [6.28, 0.40, 5.12] });
place(P.makeRug, { pos: [6.75, 0, 4.8], layerBias: 1.5 });

/* ---------------- 发现机制 ---------------- */
var STORE_KEY = 'pure-line-room-shot01';
var store = { found: {}, muted: false, night: false, helped: false };
try {
  var saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  if (saved && typeof saved === 'object') {
    if (saved.found) store.found = saved.found;
    if (saved.muted != null) store.muted = !!saved.muted;
    if (saved.night != null) store.night = !!saved.night;
    if (saved.helped != null) store.helped = !!saved.helped;
  }
} catch (e) { /* 隐私模式等场景下静默降级 */ }

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e2) {}
}

var DISCOVERABLE = ['door', 'window', 'curtains', 'switch', 'pendant', 'lamp', 'cup', 'chair',
  'bookshelf', 'dresser', 'player', 'globe', 'sofa', 'pillowA', 'pillowB', 'table', 'plant',
  'rug', 'clock', 'art', 'chime', 'fan', 'desk'];

/* ---------------- DOM ---------------- */
function $(id) { return document.getElementById(id); }
var elTip = $('tooltip');
var elToast = $('toast');
var elN = $('discover-n');
var elAll = $('discover-all');
var elDiscover = $('discover');
var elHelp = $('help-card');
var btnSound = $('btn-sound');
var btnNight = $('btn-night');
var btnHelp = $('btn-help');
var btnHelpClose = $('btn-help-close');

var ICON = {
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z"/><path d="M16.2 8.6a4.8 4.8 0 0 1 0 6.8"/><path d="M18.6 6.4a8 8 0 0 1 0 11.2"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z"/><line x1="16.5" y1="9.5" x2="21" y2="14.5"/><line x1="21" y1="9.5" x2="16.5" y2="14.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.6A8.4 8.4 0 1 1 10.4 4 6.6 6.6 0 0 0 20 13.6z"/></svg>'
};

var toastTimer = null;
function toast(msg, ms) {
  elToast.textContent = msg;
  elToast.hidden = false;
  elToast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    elToast.classList.remove('show');
  }, ms || 1700);
}

function updateCounter(bump) {
  var n = 0;
  for (var i = 0; i < DISCOVERABLE.length; i++) if (store.found[DISCOVERABLE[i]]) n++;
  elN.textContent = n;
  elAll.textContent = DISCOVERABLE.length;
  if (bump) {
    elDiscover.classList.remove('bump');
    void elDiscover.offsetWidth;
    elDiscover.classList.add('bump');
  }
}

function discover(obj) {
  if (!obj || !obj.label || DISCOVERABLE.indexOf(obj.id) < 0) return;
  if (store.found[obj.id]) return;
  store.found[obj.id] = 1;
  save();
  var complete = true;
  for (var i = 0; i < DISCOVERABLE.length; i++) {
    if (!store.found[DISCOVERABLE[i]]) { complete = false; break; }
  }
  updateCounter(true);
  if (complete) {
    toast('✦ 你把这间房间住遍了', 3200);
  } else {
    toast('发现 · ' + obj.label);
  }
}

/* ---------------- 悬停名牌 ---------------- */
var mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', function (e) {
  mouseX = e.clientX; mouseY = e.clientY;
  if (!elTip.hidden) {
    elTip.style.left = (mouseX + 14) + 'px';
    elTip.style.top = (mouseY + 16) + 'px';
  }
});

/* ---------------- 昼夜模式外观 ---------------- */
var MODE_CLASS = { day: 'mode-day', nightLit: 'mode-nightlit', nightDark: 'mode-nightdark' };
function applyMode() {
  document.body.className = MODE_CLASS[Env.mode()] || 'mode-day';
  btnNight.innerHTML = Env.isNight ? ICON.sun : ICON.moon;
  btnNight.classList.toggle('off', false);
}

/* ---------------- 声音按钮 ---------------- */
function applySound() {
  var muted = window.AudioKit ? AudioKit.isMuted() : false;
  btnSound.innerHTML = muted ? ICON.soundOff : ICON.soundOn;
  btnSound.classList.toggle('off', muted);
}

/* ---------------- 昼夜状态接线 ---------------- */
Env.onChange(function () {
  applyMode();
  if (window.AudioKit) AudioKit.setNight(Env.isNight);
  store.night = Env.isNight;
  save();
});

/* 恢复上次的昼夜（瞬时完成，不播过渡） */
if (store.night) {
  Env.setNight(true);
  Env.tick(3);
}
applyMode();

/* ---------------- 启动引擎 ---------------- */
var canvas = $('stage');
Engine.start({
  canvas: canvas,
  onHover: function (obj) {
    if (obj && obj.label) {
      elTip.textContent = obj.label;
      elTip.hidden = false;
      elTip.style.left = (mouseX + 14) + 'px';
      elTip.style.top = (mouseY + 16) + 'px';
    } else {
      elTip.hidden = true;
    }
  },
  onInteract: function (obj) { discover(obj); }
});

/* ---------------- 按钮 ---------------- */
btnSound.addEventListener('click', function () {
  if (!window.AudioKit) return;
  var muted = AudioKit.toggleMuted();
  store.muted = muted;
  save();
  applySound();
});
btnNight.addEventListener('click', function () {
  Env.setNight(!Env.isNight);
  if (window.AudioKit) AudioKit.shift();
});
btnHelp.addEventListener('click', function () {
  elHelp.hidden = false;
  store.helped = true;
  save();
});
btnHelpClose.addEventListener('click', function () {
  elHelp.hidden = true;
});
elHelp.addEventListener('click', function (e) {
  if (e.target === elHelp) elHelp.hidden = true;
});

/* ---------------- 初始化 HUD ---------------- */
updateCounter(false);
applySound();
if (!store.helped) {
  elHelp.hidden = false;
  store.helped = true;
  save();
}
if (window.AudioKit) AudioKit.setMuted(store.muted);

})();
