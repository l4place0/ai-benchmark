const fs = require('fs');
const path = require('path');

console.log('--- Step 1: Building robust server.js ---');

const serverJsContent = `const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8089;
const PUBLIC_DIR = __dirname;

process.on('uncaughtException', (err) => {
    console.error('Server Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (err) => {
    console.error('Server Unhandled Rejection:', err);
});

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const mockComments = {
    '362': [
        {
            coid: '101', cid: '362', author: '小明', mail: 'xiaoming@qq.com',
            created: Math.floor(Date.now() / 1000) - 86400 * 5,
            text: '确实，智谱的API有调用频次限制，本地跑的话显存至少要16G起步！不过手机ADB控制确实好玩~',
            parent: '0'
        },
        {
            coid: '102', cid: '362', author: 'Geek_Dev', mail: 'geek@dev.com',
            created: Math.floor(Date.now() / 1000) - 86400 * 4,
            text: '蹲一个详细的折腾教程！AutoGLM对于UI点击的识别率目前能达到多少？(・ω・)',
            parent: '0'
        },
        {
            coid: '103', cid: '362', author: '若志', mail: 'irils@qq.com',
            created: Math.floor(Date.now() / 1000) - 86400 * 3,
            text: '回复 @Geek_Dev ：识别常规app界面还行，遇到弹窗有时会卡壳，后面有空我整理篇详细的博文~',
            parent: '102'
        },
        {
            coid: '104', cid: '362', author: 'CyberGhost', mail: 'cyber@mail.net',
            created: Math.floor(Date.now() / 1000) - 86400 * 2,
            text: '科技改变生活啊，期待开源社区做出更轻量的端侧模型！(๑•̀ㅂ•́)و✧',
            parent: '0'
        }
    ]
};

function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (!res.headersSent) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            }
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType || 'application/octet-stream',
            'Content-Length': data.length,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

function serveIndex(res) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    serveFile(res, indexPath, 'text/html; charset=utf-8');
}

const server = http.createServer((req, res) => {
    try {
        let pathname = req.url.split('?')[0];
        try {
            pathname = decodeURIComponent(pathname);
        } catch(e) {}

        // 1. API Handling
        if (req.url.includes('action=loadCategoryPosts')) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Loaded successfully' }));
            return;
        }

        if (req.url.includes('action=getpostcomments')) {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const params = new URLSearchParams(body);
                const cid = params.get('cid') || '362';
                const list = mockComments[cid] || [];
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    data: JSON.stringify(list)
                }));
            });
            return;
        }

        if (pathname.includes('/comment')) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '留言成功！' }));
            return;
        }

        if (pathname.includes('/like') || req.url.includes('action=like')) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '点赞成功' }));
            return;
        }

        if (pathname.includes('login')) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '登录成功' }));
            return;
        }

        // 2. Asset rewrites
        if (pathname.startsWith('/usr/themes/A-Sleek/src/img/loading.svg')) {
            return serveFile(res, path.join(PUBLIC_DIR, 'assets', 'img', 'loading.svg'), 'image/svg+xml');
        }
        if (pathname.startsWith('/usr/plugins/Links/nopic.png')) {
            return serveFile(res, path.join(PUBLIC_DIR, 'assets', 'img', 'loading.svg'), 'image/svg+xml');
        }
        if (pathname.startsWith('/usr/themes/A-Sleek/src/')) {
            const rel = pathname.replace('/usr/themes/A-Sleek/src/', 'assets/');
            const filePath = path.join(PUBLIC_DIR, rel);
            const ext = path.extname(filePath).toLowerCase();
            return serveFile(res, filePath, MIME_TYPES[ext]);
        }

        // 3. SPA Route Fallback
        const normalized = pathname.replace(/\\/+$/, '') || '/';
        const isSpaRoute = 
            normalized === '/' || 
            normalized === '/about' || 
            normalized === '/archives' || 
            normalized.startsWith('/archives/') || 
            (normalized.startsWith('/archives') && normalized !== '/archives') ||
            normalized === '/messages' || 
            normalized === '/photos' || 
            normalized === '/circle' || 
            normalized === '/links' ||
            normalized === '/lifes' ||
            normalized === '/study-notes' ||
            normalized === '/blog-notes' ||
            normalized === '/do-notes';

        if (isSpaRoute) {
            return serveIndex(res);
        }

        // 4. Static Files
        const filePath = path.join(PUBLIC_DIR, pathname);
        if (!filePath.startsWith(PUBLIC_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                if (!path.extname(filePath)) {
                    return serveIndex(res);
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            serveFile(res, filePath, MIME_TYPES[ext]);
        });
    } catch(err) {
        console.error('Request handling error:', err);
        if (!res.headersSent) {
            res.writeHead(500);
            res.end('Server Error');
        }
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server is running at http://localhost:\${PORT}/\`);
});
`;

fs.writeFileSync('server.js', serverJsContent, 'utf-8');
console.log('server.js updated successfully.');

console.log('--- Step 2: Preparing Clean Subpage HTML with Interactivity ---');

