/**
 * Mili - world.execute(me);
 * High-Precision Rhythmic Timeline, Camera Choreography & Beat Snapping
 * Reconstructed with exact 145.5 BPM beat alignment and hard-cut jump frames.
 */

export const SONG_DURATION = 212.35;
export const TOTAL_DURATION = 213.0;
export const BPM = 145.5;
export const BEAT_INTERVAL = 60 / BPM; // ~0.412371134 seconds
export const AUDIO_OFFSET = 0.1300; // Exact audio waveform onset delay in seconds

/**
 * Get continuous beat index (0.0 at first downbeat)
 */
export function getMusicBeat(t) {
  return (t - AUDIO_OFFSET) / BEAT_INTERVAL;
}

/**
 * Get fractional phase in current beat: [0, 1)
 */
export function getBeatPhase(t) {
  const beat = getMusicBeat(t);
  return beat >= 0 ? beat - Math.floor(beat) : (beat % 1 + 1) % 1;
}

/**
 * Sharp rhythmic impulse with exponential attack & decay: [0, 1]
 */
export function getRhythmicImpulse(t, decayRate = 6.0) {
  const phase = getBeatPhase(t);
  return Math.exp(-decayRate * phase);
}

/**
 * Sub-beat impulse (8th note / half beat): [0, 1]
 */
export function getSubBeatImpulse(t, decayRate = 7.0) {
  const phase = getBeatPhase(t);
  const subPhase = (phase * 2) % 1.0;
  return Math.exp(-decayRate * subPhase);
}

/**
 * 16th-note impulse (quarter beat): [0, 1]
 */
export function getSixteenthImpulse(t, decayRate = 8.0) {
  const phase = getBeatPhase(t);
  const sixteenthPhase = (phase * 4) % 1.0;
  return Math.exp(-decayRate * sixteenthPhase);
}

/**
 * Get bar phase (4 beats per bar): [0, 1)
 */
export function getBarPhase(t) {
  const beat = getMusicBeat(t);
  const bar = beat / 4;
  return bar >= 0 ? bar - Math.floor(bar) : (bar % 1 + 1) % 1;
}

// 5x4 Grid Geometry on 1920x1080 master imposition sheet
export const GRID = {
  sheetWidth: 1920,
  sheetHeight: 1080,
  startX: 60,
  startY: 150,
  cardWidth: 360,
  cardHeight: 210,
  cols: 5,
  rows: 4
};

// Rectangles for all 17 cards:
export const CARD_RECTS = [
  // Row 0
  { id: 0, x: 60 + 0 * 360, y: 150 + 0 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 1, x: 60 + 1 * 360, y: 150 + 0 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 2, x: 60 + 2 * 360, y: 150 + 0 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 3, x: 60 + 3 * 360, y: 150 + 0 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 4, x: 60 + 4 * 360, y: 150 + 0 * 210, w: 360, h: 210, colSpan: 1 },
  // Row 1
  { id: 5, x: 60 + 0 * 360, y: 150 + 1 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 6, x: 60 + 1 * 360, y: 150 + 1 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 7, x: 60 + 2 * 360, y: 150 + 1 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 8, x: 60 + 3 * 360, y: 150 + 1 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 9, x: 60 + 4 * 360, y: 150 + 1 * 210, w: 360, h: 210, colSpan: 1 },
  // Row 2
  { id: 10, x: 60 + 0 * 360, y: 150 + 2 * 210, w: 720, h: 210, colSpan: 2 },
  { id: 11, x: 60 + 2 * 360, y: 150 + 2 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 12, x: 60 + 3 * 360, y: 150 + 2 * 210, w: 720, h: 210, colSpan: 2 },
  // Row 3
  { id: 13, x: 60 + 0 * 360, y: 150 + 3 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 14, x: 60 + 1 * 360, y: 150 + 3 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 15, x: 60 + 2 * 360, y: 150 + 3 * 210, w: 360, h: 210, colSpan: 1 },
  { id: 16, x: 60 + 3 * 360, y: 150 + 3 * 210, w: 720, h: 210, colSpan: 2 }
];

export function getCardCenter(index) {
  const r = CARD_RECTS[index];
  return {
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
    rect: r
  };
}

