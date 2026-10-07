#!/usr/bin/env node
/* =============================================================================
   selftest.mjs — proves the mockdom harness is trustworthy.

   Run:  node _dev/selftest.mjs
   Prints "SELFTEST OK" plus the rendered PNG path, or fails with exit code 1 and
   a list of the assertions that did not hold.
   ========================================================================== */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPage, parseColor, VERSION } from './mockdom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PNG = path.join(__dirname, 'selftest.png');
const OUT_SVG = path.join(__dirname, 'selftest.svg');

const failures = [];
const notes = [];
let checks = 0;

function check(name, cond, detail) {
  checks++;
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail === undefined ? '' : '  -> ' + String(detail)}`);
    failures.push(name + (detail === undefined ? '' : ' -> ' + String(detail)));
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockdom-selftest-'));
function writeScratch(name, content) {
  const p = path.join(scratchDir, name);
  fs.writeFileSync(p, content);
  return p;
}

/* ---------------------------------------------------------------- test 1 */
/* An inline HTML page: 200 varied shapes + a rAF loop. */

const SCENE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>selftest scene</title>
<style>body { margin: 0; background: #101018; } canvas { display: block; }</style>
</head><body>
<canvas id="scene" width="640" height="360"></canvas>
<div id="hud" class="hud big">frame <span id="counter">0</span></div>
<script>
var canvas = document.getElementById('scene');
var ctx = canvas.getContext('2d');
var sameCtx = canvas.getContext('2d');
window.__sameCtx = (sameCtx === ctx);
window.__frames = 0;
window.__shapes = 0;
window.__hud = document.querySelector('#hud');
window.__local = localStorage.getItem('nothing') === null;

function drawScene(t) {
  ctx.save();
  ctx.fillStyle = 'rgb(16,16,24)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 200 shapes with lots of style variety
  for (var i = 0; i < 200; i++) {
    var a = i * 0.37 + t * 0.001;
    var x = 40 + (i % 20) * 30;
    var y = 40 + Math.floor(i / 20) * 33;
    ctx.lineWidth = 0.5 + (i % 5) * 0.75;
    ctx.globalAlpha = 0.35 + (i % 7) / 10;
    ctx.beginPath();
    ctx.fillStyle = 'hsl(' + ((i * 7) % 360) + ', 70%, ' + (35 + (i % 5) * 8) + '%)';
    if (i % 4 === 0) {
      ctx.rect(x, y, 14 + (i % 9), 10 + (i % 6));
      ctx.fill();
    } else if (i % 4 === 1) {
      ctx.arc(x + 8, y + 8, 5 + (i % 7), 0, Math.PI * 1.5);
      ctx.strokeStyle = 'rgb(' + (60 + i % 150) + ',200,140)';
      ctx.stroke();
    } else if (i % 4 === 2) {
      ctx.roundRect(x, y, 18, 14, 3 + (i % 4));
      ctx.fill();
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y + 12 + Math.sin(a) * 6);
      ctx.quadraticCurveTo(x + 18, y, x + 24, y + 10);
      ctx.bezierCurveTo(x + 30, y + 20, x, y + 18, x + 6, y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    window.__shapes++;
  }

  // text + gradient + clip + shadow
  var g = ctx.createLinearGradient(0, 0, canvas.width, 0);
  g.addColorStop(0, 'rgba(255,80,120,0.9)');
  g.addColorStop(0.5, '#40e0d0');
  g.addColorStop(1, 'rgba(80,120,255,0.9)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 330, canvas.width, 30);

  ctx.save();
  ctx.beginPath();
  ctx.rect(100, 100, 200, 120);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('frame ' + window.__frames, canvas.width / 2, 60);
  ctx.shadowBlur = 0;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 300, 120, 24);
  ctx.setLineDash([]);
  ctx.restore();

  var m = ctx.measureText('hello');
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(canvas.width - m.width - 10, 8, m.width, 4);
}

function loop(ts) {
  window.__frames++;
  drawScene(ts);
  document.getElementById('counter').textContent = String(window.__frames);
  document.getElementById('hud').classList.add('tick');
  window.requestAnimationFrame(loop);
}
window.requestAnimationFrame(loop);
</script>
</body></html>`;

