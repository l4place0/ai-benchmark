/* =========================================================================
   Pure Line Room — _tools/api-audit.mjs
   The offscreen harness records Canvas2D calls instead of executing them, so
   a context method that does not exist in a real browser would slip through.
   This walks the engine and object modules and reports every property touched
   on the context object, then checks it against the real CanvasRenderingContext2D
   surface, flagging anything unknown.
   ========================================================================= */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/* The standard CanvasRenderingContext2D surface (properties + methods). */
const REAL = new Set([
  // state
  'canvas', 'save', 'restore', 'reset', 'isContextLost',
  // transforms
  'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform',
  'getTransform', 'setLineDash', 'getLineDash',
  // style
  'globalAlpha', 'globalCompositeOperation', 'filter', 'imageSmoothingEnabled',
  'imageSmoothingQuality', 'strokeStyle', 'fillStyle', 'createLinearGradient',
  'createRadialGradient', 'createConicGradient', 'createPattern', 'shadowOffsetX',
  'shadowOffsetY', 'shadowBlur', 'shadowColor', 'lineWidth', 'lineCap', 'lineJoin',
  'miterLimit', 'lineDashOffset', 'font', 'textAlign', 'textBaseline',
  'direction', 'letterSpacing', 'fontKerning', 'fontStretch', 'fontVariantCaps',
  'textRendering', 'wordSpacing',
  // paths
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  // drawing
  'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText',
  'strokeText', 'measureText', 'drawImage', 'createImageData', 'getImageData',
  'putImageData', 'drawFocusIfNeeded', 'getContextAttributes',
]);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js')) files.push(p);
  }
})(join(ROOT, 'js'));

/* Web Audio surface (the audio module also uses a variable named ctx). */
const AUDIO = new Set([
  'currentTime', 'state', 'resume', 'suspend', 'close', 'destination', 'sampleRate',
  'baseLatency', 'outputLatency', 'listener', 'createGain', 'createOscillator',
  'createBufferSource', 'createBuffer', 'createBiquadFilter', 'createDynamicsCompressor',
  'createDelay', 'createConvolver', 'createWaveShaper', 'createStereoPanner',
  'createChannelMerger', 'createChannelSplitter', 'createAnalyser', 'createPeriodicWave',
  'createConstantSource', 'createPanner', 'createScriptProcessor', 'createMediaStreamSource',
  'decodeAudioData', 'audioWorklet', 'createIIRFilter',
]);

const canvasUsed = new Map();
const audioUsed = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const rel = relative(ROOT, f);
  const isAudioModule = /audio\.js$/.test(f);
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    const re = /\b(?:ctx\d?|context|c2|cx)\.([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(line))) {
      const bucket = isAudioModule ? audioUsed : canvasUsed;
      if (!bucket.has(m[1])) bucket.set(m[1], rel + ':' + (i + 1));
    }
    const re2 = /\bo\.ctx\.([A-Za-z_$][\w$]*)/g;
    while ((m = re2.exec(line))) {
      if (!canvasUsed.has(m[1])) canvasUsed.set(m[1], rel + ':' + (i + 1));
    }
  });
}

const unknown = [];
for (const [name, where] of canvasUsed) {
  if (!REAL.has(name)) unknown.push('canvas: ' + name + '  (' + where + ')');
}
for (const [name, where] of audioUsed) {
  if (!AUDIO.has(name)) unknown.push('audio: ' + name + '  (' + where + ')');
}

console.log('canvas members used: ' + canvasUsed.size);
console.log('audio  members used: ' + audioUsed.size);
console.log('recognised         : ' + (canvasUsed.size + audioUsed.size - unknown.length));
if (unknown.length) {
  console.log('');
  console.log('UNRECOGNISED (verify these exist in the target browser):');
  for (const u of unknown) console.log('  ' + u);
  process.exit(1);
}
console.log('');
console.log('API CLEAN: every canvas and Web Audio member used is part of the standard surface.');
