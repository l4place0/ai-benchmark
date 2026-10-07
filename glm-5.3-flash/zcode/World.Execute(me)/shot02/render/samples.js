// samples.js — render key frames to PNG files for visual QA (take 02 storyboard)
const fs = require('fs');
const { SAMPLES } = require('./paths');
const TIMES = [0.4, 3.2, 6.5, 9.8, 12.5, 14.8, 16.15, 18.5, 23.0, 28.0, 31.0, 36.5, 42.0,
  50.5, 57.5, 62.3, 68.0, 73.0, 77.5, 85.0, 95.0, 101.5, 106.5, 113.5, 120.3, 124.5,
  128.5, 133.5, 142.0, 149.2, 152.0, 156.5, 159.3, 161.2, 165.5, 171.0, 180.2, 187.0,
  190.5, 200.5, 205.95, 207.8, 210.3, 213.6, 216.8];
async function renderSamples(page) {
  fs.mkdirSync(SAMPLES, { recursive: true });
  let n = 0;
  for (const t of TIMES) {
    const url = await page.evaluate(tt => window.__renderFrame(tt), t);
    const name = 't' + t.toFixed(2).padStart(7, '0').replace('.', '_') + '.png';
    fs.writeFileSync(SAMPLES + '/' + name, Buffer.from(url.split(',')[1], 'base64'));
    n++;
  }
  return n;
}
module.exports = { renderSamples, TIMES };
