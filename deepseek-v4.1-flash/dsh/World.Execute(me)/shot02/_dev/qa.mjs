// qa.mjs — check the delivered file actually is what it claims to be.
//
//   node _dev/qa.mjs [--file=out/....mp4] [--frames=_dev/qa/final]
//
// Verifies container/stream properties, that the picture covers the whole song,
// and decodes every frame to prove the bitstream is intact.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

const FILE = path.resolve(ROOT, opt('file', 'out/world.execute(me)_MV_1080p60.mp4'));
const SHOTS = opt('frames', '');
const WANT = { w: 1920, h: 1080, fps: 60 };

function ffprobe(args) {
  return new Promise((res) => {
    const p = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('exit', (c) => res({ code: c, out, err }));
  });
}

/** Full decode pass — ffprobe cannot write to the null muxer, so use ffmpeg. */
function ffdecode(file) {
  return new Promise((res) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('exit', (c) => res({ code: c, err }));
  });
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${name.padEnd(16)} ${detail}`);
};

if (!fs.existsSync(FILE)) {
  console.error('missing ' + FILE);
  process.exit(1);
}
const size = fs.statSync(FILE).size;
const songDur = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/analysis.json'), 'utf8')).duration; }
  catch { return 0; }
})();

console.log(`file   ${path.relative(ROOT, FILE)}`);
console.log(`size   ${(size / 1048576).toFixed(1)} MB`);
console.log('');

const { out } = await ffprobe([
  '-v', 'error', '-show_entries',
  'format=duration,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt,sample_rate,channels,profile,level',
  '-of', 'json', FILE,
]);
const info = JSON.parse(out);
const fmt = info.format;
const v = info.streams.find((s) => s.codec_type === 'video');
const a = info.streams.find((s) => s.codec_type === 'audio');
const dur = Number(fmt.duration);
const frames = Number(v.nb_frames);
const fr = (v.avg_frame_rate || v.r_frame_rate || '').split('/').map(Number);
const fps = fr[1] ? fr[0] / fr[1] : 0;

check('container', !!v && !!a, `${v ? v.codec_name : '?'} + ${a ? a.codec_name : '?'}  ${(Number(fmt.bit_rate) / 1e6).toFixed(1)} Mb/s`);
check('resolution', v.width === WANT.w && v.height === WANT.h, `${v.width}x${v.height}`);
check('frame rate', Math.abs(fps - WANT.fps) < 0.01, `${v.avg_frame_rate} (${fps.toFixed(3)} fps)`);
check('pixel format', v.pix_fmt === 'yuv420p', v.pix_fmt);
check('frame count', frames === Math.round(dur * 60), `${frames} frames = ${(frames / 60).toFixed(2)} s`);
check('duration', dur + 0.02 >= songDur, `${dur.toFixed(3)} s  vs song ${songDur.toFixed(3)} s`);
check('audio', a && Number(a.sample_rate) === 44100 && a.channels === 2, a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : 'missing');
check('profile', !!v.profile, `${v.profile} level ${v.level}`);

// decode everything; ffmpeg reports any corruption on stderr
console.log('\ndecoding every frame to verify stream integrity…');
const dec = await ffdecode(FILE);
check('decode', dec.code === 0 && dec.err.trim() === '', dec.err.trim() ? dec.err.trim().split('\n')[0] : 'no errors');

if (SHOTS) {
  const dir = path.resolve(ROOT, SHOTS);
  fs.mkdirSync(dir, { recursive: true });
  const times = [3, 15, 31, 45, 61, 77, 91, 106, 122, 136, 152, 166, 180, 195, 209, 212];
  for (let i = 0; i < times.length; i++) {
    await new Promise((res) => {
      const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(times[i]),
        '-i', FILE, '-frames:v', '1', path.join(dir, `f${String(i).padStart(3, '0')}.png`)], { stdio: 'ignore' });
      p.on('exit', res);
    });
  }
  fs.writeFileSync(path.join(dir, 'times.txt'), times.map((t, i) => `f${String(i).padStart(3, '0')}.png\t${t}`).join('\n') + '\n');
  console.log(`  extracted ${times.length} verification frames -> ${path.relative(ROOT, dir)}`);
}

const bad = results.filter((r) => !r.ok);
console.log('');
console.log(bad.length ? `FAILED: ${bad.length} check(s)` : 'ALL CHECKS PASSED');
process.exitCode = bad.length ? 1 : 0;
