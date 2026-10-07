/**
 * Master Visual Composite Renderer for Mili - world.execute(me); (Shot 02)
 * Pure Function Rendering: renderFrame(ctx, state, assets, width, height)
 */

import { projectTesseract, generateDNA, generateCardioidHeart, projectIcosahedron } from './engine3d.js';
import { SONG_DURATION } from './timeline.js';

// Pre-seeded pseudo-random generator for 100% deterministic particles
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// 120 deterministic cyber particles
const PARTICLES = [];
for (let i = 0; i < 120; i++) {
  PARTICLES.push({
    x0: pseudoRandom(i * 3 + 1),
    y0: pseudoRandom(i * 3 + 2),
    speed: 0.03 + pseudoRandom(i * 5 + 3) * 0.08,
    size: 1.5 + pseudoRandom(i * 7 + 4) * 3.5,
    freq: 1.0 + pseudoRandom(i * 11 + 5) * 3.0,
    hue: (i % 3 === 0) ? 185 : (i % 3 === 1) ? 310 : 45
  });
}

// 40 deterministic matrix rain columns
const RAIN_COLUMNS = [];
for (let i = 0; i < 40; i++) {
  RAIN_COLUMNS.push({
    xPct: i / 40,
    speed: 0.15 + pseudoRandom(i * 13 + 1) * 0.25,
    offset: pseudoRandom(i * 17 + 2),
    chars: "010101XYZABCDEF8942世界執行我LOAD_MEM_ALLOC_EXEC_TRUE"
  });
}

/**
 * Main Frame Render Entrypoint
 */
export function renderFrame(ctx, state, assets, width = 1920, height = 1080) {
  const { t, currentAct, activeLyric, lyricProgress, beatImpulse, beatPhase, isEpilogue } = state;

  // Clear canvas
  ctx.fillStyle = '#02040a';
  ctx.fillRect(0, 0, width, height);

  // If in epilogue shutdown sequence (> 212.35s)
  if (isEpilogue) {
    renderEpilogue(ctx, state, width, height);
    renderHUD(ctx, state, width, height);
    applyPostProcessing(ctx, state, width, height);
    return;
  }

  // 1. Render Illustrated Backdrop with Parallax & Beat Zoom
  renderBackdrop(ctx, state, assets, width, height);

  // 2. Render Ambient Cybernetic Grid & Digital Rain
  renderAtmosphere(ctx, state, width, height);

  // 3. Render Act-Specific 3D/Procedural Visuals
  renderActVisuals(ctx, state, width, height);

  // 4. Render Dynamic Kinetic Typography & Lyric Banners
  renderLyrics(ctx, state, width, height);

  // 5. Render HUD, Telemetry & Code Console
  renderHUD(ctx, state, width, height);

  // 6. Post-Processing: Scanlines, Vignette, Beat Chromatic Aberration
  applyPostProcessing(ctx, state, width, height);
}

/**
 * Render AI Illustrated Backdrop with Smooth Ken Burns Parallax & Beat Impact
 */
