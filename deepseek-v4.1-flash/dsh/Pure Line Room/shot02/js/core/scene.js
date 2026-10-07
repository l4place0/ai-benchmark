// scene.js — scene graph, interaction registry and global state.
//
// Node      : a transform + geometry + children. The unit of animation.
// Part      : a Node that is pickable and carries event handlers.
// Object3D  : a top level entity (one "thing" in the room) owning a root Node.
// Scene     : owns the objects plus a shared static-geometry bucket.

import { Builder } from './builder.js';
import { m4, m4mul, m4trs, m4xformP } from './math3d.js';

/* ------------------------------------------------------------------- node */

export class Node {
  constructor(name) {
    this.name = name || 'node';
    this.isPart = false;
    this.parent = null;
    this.geo = [];
    this.children = [];
    this.builder = new Builder(this.geo);
    this.visible = true;
    this.pos = [0, 0, 0];
    this.rot = [0, 0, 0];
    this.scl = 1;
    this.matrix = m4();
    this._dirty = true;
  }

  setPos(x, y, z) { this.pos[0] = x; this.pos[1] = y; this.pos[2] = z; this._dirty = true; return this; }
  setRot(x, y, z) { this.rot[0] = x || 0; this.rot[1] = y || 0; this.rot[2] = z || 0; this._dirty = true; return this; }
  setScale(s, sy, sz) {
    if (Array.isArray(s)) this.scl = [s[0], s[1], s[2]];
    else if (sy !== undefined) this.scl = [s, sy, sz === undefined ? s : sz];
    else this.scl = s;
    this._dirty = true; return this;
  }

  sync() {
    if (this._dirty) {
      this.matrix = m4trs(this.pos, this.rot, this.scl);
      this._dirty = false;
    }
  }

  syncTree() {
    this.sync();
    for (let i = 0; i < this.children.length; i++) this.children[i].syncTree();
  }

  add(node) {
    node.parent = this;
    if (node._obj === undefined) node._obj = this._obj !== undefined ? this._obj : this.obj;
    this.children.push(node);
    return node;
  }

  node(name) { return this.add(new Node(name)); }

  part(id, opts) {
    const obj = this.isPart ? this.obj : this._obj;
    const p = new Part(obj, id, opts || {});
    this.add(p);
    obj._registerPart(p);
    return p;
  }

  /** World-space anchor of this node's origin. */
  worldOrigin() {
    const chain = [];
    let n = this;
    while (n) { chain.unshift(n); n = n.parent; }
    let m = m4();
    for (const c of chain) { c.sync(); m = m4mul(m, c.matrix); }
    return m4xformP(m, [0, 0, 0]);
  }
}

/* ------------------------------------------------------------------- part */

let PICK_ID = 1;

export class Part extends Node {
  constructor(obj, id, opts) {
    super(id);
    this.isPart = true;
    this.obj = obj;
    this.id = id;
    this.key = obj.id + '/' + id;
    this.label = opts.label || id;
    this.hint = opts.hint || '';
    this.cursor = opts.cursor || 'pointer';
    this.pickable = opts.pickable !== false;
    this.enabled = true;
    this.hoverT = 0;
    this.isHovered = false;
    this.anchor = [0, 0, 0];
    this.hasAnchor = false;
    this.handlers = { over: null, click: null, drag: null };
    this._id = PICK_ID++;
    this._idColor = `rgb(${this._id & 255},${(this._id >> 8) & 255},0)`;
  }

  onHover(fn) { this.handlers.over = fn; return this; }
  onClick(fn) { this.handlers.click = fn; return this; }
  onDrag(fn) { this.handlers.drag = fn; return this; }
  setCursor(c) { this.cursor = c; return this; }
  setAnchor(x, y, z) { this.anchor = [x, y, z]; this.hasAnchor = true; return this; }

  worldAnchor() {
    const chain = [];
    let n = this;
    while (n) { chain.unshift(n); n = n.parent; }
    let m = m4();
    for (const c of chain) { c.sync(); m = m4mul(m, c.matrix); }
    return m4xformP(m, this.anchor);
  }
}

/* ----------------------------------------------------------------- object */

