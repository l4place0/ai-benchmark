/**
 * materials.js - Cel-shading / Toon Material system & Inverted Hull Outlines
 * Implements authentic Japanese anime stepped shading (三渲二) with soft blue-purple shadows.
 */
import * as THREE from 'three';

// 1. Generate 3-step discrete cel-shading gradient map for MeshToonMaterial
export function createToonRampTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  // Stepped anime luminance ramp:
  // Step 0: Soft blue-purple shadow (背光部 - desaturated lilac)
  // Step 1: Intermediate midtone
  // Step 2 & 3: Clean bright sunlit area (受光部 - high luminance)
  const imgData = ctx.createImageData(4, 1);
  const data = imgData.data;

  // Pixel 0 (Deep Shadow: 0..0.25)
  data[0] = 165; data[1] = 175; data[2] = 210; data[3] = 255;
  // Pixel 1 (Midtone / Soft shadow: 0.25..0.5)
  data[4] = 215; data[5] = 220; data[6] = 235; data[7] = 255;
  // Pixel 2 (Base Lit: 0.5..0.75)
  data[8] = 245; data[9] = 248; data[10] = 252; data[11] = 255;
  // Pixel 3 (Highlight: 0.75..1.0)
  data[12] = 255; data[13] = 255; data[14] = 255; data[15] = 255;

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export const toonRamp = createToonRampTexture();

// 2. Base Anime Material Creator
export function createToonMaterial(color, options = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonRamp,
    roughness: options.roughness ?? 0.4,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1.0,
    side: options.side ?? THREE.FrontSide,
    ...options
  });
}

// 3. Anime Inverted Hull Outline Material
export function createOutlineMaterial(thickness = 0.03, color = 0x242632) {
  // Inverted hull with vertex normal extrusion in shader
  const material = new THREE.ShaderMaterial({
    uniforms: {
      outlineThickness: { value: thickness },
      outlineColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 transformed = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide
  });
  return material;
}

/**
 * Creates an outlined mesh group (Inner mesh + inverted hull outline)
 */
export function createOutlinedMesh(geometry, material, outlineThickness = 0.025, outlineColor = 0x282c37) {
  const group = new THREE.Group();

  const mainMesh = new THREE.Mesh(geometry, material);
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

  if (outlineThickness > 0) {
    const outlineMat = createOutlineMaterial(outlineThickness, outlineColor);
    const outlineMesh = new THREE.Mesh(geometry, outlineMat);
    group.add(outlineMesh);
  }

  return group;
}

// 4. Pre-defined Anime Theme Materials Palette
export const materials = {
  // Architecture & Structure
  wallStuccoCream: createToonMaterial(0xfcf8ee),
  wallStuccoWhite: createToonMaterial(0xf7fafc),
  wallBlueSiding: createToonMaterial(0xbfdbfe),
  wallGraySiding: createToonMaterial(0xd8e0e8),
  roofTileSlate: createToonMaterial(0x3b4252),
  roofTileDarkBlue: createToonMaterial(0x2d3748),
  roofTileGreen: createToonMaterial(0x334e44),
  woodDark: createToonMaterial(0x422d1d),
  woodWarm: createToonMaterial(0x8c5b36),
  woodPlanks: createToonMaterial(0xa57548),
  concreteLight: createToonMaterial(0xd5dbdb),
  concreteDark: createToonMaterial(0x85929e),

  // Rail & Metal
  railSteel: new THREE.MeshStandardMaterial({
    color: 0xccd1d9,
    metalness: 0.85,
    roughness: 0.25
  }),
  railSideRust: createToonMaterial(0x6e473b),
  ballastGravel: createToonMaterial(0x565b61),
  catenarySteel: createToonMaterial(0x4a5568),
  sleeperWood: createToonMaterial(0x3e2723),

  // Train Colors
  trainBodyCream: createToonMaterial(0xfffdfa),
  trainStripePink: createToonMaterial(0xff758f),
  trainStripeBlue: createToonMaterial(0x38bdf8),
  trainRoofGray: createToonMaterial(0x64748b),
  trainUnderframe: createToonMaterial(0x27272a),

  // Street & Road
  curbStone: createToonMaterial(0xb0bec5),
  crossingArmYellow: createToonMaterial(0xfacc15),
  crossingArmBlack: createToonMaterial(0x1e293b),
  trafficRedGlow: new THREE.MeshBasicMaterial({ color: 0xff1744 }),
  trafficGreenGlow: new THREE.MeshBasicMaterial({ color: 0x00e676 }),

  // Glass & Translucent
  animeGlass: new THREE.MeshPhysicalMaterial({
    color: 0xd0e8ff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.5,
    ior: 1.5
  }),

  // Nature & Sakura
  sakuraCanopyLight: createToonMaterial(0xffe4ec),
  sakuraCanopyMid: createToonMaterial(0xffb6c1),
  sakuraCanopyDeep: createToonMaterial(0xf48fb1),
  sakuraTrunk: createToonMaterial(0x4a3728),
  grassGreen: createToonMaterial(0x7cb342),
  flowerTulipRed: createToonMaterial(0xef4444),
  flowerTulipYellow: createToonMaterial(0xfbbf24),
  flowerHydrangea: createToonMaterial(0x60a5fa),

  // Props
  postboxRed: createToonMaterial(0xd32f2f),
  phoneBoothGreen: createToonMaterial(0x1b5e20),
  trafficConeOrange: createToonMaterial(0xff6d00),
  utilityPoleGray: createToonMaterial(0x94a3b8)
};
