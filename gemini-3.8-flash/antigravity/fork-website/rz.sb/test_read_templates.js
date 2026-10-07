const fs = require('fs');
const path = require('path');

// Read the clean templates
const aboutHtml = fs.readFileSync('target_pages/about_clean_pjax.html', 'utf-8');
const archivesHtml = fs.readFileSync('target_pages/archives_clean_pjax.html', 'utf-8');
const messagesHtml = fs.readFileSync('target_pages/messages_clean_pjax.html', 'utf-8');
const photosHtml = fs.readFileSync('target_pages/photos_clean_pjax.html', 'utf-8');
const circleHtml = fs.readFileSync('target_pages/circle_clean_pjax.html', 'utf-8');
const linksHtml = fs.readFileSync('target_pages/links_clean_pjax.html', 'utf-8');
const postDetailHtml = fs.readFileSync('target_pages/post_detail_clean_pjax.html', 'utf-8');

console.log('Read all 7 subpage templates successfully.');
