const fs = require('fs');
const path = require('path');

const pages = ['about', 'archives', 'messages', 'photos', 'circle', 'links', 'post_detail'];
const rzSbPaths = new Set();

for (const p of pages) {
    const filePath = path.join(__dirname, 'target_pages', `target_${p}.html`);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const srcs = content.match(/src="([^"]+)"/g) || [];
    srcs.forEach(s => {
        const val = s.replace(/^src="/, '').replace(/"$/, '');
        try {
            const u = new URL(val, 'https://rz.sb');
            if (u.hostname === 'rz.sb') {
                rzSbPaths.add(u.pathname);
            }
        } catch (e) {}
    });
}

console.log('Paths on rz.sb:');
console.log(Array.from(rzSbPaths));
