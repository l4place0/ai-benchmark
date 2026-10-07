// main.js — CLI: node main.js samples | node main.js full
const { launch } = require('./launch');
const { renderSamples } = require('./samples');
const { startFFmpeg } = require('./full');
global.window = {};
require('../mv/timeline.js');
const T = window.MV_TIMELINE;
const FPS = 60;
async function main() {
  const mode = process.argv[2] || 'samples';
  const { browser, page, gpu } = await launch();
  console.log('GPU ' + gpu);
  const test = await page.evaluate('window.__selftest()');
  console.log('SELFTEST same=' + test.same);
  if (mode === 'samples') {
    console.log('SAMPLES ' + await renderSamples(page));
  } else {
    const N = Math.ceil(T.mvDuration * FPS);
    const { ff, out, getErr } = startFFmpeg(T.mvDuration);
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const url = await page.evaluate(tt => window.__renderFrame(tt), i / FPS);
      const ok = ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'));
      if (!ok) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 600 === 0) {
        const el = Math.max(1, (Date.now() - t0) / 1000), fps = i / el;
        console.log('F ' + i + '/' + N + ' ' + fps.toFixed(1) + 'fps eta=' + ((N - i) / fps / 60).toFixed(1) + 'min');
        if (i === 0 && getErr()) console.log('FFERR ' + getErr().slice(0, 400));
      }
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', c => { if (c !== 0) console.log('FFCODE ' + c + ' ' + getErr().slice(-800)); r(); }));
    console.log('DONE ' + out);
  }
  await browser.close();
}
main().catch(e => { console.error('FAIL ' + (e && e.message)); process.exit(1); });
