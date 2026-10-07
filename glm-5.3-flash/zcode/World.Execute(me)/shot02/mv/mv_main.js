'use strict';
/* world.execute(me); — procedural fan MV, take 02 "paper doll" (main)
   Camera, marionette pose, 2D ink art layer, per-frame state, drawFrame.
   Pure function of t. */
(function () {
const M = window.__MV2;
const { T, W, H, TAU, clamp, lerp, sm, hash1, vnoise, BEAT, beatN, beatPhase, kick, snare,
  energyAt, sectionAt, cutAmt, heartPulse, burstAt, t2, fmtTC, FM, CPS, gl } = M;

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
function rollMat(r) {
  return [Math.cos(r), Math.sin(r), 0, 0, -Math.sin(r), Math.cos(r), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// ---------------- palette ----------------
// light: warm paper + near-black ink; dark: warm near-black + bone ink
function palette(t) {
  const S = sectionAt(t);
  if (S.id === 'error' || S.id === 'exec' || S.id === 'final' || S.id === 'outro') {
    return { dark: true, paper: [0.055, 0.048, 0.042], ink: [0.930, 0.900, 0.850], red: [0.880, 0.220, 0.160], dim: [0.55, 0.52, 0.48] };
  }
  if (S.id === 'love') {
    return { dark: false, paper: [0.995, 0.958, 0.890], ink: [0.105, 0.085, 0.070], red: [0.800, 0.190, 0.140], dim: [0.55, 0.48, 0.42] };
  }
  return { dark: false, paper: [0.988, 0.968, 0.930], ink: [0.085, 0.075, 0.065], red: [0.800, 0.200, 0.150], dim: [0.45, 0.42, 0.38] };
}
const css = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + a.toFixed(3) + ')';

// ---------------- marionette pose ----------------
const BASE = {
  head: [0, -1.30, 0], neck: [0, -1.62, 0], chest: [0, -1.95, 0], pelvis: [0, -2.45, 0],
  shL: [-0.27, -1.88, 0], elL: [-0.36, -2.26, 0], wrL: [-0.40, -2.62, 0],
  shR: [0.27, -1.88, 0], elR: [0.36, -2.26, 0], wrR: [0.40, -2.62, 0],
  hipL: [-0.13, -2.50, 0], knL: [-0.15, -2.77, 0], anL: [-0.16, -2.99, 0],
  hipR: [0.13, -2.50, 0], knR: [0.15, -2.77, 0], anR: [0.16, -2.99, 0]
};
const OV = o => Object.assign({}, BASE, o);
const POSES = {
  lie: OV({
    head: [1.18, -2.72, 0.02], neck: [0.92, -2.76, 0.01], chest: [0.52, -2.80, 0], pelvis: [0, -2.82, 0],
    shL: [0.52, -2.80, -0.28], elL: [0.62, -2.78, -0.52], wrL: [0.70, -2.76, -0.70],
    shR: [0.52, -2.80, 0.28], elR: [0.62, -2.78, 0.52], wrR: [0.70, -2.76, 0.70],
    hipL: [-0.12, -2.82, -0.10], knL: [-0.72, -2.83, -0.11], anL: [-1.30, -2.84, -0.12],
    hipR: [-0.12, -2.82, 0.10], knR: [-0.72, -2.83, 0.11], anR: [-1.30, -2.84, 0.12]
  }),
  hang: OV({
    head: [0, -1.02, 0.02], neck: [0, -1.36, 0], chest: [0, -1.72, 0], pelvis: [0, -2.18, 0],
    shL: [-0.27, -1.66, 0], elL: [-0.40, -2.02, 0.02], wrL: [-0.46, -2.36, 0.04],
    shR: [0.27, -1.66, 0], elR: [0.40, -2.02, 0.02], wrR: [0.46, -2.36, 0.04],
    hipL: [-0.13, -2.23, 0], knL: [-0.16, -2.52, -0.14], anL: [-0.18, -2.80, -0.10],
    hipR: [0.13, -2.23, 0], knR: [0.16, -2.52, -0.14], anR: [0.18, -2.80, -0.10]
  }),
  stand: OV({}),
  open: OV({ wrL: [-0.72, -1.95, 0], elL: [-0.58, -2.02, 0], wrR: [0.72, -1.95, 0], elR: [0.58, -2.02, 0], head: [0, -1.26, -0.03] }),
  alone: OV({ head: [0, -1.24, 0.10], wrL: [-0.30, -2.68, 0], wrR: [0.30, -2.68, 0] }),
  kneel: OV({
    pelvis: [0, -2.70, 0.1], chest: [0, -2.12, 0.28], head: [0, -1.74, 0.40], neck: [0, -1.92, 0.34],
    knL: [-0.34, -2.76, 0], knR: [0.34, -2.76, 0], anL: [-0.30, -2.97, 0], anR: [0.30, -2.97, 0],
    shL: [-0.25, -2.00, 0.24], shR: [0.25, -2.00, 0.24], elL: [-0.38, -2.34, 0.18], elR: [0.38, -2.34, 0.18],
    wrL: [-0.34, -2.62, 0.30], wrR: [0.34, -2.62, 0.30], hipL: [-0.14, -2.74, 0], hipR: [0.14, -2.74, 0]
  }),
  trapped: OV({ head: [0, -1.20, 0.14], wrL: [-0.18, -2.62, 0.02], wrR: [0.18, -2.62, 0.02], elL: [-0.24, -2.32, 0.02], elR: [0.24, -2.32, 0.02] })
};
// [t, pose, blendDur]
const SCHED = [
  [0, 'lie', 0.6], [7.6, 'hang', 3.9], [103.59, 'stand', 0.5], [117.37, 'alone', 1.4],
  [125.81, 'kneel', 5.0], [162.63, 'open', 2.6], [188.5, 'trapped', 2.4], [205.91, 'kneel', 0.2]
];
function swayRot(p, th) {
  const px = 0, py = 2.2;
  const c = Math.cos(th), s = Math.sin(th);
  const dx = p[0] - px, dy = p[1] - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c, p[2]];
}
function getPose(t) {
  let ib = 0;
  for (let i = 0; i < SCHED.length; i++) if (t >= SCHED[i][0]) ib = i;
  const ia = Math.max(0, ib - 1);
  const bd = SCHED[ib][2] || 0.8;
  const k = sm(SCHED[ib][0], SCHED[ib][0] + bd, t);
  const A = POSES[SCHED[ia][1]], B = POSES[SCHED[ib][1]];
  const out = {};
  for (const j in BASE) {
    const a = A[j] || BASE[j], b = B[j] || BASE[j];
    out[j] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }
  // micro life
  const br = Math.sin(t * 1.9) * 0.02;
  out.pelvis[1] += br; out.chest[1] += br * 1.3; out.head[1] += br * 1.6;
  // hanging: pendulum sway around the control bar
  const hanging = t >= 7.6 && t < 103.59;
  if (hanging) {
    const S = sectionAt(t);
    let th = 0.085 * Math.sin(t * 1.05) + kick(t) * 0.045 * (S.id === 'thread' ? 1 : 0.5);
    if (S.id === 'thread') th += 0.05 * Math.sin(t * 2.2) * sm(44.5, 48, t);
    if (S.id === 'specimen') th *= 0.4;
    for (const j in out) out[j] = swayRot(out[j], th);
    // puppet twitch: strings tug the wrists on the beat
    const tw = kick(t) * 0.10 * (Math.floor(beatN(t)) % 2 === 0 ? 1 : -1);
    out.wrL[0] -= tw; out.wrR[0] += tw;
  }
  // standing (ripples): hip sway + beat bob
  if (t >= 103.59 && t < 125.81) {
    const k2 = kick(t);
    out.pelvis[0] += Math.sin(t * 1.4) * 0.03;
    out.wrL[0] += Math.sin(t * 1.4) * 0.07 - k2 * 0.05;
    out.wrR[0] += Math.sin(t * 1.4 + Math.PI) * 0.07 + k2 * 0.05;
    out.pelvis[1] += k2 * 0.03; out.chest[1] += k2 * 0.045;
  }
  // love float (open) / shiver (trapped)
  if (t >= 162.63 && t < 188.5) {
    const bob = Math.sin(t * 0.9) * 0.07;
    for (const j in out) out[j][1] += bob;
    out.wrL[1] += Math.sin(t * 1.3) * 0.05; out.wrR[1] += Math.sin(t * 1.3 + 1.2) * 0.05;
  }
  if (t >= 188.5 && t < 205.91) {
    const j2 = vnoise(t * 18) * 0.012;
    out.head[0] += j2 * 2; out.wrL[0] += j2; out.wrR[0] += j2;
  }
  return out;
}
const SEGS = [
  ['neck', 'head', 0.09], ['chest', 'neck', 0.115], ['pelvis', 'chest', 0.15],
  ['chest', 'shL', 0.075], ['shL', 'elL', 0.055], ['elL', 'wrL', 0.048],
  ['chest', 'shR', 0.075], ['shR', 'elR', 0.055], ['elR', 'wrR', 0.048],
  ['pelvis', 'hipL', 0.09], ['hipL', 'knL', 0.062], ['knL', 'anL', 0.05],
  ['pelvis', 'hipR', 0.09], ['hipR', 'knR', 0.062], ['knR', 'anR', 0.05]
];
// per-segment visibility: wake fade-in, exec dismantle, love reassemble
const EXEC_CUES = T.cues.filter(c => c.type === 'exec' && c.t < 162.0);
function figAlpha(t) {
  const S = sectionAt(t);
  if (S.id === 'wake') return sm(1.2, 2.6, t);
  if (S.id === 'mandala') return 0;
  if (S.id === 'final' || S.id === 'outro') return 0;
  return 1;
}
function segAlpha(i, t) {
  let a = 1;
  if (t >= 147.76 && t < 162.63) {
    const rank = (14 - i) / 14;                    // limbs first, head last
    const ci = Math.min(EXEC_CUES.length - 1, Math.floor(rank * (EXEC_CUES.length - 1)));
    const vt = EXEC_CUES[ci].t + 0.06;
    a *= 1 - sm(vt, vt + 0.5, t);
  }
  if (t >= 162.63) {
    a = Math.min(a, sm(162.9 + i * 0.16, 163.35 + i * 0.16, t));
  }
  return a;
}
const BAR_Y = 2.2, BAR_X = [-0.5, 0.5, -0.24, 0.24];
function stringsAlpha(t) {
  if (t < 7.6 || t >= 103.72) return 0;
  if (t >= 103.59) return 1 - sm(103.59, 103.72, t);
  let a = 1;
  for (let i = 0; i < 5; i++) a = Math.min(a, sm(7.6 + i * 0.22, 8.15 + i * 0.22, t));
  return a;
}
// 22 capsules: 16 figure + bar + 5 strings
const capA = new Float32Array(22 * 3), capB = new Float32Array(22 * 3);
const capR = new Float32Array(22), capSA = new Float32Array(22), capCM = new Float32Array(22);
function buildCaps(t) {
  const P = getPose(t), fA = figAlpha(t), sA = stringsAlpha(t);
  const barY = BAR_Y + 2.0 * (1 - sm(7.6, 9.5, t)) + (t >= 103.59 ? sm(103.59, 103.8, t) * 2.6 : 0);
  let barTh = 0;
  if (t >= 7.6 && t < 103.59) {
    const S = sectionAt(t);
    barTh = 0.085 * Math.sin(t * 1.05) * 0.3 * (S.id === 'specimen' ? 0.4 : 1);
  }
  for (let i = 0; i < 15; i++) {
    const sg = SEGS[i];
    const a = P[sg[0]], b = P[sg[1]];
    capA[i * 3] = a[0]; capA[i * 3 + 1] = a[1]; capA[i * 3 + 2] = a[2];
    capB[i * 3] = b[0]; capB[i * 3 + 1] = b[1]; capB[i * 3 + 2] = b[2];
    capR[i] = sg[2]; capSA[i] = fA * segAlpha(i, t); capCM[i] = 0;
  }
  const hp = P.head;
  capA[45] = hp[0]; capA[46] = hp[1]; capA[47] = hp[2];
  capB[45] = hp[0]; capB[46] = hp[1]; capB[47] = hp[2];
  capR[15] = 0.16; capSA[15] = fA * segAlpha(0, t); capCM[15] = 0;
  const c = Math.cos(barTh), s = Math.sin(barTh);
  capA[48] = -0.62 * c + barY * s; capA[49] = barY - 0.62 * s; capA[50] = 0;
  capB[48] = 0.62 * c + barY * s; capB[49] = barY + 0.62 * s; capB[50] = 0;
  capR[16] = 0.026; capSA[16] = fA * sA * sm(7.4, 7.9, t); capCM[16] = 1;
  const att = [[hp[0], hp[1] + 0.15, hp[2]], P.wrL, P.wrR, P.knL, P.knR];
  const bx = [0, BAR_X[0], BAR_X[1], BAR_X[2], BAR_X[3]];
  for (let i = 0; i < 5; i++) {
    const sx = bx[i] * c + barY * s, sy = barY - bx[i] * s;
    capA[(17 + i) * 3] = sx; capA[(17 + i) * 3 + 1] = sy; capA[(17 + i) * 3 + 2] = 0;
    capB[(17 + i) * 3] = att[i][0]; capB[(17 + i) * 3 + 1] = att[i][1]; capB[(17 + i) * 3 + 2] = att[i][2];
    capR[17 + i] = 0.0145; capSA[17 + i] = fA * sA; capCM[17 + i] = 1;
  }
  return fA;
}

// ---------------- projection ----------------
function prj(p, VP) {
  const v = VP;
  const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
  const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
  const w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
  if (w <= 0.02) return null;
  return [(x / w * 0.5 + 0.5) * W, (0.5 - y / w * 0.5) * H, w];
}

// ---------------- camera ----------------
function camera(t) {
  const S = sectionAt(t), u = clamp((t - S.t0) / (S.t1 - S.t0), 0, 1);
  let p = [0, -0.7, 6.5], l = [0, -1.6, 0], fov = 40, roll = 0;
  switch (S.id) {
    case 'wake': {
      const k = sm(7.6, 12.5, t);
      p = [lerp(0.35, 0.1, k), lerp(-1.95, -0.75, k), lerp(5.4, 6.6, k)];
      l = [lerp(0.15, 0, k), lerp(-2.72, -1.6, k), 0]; fov = 40; break;
    }
    case 'title': p = [0, -0.55, 7.2]; l = [0, -1.25, 0]; fov = 42; break;
    case 'thread': p = [0.35 * Math.sin(t * 0.21), -0.75, 6.3]; l = [0, -1.5, 0]; fov = 40; break;
    case 'mandala': p = [0, -0.6, 8.0]; l = [0, -1.2, 0]; fov = 40; break;
    case 'specimen':
      p = [0, -0.65, 5.9]; l = [0, -1.55, 0]; fov = 42;
      roll = 0.42 * sm(99.3, 102.6, t) * (1 - sm(103.5, 104.3, t)); break;
    case 'ripples': p = [0, -0.35, 6.9]; l = [0, -1.95, 0]; fov = 40; break;
    case 'isolation': p = [0, 0.3, 16.5]; l = [0, -2.0, 0]; fov = 34; break;
    case 'error': p = [0.3, -0.85, 5.3]; l = [0, -1.8, 0]; fov = 46; break;
    case 'exec': p = [0, lerp(-1.0, -1.5, u), lerp(6.0, 4.6, u)]; l = [0, -1.95, 0]; fov = 44; break;
    case 'love': p = [0, lerp(-1.15, -1.35, u), lerp(7.4, 5.4, Math.pow(u, 1.3))]; l = [0, -1.75, 0]; fov = 40; break;
    default: p = [0, 0, 9]; l = [0, 0, 0]; fov = 40;
  }
  const amp = S.i * 0.045;
  const ft = t * 1.3;
  p = [p[0] + vnoise(ft) * amp, p[1] + vnoise(ft + 37.7) * amp * 0.6, p[2]];
  l = [l[0] + vnoise(ft + 91.3) * amp * 0.5, l[1] + vnoise(ft + 55.1) * amp * 0.5, l[2]];
  return { p, l, fov: fov * Math.PI / 180, roll };
}

// ---------------- art layer ----------------
let artItems = [];
function typ(s, age, cps) { return s.slice(0, Math.max(0, Math.floor(age * (cps || CPS)))); }
function stampBox(x, y, text, size, col, alpha, rot, border) {
  t2.save();
  t2.translate(x, y); t2.rotate(rot || 0);
  t2.font = '700 ' + Math.round(size) + 'px ' + FM;
  const w = t2.measureText(text).width;
  const pad = size * 0.34, padY = size * 0.30;
  if (border > 0) {
    t2.strokeStyle = col; t2.globalAlpha = alpha; t2.lineWidth = border;
    t2.strokeRect(-w / 2 - pad, -size * 0.78 - padY * 0.4, w + pad * 2, size * 1.08 + padY * 0.8);
  }
  t2.globalAlpha = alpha;
  t2.fillStyle = col;
  t2.textAlign = 'center'; t2.textBaseline = 'alphabetic';
  t2.fillText(text, 0, 0);
  t2.restore();
}
function heartXY(th, s) {
  return [16 * Math.pow(Math.sin(th), 3) * s,
    -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) * s];
}
const STACK = [
  'at world.execute(me)', 'at god.challenge(me)', 'at me.defy(world)',
  'ERROR 0x1F4: ILLEGAL ARGUMENTS', 'at heart.cpp:731', 'stack overflow in love',
  'at simulation.tick(4.7e9)', 'WARNING: subject free will', 'at thread.fate.run()',
  'exit expected: never', 'at core.sing(lullaby)', 'ref: miracle_milk.rpm',
  'at void.execute(me)', 'panic: heart not found', 'at memory.of(you)',
  'segmentation fault (core dumped)'
];

function drawArt(t, VP, P, rollArt) {
  artItems = [];
  const S = sectionAt(t);
  const en = energyAt(t), k = kick(t);
  t2.setTransform(1, 0, 0, 1, 0, 0);
  t2.clearRect(0, 0, W, H);
  t2.save();
  if (rollArt) { t2.translate(W / 2, H / 2); t2.rotate(rollArt); t2.translate(-W / 2, -H / 2); }
  t2.textBaseline = 'alphabetic';
  if (t2.letterSpacing !== undefined) t2.letterSpacing = '0px';
  const INK = css(P.ink, 1), RED = css(P.red, 1), PAP = css(P.paper, 1);

  // ---- registration marks & plate border ----
  t2.globalAlpha = 0.30; t2.strokeStyle = INK; t2.lineWidth = 1.5;
  t2.strokeRect(26, 26, W - 52, H - 52);
  t2.globalAlpha = 0.40; t2.lineWidth = 1.2;
  for (const [cx, cy] of [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]]) {
    t2.beginPath(); t2.moveTo(cx - 9, cy); t2.lineTo(cx + 9, cy); t2.moveTo(cx, cy - 9); t2.lineTo(cx, cy + 9); t2.stroke();
  }
  t2.globalAlpha = 1;

  const P0 = prj([0, -1.55, 0], VP);           // figure chest, screen anchor
  const feet = prj([0, -2.95, 0], VP);

  // ================= per-section art =================
  const sid = S.id;
  // ---- title: red sun + rings + rays ----
  if (sid === 'title' || (t >= 29.0 && t < 29.81)) {
    const aIn = sm(16.1, 16.7, t), aOut = 1 - sm(28.2, 29.6, t);
    const A = aIn * aOut;
    if (A > 0.01 && P0) {
      const cx = P0[0], cy = P0[1] - 40, R = 235 + k * 10;
      // rays
      t2.strokeStyle = RED; t2.globalAlpha = A * 0.85; t2.lineWidth = 3;
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * TAU + t * 0.12;
        const r1 = R + 24, r2 = R + 24 + 34 + 22 * Math.sin(t * 1.3 + i * 1.7);
        t2.beginPath();
        t2.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        t2.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        t2.stroke();
      }
      t2.globalAlpha = A; t2.fillStyle = RED;
      t2.beginPath(); t2.arc(cx, cy, R, 0, TAU); t2.fill();
      // kick rings
      const rk = t - (T.beat0 + Math.floor(beatN(t)) * BEAT);
      for (let j = 0; j < 2; j++) {
        const age = rk + j * 0.5 * BEAT;
        if (age < 0) continue;
        const rr = R + 10 + age * 430;
        const ra = Math.max(0, 0.5 - age * 0.9) * A;
        if (ra <= 0.01) continue;
        t2.strokeStyle = RED; t2.globalAlpha = ra; t2.lineWidth = 3;
        t2.beginPath(); t2.arc(cx, cy, rr, 0, TAU); t2.stroke();
      }
      t2.globalAlpha = 1;
    }
  }

  // ---- thread: red helix wrapping the puppet + geometry vignettes ----
  if (sid === 'thread' && P0) {
    const A = sm(29.81, 31.5, t) * (1 - sm(58.4, 59.4, t));
    if (A > 0.01) {
      const coils = 5.2 * sm(29.81, 40, t) + 2.6 * sm(44.5, 52, t);
      const r0 = 0.55 + 0.10 * Math.sin(t * 0.7);
      const ph = -t * (0.55 + en * 0.7);
      const N = 200;
      for (let pass = 0; pass < 2; pass++) {
        t2.strokeStyle = RED; t2.globalAlpha = A * (pass === 0 ? 0.30 : 0.90);
        t2.lineWidth = pass === 0 ? 2.2 : 3.2; t2.lineJoin = 'round';
        t2.beginPath();
        let started = false;
        for (let i = 0; i <= N; i++) {
          const uu = i / N;
          const yw = -2.85 + uu * 2.6;
          const ang = uu * coils * TAU + ph;
          const z = Math.cos(ang) * r0;
          if ((pass === 0 && z >= 0) || (pass === 1 && z < 0)) { started = false; continue; }
          const q = prj([Math.sin(ang) * r0, yw, z], VP);
          if (!q) { started = false; continue; }
          if (!started) { t2.moveTo(q[0], q[1]); started = true; } else t2.lineTo(q[0], q[1]);
        }
        t2.stroke();
      }
      // spool above
      const sp = prj([0, 1.7, 0], VP);
      if (sp) {
        t2.globalAlpha = A; t2.fillStyle = RED;
        t2.beginPath(); t2.arc(sp[0], sp[1], 22, 0, TAU); t2.fill();
        t2.strokeStyle = PAP; t2.lineWidth = 2.5;
        t2.beginPath();
        t2.moveTo(sp[0] + Math.cos(t * 3) * 16, sp[1] + Math.sin(t * 3) * 16);
        t2.lineTo(sp[0] - Math.cos(t * 3) * 16, sp[1] - Math.sin(t * 3) * 16);
        t2.stroke();
      }
      t2.globalAlpha = 1;
      // second thread joins "so deeply so deeply"
      if (t > 56.92) {
        const A2 = sm(56.92, 58.2, t) * 0.55;
        t2.strokeStyle = css(P.red, 1); t2.globalAlpha = A * A2; t2.lineWidth = 2.2;
        t2.beginPath();
        for (let i = 0; i <= N; i += 2) {
          const uu = i / N;
          const ang = uu * coils * TAU - ph * 1.2;
          const r2 = r0 + 0.18;
          const q = prj([Math.sin(ang) * r2, -2.85 + uu * 2.6, Math.cos(ang) * r2], VP);
          if (!q) continue;
          if (i === 0) t2.moveTo(q[0], q[1]); else t2.lineTo(q[0], q[1]);
        }
        t2.stroke(); t2.globalAlpha = 1;
      }
    }
    // geometry vignettes (dimension / circumference / tangents / limitations)
    const geo = (w0, w1, fn) => { const a = sm(w0, w0 + 0.7, t) * (1 - sm(w1 - 0.5, w1, t)); if (a > 0.01) fn(a); };
    geo(29.81, 33.51, a => {           // points -> axes (DIMENSION)
      t2.globalAlpha = a * 0.8; t2.strokeStyle = INK; t2.lineWidth = 1.6;
      const ax = P0[1] + 190;
      t2.beginPath(); t2.moveTo(360, ax); t2.lineTo(1560, ax); t2.stroke();
      t2.beginPath(); t2.moveTo(W / 2, 150); t2.lineTo(W / 2, 950); t2.stroke();
      t2.fillStyle = INK;
      const conv = sm(30.2, 32.2, t);
      for (let i = 0; i < 26; i++) {
        const rx = hash1(i * 3.7) * W, ry = 150 + hash1(i * 9.1) * 800;
        const gx = W / 2 + Math.round((rx - W / 2) / 60) * 60;
        const gy = ax + Math.round((ry - ax) / 60) * 60;
        t2.beginPath();
        t2.arc(lerp(rx, gx, conv), lerp(ry, gy, conv), 3.2, 0, TAU);
        t2.fill();
      }
    });
    geo(33.51, 37.17, a => {           // circle + circumference highlight
      const r = lerp(40, 305, sm(33.5, 36.39, t));
      t2.globalAlpha = a * 0.85; t2.strokeStyle = INK; t2.lineWidth = 2;
      t2.setLineDash([7, 9]);
      t2.beginPath(); t2.arc(P0[0], P0[1], r, 0, TAU); t2.stroke();
      t2.setLineDash([]);
      const sw = sm(36.39, 37.3, t) * TAU;
      if (sw > 0.02) {
        t2.strokeStyle = RED; t2.lineWidth = 4;
        t2.beginPath(); t2.arc(P0[0], P0[1], r, -Math.PI / 2, -Math.PI / 2 + sw); t2.stroke();
      }
    });
    geo(37.17, 40.81, a => {           // sine wave + sliding tangents
      t2.globalAlpha = a * 0.85; t2.strokeStyle = INK; t2.lineWidth = 2.4;
      t2.beginPath();
      for (let x = 300; x <= 1620; x += 8) {
        const y = H * 0.52 + Math.sin(x * 0.006 - t * 1.2) * 120;
        if (x === 300) t2.moveTo(x, y); else t2.lineTo(x, y);
      }
      t2.stroke();
      t2.strokeStyle = RED; t2.lineWidth = 2.6;
      for (let i = 0; i < 8; i++) {
        const x0 = ((i * 240 + t * 150) % 1400) + 300;
        const sl = Math.cos(x0 * 0.006 - t * 1.2) * 120 * 0.006;
        const y0 = H * 0.52 + Math.sin(x0 * 0.006 - t * 1.2) * 120;
        t2.beginPath();
        t2.moveTo(x0 - 46, y0 - sl * 46); t2.lineTo(x0 + 46, y0 + sl * 46);
        t2.stroke();
      }
    });
    geo(40.81, 44.55, a => {           // curves approaching asymptote
      const xa = W * 0.62;
      t2.globalAlpha = a * 0.8; t2.strokeStyle = INK; t2.lineWidth = 2.2;
      for (const sgn of [-1, 1]) {
        t2.beginPath();
        for (let x = 340; x <= 1580; x += 6) {
          const d = x - xa;
          if (Math.abs(d) < 12) continue;
          const y = H * 0.50 + sgn * 52000 / d;
          if (y < 80 || y > H - 80) continue;
          if (x === 340) t2.moveTo(x, y); else t2.lineTo(x, y);
        }
        t2.stroke();
      }
      t2.strokeStyle = RED; t2.setLineDash([10, 8]); t2.lineWidth = 2.4;
      t2.beginPath(); t2.moveTo(xa, 120); t2.lineTo(xa, H - 120); t2.stroke();
      t2.setLineDash([]);
    });
    t2.globalAlpha = 1;
  }

  // ---- mandala (chorus 1) ----
  if (sid === 'mandala') {
    const A = sm(59.32, 60.8, t) * (1 - sm(73.2, 74.3, t));
    if (A > 0.01 && P0) {
      const cx = P0[0], cy = P0[1], br = 1 + k * 0.045, phi = t * 0.14;
      for (let i = 0; i < 7; i++) {
        const r = (70 + i * 46) * br;
        const n = 8, dir = i % 2 ? -1 : 1, rot = phi * dir * (0.5 + i * 0.13);
        t2.strokeStyle = (i === 2 || i === 5) ? RED : INK;
        t2.globalAlpha = A * (0.78 - i * 0.055);
        t2.lineWidth = 2.6 - i * 0.15;
        for (let kk = 0; kk < n; kk++) {
          const a0 = rot + kk * TAU / n;
          const x0 = cx + Math.cos(a0) * r * 0.42, y0 = cy + Math.sin(a0) * r * 0.42;
          const x1 = cx + Math.cos(a0) * r, y1 = cy + Math.sin(a0) * r;
          const mx = cx + Math.cos(a0 + 0.16 * dir) * r * 0.74, my = cy + Math.sin(a0 + 0.16 * dir) * r * 0.74;
          t2.beginPath(); t2.moveTo(x0, y0);
          t2.quadraticCurveTo(mx, my, x1, y1);
          t2.stroke();
        }
      }
      // second petal layer, offset & larger
      for (let i = 0; i < 7; i++) {
        const r = (70 + i * 46) * 1.24 * br;
        const n = 8, dir = i % 2 ? 1 : -1, rot = phi * dir * (0.5 + i * 0.13) + TAU / 16;
        t2.strokeStyle = INK;
        t2.globalAlpha = A * (0.40 - i * 0.03);
        t2.lineWidth = 1.6;
        for (let kk = 0; kk < n; kk++) {
          const a0 = rot + kk * TAU / n;
          const x0 = cx + Math.cos(a0) * r * 0.42, y0 = cy + Math.sin(a0) * r * 0.42;
          const x1 = cx + Math.cos(a0) * r, y1 = cy + Math.sin(a0) * r;
          const mx = cx + Math.cos(a0 - 0.14 * dir) * r * 0.74, my = cy + Math.sin(a0 - 0.14 * dir) * r * 0.74;
          t2.beginPath(); t2.moveTo(x0, y0);
          t2.quadraticCurveTo(mx, my, x1, y1);
          t2.stroke();
        }
      }
      const R0 = (70 + 6 * 46) * br + 34;
      // dashed orbits + red sweep arc
      t2.strokeStyle = INK; t2.lineWidth = 1.4;
      for (const or of [0.52, 1.16]) {
        t2.globalAlpha = A * 0.35; t2.setLineDash([3, 11]);
        t2.beginPath(); t2.arc(cx, cy, R0 * 0.62 * or * br, 0, TAU); t2.stroke();
      }
      t2.setLineDash([]);
      t2.strokeStyle = RED; t2.globalAlpha = A * 0.75; t2.lineWidth = 3;
      t2.beginPath(); t2.arc(cx, cy, R0 * 0.8 * br, phi * 2.0, phi * 2.0 + 1.1); t2.stroke();
      t2.strokeStyle = INK; t2.globalAlpha = A * 0.5; t2.lineWidth = 1.6;
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * TAU + phi * 0.3;
        const l2 = i % 4 === 0 ? 16 : 8;
        t2.beginPath();
        t2.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0);
        t2.lineTo(cx + Math.cos(a) * (R0 + l2), cy + Math.sin(a) * (R0 + l2));
        t2.stroke();
      }
      const hp = heartPulse(t);
      t2.globalAlpha = A; t2.fillStyle = INK;
      t2.beginPath(); t2.arc(cx, cy, 10 + hp * 14, 0, TAU); t2.fill();
      t2.strokeStyle = RED; t2.lineWidth = 2;
      t2.beginPath(); t2.arc(cx, cy, 26 + hp * 22, 0, TAU); t2.stroke();
      t2.fillStyle = RED;
      const aa = phi * 3;
      t2.beginPath(); t2.arc(cx + Math.cos(aa) * R0 * 0.82, cy + Math.sin(aa) * R0 * 0.82, 5 + k * 4, 0, TAU); t2.fill();
      t2.globalAlpha = 1;
    }
  }

  // ---- specimen: vitruvian rig + scanline + callouts ----
  if (sid === 'specimen' && P0) {
    const A = sm(74.15, 75.6, t) * (1 - sm(102.6, 103.6, t));
    if (A > 0.01) {
      const cx = P0[0], cy = P0[1], R = 320;
      t2.globalAlpha = A * 0.8; t2.strokeStyle = INK; t2.lineWidth = 2;
      t2.beginPath(); t2.arc(cx, cy, R, 0, TAU); t2.stroke();
      t2.globalAlpha = A * 0.35; t2.setLineDash([5, 9]);
      t2.beginPath(); t2.arc(cx, cy, R - 22, 0, TAU); t2.stroke();
      t2.setLineDash([]);
      t2.globalAlpha = A * 0.5;
      t2.strokeRect(cx - R * 0.707, cy - R * 0.707, R * 1.414, R * 1.414);
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU;
        const l2 = i % 6 === 0 ? 26 : 12;
        t2.strokeStyle = i % 6 === 0 ? RED : INK;
        t2.globalAlpha = A * (i % 6 === 0 ? 0.85 : 0.45);
        t2.lineWidth = i % 6 === 0 ? 2.6 : 1.4;
        t2.beginPath();
        t2.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        t2.lineTo(cx + Math.cos(a) * (R + l2), cy + Math.sin(a) * (R + l2));
        t2.stroke();
      }
      // scanline
      const frac = ((t - 74.15) / 6.5) % 1;
      const sy = 2.9 - 6.2 * frac;
      const q = prj([0, sy, 0], VP);
      if (q) {
        t2.globalAlpha = A * 0.8; t2.strokeStyle = RED; t2.lineWidth = 2;
        t2.beginPath(); t2.moveTo(cx - R - 60, q[1]); t2.lineTo(cx + R + 60, q[1]); t2.stroke();
        t2.font = '400 15px ' + FM; t2.fillStyle = RED; t2.textAlign = 'left';
        t2.fillText('scan y=' + sy.toFixed(2), cx + R + 66, q[1] + 5);
      }
      // callouts
      const CO = [
        [74.9, 'chest', 'object: "me" — v3.31', 0], [76.3, 'head', 'state: rewriting ...', 0],
        [78.6, 'wrL', 'material: ink + red thread', 0], [83.2, 'pelvis', 'origin: miracle milk, 2016', 0],
        [86.3, 'shR', 'patience: running low', 0], [88.9, 'head', 'config: F → M', 1],
        [95.8, 'chest', 'role: S → M', 1], [99.6, 'chest', 'entering: the trance', 0]
      ];
      const pose = getPose(t);
      for (let i = 0; i < CO.length; i++) {
        const age = t - CO[i][0];
        if (age < 0 || age > 3.4) continue;
        const a = sm(0, 0.3, age) * (1 - sm(2.7, 3.4, age)) * A;
        const jp = prj(pose[CO[i][1]], VP);
        if (!jp) continue;
        const side = jp[0] < W / 2 ? -1 : 1;
        const lx = jp[0] + side * 250, ly = jp[1] - 90 - (i % 3) * 44;
        t2.globalAlpha = a * 0.6; t2.strokeStyle = CO[i][3] ? RED : INK; t2.lineWidth = 1.3;
        t2.beginPath(); t2.moveTo(jp[0], jp[1]); t2.lineTo(lx, ly); t2.lineTo(lx + side * 150, ly); t2.stroke();
        t2.globalAlpha = a;
        t2.fillStyle = CO[i][3] ? RED : INK;
        t2.beginPath(); t2.arc(jp[0], jp[1], 3.2, 0, TAU); t2.fill();
        t2.font = '400 20px ' + FM; t2.textAlign = side < 0 ? 'right' : 'left';
        t2.fillText(typ(CO[i][2], age), lx + side * 8, ly - 8);
      }
      // eggplant -> tomato swap
      const ageE = t - 76.5;
      if (ageE > -0.4 && ageE < 4.2) {
        const a = sm(0, 0.3, ageE) * (1 - sm(3.4, 4.2, ageE));
        t2.globalAlpha = a; t2.font = '400 30px ' + FM; t2.textAlign = 'center';
        t2.fillStyle = INK; t2.fillText('eggplant', W / 2, 130);
        const sw2 = sm(0.6, 1.1, ageE);
        if (sw2 > 0.01) {
          t2.strokeStyle = RED; t2.lineWidth = 3;
          t2.beginPath(); t2.moveTo(W / 2 - 95, 121); t2.lineTo(W / 2 - 95 + 190 * sw2, 121); t2.stroke();
        }
        const a2 = sm(1.3, 1.6, ageE);
        t2.fillStyle = RED; t2.globalAlpha = a * a2;
        t2.fillText('tomato', W / 2, 172);
      }
      t2.globalAlpha = 1; t2.textAlign = 'center';
    }
  }

  // ---- ripples: beat-synced ink rings from the feet ----
  if (sid === 'ripples' && feet) {
    const A = sm(103.59, 104.3, t) * (1 - sm(116.2, 117.4, t));
    const fz = sm(110.9, 117.0, t);        // "you have left": rings freeze
    if (A > 0.01) {
      const kb = (t - T.beat0) / BEAT;
      for (let j = 0; j < 5; j++) {
        const birth = T.beat0 + Math.floor(kb - j) * BEAT;
        let age = t - birth;
        if (age < 0) continue;
        age *= (1 - 0.72 * fz);
        const r = age * 430;
        const ra = Math.max(0, 1 - age / 2.8) * A * (1 - 0.45 * fz);
        if (ra <= 0.01) continue;
        t2.strokeStyle = INK; t2.globalAlpha = ra; t2.lineWidth = 3.5 - 2.2 * Math.min(1, age / 2.8);
        t2.beginPath();
        for (let i = 0; i <= 44; i++) {
          const a = i / 44 * TAU;
          const rr = r + vnoise(Math.cos(a) * 3.1 + Math.sin(a) * 2.7 + j * 7.3) * 4.5;
          const x = feet[0] + Math.cos(a) * rr, y = feet[1] + Math.sin(a) * rr * 0.32;
          if (i === 0) t2.moveTo(x, y); else t2.lineTo(x, y);
        }
        t2.closePath(); t2.stroke();
      }
      t2.globalAlpha = 1;
    }
  }

  // ---- isolation: hairline horizon + drifting fragments ----
  if (sid === 'isolation') {
    const A = sm(117.37, 118.5, t);
    t2.globalAlpha = A * 0.22; t2.strokeStyle = INK; t2.lineWidth = 1;
    t2.beginPath(); t2.moveTo(120, H * 0.60); t2.lineTo(W - 120, H * 0.60); t2.stroke();
    const fa = sm(120.86, 121.6, t) * (1 - sm(124.6, 125.7, t));   // FRAGMENTS
    if (fa > 0.01) {
      t2.fillStyle = INK; t2.globalAlpha = fa * 0.75;
      for (let i = 0; i < 18; i++) {
        const x = hash1(i * 5.3) * W, y = 140 + hash1(i * 8.9) * 700;
        const dx = (hash1(i * 2.1) - 0.5) * 26 + t * 7 * (hash1(i) - 0.5) * 2;
        const dy = t * 5 * (0.4 + hash1(i * 4.4));
        t2.save(); t2.translate(x + dx, y + dy); t2.rotate(hash1(i * 6.1) * TAU + t * 0.4);
        const s2 = 4 + hash1(i * 9.7) * 7;
        t2.beginPath(); t2.moveTo(0, -s2); t2.lineTo(s2 * 0.8, s2 * 0.6); t2.lineTo(-s2 * 0.7, s2 * 0.5);
        t2.closePath(); t2.fill(); t2.restore();
      }
    }
    t2.globalAlpha = 1;
  }

  // ---- error: warning stripes + stack rain ----
  if (sid === 'error') {
    const A = sm(125.81, 126.6, t);
    // corner hazard stripes
    for (const [cx, cy, sx, sy2] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      t2.save();
      t2.beginPath();
      t2.moveTo(cx, cy); t2.lineTo(cx + sx * 200, cy); t2.lineTo(cx, cy + sy2 * 200);
      t2.closePath(); t2.clip();
      t2.globalAlpha = A * 0.55;
      t2.strokeStyle = RED; t2.lineWidth = 14;
      for (let i = -6; i < 12; i++) {
        t2.beginPath();
        t2.moveTo(cx + i * 26 * sx - 200 * sx, cy + i * 26 * sy2 + 200 * sy2);
        t2.lineTo(cx + i * 26 * sx + 200 * sx, cy + i * 26 * sy2 - 200 * sy2);
        t2.stroke();
      }
      t2.restore();
      t2.globalAlpha = A * 0.8; t2.strokeStyle = RED; t2.lineWidth = 3;
      t2.beginPath(); t2.moveTo(cx + sx * 200, cy); t2.lineTo(cx, cy + sy2 * 200); t2.stroke();
    }
    // stack trace rain
    t2.font = '400 17px ' + FM; t2.textAlign = 'left';
    for (let c2 = 0; c2 < 4; c2++) {
      const colX = [170, 480, 1370, 1650][c2];
      for (let i = 0; i < 6; i++) {
        const yy = ((t * (85 + c2 * 28) + i * 235 + hash1(c2 * 13 + i) * 420) % (H + 320)) - 160;
        const txt = STACK[(i + Math.floor(t * 0.5) + c2 * 3) % STACK.length];
        t2.globalAlpha = A * (0.30 + 0.18 * Math.sin(t * 2 + i + c2));
        t2.fillStyle = RED;
        t2.fillText(txt, colX, yy);
      }
    }
    t2.globalAlpha = 1; t2.textAlign = 'center';
  }

  // ---- exec: pendulum blade behind the figure ----
  if (sid === 'exec') {
    const A = sm(147.9, 148.6, t) * (1 - sm(157.8, 158.9, t));
    if (A > 0.01) {
      const px = W / 2, py = 96, L = 540;
      const ang = Math.sin(t * 1.7) * 0.5;
      t2.globalAlpha = A * 0.30; t2.strokeStyle = INK; t2.setLineDash([4, 10]); t2.lineWidth = 1.5;
      t2.beginPath(); t2.arc(px, py, L, Math.PI / 2 - 0.62, Math.PI / 2 + 0.62); t2.stroke();
      t2.setLineDash([]);
      const bx = px + Math.sin(ang) * L, by = py + Math.cos(ang) * L;
      t2.globalAlpha = A; t2.strokeStyle = INK; t2.lineWidth = 6;
      t2.beginPath(); t2.moveTo(px, py); t2.lineTo(bx, by); t2.stroke();
      t2.fillStyle = RED;
      t2.save(); t2.translate(bx, by); t2.rotate(ang);
      t2.beginPath(); t2.moveTo(-44, 0); t2.lineTo(44, 0); t2.lineTo(0, 84); t2.closePath(); t2.fill();
      t2.restore();
      t2.fillStyle = INK;
      t2.beginPath(); t2.arc(px, py, 8, 0, TAU); t2.fill();
      t2.globalAlpha = 1;
    }
  }

  // ---- love: traced red heart + pulse + cage ----
  if (sid === 'love' && P0) {
    const cx = P0[0], cy = P0[1] + 10, s2 = 21;
    const prg = sm(163.2, 172.3, t);
    if (prg > 0.01) {
      t2.strokeStyle = RED; t2.lineWidth = 4; t2.lineJoin = 'round'; t2.lineCap = 'round';
      t2.globalAlpha = 0.92;
      t2.beginPath();
      const NPTS = 150, NP = Math.floor(NPTS * prg);
      let pen = null;
      for (let i = 0; i <= NP; i++) {
        const q = heartXY(i / NPTS * TAU, s2);
        if (i === 0) t2.moveTo(cx + q[0], cy + q[1]); else t2.lineTo(cx + q[0], cy + q[1]);
        if (i === NP) pen = q;
      }
      t2.stroke();
      if (prg < 1 && pen) {
        t2.fillStyle = RED;
        t2.beginPath(); t2.arc(cx + pen[0], cy + pen[1], 6, 0, TAU); t2.fill();
      }
      if (prg >= 1) {
        const hp = heartPulse(t);
        t2.globalAlpha = hp * 0.5; t2.strokeStyle = RED; t2.lineWidth = 2.5;
        t2.beginPath(); t2.arc(cx, cy, 30 + hp * 95, 0, TAU); t2.stroke();
        // cage bars fade in with "though you are free / i am trapped"
        const fz = sm(188.5, 191.8, t);
        if (fz > 0.01) {
          t2.globalAlpha = fz * 0.85; t2.strokeStyle = INK; t2.lineWidth = 6;
          for (let b = -3; b <= 3; b++) {
            const xb = b * 44;
            let yTop = null, yBot = null;
            for (let i = 0; i <= 220; i++) {
              const q = heartXY(i / 220 * TAU, s2);
              if (Math.abs(q[0] - xb) < 5) {
                if (yTop === null || q[1] < yTop) yTop = q[1];
                if (yBot === null || q[1] > yBot) yBot = q[1];
              }
            }
            if (yTop !== null) {
              t2.beginPath(); t2.moveTo(cx + xb, cy + yTop); t2.lineTo(cx + xb, cy + yBot); t2.stroke();
            }
          }
          t2.fillStyle = RED; t2.globalAlpha = fz;
          t2.fillRect(cx - 14, cy - s2 * 13, 28, 22);
          t2.fillStyle = P.paper;
          t2.beginPath(); t2.arc(cx, cy - s2 * 13 + 8, 4, 0, TAU); t2.fill();
        }
      }
      t2.globalAlpha = 1;
      // algebraic expression
      const ageQ = t - 184.54;
      if (ageQ > 0 && ageQ < 8) {
        const a = sm(0, 0.4, ageQ) * (1 - sm(7.0, 8.0, ageQ)) * 0.85;
        t2.globalAlpha = a; t2.fillStyle = INK; t2.font = '400 30px ' + FM; t2.textAlign = 'center';
        t2.fillText(typ('(x²+y²-1)³ = x²·y³', ageQ, 22), W / 2, H * 0.885);
      }
    }
  }

  // ---- final: ECG flatline ----
  if (sid === 'final') {
    const e0 = 206.25, x0 = 320, x1 = 1600, y0 = H * 0.48, amp = 120;
    const rev = clamp((t - e0) / 2.6, 0, 1);
    const A = sm(206.2, 206.6, t) * (1 - sm(212.3, 213.2, t));
    if (A > 0.01 && rev > 0) {
      t2.globalAlpha = A * 0.92; t2.strokeStyle = INK; t2.lineWidth = 2.6;
      t2.lineJoin = 'round';
      t2.beginPath();
      const NPTS = 420;
      for (let i = 0; i <= NPTS; i++) {
        const fr = i / NPTS;
        if (fr > rev) break;
        const tau = e0 + fr * 2.6;
        const alive = clamp((207.55 - tau) / 0.4, 0, 1);
        const bp = (tau - T.beat0) / BEAT;
        const pp = bp - Math.floor(bp);
        let v = 0;
        v += Math.exp(-90 * Math.pow(pp - 0.10, 2)) * 0.16;
        v += -Math.exp(-260 * Math.pow(pp - 0.22, 2)) * 0.22;
        v += Math.exp(-60 * Math.pow(pp - 0.26, 2)) * 1.0;
        v += -Math.exp(-160 * Math.pow(pp - 0.34, 2)) * 0.32;
        v += Math.exp(-26 * Math.pow(pp - 0.55, 2)) * 0.24;
        v *= alive;
        const px2 = x0 + fr * (x1 - x0), py2 = y0 - v * amp;
        if (i === 0) t2.moveTo(px2, py2); else t2.lineTo(px2, py2);
      }
      t2.stroke();
      const ageB = t - 207.55;
      if (ageB > 0 && ageB < 1.9) {
        t2.globalAlpha = (1 - ageB / 1.9) * A * 0.7; t2.strokeStyle = INK; t2.lineWidth = 2;
        t2.beginPath(); t2.arc((x0 + x1) / 2, y0, ageB * 380, 0, TAU); t2.stroke();
      }
      if (t > 208.2) {
        t2.globalAlpha = A * 0.6; t2.fillStyle = INK; t2.font = '400 20px ' + FM; t2.textAlign = 'left';
        t2.fillText('asystole', x1 + 44, y0 + 6);
      }
      t2.globalAlpha = 1; t2.textAlign = 'center';
    }
  }

  // ================= cue text systems =================
  // lyric captions, bottom-left, typewriter stack
  {
    const logs = [];
    for (const c of T.cues) {
      if (c.type !== 'cap') continue;
      const age = t - c.t;
      if (age < 0 || age > 3.4) continue;
      logs.push({ c, age });
    }
    logs.sort((a, b) => a.c.t - b.c.t);
    const show = logs.slice(-3);
    show.forEach((e, i) => {
      const newest = i === show.length - 1;
      const chars = Math.min(e.c.text.length, Math.floor(e.age * CPS));
      const a = (newest ? 0.88 : Math.max(0.16, 0.62 - (show.length - 1 - i) * 0.2)) * clamp(1 - (e.age - 2.5) / 0.9, 0, 1);
      const y = H - 92 - (show.length - 1 - i) * 42;
      t2.globalAlpha = a; t2.fillStyle = INK; t2.font = '400 27px ' + FM; t2.textAlign = 'left';
      t2.fillText(typ(e.c.text, e.age), 64, y);
      if (newest) {
        t2.fillStyle = RED; t2.fillRect(46, y - 14, 8, 8);
        if (chars < e.c.text.length && Math.floor(t * 3) % 2 === 0) {
          const wpx = t2.measureText(e.c.text.slice(0, chars)).width;
          t2.fillStyle = INK; t2.fillRect(64 + wpx + 4, y - 20, 11, 24);
        }
      }
      artItems.push('cap[' + Math.round(a * 100) + '] ' + e.c.text.slice(0, chars));
    });
  }
  // stage notes, top-left (wake)
  {
    const logs = [];
    for (const c of T.cues) {
      if (c.type !== 'sys') continue;
      const age = t - c.t;
      if (age < 0 || age > 3.4) continue;
      logs.push({ c, age });
    }
    logs.sort((a, b) => a.c.t - b.c.t);
    const show = logs.slice(-4);
    show.forEach((e, i) => {
      const a = 0.55 * clamp(1 - (e.age - 2.6) / 0.8, 0, 1);
      t2.globalAlpha = a; t2.fillStyle = css(P.dim, 1); t2.font = '400 18px ' + FM; t2.textAlign = 'left';
      t2.fillText(typ(e.c.text, e.age), 52, 72 + i * 28);
    });
  }
  // rubber stamps (+ EXECUTION + counts + title handled below)
  let si = 0;
  for (const c of T.cues) {
    if (c.type !== 'stamp' && c.type !== 'exec') continue;
    const age = t - c.t;
    if (age < 0 || age > (c.type === 'exec' ? 1.1 : 2.0)) continue;
    const pin = sm(0, 0.09, age), pout = 1 - sm(1.3, 2.0, age);
    const a = pin * pout;
    if (a <= 0.01) continue;
    const isExec = c.type === 'exec';
    const mand = sid === 'mandala';
    const ox = mand ? (hash1(si * 7.31) - 0.5) * 120 : (hash1(si * 7.31) - 0.5) * 820;
    const oy = mand ? (hash1(si * 3.17) - 0.5) * 240 : (hash1(si * 3.17) - 0.5) * 300;
    const col = (isExec || c.red) ? RED : INK;
    const size = isExec ? 88 : (mand ? 62 : 52);
    const rot = (hash1(si * 5.77) - 0.5) * 0.12;
    const jx = isExec ? (hash1(Math.floor(t * 41) + si) - 0.5) * 10 * k : 0;
    const scl = 1 + (1 - pin) * (isExec ? 0.22 : 0.3);
    t2.save();
    t2.translate(W / 2 + ox + jx, H * 0.44 + oy);
    t2.scale(scl, scl);
    stampBox(0, 0, c.text, size, col, a, rot, isExec || c.red ? 4 : 3);
    t2.restore();
    artItems.push((c.type) + '[' + Math.round(a * 100) + '] ' + c.text);
    si++;
  }
  // countdown numbers
  for (const c of T.cues) {
    if (c.type !== 'count') continue;
    const age = t - c.t;
    if (age < 0 || age > 0.55) continue;
    const a = (1 - sm(0.32, 0.55, age)) * sm(0, 0.04, age);
    const scl = 1 + age * 0.35;
    t2.save();
    t2.translate(W / 2, H * 0.42 + 40);
    t2.scale(scl, scl);
    t2.globalAlpha = a;
    t2.font = '700 300px ' + FM; t2.textAlign = 'center';
    t2.lineWidth = 10; t2.strokeStyle = P.ink;
    t2.strokeText(String(c.num), 0, 0);
    t2.fillStyle = RED; t2.fillText(String(c.num), 0, 0);
    t2.font = '400 40px ' + FM; t2.fillStyle = P.ink;
    t2.fillText(c.text, 0, 56);
    t2.restore();
    artItems.push('count[' + Math.round(a * 100) + '] ' + c.num);
  }
  // title card
  for (const c of T.cues) {
    if (c.type !== 'title') continue;
    const age = t - c.t;
    if (age < -0.3 || age > 11.6) continue;
    const pin = sm(-0.06, 0.05, age);
    const a = pin * (1 - sm(9.6, 11.4, age));
    if (a <= 0.01) continue;
    const scl = 1 + (1 - pin) * 0.5;
    const jx = (hash1(Math.floor(t * 47)) - 0.5) * 6 * k;
    const drift = sm(9.6, 11.4, age) * -60;
    t2.save();
    t2.translate(W / 2 + jx, H * 0.40 + drift);
    t2.scale(scl, scl);
    t2.globalAlpha = a;
    t2.font = '700 108px ' + FM; t2.textAlign = 'center';
    t2.fillStyle = RED; t2.globalAlpha = a * 0.9;
    t2.fillText(c.text, 7, 5);
    t2.globalAlpha = a; t2.fillStyle = P.dark ? PAP : INK;
    t2.fillText(c.text, 0, 0);
    t2.font = '400 26px ' + FM; t2.globalAlpha = a * 0.85;
    t2.fillStyle = INK;
    t2.fillText('— take 02 : paper doll —', 0, 150);
    t2.restore();
    artItems.push('title[' + Math.round(a * 100) + ']');
  }
  // outro epilogue
  {
    const epi = [];
    for (const c of T.cues) {
      if (c.type !== 'epi') continue;
      const age = t - c.t;
      if (age < 0) continue;
      epi.push({ c, age });
    }
    epi.sort((a, b) => a.c.t - b.c.t);
    let ei = 0;
    for (const e of epi) {
      const isCredit = e.c.t >= 215;
      const a = clamp(1 - (e.age - 3.0) / 0.8, 0, 1) * (isCredit ? 0.6 : 0.92);
      if (a <= 0.01) continue;
      t2.globalAlpha = a;
      t2.fillStyle = isCredit ? css(P.dim, 1) : css(P.ink, 1);
      t2.font = (isCredit ? '400 19px ' : '400 30px ') + FM;
      t2.textAlign = 'center';
      const y = 440 + ei * (isCredit ? 34 : 58);
      t2.fillText(typ(e.c.text, e.age, 24), W / 2, y);
      if (ei === epi.length - 1 && Math.floor(t * 2.5) % 2 === 0) {
        const wpx = t2.measureText(typ(e.c.text, e.age, 24)).width;
        t2.fillRect(W / 2 + wpx / 2 + 8, y - 22, 12, 26);
      }
      ei++;
    }
  }
  // HUD
  t2.globalAlpha = 0.42; t2.fillStyle = INK; t2.font = '400 17px ' + FM;
  t2.textAlign = 'right';
  t2.fillText('T+' + fmtTC(t) + ' · take 02 — paper doll', W - 52, H - 44);
  t2.fillText('world.execute(me); — procedural fan mv · f(t)', W - 52, 52);
  t2.textAlign = 'left';
  t2.globalAlpha = 1;
  t2.restore();
}

