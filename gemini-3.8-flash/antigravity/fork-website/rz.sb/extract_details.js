const fs = require('fs');
const path = require('path');

function extractMainBody(filename) {
    const p = path.join(__dirname, 'target_pages', filename);
    const html = fs.readFileSync(p, 'utf-8');
    const start = html.indexOf('<div class="page_content');
    const end = html.lastIndexOf('</div>\n\t\t\t</div>\n        </main>');
    return html.substring(start, end > start ? end : start + 4000);
}

const aboutBody = extractMainBody('target_about.html');
fs.writeFileSync('target_pages/about_body.html', aboutBody, 'utf-8');

const messagesBody = extractMainBody('target_messages.html');
fs.writeFileSync('target_pages/messages_body.html', messagesBody.substring(0, 5000), 'utf-8');

const photosBody = extractMainBody('target_photos.html');
fs.writeFileSync('target_pages/photos_body.html', photosBody, 'utf-8');

const circleBody = extractMainBody('target_circle.html');
fs.writeFileSync('target_pages/circle_body.html', circleBody.substring(0, 5000), 'utf-8');

const linksBody = extractMainBody('target_links.html');
fs.writeFileSync('target_pages/links_body.html', linksBody.substring(0, 5000), 'utf-8');

const postDetailBody = extractMainBody('target_post_detail.html');
fs.writeFileSync('target_pages/post_detail_body.html', postDetailBody.substring(0, 5000), 'utf-8');

console.log('Saved extracted bodies for inspection!');
