const fs = require('fs');
const path = require('path');

async function download(url, filepath) {
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 100) {
        console.log(`Already exists: ${filepath}`);
        return;
    }
    console.log(`Downloading ${url} -> ${filepath}`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) {
            console.error(`Failed ${url}: ${res.status}`);
            return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filepath, buf);
        console.log(`Downloaded ${filepath} (${buf.length} bytes)`);
    } catch (e) {
        console.error(`Error downloading ${url}:`, e.message);
    }
}

async function main() {
    const html = fs.readFileSync(path.join(__dirname, 'target_source.html'), 'utf-8');
    const urls = new Set();
    const regex = /(?:src|data-src|href)="([^"]+?\.(?:png|jpg|jpeg|svg|gif|webp|ico)(?:\?[^"]*)?)"/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        urls.add(m[1]);
    }
    // Also add QQ avatar
    const qqRegex = /(?:src|data-src|href)="(https:\/\/[^"]*qlogo\.cn[^"]*)"/gi;
    while ((m = qqRegex.exec(html)) !== null) {
        urls.add(m[1]);
    }
    const cravatarRegex = /(?:src|data-src|href)="(https:\/\/[^"]*cravatar\.cn[^"]*)"/gi;
    while ((m = cravatarRegex.exec(html)) !== null) {
        urls.add(m[1]);
    }

    console.log('Found image URLs:', Array.from(urls));

    const imgDir = path.join(__dirname, 'assets/img');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    for (const url of urls) {
        let filename;
        if (url.includes('qlogo.cn')) {
            filename = 'avatar_qq.png';
        } else if (url.includes('cravatar.cn')) {
            filename = 'avatar_comment.png';
        } else {
            const cleanUrl = url.split('?')[0];
            filename = path.basename(cleanUrl);
        }
        await download(url, path.join(imgDir, filename));
    }
}

main();
