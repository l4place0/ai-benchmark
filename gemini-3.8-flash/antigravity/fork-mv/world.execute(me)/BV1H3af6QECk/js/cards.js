/**
 * Master Graphic Cards Renderer for Mili - world.execute(me);
 * Implements 16 modular scene cards with Swiss graphic design, 
 * technical typography, physics ballistics, and risograph print aesthetics.
 * Each card is authored in a normalized 1920x916 coordinate space.
 */

import {
  BPM,
  BEAT_INTERVAL,
  AUDIO_OFFSET,
  getMusicBeat,
  getBeatPhase,
  getRhythmicImpulse,
  getSubBeatImpulse,
  getSixteenthImpulse,
  getBarPhase
} from './timeline.js';

export const COLORS = {
  paper: '#f3efe6',
  ink: '#181719',
  magenta: '#e71f74',
  blue: '#1b48b8',
  purple: '#5a1d6e',
  faint: 'rgba(24, 23, 25, 0.15)',
  darkBg: '#151618',
  darkText: '#f3efe6'
};

/**
 * Draw crop marks at corners of a rect
 */
export function drawCropMarks(ctx, x, y, w, h, len = 12) {
  ctx.save();
  ctx.strokeStyle = COLORS.faint;
  ctx.lineWidth = 1;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x - len, y); ctx.lineTo(x, y); ctx.lineTo(x, y - len);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w + len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x - len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h + len);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w + len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h + len);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw registration crosshair
 */
export function drawCross(ctx, x, y, size = 6) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

let dotPatternCanvas = null;
export function getDotPattern(ctx) {
  if (!dotPatternCanvas && typeof document !== 'undefined') {
    dotPatternCanvas = document.createElement('canvas');
    dotPatternCanvas.width = 10;
    dotPatternCanvas.height = 10;
    const pctx = dotPatternCanvas.getContext('2d');
    pctx.fillStyle = '#000000';
    pctx.fillRect(0, 0, 10, 10);
    pctx.fillStyle = '#ffffff';
    pctx.beginPath();
    pctx.arc(5, 5, 3.2, 0, Math.PI * 2);
    pctx.fill();
  }
  return dotPatternCanvas ? ctx.createPattern(dotPatternCanvas, 'repeat') : '#ffffff';
}

// Deterministic PRNG
export function pseudoRand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Draw iconic house / entity shape
 */
export function drawHouse(ctx, cx, cy, w, h, isSolid, color, seed = 1) {
  ctx.save();
  ctx.beginPath();
  const halfW = w / 2;
  const roofH = h * 0.38;
  
  // Roof peak
  ctx.moveTo(cx, cy - h / 2);
  // Roof right
  ctx.lineTo(cx + halfW, cy - h / 2 + roofH);
  // Body bottom right
  ctx.lineTo(cx + halfW * 0.94, cy + h / 2);
  // Body bottom left
  ctx.lineTo(cx - halfW * 0.94, cy + h / 2);
  // Roof left
  ctx.lineTo(cx - halfW, cy - h / 2 + roofH);
  ctx.closePath();

  if (isSolid) {
    ctx.fillStyle = color;
    ctx.fill();
    // Add authentic riso paper specks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 36; i++) {
      const px = cx + (pseudoRand(seed + i * 2) - 0.5) * w * 0.8;
      const py = cy + (pseudoRand(seed + i * 2 + 1) - 0.5) * h * 0.8;
      const r = 1.2 + pseudoRand(seed + i) * 2.2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(4, w * 0.07);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw technical tick ruler
 */
export function drawRuler(ctx, x1, y, x2, numTicks = 20, labels = []) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();

  const step = (x2 - x1) / (numTicks - 1);
  for (let i = 0; i < numTicks; i++) {
    const tx = x1 + i * step;
    const isMajor = i % 5 === 0;
    const th = isMajor ? 24 : 12;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, y + th);
    ctx.stroke();

    if (isMajor && labels[Math.floor(i / 5)] !== undefined) {
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(labels[Math.floor(i / 5)], tx, y + th + 28);
    }
  }
  ctx.restore();
}

/**
 * Helper to wrap card rendering in normalized coordinate space:
 * 1-column cards: 1920x1120 (360x210 in sheet)
 * 2-column cards: 3840x1120 (720x210 in sheet)
 */
export function wrapCard(ctx, rect, fn) {
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.beginPath();
  ctx.rect(0, 0, rect.w, rect.h);
  ctx.clip();
  const virtualW = rect.w > 500 ? 3840 : 1920;
  const virtualH = 1120;
  ctx.scale(rect.w / virtualW, rect.h / virtualH);
  fn();
  ctx.restore();
}

// -------------------------------------------------------------
// 16 CARD RENDERERS (Card 0 to Card 15)
// -------------------------------------------------------------

/**
 * CARD 0: Boot & Creation (0.0s - 16.0s)
 */
export function renderCard0(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // Corner crop marks
    drawCropMarks(ctx, 40, 40, 1840, 1040, 24);

    // Meta header
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('§01 · intro · bars 1-8 · 0.000 s', 60, 48);
    ctx.fillText('new World(5);', 60, 72);

    // 1. Top Ruler (y ≈ 120)
    const rulerY = 120;
    drawRuler(ctx, 80, rulerY, 1720, 25, ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8 s']);

    // Crayon / pencil icon at right end
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(1740, rulerY - 30, 20, 40);
    ctx.beginPath();
    ctx.moveTo(1740, rulerY + 10);
    ctx.lineTo(1760, rulerY + 10);
    ctx.lineTo(1750, rulerY + 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pink;
    ctx.beginPath();
    ctx.arc(1775, rulerY + 25, 6, 0, Math.PI * 2);
    ctx.fill();

    // Text across the ruler
    ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.textAlign = 'left';
    ctx.fillText('Switch on the power line  Remember to put on', 100, rulerY - 14);

    // 2. Giant PROTECTION Header (y ≈ 260)
    ctx.fillStyle = COLORS.ink;
    ctx.font = '900 132px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('PROTECTION', 80, 260);
    ctx.letterSpacing = '0px';

    // 3. Left Section: OBJECT CREATION
    const leftX = 80;
    ctx.font = '900 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('OBJECT CREATION', leftX, 340);

    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText('Lay down your pieces¹', leftX, 395);
    ctx.fillText("And let's begin", leftX, 445);

    // Two Houses
    const houseBaseY = 880;
    // Pink solid house
    drawHouse(ctx, 330, houseBaseY - 210, 270, 400, true, pink, 11);
    // Blue outline house
    drawHouse(ctx, 670, houseBaseY - 210, 270, 400, false, blue, 12);

    // Technical annotations on houses
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    // Pink house dashed bounding box & center axis
    ctx.strokeRect(195, houseBaseY - 410, 270, 400);
    ctx.beginPath();
    ctx.moveTo(330, houseBaseY - 430); ctx.lineTo(330, houseBaseY);
    ctx.stroke();
    // Blue house dashed bounding box & center axis
    ctx.strokeRect(535, houseBaseY - 410, 270, 400);
    ctx.beginPath();
    ctx.moveTo(670, houseBaseY - 430); ctx.lineTo(670, houseBaseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dimension labels
    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('h 300', 130, houseBaseY - 200);
    ctx.fillText('0.70 h', 830, houseBaseY - 200);
    ctx.fillText('98.8°', 735, houseBaseY - 370);
    ctx.fillText('new Lovable("Me", ...)', 210, houseBaseY + 45);
    ctx.fillText('new Lovable("You", ...)', 580, houseBaseY + 45);

    // Footnote
    ctx.font = 'italic 28px "Georgia", serif';
    ctx.fillText('¹ 捨て駒  sutegoma, a piece given up', leftX, 1020);

    // 4. Right Section: INITIALIZATION & Table 1.1
    const rightX = 960;
    ctx.font = '900 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('INITIALIZATION', rightX, 340);

    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText('Fill in my data parameters', rightX, 395);

    ctx.font = '24px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('arguments of new Lovable(...)', rightX, 440);
    ctx.fillText('Table 1.1', 1740, 390);

    // Table 1.1
    const tableY = 480;
    const tableW = 860;
    // Dotted header band
    ctx.fillStyle = 'rgba(24, 23, 25, 0.08)';
    ctx.fillRect(rightX, tableY, tableW, 60);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(rightX, tableY, tableW, 60);

    // Header columns
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('#0 String', rightX + 30, tableY + 40);
    ctx.fillText('#1 int', rightX + 220, tableY + 40);
    ctx.fillText('#2 boolean', rightX + 360, tableY + 40);
    ctx.fillText('#3 int', rightX + 570, tableY + 40);
    ctx.fillText('#4 boolean', rightX + 680, tableY + 40);

    // Row 1: "Me"
    const row1Y = tableY + 120;
    drawHouse(ctx, rightX + 45, row1Y - 14, 28, 38, true, pink, 13);
    ctx.font = '32px "Courier New", monospace';
    ctx.fillText('"Me"', rightX + 80, row1Y);
    ctx.fillText('0', rightX + 250, row1Y);
    ctx.fillText('true', rightX + 410, row1Y);
    ctx.fillText('-1', rightX + 590, row1Y);
    ctx.fillText('false', rightX + 710, row1Y);

    // Highlight oval for Me's true
    ctx.strokeStyle = pink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(rightX + 445, row1Y - 10, 68, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Row 2: "You"
    const row2Y = tableY + 190;
    drawHouse(ctx, rightX + 45, row2Y - 14, 28, 38, false, blue, 14);
    ctx.fillText('"You"', rightX + 80, row2Y);
    ctx.fillText('0', rightX + 250, row2Y);
    ctx.fillText('false', rightX + 405, row2Y);
    ctx.fillText('-1', rightX + 590, row2Y);
    ctx.fillText('false', rightX + 710, row2Y);

    // Highlight oval for You's false
    ctx.strokeStyle = blue;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(rightX + 445, row2Y - 10, 78, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Table divider line
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightX, row2Y + 40); ctx.lineTo(rightX + tableW, row2Y + 40);
    ctx.stroke();

    // Row 3: me ^ you
    const row3Y = row2Y + 85;
    ctx.font = '24px "Courier New", monospace';
    ctx.fillText('me ^ you', rightX + 30, row3Y);
    ctx.fillText('0', rightX + 250, row3Y);
    ctx.fillText('1', rightX + 445, row3Y);
    ctx.fillText('0', rightX + 590, row3Y);
    ctx.fillText('0', rightX + 740, row3Y);

    // Delta = 1 bit
    ctx.font = 'bold 36px "Times New Roman", serif';
    ctx.fillText('Δ = 1 bit', rightX + 390, row3Y + 65);

    // 5. "Set up our new world"
    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText('Set up our new world', rightX + 40, 1020);

    // 6. Color Bars at bottom right
    const cbX = 1580, cbY = 1040, cbW = 50, cbH = 12;
    const swatch = [COLORS.ink, pink, blue, COLORS.purple];
    swatch.forEach((c, idx) => {
      ctx.fillStyle = c;
      ctx.fillRect(cbX + idx * (cbW + 6), cbY, cbW, cbH);
    });
  });
}

/**
 * CARD 1: GodDrinksJava Ballistics (16.0s - 29.5s)
 */
export function renderCard1(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // Diagonal striped border tape
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 1920 + 1120; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i - 40, 40);
      ctx.moveTo(i, 1120); ctx.lineTo(i - 40, 1080);
      ctx.stroke();
    }

    // Code header
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("package goddrinksjava;", 120, 110);
    ctx.textAlign = 'right';
    ctx.fillText("GodDrinksJava.java", 1800, 110);
    ctx.textAlign = 'left';

    // Massive Title
    ctx.font = '900 170px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("GodDrinksJava", 120, 290);

    // Thick underline bar
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(120, 330, 1680, 10);

    // Explanation text
    ctx.font = 'bold 44px -apple-system, Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("The program GodDrinksJava implements an", 120, 410);
    ctx.fillText("application that creates an empty simulated", 120, 465);
    ctx.fillText("world with no meaning or purpose.", 120, 520);

    // Gravity arrow on right
    ctx.font = 'italic 42px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("g", 1740, 410);
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(1750, 430); ctx.lineTo(1750, 510);
    ctx.lineTo(1740, 495); ctx.moveTo(1750, 510); ctx.lineTo(1760, 495);
    ctx.stroke();

    // Baseline ruler
    const groundY = 960;
    drawRuler(ctx, 120, groundY, 1800, 13, ['0.0', '0.46', '0.69', '1.15', '2.30', '3.69', '4.61']);

    // Dynamic Ballistic Trajectories locked to 145.5 BPM beat grid
    const beat = getMusicBeat(t);
    const jumpCycle1 = Math.max(0, beat) % 2.0;
    const bounce1 = Math.sin(jumpCycle1 * Math.PI) * 160;
    const posX1 = 580 + Math.sin(beat * (Math.PI / 4)) * 260;

    const jumpCycle2 = (Math.max(0, beat) + 1.0) % 4.0;
    const bounce2 = jumpCycle2 < 2.0 ? Math.sin(jumpCycle2 * 0.5 * Math.PI) * 180 : 0;
    const posX2 = 1240 + Math.cos(beat * (Math.PI / 4)) * 220;

    // Dotted trajectory arcs
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = pink;
    ctx.beginPath();
    for (let px = 200; px < 1100; px += 10) {
      const py = groundY - Math.abs(Math.sin((px - 200) * 0.012)) * 160;
      if (px === 200) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = blue;
    ctx.beginPath();
    for (let px = 900; px < 1750; px += 10) {
      const py = groundY - Math.abs(Math.cos((px - 900) * 0.011)) * 180;
      if (px === 900) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Collision sparks
    if (Math.abs(posX1 - posX2) < 140) {
      const sparkX = (posX1 + posX2) / 2;
      const sparkY = groundY - 200;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(sparkX, sparkY);
        ctx.lineTo(sparkX + Math.cos(a) * 35, sparkY + Math.sin(a) * 35);
        ctx.stroke();
      }
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("2.769", sparkX - 35, sparkY - 45);
    }

    // Draw houses with impact squash & stretch
    const squash1 = bounce1 < 12 ? Math.max(0.78, 1.0 - (12 - bounce1) * 0.02) : 1.0;
    const stretch1 = 1.0 / squash1;
    ctx.save();
    ctx.translate(posX1, groundY - bounce1 - 70);
    ctx.scale(stretch1, squash1);
    drawHouse(ctx, 0, 0, 120, 150, true, pink, 21);
    ctx.restore();

    const squash2 = bounce2 < 12 ? Math.max(0.80, 1.0 - (12 - bounce2) * 0.018) : 1.0;
    const stretch2 = 1.0 / squash2;
    ctx.save();
    ctx.translate(posX2, groundY - bounce2 - 70);
    ctx.scale(stretch2, squash2);
    drawHouse(ctx, 0, 0, 120, 150, false, blue, 22);
    ctx.restore();

    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Fig. 0   world.startSimulation();", 120, groundY - 20);
  });
}

/**
 * CARD 2: Mathematical Geometry (29.5s - 44.4s)
 */
