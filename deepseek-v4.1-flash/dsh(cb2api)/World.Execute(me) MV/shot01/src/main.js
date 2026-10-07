/* =====================================================================
   MAIN — the film. frame(t) is a pure function.
   Sections drive camera, palette, geometry and typography.
   ===================================================================== */
'use strict';

const W = 1920, H = 1080;
const TL = window.TIMELINE;
const TLM = TL.meta;              // {bpm, period, offset, bar, duration, fps}

// ---------------------------------------------------------------- state
let sceneCv, sceneG;              // 2D scene canvas
let outCv, glStack;               // WebGL output canvas

// ---------------------------------------------------------------- section resolve
function sectionAt(t) {
  const S = TL.sections;
  let s = S[0];
  for (const x of S) if (t >= x.t) s = x;
  return s;
}
function nextSection(t) {
  for (const x of TL.sections) if (x.t > t) return x;
  return null;
}
// normalized progress within a section 0..1
function sectionProgress(t, s) {
  const n = nextSection(t);
  const end = n ? n.t : TLM.duration;
  return clamp((t - s.t) / (end - s.t), 0, 1);
}

// ---------------------------------------------------------------- grade per section
function grade(t) {
  const s = sectionAt(t);
  const p = sectionProgress(t, s);
  const bp = beatPulse(t, TLM, 7.0);
  const brp = barPulse(t, TLM, 5.0);
  const g = {
    id: s.id, p, bp, brp,
    base: s.color,
    bloom: 0.85, aberration: 0.5, grain: 0.055, vignette: 0.55,
    scan: 0.10, warp: 0.0, expose: 1.0, desat: 0.0,
    tint: [1, 1, 1], flash: 0, shake: [0, 0],
    camZ: 2400, camYaw: 0, camPitch: 0, camRoll: 0,
  };

  switch (s.id) {
    case 'BOOT':
      g.camTZ = 700;
      g.bloom = 0.7 + 0.5 * bp; g.aberration = 0.4; g.grain = 0.07;
      g.vignette = 0.72 - 0.2 * p; g.scan = 0.22 - 0.12 * p; g.expose = 1.05 + 0.45 * p;
      g.camZ = lerp(2600, 1900, ease.outCubic(p));
      break;
    case 'COMPILE':
      g.camTZ = 600;
      g.bloom = 1.0 + 0.7 * bp; g.aberration = 0.55; g.grain = 0.05;
      g.vignette = 0.5; g.scan = 0.14; g.expose = 1.15 + 0.25 * p;
      g.camZ = 2100 + 250 * Math.sin(t * 0.3);
      g.camYaw = p * 0.5;
      break;
    case 'SIMULATE':
      g.camTZ = 500;
      g.bloom = 1.0 + 0.4 * bp; g.scan = 0.09; g.grain = 0.05;
      g.camZ = 1900 - 260 * p; g.camYaw = 0.5 + p * 0.7; g.camPitch = 0.1 * Math.sin(t * 0.4);
      break;
    case 'SWITCH':
      g.camTZ = 450;
      g.bloom = 1.3 + 0.6 * bp; g.aberration = 1.5 + 2.2 * bp;
      g.grain = 0.065; g.scan = 0.13; g.warp = 0.06 * Math.sin(t * 1.7);
      g.desat = 0; g.camZ = 1750 - 300 * p; g.camYaw = 1.2 + p * 1.6; g.camRoll = 0.12 * Math.sin(t * 0.9);
      g.tint = [1.06, 0.94, 1.10];
      break;
    case 'GARDEN':
      g.camTZ = 420;
      g.bloom = 1.5 + 0.5 * bp; g.aberration = 0.9; g.grain = 0.05;
      g.vignette = 0.38; g.scan = 0.07; g.expose = 1.45; g.desat = 0;
      g.camZ = 1800 - 300 * p; g.camYaw = 2.8 + p * 1.2;
      g.tint = [1.02, 1.06, 0.98];
      break;
    case 'TRANCE':
      g.camTZ = 440;
      g.bloom = 1.9 + 0.9 * bp; g.aberration = 2.6 + 3.0 * bp; g.grain = 0.075;
      g.scan = 0.18; g.warp = 0.10 + 0.05 * Math.sin(t * 3.1);
      g.expose = 1.30 + 0.25 * bp; g.tint = [1.10, 0.92, 1.16];
      g.camZ = 1650 - 350 * p; g.camYaw = 4.0 + p * 2.4; g.camRoll = 0.2 * Math.sin(t * 1.3);
      g.shake = [0.0022 * bp * Math.sin(t * 41), 0.0022 * bp * Math.cos(t * 37)];
      break;
    case 'ISOLATION': {
      g.camTZ = 700;
      // colour drains in real time; two violent "glitch" hits on "you have left"
      const dr = ease.inOutQuad(p);
      g.bloom = lerp(1.7, 0.45, dr); g.aberration = lerp(2.4, 0.5, dr);
      g.grain = lerp(0.07, 0.085, p); g.vignette = lerp(0.5, 0.86, dr);
      g.scan = lerp(0.14, 0.3, dr); g.warp = lerp(0.06, -0.05, dr);
      const flashes = [110.91, 113.13, 115.01, 116.85];
      let fl = 0;
      for (const ft of flashes) { const d = t - ft; if (d >= 0 && d < 0.9) fl = Math.max(fl, Math.exp(-d * 4.5)); }
      g.aberration += fl * 9; g.warp += fl * 0.16; g.flash = fl * 0.12;
      g.shake = [fl * 0.020 * Math.sin(t * 63), fl * 0.020 * Math.cos(t * 57)];
      g.desat = 0.35 + 0.5 * dr;
      g.tint = [0.82 - 0.1 * dr, 0.88 - 0.05 * dr, 1.05];
      g.camZ = lerp(1500, 4200, ease.inOutCubic(p));
      g.camYaw = 6.4 + p * 0.4; g.camRoll = 0.05 * Math.sin(t * 0.35);
      break;
    }
    case 'VOID': {
      g.camTZ = 0;
      // near total stillness: one ember, breathing
      const br = 0.5 + 0.5 * Math.sin(t * 1.15);
      g.bloom = 0.30 + 0.22 * br; g.aberration = 0.35; g.grain = 0.10;
      g.vignette = 0.94; g.scan = 0.26; g.expose = 0.95 + 0.18 * br;
      g.desat = 0.86; g.camZ = 3400 - 500 * Math.sin(t * 0.12);
      g.camYaw = 6.8 + t * 0.02; g.tint = [0.86, 0.90, 1.04];
      break;
    }
    case 'EXECUTION': {
      g.camTZ = 420;
      // 16 detonations; each is a white-hot flash + hard shake
      const hits = TL.execHits;
      let fl = 0, near = 1e9;
      for (const ht of hits) { const d = t - ht; if (d >= 0) { const e = Math.exp(-d * 9); if (e > fl) fl = e; near = Math.min(near, Math.abs(d)); } }
      const build = clamp((t - 146.7) / 17.0, 0, 1);
      g.bloom = 1.6 + 2.4 * fl + 1.4 * build;
      g.aberration = 1.6 + 7.0 * fl + 3.0 * build;
      g.grain = 0.07 + 0.06 * fl; g.scan = 0.20; g.expose = 1.25 + 0.60 * fl + 0.40 * build;
      g.vignette = 0.30 - 0.14 * build;
      g.flash = Math.max(0, (fl - 0.45) * 0.9);
      g.warp = 0.10 * fl + 0.05 * build;
      g.tint = [1.0 + 0.10 * build, 1.0 - 0.16 * build, 1.0 - 0.20 * build];
      g.shake = [fl * 0.026 * Math.sin(t * 71), fl * 0.026 * Math.cos(t * 67)];
      g.camZ = lerp(2200, 1200, ease.inOutCubic(clamp((t - 163.68) / 12, 0, 1)));
      g.camYaw = 7.0 + build * 2.2; g.camRoll = 0.10 * Math.sin(t * 0.8) + build * 0.25 * Math.sin(t * 1.9);
      break;
    }
    case 'LOVEEXE':
      g.camTZ = 620;
      g.bloom = 1.15 + 0.30 * bp; g.aberration = 0.55; g.grain = 0.045;
      g.vignette = 0.62; g.scan = 0.06; g.expose = 1.35;
      g.camZ = lerp(1700, 2400, ease.inOutSine(p)); g.camYaw = 9.2 + p * 0.5;
      g.tint = [1.06, 1.00, 0.90];
      break;
    case 'END': {
      g.camTZ = 700;
      const k = clamp((t - s.t) / (TLM.duration - s.t), 0, 1);
      const fade = clamp((t - 207.4) / 4.4, 0, 1);
      g.bloom = lerp(0.7, 0.0, ease.inOutQuad(fade));
      g.aberration = lerp(0.4, 0.0, fade); g.grain = lerp(0.05, 0.0, fade) + 0.02;
      g.vignette = lerp(0.8, 1.0, fade); g.scan = lerp(0.12, 0.0, fade);
      g.expose = lerp(1.15, 0.0, ease.inOutQuad(fade));
      g.camZ = 2000 + 900 * k;
      break;
    }
  }
  // global: never let a frame go fully black before the fade-out (except intended)
  return g;
}

