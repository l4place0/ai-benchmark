// main.js — application shell: bootstraps the scene, the input loop and the HUD.
//
// Everything is local: no network, no fonts, no images, no CDN. Audio is fully
// synthesised at runtime and the vector font is embedded as stroke data.

import Renderer from './core/renderer.js';
import { Scene, State } from './core/scene.js';
import { OrbitCamera } from './core/camera.js';
import { makeTheme } from './core/palette.js';
import { setFontModule } from './core/builder.js';
import * as anim from './core/anim.js';
import { clamp, lerp, vdist, m4mul, m4trs } from './core/math3d.js';

/* ----------------------------------------------------------- optional bits */
// The audio engine and the stroke font are loaded defensively so that a missing
// module degrades gracefully instead of killing the whole piece.

const silentAudio = {
  unlock() {}, sfx() {}, setLoop() {}, param() {},
  setMasterVolume() {}, setMuted() {}, isMuted() { return true; }, update() {},
};

let audio = silentAudio;
try {
  const mod = await import('./core/audio.js');
  if (mod && typeof mod.createAudio === 'function') audio = mod.createAudio();
} catch (e) { /* silent fallback */ }

try {
  const mod = await import('./core/strokefont.js');
  setFontModule(mod);
} catch (e) { /* builder falls back to its 7-segment digits */ }

/* ------------------------------------------------------------------ canvas */

const canvas = document.getElementById('stage');
const renderer = new Renderer(canvas);
const scene = new Scene();
const camera = new OrbitCamera({});

const state = new State({
  night: false,
  lampOn: false,
  pendantOn: false,
  lampFloorOn: false,
  blindsOpen: 1,
  curtainOpen: 1,
  fanSpeed: 0,
  vinylPlaying: false,
  muted: false,
  hintDots: true,
});

/* --------------------------------------------------------------------- ctx */

const ctx = {
  scene,
  state,
  camera,
  audio,
  ease: anim.ease,
  Spring: anim.Spring,
  Tween: anim.Tween,
  pingPong: anim.pingPong,
  clamp,
  lerp,
  damp: anim.damp,
  vdist,
  time: 0,
  nightT: 0,
  theme: makeTheme(0),
  set: (k, v) => state.set(k, v),
  on: (k, fn) => state.on(k, fn),
  emit: (k, v) => state.set(k, v),
  light: (x, y, z, radius, color, intensity) => scene.light(x, y, z, radius, color, intensity),
  requestHover: (key) => {
    const p = partByKey.get(key);
    if (p) { p.hoverT = 1; p.flash = 1; }
  },
  paper: () => scene.paper(),
  object: (opts) => scene.object(opts),
};

const partByKey = new Map();
const visited = new Set();

/* --------------------------------------------------------------- build scene */

const errors = [];
const loaders = [
  ['room', () => import('./content/room.js')],
  ['desk', () => import('./content/desk.js')],
  ['lounge', () => import('./content/lounge.js')],
  ['ceiling', () => import('./content/ceiling.js')],
];

for (const [name, load] of loaders) {
  try {
    const mod = await load();
    const fn = (mod && (mod.default || mod.build)) || null;
    if (typeof fn !== 'function') throw new Error('no default export');
    fn(ctx);
  } catch (e) {
    errors.push(name + ': ' + ((e && e.message) ? e.message : String(e)));
  }
}

for (const p of scene.parts) partByKey.set(p.key, p);
renderer.setPickMap(scene.pickMap);
scene.sync();

/* -------------------------------------------------------------------- input */

let mouseX = 0, mouseY = 0;
let hoveredPart = null;
let dragging = null;      // { part, moved, lastX, lastY }
let orbiting = null;      // { lastX, lastY }
let needPick = true;
let lastPointerActivity = -99;
let pointerDownPos = null;
let lastClickTime = 0;
let idleTimer = 0;

