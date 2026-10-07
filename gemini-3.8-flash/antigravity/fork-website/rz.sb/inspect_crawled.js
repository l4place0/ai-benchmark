const fs = require('fs');
const path = require('path');

const files = [
    'target_about.html',
    'target_archives.html',
    'target_messages.html',
    'target_photos.html',
    'target_circle.html',
    'target_links.html',
    'target_post_detail.html'
];

for (const f of files) {
    const p = path.join(__dirname, 'target_pages', f);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf-8');
    console.log('\n====================================');
    console.log('FILE:', f);
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    console.log('TITLE:', titleMatch ? titleMatch[1] : 'none');

    // Extract pjax-content
    const pjaxMatch = html.match(/<div class="pjax-content[^"]*"[\s\S]*?<\/main>/);
    if (pjaxMatch) {
        console.log('PJAX Content Length:', pjaxMatch[0].length);
        // Find major sections or headers
        const lines = pjaxMatch[0].split('\n').filter(l => l.trim().length > 0);
        console.log('Lines count:', lines.length);
        // Look for headings
        const headings = pjaxMatch[0].match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/g) || [];
        console.log('Headings:', headings.map(h => h.replace(/<[^>]+>/g, '').trim()));
    }
}
