const fs = require('fs');
const path = require('path');

console.log('Building clean unified index.html...');

// Read the raw clean subpages
let aboutHtml = fs.readFileSync('target_pages/about_clean_pjax.html', 'utf-8');
let archivesHtml = fs.readFileSync('target_pages/archives_clean_pjax.html', 'utf-8');
let messagesHtml = fs.readFileSync('target_pages/messages_clean_pjax.html', 'utf-8');
let photosHtml = fs.readFileSync('target_pages/photos_clean_pjax.html', 'utf-8');
let circleHtml = fs.readFileSync('target_pages/circle_clean_pjax.html', 'utf-8');
let linksHtml = fs.readFileSync('target_pages/links_clean_pjax.html', 'utf-8');
let postDetailHtml = fs.readFileSync('target_pages/post_detail_clean_pjax.html', 'utf-8');

// 1. Process About
aboutHtml = aboutHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-about" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);

// 2. Process Archives
archivesHtml = archivesHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-archives" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);
archivesHtml = archivesHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/lifes"', 'href="javascript:void(0)" onclick="navigateToCategory(1)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/study-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(2)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/blog-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(3)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/do-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(4)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/photos"', 'href="/photos" onclick="event.preventDefault(); navigateTo(\'/photos\');"');

// 3. Process Messages
messagesHtml = messagesHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-messages" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);
messagesHtml = messagesHtml.replace('留言 <sup>823</sup>', '留言 <sup><span id="messages-count-badge">823</span></sup>');
messagesHtml = messagesHtml.replace('<ol class="comment-list">', '<ol class="comment-list" id="messages-comment-list">');

const msgFormStart = messagesHtml.indexOf('<form id="p-comments-from"');
const msgFormEnd = messagesHtml.indexOf('</form>', msgFormStart) + 7;
const newMsgForm = `
<form id="messages-form" onsubmit="event.preventDefault(); submitGuestbookMessage();" role="form" name="comment" class="respond-page-5 sticky comment-form comment-respond bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800">
    <div class="msg-user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden">
        <div class="p-2 flex items-center justify-between gap-2">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*昵称" id="msg-author" value="" type="text" name="author" autocomplete="on">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*邮箱" id="msg-mail" value="" type="email" name="mail" autocomplete="on">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="网址" id="msg-url" value="" type="url" name="url" autocomplete="on">
        </div>
    </div>
    <div class="absolute right-0 top-2 z-20 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-slate-500 cursor-pointer text-sm">
        <div id="msgCancelReply" class="cancelReply" onclick="cancelReply();" title="点击取消回复" style="display: none;">取消</div>
    </div>
    <textarea rows="4" cols="0" name="text" id="msg-textarea" oninput="autoResize(this)" class="w-full flex-1 p-2 rounded OwO-textarea textarea text-slate-500 placeholder:text-slate-400/70 text-sm dark:bg-slate-800 resize-none border dark:border-slate-700" placeholder="请输入留言内容..."></textarea>
    <div class="flex items-center justify-between mt-1">
        <div class="flex items-center gap-2">
            <a href="javascript:void(0)" onclick="toggleMsgUserInfo()" class="user-info w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded p-1" title="修改昵称邮箱">
                <img class="rounded" src="assets/img/avatar_comment.png" width="30" height="30" alt="avatar">
            </a>
            <a title="添加表情" id="msg-emoji-btn" href="javascript:void(0)" onclick="toggleMsgEmojiPanel()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <i class="ri-emotion-happy-line"></i>
            </a>
            <a title="添加链接" href="javascript:void(0)" onclick="insertMsgMarkdownLink()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <i class="ri-link-m"></i>
            </a>
            <span title="私密评论" onclick="toggleMsgPrivateComment()" class="comment-secret w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <input type="checkbox" id="secret-button-msg" name="private" class="hidden">
                <label for="secret-button-msg" class="secret-label cursor-pointer" title="开启该功能，该动态为私密">
                    <i class="ri-chat-private-line" id="msg-private-line"></i>
                    <i class="ri-chat-private-fill hidden text-blue-400" id="msg-private-fill"></i>
                </label>
            </span>
        </div>
        <input type="submit" class="submit inline-flex justify-center items-center space-x-2 border focus:outline-none px-5 py-1 text-xs leading-6 rounded border-blue-400 bg-blue-400 text-white hover:text-white hover:bg-blue-500 hover:border-blue-500 active:bg-blue-400 active:border-blue-400 transform transition duration-75 active:scale-90 cursor-pointer" value="发送">
    </div>
    <!-- Emoji / OwO Selector Panel for Messages -->
    <div id="msg-emoji-panel" class="msg-emoji-icons hidden mt-2">
        <div class="flex items-center space-x-4 px-2 py-1 text-xs text-slate-500 bg-gray-100 dark:bg-slate-800 rounded-t border-b dark:border-slate-700">
            <span class="msg-emoji-tab-std active font-bold text-blue-400 cursor-pointer" onclick="switchMsgEmojiTab('emoji')">Emoji</span>
            <span class="msg-emoji-tab-owo cursor-pointer" onclick="switchMsgEmojiTab('owo')">OwO 颜文字</span>
        </div>
        <div id="msg-emoji-pane-std" class="grid grid-cols-6 md:grid-cols-15 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center">
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😀')">😀</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😁')">😁</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😂')">😂</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😃')">😃</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😄')">😄</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😅')">😅</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😆')">😆</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😇')">😇</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😈')">😈</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😉')">😉</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😊')">😊</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😋')">😋</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😌')">😌</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😍')">😍</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😎')">😎</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😏')">😏</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😐')">😐</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😑')">😑</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😒')">😒</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😓')">😓</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😔')">😔</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😕')">😕</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😖')">😖</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😗')">😗</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😘')">😘</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😙')">😙</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😚')">😚</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😛')">😛</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😜')">😜</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😝')">😝</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😞')">😞</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😟')">😟</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😠')">😠</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😡')">😡</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😢')">😢</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😣')">😣</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😤')">😤</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😥')">😥</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😦')">😦</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😧')">😧</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😨')">😨</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😩')">😩</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😪')">😪</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😫')">😫</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😭')">😭</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😮')">😮</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😯')">😯</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😰')">😰</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😱')">😱</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😲')">😲</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😳')">😳</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😴')">😴</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😵')">😵</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😷')">😷</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('👏')">👏</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('👍')">👍</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('🎉')">🎉</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('❤️')">❤️</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('✨')">✨</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('🍃')">🍃</i>
        </div>
        <div id="msg-emoji-pane-owo" class="grid grid-cols-3 md:grid-cols-5 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center hidden">
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(・ω・)')">(・ω・)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(｡･ω･｡)')">(｡･ω･｡)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(ง •_•)ง')">(ง •_•)ง</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('( ﾟ∀ﾟ)o彡ﾟ')">( ﾟ∀ﾟ)o彡ﾟ</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(￣▽￣)')">(￣▽￣)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('( ´_ゝ｀)')">( ´_ゝ｀)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(*/ω＼*)')">(*/ω＼*)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(,,•́ . •̀,,)')">(,,•́ . •̀,,)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(oﾟ▽ﾟ)o')">(oﾟ▽ﾟ)o</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(๑•̀ㅂ•́)و✧')">(๑•̀ㅂ•́)و✧</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(,,Ծ‸Ծ,,)')">(,,Ծ‸Ծ,,)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(ノ°ο°)ノ')">(ノ°ο°)ノ</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(*/∇＼*)')">(*/∇＼*)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(｡♥‿♥｡)')">(｡♥‿♥｡)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertMsgEmoji('(ಥ_ಥ)')">(ಥ_ಥ)</span>
        </div>
    </div>
</form>
`;
if (msgFormStart !== -1) {
    messagesHtml = messagesHtml.substring(0, msgFormStart) + newMsgForm + messagesHtml.substring(msgFormEnd);
}

