/**
 * 时光画廊 (Time Gallery) - 主应用与全局状态机 (App.js)
 * Master state machine: Welcome -> Timeline -> Gallery -> Detail -> Return
 * 无缝整合 GalleryScene 建筑、FrameManager 自适应画框与 FirstPersonControls 漫游
 */

import * as THREE from 'three';
import { WelcomeView } from './WelcomeView.js';
import { TimelineView } from './TimelineView.js';
import { DetailModal } from './DetailModal.js';
import { GalleryScene } from './GalleryScene.js';
import { FrameManager } from './FrameManager.js';
import { FirstPersonControls } from './FirstPersonControls.js';
import {
  ART_PERIODS,
  periods,
  paintings,
  getPeriodById,
  getPaintingsByPeriod
} from '../data/artHistoryData.js';

export const APP_STATE = {
  WELCOME: 'WELCOME',
  TIMELINE: 'TIMELINE',
  GALLERY: 'GALLERY',
  DETAIL: 'DETAIL'
};

export class App {
  constructor() {
    this.currentState = APP_STATE.WELCOME;
    this.currentPeriod = periods[1]; // 默认盛期文艺复兴
    this.paintingsData = paintings || [];

    // UI 视图与核心组件
    this.welcomeView = null;
    this.timelineView = null;
    this.detailModal = null;

    // 3D 核心系统实例
    this.threeScene = null;
    this.threeCamera = null;
    this.threeRenderer = null;
    this.galleryScene = null;
    this.frameManager = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this.rafId = null;
    this.is3DInitialized = false;

    // DOM 元素引用
    this.welcomeLayer = null;
    this.timelineLayer = null;
    this.galleryLayer = null;
    this.modalRoot = null;
    this.crosshairEl = null;
    this.promptEl = null;
    this.periodTitleEl = null;
    this.periodSubEl = null;
    this.pointerLockOverlay = null;

    // 交互状态
    this.targetedArtwork = null;
    this.isPointerLocked = false;
  }

  /**
   * 应用主初始化
   */
  async init() {
    this.initDOMElements();
    await this.loadManifest();
    this.initWelcomeView();
    this.initTimelineView();
    this.initDetailModal();
    this.initGalleryHUD();
    this.init3DGallery();

    // 初始进入欢迎页
    this.setState(APP_STATE.WELCOME);
  }

  initDOMElements() {
    this.welcomeLayer = document.getElementById('welcome-view');
    this.timelineLayer = document.getElementById('timeline-view');
    this.galleryLayer = document.getElementById('gallery-view');
    this.modalRoot = document.getElementById('modal-root');

    this.crosshairEl = document.getElementById('gallery-crosshair');
    this.promptEl = document.getElementById('gallery-prompt');
    this.periodTitleEl = document.getElementById('gallery-period-title');
    this.periodSubEl = document.getElementById('gallery-period-sub');
    this.pointerLockOverlay = document.getElementById('pointer-lock-overlay');
  }

