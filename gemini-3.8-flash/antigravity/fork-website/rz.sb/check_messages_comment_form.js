const fs = require('fs');
const html = fs.readFileSync('target_pages/target_messages.html', 'utf-8');
const formIndex = html.indexOf('id="comment-form"');
console.log(html.substring(formIndex - 100, formIndex + 2500));
