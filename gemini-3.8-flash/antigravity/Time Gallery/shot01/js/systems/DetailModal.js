/**
 * 时光画廊 (Time Gallery) - 画作近全屏详情面板 (DetailModal)
 * STRICT: 四周严格保留约 24px 画廊可见背景 (inset: 24px)
 * STRICT: 单例锁定 (Rapidly pressing E must NOT stack multiple modals!)
 * STRICT: Esc 键关闭，左右双栏结构化元数据展示
 */

export class DetailModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] 挂载容器
   * @param {Function} [options.onClose] 关闭时的回调
   */
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.onClose = options.onClose || (() => {});
    
    // STRICT: 单例锁状态机
    this.isOpen = false;
    this.isTransitioning = false;
    
    this.rootEl = null;
    this.boundKeydown = this.handleKeyDown.bind(this);

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'artwork-modal-overlay';
    this.rootEl.id = 'artwork-detail-modal';

    this.rootEl.innerHTML = `
      <div class="artwork-modal-card" id="artwork-modal-card">
        <!-- 左侧：大幅画作展示区 -->
        <div class="modal-left-art">
          <div class="modal-art-frame-wrap">
            <img class="modal-art-image" id="modal-art-img" src="" alt="画作高清展示" />
          </div>
          <div class="modal-art-zoom-hint">✦ 传世名作 · 原始长宽比例无损呈现</div>
        </div>

        <!-- 右侧：全量结构化元数据信息卡 -->
        <div class="modal-right-meta">
          <div class="modal-top-actions">
            <div class="modal-period-badge" id="modal-period-badge">
              <span>时期载入中</span>
            </div>
            <div class="modal-close-group">
              <span class="modal-esc-key">ESC</span>
              <button type="button" class="btn btn-icon-gold modal-close-btn" id="modal-close-btn" title="关闭详情 (ESC)">
                ✕
              </button>
            </div>
          </div>

          <div class="modal-title-area">
            <h2 class="modal-title-zh" id="modal-title-zh">画作标题</h2>
            <div class="modal-title-en" id="modal-title-en">Artwork Title</div>
          </div>

          <!-- 结构化参数网格 -->
          <div class="modal-meta-grid">
            <div class="meta-field">
              <span class="meta-field-label">艺术家 / Artist</span>
              <span class="meta-field-value" id="modal-artist-zh">艺术家名</span>
              <span class="meta-field-sub" id="modal-artist-en">Artist En</span>
            </div>
            <div class="meta-field">
              <span class="meta-field-label">生卒年份 / Lifetime</span>
              <span class="meta-field-value" id="modal-lifetime">—</span>
            </div>
            <div class="meta-field">
              <span class="meta-field-label">创作年代 / Year</span>
              <span class="meta-field-value" id="modal-year">—</span>
            </div>
            <div class="meta-field">
              <span class="meta-field-label">艺术流派 / Period</span>
              <span class="meta-field-value" id="modal-period-name">—</span>
            </div>
          </div>

          <!-- 艺术史评述 -->
          <div class="modal-section">
            <div class="modal-section-title">艺术史脉络与鉴赏</div>
            <p class="modal-section-desc" id="modal-period-desc">评述加载中...</p>
          </div>

          <!-- 馆藏来源与授权状态 -->
          <div class="modal-license-box">
            <div class="modal-source-row">
              <span class="modal-source-label">馆藏 / 来源：</span>
              <span class="modal-source-value" id="modal-source-url">—</span>
            </div>
            <div class="modal-license-tag" id="modal-license-tag">
              <span>✔ Public Domain / CC0 (公有领域经典传世名作)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);
  }

  bindEvents() {
    // 监听关闭按钮点击
    const closeBtn = this.rootEl.querySelector('#modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    // 点击半透明留白背景边缘关闭
    this.rootEl.addEventListener('click', (e) => {
      if (e.target === this.rootEl) {
        this.close();
      }
    });

    // 绑定全局键盘监听 (ESC 键关闭 / 过滤按键防多实例)
    window.addEventListener('keydown', this.boundKeydown);
  }

  /**
   * 键盘事件处理：严格单例，ESC 关闭，快速按 E 不会重复弹出
   */
  handleKeyDown(e) {
    if (!this.isOpen) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === 'e' || e.key === 'E') {
      // 当面板已打开时，按 E 亦关闭面板，严格阻止重复创建
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  /**
   * 打开画作详情面板 (STRICT: 单例锁，连续快速调用直接拦截)
   * @param {Object} artwork
   */
  open(artwork) {
    if (this.isOpen || this.isTransitioning) {
      // 严格单例锁：阻止任何并发与重复堆叠！
      return;
    }

    if (!artwork) return;

    this.isTransitioning = true;
    this.populateData(artwork);

    this.rootEl.classList.add('active');

    // 缓动动画锁定时长
    setTimeout(() => {
      this.isOpen = true;
      this.isTransitioning = false;
    }, 360);
  }

  /**
   * 填充元数据
   * @param {Object} data
   */
  populateData(data) {
    const imgEl = this.rootEl.querySelector('#modal-art-img');
    const badgeEl = this.rootEl.querySelector('#modal-period-badge');
    const titleZhEl = this.rootEl.querySelector('#modal-title-zh');
    const titleEnEl = this.rootEl.querySelector('#modal-title-en');
    const artistZhEl = this.rootEl.querySelector('#modal-artist-zh');
    const artistEnEl = this.rootEl.querySelector('#modal-artist-en');
    const lifetimeEl = this.rootEl.querySelector('#modal-lifetime');
    const yearEl = this.rootEl.querySelector('#modal-year');
    const periodNameEl = this.rootEl.querySelector('#modal-period-name');
    const periodDescEl = this.rootEl.querySelector('#modal-period-desc');
    const sourceUrlEl = this.rootEl.querySelector('#modal-source-url');
    const licenseEl = this.rootEl.querySelector('#modal-license-tag');

    // 图片处理与离线降级保障
    const imagePath = data.localPath || data.image || '';
    imgEl.src = imagePath;
    imgEl.onerror = () => {
      imgEl.src = this.generateFallbackDataUrl(data.titleZh || '传世名作', data.artistZh || '艺术大师');
    };

    // 填充字段
    const periodTitle = data.periodZh || data.period || '西方经典艺术时期';
    badgeEl.innerHTML = `<span>✦ ${periodTitle}</span>`;
    
    titleZhEl.textContent = data.titleZh ? `《${data.titleZh}》` : '名作画卷';
    titleEnEl.textContent = data.titleEn || '';
    artistZhEl.textContent = data.artistZh || '未知艺术家';
    artistEnEl.textContent = data.artistEn || '';
    lifetimeEl.textContent = data.birthDeath || '传世大师';
    yearEl.textContent = data.year || '经典时期';
    periodNameEl.textContent = `${periodTitle} (${data.periodEn || ''})`;
    periodDescEl.textContent = data.periodDesc || '本作为西方艺术史公有领域不朽瑰宝，体现了该时期杰出的构图技巧与深邃的人文审美内涵。';

    // 来源与授权
    sourceUrlEl.textContent = data.sourceUrl || '世界著名公共博物馆藏品';
    licenseEl.textContent = data.license || '✔ Public Domain / CC0 (无版权限制，公有领域传世名作)';
  }

  /**
   * 关闭详情面板
   */
  close() {
    if (!this.isOpen || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    this.rootEl.classList.remove('active');

    setTimeout(() => {
      this.isOpen = false;
      this.isTransitioning = false;
      if (typeof this.onClose === 'function') {
        this.onClose();
      }
    }, 340);
  }

  /**
   * 生成优雅的离线画作占位 SVG Data URL
   */
  generateFallbackDataUrl(title, artist) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <radialGradient id="modGrad" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stop-color="#1f2533"/>
            <stop offset="100%" stop-color="#0a0c10"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#modGrad)"/>
        <rect x="30" y="30" width="740" height="540" fill="none" stroke="#d4af37" stroke-width="2.5" opacity="0.5"/>
        <rect x="42" y="42" width="716" height="516" fill="none" stroke="#d4af37" stroke-width="1" opacity="0.25"/>
        <circle cx="400" cy="240" r="60" fill="none" stroke="#d4af37" stroke-width="2" opacity="0.7"/>
        <text x="400" y="250" fill="#d4af37" font-size="36" font-family="serif" text-anchor="middle">✦</text>
        <text x="400" y="360" fill="#f5f2eb" font-size="30" font-family="serif" font-weight="bold" text-anchor="middle">${title}</text>
        <text x="400" y="410" fill="#c8c3b7" font-size="20" font-family="sans-serif" text-anchor="middle">${artist}</text>
        <text x="400" y="450" fill="#96781b" font-size="14" font-family="serif" letter-spacing="3" text-anchor="middle">TIME GALLERY COLLECTION</text>
      </svg>
    `;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  destroy() {
    window.removeEventListener('keydown', this.boundKeydown);
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