// 4. Process Photos
photosHtml = photosHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-photos" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/688187080795d\.jpg/g, 'assets/img/688187080795d.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/6880496682b4a\.jpg/g, 'assets/img/6880496682b4a.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/6636f0301fd28\.jpg/g, 'assets/img/69244898a1d80.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/65facdf0aec74\.jpg/g, 'assets/img/6880496807778.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2024\/01\/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75\.webp/g, 'assets/img/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75.webp');
photosHtml = photosHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');

// 5. Process Circle
circleHtml = circleHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-circle" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);

// 6. Process Links
linksHtml = linksHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-links" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);
linksHtml = linksHtml.replace(/\/usr\/themes\/A-Sleek\/src\/img\/loading\.svg/g, 'assets/img/loading.svg');
linksHtml = linksHtml.replace(/https:\/\/rz\.sb\/usr\/plugins\/Links\/nopic\.png/g, 'assets/img/loading.svg');

// 7. Process Post Detail
postDetailHtml = postDetailHtml.replace(
    '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
    '<div id="view-post_detail" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">'
);
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2528495709\.png/g, 'assets/img/2528495709.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2175131578\.png/g, 'assets/img/2175131578.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/263988800\.png/g, 'assets/img/263988800.png');
postDetailHtml = postDetailHtml.replace(/<a href="#" class="post-suport" data-cid="362">([\s\S]*?)<\/a>/, '<a href="javascript:void(0)" class="post-suport cursor-pointer" onclick="handleDetailLike(this)" data-cid="362">$1</a>');
postDetailHtml = postDetailHtml.replace('<small> 53 </small>', '<small class="detail-like-num"> 53 </small>');
postDetailHtml = postDetailHtml.replace(/<a href="#" class="showBottomAction">/g, '<a href="#detail-comments-section" class="showBottomAction cursor-pointer">');
postDetailHtml = postDetailHtml.replace('<small>30</small>', '<small class="detail-comments-count-badge">30</small>');
postDetailHtml = postDetailHtml.replace('<section id="p_comments" class="comments bg-white dark:bg-slate-800">', '<section id="detail-comments-section" class="comments bg-white dark:bg-slate-800">');
postDetailHtml = postDetailHtml.replace('<ol class="comment-list">', '<ol class="comment-list" id="detail-comments-list">');

const postDetailFormStart = postDetailHtml.indexOf('<form id="p-comments-from"');
const postDetailFormEnd = postDetailHtml.indexOf('</form>', postDetailFormStart) + 7;
const newPostDetailForm = `
<form id="detail-comment-form" onsubmit="event.preventDefault(); submitDetailComment();" role="form" name="comment" class="respond-post-362 sticky comment-form comment-respond bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800">
    <div class="detail-user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden">
        <div class="p-2 flex items-center justify-between gap-2">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*昵称" id="detail-author" value="" type="text" name="author" autocomplete="on">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*邮箱" id="detail-mail" value="" type="email" name="mail" autocomplete="on">
            <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="网址" id="detail-url" value="" type="url" name="url" autocomplete="on">
        </div>
    </div>
    <div class="absolute right-0 top-2 z-20 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-slate-500 cursor-pointer text-sm">
        <div id="detailCancelReply" class="cancelReply" onclick="cancelReply();" title="点击取消回复" style="display: none;">取消</div>
    </div>
    <textarea rows="4" cols="0" name="text" id="detail-textarea" oninput="autoResize(this)" class="w-full flex-1 p-2 rounded OwO-textarea textarea text-slate-500 placeholder:text-slate-400/70 text-sm dark:bg-slate-800 resize-none border dark:border-slate-700" placeholder="说点什么吧..."></textarea>
    <div class="flex items-center justify-between mt-1">
        <div class="flex items-center gap-2">
            <a href="javascript:void(0)" onclick="toggleDetailUserInfo()" class="user-info w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded p-1" title="修改昵称邮箱">
                <img class="rounded" src="assets/img/avatar_comment.png" width="30" height="30" alt="avatar">
            </a>
            <a title="添加表情" id="detail-emoji-btn" href="javascript:void(0)" onclick="toggleDetailEmojiPanel()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <i class="ri-emotion-happy-line"></i>
            </a>
            <a title="添加链接" href="javascript:void(0)" onclick="insertDetailMarkdownLink()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <i class="ri-link-m"></i>
            </a>
            <span title="私密评论" onclick="toggleDetailPrivateComment()" class="comment-secret w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                <input type="checkbox" id="secret-button-detail" name="private" class="hidden">
                <label for="secret-button-detail" class="secret-label cursor-pointer" title="开启该功能，该动态为私密">
                    <i class="ri-chat-private-line" id="detail-private-line"></i>
                    <i class="ri-chat-private-fill hidden text-blue-400" id="detail-private-fill"></i>
                </label>
            </span>
        </div>
        <input type="submit" class="submit inline-flex justify-center items-center space-x-2 border focus:outline-none px-5 py-1 text-xs leading-6 rounded border-blue-400 bg-blue-400 text-white hover:text-white hover:bg-blue-500 hover:border-blue-500 active:bg-blue-400 active:border-blue-400 transform transition duration-75 active:scale-90 cursor-pointer" value="发送">
    </div>
    <!-- Emoji / OwO Selector Panel for Post Detail -->
    <div id="detail-emoji-panel" class="detail-emoji-icons hidden mt-2">
        <div class="flex items-center space-x-4 px-2 py-1 text-xs text-slate-500 bg-gray-100 dark:bg-slate-800 rounded-t border-b dark:border-slate-700">
            <span class="detail-emoji-tab-std active font-bold text-blue-400 cursor-pointer" onclick="switchDetailEmojiTab('emoji')">Emoji</span>
            <span class="detail-emoji-tab-owo cursor-pointer" onclick="switchDetailEmojiTab('owo')">OwO 颜文字</span>
        </div>
        <div id="detail-emoji-pane-std" class="grid grid-cols-6 md:grid-cols-15 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center">
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😀')">😀</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😁')">😁</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😂')">😂</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😃')">😃</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😄')">😄</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😅')">😅</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😆')">😆</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😇')">😇</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😈')">😈</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😉')">😉</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😊')">😊</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😋')">😋</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😌')">😌</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😍')">😍</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😎')">😎</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😏')">😏</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😐')">😐</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😑')">😑</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😒')">😒</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😓')">😓</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😔')">😔</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😕')">😕</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😖')">😖</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😗')">😗</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😘')">😘</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😙')">😙</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😚')">😚</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😛')">😛</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😜')">😜</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😝')">😝</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😞')">😞</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😟')">😟</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😠')">😠</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😡')">😡</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😢')">😢</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😣')">😣</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😤')">😤</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😥')">😥</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😦')">😦</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😧')">😧</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😨')">😨</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😩')">😩</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😪')">😪</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😫')">😫</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😭')">😭</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😮')">😮</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😯')">😯</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😰')">😰</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😱')">😱</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😲')">😲</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😳')">😳</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😴')">😴</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😵')">😵</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('😷')">😷</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('👏')">👏</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('👍')">👍</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('🎉')">🎉</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('❤️')">❤️</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('✨')">✨</i>
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertDetailEmoji('🍃')">🍃</i>
        </div>
        <div id="detail-emoji-pane-owo" class="grid grid-cols-3 md:grid-cols-5 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center hidden">
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(・ω・)')">(・ω・)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(｡･ω･｡)')">(｡･ω･｡)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(ง •_•)ง')">(ง •_•)ง</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('( ﾟ∀ﾟ)o彡ﾟ')">( ﾟ∀ﾟ)o彡ﾟ</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(￣▽￣)')">(￣▽￣)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('( ´_ゝ｀)')">( ´_ゝ｀)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(*/ω＼*)')">(*/ω＼*)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(,,•́ . •̀,,)')">(,,•́ . •̀,,)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(oﾟ▽ﾟ)o')">(oﾟ▽ﾟ)o</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(๑•̀ㅂ•́)و✧')">(๑•̀ㅂ•́)و✧</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(,,Ծ‸Ծ,,)')">(,,Ծ‸Ծ,,)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(ノ°ο°)ノ')">(ノ°ο°)ノ</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(*/∇＼*)')">(*/∇＼*)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(｡♥‿♥｡)')">(｡♥‿♥｡)</span>
            <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertDetailEmoji('(ಥ_ಥ)')">(ಥ_ಥ)</span>
        </div>
    </div>
</form>
`;
if (postDetailFormStart !== -1) {
    postDetailHtml = postDetailHtml.substring(0, postDetailFormStart) + newPostDetailForm + postDetailHtml.substring(postDetailFormEnd);
}

