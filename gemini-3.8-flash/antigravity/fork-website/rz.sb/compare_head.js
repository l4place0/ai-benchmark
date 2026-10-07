const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync('index.html', 'utf-8');
const targetAbout = fs.readFileSync('target_pages/target_about.html', 'utf-8');

// Extract head from index and target
const indexHeadLinks = (indexHtml.match(/<link[^>]+>/g) || []).map(l => l.trim());
const targetHeadLinks = (targetAbout.match(/<link[^>]+>/g) || []).map(l => l.trim());

console.log('Index head links count:', indexHeadLinks.length);
console.log('Target head links count:', targetHeadLinks.length);
console.log('\nTarget links:');
targetHeadLinks.forEach(l => console.log(l));