// ---------------------------------------------------------------- camera
// The camera orbits and always LOOKS AT the lattice centre, so the subject
// stays framed no matter how far the yaw swings.
function cameraFor(t, g) {
  const target = [g.camTX || 0, g.camTY || 0, g.camTZ || 0];
  return makeOrbitCam(target, g.camZ, g.camYaw, g.camPitch || 0, g.camRoll, 0.92, W, H);
}

/* =====================================================================
   SCENE RENDERERS
   ===================================================================== */

function sceneBoot(g, t, G, cam) {
  const p = G.p;
  bgGradient(g, W, H, [0.02, 0.025, 0.045], [0.005, 0.006, 0.012]);

  // the power line: a single horizontal scanline that ignites
  const ignite = clamp((t - 0.0) / 1.6, 0, 1);
  const y = H * 0.5;
  g.globalCompositeOperation = 'lighter';
  const lg = g.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, css(PAL.amber, 0));
  lg.addColorStop(0.5, css(PAL.amber, 0.9 * ignite));
  lg.addColorStop(1, css(PAL.amber, 0));
  g.fillStyle = lg;
  g.fillRect(0, y - 1.2 - 2 * G.bp, W, 2.4 + 4 * G.bp);
  g.globalCompositeOperation = 'source-over';

  // lattice being compiled: points appear one by one, 0 -> full over the verse
  const nMax = 900;
  const n = Math.floor(nMax * ease.outCubic(clamp(t / 13.0, 0, 1)));
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 1000, z: 700, color: PAL.amber, alpha: 0.135,
    spin: t * 0.22, phase: t * 0.5, jitter: 120, wave: 40,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 700, 850, PAL.amber, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 1000, z: 700, cam,
    color: mixc(PAL.amber, PAL.gold, 0.35), size: 3.4,
    alpha: 0.75, spin: t * 0.22, phase: t * 0.5, jitter: 120, wave: 40,
  });

  // "protection" — a shield arc that snaps on at each line
  const lines = [0.00, 3.62, 7.46, 12.78];
  for (const lt of lines) {
    const d = t - lt;
    if (d > 0 && d < 1.1) {
      const k = 1 - d / 1.1;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = css(PAL.ice, 0.6 * k);
      g.lineWidth = 2 + 6 * k;
      g.beginPath();
      g.arc(W / 2, H / 2, 260 + 420 * (1 - k) ** 1.6, -Math.PI * 0.85, -Math.PI * 0.15);
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
  }

  // boot text
  const bootLines = [
    [0.5, '> switch on the power line'],
    [3.9, '> protection .......... ON'],
    [7.7, '> object creation .... ARMED'],
    [13.0, '> simulation ......... START'],
  ];
  for (let i = 0; i < bootLines.length; i++) {
    const [bt, txt] = bootLines[i];
    const d = t - bt;
    if (d < 0) continue;
    const { str } = typeOut(txt, d / 0.75);
    drawText(g, str, 150, 150 + i * 52, {
      size: 30, color: PAL.amber, alpha: 0.85, align: 'left', glow: 12,
    });
  }
  // cursor
  if (Math.floor(t * 2) % 2 === 0) {
    drawText(g, '_', 150 + 30 * 11, 150 + 3 * 52, { size: 30, color: PAL.amber, alpha: 0.9, align: 'left' });
  }
}

