'use strict';
/* 本地预览服务器(仅服务于本目录):node src/dev_server.js [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2] || 8642);
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.vox': 'application/octet-stream', '.js': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? '/tulou_viewer.html' : urlPath;
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' at http://127.0.0.1:' + PORT));
