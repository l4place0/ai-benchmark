import * as THREE from 'three';

// Ensure roundRect compatibility for older browsers/webviews
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = typeof radii === 'number' ? radii : (radii[0] || 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

// Procedural Canvas Texture Generator for Japanese Anime Sakura Station
export class TextureGenerator {
  static createGradientRamp(stops = [
    { pos: 0.0, color: '#686a8a' }, // shadow: anime lavender-gray
    { pos: 0.45, color: '#686a8a' },
    { pos: 0.46, color: '#e6dfd8' }, // midtone: warm anime tone
    { pos: 0.88, color: '#e6dfd8' },
    { pos: 0.89, color: '#ffffff' }, // highlight: bright anime sun
    { pos: 1.0, color: '#ffffff' }
  ]) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    stops.forEach(s => grad.addColorStop(s.pos, s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  // 1. Classic Japanese Station Platform Signboard (駅名標)
  static createStationSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // White signboard background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 512);

    // Decorative inner border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 992, 480);

    // Sakura line color accent bar (Pink & Emerald band)
    ctx.fillStyle = '#ff7597';
    ctx.fillRect(24, 300, 976, 28);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(24, 328, 976, 10);

    // Japanese Hiragana on top
    ctx.font = 'bold 38px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('さ く ら が お か', 512, 110);

    // Japanese Kanji Station Name (桜ヶ丘)
    ctx.font = '900 120px "Hiragino Mincho ProN", "Yu Mincho", serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('桜 ヶ 丘', 512, 230);

    // English Romanized Name
    ctx.font = 'bold 36px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.letterSpacing = '4px';
    ctx.fillText('SAKURAGAOKA', 512, 280);

    // Previous Station (みどり町 / Midoricho) on left
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('◀  みどり町', 60, 390);
    ctx.font = '22px sans-serif';
    ctx.fillText('Midoricho', 95, 425);

    // Station Number badge on left
    ctx.fillStyle = '#ff7597';
    ctx.beginPath();
    ctx.roundRect(60, 445, 90, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SK-08', 105, 473);

    // Next Station (花園 / Hanazono) on right
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('花 園  ▶', 964, 390);
    ctx.font = '22px sans-serif';
    ctx.fillText('Hanazono', 940, 425);

    // Station Number badge on right
    ctx.fillStyle = '#ff7597';
    ctx.beginPath();
    ctx.roundRect(874, 445, 90, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SK-09', 919, 473);

    // Center symbol: stylized sakura blossom icon
    ctx.fillStyle = '#ff7597';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('🌸', 512, 420);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 2. Station Entrance Wooden/Navy Signboard (桜ヶ丘駅)
  static createStationEntranceSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Dark Japanese cedar wood / navy background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 256);

    // Gold/wood inner border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 992, 224);

    // Kanji
    ctx.font = '900 110px "Hiragino Mincho ProN", "Yu Mincho", serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText('桜  ヶ  丘  駅', 512, 140);

    // Romanji subtitle
    ctx.shadowBlur = 0;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#fcd34d';
    ctx.letterSpacing = '6px';
    ctx.fillText('SAKURAGAOKA STATION', 512, 205);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 3. Train Destination LED Sign ("快速 桜ヶ丘")
  static createTrainLEDTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Black matrix background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, 512, 128);

    // Dot grid subtle effect
    ctx.fillStyle = '#181820';
    for (let x = 4; x < 512; x += 8) {
      for (let y = 4; y < 128; y += 8) {
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Glowing Orange "快速" (Rapid) badge
    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.roundRect(24, 20, 130, 88, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('快速', 89, 82);

    // Glowing Green "桜ヶ丘" destination
    ctx.fillStyle = '#38ef7d';
    ctx.shadowColor = '#38ef7d';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 64px "Yu Gothic", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('桜 ヶ 丘', 180, 88);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 4. Japanese Road Markings: "止まれ" (Stop), Chevron, Pedestrian Diamond
  static createTomareRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep anime asphalt background
    ctx.fillStyle = '#373a42';
    ctx.fillRect(0, 0, 512, 1024);

    // Faint asphalt texture speckles
    ctx.fillStyle = '#424550';
    for (let i = 0; i < 600; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 1024, 3, 3);
    }

    // White edge lines
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, 0, 24, 1024);
    ctx.fillRect(468, 0, 24, 1024);

    // Bold Stop Line
    ctx.fillRect(20, 80, 472, 40);

    // Inverted Triangle Stop Boundary
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(70, 170);
    ctx.lineTo(442, 170);
    ctx.lineTo(256, 420);
    ctx.closePath();
    ctx.stroke();

    // Japanese Road Kanji: "止" then "ま" then "れ" (elongated for road perspective)
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'center';

    ctx.font = '900 160px sans-serif';
    ctx.save();
    ctx.translate(256, 560);
    ctx.scale(1.0, 1.3);
    ctx.fillText('止', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(256, 740);
    ctx.scale(1.0, 1.3);
    ctx.fillText('ま', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(256, 920);
    ctx.scale(1.0, 1.3);
    ctx.fillText('れ', 0, 0);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 5. Crosswalk Zebra Stripes
  static createCrosswalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Asphalt
    ctx.fillStyle = '#373a42';
    ctx.fillRect(0, 0, 512, 512);

    // White thick zebra stripes
    ctx.fillStyle = '#f8fafc';
    const stripeWidth = 64;
    const gap = 48;
    for (let y = 16; y < 512; y += stripeWidth + gap) {
      ctx.fillRect(24, y, 464, stripeWidth);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 6. Railway Crossing Stripes (Fumikiri Boom Pole Black & Yellow)
  static createFumikiriStripesTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#facc15'; // Vibrant Japanese crossing yellow
    ctx.fillRect(0, 0, 512, 64);

    ctx.fillStyle = '#1e1b18'; // Deep matte black
    const stripeW = 48;
    for (let x = -64; x < 512 + 64; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 32, 64);
      ctx.lineTo(x - 32, 64);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 7. Crossing Warning Crossbuck Sign ("踏切注意")
  static createCrossbuckSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 512, 512);

    // Yellow Diamond Warning Plate
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(256, 16);
    ctx.lineTo(496, 256);
    ctx.lineTo(256, 496);
    ctx.lineTo(16, 256);
    ctx.closePath();
    ctx.fill();

    // Inner Black Border
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(256, 36);
    ctx.lineTo(476, 256);
    ctx.lineTo(256, 476);
    ctx.lineTo(36, 256);
    ctx.closePath();
    ctx.stroke();

    // Japanese Train Silhouette Icon
    ctx.fillStyle = '#18181b';
    ctx.fillRect(170, 160, 172, 170);
    // Train roof curve
    ctx.beginPath();
    ctx.arc(256, 160, 86, Math.PI, 0);
    ctx.fill();
    // Windows
    ctx.fillStyle = '#eab308';
    ctx.fillRect(190, 180, 56, 60);
    ctx.fillRect(266, 180, 56, 60);
    // Headlights
    ctx.beginPath();
    ctx.arc(205, 290, 16, 0, Math.PI * 2);
    ctx.arc(307, 290, 16, 0, Math.PI * 2);
    ctx.fill();

    // Text: 踏切注意
    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('踏切注意', 256, 390);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 8. Japanese Vending Machine (4 Colorways: Red, Blue, White, Sakura Pink)
  static createVendingMachineTexture(theme = 'red') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const themes = {
      red: { body: '#dc2626', header: '#b91c1c', accent: '#ffffff', brand: 'BOSS COFFEE' },
      blue: { body: '#0284c7', header: '#0369a1', accent: '#38bdf8', brand: 'AQUA DRINKS' },
      white: { body: '#f1f5f9', header: '#3b82f6', accent: '#0f172a', brand: 'NATURAL WATER' },
      pink: { body: '#f472b6', header: '#db2777', accent: '#ffffff', brand: 'SAKURA SPECIAL' }
    };
    const t = themes[theme] || themes.red;

    // Outer Casing
    ctx.fillStyle = t.body;
    ctx.fillRect(0, 0, 512, 1024);

    // Bevel & Edges
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, 0, 512, 16);
    ctx.fillRect(0, 0, 16, 1024);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(496, 0, 16, 1024);
    ctx.fillRect(0, 1008, 512, 16);

    // Top Brand Canopy Area
    ctx.fillStyle = t.header;
    ctx.fillRect(24, 24, 464, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.brand, 256, 80);

    // Main Drink Display Window (Illuminated Glass)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, 130, 464, 460);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(32, 138, 448, 444);

    // 3 Rows of Drinks
    const rows = [
      { y: 150, type: 'coffee', hot: true },
      { y: 290, type: 'tea', hot: false },
      { y: 430, type: 'soda', hot: false }
    ];

    const drinkColors = [
      ['#78350f', '#b45309', '#15803d', '#1e40af'],
      ['#16a34a', '#84cc16', '#0284c7', '#fb7185'],
      ['#f97316', '#e11d48', '#38bdf8', '#a855f7']
    ];

    rows.forEach((row, rIdx) => {
      // Shelf support
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(36, row.y + 90, 440, 8);

      for (let col = 0; col < 4; col++) {
        const x = 55 + col * 110;
        const color = drinkColors[rIdx][col];

        // Drink Can/Bottle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, row.y, 40, 75, [6, 6, 2, 2]);
        ctx.fill();

        // Label highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x + 5, row.y + 10, 6, 55);

        // Price & Hot/Cold tag
        const isHot = (rIdx === 0 && col < 2) || (theme === 'pink' && col === 3);
        ctx.fillStyle = isHot ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(x - 4, row.y + 80, 48, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isHot ? 'あたたかい' : 'つめたい', x + 20, row.y + 93);

        // Push button
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x + 5, row.y + 102, 30, 14, 4);
        ctx.fill();
        ctx.stroke();

        // Glowing blue/red button light
        ctx.fillStyle = isHot ? '#f87171' : '#60a5fa';
        ctx.beginPath();
        ctx.arc(x + 20, row.y + 109, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Control & Coin Panel (Middle Right)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 610, 464, 160);

    // Coin slot & Bill slot
    ctx.fillStyle = '#475569';
    ctx.fillRect(60, 640, 12, 40); // Coin
    ctx.fillRect(90, 650, 70, 8); // Bill
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('硬貨/千円札', 60, 630);

    // Digital LED Price Display
    ctx.fillStyle = '#052e16';
    ctx.fillRect(190, 635, 90, 35);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('¥140', 270, 660);

    // IC Card Reader (Suica/Pasmo)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(310, 630, 80, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IC TOUCH', 350, 660);

    // Return Change Lever & Flap
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(60, 710, 60, 35, 6);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('おつり・返却', 90, 732);

    // Bottom Drink Retrieval Door (取り出し口)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(40, 790, 432, 170, 16);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(50, 800, 412, 150, 12);
    ctx.fill();

    // Push flap handle
    ctx.fillStyle = '#64748b';
    ctx.fillRect(140, 860, 232, 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PUSH  取出口', 256, 878);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 9. Japanese Traditional Wagashi Shop Noren (さくら堂)
  static createWagashiNorenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep Indigo blue cotton fabric background (藍色)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 1024, 512);

    // Fabric vertical seam gaps (3 panels)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(340, 200, 6, 312);
    ctx.fillRect(680, 200, 6, 312);

    // White traditional crest & Kanji
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';

    // Panel 1: "名物"
    ctx.font = 'bold 50px "Hiragino Mincho ProN", serif';
    ctx.fillText('名', 170, 240);
    ctx.fillText('物', 170, 320);
    ctx.font = '24px sans-serif';
    ctx.fillText('桜 餅', 170, 390);

    // Panel 2: Big Family Crest + "さくら堂"
    ctx.beginPath();
    ctx.arc(512, 180, 70, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();

    ctx.font = 'bold 60px serif';
    ctx.fillText('🌸', 512, 198);

    ctx.font = '900 80px "Hiragino Mincho ProN", serif';
    ctx.fillText('さくら堂', 512, 360);

    // Panel 3: "和菓子"
    ctx.font = 'bold 50px "Hiragino Mincho ProN", serif';
    ctx.fillText('御', 850, 200);
    ctx.fillText('菓', 850, 270);
    ctx.fillText('子', 850, 340);
    ctx.fillText('司', 850, 410);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 10. Convenience Store Signboard ("SPRING MART / 桜マート")
  static createConbiniSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Clean white fascia
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 256);

    // Tri-color stripes (Navy, Orange, Emerald green)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 1024, 30);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 30, 1024, 24);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 54, 1024, 16);

    // Logo & Kanji
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '900 86px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SPRING MART', 120, 165);

    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 44px "Yu Gothic", sans-serif';
    ctx.fillText('桜マート 24H', 124, 224);

    // Cherry Blossom Mascot Icon
    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 80px sans-serif';
    ctx.fillText('🌸', 30, 175);

    // Service Icons (ATM, 酒・たばこ, 銀行)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(830, 95, 150, 55, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATM 設置店', 905, 134);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('たばこ・酒・処方箋', 890, 200);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 11. Cafe Chalkboard Standee ("CAFE SAKURA 🌸")
  static createCafeChalkboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Dark slate blackboard
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(0, 0, 512, 768);

    // Wood frame border
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, 492, 748);

    // Chalk Header
    ctx.fillStyle = '#fce7f3';
    ctx.font = 'bold 46px "Brush Script MT", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('~ Cafe Sakura ~', 256, 90);

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('🌸 春の限定メニュー 🌸', 256, 140);

    // Separator line
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(60, 165);
    ctx.lineTo(452, 165);
    ctx.stroke();
    ctx.setLineDash([]);

    // Menu Items
    const menu = [
      { name: '桜ラテ (Sakura Latte)', price: '¥ 580', icon: '☕' },
      { name: '苺ショートケーキ', price: '¥ 620', icon: '🍰' },
      { name: '小倉トースト', price: '¥ 480', icon: '🍞' },
      { name: '自家焙煎珈琲', price: '¥ 450', icon: '☕' },
      { name: '抹茶パフェ', price: '¥ 720', icon: '🍨' }
    ];

    ctx.textAlign = 'left';
    menu.forEach((item, idx) => {
      const y = 230 + idx * 85;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${item.icon} ${item.name}`, 60, y);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(item.price, 452, y);
      ctx.textAlign = 'left';

      // Subtle chalk underline
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, y + 20);
      ctx.lineTo(452, y + 20);
      ctx.stroke();
    });

    // Bottom note
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 20px sans-serif';
    ctx.fillText('テイクアウト OK! (Take Out Available)', 256, 700);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 12. Cherry Blossom Festival & Town Posters (Bulletin Board)
  static createBulletinPosterTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Cork Bulletin Board Background
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, 1024, 512);

    // Left Poster: Sakura Festival 2026
    ctx.fillStyle = '#fff1f2';
    ctx.fillRect(40, 30, 440, 452);
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 30, 440, 452);

    ctx.fillStyle = '#e11d48';
    ctx.font = '900 42px "Yu Mincho", serif';
    ctx.textAlign = 'center';
    ctx.fillText('春の桜まつり', 260, 95);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('桜ヶ丘町会主催', 260, 135);

    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(260, 220, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '60px sans-serif';
    ctx.fillText('🌸', 260, 240);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('日時：4月上旬 毎日開催', 260, 320);
    ctx.fillText('場所：駅前広場＆河川敷', 260, 360);
    ctx.fillStyle = '#475569';
    ctx.font = '18px sans-serif';
    ctx.fillText('屋台・夜桜ライトアップ・野外演奏', 260, 405);
    ctx.fillText('皆様のお越しをお待ちしております', 260, 440);

    // Right Poster: Train Timetable & Neighborhood Map
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(540, 30, 440, 452);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 6;
    ctx.strokeRect(540, 30, 440, 452);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('桜ヶ丘駅 発車時刻表', 760, 80);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    const times = [
      '07: 02(急) 14 26(急) 38 50',
      '08: 03 15(急) 27 39(急) 52',
      '12: 05 20 35 50',
      '16: 08(急) 22 36(急) 50',
      '17: 04 18(急) 32 46(急)'
    ];
    times.forEach((t, i) => {
      ctx.fillText(t, 760, 130 + i * 36);
    });

    // Town Map graphic box
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(570, 310, 380, 150);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(570, 310, 380, 150);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('【周辺観光案内】 商店街・川堤・八幡神社', 760, 390);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 13. Japanese Stylized Artistic Manhole Cover (Cherry Blossom Motif)
  static createManholeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Outer Cast Iron Rim
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    // Tread notches
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const x1 = 256 + Math.cos(a) * 230;
      const y1 = 256 + Math.sin(a) * 230;
      const x2 = 256 + Math.cos(a) * 248;
      const y2 = 256 + Math.sin(a) * 248;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Inner painted circle (Deep turquoise blue)
    ctx.fillStyle = '#0e7490';
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.fill();

    // Japanese Water Waves
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    for (let r = 80; r <= 180; r += 30) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI);
      ctx.stroke();
    }

    // Sakura blossoms floating on water
    ctx.fillStyle = '#f472b6';
    const petals = [
      { x: 180, y: 180 }, { x: 330, y: 190 },
      { x: 220, y: 310 }, { x: 310, y: 320 },
      { x: 256, y: 220 }
    ];
    petals.forEach(p => {
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌸', p.x, p.y);
    });

    // Town Kanji: 下水道 (Sewerage)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('おすい (汚水)', 256, 420);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 14. Yellow Tactile Paving (点状警告タイル)
  static createTactilePavingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Japanese Safety Yellow
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle tile grout lines
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);

    // 4x4 Raised Warning Blister Dots
    ctx.fillStyle = '#eab308';
    for (let x = 32; x < 256; x += 64) {
      for (let y = 32; y < 256; y += 64) {
        // Shadow
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, 16, 0, Math.PI * 2);
        ctx.fill();

        // Dome highlight
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, 14, 0, Math.PI * 2);
        ctx.fill();

        // Main dome
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 15. Japanese Traditional Ceramic Roof Tiles (瓦)
  static createRoofTileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep slate blue-gray base
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    // Overlapping tile rows
    const rowHeight = 32;
    const tileWidth = 64;

    for (let y = 0; y < 512; y += rowHeight) {
      const offset = (y / rowHeight) % 2 === 0 ? 0 : tileWidth / 2;

      for (let x = -tileWidth; x < 512 + tileWidth; x += tileWidth) {
        const tx = x + offset;

        // Shadow at bottom of tile
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tx, y + rowHeight - 6, tileWidth, 6);

        // Highlight curve at top
        ctx.fillStyle = '#475569';
        ctx.fillRect(tx + 2, y, tileWidth - 4, rowHeight - 6);

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(tx + tileWidth / 2, y + rowHeight / 2, 12, 0, Math.PI);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
