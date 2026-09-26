import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 9072;
const snapshotTimes = [
  { t: 3.0, name: '01_protection' },
  { t: 6.2, name: '02_object_creation' },
  { t: 9.0, name: '03_initialization' },
  { t: 20.0, name: '04_matrix_warp' },
  { t: 31.5, name: '05_dimension_tesseract' },
  { t: 35.2, name: '06_circumference' },
  { t: 39.0, name: '07_sine_tangents' },
  { t: 42.5, name: '08_limitations' },
  { t: 46.0, name: '09_ac_dc' },
  { t: 68.5, name: '10_execution' },
  { t: 72.5, name: '11_world_execute_me' }
];

const snapDir = path.resolve(rootDir, 'output/snapshots');
if (!fs.existsSync(snapDir)) {
  fs.mkdirSync(snapDir, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(rootDir, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
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

server.listen(PORT, () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu=false',
    '--window-size=1920,1080',
    `http://localhost:${PORT}/index.html?render=1`
  ]);

  wss.on('connection', (ws) => {
    let index = 0;

    ws.on('message', (msg) => {
      if (typeof msg === 'string') {
        const data = JSON.parse(msg);
        if (data.type === 'ready') {
          const item = snapshotTimes[0];
          ws.send(JSON.stringify({ type: 'render', t: item.t, frame: Math.round(item.t * 60) }));
        }
      } else {
        const item = snapshotTimes[index];
        const outPath = path.join(snapDir, `${item.name}.jpg`);
        fs.writeFileSync(outPath, Buffer.from(msg));
        console.log(`Saved snapshot: ${item.name}.jpg (t=${item.t}s)`);

        index++;
        if (index < snapshotTimes.length) {
          const next = snapshotTimes[index];
          ws.send(JSON.stringify({ type: 'render', t: next.t, frame: Math.round(next.t * 60) }));
        } else {
          console.log('All snapshots captured!');
          browserProc.kill();
          server.close();
          process.exit(0);
        }
      }
    });
  });
});
