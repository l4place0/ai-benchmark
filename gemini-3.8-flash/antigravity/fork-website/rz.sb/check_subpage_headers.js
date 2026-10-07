const fs = require('fs');
const path = require('path');

const pages = ['about', 'archives', 'messages', 'photos', 'circle', 'links', 'post_detail'];

for (const p of pages) {
    const filePath = path.join(__dirname, 'target_pages', `target_${p}.html`);
    const content = fs.readFileSync(filePath, 'utf-8');
    let pjax = (content.match(/<div class="pjax-content[^"]*"[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
    pjax = pjax.replace(/<div class="page-loader[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '').trim();

    console.log(`\n=================== ${p} ===================`);
    console.log(pjax.substring(0, 600));
}
