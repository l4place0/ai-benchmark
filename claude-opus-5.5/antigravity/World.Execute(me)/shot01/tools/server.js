// Minimal static file server rooted at the project dir (needed for ES modules)
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.css': 'text/css' };
function start(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { resp.writeHead(403); return resp.end(); }
      fs.readFile(fp, (err, data) => {
        if (err) { resp.writeHead(404); return resp.end('404'); }
        resp.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        resp.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}
module.exports = { start };
if (require.main === module) start(+process.argv[2] || 8765).then(s => console.log('serving on http://127.0.0.1:' + s.address().port + '/src/index.html'));
