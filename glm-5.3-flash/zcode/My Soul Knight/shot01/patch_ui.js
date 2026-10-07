/* 一次性补丁脚本：render.js + audio.js + index.html + main.js 拓展（执行后可删除） */
'use strict';
const fs = require('fs');
const must = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
const rep = (file, oldStr, newStr, tag, all) => {
  let s = fs.readFileSync(file, 'utf8');
  must(s.includes(oldStr), file + ' anchor: ' + tag);
  s = all ? s.split(oldStr).join(newStr) : s.replace(oldStr, newStr);
  fs.writeFileSync(file, s);
};

/* ---------- render.js ---------- */
// 金币渲染
rep('js/render.js',
"function drawPickups(ctx, G, t) {\n  for (const pk of G.pickups) {\n    const bobY = Math.sin(t * 3 + pk.x) * 1.5;\n    const x = Math.round(pk.x), y = Math.round(pk.y + bobY);\n    const sp = makeSprite(pk.kind === 'crate' ? 'crate' : pk.kind);",
"function drawPickups(ctx, G, t) {\n  for (const pk of G.pickups) {\n    const bobY = Math.sin(t * 3 + pk.x) * 1.5;\n    const x = Math.round(pk.x), y = Math.round(pk.y + bobY);\n    if (pk.kind === 'coin') {\n      ctx.drawImage(makeGlow('#ffb84d', 7), x - 7, y - 7);\n      ctx.fillStyle = '#ffb84d';\n      ctx.fillRect(x - 2, y - 2, 4, 4);\n      ctx.fillStyle = '#ffe6b0';\n      ctx.fillRect(x - 1, y - 1, 2, 2);\n      continue;\n    }\n    const sp = makeSprite(pk.kind === 'crate' ? 'crate' : pk.kind);",
'coin render');

// 精英缩放变量
rep('js/render.js',
"    const sp = makeSprite(e.type);\n    if (!sp) continue;",
"    const sp = makeSprite(e.type);\n    if (!sp) continue;\n    const sc = e.elite ? 1.18 : 1;",
'elite sc');

// 精英光环（非 Boss）
rep('js/render.js',
"    ctx.save();\n    if (e.type !== 'guard') {\n      ctx.translate(x, y + bob);",
"    if (e.elite) ctx.drawImage(makeGlow('#ff4757', 13), x - 13, y - 13 + bob);\n    ctx.save();\n    if (e.type !== 'guard') {\n      ctx.translate(x, y + bob);",
'elite glow');

// 精英放大绘制（精灵 + 闪光剪影，两处 ×2）
rep('js/render.js',
"ctx.drawImage(sp.cv, -(sp.w >> 1), -(sp.h >> 1));",
"ctx.drawImage(sp.cv, -(sp.w * sc >> 1), -(sp.h * sc >> 1), sp.w * sc, sp.h * sc);",
'elite scale body', true);
rep('js/render.js',
"ctx.drawImage(sp.flash, -(sp.w >> 1), -(sp.h >> 1));",
"ctx.drawImage(sp.flash, -(sp.w * sc >> 1), -(sp.h * sc >> 1), sp.w * sc, sp.h * sc);",
'elite scale flash', true);

// 自爆蜂起爆预警 + 减速光环（插在血条之前）
rep('js/render.js',
"    // 血条（受损时）\n    if (e.hp < e.maxHp) {",
"    // 自爆蜂起爆预警\n    if (e.type === 'bomber' && e.state === 'arm') {\n      ctx.strokeStyle = hexA('#ff4757', 0.5 + Math.sin(t * 30) * 0.4);\n      ctx.lineWidth = 1.5;\n      ctx.beginPath();\n      ctx.arc(x, y, 12 + (e.t / 0.5) * 18, 0, TAU);\n      ctx.stroke();\n    }\n    // 冰霜减速光环\n    if (e.slowT > 0) {\n      ctx.strokeStyle = hexA('#45f0e2', 0.55);\n      ctx.lineWidth = 1;\n      ctx.beginPath();\n      ctx.arc(x, y, e.r + 3.5, 0, TAU);\n      ctx.stroke();\n    }\n    // 血条（受损时）\n    if (e.hp < e.maxHp) {",
'bomber warn + slow ring');

