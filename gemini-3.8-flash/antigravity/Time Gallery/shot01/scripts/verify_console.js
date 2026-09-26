import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = 9001;

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
  const remoteDebuggingPort = 9222;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `http://localhost:${PORT}/index.html`
  ]);

  // Wait 1.5s for Edge to start debugging server
  await new Promise(r => setTimeout(r, 1500));

  // Query CDP targets
  http.get(`http://localhost:${remoteDebuggingPort}/json`, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', async () => {
      try {
        const targets = JSON.parse(raw);
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) {
          console.log('No page target found');
          cleanUp();
          return;
        }

        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

        const logs = [];
        let id = 1;

        ws.onopen = () => {
          ws.send(JSON.stringify({ id: id++, method: 'Runtime.enable' }));
          ws.send(JSON.stringify({ id: id++, method: 'Log.enable' }));
        };

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            const type = msg.params.type;
            const text = msg.params.args.map(a => a.value || a.description).join(' ');
            logs.push({ type, text });
            console.log(`[BROWSER CONSOLE ${type.toUpperCase()}]:`, text);
          }
        };

        // Let page run for 3 seconds
        setTimeout(() => {
          ws.close();
          const errors = logs.filter(l => l.type === 'error');
          console.log(`--- Console Check Completed: ${errors.length} errors found ---`);
          cleanUp(errors.length === 0 ? 0 : 1);
        }, 3000);

      } catch (err) {
        console.error('CDP connect error:', err);
        cleanUp(1);
      }
    });
  }).on('error', (err) => {
    console.error('CDP query error:', err);
    cleanUp(1);
  });

  function cleanUp(exitCode = 0) {
    try { edgeProc.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    process.exit(exitCode);
  }
});
