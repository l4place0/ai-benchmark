/* 线之屋 · 几何构建器（全部返回局部坐标数据） */
(function () {
  const B = {};

  function face(pts, o) {
    const f = { kind: 'face', pts, fill: 'auto', stroke: 'edge', w: 1, dbl: false, zBias: 0,
      alpha: 1, blend: null, hatch: true, part: null, strokes: null };
    if (o) for (const k in o) f[k] = o[k];
    return f;
  }
  function stroke(pts, o) {
    const s = { kind: 'stroke', pts, w: 'detail', col: null, alpha: 1, dash: null, part: null, zBias: 0.002 };
    if (o) for (const k in o) s[k] = o[k];
    return s;
  }
  function text(p, str, size, o) {
    const t = { kind: 'text', p, s: str, size, col: null, align: 'center', part: null, zBias: 0.003 };
    if (o) for (const k in o) t[k] = o[k];
    return t;
  }

  /* 盒子：c 中心，s 全尺寸。返回 {faces, strokes} */
  function box(c, s, o) {
    o = o || {};
    const x0 = c[0] - s[0] / 2, x1 = c[0] + s[0] / 2;
    const y0 = c[1] - s[1] / 2, y1 = c[1] + s[1] / 2;
    const z0 = c[2] - s[2] / 2, z1 = c[2] + s[2] / 2;
    const P = (x, y, z) => [x, y, z];
    const defs = {
      px: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
      nx: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]],
      py: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
      ny: [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
      pz: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
      nz: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]
    };
    const out = { faces: [], strokes: [] };
    for (const k in defs) {
      const f = face(defs[k], { fill: o.fill != null ? o.fill : 'auto', stroke: o.stroke === false ? null : (o.strokeRole || 'edge'), part: o.part });
      if (o.face) o.face(k, f);
      out.faces.push(f);
    }
    return out;
  }

  /* 圆柱/圆台：c 为柱体中心 */
  function cyl(c, r, h, o) {
    o = o || {};
    const seg = o.seg || 14, axis = o.axis || 'y';
    const rT = o.rTop != null ? o.rTop : r, rB = o.rBot != null ? o.rBot : r;
    const out = { faces: [], strokes: [] };
    const pt = (rad, a, y) => {
      if (axis === 'y') return [c[0] + rad * Math.cos(a), y, c[2] + rad * Math.sin(a)];
      if (axis === 'x') return [y, c[1] + rad * Math.cos(a), c[2] + rad * Math.sin(a)];
      return [c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a), y];
    };
    const y0 = c[axis === 'y' ? 1 : (axis === 'x' ? 0 : 2)] - h / 2;
    const y1 = y0 + h;
    const cAxis = axis === 'y' ? 1 : (axis === 'x' ? 0 : 2);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      out.faces.push(face([pt(rT, a0, y1), pt(rT, a1, y1), pt(rB, a1, y0), pt(rB, a0, y0)],
        { fill: o.fill != null ? o.fill : 'auto', stroke: o.sideStroke ? (o.sideRole || 'hair') : null, part: o.part, dbl: true }));
    }
    if (o.cap !== false) out.faces.push(discRaw(pt(rT, 0, y1), rT, axis, o, 1));
    if (o.capB !== false) out.faces.push(discRaw(pt(rB, 0, y0), rB, axis, o, -1));
    return out;
  }

  function discRaw(c, r, axis, o, dir) {
    const seg = (o && o.seg) || 24;
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2 * (dir > 0 ? 1 : -1);
      if (axis === 'y') pts.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]);
      else if (axis === 'x') pts.push([c[0], c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)]);
      else pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]]);
    }
    const fo = { stroke: (o && o.stroke === false) ? null : ((o && o.strokeRole) || 'edge'),
      part: o && o.part, dbl: true, hatch: o ? o.hatch !== false : true };
    fo.fill = (o && 'fill' in o) ? o.fill : 'auto';
    if (o && o.zBias) fo.zBias = o.zBias;
    if (o && o.alpha != null) fo.alpha = o.alpha;
    return face(pts, fo);
  }

  /* 圆盘面 */
  function disc(c, r, o) {
    o = o || {};
    return discRaw(c, r, o.axis || 'y', o, o.dbl ? 1 : 1);
  }

  /* 弧线：返回 stroke */
  function arc(c, r, a0, a1, o) {
    o = o || {};
    const seg = o.seg || 14, axis = o.axis || 'y';
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg);
      if (axis === 'y') pts.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]);
      else if (axis === 'x') pts.push([c[0], c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)]);
      else pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]]);
    }
    return stroke(pts, { w: o.w || 'detail', col: o.col, alpha: o.alpha != null ? o.alpha : 1, part: o.part, zBias: o.zBias != null ? o.zBias : 0.002, dash: o.dash });
  }

  B.face = face; B.stroke = stroke; B.text = text;
  B.box = box; B.cyl = cyl; B.disc = disc; B.arc = arc;
  window.RLR = window.RLR || {};
  RLR.B = B;
})();
