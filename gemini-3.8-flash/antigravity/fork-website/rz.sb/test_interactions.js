const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTests() {
    console.log('Starting interactive feature tests...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle0', timeout: 15000 });

    const results = {};

    // 1. Test Dark Mode
    console.log('Testing Dark Mode Toggle...');
    const isDarkInitial = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 600));
    const isDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    results.darkModeToggle = (isDarkInitial !== isDarkAfter);
    // Toggle back
    await page.click('#changeMode');
    await new Promise(r => setTimeout(r, 600));
    console.log('Dark mode test result:', results.darkModeToggle);

    // 2. Test Tab Switching
    console.log('Testing Category Tabs...');
    const tabPositions = [];
    const tabs = await page.$$('.pagetab_menu .page_tab_common');
    for (let i = 0; i < tabs.length; i++) {
        await tabs[i].click();
        await new Promise(r => setTimeout(r, 400));
        const left = await page.evaluate(() => document.querySelector('.page_tab_content').style.left);
        tabPositions.push(left);
    }
    // Switch back to 0
    await tabs[0].click();
    await new Promise(r => setTimeout(r, 400));
    results.tabs = tabPositions;
    console.log('Tab sliding positions:', tabPositions);

    // 3. Test Search Filtering
    console.log('Testing Search Bar Filtering...');
    await page.type('#search', 'Chongqing');
    await new Promise(r => setTimeout(r, 300));
    const visibleCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#post_all .post-item'))
            .filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    // Clear search
    await page.evaluate(() => {
        document.getElementById('search').value = '';
        window.filterPosts('');
    });
    await new Promise(r => setTimeout(r, 300));
    const resetCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#post_all .post-item'))
            .filter(el => window.getComputedStyle(el).display !== 'none').length;
    });
    results.search = { visibleCount, resetCount };
    console.log('Search test result:', results.search);

    // 4. Test Like Button
    console.log('Testing Like Button...');
    const likeBefore = await page.evaluate(() => document.querySelector('.like-num').innerText);
    await page.click('.post-suport');
    await new Promise(r => setTimeout(r, 300));
    const likeAfter = await page.evaluate(() => document.querySelector('.like-num').innerText);
    results.like = { before: likeBefore, after: likeAfter };
    console.log('Like test result:', results.like);

    // 5. Test BottomActionDialog (Comment Drawer) & Emojis
    console.log('Testing Comment Drawer & Emojis...');
    await page.click('.showBottomAction');
    await new Promise(r => setTimeout(r, 500));
    const drawerOpen = await page.evaluate(() => {
        const el = document.getElementById('BottomActionDialog');
        return el && el.classList.contains('qui-bottom-action-show');
    });
    // Click emoji button
    await page.click('#emoji-icons-btn');
    await new Promise(r => setTimeout(r, 400));
    // Click an emoji
    const emojiIcons = await page.$$('.emoji-icon');
    if (emojiIcons.length > 0) {
        await emojiIcons[0].click();
    }
    const textareaVal = await page.evaluate(() => document.getElementById('message-textarea').value);
    results.commentDrawer = { drawerOpen, emojiInserted: textareaVal.length > 0 };
    console.log('Comment drawer result:', results.commentDrawer);
    // Close drawer
    await page.evaluate(() => window.closeCommentDrawer());
    await new Promise(r => setTimeout(r, 500));

    // 6. Test Login Modal
    console.log('Testing Login Modal...');
    await page.click('#showLogin');
    await new Promise(r => setTimeout(r, 400));
    const loginOpen = await page.evaluate(() => document.getElementById('Login').classList.contains('qui-page-show'));
    await page.click('#Login .qui-page-action-btn-cancel');
    await new Promise(r => setTimeout(r, 400));
    const loginClosed = await page.evaluate(() => !document.getElementById('Login').classList.contains('qui-page-show'));
    results.loginModal = { loginOpen, loginClosed };
    console.log('Login modal result:', results.loginModal);

    // 7. Test Mobile Navigation Drawer
    console.log('Testing Mobile Navigation...');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await new Promise(r => setTimeout(r, 500));
    await page.click('.menu_button');
    await new Promise(r => setTimeout(r, 400));
    const navOpen = await page.evaluate(() => document.body.classList.contains('nav-open'));
    await page.click('.nav-mask');
    await new Promise(r => setTimeout(r, 400));
    const navClosed = await page.evaluate(() => !document.body.classList.contains('nav-open'));
    results.mobileNav = { navOpen, navClosed };
    console.log('Mobile nav result:', results.mobileNav);

    // 8. Test Lightbox
    console.log('Testing Image Lightbox...');
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 300));
    await page.click('#post_all .ViewImage');
    await new Promise(r => setTimeout(r, 500));
    const lightboxVisible = await page.evaluate(() => !!document.querySelector('.view-image'));
    if (lightboxVisible) {
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.view-image-close');
            if (closeBtn) closeBtn.click();
        });
    }
    results.lightbox = lightboxVisible;
    console.log('Lightbox test result:', lightboxVisible);

    await browser.close();
    console.log('\n=== ALL INTERACTION TESTS COMPLETE ===');
    console.log(JSON.stringify(results, null, 2));
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
