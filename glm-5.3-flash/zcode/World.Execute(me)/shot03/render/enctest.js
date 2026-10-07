// enctest.js — isolated WebCodecs encode test: 240 real frames -> test.h264 -> ffprobe
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const P = require('./paths');
(async () => {
  const b = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--use-gl=angle', '--mute-audio', '--window-size=1920,1080', '--force-device-scale-factor=1'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await p.goto('file:///' + P.MV.replace(/\\/g, '/') + '?render=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__ready === true', { timeout: 120000, polling: 200 });
  await p.evaluate(() => window.__encStart('avc1.640033', 14e6, 90));
  const out = path.join(P.TMP, 'test.h264');
  const ws = fs.createWriteStream(out);
  let total = 0;
  const drain = async () => {
    const d = await p.evaluate('window.__drain()');
    const buf = Buffer.from(d.b64, 'base64');
    total += buf.length;
    await new Promise(r => ws.write(buf, r));
  };
  const t0 = Date.now();
  await p.evaluate(async () => { await window.__renderBatch(3000, 120); });
  await drain();
  await p.evaluate(async () => { await window.__renderBatch(6600, 120); });
  await drain();
  const fin = await p.evaluate('window.__finish()');
  if (fin.bytes) { const buf = Buffer.from(fin.b64, 'base64'); total += buf.length; await new Promise(r => ws.write(buf, r)); }
  await new Promise(r => ws.end(r));
  const el = (Date.now() - t0) / 1000;
  console.log(`240 frames in ${el.toFixed(1)}s -> ${(total / 240 / 1024).toFixed(1)} KB/frame, ${(total / 1024).toFixed(0)}KB total`);
  try {
    console.log(execFileSync(P.FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames', '-show_entries', 'format=duration,bit_rate', '-of', 'default=noprint_wrappers=1', out], { encoding: 'utf8' }));
  } catch (e) { console.log('ffprobe FAILED:', e.stderr ? e.stderr.slice(0, 400) : e.message); }
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
