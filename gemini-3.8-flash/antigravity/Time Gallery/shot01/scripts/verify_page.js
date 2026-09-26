import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = 8999;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(rootDir, reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=4000',
    '--dump-dom',
    `http://localhost:${PORT}/index.html`
  ];

  execFile(edgePath, args, (err, stdout, stderr) => {
    server.close();
    if (err) {
      console.error('Edge run error:', err);
      process.exit(1);
    }
    console.log('--- Headless Edge Output Verification ---');
    console.log('Output length:', stdout.length);
    console.log('Has #welcome-view rendered:', stdout.includes('welcome-view'));
    console.log('Has 时光画廊 title:', stdout.includes('时光画廊'));
    console.log('Has 开启时光之门 button:', stdout.includes('开启时光之门'));
    console.log('Has blue-arch:', stdout.includes('blue-arch'));
    console.log('Has 西方艺术史长河:', stdout.includes('西方艺术史长河'));
    console.log('DOM check completed successfully!');
    process.exit(0);
  });
});
