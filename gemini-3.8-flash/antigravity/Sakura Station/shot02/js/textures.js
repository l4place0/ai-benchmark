/**
 * textures.js - High-detail programmatic canvas textures for Anime Cel-Shaded Sakura Station
 * Provides resolution-independent, authentic Japanese textures without external asset dependencies.
 */
import * as THREE from 'three';

// Cache generated textures
const textureCache = new Map();

/**
 * Helper to create a canvas and return a Three.js CanvasTexture
 */
function createCanvasTexture(width, height, drawFn, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 1. Road Asphalt Texture (Dark gray with subtle patches, fine speckles and wear)
 */
export function getAsphaltTexture() {
  if (textureCache.has('asphalt')) return textureCache.get('asphalt');
  const tex = createCanvasTexture(512, 512, (ctx, w, h) => {
    // Base dark anime asphalt
    ctx.fillStyle = '#30343a';
    ctx.fillRect(0, 0, w, h);

    // Subtle anime noise / color patches
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const radius = 2 + Math.random() * 6;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(58, 64, 72, 0.4)' : 'rgba(38, 42, 48, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // A subtle repair patch
    ctx.fillStyle = 'rgba(38, 42, 46, 0.6)';
    ctx.fillRect(80, 120, 160, 90);
    ctx.strokeStyle = 'rgba(25, 28, 32, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 120, 160, 90);

    // Weathering cracks
    ctx.strokeStyle = 'rgba(28, 31, 36, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(300, 200);
    ctx.lineTo(340, 240);
    ctx.lineTo(330, 280);
    ctx.lineTo(370, 310);
    ctx.stroke();
  }, 4, 8);
  textureCache.set('asphalt', tex);
  return tex;
}

/**
 * 2. Japanese Road Markings ("止まれ" Stop, Speed 30, Crosswalk, Tactile)
 */
export function getRoadMarkingTexture(type) {
  const key = `road_${type}`;
  if (textureCache.has(key)) return textureCache.get(key);

  let tex;
  if (type === 'tomare') {
    // "止まれ" Road Marking
    tex = createCanvasTexture(256, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f0f3f6';
      ctx.font = 'bold 90px "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Vertically stacked: 止 / ま / れ
      ctx.fillText('止', w / 2, 110);
      ctx.fillText('ま', w / 2, 255);
      ctx.fillText('れ', w / 2, 400);

      // White boundary stop bar at bottom
      ctx.fillRect(20, h - 35, w - 40, 25);
    });
  } else if (type === 'speed30') {
    // Speed limit 30 stenciled on road
    tex = createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f0f3f6';
      ctx.font = 'bold 130px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('30', w / 2, h / 2);
    });
  } else if (type === 'crosswalk') {
    // Pedestrian crosswalk stripes
    tex = createCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f5f7fa';
      // Thick zebra stripes
      for (let y = 15; y < h; y += 60) {
        ctx.fillRect(10, y, w - 20, 35);
      }
    });
  } else if (type === 'tactile') {
    // Yellow tactile paving dots / ribs for visually impaired (点字ブロック)
    tex = createCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f5bc28';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d49b13';
      const gap = 32;
      for (let x = 16; x < w; x += gap) {
        for (let y = 16; y < h; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, 4, 4);
  }
  textureCache.set(key, tex);
  return tex;
}

/**
 * 3. Station Signboards ("桜ヶ丘" Station Nameboard, Timetable, Map, Posters)
 */
