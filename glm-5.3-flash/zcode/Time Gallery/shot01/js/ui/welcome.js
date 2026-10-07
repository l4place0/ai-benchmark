// 欢迎页：纸上美术馆底 + SVG 穿插线条与涂鸦色块 + 蓝色拱门 + 错峰入场编排。
// 接口：mountWelcome(rootEl, { onStart }) / animateWelcomeIn()（可重复调用，先重置再播）。

const SVG_NS = 'http://www.w3.org/2000/svg';

let root = null;

/* ---------------- 小工具 ---------------- */

// 确定性伪随机（每次构建结果一致，便于验收）
function rngFactory(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// 闭合 Catmull-Rom → 三次贝塞尔：生成手绘感的封闭轮廓
function smoothClosedPath(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

// 有机色块：superellipse 轮廓 + 顶点抖动（square≈2 圆点，>3 方块感）
function blobPath(cx, cy, rx, ry, rand, { square = 2.2, points = 12, wobble = 0.07 } = {}) {
  const pts = [];
  const p = 2 / square;
  for (let k = 0; k < points; k++) {
    const t = (k / points) * Math.PI * 2;
    const ct = Math.cos(t) || 1e-4;
    const st = Math.sin(t) || 1e-4;
    const jx = 1 + (rand() * 2 - 1) * wobble;
    const jy = 1 + (rand() * 2 - 1) * wobble;
    pts.push([
      cx + rx * jx * Math.sign(ct) * Math.abs(ct) ** p,
      cy + ry * jy * Math.sign(st) * Math.abs(st) ** p,
    ]);
  }
  return smoothClosedPath(pts);
}

/* ---------------- 背景数据（viewBox 1600×900，slice 铺满） ---------------- */

// (a) 细穿插线条：8 条深棕/墨蓝/淡金低透明长曲线与斜线
const LINES = [
  { d: 'M -40 140 C 420 30, 950 300, 1660 110', c: '#3d2f22', o: .16, w: 2 },
  { d: 'M -40 720 C 480 840, 1020 560, 1660 780', c: '#2b4a9b', o: .15, w: 2 },
  { d: 'M 240 -40 C 340 320, 150 620, 380 950', c: '#3d2f22', o: .13, w: 1.6 },
  { d: 'M 1320 -60 C 1220 330, 1500 590, 1400 960', c: '#2b4a9b', o: .14, w: 1.6 },
  { d: 'M -60 430 C 520 380, 1120 500, 1660 400', c: '#c8a24b', o: .2, w: 1.8 },
  { d: 'M 700 -50 C 770 280, 630 540, 780 950', c: '#3d2f22', o: .12, w: 1.5 },
  { d: 'M -40 260 C 400 220, 900 360, 1660 240', c: '#2b4a9b', o: .12, w: 1.4 },
  { d: 'M 1050 -40 C 1120 260, 980 520, 1120 950', c: '#c8a24b', o: .16, w: 1.5 },
];

// (b) 涂鸦式色块：12 个，避开中下部拱门区（x 560–1040 且 y>400），旋转 -12°~12°
const BLOCKS = [
  { x: 150, y: 170, w: 150, h: 112, rot: -8, color: '#2b4a9b', op: .62, square: 3.2 },
  { x: 332, y: 92, w: 86, h: 86, rot: 6, color: '#c0392b', op: .6, square: 2 },
  { x: 1396, y: 186, w: 164, h: 122, rot: 9, color: '#2e7d6e', op: .6, square: 3.4 },
  { x: 1244, y: 96, w: 78, h: 78, rot: -6, color: '#d9a441', op: .78, square: 2 },
  { x: 104, y: 500, w: 112, h: 142, rot: 10, color: '#d9a441', op: .6, square: 3 },
  { x: 1494, y: 492, w: 124, h: 100, rot: -10, color: '#c0392b', op: .55, square: 3.2 },
  { x: 452, y: 236, w: 64, h: 64, rot: -4, color: '#2e7d6e', op: .5, square: 2 },
  { x: 1148, y: 268, w: 60, h: 60, rot: 5, color: '#2b4a9b', op: .55, square: 2 },
  { x: 262, y: 668, w: 132, h: 92, rot: -7, color: '#2b4a9b', op: .5, square: 3.4 },
  { x: 1342, y: 676, w: 142, h: 96, rot: 8, color: '#d9a441', op: .62, square: 3 },
  { x: 770, y: 96, w: 96, h: 70, rot: -5, color: '#c0392b', op: .5, square: 3.2 },
  { type: 'ring', x: 644, y: 206, r: 40, rot: 8, color: '#d9a441', op: .55 },
];

/* ---------------- 构建 ---------------- */

function buildBackground(parent) {
  const svg = svgEl('svg', {
    class: 'w-bg', viewBox: '0 0 1600 900',
    preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true',
  });
  const rand = rngFactory(20261001);

  const linesG = svgEl('g');
  LINES.forEach((L, i) => {
    const p = svgEl('path', {
      class: 'wb-line', d: L.d,
      stroke: L.c, 'stroke-width': L.w, 'stroke-opacity': L.o,
      pathLength: '1',
    });
    p.style.setProperty('--d', `${i * 70}ms`);
    linesG.appendChild(p);
  });
  svg.appendChild(linesG);

  const blocksG = svgEl('g');
  BLOCKS.forEach((b, i) => {
    const entry = svgEl('g', { class: 'wb-in' }); // 入场：scale .6→1 + 位移，弹性缓动
    entry.style.setProperty('--d', `${140 + i * 75}ms`);
    const float = svgEl('g', { class: i % 2 ? 'wb-float alt' : 'wb-float' }); // 极缓慢漂浮
    float.style.setProperty('--fd', `${(8 + rand() * 6).toFixed(1)}s`);
    float.style.setProperty('--fdel', `${(-rand() * 10).toFixed(1)}s`);

    let shape;
    if (b.type === 'ring') {
      shape = svgEl('path', {
        d: blobPath(b.x, b.y, b.r, b.r * 0.92, rand, { square: 2.2, points: 14, wobble: .05 }),
        fill: 'none', stroke: b.color, 'stroke-opacity': b.op,
        'stroke-width': 3, 'stroke-linecap': 'round',
        'stroke-dasharray': `${(110 + rand() * 60) | 0} ${(16 + rand() * 14) | 0} ${(50 + rand() * 30) | 0} ${(12 + rand() * 10) | 0}`,
      });
    } else {
      shape = svgEl('path', {
        d: blobPath(b.x, b.y, b.w / 2, b.h / 2, rand, { square: b.square }),
        fill: b.color, 'fill-opacity': b.op,
      });
    }
    const holder = svgEl('g', { transform: `rotate(${b.rot} ${b.x} ${b.y})` });
    holder.appendChild(shape);
    float.appendChild(holder);
    entry.appendChild(float);
    blocksG.appendChild(entry);
  });
  svg.appendChild(blocksG);
  parent.appendChild(svg);
}

function buildArch(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'w-arch-wrap';
  wrap.innerHTML = `
    <svg class="w-arch" viewBox="0 0 420 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="wArchG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#31519f"/>
          <stop offset=".55" stop-color="#2b4a9b"/>
          <stop offset="1" stop-color="#20356f"/>
        </linearGradient>
        <radialGradient id="wArchGlow" cx=".5" cy=".2" r=".7">
          <stop offset="0" stop-color="#f6e7bd" stop-opacity=".26"/>
          <stop offset="1" stop-color="#f6e7bd" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path d="M0 560 L0 340 A210 210 0 0 1 420 340 L420 560 Z" fill="url(#wArchG)"/>
      <ellipse cx="210" cy="245" rx="150" ry="118" fill="url(#wArchGlow)"/>
      <path d="M16 560 L16 356 A194 194 0 0 1 404 356 L404 560"
            fill="none" stroke="#e9d9a8" stroke-opacity=".5" stroke-width="2"/>
      <path d="M34 560 L34 374 A176 176 0 0 1 386 374 L386 560"
            fill="none" stroke="#e9d9a8" stroke-opacity=".22" stroke-width="1.5"/>
    </svg>`;
  parent.appendChild(wrap);
}

function buildContent(parent, onStart) {
  const c = document.createElement('div');
  c.className = 'w-content';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'w-eyebrow';
  eyebrow.textContent = 'AN IMMERSIVE JOURNEY THROUGH WESTERN ART';

  const title = document.createElement('h1');
  title.className = 'w-title';
  [...'时光画廊'].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'w-ch';
    s.style.setProperty('--i', String(i));
    s.textContent = ch;
    title.appendChild(s);
  });

  const sub = document.createElement('p');
  sub.className = 'w-subtitle';
  sub.textContent = '穿越西方艺术史的八段旅程';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary w-start';
  btn.textContent = '开始旅程';
  btn.addEventListener('click', () => {
    if (typeof onStart === 'function') onStart();
  });

  c.append(eyebrow, title, sub, btn);
  parent.appendChild(c);

  const foot = document.createElement('div');
  foot.className = 'w-footer';
  foot.textContent = '公有领域名画 · 完全离线运行 · 键盘与鼠标';
  parent.appendChild(foot);
}

/* ---------------- 对外接口 ---------------- */

export function mountWelcome(rootEl, { onStart } = {}) {
  rootEl.innerHTML = '';
  root = document.createElement('div');
  root.className = 'welcome-root';
  buildBackground(root);
  buildArch(root);
  buildContent(root, onStart);
  rootEl.appendChild(root);
}

// 入场编排：线条错峰描画 → 色块弹性浮现 → 拱门升起 → 眉题/标题字符/副标题/按钮 120ms 级错峰
export function animateWelcomeIn() {
  if (!root) return;
  root.classList.remove('play');
  void root.offsetWidth; // 强制回流，确保动画可完整重播
  root.classList.add('play');
}