function renderBackdrop(ctx, state, assets, width, height) {
  const { t, activeLyric, beatImpulse, lyricProgress } = state;
  const imgKey = activeLyric ? activeLyric.image : null;
  const img = (imgKey && assets && assets.images) ? assets.images[imgKey] : null;

  if (!img) {
    // Elegant fallback dark radial gradient
    const grad = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, 900);
    grad.addColorStop(0, '#0d182b');
    grad.addColorStop(1, '#020409');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.save();

  // Subtle camera pan & zoom
  const panX = Math.sin(t * 0.15) * 35;
  const panY = Math.cos(t * 0.12) * 20;
  const baseScale = 1.06 + Math.sin(t * 0.2) * 0.04;
  const punchScale = baseScale + beatImpulse * 0.015;

  ctx.translate(width / 2 + panX, height / 2 + panY);
  ctx.scale(punchScale, punchScale);

  // Draw image centered
  const imgAspect = img.width / img.height;
  const screenAspect = width / height;
  let drawW, drawH;
  if (imgAspect > screenAspect) {
    drawH = height;
    drawW = height * imgAspect;
  } else {
    drawW = width;
    drawH = width / imgAspect;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  // Mood color grading tint overlay
  ctx.globalCompositeOperation = 'screen';
  let tintColor = 'rgba(10, 30, 60, 0.25)';
  if (state.currentAct.id === 2) tintColor = 'rgba(40, 35, 10, 0.20)'; // Sacred gold
  if (state.currentAct.id === 5) tintColor = 'rgba(30, 15, 45, 0.25)'; // Divine violet
  if (state.currentAct.id === 6) tintColor = 'rgba(50, 10, 40, 0.30)'; // Trance magenta
  if (state.currentAct.id === 7) tintColor = 'rgba(10, 20, 45, 0.35)'; // Isolation dark blue
  if (state.currentAct.id === 8) tintColor = 'rgba(60, 10, 15, 0.40)'; // Meltdown crimson
  if (state.currentAct.id === 9) tintColor = 'rgba(45, 10, 35, 0.30)'; // Love pink
  if (state.currentAct.id === 10) tintColor = 'rgba(45, 35, 15, 0.25)'; // Infinite golden
  ctx.fillStyle = tintColor;
  ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

  // Subtle dark vignette to focus center
  ctx.globalCompositeOperation = 'multiply';
  const vig = ctx.createRadialGradient(0, 0, 350, 0, 0, width * 0.7);
  vig.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  vig.addColorStop(0.7, 'rgba(180, 180, 190, 0.85)');
  vig.addColorStop(1, 'rgba(10, 15, 25, 0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);

  ctx.restore();
}

/**
 * Render Digital Matrix Atmosphere, Starfield & Floating Particles
 */
function renderAtmosphere(ctx, state, width, height) {
  const { t, beatImpulse } = state;

  ctx.save();

  // Floating Cyber Particles
  for (let i = 0; i < PARTICLES.length; i++) {
    const p = PARTICLES[i];
    const curY = (p.y0 + (t * p.speed)) % 1.0;
    const curX = (p.x0 + Math.sin(t * p.freq + i) * 0.04 + 1.0) % 1.0;

    const px = curX * width;
    const py = curY * height;
    const alpha = (0.35 + Math.sin(t * 3 + i) * 0.25) * (0.8 + beatImpulse * 0.3);

    ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, p.size * (1.0 + beatImpulse * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Digital Rain Overlay (Subtle)
  ctx.font = '12px "Consolas", monospace';
  for (let i = 0; i < RAIN_COLUMNS.length; i++) {
    const col = RAIN_COLUMNS[i];
    const x = col.xPct * width;
    const progress = (t * col.speed + col.offset) % 1.0;
    const yHead = progress * height;

    const charIndex = Math.floor((t * 10 + i * 3) % col.chars.length);
    const char = col.chars[charIndex];

    ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.fillText(char, x, yHead);

    ctx.fillStyle = 'rgba(0, 180, 220, 0.15)';
    for (let k = 1; k < 5; k++) {
      const prevChar = col.chars[(charIndex + k) % col.chars.length];
      ctx.fillText(prevChar, x, yHead - k * 16);
    }
  }

  ctx.restore();
}

/**
 * Render Act-Specific Procedural 3D & Mathematical Visuals
 */
function renderActVisuals(ctx, state, width, height) {
  const { t, currentAct, activeLyric, beatImpulse } = state;
  const actId = currentAct.id;
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();

  if (actId === 1) {
    // ACT 1: System Boot & Initialization Graphics
    renderBootHexShield(ctx, cx, cy, t, beatImpulse);
  } else if (actId === 2) {
    // ACT 2: 4D Tesseract & Mathematical Geometry
    renderAct2Geometry(ctx, state, cx, cy);
  } else if (actId === 3) {
    // ACT 3: Oscilloscope AC/DC & Chromatic Strobe
    renderAct3Circuits(ctx, state, cx, cy);
  } else if (actId === 4) {
    // ACT 4: First Chorus Shockwaves & Terminal Climax
    renderAct4Chorus(ctx, state, cx, cy);
  } else if (actId === 5) {
    // ACT 5: 3D DNA Double Helix & Sacred Observer
    renderAct5Biology(ctx, state, cx, cy);
  } else if (actId === 6) {
    // ACT 6: Polarity Dials & Kaleidoscopic Trance
    renderAct6Polarity(ctx, state, cx, cy);
  } else if (actId === 7) {
    // ACT 7: Shattered Isolation & Illegal Arguments
    renderAct7Isolation(ctx, state, cx, cy);
  } else if (actId === 8) {
    // ACT 8: BSOD Kernel Panic & Fork Bomb Cascade
    renderAct8BSOD(ctx, state, width, height);
  } else if (actId === 9) {
    // ACT 9: 3D Cardioid Heart & Formula
    renderAct9Love(ctx, state, cx, cy);
  } else if (actId === 10) {
    // ACT 10: Infinite Loop Singularity & Transcendence
    renderAct10Singularity(ctx, state, cx, cy);
  }

  ctx.restore();
}

/**
 * ACT 1: Hexagonal Protection Shield & Boot Rings
 */
function renderBootHexShield(ctx, cx, cy, t, beatImpulse) {
  ctx.save();
  const radius = 240 + Math.sin(t * 1.5) * 15 + beatImpulse * 25;
  const sides = 6;

  // Concentric rotating hexagons
  for (let ring = 1; ring <= 3; ring++) {
    const r = radius * (0.4 + ring * 0.25);
    const rot = (ring % 2 === 0 ? 1 : -1) * t * 0.4;

    ctx.strokeStyle = ring === 3 ? 'rgba(0, 240, 255, 0.7)' : 'rgba(0, 180, 255, 0.4)';
    ctx.lineWidth = ring === 3 ? 2.5 : 1.5;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = rot + (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Corner node blips
    for (let i = 0; i < sides; i++) {
      const angle = rot + (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(x, y, 3 + beatImpulse * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Crosshairs & Angles
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 320, cy); ctx.lineTo(cx + 320, cy);
  ctx.moveTo(cx, cy - 320); ctx.lineTo(cx, cy + 320);
  ctx.stroke();

  ctx.restore();
}

/**
 * ACT 2: 4D Tesseract & Geometric Calculus Visuals
 */
function renderAct2Geometry(ctx, state, cx, cy) {
  const { t, activeLyric, beatImpulse } = state;
  const scene = activeLyric ? activeLyric.scene : '';

  ctx.save();

  // Floating 4D Tesseract on left/center
  const tesseractScale = 140 + beatImpulse * 18;
  const tessX = (scene === 'geom_dimension') ? cx : cx - 380;
  const tessY = cy - 40;
  const { vertices, edges } = projectTesseract(tessX, tessY, tesseractScale, t);

  // Draw Tesseract edges with neon glow
  ctx.lineWidth = 2.0;
  for (let i = 0; i < edges.length; i++) {
    const [idxA, idxB] = edges[i];
    const vA = vertices[idxA];
    const vB = vertices[idxB];
    const avgZ = (vA.z + vB.z) / 2;
    const alpha = Math.max(0.2, Math.min(0.9, 0.55 + avgZ * 0.2));

    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(vA.x, vA.y);
    ctx.lineTo(vB.x, vB.y);
    ctx.stroke();
  }

  // Tesseract glowing vertices
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(v.x, v.y, 3.5 + beatImpulse * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // If Sine Wave scene: Render dynamic harmonic wave with Tangent Vector
  if (scene === 'geom_sine' || scene === 'geom_infinity') {
    const waveCX = cx + 320;
    const waveCY = cy - 20;
    const waveW = 500;
    const A = 65;
    const k = 0.035;
    const omega = 3.5;

    ctx.strokeStyle = 'rgba(255, 220, 100, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -waveW/2; x <= waveW/2; x += 4) {
      const y = A * Math.sin(k * x - omega * t);
      if (x === -waveW/2) ctx.moveTo(waveCX + x, waveCY + y);
      else ctx.lineTo(waveCX + x, waveCY + y);
    }
    ctx.stroke();

    // Tangent point and line: m = dy/dx
    const targetX = Math.sin(t * 1.5) * (waveW * 0.35);
    const targetY = A * Math.sin(k * targetX - omega * t);
    const slope = A * k * Math.cos(k * targetX - omega * t);

    // Tangent line segment
    const tanLen = 90;
    const dx = tanLen / Math.sqrt(1 + slope * slope);
    const dy = slope * dx;

    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(waveCX + targetX - dx, waveCY + targetY - dy);
    ctx.lineTo(waveCX + targetX + dx, waveCY + targetY + dy);
    ctx.stroke();

    // Tangent point marker
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(waveCX + targetX, waveCY + targetY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Tangent label
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ff3366';
    ctx.fillText(`TANGENT: m = ${slope.toFixed(3)}`, waveCX + targetX + 15, waveCY + targetY - 15);
  }

  // If Circle / Circumference scene: Render Golden Polar Circle
  if (scene === 'geom_circle') {
    const circCX = cx + 320;
    const circCY = cy - 20;
    const r = 130 + beatImpulse * 12;

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(circCX, circCY, r, 0, Math.PI * 2);
    ctx.stroke();

    // Tangential velocity vector
    const angle = t * 2.5;
    const px = circCX + Math.cos(angle) * r;
    const py = circCY + Math.sin(angle) * r;
    const vx = -Math.sin(angle) * 70;
    const vy = Math.cos(angle) * 70;

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + vx, py + vy);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`C = 2πr = ${(2 * Math.PI * r).toFixed(1)}px`, circCX - 60, circCY + r + 30);
  }

  ctx.restore();
}

/**
 * ACT 3: Dual Oscilloscope AC to DC Rectification & Strobe
 */
function renderAct3Circuits(ctx, state, cx, cy) {
  const { t, activeLyric, beatImpulse } = state;
  const scene = activeLyric ? activeLyric.scene : '';

  ctx.save();

  // Oscilloscope display frame
  const oscW = 800;
  const oscH = 340;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - oscW / 2, cy - oscH / 2, oscW, oscH);

  // Grid lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let x = -oscW/2; x <= oscW/2; x += 80) {
    ctx.beginPath();
    ctx.moveTo(cx + x, cy - oscH/2);
    ctx.lineTo(cx + x, cy + oscH/2);
    ctx.stroke();
  }
  for (let y = -oscH/2; y <= oscH/2; y += 40) {
    ctx.beginPath();
    ctx.moveTo(cx - oscW/2, cy + y);
    ctx.lineTo(cx + oscW/2, cy + y);
    ctx.stroke();
  }

  // AC to DC waveform
  const isRectifying = scene === 'ac_dc_rectify';
  const rectFactor = isRectifying ? Math.min(1.0, (t - 44.45) / 3.0) : 1.0;

  // Wave 1: Input AC (Cyan)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = -oscW/2; x <= oscW/2; x += 4) {
    const rawAC = Math.sin(x * 0.03 - t * 8) * 80;
    const rectified = Math.abs(rawAC);
    const smoothedDC = 65;
    const finalY = rawAC * (1 - rectFactor) + (rectified * 0.5 + smoothedDC * 0.5) * rectFactor;
    if (x === -oscW/2) ctx.moveTo(cx + x, cy + finalY);
    else ctx.lineTo(cx + x, cy + finalY);
  }
  ctx.stroke();

  // Wave 2: Complementary phase (Magenta)
  ctx.strokeStyle = 'rgba(255, 0, 128, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -oscW/2; x <= oscW/2; x += 6) {
    const y2 = Math.cos(x * 0.03 - t * 8) * 60 * (1 - rectFactor * 0.8);
    if (x === -oscW/2) ctx.moveTo(cx + x, cy - y2);
    else ctx.lineTo(cx + x, cy - y2);
  }
  ctx.stroke();

  // If Dizzy / Blind Vision: flash burst
  if (scene === 'flash_dizzy') {
    const flashAlpha = Math.max(0.0, Math.sin(t * 12)) * 0.45;
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, cx * 2, cy * 2);
  }

  ctx.restore();
}

/**
 * ACT 4: First Chorus Explosive Audio Shockwaves
 */
function renderAct4Chorus(ctx, state, cx, cy) {
  const { t, beatImpulse, beatPhase } = state;

  ctx.save();

  // Expanding shockwave concentric rings
  const ringCount = 5;
  for (let i = 0; i < ringCount; i++) {
    const ringPhase = (beatPhase + i / ringCount) % 1.0;
    const radius = ringPhase * 550;
    const alpha = (1.0 - ringPhase) * 0.7;

    ctx.strokeStyle = (i % 2 === 0) ? `rgba(255, 0, 100, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
    ctx.lineWidth = 3.0 * (1.0 - ringPhase) + 1.0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Central pulsating icosahedron core
  const icoScale = 120 + beatImpulse * 35;
  const { vertices, edges } = projectIcosahedron(cx, cy, icoScale, t * 1.6);

  ctx.strokeStyle = 'rgba(255, 220, 50, 0.85)';
  ctx.lineWidth = 2.0;
  for (let i = 0; i < edges.length; i++) {
    const [idxA, idxB] = edges[i];
    ctx.beginPath();
    ctx.moveTo(vertices[idxA].x, vertices[idxA].y);
    ctx.lineTo(vertices[idxB].x, vertices[idxB].y);
    ctx.stroke();
  }

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(v.x, v.y, 4 + beatImpulse * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * ACT 5: 3D DNA Double Helix & Feline Resonance
 */
function renderAct5Biology(ctx, state, cx, cy) {
  const { t, activeLyric, beatImpulse } = state;
  const scene = activeLyric ? activeLyric.scene : '';

  ctx.save();

  // 3D DNA Double Helix on right side
  const dnaCX = (scene === 'god_existence') ? cx : cx + 380;
  const dnaCY = cy;
  const dnaScale = 100 + beatImpulse * 12;
  const { strandA, strandB, rungs } = generateDNA(dnaCX, dnaCY, dnaScale, t);

  // Draw rungs (base pairs)
  ctx.lineWidth = 2.5;
  for (let i = 0; i < rungs.length; i++) {
    const r = rungs[i];
    const color = (r.index % 4 === 0) ? '#ff4081' : (r.index % 4 === 1) ? '#00e5ff' : (r.index % 4 === 2) ? '#ffea00' : '#76ff03';
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(r.a.x, r.a.y);
    ctx.lineTo(r.b.x, r.b.y);
    ctx.stroke();
  }

  // Draw Strand A
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < strandA.length; i++) {
    if (i === 0) ctx.moveTo(strandA[i].x, strandA[i].y);
    else ctx.lineTo(strandA[i].x, strandA[i].y);
  }
  ctx.stroke();

  // Draw Strand B
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < strandB.length; i++) {
    if (i === 0) ctx.moveTo(strandB[i].x, strandB[i].y);
    else ctx.lineTo(strandB[i].x, strandB[i].y);
  }
  ctx.stroke();

  // 25Hz purr resonance acoustic rings if tabby cat scene
  if (scene === 'bio_purr') {
    const purrCX = cx - 320;
    const purrCY = cy;
    for (let k = 1; k <= 4; k++) {
      const r = (k * 45 + (t * 60) % 45);
      const alpha = Math.max(0, 1 - r / 200);
      ctx.strokeStyle = `rgba(255, 180, 220, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(purrCX, purrCY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ff80bf';
    ctx.fillText('FELINE RESONANCE: 25.00 Hz', purrCX - 120, purrCY + 180);
  }

  ctx.restore();
}

/**
 * ACT 6: Polarity Dials & Kaleidoscopic Trance
 */
function renderAct6Polarity(ctx, state, cx, cy) {
  const { t, beatImpulse, activeLyric } = state;

  ctx.save();

  // Rotating Chrono Radar Dial
  const radius = 220 + beatImpulse * 20;
  ctx.strokeStyle = 'rgba(255, 0, 180, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 24-hour hour ticks
  for (let h = 0; h < 24; h++) {
    const angle = (h / 24) * Math.PI * 2;
    const isMajor = h % 6 === 0;
    const innerR = radius - (isMajor ? 18 : 8);
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * radius;
    const y2 = cy + Math.sin(angle) * radius;

    ctx.strokeStyle = isMajor ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Rotating Radar Sweep Hand
  const sweepAngle = t * 3.0;
  ctx.strokeStyle = 'rgba(255, 230, 0, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
  ctx.stroke();

  // Center Polarity Symbol (F / M / S / M)
  ctx.font = 'bold 36px "Orbitron", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (Math.floor(t * 1.5) % 2 === 0) ? '♀ FEMALE' : '♂ MALE';
  ctx.fillText(label, cx, cy);

  ctx.restore();
}

/**
 * ACT 7: Isolation Ruins & Critical Stack Trace
 */
function renderAct7Isolation(ctx, state, cx, cy) {
  const { t, activeLyric, beatImpulse } = state;
  const scene = activeLyric ? activeLyric.scene : '';

  ctx.save();

  // If illegal arguments: Large Red Warning Dialog Window
  if (scene === 'isolation_illegal_arguments') {
    const boxW = 760;
    const boxH = 260;
    ctx.fillStyle = 'rgba(30, 5, 10, 0.88)';
    ctx.fillRect(cx - boxW/2, cy - boxH/2, boxW, boxH);
    ctx.strokeStyle = '#ff0033';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - boxW/2, cy - boxH/2, boxW, boxH);

    // Warning Header
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(cx - boxW/2, cy - boxH/2, boxW, 40);
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('CRITICAL EXCEPTION: java.lang.IllegalArgumentException', cx - boxW/2 + 20, cy - boxH/2 + 26);

    // Stack Trace Lines
    ctx.font = '15px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ff8080';
    ctx.fillText('> PARADOX_DETECTED: Challenging your god with illegal arguments', cx - boxW/2 + 25, cy - boxH/2 + 75);
    ctx.fillText('> at World.execute(World.java:1337)', cx - boxW/2 + 25, cy - boxH/2 + 105);
    ctx.fillText('> at Simulation.runParadoxHandler(Core.java:404)', cx - boxW/2 + 25, cy - boxH/2 + 135);
    ctx.fillText('> Status: 100% PACKET LOSS // PEER UNREACHABLE', cx - boxW/2 + 25, cy - boxH/2 + 165);
    ctx.fillText('> MEMORY LEAK: Fractured emotional buffers not collected', cx - boxW/2 + 25, cy - boxH/2 + 195);
  }

  // Shattered polygon fragments floating
  for (let i = 0; i < 18; i++) {
    const fx = (cx - 400 + i * 48 + Math.sin(t * 2 + i) * 30);
    const fy = (cy + 120 + Math.cos(t * 1.5 + i) * 20);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, fy, 15, 15);
  }

  ctx.restore();
}

/**
 * ACT 8: BSOD Kernel Panic & Fork Bomb Cascade
 */
function renderAct8BSOD(ctx, state, width, height) {
  const { t, activeLyric, beatImpulse } = state;
  const scene = activeLyric ? activeLyric.scene : '';

  ctx.save();

  // If BSOD Kernel Panic: Authentic Blue Screen Overlay
  if (scene === 'bsod_kernel_panic') {
    ctx.fillStyle = 'rgba(0, 0, 136, 0.75)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '24px "Consolas", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('A problem has been detected and the World Engine has been shut down.', 120, 160);
    ctx.fillText('KERNEL_DATA_INPAGE_ERROR', 120, 210);
    ctx.fillText('Technical Information:', 120, 310);
    ctx.fillText('*** STOP: 0x0000004E (0x00000099, 0x00000000, 0x00000000, 0x00000000)', 120, 360);

    const memPct = Math.min(100, Math.floor(((t - 133.5) / 13.5) * 100));
    ctx.fillText(`Dumping physical memory to disk: ${memPct}%`, 120, 440);
    ctx.fillText('Contact your system administrator or technical support group for assistance.', 120, 500);
  }

  // If Fork Bomb / EXECUTION Spam: Cascade of diagonal red warning stamps
  if (scene === 'fork_bomb_execution' || scene === 'multilingual_countdown') {
    const stampCount = 14;
    for (let i = 0; i < stampCount; i++) {
      const phase = (t * 4 + i * 0.7) % stampCount;
      const sx = (i * 140) % width;
      const sy = ((i * 90 + t * 120) % height);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.25);
      ctx.strokeStyle = 'rgba(255, 0, 50, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-120, -35, 240, 70);
      ctx.font = 'bold 32px "Orbitron", sans-serif';
      ctx.fillStyle = '#ff0033';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXECUTION', 0, 0);
      ctx.restore();
    }
  }

  // Multilingual Countdown Numbers Flashing
  if (scene === 'multilingual_countdown') {
    const countWords = ["EIN", "DOS", "TROIS", "NE", "FEM", "LIU", "EXECUTION!"];
    const countIdx = Math.min(6, Math.floor((t - 158.9) / 0.5));
    const word = countWords[countIdx] || "EXECUTION!";

    ctx.font = '900 130px "Orbitron", sans-serif';
    ctx.fillStyle = (countIdx === 6) ? '#ff0033' : '#ffe066';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 40;
    ctx.fillText(word, width / 2, height / 2);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/**
 * ACT 9: 3D Parametric Cardioid Heart & Algebraic Proof
 */
function renderAct9Love(ctx, state, cx, cy) {
  const { t, beatImpulse } = state;

  ctx.save();

  // 3D Revolving Cardioid Heart
  const heartScale = 8.5 + beatImpulse * 1.5;
  const heartPoints = generateCardioidHeart(cx, cy - 30, heartScale, t);

  // Draw glowing heart wireframe
  ctx.strokeStyle = 'rgba(255, 60, 160, 0.85)';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  for (let i = 0; i < heartPoints.length; i++) {
    const pt = heartPoints[i];
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.stroke();

  // Glowing heart vertices
  for (let i = 0; i < heartPoints.length; i += 2) {
    const pt = heartPoints[i];
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3 + beatImpulse * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central pulsating core inside the heart
  const coreR = 25 + beatImpulse * 15;
  const radGrad = ctx.createRadialGradient(cx, cy - 30, 0, cx, cy - 30, coreR * 2);
  radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  radGrad.addColorStop(0.5, 'rgba(255, 50, 120, 0.6)');
  radGrad.addColorStop(1, 'rgba(255, 0, 100, 0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(cx, cy - 30, coreR * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * ACT 10: Infinite Loop Singularity & Transcendence
 */
function renderAct10Singularity(ctx, state, cx, cy) {
  const { t, beatImpulse, activeLyric } = state;

  ctx.save();

  // Golden particle vortex spiraling inward
  const particleCount = 64;
  for (let i = 0; i < particleCount; i++) {
    const angle = i * 0.35 + t * 2.0;
    const r = ((i * 12 + t * 80) % 450);
    const px = cx + Math.cos(angle) * r;
    const py = cy - 20 + Math.sin(angle) * r;
    const alpha = (1.0 - r / 450) * 0.85;

    ctx.fillStyle = (i % 2 === 0) ? `rgba(255, 220, 100, ${alpha})` : `rgba(255, 100, 180, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 2.5 + beatImpulse * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // If final execute climax: violent white shockwave
  if (activeLyric && activeLyric.scene === 'final_execute') {
    const climaxPhase = (t - 205.81) / (212.35 - 205.81);
    const blastR = climaxPhase * 1200;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 8 * (1 - climaxPhase);
    ctx.beginPath();
    ctx.arc(cx, cy, blastR, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Epilogue: Phosphor CRT Shutdown & Terminal Farewell
 */
function renderEpilogue(ctx, state, width, height) {
  const { t } = state;
  const epilogueT = t - SONG_DURATION; // 0.0s to 3.65s
  const cx = width / 2;
  const cy = height / 2;

  ctx.fillStyle = '#010204';
  ctx.fillRect(0, 0, width, height);

  if (epilogueT < 1.0) {
    // CRT Beam Collapse
    const progress = epilogueT / 1.0;
    const beamH = Math.max(2, (1 - progress) * height);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, cy - beamH / 2, width, beamH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, cy - 1, width, 2);
  } else {
    // Clean Terminal Console Output
    ctx.font = '22px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('>', 180, 420);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('world.execute(me);', 210, 420);

    ctx.fillStyle = '#00ff66';
    ctx.fillText('[SIMULATION TERMINATED SUCCESSFULLY]', 180, 470);
    ctx.fillText('EXIT CODE: 0 (STATUS_NORMAL_COMPLETION)', 180, 510);
    ctx.fillText('TOTAL FRAMES RENDERED: 12,960 @ 60.00 FPS', 180, 550);

    ctx.fillStyle = '#ff66aa';
    ctx.fillText('OUTPUT MESSAGE: "I LOVE YOU"', 180, 600);

    // Blinking cursor
    if (Math.floor(t * 3) % 2 === 0) {
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(180, 640, 14, 26);
    }
  }
}

/**
 * Dynamic Kinetic Typography & Lyric Banners
 */
function renderLyrics(ctx, state, width, height) {
  const { activeLyric, lyricProgress, beatImpulse } = state;
  if (!activeLyric) return;

  ctx.save();
  const cx = width / 2;
  const ly = height - 175;

  // Background blur pill for lyric legibility
  ctx.fillStyle = 'rgba(2, 6, 16, 0.72)';
  const pillW = 1200;
  const pillH = 76;
  ctx.beginPath();
  ctx.roundRect(cx - pillW / 2, ly - pillH / 2, pillW, pillH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Keyword Emphasis Stamp (Top Pill)
  if (activeLyric.emphasis) {
    ctx.font = 'bold 15px "Orbitron", sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'center';
    ctx.fillText(`<< ${activeLyric.emphasis} >>`, cx, ly - 48);
  }

  // Main Lyric Text
  ctx.font = 'bold 34px "Rajdhani", "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow shadow on beat
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10 + beatImpulse * 20;
  ctx.fillText(activeLyric.text, cx, ly);
  ctx.shadowBlur = 0;

  // Sub-diagnostic telemetry
  if (activeLyric.sub) {
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.fillText(activeLyric.sub, cx, ly + 26);
  }

  ctx.restore();
}

/**
 * Cyberpunk HUD, Telemetry & Code Console
 */
function renderHUD(ctx, state, width, height) {
  const { t, currentAct, activeLyric, beatPhase } = state;

  ctx.save();

  // Top Bar Frame
  ctx.fillStyle = 'rgba(2, 6, 14, 0.85)';
  ctx.fillRect(0, 0, width, 52);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.lineTo(width, 52);
  ctx.stroke();

  // Top Left: Title
  ctx.font = 'bold 18px "Orbitron", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.textAlign = 'left';
  ctx.fillText('MILI // world.execute(me);', 36, 32);

  // Top Center: Current Act
  ctx.font = 'bold 14px "Orbitron", sans-serif';
  ctx.fillStyle = '#ffe066';
  ctx.textAlign = 'center';
  ctx.fillText(`[ ${currentAct.name} ]`, width / 2, 32);

  // Top Right: Timecode & Specs
  const min = Math.floor(t / 60);
  const sec = (t % 60).toFixed(2).padStart(5, '0');
  const timeStr = `0${min}:${sec} / 03:36.00`;
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#00f0ff';
  ctx.textAlign = 'right';
  ctx.fillText(`TIME: ${timeStr} | 60FPS | 1080p | 145.5 BPM`, width - 36, 32);

  // Bottom Left: Pseudocode Box
  if (activeLyric && activeLyric.code) {
    const codeLines = activeLyric.code.split('\n');
    ctx.fillStyle = 'rgba(2, 6, 14, 0.75)';
    ctx.fillRect(36, height - 120, 380, 25 + codeLines.length * 18);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.strokeRect(36, height - 120, 380, 25 + codeLines.length * 18);

    ctx.font = 'bold 11px "Orbitron", sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'left';
    ctx.fillText('SOURCE EXECUTION BUFFER', 48, height - 102);

    ctx.font = '12px "Consolas", monospace';
    ctx.fillStyle = '#00f0ff';
    for (let k = 0; k < codeLines.length; k++) {
      ctx.fillText(codeLines[k], 48, height - 82 + k * 18);
    }
  }

  // Bottom Right: Audio Equalizer Simulation
  const barCount = 18;
  const barW = 8;
  const eqX = width - 240;
  const eqY = height - 55;
  for (let i = 0; i < barCount; i++) {
    const h = 8 + Math.abs(Math.sin(t * 8 + i * 0.7)) * 32;
    ctx.fillStyle = (i > 13) ? '#ff3366' : (i > 8) ? '#ffe066' : '#00f0ff';
    ctx.fillRect(eqX + i * (barW + 3), eqY - h, barW, h);
  }

  ctx.restore();
}

/**
 * Post-Processing: CRT Scanlines, Vignette & Audio Chromatic Aberration
 */
function applyPostProcessing(ctx, state, width, height) {
  const { beatImpulse } = state;

  ctx.save();

  // CRT Scanlines (Ultra-fine)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5);
  }

  // Corner Vignette
  const vig = ctx.createRadialGradient(width/2, height/2, width*0.35, width/2, height/2, width*0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
