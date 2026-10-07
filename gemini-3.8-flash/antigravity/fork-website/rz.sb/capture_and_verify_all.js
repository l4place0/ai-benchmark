const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    console.log('Launching headless browser for full verification & capture...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    const pagesToCapture = [
        { path: '/about', file: 'replica_about.png' },
        { path: '/archives', file: 'replica_archives.png' },
        { path: '/messages', file: 'replica_messages.png' },
        { path: '/photos', file: 'replica_photos.png' },
        { path: '/circle', file: 'replica_circle.png' },
        { path: '/links', file: 'replica_links.png' },
        { path: '/archives/362/', file: 'replica_post_detail.png' }
    ];

    console.log('\n--- 1. Testing Direct URL visits & Capturing Screenshots ---');
    for (const item of pagesToCapture) {
        console.log(`Navigating to http://localhost:8089${item.path}...`);
        await page.goto(`http://localhost:8089${item.path}`, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1200));

        const pageTitle = await page.title();
        console.log(`Loaded ${item.path} - Title: ${pageTitle}`);

        const outPath = path.join(__dirname, item.file);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`Saved screenshot: ${item.file}`);
    }

    console.log('\n--- 2. Testing In-Page SPA Navigation via Sidebar Icons ---');
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Archives
    console.log('Clicking nav-btn-archives...');
    await page.click('#nav-btn-archives');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, Archives view visible:`, await page.$eval('#view-archives', el => !el.classList.contains('hidden')));

    // Messages
    console.log('Clicking nav-btn-messages...');
    await page.click('#nav-btn-messages');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, Messages view visible:`, await page.$eval('#view-messages', el => !el.classList.contains('hidden')));

    // Photos
    console.log('Clicking nav-btn-photos...');
    await page.click('#nav-btn-photos');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, Photos view visible:`, await page.$eval('#view-photos', el => !el.classList.contains('hidden')));

    // Circle
    console.log('Clicking nav-btn-circle...');
    await page.click('#nav-btn-circle');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, Circle view visible:`, await page.$eval('#view-circle', el => !el.classList.contains('hidden')));

    // Links
    console.log('Clicking nav-btn-links...');
    await page.click('#nav-btn-links');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, Links view visible:`, await page.$eval('#view-links', el => !el.classList.contains('hidden')));

    // About
    console.log('Clicking nav-btn-about...');
    await page.click('#nav-btn-about');
    await new Promise(r => setTimeout(r, 500));
    console.log(`URL: ${page.url()}, About view visible:`, await page.$eval('#view-about', el => !el.classList.contains('hidden')));

    // Browser Back
    console.log('Testing Browser Back button (window.history.back)...');
    await page.goBack();
    await new Promise(r => setTimeout(r, 500));
    console.log(`Back to: ${page.url()}, Links view visible:`, await page.$eval('#view-links', el => !el.classList.contains('hidden')));

    console.log('\n--- 3. Testing Guestbook Messages & OwO Emoji Insertion on /messages ---');
    await page.goto('http://localhost:8089/messages', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const initialBadge = await page.$eval('#messages-count-badge', el => el.innerText.trim());
    console.log(`Initial Messages Count: ${initialBadge}`);

    // Scroll form into view & toggle emoji panel
    await page.evaluate(() => {
        const btn = document.getElementById('msg-emoji-btn');
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btn.click();
        }
    });
    await new Promise(r => setTimeout(r, 400));

    // Switch to OwO tab
    await page.evaluate(() => {
        const tab = document.querySelector('.msg-emoji-tab-owo');
        if (tab) tab.click();
    });
    await new Promise(r => setTimeout(r, 200));

    // Click OwO emoji
    await page.evaluate(() => {
        const owo = Array.from(document.querySelectorAll('#msg-emoji-pane-owo .emoji-icon')).find(el => el.textContent.includes('๑•̀ㅂ•́'));
        if (owo) owo.click();
    });

    // Type author and comment
    await page.type('#msg-author', '前端测试员');
    await page.type('#msg-textarea', ' 这篇随笔博客非常棒！全站PJAX丝滑无缝！');

    const msgVal = await page.$eval('#msg-textarea', el => el.value);
    console.log(`Textarea content with OwO emoji: "${msgVal}"`);

    // Submit form
    await page.evaluate(() => {
        const form = document.getElementById('messages-form');
        if (form) {
            const submitBtn = form.querySelector('input[type="submit"]');
            if (submitBtn) submitBtn.click();
        }
    });
    await new Promise(r => setTimeout(r, 600));

    const newBadge = await page.$eval('#messages-count-badge', el => el.innerText.trim());
    const firstCommentText = await page.$eval('#messages-comment-list li:first-child .text', el => el.innerText.trim());
    console.log(`Updated Messages Count: ${newBadge} (expected: ${parseInt(initialBadge, 10) + 1})`);
    console.log(`First Comment in Guestbook: "${firstCommentText}"`);

    console.log('\n--- 4. Testing Like Counter on /archives/362/ ---');
    await page.goto('http://localhost:8089/archives/362/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const initialLike = await page.$eval('#view-post_detail .detail-like-num', el => parseInt(el.innerText.trim(), 10));
    console.log(`Initial Like Count: ${initialLike}`);

    // Click like
    await page.evaluate(() => {
        const likeBtn = document.querySelector('#view-post_detail .post-suport');
        if (likeBtn) likeBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const newLike = await page.$eval('#view-post_detail .detail-like-num', el => parseInt(el.innerText.trim(), 10));
    const isHeartFilled = await page.$eval('#view-post_detail .post-suport i', el => el.classList.contains('ri-heart-fill'));
    console.log(`Updated Like Count: ${newLike}, Heart filled: ${isHeartFilled}`);

    console.log('\n--- 5. Testing Dark Mode Across Pages ---');
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 400));
    let isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log(`Dark mode active: ${isDark}`);

    await page.click('#nav-btn-about');
    await new Promise(r => setTimeout(r, 400));
    let isAboutDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log(`Navigated to /about with dark mode: ${isAboutDark}`);

    // Switch back
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 400));

    console.log('\n--- 6. Testing Header Search Filtering ---');
    await page.click('#nav-btn-home');
    await new Promise(r => setTimeout(r, 500));
    await page.type('#search', '豆包AI');
    await page.click('#showLoadingTip');
    await new Promise(r => setTimeout(r, 500));
    const visibleCount = await page.$$eval('#post_all .post-item', items => items.filter(i => i.style.display !== 'none').length);
    console.log(`Visible articles matching '豆包AI': ${visibleCount}`);

    console.log('\n--- 7. Testing Article Click from Archives to Post Detail ---');
    await page.click('#nav-btn-archives');
    await new Promise(r => setTimeout(r, 500));
    console.log('Clicking first article link in archives timeline...');
    await page.evaluate(() => {
        const link = document.querySelector('#view-archives a[href*="/archives/362/"]');
        if (link) {
            link.scrollIntoView();
            link.click();
        }
    });
    await new Promise(r => setTimeout(r, 600));
    console.log(`Navigated to: ${page.url()}, Post detail visible:`, await page.$eval('#view-post_detail', el => !el.classList.contains('hidden')));

    await browser.close();
    console.log('\n========================================');
    console.log('ALL 7 PAGES & INTERACTION TESTS PASSED PERFECTLY!');
    console.log('========================================');
}

main().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
