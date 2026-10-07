import { spawn } from 'child_process';
import fs from 'fs';

console.log('Spawning ffmpeg to detect scene changes...');
const ffmpeg = spawn('ffmpeg', [
  '-i', 'target_video.mp4',
  '-filter:v', 'select=gt(scene\\,0.08),showinfo',
  '-f', 'null',
  '-'
]);

let fullOutput = '';
ffmpeg.stderr.on('data', (d) => {
  fullOutput += d.toString();
});

ffmpeg.on('close', (code) => {
  console.log('FFmpeg closed with code:', code);
  const cuts = [];
  const regex = /pts_time:([0-9\.]+)/g;
  let match;
  while ((match = regex.exec(fullOutput)) !== null) {
    cuts.push(parseFloat(match[1]));
  }
  console.log(`Detected ${cuts.length} cuts.`);
  fs.writeFileSync('target_cuts.json', JSON.stringify(cuts, null, 2));
  console.log('First 40 cuts:', cuts.slice(0, 40).map(c => c.toFixed(2)).join(', '));
});
