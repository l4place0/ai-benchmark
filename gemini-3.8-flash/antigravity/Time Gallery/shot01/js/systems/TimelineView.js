/**
 * 时光画廊 (Time Gallery) - 树状时间轴组件 (TimelineView)
 * 8大艺术史时期、SVG树动态展开、非线性缓动、装饰性画家分支(不可点击)、悬停卡片(无进入按钮)、点击直达画廊
 */

import { ART_PERIODS } from '../data/artHistoryData.js';

export class TimelineView {
  /**
   * @param {Object} options
   * @param {Function} options.onSelectPeriod 点击时期节点进入画廊的回调 (periodId) => {}
   * @param {Function} options.onBackToWelcome 返回欢迎屏的回调
   */
  constructor(options = {}) {
    this.onSelectPeriod = options.onSelectPeriod || (() => {});
    this.onBackToWelcome = options.onBackToWelcome || (() => {});
    this.container = null;
    this.rootEl = null;
    this.hoverCardEl = null;
    this.periods = ART_PERIODS;
    this.activePeriodHover = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
    this.startTreeUnfoldAnimation();
  }

  render() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'timeline-view-container';

    // 顶部导航栏 (无黑边按钮)
    const headerHtml = `
      <header class="timeline-header">
        <div class="timeline-nav-left">
          <button type="button" class="btn btn-outline-gold" id="btn-back-welcome">
            ← 返回欢迎页
          </button>
          <div class="timeline-header-titles">
            <h2 class="timeline-header-title">西方艺术史长河</h2>
            <span class="timeline-header-sub">时空之树 · 1400 — 1905</span>
          </div>
        </div>
        <div class="timeline-tip-badge">
          <span>✦ 点击时期节点直接步入 3D 画廊</span>
        </div>
      </header>
    `;

    // 树状时间轴主体舞台
    const stageWidth = 1000;
    const itemSpacing = 200;
    const startY = 100;
    const totalHeight = startY + this.periods.length * itemSpacing + 80;

    // 计算主树干曲线路径与节点坐标
    const nodeCoords = [];
    const centerX = 500;
    let trunkPathD = `M ${centerX} 20 `;

    this.periods.forEach((period, i) => {
      const isLeft = i % 2 === 0;
      const y = startY + i * itemSpacing;
      // 树干微幅优雅正弦摇摆
      const trunkSway = Math.sin(i * 1.1) * 36;
      const trunkX = centerX + trunkSway;
      
      const nodeX = isLeft ? 140 : 860;
      nodeCoords.push({ period, x: nodeX, y, trunkX, isLeft });

      // 树干主曲线
      const prevX = i === 0 ? centerX : nodeCoords[i - 1].trunkX;
      const prevY = i === 0 ? 20 : nodeCoords[i - 1].y;
      const cpY1 = prevY + itemSpacing * 0.45;
      const cpY2 = y - itemSpacing * 0.45;
      trunkPathD += `C ${prevX} ${cpY1}, ${trunkX} ${cpY2}, ${trunkX} ${y} `;
    });

    // 树干延伸至根基底部
    trunkPathD += `L ${centerX} ${totalHeight - 20}`;

    // 生成分支曲线
    let branchPathsHtml = '';
    nodeCoords.forEach((coord, i) => {
      const { trunkX, y, isLeft } = coord;
      const branchEndX = isLeft ? 260 : 740;
      const cpX = isLeft ? trunkX - 120 : trunkX + 120;
      const branchD = `M ${trunkX} ${y} Q ${cpX} ${y + 20} ${branchEndX} ${y}`;
      branchPathsHtml += `<path class="tree-branch-path" id="branch-${i}" d="${branchD}" />`;
    });