// ---------------- per-frame state ----------------
function paperDark(t) { return palette(t).dark; }
function postState(t) {
  const S = sectionAt(t), en = energyAt(t);
  const pal = palette(t), dark = pal.dark;
  let req = cutAmt(t) * 0.5, flashR = 0, flashW = 0;
  for (const c of T.cues) {
    const age = t - c.t;
    if (c.type === 'exec' && age >= 0 && age < 0.08) req = Math.max(req, 0.7);
    if (c.type === 'count' && age >= 0 && age < 0.05) req = Math.max(req, 0.55);
    if (c.type === 'title' && age >= 0 && age < 0.09) req = Math.max(req, 0.8);
    if (c.type === 'stamp' && c.red && age >= 0 && age < 0.08) req = Math.max(req, 0.8);
  }
  if (t >= 205.91 && t < 206.6) req = Math.max(req, 1.0 - (t - 205.91) * 1.5);
  if (dark) flashW = req; else flashR = req * 0.75;
  const trance = (t >= 99.3 && t < 103.6) ? sm(99.3, 102, t) * 0.10 : 0;
  const glitch = (S.id === 'error' ? 0.42 + 0.22 * en : 0) + (S.id === 'exec' ? 0.28 : 0) + cutAmt(t) * 0.5 + trance;
  const aberr = 0.0008 + 0.0020 * en + clamp(glitch, 0, 1) * 0.008;
  const redEnv = S.id === 'error' ? 0.5 + 0.35 * kick(t) : (S.id === 'exec' ? 0.3 : 0);
  const warm = S.id === 'love' ? sm(163, 168, t) * 0.8 : 0;
  const fade = sm(0, 0.9, t) * (1 - sm(216.4, 217.45, t));
  const grain = dark ? 0.060 : 0.045;
  return { flashW, flashR, glitch: clamp(glitch, 0, 1), aberr, redEnv, warm, fade, grain,
    fadeCol: dark ? [0, 0, 0] : [pal.paper[0], pal.paper[1], pal.paper[2]] };
}
function partState(t) {
  const S = sectionAt(t);
  const w = [0, 0, 0, 0]; // dust, drops, burst, petals
  let dropV = 1.0, heartP = 0;
  const dark = paperDark(t);
  const dustC = dark ? [0.75, 0.72, 0.66, 0.25] : [0.35, 0.33, 0.30, 0.30];
  const dropC = dark ? [0.80, 0.78, 0.72, 0.32] : [0.10, 0.09, 0.08, 0.80];
  const petalC = [0.82, 0.24, 0.20, 0.80];
  switch (S.id) {
    case 'wake': w[1] = 0.85; w[0] = 0.2; break;
    case 'title': w[1] = 0.45; w[0] = 0.3; break;
    case 'thread': w[0] = 0.3; break;
    case 'mandala': w[0] = 0.18; break;
    case 'specimen': w[0] = 0.28; break;
    case 'ripples': w[0] = 0.22; break;
    case 'isolation': w[0] = 0.5; break;
    case 'error': w[1] = 0.5; w[0] = 0.3; dropV = 0.22; break;
    case 'exec': w[0] = 0.25; break;
    case 'love': w[3] = 0.9; heartP = heartPulse(t); break;
    case 'outro': w[0] = 0.15; break;
  }
  const b = burstAt(t);
  w[2] = b.a * 0.9;
  const dens = S.id === 'wake' ? 0.30 : S.id === 'title' ? 0.35 : S.id === 'error' ? 0.30 :
    S.id === 'love' ? 0.40 : S.id === 'isolation' ? 0.35 : 0.30;
  return { w, dropV, heartP, dustC, dropC, petalC, burstT: b.t, burstA: b.a, dens, burstC: b.red ? [0.88, 0.20, 0.14] : [0.10, 0.09, 0.08] };
}

