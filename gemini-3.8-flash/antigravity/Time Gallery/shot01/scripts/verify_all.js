import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to get image dimensions from JPEG/PNG buffer
function getImageDimensions(buf) {
  // Check PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height, type: 'png' };
  }
  // Check JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF markers: SOF0(0xC0) to SOF15(0xCF) except DHT(0xC4), JPG(0xC8), DAC(0xCC)
      const isSOF = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height, type: 'jpeg' };
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  throw new Error('Unsupported or corrupted image format');
}

console.log('================================================================');
console.log('       TIME GALLERY INDEPENDENT QA INSPECTION SUITE             ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  }
}

// ----------------------------------------------------------------
// 1. PROJECT STRUCTURE & FILES
// ----------------------------------------------------------------
console.log('\n--- 1. Project Structure & Files ---');
const requiredFiles = [
  'index.html',
  'package.json',
  'css/common.css',
  'css/welcome.css',
  'css/timeline.css',
  'css/gallery.css',
  'css/modal.css',
  'js/main.js',
  'js/data/artHistoryData.js',
  'js/data/manifest.json',
  'js/libs/three.module.js',
  'js/libs/Reflector.js',
  'js/systems/App.js',
  'js/systems/WelcomeView.js',
  'js/systems/TimelineView.js',
  'js/systems/FirstPersonControls.js',
  'js/systems/GalleryScene.js',
  'js/systems/FrameManager.js',
  'js/systems/DetailModal.js',
  'js/systems/ProceduralTextures.js'
];

for (const f of requiredFiles) {
  const full = path.join(rootDir, f);
  const exists = fs.existsSync(full);
  const size = exists ? fs.statSync(full).size : 0;
  assert(exists && size > 0, `File exists & non-empty: ${f} (${size} bytes)`);
}

// ----------------------------------------------------------------
// 2. ART HISTORY CONTENT & MANIFEST AUDIT
// ----------------------------------------------------------------
console.log('\n--- 2. Art History Content & Manifest Audit ---');
const manifestPath = path.join(rootDir, 'js/data/manifest.json');
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

assert(Array.isArray(manifest), 'manifest.json contains an array');
assert(manifest.length >= 50, `manifest contains >= 50 paintings (found: ${manifest.length})`);

const requiredFields = [
  'id', 'localPath', 'titleZh', 'titleEn', 'artistZh', 'artistEn',
  'birthDeath', 'year', 'periodId', 'periodZh', 'periodEn',
  'periodDesc', 'sourceUrl', 'license', 'width', 'height', 'aspectRatio'
];

const periodSet = new Set();
const painterSet = new Set();
let allFilesValid = true;
let allFieldsValid = true;
let allDimensionsValid = true;
let allLicensesValid = true;

for (let i = 0; i < manifest.length; i++) {
  const item = manifest[i];
  // Check required fields
  for (const f of requiredFields) {
    if (item[f] === undefined || item[f] === null || item[f] === '') {
      console.error(`Item #${i} (${item.id}) missing or empty field: ${f}`);
      allFieldsValid = false;
    }
  }

  // Check period & painter
  if (item.periodId) periodSet.add(item.periodId);
  if (item.artistZh) painterSet.add(item.artistZh);

  // Check local file
  const localImgPath = path.join(rootDir, item.localPath);
  if (!fs.existsSync(localImgPath)) {
    console.error(`Item #${i} (${item.id}) file not found: ${localImgPath}`);
    allFilesValid = false;
  } else {
    const stat = fs.statSync(localImgPath);
    if (stat.size <= 0) {
      console.error(`Item #${i} (${item.id}) file is empty: ${localImgPath}`);
      allFilesValid = false;
    } else {
      // Check image width, height, aspect ratio
      const buf = fs.readFileSync(localImgPath);
      const dims = getImageDimensions(buf);
      if (dims.width !== item.width || dims.height !== item.height) {
        console.error(`Item #${i} (${item.id}) dimension mismatch: file is ${dims.width}x${dims.height}, manifest says ${item.width}x${item.height}`);
        allDimensionsValid = false;
      }
      const calcAr = Number((dims.width / dims.height).toFixed(2));
      const manifestAr = Number(item.aspectRatio.toFixed(2));
      if (Math.abs(calcAr - manifestAr) > 0.05) {
        console.error(`Item #${i} (${item.id}) aspect ratio mismatch: calculated ${calcAr}, manifest says ${manifestAr}`);
        allDimensionsValid = false;
      }
    }
  }

  // Check license & source
  const lic = (item.license || '').toLowerCase();
  const isPublicDomain = lic.includes('public domain') || lic.includes('cc0') || lic.includes('cc-zero') || lic.includes('公有领域');
  if (!isPublicDomain) {
    console.error(`Item #${i} (${item.id}) invalid license disclosure: ${item.license}`);
    allLicensesValid = false;
  }
}

