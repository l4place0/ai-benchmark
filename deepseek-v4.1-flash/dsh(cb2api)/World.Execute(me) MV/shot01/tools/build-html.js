// Build a single self-contained render.html by inlining all JS + timeline JSON.
const fs = require('fs');
const path = require('path');
const BASE = path.resolve(__dirname, '..');
const SRC = path.join(BASE, 'src');

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const core = read('core.js').replace(/if \(typeof module[\s\S]*$/, '');
const gl = read('gl.js').replace(/if \(typeof module[\s\S]*$/, '');
const scenes = read('scenes.js').replace(/if \(typeof module[\s\S]*$/, '');
const main = read('main.js');
// Rebuild the timeline inline (do NOT depend on a file on disk that may be
// clobbered between steps by an external sync process).
const { buildTimeline } = require('./timeline-data');
const timeline = JSON.stringify(buildTimeline(), null, 1);

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>THE INSTRUMENT</title>
<style>
  html,body{margin:0;padding:0;background:#000;overflow:hidden;width:1920px;height:1080px}
  #out{display:block;width:1920px;height:1080px}
  #err{position:fixed;left:0;top:0;color:#f66;font:14px monospace;white-space:pre-wrap;z-index:99}
</style></head>
<body>
<canvas id="out"></canvas>
<div id="err"></div>
<script>
window.TIMELINE = ${timeline};
</script>
<script>
/* ---- core.js ---- */
(function(){
${core}
Object.assign(window, {TAU,hash11,hash21,hash31,smooth,lerp,clamp,sat,mix,vnoise,fbm,ease,rgb,mixc,scalec,addc,css,PAL,makeCam,makeOrbitCam,phyllotaxis,beatPulse,barPulse});
})();
/* ---- gl.js ---- */
(function(){
${gl}
window.GL = GL;
})();
/* ---- scenes.js ---- */
(function(){
${scenes}
Object.assign(window, {drawPointsLattice, drawLatticeWeb, drawCore, drawEye, ring3D, drawText, typeOut, bgGradient, bgRadial, simulationGrid, dataRain});
})();
/* ---- main.js ---- */
window.addEventListener('error', e => { document.getElementById('err').textContent = String(e.error && e.error.stack || e.message); });
try {
${main}
} catch(e){ document.getElementById('err').textContent = String(e.stack||e); window.__ERROR = String(e.stack||e); }
</script>
</body></html>`;

fs.writeFileSync(path.join(BASE, 'render.html'), html);
console.log('wrote render.html', (html.length / 1024).toFixed(1), 'KB');
