const fs = require('fs');
const path = require('path');

const files = [
    { name: 'about', file: 'target_about.html' },
    { name: 'archives', file: 'target_archives.html' },
    { name: 'messages', file: 'target_messages.html' },
    { name: 'photos', file: 'target_photos.html' },
    { name: 'circle', file: 'target_circle.html' },
    { name: 'links', file: 'target_links.html' },
    { name: 'post_detail', file: 'target_post_detail.html' }
];

for (const item of files) {
    const p = path.join(__dirname, 'target_pages', item.file);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf-8');
    
    // Find pjax-content innerHTML
    const start = html.indexOf('<div class="pjax-content');
    if (start === -1) continue;
    const end = html.indexOf('</main>', start);
    const content = html.substring(start, end > 0 ? end : start + 3000);
    
    // Clean preview
    console.log(`\n=================== ${item.name} ===================`);
    console.log('Length:', content.length);
    console.log('First 600 chars:');
    console.log(content.substring(0, 600).replace(/\s+/g, ' '));
}
