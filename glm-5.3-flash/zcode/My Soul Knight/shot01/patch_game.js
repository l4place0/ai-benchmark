/* 一次性补丁脚本：game.js 内容拓展（执行后可删除） */
'use strict';
const fs = require('fs');
let s = fs.readFileSync('js/game.js', 'utf8');
const must = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
const rep = (oldStr, newStr, tag) => {
  must(s.includes(oldStr), 'anchor: ' + tag);
  s = s.replace(oldStr, newStr);
};

// 0) 解构 HEROES
rep("const { TAU, clamp, lerp, dist, angDiff, RNG, VIEW_W, VIEW_H, TILE,\n  WEAPONS, ENEMY_DEFS, CHIPS, SYNERGIES, MAPS, ZONES, BOSS_PHASES } = C;",
"const { TAU, clamp, lerp, dist, angDiff, RNG, VIEW_W, VIEW_H, TILE,\n  WEAPONS, ENEMY_DEFS, CHIPS, SYNERGIES, HEROES, MAPS, ZONES, BOSS_PHASES } = C;",
'destructure');

// 1) G 字段初始化
rep("    combo: 0, comboT: 0, maxCombo: 0,",
"    combo: 0, comboT: 0, maxCombo: 0,\n    coins: 0, coinsCollected: 0, shopVisits: 0, shopItems: null,\n    heroId: 'vanguard', bonusShield: 0, powerBonus: 0, dashEchoT: 0,",
'G fields');

// 2) computeStats：新字段默认值
rep("      railMul: 1, railAoe: 0,\n    };",
"      railMul: 1, railAoe: 0,\n      frost: 0, chain: 0, reload: 0, lucky: 0, dashEcho: 0, chainBig: 0, frostAmp: 0,\n    };",
'stat defaults');

// 3) computeStats：英雄 + 商店永久加成
rep("    if (s.noSplitPenalty && G.chips.includes('split')) s.dmg += 0.22;",
"    if (s.noSplitPenalty && G.chips.includes('split')) s.dmg += 0.22;\n    // 商店永久强化与英雄底子\n    s.shieldMax += (G.bonusShield || 0);\n    s.dmg *= (1 + (G.powerBonus || 0));\n    const H = HEROES[G.heroId] || HEROES.vanguard;\n    s.dmg *= H.dmg; s.speed *= H.speed; s.dashCd *= H.dashCd; s.crit += H.crit || 0;",
'hero stats');

// 4) 玩家上限按英雄
rep("      G.player.maxHp = Math.max(2, 6 + s.maxHpAdd);\n      G.player.maxShield = 3 + s.shieldMax;",
"      G.player.maxHp = Math.max(2, H.maxHp + s.maxHpAdd);\n      G.player.maxShield = H.shieldMax + s.shieldMax;",
'player caps');

// 5) echoMul 助手
rep("  function comboMul() { return 1 + Math.min(G.combo, 25) * 0.02; }",
"  function comboMul() { return 1 + Math.min(G.combo, 25) * 0.02; }\n  function echoMul() { return G.dashEchoT > 0 ? 1 + (G.stats ? (G.stats.dashEcho || 0) : 0) : 1; }",
'echoMul');

// 6) fireGun：冲刺回响 + 弹体类型
rep("      let dmg = w.dmg * s.dmg * dmgMul * comboMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
"      let dmg = w.dmg * s.dmg * dmgMul * comboMul() * echoMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
'fireGun echo');
rep("      spawnBullet(mx, my, p.a, w.speed * rng.range(0.95, 1.05), p.dmg, true, {\n        color: w.color, knock: w.knock, pierce: s.pierce, bounces: s.bounce,\n        life: w.range / w.speed, r: 2.5,\n      });",
"      spawnBullet(mx, my, p.a, w.speed * rng.range(0.95, 1.05), p.dmg, true, {\n        color: w.color, knock: w.knock, pierce: s.pierce, bounces: s.bounce,\n        life: w.bulletLife || w.range / w.speed, r: w.bulletR || 2.5, kind: w.kind,\n      });",
'fireGun bullet kind');

