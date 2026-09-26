// Interaction Manager: Raycasting, Hover Highlights, State Machine & Non-linear Easing Animations
import * as THREE from './libs/three.module.js';

export class InteractionManager {
  constructor(scene, camera, domElement, roomData, audioManager, onThemeToggle) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.roomData = roomData;
    this.audio = audioManager;
    this.onThemeToggle = onThemeToggle;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);
    this.hoveredObject = null;
    this.activeAnimations = [];

    // UI elements
    this.inspector = document.getElementById('inspector');
    this.inspId = document.getElementById('insp-id');
    this.inspName = document.getElementById('insp-name');
    this.inspHint = document.getElementById('insp-hint');
    this.inspState = document.getElementById('insp-state');

    // Interactive states
    this.states = {
      doorOpen: false,
      upperDrawerOpen: false,
      lowerDrawerOpen: false,
      blindsOpen: true,
      lampOn: false,
      chairPulled: false,
      bookPulled: false,
      fanSpeed: 1, // 0: off, 1: low, 2: high
      recordPlaying: false,
      artIndex: 0,
      globeSpinSpeed: 0
    };

    this.initEvents();
  }

  initEvents() {
    this.domElement.addEventListener('pointermove', (e) => {
      const rect = this.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.checkHover();
    });

    this.domElement.addEventListener('pointerleave', () => {
      this.clearHover();
    });

    this.domElement.addEventListener('click', (e) => {
      // Avoid click after significant camera drag
      if (this.cameraController && this.cameraController.hasDragged()) return;
      this.handleClick();
    });
  }

  setCameraController(controller) {
    this.cameraController = controller;
  }

  checkHover() {
    if (!this.roomData || !this.roomData.interactiveList) return;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hitables = this.roomData.interactiveList.map(item => item.hitMesh || item.group).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(hitables, true);

    if (intersects.length > 0) {
      // Find top-most parent with userData.interactive
      let current = intersects[0].object;
      let targetItem = null;
      while (current) {
        if (current.userData && current.userData.interactive) {
          targetItem = current.userData;
          break;
        }
        current = current.parent;
      }

      if (targetItem) {
        if (this.hoveredObject !== targetItem) {
          this.setHover(targetItem);
        }
        return;
      }
    }

    this.clearHover();
  }

  setHover(item) {
    this.hoveredObject = item;
    document.body.classList.add('pointer-active');

    // Highlight target object lines if item provides highlight method
    if (item.setHighlight) {
      item.setHighlight(true);
    }

    // Update Inspector UI
    if (this.inspector) {
      this.inspId.textContent = item.tag || 'ITEM';
      this.inspName.textContent = item.name || '未知物件';
      this.inspHint.textContent = item.hint || '点击互动';
      this.inspState.textContent = item.getStateText ? item.getStateText(this.states) : 'READY';
      this.inspector.classList.add('active');
    }
  }

  clearHover() {
    if (this.hoveredObject) {
      if (this.hoveredObject.setHighlight) {
        this.hoveredObject.setHighlight(false);
      }
      this.hoveredObject = null;
      document.body.classList.remove('pointer-active');
    }

    if (this.inspector) {
      this.inspector.classList.remove('active');
    }
  }

  handleClick() {
    if (!this.hoveredObject) return;

    const item = this.hoveredObject;
    const type = item.type;

    switch (type) {
      case 'door':
        this.toggleDoor(item);
        break;
      case 'upperDrawer':
        this.toggleDrawer(item, 'upper');
        break;
      case 'lowerDrawer':
        this.toggleDrawer(item, 'lower');
        break;
      case 'blinds':
        this.toggleBlinds(item);
        break;
      case 'lamp':
        this.toggleLamp(item);
        break;
      case 'cup':
        this.interactCup(item);
        break;
      case 'chair':
        this.toggleChair(item);
        break;
      case 'book':
        this.toggleBook(item);
        break;
      case 'fan':
        this.toggleFan(item);
        break;
      case 'recordPlayer':
        this.toggleRecordPlayer(item);
        break;
      case 'chime':
        this.ringChime(item);
        break;
      case 'art':
        this.cycleArt(item);
        break;
      case 'globe':
        this.spinGlobe(item);
        break;
      case 'switch':
        this.flipSwitch(item);
        break;
      case 'clock':
        this.interactClock(item);
        break;
      case 'sofa':
      case 'pillow':
        this.bounceSofa(item);
        break;
      default:
        if (item.onClick) item.onClick(this);
        break;
    }

    // Refresh inspector state text
    if (item.getStateText && this.inspState) {
      this.inspState.textContent = item.getStateText(this.states);
    }
  }

  // --- Object Specific Interaction Handlers ---

  toggleDoor(item) {
    this.states.doorOpen = !this.states.doorOpen;
    const targetAngle = this.states.doorOpen ? -Math.PI * 0.42 : 0;
    const startAngle = item.pivot.rotation.y;

    if (this.audio) this.audio.playDoor(this.states.doorOpen);

    this.addAnimation({
      duration: 1.1,
      update: (t) => {
        // Natural ease-out with subtle settle
        const ease = 1 - Math.pow(1 - t, 3);
        item.pivot.rotation.y = THREE.MathUtils.lerp(startAngle, targetAngle, ease);
      }
    });
  }

  toggleDrawer(item, which) {
    const isUpper = which === 'upper';
    const stateKey = isUpper ? 'upperDrawerOpen' : 'lowerDrawerOpen';
    this.states[stateKey] = !this.states[stateKey];
    const isOpen = this.states[stateKey];

    const startZ = item.drawerMesh.position.z;
    const targetZ = isOpen ? 0.38 : 0.0;

    if (this.audio) this.audio.playDrawer(isOpen);

    this.addAnimation({
      duration: 0.65,
      update: (t) => {
        // Soft overshoot bounce on close/open
        const ease = t < 1 ? 1 - Math.pow(1 - t, 2.5) : 1;
        item.drawerMesh.position.z = THREE.MathUtils.lerp(startZ, targetZ, ease);
      }
    });
  }

  toggleBlinds(item) {
    this.states.blindsOpen = !this.states.blindsOpen;
    const isOpen = this.states.blindsOpen;
    if (this.audio) this.audio.playSwitch(isOpen);

    if (item.setBlindsState) {
      item.setBlindsState(isOpen, (anim) => this.addAnimation(anim));
    }
  }

  toggleLamp(item) {
    this.states.lampOn = !this.states.lampOn;
    const isOn = this.states.lampOn;
    if (this.audio) this.audio.playLamp(isOn);

    if (item.setLampState) {
      item.setLampState(isOn);
    }

    // Slight mechanical arm bounce
    const startRotX = item.armPivot.rotation.x;
    this.addAnimation({
      duration: 0.4,
      update: (t) => {
        const bounce = Math.sin(t * Math.PI) * (isOn ? 0.08 : -0.06);
        item.armPivot.rotation.x = startRotX + bounce;
      },
      complete: () => {
        item.armPivot.rotation.x = startRotX;
      }
    });
  }

  interactCup(item) {
    if (this.audio) this.audio.playClick(880);
    const startY = item.mesh.position.y;
    this.addAnimation({
      duration: 0.5,
      update: (t) => {
        const wobble = Math.sin(t * Math.PI * 2) * 0.03 * (1 - t);
        const lift = Math.sin(t * Math.PI) * 0.04;
        item.mesh.position.y = startY + lift;
        item.mesh.rotation.z = wobble;
      },
      complete: () => {
        item.mesh.position.y = startY;
        item.mesh.rotation.z = 0;
      }
    });

    if (this.roomData.dynamics) {
      this.roomData.dynamics.boostSteam();
    }
  }

  toggleChair(item) {
    this.states.chairPulled = !this.states.chairPulled;
    const isPulled = this.states.chairPulled;
    const startZ = item.group.position.z;
    const targetZ = isPulled ? 0.45 : 0.0;
    const startRot = item.group.rotation.y;
    const targetRot = isPulled ? 0.25 : 0.0;

    if (this.audio) this.audio.playDrawer(isPulled);

    this.addAnimation({
      duration: 0.8,
      update: (t) => {
        const ease = 1 - Math.pow(1 - t, 3);
        item.group.position.z = THREE.MathUtils.lerp(startZ, targetZ, ease);
        item.group.rotation.y = THREE.MathUtils.lerp(startRot, targetRot, ease);
      }
    });
  }

  toggleBook(item) {
    this.states.bookPulled = !this.states.bookPulled;
    const isPulled = this.states.bookPulled;
    const startX = item.bookMesh.position.x;
    const targetX = isPulled ? 0.28 : 0.0;

    if (this.audio) this.audio.playDrawer(isPulled);

    this.addAnimation({
      duration: 0.6,
      update: (t) => {
        const ease = 1 - Math.pow(1 - t, 3);
        item.bookMesh.position.x = THREE.MathUtils.lerp(startX, targetX, ease);
      }
    });
  }

  toggleFan(item) {
    this.states.fanSpeed = (this.states.fanSpeed + 1) % 3;
    if (this.audio) {
      this.audio.playClick(600 + this.states.fanSpeed * 200);
      this.audio.setFanSpeed(this.states.fanSpeed);
    }
    if (this.roomData.dynamics) {
      this.roomData.dynamics.setFanTargetRpm(this.states.fanSpeed === 0 ? 0 : (this.states.fanSpeed === 1 ? 80 : 180));
    }
    // Pull chain animation
    if (item.chainMesh) {
      const origY = item.chainMesh.position.y;
      this.addAnimation({
        duration: 0.35,
        update: (t) => {
          const pull = Math.sin(t * Math.PI) * -0.06;
          item.chainMesh.position.y = origY + pull;
        },
        complete: () => {
          item.chainMesh.position.y = origY;
        }
      });
    }
  }

  toggleRecordPlayer(item) {
    this.states.recordPlaying = !this.states.recordPlaying;
    const isPlaying = this.states.recordPlaying;

    if (item.setTonearm) {
      item.setTonearm(isPlaying, (anim) => this.addAnimation(anim));
    }

    if (this.audio) {
      if (isPlaying) {
        this.audio.startRecordPlayer();
      } else {
        this.audio.stopRecordPlayer();
      }
    }

    if (this.roomData.dynamics) {
      this.roomData.dynamics.setRecordSpinning(isPlaying);
    }
  }

  ringChime(item) {
    if (this.audio) {
      // Play harmonic chime chord
      const note = Math.floor(Math.random() * 5);
      this.audio.playChime(note);
    }
    if (this.roomData.dynamics) {
      this.roomData.dynamics.impulseChime();
    }
  }

  cycleArt(item) {
    this.states.artIndex = (this.states.artIndex + 1) % 3;
    if (this.audio) this.audio.playClick(520);

    if (item.setArtIndex) {
      item.setArtIndex(this.states.artIndex);
    }

    // Tilt wall art slightly with spring return
    const startRotZ = item.frameGroup.rotation.z;
    this.addAnimation({
      duration: 0.8,
      update: (t) => {
        const swing = Math.sin(t * Math.PI * 3) * 0.04 * (1 - t);
        item.frameGroup.rotation.z = startRotZ + swing;
      },
      complete: () => {
        item.frameGroup.rotation.z = startRotZ;
      }
    });
  }

  spinGlobe(item) {
    if (this.audio) this.audio.playClick(400);
    if (this.roomData.dynamics) {
      this.roomData.dynamics.impulseGlobe();
    }
  }

  flipSwitch(item) {
    if (this.audio) this.audio.playSwitch(true);

    // Toggle switch paddle
    if (item.paddleMesh) {
      item.paddleMesh.rotation.x = item.paddleMesh.rotation.x > 0 ? -0.15 : 0.15;
    }

    if (this.onThemeToggle) {
      this.onThemeToggle();
    }
  }

  interactClock(item) {
    if (this.audio) this.audio.playClockChime();
    const startScale = item.group.scale.x;
    this.addAnimation({
      duration: 0.4,
      update: (t) => {
        const pulse = Math.sin(t * Math.PI) * 0.06;
        item.group.scale.setScalar(startScale + pulse);
      },
      complete: () => {
        item.group.scale.setScalar(startScale);
      }
    });
  }

  bounceSofa(item) {
    if (this.audio) this.audio.playDrawer(false);
    const startY = item.mesh.position.y;
    this.addAnimation({
      duration: 0.5,
      update: (t) => {
        const depress = -Math.sin(t * Math.PI) * 0.04 * Math.exp(-t * 2);
        item.mesh.position.y = startY + depress;
      },
      complete: () => {
        item.mesh.position.y = startY;
      }
    });
  }

  // --- Animation Scheduler ---

  addAnimation(anim) {
    anim.elapsed = 0;
    this.activeAnimations.push(anim);
  }

  update(delta) {
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      anim.elapsed += delta;
      const t = Math.min(1.0, anim.elapsed / anim.duration);
      if (anim.update) anim.update(t);
      if (t >= 1.0) {
        if (anim.complete) anim.complete();
        this.activeAnimations.splice(i, 1);
      }
    }
  }
}
