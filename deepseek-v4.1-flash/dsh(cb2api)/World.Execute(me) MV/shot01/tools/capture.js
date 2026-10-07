/* =====================================================================
   CAPTURE — encode the whole film inside headless Chrome.

   Determinism: frame(t) is a pure function of t, so we seek to an exact
   timestamp instead of running a rAF loop. No dropped or duplicated frames,
   and the render is exactly reproducible.

   Performance notes (measured, see tools/probe-perf.js):
     - render(frame)                  ~23 ms
     - render + VideoFrame + encode   ~34 ms  => ~30 fps in-page
   The naive approach (PNG dataURL or readPixels+base64 per frame over CDP)
   costs 100-180 ms/frame and is what makes this kind of job take hours.
   So we encode with WebCodecs and only ship the compressed chunks to Node.

   Output: out/video_silent.mp4  (H.264 annexb, muxed by ffmpeg)

   Usage: node tools/capture.js [--start S] [--end S] [--fps N] [--out FILE]
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { openPage, evaluate, BASE } = require('./preview');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const FPS = parseInt(arg('fps', '60'), 10);
const START = parseFloat(arg('start', '0'));
const END = parseFloat(arg('end', '0'));
const OUT = arg('out', path.join(BASE, 'out', 'video_silent.mp4'));
const BITRATE = parseInt(arg('bitrate', '24000000'), 10);
const GOP = parseInt(arg('gop', '60'), 10);   // keyframe every second

(async () => {
  const { ws, S, proc } = await openPage();
  await ws.cmd('Page.navigate', { url: 'file:///' + path.join(BASE, 'render.html').replace(/\\/g, '/') }, S);
  await new Promise(r => setTimeout(r, 2500));

  const err = await evaluate(ws, S, 'window.__ERROR || ""');
  if (err) throw new Error('page error: ' + err);

  const DUR = await evaluate(ws, S, 'window.__DURATION');
  const W = await evaluate(ws, S, 'window.__W');
  const H = await evaluate(ws, S, 'window.__H');
  const total = Math.round(DUR * FPS);
  const first = Math.round(START * FPS);
  const last = END > 0 ? Math.min(total - 1, Math.round(END * FPS)) : total - 1;
  const nFrames = last - first + 1;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  console.log(`duration=${DUR.toFixed(3)}s  ${W}x${H}@${FPS}  total=${total} frames`);
  console.log(`encoding frames ${first}..${last}  (${nFrames})  bitrate=${(BITRATE/1e6).toFixed(0)}Mbps`);

  // ffmpeg muxes the raw H.264 elementary stream into mp4 (no re-encode)
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'h264', '-r', String(FPS), '-i', 'pipe:0',
    '-an', '-c:v', 'copy',
    '-bsf:v', 'h264_mp4toannexb=no',
    '-r', String(FPS),
    '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  let ffErr = null;
  ff.on('error', e => { ffErr = e; });
  const ffDone = new Promise(r => ff.on('close', c => r(c)));

  // ---- install the in-page encoder ----
  const setup = await evaluate(ws, S, `
    (function(){
      const W = ${W}, H = ${H}, FPS = ${FPS};
      window.__CAP = { chunks: [], count: 0, err: null, done: false, bytes: 0 };
      const codec = 'avc1.640028';
      const enc = new VideoEncoder({
        output: (chunk /*, meta*/) => {
          const buf = new Uint8Array(chunk.byteLength);
          chunk.copyTo(buf);
          let s = '';
          const CH = 0x4000;
          for (let o = 0; o < buf.length; o += CH) s += String.fromCharCode.apply(null, buf.subarray(o, o+CH));
          window.__CAP.chunks.push(btoa(s));
          window.__CAP.bytes += chunk.byteLength;
          window.__CAP.count++;
        },
        error: (e) => { window.__CAP.err = String(e && e.message || e); },
      });
      window.__ENC = enc;
      return VideoEncoder.isConfigSupported({
        codec, width: W, height: H, bitrate: ${BITRATE}, framerate: FPS, avc: { format: 'annexb' },
      }).then(r => {
        if (!r.supported) return 'unsupported';
        enc.configure({ codec, width: W, height: H, bitrate: ${BITRATE}, framerate: FPS,
                        avc: { format: 'annexb' }, latencyMode: 'quality' });
        window.__CAP.ready = true;
        return 'ready';
      });
    })()`);
  console.log('encoder:', setup);
  if (setup !== 'ready') throw new Error('encoder not ready: ' + setup);

  const cv = await evaluate(ws, S, `
    (function(){ const c = document.getElementById('out'); return [c.width, c.height].join('x'); })()`);
  console.log('canvas:', cv);

  const t0 = Date.now();
  let fed = 0;

  // Correct backpressure is essential. `setTimeout(0)` does NOT let the
  // encoder drain: encodeQueueSize then grows without bound and throughput
  // collapses (measured 70 fps -> 2 fps with q climbing past 2800). We must
  // actually wait for the queue to fall below a limit.
  const QLIMIT = parseInt(arg('qlimit', '8'), 10);
  const SLICE = parseInt(arg('slice', '30'), 10);
  for (let f = first; f <= last; f += SLICE) {
    const n = Math.min(SLICE, last - f + 1);

    const drained = await evaluate(ws, S, `
      (async function(){
        const CAP = window.__CAP, enc = window.__ENC;
        const c = document.getElementById('out');
        for (let i = 0; i < ${n}; i++){
          const idx = ${f} + i;
          const t = idx / ${FPS};
          window.__RENDER(t);
          const frame = new VideoFrame(c, {
            timestamp: Math.round(idx * 1e6 / ${FPS}),
            duration: Math.round(1e6 / ${FPS}),
          });
          enc.encode(frame, { keyFrame: (idx % ${GOP}) === 0 });
          frame.close();
          let spins = 0;
          while (enc.encodeQueueSize > ${QLIMIT}) {
            await new Promise(r => setTimeout(r, 2));
            if (++spins > 4000) break;   // safety valve
          }
        }
        // hand back everything produced so far, then clear the array
        const a = CAP.chunks;
        CAP.chunks = [];
        return { chunks: a, err: CAP.err, count: CAP.count, q: enc.encodeQueueSize };
      })()`);

    if (drained.err) throw new Error('encoder error: ' + drained.err);
    for (const b64 of drained.chunks) {
      const buf = Buffer.from(b64, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    fed += n;

    const el = (Date.now() - t0) / 1000;
    const rate = fed / Math.max(el, 0.001);
    const remain = (last - f - n + 1) / Math.max(rate, 0.01);
    process.stdout.write(`\r  ${fed}/${nFrames} frames  ${rate.toFixed(1)} fps  eta ${(remain/60).toFixed(1)} min    `);
  }

  // flush the encoder and drain the tail
  const finalInfo = await evaluate(ws, S, `
    (async function(){
      await window.__ENC.flush();
      const a = window.__CAP.chunks; window.__CAP.chunks = [];
      window.__ENC.close();
      return { count: window.__CAP.count, bytes: window.__CAP.bytes, err: window.__CAP.err, chunks: a };
    })()`);

  // drain whatever the flush produced
  for (const b64 of finalInfo.chunks) {
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  if (finalInfo.err) throw new Error('encoder error: ' + finalInfo.err);

  ff.stdin.end();
  const code = await ffDone;
  process.stdout.write('\n');
  if (ffErr) throw ffErr;
  if (code !== 0) throw new Error('ffmpeg exited ' + code);

  const mins = (Date.now() - t0) / 60000;
  console.log(`encoded ${finalInfo.count} chunks, ${(finalInfo.bytes/1e6).toFixed(1)} MB, ${mins.toFixed(1)} min -> ${OUT}`);
  ws.sock.end(); proc.kill();
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
