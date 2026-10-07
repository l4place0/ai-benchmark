// renderer.js — the painter's-algorithm line-art renderer.
//
// Pipeline per frame:
//   1. walk the scene graph; cache each node's local->world product (only nodes
//      that actually moved are recomputed)
//   2. optional back-face cull (used by the room shell so the near walls vanish)
//   3. near-plane clip, project to screen (all in scratch buffers — the hot path
//      allocates nothing)
//   4. sort far -> near ("painter's algorithm")
//   5. for each primitive: fill (paper colours, slightly inflated to hide seams),
//      optional screen-space hatching, then stroke with ink
//   6. additive / multiply light pass on top
//
// Occlusion is a free by-product of step 5: a near facet's paper-coloured fill
// covers the strokes of everything behind it.

import { m4mul, m4mulInto, m4xformP, m4trs } from './math3d.js';
import { rgb, mixColor } from './palette.js';

const NEAR = 0.08;
const SEAM = 0.55;            // px of fill inflation (x dpr) that hides seams

// Globally unique stamp handed to a node whenever its world matrix changes.
// It MUST be globally unique (not a per-node counter): the drawable records are
// pooled and recycled between nodes, so comparing a recycled record's stamp
// against a per-node counter would wrongly conclude "unchanged" and reuse
// another node's matrix.
let WM_STAMP = 0;

/* --------------------------------------------------------------- helpers */

function clipNear(pts, near) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const da = -near - a[2];
    const db = -near - b[2];
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
  return out;
}

