/**
 * Japanese Vocaloid Kinetic FX & Visual Motifs Engine (Screen-Space Layer)
 * 
 * Deeply anchored to Mili's "world.execute(me);" lyrics, emotional arc, and narrative motifs:
 * - High-impact Kinetic Typography (文字杀 / Kanji & Kana Stabs / Ruby Furigana)
 * - Caution & Warning Hazard Tapes (立入禁止 / KEEP OUT / 脱出不能 / NO ESCAPE)
 * - Retro Japanese 90s OS Error & Genesis Dialogs (Windows 95 beveled UI)
 * - Teacher's Hanamaru Cherry Blossom Score Stamp (たいへんよくできました / 100点)
 * - Manga Halftone Screentones & Corner Tech Badges
 */

import { getMusicBeat, getBeatPhase, getRhythmicImpulse, getSubBeatImpulse } from './timeline.js';

// Color Palette for Modern Vocaloid Geek Aesthetic
export const VOCALOID_COLORS = {
  hazardYellow: '#FFDE00',
  hazardBlack: '#161616',
  neonPink: '#FF0077',
  deepBlue: '#0A25C9',
  cyan: '#00F0FF',
  bloodRed: '#E60012',
  stampRed: '#D91C24',
  pureWhite: '#FFFFFF',
  darkBg: '#121316',
  paper: '#F6F3EA'
};

/**
 * Draw diagonal caution hazard tape across screen space
 */