console.log('1) scene page: 200 shapes / frame, rAF loop, styles, clip, text');
const htmlPath = writeScratch('scene.html', SCENE_HTML);
const pageA = createPage({ width: 640, height: 360, devicePixelRatio: 1 });
pageA.loadHtml(htmlPath);
pageA.loadScriptsInOrder(htmlPath);
eq('inline script ran (canvas context shared between getContext calls)', pageA.window.__sameCtx, true);
eq('DOM tree built: #hud found by querySelector', pageA.window.__hud && pageA.window.__hud.id, 'hud');
check('classList works on parsed elements', pageA.window.__hud.classList.contains('hud') && pageA.window.__hud.classList.contains('big'));
check('localStorage returns null for a missing key', pageA.window.__local === true);

const FRAMES_A = 120;
pageA.advance(FRAMES_A * (1000 / 60));
eq('frames advance via rAF', pageA.frameCount, FRAMES_A);
eq('rAF loop counter matches harness frame count', pageA.window.__frames, FRAMES_A);
eq('no page errors', pageA.errors.length, 0);
check('200 shapes drawn per frame', pageA.window.__shapes >= 200 * FRAMES_A, pageA.window.__shapes);
eq('textContent of the counter updated by the page', pageA.document.getElementById('counter').textContent, String(FRAMES_A));

const ctxA = pageA.mainContext();
check('a 2d context was recorded', !!ctxA);
const finA = ctxA.__finalize();
eq('save/restore balanced (no underflow)', finA.restoresUnderflow, 0);
eq('save depth back to 0 at the end', finA.saveDepth, 0);
check('save/restore really used', finA.saves === finA.restores && finA.saves >= FRAMES_A, JSON.stringify({ s: finA.saves, r: finA.restores }));
eq('no numeric (NaN) warnings', ctxA.__warnings.length, 0);
check('recorded many drawing calls', finA.calls > 200 * FRAMES_A, finA.calls);
check('fills recorded', ctxA.__stats.fills > 100 * FRAMES_A, ctxA.__stats.fills);
check('strokes recorded', ctxA.__stats.strokes > 10 * FRAMES_A, ctxA.__stats.strokes);
check('texts recorded', ctxA.__stats.texts >= FRAMES_A, ctxA.__stats.texts);
check('clips recorded', ctxA.__stats.clips >= FRAMES_A, ctxA.__stats.clips);
check('roundRect implemented (not skipped)', ctxA.__stats.roundRects >= FRAMES_A, ctxA.__stats.roundRects);
check('gradients recorded', ctxA.__stats.gradients >= FRAMES_A, ctxA.__stats.gradients);
check('fill colours are varied', Object.keys(ctxA.__stats.fillsByColor).length > 40, Object.keys(ctxA.__stats.fillsByColor).length);
check('measureText widths are finite', ctxA.__calls.filter((c) => c.op === 'fillText').every((c) => Number.isFinite(c.width)));
check('path points accumulated (curves flattened)', ctxA.__calls.some((c) => c.op === 'fill' && c.points > 30));

const svgPathA = pageA.renderToSVG({ width: 640, height: 360, path: OUT_SVG });
const svgA = pageA.lastRenderSVG;
check('renderToSVG returns the SVG path', typeof svgPathA === 'string' && svgPathA === OUT_SVG && fs.existsSync(svgPathA), String(svgPathA));
check('SVG output exists', fs.existsSync(svgPathA) && fs.statSync(svgPathA).size > 2000, svgA.bytes);
check('SVG is non-trivial (> 50 elements)', svgA.elements > 50, svgA.elements);
check('SVG replays the last frame only', svgA.from > 0 && svgA.ops < finA.calls, `from=${svgA.from} ops=${svgA.ops} calls=${finA.calls}`);
check('SVG contains geometry from the final frame', /<path /.test(fs.readFileSync(svgPathA, 'utf8')));

/* ---------------------------------------------------------------- test 2 */
/* measureText, gradients as fillStyle, clip recorded before a fill. */

