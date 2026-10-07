// capture.js — deterministic whole-video render.
//
// Frames are produced by renderFrame(i) -> t = i/FPS, encoded with WebCodecs
// (H.264 Annex-B) and streamed to the dev server, which appends them in order.
// No wall-clock time enters the image, so the output is reproducible.

const POST = (path, body) => fetch(path, { method: 'POST', body });

export async function captureAll(mv, opts = {}) {
  const {
    start = 0,
    end = mv.totalFrames,
    fps = 60, gop = 120, bitrate = 24_000_000, codec = 'avc1.640028',
    onProgress = null, seqBase = 0, accel = 'no-preference',
  } = opts;

  const canvas = mv.canvas;
  const tick = 1e6 / fps;
  let seq = seqBase, bytes = 0, chunks = 0, pending = Promise.resolve();
  let encError = null;

  const cfg = {
    codec, width: canvas.width, height: canvas.height, bitrate, framerate: fps,
    latencyMode: 'quality', avc: { format: 'annexb' },
  };
  if (accel !== 'no-preference') cfg.hardwareAcceleration = accel;
  const sup = await VideoEncoder.isConfigSupported(cfg);
  if (!sup.supported) throw new Error('encoder config unsupported: ' + JSON.stringify(sup));

  const enc = new VideoEncoder({
    output: (chunk) => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      bytes += buf.length; chunks++;
      const s = seq++;
      // serialise uploads so the sink always receives contiguous, ordered chunks
      pending = pending.then(() => POST('/chunk?seq=' + s, buf))
        .catch((e) => { encError = encError || ('upload failed: ' + e.message); });
    },
    error: (e) => { encError = String(e); },
  });
  enc.configure(cfg);

  const t0 = performance.now();
  for (let i = start; i < end; i++) {
    mv.renderFrame(i);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * tick), duration: Math.round(tick) });
    enc.encode(frame, { keyFrame: (i - start) % gop === 0 });
    frame.close();
    if (i % 15 === 14) await enc.flush();   // keep the encoder queue shallow
    if (encError) throw new Error('encoder error: ' + encError);
    if ((i - start) % 240 === 239) {
      const done = i + 1;
      await POST('/status', JSON.stringify({
        done, total: end, chunks, bytes, fps: (done - start) / ((performance.now() - t0) / 1000),
      }));
      if (onProgress) onProgress(done, end);
    }
  }
  await enc.flush();
  enc.close();
  await pending;
  const ms = performance.now() - t0;
  await POST('/status', JSON.stringify({ done: end, total: end, chunks, bytes, ms, fps: (end - start) / (ms / 1000), finished: true }));
  return { frames: end - start, chunks, bytes, ms, fps: (end - start) / (ms / 1000), seqEnd: seq };
}
