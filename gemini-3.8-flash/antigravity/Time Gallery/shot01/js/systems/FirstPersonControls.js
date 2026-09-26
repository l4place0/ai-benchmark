/**
 * 时光画廊 (Time Gallery) - 第一人称漫游控制器 (FirstPersonControls.js)
 * 1. 标准第一人称键鼠漫游 (WASD + 方向键 + 鼠标视角 + Pointer Lock API)
 * 2. 严格方向验证 (严禁反向):
 *    - 'KeyA' / 'ArrowLeft'  -> 向左平移 (Strafe Left)
 *    - 'KeyD' / 'ArrowRight' -> 向右平移 (Strafe Right)
 *    - 'KeyW' / 'ArrowUp'    -> 向前移动 (Move Forward)
 *    - 'KeyS' / 'ArrowDown'  -> 向后移动 (Move Backward)
 * 3. 碰撞检测: 限制在万神殿圆形大厅内 (半径边界限制)
 * 4. 准心射线拾取: 检测 7 米范围内朝向的画作，提供 getHoveredPainting()，派发交互事件与提示
 */

import * as THREE from 'three';

export class FirstPersonControls {
  /**
   * @param {THREE.Camera} camera 相机实例
   * @param {HTMLElement} domElement 画布或事件监听元素
   * @param {Object} options 配置项
   */
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.domElement = domElement || document.body;

    // 参数配置
    this.walkSpeed = options.walkSpeed || 8.0;      // 行走速度 (米/秒)
    this.runSpeed = options.runSpeed || 14.0;       // 奔跑速度 (米/秒)
    this.lookSpeed = options.lookSpeed || 0.0022;   // 鼠标视角灵敏度
    this.damping = options.damping || 9.0;          // 惯性平滑阻尼
    this.eyeHeight = options.eyeHeight || 1.7;      // 人体正常视高 (米)
    this.maxRadius = options.maxRadius || 16.2;     // 圆形大厅漫游半径限制 (米)
    this.maxInteractDistance = options.maxInteractDistance || 7.0; // 画作拾取有效距离 (米)

    // 交互回调
    this.onHover = options.onHover || (() => {});
    this.onLeave = options.onLeave || (() => {});
    this.onSelect = options.onSelect || (() => {});
    this.onLockChange = options.onLockChange || (() => {});

    // 状态
    this.enabled = true;
    this.isLocked = false;
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // 按键状态表
    this.keys = {
      KeyW: false,
      KeyS: false,
      KeyA: false,
      KeyD: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      ShiftLeft: false,
      ShiftRight: false
    };

    // 拾取与射线
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.maxInteractDistance;
    this.interactiveObjects = [];
    this.hoveredPainting = null;
    this.hoveredObject = null;

    // 内部计算临时向量 (避免每帧内存分配)
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._centerScreen = new THREE.Vector2(0, 0);

    // 平滑过渡 (例如时期跳转视角漫游)
    this._isTransitioning = false;
    this._transitionStartPos = new THREE.Vector3();
    this._transitionTargetPos = new THREE.Vector3();
    this._transitionStartQuat = new THREE.Quaternion();
    this._transitionTargetQuat = new THREE.Quaternion();
    this._transitionProgress = 0;
    this._transitionDuration = 1.2;

    // 初始位置设定
    if (this.camera.position.y === 0) {
      this.camera.position.set(0, this.eyeHeight, 0);
    }
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    // 绑定事件处理器
    this._bindEvents();

