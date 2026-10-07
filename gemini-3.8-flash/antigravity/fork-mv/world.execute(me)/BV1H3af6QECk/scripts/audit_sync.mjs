import fs from 'fs';
import { CAMERA_SHOTS, BEAT_INTERVAL, BPM } from '../js/timeline.js';

// Read target cuts
const targetCuts = JSON.parse(fs.readFileSync('target_cuts.json', 'utf8'));

// Key checklist items from user prompt
const checklistItems = [
  { id: 1, name: 'First title stab after intro macro pull-back', t: 16.83 },
  { id: 2, name: 'Verse 1 GodDrinksJava entry', t: 20.07 },
  { id: 3, name: 'Verse 2 Instances entry', t: 29.30 },
  { id: 4, name: 'Switch my current', t: 44.07 },
  { id: 5, name: 'Chorus 1 Stimulations drop', t: 59.20 },
  { id: 6, name: 'Verse 4 Nutrients / Eggplant', t: 73.80 },
  { id: 7, name: 'Verse 5 Switch my gender', t: 88.40 },
  { id: 8, name: 'Chorus 2 Vibrations', t: 103.20 },
  { id: 9, name: 'Bridge 1 Memory map', t: 117.70 },
  { id: 10, name: 'Build-up Replication 40 copies', t: 133.50 },
  { id: 11, name: 'Drop Climax 1 EXECUTION 12-hit stamps', t: 147.00 },
  { id: 12, name: 'EIN DOS TROIS', t: 155.00 },
  { id: 13, name: 'If I can give them all the execution', t: 162.53 },
  { id: 14, name: 'Outro Chapter 1', t: 179.00 },
  { id: 15, name: 'Examination', t: 180.80 },
  { id: 16, name: 'Algebraic expression', t: 184.60 },
  { id: 17, name: 'Grand Finale And lets begin the simulation', t: 198.00 }
];

console.log('=== CHECKLIST AUDIT ===');
for (const item of checklistItems) {
  // Find shot in CAMERA_SHOTS
  const shot = CAMERA_SHOTS.find(s => Math.abs(s.t - item.t) < 0.05);
  // Find nearest target cut
  const cuts = targetCuts.filter(c => Math.abs(c - item.t) < 0.6);
  console.log(`[${item.id}] ${item.name}`);
  console.log(`    Target item.t: ${item.t.toFixed(3)}s`);
  if (shot) {
    const tr = shot.transition || { type: 'cut', duration: 0 };
    console.log(`    CAMERA_SHOT: t=${shot.t.toFixed(3)}s, type=${tr.type}, duration=${tr.duration || 0}s, start=${(shot.t - (tr.duration || 0)).toFixed(3)}s`);
  } else {
    // Check nearest shot
    let nearestShot = null;
    let minD = 999;
    for (const s of CAMERA_SHOTS) {
      const d = Math.abs(s.t - item.t);
      if (d < minD) { minD = d; nearestShot = s; }
    }
    console.log(`    CAMERA_SHOT: NOT EXACT MATCH! Nearest is t=${nearestShot ? nearestShot.t.toFixed(3) : 'none'} (diff: ${minD.toFixed(3)}s)`);
  }
  console.log(`    Target Video Cuts near: ${cuts.map(c => c.toFixed(3)).join(', ') || 'none detected (>0.08)'}`);
}
