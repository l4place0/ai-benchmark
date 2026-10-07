import * as THREE from 'three';

// Cinematic Camera Director for Japanese Anime Preset Shots
export class CameraDirector {
  constructor(camera, orbitControls, fpController) {
    this.camera = camera;
    this.orbit = orbitControls;
    this.fp = fpController;

    this.currentMode = 'shot1'; // 'shot1' to 'shot5', 'orbit', 'fps'

    this.shots = {
      shot1: {
        name: '主街透视 (Street Vista)',
        pos: new THREE.Vector3(8.5, 2.2, 52.0),
        target: new THREE.Vector3(13.0, 2.0, 6.0),
        fov: 46
      },
      shot2: {
        name: '电车与站台 (Train & Platform)',
        pos: new THREE.Vector3(-1.8, 2.3, -9.2),
        target: new THREE.Vector3(-13.5, 2.1, -14.8),
        fov: 48
      },
      shot3: {
        name: '铁路道口 (Railway Crossing 踏切)',
        pos: new THREE.Vector3(15.2, 2.1, -3.5),
        target: new THREE.Vector3(22.0, 2.4, -16.5),
        fov: 48
      },
      shot4: {
        name: '站前广场与古樱 (Station Plaza)',
        pos: new THREE.Vector3(2.0, 2.2, 13.5),
        target: new THREE.Vector3(-8.0, 2.8, -4.0),
        fov: 52
      },
      shot5: {
        name: '小镇俯瞰全景 (Panoramic Aerial)',
        pos: new THREE.Vector3(28.0, 26.0, 44.0),
        target: new THREE.Vector3(-6.0, 2.5, -6.0),
        fov: 52
      }
    };

    // Transition interpolation variables
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.startPos = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.endPos = new THREE.Vector3();
    this.endTarget = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();

    // Set initial shot
    this.setShot('shot1', false);
  }

  setShot(shotKey, animate = true) {
    const s = this.shots[shotKey];
    if (!s) return;

    this.currentMode = shotKey;
    if (this.fp) this.fp.setEnabled(false);
    if (this.orbit) this.orbit.enabled = false;

    if (!animate) {
      this.camera.position.copy(s.pos);
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
      this.currentTarget.copy(s.target);
      this.camera.lookAt(s.target);
      if (this.orbit) this.orbit.target.copy(s.target);
      this.isTransitioning = false;
    } else {
      this.isTransitioning = true;
      this.transitionProgress = 0;
      this.startPos.copy(this.camera.position);
      this.startTarget.copy(this.currentTarget);
      this.endPos.copy(s.pos);
      this.endTarget.copy(s.target);
    }
  }

  setOrbitMode() {
    this.currentMode = 'orbit';
    this.isTransitioning = false;
    if (this.fp) this.fp.setEnabled(false);
    if (this.orbit) {
      this.orbit.enabled = true;
      this.orbit.target.copy(this.currentTarget);
    }
  }

  setFPSMode() {
    this.currentMode = 'fps';
    this.isTransitioning = false;
    if (this.orbit) this.orbit.enabled = false;
    if (this.fp) {
      this.fp.position.copy(this.camera.position);
      this.fp.setEnabled(true);
    }
  }

  update(delta) {
    if (this.isTransitioning) {
      this.transitionProgress += delta * 1.6;
      const t = Math.min(1.0, this.transitionProgress);
      // Smooth ease-in-out cubic curve
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.startPos, this.endPos, ease);
      this.currentTarget.lerpVectors(this.startTarget, this.endTarget, ease);
      this.camera.lookAt(this.currentTarget);

      if (t >= 1.0) {
        this.isTransitioning = false;
        if (this.orbit) this.orbit.target.copy(this.endTarget);
      }
    } else if (this.currentMode.startsWith('shot')) {
      // Gentle subtle anime handheld camera breathing float
      const time = Date.now() * 0.001;
      const swayX = Math.sin(time * 0.8) * 0.04;
      const swayY = Math.cos(time * 1.1) * 0.03;
      const basePos = this.shots[this.currentMode].pos;
      this.camera.position.set(basePos.x + swayX, basePos.y + swayY, basePos.z);
      this.camera.lookAt(this.currentTarget);
    }
  }
}
