// 主控：状态机 + 屏幕切换 + 数据加载。流程：欢迎页 → 时间轴 → 3D 画廊 → 详情面板 → 返回。

import { mountWelcome, animateWelcomeIn } from './ui/welcome.js';
import { mountTimeline, animateTimelineIn, hideTimelineCards } from './ui/timeline.js';
import { mountDetail, openDetail, closeDetail, isDetailOpen } from './ui/detail.js';
import { createGallery } from './gallery3d/gallery.js';

const $ = (id) => document.getElementById(id);
const veil = $('veil');
let gallery = null; // createGallery 实例，boot() 中赋值（模块级函数会引用）

const state = {
  screen: 'welcome',
  manifest: null,
  period: null,
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  state.screen = id.replace('screen-', '');
}

// 转场：遮罩淡入 → 切屏 → 遮罩淡出（非线性缓动由 CSS 提供）
let veiling = false;
function veilTransition(midAction) {
  if (veiling) return;
  veiling = true;
  veil.classList.add('on');
  window.setTimeout(() => {
    midAction();
    window.setTimeout(() => {
      veil.classList.remove('on');
      veiling = false;
    }, 140);
  }, 560);
}

function paintingsOf(pid) {
  return state.manifest.paintings.filter((p) => p.period === pid);
}

function enterTimeline() {
  if (state.screen === 'timeline') return;
  veilTransition(() => {
    showScreen('screen-timeline');
    animateTimelineIn();
  });
}

function enterGallery(pid) {
  const period = state.manifest.periods.find((p) => p.id === pid);
  if (!period) return;
  state.period = period;
  hideTimelineCards();
  veilTransition(() => {
    showScreen('screen-gallery');
    gallery.setVisible(true);
    gallery.enterPeriod(period, paintingsOf(pid));
    gallery.setEnabled(true); // 引导卡在引擎内部：未锁定指针前显示，点击后锁定
  });
}

function exitToTimeline() {
  if (state.screen !== 'gallery' || veiling) return;
  if (isDetailOpen()) closeDetail();
  gallery.setEnabled(false);
  veilTransition(() => {
    gallery.setVisible(false);
    showScreen('screen-timeline');
    animateTimelineIn();
  });
}

async function boot() {
  let manifest;
  try {
    const res = await fetch('./data/manifest.json');
    if (!res.ok) throw new Error(`manifest 加载失败 HTTP ${res.status}`);
    manifest = await res.json();
    if (!manifest.periods?.length || !manifest.paintings?.length) throw new Error('manifest 数据为空');
  } catch (err) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#f3ecdd;color:#5a4632;font-size:18px;z-index:999">数据加载失败：${err.message}（请通过 node server.js 启动）</div>`
    );
    throw err;
  }
  state.manifest = manifest;

  mountWelcome($('screen-welcome'), { onStart: enterTimeline });
  mountTimeline($('timeline-root'), {
    periods: manifest.periods,
    paintings: manifest.paintings,
    onSelectPeriod: enterGallery,
  });
  mountDetail($('detail-root'), {
    onClosed: () => {
      if (state.screen === 'gallery' && !veiling) gallery.setEnabled(true);
    },
  });

  gallery = createGallery($('gallery-canvas'), {
    onPaintingClick: (painting) => {
      if (state.screen !== 'gallery' || veiling || isDetailOpen()) return;
      gallery.setEnabled(false); // 先断输入，防止连按 E 触发第二个面板
      document.exitPointerLock?.();
      openDetail(painting, state.period);
    },
    onExitTimeline: exitToTimeline,
  });
  window.__tgGallery = gallery; // QA 诊断句柄
  gallery.setVisible(false); // 非画廊屏不渲染

  showScreen('screen-welcome');
  animateWelcomeIn();
}

boot();
