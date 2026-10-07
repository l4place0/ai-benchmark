import { execSync } from 'child_process';
import fs from 'fs';

if (!fs.existsSync('target_frames/dense')) {
  fs.mkdirSync('target_frames/dense', { recursive: true });
}

console.log('Extracting dense frames every 4 seconds...');
for (let s = 0; s <= 212; s += 4) {
  const file = `target_frames/dense/f_${String(s).padStart(3, '0')}s.jpg`;
  if (!fs.existsSync(file)) {
    try {
      execSync(`ffmpeg -ss ${s} -i target_video.mp4 -frames:v 1 -q:v 2 "${file}" -y`, { stdio: 'ignore' });
    } catch (e) {
      console.error('Error extracting at', s, e.message);
    }
  }
}
console.log('Finished extracting dense frames!');
