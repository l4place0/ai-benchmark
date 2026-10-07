// builder.js — the geometry authoring API used by every content module.
//
// A Builder accumulates drawing primitives in a local coordinate space while a
// 4x4 transform stack is active. Every primitive is stored as a flat record:
//   { kind: 0 (polygon) | 1 (polyline), pts: Float64Array-ish array of [x,y,z],
//     style, mat: 16-float matrix local->node, owner: partId|null }
//
// Nothing here knows about the camera; the renderer transforms and sorts.

import {
  m4, m4mul, m4translation, m4scale, m4rotX, m4rotY, m4rotZ, m4euler, m4copy,
} from './math3d.js';

/* --------------------------------------------------------------- font hook */
// main.js injects the stroke-font module once it has loaded. If it is missing
// we fall back to a tiny built-in digit set so the app can never hard-fail.

let FONT_MOD = null;
export function setFontModule(m) { FONT_MOD = m; }

const FALLBACK_SEG = {
  // 7-segment style, coordinates in a 1.0 cap-height em box, baseline y=0.
  '0': [[[0.08, 0.12], [0.08, 0.88]], [[0.08, 0.88], [0.42, 0.88]], [[0.42, 0.88], [0.42, 0.12]],
    [[0.42, 0.12], [0.08, 0.12]], [[0.08, 0.5], [0.42, 0.5]]],
  '1': [[[0.16, 0.74], [0.26, 0.88]], [[0.26, 0.88], [0.26, 0.12]], [[0.14, 0.12], [0.4, 0.12]]],
  '2': [[[0.08, 0.72], [0.14, 0.86]], [[0.14, 0.86], [0.4, 0.86]], [[0.4, 0.86], [0.42, 0.6]],
    [[0.42, 0.6], [0.08, 0.14]], [[0.08, 0.14], [0.42, 0.14]]],
  '3': [[[0.08, 0.86], [0.42, 0.86]], [[0.42, 0.86], [0.24, 0.56]], [[0.24, 0.56], [0.42, 0.44]],
    [[0.42, 0.44], [0.4, 0.14]], [[0.4, 0.14], [0.08, 0.14]], [[0.24, 0.56], [0.1, 0.56]]],
  '4': [[[0.34, 0.12], [0.34, 0.88]], [[0.34, 0.88], [0.08, 0.36]], [[0.08, 0.36], [0.44, 0.36]]],
  '5': [[[0.42, 0.86], [0.1, 0.86]], [[0.1, 0.86], [0.08, 0.54]], [[0.08, 0.54], [0.3, 0.58]],
    [[0.3, 0.58], [0.4, 0.44]], [[0.4, 0.44], [0.36, 0.16]], [[0.36, 0.16], [0.1, 0.14]]],
  '6': [[[0.4, 0.8], [0.2, 0.86]], [[0.2, 0.86], [0.1, 0.62]], [[0.1, 0.62], [0.08, 0.24]],
    [[0.08, 0.24], [0.24, 0.1]], [[0.24, 0.1], [0.4, 0.22]], [[0.4, 0.22], [0.38, 0.46]],
    [[0.38, 0.46], [0.18, 0.54]], [[0.18, 0.54], [0.1, 0.44]]],
  '7': [[[0.08, 0.86], [0.42, 0.86]], [[0.42, 0.86], [0.2, 0.12]]],
  '8': [[[0.12, 0.5], [0.09, 0.76]], [[0.09, 0.76], [0.25, 0.88]], [[0.25, 0.88], [0.4, 0.76]],
    [[0.4, 0.76], [0.37, 0.5]], [[0.37, 0.5], [0.12, 0.5]], [[0.12, 0.5], [0.09, 0.24]],
    [[0.09, 0.24], [0.25, 0.12]], [[0.25, 0.12], [0.4, 0.24]], [[0.4, 0.24], [0.37, 0.5]]],
  '9': [[[0.4, 0.5], [0.16, 0.46]], [[0.16, 0.46], [0.11, 0.3]], [[0.11, 0.3], [0.25, 0.12]],
    [[0.25, 0.12], [0.4, 0.24]], [[0.4, 0.24], [0.4, 0.76]], [[0.4, 0.76], [0.26, 0.88]],
    [[0.26, 0.88], [0.1, 0.8]]],
  ':': [[[0.2, 0.3], [0.2, 0.34]], [[0.2, 0.66], [0.2, 0.7]]],
  '.': [[[0.18, 0.1], [0.22, 0.1]]],
  ' ': [],
};

/* ---------------------------------------------------------------- builder */

export class Builder {
  constructor(target) {
    /** @type {Array} geometry records, owned by the target node */
    this.geo = target;
    this.stack = [m4()];
    this.depth = 0;
  }

  get top() { return this.stack[this.stack.length - 1]; }

