// fetch_lyric.js — search NetEase for world.execute(me); and fetch LRC timeline
// usage: node fetch_lyric.js
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

async function jget(url, referer) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': referer || 'https://music.163.com/',
      'Cookie': 'appver=2.9.7'
    }
  });
  return await r.json();
}

(async () => {
  // 1. search
  const q = encodeURIComponent('world.execute(me); Mili');
  const search = await jget(`https://music.163.com/api/search/get/web?s=${q}&type=1&limit=8`);
  fs.writeFileSync(path.join(DIR, 'netease_search.json'), JSON.stringify(search, null, 2));
  const songs = search?.result?.songs || [];
  if (!songs.length) throw new Error('netease search returned nothing');
  // prefer exact title match with artist Mili
  const pick = songs.find(s => /world\.execute\(me\)/i.test(s.name) && (s.artists || []).some(a => /mili/i.test(a.name || ''))) || songs[0];
  console.error(`picked id=${pick.id} "${pick.name}" by ${(pick.artists || []).map(a => a.name).join('/')} album=${pick.album?.name}`);

  // 2. lyric (lrc timeline + translation)
  const ly = await jget(`https://music.163.com/api/song/lyric?id=${pick.id}&lv=1&kv=1&tv=-1`);
  fs.writeFileSync(path.join(DIR, 'netease_lyric.json'), JSON.stringify({ id: pick.id, name: pick.name, artists: (pick.artists || []).map(a => a.name), album: pick.album?.name, lyric: ly }, null, 2));
  const lines = (ly.lrc?.lyric || '').split('\n').filter(l => l.trim());
  console.error(`lrc lines: ${lines.length}`);
  console.log('OK id=' + pick.id);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