  /**
   * 载入 manifest.json 补充全量画作数据
   */
  async loadManifest() {
    try {
      const response = await fetch('./js/data/manifest.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.paintingsData = data;
        }
      }
    } catch (e) {
      // 离线使用 artHistoryData.js 内嵌数据
      this.paintingsData = paintings;
    }
  }

  /**
   * 初始化欢迎屏
   */
  initWelcomeView() {
    this.welcomeView = new WelcomeView({
      onStart: () => {
        this.setState(APP_STATE.TIMELINE);
      }
    });
    this.welcomeView.mount(this.welcomeLayer);
  }

  /**
   * 初始化树状时间轴
   */
  initTimelineView() {
    this.timelineView = new TimelineView({
      onSelectPeriod: (periodId) => {
        this.enterGallery(periodId);
      },
      onBackToWelcome: () => {
        this.setState(APP_STATE.WELCOME);
      }
    });
    this.timelineView.mount(this.timelineLayer);
  }

  /**
   * 初始化单例画作详情面板 (STRICT: 防重复按 E)
   */
  initDetailModal() {
    this.detailModal = new DetailModal({
      container: this.modalRoot,
      onClose: () => {
        if (this.currentState === APP_STATE.DETAIL) {
          this.setState(APP_STATE.GALLERY);
          // 关闭详情后，若在画廊中可重新请求指针锁定
          const canvas = this.threeRenderer?.domElement;
          if (canvas && !this.isPointerLocked) {
            canvas.requestPointerLock?.();
          }
        }
      }
    });
  }

  /**
   * 初始化 HUD 界面元素与控制逻辑
   */
  initGalleryHUD() {
    const backBtn = document.getElementById('btn-gallery-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (document.exitPointerLock) {
          document.exitPointerLock();
        }
        this.setState(APP_STATE.TIMELINE);
      });
    }

    if (this.pointerLockOverlay) {
      this.pointerLockOverlay.addEventListener('click', () => {
        const canvas = this.threeRenderer?.domElement;
        if (canvas) {
          canvas.requestPointerLock?.();
        }
      });
    }

    // 监听 Pointer Lock 状态
    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.threeRenderer?.domElement;
      this.isPointerLocked = isLocked;
      if (this.pointerLockOverlay) {
        if (isLocked || this.currentState !== APP_STATE.GALLERY) {
          this.pointerLockOverlay.classList.remove('active');
        } else {
          this.pointerLockOverlay.classList.add('active');
        }
      }
    });
  }

  /**
   * 初始化 3D 万神殿场景、自适应画框管理器与第一人称控制器
   */
  init3DGallery() {
    const container = document.getElementById('gallery-canvas-container');
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Three.js 场景与摄像机
    this.threeScene = new THREE.Scene();
    this.threeCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.threeCamera.position.set(0, 1.7, 0);

    // 2. 渲染器 (PBR 高保真与 ACESFilmic 色调映射)
    this.threeRenderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.threeRenderer.setSize(width, height);
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.threeRenderer.toneMappingExposure = 1.05;

    container.innerHTML = '';
    container.appendChild(this.threeRenderer.domElement);

    // 3. 构建古典万神殿圆厅建筑 (藻井、齿饰、壁柱、天窗与地面反射)
    this.galleryScene = new GalleryScene({
      scene: this.threeScene,
      radius: 18.0,
      wallHeight: 14.0,
      bayCount: 8
    });

    // 4. 自适应宽高比画框管理器
    this.frameManager = new FrameManager({
      scene: this.galleryScene.roomGroup,
      maxCanvasWidth: 4.2,
      maxCanvasHeight: 3.2
    });

    // 5. 第一人称控制器 (WASD 严格防反向 + 射线拾取)
    this.controls = new FirstPersonControls(this.threeCamera, this.threeRenderer.domElement, {
      walkSpeed: 8.0,
      runSpeed: 14.0,
      damping: 9.0,
      maxRadius: 16.2,
      maxInteractDistance: 7.0,
      onHover: (item) => {
        const art = item.data || item;
        this.setTargetArtwork(art);
      },
      onLeave: () => {
        this.setTargetArtwork(null);
      },
      onSelect: (item) => {
        const art = item.data || item;
        this.openDetail(art);
      },
      onLockChange: (isLocked) => {
        this.isPointerLocked = isLocked;
        if (this.pointerLockOverlay) {
          if (isLocked || this.currentState !== APP_STATE.GALLERY) {
            this.pointerLockOverlay.classList.remove('active');
          } else {
            this.pointerLockOverlay.classList.add('active');
          }
        }
      }
    });

    // 窗口尺寸自适应
    window.addEventListener('resize', () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      this.threeCamera.aspect = w / h;
      this.threeCamera.updateProjectionMatrix();
      this.threeRenderer.setSize(w, h);
    });

    this.is3DInitialized = true;

    // 启动 3D 渲染主循环
    this.startRenderLoop();
  }

  /**
   * 步入指定艺术史时期的万神殿长廊
   * @param {string} periodId
   */
  enterGallery(periodId) {
    const period = getPeriodById(periodId);
    this.currentPeriod = period;

    // 1. 更新顶部导航 HUD
    if (this.periodTitleEl) {
      this.periodTitleEl.textContent = period.titleZh || period.nameZh;
    }
    if (this.periodSubEl) {
      this.periodSubEl.textContent = `${period.titleEn || period.nameEn} · ${period.era || period.timeSpan}`;
    }

    // 2. 筛选该时期的画作并挂载到万神殿 8 大展湾中
    if (this.frameManager && this.galleryScene) {
      let periodWorks = this.paintingsData.filter(p => p.periodId === periodId);
      if (!periodWorks || periodWorks.length === 0) {
        periodWorks = getPaintingsByPeriod(periodId);
      }
      if (!periodWorks || periodWorks.length === 0) {
        periodWorks = [period.representative];
      }

      const anchors = this.galleryScene.getAllBayAnchors();
      this.frameManager.mountPaintings(periodWorks, anchors);

      // 将挂载的画作注入控制器供准星射线拾取
      this.controls.setInteractiveObjects(this.frameManager.getInteractiveObjects());
    }

    // 3. 复位玩家摄像机至大厅中央
    if (this.threeCamera) {
      this.threeCamera.position.set(0, 1.7, 0);
      this.threeCamera.lookAt(0, 1.7, -10);
    }
    if (this.controls) {
      this.controls.resetOrientation?.();
    }

    // 4. 切换状态至画廊
    this.setState(APP_STATE.GALLERY);
  }

  /**
   * 开启画作详情面板 (STRICT: 单例防重锁)
   * @param {Object} artwork
   */
  openDetail(artwork) {
    if (!artwork || !this.detailModal) return;

    if (document.exitPointerLock) {
      document.exitPointerLock();
    }

    this.setState(APP_STATE.DETAIL);
    this.detailModal.open(artwork);
  }

  /**
   * 准星锁定与交互提示 ("按 E 或 点击查看画作")
   * @param {Object|null} artwork
   */
  setTargetArtwork(artwork) {
    this.targetedArtwork = artwork;
    if (artwork) {
      if (this.crosshairEl) this.crosshairEl.classList.add('active-target');
      if (this.promptEl) this.promptEl.classList.add('visible');
    } else {
      if (this.crosshairEl) this.crosshairEl.classList.remove('active-target');
      if (this.promptEl) this.promptEl.classList.remove('visible');
    }
  }

  /**
   * 全局状态机切换
   * @param {string} newState
   */
  setState(newState) {
    if (this.currentState === newState && newState !== APP_STATE.GALLERY) return;

    this.currentState = newState;

    // 切换各视图层的激活状态
    [this.welcomeLayer, this.timelineLayer, this.galleryLayer].forEach(layer => {
      if (layer) layer.classList.remove('active');
    });

    switch (newState) {
      case APP_STATE.WELCOME:
        if (this.welcomeLayer) this.welcomeLayer.classList.add('active');
        if (document.exitPointerLock) document.exitPointerLock();
        this.setTargetArtwork(null);
        break;

      case APP_STATE.TIMELINE:
        if (this.timelineLayer) this.timelineLayer.classList.add('active');
        if (document.exitPointerLock) document.exitPointerLock();
        this.setTargetArtwork(null);
        break;

      case APP_STATE.GALLERY:
        if (this.galleryLayer) this.galleryLayer.classList.add('active');
        if (this.pointerLockOverlay && !this.isPointerLocked) {
          this.pointerLockOverlay.classList.add('active');
        }
        break;

      case APP_STATE.DETAIL:
        // 画廊在四周边框留白 ~24px 处隐约透出
        if (this.galleryLayer) this.galleryLayer.classList.add('active');
        if (this.pointerLockOverlay) this.pointerLockOverlay.classList.remove('active');
        break;
    }
  }

  /**
   * 3D 渲染主循环
   */
  startRenderLoop() {
    const animate = () => {
      this.rafId = requestAnimationFrame(animate);
      const delta = Math.min(this.clock.getDelta(), 0.1);

      if (this.currentState === APP_STATE.GALLERY || this.currentState === APP_STATE.DETAIL) {
        if (this.controls && this.currentState === APP_STATE.GALLERY) {
          this.controls.update(delta);
        }
        if (this.threeRenderer && this.threeScene && this.threeCamera) {
          this.threeRenderer.render(this.threeScene, this.threeCamera);
        }
      }
    };

    animate();
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.frameManager) {
      this.frameManager.dispose();
    }
    if (this.galleryScene) {
      this.galleryScene.dispose();
    }
    if (this.threeRenderer) {
      this.threeRenderer.dispose();
    }
  }
}
