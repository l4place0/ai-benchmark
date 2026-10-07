// shot.mjs — grab a screenshot of any local page.
//   node _dev/shot.mjs <file-or-url> <out.png> [width] [height] [waitMs]

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const [, , target, out, w, h, waitMs] = process.argv;
if (!target || !out) {
  process.stdout.write('usage: node _dev/shot.mjs <file> <out.png> [w] [h] [waitMs]\n');
  process.exit(1);
}
const url = /^[a-z]+:\/\//i.test(target) ? target : pathToFileURL(path.resolve(target)).href;

const browser = await Browser.launch({ width: +(w || 1440), height: +(h || 900) });
try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Log.enable');
  const errs = [];
  browser.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    errs.push((d.exception && d.exception.description) || d.text);
  });
  browser.on('Log.entryAdded', (p) => {
    if (p.entry && p.entry.level === 'error') errs.push(p.entry.text);
  });
  await browser.send('Page.navigate', { url });
  await sleep(+(waitMs || 2600));
  await browser.screenshot(out);
  process.stdout.write('saved ' + out + '\n');
  if (errs.length) process.stdout.write('page errors:\n  ' + errs.join('\n  ') + '\n');
  else process.stdout.write('no page errors\n');
} finally {
  await browser.close();
}
