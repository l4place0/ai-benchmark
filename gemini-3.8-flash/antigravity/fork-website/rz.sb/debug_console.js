const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    console.log('Navigating to http://localhost:8089/about...');
    await page.goto('http://localhost:8089/about', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Checking current view:');
    const hiddenViews = await page.$$eval('.page-view', views => views.map(v => ({ id: v.id, hidden: v.classList.contains('hidden') })));
    console.log(hiddenViews);

    console.log('Now clicking nav-btn-archives...');
    await page.click('#nav-btn-archives');
    await new Promise(r => setTimeout(r, 1000));

    console.log('Checking views after clicking archives:');
    const hiddenViewsAfter = await page.$$eval('.page-view', views => views.map(v => ({ id: v.id, hidden: v.classList.contains('hidden') })));
    console.log(hiddenViewsAfter);

    await browser.close();
})();