console.log('\n2) measureText / gradient fillStyle / clip ordering');
const pageB = createPage({ width: 400, height: 300 });
pageB.evalInPage(`
  var c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  document.body.appendChild(c);
  window.c = c;
  window.x = c.getContext('2d');
  x.font = '20px sans-serif';
  window.m1 = x.measureText('hello world');
  x.font = '40px sans-serif';
  window.m2 = x.measureText('hello world');
  window.m3 = x.measureText('');
  var g = x.createLinearGradient(0, 0, 400, 0);
  g.addColorStop(0, '#ff0000');
  g.addColorStop(1, 'rgba(0,0,255,0.5)');
  x.fillStyle = g;                       // must not throw
  x.fillRect(0, 0, 400, 50);
  x.save();
  x.beginPath();
  x.rect(50, 50, 200, 100);
  x.clip();
  window.clipW = x.__clipBox.w;
  x.fillStyle = '#00ff00';
  x.fillRect(0, 0, 400, 300);
  x.restore();
  window.clipAfterRestore = x.__clipBox;
  var t = x.measureText('x');
  window.mFinite = Number.isFinite(t.width) && Number.isFinite(t.actualBoundingBoxAscent);
  x.roundRect(10, 200, 60, 30, [4, 8, 12, 16]);
  x.fill();
  x.strokeText('stroked', 10, 280);
  window.__done = true;
`, 'clip-test');
const ctxB = pageB.mainContext();
check('measureText returns finite widths', pageB.window.mFinite === true && Number.isFinite(pageB.window.m1.width));
check('measureText scales with font size', pageB.window.m2.width > pageB.window.m1.width * 1.9, JSON.stringify([pageB.window.m1.width, pageB.window.m2.width]));
check('measureText("") is 0', pageB.window.m3.width === 0, pageB.window.m3.width);
check('gradient usable as fillStyle (no throw, no error)', pageB.errors.length === 0 && ctxB.__stats.gradients === 1);
check('gradient fillRect recorded with the gradient paint', ctxB.__calls.some((c) => c.op === 'fillRect' && c.style && c.style.fillStyle && c.style.fillStyle.__gradient));
check('__clipBox reflects the active clip', pageB.window.clipW === 200, pageB.window.clipW);
check('restore() clears the clip again', pageB.window.clipAfterRestore === null, JSON.stringify(pageB.window.clipAfterRestore));
const clipIdx = ctxB.__calls.findIndex((c) => c.op === 'clip');
const fillAfterClip = ctxB.__calls.findIndex((c, i) => i > clipIdx && c.op === 'fillRect');
check('clip recorded before the fill that it affects', clipIdx >= 0 && fillAfterClip > clipIdx, `clip@${clipIdx} fill@${fillAfterClip}`);
check('clip records its subpaths and box', ctxB.__calls[clipIdx].subpaths.length === 1 && ctxB.__calls[clipIdx].box.w === 200);
check('roundRect radii normalised', ctxB.__calls.some((c) => c.op === 'roundRect' && Array.isArray(c.args[4]) && c.args[4].length === 4));
check('no warnings in the clip test', ctxB.__warnings.length === 0, JSON.stringify(ctxB.__warnings.slice(0, 3)));
check('restore is truly deep (save/restore of every state prop)', (() => {
  pageB.evalInPage(`
    var fsBefore = x.fillStyle, fontBefore = x.font, lwBefore = x.lineWidth;
    x.save();
    x.lineWidth = 9; x.fillStyle = '#123456'; x.font = '11px serif';
    x.translate(5, 6); x.globalAlpha = 0.25;
    x.beginPath(); x.rect(0, 0, 10, 10); x.clip();
    window.__clipDuring = x.__clipBox.w;
    x.restore();
    window.__revert = {
      lw: x.lineWidth, lwBefore: lwBefore,
      fsIsSame: x.fillStyle === fsBefore,
      font: x.font, fontBefore: fontBefore,
      alpha: x.globalAlpha,
      tx: x.getTransform().e, ty: x.getTransform().f,
      clip: x.__clipBox, clipDuring: window.__clipDuring
    };
  `, 'revert-test');
  const r = pageB.window.__revert;
  return r.lw === 1 && r.lwBefore === 1 && r.fsIsSame === true && r.alpha === 1
    && r.font === r.fontBefore && r.font === '40px sans-serif'
    && r.tx === 0 && r.ty === 0 && r.clip === null && r.clipDuring === 10;
})(), JSON.stringify(pageB.window.__revert));

/* ---------------------------------------------------------------- test 3 */
/* Virtual clock. */

