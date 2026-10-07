const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const start = html.indexOf('id="view-messages"');
const end = html.indexOf('</main>', start);
const msgSnippet = html.substring(start, end);
const formMatch = msgSnippet.match(/<form[\s\S]*?<\/form>/);
console.log(formMatch ? formMatch[0] : 'Form not found in view-messages');
