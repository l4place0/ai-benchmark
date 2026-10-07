/* =====================================================================
   THE INSTRUMENT  —  core math / noise / color utilities
   Everything is a pure function of (t, timeline). No Math.random().
   ===================================================================== */
'use strict';

const TAU = Math.PI * 2;

// ---------- deterministic hash / noise ----------
function hash11(n) {
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function hash21(x, y) { return hash11(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)); }
function hash31(x, y, z) { return hash11(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)); }

function smooth(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function sat(v) { return clamp(v, 0, 1); }
function mix(a, b, t) { return a + (b - a) * t; }

// value noise 2D
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash21(xi, yi), b = hash21(xi + 1, yi), c = hash21(xi, yi + 1), d = hash21(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4, gain = 0.5, lac = 2.0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
  return s / norm;
}

// ---------- easing ----------
const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => { if (t === 0 || t === 1) return t; const c4 = TAU / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: t => Math.sin(t * Math.PI / 2),
  inSine: t => 1 - Math.cos(t * Math.PI / 2),
};

// ---------- color ----------
function rgb(r, g, b) { return [r, g, b]; }
function mixc(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
function scalec(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function addc(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function css(c, a) {
  const r = clamp(Math.round(c[0] * 255), 0, 255),
        g = clamp(Math.round(c[1] * 255), 0, 255),
        b = clamp(Math.round(c[2] * 255), 0, 255);
  return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

// Palette — derived from the song's chroma (D, A, G strongest).
const PAL = {
  void:    [0.012, 0.014, 0.022],
  deep:    [0.030, 0.045, 0.075],
  amber:   [1.000, 0.620, 0.200],
  gold:    [1.000, 0.800, 0.420],
  cyan:    [0.250, 0.760, 1.000],
  ice:     [0.600, 0.900, 1.000],
  magenta: [1.000, 0.260, 0.700],
  violet:  [0.680, 0.320, 1.000],
  green:   [0.500, 1.000, 0.450],
  red:     [1.000, 0.180, 0.160],
  white:   [1.000, 1.000, 1.000],
  grey:    [0.450, 0.520, 0.620],
  ash:     [0.200, 0.220, 0.260],
};

// ---------- projection: a real 3D camera for the lattice ----------
/**
 * Orbit camera that always LOOKS AT `target`.
 * `yaw`/`pitch` rotate the camera around the target, `dist` is its distance.
 * Without this the subject swings out of frame whenever yaw changes.
 */
function makeOrbitCam(target, dist, yaw, pitch, roll, fov, w, h) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  // camera position on a sphere around the target
  const cx = target[0] + dist * cp * syw;
  const cy = target[1] + dist * sp;
  const cz = target[2] + dist * cp * cyw;
  // view basis: forward = normalize(target - camPos)
  let fx = target[0] - cx, fy = target[1] - cy, fz = target[2] - cz;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // right = normalize(cross(worldUp, forward))  with worldUp = (0,1,0)
  let rx = fz * 1 - fy * 0, ry = fx * 0 - fz * 0, rz = fy * 0 - fx * 1;
  // cross((0,1,0), f) = (1*fz - 0*fy, 0*fx - 0*fz, 0*fy - 1*fx) = (fz, 0, -fx)
  rx = fz; ry = 0; rz = -fx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // up = cross(forward, right)
  let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
  // apply roll about the view axis
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const rx2 = rx * cr + ux * sr, ry2 = ry * cr + uy * sr, rz2 = rz * cr + uz * sr;
  const ux2 = ux * cr - rx * sr, uy2 = uy * cr - ry * sr, uz2 = uz * cr - rz * sr;

  return {
    f: (h * 0.5) / Math.tan(fov * 0.5),
    w, h, cx, cy, cz, dist,
    project(x, y, z) {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      // camera space: z = depth along forward
      const zc = dx * fx + dy * fy + dz * fz;
      if (zc <= 1) return null;
      const xc = dx * rx2 + dy * ry2 + dz * rz2;
      const yc = dx * ux2 + dy * uy2 + dz * uz2;
      const s = this.f / zc;
      return { x: this.w * 0.5 + xc * s, y: this.h * 0.5 - yc * s, z: zc, s };
    }
  };
}

// legacy signature retained for any callers that pass a camera position directly
function makeCam(cx, cy, cz, yaw, pitch, roll, fov, w, h) {
  return makeOrbitCam([0, 0, 0], Math.max(1, Math.hypot(cx, cy, cz)), Math.atan2(cx, cz),
                      Math.asin(clamp(cy / Math.max(1, Math.hypot(cx, cy, cz)), -1, 1)), roll, fov, w, h);
}

// ---------- misc ----------
function phyllotaxis(i, c) {          // golden-angle lattice
  const a = i * 2.399963229728653;    // 137.5077 deg
  const r = c * Math.sqrt(i);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

// smooth pulse locked to the beat grid
function beatPulse(t, tl, decay = 6.0) {
  const ph = (t - tl.offset) / tl.period;
  const frac = ph - Math.floor(ph);
  return Math.exp(-frac * decay);
}
function barPulse(t, tl, decay = 4.0) {
  const ph = (t - tl.offset) / (tl.period * 4);
  const frac = ph - Math.floor(ph);
  return Math.exp(-frac * decay);
}

if (typeof module !== 'undefined') module.exports = {
  TAU, hash11, hash21, hash31, smooth, lerp, clamp, sat, mix, vnoise, fbm, ease,
  rgb, mixc, scalec, addc, css, PAL, makeCam, phyllotaxis, beatPulse, barPulse
};
