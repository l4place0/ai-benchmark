// Camera Controller with smooth spherical orbit, pan, zoom and preset focus transitions
import * as THREE from './libs/three.module.js';

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Target look-at point
    this.target = new THREE.Vector3(0, 1.6, 0);
    this.targetCurrent = this.target.clone();

    // Spherical coordinates (radius, phi [polar], theta [azimuthal])
    this.radius = 8.5;
    this.radiusTarget = 8.5;
    this.minRadius = 2.8;
    this.maxRadius = 14.0;

    this.theta = 0.75; // Horizontal angle
    this.thetaTarget = 0.75;

    this.phi = Math.PI / 4.2; // Vertical angle from Y+
    this.phiTarget = Math.PI / 4.2;
    this.minPhi = 0.15;
    this.maxPhi = Math.PI / 2 - 0.05; // Don't go below floor

    // Damping factor
    this.damping = 0.08;

    // Preset transitions
    this.isTransitioning = false;
    this.transitionDuration = 1.0;
    this.transitionTime = 0;
    this.startState = null;
    this.endState = null;

    // Mouse state
    this.isDragging = false;
    this.isRightDragging = false;
    this.prevMouse = { x: 0, y: 0 };
    this.dragThreshold = 4;
    this.totalDragDist = 0;

    this.initListeners();
    this.updateCameraImmediate();
  }

  initListeners() {
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('pointerdown', (e) => {
      this.isDragging = e.button === 0;
      this.isRightDragging = e.button === 2;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.totalDragDist = 0;
      if (this.isTransitioning) {
        this.isTransitioning = false;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging && !this.isRightDragging) return;

      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.totalDragDist += Math.hypot(dx, dy);

      if (this.isDragging) {
        // Orbit
        this.thetaTarget -= dx * 0.006;
        this.phiTarget -= dy * 0.006;
        this.phiTarget = Math.max(this.minPhi, Math.min(this.maxPhi, this.phiTarget));
      } else if (this.isRightDragging) {
        // Pan target along camera plane
        const forward = new THREE.Vector3().subVectors(this.camera.position, this.target).normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();

        const panSpeed = 0.004 * this.radius;
        this.target.addScaledVector(right, -dx * panSpeed);
        this.target.addScaledVector(up, dy * panSpeed);

        // Limit target bounds so user stays near room
        this.target.x = Math.max(-3.5, Math.min(3.5, this.target.x));
        this.target.y = Math.max(0.2, Math.min(3.8, this.target.y));
        this.target.z = Math.max(-3.5, Math.min(3.5, this.target.z));
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      this.isRightDragging = false;
    });

    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1 + Math.abs(e.deltaY) * 0.0012;
      if (e.deltaY > 0) {
        this.radiusTarget = Math.min(this.maxRadius, this.radiusTarget * zoomFactor);
      } else {
        this.radiusTarget = Math.max(this.minRadius, this.radiusTarget / zoomFactor);
      }
      this.isTransitioning = false;
    }, { passive: false });
  }

  // Smooth transition to camera preset
  moveToPreset(theta, phi, radius, target, duration = 1.2) {
    this.isTransitioning = true;
    this.transitionDuration = duration;
    this.transitionTime = 0;
    this.startState = {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      target: this.targetCurrent.clone()
    };
    this.endState = {
      theta: theta,
      phi: phi,
      radius: radius,
      target: target.clone()
    };
    this.thetaTarget = theta;
    this.phiTarget = phi;
    this.radiusTarget = radius;
    this.target.copy(target);
  }

  update(delta) {
    if (this.isTransitioning) {
      this.transitionTime += delta;
      const t = Math.min(1.0, this.transitionTime / this.transitionDuration);
      // Ease in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.theta = THREE.MathUtils.lerp(this.startState.theta, this.endState.theta, ease);
      this.phi = THREE.MathUtils.lerp(this.startState.phi, this.endState.phi, ease);
      this.radius = THREE.MathUtils.lerp(this.startState.radius, this.endState.radius, ease);
      this.targetCurrent.lerpVectors(this.startState.target, this.endState.target, ease);

      if (t >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      // Normal smooth inertia damping
      this.theta += (this.thetaTarget - this.theta) * this.damping;
      this.phi += (this.phiTarget - this.phi) * this.damping;
      this.radius += (this.radiusTarget - this.radius) * this.damping;
      this.targetCurrent.lerp(this.target, this.damping);
    }

    this.updateCameraImmediate();
  }

  updateCameraImmediate() {
    const sinPhiRadius = this.radius * Math.sin(this.phi);
    this.camera.position.x = this.targetCurrent.x + sinPhiRadius * Math.sin(this.theta);
    this.camera.position.y = this.targetCurrent.y + this.radius * Math.cos(this.phi);
    this.camera.position.z = this.targetCurrent.z + sinPhiRadius * Math.cos(this.theta);
    this.camera.lookAt(this.targetCurrent);
  }

  hasDragged() {
    return this.totalDragDist > this.dragThreshold;
  }
}