// Head with <base href="/">
const headHtml = `<!DOCTYPE html>
<html class="overflow-x-hidden" data-dpr="1">
<head>
    <base href="/">
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="renderer" content="webkit">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
    <title>若志 • 随笔</title>
    <link rel="shortcut icon" type="image/x-icon" href="assets/img/avatar_qq.jpg">
    <link rel="stylesheet" href="assets/css/app.css">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/remixicon.css">
    <link rel="stylesheet" href="assets/css/qq_widget.css">
    <link rel="stylesheet" href="assets/css/markdown.css">
    <script type="text/javascript" src="assets/js/jquery.js"></script>
    <script type="text/javascript" src="assets/js/qq_widget.js"></script>
    <script type="text/javascript" src="assets/js/view-image.min.js"></script>
    <style>
        .page-view.hidden {
            display: none !important;
        }
        .page_tab_content {
            transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            width: 500%;
        }
        .page_tab_body {
            width: 20%;
            flex-shrink: 0;
        }
        .tab__line {
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s ease;
        }
        .img_gallery-item {
            cursor: pointer;
        }
        @media (max-width: 767px) {
            .nav_menu {
                position: fixed;
                top: 0;
                bottom: 0;
                left: -81px;
                z-index: 40;
                transition: left 0.3s ease;
            }
            .nav-open .nav_menu {
                left: 0 !important;
            }
            .nav-mask {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                z-index: 35;
                display: none;
            }
            .nav-open .nav-mask {
                display: block;
            }
        }
        .ViewImage {
            cursor: zoom-in;
        }
        .emoji-tab-btn.active, .msg-emoji-tab-std.active, .msg-emoji-tab-owo.active, .detail-emoji-tab-std.active, .detail-emoji-tab-owo.active {
            color: #60a5fa;
            font-weight: 600;
        }
        .qui-page.qui-page-show {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        }
        .qui-page {
            transition: opacity 0.25s ease, visibility 0.25s ease;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            position: fixed;
            inset: 0;
            z-index: 10000;
        }
    </style>
</head>`;

// Sidebar HTML
const sidebarHtml = `
        <!-- Sidebar Navigation -->
        <sidebar class="nav_menu p-3 md:p-4 bg-gray-50 dark:bg-slate-700 md:rounded-l-xl md:block transition border-r md:border-none dark:border-r-slate-800">
            <div class="sticky top-4 md:rounded-lg h-full">
                <!-- Avatar -->
                <a href="/about" onclick="event.preventDefault(); navigateTo('/about');" id="nav-btn-about" class="nav_menu_btn w-14 h-14 p-1 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-full cursor-pointer" title="关于">
                    <img class="rounded-full w-full h-full object-cover" src="assets/img/avatar_qq.jpg" alt="若志头像">
                </a>
                <hr class="my-2 dark:border-slate-800">
                <!-- Main Nav Icons -->
                <div class="side_menu text-gray-500">
                    <a href="/" onclick="event.preventDefault(); navigateTo('/');" id="nav-btn-home" title="随笔" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg text-blue-400 border-blue-400 dark:border-blue-400 cursor-pointer">
                        <i class="ri-bubble-chart-line ri-lg"></i>
                    </a>
                    <a href="/archives" onclick="event.preventDefault(); navigateTo('/archives');" id="nav-btn-archives" title="归档" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg cursor-pointer">
                        <i class="ri-archive-line ri-lg"></i>
                    </a>
                    <a href="/messages" onclick="event.preventDefault(); navigateTo('/messages');" id="nav-btn-messages" title="微言" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg cursor-pointer">
                        <i class="ri-chat-1-line ri-lg"></i>
                    </a>
                    <a href="/photos" onclick="event.preventDefault(); navigateTo('/photos');" id="nav-btn-photos" title="相册" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg cursor-pointer">
                        <i class="ri-landscape-line ri-lg"></i>
                    </a>
                    <a href="/circle" onclick="event.preventDefault(); navigateTo('/circle');" id="nav-btn-circle" title="圈子" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg cursor-pointer">
                        <i class="ri-user-voice-line ri-lg"></i>
                    </a>
                    <a href="/links" onclick="event.preventDefault(); navigateTo('/links');" id="nav-btn-links" title="友链" class="nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg cursor-pointer">
                        <i class="ri-user-heart-line ri-lg"></i>
                    </a>
                </div>
                <!-- Bottom Action Icons -->
                <div class="absolute bottom-0 text-gray-500 nav_menu_foot">
                    <div id="GoTop" onclick="scrollToTop()" class="cursor-pointer nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg hidden" title="回到顶部">
                        <i class="ri-arrow-up-s-line ri-lg"></i>
                    </div>
                    <div id="showLogin" onclick="toggleLoginModal(true)" class="cursor-pointer nav_menu_btn w-14 h-14 p-2 mb-3 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg" title="登录">
                        <i class="ri-login-box-line ri-lg"></i>
                    </div>
                    <div id="changeMode" onclick="switchNightMode()" class="cursor-pointer nav_menu_btn w-14 h-14 p-2 bg-white dark:bg-slate-800 flex justify-center items-center border-2 border-white dark:border-slate-600 shadow hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-400 transform transition duration-75 active:scale-90 rounded-lg" title="切换深浅主题">
                        <i class="ri-contrast-2-line ri-lg"></i>
                    </div>
                </div>
            </div>
            <div class="nav-mask" onclick="toggleMobileNav(false)"></div>
        </sidebar>`;

