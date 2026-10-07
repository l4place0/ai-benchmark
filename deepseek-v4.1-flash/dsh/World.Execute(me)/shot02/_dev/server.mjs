// server.mjs — static file server + ordered H.264 chunk sink.
//
//   node _dev/server.mjs [--port=8802] [--root=..]
//
// The sink supports byte-exact rollback: /truncate?bytes=N&seq=S resets the
// stream file to exactly N bytes and the next expected chunk index to S, so an
// interrupted render resumes without duplicating or dropping a single frame.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const opt = (n, d) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const PORT = Number(opt('port', '8802'));
const ROOTDIR = path.resolve(ROOT, opt('root', '.'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ------------------------------------------------------------------ sink */
let sinkPath = path.join(ROOT, '_dev/tmp/mv.h264');
let sinkFd = null;
let sinkBytes = 0;
let sinkSeq = 0;

function openSink(file, { resume = false, bytes = 0, seq = 0 } = {}) {
  if (sinkFd !== null) { try { fs.closeSync(sinkFd); } catch { /* ignore */ } sinkFd = null; }
  sinkPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
  fs.mkdirSync(path.dirname(sinkPath), { recursive: true });
  if (resume && fs.existsSync(sinkPath)) {
    const st = fs.statSync(sinkPath);
    sinkBytes = Math.min(bytes, st.size);
    fs.truncateSync(sinkPath, sinkBytes);      // exact rollback
    sinkSeq = seq;
    sinkFd = fs.openSync(sinkPath, 'r+');
    fs.ftruncateSync(sinkFd, sinkBytes);
  } else {
    sinkFd = fs.openSync(sinkPath, 'w');
    sinkBytes = 0;
    sinkSeq = 0;
  }
  // always append from the end
  fs.closeSync(sinkFd);
  sinkFd = fs.openSync(sinkPath, 'r+');
  return { path: sinkPath, bytes: sinkBytes, seq: sinkSeq };
}

function readBody(req, limit = 256 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const json = (res, obj, code = 200) => {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length, 'cache-control': 'no-store' });
  res.end(b);
};

/* ----------------------------------------------------------------- server */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  try {
    if (p === '/state') {
      return json(res, { path: sinkPath, bytes: sinkBytes, chunks: sinkSeq });
    }
    if (p === '/reset') {
      const file = url.searchParams.get('out') || '_dev/tmp/mv.h264';
      const resume = url.searchParams.get('resume') === '1';
      const bytes = Number(url.searchParams.get('bytes') || 0);
      const seq = Number(url.searchParams.get('seq') || 0);
      return json(res, openSink(file, { resume, bytes, seq }));
    }
    if (p === '/truncate') {
      const bytes = Number(url.searchParams.get('bytes') || 0);
      const seq = Number(url.searchParams.get('seq') || 0);
      if (sinkFd === null) openSink(sinkPath, { resume: true, bytes, seq });
      fs.ftruncateSync(sinkFd, bytes);
      sinkBytes = bytes;
      sinkSeq = seq;
      return json(res, { bytes: sinkBytes, nextSeq: sinkSeq });
    }
    if (p === '/chunk') {
      const seq = Number(url.searchParams.get('seq') || 0);
      const body = await readBody(req);
      if (seq !== sinkSeq) {
        return json(res, { error: 'out-of-order chunk', expected: sinkSeq, got: seq }, 409);
      }
      fs.writeSync(sinkFd, body, 0, body.length, sinkBytes);
      sinkBytes += body.length;
      sinkSeq += 1;
      return json(res, { seq: sinkSeq, bytes: sinkBytes });
    }
    if (p === '/log') {
      const body = await readBody(req, 4 * 1024 * 1024);
      process.stdout.write('[page] ' + body.toString('utf8') + '\n');
      return json(res, { ok: true });
    }
    if (p === '/quit') {
      json(res, { ok: true });
      setTimeout(() => process.exit(0), 50);
      return;
    }

    /* -------------------------------------------------- static files */
    let rel = p === '/' ? '/index.html' : p;
    const full = path.resolve(ROOTDIR, '.' + rel);
    if (!full.startsWith(ROOTDIR)) { res.writeHead(403); return res.end('forbidden'); }
    let st;
    try { st = await fsp.stat(full); } catch { res.writeHead(404); return res.end('not found'); }
    if (st.isDirectory()) { res.writeHead(403); return res.end('directory'); }
    const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'content-length': st.size,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    json(res, { error: String(e && e.message || e) }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`server  http://127.0.0.1:${PORT}/   root=${ROOTDIR}`);
});
