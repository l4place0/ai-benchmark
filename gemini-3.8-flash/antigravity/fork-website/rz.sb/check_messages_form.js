const fs = require('fs');
const html = fs.readFileSync('target_pages/target_messages.html', 'utf-8');
const formIndex = html.indexOf('<form');
console.log(html.substring(formIndex, formIndex + 2500));
