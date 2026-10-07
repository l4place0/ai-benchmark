const http = require('http');
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
        const normalized = pathname.replace(/\/+$/, '') || '/';
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
    console.log(`Server is running at http://localhost:${PORT}/`);
});