/* ---------- audio.js ---------- */
rep('js/audio.js',
"        case 'heal':",
"        case 'coin':\n          this._osc('square', 1400, 1900, t, 0.05, 0.06);\n          break;\n        case 'buy':\n          this._osc('square', 700, 700, t, 0.06, 0.08);\n          this._osc('square', 1050, 1050, t + 0.07, 0.1, 0.08);\n          break;\n        case 'heal':",
'coin/buy sfx');

/* ---------- index.html ---------- */
// 英雄选择 + 纪录
rep('index.html',
"    <div style=\"color:#6a6a76; font-size:calc(6px*var(--s)); letter-spacing:calc(1px*var(--s));\">黑白灰废土 · 高强度肉鸽弹幕射击</div>",
"    <div style=\"color:#6a6a76; font-size:calc(6px*var(--s)); letter-spacing:calc(1px*var(--s));\">黑白灰废土 · 高强度肉鸽弹幕射击</div>\n    <div id=\"heroRow\"></div>\n    <div id=\"records\"></div>",
'hero row');

// 金币 HUD
rep('index.html',
"      <div id=\"score\">得分 0</div>\n      <div id=\"combo\"></div>",
"      <div id=\"score\">得分 0</div>\n      <div id=\"coins\">金币 0</div>\n      <div id=\"combo\"></div>",
'coins hud');

// 商店遮罩
rep('index.html',
"  <div id=\"screenTitle\" class=\"screen show\">",
"  <div id=\"shopOverlay\">\n    <div id=\"shopTitle\">补 给 站</div>\n    <div id=\"shopTitleSub\">SUPPLY · 金币采购（区域间补给）</div>\n    <div id=\"shopCards\"></div>\n    <button class=\"btn\" id=\"btnShopLeave\">离开补给站</button>\n  </div>\n\n  <div id=\"screenTitle\" class=\"screen show\">",
'shop overlay');

// CSS
rep('index.html',
"/* ---------- 全屏界面 ---------- */",
"#coins { color: var(--amber); font-size: calc(6px * var(--s)); }\n#heroRow { display: flex; gap: calc(6px * var(--s)); margin-top: calc(4px * var(--s)); }\n.heroCard { width: calc(104px * var(--s)); padding: calc(5px * var(--s)); cursor: pointer; pointer-events: auto;\n  background: rgba(12,12,18,.95); border: 1px solid #3a3a44; transition: all .08s; }\n.heroCard:hover { border-color: #8b8b98; }\n.heroCard.sel { border-color: var(--accent); box-shadow: 0 0 calc(8px * var(--s)) rgba(69,240,226,.45); }\n.heroCard .hName { font-size: calc(8px * var(--s)); font-weight: bold; }\n.heroCard .hDesc { font-size: calc(6px * var(--s)); color: #a9a9b4; margin-top: calc(2px * var(--s)); }\n#records { font-size: calc(6px * var(--s)); color: #8b8b98; letter-spacing: calc(1px * var(--s)); margin-top: calc(4px * var(--s)); }\n#shopOverlay { position: absolute; inset: 0; z-index: 50; display: none;\n  background: rgba(5,5,8,.86); align-items: center; justify-content: center; flex-direction: column; gap: calc(6px * var(--s)); }\n#shopOverlay.show { display: flex; }\n#shopTitle { font-size: calc(11px * var(--s)); letter-spacing: calc(2px * var(--s)); color: var(--amber);\n  text-shadow: 0 0 calc(8px * var(--s)) rgba(255,184,77,.7); }\n#shopTitleSub { font-size: calc(6px * var(--s)); color: #6a6a76; letter-spacing: calc(1.5px * var(--s)); }\n#shopCards { display: flex; gap: calc(8px * var(--s)); }\n.shopCard { width: calc(96px * var(--s)); padding: calc(6px * var(--s)); cursor: pointer; pointer-events: auto;\n  background: rgba(12,12,18,.95); border: 1px solid #3a3a44; transition: transform .08s, box-shadow .08s; }\n.shopCard:hover { transform: translateY(calc(-3px * var(--s))); }\n.shopCard.sold { opacity: .35; cursor: default; }\n.shopCard.sold:hover { transform: none; }\n.shopCard .sName { font-size: calc(8px * var(--s)); font-weight: bold; }\n.shopCard .sDesc { font-size: calc(6px * var(--s)); color: #a9a9b4; min-height: calc(18px * var(--s)); margin: calc(2px * var(--s)) 0; }\n.shopCard .sPrice { font-size: calc(7px * var(--s)); color: var(--amber); }\n\n/* ---------- 全屏界面 ---------- */",
'css');

