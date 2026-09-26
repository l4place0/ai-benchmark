/**
 * Pure Line Room - Continuous Environment Dynamics Engine
 *
 * Implements real-time visual dynamics:
 * 1. Real-time analog clock: accurate Date.now() tracking, smooth escapement spring snap, audio tick-tock sync.
 * 2. Coffee cup steam: procedural rising, curling vector lines using animated bezier curves drifting upwards and dissipating.
 * 3. Turntable dynamics: continuous vinyl rotation with inertia, tonearm tracking, rising floating musical note vector particles.
 * 4. Ceiling fan: continuous angular rotation with smooth acceleration/deceleration inertia.
 * 5. Wind chime: natural ambient pendulum sway with gentle random breeze perturbations and interactive impulse chime strikes.
 * 6. Floating sunbeam/moonlight dust motes: drifting fine vector particles in the light beam with turbulent convection.
 */

import * as THREE from './libs/three.module.js';

export class DynamicsManager {
  /**
   * @param {THREE.Scene} scene - The Three.js scene.
   * @param {Object} [audioManager] - Optional AudioManager instance for procedural audio sync.
   * @param {Object} [options] - Optional custom mesh bindings or configuration.
   */
  constructor(scene, audioManager = null, options = {}) {
    this.scene = scene;
    this.audio = audioManager;
    this.options = options;

    this.isDay = options.isDay !== undefined ? options.isDay : true;
    this.dayNightRatio = this.isDay ? 1.0 : 0.0;

    // Subsystem containers
    this.clock = null;
    this.steam = null;
    this.turntable = null;
    this.fan = null;
    this.windChime = null;
    this.dustMotes = null;

    // Root dynamics group in scene
    this.group = new THREE.Group();
    this.group.name = 'Dynamics_Root_Group';
    if (this.scene) {
      this.scene.add(this.group);
    }

    // Initialize all continuous dynamics systems
    this._initClock();
    this._initCoffeeSteam();
    this._initTurntable();
    this._initCeilingFan();
    this._initWindChime();
    this._initDustMotes();
  }

