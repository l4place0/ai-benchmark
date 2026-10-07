/* =========================================================================
   Pure Line Room — main.js
   Boot, camera controls and the animation loop. The room itself is assembled
   from independent object modules in js/objects/, each of which registers a
   builder with PLR.objects.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;
  var ease = M.ease;

  PLR.objects = PLR.objects || {};

  var ROOM = PLR.layout;

  var VIEW_HOME = { yaw: 0, pitch: PLR.layout.camera.pitch, dist: 0 };
  var YAW_LIMIT = 1.36;
  var PITCH_MIN = -1.12;
  var PITCH_MAX = 0.62;

  var app = {
    ROOM: ROOM,
    scene: null,
    renderer: null,
    state: null,
    canvas: null,
    running: false,
    pointer: { x: -999, y: -999, inside: false },
    drag: null,
    yaw: VIEW_HOME.yaw,
    pitch: VIEW_HOME.pitch,
    dolly: 0,
    targetYaw: 0,
    targetPitch: VIEW_HOME.pitch,
    targetDolly: 0,
    _recentrePending: true,
    hint: null,
    fps: 60,
    _worst: 0,
    _frame: 0,
  };
  PLR.app = app;

  /* ------------------------------- helpers ------------------------------- */
  function clampPos(pos) {
    var m = 40;
    pos[0] = M.clamp(pos[0], ROOM.x0 + m, ROOM.x1 - m);
    pos[1] = M.clamp(pos[1], ROOM.y0 + 42, ROOM.y1 - 42);
    pos[2] = M.clamp(pos[2], ROOM.z0 + m, ROOM.z1 - m);
    return pos;
  }

  app.homePosition = function () {
    var h = PLR.layout.camera.home;
    return [h[0], h[1], h[2]];
  };

  /* -------------------------------- boot --------------------------------- */
  function boot() {
    var canvas = document.getElementById('stage');
    app.canvas = canvas;
    var renderer = (app.renderer = new PLR.renderer.Renderer(canvas));
    renderer.focal = PLR.layout.camera.focal;
    renderer.center = PLR.layout.camera.center;

    app.state = PLR.state.init();

    var palette = PLR.palette.build(app.state.phase);
    renderer.setPalette(palette);

    var scene = (app.scene = new PLR.scene.Scene({ palette: palette }));

    // give every object module a chance to build itself
    if (PLR.objects.build) PLR.objects.build(app);

    scene.invalidate();
    app.resize();
    resetView();

    root.addEventListener('resize', app.resize);
    bindPointer(canvas);
    bindKeys();

    app.hint = document.getElementById('hint');
    if (app.hint) {
      setTimeout(function () { if (app.hint) app.hint.classList.add('fade'); }, 9000);
    }
    app.running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  app.resize = function () {
    var w = root.innerWidth, h = root.innerHeight;
    app.renderer.resize(w, h, root.devicePixelRatio || 1, 1.6);
    if (app._overlayCss) app._overlayCss(w, h);
  };

  function resetView() {
    var home = app.homePosition();
    app.renderer.setCamera(home, VIEW_HOME.yaw, VIEW_HOME.pitch);
    app.yaw = VIEW_HOME.yaw; app.pitch = VIEW_HOME.pitch; app.dolly = 0;
    app.targetYaw = 0; app.targetPitch = VIEW_HOME.pitch; app.targetDolly = 0;
    app._recentrePending = false;
  }

  /* ------------------------------- pointer ------------------------------- */
  function bindPointer(canvas) {
    var down = null;

    canvas.addEventListener('pointerdown', function (ev) {
      PLR.audio.resume();
      var hit = pickAt(ev.clientX, ev.clientY);
      down = {
        x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY,
        hit: hit, moved: 0, t: performance.now(), button: ev.button,
        dragging: false,
      };
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      if (hit) {
        var pr = hit.node.action;
        if (pr) {
          pr.pressed = true;
          if (pr.opts.press) pr.opts.press(pr, true, ev);
          if (pr.opts.onDrag) {
            down.dragging = true;
            pr.dragging = true;
            app.drag = { pr: pr, x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 };
          }
        }
        app.renderer.canvas.style.cursor = 'pointer';
      }
    });

    canvas.addEventListener('pointermove', function (ev) {
      app.pointer.x = ev.clientX;
      app.pointer.y = ev.clientY;
      app.pointer.inside = true;
      if (!down) return;
      var dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      down.x = ev.clientX; down.y = ev.clientY;
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (app.drag) {
        var pr = app.drag.pr;
        app.drag.moved += Math.abs(dx) + Math.abs(dy);
        if (pr.opts.onDrag(pr, dx, dy, dt, ev) !== false) return;
      }
      if (down.moved > 4) {
        app.targetYaw = M.clamp(app.targetYaw + dx * 0.0032, -YAW_LIMIT, YAW_LIMIT);
        app.targetPitch = M.clamp(app.targetPitch + dy * 0.0026, PITCH_MIN, PITCH_MAX);
        app._userLook = true;
      }
    });

    function finish(ev) {
      if (!down) return;
      var dt2 = performance.now() - down.t;
      if (app.drag) { app.drag.pr.dragging = false; app.drag = null; }
      if (down.hit) {
        var pr2 = down.hit.node.action;
        if (pr2) {
          pr2.pressed = false;
          if (pr2.opts.press) pr2.opts.press(pr2, false, ev);
          if (down.moved < 7 && dt2 < 900) pr2.click(ev);
        }
      } else if (down.moved < 6 && dt2 < 400 && !app._userLook) {
        // a tap on empty space recentres the view
        app.recentre();
      }
      down = null;
      app._userLook = false;
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', function () {
      if (app.drag) { app.drag.pr.dragging = false; app.drag = null; }
      down = null;
      app._userLook = false;
    });
    canvas.addEventListener('pointerleave', function () {
      app.pointer.inside = false;
    });

    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      app.targetDolly = M.clamp(app.targetDolly + Math.sign(ev.deltaY) * Math.min(90, Math.abs(ev.deltaY) * 0.9), -330, 130);
    }, { passive: false });

    canvas.addEventListener('dblclick', function () { app.recentre(); });

    canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  app.recentre = function () {
    app.targetYaw = 0;
    app.targetPitch = VIEW_HOME.pitch;
    app.targetDolly = 0;
  };

  var Pr = { drag: null };

  function pickAt(cx, cy) {
    var rect = app.canvas.getBoundingClientRect();
    var scale = app.renderer.w / rect.width;
    var x = (cx - rect.left) * scale;
    var y = (cy - rect.top) * scale;
    return app.renderer.pick(x, y);
  }

  function bindKeys() {
    root.addEventListener('keydown', function (ev) {
      if (ev.key === 'Tab') {
        ev.preventDefault();
        PLR.interact.Act.cycleFocus(ev.shiftKey ? -1 : 1);
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        var f = PLR.interact.Act.focus;
        if (f) { ev.preventDefault(); PLR.audio.resume(); f.click(ev); }
        return;
      }
      if (ev.key === 'Escape') PLR.interact.Act.focus = null;
      if (ev.key === 'r' || ev.key === 'R') app.recentre();
      var step = 26;
      if (ev.key === 'ArrowLeft') app.targetYaw = M.clamp(app.targetYaw - 0.08, -YAW_LIMIT, YAW_LIMIT);
      if (ev.key === 'ArrowRight') app.targetYaw = M.clamp(app.targetYaw + 0.08, -YAW_LIMIT, YAW_LIMIT);
      if (ev.key === 'ArrowUp') app.targetPitch = M.clamp(app.targetPitch - 0.06, PITCH_MIN, PITCH_MAX);
      if (ev.key === 'ArrowDown') app.targetPitch = M.clamp(app.targetPitch + 0.06, PITCH_MIN, PITCH_MAX);
      if (ev.key === 'w' || ev.key === 'W') app.targetDolly = M.clamp(app.targetDolly - step, -330, 130);
      if (ev.key === 's' || ev.key === 'S') app.targetDolly = M.clamp(app.targetDolly + step, -330, 130);
      if (ev.key === 'm' || ev.key === 'M') {
        PLR.audio.setEnabled(!PLR.audio.enabled);
        app.toast(PLR.audio.enabled ? 'sound on' : 'sound off');
      }
    });
  }

  app.toast = function (text, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(app._toastT);
    app._toastT = setTimeout(function () { el.classList.remove('show'); }, ms || 1600);
  };

  /* ------------------------------ main loop ------------------------------ */
  var last = 0;
  var audioAcc = 0;

  function frame(now) {
    if (!app.running) return;
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    app._frame++;
    app.fps = app.fps * 0.92 + (dt > 0 ? 1 / dt : 60) * 0.08;

    var state = app.state;
    state.update(dt);
    PLR.interact.Act.step(dt);

    // palette follows the environment
    var pal = app.renderer.palette;
    var target = PLR.palette.build(state.phase);
    // reuse the same object so materials stay cheap to resolve
    for (var k in target) if (target.hasOwnProperty(k)) pal[k] = target[k];
    pal.__time = state.phase;

    // camera
    var r = app.renderer;
    updateCameraFromInput(dt);
    r.updateCamera(dt);
    applyBreathing(now);

    app.scene.update(dt, state);
    r.render(app.scene);
    updateHover();

    // audio beds
    PLR.audio.setChannels(state);
    PLR.audio.updateMusic(state, dt);
    PLR.audio.updateClock(state, dt);

    if (app.timeCb) app.timeCb(state);
    requestAnimationFrame(frame);
  }

  function updateCameraFromInput(dt) {
    var r = app.renderer;
    var k = 1 - Math.exp(-6.5 * dt);
    app.yaw += (app.targetYaw - app.yaw) * k;
    app.pitch += (app.targetPitch - app.pitch) * k;
    app.dolly += (app.targetDolly - app.dolly) * k;
    var home = app.homePosition();
    var pos = [home[0], home[1], home[2] + app.dolly];
    clampPos(pos);
    r.setCameraFromControl(pos, app.yaw, app.pitch);
  }

  function applyBreathing(now) {
    var r = app.renderer;
    var t = now / 1000;
    r.cam.pos[0] += Math.sin(t * 0.31) * 0.9;
    r.cam.pos[1] += Math.sin(t * 0.47 + 1.2) * 0.7;
    r.cam.yaw += Math.sin(t * 0.23 + 0.6) * 0.0009;
    r.cam.pitch += Math.sin(t * 0.29 + 2.1) * 0.0011;
  }

  function updateHover() {
    var r = app.renderer;
    if (!app.pointer.inside) {
      if (PLR.interact.Act.hover) PLR.interact.Act.hover.hover(false);
      return;
    }
    var hit = r.pick(app.pointer.x, app.pointer.y);
    var pr = hit && hit.node.action ? hit.node.action : null;
    if (pr !== PLR.interact.Act.hover) {
      if (PLR.interact.Act.hover) PLR.interact.Act.hover.hover(false);
      if (pr) pr.hover(true);
    }
    app.canvas.style.cursor = pr ? 'pointer' : 'default';
  }

  /* The renderer needs a place to write the controlled camera position that
     is not stomped by its own damping. */
  PLR.renderer.Renderer.prototype.setCameraFromControl = function (pos, yaw, pitch) {
    this.cam.targetPos[0] = pos[0];
    this.cam.targetPos[1] = pos[1];
    this.cam.targetPos[2] = pos[2];
    this.cam.targetYaw = yaw;
    this.cam.targetPitch = pitch;
    this.cam.lambda = 9.5;
  };

  /* ------------------------------- start --------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
