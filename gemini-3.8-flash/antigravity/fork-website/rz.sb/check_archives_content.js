const fs = require('fs');
const html = fs.readFileSync('target_pages/target_archives.html', 'utf-8');
const start = html.indexOf('<div class="page_content');
const end = html.lastIndexOf('</main>');
console.log('Archives snippet:');
console.log(html.substring(start, start + 3500));