// Login section
const loginHtml = `
            <!-- Login Modal Window -->
            <section id="Login" class="qui-page bg-gray-50 dark:bg-slate-900">
                <div class="qui-page-content">
                    <div class="w-full h-full flex items-center justify-center text-gray-900 relative">
                        <div class="absolute right-0 bottom-0 left-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -100 1440 320">
                                <path class="login_Waves" fill="#EDF2F7" fill-opacity="1" d="M0,96L26.7,112C53.3,128,107,160,160,181.3C213.3,203,267,213,320,192C373.3,171,427,117,480,122.7C533.3,128,587,192,640,229.3C693.3,267,747,277,800,245.3C853.3,213,907,139,960,138.7C1013.3,139,1067,213,1120,224C1173.3,235,1227,181,1280,154.7C1333.3,128,1387,128,1413,128L1440,128L1440,320L1413.3,320C1386.7,320,1333,320,1280,320C1226.7,320,1173,320,1120,320C1066.7,320,1013,320,960,320C906.7,320,853,320,800,320C746.7,320,693,320,640,320C586.7,320,533,320,480,320C426.7,320,373,320,320,320C266.7,320,213,320,160,320C106.7,320,53,320,27,320L0,320Z"></path>
                            </svg>
                        </div>
                        <div onclick="toggleLoginModal(false)" class="qui-page-action-btn-cancel cancel2 w-full h-full z-10 absolute left-0 top-0 cursor-pointer"></div>
                        <div class="p-8 mx-1 relative bg-white dark:bg-slate-800 rounded-lg shadow z-20 w-80 max-w-full">
                            <div class="mb-6 text-center">
                                <p class="text-slate-500 font-bold text-lg">Login</p>
                            </div>
                            <div class="rounded p-4">
                                <form id="loginForm" onsubmit="event.preventDefault(); submitLogin();">
                                    <label class="block text-gray-700">
                                        <input class="w-full mb-4 rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition border dark:border-slate-800" placeholder="用户名" type="text" id="login_name" name="name" autocomplete="on">
                                    </label>
                                    <label class="block text-gray-700">
                                        <input class="w-full mb-4 rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition border dark:border-slate-800" placeholder="密码" type="password" id="login_password" name="password" autocomplete="on">
                                    </label>
                                    <div class="mt-3 flex items-center justify-between gap-2">
                                        <label for="remember" class="text-sm text-slate-500"><input checked="" type="checkbox" name="remember" class="checkbox" value="1" id="remember"> 下次自动登录</label>
                                        <button type="submit" class="login_button inline-flex justify-center items-center space-x-2 border focus:outline-none px-5 py-1 text-xs leading-6 rounded border-blue-400 bg-blue-400 text-white hover:text-white hover:bg-blue-500 hover:border-blue-500 active:bg-blue-400 active:border-blue-400 transform transition duration-75 active:scale-90">登陆</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>`;

// Header
const headerHtml = `
            <!-- Header Search Bar -->
            <header class="w-full px-4 pt-2 md:pt-4 pb-2 md:pb-1 sticky top-0 z-20 bg-white dark:bg-slate-800 md:rounded-tr-xl md:border-l dark:border-l-slate-800 md:dark:border-t dark:border-t-slate-700 md:dark:border-r dark:border-r-slate-700 transition">
                <form onsubmit="event.preventDefault(); triggerSearch();" role="search" class="flex items-center space-x-3 w-full">
                    <div class="menu_button flex items-center justify-center md:hidden">
                        <button type="button" class="menu_button_item flex justify-center items-center" onclick="toggleMobileNav(true)">
                            <span class="menu_button_item-container">
                                <span class="menu_button_item-top bg-slate-500"></span>
                                <span class="menu_button_item-bottom bg-slate-500"></span>
                            </span>
                        </button>
                    </div>
                    <label class="relative flex flex-1 md:!ml-0">
                        <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 px-3 py-2 pl-9 text-sm text-slate-400 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="Search here..." name="s" type="text" id="search" oninput="filterPosts(this.value)">
                        <div class="pointer-events-none absolute flex h-full w-10 items-center justify-center text-slate-400">
                            <i class="ri-search-2-line transition-colors duration-200"></i>
                        </div>
                    </label>
                    <button type="submit" id="showLoadingTip" class="inline-flex justify-center items-center space-x-2 border focus:outline-none px-5 py-1 text-xs leading-6 rounded border-blue-400 bg-blue-400 text-white hover:text-white hover:bg-blue-500 hover:border-blue-500 active:bg-blue-400 active:border-blue-400 transform transition duration-75 active:scale-90 cursor-pointer">
                        搜索
                    </button>
                </form>
            </header>`;

