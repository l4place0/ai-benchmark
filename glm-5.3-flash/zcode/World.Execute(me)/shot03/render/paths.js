// paths.js — all locations for shot03 renderer
const path = require('path');
const ROOT = path.join(__dirname, '..');
module.exports = {
  ROOT,
  MV: path.join(ROOT, 'mv', 'index.html'),
  AUDIO: path.join(ROOT, 'mv', 'audio', 'song.m4a'),
  FFMPEG: path.join(ROOT, 'tools', 'ffmpeg.exe'),
  FFPROBE: path.join(ROOT, 'tools', 'ffprobe.exe'),
  OUT: path.join(ROOT, 'out'),
  TMP: path.join(__dirname, '.out'),
  SAMPLES: path.join(__dirname, 'samples'),
};
