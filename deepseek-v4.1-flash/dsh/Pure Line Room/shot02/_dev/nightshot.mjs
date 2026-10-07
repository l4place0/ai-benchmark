// nightshot.mjs — day / dusk / night renders with the lamps on.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(here, 'shots');

const browser = await Browser.launch({ width: 1440, height: 900 });
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

  await browser.send('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (await browser.evaluate('!!window.__ROOM__', { awaitPromise: false }).catch(() => false)) break;
  }
  await browser.evaluate('window.__ROOM__.skipIntro()', { awaitPromise: false });
  await sleep(900);

  const shoot = async (name, state, extra) => {
    await browser.evaluate(`(() => {
      const R = window.__ROOM__;
      ${state}
      ${extra || ''}
    })()`, { awaitPromise: false });
    await sleep(3000);
    await browser.screenshot(path.join(outDir, name + '.png'));
    process.stdout.write('  ' + name + '\n');
  };

  await shoot('n1-day', `R.state.set('night', false); R.state.set('lampOn', false);
    R.state.set('pendantOn', false); R.state.set('lampFloorOn', false);
    R.state.set('blindsOpen', 1); R.state.set('curtainOpen', 1); R.state.set('fanSpeed', 0);`);

  await shoot('n2-dusk', `R.state.set('night', true); R.state.set('lampOn', true);
    R.state.set('pendantOn', true); R.state.set('lampFloorOn', true);`);

  await shoot('n3-night-work', `R.state.set('night', true); R.state.set('lampOn', true);
    R.state.set('fanSpeed', 2);`, `R.setCamera(-0.42, 0.26, 8.6);`);

  await shoot('n4-night-lounge', `R.state.set('night', true); R.state.set('pendantOn', true);
    R.state.set('vinylPlaying', true);`, `R.setCamera(1.15, 0.24, 8.8);`);

  await shoot('n5-night-wide', `R.state.set('night', true);`, `R.setCamera(0.62, 0.37, 12.4);`);

  await shoot('n6-day-blinds', `R.state.set('night', false); R.state.set('blindsOpen', 0);
    R.state.set('curtainOpen', 0); R.state.set('vinylPlaying', false);`,
  `R.setCamera(0.30, 0.32, 11.0);`);

  process.stdout.write('page errors: ' + (errs.length ? errs.join(' | ') : 'none') + '\n');
} finally {
  await browser.close();
}