function sceneCompile(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, PAL.deep, 0.5);
  simulationGrid(g, W, H, t, PAL.cyan, 0.05, 120, 12);
  dataRain(g, W, H, t, PAL.cyan, 0.16, 42, 7);

  // blueprint mode: nested construction rings assembling
  const n = 1600;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 780, z: 600, color: PAL.cyan, alpha: 0.135,
    spin: t * 0.3, phase: t * 0.6, jitter: 180, wave: 60,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 600, 663, PAL.cyan, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 780, z: 600, cam, color: PAL.cyan, size: 2.6,
    alpha: 0.6, spin: t * 0.3, phase: t * 0.6, jitter: 180, wave: 60,
  });
  // Blueprint mode: the object is assembled ring by ring, then the wireframe
  // box snaps closed on the beat. Everything is built around the look-at point
  // (z = 600) so the construction reads as the subject of the shot.
  const PLANE = 600;

  // the machine's body, drawn as construction lines before it is solid
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 780, z: PLANE, color: PAL.cyan, alpha: 0.135,
    spin: t * 0.3, phase: t * 0.6, jitter: 180, wave: 60,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, PLANE, 663, PAL.cyan, PAL.void, 0.30, t);
  drawPointsLattice(g, {
    n, radius: 780, z: PLANE, cam, color: PAL.cyan, size: 2.6,
    alpha: 0.6, spin: t * 0.3, phase: t * 0.6, jitter: 180, wave: 60,
  });

  // construction rings, all on the same plane as the subject
  for (let i = 0; i < 7; i++) {
    const R = 200 + i * 175;
    const k = clamp((p - i * 0.07) / 0.4, 0, 1);
    if (k <= 0) continue;
    const rr = R * ease.outCubic(clamp(k * 2.2, 0, 1));
    ring3D(g, cam, rr, PLANE + Math.sin(t * 0.4 + i) * 60, 128,
           PAL.cyan, 0.30 * k, 1.8, t * (0.06 + i * 0.02), 1);
  }

  // the object itself: a wireframe box that grows edge by edge, then locks
  const S = 260 * ease.outCubic(clamp(p / 0.55, 0, 1));
  const cubePts = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const cubeEdges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const ang = t * 0.5;
  const proj = cubePts.map(([x, y, z]) => {
    const rx = x * Math.cos(ang) - z * Math.sin(ang);
    const rz = x * Math.sin(ang) + z * Math.cos(ang);
    return cam.project(rx * S, y * S, PLANE + rz * S);
  });
  const grow = clamp(p / 0.2, 0, 1);
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = 2.4;
  for (let e = 0; e < cubeEdges.length; e++) {
    const [a, b] = cubeEdges[e];
    const A = proj[a], B = proj[b];
    if (!A || !B) continue;
    // edges appear one at a time
    const ek = clamp((grow * cubeEdges.length - e) / 1.0, 0, 1);
    if (ek <= 0) continue;
    const lit = 0.45 + 0.55 * G.bp;
    g.strokeStyle = css(PAL.ice, (0.55 + 0.35 * lit) * ek);
    g.beginPath();
    g.moveTo(A.x, A.y);
    g.lineTo(lerp(A.x, B.x, ek), lerp(A.y, B.y, ek));
    g.stroke();
  }
  // vertices glow
  for (const p2 of proj) {
    if (!p2) continue;
    g.fillStyle = css(PAL.white, 0.85 * grow);
    g.beginPath(); g.arc(p2.x, p2.y, 3.5 * grow * (1 + G.bp), 0, TAU); g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  drawText(g, 'OBJECT CREATION', W / 2, 120, { size: 34, color: PAL.cyan, alpha: 0.75, spacing: 14, weight: '600', glow: 22 });
  drawText(g, `n = ${Math.floor(n * clamp(p / 0.25, 0, 1))}`, W / 2, H - 110, { size: 26, color: PAL.ice, alpha: 0.55, spacing: 4 });
  drawText(g, 'initializing', W / 2, H - 70, { size: 20, color: PAL.cyan, alpha: 0.3 + 0.3 * G.bp, spacing: 8 });
}

