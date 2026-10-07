// shot.mjs — render still frames from the MV page for review.
// usage: node shot.mjs t1 [t2 t3 ...] [--w=1920] [--out=dir] [--full]
import { attach, close } from './chrome.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const args = process.argv.slice(2);
const times = args.filter(a => !a.startsWith('--')).map(Number);
const opt = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d; };
const PORT = Number(opt('port', '8791'));
const OUT = join(HERE, '..', opt('out', '_dev/shots'));
mkdirSync(OUT, { recursive: true });
const full = args.includes('--full');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const srv = spawn(process.execPath, ['server.mjs', `--port=${PORT}`], { cwd: HERE, stdio: 'ignore' });
let up = false;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/state`); if (r.ok) { up = true; break; } } catch {}
  await sleep(200);
}
if (!up) { console.error('server failed'); process.exit(1); }

const cdp = await attach({ width: 1920, height: 1080 });
try {
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?still=1` });
  let ready = false;
  for (let i = 0; i < 160; i++) {
    ready = await cdp.eval('!!(window.MV && window.MV.ready)');
    if (ready) break;
    if (await cdp.eval('!!window.__error')) break;
    await sleep(250);
  }
  const err = await cdp.eval('window.__error || null');
  if (err) { console.error('PAGE ERROR:\n' + err); process.exitCode = 1; }
  if (!ready) throw new Error('MV never became ready');
  // debug switches: --dbg=noGlyph=1,noBox=1
  for (const a of args.filter(a => a.startsWith('--dbg='))) {
    for (const kv of a.slice(6).split(',')) {
      const [k, v] = kv.split('=');
      await cdp.eval(`MV.mv.debug[${JSON.stringify(k)}] = ${v === '0' ? 'false' : 'true'}`);
    }
  }
  console.log('ready. renderer: ' + await cdp.eval(
    `(()=>{const d=MV.mv.gl.getExtension('WEBGL_debug_renderer_info');return MV.mv.gl.getParameter(d.UNMASKED_RENDERER_WEBGL);})()`));

  for (const t of times) {
    const t0 = Date.now();
    const dataUrl = await cdp.eval(
      `(()=>{ MV.renderTime(${t}); return MV.mv.canvas.toDataURL('image/png'); })()`,
      { timeout: 300000 });
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const name = `t${t.toFixed(2).replace('.', '_')}.png`;
    writeFileSync(join(OUT, name), buf);
    console.log(`  ${name}  ${(buf.length / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`);
  }
  if (cdp.logs.length) console.log('--- console ---\n' + cdp.logs.slice(-25).join('\n'));
} catch (e) {
  console.error('SHOT FAILED: ' + e.message);
  if (cdp.logs.length) console.error(cdp.logs.slice(-30).join('\n'));
  process.exitCode = 1;
} finally {
  await close(cdp);
  srv.kill();
}
