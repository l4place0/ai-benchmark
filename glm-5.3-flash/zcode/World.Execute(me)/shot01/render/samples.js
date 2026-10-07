// samples.js — render key frames to PNG files for visual QA
const fs = require('fs');
const { SAMPLES } = require('./paths');
const TIMES = [0.3, 3.2, 6.5, 9.2, 12.5, 16.15, 20.4, 25, 33.5, 45.2, 55, 62.3, 70.2, 80.5,
  92, 100.5, 106.5, 112.8, 120.3, 127.5, 132.3, 140.2, 146, 149.2, 153.5, 159.3, 162.8,
  170.4, 180.2, 190, 200.5, 205.95, 207.8, 210.3, 213.6, 216.8];
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