export class Object3D {
  constructor(scene, opts) {
    this.scene = scene;
    this.id = opts.id;
    this.label = opts.label || opts.id;
    this.cursor = opts.cursor || 'pointer';
    this.root = new Node('root');
    this.root._obj = this;
    this.builder = this.root.builder;
    this.pos = [0, 0, 0];
    this.rot = [0, 0, 0];
    this.scale = 1;
    this.visible = true;
    this.depthBias = 0;
    this.parts = [];
    this.handlers = { update: null, over: null, click: null, drag: null };
    this.sfx = null;
    this.data = {};
  }

  setPos(x, y, z) { this.pos[0] = x; this.pos[1] = y; this.pos[2] = z; return this; }
  setRot(x, y, z) { this.rot[0] = x; this.rot[1] = y; this.rot[2] = z; return this; }
  setScale(s) { this.scale = s; return this; }
  setDepthBias(b) { this.depthBias = b; return this; }
  show(v) { this.visible = !!v; return this; }

  onUpdate(fn) { this.handlers.update = fn; return this; }
  onHover(fn) { this.handlers.over = fn; return this; }
  onClick(fn) { this.handlers.click = fn; return this; }
  onDrag(fn) { this.handlers.drag = fn; return this; }

  node(name) { return this.root.node(name); }
  part(id, opts) { return this.root.part(id, opts); }

  _registerPart(p) { this.parts.push(p); this.scene._registerPart(p); }
}

/* ------------------------------------------------------------------ scene */

export class Scene {
  constructor() {
    this.objects = [];
    this.byId = new Map();
    this.parts = [];
    this.lights = [];
    this._idMap = new Map();
    this.staticRoot = new Node('static');
    this.staticRoot._obj = {
      id: '__static', visible: true, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1,
      depthBias: 0, root: null,
    };
    this.staticObject = {
      id: '__static', visible: true, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1,
      depthBias: 0, root: this.staticRoot,
    };
    this.objects.push(this.staticObject);
  }

  /** A builder for geometry that is never interactive. */
  paper() { return new Builder(this.staticRoot.geo); }

  object(opts) {
    const o = new Object3D(this, opts);
    this.objects.push(o);
    this.byId.set(o.id, o);
    return o;
  }

  _registerPart(p) {
    this.parts.push(p);
    this._idMap.set(p._id, p);
  }

  get pickMap() { return this._idMap; }

  /** Screen-independent world anchor for a part, for the hint markers / tooltip. */
  partWorldAnchor(p) { return p.worldAnchor(); }

  light(x, y, z, radius, color, intensity) {
    this.lights.push({ pos: [x, y, z], radius, color, intensity });
  }

  sync() {
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      if (o.root) o.root.syncTree();
    }
  }

  update(dt, now, ctx) {
    this.lights.length = 0;
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      const fn = o.handlers && o.handlers.update;
      if (fn) fn(dt, now, ctx);
    }
  }

  /** Which part is under the given css point? null when nothing is hit. */
  pick(renderer, cam, theme, x, y) {
    renderer.buildPickBuffer(this, cam, theme);
    return renderer.pickAt(x, y);
  }
}

/* ------------------------------------------------------------------ state */

export class State {
  constructor(init) {
    this.data = Object.assign({}, init);
    this.listeners = new Map();
    // Expose every key as a real property so both `state.night` and
    // `state.get('night')` work — content modules legitimately use either style.
    for (const k of Object.keys(init)) {
      Object.defineProperty(this, k, {
        get() { return this.data[k]; },
        set(v) { this.set(k, v); },
        enumerable: true,
        configurable: true,
      });
    }
  }
  get(k) { return this.data[k]; }
  set(k, v) {
    if (this.data[k] === v) return;
    const old = this.data[k];
    this.data[k] = v;
    const arr = this.listeners.get(k);
    if (arr) for (const fn of arr) { try { fn(v, old); } catch (e) { /* keep going */ } }
  }
  toggle(k) { this.set(k, !this.data[k]); return this.data[k]; }
  on(k, fn) {
    if (!this.listeners.has(k)) this.listeners.set(k, []);
    this.listeners.get(k).push(fn);
    return () => {
      const arr = this.listeners.get(k);
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }
}

export default Scene;
