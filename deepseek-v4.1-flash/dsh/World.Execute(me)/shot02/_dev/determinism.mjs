// determinism.mjs — prove that a frame is a pure function of t.
//
// Renders a set of frames twice: the second pass in a shuffled order with
// unrelated frames rendered in between. If the pixels are identical, no state
// leaks from one frame to the next and the stream is reproducible.
import { attach, close } from './chrome.mjs';

const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || '8802');
const DBG = Number(process.argv.find((a) => a.startsWith('--debug-port='))?.slice(13) || '9333');
const FRAMES = (process.argv.find((a) => a.startsWith('--frames='))?.slice(9) || '137,2320,6600,9000,11400,12600')
  .split(',').map(Number);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cdp = await attach({ width: 1920, height: 1080, port: DBG });
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?capture=1` });
  for (let i = 0; i < 400; i++) {
    if (await cdp.eval('!!(window.MV && window.MV.ready)')) break;
    const err = await cdp.eval('window.__error || null');
    if (err) throw new Error('page error: ' + err);
    await sleep(250);
  }

  const hash = async (f) => cdp.eval(`window.MV.hash(${f} / 60)`);

  const passA = [];
  for (const f of FRAMES) passA.push(await hash(f));

  // shuffled, with unrelated frames interleaved
  const order = FRAMES.map((f, i) => ({ f, i })).sort((a, b) => ((a.f * 7919) % 101) - ((b.f * 7919) % 101));
  const passB = new Array(FRAMES.length);
  for (let k = 0; k < order.length; k++) {
    await hash(order[k].f + 41);            // an unrelated frame in between
    passB[order[k].i] = await hash(order[k].f);
    await hash(1 + k * 17);
  }

  console.log('  frame     pass A       pass B      match');
  let allOk = true;
  for (let i = 0; i < FRAMES.length; i++) {
    const ok = passA[i] === passB[i];
    if (!ok) allOk = false;
    console.log(`  ${String(FRAMES[i]).padStart(5)}  ${String(passA[i]).padStart(10)}  ${String(passB[i]).padStart(10)}  ${ok ? 'OK' : 'MISMATCH'}`);
  }
  console.log(allOk
    ? '\nDETERMINISTIC: every frame is a pure function of t (order-independent, no hidden state).'
    : '\nNON-DETERMINISTIC: frames depend on render history.');
  if (!allOk) process.exitCode = 1;
  if (cdp.logs.length) console.log('page log:\n' + cdp.logs.slice(-10).join('\n'));
} catch (e) {
  console.error('DETERMINISM CHECK FAILED: ' + e.message);
  process.exitCode = 1;
} finally {
  await close(cdp);
}