// Read raw clean extracted templates
let aboutHtml = fs.readFileSync('target_pages/about_clean_pjax.html', 'utf-8');
let archivesHtml = fs.readFileSync('target_pages/archives_clean_pjax.html', 'utf-8');
let messagesHtml = fs.readFileSync('target_pages/messages_clean_pjax.html', 'utf-8');
let photosHtml = fs.readFileSync('target_pages/photos_clean_pjax.html', 'utf-8');
let circleHtml = fs.readFileSync('target_pages/circle_clean_pjax.html', 'utf-8');
let linksHtml = fs.readFileSync('target_pages/links_clean_pjax.html', 'utf-8');
let postDetailHtml = fs.readFileSync('target_pages/post_detail_clean_pjax.html', 'utf-8');

// 1. About
aboutHtml = aboutHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-about" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');

// 2. Archives
archivesHtml = archivesHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-archives" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
archivesHtml = archivesHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/lifes"', 'href="javascript:void(0)" onclick="navigateToCategory(1)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/study-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(2)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/blog-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(3)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/do-notes"', 'href="javascript:void(0)" onclick="navigateToCategory(4)"');
archivesHtml = archivesHtml.replace('href="https://rz.sb/photos"', 'href="/photos" onclick="event.preventDefault(); navigateTo(\'/photos\');"');

// 3. Messages
messagesHtml = messagesHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-messages" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
messagesHtml = messagesHtml.replace('留言 <sup>823</sup>', '留言 <sup><span id="messages-count-badge">823</span></sup>');
messagesHtml = messagesHtml.replace('<ol class="comment-list">', '<ol class="comment-list" id="messages-comment-list">');

// Find form in messagesHtml and replace with interactive form
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
            <i class="emoji-icon cursor-pointer hover:scale-125 transition" onclick="insertMsgEmoji('😵')">😵</i>
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

// 4. Photos
photosHtml = photosHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-photos" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/688187080795d\.jpg/g, 'assets/img/688187080795d.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/6880496682b4a\.jpg/g, 'assets/img/6880496682b4a.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/6636f0301fd28\.jpg/g, 'assets/img/69244898a1d80.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/time\/65facdf0aec74\.jpg/g, 'assets/img/6880496807778.jpg');
photosHtml = photosHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2024\/01\/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75\.webp/g, 'assets/img/o8JneCGKxAKAzCsnEAAxDbeSCGpwlIAPkAs9gu_tplv-dy-aweme-images_q75.webp');
photosHtml = photosHtml.replace(/href="https:\/\/rz\.sb\/archives\/(\d+)\/?"/g, 'href="/archives/$1/" onclick="event.preventDefault(); navigateTo(\'/archives/$1/\');"');

// 5. Circle
circleHtml = circleHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-circle" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');

// 6. Links
linksHtml = linksHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-links" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
linksHtml = linksHtml.replace(/\/usr\/themes\/A-Sleek\/src\/img\/loading\.svg/g, 'assets/img/loading.svg');
linksHtml = linksHtml.replace(/https:\/\/rz\.sb\/usr\/plugins\/Links\/nopic\.png/g, 'assets/img/loading.svg');

// 7. Post Detail
postDetailHtml = postDetailHtml.replace('<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">', '<div id="view-post_detail" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl hidden">');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2528495709\.png/g, 'assets/img/2528495709.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/2175131578\.png/g, 'assets/img/2175131578.png');
postDetailHtml = postDetailHtml.replace(/https:\/\/rz\.isi\.indevs\.in\/irils-imgs\/usr\/uploads\/2025\/12\/263988800\.png/g, 'assets/img/263988800.png');
postDetailHtml = postDetailHtml.replace(/<a href="#" class="post-suport" data-cid="362">([\s\S]*?)<\/a>/, '<a href="javascript:void(0)" class="post-suport cursor-pointer" onclick="handleDetailLike(this)" data-cid="362">$1</a>');
postDetailHtml = postDetailHtml.replace('<small> 53 </small>', '<small class="detail-like-num">53</small>');
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

console.log('--- Step 3: Assembling Unified index.html ---');

// Read target_source.html as base for pristine structure or current index.html
let baseHtml = fs.readFileSync('index.html', 'utf-8');

// Ensure home view has id="view-home" and class="page-view"
if (!baseHtml.includes('id="view-home"')) {
    baseHtml = baseHtml.replace(
        '<div class="pjax-content bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">',
        '<div id="view-home" class="pjax-content page-view bg-white dark:bg-slate-800 md:border-l dark:border-l-slate-800 md:dark:border-r dark:border-r-slate-700 md:dark:border-b dark:border-b-slate-700 relative md:rounded-br-xl">'
    );
}

// Remove any previously inserted views between view-home and </main>
const viewHomeEnd = baseHtml.indexOf('</div>\n\n            </div>\n        </main>');
let homeEndIdx = -1;
if (viewHomeEnd !== -1) {
    homeEndIdx = viewHomeEnd + 6; // after </div>
} else {
    // find end of view-home
    const vhIdx = baseHtml.indexOf('id="view-home"');
    const mEnd = baseHtml.indexOf('</main>', vhIdx);
    const lastDiv = baseHtml.lastIndexOf('</div>', mEnd);
    homeEndIdx = lastDiv + 6;
}

