const fs = require('fs');
const html = fs.readFileSync('target_pages/target_post_detail.html', 'utf-8');
const formIdx = html.indexOf('<form');
const secondFormIdx = html.indexOf('<form', formIdx + 1);
console.log('Second form in post_detail:');
console.log(html.substring(secondFormIdx, secondFormIdx + 1500));