function setCursor(c) {
  canvas.style.cursor = c;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  canvas.setPointerCapture(e.pointerId);
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  lastPointerActivity = ctx.time;
  idleTimer = 0;
  needPick = true;

  if (hoveredPart && hoveredPart.enabled) {
    dragging = { part: hoveredPart, moved: 0, lastX: mouseX, lastY: mouseY };
    pointerDownPos = [mouseX, mouseY];
    const h = hoveredPart.handlers.drag || hoveredPart.obj.handlers.drag;
    if (h) h({ dx: 0, dy: 0, phase: 'start' }, ctx);
  } else {
    orbiting = { lastX: mouseX, lastY: mouseY };
    pointerDownPos = [mouseX, mouseY];
  }
});

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - mouseX, dy = y - mouseY;
  mouseX = x; mouseY = y;
  lastPointerActivity = ctx.time;
  idleTimer = 0;
  needPick = true;

  if (dragging) {
    dragging.moved += Math.abs(dx) + Math.abs(dy);
    const h = dragging.part.handlers.drag || dragging.part.obj.handlers.drag;
    if (h) h({ dx, dy, phase: 'move' }, ctx);
  } else if (orbiting) {
    camera.orbit(-dx * 0.0062, dy * 0.0042);
  }
});

function endPointer(e) {
  if (dragging) {
    const h = dragging.part.handlers.drag || dragging.part.obj.handlers.drag;
    if (h) h({ dx: 0, dy: 0, phase: 'end' }, ctx);
    const dist = pointerDownPos ? Math.hypot(mouseX - pointerDownPos[0], mouseY - pointerDownPos[1]) : 99;
    if (dist < 6) fireClick(dragging.part);
    dragging = null;
  } else if (orbiting) {
    const dist = pointerDownPos ? Math.hypot(mouseX - pointerDownPos[0], mouseY - pointerDownPos[1]) : 99;
    if (dist < 6) fireClick(hoveredPart);
    orbiting = null;
  }
  pointerDownPos = null;
  if (e && e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('pointerleave', () => {
  hoveredPart = null;
  setCursor('default');
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoom(e.deltaY > 0 ? 1.06 : 0.945);
  lastPointerActivity = ctx.time;
  idleTimer = 0;
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.key === 'ArrowLeft') camera.orbit(-0.07, 0);
  else if (e.key === 'ArrowRight') camera.orbit(0.07, 0);
  else if (e.key === 'ArrowUp') camera.orbit(0, -0.05);
  else if (e.key === 'ArrowDown') camera.orbit(0, 0.05);
  else if (e.key === '+' || e.key === '=') camera.zoom(0.92);
  else if (e.key === '-' || e.key === '_') camera.zoom(1.08);
  else if (e.key === 'm' || e.key === 'M') toggleMute();
  else if (e.key === 'n' || e.key === 'N') state.toggle('night');
  idleTimer = 0;
});

function fireClick(part) {
  if (!part || !part.enabled) return;
  const now = ctx.time;
  if (now - lastClickTime < 0.05) return;
  lastClickTime = now;
  visited.add(part.key);
  part.flash = 1;
  const h = part.handlers.click || part.obj.handlers.click;
  try {
    if (h) h(ctx);
  } catch (err) { /* keep the piece running */ }
  if (part.obj.sfx) audio.sfx(part.obj.sfx);
  updateHud();
}

/* ---------------------------------------------------------------- HUD bits */

const tagEl = document.getElementById('tag');
const tagLabel = document.getElementById('tag-label');
const tagHint = document.getElementById('tag-hint');
const hudEl = document.getElementById('hud');
const soundBtn = document.getElementById('sound-toggle');
const countEl = document.getElementById('found-count');
const errEl = document.getElementById('boot-error');

if (errors.length && errEl) {
  errEl.textContent = '模块加载问题: ' + errors.join(' | ');
  errEl.style.display = 'block';
}

const totalEl = document.getElementById('found-total');

function updateHud() {
  if (countEl) countEl.textContent = String(visited.size);
  if (totalEl) totalEl.textContent = String(scene.parts.length);
}

function toggleMute() {
  const m = !state.get('muted');
  state.set('muted', m);
  audio.setMuted(m);
  if (soundBtn) {
    soundBtn.classList.toggle('muted', m);
    soundBtn.setAttribute('aria-pressed', String(!m));
  }
}

if (soundBtn) {
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    toggleMute();
  });
}

