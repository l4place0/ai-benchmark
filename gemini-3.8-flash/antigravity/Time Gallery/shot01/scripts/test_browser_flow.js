import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const PORT = 9005;

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
  const remoteDebuggingPort = 9225;
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
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
        const errors = [];

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id && pendingResolvers.has(msg.id)) {
            const resolve = pendingResolvers.get(msg.id);
            pendingResolvers.delete(msg.id);
            resolve(msg.result);
          }
          if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params.type === 'error') {
              errors.push(msg.params.args.map(a => a.value || a.description).join(' '));
            }
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
          await send('Log.enable');

          console.log('--- Starting Full Browser State Machine Verification ---');

          // Wait 1s for app load
          await new Promise(r => setTimeout(r, 1000));

          // 1. Check Initial State: WELCOME
          const initialLayer = await evaluate(`document.getElementById('welcome-view').classList.contains('active')`);
          console.log('1. Welcome view is initially active:', initialLayer);
          if (!initialLayer) throw new Error('Welcome view should be active');

          // 2. Click "开启时光之门" button
          await evaluate(`document.getElementById('btn-start-journey').click()`);
          await new Promise(r => setTimeout(r, 600));

          // Check State: TIMELINE
          const timelineActive = await evaluate(`document.getElementById('timeline-view').classList.contains('active')`);
          console.log('2. After clicking start, Timeline view is active:', timelineActive);
          if (!timelineActive) throw new Error('Timeline view should be active');

          // 3. Click Period Node for盛期文艺复兴
          await evaluate(`document.querySelector('[data-period-id="high_renaissance"] .period-node-anchor').click()`);
          await new Promise(r => setTimeout(r, 600));

          // Check State: GALLERY
          const galleryActive = await evaluate(`document.getElementById('gallery-view').classList.contains('active')`);
          const galleryTitle = await evaluate(`document.getElementById('gallery-period-title').textContent`);
          console.log('3. After clicking High Renaissance, Gallery view is active:', galleryActive, 'with title:', galleryTitle);
          if (!galleryActive || !galleryTitle.includes('盛期文艺复兴')) throw new Error('Gallery should be active with High Renaissance');

          // 4. Open Detail Modal
          await evaluate(`window.__TIME_GALLERY_APP__.openDetail(window.__TIME_GALLERY_APP__.currentPeriod.representative)`);
          await new Promise(r => setTimeout(r, 500));

          const modalActive = await evaluate(`document.getElementById('artwork-detail-modal').classList.contains('active')`);
          const modalZh = await evaluate(`document.getElementById('modal-title-zh').textContent`);
          const modalBox = await evaluate(`(() => {
            const rect = document.getElementById('artwork-modal-card').getBoundingClientRect();
            return { top: Math.round(rect.top), left: Math.round(rect.left) };
          })()`);
          console.log('4. Detail modal opened:', modalActive, 'artwork title:', modalZh, 'card inset:', modalBox);
          if (!modalActive || modalBox.top !== 24 || modalBox.left !== 24) {
            throw new Error(`Modal should be active with 24px inset! Got top=${modalBox.top}, left=${modalBox.left}`);
          }

          // 5. Test Rapid E press (Anti-spam / single instance lock)
          const modalCountBefore = await evaluate(`document.querySelectorAll('.artwork-modal-card').length`);
          // Dispatch rapid 'E' key events
          await evaluate(`
            for (let i = 0; i < 5; i++) {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
            }
          `);
          const modalCountAfter = await evaluate(`document.querySelectorAll('.artwork-modal-card').length`);
          console.log('5. Single instance lock check: modal count before =', modalCountBefore, 'after =', modalCountAfter);
          if (modalCountBefore !== 1 || modalCountAfter !== 1) throw new Error('Modal stacked duplicates on rapid E!');

          // 6. Test ESC key closes the modal
          await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
          await new Promise(r => setTimeout(r, 500));

          const modalClosed = await evaluate(`!document.getElementById('artwork-detail-modal').classList.contains('active')`);
          console.log('6. ESC key closes modal:', modalClosed);
          if (!modalClosed) throw new Error('ESC key failed to close modal');

          // 7. Click "返回时间轴" button
          await evaluate(`document.getElementById('btn-gallery-back').click()`);
          await new Promise(r => setTimeout(r, 600));

          const timelineReturn = await evaluate(`document.getElementById('timeline-view').classList.contains('active')`);
          console.log('7. Returned to timeline:', timelineReturn);
          if (!timelineReturn) throw new Error('Failed to return to timeline');

          // Check for any console errors
          console.log('8. Total console errors:', errors.length);
          if (errors.length > 0) {
            console.error('Console errors:', errors);
            throw new Error('Console errors encountered');
          }

          console.log('\n======================================================');
          console.log('🏆 COMPLETE BROWSER FLOW & STATE MACHINE VERIFIED 100%!');
          console.log('======================================================');

          ws.close();
          edgeProc.kill();
          server.close();
          process.exit(0);
        };
      } catch (err) {
        console.error('Verification error:', err);
        edgeProc.kill();
        server.close();
        process.exit(1);
      }
    });
  });
});