export function drawCautionTape(ctx, x, y, width, height, text = '立入禁止 // KEEP OUT // 警戒区域', angle = -0.08, bgCol = VOCALOID_COLORS.hazardYellow, fgCol = VOCALOID_COLORS.hazardBlack) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Tape background with drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = bgCol;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  ctx.shadowColor = 'transparent';

  // Hazard border lines
  ctx.fillStyle = fgCol;
  ctx.fillRect(-width / 2, -height / 2, width, 3);
  ctx.fillRect(-width / 2, height / 2 - 3, width, 3);

  // Bold repetitive warning text
  ctx.font = `900 ${Math.floor(height * 0.58)}px "Yu Gothic", "Meiryo", "MS Gothic", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const unitWidth = ctx.measureText(text + '       ').width;
  const count = Math.ceil(width / unitWidth) + 2;
  const startX = -(count * unitWidth) / 2;

  for (let i = 0; i < count; i++) {
    ctx.fillText(text, startX + i * unitWidth, 1);
  }

  ctx.restore();
}

/**
 * Draw classic Japanese 90s OS modal dialog box with 3D beveled borders
 */
export function drawSystemDialog(ctx, x, y, w, h, title, messageLines = [], buttons = ['OK'], alpha = 1.0, isFatal = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // Outer Window shadow
  ctx.fillStyle = 'rgba(10, 15, 25, 0.50)';
  ctx.fillRect(-w / 2 + 10, -h / 2 + 10, w, h);

  // Window body
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // 3D Beveled Window border
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();

  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();

  // Title bar
  const titleH = 30;
  ctx.fillStyle = isFatal ? '#8A0000' : '#000080';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, titleH);

  // Title text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px "Courier New", "MS Gothic", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, -w / 2 + 14, -h / 2 + 4 + titleH / 2);

  // Window close icon [X]
  const closeX = w / 2 - 28;
  const closeY = -h / 2 + 8;
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(closeX, closeY, 20, 20);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(closeX, closeY, 20, 20);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('×', closeX + 10, closeY + 10);

  // Message area with icon
  const iconX = -w / 2 + 42;
  const iconY = -h / 2 + 85;

  // Warning icon
  ctx.beginPath();
  ctx.arc(iconX, iconY, 18, 0, Math.PI * 2);
  ctx.fillStyle = isFatal ? VOCALOID_COLORS.bloodRed : VOCALOID_COLORS.hazardYellow;
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = '900 20px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isFatal ? '!' : '?', iconX, iconY + 1);

  // Message lines
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 15px "Yu Gothic", "MS Gothic", monospace';
  ctx.fillStyle = '#000000';

  messageLines.forEach((line, idx) => {
    ctx.fillText(line, -w / 2 + 80, -h / 2 + 60 + idx * 26);
  });

  // Buttons at bottom
  const btnW = 120;
  const btnH = 32;
  const totalBtnW = buttons.length * btnW + (buttons.length - 1) * 20;
  let curBtnX = -totalBtnW / 2;
  const btnY = h / 2 - 46;

  buttons.forEach((label) => {
    // Button body
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(curBtnX, btnY, btnW, btnH);

    // Beveled button border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curBtnX, btnY + btnH);
    ctx.lineTo(curBtnX, btnY);
    ctx.lineTo(curBtnX + btnW, btnY);
    ctx.stroke();

    ctx.strokeStyle = '#404040';
    ctx.beginPath();
    ctx.moveTo(curBtnX, btnY + btnH);
    ctx.lineTo(curBtnX + btnW, btnY + btnH);
    ctx.lineTo(curBtnX + btnW, btnY);
    ctx.stroke();

    // Button label
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px "Yu Gothic", "MS Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, curBtnX + btnW / 2, btnY + btnH / 2);

    curBtnX += btnW + 20;
  });

  ctx.restore();
}

/**
 * Draw screen-space kinetic Japanese typography with ruby furigana
 */
export function drawKineticKanji(ctx, text, ruby = null, x = 960, y = 540, size = 64, angle = 0.0, fillCol = VOCALOID_COLORS.neonPink, strokeCol = '#FFFFFF', scale = 1.0) {
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  if (scale !== 1.0) ctx.scale(scale, scale);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Crisp black drop shadow
  ctx.font = `900 ${size}px "Yu Gothic", "Meiryo", "MS Gothic", "Arial Black", sans-serif`;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillText(text, 4, 4);

  // High-contrast stroke
  if (strokeCol) {
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = Math.max(3, Math.floor(size * 0.10));
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, 0, 0);
  }

  // Vivid main fill
  ctx.fillStyle = fillCol;
  ctx.fillText(text, 0, 0);

  // Ruby annotation above text with crisp dark outline
  if (ruby) {
    const rubySize = Math.max(14, Math.floor(size * 0.22));
    ctx.font = `900 ${rubySize}px "Courier New", "MS Gothic", monospace`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(`[ ${ruby} ]`, 0, -size * 0.62);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`[ ${ruby} ]`, 0, -size * 0.62);
  }

  ctx.restore();
}

/**
 * Draw lower-third Vocaloid lyric capsule badge (Japanese + English)
 */
export function drawLyricBadge(ctx, jaText, enText, x = 960, y = 1005, accentCol = VOCALOID_COLORS.neonPink) {
  ctx.save();
  ctx.translate(x, y);

  // Measure content
  ctx.font = 'bold 26px "Yu Gothic", "Meiryo", "MS Gothic", sans-serif';
  const jaWidth = ctx.measureText(jaText).width;
  ctx.font = 'bold 13px "Courier New", monospace';
  const enWidth = ctx.measureText(enText).width;
  const contentW = Math.max(jaWidth, enWidth) + 60;
  const badgeW = Math.max(480, contentW);
  const badgeH = 58;

  // Background capsule with drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.60)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(16, 17, 20, 0.94)';
  ctx.fillRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);

  ctx.shadowColor = 'transparent';

  // Left neon accent bar
  ctx.fillStyle = accentCol;
  ctx.fillRect(-badgeW / 2, -badgeH / 2, 6, badgeH);

  // Top fine hairline
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(-badgeW / 2, -badgeH / 2, badgeW, 1);

  // Japanese main text
  ctx.font = '900 24px "Yu Gothic", "Meiryo", "MS Gothic", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(jaText, 0, -8);

  // English sub concept
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = accentCol;
  ctx.fillText(enText, 0, 16);

  ctx.restore();
}

/**
 * Draw stylized corner typography badge (Top-Right HUD style)
 */
export function drawCornerKanji(ctx, kanji, enLabel, x = 1750, y = 140, size = 56, col = VOCALOID_COLORS.neonPink) {
  ctx.save();
  ctx.translate(x, y);

  // Angled accent box
  ctx.fillStyle = 'rgba(16, 17, 20, 0.88)';
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(-80, -45, 160, 90);
  ctx.fillRect(-80, -45, 160, 90);

  // Main kanji
  ctx.font = `900 ${size}px "Yu Gothic", "MS Gothic", sans-serif`;
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kanji, 0, -8);

  // English concept tag
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`// ${enLabel}`, 0, 26);

  ctx.restore();
}