updateHud();

/* ------------------------------------------------------------------ resize */

let cssW = 1, cssH = 1;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = Math.max(320, canvas.clientWidth || window.innerWidth);
  cssH = Math.max(240, canvas.clientHeight || window.innerHeight);
  renderer.resize(cssW, cssH, dpr);
  camera.update(0.0001, cssW, cssH, { snap: true });
}
window.addEventListener('resize', resize);
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
}

/* --------------------------------------------------------------- ambience */

let ambienceOn = null;
function updateAmbience() {
  const desired = ctx.nightT > 0.55 ? 'night' : 'day';
  if (ambienceOn === desired) return;
  ambienceOn = desired;
  audio.setLoop('day', desired === 'day');
  audio.setLoop('night', desired === 'night');
}
state.on('night', () => {
  audio.sfx('switch');
});

state.on('muted', (v) => {
  audio.setMuted(v);
});

/* ------------------------------------------------------------ render loop */

let last = performance.now();
let hintAlpha = 0;

// A short establishing move: the camera drifts in from a wider, higher angle.
const INTRO = {
  active: true, t: 0, dur: 2.9,
  from: { yaw: 1.34, pitch: 0.63, radius: 15.8 },
  to: { yaw: 0.62, pitch: 0.37, radius: 12.4 },
};
camera.yaw = INTRO.from.yaw;
camera.pitch = INTRO.from.pitch;
camera.radius = INTRO.from.radius;
camera.sYaw = INTRO.from.yaw;
camera.sPitch = INTRO.from.pitch;
camera.sRadius = INTRO.from.radius;

function cancelIntro() { INTRO.active = false; }
canvas.addEventListener('pointerdown', cancelIntro, { once: false });
canvas.addEventListener('wheel', cancelIntro, { passive: true });

function stepIntro(dt) {
  if (!INTRO.active) return;
  INTRO.t += dt;
  const k = anim.ease.cubicOut(clamp(INTRO.t / INTRO.dur, 0, 1));
  camera.yaw = lerp(INTRO.from.yaw, INTRO.to.yaw, k);
  camera.pitch = lerp(INTRO.from.pitch, INTRO.to.pitch, k);
  camera.radius = lerp(INTRO.from.radius, INTRO.to.radius, k);
  if (INTRO.t >= INTRO.dur) INTRO.active = false;
}

