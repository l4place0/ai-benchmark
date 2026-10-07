const http = require('http');

const routes = [
    '/',
    '/about',
    '/archives',
    '/messages',
    '/photos',
    '/circle',
    '/links',
    '/archives/362/',
    '/assets/img/688187080795d.jpg'
];

async function checkRoute(r) {
    return new Promise((resolve) => {
        http.get(`http://localhost:8089${r}`, (res) => {
            console.log(`Route: ${r.padEnd(20)} => Status: ${res.statusCode} | Content-Type: ${res.headers['content-type']}`);
            resolve(res.statusCode);
        }).on('error', (err) => {
            console.error(`Route: ${r.padEnd(20)} => ERROR: ${err.message}`);
            resolve(0);
        });
    });
}

(async () => {
    for (const r of routes) {
        await checkRoute(r);
    }
})();
