/* Exhaustive robustness sweep: render EVERY frame time and report the first
   error. This is what catches the crashes that sparse sampling misses.
   Also reports per-section timing and a luminance summary so we can confirm
   the film never goes fully black at the wrong moment. */
'use strict';
const path = require('path');
const { openPage, evaluate, BASE } = require('./preview');

const STEP = parseFloat(process.argv[2] || (1 / 60));   // default: every frame

(async () => {
  const { ws, S, proc } = await openPage();
  await ws.cmd('Page.navigate', { url: 'file:///' + path.join(BASE, 'render.html').replace(/\\/g, '/') }, S);
  await new Promise(r => setTimeout(r, 2500));
  const err0 = await evaluate(ws, S, 'window.__ERROR || ""');
  if (err0) { console.log('PAGE ERROR', err0); process.exit(1); }

  const DUR = await evaluate(ws, S, 'window.__DURATION');
  const total = Math.round(DUR / STEP);
  console.log(`sweeping ${total} frame times at step ${STEP}s (${(1/STEP).toFixed(0)} fps)`);

  // Sweep entirely inside the page: much faster than one RPC per frame.
  const res = await evaluate(ws, S, `
    (function(){
      const DUR = ${DUR}, STEP = ${STEP};
      const total = Math.round(DUR/STEP);
      const errors = [];
      const sectionLum = {};
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 180;       // small: we only need luminance
      const cg = canvas.getContext('2d');
      const t0 = performance.now();
      for (let i = 0; i < total; i++){
        const t = i * STEP;
        try {
          window.__RENDER(t);
        } catch(e){
          if (errors.length < 25) errors.push({frame:i, t:+t.toFixed(4), msg:String(e && e.message || e)});
          continue;
        }
        // sample the output canvas cheaply
        if (i % 12 === 0){
          cg.drawImage(document.getElementById('out'), 0, 0, 320, 180);
          const d = cg.getImageData(0,0,320,180).data;
          let s = 0;
          for (let k = 0; k < d.length; k += 4) s += 0.2126*d[k] + 0.7152*d[k+1] + 0.0722*d[k+2];
          const G = grade(t);
          (sectionLum[G.id] = sectionLum[G.id] || []).push(+(s/(d.length/4)/255).toFixed(4));
        }
      }
      const ms = performance.now() - t0;
      const summary = {};
      for (const k in sectionLum){
        const a = sectionLum[k];
        summary[k] = { n: a.length, min: Math.min(...a), max: Math.max(...a),
                       mean: +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(4) };
      }
      return { errors, total, ms: +ms.toFixed(0), fps: +(total/(ms/1000)).toFixed(1), summary };
    })()`);

  console.log(`swept ${res.total} frames in ${(res.ms/1000).toFixed(1)}s (${res.fps}/s)`);
  if (res.errors.length) {
    console.log(`\n!!! ${res.errors.length} ERRORS:`);
    for (const e of res.errors) console.log(`   frame ${e.frame} t=${e.t}s : ${e.msg}`);
  } else {
    console.log('NO ERRORS across the full film.');
  }
  console.log('\nsection luminance (sampled every 12th frame):');
  for (const k of Object.keys(res.summary)) {
    const s = res.summary[k];
    console.log(`  ${k.padEnd(10)} n=${String(s.n).padStart(4)}  min=${s.min.toFixed(3)}  max=${s.max.toFixed(3)}  mean=${s.mean.toFixed(3)}`);
  }
  ws.sock.end(); proc.kill();
  process.exit(res.errors.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
