// audiotest.mjs — runs the audio + font rehearsal inside headless Chrome.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(here, 'audiotest.html')).href;

const browser = await Browser.launch({ width: 900, height: 600 });
try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Log.enable');
  const errs = [];
  browser.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    errs.push((d.exception && d.exception.description) || d.text);
  });
  browser.on('Log.entryAdded', (p) => { if (p.entry && p.entry.level === 'error') errs.push(p.entry.text); });

  await browser.send('Page.navigate', { url });
  await sleep(1500);
  const ready = await browser.evaluate('!!window.__AUDIOTEST__', { awaitPromise: false });
  if (!ready) {
    process.stdout.write('audiotest module did not load\n');
    process.exitCode = 1;
  } else {
    const report = await browser.evaluate('JSON.stringify(window.__AUDIOTEST__.run())');
    await sleep(300);
    await browser.evaluate('window.__AUDIOTEST__.stopAll()', { awaitPromise: false });
    await sleep(300);
    process.stdout.write('report: ' + report + '\n');
    process.stdout.write('page errors: ' + (errs.length ? errs.join(' | ') : 'none') + '\n');
  }
} catch (e) {
  process.stdout.write('FAILED ' + e.stack + '\n');
  process.exitCode = 1;
} finally {
  await browser.close();
}
