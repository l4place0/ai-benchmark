import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3456;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${reqPath}`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  console.log(`Debug server listening on http://localhost:${PORT}`);

  const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  console.log('Using browser executable:', chromePath);

  try {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--window-size=1280,720'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const logs = [];
    const errors = [];
    const failedRequests = [];

    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]:`, msg.text());
      logs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      console.error('[BROWSER PAGE ERROR]:', err.toString());
      errors.push(err.toString());
    });

    page.on('requestfailed', req => {
      console.error('[BROWSER REQUEST FAILED]:', req.url(), req.failure()?.errorText);
      failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
    });

    console.log('Navigating to http://localhost:' + PORT);
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait 3 seconds for Three.js to initialize and render frames
    await new Promise(r => setTimeout(r, 3000));

    // Evaluate in page
    const pageStatus = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const app = window.app;
      return {
        hasCanvas: !!canvas,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        hasApp: !!app,
        hasScene: !!app?.scene,
        sceneChildrenCount: app?.scene?.children?.length,
        cameraPos: app?.camera?.position
      };
    });

    console.log('Page Status in Browser:', JSON.stringify(pageStatus, null, 2));

    await page.screenshot({ path: path.join(__dirname, 'debug_screenshot.png') });
    console.log('Saved debug_screenshot.png successfully!');

    await browser.close();
    server.close();

    console.log('\n--- SUMMARY ---');
    console.log(`Errors count: ${errors.length}`);
    console.log(`Failed requests count: ${failedRequests.length}`);
    console.log(`Logs count: ${logs.length}`);
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('Debug script fatal error:', err);
    server.close();
    process.exit(1);
  }
});