    // 创建沉浸式微交互提示 UI
    this._createPromptElement();
  }

  // ==========================================================================
  // 事件绑定与 Pointer Lock 管理
  // ==========================================================================

  _bindEvents() {
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onPointerLockError = this._handlePointerLockError.bind(this);
    this._onClick = this._handleClick.bind(this);

    document.addEventListener('keydown', this._onKeyDown, false);
    document.addEventListener('keyup', this._onKeyUp, false);
    document.addEventListener('mousemove', this._onMouseMove, false);
    document.addEventListener('pointerlockchange', this._onPointerLockChange, false);
    document.addEventListener('pointerlockerror', this._onPointerLockError, false);
    this.domElement.addEventListener('click', this._onClick, false);
  }

  /**
   * 请求锁定鼠标指针
   */
  lock() {
    if (!this.isLocked && this.domElement.requestPointerLock) {
      this.domElement.requestPointerLock();
    }
  }

  /**
   * 退出鼠标指针锁定
   */
  unlock() {
    if (this.isLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  _handleClick(event) {
    if (!this.enabled) return;

    if (!this.isLocked) {
      this.lock();
    } else {
      // 锁定状态下点击左键：若当前有注视画作，触发画作详情交互
      if (this.hoveredPainting) {
        this.onSelect(this.hoveredPainting, this.hoveredObject);
      }
    }
  }

  _handlePointerLockChange() {
    const isLocked = document.pointerLockElement === this.domElement;
    this.isLocked = isLocked;
    this.onLockChange(isLocked);

    if (this.promptEl) {
      if (!isLocked) {
        this._hidePrompt();
      }
    }
  }

  _handlePointerLockError(err) {
    console.warn('FirstPersonControls: Pointer lock failed', err);
  }

  // ==========================================================================
  // 视角旋转控制 (Mouse Look)
  // ==========================================================================

  _handleMouseMove(event) {
    if (!this.enabled || !this.isLocked || this._isTransitioning) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    // Yaw (水平偏航): 鼠标向右移 -> 镜头向右转
    this.euler.y -= movementX * this.lookSpeed;

    // Pitch (垂直俯仰): 鼠标向上移 -> 镜头向上看 (仰视万神殿穹顶与天窗)
    this.euler.x -= movementY * this.lookSpeed;

    // 俯仰角限制: 允许仰视到天窗正上方 (~87度) 与俯视地板 (~87度)，避免画面反转翻滚
    const maxPitch = Math.PI / 2 - 0.05;
    this.euler.x = Math.max(-maxPitch, Math.min(maxPitch, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  // ==========================================================================
  // 键盘输入 (WASD + 方向键严格方向控制)
  // ==========================================================================

  _handleKeyDown(event) {
    if (!this.enabled) return;

    if (event.code in this.keys) {
      this.keys[event.code] = true;
    }

    // 交互按键：按 E 键或空格键触发当前画作详情
    if (event.code === 'KeyE' || event.code === 'Space') {
      if (this.hoveredPainting) {
        event.preventDefault();
        this.onSelect(this.hoveredPainting, this.hoveredObject);
      }
    }
  }

  _handleKeyUp(event) {
    if (event.code in this.keys) {
      this.keys[event.code] = false;
    }
  }

  // ==========================================================================
  // 核心运动更新循环 (Per-frame Physics & Direction Verification)
  // ==========================================================================

  /**
   * 必须在 requestAnimationFrame 循环中调用
   * @param {number} delta 帧间隔时间 (秒)
   */
  update(delta = 0.016) {
    if (!this.enabled) return;

    // 1. 如果正在平滑飞行漫游中，插值位置与视角
    if (this._isTransitioning) {
      this._updateTransition(delta);
      return;
    }

    // 2. 惯性物理阻尼衰减
    this.velocity.x -= this.velocity.x * this.damping * delta;
    this.velocity.z -= this.velocity.z * this.damping * delta;

    // 3. 严格方向判定与验证
    // KeyW / ArrowUp    -> 前进 (Forward)
    // KeyS / ArrowDown  -> 后退 (Backward)
    // KeyA / ArrowLeft  -> 向左平移 (Strafe Left)
    // KeyD / ArrowRight -> 向右平移 (Strafe Right)
    const moveForward = Boolean(this.keys.KeyW || this.keys.ArrowUp);
    const moveBackward = Boolean(this.keys.KeyS || this.keys.ArrowDown);
    const moveLeft = Boolean(this.keys.KeyA || this.keys.ArrowLeft);
    const moveRight = Boolean(this.keys.KeyD || this.keys.ArrowRight);

    if (moveForward || moveBackward || moveLeft || moveRight) {
      // 提取相机当前的水平朝向前进向量 (锁定在 XZ 水平地面，不受抬头仰角影响)
      this.camera.getWorldDirection(this._forward);
      this._forward.y = 0;
      this._forward.normalize();

      // 计算标准右向量: Right = Forward × Up (Three.js 坐标系下 forward x (0,1,0) 指向屏幕右方)
      this._right.crossVectors(this._forward, this._up).normalize();

      this._moveDir.set(0, 0, 0);

      // 前进 / 后退
      if (moveForward) this._moveDir.add(this._forward);
      if (moveBackward) this._moveDir.sub(this._forward);

      // 向右平移 (KeyD / ArrowRight) / 向左平移 (KeyA / ArrowLeft)
      if (moveRight) this._moveDir.add(this._right);
      if (moveLeft) this._moveDir.sub(this._right);

      if (this._moveDir.lengthSq() > 0) {
        this._moveDir.normalize();

        // 奔跑加速判断
        const isRunning = this.keys.ShiftLeft || this.keys.ShiftRight;
        const currentSpeed = isRunning ? this.runSpeed : this.walkSpeed;

        this.velocity.addScaledVector(this._moveDir, currentSpeed * delta * 25.0);
      }
    }

    // 4. 更新摄像机位置
    this.camera.position.addScaledVector(this.velocity, delta);

    // 5. 碰撞检测与圆形大厅边界约束 (Rotunda Perimeter Clamping)
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    const distFromCenter = Math.hypot(px, pz);

    if (distFromCenter > this.maxRadius) {
      // 贴墙平滑滑动：将位置限制在半径内
      const factor = this.maxRadius / distFromCenter;
      this.camera.position.x = px * factor;
      this.camera.position.z = pz * factor;
    }

    // 保持恒定人体视高
    this.camera.position.y = this.eyeHeight;

    // 6. 准心射线拾取与画作悬停判定
    this._updateRaycasting();
  }

  // ==========================================================================
  // 射线拾取与画作悬停互动 (Raycasting)
  // ==========================================================================

  /**
   * 注册参与射线交互的画作/画框网格数组
   * @param {THREE.Object3D[]} objects
   */
  setInteractiveObjects(objects) {
    this.interactiveObjects = objects || [];
  }

  _updateRaycasting() {
    if (!this.interactiveObjects || this.interactiveObjects.length === 0) return;

    // 从屏幕准心中心发射射线
    this.raycaster.setFromCamera(this._centerScreen, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    let activeHit = null;

    if (intersects.length > 0) {
      for (const hit of intersects) {
        if (hit.distance <= this.maxInteractDistance) {
          // 向上遍历查找带有 paintingData 的节点
          let curr = hit.object;
          while (curr) {
            if (curr.userData && curr.userData.paintingData) {
              activeHit = {
                data: curr.userData.paintingData,
                object: curr,
                distance: hit.distance
              };
              break;
            }
            curr = curr.parent;
          }
          if (activeHit) break;
        }
      }
    }

    if (activeHit) {
      // 悬停在画作上
      if (this.hoveredPainting !== activeHit.data) {
        this.hoveredPainting = activeHit.data;
        this.hoveredObject = activeHit.object;
        this.onHover(activeHit.data, activeHit.object);
        this._showPrompt(activeHit.data);
      }
    } else {
      // 离开画作
      if (this.hoveredPainting) {
        this.hoveredPainting = null;
        this.hoveredObject = null;
        this.onLeave();
        this._hidePrompt();
      }
    }
  }

  /**
   * 获取当前正注视的画作数据
   * @returns {Object|null}
   */
  getHoveredPainting() {
    return this.hoveredPainting;
  }

  // ==========================================================================
  // 优雅视角平滑过渡 (Smooth Teleport / Fly to Painting)
  // ==========================================================================

  /**
   * 平滑将相机镜头对准指定画作前方的观赏站位
   * @param {THREE.Vector3} targetPos 目标站位坐标
   * @param {THREE.Vector3} lookAtPos 目标注视中心 (通常为画框中心)
   * @param {number} duration 过渡时间 (秒)
   */
  glideTo(targetPos, lookAtPos, duration = 1.4) {
    this._isTransitioning = true;
    this._transitionProgress = 0;
    this._transitionDuration = duration;

    this._transitionStartPos.copy(this.camera.position);
    this._transitionTargetPos.copy(targetPos);
    this._transitionTargetPos.y = this.eyeHeight;

    this._transitionStartQuat.copy(this.camera.quaternion);

    // 计算朝向目标画作的目标四元数
    const dummy = new THREE.Object3D();
    dummy.position.copy(targetPos);
    dummy.lookAt(lookAtPos.x, this.eyeHeight, lookAtPos.z);
    this._transitionTargetQuat.copy(dummy.quaternion);
  }

  _updateTransition(delta) {
    this._transitionProgress += delta / this._transitionDuration;
    const t = Math.min(1.0, this._transitionProgress);

    // 非线性缓动贝塞尔 (Cubic Out: 1 - (1 - t)^3)
    const ease = 1 - Math.pow(1 - t, 3);

    this.camera.position.lerpVectors(this._transitionStartPos, this._transitionTargetPos, ease);
    this.camera.quaternion.slerpQuaternions(this._transitionStartQuat, this._transitionTargetQuat, ease);

    if (t >= 1.0) {
      this._isTransitioning = false;
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.velocity.set(0, 0, 0);
    }
  }

  // ==========================================================================
  // 准心交互提示 DOM 构件 (Prompt UI)
  // ==========================================================================

  _createPromptElement() {
    if (document.getElementById('gallery-interact-prompt')) {
      this.promptEl = document.getElementById('gallery-interact-prompt');
      return;
    }

    this.promptEl = document.createElement('div');
    this.promptEl.id = 'gallery-interact-prompt';
    this.promptEl.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(22, 26, 36, 0.92);
      border: 1px solid rgba(212, 175, 55, 0.6);
      border-radius: 30px;
      padding: 10px 24px;
      color: #f8f6f0;
      font-family: "Cinzel", "Songti SC", "SimSun", serif;
      font-size: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(212, 175, 55, 0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000;
    `;
    document.body.appendChild(this.promptEl);
  }

  _showPrompt(paintingData) {
    if (!this.promptEl) return;
    const title = paintingData.titleZh || paintingData.title || '画作';
    this.promptEl.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#d4af37; box-shadow:0 0 8px #d4af37;"></span>
      <span>按 <b style="color:#ffe082; background:rgba(212,175,55,0.2); padding:2px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.4);">E</b> 或 <b style="color:#ffe082;">点击鼠标</b> 查看《${title}》传世赏析</span>
    `;
    this.promptEl.style.opacity = '1';
    this.promptEl.style.transform = 'translateX(-50%) translateY(0)';
  }

  _hidePrompt() {
    if (!this.promptEl) return;
    this.promptEl.style.opacity = '0';
    this.promptEl.style.transform = 'translateX(-50%) translateY(16px)';
  }

  /**
   * 重置朝向与物理速度，同步当前相机的偏航与俯仰角
   */
  resetOrientation() {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.velocity.set(0, 0, 0);
  }

  // ==========================================================================
  // 资源销毁与事件解绑 (Dispose)
  // ==========================================================================

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown, false);
    document.removeEventListener('keyup', this._onKeyUp, false);
    document.removeEventListener('mousemove', this._onMouseMove, false);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', this._onPointerLockError, false);
    this.domElement.removeEventListener('click', this._onClick, false);

    if (this.promptEl && this.promptEl.parentNode) {
      this.promptEl.parentNode.removeChild(this.promptEl);
      this.promptEl = null;
    }
  }
}
