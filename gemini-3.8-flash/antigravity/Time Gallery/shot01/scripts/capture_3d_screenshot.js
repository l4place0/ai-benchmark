import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = 9020;

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

server.listen(PORT, async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const remoteDebuggingPort = 9240;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--no-sandbox',
    '--window-size=1280,800',
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `http://localhost:${PORT}/index.html`
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get(`http://localhost:${remoteDebuggingPort}/json`, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', async () => {
      try {
        const targets = JSON.parse(raw);
        const pageTarget = targets.find(t => t.type === 'page');
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

        let id = 1;
        const pendingResolvers = new Map();

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id && pendingResolvers.has(msg.id)) {
            const resolve = pendingResolvers.get(msg.id);
            pendingResolvers.delete(msg.id);
            resolve(msg.result);
          }
        };

        const send = (method, params = {}) => {
          return new Promise((resolve) => {
            const reqId = id++;
            pendingResolvers.set(reqId, resolve);
            ws.send(JSON.stringify({ id: reqId, method, params }));
          });
        };

        const evaluate = async (expression) => {
          const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
          return res?.result?.value;
        };

        ws.onopen = async () => {
          await send('Runtime.enable');
          await send('Page.enable');

          await new Promise(r => setTimeout(r, 1000));

          // Click Start
          await evaluate(`document.getElementById('btn-start-journey').click()`);
          await new Promise(r => setTimeout(r, 600));

          // Click High Renaissance
          await evaluate(`document.querySelector('[data-period-id="high_renaissance"] .period-node-anchor').click()`);
          await new Promise(r => setTimeout(r, 2000));

          // Pitch camera up to look at dome
          await evaluate(`
            const app = window.__TIME_GALLERY_APP__;
            if (app && app.controls) {
              app.threeCamera.position.set(0, 1.7, 0);
              app.controls.euler.x = 1.35; // ~77 degrees up
              app.threeCamera.quaternion.setFromEuler(app.controls.euler);
            }
          `);
          await new Promise(r => setTimeout(r, 600));

          const shotDome = await send('Page.captureScreenshot', { format: 'png' });
          if (shotDome && shotDome.data) {
            fs.writeFileSync(path.join(rootDir, 'screenshot_gallery_dome.png'), Buffer.from(shotDome.data, 'base64'));
            console.log('Saved screenshot_gallery_dome.png');
          }

          ws.close();
          edgeProc.kill();
          server.close();
          process.exit(0);
        };
      } catch (err) {
        console.error('Error:', err);
        edgeProc.kill();
        server.close();
        process.exit(1);
      }
    });
  });
});
