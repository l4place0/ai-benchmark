// dl2.mjs — resumable downloader using HTTP Range (for flaky large files).
// usage: node dl2.mjs <url> <out> [--tries=40] [--chunk=4194304]
import { createWriteStream, existsSync, statSync, openSync, writeSync, closeSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out] = process.argv.slice(2);
const arg = (n, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${n}=`));
  return hit ? Number(hit.split('=')[1]) : d;
};
const tries = arg('tries', 40);
const chunk = arg('chunk', 4 * 1024 * 1024);
mkdirSync(dirname(out), { recursive: true });

let total = null;
try {
  const h = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(60000) });
  total = Number(h.headers.get('content-length')) || null;
  if (h.headers.get('accept-ranges') !== 'bytes') console.error('[warn] server did not advertise range support');
} catch (e) { console.error('[warn] HEAD failed: ' + e.message); }
console.log(`[dl2] target size = ${total}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let got = existsSync(out) ? statSync(out).size : 0;
if (total && got > total) { got = 0; }
const fd = openSync(out, got ? 'r+' : 'w');

for (let i = 1; i <= tries; i++) {
  if (total && got >= total) break;
  const end = total ? Math.min(got + chunk - 1, total - 1) : got + chunk - 1;
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(180000),
      headers: { Range: `bytes=${got}-${end}` },
    });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) throw new Error('empty body');
    writeSync(fd, buf, 0, buf.length, got);
    got += buf.length;
    process.stdout.write(`\r[dl2] ${got}${total ? '/' + total : ''} (${total ? (100 * got / total).toFixed(1) : '?'}%)   `);
  } catch (e) {
    console.error(`\n[dl2] attempt ${i} failed at ${got}: ${e.message}`);
    await sleep(1500 + 500 * (i % 6));
  }
}
closeSync(fd);
if (total && got < total) { console.error(`\n[dl2] INCOMPLETE ${got}/${total}`); process.exit(1); }
console.log(`\n[dl2] DONE ${out} ${got} bytes`);
