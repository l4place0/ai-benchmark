/**
 * 时光画廊 (Time Gallery) - 欢迎屏组件 (WelcomeView)
 * 穿插线条、涂鸦色块、古典蓝色透视拱门
 * 严格约束：标题、副标题、主按钮位于蓝色拱门上方，绝不遮挡拱门
 */

export class WelcomeView {
  /**
   * @param {Object} options
   * @param {Function} options.onStart 点击开启时光之门的回调
   */
  constructor(options = {}) {
    this.onStart = options.onStart || (() => {});
    this.container = null;
    this.rootEl = null;
  }

  /**
   * 挂载到指定 DOM 容器
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
    
    // 触发进场非线性缓动动画
    requestAnimationFrame(() => {
      if (this.rootEl) {
        this.rootEl.classList.add('animate-in');
      }
    });
  }

  render() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'welcome-screen';

    this.rootEl.innerHTML = `
      <!-- 背景艺术层：涂鸦色块与穿插几何线条 -->
      <div class="welcome-bg-canvas">
        <div class="doodle-blocks-layer">
          <div class="doodle-block doodle-block-1"></div>
          <div class="doodle-block doodle-block-2"></div>
          <div class="doodle-block doodle-block-3"></div>
          <div class="doodle-block doodle-block-4"></div>
          <div class="doodle-block doodle-block-5"></div>
        </div>

        <svg class="intersecting-lines-svg" viewBox="0 0 1920 1080" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f5e4a8" stop-opacity="0.6"/>
              <stop offset="50%" stop-color="#d4af37" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="#96781b" stop-opacity="0.1"/>
            </linearGradient>
            <linearGradient id="blueStrokeGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#457b9d" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#1d3557" stop-opacity="0.15"/>
            </linearGradient>
          </defs>
          
          <!-- 黄金分割穿插对角线与网格 -->
          <line x1="-100" y1="200" x2="2020" y2="880" class="intersecting-line" stroke="url(#goldStrokeGrad)"/>
          <line x1="2020" y1="180" x2="-100" y2="920" class="intersecting-line-blue" stroke="url(#blueStrokeGrad)"/>
          <line x1="240" y1="-50" x2="1680" y2="1150" class="intersecting-line-solid"/>
          <line x1="1680" y1="-50" x2="240" y2="1150" class="intersecting-line-solid"/>
          
          <!-- 古典透视汇聚虚线 -->
          <line x1="960" y1="380" x2="0" y2="1080" class="intersecting-line" stroke="url(#goldStrokeGrad)"/>
          <line x1="960" y1="380" x2="1920" y2="1080" class="intersecting-line" stroke="url(#goldStrokeGrad)"/>
          <line x1="960" y1="380" x2="480" y2="1080" class="intersecting-line-solid"/>
          <line x1="960" y1="380" x2="1440" y2="1080" class="intersecting-line-solid"/>

          <!-- 几何韵律同心椭圆与比例弧线 -->
          <ellipse cx="960" cy="540" rx="720" ry="420" fill="none" stroke="url(#goldStrokeGrad)" stroke-width="0.8" stroke-dasharray="8 12"/>
          <ellipse cx="960" cy="540" rx="480" ry="280" fill="none" stroke="rgba(212, 175, 55, 0.18)" stroke-width="0.6"/>
          <circle cx="960" cy="380" r="180" fill="none" stroke="url(#goldStrokeGrad)" stroke-width="0.8" stroke-dasharray="4 6"/>
        </svg>
      </div>

      <!-- STRICT: 页面上半区 - 标题、副标题与主按钮 (严格居于蓝色拱门上方，绝不遮挡拱门) -->
      <div class="welcome-hero-content">
        <div class="welcome-eyebrow">
          <span>IMMERSIVE WESTERN ART HISTORY</span>
        </div>
        <h1 class="welcome-title">时光画廊</h1>
        <p class="welcome-subtitle">西方艺术史沉浸式巡礼</p>
        <div class="welcome-cta-wrap">
          <button type="button" class="btn btn-gold btn-enter-gate" id="btn-start-journey">
            开启时光之门
          </button>
        </div>
      </div>

      <!-- STRICT: 页面下半区 - 宏伟古典透视蓝色拱门 (.blue-arch) 位于所有文字与按钮下方 -->
      <div class="blue-arch-container">
        <svg class="blue-arch" viewBox="0 0 1000 680" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="archSkyGlow" cx="500" cy="400" r="380" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#2a4870" stop-opacity="0.95"/>
              <stop offset="45%" stop-color="#182d49" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#0c1726" stop-opacity="0.6"/>
            </radialGradient>
            <linearGradient id="archMainGrad" x1="500" y1="50" x2="500" y2="680" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#25436c"/>
              <stop offset="40%" stop-color="#1d3557"/>
              <stop offset="100%" stop-color="#0f1c30"/>
            </linearGradient>
            <linearGradient id="archGoldTrim" x1="200" y1="100" x2="800" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#d4af37" stop-opacity="0.6"/>
              <stop offset="50%" stop-color="#f5e4a8" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#aa820a" stop-opacity="0.6"/>
            </linearGradient>
            <linearGradient id="innerVaultGrad" x1="500" y1="180" x2="500" y2="580" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#14263f"/>
              <stop offset="100%" stop-color="#080f1a"/>
            </linearGradient>
          </defs>

          <!-- 拱门深处古典回廊透视背景光与星辉 -->
          <path d="M 280 680 L 280 400 C 280 280, 720 280, 720 400 L 720 680 Z" fill="url(#archSkyGlow)"/>

          <!-- 远景回廊透视纵深拱券与古典柱廊 -->
          <path d="M 360 680 L 360 440 C 360 360, 640 360, 640 440 L 640 680" stroke="rgba(212, 175, 55, 0.35)" stroke-width="1.5" fill="none"/>
          <path d="M 420 680 L 420 480 C 420 420, 580 420, 580 480 L 580 680" stroke="rgba(245, 228, 168, 0.45)" stroke-width="1.2" fill="none"/>
          <line x1="500" y1="420" x2="500" y2="680" stroke="rgba(212, 175, 55, 0.25)" stroke-width="1" stroke-dasharray="3 3"/>

          <!-- 拱门主柱基座与壁柱 (Pilasters) -->
          <!-- 左壁柱 -->
          <rect x="160" y="320" width="120" height="360" fill="url(#archMainGrad)"/>
          <rect x="150" y="300" width="140" height="24" fill="#2d4f7c" stroke="url(#archGoldTrim)" stroke-width="1.5"/>
          <line x1="185" y1="330" x2="185" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="210" y1="330" x2="210" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="235" y1="330" x2="235" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="260" y1="330" x2="260" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <rect x="140" y="650" width="160" height="30" fill="#13233a" stroke="url(#archGoldTrim)" stroke-width="1.5"/>

          <!-- 右壁柱 -->
          <rect x="720" y="320" width="120" height="360" fill="url(#archMainGrad)"/>
          <rect x="710" y="300" width="140" height="24" fill="#2d4f7c" stroke="url(#archGoldTrim)" stroke-width="1.5"/>
          <line x1="745" y1="330" x2="745" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="770" y1="330" x2="770" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="795" y1="330" x2="795" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <line x1="820" y1="330" x2="820" y2="670" stroke="rgba(212, 175, 55, 0.35)" stroke-width="2"/>
          <rect x="700" y="650" width="160" height="30" fill="#13233a" stroke="url(#archGoldTrim)" stroke-width="1.5"/>

          <!-- 外拱券立体双层线脚 (Architrave & Voussoirs) -->
          <path d="M 160 320 C 160 140, 840 140, 840 320" stroke="url(#archMainGrad)" stroke-width="50" fill="none"/>
          <path d="M 175 315 C 175 155, 825 155, 825 315" stroke="url(#archGoldTrim)" stroke-width="3" fill="none"/>
          <path d="M 215 320 C 215 175, 785 175, 785 320" stroke="#102035" stroke-width="12" fill="none"/>
          <path d="M 230 320 C 230 190, 770 190, 770 320" stroke="url(#archGoldTrim)" stroke-width="2" fill="none"/>

          <!-- 内拱券深色藻井内圈 (Intrados) -->
          <path d="M 280 320 C 280 200, 720 200, 720 320" stroke="#0b1422" stroke-width="28" fill="none"/>
          <path d="M 280 320 C 280 200, 720 200, 720 320" stroke="rgba(212, 175, 55, 0.4)" stroke-width="1" stroke-dasharray="14 12" fill="none"/>

          <!-- 拱顶正中古典拱心石 (Keystone) 雕花立体块 -->
          <polygon points="465,105 535,105 525,185 475,185" fill="#2d4f7c" stroke="url(#archGoldTrim)" stroke-width="2"/>
          <circle cx="500" cy="142" r="14" fill="#1d3557" stroke="url(#archGoldTrim)" stroke-width="1.5"/>
          <polygon points="500,132 507,142 500,152 493,142" fill="var(--gold-primary)"/>

          <!-- 拱肩古典浮雕花草雕饰 (Spandrel Ornaments) -->
          <circle cx="230" cy="220" r="18" fill="#1d3557" stroke="url(#archGoldTrim)" stroke-width="1.5"/>
          <circle cx="770" cy="220" r="18" fill="#1d3557" stroke="url(#archGoldTrim)" stroke-width="1.5"/>

          <!-- 顶部主檐饰带 (Entablature & Dentil molding) -->
          <rect x="120" y="80" width="760" height="28" fill="#1d3557" stroke="url(#archGoldTrim)" stroke-width="1.5"/>
          <rect x="100" y="60" width="800" height="22" fill="#294a77" stroke="url(#archGoldTrim)" stroke-width="2"/>
          
          <!-- 齿饰线脚 (Dentil blocks) -->
          <g fill="var(--gold-primary)" opacity="0.8">
            <rect x="150" y="70" width="10" height="7"/>
            <rect x="180" y="70" width="10" height="7"/>
            <rect x="210" y="70" width="10" height="7"/>
            <rect x="240" y="70" width="10" height="7"/>
            <rect x="270" y="70" width="10" height="7"/>
            <rect x="300" y="70" width="10" height="7"/>
            <rect x="330" y="70" width="10" height="7"/>
            <rect x="360" y="70" width="10" height="7"/>
            <rect x="390" y="70" width="10" height="7"/>
            <rect x="420" y="70" width="10" height="7"/>
            <rect x="570" y="70" width="10" height="7"/>
            <rect x="600" y="70" width="10" height="7"/>
            <rect x="630" y="70" width="10" height="7"/>
            <rect x="660" y="70" width="10" height="7"/>
            <rect x="690" y="70" width="10" height="7"/>
            <rect x="720" y="70" width="10" height="7"/>
            <rect x="750" y="70" width="10" height="7"/>
            <rect x="780" y="70" width="10" height="7"/>
            <rect x="810" y="70" width="10" height="7"/>
            <rect x="840" y="70" width="10" height="7"/>
          </g>
        </svg>
      </div>
    `;

    this.container.appendChild(this.rootEl);
  }

  bindEvents() {
    const btn = this.rootEl.querySelector('#btn-start-journey');
    if (btn) {
      btn.addEventListener('click', () => {
        if (typeof this.onStart === 'function') {
          this.onStart();
        }
      });
    }
  }

  destroy() {
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
