// Robust downloader: node dl.mjs <url> <outPath> [--tries=6] [--min=1024]
// Retries with backoff; verifies size; writes .part then renames.
import { writeFileSync, renameSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out] = process.argv.slice(2);
const tries = Number((process.argv.find(a => a.startsWith('--tries=')) || '--tries=6').split('=')[1]);
const minBytes = Number((process.argv.find(a => a.startsWith('--min=')) || '--min=1024').split('=')[1]);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function once() {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(600000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) throw new Error('too small: ' + buf.length);
  return buf;
}

let lastErr;
for (let i = 1; i <= tries; i++) {
  try {
    const buf = await once();
    mkdirSync(dirname(out), { recursive: true });
    const part = out + '.part';
    writeFileSync(part, buf);
    renameSync(part, out);
    console.log(`OK ${out} ${buf.length} bytes (attempt ${i})`);
    process.exit(0);
  } catch (e) {
    lastErr = e;
    const cause = e.cause ? (e.cause.code || e.cause.message) : '';
    console.error(`attempt ${i}/${tries} failed: ${e.message} ${cause}`);
    if (i < tries) await sleep(1200 * i);
  }
}
console.error('FAILED ' + url + ' :: ' + (lastErr && lastErr.message));
process.exit(1);
