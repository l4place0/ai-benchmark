const fs = require('fs');
const path = require('path');

const pages = ['about', 'archives', 'messages', 'photos', 'circle', 'links', 'post_detail'];
const allAssets = new Set();

for (const p of pages) {
    const filePath = path.join(__dirname, 'target_pages', `target_${p}.html`);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // find all src="..." and href="..."
    const srcs = content.match(/src="([^"]+)"/g) || [];
    const hrefs = content.match(/href="([^"]+)"/g) || [];
    
    [...srcs, ...hrefs].forEach(s => {
        const val = s.replace(/^(src|href)="/, '').replace(/"$/, '');
        if (!val.startsWith('http') && !val.startsWith('#') && !val.startsWith('javascript:')) {
            allAssets.add(val);
        }
    });
}

console.log('Local/relative assets referenced in target pages:');
console.log(Array.from(allAssets));
