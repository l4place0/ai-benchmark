// Locate the locally-downloaded Chrome (inside tools/browsers)
const fs = require('fs');
const path = require('path');
function walk(dir, name, depth = 0) {
  if (depth > 5 || !fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === name) return p;
    if (e.isDirectory()) { const r = walk(p, name, depth + 1); if (r) return r; }
  }
  return null;
}
function findChrome() {
  const base = path.join(__dirname, 'browsers');
  return walk(path.join(base, 'chrome'), 'chrome.exe') || walk(path.join(base, 'chrome-headless-shell'), 'chrome-headless-shell.exe');
}
module.exports = { findChrome };