/* -------------------------------------------------------------- renderer */

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.idCanvas = document.createElement('canvas');
    this.idCtx = this.idCanvas.getContext('2d', { willReadFrequently: true });
    this.dpr = 1;
    this.w = 0; this.h = 0;         // css px
    this.pool = [];
    this.poolIdx = 0;
    this.idScale = 0.5;
    this.pickScale = 1;
    this.stats = { drawables: 0, drawn: 0, ms: 0, tms: 0, rms: 0 };
    this._idMap = new Map();

    // scratch (no per-frame allocation in the projection path)
    this._vm = new Float64Array(16);
    this._camBuf = new Float64Array(3 * 512);
    this._wldBuf = new Float64Array(3 * 512);
  }

  resize(cssW, cssH, dpr) {
    this.dpr = dpr;
    this.w = cssW; this.h = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    // The pick buffer is deliberately low resolution: it is only used to answer
    // "what is under the pen". ~0.62 of device resolution is the sweet spot:
    // small parts (a mug, a switch) still get a solid interior, and the buffer
    // is 3x cheaper to fill than a full-resolution one.
    const full = Math.max(1, Math.round(cssW * dpr));
    const targetW = Math.max(560, Math.min(1000, Math.round(full * 0.62)));
    this.idScale = targetW / full;
    this.idCanvas.width = targetW;
    this.idCanvas.height = Math.max(1, Math.round(this.canvas.height * this.idScale));
    this.pickScale = dpr * this.idScale;
  }

  /* ------------------------------------------------------------ traversal */

  _collect(scene) {
    this.poolIdx = 0;
    const out = [];
    for (let i = 0; i < scene.objects.length; i++) {
      const obj = scene.objects[i];
      if (obj.visible === false) continue;
      const objWorld = m4trs(obj.pos, obj.rot, obj.scale);
      this._walk(obj.root, objWorld, null, out, obj);
    }
    return out;
  }

  _walk(node, parentMat, owner, out, object) {
    if (node.visible === false) return;
    const wm = m4mul(parentMat, node.matrix);

    // Did this node's world matrix change since the previous frame? If not we
    // can keep the cached local->world product for all of its geometry.
    const prev = node._wmPrev;
    let moved = true;
    if (prev) {
      moved = false;
      for (let i = 0; i < 16; i++) { if (prev[i] !== wm[i]) { moved = true; break; } }
    }
    if (moved) {
      node._wmPrev = wm.slice();
      node._stamp = ++WM_STAMP;
      node._wm = wm;
    } else if (!node._wm) {
      node._wm = wm;
    }
    if (node._stamp === undefined) node._stamp = ++WM_STAMP;

    const own = node.isPart ? node : owner;
    const geo = node.geo;
    for (let i = 0; i < geo.length; i++) {
      let rec = this.pool[this.poolIdx];
      if (!rec) {
        rec = {
          geo: null, mat: null, owner: null, obj: null, node: null,
          sx: new Float64Array(32), n: 0, depth: 0, bias: 0, area: 0, stamp: -1,
        };
        this.pool[this.poolIdx] = rec;
      }
      this.poolIdx++;
      const g = geo[i];
      rec.geo = g;
      rec.owner = own;
      rec.obj = object;
      rec.node = node;
      if (rec.stamp !== node._stamp) {
        rec.mat = m4mul(node._wm, g.mat);
        rec.stamp = node._stamp;
      }
      out.push(rec);
    }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) this._walk(ch[i], wm, own, out, object);
  }

  /* ------------------------------------------------------------- pipeline */

  draw(scene, cam, theme, opts) {
    const o = opts || {};
    const t0 = NOW();
    const isId = o.mode === 'id';
    const ctx = isId ? this.idCtx : this.ctx;
    const ps = isId ? this.idScale : 1;
    const W = isId ? this.idCanvas.width : this.canvas.width;
    const H = isId ? this.idCanvas.height : this.canvas.height;
    const halfW = W / 2, halfH = H / 2;
    const kEff = cam.k * this.dpr * ps;
    const seam = SEAM * this.dpr * ps;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (isId) {
      ctx.fillStyle = 'rgb(0,0,0)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = rgb(theme.paper);
      ctx.fillRect(0, 0, W, H);
      if (o.backdrop) o.backdrop(ctx, theme, W, H);
    }

    const list = this._collect(scene);
    const view = cam.view;
    const eye = cam.eye;

    let camBuf = this._camBuf;
    let wldBuf = this._wldBuf;
    const vm = this._vm;

    // --- transform + cull + project -------------------------------------
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const g = rec.geo;
      const st = g.style;
      const src = g.pts;
      const m = rec.mat;
      const cnt = src.length;
      if (cnt * 3 > camBuf.length) {
        camBuf = this._camBuf = new Float64Array(cnt * 3);
        wldBuf = this._wldBuf = new Float64Array(cnt * 3);
      }
      m4mulInto(vm, view, m);
      const needsWorld = st.cull === 'back' || st.cull === 'front';

      let maxD = -Infinity, minD = Infinity;
      for (let j = 0; j < cnt; j++) {
        const p = src[j];
        const x = p[0], y = p[1], z = p[2];
        const k3 = j * 3;
        if (needsWorld) {
          wldBuf[k3] = m[0] * x + m[4] * y + m[8] * z + m[12];
          wldBuf[k3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          wldBuf[k3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
        const cz = vm[2] * x + vm[6] * y + vm[10] * z + vm[14];
        camBuf[k3] = vm[0] * x + vm[4] * y + vm[8] * z + vm[12];
        camBuf[k3 + 1] = vm[1] * x + vm[5] * y + vm[9] * z + vm[13];
        camBuf[k3 + 2] = cz;
        const d = -cz;
        if (d > maxD) maxD = d;
        if (d < minD) minD = d;
      }
      if (!(maxD > NEAR)) continue;

      if (needsWorld && cnt >= 3) {
        const ax = wldBuf[0], ay = wldBuf[1], az = wldBuf[2];
        const ux = wldBuf[3] - ax, uy = wldBuf[4] - ay, uz = wldBuf[5] - az;
        const vx = wldBuf[6] - ax, vy = wldBuf[7] - ay, vz = wldBuf[8] - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let cx0 = 0, cy0 = 0, cz0 = 0;
        for (let j = 0; j < cnt; j++) {
          const k3 = j * 3;
          cx0 += wldBuf[k3]; cy0 += wldBuf[k3 + 1]; cz0 += wldBuf[k3 + 2];
        }
        cx0 /= cnt; cy0 /= cnt; cz0 /= cnt;
        const dot = nx * (cx0 - eye[0]) + ny * (cy0 - eye[1]) + nz * (cz0 - eye[2]);
        if (st.cull === 'back' && dot > 0) continue;
        if (st.cull === 'front' && dot < 0) continue;
      }

      let clipped = null;
      let total = cnt;
      if (minD < NEAR) {
        const pts = new Array(cnt);
        for (let j = 0; j < cnt; j++) {
          const k3 = j * 3;
          pts[j] = [camBuf[k3], camBuf[k3 + 1], camBuf[k3 + 2]];
        }
        clipped = clipNear(pts, NEAR);
        total = clipped.length;
        if (g.kind === 0 && total < 3) continue;
        if (total < 2) continue;
      }

      if (rec.sx.length < total * 2) rec.sx = new Float64Array(Math.max(32, total * 2));
      const sxA = rec.sx;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let j = 0; j < total; j++) {
        let px, py, pz;
        if (clipped) { const q = clipped[j]; px = q[0]; py = q[1]; pz = q[2]; }
        else { const k3 = j * 3; px = camBuf[k3]; py = camBuf[k3 + 1]; pz = camBuf[k3 + 2]; }
        const inv = kEff / -pz;
        const sxv = px * inv, syv = -py * inv;
        sxA[j * 2] = sxv;
        sxA[j * 2 + 1] = syv;
        if (sxv < minX) minX = sxv;
        if (sxv > maxX) maxX = sxv;
        if (syv < minY) minY = syv;
        if (syv > maxY) maxY = syv;
      }

      // Sub-pixel facets cost a fill+stroke but contribute nothing visible.
      const bw = maxX - minX, bh = maxY - minY;
      if (!isId && bw < 1.15 && bh < 1.15) continue;

      rec.n = total;
      rec.depth = maxD;
      rec.bias = (st.bias || 0) + (rec.obj.depthBias || 0);
      rec.area = bw * bh;
      list[n++] = rec;
    }
    list.length = n;
    const tMid = NOW();

    // --- sort far -> near ------------------------------------------------
    // `bias` shifts a primitive's effective depth: NEGATIVE moves it further
    // away (drawn earlier, ends up behind), POSITIVE pulls it nearer (drawn
    // later, ends up in front) — matching CONTRACT.md §5.
    list.sort((a, b) => (b.depth - b.bias) - (a.depth - a.bias));

    // --- rasterise --------------------------------------------------------
    const hoverPart = o.hoverPart || null;
    const seam2 = this.dpr * this.dpr;
    let drawn = 0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const st = rec.geo.style;
      const sxA = rec.sx;
      const len = rec.n;

      if (isId) {
        const part = rec.owner;
        if (!part || !part.enabled || !part.pickable) continue;
        ctx.beginPath();
        if (len > 2) {
          // Inflate a little so every facet has a solid core and covers its own
          // antialiased fringe. Without this, a sub-pixel facet rasterises as a
          // ring of blended pixels that decode as unrelated part ids.
          let mx = 0, my = 0;
          for (let j = 0; j < len; j++) { mx += sxA[j * 2]; my += sxA[j * 2 + 1]; }
          mx /= len; my /= len;
          const pad = 1.15 * ps * this.dpr;
          for (let j = 0; j < len; j++) {
            const dx = sxA[j * 2] - mx, dy = sxA[j * 2 + 1] - my;
            const l = Math.hypot(dx, dy) || 1;
            const ex = halfW + sxA[j * 2] + (dx / l) * pad;
            const ey = halfH + sxA[j * 2 + 1] + (dy / l) * pad;
            if (j === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
          }
          ctx.closePath();
        } else {
          if (len < 2) continue;
          ctx.moveTo(halfW + sxA[0], halfH + sxA[1]);
          ctx.lineTo(halfW + sxA[2], halfH + sxA[3]);
        }
        ctx.fillStyle = part._idColor;
        ctx.strokeStyle = part._idColor;
        ctx.lineWidth = 2.2 * ps * this.dpr;
        ctx.fill();
        if (len > 2) ctx.stroke();
        continue;
      }

      const owner = rec.owner;
      const hoverT = owner ? owner.hoverT : 0;
      const hT = owner && owner === hoverPart ? Math.max(hoverT, 0.5) : hoverT;
      const alpha = st.alpha === undefined ? 1 : st.alpha;
      const tiny = rec.area < 4 * seam2;
      const closed = rec.geo.kind === 0 && len > 2;

      const fillCol = tiny ? null : resolveFill(st, theme, hT);
      const strokeCol = resolveStroke(st, theme, hT);
      let w = (st.width === undefined ? 1.1 : st.width) * (theme.lineScale || 1) * (1 + 0.55 * hT);
      w *= this.dpr * ps;
      const hasStroke = !!strokeCol && w > 0.15;

      // Fast path: the outline and the fill are the same polygon, so build the
      // path ONCE and issue both calls on it. That halves the number of canvas
      // calls per facet, which is what actually costs time here (every facet is
      // stroked, so the seam inflation is not needed in this case).
      if (fillCol && hasStroke) {
        ctx.beginPath();
        ctx.moveTo(halfW + sxA[0], halfH + sxA[1]);
        for (let j = 1; j < len; j++) ctx.lineTo(halfW + sxA[j * 2], halfH + sxA[j * 2 + 1]);
        if (closed) ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.lineWidth = w;
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fillCol) {
        // Unstroked fill: inflate away from the centroid so neighbours overlap.
        ctx.beginPath();
        if (len > 2) {
          let mx = 0, my = 0;
          for (let j = 0; j < len; j++) { mx += sxA[j * 2]; my += sxA[j * 2 + 1]; }
          mx /= len; my /= len;
          for (let j = 0; j < len; j++) {
            const dx = sxA[j * 2] - mx, dy = sxA[j * 2 + 1] - my;
            const l = Math.hypot(dx, dy) || 1;
            const ex = halfW + sxA[j * 2] + (dx / l) * seam;
            const ey = halfH + sxA[j * 2 + 1] + (dy / l) * seam;
            if (j === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
          }
        } else {
          ctx.moveTo(halfW + sxA[0], halfH + sxA[1]);
          ctx.lineTo(halfW + sxA[2], halfH + sxA[3]);
        }
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (hasStroke) {
        ctx.beginPath();
        ctx.moveTo(halfW + sxA[0], halfH + sxA[1]);
        for (let j = 1; j < len; j++) ctx.lineTo(halfW + sxA[j * 2], halfH + sxA[j * 2 + 1]);
        if (closed) ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.lineWidth = w;
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ---- hatch (screen-space parallel lines clipped to the facet)
      if (st.hatch && len > 2 && rec.area > 700 * seam2) {
        this._hatch(ctx, sxA, len, st.hatch, theme, halfW, halfH, alpha, ps);
      }
      drawn++;
    }
    this.stats.drawables = list.length;
    this.stats.drawn = drawn;
    const tEnd = NOW();
    this.stats.tms = tMid - t0;
    this.stats.rms = tEnd - tMid;

    // --- light pass -------------------------------------------------------
    if (!isId && o.lights && o.lights.length) {
      this._lights(ctx, cam, o.lights, theme, W, H, this.dpr);
    }
    this.stats.ms = NOW() - t0;
  }

  _hatch(ctx, sxA, len, hatch, theme, halfW, halfH, alpha, ps) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < len; i++) {
      const x = sxA[i * 2], y = sxA[i * 2 + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX - minX < 2 || maxY - minY < 2) return;
    const gap = Math.max(2.5, (hatch.gap === undefined ? 6 : hatch.gap) * this.dpr * ps);
    const ang = ((hatch.angle === undefined ? 45 : hatch.angle) * Math.PI) / 180;
    const col = hatch.stroke ? (theme.stroke[hatch.stroke] || theme.hatchColor) : theme.hatchColor;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(halfW + sxA[0], halfH + sxA[1]);
    for (let j = 1; j < len; j++) ctx.lineTo(halfW + sxA[j * 2], halfH + sxA[j * 2 + 1]);
    ctx.closePath();
    ctx.clip();

    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    const rad = Math.hypot(maxX - minX, maxY - minY) / 2 + gap;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    const count = Math.min(160, Math.ceil(rad / gap));
    ctx.beginPath();
    for (let i = -count; i <= count; i++) {
      const ox = mx + nx * i * gap, oy = my + ny * i * gap;
      ctx.moveTo(halfW + ox - dx * rad, halfH + oy - dy * rad);
      ctx.lineTo(halfW + ox + dx * rad, halfH + oy + dy * rad);
    }
    ctx.lineWidth = (hatch.width === undefined ? 0.75 : hatch.width) * this.dpr * ps;
    ctx.strokeStyle = rgb(col, hatch.alpha === undefined ? 0.5 : hatch.alpha);
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _lights(ctx, cam, lights, theme, W, H, dpr) {
    const nightT = theme.nightT || 0;
    // Layered additive gradients add up fast, so keep the strongest few and
    // keep each one gentle — a blown-out white disc would erase the drawing.
    const order = lights.slice().sort((a, b) => (b.intensity || 1) - (a.intensity || 1));
    const max = Math.min(order.length, 5);
    for (let i = 0; i < max; i++) {
      const L = order[i];
      const cp = m4xformP(cam.view, L.pos);
      if (cp[2] > -NEAR) continue;
      const inv = (cam.k * dpr) / -cp[2];
      const px = W / 2 + cp[0] * inv;
      const py = H / 2 - cp[1] * inv;
      const pr = L.radius * inv;
      if (!(pr > 6) || px < -pr || px > W + pr || py < -pr || py > H + pr) continue;
      const a = (L.intensity === undefined ? 1 : L.intensity) * (0.18 + 0.42 * nightT) / (1 + i * 0.55);
      if (a <= 0.006) continue;
      const c = L.color || [255, 214, 150];
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, rgb(c, Math.min(0.34, a)));
      g.addColorStop(0.22, rgb(c, Math.min(0.20, a * 0.6)));
      g.addColorStop(0.55, rgb(c, Math.min(0.07, a * 0.2)));
      g.addColorStop(1, rgb(c, 0));
      ctx.save();
      ctx.globalCompositeOperation = nightT > 0.45 ? 'lighter' : 'source-over';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* --------------------------------------------------------------- picking */

  buildPickBuffer(scene, cam, theme) {
    this.draw(scene, cam, theme, { mode: 'id' });
  }

  setPickMap(map) { this._idMap = map; }

  /** css-pixel coords -> part or null.
   *  Reads a small neighbourhood and takes the majority vote: canvas paths are
   *  antialiased, so a single pixel on a part's edge is a blend of two id
   *  colours and would decode to an arbitrary unrelated id. */
  pickAt(cssX, cssY) {
    const x = Math.round(cssX * this.pickScale);
    const y = Math.round(cssY * this.pickScale);
    if (x < 0 || y < 0 || x >= this.idCanvas.width || y >= this.idCanvas.height) return null;
    let d;
    try {
      d = this.idCtx.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3).data;
    } catch (e) { return null; }
    const votes = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const id = d[i] | (d[i + 1] << 8);
      if (!id) continue;
      votes.set(id, (votes.get(id) || 0) + 1);
    }
    let best = 0, bestN = 0;
    for (const [id, n] of votes) if (n > bestN) { best = id; bestN = n; }
    if (!best) return null;
    return this._idMap.get(best) || null;
  }

  /** project a world point to css pixels */
  project(cam, p) {
    const cp = m4xformP(cam.view, p);
    const behind = cp[2] > -NEAR;
    const inv = cam.k / Math.max(1e-4, -cp[2]);
    return { x: this.w / 2 + cp[0] * inv, y: this.h / 2 - cp[1] * inv, behind, depth: -cp[2] };
  }
}

/* --------------------------------------------------------- style resolve */
// Resolving a token to a css string allocates; with a few thousand facets per
// frame that matters, so the last few hundred results are memoised. The hover
// blend is quantised into 12 buckets to keep the cache small.

const _fillCache = new Map();
const _strokeCache = new Map();
const CACHE_MAX = 900;

function resolveFill(st, theme, hT) {
  const f = st.fill;
  if (f === undefined || f === null || f === 'none') return null;
  if (Array.isArray(f)) return rgb(f);
  if (typeof f === 'string' && f.charAt(0) === '#') return f;
  const bucket = hT > 0.001 ? Math.min(12, Math.round(hT * 12)) : 0;
  const key = f + '|' + theme.nightT.toFixed(3) + '|' + bucket;
  let v = _fillCache.get(key);
  if (v === undefined) {
    const base = theme.fill[f] || theme.paper;
    v = bucket ? rgb(mixColor(base, theme.accent, 0.14 * (bucket / 12))) : rgb(base);
    if (_fillCache.size > CACHE_MAX) _fillCache.clear();
    _fillCache.set(key, v);
  }
  return v;
}

function resolveStroke(st, theme, hT) {
  const s = st.stroke;
  if (s === undefined || s === null || s === 'none') return null;
  if (Array.isArray(s)) return rgb(s);
  if (typeof s === 'string' && s.charAt(0) === '#') return s;
  const bucket = hT > 0.001 ? Math.min(12, Math.round(hT * 12)) : 0;
  const key = s + '|' + theme.nightT.toFixed(3) + '|' + bucket;
  let v = _strokeCache.get(key);
  if (v === undefined) {
    const base = theme.stroke[s] || theme.ink;
    v = bucket ? rgb(mixColor(base, theme.accent, 0.85 * (bucket / 12))) : rgb(base);
    if (_strokeCache.size > CACHE_MAX) _strokeCache.clear();
    _strokeCache.set(key, v);
  }
  return v;
}

const NOW = (typeof performance !== 'undefined' && performance.now)
  ? () => performance.now()
  : () => Date.now();

export default Renderer;
export { resolveFill, resolveStroke };