  push() { this.stack.push(m4copy(this.top)); this.depth++; return this; }
  pop() { if (this.stack.length > 1) { this.stack.pop(); this.depth--; } return this; }
  mat(m) { this.stack[this.stack.length - 1] = m4mul(this.top, m); return this; }

  translate(x, y, z = 0) { return this.mat(m4translation(x, y, z)); }
  rotateX(a) { return this.mat(m4rotX(a)); }
  rotateY(a) { return this.mat(m4rotY(a)); }
  rotateZ(a) { return this.mat(m4rotZ(a)); }
  euler(rx, ry, rz) { return this.mat(m4euler(rx, ry, rz)); }
  scale(x, y, z) {
    if (y === undefined) return this.mat(m4scale(x, x, x));
    return this.mat(m4scale(x, y, z));
  }

  /** Run fn inside a temporary transform. */
  at(x, y, z, fn) { this.push(); this.translate(x, y, z); fn(this); this.pop(); return this; }

  /* ------------------------------------------------------------ emitters */

  _emit(kind, pts, style) {
    if (!pts || pts.length < 2) return;
    this.geo.push({ kind, pts, style: style || {}, mat: m4copy(this.top), owner: null });
  }

  /** Open polyline: strokes only, no fill, no closure. */
  polyline(pts, style, closed = false) {
    const p = closed ? pts.concat([pts[0]]) : pts;
    this._emit(1, p, style);
    return this;
  }
  line(a, b, style) { this._emit(1, [a, b], style); return this; }

  /** Closed polygon: filled + stroked. Winding decides the normal. */
  poly(pts, style) { this._emit(0, pts, style); return this; }

  tri(a, b, c, style) { this._emit(0, [a, b, c], style); return this; }
  quad(a, b, c, d, style) { this._emit(0, [a, b, c, d], style); return this; }

  /** Parallelogram from an origin along two edge vectors. */
  plane(origin, u, v, style) {
    const p = (s, t) => [
      origin[0] + u[0] * s + v[0] * t,
      origin[1] + u[1] * s + v[1] * t,
      origin[2] + u[2] * s + v[2] * t,
    ];
    return this.quad(p(0, 0), p(1, 0), p(1, 1), p(0, 1), style);
  }

  /* --------------------------------------------------------------- solids */

  /** Axis-aligned box between two corners. opts.inward flips the winding. */
  box(min, max, style, opts) {
    return this.boxOpen(min, max, style, null, opts);
  }

