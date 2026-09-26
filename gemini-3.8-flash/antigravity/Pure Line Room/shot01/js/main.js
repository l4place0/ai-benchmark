// Pure Line Room - Main Application Bootstrap & Lifecycle
import * as THREE from './libs/three.module.js';
import { CameraController } from './cameraController.js';
import { audioManager } from './audio.js';
import { DynamicsManager } from './dynamics.js';
import { buildRoom, ROOM_CATALOG } from './roomGeometry.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.isNight = false;
    this.clock = new THREE.Clock();

    // 1. Setup Three.js WebGL Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f7f9);

    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.sortObjects = true;
    this.container.appendChild(this.renderer.domElement);

    // 2. Setup Camera Controller
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // 3. Setup Procedural Vector Room Geometry
    this.room = buildRoom(this.scene, {
      onToggleTheme: (night) => this.setTheme(night)
    });

    // 4. Setup Continuous Environment Dynamics (Particles, Steam, Clock Hand Sync, Sway)
    this.dynamics = new DynamicsManager(this.scene, audioManager, {
      isDay: !this.isNight,
      clockHourHand: this.room.items.wallClock?.hourHandPivot,
      clockMinuteHand: this.room.items.wallClock?.minHandPivot,
      clockSecondHand: this.room.items.wallClock?.secHandPivot,
      clockAxis: 'x',
      coffeeCup: this.room.items.cup?.group,
      turntablePlatter: this.room.items.recordPlayer?.turntablePlatter,
      turntableArm: this.room.items.recordPlayer?.armPivotHead,
      fanBlades: this.room.items.ceilingFan?.fanRotor,
      windChime: this.room.items.windChime?.chimePivot
    });

    // 5. Setup Raycasting & Interaction System
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);
    this.hoveredItem = null;
    this.highlightBox = this.createHighlightIndicator();

    // 6. Setup UI Elements & Listeners
    this.initUI();
    this.initInteractionEvents();
    this.populateCatalogModal();

    // 7. Window Resize
    window.addEventListener('resize', () => this.onResize());

    // 8. Start Ambient Audio on first user interaction
    audioManager.startAmbient();

    // 9. Begin Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  createHighlightIndicator() {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geom);
    const mat = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.0,
      depthTest: false
    });
    const lines = new THREE.LineSegments(edges, mat);
    lines.renderOrder = 999;
    lines.visible = false;
    this.scene.add(lines);
    return lines;
  }

  initInteractionEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.checkHover();
    });

    dom.addEventListener('pointerleave', () => {
      this.clearHover();
    });

    dom.addEventListener('click', (e) => {
      // Ignore click if user was dragging camera
      if (this.cameraController.hasDragged()) return;
      this.handleClick();
    });
  }

  checkHover() {
    if (!this.room || !this.room.interactiveTargets) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.room.interactiveTargets, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const data = hitObj.userData;
      if (data && data.interactive) {
        if (this.hoveredItem !== data) {
          this.setHover(data, hitObj);
        }
        return;
      }
    }

    this.clearHover();
  }

  setHover(item, hitMesh) {
    this.hoveredItem = item;
    document.body.classList.add('pointer-active');

    // Update Minimalist Architectural Inspector
    const inspector = document.getElementById('inspector');
    const inspId = document.getElementById('insp-id');
    const inspName = document.getElementById('insp-name');
    const inspHint = document.getElementById('insp-hint');
    const inspState = document.getElementById('insp-state');

    if (inspector) {
      inspId.textContent = `[ ${item.id} ] ${item.code || 'ITEM'}`;
      inspName.textContent = item.name || '交互物件';
      inspHint.textContent = item.hint || '点击交互';
      inspState.textContent = 'INTERACTIVE';
      inspector.classList.add('active');
    }

    // Position subtle 3D highlight bounding box
    if (this.highlightBox && hitMesh) {
      hitMesh.geometry.computeBoundingBox();
      const bbox = hitMesh.geometry.boundingBox;
      if (bbox) {
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        this.highlightBox.scale.set(size.x * 1.05 + 0.02, size.y * 1.05 + 0.02, size.z * 1.05 + 0.02);
        const worldPos = hitMesh.localToWorld(center.clone());
        this.highlightBox.position.copy(worldPos);
        this.highlightBox.quaternion.copy(hitMesh.getWorldQuaternion(new THREE.Quaternion()));
        this.highlightBox.material.opacity = 0.85;
        this.highlightBox.material.color.setHex(this.isNight ? 0x38bdf8 : 0x2563eb);
        this.highlightBox.visible = true;
      }
    }
  }

  clearHover() {
    if (this.hoveredItem) {
      this.hoveredItem = null;
      document.body.classList.remove('pointer-active');
    }
    const inspector = document.getElementById('inspector');
    if (inspector) {
      inspector.classList.remove('active');
    }
    if (this.highlightBox) {
      this.highlightBox.visible = false;
    }
  }

  handleClick() {
    if (!this.hoveredItem) return;

    const item = this.hoveredItem;

    // Trigger internal room animation hook
    if (typeof item.onClick === 'function') {
      item.onClick();
    }

    // Play synthesized procedural audio effect
    this.playItemAudio(item);

    // Update inspector
    const inspState = document.getElementById('insp-state');
    if (inspState) {
      inspState.textContent = 'ACTIVATED';
      setTimeout(() => {
        if (this.hoveredItem === item) inspState.textContent = 'INTERACTIVE';
      }, 700);
    }
  }

  playItemAudio(item) {
    const code = item.code;
    switch (code) {
      case 'DOOR':
        if (this.room.items.door.doorState.isOpen) {
          audioManager.playDoorCreak(1.0);
        } else {
          audioManager.playDoorLatch();
        }
        break;
      case 'LIGHT_SWITCH':
        audioManager.playSwitchSnap(!this.isNight);
        break;
      case 'DESK_LAMP':
        audioManager.playLampClick();
        break;
      case 'CABINET':
        if (this.room.items.cabinet.drawerState.isOpen) {
          audioManager.playDrawerSlide(0.65);
        } else {
          audioManager.playDrawerBump();
        }
        break;
      case 'RECORD_PLAYER':
        if (this.room.items.recordPlayer.turntableState.isPlaying) {
          audioManager.startTurntable(0.8);
        } else {
          audioManager.stopTurntable();
        }
        break;
      case 'WIND_CHIME':
        audioManager.playWindChime({ count: 2, intensity: 0.9 });
        break;
      case 'CEILING_FAN':
        audioManager.playLampClick();
        const fanMode = this.room.items.ceilingFan.fanState.speedMode;
        audioManager.setFanSpeed(fanMode);
        break;
      case 'CUP':
        audioManager.playDrawerBump(0.4);
        break;
      case 'CHAIR':
        audioManager.playDrawerSlide(0.5);
        break;
      case 'BOOKSHELF':
        audioManager.playDrawerSlide(0.4);
        break;
      case 'SOFA':
      case 'PILLOWS':
        audioManager.playDrawerBump(0.5);
        break;
      case 'BLINDS':
        audioManager.playSwitchSnap(true, 0.4);
        break;
      case 'WALL_ART':
      case 'GLOBE':
      case 'WINDOW':
      case 'COFFEE_TABLE':
      case 'DESK':
      case 'RUG':
        audioManager.playSwitchSnap(false, 0.35);
        break;
      case 'WALL_CLOCK':
        audioManager.playClockTick();
        break;
      default:
        audioManager.playSwitchSnap(true, 0.4);
        break;
    }
  }

  setTheme(isNight) {
    this.isNight = !!isNight;
    document.body.classList.toggle('night-mode', this.isNight);

    // Update Room Geometry materials
    this.room.setTheme(this.isNight);

    // Update Dynamics (particles color, audio ambience)
    this.dynamics.setDayNight(!this.isNight);

    // Update UI Labels
    const modeLabel = document.getElementById('env-mode-label');
    const themeBtnText = document.getElementById('theme-btn-text');
    if (modeLabel) {
      modeLabel.textContent = this.isNight ? '夜间模式 / NIGHT' : '昼间模式 / DAY';
    }
    if (themeBtnText) {
      themeBtnText.textContent = this.isNight ? '夜间' : '昼间';
    }
  }

  toggleTheme() {
    this.setTheme(!this.isNight);
    audioManager.playSwitchSnap(this.isNight);
  }

  initUI() {
    // 1. Clock Display Sync
    this.updateClockDisplay();
    setInterval(() => this.updateClockDisplay(), 1000);

    // 2. Camera Preset Buttons
    const btnOverview = document.getElementById('btn-cam-overview');
    const btnDesk = document.getElementById('btn-cam-desk');
    const btnLounge = document.getElementById('btn-cam-lounge');

    const setPresetActive = (activeBtn) => {
      [btnOverview, btnDesk, btnLounge].forEach((b) => b && b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
    };

    if (btnOverview) {
      btnOverview.addEventListener('click', () => {
        setPresetActive(btnOverview);
        this.cameraController.moveToPreset(0.75, Math.PI / 4.2, 8.5, new THREE.Vector3(0, 1.6, 0), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnDesk) {
      btnDesk.addEventListener('click', () => {
        setPresetActive(btnDesk);
        this.cameraController.moveToPreset(0.35, Math.PI / 3.4, 3.8, new THREE.Vector3(-0.7, 1.0, -2.15), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnLounge) {
      btnLounge.addEventListener('click', () => {
        setPresetActive(btnLounge);
        this.cameraController.moveToPreset(0.85, Math.PI / 3.4, 4.2, new THREE.Vector3(0.1, 0.7, 0.8), 1.2);
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    // 3. Theme Toggle Button
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => this.toggleTheme());
    }

    // 4. Audio Mute Toggle Button
    const btnAudio = document.getElementById('btn-toggle-audio');
    const audioBtnText = document.getElementById('audio-btn-text');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isMuted = audioManager.toggleMute();
        btnAudio.classList.toggle('active', !isMuted);
        if (audioBtnText) {
          audioBtnText.textContent = isMuted ? '声音静音' : '声音开启';
        }
      });
    }

    // 5. Audio Initial Prompt Banner
    const audioPrompt = document.getElementById('audio-prompt');
    if (audioPrompt) {
      const dismissPrompt = () => {
        audioPrompt.classList.add('dismissed');
        window.removeEventListener('pointerdown', dismissPrompt);
      };
      audioPrompt.addEventListener('click', dismissPrompt);
      window.addEventListener('pointerdown', dismissPrompt, { once: true });
    }

    // 6. Interactive Guide Modal
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const modal = document.getElementById('guide-modal');

    if (btnOpenGuide && modal) {
      btnOpenGuide.addEventListener('click', () => {
        modal.classList.add('open');
        audioManager.playSwitchSnap(true, 0.3);
      });
    }

    if (btnCloseGuide && modal) {
      btnCloseGuide.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  }

  updateClockDisplay() {
    const clockText = document.getElementById('clock-text');
    if (clockText) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      clockText.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
  }

  populateCatalogModal() {
    const listContainer = document.getElementById('guide-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    ROOM_CATALOG.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'guide-item';
      card.innerHTML = `
        <div class="guide-name">
          <span class="guide-num">[ ${item.id} ]</span>
          <span>${item.name}</span>
        </div>
        <div class="guide-desc">${item.hint}</div>
      `;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        document.getElementById('guide-modal').classList.remove('open');
        this.focusItemByCode(item.code);
      });
      listContainer.appendChild(card);
    });
  }

  focusItemByCode(code) {
    audioManager.playSwitchSnap(true, 0.3);
    switch (code) {
      case 'DOOR':
      case 'LIGHT_SWITCH':
        this.cameraController.moveToPreset(1.85, Math.PI / 3.4, 4.2, new THREE.Vector3(-3.2, 1.4, 0.6), 1.2);
        break;
      case 'DESK':
      case 'DESK_LAMP':
      case 'CUP':
      case 'CHAIR':
        this.cameraController.moveToPreset(0.35, Math.PI / 3.4, 3.4, new THREE.Vector3(-0.7, 0.95, -2.15), 1.2);
        break;
      case 'WINDOW':
      case 'BLINDS':
      case 'WIND_CHIME':
        this.cameraController.moveToPreset(0.05, Math.PI / 3.2, 3.8, new THREE.Vector3(-0.7, 2.0, -3.2), 1.2);
        break;
      case 'SOFA':
      case 'PILLOWS':
      case 'COFFEE_TABLE':
      case 'RUG':
        this.cameraController.moveToPreset(0.85, Math.PI / 3.4, 4.0, new THREE.Vector3(0.1, 0.7, 0.8), 1.2);
        break;
      case 'BOOKSHELF':
        this.cameraController.moveToPreset(0.35, Math.PI / 3.5, 4.2, new THREE.Vector3(2.45, 1.5, -3.2), 1.2);
        break;
      case 'WALL_ART':
        this.cameraController.moveToPreset(0.25, Math.PI / 3.4, 3.6, new THREE.Vector3(1.11, 2.15, -3.37), 1.2);
        break;
      case 'CABINET':
      case 'RECORD_PLAYER':
      case 'GLOBE':
      case 'WALL_CLOCK':
        this.cameraController.moveToPreset(1.85, Math.PI / 3.5, 3.8, new THREE.Vector3(-3.0, 1.2, -0.45), 1.2);
        break;
      case 'CEILING_FAN':
        this.cameraController.moveToPreset(0.65, Math.PI / 2.6, 5.2, new THREE.Vector3(0, 2.8, 0), 1.2);
        break;
      default:
        this.cameraController.moveToPreset(0.75, Math.PI / 4.2, 8.5, new THREE.Vector3(0, 1.6, 0), 1.2);
        break;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    // 1. Update Smooth Camera Inertia Damping
    this.cameraController.update(delta);

    // 2. Update Room Item Animations
    if (this.room && this.room.update) {
      this.room.update(delta, elapsed);
    }

    // 3. Update Continuous Dynamics Physics (Particles, Real-Time Clock Hands, Vinyl, Fan, Chime)
    if (this.dynamics && this.dynamics.update) {
      this.dynamics.update(delta, elapsed);
    }

    // 4. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
