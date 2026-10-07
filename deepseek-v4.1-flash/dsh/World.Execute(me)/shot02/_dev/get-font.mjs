// get-font.mjs — fetch a monospace webfont into assets/ (no npm install needed).
// Downloads the npm tarball directly so nothing lands outside the work directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TMP = path.join(ROOT, '_dev/tmp');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });

async function dl(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      console.log(`  retry ${i + 1} ${url.split('/').pop()} : ${e.message}`);
      await new Promise((s) => setTimeout(s, 1200));
    }
  }
  throw new Error('giving up ' + url);
}

const PKG = process.argv[2] || '@fontsource/jetbrains-mono';
const meta = await (await dl(`https://registry.npmjs.org/${PKG.replace('/', '%2f')}`)).toString('utf8');
const j = JSON.parse(meta);
const ver = j['dist-tags'].latest;
const tarball = j.versions[ver].dist.tarball;
console.log(`${PKG}@${ver}\n  ${tarball}`);
const buf = await dl(tarball);
fs.writeFileSync(path.join(TMP, 'font.tgz'), buf);
console.log('  downloaded', (buf.length / 1048576).toFixed(2), 'MB');
