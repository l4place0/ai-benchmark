/* =========================================================================
   Pure Line Room — _tools/raster.mjs
   A small software rasteriser that replays the Canvas2D call stream produced
   by js/renderer.js (through a fallback context) into an RGBA buffer, so the
   room can be inspected from Node without a browser.
   ========================================================================= */
import { encodePNG } from './png.mjs';

const BLACK = [0, 0, 0];

function parseColor(c) {
  if (c == null) return [0, 0, 0, 1];
  if (typeof c === 'object') {
    if (c.__grad) {
      /* Gradients are approximated by the offset-weighted mean of their stops,
         which preserves the glow's colour and rough intensity. */
      let r = 0, g = 0, b = 0, a = 0, w = 0;
      for (const s of c.stops) {
        const q = parseColor(s.color);
        const wt = 1 - (s.o || 0) * 0.55 + 0.15;
        r += q[0] * wt; g += q[1] * wt; b += q[2] * wt;
        a += (q[3] === undefined ? 1 : q[3]) * wt;
        w += wt;
      }
      if (!w) return [0, 0, 0, 0];
      return [r / w, g / w, b / w, a / w];
    }
    return [0, 0, 0, 0];
  }
  let s = String(c).trim().toLowerCase();
  if (s.startsWith('#')) {
    if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts.length > 3 ? parts[3] : 1];
  }
  if (s === 'white') return [255, 255, 255, 1];
  if (s === 'black') return [0, 0, 0, 1];
  return [128, 128, 128, 1];
}

