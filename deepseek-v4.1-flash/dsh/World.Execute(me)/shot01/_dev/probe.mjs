// probe.mjs — measure WebGL + WebCodecs capability/perf inside Chrome.
import { attach, launch, close } from './chrome.mjs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const standalone = process.argv.includes('--standalone');

const cdp = standalone
  ? await launch({ width: 1920, height: 1080, headless: !process.argv.includes('--headed') })
  : await attach({ width: 1920, height: 1080 });
try {
  await cdp.send('Page.navigate', { url: pathToFileURL(resolve(here, 'probe.html')).href });
  await new Promise(r => setTimeout(r, 2500));
  const rep = await cdp.eval('probe()', { awaitPromise: true, timeout: 600000 });
  console.log(JSON.stringify(rep, null, 2));
  if (cdp.logs.length) console.log('--- console ---\n' + cdp.logs.join('\n'));
} catch (e) {
  console.error('PROBE FAILED: ' + e.message);
  if (cdp.logs.length) console.error(cdp.logs.join('\n'));
  process.exitCode = 1;
} finally {
  await close(cdp);
}
