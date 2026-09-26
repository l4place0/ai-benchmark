/**
 * Complete Visual Scene Renderers for Mili - world.execute(me); Full MV
 * All scenes are 100% deterministic pure functions of time t, beat, and canvas context.
 */

export function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Ambient Cyber Sky & Constellation Matrix (Above Horizon)
 */
export function drawSkyMatrix(ctx, t, beat, width = 1920, height = 1080) {
  const horizonY = height * 0.61;
  const numStars = 65;

  ctx.save();
  for (let i = 0; i < numStars; i++) {
    const sx = pseudoRandom(i * 3 + 1) * width;
    const sy = pseudoRandom(i * 3 + 2) * (horizonY - 40);
    const twinkle = Math.sin(t * 3.5 + i * 1.7) * 0.4 + 0.6;
    const starR = (pseudoRandom(i + 10) * 2 + 1) * (1 + beat * 0.5);

    ctx.fillStyle = i % 3 === 0 ? `rgba(255, 0, 85, ${twinkle * 0.7})` : `rgba(0, 243, 255, ${twinkle * 0.8})`;
    ctx.beginPath();
    ctx.arc(sx, sy, starR, 0, Math.PI * 2);
    ctx.fill();

    if (i % 6 === 0) {
      const sx2 = pseudoRandom((i + 1) * 3 + 1) * width;
      const sy2 = pseudoRandom((i + 1) * 3 + 2) * (horizonY - 40);
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
  }

  // Distant Horizon Cyber-City Monoliths
  const numMonoliths = 14;
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.22)';
  ctx.lineWidth = 1.2;
  for (let m = 0; m < numMonoliths; m++) {
    const mx = (m / numMonoliths) * width + 20;
    const mw = 35 + pseudoRandom(m) * 45;
    const mh = 40 + pseudoRandom(m + 30) * 90;
    ctx.strokeRect(mx - mw / 2, horizonY - mh, mw, mh);
  }

  ctx.restore();
}

/**
 * High-Tech HUD & Telemetry Overlay
 */
export function drawHUD(ctx, t, state, width = 1920, height = 1080) {
  ctx.save();
  const beat = state.beatImpulse;

  // Frame Border Brackets
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
  ctx.lineWidth = 2;
  const margin = 36;
  const corner = 48;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(margin + corner, margin);
  ctx.lineTo(margin, margin);
  ctx.lineTo(margin, margin + corner);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(width - margin - corner, margin);
  ctx.lineTo(width - margin, margin);
  ctx.lineTo(width - margin, margin + corner);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(margin, height - margin - corner);
  ctx.lineTo(margin, height - margin);
  ctx.lineTo(margin + corner, height - margin);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(width - margin - corner, height - margin);
  ctx.lineTo(width - margin, height - margin);
  ctx.lineTo(width - margin, height - margin - corner);
  ctx.stroke();

  // Top-Left Header
  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 22px "Consolas", "Courier New", monospace';
  ctx.fillText('MILI // world.execute(me);', margin + 15, margin + 28);
  ctx.fillStyle = 'rgba(0, 243, 255, 0.65)';
  ctx.font = '14px "Consolas", monospace';
  const mins = Math.floor(t / 60);
  const secs = (t % 60).toFixed(3).padStart(6, '0');
  const frameNo = Math.floor(t * 60).toString().padStart(5, '0');
  ctx.fillText(`TIMECODE: 00:${String(mins).padStart(2, '0')}:${secs} | FRAME: #${frameNo}`, margin + 15, margin + 50);

  // Top-Right System Status
  ctx.textAlign = 'right';
  ctx.fillStyle = beat > 0.4 ? '#ff0055' : '#00f3ff';
  ctx.font = 'bold 15px "Consolas", monospace';
  ctx.fillText(`STATUS: ACTIVE // LOCK-STEP 60FPS`, width - margin - 15, margin + 28);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px "Consolas", monospace';
  ctx.fillText(`AUDIO SYNC: 145.5 BPM | FULL 1080p MV`, width - margin - 15, margin + 50);

  // Bottom-Left Code Execution Terminal Box
  if (state.activeLyric && state.activeLyric.code && state.sceneName !== 'bsod') {
    const boxW = 560;
    const boxH = 92;
    const boxX = margin + 15;
    const boxY = height - margin - boxH - 15;

    ctx.fillStyle = 'rgba(5, 12, 22, 0.88)';
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
    ctx.fillRect(boxX, boxY, boxW, 22);
    ctx.fillStyle = '#00f3ff';
    ctx.font = 'bold 11px "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('>_ CONSOLE EXECUTION // Java.lang.Simulation', boxX + 10, boxY + 15);

    ctx.fillStyle = '#a6e22e';
    ctx.font = '14px "Consolas", monospace';
    const codeLines = state.activeLyric.code.split('\n');
    for (let l = 0; l < Math.min(2, codeLines.length); l++) {
      ctx.fillText(codeLines[l], boxX + 12, boxY + 44 + l * 22);
    }
  }

  // Bottom-Right Telemetry
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0, 243, 255, 0.6)';
  ctx.font = '12px "Consolas", monospace';
  const hashSeed = Math.floor(t * 4);
  const hashStr = Math.abs(Math.sin(hashSeed) * 1000000000).toString(16).padStart(8, '0');
  ctx.fillText(`CORE HASH: 0x${hashStr.toUpperCase()}...`, width - margin - 15, height - margin - 35);
  ctx.fillText(`T_FUNC: DETERMINISTIC f(t) [NO ACCUM DRIFT]`, width - margin - 15, height - margin - 18);

  // Subtle CRT Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5);
  }

  ctx.restore();
}

