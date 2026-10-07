import * as THREE from 'three';
import { TextureGenerator } from './textureGenerator.js';

// Cel-Shading & Anime Material Factory
export class ToonMaterialFactory {
  static defaultRamp = null;
  static smoothRamp = null;
  static foliageRamp = null;
  static materialCache = new Map();

  static init() {
    if (!this.defaultRamp) {
      // 3-tone anime ramp (Shadow, Midtone, Highlight)
      this.defaultRamp = TextureGenerator.createGradientRamp([
        { pos: 0.0, color: '#7b7d9c' },  // Anime lavender shadow
        { pos: 0.42, color: '#7b7d9c' },
        { pos: 0.43, color: '#ded7d0' }, // Warm anime midtone
        { pos: 0.85, color: '#ded7d0' },
        { pos: 0.86, color: '#ffffff' }, // Sunlight highlight
        { pos: 1.0, color: '#ffffff' }
      ]);

      // Soft ramp for organic shapes & foliage
      this.smoothRamp = TextureGenerator.createGradientRamp([
        { pos: 0.0, color: '#8884a4' },
        { pos: 0.35, color: '#c4bdd4' },
        { pos: 0.70, color: '#f5e8ea' },
        { pos: 1.0, color: '#ffffff' }
      ]);

      // Foliage-specific ramp with cherry blossom tones
      this.foliageRamp = TextureGenerator.createGradientRamp([
        { pos: 0.0, color: '#d97b97' },  // Deep sakura shadow
        { pos: 0.45, color: '#fca5ba' }, // Midtone blossom pink
        { pos: 0.85, color: '#ffe4ec' }, // Highlight blossom
        { pos: 1.0, color: '#ffffff' }
      ]);
    }
  }

  // Create standard anime cel-shaded material
  static getToonMaterial(options = {}) {
    this.init();
    const {
      color = 0xffffff,
      map = null,
      gradientMap = this.defaultRamp,
      transparent = false,
      opacity = 1.0,
      side = THREE.FrontSide,
      roughness = 0.5,
      metalness = 0.1,
      emissive = 0x000000,
      emissiveIntensity = 0.0
    } = options;

    return new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      map: map,
      gradientMap: gradientMap,
      transparent: transparent,
      opacity: opacity,
      side: side,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: emissiveIntensity
    });
  }

  // Create anime glass material (semi-transparent with soft specular/sky tint)
  static getGlassMaterial(options = {}) {
    const {
      color = 0x93c5fd,
      opacity = 0.45,
      emissive = 0x1e3a8a,
      emissiveIntensity = 0.1
    } = options;

    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: opacity,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
      emissive: new THREE.Color(emissive),
      emissiveIntensity: emissiveIntensity,
      depthWrite: false
    });
  }

  // Create sakura blossom foliage material with soft anime glow
  static getSakuraMaterial(level = 0) {
    this.init();
    // 3 subtle foliage tones: 0=base pink, 1=light pale pink, 2=rich accent pink
    const tones = [
      { color: 0xffb7c8, emissive: 0xff8fa3, intensity: 0.12 },
      { color: 0xffc8d6, emissive: 0xffadc0, intensity: 0.15 },
      { color: 0xff9ebb, emissive: 0xf472b6, intensity: 0.10 }
    ];
    const t = tones[level % tones.length];

    return new THREE.MeshToonMaterial({
      color: new THREE.Color(t.color),
      gradientMap: this.foliageRamp,
      emissive: new THREE.Color(t.emissive),
      emissiveIntensity: t.intensity,
      roughness: 0.8
    });
  }

  // Create bright emissive neon / lamp material
  static getEmissiveMaterial(color = 0xffffff, intensity = 1.5) {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color)
    });
  }

  // Create Inverted-Hull Anime Outline Mesh
  // Clones geometry, expands vertices along normals, renders backfaces in dark ink color
  static createOutline(mesh, thickness = 0.04, color = 0x272738) {
    if (!mesh.geometry) return null;

    const outlineGeom = mesh.geometry.clone();
    const outlineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      side: THREE.BackSide
    });

    const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);

    // Expand vertices along normals
    const pos = outlineGeom.attributes.position;
    const norm = outlineGeom.attributes.normal;
    if (norm) {
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) + norm.getX(i) * thickness,
          pos.getY(i) + norm.getY(i) * thickness,
          pos.getZ(i) + norm.getZ(i) * thickness
        );
      }
      outlineGeom.computeVertexNormals();
    } else {
      outlineMesh.scale.multiplyScalar(1 + thickness);
    }

    outlineMesh.name = 'anime_outline';
    return outlineMesh;
  }
}