console.log('\n3) virtual clock: timers and rAF timestamps');
const pageC = createPage({ width: 200, height: 100 });
pageC.evalInPage(`
  window.ticks = 0;
  window.late = 0;
  window.rafT = [];
  var id = setInterval(function () { window.ticks++; }, 100);
  setTimeout(function () { window.late++; }, 1000);
  setTimeout(function () { window.never = true; }, 1200);
  setTimeout(function () { window.cleared = 1; clearInterval(id); }, 1050);
  function loop(ts) { window.rafT.push(ts); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
`, 'timer-test');
check('performance.now() starts at 0', pageC.window.performance.now() === 0, pageC.window.performance.now());
pageC.advance(1000);
eq('setInterval(100ms) fired 10 times in advance(1000)', pageC.window.ticks, 10);
eq('setTimeout(1000ms) fired exactly once', pageC.window.late, 1);
check('setTimeout(1200ms) did not fire yet', !pageC.window.never);
eq('advance(1000) stepped 60 rAF frames', pageC.frameCount, 60);
eq('rAF callbacks got 60 timestamps', pageC.window.rafT.length, 60);
check('rAF timestamps end at 1000ms', Math.abs(pageC.window.rafT[59] - 1000) < 0.01, pageC.window.rafT[59]);
check('rAF timestamps advance ~16.67ms', Math.abs(pageC.window.rafT[1] - pageC.window.rafT[0] - 1000 / 60) < 0.001);
eq('performance.now() tracks the virtual clock', Math.round(pageC.window.performance.now()), 1000);
pageC.advance(300);
check('cleared interval stopped firing', pageC.window.cleared === 1 && pageC.window.ticks <= 11, pageC.window.ticks);
eq('errors while running timers', pageC.errors.length, 0);

/* ---------------------------------------------------------------- test 4 */
/* A throwing rAF callback is captured and does not stop later frames. */

console.log('\n4) throwing rAF callback is captured, frames continue');
const pageD = createPage({ width: 100, height: 100 });
pageD.evalInPage(`
  window.good = 0;
  window.bad = 0;
  function loop() {
    window.good++;
    requestAnimationFrame(loop);
    requestAnimationFrame(function boom() { window.bad++; throw new Error('boom-frame'); });
  }
  requestAnimationFrame(loop);
`, 'throwing-raf');
pageD.advance(30 * (1000 / 60));
check('good rAF callback kept running every frame', pageD.window.good === 30, pageD.window.good);
check('throwing rAF callback ran (and threw) every frame', pageD.window.bad >= 28, pageD.window.bad);
const boomErrs = pageD.errors.filter((e) => /boom-frame/.test(e.message));
check('errors captured in page.errors', boomErrs.length >= 28, boomErrs.length);
eq('error entries name the raf location', boomErrs[0] && boomErrs[0].where, 'raf');
check('error entries carry a stack', !!(boomErrs[0] && boomErrs[0].stack && boomErrs[0].stack.length > 10));
eq('frames kept advancing after the throws', pageD.frameCount, 30);
check('the harness itself did not throw', true);

// a throwing event handler must also be captured and must not block other listeners
console.log('\n4b) throwing event handler is captured, other listeners still run');
const pageE = createPage({ width: 100, height: 100 });
pageE.evalInPage(`
  window.hits = 0;
  window.order = [];
  var cv = document.createElement('canvas'); cv.width = 100; cv.height = 100;
  document.body.appendChild(cv);
  cv.addEventListener('pointerdown', function () { window.order.push('first'); throw new Error('boom-handler'); });
  cv.addEventListener('pointerdown', function () { window.hits++; window.order.push('second'); });
  window.addEventListener('pointerdown', function () { window.hits++; window.order.push('window'); });
  window.cv = cv;
`, 'event-errors');
pageE.click(50, 50);
eq('listener after the throwing one still ran', pageE.window.order.join(','), 'first,second,window');
eq('window-level listener received the bubbled event', pageE.window.hits, 2);
check('handler error captured', pageE.errors.some((e) => /boom-handler/.test(e.message)), JSON.stringify(pageE.errors.map((e) => e.message)));

/* ---------------------------------------------------------------- test 5 */
/* PNG rasterisation. */

console.log('\n5) renderToPNG (Python + Pillow)');
const pngPath = pageA.renderToPNG({ width: 640, height: 360, path: OUT_PNG, background: '#101018' });
const png = pageA.lastRenderPNG;
check('renderToPNG returns the PNG path', typeof pngPath === 'string' && pngPath === OUT_PNG, String(pngPath));
check('PNG file exists', fs.existsSync(pngPath));
check('PNG byte length > 2000', png.bytes > 2000, png.bytes);
const head = fs.readFileSync(pngPath).subarray(0, 24);
const isPng = head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
check('file starts with the PNG signature', isPng);
eq('IHDR chunk type', head.subarray(12, 16).toString('latin1'), 'IHDR');
const ihdrW = head.readUInt32BE(16);
const ihdrH = head.readUInt32BE(20);
eq('PNG IHDR width matches the requested width', ihdrW, 640);
eq('PNG IHDR height matches the requested height', ihdrH, 360);
check('rasteriser reported no failed ops', (png.raster.errors || []).length === 0, JSON.stringify(png.raster.errors));