// Bottom Action Dialog
const bottomDialogHtml = `
            <!-- Bottom Action Dialog (Home Comments Drawer) -->
            <div id="BottomActionDialog" class="qui-bottom-action">
                <div class="qui-bottom-action-mask" onclick="closeCommentDrawer()"></div>
                <div class="qui-bottom-action-content dark:text-slate-400 dark:bg-slate-800">
                    <div class="qui-bottom-action-header">
                        <div class="qui-bottom-action-header-btn-confirm text-xs cursor-pointer" id="comment-header-title" title="点击此处访问该文章">
                            <span id="comment-count-display">30</span> <font>条评论</font>
                        </div>
                        <div class="qui-bottom-action-header-bar">
                            <div class="qui-bottom-action-header-bar-cont dark:bg-slate-700"></div>
                        </div>
                        <div onclick="closeCommentDrawer()" class="qui-bottom-action-header-btn-cancel bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:text-slate-400 rounded-full p-1 flex items-center justify-center cursor-pointer">
                            <i class="ri-close-line"></i>
                        </div>
                    </div>
                    <div class="qui-bottom-action-panel mt-3 text-gray-600 dark:text-gray-400 relative">
                        <div id="comments" class="comments">
                            <div class="mx-auto p-4 comments-lists">
                                <div class="comments-null h-64 flex justify-center items-center hidden">空空如也~</div>
                                <div class="comments-list space-y-4"></div>
                            </div>
                            
                            <form id="comment-form" onsubmit="event.preventDefault(); submitComment();" role="form" class="IndexCommentform comment-form comment-respond sticky left-0 bottom-0 w-full p-2 bg-gray-50 dark:bg-slate-700 border-t dark:border-t-slate-800 rounded-t-lg">
                                <div class="user-info-body w-full bg-white dark:bg-slate-800 rounded-t hidden">
                                    <div class="p-2 flex items-center justify-between gap-2">
                                        <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*昵称" id="author" value="若志访客" type="text" name="author" autocomplete="on">
                                        <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="*邮箱" id="mail" value="guest@rz.sb" type="email" name="mail" autocomplete="on">
                                        <input class="form-input peer w-full rounded bg-gray-50 dark:bg-slate-700 p-2 text-sm text-slate-500 placeholder:text-slate-400/70 hover:border-slate-400 focus:outline-none transition" placeholder="网址" id="url" value="https://rz.sb" type="url" name="url" autocomplete="on">
                                    </div>
                                </div>
                                <div class="absolute right-0 top-2 z-20 flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-slate-500 cursor-pointer text-sm">
                                    <div id="cancelReply" class="cancelReply" onclick="cancelReply();" title="点击取消回复" style="display: none;">取消</div>
                                </div>
                                <textarea id="message-textarea" name="text" oninput="autoResize(this)" rows="3" cols="0" class="message-textarea w-full flex-1 p-2 rounded OwO-textarea textarea text-slate-500 placeholder:text-slate-400/70 text-sm dark:bg-slate-800 resize-none border dark:border-slate-700" placeholder="说点什么吧..."></textarea>
                                <div class="flex items-center justify-between mt-2">
                                    <div class="flex items-center gap-2">
                                        <a href="javascript:void(0)" onclick="toggleUserInfo()" class="user-info w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded p-1" title="修改昵称邮箱">
                                            <img class="rounded" src="assets/img/avatar_comment.png" width="30" height="30" alt="avatar">
                                        </a>
                                        <a title="添加表情" id="emoji-icons-btn" href="javascript:void(0)" onclick="toggleEmojiPanel()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                                            <i class="ri-emotion-happy-line"></i>
                                        </a>
                                        <a title="添加链接" href="javascript:void(0)" onclick="insertMarkdownLink()" class="w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer">
                                            <i class="ri-link-m"></i>
                                        </a>
                                        <span title="私密评论" class="comment-secret w-8 h-8 flex justify-center items-center bg-white dark:bg-slate-800 text-slate-500 hover:border border-blue-400 rounded cursor-pointer" onclick="togglePrivateComment()">
                                            <input type="checkbox" id="secret-button2" name="private" class="hidden">
                                            <label for="secret-button2" class="secret-label cursor-pointer" title="开启该功能，该动态为私密">
                                                <i class="ri-chat-private-line" id="private-icon-line"></i>
                                                <i class="ri-chat-private-fill hidden text-blue-400" id="private-icon-fill"></i>
                                            </label>
                                        </span>
                                    </div>
                                    <input type="submit" class="submit inline-flex justify-center items-center space-x-2 border focus:outline-none px-5 py-1 text-xs leading-6 rounded border-blue-400 bg-blue-400 text-white hover:text-white hover:bg-blue-500 hover:border-blue-500 active:bg-blue-400 active:border-blue-400 transform transition duration-75 active:scale-90 cursor-pointer" value="发送">
                                </div>
                                <div class="emoji-icons hidden mt-2">
                                    <div class="flex items-center space-x-4 px-2 py-1 text-xs text-slate-500 bg-gray-100 dark:bg-slate-800 rounded-t border-b dark:border-slate-700">
                                        <span class="emoji-tab-btn active cursor-pointer" onclick="switchEmojiTab('emoji')">Emoji</span>
                                        <span class="emoji-tab-btn cursor-pointer" onclick="switchEmojiTab('owo')">OwO 颜文字</span>
                                    </div>
                                    <div id="emoji-pane-standard" class="grid grid-cols-6 md:grid-cols-15 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center">
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😀')">😀</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😁')">😁</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😂')">😂</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😃')">😃</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😄')">😄</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😅')">😅</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😆')">😆</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😇')">😇</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😈')">😈</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😉')">😉</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😊')">😊</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😋')">😋</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😌')">😌</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😍')">😍</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😎')">😎</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😏')">😏</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😐')">😐</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😑')">😑</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😒')">😒</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😓')">😓</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😔')">😔</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😕')">😕</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😖')">😖</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😗')">😗</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😘')">😘</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😙')">😙</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😚')">😚</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😛')">😛</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😜')">😜</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😝')">😝</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😞')">😞</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😟')">😟</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😠')">😠</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😡')">😡</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😢')">😢</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😣')">😣</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😤')">😤</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😥')">😥</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😦')">😦</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😧')">😧</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😨')">😨</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😩')">😩</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😪')">😪</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😫')">😫</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😭')">😭</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😮')">😮</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😯')">😯</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😰')">😰</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😱')">😱</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😲')">😲</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😳')">😳</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😴')">😴</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😵')">😵</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('😷')">😷</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('👏')">👏</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('👍')">👍</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('🎉')">🎉</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('❤️')">❤️</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('✨')">✨</i>
                                        <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertEmoji('🍃')">🍃</i>
                                    </div>
                                    <div id="emoji-pane-owo" class="grid grid-cols-3 md:grid-cols-5 gap-2 overflow-auto h-40 p-2 border border-t-0 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-b place-items-center hidden">
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(・ω・)')">(・ω・)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(｡･ω･｡)')">(｡･ω･｡)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(ง •_•)ง')">(ง •_•)ง</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('( ﾟ∀ﾟ)o彡ﾟ')">( ﾟ∀ﾟ)o彡ﾟ</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(￣▽￣)')">(￣▽￣)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('( ´_ゝ｀)')">( ´_ゝ｀)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(*/ω＼*)')">(*/ω＼*)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(,,•́ . •̀,,)')">(,,•́ . •̀,,)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(oﾟ▽ﾟ)o')">(oﾟ▽ﾟ)o</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(๑•̀ㅂ•́)و✧')">(๑•̀ㅂ•́)و✧</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(,,Ծ‸Ծ,,)')">(,,Ծ‸Ծ,,)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(ノ°ο°)ノ')">(ノ°ο°)ノ</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(*/∇＼*)')">(*/∇＼*)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(｡♥‿♥｡)')">(｡♥‿♥｡)</span>
                                        <span class="emoji-icon text-xs p-1.5 rounded bg-gray-100 dark:bg-slate-700 cursor-pointer hover:text-blue-400" onclick="insertEmoji('(ಥ_ಥ)')">(ಥ_ಥ)</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>`;

// Home View (from target_source.html or extracted)
// Let's get the exact home view from index.html
const curIdx = fs.readFileSync('index.html', 'utf-8');
const hIdx = curIdx.indexOf('id="view-home"');
const hStart = curIdx.lastIndexOf('<div', hIdx);
const hEnd = curIdx.indexOf('<div id="view-about"');
const homeHtml = curIdx.substring(hStart, hEnd).trim();

