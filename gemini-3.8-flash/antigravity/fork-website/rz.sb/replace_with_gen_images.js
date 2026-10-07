const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf-8');

// Replace all occurrences of old crawled images with AI generated images
content = content.replace(/assets\/img\/avatar_qq\.jpg/g, 'assets/img/gen_avatar.jpg');
content = content.replace(/https:\/\/q1\.qlogo\.cn\/g\?b=qq&amp;nk=80360650&amp;s=100/g, 'assets/img/gen_avatar.jpg');
content = content.replace(/https:\/\/q1\.qlogo\.cn\/g\?b=qq&nk=80360650&s=100/g, 'assets/img/gen_avatar.jpg');

content = content.replace(/assets\/img\/2528495709\.png/g, 'assets/img/gen_terminal_1.jpg');
content = content.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2528495709\.png/g, 'assets/img/gen_terminal_1.jpg');

content = content.replace(/assets\/img\/2175131578\.png/g, 'assets/img/gen_terminal_2.jpg');
content = content.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2175131578\.png/g, 'assets/img/gen_terminal_2.jpg');

content = content.replace(/assets\/img\/263988800\.png/g, 'assets/img/gen_terminal_3.jpg');
content = content.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/263988800\.png/g, 'assets/img/gen_terminal_3.jpg');

content = content.replace(/assets\/img\/69244898a1d80\.jpg/g, 'assets/img/gen_lifestyle.jpg');
content = content.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/69244898a1d80\.jpg/g, 'assets/img/gen_lifestyle.jpg');

fs.writeFileSync(indexPath, content, 'utf-8');
console.log('Successfully updated index.html with AI generated images!');
