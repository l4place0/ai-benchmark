/* =========================================================================
   Pure Line Room — _tools/offline.mjs
   Proves the piece needs nothing but its own files:
     · no fetch / XHR / WebSocket / EventSource / importScripts at runtime
     · no external URLs anywhere in the shipped sources
     · no <img>, <audio>, <video>, <link> to a remote host
     · every script the page loads exists
   usage: node _tools/offline.mjs
   ========================================================================= */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const problems = [];
const shipped = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(js|css|html)$/.test(name)) shipped.push(p);
  }
}
walk(join(ROOT, 'js'));
shipped.push(join(ROOT, 'index.html'), join(ROOT, 'css', 'style.css'));

/* 1. runtime network primitives */
const NET_API = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|importScripts|navigator\.sendBeacon|navigator\.serviceWorker)\b/;
for (const f of shipped) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;          // comments are fine
    if (NET_API.test(line)) {
      problems.push(relative(ROOT, f) + ':' + (i + 1) + ' uses a network API: ' + line.trim().slice(0, 80));
    }
  });
}

/* 2. external URLs */
const URL_RE = /(?<![\w.])(?:https?:)?\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi;
for (const f of shipped) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    const m = line.match(URL_RE);
    if (m && !/w3\.org|example\.com|127\.0\.0\.1|localhost/.test(line)) {
      problems.push(relative(ROOT, f) + ':' + (i + 1) + ' external URL: ' + m.join(','));
    }
  });
}

/* 3. remote media / fonts */
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const tag of ['img', 'audio', 'video', 'source', 'link', 'iframe', 'object', 'embed']) {
  const re = new RegExp('<' + tag + '\\b[^>]*>', 'gi');
  const hits = html.match(re) || [];
  for (const h of hits) {
    const srcMatch = h.match(/(?:src|href)\s*=\s*"([^"]*)"/i);
    if (srcMatch && /^(https?:)?\/\//i.test(srcMatch[1])) {
      problems.push('index.html remote <' + tag + '>: ' + h.slice(0, 90));
    }
  }
}
/* 3b. remote fonts in css */
const css = readFileSync(join(ROOT, 'css', 'style.css'), 'utf8');
if (/@import|@font-face|url\(\s*['"]?https?:/i.test(css)) {
  problems.push('css/style.css pulls a remote resource');
}
if (/@font-face/i.test(css)) {
  problems.push('css/style.css declares a font face');
}

/* 4. every referenced local file exists */
const refs = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/gi)].map((m) => m[1])
  .filter((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('#') && !r.startsWith('data:'));
const missing = refs.filter((r) => !existsSync(join(ROOT, r)));
if (missing.length) problems.push('referenced files missing: ' + missing.join(', '));

/* 5. fonts must be system fonts only */
const webFonts = /\b(fonts\.googleapis|fonts\.gstatic|use\.typekit|@font-face)\b/i;
for (const f of shipped) {
  if (webFonts.test(readFileSync(f, 'utf8'))) problems.push(relative(ROOT, f) + ' references a web font');
}

/* 6. audio must be synthesised, never loaded */
const audioFiles = [];
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/^_/.test(name)) scan(p); }
    else if (/\.(mp3|wav|ogg|m4a|aac|flac|opus|webm|mp4|png|jpe?g|gif|svg|woff2?|ttf|otf)$/i.test(name)) audioFiles.push(relative(ROOT, p));
  }
})(ROOT);
if (audioFiles.length) problems.push('binary media in the tree: ' + audioFiles.join(', '));

console.log('files audited      : ' + shipped.length);
console.log('local refs resolved: ' + (refs.length - missing.length) + '/' + refs.length);
console.log('media/font binaries: ' + (audioFiles.length ? audioFiles.join(', ') : 'none'));
console.log('network APIs       : ' + (problems.filter((p) => p.includes('network API')).length));
console.log('external URLs      : ' + (problems.filter((p) => p.includes('external URL')).length));
console.log('');
if (problems.length) {
  console.log('PROBLEMS');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('OFFLINE-CLEAN: the piece loads only its own files and never touches the network.');
