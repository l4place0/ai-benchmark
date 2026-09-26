import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');

let externalFound = 0;
function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== 'libs' && f !== '.git' && f !== 'node_modules') scanDir(full);
    } else if (f.endsWith('.html') || f.endsWith('.css') || (f.endsWith('.js') && !f.includes('scan_network') && !f.includes('verify_'))) {
      const content = fs.readFileSync(full, 'utf8');
      // Look for src="http, href="http, @import url(http, url(http
      const networkRegex = /(?:src|href|url)\s*[:=\(]\s*["']?(https?:[^\s"')]+)/gi;
      let match;
      while ((match = networkRegex.exec(content)) !== null) {
        // Exclude manifest/metadata strings
        if (f.endsWith('.html') || f.endsWith('.css')) {
          console.warn(`[EXTERNAL NETWORK URL FOUND] in ${path.relative(baseDir, full)}: ${match[1]}`);
          externalFound++;
        }
      }
    }
  }
}

console.log('--- Scanning for external network dependencies ---');
scanDir(baseDir);
console.log(`--- Scan completed: ${externalFound} external network dependencies found ---`);
if (externalFound > 0) process.exit(1);