    // 节点 HTML
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    let nodesHtml = '';
    nodeCoords.forEach((coord, i) => {
      const { period, y, isLeft } = coord;
      const alignClass = isLeft ? 'align-left' : 'align-right';
      const paintersStr = period.painters.map(p => p.nameZh).join(' · ');

      nodesHtml += `
        <div class="period-item ${alignClass}" id="period-item-${period.id}" style="top: ${y - 42}px;" data-period-id="${period.id}">
          <!-- 可交互时期节点徽章 (点击直达画廊) -->
          <div class="period-node-anchor" data-period-id="${period.id}" title="点击步入【${period.titleZh}】画廊">
            <span class="node-roman">${romanNumerals[i]}</span>
            <span class="node-index">0${i + 1}</span>
            <span class="node-year-tiny">${period.era.split('–')[0]}</span>
          </div>

          <!-- 节点信息区 (点击亦可直达画廊) -->
          <div class="period-info-box" data-period-id="${period.id}">
            <h3 class="period-title-zh">${period.titleZh}</h3>
            <div class="period-title-en">${period.titleEn}</div>
            <span class="period-era-tag">${period.era}</span>

            <!-- STRICT: 画家分支仅为装饰性文本展示，严格不可点击 (pointer-events: none) -->
            <div class="painter-branch">
              <span class="painter-branch-title">代表大师</span>
              <span class="painter-branch-names">${paintersStr}</span>
            </div>
          </div>
        </div>
      `;
    });

    // 悬停卡片容器 (STRICT: 严禁包含进入画廊按钮！)
    const hoverCardHtml = `
      <div class="timeline-hover-card" id="timeline-hover-card">
        <div class="hover-card-image-wrap">
          <img class="hover-card-image" id="hover-card-img" src="" alt="代表画作" />
          <span class="hover-card-era-badge" id="hover-card-era"></span>
        </div>
        <div class="hover-card-meta">
          <div class="hover-card-artwork-title" id="hover-card-title"></div>
          <div class="hover-card-artist" id="hover-card-artist"></div>
          <p class="hover-card-intro" id="hover-card-intro"></p>
        </div>
        <div class="hover-card-hint">
          <span>✦ 点击节点直接进入 3D 展厅</span>
        </div>
      </div>
    `;

    this.rootEl.innerHTML = `
      ${headerHtml}
      <div class="timeline-tree-stage" style="height: ${totalHeight}px;">
        <svg class="timeline-svg-tree" viewBox="0 0 ${stageWidth} ${totalHeight}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path class="tree-trunk-path" id="tree-trunk-main" d="${trunkPathD}" />
          ${branchPathsHtml}
        </svg>

        <div class="timeline-nodes-wrapper">
          ${nodesHtml}
        </div>

        ${hoverCardHtml}
      </div>
    `;

