const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    console.log('=== VISUAL QUALITY & ARCHITECTURAL AUDIT ===\n');

    // 1. Pixel Diff
    function runDiff(file1, file2, diffFile) {
        if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
            console.error(`Files not found for diff: ${file1} or ${file2}`);
            return null;
        }
        const img1 = PNG.sync.read(fs.readFileSync(file1));
        const img2 = PNG.sync.read(fs.readFileSync(file2));
        const { width, height } = img1;
        const diff = new PNG({ width, height });

        const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
        const totalPixels = width * height;
        const mismatchPercent = (numDiffPixels / totalPixels * 100).toFixed(2);
        const similarity = (100 - mismatchPercent).toFixed(2);

        fs.writeFileSync(diffFile, PNG.sync.write(diff));
        return {
            totalPixels,
            numDiffPixels,
            mismatchPercent: parseFloat(mismatchPercent),
            similarity: parseFloat(similarity)
        };
    }

    const desktopDiff = runDiff('target_desktop.png', 'replica_desktop.png', 'diff_desktop.png');
    console.log('1. Desktop Visual Diff:');
    console.log(`   Target: target_desktop.png (1440x900) vs replica_desktop.png (1440x900)`);
    console.log(`   Diff Pixels: ${desktopDiff.numDiffPixels} / ${desktopDiff.totalPixels}`);
    console.log(`   Mismatch: ${desktopDiff.mismatchPercent}%`);
    console.log(`   Similarity: ${desktopDiff.similarity}%\n`);

    const mobileDiff = runDiff('target_mobile.png', 'replica_mobile.png', 'diff_mobile.png');
    console.log('2. Mobile Visual Diff (Raw Target Screenshot with AJAX overlay):');
    console.log(`   Target: target_mobile.png (375x812) vs replica_mobile.png (375x812)`);
    console.log(`   Diff Pixels: ${mobileDiff.numDiffPixels} / ${mobileDiff.totalPixels}`);
    console.log(`   Mismatch: ${mobileDiff.mismatchPercent}%`);
    console.log(`   Similarity: ${mobileDiff.similarity}%\n`);

    const mobileCleanDiff = runDiff('target_mobile_light.png', 'replica_mobile.png', 'diff_mobile_clean.png');
    console.log('3. Mobile Visual Diff (Fully Rendered Target Site vs Replica):');
    console.log(`   Target: target_mobile_light.png (375x812) vs replica_mobile.png (375x812)`);
    console.log(`   Diff Pixels: ${mobileCleanDiff.numDiffPixels} / ${mobileCleanDiff.totalPixels}`);
    console.log(`   Mismatch: ${mobileCleanDiff.mismatchPercent}%`);
    console.log(`   Similarity: ${mobileCleanDiff.similarity}%\n`);

    // 2. Multimedia Asset Verification
    console.log('4. Multimedia & Asset Verification:');
    const html = fs.readFileSync('index.html', 'utf-8');
    const assetRegex = /(?:src|href)="([^"]+\.(?:png|jpg|jpeg|svg|gif|webp|css|js))"/gi;
    let match;
    const assetsFound = new Set();
    while ((match = assetRegex.exec(html)) !== null) {
        assetsFound.add(match[1]);
    }

    let allAssetsValid = true;
    const assetResults = [];
    for (const asset of assetsFound) {
        if (asset.startsWith('http://') || asset.startsWith('https://')) {
            assetResults.push({ asset, type: 'external', status: 'OK' });
        } else {
            const cleanPath = asset.split('?')[0];
            const localPath = path.join(__dirname, cleanPath);
            const exists = fs.existsSync(localPath);
            const size = exists ? fs.statSync(localPath).size : 0;
            if (!exists || size === 0) {
                allAssetsValid = false;
                assetResults.push({ asset, type: 'local', status: 'MISSING', size });
            } else {
                assetResults.push({ asset, type: 'local', status: 'OK', size });
            }
        }
    }
    console.log(`   Total unique assets referenced: ${assetsFound.size}`);
    console.log(`   All local assets present on disk and non-empty: ${allAssetsValid}`);
    console.log(`   Breakdown:`, assetResults);

    // 3. Interactive Component Validation
    console.log('\n5. Puppeteer Interactive Validation:');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle0', timeout: 15000 });

    const checks = {};

    // Dark Mode
    const initDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 400));
    const toggledDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    checks.darkModeToggle = (initDark !== toggledDark);
    await page.click('#changeMode'); // toggle back

    // Category Tabs
    const tabCount = await page.evaluate(() => document.querySelectorAll('.pagetab_menu .page_tab_common').length);
    const hasActiveLine = await page.evaluate(() => !!document.querySelector('.tab__line') || !!document.querySelector('.page_tab_active'));
    checks.categoryTabs = { count: tabCount, hasActiveLine };

    // Search Filter
    await page.type('#search', '豆包');
    await new Promise(r => setTimeout(r, 200));
    const searchMatchCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#post_all .post-item')).filter(el => el.style.display !== 'none').length;
    });
    await page.evaluate(() => {
        document.getElementById('search').value = '';
        window.filterPosts('');
    });
    await new Promise(r => setTimeout(r, 200));
    const searchResetCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#post_all .post-item')).filter(el => el.style.display !== 'none').length;
    });
    checks.searchFilter = { matchCount: searchMatchCount, resetCount: searchResetCount, works: searchMatchCount === 1 && searchResetCount === 5 };

    // Like Button
    const likeBefore = await page.evaluate(() => document.querySelector('.like-num').innerText.trim());
    await page.click('.post-suport');
    await new Promise(r => setTimeout(r, 200));
    const likeAfter = await page.evaluate(() => document.querySelector('.like-num').innerText.trim());
    checks.likeInteraction = { before: likeBefore, after: likeAfter, incremented: parseInt(likeAfter) === parseInt(likeBefore) + 1 };

    // Comment Drawer & Emojis
    await page.click('.showBottomAction');
    await new Promise(r => setTimeout(r, 400));
    const drawerOpen = await page.evaluate(() => document.getElementById('BottomActionDialog').classList.contains('qui-bottom-action-show'));
    await page.click('#emoji-icons-btn');
    await new Promise(r => setTimeout(r, 300));
    const emojiCount = await page.evaluate(() => document.querySelectorAll('.emoji-icon').length);
    await page.click('.emoji-icon');
    await new Promise(r => setTimeout(r, 100));
    const textareaVal = await page.evaluate(() => document.getElementById('message-textarea').value);
    await page.evaluate(() => window.closeCommentDrawer());
    await new Promise(r => setTimeout(r, 300));
    const drawerClosed = await page.evaluate(() => !document.getElementById('BottomActionDialog').classList.contains('qui-bottom-action-show'));
    checks.commentDrawer = { drawerOpen, drawerClosed, emojiCount, emojiInserted: textareaVal.length > 0 };

    // Login Modal
    await page.click('#showLogin');
    await new Promise(r => setTimeout(r, 300));
    const loginOpen = await page.evaluate(() => document.getElementById('Login').classList.contains('qui-page-show'));
    await page.evaluate(() => window.toggleLoginModal(false));
    await new Promise(r => setTimeout(r, 300));
    const loginClosed = await page.evaluate(() => !document.getElementById('Login').classList.contains('qui-page-show'));
    checks.loginModal = { loginOpen, loginClosed };

    // Mobile Hamburger & Responsive Drawer
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await new Promise(r => setTimeout(r, 300));
    await page.click('.menu_button');
    await new Promise(r => setTimeout(r, 300));
    const navOpen = await page.evaluate(() => document.body.classList.contains('nav-open'));
    await page.click('.nav-mask');
    await new Promise(r => setTimeout(r, 300));
    const navClosed = await page.evaluate(() => !document.body.classList.contains('nav-open'));
    checks.mobileDrawer = { navOpen, navClosed };

    // Lightbox
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 200));
    await page.click('#post_all .ViewImage');
    await new Promise(r => setTimeout(r, 400));
    const lightboxShown = await page.evaluate(() => !!document.querySelector('.view-image') || !!document.querySelector('.view-image-container'));
    if (lightboxShown) {
        await page.evaluate(() => {
            const el = document.querySelector('.view-image');
            if (el) el.click();
        });
    }
    checks.lightbox = lightboxShown;

    await browser.close();

    console.log('   Interactive Checks Summary:');
    console.log(JSON.stringify(checks, null, 2));

    const finalReport = {
        desktopDiff,
        mobileDiff,
        mobileCleanDiff,
        allAssetsValid,
        checks
    };
    fs.writeFileSync('audit_results.json', JSON.stringify(finalReport, null, 2), 'utf-8');
    console.log('\nAudit complete! Results saved to audit_results.json');
}

main().catch(console.error);