  // =========================================================================
  // 1. Real-Time Clock System
  // =========================================================================
  _initClock() {
    let hourHand = this.options.clockHourHand;
    let minHand = this.options.clockMinuteHand;
    let secHand = this.options.clockSecondHand;
    let clockGroup = this.options.clockGroup;

    // Search scene if not explicitly provided
    if (!hourHand || !minHand || !secHand) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!hourHand && (name.includes('clock') || name.includes('hand')) && name.includes('hour')) {
          hourHand = child;
        }
        if (!minHand && (name.includes('clock') || name.includes('hand')) && (name.includes('min') || name.includes('minute'))) {
          minHand = child;
        }
        if (!secHand && (name.includes('clock') || name.includes('hand')) && (name.includes('sec') || name.includes('second'))) {
          secHand = child;
        }
        if (!clockGroup && name.includes('clock') && !name.includes('hand')) {
          clockGroup = child;
        }
      });
    }

    // If hands don't exist in scene, do not create duplicate ghost mesh
    this.clock = {
      group: clockGroup,
      hourHand,
      minHand,
      secHand,
      lastSecond: -1,
      tickStartTime: 0,
      axis: this.options.clockAxis || 'x', // hand rotation axis
    };
  }

  _updateClock(time) {
    if (!this.clock) return;

    const now = new Date();
    const ms = now.getMilliseconds();
    const sec = now.getSeconds();
    const min = now.getMinutes();
    const hour = now.getHours() % 12;

    // Detect second boundary tick
    if (sec !== this.clock.lastSecond) {
      this.clock.lastSecond = sec;
      this.clock.tickStartTime = time;
      if (this.audio) {
        this.audio.playClockTick();
      }
    }

    // Escapement mechanical spring snap bounce (120ms settlement)
    const tickDuration = 0.12;
    const elapsed = time - this.clock.tickStartTime;
    let smoothSec = sec;
    if (elapsed < tickDuration && elapsed >= 0) {
      const p = elapsed / tickDuration;
      // Damped harmonic bounce
      const bounce = Math.sin(p * Math.PI) * Math.exp(-p * 4.5) * 0.12;
      smoothSec = (sec === 0 ? 60 : sec) - 1.0 + Math.min(1.0, p) + bounce;
    }

    const secFraction = ms / 1000.0;
    const smoothMin = min + secFraction / 60.0;
    const smoothHour = hour + smoothMin / 60.0;

    const hourAngle = -(smoothHour / 12.0) * Math.PI * 2;
    const minAngle = -(smoothMin / 60.0) * Math.PI * 2;
    const secAngle = -(smoothSec / 60.0) * Math.PI * 2;

    const axis = this.clock.axis;
    if (this.clock.hourHand) this.clock.hourHand.rotation[axis] = hourAngle;
    if (this.clock.minHand) this.clock.minHand.rotation[axis] = minAngle;
    if (this.clock.secHand) this.clock.secHand.rotation[axis] = secAngle;
  }

  // =========================================================================
  // 2. Coffee Cup Curling Vector Steam Lines
  // =========================================================================
  _initCoffeeSteam() {
    const group = new THREE.Group();
    group.name = 'Coffee_Steam_System';

    if (this.options.coffeeCup) {
      this.options.coffeeCup.add(group);
      group.position.set(0, 0.088, 0);
    } else {
      group.position.set(-0.42, 0.84, -1.95);
      this.group.add(group);
    }

    const tendrilCount = 5;
    const pointsPerTendril = 32;
    const tendrils = [];

    for (let t = 0; t < tendrilCount; t++) {
      const points = [];
      for (let i = 0; i < pointsPerTendril; i++) {
        points.push(new THREE.Vector3(0, 0, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);

      const mat = new THREE.LineBasicMaterial({
        color: this.isDay ? 0xf0ede6 : 0xaecce8,
        transparent: true,
        opacity: 0.55,
        blending: THREE.NormalBlending,
        linewidth: 1.5,
      });

      const line = new THREE.Line(geo, mat);
      group.add(line);

      tendrils.push({
        line,
        geo,
        mat,
        phase: (t / tendrilCount) * Math.PI * 2,
        seedX: Math.random() * 10,
        seedZ: Math.random() * 10,
        speed: 0.28 + Math.random() * 0.12,
        maxHeight: 0.35 + Math.random() * 0.1,
        radiusOffset: 0.015 + Math.random() * 0.02,
      });
    }

    this.steam = {
      group,
      tendrils,
      pointsPerTendril,
    };
  }

  _updateCoffeeSteam(delta, time) {
    if (!this.steam) return;

    const { tendrils, pointsPerTendril } = this.steam;

    for (let t = 0; t < tendrils.length; t++) {
      const item = tendrils[t];
      const posAttr = item.geo.attributes.position;
      const positions = posAttr.array;

      // Cycle phase for upward continuous drift
      const tendrilCycleTime = (time * item.speed + item.phase) % 1.0;
      const currentHeight = item.maxHeight * (0.8 + 0.2 * Math.sin(time * 0.8 + item.phase));

      // Tendril fade envelope: transparent at rim, peaks at 0.35, dissolves at top
      const baseOpacity = this.isDay ? 0.45 : 0.35;
      item.mat.opacity = baseOpacity * (0.85 + 0.15 * Math.sin(time * 2.0 + item.phase));

      for (let i = 0; i < pointsPerTendril; i++) {
        const u = i / (pointsPerTendril - 1); // 0 (cup rim) to 1 (evaporated top)
        const y = u * currentHeight;

        // Curling vector equations using harmonic trigonometric displacement
        const curlSpeed = time * 2.2;
        const wave1 = Math.sin(u * 5.0 - curlSpeed + item.seedX);
        const wave2 = Math.cos(u * 4.2 - curlSpeed * 0.8 + item.seedZ);
        const wave3 = Math.sin(u * 8.0 + curlSpeed * 1.2);

        // Broaden curls as steam ascends
        const spread = u * 0.08 + Math.pow(u, 2) * 0.06;
        const x = (wave1 * 0.025 + wave3 * 0.012) * (1.0 + u * 2.5) + (u * 0.02);
        const z = (wave2 * 0.022) * (1.0 + u * 2.0);

        const idx = i * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }

      posAttr.needsUpdate = true;
    }
  }

  // =========================================================================
  // 3. Turntable Dynamics (Record rotation, tonearm tracking, floating musical note lines)
  // =========================================================================
  _initTurntable() {
    let platter = this.options.turntablePlatter;
    let tonearm = this.options.turntableArm;
    let turntableGroup = this.options.turntableGroup;

    // Search scene if not passed
    if (!platter || !tonearm) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!platter && (name.includes('platter') || name.includes('vinyl') || name.includes('record'))) {
          platter = child;
        }
        if (!tonearm && (name.includes('arm') || name.includes('tonearm'))) {
          tonearm = child;
        }
        if (!turntableGroup && (name.includes('turntable') || name.includes('player'))) {
          turntableGroup = child;
        }
      });
    }

    // Do not create duplicate procedural line turntable

    // Floating musical note vector particles
    const notesGroup = new THREE.Group();
    notesGroup.name = 'Turntable_Floating_Notes';
    this.group.add(notesGroup);

    const notePool = [];
    const poolSize = 14;
    for (let i = 0; i < poolSize; i++) {
      const noteMesh = this._createVectorMusicalNote(i % 3);
      noteMesh.visible = false;
      notesGroup.add(noteMesh);
      notePool.push({
        mesh: noteMesh,
        active: false,
        age: 0,
        lifespan: 2.8,
        velocity: new THREE.Vector3(),
        rotSpeed: 0,
        scale: 1,
      });
    }

    this.turntable = {
      group: turntableGroup,
      platter,
      tonearm,
      notesGroup,
      notePool,
      lastSpawnTime: 0,
      currentSpeed: 0.0,
      targetSpeed: 0.0,
      maxSpeed: (33.333 / 60) * Math.PI * 2, // 33 1/3 RPM in rad/s ~ 3.4906
      armAngle: 0.0,
      targetArmAngle: 0.0,
      restArmAngle: 0.0,
      playArmAngle: 0.38, // Radians tracking over vinyl grooves
    };

    // Auto-sync with audio turntable state if already playing
    if (this.audio && this.audio.isTurntablePlaying) {
      this.startTurntable();
    }
  }

  _createVectorMusicalNote(type = 0) {
    const group = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({
      color: this.isDay ? 0xd4a359 : 0x76b4e8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    const scale = 0.05;

    if (type === 0) {
      // Eighth Note ♪ (Head + Stem + Flag)
      const headPts = [];
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const th = (i / segs) * Math.PI * 2;
        headPts.push(new THREE.Vector3(Math.cos(th) * 0.35, Math.sin(th) * 0.25, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(headPts), lineMat));

      const stemPts = [
        new THREE.Vector3(0.35, 0, 0),
        new THREE.Vector3(0.35, 1.2, 0),
        new THREE.Vector3(0.65, 0.95, 0), // Flag
        new THREE.Vector3(0.35, 0.70, 0),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stemPts), lineMat));
    } else if (type === 1) {
      // Beamed Double Eighth Note ♫
      // Note Head 1
      const h1 = [];
      for (let i = 0; i <= 12; i++) {
        const th = (i / 12) * Math.PI * 2;
        h1.push(new THREE.Vector3(-0.45 + Math.cos(th) * 0.28, Math.sin(th) * 0.22, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(h1), lineMat));

      // Note Head 2
      const h2 = [];
      for (let i = 0; i <= 12; i++) {
        const th = (i / 12) * Math.PI * 2;
        h2.push(new THREE.Vector3(0.45 + Math.cos(th) * 0.28, 0.15 + Math.sin(th) * 0.22, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(h2), lineMat));

      // Stems and Beam Bar
      const framePts = [
        new THREE.Vector3(-0.20, 0, 0),
        new THREE.Vector3(-0.20, 1.15, 0),
        new THREE.Vector3(0.70, 1.30, 0),
        new THREE.Vector3(0.70, 0.15, 0),
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(framePts), lineMat));
    } else {
      // Quarter Note ♩
      const headPts = [];
      for (let i = 0; i <= 14; i++) {
        const th = (i / 14) * Math.PI * 2;
        headPts.push(new THREE.Vector3(Math.cos(th) * 0.35, Math.sin(th) * 0.25, 0));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(headPts), lineMat));

      const stemPts = [new THREE.Vector3(0.35, 0, 0), new THREE.Vector3(0.35, 1.15, 0)];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(stemPts), lineMat));
    }

    group.scale.set(scale, scale, scale);
    return group;
  }

  startTurntable() {
    if (!this.turntable) return;
    this.turntable.targetSpeed = this.turntable.maxSpeed;
    this.turntable.targetArmAngle = this.turntable.playArmAngle;
    if (this.audio && !this.audio.isTurntablePlaying) {
      this.audio.startTurntable();
    }
  }

  stopTurntable() {
    if (!this.turntable) return;
    this.turntable.targetSpeed = 0.0;
    this.turntable.targetArmAngle = this.turntable.restArmAngle;
    if (this.audio && this.audio.isTurntablePlaying) {
      this.audio.stopTurntable();
    }
  }

  toggleTurntable() {
    if (!this.turntable) return false;
    if (this.turntable.targetSpeed > 0) {
      this.stopTurntable();
      return false;
    } else {
      this.startTurntable();
      return true;
    }
  }

  _updateTurntable(delta, time) {
    if (!this.turntable) return;

    // Check external audio sync
    if (this.audio) {
      if (this.audio.isTurntablePlaying && this.turntable.targetSpeed === 0) {
        this.turntable.targetSpeed = this.turntable.maxSpeed;
        this.turntable.targetArmAngle = this.turntable.playArmAngle;
      } else if (!this.audio.isTurntablePlaying && this.turntable.targetSpeed > 0) {
        this.turntable.targetSpeed = 0.0;
        this.turntable.targetArmAngle = this.turntable.restArmAngle;
      }
    }

    // Platter rotation with physical inertia
    const accelRate = this.turntable.targetSpeed > this.turntable.currentSpeed ? 2.2 : 1.4;
    this.turntable.currentSpeed += (this.turntable.targetSpeed - this.turntable.currentSpeed) * (1.0 - Math.exp(-delta * accelRate));

    if (this.turntable.platter) {
      this.turntable.platter.rotation.y += this.turntable.currentSpeed * delta;
    }

    // Tonearm tracking with spring damping
    this.turntable.armAngle += (this.turntable.targetArmAngle - this.turntable.armAngle) * (1.0 - Math.exp(-delta * 3.0));
    if (this.turntable.tonearm) {
      this.turntable.tonearm.rotation.y = this.turntable.armAngle;
    }

    // Floating musical note particle system
    const isSpinning = this.turntable.currentSpeed > this.turntable.maxSpeed * 0.6;
    if (isSpinning && time - this.turntable.lastSpawnTime > 0.45) {
      this._spawnMusicalNote(time);
      this.turntable.lastSpawnTime = time;
    }

    this._updateMusicalNotes(delta, time);
  }

  _spawnMusicalNote(time) {
    const pool = this.turntable.notePool;
    const item = pool.find((p) => !p.active);
    if (!item) return;

    item.active = true;
    item.age = 0;
    item.lifespan = 2.4 + Math.random() * 0.8;
    item.rotSpeed = (Math.random() - 0.5) * 1.5;

    // Stylus world position
    const spawnPos = new THREE.Vector3();
    if (this.turntable.tonearm) {
      this.turntable.tonearm.getWorldPosition(spawnPos);
      spawnPos.x += (Math.random() - 0.5) * 0.08;
      spawnPos.y += 0.04;
      spawnPos.z += (Math.random() - 0.5) * 0.08;
    } else {
      spawnPos.set(-0.85, 0.85, 0.15);
    }

    item.mesh.position.copy(spawnPos);
    item.mesh.visible = true;

    // Rising spiral velocity
    item.velocity.set(
      (Math.random() - 0.5) * 0.05,
      0.18 + Math.random() * 0.12,
      (Math.random() - 0.5) * 0.05
    );
  }

  _updateMusicalNotes(delta, time) {
    const pool = this.turntable.notePool;
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      if (!item.active) continue;

      item.age += delta;
      if (item.age >= item.lifespan) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }

      const p = item.age / item.lifespan;

      // Spiral waft
      item.mesh.position.x += item.velocity.x * delta + Math.sin(time * 3.0 + i) * 0.001;
      item.mesh.position.y += item.velocity.y * delta;
      item.mesh.position.z += item.velocity.z * delta + Math.cos(time * 2.5 + i) * 0.001;
      item.mesh.rotation.z += item.rotSpeed * delta;

      // Opacity fade in and fade out
      let alpha = 1.0;
      if (p < 0.2) alpha = p / 0.2;
      else if (p > 0.6) alpha = 1.0 - (p - 0.6) / 0.4;

      item.mesh.traverse((child) => {
        if (child.material) {
          child.material.opacity = alpha * 0.85;
        }
      });
    }
  }

  // =========================================================================
  // 4. Ceiling Fan Dynamics (Inertial continuous rotation & audio sync)
  // =========================================================================
  _initCeilingFan() {
    let fanBlades = this.options.fanBlades;
    let fanGroup = this.options.fanGroup;

    if (!fanBlades) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (!fanBlades && (name.includes('blade') || name.includes('fan_rotor') || name.includes('propeller'))) {
          fanBlades = child;
        }
        if (!fanGroup && name.includes('fan') && !name.includes('blade')) {
          fanGroup = child;
        }
      });
    }
    // Do not create duplicate procedural line fan

    this.fan = {
      group: fanGroup,
      blades: fanBlades,
      isRunning: true,
      currentSpeed: 0.0,
      targetSpeed: 4.8, // Rad/s (~46 RPM aesthetic smooth rotation)
      maxSpeed: 4.8,
    };

    if (this.audio) {
      this.audio.startFan(0.75);
    }
  }

  _createProceduralLineFan() {
    const group = new THREE.Group();
    group.name = 'Procedural_Line_Fan';
    group.position.set(0, 3.2, 0); // Ceiling center position

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    // Downrod & Ceiling Mount
    const rodPts = [new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0, 0, 0)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rodPts), lineMat));

    // Motor Hub Circle
    const hubPts = [];
    for (let i = 0; i <= 32; i++) {
      const th = (i / 32) * Math.PI * 2;
      hubPts.push(new THREE.Vector3(Math.cos(th) * 0.12, 0, Math.sin(th) * 0.12));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hubPts), lineMat));

    // Rotating Blades Group
    const blades = new THREE.Group();
    blades.name = 'Fan_Blades_Rotating';

    const bladeCount = 4;
    const bladeLen = 0.85;
    const bladeWidth = 0.14;

    for (let b = 0; b < bladeCount; b++) {
      const angle = (b / bladeCount) * Math.PI * 2;
      const bladeArm = new THREE.Group();
      bladeArm.rotation.y = angle;

      const pts = [
        new THREE.Vector3(0.12, 0, -bladeWidth * 0.3),
        new THREE.Vector3(0.12 + bladeLen, 0, -bladeWidth * 0.5),
        new THREE.Vector3(0.12 + bladeLen, 0, bladeWidth * 0.5),
        new THREE.Vector3(0.12, 0, bladeWidth * 0.3),
        new THREE.Vector3(0.12, 0, -bladeWidth * 0.3),
      ];
      bladeArm.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      blades.add(bladeArm);
    }

    group.add(blades);
    return { group, blades };
  }

  setFanSpeed(rpmRatio) {
    if (!this.fan) return;
    const ratio = Math.max(0.0, Math.min(1.0, rpmRatio));
    this.fan.targetSpeed = this.fan.maxSpeed * ratio;
    this.fan.isRunning = ratio > 0.01;
    if (this.audio) {
      if (this.fan.isRunning) {
        if (!this.audio.isFanRunning) this.audio.startFan(ratio);
        else this.audio.setFanSpeed(ratio);
      } else {
        this.audio.stopFan();
      }
    }
  }

  toggleFan() {
    if (!this.fan) return false;
    if (this.fan.isRunning) {
      this.setFanSpeed(0.0);
      return false;
    } else {
      this.setFanSpeed(1.0);
      return true;
    }
  }

  _updateCeilingFan(delta) {
    if (!this.fan || !this.fan.blades) return;

    // Acceleration / Deceleration Inertia
    const inertia = this.fan.isRunning ? 1.4 : 0.65;
    this.fan.currentSpeed += (this.fan.targetSpeed - this.fan.currentSpeed) * (1.0 - Math.exp(-delta * inertia));

    // Continuous blade rotation
    this.fan.blades.rotation.y += this.fan.currentSpeed * delta;

    // Audio pitch/volume sync
    if (this.audio && this.audio.isFanRunning) {
      this.audio.setFanSpeed(this.fan.currentSpeed / this.fan.maxSpeed);
    }
  }

  // =========================================================================
  // 5. Wind Chime Dynamics (Ambient pendulum sway & click impulse chime strikes)
  // =========================================================================
  _initWindChime() {
    let chimeGroup = this.options.windChime;

    if (!chimeGroup) {
      this.scene.traverse((child) => {
        const name = child.name ? child.name.toLowerCase() : '';
        if (name.includes('chime')) {
          chimeGroup = child;
        }
      });
    }
    // Do not create duplicate procedural line wind chime

    this.windChime = {
      group: chimeGroup,
      pendulum: chimeGroup?.getObjectByName ? chimeGroup.getObjectByName('Chime_Pendulum') : null,
      tubes: chimeGroup?.getObjectByName ? chimeGroup.getObjectByName('Chime_Tubes') : null,
      // Pendulum 2D physics state
      thetaX: 0.0,
      thetaZ: 0.0,
      velX: 0.0,
      velZ: 0.0,
      targetImpulse: 0.0,
      strikeCooldown: 0.0,
      lastTubeIndex: -1,
    };
  }

  /**
   * Apply an interactive impulse to the wind chime (e.g. on mouse click / touch).
   */
  triggerWindChime(strength = 1.0) {
    if (!this.windChime) return;
    const angle = Math.random() * Math.PI * 2;
    const force = 3.5 * strength;
    this.windChime.velX += Math.cos(angle) * force;
    this.windChime.velZ += Math.sin(angle) * force;

    if (this.audio) {
      this.audio.playWindChime({ count: 3, intensity: Math.min(1.0, strength) });
    }
  }

  _updateWindChime(delta, time) {
    if (!this.windChime) return;

    const wc = this.windChime;

    // Ambient gentle breeze force + multi-frequency gust modulation
    const ambientBreeze = this.isDay ? 0.28 : 0.15;
    const gustX = Math.sin(time * 0.7) * Math.cos(time * 0.23 + 1.2) * 0.45;
    const gustZ = Math.cos(time * 0.55) * Math.sin(time * 0.31 + 0.5) * 0.45;

    const forceX = (ambientBreeze * 0.6 + gustX) * 0.8;
    const forceZ = (ambientBreeze * 0.4 + gustZ) * 0.8;

    // Damped harmonic pendulum simulation
    const k = 14.0; // Restoring gravity spring constant
    const damping = 1.8; // Air resistance damping

    const accX = -k * wc.thetaX - damping * wc.velX + forceX;
    const accZ = -k * wc.thetaZ - damping * wc.velZ + forceZ;

    wc.velX += accX * delta;
    wc.velZ += accZ * delta;
    wc.thetaX += wc.velX * delta;
    wc.thetaZ += wc.velZ * delta;

    // Apply rotation to pendulum
    if (wc.pendulum) {
      wc.pendulum.rotation.z = wc.thetaX;
      wc.pendulum.rotation.x = wc.thetaZ;
    }

    // Subtle sympathetic sway on tubes
    if (wc.tubes) {
      wc.tubes.rotation.z = wc.thetaX * 0.25;
      wc.tubes.rotation.x = wc.thetaZ * 0.25;
    }

    // Natural strike detection based on clapper deflection amplitude
    wc.strikeCooldown -= delta;
    const deflection = Math.sqrt(wc.thetaX * wc.thetaX + wc.thetaZ * wc.thetaZ);
    if (deflection > 0.14 && wc.strikeCooldown <= 0) {
      // Determine which tube is closest to the deflection vector
      const strikeAngle = Math.atan2(wc.thetaZ, wc.thetaX);
      const tubeIdx = Math.floor(((strikeAngle + Math.PI) / (Math.PI * 2)) * 5) % 5;

      if (tubeIdx !== wc.lastTubeIndex || deflection > 0.25) {
        wc.lastTubeIndex = tubeIdx;
        wc.strikeCooldown = 0.35 + Math.random() * 0.25;
        if (this.audio) {
          const intensity = Math.min(1.0, deflection * 3.5);
          this.audio.playWindChime({ tubeIndex: tubeIdx, intensity, count: 1 });
        }
      }
    }
  }

  // =========================================================================
  // 6. Floating Sunbeam / Moonlight Dust Motes System
  // =========================================================================
  _initDustMotes() {
    const moteCount = 280;
    const group = new THREE.Group();
    group.name = 'Sunbeam_Dust_Motes';

    const positions = new Float32Array(moteCount * 3);
    const seeds = new Float32Array(moteCount * 3);
    const motesData = [];

    // Light beam bounding prism (from window into room)
    const bounds = {
      minX: -1.2, maxX: 1.8,
      minY: 0.4,  maxY: 3.0,
      minZ: -2.0, maxZ: 1.2,
    };

    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      seeds[idx] = Math.random() * 100;
      seeds[idx + 1] = Math.random() * 100;
      seeds[idx + 2] = Math.random() * 100;

      motesData.push({
        baseSpeedY: 0.015 + Math.random() * 0.025,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.5 + Math.random() * 2.5,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Circular vector particle texture generated via canvas (ZERO external asset dependencies)
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.038,
      map: texture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: this.isDay ? 0xffeaaf : 0xaad2f5,
    });

    const points = new THREE.Points(geo, mat);
    group.add(points);
    this.group.add(group);

    this.dustMotes = {
      group,
      points,
      geo,
      mat,
      motesData,
      moteCount,
      bounds,
    };
  }

  _updateDustMotes(delta, time) {
    if (!this.dustMotes) return;

    const { geo, motesData, moteCount, bounds } = this.dustMotes;
    const posAttr = geo.attributes.position;
    const positions = posAttr.array;

    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      let x = positions[idx];
      let y = positions[idx + 1];
      let z = positions[idx + 2];

      const data = motesData[i];

      // Atmospheric thermal drift + curl noise convection field
      const curlX = Math.sin(y * 2.8 + time * 0.45 + i) * 0.016;
      const curlZ = Math.cos(y * 2.4 + time * 0.38 + i * 1.3) * 0.016;

      x += curlX * delta;
      y += data.baseSpeedY * delta;
      z += curlZ * delta;

      // Wrap boundaries smoothly within sunbeam volume
      if (y > bounds.maxY) y = bounds.minY;
      if (x < bounds.minX) x = bounds.maxX;
      if (x > bounds.maxX) x = bounds.minX;
      if (z < bounds.minZ) z = bounds.maxZ;
      if (z > bounds.maxZ) z = bounds.minZ;

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
    }

    posAttr.needsUpdate = true;
  }

  // =========================================================================
  // Day / Night Atmosphere Control
  // =========================================================================
  setDayNight(mode) {
    this.isDay = mode === 'day' || mode === true || mode === 1;
    this.dayNightRatio = this.isDay ? 1.0 : 0.0;

    // Update dust motes color
    if (this.dustMotes && this.dustMotes.mat) {
      const targetColor = this.isDay ? new THREE.Color(0xffeaaf) : new THREE.Color(0xaad2f5);
      this.dustMotes.mat.color.copy(targetColor);
    }

    // Update coffee steam color
    if (this.steam && this.steam.tendrils) {
      const steamColor = this.isDay ? new THREE.Color(0xf0ede6) : new THREE.Color(0xaecce8);
      for (const t of this.steam.tendrils) {
        t.mat.color.copy(steamColor);
      }
    }

    // Forward to audio engine
    if (this.audio && typeof this.audio.setDayNightMode === 'function') {
      this.audio.setDayNightMode(this.isDay ? 'day' : 'night');
    }
  }

  // =========================================================================
  // Main Per-Frame Update Loop
  // =========================================================================
  update(delta, time) {
    const dt = Math.min(delta || 0.016, 0.1);
    const t = time !== undefined ? time : performance.now() / 1000.0;

    this._updateClock(t);
    this._updateCoffeeSteam(dt, t);
    this._updateTurntable(dt, t);
    this._updateCeilingFan(dt);
    this._updateWindChime(dt, t);
    this._updateDustMotes(dt, t);
  }

  // =========================================================================
  // Cleanup / Dispose
  // =========================================================================
  dispose() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }

    // Dispose geometries & materials
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