// Ensure clean insertion point right before </main>
const mEndIdx = baseHtml.lastIndexOf('</main>');

// Remove any older subpages bundle if present
let cleanMainBefore = baseHtml.substring(0, baseHtml.indexOf('id="view-home"'));
const viewHomeStart = baseHtml.indexOf('id="view-home"');
const viewHomeOuterStart = baseHtml.lastIndexOf('<div', viewHomeStart);
const pjaxUlEnd = baseHtml.indexOf('</div>\n                </div>\n\n            </div>', viewHomeOuterStart);
let homePjaxChunk = '';
if (pjaxUlEnd !== -1) {
    homePjaxChunk = baseHtml.substring(viewHomeOuterStart, pjaxUlEnd + '</div>\n                </div>\n\n            </div>'.length);
} else {
    // fallback
    const viewAboutIdx = baseHtml.indexOf('id="view-about"');
    if (viewAboutIdx !== -1) {
        const vAboutOuter = baseHtml.lastIndexOf('<div', viewAboutIdx);
        homePjaxChunk = baseHtml.substring(viewHomeOuterStart, vAboutOuter).trim();
    } else {
        homePjaxChunk = baseHtml.substring(viewHomeOuterStart, mEndIdx).trim();
    }
}

// Make sure home view has proper id
if (!homePjaxChunk.includes('id="view-home"')) {
    homePjaxChunk = homePjaxChunk.replace('<div class="pjax-content', '<div id="view-home" class="page-view pjax-content');
}

// Rebuild Main
const updatedMainContent = `
            ${homePjaxChunk}

            <!-- Subpage Views -->
            ${aboutHtml}
            ${archivesHtml}
            ${messagesHtml}
            ${photosHtml}
            ${circleHtml}
            ${linksHtml}
            ${postDetailHtml}
        </main>`;

const mainStartIdx = baseHtml.indexOf('<main');
const finalHtmlBeforeMain = baseHtml.substring(0, mainStartIdx);
const mainHeaderStart = baseHtml.indexOf('<header', mainStartIdx);
const mainHeaderEnd = baseHtml.indexOf('</header>', mainHeaderStart) + 9;
const bottomDialogStart = baseHtml.indexOf('<div id="BottomActionDialog"', mainHeaderEnd);
const bottomDialogEnd = baseHtml.indexOf('</div>\n            </div>\n\n            <div id="view-home"', bottomDialogStart) !== -1 ?
    baseHtml.indexOf('</div>\n            </div>\n\n            <div id="view-home"', bottomDialogStart) + '</div>\n            </div>'.length :
    baseHtml.indexOf('<!-- Main Content Area', bottomDialogStart);

const loginSectionStart = baseHtml.indexOf('<section id="Login"', mainStartIdx);
const loginSectionEnd = baseHtml.indexOf('</section>', loginSectionStart) + 10;

const headerHtml = baseHtml.substring(mainHeaderStart, mainHeaderEnd);
const loginHtml = baseHtml.substring(loginSectionStart, loginSectionEnd);
const bottomDialogHtml = baseHtml.substring(baseHtml.indexOf('<div id="BottomActionDialog"'), baseHtml.indexOf('<!-- Main Content Area with PJAX and Tabs -->')).trim();

const completeMain = `
        <main class="flex-1 relative md:rounded-xl main_element overflow-auto border dark:border-none border-slate-200">
            ${loginHtml}
            ${headerHtml}
            ${bottomDialogHtml}
            ${homePjaxChunk}
            ${aboutHtml}
            ${archivesHtml}
            ${messagesHtml}
            ${photosHtml}
            ${circleHtml}
            ${linksHtml}
            ${postDetailHtml}
        </main>`;

// Clean scripts
const scriptLogic = `
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

            const nightCookie = document.cookie.replace(/(?:(?:^|.*;\\\\s*)night\\\\s*\\\\=\\\\s*([^;]*).*$)|^.*$/, "$1");
            if (nightCookie === '1') {
                document.documentElement.classList.add('dark');
            }

            // Router initial run
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

        // 2. Dark Mode
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

        // 3. Category Tabs
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

        // 4. Home Comment Drawer
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

        // 6. Post Detail Interactivity (/archives/362/)
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

        // 7. Messages / Guestbook Interactivity (/messages)
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

// Assemble full HTML
const fullHtml = finalHtmlBeforeMain + completeMain + `
    <!-- Fixed Bottom Right Copyright -->
    <footer class="p-4 text-center fixed bottom-0 right-0 hidden md:block pointer-events-none z-10">
        <p class="text-sm text-gray-400 pointer-events-auto">©<a href="/" rel="nofollow noopener" class="hover:text-blue-400">RZ.SB</a> 2018-2026</p>
    </footer>
` + scriptLogic;

fs.writeFileSync('index.html', fullHtml, 'utf-8');
console.log('Unified index.html built successfully, length:', fullHtml.length);
