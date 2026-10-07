// ============================================================================
// ACHROMA // SOVEREIGN - Complete Pixel Engine (game.js)
// 480x270 Native Virtual Pixel Canvas • Bitmap Pixel Art Sprites
// 100% Freeze-Proof Loop • 10 Detailed Weapons • The Monolith Boss
// ============================================================================

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. PALETTE & RASTER SPRITE CACHE ENGINE
    // -------------------------------------------------------------------------
    const CANVAS = document.getElementById('game-canvas');
    const CTX = CANVAS.getContext('2d');
    const MINIMAP_CANVAS = document.getElementById('minimap-canvas');
    const MINIMAP_CTX = MINIMAP_CANVAS.getContext('2d');

    const W = 480;
    const H = 270;
    CANVAS.width = W;
    CANVAS.height = H;

    // 6-Step Grayscale Base + Named Vibrant Accents
    const PALETTE = {
        '.': null,              // Transparent
        '0': '#050506',         // Darkest Void / Deepest Shadow
        '1': '#15151a',         // Charcoal Slate
        '2': '#2d2d38',         // Dark Armor
        '3': '#5a5a6e',         // Mid Steel
        '4': '#9898aa',         // Light Alloy
        '5': '#f5f5f7',         // Bright Plate / Highlights
        'c': '#00f5ff',         // Neon Cyan (Shields, Lasers, Visors)
        'r': '#ff0055',         // Crimson Red (Hostile Eyes, Crits, Lasers)
        'g': '#ffaa00',         // Amber Gold (EXP Ink, Chests, Cores)
        'o': '#ff6600',         // Flame Orange (Rockets, Blasts)
        'l': '#39ff14',         // Toxic Lime (Venom, Healing)
        'v': '#b537f2',         // Void Violet (Elites, Echoes)
        'f': '#a0e0ff',         // Frost Cyan (Ice, Freeze)
        'p': '#ff3399'          // Hot Pink (Plasma)
    };

    const col = (i) => PALETTE[String(Math.max(0, Math.min(5, i)))];
    const C = {
        cyan: '#00f5ff', red: '#ff0055', gold: '#ffaa00',
        orange: '#ff6600', lime: '#39ff14', violet: '#b537f2',
        frost: '#a0e0ff', pink: '#ff3399'
    };

    // Offscreen Canvas Pixel Sprite Generator & Cache
    const SPRITE_CACHE = {};
    function compileSprite(key, matrix, scale = 1) {
        if (SPRITE_CACHE[key]) return SPRITE_CACHE[key];

        const rows = matrix.length;
        const cols = matrix[0].length;
        const oc = document.createElement('canvas');
        oc.width = cols * scale;
        oc.height = rows * scale;
        const octx = oc.getContext('2d');

        for (let r = 0; r < rows; r++) {
            const line = matrix[r];
            for (let c = 0; c < cols; c++) {
                const char = line[c];
                const color = PALETTE[char];
                if (color) {
                    octx.fillStyle = color;
                    octx.fillRect(c * scale, r * scale, scale, scale);
                }
            }
        }

        SPRITE_CACHE[key] = oc;
        return oc;
    }

    // -------------------------------------------------------------------------
    // 2. HIGH-QUALITY PIXEL ART ASSET DEFINITIONS
    // -------------------------------------------------------------------------
    const PIXEL_ASSETS = {
        // Player: High-tech cyber operative with glowing visor & tactical suit
        player_idle: [
            '....00555500....',
            '...0555555550...',
            '..0550ccccc050..',
            '..0550ccccc050..',
            '..045555555540..',
            '...0234444320...',
            '..044555555440..',
            '.034455cc554430.',
            '.03445555554430.',
            '..034444444430..',
            '...0033cc3300...',
            '....033..330....',
            '...0240..0420...',
            '...0240..0420...',
            '..01330..03310..',
            '..00000..00000..'
        ],
        player_walk_1: [
            '....00555500....',
            '...0555555550...',
            '..0550ccccc050..',
            '..0550ccccc050..',
            '..045555555540..',
            '...0234444320...',
            '..044555555440..',
            '.034455cc554430.',
            '.03445555554430.',
            '..034444444430..',
            '...0033cc3300...',
            '...033....330...',
            '..0240....0420..',
            '.0240......0420.',
            '01330......03310',
            '00000......00000'
        ],
        player_walk_2: [
            '....00555500....',
            '...0555555550...',
            '..0550ccccc050..',
            '..0550ccccc050..',
            '..045555555540..',
            '...0234444320...',
            '..044555555440..',
            '.034455cc554430.',
            '.03445555554430.',
            '..034444444430..',
            '...0033cc3300...',
            '....033..330....',
            '....024..420....',
            '...0133..3310...',
            '...0000..0000...',
            '................'
        ],
        player_walk_3: [
            '....00555500....',
            '...0555555550...',
            '..0550ccccc050..',
            '..0550ccccc050..',
            '..045555555540..',
            '...0234444320...',
            '..044555555440..',
            '.034455cc554430.',
            '.03445555554430.',
            '..034444444430..',
            '...0033cc3300...',
            '...033....330...',
            '..0420....0240..',
            '.0420......0240.',
            '03310......01330',
            '00000......00000'
        ],
        player_walk_4: [
            '....00555500....',
            '...0555555550...',
            '..0550ccccc050..',
            '..0550ccccc050..',
            '..045555555540..',
            '...0234444320...',
            '..044555555440..',
            '.034455cc554430.',
            '.03445555554430.',
            '..034444444430..',
            '...0033cc3300...',
            '....033..330....',
            '...0240..0420...',
            '...0240..0420...',
            '..01330..03310..',
            '..00000..00000..'
        ],
        player_dash: [
            '......00555500..',
            '.....0555555550.',
            '....0550ccccc050',
            '...045555555540.',
            '..044555555440..',
            '.034455cc554430.',
            '03445555554430..',
            'cc034444444430..',
            '5cc0033cc3300...',
            '.5cc033..330....',
            '..0240....0420..',
            '.01330....03310.',
            '.0000......0000.'
        ],

        // Enemies
        scuttler_1: [
            '0..............0',
            '.00...0220...00.',
            '..00.024420.00..',
            '...0024rr4200...',
            '..0244rrrr4420..',
            '.02444rrrr44420.',
            '.03444444444430.',
            '..033444444330..',
            '0..0022222200..0',
            '00..0......0..00',
            '.0000......0000.',
            '..00........00..'
        ],
        scuttler_2: [
            '..0..........0..',
            '.00...0220...00.',
            '00...024420...00',
            '0..0024rr4200..0',
            '..0244rrrr4420..',
            '.02444rrrr44420.',
            '.03444444444430.',
            '..033444444330..',
            '.0.0022222200.0.',
            '00..0......0..00',
            '0....00..00....0',
            '......0000......'
        ],

        gunner: [
            '.....00333300...',
            '....0344444430..',
            '...034rrrrrr430.',
            '...034rrrrrr430.',
            '....0344444430..',
            '...023444444320.',
            '..02355555555320',
            '.023555555555530',
            '.023553333555530',
            '..02340000444320',
            '...033....3330..',
            '...024....420...',
            '..0240....0420..',
            '..0240....0420..',
            '.01330....03310.',
            '.00000....00000.'
        ],

        enforcer: [
            '......00222200....',
            '.....0234444320...',
            '....0234rrrr4320..',
            '...02344444444320.',
            '..023445555544320.',
            '.02344555555544320',
            '.02344555555544320',
            '023444555555544430',
            '023444444444444430',
            '.0233444444443320.',
            '..00233333333200..',
            '...0230....0320...',
            '..0240......0420..',
            '..0240......0420..',
            '.01330......03310.',
            '.01330......03310.',
            '000000......000000',
            '..................'
        ],
        enforcer_shield: [
            '0c5555c0',
            'c500005c',
            'c0cccc0c',
            'c0c55c0c',
            'c0c55c0c',
            'c0cccc0c',
            'c500005c',
            'c0cccc0c',
            'c0c55c0c',
            'c0c55c0c',
            'c0cccc0c',
            'c500005c',
            'c0cccc0c',
            'c0c55c0c',
            'c0c55c0c',
            'c0cccc0c',
            'c500005c',
            'c0cccc0c',
            'c500005c',
            '0c5555c0'
        ],

        sniper: [
            '....00222200....',
            '...0234444320...',
            '..02344rr44320..',
            '..02344rr44320..',
            '...0234444320...',
            '..012333333210..',
            '.01234444443210.',
            '.01234444443210.',
            '0123444444443210',
            '0123333333333210',
            '.01222222222210.',
            '..011......110..',
            '..024......420..',
            '..024......420..',
            '.0133......3310.',
            '.0133......3310.',
            '00000......00000',
            '................'
        ],

        // Boss: The Monolith (Keeper of Ash / 虚空方碑)
        monolith_body: [
            '..........0001111000..........',
            '........00112222221100........',
            '.......0122333333332210.......',
            '.....00123344444444332100.....',
            '....0123444555555554443210....',
            '...012344555555555555443210...',
            '..01234555500000000555543210..',
            '..012345500rrrrrrrr005543210..',
            '.01234550rrrrrrrrrrrr05543210.',
            '.0123450rrrrr0000rrrrr0543210.',
            '01234550rrrr055550rrrr05543210',
            '01234550rrr055cc550rrr05543210',
            '01234550rrr05cccc50rrr05543210',
            '01234550rrr05cccc50rrr05543210',
            '01234550rrr055cc550rrr05543210',
            '01234550rrrr055550rrrr05543210',
            '0123450rrrrr0000rrrrr05543210',
            '.01234550rrrrrrrrrrrr05543210.',
            '.012345500rrrrrrrr005543210..',
            '..01234555500000000555543210..',
            '..012344555555555555443210....',
            '...0123444555555554443210.....',
            '....0123344444444332100.......',
            '.....001223333333322100.......',
            '.......00112222221100.........',
            '..........0001111000..........'
        ],
        monolith_wing: [
            '00123455432100',
            '01234555543210',
            '012345rr543210',
            '01234rrrr43210',
            '.0123rrrr3210.',
            '.01234rr43210.',
            '..0123443210..',
            '..0123cc3210..',
            '...012cc210...',
            '...01233210...',
            '....012210....',
            '....012210....',
            '.....0110.....',
            '.....0110.....',
            '......00......',
            '..............'
        ],

        // Props & Pickups
        crate: [
            '0022222222222200',
            '0255555555555520',
            '2544444444444452',
            '254gg444444gg452',
            '25400gg44gg00452',
            '254400gg4gg00452',
            '2544400gg0044452',
            '25444400cc044452',
            '2544400gg0044452',
            '254400gg4gg00452',
            '25400gg44gg00452',
            '254gg444444gg452',
            '2544444444444452',
            '2533333333333352',
            '0255555555555520',
            '0022222222222200'
        ],
        barrel: [
            '..0022222200..',
            '.025555555520.',
            '02444444444420',
            '024oooooooo420',
            '024o000000o420',
            '024o0rrrr0o420',
            '024o00rr00o420',
            '024o00rr00o420',
            '024o0rrrr0o420',
            '024o000000o420',
            '024oooooooo420',
            '02444444444420',
            '02333333333320',
            '.025555555520.',
            '..0022222200..'
        ],
        chest: [
            '..002222222200..',
            '.025gggggggg520.',
            '025gggggggggg520',
            '02gggg0000gggg20',
            '02gggg0gg0gggg20',
            '0222220000222220',
            '0255555555555520',
            '02gggggggggggg20',
            '0244444444444420',
            '0233333333333320',
            '0222222222222220',
            '.00222222222200.'
        ],
        chest_open: [
            '..002222222200..',
            '.025gggggggg520.',
            '025gggggggggg520',
            '0222222222222220',
            '.00cccccccc00...',
            '..0c555555c0....',
            '025c555555c520..',
            '02gc555555cg20..',
            '0244444444444420',
            '0233333333333320',
            '0222222222222220',
            '.00222222222200.'
        ],
        heart_pickup: [
            '..000..000..',
            '.0lll00lll0.',
            '0lllll5llll0',
            '0llllllllll0',
            '0llllllllll0',
            '.0llllllll0.',
            '..0llllll0..',
            '...0llll0...',
            '....0ll0....',
            '.....00.....'
        ],
        ink_pickup: [
            '..0gg0..',
            '.0g55g0.',
            '0gg55gg0',
            '0gggggg0',
            '0gggggg0',
            '0gg00gg0',
            '.0gggg0.',
            '..0gg0..'
        ],

        // All 10 Distinct Weapons
        w_nail: [
            '.....0000000..',
            '....05555550c.',
            '..0055444450c.',
            '.03355400000..',
            '..03300.......',
            '..0220........',
            '..0000........'
        ],
        w_hail: [
            '...0000000000.',
            '..05555555550g',
            '.034444444430g',
            '0340000004400.',
            '030...0220....',
            '.0....0220....',
            '.....0220.....',
            '.....000......'
        ],
        w_scatter: [
            '..0000000000000.',
            '.05555555555550r',
            '044444444444440r',
            '044330000440000.',
            '.0330..0330.....',
            '..00...0220.....',
            '.......000......'
        ],
        w_rail: [
            '.0000000000000000c',
            '05555555555555550c',
            '044cccccccccccc40.',
            '04455555555544000.',
            '.033000000000.....',
            '..0220............',
            '..000.............'
        ],
        w_edge: [
            '............0c',
            '...........0cc',
            '..........0cc5',
            '.........0cc50',
            '........0cc50.',
            '.......0cc50..',
            '......0cc50...',
            '.....0cc50....',
            '....0cc50.....',
            '..000c50......',
            '.044000.......',
            '0330..........',
            '0220..........',
            '000...........'
        ],
        w_volt: [
            '....000000..0c',
            '..0055555500.c',
            '.0344c5c5c440c',
            '034c55cc55c40.',
            '0340000000440.',
            '.0330...0220..',
            '..00....0220..',
            '........000...'
        ],
        w_bloomer: [
            '....00000000000o',
            '...055555555550o',
            '..0444444444440o',
            '.03444444444440o',
            '034000000044000.',
            '030.....0220....',
            '.0......0220....',
            '........000.....',
            '................'
        ],
        w_halo: [
            '...00gggg00.',
            '..0gg5555gg0',
            '.0g55000055g',
            '0g5000gg000g',
            '0g500gggg05g',
            '0g50gggg005g',
            '0g500gggg05g',
            '0g5000gg000g',
            '.0g55000055g',
            '..0gg5555gg0',
            '...00gggg00.',
            '............'
        ],
        w_saw: [
            '....055500....',
            '..0554444550..',
            '.054400004450.',
            '05400333300450',
            '040033rr330040',
            '54033rrrr33045',
            '54033rrrr33045',
            '040033rr330040',
            '05400333300450',
            '.054400004450.',
            '..0554444550..',
            '....055500....',
            '..............',
            '..............'
        ],
        w_longbow: [
            '.......005500...',
            '.....00554400c..',
            '...0055400...c..',
            '..05540......c..',
            '.0540........c..',
            '0540...000...c..',
            '040...0gg00..c..',
            '040..0g55gg00c00',
            '040...0gg00..c..',
            '0540...000...c..',
            '.0540........c..',
            '..05540......c..',
            '...0055400...c..',
            '.....00554400c..',
            '.......005500...',
            '................'
        ]
    };

    // Pre-compile all raster assets
    for (const k in PIXEL_ASSETS) {
        compileSprite(k, PIXEL_ASSETS[k]);
    }

    // Helper: draw cached raster sprite
    function drawSprite(ctx, key, x, y, angle = 0, flipX = false, scale = 1, flipY = false, anchorX = 0.5, anchorY = 0.5) {
        const img = SPRITE_CACHE[key];
        if (!img) return;

        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        if (angle !== 0) ctx.rotate(angle);
        if (flipX) ctx.scale(-1, 1);
        if (flipY) ctx.scale(1, -1);
        ctx.drawImage(
            img,
            -Math.round(img.width * anchorX * scale),
            -Math.round(img.height * anchorY * scale),
            img.width * scale,
            img.height * scale
        );
        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 3. INPUT SYSTEM
    // -------------------------------------------------------------------------
    const Input = {
        keys: {},
        mx: 0, my: 0,
        worldX: 0, worldY: 0,
        down: false,
        rclicked: false,

        init() {
            window.addEventListener('keydown', (e) => {
                window.AU.ensureContext();
                this.keys[e.code] = true;

                if (e.key.toLowerCase() === 'm') {
                    const muted = window.AU.toggleMute();
                    document.getElementById('btn-sound').textContent = muted ? '音频: 静音' : '音频: 开启';
                }
                if (e.code === 'KeyQ') G.p.swapWeapon();
                if (e.code === 'KeyR') {
                    if (G.state === 'dead' || G.state === 'victory') G.restart();
                    else G.p.reload();
                }
                if (e.code === 'KeyE') G.p.tryInteract();
                if (e.code === 'KeyB') {
                    G.autoPlay = !G.autoPlay;
                    if (G.p) G.floatText(G.p.x, G.p.y - 20, G.autoPlay ? '战术AI代打: 开启' : '战术AI代打: 关闭', G.autoPlay ? C.cyan : C.red, 1.2);
                    window.AU.play('ui');
                }
                if (e.code === 'Digit1') G.state === 'card_select' ? G.chooseCard(0) : G.p.selectWeapon(0);
                if (e.code === 'Digit2') G.state === 'card_select' ? G.chooseCard(1) : G.p.selectWeapon(1);
                if (e.code === 'Digit3' && G.state === 'card_select') G.chooseCard(2);
            });

            window.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
            });

            window.addEventListener('mousemove', (e) => {
                const rect = CANVAS.getBoundingClientRect();
                this.mx = ((e.clientX - rect.left) / rect.width) * W;
                this.my = ((e.clientY - rect.top) / rect.height) * H;
                this.worldX = this.mx + G.cam.x;
                this.worldY = this.my + G.cam.y;
            });

            window.addEventListener('mousedown', (e) => {
                window.AU.ensureContext();
                if (e.button === 0) this.down = true;
                if (e.button === 2) {
                    this.rclicked = true;
                    G.p.dash();
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) this.down = false;
                if (e.button === 2) this.rclicked = false;
            });

            window.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) G.p.swapWeapon();
            });

            window.addEventListener('contextmenu', (e) => e.preventDefault());

            document.getElementById('btn-sound').addEventListener('click', () => {
                const muted = window.AU.toggleMute();
                document.getElementById('btn-sound').textContent = muted ? '音频: 静音' : '音频: 开启';
            });

            document.getElementById('btn-restart').addEventListener('click', () => G.restart());
        },

        isDown(code) {
            return !!this.keys[code];
        }
    };

    // -------------------------------------------------------------------------
    // 4. WEAPONS ARSENAL (10 DIVERSE ARCHETYPES)
    // -------------------------------------------------------------------------
    const WEAPONS = {
        nail: {
            id: 'nail', name: '战术钉枪', kind: 'gun', mag: 14, reload: 1.0,
            rate: 6.0, dmg: 8, spd: 360, spread: 0.04, n: 1, range: 420,
            proc: 1.0, knock: 60, recoil: 2, shake: 0.03, sfx: 'shoot', acK: 'cyan',
            spr: 'w_nail', desc: '高精度战术手枪，快速射出高穿透动能钉刺。'
        },
        hail: {
            id: 'hail', name: '冰雹冲锋枪', kind: 'gun', mag: 40, reload: 1.4,
            rate: 14.0, dmg: 3.5, spd: 400, spread: 0.15, n: 1, range: 380,
            proc: 0.5, knock: 25, recoil: 1, shake: 0.02, sfx: 'smg', acK: 'gold',
            spr: 'w_hail', desc: '极高射速的战术冲锋枪，近距离泼洒致命弹幕。'
        },
        scatter: {
            id: 'scatter', name: '重型霰弹枪', kind: 'gun', mag: 6, reload: 1.5,
            rate: 1.6, dmg: 5.5, spd: 320, spread: 0.32, n: 7, range: 280,
            proc: 0.6, knock: 160, recoil: 7, shake: 0.14, sfx: 'pellet', acK: 'red',
            spr: 'w_scatter', desc: '七连发重装弹丸，具有极强的近身击退与压制力。'
        },
        rail: {
            id: 'rail', name: '穿甲电磁炮', kind: 'rail', mag: 4, reload: 1.8,
            rate: 1.1, dmg: 35, range: 600, pierce: 99,
            proc: 1.0, knock: 180, recoil: 8, shake: 0.22, sfx: 'rail', acK: 'cyan',
            spr: 'w_rail', desc: '蓄能电磁轨道光束，贯穿直线上的所有障碍与敌军。'
        },
        edge: {
            id: 'edge', name: '逆流等离子刃', kind: 'melee', mag: 999, reload: 0,
            rate: 2.8, dmg: 20, range: 38, arc: 2.6, reflects: true,
            proc: 1.0, knock: 210, recoil: 0, shake: 0.06, sfx: 'slash', acK: 'cyan',
            spr: 'w_edge', desc: '高频等离子光刃，大范围横斩并可反弹敌方子弹！'
        },
        volt: {
            id: 'volt', name: '闪电特斯拉枪', kind: 'chain', mag: 10, reload: 1.3,
            rate: 3.2, dmg: 11, range: 320, chains: 4,
            proc: 0.7, knock: 35, recoil: 2, shake: 0.04, sfx: 'zap', acK: 'cyan',
            spr: 'w_volt', desc: '高压电弧发射器，命中后在多个敌人间飞速传导。'
        },
        bloomer: {
            id: 'bloomer', name: '蜂群微型火箭', kind: 'rocket', mag: 4, reload: 1.9,
            rate: 1.2, dmg: 24, aoe: 50, spd: 260, range: 450,
            proc: 0.6, knock: 120, recoil: 6, shake: 0.12, sfx: 'rocket', acK: 'orange',
            spr: 'w_bloomer', desc: '发射自推进微型飞弹，引发大范围剧烈殉爆。'
        },
        halo: {
            id: 'halo', name: '回旋断罪光环', kind: 'chakram', mag: 4, reload: 1.2,
            rate: 1.8, dmg: 14, spd: 280, range: 240,
            proc: 0.7, knock: 80, recoil: 2, shake: 0.04, sfx: 'chakram', acK: 'gold',
            spr: 'w_halo', desc: '掷出旋转锋刃光盘，穿透路径并在返回时造成二次伤害。'
        },
        saw: {
            id: 'saw', name: '高速弹跳锯', kind: 'gun', mag: 4, reload: 1.7,
            rate: 1.4, dmg: 8, spd: 220, bounces: 5, pierce: 99, range: 500,
            proc: 0.6, knock: 60, recoil: 3, shake: 0.05, sfx: 'chakram', acK: 'red',
            spr: 'w_saw', desc: '高转速精钢圆锯，在墙体间连续弹跳5次撕裂敌阵。'
        },
        longbow: {
            id: 'longbow', name: '光子蓄力长弓', kind: 'bow', mag: 6, reload: 1.3,
            chargeTime: 0.65, dmgMin: 10, dmgMax: 48, spd: 550, range: 520,
            proc: 1.0, knock: 170, recoil: 4, shake: 0.12, sfx: 'shoot', acK: 'gold',
            spr: 'w_longbow', desc: '长按蓄力拉弦，满蓄力附带强力穿透与巨额爆发伤害。'
        }
    };

    // -------------------------------------------------------------------------
    // 5. SHARDS (UNIVERSAL UPGRADES) & SYNERGIES
    // -------------------------------------------------------------------------
    const SHARDS = [
        {
            id: 'ember', name: '烈火余烬', tag: '元素', rar: 1, c: C.red, icon: '🔥',
            desc: '攻击点燃目标，燃烧持续造成可叠加真实灼烧伤害。',
            apply: (S) => S.burn++
        },
        {
            id: 'arc', name: '连锁电弧', tag: '元素', rar: 1, c: C.cyan, icon: '⚡',
            desc: '击中敌人有几率向周围2名目标释放连锁闪电。',
            apply: (S) => S.shock++
        },
        {
            id: 'rime', name: '极寒霜华', tag: '元素', rar: 0, c: C.frost, icon: '❄',
            desc: '附带冰霜减速，叠加3层触发1.2秒绝对冰冻脆弱。',
            apply: (S) => S.frost++
        },
        {
            id: 'venom', name: '腐蚀剧毒', tag: '元素', rar: 1, c: C.lime, icon: '☣',
            desc: '附加剧毒侵蚀，造成高频破甲与持续腐蚀伤害。',
            apply: (S) => S.venom++
        },
        {
            id: 'keen', name: '致命敏锐', tag: '暴击', rar: 0, c: C.gold, icon: '✦',
            desc: '+20%暴击率，暴击造成2.5倍伤害并触发定格打击感。',
            apply: (S) => { S.crit += 0.2; S.critMul += 0.5; }
        },
        {
            id: 'fork', name: '弹道分叉', tag: '形态', rar: 2, c: col(5), icon: '⫯',
            desc: '+1次攻击复制。枪械扇形扩散，剑刃双重挥斩，光束分裂。',
            apply: (S) => S.fork++
        },
        {
            id: 'echo', name: '虚空回声', tag: '形态', rar: 2, c: C.violet, icon: '◈',
            desc: '每3次攻击由虚影免费即时复现一次。',
            apply: (S) => S.echo++
        },
        {
            id: 'rico', name: '跳弹动能', tag: '形态', rar: 0, c: col(5), icon: '⟳',
            desc: '子弹可在墙壁额外弹跳+1次。',
            apply: (S) => S.bounce++
        },
        {
            id: 'heavy', name: '重型改装', tag: '力量', rar: 0, c: col(4), icon: '▲',
            desc: '+35%伤害与体积，大幅增加攻击击退力。',
            apply: (S) => { S.dmg *= 1.35; S.size *= 1.2; S.knock *= 1.4; }
        },
        {
            id: 'frenzy', name: '超频狂热', tag: '力量', rar: 0, c: col(5), icon: '⚙',
            desc: '+28%攻击速度与+15%移动速度。',
            apply: (S) => { S.rate *= 1.28; G.p.speed *= 1.15; }
        },
        {
            id: 'bloom', name: '殉爆核心', tag: '歼灭', rar: 1, c: C.orange, icon: '💥',
            desc: '击杀敌人引发烈性爆炸，波及周围大片区域。',
            apply: (S) => S.bloom++
        },
        {
            id: 'shrap', name: '破片迸射', tag: '歼灭', rar: 1, c: col(4), icon: '⁑',
            desc: '击杀时向周围散射3枚自动索敌破片。',
            apply: (S) => S.shrap++
        },
        {
            id: 'leech', name: '纳米汲取', tag: '歼灭', rar: 1, c: C.lime, icon: '♥',
            desc: '击杀敌人有15%概率掉落生命修复核心。',
            apply: (S) => S.vamp++
        },
        {
            id: 'tactical', name: '战术滑铲', tag: '战术', rar: 0, c: C.cyan, icon: '≫',
            desc: '冲刺立即填装当前武器50%弹药。',
            apply: (S) => S.tactical++
        },
        {
            id: 'after', name: '残影爆震', tag: '机动', rar: 1, c: C.violet, icon: '💨',
            desc: '冲刺在起点释放扩散冲击波，击退靠近的敌人。',
            apply: (S) => S.after++
        },
        {
            id: 'sat', name: '环绕卫星', tag: '防卫', rar: 1, c: col(5), icon: '🛡',
            desc: '2枚微型防御立方环绕旋转，阻挡子弹并绞杀敌人。',
            apply: (S) => S.orbit += 2
        }
    ];

    const SYNERGIES = [
        { id: 'plasma', name: '等离子风暴', req: ['ember', 'arc'], c: C.pink, desc: '闪电引燃灼烧目标，触发粉色等离子爆轰！' },
        { id: 'shatter', name: '极寒碎冰', req: ['rime', 'keen'], c: C.frost, desc: '对冰冻敌人的暴击造成3.5倍超绝碎冰伤害！' },
        { id: 'chain', name: '殉爆连锁', req: ['bloom', 'shrap'], c: C.orange, desc: '破片命中时引发二次剧烈殉爆！' },
        { id: 'phantom', name: '虚空幻影', req: ['after', 'echo'], c: C.violet, desc: '冲刺时无消耗释放全额虚空残影攻击！' },
        { id: 'wildfire', name: '烈火燎原', req: ['ember', 'bloom'], c: C.red, desc: '殉爆点燃更大范围，形成毁灭火海！' }
    ];

    // -------------------------------------------------------------------------
    // 6. GLOBAL GAME STATE & CRASH-PROOF ENGINE
    // -------------------------------------------------------------------------
    const G = {
        state: 'play', // play, card_select, dead, victory
        time: 0,
        runTime: 0,
        floor: 1,
        kills: 0,
        combo: 0,
        comboTime: 0,
        comboMax: 0,
        damageDealt: 0,
        ink: 0,

        cam: { x: 0, y: 0 },
        trauma: 0,
        hitstopTimer: 0,
        slowmo: 1.0,
        slowmoTimer: 0,

        p: null,
        room: null,
        enemies: [],
        boss: null,
        bullets: [],
        ebullets: [],
        particles: [],
        damageNumbers: [],
        ghosts: [],
        inks: [],
        shockwaves: [],

        shards: {},
        syn: {},
        S: null,
        activeCards: [],
        autoPlay: false,

        init() {
            Input.init();
            this.restart();
            this.loopBound = (t) => this.loop(t);
            requestAnimationFrame(this.loopBound);
        },

        restart() {
            document.getElementById('end-modal').classList.remove('active');
            document.getElementById('level-modal').classList.remove('active');

            this.state = 'play';
            this.time = 0;
            this.runTime = 0;
            this.floor = 1;
            this.kills = 0;
            this.combo = 0;
            this.comboTime = 0;
            this.comboMax = 0;
            this.damageDealt = 0;
            this.ink = 0;
            this.shards = {};
            this.syn = {};

            this.recomputeStats();
            this.p = new Player();
            this.loadFloor(1);

            window.AU.setRoot(55);
            window.AU.setMode('combat');
        },

        recomputeStats() {
            this.S = {
                dmg: 1.0, rate: 1.0, size: 1.0, crit: 0.08, critMul: 2.0,
                burn: 0, shock: 0, frost: 0, venom: 0, fork: 0, echo: 0,
                bounce: 0, knock: 1.0, bloom: 0, shrap: 0, vamp: 0,
                tactical: 0, after: 0, orbit: 0
            };

            for (const id in this.shards) {
                const s = SHARDS.find((x) => x.id === id);
                if (s) {
                    for (let i = 0; i < this.shards[id]; i++) s.apply(this.S);
                }
            }

            for (const syn of SYNERGIES) {
                if (syn.req.every((reqId) => this.shards[reqId] > 0)) {
                    this.syn[syn.id] = true;
                }
            }
        },

        loadFloor(floorNum) {
            this.floor = floorNum;
            this.room = new Room(floorNum);
            this.enemies = [];
            this.boss = null;
            this.bullets = [];
            this.ebullets = [];
            this.particles = [];
            this.damageNumbers = [];
            this.ghosts = [];
            this.inks = [];
            this.shockwaves = [];

            this.p.x = this.room.w / 2;
            this.p.y = this.room.h - 60;
            this.p.vx = 0;
            this.p.vy = 0;

            if (floorNum === 3) {
                this.boss = new Boss(this.room.w / 2, 120);
                document.getElementById('boss-hud').classList.add('active');
                this.updateBossHUD();
            } else {
                document.getElementById('boss-hud').classList.remove('active');
                this.spawnWave(floorNum);
            }

            this.showBanner(floorNum);
            UI.updateRoomDisplay(floorNum);
            UI.updateWeaponsDisplay();
            UI.renderRelicsTray();
        },

        spawnWave(floorNum) {
            const count = 6 + floorNum * 4;
            const r = this.room;
            for (let i = 0; i < count; i++) {
                const x = r.x + 60 + Math.random() * (r.w - 120);
                const y = r.y + 60 + Math.random() * (r.h - 180);

                let type = 'scuttler';
                const rand = Math.random();
                if (rand > 0.4 && rand <= 0.7) type = 'gunner';
                else if (rand > 0.7 && rand <= 0.85) type = 'sniper';
                else if (rand > 0.85 && floorNum >= 2) type = 'shield_enforcer';

                this.enemies.push(new Enemy(x, y, type));
            }
        },

        showBanner(floorNum) {
            const el = document.getElementById('floor-banner');
            const big = document.getElementById('banner-big');
            const sub = document.getElementById('banner-sub');

            if (floorNum === 3) {
                big.textContent = '终焉区 // 虚空神殿';
                sub.textContent = '余烬守卫 · 虚空方碑';
            } else if (floorNum === 2) {
                big.textContent = '第二区 // 核心熔炉';
                sub.textContent = '摧毁重型机械哨戒防线';
            } else {
                big.textContent = '第一区 // 潜入行动';
                sub.textContent = '肃清区域内部敌方据点';
            }

            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 2500);
        },

        shake(amount) {
            this.trauma = Math.min(1.0, this.trauma + amount);
        },

        hitstop(dur) {
            this.hitstopTimer = Math.min(0.08, dur);
        },

        slowmo(factor, dur) {
            this.slowmo = factor;
            this.slowmoTimer = dur;
        },

        burst(x, y, count, color, spd = 120, life = 0.3) {
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = (0.5 + Math.random()) * spd;
                this.particles.push({
                    x, y,
                    vx: Math.cos(a) * s,
                    vy: Math.sin(a) * s,
                    color,
                    life, maxLife: life
                });
            }
        },

        ringFx(x, y, maxR, color, dur = 0.25) {
            this.shockwaves.push({
                x, y, r: 2, maxR, color,
                dur, t: dur
            });
        },

        floatText(x, y, text, color, scale = 1) {
            this.damageNumbers.push({
                x: x + (Math.random() - 0.5) * 8,
                y,
                text, color, scale,
                vy: -35,
                life: 0.6, maxLife: 0.6
            });
        },

        triggerCardSelect() {
            this.state = 'card_select';
            window.AU.play('card');

            const available = SHARDS.filter((s) => (this.shards[s.id] || 0) < 3);
            this.activeCards = [];
            while (this.activeCards.length < 3 && available.length > 0) {
                const idx = Math.floor(Math.random() * available.length);
                this.activeCards.push(available.splice(idx, 1)[0]);
            }

            UI.showCardModal(this.activeCards);
        },

        chooseCard(idx) {
            const card = this.activeCards[idx];
            if (!card) return;

            this.shards[card.id] = (this.shards[card.id] || 0) + 1;
            this.recomputeStats();
            window.AU.play('select');

            document.getElementById('level-modal').classList.remove('active');
            this.state = 'play';
            UI.renderRelicsTray();
        },

        updateAutopilot(dt) {
            const p = this.p;
            if (!p || p.hp <= 0) return;

            // 1. Identify primary combat or movement objective
            let target = null;
            let targetDist = Infinity;

            if (this.boss && !this.boss.dead) {
                target = this.boss;
                targetDist = Math.hypot(this.boss.x - p.x, this.boss.y - p.y);
            } else if (this.enemies.length > 0) {
                let bestD = Infinity;
                for (let i = 0; i < this.enemies.length; i++) {
                    const e = this.enemies[i];
                    if (e.dead) continue;
                    const d = Math.hypot(e.x - p.x, e.y - p.y);
                    if (d < bestD) {
                        bestD = d;
                        target = e;
                    }
                }
                targetDist = bestD;
            }

            // 2. Targeting, Aiming, and Firing
            if (target) {
                const targetVx = target.vx || 0;
                const targetVy = target.vy || 0;
                Input.worldX = target.x + targetVx * 0.12;
                Input.worldY = target.y + targetVy * 0.12;
                Input.down = true;

                // Tactical weapon reload/swap
                const curW = p.currentWeapon;
                if (curW.kind !== 'melee') {
                    if (curW.ammo <= 0) {
                        const otherW = p.weapons[1 - p.wi];
                        if (otherW && otherW.ammo > 0 && p.reloadTimer <= 0) {
                            p.swapWeapon();
                        } else if (p.reloadTimer <= 0) {
                            p.reload();
                        }
                    }
                }
            } else {
                Input.down = false;
            }

            // 3. Vector-based tactical movement & evasion
            let moveX = 0;
            let moveY = 0;

            if (target) {
                // Strong repulsion from ALL nearby enemies
                for (let i = 0; i < this.enemies.length; i++) {
                    const e = this.enemies[i];
                    if (e.dead) continue;
                    const edx = p.x - e.x;
                    const edy = p.y - e.y;
                    const ed = Math.hypot(edx, edy);
                    if (ed < 130) {
                        const push = ((130 - ed) / 130) * 3.6;
                        moveX += (edx / ed) * push;
                        moveY += (edy / ed) * push;
                    }
                }

                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const d = Math.max(1, targetDist);

                // Safe kiting range (140-180px)
                if (d > 180) {
                    moveX += (dx / d) * 1.2;
                    moveY += (dy / d) * 1.2;
                } else if (d < 130) {
                    moveX -= (dx / d) * 1.6;
                    moveY -= (dy / d) * 1.6;
                }

                // Tangential orbital strafe
                moveX += (-dy / d) * 0.85;
                moveY += (dx / d) * 0.85;
            } else {
                // Room cleared or peaceful phase: handle chests, inks, and portal
                let objX = this.room ? this.room.w / 2 : p.x;
                let objY = this.room ? this.room.h / 2 : p.y;

                const chest = this.room ? this.room.pickups.find(pu => pu.type === 'chest' && !pu.opened) : null;
                if (chest) {
                    objX = chest.x;
                    objY = chest.y;
                    if (Math.hypot(chest.x - p.x, chest.y - p.y) < 32) {
                        p.tryInteract();
                    }
                } else if (this.room && this.room.cleared && this.room.portal) {
                    objX = this.room.portal.x;
                    objY = this.room.portal.y;
                } else if (this.inks.length > 0) {
                    objX = this.inks[0].x;
                    objY = this.inks[0].y;
                }

                const odx = objX - p.x;
                const ody = objY - p.y;
                const od = Math.hypot(odx, ody);
                if (od > 8) {
                    moveX += (odx / od) * 1.2;
                    moveY += (ody / od) * 1.2;
                }
            }

            // 4. Bullet Collision Avoidance (Highest Priority)
            let acuteDanger = false;
            for (let i = 0; i < this.ebullets.length; i++) {
                const b = this.ebullets[i];
                if (b.dead) continue;
                const bdx = p.x - b.x;
                const bdy = p.y - b.y;
                const bd = Math.hypot(bdx, bdy);
                if (bd < 75) {
                    const dot = b.vx * bdx + b.vy * bdy;
                    if (dot > 0 || bd < 35) {
                        const perpX = -b.vy;
                        const perpY = b.vx;
                        const plen = Math.hypot(perpX, perpY) || 1;
                        const weight = ((75 - bd) / 75) * 3.8;
                        moveX += (perpX / plen) * weight;
                        moveY += (perpY / plen) * weight;

                        if (bd < 30) acuteDanger = true;
                    }
                }
            }

            // 5. Boss Hazard Avoidance (Laser & Mortar)
            if (this.boss && !this.boss.dead) {
                if (this.boss.mortars) {
                    for (let i = 0; i < this.boss.mortars.length; i++) {
                        const m = this.boss.mortars[i];
                        const mDist = Math.hypot(p.x - m.x, p.y - m.y);
                        if (mDist < m.r + 20) {
                            const awayX = p.x - m.x;
                            const awayY = p.y - m.y;
                            const awayLen = Math.hypot(awayX, awayY) || 1;
                            moveX += (awayX / awayLen) * 3.2;
                            moveY += (awayY / awayLen) * 3.2;
                            if (mDist < m.r) acuteDanger = true;
                        }
                    }
                }

                if (this.boss.state === 'fire_laser' || this.boss.state === 'telegraph_laser') {
                    const pAng = Math.atan2(p.y - this.boss.y, p.x - this.boss.x);
                    let diff = Math.abs(this.boss.laserAngle - pAng);
                    diff = Math.min(diff, Math.PI * 2 - diff);
                    if (diff < 0.38) {
                        const awayLaser = Math.sin(pAng - this.boss.laserAngle) > 0 ? 1 : -1;
                        moveX += -Math.sin(pAng) * awayLaser * 4.0;
                        moveY += Math.cos(pAng) * awayLaser * 4.0;
                        acuteDanger = true;
                    }
                }
            }

            // 6. Wall & Obstacle Repulsion
            if (this.room) {
                const wallMargin = 65;
                if (p.x < wallMargin) moveX += 4.5 * ((wallMargin - p.x) / wallMargin);
                if (p.x > this.room.w - wallMargin) moveX -= 4.5 * ((p.x - (this.room.w - wallMargin)) / wallMargin);
                if (p.y < wallMargin) moveY += 4.5 * ((wallMargin - p.y) / wallMargin);
                if (p.y > this.room.h - wallMargin) moveY -= 4.5 * ((p.y - (this.room.h - wallMargin)) / wallMargin);

                for (let i = 0; i < this.room.obstacles.length; i++) {
                    const obs = this.room.obstacles[i];
                    if (obs.broken) continue;
                    const ocx = obs.x + obs.w / 2;
                    const ocy = obs.y + obs.h / 2;
                    const od = Math.hypot(p.x - ocx, p.y - ocy);
                    if (od < 50) {
                        const pushAway = ((50 - od) / 50) * 4.0;
                        moveX += ((p.x - ocx) / od) * pushAway;
                        moveY += ((p.y - ocy) / od) * pushAway;

                        const tangentX = -(p.y - ocy) / od;
                        const tangentY = (p.x - ocx) / od;
                        const dot = tangentX * moveX + tangentY * moveY;
                        const sign = dot >= 0 ? 1 : -1;
                        moveX += tangentX * sign * 2.8;
                        moveY += tangentY * sign * 2.8;
                    }
                }
            }

            // 7. Tactical Dash Escape & Unstuck
            if (!target && (moveX !== 0 || moveY !== 0)) {
                if (Math.hypot(p.vx, p.vy) < 25) {
                    p.stuckTimer = (p.stuckTimer || 0) + dt;
                    if (p.stuckTimer > 0.35 && p.dashCharges > 0 && p.dashTimer <= 0) {
                        p.dash();
                        p.stuckTimer = 0;
                    }
                } else {
                    p.stuckTimer = 0;
                }
            }

            if (acuteDanger && p.dashCharges > 0 && p.dashTimer <= 0) {
                p.dash();
            }

            // 8. Feed movement keys into Input system
            Input.keys['KeyD'] = moveX > 0.25;
            Input.keys['KeyA'] = moveX < -0.25;
            Input.keys['KeyS'] = moveY > 0.25;
            Input.keys['KeyW'] = moveY < -0.25;
        },

        hitEnemy(e, rawDmg, opt = {}) {
            if (e.dead) return;

            // Shield Enforcer frontal deflection
            if (e.type === 'shield_enforcer' && !opt.pierce) {
                const angleFrom = opt.fromAngle || 0;
                let diff = Math.abs(e.shieldAngle - (angleFrom + Math.PI));
                diff = Math.min(diff, Math.PI * 2 - diff);
                if (diff < 0.8) {
                    this.floatText(e.x, e.y - 12, '格挡', C.cyan, 0.9);
                    window.AU.play('deflect');
                    return;
                }
            }

            let dmg = rawDmg * this.S.dmg;
            const isCrit = Math.random() < this.S.crit;
            if (isCrit) dmg *= this.S.critMul;

            // Freeze Vulnerability
            if (e.frozen > 0) {
                dmg *= this.syn.shatter ? 3.5 : 1.3;
                if (this.syn.shatter && isCrit) {
                    this.burst(e.x, e.y, 16, C.frost, 160);
                    window.AU.play('explode');
                }
            }

            e.hp = Math.max(0, e.hp - dmg);
            e.flash = 0.08;
            this.damageDealt += dmg;

            this.hitstop(isCrit ? 0.04 : 0.02);
            window.AU.play(isCrit ? 'crit' : 'hit');
            this.floatText(e.x, e.y - 8, isCrit ? `暴击 ${Math.round(dmg)}` : Math.round(dmg), isCrit ? C.red : col(5), isCrit ? 1.3 : 1.0);
            this.burst(e.x, e.y, isCrit ? 8 : 4, isCrit ? C.red : col(4), 90);

            if (opt.fromAngle !== undefined) {
                e.vx += Math.cos(opt.fromAngle) * (opt.knock || 60) * this.S.knock;
                e.vy += Math.sin(opt.fromAngle) * (opt.knock || 60) * this.S.knock;
            }

            if (this.S.burn > 0) e.burn = Math.min(10, e.burn + 2);
            if (this.S.venom > 0) e.venom = Math.min(12, e.venom + 1);
            if (this.S.frost > 0) {
                e.frostStacks++;
                if (e.frostStacks >= 3) {
                    e.frozen = 1.2;
                    e.frostStacks = 0;
                    window.AU.play('freeze');
                }
            }

            if (this.S.shock > 0 && Math.random() < 0.45) {
                this.chainLightning(e.x, e.y, 2, dmg * 0.6);
            }

            if (this.syn.plasma && e.burn > 0) {
                this.createExplosion(e.x, e.y, 35, dmg * 0.8, C.pink);
            }

            if (e.hp <= 0) this.killEnemy(e);
        },

        hitBoss(rawDmg, opt = {}) {
            if (!this.boss || this.boss.dead) return;

            let dmg = rawDmg * this.S.dmg;
            const isCrit = Math.random() < this.S.crit;
            if (isCrit) dmg *= this.S.critMul;

            if (this.boss.frozen > 0) {
                dmg *= this.syn.shatter ? 2.5 : 1.3;
                if (this.syn.shatter && isCrit) {
                    this.burst(this.boss.x, this.boss.y, 16, C.frost, 160);
                    window.AU.play('explode');
                }
            }

            dmg = Math.max(1, dmg);

            this.boss.takeDamage(dmg, isCrit);

            if (this.S.burn > 0) this.boss.burn = Math.min(8, (this.boss.burn || 0) + 2);
            if (this.S.venom > 0) this.boss.venom = Math.min(10, (this.boss.venom || 0) + 1);
            if (this.S.frost > 0) {
                this.boss.frostStacks = (this.boss.frostStacks || 0) + 1;
                if (this.boss.frostStacks >= 4) {
                    this.boss.frozen = 0.8;
                    this.boss.frostStacks = 0;
                    window.AU.play('freeze');
                }
            }

            if (this.S.shock > 0 && Math.random() < 0.45) {
                this.createExplosion(this.boss.x, this.boss.y, 25, dmg * 0.5, C.cyan);
            }

            if (this.syn.plasma && this.boss.burn > 0) {
                this.createExplosion(this.boss.x, this.boss.y, 35, dmg * 0.8, C.pink);
            }

            if (this.S.vamp > 0 && Math.random() < 0.15) {
                this.p.heal(1);
            }
        },

        chainLightning(fromX, fromY, remaining, dmg) {
            if (remaining <= 0) return;
            let target = null;
            let minDist = 120;

            this.enemies.forEach((en) => {
                if (en.dead) return;
                const d = Math.hypot(en.x - fromX, en.y - fromY);
                if (d > 4 && d < minDist) {
                    minDist = d;
                    target = en;
                }
            });

            if (this.boss && !this.boss.dead) {
                const d = Math.hypot(this.boss.x - fromX, this.boss.y - fromY);
                if (d > 4 && d < minDist) {
                    minDist = d;
                    target = this.boss;
                }
            }

            if (target) {
                if (target === this.boss) {
                    this.hitBoss(dmg);
                } else {
                    target.hp = Math.max(0, target.hp - dmg);
                    target.flash = 0.08;
                    this.floatText(target.x, target.y - 8, Math.round(dmg), C.cyan);
                    window.AU.play('zap');
                    if (target.hp <= 0) this.killEnemy(target);
                }
                this.particles.push({
                    type: 'arc_line',
                    x1: fromX, y1: fromY,
                    x2: target.x, y2: target.y,
                    life: 0.1, maxLife: 0.1
                });
                this.chainLightning(target.x, target.y, remaining - 1, dmg * 0.7);
            }
        },

        createExplosion(x, y, radius, dmg, color = C.orange) {
            this.shake(0.35);
            window.AU.play('explode');
            this.ringFx(x, y, radius, color);
            this.burst(x, y, 18, color, 140);

            this.enemies.forEach((e) => {
                if (e.dead) return;
                const d = Math.hypot(e.x - x, e.y - y);
                if (d < radius + e.r) {
                    this.hitEnemy(e, dmg, { fromAngle: Math.atan2(e.y - y, e.x - x), knock: 160 });
                }
            });

            if (this.boss && !this.boss.dead) {
                const d = Math.hypot(this.boss.x - x, this.boss.y - y);
                if (d < radius + this.boss.r) {
                    this.hitBoss(dmg);
                }
            }
        },

        killEnemy(e) {
            if (e.dead) return;
            e.dead = true;
            this.kills++;

            this.combo++;
            this.comboTime = 2.4;
            if (this.combo > this.comboMax) this.comboMax = this.combo;

            const comboPitch = Math.min(2.2, 1.0 + (this.combo - 1) * 0.08);
            window.AU.play('kill', comboPitch);

            this.burst(e.x, e.y, 16, e.elite ? C.violet : col(3), 120);

            const inkAmt = e.elite ? 6 : 2;
            for (let i = 0; i < inkAmt; i++) {
                this.inks.push({
                    x: e.x + (Math.random() - 0.5) * 16,
                    y: e.y + (Math.random() - 0.5) * 16,
                    val: 1
                });
            }

            if (this.S.bloom > 0 || this.syn.wildfire) {
                const blastColor = this.syn.wildfire ? C.red : C.orange;
                this.createExplosion(e.x, e.y, 45, e.maxHp * 0.5, blastColor);
            }

            if (this.S.shrap > 0) {
                for (let i = 0; i < 3; i++) {
                    const ang = (i * Math.PI * 2) / 3;
                    this.bullets.push(new Projectile({
                        x: e.x, y: e.y,
                        angle: ang,
                        speed: 260,
                        dmg: 12,
                        range: 160,
                        color: this.syn.chain ? C.orange : col(4),
                        radius: 2.5,
                        seeking: true
                    }));
                }
            }

            if (this.S.vamp > 0 && Math.random() < 0.15) {
                this.p.heal(1);
            }
        },

        updateBossHUD() {
            if (!this.boss) return;
            const bar = document.getElementById('boss-bar');
            const phaseBadge = document.getElementById('boss-phase');
            const curHp = Math.max(0, Math.ceil(this.boss.hp));
            const pct = Math.max(0, Math.min(100, (curHp / this.boss.maxHp) * 100));
            bar.style.width = `${pct}%`;
            phaseBadge.textContent = `阶段 ${this.boss.phase + 1}`;
        },

        // ---------------------------------------------------------------------
        // 100% BULLETPROOF MAIN LOOP
        // ---------------------------------------------------------------------
        lastTime: 0,
        loop(t) {
            try {
                if (!this.lastTime) this.lastTime = t;
                let dt = (t - this.lastTime) / 1000;
                this.lastTime = t;
                dt = Math.max(0.001, Math.min(0.05, dt));

                if (this.hitstopTimer > 0) {
                    this.hitstopTimer -= dt;
                    this.render();
                    return;
                }

                let simDt = dt;
                if (this.slowmoTimer > 0) {
                    this.slowmoTimer -= dt;
                    simDt = dt * this.slowmo;
                }

                if (this.autoPlay && this.state === 'card_select') {
                    if (this.activeCards && this.activeCards.length > 0) {
                        this.chooseCard(0);
                    }
                }

                if (this.state === 'play') {
                    if (this.autoPlay) {
                        this.updateAutopilot(dt);
                    }
                    this.update(simDt, dt);
                }

                this.render();
            } catch (err) {
                console.error('Frame execution error caught:', err);
            } finally {
                requestAnimationFrame(this.loopBound);
            }
        },

        update(simDt, rawDt) {
            this.time += simDt;
            this.runTime += rawDt;

            if (this.comboTime > 0) {
                this.comboTime -= rawDt;
                if (this.comboTime <= 0) {
                    this.combo = 0;
                    document.getElementById('combo-box').classList.remove('active');
                } else if (this.combo >= 3) {
                    const cBox = document.getElementById('combo-box');
                    cBox.textContent = `连击 x${this.combo}`;
                    cBox.classList.add('active');
                }
            }

            const mouseLead = 0.18;
            const targetCamX = this.p.x - W / 2 + (Input.mx - W / 2) * mouseLead;
            const targetCamY = this.p.y - H / 2 + (Input.my - H / 2) * mouseLead;
            this.cam.x += (targetCamX - this.cam.x) * (1 - Math.exp(-10 * rawDt));
            this.cam.y += (targetCamY - this.cam.y) * (1 - Math.exp(-10 * rawDt));

            if (this.trauma > 0) {
                this.trauma = Math.max(0, this.trauma - rawDt * 2.2);
            }

            this.p.update(rawDt);

            if (this.boss) {
                this.boss.update(simDt);
            }

            this.enemies.forEach((e) => e.update(simDt));
            this.enemies = this.enemies.filter((e) => !e.dead);

            if (!this.room.cleared) {
                if (this.enemies.length === 0 && (!this.boss || this.boss.dead)) {
                    this.room.cleared = true;
                    if (this.floor < 3) {
                        this.room.portal = { x: this.room.w / 2, y: 50 };
                        window.AU.play('door');
                        UI.updateRoomDisplay(this.floor);
                        this.triggerCardSelect();
                    } else {
                        UI.updateRoomDisplay(this.floor);
                    }
                }
            }

            if (this.room.cleared && this.room.portal) {
                const distToPortal = Math.hypot(this.p.x - this.room.portal.x, this.p.y - this.room.portal.y);
                if (distToPortal < 22) {
                    if (this.floor < 3) {
                        this.loadFloor(this.floor + 1);
                    }
                }
            }

            this.bullets.forEach((b) => b.update(simDt));
            this.bullets = this.bullets.filter((b) => !b.dead);

            this.ebullets.forEach((b) => b.update(simDt));
            this.ebullets = this.ebullets.filter((b) => !b.dead);

            this.inks.forEach((ink) => {
                const d = Math.hypot(this.p.x - ink.x, this.p.y - ink.y);
                if (d < 85) {
                    ink.x += ((this.p.x - ink.x) / d) * 280 * rawDt;
                    ink.y += ((this.p.y - ink.y) / d) * 280 * rawDt;
                }
                if (d < 12) {
                    ink.collected = true;
                    this.ink += ink.val;
                    const inkPitch = Math.min(2.5, 1.0 + (this.ink % 15) * 0.08);
                    window.AU.play('ink', inkPitch);
                }
            });
            this.inks = this.inks.filter((i) => !i.collected);

            this.ghosts.forEach((g) => g.t -= rawDt);
            this.ghosts = this.ghosts.filter((g) => g.t > 0);

            this.shockwaves.forEach((sw) => {
                sw.t -= rawDt;
                sw.r = sw.maxR * (1 - sw.t / sw.dur);
            });
            this.shockwaves = this.shockwaves.filter((sw) => sw.t > 0);

            this.particles.forEach((pt) => {
                pt.life -= rawDt;
                if (pt.vx !== undefined && pt.vy !== undefined) {
                    pt.x += pt.vx * rawDt;
                    pt.y += pt.vy * rawDt;
                    pt.vx *= 0.92;
                    pt.vy *= 0.92;
                }
            });
            this.particles = this.particles.filter((pt) => pt.life > 0);

            this.damageNumbers.forEach((dn) => {
                dn.life -= rawDt;
                dn.y += dn.vy * rawDt;
            });
            this.damageNumbers = this.damageNumbers.filter((dn) => dn.life > 0);

            UI.updatePlayerHUD();
            UI.renderMinimap();
        },

        render() {
            CTX.save();
            CTX.fillStyle = col(0);
            CTX.fillRect(0, 0, W, H);

            let shakeX = 0, shakeY = 0;
            if (this.trauma > 0) {
                const s = this.trauma * this.trauma;
                shakeX = (Math.random() * 2 - 1) * 8 * s;
                shakeY = (Math.random() * 2 - 1) * 8 * s;
            }
            CTX.translate(-Math.round(this.cam.x + shakeX), -Math.round(this.cam.y + shakeY));

            if (this.room) {
                this.room.render(CTX);
            }

            this.ghosts.forEach((g) => {
                drawSprite(CTX, 'player_dash', g.x, g.y, g.angle, g.flipX, 1);
            });

            this.shockwaves.forEach((sw) => {
                CTX.save();
                CTX.strokeStyle = sw.color;
                CTX.lineWidth = 1.5;
                CTX.beginPath();
                CTX.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
                CTX.stroke();
                CTX.restore();
            });

            // Inks (EXP Crystals)
            this.inks.forEach((ink) => {
                CTX.save();
                CTX.fillStyle = C.gold;
                CTX.fillRect(Math.round(ink.x - 2), Math.round(ink.y - 2), 4, 4);
                CTX.fillStyle = col(5);
                CTX.fillRect(Math.round(ink.x - 1), Math.round(ink.y - 1), 2, 2);
                CTX.restore();
            });

            this.enemies.forEach((e) => e.render(CTX));

            if (this.boss) this.boss.render(CTX);

            this.p.render(CTX);

            this.bullets.forEach((b) => b.render(CTX));
            this.ebullets.forEach((b) => b.render(CTX));

            this.particles.forEach((pt) => {
                CTX.save();
                if (pt.type === 'arc_line') {
                    CTX.strokeStyle = C.cyan;
                    CTX.lineWidth = 1.5;
                    CTX.beginPath();
                    CTX.moveTo(pt.x1, pt.y1);
                    CTX.lineTo(pt.x2, pt.y2);
                    CTX.stroke();
                } else {
                    CTX.fillStyle = pt.color;
                    CTX.fillRect(Math.round(pt.x - 1), Math.round(pt.y - 1), 2, 2);
                }
                CTX.restore();
            });

            this.damageNumbers.forEach((dn) => {
                CTX.save();
                CTX.globalAlpha = Math.max(0, dn.life / dn.maxLife);
                CTX.fillStyle = dn.color;
                CTX.font = `bold ${Math.round(9 * dn.scale)}px Courier New`;
                CTX.textAlign = 'center';
                CTX.fillText(dn.text, Math.round(dn.x), Math.round(dn.y));
                CTX.restore();
            });

            // Custom Dynamic Crosshair
            CTX.save();
            const cx = Input.worldX;
            const cy = Input.worldY;
            CTX.strokeStyle = col(5);
            CTX.lineWidth = 1;

            CTX.beginPath();
            CTX.moveTo(cx - 5, cy); CTX.lineTo(cx - 2, cy);
            CTX.moveTo(cx + 2, cy); CTX.lineTo(cx + 5, cy);
            CTX.moveTo(cx, cy - 5); CTX.lineTo(cx, cy - 2);
            CTX.moveTo(cx, cy + 2); CTX.lineTo(cx, cy + 5);
            CTX.stroke();

            const curW = this.p.currentWeapon;
            if (this.p.reloadTimer > 0) {
                const prog = 1 - (this.p.reloadTimer / curW.reload);
                CTX.strokeStyle = C.cyan;
                CTX.lineWidth = 1.5;
                CTX.beginPath();
                CTX.arc(cx, cy + 8, 4, 0, Math.PI * 2 * prog);
                CTX.stroke();
            }
            CTX.restore();

            CTX.restore();
        }
    };

    // -------------------------------------------------------------------------
    // 7. PLAYER ENTITY (ANIMATED PIXEL OPERATIVE)
    // -------------------------------------------------------------------------
    class Player {
        constructor() {
            this.x = 240;
            this.y = 200;
            this.vx = 0;
            this.vy = 0;
            this.r = 6;
            this.speed = 125;

            this.maxHp = 5;
            this.hp = 5;
            this.maxArmor = 3;
            this.armor = 3;
            this.armorTimer = 0;
            this.inv = 0;

            this.dashCharges = 3;
            this.maxDashCharges = 3;
            this.dashTimer = 0;
            this.dashChargeTimer = 0;
            this.dashSpeed = 340;
            this.dx = 0; this.dy = 0;

            this.weapons = [
                { ...WEAPONS.nail, ammo: WEAPONS.nail.mag },
                { ...WEAPONS.rail, ammo: WEAPONS.rail.mag }
            ];
            this.wi = 0;
            this.fireCooldown = 0;
            this.reloadTimer = 0;
            this.charge = 0;

            this.orbitAngle = 0;
            this.walkAnim = 0;
            this.aim = 0;
            this.flipX = false;
            this.hasMoved = false;
        }

        get currentWeapon() {
            return this.weapons[this.wi];
        }

        update(dt) {
            this.inv -= dt;
            this.fireCooldown -= dt;
            this.aim = Math.atan2(Input.worldY - this.y, Input.worldX - this.x);
            this.flipX = Math.cos(this.aim) < 0;

            this.armorTimer += dt;
            if (this.armorTimer > 4.0 && this.armor < this.maxArmor) {
                this.armor++;
                this.armorTimer = 0;
                window.AU.play('armor');
            }

            if (this.dashCharges < this.maxDashCharges) {
                this.dashChargeTimer += dt;
                if (this.dashChargeTimer >= 1.5) {
                    this.dashCharges++;
                    this.dashChargeTimer = 0;
                }
            }

            if (this.dashTimer > 0) {
                this.dashTimer -= dt;
                this.x += this.dx * this.dashSpeed * dt;
                this.y += this.dy * this.dashSpeed * dt;

                G.ghosts.push({
                    x: this.x, y: this.y,
                    flipX: this.flipX,
                    angle: 0,
                    t: 0.16, maxT: 0.16
                });

                this.checkRoomBounds();
                return;
            }

            let mx = 0, my = 0;
            if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) my -= 1;
            if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) my += 1;
            if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) mx -= 1;
            if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) mx += 1;

            if (mx !== 0 && my !== 0) {
                const len = Math.hypot(mx, my);
                mx /= len; my /= len;
            }

            if ((mx !== 0 || my !== 0 || Input.down) && !this.hasMoved) {
                this.hasMoved = true;
                const hint = document.getElementById('controls-hint');
                if (hint) hint.style.opacity = '0';
            }

            const accel = 16;
            this.vx += (mx * this.speed - this.vx) * Math.min(1, accel * dt);
            this.vy += (my * this.speed - this.vy) * Math.min(1, accel * dt);

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (mx !== 0 || my !== 0) {
                this.walkAnim += dt * 8;
            } else {
                this.walkAnim = 0;
            }

            this.checkRoomBounds();

            if (this.reloadTimer > 0) {
                this.reloadTimer -= dt;
                if (this.reloadTimer <= 0) {
                    this.currentWeapon.ammo = this.currentWeapon.mag;
                    window.AU.play('reload');
                    UI.updateWeaponsDisplay();
                }
            }

            if (G.S.orbit > 0) {
                this.orbitAngle += dt * 3.5;
                for (let i = 0; i < G.S.orbit; i++) {
                    const a = this.orbitAngle + (i * Math.PI * 2) / G.S.orbit;
                    const ox = this.x + Math.cos(a) * 24;
                    const oy = this.y + Math.sin(a) * 24;
                    G.ebullets.forEach((b) => {
                        if (!b.dead && Math.hypot(b.x - ox, b.y - oy) < 12) {
                            b.dead = true;
                            G.burst(ox, oy, 3, col(5), 40);
                            window.AU.play('deflect', 1.8);
                        }
                    });
                    G.enemies.forEach((en) => {
                        if (!en.dead && Math.hypot(en.x - ox, en.y - oy) < en.r + 6) {
                            G.hitEnemy(en, 6 * dt * 8, { knock: 20 });
                        }
                    });
                    if (G.boss && !G.boss.dead && Math.hypot(G.boss.x - ox, G.boss.y - oy) < G.boss.r + 6) {
                        G.hitBoss(6 * dt * 8);
                    }
                }
            }

            const w = this.currentWeapon;
            if (w.kind === 'bow') {
                if (Input.down && this.reloadTimer <= 0) {
                    this.charge = Math.min(1.0, this.charge + dt / w.chargeTime);
                } else if (this.charge > 0) {
                    this.fireBow(this.charge);
                    this.charge = 0;
                }
            } else if (Input.down && this.fireCooldown <= 0 && this.reloadTimer <= 0) {
                this.fire();
            }
        }

        checkRoomBounds() {
            const r = G.room;
            if (!r) return;
            this.x = Math.max(r.x + 16, Math.min(r.x + r.w - 16, this.x));
            this.y = Math.max(r.y + 16, Math.min(r.y + r.h - 16, this.y));

            r.obstacles.forEach((obs) => {
                if (obs.broken) return;
                const cx = Math.max(obs.x, Math.min(this.x, obs.x + obs.w));
                const cy = Math.max(obs.y, Math.min(this.y, obs.y + obs.h));
                const d = Math.hypot(this.x - cx, this.y - cy);
                if (d < this.r && d > 0.001) {
                    this.x += ((this.x - cx) / d) * (this.r - d);
                    this.y += ((this.y - cy) / d) * (this.r - d);
                }
            });
        }

        dash() {
            if (this.dashCharges <= 0 || this.dashTimer > 0) return;

            let mx = 0, my = 0;
            if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) my -= 1;
            if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) my += 1;
            if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) mx -= 1;
            if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) mx += 1;

            if (mx === 0 && my === 0) {
                mx = Math.cos(this.aim);
                my = Math.sin(this.aim);
            } else {
                const len = Math.hypot(mx, my);
                mx /= len; my /= len;
            }

            this.dashCharges--;
            this.dashTimer = 0.20;
            this.inv = 0.25;
            this.dx = mx; this.dy = my;

            G.shake(0.1);
            window.AU.play('dash');
            G.burst(this.x, this.y, 8, col(3), 80);

            if (G.S.tactical > 0 && this.currentWeapon.kind !== 'melee') {
                const w = this.currentWeapon;
                w.ammo = Math.min(w.mag, w.ammo + Math.ceil(w.mag * 0.5));
                UI.updateWeaponsDisplay();
            }

            if (G.S.after > 0) {
                G.ringFx(this.x, this.y, 40, C.violet);
                G.enemies.forEach((e) => {
                    if (Math.hypot(e.x - this.x, e.y - this.y) < 45) {
                        G.hitEnemy(e, 15, { fromAngle: Math.atan2(e.y - this.y, e.x - this.x), knock: 140 });
                    }
                });
                if (G.boss && !G.boss.dead) {
                    if (Math.hypot(G.boss.x - this.x, G.boss.y - this.y) < 55) {
                        G.hitBoss(15);
                    }
                }
            }
        }

        swapWeapon() {
            this.wi = 1 - this.wi;
            this.reloadTimer = 0;
            this.fireCooldown = 0.1;
            window.AU.play('ui');
            UI.updateWeaponsDisplay();
        }

        selectWeapon(idx) {
            if (this.weapons[idx] && this.wi !== idx) {
                this.wi = idx;
                this.reloadTimer = 0;
                this.fireCooldown = 0.1;
                window.AU.play('ui');
                UI.updateWeaponsDisplay();
            }
        }

        reload() {
            const w = this.currentWeapon;
            if (w.kind !== 'melee' && w.ammo < w.mag && this.reloadTimer <= 0) {
                this.reloadTimer = w.reload;
                window.AU.play('ui', 0.8);
            }
        }

        fire() {
            const w = this.currentWeapon;

            if (w.kind !== 'melee' && w.ammo <= 0) {
                this.reload();
                return;
            }

            this.fireCooldown = (1 / w.rate) / G.S.rate;
            if (w.kind !== 'melee') {
                w.ammo--;
            }

            G.shake(w.shake);
            window.AU.play(w.sfx);

            const bx = this.x + Math.cos(this.aim) * 12;
            const by = this.y + Math.sin(this.aim) * 12;
            G.burst(bx, by, 3, col(5), 70);

            this.vx -= Math.cos(this.aim) * (w.recoil * 18);
            this.vy -= Math.sin(this.aim) * (w.recoil * 18);

            const copies = 1 + G.S.fork;

            if (w.kind === 'melee') {
                G.ringFx(bx, by, w.range, C.cyan, 0.15);
                G.enemies.forEach((e) => {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < w.range + e.r) {
                        const ang = Math.atan2(e.y - this.y, e.x - this.x);
                        let diff = Math.abs(ang - this.aim);
                        diff = Math.min(diff, Math.PI * 2 - diff);
                        if (diff < w.arc / 2) {
                            G.hitEnemy(e, w.dmg, { fromAngle: ang, knock: w.knock });
                        }
                    }
                });

                if (G.boss && !G.boss.dead) {
                    const d = Math.hypot(G.boss.x - this.x, G.boss.y - this.y);
                    if (d < w.range + G.boss.r) {
                        const ang = Math.atan2(G.boss.y - this.y, G.boss.x - this.x);
                        let diff = Math.abs(ang - this.aim);
                        diff = Math.min(diff, Math.PI * 2 - diff);
                        if (diff < w.arc / 2) {
                            G.hitBoss(w.dmg, { fromAngle: ang });
                        }
                    }
                }

                if (w.reflects) {
                    G.ebullets.forEach((b) => {
                        const d = Math.hypot(b.x - this.x, b.y - this.y);
                        if (d < w.range + 10) {
                            b.dead = true;
                            window.AU.play('deflect');
                            G.bullets.push(new Projectile({
                                x: b.x, y: b.y,
                                angle: Math.atan2(b.vy, b.vx) + Math.PI,
                                speed: Math.hypot(b.vx, b.vy) * 1.4,
                                dmg: 20,
                                range: 350,
                                color: C.cyan,
                                radius: 3
                            }));
                        }
                    });
                }
            } else if (w.kind === 'rail') {
                for (let c = 0; c < copies; c++) {
                    const ang = this.aim + (c - (copies - 1) / 2) * 0.08;
                    const ex = bx + Math.cos(ang) * w.range;
                    const ey = by + Math.sin(ang) * w.range;

                    G.particles.push({
                        type: 'rail_beam',
                        x1: bx, y1: by, x2: ex, y2: ey,
                        life: 0.22, maxLife: 0.22
                    });

                    G.enemies.forEach((e) => {
                        const d = distToSegment(e.x, e.y, bx, by, ex, ey);
                        if (d < e.r + 6) {
                            G.hitEnemy(e, w.dmg, { fromAngle: ang, knock: w.knock, pierce: true });
                        }
                    });

                    if (G.boss && !G.boss.dead) {
                        const d = distToSegment(G.boss.x, G.boss.y, bx, by, ex, ey);
                        if (d < G.boss.r + 8) G.hitBoss(w.dmg, { fromAngle: ang, pierce: true });
                    }
                }
            } else if (w.kind === 'chain') {
                G.chainLightning(bx, by, w.chains, w.dmg);
            } else if (w.kind === 'rocket') {
                for (let c = 0; c < copies; c++) {
                    const ang = this.aim + (c - (copies - 1) / 2) * 0.12;
                    G.bullets.push(new Projectile({
                        x: bx, y: by, angle: ang,
                        speed: w.spd, dmg: w.dmg, range: w.range,
                        color: C.orange, radius: 4,
                        isRocket: true, aoe: w.aoe
                    }));
                }
            } else if (w.kind === 'chakram') {
                G.bullets.push(new Projectile({
                    x: bx, y: by, angle: this.aim,
                    speed: w.spd, dmg: w.dmg, range: w.range,
                    color: C.gold, radius: 4.5,
                    isChakram: true, owner: this
                }));
            } else {
                const pelletCount = (w.n || 1) + (copies - 1);
                for (let i = 0; i < pelletCount; i++) {
                    const spread = (Math.random() - 0.5) * (w.spread || 0.05);
                    G.bullets.push(new Projectile({
                        x: bx, y: by,
                        angle: this.aim + spread,
                        speed: w.spd,
                        dmg: w.dmg,
                        range: w.range,
                        color: col(5),
                        radius: w.kind === 'gun' && w.n > 1 ? 2.5 : 3.2,
                        bounces: w.bounces || G.S.bounce,
                        pierce: w.pierce || 0
                    }));
                }
            }

            UI.updateWeaponsDisplay();
        }

        fireBow(chargeRatio) {
            const w = this.currentWeapon;
            const dmg = w.dmgMin + (w.dmgMax - w.dmgMin) * chargeRatio;
            G.shake(0.08 * chargeRatio);
            window.AU.play('shoot', 1.2 - chargeRatio * 0.4);

            G.bullets.push(new Projectile({
                x: this.x + Math.cos(this.aim) * 14,
                y: this.y + Math.sin(this.aim) * 14,
                angle: this.aim,
                speed: w.spd,
                dmg: dmg,
                range: w.range,
                color: C.gold,
                radius: 3.5,
                pierce: chargeRatio > 0.8 ? 2 : 0
            }));

            w.ammo--;
            UI.updateWeaponsDisplay();
        }

        takeDamage(amt, sx, sy) {
            if (this.inv > 0 || this.dashTimer > 0) return;
            this.armorTimer = 0;

            if (this.armor > 0) {
                this.armor = Math.max(0, this.armor - 1);
                this.inv = 0.55;
                G.shake(0.25);
                G.hitstop(0.04);
                window.AU.play('armor');
                G.floatText(this.x, this.y - 12, '护甲', C.cyan);
                G.burst(this.x, this.y, 8, C.cyan, 90);
                UI.updatePlayerHUD();
                return;
            }

            this.hp = Math.max(0, this.hp - amt);
            this.inv = 1.0;
            G.combo = 0;
            G.shake(0.5);
            G.hitstop(0.08);
            window.AU.play('hurt');
            G.floatText(this.x, this.y - 12, `-${amt}`, C.red);
            G.burst(this.x, this.y, 14, C.red, 130);
            UI.updatePlayerHUD();

            if (this.hp <= 0) {
                this.die();
            }
        }

        heal(amt) {
            this.hp = Math.min(this.maxHp, Math.max(0, this.hp + amt));
            G.floatText(this.x, this.y - 12, `+${amt}`, C.lime);
            window.AU.play('pickup');
            UI.updatePlayerHUD();
        }

        die() {
            G.state = 'dead';
            window.AU.play('hurt');
            G.shake(0.8);
            UI.showEndModal();
        }

        tryInteract() {
            const r = G.room;
            if (!r) return;

            r.pickups.forEach((pu) => {
                const d = Math.hypot(pu.x - this.x, pu.y - this.y);
                if (d < 35) {
                    if (pu.type === 'chest' && !pu.opened) {
                        pu.opened = true;
                        window.AU.play('card');
                        G.burst(pu.x, pu.y, 14, C.gold, 100);
                        this.heal(2);
                        G.triggerCardSelect();
                    } else if (pu.type === 'weapon') {
                        const oldW = this.currentWeapon;
                        this.weapons[this.wi] = { ...pu.weapon, ammo: pu.weapon.mag };
                        pu.weapon = oldW;
                        window.AU.play('select');
                        UI.updateWeaponsDisplay();
                    }
                }
            });
        }

        render(ctx) {
            ctx.save();

            // Ground shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.ellipse(Math.round(this.x), Math.round(this.y + 6), 7, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Orbitals
            if (G.S.orbit > 0) {
                for (let i = 0; i < G.S.orbit; i++) {
                    const a = this.orbitAngle + (i * Math.PI * 2) / G.S.orbit;
                    const ox = this.x + Math.cos(a) * 24;
                    const oy = this.y + Math.sin(a) * 24;
                    ctx.fillStyle = col(5);
                    ctx.fillRect(Math.round(ox - 2), Math.round(oy - 2), 4, 4);
                }
            }

            if (this.inv > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
                ctx.restore();
                return;
            }

            // Animated walking / dash sprite
            let sprKey = 'player_idle';
            if (this.dashTimer > 0) sprKey = 'player_dash';
            else if (this.walkAnim > 0) {
                const f = Math.floor(this.walkAnim) % 4;
                sprKey = `player_walk_${f + 1}`;
            }

            drawSprite(ctx, sprKey, this.x, this.y, 0, this.flipX, 1);

            // Render Weapon held in hands with 360-degree rotation & grip pivot
            const curW = this.currentWeapon;
            const wSpr = curW.spr || 'w_nail';
            const handX = this.x + (this.flipX ? -3 : 3);
            const handY = this.y + 2;
            const aimLeft = Math.cos(this.aim) < 0;
            drawSprite(ctx, wSpr, handX, handY, this.aim, false, 1, aimLeft, 0.15, 0.5);

            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 8. ENEMIES & RICH PIXEL ART SPRITES
    // -------------------------------------------------------------------------
    class Enemy {
        constructor(x, y, type) {
            this.x = x; this.y = y;
            this.vx = 0; this.vy = 0;
            this.type = type;
            this.flash = 0;
            this.dead = false;

            this.burn = 0;
            this.venom = 0;
            this.frozen = 0;
            this.frostStacks = 0;
            this.walkAnim = 0;

            this.elite = Math.random() < 0.2;
            const em = this.elite ? 2.2 : 1.0;

            if (type === 'scuttler') {
                this.hp = this.maxHp = 22 * em;
                this.r = 6; this.spd = 95 * (this.elite ? 1.2 : 1.0);
            } else if (type === 'gunner') {
                this.hp = this.maxHp = 35 * em;
                this.r = 7; this.spd = 60;
                this.shootCd = 1.8;
            } else if (type === 'shield_enforcer') {
                this.hp = this.maxHp = 60 * em;
                this.r = 8; this.spd = 45;
                this.shieldAngle = 0; this.shootCd = 2.4;
            } else if (type === 'sniper') {
                this.hp = this.maxHp = 25 * em;
                this.r = 6; this.spd = 40;
                this.aimTimer = 0; this.laserAngle = 0;
            }
        }

        update(dt) {
            this.flash -= dt;

            if (this.burn > 0) {
                this.hp = Math.max(0, this.hp - this.burn * 2.5 * dt);
                G.burst(this.x, this.y, 1, C.red, 30);
            }
            if (this.venom > 0) {
                this.hp = Math.max(0, this.hp - this.venom * 3.0 * dt);
                G.burst(this.x, this.y, 1, C.lime, 30);
            }
            if (this.hp <= 0) {
                G.killEnemy(this);
                return;
            }

            if (this.frozen > 0) {
                this.frozen -= dt;
                return;
            }

            const p = G.p;
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            const ang = Math.atan2(p.y - this.y, p.x - this.x);
            this.walkAnim += dt * 6;

            if (this.type === 'scuttler') {
                this.vx = Math.cos(ang) * this.spd;
                this.vy = Math.sin(ang) * this.spd;
                if (d < this.r + p.r) p.takeDamage(1, this.x, this.y);
            } else if (this.type === 'gunner') {
                if (d > 140) {
                    this.vx = Math.cos(ang) * this.spd;
                    this.vy = Math.sin(ang) * this.spd;
                } else if (d < 80) {
                    this.vx = -Math.cos(ang) * this.spd;
                    this.vy = -Math.sin(ang) * this.spd;
                } else {
                    this.vx = -Math.sin(ang) * this.spd;
                    this.vy = Math.cos(ang) * this.spd;
                }

                this.shootCd -= dt;
                if (this.shootCd <= 0) {
                    this.shootCd = 2.0;
                    for (let i = -1; i <= 1; i++) {
                        G.ebullets.push(new Projectile({
                            x: this.x, y: this.y,
                            angle: ang + i * 0.15,
                            speed: 180, dmg: 1, range: 300,
                            color: C.red, radius: 2.5, isEnemy: true
                        }));
                    }
                }
            } else if (this.type === 'shield_enforcer') {
                this.shieldAngle = ang;
                this.vx = Math.cos(ang) * this.spd;
                this.vy = Math.sin(ang) * this.spd;

                this.shootCd -= dt;
                if (this.shootCd <= 0) {
                    this.shootCd = 2.5;
                    G.ebullets.push(new Projectile({
                        x: this.x, y: this.y, angle: ang,
                        speed: 210, dmg: 1, range: 340,
                        color: C.red, radius: 4, isEnemy: true
                    }));
                }
            } else if (this.type === 'sniper') {
                this.vx *= 0.88;
                this.vy *= 0.88;
                this.aimTimer += dt;
                if (this.aimTimer > 1.2) {
                    this.laserAngle = ang;
                    if (this.aimTimer > 2.2) {
                        G.ebullets.push(new Projectile({
                            x: this.x, y: this.y, angle: this.laserAngle,
                            speed: 460, dmg: 2, range: 500,
                            color: C.red, radius: 4, isEnemy: true
                        }));
                        window.AU.play('shoot', 1.8);
                        this.aimTimer = 0;
                    }
                }
            }

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            const r = G.room;
            if (r) {
                this.x = Math.max(r.x + 20, Math.min(r.x + r.w - 20, this.x));
                this.y = Math.max(r.y + 20, Math.min(r.y + r.h - 20, this.y));
            }
        }

        render(ctx) {
            ctx.save();

            // Ground Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(Math.round(this.x), Math.round(this.y + this.r), this.r * 0.8, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Elite Aura
            if (this.elite) {
                ctx.strokeStyle = C.violet;
                ctx.lineWidth = 1;
                ctx.strokeRect(Math.round(this.x - this.r - 2), Math.round(this.y - this.r - 2), (this.r + 2) * 2, (this.r + 2) * 2);
            }

            // Sniper laser telegraph
            if (this.type === 'sniper' && this.aimTimer > 1.2) {
                ctx.save();
                ctx.translate(Math.round(this.x), Math.round(this.y));
                ctx.rotate(this.laserAngle);
                ctx.strokeStyle = 'rgba(255, 0, 85, 0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(350, 0);
                ctx.stroke();
                ctx.restore();
            }

            // Select detailed pixel sprite
            let sprKey = 'scuttler_1';
            if (this.type === 'scuttler') {
                sprKey = Math.floor(this.walkAnim) % 2 === 0 ? 'scuttler_1' : 'scuttler_2';
            } else if (this.type === 'gunner') {
                sprKey = 'gunner';
            } else if (this.type === 'shield_enforcer') {
                sprKey = 'enforcer';
            } else if (this.type === 'sniper') {
                sprKey = 'sniper';
            }

            drawSprite(ctx, sprKey, this.x, this.y, 0, this.vx < 0, 1);

            // Flash glowing silhouette on hit
            if (this.flash > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = Math.min(1, this.flash * 8);
                drawSprite(ctx, sprKey, this.x, this.y, 0, this.vx < 0, 1);
                ctx.restore();
            }

            // Shield Enforcer: Render Riot Barrier
            if (this.type === 'shield_enforcer') {
                const sx = this.x + Math.cos(this.shieldAngle) * 10;
                const sy = this.y + Math.sin(this.shieldAngle) * 10;
                drawSprite(ctx, 'enforcer_shield', sx, sy, this.shieldAngle, false, 1);
            }

            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 9. BOSS: THE MONOLITH // KEEPER OF ASH
    // -------------------------------------------------------------------------
    class Boss {
        constructor(x, y) {
            this.x = x; this.y = y;
            this.maxHp = 450;
            this.hp = 450;
            this.r = 28;
            this.phase = 0;
            this.flash = 0;
            this.dead = false;

            this.burn = 0;
            this.venom = 0;
            this.frozen = 0;
            this.frostStacks = 0;

            this.state = 'idle'; // 'idle', 'telegraph_laser', 'fire_laser', 'mortar_firing'
            this.stateTimer = 1.0;
            this.rot = 0;

            this.laserAngle = 0;
            this.laserSweepSpeed = 1.0;
            this.mortars = [];
        }

        update(dt) {
            if (this.dead) return;
            this.flash -= dt;
            this.rot += dt * 0.8;

            if (this.burn > 0) {
                this.burn -= dt;
                this.takeDamage(4.0 * dt, false);
            }
            if (this.venom > 0) {
                this.venom -= dt;
                this.takeDamage(5.0 * dt, false);
            }
            if (this.frozen > 0) {
                this.frozen -= dt;
                return;
            }

            const ph = this.hp <= this.maxHp * 0.33 ? 2 : (this.hp <= this.maxHp * 0.66 ? 1 : 0);
            if (ph > this.phase) {
                this.phase = ph;
                G.shake(0.6);
                G.hitstop(0.08);
                window.AU.play('phase');
                G.ringFx(this.x, this.y, 120, C.red);
                G.floatText(this.x, this.y - 36, `阶段 ${ph + 1}`, C.red, 1.4);
                G.ebullets = [];
                this.state = 'idle';
                this.stateTimer = 1.2;
                G.updateBossHUD();
            }

            this.stateTimer -= dt;

            for (let i = this.mortars.length - 1; i >= 0; i--) {
                const m = this.mortars[i];
                m.timer -= dt;
                if (m.timer <= 0) {
                    this.mortars.splice(i, 1);
                    G.ringFx(m.x, m.y, m.r, C.red, 0.25);
                    G.burst(m.x, m.y, 14, C.red, 120);
                    G.shake(0.25);
                    window.AU.play('explode', 1.2);

                    const p = G.p;
                    if (Math.hypot(p.x - m.x, p.y - m.y) < m.r && p.dashTimer <= 0 && p.inv <= 0) {
                        p.takeDamage(1, m.x, m.y);
                    }
                }
            }

            if (this.state === 'idle') {
                if (this.stateTimer <= 0) {
                    this.chooseNextAttack();
                }
            } else if (this.state === 'telegraph_laser') {
                if (this.stateTimer <= 0) {
                    this.state = 'fire_laser';
                    this.stateTimer = 0.85;
                    G.shake(0.2);
                    window.AU.play('shoot', 0.65);
                }
            } else if (this.state === 'fire_laser') {
                this.laserAngle += dt * this.laserSweepSpeed;
                const p = G.p;
                const pAng = Math.atan2(p.y - this.y, p.x - this.x);
                let diff = Math.abs(this.laserAngle - pAng);
                diff = Math.min(diff, Math.PI * 2 - diff);
                const dist = Math.hypot(p.x - this.x, p.y - this.y);

                if (diff < 0.10 && dist < 290 && p.dashTimer <= 0 && p.inv <= 0) {
                    p.takeDamage(1, this.x, this.y);
                }

                if (this.stateTimer <= 0) {
                    this.state = 'idle';
                    this.stateTimer = this.phase === 2 ? 0.8 : 1.0;
                }
            } else if (this.state === 'mortar_firing') {
                if (this.stateTimer <= 0) {
                    this.state = 'idle';
                    this.stateTimer = this.phase === 2 ? 0.85 : 1.0;
                }
            }
        }

        chooseNextAttack() {
            const p = G.p;
            const r = Math.random();

            if (this.phase === 0) {
                if (r < 0.55) {
                    this.fireRadialBurst(12, 110, 0);
                    this.state = 'idle';
                    this.stateTimer = 1.0;
                } else {
                    this.startLaserAttack(p);
                }
            } else if (this.phase === 1) {
                if (r < 0.35) {
                    this.fireRadialBurst(14, 120, 0);
                    setTimeout(() => {
                        if (!this.dead && G.state === 'play') {
                            this.fireRadialBurst(14, 120, Math.PI / 14);
                        }
                    }, 350);
                    this.state = 'idle';
                    this.stateTimer = 1.1;
                } else if (r < 0.70) {
                    this.startLaserAttack(p);
                } else {
                    this.startMortarAttack(p, 3);
                }
            } else {
                if (r < 0.35) {
                    this.startLaserAttack(p);
                } else if (r < 0.70) {
                    this.startMortarAttack(p, 4);
                } else {
                    this.fireRadialBurst(14, 125, 0);
                    setTimeout(() => {
                        if (!this.dead && G.state === 'play') {
                            this.fireRadialBurst(14, 125, Math.PI / 14);
                        }
                    }, 320);
                    this.state = 'idle';
                    this.stateTimer = 0.95;
                }
            }
        }

        fireRadialBurst(count, speed, offsetAngle = 0) {
            window.AU.play('shoot', 0.85);
            for (let i = 0; i < count; i++) {
                const a = (i * Math.PI * 2) / count + this.rot + offsetAngle;
                G.ebullets.push(new Projectile({
                    x: this.x, y: this.y,
                    angle: a, speed: speed,
                    dmg: 1, range: 420,
                    color: C.red, radius: 3, isEnemy: true
                }));
            }
        }

        startLaserAttack(p) {
            this.state = 'telegraph_laser';
            this.stateTimer = 0.75;
            const pAng = Math.atan2(p.y - this.y, p.x - this.x);
            const sweepDir = Math.random() < 0.5 ? 1 : -1;
            this.laserAngle = pAng - 0.55 * sweepDir;
            this.laserSweepSpeed = 1.1 * sweepDir;
            window.AU.play('telegraph');
        }

        startMortarAttack(p, count = 3) {
            this.state = 'mortar_firing';
            this.stateTimer = 0.7;
            window.AU.play('telegraph');

            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (this.dead || G.state !== 'play') return;
                    const targetX = Math.max(60, Math.min(G.room.w - 60, G.p.x + G.p.vx * 0.4 + (Math.random() - 0.5) * 20));
                    const targetY = Math.max(60, Math.min(G.room.h - 60, G.p.y + G.p.vy * 0.4 + (Math.random() - 0.5) * 20));
                    this.mortars.push({
                        x: targetX,
                        y: targetY,
                        timer: 0.85,
                        maxTimer: 0.85,
                        r: 26
                    });
                    window.AU.play('telegraph', 1.3);
                }, i * 220);
            }
        }

        takeDamage(dmg, isCrit = false) {
            if (this.dead) return;
            this.hp = Math.max(0, this.hp - dmg);
            this.flash = 0.08;
            G.damageDealt += dmg;
            G.hitstop(isCrit ? 0.04 : 0.02);
            window.AU.play(isCrit ? 'crit' : 'hit');
            G.floatText(this.x + (Math.random() - 0.5) * 20, this.y - 22, isCrit ? `暴击 ${Math.round(dmg)}` : Math.round(dmg), isCrit ? C.red : col(5), isCrit ? 1.4 : 1.0);
            G.burst(this.x, this.y, isCrit ? 10 : 5, isCrit ? C.red : col(4), 100);
            G.updateBossHUD();

            if (this.hp <= 0) {
                this.die();
            }
        }

        die() {
            this.dead = true;
            G.shake(1.0);
            G.hitstop(0.08);
            window.AU.play('explode');
            G.burst(this.x, this.y, 45, C.gold, 180);
            G.ebullets = [];

            setTimeout(() => {
                G.state = 'victory';
                UI.showEndModal();
            }, 1600);
        }

        render(ctx) {
            ctx.save();

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.ellipse(Math.round(this.x), Math.round(this.y + 24), 28, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Render Floor Mortar Reticles
            this.mortars.forEach(m => {
                const progress = 1 - (m.timer / m.maxTimer);
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 68, 68, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 68, 68, 0.2)';
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r * progress, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = C.red;
                ctx.setLineDash([]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(m.x - 4, m.y); ctx.lineTo(m.x + 4, m.y);
                ctx.moveTo(m.x, m.y - 4); ctx.lineTo(m.x, m.y + 4);
                ctx.stroke();
                ctx.restore();
            });

            // Render Laser Telegraph (Warning guide line)
            if (this.state === 'telegraph_laser') {
                ctx.save();
                ctx.translate(Math.round(this.x), Math.round(this.y));
                ctx.rotate(this.laserAngle);
                ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(290, 0);
                ctx.stroke();
                ctx.restore();
            }

            // Render Active Firing Laser
            if (this.state === 'fire_laser') {
                ctx.save();
                ctx.translate(Math.round(this.x), Math.round(this.y));
                ctx.rotate(this.laserAngle);
                ctx.strokeStyle = C.red;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(290, 0);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.restore();
            }

            // Hovering Monolith Body Sprite with floating wings
            const hoverY = this.y + Math.sin(this.rot * 2) * 4;
            const wingOffX = 18 + Math.sin(this.rot) * 3;

            // Left wing
            drawSprite(ctx, 'monolith_wing', this.x - wingOffX, hoverY, -0.2, true, 1);
            // Right wing
            drawSprite(ctx, 'monolith_wing', this.x + wingOffX, hoverY, 0.2, false, 1);
            // Main Monolith Hull
            drawSprite(ctx, 'monolith_body', this.x, hoverY, 0, false, 1);

            // Glowing silhouette flash on hit
            if (this.flash > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = Math.min(1, this.flash * 8);
                drawSprite(ctx, 'monolith_wing', this.x - wingOffX, hoverY, -0.2, true, 1);
                drawSprite(ctx, 'monolith_wing', this.x + wingOffX, hoverY, 0.2, false, 1);
                drawSprite(ctx, 'monolith_body', this.x, hoverY, 0, false, 1);
                ctx.restore();
            }

            // Phase 3 Overdrive Crimson Ring
            if (this.phase === 2) {
                ctx.strokeStyle = C.red;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, hoverY, 34 + Math.sin(this.rot * 4) * 2, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 10. PROJECTILE CLASS
    // -------------------------------------------------------------------------
    class Projectile {
        constructor(cfg) {
            this.x = cfg.x; this.y = cfg.y;
            this.vx = Math.cos(cfg.angle) * cfg.speed;
            this.vy = Math.sin(cfg.angle) * cfg.speed;
            this.dmg = cfg.dmg || 8;
            this.range = cfg.range || 300;
            this.traveled = 0;
            this.color = cfg.color || col(5);
            this.radius = cfg.radius || 3;
            this.isEnemy = !!cfg.isEnemy;
            this.bounces = cfg.bounces || 0;
            this.pierce = cfg.pierce || 0;
            this.seeking = !!cfg.seeking;
            this.isRocket = !!cfg.isRocket;
            this.isChakram = !!cfg.isChakram;
            this.aoe = cfg.aoe || 40;
            this.owner = cfg.owner;
            this.returning = false;
            this.dead = false;
        }

        update(dt) {
            if (this.seeking) {
                let target = null;
                let minDist = 180;
                G.enemies.forEach((e) => {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < minDist) { minDist = d; target = e; }
                });
                if (target) {
                    const ang = Math.atan2(target.y - this.y, target.x - this.x);
                    const curAng = Math.atan2(this.vy, this.vx);
                    const newAng = curAng + (ang - curAng) * 0.15;
                    const spd = Math.hypot(this.vx, this.vy);
                    this.vx = Math.cos(newAng) * spd;
                    this.vy = Math.sin(newAng) * spd;
                }
            }

            if (this.isChakram && this.traveled > this.range * 0.5) {
                this.returning = true;
                const ang = Math.atan2(G.p.y - this.y, G.p.x - this.x);
                this.vx = Math.cos(ang) * 260;
                this.vy = Math.sin(ang) * 260;
                if (Math.hypot(G.p.x - this.x, G.p.y - this.y) < 14) this.dead = true;
            }

            const stepX = this.vx * dt;
            const stepY = this.vy * dt;
            this.x += stepX;
            this.y += stepY;
            this.traveled += Math.hypot(stepX, stepY);

            if (this.traveled >= this.range && !this.isChakram) {
                this.die();
                return;
            }

            const r = G.room;
            if (r) {
                let hitWall = false;
                if (this.x < r.x + 12 || this.x > r.x + r.w - 12) { this.vx = -this.vx; hitWall = true; }
                if (this.y < r.y + 12 || this.y > r.y + r.h - 12) { this.vy = -this.vy; hitWall = true; }

                if (hitWall) {
                    if (this.bounces > 0) {
                        this.bounces--;
                        window.AU.play('deflect', 1.4);
                    } else {
                        this.die();
                        return;
                    }
                }
            }

            if (this.isEnemy) {
                const p = G.p;
                if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.radius) {
                    this.dead = true;
                    p.takeDamage(this.dmg, this.x, this.y);
                }
            } else {
                G.enemies.forEach((e) => {
                    if (e.dead || this.dead) return;
                    if (Math.hypot(e.x - this.x, e.y - this.y) < e.r + this.radius) {
                        if (this.isRocket) {
                            this.die();
                        } else {
                            if (this.pierce <= 0) this.dead = true;
                            else this.pierce--;
                            G.hitEnemy(e, this.dmg, { fromAngle: Math.atan2(this.vy, this.vx) });
                        }
                    }
                });

                if (G.boss && !G.boss.dead && !this.dead) {
                    if (Math.hypot(G.boss.x - this.x, G.boss.y - this.y) < G.boss.r + this.radius) {
                        if (this.isRocket) {
                            this.die();
                        } else {
                            if (this.pierce <= 0 && !this.isChakram) this.dead = true;
                            else if (this.pierce > 0) this.pierce--;
                            G.hitBoss(this.dmg, { fromAngle: Math.atan2(this.vy, this.vx) });
                        }
                    }
                }
            }
        }

        die() {
            this.dead = true;
            if (this.isRocket) {
                G.createExplosion(this.x, this.y, this.aoe, this.dmg, C.orange);
            }
        }

        render(ctx) {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.fillRect(Math.round(this.x - this.radius), Math.round(this.y - this.radius), this.radius * 2, this.radius * 2);
            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 11. DUNGEON ROOMS & TILED ENVIRONMENT
    // -------------------------------------------------------------------------
    class Room {
        constructor(floorNum) {
            this.floorNum = floorNum;
            this.w = 560;
            this.h = 360;
            this.x = 0;
            this.y = 0;
            this.obstacles = [];
            this.pickups = [];
            this.cleared = false;
            this.portal = null;

            this.generate();
        }

        generate() {
            if (this.floorNum === 3) {
                const pillars = [
                    { x: 50, y: 50 }, { x: this.w - 78, y: 50 },
                    { x: 50, y: this.h - 78 }, { x: this.w - 78, y: this.h - 78 }
                ];
                pillars.forEach((p) => {
                    this.obstacles.push({
                        x: p.x, y: p.y, w: 28, h: 28,
                        type: 'crate',
                        broken: false
                    });
                });
                return;
            }

            const count = 6;
            for (let i = 0; i < count; i++) {
                const ox = 90 + (i % 3) * 160;
                const oy = 90 + Math.floor(i / 3) * 130;
                this.obstacles.push({
                    x: ox, y: oy, w: 28, h: 28,
                    type: i % 2 === 0 ? 'crate' : 'barrel',
                    broken: false
                });
            }

            if (this.floorNum === 1) {
                this.pickups.push({ type: 'weapon', weapon: WEAPONS.scatter, x: this.w / 2 - 40, y: this.h / 2 - 30 });
                this.pickups.push({ type: 'weapon', weapon: WEAPONS.edge, x: this.w / 2 + 40, y: this.h / 2 - 30 });
            } else if (this.floorNum === 2) {
                this.pickups.push({ type: 'chest', opened: false, x: this.w / 2, y: this.h / 2 });
            }
        }

        render(ctx) {
            // Textured floor
            ctx.fillStyle = col(1);
            ctx.fillRect(this.x, this.y, this.w, this.h);

            ctx.strokeStyle = col(2);
            ctx.lineWidth = 1;
            const tileSize = 28;
            for (let x = this.x; x <= this.x + this.w; x += tileSize) {
                ctx.beginPath(); ctx.moveTo(x, this.y); ctx.lineTo(x, this.y + this.h); ctx.stroke();
            }
            for (let y = this.y; y <= this.y + this.h; y += tileSize) {
                ctx.beginPath(); ctx.moveTo(this.x, y); ctx.lineTo(this.x + this.w, y); ctx.stroke();
            }

            // 3D Perspective Walls
            ctx.fillStyle = col(0);
            ctx.fillRect(this.x, this.y, this.w, 14);
            ctx.fillRect(this.x, this.y + this.h - 14, this.w, 14);
            ctx.fillRect(this.x, this.y, 14, this.h);
            ctx.fillRect(this.x + this.w - 14, this.y, 14, this.h);

            ctx.strokeStyle = col(3);
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x + 14, this.y + 14, this.w - 28, this.h - 28);

            // Obstacles: High quality pixel art crates and barrels
            this.obstacles.forEach((obs) => {
                if (obs.broken) return;
                const sprKey = obs.type === 'crate' ? 'crate' : 'barrel';
                drawSprite(ctx, sprKey, obs.x + obs.w / 2, obs.y + obs.h / 2, 0, false, 1.8);
            });

            // Pickups & Chests
            this.pickups.forEach((pu) => {
                if (pu.type === 'weapon') {
                    const hover = Math.sin(Date.now() * 0.005 + pu.x) * 3;
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
                    ctx.beginPath();
                    ctx.ellipse(pu.x, pu.y + 12, 14, 5, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = C.cyan;
                    ctx.strokeRect(pu.x - 12, pu.y - 12 + hover, 24, 24);
                    drawSprite(ctx, pu.weapon.spr || 'w_nail', pu.x, pu.y + hover, 0, false, 1.4);

                    const pDist = Math.hypot(G.p.x - pu.x, G.p.y - pu.y);
                    ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
                    ctx.textAlign = 'center';
                    if (pDist < 35) {
                        ctx.fillStyle = C.cyan;
                        ctx.fillText(`[E] 拾取 ${pu.weapon.name}`, pu.x, pu.y - 16 + hover);
                    } else {
                        ctx.fillStyle = col(5);
                        ctx.fillText(pu.weapon.name, pu.x, pu.y - 16 + hover);
                    }
                    ctx.restore();
                } else if (pu.type === 'chest') {
                    const sprKey = pu.opened ? 'chest_open' : 'chest';
                    drawSprite(ctx, sprKey, pu.x, pu.y, 0, false, 1.6);
                    if (!pu.opened) {
                        const pDist = Math.hypot(G.p.x - pu.x, G.p.y - pu.y);
                        if (pDist < 35) {
                            ctx.save();
                            ctx.fillStyle = C.gold;
                            ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText('[E] 开启战术补给箱', pu.x, pu.y - 18);
                            ctx.restore();
                        }
                    }
                }
            });

            // Cleared Room Portal: Stargate cyan rings
            if (this.cleared && this.portal) {
                ctx.save();
                ctx.translate(this.portal.x, this.portal.y);
                ctx.strokeStyle = C.cyan;
                ctx.lineWidth = 1.5;
                const rot = Date.now() * 0.003;
                ctx.rotate(rot);
                ctx.strokeRect(-14, -14, 28, 28);
                ctx.rotate(-rot * 2);
                ctx.strokeRect(-9, -9, 18, 18);

                const pDist = Math.hypot(G.p.x - this.portal.x, G.p.y - this.portal.y);
                if (pDist < 45) {
                    ctx.rotate(rot);
                    ctx.fillStyle = C.cyan;
                    ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('踏入传送门 [进入下一区]', 0, -22);
                }
                ctx.restore();
            }
        }
    }

    // -------------------------------------------------------------------------
    // 12. UI & HUD
    // -------------------------------------------------------------------------
    const UI = {
        updatePlayerHUD() {
            const p = G.p;
            if (!p) return;

            const curHp = Math.max(0, Math.ceil(p.hp));
            const hpPct = Math.max(0, Math.min(100, (curHp / p.maxHp) * 100));
            document.getElementById('hp-bar').style.width = `${hpPct}%`;
            document.getElementById('hp-damage-bar').style.width = `${hpPct}%`;
            document.getElementById('hp-text').textContent = `${curHp}/${p.maxHp}`;

            const curArmor = Math.max(0, p.armor);
            const armorPct = Math.max(0, Math.min(100, (curArmor / p.maxArmor) * 100));
            document.getElementById('shield-bar').style.width = `${armorPct}%`;
            document.getElementById('shield-text').textContent = `${curArmor}/${p.maxArmor}`;

            document.getElementById('exp-text').textContent = `${G.ink}`;
            document.getElementById('exp-bar').style.width = `${Math.min(100, (G.ink % 20) * 5)}%`;

            const pips = document.getElementById('dash-pips-container').children;
            for (let i = 0; i < pips.length; i++) {
                if (i < p.dashCharges) pips[i].classList.add('ready');
                else pips[i].classList.remove('ready');
            }
        },

        updateWeaponsDisplay() {
            const p = G.p;
            if (!p) return;

            p.weapons.forEach((w, idx) => {
                const nameEl = document.getElementById(`w${idx}-name`);
                const ammoEl = document.getElementById(`w${idx}-ammo`);
                const slotEl = document.getElementById(`weapon-slot-${idx}`);

                if (nameEl && ammoEl && slotEl) {
                    nameEl.textContent = w.name;
                    ammoEl.textContent = w.kind === 'melee' ? '∞' : `${w.ammo} / ${w.mag}`;
                    if (idx === p.wi) slotEl.classList.add('active');
                    else slotEl.classList.remove('active');
                }
            });
        },

        updateRoomDisplay(floorNum) {
            const badge = document.getElementById('room-badge');
            const txt = document.getElementById('room-name-text');
            if (floorNum === 3) {
                txt.textContent = '终焉区 // 虚空神殿';
            } else if (floorNum === 2) {
                txt.textContent = '第二区 // 核心熔炉';
            } else {
                txt.textContent = '第一区 // 潜入行动';
            }

            if (G.room.cleared) badge.classList.add('cleared');
            else badge.classList.remove('cleared');
        },

        renderRelicsTray() {
            const tray = document.getElementById('relics-tray');
            tray.innerHTML = '';
            for (const id in G.shards) {
                const s = SHARDS.find((x) => x.id === id);
                if (s) {
                    const el = document.createElement('div');
                    el.className = 'relic-badge';
                    el.textContent = s.icon;
                    el.title = `${s.name}: ${s.desc}`;
                    tray.appendChild(el);
                }
            }
        },

        showCardModal(cards) {
            const grid = document.getElementById('cards-grid');
            grid.innerHTML = '';

            cards.forEach((c, idx) => {
                const card = document.createElement('div');
                card.className = `perk-card rar-${c.rar}`;
                card.innerHTML = `
                    <div class="card-key">[${idx + 1}]</div>
                    <div class="perk-icon">${c.icon}</div>
                    <div class="perk-title">${c.name}</div>
                    <div class="perk-desc">${c.desc}</div>
                    <div class="perk-rarity">${c.tag}</div>
                `;
                card.addEventListener('click', () => G.chooseCard(idx));
                grid.appendChild(card);
            });

            document.getElementById('level-modal').classList.add('active');
        },

        showEndModal() {
            const isVictory = G.state === 'victory';
            const title = document.getElementById('end-title');
            title.className = `game-over-title ${isVictory ? 'victory' : 'defeat'}`;
            title.textContent = isVictory ? '虚空方碑已崩解 // 任务达成' : '系统离线 // 作战失败';

            document.getElementById('stat-chamber').textContent = `第 ${G.floor} 区 / 3`;
            document.getElementById('stat-kills').textContent = G.kills;
            document.getElementById('stat-combo').textContent = `x${G.comboMax}`;
            document.getElementById('stat-damage').textContent = Math.round(G.damageDealt);
            const m = Math.floor(G.runTime / 60);
            const s = Math.floor(G.runTime % 60);
            document.getElementById('stat-time').textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            document.getElementById('stat-relics').textContent = Object.keys(G.shards).length;

            document.getElementById('end-modal').classList.add('active');
        },

        renderMinimap() {
            MINIMAP_CTX.fillStyle = col(0);
            MINIMAP_CTX.fillRect(0, 0, 130, 130);

            const r = G.room;
            if (!r) return;

            const scaleX = 110 / r.w;
            const scaleY = 110 / r.h;
            const offX = 10; const offY = 10;

            MINIMAP_CTX.strokeStyle = col(3);
            MINIMAP_CTX.strokeRect(offX, offY, r.w * scaleX, r.h * scaleY);

            MINIMAP_CTX.fillStyle = C.red;
            G.enemies.forEach((e) => {
                MINIMAP_CTX.fillRect(offX + e.x * scaleX - 1, offY + e.y * scaleY - 1, 2, 2);
            });

            if (G.boss && !G.boss.dead) {
                MINIMAP_CTX.fillStyle = C.gold;
                MINIMAP_CTX.fillRect(offX + G.boss.x * scaleX - 3, offY + G.boss.y * scaleY - 3, 6, 6);
            }

            if (r.cleared && r.portal) {
                MINIMAP_CTX.fillStyle = C.cyan;
                MINIMAP_CTX.fillRect(offX + r.portal.x * scaleX - 2, offY + r.portal.y * scaleY - 2, 4, 4);
            }

            MINIMAP_CTX.fillStyle = col(5);
            MINIMAP_CTX.fillRect(offX + G.p.x * scaleX - 2, offY + G.p.y * scaleY - 2, 4, 4);
        }
    };

    function distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    // Auto-launch & Global Reference
    window.G = G;
    window.addEventListener('DOMContentLoaded', () => G.init());
})();
