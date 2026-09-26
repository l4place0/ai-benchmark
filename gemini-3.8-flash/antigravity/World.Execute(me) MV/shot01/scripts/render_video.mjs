/**
 * Headless 1080p 60fps Full-Length Video Renderer for Mili - world.execute(me);
 * 
 * Computes frame-by-frame lockstep rendering where each frame = f(t).
 * Video duration: 216.0s (strictly greater than song length 212.35s).
 * Total frames: 12,960 frames.
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

const PORT = 9070;
const FPS = 60;

// Default duration: 216.0 seconds (> song duration 212.35s)
const durationArg = parseFloat(process.argv[2]);
const DURATION = (!isNaN(durationArg) && durationArg > 0) ? durationArg : 216.0;
const TOTAL_FRAMES = Math.round(DURATION * FPS);

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

server.listen(PORT, async () => {
  console.log(`================================================================`);
  console.log(`🎬 Mili - world.execute(me); Full MV 1080p60 Production Renderer`);
  console.log(`📺 Resolution: 1920x1080 (Full HD) | Framerate: ${FPS} FPS`);
  console.log(`⏱️ Duration: ${DURATION.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);
  console.log(`⚙️ Pure Function Pipeline: frame[n] = render(n / ${FPS})`);
  console.log(`================================================================`);

  const ffmpegPath = path.resolve(rootDir, 'node_modules/ffmpeg-static/ffmpeg.exe');
  const audioPath = path.resolve(rootDir, 'assets/audio/world-execute-me.wav');
  const outputDir = path.resolve(rootDir, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.resolve(outputDir, 'shot01.mp4');

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', `${FPS}`,
    '-i', 'pipe:0',
    '-ss', '0',
    '-i', audioPath,
    '-t', `${DURATION}`,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-crf', '18',
    '-movflags', '+faststart',
    '-af', `apad=whole_dur=${DURATION}`,
    '-c:a', 'aac',
    '-b:a', '320k',
    outputPath
  ];

  const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'ignore', 'ignore']
  });
  ffmpegProc.on('error', (err) => console.error('FFmpeg process error:', err));
  ffmpegProc.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('FFmpeg stdin error:', err);
  });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log(`🚀 Launching Headless Browser: ${browserPath}`);
  const browserProc = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu=false',
    '--window-size=1920,1080',
    `http://localhost:${PORT}/index.html?render=1`
  ]);

  wss.on('connection', (ws) => {
    console.log(`🔗 Browser connected to render bridge. Starting frame dispatch...`);
    let framesReceived = 0;
    let nextFrameToRequest = 0;
    let isEnded = false;
    const MAX_IN_FLIGHT = 2;
    const startTime = Date.now();

    function dispatchNext() {
      if (isEnded) return;
      while (nextFrameToRequest - framesReceived < MAX_IN_FLIGHT && nextFrameToRequest < TOTAL_FRAMES) {
        const t = nextFrameToRequest / FPS;
        ws.send(JSON.stringify({ type: 'render', t, frame: nextFrameToRequest }));
        nextFrameToRequest++;
      }
    }

    ws.on('message', (msg) => {
      if (typeof msg === 'string') {
        const data = JSON.parse(msg);
        if (data.type === 'ready') {
          dispatchNext();
        }
      } else {
        if (isEnded) return; // Drop any stray frames after completion

        ffmpegProc.stdin.write(Buffer.from(msg));
        framesReceived++;

        if (framesReceived % 120 === 0 || framesReceived === TOTAL_FRAMES) {
          const elapsedSec = (Date.now() - startTime) / 1000;
          const fps = framesReceived / elapsedSec;
          const pct = ((framesReceived / TOTAL_FRAMES) * 100).toFixed(1);
          const remFrames = TOTAL_FRAMES - framesReceived;
          const etaSec = (remFrames / (fps || 1)).toFixed(0);
          const videoTime = (framesReceived / FPS).toFixed(1);

          process.stdout.write(`\r[RENDER] Frame: ${framesReceived}/${TOTAL_FRAMES} (${pct}%) | Time: ${videoTime}s/${DURATION}s | Speed: ${fps.toFixed(1)} fps | ETA: ${etaSec}s    `);
        }

        if (framesReceived >= TOTAL_FRAMES) {
          isEnded = true;
          console.log('\n\n✅ All 12,960 frames dispatched! Finalizing video muxing and moov atom...');
          ffmpegProc.stdin.end();

          ffmpegProc.on('close', (code) => {
            const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`🎉 Complete MV Encoding completed in ${totalElapsed}s (exit code ${code})`);
            console.log(`📁 Saved video to: ${outputPath}`);

            browserProc.kill();
            server.close();
            process.exit(0);
          });
        } else {
          dispatchNext();
        }
      }
    });
  });
});
