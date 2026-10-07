const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    console.log('Launching browser to capture replica...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    
    // 1. Capture Desktop (1440x900)
    console.log('Setting desktop viewport (1440x900)...');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    console.log('Navigating to http://localhost:8089/ ...');
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a brief moment for layout/fonts/images
    await new Promise(r => setTimeout(r, 1500));

    console.log('Taking replica_desktop.png...');
    await page.screenshot({
        path: path.join(__dirname, 'replica_desktop.png'),
        fullPage: false
    });

    // 2. Capture Mobile (375x812)
    console.log('Setting mobile viewport (375x812)...');
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Taking replica_mobile.png...');
    await page.screenshot({
        path: path.join(__dirname, 'replica_mobile.png'),
        fullPage: false
    });

    await browser.close();
    console.log('Capture finished successfully!');
}

main().catch(err => {
    console.error('Error during capture:', err);
    process.exit(1);
});
