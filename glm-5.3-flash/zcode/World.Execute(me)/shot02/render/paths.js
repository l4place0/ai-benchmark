// paths.js — all locations (short module)
const path = require('path');
const ROOT = path.join(__dirname, '..');
module.exports = {
  ROOT,
  MV: path.join(ROOT, 'mv', 'index.html'),
  AUDIO: path.join(ROOT, 'mv', 'audio', 'song.m4a'),
  FFMPEG: path.join(ROOT, 'tools', 'ffmpeg.exe'),
  OUT: path.join(ROOT, 'out'),
  SAMPLES: path.join(__dirname, 'samples')
};