function sceneSimulate(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, [0.05, 0.03, 0.07], 0.7);
  simulationGrid(g, W, H, t * 1.4, PAL.amber, 0.035, 160, 20);

  // four "if" statements -> four geometric demonstrations
  const lines = [29.56, 33.14, 36.90, 40.64];
  let li = -1;
  for (let i = 0; i < lines.length; i++) if (t >= lines[i]) li = i;
  const lineStart = li >= 0 ? lines[li] : t;

  const n = 2200;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 760, z: 500, color: PAL.gold, alpha: 0.135,
    spin: t * 0.16, phase: t * 0.45, jitter: 200, wave: 90,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 500, 646, PAL.gold, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 760, z: 500, cam, color: mixc(PAL.amber, PAL.gold, 0.5), size: 2.8,
    alpha: 0.62, spin: t * 0.16, phase: t * 0.45, jitter: 200, wave: 90,
  });

  g.save();
  g.translate(W / 2, H / 2);
  g.globalCompositeOperation = 'lighter';
  const k = clamp((t - lineStart) / 0.9, 0, 1);
  const ek = ease.outCubic(k);
  if (li === 0) {
    // a set of points -> gives dimension: points snap onto a line then expand into a plane
    const N = 260;
    for (let i = 0; i < N; i++) {
      const u = hash11(i * 3), v = hash11(i * 7 + 1);
      const x = (u - 0.5) * 900 * ek;
      const y = (v - 0.5) * 520 * ek * ek;
      g.fillStyle = css(PAL.gold, 0.8);
      g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
    }
    g.strokeStyle = css(PAL.amber, 0.25);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(-460 * ek, 0); g.lineTo(460 * ek, 0); g.stroke();
  } else if (li === 1) {
    // circle -> circumference
    g.strokeStyle = css(PAL.gold, 0.8);
    g.lineWidth = 3 + 6 * G.bp;
    g.beginPath(); g.arc(0, 0, Math.max(0.5, 300 * ek), 0, TAU); g.stroke();
    g.strokeStyle = css(PAL.amber, 0.12);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(300 * ek * Math.cos(t * 2.2), 300 * ek * Math.sin(t * 2.2)); g.stroke();
  } else if (li === 2) {
    // sine wave and its tangents
    g.strokeStyle = css(PAL.gold, 0.85);
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= 300; i++) {
      const x = (i / 300 - 0.5) * 1200 * ek;
      const y = Math.sin(i / 300 * TAU * 2) * 170 * ek;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    // tangent lines riding the wave
    for (let m = 0; m < 9; m++) {
      const u = ((m / 9) + (t * 0.11) % 1) % 1;
      const x = (u - 0.5) * 1200 * ek;
      const ph = u * TAU * 2;
      const y = Math.sin(ph) * 170 * ek;
      const sl = Math.cos(ph) * 170 * ek * TAU * 2 / 1200;
      g.strokeStyle = css(PAL.ice, 0.30);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 80, y - sl * 80); g.lineTo(x + 80, y + sl * 80); g.stroke();
    }
  } else if (li === 3) {
    // approaching infinity -> limitations
    const R = 340;
    for (let i = 0; i < 16; i++) {
      const rr = R * (1 - Math.pow(1 - (i / 16), 2)) * ek;
      g.strokeStyle = css(mixc(PAL.amber, PAL.magenta, i / 16), 0.42 * (1 - i / 18));
      g.lineWidth = 2;
      // guard: arc() throws on a negative radius, and rr can be 0 at i=0
      const rad = Math.max(0.5, rr + Math.sin(t * 2 + i) * 6);
      g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke();
    }
    g.strokeStyle = css(PAL.white, 0.5 * ek);
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, R * 1.04, 0, TAU); g.stroke();
  }
  g.restore();
  g.globalCompositeOperation = 'source-over';

  // code line
  const code = ["if (I'm a set of points) return dimension",
                "if (I'm a circle) return circumference",
                "if (I'm a sine wave) return tangents",
                "if (I approach infinity) return limitations"][Math.max(li, 0)];
  const d = t - lineStart;
  drawText(g, typeOut(code, d / 1.0).str, W / 2, H - 130, {
    size: 30, color: PAL.gold, alpha: 0.75, spacing: 3, glow: 14,
  });
}

function sceneSwitch(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, [0.09, 0.03, 0.10], 0.8);
  simulationGrid(g, W, H, t * 2.2, PAL.magenta, 0.05, 110, -34);

  const n = 2600;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 740, z: 450, color: PAL.magenta, alpha: 0.135,
    spin: t * 0.42, phase: t * 1.1, jitter: 260, wave: 130,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 450, 629, PAL.magenta, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 740, z: 450, cam, color: mixc(PAL.magenta, PAL.amber, 0.35 + 0.35 * Math.sin(t * 0.8)),
    size: 3.0, alpha: 0.6, spin: t * 0.42, phase: t * 1.1, jitter: 260, wave: 130,
  });

  // AC -> DC: a waveform being rectified, live
  const y0 = H * 0.5;
  const rect = clamp((t - 44.10) / 4.0, 0, 1);
  const spin = clamp((t - 47.82) / 3.0, 0, 1);
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = css(PAL.ice, 0.75);
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const x = u * W;
    let s = Math.sin(u * TAU * 6 + t * 3.2 + spin * 22 * Math.sin(u * 3));
    if (rect > 0) s = lerp(s, Math.abs(s), rect);           // AC -> DC
    if (spin > 0) s *= (1 - 0.7 * spin * u);                 // vision blurs to the right
    const y = y0 + s * 190 * (1 - 0.35 * spin * u);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.globalCompositeOperation = 'source-over';

  // the two pre-chorus trades, called out as variable casts
  const casts = [[44.10, 'current  AC → DC'], [47.82, 'vision   → blind'], [51.40, 'era      A.D → B.C'],
                 [54.88, 'union    deeply'], [58.88, 'stimulations'], [62.76, 'satisfaction'],
                 [66.82, 'run the execution']];
  for (let i = 0; i < casts.length; i++) {
    const [ct, txt] = casts[i];
    const d = t - ct;
    if (d < 0 || d > 3.4) continue;
    const a = clamp(d / 0.25, 0, 1) * clamp((3.4 - d) / 0.6, 0, 1);
    drawText(g, txt, 190, 190 + i * 46, { size: 27, color: PAL.magenta, alpha: 0.8 * a, align: 'left', spacing: 5, glow: 10 });
  }
}