export function renderCard2(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // Cross division lines
    ctx.strokeStyle = COLORS.faint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(960, 40); ctx.lineTo(960, 1080);
    ctx.moveTo(60, 560); ctx.lineTo(1860, 560);
    ctx.stroke();

    // Dotted graph grid for all 4 quadrants
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let gx = 100; gx < 1820; gx += 45) {
      for (let gy = 120; gy < 1080; gy += 45) {
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // Top rule
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 80); ctx.lineTo(1840, 80);
    ctx.stroke();

    // =============================================================
    // Q1: DIMENSION (top-left: 0..960, 0..560)
    // =============================================================
    ctx.font = 'bold 32px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("30   CHAPTER 3.  INSTANCES", 80, 60);

    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillText("3.1  me instanceof PointSet¹", 80, 130);
    ctx.font = 'italic 26px "Times New Roman", serif';
    ctx.fillText("ℝ²", 80, 175);

    // Bold DIMENSION Title
    ctx.font = '900 84px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("DIMENSION", 240, 185);

    // Dashed house envelope for points
    const pCenterHouseX = 420;
    const pCenterHouseY = 320;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.4)';
    ctx.lineWidth = 2;
    drawHouse(ctx, pCenterHouseX, pCenterHouseY, 150, 190, false, 'rgba(24, 23, 25, 0.4)', 1);
    ctx.setLineDash([]);

    // Pink point set forming house silhouette
    ctx.fillStyle = pink;
    for (let i = 0; i < 48; i++) {
      const rx = (pseudoRand(i * 13) - 0.5) * 120;
      const ry = (pseudoRand(i * 13 + 1) - 0.5) * 140;
      ctx.beginPath();
      ctx.arc(pCenterHouseX + rx, pCenterHouseY + ry, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diagonal cut slice
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(pCenterHouseX - 140, pCenterHouseY + 110);
    ctx.lineTo(pCenterHouseX + 130, pCenterHouseY - 100);
    ctx.stroke();

    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("me.resetDimensions()", pCenterHouseX + 10, pCenterHouseY - 110);
    ctx.fillText("dim(Me) = 2 -> 0", pCenterHouseX - 60, pCenterHouseY + 130);

    // Blue house on right receiving dimensions
    const bHouseX = 760;
    const bHouseY = 320;
    drawHouse(ctx, bHouseX, bHouseY, 150, 190, false, blue, 2);
    // Fill with blue stipple points
    ctx.fillStyle = blue;
    for (let i = 0; i < 60; i++) {
      const bx = bHouseX + (pseudoRand(i * 17) - 0.5) * 110;
      const by = bHouseY + (pseudoRand(i * 17 + 1) - 0.5) * 130;
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("dim(You) = 1 -> 2", bHouseX - 70, bHouseY + 130);
    ctx.fillText("getDimensions()", bHouseX - 60, bHouseY + 160);

    // Fig 3.1 & Lyrics
    ctx.font = '900 32px "Times New Roman", serif';
    ctx.fillText("Fig. 3.1", 80, 510);
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm a set of points", 210, 510);
    if (t >= 31.0) {
      ctx.fillText("Then I will give you my", 210, 550);
    }

    // =============================================================
    // Q2: CIRCUMFERENCE (bottom-left: 0..960, 560..1120)
    // =============================================================
    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("3.2  me instanceof Circle", 80, 595);

    // Bold CIRCUMFERENCE Title
    ctx.font = '900 84px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("CIRCUMFERENCE", 240, 695);

    // Math notes on left
    ctx.font = 'italic 22px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Unrolled, a circle", 80, 740);
    ctx.fillText("of radius r is a", 80, 770);
    ctx.fillText("segment of length", 80, 800);
    ctx.fillText("2πr.", 80, 830);
    ctx.fillText("∫_Me ds = 2πr", 80, 880);

    // Center Circle & Unrolling mechanics
    const roll = (t >= 33.4 && t < 37.0) ? (t - 33.4) / 3.6 : (t >= 37.0 ? 1.0 : 0.0);
    const circleX = 480;
    const circleY = 840;
    const circleR = 75;

    // Dashed circle
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pink center point and crosshair
    ctx.fillStyle = pink;
    ctx.beginPath();
    ctx.arc(circleX, circleY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(circleX - 15, circleY); ctx.lineTo(circleX + 15, circleY);
    ctx.moveTo(circleX, circleY - 15); ctx.lineTo(circleX, circleY + 15);
    ctx.stroke();

    // C = 2πr label
    ctx.font = 'italic 24px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("C = 2πr", circleX - 110, circleY - 30);

    // Diagonal cut slice
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(circleX - 100, circleY - 70);
    ctx.lineTo(circleX + 90, circleY + 50);
    ctx.stroke();
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText("me.resetCircumference()", circleX + 95, circleY + 55);

    // Unrolled line at bottom
    const unrollLineY = circleY + circleR + 25;
    ctx.strokeStyle = pink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(circleX - circleR, unrollLineY);
    ctx.lineTo(circleX - circleR + roll * 280, unrollLineY);
    ctx.stroke();

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(circleX - circleR, unrollLineY + 15);
    ctx.lineTo(circleX - circleR + 280, unrollLineY + 15);
    ctx.moveTo(circleX - circleR, unrollLineY + 5); ctx.lineTo(circleX - circleR, unrollLineY + 25);
    ctx.moveTo(circleX - circleR + 280, unrollLineY + 5); ctx.lineTo(circleX - circleR + 280, unrollLineY + 25);
    ctx.stroke();
    ctx.font = 'italic 20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("2πr", circleX - circleR + 120, unrollLineY + 38);

    // Blue house on right receiving circumference
    drawHouse(ctx, 830, circleY, 120, 150, false, blue, 3);

    // Fig 3.2 & Lyrics
    ctx.font = '900 32px "Times New Roman", serif';
    ctx.fillText("Fig. 3.2", 80, 1050);
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm a circle", 210, 1050);
    if (t >= 34.5) {
      ctx.fillText("Then I will give you my", 210, 1090);
    }

    // =============================================================
    // Q3: TANGENTS (top-right: 960..1920, 0..560)
    // =============================================================
    ctx.font = 'bold 30px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText("GIFTS AND RESETS   31", 1840, 60);
    ctx.textAlign = 'left';

    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillText("3.3  me instanceof SineWave²", 1020, 110);

    // Big Textured TANGENTS Title
    ctx.font = '900 78px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("TANGENTS", 1160, 185);

    // Coordinate grid and axes
    const q3X0 = 1050;
    const q3Y0 = 330; // y=0 axis
    const amp = 85;   // peak at 330 - 85 = 245 (y=1)

    // Gray asymptote lines y = ±1
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(q3X0 - 20, q3Y0 - amp); ctx.lineTo(1750, q3Y0 - amp);
    ctx.moveTo(q3X0 - 20, q3Y0 + amp); ctx.lineTo(1750, q3Y0 + amp);
    ctx.stroke();

    ctx.font = 'italic 18px "Times New Roman", serif';
    ctx.fillStyle = 'rgba(24, 23, 25, 0.6)';
    ctx.fillText("y = 1", 1760, q3Y0 - amp + 6);
    ctx.fillText("y = -1", 1760, q3Y0 + amp + 6);

    // Axes
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(q3X0, q3Y0 + amp + 25); ctx.lineTo(q3X0, q3Y0 - amp - 25);
    ctx.lineTo(q3X0 - 5, q3Y0 - amp - 15); ctx.moveTo(q3X0, q3Y0 - amp - 25); ctx.lineTo(q3X0 + 5, q3Y0 - amp - 15);
    ctx.stroke();
    // X-axis
    ctx.beginPath();
    ctx.moveTo(q3X0 - 15, q3Y0); ctx.lineTo(1740, q3Y0);
    ctx.lineTo(1730, q3Y0 - 5); ctx.moveTo(1740, q3Y0); ctx.lineTo(1730, q3Y0 + 5);
    ctx.stroke();

    ctx.font = 'italic 22px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("y", q3X0 + 12, q3Y0 - amp - 12);
    ctx.fillText("x", 1748, q3Y0 + 6);

    ctx.font = '16px "Times New Roman", serif';
    ctx.fillText("1", q3X0 - 18, q3Y0 - amp + 6);
    ctx.fillText("-1", q3X0 - 26, q3Y0 + amp + 6);

    // 4 periods of Sine Wave
    const periodW = 150;
    ctx.strokeStyle = pink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let px = 0; px <= 600; px += 4) {
      const sx = q3X0 + px;
      const sy = q3Y0 - Math.sin((px / periodW) * Math.PI * 2) * amp;
      if (px === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Tangent bars on peaks
    const peakXCoords = [
      q3X0 + periodW * 0.25,
      q3X0 + periodW * 1.25,
      q3X0 + periodW * 2.25,
      q3X0 + periodW * 3.25
    ];
    const peakLabels = ["π/2", "5π/2", "9π/2", "13π/2"];

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    peakXCoords.forEach((px, idx) => {
      // Horizontal tangent bar
      ctx.beginPath();
      ctx.moveTo(px - 32, q3Y0 - amp);
      ctx.lineTo(px + 32, q3Y0 - amp);
      ctx.stroke();

      // Tick on x-axis
      ctx.beginPath();
      ctx.moveTo(px, q3Y0 - 5); ctx.lineTo(px, q3Y0 + 5);
      ctx.stroke();
      ctx.font = '16px "Times New Roman", serif';
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'center';
      ctx.fillText(peakLabels[idx], px, q3Y0 + 26);
    });
    ctx.textAlign = 'left';

    // Blue house sitting on 4th peak (13π/2)
    const seatX = peakXCoords[3];
    const seatY = q3Y0 - amp;
    drawHouse(ctx, seatX, seatY - 50, 68, 88, false, blue, 42);

    // Dashed projection line down from 4th peak
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(seatX - 100, q3Y0 + amp + 30);
    ctx.lineTo(seatX, seatY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right tangent notes
    const noteX = 1660;
    ctx.font = '18px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("The tangent to", noteX, 220);
    ctx.fillText("y = sin x at x₀", noteX, 245);
    ctx.fillText("has slope cos x₀;", noteX, 270);
    ctx.fillText("level where cos x₀ = 0.", noteX, 295);
    ctx.fillText("x₀ = π/2 + kπ", noteX, 330);

    // Monospace formula labels under plot
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText("y' = cos x = 0  ⇒  a seat", q3X0, q3Y0 + amp + 45);
    ctx.fillText("me.getTangent(you.getXPosition())", 1320, q3Y0 + amp + 45);
    ctx.fillText("y = sin x", 1680, q3Y0 + amp + 45);

    // Fig. 3.3 and pink lyrics
    ctx.font = '900 32px "Times New Roman", serif';
    ctx.fillText("Fig. 3.3", q3X0, 520);
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm a sine wave", q3X0 + 130, 520);
    if (t >= 38.5) {
      ctx.fillText("Then you can sit on all my", q3X0 + 130, 560);
    }

    // =============================================================
    // Q4: SEQUENCE & LIMITATIONS (bottom-right: 960..1920, 560..1120)
    // =============================================================
    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("3.4  me instanceof Sequence", 1020, 610);

    const q4X0 = 1080;
    const q4Y0 = 890; // x-axis
    const youY = 680; // y = You asymptote

    // Blue horizontal dashed asymptote line y = You
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = blue;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(q4X0, youY);
    ctx.lineTo(1680, youY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bracket and bracket label
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1690, youY - 15); ctx.lineTo(1705, youY - 15); ctx.lineTo(1705, youY + 15); ctx.lineTo(1690, youY + 15);
    ctx.stroke();
    ctx.font = '16px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("10⁻³", 1715, youY + 6);

    // Axes
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(q4X0, q4Y0 + 20); ctx.lineTo(q4X0, youY - 35);
    ctx.lineTo(q4X0 - 5, youY - 25); ctx.moveTo(q4X0, youY - 35); ctx.lineTo(q4X0 + 5, youY - 25);
    ctx.stroke();
    // X-axis
    ctx.beginPath();
    ctx.moveTo(q4X0 - 15, q4Y0); ctx.lineTo(1730, q4Y0);
    ctx.lineTo(1720, q4Y0 - 5); ctx.moveTo(1730, q4Y0); ctx.lineTo(1720, q4Y0 + 5);
    ctx.stroke();

    ctx.font = 'italic 22px "Times New Roman", serif';
    ctx.fillText("aₙ", q4X0 - 35, youY - 18);
    ctx.fillText("You", q4X0 - 65, youY + 8);
    ctx.fillText("You - 0.01", q4X0 - 110, q4Y0 + 6);
    ctx.fillText("n → ∞", 1740, q4Y0 + 8);

    // Tick labels on x-axis
    ctx.font = '16px "Times New Roman", serif';
    ctx.fillText("10²", q4X0 + 50, q4Y0 + 26);
    ctx.fillText("10³", q4X0 + 520, q4Y0 + 26);

    // Formula
    ctx.font = 'italic 26px "Times New Roman", serif';
    ctx.fillText("aₙ = You − 1/n", q4X0 + 30, youY + 50);

    // Converging magenta points
    const seqPoints = [
      { n: 1, x: q4X0 + 50, y: q4Y0 },
      { n: 2, x: q4X0 + 130, y: q4Y0 - 100 },
      { n: 3, x: q4X0 + 210, y: q4Y0 - 145 },
      { n: 5, x: q4X0 + 290, y: q4Y0 - 170 },
      { n: 10, x: q4X0 + 370, y: q4Y0 - 188 },
      { n: 20, x: q4X0 + 460, y: q4Y0 - 198 },
      { n: 50, x: q4X0 + 540, y: q4Y0 - 204 }
    ];

    // Faint dotted connecting curve
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = pink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    seqPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Magenta dots (step on 8th notes)
    const visibleDots = t >= 40.8 ? Math.min(seqPoints.length, Math.floor((t - 40.8) / (BEAT_INTERVAL * 0.5)) + 2) : 2;
    ctx.fillStyle = pink;
    for (let i = 0; i < visibleDots; i++) {
      ctx.beginPath();
      ctx.arc(seqPoints[i].x, seqPoints[i].y, 8.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Right notes for epsilon
    const epsX = 1680;
    ctx.font = '18px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("For every ε > 0", epsX, youY - 20);
    ctx.fillText("there is an N with", epsX, youY + 5);
    ctx.fillText("|aₙ − You| < ε", epsX, youY + 30);
    ctx.fillText("for all n > N", epsX, youY + 55);

    // Lyrics
    ctx.font = '900 32px "Times New Roman", serif';
    ctx.fillText("Fig. 3.4", q4X0, 1010);
    ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I approach infinity", q4X0 + 130, 1010);
    if (t >= 42.0) {
      ctx.fillText("Then you can be my LIMITATIONS", q4X0 + 130, 1055);
    }

    // Footnote
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q4X0, 1080); ctx.lineTo(q4X0 + 120, 1080);
    ctx.stroke();
    ctx.font = 'italic 16px "Times New Roman", serif';
    ctx.fillStyle = 'rgba(24, 23, 25, 0.7)';
    ctx.fillText("² The last two branches have no reset: the sine keeps every tangent, and the sequence takes You as its limit.", q4X0, 1102);
  });
}

/**
 * CARD 3: Electricity, Vision & Time (44.4s - 58.0s)
 */
export function renderCard3(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // =============================================================
    // QUADRANT 1 (Top-Left: Oscilloscope & SPDT Switch)
    // =============================================================
    let q1Lyrics = "Switch";
    if (t >= 44.4) q1Lyrics = "Switch my";
    if (t >= 45.0) q1Lyrics = "Switch my current";
    if (t >= 45.6) q1Lyrics = "Switch my current To AC";
    if (t >= 46.2) q1Lyrics = "Switch my current To AC to DC";

    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText(q1Lyrics, 50, 100);

    // Oscilloscope Box
    const oscX = 50, oscY = 140, oscW = 620, oscH = 240;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(oscX, oscY, oscW, oscH);

    // Grid inside oscilloscope
    ctx.save();
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let c = 1; c < 7; c++) {
      const gx = oscX + (oscW / 7) * c;
      ctx.beginPath(); ctx.moveTo(gx, oscY); ctx.lineTo(gx, oscY + oscH); ctx.stroke();
    }
    for (let r = 1; r < 5; r++) {
      const gy = oscY + (oscH / 5) * r;
      ctx.beginPath(); ctx.moveTo(oscX, gy); ctx.lineTo(oscX + oscW, gy); ctx.stroke();
    }
    // Solid Center horizontal line
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.45)';
    ctx.beginPath(); ctx.moveTo(oscX, oscY + oscH / 2); ctx.lineTo(oscX + oscW, oscY + oscH / 2); ctx.stroke();
    ctx.restore();

    // Top Triangle pointer
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(350, 126); ctx.lineTo(365, 140); ctx.lineTo(335, 140);
    ctx.fill();

    // Bottom division ticks & labels
    const divLabels = ['25.1', '25.2', '25.3', '25.4', '26.1', '26.2', '26.3'];
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    for (let c = 0; c < 7; c++) {
      const lx = oscX + (oscW / 7) * c + 10;
      ctx.fillText(divLabels[c], lx, oscY + oscH + 20);
    }
    ctx.fillText("Fig. 4.1    I(t) · 1 div = 1 beat", oscX, oscY + oscH + 46);

    // AC to DC waveform inside oscilloscope
    const isDC = t >= 46.2;
    ctx.strokeStyle = pink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    const waveProgress = Math.min(1.0, Math.max(0.0, (t - 44.0) / 2.2));
    const maxWavePx = 60 + waveProgress * 540;
    for (let px = 60; px <= maxWavePx; px += 4) {
      let py;
      if (isDC && px > 460) {
        py = oscY + oscH / 2;
      } else {
        const waveTravel = (t - 44.0) * (Math.PI * 4 / BEAT_INTERVAL);
        py = oscY + oscH / 2 + Math.sin((px - 60) * 0.05 - waveTravel) * 65;
      }
      if (px === 60) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Leading tip dot
    ctx.fillStyle = pink;
    ctx.beginPath();
    const waveTravelTip = (t - 44.0) * (Math.PI * 4 / BEAT_INTERVAL);
    const tipY = (isDC && maxWavePx > 460) ? oscY + oscH / 2 : oscY + oscH / 2 + Math.sin((maxWavePx - 60) * 0.05 - waveTravelTip) * 65;
    ctx.arc(maxWavePx, tipY, 7, 0, Math.PI * 2);
    ctx.fill();

    // SPDT Switch Circuit on Right
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(oscX + oscW, oscY + oscH / 2);
    ctx.lineTo(730, oscY + oscH / 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(730, oscY + oscH / 2, 5, 0, Math.PI * 2); ctx.fill();

    const switchAngle = isDC ? 0.45 : -0.45;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(730, oscY + oscH / 2);
    ctx.lineTo(730 + Math.cos(switchAngle) * 55, oscY + oscH / 2 + Math.sin(switchAngle) * 55);
    ctx.stroke();

    // AC terminal
    const acTermX = 795, acTermY = 215;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(acTermX, acTermY, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(acTermX + 5, acTermY); ctx.lineTo(835, acTermY); ctx.stroke();
    ctx.beginPath(); ctx.arc(855, acTermY, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(845, acTermY);
    ctx.bezierCurveTo(850, acTermY - 8, 852, acTermY - 8, 855, acTermY);
    ctx.bezierCurveTo(858, acTermY + 8, 860, acTermY + 8, 865, acTermY);
    ctx.stroke();
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText("f = 130/60 Hz", 815, 185);

    // DC terminal
    const dcTermX = 795, dcTermY = 305;
    ctx.beginPath(); ctx.arc(dcTermX, dcTermY, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dcTermX + 5, dcTermY); ctx.lineTo(845, dcTermY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(845, dcTermY - 16); ctx.lineTo(845, dcTermY + 16); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(855, dcTermY - 10); ctx.lineTo(855, dcTermY + 10); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.fillText("+  -", 840, dcTermY - 22);

    ctx.beginPath();
    ctx.moveTo(873, acTermY); ctx.lineTo(895, acTermY); ctx.lineTo(895, dcTermY); ctx.lineTo(860, dcTermY);
    ctx.stroke();
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText("me.toggleCurrent()", 700, 360);

    // =============================================================
    // QUADRANT 2 (Top-Right: Blind My Vision & Target Reticle)
    // =============================================================
    let q2Lyrics = "And then blind";
    if (t >= 49.0) q2Lyrics = "And then blind my";
    if (t >= 49.8) q2Lyrics = "And then blind my vision";

    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.textAlign = 'center';
    ctx.fillText(q2Lyrics, 1440, 100);
    ctx.textAlign = 'left';

    const cx = 1440, cy = 280;
    // Black star strip
    ctx.fillStyle = '#111214';
    ctx.fillRect(cx - 300, cy - 70, 600, 140);
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 45; s++) {
      const sx = cx - 290 + pseudoRand(s * 7) * 580;
      const sy = cy - 65 + pseudoRand(s * 7 + 1) * 130;
      const sr = 1 + pseudoRand(s * 7 + 2) * 2;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Crosshair axis
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 120); ctx.lineTo(cx, cy + 120);
    ctx.moveTo(cx - 200, cy); ctx.lineTo(cx + 200, cy);
    ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
      ctx.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
      ctx.stroke();
    }

    const pupilExpand = (t >= 48.0 && t < 51.5) ? ((t - 48.0) / 3.5) : (t >= 51.5 ? 1.0 : 0.0);
    ctx.strokeStyle = pink;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 55 + pupilExpand * 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#3a082c';
    ctx.beginPath();
    ctx.arc(cx, cy, 28 + pupilExpand * 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("reg. P", cx + 120, cy - 80);
    ctx.fillStyle = pink;
    ctx.fillText("me", cx + 120, cy - 60);
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Fig. 4.2  me.blindVision(true)", cx - 140, cy + 160);

    // =============================================================
    // QUADRANT 4 (Bottom-Right: 2016 AD Cart & Dizzy Spinning Houses)
    // =============================================================
    if (t >= 51.5) {
      ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("So dizzy so dizzy", 1080, 640);
      ctx.font = '18px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('me.addFeeling("dizzy")', 1260, 690);

      const q4RulerY = 920;
      drawRuler(ctx, 1000, q4RulerY, 860, 16, ['1 BC | AD 1', 'AD 1000', 'AD 2016']);

      const cX = 1460, cY = q4RulerY - 60;
      ctx.strokeStyle = COLORS.ink;
      ctx.fillStyle = COLORS.paper;
      ctx.lineWidth = 4;
      ctx.strokeRect(cX, cY, 320, 60);
      ctx.fillRect(cX, cY, 320, 60);

      const digits = ['2', '0', '1', '6', 'AD'];
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      for (let d = 0; d < digits.length; d++) {
        const dx = cX + d * 64;
        ctx.strokeRect(dx, cY, 64, 60);
        ctx.fillText(digits[d], dx + (d === 4 ? 12 : 22), cY + 44);
      }
      ctx.beginPath(); ctx.arc(cX + 24, cY + 68, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cX + 296, cY + 68, 8, 0, Math.PI * 2); ctx.stroke();

      const rotSpin = (t >= 51.5 && t < 55.0) ? (t - 51.5) * (Math.PI * 2 / BEAT_INTERVAL) : 0;
      ctx.save();
      ctx.translate(cX + 80, cY - 80);
      ctx.rotate(rotSpin);
      drawHouse(ctx, 0, 0, 70, 95, true, pink, 51);
      ctx.restore();

      ctx.save();
      ctx.translate(cX + 220, cY - 80);
      ctx.rotate(-rotSpin);
      drawHouse(ctx, 0, 0, 70, 95, false, blue, 52);
      ctx.restore();

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.ink;
      ctx.beginPath(); ctx.arc(cX + 80, cY - 80, 75, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cX + 220, cY - 80, 75, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText("360°", cX + 70, cY - 165);
      ctx.fillText("360°", cX + 210, cY - 165);

      ctx.font = '16px "Courier New", monospace';
      ctx.fillText("Fig. 4.3   a · 1 div = 100 a", 1460, q4RulerY + 65);
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("Oh we", 1460, 1060);
    }

    // =============================================================
    // QUADRANT 3 (Bottom-Left: 3691 BC Cart & Unite)
    // =============================================================
    if (t >= 55.0) {
      const q3RulerY = 920;
      drawRuler(ctx, 60, q3RulerY, 860, 16, ['4000 BC', '3691 BC', '3000 BC', '2000 BC', '1000 BC']);

      const bcX = 120, bcY = q3RulerY - 60;
      ctx.strokeStyle = COLORS.ink;
      ctx.fillStyle = COLORS.paper;
      ctx.lineWidth = 4;
      ctx.strokeRect(bcX, bcY, 320, 60);
      ctx.fillRect(bcX, bcY, 320, 60);
      const bcDigits = ['3', '6', '9', '1', 'BC'];
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      for (let d = 0; d < bcDigits.length; d++) {
        const dx = bcX + d * 64;
        ctx.strokeRect(dx, bcY, 64, 60);
        ctx.fillText(bcDigits[d], dx + (d === 4 ? 12 : 22), bcY + 44);
      }
      ctx.beginPath(); ctx.arc(bcX + 24, bcY + 68, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(bcX + 296, bcY + 68, 8, 0, Math.PI * 2); ctx.stroke();

      const uniteProgress = Math.min(1.0, (t - 55.0) / 2.5);
      const pinkX = bcX + 80 + uniteProgress * 45;
      const blueX = bcX + 220 - uniteProgress * 45;

      drawHouse(ctx, pinkX, bcY - 80, 75, 100, true, pink, 53);
      drawHouse(ctx, blueX, bcY - 80, 75, 100, false, blue, 54);

      if (uniteProgress > 0.6) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = COLORS.purple;
        drawHouse(ctx, (pinkX + blueX) / 2, bcY - 80, 50, 90, true, COLORS.purple, 55);
        ctx.restore();
      }

      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((pinkX + blueX) / 2, bcY - 140);
      ctx.lineTo(460, 600);
      ctx.stroke();
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("Fig. 4.4   world.unite(me, you)", 470, 595);

      ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("And we can unite", 470, 660);
      ctx.fillText("So deeply so deeply", 470, 730);

      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillText("to B.C", 200, 1060);
    }
  });
}

/**
 * CARD 4: Stimulations & Satisfaction (58.0s - 74.0s)
 */
export function renderCard4(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // =============================================================
    // Q1: GAUGES & STIMULATIONS (Top-Left: 0..960, 0..560)
    // =============================================================
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I can", 80, 120);
    ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("give you all the", 80, 185);

    // Legend
    ctx.fillStyle = pink;
    ctx.fillRect(80, 270, 32, 32);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("me.getNumStimulationsAvailable()", 125, 294);

    ctx.strokeStyle = blue;
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 325, 32, 32);
    ctx.save();
    ctx.beginPath(); ctx.rect(80, 325, 32, 32); ctx.clip();
    ctx.strokeStyle = blue; ctx.lineWidth = 3;
    for (let i = -20; i < 60; i += 8) {
      ctx.beginPath(); ctx.moveTo(80 + i, 325); ctx.lineTo(80 + i + 32, 357); ctx.stroke();
    }
    ctx.restore();
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("you.getNumStimulationsNeeded()", 125, 349);

    // Vertical gauges in Q1 (x=620 and x=760)
    const gX1 = 620, gX2 = 760;
    const gY = 80, gW = 85, gH = 340;

    const fill1 = Math.min(1.0, 0.30 + 0.18 * getRhythmicImpulse(t, 5.0));
    const fill2 = Math.min(1.0, 0.58 + 0.20 * getSubBeatImpulse(t, 6.0));

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(gX1, gY, gW, gH);
    ctx.strokeRect(gX2, gY, gW, gH);

    // Numbers above gauges
    ctx.font = '900 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.fillText("04", gX1 + gW / 2, gY - 14);
    ctx.fillText("07", gX2 + gW / 2, gY - 14);
    ctx.textAlign = 'left';

    // Scale on left
    for (let s = 0; s <= 10; s++) {
      const sy = gY + gH * (1 - s / 10);
      ctx.beginPath(); ctx.moveTo(gX1 - 8, sy); ctx.lineTo(gX1, sy); ctx.stroke();
      if (s === 0 || s === 5 || s === 10) {
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText(String(s), gX1 - 32, sy + 6);
      }
    }

    // Dashed line across at level 7
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gX1 - 10, gY + gH * 0.3); ctx.lineTo(gX2 + gW + 15, gY + gH * 0.3); ctx.stroke();
    ctx.setLineDash([]);

    // Fill Gauge 1: pink dots
    ctx.fillStyle = pink;
    ctx.fillRect(gX1, gY + gH * (1 - fill1), gW, gH * fill1);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let d = 0; d < 20; d++) {
      const px = gX1 + 10 + pseudoRand(d * 7) * (gW - 20);
      const py = gY + gH * (1 - fill1) + 10 + pseudoRand(d * 7 + 1) * (gH * fill1 - 20);
      ctx.fillRect(px, py, 3, 3);
    }

    // Fill Gauge 2: blue diagonal stripes
    ctx.save();
    ctx.beginPath(); ctx.rect(gX2, gY + gH * (1 - fill2), gW, gH * fill2); ctx.clip();
    ctx.strokeStyle = blue; ctx.lineWidth = 6;
    for (let i = -100; i < 500; i += 16) {
      ctx.beginPath(); ctx.moveTo(gX2, gY + i); ctx.lineTo(gX2 + gW, gY + i + gW); ctx.stroke();
    }
    ctx.restore();

    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Fig. 5.1", gX2 + 10, gY + gH + 32);

    // Big STIMULATIONS Title
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillText("STIMULATIONS", 80, 480);

    // =============================================================
    // Q2: HOURGLASS & SATISFACTION (Top-Right: 960..1920, 0..560)
    // =============================================================
    ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("Then I can", 1040, 120);
    ctx.fillText("be your only", 1040, 185);

    // Hourglass Center: Two Houses Vertex-to-Vertex
    const hgX = 1620;
    const hgCenterY = 270;
    const hgW = 150;
    const hgH = 160;

    // Pouring sand progress: fills lower house over 61s..71s
    const pourProgress = Math.min(1.0, Math.max(0.0, (t - 61.0) / 9.0));

    // Upper Inverted Pink House: Roof pointing DOWN
    ctx.save();
    ctx.translate(hgX, hgCenterY - hgH / 2);
    ctx.rotate(Math.PI);
    drawHouse(ctx, 0, 0, hgW, hgH, false, pink, 81);
    // Sand inside upper house (draining)
    if (pourProgress < 0.95) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-hgW / 2, -hgH / 2 + hgH * pourProgress, hgW, hgH * (1 - pourProgress));
      ctx.clip();
      drawHouse(ctx, 0, 0, hgW * 0.9, hgH * 0.9, true, pink, 82);
      ctx.restore();
    }
    ctx.restore();

    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText("me.toSatisfaction()", hgX - hgW / 2 - 20, hgCenterY - hgH + 30);

    // Pouring stream
    if (pourProgress > 0.05 && pourProgress < 0.98) {
      ctx.strokeStyle = pink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(hgX, hgCenterY - 5);
      ctx.lineTo(hgX, hgCenterY + hgH * (1 - pourProgress * 0.6));
      ctx.stroke();
    }

    // Lower Upright Blue House: Roof pointing UP
    ctx.save();
    ctx.translate(hgX, hgCenterY + hgH / 2);
    drawHouse(ctx, 0, 0, hgW, hgH, false, blue, 83);
    // Sand inside lower house (filling with purple)
    if (pourProgress > 0.02) {
      ctx.save();
      ctx.beginPath();
      const fillHeight = hgH * pourProgress;
      ctx.rect(-hgW / 2, hgH / 2 - fillHeight, hgW, fillHeight);
      ctx.clip();
      drawHouse(ctx, 0, 0, hgW * 0.9, hgH * 0.9, true, COLORS.purple, 84);
      ctx.restore();
    }
    ctx.restore();

    ctx.fillText("you.setSatisfaction(...)", hgX - hgW / 2 - 20, hgCenterY + hgH - 20);
    ctx.textAlign = 'left';

    // Scale on right of hourglass
    const scaleX = hgX + hgW / 2 + 35;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, hgCenterY - 40); ctx.lineTo(scaleX, hgCenterY + hgH);
    ctx.moveTo(scaleX, hgCenterY - 40); ctx.lineTo(scaleX + 12, hgCenterY - 40);
    ctx.moveTo(scaleX, hgCenterY + hgH * 0.4); ctx.lineTo(scaleX + 8, hgCenterY + hgH * 0.4);
    ctx.moveTo(scaleX, hgCenterY + hgH); ctx.lineTo(scaleX + 12, hgCenterY + hgH);
    ctx.stroke();

    ctx.font = '16px "Times New Roman", serif';
    ctx.fillText("1", scaleX + 18, hgCenterY - 35);
    ctx.fillText("½", scaleX + 14, hgCenterY + hgH * 0.4 + 5);
    ctx.fillText("0", scaleX + 18, hgCenterY + hgH + 5);

    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText("Fig. 5.2", scaleX + 10, hgCenterY + hgH + 35);

    // Big SATISFACTION Title
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("SATISFACTION", 1040, 480);

    // =============================================================
    // Q3: CHECKBOX & FEELING (Bottom-Left: 0..960, 560..1120)
    // =============================================================
    // Checkbox
    const cbX = 80, cbY = 600;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(cbX, cbY, 55, 55);

    if (t >= 67.0) {
      ctx.font = '900 52px -apple-system, Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("✓", cbX + 8, cbY + 46);
    }

    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('you.getFeelingIndex("happy")', cbX + 80, cbY + 38);

    ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I can", 80, 720);
    ctx.fillText("make you happy", 80, 790);

    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('EXECUTION : SIMULATION', 80, 870);

    // =============================================================
    // Q4: TRAPPED & SIMULATION (Bottom-Right: 960..1920, 560..1120)
    // =============================================================
    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("Though we are trapped", 1040, 680);
    ctx.fillText("In this strange strange", 1040, 750);

    // Giant SIMULATION Banner across bottom
    ctx.font = '900 110px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("SIMULATION", 1040, 920);
  });
}