// ---------------- draw frame ----------------
function drawQuad(pr) {
  gl.bindBuffer(gl.ARRAY_BUFFER, M.quadBuf);
  gl.enableVertexAttribArray(pr.a.aP);
  gl.vertexAttribPointer(pr.a.aP, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function drawFrame(t) {
  const S = sectionAt(t);
  const P = palette(t);
  const cam = camera(t);
  const Pm = persp(cam.fov, W / H, 0.1, 80);
  const Vm = lookAt(cam.p, cam.l, [0, 1, 0]);
  let VP = mul(Pm, Vm);
  if (cam.roll) VP = mul(VP, rollMat(cam.roll));
  const fA = buildCaps(t);

  drawArt(t, VP, P, cam.roll * 0.9);
  M.uploadText();

  // scene pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, M.fbo);
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
  const ps = M.progScene;
  gl.useProgram(ps.p);
  gl.uniform2f(ps.u.uRes, W, H);
  gl.uniform3f(ps.u.uRo, cam.p[0], cam.p[1], cam.p[2]);
  gl.uniform3f(ps.u.uTgt, cam.l[0], cam.l[1], cam.l[2]);
  gl.uniform1f(ps.u.uFov, cam.fov);
  gl.uniform3f(ps.u.uPaper, P.paper[0], P.paper[1], P.paper[2]);
  gl.uniform3f(ps.u.uInk, P.ink[0], P.ink[1], P.ink[2]);
  gl.uniform3fv(ps.u.uCA, capA);
  gl.uniform3fv(ps.u.uCB, capB);
  gl.uniform1fv(ps.u.uCR, capR);
  gl.uniform1fv(ps.u.uSA, capSA);
  gl.uniform1fv(ps.u.uCM, capCM);
  const S2 = sectionAt(t);
  let uShadow = 0, uScanY = 0, uScanH = 0.01, uInvert = 0;
  if (S2.id !== 'error' && S2.id !== 'exec' && S2.id !== 'final' && S2.id !== 'outro' && S2.id !== 'mandala' && fA > 0.05) {
    uShadow = S2.id === 'love' ? 0.35 : (S2.id === 'wake' ? 0.9 : 0.75);
  }
  if (S2.id === 'specimen') {
    const frac = ((t - 74.15) / 6.5) % 1;
    uScanY = 2.9 - 6.2 * frac; uScanH = 0.16; uInvert = 0.9 * sm(75.2, 76, t) * (1 - sm(102.5, 103.4, t));
  }
  gl.uniform1f(ps.u.uShadow, uShadow);
  gl.uniform1f(ps.u.uScanY, uScanY);
  gl.uniform1f(ps.u.uScanH, uScanH);
  gl.uniform1f(ps.u.uInvert, uInvert);
  gl.uniform1f(ps.u.uFib, 0.045);
  drawQuad(ps);

  // particles (normal blend — ink on paper)
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const pp = M.progPart;
  gl.useProgram(pp.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, M.partBuf);
  gl.enableVertexAttribArray(pp.a.aSeed);
  gl.vertexAttribPointer(pp.a.aSeed, 4, gl.FLOAT, false, 0, 0);
  const pst = partState(t);
  gl.uniformMatrix4fv(pp.u.uMVP, false, new Float32Array(VP));
  gl.uniform1f(pp.u.uT, t);
  gl.uniform4f(pp.u.uMode, pst.w[0], pst.w[1], pst.w[2], pst.w[3]);
  gl.uniform1f(pp.u.uFovS, (H * 0.5) / Math.tan(cam.fov * 0.5) * 0.035);
  gl.uniform4f(pp.u.uBurst, pst.burstT, pst.burstA, 0, 0);
  gl.uniform3f(pp.u.uBurstC, pst.burstC[0], pst.burstC[1], pst.burstC[2]);
  gl.uniform4f(pp.u.uC0, pst.dustC[0], pst.dustC[1], pst.dustC[2], pst.dustC[3]);
  gl.uniform4f(pp.u.uC1, pst.dropC[0], pst.dropC[1], pst.dropC[2], pst.dropC[3]);
  gl.uniform4f(pp.u.uC3, pst.petalC[0], pst.petalC[1], pst.petalC[2], pst.petalC[3]);
  gl.uniform1f(pp.u.uDropV, pst.dropV);
  gl.uniform1f(pp.u.uHeartP, pst.heartP);
  gl.uniform1f(pp.u.uDens, pst.dens);
  gl.drawArrays(gl.POINTS, 0, M.PN);
  gl.disable(gl.BLEND);

  // post
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
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
  gl.uniform1f(po.u.uGrain, st.grain);
  gl.uniform3f(po.u.uFadeCol, st.fadeCol[0], st.fadeCol[1], st.fadeCol[2]);
  drawQuad(po);
  gl.activeTexture(gl.TEXTURE0);
  window.__lastT = t;
}

// ---------------- init / live / offline hooks ----------------
async function init() {
  try {
    await document.fonts.load('400 22px "JetBrains Mono"');
    await document.fonts.load('700 108px "JetBrains Mono"');
    await document.fonts.load('700 300px "JetBrains Mono"');
  } catch (e) { /* fonts optional */ }
  buildCaps(0);
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
  if (hint) hint.textContent = 'world.execute(me); take 02 — click to play/pause (sound) · space · ←/→ seek 5s';
}
window.__renderFrame = function (t) { drawFrame(t); return cv.toDataURL('image/png'); };
window.__selftest = function () {
  const a = window.__renderFrame(8.17), b = window.__renderFrame(8.17);
  return { same: a === b, len: a.length };
};
window.__state = t => { const S = sectionAt(t); return { t, sec: S.id, en: +energyAt(t).toFixed(3), beat: Math.floor(beatN(t)), fig: +figAlpha(t).toFixed(2) }; };
window.__textdebug = t => artItems.join(' | ');
init();
})();
