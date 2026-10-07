// get.mjs <url> <outFile>  — fetch text/html with retries, strip tags, write plain text.
import { writeFileSync } from 'node:fs';
const [url, out] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let html = null;
for (let i = 1; i <= 5; i++) {
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    html = await r.text();
    break;
  } catch (e) {
    console.error(`try ${i}: ${e.message}`);
    if (i === 5) { console.error('GIVE UP'); process.exit(1); }
    await sleep(1500 * i);
  }
}
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t\u00a0]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n');
writeFileSync(out, text);
console.log('wrote ' + out + ' (' + text.length + ' chars)');
