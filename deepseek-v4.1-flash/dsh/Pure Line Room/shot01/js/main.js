/* =============================================================================
   Pure Line Room — main.js
   Assembles the room, drives the frame loop, owns the camera, the environment
   (time of day + lighting) and the 2D layers that live on top of the 3D line
   art: the view through the window, lamp haloes, steam, dust and the readouts.

   Design note: there is no control panel. The room is the interface. The only
   chrome is a title card that fades away, a hover label that follows the thing
   you are pointing at, and a two-line legend in the corner.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;

  var FOV = 34;
  var NEAR = 0.06;
  var FAR = 90;

  var el = {};
  ['stage', 'tip', 'tipName', 'tipHint', 'hud', 'clock', 'state', 'title', 'legend', 'mute', 'loading']
    .forEach(function (id) { el[id] = document.getElementById(id); });

  /* ------------------------------------------------------------------ canvas */
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var view = { w: 800, h: 600, dpr: 1 };

  function resize() {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(320, canvas.clientWidth || global.innerWidth);
    var h = Math.max(240, canvas.clientHeight || global.innerHeight);
    view.w = w; view.h = h; view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    renderer.resize(canvas.width, canvas.height);
  }

  /* ------------------------------------------------------------------- scene */
  var scene = new P.Scene();
  var renderer = new P.Renderer(canvas, scene, { fov: 46 });
  var audio = new P.Audio();
  var interact = new P.Interact(canvas, renderer, scene);

  var ENV = scene.env;
  ENV.hour = 12; ENV.minute = 0; ENV.day = 1; ENV.lightsOn = false; ENV.lampOn = false;
  ENV.autoTime = true;
  ENV.second = 0;

  var sctx = {
    scene: scene,
    env: ENV,
    parts: {},
    register: function (o) { return interact.register(o); },
    toast: function (t) { toast(t); },
    audio: audio,
    anim: P.anim,
    theme: null
  };

  P.roomBuild(sctx);
  if (P.deskBuild) P.deskBuild(sctx);
  if (P.shelfBuild) P.shelfBuild(sctx);
  if (P.loungeBuild) P.loungeBuild(sctx);
  if (P.ceilingBuild) P.ceilingBuild(sctx);

  interact.audio = audio;
  interact.env = ENV;
  interact.toast = function (t) { toast(t); };
  interact.setEnv = setEnv;

  /* -------------------------------------------------------------- environment */
  /**
   * Daylight outside, as a smooth function of the clock. Kept deliberately
   * generous — the window should always be readable, and the piece is meant to
   * be looked at at any hour — but night is unmistakably night.
   */
  function twilight(hour) {
    var h = ((hour % 24) + 24) % 24;
    if (h < 5.0) return 0.10 + 0.06 * (h / 5.0);
    if (h < 7.4) return M.lerp(0.16, 0.72, M.smoothstep((h - 5.0) / 2.4));
    if (h < 16.6) return 0.72 + 0.28 * M.smoothstep((h - 7.4) / 9.2);
    if (h < 19.6) return M.lerp(1.0, 0.55, M.smoothstep((h - 16.6) / 3.0));
    if (h < 21.6) return M.lerp(0.55, 0.16, M.smoothstep((h - 19.6) / 2.0));
    return 0.16 - 0.06 * M.smoothstep((h - 21.6) / 2.4);
  }

  function setEnv(patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) ENV[k] = patch[k];
    if ('lightsOn' in patch || 'lampOn' in patch) {
      audio.play('switch', { on: !!ENV.lightsOn });
    }
    if (audio.setEnv) audio.setEnv(ENV);
    themeDirty = true;
  }

  var themeDirty = true;
  var theme = P.palette.build(ENV);

  function refreshTheme() {
    theme = P.palette.build(ENV);
    themeDirty = false;
  }

  /* -------------------------------------------------------------------- clock */
  function syncClock() {
    var d = new Date();
    var h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    ENV.second = d.getSeconds() + d.getMilliseconds() / 1000;
    if (ENV.autoTime) {
      ENV.hour = d.getHours();
      ENV.minute = d.getMinutes();
      ENV.day = twilight(h);
    }
    if (el.clock) {
      el.clock.textContent =
        ('0' + d.getHours()).slice(-2) + ':' +
        ('0' + d.getMinutes()).slice(-2) + ':' +
        ('0' + d.getSeconds()).slice(-2);
    }
    if (el.state) {
      var label = ENV.day > 0.72 ? '白天' : (ENV.day > 0.34 ? '黄昏' : '夜晚');
      el.state.textContent = label + ' · 室外 ' + Math.round(ENV.day * 100) + '%' +
        (ENV.lightsOn ? ' · 室内灯亮' : '') + (ENV.lampOn ? ' · 台灯亮' : '');
    }
  }

  /* ------------------------------------------------------------------- camera */
  /*
     The room is 3.4 × 5.2 × 2.72 m and closed on all four sides, so it is shown
     as a section: the south wall (the one the camera sits behind) starts hidden
     and `C` closes it again.

     The camera is an *eye orbit*: `orbit` is the point the eye circles, and
     `look` is the point it aims at. Keeping the two separate is what makes this
     room composable — the eye can sit outside the window wall while still
     looking across the room, instead of the eye always being pushed away from
     whatever it is looking at.

     Sign convention: the eye sits at
        orbit + (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)) · dist
     so a POSITIVE pitch raises the eye and looks down.
  */
  var CAM_HOME = {
    orbit: [0.00, 1.45, 0.00],
    look: [0.30, 1.25, -1.90],
    yaw: 0.30, pitch: 0.03, dist: 3.07
  };
  var cam = {
    // orbiting centre and aim point are independent
    orbit: CAM_HOME.orbit.slice(),
    look: CAM_HOME.look.slice(),
    // kept for main.js's HUD/probes: `target` is the aim point
    target: CAM_HOME.look.slice(),
    yaw: CAM_HOME.yaw, pitch: CAM_HOME.pitch, dist: CAM_HOME.dist,
    tyaw: CAM_HOME.yaw, tpitch: CAM_HOME.pitch, tdist: CAM_HOME.dist,
    idle: 0, t: 0
  };
  var IDLE_AFTER = 9;
  var CAM_PAD = 0.30;          // keep-out margin around every mesh
  var _eye = [0, 0, 0];
  var _aim = [0, 0, 0];

  function eyePos() {
    var cp = Math.cos(cam.pitch);
    var o = cam.orbit;
    _eye[0] = o[0] + Math.sin(cam.yaw) * cam.dist * cp;
    _eye[1] = o[1] + Math.sin(cam.pitch) * cam.dist;
    _eye[2] = o[2] + Math.cos(cam.yaw) * cam.dist * cp;
    return _eye;
  }

  /** The point the camera aims at: `look` plus the ambient breathing drift. */
  function aimPos() {
    var s = scene.time;
    _aim[0] = cam.look[0] + Math.sin(s * 0.17) * 0.012;
    _aim[1] = cam.look[1] + Math.sin(s * 0.21) * 0.006 + Math.sin(s * 0.53) * 0.003;
    _aim[2] = cam.look[2] + Math.cos(s * 0.14) * 0.012;
    return _aim;
  }

  /**
   * Push the eye out of anything solid. Only *furniture* counts: the room shell
   * (walls / floor / ceiling) is deliberately excluded, because the camera is
   * meant to sit outside it — that is what makes the section view work — and
   * treating the shell as an obstacle would fight the orbit and pin the eye
   * inside the box.
   */
  function avoidSolids(eye) {
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < scene.meshes.length; i++) {
        var m = scene.meshes[i];
        if (m.noCollide || (m.layer || 0) < 0) continue;
        var b = m.getBounds();
        var sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
        // architectural-scale pieces (and anything huge) do not displace the eye
        if (sx > 2.6 || sy > 2.2 || sz > 2.6) continue;
        var inside = true, best = Infinity, axis = 0, target = 0;
        for (var k = 0; k < 3; k++) {
          var lo = b.min[k] - CAM_PAD, hi = b.max[k] + CAM_PAD;
          if (eye[k] < lo || eye[k] > hi) { inside = false; break; }
          var dLo = eye[k] - (lo - 0.02);
          var dHi = (hi + 0.02) - eye[k];
          var d = Math.min(dLo, dHi);
          if (d < best) {
            best = d; axis = k;
            target = dLo < dHi ? lo - 0.02 : hi + 0.02;
          }
        }
        if (!inside || !isFinite(best)) continue;
        eye[axis] = target;
      }
    }
    eye[0] = M.clamp(eye[0], -5.0, 5.0);
    eye[1] = M.clamp(eye[1], 0.55, 5.5);
    eye[2] = M.clamp(eye[2], -7.0, 7.5);
    return eye;
  }

  function clampCamera() {
    cam.tdist = M.clamp(cam.tdist, 2.3, 8.5);
    cam.tpitch = M.clamp(cam.tpitch, -0.55, 1.05);
    cam.tyaw = M.clamp(cam.tyaw, -1.30, 2.20);
  }

  interact.onCamera = function (info) {
    if (info.phase === 'move') {
      cam.idle = 0;
      cam.tyaw -= info.dx * 0.0052;
      cam.tpitch += info.dy * 0.0042;
      clampCamera();
    } else if (info.phase === 'wheel') {
      cam.idle = 0;
      var d = info.delta * (info.deltaMode === 1 ? 18 : 1);
      cam.tdist = M.clamp(cam.tdist * (1 + d * 0.00085), 2.55, 6.0);
    }
  };

  /* ---------------------------------------------------------------- view modes
     A development aid (also handy for judging the work): `PLR.app.setView()`
     can drop the sky, drop the 3D pass, or isolate a single mesh so a shape can
     be inspected without the rest of the room in the way.
     ------------------------------------------------------------------------- */
  var viewMode = { sky: true, room: true, only: null, wire: false };

  function setView(mode) {
    if (mode === 'sky') { viewMode.sky = true; viewMode.room = false; viewMode.only = null; }
    else if (mode === '3d') { viewMode.sky = false; viewMode.room = true; viewMode.only = null; }
    else if (mode === 'all' || !mode) { viewMode.sky = true; viewMode.room = true; viewMode.only = null; }
    else if (typeof mode === 'number' || Array.isArray(mode)) {
      viewMode.only = Array.isArray(mode) ? mode : [mode];
      viewMode.sky = false; viewMode.room = true;
    } else if (typeof mode === 'string') {
      viewMode.only = [];
      for (var i = 0; i < scene.meshes.length; i++) {
        if ((scene.meshes[i].name || '').indexOf(mode) === 0) viewMode.only.push(i);
      }
      viewMode.sky = false; viewMode.room = true;
    } else if (mode === 'names') {
      return scene.meshes.map(function (m, i) { return i + ':' + (m.name || '?'); });
    } else if (mode === 'tint') {
      viewMode.tint = ['#e8a0a0', '#a0c8e8', '#a8e0b0', '#e8d8a0', '#c8a8e0', '#a0e0dc',
        '#f0b0d0', '#c0c0f0', '#d8e8a0', '#e0c0a0', '#f0d0a0', '#b0d8f0'];
      viewMode.only = null; viewMode.sky = false; viewMode.room = true;
    }
    return viewMode;
  }

  function applyView() {
    for (var i = 0; i < scene.meshes.length; i++) {
      var m = scene.meshes[i];
      if (viewMode.only) m.hidden = viewMode.only.indexOf(i) < 0;
      else m.hidden = !!m.__devHidden;
      if (viewMode.tint) m.debugTint = viewMode.tint[i % viewMode.tint.length];
      else m.debugTint = null;
    }
  }
  var dust = [];
  (function () {
    for (var i = 0; i < 54; i++) {
      dust.push({
        x: P.geom.rndRange(i * 1.7 + 0.3, -1.6, 1.6),
        y: P.geom.rndRange(i * 3.1 + 1.4, 0.15, 2.6),
        z: P.geom.rndRange(i * 5.9 + 2.2, -2.4, 2.4),
        ph: P.geom.rnd(i * 7.7) * 6.28,
        sp: 0.14 + P.geom.rnd(i * 11.3) * 0.3,
        r: 0.5 + P.geom.rnd(i * 13.1) * 1.1
      });
    }
  })();

  function projectedBox(corners) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, ok = 0;
    for (var i = 0; i < corners.length; i++) {
      var s = renderer.project(corners[i]);
      if (!s) continue;
      ok++;
      if (s[0] < minX) minX = s[0];
      if (s[0] > maxX) maxX = s[0];
      if (s[1] < minY) minY = s[1];
      if (s[1] > maxY) maxY = s[1];
    }
    if (ok < 4) return null;
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  /**
   * Composite the view through the window. Called from inside the 3D pass (in
   * device pixels, between the shell layer and the furniture layer) and clipped
   * to the projected opening, so the wall occludes it exactly and the frame,
   * sash bars, blinds and curtain all still draw on top of it.
   */
  /**
   * Composite the view through the window.
   *
   * Called from inside the 3D pass, between the shell layer and the furniture
   * layer, and clipped to the intersection of two screen-space polygons:
   *
   *   1. the projected window opening — so the sky only ever appears in the
   *      opening, and the wall around it occludes it by simply being drawn
   *      first; and
   *   2. the projected footprint of the room box — because the camera can sit
   *      outside a wall, where a ray through the opening leaves the building
   *      through the near wall before it reaches the sky. That is exactly the
   *      case that otherwise paints a wedge of sky above the ceiling.
   *
   * The result is a correct view through a real opening in a real wall, with no
   * hole cut in the geometry and no depth buffer.
   */
  function drawSky() {
    var wb = sctx.windowBox;
    if (!wb || !P.outdoor) return;
    var x = wb[0] + 0.03, y0 = wb[1], z0 = wb[2], y1 = wb[3], z1 = wb[4];
    var corners = [
      [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]
    ];
    var box = projectedBox(corners);
    if (!box) return;
    var R = sctx.ROOM;
    if (!R) return;
    var eye = renderer.eye;
    // If the eye is nearly in the plane of the glass, or behind it, there is no
    // window to look through — skip the whole layer rather than drawing a
    // degenerate sliver.
    var pc = [(corners[0][0] + corners[2][0]) / 2, (corners[0][1] + corners[2][1]) / 2, (corners[0][2] + corners[2][2]) / 2];
    var toEye = M.norm(M.sub(eye, pc));
    if (toEye[0] < 0.18) return;                // glass turned away / edge-on
    // Clip in 3D *before* projecting: the camera is usually outside one or two
    // of the room's walls (that is the whole point of the section view), and a
    // ray through the opening then leaves the building through that wall — so
    // the sky has to be trimmed to the eye's side of it. Without this, a wedge
    // of sky paints over the ceiling above the window.
    var quad = corners.slice();
    var hull = [
      { n: [-1, 0, 0], c: R.x0 }, { n: [1, 0, 0], c: R.x1 },
      { n: [0, 0, -1], c: R.z0 }, { n: [0, 0, 1], c: R.z1 },
      { n: [0, -1, 0], c: 0 }, { n: [0, 1, 0], c: R.h }
    ];
    for (var hi = 0; hi < hull.length; hi++) {
      var pl = hull[hi];
      var d = (eye[0] * pl.n[0] + eye[1] * pl.n[1] + eye[2] * pl.n[2]) - pl.c;
      if (Math.abs(d) <= 0.02) continue;       // the eye lies in this plane
      var side = d > 0 ? 1 : -1;               // keep the half-space the eye is in
      var out = [];
      for (var ci = 0; ci < quad.length; ci++) {
        var A = quad[ci], B = quad[(ci + 1) % quad.length];
        var va = (pl.n[0] * A[0] + pl.n[1] * A[1] + pl.n[2] * A[2] - pl.c) * side;
        var vb = (pl.n[0] * B[0] + pl.n[1] * B[1] + pl.n[2] * B[2] - pl.c) * side;
        var ina = va >= 0, inb = vb >= 0;
        if (ina) out.push(A);
        if (ina !== inb) {
          var t = va / (va - vb);
          out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
        }
      }
      if (out.length < 3) return;
      quad = out;
    }

    var scr = [];
    for (var qi = 0; qi < quad.length; qi++) {
      var sp = renderer.project(quad[qi]);
      if (!sp) return;
      scr.push(sp);
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(scr[0][0], scr[0][1]);
    for (var q = 1; q < scr.length; q++) ctx.lineTo(scr[q][0], scr[q][1]);
    ctx.closePath();
    ctx.clip();
    P.outdoor.draw(ctx, projectedBox(quad) || box, ENV, scene.time, {});
    ctx.restore();
  }

  /** Build the current palette (also used by the debug probes). */
  function currentTheme() { return theme; }

  function drawGlows() {
    var lamp = sctx.parts.lampGlow;
    if (lamp && lamp.strength > 0.01) {
      var lp = lamp.pos || lamp.center;
      var s = renderer.project(lp);
      if (s) {
        var up = renderer.project([lp[0], lp[1] + 0.42, lp[2]]);
        var rad = M.clamp(up ? Math.abs(s[1] - up[1]) * 2.6 : 44, 18, 90);
        var g = ctx.createRadialGradient(s[0], s[1], 2, s[0], s[1], rad);
        var a = 0.26 * lamp.strength;
        g.addColorStop(0, 'rgba(255,230,178,' + a.toFixed(3) + ')');
        g.addColorStop(0.45, 'rgba(255,224,166,' + (a * 0.30).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s[0], s[1], rad, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // the room light: a small halo just under the shade, not a flood — the
    // palette already carries the fact that the room is lit
    var pend = sctx.parts.pendant;
    if (pend && pend.on > 0.01) {
      var ps = renderer.project([pend.pos[0], pend.pos[1] - 0.12, pend.pos[2]]);
      if (ps) {
        var rTop = renderer.project([pend.pos[0], pend.pos[1] + 0.55, pend.pos[2]]);
        var span = M.clamp(rTop ? Math.abs(ps[1] - rTop[1]) * 1.15 : 46, 22, 72);
        var g2 = ctx.createRadialGradient(ps[0], ps[1], 2, ps[0], ps[1], span);
        var a2 = 0.085 * pend.on;
        g2.addColorStop(0, 'rgba(255,236,198,' + a2.toFixed(3) + ')');
        g2.addColorStop(0.55, 'rgba(255,230,180,' + (a2 * 0.22).toFixed(3) + ')');
        g2.addColorStop(1, 'rgba(255,226,170,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(ps[0], ps[1], span, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawSteam() {
    var st = sctx.parts.steam;
    if (!st || st.strength < 0.02) return;
    var p0 = renderer.project(st.origin);
    if (!p0) return;
    var p1 = renderer.project([st.origin[0] + 0.05, st.origin[1] + 0.16, st.origin[2] - 0.03]);
    if (!p1) return;
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    ctx.save();
    ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var phase = scene.time * (0.42 + i * 0.11) + i * 2.1;
      ctx.globalAlpha = st.strength * (0.30 - i * 0.05);
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = M.clamp(1.5 - i * 0.25, 0.5, 3);
      ctx.beginPath();
      var steps = 12;
      for (var s = 0; s <= steps; s++) {
        var u = s / steps;
        var wob = Math.sin(phase + u * 4.2) * 5 * u;
        var px = p0[0] + dx * (u * 3.4) + wob * (1 + i * 0.3) - i * 4;
        var py = p0[1] + dy * (u * 3.4) - u * 26 - i * 3;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // a couple of detached wisps
    for (var k = 0; k < 2; k++) {
      var tt = (scene.time * 0.32 + k * 0.5) % 1;
      var wx = p0[0] + dx * (tt * 3.2) + Math.sin(tt * 7 + k) * 8;
      var wy = p0[1] + dy * (tt * 3.2) - tt * 34 - 8;
      ctx.globalAlpha = st.strength * 0.22 * (1 - tt);
      ctx.beginPath();
      ctx.arc(wx, wy, 2.4 + tt * 3.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawDust() {
    if (ENV.day < 0.55) return;
    var lit = M.clamp((ENV.day - 0.55) / 0.45, 0, 1);
    ctx.save();
    ctx.fillStyle = theme.line;
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var wx = d.x + Math.sin(scene.time * d.sp + d.ph) * 0.16;
      var wy = d.y + Math.cos(scene.time * d.sp * 0.7 + d.ph) * 0.12;
      var wz = d.z + Math.sin(scene.time * d.sp * 0.45 + d.ph * 1.7) * 0.14;
      var s = renderer.project([wx, wy, wz]);
      if (!s) continue;
      if (s[0] < -20 || s[0] > view.w + 20 || s[1] < -20 || s[1] > view.h + 20) continue;
      var a = 0.16 * lit * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(scene.time * 0.9 + d.ph)));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s[0], s[1], d.r * (view.dpr > 1 ? 1.2 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * Hover feedback: re-ink the object's own outline in the accent colour, with a
   * soft wider pass underneath. The width is derived from the object's projected
   * size and hard-capped, so a big nearby panel cannot smear into a bar across
   * the frame, and slivers shorter than a few pixels are left alone.
   */
  function drawHover() {
    var h = interact.hover;
    if (!h || h.hoverAmount < 0.02) return;
    var mesh = h.mesh;
    if (!mesh) return;
    var a = h.hoverAmount;
    var verts = mesh.verts;
    var W = view.w, H = view.h;

    // per-face projected paths, and the object's screen extent
    var paths = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < mesh.faces.length; i++) {
      var f = mesh.faces[i];
      if (f.hidden || !f.fill) continue;
      var vi = f.vi;
      if (vi.length < 3) continue;
      var pts = [];
      var ok = true;
      for (var k = 0; k < vi.length; k++) {
        var s = renderer.project(verts[vi[k]]);
        // a vertex behind the near plane, or absurdly close to it, makes the
        // projected polygon explode — skip that face
        if (!s || s[2] < 0.45) { ok = false; break; }
        pts.push(s);
      }
      if (!ok || pts.length < 3) continue;
      var fw = 0, fh = 0;
      for (var q = 0; q < pts.length; q++) {
        if (pts[q][0] < minX) minX = pts[q][0];
        if (pts[q][0] > maxX) maxX = pts[q][0];
        if (pts[q][1] < minY) minY = pts[q][1];
        if (pts[q][1] > maxY) maxY = pts[q][1];
        if (q > 0) {
          fw = Math.max(fw, Math.abs(pts[q][0] - pts[0][0]));
          fh = Math.max(fh, Math.abs(pts[q][1] - pts[0][1]));
        }
      }
      if (fw < 5 && fh < 5) continue;            // a sliver, not a readable edge
      paths.push(pts);
    }
    if (!paths.length) return;

    var span = Math.max(maxX - minX, maxY - minY);
    if (!isFinite(span) || span < 3) return;
    var base = M.clamp(span * 0.045, 1.5, 3.2);

    function trace() {
      ctx.beginPath();
      for (var p = 0; p < paths.length; p++) {
        var pts = paths[p];
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.closePath();
      }
    }

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.hover;
    // soft under-pass
    ctx.globalAlpha = 0.26 * a;
    ctx.lineWidth = base * 3.4;
    trace(); ctx.stroke();
    // crisp accent pass
    ctx.globalAlpha = 0.9 * a;
    ctx.lineWidth = base;
    trace(); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    // the room darkens at the edges when the lights are off: the same
    // information the palette carries, reinforced where the eye expects it
    var dim = M.clamp(1 - (ENV.day * 0.80 + (ENV.lightsOn ? 0.60 : 0) + (ENV.lampOn ? 0.15 : 0)), 0, 0.42);
    if (dim < 0.03) return;
    var g = ctx.createRadialGradient(
      view.w * 0.5, view.h * 0.52, Math.min(view.w, view.h) * 0.34,
      view.w * 0.5, view.h * 0.52, Math.max(view.w, view.h) * 0.86);
    g.addColorStop(0, 'rgba(22,26,44,0)');
    g.addColorStop(1, 'rgba(22,26,44,' + (dim * 0.55).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  /* ------------------------------------------------------------------- toasts */
  var toastEl = el.tip;
  var toastTimer = 0, toastTimeout = 0;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = 0;
    toastTimeout = 2.1;
  }

  /* --------------------------------------------------------------------- loop */
  var last = 0, frameTimes = [], fps = 60;
  var hoverInfo = { name: '', hint: '' };

  interact.onHoverChange = function (obj) {
    if (!obj || !interact.hover || interact.hover !== obj) return;
  };

  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    scene.time += dt;
    cam.t += dt;

    frameTimes.push(dt);
    if (frameTimes.length > 40) frameTimes.shift();
    var avg = 0;
    for (var i = 0; i < frameTimes.length; i++) avg += frameTimes[i];
    avg /= frameTimes.length || 1;
    fps = fps * 0.9 + (1 / (avg || 1 / 60)) * 0.1;

    syncClock();
    if (audio.tick) audio.tick(scene.time);
    if (themeDirty) refreshTheme();
    P.anim.tick(dt);

    // modules that own continuous motion
    for (var r = 0; r < interact.reg.length; r++) {
      var o = interact.reg[r];
      if (o.update) o.update(dt, interact.ctx(o));
    }

    // camera: settle, then drift on its own so the room is never a still image
    cam.idle += dt;
    if (interact.pointer.down) cam.idle = 0;
    if (cam.idle > IDLE_AFTER) {
      var dr = M.clamp((cam.idle - IDLE_AFTER) / 6, 0, 1);
      cam.tyaw += Math.sin(cam.t * 0.055) * 0.0016 * dr;
      cam.tpitch += Math.cos(cam.t * 0.043) * 0.0009 * dr;
      clampCamera();
    }
    cam.yaw = P.anim.approach(cam.yaw, cam.tyaw, 7, dt);
    cam.pitch = P.anim.approach(cam.pitch, cam.tpitch, 7, dt);
    cam.dist = P.anim.approach(cam.dist, cam.tdist, 6, dt);

    // the aim point breathes very slightly; the eye stays put, so the room
    // drifts within the frame instead of the camera swinging around
    var aim = aimPos();
    var eye = eyePos();
    if (!viewMode.noAvoid) eye = avoidSolids(eye);
    renderer.setCamera(eye, aim);

    // ---- draw
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = theme.mat.paper;
    ctx.fillRect(0, 0, view.w, view.h);

    // a soft pool of light on the paper behind everything: when the camera
    // orbits out past a wall, the section sits on a lit sheet rather than
    // floating in a flat field. Kept very gentle — the room's own near-whites
    // must stay near-white.
    var bg = ctx.createRadialGradient(
      view.w * 0.5, view.h * 0.44, Math.min(view.w, view.h) * 0.16,
      view.w * 0.5, view.h * 0.44, Math.max(view.w, view.h) * 0.92);
    bg.addColorStop(0, P.hexA(theme.mat.paper, 1));
    bg.addColorStop(0.6, P.hexA(P.geom.mix(theme.mat.paper, theme.line, 0.03), 0.55));
    bg.addColorStop(1, P.hexA(P.geom.mix(theme.mat.paper, theme.line, 0.085), 0.45));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, view.w, view.h);

    // the 3D room, drawn in *device* pixels; the transform is already in css
    if (viewMode.room) {
      if (viewMode.only || viewMode.tint) applyView();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      renderer.draw(theme, {
        paintBackground: false,
        // layers: -1 is the room shell, 0 everything inside it. The view
        // through the window is composited between the two, so the wall and
        // ceiling occlude it exactly while the window frame, sash bars, blinds
        // and curtain all still draw on top of it. There is no hole cut in the
        // wall and no depth buffer involved.
        betweenLayers: function (done, next) {
          if (done === -1 && next >= 0 && viewMode.sky) drawSky();
        }
      });
      ctx.restore();
    }
    if (!viewMode.room && viewMode.sky) {
      ctx.save();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      drawSky();
      ctx.restore();
    }

    // overlay layers live in css pixels again
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawGlows();
    drawSteam();
    drawDust();
    drawHover();
    drawVignette();

    interact.update(dt);
    updateHud();

    global.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------- hud */
  var hudTick = 0;
  function updateHud() {
    hudTick += 1;
    if (hudTick % 6 !== 0) return;
    var o = interact.hover;
    if (o && el.tipName) {
      el.tipName.textContent = o.label || '';
      el.tipHint.textContent = o.hint || '';
      var s = renderer.project(o.mesh ? centerOf(o.mesh) : [0, 0, 0]) || [interact.pointer.x, interact.pointer.y];
      var px = s[0] / (renderer.width / view.w);
      var py = s[1] / (renderer.height / view.h);
      el.tip.style.transform = 'translate(' + Math.round(M.clamp(px, 40, view.w - 40)) + 'px,' +
        Math.round(M.clamp(py, 30, view.h - 20)) + 'px)';
      el.tip.classList.add('on');
    } else if (el.tip) {
      el.tip.classList.remove('on');
    }
  }

  function centerOf(mesh) {
    var b = mesh.getBounds();
    return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  }

  /* ------------------------------------------------------------------ start-up */
  function boot() {
    var muted = false;
    resize();
    global.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', function once() {
      audio.init();
      canvas.removeEventListener('pointerdown', once);
    });
    global.addEventListener('keydown', function (e) {
      if (e.key === 'm' || e.key === 'M') {
        muted = !muted;
        audio.setMuted(muted);
        if (el.mute) el.mute.textContent = muted ? '声音：关 (M)' : '声音：开 (M)';
      }
      if (e.key === 'r' || e.key === 'R') {
        cam.tyaw = CAM_HOME.yaw; cam.tpitch = CAM_HOME.pitch; cam.tdist = CAM_HOME.dist;
        cam.orbit[0] = CAM_HOME.orbit[0]; cam.orbit[1] = CAM_HOME.orbit[1]; cam.orbit[2] = CAM_HOME.orbit[2];
        cam.look[0] = CAM_HOME.look[0]; cam.look[1] = CAM_HOME.look[1]; cam.look[2] = CAM_HOME.look[2];
        cam.target[0] = CAM_HOME.look[0]; cam.target[1] = CAM_HOME.look[1]; cam.target[2] = CAM_HOME.look[2];
        cam.idle = 0;
        toast('视角复位');
      }
      if (e.key === 'l' || e.key === 'L') setEnv({ lightsOn: !ENV.lightsOn });
      if (e.key === 'c' || e.key === 'C') {
        if (sctx.setFront) {
          sctx.setFront(!sctx.frontOpen);
          toast(sctx.frontOpen ? '近处的墙收起来了' : '把墙合上');
        }
      }
      if (e.key === 't' || e.key === 'T') { ENV.autoTime = !ENV.autoTime; toast(ENV.autoTime ? '时间跟随真实时钟' : '时间已锁定'); }
    });

    if (el.mute) {
      el.mute.addEventListener('click', function () {
        muted = !muted;
        audio.init();
        audio.setMuted(muted);
        el.mute.textContent = muted ? '声音：关 (M)' : '声音：开 (M)';
      });
    }

    // A small discovery aid: on first load the camera settles in from a step
    // back and to one side, so it is immediately clear that this is a room with
    // depth rather than a picture.
    cam.tyaw = 0.95; cam.tpitch = 0.16; cam.tdist = 3.9;
    P.anim.tween(cam, 'tyaw', CAM_HOME.yaw, 5.0, P.anim.ease.inOutSoft);
    P.anim.tween(cam, 'tpitch', CAM_HOME.pitch, 5.0, P.anim.ease.inOutSoft);
    P.anim.tween(cam, 'tdist', CAM_HOME.dist, 5.0, P.anim.ease.inOutSoft);

    setTimeout(function () { if (el.title) el.title.classList.add('fade'); }, 5200);
    setTimeout(function () { if (el.title) el.title.style.display = 'none'; }, 8200);
    if (el.loading) el.loading.classList.add('gone');

    scene.time = 0;
    global.requestAnimationFrame(function (t) { last = 0; frame(t); });
  }

  P.app = {
    scene: scene, renderer: renderer, interact: interact, sctx: sctx,
    cam: cam, env: ENV, setEnv: setEnv, toast: toast, audio: audio,
    recorder: null, theme: currentTheme, view: view, ctxRef: ctx,
    setView: setView, viewMode: viewMode, twilight: twilight,
    rawEye: function () { var v = eyePos(); return [v[0], v[1], v[2]]; },
    avoidSolids: avoidSolids,
    stats: function () { return { fps: fps, faces: renderer.stats.faces, ms: renderer.stats.ms, meshes: scene.meshes.length, interactives: interact.reg.length }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
