// fetch_audio.js — download official audio track from Mili's bilibili channel via bilibili web API
// usage: node fetch_audio.js <bvid> <outPath>
const fs = require('fs');
const path = require('path');

const BVID = process.argv[2] || 'BV1ds411e7df';
const OUT = process.argv[3] || path.join(__dirname, '..', 'audio', 'song.m4a');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HDRS = { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Origin': 'https://www.bilibili.com' };

async function jget(url) {
  const r = await fetch(url, { headers: HDRS });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`API ${url} -> code ${j.code}: ${j.message}`);
  return j.data;
}

(async () => {
  // 1. video meta -> cid
  const view = await jget(`https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`);
  const cid = view.cid;
  console.error(`title: ${view.title}  owner: ${view.owner?.name}  duration: ${view.duration}s  cid: ${cid}`);

  // 2. dash playurl
  const pu = await jget(`https://api.bilibili.com/x/player/playurl?bvid=${BVID}&cid=${cid}&fnval=16&fnver=0&fourk=1`);
  if (!pu.dash || !pu.dash.audio?.length) throw new Error('no dash audio streams');
  const aud = pu.dash.audio.slice().sort((a, b) => b.bandwidth - a.bandwidth)[0];
  console.error(`audio: id=${aud.id} codec=${aud.codecs} bandwidth=${(aud.bandwidth / 1000).toFixed(0)}kbps`);

  // 3. download (baseUrl, fallback backupUrl), resume by size if partial
  const urls = [aud.baseUrl, ...(aud.backupUrl || [])];
  const tmp = OUT + '.part';
  let done = false, lastErr = null;
  for (const u of urls) {
    try {
      const head = await fetch(u, { headers: HDRS, method: 'GET', headers2: undefined });
      const r = await fetch(u, { headers: HDRS });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(tmp, buf);
      if (buf.length < 100000) throw new Error(`too small: ${buf.length}`);
      fs.renameSync(tmp, OUT);
      console.error(`downloaded ${(buf.length / 1048576).toFixed(1)} MB from ${new URL(u).host}`);
      done = true;
      break;
    } catch (e) { lastErr = e; console.error(`stream failed: ${e.message}`); }
  }
  if (!done) throw lastErr;

  // 4. summary
  fs.writeFileSync(path.join(__dirname, 'audio_source.json'), JSON.stringify({
    bvid: BVID, cid, title: view.title, owner: view.owner?.name,
    video_duration: view.duration, audio_id: aud.id, codecs: aud.codecs,
    bandwidth: aud.bandwidth, size: fs.statSync(OUT).size, fetched_at: new Date().toISOString()
  }, null, 2));
  console.log('OK ' + OUT);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