// 7) fireRail：回响
rep("      let dmg = w.dmg * s.dmg * s.railMul * comboMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
"      let dmg = w.dmg * s.dmg * s.railMul * comboMul() * echoMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
'rail echo');

// 8) melee：回响
rep("        let dmg = w.dmg * s.dmg * s.melee * comboMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
"        let dmg = w.dmg * s.dmg * s.melee * comboMul() * echoMul() * (G.vengeanceT > 0 ? 1 + s.revenge : 1);",
'melee echo');

// 9) damageEnemy：冰霜减速 + 减速易伤
rep("    e.hp -= dmg;\n    e.flash = 1; e.hitCd = 0.05;",
"    if (e.slowT > 0 && G.stats.frostAmp) dmg = dmg * 1.2;\n    e.hp -= dmg;\n    if (G.stats.frost) e.slowT = Math.max(e.slowT || 0, e.type === 'boss' ? 0.6 : (G.stats.frostAmp ? 2.2 : 1.8));\n    e.flash = 1; e.hitCd = 0.05;",
'frost');

// 10) integrateEnemy：减速生效
rep("  function integrateEnemy(e, dt) {\n    // 控制速度 + 击退速度，击退独立衰减（边界阻尼）",
"  function integrateEnemy(e, dt) {\n    // 冰霜减速\n    if (e.slowT > 0) {\n      e.slowT -= dt;\n      const f = e.type === 'boss' ? 0.85 : (G.stats.frostAmp ? 0.45 : 0.65);\n      e.vx *= f; e.vy *= f;\n    }\n    // 控制速度 + 击退速度，击退独立衰减（边界阻尼）",
'slow');

// 11) spawnEnemy：精英词条
rep("    G.enemies.push(e);\n    addParts(x, y, 8, ['#45f0e2', '#a9a9b4'], { spd: 60, life: 0.5 });\n    return e;",
"    // 精英词条（第 2 区起概率出现）\n    if (G.zoneIdx >= 1 && rng.chance(0.15)) {\n      e.elite = true;\n      e.hp *= 2.2; e.maxHp *= 2.2;\n      e.speed *= 1.05;\n    }\n    G.enemies.push(e);\n    addParts(x, y, 8, ['#45f0e2', '#a9a9b4'], { spd: 60, life: 0.5 });\n    return e;",
'elite');

// 12) 自爆蜂群 AI（插在 sniper 分支之后 / integrateEnemy 调用之前）
rep("    integrateEnemy(e, dt);\n  }\n\n  function integrateEnemy(e, dt) {",
"    } else if (e.type === 'bomber') {\n      if (e.state === 'arm') {\n        e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);\n        if (e.t > 0.5) {\n          // 起爆：不计击杀（无连击/金币）\n          e.dead = true;\n          explode(e.x, e.y, 38, 1, false, '#ff4757');\n        }\n      } else {\n        e.vx = Math.cos(aTo) * e.speed; e.vy = Math.sin(aTo) * e.speed;\n        e.facing = aTo;\n        addParts(e.x, e.y, 1, '#ffb84d', { spd: 14, life: 0.25, size: 1.4 });\n        if (d < 30) { e.state = 'arm'; e.t = 0; G.sfx('minePlace'); }\n      }\n    }\n\n    integrateEnemy(e, dt);\n  }\n\n  function integrateEnemy(e, dt) {",
'bomber AI');