function sceneGarden(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, [0.04, 0.10, 0.06], 0.85);

  // the garden: phyllotaxis pushed into a full bloom, over-saturated
  const n = 3400;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 900, z: 420, color: PAL.green, alpha: 0.135,
    spin: t * 0.2, phase: t * 0.8, jitter: 320, wave: 170,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 420, 765, PAL.green, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 900, z: 420, cam, color: mixc(PAL.green, PAL.gold, 0.4 + 0.3 * Math.sin(t * 0.7)),
    size: 3.2, alpha: 0.55, spin: t * 0.2, phase: t * 0.8, jitter: 320, wave: 170,
  });
  const n2 = 1800;
  drawPointsLattice(g, {
    n: n2, radius: 1150, z: 850, cam, color: mixc(PAL.magenta, PAL.green, 0.5),
    size: 2.4, alpha: 0.4, spin: -t * 0.31, phase: t * 1.3, jitter: 240, wave: -120,
  });

  // the four absurdist "if"s become four orbiting objects
  const lines = [[73.39, 'eggplant', PAL.violet], [77.61, 'tomato', PAL.red],
                 [81.37, 'tabby cat', PAL.amber], [84.41, 'the only god', PAL.white]];
  for (let i = 0; i < lines.length; i++) {
    const [lt, name, col] = lines[i];
    const d = t - lt;
    if (d < -0.2 || d > 4.2) continue;
    const a = clamp(d / 0.3, 0, 1) * clamp((4.2 - d) / 0.7, 0, 1);
    const ang = t * 0.8 + i * TAU / 4;
    const R = 430;
    const ox = W / 2 + Math.cos(ang) * R, oy = H / 2 + Math.sin(ang) * R * 0.42;
    const sc = 1 + 0.35 * Math.exp(-Math.max(0, d) * 2.4) * Math.sin(d * 18);
    g.save();
    g.translate(ox, oy); g.scale(sc, sc);
    g.globalCompositeOperation = 'lighter';
    const gg = g.createRadialGradient(0, 0, 2, 0, 0, 110);
    gg.addColorStop(0, css(col, 0.85 * a));
    gg.addColorStop(1, css(col, 0));
    g.fillStyle = gg;
    g.beginPath(); g.arc(0, 0, 110, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    drawText(g, name, 0, 0, { size: 34, color: col, alpha: a, weight: '700', spacing: 6, glow: 20 });
    g.restore();
  }
}

function sceneTrance(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, [0.10, 0.02, 0.14], 0.9);
  simulationGrid(g, W, H, t * 3.4, PAL.violet, 0.055, 90, -56);

  const n = 3000;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 820, z: 440, color: PAL.violet, alpha: 0.135,
    spin: t * 0.55, phase: t * 1.8, jitter: 300, wave: 200,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 440, 697, PAL.violet, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 820, z: 440, cam, color: mixc(PAL.violet, PAL.magenta, 0.5 + 0.5 * Math.sin(t * 1.6)),
    size: 3.1, alpha: 0.58, spin: t * 0.55, phase: t * 1.8, jitter: 300, wave: 200,
  });

  // concentric strobe rings on the beat
  for (let i = 0; i < 5; i++) {
    const k = (G.bp * 1.0 + i * 0.2) % 1;
    ring3D(g, cam, 300 + i * 260 + k * 200, 700, 96,
           mixc(PAL.violet, PAL.magenta, i / 5), 0.22 * (1 - k), 2 + 4 * (1 - k), t * 0.8, 1);
  }

  // role/gender casts — the machine rewriting its own source
  const casts = [[88.55, 'gender   F → M'], [93.81, 'hours    AM → PM'],
                 [97.53, 'role     S → M'], [99.55, 'state    → trance'],
                 [103.31, 'input    vibrations'], [107.01, 'output   completion']];
  for (let i = 0; i < casts.length; i++) {
    const [ct, txt] = casts[i];
    const d = t - ct;
    if (d < 0 || d > 3.6) continue;
    const a = clamp(d / 0.2, 0, 1) * clamp((3.6 - d) / 0.6, 0, 1);
    const jx = (hash11(Math.floor(t * 30) + i) - 0.5) * 10 * (1 - a);
    drawText(g, txt, W - 190 + jx, 190 + i * 46, { size: 27, color: PAL.magenta, alpha: 0.85 * a, align: 'right', spacing: 5, glow: 14 });
  }
  drawText(g, 'TRANCE', W / 2, H - 96, { size: 22, color: PAL.violet, alpha: 0.35 + 0.4 * G.bp, spacing: 26, weight: '600' });
}