/**
 * Central Lyrics Display
 */
export function drawLyrics(ctx, t, state, width = 1920, height = 1080) {
  if (!state.activeLyric || state.sceneName === 'bsod') return;

  ctx.save();
  const lyric = state.activeLyric;
  const duration = lyric.end - lyric.start;
  const elapsed = t - lyric.start;
  const progress = Math.min(1.0, Math.max(0.0, elapsed / (duration * 0.55)));
  const visibleChars = Math.floor(progress * lyric.text.length);
  const textToShow = lyric.text.slice(0, visibleChars);
  const cursorBlink = Math.sin(t * 12) > 0 ? '_' : ' ';

  const centerY = height * 0.35;

  if (lyric.sub) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 243, 255, 0.75)';
    ctx.font = 'bold 15px "Consolas", monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(lyric.sub, width / 2, centerY - 48);
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 44px "Consolas", "Courier New", monospace';

  const beat = state.beatImpulse;
  if (beat > 0.4) {
    ctx.fillStyle = 'rgba(255, 0, 85, 0.8)';
    ctx.fillText(textToShow + cursorBlink, width / 2 - 4 * beat, centerY);
    ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
    ctx.fillText(textToShow + cursorBlink, width / 2 + 4 * beat, centerY);
  }

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12 * beat + 6;
  ctx.fillText(textToShow + cursorBlink, width / 2, centerY);

  if (lyric.emphasis && progress > 0.6) {
    const emphAlpha = Math.min(1.0, (progress - 0.6) / 0.3);
    ctx.font = '900 64px "Consolas", sans-serif';
    ctx.fillStyle = `rgba(255, 0, 85, ${emphAlpha * 0.92})`;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 24 * beat + 10;
    ctx.fillText(lyric.emphasis, width / 2, centerY + 68);
  }

  ctx.restore();
}

/**
 * Scene Renderers
 */