// 13) 击杀掉落：金币 + 引爆核心 + 弹药回涌
rep("    e.dead = true;\n    addParts(e.x, e.y, 16, ['#a9a9b4', '#6a6a76', e.type === 'charger' ? '#ff4757' : '#45f0e2'], { spd: 150, life: 0.6, size: 2.4 });",
"    e.dead = true;\n    // 金币掉落\n    const luckyMul = G.stats.lucky ? 1.6 : 1;\n    const coinN = e.elite ? 3 : (e.type === 'guard' ? 2 : 1);\n    if (e.elite || rng.chance(0.65 * luckyMul)) {\n      for (let ci = 0; ci < coinN; ci++) {\n        G.pickups.push({ x: e.x + rng.range(-7, 7), y: e.y + rng.range(-7, 7), kind: 'coin', t: 0 });\n      }\n    }\n    // 引爆核心：敌人死亡爆炸\n    if (G.stats.chain) {\n      explode(e.x, e.y, G.stats.chainBig ? 42 : 26, (G.stats.chainBig ? 9 : 6) * G.stats.dmg, true, '#ffb84d');\n    }\n    // 弹药回涌\n    if (G.stats.reload) G.player.fireT *= 0.8;\n    addParts(e.x, e.y, 16, ['#a9a9b4', '#6a6a76', e.type === 'charger' ? '#ff4757' : '#45f0e2'], { spd: 150, life: 0.6, size: 2.4 });",
'kill drops');

// 14) updateBullets：追踪导弹转向
rep("      b.t += dt; b.life -= dt;\n      if (b.life <= 0) { G.bullets.splice(i, 1); continue; }",
"      b.t += dt; b.life -= dt;\n      if (b.life <= 0) {\n        if (b.kind === 'grenade') grenadeBoom(b);\n        G.bullets.splice(i, 1); continue;\n      }\n      // 游隼导弹：转向最近敌人\n      if (b.kind === 'homing' && b.friendly) {\n        let best = null, bd = 280;\n        for (const e of G.enemies) {\n          if (e.dead || e.spawning > 0) continue;\n          const dd = dist(b.x, b.y, e.x, e.y);\n          if (dd < bd) { bd = dd; best = e; }\n        }\n        if (best) {\n          const want = Math.atan2(best.y - b.y, best.x - b.x);\n          const cur = Math.atan2(b.vy, b.vx);\n          const na = cur + angDiff(cur, want) * Math.min(1, 3.6 * dt);\n          const sp = Math.hypot(b.vx, b.vy) || 1;\n          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;\n        }\n      }",
'homing steer');

// 15) updateBullets：榴弹撞墙爆炸（两处）
rep("          if (b.bounces > 0) { b.x -= stepX; b.vx = -b.vx * 0.92; b.bounces--; b.bounced = true; if (b.bounced && s.bouncePierce) b.pierce = 999; addParts(b.x, b.y, 3, b.color, { spd: 60, life: 0.2 }); }\n          else { addParts(b.x, b.y, 3, b.color, { spd: 70, life: 0.22 }); dead = true; }",
"          if (b.bounces > 0) { b.x -= stepX; b.vx = -b.vx * 0.92; b.bounces--; b.bounced = true; if (b.bounced && s.bouncePierce) b.pierce = 999; addParts(b.x, b.y, 3, b.color, { spd: 60, life: 0.2 }); }\n          else { if (b.kind === 'grenade') grenadeBoom(b); addParts(b.x, b.y, 3, b.color, { spd: 70, life: 0.22 }); dead = true; }",
'grenade wall X');
rep("          if (b.bounces > 0) { b.y -= stepY; b.vy = -b.vy * 0.92; b.bounces--; b.bounced = true; if (b.bounced && s.bouncePierce) b.pierce = 999; addParts(b.x, b.y, 3, b.color, { spd: 60, life: 0.2 }); }\n          else { addParts(b.x, b.y, 3, b.color, { spd: 70, life: 0.22 }); dead = true; }",
"          if (b.bounces > 0) { b.y -= stepY; b.vy = -b.vy * 0.92; b.bounces--; b.bounced = true; if (b.bounced && s.bouncePierce) b.pierce = 999; addParts(b.x, b.y, 3, b.color, { spd: 60, life: 0.2 }); }\n          else { if (b.kind === 'grenade') grenadeBoom(b); addParts(b.x, b.y, 3, b.color, { spd: 70, life: 0.22 }); dead = true; }",
'grenade wall Y');