/* ---------- main.js ---------- */
// 英雄选择 + 商店 UI + 金币 HUD + 纪录存档
rep('js/main.js',
"const G = GAME.createGame({ seed, canvas });\nwindow.G = G;\nconst bot = BOT.createBot(seed);\nlet botOn = botParam;",
"const G = GAME.createGame({ seed, canvas });\nwindow.G = G;\nconst bot = BOT.createBot(seed);\nlet botOn = botParam;\nlet selHero = 'vanguard';\n\n/* 历史纪录（localStorage，file:// 下同样可用） */\nconst store = {\n  get() { try { return JSON.parse(localStorage.getItem('zp_records') || 'null'); } catch (e) { return null; } },\n  set(v) { try { localStorage.setItem('zp_records', JSON.stringify(v)); } catch (e) {} },\n};\nfunction showRecords() {\n  const el2 = document.getElementById('records');\n  if (!el2) return;\n  const r = store.get();\n  el2.textContent = r ? ('最佳纪录 · 通关 ' + r.clears + ' 次 · 最高分 ' + r.bestScore + ' · 最高连击 ×' + r.maxCombo + (isFinite(r.bestTime) ? ' · 最速 ' + r.bestTime.toFixed(0) + 's' : '')) : '尚无通关纪录 · 成为第一位协议完成者';\n}\n\n/* 英雄选择卡片 */\nfunction buildHeroCards() {\n  const row = document.getElementById('heroRow');\n  if (!row) return;\n  row.innerHTML = '';\n  for (const hid of Object.keys(C.HEROES)) {\n    const h = C.HEROES[hid];\n    const d = document.createElement('div');\n    d.className = 'heroCard' + (hid === selHero ? ' sel' : '');\n    d.innerHTML = '<div class=\"hName\">' + h.name + '</div><div class=\"hDesc\">' + h.desc + '</div>';\n    d.addEventListener('click', () => {\n      selHero = hid; AUDIO.play('ui');\n      row.querySelectorAll('.heroCard').forEach(x => x.classList.remove('sel'));\n      d.classList.add('sel');\n    });\n    row.appendChild(d);\n  }\n}\nbuildHeroCards();\nshowRecords();",
'main hero');

// startRun 传入英雄 + 刷新纪录显示
rep('js/main.js',
"function startRun(withBot) {\n  AUDIO.init(); AUDIO.resume();\n  botOn = !!withBot;\n  G.startRun();",
"function startRun(withBot) {\n  AUDIO.init(); AUDIO.resume();\n  botOn = !!withBot;\n  G.startRun(selHero);",
'startRun hero');

// bot 门控加入 shop
rep('js/main.js',
"  if (botOn && (G.state === 'playing' || G.state === 'chip')) {\n    bot.update(G, dt, G.input);\n  }",
"  if (botOn && (G.state === 'playing' || G.state === 'chip' || G.state === 'shop')) {\n    bot.update(G, dt, G.input);\n  }",
'bot gate');

