/* =====================================================================
   SCENES — the machine's body and the world it is trapped in.
   Each scene is a pure function of (t, ctx). Beat-locked via tl.
   ===================================================================== */
'use strict';

const G = this;   // window scope in browser

// ------------------------------------------------------------------ helpers
/**
 * The film's core primitive: a golden-angle (phyllotactic) lattice.
 * `c` is normalised so the lattice always fills roughly `radius` world units,
 * regardless of point count -- that keeps framing stable across the whole film.
 */
function drawPointsLattice(g, opts) {
  const { n, cam, color, size, alpha, spin, phase, jitter, thresh } = opts;
  const z = opts.z === undefined ? 0 : opts.z;
  // normalise: r = c*sqrt(i) so that r(n) == radius  =>  c = radius/sqrt(n)
  const radius = opts.radius === undefined ? 700 : opts.radius;
  const c = radius / Math.sqrt(Math.max(n, 2));
  const wave = opts.wave || 0;
  const pts = new Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963229728653 + spin;
    const r = c * Math.sqrt(i);
    let x = Math.cos(a) * r, y = Math.sin(a) * r;
    const zz = z + Math.sin(i * 0.7 + phase) * (jitter || 0);
    y += Math.sin(r * 0.02 - phase * 1.4) * wave;
    if (thresh !== undefined && hash11(i * 7 + Math.floor(phase * 3)) > thresh) continue;
    const p = cam.project(x, y, zz);
    if (!p) continue;
    pts[k++] = [p.x, p.y, size * p.s * (0.6 + 0.4 * hash11(i * 13)), p.z];
  }
  pts.length = k;
  // painter's algorithm: far to near
  pts.sort((a, b) => b[3] - a[3]);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < k; i++) {
    const p = pts[i];
    const fade = clamp(1.7 - p[3] / (z * 2 + radius * 2 + 1), 0.10, 1);
    g.fillStyle = css(color, alpha * fade);
    g.beginPath();
    g.arc(p[0], p[1], Math.max(0.4, p[2]), 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return pts;
}

/**
 * Luminous filaments: connect each lattice point to its near neighbours.
 * This is what turns a sparse point cloud into a *body* that fills the frame,
 * and it reads as both a neural net and an iris.
 */
function drawLatticeWeb(g, opts) {
  const { n, cam, color, alpha, spin, phase, jitter, links, lw, radius } = opts;
  const z = opts.z === undefined ? 0 : opts.z;
  const R = radius === undefined ? 800 : radius;
  const c = R / Math.sqrt(Math.max(n, 2));
  const wave = opts.wave || 0;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n), ok = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963229728653 + spin;
    const r = c * Math.sqrt(i);
    let x = Math.cos(a) * r, y = Math.sin(a) * r;
    const zz = z + Math.sin(i * 0.7 + phase) * (jitter || 0);
    y += Math.sin(r * 0.02 - phase * 1.4) * wave;
    const p = cam.project(x, y, zz);
    if (!p) { ok[i] = 0; continue; }
    ok[i] = 1; px[i] = p.x; py[i] = p.y; pz[i] = p.z;
  }
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = lw === undefined ? 1 : lw;
  const K = links === undefined ? 3 : links;
  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    // connect to the next K points on the spiral (they are the geometric neighbours)
    for (let d = 1; d <= K; d++) {
      const j = i + d;
      if (j >= n || !ok[j]) continue;
      const far = (pz[i] + pz[j]) * 0.5;
      const fade = clamp(1.5 - far / (R * 2.6), 0.04, 1);
      g.strokeStyle = css(color, alpha * fade / d);
      g.beginPath();
      g.moveTo(px[i], py[i]);
      g.lineTo(px[j], py[j]);
      g.stroke();
    }
  }
  // long-range spokes every few points: the structural "ribs"
  if (opts.spokes) {
    for (let i = 0; i < n; i += opts.spokes) {
      if (!ok[i]) continue;
      const a = i * 2.399963229728653 + spin;
      const r = c * Math.sqrt(i);
      const p = cam.project(0, 0, z);
      if (!p) continue;
      const far = pz[i];
      const fade = clamp(1.4 - far / (R * 2.4), 0.03, 1);
      g.strokeStyle = css(color, alpha * 0.45 * fade);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(px[i], py[i]);
      g.stroke();
    }
  }
  g.globalCompositeOperation = 'source-over';
}

/**
 * Filled radial core: a soft luminous mass at the centre of the lattice.
 * Gives the composition a subject to look at instead of only texture.
 */