// 16) updateBullets：榴弹命中敌人
rep("            const crit = b.crit || false;\n            damageEnemy(e, b.dmg, Math.atan2(b.vy, b.vx), b.knock, crit);",
"            const crit = b.crit || false;\n            damageEnemy(e, b.dmg, Math.atan2(b.vy, b.vx), b.knock, crit);\n            if (b.kind === 'grenade') { grenadeBoom(b); dead = true; break; }",
'grenade hit');

// 17) grenadeBoom 定义（放在 updateBullets 之前）
rep("  /* ---------------- 子弹 / 地雷 / 激光 ---------------- */\n  function updateBullets(dt) {",
"  /* ---------------- 子弹 / 地雷 / 激光 ---------------- */\n  function grenadeBoom(b) {\n    explode(b.x, b.y, 36, 10 * G.stats.dmg * comboMul() * echoMul(), true, '#ff8a3d');\n  }\n  function updateBullets(dt) {",
'grenadeBoom def');

// 18) 冲刺回响 + 回响衰减
rep("      P.dashCd = 0.9 * s.dashCd;\n      P.iframes = Math.max(P.iframes, 0.24);\n      G.sfx('dash');",
"      P.dashCd = 0.9 * s.dashCd;\n      P.iframes = Math.max(P.iframes, 0.24);\n      G.dashEchoT = G.stats.dashEcho ? (G.synActive.some(s2 => s2.id === 'phasekill') ? 2.0 : 1.0) : 0;\n      G.sfx('dash');",
'dash echo set');
rep("    G.vengeanceT = Math.max(0, (G.vengeanceT || 0) - dt);\n    G.killSpeedT = Math.max(0, (G.killSpeedT || 0) - dt);",
"    G.vengeanceT = Math.max(0, (G.vengeanceT || 0) - dt);\n    G.killSpeedT = Math.max(0, (G.killSpeedT || 0) - dt);\n    G.dashEchoT = Math.max(0, (G.dashEchoT || 0) - dt);",
'dash echo decay');

// 19) 金币拾取（磁吸）
rep("      const d = dist(P.x, P.y, pk.x, pk.y);\n      if (pk.kind === 'crate') {",
"      const d = dist(P.x, P.y, pk.x, pk.y);\n      if (pk.kind === 'coin') {\n        if (d < 32 && d > 0.01) {\n          const pull = Math.min(d, 170 * dt);\n          pk.x += (P.x - pk.x) / d * pull; pk.y += (P.y - pk.y) / d * pull;\n        }\n        if (d < 10) { G.coins++; G.coinsCollected++; G.sfx('coin'); G.pickups.splice(i, 1); }\n      } else if (pk.kind === 'crate') {",
'coin pickup');

// 20) 金币/电池 20 秒消失改为 25 秒且金币不过期
rep("      if (pk.kind === 'heart' || pk.kind === 'battery') {\n        // 20 秒后消失\n        if (pk.t > 20) G.pickups.splice(i, 1);\n      }",
"      if ((pk.kind === 'heart' || pk.kind === 'battery') && pk.t > 20) G.pickups.splice(i, 1);",
'pickup expiry');

// 21) chooseChip → 区域末尾开商店
rep("    G.chipOffer = null;\n    G.state = 'playing';\n    openPortal();\n  };",
"    G.chipOffer = null;\n    G.state = 'playing';\n    const zc = ZONES[G.zoneIdx];\n    if (G.roomIdx + 1 >= zc.maps.length) openShop();  // 区域末尾 → 补给站\n    else openPortal();\n  };",
'chooseChip shop');

