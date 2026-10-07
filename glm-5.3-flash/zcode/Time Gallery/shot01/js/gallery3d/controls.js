// controls.js — 第一人称控制：Pointer Lock + 相机四元数移动（A 左移 / D 右移）+ 径向碰撞

import * as THREE from 'three';
import { DIM } from './architecture.js';

const DEG = Math.PI / 180;
const SENS = 0.0021;
const SPEED_WALK = 3.2;
const SPEED_RUN = 5.5;
const PITCH_LIMIT = 75 * DEG;

export class GalleryControls {
  /**
   * @param camera THREE.PerspectiveCamera
   * @param domElement 锁定目标（canvas）
   * @param opts { onInteract, onReturnKey, onLockChange }
   */
  constructor(camera, domElement, opts = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.opts = opts;
    this.enabled = false;
    this.locked = false;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = Object.create(null);
    this.vel = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._right = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._move = new THREE.Vector3();

    camera.position.set(0, DIM.EYE, 9.5);
    this._applyLook();

    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (this.enabled && !e.repeat) {
        if (e.code === 'KeyE') this.opts.onInteract && this.opts.onInteract();
        if (e.code === 'KeyF') this.opts.onReturnKey && this.opts.onReturnKey();
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    this._onMouseMove = (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * SENS;
      this.pitch -= e.movementY * SENS;
      if (this.pitch > PITCH_LIMIT) this.pitch = PITCH_LIMIT;
      if (this.pitch < -PITCH_LIMIT) this.pitch = -PITCH_LIMIT;
      this._applyLook();
    };
    this._onMouseDown = () => {
      // 锁定状态下的点击 = 选中视线内画作；未锁定时由遮罩/引导层处理
      if (this.enabled && this.locked) this.opts.onInteract && this.opts.onInteract();
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.domElement;
      if (!this.locked) this.keys = Object.create(null);
      this.opts.onLockChange && this.opts.onLockChange(this.locked);
    };
    this._onLockError = () => {
      this.locked = false;
      this.opts.onLockChange && this.opts.onLockChange(false);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);
  }

  _applyLook() {
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
  }

  setEnabled(b) {
    this.enabled = b;
    if (!b) {
      this.keys = Object.create(null);
      this.vel.set(0, 0, 0);
    }
  }

  isLocked() { return this.locked; }

  requestLock() {
    try {
      const p = this.domElement.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => { /* 浏览器冷却期，忽略 */ });
    } catch { /* 忽略 */ }
  }

  exitLock() {
    try { document.exitPointerLock && document.exitPointerLock(); } catch { /* 忽略 */ }
  }

  setPose(x, z, yawDeg, pitchDeg) {
    this.camera.position.set(x, DIM.EYE, z);
    this.yaw = yawDeg * DEG;
    this.pitch = pitchDeg * DEG;
    this._applyLook();
    this.vel.set(0, 0, 0);
  }

  /** 每帧移动。方向实现严格基于相机四元数：
   *  right = (1,0,0)·quaternion，fwd = (0,0,-1)·quaternion（只取水平分量）
   *  D 加 right、A 减 right、W 加 fwd、S 减 fwd。 */
  update(dt) {
    if (!this.enabled || dt <= 0) return;
    const k = this.keys;
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this._fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._right.y = 0;
    this._fwd.y = 0;
    if (this._right.lengthSq() > 1e-8) this._right.normalize();
    if (this._fwd.lengthSq() > 1e-8) this._fwd.normalize();

    this._move.set(0, 0, 0);
    if (k.KeyW || k.ArrowUp) this._move.add(this._fwd);
    if (k.KeyS || k.ArrowDown) this._move.sub(this._fwd);
    if (k.KeyD || k.ArrowRight) this._move.add(this._right);
    if (k.KeyA || k.ArrowLeft) this._move.sub(this._right);
    if (this._move.lengthSq() > 0) this._move.normalize();

    const speed = (k.ShiftLeft || k.ShiftRight) ? SPEED_RUN : SPEED_WALK;
    // 速度平滑（保持方向语义不变）
    const smooth = 1 - Math.exp(-dt * 11);
    this.vel.lerp(this._move.multiplyScalar(speed), smooth);
    if (this.vel.lengthSq() < 1e-6) this.vel.set(0, 0, 0);

    const pos = this.camera.position;
    pos.addScaledVector(this.vel, dt);
    pos.y = DIM.EYE;

    // 径向碰撞：限制在半径 R_MAX 圆内
    const r = Math.hypot(pos.x, pos.z);
    if (r > DIM.R_MAX) {
      const s = DIM.R_MAX / r;
      pos.x *= s;
      pos.z *= s;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
  }
}
