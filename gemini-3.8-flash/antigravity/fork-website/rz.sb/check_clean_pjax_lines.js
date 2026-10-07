const fs = require('fs');
const path = require('path');

const pages = ['about', 'archives', 'messages', 'photos', 'circle', 'links', 'post_detail'];
for (const p of pages) {
    const file = path.join('target_pages', `${p}_clean_pjax.html`);
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    console.log(`\n=== ${p} ===`);
    console.log('First line:', lines[0]);
    console.log('Second line:', lines[1]);
    console.log('Last line:', lines[lines.length - 1]);
}
