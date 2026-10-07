// full.js — spawn ffmpeg, pipe PNG frames into it (h264 + aac, apad to MV length)
const { spawn } = require('child_process');
const fs = require('fs');
const { FFMPEG, AUDIO, OUT } = require('./paths');
function startFFmpeg(dur) {
  fs.mkdirSync(OUT, { recursive: true });
  const out = OUT + '/world.execute(me)_fanMV_1080p60.mp4';
  const args = ['-y', '-f', 'image2pipe', '-framerate', '60', '-i', '-',
    '-i', AUDIO, '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', String(dur),
    '-movflags', '+faststart', out];
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  ff.stderr.on('data', d => { err += d; if (err.length > 8000) err = err.slice(-4000); });
  return { ff, out, getErr: () => err };
}
module.exports = { startFFmpeg };