/**
 * CARD 5: Biological Assays (74.0s - 88.5s)
 * Q1: Eggplant & Nutrition Facts
 * Q2: Tomato & Lycopene Assay
 * Q3: Tabby Cat & Purr Waveform
 * Q4: God & Existence Proof
 */
export function renderCard5(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // Subtle quadrant divider lines
    ctx.strokeStyle = COLORS.faint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(960, 30); ctx.lineTo(960, 1090);
    ctx.moveTo(30, 560); ctx.lineTo(1890, 560);
    ctx.stroke();

    // =========================================================
    // Q1: EGGPLANT (Top-Left: 0..960, 0..560)
    // =========================================================
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm an", 80, 80);
    ctx.fillText("eggplant", 80, 135);
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("Then I will", 80, 195);
    ctx.fillText("give you my", 80, 240);

    // Eggplant illustration
    const egX = 180;
    const egY = 320;
    // Calyx / stem
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(egX, egY - 90);
    ctx.quadraticCurveTo(egX - 15, egY - 120, egX + 5, egY - 140);
    ctx.stroke();
    // Calyx leaves
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath();
    ctx.moveTo(egX - 45, egY - 75);
    ctx.lineTo(egX, egY - 95);
    ctx.lineTo(egX + 45, egY - 75);
    ctx.lineTo(egX + 15, egY - 50);
    ctx.lineTo(egX, egY - 40);
    ctx.lineTo(egX - 15, egY - 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Calyx hatch lines
    for (let h = -35; h <= 35; h += 8) {
      ctx.beginPath();
      ctx.moveTo(egX + h * 0.7, egY - 85);
      ctx.lineTo(egX + h, egY - 55);
      ctx.stroke();
    }

    // Halftoned Eggplant Body
    ctx.fillStyle = pink;
    for (let r = 0; r < 80; r += 9) {
      const count = Math.floor(r * 2.2) + 1;
      for (let c = 0; c < count; c++) {
        const a = (c / count) * Math.PI * 2;
        const px = egX + Math.cos(a) * (r * 0.65);
        const py = egY + Math.sin(a) * r + (r > 30 ? (r - 30) * 0.7 : 0);
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Outer outline
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(egX, egY + 15, 55, 75, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'italic 20px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Solanum melongena L.", 80, 440);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText("me instanceof Eggplant", 80, 465);

    // Standard FDA Nutrition Facts Table (Thing me)
    const nfX = 350;
    const nfY = 40;
    const nfW = 270;
    const nfH = 430;

    // Pink house icon + Thing me
    drawHouse(ctx, nfX + 10, nfY - 14, 14, 18, true, pink, 71);
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Thing me", nfX + 24, nfY - 10);

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(nfX, nfY, nfW, nfH);

    ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("Nutrition Facts", nfX + 10, nfY + 36);
    ctx.font = '13px -apple-system, Arial, sans-serif';
    ctx.fillText("1 serving per container", nfX + 10, nfY + 56);
    ctx.font = 'bold 13px -apple-system, Arial, sans-serif';
    ctx.fillText("Serving size        1 eggplant (548g)", nfX + 10, nfY + 74);

    // Thick rule
    ctx.fillRect(nfX + 8, nfY + 80, nfW - 16, 7);

    ctx.font = 'bold 12px -apple-system, Arial, sans-serif';
    ctx.fillText("Amount per serving", nfX + 10, nfY + 102);
    ctx.font = '900 30px -apple-system, Arial, sans-serif';
    ctx.fillText("Calories", nfX + 10, nfY + 134);
    ctx.textAlign = 'right';
    ctx.fillText("135", nfX + nfW - 14, nfY + 134);
    ctx.textAlign = 'left';

    // Medium rule
    ctx.fillRect(nfX + 8, nfY + 140, nfW - 16, 4);

    ctx.font = 'bold 12px -apple-system, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText("% Daily Value*", nfX + nfW - 10, nfY + 156);
    ctx.textAlign = 'left';

    const nfRows = [
      { name: "Total Fat 1g", pct: "1%" },
      { name: "  Saturated Fat 0g", pct: "0%" },
      { name: "Cholesterol 0mg", pct: "0%" },
      { name: "Sodium 10mg", pct: "0%" },
      { name: "Total Carbohydrate 32g", pct: "12%" },
      { name: "  Dietary Fiber 16g", pct: "57%" },
      { name: "  Total Sugars 19g", pct: "" },
      { name: "Protein 5g", pct: "" },
      { name: "Calcium 50mg", pct: "4%" },
      { name: "Iron 1.3mg", pct: "7%" },
      { name: "Potassium 1260mg", pct: "27%" }
    ];

    nfRows.forEach((r, idx) => {
      const ry = nfY + 172 + idx * 19;
      ctx.beginPath();
      ctx.strokeStyle = COLORS.faint;
      ctx.lineWidth = 1;
      ctx.moveTo(nfX + 8, ry - 14);
      ctx.lineTo(nfX + nfW - 8, ry - 14);
      ctx.stroke();

      ctx.font = r.name.startsWith("  ") ? '12px -apple-system, Arial, sans-serif' : 'bold 12px -apple-system, Arial, sans-serif';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(r.name, nfX + 10, ry - 2);

      if (r.pct) {
        ctx.fillStyle = pink;
        ctx.font = 'bold 12px -apple-system, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(r.pct, nfX + nfW - 10, ry - 2);
        ctx.textAlign = 'left';
      }
    });

    // If t >= 87.5: show adjacent Thing you in blue
    if (t >= 87.5) {
      const nf2X = 640;
      drawHouse(ctx, nf2X + 10, nfY - 14, 14, 18, false, blue, 72);
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = blue;
      ctx.fillText("Thing you", nf2X + 24, nfY - 10);

      ctx.strokeStyle = blue;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(nf2X, nfY, nfW * 0.9, nfH);
      ctx.fillStyle = blue;
      ctx.font = '900 28px -apple-system, Arial, sans-serif';
      ctx.fillText("Nutrition Facts", nf2X + 8, nfY + 36);
      ctx.font = 'bold 12px -apple-system, Arial, sans-serif';
      ctx.fillText("Serving size: 1 You", nf2X + 8, nfY + 68);
      ctx.fillText("Calories: —", nf2X + 8, nfY + 110);
    }

    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("NUTRIENTS", 100, 545);

    // =========================================================
    // Q2: TOMATO (Top-Right: 960..1920, 0..560)
    // =========================================================
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm a tomato", 1020, 80);
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("Then I will give you", 1020, 135);

    // Lycopene Assay Card Box
    const laX = 1020;
    const laY = 160;
    const laW = 860;
    const laH = 340;

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(laX, laY, laW, laH);

    // Black header bar
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(laX, laY, laW, 44);
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText("LYCOPENE ASSAY", laX + 20, laY + 30);
    ctx.font = '16px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText("carotenoid panel · card 1 of 1", laX + laW - 20, laY + 30);
    ctx.textAlign = 'left';

    // Sub-header row
    ctx.beginPath();
    ctx.moveTo(laX, laY + 84); ctx.lineTo(laX + laW, laY + 84);
    ctx.stroke();

    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("sample: me (Tomato)", laX + 20, laY + 68);
    ctx.fillText("method: HPLC · λ 472 nm", laX + 260, laY + 68);
    ctx.fillText("unit: mg / 100 g", laX + 540, laY + 68);
    ctx.fillText("replicates: n = 3", laX + 720, laY + 68);

    // Tomato Transverse Section (left)
    const tomX = laX + 130;
    const tomY = laY + 200;
    ctx.strokeStyle = pink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(tomX, tomY, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = pink;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      ctx.beginPath();
      ctx.arc(tomX + Math.cos(a + 0.4) * 32, tomY + Math.sin(a + 0.4) * 32, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    // Seeds
    ctx.fillStyle = '#fff';
    for (let s = 0; s < 16; s++) {
      const sa = s * 0.4;
      const sr = 24 + (s % 3) * 10;
      ctx.fillRect(tomX + Math.cos(sa) * sr, tomY + Math.sin(sa) * sr, 3, 3);
    }
    ctx.font = 'italic 15px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.fillText("Solanum lycopersicum L., transverse section", tomX, laY + 300);
    ctx.textAlign = 'left';

    // Lycopene dot column chart (middle)
    const chX = laX + 370;
    const chY = laY + 280;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chX, chY - 150); ctx.lineTo(chX, chY); ctx.lineTo(chX + 200, chY);
    ctx.stroke();

    for (let val = 0; val <= 3; val++) {
      const vy = chY - val * 45;
      ctx.beginPath();
      ctx.moveTo(chX - 6, vy); ctx.lineTo(chX, vy); ctx.stroke();
      ctx.font = '12px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(String(val), chX - 18, vy + 4);
    }

    // Dot column at me
    const meDotX = chX + 60;
    const youDotX = chX + 140;
    const isTransferred = t >= 87.5;

    ctx.fillStyle = pink;
    for (let d = 0; d < 12; d++) {
      ctx.beginPath();
      ctx.arc(meDotX, chY - 12 - d * 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dashed line at 2.57
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(chX, chY - 116); ctx.lineTo(chX + 220, chY - 116);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText("2.57", chX + 224, chY - 112);

    drawHouse(ctx, meDotX, chY + 16, 14, 18, true, pink, 73);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText("me", meDotX + 12, chY + 20);

    drawHouse(ctx, youDotX, chY + 16, 14, 18, false, blue, 74);
    ctx.fillText("you", youDotX + 12, chY + 20);

    // Result panel (right)
    const resX = laX + 630;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("RESULT", resX, laY + 115);
    ctx.fillText("mg / 100 g", resX + 120, laY + 115);

    ctx.beginPath();
    ctx.moveTo(resX, laY + 124); ctx.lineTo(resX + 200, laY + 124);
    ctx.stroke();

    ctx.fillText("me", resX, laY + 155);
    ctx.font = '900 28px -apple-system, Arial, sans-serif';
    ctx.fillStyle = isTransferred ? COLORS.ink : pink;
    ctx.fillText(isTransferred ? "not detected" : "2.57", resX + 60, laY + 158);

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("you", resX, laY + 200);
    ctx.font = '900 28px -apple-system, Arial, sans-serif';
    ctx.fillStyle = blue;
    ctx.fillText(isTransferred ? "2.57" : "—", resX + 60, laY + 203);

    // Lycopene all-trans chemical backbone
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let c = 0; c < 16; c++) {
      const cx = resX + c * 10;
      const cy = laY + 280 + (c % 2 === 0 ? 0 : 8);
      if (c === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.font = 'italic 16px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("C40H56  lycopene, all-trans", resX, laY + 315);

    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("ANTIOXIDANTS", 1020, 545);

    // =========================================================
    // Q3: TABBY CAT (Bottom-Left: 0..960, 560..1120)
    // =========================================================
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm a", 80, 640);
    ctx.fillText("tabby cat", 80, 695);
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("Then I will", 80, 755);
    ctx.fillText("purr for your", 80, 800);

    // Cat Card Box
    const catX = 330;
    const catY = 600;
    const catW = 590;
    const catH = 430;

    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(catX, catY, catW, catH);

    ctx.font = 'italic 18px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Felis catus  tabby, mackerel · frontal marking", catX + 16, catY + 32);
    ctx.font = '16px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText("me instanceof TabbyCat", catX + catW - 16, catY + 32);
    ctx.textAlign = 'left';

    ctx.beginPath();
    ctx.moveTo(catX, catY + 46); ctx.lineTo(catX + catW, catY + 46);
    ctx.stroke();

    // M forehead marking
    const mForeX = catX + 220;
    const mForeY = catY + 240;

    // Radiating fur contour lines
    ctx.strokeStyle = pink;
    ctx.lineWidth = 1.8;
    for (let l = -90; l <= 90; l += 8) {
      ctx.beginPath();
      ctx.moveTo(mForeX + l, mForeY - 140);
      ctx.quadraticCurveTo(mForeX + l * 1.2, mForeY, mForeX + l * 1.4, mForeY + 130);
      ctx.stroke();
    }

    // Bold M
    ctx.font = '900 160px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.textAlign = 'center';
    ctx.fillText("M", mForeX, mForeY + 60);
    ctx.textAlign = 'left';

    // Purr waveform (25 Hz)
    const waveY = mForeY - 10;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let px = -170; px <= 170; px += 4) {
      const wx = mForeX + px;
      const wy = waveY + Math.sin(px * 0.16 + (t - 74) * 16.0) * 32;
      if (px === -170) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Blue house icon for you
    drawHouse(ctx, catX + catW - 70, catY + 260, 70, 90, false, blue, 75);
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = blue;
    ctx.textAlign = 'center';
    ctx.fillText("you", catX + catW - 70, catY + 325);
    ctx.textAlign = 'left';

    // Purr note box
    ctx.strokeRect(catX + catW - 170, catY + 65, 150, 60);
    ctx.font = 'bold 18px -apple-system, Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("purr ≈ 25 Hz", catX + catW - 160, catY + 90);
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText("me.purr();", catX + catW - 160, catY + 112);

    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("ENJOYMENT", 100, 1080);

    // =========================================================
    // Q4: GOD / EXISTENCE (Bottom-Right: 960..1920, 560..1120)
    // =========================================================
    ctx.font = 'italic 18px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("GODDRINKSJAVA    WORLD(5)    VOL. 5, NO. 1", 1020, 600);
    ctx.beginPath();
    ctx.moveTo(1020, 612); ctx.lineTo(1880, 612);
    ctx.stroke();

    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I'm the only god", 1020, 670);
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("Then you're the proof of my", 1020, 725);

    ctx.font = 'bold 28px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Theorem 1.  Me is the only god.", 1020, 790);
    ctx.font = 'italic 26px "Times New Roman", serif';
    ctx.fillText("Proof.  You.", 1020, 835);

    // Memory array: 5 slots
    const arrX = 1450;
    const arrY = 740;
    const slotW = 65;
    const slotH = 100;

    for (let s = 0; s < 5; s++) {
      const sx = arrX + s * slotW;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, arrY, slotW, slotH);
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText(String(s), sx + slotW / 2 - 4, arrY + slotH + 18);
    }

    // Slot 1: pink house (W.getGod())
    drawHouse(ctx, arrX + 1 * slotW + slotW / 2, arrY + slotH / 2, 34, 48, true, pink, 76);
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("W.getGod()", arrX + 1 * slotW - 10, arrY - 12);
    ctx.beginPath();
    ctx.moveTo(arrX + 1 * slotW + slotW / 2, arrY - 6);
    ctx.lineTo(arrX + 1 * slotW + slotW / 2, arrY + 10);
    ctx.stroke();

    // Slot 3: blue house (you)
    drawHouse(ctx, arrX + 3 * slotW + slotW / 2, arrY + slotH / 2, 34, 48, false, blue, 77);

    ctx.font = 'italic 15px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Fig. 1. The world W = new World(5) and its two things.", arrX - 30, arrY + slotH + 42);

    ctx.font = '16px "Courier New", monospace';
    ctx.fillText("world.getGod().equals(me) * true", 1020, 930);
    ctx.fillText("me.setProof(you.toProof());", 1020, 960);

    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText("EXISTENCE", 1020, 1080);
  });
}

/**
 * CARD 6: Gender & Role Inversion (88.5s - 103.5s)
 */
export function renderCard6(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // =============================================================
    // Q1: SPLIT-FLAP & GENDER (Top-Left: 0..960, 0..560)
    // =============================================================
    // Split flap board
    const flapX = 70;
    const flapY = 130;
    const flapW = 290;
    const flapH = 370;

    // Outer rounded-rect frame
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(flapX, flapY, flapW, flapH, 16);
    ctx.stroke();

    // Center divider line with circular side hinges
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(flapX, flapY + flapH / 2); ctx.lineTo(flapX + flapW, flapY + flapH / 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(flapX + 6, flapY + flapH / 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(flapX + flapW - 6, flapY + flapH / 2, 8, 0, Math.PI * 2); ctx.fill();

    // Split-flap Character
    ctx.font = '900 180px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    const flapChar = (t >= 95.7) ? "M" : (t >= 90.0 ? "F" : "M");
    ctx.fillText(flapChar, flapX + flapW / 2, flapY + flapH / 2 + 65);
    ctx.textAlign = 'left';

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("split-flap · 26 + blank", flapX, flapY + flapH + 34);

    // Lyrics
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("Switch", 440, 160);

    // Houses: Left pink outline, Right blue solid
    const hBaseY = 430;
    drawHouse(ctx, 550, hBaseY - 80, 150, 180, false, pink, 61);
    drawHouse(ctx, 770, hBaseY - 80, 150, 180, true, blue, 62);

    // Baseline
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(450, hBaseY); ctx.lineTo(870, hBaseY);
    ctx.stroke();

    // Code below baseline
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('new Lovable("Me",  0, false, -1, false)', 450, hBaseY + 42);
    ctx.fillText('new Lovable("You", 0, true,  -1, false)   Δ = 1 bit', 450, hBaseY + 74);
    ctx.fillText('me.toggleGender();', 450, hBaseY + 116);

    // Boxes around false and true
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(695, hBaseY + 26, 68, 22);
    ctx.strokeRect(695, hBaseY + 58, 60, 22);

    // =============================================================
    // Q2: 24-HOUR CLOCK (Top-Right: 960..1920, 0..560)
    // =============================================================
    const clkX = 1440;
    const clkY = 280;
    const clkR = 190;

    // Clock outer ring
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(clkX, clkY, clkR, 0, Math.PI * 2);
    ctx.stroke();

    // Left half (PM): hatched lines
    ctx.save();
    ctx.beginPath();
    ctx.rect(clkX - clkR, clkY - clkR, clkR, clkR * 2);
    ctx.clip();
    ctx.beginPath(); ctx.arc(clkX, clkY, clkR, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.4)';
    ctx.lineWidth = 2;
    for (let i = -clkR * 2; i < clkR * 2; i += 12) {
      ctx.beginPath();
      ctx.moveTo(clkX - clkR, clkY + i);
      ctx.lineTo(clkX, clkY + i + clkR);
      ctx.stroke();
    }
    ctx.restore();

    // Center vertical dividing line
    ctx.beginPath();
    ctx.moveTo(clkX, clkY - clkR); ctx.lineTo(clkX, clkY + clkR);
    ctx.stroke();

    // 24 Hour ticks and labels
    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const isMajor = h % 3 === 0;
      const tickLen = isMajor ? 14 : 7;
      const x1 = clkX + Math.cos(angle) * (clkR - tickLen);
      const y1 = clkY + Math.sin(angle) * (clkR - tickLen);
      const x2 = clkX + Math.cos(angle) * clkR;
      const y2 = clkY + Math.sin(angle) * clkR;

      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

      if (h % 1 === 0) {
        const lx = clkX + Math.cos(angle) * (clkR - 28);
        const ly = clkY + Math.sin(angle) * (clkR - 28);
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = COLORS.ink;
        ctx.textAlign = 'center';
        ctx.fillText(String(h).padStart(2, '0'), lx, ly + 5);
      }
    }
    ctx.textAlign = 'left';

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText("PM", clkX - 90, clkY + 20);
    ctx.fillText("AM", clkX + 60, clkY + 20);

    // Clock Hands (ticks and recoils mechanically on 145.5 BPM beats)
    const beatVal = getMusicBeat(t);
    const bFrac = getBeatPhase(t);
    const clickSnap = bFrac < 0.25 ? Math.pow(bFrac / 0.25, 0.4) : 1.0 + Math.sin((bFrac - 0.25) * 16) * 0.04 * Math.exp(-12 * (bFrac - 0.25));
    const handAngle = -Math.PI / 2 + (Math.floor(beatVal) + clickSnap) * (Math.PI * 2 / 24);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(clkX, clkY + 25);
    ctx.lineTo(clkX, clkY - 10);
    ctx.lineTo(clkX + Math.cos(handAngle) * (clkR * 0.75), clkY + Math.sin(handAngle) * (clkR * 0.75));
    ctx.stroke();

    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(clkX, clkY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(clkX, clkY + 30, 8, 0, Math.PI * 2); ctx.fill();

    // Curved pink lyrics along upper clock arc
    ctx.save();
    ctx.translate(clkX, clkY);
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    const arcText = "And then do whatever";
    const startAngle = -Math.PI * 0.75;
    const angleStep = (Math.PI * 0.5) / arcText.length;
    for (let i = 0; i < arcText.length; i++) {
      const a = startAngle + i * angleStep;
      ctx.save();
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(arcText[i], 0, -clkR + 45);
      ctx.restore();
    }
    ctx.restore();

    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("world.procreate(me, you);", clkX - 120, clkY + clkR + 45);

    // =============================================================
    // Q3: S & M HOUSES (Bottom-Left: 0..960, 560..1120)
    // =============================================================
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("Oh switch", 80, 680);

    // Overlapping S & M Houses
    const smBaseY = 960;
    const smH = 260;
    const smW = 190;
    const smPinkX = 420;
    const smBlueX = 570;

    // Pink house S
    drawHouse(ctx, smPinkX, smBaseY - smH / 2, smW, smH, true, pink, 63);
    // Blue house M
    drawHouse(ctx, smBlueX, smBaseY - smH / 2, smW, smH, true, blue, 64);

    // Multiply blend where they overlap
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = COLORS.purple;
    const overlapW = (smPinkX + smW / 2) - (smBlueX - smW / 2);
    if (overlapW > 0) {
      ctx.fillRect(smBlueX - smW / 2, smBaseY - smH, overlapW, smH);
    }
    ctx.restore();

    // Letters S and M
    ctx.font = '900 120px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("S", smPinkX - 35, smBaseY - smH / 2 + 45);
    ctx.fillText("M", smBlueX - 45, smBaseY - smH / 2 + 50);

    // Baseline & code
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText("press.order = 0    B first · P on top", 80, 1040);
    ctx.fillText("me.toggleRoleBDSM();", 80, 1075);

    // =============================================================
    // Q4: MOIRÉ LINEN TESTER LOUPE (Bottom-Right: 960..1920, 560..1120)
    // =============================================================
    ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("So we", 1040, 780);

    const loupeX = 1460;
    const loupeY = 820;
    const loupeOuterW = 380;
    const loupeInnerR = 155;

    // Square outer frame
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(loupeX - loupeOuterW / 2, loupeY - loupeOuterW / 2, loupeOuterW, loupeOuterW, 18);
    ctx.stroke();

    // 4 corner screws
    const screwOffset = loupeOuterW / 2 - 16;
    [
      [-screwOffset, -screwOffset],
      [screwOffset, -screwOffset],
      [-screwOffset, screwOffset],
      [screwOffset, screwOffset]
    ].forEach(([sx, sy]) => {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath(); ctx.arc(loupeX + sx, loupeY + sy, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Top Handle Bar
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(loupeX - 80, loupeY - loupeOuterW / 2 - 16, 160, 16, 8);
    ctx.fill();

    // Circular opening
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeInnerR, 0, Math.PI * 2);
    ctx.stroke();

    // 10x label at top
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText("· 10x", loupeX, loupeY - loupeInnerR + 10);
    ctx.textAlign = 'left';

    // Inside Loupe: Moiré Halftone Dots
    ctx.save();
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeInnerR - 8, 0, Math.PI * 2);
    ctx.clip();

    // Pink dots at angle 15.3°
    ctx.fillStyle = pink;
    const rotP = 15.3 * (Math.PI / 180);
    for (let gx = -180; gx <= 180; gx += 22) {
      for (let gy = -180; gy <= 180; gy += 22) {
        const rx = loupeX + gx * Math.cos(rotP) - gy * Math.sin(rotP);
        const ry = loupeY + gx * Math.sin(rotP) + gy * Math.cos(rotP);
        ctx.beginPath(); ctx.arc(rx, ry, 6.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Blue dots at angle 14.8°
    ctx.fillStyle = blue;
    const rotB = 14.8 * (Math.PI / 180);
    for (let gx = -180; gx <= 180; gx += 22) {
      for (let gy = -180; gy <= 180; gy += 22) {
        const rx = loupeX + 3 + gx * Math.cos(rotB) - gy * Math.sin(rotB);
        const ry = loupeY + 3 + gx * Math.sin(rotB) + gy * Math.cos(rotB);
        ctx.beginPath(); ctx.arc(rx, ry, 6.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // Central crosshair & mm scale inside loupe
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(loupeX - 15, loupeY); ctx.lineTo(loupeX + 15, loupeY);
    ctx.moveTo(loupeX, loupeY - 15); ctx.lineTo(loupeX, loupeY + 15);
    ctx.stroke();

    // MM scale line
    const mmY = loupeY + 70;
    ctx.beginPath();
    ctx.moveTo(loupeX - 100, mmY); ctx.lineTo(loupeX + 100, mmY);
    ctx.stroke();
    for (let m = 0; m <= 4; m++) {
      const mx = loupeX - 100 + m * 50;
      ctx.beginPath(); ctx.moveTo(mx, mmY); ctx.lineTo(mx, mmY + 10); ctx.stroke();
      ctx.font = '12px "Courier New", monospace';
      ctx.fillText(String(m), mx - 3, mmY + 22);
    }

    // Bottom annotations
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("world.makeHigh(me);   world.makeHigh(you);", 1040, 1060);
    ctx.fillText("screens  P 15.3°   B 14.8°   Δθ 0.51°", 1460, 1060);
  });
}

/**
 * CARD 7: Completion & Vibrations (103.5s - 118.0s)
 */
export function renderCard7(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
    const blue = isMonochrome ? COLORS.ink : COLORS.blue;
    const purple = isMonochrome ? COLORS.ink : COLORS.purple;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    const hasBlueTape = t >= 110.0 && t < 198.0;
    const tapeLeft = 980;
    const tapeWidth = 410;

    // BLUE STARRY VERTICAL TAPE STRIP (Rendered as background layer)
    if (hasBlueTape) {
      ctx.save();
      // Halftone stipple gradient transition strip to the left of the tape
      ctx.fillStyle = blue;
      for (let s = 0; s < 140; s++) {
        const gx = 900 + pseudoRand(s * 11) * 80;
        const gy = pseudoRand(s * 11 + 1) * 1120;
        const prob = (gx - 900) / 80;
        if (pseudoRand(s * 11 + 2) < prob) {
          ctx.beginPath();
          ctx.arc(gx, gy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Solid blue vertical tape strip
      ctx.fillStyle = blue;
      ctx.fillRect(tapeLeft, 0, tapeWidth, 1120);

      // Dark spine fold
      ctx.fillStyle = 'rgba(15, 35, 100, 0.4)';
      ctx.fillRect(1075, 0, 14, 1120);

      // White starry noise specks inside blue tape
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let s = 0; s < 200; s++) {
        const sx = tapeLeft + pseudoRand(s * 7) * tapeWidth;
        const sy = pseudoRand(s * 7 + 1) * 1120;
        const sr = 1.2 + pseudoRand(s * 7 + 2) * 2.2;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Erased ghost dashed outline for 'you' house inside brackets
      const ghostX = tapeLeft + tapeWidth / 2;
      ctx.setLineDash([6, 6]);
      drawHouse(ctx, ghostX, 720, 180, 230, false, 'rgba(255,255,255,0.7)', 72);
      ctx.setLineDash([]);
      // Brackets [ ] around erased house
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ghostX - 110, 720 - 130); ctx.lineTo(ghostX - 130, 720 - 130); ctx.lineTo(ghostX - 130, 720 + 130); ctx.lineTo(ghostX - 110, 720 + 130);
      ctx.moveTo(ghostX + 110, 720 - 130); ctx.lineTo(ghostX + 130, 720 - 130); ctx.lineTo(ghostX + 130, 720 + 130); ctx.lineTo(ghostX + 110, 720 + 130);
      ctx.stroke();

      ctx.restore();

      // Removal logs to the right of blue strip in black on paper
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("v = 498/s · T = 60/130 s · f = 130/60 Hz", 1410, 420);
      ctx.fillText("world.unlock(you);", 1410, 460);
      ctx.fillText("world.removeThing(you);", 1410, 495);
      ctx.fillText("me.lookFor(you, world) -> -1  1/5", 1410, 530);
      ctx.fillText("me.lookFor(you, world) -> -1  2/5", 1410, 565);
      ctx.fillText("me.lookFor(you, world) -> -1  3/5", 1410, 600);
      ctx.fillText("me.lookFor(you, world)", 1410, 635);
      ctx.restore();
    }

    // 1. Lyrics & Code Header (Top)
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("If I can", 80, 120);
    if (t >= 105.0) {
      ctx.fillText("feel your", 340, 120);
    }

    if (t >= 106.0) {
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('if (me.getSenseIndex("vibration")) {', 80, 155);
    }

    if (t >= 107.0) {
      ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("Then I can finally be", 80, 225);

      ctx.font = '900 92px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("COMPLETION", 760, 225);

      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('me.addFeeling("complete");', 80, 250);

      ctx.font = '900 100px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("VIBRATIONS", 80, 345);
    }

    // 2. Helicorder Seismograph Telemetry (Rows 57..63 on the left)
    ctx.font = '15px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("sta. me · helicorder · 1 row = 1 bar = 4T", 80, 385);

    // Timeline tick ruler
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 395); ctx.lineTo(600, 395);
    for (let tx = 80; tx <= 600; tx += 65) {
      ctx.moveTo(tx, 390); ctx.lineTo(tx, 400);
    }
    ctx.stroke();

    const seismoRows = [57, 58, 59, 60, 61, 62, 63];
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    seismoRows.forEach((rowNum, idx) => {
      const sy0 = 420 + idx * 30;
      ctx.fillText(String(rowNum), 80, sy0 + 4);

      ctx.beginPath();
      ctx.strokeStyle = pink;
      ctx.lineWidth = 2.8;
      for (let sx = 115; sx <= 600; sx += 4) {
        let amp = 0;
        if (t >= 103.0) {
          const seismoImpulse = getRhythmicImpulse(t, 5.0);
          if (idx >= 3 && idx <= 5) {
            amp = Math.sin((sx - 115) * 0.15 + (t - 103) * (Math.PI * 2 / BEAT_INTERVAL)) * (idx === 4 ? 14 + 10 * seismoImpulse : 8 + 6 * seismoImpulse);
          } else {
            amp = Math.sin((sx - 115) * 0.05 + (t - 103) * (Math.PI / BEAT_INTERVAL)) * (3 + 3 * seismoImpulse);
          }
        }
        if (sx === 115) ctx.moveTo(sx, sy0 + amp); else ctx.lineTo(sx, sy0 + amp);
      }
      ctx.stroke();
    });

    // 3. Concentric Sound Wave Rings from 'you' house (expanding on beat)
    const ripX = 1250;
    const ripY = 540;
    const ringRadii = [180, 320, 480, 650, 840];
    const ringPhase = getBeatPhase(t);

    ringRadii.forEach((rad, rIdx) => {
      const dynamicRad = rad + ringPhase * 75;
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = hasBlueTape ? 'rgba(255,255,255,0.3)' : 'rgba(27, 72, 184, 0.35)';
      ctx.lineWidth = 2 + (1.0 - ringPhase) * 1.5;
      ctx.beginPath();
      ctx.arc(ripX, ripY, dynamicRad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const dotCount = Math.floor(rad * 0.55);
      const bandWidth = 42;
      ctx.fillStyle = hasBlueTape ? 'rgba(255,255,255,0.45)' : blue;
      for (let d = 0; d < dotCount; d++) {
        const theta = (d / dotCount) * Math.PI * 2 + (rIdx * 0.4);
        const rOff = (pseudoRand(rIdx * 50 + d) - 0.5) * bandWidth;
        const dist = dynamicRad + rOff;
        const bx = ripX + Math.cos(theta) * dist;
        const by = ripY + Math.sin(theta) * dist;
        if (bx >= 0 && bx <= 1920 && by >= 0 && by <= 1120) {
          const dotR = 2.0 + pseudoRand(rIdx * 100 + d) * 2.2;
          ctx.beginPath();
          ctx.arc(bx, by, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 4. Ground baseline and Houses: Left Pink 'me', Right Blue 'you'
    const meX = 760;
    const meY = 530;

    // Ground baseline
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(560, 635); ctx.lineTo(1500, 635);
    ctx.stroke();

    // Solid Pink house 'me'
    drawHouse(ctx, meX, meY, 160, 210, true, pink, 71);
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.fillText("me", meX, 660);

    // Right house 'you': hollow blue house if before blue tape
    if (!hasBlueTape) {
      drawHouse(ctx, ripX, ripY, 170, 220, false, blue, 72);
      ctx.fillText("you", ripX, 660);
    }

    // Dimension line between me and you: Δ = 460 + 2vt
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(meX, 675); ctx.lineTo(hasBlueTape ? 1185 : ripX, 675);
    ctx.moveTo(meX, 668); ctx.lineTo(meX, 682);
    ctx.moveTo(hasBlueTape ? 1185 : ripX, 668); ctx.lineTo(hasBlueTape ? 1185 : ripX, 682);
    ctx.stroke();
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Δ = 460 + 2vt", (meX + (hasBlueTape ? 1185 : ripX)) / 2, 668);
    ctx.textAlign = 'left';

    // 7. Isolation Lyrics at bottom left and ISOLATION label
    if (t >= 110.0) {
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      const isoLines = [
        "Though you have left",
        "You have left",
        "You have left",
        "You have left",
        "You have"
      ];
      isoLines.forEach((line, lIdx) => {
        if (t >= 110.0 + lIdx * 1.1 || t >= 198.0) {
          ctx.fillText(line, 80, 720 + lIdx * 65);
        }
      });
      if (t >= 116.0 || t >= 198.0) {
        ctx.fillText("me in", 80, 1045);
      }

      ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("ISOLATION", 1520, 1045);
    }
  });
}

/**
 * CARD 8: Fragments & Illegal Arguments (118.0s - 133.5s)
 */
export function renderCard8(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    // 1. Header & Telemetry
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText("me.getMemory() · 22×10 sectors", 1740, 100);
    ctx.textAlign = 'left';

    // 2. Lyrics (top-left)
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    if (t < 122.0) {
      ctx.fillText("If I", 160, 95);
    } else {
      ctx.fillText("Challenging your", 160, 95);
    }

    // 3. 22x10 Memory Sector Grid
    const gX = 160;
    const gY = 125;
    const gW = 1580;
    const gH = 620;
    const numCols = 22;
    const numRows = 10;
    const colW = gW / numCols;
    const rowH = gH / numRows;

    // Solid outer border
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(gX, gY, gW, gH);

    // Dashed internal grid lines
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(24, 23, 25, 0.22)';
    ctx.lineWidth = 1;
    for (let c = 1; c < numCols; c++) {
      ctx.beginPath();
      ctx.moveTo(gX + c * colW, gY);
      ctx.lineTo(gX + c * colW, gY + gH);
      ctx.stroke();
    }
    for (let r = 1; r < numRows; r++) {
      ctx.beginPath();
      ctx.moveTo(gX, gY + r * rowH);
      ctx.lineTo(gX + gW, gY + r * rowH);
      ctx.stroke();
    }
    ctx.restore();

    // Y-axis Hex Address labels
    const hexAddrs = ["0x000", "0x02c", "0x058", "0x084", "0x0b0"];
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    hexAddrs.forEach((addr, idx) => {
      ctx.fillText(addr, gX + 8, gY + 22 + idx * (rowH * 2));
    });

    // 4. Center House: Dashed Outline (or Black Cutout at t >= 122.0)
    const hX = gX + 6.5 * colW;
    const hY = gY + 6.0 * rowH;
    const hW = 3.6 * colW;
    const hH = 4.8 * rowH;

    const isCutout = t >= 122.0;

    if (isCutout) {
      // Solid black cutout house inside
      drawHouse(ctx, hX, hY, hW, hH, true, COLORS.ink, 88);
      // Dashed white/black boundary
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      drawHouse(ctx, hX, hY, hW + 8, hH + 8, false, '#ffffff', 88);
      ctx.setLineDash([]);
      ctx.restore();

      // Contiguous sectors note on right
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("48 sectors", hX + hW / 2 + 35, hY - 30);
      ctx.fillText("contiguous", hX + hW / 2 + 35, hY - 5);
    } else {
      // Dashed black outline with 'you' inside
      ctx.save();
      ctx.setLineDash([8, 6]);
      drawHouse(ctx, hX, hY, hW, hH, false, COLORS.ink, 88);
      ctx.restore();
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'center';
      ctx.fillText("you", hX, hY + 15);
      ctx.textAlign = 'left';
    }

    // 5. Halftone Pink Memory Fragments
    const fragments = [
      { id: "0x00b", x: gX + 11.5 * colW, y: gY + 1.2 * rowH, w: 100, h: 90, type: 'rect' },
      { id: "0x014", x: gX + 19.5 * colW, y: gY + 1.5 * rowH, w: 120, h: 120, type: 'pie' },
      { id: "0x018", x: gX + 13.5 * colW, y: gY + 3.0 * rowH, w: 100, h: 50, type: 'sine' },
      { id: "0x023", x: gX + 15.0 * colW, y: gY + 1.8 * rowH, w: 55, h: 55, type: 'square' },
      { id: "0x043", x: gX + 2.5 * colW, y: gY + 3.5 * rowH, w: 180, h: 90, type: 'sine_band' },
      { id: "0x052", x: gX + 17.0 * colW, y: gY + 3.6 * rowH, w: 110, h: 60, type: 'arc' },
      { id: "0x06b", x: gX + 3.2 * colW, y: gY + 7.0 * rowH, w: 120, h: 80, type: 'scatter' },
      { id: "0x08e", x: gX + 14.5 * colW, y: gY + 6.8 * rowH, w: 160, h: 140, type: 'M' },
      { id: "0x0ad", x: gX + 4.0 * colW, y: gY + 8.2 * rowH, w: 130, h: 70, type: 'arc_cross' }
    ];

    fragments.forEach((frag, fIdx) => {
      // Small address tag
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(frag.id, frag.x - 10, frag.y - 12);

      ctx.save();
      ctx.translate(frag.x, frag.y);

      if (frag.type === 'sine' || frag.type === 'sine_band') {
        // Pink sine wave with stipple background
        ctx.fillStyle = pink;
        for (let i = 0; i < 35; i++) {
          const px = (pseudoRand(fIdx * 10 + i) - 0.5) * frag.w;
          const py = (pseudoRand(fIdx * 10 + i + 1) - 0.5) * frag.h;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = pink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let sx = -frag.w / 2; sx <= frag.w / 2; sx += 4) {
          const sy = Math.sin(sx * 0.08) * (frag.h * 0.35);
          if (sx === -frag.w / 2) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      } else if (frag.type === 'M') {
        // Giant Pink 'M' with halftone dots
        ctx.fillStyle = pink;
        for (let i = 0; i < 45; i++) {
          const px = (pseudoRand(fIdx * 12 + i) - 0.5) * frag.w;
          const py = (pseudoRand(fIdx * 12 + i + 1) - 0.5) * frag.h;
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = '900 130px -apple-system, BlinkMacSystemFont, Arial, sans-serif';
        ctx.fillStyle = pink;
        ctx.textAlign = 'center';
        ctx.fillText("M", 0, 45);
        ctx.textAlign = 'left';
      } else if (frag.type === 'pie' || frag.type === 'rect' || frag.type === 'square') {
        ctx.fillStyle = pink;
        for (let i = 0; i < 40; i++) {
          const px = (pseudoRand(fIdx * 8 + i) - 0.5) * frag.w;
          const py = (pseudoRand(fIdx * 8 + i + 1) - 0.5) * frag.h;
          ctx.beginPath();
          ctx.arc(px, py, 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Arc or scatter
        ctx.fillStyle = pink;
        for (let i = 0; i < 28; i++) {
          const px = (pseudoRand(fIdx * 15 + i) - 0.5) * frag.w;
          const py = (pseudoRand(fIdx * 15 + i + 1) - 0.5) * frag.h;
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = pink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, frag.w * 0.4, 0, Math.PI * 0.8);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 6. Map Pin & YOU ARE HERE Struck Banner (t >= 122.0s)
    if (t >= 122.0) {
      // Code snippet above banner
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('me.getOpinionIndex("you are here") -> -1', hX + 40, gY + 0.8 * rowH);
      ctx.fillText('me.setOpinion(-1, false);', hX + 40, gY + 1.3 * rowH);

      // Black starry banner
      const bX = hX + 60;
      const bY = gY + 2.1 * rowH;
      const bW = 600;
      const bH = 75;

      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(bX, bY, bW, bH);

      // Starry dust specks in banner
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let s = 0; s < 45; s++) {
        ctx.fillRect(bX + pseudoRand(s * 9) * bW, bY + pseudoRand(s * 9 + 1) * bH, 1.8, 1.8);
      }

      // White YOU ARE HERE Text
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText("YOU ARE HERE", bX + 50, bY + 54);

      // Pink Highlighter Strike-through
      ctx.fillStyle = pink;
      ctx.fillRect(bX - 25, bY + 24, bW + 40, 18);

      // Giant Black Map Pin Icon
      const pinX = hX - 20;
      const pinY = bY + bH / 2;
      ctx.save();
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      // Teardrop pin shape
      ctx.arc(pinX, pinY - 15, 38, Math.PI * 0.75, Math.PI * 2.25);
      ctx.lineTo(hX, hY - hH / 2); // points to peak of house
      ctx.closePath();
      ctx.fill();

      // White inner hole
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pinX, pinY - 15, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Bottom Large Typography
    ctx.font = '900 100px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("FRAGMENTS", 160, 930);

    ctx.font = '900 120px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("ILLEGAL ARGUMENTS", 160, 1060);
  });
}

/**
 * CARD 9: 40 Copies Grid (133.5s - 147.0s)
 */
export function renderCard9(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("removed at 117.39 s    form 8 × 5    vectors ×4", 120, 75);

    const startX = 140;
    const startY = 130;
    const stepX = 205;
    const stepY = 140;
    // Accelerating replication matching musical snare build-up:
    // 133.5s - 138.0s: 1 house per beat
    // 138.0s - 142.5s: 2 houses per beat
    // 142.5s - 146.5s: 4 houses per beat
    let beatIndex = 0;
    if (t >= 133.5) {
      const dt = t - 133.5;
      if (dt < 4.5) {
        beatIndex = Math.floor(dt / BEAT_INTERVAL);
      } else if (dt < 9.0) {
        beatIndex = 11 + Math.floor((dt - 4.5) / (BEAT_INTERVAL * 0.5));
      } else {
        beatIndex = 22 + Math.floor((dt - 9.0) / (BEAT_INTERVAL * 0.25));
      }
      beatIndex = Math.min(40, Math.max(0, beatIndex));
    }

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const idx = r * 8 + c;
        const cx = startX + c * stepX;
        const cy = startY + r * stepY;

        // Grid intersection registration cross
        drawCross(ctx, cx - 40, cy - 40, 5);

        // Dashed black outline
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2.5;
        drawHouse(ctx, cx, cy, 55, 75, false, COLORS.ink, idx);
        ctx.setLineDash([]);

        // Internal crosshair
        ctx.strokeStyle = COLORS.faint;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
        ctx.stroke();

        // Stamped active house
        if (idx <= beatIndex) {
          const offX = (pseudoRand(idx * 7) - 0.5) * 8;
          const offY = (pseudoRand(idx * 7 + 1) - 0.5) * 8;
          const angle = (pseudoRand(idx * 7 + 2) - 0.5) * 0.12;

          ctx.save();
          ctx.translate(cx + offX, cy + offY);
          ctx.rotate(angle);
          drawHouse(ctx, 0, 0, 55, 75, false, pink, idx + 100);

          // Vector directional arrow inside
          const arrowDir = pseudoRand(idx * 11) * Math.PI * 2;
          ctx.strokeStyle = COLORS.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(arrowDir) * 16, Math.sin(arrowDir) * 16);
          ctx.stroke();
          ctx.restore();

          // Monospace telemetry labels beside house
          ctx.font = '11px "Courier New", monospace';
          ctx.fillStyle = COLORS.ink;
          const lx = cx + 38;
          ctx.fillText(`copy ${String(idx + 1).padStart(3, '0')}/040`, lx, cy - 18);
          ctx.fillText(`Δ ${(0.8 + pseudoRand(idx * 5) * 4.0).toFixed(1)}`, lx, cy - 5);
          ctx.fillText(`θ ${(pseudoRand(idx * 3) * 2 - 1).toFixed(1)}°`, lx, cy + 8);
          ctx.fillText(`ink ${Math.floor(80 + pseudoRand(idx * 9) * 40)}%`, lx, cy + 21);
        }
      }
    }

    // Bottom musical timeline ruler
    drawRuler(ctx, 80, 930, 1840, 9, [
      'bar 73 D', 'bar 74', 'bar 75', 'bar 76', 
      'bar 77 Bbmaj7', 'bar 78', 'bar 79', 'bar 80'
    ]);
  });
}

/**
 * CARD 10: EXECUTION Stamps (Double Card: 3840x1120) (147.0s - 155.0s)
 */
export function renderCard10(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    // -------------------------------------------------------------
    // SPECIAL CLIMAX: 157.5s - 159.0s Pitch-Black Screen (抹殺・死刑)
    // -------------------------------------------------------------
    if (t >= 157.5 && t < 159.0) {
      ctx.fillStyle = COLORS.darkBg;
      ctx.fillRect(0, 0, 3840, 1120);

      // Starry dust specks
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let s = 0; s < 300; s++) {
        ctx.fillRect(960 + pseudoRand(s * 7) * 1920, pseudoRand(s * 7 + 1) * 1120, 2.2, 2.2);
      }

      function drawSpreadExecutionRows(targetCtx, color) {
        targetCtx.save();
        targetCtx.font = '900 240px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
        targetCtx.fillStyle = color;
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        const word = "EXECUTION";
        const startX = 1060;
        const endX = 2780;
        const step = (endX - startX) / (word.length - 1);
        const yRows = [190, 430, 670, 910];
        yRows.forEach(y => {
          for (let i = 0; i < word.length; i++) {
            targetCtx.fillText(word[i], startX + i * step, y);
          }
        });
        targetCtx.restore();
      }

      // Massive dark purple / black stacked EXECUTION stamps spanning frame
      drawSpreadExecutionRows(ctx, 'rgba(40, 10, 32, 0.95)');

      // White paper rip tears revealing underlying pink EXECUTION
      const rips = [
        [[1060, 120], [1400, 130], [1360, 240], [1020, 220]],
        [[1620, 100], [2020, 110], [1970, 230], [1590, 220]],
        [[2240, 120], [2760, 110], [2710, 240], [2200, 230]],
        [[1040, 390], [1520, 380], [1480, 500], [1000, 500]],
        [[1720, 400], [2060, 390], [2020, 500], [1680, 500]],
        [[2280, 390], [2760, 380], [2720, 500], [2240, 500]],
        [[1000, 640], [1560, 630], [1520, 740], [980, 740]],
        [[1700, 640], [2080, 630], [2040, 740], [1660, 740]],
        [[2220, 630], [2780, 620], [2740, 740], [2180, 740]],
        [[980, 880], [1840, 870], [1800, 990], [980, 990]],
        [[2550, 860], [2800, 850], [2770, 950], [2520, 950]]
      ];
      rips.forEach(pts => {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        pts.forEach((pt, pIdx) => {
          if (pIdx === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]);
        });
        ctx.closePath();
        ctx.fill();

        // Reveal pink EXECUTION inside tear matching background letters exactly
        ctx.clip();
        drawSpreadExecutionRows(ctx, pink);
        ctx.restore();
      });

      // White execution snippets in center
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText("execution", 1880, 420);
      ctx.fillStyle = pink;
      ctx.fillText("n", 2090, 420);

      // Massive Japanese/Chinese Serif Kanji: 抹殺・死刑 (White)
      ctx.font = '900 170px "MS Mincho", "SimSun", "Songti SC", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText("抹殺・死刑", 1020, 960);

      // Pink runExecution() and White execution 12/12
      ctx.font = 'bold 44px "Courier New", monospace';
      ctx.fillStyle = pink;
      ctx.fillText("runExecution()", 2150, 890);
      ctx.font = 'bold 44px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText("execution 12/12", 2150, 960);
      return;
    }

    // -------------------------------------------------------------
    // STANDARD CARD 10: 147.0s - 157.5s (8 Rows of Execution)
    // -------------------------------------------------------------
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 3840, 1120);

    const timestamps = [
      "147.774", "148.392", "149.011", "149.629",
      "151.560", "152.497", "153.406", "154.280"
    ];

    const STAMP_TIMES = [
      147.40, 147.80, 148.80, 149.73,
      151.20, 151.57, 152.50, 153.43
    ];

    let activeCount = 0;
    for (let i = 0; i < 8; i++) {
      if (t >= STAMP_TIMES[i]) activeCount = i + 1;
    }

    // 4 Divider Lines for Left Half and Right Half
    for (let r = 0; r < 4; r++) {
      const lineY = r * 280 + 155;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      // Left line
      ctx.beginPath();
      ctx.moveTo(80, lineY); ctx.lineTo(1840, lineY);
      ctx.stroke();
      // Right line
      ctx.beginPath();
      ctx.moveTo(2000, lineY); ctx.lineTo(3760, lineY);
      ctx.stroke();
    }

    // 8 Execution Rows: Left half (01/12..04/12), Right half (05/12..08/12)
    for (let i = 0; i < 8; i++) {
      if (i >= activeCount) continue;

      const isRight = i >= 4;
      const rowIndex = i % 4;
      const leftX = isRight ? 2000 : 80;
      const rightX = isRight ? 3760 : 1840;
      const rowY = rowIndex * 280;

      // 1. Massive Bold Pink EXECUTION at TOP of Row with transient impact punch
      const stampAge = t - STAMP_TIMES[i];
      const stampScale = (stampAge >= 0 && stampAge < 0.18) ? 1.0 + 0.12 * Math.exp(-18.0 * stampAge) : 1.0;

      ctx.save();
      ctx.translate(leftX, rowY + 135);
      ctx.scale(stampScale, stampScale);
      ctx.font = '900 160px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.textAlign = 'left';
      ctx.fillText("EXECUTION", 0, 0);
      ctx.restore();

      // 2. Monospace Telemetry BELOW Line
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("runExecution()    実行・執行", leftX, rowY + 195);
      ctx.textAlign = 'right';
      ctx.fillText(`${timestamps[i]} s    execution ${String(i + 1).padStart(2, '0')}/12`, rightX, rowY + 195);
      ctx.textAlign = 'left';
    }

    // -------------------------------------------------------------
    // OVERLAY BLACK STAMPS AT CLIMAX (154.5s - 157.5s)
    // -------------------------------------------------------------
    if (t >= 154.5) {
      ctx.save();
      ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = COLORS.ink;

      // Center seam EXECUTION stamp
      ctx.fillText("EXECUTION", 1920 - 750, 520);
      ctx.fillText("EXECUTION", 200, 520);
      ctx.fillText("EXECUTION", 2100, 520);

      if (t >= 155.5) {
        ctx.fillText("EXECUTION", 1920 - 750, 780);
        ctx.fillText("EXECUTION", 100, 780);
        ctx.fillText("EXECUTION", 2200, 780);
      }

      // Center seam 抹殺・死刑 Stamp block
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(1350, 910, 500, 120);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 120px "MS Mincho", "SimSun", "Songti SC", serif';
      ctx.fillText("抹殺・死刑", 1370, 1010);
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.fillText("execution 10/12", 1880, 1005);

      // Right 抹殺・死刑 Stamp block & Stamped Counter
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(2350, 910, 500, 120);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 120px "MS Mincho", "SimSun", "Songti SC", serif';
      ctx.fillText("抹殺・死刑", 2370, 1010);

      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(3240, 880, 480, 150);
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("runExecution()", 3280, 935);
      ctx.fillText("execution 12/12", 3280, 990);
      ctx.restore();
    }
  });
}

/**
 * CARD 11: Multilingual Countdown (Chalkboard) (155.0s - 162.5s)
 */
export function renderCard11(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    ctx.fillStyle = COLORS.darkBg;
    ctx.fillRect(0, 0, 1920, 1120);

    // Chalk dust specks
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 180; i++) {
      const px = pseudoRand(i * 3) * 1920;
      const py = pseudoRand(i * 3 + 1) * 1120;
      ctx.fillRect(px, py, 2.5, 2.5);
    }

    const cells = [
      { lang: 'de', text: 'EIN', sub: 'announce("1", "de")', font: '900 140px -apple-system, BlinkMacSystemFont, "Impact", sans-serif' },
      { lang: 'es', text: 'DOS', sub: 'announce("2", "es")', font: '900 140px -apple-system, BlinkMacSystemFont, "Impact", sans-serif' },
      { lang: 'fr', text: 'TROIS', sub: 'announce("3", "fr")', font: '900 140px -apple-system, BlinkMacSystemFont, "Impact", sans-serif' },
      { lang: 'kr', text: '네', sub: 'announce("4", "kr")', font: '900 140px "Batang", "Malgun Gothic", serif' },
      { lang: 'se', text: 'FEM', sub: 'announce("5", "se")', font: '900 140px -apple-system, BlinkMacSystemFont, "Impact", sans-serif' },
      { lang: 'cn', text: '六', sub: 'announce("6", "cn")', font: '900 150px "KaiTi", "SimSun", "Songti SC", serif' }
    ];

    const colW = 1920 / 3;
    const rowH = 310;
    // Multilingual countdown locked to exact vocal stabs
    const COUNTDOWN_TIMES = [158.60, 159.43, 159.87, 160.30, 160.73, 161.15];
    let countIndex = 0;
    for (let i = 0; i < COUNTDOWN_TIMES.length; i++) {
      if (t >= COUNTDOWN_TIMES[i]) countIndex = i + 1;
    }

    // Grid divider lines
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;

    // Vertical dividers
    ctx.beginPath();
    ctx.moveTo(colW, 0); ctx.lineTo(colW, rowH * 2);
    ctx.moveTo(colW * 2, 0); ctx.lineTo(colW * 2, rowH * 2);
    // Horizontal divider
    ctx.moveTo(0, rowH); ctx.lineTo(1920, rowH);
    // Baseline divider below row 2
    ctx.moveTo(0, rowH * 2); ctx.lineTo(1920, rowH * 2);
    ctx.stroke();

    for (let i = 0; i < countIndex; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = col * colW;
      const cy = row * rowH;

      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(cells[i].lang, cx + 50, cy + 60);

      ctx.font = cells[i].font;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(cells[i].text, cx + 50, cy + 205);

      ctx.font = '20px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(cells[i].sub, cx + 50, cy + 270);
    }

    // Bottom Giant EXECUTION stamped on vocal drop at 161.70s
    if (t >= 161.70) {
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText("runExecution()", 80, 710);

      ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText("EXECUTION", 80, 980);
    }
  });
}

/**
 * CARD 12: Terminal Purge & Trap (Double Card: 3840x1120) (162.5s - 179.0s)
 */
export function renderCard12(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? '#fff' : COLORS.magenta;

    ctx.fillStyle = COLORS.darkBg;
    ctx.fillRect(0, 0, 3840, 1120);

    // Starry / fiber noise in dark background
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 300; i++) {
      const px = pseudoRand(i * 5) * 3840;
      const py = pseudoRand(i * 5 + 1) * 1120;
      ctx.fillRect(px, py, 2, 2);
    }

    // -------------------------------------------------------------
    // PANEL 1 (x: 0..1280): if (world.isExecutableBy(me))
    // -------------------------------------------------------------
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText("113  if (world.isExecutableBy(me)) {", 80, 90);

    ctx.font = '900 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    if (t < 164.5 && t < 198.0) {
      ctx.fillText("If I can", 80, 190);
    } else {
      ctx.fillText("If I can give them all the", 80, 190);
    }

    // Left time tracks and row timestamps
    const tracks = ['000-015', '016-031', '032-047', '048-063', '064-079', '080-095'];
    const rowTimestamps = ['163.128 s', '163.590 s', '164.053 s', '164.515 s', '164.978 s', '165.440 s'];

    // Laser scan beam sweeps downward
    const laserProgress = Math.max(0, Math.min(1.0, (t - 162.53) / 3.6));
    const laserY = 440 + laserProgress * 440;

    tracks.forEach((tk, idx) => {
      const ty = 460 + idx * 74;
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(tk, 80, ty - 4);

      const isSquished = (ty + 15) <= laserY || t >= 166.5;
      if (isSquished) {
        ctx.font = '16px "Courier New", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(rowTimestamps[idx], 80, ty + 16);

        // Flat squished pink laser ripple
        ctx.strokeStyle = pink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let wx = 200; wx <= 940; wx += 10) {
          const wy = ty + 8 + Math.sin(wx * 0.12) * 2.5;
          if (wx === 200) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      } else {
        // Unsquished white solid houses
        for (let c = 0; c < 16; c++) {
          const hx = 210 + c * 47;
          drawHouse(ctx, hx, ty + 10, 26, 36, true, '#ffffff', idx * 16 + c);
        }
      }
    });

    // Active Laser beam line
    if (t < 166.5 && t >= 162.53) {
      ctx.strokeStyle = '#ff3388';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(190, laserY); ctx.lineTo(950, laserY);
      ctx.stroke();
    }

    // Large pink house on the right of panel 1 (x ~ 1000..1150)
    drawHouse(ctx, 1060, 650, 130, 170, true, pink, 121);

    // Bottom cream box with black EXECUTION
    if (t >= 164.8 || t >= 198.0) {
      ctx.fillStyle = '#f2ede4';
      ctx.fillRect(80, 930, 1100, 130);
      ctx.fillStyle = '#181719';
      ctx.font = '900 120px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillText("EXECUTION", 100, 1035);
    }

    // -------------------------------------------------------------
    // PANEL 2 (x: 1280..2560): you.setExecution(me.toExecution());
    // -------------------------------------------------------------
    if (t >= 166.82 || t >= 198.0) {
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText("114  you.setExecution(me.toExecution());", 1380, 90);

      ctx.font = '900 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("Then I can be your only", 1380, 190);

      // White dotted bouncing trajectory arcs (4 bounces)
      const arcs = [
        { x1: 1380, x2: 1580, label: '166.820' },
        { x1: 1580, x2: 1780, label: '167.743' },
        { x1: 1780, x2: 1980, label: '168.639' },
        { x1: 1980, x2: 2180, label: '169.095' }
      ];

      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      arcs.forEach(a => {
        ctx.beginPath();
        for (let bx = a.x1; bx <= a.x2; bx += 10) {
          const frac = (bx - a.x1) / (a.x2 - a.x1);
          const by = 680 - Math.sin(frac * Math.PI) * 220;
          if (bx === a.x1) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.stroke();

        ctx.font = '16px "Courier New", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(a.label, (a.x1 + a.x2) / 2, 705);
        ctx.textAlign = 'left';
      });
      ctx.setLineDash([]);

      // Dynamic hopping house across the 4 arcs (166.820s -> 169.800s)
      if (t >= 166.82 && t < 170.0) {
        let curArc = -1;
        let arcP = 0;
        if (t >= 166.820 && t < 167.743) {
          curArc = 0;
          arcP = (t - 166.820) / (167.743 - 166.820);
        } else if (t >= 167.743 && t < 168.639) {
          curArc = 1;
          arcP = (t - 167.743) / (168.639 - 167.743);
        } else if (t >= 168.639 && t < 169.095) {
          curArc = 2;
          arcP = (t - 168.639) / (169.095 - 168.639);
        } else if (t >= 169.095 && t < 169.800) {
          curArc = 3;
          arcP = (t - 169.095) / (169.800 - 169.095);
        }
        if (curArc >= 0) {
          const a = arcs[curArc];
          const hx = a.x1 + (a.x2 - a.x1) * arcP;
          const bounceH = Math.sin(arcP * Math.PI) * 220;
          const hy = 680 - bounceH - 70;
          const squash = bounceH < 15 ? Math.max(0.75, 1.0 - (15 - bounceH) * 0.02) : 1.0;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.scale(1.0 / squash, squash);
          drawHouse(ctx, 0, 0, 100, 130, true, pink, 124);
          ctx.restore();
        }
      }

      // Landing house: Solid pink house with white dashed outline
      if (t >= 169.800 || t >= 198.0) {
        ctx.save();
        drawHouse(ctx, 2180, 660, 120, 150, true, pink, 122);
        ctx.setLineDash([6, 6]);
        drawHouse(ctx, 2180, 660, 120, 150, false, '#ffffff', 123);
        ctx.restore();
      }

      // Bottom cream box with black EXECUTION
      ctx.fillStyle = '#f2ede4';
      ctx.fillRect(1360, 930, 1100, 130);
      ctx.fillStyle = '#181719';
      ctx.font = '900 120px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillText("EXECUTION", 1380, 1035);
    }

    // -------------------------------------------------------------
    // PANEL 3 (x: 2560..3840): if (world.getThingIndex(you) != -1)
    // -------------------------------------------------------------
    if (t >= 172.5 || t >= 198.0) {
      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText("116  if (world.getThingIndex(you) != -1) {", 2660, 90);
      ctx.fillText("-1 != -1 -> false", 3040, 135);

      ctx.font = '900 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("If I can have you back", 2660, 200);

      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText("117  world.runExecution();", 2660, 310);

      // Checkered pink "I will run the"
      ctx.font = '900 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("I will run the", 2660, 390);

      ctx.font = 'bold 36px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText("118  }", 2660, 460);

      // UNREACHABLE Stamp
      ctx.save();
      ctx.translate(3450, 340);
      ctx.rotate(-0.06);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.strokeRect(-160, -35, 320, 70);
      ctx.font = '900 40px -apple-system, BlinkMacSystemFont, Arial, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText("UNREACHABLE", 0, 14);
      ctx.restore();

      if (t >= 175.0 || t >= 198.0) {
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText("119  me.escape(world);", 2660, 560);

        ctx.font = '900 76px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = pink;
        ctx.fillText("Though we are trapped", 2660, 660);
        ctx.fillText("We are trapped ah", 2660, 740);

        // Right dashed boundary wall & impact house
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(3740, 40); ctx.lineTo(3740, 1080);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair reticle
        drawCross(ctx, 3740, 480, 14);

        // Pink house hitting against boundary with white motion blur streak
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(3620, 420, 30, 120);
        drawHouse(ctx, 3680, 480, 110, 140, true, pink, 125);
        ctx.restore();
      }

      // Bottom EXECUTION: Checkered / halftone black pattern with white outline
      ctx.save();
      ctx.font = '900 120px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeText("EXECUTION", 2660, 1035);

      ctx.fillStyle = getDotPattern(ctx);
      ctx.fillText("EXECUTION", 2660, 1035);
      ctx.restore();

      ctx.font = '22px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText("world.runExecution() · never runs", 2660, 1070);
    }
  });
}

/**
 * CARD 13: Academic Chapter 1 (179.0s - 188.0s)
 */
export function renderCard13(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    ctx.font = 'bold 44px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("CHAPTER 1", 90, 120);

    ctx.font = '900 84px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    if (t < 180.0 && t < 198.0) {
      ctx.fillText("I've studied how to", 90, 220);
    } else {
      ctx.fillText("I've studied how to properly", 90, 220);
    }

    // Large LO-O-OVE beneath lyrics (only at 180s+)
    if (t >= 180.0 || t >= 198.0) {
      ctx.font = '900 96px -apple-system, BlinkMacSystemFont, "Impact", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.fillText("LO-O-OVE", 90, 360);
    }

    // Dividing hairline
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 480); ctx.lineTo(1840, 480);
    ctx.stroke();

    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText('me.learnTopic("love");', 1820, 520);
    ctx.fillText('GodDrinksJava, line 121', 1820, 550);
    ctx.textAlign = 'left';

    // Left Column
    ctx.font = 'bold 36px "Times New Roman", serif';
    ctx.fillText("1.1  Lovable things", 90, 570);
    ctx.font = '24px "Times New Roman", serif';
    ctx.fillText("Every thing in World(5) is made by the same call, new Lovable(name, 0, b,", 90, 620);
    ctx.fillText("-1, false); me and you differ in a single bit, b.", 90, 655);

    // Boxed Definition
    ctx.strokeRect(90, 690, 890, 200);
    ctx.fillStyle = isMonochrome ? 'rgba(0,0,0,0.1)' : 'rgba(231, 31, 116, 0.2)';
    ctx.fillRect(96, 698, 878, 55);

    ctx.font = 'italic 26px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("Definition 1.1 (Love).  For things me ≠ you in one world, love is the sum of", 110, 735);
    ctx.fillText("what me gives you:", 110, 775);

    ctx.font = '38px "Times New Roman", serif';
    ctx.fillText("love(me, you) = ∑ ak(me → you)             (1.1)", 150, 840);

    ctx.font = '22px "Times New Roman", serif';
    ctx.fillText("Each gift is an attribute of me: a dimension, a circumference, a tangent, a limit.", 90, 930);

    // Right Column
    const rColX = 1060;
    ctx.font = 'bold 36px "Times New Roman", serif';
    ctx.fillText("1.2  Conservation", rColX, 570);
    ctx.fillStyle = isMonochrome ? 'rgba(0,0,0,0.1)' : 'rgba(231, 31, 116, 0.2)';
    ctx.fillRect(rColX, 595, 780, 38);
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'italic 24px "Times New Roman", serif';
    ctx.fillText("Proposition 1.2.  Every gift is reset in its giver:", rColX + 15, 622);
    ctx.font = '32px "Times New Roman", serif';
    ctx.fillText("you.addAttribute(a)  =>  me.reset(a)             (1.2)", rColX + 40, 680);

    ctx.font = 'bold 36px "Times New Roman", serif';
    ctx.fillText("1.3  Limits", rColX, 750);
    ctx.fillStyle = isMonochrome ? 'rgba(0,0,0,0.1)' : 'rgba(231, 31, 116, 0.2)';
    ctx.fillRect(rColX, 775, 780, 38);
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'italic 24px "Times New Roman", serif';
    ctx.fillText("Theorem 1.3.  The sequence of me converges to you, the limit is never attained:", rColX + 15, 802);
    ctx.font = '32px "Times New Roman", serif';
    ctx.fillText("lim an = you,    an ≠ you                         (1.3)", rColX + 40, 860);

    ctx.font = 'italic 22px "Times New Roman", serif';
    ctx.fillText("Exercises.  1.1 Compute world.getThingIndex(you).   1.2 Is love symmetric?", rColX, 930);
    ctx.font = 'bold 24px "Times New Roman", serif';
    ctx.textAlign = 'right';
    ctx.fillText("1", 1840, 1060);
    ctx.textAlign = 'left';
  });
}

/**
 * CARD 14: Examination Paper (188.0s - 194.0s)
 */
export function renderCard14(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    ctx.font = 'bold 44px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("EXAMINATION", 100, 80);

    ctx.font = '22px "Courier New", monospace';
    ctx.fillText('122  me.takeExamTopic("love");', 100, 120);
    ctx.font = '20px "Times New Roman", serif';
    ctx.fillText('Candidate: me            Topic: "love"            Time allowed: 2 bars            Attempt every question.', 100, 160);

    // Boxed Score Stamp (top-right)
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(1620, 50, 200, 120);
    ctx.font = 'bold 18px -apple-system, Arial, sans-serif';
    ctx.fillText("SCORE", 1640, 80);
    if (t >= 183.65) {
      ctx.font = '900 72px -apple-system, Arial, sans-serif';
      ctx.fillText("100", 1660, 150);
    }

    // Dividing hairline
    ctx.beginPath();
    ctx.moveTo(80, 190); ctx.lineTo(1840, 190);
    ctx.stroke();

    // Staggered Question Lyrics
    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    if (t < 182.0) {
      ctx.fillText("Question", 100, 270);
    } else if (t < 183.0) {
      ctx.fillText("Question me I", 100, 270);
    } else {
      ctx.fillText("Question me I can answer all", 100, 270);
    }

    const questions = [
      { q: "1.  What did me give you?", opts: ["a dimension", "a circumference", "a tangent", "a limit"] },
      { q: "2.  Which of these is me?", opts: ["a point set", "a circle", "a sine wave", "a sequence"] },
      { q: "3.  What else is me?", opts: ["an eggplant", "a tomato", "a tabby cat", "god"] },
      { q: "4.  What is left of me after a gift?", opts: ["0", "a point", "a centre", "not detected"] },
      { q: "5.  Where is you?", opts: ["-1", "removed", "unlocked", "free"] }
    ];

    questions.forEach((item, idx) => {
      const qy = 350 + idx * 95;
      ctx.font = 'bold 26px "Times New Roman", serif';
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(item.q, 100, qy);

      item.opts.forEach((opt, b) => {
        const bx = 840 + b * 250;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, qy - 26, 28, 28);

        // Checkmarks: only Q1 and Q2 are fully checked; Q3 only eggplant
        let isChecked = false;
        let isDot = false;

        if (idx === 0 && t >= 182.00) {
          isChecked = true;
        } else if (idx === 1 && t >= 182.41) {
          isChecked = true;
        } else if (idx === 2 && t >= 182.82) {
          if (b === 0) isChecked = true;
          else if (b === 1) isDot = true;
        }

        if (isChecked) {
          ctx.font = 'bold 28px -apple-system, Arial, sans-serif';
          ctx.fillStyle = pink;
          ctx.fillText("✓", bx + 3, qy - 2);
        } else if (isDot) {
          ctx.fillStyle = pink;
          ctx.beginPath();
          ctx.arc(bx + 14, qy - 12, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = '22px "Times New Roman", serif';
        ctx.fillStyle = COLORS.ink;
        ctx.fillText(opt, bx + 38, qy - 4);
      });
    });

    // Question 6: Define love.
    ctx.font = 'bold 26px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("6.  Define love.", 100, 840);
    ctx.beginPath();
    ctx.moveTo(340, 845); ctx.lineTo(1840, 845);
    ctx.stroke();

    // Pink LO-O-OVE Stamp (bottom right, 8th note hit)
    if (t >= 183.24) {
      ctx.font = '900 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = pink;
      ctx.textAlign = 'right';
      ctx.fillText("LO-O-OVE", 1840, 1040);
      ctx.textAlign = 'left';
    }
  });
}

/**
 * CARD 15: Grand Algebraic Expression (194.0s - 199.5s)
 */
export function renderCard15(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 1920, 1120);

    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('123  me.getAlgebraicExpression("love");', 100, 100);

    ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("I know the algebraic expression of", 100, 200);

    // Terms
    ctx.font = '48px "Times New Roman", serif';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("dim(me) + 2πr + y'(xyou) + lim an    // return value discarded", 140, 310);
    ctx.fillText("+ ∑ nutrients + C40H56 + 25 Hz + ■", 140, 440);

    ctx.font = '26px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText("§03 fig. 1      §03 fig. 2      §03 fig. 3      §03 fig. 4", 160, 355);
    ctx.fillText("§06 eggplant    §06 lycopene    §06 purr()      §06 proof", 190, 485);

    ctx.font = '900 110px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("= LO-O-OVE", 140, 630);

    // Strikethrough lines (at 187.0s+)
    if (t >= 187.0) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 10;
      ctx.beginPath();
      // Line 1: stops right after lim an, leaving // return value discarded clean
      ctx.moveTo(120, 295); ctx.lineTo(840, 295);
      // Line 2: stops right after ■ proof block
      ctx.moveTo(120, 425); ctx.lineTo(880, 425);
      // Line 3: strikes through = LO-O-OVE
      ctx.moveTo(120, 595); ctx.lineTo(880, 595);
      ctx.stroke();
    }

    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText('124  me.escape("love");', 100, 720);

    ctx.font = '900 60px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.fillText("I am trapped Trapped in", 100, 800);

    const pulse = 1.0 + Math.sin(t * 12.0) * 0.04;
    ctx.save();
    ctx.translate(960, 1020);
    ctx.scale(pulse, pulse);
    ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = pink;
    ctx.textAlign = 'center';
    ctx.fillText("LO-O-OVE", 0, 0);
    ctx.restore();
  });
}

