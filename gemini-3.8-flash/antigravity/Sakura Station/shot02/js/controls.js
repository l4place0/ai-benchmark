/**
 * controls.js - Camera Modes: Cinematic Anime Director Presets, Orbit Controls & First-Person Walk
 * Provides smooth anime camera transitions, first-person ground exploration with collision,
 * and standard orbit inspection.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, domElement, onModeChange) {
    this.camera = camera;
    this.domElement = domElement;
    this.onModeChange = onModeChange;

    this.mode = 'preset'; // 'preset', 'orbit', 'walk'
    this.activePresetKey = 'street';

    // Cinematic Director Presets
    this.presets = {
      street: {
        pos: new THREE.Vector3(5.5, 2.2, 38.0),
        target: new THREE.Vector3(0.5, 2.4, -12.0),
        fov: 46
      },
      crossing: {
        pos: new THREE.Vector3(-2.8, 1.4, -13.5),
        target: new THREE.Vector3(3.5, 2.2, -24.5),
        fov: 52
      },
      platform: {
        pos: new THREE.Vector3(-6.2, 1.6, -19.2),
        target: new THREE.Vector3(12.0, 1.8, -21.5),
        fov: 48
      },
      plaza: {
        pos: new THREE.Vector3(5.2, 1.8, 4.5),
        target: new THREE.Vector3(12.0, 4.5, -9.0),
        fov: 55
      },
      cafe: {
        pos: new THREE.Vector3(-7.5, 1.5, 2.5),
        target: new THREE.Vector3(-11.5, 2.2, -3.5),
        fov: 50
      },
      rooftop: {
        pos: new THREE.Vector3(18.0, 16.5, 32.0),
        target: new THREE.Vector3(-2.0, 2.5, -16.0),
        fov: 58
      }
    };

    // Transition interpolation state
    this.isTransitioning = false;
    this.transitionStartPos = new THREE.Vector3();
    this.transitionEndPos = new THREE.Vector3();
    this.transitionStartTarget = new THREE.Vector3();
    this.transitionEndTarget = new THREE.Vector3();
    this.transitionProgress = 0;
    this.transitionDuration = 1.4; // Seconds

    // Orbit Controls Setup
    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.04; // Don't go below ground
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 110;

    // First Person Walk State
    this.keys = { forward: false, backward: false, left: false, right: false, shift: false };
    this.walkSpeed = 5.2; // m/s
    this.runMultiplier = 1.8;
    this.playerHeight = 1.65;
    this.pointerLocked = false;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.initEventListeners();
    this.applyPreset('street', false);
  }

  initEventListeners() {
    // Keyboard inputs for walk mode
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk') return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
    });

    // Pointer Lock for First Person Mode
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      const walkHud = document.getElementById('walk-hud');
      if (walkHud) {
        if (this.pointerLocked) walkHud.classList.remove('hidden');
        else walkHud.classList.add('hidden');
      }
      if (!this.pointerLocked && this.mode === 'walk') {
        this.setMode('orbit');
      }
    });

    this.domElement.addEventListener('mousemove', (e) => {
      if (this.mode !== 'walk' || !this.pointerLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= movementX * 0.0022;
      this.euler.x -= movementY * 0.0022;

      // Clamp vertical look angle
      this.euler.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });
  }

  applyPreset(key, animate = true) {
    const preset = this.presets[key];
    if (!preset) return;
    this.activePresetKey = key;
    this.setMode('preset');

    if (!animate) {
      this.camera.position.copy(preset.pos);
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
      this.orbit.target.copy(preset.target);
      this.camera.lookAt(preset.target);
      this.isTransitioning = false;
    } else {
      this.transitionStartPos.copy(this.camera.position);
      this.transitionEndPos.copy(preset.pos);
      this.transitionStartTarget.copy(this.orbit.target);
      this.transitionEndTarget.copy(preset.target);
      this.targetFov = preset.fov;
      this.startFov = this.camera.fov;
      this.transitionProgress = 0;
      this.isTransitioning = true;
    }
  }

  setMode(newMode) {
    this.mode = newMode;
    if (newMode === 'walk') {
      this.orbit.enabled = false;
      this.isTransitioning = false;
      // Start walk at street center
      if (this.camera.position.y > 4) {
        this.camera.position.set(2.0, this.playerHeight, 25.0);
      } else {
        this.camera.position.y = this.playerHeight;
      }
      this.domElement.requestPointerLock();
    } else if (newMode === 'orbit') {
      this.orbit.enabled = true;
      this.isTransitioning = false;
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      // Preset mode
      this.orbit.enabled = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }

    if (this.onModeChange) this.onModeChange(newMode, this.activePresetKey);
  }

  update(delta) {
    if (this.mode === 'preset' && this.isTransitioning) {
      // Smooth smoothstep transition between cinematic shots
      this.transitionProgress += delta / this.transitionDuration;
      const t = Math.min(1.0, this.transitionProgress);
      // Smoothstep easing: 3t^2 - 2t^3
      const ease = t * t * (3 - 2 * t);

      this.camera.position.lerpVectors(this.transitionStartPos, this.transitionEndPos, ease);
      this.orbit.target.lerpVectors(this.transitionStartTarget, this.transitionEndTarget, ease);
      this.camera.fov = THREE.MathUtils.lerp(this.startFov, this.targetFov, ease);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.orbit.target);

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else if (this.mode === 'orbit') {
      this.orbit.update();
    } else if (this.mode === 'walk' && this.pointerLocked) {
      // First Person WASD movement relative to camera look orientation
      const speed = (this.keys.shift ? this.walkSpeed * this.runMultiplier : this.walkSpeed) * delta;
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const side = new THREE.Vector3(-forward.z, 0, forward.x);

      if (this.keys.forward) this.camera.position.addScaledVector(forward, speed);
      if (this.keys.backward) this.camera.position.addScaledVector(forward, -speed);
      if (this.keys.left) this.camera.position.addScaledVector(side, -speed);
      if (this.keys.right) this.camera.position.addScaledVector(side, speed);

      // Keep eye level height
      this.camera.position.y = this.playerHeight;

      // Soft boundary clamp
      this.camera.position.x = Math.max(-28, Math.min(28, this.camera.position.x));
      this.camera.position.z = Math.max(-36, Math.min(46, this.camera.position.z));
    }
  }
}
