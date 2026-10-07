// lounge.js — the lounge corner of the Pure Line Room.
//
// Owns: the floor centre (rug / sofa / coffee table), the back wall centre-right
//       (bookcase + record cabinet + turntable) and the right wall (music poster).
//
// Authoring rules used throughout:
//   * every primitive is emitted exactly once, inside the local frame of the node
//     that is allowed to move; animation only writes Node transforms (plus a
//     couple of style.alpha tokens for the poster cross-fade);
//   * pickable geometry lives in a Part's builder, static geometry in the object
//     root or in plain child nodes;
//   * shading comes from hatch fields over the palette tokens, never from big
//     dark fills;
//   * line hierarchy: silhouette 1.85, structure 1.15-1.25, detail 0.78-0.85.

import { clamp, lerp, makeRng } from '../core/math3d.js';
import { ease, Spring } from '../core/anim.js';

/* ==================================================================== style */

const SIL    = { fill: 'face1', stroke: 'ink',    width: 1.85 };  // silhouette
const STRUCT = { fill: 'face1', stroke: 'ink',    width: 1.25 };  // main structure
const FACE2  = { fill: 'face2', stroke: 'ink',    width: 1.15 };  // turned-away face
const FACE2S = { fill: 'face2', stroke: 'inkMid', width: 0.95 };
const FACE3  = { fill: 'face3', stroke: 'inkMid', width: 1.0  };  // recess / interior
const INK    = { stroke: 'ink',    width: 1.2  };
const THIN   = { stroke: 'ink',    width: 0.82 };
const SOFT   = { stroke: 'inkSoft', width: 0.78 };
const MID    = { stroke: 'inkMid', width: 1.0  };
const GLASS  = { fill: 'glass', stroke: 'inkSoft', width: 0.9, alpha: 0.18 };
const DARK   = { fill: 'dark',  stroke: 'ink', width: 1.7 };
const HIDDEN = { fill: 'none', stroke: 'none', width: 0 };        // pick-only helper

const SPINE_TITLES = ['ATLAS', 'NOIR', 'FIELD', 'SALT', 'ECHO', 'MONO', 'DRIFT', 'ORBIT', 'LINEN', 'QUIET'];

/** hatch-only field (no fill, no outline) — shadows and material weave */
function hatch(gap, angle, alpha, stroke) {
  return {
    fill: 'none', stroke: 'none',
    hatch: { gap, angle, width: 0.68, stroke: stroke || 'inkSoft', alpha: alpha === undefined ? 0.38 : alpha },
  };
}
const H_SOFT = hatch(7.5, 44, 0.32);
const H_MID  = hatch(6, 52, 0.42);
const H_FINE = hatch(6, 38, 0.26);
const H_WEAVE_A = hatch(9, 45, 0.22);
const H_WEAVE_B = hatch(9, -45, 0.22);
// depth bias convention (renderer sorts by depth - bias, far -> near):
//   bias > 0 draws LATER (in front), bias < 0 draws EARLIER (behind).
// Only the small +/-0.02..0.05 offsets below are used, to de-blink coplanar
// surfaces; the large floor shadows need no bias at all, their own depth
// already sorts them in front of the floor and behind the furniture.

/** fresh style record (needed whenever a value is animated later) */
function style(base, extra) { return Object.assign({}, base, extra || {}); }

/* ============================================================ shape helpers */

const TAU = Math.PI * 2;

/** closed polyline circle in a horizontal plane */
function circleY(b, cx, cy, cz, r, n, s) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    p.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
  }
  b.polyline(p, s, true);
}

/** closed polyline circle in a plane facing +z */
function circleZ(b, cx, cy, cz, r, n, s) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
  }
  b.polyline(p, s, true);
}

/** rounded rectangle outline in the xz plane (points only) */
function roundRectPts(x0, z0, x1, z1, r, seg) {
  const rr = Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2);
  const out = [];
  const corner = (cx, cz, a0, a1) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg);
      out.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
    }
  };
  corner(x1 - rr, z1 - rr, 0, Math.PI / 2);
  corner(x0 + rr, z1 - rr, Math.PI / 2, Math.PI);
  corner(x0 + rr, z0 + rr, Math.PI, Math.PI * 1.5);
  corner(x1 - rr, z0 + rr, Math.PI * 1.5, TAU);
  return out;
}

/** next darker surface token, used to shade bevels against top faces */
function shadeToken(t) { return t === 'face1' ? 'face2' : t === 'face2' ? 'face3' : 'face3'; }

/**
 * Cushion volume: eight fill-only facets (a small quad strip forms the bevel),
 * then one front outline and one top outline so the cushion reads as a soft
 * volume instead of a wireframe box, plus the inset piped seam and stitches.
 */
function roundedBox(b, x0, y0, z0, x1, y1, z1, r, face, seam, stitches) {
  const tx0 = x0 + r, tx1 = x1 - r, tz0 = z0 + r, tz1 = z1 - r;
  const flat = style(face, { stroke: 'none' });
  const side = style({ fill: shadeToken(face.fill), stroke: 'none' });
  b.quad([tx0, y1, tz0], [tx1, y1, tz0], [tx1, y1, tz1], [tx0, y1, tz1], flat);   // top
  b.quad([tx0, y0, z0], [tx1, y0, z0], [tx1, y1, z0], [tx0, y1, z0], side);      // front
  b.quad([x0, y0, tz0], [x0, y0, tz1], [x0, y1, tz1], [x0, y1, tz0], side);      // left
  b.quad([x1, y0, tz0], [x1, y0, tz1], [x1, y1, tz1], [x1, y1, tz0], side);      // right
  b.quad([tx0, y1, z0], [tx1, y1, z0], [tx1, y1, tz0], [tx0, y1, tz0], side);    // front bevel
  b.quad([x0, y1, tz0], [tx0, y1, tz0], [tx0, y1, tz1], [x0, y1, tz1], flat);    // left bevel
  b.quad([tx1, y1, tz0], [x1, y1, tz0], [x1, y1, tz1], [tx1, y1, tz1], flat);    // right bevel
  b.quad([tx0, y1, tz1], [tx1, y1, tz1], [tx1, y1, z1], [tx0, y1, z1], side);    // back bevel
  const edge = style(face, { stroke: 'ink', width: 1.15, fill: 'none' });
  const softEdge = style(face, { stroke: 'inkSoft', width: 0.8, fill: 'none' });
  // front outline: the bevel cuts the four corners
  b.polyline([
    [x0 + r, y0, z0 - 0.001], [x1 - r, y0, z0 - 0.001], [x1, y0 + r, z0 - 0.001],
    [x1, y1 - r, z0 - 0.001], [x1 - r, y1, z0 - 0.001], [x0 + r, y1, z0 - 0.001],
    [x0, y1 - r, z0 - 0.001], [x0, y0 + r, z0 - 0.001],
  ], edge, true);
  // top outline + piped seam
  const top = roundRectPts(x0, z0, x1, z1, r, 2);
  b.polyline(top.map((q) => [q[0], y1, q[1]]), softEdge, true);
  if (seam) {
    const sx0 = x0 + r * 0.6, sx1 = x1 - r * 0.6, sz0 = z0 + r * 0.6, sz1 = z1 - r * 0.6;
    b.polyline([
      [sx0, y1 + 0.001, sz0], [sx1, y1 + 0.001, sz0],
      [sx1, y1 + 0.001, sz1], [sx0, y1 + 0.001, sz1],
    ], seam, true);
  }
  if (stitches) {
    for (let i = 0; i < stitches.length; i++) {
      const s = stitches[i];
      b.line([s[0], s[1], z0 - 0.003], [s[2], s[3], z0 - 0.003], SOFT);
    }
  }
}

/** tapered square post (legs): two visible faces + a foot mark */
function taperPost(b, cx, cz, y0, y1, s0, s1, face) {
  const h0 = s0 / 2, h1 = s1 / 2;
  b.quad([cx - h0, y0, cz + h0], [cx + h0, y0, cz + h0], [cx + h1, y1, cz + h1], [cx - h1, y1, cz + h1], face);
  b.quad([cx + h0, y0, cz + h0], [cx + h0, y0, cz - h0], [cx + h1, y1, cz - h1], [cx + h1, y1, cz + h1], face);
  b.line([cx - h0, y0, cz + h0], [cx + h0, y0, cz + h0], SOFT);
}

/** flat quad on the floor from two x/z ranges */
function floorQuad(b, x0, z0, x1, z1, y, s) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], s);
}

/* ================================================================= module */