  boxOpen(min, max, style, skip, opts) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const inv = !!(opts && opts.inward);
    const s = skip || [];
    const face = (name, pts) => {
      if (s.indexOf(name) >= 0) return;
      if (inv) pts = pts.slice().reverse();
      this._emit(0, pts, style);
    };
    const P = (x, y, z) => [x, y, z];
    face('px', [P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)]);
    face('nx', [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)]);
    face('py', [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)]);
    face('ny', [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)]);
    face('pz', [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]);
    face('nz', [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)]);
    return this;
  }

  /** Box wireframe helper: draws only the 12 edges (useful over a solid). */
  boxEdges(min, max, style) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of e) this.line(c[a], c[b], style);
    return this;
  }

  /** Cylinder / truncated cone around an axis, centred at (cx,cy,cz). */
  cylinder(cx, cy, cz, radius, height, style, opts) {
    const o = opts || {};
    const seg = o.segments || 16;
    const axis = o.axis || 'y';
    const rTop = o.rTop === undefined || o.rTop === null ? radius : o.rTop;
    const capTop = o.capTop !== false;
    const capBottom = o.capBottom !== false;
    const put = (u, v, w) => {
      if (axis === 'y') return [cx + u, cy + w, cz + v];
      if (axis === 'x') return [cx + w, cy + u, cz + v];
      return [cx + u, cy + v, cz + w];
    };
    const h = height / 2;
    const ring = (r, w) => {
      const out = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        out.push(put(Math.cos(a) * r, Math.sin(a) * r, w));
      }
      return out;
    };
    const bot = ring(radius, -h);
    const top = ring(rTop, h);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this._emit(0, [bot[i], bot[j], top[j], top[i]], style);
    }
    if (capTop) this._emit(0, top.slice(), style);
    if (capBottom) this._emit(0, bot.slice().reverse(), style);
    return this;
  }

  /** Filled disc (n-gon) perpendicular to an axis. */
  disc(cx, cy, cz, radius, style, opts) {
    const o = opts || {};
    const seg = o.segments || 24;
    const axis = o.axis || 'y';
    const put = (u, v) => {
      if (axis === 'y') return [cx + u, cy, cz + v];
      if (axis === 'x') return [cx, cy + u, cz + v];
      return [cx + u, cy + v, cz];
    };
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(put(Math.cos(a) * radius, Math.sin(a) * radius));
    }
    this._emit(0, pts, style);
    return this;
  }

  /** Flat annulus between two radii, as a quad strip. */
  ring(cx, cy, cz, rInner, rOuter, style, opts) {
    const o = opts || {};
    const seg = o.segments || 24;
    const axis = o.axis || 'y';
    const put = (u, v) => {
      if (axis === 'y') return [cx + u, cy, cz + v];
      if (axis === 'x') return [cx, cy + u, cz + v];
      return [cx + u, cy + v, cz];
    };
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (r, a) => put(Math.cos(a) * r, Math.sin(a) * r);
      this._emit(0, [p(rInner, a0), p(rOuter, a0), p(rOuter, a1), p(rInner, a1)], style);
    }
    return this;
  }

  /** Sphere as longitude/latitude line work (no fill — keeps the sketch look). */
  sphereWire(cx, cy, cz, radius, style, opts) {
    const o = opts || {};
    const mer = o.meridians || 8;
    const par = o.parallels || 5;
    const seg = o.segments || 22;
    const P = (lat, lon) => [
      cx + radius * Math.cos(lat) * Math.cos(lon),
      cy + radius * Math.sin(lat),
      cz + radius * Math.cos(lat) * Math.sin(lon),
    ];
    for (let m = 0; m < mer; m++) {
      const lon = (m / mer) * Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= seg; i++) pts.push(P(-Math.PI / 2 + (i / seg) * Math.PI, lon));
      if (o.solid) this._emit(0, pts, style); else this._emit(1, pts, style);
    }
    for (let k = 1; k <= par; k++) {
      const lat = -Math.PI / 2 + (k / (par + 1)) * Math.PI;
      const pts = [];
      for (let i = 0; i <= seg; i++) pts.push(P(lat, (i / seg) * Math.PI * 2));
      this._emit(1, pts, style);
    }
    if (o.outline !== false) {
      this.disc(cx, cy - radius, cz, radius, { fill: 'none', stroke: style.stroke, width: style.width }, { segments: seg, axis: 'y' });
      this.disc(cx, cy + radius, cz, radius, { fill: 'none', stroke: style.stroke, width: style.width }, { segments: seg, axis: 'y' });
    }
    return this;
  }

  /* ----------------------------------------------------------------- text */

  /** Vector text as stroke polylines. plane: 'xy' | 'xz' | 'yz'. */
  text(str, opts) {
    const o = opts || {};
    const size = o.size === undefined ? 0.1 : o.size;
    const plane = o.plane || 'xy';
    const align = o.align || 'left';
    const baseline = o.baseline || 'bottom';
    const style = o.style || { stroke: 'ink', width: 1.0 };
    let polys = null;
    let width = 0;
    if (FONT_MOD && typeof FONT_MOD.layout === 'function') {
      const L = FONT_MOD.layout(String(str), size, { align, letterSpacing: o.letterSpacing });
      polys = L.polylines;
      width = L.width;
    } else {
      // fallback: 7-segment digits only
      polys = [];
      let pen = 0;
      const adv = size * 0.62 + size * 0.08;
      let total = 0;
      for (const ch of String(str)) total += (FALLBACK_SEG[ch] ? adv : size * 0.5);
      pen = align === 'center' ? -total / 2 : align === 'right' ? -total : 0;
      for (const ch of String(str)) {
        const g = FALLBACK_SEG[ch];
        if (g) {
          for (const p of g) polys.push(p.map(([x, y]) => [pen + x * size, y * size]));
          pen += adv;
        } else pen += size * 0.5;
      }
      width = total;
    }
    if (!polys) return this;
    let dy = 0;
    if (baseline === 'middle') dy = -size * 0.5;
    else if (baseline === 'top') dy = -size;

    const map = ([u, vv]) => {
      const uu = u, w = vv + dy;
      if (plane === 'xz') return [uu, 0, -w];
      if (plane === 'yz') return [0, w, -uu];
      return [uu, w, 0];
    };

    for (const p of polys) {
      if (p.length < 2) continue;
      const pts = p.map(map);
      this._emit(1, pts, style);
    }
    return this;
  }

  /** Text mapped onto an arbitrary plane basis (for tilted labels). */
  textOn(str, origin, uAxis, vAxis, opts) {
    const o = opts || {};
    const size = o.size === undefined ? 0.1 : o.size;
    const style = o.style || { stroke: 'ink', width: 1.0 };
    let polys = [];
    if (FONT_MOD && typeof FONT_MOD.layout === 'function') {
      polys = FONT_MOD.layout(String(str), size, {
        align: o.align || 'left', letterSpacing: o.letterSpacing,
      }).polylines;
    }
    for (const p of polys) {
      if (p.length < 2) continue;
      const pts = p.map(([u, v]) => [
        origin[0] + uAxis[0] * u + vAxis[0] * v,
        origin[1] + uAxis[1] * u + vAxis[1] * v,
        origin[2] + uAxis[2] * u + vAxis[2] * v,
      ]);
      this._emit(1, pts, style);
    }
    return this;
  }
}

export default Builder;
