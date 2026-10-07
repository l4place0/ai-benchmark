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
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Find <main> ... </main>
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    const pjaxMatch = content.match(/<div class="pjax-content[^"]*"[^>]*>([\s\S]*?)<\/main>/);
    const headerMatch = content.match(/<header[^>]*>([\s\S]*?)<\/header>/);

    console.log(`\n=================== PAGE: ${p.name} ===================`);
    console.log(`Title:`, (content.match(/<title>(.*?)<\/title>/) || [])[1]);
    console.log(`Has Header in main:`, !!headerMatch);
    if (pjaxMatch) {
        console.log(`Pjax length:`, pjaxMatch[0].length);
        // Find top level tags in pjax-content
        const topTags = pjaxMatch[1].trim().substring(0, 300);
        console.log(`Pjax start preview:`, topTags.replace(/\s+/g, ' '));
    }
}
