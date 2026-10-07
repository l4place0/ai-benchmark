const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
    'https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/6636f0301fd28.jpg',
    'https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/65facdf0aec74.jpg',
    'https://rz.isi.indevs.in/irils-imgs/usr/uploads/2024/01/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75.webp'
];

async function download(url) {
    return new Promise((resolve) => {
        const filename = path.basename(new URL(url).pathname);
        const dest = path.join(__dirname, 'assets', 'img', filename);
        if (fs.existsSync(dest)) {
            console.log('Already exists:', filename);
            return resolve(true);
        }
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                const stream = fs.createWriteStream(dest);
                res.pipe(stream);
                stream.on('finish', () => {
                    console.log('Downloaded:', filename, res.headers['content-length']);
                    resolve(true);
                });
            } else {
                console.log('Failed:', url, res.statusCode);
                resolve(false);
            }
        }).on('error', (err) => {
            console.log('Error downloading:', url, err.message);
            resolve(false);
        });
    });
}

(async () => {
    for (const u of urls) {
        await download(u);
    }
})();