export function drawPowerLineScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cy = height * 0.68;
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 18 * beat + 10;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();

  const numSparks = 20;
  for (let i = 0; i < numSparks; i++) {
    const seed = i + Math.floor(t * 15);
    const px = ((i / numSparks) * width + t * 450) % width;
    const py = cy + (pseudoRandom(seed) - 0.5) * (45 + beat * 65);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 16, cy);
    ctx.lineTo(px, py);
    ctx.lineTo(px + 16, cy);
    ctx.stroke();

    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(px, py, 3.5 + beat * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const voltage = 220 + Math.sin(t * 30) * 15 + beat * 30;
  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 20px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HIGH VOLTAGE: ${voltage.toFixed(1)} VAC [PHASE LOCKED]`, width / 2, cy + 48);
  ctx.restore();
}

export function drawProtectionScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.66;
  const baseR = 150 + beat * 30;

  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 20;

  for (let ring = 1; ring <= 3; ring++) {
    const r = baseR * (ring * 0.45);
    const rot = t * (ring % 2 === 0 ? 0.8 : -0.8) + ring * 0.4;
    const sides = 6;
    ctx.strokeStyle = ring === 3 ? '#ff0055' : `rgba(0, 243, 255, ${0.8 / ring})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const angle = rot + (s * Math.PI * 2) / sides;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 + t * 0.4;
    const nx = cx + Math.cos(angle) * (baseR * 1.35);
    const ny = cy + Math.sin(angle) * (baseR * 1.35);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(nx, ny, 4 + beat * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 15px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[FIREWALL PROTOCOL: HARDENED 100%]', cx, cy + baseR * 1.55);
  ctx.restore();
}

export function drawPiecesScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.68;
  const rows = 8, cols = 8;
  const tileW = 50, tileH = 26;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isoX = cx + (c - r) * tileW;
      const isoY = cy + (c + r) * tileH * 0.5 - 60;

      ctx.strokeStyle = 'rgba(0, 243, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileW, isoY + tileH * 0.5);
      ctx.lineTo(isoX, isoY + tileH);
      ctx.lineTo(isoX - tileW, isoY + tileH * 0.5);
      ctx.closePath();
      ctx.stroke();

      const pieceDelay = (r * 8 + c) * 0.08;
      const dropProgress = Math.min(1.0, Math.max(0.0, (t - 3.87 - pieceDelay) * 3));
      if (dropProgress > 0) {
        const dropY = (1 - dropProgress) * -180;
        const pieceH = 28 + Math.sin(r * 2 + c) * 14;
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 0, 85, 0.2)';
        ctx.strokeStyle = (r + c) % 2 === 0 ? '#00f3ff' : '#ff0055';
        ctx.lineWidth = 1.5;
        ctx.fillRect(isoX - 11, isoY + dropY - pieceH, 22, pieceH);
        ctx.strokeRect(isoX - 11, isoY + dropY - pieceH, 22, pieceH);
      }
    }
  }
  ctx.restore();
}

