// gallery.js — 《时光画廊》第一人称 3D 展厅入口（3D Agent 专属）
// createGallery(canvasEl, { onPaintingClick, onExitTimeline, assetBase? })
// 建筑一次建好；enterPeriod 只换画作纹理/画框尺寸/铭牌。

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { createMaterialLibrary } from './materials.js';
import { buildArchitecture, DIM } from './architecture.js';
import { ArtworkRig } from './artworks.js';
import { GalleryControls } from './controls.js';
import { buildHUD } from './hud.js';

const SCREEN_CENTER = new THREE.Vector2(0, 0);

function safeCall(fn, ...args) {
  try {
    if (typeof fn === 'function') fn(...args);
  } catch (err) {
    console.error('[gallery3d] 回调执行出错：', err);
  }
}

export function createGallery(canvasEl, options = {}) {
  const { onPaintingClick, onExitTimeline, assetBase = '' } = options;
  try {
    return initGallery(canvasEl, { onPaintingClick, onExitTimeline, assetBase });
  } catch (err) {
    console.error('[gallery3d] 画廊初始化失败（已降级为空实现，不影响主流程）：', err);
    const noop = () => {};
    return {
      enterPeriod: noop, setEnabled: noop, setVisible: noop,
      resize: noop, dispose: noop, __debug: null,
    };
  }
}

