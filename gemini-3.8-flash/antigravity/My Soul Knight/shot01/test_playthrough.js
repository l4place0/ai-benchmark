const fs = require('fs');
const path = require('path');

// Mock Browser Environment
const listeners = {};
const elements = {};

function createMockElement(id = '', tag = 'div') {
    return {
        id,
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        children: [
            { classList: { add(){}, remove(){} } },
            { classList: { add(){}, remove(){} } },
            { classList: { add(){}, remove(){} } }
        ],
        textContent: '',
        innerHTML: '',
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(event, fn) {},
        getBoundingClientRect() { return { left: 0, top: 0, width: 480, height: 270 }; }
    };
}

const mockCtx = {
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage() {}, fillText() {}, setLineDash() {},
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', font: '', textAlign: ''
};

const mockCanvas = {
    width: 480, height: 270,
    getContext(type) { return mockCtx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 480, height: 270 }; }
};

global.window = {
    addEventListener(event, fn) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
    },
    removeEventListener() {},
    AU: {
        ensureContext() {},
        toggleMute() { return false; },
        play() {},
        setRoot() {},
        setMode() {}
    }
};

global.document = {
    getElementById(id) {
        if (id === 'game-canvas' || id === 'minimap-canvas') return mockCanvas;
        if (!elements[id]) elements[id] = createMockElement(id);
        return elements[id];
    },
    createElement(tag) {
        if (tag === 'canvas') {
            return {
                width: 16, height: 16,
                getContext() { return mockCtx; }
            };
        }
        return createMockElement('', tag);
    },
    addEventListener(event, fn) {
        window.addEventListener(event, fn);
    }
};

global.requestAnimationFrame = (fn) => {};

// Virtual Timer Management
let simulatedTime = 0;
const virtualTimeouts = [];
global.setTimeout = (fn, delay = 0) => {
    virtualTimeouts.push({ at: simulatedTime + delay, fn });
};

// Load and evaluate game.js
const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
eval(gameCode);

// Trigger DOMContentLoaded
if (listeners['DOMContentLoaded']) {
    listeners['DOMContentLoaded'].forEach(fn => fn());
}

const G = window.G;
if (!G) {
    console.error('Failed to locate G on window!');
    process.exit(1);
}

console.log('>>> [TEST] 游戏引擎已加载，初始状态:', G.state, '第一区');
G.autoPlay = true;

let frame = 0;
const dt = 1 / 60;
let lastReportedFloor = 1;
let lastBossPhase = -1;
let lastLogFrame = 0;

console.log('>>> [TEST] 启动全自动 AI 代打通关测试...\n');

while (frame < 12000) {
    frame++;
    simulatedTime += dt * 1000;

    // Process due virtual timers
    for (let i = virtualTimeouts.length - 1; i >= 0; i--) {
        if (virtualTimeouts[i].at <= simulatedTime) {
            const item = virtualTimeouts.splice(i, 1)[0];
            try { item.fn(); } catch (err) { console.error('Timer error:', err); }
        }
    }

    // Step game loop
    G.loop(simulatedTime);

    // Floor transition tracking
    if (G.floor !== lastReportedFloor) {
        console.log(`[帧 ${frame} | ${(simulatedTime/1000).toFixed(1)}s] 成功进入 第 ${G.floor} 区！敌军数量: ${G.enemies.length}, 玩家生命: ${G.p.hp}/${G.p.maxHp}, 晶片: [${Object.keys(G.shards).join(', ')}]`);
        lastReportedFloor = G.floor;
    }

    // Boss Phase tracking
    if (G.boss && !G.boss.dead) {
        if (G.boss.phase !== lastBossPhase) {
            console.log(`[帧 ${frame} | ${(simulatedTime/1000).toFixed(1)}s] ⚔️ 虚空方碑 进入阶段 ${G.boss.phase + 1}！Boss血量: ${Math.round(G.boss.hp)}/${G.boss.maxHp}, 玩家生命: ${G.p.hp}/${G.p.maxHp}`);
            lastBossPhase = G.boss.phase;
        }

        // Periodic boss combat log
        if (frame - lastLogFrame > 180) {
            lastLogFrame = frame;
            console.log(`  └─ Boss交战中: Boss剩余HP ${Math.round(G.boss.hp)}/${G.boss.maxHp} (${((G.boss.hp/G.boss.maxHp)*100).toFixed(0)}%), 玩家HP: ${G.p.hp}/${G.p.maxHp}`);
        }
    } else if (frame % 180 === 0 && frame <= 2400) {
        const enInfo = G.enemies.map(e => `${e.type}(hp:${Math.round(e.hp)}, pos:${Math.round(e.x)},${Math.round(e.y)})`).join('; ');
        console.log(`[帧 ${frame}] 玩家: (${Math.round(G.p.x)}, ${Math.round(G.p.y)}), HP: ${G.p.hp}, 敌人剩余: [${enInfo}]`);
    }

    // Check Victory
    if (G.state === 'victory') {
        console.log(`\n======================================================`);
        console.log(`🎉 通关成功！[VICTORY] 系统达成全部目标！`);
        console.log(`======================================================`);
        console.log(`- 运行总帧数: ${frame} 帧 (游戏内耗时: ${(simulatedTime/1000).toFixed(1)} 秒)`);
        console.log(`- 击杀敌军总数: ${G.kills}`);
        console.log(`- 累计造成伤害: ${Math.round(G.damageDealt)}`);
        console.log(`- 最高连击数: ${G.comboMax}`);
        console.log(`- 玩家剩余生命: ${G.p.hp}/${G.p.maxHp}`);
        console.log(`- 装配战术晶片: ${Object.keys(G.shards).join(', ')}`);
        console.log(`- 激活协同羁绊: ${Object.keys(G.syn).filter(k => G.syn[k]).join(', ') || '无'}`);
        console.log(`======================================================\n`);
        process.exit(0);
    }

    // Check Failure
    if (G.state === 'dead') {
        console.error(`\n💀 玩家在第 ${G.floor} 区战败 (第 ${frame} 帧)`);
        process.exit(1);
    }
}

console.error(`测试超时 (超过 12000 帧)，最终状态: ${G.state}, 第 ${G.floor} 区`);
process.exit(2);
