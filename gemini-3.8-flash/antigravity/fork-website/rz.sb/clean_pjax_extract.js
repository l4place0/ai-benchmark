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
    
    // Find pjax-content
    const startPjax = content.indexOf('<div class="pjax-content');
    if (startPjax === -1) {
        console.error('Cannot find pjax-content in', p.name);
        continue;
    }
    const endPjax = content.lastIndexOf('</main>');
    let pjaxHtml = content.substring(startPjax, endPjax);
    
    // Remove the page-loader
    pjaxHtml = pjaxHtml.replace(/<div class="page-loader[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');
    
    // Check if there are unclosed tags or trailing closing tags
    // The extracted chunk starts with `<div class="pjax-content...` and ends before `</main>`
    // Let's count open divs vs close divs
    const openDivs = (pjaxHtml.match(/<div[\s>]/g) || []).length;
    const closeDivs = (pjaxHtml.match(/<\/div>/g) || []).length;
    console.log(`${p.name}: length = ${pjaxHtml.length}, openDivs = ${openDivs}, closeDivs = ${closeDivs}`);
    
    fs.writeFileSync(path.join(__dirname, 'target_pages', `${p.name}_clean_pjax.html`), pjaxHtml, 'utf-8');
}
console.log('Clean pjax templates extracted!');
