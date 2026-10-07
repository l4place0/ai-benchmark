const { launch } = require('./snap');
const { start } = require('./server');
(async () => {
  const srv = await start(0); const port = srv.address().port;
  const b = await launch();
  const p = await b.newPage();
  p.on('requestfailed', r => console.log('FAILED', r.url(), r.failure()));
  p.on('response', r => console.log('RESP', r.status(), r.url(), r.headers()['content-type']));
  try { await p.goto(`http://127.0.0.1:${port}/src/index.html`); } catch (e) { console.log('ERR', e.message); }
  await new Promise(r => setTimeout(r, 3000));
  console.log(await p.evaluate(() => location.href + ' ' + document.title + ' ' + (window.READY || window.LOAD_ERROR)));
  await b.close(); srv.close();
})();
