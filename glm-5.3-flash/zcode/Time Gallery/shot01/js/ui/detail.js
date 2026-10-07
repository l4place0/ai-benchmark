// 画作详情面板：全局唯一 DOM。打开/关闭动画 + Esc/点暗背景关闭 + openDetail 幂等。
// 接口：mountDetail(rootEl, { onClosed }) / openDetail(painting, period)
//       closeDetail() / isDetailOpen()

let overlay = null;
let panel = null;
const els = {};
let isOpenFlag = false;
let closeTimer = 0;
let onClosedCb = null;
let mounted = false;

function collectEls() {
  els.close = panel.querySelector('.d-close');
  els.backdrop = overlay.querySelector('.detail-backdrop');
  els.img = panel.querySelector('.d-img');
  els.fallback = panel.querySelector('.d-fig-fallback');
  els.titleZh = panel.querySelector('.d-title-zh');
  els.titleEn = panel.querySelector('.d-title-en');
  els.artistZh = panel.querySelector('.d-artist-zh');
  els.artistEn = panel.querySelector('.d-artist-en');
  els.life = panel.querySelector('.d-v-life');
  els.year = panel.querySelector('.d-v-year');
  els.badge = panel.querySelector('.d-badge');
  els.intro = panel.querySelector('.d-intro');
  els.src = panel.querySelector('.d-src');
  els.license = panel.querySelector('.d-license');
  els.info = panel.querySelector('.d-info');
}

function showFallback() {
  els.img.style.display = 'none';
  els.fallback.style.display = 'flex';
}

function fill(painting, period) {
  const p = painting || {};

  // 左栏大图：加载失败 → “图片缺失”占位
  els.img.style.display = '';
  els.fallback.style.display = 'none';
  els.img.onload = () => {
    els.fallback.style.display = 'none';
    els.img.style.display = '';
  };
  els.img.onerror = showFallback;
  els.img.alt = p.titleEn || p.titleZh || 'painting';
  if (p.file) {
    els.img.src = p.file;
    if (els.img.complete && els.img.naturalWidth === 0) showFallback();
  } else {
    els.img.removeAttribute('src');
    showFallback();
  }

  // 右栏信息
  els.titleZh.textContent = p.titleZh || '';
  els.titleEn.textContent = p.titleEn || '';
  els.titleEn.style.display = p.titleEn ? '' : 'none';
  els.artistZh.textContent = p.artistZh || '';
  els.artistEn.textContent = p.artistEn || '';
  els.artistEn.style.display = p.artistEn ? '' : 'none';
  els.life.textContent = `${p.artistBirth || '—'} – ${p.artistDeath || '—'}`;
  els.year.textContent = p.year || '—';
  if (period && period.nameZh) {
    els.badge.style.display = '';
    els.badge.textContent = period.nameZh;
    els.badge.style.background = period.accent || 'var(--ink)';
  } else {
    els.badge.style.display = 'none';
  }
  els.intro.textContent = (period && period.introZh) || '';
  els.src.textContent = p.sourceUrl || '—';
  els.license.textContent = p.license || '';
  els.info.scrollTop = 0; // 每次打开回到顶部
}

/* ---------------- 对外接口 ---------------- */

export function mountDetail(rootEl, { onClosed } = {}) {
  onClosedCb = typeof onClosed === 'function' ? onClosed : null;
  if (mounted) return; // 全局唯一
  mounted = true;

  overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="detail-backdrop"></div>
    <section class="detail-panel" role="dialog" aria-modal="true" aria-label="画作详情">
      <button type="button" class="d-close" aria-label="关闭详情">×</button>
      <figure class="d-fig">
        <img class="d-img" alt="" draggable="false">
        <div class="d-fig-fallback">
          <div class="d-missing">
            <span class="d-missing-zh">图片缺失</span>
            <span class="d-missing-en">IMAGE UNAVAILABLE</span>
          </div>
        </div>
      </figure>
      <div class="d-info">
        <h2 class="d-title-zh"></h2>
        <div class="d-title-en"></div>
        <hr class="d-rule">
        <div class="d-artist">
          <span class="d-artist-zh"></span><span class="d-artist-en"></span>
        </div>
        <dl class="d-meta">
          <dt>生卒年</dt><dd class="d-v-life"></dd>
          <dt>创作年代</dt><dd class="d-v-year"></dd>
          <dt>所属时期</dt><dd><span class="d-badge"></span></dd>
        </dl>
        <div class="d-block">
          <div class="d-block-h">时期简介</div>
          <p class="d-intro"></p>
        </div>
        <div class="d-block">
          <div class="d-block-h">来源</div>
          <code class="d-src"></code>
        </div>
        <div class="d-block">
          <div class="d-block-h">授权</div>
          <div class="d-license"></div>
        </div>
      </div>
    </section>`;
  rootEl.appendChild(overlay);

  panel = overlay.querySelector('.detail-panel');
  collectEls();

  els.close.addEventListener('click', closeDetail);
  els.backdrop.addEventListener('click', closeDetail); // 点击面板外暗背景区域关闭
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpenFlag) closeDetail(); // 仅在已打开时响应
  });
}

export function openDetail(painting, period) {
  if (!overlay || isOpenFlag || !painting) return; // 幂等：已打开直接 return
  isOpenFlag = true;
  clearTimeout(closeTimer);
  fill(painting, period);
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

export function closeDetail() {
  if (!overlay || !isOpenFlag) return;
  isOpenFlag = false;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  clearTimeout(closeTimer);
  // 关闭动画 260ms，结束后再回调（若期间被重新打开则跳过）
  closeTimer = setTimeout(() => {
    if (!isOpenFlag && onClosedCb) onClosedCb();
  }, 300);
}

export function isDetailOpen() {
  return isOpenFlag;
}
