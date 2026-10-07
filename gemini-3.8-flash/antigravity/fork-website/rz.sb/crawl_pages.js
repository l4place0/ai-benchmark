const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const pages = [
    { name: 'about', url: 'https://rz.sb/about' },
    { name: 'archives', url: 'https://rz.sb/archives' },
    { name: 'messages', url: 'https://rz.sb/messages' },
    { name: 'photos', url: 'https://rz.sb/photos' },
    { name: 'circle', url: 'https://rz.sb/circle' },
    { name: 'links', url: 'https://rz.sb/links' },
    { name: 'post_detail', url: 'https://rz.sb/archives/362/' }
];

async function main() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    const dir = path.join(__dirname, 'target_pages');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const p of pages) {
        console.log(`Fetching ${p.name} from ${p.url}...`);
        try {
            await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 25000 });
            await new Promise(r => setTimeout(r, 1500));
            
            // Screenshot
            await page.screenshot({ path: path.join(dir, `target_${p.name}.png`), fullPage: false });
            
            // HTML
            const html = await page.content();
            fs.writeFileSync(path.join(dir, `target_${p.name}.html`), html, 'utf-8');
            console.log(`Success: ${p.name}`);
        } catch (e) {
            console.error(`Failed ${p.name}:`, e.message);
        }
    }

    await browser.close();
    console.log('All pages crawled!');
}

main().catch(console.error);
