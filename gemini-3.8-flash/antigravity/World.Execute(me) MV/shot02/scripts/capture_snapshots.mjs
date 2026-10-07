/**
 * Automated Snapshot Generator for All 10 Acts
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 9085;

const SNAPSHOT_TARGETS = [
  { name: 'act01_boot_stasis', t: 6.0, desc: 'Act 1: Object Creation in Stasis' },
  { name: 'act02_tesseract_math', t: 31.0, desc: 'Act 2: 4D Tesseract & Sacred Geometry' },
  { name: 'act03_ac_dc_rectify', t: 46.0, desc: 'Act 3: Oscilloscope AC to DC Rectification' },
  { name: 'act04_chorus_climax', t: 71.0, desc: 'Act 4: First Chorus world.execute(me);' },
  { name: 'act05_cyber_goddess', t: 86.0, desc: 'Act 5: Cyber Goddess & DNA Helix' },
  { name: 'act06_trance_polarity', t: 96.0, desc: 'Act 6: Polarity Dials & Trance' },
  { name: 'act07_isolation_ruins', t: 114.0, desc: 'Act 7: Solitary Maiden & Isolation Ruins' },
  { name: 'act08_bsod_panic', t: 138.0, desc: 'Act 8: BSOD Kernel Panic' },
  { name: 'act08_multilingual_count', t: 160.0, desc: 'Act 8: Multilingual Countdown' },
  { name: 'act09_cardioid_heart', t: 186.0, desc: 'Act 9: Algebraic Cardioid Heart' },
  { name: 'act10_infinite_butterflies', t: 200.0, desc: 'Act 10: Infinite Love Butterflies' },
  { name: 'act10_epilogue_terminal', t: 214.5, desc: 'Act 10: Terminal Epilogue' }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
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

server.listen(PORT, () => {
  const snapshotsDir = path.resolve(rootDir, 'output/snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log(`📸 Launching browser for snapshot generation: ${browserPath}`);
  const browserProc = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu=false',
    '--window-size=1920,1080',
    `http://localhost:${PORT}/index.html?render=1`
  ]);

  wss.on('connection', (ws) => {
    console.log(`🔗 Browser connected. Capturing ${SNAPSHOT_TARGETS.length} scene snapshots...`);
    let currentIndex = 0;

    function requestCurrent() {
      if (currentIndex < SNAPSHOT_TARGETS.length) {
        const target = SNAPSHOT_TARGETS[currentIndex];
        ws.send(JSON.stringify({ type: 'render', t: target.t, frame: currentIndex }));
      }
    }

    ws.on('message', (msg, isBinary) => {
      if (!isBinary) {
        try {
          const data = JSON.parse(msg.toString('utf8'));
          if (data.type === 'ready') {
            requestCurrent();
            return;
          }
        } catch (e) {}
      } else {
        const target = SNAPSHOT_TARGETS[currentIndex];
        const outPath = path.resolve(snapshotsDir, `${target.name}.jpg`);
        fs.writeFileSync(outPath, Buffer.from(msg));
        console.log(`✅ Saved [${currentIndex + 1}/${SNAPSHOT_TARGETS.length}] ${target.name}.jpg (t=${target.t}s) - ${target.desc}`);

        currentIndex++;
        if (currentIndex < SNAPSHOT_TARGETS.length) {
          requestCurrent();
        } else {
          console.log(`🎉 All snapshots successfully saved to: ${snapshotsDir}`);
          browserProc.kill();
          server.close();
          process.exit(0);
        }
      }
    });
  });
});