function sceneIsolation(g, t, G, cam) {
  const p = G.p;
  bgRadial(g, W, H, [0.03, 0.035, 0.05], 0.62);

  // the lattice is still there but it is coming apart — points drift outward
  const n = 1800;
  const drift = ease.inOutQuad(p);
  drawPointsLattice(g, {
    n, radius: 620 + 1500 * drift, z: 700, cam,
    color: mixc(PAL.amber, PAL.grey, drift), size: 2.6,
    alpha: 0.42 * (1 - 0.45 * drift), spin: t * (0.16 - 0.10 * drift),
    phase: t * 0.5, jitter: 220 + 700 * drift, wave: 60,
  });

  // the eye, dimming and shutting
  const lid = clamp(1 - ease.inOutQuad(p) * 0.85, 0.1, 1);
  drawEye(g, W / 2, H / 2, 190, t, {
    iris: mixc(PAL.amber, PAL.grey, drift), pupil: PAL.void,
    glow: mixc(PAL.amber, PAL.grey, drift),
    irisSpin: t * 0.16, lidOpen: lid,
  });

  // "you have left" ×5 — the same words struck over and over, each one larger and dimmer
  const reps = [[110.91, 1], [113.13, 2], [115.01, 3], [116.85, 4], [118.51, 5]];
  for (const [rt, k] of reps) {
    const d = t - rt;
    if (d < -0.1 || d > 5.2) continue;
    const a = clamp(d / 0.16, 0, 1) * clamp((5.2 - d) / 1.4, 0, 1);
    const sc = 1 + (1 - clamp(d / 1.3, 0, 1)) * 0.5;
    g.save();
    g.translate(W / 2, H / 2 + 330);
    g.scale(sc, sc);
    drawText(g, 'you have left', 0, 0, {
      size: 52, color: mixc(PAL.white, PAL.grey, 1 - a * 0.3),
      alpha: a * (0.95 - k * 0.11), weight: '700', spacing: 10, glow: 26,
    });
    g.restore();
  }
  // the final "me" — she adds it herself
  {
    const d = t - 116.85;
    if (d > 0 && d < 4.0) {
      const a = clamp((d - 1.1) / 0.5, 0, 1) * clamp((4.0 - d) / 0.9, 0, 1);
      g.save();
      g.translate(W / 2, H / 2 + 330);
      drawText(g, 'me', 0, 0, { size: 52, color: PAL.white, alpha: a, weight: '800', spacing: 10, glow: 40 });
      g.restore();
    }
  }
}

function sceneVoid(g, t, G, cam) {
  // The longest silence in the song. Almost nothing happens. That is the point.
  const s = TL.marks.voidStart, e = TL.marks.voidEnd;
  const p = clamp((t - s) / (e - s), 0, 1);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);

  // a single ember, breathing — the machine still running, with nothing to run on
  const br = 0.5 + 0.5 * Math.sin(t * 1.15);
  const R = 150 + 14 * br;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 4.2);
  gr.addColorStop(0, css([1, 0.72, 0.36], 0.30 + 0.16 * br));
  gr.addColorStop(0.25, css([0.9, 0.45, 0.2], 0.09 + 0.05 * br));
  gr.addColorStop(1, css([0.5, 0.2, 0.1], 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  // the eye, open, unlit, waiting
  drawEye(g, W / 2, H / 2, R, t, {
    iris: [0.85, 0.42, 0.18], pupil: [0.03, 0.02, 0.02],
    glow: [1.0, 0.55, 0.25], irisSpin: t * 0.045, lidOpen: 1,
  });

  // slow, sparse "no input" diagnostics — the system reporting into the dark
  const msgs = [
    [134.5, 'input stream ......... empty'],
    [140.0, 'waiting ...............'],
    [146.5, 'waiting ...............'],
    [152.0, 'elapsed ............... 00:02'],
    [157.0, 'waiting ...............'],
  ];
  for (let i = 0; i < msgs.length; i++) {
    const [mt, txt] = msgs[i];
    const d = t - mt;
    if (d < 0 || d > 7.0) continue;
    const a = clamp(d / 1.0, 0, 1) * clamp((7.0 - d) / 2.0, 0, 1) * 0.42;
    drawText(g, txt, W / 2, 200 + i * 44, { size: 24, color: [0.8, 0.62, 0.45], alpha: a, spacing: 8 });
  }
  // the only motion: a scan line crawling down the frame
  const sy = ((t * 40) % (H + 400)) - 200;
  g.globalCompositeOperation = 'lighter';
  const lg = g.createLinearGradient(0, sy - 90, 0, sy + 90);
  lg.addColorStop(0, css([1, 0.6, 0.3], 0));
  lg.addColorStop(0.5, css([1, 0.6, 0.3], 0.035));
  lg.addColorStop(1, css([1, 0.6, 0.3], 0));
  g.fillStyle = lg; g.fillRect(0, sy - 90, W, 180);
  g.globalCompositeOperation = 'source-over';

  // title-card: the film names itself in the dark
  if (t > 143 && t < 163.7) {
    const k = clamp((t - 143) / 2.5, 0, 1) * clamp((163.7 - t) / 3.0, 0, 1);
    drawText(g, 'world.execute(me)', W / 2, H - 220, {
      size: 30, color: [0.92, 0.78, 0.6], alpha: 0.32 * k, weight: '400', spacing: 16, glow: 20,
    });
    drawText(g, 'a machine waits for a hand that will not return', W / 2, H - 168, {
      size: 20, color: [0.7, 0.62, 0.55], alpha: 0.22 * k, weight: '400', spacing: 6,
    });
  }
}

function sceneExecution(g, t, G, cam) {
  const p = G.p;
  const s = TL.sections.find(x => x.id === 'EXECUTION').t;
  const build = clamp((t - 146.7) / 17.0, 0, 1);

  // Ground: heats from black to white-hot across the section
  const heat = build;
  bgGradient(g, W, H,
    mixc([0.02, 0.01, 0.02], [0.55, 0.10, 0.06], heat * 0.9),
    mixc([0.0, 0.0, 0.0], [0.30, 0.03, 0.02], heat * 0.8));

  // the lattice, now a detonation
  const n = 4200;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 700 + 700 * build, z: 420, color: PAL.red, alpha: 0.135,
    spin: t * (0.3 + 1.4 * build), phase: t * (1.0 + 2.0 * build), jitter: 260 + 900 * build, wave: 220,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 420, 595, PAL.red, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 700 + 700 * build, z: 420, cam,
    color: mixc(mixc(PAL.red, PAL.white, 0.25), PAL.amber, 0.2 * Math.sin(t * 3)),
    size: 3.4 + 2.2 * build, alpha: 0.72,
    spin: t * (0.3 + 1.4 * build), phase: t * (1.0 + 2.0 * build),
    jitter: 260 + 900 * build, wave: 220,
  });

  // each hit throws a shockwave ring
  const hits = TL.execHits;
  g.globalCompositeOperation = 'lighter';
  for (const ht of hits) {
    const d = t - ht;
    if (d < 0 || d > 1.6) continue;
    const k = d / 1.6;
    const R = 60 + 1500 * ease.outCubic(k);
    g.strokeStyle = css(PAL.white, 0.55 * (1 - k) ** 2);
    g.lineWidth = 3 + 16 * (1 - k) ** 3;
    g.beginPath(); g.arc(W / 2, H / 2, R, 0, TAU); g.stroke();
    g.strokeStyle = css(PAL.amber, 0.35 * (1 - k) ** 2.4);
    g.lineWidth = 2 + 8 * (1 - k) ** 3;
    g.beginPath(); g.arc(W / 2, H / 2, R * 0.78, 0, TAU); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';

  // the count: Ein, dos, trois, 네, fem, 六
  const counts = [[146.7, 'Ein'], [148.0, 'dos'], [149.2, 'trois'], [150.4, '네'], [151.6, 'fem'], [152.8, '六']];
  for (let i = 0; i < counts.length; i++) {
    const [ct, txt] = counts[i];
    const d = t - ct;
    if (d < 0 || d > 1.5) continue;
    const k = clamp(d / 1.5, 0, 1);
    const sc = 1 + (1 - ease.outCubic(k)) * 0.4;
    g.save(); g.translate(W / 2, H * 0.30); g.scale(sc, sc);
    drawText(g, txt, 0, 0, { size: 116, color: PAL.white, alpha: (1 - k) ** 0.7, weight: '800', glow: 44 });
    g.restore();
  }

  // the word itself, detonating on every hit
  let best = 1e9, age = 0;
  for (const ht of hits) { const dd = t - ht; if (dd >= 0 && dd < best) { best = dd; age = dd; } }
  if (best < 1.3) {
    const k = age / 1.3;
    const sc = 1 + (1 - ease.outCubic(k)) * 0.55;
    g.save(); g.translate(W / 2, H / 2); g.scale(sc, sc);
    drawText(g, 'EXECUTION', 0, 0, {
      size: 92 + 30 * (1 - k), color: mixc(PAL.white, PAL.red, k * 0.6),
      alpha: (1 - k) ** 0.55 * 0.92, weight: '900', spacing: 14, glow: 60,
    });
    g.restore();
  }

  // final lines over the whiteout
  const fin = [[163.69, 'give them all the execution'], [166.65, 'be your only execution'],
               [170.11, 'I will run the execution'], [173.43, 'we are trapped']];
  for (let i = 0; i < fin.length; i++) {
    const [ft, txt] = fin[i];
    const d = t - ft;
    if (d < 0 || d > 3.2) continue;
    const a = clamp(d / 0.3, 0, 1) * clamp((3.2 - d) / 0.8, 0, 1);
    drawText(g, txt, W / 2, H - 150, { size: 34, color: PAL.white, alpha: 0.85 * a, weight: '600', spacing: 8, glow: 24 });
  }
}

