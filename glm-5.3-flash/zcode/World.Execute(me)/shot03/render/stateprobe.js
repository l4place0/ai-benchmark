// stateprobe.js — dump computeState internals at a given t
const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const t = parseFloat(process.argv[2] || '159.3');
  const b = await puppeteer.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const p = await b.newPage();
  await p.goto('file:///' + path.resolve('../mv/index.html').replace(/\\/g, '/') + '?render=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__ready === true', { timeout: 120000, polling: 200 });
  const r = await p.evaluate(t => {
    const st = computeState(t);
    return JSON.stringify({ fx: st.fx, contract: st.contract, burst: EXEC_BURST_T, cues: COUNT_CUES.map(c => [c.t, c.text]), motes: st.motes, exposure: st.fx[3] });
  }, t);
  console.log('t=' + t, r);
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