/* ---------------------------------------------------------------- extra  */
/* A few more fidelity checks that a verification harness must not get wrong. */

console.log('\nextra) event plumbing, DOM, harness determinism');
const pageF = createPage({ width: 300, height: 200 });
pageF.evalInPage(`
  window.seen = [];
  var cv = document.createElement('canvas'); cv.id = 'c2'; cv.width = 300; cv.height = 200;
  document.body.appendChild(cv);
  window.cv = cv;
  cv.addEventListener('pointermove', function (e) {
    window.seen.push([e.clientX, e.clientY, e.offsetX, e.offsetY, e.buttons, e.pointerId, e.isPrimary]);
  });
  cv.addEventListener('wheel', function (e) { window.wheelY = e.deltaY; });
  cv.addEventListener('keydown', function (e) { window.key = e.key + '/' + e.code; });
  window.addEventListener('keydown', function (e) { window.keyAtWindow = e.key; });
  window.div = document.createElement('div');
  window.div.innerHTML = '<b>not parsed</b>';
  window.div.setAttribute('data-x', '7');
  document.body.appendChild(window.div);
`, 'events');
pageF.move(12, 34, { buttons: 0 });
pageF.drag(10, 10, 110, 60, 5);
pageF.wheel(50, 50, -120);
pageF.window.cv.focus();                       // key events go to the focused element, like a browser
pageF.key('keydown', { key: 'ArrowLeft' });
pageF.fire(pageF.window.cv, undefined, 'keyup');
const mv = pageF.window.seen;
check('pointermove carried coordinates', mv.length >= 6 && mv[0][0] === 12 && mv[0][1] === 34, JSON.stringify(mv[0]));
check('offsetX/offsetY present', mv[0][2] === 12 && mv[0][3] === 34, JSON.stringify(mv[0]));
check('drag sends buttons=1 moves', mv.some((m) => m[4] === 1), JSON.stringify(mv.map((m) => m[4])));
check('wheel deltaY delivered', pageF.window.wheelY === -120, pageF.window.wheelY);
check('key event delivered to the focused canvas and bubbles to window',
  pageF.window.key === 'ArrowLeft/ArrowLeft' && pageF.window.keyAtWindow === 'ArrowLeft',
  JSON.stringify([pageF.window.key, pageF.window.keyAtWindow]));
check('innerHTML stored, not parsed', pageF.window.div.innerHTML === '<b>not parsed</b>' && pageF.window.div.children.length === 0);
check('dataset updated from setAttribute', pageF.window.div.dataset.x === '7');
check('querySelector finds elements by id/class/tag', pageF.document.querySelector('#c2') === pageF.window.cv
  && pageF.document.querySelectorAll('canvas').length === 1
  && pageF.document.querySelectorAll('div').length >= 1);
eq('no errors during DOM/event checks', pageF.errors.length, 0);

// determinism: the same page advanced twice must produce identical digests
const digest1 = JSON.stringify(ctxA.__digest({ frame: 'last' }));
const digest2 = JSON.stringify(ctxA.__digest({ frame: 'last' }));
check('digest is stable between calls', digest1 === digest2);
const pageG = createPage({ width: 640, height: 360 });
pageG.loadHtml(htmlPath);
pageG.loadScriptsInOrder(htmlPath);
pageG.advance(FRAMES_A * (1000 / 60));
const digest3 = JSON.stringify(pageG.mainContext().__digest({ frame: 'last' }));
check('a re-run of the same page produces the same final frame', digest1 === digest3, `${digest1.length} vs ${digest3.length} bytes`);

// colour parsing used by the renderers
check('parseColor handles hex/rgb/hsl/named', parseColor('#f00')[0] === 255
  && parseColor('rgba(0,0,255,0.5)')[3] === 0.5
  && parseColor('hsl(120, 100%, 50%)')[1] === 255
  && parseColor('rebeccapurple') === null
  && parseColor('transparent')[3] === 0);