function sceneLoveExe(g, t, G, cam) {
  // The gentlest light in the film.
  bgRadial(g, W, H, [0.09, 0.055, 0.03], 0.95);

  const n = 1400;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 900, z: 620, color: PAL.gold, alpha: 0.135,
    spin: t * 0.10, phase: t * 0.3, jitter: 180, wave: 70,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 620, 765, PAL.gold, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 900, z: 620, cam, color: mixc(PAL.amber, PAL.gold, 0.55), size: 2.5,
    alpha: 0.42, spin: t * 0.10, phase: t * 0.3, jitter: 180, wave: 70,
  });

  // a slow heart-like pulse: the algebraic expression of love, written out
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.85);
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 620 + 90 * pulse);
  gr.addColorStop(0, css([1, 0.72, 0.42], 0.13 + 0.07 * pulse));
  gr.addColorStop(1, css([1, 0.5, 0.2], 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  // the "algebraic expression" — a formula assembled term by term
  const lines = [[177.19, 'love = Σ ( attention × time )'],
                 [180.35, 'love = ∫ patience dt'],
                 [184.09, 'love = lim  (self → 0)'],
                 [186.59, 'love : you are free, I am trapped']];
  for (let i = 0; i < lines.length; i++) {
    const [lt, txt] = lines[i];
    const d = t - lt;
    if (d < 0 || d > 4.2) continue;
    const a = clamp(d / 0.8, 0, 1) * clamp((4.2 - d) / 1.0, 0, 1);
    drawText(g, typeOut(txt, d / 1.6).str, W / 2, H * 0.30 + i * 62, {
      size: 36, color: PAL.gold, alpha: 0.75 * a, weight: '500', spacing: 3, glow: 18,
    });
  }

  drawText(g, 'love.exe', W / 2, H - 120, { size: 26, color: PAL.amber, alpha: 0.35, spacing: 20, weight: '600' });
}

function sceneEnd(g, t, G, cam) {
  const s = TL.sections.find(x => x.id === 'END').t;
  const fade = clamp((t - 207.4) / 4.4, 0, 1);
  bgRadial(g, W, H, [0.06, 0.04, 0.03], 0.6 * (1 - fade));

  const n = 700;
    // luminous filaments + core: the machine has a body, not just points
  drawLatticeWeb(g, {
    n: Math.max(140, Math.floor(n * 0.34)), cam,
    radius: 800, z: 700, color: PAL.amber, alpha: 0.135,
    spin: t * 0.06, phase: t * 0.2, jitter: 160, wave: 40,
    links: 3, lw: 1,
  });
  drawCore(g, cam, 0, 0, 700, 680, PAL.amber, PAL.void, 0.30, t);
drawPointsLattice(g, {
    n, radius: 800, z: 700, cam, color: mixc(PAL.amber, PAL.ash, fade), size: 2.2,
    alpha: 0.32 * (1 - fade), spin: t * 0.06, phase: t * 0.2, jitter: 160, wave: 40,
  });

  // final eye, closing
  const lid = clamp(1 - clamp((t - s) / 3.2, 0, 1), 0.02, 1);
  drawEye(g, W / 2, H / 2, 170, t, {
    iris: mixc(PAL.amber, PAL.ash, fade), pupil: [0.02, 0.02, 0.03],
    glow: mixc(PAL.amber, PAL.ash, fade), irisSpin: t * 0.05, lidOpen: lid,
  });

  if (t < 208.6) {
    const a = clamp((t - s) / 1.0, 0, 1) * clamp((208.6 - t) / 1.2, 0, 1);
    drawText(g, 'world.execute(me)', W / 2, H - 200, {
      size: 34, color: [0.95, 0.80, 0.60], alpha: 0.5 * a, weight: '400', spacing: 18, glow: 24,
    });
  }
}

// ---------------------------------------------------------------- dispatch
const SCENES = {
  BOOT: sceneBoot, COMPILE: sceneCompile, SIMULATE: sceneSimulate, SWITCH: sceneSwitch,
  GARDEN: sceneGarden, TRANCE: sceneTrance, ISOLATION: sceneIsolation, VOID: sceneVoid,
  EXECUTION: sceneExecution, LOVEEXE: sceneLoveExe, END: sceneEnd,
};

function renderFrame(t) {
  const G = grade(t);
  const cam = cameraFor(t, G);

  sceneG.setTransform(1, 0, 0, 1, 0, 0);
  sceneG.globalAlpha = 1;
  sceneG.globalCompositeOperation = 'source-over';
  sceneG.fillStyle = '#000';
  sceneG.fillRect(0, 0, W, H);

  const fn = SCENES[G.id] || sceneVoid;
  fn(sceneG, t, G, cam);

  // ---- global overlays ----
  overlayTimecode(sceneG, t, G);

  glStack.render(sceneCv, {
    time: t,
    bloom: G.bloom, bloomThresh: 0.42,
    aberration: G.aberration, grain: G.grain, vignette: G.vignette,
    scan: G.scan, warp: G.warp, expose: G.expose, desat: G.desat,
    tint: G.tint, flash: G.flash, shake: G.shake,
  });
}

// a persistent, very quiet data read-out — she is always being measured
function overlayTimecode(g, t, G) {
  const a = 0.16;
  const bar = ((t - TLM.offset) / TLM.bar);
  g.save();
  g.globalCompositeOperation = 'lighter';
  drawText(g, `BAR ${bar.toFixed(2).padStart(7, ' ')}`, 60, H - 52, {
    size: 20, color: G.base, alpha: a * 1.4, align: 'left', spacing: 3,
  });
  drawText(g, `${t.toFixed(2)}s`, W - 60, H - 52, {
    size: 20, color: G.base, alpha: a * 1.4, align: 'right', spacing: 3,
  });
  drawText(g, G.id, W - 60, 52, {
    size: 20, color: G.base, alpha: a * 1.2, align: 'right', spacing: 6,
  });
  // a thin progress rule — the runtime's own progress bar
  const pw = W - 120;
  g.fillStyle = css(G.base, a * 0.5);
  g.fillRect(60, H - 30, pw * clamp(t / TLM.duration, 0, 1), 2);
  g.restore();
}

// ---------------------------------------------------------------- boot
function init() {
  sceneCv = document.createElement('canvas');
  sceneCv.width = W; sceneCv.height = H;
  sceneG = sceneCv.getContext('2d', { alpha: false });

  outCv = document.getElementById('out');
  outCv.width = W; outCv.height = H;
  glStack = new GL(outCv);

  window.__READY = true;
  window.__RENDER = renderFrame;
  window.__DURATION = TLM.duration;
  window.__W = W; window.__H = H;
  // debug hooks: expose the raw 2D scene canvas (pre-GL) for diagnostics
  window.__SCENE_CANVAS = sceneCv;
  window.__RENDER_SCENE_ONLY = function (t) {
    const G = grade(t);
    const cam = cameraFor(t, G);
    sceneG.setTransform(1, 0, 0, 1, 0, 0);
    sceneG.globalAlpha = 1;
    sceneG.globalCompositeOperation = 'source-over';
    sceneG.fillStyle = '#000';
    sceneG.fillRect(0, 0, W, H);
    (SCENES[G.id] || sceneVoid)(sceneG, t, G, cam);
    overlayTimecode(sceneG, t, G);
    return true;
  };
  // Run ONLY the GL post stack on whatever is currently on the scene canvas.
  // Used by tools/orient-test.js to check capture-path orientation.
  window.__GL_ONLY = function () {
    glStack.render(sceneCv, {
      time: 0, bloom: 1.0, bloomThresh: 0.42, aberration: 0.0, grain: 0.0,
      vignette: 0.0, scan: 0.0, warp: 0.0, expose: 1.0, desat: 0.0,
      tint: [1, 1, 1], flash: 0, shake: [0, 0],
    });
    return true;
  };
}

window.addEventListener('load', () => {
  try { init(); } catch (e) {
    window.__ERROR = String(e && e.stack || e);
    console.error(e);
  }
});
