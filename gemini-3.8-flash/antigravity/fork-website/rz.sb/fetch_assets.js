const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Intercept responses to save CSS, fonts, and images
    page.on('response', async (res) => {
        const url = res.url();
        const status = res.status();
        if (status !== 200) return;
        
        try {
            if (url.includes('/usr/themes/A-Sleek/src/css/app.css')) {
                const buffer = await res.buffer();
                fs.writeFileSync(path.join(__dirname, 'assets/css/app.css'), buffer);
                console.log('Saved app.css (size:', buffer.length, ')');
            }
            if (url.includes('remixicon.woff2') || url.includes('remixicon.woff') || url.includes('remixicon.ttf')) {
                const buffer = await res.buffer();
                const fontName = url.split('?')[0].split('/').pop();
                fs.writeFileSync(path.join(__dirname, 'assets/css', fontName), buffer);
                console.log('Saved font:', fontName);
            }
            if (url.includes('qlogo.cn') || url.includes('cravatar.cn') || url.includes('irils-imgs') || url.includes('uploads')) {
                const buffer = await res.buffer();
                const ext = url.includes('.png') ? '.png' : (url.includes('.svg') ? '.svg' : '.jpg');
                const cleanName = path.basename(url.split('?')[0]) || ('img_' + Date.now());
                const imgName = cleanName.endsWith(ext) ? cleanName : (cleanName + ext);
                fs.writeFileSync(path.join(__dirname, 'assets/img', imgName), buffer);
                console.log('Saved image:', imgName);
            }
        } catch (e) {
            // ignore
        }
    });

    console.log('Navigating to https://rz.sb/ to capture all loaded network assets...');
    await page.goto('https://rz.sb/', { waitUntil: 'networkidle0', timeout: 35000 });

    // Scroll to bottom to trigger lazy load for images
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });

    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
    console.log('Asset fetching finished!');
}

main().catch(console.error);
