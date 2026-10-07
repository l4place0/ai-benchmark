// GPU / capture speed probe
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { findChrome } = require('./chrome');
(async () => {
  const exe = findChrome();
  console.log('chrome:', exe);
  const flags = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true,
    userDataDir: path.join(__dirname, '..', '.cache', 'chrome-profile-probe'),
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', ...flags, '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  await page.setContent(`<canvas id=c width=1920 height=1080></canvas>`);
  const info = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return 'no webgl2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    // heavy-ish fragment shader benchmark
    const vs = `#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
    const fs = `#version 300 es\nprecision highp float;out vec4 o;uniform float t;void main(){vec2 uv=gl_FragCoord.xy/1080.;float s=0.;for(int i=0;i<64;i++){s+=sin(uv.x*float(i)+t)*cos(uv.y*float(i)*1.3-t);}o=vec4(vec3(s*.05+.5),1);}`;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const T = performance.now();
    const px = new Uint8Array(4);
    for (let i = 0; i < 20; i++) { gl.uniform1f(gl.getUniformLocation(pr, 't'), i); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return r + ' | 20 heavy frames ms: ' + (performance.now() - T).toFixed(0);
  });
  console.log(info);
  let T = Date.now();
  for (let i = 0; i < 10; i++) await page.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.92).length);
  console.log('toDataURL jpeg x10 (in-page only)', Date.now() - T, 'ms');
  T = Date.now();
  let len = 0;
  for (let i = 0; i < 10; i++) len += (await page.evaluate(() => document.getElementById('c').toDataURL('image/jpeg', 0.92))).length;
  console.log('toDataURL jpeg x10 transfer', Date.now() - T, 'ms', len / 10);
  const cdp = await page.createCDPSession();
  T = Date.now();
  for (let i = 0; i < 10; i++) await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
  console.log('CDP screenshot jpeg x10', Date.now() - T, 'ms');
  T = Date.now();
  for (let i = 0; i < 10; i++) await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  console.log('CDP screenshot png x10', Date.now() - T, 'ms');
  await browser.close();
})();
