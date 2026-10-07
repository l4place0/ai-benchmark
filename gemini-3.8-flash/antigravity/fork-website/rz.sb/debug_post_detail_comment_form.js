const fs = require('fs');
const html = fs.readFileSync('target_pages/target_post_detail.html', 'utf-8');
const pIdx = html.indexOf('id="p-comments-from"');
console.log('Post detail comment form:');
console.log(html.substring(pIdx, pIdx + 1500));
