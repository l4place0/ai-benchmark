// hud.js — 画廊 HUD（准星 / 提示条 / 时期横幅 / 返回按钮 / 引导与暂停遮罩），DOM 挂在 #screen-gallery 内

export function buildHUD(container, { onEnterClick, onExitClick } = {}) {
  const root = document.createElement('div');
  root.className = 'g3d-root g3d-idle';
  root.innerHTML = `
    <div class="g3d-crosshair" aria-hidden="true"><i class="g3d-dot"></i><i class="g3d-ring"></i></div>

    <div class="g3d-banner" role="status"></div>

    <div class="g3d-hint g3d-hint-paint" hidden></div>
    <div class="g3d-hint g3d-hint-exit" hidden><b>F</b>&nbsp;返回时间轴</div>

    <button type="button" class="g3d-exitbtn" title="返回时间轴">⏎&nbsp;返回时间轴</button>

    <div class="g3d-overlay g3d-guide">
      <div class="g3d-card">
        <div class="g3d-card-eyebrow">Time Gallery · Pantheon Rotunda</div>
        <h2 class="g3d-card-title">时光画廊</h2>
        <div class="g3d-card-sub"></div>
        <div class="g3d-keys">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span>
          <span><kbd>鼠标</kbd> 转向</span>
          <span><kbd>E</kbd> / 点击 查看画作</span>
          <span><kbd>Shift</kbd> 疾行</span>
          <span><kbd>F</kbd> 返回时间轴</span>
          <span><kbd>Esc</kbd> 暂停</span>
        </div>
        <button type="button" class="g3d-enter">点击进入画廊</button>
      </div>
    </div>

    <div class="g3d-overlay g3d-pause" hidden>
      <div class="g3d-card g3d-card-pause">
        <div class="g3d-pause-title">已暂停</div>
        <div class="g3d-pause-sub">点击任意处继续导览</div>
      </div>
    </div>
  `;
  container.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const crosshair = $('.g3d-crosshair');
  const banner = $('.g3d-banner');
  const paintHint = $('.g3d-hint-paint');
  const exitHint = $('.g3d-hint-exit');
  const exitBtn = $('.g3d-exitbtn');
  const guide = $('.g3d-guide');
  const pause = $('.g3d-pause');

  exitBtn.addEventListener('click', (e) => { e.stopPropagation(); onExitClick && onExitClick(); });
  guide.addEventListener('click', () => onEnterClick && onEnterClick());
  pause.addEventListener('click', () => onEnterClick && onEnterClick());

  let bannerTimer = 0;

  return {
    root,
    setCrosshairHover(on) { crosshair.classList.toggle('hover', !!on); },

    setPaintHint(text) {
      if (text) {
        paintHint.innerHTML = text;
        paintHint.hidden = false;
      } else {
        paintHint.hidden = true;
      }
    },

    setExitHint(on) { exitHint.hidden = !on; },

    showBanner(text) {
      banner.textContent = text;
      banner.classList.add('on');
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => banner.classList.remove('on'), 3400);
    },

    setGuide(periodInfo, visible) {
      $('.g3d-card-sub').textContent = periodInfo || '';
      guide.hidden = !visible;
    },
    isGuideVisible() { return !guide.hidden; },

    setPause(visible) { pause.hidden = !visible; },
    isPauseVisible() { return !pause.hidden; },

    /** 交互开关：禁用时隐藏准星/提示类元素（详情面板打开时不残留） */
    setInteractive(on) { root.classList.toggle('g3d-idle', !on); },

    dispose() {
      window.clearTimeout(bannerTimer);
      root.remove();
    },
  };
}
