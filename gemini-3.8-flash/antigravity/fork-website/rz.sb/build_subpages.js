const fs = require('fs');
const path = require('path');

// 1. Read existing index.html
const indexHtml = fs.readFileSync('index.html', 'utf-8');

// 2. Read clean subpage templates
let aboutHtml = fs.readFileSync('target_pages/about_clean_pjax.html', 'utf-8');
let archivesHtml = fs.readFileSync('target_pages/archives_clean_pjax.html', 'utf-8');
let messagesHtml = fs.readFileSync('target_pages/messages_clean_pjax.html', 'utf-8');
let photosHtml = fs.readFileSync('target_pages/photos_clean_pjax.html', 'utf-8');
let circleHtml = fs.readFileSync('target_pages/circle_clean_pjax.html', 'utf-8');
let linksHtml = fs.readFileSync('target_pages/links_clean_pjax.html', 'utf-8');
let postDetailHtml = fs.readFileSync('target_pages/post_detail_clean_pjax.html', 'utf-8');

// 3. Process aboutHtml
aboutHtml = aboutHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-about" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');

// 4. Process archivesHtml
archivesHtml = archivesHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-archives" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
// Convert archive article links to SPA router navigation
archivesHtml = archivesHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');
// Convert archive category links
archivesHtml = archivesHtml.replace('href="https://rz.sb/lifes"', 'href="javascript:void(0)" onclick="navigateToCategory(1)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/study-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(2)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/blog-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(3)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/do-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(4)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/photos"', 'href="/photos" onclick="event.preventDefault(); navigateTo(\'/photos\');"');

// 5. Process messagesHtml
messagesHtml = messagesHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-messages" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
messagesHtml = messagesHtml.replace('留言 <sup>823</sup>', '留言 <sup><span id="messages-count-badge">823</span></sup>');
messagesHtml = messagesHtml.replace('<ol class="comment-list">', '<ol class="comment-list" id="messages-comment-list">');

// Enhance messages form
const messagesFormOld = `<form method="post" action="https://rz.sb/messages/comment" id="comment-form" role="form" class="IndexCommentform comment-form comment-respond sticky left-0 bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800 rounded-t-lg">`;
const messagesFormNew = `<form id="messages-form" onsubmit="event.preventDefault(); submitGuestbookMessage();" role="form" class="IndexCommentform comment-form comment-respond sticky left-0 bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800 rounded-t-lg">`;
messagesHtml = messagesHtml.replace(messagesFormOld, messagesFormNew);
messagesHtml = messagesHtml.replace('id="message-textarea"', 'id="msg-textarea"');
messagesHtml = messagesHtml.replace('id="author"', 'id="msg-author"');
messagesHtml = messagesHtml.replace('id="mail"', 'id="msg-mail"');
messagesHtml = messagesHtml.replace('id="url"', 'id="msg-url"');
messagesHtml = messagesHtml.replace('onclick="toggleUserInfo()"', 'onclick="toggleMsgUserInfo()"');
messagesHtml = messagesHtml.replace('onclick="toggleEmojiPanel()"', 'onclick="toggleMsgEmojiPanel()"');
messagesHtml = messagesHtml.replace('onclick="insertMarkdownLink()"', 'onclick="insertMsgMarkdownLink()"');
messagesHtml = messagesHtml.replace('onclick="togglePrivateComment()"', 'onclick="toggleMsgPrivateComment()"');
messagesHtml = messagesHtml.replace('class="user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden"', 'class="msg-user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden"');
messagesHtml = messagesHtml.replace('class="emoji-icons hidden mt-2"', 'id="msg-emoji-panel" class="msg-emoji-icons hidden mt-2"');

