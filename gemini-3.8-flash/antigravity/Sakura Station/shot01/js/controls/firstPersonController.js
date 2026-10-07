import * as THREE from 'three';

// First-Person Walk / Roam Controller (WASD + Mouse Look + Sprint + Platform Stride)
export class FirstPersonController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = false;

    // Movement states
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;

    // Physics & position
    this.position = new THREE.Vector3(8, 1.65, 38); // Starts on main street
    this.velocity = new THREE.Vector3();
    this.walkSpeed = 5.5;
    this.runSpeed = 10.0;
    this.bobTimer = 0;

    // Rotation angles
    this.yaw = 0;
    this.pitch = 0;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.yaw -= deltaX * 0.0028;
      this.pitch -= deltaY * 0.0028;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Touch support for mobile/tablet
    this.domElement.addEventListener('touchstart', (e) => {
      if (!this.enabled || e.touches.length === 0) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    this.domElement.addEventListener('touchmove', (e) => {
      if (!this.enabled || !this.isDragging || e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
      const deltaY = e.touches[0].clientY - this.previousMousePosition.y;

      this.yaw -= deltaX * 0.0035;
      this.pitch -= deltaY * 0.0035;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  onKeyDown(e) {
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
      case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
      case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
      case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = true; break;
    }
  }

  onKeyUp(e) {
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
      case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
      case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
      case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
    }
  }

  setEnabled(val) {
    this.enabled = val;
    if (val) {
      // Sync initial orientation from camera
      this.position.copy(this.camera.position);
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = euler.y;
      this.pitch = euler.x;
    }
  }

  update(delta) {
    if (!this.enabled) return;

    const currentSpeed = this.isSprinting ? this.runSpeed : this.walkSpeed;
    const moveDir = new THREE.Vector3();

    if (this.moveForward) moveDir.z -= 1;
    if (this.moveBackward) moveDir.z += 1;
    if (this.moveLeft) moveDir.x -= 1;
    if (this.moveRight) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate by yaw
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      this.velocity.x = moveDir.x * currentSpeed;
      this.velocity.z = moveDir.z * currentSpeed;

      // Head-bobbing effect
      this.bobTimer += delta * (this.isSprinting ? 14 : 9);
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
      this.bobTimer = 0;
    }

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // Boundary limits (keep inside town)
    this.position.x = Math.max(-36, Math.min(32, this.position.x));
    this.position.z = Math.max(-34, Math.min(54, this.position.z));

    // Dynamic ground / platform height detection
    let targetGroundY = 0;
    // Check if on Station Platform (X: -37 to 16, Z: -9.8 to -13.3)
    if (this.position.x >= -37 && this.position.x <= 16 && this.position.z <= -9.8 && this.position.z >= -13.3) {
      targetGroundY = 0.85; // Platform height
    } else if (this.position.z < -25) {
      targetGroundY = 1.5; // Embankment height
    }

    const eyeHeight = 1.65;
    const bobOffset = Math.sin(this.bobTimer) * 0.04;
    this.position.y += (targetGroundY + eyeHeight + bobOffset - this.position.y) * 0.15;

    // Apply to camera
    this.camera.position.copy(this.position);

    // Apply rotation
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.camera.quaternion.copy(qy).multiply(qx);
  }
}
