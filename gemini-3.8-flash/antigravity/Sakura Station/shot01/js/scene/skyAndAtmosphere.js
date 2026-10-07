import * as THREE from 'three';

// Anime Sky, Clouds, Sunlight & Distant Mountains
export class SkyAndAtmosphere {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 'afternoon'; // 'afternoon', 'sunset', 'morning'

    this.skyMesh = null;
    this.cloudsGroup = null;
    this.sunLight = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.mountains = null;

    this.init();
  }

  init() {
    this.createSkyDome();
    this.createDistantHills();
    this.createAnimeClouds();
    this.setupLighting();
    this.setupFog();
  }

  createSkyDome() {
    // Custom Anime Sky Shader with smooth gradient & sun halo
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
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 sunPosition;
      uniform vec3 sunColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = clamp(normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y, 0.0, 1.0);

        // Multi-stop anime sky gradient
        vec3 sky;
        if (h > 0.3) {
          float t = (h - 0.3) / 0.7;
          sky = mix(midColor, topColor, pow(max(t, 0.0), 0.8));
        } else {
          float t = max(h / 0.3, 0.0);
          sky = mix(bottomColor, midColor, pow(t, 1.2));
        }

        // Anime Sun Glow & Disc
        float sunAngle = dot(dir, normalize(sunPosition));
        if (sunAngle > 0.0) {
          float sunGlow = pow(sunAngle, 64.0) * 0.45;
          float sunCore = smoothstep(0.998, 0.9995, sunAngle) * 0.9;
          sky += (sunColor * (sunGlow + sunCore));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `;

    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3282f6) },      // Anime deep azure
      midColor: { value: new THREE.Color(0x7ecaf8) },      // Clear spring cyan
      bottomColor: { value: new THREE.Color(0xffebd9) },   // Warm peach afternoon horizon
      sunPosition: { value: new THREE.Vector3(120, 60, -100).normalize() },
      sunColor: { value: new THREE.Color(0xfff3e0) },
      offset: { value: 30 },
      exponent: { value: 0.6 }
    };

    const skyGeo = new THREE.SphereGeometry(600, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
  }

  createDistantHills() {
    // Distant layered rolling hills to give suburban depth
    const hillsGroup = new THREE.Group();
    hillsGroup.name = 'distant_hills';

    const hillMat1 = new THREE.MeshBasicMaterial({ color: 0x93b5db }); // Layer 1 (farthest)
    const hillMat2 = new THREE.MeshBasicMaterial({ color: 0x7da4d0 }); // Layer 2 (mid)
    const hillMat3 = new THREE.MeshBasicMaterial({ color: 0x6e96c4 }); // Layer 3 (closer)

    const layers = [
      { radius: 480, height: 90, segments: 24, y: -20, mat: hillMat1, zOffset: -120 },
      { radius: 400, height: 75, segments: 24, y: -18, mat: hillMat2, zOffset: -80 },
      { radius: 320, height: 50, segments: 20, y: -15, mat: hillMat3, zOffset: -40 }
    ];

    layers.forEach((l, idx) => {
      for (let i = 0; i < 7; i++) {
        const hillGeom = new THREE.ConeGeometry(80 + Math.random() * 50, l.height + Math.random() * 30, 16);
        const hill = new THREE.Mesh(hillGeom, l.mat);
        const angle = (i / 7) * Math.PI * 0.8 + 0.3;
        hill.position.set(
          Math.cos(angle) * l.radius - 80,
          l.y,
          -Math.sin(angle) * l.radius + l.zOffset
        );
        hill.scale.set(1.6, 0.7, 1.2);
        hillsGroup.add(hill);
      }
    });

    this.mountains = hillsGroup;
    this.scene.add(hillsGroup);
  }

  createAnimeClouds() {
    this.cloudsGroup = new THREE.Group();
    this.cloudsGroup.name = 'anime_clouds';

    // Stylized cumulus cloud clusters
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88
    });

    for (let i = 0; i < 18; i++) {
      const cluster = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);

      for (let p = 0; p < numPuffs; p++) {
        const puffGeom = new THREE.SphereGeometry(18 + Math.random() * 14, 8, 8);
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(
          (p - numPuffs / 2) * 20 + Math.random() * 8,
          Math.random() * 10,
          Math.random() * 16
        );
        puff.scale.set(1.4, 0.7, 1.0);
        cluster.add(puff);
      }

      // Spread along the sky
      const angle = (i / 18) * Math.PI * 2;
      const dist = 220 + Math.random() * 150;
      cluster.position.set(
        Math.cos(angle) * dist,
        110 + Math.random() * 40,
        Math.sin(angle) * dist
      );
      this.cloudsGroup.add(cluster);
    }

    this.scene.add(this.cloudsGroup);
  }

  setupLighting() {
    // 4:00 PM Golden Spring Afternoon Sun
    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.8);
    this.sunLight.position.set(90, 85, 45); // Slanted side-back sunlight
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Soft sky fill light (lavender-blue)
    this.ambientLight = new THREE.AmbientLight(0xcfd7ea, 0.9);
    this.scene.add(this.ambientLight);

    // Hemisphere light for ground-sky bounce
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xfce7f3, 0.6);
    this.scene.add(this.hemiLight);
  }

  setupFog() {
    // Gentle anime atmospheric perspective fog
    this.scene.fog = new THREE.FogExp2(0xd6e4f7, 0.0035);
  }

  setTimeOfDay(time) {
    this.timeOfDay = time;
    if (time === 'sunset') {
      // Magic hour twilight
      this.skyUniforms.topColor.value.setHex(0x312e81);      // Deep indigo
      this.skyUniforms.midColor.value.setHex(0xbe185d);      // Magenta violet
      this.skyUniforms.bottomColor.value.setHex(0xf97316);   // Radiant orange
      this.skyUniforms.sunColor.value.setHex(0xfef08a);
      this.sunLight.color.setHex(0xfb923c);
      this.sunLight.intensity = 1.6;
      this.sunLight.position.set(110, 40, 20);
      this.ambientLight.color.setHex(0xa78bfa);
      this.ambientLight.intensity = 0.7;
      this.hemiLight.color.setHex(0xec4899);
      this.hemiLight.groundColor.setHex(0xfdba74);
      this.scene.fog.color.setHex(0xf472b6);
      this.scene.fog.density = 0.004;
    } else if (time === 'morning') {
      // Fresh spring morning
      this.skyUniforms.topColor.value.setHex(0x2563eb);
      this.skyUniforms.midColor.value.setHex(0x60a5fa);
      this.skyUniforms.bottomColor.value.setHex(0xffedd5);
      this.skyUniforms.sunColor.value.setHex(0xffffff);
      this.sunLight.color.setHex(0xfffaf0);
      this.sunLight.intensity = 1.9;
      this.sunLight.position.set(70, 95, 60);
      this.ambientLight.color.setHex(0xe0f2fe);
      this.ambientLight.intensity = 0.95;
      this.hemiLight.color.setHex(0x93c5fd);
      this.hemiLight.groundColor.setHex(0xdcfce7);
      this.scene.fog.color.setHex(0xbae6fd);
      this.scene.fog.density = 0.003;
    } else {
      // Afternoon 4:00 PM (Default)
      this.skyUniforms.topColor.value.setHex(0x3282f6);
      this.skyUniforms.midColor.value.setHex(0x7ecaf8);
      this.skyUniforms.bottomColor.value.setHex(0xffebd9);
      this.skyUniforms.sunColor.value.setHex(0xfff3e0);
      this.sunLight.color.setHex(0xffedd5);
      this.sunLight.intensity = 1.8;
      this.sunLight.position.set(90, 85, 45);
      this.ambientLight.color.setHex(0xcfd7ea);
      this.ambientLight.intensity = 0.9;
      this.hemiLight.color.setHex(0x93c5fd);
      this.hemiLight.groundColor.setHex(0xfce7f3);
      this.scene.fog.color.setHex(0xd6e4f7);
      this.scene.fog.density = 0.0035;
    }
  }

  update(delta) {
    if (this.cloudsGroup) {
      // Gentle anime drift of clouds
      this.cloudsGroup.rotation.y += delta * 0.006;
    }
  }
}
