// enctest.mjs — validate: WebGL render -> WebCodecs H.264 (annexb) -> node sink -> ffmpeg mp4.
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';

const PORT = 8791;
const FRAMES = Number((process.argv.find(a => a.startsWith('--frames=')) || '--frames=240').split('=')[1]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1) static+chunk server
const srv = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: import.meta.dirname, stdio: 'ignore' });
let up = false;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/state`); if (r.ok) { up = true; break; } } catch {}
  await sleep(200);
}
if (!up) { console.error('server did not start'); process.exit(1); }

// 2) fresh stream
await fetch(`http://127.0.0.1:${PORT}/reset?out=_dev/tmp/enctest.h264`, { method: 'POST' });

const cdp = await attach({ width: 1920, height: 1080 });
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/_dev/enctest.html` });
  for (let i = 0; i < 60; i++) { if (await cdp.eval('!!window.__ready')) break; await sleep(250); }
  console.log('renderer: ' + await cdp.eval('T.glinfo()'));

  const t0 = Date.now();
  const res = await cdp.eval(`T.run(${FRAMES})`, { awaitPromise: true, timeout: 900000 });
  console.log('encode: ' + JSON.stringify(res));

  // wait for the sink to drain
  let st;
  for (let i = 0; i < 120; i++) {
    st = await (await fetch(`http://127.0.0.1:${PORT}/state`)).json();
    if (st.buffered === 0 && st.chunks >= res.chunks) break;
    await sleep(250);
  }
  console.log('sink: ' + JSON.stringify({ chunks: st.chunks, received: st.received, bytes: st.bytes, buffered: st.buffered }));
  console.log('kbps: ' + (st.bytes * 8 / 1000 / (FRAMES / 60)).toFixed(0));
} finally {
  await close(cdp);
  srv.kill();
}

// 3) mux check
const probe = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,nb_read_frames,r_frame_rate',
  '-count_frames', '-of', 'default=nw=1',
  '_dev/tmp/enctest.h264'], { cwd: import.meta.dirname, stdio: 'inherit' });
await new Promise(r => probe.on('exit', r));