    this.container.appendChild(this.rootEl);
    this.hoverCardEl = this.rootEl.querySelector('#timeline-hover-card');
  }

  bindEvents() {
    // 返回欢迎页按钮
    const backBtn = this.rootEl.querySelector('#btn-back-welcome');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (typeof this.onBackToWelcome === 'function') {
          this.onBackToWelcome();
        }
      });
    }

    // STRICT: 点击时期节点徽章或信息区直接进入画廊，绝不添加多余词典弹窗！
    const interactiveElements = this.rootEl.querySelectorAll('.period-node-anchor, .period-info-box');
    interactiveElements.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const periodId = el.getAttribute('data-period-id');
        if (periodId && typeof this.onSelectPeriod === 'function') {
          this.hideHoverCard();
          this.onSelectPeriod(periodId);
        }
      });
    });

    // 绑定 Hover Detail Card 事件
    const periodItems = this.rootEl.querySelectorAll('.period-item');
    periodItems.forEach(item => {
      const periodId = item.getAttribute('data-period-id');
      const period = this.periods.find(p => p.id === periodId);
      if (!period) return;

      const triggerArea = item.querySelector('.period-node-anchor');

      triggerArea.addEventListener('mouseenter', (e) => {
        this.showHoverCard(period, item);
      });

      triggerArea.addEventListener('mouseleave', () => {
        this.hideHoverCard();
      });

      // 信息框也触发提示卡片
      const infoBox = item.querySelector('.period-info-box');
      infoBox.addEventListener('mouseenter', () => {
        this.showHoverCard(period, item);
      });
      infoBox.addEventListener('mouseleave', () => {
        this.hideHoverCard();
      });
    });
  }

  /**
   * 触发树干与分支展开的动态非线性生长动画
   */
  startTreeUnfoldAnimation() {
    requestAnimationFrame(() => {
      const trunk = this.rootEl.querySelector('#tree-trunk-main');
      if (trunk) trunk.classList.add('unfolded');

      const branches = this.rootEl.querySelectorAll('.tree-branch-path');
      branches.forEach((b, idx) => {
        setTimeout(() => {
          b.classList.add('unfolded');
        }, 300 + idx * 120);
      });

      // 节点依次以弹簧非线性缓动浮现
      const items = this.rootEl.querySelectorAll('.period-item');
      items.forEach((item, idx) => {
        setTimeout(() => {
          item.classList.add('visible');
        }, 500 + idx * 180);
      });
    });
  }

  /**
   * 显示悬停详情卡片 (STRICT: 无进入画廊按钮)
   * @param {Object} period
   * @param {HTMLElement} itemEl
   */
  showHoverCard(period, itemEl) {
    if (!this.hoverCardEl) return;

    const rep = period.representative;
    const imgEl = this.hoverCardEl.querySelector('#hover-card-img');
    const eraEl = this.hoverCardEl.querySelector('#hover-card-era');
    const titleEl = this.hoverCardEl.querySelector('#hover-card-title');
    const artistEl = this.hoverCardEl.querySelector('#hover-card-artist');
    const introEl = this.hoverCardEl.querySelector('#hover-card-intro');

    // 图片加载与平稳降级
    imgEl.src = rep.image;
    imgEl.onerror = () => {
      // 若本地图片尚未就绪，展示高审美古典纯色占位
      imgEl.src = this.generateFallbackDataUrl(rep.titleZh, rep.artistZh);
    };

    eraEl.textContent = period.era;
    titleEl.textContent = `《${rep.titleZh}》`;
    artistEl.textContent = `${rep.artistZh} · ${rep.year}`;
    introEl.textContent = period.intro;

    // 智能定位悬停卡片：若节点在左侧则卡片置于右侧，反之置于左侧
    const isLeft = itemEl.classList.contains('align-left');
    const itemRect = itemEl.getBoundingClientRect();
    const stageRect = this.rootEl.querySelector('.timeline-tree-stage').getBoundingClientRect();

    const relativeTop = itemRect.top - stageRect.top;
    
    if (isLeft) {
      this.hoverCardEl.style.left = '490px';
      this.hoverCardEl.style.right = 'auto';
    } else {
      this.hoverCardEl.style.left = 'auto';
      this.hoverCardEl.style.right = '490px';
    }
    this.hoverCardEl.style.top = `${relativeTop - 20}px`;

    this.hoverCardEl.classList.add('active');
  }

  hideHoverCard() {
    if (this.hoverCardEl) {
      this.hoverCardEl.classList.remove('active');
    }
  }

  /**
   * 生成优雅的离线画作占位 SVG Data URL
   */
  generateFallbackDataUrl(title, artist) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <defs>
          <radialGradient id="grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#1e2738"/>
            <stop offset="100%" stop-color="#0e131d"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <rect x="20" y="20" width="560" height="360" fill="none" stroke="#d4af37" stroke-width="2" opacity="0.4"/>
        <circle cx="300" cy="160" r="45" fill="none" stroke="#d4af37" stroke-width="1.5" opacity="0.6"/>
        <text x="300" y="168" fill="#d4af37" font-size="28" font-family="serif" text-anchor="middle">✦</text>
        <text x="300" y="240" fill="#f5f2eb" font-size="22" font-family="serif" font-weight="bold" text-anchor="middle">${title}</text>
        <text x="300" y="275" fill="#c8c3b7" font-size="16" font-family="sans-serif" text-anchor="middle">${artist}</text>
      </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  destroy() {
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.hoverCardEl = null;
  }
}
