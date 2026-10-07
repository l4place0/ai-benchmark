import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 9097;

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

const testFrames = [
  { t: 3.0, name: 'v01_intro_caution' },
  { t: 12.5, name: 'v02_intro_dialog' },
  { t: 17.5, name: 'v03_title_kanji' },
  { t: 30.5, name: 'v04_dimension_quadrant' },
  { t: 45.0, name: 'v05_ac_dc' },
  { t: 60.5, name: 'v06_chorus_stimulations' },
  { t: 90.0, name: 'v07_gender_switch' },
  { t: 105.0, name: 'v08_vibrations' },
  { t: 128.0, name: 'v09_illegal_arguments_tape' },
  { t: 131.0, name: 'v10_fatal_exception_dialog' },
  { t: 147.6, name: 'v11_execution_stab_01' },
  { t: 151.4, name: 'v12_execution_stab_06' },
  { t: 158.5, name: 'v13_chalkboard_numerals' },
  { t: 174.0, name: 'v14_trapped_caution' },
  { t: 182.0, name: 'v15_cherry_stamp' },
  { t: 202.0, name: 'v16_outro_master_sheet' }
];

server.listen(PORT, async () => {
  console.log(`📸 Starting Vocaloid Fusion snapshot capture...`);
  const outDir = path.resolve(rootDir, 'output/vocaloid_snapshots');
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
      if (currentIdx >= testFrames.length) {
        console.log('✅ All Vocaloid snapshots captured successfully!');
        browserProc.kill();
        server.close();
        process.exit(0);
      }
      const item = testFrames[currentIdx];
      ws.send(JSON.stringify({ type: 'render', t: item.t, frame: currentIdx }));
    }

    ws.on('message', (msg, isBinary) => {
      if (!isBinary) {
        try {
          const d = JSON.parse(msg.toString('utf8'));
          if (d.type === 'ready') captureNext();
        } catch (e) {}
      } else {
        const item = testFrames[currentIdx];
        const filename = path.join(outDir, `${item.name}_t${Math.floor(item.t * 10)}.jpg`);
        fs.writeFileSync(filename, Buffer.from(msg));
        console.log(`📸 Saved Vocaloid snapshot: ${item.name} (t=${item.t}s)`);
        currentIdx++;
        captureNext();
      }
    });
  });
});