// 6. Process photosHtml
photosHtml = photosHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-photos" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
// Use local high-res photos
photosHtml = photosHtml.replace('https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/688187080795d.jpg', 'assets/img/688187080795d.jpg');
photosHtml = photosHtml.replace('https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/688187080795d.jpg', 'assets/img/688187080795d.jpg');
photosHtml = photosHtml.replace('https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/6880496682b4a.jpg', 'assets/img/6880496682b4a.jpg');
photosHtml = photosHtml.replace('https://rz.isi.indevs.in/irils-imgs/usr/uploads/time/6880496682b4a.jpg', 'assets/img/6880496682b4a.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/6636f0301fd28\.jpg/g, 'assets/img/69244898a1d80.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/65facdf0aec74\.jpg/g, 'assets/img/6880496807778.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2024\/01\/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75\.webp/g, 'assets/img/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75.webp');
// Update photo links to SPA navigation
photosHtml = photosHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');

// 7. Process circleHtml
circleHtml = circleHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-circle" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');

// 8. Process linksHtml
linksHtml = linksHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-links" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
linksHtml = linksHtml.replace(/\/usr\/themes\/A-Sleek\/src\/img\/loading\.svg/g, 'assets/img/loading.svg');
linksHtml = linksHtml.replace(/https:\/\/rz\.sb\/usr\/plugins\/Links\/nopic\.png/g, 'assets/img/loading.svg');

// 9. Process postDetailHtml
postDetailHtml = postDetailHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-post_detail" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
// Use local images for post 362
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2528495709\.png/g, 'assets/img/2528495709.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2175131578\.png/g, 'assets/img/2175131578.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/263988800\.png/g, 'assets/img/263988800.png');
// Make like button interactive
postDetailHtml = postDetailHtml.replace(/<a href="#" class="post-suport" data-cid="362">([\s\S]*?)<\/a>/, '<a href="javascript:void(0)" class="post-suport cursor-pointer" onclick="handleDetailLike(this)" data-cid="362">$1</a>');
postDetailHtml = postDetailHtml.replace('<small> 53 </small>', '<small class="detail-like-num">53</small>');
// Comment count click
postDetailHtml = postDetailHtml.replace(/<a href="#" class="showBottomAction">/g, '<a href="#detail-comments-section" class="showBottomAction cursor-pointer">');
postDetailHtml = postDetailHtml.replace('<small>30</small>', '<small class="detail-comments-count-badge">30</small>');
postDetailHtml = postDetailHtml.replace('<section id="p_comments" class="comments bg-white dark:bg-slate-800">', '<section id="detail-comments-section" class="comments bg-white dark:bg-slate-800">');
postDetailHtml = postDetailHtml.replace('<ol class="comment-list">', '<ol class="comment-list" id="detail-comments-list">');
// Detail comment form
const detailFormOld = `<form method="post" action="https://rz.sb/archives/362/comment" id="comment-form" role="form" class="IndexCommentform comment-form comment-respond sticky left-0 bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800 rounded-t-lg">`;
const detailFormNew = `<form id="detail-comment-form" onsubmit="event.preventDefault(); submitDetailComment();" role="form" class="IndexCommentform comment-form comment-respond sticky left-0 bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800 rounded-t-lg">`;
postDetailHtml = postDetailHtml.replace(detailFormOld, detailFormNew);
postDetailHtml = postDetailHtml.replace('id="message-textarea"', 'id="detail-textarea"');
postDetailHtml = postDetailHtml.replace('id="author"', 'id="detail-author"');
postDetailHtml = postDetailHtml.replace('id="mail"', 'id="detail-mail"');
postDetailHtml = postDetailHtml.replace('id="url"', 'id="detail-url"');
postDetailHtml = postDetailHtml.replace('onclick="toggleUserInfo()"', 'onclick="toggleDetailUserInfo()"');
postDetailHtml = postDetailHtml.replace('onclick="toggleEmojiPanel()"', 'onclick="toggleDetailEmojiPanel()"');
postDetailHtml = postDetailHtml.replace('onclick="insertMarkdownLink()"', 'onclick="insertDetailMarkdownLink()"');
postDetailHtml = postDetailHtml.replace('onclick="togglePrivateComment()"', 'onclick="toggleDetailPrivateComment()"');
postDetailHtml = postDetailHtml.replace('class="user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden"', 'class="detail-user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden"');
postDetailHtml = postDetailHtml.replace('class="emoji-icons hidden mt-2"', 'id="detail-emoji-panel" class="detail-emoji-icons hidden mt-2"');

console.log('All templates pre-processed successfully.');
fs.writeFileSync('target_pages/processed_about.html', aboutHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_archives.html', archivesHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_messages.html', messagesHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_photos.html', photosHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_circle.html', circleHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_links.html', linksHtml, 'utf-8');
fs.writeFileSync('target_pages/processed_post_detail.html', postDetailHtml, 'utf-8');