export class Raster {
  constructor(w, h, bg = '#ffffff') {
    this.w = w; this.h = h;
    this.pxWrites = 0;
    this.spanRows = 0;
    this.discCalls = 0;
    this.buf = new Float32Array(w * h * 4);
    const c = parseColor(bg);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 4] = c[0]; this.buf[i * 4 + 1] = c[1];
      this.buf[i * 4 + 2] = c[2]; this.buf[i * 4 + 3] = 255;
    }
  }

  blend(x, y, r, g, b, a, mode) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const buf = this.buf;
    if (mode === 'lighter') {
      buf[i] += r * a; buf[i + 1] += g * a; buf[i + 2] += b * a;
    } else {
      const ia = 1 - a;
      buf[i] = buf[i] * ia + r * a;
      buf[i + 1] = buf[i + 1] * ia + g * a;
      buf[i + 2] = buf[i + 2] * ia + b * a;
    }
  }

  fillPoly(pts, color, alpha, mode) {
    if (!pts.length) return;
    const col = parseColor(color);
    const a = Math.max(0, Math.min(1, (col[3] === undefined ? 1 : col[3]) * alpha));
    if (a <= 0.001) return;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(this.w - 1, Math.ceil(maxX));
    if (y0 > y1 || x0 > x1) return;
    const n = pts.length;
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = pts[i][1], yj = pts[j][1];
        if ((yi > yc) !== (yj > yc)) {
          const t = (yc - yi) / (yj - yi);
          xs.push(pts[i][0] + t * (pts[j][0] - pts[i][0]));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const lo = xs[k], hi = xs[k + 1];
        if (hi < x0 || lo > x1) continue;
        const sx = Math.max(x0, Math.ceil(lo - 0.5));
        const ex = Math.min(x1, Math.ceil(hi - 0.5) - 1);
        this.pxWrites += Math.max(0, ex - sx + 1);
        this.spanRows++;
        for (let x = sx; x <= ex; x++) this.blend(x, y, col[0], col[1], col[2], a, mode);
      }
    }
  }

  /* ---- anti-aliased line drawing ----
     Thin lines are plotted straight into the buffer with bilinear coverage
     (one blend per covered pixel). Wide lines sweep a small span per row,
     which keeps a 50k-segment frame quick to review. */
  beginStroke(color, alpha, mode) {
    this._col = parseColor(color);
    this._alpha = Math.max(0, Math.min(1, (this._col[3] === undefined ? 1 : this._col[3]) * alpha));
    this._mode = mode;
  }

  _plot(x, y, a) {
    if (a <= 0.004 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = this._col;
    this.blend(x, y, c[0], c[1], c[2], this._alpha * a, this._mode);
  }

  _segment(p, q, half) {
    const x0 = p[0], y0 = p[1], x1 = q[0], y1 = q[1];
    const dx = x1 - x0, dy = y1 - y0;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const len = adx > ady ? adx : ady;
    if (len < 1e-6) { this._disc(x0, y0, half); return; }
    if (half > 1.35) { this._thickSegment(x0, y0, x1, y1, half); return; }
    const steps = Math.ceil(len);
    const sx = dx / steps, sy = dy / steps;
    const rr = half + 0.5;
    const cov = rr >= 1 ? 1 : rr * Math.SQRT2;
    let px = x0, py = y0;
    for (let i = 0; i <= steps; i++) {
      const ix = Math.floor(px), iy = Math.floor(py);
      const fx = px - ix, fy = py - iy;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy, w11 = fx * fy;
      if (w00 > 0.004) this._plot(ix, iy, cov * w00);
      if (w10 > 0.004) this._plot(ix + 1, iy, cov * w10);
      if (w01 > 0.004) this._plot(ix, iy + 1, cov * w01);
      if (w11 > 0.004) this._plot(ix + 1, iy + 1, cov * w11);
      px += sx; py += sy;
    }
  }

  /* Wide strokes: walk the bounding box, projecting each pixel onto the
     segment, and shade by distance. Bounded work, no per-step allocation. */
  _thickSegment(x0, y0, x1, y1, half) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const pad = half + 1;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - pad));
    const bx1 = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + pad));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
    const by1 = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + pad));
    const inv = len2 > 1e-9 ? 1 / len2 : 0;
    for (let y = by0; y <= by1; y++) {
      const py = y + 0.5 - y0;
      for (let x = bx0; x <= bx1; x++) {
        const px = x + 0.5 - x0;
        let t = len2 > 1e-9 ? (px * dx + py * dy) * inv : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const ex = px - dx * t, ey = py - dy * t;
        const d = Math.sqrt(ex * ex + ey * ey);
        const cov = half + 0.5 - d;
        if (cov > 0.004) this._plot(x, y, cov > 1 ? 1 : cov);
      }
    }
  }

  _disc(cx, cy, r) {
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(this.w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(this.h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ddx = x + 0.5 - cx, ddy = y + 0.5 - cy;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        const cov = r + 0.5 - d;
        if (cov > 0.004) this._plot(x, y, cov > 1 ? 1 : cov);
      }
    }
  }

  endStroke() { /* compositing happens per pixel in _plot */ }

  strokePolyline(pts, width, color, alpha, dash, dashOffset, mode, closed) {
    const parsed = parseColor(color);
    const a = Math.max(0, Math.min(1, (parsed[3] === undefined ? 1 : parsed[3]) * alpha));
    if (a <= 0.002 || pts.length < 2) return;
    const w = Math.max(1, width);
    const half = Math.max(0.5, w / 2);
    let seq = pts;
    if (closed && pts.length > 2) seq = pts.concat([pts[0]]);
    this.beginStroke(color, alpha, mode);
    if (dash && dash.length) {
      const parts = applyDash(seq, dash, dashOffset || 0);
      for (const part of parts) {
        for (let i = 0; i + 1 < part.length; i++) this._segment(part[i], part[i + 1], half);
      }
    } else {
      for (let i = 0; i + 1 < seq.length; i++) this._segment(seq[i], seq[i + 1], half);
    }
    this.endStroke();
  }

  radialGlow(cx, cy, r0, r1, color, a0, mode) {
    const col = parseColor(color);
    const x0 = Math.max(0, Math.floor(cx - r1)), x1 = Math.min(this.w - 1, Math.ceil(cx + r1));
    const y0 = Math.max(0, Math.floor(cy - r1)), y1 = Math.min(this.h - 1, Math.ceil(cy + r1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r1) continue;
        const t = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
        this.blend(x, y, col[0], col[1], col[2], a0 * t * t, mode);
      }
    }
  }

  toPNG() {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < out.length; i++) {
      const v = this.buf[i];
      out[i] = i % 4 === 3 ? 255 : Math.max(0, Math.min(255, Math.round(v)));
    }
    return encodePNG(this.w, this.h, out);
  }}

function applyDash(pts, dash, offset) {
  // walk the polyline, emitting only the "on" parts
  const out = [];
  let idx = 0;
  let remaining = dash[0];
  let on = true;
  let phase = offset || 0;
  while (phase > 0 && dash.length) {
    const take = Math.min(phase, remaining);
    remaining -= take; phase -= take;
    if (remaining <= 1e-6) { idx = (idx + 1) % dash.length; remaining = dash[idx]; on = !on; }
  }
  let cur = [pts[0]];
  let p = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let q = pts[i];
    let segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let t0 = 0;
    while (segLen - t0 > 1e-6) {
      const take = Math.min(remaining, segLen - t0);
      const t1 = t0 + take;
      const a = [p[0] + (q[0] - p[0]) * (t1 / segLen), p[1] + (q[1] - p[1]) * (t1 / segLen)];
      if (on) {
        cur.push(a);
      } else if (cur.length > 1) { out.push(cur); cur = []; }
      remaining -= take; t0 = t1;
      if (remaining <= 1e-6) {
        idx = (idx + 1) % dash.length; remaining = dash[idx]; on = !on;
        if (on) cur = [a];
        else if (cur.length > 1) { out.push(cur); cur = []; }
      }
    }
    p = q;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
