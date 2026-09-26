import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

console.log('--- Index.html Verification ---');
console.log('HTML size:', html.length);
console.log('importmap check:', html.includes('<script type="importmap">'));
console.log('three importmap mapping check:', html.includes('"three": "./js/libs/three.module.js"'));
console.log('main.js module check:', html.includes('src="./js/main.js"'));

const cssFiles = ['common.css', 'welcome.css', 'timeline.css', 'gallery.css', 'modal.css'];
cssFiles.forEach(f => {
  const exists = fs.existsSync(path.join(baseDir, 'css', f));
  console.log(`css/${f} exists:`, exists);
});

const jsFiles = [
  'data/artHistoryData.js',
  'systems/WelcomeView.js',
  'systems/TimelineView.js',
  'systems/DetailModal.js',
  'systems/App.js',
  'main.js'
];
jsFiles.forEach(f => {
  const exists = fs.existsSync(path.join(baseDir, 'js', f));
  console.log(`js/${f} exists:`, exists);
});
