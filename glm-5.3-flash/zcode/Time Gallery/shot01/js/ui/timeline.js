// 树状时间轴：SVG 主干 + 8 时期节点 + 画家小枝 + 悬停详情卡。
// 接口：mountTimeline(rootEl, { periods, paintings, onSelectPeriod })
//       animateTimelineIn()（可重复调用，先重置再播）/ hideTimelineCards()。

const SVG_NS = 'http://www.w3.org/2000/svg';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const BASE_Y = 400;
const Y_OFF = [-58, 46, -66, 50, -44, 62, -56, 40]; // 树冠感：±40–70 交替起伏

let root = null;         // #timeline-root（.tl-root）
let stage = null;        // .tl-stage（详情卡的定位容器）
let svg = null;
let trunkPath = null;
let card = null;
const cardEls = {};
let nodeGroups = [];     // 与 periods 下标对应
let periods = [];
let onSelectPeriod = null;
const coverById = new Map();

/* ---------------- 小工具 ---------------- */

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

const f1 = (v) => v.toFixed(1);

// 开放 Catmull-Rom → 三次贝塞尔：有机起伏的主干
function smoothOpenPath(p) {
  let d = `M ${f1(p[0].x)} ${f1(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return d;
}

function nodePoints(n) {
  const x0 = 130;
  const x1 = 1470;
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      x: n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1),
      y: BASE_Y + Y_OFF[i % Y_OFF.length],
    });
  }
  return pts;
}

/* ---------------- 挂载 ---------------- */

export function mountTimeline(rootEl, { periods: periodList = [], paintings = [], onSelectPeriod: onSelect } = {}) {
  rootEl.innerHTML = '';
  periods = periodList;
  onSelectPeriod = onSelect;
  nodeGroups = [];
  coverById.clear();
  for (const p of paintings) coverById.set(p.id, p);

  root = rootEl;
  root.classList.add('tl-root');

  // 顶部信息条
  const bar = document.createElement('header');
  bar.className = 'tl-topbar';
  const brand = document.createElement('div');
  brand.className = 'tl-brand';
  brand.textContent = '时光画廊 · 西方艺术八纪';
  const hint = document.createElement('div');
  hint.className = 'tl-hint';
  hint.textContent = '悬停查看时期详情 · 点击进入画廊';
  bar.append(brand, hint);
  root.appendChild(bar);

  // 舞台
  stage = document.createElement('div');
  stage.className = 'tl-stage';
  root.appendChild(stage);

  svg = svgEl('svg', {
    class: 'tl-svg', viewBox: '0 0 1600 800',
    preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true',
  });
  stage.appendChild(svg);

  // 渐变定义（主干：墨蓝 → 古金）
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', {
    id: 'tlTrunkGrad', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '1600', y2: '0',
  });
  grad.append(
    svgEl('stop', { offset: '0', 'stop-color': '#2b4a9b' }),
    svgEl('stop', { offset: '.45', 'stop-color': '#4f5d8f' }),
    svgEl('stop', { offset: '1', 'stop-color': '#c8a24b' }),
  );
  defs.appendChild(grad);
  svg.appendChild(defs);

  const pts = nodePoints(periods.length);

  // 主干
  const trunkLayer = svgEl('g');
  const ext = [
    { x: pts[0].x - 95, y: pts[0].y + 26 },
    ...pts,
    { x: pts[pts.length - 1].x + 95, y: pts[pts.length - 1].y - 24 },
  ];
  trunkPath = svgEl('path', { class: 'tl-trunk', d: smoothOpenPath(ext), stroke: 'url(#tlTrunkGrad)' });
  trunkLayer.appendChild(trunkPath);
  svg.appendChild(trunkLayer);

  // 小枝层（装饰性，不可交互）
  const branchLayer = svgEl('g', { class: 'tl-label' });
  // 节点层
  const nodeLayer = svgEl('g');
  // 标签层
  const labelLayer = svgEl('g', { class: 'tl-label' });

  periods.forEach((period, i) => {
    const pt = pts[i];
    const nodeDelay = 250 + i * 190; // 主干经过该节点附近时弹出

    // 画家小枝：从节点斜向伸出的 quadratic bezier
    const painters = (period.painters || []).slice(0, 4);
    painters.forEach((painter, j) => {
      const raised = pt.y < BASE_Y;
      let dir = j % 2 === 0 ? -1 : 1;
      if (i === 0) dir = 1;        // 首节点小枝只向右，避免文字出画
      if (i === periods.length - 1) dir = -1; // 末节点只向左
      const ang = ((35 + ((j * 17) % 40)) * Math.PI) / 180; // 35°–74°
      const len = 92 - j * 12;
      const dx = Math.cos(ang) * len * dir;
      const dy = Math.sin(ang) * len * (raised ? 1 : -1);
      const ex = pt.x + dx;
      const ey = pt.y + dy;
      const nx = -dy / len;
      const ny = dx / len;
      const bow = (j % 2 === 0 ? 1 : -1) * 14;
      const cx = pt.x + dx * 0.5 + nx * bow;
      const cy = pt.y + dy * 0.5 + ny * bow;

      const branchDelay = nodeDelay + 380 + j * 90;
      const branch = svgEl('path', {
        class: 'tl-branch',
        d: `M ${f1(pt.x)} ${f1(pt.y)} Q ${f1(cx)} ${f1(cy)} ${f1(ex)} ${f1(ey)}`,
        pathLength: '1',
      });
      branch.style.setProperty('--d', `${branchDelay}ms`);
      branchLayer.appendChild(branch);

      const name = svgEl('text', {
        class: 'tl-painter',
        x: f1(ex + dir * 8),
        y: f1(ey + (raised ? 12 : -6)),
        'text-anchor': dir > 0 ? 'start' : 'end',
      });
      name.textContent = painter.nameZh || '';
      name.style.setProperty('--d', `${branchDelay + 240}ms`);
      branchLayer.appendChild(name);
    });

    // 节点（圆形 + 序号）
    const g = svgEl('g', { class: 'tl-node' });
    g.setAttribute('transform', `translate(${f1(pt.x)} ${f1(pt.y)})`); // 定位到主干上的节点坐标
    const hit = svgEl('circle', { class: 'tl-hit', r: '38', fill: 'transparent' });
    const inner = svgEl('g', { class: 'tl-node-in' });
    inner.style.setProperty('--d', `${nodeDelay}ms`);
    const core = svgEl('g', { class: 'tl-node-core' });
    const halo = svgEl('circle', { class: 'tl-halo', r: '34' });
    const dot = svgEl('circle', {
      class: 'tl-dot', r: '24',
      fill: period.accent || '#2b4a9b',
    });
    const num = svgEl('text', { class: 'tl-num', x: '0', y: '0', dy: '.35em' });
    num.textContent = NUMERALS[i] || String(i + 1);
    core.append(halo, dot, num);
    inner.appendChild(core);
    g.append(hit, inner);
    nodeLayer.appendChild(g);

    g.addEventListener('mouseenter', () => showCard(i, g));
    g.addEventListener('mouseleave', hideCard);
    g.addEventListener('click', () => {
      const p = periods[i];
      if (p && typeof onSelectPeriod === 'function') onSelectPeriod(p.id);
    });
    nodeGroups.push(g);

    // 名称标签（节点起伏的反侧，绝不遮点）
    const raised = pt.y < BASE_Y;
    const nameY = raised ? pt.y - 56 : pt.y + 64;
    const yearsY = raised ? pt.y - 36 : pt.y + 84;
    const name = svgEl('text', { class: 'tl-name', x: f1(pt.x), y: f1(nameY) });
    name.textContent = period.nameZh || '';
    const years = svgEl('text', { class: 'tl-years', x: f1(pt.x), y: f1(yearsY) });
    years.textContent = period.years || '';
    name.style.setProperty('--d', `${nodeDelay + 160}ms`);
    years.style.setProperty('--d', `${nodeDelay + 240}ms`);
    labelLayer.append(name, years);
  });

  svg.append(branchLayer, nodeLayer, labelLayer);

  // 悬停详情卡（全局唯一一张 DOM）
  buildCard();

  window.addEventListener('resize', hideCard);
}

function buildCard() {
  card = document.createElement('aside');
  card.className = 'tl-card';
  card.setAttribute('aria-hidden', 'true');

  const cover = document.createElement('div');
  cover.className = 'tl-card-cover';
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  const fallback = document.createElement('div');
  fallback.className = 'tl-cover-fallback';
  cover.append(img, fallback);

  const body = document.createElement('div');
  body.className = 'tl-card-body';
  const name = document.createElement('div');
  name.className = 'tl-card-name';
  const enrow = document.createElement('div');
  enrow.className = 'tl-card-enrow';
  const en = document.createElement('span');
  en.className = 'tl-card-en';
  const years = document.createElement('span');
  years.className = 'tl-card-years';
  enrow.append(en, years);
  const intro = document.createElement('p');
  intro.className = 'tl-card-intro';
  const hint = document.createElement('div');
  hint.className = 'tl-card-hint';
  hint.textContent = '点击节点进入画廊';
  body.append(name, enrow, intro, hint);

  card.append(cover, body);
  stage.appendChild(card);

  cardEls.img = img;
  cardEls.fallback = fallback;
  cardEls.name = name;
  cardEls.en = en;
  cardEls.years = years;
  cardEls.intro = intro;
}

/* ---------------- 详情卡 ---------------- */

function showCard(i, nodeGroup) {
  const period = periods[i];
  if (!period || !card) return;

  cardEls.name.textContent = period.nameZh || '';
  cardEls.en.textContent = period.nameEn || '';
  cardEls.years.textContent = period.years || '';
  cardEls.years.style.background = period.accent || 'var(--ink)';
  cardEls.intro.textContent = period.introZh || '';

  const cover = coverById.get(period.coverPaintingId);
  const img = cardEls.img;
  const fb = cardEls.fallback;
  img.style.display = '';
  fb.style.display = 'none';
  img.onload = () => {
    fb.style.display = 'none';
    img.style.display = '';
  };
  img.onerror = () => { // 图片缺失 → 纯色块占位，不裂图
    img.style.display = 'none';
    fb.style.display = 'block';
    fb.style.background = period.accent || '#b9a77f';
  };
  if (cover && cover.file) {
    img.src = cover.file;
    if (img.complete && img.naturalWidth === 0) img.onerror();
  } else {
    img.removeAttribute('src');
    img.onerror();
  }

  positionCard(nodeGroup);
  card.classList.remove('show');
  void card.offsetWidth;
  card.classList.add('show');
}

function positionCard(nodeGroup) {
  const hit = nodeGroup.querySelector('.tl-hit');
  if (!hit || !stage) return;
  const r = hit.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2 - sr.left;
  const cy = r.top + r.height / 2 - sr.top;

  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const vw = stage.clientWidth;
  const vh = stage.clientHeight;

  let left = cx + 30;                       // 默认在节点右侧
  if (left + cw > vw - 14) left = cx - 30 - cw; // 靠右边缘时翻到左侧
  left = Math.max(14, Math.min(left, vw - cw - 14));
  let top = cy - ch / 2;
  top = Math.max(14, Math.min(top, vh - ch - 14));

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}

function hideCard() {
  if (card) card.classList.remove('show');
}

/* ---------------- 对外接口 ---------------- */

// 生长动画：主干描画 1.9s → 节点错峰弹出 → 小枝描画 → 画家名/标签 fade-up
export function animateTimelineIn() {
  if (!root || !trunkPath) return;
  hideCard();
  const L = trunkPath.getTotalLength();
  trunkPath.style.strokeDasharray = `${L}`;
  trunkPath.style.strokeDashoffset = `${L}`;
  root.classList.remove('play');
  void root.offsetWidth; // 强制回流，确保每次调用都完整重播
  root.classList.add('play');
}

export function hideTimelineCards() {
  hideCard();
}
