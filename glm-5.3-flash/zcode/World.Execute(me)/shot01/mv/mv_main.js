'use strict';
/* world.execute(me); — procedural fan MV (main): camera, poses,
   overlays, per-frame state, drawFrame. Pure function of t. */
(function () {
const M = window.__MV;
const { T, W, H, TAU, clamp, lerp, sm, hash1, vnoise, BEAT, beatN, beatPhase, kick, snare,
  energyAt, sectionAt, cutAmt, heartPulse, t2, drawText, fmtTC, gl } = M;

// ---------------- matrices ----------------
function persp(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
}
function lookAt(e, c, u) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
  const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

// ---------------- camera (hard cut per section) ----------------
function camera(t) {
  const S = sectionAt(t), u = clamp((t - S.t0) / (S.t1 - S.t0), 0, 1);
  let p = [0, 0.6, 9.5], l = [0, 0.4, 0], fov = 42, roll = 0;
  switch (S.id) {
    case 'boot': p = [0, lerp(0.9, 0.4, u), lerp(9.8, 7.2, u)]; l = [0, 0.35, 0]; fov = 42; break;
    case 'drop1': { const a = lerp(0.45, 1.25, u), r = lerp(6.2, 5.0, u); p = [Math.sin(a) * r, lerp(0.5, 0.9, u), Math.cos(a) * r]; l = [0, 0.25, 0]; fov = 47; break; }
    case 'math': { const a = lerp(2.2, 4.6, u), r = 6.6; p = [Math.sin(a) * r, lerp(1.4, 0.8, u), Math.cos(a) * r]; l = [0, 0.1, 0]; fov = 40; break; }
    case 'chorus1': { const a = lerp(4.6, 6.4, u), r = lerp(5.6, 4.6, u); p = [Math.sin(a) * r, 0.7 + Math.sin(t * 0.7) * 0.4, Math.cos(a) * r]; l = [0, 0.15, 0]; fov = 48; break; }
    case 'rewrite': p = [lerp(1.9, -1.9, u), lerp(-1.3, -0.6, u), lerp(4.3, 3.7, u)]; l = [0, -0.5, 0]; fov = 50; break;
    case 'vibes': { const a = lerp(0.8, 2.4, u), r = lerp(5.0, 7.6, u); p = [Math.sin(a) * r, lerp(0.2, 1.6, u), Math.cos(a) * r]; l = [0, 0.2, 0]; roll = Math.sin(t * 0.5) * 0.05; fov = 45; break; }
    case 'sad': p = [lerp(0.5, 0, u), lerp(1.4, 1.1, u), lerp(10.5, 12.4, u)]; l = [0, -0.1, 0]; fov = 36; break;
    case 'error': { const a = lerp(0.3, -0.9, u), r = 4.1; p = [Math.sin(a) * r, 0.3 + Math.sin(t * 0.9) * 0.3, Math.cos(a) * r]; l = [0, 0.1, 0]; fov = 52; break; }
    case 'exec': { const a = lerp(0.0, 0.7, u), r = lerp(3.6, 8.0, Math.pow(u, 1.4)); p = [Math.sin(a) * r, lerp(-2.0, 1.2, u), Math.cos(a) * r]; l = [0, lerp(0.8, 0, u), 0]; fov = lerp(58, 44, u); break; }
    case 'love': p = [0, lerp(-0.4, 2.4, u), lerp(6.2, 7.8, u)]; l = [0, lerp(-0.2, 0.5, u), 0]; fov = 40; break;
    case 'final': p = [0, lerp(1.0, 0.6, u), lerp(10.5, 7.4, u)]; l = [0, 0.3, 0]; fov = 38; break;
    default: p = [0, 0.6, 12.2]; l = [0, 0.2, 0]; fov = 36;
  }
  const sAmt = S.id === 'error' ? 0.20 : S.id === 'exec' ? 0.13 : S.id === 'drop1' ? 0.05 : 0.02;
  const amp = sAmt * (0.4 + energyAt(t) * 0.9);
  const ft = t * 13;
  p[0] += vnoise(ft) * amp; p[1] += vnoise(ft + 37.7) * amp;
  if (S.id === 'exec') roll += Math.sin(t * 2.1) * 0.02;
  return { p, l, fov: fov * Math.PI / 180, roll };
}

// ---------------- subject pose ----------------
const BASE = {
  head: [0, -1.30, 0], neck: [0, -1.62, 0], chest: [0, -1.95, 0], pelvis: [0, -2.45, 0],
  shL: [-0.27, -1.88, 0], elL: [-0.36, -2.26, 0], wrL: [-0.40, -2.62, 0],
  shR: [0.27, -1.88, 0], elR: [0.36, -2.26, 0], wrR: [0.40, -2.62, 0],
  hipL: [-0.13, -2.50, 0], knL: [-0.15, -2.77, 0], anL: [-0.16, -2.99, 0],
  hipR: [0.13, -2.50, 0], knR: [0.15, -2.77, 0], anR: [0.16, -2.99, 0]
};
const OV = (o) => Object.assign({}, BASE, o);
const POSES = {
  none: {},
  scan: OV({ wrL: [-0.55, -2.35, 0.15], wrR: [0.55, -2.35, 0.15], elL: [-0.5, -2.1, 0.1], elR: [0.5, -2.1, 0.1], head: [0, -1.24, 0] }),
  stand: OV({}),
  open: OV({ wrL: [-0.62, -2.3, 0], wrR: [0.62, -2.3, 0], elL: [-0.55, -2.1, 0], elR: [0.55, -2.1, 0] }),
  dance: OV({}),
  vibe: OV({ wrL: [-0.75, -2.2, 0], wrR: [0.75, -2.2, 0], elL: [-0.6, -2.05, 0], elR: [0.6, -2.05, 0] }),
  alone: OV({ head: [0, -1.22, 0.12], shL: [-0.22, -1.92, 0], shR: [0.22, -1.92, 0], wrL: [-0.3, -2.72, 0], wrR: [0.3, -2.72, 0] }),
  reach: OV({ wrR: [0.5, -1.1, 0.2], elR: [0.55, -1.55, 0.1], head: [0.05, -1.22, -0.05] }),
  defy: OV({ wrL: [-0.5, -1.0, 0], wrR: [0.5, -1.0, 0], elL: [-0.5, -1.5, 0], elR: [0.5, -1.5, 0], head: [0, -1.2, -0.04] }),
  collapse: OV({ pelvis: [0, -2.72, 0.1], chest: [0, -2.1, 0.3], head: [0, -1.7, 0.42], neck: [0, -1.9, 0.35],
    knL: [-0.32, -2.78, 0], knR: [0.32, -2.78, 0], anL: [-0.3, -2.99, 0], anR: [0.3, -2.99, 0],
    wrL: [-0.3, -2.45, 0.35], wrR: [0.3, -2.45, 0.35], elL: [-0.35, -2.35, 0.2], elR: [0.35, -2.35, 0.2],
    shL: [-0.24, -2.0, 0.25], shR: [0.24, -2.0, 0.25] }),
  faint: OV({})
};
const SCHED = [
  [0, 'none'], [8.0, 'scan'], [16.1, 'stand'], [59.32, 'open'], [74.15, 'dance'],
  [103.59, 'vibe'], [117.37, 'alone'], [125.81, 'reach'], [136, 'defy'], [142.5, 'collapse'],
  [147.76, 'none'], [198, 'faint'], [206, 'none']
];
function getPose(t) {
  let ia = 0;
  for (let i = 0; i < SCHED.length; i++) if (t >= SCHED[i][0]) ia = i;
  const ib = Math.min(SCHED.length - 1, ia + 1);
  const k = sm(SCHED[ia][0], SCHED[ia][0] + 0.8, t);
  const A = POSES[SCHED[ia][1]], B = POSES[SCHED[ib][1]];
  const out = {};
  for (const j in BASE) {
    const a = A[j] || BASE[j], b = B[j] || BASE[j];
    out[j] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }
  // live micro-motion
  const br = Math.sin(t * 1.9) * 0.02;
  const sway = Math.sin(t * 0.7) * 0.03;
  out.pelvis[1] += br; out.chest[1] += br * 1.3; out.head[1] += br * 1.6;
  out.head[0] += sway * 2; out.chest[0] += sway;
  if (SCHED[ia][1] === 'dance' || SCHED[ib][1] === 'dance') {
    const kb = kick(t);
    out.pelvis[1] += kb * 0.05; out.chest[1] += kb * 0.07; out.head[1] += kb * 0.09;
    out.wrL[0] += Math.sin(t * 2.6) * 0.18; out.wrR[0] -= Math.sin(t * 2.6) * 0.18;
  }
  if (SCHED[ia][1] === 'vibe' || SCHED[ib][1] === 'vibe') {
    const j = vnoise(t * 30) * 0.03;
    out.wrL[0] += j; out.wrR[0] += j; out.head[0] += j * 2;
  }
  return out;
}
const SEGS = [
  ['neck', 'head'], ['chest', 'neck'], ['pelvis', 'chest'],
  ['chest', 'shL'], ['shL', 'elL'], ['elL', 'wrL'],
  ['chest', 'shR'], ['shR', 'elR'], ['elR', 'wrR'],
  ['pelvis', 'hipL'], ['hipL', 'knL'], ['knL', 'anL'],
  ['pelvis', 'hipR'], ['hipR', 'knR'], ['knR', 'anR']
];
// per-segment life: assemble in boot, delete in exec
function segAlpha(i, t) {
  const asT = 8.0 + i * 0.45;
  let a = sm(asT, asT + 0.35, t);
  const delT = 148.3 + i * 0.58;
  a *= 1 - sm(delT, delT + 0.15, t);
  return a;
}

// ---------------- line buffer builder ----------------
let LN = 0;
function pv(x, y, z, r, g, b, a) {
  if (LN + 2 > M.LCAP) return;
  M.lineArr[LN * 7] = x; M.lineArr[LN * 7 + 1] = y; M.lineArr[LN * 7 + 2] = z;
  M.lineArr[LN * 7 + 3] = r; M.lineArr[LN * 7 + 4] = g; M.lineArr[LN * 7 + 5] = b; M.lineArr[LN * 7 + 6] = a;
  LN++;
}
function seg(p1, p2, c, a) { pv(p1[0], p1[1], p1[2], c[0], c[1], c[2], a); pv(p2[0], p2[1], p2[2], c[0], c[1], c[2], a); }

function buildLines(t) {
  LN = 0;
  const S = sectionAt(t);
  // room wire edges
  const roomA = sm(1.5, 4.5, t) * (1 - sm(148.5, 152, t)) * 0.5;
  if (roomA > 0.01) {
    const h = 4 - 2.2 * clamp((t - 147.76) / 10, 0, 1) * (S.id === 'exec' ? 1 : 0);
    const c = [0.2, 0.75, 0.85];
    const E = [[-h, -3, -h, h, -3, -h], [h, -3, -h, h, -3, h], [h, -3, h, -h, -3, h], [-h, -3, h, -h, -3, -h],
      [-h, 3, -h, h, 3, -h], [h, 3, -h, h, 3, h], [h, 3, h, -h, 3, h], [-h, 3, h, -h, 3, -h],
      [-h, -3, -h, -h, 3, -h], [h, -3, -h, h, 3, -h], [h, -3, h, h, 3, h], [-h, -3, h, -h, 3, h]];
    for (const e of E) seg([e[0], e[1], e[2]], [e[3], e[4], e[5]], c, roomA);
  }
  // skeleton
  if (SCHED[0] && t >= 7.8 && t < 207) {
    const P = getPose(t);
    const col = [0.45, 0.95, 1.05];
    for (let i = 0; i < SEGS.length; i++) {
      const a = segAlpha(i, t);
      if (a <= 0.01) continue;
      const g = 0.75 + kick(t) * 0.35;
      seg(P[SEGS[i][0]], P[SEGS[i][1]], [col[0] * g, col[1] * g, col[2] * g], 0.85 * a);
    }
    // head circle
    const hp = P.head;
    for (let q = 0; q < 4; q++) {
      const a = segAlpha(15 + q * 0.9, t) * 0.9;
      if (a <= 0.01) continue;
      const N = 3;
      for (let s = 0; s < N; s++) {
        const a0 = (q * N + s) / 12 * TAU, a1 = (q * N + s + 1) / 12 * TAU;
        seg([hp[0] + Math.cos(a0) * 0.16, hp[1] + Math.sin(a0) * 0.19, hp[2]],
          [hp[0] + Math.cos(a1) * 0.16, hp[1] + Math.sin(a1) * 0.19, hp[2]], col, a);
      }
    }
    // heart dot: two short cross lines at chest, red, pulsing
    const ha = (1 - sm(148.3, 149.4, t)) * sm(9.5, 10.2, t);
    if (ha > 0.01) {
      const cp = P.chest, pu = 0.035 + kick(t) * 0.05 + heartPulse(t) * 0.02;
      seg([cp[0] - pu, cp[1], cp[2]], [cp[0] + pu, cp[1], cp[2]], [1.0, 0.2, 0.32], 0.95 * ha);
      seg([cp[0], cp[1] - pu, cp[2]], [cp[0], cp[1] + pu, cp[2]], [1.0, 0.2, 0.32], 0.95 * ha);
    }
  }
  // math overlays
  if (t >= 29.81 && t < 60.3) {
    const a = sm(29.81, 31.3, t) * (1 - sm(58.3, 60.3, t)) * 0.6;
    const c = [0.3, 0.9, 0.75];
    for (let i = 0; i < 180; i++) {
      const x0 = -5 + i / 180 * 10, x1 = -5 + (i + 1) / 180 * 10;
      const y0 = -0.4 + 1.05 * Math.sin(x0 * 1.2 - t * 2.2), y1 = -0.4 + 1.05 * Math.sin(x1 * 1.2 - t * 2.2);
      seg([x0, y0, -2.3], [x1, y1, -2.3], c, a * (0.5 + 0.5 * Math.sin(t * 3 + i * 0.2)));
    }
    const cc = [0, -1.6, -1.6], r = 1.9;
    for (let i = 0; i < 64; i++) {
      const a0 = i / 64 * TAU, a1 = (i + 1) / 64 * TAU;
      seg([cc[0] + Math.cos(a0) * r, cc[1] + Math.sin(a0) * r, cc[2]],
        [cc[0] + Math.cos(a1) * r, cc[1] + Math.sin(a1) * r, cc[2]], [0.35, 0.85, 1.0], a * 0.8);
    }
    for (let i = 0; i < 16; i++) {
      const aa = t * 0.4 + i / 16 * TAU;
      const d0 = r + 0.12, d1 = r + 0.34;
      seg([cc[0] + Math.cos(aa) * d0, cc[1] + Math.sin(aa) * d0, cc[2]],
        [cc[0] + Math.cos(aa) * d1, cc[1] + Math.sin(aa) * d1, cc[2]], [0.5, 0.95, 1.0], a);
    }
    seg([-4.6, -3.02, -2.3], [4.6, -3.02, -2.3], c, a * 0.7);
    seg([0, -3.02, -2.3], [0, 2.6, -2.3], c, a * 0.5);
  }
  // helix (rewrite)
  if (t >= 74.15 && t < 104.4) {
    const a = sm(74.15, 76, t) * (1 - sm(102.6, 104.4, t)) * 0.55;
    for (let s = 0; s < 2; s++) {
      const c = s === 0 ? [0.3, 0.9, 1.0] : [1.0, 0.45, 0.75];
      for (let i = 0; i < 159; i++) {
        const y0 = -2.9 + i * 0.0152, y1 = -2.9 + (i + 1) * 0.0152;
        const p0 = Math.cos(i * 0.145 + t * 1.15 + s * Math.PI) * 0.92;
        const p1 = Math.cos((i + 1) * 0.145 + t * 1.15 + s * Math.PI) * 0.92;
        const q0 = Math.sin(i * 0.145 + t * 1.15 + s * Math.PI) * 0.92;
        const q1 = Math.sin((i + 1) * 0.145 + t * 1.15 + s * Math.PI) * 0.92;
        seg([p0, y0, q0], [p1, y1, q1], c, a);
      }
    }
  }
  // wave rings (vibes)
  if (t >= 103.59 && t < 118.2) {
    const a = sm(103.59, 105, t) * (1 - sm(116.4, 118.2, t));
    for (let i = 0; i < 4; i++) {
      const rr = ((t * 1.35 + i * 1.6) % 6.4);
      const ra = a * (1 - rr / 6.4) * 0.7;
      if (ra <= 0.01) continue;
      for (let s = 0; s < 48; s++) {
        const a0 = s / 48 * TAU, a1 = (s + 1) / 48 * TAU;
        seg([Math.cos(a0) * rr, -2.99, Math.sin(a0) * rr], [Math.cos(a1) * rr, -2.99, Math.sin(a1) * rr], [0.4, 0.9, 1.0], ra);
      }
    }
  }
  // heart outline (love/final)
  if (t >= 162.63 && t < 207.2) {
    const a = sm(163.5, 167, t) * (1 - sm(204.3, 206.2, t)) * 0.9;
    if (a > 0.01) {
      const pu = 1 + 0.13 * heartPulse(t);
      const cy = -0.85;
      const col = [1.0, 0.32, 0.45];
      for (let i = 0; i < 96; i++) {
        const th0 = i / 96 * TAU, th1 = (i + 1) / 96 * TAU;
        const fx = th => 16 * Math.pow(Math.sin(th), 3) * 0.082 * pu;
        const fy = th => (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) * 0.082 * pu;
        seg([fx(th0), cy + fy(th0), 0], [fx(th1), cy + fy(th1), 0], col, a);
      }
    }
  }
  return LN;
}

// ---------------- per-frame scene/post params ----------------
function sceneParams(t) {
  const S = sectionAt(t), u = clamp((t - S.t0) / (S.t1 - S.t0), 0, 1);
  const en = energyAt(t), k = kick(t);
  const o = { tint: [1, 1, 1], roomB: 0.5, wave: 0, polar: 0, fig: 1, crouch: 0, scan: -9, heart: 0, err: 0, open: 0, exec: 0, love: 0, fog: 0.10, bg: [0.012, 0.02, 0.03] };
  switch (S.id) {
    case 'boot': o.roomB = 0.10 + u * 0.38; o.fig = sm(7.5, 9.5, t) * 0.9; o.tint = [0.72, 0.96, 1.06]; o.fog = 0.13; break;
    case 'drop1': o.roomB = 0.55 + k * 0.3; o.scan = -3 + ((t * 0.55) % 1) * 6.4; o.tint = [0.75, 1.0, 1.1]; break;
    case 'math': o.polar = sm(29.81, 33, t); o.wave = 0.35; o.roomB = 0.42 + en * 0.2; o.tint = [0.8, 1.05, 1.0]; o.scan = -3 + ((t * 0.4) % 1) * 6.4; break;
    case 'chorus1': o.roomB = 0.5 + en * 0.35 + k * 0.15; o.wave = 0.5; o.tint = [0.9, 1.02, 1.1]; o.scan = -3 + ((t * 0.7) % 1) * 6.4; break;
    case 'rewrite': o.roomB = 0.45 + k * 0.12; o.wave = 0.25; o.tint = [1.05, 0.9, 1.05]; break;
    case 'vibes': o.roomB = 0.55 + en * 0.4; o.wave = 1.0; o.tint = [0.85, 1.05, 1.15]; break;
    case 'sad': o.roomB = 0.16 + u * 0.05; o.wave = 0.1; o.tint = [0.75, 0.85, 1.05]; o.fog = 0.16; break;
    case 'error': o.err = sm(125.81, 127, t) * 0.8; o.roomB = 0.4 + en * 0.2; o.crouch = sm(141.5, 147, t); o.tint = [1.1, 0.75, 0.75]; break;
    case 'exec': o.exec = sm(147.76, 148.3, t); o.open = sm(148.3, 158, t); o.fig = 1 - sm(148.2, 155, t); o.roomB = 0.55 + k * 0.25; o.tint = [1.15, 1.05, 1.1]; o.err = 0.35; break;
    case 'love': o.love = sm(162.63, 166, t); o.heart = sm(163.5, 167, t) * (1 - sm(204.5, 205.9, t)); o.fig = 0; o.roomB = 0.25 + en * 0.2; o.tint = [1.1, 0.95, 0.9]; o.fog = 0.13; break;
    case 'final': o.roomB = 0.3 * (1 - sm(206.5, 208, t)); o.heart = (1 - sm(206.3, 207.2, t)) * 0.6; o.love = 0.6; o.tint = [1.05, 0.95, 0.95]; o.fig = 0; break;
    default: o.roomB = 0.06; o.fig = 0; o.love = 0.5; o.tint = [1.0, 0.95, 0.9];
  }
  return o;
}
function postState(t) {
  const S = sectionAt(t);
  const en = energyAt(t);
  let flashW = cutAmt(t) * 0.5, flashR = 0;
  for (const c of T.cues) {
    const age = t - c.t;
    if (c.type === 'exec' && age >= 0 && age < 0.08) { flashW = Math.max(flashW, 0.8 * (1 - age / 0.08)); flashR = Math.max(flashR, 0.5); }
    if (c.type === 'count' && age >= 0 && age < 0.05) flashW = Math.max(flashW, 0.55);
    if (c.type === 'title' && Math.abs(age) < 0.035) flashW = Math.max(flashW, 0.8);
    if (c.type === 'error' && age >= 0 && age < 0.08) flashR = Math.max(flashR, 0.8);
  }
  if (t >= 205.91 && t < 206.6) flashW = Math.max(flashW, 1.0 - (t - 205.91) * 1.35);
  const errSec = S.id === 'error';
  const glitch = (errSec ? 0.5 + 0.3 * en : 0) + (S.id === 'exec' ? 0.35 : 0) + (S.id === 'rewrite' ? 0.10 : 0) + cutAmt(t) * 0.5 + (S.id === 'drop1' ? 0.08 : 0);
  const aberr = 0.0012 + 0.0035 * en + clamp(glitch, 0, 1) * 0.01;
  const redEnv = errSec ? 0.8 : (S.id === 'exec' ? 0.3 : 0);
  const warm = S.id === 'love' ? sm(163, 168, t) : (S.id === 'final' ? 0.5 : (S.id === 'outro' ? 0.35 : 0));
  const fade = sm(0, 0.8, t) * (1 - sm(216.4, 217.45, t));
  return { flashW, flashR, glitch: clamp(glitch, 0, 1), aberr, redEnv, warm, fade };
}
function partModes(t) {
  const S = sectionAt(t);
  const w = [0, 0, 0, 0]; // rain, vortex, heart, drift
  switch (S.id) {
    case 'boot': w[0] = 0.12; w[3] = 0.15; break;
    case 'drop1': w[0] = 0.95; w[3] = 0.2; break;
    case 'math': w[0] = 0.5; w[3] = 0.35; break;
    case 'chorus1': w[0] = 0.8; w[3] = 0.3; break;
    case 'rewrite': w[0] = 0.5; w[3] = 0.4; break;
    case 'vibes': w[0] = 0.45; w[3] = 0.6; break;
    case 'sad': w[3] = 0.45; break;
    case 'error': w[0] = 0.5; w[3] = 0.25; break;
    case 'exec': w[1] = 1.0; break;
    case 'love': w[2] = 1.0; w[3] = 0.35; break;
    case 'final': w[2] = 0.5; w[3] = 0.3; break;
    default: w[3] = 0.12;
  }
  return w;
}

// ---------------- draw frame ----------------
let textReady = false;
function drawQuad(pr) {
  gl.bindBuffer(gl.ARRAY_BUFFER, M.quadBuf);
  gl.enableVertexAttribArray(pr.a.aP);
  gl.vertexAttribPointer(pr.a.aP, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function drawFrame(t) {
  const S = sectionAt(t);
  const en = energyAt(t), k = kick(t);
  const cam = camera(t);
  const Pm = persp(cam.fov, W / H, 0.1, 60);
  const Vm = lookAt(cam.p, cam.l, [0, 1, 0]);
  let VP = mul(Pm, Vm);
  if (cam.roll) VP = mul(VP, [Math.cos(cam.roll), Math.sin(cam.roll), 0, 0, -Math.sin(cam.roll), Math.cos(cam.roll), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const sp = sceneParams(t);
  const dirty = drawText(t);
  if (dirty || !textReady) { M.uploadText(); textReady = true; }

  // scene pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, M.fbo);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  const ps = M.progScene;
  gl.useProgram(ps.p);
  gl.uniform2f(ps.u.uRes, W, H);
  gl.uniform3f(ps.u.uCam, cam.p[0], cam.p[1], cam.p[2]);
  gl.uniform3f(ps.u.uTgt, cam.l[0], cam.l[1], cam.l[2]);
  gl.uniform1f(ps.u.uFov, cam.fov);
  gl.uniform1f(ps.u.uT, t);
  gl.uniform3f(ps.u.uTint, sp.tint[0], sp.tint[1], sp.tint[2]);
  gl.uniform1f(ps.u.uRoomB, sp.roomB);
  gl.uniform1f(ps.u.uWave, sp.wave);
  gl.uniform1f(ps.u.uPolar, sp.polar);
  gl.uniform1f(ps.u.uFig, sp.fig);
  gl.uniform1f(ps.u.uCrouch, sp.crouch);
  gl.uniform1f(ps.u.uScan, sp.scan);
  gl.uniform1f(ps.u.uHeart, sp.heart);
  gl.uniform1f(ps.u.uErr, sp.err);
  gl.uniform1f(ps.u.uOpen, sp.open);
  gl.uniform1f(ps.u.uExec, sp.exec);
  gl.uniform1f(ps.u.uLove, sp.love);
  gl.uniform1f(ps.u.uFog, sp.fog);
  gl.uniform3f(ps.u.uBg, sp.bg[0], sp.bg[1], sp.bg[2]);
  gl.uniform1f(ps.u.uKick, k);
  drawQuad(ps);

  // lines pass (additive, 3 offset copies for glow)
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  const pl = M.progLine;
  gl.useProgram(pl.p);
  const nVerts = buildLines(t);
  if (nVerts > 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, M.lineBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.lineArr.subarray(0, nVerts * 7));
    gl.enableVertexAttribArray(pl.a.aPos);
    gl.vertexAttribPointer(pl.a.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(pl.a.aCol);
    gl.vertexAttribPointer(pl.a.aCol, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(pl.a.aA);
    gl.vertexAttribPointer(pl.a.aA, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(pl.u.uMVP, false, new Float32Array(VP));
    gl.uniform2f(pl.u.uRes, W, H);
    const passes = [[0, 0, 0.8], [1.6, 0.9, 0.32], [-1.6, -0.9, 0.32]];
    for (const pss of passes) {
      gl.uniform2f(pl.u.uOff, pss[0], pss[1]);
      gl.uniform1f(pl.u.uGain, pss[2]);
      gl.drawArrays(gl.LINES, 0, nVerts);
    }
  }

  // particles
  const pp = M.progPart;
  gl.useProgram(pp.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, M.partBuf);
  gl.enableVertexAttribArray(pp.a.aSeed);
  gl.vertexAttribPointer(pp.a.aSeed, 4, gl.FLOAT, false, 0, 0);
  const w = partModes(t);
  gl.uniformMatrix4fv(pp.u.uMVP, false, new Float32Array(VP));
  gl.uniform1f(pp.u.uT, t);
  gl.uniform4f(pp.u.uMode, w[0], w[1], w[2], w[3]);
  gl.uniform1f(pp.u.uHeart, sp.heart);
  gl.uniform1f(pp.u.uHeartP, heartPulse(t) * (sp.heart > 0.02 ? 1 : 0));
  gl.uniform1f(pp.u.uKick, k);
  gl.uniform1f(pp.u.uFovS, (H * 0.5) / Math.tan(cam.fov * 0.5) * 0.035);
  gl.drawArrays(gl.POINTS, 0, M.PN);

  // post
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  const po = M.progPost;
  gl.useProgram(po.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, M.sceneTex);
  gl.uniform1i(po.u.uScene, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, M.textTex);
  gl.uniform1i(po.u.uText, 1);
  gl.uniform2f(po.u.uRes, W, H);
  gl.uniform1f(po.u.uT, t);
  const st = postState(t);
  gl.uniform1f(po.u.uAber, st.aberr);
  gl.uniform1f(po.u.uGlitch, st.glitch);
  gl.uniform1f(po.u.uFlashW, st.flashW);
  gl.uniform1f(po.u.uFlashR, st.flashR);
  gl.uniform1f(po.u.uFade, st.fade);
  gl.uniform1f(po.u.uWarm, st.warm);
  gl.uniform1f(po.u.uRedEnv, st.redEnv);
  drawQuad(po);
  gl.activeTexture(gl.TEXTURE0);
  window.__lastT = t;
}
// ---------------- init / live / offline hooks ----------------
async function init() {
  try {
    await document.fonts.load('400 22px "JetBrains Mono"');
    await document.fonts.load('700 104px "JetBrains Mono"');
  } catch (e) { /* fonts optional */ }
  M.uploadText();
  drawFrame(0);
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__gpuinfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : String(gl.getParameter(gl.RENDERER) || 'unknown');
  window.__ready = true;
  if (!/render=1/.test(location.search)) setupLive();
}
function setupLive() {
  const hint = document.getElementById('hint');
  const audio = new Audio('audio/song.m4a');
  audio.preload = 'auto';
  let raf = 0;
  function loop() { drawFrame(audio.currentTime || 0); raf = requestAnimationFrame(loop); }
  cv.addEventListener('click', () => {
    if (audio.paused) { audio.play(); if (!raf) loop(); }
    else audio.pause();
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowRight') audio.currentTime = Math.min(T.mvDuration, (audio.currentTime || 0) + 5);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5);
    if (e.code === 'Space') { e.preventDefault(); if (audio.paused) { audio.play(); if (!raf) loop(); } else audio.pause(); }
  });
  if (hint) hint.textContent = 'world.execute(me); — click canvas to play/pause (sound) · space · ←/→ seek 5s';
}
window.__renderFrame = function (t) { drawFrame(t); return cv.toDataURL('image/png'); };
window.__selftest = function () {
  const a = window.__renderFrame(8.17), b = window.__renderFrame(8.17);
  return { same: a === b, len: a.length };
};
window.__state = t => { const S = sectionAt(t); return { t, sec: S.id, en: +energyAt(t).toFixed(3), beat: Math.floor(beatN(t)) }; };
window.__textdebug = t => M.textItems(t).map(i => i.kind + '[' + Math.round(i.alpha * 100) + '] ' + i.text).join(' | ');
init();
})();
