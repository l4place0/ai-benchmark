const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    console.log('Navigating to https://rz.sb/ ...');
    try {
        await page.goto('https://rz.sb/', { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.warn('Navigation warning:', e.message);
    }

    // Wait a bit for animations/lazyloads if any
    await new Promise(r => setTimeout(r, 2000));

    // Capture desktop screenshot
    console.log('Capturing desktop screenshot...');
    await page.screenshot({ path: path.join(__dirname, 'target_desktop.png'), fullPage: false });
    await page.screenshot({ path: path.join(__dirname, 'target_full.png'), fullPage: true });

    // Save target HTML
    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, 'target_source.html'), html, 'utf-8');

    // Extract resources
    const resources = await page.evaluate(() => {
        const css = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        const images = Array.from(document.querySelectorAll('img')).map(i => i.src);
        const title = document.title;
        return { title, css, scripts, images };
    });
    fs.writeFileSync(path.join(__dirname, 'target_resources.json'), JSON.stringify(resources, null, 2), 'utf-8');

    // Also capture mobile
    console.log('Capturing mobile screenshot...');
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(__dirname, 'target_mobile.png'), fullPage: false });

    await browser.close();
    console.log('Finished capturing target site!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
