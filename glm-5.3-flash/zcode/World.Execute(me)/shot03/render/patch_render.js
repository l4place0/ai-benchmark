// patch_render.js — one-shot patcher for render/main.js + mv/mv_main.js (resume + flush)
const fs = require('fs');
let m = fs.readFileSync('mv/mv_main.js', 'utf8');
const oldBatch = `      if (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (encError) throw new Error(String(encError));
    }
    enc.__i = i0 + n;`;
const newBatch = `      if (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (encError) throw new Error(String(encError));
    }
    await enc.flush();                      // batch-complete guarantee: all frames of this batch are emitted
    if (encError) throw new Error(String(encError));
    enc.__i = i0 + n;`;
if (!m.includes(oldBatch)) throw new Error('mv_main batch pattern not found');
m = m.replace(oldBatch, newBatch);
fs.writeFileSync('mv/mv_main.js', m);

let s = fs.readFileSync('render/main.js', 'utf8');
s = s.replace('const BATCH = 60, MAXRUNS = 4;', 'const BATCH = 60, MAXRUNS = 6;');
s = s.replace('let totalBytes = 0, doneFrames = 0;', 'let totalBytes = 0, doneFrames = FROM;');
s = s.replace("const BATCH = 60, MAXRUNS = 6;", "const BATCH = 60, MAXRUNS = 6, FROM = Math.max(0, parseInt(arg[arg.indexOf('--from') + 1]) || 0);");
s = s.replace("const hFile = fs.createWriteStream(h264raw, { flags: doneFrames ? 'a' : 'w', highWaterMark: 1 << 24 });",
  "const hFile = fs.createWriteStream(h264raw, { flags: (doneFrames > 0 || FROM > 0) ? 'a' : 'w', highWaterMark: 1 << 24 });");

const oldLoop = `          for (let i0 = doneFrames; i0 < NF; i0 += BATCH) {
            const n = Math.min(BATCH, NF - i0);
            await page.evaluate((a, b) => window.__renderBatch(a, b), i0, n);
            const d = await page.evaluate('window.__drain()');
            const buf = Buffer.from(d.b64, 'base64');
            totalBytes += buf.length;
            await new Promise(r => hFile.write(buf, r));
            doneFrames = i0 + n;
            const el = (Date.now() - t0) / 1000, fps = Math.max(0.1, (doneFrames - (run ? 0 : 0)) / el);
            if ((i0 / BATCH) % 10 === 0 || doneFrames >= NF)
              console.log(\`F \${doneFrames}/\${NF}  \${fps.toFixed(1)}fps  eta=\${((NF - doneFrames) / fps / 60).toFixed(1)}min  \${(totalBytes / 1048576).toFixed(0)}MB\`);
          }`;
const newLoop = `          let failed = null;
          for (let i0 = doneFrames; i0 < NF; i0 += BATCH) {
            try {
              const n = Math.min(BATCH, NF - i0);
              await page.evaluate((a, b) => window.__renderBatch(a, b), i0, n);
              const d = await page.evaluate('window.__drain()');
              const buf = Buffer.from(d.b64, 'base64');
              totalBytes += buf.length;
              await new Promise(r => hFile.write(buf, r));
              doneFrames = i0 + n;
            } catch (e) { failed = e; break; }
            const el = (Date.now() - t0) / 1000, fps = Math.max(0.1, doneFrames / el);
            if ((i0 / BATCH) % 10 === 0 || doneFrames >= NF)
              console.log(\`F \${doneFrames}/\${NF}  \${fps.toFixed(1)}fps  eta=\${((NF - doneFrames) / fps / 60).toFixed(1)}min  \${(totalBytes / 1048576).toFixed(0)}MB\`);
          }
          if (failed) console.log('batch failed:', String(failed.message).slice(0, 140));
          await new Promise(r => hFile.end(r));
          if (!failed) break;`;
if (!s.includes(oldLoop)) throw new Error('main loop pattern not found');
s = s.replace(oldLoop, newLoop);

const oldFin = `          try {
            const fin = await page.evaluate('window.__finish()');
            if (fin.bytes) { hFile.write(Buffer.from(fin.b64, 'base64')); totalBytes += fin.bytes; }
          } catch (e) { console.log('finish failed:', e.message.slice(0, 120)); }
          await new Promise(r => hFile.end(r));`;
const newFin = `          if (!failed) {
            try {
              const fin = await page.evaluate('window.__finish()');
              if (fin.bytes) { const hf = fs.createWriteStream(h264raw, { flags: 'a' }); hf.write(Buffer.from(fin.b64, 'base64')); await new Promise(r => hf.end(r)); totalBytes += fin.bytes; }
            } catch (e) { console.log('finish failed:', e.message.slice(0, 120)); }
          }`;
if (!s.includes(oldFin)) throw new Error('finish pattern not found');
s = s.replace(oldFin, newFin);
fs.writeFileSync('render/main.js', s);
console.log('patched: render/main.js + mv/mv_main.js');
