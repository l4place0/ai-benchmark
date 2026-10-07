// main.js — offline driver: samples | probe <t> | full [--png] [--enc <codec>] [--bitrate N]
// usage: node main.js samples
//        node main.js full
//        node main.js probe 61.2
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { launch } = require('./launch');
const P = require('./paths');

const NF = 13080, FPS = 60, DUR_MV = 218.0;
const arg = process.argv.slice(2);
const mode = arg[0] || 'samples';

const SAMPLE_TS = [1, 3, 5, 7, 9, 11, 13, 15, 16.9, 18, 19.5, 22, 25, 28, 30.5, 34, 38, 42, 46, 50, 54, 58,
  60, 63, 66, 69, 72, 74.5, 78, 82, 86, 90, 94, 98, 102, 104, 108, 112, 116, 117.5, 120, 123, 125.5,
  126.5, 130, 134, 138, 142, 146, 147.5, 149, 150.8, 152.7, 154.6, 156.5, 158.4, 160.3, 162.2, 164, 168,
  172, 176, 180, 184, 188, 192, 196, 200, 203, 205.4, 206.2, 207.5, 209, 211, 212.8, 214, 215, 216, 217.2];

async function toPNG(page, t, file) {
  const dataUrl = await page.evaluate(t => { window.__renderFrame(t); return document.getElementById('screen').toDataURL('image/png'); }, t);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

(async () => {
  fs.mkdirSync(P.SAMPLES, { recursive: true });
  fs.mkdirSync(P.TMP, { recursive: true });
  let { browser, page, gpu } = await launch();
  console.log('GPU:', JSON.stringify(gpu));
  try {
    if (mode === 'samples' || mode === 'probe') {
      const ts = mode === 'probe' ? [parseFloat(arg[1])] : SAMPLE_TS;
      const t0 = Date.now();
      for (let i = 0; i < ts.length; i++) {
        await toPNG(page, ts[i], path.join(P.SAMPLES, `f${String(Math.round(ts[i] * FPS)).padStart(5, '0')}_t${ts[i]}.png`));
        if (i % 10 === 9) console.log(`  ${i + 1}/${ts.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
      console.log(`saved ${ts.length} sample PNGs -> ${P.SAMPLES}`);
    } else if (mode === 'selftest') {
      console.log(JSON.stringify(await page.evaluate('window.__selftest()'), null, 2));
    } else if (mode === 'encoders') {
      console.log(JSON.stringify(await page.evaluate('window.__probeEncoders()')));
    } else if (mode === 'full') {
      const usePng = arg.includes('--png');
      const det = await page.evaluate('window.__selftest()');
      console.log('selftest:', JSON.stringify(det));
      if (!det.det) throw new Error('determinism check FAILED');
      const encs = await page.evaluate('window.__probeEncoders()');
      console.log('encoders:', JSON.stringify(encs));
      const h264raw = path.join(P.TMP, 'video.h264');
      if (!usePng) {
        const pick = (arg.find(a => a.startsWith('--enc')) ? arg[arg.indexOf(arg.find(a => a.startsWith('--enc'))) + 1] : null)
          || (encs.find(e => e[1] === true && String(e[0]).startsWith('avc1')) || [])[0];
        if (!pick) throw new Error('no supported encoder');
        const bitrate = 14e6;
        console.log(`encoding with ${pick} @ ${(bitrate / 1e6).toFixed(0)}Mbps (WebCodecs, in-browser)`);
        const FROM = Math.max(0, parseInt(arg[arg.indexOf('--from') + 1]) || 0);
        let totalBytes = 0, doneFrames = FROM;
        const BATCH = 60, MAXRUNS = 6;
        for (let run = 0; run < MAXRUNS && doneFrames < NF; run++) {
          if (run > 0) { // resume: relaunch fresh page/encoder, continue at last frame
            console.log(`encoder/page failure -> relaunching (run ${run + 1}/${MAXRUNS}) from frame ${doneFrames}`);
            try { await browser.close(); } catch (e) { }
            ({ browser, page } = await launch());
          }
          await page.evaluate(c => window.__encStart(c, 14e6, 90), pick);
          const hFile = fs.createWriteStream(h264raw, { flags: (doneFrames > 0 || FROM > 0) ? 'a' : 'w', highWaterMark: 1 << 24 });
          const t0 = Date.now();
          let failed = null;
          for (let i0 = doneFrames; i0 < NF; i0 += BATCH) {
            try {
              const n = Math.min(BATCH, NF - i0);
              await page.evaluate((a, b) => window.__renderBatch(a, b), i0, n);
              const d = await page.evaluate('window.__drain()');
              const buf = Buffer.from(d.b64, 'base64');
              totalBytes += buf.length;
              await new Promise(r => hFile.write(buf, r));
              doneFrames = i0 + n;
            } catch (e) { failed = e; break; }
            const el = (Date.now() - t0) / 1000, fps = Math.max(0.1, doneFrames / el);
            if ((i0 / BATCH) % 10 === 0 || doneFrames >= NF)
              console.log(`F ${doneFrames}/${NF}  ${fps.toFixed(1)}fps  eta=${((NF - doneFrames) / fps / 60).toFixed(1)}min  ${(totalBytes / 1048576).toFixed(0)}MB`);
          }
          if (failed) console.log('batch failed:', String(failed.message).slice(0, 140));
          await new Promise(r => hFile.end(r));
          if (!failed) break;
          if (!failed) {
            try {
              const fin = await page.evaluate('window.__finish()');
              if (fin.bytes) { const hf = fs.createWriteStream(h264raw, { flags: 'a' }); hf.write(Buffer.from(fin.b64, 'base64')); await new Promise(r => hf.end(r)); totalBytes += fin.bytes; }
            } catch (e) { console.log('finish failed:', e.message.slice(0, 120)); }
          }
        }
        if (doneFrames < NF) throw new Error(`render incomplete: ${doneFrames}/${NF}`);
        console.log(`bitstream: ${(totalBytes / 1048576).toFixed(1)}MB -> ${h264raw}`);
      } else {
        // PNG/raw fallback: stream RGBA to ffmpeg directly
        console.log('PNG fallback: piping RGBA frames into ffmpeg');
        const ff = spawn(P.FFMPEG, ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-r', '60', '-i', '-',
          '-i', P.AUDIO, '-af', 'apad', '-t', String(DUR_MV), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(P.OUT, 'world.execute(me)_fanMV_1080p60_take03.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
        const t0 = Date.now();
        for (let i = 0; i < NF; i++) {
          const b64 = await page.evaluate(t => {
            window.__renderFrame(t);
            const d = document.getElementById('screen').getContext('2d').getImageData(0, 0, 1920, 1080).data;
            let s = ''; const CH = 0x8000;
            for (let k = 0; k < d.length; k += CH) s += String.fromCharCode.apply(null, d.subarray(k, k + CH));
            return btoa(s);
          }, i / FPS);
          ff.stdin.write(Buffer.from(b64, 'base64'));
          if (i % 300 === 0) { const fps = (i + 1) / ((Date.now() - t0) / 1000); console.log(`F ${i + 1}/${NF} ${fps.toFixed(2)}fps eta=${((NF - i) / fps / 60).toFixed(1)}min`); }
        }
        ff.stdin.end();
        await new Promise(r => ff.on('close', r));
        browser.close();
        console.log('DONE (png fallback)');
        return;
      }
      // mux audio
      const out = path.join(P.OUT, 'world.execute(me)_fanMV_1080p60_take03.mp4');
      const ff = spawn(P.FFMPEG, ['-y', '-f', 'h264', '-framerate', '60', '-i', h264raw, '-i', P.AUDIO,
        '-af', 'apad', '-t', String(DUR_MV), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart', out], { stdio: ['ignore', 'inherit', 'inherit'] });
      await new Promise(r => ff.on('close', r));
      console.log('muxed ->', out);
    } else {
      console.log('modes: samples | probe <t> | selftest | encoders | full [--png] [--enc <codec>]');
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
