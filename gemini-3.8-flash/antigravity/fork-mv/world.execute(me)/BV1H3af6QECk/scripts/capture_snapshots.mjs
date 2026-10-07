import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 9095;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(rootDir, reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + reqPath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws-render')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

const timestamps = [
  1, 5, 14.5, 16, 20, 28.5, 29.1, 31, 35, 43.9, 46, 58.9, 60, 
  73.6, 75, 79, 83, 88.2, 92, 100, 103.0, 108, 112, 115, 117.5, 122, 140, 
  146.8, 150, 154.8, 157, 158, 160.5, 162.0, 162.3, 164, 165, 170, 175, 178.8, 179.5, 182, 184.4, 
  186, 190, 196, 199.2, 201, 205, 209
];

server.listen(PORT, async () => {
  console.log(`📸 Starting snapshot capture for timestamps:`, timestamps);
  const outDir = path.resolve(rootDir, 'output/snapshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const browserProc = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu=false',
    '--enable-gpu-rasterization',
    '--window-size=1920,1080',
    `http://localhost:${PORT}/index.html?render=1`
  ]);

  wss.on('connection', (ws) => {
    let currentIdx = 0;

    function captureNext() {
      if (currentIdx >= timestamps.length) {
        console.log('✅ All snapshots successfully captured!');
        browserProc.kill();
        server.close();
        process.exit(0);
      }
      const t = timestamps[currentIdx];
      ws.send(JSON.stringify({ type: 'render', t, frame: currentIdx }));
    }

    ws.on('message', (msg, isBinary) => {
      if (!isBinary) {
        try {
          const d = JSON.parse(msg.toString('utf8'));
          if (d.type === 'ready') captureNext();
        } catch (e) {}
      } else {
        const t = timestamps[currentIdx];
        const sec = String(t).padStart(3, '0');
        const filename = path.join(outDir, `snap_${sec}s.jpg`);
        fs.writeFileSync(filename, Buffer.from(msg));
        console.log(`📸 Saved snapshot: snap_${sec}s.jpg (t=${t}s)`);
        currentIdx++;
        captureNext();
      }
    });
  });
});