export default function build(ctx) {
  const rng = makeRng(0x51de21);
  const rand = (a, b) => a + (b - a) * rng();

  const audio = ctx.audio || {};
  const sfx = (n) => { if (audio.sfx) { try { audio.sfx(n); } catch (e) { /* audio is optional */ } } };
  const loop = (n, on, o) => { if (audio.setLoop) { try { audio.setLoop(n, on, o); } catch (e) { /* ignore */ } } };
  const sget = (k) => {
    const s = ctx.state;
    if (!s) return undefined;
    if (typeof s.get === 'function') return s.get(k);
    return s[k];
  };
  const sset = (k, v) => { if (ctx.set) { try { ctx.set(k, v); } catch (e) { /* ignore */ } } };
  /* ctx.object() is the contract entry point; scene.object() is the fallback for
     harnesses that only expose the scene. */
  const object = (opts) => (typeof ctx.object === 'function' ? ctx.object(opts) : ctx.scene.object(opts));

  let frameNow = 0;
  const stamp = () => (typeof ctx.time === 'number' ? ctx.time : frameNow);

  /* click guard: the same click reaching both a part and its object fires once */
  function clickGuard(fn) {
    let last = -1;
    return (c) => {
      const t = stamp();
      if (t === last) return;
      last = t;
      fn(c);
    };
  }
  /* drag guard: an identical (dx,dy) delivered twice in one frame is applied once */
  function dragGuard(fn) {
    let last = -1, lx = 0, ly = 0;
    return (e, c) => {
      const t = stamp();
      if (e.phase === 'move' && t === last && e.dx === lx && e.dy === ly) return;
      last = t; lx = e.dx; ly = e.dy;
      fn(e, c);
    };
  }
  /** attach a click to a part (and optionally mirror it on the object) */
  function bindClick(part, fn, mirror) {
    const g = clickGuard(fn);
    part.onClick(g);
    if (mirror) part.obj.onClick(g);
    return g;
  }
  /**
   * scene.update() only walks object level handlers, so every object owns a
   * single update function that ticks all of its parts and nodes.
   */
  function ticker(obj) {
    const fns = [];
    obj.onUpdate((dt, now, c) => {
      frameNow = now;
      for (let i = 0; i < fns.length; i++) fns[i](dt, now, c);
    });
    return (fn) => { fns.push(fn); return fn; };
  }

  /* ------------------------------------------------------------- bookcase */

  function buildBookcase() {
    const obj = object({ id: 'bookshelf', label: '书架' });
    const b = obj.builder;
    const onTick = ticker(obj);

    const X0 = 0.55, X1 = 2.55, ZB = -2.52, ZF = -2.18, TOP = 1.95;
    const T = 0.03;                             // panel thickness
    const SHY = [0.460, 0.850, 1.240, 1.630];   // shelf undersides
    const SH = 0.025;                           // shelf thickness
    const BASE = 0.125;                         // bottom board top
    const ZBI = -2.50, ZFI = -2.205;            // interior back / front
    const FFZ = ZF + 0.006;                     // face frame plane

    // plinth with a recessed toe kick
    b.box([X0 + T, 0.02, ZB + 0.02], [X1 - T, 0.10, ZF - 0.085], FACE2);
    b.line([X0 + T, 0.10, ZF - 0.085], [X1 - T, 0.10, ZF - 0.085], MID);
    b.line([X0 + T, 0.02, ZF - 0.085], [X0 + T, 0.10, ZF - 0.085], SOFT);
    b.line([X1 - T, 0.02, ZF - 0.085], [X1 - T, 0.10, ZF - 0.085], SOFT);

    // side panels + edge banding
    b.box([X0, 0.10, ZB + 0.005], [X0 + T, TOP, ZF], SIL);
    b.box([X1 - T, 0.10, ZB + 0.005], [X1, TOP, ZF], SIL);
    b.quad([X0, 0.10, ZF + 0.002], [X0 + T, 0.10, ZF + 0.002], [X0 + T, TOP, ZF + 0.002], [X0, TOP, ZF + 0.002],
      style(FACE3, { stroke: 'ink', width: 0.9, bias: 0.02 }));
    b.quad([X1 - T, 0.10, ZF + 0.002], [X1, 0.10, ZF + 0.002], [X1, TOP, ZF + 0.002], [X1 - T, TOP, ZF + 0.002],
      style(FACE3, { stroke: 'ink', width: 0.9, bias: 0.02 }));

    // bottom board, four shelves (each with stopped-dado marks), top board
    b.boxOpen([X0 + T, 0.10, ZBI], [X1 - T, BASE, ZFI], FACE2, ['ny']);
    for (let i = 0; i < SHY.length; i++) {
      b.boxOpen([X0 + T, SHY[i], ZBI], [X1 - T, SHY[i] + SH, ZFI], FACE2, ['ny']);
      b.line([X0 + T, SHY[i] + SH * 0.5, ZFI], [X0 + T + 0.055, SHY[i] + SH * 0.5, ZFI], SOFT);
      b.line([X1 - T - 0.055, SHY[i] + SH * 0.5, ZFI], [X1 - T, SHY[i] + SH * 0.5, ZFI], SOFT);
    }
    b.box([X0, TOP - 0.05, ZB], [X1, TOP, ZF], SIL);

    // back panel + three vertical seams
    b.quad([X0 + T, 0.10, ZB + 0.02], [X1 - T, 0.10, ZB + 0.02], [X1 - T, TOP - 0.05, ZB + 0.02], [X0 + T, TOP - 0.05, ZB + 0.02],
      style(FACE3, { bias: -0.04 }));
    for (const sx of [1.06, 1.55, 2.04]) b.line([sx, 0.13, ZB + 0.03], [sx, TOP - 0.08, ZB + 0.03], SOFT);

    // face frame: two stiles and two rails
    const face = style(FACE2, { stroke: 'ink', width: 1.2, bias: 0.05 });
    b.quad([X0, 0.10, FFZ], [X0 + 0.07, 0.10, FFZ], [X0 + 0.07, TOP, FFZ], [X0, TOP, FFZ], face);
    b.quad([X1 - 0.07, 0.10, FFZ], [X1, 0.10, FFZ], [X1, TOP, FFZ], [X1 - 0.07, TOP, FFZ], face);
    b.quad([X0 + 0.07, TOP - 0.09, FFZ], [X1 - 0.07, TOP - 0.09, FFZ], [X1 - 0.07, TOP, FFZ], [X0 + 0.07, TOP, FFZ], face);
    b.quad([X0 + 0.07, 0.10, FFZ], [X1 - 0.07, 0.10, FFZ], [X1 - 0.07, 0.19, FFZ], [X0 + 0.07, 0.19, FFZ], face);
    b.line([X0 + 0.07, 0.10, FFZ], [X0 + 0.07, TOP, FFZ], SOFT);
    b.line([X1 - 0.07, 0.10, FFZ], [X1 - 0.07, TOP, FFZ], SOFT);

    // contact shadow in front of the plinth
    floorQuad(b, X0 + T, ZF - 0.10, X1 - T, ZF + 0.17, 0.004, H_MID);

    /* ---------------------------------------------------------- the books */

    const bases = [BASE, SHY[0] + SH, SHY[1] + SH, SHY[2] + SH, SHY[3] + SH];
    const spineZ = ZFI + 0.006;

    /** one book: origin = base centre of the spine plane, body runs to -z */
    function bookBody(bb, w, h, d) {
      const x0 = -w / 2, x1 = w / 2;
      const v = (rng() * 5) | 0;
      const spine = v === 0 ? style(FACE3, { width: 0.9 })
        : v === 1 ? style(FACE2S, { width: 0.85 })
          : v === 3 ? style(STRUCT, { width: 0.9 })
            : style({ fill: 'face1', stroke: 'inkMid', width: 0.85 });
      bb.quad([x0, 0, 0], [x1, 0, 0], [x1, h, 0], [x0, h, 0], spine);
      bb.quad([x0, h, -d], [x1, h, -d], [x1, h, 0], [x0, h, 0], style(FACE2S, { width: 0.75 }));
      bb.quad([x1, 0, -d], [x1, 0, 0], [x1, h, 0], [x1, h, -d], style(FACE2S, { width: 0.7 }));
      const iw = Math.max(0.008, w - 0.006);
      if (v === 0 || v === 1) {
        const n = v === 0 ? 2 : 3;
        for (let k = 0; k < n; k++) {
          const y = h * (0.66 + k * 0.12);
          bb.line([-iw / 2, y, 0.0015], [iw / 2, y, 0.0015], SOFT);
        }
      } else if (v === 2) {
        bb.line([0, h * 0.12, 0.0015], [0, h * 0.88, 0.0015], MID);
      } else if (v === 3) {
        bb.quad([-iw * 0.3, h * 0.68, 0.0015], [iw * 0.3, h * 0.68, 0.0015],
          [iw * 0.3, h * 0.80, 0.0015], [-iw * 0.3, h * 0.80, 0.0015], style(SOFT, { stroke: 'inkMid' }));
        bb.line([-iw / 2, h * 0.5, 0.0015], [iw / 2, h * 0.5, 0.0015], SOFT);
      } else {
        bb.push();
        bb.translate(-w * 0.22, h * 0.16, 0.002);
        bb.rotateZ(Math.PI / 2);
        bb.text(SPINE_TITLES[(rng() * SPINE_TITLES.length) | 0], {
          size: Math.max(0.009, w * 0.4), align: 'left', baseline: 'bottom',
          plane: 'xy', style: SOFT,
        });
        bb.pop();
      }
    }

    /** a pullable book on its own spring (its own node) */
    function pullableBook(id, x, base, w, h, d, lean) {
      const p = obj.part(id, { label: '书', hint: '抽出 / 推回' });
      const bx = x + w / 2;
      p.setPos(bx, base, spineZ);
      const pb = p.builder;
      pb.push(); pb.rotateZ(lean); bookBody(pb, w, h, d); pb.pop();
      const sp = new Spring(0, 120, 13);
      let out = false;
      bindClick(p, () => {
        out = !out;
        sp.to(out ? 0.14 : 0);
        sfx('page');
      });
      onTick((dt) => {
        sp.step(dt);
        const e = sp.value + 0.004 * p.hoverT;       // hover leans it out 4 mm
        const k = clamp(Math.abs(sp.value) / 0.14, 0, 1);
        p.setPos(bx, base, spineZ + e);
        p.setRot(0, 0, lean + 0.122 * k);
      });
      return p;
    }

    /** a run of standing books; returns the next free x */
    function bookRun(x, base, count, maxH, opts) {
      const o = opts || {};
      let cx = x;
      for (let i = 0; i < count; i++) {
        const w = rand(0.021, 0.05);
        const h = Math.min(maxH, rand(0.155, 0.26));
        const d = rand(0.13, 0.195);
        const lean = rng() < 0.16 ? rand(-0.07, 0.07) : 0;
        if (o.pull && i === o.pull.index) {
          pullableBook('book-' + o.pull.id, cx, base, w, h, d, lean);
        } else if (lean !== 0) {
          b.push(); b.translate(cx + w / 2, base, spineZ); b.rotateZ(lean); bookBody(b, w, h, d); b.pop();
        } else {
          b.at(cx + w / 2, base, spineZ, (bb) => bookBody(bb, w, h, d));
        }
        cx += w + rand(0.001, 0.005);
      }
      return cx;
    }

    /** two or three books lying flat */
    function flatStack(x, base, n) {
      let y = base + 0.001;
      for (let i = 0; i < n; i++) {
        const w = rand(0.15, 0.2), d = rand(0.11, 0.15), t = rand(0.012, 0.022);
        const bx = x + rand(-0.008, 0.008);
        b.quad([bx - w / 2, y + t, ZFI - d], [bx + w / 2, y + t, ZFI - d],
          [bx + w / 2, y + t, ZFI], [bx - w / 2, y + t, ZFI], style(FACE2S, { width: 0.85 }));
        b.quad([bx - w / 2, y, ZFI], [bx + w / 2, y, ZFI], [bx + w / 2, y + t, ZFI], [bx - w / 2, y + t, ZFI],
          style(i % 2 ? FACE3 : FACE2, { width: 0.9 }));
        b.line([bx - w / 2, y + t * 0.5, ZFI - d], [bx + w / 2, y + t * 0.5, ZFI - d], SOFT);
        y += t + 0.001;
      }
      return y;
    }

    /** a short row of magazines standing on one shelf */
    function magazines(x, base) {
      for (let i = 0; i < 6; i++) {
        const t = 0.007, h = rand(0.15, 0.19);
        const mx = x + i * (t + 0.004);
        b.quad([mx, base, spineZ], [mx + t, base, spineZ], [mx + t, base + h, spineZ], [mx, base + h, spineZ],
          style(i % 2 ? FACE2S : FACE3, { width: 0.8 }));
        if (i % 3 === 0) b.line([mx + 0.001, base + h * 0.7, spineZ + 0.002], [mx + t, base + h * 0.7, spineZ + 0.002], SOFT);
      }
    }

    function smallVase(vx, vy) {
      const r = 0.036, h = 0.145;
      b.push(); b.translate(vx, vy, ZFI - 0.085);
      circleY(b, 0, h, 0, r * 0.6, 10, SOFT);
      circleY(b, 0, 0.004, 0, r, 10, SOFT);
      b.quad([-r * 0.55, h, 0], [r * 0.55, h, 0], [r, 0.02, 0], [-r, 0.02, 0],
        style({ fill: 'face1', stroke: 'none', width: 0 }));
      b.line([-r * 0.55, h, 0], [-r, 0.02, 0], MID);
      b.line([r * 0.55, h, 0], [r, 0.02, 0], MID);
      b.pop();
    }

    function tinyClock(kx, ky) {
      b.push(); b.translate(kx, ky, ZFI - 0.07);
      b.quad([-0.042, 0, -0.01], [0.042, 0, -0.01], [0.03, 0.03, -0.01], [-0.03, 0.03, -0.01], style(FACE2, { width: 0.8 }));
      circleZ(b, 0, 0.085, 0, 0.038, 14, MID);
      circleZ(b, 0, 0.085, 0, 0.031, 14, SOFT);
      b.line([0, 0.085, 0.002], [0, 0.108, 0.002], INK);
      b.line([0, 0.085, 0.002], [0.015, 0.078, 0.002], SOFT);
      b.pop();
    }

    // C5 — top shelf: short books, a vase and a tiny clock
    let x = bookRun(X0 + 0.12, bases[4], 6, 0.215, { pull: { id: 'c5', index: 2 } });
    smallVase(x + 0.07, bases[4]);
    x = bookRun(x + 0.15, bases[4], 4, 0.22);
    tinyClock(x + 0.10, bases[4]);
    bookRun(x + 0.20, bases[4], 3, 0.2);

    // C4 — a long run, a flat stack and the magazines
    x = bookRun(X0 + 0.08, bases[3], 15, 0.30, { pull: { id: 'c4', index: 6 } });
    x = flatStack(x + 0.13, bases[3], 3) * 0 + x + 0.20;
    magazines(x + 0.20, bases[3]);
    bookRun(x + 0.44, bases[3], 3, 0.29);

    // C3 — a long run followed by the bookend + leaning row
    x = bookRun(X0 + 0.08, bases[2], 15, 0.30, { pull: { id: 'c3', index: 4 } });
    partBookend(obj, onTick, x + 0.06, bases[2], ZFI);

    // C1 / C2 — the right hand bays stay visible beside the record cabinet
    bookRun(1.90, bases[1], 6, 0.30, { pull: { id: 'c2', index: 1 } });
    x = bookRun(1.88, bases[0], 5, 0.28);
    flatStack(x + 0.14, bases[0], 2);
  }

  /* ------------------------------------------------------------- sideboard */

  function buildSideboard() {
    const obj = object({ id: 'sideboard', label: '矮柜' });
    const b = obj.builder;
    const onTick = ticker(obj);

    // The cabinet stands directly in front of the bookcase (its own 0.34 m of
    // depth would otherwise be buried inside the bookcase volume) so that the
    // turntable has a real 0.42 m deep top to sit on.
    const X0 = 0.62, X1 = 1.92;
    const ZB = -2.18, ZF = -1.76;

    b.box([X0 + 0.03, 0, ZB + 0.03], [X1 - 0.03, 0.06, ZF - 0.03], FACE2);          // plinth
    // carcass with an OPEN front, otherwise the front slab would hide the doors
    b.boxOpen([X0, 0.06, ZB], [X1, 0.70, ZF - 0.02], SIL, ['pz']);
    b.box([X0 - 0.015, 0.70, ZB - 0.015], [X1 + 0.015, 0.74, ZF + 0.015], STRUCT);  // top
    b.quad([X0 - 0.015, 0.70, ZF + 0.015], [X1 + 0.015, 0.70, ZF + 0.015],
      [X1 + 0.015, 0.74, ZF - 0.006], [X0 - 0.015, 0.74, ZF - 0.006],
      style(FACE2, { width: 1.1, bias: 0.02 }));                                    // bullnose
    b.line([X0 - 0.015, 0.716, ZF + 0.008], [X1 + 0.015, 0.716, ZF + 0.008], SOFT);

    floorQuad(b, X0 - 0.01, ZF - 0.02, X1 + 0.01, ZF + 0.16, 0.006, H_MID);

    // dark interior lining, seen once a door swings (sits behind the doors)
    b.quad([X0 + 0.01, 0.07, ZB + 0.012], [X1 - 0.01, 0.07, ZB + 0.012],
      [X1 - 0.01, 0.69, ZB + 0.012], [X0 + 0.01, 0.69, ZB + 0.012], style(FACE3, { width: 0.9, bias: -0.02 }));
    b.line([X0 + 0.01, 0.38, ZB + 0.014], [X1 - 0.01, 0.38, ZB + 0.014], SOFT);

    // interior: a shelf, a row of records and a small box
    const IX0 = X0 + 0.05, IX1 = X1 - 0.05;
    b.boxOpen([IX0, 0.30, ZB + 0.03], [IX1, 0.328, ZF - 0.05], FACE2S, ['ny']);
    b.line([IX0, 0.314, ZF - 0.05], [IX1, 0.314, ZF - 0.05], SOFT);
    for (let i = 0; i < 8; i++) {
      const rx = IX0 + 0.05 + i * 0.02;
      b.quad([rx, 0.06, ZF - 0.13], [rx + 0.013, 0.06, ZF - 0.13], [rx + 0.013, 0.28, ZF - 0.13], [rx, 0.28, ZF - 0.13],
        style(i % 2 ? FACE2S : FACE3, { width: 0.75 }));
      b.line([rx + 0.006, 0.18, ZF - 0.128], [rx + 0.006, 0.28, ZF - 0.128], SOFT);
    }
    b.box([1.42, 0.328, ZB + 0.12], [1.68, 0.46, ZF - 0.16], FACE2);
    b.line([1.42, 0.39, ZF - 0.158], [1.68, 0.39, ZF - 0.158], SOFT);

    /* two doors, each hinged on its outer stile */
    function door(id, hingeX, dir) {
      const W = 0.60, H = 0.55, YB = 0.09;
      const p = obj.part(id, { label: '柜门', hint: '开 / 关' });
      p.setPos(hingeX, YB, ZF);               // the leaf sits proud of the carcass
      const db = p.builder;
      db.push();
      db.translate(dir > 0 ? -W : 0, 0, 0);   // raw coordinates stay positive
      const x0 = 0, x1 = W, y0 = 0, y1 = H;
      db.quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], style(FACE2, { width: 1.35 }));
      db.quad([x0, y0, -0.018], [x1, y0, -0.018], [x1, y1, -0.018], [x0, y1, -0.018], FACE3);
      db.quad([x0 + 0.05, y0 + 0.05, 0.0015], [x1 - 0.05, y0 + 0.05, 0.0015],
        [x1 - 0.05, y1 - 0.05, 0.0015], [x0 + 0.05, y1 - 0.05, 0.0015],
        style({ fill: 'face1', stroke: 'inkSoft', width: 0.8, bias: 0.02 }));
      db.line([x0, y1 - 0.055, 0.002], [x1, y1 - 0.055, 0.002], SOFT);
      const kx = dir > 0 ? x0 + 0.06 : x1 - 0.06;
      circleZ(db, kx, H * 0.5, 0.014, 0.019, 12, MID);
      circleZ(db, kx, H * 0.5, 0.014, 0.010, 10, SOFT);
      db.pop();
      const sp = new Spring(0, 90, 12);
      let open = false;
      bindClick(p, () => {
        open = !open;
        // +dir swings the leaf out into the room on either jamb
        sp.to(open ? dir * 1.745 : 0);        // ~100 degrees
        sfx('cabinet');
      });
      onTick((dt) => {
        sp.step(dt);
        p.setRot(0, sp.value, 0);
      });
      return p;
    }
    door('door-left', X0 + 0.035, -1);
    door('door-right', X1 - 0.035, 1);
  }

  /* ------------------------------------------------------------- turntable */

  function buildTurntable() {
    const obj = object({ id: 'turntable', label: '唱片机' });
    const b = obj.builder;

    const X0 = 0.74, X1 = 1.80, ZB = -2.12, ZF = -1.81;
    const DECK = 0.845;
    const PLX = 1.00, PLZ = -1.965;
    const ARMX = 1.60, ARMZ = -2.055;
    const ANG_REST = 0.56, ANG_PLAY = 0.175;
    const ARM_LEN = 0.475;

    // four small feet
    for (const f of [[X0 + 0.055, ZB + 0.05], [X1 - 0.055, ZB + 0.05], [X0 + 0.055, ZF - 0.05], [X1 - 0.055, ZF - 0.05]]) {
      taperPost(b, f[0], f[1], 0.74, 0.768, 0.05, 0.036, FACE3);
    }
    // plinth with a chamfer
    b.box([X0, 0.768, ZB], [X1, 0.832, ZF], FACE2);
    b.quad([X0, 0.832, ZF], [X1, 0.832, ZF], [X1 - 0.012, DECK, ZF - 0.012], [X0 + 0.012, DECK, ZF - 0.012], FACE2S);
    b.quad([X0, 0.832, ZB], [X1, 0.832, ZB], [X1 - 0.012, DECK, ZB + 0.012], [X0 + 0.012, DECK, ZB + 0.012], FACE2S);
    b.quad([X0, 0.832, ZF], [X0, 0.832, ZB], [X0 + 0.012, DECK, ZB + 0.012], [X0 + 0.012, DECK, ZF - 0.012], FACE2S);
    b.quad([X1, 0.832, ZF], [X1, 0.832, ZB], [X1 - 0.012, DECK, ZB + 0.012], [X1 - 0.012, DECK, ZF - 0.012], FACE2S);
    b.quad([X0 + 0.012, DECK, ZB + 0.012], [X1 - 0.012, DECK, ZB + 0.012],
      [X1 - 0.012, DECK, ZF - 0.012], [X0 + 0.012, DECK, ZF - 0.012], STRUCT);

    // speaker grille (two crossed hatch layers = a woven field)
    b.polyline([[0.785, 0.778, ZF + 0.004], [1.045, 0.778, ZF + 0.004],
      [1.045, 0.826, ZF + 0.004], [0.785, 0.826, ZF + 0.004]], MID, true);
    b.quad([0.788, 0.781, ZF + 0.002], [1.042, 0.781, ZF + 0.002], [1.042, 0.823, ZF + 0.002], [0.788, 0.823, ZF + 0.002],
      style(H_WEAVE_A, { bias: 0.02 }));
    b.quad([0.788, 0.781, ZF + 0.003], [1.042, 0.781, ZF + 0.003], [1.042, 0.823, ZF + 0.003], [0.788, 0.823, ZF + 0.003],
      style(H_WEAVE_B, { bias: 0.03 }));

    /* ---- platter (own node — spins) ---------------------------------- */
    const platter = obj.node('platter');
    platter.setPos(PLX, 0, PLZ);
    const pb = platter.builder;
    pb.disc(0, 0.846, 0, 0.148, STRUCT, { segments: 26, axis: 'y' });
    pb.disc(0, 0.851, 0, 0.138, FACE3, { segments: 24, axis: 'y' });
    circleY(pb, 0, 0.852, 0, 0.148, 26, MID);
    for (let i = 0; i < 40; i++) {                          // strobe ring
      const a = (i / 40) * TAU;
      const cx = Math.cos(a) * 0.128, cz = Math.sin(a) * 0.128;
      const tx = -Math.sin(a) * 0.006, tz = Math.cos(a) * 0.006;
      const nx = Math.cos(a) * 0.004, nz = Math.sin(a) * 0.004;
      pb.quad([cx - tx - nx, 0.853, cz - tz - nz], [cx + tx - nx, 0.853, cz + tz - nz],
        [cx + tx + nx, 0.853, cz + tz + nz], [cx - tx + nx, 0.853, cz - tz + nz],
        style({ stroke: 'inkMid', fill: 'none', width: 0.7 }));
    }

    /* ---- record (own node — spins with the platter) ------------------ */
    const record = obj.node('record');
    record.setPos(PLX, 0, PLZ);
    const rb = record.builder;
    rb.push(); rb.translate(0, 0.856, 0);
    rb.disc(0, 0, 0, 0.146, DARK, { segments: 30, axis: 'y' });
    for (const r of [0.056, 0.076, 0.096, 0.116, 0.133]) circleY(rb, 0, 0.0008, 0, r, 30, SOFT);
    rb.disc(0, 0.0016, 0, 0.045, style(FACE2, { stroke: 'ink', width: 0.85 }), { segments: 22, axis: 'y' });
    for (const r of [0.017, 0.028, 0.038]) circleY(rb, 0, 0.0022, 0, r, 20, SOFT);
    rb.push();
    rb.translate(0.026, 0.003, 0.014);
    rb.rotateY(-Math.PI / 2);
    rb.text('33', { size: 0.011, align: 'left', baseline: 'middle', plane: 'yz', style: SOFT });
    rb.pop();
    rb.line([-0.030, 0.003, 0.030], [-0.006, 0.003, 0.030], SOFT);
    rb.line([-0.030, 0.003, 0.038], [-0.010, 0.003, 0.038], SOFT);
    rb.pop();

    /* ---- speed selector ---------------------------------------------- */
    b.disc(1.72, DECK + 0.004, -1.865, 0.028, STRUCT, { segments: 14, axis: 'y' });
    b.disc(1.72, DECK + 0.006, -1.865, 0.019, FACE3, { segments: 12, axis: 'y' });
    b.line([1.72, DECK + 0.007, -1.865], [1.72, DECK + 0.007, -1.892], INK);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      b.line([1.72 + Math.cos(a) * 0.030, DECK + 0.005, -1.865 + Math.sin(a) * 0.030],
        [1.72 + Math.cos(a) * 0.037, DECK + 0.005, -1.865 + Math.sin(a) * 0.037], SOFT);
    }

    /* ---- power switch (interactive) ---------------------------------- */
    const pwr = obj.part('power', { label: '唱片机', hint: '播放 / 停止' });
    const pw = pwr.builder;
    pw.quad([0.79, DECK + 0.002, -1.90], [0.87, DECK + 0.002, -1.90], [0.87, DECK + 0.002, -1.855], [0.79, DECK + 0.002, -1.855],
      style(FACE3, { width: 0.9 }));
    pw.quad([0.805, DECK + 0.006, -1.898], [0.833, DECK + 0.006, -1.898], [0.833, DECK + 0.006, -1.877], [0.805, DECK + 0.006, -1.877],
      style({ fill: 'face2', stroke: 'ink', width: 1.0 }));
    pw.push();
    pw.translate(0.885, DECK + 0.004, -1.878);
    pw.text('POWER', { size: 0.014, align: 'left', baseline: 'middle', plane: 'xz', style: SOFT });
    pw.pop();
    // the switch: toggles the global state, the loop below does the rest
    bindClick(pwr, () => {
      sset('vinylPlaying', !sget('vinylPlaying'));
      sfx('click');
    });

    /* ---- tonearm (own node) ------------------------------------------ */
    const arm = obj.node('tonearm');
    arm.setPos(ARMX, 0, ARMZ);
    const ab = arm.builder;
    const AX = 0.60;                 // raw-coordinate offset: the arm reaches
                                     // 0.54 m in -x, so it is authored shifted
    const HL = AX - ARM_LEN;         // end of the arm tube
    ab.push();
    ab.translate(0, DECK, 0);
    ab.translate(-AX, 0, 0);
    // pivot housing
    ab.quad([AX - 0.024, 0.006, 0.024], [AX + 0.024, 0.006, 0.024], [AX + 0.020, 0.046, 0.020], [AX - 0.020, 0.046, 0.020], STRUCT);
    ab.quad([AX - 0.024, 0.006, -0.024], [AX + 0.024, 0.006, -0.024], [AX + 0.020, 0.046, -0.020], [AX - 0.020, 0.046, -0.020], FACE2S);
    ab.quad([AX + 0.024, 0.006, -0.024], [AX + 0.024, 0.006, 0.024], [AX + 0.020, 0.046, 0.020], [AX + 0.020, 0.046, -0.020], FACE2);
    ab.quad([AX - 0.024, 0.006, -0.024], [AX - 0.024, 0.006, 0.024], [AX - 0.020, 0.046, 0.020], [AX - 0.020, 0.046, -0.020], FACE2S);
    ab.disc(AX, 0.046, 0, 0.020, FACE3, { segments: 10, axis: 'y' });
    // counterweight behind the pivot
    ab.quad([AX + 0.030, 0.016, -0.020], [AX + 0.078, 0.016, -0.020], [AX + 0.078, 0.040, -0.020], [AX + 0.030, 0.040, -0.020], FACE3);
    ab.quad([AX + 0.030, 0.016, 0.020], [AX + 0.078, 0.016, 0.020], [AX + 0.078, 0.040, 0.020], [AX + 0.030, 0.040, 0.020], FACE3);
    ab.quad([AX + 0.078, 0.016, -0.020], [AX + 0.078, 0.016, 0.020], [AX + 0.078, 0.040, 0.020], [AX + 0.078, 0.040, -0.020], MID);
    ab.line([AX + 0.030, 0.028, 0.021], [AX + 0.078, 0.028, 0.021], SOFT);
    // arm tube, headshell, stylus
    ab.quad([AX, 0.026, -0.007], [HL, 0.023, -0.007], [HL, 0.023, 0.007], [AX, 0.026, 0.007],
      style({ fill: 'face1', stroke: 'ink', width: 1.0 }));
    ab.quad([AX, 0.030, -0.004], [HL, 0.027, -0.004], [HL, 0.027, 0.004], [AX, 0.030, 0.004], SOFT);
    ab.quad([HL + 0.02, 0.014, -0.013], [HL - 0.05, 0.014, -0.013],
      [HL - 0.05, 0.032, 0.004], [HL + 0.02, 0.032, 0.004],
      style(FACE2, { width: 1.1 }));
    ab.quad([HL - 0.05, 0.014, -0.013], [HL - 0.05, 0.032, 0.004],
      [HL - 0.062, 0.032, 0.008], [HL - 0.062, 0.014, -0.006], FACE2S);
    ab.line([HL - 0.062, 0.014, 0.006], [HL - 0.058, 0.000, 0.004], INK);
    ab.pop();
    arm.setRot(0, ANG_REST, 0);

    // arm rest post (static)
    const restX = ARMX - Math.cos(ANG_REST) * ARM_LEN;
    const restZ = ARMZ + Math.sin(ANG_REST) * ARM_LEN;
    b.quad([restX - 0.012, DECK + 0.014, restZ - 0.012], [restX + 0.012, DECK + 0.014, restZ - 0.012],
      [restX + 0.012, DECK + 0.014, restZ + 0.012], [restX - 0.012, DECK + 0.014, restZ + 0.012], FACE3);
    circleY(b, restX, DECK + 0.014, restZ, 0.014, 8, SOFT);

    /* ---- dust cover (interactive) ------------------------------------ */
    const cover = obj.part('cover', { label: '防尘盖', hint: '掀开 / 合上' });
    const HX = X0, HZ = ZB, HY = DECK + 0.010;
    cover.setPos(HX, HY, HZ);
    const cb = cover.builder;
    const CW = X1 - X0, CD = ZF - ZB, CT = 0.086;
    // the lid rides above the platter, so it is biased in front of it
    const lidb = (base, extra) => style(base, Object.assign({ bias: 0.30 }, extra || {}));
    cb.quad([0, CT, 0], [CW, CT, 0], [CW, CT, CD], [0, CT, CD], lidb(GLASS));           // glass top
    cb.polyline([[0, CT, 0], [CW, CT, 0], [CW, CT, CD], [0, CT, CD]], lidb(MID), true);
    cb.polyline([[0, 0, CD], [CW, 0, CD], [CW, CT, CD], [0, CT, CD]], lidb(SOFT), true);
    cb.quad([0, 0, CD], [CW, 0, CD], [CW, CT, CD], [0, CT, CD], lidb(FACE2S, { width: 0.7, alpha: 0.9 }));
    cb.line([0, 0, 0], [0, CT, 0], lidb(SOFT));
    cb.line([CW, 0, 0], [CW, CT, 0], lidb(SOFT));
    cb.line([0, 0, 0], [CW, 0, 0], lidb(SOFT));
    // two hinge barrels on the back edge
    for (const hx of [0.06, CW - 0.06]) {
      cb.push();
      cb.translate(hx, 0.008, 0);
      cb.rotateZ(Math.PI / 2);
      cb.quad([-0.012, -0.010, -0.010], [0.012, -0.010, -0.010], [0.012, 0.010, 0.010], [-0.012, 0.010, 0.010], lidb(FACE3));
      cb.quad([-0.012, -0.010, 0.010], [0.012, -0.010, 0.010], [0.012, 0.010, 0.010], [-0.012, 0.010, 0.010], lidb(FACE3));
      cb.pop();
    }

    const coverSpring = new Spring(0, 70, 9.5);
    let coverOpen = false;
    bindClick(cover, () => {
      coverOpen = !coverOpen;
      coverSpring.to(coverOpen ? -1.222 : 0);   // ~70 degrees
      sfx('thud');
    });

    /* ---- the record player's frame loop ------------------------------ */
    const tp = {
      spd: 0, ang: 0, ramp: 0, playing: false,
      armA: ANG_REST, armFrom: ANG_REST, armGo: ANG_REST, armT: 1,
      loopT: -1, dropT: -1, loopDone: true, dropDone: true,
    };
    obj.onUpdate((dt, now) => {
      frameNow = now;
      const playing = !!sget('vinylPlaying');
      if (playing !== tp.playing) {
        tp.playing = playing;
        if (playing) {
          tp.loopT = 0.6;                    // music joins in after 0.6 s
          tp.dropT = 1.35;                   // the stylus lands at the end of the swing
          tp.loopDone = false;
          tp.dropDone = false;
        } else {
          tp.loopT = -1; tp.dropT = -1;
          tp.loopDone = true; tp.dropDone = true;
          loop('music', false);
          loop('vinyl', false);
        }
      }
      if (tp.loopT > 0) {
        tp.loopT -= dt;
        if (tp.loopT <= 0 && !tp.loopDone) {
          tp.loopDone = true;
          loop('music', true);
          loop('vinyl', true, { intensity: 0.55 });
        }
      }
      if (tp.dropT > 0) {
        tp.dropT -= dt;
        if (tp.dropT <= 0 && !tp.dropDone) { tp.dropDone = true; sfx('vinylDrop'); }
      }
      tp.ramp = clamp(tp.ramp + (playing ? dt / 1.2 : -dt / 2.5), 0, 1);
      const target = 3.4907;                       // 33 1/3 rpm
      tp.spd = playing ? target * ease.cubicOut(tp.ramp)
        : target * (1 - ease.cubicOut(1 - tp.ramp));
      tp.ang = (tp.ang + tp.spd * dt) % TAU;
      platter.setRot(0, tp.ang, 0);
      record.setRot(0, tp.ang, 0);

      // the tonearm swings on ease.sineInOut over ~1.4 s and rides a small arc
      const armWant = playing ? ANG_PLAY : ANG_REST;
      if (armWant !== tp.armGo) { tp.armFrom = tp.armA; tp.armGo = armWant; tp.armT = 0; }
      if (tp.armT < 1) tp.armT = Math.min(1, tp.armT + dt / 1.4);
      tp.armA = tp.armFrom + (tp.armGo - tp.armFrom) * ease.sineInOut(tp.armT);
      const lift = Math.sin(tp.armT * Math.PI) * 0.012 + (playing ? -0.004 : 0);
      arm.setRot(0, tp.armA, 0);
      arm.setPos(ARMX, lift, ARMZ);

      coverSpring.step(dt);
      cover.setRot(coverSpring.value, 0, 0);
      cover.setPos(HX, HY + 0.003 * cover.hoverT, HZ);
    });
  }

  /* ------------------------------------------------------------------ rug */

  function buildRug() {
    const obj = object({ id: 'rug', label: '地毯' });
    const b = obj.builder;
    const onTick = ticker(obj);

    // LEAD EDIT: slide the rug forward so it lies under the reseated sofa (which
    // now sits at z 0.44..1.45) and the coffee table in front of it.
    obj.setPos(0, 0, 0.68);

    // The 3.5 m width is laid down from the left-hand boundary of this module's
    // region (x = -0.45) so that no primitive ever leaves the owned area.
    // Z0..Z1 is the OVERALL footprint (3.5 x 2.6 m, fringe included); the woven
    // body stops 0.08 m short on the two fringed edges.
    const X0 = -0.45, X1 = 3.05, Z0 = -0.68, Z1 = 1.92, Y = 0.012;
    const FR = 0.08;                                  // fringe projection
    const FZ0 = Z0 + FR, FZ1 = Z1 - FR;               // woven body edges
    const R = 0.34, FAR = 0.50;
    const Mx = X0 + FAR / 2, Mz = FZ0 + FAR / 2;      // corner fold midpoint
    const tilt = Math.PI / 4;

    function wob(p) {
      return [
        clamp(p[0] + rand(-0.008, 0.008), X0, X1),
        clamp(p[1] + rand(-0.008, 0.008), FZ0, FZ1),
      ];
    }
    function arc(cx, cz, a0, a1, seg) {
      const out = [];
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (a1 - a0) * (i / seg);
        out.push(wob([cx + Math.cos(a) * R, cz + Math.sin(a) * R]));
      }
      return out;
    }
    const A = [X0 + FAR, FZ0];                // fold point on the back edge
    const Bp = [X0, FZ0 + FAR];               // fold point on the left edge

    const p = obj.part('rug', { label: '地毯', hint: '掀角' });
    const pb = p.builder;

    // field outline (the folded corner is cut away and lives in its own node)
    const field = [A, wob([X1 - R, FZ0])];
    field.push(...arc(X1 - R, FZ0 + R, -Math.PI / 2, 0, 4));
    field.push(wob([X1, FZ1 - R]));
    field.push(...arc(X1 - R, FZ1 - R, 0, Math.PI / 2, 4));
    field.push(wob([X0 + R, FZ1]));
    field.push(...arc(X0 + R, FZ1 - R, Math.PI / 2, Math.PI, 4));
    field.push(wob([X0, FZ0 + FAR]));
    pb.poly(field.map((q) => [q[0], Y, q[1]]), SIL);

    // the outer double border is the strongest element of the rug
    const bor1 = roundRectPts(X0 + 0.09, FZ0 + 0.09, X1 - 0.09, FZ1 - 0.09, R * 0.8, 4);
    const bor2 = roundRectPts(X0 + 0.16, FZ0 + 0.16, X1 - 0.16, FZ1 - 0.16, R * 0.72, 4);
    pb.polyline(bor1.map((q) => [q[0], Y + 0.002, q[1]]), style({ stroke: 'ink', width: 1.35 }), true);
    pb.polyline(bor2.map((q) => [q[0], Y + 0.002, q[1]]), style({ stroke: 'inkSoft', width: 0.8, alpha: 0.5 }), true);

    // quiet field: two crossed diagonal hatch layers, a faint twill and only a
    // few concentric bands — the rug should sit under the sofa, not shout
    const faint = style({ stroke: 'inkSoft', width: 0.7, alpha: 0.2 });
    const inner = roundRectPts(X0 + 0.22, FZ0 + 0.22, X1 - 0.22, FZ1 - 0.22, R * 0.66, 4);
    const innerQ = inner.map((q) => [q[0], Y + 0.001, q[1]]);
    pb.poly(innerQ, style(H_WEAVE_A, { fill: 'none' }));
    pb.poly(innerQ, style(H_WEAVE_B, { fill: 'none' }));
    const ix0 = X0 + 0.24, ix1 = X1 - 0.24, iz0 = FZ0 + 0.24, iz1 = FZ1 - 0.24;
    for (let i = 0; i < 7; i++) {                      // diagonal twill
      const c = iz0 + ix0 + (i / 6) * ((iz1 + ix1) - (iz0 + ix0));
      const xa = Math.max(ix0, c - iz1), xb = Math.min(ix1, c - iz0);
      if (xb - xa > 0.15) pb.line([xa, Y + 0.0015, c - xa], [xb, Y + 0.0015, c - xb], faint);
    }
    for (let i = 0; i < 3; i++) {                      // a few concentric bands
      const m = 0.42 + i * 0.36;
      const rr = roundRectPts(X0 + m, FZ0 + m, X1 - m, FZ1 - m, Math.max(0.06, R - m * 0.45), 3);
      pb.polyline(rr.map((q) => [q[0], Y + 0.0015, q[1]]), faint, true);
    }
    // scattered diamonds
    for (let i = 0; i < 5; i++) {
      const dx = rand(X0 + 0.7, X1 - 0.7), dz = rand(FZ0 + 0.4, FZ1 - 0.4);
      const s = rand(0.05, 0.1);
      pb.quad([dx, Y + 0.002, dz - s], [dx + s, Y + 0.002, dz], [dx, Y + 0.002, dz + s], [dx - s, Y + 0.002, dz],
        style({ fill: 'face2', stroke: 'inkSoft', width: 0.7, alpha: 0.45 }));
    }

    // fringe along the two long edges (own nodes so hover can flatten it);
    // the strokes stop exactly on the overall footprint edge
    function fringeNode(zEdge, dir) {
      const n = p.node('fringe' + (dir > 0 ? 'F' : 'B'));
      const fb = n.builder;
      fb.push();
      fb.translate(0, 0, zEdge);
      for (let i = 0; i < 20; i++) {
        const fx = X0 + 0.10 + i * ((X1 - X0 - 0.20) / 19) + rand(-0.01, 0.01);
        fb.line([fx, 0.010, 0], [fx + rand(-0.004, 0.004), 0.004, dir * rand(0.045, FR)],
          style({ stroke: 'inkSoft', width: 0.7 }));
      }
      fb.pop();
      return n;
    }
    const frB = fringeNode(FZ0, -1);
    const frF = fringeNode(FZ1, 1);

    // the folded corner: hinged on the diagonal chord of the cut
    const corner = p.node('corner');
    corner.setPos(Mx, Y, Mz);
    const kb = corner.builder;
    kb.push();
    kb.rotateY(-tilt);
    kb.translate(-Mx, 0, -Mz);
    const cpts = [A, wob([X0 + R, FZ0])];
    cpts.push(...arc(X0 + R, FZ0 + R, Math.PI, Math.PI * 1.5, 4));
    cpts.push(wob([X0, FZ0 + FAR]));
    const cq = cpts.map((q) => [q[0], 0, q[1]]);
    kb.poly(cq, SIL);
    kb.polyline(cq.map((q) => [q[0], 0.001, q[2]]), SOFT, true);
    kb.pop();

    const flip = new Spring(0, 55, 7.5);
    let phase = 0, tPhase = 0;
    bindClick(p, () => {
      phase = 1; tPhase = 0;
      flip.set(0);
      sfx('cushion');
    }, true);
    onTick((dt) => {
      if (phase === 1) {
        tPhase += dt;
        const u = clamp(tPhase / 0.55, 0, 1);
        flip.value = 0.611 * ease.backOut(u);       // 35 degrees
        flip.vel = 0;
        if (u >= 1) { phase = 2; tPhase = 0; }
      } else if (phase === 2) {
        tPhase += dt;
        if (tPhase > 0.35) { phase = 3; tPhase = 0; flip.value = 0.611; flip.vel = 0; flip.target = 0; }
      } else if (phase === 3) {
        flip.step(dt);
        if (Math.abs(flip.value) < 0.02 && Math.abs(flip.vel) < 0.3) {
          flip.set(0); phase = 0; sfx('thud');
        }
      }
      corner.setRot(flip.value, tilt, 0);
      const hv = p.hoverT;
      frB.setRot(-0.10 * hv, 0, 0);
      frF.setRot(0.10 * hv, 0, 0);
    });
  }

  /* ----------------------------------------------------------------- sofa */

  function buildSofa() {
    const obj = object({ id: 'sofa', label: '沙发' });
    const b = obj.builder;
    const onTick = ticker(obj);

    // LEAD EDIT (composition): the sofa was authored facing -z, i.e. away from
    // the default camera, so the whole seating face was never visible. Rotating
    // it 180 deg about its own centre and sliding it 1.0 m further from the
    // front wall turns it to face the room. The compensating translation keeps
    // the pivot at the sofa's centre: world = R*(p - C) + C.
    obj.setRot(0, Math.PI, 0);
    obj.setPos(2 * 0.55, 0, 2 * 1.92 - 1.05);

    const X0 = -0.45, X1 = 1.60, ZF = 1.49, ZB = 2.35;
    const ARM = 0.32;
    const SEAT = 0.48, BASE0 = 0.14, BASE1 = 0.36, BACK = 1.06;
    const AX0 = X0 + ARM, AX1 = X1 - ARM;

    for (const l of [[X0 + 0.12, ZF + 0.11], [X1 - 0.12, ZF + 0.11], [X0 + 0.12, ZB - 0.11], [X1 - 0.12, ZB - 0.11]]) {
      taperPost(b, l[0], l[1], 0, BASE0, 0.036, 0.052, FACE2);
    }
    b.box([X0 + 0.03, BASE0, ZF + 0.04], [X1 - 0.03, BASE1, ZB - 0.04], STRUCT);
    b.line([X0 + 0.03, BASE1 - 0.012, ZF + 0.041], [X1 - 0.03, BASE1 - 0.012, ZF + 0.041], SOFT);

    // rolled arms: profile swept from the back to the front
    function arm(cx0, cx1) {
      const r = (cx1 - cx0) / 2;
      const mx = cx0 + r, cy = 0.66 - r;
      const prof = [[cx0, BASE1], [cx0, cy]];
      for (let i = 1; i <= 6; i++) {
        const a = Math.PI - (i / 6) * Math.PI;
        prof.push([mx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      prof.push([cx1, cy], [cx1, BASE1]);
      b.poly(prof.map((q) => [q[0], q[1], ZF]), STRUCT);
      for (let i = 0; i < prof.length - 1; i++) {
        const a = prof[i], c = prof[i + 1];
        b.quad([a[0], a[1], ZB], [c[0], c[1], ZB], [c[0], c[1], ZF], [a[0], a[1], ZF],
          (i < 1 || i > prof.length - 3) ? FACE2 : STRUCT);
      }
      b.line([mx, 0.66, ZF], [mx, 0.66, ZB], SOFT);
    }
    arm(X0, X0 + ARM);
    arm(X1 - ARM, X1);

    // back: a panel with a visible frame seam
    b.boxOpen([X0 + 0.03, BASE1, ZB - 0.08], [X1 - 0.03, BACK, ZB], FACE2, ['pz']);
    b.line([AX0 - 0.02, 0.72, ZB - 0.081], [AX1 + 0.02, 0.72, ZB - 0.081], MID);
    b.line([AX0 - 0.02, 0.64, ZB - 0.081], [AX0 - 0.02, 0.98, ZB - 0.081], SOFT);
    b.line([AX1 + 0.02, 0.64, ZB - 0.081], [AX1 + 0.02, 0.98, ZB - 0.081], SOFT);
    for (const sx of [AX0 + (AX1 - AX0) / 3, AX0 + 2 * (AX1 - AX0) / 3]) {
      b.line([sx, BASE1 + 0.02, ZB - 0.081], [sx, 0.72, ZB - 0.081], SOFT);
    }
    b.line([AX0 - 0.02, BASE1 + 0.04, ZB - 0.081], [AX1 + 0.02, BASE1 + 0.04, ZB - 0.081], SOFT);

    const cw = (AX1 - AX0 - 0.02) / 3;
    const spans = [];
    for (let i = 0; i < 3; i++) spans.push([AX0 + i * (cw + 0.01), AX0 + i * (cw + 0.01) + cw]);

    /* three seat cushions — they squash when clicked */
    for (let i = 0; i < 3; i++) {
      const cx = (spans[i][0] + spans[i][1]) / 2, cz = 1.95;
      const p = obj.part('cushion-' + (i + 1), { label: '坐垫', hint: '按一下' });
      p.setPos(cx, BASE1, cz);
      roundedBox(p.builder, -cw / 2 + 0.005, 0, -0.33, cw / 2 - 0.005, 0.12, 0.33, 0.035,
        STRUCT, SOFT, [[-cw / 2 + 0.06, 0.03, -cw / 2 + 0.15, 0.03],
          [cw / 2 - 0.15, 0.03, cw / 2 - 0.06, 0.03], [-0.03, 0.09, 0.03, 0.09]]);
      const sp = new Spring(0, 85, 7.5);
      bindClick(p, () => {
        sp.value = -0.03;                 // press 30 mm
        sp.vel = 0;
        sp.target = 0;                    // recover with overshoot
        sfx('cushion');
      });
      onTick((dt) => {
        sp.step(dt);
        const pr = clamp(-sp.value / 0.03, -0.5, 1.2);
        p.setPos(cx, BASE1 + sp.value, cz);
        p.setScale(1 + 0.10 * pr, 1 - 0.20 * pr, 1 + 0.10 * pr);
      });
    }

    /* three back cushions */
    for (let i = 0; i < 3; i++) {
      const cx = (spans[i][0] + spans[i][1]) / 2;
      b.push();
      b.translate(cx, SEAT + 0.21, ZB - 0.20);
      b.rotateX(0.12);
      b.push(); b.translate(0, -0.21, -0.07);
      roundedBox(b, -cw / 2 + 0.005, 0, 0, cw / 2 - 0.005, 0.42, 0.14, 0.045,
        FACE2, SOFT, [[-0.06, 0.04, 0.06, 0.04]]);
      b.pop();
      b.pop();
    }

    /* three throw pillows — they fluff up when clicked */
    const lay = [[0.10, 0.62, 2.05, -0.22], [1.14, 0.63, 2.05, 0.20], [0.66, 0.60, 1.98, 0.08]];
    for (let i = 0; i < 3; i++) {
      const px = lay[i][0], py = lay[i][1], pz = lay[i][2], pa = lay[i][3];
      const p = obj.part('pillow-' + (i + 1), { label: '抱枕', hint: '拍一下' });
      p.setPos(px, py, pz);
      const bb = p.builder;
      bb.push();
      bb.rotateY(pa);
      bb.push(); bb.translate(0, -0.175, -0.062);
      roundedBox(bb, -0.175, 0, 0, 0.175, 0.35, 0.124, 0.055,
        FACE2, SOFT, [[-0.07, 0.06, 0.07, 0.06], [-0.05, 0.28, 0.05, 0.28]]);
      bb.pop();
      bb.pop();
      const rot = new Spring(0, 42, 5.2);
      const scl = new Spring(1, 90, 8);
      bindClick(p, () => {
        rot.target = rand(-0.19, 0.19);              // a new rest angle each time
        rot.impulse(rand(0.7, 1.3) * (rng() < 0.5 ? -1 : 1));
        scl.value = 1.06;                            // +6 %
        scl.vel = 0;
        scl.target = 1;
        sfx('cushion');
      });
      onTick((dt) => {
        rot.step(dt);
        scl.step(dt);
        const s = clamp(scl.value, 0.94, 1.2);
        p.setRot(0, pa, rot.value);
        p.setScale(s, s, s);
      });
    }

    /* contact shadow + ambient occlusion where the sofa meets the rug */
    floorQuad(b, X0 + 0.001, ZF - 0.15, X1 + 0.02, ZF + 0.05, 0.017, H_SOFT);
    floorQuad(b, X0, ZF + 0.01, X1, ZF + 0.17, 0.018, H_FINE);
  }

  /* ---------------------------------------------------------- coffee table */

  function buildCoffeeTable() {
    const obj = object({ id: 'coffee-table', label: '茶几' });
    const CX = 0.55, CZ = 0.86, TOPY = 0.42, HW = 0.625, HD = 0.31;
    const X0 = CX - HW, X1 = CX + HW, Z0 = CZ - HD, Z1 = CZ + HD;

    // LEAD EDIT (composition): after turning the sofa to face the room, the
    // table has to sit on its open side. Same trick as the sofa: rotate 180 deg
    // about the table's own centre and re-anchor, so `tb.px/tb.pz` keep meaning
    // "world centre of the table" for the drag code below.
    obj.setRot(0, Math.PI, 0);

    const p = obj.part('body', { label: '茶几', hint: '拖动' });
    const b = p.builder;

    // rounded top with a chamfered edge band
    const top = roundRectPts(X0, Z0, X1, Z1, 0.05, 3);
    b.poly(top.map((q) => [q[0], TOPY, q[1]]), SIL);
    const rim = roundRectPts(X0 + 0.014, Z0 + 0.014, X1 - 0.014, Z1 - 0.014, 0.045, 3);
    b.polyline(rim.map((q) => [q[0], TOPY + 0.002, q[1]]), SOFT, true);
    for (let i = 0; i < top.length; i++) {
      const a = top[i], c = top[(i + 1) % top.length];
      b.quad([a[0], TOPY - 0.025, a[1]], [c[0], TOPY - 0.025, c[1]], [c[0], TOPY, c[1]], [a[0], TOPY, a[1]], FACE2);
    }
    b.poly(top.map((q) => [q[0], TOPY - 0.025, q[1]]).reverse(), FACE3);

    // splayed legs with visible through-tenons
    const legs = [[X0 + 0.07, Z0 + 0.06], [X1 - 0.07, Z0 + 0.06], [X0 + 0.07, Z1 - 0.06], [X1 - 0.07, Z1 - 0.06]];
    for (const l of legs) {
      const lx = l[0] + (l[0] < CX ? -0.02 : 0.02);
      const lz = l[1] + (l[1] < CZ ? -0.016 : 0.016);
      taperPost(b, (l[0] + lx) / 2, (l[1] + lz) / 2, 0, TOPY - 0.03, 0.052, 0.036, FACE2);
      b.quad([l[0] - 0.011, TOPY - 0.016, l[1] - 0.011], [l[0] + 0.011, TOPY - 0.016, l[1] - 0.011],
        [l[0] + 0.011, TOPY - 0.006, l[1] + 0.011], [l[0] - 0.011, TOPY - 0.006, l[1] + 0.011], FACE3);
      circleY(b, l[0], TOPY - 0.006, l[1], 0.011, 6, SOFT);
    }
    // lower stretcher shelf
    b.boxOpen([X0 + 0.12, 0.12, Z0 + 0.10], [X1 - 0.12, 0.145, Z1 - 0.10], FACE2, ['ny']);
    b.line([X0 + 0.12, 0.132, Z0 + 0.101], [X1 - 0.12, 0.132, Z0 + 0.101], SOFT);

    // shadow on the rug (travels with the table)
    floorQuad(b, X0 - 0.05, Z0 - 0.05, X1 + 0.05, Z1 + 0.05, 0.016, H_SOFT);

    // two books
    let y = TOPY + 0.001;
    for (let i = 0; i < 2; i++) {
      const w = i ? 0.23 : 0.19, d = i ? 0.16 : 0.14, t = 0.022;
      const bx = CX + (i ? 0.02 : -0.01), bz = CZ - 0.06;
      b.quad([bx - w / 2, y + t, bz - d / 2], [bx + w / 2, y + t, bz - d / 2],
        [bx + w / 2, y + t, bz + d / 2], [bx - w / 2, y + t, bz + d / 2], style(FACE2S, { width: 0.85 }));
      b.quad([bx - w / 2, y, bz + d / 2], [bx + w / 2, y, bz + d / 2], [bx + w / 2, y + t, bz + d / 2], [bx - w / 2, y + t, bz + d / 2],
        style(i ? FACE3 : FACE2, { width: 0.9 }));
      b.line([bx - w / 2, y + t * 0.5, bz - d / 2], [bx + w / 2, y + t * 0.5, bz - d / 2], SOFT);
      y += t + 0.001;
    }
    // coaster + candle
    b.disc(CX + 0.40, TOPY + 0.004, CZ + 0.10, 0.055, style(FACE3, { width: 0.9 }), { segments: 14, axis: 'y' });
    circleY(b, CX + 0.40, TOPY + 0.006, CZ + 0.10, 0.047, 14, SOFT);
    b.push(); b.translate(CX - 0.42, TOPY + 0.002, CZ + 0.12);
    circleY(b, 0, 0.05, 0, 0.026, 10, SOFT);
    circleY(b, 0, 0.002, 0, 0.030, 10, SOFT);
    b.line([-0.030, 0.002, 0], [-0.026, 0.05, 0], MID);
    b.line([0.030, 0.002, 0], [0.026, 0.05, 0], MID);
    b.line([0, 0.05, 0], [0, 0.068, 0], INK);
    b.pop();

    /* the glass sits on the coaster and wobbles */
    const glass = p.node('glass');
    const GX = CX + 0.40, GZ = CZ + 0.10;
    glass.setPos(GX, TOPY + 0.006, GZ);
    const gb = glass.builder;
    circleY(gb, 0, 0.006, 0, 0.040, 14, SOFT);
    circleY(gb, 0, 0.146, 0, 0.043, 14, MID);
    gb.quad([-0.041, 0.006, 0], [0.041, 0.006, 0], [0.043, 0.146, 0], [-0.043, 0.146, 0],
      style({ fill: 'glass', stroke: 'none', alpha: 0.3 }));
    gb.line([-0.040, 0.006, 0], [-0.043, 0.146, 0], SOFT);
    gb.line([0.040, 0.006, 0], [0.043, 0.146, 0], SOFT);
    gb.line([-0.020, 0.020, 0.030], [-0.028, 0.110, 0.030], style({ stroke: 'inkSoft', width: 0.7 }));
    const water = glass.node('water');
    water.setPos(0, 0.062, 0);
    const wb = water.builder;
    wb.disc(0, 0, 0, 0.037, style({ fill: 'glass', stroke: 'inkMid', width: 0.8, alpha: 0.55 }), { segments: 16, axis: 'y' });
    circleY(wb, 0, 0.0008, 0, 0.037, 16, SOFT);

    /* drag with a little friction + click nudge */
    // `tx/tz` and the springs below are the table's WORLD centre; TBL_SHIFT_Z
    // moves it to the sofa's open side (see the note at the top of this builder).
    const TZ0 = CZ + 1.06;
    const tb = {
      tx: CX, tz: TZ0, sx: new Spring(CX, 90, 15), sz: new Spring(TZ0, 90, 15),
      vx: 0, vz: 0, px: CX, pz: TZ0, pvx: 0, pvz: 0, drag: false,
      wx: new Spring(0, 70, 8), wz: new Spring(0, 70, 8),
    };
    const applyDrag = (e) => {
      if (e.phase === 'start') { tb.drag = true; return; }
      if (e.phase === 'end') {
        tb.drag = false;
        tb.sx.set(tb.tx); tb.sz.set(tb.tz);
        tb.sx.vel = clamp(tb.vx, -2.5, 2.5);
        tb.sz.vel = clamp(tb.vz, -2.5, 2.5);
        return;
      }
      // Camera aware mapping: the pointer delta is projected onto the camera's
      // right axis and onto the ground projection of the camera's down axis.
      // A delta of pixel magnitude is scaled by depth / focal-length; a delta
      // that already looks like metres is taken as world units.
      const cam = ctx.camera;
      let brx = 1, brz = 0, bdx = 0, bdz = 1, mpp = 0.008;
      if (cam && cam.eye) {
        const tgt = cam.target || [0, 1.32, 0];
        let fx = tgt[0] - cam.eye[0], fy = tgt[1] - cam.eye[1], fz = tgt[2] - cam.eye[2];
        const fl = Math.hypot(fx, fy, fz) || 1;
        fx /= fl; fy /= fl; fz /= fl;
        brx = -fz; brz = fx;                                  // cross(forward, up)
        const rl = Math.hypot(brx, brz) || 1; brx /= rl; brz /= rl;
        const ax = -fx, ay = -fy, az = -fz;                   // camera up = cross(-f, right)
        const ux = ay * brz, uz = -ay * brx;
        let dx = -ux, dz = -uz;                               // screen-down on the floor
        const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        bdx = dx; bdz = dz;
        const depth = Math.max(1, (tb.tx - cam.eye[0]) * fx + (0.2 - cam.eye[1]) * fy + (tb.tz - cam.eye[2]) * fz);
        mpp = depth / ((cam.k && cam.k > 10) ? cam.k : 1680);
      }
      const s = (Math.abs(e.dx) > 0.6 || Math.abs(e.dy) > 0.6) ? mpp : 1;
      const wx = (brx * e.dx + bdx * e.dy) * s * 0.92;
      const wz = (brz * e.dx + bdz * e.dy) * s * 0.92;
      tb.tx = clamp(tb.tx + clamp(wx, -0.12, 0.12), 0.30, 1.70);
      tb.tz = clamp(tb.tz + clamp(wz, -0.12, 0.12), 0.78, 1.10);
      tb.sx.value = tb.tx; tb.sz.value = tb.tz;
    };
    const g = dragGuard(applyDrag);
    p.onDrag(g);
    obj.onDrag(g);
    bindClick(p, () => {
      tb.sx.impulse(rand(-0.5, 0.5));
      tb.sz.impulse(rand(-0.45, 0.25));
      tb.wx.impulse(rand(-4, 4));
      sfx('knock');
    }, true);
    p.onHover((h) => { p.setCursor(h ? 'grab' : 'pointer'); });

    obj.onUpdate((dt, now) => {
      frameNow = now;
      const px = tb.sx.step(dt), pz = tb.sz.step(dt);
      if (!tb.drag) { tb.tx = tb.sx.value; tb.tz = tb.sz.value; }
      tb.vx = dt > 0 ? (px - tb.px) / dt : 0;
      tb.vz = dt > 0 ? (pz - tb.pz) / dt : 0;
      const ax = dt > 0 ? (tb.vx - tb.pvx) / dt : 0;
      const az = dt > 0 ? (tb.vz - tb.pvz) / dt : 0;
      tb.px = px; tb.pz = pz; tb.pvx = tb.vx; tb.pvz = tb.vz;
      obj.setPos(px + CX, 0, pz + CZ);
      // the water surface tilts against the acceleration
      tb.wx.target = clamp(az * 0.055, -0.42, 0.42);
      tb.wz.target = clamp(-ax * 0.055, -0.42, 0.42);
      tb.wx.step(dt); tb.wz.step(dt);
      glass.setRot(clamp(tb.wx.value * 0.3, -0.09, 0.09), 0, clamp(tb.wz.value * 0.3, -0.09, 0.09));
      water.setRot(clamp(tb.wx.value, -0.42, 0.42), 0, clamp(tb.wz.value, -0.42, 0.42));
    });
  }

  /* --------------------------------------------------------------- poster */

  function buildPoster() {
    const obj = object({ id: 'poster', label: '海报' });
    // on the right wall: turn the object so its local +z faces into the room
    obj.setPos(3.10, 1.80, -0.30);
    obj.setRot(0, -Math.PI / 2, 0);

    const p = obj.part('poster', { label: '海报', hint: '换一幅' });
    const onTick = ticker(obj);
    const b = p.builder;
    const PW = 1.30, PH = 1.10;
    const ox = 0.06, oy = 0.06;                 // bottom left of the poster
    const A = [], Bv = [];                      // cross-faded style pools
    const mk = (arr, base) => { const s = style(base); arr.push(s); return s; };

    b.push();
    b.translate(-(ox + PW / 2), -(oy + PH / 2), 0);   // raw coordinates stay positive
    const L = ox, Rt = ox + PW, Bo = oy, Tp = oy + PH;

    // frame + paper
    b.quad([L - 0.03, Bo - 0.03, 0.012], [Rt + 0.03, Bo - 0.03, 0.012],
      [Rt + 0.03, Tp + 0.03, 0.012], [L - 0.03, Tp + 0.03, 0.012], SIL);
    b.quad([L, Bo, 0.020], [Rt, Bo, 0.020], [Rt, Tp, 0.020], [L, Tp, 0.020],
      style({ fill: 'paper', stroke: 'inkSoft', width: 0.8 }));
    b.quad([L + 0.02, Bo + 0.005, 0.021], [Rt - 0.02, Bo + 0.005, 0.021],
      [Rt - 0.02, Bo + 0.075, 0.021], [L + 0.02, Bo + 0.075, 0.021], style(H_SOFT, { bias: 0.02 }));
    b.quad([Rt + 0.03, Bo - 0.03, 0.012], [Rt + 0.03, Bo - 0.03, -0.026],
      [Rt + 0.03, Tp + 0.03, -0.026], [Rt + 0.03, Tp + 0.03, 0.012], FACE3);

    const cx = ox + 0.47, cy = oy + 0.72;
    // variant A — concentric arcs, bars and a block
    for (let i = 0; i < 3; i++) {
      const s = mk(A, { stroke: 'ink', width: 1.3 - i * 0.2 });
      const r = 0.16 + i * 0.075;
      const pts = [];
      for (let k = 0; k <= 18; k++) {
        const a = -0.35 + (k / 18) * Math.PI * 1.35;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.024]);
      }
      b.polyline(pts, s, false);
    }
    for (let i = 0; i < 4; i++) {
      const s = mk(A, { fill: 'face2', stroke: 'ink', width: 0.9 });
      const bx = ox + 0.78 + i * 0.055;
      b.quad([bx, Bo + 0.20, 0.024], [bx + 0.032, Bo + 0.20, 0.024],
        [bx + 0.032, Tp - 0.20 - i * 0.09, 0.024], [bx, Tp - 0.20 - i * 0.09, 0.024], s);
    }
    const ds = mk(A, { fill: 'face3', stroke: 'ink', width: 0.9 });
    b.quad([cx - 0.045, cy - 0.045, 0.025], [cx + 0.045, cy - 0.045, 0.025],
      [cx + 0.045, cy + 0.045, 0.025], [cx - 0.045, cy + 0.045, 0.025], ds);
    // variant B — a diagonal constructivist stack
    for (let i = 0; i < 5; i++) {
      const s = mk(Bv, { stroke: 'ink', width: 1.25 - i * 0.12 });
      const y0 = Bo + 0.18 + i * 0.14;
      b.polyline([[L + 0.08, y0, 0.024], [Rt - 0.08, y0 + 0.10, 0.024]], s, false);
    }
    for (let i = 0; i < 3; i++) {
      const s = mk(Bv, { fill: i === 1 ? 'face3' : 'face2', stroke: 'ink', width: 0.9 });
      const bx = L + 0.18 + i * 0.30;
      b.quad([bx, Bo + 0.16, 0.024], [bx + 0.10, Bo + 0.16, 0.024],
        [bx + 0.10, Tp - 0.16, 0.024], [bx, Tp - 0.16, 0.024], s);
    }
    const arcB = mk(Bv, { stroke: 'ink', width: 1.2 });
    const ptsB = [];
    for (let k = 0; k <= 20; k++) {
      const a = Math.PI * 0.15 + (k / 20) * Math.PI * 0.9;
      ptsB.push([ox + 0.86 + Math.cos(a) * 0.20, oy + 0.64 + Math.sin(a) * 0.20, 0.024]);
    }
    b.polyline(ptsB, arcB, false);

    // caption, tape and a pin
    b.push();
    b.translate(L + 0.12, Bo + 0.085, 0.026);
    b.text('NOCTURNE 4', { size: 0.045, align: 'left', baseline: 'bottom', plane: 'xy', style: SOFT });
    b.pop();
    b.line([L + 0.12, Bo + 0.072, 0.026], [Rt - 0.12, Bo + 0.072, 0.026], SOFT);
    b.quad([L + 0.04, Tp - 0.06, 0.026], [L + 0.15, Tp - 0.045, 0.026],
      [L + 0.17, Tp - 0.005, 0.026], [L + 0.06, Tp - 0.02, 0.026],
      style({ fill: 'face3', stroke: 'inkSoft', width: 0.7, alpha: 0.8 }));
    circleZ(b, Rt - 0.07, Tp - 0.07, 0.026, 0.012, 8, MID);

    // frame highlight (flashes on click)
    const flash = style({ fill: 'glow', stroke: 'none', alpha: 0 });
    b.quad([L - 0.03, Bo - 0.03, 0.014], [Rt + 0.03, Bo - 0.03, 0.014],
      [Rt + 0.03, Tp + 0.03, 0.014], [L - 0.03, Tp + 0.03, 0.014], flash);
    b.pop();

    const st = { tilt: new Spring(0, 60, 6), variant: 0, a: 1, b: 0, flash: 0 };
    bindClick(p, () => {
      st.variant = 1 - st.variant;
      st.tilt.impulse(rand(2.2, 3.4) * (st.variant ? 1 : -1));
      st.flash = 1;
      sfx('page');
    }, true);
    onTick((dt) => {
      st.tilt.step(dt);
      const k = clamp(1 - dt * 2.6, 0, 1);
      st.a = lerp(st.a, st.variant === 0 ? 1 : 0, 1 - k);
      st.b = lerp(st.b, st.variant === 1 ? 1 : 0, 1 - k);
      st.flash *= clamp(1 - dt * 2.2, 0, 1);
      for (let i = 0; i < A.length; i++) A[i].alpha = st.a;
      for (let i = 0; i < Bv.length; i++) Bv[i].alpha = st.b;
      flash.alpha = st.flash * 0.65;
      p.setRot(0, 0, clamp(st.tilt.value, -0.06, 0.06) * 0.6);
    });
  }

  /* ------------------------------------------------------------- bookend */

  /** the leaning row: a click nudges the bookend and the books settle in turn */
  function partBookend(obj, onTick, x, base, zFront) {
    const p = obj.part('bookend', { label: '书立', hint: '轻推' });
    p.setPos(x, base, zFront - 0.10);
    const bb = p.builder;
    bb.quad([0, 0, -0.05], [0.016, 0, -0.05], [0.016, 0.19, -0.05], [0, 0.19, -0.05], STRUCT);
    bb.quad([0, 0, 0.05], [0.016, 0, 0.05], [0.016, 0.19, 0.05], [0, 0.19, 0.05], STRUCT);
    bb.quad([0, 0.19, -0.05], [0.016, 0.19, -0.05], [0.016, 0.19, 0.05], [0, 0.19, 0.05], FACE2S);
    bb.quad([0, 0, 0.05], [0.016, 0, 0.05], [0.016, 0.008, 0.05], [0, 0.008, 0.05], FACE3);

    const leans = [0.15, 0.11, 0.075, 0.04];
    const books = [];
    for (let i = 0; i < 4; i++) {
      const n = p.node('lean' + i);
      n.setPos(0.045 + i * 0.05, 0, 0);
      const nb = n.builder;
      const w = 0.028 + i * 0.005, h = 0.245 - i * 0.012, d = 0.17;
      nb.push();
      nb.translate(w / 2, 0, 0.05);
      nb.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0],
        style(i % 2 ? FACE2S : FACE3, { width: 0.85 }));
      nb.quad([-w / 2, h, -d], [w / 2, h, -d], [w / 2, h, 0], [-w / 2, h, 0], style(FACE2S, { width: 0.7 }));
      nb.line([-w / 2, h * 0.66, 0.001], [w / 2, h * 0.66, 0.001], SOFT);
      nb.line([-w / 2, h * 0.5, 0.001], [w / 2, h * 0.5, 0.001], SOFT);
      nb.pop();
      const sp = new Spring(leans[i], 46, 5.6);
      books.push({ node: n, spring: sp, rest: leans[i], kicked: false });
    }
    const slide = new Spring(0, 70, 8.5);
    let cas = -1;
    bindClick(p, () => {
      slide.to(slide.target === 0 ? -0.015 : 0);
      cas = 0;
      sfx('thud');
    });
    onTick((dt) => {
      slide.step(dt);
      p.setPos(x + slide.value, base, zFront - 0.10);
      if (cas >= 0) {
        cas += dt;
        for (let i = 0; i < books.length; i++) {
          const t = 0.05 + i * 0.07;
          if (!books[i].kicked && cas > t) {
            books[i].kicked = true;
            books[i].spring.impulse(0.85 * (i % 2 ? -1 : 1));
            books[i].spring.target = books[i].rest + (i % 2 ? -0.014 : 0.012);
          }
        }
        if (cas > 1.2) { cas = -1; for (const bk of books) bk.kicked = false; }
      }
      for (const bk of books) { bk.spring.step(dt); bk.node.setRot(0, 0, bk.spring.value); }
    });
  }

  /* ------------------------------------------------------------------ go */

  buildBookcase();
  buildSideboard();
  buildTurntable();
  buildRug();
  buildSofa();
  buildCoffeeTable();
  buildPoster();
}
