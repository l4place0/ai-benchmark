// server.mjs — dev/static server for the MV app + a sink that receives the
// in-browser WebCodecs H.264 stream (Annex-B) so Node can mux it with ffmpeg.
//
//   GET  /*            -> static files from project root
//   POST /chunk?seq=N  -> append encoded chunk N (raw bytes) to the output stream
//   POST /status       -> page-side progress JSON (kept in memory)
//   GET  /state        -> { chunks, bytes, ordered, status }
//   POST /reset?out=f  -> truncate output file and reset counters
import { createServer } from 'node:http';
import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TMP = join(HERE, 'tmp');
mkdirSync(TMP, { recursive: true });

const PORT = Number((process.argv.find(a => a.startsWith('--port=')) || '--port=8791').split('=')[1]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.glsl': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

let outPath = join(TMP, 'stream.h264');
let fh = null;
let nextSeq = 0;
let bytes = 0;
let received = 0;
const pending = new Map();
let status = {};

async function openOut(p, { resume = false, seq = 0 } = {}) {
  if (fh) { try { await fh.close(); } catch {} }
  outPath = p;
  if (resume && existsSync(p)) {
    const { size } = statSync(p);
    fh = await open(p, 'r+');
    nextSeq = seq; bytes = size; received = 0;
  } else {
    await writeFile(outPath, Buffer.alloc(0));
    fh = await open(outPath, 'r+');
    nextSeq = 0; bytes = 0; received = 0;
  }
  pending.clear();
}

async function flushPending() {
  while (pending.has(nextSeq)) {
    const buf = pending.get(nextSeq);
    pending.delete(nextSeq);
    await fh.write(buf, 0, buf.length, bytes);
    bytes += buf.length;
    nextSeq++;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);

  if (req.method === 'POST' && path === '/chunk') {
    const seq = Number(url.searchParams.get('seq'));
    const parts = [];
    for await (const c of req) parts.push(c);
    const buf = Buffer.concat(parts);
    received++;
    if (!fh) await openOut(outPath);
    pending.set(seq, buf);
    await flushPending();
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  if (req.method === 'POST' && path === '/status') {
    const parts = [];
    for await (const c of req) parts.push(c);
    try { status = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch {}
    res.writeHead(200); return res.end('ok');
  }

  if (req.method === 'POST' && path === '/reset') {
    const out = url.searchParams.get('out');
    const resume = url.searchParams.get('resume') === '1';
    const seq = Number(url.searchParams.get('seq') || '0');
    await openOut(out ? resolve(ROOT, out) : outPath, { resume, seq });
    res.writeHead(200); return res.end('ok');
  }

  if (req.method === 'POST' && path === '/truncate') {
    const b = Number(url.searchParams.get('bytes') || '0');
    const s = Number(url.searchParams.get('seq') || '0');
    if (!fh) await openOut(outPath);
    await fh.truncate(b);
    bytes = b; nextSeq = s; received = 0;
    pending.clear();
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ bytes, nextSeq }));
  }

  if (path === '/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ chunks: nextSeq, received, bytes, buffered: pending.size, out: outPath, status }));
  }

  // static
  let file = join(ROOT, normalize(path).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
  if (!existsSync(file)) { res.writeHead(404); return res.end('not found: ' + path); }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] http://127.0.0.1:${PORT}/  root=${ROOT}`);
  console.log(`[server] stream sink -> ${outPath}`);
});
