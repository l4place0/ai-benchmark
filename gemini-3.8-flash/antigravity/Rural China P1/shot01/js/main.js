// js/main.js
// 应用程序主入口 - 控制器绑定、交互界面与渲染循环

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneManager } from './scene/sceneManager.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(this.container);

    this.initControls();
    this.initUI();
    this.animate();

    // 暴露给全局，方便自动化脚本 (Puppeteer) 驱动
    window.app = this;
    console.log("Hakka Tulou Voxel Diorama Initialized.");
  }

  initControls() {
    this.controls = new OrbitControls(this.sceneManager.camera, this.sceneManager.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // 防止跌落至地平线以下
    this.controls.minDistance = 10;
    this.controls.maxDistance = 280;
    this.controls.target.set(0, 8, 0);

    this.sceneManager.controls = this.controls;
  }

  initUI() {
    // 1. 视角切换按钮
    const viewButtons = document.querySelectorAll('[data-view]');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const viewKey = btn.getAttribute('data-view');
        this.switchView(viewKey);
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 2. 层级显示/隐藏切换
    const layerCheckboxes = document.querySelectorAll('[data-layer]');
    layerCheckboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const layerPath = cb.getAttribute('data-layer');
        const node = this.sceneManager.hierarchyNodes.get(layerPath);
        if (node) {
          node.visible = cb.checked;
        }
      });
    });

    // 3. 截屏导出
    const captureBtn = document.getElementById('btn-capture');
    if (captureBtn) {
      captureBtn.addEventListener('click', () => {
        this.captureScreenshot();
      });
    }

    // 4. OBJ 模型导出
    const exportBtn = document.getElementById('btn-export-obj');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportOBJ();
      });
    }
  }

  switchView(viewKey) {
    const preset = this.sceneManager.setCameraView(viewKey);
    const descEl = document.getElementById('view-description');
    if (descEl && preset) {
      descEl.textContent = preset.desc;
    }
    // 同步更新底部按钮激活状态
    const viewButtons = document.querySelectorAll('[data-view]');
    viewButtons.forEach(btn => {
      if (btn.getAttribute('data-view') === viewKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    console.log(`Switched to camera view: ${viewKey}`);
  }

  captureScreenshot() {
    this.sceneManager.render();
    const dataURL = this.sceneManager.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `tulou_voxel_${Date.now()}.png`;
    a.click();
  }

  exportOBJ() {
    const objString = this.sceneManager.voxelScene.toOBJString();
    const blob = new Blob([objString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hakka_tulou_voxel.obj';
    a.click();
    URL.revokeObjectURL(url);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    // 微妙的光影呼吸感
    const time = Date.now() * 0.001;
    if (this.sceneManager.lights && this.sceneManager.lights.lanternLightLeft) {
      const flicker = Math.sin(time * 6) * 0.15 + Math.cos(time * 11) * 0.1;
      this.sceneManager.lights.lanternLightLeft.intensity = 2.2 + flicker;
      this.sceneManager.lights.lanternLightRight.intensity = 2.2 - flicker;
    }

    this.sceneManager.render();
  }
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