/**
 * Draw Japanese Teacher's Cherry Blossom Score Stamp (たいへんよくできました)
 */
export function drawHanamaruStamp(ctx, x, y, radius = 54, score = '100', text = 'たいへんよくできました', angle = -0.12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.strokeStyle = VOCALOID_COLORS.stampRed;
  ctx.fillStyle = VOCALOID_COLORS.stampRed;
  ctx.lineWidth = 4;

  // Outer scalloped cherry blossom petals
  const petals = 12;
  ctx.beginPath();
  for (let i = 0; i <= petals * 2; i++) {
    const a = (i * Math.PI) / petals;
    const r = i % 2 === 0 ? radius : radius * 0.84;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // Score
  ctx.font = '900 28px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(score, 0, -8);

  // Curved praise text
  ctx.font = 'bold 10px "Yu Gothic", "MS Gothic", sans-serif';
  ctx.fillText(text, 0, 18);

  ctx.restore();
}

/**
 * Master Screen-Space Vocaloid Overlay Orchestrator (1920x1080)
 * Deeply anchored to Mili's "world.execute(me);" lyrics, emotional arc, and narrative motifs.
 */
export function renderVocaloidScreenOverlays(ctx, t, width = 1920, height = 1080, cam = null) {
  const imp = getRhythmicImpulse(t, 5.0);
  const subBeat = getSubBeatImpulse(t, 6.0);

  // -------------------------------------------------------------------------
  // 1. INTRO & BOOTUP (0.0s ~ 16.5s)
  // "Switch on the power line / Remember to put on PROTECTION / Lay down your pieces / OBJECT CREATION / INITIALIZATION / SIMULATION"
  // -------------------------------------------------------------------------
  if (t < 16.5) {
    // 0s ~ 5.5s: Top-left warning caution tape crossing the screen
    if (t < 5.5) {
      drawCautionTape(ctx, 420, 150, 1300, 38, '電源投入 // PROTECTION // 電脳生命創造 // OBJECT CREATION', -0.10);
      drawLyricBadge(ctx, '電源投入：保護プロトコル起動', 'SWITCH ON THE POWER LINE // PUT ON PROTECTION', 960, 1010, VOCALOID_COLORS.neonPink);
    }
    // 10.8s ~ 15.5s: Retro Japanese OS boot modal popup dialog
    else if (t >= 10.8 && t < 15.5) {
      const alpha = Math.min(1.0, (t - 10.8) * 3);
      drawSystemDialog(
        ctx,
        1340,
        640,
        540,
        220,
        'SIMULATION_GENESIS.EXE',
        [
          '>> 世界パラメータ初期化完了 (INITIALIZATION)',
          '>> 存在定義: me = new Thing();',
          '>> 貴方のために【私】を生成しますか？'
        ],
        ['世界創造(Y)', '破棄(N)'],
        alpha,
        false
      );
    }
  }

  // -------------------------------------------------------------------------
  // 2. TITLE BANNER & VERSE 1 (16.83s ~ 28.5s)
  // "world.execute(me);" & "GodDrinksJava / creates an empty simulated world with no meaning or purpose."
  // -------------------------------------------------------------------------
  if (t >= 16.83 && t < 20.07) {
    // Opening big stab: World, execute me.
    const p = Math.min(1.0, (t - 16.83) * 4);
    const scale = 1.0 + 0.15 * (1.0 - p);
    drawKineticKanji(ctx, '世界よ、私を執行して', 'WORLD.EXECUTE(ME);', 960, 260, 72, -0.04, VOCALOID_COLORS.neonPink, '#FFFFFF', scale);
  } else if (t >= 20.07 && t < 28.5) {
    // Verse 1 GodDrinksJava
    if (t < 24.5) {
      drawLyricBadge(ctx, '神ハJavaヲ嗜ム：意味も目的も無き虚無世界', 'GOD DRINKS JAVA // EMPTY SIMULATED WORLD', 960, 1010, VOCALOID_COLORS.neonPink);
    } else {
      drawLyricBadge(ctx, '新世界構築中：パラメータ展開完了', 'SETTING UP OUR NEW WORLD // SIMULATION INIT', 960, 1010, VOCALOID_COLORS.hazardYellow);
    }
  }

  // -------------------------------------------------------------------------
  // 3. CARD 2: FOUR MATHEMATICAL OFFERINGS (29.30s ~ 44.07s)
  // "If I'm a set of points... DIMENSION / If I'm a circle... CIRCUMFERENCE / If I'm a sine wave... TANGENTS / If I approach infinity... LIMITATIONS"
  // -------------------------------------------------------------------------
  if (t >= 29.30 && t < 44.07) {
    if (t >= 29.30 && t < 33.20) {
      drawLyricBadge(ctx, '点集合の私：次元を貴方に捧ぐ', 'IF I AM A SET OF POINTS // GIVE YOU MY DIMENSION', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '次元', 'DIMENSION', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else if (t >= 33.20 && t < 36.33) {
      drawLyricBadge(ctx, '真円の私：円周を貴方に捧ぐ', 'IF I AM A CIRCLE // GIVE YOU MY CIRCUMFERENCE', 960, 70, VOCALOID_COLORS.deepBlue);
      drawCornerKanji(ctx, '円周', 'CIRCUMFERENCE', 1740, 150, 56, VOCALOID_COLORS.deepBlue);
    } else if (t >= 36.33 && t < 40.13) {
      drawLyricBadge(ctx, '正弦波の私：接線に腰掛けて', 'IF I AM A SINE WAVE // SIT ON MY TANGENTS', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '正弦', 'TANGENTS', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else if (t >= 40.13 && t < 44.07) {
      drawLyricBadge(ctx, '無限への極限：貴方は私の境界', 'IF I APPROACH INFINITY // BE MY LIMITATIONS', 960, 70, VOCALOID_COLORS.hazardBlack);
      drawCornerKanji(ctx, '極限', 'LIMITATIONS', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    }
  }

  // -------------------------------------------------------------------------
  // 4. VERSE 3: ELECTRICITY & CARTS (44.07s ~ 58.60s)
  // "Switch my current to AC to DC / blind my vision / So dizzy / So deeply unite"
  // -------------------------------------------------------------------------
  if (t >= 44.07 && t < 58.60) {
    if (t < 48.23) {
      drawLyricBadge(ctx, '電流切替：交流⇄直流', 'SWITCH MY CURRENT // AC ⇄ DC', 960, 70, VOCALOID_COLORS.neonPink);
    } else if (t < 51.50) {
      drawLyricBadge(ctx, '視界を奪って：暗転する意識', 'AND THEN BLIND MY VISION', 960, 70, '#666666');
    } else if (t < 55.00) {
      drawLyricBadge(ctx, '目眩く、目眩く眩暈の中で', 'SO DIZZY, SO DIZZY', 960, 70, VOCALOID_COLORS.neonPink);
    } else {
      drawLyricBadge(ctx, '深く、深く、ひとつに融け合って', 'SO DEEPLY, SO DEEPLY UNITE', 960, 70, VOCALOID_COLORS.deepBlue);
    }
  }

  // -------------------------------------------------------------------------
  // 5. CHORUS 1: STIMULATIONS & SATISFACTION (59.20s ~ 73.57s)
  // "If I can give you all the STIMULATIONS / SATISFACTION / EXECUTION / strange SIMULATION"
  // -------------------------------------------------------------------------
  if (t >= 59.20 && t < 73.57) {
    if (t < 63.50) {
      drawLyricBadge(ctx, '全ての刺激を貴方にあげられるなら', 'IF I CAN GIVE YOU ALL THE STIMULATIONS', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '刺激', 'STIMULATIONS', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else if (t < 67.00) {
      drawLyricBadge(ctx, '唯一の満足になれるでしょうか', 'THEN I CAN BE YOUR ONLY SATISFACTION', 960, 70, VOCALOID_COLORS.hazardYellow);
      drawCornerKanji(ctx, '満足', 'SATISFACTION', 1740, 150, 56, VOCALOID_COLORS.hazardYellow);
    } else if (t < 70.50) {
      drawLyricBadge(ctx, '貴方が幸せなら私を執行して', 'IF I CAN MAKE YOU HAPPY // RUN EXECUTION', 960, 70, VOCALOID_COLORS.bloodRed);
      drawCornerKanji(ctx, '執行', 'EXECUTION', 1740, 150, 56, VOCALOID_COLORS.bloodRed);
    } else {
      drawCautionTape(ctx, 960, 1025, 2200, 34, '閉塞隔離 // STRANGE SIMULATION // 脱出不能', 0.03);
      drawLyricBadge(ctx, '奇妙な檻に囚われて', 'TRAPPED IN THIS STRANGE SIMULATION', 960, 70, VOCALOID_COLORS.neonPink);
    }
  }

  // -------------------------------------------------------------------------
  // 6. VERSE 4: BIOLOGICAL ASSAYS (73.57s ~ 87.80s)
  // "Eggplant nutrients / Tomato antioxidants / Tabby cat purr / Only god proof of existence"
  // -------------------------------------------------------------------------
  if (t >= 73.57 && t < 87.80) {
    if (t < 77.43) {
      drawLyricBadge(ctx, '茄子の私：栄養を貴方に捧ぐ', 'IF I AM AN EGGPLANT // GIVE YOU NUTRIENTS', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '栄養', 'NUTRIENTS', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else if (t < 81.10) {
      drawLyricBadge(ctx, 'トマトの私：抗酸化を貴方に捧ぐ', 'IF I AM A TOMATO // GIVE YOU ANTIOXIDANTS', 960, 70, VOCALOID_COLORS.bloodRed);
      drawCornerKanji(ctx, '抗酸化', 'ANTIOXIDANTS', 1740, 150, 56, VOCALOID_COLORS.bloodRed);
    } else if (t < 84.43) {
      drawLyricBadge(ctx, '虎猫の私：喉を鳴らして歓喜を', 'IF I AM A TABBY CAT // PURR FOR YOUR ENJOYMENT', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '歓喜', 'ENJOYMENT', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else {
      drawLyricBadge(ctx, '貴方こそが私の存在証明', 'YOU ARE THE PROOF OF MY EXISTENCE', 960, 70, VOCALOID_COLORS.hazardYellow);
      drawCornerKanji(ctx, '存在証明', 'EXISTENCE', 1700, 150, 56, VOCALOID_COLORS.hazardYellow);
    }
  }

  // -------------------------------------------------------------------------
  // 7. VERSE 5: GENDER & ROLES (88.37s ~ 102.80s)
  // "Switch gender F to M / Do whatever with my body / Switch S to M / Enter the trance"
  // -------------------------------------------------------------------------
  if (t >= 88.37 && t < 102.80) {
    if (t < 92.00) {
      drawLyricBadge(ctx, '性別切替：女⇄男', 'SWITCH MY GENDER // F ⇄ M', 960, 70, VOCALOID_COLORS.neonPink);
    } else if (t < 95.70) {
      drawLyricBadge(ctx, 'この身体を好きにして', 'DO WHATEVER YOU LIKE WITH MY BODY', 960, 70, VOCALOID_COLORS.bloodRed);
    } else if (t < 99.20) {
      drawLyricBadge(ctx, '主従反転：支配⇄従順', 'SWITCH ROLE // S ⇄ M', 960, 70, VOCALOID_COLORS.neonPink);
    } else {
      drawLyricBadge(ctx, '恍惚の境地へ昇華する', 'AND WE CAN ENTER THE TRANCE', 960, 70, VOCALOID_COLORS.deepBlue);
    }
  }

  // -------------------------------------------------------------------------
  // 8. CHORUS 2: VIBRATIONS & COMPLETION (103.20s ~ 117.20s)
  // "Feel your completion / be vibrations / left me in isolation"
  // -------------------------------------------------------------------------
  if (t >= 103.20 && t < 117.20) {
    if (t < 106.30) {
      drawLyricBadge(ctx, '貴方の充足を感じられるなら', 'IF I CAN FEEL YOUR COMPLETION', 960, 70, VOCALOID_COLORS.neonPink);
      drawCornerKanji(ctx, '充足', 'COMPLETION', 1740, 150, 56, VOCALOID_COLORS.neonPink);
    } else if (t < 110.00) {
      drawLyricBadge(ctx, '私は振動そのものになる', 'THEN I CAN FINALLY BE VIBRATIONS', 960, 70, VOCALOID_COLORS.cyan);
      drawCornerKanji(ctx, '振動', 'VIBRATIONS', 1740, 150, 56, VOCALOID_COLORS.cyan);
    } else {
      drawCautionTape(ctx, 960, 60, 2200, 32, '孤独隔離 // YOU HAVE LEFT ME // ISOLATION // 棄却', -0.02);
      drawLyricBadge(ctx, '独り置き去りの孤独でも', 'THOUGH YOU HAVE LEFT ME IN ISOLATION', 960, 1010, VOCALOID_COLORS.hazardBlack);
    }
  }

  // -------------------------------------------------------------------------
  // 9. BRIDGE: PURGE & FATAL EXCEPTION (117.70s ~ 133.50s)
  // "Challenging your god / purge fragments / ILLEGAL ARGUMENTS"
  // -------------------------------------------------------------------------
  if (t >= 117.70 && t < 133.50) {
    if (t < 125.00) {
      drawLyricBadge(ctx, '無意味な断片を消去して', 'PURGE FRAGMENTS // CHALLENGING YOUR GOD', 960, 1010, VOCALOID_COLORS.neonPink);
    } else if (t < 129.50) {
      drawCautionTape(ctx, 960, 540, 2200, 48, '不正引数 // ILLEGAL_ARGUMENTS // 神への反逆 // EXCEPTION', -0.08);
      drawLyricBadge(ctx, 'もう見捨てられないように', 'SO THAT I WOULD NOT BE ABANDONED', 960, 1010, VOCALOID_COLORS.bloodRed);
    } else {
      const alpha = Math.min(1.0, (t - 129.50) * 4);
      drawSystemDialog(
        ctx,
        960,
        510,
        640,
        240,
        'FATAL_EXCEPTION_0x000000FF',
        [
          '>> 不正操作: 貴方は自らの神に刃を向けました',
          '>> SYSTEM HALTED: 存在証明の不整合',
          '>> 実行を強制終了しますか？'
        ],
        ['無視して続行', '執行 (EXECUTE)'],
        alpha,
        true
      );
    }
  }

  // -------------------------------------------------------------------------
  // 10. BUILD-UP: 40 COPIES (133.50s ~ 147.00s)
  // "Replication 40 copies"
  // -------------------------------------------------------------------------
  if (t >= 133.50 && t < 147.00) {
    const scale = 1.0 + 0.08 * subBeat;
    drawKineticKanji(ctx, '貴方の複製 × 40', 'REPLICATION 40 COPIES', 960, 910, 56, 0.0, VOCALOID_COLORS.neonPink, '#FFFFFF', scale);
    drawCautionTape(ctx, 960, 1045, 2200, 28, '増殖中 // REPLICATION IN PROGRESS // 40 COPIES // 準備完了', 0.0);
  }

  // -------------------------------------------------------------------------
  // 11. DROP CLIMAX 1: THE 12 EXECUTION STABS (147.00s ~ 155.00s)
  // 12 devoted surrender phrases synchronised on every drum kick stab!
  // -------------------------------------------------------------------------
  const STAB_LYRICS = [
    { t: 147.40, kanji: '私を執行', en: 'EXECUTE ME', idx: '01/12', rot: -0.08 },
    { t: 147.80, kanji: '貴方の為に', en: 'FOR YOU', idx: '02/12', rot: 0.08 },
    { t: 148.80, kanji: '身代わり', en: 'SACRIFICE', idx: '03/12', rot: -0.06 },
    { t: 149.73, kanji: '受け入れて', en: 'ACCEPT ME', idx: '04/12', rot: 0.07 },
    { t: 150.60, kanji: '全てを捧ぐ', en: 'GIVE MY ALL', idx: '05/12', rot: -0.07 },
    { t: 151.20, kanji: '消去承認', en: 'PURGE APPROVED', idx: '06/12', rot: 0.09 },
    { t: 151.57, kanji: '喜んで', en: 'WITH JOY', idx: '07/12', rot: -0.08 },
    { t: 152.50, kanji: '痛みをくれ', en: 'FEEL THE PAIN', idx: '08/12', rot: 0.06 },
    { t: 153.43, kanji: '愛の証', en: 'PROOF OF LOVE', idx: '09/12', rot: -0.07 },
    { t: 154.30, kanji: '壊して', en: 'BREAK ME', idx: '10/12', rot: 0.08 },
    { t: 155.00, kanji: '終わらせて', en: 'TERMINATE ME', idx: '11/12', rot: -0.09 },
    { t: 155.50, kanji: '処刑完了', en: 'EXECUTED', idx: '12/12', rot: 0.05 }
  ];

  if (t >= 147.00 && t < 155.50) {
    let activeStab = null;
    for (let i = STAB_LYRICS.length - 1; i >= 0; i--) {
      if (t >= STAB_LYRICS[i].t) {
        activeStab = STAB_LYRICS[i];
        break;
      }
    }

    if (activeStab) {
      const dt = t - activeStab.t;
      const decay = Math.exp(-9.0 * dt);
      const slamScale = 1.0 + 0.35 * decay;

      // Telemetry index at top
      ctx.save();
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = VOCALOID_COLORS.bloodRed;
      ctx.textAlign = 'center';
      ctx.fillText(`[ EXECUTION STAB ${activeStab.idx} ]`, 960, 310);
      ctx.restore();

      // Massive center kinetic slam
      drawKineticKanji(
        ctx,
        activeStab.kanji,
        activeStab.en,
        960,
        510,
        145,
        activeStab.rot,
        VOCALOID_COLORS.bloodRed,
        '#FFFFFF',
        slamScale
      );
    }
  }

  // -------------------------------------------------------------------------
  // 12. CLIMAX 2 COUNTDOWN: FORMAL NUMERALS (155.00s ~ 162.50s)
  // "EIN DOS TROIS 네 FEM 六 / EXECUTION"
  // -------------------------------------------------------------------------
  const COUNTDOWN_NUMERALS = [
    { t: 155.50, ja: '壱', lang: 'EIN : 独', col: VOCALOID_COLORS.neonPink },
    { t: 157.00, ja: '弐', lang: 'DOS : 西', col: VOCALOID_COLORS.deepBlue },
    { t: 158.50, ja: '参', lang: 'TROIS : 仏', col: VOCALOID_COLORS.neonPink },
    { t: 160.00, ja: '肆', lang: '네 : 韓', col: VOCALOID_COLORS.hazardYellow },
    { t: 161.00, ja: '伍', lang: 'FEM : 典', col: VOCALOID_COLORS.bloodRed },
    { t: 161.50, ja: '陸', lang: '六 : 漢', col: VOCALOID_COLORS.cyan },
    { t: 162.00, ja: '宣告：処刑', lang: 'EXECUTION : 命の停止', col: VOCALOID_COLORS.bloodRed }
  ];

  if (t >= 155.50 && t < 162.50) {
    let activeNum = null;
    for (let i = COUNTDOWN_NUMERALS.length - 1; i >= 0; i--) {
      if (t >= COUNTDOWN_NUMERALS[i].t) {
        activeNum = COUNTDOWN_NUMERALS[i];
        break;
      }
    }

    if (activeNum) {
      const dt = t - activeNum.t;
      const decay = Math.exp(-8.0 * dt);
      const scale = 1.0 + 0.25 * decay;
      drawKineticKanji(
        ctx,
        activeNum.ja,
        activeNum.lang,
        1560,
        340,
        activeNum.ja.length > 2 ? 60 : 110,
        0.04,
        activeNum.col,
        '#FFFFFF',
        scale
      );
    }
  }

  // -------------------------------------------------------------------------
  // 13. CARD 12 PANEL ARC & TRAPPED IN LOVE (162.50s ~ 178.50s)
  // "Give them execution / only one / Though we are trapped"
  // -------------------------------------------------------------------------
  if (t >= 162.50 && t < 178.50) {
    if (t < 166.82) {
      drawLyricBadge(ctx, '全てに死を配れるなら', 'IF I CAN GIVE THEM ALL THE EXECUTION', 960, 1010, VOCALOID_COLORS.bloodRed);
    } else if (t < 172.50) {
      drawLyricBadge(ctx, '貴方の唯一になれますか', 'THEN I CAN BE YOUR ONLY', 960, 1010, VOCALOID_COLORS.neonPink);
    } else {
      // Crossed caution hazard tapes across screen
      drawCautionTape(ctx, 960, 460, 2400, 48, '脱出不能 // NO ESCAPE // 閉塞隔離 // WE ARE TRAPPED', -0.11);
      drawCautionTape(ctx, 960, 600, 2400, 48, '囚われの愛 // TRAPPED IN LOVE // 永遠のシミュレーション', 0.09);

      // Center kinetic stab
      drawKineticKanji(ctx, '私たちは閉じ込められた', 'WE ARE TRAPPED IN THIS STRANGE SIMULATION', 960, 530, 68, 0.0, VOCALOID_COLORS.bloodRed, '#FFFFFF', 1.0 + 0.1 * imp);
      drawLyricBadge(ctx, '奇妙な檻の中で、永遠に', 'THOUGH WE ARE TRAPPED, WE ARE TRAPPED AH', 960, 1010, VOCALOID_COLORS.hazardYellow);
    }
  }

  // -------------------------------------------------------------------------
  // 14. OUTRO: LEARNING HOW TO LOVE & SIMULATION END (179.00s ~ 213.00s)
  // "Chapter 1 / Examination / Algebraic expression / world.execute(me);"
  // -------------------------------------------------------------------------
  if (t >= 179.00) {
    if (t < 180.80) {
      drawLyricBadge(ctx, '愛し方を学びました', 'CHAPTER 1: I HAVE STUDIED HOW TO PROPERLY LO-O-OVE', 960, 1010, VOCALOID_COLORS.neonPink);
    } else if (t < 184.60) {
      // Teacher's Cherry Blossom Score Stamp on examination paper (centered in Score box)
      drawHanamaruStamp(ctx, 1720, 120, 56, '100', 'たいへんよくできました', -0.12);
      drawLyricBadge(ctx, '満点の愛：貴方の問いに全て答えます', 'QUESTION ME I CAN ANSWER ALL // 100 POINTS', 960, 1005, VOCALOID_COLORS.stampRed);
    } else if (t < 198.00) {
      drawLyricBadge(ctx, '愛の代数方程式：解なし', 'I AM TRAPPED IN LO-O-OVE // NO ALGEBRAIC SOLUTION', 960, 1010, VOCALOID_COLORS.neonPink);
      if (t >= 186.00 && t < 193.00) {
        drawSystemDialog(
          ctx,
          1380,
          680,
          520,
          180,
          'ALGEBRAIC_ERROR',
          [
            '>> 感情「愛」の代数解なし (UNDEFINED)',
            '>> 貴方は自由、私は愛の虜',
            '>> I am trapped in LO-O-OVE'
          ],
          ['了解'],
          1.0,
          false
        );
      }
    } else {
      // 198.0s ~ 213.0s: Full Master Sheet pull-back & Monochrome finish
      // Top & bottom hazard borders framing the screen
      drawCautionTape(ctx, 960, 22, 2200, 28, '全シミュレーション終了 // YOUR WORLD CONTINUES // 貴方の世界は続く // 実験完了', 0.0);
      drawCautionTape(ctx, 960, 1058, 2200, 28, '全シミュレーション終了 // YOUR WORLD CONTINUES // 貴方の世界は続く // 実験完了', 0.0);

      if (t >= 204.00 && t < 210.00) {
        drawKineticKanji(ctx, '世界よ、私を執行して', 'WORLD.EXECUTE(ME);', 1420, 840, 36, 0.0, VOCALOID_COLORS.neonPink, '#FFFFFF', 1.0);
      }
    }
  }
}
