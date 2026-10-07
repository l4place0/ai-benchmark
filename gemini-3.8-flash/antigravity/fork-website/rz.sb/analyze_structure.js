const fs = require('fs');
const path = require('path');

const pages = [
    { name: 'about', file: 'target_about.html' },
    { name: 'archives', file: 'target_archives.html' },
    { name: 'messages', file: 'target_messages.html' },
    { name: 'photos', file: 'target_photos.html' },
    { name: 'circle', file: 'target_circle.html' },
    { name: 'links', file: 'target_links.html' },
    { name: 'post_detail', file: 'target_post_detail.html' }
];

for (const p of pages) {
    const filePath = path.join(__dirname, 'target_pages', p.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const header = (content.match(/<header[^>]*>([\s\S]*?)<\/header>/) || [])[0] || '';
    
    // Extract pjax-content without loader
    let pjax = (content.match(/<div class="pjax-content[^"]*"[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
    // strip out page-loader
    pjax = pjax.replace(/<div class="page-loader[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '').trim();

    console.log(`\n=================== ${p.name} ===================`);
    console.log(`Header snippet:`, header.substring(0, 150).replace(/\s+/g, ' '));
    console.log(`Pjax length without loader:`, pjax.length);
    console.log(`Pjax first 200 chars:`, pjax.substring(0, 200).replace(/\s+/g, ' '));
    console.log(`Pjax last 200 chars:`, pjax.substring(pjax.length - 200).replace(/\s+/g, ' '));
}
