import fs from 'fs';
import { CAMERA_SHOTS, BEAT_INTERVAL, BPM } from '../js/timeline.js';

const fd = fs.openSync('assets/audio/audio.wav', 'r');
const sampleRate = 48000;

function getAudioProfile(centerT, windowSec = 0.6) {
  const startT = Math.max(0, centerT - windowSec);
  const endT = centerT + windowSec;
  const startSamp = Math.floor(startT * sampleRate);
  const endSamp = Math.floor(endT * sampleRate);
  const count = endSamp - startSamp;
  const buf = Buffer.alloc(count * 4);
  fs.readSync(fd, buf, 0, count * 4, 44 + startSamp * 4);

  // 10ms hop
  const hop = 480;
  const win = 960;
  const points = [];
  for (let i = 0; i <= count - win; i += hop) {
    let sum = 0;
    let maxAmp = 0;
    for (let j = 0; j < win; j++) {
      const left = Math.abs(buf.readInt16LE((i + j) * 4));
      const right = Math.abs(buf.readInt16LE((i + j) * 4 + 2));
      const amp = Math.max(left, right);
      sum += amp * amp;
      if (amp > maxAmp) maxAmp = amp;
    }
    const rms = Math.sqrt(sum / win);
    const t = startT + (i + win / 2) / sampleRate;
    points.push({ t, rms, maxAmp });
  }

  // Find transient spikes (onset)
  let bestT = centerT;
  let maxDelta = -1;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].rms - points[i - 1].rms;
    if (delta > maxDelta) {
      maxDelta = delta;
      bestT = points[i].t;
    }
  }

  // Also find peak amplitude
  let peakAmpT = centerT;
  let peakVal = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].maxAmp > peakVal) {
      peakVal = points[i].maxAmp;
      peakAmpT = points[i].t;
    }
  }

  return { onsetT: bestT, peakAmpT, points };
}

const targetCuts = JSON.parse(fs.readFileSync('target_cuts.json', 'utf8'));

const checklist = [
  { id: 1, name: 'First title stab after intro macro pull-back', expectedT: 16.83 },
  { id: 2, name: 'Verse 1 "GodDrinksJava" entry', expectedT: 20.07 },
  { id: 3, name: 'Verse 2 "Instances" entry', expectedT: 29.30 },
  { id: 4, name: '"Switch my current"', expectedT: 44.07 },
  { id: 5, name: 'Chorus 1 "Stimulations" drop', expectedT: 59.20 },
  { id: 6, name: 'Verse 4 "Nutrients / Eggplant"', expectedT: 73.80 },
  { id: 7, name: 'Verse 5 "Switch my gender"', expectedT: 88.40 },
  { id: 8, name: 'Chorus 2 "Vibrations"', expectedT: 103.20 },
  { id: 9, name: 'Bridge 1 "Memory map"', expectedT: 117.70 },
  { id: 10, name: 'Build-up "Replication 40 copies"', expectedT: 133.50 },
  { id: 11, name: 'Drop Climax 1 "EXECUTION" 12-hit stamps', expectedT: 147.00 },
  { id: 12, name: '"EIN DOS TROIS"', expectedT: 155.00 },
  { id: 13, name: '"If I can give them all the execution"', expectedT: 162.53 },
  { id: 14, name: 'Outro "Chapter 1"', expectedT: 179.00 },
  { id: 15, name: '"Examination"', expectedT: 180.80 },
  { id: 16, name: '"Algebraic expression"', expectedT: 184.60 },
  { id: 17, name: 'Grand Finale "And let\'s begin the simulation"', expectedT: 198.00 }
];

console.log('--- DETAILED MULTI-MODAL AUDIT REPORT ---');
const results = [];

for (const c of checklist) {
  // Audio onset
  const audio = getAudioProfile(c.expectedT, 0.4);

  // Video cut
  const nearCuts = targetCuts.filter(tc => Math.abs(tc - c.expectedT) < 0.6);
  let bestCut = null;
  let minDiffCut = 999;
  for (const tc of nearCuts) {
    if (Math.abs(tc - c.expectedT) < minDiffCut) {
      minDiffCut = Math.abs(tc - c.expectedT);
      bestCut = tc;
    }
  }

  // Timeline shot
  const shot = CAMERA_SHOTS.find(s => Math.abs(s.t - c.expectedT) < 0.6);

  results.push({
    id: c.id,
    name: c.name,
    expectedT: c.expectedT,
    audioOnsetT: audio.onsetT,
    audioPeakT: audio.peakAmpT,
    videoCutT: bestCut,
    timelineShot: shot ? {
      t: shot.t,
      transition: shot.transition ? shot.transition.type : 'cut',
      duration: shot.transition ? shot.transition.duration || 0 : 0,
      startTime: shot.t - (shot.transition ? shot.transition.duration || 0 : 0)
    } : null
  });
}

console.log(JSON.stringify(results, null, 2));

fs.closeSync(fd);
