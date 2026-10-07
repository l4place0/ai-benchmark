import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { SkyAndAtmosphere } from './scene/skyAndAtmosphere.js';
import { GroundAndRoads } from './scene/groundAndRoads.js';
import { StationBuilding } from './scene/stationBuilding.js';
import { PlatformAndCanopy } from './scene/platformAndCanopy.js';
import { TracksAndCatenary } from './scene/tracksAndCatenary.js';
import { CommuterTrain } from './scene/commuterTrain.js';
import { RailwayCrossing } from './scene/railwayCrossing.js';
import { TownBuildings } from './scene/townBuildings.js';
import { StationPlaza } from './scene/stationPlaza.js';
import { VendingMachines } from './scene/vendingMachines.js';
import { SakuraTrees } from './scene/sakuraTrees.js';
import { PetalParticleSystem } from './scene/petalParticleSystem.js';
import { AnimeDetails } from './scene/animeDetails.js';

import { FirstPersonController } from './controls/firstPersonController.js';
import { CameraDirector } from './controls/cameraDirector.js';
import { AnimeAudioSynth } from './audio/animeAudioSynth.js';

// Master Three.js Application
class SakuraStationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Scene, Camera & Renderer
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      800
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 2. Controls & Controllers
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.maxPolarAngle = Math.PI / 2.05; // Prevent camera dipping below ground
    this.orbit.minDistance = 2;
    this.orbit.maxDistance = 120;
    this.orbit.enabled = false;

    this.fpController = new FirstPersonController(this.camera, this.renderer.domElement);
    this.cameraDirector = new CameraDirector(this.camera, this.orbit, this.fpController);
    this.audioSynth = new AnimeAudioSynth();

    // 3. Build Scene Environments
    this.sky = new SkyAndAtmosphere(this.scene);
    this.ground = new GroundAndRoads(this.scene);
    this.station = new StationBuilding(this.scene);
    this.platform = new PlatformAndCanopy(this.scene);
    this.tracks = new TracksAndCatenary(this.scene);
    this.train = new CommuterTrain(this.scene);
    this.crossing = new RailwayCrossing(this.scene);
    this.town = new TownBuildings(this.scene);
    this.plaza = new StationPlaza(this.scene);
    this.vending = new VendingMachines(this.scene);
    this.trees = new SakuraTrees(this.scene);
    this.petals = new PetalParticleSystem(this.scene, 2800);
    this.details = new AnimeDetails(this.scene);

    // 4. Timing & State
    this.lastTime = performance.now();

    // 5. Initialize Events & UI
    this.initEvents();
    this.initUI();

    // 6. Start Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard shortcuts for shots (1-5), Roam (R), Orbit (O)
    window.addEventListener('keydown', (e) => {
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
        const shotNum = e.code.replace('Digit', '');
        this.cameraDirector.setShot(`shot${shotNum}`);
        this.updateActiveButton(`btn-shot${shotNum}`);
      } else if (e.code === 'KeyR' && !this.fpController.enabled) {
        this.cameraDirector.setFPSMode();
        this.updateActiveButton('btn-fps');
      } else if (e.code === 'KeyO' && this.cameraDirector.currentMode !== 'orbit') {
        this.cameraDirector.setOrbitMode();
        this.updateActiveButton('btn-orbit');
      } else if (e.code === 'KeyM') {
        this.toggleAudio();
      } else if (e.code === 'KeyH') {
        this.audioSynth.playTrainHorn();
      }
    });
  }

  initUI() {
    // Cinematic Shot Buttons
    ['1', '2', '3', '4', '5'].forEach(num => {
      const btn = document.getElementById(`btn-shot${num}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.cameraDirector.setShot(`shot${num}`);
          this.updateActiveButton(`btn-shot${num}`);
        });
      }
    });

    // Orbit & FPS buttons
    const btnOrbit = document.getElementById('btn-orbit');
    if (btnOrbit) {
      btnOrbit.addEventListener('click', () => {
        this.cameraDirector.setOrbitMode();
        this.updateActiveButton('btn-orbit');
      });
    }

    const btnFps = document.getElementById('btn-fps');
    if (btnFps) {
      btnFps.addEventListener('click', () => {
        this.cameraDirector.setFPSMode();
        this.updateActiveButton('btn-fps');
      });
    }

    // Time of Day Selector
    const timeSelect = document.getElementById('time-select');
    if (timeSelect) {
      timeSelect.addEventListener('change', (e) => {
        this.sky.setTimeOfDay(e.target.value);
      });
    }

    // Petal Wind / Storm Toggle (花吹雪)
    const btnStorm = document.getElementById('btn-storm');
    if (btnStorm) {
      btnStorm.addEventListener('click', () => {
        const active = !this.petals.stormMode;
        this.petals.setStormMode(active);
        btnStorm.classList.toggle('active', active);
        btnStorm.innerHTML = active ? '🌸 花吹雪 (开)' : '🍃 柔和微风';
      });
    }

    // Train Door Open/Close Toggle
    const btnDoors = document.getElementById('btn-doors');
    if (btnDoors) {
      btnDoors.addEventListener('click', () => {
        const isOpen = this.train.toggleDoors();
        btnDoors.innerHTML = isOpen ? '🚪 电车车门 (开)' : '🚪 电车车门 (关)';
        this.audioSynth.playStationJingle();
      });
    }

    // Train Horn Button
    const btnHorn = document.getElementById('btn-horn');
    if (btnHorn) {
      btnHorn.addEventListener('click', () => {
        this.audioSynth.playTrainHorn();
      });
    }

    // Audio Mute/Unmute Button
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        this.toggleAudio();
      });
    }

    // Fullscreen Toggle
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
    }
  }

  toggleAudio() {
    const isPlaying = this.audioSynth.toggleSound();
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.classList.toggle('active', isPlaying);
      btnAudio.innerHTML = isPlaying ? '🔊 声音 (开)' : '🔇 声音 (静音)';
    }
  }

  updateActiveButton(id) {
    document.querySelectorAll('.shot-btn, .mode-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  animate() {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;

    // Update animated subsystems
    this.sky.update(delta);
    this.train.update(delta);
    this.crossing.update(delta);
    this.petals.update(delta);

    // Update active camera controller
    if (this.cameraDirector.currentMode === 'fps') {
      this.fpController.update(delta);
    } else if (this.cameraDirector.currentMode === 'orbit') {
      this.orbit.update();
    } else {
      this.cameraDirector.update(delta);
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SakuraStationApp();
});
