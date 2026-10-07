import fs from 'fs';
import https from 'https';

async function download() {
  console.log('Fetching playurl metadata...');
  const metaRes = await fetch('https://api.bilibili.com/x/player/playurl?bvid=BV1H3af6QECk&cid=42348314937&qn=64&type=&otype=json', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' }
  });
  const meta = await metaRes.json();
  const videoUrl = meta.data.durl[0].url;
  console.log('Downloading video stream...');
  
  const file = fs.createWriteStream('target_video.mp4');
  https.get(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.bilibili.com'
    }
  }, (res) => {
    let received = 0;
    const total = parseInt(res.headers['content-length'] || 0, 10);
    res.on('data', chunk => {
      received += chunk.length;
      if (Math.random() < 0.05) {
        process.stdout.write(`\rProgress: ${(received / (1024*1024)).toFixed(1)}MB / ${(total/(1024*1024)).toFixed(1)}MB`);
      }
    });
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`\nDownload complete! Saved target_video.mp4 (${(received / (1024 * 1024)).toFixed(2)} MB)`);
    });
  }).on('error', err => {
    console.error('Download error:', err);
  });
}

download();