// Assemble final complete index.html
const finalIndexHtml = `${headHtml}
<body class="bg-gray-100 transition dark:bg-slate-900 selection:bg-blue-400 selection:text-white overflow-hidden" style="
        background-position: 50% 0;
        background-attachment: fixed;
        background-size: cover;">
    
    <!-- Background glowing orbs -->
    <div class="body-bg dark:bg-slate-900 hidden md:block">
        <div class="slider-thumb b-left"></div>
        <div class="slider-thumb b-right"></div>
    </div>

    <!-- Main Container -->
    <div class="container lg:container mx-auto md:shadow relative flex md:mt-8 md:rounded-xl bg-gray-50 dark:bg-slate-700 mb-2">
        ${sidebarHtml}
        
        <!-- Main Content Column -->
        <main class="flex-1 relative md:rounded-xl main_element overflow-auto border dark:border-none border-slate-200">
            ${loginHtml}
            ${headerHtml}
            ${bottomDialogHtml}
            ${homeHtml}
            ${aboutHtml}
            ${archivesHtml}
            ${messagesHtml}
            ${photosHtml}
            ${circleHtml}
            ${linksHtml}
            ${postDetailHtml}
        </main>
    </div>

    <!-- Fixed Bottom Right Copyright -->
    <footer class="p-4 text-center fixed bottom-0 right-0 hidden md:block pointer-events-none z-10">
        <p class="text-sm text-gray-400 pointer-events-auto">©<a href="/" rel="nofollow noopener" class="hover:text-blue-400">RZ.SB</a> 2018-2026</p>
    </footer>

    <!-- Interactive Logic Script -->
    <script>
        let currentActiveCid = '362';
        let currentTabIndex = 0;
        let bottomDialogInstance = null;

        $(document).ready(function() {
            // Clone articles 2, 3, 4 into #life container
            const art2 = $('article[data-cid="344"]').clone();
            const art3 = $('article[data-cid="319"]').clone();
            const art4 = $('article[data-cid="313"]').clone();
            $('#life .category-posts-container').append(art2).append(art3).append(art4);

            if (window.ViewImage && window.ViewImage.init) {
                window.ViewImage.init('[view-image] img');
            }

            window.addEventListener('resize', () => {
                updateIndicator(currentTabIndex);
            });

            setTimeout(() => {
                updateIndicator(0);
            }, 50);

            const nightCookie = document.cookie.replace(/(?:(?:^|.*;\\s*)night\\s*\\=\\s*([^;]*).*$)|^.*$/, "$1");
            if (nightCookie === '1') {
                document.documentElement.classList.add('dark');
            }

            // Router initial run based on current URL path
            navigateTo(window.location.pathname, false);
        });

        // 1. Router & Navigation
        function updateSidebarActive(pageKey) {
            $('.side_menu .nav_menu_btn').removeClass('text-blue-400 border-blue-400 dark:border-blue-400');
            $('#nav-btn-about').removeClass('border-blue-400 dark:border-blue-400');

            if (pageKey === 'about') {
                $('#nav-btn-about').addClass('border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'home' || pageKey === 'post_detail') {
                $('#nav-btn-home').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'archives') {
                $('#nav-btn-archives').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'messages') {
                $('#nav-btn-messages').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'photos') {
                $('#nav-btn-photos').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'circle') {
                $('#nav-btn-circle').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'links') {
                $('#nav-btn-links').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            }
        }

        function navigateTo(url, push = true) {
            if (push) {
                history.pushState(null, '', url);
            }

            let path = url;
            try {
                const parsed = new URL(url, window.location.origin);
                path = parsed.pathname;
            } catch(e) {}
            
            let normalized = path;
            while (normalized.length > 1 && normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            if (!normalized) normalized = '/';

            $('.page-view').addClass('hidden');

            let pageKey = 'home';
            let targetView = $('#view-home');
            let title = '若志 • 随笔';

            if (normalized === '/about') {
                pageKey = 'about';
                targetView = $('#view-about');
                title = '关于 - 若志 • 随笔';
            } else if (normalized === '/archives') {
                pageKey = 'archives';
                targetView = $('#view-archives');
                title = '归档 - 若志 • 随笔';
            } else if (normalized === '/messages') {
                pageKey = 'messages';
                targetView = $('#view-messages');
                title = '留言 - 若志 • 随笔';
            } else if (normalized === '/photos') {
                pageKey = 'photos';
                targetView = $('#view-photos');
                title = '分类 相册 下的文章 - 若志 • 随笔';
            } else if (normalized === '/circle') {
                pageKey = 'circle';
                targetView = $('#view-circle');
                title = '友圈 - 若志 • 随笔';
            } else if (normalized === '/links') {
                pageKey = 'links';
                targetView = $('#view-links');
                title = '友链 - 若志 • 随笔';
            } else if (normalized.startsWith('/archives/') || (normalized.startsWith('/archives') && normalized !== '/archives')) {
                pageKey = 'post_detail';
                targetView = $('#view-post_detail');
                title = '随笔#“豆包AI手机” - 若志 • 随笔';
            } else if (normalized === '/lifes' || normalized === '/study-notes' || normalized === '/blog-notes' || normalized === '/do-notes') {
                pageKey = 'home';
                targetView = $('#view-home');
                title = '若志 • 随笔';
                const midMap = { '/lifes': 1, '/study-notes': 2, '/blog-notes': 3, '/do-notes': 4 };
                setTimeout(() => switchCategoryTab(midMap[normalized] || 0), 50);
            } else {
                pageKey = 'home';
                targetView = $('#view-home');
                title = '若志 • 随笔';
            }

            document.title = title;
            targetView.removeClass('hidden');
            updateSidebarActive(pageKey);

            toggleMobileNav(false);
            targetView.find('.page_content').scrollTop(0);
            $(window).scrollTop(0);

            if (window.ViewImage && window.ViewImage.init) {
                window.ViewImage.init('[view-image] img');
            }

            if (pageKey === 'home') {
                setTimeout(() => updateIndicator(currentTabIndex), 50);
            }
        }

        window.addEventListener('popstate', function() {
            navigateTo(window.location.pathname, false);
        });

        function navigateToCategory(mid) {
            navigateTo('/');
            setTimeout(() => {
                switchCategoryTab(mid);
            }, 100);
        }

        $(document).on('click', '.article-contents, .post-item b', function(e) {
            if (!$(e.target).closest('a[target="_blank"]').length && !$(e.target).closest('img').length && !$(e.target).closest('.post-suport, .showBottomAction').length) {
                navigateTo('/archives/362/');
            }
        });

        // 2. Dark Mode Toggle
        function switchNightMode() {
            const isDark = document.documentElement.classList.contains('dark');
            let mToast = new QToast();
            mToast.setTime(1500);

            if (isDark) {
                document.documentElement.classList.remove('dark');
                document.cookie = "night=0;path=/";
                mToast.setMessage('夜间模式关闭');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            } else {
                document.documentElement.classList.add('dark');
                document.cookie = "night=1;path=/";
                mToast.setMessage('夜间模式开启');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            }
            mToast.show();
        }

        // 3. Category Tab Switching with Animated Underline
        function switchCategoryTab(index) {
            currentTabIndex = index;
            $('.pagetab_menu .page_tab_common').removeClass('page_tab_active');
            $('.pagetab_menu .page_tab_common').eq(index).addClass('page_tab_active');
            updateIndicator(index);
            $('.page_tab_content').css('left', \`-\${index * 100}%\`);
        }

        function updateIndicator(index) {
            const tabItems = document.querySelectorAll('.pagetab_menu .page_tab_common');
            const line = document.querySelector('.tab__line');
            if (tabItems[index] && line) {
                const target = tabItems[index];
                line.style.left = target.offsetLeft + 'px';
                line.style.width = target.offsetWidth + 'px';
            }
        }

        // 4. BottomActionDialog (Home Comment Drawer)
        const mockCommentData = {
            '362': [
                { author: '小明', date: '5 天前', ip: '广东深圳', text: '确实，智谱的API有调用频次限制，本地跑的话显存至少要16G起步！不过手机ADB控制确实好玩~' },
                { author: 'Geek_Dev', date: '4 天前', ip: '上海', text: '蹲一个详细的折腾教程！AutoGLM对于UI点击的识别率目前能达到多少？(・ω・)' },
                { author: '若志', date: '3 天前', ip: '浙江杭州', text: '回复 @Geek_Dev ：识别常规app界面还行，遇到弹窗有时会卡壳，后面有空我整理篇详细的博文~' },
                { author: 'CyberGhost', date: '2 天前', ip: '北京', text: '科技改变生活啊，期待开源社区做出更轻量的端侧模型！(๑•̀ㅂ•́)و✧' }
            ],
            '344': [
                { author: '山野微风', date: '20 天前', ip: '四川成都', text: '热爱生活的人永远年轻！九宫格拼图很有仪式感 👏' },
                { author: '骑行客', date: '18 天前', ip: '云南昆明', text: '第二张骑行冲顶的照片太帅了！这是在哪条路线？' }
            ],
            '319': [
                { author: '火锅达人', date: '2 个月前', ip: '重庆', text: '重庆欢迎你！龙兴球场确实远，黄牛票千万不能信，现在全是大麦强实名了。夜景洪崖洞和千厮门大桥拍得很美！' }
            ],
            '313': [
                { author: '江南客', date: '2 个月前', ip: '浙江杭州', text: '“人生不过三万天，自由一天是一天”，很有感触。滨江区的樱花和西湖的冬日很有韵味。' }
            ],
            '301': [
                { author: '老朋友', date: '3 个月前', ip: '江苏南京', text: '哈哈哈哈，我也刚回访了一圈，看到大家还在写博客真的很感动！友链常在！(｡･ω･｡)' }
            ]
        };

        function openCommentDrawer(cid, initialCount) {
            currentActiveCid = cid;
            $('#comment-count-display').text(initialCount);
            renderComments(cid);

            if (!bottomDialogInstance) {
                bottomDialogInstance = new QBottomActionDialog('#BottomActionDialog');
                bottomDialogInstance.setCanceledonScrollOutside(true);
                bottomDialogInstance.setCancelButtonOnClick(() => {
                    closeCommentDrawer();
                });
            }
            bottomDialogInstance.show();
        }

        function closeCommentDrawer() {
            if (bottomDialogInstance) {
                bottomDialogInstance.close();
            }
            $('.emoji-icons').slideUp();
            $('.user-info-body').slideUp();
        }

        function renderComments(cid) {
            const list = mockCommentData[cid] || [];
            const container = $('#BottomActionDialog .comments-list');
            container.empty();

            if (list.length === 0) {
                $('.comments-null').removeClass('hidden');
            } else {
                $('.comments-null').addClass('hidden');
                list.forEach(c => {
                    const itemHtml = \`
                        <div class="messages flex gap-3 text-sm border-b dark:border-slate-700/60 pb-3">
                            <div class="avatar rounded border dark:border-slate-700 w-8 h-8 flex-shrink-0 overflow-hidden">
                                <img class="rounded w-full h-full object-cover" src="assets/img/avatar_comment.png" alt="\${c.author}">
                            </div>
                            <div class="content flex-1">
                                <div class="content-info flex items-center gap-2 mb-1">
                                    <span class="name font-medium text-slate-700 dark:text-slate-300 text-xs">\${c.author}</span>
                                    <small class="messages-time text-gray-400 dark:text-gray-500 text-xs">\${c.date}</small>
                                    <small class="messages-ip text-gray-400 dark:text-gray-500 text-xs">[\${c.ip || '中国'}]</small>
                                </div>
                                <div class="contents rounded-md bg-gray-50 dark:bg-slate-700/70 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <div class="text break-all">\${c.text}</div>
                                </div>
                            </div>
                        </div>
                    \`;
                    container.append(itemHtml);
                });
            }
        }

        function submitComment() {
            const text = $('#message-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入评论内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#author').val().trim() || '热心网友';
            const newComment = {
                author: author,
                date: '刚刚',
                ip: '本地访客',
                text: text
            };

            if (!mockCommentData[currentActiveCid]) {
                mockCommentData[currentActiveCid] = [];
            }
            mockCommentData[currentActiveCid].push(newComment);

            renderComments(currentActiveCid);

            const countSpan = $(\`article[data-cid="\${currentActiveCid}"] .comment-num\`);
            const curVal = parseInt(countSpan.text() || '0', 10) + 1;
            countSpan.text(curVal);
            $('#comment-count-display').text(curVal);

            $('#message-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('评论发送成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();

            const panel = $('.qui-bottom-action-panel');
            panel.animate({ scrollTop: panel[0].scrollHeight }, 300);
        }

        function toggleEmojiPanel() {
            $('.emoji-icons').slideToggle();
            $('#emoji-icons-btn').toggleClass('border text-blue-400');
        }

        function switchEmojiTab(type) {
            $('.emoji-tab-btn').removeClass('active text-blue-400 font-bold');
            if (type === 'emoji') {
                $('.emoji-tab-btn:first').addClass('active text-blue-400 font-bold');
                $('#emoji-pane-standard').removeClass('hidden');
                $('#emoji-pane-owo').addClass('hidden');
            } else {
                $('.emoji-tab-btn:last').addClass('active text-blue-400 font-bold');
                $('#emoji-pane-standard').addClass('hidden');
                $('#emoji-pane-owo').removeClass('hidden');
            }
        }

        function insertEmoji(char) {
            const textarea = document.getElementById('message-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function toggleUserInfo() {
            $('.user-info-body').slideToggle();
        }

        function insertMarkdownLink() {
            const textarea = document.getElementById('message-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function togglePrivateComment() {
            const checkbox = document.getElementById('secret-button2');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    $('#private-icon-line').addClass('hidden');
                    $('#private-icon-fill').removeClass('hidden');
                } else {
                    $('#private-icon-line').removeClass('hidden');
                    $('#private-icon-fill').addClass('hidden');
                }
            }
        }

        function autoResize(el) {
            el.style.height = 'auto';
            el.style.height = (el.scrollHeight) + 'px';
        }

        // 5. Feed Likes
        function handleLike(el) {
            const $el = $(el);
            const icon = $el.find('i');
            const numSpan = $el.find('.like-num');
            let count = parseInt(numSpan.text() || '0', 10);

            if (icon.hasClass('ri-heart-line')) {
                icon.removeClass('ri-heart-line').addClass('ri-heart-fill text-red-500');
                numSpan.text(count + 1);
                numSpan.addClass('text-red-500');

                let mToast = new QToast();
                mToast.setMessage('点赞成功 +1');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            } else {
                icon.removeClass('ri-heart-fill text-red-500').addClass('ri-heart-line');
                numSpan.text(Math.max(0, count - 1));
                numSpan.removeClass('text-red-500');
            }
        }

        // 6. Post Detail (/archives/362/)
        function handleDetailLike(el) {
            const $el = $(el);
            const icon = $el.find('i');
            const numSpan = $el.find('.detail-like-num');
            let count = parseInt(numSpan.text() || '53', 10);

            if (icon.hasClass('ri-heart-line')) {
                icon.removeClass('ri-heart-line').addClass('ri-heart-fill text-red-500');
                numSpan.text(count + 1);
                numSpan.addClass('text-red-500');

                let mToast = new QToast();
                mToast.setMessage('点赞成功 +1');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            } else {
                icon.removeClass('ri-heart-fill text-red-500').addClass('ri-heart-line');
                numSpan.text(Math.max(0, count - 1));
                numSpan.removeClass('text-red-500');
            }
        }

        function submitDetailComment() {
            const text = $('#detail-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入评论内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#detail-author').val().trim() || '热心网友';
            const newCommentHtml = \`
                <li class="messages messages-l Comments-by-user comment-parent comment-odd depth-1">
                    <div class="avatar rounded border dark:border-slate-700 relative">
                        <img class="rounded" src="assets/img/avatar_comment.png" alt="\${author}" width="32" height="32">
                        <div class="messages-at w-full h-full absolute left-0 top-0 flex justify-center items-center bg-gray-50 dark:bg-slate-700 cursor-pointer">@</div>
                    </div>
                    <div class="content">
                        <div class="flex items-center mb-1 gap-1 name content-info">
                            <b>\${author}</b>
                            <div class="messages-time text-gray-400 dark:text-gray-500">刚刚</div>
                        </div>
                        <div class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700" view-image="">
                            <div class="text break-all">
                                <p>\${text}</p>
                            </div>
                        </div>
                    </div>
                </li>
            \`;

            $('#detail-comments-list').prepend(newCommentHtml);

            const badge = $('.detail-comments-count-badge');
            const curVal = parseInt(badge.text() || '30', 10) + 1;
            badge.text(curVal);

            $('#detail-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('评论发表成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        function toggleDetailUserInfo() {
            $('.detail-user-info-body').slideToggle();
        }

        function toggleDetailEmojiPanel() {
            $('#detail-emoji-panel').slideToggle();
        }

        function switchDetailEmojiTab(type) {
            if (type === 'emoji') {
                $('#detail-emoji-pane-std').removeClass('hidden');
                $('#detail-emoji-pane-owo').addClass('hidden');
                $('.detail-emoji-tab-std').addClass('active font-bold text-blue-400');
                $('.detail-emoji-tab-owo').removeClass('active font-bold text-blue-400');
            } else {
                $('#detail-emoji-pane-std').addClass('hidden');
                $('#detail-emoji-pane-owo').removeClass('hidden');
                $('.detail-emoji-tab-std').removeClass('active font-bold text-blue-400');
                $('.detail-emoji-tab-owo').addClass('active font-bold text-blue-400');
            }
        }

        function insertDetailEmoji(char) {
            const textarea = document.getElementById('detail-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function insertDetailMarkdownLink() {
            const textarea = document.getElementById('detail-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function toggleDetailPrivateComment() {
            let mToast = new QToast();
            mToast.setMessage('私密评论功能已切换');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1200);
            mToast.show();
        }

        // 7. Messages / Guestbook (/messages)
        function toggleMsgUserInfo() {
            $('.msg-user-info-body').slideToggle();
        }

        function toggleMsgEmojiPanel() {
            $('#msg-emoji-panel').slideToggle();
        }

        function switchMsgEmojiTab(type) {
            if (type === 'emoji') {
                $('#msg-emoji-pane-std').removeClass('hidden');
                $('#msg-emoji-pane-owo').addClass('hidden');
                $('.msg-emoji-tab-std').addClass('active font-bold text-blue-400');
                $('.msg-emoji-tab-owo').removeClass('active font-bold text-blue-400');
            } else {
                $('#msg-emoji-pane-std').addClass('hidden');
                $('#msg-emoji-pane-owo').removeClass('hidden');
                $('.msg-emoji-tab-std').removeClass('active font-bold text-blue-400');
                $('.msg-emoji-tab-owo').addClass('active font-bold text-blue-400');
            }
        }

        function insertMsgEmoji(char) {
            const textarea = document.getElementById('msg-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function insertMsgMarkdownLink() {
            const textarea = document.getElementById('msg-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function toggleMsgPrivateComment() {
            let mToast = new QToast();
            mToast.setMessage('私密留言已开启');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1200);
            mToast.show();
        }

        function submitGuestbookMessage() {
            const text = $('#msg-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入留言内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#msg-author').val().trim() || '热心网友';
            const newMsgHtml = \`
                <li class="messages messages-l Comments-by-user comment-parent comment-odd depth-1 animate-fade-in">
                    <div class="avatar rounded border dark:border-slate-700 relative">
                        <img class="rounded" src="assets/img/avatar_comment.png" alt="\${author}" width="32" height="32">
                        <div class="messages-at w-full h-full absolute left-0 top-0 flex justify-center items-center bg-gray-50 dark:bg-slate-700 cursor-pointer">@</div>
                    </div>
                    <div class="content">
                        <div class="flex items-center mb-1 gap-1 name content-info">
                            <b>\${author}</b>
                            <div class="messages-time text-gray-400 dark:text-gray-500">刚刚</div>
                        </div>
                        <div class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700" view-image="">
                            <div class="text break-all">
                                <p>\${text}</p>
                            </div>
                        </div>
                    </div>
                </li>
            \`;

            $('#messages-comment-list').prepend(newMsgHtml);

            const badge = $('#messages-count-badge');
            const curVal = parseInt(badge.text() || '823', 10) + 1;
            badge.text(curVal);

            $('#msg-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('留言发送成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        // 8. Search
        function filterPosts(keyword) {
            const query = (keyword || '').trim().toLowerCase();
            const activeTabPane = $('.page_tab_body').eq(currentTabIndex);
            const articles = activeTabPane.find('.post-item');

            articles.each(function() {
                const text = $(this).text().toLowerCase();
                if (!query || text.includes(query)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        }

        function triggerSearch() {
            const val = $('#search').val();
            let mLoadingTip = new QLoadingTip();
            mLoadingTip.setMessage('正在检索文章...');
            mLoadingTip.setTime(800);
            mLoadingTip.show();

            if ($('#view-home').hasClass('hidden')) {
                navigateTo('/');
            }
            filterPosts(val);
        }

        // 9. Login Modal
        function toggleLoginModal(show) {
            if (show) {
                $('#Login').addClass('qui-page-show');
            } else {
                $('#Login').removeClass('qui-page-show');
            }
        }

        function submitLogin() {
            const name = $('#login_name').val().trim();
            toggleLoginModal(false);
            let mToast = new QToast();
            mToast.setMessage('登录成功，欢迎：' + (name || '若志'));
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        // 10. Mobile Menu
        function toggleMobileNav(open) {
            if (open) {
                $('body').addClass('nav-open');
            } else {
                $('body').removeClass('nav-open');
            }
        }

        // 11. Scroll
        function handleScroll(el) {
            if (el.scrollTop > 100) {
                $('#GoTop').removeClass('hidden');
            } else {
                $('#GoTop').addClass('hidden');
            }
        }

        function scrollToTop() {
            $('.page_content').animate({ scrollTop: 0 }, 300);
            $(window).scrollTop(0);
        }

        function triggerLoadMore(el) {
            const $btn = $(el);
            $btn.text('正在加载中...');
            setTimeout(() => {
                $btn.text('已加载全部内容');
                let mToast = new QToast();
                mToast.setMessage('已加载全部动态');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            }, 600);
        }
    </script>
</body>
</html>
`;

fs.writeFileSync('index.html', finalIndexHtml, 'utf-8');
console.log('Clean index.html rebuilt successfully! File size:', finalIndexHtml.length);
