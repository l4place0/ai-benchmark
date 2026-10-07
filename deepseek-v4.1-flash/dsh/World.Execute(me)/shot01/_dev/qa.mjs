// qa.mjs — verify the finished MV and pull stills out of the actual MP4.
//   node qa.mjs [--file=../out/xxx.mp4] [--sheet=1]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const FILE = resolve(ROOT, opt('file', 'out/world.execute(me)_MV_1080p60.mp4'));
const SONG = 211.906667;

function run(bin, argv) {
  return new Promise((res) => {
    const p = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('exit', c => res({ code: c, out, err }));
  });
}

if (!existsSync(FILE)) { console.error('missing ' + FILE); process.exit(1); }
const size = statSync(FILE).size;
console.log('file      : ' + FILE);
console.log('size      : ' + (size / 1048576).toFixed(1) + ' MB');

const probe = await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', FILE]);
if (probe.code !== 0) { console.error(probe.err); process.exit(1); }
const info = JSON.parse(probe.out);
const v = info.streams.find(s => s.codec_type === 'video');
const a = info.streams.find(s => s.codec_type === 'audio');
const dur = Number(info.format.duration);

const rows = [
  ['duration', dur.toFixed(3) + ' s', dur > SONG ? `> song ${SONG.toFixed(2)}s  OK` : 'TOO SHORT'],
  ['video', `${v.codec_name} ${v.width}x${v.height} @ ${v.r_frame_rate}`, v.width === 1920 && v.height === 1080 ? 'OK' : 'BAD'],
  ['video frames', v.nb_frames, Number(v.nb_frames) === Math.round(dur * 60) ? 'OK' : 'CHECK'],
  ['pix_fmt', v.pix_fmt, v.pix_fmt === 'yuv420p' ? 'OK' : 'CHECK'],
  ['audio', `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch`, 'OK'],
  ['bitrate', ((Number(info.format.bit_rate) || 0) / 1e6).toFixed(2) + ' Mb/s', ''],
];
for (const [k, val, note] of rows) console.log(`${k.padEnd(13)}: ${String(val).padEnd(34)} ${note}`);

// decode-integrity check (count frames actually decoded + look for errors)
console.log('\ndecoding all frames to verify stream integrity…');
const dec = await run('ffmpeg', ['-v', 'error', '-i', FILE, '-f', 'null', '-']);
const errLines = dec.err.trim() ? dec.err.trim().split('\n') : [];
console.log(errLines.length ? 'DECODE ERRORS:\n' + errLines.slice(0, 20).join('\n') : 'no decode errors');

if (args.includes('--sheet')) {
  const dir = join(ROOT, '_dev', 'qa');
  mkdirSync(dir, { recursive: true });
  const times = [1, 8, 20, 32, 46, 61, 76, 90, 105, 118, 133, 150, 158, 168, 180, 190, 200, 214];
  for (const t of times) {
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', FILE, '-frames:v', '1',
      '-vf', 'scale=960:-1', join(dir, `f${String(t).padStart(3, '0')}.png`)]);
  }
  console.log('stills -> ' + dir);
}