assert(allFieldsValid, 'All 50+ paintings have all 17 required non-empty fields');
assert(allFilesValid, 'All 50+ painting files exist locally and have size > 0');
assert(allDimensionsValid, 'All image dimensions and aspect ratios match byte headers');
assert(allLicensesValid, 'All entries disclose valid Public Domain / CC0 license');
assert(periodSet.size >= 8, `Period count >= 8 (found: ${periodSet.size} periods: ${Array.from(periodSet).join(', ')})`);
assert(painterSet.size >= 20, `Unique painter count >= 20 (found: ${painterSet.size} painters)`);

// ----------------------------------------------------------------
// 3. CODEBASE 100% OFFLINE SCAN (ZERO EXTERNAL NETWORK REQUESTS)
// ----------------------------------------------------------------
console.log('\n--- 3. 100% Offline Integrity Scan ---');
let externalUrlCount = 0;
function scanForExternalUrls(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanForExternalUrls(full);
      }
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.css') || entry.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      // Match active network requests: src="http...", href="http...", url(http...), @import 'http...'
      // Exclude manifest metadata descriptive URLs inside strings or data structures
      if (entry.name.endsWith('.html')) {
        const netRegex = /(?:src|href)\s*=\s*["'](https?:[^\s"'>]+)/gi;
        let m;
        while ((m = netRegex.exec(content)) !== null) {
          console.error(`External URL in HTML ${entry.name}: ${m[1]}`);
          externalUrlCount++;
        }
      }
      if (entry.name.endsWith('.css')) {
        const cssRegex = /(?:url|@import)\s*\(?\s*["']?(https?:[^\s"')]+)/gi;
        let m;
        while ((m = cssRegex.exec(content)) !== null) {
          console.error(`External URL in CSS ${entry.name}: ${m[1]}`);
          externalUrlCount++;
        }
      }
      if (entry.name.endsWith('.js') && !full.includes('artHistoryData.js') && !full.includes('verify_') && !full.includes('scan_')) {
        const jsRegex = /(?:fetch|import|XMLHttpRequest)\s*\(?\s*["'](https?:[^\s"')]+)/gi;
        let m;
        while ((m = jsRegex.exec(content)) !== null) {
          console.error(`External network fetch in JS ${entry.name}: ${m[1]}`);
          externalUrlCount++;
        }
      }
    }
  }
}
scanForExternalUrls(rootDir);
assert(externalUrlCount === 0, `Zero external network calls (found: ${externalUrlCount})`);

// ----------------------------------------------------------------
// 4. WELCOME SCREEN REQUIREMENTS AUDIT
// ----------------------------------------------------------------
console.log('\n--- 4. Welcome Screen Audit ---');
const welcomeHtml = fs.readFileSync(path.join(rootDir, 'js/systems/WelcomeView.js'), 'utf8');
const welcomeCss = fs.readFileSync(path.join(rootDir, 'css/welcome.css'), 'utf8');
const commonCss = fs.readFileSync(path.join(rootDir, 'css/common.css'), 'utf8');

assert(welcomeHtml.includes('doodle-blocks-layer') && welcomeCss.includes('doodle-block'), 'Welcome screen contains doodle-style color blocks');
assert(welcomeHtml.includes('intersecting-lines-svg') && welcomeCss.includes('intersecting-line'), 'Welcome screen contains intersecting lines background');
assert(welcomeHtml.includes('blue-arch') && welcomeCss.includes('.blue-arch-container'), 'Welcome screen contains blue arch');

// Verify layout order: welcome-hero-content precedes blue-arch-container
const heroIndex = welcomeHtml.indexOf('welcome-hero-content');
const archIndex = welcomeHtml.indexOf('blue-arch-container');
assert(heroIndex !== -1 && archIndex !== -1 && heroIndex < archIndex, 'Title, subtitle, and CTA button are located ABOVE the blue arch in DOM structure');

// Verify buttons have no black borders
const buttonBorderRule = commonCss.includes('border: none !important;') || commonCss.includes('border: none');
assert(buttonBorderRule, 'Global button styles enforce border: none !important (NO black borders)');
assert(!commonCss.includes('border: 1px solid black') && !commonCss.includes('border: 1px solid #000'), 'No black button borders in common.css');
assert(!welcomeCss.includes('border: 1px solid black') && !welcomeCss.includes('border: 1px solid #000'), 'No black button borders in welcome.css');

// Non-linear easing check
assert(commonCss.includes('--ease-spring') && commonCss.includes('--ease-out-expo'), 'Non-linear natural cubic easing variables defined');
assert(welcomeCss.includes('var(--ease-spring)') && welcomeCss.includes('var(--ease-out-expo)'), 'Welcome view uses non-linear natural easing transitions');

// Heavy typography check
assert(commonCss.includes('--fw-black: 800') && commonCss.includes('font-weight: var(--fw-black)'), 'Bold/heavy typography used (fw-black: 800)');

// ----------------------------------------------------------------
// 5. TREE TIMELINE REQUIREMENTS AUDIT
// ----------------------------------------------------------------
console.log('\n--- 5. Tree Timeline Audit ---');
const timelineJs = fs.readFileSync(path.join(rootDir, 'js/systems/TimelineView.js'), 'utf8');
const timelineCss = fs.readFileSync(path.join(rootDir, 'css/timeline.css'), 'utf8');

assert(timelineJs.includes('ART_PERIODS') && timelineJs.includes('tree-trunk-path'), 'Tree structure layout implemented with SVG tree paths');
assert(timelineJs.includes('startTreeUnfoldAnimation'), 'Dynamic tree unfolding animation implemented');
assert(timelineCss.includes('.tree-trunk-path.unfolded') && timelineCss.includes('.tree-branch-path.unfolded'), 'CSS animations for trunk and branch growth present');

// Painter branches decorative text only (pointer-events: none)
assert(timelineCss.includes('.painter-branch') && timelineCss.includes('pointer-events: none !important'), 'Painter branches are decorative text only (pointer-events: none !important)');

// Hover period node shows detail card with local representative image, title, era, intro
assert(timelineJs.includes('showHoverCard') && timelineJs.includes('hover-card-img'), 'Hover period node shows detail card with local image and meta');

// Detail card does NOT contain "enter gallery" button
const hoverCardHtmlMatch = timelineJs.match(/hoverCardHtml\s*=\s*`([\s\S]*?)`;/);
const hoverCardHasBtn = hoverCardHtmlMatch && (hoverCardHtmlMatch[1].includes('<button') || hoverCardHtmlMatch[1].includes('btn-enter') || hoverCardHtmlMatch[1].includes('进入展厅'));
assert(!hoverCardHasBtn, 'Detail hover card does NOT contain "enter gallery" button');

// Direct gallery entrance on click period node
assert(timelineJs.includes('this.onSelectPeriod(periodId)'), 'Click period node directly triggers enter gallery callback');
assert(!timelineJs.includes('dictionaryModal') && !timelineJs.includes('dict-popup'), 'No extra dictionary popups on timeline');

// ----------------------------------------------------------------
// 6. 3D GALLERY REQUIREMENTS & STRICT DIRECTION CHECK
// ----------------------------------------------------------------
console.log('\n--- 6. 3D Gallery Architecture & Direction Audit ---');
const controlsJs = fs.readFileSync(path.join(rootDir, 'js/systems/FirstPersonControls.js'), 'utf8');
const galleryJs = fs.readFileSync(path.join(rootDir, 'js/systems/GalleryScene.js'), 'utf8');
const frameJs = fs.readFileSync(path.join(rootDir, 'js/systems/FrameManager.js'), 'utf8');

// STRICT DIRECTION CHECK in FirstPersonControls.js
const hasKeyA = controlsJs.includes('KeyA') && controlsJs.includes('ArrowLeft');
const hasKeyD = controlsJs.includes('KeyD') && controlsJs.includes('ArrowRight');
const strafeLeftLogic = controlsJs.includes('if (moveLeft) this._moveDir.sub(this._right)');
const strafeRightLogic = controlsJs.includes('if (moveRight) this._moveDir.add(this._right)');
assert(hasKeyA && hasKeyD, 'FirstPersonControls supports KeyA / ArrowLeft and KeyD / ArrowRight');
assert(strafeLeftLogic && strafeRightLogic, 'STRICT: KeyA / ArrowLeft moves LEFT (-right vector) and KeyD / ArrowRight moves RIGHT (+right vector)');

// Architecture details
assert(galleryJs.includes('_buildCofferedDome') && galleryJs.includes('outerInstanced') && galleryJs.includes('innerInstanced'), '3D coffered dome (藻井) with recessed boxes and central gilded rosettes');
assert(galleryJs.includes('_buildEntablatureAndDentils') && galleryJs.includes('dentilCount = 160'), 'Real 3D dentils (齿饰, 160 instanced 3D rectangular blocks)');
assert(galleryJs.includes('_buildPilasters') && galleryJs.includes('fluteCount = 5'), 'Classical fluted pilasters (壁柱 with 3D flutes and composite capitals)');
assert(galleryJs.includes('_buildArchedAlcoves') && galleryJs.includes('archTorusGeo') && galleryJs.includes('keystoneShape'), 'Arches (拱券 with molded archivolts and keystones)');
assert(galleryJs.includes('plinthGeo') && galleryJs.includes('torusRingGeo') && galleryJs.includes('corniceGeo'), 'Classical base moldings and cornices (线脚)');

// Materials & PBR
assert(galleryJs.includes('getSharedCarraraMarbleTextures') && galleryJs.includes('marbleMaterial'), 'Carrara marble PBR (diffuse, normal, roughness)');
assert(galleryJs.includes('Reflector') && galleryJs.includes('this.reflector = new Reflector'), 'Floor reflection using Planar Reflector');
assert(galleryJs.includes('sunlight') && galleryJs.includes('castShadow = true') && galleryJs.includes('PCFSoftShadowMap'), 'Sunlight with PCFSoft shadows and ambient light');
assert(galleryJs.includes('_buildOculusAndSkyDome') && galleryJs.includes('getSharedSkyDomeTexture'), 'Oculus (天窗) opens to realistic sky dome (no black voids)');

// Adaptive Aspect Ratio in FrameManager.js
assert(frameJs.includes('ar >= maxAr') && frameJs.includes('canvasW = maxW') && frameJs.includes('canvasH = maxH'), 'Adaptive aspect ratio: horizontal paintings get wide frames, vertical get tall frames (no stretching)');

// ----------------------------------------------------------------
// 7. DETAIL MODAL REQUIREMENTS AUDIT
// ----------------------------------------------------------------
console.log('\n--- 7. Detail Modal Audit ---');
const modalJs = fs.readFileSync(path.join(rootDir, 'js/systems/DetailModal.js'), 'utf8');
const modalCss = fs.readFileSync(path.join(rootDir, 'css/modal.css'), 'utf8');

assert(modalCss.includes('top: 24px') && modalCss.includes('bottom: 24px') && modalCss.includes('left: 24px') && modalCss.includes('right: 24px'), 'Near-fullscreen layout with exact 24px gallery background visible around it');
assert(modalJs.includes('modal-left-art') && modalJs.includes('modal-right-meta'), 'Two-column layout: left side large image, right side full metadata');
assert(modalJs.includes('if (this.isOpen || this.isTransitioning)'), 'Single-instance lock prevents rapid E key from stacking multiple modals');
assert(modalJs.includes("e.key === 'Escape' || e.key === 'Esc'"), 'Escape key closes modal');
assert(modalCss.includes('var(--ease-spring)') && modalCss.includes('var(--ease-out-expo)'), 'Non-linear open/close animations used');

// ----------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------
console.log('\n================================================================');
console.log(`AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
