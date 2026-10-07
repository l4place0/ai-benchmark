/* =========================================================================
   Pure Line Room — scene.js
   Scene graph: nodes carry a local transform, children, a mesh (faces +
   edges) and optionally a behavior (a live, interactive, animated object).
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var M = PLR.math;
  var m4 = M.m4;

  var nextId = 1;

  /* --------------------------------- Node -------------------------------- */
  function Node(opts) {
    opts = opts || {};
    this.id = nextId++;
    this.name = opts.name || '';
    this.kind = opts.kind || 'node';
    this.tf = {
      p: opts.p ? opts.p.slice() : [0, 0, 0],
      yaw: opts.yaw || 0,
      pitch: opts.pitch || 0,
      roll: opts.roll || 0,
      s: opts.s ? opts.s.slice() : [1, 1, 1],
    };
    this.local = M.transformMatrix(this.tf);
    this.world = m4.identity();
    this.children = [];
    this.parent = null;
    this.cameraFed = !!opts.cameraFed;   // world matrix is written directly
    this.visible = opts.visible !== false;
    this.dims = opts.dims || null;       // bounding size along local axes
    this.layer = opts.layer || 0;        // manual draw-order biasing
    this.mesh = { verts: [], edges: [] };// vertices + edge list (local space)
    this.faces = [];                     // filled polygons
    this.behavior = null;
    this.solid = false;
    this.keyOverride = undefined;        // fixed draw-order key (room shell)
    /* cached per frame */
    this.wv = null;        // world-space vertices (Float64Array)
    this.cv = null;        // camera-space vertices
    this._dirty = true;
    this._worldValid = false;
    this._tfV = 0;
    this._tfVSeen = 0;
    this._front = null;
    this._back = null;
  }

  Node.prototype.add = function (child) {
    if (child.parent) child.parent.remove(child);
    child.parent = this;
    this.children.push(child);
    return child;
  };

  Node.prototype.remove = function (child) {
    var i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
    return this;
  };

  Node.prototype.removeAll = function () {
    for (var i = 0; i < this.children.length; i++) this.children[i].parent = null;
    this.children.length = 0;
  };

  Node.prototype.setTransform = function (o) {
    if (o.p) this.tf.p = o.p.slice();
    if (o.yaw !== undefined) this.tf.yaw = o.yaw;
    if (o.pitch !== undefined) this.tf.pitch = o.pitch;
    if (o.roll !== undefined) this.tf.roll = o.roll;
    if (o.s) this.tf.s = o.s.slice();
    this._tfV++;
    this.local = M.transformMatrix(this.tf);
    this._tfVSeen = this._tfV;
    this._dirty = true;
    this._worldValid = false;
    return this;
  };

  Node.prototype.translate = function (dx, dy, dz) {
    this.tf.p[0] += dx; this.tf.p[1] += dy; this.tf.p[2] += dz;
    this._tfV++;
    this.local = M.transformMatrix(this.tf);
    this._tfVSeen = this._tfV;
    this._dirty = true;
    this._worldValid = false;
    return this;
  };

  /* Rebuild the local matrix from tf. Behaviours may either call this or
     setTransform(); both end up here. */
  Node.prototype.markTf = function () {
    this.local = M.transformMatrix(this.tf);
    this._dirty = true;
    this._worldValid = false;
    return this;
  };

  Node.prototype.touch = function () {
    this._dirty = true;
    this._worldValid = false;
    return this;
  };

  /* Mark the whole subtree for a world-matrix rebuild. */
  Node.prototype.touchTree = function () {
    this.walk(function (n) { n._dirty = true; n._worldValid = false; });
    return this;
  };

  /* Recursive lookup by name (depth first, first match wins). */
  Node.prototype.get = function (name) {
    if (this.name === name) return this;
    for (var i = 0; i < this.children.length; i++) {
      var r = this.children[i].get(name);
      if (r) return r;
    }
    return null;
  };

  Node.prototype.root = function () {
    var n = this;
    while (n.parent) n = n.parent;
    return n;
  };

  Node.prototype.walk = function (fn) {
    fn(this);
    for (var i = 0; i < this.children.length; i++) this.children[i].walk(fn);
  };

  /* World-space AABB of the node's own mesh. Uses the renderer's cached world
     vertices when they are current, and otherwise transforms the local mesh on
     the spot, so it is safe to call at any point in the frame. */
  Node.prototype.worldBounds = function () {
    if (!this.mesh || !this.mesh.verts.length) return null;
    var lv = this.mesh.verts;
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    var useCache = this.wv && this.wv.length === lv.length && this._worldValid;
    var n = lv.length;
    for (var i = 0; i < n; i += 3) {
      var x, y, z;
      if (useCache) {
        x = this.wv[i]; y = this.wv[i + 1]; z = this.wv[i + 2];
      } else {
        var wm = this.world;
        x = lv[i]; y = lv[i + 1]; z = lv[i + 2];
        var wx = wm[0] * x + wm[4] * y + wm[8] * z + wm[12];
        var wy = wm[1] * x + wm[5] * y + wm[9] * z + wm[13];
        var wz = wm[2] * x + wm[6] * y + wm[10] * z + wm[14];
        x = wx; y = wy; z = wz;
      }
      if (x < lo[0]) lo[0] = x;
      if (y < lo[1]) lo[1] = y;
      if (z < lo[2]) lo[2] = z;
      if (x > hi[0]) hi[0] = x;
      if (y > hi[1]) hi[1] = y;
      if (z > hi[2]) hi[2] = z;
    }
    if (!isFinite(lo[0])) return null;
    return { lo: lo, hi: hi, c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] };
  };

  /* --------------------------------- Scene ------------------------------- */
  function Scene(opts) {
    opts = opts || {};
    this.root = new Node({ name: 'root', kind: 'root' });
    this.palette = opts.palette || {};
    this.solids = [];          // flat list of mesh-bearing nodes
    this.byName = {};
    this.time = 0;
    this.onClick = opts.onClick || function () {};
    this.onHover = opts.onHover || function () {};
    this.margin = (opts.margin === undefined ? 0.4 : opts.margin);
  }

  Scene.prototype.setPalette = function (p) {
    this.palette = p;
    return this;
  };

  Scene.prototype.registerSolid = function (node) {
    if (this.solids.indexOf(node) < 0) this.solids.push(node);
    return node;
  };

  Scene.prototype.unregisterSolid = function (node) {
    var i = this.solids.indexOf(node);
    if (i >= 0) this.solids.splice(i, 1);
  };

  /* Build a node, attach it, run the behavior's init (which authors geometry
     through Graphics) and register it as a drawable solid. */
  Scene.prototype.group = function (parent, opts) {
    var n = new Node(opts);
    (parent || this.root).add(n);
    if (opts && opts.keyOverride !== undefined) n.keyOverride = opts.keyOverride;
    var G = new PLR.graphics.Graphics(n);
    n._g = G;
    if (opts && opts.behavior) {
      n.behavior = opts.behavior;
      if (typeof opts.behavior.init === 'function') opts.behavior.init(n, G, this);
    }
    this.registerSolid(n);
    return n;
  };

  Scene.prototype.invalidate = function () {
    this.root.touchTree();
  };

  /* --------------------------- transform refresh ------------------------- */
  /* Behaviours are allowed to write node.tf directly (the documented way to
     animate); the local matrix is therefore rebuilt from tf whenever the
     transform version changes, and the world matrix is always recomputed
     because any ancestor may have moved. */
  function refresh(node, parentWorld, force, scene) {
    if (node._tfV !== node._tfVSeen) {
      node.local = M.transformMatrix(node.tf);
      node._tfVSeen = node._tfV;
      node._worldValid = false;
    }
    var dirty = force || node._dirty || !node._worldValid;
    if (dirty) {
      node.world = node.parent === null ? node.local : m4.mul(parentWorld, node.local);
      node._dirty = false;
    }
    var b = node.behavior;
    if (b && typeof b.markWorld === 'function') b.markWorld(node, scene);
    for (var i = 0; i < node.children.length; i++) {
      refresh(node.children[i], node.world, dirty, scene);
    }
  }

  /* -------------------------------- update ------------------------------- */
  Scene.prototype.update = function (dt, state) {
    if (!(dt > 0)) dt = 0;
    if (dt > 0.06) dt = 0.06;          // a hiccup must not teleport animation
    this.time += dt;
    var t = this.time;
    var list = this.solids;
    var i;
    // 1. behaviors advance their own animation
    for (i = 0; i < list.length; i++) {
      var b = list[i].behavior;
      if (b && typeof b.update === 'function') b.update(dt, t, list[i], state, this);
    }
    // 2. transforms propagate
    refresh(this.root, m4.identity(), true, this);
    // 3. dynamic geometry rebuilds (transforms are now correct)
    for (i = 0; i < list.length; i++) {
      var bb = list[i].behavior;
      if (bb && typeof bb.build === 'function' && bb.dynamic !== false) {
        var node = list[i];
        node.mesh.verts.length = 0;
        node.mesh.edges.length = 0;
        node.faces.length = 0;
        node._g.nv = 0;
        bb.build(node, node._g, state, this);
        node._worldValid = false;
        node._dirty = true;
      }
    }
  };

  Scene.prototype.countFaces = function () {
    var n = 0;
    for (var i = 0; i < this.solids.length; i++) n += this.solids[i].faces.length;
    return n;
  };

  PLR.scene = {
    Node: Node,
    Scene: Scene,
  };
})(typeof window !== 'undefined' ? window : globalThis);