/**
 * Camera Shot Definitions with Spatial Transitions
 * 
 * Each shot defines:
 * - t: target arrival timestamp (seconds)
 * - x, y, zoom: camera target position and scale
 * - transition:
 *     - type: 'cut' | 'whip_pan' | 'ease' | 'zoom_dive'
 *     - duration: seconds prior to t where transition takes place
 */
export const CAMERA_SHOTS = [
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // INTRO: Card 0 (0.00s - 16.00s)
  // -------------------------------------------------------------
  { t: 0.00, x: 105, y: 172, zoom: 18.0, rot: 0.0, transition: { type: 'cut' } },
  { t: 1.74, x: 200, y: 172, zoom: 13.5, rot: 0.0, transition: { type: 'cut' } },
  { t: 3.10, x: 235, y: 172, zoom: 10.5, rot: 0.0, transition: { type: 'cut' } },
  { t: 3.87, x: 140, y: 220, zoom: 32 / 3, rot: 0.0, transition: { type: 'cut' } },
  { t: 4.25, x: 140, y: 280, zoom: 32 / 3, rot: 0.0, transition: { type: 'cut' } }, // Pink house drops & lands
  { t: 6.43, x: 140, y: 280, zoom: 32 / 3, rot: 0.0, transition: { type: 'cut' } },
  { t: 7.44, x: 300, y: 280, zoom: 32 / 3, rot: 0.0, transition: { type: 'cut' } }, // Table 1.1 parameters
  { t: 10.80, x: 240, y: 255, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // Full Card 0

  // Macro Pull-Back: Card 0 -> Full 5x4 Master Sheet (completes at 12.0s)
  { t: 12.00, x: 960, y: 540, zoom: 0.88, rot: 0.0, transition: { type: 'ease', duration: 1.20 } },

  // Title Banner & Stabs (16.83s - 20.07s)
  { t: 16.83, x: 960, y: 110, zoom: 1.8, rot: -0.04, transition: { type: 'cut' } },
  { t: 18.23, x: 750, y: 110, zoom: 3.5, rot: 0.05, transition: { type: 'cut' } },
  { t: 19.17, x: 1540, y: 105, zoom: 4.2, rot: -0.05, transition: { type: 'cut' } }, // Zoom into (me);

  // -------------------------------------------------------------
  // VERSE 1: Row 0, Card 1 GodDrinksJava (20.07s - 28.85s)
  // -------------------------------------------------------------
  { t: 20.07, x: 600, y: 255, zoom: 16 / 3, rot: -0.06, transition: { type: 'cut' } },
  { t: 23.73, x: 540, y: 290, zoom: 7.5, rot: 0.05, transition: { type: 'cut' } }, // Left house
  { t: 24.20, x: 660, y: 290, zoom: 7.5, rot: -0.05, transition: { type: 'cut' } }, // Right house
  { t: 24.67, x: 600, y: 270, zoom: 6.5, rot: 0.06, transition: { type: 'cut' } }, // Arc apex
  { t: 25.13, x: 720, y: 255, zoom: 7.5, rot: -0.06, transition: { type: 'cut' } }, // Gravity vector g
  { t: 25.60, x: 600, y: 255, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } },
  { t: 27.20, x: 600, y: 285, zoom: 6.0, rot: -0.04, transition: { type: 'cut' } },
  { t: 28.13, x: 600, y: 255, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } },

  // -------------------------------------------------------------
  // VERSE 2: Row 0, Card 2 Instances 4 Quadrants (29.30s - 43.80s)
  // TRANSITION Card 1 -> Card 2: Rapid horizontal whip pan (28.85s -> 29.30s, 0.45s)
  // -------------------------------------------------------------
  { t: 29.30, x: 872, y: 202.5, zoom: 32 / 3, rot: 0.08, transition: { type: 'whip_pan', duration: 0.45 } }, // Q1 PointSet
  { t: 33.20, x: 872, y: 307.5, zoom: 32 / 3, rot: -0.08, transition: { type: 'cut' } }, // Q2 Circle
  { t: 36.33, x: 1050, y: 202.5, zoom: 32 / 3, rot: 0.09, transition: { type: 'cut' } }, // Q3 Sine Wave / Tangents
  { t: 40.80, x: 1050, y: 307.5, zoom: 32 / 3, rot: -0.09, transition: { type: 'cut' } }, // Q4 Sequence / Limitations
  { t: 43.60, x: 960, y: 255, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // All 4 quadrants

  // -------------------------------------------------------------
  // VERSE 3: Row 0, Card 3 Electricity & Carts (44.07s - 58.60s)
  // TRANSITION Card 2 -> Card 3: Rapid horizontal whip pan (43.72s -> 44.07s, 0.35s)
  // -------------------------------------------------------------
  { t: 44.07, x: 1230, y: 202.5, zoom: 32 / 3, rot: 0.12, transition: { type: 'whip_pan', duration: 0.35 } }, // Q1 Oscilloscope
  { t: 48.23, x: 1410, y: 202.5, zoom: 32 / 3, rot: -0.10, transition: { type: 'cut' } }, // Q2 Compass / Fig 4.2
  { t: 51.50, x: 1410, y: 307.5, zoom: 32 / 3, rot: 0.14, transition: { type: 'cut' } }, // Q4 Cart 2016 AD
  { t: 55.00, x: 1230, y: 307.5, zoom: 32 / 3, rot: -0.12, transition: { type: 'cut' } }, // Q3 Cart 3691 BC
  // Match-cut zoom dive into the cart void (58.60s -> 59.20s, 0.60s)
  { t: 59.20, x: 1230, y: 307.5, zoom: 35.0, rot: 0.20, transition: { type: 'zoom_dive', duration: 0.60 } },

  // -------------------------------------------------------------
  // CHORUS 1: Row 0, Card 4 Stimulations & Satisfaction (59.20s - 73.30s)
  // -------------------------------------------------------------
  { t: 59.20, x: 1590, y: 202.5, zoom: 32 / 3, rot: -0.12, transition: { type: 'cut' } }, // Q1 Gauges 04 & 07
  { t: 63.50, x: 1770, y: 202.5, zoom: 32 / 3, rot: 0.10, transition: { type: 'cut' } }, // Q2 Hourglass Fig 5.2
  { t: 67.00, x: 1590, y: 307.5, zoom: 32 / 3, rot: -0.09, transition: { type: 'cut' } }, // Q3 Checkbox & Happy
  { t: 70.50, x: 1770, y: 307.5, zoom: 32 / 3, rot: 0.09, transition: { type: 'cut' } }, // Q4 SATISFACTION
  { t: 72.80, x: 1680, y: 255, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // Full Card 4 SIMULATION

  // -------------------------------------------------------------
  // VERSE 4: Row 1, Card 5 Biological Assays (73.57s - 87.80s)
  // TRANSITION Row 0 -> Row 1 Carriage Return: Diagonal whip pan across sheet (73.07s -> 73.57s, 0.50s)
  // -------------------------------------------------------------
  { t: 73.57, x: 150, y: 412.5, zoom: 32 / 3, rot: 0.08, transition: { type: 'whip_pan', duration: 0.50 } }, // Q1 Eggplant
  { t: 77.43, x: 330, y: 412.5, zoom: 32 / 3, rot: -0.08, transition: { type: 'cut' } }, // Q2 Tomato
  { t: 81.10, x: 150, y: 517.5, zoom: 32 / 3, rot: 0.10, transition: { type: 'cut' } }, // Q3 Tabby Cat
  { t: 84.43, x: 330, y: 517.5, zoom: 32 / 3, rot: -0.10, transition: { type: 'cut' } }, // Q4 Theorem God
  { t: 87.80, x: 240, y: 465, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // All 4 assays

  // -------------------------------------------------------------
  // VERSE 5: Row 1, Card 6 Gender & Roles (88.37s - 102.80s)
  // TRANSITION Card 5 -> Card 6: Horizontal whip pan (87.97s -> 88.37s, 0.40s)
  // -------------------------------------------------------------
  { t: 88.37, x: 510, y: 412.5, zoom: 32 / 3, rot: 0.12, transition: { type: 'whip_pan', duration: 0.40 } }, // Q1 Split-flap
  { t: 92.00, x: 690, y: 412.5, zoom: 32 / 3, rot: -0.10, transition: { type: 'cut' } }, // Q2 24h Clock
  { t: 95.70, x: 510, y: 517.5, zoom: 32 / 3, rot: 0.12, transition: { type: 'cut' } }, // Q3 S & M houses
  { t: 99.20, x: 690, y: 517.5, zoom: 32 / 3, rot: -0.12, transition: { type: 'cut' } }, // Q4 Moire Loupe
  { t: 102.50, x: 600, y: 465, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // Full Card 6

  // -------------------------------------------------------------
  // CHORUS 2: Row 1, Card 7 Completion & Vibrations (103.20s - 117.20s)
  // TRANSITION Card 6 -> Card 7: Horizontal whip pan (102.80s -> 103.20s, 0.40s)
  // -------------------------------------------------------------
  { t: 103.20, x: 960, y: 465, zoom: 16 / 3, rot: -0.12, transition: { type: 'whip_pan', duration: 0.40 } }, // Full Card 7 Rings
  { t: 106.30, x: 960, y: 465, zoom: 16 / 3, rot: 0.10, transition: { type: 'cut' } },
  { t: 110.00, x: 960, y: 465, zoom: 16 / 3, rot: 0.0, transition: { type: 'cut' } }, // Blue Tape & Erasure

  // -------------------------------------------------------------
  // BRIDGE 1: Row 1, Card 8 Memory Map (117.70s - 133.00s)
  // TRANSITION Card 7 -> Card 8: Horizontal whip pan (117.20s -> 117.70s, 0.50s)
  // -------------------------------------------------------------
  { t: 117.70, x: 1320, y: 465, zoom: 16 / 3, rot: -0.08, transition: { type: 'whip_pan', duration: 0.50 } },
  { t: 126.00, x: 1320, y: 465, zoom: 7.2, rot: 0.06, transition: { type: 'cut' } }, // YOU ARE HERE pin
  { t: 130.00, x: 1320, y: 465, zoom: 16 / 3, rot: -0.14, transition: { type: 'cut' } }, // Fatal Illegal Arguments

  // -------------------------------------------------------------
  // BUILD-UP: Row 1, Card 9 Replication 40-Copies (133.50s - 146.50s)
  // TRANSITION Card 8 -> Card 9: Horizontal whip pan (133.00s -> 133.50s, 0.50s)
  // -------------------------------------------------------------
  { t: 133.50, x: 1680, y: 465, zoom: 7.5, rot: 0.10, transition: { type: 'whip_pan', duration: 0.50 } },
  { t: 144.00, x: 1680, y: 465, zoom: 16 / 3, rot: -0.06, transition: { type: 'ease', duration: 0.80 } },

  // -------------------------------------------------------------
  // DROP CLIMAX 1: Row 2, Card 10 Double EXECUTION Stamps (147.00s - 158.60s)
  // TRANSITION Row 1 -> Row 2 Carriage Return: Slam down-left (146.50s -> 147.00s, 0.50s)
  // -------------------------------------------------------------
  { t: 147.00, x: 240, y: 675, zoom: 16 / 3, rot: -0.15, transition: { type: 'whip_pan', duration: 0.50 } }, // Screen 1 of Card 10 (01/12..04/12)
  { t: 151.20, x: 600, y: 675, zoom: 16 / 3, rot: 0.15, transition: { type: 'cut' } }, // Screen 2 of Card 10 (05/12..08/12)
  { t: 154.50, x: 420, y: 675, zoom: 8 / 3, rot: -0.08, transition: { type: 'ease', duration: 0.80 } }, // 2x2 group with massive black stamps
  { t: 157.50, x: 420, y: 675, zoom: 16 / 3, rot: 0.12, transition: { type: 'cut' } }, // Inverted black screen 抹殺·死刑

  // -------------------------------------------------------------
  // DROP CLIMAX 2: Row 2, Card 11 Chalkboard Countdown (158.60s - 162.53s)
  // TRANSITION Card 10 -> Card 11: Instant cut on beat at 158.60s
  // -------------------------------------------------------------
  { t: 158.60, x: 960, y: 675, zoom: 16 / 3, rot: -0.10, transition: { type: 'cut' } }, // Chalkboard EIN DOS TROIS
  { t: 161.70, x: 960, y: 675, zoom: 16 / 3, rot: 0.08, transition: { type: 'cut' } }, // Bottom white EXECUTION

  // -------------------------------------------------------------
  // TERMINAL PURGE: Row 2, Card 12 Double Terminal (162.53s - 178.50s)
  // TRANSITION Card 11 -> Card 12: Horizontal whip pan (162.20s -> 162.53s, 0.33s)
  // -------------------------------------------------------------
  { t: 162.53, x: 1320, y: 675, zoom: 16 / 3, rot: -0.08, transition: { type: 'whip_pan', duration: 0.33 } }, // Panel 1 closeup (left edge at 1140)
  { t: 166.82, x: 1535, y: 675, zoom: 16 / 3, rot: 0.0, transition: { type: 'whip_pan', duration: 0.35 } }, // Pan to Panel 2 (parabolic bounce)
  { t: 172.50, x: 1688, y: 675, zoom: 16 / 3, rot: 0.12, transition: { type: 'whip_pan', duration: 0.35 } }, // Pan to Panel 3 (trapped in execution)
  { t: 177.00, x: 1500, y: 675, zoom: 8 / 3, rot: -0.06, transition: { type: 'ease', duration: 0.60 } }, // Pull back to show full Card 12

  // -------------------------------------------------------------
  // OUTRO: Row 3, Cards 13, 14, 15, 16 (179.00s - 213.00s)
  // TRANSITION Row 2 -> Row 3 Carriage Return: Slam down-left (178.50s -> 179.00s, 0.50s)
  // -------------------------------------------------------------
  { t: 179.00, x: 240, y: 885, zoom: 16 / 3, rot: -0.06, transition: { type: 'whip_pan', duration: 0.50 } }, // Card 13 Chapter 1
  { t: 180.80, x: 600, y: 885, zoom: 16 / 3, rot: 0.06, transition: { type: 'whip_pan', duration: 0.40 } }, // Card 14 Examination
  { t: 184.60, x: 960, y: 885, zoom: 16 / 3, rot: -0.06, transition: { type: 'whip_pan', duration: 0.40 } }, // Card 15 Algebraic
  { t: 193.50, x: 960, y: 780, zoom: 3.2, rot: 0.04, transition: { type: 'ease', duration: 0.60 } }, // Stacked Card 11 + Card 15 closeup
  { t: 198.00, x: 960, y: 540, zoom: 0.88, rot: 0.0, transition: { type: 'ease', duration: 0.80 } }, // Pull back to FULL 5x4 MASTER SHEET
  { t: 209.50, x: 960, y: 540, zoom: 0.88, rot: 0.0, transition: { type: 'cut' } }, // Master sheet monochrome finish
  { t: 213.00, x: 960, y: 540, zoom: 0.88, rot: 0.0, transition: { type: 'cut' } }
];

/**
 * Get Virtual Camera State for time t
 * Computes exact spatial interpolation, directional velocity vectors,
 * and tactile mechanical braking rebounds.
 */
export function getCameraState(t) {
  let nextIdx = 0;
  while (nextIdx < CAMERA_SHOTS.length && CAMERA_SHOTS[nextIdx].t <= t) {
    nextIdx++;
  }

  // Before first shot
  if (nextIdx === 0) {
    const s0 = CAMERA_SHOTS[0];
    return { x: s0.x, y: s0.y, zoom: s0.zoom, rot: s0.rot || 0, vx: 0, vy: 0, vz: 0, screenVx: 0, screenVy: 0, isWhipPan: false, isTransition: false };
  }

  const prevShot = CAMERA_SHOTS[nextIdx - 1];

  // After last shot
  if (nextIdx >= CAMERA_SHOTS.length) {
    return { x: prevShot.x, y: prevShot.y, zoom: prevShot.zoom, rot: prevShot.rot || 0, vx: 0, vy: 0, vz: 0, screenVx: 0, screenVy: 0, isWhipPan: false, isTransition: false };
  }

  const targetShot = CAMERA_SHOTS[nextIdx];
  const tr = targetShot.transition;

  // Check if we are inside a transition window entering targetShot
  if (tr && tr.type && tr.type !== 'cut' && tr.duration > 0) {
    const startTime = targetShot.t - tr.duration;
    if (t >= startTime && t < targetShot.t) {
      const p = Math.max(0.0, Math.min(1.0, (t - startTime) / tr.duration));
      let ease = p;
      let dEase_dp = 1;

      if (tr.type === 'whip_pan') {
        // Quintic smoothstep for explosive whip-pan: slow start, extreme velocity at center, smooth snap settle
        // S(p) = 6p^5 - 15p^4 + 10p^3
        ease = p * p * p * (p * (p * 6 - 15) + 10);
        dEase_dp = 30 * p * p * (p - 1) * (p - 1);
      } else if (tr.type === 'zoom_dive') {
        // High power punch-in dive
        ease = Math.pow(p, 3.5);
        dEase_dp = 3.5 * Math.pow(p, 2.5);
      } else {
        // Smooth cubic ease-in-out
        ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        dEase_dp = p < 0.5 ? 12 * p * p : 6 * Math.pow(-2 * p + 2, 2);
      }

      const dx = targetShot.x - prevShot.x;
      const dy = targetShot.y - prevShot.y;
      const dz = targetShot.zoom - prevShot.zoom;
      const dRot = (targetShot.rot || 0) - (prevShot.rot || 0);

      const currentX = prevShot.x + dx * ease;
      const currentY = prevShot.y + dy * ease;
      const currentZoom = prevShot.zoom + dz * ease;
      const currentRot = (prevShot.rot || 0) + dRot * ease;

      const dt = tr.duration;
      const vx = (dx * dEase_dp) / dt;
      const vy = (dy * dEase_dp) / dt;
      const vz = (dz * dEase_dp) / dt;

      return {
        x: currentX,
        y: currentY,
        zoom: currentZoom,
        rot: currentRot,
        vx,
        vy,
        vz,
        screenVx: vx * currentZoom,
        screenVy: vy * currentZoom,
        isWhipPan: tr.type === 'whip_pan',
        isTransition: true,
        transitionProgress: ease
      };
    }
  }

  // Steady hold at prevShot with tactile mechanical braking rebound on whip-pan completion
  let reboundX = 0;
  let reboundY = 0;
  if (prevShot.transition && prevShot.transition.type === 'whip_pan' && nextIdx >= 2) {
    const dtAfter = t - prevShot.t;
    if (dtAfter >= 0 && dtAfter < 0.22) {
      const priorShot = CAMERA_SHOTS[nextIdx - 2];
      const dx = prevShot.x - priorShot.x;
      const dy = prevShot.y - priorShot.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 15) {
        // Highly damped physical rebound spring: snaps into frame with a mechanical shudder
        const rebound = Math.exp(-20.0 * dtAfter) * Math.sin(30.0 * dtAfter) * 0.04;
        reboundX = (dx / dist) * Math.min(20, dist * 0.06) * rebound;
        reboundY = (dy / dist) * Math.min(20, dist * 0.06) * rebound;
      }
    }
  }

  return {
    x: prevShot.x + reboundX,
    y: prevShot.y + reboundY,
    zoom: prevShot.zoom,
    rot: prevShot.rot || 0,
    vx: 0,
    vy: 0,
    vz: 0,
    screenVx: 0,
    screenVy: 0,
    isWhipPan: false,
    isTransition: false
  };
}

export const LYRICS = [
  { start: 0.10, end: 1.74, card: 0, text: "Switch on the power line", sub: "POWER LINE" },
  { start: 1.74, end: 3.87, card: 0, text: "Remember to put on PROTECTION", sub: "PROTECTION" },
  { start: 3.87, end: 5.49, card: 0, text: "Lay down your pieces", sub: "PIECES" },
  { start: 5.49, end: 7.44, card: 0, text: "And let's begin OBJECT CREATION", sub: "OBJECT CREATION" },
  { start: 7.44, end: 11.09, card: 0, text: "Fill in my data parameters / INITIALIZATION", sub: "INITIALIZATION" },
  { start: 11.09, end: 13.89, card: 0, text: "Set up our new world", sub: "NEW WORLD" },
  { start: 13.89, end: 16.00, card: 0, text: "And let's begin the SIMULATION", sub: "SIMULATION" },

  { start: 16.00, end: 29.30, card: 1, text: "GodDrinksJava", sub: "package goddrinksjava;" },

  { start: 29.30, end: 33.20, card: 2, text: "If I'm a set of points, then I will give you my DIMENSION", sub: "DIMENSION" },
  { start: 33.20, end: 36.33, card: 2, text: "If I'm a circle, then I will give you my CIRCUMFERENCE", sub: "CIRCUMFERENCE" },
  { start: 36.33, end: 40.13, card: 2, text: "If I'm a sine wave, then you can sit on all my TANGENTS", sub: "TANGENTS" },
  { start: 40.13, end: 44.07, card: 2, text: "If I approach infinity, then you can be my LIMITATIONS", sub: "LIMITATIONS" },

  { start: 44.07, end: 48.00, card: 3, text: "Switch my current To AC to DC", sub: "AC TO DC" },
  { start: 48.00, end: 51.50, card: 3, text: "And then blind my vision", sub: "BLIND VISION" },
  { start: 51.50, end: 55.00, card: 3, text: "So dizzy so dizzy", sub: "DIZZY" },
  { start: 55.00, end: 59.20, card: 3, text: "Oh we can unite / So deeply so deeply", sub: "UNITE" },

  { start: 59.20, end: 61.10, card: 4, text: "If I can give you all the STIMULATIONS", sub: "STIMULATIONS" },
  { start: 61.10, end: 65.00, card: 4, text: "Then I can be your only SATISFACTION", sub: "SATISFACTION" },
  { start: 65.00, end: 68.50, card: 4, text: "If I can make you happy I will run the EXECUTION", sub: "EXECUTION" },
  { start: 68.50, end: 73.80, card: 4, text: "Though we are trapped in this strange strange SIMULATION", sub: "SIMULATION" },

  { start: 73.80, end: 77.43, card: 5, text: "If I'm an eggplant, then I will give you my NUTRIENTS", sub: "NUTRIENTS" },
  { start: 77.43, end: 81.10, card: 5, text: "If I'm a tomato, then I will give you ANTIOXIDANTS", sub: "ANTIOXIDANTS" },
  { start: 81.10, end: 84.43, card: 5, text: "If I'm a tabby cat, then I will purr for your ENJOYMENT", sub: "ENJOYMENT" },
  { start: 84.43, end: 88.40, card: 5, text: "If I'm the only god, then you're the proof of my EXISTENCE", sub: "EXISTENCE" },

  { start: 88.40, end: 92.03, card: 6, text: "Switch my gender To F to M", sub: "GENDER" },
  { start: 92.03, end: 95.77, card: 6, text: "Do whatever you want to my body", sub: "BODY" },
  { start: 95.77, end: 99.27, card: 6, text: "Oh switch my role To S to M", sub: "ROLE" },
  { start: 99.27, end: 103.20, card: 6, text: "So we can enter the trance the trance", sub: "TRANCE" },

  { start: 103.20, end: 106.30, card: 7, text: "If I can feel your COMPLETION", sub: "COMPLETION" },
  { start: 106.30, end: 110.07, card: 7, text: "Then I can finally be VIBRATIONS", sub: "VIBRATIONS" },
  { start: 110.07, end: 117.70, card: 7, text: "Though you have left me in ISOLATION", sub: "ISOLATION" },

  { start: 117.70, end: 122.00, card: 8, text: "If I can erase all the pointless FRAGMENTS", sub: "FRAGMENTS" },
  { start: 122.00, end: 126.00, card: 8, text: "Then maybe you won't leave me so DISHEARTENED", sub: "DISHEARTENED" },
  { start: 126.00, end: 129.50, card: 8, text: "Challenging your god", sub: "CHALLENGING GOD" },
  { start: 129.50, end: 133.50, card: 8, text: "You have made some ILLEGAL ARGUMENTS", sub: "ILLEGAL ARGUMENTS" },

  { start: 133.50, end: 147.00, card: 9, text: "you x 40 [REPLICATION]", sub: "EXECUTION REPLICATION" },

  { start: 147.00, end: 155.00, card: 10, text: "EXECUTION EXECUTION EXECUTION...", sub: "抹殺·死刑" },

  { start: 155.00, end: 162.53, card: 11, text: "EIN, DOS, TROIS, NE, FEM, LIU, EXECUTION", sub: "COUNTDOWN" },

  { start: 162.53, end: 179.00, card: 12, text: "If I can give them all the EXECUTION... We are trapped ah", sub: "TRAPPED IN EXECUTION" },

  { start: 179.00, end: 180.80, card: 13, text: "I've studied how to properly LO-O-OVE", sub: "CHAPTER 1: LOVE" },

  { start: 180.80, end: 184.60, card: 14, text: "Question me I can answer all", sub: "EXAMINATION: 100" },

  { start: 184.60, end: 198.50, card: 15, text: "I know the algebraic expression of LO-O-OVE", sub: "ALGEBRAIC EXPRESSION" },

  { start: 198.50, end: 212.35, card: 16, text: "world.execute(me);", sub: "TERMINATION" }
];