function drawCore(g, cam, cx, cy, cz, radius, inner, outer, alpha, t) {
  const p = cam.project(cx, cy, cz);
  if (!p) return;
  // createRadialGradient/arc throw on a non-positive radius
  const R = Math.max(1, radius * p.s);
  if (!isFinite(R)) return;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
  gr.addColorStop(0.00, css(inner, alpha));
  gr.addColorStop(0.18, css(mixc(inner, outer, 0.4), alpha * 0.62));
  gr.addColorStop(0.52, css(outer, alpha * 0.20));
  gr.addColorStop(1.00, css(outer, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(p.x, p.y, R, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';
}

// the machine's "eye" — a ring of photophores around a dark pupil
function drawEye(g, cx, cy, R, t, P) {
  const { iris, pupil, glow, lidOpen, irisSpin } = P;
  const spin = irisSpin || 0;

  // outer glow
  const gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.6);
  gr.addColorStop(0, css(glow, 0.55));
  gr.addColorStop(0.45, css(glow, 0.13));
  gr.addColorStop(1, css(glow, 0));
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.fillRect(cx - R * 2.8, cy - R * 2.8, R * 5.6, R * 5.6);
  g.globalCompositeOperation = 'source-over';

  // iris ring: fine radial fibres
  g.save();
  g.translate(cx, cy);
  g.globalCompositeOperation = 'lighter';
  const N = 220;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + spin;
    const w = 0.35 + 0.65 * vnoise(i * 0.21, t * 0.35);
    const r0 = R * (0.42 + 0.10 * vnoise(i * 0.5, 3.1));
    const r1 = R * (0.92 + 0.10 * w);
    g.strokeStyle = css(mixc(iris, PAL.white, w * 0.45), 0.10 + 0.34 * w);
    g.lineWidth = 0.7 + 1.7 * w;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';

  // pupil
  const pg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.52);
  pg.addColorStop(0, '#000');
  pg.addColorStop(0.72, '#000');
  pg.addColorStop(1, css(pupil, 0.85));
  g.fillStyle = pg;
  g.beginPath(); g.arc(0, 0, R * 0.52, 0, TAU); g.fill();

  // specular
  g.globalCompositeOperation = 'lighter';
  const sg = g.createRadialGradient(-R * 0.18, -R * 0.20, 0, -R * 0.18, -R * 0.20, R * 0.34);
  sg.addColorStop(0, css(PAL.white, 0.55));
  sg.addColorStop(1, css(PAL.white, 0));
  g.fillStyle = sg;
  g.beginPath(); g.arc(-R * 0.18, -R * 0.20, R * 0.34, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.restore();

  // eyelids (the lidOpen parameter: 0 = shut, 1 = open)
  if (lidOpen < 1) {
    const cover = (1 - lidOpen) * R * 1.35;
    g.fillStyle = css(PAL.void, 1);
    g.beginPath(); g.rect(cx - R * 1.6, cy - R * 1.6, R * 3.2, cover); g.fill();
    g.beginPath(); g.rect(cx - R * 1.6, cy + R * 1.6 - cover, R * 3.2, cover); g.fill();
  }
}

// a wireframe ring in 3D
function ring3D(g, cam, R, z, segs, color, alpha, lw, spin, squash) {
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = css(color, alpha);
  g.lineWidth = lw;
  g.beginPath();
  let started = false;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * TAU + (spin || 0);
    const p = cam.project(Math.cos(a) * R, Math.sin(a) * R * (squash === undefined ? 1 : squash), z);
    if (!p) { started = false; continue; }
    if (!started) { g.moveTo(p.x, p.y); started = true; } else g.lineTo(p.x, p.y);
  }
  g.stroke();
  g.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------ text helpers
function drawText(g, str, x, y, opts) {
  const { size = 40, font = 'monospace', weight = '400', color = PAL.white,
          alpha = 1, align = 'center', baseline = 'middle', spacing = 0, glow = 0 } = opts || {};
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (glow > 0) { g.shadowColor = css(color, 0.9); g.shadowBlur = glow; }
  if (spacing === 0) {
    g.fillStyle = css(color, alpha);
    g.fillText(str, x, y);
  } else {
    // letter-spaced
    const chars = [...str];
    const widths = chars.map(c => g.measureText(c).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    let cx = x - (align === 'center' ? total / 2 : align === 'right' ? total : 0);
    g.fillStyle = css(color, alpha);
    for (let i = 0; i < chars.length; i++) {
      g.fillText(chars[i], cx + widths[i] / 2 - spacing / 2, y);
      cx += widths[i];
    }
  }
  g.restore();
}

// typewriter reveal: returns {str, caret}
function typeOut(str, k) {
  const n = Math.floor(clamp(k, 0, 1) * str.length);
  return { str: str.slice(0, n), done: n >= str.length };
}

// ------------------------------------------------ background treatments
function bgGradient(g, W, H, top, bot) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, css(top));
  gr.addColorStop(1, css(bot));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function bgRadial(g, W, H, c, k) {
  g.fillStyle = css(PAL.void, 1); g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
  gr.addColorStop(0, css(c, k));
  gr.addColorStop(1, css(c, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// subtle drifting noise field (the "simulation substrate")
function simulationGrid(g, W, H, t, color, alpha, spacing, speed) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = css(color, alpha);
  g.lineWidth = 1;
  const off = (t * speed) % spacing;
  g.beginPath();
  for (let x = -spacing + off; x < W + spacing; x += spacing) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = -spacing + off; y < H + spacing; y += spacing) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.restore();
}

// digital rain of parameters — but abstracted into falling hex glyph columns
function dataRain(g, W, H, t, color, alpha, cols, seed) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.font = '20px monospace';
  g.textAlign = 'center';
  const cw = W / cols;
  for (let i = 0; i < cols; i++) {
    const sp = 60 + hash11(i * 31 + seed) * 240;
    const y0 = ((t * sp + hash11(i * 7 + seed) * H * 3) % (H + 700)) - 350;
    const len = 6 + Math.floor(hash11(i * 13 + seed) * 12);
    for (let j = 0; j < len; j++) {
      const y = y0 - j * 22;
      if (y < -30 || y > H + 30) continue;
      const a = alpha * (1 - j / len) ** 1.4;
      const ch = '0123456789ABCDEF'[Math.floor(hash11(i * 97 + j * 13 + Math.floor(t * 8) + seed) * 16)];
      g.fillStyle = css(color, a);
      g.fillText(ch, i * cw + cw / 2, y);
    }
  }
  g.restore();
}

if (typeof module !== 'undefined') module.exports = { drawPointsLattice, drawLatticeWeb, drawCore, drawEye, ring3D, drawText, typeOut, bgGradient, bgRadial, simulationGrid, dataRain };
