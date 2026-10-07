const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function comparePNGs(imgPath1, imgPath2) {
    if (!fs.existsSync(imgPath1) || !fs.existsSync(imgPath2)) return null;
    const img1 = PNG.sync.read(fs.readFileSync(imgPath1));
    const img2 = PNG.sync.read(fs.readFileSync(imgPath2));
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
    const totalPixels = width * height;
    const similarity = parseFloat(((1 - numDiffPixels / totalPixels) * 100).toFixed(2));
    return { totalPixels, numDiffPixels, similarity };
}

async function runAudit() {
    console.log('=== RIGOROUS MULTI-PAGE & FULL FUNCTIONAL AUDIT ===\n');

    const results = {
        pages: {},
        interactions: {},
        overallVerdict: 'FAIL'
    };

    // 1. Pixel comparison for desktop
    const desktopDiff = comparePNGs('target_desktop.png', 'replica_desktop.png');
    results.pages['home'] = {
        route: '/',
        title: '若志 • 随笔',
        similarity: desktopDiff ? desktopDiff.similarity : 0,
        verdict: (desktopDiff && desktopDiff.similarity >= 98) ? 'PASS' : 'FAIL'
    };
    console.log(`[Home Feed] Similarity: ${results.pages['home'].similarity}% - ${results.pages['home'].verdict}`);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const routes = [
        { name: 'about', path: '/about', expectedTitle: '关于 - 若志 • 随笔' },
        { name: 'archives', path: '/archives', expectedTitle: '归档 - 若志 • 随笔' },
        { name: 'messages', path: '/messages', expectedTitle: '留言 - 若志 • 随笔' },
        { name: 'photos', path: '/photos', expectedTitle: '分类 相册 下的文章 - 若志 • 随笔' },
        { name: 'circle', path: '/circle', expectedTitle: '友圈 - 若志 • 随笔' },
        { name: 'links', path: '/links', expectedTitle: '友链 - 若志 • 随笔' },
        { name: 'post_detail', path: '/archives/362/', expectedTitle: '随笔#“豆包AI手机” - 若志 • 随笔' }
    ];

    console.log('\n--- Auditing Subpage Direct URL Routing ---');
    for (const r of routes) {
        const resp = await page.goto(`http://localhost:8089${r.path}`, { waitUntil: 'networkidle0', timeout: 10000 });
        const title = await page.title();
        const status = resp.status();
        const ok = status === 200 && title.includes(r.expectedTitle.split(' - ')[0]);
        results.pages[r.name] = {
            route: r.path,
            status,
            title,
            verdict: ok ? 'PASS' : 'FAIL'
        };
        console.log(`[${r.name.toUpperCase()}] ${r.path} -> Status: ${status}, Title: "${title}" - ${results.pages[r.name].verdict}`);
    }

    console.log('\n--- Auditing Interactive Features ---');
    // In-page navigation
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle0' });
    await page.click('#nav-btn-archives');
    await new Promise(r => setTimeout(r, 400));
    const archivesActive = await page.$eval('#nav-btn-archives', el => el.classList.contains('border-blue-400') && el.classList.contains('text-blue-400'));
    results.interactions['spaRouting'] = archivesActive;
    console.log(`[SPA Navigation & Active Nav Highlighting]: ${archivesActive ? 'PASS' : 'FAIL'}`);

    // Guestbook posting
    await page.goto('http://localhost:8089/messages', { waitUntil: 'networkidle0' });
    const countBefore = parseInt(await page.$eval('#messages-count-badge', el => el.innerText), 10);
    await page.type('#msg-author', 'JudgeAgent');
    await page.type('#msg-textarea', '自动化测试留言：全站功能完备验证！');
    await page.click('#messages-form input[type="submit"]');
    await new Promise(r => setTimeout(r, 400));
    const countAfter = parseInt(await page.$eval('#messages-count-badge', el => el.innerText), 10);
    const msgPosted = countAfter === countBefore + 1;
    results.interactions['guestbookPosting'] = msgPosted;
    console.log(`[Guestbook Message Submission]: ${msgPosted ? 'PASS' : 'FAIL'} (${countBefore} -> ${countAfter})`);

    // Post detail like increment
    await page.goto('http://localhost:8089/archives/362/', { waitUntil: 'networkidle0' });
    const likeBefore = parseInt(await page.$eval('#view-post_detail .detail-like-num', el => el.innerText), 10);
    await page.click('#view-post_detail .post-suport');
    await new Promise(r => setTimeout(r, 300));
    const likeAfter = parseInt(await page.$eval('#view-post_detail .detail-like-num', el => el.innerText), 10);
    const likeWorked = likeAfter === likeBefore + 1;
    results.interactions['postLike'] = likeWorked;
    console.log(`[Post Like Counter]: ${likeWorked ? 'PASS' : 'FAIL'} (${likeBefore} -> ${likeAfter})`);

    // Dark mode
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 300));
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    results.interactions['darkMode'] = isDark;
    console.log(`[Dark Theme Toggle]: ${isDark ? 'PASS' : 'FAIL'}`);

    await browser.close();

    const allPagesPassed = Object.values(results.pages).every(p => p.verdict === 'PASS');
    const allInteractionsPassed = Object.values(results.interactions).every(v => v === true);

    results.overallVerdict = (allPagesPassed && allInteractionsPassed) ? 'PASS' : 'FAIL';
    fs.writeFileSync('full_site_audit_report.json', JSON.stringify(results, null, 2), 'utf-8');

    console.log(`\n========================================`);
    console.log(`FINAL FULL-SITE VERDICT: [${results.overallVerdict}]`);
    console.log(`========================================`);
}

runAudit().catch(console.error);