// HUD：金币 + 商店遮罩 + 胜利存档
rep('js/main.js',
"  // 得分 / 连击\n  ui.score.textContent = '得分 ' + G.score;",
"  // 金币\n  ui.coins.textContent = '金币 ' + G.coins;\n  // 得分 / 连击\n  ui.score.textContent = '得分 ' + G.score;",
'coins hud update');
rep('js/main.js',
"  ui.btnStart: el('btnStart'), ui.btnBot: el('btnBot'), ui.btnHelp: el('btnHelp'), ui.btnRetry: el('btnRetry'),",
"  ui.btnStart: el('btnStart'), ui.btnBot: el('btnBot'), ui.btnHelp: el('btnHelp'), ui.btnRetry: el('btnRetry'),\n  coins: el('coins'), shopOverlay: el('shopOverlay'), shopCards: el('shopCards'), btnShopLeave: el('btnShopLeave'),",
'ui refs');

// 商店卡片渲染
rep('js/main.js',
"/* ---------- HUD ---------- */",
"/* ---------- 商店 ---------- */\nfunction showShop() {\n  if (!G.shopItems) return;\n  ui.shopCards.innerHTML = '';\n  G.shopItems.forEach((it, i) => {\n    const div = document.createElement('div');\n    div.className = 'shopCard' + (it.sold ? ' sold' : '');\n    div.innerHTML =\n      '<div class=\"ccRarity\" style=\"color:' + ['', '#a9a9b4', '#45f0e2', '#ffb84d'][it.rarity || 1] + '\">' + it.name + '</div>' +\n      '<div class=\"sDesc\">' + it.desc + '</div>' +\n      '<div class=\"sPrice\">' + (it.sold ? '已购入' : '◆ ' + it.price + ' 金币') + '</div>';\n    if (!it.sold) div.addEventListener('click', () => { G.shopBuy(i); AUDIO.play('buy'); });\n    ui.shopCards.appendChild(div);\n  });\n}\nui.btnShopLeave.addEventListener('click', () => { AUDIO.play('ui'); G.shopLeave(); });\n\n/* ---------- HUD ---------- */",
'shop ui');

// drawFrame：商店遮罩显隐 + 结算存档
rep('js/main.js',
"  if (G.state === 'chip' && G.chipOffer && !ui.chipOverlay.classList.contains('show')) showChipOffer();\n  if (G.state !== 'chip') ui.chipOverlay.classList.remove('show');",
"  if (G.state === 'chip' && G.chipOffer && !ui.chipOverlay.classList.contains('show')) showChipOffer();\n  if (G.state !== 'chip') ui.chipOverlay.classList.remove('show');\n  if (G.state === 'shop' && !ui.shopOverlay.classList.contains('show')) showShop();\n  if (G.state !== 'shop') ui.shopOverlay.classList.remove('show');",
'drawFrame shop');
rep('js/main.js',
"function showEnd(es) {\n  ui.endTitle.textContent = es.victory ? '通 关 胜 利' : '任 务 失 败';",
"function showEnd(es) {\n  if (es.victory) {\n    const r = store.get() || { clears: 0, bestScore: 0, maxCombo: 0, bestTime: Infinity };\n    r.clears = (r.clears || 0) + 1;\n    r.bestScore = Math.max(r.bestScore || 0, es.stats.score);\n    r.maxCombo = Math.max(r.maxCombo || 0, es.stats.maxCombo);\n    r.bestTime = Math.min(r.bestTime || Infinity, es.stats.time);\n    store.set(r);\n  }\n  showRecords();\n  ui.endTitle.textContent = es.victory ? '通 关 胜 利' : '任 务 失 败';",
'records save');

// 商店卡片售出后刷新
rep('js/main.js',
"  if (G.state === 'shop' && !ui.shopOverlay.classList.contains('show')) showShop();",
"  if (G.state === 'shop' && !ui.shopOverlay.classList.contains('show')) showShop();\n  else if (G.state === 'shop') showShop();",
'shop refresh');

console.log('render/audio/html/main patched OK');