/**
 * CARD 16: Finale Card (Double Card: 3840x1120) (198.5s - 213.0s)
 */
export function renderCard16(ctx, t, rect, isMonochrome = false) {
  wrapCard(ctx, rect, () => {
    const pink = isMonochrome ? COLORS.ink : COLORS.magenta;

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, 3840, 1120);

    ctx.fillStyle = COLORS.ink;
    ctx.font = '900 170px "Courier New", monospace';

    const fullStr = "world.execute(me);";
    const fullWidth = ctx.measureText(fullStr).width;
    const startX = 1920 - fullWidth / 2;
    const baselineY = 600;

    let chars = 0;
    if (t >= 198.0) {
      // Types across 198.0s - 202.5s
      chars = Math.min(fullStr.length, Math.floor((t - 198.0) * 4.0));
    } else if (t === 0) {
      chars = fullStr.length;
    }

    const typedStr = fullStr.substring(0, chars);
    ctx.textAlign = 'left';
    ctx.fillText(typedStr, startX, baselineY);

    // Pink blinking block cursor between 198.0s and 205.0s (locked to 8th notes)
    if (t >= 198.0 && t <= 205.0) {
      const isCursorBlinkOn = Math.floor(getMusicBeat(t) * 2.0) % 2 === 0;
      if (isCursorBlinkOn) {
        const typedWidth = ctx.measureText(typedStr).width;
        const charW = ctx.measureText("w").width;
        ctx.fillStyle = pink;
        ctx.fillRect(startX + typedWidth + 4, baselineY - 135, charW * 0.85, 155);
      }
    }
  });
}
