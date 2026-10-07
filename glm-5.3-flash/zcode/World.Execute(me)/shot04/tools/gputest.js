// tools/gputest.js — find a WebGL backend that uses the real GPU, with timeouts.
'use strict';
const path = require('path');
process.env.PUPPETEER_CACHE_DIR = path.join(ROOT(), '.chrome');
function ROOT() { return path.join(__dirname, '..'); }
const puppeteer = require('puppeteer');

const CONFIGS = [
  ['headless+d3d11', { headless: true, args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] }],
  ['headful+d3d11', { headless: false, args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-sandbox', '--window-position=-32000,-32000', '--window-size=800,600'] }],
  ['headful+default', { headless: false, args: ['--no-sandbox', '--window-position=-32000,-32000', '--window-size=800,600'] }],
];

function withTimeout(p, ms, tag) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT ' + tag)), ms))]);
}

(async () => {
  for (const [name, opts] of CONFIGS) {
    let browser;
    try {
      browser = await withTimeout(puppeteer.launch(opts), 45000, 'launch:' + name);
      const page = await withTimeout(browser.newPage(), 20000, 'newPage');
      await withTimeout(page.setContent('<canvas id=c width=800 height=450></canvas>'), 10000, 'setContent');
      const info = await withTimeout(page.evaluate(() => {
        const gl = document.getElementById('c').getContext('webgl2', { powerPreference: 'high-performance' });
        if (!gl) return 'NO WEBGL2';
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }), 20000, 'glinfo:' + name);
      console.log(`[${name}] ${info}`);
      // quick render benchmark: 200 fill+blend fullscreens
      if (String(info).includes('SwiftShader')) { console.log(`[${name}] -> software, skip bench`); }
      else {
        const ms = await withTimeout(page.evaluate(() => {
          const c = document.getElementById('c');
          const gl = c.getContext('webgl2');
          const vs = '#version 300 es\nvoid main(){float x=float(gl_VertexID&1),y=float((gl_VertexID>>1)&1);gl_Position=vec4(x*2.-1.,1.-y*2.,0.,1.);}';
          const fs = '#version 300 es\nprecision mediump float;out vec4 f;void main(){f=vec4(0.5,0.3,0.2,1.0);}';
          const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
          const p = gl.createProgram();
          gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
          gl.linkProgram(p); gl.useProgram(p);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          const t0 = performance.now();
          for (let i = 0; i < 300; i++) gl.drawArrays(gl.TRIANGLES, 0, 6);
          gl.flush();
          const t1 = performance.now();
          return t1 - t0;
        }), 30000, 'bench:' + name);
        console.log(`[${name}] 300 trivial fullscreen draws: ${ms.toFixed(1)} ms`);
      }
    } catch (e) {
      console.log(`[${name}] FAILED: ${String(e.message).split('\n')[0]}`);
    } finally {
      try { if (browser) await browser.close(); } catch (_) { }
    }
  }
  process.exit(0);
})();
