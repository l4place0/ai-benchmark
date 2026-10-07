/* =============================================================================
   Pure Line Room — outdoor.js
   What you see through the window: a drawn world, not a photograph.

   The pane is a real opening in the east wall, so this is composited as a
   screen-space layer clipped to the projected opening and then the 3D room is
   drawn on top of it — the frame, the sash bars, the blinds, the curtain and
   the desk all occlude it correctly and for free.

   Everything is line art: a graded wash for the air, contour-outlined clouds, a
   horizon with hills and a far skyline, stars pinned to fixed positions, a sun
   or moon that rides an arc set by the actual hour. The colours are chosen to
   sit clearly apart from the room's near-white palette, so the window reads as
   depth rather than as a lit wall.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;

  var CLOUDS = [
    { u: 0.06, v: 0.20, s: 1.25, seed: 3 },
    { u: 0.44, v: 0.40, s: 0.82, seed: 11 },
    { u: 0.74, v: 0.15, s: 1.05, seed: 27 },
    { u: 0.28, v: 0.55, s: 0.66, seed: 41 },
    { u: 0.92, v: 0.46, s: 0.78, seed: 58 }
  ];

  var STARS = (function () {
    var out = [];
    for (var i = 0; i < 38; i++) {
      out.push({
        u: P.geom.rnd(i * 3.7 + 1.1),
        v: 0.04 + P.geom.rnd(i * 7.3 + 2.9) * 0.56,
        r: 0.55 + P.geom.rnd(i * 11.9 + 5.3) * 1.15,
        ph: P.geom.rnd(i * 13.1) * 6.283,
        sp: 0.35 + P.geom.rnd(i * 17.3) * 1.05
      });
    }
    return out;
  })();

  var BUILDINGS = (function () {
    var out = [], x = -0.02;
    for (var i = 0; i < 16 && x < 1.02; i++) {
      var w = P.geom.rndRange(i * 5.1 + 0.7, 0.040, 0.105);
      out.push({
        x: x, w: w,
        h: P.geom.rndRange(i * 9.7 + 3.3, 0.055, 0.165),
        seed: i
      });
      x += w * P.geom.rndRange(i * 2.3 + 4.1, 0.94, 1.34);
    }
    return out;
  })();

  /** Sky wash + ink, keyed to the daylight amount (0 night … 1 noon). */
  function skyRamp(day) {
    var stops = [
      { t: 0.00, top: '#0d1226', bot: '#1e2742', haze: '#2f3752', ink: '#c3cbe2', ground: '#1a2138' },
      { t: 0.14, top: '#141c40', bot: '#2b3862', haze: '#4e5378', ink: '#c8d0e6', ground: '#1f2740' },
      { t: 0.30, top: '#2a3663', bot: '#7d6480', haze: '#c4936d', ink: '#3a3f56', ground: '#3a3a4e' },
      { t: 0.46, top: '#4a6c9e', bot: '#cfa578', haze: '#e8c08a', ink: '#2c3346', ground: '#6d6a72' },
      { t: 0.68, top: '#6d9fd2', bot: '#bcd4e4', haze: '#e8e6da', ink: '#2a3140', ground: '#b9c6ce' },
      { t: 1.00, top: '#8fc4ea', bot: '#dceefb', haze: '#ffffff', ink: '#232a38', ground: '#c2cfd6' }
    ];
    var i = 0;
    for (; i < stops.length - 1; i++) if (day <= stops[i + 1].t) break;
    var a = stops[Math.min(i, stops.length - 1)];
    var b = stops[Math.min(i + 1, stops.length - 1)];
    var f = M.smoothstep(M.clamp((day - a.t) / ((b.t - a.t) || 1), 0, 1));
    return {
      top: P.geom.mix(a.top, b.top, f),
      bot: P.geom.mix(a.bot, b.bot, f),
      haze: P.geom.mix(a.haze, b.haze, f),
      ink: P.geom.mix(a.ink, b.ink, f),
      ground: P.geom.mix(a.ground, b.ground, f)
    };
  }

  function draw(ctx, box, env, t, opts) {
    if (!box || box.w < 2 || box.h < 2) return;
    var day = M.clamp(env.day === undefined ? 1 : env.day, 0, 1);
    var R = skyRamp(day);
    var ink = R.ink;
    var hour = env.hour === undefined ? 12 : env.hour;
    var x = box.x, y = box.y, W = box.w, H = box.h;
    var u = Math.min(W, H);            // scale unit for everything drawn here

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, W, H);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Base fill of the pane's own rectangle. This matters: every other layer
    // here is drawn with generous overshoot (gradients, halos, the skyline),
    // and the caller clips the whole thing to the projected window opening —
    // so the pane has to be laid down as a solid quad first, or the overshoot
    // has nothing opaque to sit on.
    ctx.fillStyle = R.bot;
    ctx.fillRect(x, y, W, H);

    // ---------------------------------------------------------------- air
    var g = ctx.createLinearGradient(0, y, 0, y + H);
    g.addColorStop(0, R.top);
    g.addColorStop(0.55, P.geom.mix(R.top, R.bot, 0.62));
    g.addColorStop(1, R.bot);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, W, H);

    var horizon = y + H * 0.70;

    // ------------------------------------------------------------- stars
    if (day < 0.52) {
      var sa = M.clamp((0.52 - day) / 0.34, 0, 1);
      ctx.fillStyle = '#f2f5ff';
      for (var si = 0; si < STARS.length; si++) {
        var s = STARS[si];
        var sy = y + s.v * H;
        if (sy > horizon - 2) continue;
        var tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
        ctx.globalAlpha = sa * (0.30 + 0.70 * tw);
        ctx.beginPath();
        ctx.arc(x + s.u * W, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.35) {
          ctx.strokeStyle = 'rgba(242,245,255,0.55)';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x + s.u * W - s.r * 2.4, sy); ctx.lineTo(x + s.u * W + s.r * 2.4, sy);
          ctx.moveTo(x + s.u * W, sy - s.r * 2.4); ctx.lineTo(x + s.u * W, sy + s.r * 2.4);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------- sun / moon
    var dayPhase = M.clamp((hour - 5.6) / 12.8, -0.2, 1.2);
    var nightPhase = M.clamp((((hour + 24) % 24) - 17.4) / 13.2, -0.2, 1.2);

    // The two bodies are mutually exclusive: near the equinox dusk the sun has
    // to be gone before the moon arrives, or the window shows both at once.
    var sunSkip = day < 0.30;
    var moonSkip = day > 0.52;

    if (!sunSkip && day > 0.14) {
      var sunA = M.clamp((day - 0.14) / 0.26, 0, 1);
      var scx = x + W * (0.14 + 0.72 * dayPhase);
      var scy = y + H * (0.60 - 0.46 * Math.sin(M.clamp(dayPhase, 0, 1) * Math.PI));
      var sr = u * 0.10;
      var low = 1 - M.clamp(Math.abs(dayPhase - 0.5) * 2, 0, 1);
      var sunInk = P.geom.mix('#f0b64e', '#e08a35', low * 0.7);
      ctx.globalAlpha = sunA;
      var halo = ctx.createRadialGradient(scx, scy, sr * 0.5, scx, scy, sr * 5.4);
      halo.addColorStop(0, 'rgba(255,238,190,0.55)');
      halo.addColorStop(0.5, 'rgba(255,232,175,0.18)');
      halo.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(scx, scy, sr * 5.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.geom.mix('#fff8e4', sunInk, 0.45);
      ctx.strokeStyle = sunInk;
      ctx.lineWidth = Math.max(1, u * 0.006);
      ctx.beginPath(); ctx.arc(scx, scy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = sunInk;
      ctx.lineWidth = Math.max(0.8, u * 0.004);
      for (var ri = 0; ri < 12; ri++) {
        var ang = (ri / 12) * Math.PI * 2 + t * 0.02;
        var r0 = sr * 1.30, r1 = sr * (ri % 3 === 0 ? 1.85 : 1.55);
        ctx.beginPath();
        ctx.moveTo(scx + Math.cos(ang) * r0, scy + Math.sin(ang) * r0);
        ctx.lineTo(scx + Math.cos(ang) * r1, scy + Math.sin(ang) * r1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (!moonSkip && day < 0.56) {
      var moonA = M.clamp((0.56 - day) / 0.30, 0, 1);
      var mcx = x + W * (0.14 + 0.72 * nightPhase);
      var mcy = y + H * (0.56 - 0.40 * Math.sin(M.clamp(nightPhase, 0, 1) * Math.PI));
      var mr = u * 0.075;
      ctx.globalAlpha = moonA;
      var mh = ctx.createRadialGradient(mcx, mcy, mr * 0.4, mcx, mcy, mr * 4.6);
      mh.addColorStop(0, 'rgba(206,220,255,0.34)');
      mh.addColorStop(1, 'rgba(206,220,255,0)');
      ctx.fillStyle = mh;
      ctx.beginPath(); ctx.arc(mcx, mcy, mr * 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eef2ff';
      ctx.strokeStyle = '#b9c4e2';
      ctx.lineWidth = Math.max(0.9, u * 0.005);
      ctx.beginPath(); ctx.arc(mcx, mcy, mr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = R.top;
      ctx.beginPath();
      ctx.arc(mcx - mr * 0.40, mcy - mr * 0.14, mr * 0.94, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(185,196,226,0.7)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(mcx - mr * 0.40, mcy - mr * 0.14, mr * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(178,190,222,0.85)';
      for (var ci = 0; ci < 4; ci++) {
        var ca = -0.8 + ci * 0.62;
        ctx.beginPath();
        ctx.arc(mcx + Math.cos(ca) * mr * 0.44, mcy + Math.sin(ca) * mr * 0.44, mr * (0.10 + 0.05 * (ci % 2)), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------- clouds
    var cloudA = 0.34 + 0.60 * M.clamp((day - 0.10) / 0.48, 0, 1);
    var cloudInk = day > 0.45 ? 'rgba(96,118,150,0.95)' : 'rgba(176,190,224,0.60)';
    var cloudFill = day > 0.45 ? 'rgba(255,255,255,0.80)' : 'rgba(120,134,176,0.20)';
    for (var k = 0; k < CLOUDS.length; k++) {
      var cl = CLOUDS[k];
      var drift = ((t * (0.0045 + 0.0035 * cl.s) + cl.u) % 1.30) - 0.15;
      var px = x + W * drift;
      var py = y + H * cl.v;
      var cs = u * 0.10 * cl.s;
      if (py > horizon - cs) continue;
      ctx.globalAlpha = cloudA;
      ctx.strokeStyle = cloudInk;
      ctx.fillStyle = cloudFill;
      ctx.lineWidth = Math.max(0.9, u * 0.005);
      ctx.beginPath();
      var puffs = 5;
      for (var p2 = 0; p2 < puffs; p2++) {
        var fx = px + (p2 / (puffs - 1) - 0.5) * cs * 3.4;
        var fy = py + Math.sin(p2 * 1.7 + cl.seed) * cs * 0.14;
        var fr = cs * (0.55 + 0.45 * Math.sin(p2 * 2.3 + cl.seed * 1.7));
        ctx.moveTo(fx + fr, fy);
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // interior contour lines: this is what makes it read as drawn
      ctx.globalAlpha = cloudA * 0.55;
      ctx.lineWidth = Math.max(0.6, u * 0.0034);
      ctx.beginPath();
      for (var p3 = 0; p3 < puffs - 1; p3++) {
        var gx = px + (p3 / (puffs - 1) - 0.5) * cs * 3.4 + cs * 0.5;
        var gy = py + Math.sin(p3 * 1.7 + cl.seed) * cs * 0.14 + cs * 0.26;
        ctx.moveTo(gx - cs * 0.42, gy);
        ctx.quadraticCurveTo(gx, gy + cs * 0.14, gx + cs * 0.42, gy - cs * 0.02);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------ horizon
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, u * 0.006);
    ctx.beginPath(); ctx.moveTo(x, horizon); ctx.lineTo(x + W, horizon); ctx.stroke();

    // distant hills, drawn as an outlined silhouette with a couple of contours
    ctx.fillStyle = R.ground;
    ctx.beginPath();
    ctx.moveTo(x, horizon + H * 0.012);
    ctx.quadraticCurveTo(x + W * 0.16, horizon - H * 0.070, x + W * 0.38, horizon + H * 0.008);
    ctx.quadraticCurveTo(x + W * 0.60, horizon + H * 0.066, x + W * 0.84, horizon - H * 0.030);
    ctx.quadraticCurveTo(x + W * 0.94, horizon - H * 0.052, x + W, horizon - H * 0.016);
    ctx.lineTo(x + W, y + H);
    ctx.lineTo(x, y + H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(0.6, u * 0.0032);
    ctx.beginPath();
    ctx.moveTo(x + W * 0.05, horizon + H * 0.050);
    ctx.quadraticCurveTo(x + W * 0.28, horizon + H * 0.004, x + W * 0.50, horizon + H * 0.046);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // far skyline sitting exactly on the horizon
    var bScale = u;
    for (var bi = 0; bi < BUILDINGS.length; bi++) {
      var b = BUILDINGS[bi];
      var bx = x + b.x * W, bw = b.w * W, bh = b.h * bScale;
      var baseY = horizon + H * 0.010;
      ctx.fillStyle = R.ground;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.7, u * 0.0036);
      ctx.beginPath();
      ctx.rect(bx, baseY - bh, bw, bh);
      ctx.fill(); ctx.stroke();
      var cols = Math.max(1, Math.round(bw / (bScale * 0.026)));
      var rws = Math.max(1, Math.round(bh / (bScale * 0.032)));
      for (var wc = 0; wc < cols; wc++) {
        for (var wr = 0; wr < rws; wr++) {
          var wx2 = bx + (wc + 0.28) * (bw / cols);
          var wy2 = baseY - bh + (wr + 0.30) * (bh / rws);
          var ww = (bw / cols) * 0.44, wh2 = (bh / rws) * 0.38;
          var lit = P.geom.rnd(b.seed * 13.7 + wc * 3.1 + wr * 7.7) > 0.60;
          if (day < 0.45) {
            if (lit) {
              ctx.fillStyle = 'rgba(255,214,140,0.95)';
              ctx.fillRect(wx2, wy2, ww, wh2);
            }
          } else {
            ctx.strokeStyle = 'rgba(120,138,158,0.55)';
            ctx.lineWidth = Math.max(0.5, u * 0.0022);
            ctx.strokeRect(wx2, wy2, ww, wh2);
          }
        }
      }
    }

    // --------------------------------------------------------------- birds
    if (day > 0.5) {
      var bt = (t % 24) / 24;
      if (bt < 0.30) {
        ctx.globalAlpha = M.clamp(Math.sin(bt / 0.30 * Math.PI) * 1.8, 0, 1) * M.clamp((day - 0.5) * 3, 0, 1);
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(0.8, u * 0.004);
        var flockX = x + W * (0.05 + bt * 3.2);
        var flockY = y + H * 0.24 + Math.sin(bt * 8) * H * 0.03;
        for (var fb = 0; fb < 3; fb++) {
          var bxx = flockX - fb * u * 0.05;
          var byy = flockY + Math.sin(bt * 6.5 + fb) * H * 0.014 + fb * u * 0.013;
          var bsz = u * 0.019;
          var flap = 0.5 + 0.5 * Math.sin(t * 7 + fb * 1.3);
          ctx.beginPath();
          ctx.moveTo(bxx - bsz, byy);
          ctx.quadraticCurveTo(bxx - bsz * 0.45, byy - bsz * (0.40 + flap * 0.72), bxx, byy - bsz * 0.10);
          ctx.quadraticCurveTo(bxx + bsz * 0.45, byy - bsz * (0.40 + flap * 0.72), bxx + bsz, byy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---------------------------------------------------------------- glass
    // two oblique highlights + a faint reflected band: the pane has to read as
    // glass in front of the view, not as an opening in the wall
    var gl = ctx.createLinearGradient(x, y + H, x + W * 0.8, y);
    gl.addColorStop(0, 'rgba(255,255,255,0.26)');
    gl.addColorStop(0.42, 'rgba(255,255,255,0.03)');
    gl.addColorStop(1, 'rgba(255,255,255,0.16)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, u * 0.008);
    ctx.beginPath();
    ctx.moveTo(x + W * 0.05, y + H * 0.98);
    ctx.lineTo(x + W * 0.40, y + H * 0.03);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(0.6, u * 0.004);
    ctx.beginPath();
    ctx.moveTo(x + W * 0.17, y + H * 0.99);
    ctx.lineTo(x + W * 0.48, y + H * 0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  P.outdoor = { draw: draw, skyRamp: skyRamp, CLOUDS: CLOUDS };
})(typeof window !== 'undefined' ? window : globalThis);