export function getStationSignTexture(type) {
  const key = `station_${type}`;
  if (textureCache.has(key)) return textureCache.get(key);

  let tex;
  if (type === 'main_board') {
    // Classic JR-style Station Nameboard
    tex = createCanvasTexture(512, 192, (ctx, w, h) => {
      // White clean background
      ctx.fillStyle = '#fcfdfe';
      ctx.fillRect(0, 0, w, h);
      // Border
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      // Pink Sakura line bar in middle
      ctx.fillStyle = '#ff85a2';
      ctx.fillRect(6, 110, w - 12, 22);

      // Kanji station name
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 52px "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('桜 ヶ 丘', w / 2, 70);

      // Hiragana & Romaji
      ctx.font = 'bold 22px "Hiragino Sans", sans-serif';
      ctx.fillText('さくらがおか', w / 2, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('SAKURAGAOKA', w / 2, 126);

      // Previous & Next stations
      ctx.fillStyle = '#4a5568';
      ctx.font = 'bold 18px "Hiragino Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('◀ みどり町', 24, 160);
      ctx.font = '12px sans-serif';
      ctx.fillText('Midoricho', 42, 178);

      ctx.textAlign = 'right';
      ctx.font = 'bold 18px "Hiragino Sans", sans-serif';
      ctx.fillText('海岸通 ▶', w - 24, 160);
      ctx.font = '12px sans-serif';
      ctx.fillText('Kaigandori', w - 42, 178);
    });
  } else if (type === 'building_name') {
    // Wooden / Stucco carved entrance plaque "桜ヶ丘駅"
    tex = createCanvasTexture(384, 128, (ctx, w, h) => {
      ctx.fillStyle = '#3a281d';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a67c52';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.fillStyle = '#f7fafc';
      ctx.font = 'bold 50px "Yu Mincho", "Hiragino Mincho", serif';
      ctx.textAlign = 'center';
      ctx.fillText('桜ヶ丘駅', w / 2, 72);

      ctx.font = 'bold 16px sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('SAKURAGAOKA STATION', w / 2, 104);
    });
  } else if (type === 'poster_sakura') {
    // Spring Tourism Poster: "春の桜まつり"
    tex = createCanvasTexture(256, 384, (ctx, w, h) => {
      // Warm spring gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#fce4ec');
      grad.addColorStop(0.5, '#fff0f5');
      grad.addColorStop(1, '#e1f5fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Frame
      ctx.strokeStyle = '#f48fb1';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      // Big stylized Sakura flower
      ctx.fillStyle = 'rgba(255, 128, 171, 0.7)';
      ctx.beginPath();
      ctx.arc(w / 2, 140, 50, 0, Math.PI * 2);
      ctx.fill();

      // Heading
      ctx.fillStyle = '#ad1457';
      ctx.font = 'bold 30px "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('第28回', w / 2, 50);
      ctx.font = 'bold 36px "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.fillText('桜まつり', w / 2, 95);

      ctx.fillStyle = '#455a64';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('桜ヶ丘近郊鉄道で行く春の旅', w / 2, 230);

      ctx.fillStyle = '#d81b60';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('満開：4月上旬〜中旬', w / 2, 280);

      // Train silhouette at bottom
      ctx.fillStyle = '#78909c';
      ctx.fillRect(30, 320, 196, 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText('桜ヶ丘電鉄株式会社', w / 2, 342);
    });
  } else if (type === 'timetable') {
    // Suburban Train Timetable & Route Map
    tex = createCanvasTexture(256, 384, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);

      // Header
      ctx.fillStyle = '#1976d2';
      ctx.fillRect(4, 4, w - 8, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('時刻表 (平日・土休日)', w / 2, 30);

      // Grid lines
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 1;
      for (let y = 60; y < h - 40; y += 22) {
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#37474f';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      let hour = 6;
      for (let y = 75; y < h - 40; y += 22) {
        ctx.fillStyle = '#d32f2f';
        ctx.fillText(`${hour.toString().padStart(2, '0')}`, 15, y);
        ctx.fillStyle = '#37474f';
        ctx.fillText('05 18 27 39 48 56', 45, y);
        hour++;
      }

      // Footer
      ctx.fillStyle = '#eceff1';
      ctx.fillRect(4, h - 35, w - 8, 30);
      ctx.fillStyle = '#455a64';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('※荒天時は運行ダイヤ乱れにご注意下さい', w / 2, h - 16);
    });
  }
  textureCache.set(key, tex);
  return tex;
}

/**
 * 4. Shop Textures (Wagashi Noren, Convenience Store Fascia, Cafe Menu, Flower Shop)
 */
export function getShopTexture(type) {
  const key = `shop_${type}`;
  if (textureCache.has(key)) return textureCache.get(key);

  let tex;
  if (type === 'wagashi_noren') {
    // Traditional Japanese Wagashi Fabric Noren ("和菓子 さくら堂")
    tex = createCanvasTexture(512, 192, (ctx, w, h) => {
      // Soft Sakura fabric pink
      ctx.fillStyle = '#d85d77';
      ctx.fillRect(0, 0, w, h);

      // Slits in noren
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(128, 40, 4, h);
      ctx.fillRect(256, 40, 4, h);
      ctx.fillRect(384, 40, 4, h);

      // White calligraphy
      ctx.fillStyle = '#fffaf0';
      ctx.font = 'bold 44px "Yu Mincho", "Hiragino Mincho", serif';
      ctx.textAlign = 'center';
      ctx.fillText('和 菓 子', w / 2, 70);
      ctx.font = 'bold 36px "Yu Mincho", serif';
      ctx.fillText('さ く ら 堂', w / 2, 130);

      // Sakura crest
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(60, 96, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w - 60, 96, 30, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (type === 'conbini_fascia') {
    // Modern Convenience Store Signboard "DAILY POP"
    tex = createCanvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Orange and Green stripes
      ctx.fillStyle = '#ff7043';
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = '#42b883';
      ctx.fillRect(0, h - 28, w, 28);

      // Logo text
      ctx.fillStyle = '#1e293b';
      ctx.font = '900 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '4px';
      ctx.fillText('DAILY POP', w / 2, 82);

      // ATM & Liquor badge
      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('お酒・たばこ・ATM・銀行', w / 2, 118);
    });
  } else if (type === 'cafe_menu') {
    // Cafe Chalkboard Menu Easel
    tex = createCanvasTexture(256, 384, (ctx, w, h) => {
      // Dark slate chalkboard
      ctx.fillStyle = '#1f2421';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);

      // Chalk writing
      ctx.fillStyle = '#fff9db';
      ctx.font = 'italic bold 24px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE CERISIER', w / 2, 50);

      ctx.fillStyle = '#ffccd5';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('〜 春季限定メニュー 〜', w / 2, 85);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      ctx.fillText('☕ 桜カフェラテ ...... ¥550', 25, 135);
      ctx.fillText('🍓 苺のショートケーキ ... ¥620', 25, 175);
      ctx.fillText('🍵 宇治抹茶パフェ ...... ¥780', 25, 215);
      ctx.fillText('🍞 小倉ハニートースト ... ¥480', 25, 255);

      // Cute chalk sakura drawing
      ctx.fillStyle = 'rgba(255, 182, 193, 0.8)';
      ctx.beginPath();
      ctx.arc(w / 2, 320, 24, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (type === 'flower_sign') {
    // Flower Shop Sign "花日和 (Hanabiyori)"
    tex = createCanvasTexture(384, 128, (ctx, w, h) => {
      ctx.fillStyle = '#e8f5e9';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#81c784';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      ctx.fillStyle = '#2e7d32';
      ctx.font = 'bold 42px "Yu Mincho", serif';
      ctx.textAlign = 'center';
      ctx.fillText('Flower Shop 花日和', w / 2, 68);

      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#558b2f';
      ctx.fillText('季節の切り花・桜枝・観葉植物', w / 2, 102);
    });
  }
  textureCache.set(key, tex);
  return tex;
}

/**
 * 5. Vending Machine Drink Showcase Texture
 */
export function getVendingDisplayTexture(theme = 'boss') {
  const key = `vending_${theme}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const tex = createCanvasTexture(256, 384, (ctx, w, h) => {
    // Illuminated cooler interior
    ctx.fillStyle = '#eef6fc';
    ctx.fillRect(0, 0, w, h);

    // Shelves
    const rows = 3;
    const cols = 5;
    const rowH = 95;

    for (let r = 0; r < rows; r++) {
      const y = 30 + r * rowH;
      // Shelf rack line
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10, y + 65, w - 20, 4);

      for (let c = 0; c < cols; c++) {
        const x = 20 + c * 46;
        // Cans / bottles with varied colors
        const colors = [
          '#1e3a8a', // Boss Blue Coffee
          '#b91c1c', // Coca Red
          '#15803d', // Green Tea
          '#f43f5e', // Strawberry Milk
          '#eab308'  // Lemon Soda / Corn Soup
        ];
        const canColor = colors[(r * cols + c) % colors.length];

        // Drink can body
        ctx.fillStyle = canColor;
        ctx.fillRect(x, y + 10, 32, 50);

        // Can shiny highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x + 4, y + 10, 6, 50);

        // Cold / Hot indicator button
        const isHot = (r === 2 && c >= 3);
        ctx.fillStyle = isHot ? '#ef4444' : '#3b82f6';
        ctx.fillRect(x + 2, y + 68, 28, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isHot ? 'あたたかい' : 'つめたい', x + 16, y + 76);
      }
    }

    // Top brand marquee
    ctx.fillStyle = theme === 'coca' ? '#dc2626' : (theme === 'tea' ? '#166534' : '#1e40af');
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(theme === 'coca' ? 'SPRING REFRESH 🌸' : 'COFFEE & TEA SELECTION', w / 2, 19);
  });
  textureCache.set(key, tex);
  return tex;
}

/**
 * 6. Railroad Crossing Hazard Texture (Diagonal Yellow & Black stripes)
 */
export function getCrossingStripeTexture() {
  if (textureCache.has('crossing_stripe')) return textureCache.get('crossing_stripe');
  const tex = createCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffd600';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    // 45 degree diagonal bands
    for (let i = -w; i < w * 2; i += 32) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 - h, h);
      ctx.lineTo(i - h, h);
      ctx.closePath();
    }
    ctx.fill();
  }, 1, 8);
  textureCache.set('crossing_stripe', tex);
  return tex;
}

/**
 * 7. Train Textures (Destination rollsign, side stripes, windows)
 */
export function getTrainTexture(type) {
  const key = `train_${type}`;
  if (textureCache.has(key)) return textureCache.get(key);

  let tex;
  if (type === 'destination') {
    // LED Destination display "普通 桜ヶ丘"
    tex = createCanvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0a0d10';
      ctx.fillRect(0, 0, w, h);

      // Green & Orange LED style
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('普通', 20, 42);

      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 28px "Hiragino Sans", sans-serif';
      ctx.fillText('桜ヶ丘', 110, 43);
    });
  } else if (type === 'interior_silhouette') {
    // Backlit train window with passenger silhouettes
    tex = createCanvasTexture(256, 128, (ctx, w, h) => {
      // Warm interior cabin light
      ctx.fillStyle = '#fff4db';
      ctx.fillRect(0, 0, w, h);

      // Hand strap rails
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(w, 30);
      ctx.stroke();

      // Hanging rings
      for (let x = 30; x < w; x += 45) {
        ctx.beginPath();
        ctx.arc(x, 46, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Passenger silhouettes
      ctx.fillStyle = 'rgba(40, 50, 70, 0.45)';
      // Passenger 1
      ctx.beginPath();
      ctx.arc(70, 75, 16, 0, Math.PI * 2);
      ctx.rect(50, 91, 40, 40);
      ctx.fill();

      // Passenger 2 (reading a book)
      ctx.beginPath();
      ctx.arc(180, 78, 16, 0, Math.PI * 2);
      ctx.rect(160, 94, 40, 40);
      ctx.fill();
    });
  }
  textureCache.set(key, tex);
  return tex;
}

/**
 * 8. Japanese Manhole Cover with Sakura Blossoms (雨水 / 桜ヶ丘)
 */
export function getManholeTexture() {
  if (textureCache.has('manhole')) return textureCache.get('manhole');
  const tex = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Outer iron rim
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2);
    ctx.fill();

    // Inner plate
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
    ctx.fill();

    // Cherry petals embossed in center
    ctx.fillStyle = '#ffb3c6';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = w / 2 + Math.cos(angle) * 45;
      const py = h / 2 + Math.sin(angle) * 45;
      ctx.beginPath();
      ctx.arc(px, py, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px "Hiragino Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('桜ヶ丘市 雨水', w / 2, h / 2 + 6);
  });
  textureCache.set('manhole', tex);
  return tex;
}

/**
 * 9. Sakura Petal Shape Texture for Particles
 */
export function getPetalTexture() {
  if (textureCache.has('petal')) return textureCache.get('petal');
  const tex = createCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Soft realistic sakura petal with heart notch
    const grad = ctx.createRadialGradient(w / 2, h * 0.7, 4, w / 2, h * 0.5, 28);
    grad.addColorStop(0, '#ff6584'); // vibrant pink at base
    grad.addColorStop(0.6, '#ffaec0'); // soft cherry pink
    grad.addColorStop(1, '#fff5f8'); // gentle white-pink tips

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(32, 58); // base point
    ctx.bezierCurveTo(8, 45, 6, 20, 24, 10);
    ctx.bezierCurveTo(28, 8, 30, 16, 32, 18); // top cleft
    ctx.bezierCurveTo(34, 16, 36, 8, 40, 10);
    ctx.bezierCurveTo(58, 20, 56, 45, 32, 58);
    ctx.closePath();
    ctx.fill();
  });
  textureCache.set('petal', tex);
  return tex;
}
