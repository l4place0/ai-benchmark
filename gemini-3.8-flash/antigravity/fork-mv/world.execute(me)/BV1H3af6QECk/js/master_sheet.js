/**
 * Master Imposition Sheet Renderer
 * Coordinates the full 16-card layout, registration marks,
 * typography header, footer, and print plates.
 */

import {
  GRID,
  getCardCenter
} from './timeline.js';

import {
  COLORS,
  drawCross,
  drawCropMarks,
  renderCard0,
  renderCard1,
  renderCard2,
  renderCard3,
  renderCard4,
  renderCard5,
  renderCard6,
  renderCard7,
  renderCard8,
  renderCard9,
  renderCard10,
  renderCard11,
  renderCard12,
  renderCard13,
  renderCard14,
  renderCard15,
  renderCard16
} from './cards.js';

const CARD_RENDERERS = [
  renderCard0,
  renderCard1,
  renderCard2,
  renderCard3,
  renderCard4,
  renderCard5,
  renderCard6,
  renderCard7,
  renderCard8,
  renderCard9,
  renderCard10,
  renderCard11,
  renderCard12,
  renderCard13,
  renderCard14,
  renderCard15,
  renderCard16
];

// Activation timestamps for cards (when they become populated on the sheet)
const CARD_ACTIVATION_TIMES = [
  0.0,    // Card 0
  16.0,   // Card 1
  29.5,   // Card 2
  44.4,   // Card 3
  58.0,   // Card 4
  74.0,   // Card 5
  88.5,   // Card 6
  103.5,  // Card 7
  117.2,  // Card 8
  133.5,  // Card 9
  147.0,  // Card 10
  159.0,  // Card 11
  162.0,  // Card 12
  179.0,  // Card 13
  180.8,  // Card 14
  184.6,  // Card 15
  198.0   // Card 16 (Finale)
];

export function renderMasterSheet(ctx, t) {
  const isMonochrome = t >= 209.50;

  // 1. Fill entire master paper background
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, GRID.sheetWidth, GRID.sheetHeight);

  // 2. Top Header: world.execute(me);
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  
  // Track kerning for letter spaced title across the entire 1800px width
  const chars = ["w", "o", "r", "l", "d", ".", "e", "x", "e", "c", "u", "t", "e", "(", "m", "e", ")", ";"];
  const startX = GRID.startX + 25; // 85
  const endX = GRID.startX + GRID.cardWidth * 5 - 25; // 1835
  const stepX = (endX - startX) / (chars.length - 1);
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, startX + idx * stepX, 110);
  });

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText("new World(5);", GRID.startX + 2, 134);

  // Technical argument annotation above (me)
  const meCenter = startX + 14.5 * stepX;
  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = 'rgba(24, 23, 25, 0.6)';
  ctx.fillText("argument : Thing", meCenter - 55, 52);
  ctx.strokeStyle = 'rgba(24, 23, 25, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(meCenter - 60, 56);
  ctx.lineTo(meCenter + 70, 56);
  ctx.stroke();

  // Top registration targets
  drawCross(ctx, GRID.startX - 30, 95, 8);
  drawCross(ctx, GRID.startX + GRID.cardWidth * 5 + 30, 95, 8);
  ctx.restore();

  // 3. Grid hairlines
  ctx.strokeStyle = COLORS.faint;
  ctx.lineWidth = 1;
  for (let r = 0; r <= 4; r++) {
    const gy = GRID.startY + r * GRID.cardHeight;
    ctx.beginPath();
    ctx.moveTo(GRID.startX, gy);
    ctx.lineTo(GRID.startX + GRID.cardWidth * 5, gy);
    ctx.stroke();
  }
  for (let c = 0; c <= 5; c++) {
    const gx = GRID.startX + c * GRID.cardWidth;
    ctx.beginPath();
    ctx.moveTo(gx, GRID.startY);
    ctx.lineTo(gx, GRID.startY + GRID.cardHeight * 4);
    ctx.stroke();
  }

  // 4. Render 17 Cards
  for (let i = 0; i < 17; i++) {
    const cardInfo = getCardCenter(i);
    const rect = cardInfo.rect;

    // Card is only rendered if its activation time has passed
    if (t >= CARD_ACTIVATION_TIMES[i]) {
      CARD_RENDERERS[i](ctx, t, rect, isMonochrome);
    } else {
      // Empty card outline
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      drawCropMarks(ctx, rect.x, rect.y, rect.w, rect.h);
    }

    // Border hairlines
    ctx.strokeStyle = COLORS.faint;
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  // 5. Grid Intersection Registration Marks
  for (let col = 0; col <= 5; col++) {
    for (let row = 0; row <= 4; row++) {
      const gx = GRID.startX + col * GRID.cardWidth;
      const gy = GRID.startY + row * GRID.cardHeight;
      drawCross(ctx, gx, gy, 5);
    }
  }

  // 6. Bottom Footer: And let's begin the S I M U L A T I O N
  ctx.save();
  const pink = isMonochrome ? COLORS.ink : COLORS.magenta;
  ctx.font = 'bold 20px -apple-system, Arial, sans-serif';
  ctx.fillStyle = pink;
  ctx.textAlign = 'left';
  ctx.fillText("And let's begin the", GRID.startX, 1030);

  // Spaced SIMULATION letters
  ctx.font = '900 32px -apple-system, Arial, sans-serif';
  ctx.fillStyle = COLORS.ink;
  const simLetters = ['S', 'I', 'M', 'U', 'L', 'A', 'T', 'I', 'O', 'N'];
  const startSimX = GRID.startX + 280;
  const simStep = (GRID.cardWidth * 5 - 280) / (simLetters.length - 1);
  simLetters.forEach((letter, idx) => {
    ctx.fillText(letter, startSimX + idx * simStep, 1033);
  });
  ctx.restore();
}
