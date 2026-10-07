// probe.mjs — ask the running Chrome what it can do (GPU, WebGL2, WebCodecs).
import { attach, close } from './chrome.mjs';

const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.slice(7) || '8802');
const cdp = await attach({ width: 1920, height: 1080 });
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/_dev/probe.html` });
  for (let i = 0; i < 120; i++) {
    const done = await cdp.eval('typeof window.__probe !== "undefined"');
    if (done) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const out = await cdp.eval('window.__probe');
  console.log(JSON.stringify(out, null, 2));
  if (cdp.logs.length) console.log('\npage log:\n' + cdp.logs.slice(-20).join('\n'));
} finally {
  await close(cdp);
}
