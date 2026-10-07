/* =========================================================================
   Pure Line Room — interact.js
   The interaction layer: every object that can be operated gets a proxy with
   a uniform, well behaved state machine (hover, press, toggle, drag, dispose)
   and a shared feedback vocabulary (highlight, pulse, status text, sound).
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;
  var ease = M.ease;

  var Act = {
    list: [],
    hover: null,
    focus: null,
    drag: null,
    locked: false,
  };

  var api;   // the controller-facing API, filled in by init()

  /* ------------------------------ feedback ------------------------------- */
  function highlight(r, pr) {
    var node = pr.node;
    if (window.PLR_DEBUG_HOVER === false) return;
    var t = Math.max(pr.hoverT, pr.focusT);
    if (t < 0.02) return;
    var b = node.worldBounds();
    if (!b) return;
    var lo = b.lo, hi = b.hi;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var any = false;
    for (var i = 0; i < 8; i++) {
      var p = [
        (i & 1) ? hi[0] : lo[0],
        (i & 2) ? hi[1] : lo[1],
        (i & 4) ? hi[2] : lo[2],
      ];
      var s = r.projectPoint(p, r._tmp2 || (r._tmp2 = [0, 0, 0]));
      if (s[2] <= r.near) { continue; }
      any = true;
      if (s[0] < minX) minX = s[0];
      if (s[0] > maxX) maxX = s[0];
      if (s[1] < minY) minY = s[1];
      if (s[1] > maxY) maxY = s[1];
    }
    if (!any) return;
    var pad = 7 + (1 - t) * 6;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var w = maxX - minX, h = maxY - minY;
    if (w < 4 || h < 4 || w > r.w * 1.6 || h > r.h * 1.6) return;
    var night = r.palette.__time || 0;
    var col = night > 0.5 ? '236,240,250' : '28,30,38';
    r.overlays.push(function (ctx) {
      ctx.save();
      ctx.globalAlpha = 0.30 * t;
      ctx.strokeStyle = 'rgba(' + col + ',1)';
      ctx.lineWidth = 1.35;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -Act.time * 26;
      roundRect(ctx, minX, minY, w, h, Math.min(14, Math.min(w, h) * 0.22));
      ctx.stroke();
      ctx.setLineDash([]);
      if (pr.state && pr.state.label && t > 0.35) {
        var label = pr.state.label + (pr.state.status ? '  ·  ' + pr.state.status : '');
        ctx.font = '600 ' + Math.round(12 * r._fontScale) + 'px "Segoe UI", system-ui, sans-serif';
        var tw = ctx.measureText(label).width;
        var bx = minX + w / 2, by = minY - 16;
        if (by < 12) by = maxY + 16;
        ctx.globalAlpha = 0.85 * t;
        ctx.fillStyle = 'rgba(' + col + ',0.10)';
        roundRect(ctx, bx - tw / 2 - 7, by - 9, tw + 14, 18, 9);
        ctx.fill();
        ctx.globalAlpha = 0.95 * t;
        ctx.fillStyle = 'rgba(' + col + ',1)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx, by + 0.5);
      }
      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ------------------------------- the proxy ----------------------------- */
  /*
    options: {
      label, id,
      hit       : tag used to mark hit faces ('main' by default)
      hover     : (pr) => {}          called while hovered (once per frame)
      enter/leave: (pr) => {}
      press     : (pr, down) => {}
      onClick   : (pr, ev) => {}
      onDrag    : (pr, dx, dy, dt, ev) => {}
      hintDims  : [w,h,d]             used for the hover outline
    }
  */
  function make(scene, node, opts) {
    opts = opts || {};
    var pr = {
      scene: scene,
      node: node,
      opts: opts,
      id: opts.id || node.name || ('act' + (Act.list.length + 1)),
      label: opts.label || node.name || 'Object',
      hoverT: 0,
      pressT: 0,
      focusT: 0,
      pressed: false,
      hovered: false,
      dragging: false,
      clicks: 0,
      state: opts.state || { label: opts.label || node.name, status: '' },
      _disposed: false,
    };
    node.action = pr;
    node.hitTag = opts.hit || 'main';

    pr.hover = function (on) {
      if (on) {
        if (Act.hover === pr) return;
        if (Act.hover && Act.hover.hoverOut) Act.hover.hoverOut();
        Act.hover = pr;
        pr.hovered = true;
        if (opts.enter) opts.enter(pr);
      } else if (Act.hover === pr) {
        Act.hover = null;
        pr.hovered = false;
        if (opts.leave) opts.leave(pr);
      }
    };
    pr.hoverOut = function () { pr.hover(false); };

    pr.click = function (ev) {
      pr.clicks++;
      pr.pressT = 1;
      if (opts.onClick) opts.onClick(pr, ev || {});
    };

    pr.dispose = function () {
      var i = Act.list.indexOf(pr);
      if (i >= 0) Act.list.splice(i, 1);
      if (Act.hover === pr) Act.hover = null;
      if (Act.focus === pr) Act.focus = null;
      pr._disposed = true;
    };

    pr.setStatus = function (text) {
      pr.state.status = text;
    };

    pr.setLabel = function (text) {
      pr.state.label = text;
    };

    /* Objects call this from post() to make their faces pickable. */
    pr.hitRegion = function (renderer, tag) {
      highlight(renderer, pr);
      renderer.hitRegion(node, tag === undefined ? node.hitTag : tag);
    };

    Act.list.push(pr);
    return pr;
  }

  /* --------------------------------- tick -------------------------------- */
  Act.time = 0;

  Act.step = function (dt) {
    Act.time += dt;
    var i, pr;
    for (i = 0; i < Act.list.length; i++) {
      pr = Act.list[i];
      var ht = pr.hovered || Act.focus === pr ? 1 : 0;
      pr.hoverT = ease.damp(pr.hoverT, ht, 12, dt);
      pr.pressT = ease.damp(pr.pressT, 0, 7.5, dt);
      if (pr.opts.update) pr.opts.update(pr, dt, Act.time);
    }
  };

  Act.byId = function (id) {
    for (var i = 0; i < Act.list.length; i++) if (Act.list[i].id === id) return Act.list[i];
    return null;
  };

  /* Objects to try, nearest first, for keyboard focus stepping. */
  Act.cycleFocus = function (dir) {
    var live = Act.list.filter(function (p) { return !p._disposed && p.node.visible; });
    if (!live.length) return;
    var idx = live.indexOf(Act.focus);
    idx = (idx + (dir || 1) + live.length) % live.length;
    if (Act.focus) Act.focus.focusT = 0;
    Act.focus = live[idx];
    if (Act.focus && Act.focus.opts.enter) Act.focus.opts.enter(Act.focus);
  };

  PLR.interact = { Act: Act, make: make, roundRect: roundRect };
})(typeof window !== 'undefined' ? window : globalThis);