export function drawObjectCreationScene(ctx, t, beat, engine3d, width = 1920, height = 1080) {
  ctx.save();
  const ico = engine3d.getIcosahedron(t, 160 + beat * 25, 540);
  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 15 * beat + 8;
  ctx.lineWidth = 2.5;

  ico.edges.forEach(e => {
    ctx.beginPath();
    ctx.moveTo(e.p1.x, e.p1.y);
    ctx.lineTo(e.p2.x, e.p2.y);
    ctx.stroke();
  });

  ctx.fillStyle = '#ffffff';
  ico.points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + beat * 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function drawInitializationScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const initProgress = Math.min(1.0, Math.max(0.0, (t - 7.44) / 3.2));

  const barW = 750, barH = 32;
  const barX = cx - barW / 2, barY = cy;

  ctx.fillStyle = 'rgba(5, 12, 22, 0.9)';
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 2;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 14;
  ctx.fillRect(barX + 4, barY + 4, (barW - 8) * initProgress, barH - 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Consolas", monospace';
  ctx.fillText(`INITIALIZING DATA: ${(initProgress * 100).toFixed(1)}%`, cx, barY - 18);

  ctx.font = '13px "Consolas", monospace';
  ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
  for (let col = 0; col < 4; col++) {
    const colX = barX + col * 190;
    for (let row = 0; row < 3; row++) {
      const hex = Math.floor(pseudoRandom(col * 10 + row + Math.floor(t * 10)) * 0xFFFFFFFF).toString(16).padStart(8, '0');
      ctx.fillText(`0x${hex.toUpperCase()}`, colX + 40, barY + barH + 26 + row * 20);
    }
  }
  ctx.restore();
}

export function drawMatrixWarpScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cols = 40;
  const colSpacing = width / cols;

  ctx.font = '15px "Consolas", monospace';
  for (let c = 0; c < cols; c++) {
    const x = c * colSpacing + 12;
    const speed = 250 + pseudoRandom(c) * 300;
    const startY = (t * speed + pseudoRandom(c + 50) * 1000) % (height + 200) - 100;

    for (let r = 0; r < 14; r++) {
      const y = startY - r * 20;
      if (y >= 0 && y <= height) {
        const char = Math.floor(pseudoRandom(c * 100 + r + Math.floor(t * 8)) * 2) ? '1' : '0';
        const alpha = Math.max(0, 1 - r / 14);
        ctx.fillStyle = r === 0 ? '#ffffff' : `rgba(0, 243, 255, ${alpha * 0.75})`;
        ctx.fillText(char, x, y);
      }
    }
  }

  const numBars = 32, barWidth = 14;
  const totalEqW = numBars * (barWidth + 6);
  const eqStartX = (width - totalEqW) / 2;
  const eqBaseY = height * 0.88;

  for (let b = 0; b < numBars; b++) {
    const freq = Math.sin(b * 0.35 + t * 8) * 0.5 + 0.5;
    const barHeight = freq * 90 + beat * 60;
    const bx = eqStartX + b * (barWidth + 6);
    ctx.fillStyle = b % 2 === 0 ? '#00f3ff' : '#ff0055';
    ctx.fillRect(bx, eqBaseY - barHeight, barWidth, barHeight);
  }
  ctx.restore();
}

export function drawDimensionScene(ctx, t, beat, engine3d, width = 1920, height = 1080) {
  ctx.save();
  const tesseract = engine3d.getTesseractEdges(t, 220 + beat * 30);
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 12 * beat + 6;

  tesseract.edges.forEach(e => {
    const depthAlpha = Math.max(0.2, Math.min(1.0, 1.2 - (e.depth - 400) / 400));
    ctx.strokeStyle = `rgba(0, 243, 255, ${depthAlpha})`;
    ctx.beginPath();
    ctx.moveTo(e.p1.x, e.p1.y);
    ctx.lineTo(e.p2.x, e.p2.y);
    ctx.stroke();
  });

  ctx.fillStyle = '#ffffff';
  tesseract.points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5 + beat * 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 15px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FOUR-DIMENSIONAL TESSERACT // SO(4) LIE ROTATION [X-W, Y-Z, X-Y]', width / 2, height * 0.88);
  ctx.restore();
}