// 22) 商店三件套（放在 openPortal 之后）
rep("    G.portal = { x: spot.x, y: spot.y, open: true, t: 0 };\n    G.sfx('portalOpen');\n    toast('传送门已开启', '#45f0e2');\n  }",
"    G.portal = { x: spot.x, y: spot.y, open: true, t: 0 };\n    G.sfx('portalOpen');\n    toast('传送门已开启', '#45f0e2');\n  };\n\n  function openShop() {\n    const disc = G.stats.lucky ? 0.85 : 1;\n    const P = (n) => Math.max(1, Math.round(n * disc));\n    const items = [{ kind: 'heal', name: '纳米医疗包', desc: '回复 2 点生命', price: P(6), rarity: 1 }];\n    const pool = ['chip', 'battery', 'weapon', 'power'];\n    for (let i = 0; i < 2; i++) {\n      const k = rng.pick(pool);\n      if (k === 'chip') {\n        const c = rng.pick(CHIPS);\n        items.push({ kind: 'chip', chipId: c.id, name: c.name, desc: c.desc, rarity: c.rarity, price: P(12) });\n      } else if (k === 'battery') {\n        items.push({ kind: 'battery', name: '护盾电容组', desc: '护盾上限 +1 并回满护盾', price: P(10), rarity: 2 });\n      } else if (k === 'weapon') {\n        const w = rng.pick(['smg', 'shotgun', 'railgun', 'homing', 'grenade'].filter(x => x !== G.weapons[0].id));\n        items.push({ kind: 'weapon', weapon: w, name: WEAPONS[w].name, desc: WEAPONS[w].desc, price: P(10), rarity: 2 });\n      } else {\n        items.push({ kind: 'power', name: '攻击强化剂', desc: '永久伤害 +8%', price: P(14), rarity: 3 });\n      }\n    }\n    G.shopItems = items;\n    G.shopVisits = (G.shopVisits || 0) + 1;\n    G.state = 'shop';\n    G.sfx('chipOffer');\n    toast('补给站已接入 · 使用金币采购', '#ffb84d');\n  }\n\n  G.shopBuy = function (i) {\n    if (G.state !== 'shop' || !G.shopItems || !G.shopItems[i] || G.shopItems[i].sold) return;\n    const it = G.shopItems[i];\n    if (G.coins < it.price) { toast('金币不足', '#ff4757'); G.sfx('clink'); return; }\n    G.coins -= it.price;\n    it.sold = true;\n    if (it.kind === 'heal') {\n      G.player.hp = Math.min(G.player.maxHp, G.player.hp + 2);\n      addFloater(G.player.x, G.player.y - 12, '+2', '#ff4757');\n    } else if (it.kind === 'chip') {\n      const before = G.synActive.map(s2 => s2.id);\n      G.chips.push(it.chipId);\n      G.computeStats();\n      const newly = G.synActive.filter(s2 => !before.includes(s2.id));\n      for (const syn of newly) { banner('羁绊激活 · ' + syn.name, syn.desc, '#ffb84d', 2.4); G.sfx('syn'); }\n    } else if (it.kind === 'battery') {\n      G.bonusShield = (G.bonusShield || 0) + 1;\n      G.computeStats();\n      G.player.shield = G.player.maxShield;\n    } else if (it.kind === 'weapon') {\n      G.weapons[0] = WEAPONS[it.weapon]; G.weaponSlot = 0;\n      G.computeStats();\n      toast('已换装：' + WEAPONS[it.weapon].name, '#ffb84d');\n    } else if (it.kind === 'power') {\n      G.powerBonus = (G.powerBonus || 0) + 0.08;\n      G.computeStats();\n    }\n    G.sfx('buy');\n  };\n\n  G.shopLeave = function () {\n    if (G.state !== 'shop') return;\n    G.shopItems = null;\n    G.state = 'playing';\n    G.sfx('ui');\n    openPortal();\n  };",
'shop funcs');

// 23) startRun(heroId)
rep("  G.startRun = function () {\n    G.chips = []; G.synActive = []; G.weaponSlot = 0;\n    G.weapons = [WEAPONS.smg, WEAPONS.blade];",
"  G.startRun = function (heroId) {\n    G.heroId = heroId || 'vanguard';\n    G.chips = []; G.synActive = []; G.weaponSlot = 0;\n    G.weapons = [WEAPONS[(HEROES[G.heroId] || HEROES.vanguard).weapon], WEAPONS.blade];\n    G.coins = 0; G.coinsCollected = 0; G.shopVisits = 0;\n    G.bonusShield = 0; G.powerBonus = 0; G.dashEchoT = 0; G.shopItems = null;",
'startRun hero');

fs.writeFileSync('js/game.js', s);
console.log('game.js patched OK');