function initGallery(canvasEl, { onPaintingClick, onExitTimeline, assetBase }) {
  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.97;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x4a4238, 1); // 暖灰清屏色（非黑）

  /* ---------- 场景 / 相机 ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a4238);

  const camera = new THREE.PerspectiveCamera(
    66, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 500
  );

  // 环境反射：PMREM + RoomEnvironment（暗处兜底，防黑洞）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  /* ---------- 建筑 / 材质 / 画作 / 控制 / HUD ---------- */
  const mats = createMaterialLibrary(renderer);
  const arch = buildArchitecture(scene, mats);
  const rig = new ArtworkRig(scene, mats, arch.paintingSlots);

  const state = {
    enabled: false,   // false=停交互（详情面板打开时仍继续渲染）
    visible: false,   // false=停渲染循环省 GPU
    started: false,   // 是否已点击进入（显示引导卡）
    hovered: null,    // 当前 hover 的画作
    disposed: false,
    inExitZone: false,
  };
  let periodLabel = '';

  const controls = new GalleryControls(camera, canvasEl, {
    onInteract: () => trySelectPainting(),
    onReturnKey: () => tryExitByZone(),
    onLockChange: handleLockChange,
  });

  const hud = buildHUD(canvasEl.parentElement, {
    onEnterClick: enterFromOverlay,
    onExitClick: () => safeCall(onExitTimeline),
  });

  /* ---------- 后处理链：RenderPass(美) → SSAOPass(AO) → UnrealBloom(微) → OutputPass(ACES) ---------- */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight, 32);
  ssaoPass.kernelRadius = 0.6;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.1;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.5, 0.9
  );
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(ssaoPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  /* ---------- 交互 ---------- */
  const raycaster = new THREE.Raycaster();
  raycaster.far = 7.2;

  function updateHover() {
    if (!state.enabled || !controls.isLocked()) { setHovered(null, -1); return; }
    raycaster.setFromCamera(SCREEN_CENTER, camera);
    const hits = raycaster.intersectObjects(rig.getPaintingMeshes(), false);
    if (hits.length) {
      const ud = hits[0].object.userData;
      setHovered(ud.painting, ud.slotIndex);
    } else {
      setHovered(null, -1);
    }
  }

  function setHovered(painting, slotIndex) {
    if (state.hovered === painting && !!painting === hud.paintHintOn) return;
    state.hovered = painting;
    rig.setHover(slotIndex);
    hud.setCrosshairHover(!!painting);
    hud.paintHintOn = !!painting;
    hud.setPaintHint(painting ? `E / 点击 · 查看《${painting.titleZh || painting.titleEn || ''}》` : null);
  }

  function trySelectPainting() {
    if (!state.enabled || !state.hovered) return;
    safeCall(onPaintingClick, state.hovered);
  }

  function tryExitByZone() {
    if (!state.enabled || !state.inExitZone) return;
    safeCall(onExitTimeline);
  }

  function updateExitZone() {
    const p = camera.position;
    const d = Math.hypot(p.x - arch.doorCenter.x, p.z - arch.doorCenter.z);
    const inZone = state.enabled && d < 2.6;
    if (inZone !== state.inExitZone) {
      state.inExitZone = inZone;
      hud.setExitHint(inZone && controls.isLocked());
    }
  }

  function handleLockChange(locked) {
    if (state.disposed || !state.visible) return;
    if (locked) {
      hud.setPause(false);
    } else {
      setHovered(null, -1);
      hud.setExitHint(false);
      if (state.enabled && state.started && !hud.isGuideVisible()) hud.setPause(true);
    }
  }

  function enterFromOverlay() {
    if (state.disposed) return;
    // 兜底：画廊屏已激活但渲染未启动（如主控在转场回调中异常、未调用 setVisible/enterPeriod）
    if (!state.visible) {
      const screenActive = canvasEl.parentElement?.classList?.contains('active');
      if (screenActive) {
        console.warn('[gallery3d] 画廊屏已激活但 setVisible(true) 未被调用（检查主控 enterGallery 是否异常），已自动恢复渲染');
        setVisible(true);
      } else {
        return;
      }
    }
    if (hud.isGuideVisible()) {
      // 用户显式点击“进入画廊”——主控在 enterPeriod 后保持 disabled，
      // 这里视为进入意愿，恢复交互（详情面板打开时引导层不可见，不冲突）。
      state.enabled = true;
      state.started = true;
    }
    hud.setGuide('', false);
    hud.setPause(false);
    hud.setInteractive(state.enabled);
    controls.setEnabled(state.enabled);
    controls.requestLock();
    if (periodLabel) hud.showBanner(periodLabel); // 进入后重新展示时期横幅
  }

  /* ---------- 渲染循环 + 帧率自适应 ---------- */
  let rafId = 0;
  let lastT = 0;
  let fpsTime = 0;
  let fpsFrames = 0;
  let lowStreak = 0;
  let ssaoDisabled = false;

  function perfMonitor(dt) {
    if (ssaoDisabled) return;
    fpsTime += dt;
    fpsFrames++;
    if (fpsTime >= 1) {
      const fps = fpsFrames / fpsTime;
      if (fps < 30) lowStreak += fpsTime;
      else lowStreak = 0;
      if (lowStreak >= 3) {
        ssaoDisabled = true;
        ssaoPass.enabled = false;
        console.info('[gallery3d] 帧率 <30fps 持续 3 秒，已自动禁用 SSAO 以保证流畅');
        lowStreak = 0;
      }
      fpsTime = 0;
      fpsFrames = 0;
    }
  }

  function frame(dt) {
    // 暂停遮罩兜底：已进入画廊、可交互、但指针未锁定（如详情面板关闭后）→ 显示“点击继续”
    if (state.enabled && state.started && state.visible &&
        !controls.isLocked() && !hud.isGuideVisible() && !hud.isPauseVisible()) {
      hud.setPause(true);
    }
    if (controls.isLocked() && hud.isPauseVisible()) hud.setPause(false);

    controls.update(dt);
    updateHover();
    rig.update(dt);
    updateExitZone();
    perfMonitor(dt);
    composer.render(dt);
  }

  function tick(t) {
    rafId = requestAnimationFrame(tick);
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016;
    lastT = t;
    frame(dt);
  }

  /* ---------- 对外接口 ---------- */

  function enterPeriod(period, paintings) {
    if (state.disposed) return;
    const list = Array.isArray(paintings) ? paintings : [];
    rig.setPaintings(list.slice(0, arch.paintingSlots.length), assetBase);
    periodLabel = `${period.nameZh || ''} · ${period.years || ''}`;
    hud.showBanner(periodLabel);
    // 每次进入重新显示引导卡（点击进入 → 请求 Pointer Lock）
    state.started = false;
    state.enabled = false;
    hud.setGuide(`${period.nameZh || ''} · ${period.years || ''}`, true);
    hud.setPause(false);
    hud.setInteractive(false);
    setHovered(null, -1);
  }

  function setEnabled(b) {
    if (state.disposed) return;
    state.enabled = !!b;
    controls.setEnabled(state.enabled);
    hud.setInteractive(state.enabled);
    if (!state.enabled) {
      setHovered(null, -1);
      hud.setExitHint(false);
      hud.setPause(false);
    }
  }

  function setVisible(b) {
    if (state.disposed) return;
    state.visible = !!b;
    if (state.visible) {
      resize();
      if (!rafId) {
        lastT = 0;
        rafId = requestAnimationFrame(tick);
      }
    } else {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      controls.exitLock(); // 离开画廊释放指针（不劫持时间轴鼠标）
      hud.setPause(false);
    }
  }

  const onWindowResize = () => { if (state.visible) resize(); };
  window.addEventListener('resize', onWindowResize);

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    window.removeEventListener('resize', onWindowResize);
    controls.dispose();
    hud.dispose();
    rig.dispose();
    arch.dispose();
    envTex.dispose();
    composer.dispose();
    renderer.dispose();
  }

  return {
    enterPeriod,
    setEnabled,
    setVisible,
    resize,
    dispose,
    // QA/诊断：手动推进一帧（rAF 被环境冻结时可验证移动与渲染）
    tickOnce(dt) {
      if (state.disposed || !state.visible) return;
      frame(Math.min(0.1, Math.max(0.001, dt || 0.016)));
    },
    __debug: {
      camera,
      scene,
      renderer,
      setPose(x, z, yawDeg, pitchDeg) {
        controls.setPose(x, z, yawDeg, pitchDeg);
      },
      getPaintingMeshes() {
        return rig.getPaintingMeshes();
      },
      controls,
      composer,
      hud,
    },
  };
}
