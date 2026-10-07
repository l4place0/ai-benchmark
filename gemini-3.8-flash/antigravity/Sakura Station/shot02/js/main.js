/**
 * main.js - Sakura Station Three.js Scene Bootstrap & Master Animation Loop
 * Integrates all modules into an anime cel-shaded masterpiece.
 */
import * as THREE from 'three';
import { Environment } from './environment.js';
import { Street } from './street.js';
import { Station } from './station.js';
import { Railway } from './railway.js';
import { Train } from './train.js';
import { Crossing } from './crossing.js';
import { Buildings } from './buildings.js';
import { VendingMachines } from './vendingMachines.js';
import { SakuraSystem } from './sakura.js';
import { Props } from './props.js';
import { CameraController } from './controls.js';
import { AnimeAudio } from './audio.js';

class SakuraStationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initScene();
    this.initCamera();
    this.initWorld();
    this.initUI();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ACES Filmic Tone Mapping for anime cinematic vibrance & soft highlights
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Enable soft anime shadow maps
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initScene() {
    this.scene = new THREE.Scene();
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 450);
  }

  initWorld() {
    // 1. Sky Dome, Clouds & Golden Hour Lighting
    this.environment = new Environment(this.scene);

    // 2. Main Street & Station Plaza (Asphalt, markings, curbs, grates, mirror, flowerbeds)
    this.street = new Street(this.scene);

    // 3. Station House & Platform (Canopy, signs, ticket gates, timetable, clocks)
    this.station = new Station(this.scene);

    // 4. Double Tracks & Catenary Electrification (Ballast, steel rails, poles, signals)
    this.railway = new Railway(this.scene);

    // 5. Series 1000 Commuter Train (Cab nose, stripes, pantograph, open doors, bogies)
    this.train = new Train(this.scene);

    // 6. Level Crossing (Fumikiri, yellow-black boom arms, alternating red blinkers, bike)
    this.crossing = new Crossing(this.scene);

    // 7. Low-rise Architecture (Wagashi, Convenience Store, Cafe, Flower Shop, Residences)
    this.buildings = new Buildings(this.scene);

    // 8. 5 Authentic Japanese Vending Machines
    this.vending = new VendingMachines(this.scene);

    // 9. Majestic Sakura Trees & 2,500+ Dynamic Tumbling Petals Particle System
    this.sakura = new SakuraSystem(this.scene);

    // 10. Concrete Utility Poles, Sagging Wires, Sleeping Cat, Postbox, Phone Booth, Sparrows
    this.props = new Props(this.scene);

    // 11. Audio Synthesizer (Web Audio API)
    this.audio = new AnimeAudio();

    // 12. Camera Controller (Cinematic Presets + Orbit + Walk)
    this.controls = new CameraController(this.camera, this.renderer.domElement, (mode, presetKey) => {
      this.updateCameraUI(mode, presetKey);
    });
  }

  initUI() {
    // Camera Preset Buttons
    const camBtns = document.querySelectorAll('.cam-btn');
    camBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const camKey = btn.dataset.cam;
        this.controls.applyPreset(camKey, true);
      });
    });

    // Walk Mode Button
    const btnWalk = document.getElementById('btn-walk');
    btnWalk.addEventListener('click', () => {
      this.controls.setMode('walk');
    });

    // Orbit Mode Button
    const btnOrbit = document.getElementById('btn-orbit');
    btnOrbit.addEventListener('click', () => {
      this.controls.setMode('orbit');
    });

    // Petal Density Slider
    const petalSlider = document.getElementById('petal-slider');
    const petalValText = document.getElementById('petal-val-text');
    petalSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.sakura.setPetalCount(val);
      let desc = '中等';
      if (val < 1200) desc = '微风';
      else if (val > 3000) desc = '樱吹雪';
      petalValText.textContent = `${desc} (${val.toLocaleString()}片)`;
    });

    // Time of Day Buttons
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const timePreset = btn.dataset.time;
        this.environment.setTimeOfDay(timePreset);
      });
    });

    // Audio Sound Button
    const soundBtn = document.getElementById('sound-btn');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-text');
    soundBtn.addEventListener('click', () => {
      const isPlaying = this.audio.toggle();
      if (isPlaying) {
        soundBtn.classList.add('playing');
        soundIcon.textContent = '🔊';
        soundText.textContent = '环境音效播放中 (点击静音)';
      } else {
        soundBtn.classList.remove('playing');
        soundIcon.textContent = '🔈';
        soundText.textContent = '播放环境音 (微风·道口·雀鸣)';
      }
    });

    // Checkboxes
    const chkTrain = document.getElementById('chk-train-anim');
    chkTrain.addEventListener('change', (e) => {
      this.train.enableAnimation = e.target.checked;
    });

    const chkCrossing = document.getElementById('chk-crossing-blink');
    chkCrossing.addEventListener('change', (e) => {
      this.crossing.enableBlink = e.target.checked;
    });

    // Info Modal
    const infoBtn = document.getElementById('info-btn');
    const closeInfo = document.getElementById('close-info');
    const infoModal = document.getElementById('info-modal');

    infoBtn.addEventListener('click', () => {
      infoModal.classList.toggle('hidden');
    });
    closeInfo.addEventListener('click', () => {
      infoModal.classList.add('hidden');
    });
  }

  updateCameraUI(mode, activePresetKey) {
    const camBtns = document.querySelectorAll('.cam-btn');
    const btnWalk = document.getElementById('btn-walk');
    const btnOrbit = document.getElementById('btn-orbit');

    camBtns.forEach(b => b.classList.remove('active'));
    btnWalk.classList.remove('active');
    btnOrbit.classList.remove('active');

    if (mode === 'preset') {
      const activeBtn = document.querySelector(`.cam-btn[data-cam="${activePresetKey}"]`);
      if (activeBtn) activeBtn.classList.add('active');
    } else if (mode === 'walk') {
      btnWalk.classList.add('active');
    } else if (mode === 'orbit') {
      btnOrbit.classList.add('active');
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Camera
    this.controls.update(delta);

    // 2. Update Falling Petals with Wind Physics
    this.sakura.update(delta, elapsedTime);

    // 3. Update Sky & Drifting Clouds
    this.environment.update(delta);

    // 4. Update Commuter Train Idling Vibration
    this.train.update(elapsedTime);

    // 5. Update Crossing Alternating Blinking Warning Lights
    this.crossing.update(elapsedTime);

    // 6. Update Swaying Laundry & Fans
    this.buildings.update(elapsedTime);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    new SakuraStationApp();
  });
} else {
  new SakuraStationApp();
}
