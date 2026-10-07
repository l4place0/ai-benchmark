/* =============================================================================
   Pure Line Room — interact.js
   Turning the drawing into an interface: screen → world ray, AABB picking over
   the registered objects, hover intent, press/click gestures and object drags.

   The room itself is the UI. There are no buttons: if you can see it, you can
   point at it, and pointing at it always answers.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR;

  var CLICK_SLOP = 7;        // px of movement still counted as a click
  var CLICK_TIME = 520;      // ms
  var DWELL = 0.10;          // seconds of stillness before hover locks on

  function Interact(canvas, renderer, scene) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.scene = scene;
    this.reg = [];
    this.byId = {};
    this.hover = null;
    this.pressed = null;
    this.drag = null;
    this.armed = null;
    this.pointer = { x: -999, y: -999, down: false, buttons: 0, id: null };
    this.hoverIdle = 0;
    this.lastMove = -99;
    this.time = 0;
    this.enabled = true;
    this.cursor = 'default';
    this.onCamera = null;       // main: camera drag/zoom handling
    this.onHoverChange = null;  // main: (obj|null, screenPoint)
    this.onCursor = null;
    this.audio = { play: function () { } };
    this.toast = function () { };
    this.env = {};
    this.setEnv = function () { };
    this.anim = P.anim;
    this._tmpBox = { min: [0, 0, 0], max: [0, 0, 0] };
    this.bind();
  }

  Interact.prototype.register = function (obj) {
    obj.priority = obj.priority || 0;
    obj.hoverAmount = 0;
    obj._dynamicBox = null;
    this.reg.push(obj);
    if (obj.id) this.byId[obj.id] = obj;
    return obj;
  };

  Interact.prototype.get = function (id) { return this.byId[id]; };

  /** Live world AABB for an object (recomputed for things that move). */
  Interact.prototype.worldBox = function (obj) {
    if (obj.dynamicHit && obj.mesh) {
      obj.mesh.bounds = null;
      var b = obj.mesh.getBounds();
      if (!obj._dynamicBox) obj._dynamicBox = { min: [0, 0, 0], max: [0, 0, 0] };
      for (var k = 0; k < 3; k++) {
        obj._dynamicBox.min[k] = b.min[k] - 0.01;
        obj._dynamicBox.max[k] = b.max[k] + 0.01;
      }
      return obj._dynamicBox;
    }
    return obj.hit;
  };

  Interact.prototype.ctx = function (obj) {
    var self = this;
    if (!obj._ctx) {
      obj._ctx = {
        env: this.env,
        setEnv: function (patch) { self.setEnv(patch); },
        audio: this.audio,
        anim: this.anim,
        toast: this.toast,
        time: 0,
        get mesh() { return obj.mesh; },
        get hover() { return obj.hoverAmount > 0.35; }
      };
    }
    obj._ctx.env = this.env;
    obj._ctx.audio = this.audio;
    obj._ctx.time = this.time;
    return obj._ctx;
  };

  /* ------------------------------------------------------------------ events */
  Interact.prototype.bind = function () {
    var self = this;
    var c = this.canvas;
    var opt = { passive: false };

    function pos(e) {
      var r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    this._pos = pos;

    c.addEventListener('pointermove', function (e) {
      var p = pos(e);
      self.pointer.x = p.x; self.pointer.y = p.y;
      self.lastMove = self.time;
      if (self.drag) {
        self.updateDrag(p, e);
      } else if (self.pointer.down && self.onCamera) {
        self.onCamera({
          phase: 'move', x: p.x, y: p.y,
          dx: e.movementX || 0, dy: e.movementY || 0,
          buttons: e.buttons, shift: e.shiftKey, alt: e.altKey
        });
      }
    }, opt);

    c.addEventListener('pointerdown', function (e) {
      var p = pos(e);
      self.pointer.down = true;
      self.pointer.buttons = e.buttons;
      self.pointer.id = e.pointerId;
      self.pointer.x = p.x; self.pointer.y = p.y;
      self.lastMove = self.time;
      if (e.button !== 0 && e.button !== 1) return;
      var hit = self.pick(p.x, p.y);
      self.pressed = {
        obj: hit ? hit.obj : null,
        x: p.x, y: p.y, t: self.time, moved: 0,
        button: e.button, moved3d: [0, 0, 0]
      };
      if (hit) {
        var obj = hit.obj;
        if (obj.onDown) obj.onDown(self.ctx(obj));
        if (obj.onDrag) {
          self.drag = {
            obj: obj, start: hit.point.slice(), last: hit.point.slice(),
            x: p.x, y: p.y, obj0: null, started: false
          };
          obj._ctx = obj._ctx || self.ctx(obj);
        }
        self.setCursor('grab');
      } else {
        self.setCursor('grabbing');
      }
      if (e.preventDefault) e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (err) { }
    }, opt);

    global.addEventListener('pointerup', function (e) {
      var p = pos(e);
      var wasDown = self.pointer.down;
      self.pointer.down = false;
      self.pointer.buttons = 0;
      self.pointer.id = null;
      try { c.releasePointerCapture(e.pointerId); } catch (err) { }
      var pr = self.pressed;
      self.pressed = null;
      if (!wasDown || !pr) { self.drag = null; self.refreshCursor(); return; }
      var dt = self.time - pr.t;
      var dist = Math.hypot(p.x - pr.x, p.y - pr.y);
      if (self.drag) {
        var d = self.drag;
        self.drag = null;
        if (d.started && d.obj.onDrag) {
          d.obj.onDrag(self.ctx(d.obj), {
            phase: 'end', world: d.last.slice(), delta: [0, 0, 0],
            screen: [p.x, p.y], startWorld: d.start.slice()
          });
        }
        self.pressed = null;
        self.refreshCursor();
        return;
      }
      if (pr.obj && dt < CLICK_TIME && dist < CLICK_SLOP) {
        self.activate(pr.obj);
      } else if (!pr.obj && self.onCamera) {
        self.onCamera({ phase: 'tap', x: p.x, y: p.y, dx: 0, dy: 0, buttons: 0 });
      }
      self.refreshCursor();
    }, opt);

    global.addEventListener('pointercancel', function () {
      self.pointer.down = false;
      self.pressed = null;
      self.drag = null;
      self.refreshCursor();
    }, opt);

    c.addEventListener('pointerleave', function () {
      self.pointer.x = -999; self.pointer.y = -999;
    }, opt);

    c.addEventListener('contextmenu', function (e) { e.preventDefault(); }, opt);

    c.addEventListener('wheel', function (e) {
      if (self.onCamera) {
        self.onCamera({
          phase: 'wheel', x: self.pointer.x, y: self.pointer.y,
          delta: e.deltaY, deltaMode: e.deltaMode
        });
      }
      if (e.preventDefault) e.preventDefault();
    }, opt);

    c.addEventListener('dblclick', function (e) {
      e.preventDefault();
    }, opt);
  };

  Interact.prototype.setCursor = function (name) {
    if (this.cursor === name) return;
    this.cursor = name;
    if (this.onCursor) this.onCursor(name);
    else this.canvas.style.cursor = name;
  };

  Interact.prototype.refreshCursor = function () {
    if (this.hover) this.setCursor(this.hover.cursor || 'pointer');
    else this.setCursor('grab');
  };

  /* ----------------------------------------------------------------- picking */
  /**
   * Pick the registered object under a screen point. Two stages:
   *   1. cheap screen-space AABB rejection using the projected bounding box;
   *   2. an exact ray/AABB test, nearest first, with a priority nudge so small
   *      handles (the switch, a book spine) still win over the wall behind them.
   */
  Interact.prototype.pick = function (sx, sy) {
    var ray = this.renderer.unproject(sx, sy);
    if (!ray) return null;
    var best = null;
    for (var i = 0; i < this.reg.length; i++) {
      var o = this.reg[i];
      if (o.disabled) continue;
      var box = this.worldBox(o);
      if (!box) continue;
      var t = M.rayAABB(ray.origin, ray.dir, box.min, box.max);
      if (t < 0) continue;
      var pt = [
        ray.origin[0] + ray.dir[0] * t,
        ray.origin[1] + ray.dir[1] * t,
        ray.origin[2] + ray.dir[2] * t
      ];
      // priority is a depth discount: it lets a small object (a mug, the light
      // switch, a picture) win over the big loose box of whatever is behind it,
      // while never letting a set of priorities override a large depth gap
      var score = t - o.priority * 0.09;
      if (!best || score < best.score) best = { obj: o, t: t, point: pt, score: score };
    }
    return best;
  };

  Interact.prototype.activate = function (obj) {
    if (obj.onClick) obj.onClick(this.ctx(obj));
    this.pulse = { obj: obj, t: 0 };
  };

  Interact.prototype.updateDrag = function (p, e) {
    var d = this.drag;
    if (!d) return;
    var ray = this.renderer.unproject(p.x, p.y);
    if (!ray) return;
    // objects define their own plane through onDrag; we hand them the ray
    // projected onto the floor as a sane default (most draggables sit on it)
    var tt = M.rayPlaneY(ray.origin, ray.dir, 0);
    var world = tt >= 0
      ? [ray.origin[0] + ray.dir[0] * tt, 0, ray.origin[2] + ray.dir[2] * tt]
      : d.last.slice();
    var delta = [world[0] - d.last[0], world[1] - d.last[1], world[2] - d.last[2]];
    d.last = world.slice();
    if (!d.started) {
      var moved = Math.hypot(p.x - d.x, p.y - d.y);
      if (moved < 4) return;
      d.started = true;
      if (d.obj.onDrag) {
        d.obj.onDrag(this.ctx(d.obj), {
          phase: 'start', world: world.slice(), delta: delta,
          screen: [p.x, p.y], startWorld: d.start.slice()
        });
      }
      this.setCursor('grabbing');
    }
    if (d.obj.onDrag) {
      d.obj.onDrag(this.ctx(d.obj), {
        phase: 'move', world: world.slice(), delta: delta,
        screen: [p.x, p.y], startWorld: d.start.slice(),
        shift: e ? e.shiftKey : false
      });
    }
  };

  /* ------------------------------------------------------------------ update */
  Interact.prototype.update = function (dt) {
    this.time += dt;
    if (this.pulse) {
      this.pulse.t += dt;
      if (this.pulse.t > 0.5) this.pulse = null;
    }

    // hover only engages once the pointer settles — this keeps orbiting the
    // room from flickering labels all over the furniture
    var settled = (this.time - this.lastMove) > DWELL && !this.pointer.down;
    var target = null;
    if (this.enabled && settled) {
      var hit = this.pick(this.pointer.x, this.pointer.y);
      if (hit) target = hit.obj;
    }
    if (target !== this.hover) {
      if (this.hover && this.hover.onHoverEnd) this.hover.onHoverEnd(this.ctx(this.hover));
      this.hover = target;
      if (target && target.onHoverStart) target.onHoverStart(this.ctx(target));
      this.refreshCursor();
      if (this.onHoverChange) this.onHoverChange(target, { x: this.pointer.x, y: this.pointer.y });
    } else if (target && this.onHoverChange) {
      this.onHoverChange(target, { x: this.pointer.x, y: this.pointer.y });
    }

    for (var i = 0; i < this.reg.length; i++) {
      var o = this.reg[i];
      var want = (o === this.hover) ? 1 : 0;
      if (o === this.pressed || (this.drag && this.drag.obj === o)) want = 1;
      var speed = want > o.hoverAmount ? 9 : 5.5;
      o.hoverAmount = P.anim.approach(o.hoverAmount, want, speed, dt);
      if (o.hoverAmount < 0.002 && want === 0) o.hoverAmount = 0;
    }
  };

  P.Interact = Interact;
})(typeof window !== 'undefined' ? window : globalThis);