function frame(now) {
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = clamp(rawDt, 0, 0.05);
  ctx.time += dt;
  idleTimer += dt;

  /* --- global day/night blend --------------------------------------- */
  const targetNight = state.get('night') ? 1 : 0;
  ctx.nightT = anim.damp(ctx.nightT, targetNight, 2.1, dt);
  if (Math.abs(ctx.nightT - targetNight) < 0.002) ctx.nightT = targetNight;
  ctx.theme = makeTheme(ctx.nightT);
  updateAmbience();
  if (document.body) {
    const isNight = ctx.nightT > 0.5;
    if (document.body.classList.contains('night') !== isNight) {
      document.body.classList.toggle('night', isNight);
    }
  }

  /* --- hover bookkeeping --------------------------------------------- */
  if (needPick) {
    needPick = false;
    renderer.buildPickBuffer(scene, camera, ctx.theme);
    const p = renderer.pickAt(mouseX, mouseY);
    if (p !== hoveredPart) {
      if (hoveredPart) {
        const h = hoveredPart.handlers.over || hoveredPart.obj.handlers.over;
        if (h) { try { h(false, ctx); } catch (e) { /* noop */ } }
      }
      hoveredPart = p;
      if (hoveredPart) {
        const h = hoveredPart.handlers.over || hoveredPart.obj.handlers.over;
        if (h) { try { h(true, ctx); } catch (e) { /* noop */ } }
      }
    }
  }

  for (let i = 0; i < scene.parts.length; i++) {
    const p = scene.parts[i];
    const want = p === hoveredPart && p.enabled ? 1 : 0;
    p.hoverT = anim.damp(p.hoverT, want, want > 0 ? 15 : 9, dt);
    if (p.flash) p.flash = Math.max(0, p.flash - dt * 1.6);
  }

  /* --- update + sync -------------------------------------------------- */
  scene.update(dt, ctx.time, ctx);
  scene.sync();

  /* --- camera --------------------------------------------------------- */
  stepIntro(dt);
  camera.update(dt, cssW, cssH, { busy: !!dragging || !!orbiting });

  /* --- draw ----------------------------------------------------------- */
  renderer.draw(scene, camera, ctx.theme, {
    hoverPart: hoveredPart,
    lights: scene.lights,
    backdrop: drawBackdrop,
  });

  drawOverlay(ctx.theme, dt);

  /* --- DOM tooltip ---------------------------------------------------- */
  if (tagEl) {
    if (hoveredPart && !orbiting) {
      if (tagLabel.textContent !== hoveredPart.label) tagLabel.textContent = hoveredPart.label;
      const hint = hoveredPart.hint || hoveredPart.obj.label;
      if (tagHint.textContent !== hint) tagHint.textContent = hint || '';
      tagEl.style.transform = `translate(${Math.round(mouseX + 16)}px, ${Math.round(mouseY + 14)}px)`;
      tagEl.classList.add('on');
      const cur = dragging ? 'grabbing' : (hoveredPart.cursor || 'pointer');
      setCursor(cur);
    } else {
      tagEl.classList.remove('on');
      setCursor(orbiting ? 'grabbing' : (dragging ? 'grabbing' : 'default'));
    }
  }

  updateAudio(dt);
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------- backdrop */

let grainPattern = null;
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const g = c.getContext('2d');
  const img = g.createImageData(96, 96);
  let seed = 12345;
  for (let i = 0; i < 96 * 96; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = 200 + ((seed >> 16) % 56);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 12;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function drawBackdrop(g, theme, W, H) {
  // paper grain
  if (!grainPattern) {
    grainPattern = g.createPattern(makeGrain(), 'repeat');
  }
  if (grainPattern) {
    g.save();
    g.globalAlpha = 0.5 + 0.5 * (1 - theme.nightT);
    g.fillStyle = grainPattern;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
  // vignette
  const grad = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.78);
  const dark = theme.nightT > 0.5 ? '0,0,0' : '120,116,104';
  grad.addColorStop(0, `rgba(${dark},0)`);
  grad.addColorStop(1, `rgba(${dark},${0.10 + 0.08 * theme.nightT})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/* ---------------------------------------------------------------- overlay */
// Hint dots + a paper "floor line" so the empty space does not look broken.

function drawOverlay(theme, dt) {
  const g = renderer.ctx;
  const dpr = renderer.dpr;
  const W = renderer.canvas.width, H = renderer.canvas.height;
  g.setTransform(1, 0, 0, 1, 0, 0);

  const idle = idleTimer > 2.4 && !dragging && !orbiting;
  const stillDiscovering = state.get('hintDots') && visited.size < 12;
  const target = (idle && stillDiscovering) ? 1 : 0;
  hintAlpha = anim.damp(hintAlpha, target, 1.6, dt);
  if (hintAlpha < 0.02) return;

  const ink = theme.nightT > 0.5 ? '232,227,214' : '23,23,28';
  const pulse = 0.5 + 0.5 * Math.sin(ctx.time * 2.1);

  for (let i = 0; i < scene.parts.length; i++) {
    const p = scene.parts[i];
    if (!p.enabled || visited.has(p.key)) continue;
    const wp = p.worldAnchor();
    const sp = renderer.project(camera, wp);
    if (sp.behind) continue;
    if (sp.x < -20 || sp.y < -20 || sp.x > renderer.w + 20 || sp.y > renderer.h + 20) continue;
    const r = (2.1 + 0.9 * pulse) * dpr;
    g.beginPath();
    g.arc(sp.x * dpr, sp.y * dpr, r, 0, Math.PI * 2);
    g.fillStyle = `rgba(${ink},${0.30 * hintAlpha})`;
    g.fill();
    g.beginPath();
    g.arc(sp.x * dpr, sp.y * dpr, r + 3.2 * dpr, 0, Math.PI * 2);
    g.strokeStyle = `rgba(${ink},${0.16 * hintAlpha})`;
    g.lineWidth = 0.9 * dpr;
    g.stroke();
  }
}

/* -------------------------------------------------------------- audio glue */

function updateAudio(dt) {
  if (audio.update) audio.update(dt);
  audio.param && audio.param('fanSpeed', state.get('fanSpeed'));
}

/* -------------------------------------------------------------------- boot */

resize();
requestAnimationFrame((t) => { last = t; frame(t); });

// Fade the intro hint after a while.
setTimeout(() => { if (hudEl) hudEl.classList.add('soft'); }, 9000);

if (typeof window !== 'undefined') {
  window.__ROOM__ = {
    scene, camera, renderer, ctx, state, audio, visited, errors,
    get hovered() { return hoveredPart; },
    get mouse() { return [mouseX, mouseY]; },
    get time() { return ctx.time; },
    /** centroid (css px) of every pickable part.
     *  Only pixels whose full 3x3 neighbourhood shares the id are trusted —
     *  antialiased edge pixels blend two ids and would otherwise be attributed
     *  to an unrelated part. Parts with no such core are reported as
     *  `reliable:false` so tests can skip them instead of guessing. */
    partPoints() {
      renderer.buildPickBuffer(scene, camera, ctx.theme);
      const W = renderer.idCanvas.width, H = renderer.idCanvas.height;
      const raw = renderer.idCtx.getImageData(0, 0, W, H).data;
      const ids = new Uint16Array(W * H);
      for (let i = 0, p = 0; i < ids.length; i++, p += 4) ids[i] = raw[p] | (raw[p + 1] << 8);

      const core = new Map();
      const loose = new Map();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const id = ids[y * W + x];
          if (!id) continue;
          let a = loose.get(id);
          if (!a) { a = { sx: 0, sy: 0, n: 0 }; loose.set(id, a); }
          a.sx += x; a.sy += y; a.n++;
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
          let solid = true;
          for (let dy = -1; dy <= 1 && solid; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (ids[(y + dy) * W + (x + dx)] !== id) { solid = false; break; }
            }
          }
          if (!solid) continue;
          let b = core.get(id);
          if (!b) { b = { sx: 0, sy: 0, n: 0 }; core.set(id, b); }
          b.sx += x; b.sy += y; b.n++;
        }
      }

      const out = [];
      for (const [id, a] of loose) {
        const p = scene.pickMap.get(id);
        if (!p || !p.enabled) continue;
        const s = core.get(id);
        out.push({
          key: p.key, id: p.id, label: p.label,
          reliable: !!s,
          x: (s ? s.sx / s.n : a.sx / a.n) / renderer.pickScale,
          y: (s ? s.sy / s.n : a.sy / a.n) / renderer.pickScale,
          px: a.n,
        });
      }
      return out;
    },
    setCamera(yaw, pitch, radius) {
      INTRO.active = false;
      if (yaw !== undefined) camera.yaw = yaw;
      if (pitch !== undefined) camera.pitch = pitch;
      if (radius !== undefined) camera.radius = radius;
    },
    skipIntro() {
      INTRO.active = false;
      camera.yaw = INTRO.to.yaw;
      camera.pitch = INTRO.to.pitch;
      camera.radius = INTRO.to.radius;
      camera.sYaw = INTRO.to.yaw;
      camera.sPitch = INTRO.to.pitch;
      camera.sRadius = INTRO.to.radius;
    },
    // small helpers used by the development probes in _dev/
    mul: (a, b) => m4mul(a, b),
    trs: (p, r, s) => m4trs(p, r, s),
  };
}
