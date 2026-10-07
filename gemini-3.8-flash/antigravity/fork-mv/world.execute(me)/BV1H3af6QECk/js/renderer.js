/**
 * Virtual Camera and Post-Processing Engine
 * Handles camera transformation, paper fiber grain,
 * and beat-synced screen impulses.
 */

import {
  getCameraState,
  BPM,
  getMusicBeat,
  getBeatPhase,
  getRhythmicImpulse,
  getSubBeatImpulse,
  getSixteenthImpulse
} from './timeline.js';
import { renderMasterSheet } from './master_sheet.js';
import { renderVocaloidScreenOverlays } from './vocaloid_fx.js';
import { pseudoRand } from './cards.js';

// Pre-generated deterministic noise pattern for risograph texture
let noiseCanvas = null;

function getNoisePattern(ctx) {
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 512;
    noiseCanvas.height = 512;
    const nctx = noiseCanvas.getContext('2d');
    const imgData = nctx.createImageData(512, 512);
    const data = imgData.data;

    let seed = 123456789;
    function fastRand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    for (let i = 0; i < 512 * 512; i++) {
      const idx = i * 4;
      const r = fastRand();
      if (r < 0.08) {
        data[idx] = 40;
        data[idx + 1] = 35;
        data[idx + 2] = 30;
        data[idx + 3] = Math.floor(fastRand() * 14);
      } else {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 0;
      }
    }
    nctx.putImageData(imgData, 0, 0);
  }
  return ctx.createPattern(noiseCanvas, 'repeat');
}

// Offscreen buffer for directional motion blur
let motionBlurCanvas = null;
let motionBlurCtx = null;

function applyDirectionalMotionBlur(ctx, width, height, screenVx, screenVy, isWhipPan) {
  const speed = Math.hypot(screenVx || 0, screenVy || 0);
  if (speed < 120 && !isWhipPan) return;

  const smearDist = Math.min(32, speed * 0.012);
  if (smearDist < 1.5) return;

  if (!motionBlurCanvas) {
    motionBlurCanvas = document.createElement('canvas');
    motionBlurCanvas.width = width;
    motionBlurCanvas.height = height;
    motionBlurCtx = motionBlurCanvas.getContext('2d');
  }

  motionBlurCtx.clearRect(0, 0, width, height);
  motionBlurCtx.drawImage(ctx.canvas, 0, 0);

  const nx = screenVx / (speed || 1);
  const ny = screenVy / (speed || 1);

  // 3 backward taps along velocity vector to prevent ghosting
  const taps = 3;
  const step = smearDist / taps;
  const tapAlpha = 0.10;

  ctx.save();
  ctx.globalAlpha = tapAlpha;
  for (let i = 1; i <= taps; i++) {
    const ox = nx * step * i;
    const oy = ny * step * i;
    ctx.drawImage(motionBlurCanvas, -ox, -oy);
  }
  ctx.restore();
}

/**
 * Main Frame Render Entrypoint
 * time: current playback time in seconds (float)
 */
export function renderFrame(ctx, t, width = 1920, height = 1080) {
  ctx.save();

  // 1. Get virtual camera state (camX, camY, zoom, screenVx, screenVy, isWhipPan)
  const cam = getCameraState(t);

  // 2. High-Precision Audio Beat Impulse calculation
  const beatImpulse = getRhythmicImpulse(t, 6.0);
  const subBeatImpulse = getSubBeatImpulse(t, 7.0);

  // Section-Adaptive Beat Pulse Intensity
  let pulseScale = 0.010; // Default groove
  if (t < 16.0) {
    // Intro: subtle ambient breathing
    pulseScale = 0.003;
  } else if ((t >= 59.2 && t < 73.8) || (t >= 103.2 && t < 117.7)) {
    // Chorus 1 & 2: deep kick punch with sub-beat bounce
    pulseScale = 0.020;
  } else if (t >= 133.5 && t < 147.0) {
    // Build-up: accelerating crescendo pulse
    pulseScale = 0.014;
  } else if (t >= 147.0 && t < 156.5) {
    // Drop Climax: heavy compression kick
    pulseScale = 0.024;
  } else if (t >= 198.0) {
    // Outro master sheet: calm acoustic resonance
    pulseScale = 0.004;
  }

  // 3. Screen shake on exact 12 EXECUTION stamp impacts (147.0s - 157.0s)
  let shakeX = 0;
  let shakeY = 0;
  const STAMP_HITS = [147.40, 147.80, 148.80, 149.73, 150.60, 151.20, 151.57, 152.50, 153.43, 154.30, 155.50, 156.50];
  if (t >= 147.0 && t < 157.5) {
    for (let i = 0; i < STAMP_HITS.length; i++) {
      const dt = t - STAMP_HITS[i];
      if (dt >= 0 && dt < 0.22) {
        const decay = Math.exp(-16.0 * dt);
        const hitSeed = (i + 1) * 31;
        shakeX += (pseudoRand(hitSeed * 17) - 0.5) * 26.0 * decay;
        shakeY += (pseudoRand(hitSeed * 37) - 0.5) * 26.0 * decay;
      }
    }
  }

  // 4. Clear canvas with dark gray margin
  ctx.fillStyle = '#111214';
  ctx.fillRect(0, 0, width, height);

  // 5. Apply Camera Transform with section-adaptive beat pulse, Dutch angle rotation & hit screen shake
  const pulseZoom = 1.0 + pulseScale * beatImpulse + (pulseScale > 0.015 ? 0.006 * subBeatImpulse : 0);
  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  if (cam.rot) {
    ctx.rotate(cam.rot);
  }
  ctx.scale(cam.zoom * pulseZoom, cam.zoom * pulseZoom);
  ctx.translate(-cam.x, -cam.y);

  // 5. Render Master Sheet
  renderMasterSheet(ctx, t);

  ctx.restore();

  // 5.5 Directional Motion Blur on Camera Whip Pans
  applyDirectionalMotionBlur(ctx, width, height, cam.screenVx, cam.screenVy, cam.isWhipPan);

  // 5.6 Vocaloid Screen-Space Kinetic FX (Typography, Hazard Tapes, Retro OS Dialogs)
  renderVocaloidScreenOverlays(ctx, t, width, height, cam);

  // 6. Apply Paper Grain Overlay
  const pattern = getNoisePattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 7. Subtle Vignette
  ctx.save();
  const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.4, width / 2, height / 2, width * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 8. Vocaloid Transient Inversion Flash (1~2 frames on major musical stabs)
  let isInverting = false;
  const FLASH_TIMESTAMPS = [
    16.83, 20.07, 44.07, 59.20, 73.57, 88.37, 103.20, 117.70, 133.50,
    147.40, 147.80, 148.80, 149.73, 150.60, 151.20, 151.57, 152.50, 153.43, 154.30, 155.50, 156.50,
    158.60, 161.70, 172.50, 179.00
  ];
  for (const ft of FLASH_TIMESTAMPS) {
    const dt = t - ft;
    if (dt >= 0 && dt < 0.038) { // ~2 frames at 60fps
      isInverting = true;
      break;
    }
  }

  if (isInverting) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 9. Chromatic RGB Fringing on Heavy Drops
  if ((t >= 147.0 && t < 156.5) || (t >= 59.2 && t < 61.2)) {
    const imp = getRhythmicImpulse(t, 8.0);
    if (imp > 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.14 * imp;
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-5, 0, width, height);
      ctx.fillStyle = '#FF0077';
      ctx.fillRect(5, 0, width, height);
      ctx.restore();
    }
  }

  ctx.restore();
}