// state save/restore of the transform stack
check('transform ops compose', (() => {
  const p = createPage({ width: 10, height: 10 });
  p.evalInPage(`
    var cv2 = document.createElement('canvas'); document.body.appendChild(cv2);
    var q = cv2.getContext('2d');
    q.translate(10, 20); q.scale(2, 2); q.rotate(Math.PI / 2);
    window.tf = q.getTransform();
    q.setTransform(1, 0, 0, 1, 0, 0);
    window.tf2 = q.getTransform();
    window.mt = q.measureText('abc').width;
  `, 'transform');
  const t = p.window.tf;
  const okRot = Math.abs(t.a - 0) < 1e-6 && Math.abs(t.b - 2) < 1e-6 && Math.abs(t.c + 2) < 1e-6 && Math.abs(t.d - 0) < 1e-6;
  return okRot && Math.abs(t.e - 10) < 1e-9 && Math.abs(t.f - 20) < 1e-9 && p.window.tf2.a === 1 && Number.isFinite(p.window.mt);
})());

// NaN handling: a drawing call with NaN must warn instead of corrupting output
check('NaN arguments raise a warning and are skipped', (() => {
  const p = createPage({ width: 50, height: 50 });
  p.evalInPage(`
    var cv3 = document.createElement('canvas'); document.body.appendChild(cv3);
    var r = cv3.getContext('2d');
    r.beginPath(); r.moveTo(0, 0); r.lineTo(NaN, 10); r.lineTo(5, 5); r.closePath();
    r.fill(); r.fillStyle = '#fff'; r.fillRect(Infinity, 0, 10, 10);
    window.nanWarn = r.__warnings.length;
    window.nanOps = r.__warnings.map(function (w) { return w.op; }).join(',');
    window.nanFinite = Number.isFinite(r.measureText('abc').width);
  `, 'nan-test');
  return p.window.nanWarn >= 2 && /lineTo/.test(p.window.nanOps) && /fillRect/.test(p.window.nanOps) && p.window.nanFinite;
})());

// CSS box model: canvas sizing comes from clientWidth/Height in almost every
// Canvas project, so the mock must resolve stylesheet rules like a browser.
writeScratch('layout.css', '#box { width: 250px; height: 40px; }\n');
const LAYOUT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="layout.css">
<style>
  html, body { margin: 0; height: 100%; }
  #stage { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style></head>
<body><canvas id="stage"></canvas><div id="box"></div>
<script>
  var c = document.getElementById('stage');
  window.__cw = c.clientWidth; window.__ch = c.clientHeight;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(Math.max(320, c.clientWidth || window.innerWidth) * dpr);
  c.height = Math.round(Math.max(240, c.clientHeight || window.innerHeight) * dpr);
  window.__rect = c.getBoundingClientRect();
  window.__computed = window.getComputedStyle(c).width;
  window.__boxW = document.getElementById('box').clientWidth;
</script></body></html>`;
const layoutPath = writeScratch('layout.html', LAYOUT_HTML);
const pageH = createPage({ width: 1440, height: 900 });
pageH.loadHtml(layoutPath);
pageH.loadScriptsInOrder(layoutPath);
check('CSS 100%/100% + fixed/inset resolves clientWidth to the viewport',
  pageH.window.__cw === 1440 && pageH.window.__ch === 900, JSON.stringify([pageH.window.__cw, pageH.window.__ch]));
check('canvas bitmap sized from clientWidth, as a browser would',
  pageH.canvasElement.width === 1440 && pageH.canvasElement.height === 900,
  JSON.stringify([pageH.canvasElement.width, pageH.canvasElement.height]));
check('getBoundingClientRect uses the CSS box',
  pageH.window.__rect.width === 1440 && pageH.window.__rect.height === 900, JSON.stringify(pageH.window.__rect));
check('getComputedStyle resolves width to px', pageH.window.__computed === '1440px', pageH.window.__computed);
check('linked stylesheet rules are applied', pageH.window.__boxW === 250, pageH.window.__boxW);
check('a canvas with no CSS keeps the browser default 300x150 box', (() => {
  const p = createPage({ width: 800, height: 600 });
  p.evalInPage('var k = document.createElement("canvas"); document.body.appendChild(k); window.kb = [k.clientWidth, k.clientHeight];', 'default-box');
  return p.window.kb[0] === 300 && p.window.kb[1] === 150;
})());

/* --------------------------------------------------------------- result */

console.log('\n--------------------------------------------------------------');
console.log(`harness v${VERSION} · ${checks} assertions · ${failures.length} failure(s)`);
for (const n of notes) console.log('note: ' + n);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log('  - ' + f);
  console.log('\nSELFTEST FAILED');
  process.exit(1);
}
console.log('SELFTEST OK');
console.log('PNG: ' + OUT_PNG);
console.log('SVG: ' + OUT_SVG);
console.log('version: ' + process.version + '  (python rasteriser via mockdom_raster.py)');
