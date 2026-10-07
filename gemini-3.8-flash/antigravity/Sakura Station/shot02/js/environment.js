/**
 * environment.js - Makoto Shinkai-inspired Anime Sky Dome, Lighting & Atmosphere
 * Creates spring 4:00 PM golden-hour afternoon lighting, painted clouds, and distant town horizon.
 */
import * as THREE from 'three';
import { materials } from './materials.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.currentPreset = 'afternoon';

    this.initSky();
    this.initLighting();
    this.initDistantScenery();
  }

  initSky() {
    // 1. Sky Dome with Anime Gradient Shader
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition + offset).y;
        vec3 color;
        if (h > 0.0) {
          color = mix(horizonColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        } else {
          color = mix(horizonColor, bottomColor, -h);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x286bb0) },       // Deep spring azure
      horizonColor: { value: new THREE.Color(0xffe8d6) },   // Warm 4 PM peach-golden horizon
      bottomColor: { value: new THREE.Color(0xdceefb) },
      offset: { value: 30 },
      exponent: { value: 0.6 }
    };

    const skyGeo = new THREE.SphereGeometry(350, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    // 2. Anime Billboard Clouds
    this.createAnimeClouds();
  }

  createAnimeClouds() {
    this.cloudGroup = new THREE.Group();

    // Procedural canvas for anime fluffy cumulus cloud with peach golden highlight
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Draw stylized layered cloud
    ctx.clearRect(0, 0, 512, 256);
    const cloudGrad = ctx.createLinearGradient(0, 40, 0, 240);
    cloudGrad.addColorStop(0, '#ffffff');
    cloudGrad.addColorStop(0.3, '#fff4ed');
    cloudGrad.addColorStop(0.7, '#fcdad7');
    cloudGrad.addColorStop(1, '#c5b6d6'); // soft lavender shadow underside

    ctx.fillStyle = cloudGrad;

    const puffs = [
      { x: 120, y: 150, r: 65 },
      { x: 190, y: 110, r: 85 },
      { x: 270, y: 95, r: 95 },
      { x: 350, y: 120, r: 80 },
      { x: 410, y: 160, r: 60 },
      { x: 260, y: 160, r: 80 }
    ];

    ctx.beginPath();
    puffs.forEach(p => {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    });
    ctx.fill();

    const cloudTex = new THREE.CanvasTexture(canvas);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Spawn 12 clouds at varying heights and distances
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 160 + Math.random() * 80;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 50 + Math.random() * 60;

      const w = 70 + Math.random() * 50;
      const h = w * 0.5;

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.userData = { speed: 0.0003 + Math.random() * 0.0004, angle, dist, y };
      this.cloudGroup.add(mesh);
      this.clouds.push(mesh);
    }

    this.scene.add(this.cloudGroup);
  }

  initLighting() {
    // 1. Ambient Light - tinted soft lavender / sky blue for anime shadow fill
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.25);
    this.scene.add(this.ambientLight);

    // 2. Hemisphere Light - warm sky / cool ground
    this.hemiLight = new THREE.HemisphereLight(0xfff3e0, 0x93c5fd, 0.75);
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    // 3. Directional Sun Light (Spring 4:00 PM Golden Hour: side-back angle)
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.position.set(-60, 55, 65);
    this.sunLight.castShadow = true;

    // Crisp anime shadow map settings
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 250;

    const d = 75;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);

    // 4. Subtle Spring Fog for atmospheric depth
    this.scene.fog = new THREE.FogExp2(0xcde2f5, 0.0055);
  }

  initDistantScenery() {
    // Distant mountain ridges and suburban forest silhouettes behind tracks
    const mountGroup = new THREE.Group();

    const mountMat = new THREE.MeshToonMaterial({
      color: 0x8ba6c9,
      gradientMap: materials.wallStuccoWhite.gradientMap
    });

    for (let i = 0; i < 7; i++) {
      const x = -120 + i * 40;
      const height = 35 + Math.random() * 25;
      const radius = 35 + Math.random() * 20;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 16), mountMat);
      cone.position.set(x, height / 2 - 10, -120 + Math.random() * 20);
      cone.scale.set(1.4, 1, 0.8);
      mountGroup.add(cone);
    }

    this.scene.add(mountGroup);
  }

  setTimeOfDay(preset) {
    this.currentPreset = preset;
    if (preset === 'afternoon') {
      // 16:00 Warm afternoon
      this.skyUniforms.topColor.value.setHex(0x286bb0);
      this.skyUniforms.horizonColor.value.setHex(0xffe8d6);
      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.intensity = 2.2;
      this.sunLight.position.set(-60, 55, 65);
      this.ambientLight.color.setHex(0xdbeafe);
      this.ambientLight.intensity = 1.25;
      this.scene.fog.color.setHex(0xcde2f5);
    } else if (preset === 'sunset') {
      // 17:45 Vibrant Twilight / Magic Hour
      this.skyUniforms.topColor.value.setHex(0x312e81);
      this.skyUniforms.horizonColor.value.setHex(0xf97316);
      this.sunLight.color.setHex(0xfb923c);
      this.sunLight.intensity = 2.4;
      this.sunLight.position.set(-80, 22, 50);
      this.ambientLight.color.setHex(0xf472b6);
      this.ambientLight.intensity = 1.0;
      this.scene.fog.color.setHex(0xfbcfe8);
    } else if (preset === 'morning') {
      // 08:30 Crisp clear morning
      this.skyUniforms.topColor.value.setHex(0x1d4ed8);
      this.skyUniforms.horizonColor.value.setHex(0xe0f2fe);
      this.sunLight.color.setHex(0xffffff);
      this.sunLight.intensity = 2.0;
      this.sunLight.position.set(50, 65, 50);
      this.ambientLight.color.setHex(0xe0e7ff);
      this.ambientLight.intensity = 1.35;
      this.scene.fog.color.setHex(0xdbeafe);
    }
  }

  update(delta) {
    // Slowly drift clouds across the anime sky
    this.clouds.forEach(cloud => {
      cloud.userData.angle += cloud.userData.speed;
      const x = Math.cos(cloud.userData.angle) * cloud.userData.dist;
      const z = Math.sin(cloud.userData.angle) * cloud.userData.dist;
      cloud.position.x = x;
      cloud.position.z = z;
      cloud.rotation.y = -cloud.userData.angle + Math.PI / 2;
    });
  }
}