export function drawCircumferenceScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.64;
  const R = 160 + beat * 25;

  ctx.shadowColor = '#ffb703';
  ctx.shadowBlur = 16 * beat + 8;
  ctx.strokeStyle = '#ffb703';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  const angle = t * 3.5;
  const rx = cx + Math.cos(angle) * R;
  const ry = cy + Math.sin(angle) * R;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(rx, ry);
  ctx.stroke();

  const tanX = rx - Math.sin(angle) * 70;
  const tanY = ry + Math.cos(angle) * 70;
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(tanX, tanY);
  ctx.stroke();

  ctx.fillStyle = '#ffb703';
  ctx.font = 'bold 22px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`CIRCUMFERENCE: C = 2πr = ${(2 * Math.PI * R).toFixed(1)} px`, cx, cy + R + 52);

  for (let ring = 1; ring <= 3; ring++) {
    const echoR = R + ((t * 80 + ring * 50) % 150);
    const alpha = Math.max(0, 1 - (echoR - R) / 150);
    ctx.strokeStyle = `rgba(255, 183, 3, ${alpha * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, echoR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSineAndTangentsScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cy = height * 0.64;
  const A = 100 + beat * 25;
  const k = 0.007;
  const omega = 4.2;

  ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();

  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 16 * beat + 8;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 4) {
    const y = cy + A * Math.sin(k * x - omega * t);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const x0 = ((i / 5) * width + t * 180) % width;
    const phase = k * x0 - omega * t;
    const y0 = cy + A * Math.sin(phase);
    const slope = A * k * Math.cos(phase);

    const tanLen = 95;
    const dx = tanLen / Math.hypot(1, slope);
    const dy = dx * slope;

    ctx.strokeStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(x0 - dx, y0 - dy);
    ctx.lineTo(x0 + dx, y0 + dy);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0, y0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff0055';
    ctx.font = '11px "Consolas", monospace';
    ctx.fillText(`m=${slope.toFixed(2)}`, x0, y0 - 16);
  }

  ctx.fillStyle = '#00f3ff';
  ctx.font = 'bold 16px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('y(x,t) = A·sin(kx - ωt) | TANGENT DERIVATIVE: dy/dx = A·k·cos(kx - ωt)', width / 2, cy + A + 55);
  ctx.restore();
}

export function drawLimitationsScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.64;
  const limitDist = 135 - beat * 20;

  ctx.strokeStyle = '#ff0055';
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 8]);
  ctx.beginPath();
  ctx.moveTo(0, cy - limitDist);
  ctx.lineTo(width, cy - limitDist);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, cy + limitDist);
  ctx.lineTo(width, cy + limitDist);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 6) {
    const normX = (x - cx) * 0.005;
    const yVal = Math.tanh(normX + Math.sin(t * 4)) * (limitDist - 8);
    const y = cy + yVal;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.font = 'bold 84px "Consolas", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb703';
  ctx.shadowColor = '#ffb703';
  ctx.shadowBlur = 24 * beat + 12;
  ctx.fillText('∞', cx, cy + 28);

  ctx.font = 'bold 18px "Consolas", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('lim_{x → ∞} f(x) = BOUND.YOU', cx, cy + limitDist + 45);
  ctx.restore();
}

export function drawACToDCScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cy1 = height * 0.54;
  const cy2 = height * 0.74;

  ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(width * 0.15, cy1 - 65, width * 0.7, 130);
  ctx.strokeRect(width * 0.15, cy2 - 65, width * 0.7, 130);

  ctx.strokeStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = width * 0.15; x <= width * 0.85; x += 4) {
    const y = cy1 + Math.sin((x - width * 0.15) * 0.02 - t * 14) * 40;
    if (x === width * 0.15) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#ffb703';
  ctx.shadowColor = '#ffb703';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = width * 0.15; x <= width * 0.85; x += 4) {
    const ripple = Math.abs(Math.sin((x - width * 0.15) * 0.04 - t * 28)) * 6;
    const y = cy2 - 20 + ripple;
    if (x === width * 0.15) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.font = 'bold 16px "Consolas", monospace';
  ctx.fillStyle = '#00f3ff';
  ctx.textAlign = 'left';
  ctx.fillText('CH 1: AC INPUT [~ 240V PEAK-TO-PEAK]', width * 0.16, cy1 - 38);
  ctx.fillStyle = '#ffb703';
  ctx.fillText('CH 2: DC OUTPUT [= +12.0V RECTIFIED]', width * 0.16, cy2 - 38);
  ctx.restore();
}

export function drawDizzyScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height / 2;

  const numSpokes = 36;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i * Math.PI * 2) / numSpokes + t * 4.5;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 0, 85, 0.7)' : 'rgba(0, 243, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 80, cy + Math.sin(angle) * 80);
    ctx.lineTo(cx + Math.cos(angle) * 900, cy + Math.sin(angle) * 900);
    ctx.stroke();
  }

  const flashAlpha = Math.min(0.85, beat * 0.8 + 0.15);
  ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 120 + beat * 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawUniteScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const numDots = 80;
  for (let i = 0; i < numDots; i++) {
    const fraction = i / numDots;
    const r = fraction * 240 * (1 - beat * 0.2);
    const angleA = fraction * Math.PI * 6 + t * 3;
    const angleB = fraction * Math.PI * 6 + t * 3 + Math.PI;

    const xA = cx + Math.cos(angleA) * r, yA = cy + Math.sin(angleA) * r;
    const xB = cx + Math.cos(angleB) * r, yB = cy + Math.sin(angleB) * r;

    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(xA, yA, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(xB, yB, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (i % 4 === 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawExecutionRushScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;

  if (beat > 0.45) {
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }

  ctx.textAlign = 'center';
  ctx.font = '900 100px "Consolas", sans-serif';
  ctx.fillStyle = beat > 0.5 ? '#ffffff' : '#ff0055';
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 35 * beat + 15;
  ctx.fillText('EXECUTION', cx, cy + 28);

  const numGlitches = Math.floor(beat * 8);
  for (let g = 0; g < numGlitches; g++) {
    const gy = pseudoRandom(g + Math.floor(t * 20)) * height;
    const gh = pseudoRandom(g + 20) * 25 + 5;
    ctx.fillStyle = 'rgba(0, 243, 255, 0.4)';
    ctx.fillRect(0, gy, width, gh);
  }
  ctx.restore();
}

export function drawExecuteClimaxScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;

  const numParticles = 120;
  for (let i = 0; i < numParticles; i++) {
    const angle = pseudoRandom(i) * Math.PI * 2;
    const speed = 100 + pseudoRandom(i + 50) * 450;
    const dist = ((t - 70.08) * speed) % 950;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;

    ctx.fillStyle = i % 2 === 0 ? '#00f3ff' : '#ff0055';
    ctx.beginPath();
    ctx.arc(px, py, 2.5 + pseudoRandom(i + 10) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.font = '900 78px "Consolas", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 25 * beat + 15;
  ctx.fillText('world.execute(me);', cx, cy + 20);
  ctx.restore();
}

/**
 * NEW SCENES FOR FULL SONG
 */

// Scene: 3D DNA Helix (Eggplant / Tomato / Nutrients / Antioxidants)
export function drawDNAHelixScene(ctx, t, beat, engine3d, width = 1920, height = 1080) {
  ctx.save();
  const dna = engine3d.getDNAHelix(t, 550, 3.5, 36);

  ctx.lineWidth = 2.5;
  // Draw rungs
  dna.rungs.forEach(rung => {
    ctx.strokeStyle = rung.i % 2 === 0 ? 'rgba(0, 243, 255, 0.6)' : 'rgba(255, 0, 85, 0.6)';
    ctx.beginPath();
    ctx.moveTo(rung.p1.x, rung.p1.y);
    ctx.lineTo(rung.p2.x, rung.p2.y);
    ctx.stroke();
  });

  // Draw Strands
  ctx.fillStyle = '#00f3ff';
  dna.strandA.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + beat * 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#ff0055';
  dna.strandB.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + beat * 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// Scene: Purr Wave (Tabby Cat / Enjoyment)
export function drawPurrWaveScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;

  // Concentric Purr Frequency Waves (25Hz)
  const numRings = 7;
  for (let r = 0; r < numRings; r++) {
    const radius = ((t * 120 + r * 45) % 300) + 30;
    const alpha = Math.max(0, 1 - radius / 330);
    ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Wireframe Kitty Ears Icon
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy + 20);
  ctx.lineTo(cx - 60, cy - 50);
  ctx.lineTo(cx - 20, cy - 20);
  ctx.lineTo(cx + 20, cy - 20);
  ctx.lineTo(cx + 60, cy - 50);
  ctx.lineTo(cx + 50, cy + 20);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#ff0055';
  ctx.font = 'bold 18px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PURR HARMONICS: 25.0 Hz // ENJOYMENT PROTOCOL', cx, cy + 85);
  ctx.restore();
}

// Scene: God / Sacred Geometry (Existence)
export function drawGodExistenceScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;

  ctx.strokeStyle = '#ffb703';
  ctx.shadowColor = '#ffb703';
  ctx.shadowBlur = 20 * beat + 10;
  ctx.lineWidth = 2;

  // Star of David / Metatron Circle
  const R = 150 + beat * 30;
  for (let poly = 0; poly < 2; poly++) {
    const rot = t * 0.6 + poly * (Math.PI / 3);
    ctx.beginPath();
    for (let s = 0; s <= 3; s++) {
      const a = rot + s * (Math.PI * 2 / 3);
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OBSERVER EFFECT: EXISTENCE VALIDATED', cx, cy + R + 45);
  ctx.restore();
}

// Scene: Gender Switch (F to M / S to M)
export function drawGenderSwitchScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const isF = Math.sin(t * 8) > 0;

  ctx.textAlign = 'center';
  ctx.font = 'bold 120px "Consolas", sans-serif';
  ctx.fillStyle = isF ? '#ff0055' : '#00f3ff';
  ctx.shadowColor = isF ? '#ff0055' : '#00f3ff';
  ctx.shadowBlur = 30;
  ctx.fillText(isF ? '♀ [F]' : '♂ [M]', cx, cy + 40);

  ctx.font = 'bold 18px "Consolas", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`POLARITY BIT: ${isF ? '0x01 (FEMALE)' : '0x00 (MALE)'}`, cx, cy + 90);
  ctx.restore();
}

// Scene: AM to PM (24-Hour Radar Chrono)
export function drawAMPMScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const R = 140;

  ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // Radar Sweep
  const sweepAngle = t * 4;
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
  ctx.stroke();

  ctx.fillStyle = '#ffb703';
  ctx.font = 'bold 20px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AM 06:00', cx - 90, cy - R - 15);
  ctx.fillText('PM 18:00', cx + 90, cy - R - 15);
  ctx.restore();
}

// Scene: Trance Vortex
export function drawTranceVortexScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const rings = 12;

  for (let r = 1; r <= rings; r++) {
    const radius = r * 22;
    const rot = t * (r % 2 === 0 ? 2 : -2) + r * 0.3;
    const sides = 8;

    ctx.strokeStyle = r % 2 === 0 ? 'rgba(255, 0, 85, 0.7)' : 'rgba(0, 243, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const a = rot + (s * Math.PI * 2) / sides;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Scene: BSOD Fatal Kernel Panic
export function drawBSODScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  // Classic Blue Screen
  ctx.fillStyle = '#0000aa';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = '22px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'left';

  const startX = 160;
  let lineY = 220;

  ctx.fillText('A problem has been detected and world.execute has been shut down.', startX, lineY);
  lineY += 40;
  ctx.fillText('ILLEGAL_ARGUMENT_EXCEPTION // PARADOX_DETECTED', startX, lineY);
  lineY += 60;
  ctx.fillText('If this is the first time you\'ve seen this Stop error screen,', startX, lineY);
  lineY += 30;
  ctx.fillText('restart your simulation. If this screen appears again, verify your arguments.', startX, lineY);
  lineY += 60;
  ctx.fillText('Technical Information:', startX, lineY);
  lineY += 40;
  ctx.fillText('*** STOP: 0x0000004E (0x00000099, 0x00000000, 0x00000000, 0x00000000)', startX, lineY);
  lineY += 50;

  const dumpProgress = Math.min(100, Math.floor((t - 133.5) * 8));
  ctx.fillText(`Dumping physical memory to disk: ${dumpProgress}%`, startX, lineY);
  ctx.restore();
}

// Scene: Execution Spam (Fork Bomb)
export function drawExecutionSpamScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const numSpams = 18;
  for (let i = 0; i < numSpams; i++) {
    const seed = i + Math.floor(t * 12);
    const x = pseudoRandom(seed * 3) * (width - 300) + 150;
    const y = pseudoRandom(seed * 5) * (height - 200) + 100;
    const rot = (pseudoRandom(seed * 7) - 0.5) * 0.8;
    const size = 30 + pseudoRandom(seed * 11) * 55;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `900 ${size}px "Consolas", sans-serif`;
    ctx.fillStyle = i % 2 === 0 ? '#ff0055' : '#ffffff';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 15;
    ctx.fillText('EXECUTION', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// Scene: Multilingual Countdown (EIN DOS TROIS NE FEM LIU)
export function drawMultilingualCountScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const words = ['EIN (1)', 'DOS (2)', 'TROIS (3)', 'NE (4)', 'FEM (5)', 'LIU (6)', 'EXECUTION!'];
  const step = Math.min(words.length - 1, Math.floor((t - 158.90) / 0.5));
  const currentWord = words[step];

  ctx.textAlign = 'center';
  ctx.font = '900 130px "Consolas", sans-serif';
  ctx.fillStyle = step === 6 ? '#ff0055' : '#00f3ff';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 40;
  ctx.fillText(currentWord, width / 2, height * 0.62);
  ctx.restore();
}

// Scene: Algebraic Cardioid / Heart Curve (L-O-V-E)
export function drawLoveCardioidScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;
  const scale = 11 + beat * 3;

  ctx.strokeStyle = '#ff0055';
  ctx.shadowColor = '#ff0055';
  ctx.shadowBlur = 22 * beat + 12;
  ctx.lineWidth = 3.5;

  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2; a += 0.05) {
    // Mathematical Heart Parametric Formula:
    // x = 16 * sin^3(t)
    // y = 13 * cos(t) - 5 * cos(2t) - 2 * cos(3t) - cos(4t)
    const hx = 16 * Math.pow(Math.sin(a), 3);
    const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));

    const px = cx + hx * scale;
    const py = cy + hy * scale;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.font = 'bold 20px "Consolas", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('(x² + y² - 1)³ - x²·y³ = 0 // LOVE EQUATION SOLVED', cx, cy + 130);
  ctx.restore();
}

// Scene: While True Love (Recursive Fractal Hearts)
export function drawWhileTrueLoveScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.65;

  // Nested Beating Hearts
  for (let h = 1; h <= 4; h++) {
    const scale = (h * 3.5 + beat * 2) * ((t * 0.5 + h) % 1.5);
    ctx.strokeStyle = h % 2 === 0 ? 'rgba(255, 0, 85, 0.8)' : 'rgba(0, 243, 255, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.08) {
      const hx = 16 * Math.pow(Math.sin(a), 3);
      const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      const px = cx + hx * scale;
      const py = cy + hy * scale;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Syntax Box
  ctx.fillStyle = 'rgba(5, 12, 22, 0.85)';
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 1.5;
  ctx.fillRect(cx - 220, cy + 90, 440, 65);
  ctx.strokeRect(cx - 220, cy + 90, 440, 65);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('while(true) { this.love("you"); }', cx, cy + 130);
  ctx.restore();
}

// Scene: Epilogue
export function drawEpilogueScene(ctx, t, beat, width = 1920, height = 1080) {
  ctx.save();
  const cx = width / 2;
  const cy = height * 0.5;

  ctx.textAlign = 'center';
  ctx.font = 'bold 28px "Consolas", monospace';
  ctx.fillStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 10;
  ctx.fillText('[SIMULATION TERMINATED]', cx, cy - 40);

  ctx.font = '18px "Consolas", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('Exit Code: 0 (SUCCESS) // Total Frames: 12,960 @ 60FPS', cx, cy + 10);

  const blink = Math.sin(t * 6) > 0 ? '_' : ' ';
  ctx.fillStyle = '#ff0055';
  ctx.fillText(`Restart world.execute(me)? (Y/n)${blink}`, cx, cy + 50);
  ctx.restore();
}
