#!/usr/bin/env node
/* =============================================================================
   run.mjs — drive a Canvas-2D page through the mockdom harness and render it.

   Usage:
     node _dev/run.mjs --html=index.html --out=_dev/shot.png \
                       --w=1440 --h=900 --frames=180 [options]

   Options
     --html=<path>        page to load (default index.html, resolved against cwd
                          then against the project root)
     --out=<png>          write the rendered PNG here (skip with --out=-)
     --dump-svg=<svg>     also write an SVG replay of the same op stream
     --w= --h=            viewport size (default 1440x900)
     --dpr=<n>            devicePixelRatio (default 1)
     --frames=<n>         rAF frames to advance (default 180, 1 frame = 1000/60 ms)
     --step=<ms>          clock step override (default 16.667)
     --script=<js>        classic script evaluated AFTER the frames are advanced
                          (simulate clicks/drags; it gets page/window globals and
                          the helpers click(x,y) move(x,y) drag(...) wheel(...))
     --pre-script=<js>    script evaluated BEFORE the frames are advanced
     --script-frames=<n>  extra frames to advance after --script (default 0)
     --frame=last|all     replay only the final animation frame (default) or every
                          recorded op
     --bg=<css colour>    background colour of the render (default #ffffff)
     --auto-ids           auto-create elements for ids the JS asks for but the
                          HTML never declares (off by default = browser behaviour)
     --allow-warnings     do not fail the run when the canvas recorded warnings
     --json=<path>        also write the JSON summary to this file
     --python=<path>      interpreter used for rasterisation
     --verbose            echo page console output as it happens
     --quiet              suppress the human-readable lines on stderr

   Exit codes: 0 ok · 1 page errors/warnings · 2 harness failure (no HTML, no 2d
   context, rasterisation failed).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPage, VERSION } from './mockdom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------- args */

function parseArgs(argv) {
  const out = { _: [] };
  for (const raw of argv) {
    if (!raw.startsWith('--')) { out._.push(raw); continue; }
    const eq = raw.indexOf('=');
    let key = eq < 0 ? raw.slice(2) : raw.slice(2, eq);
    let value = eq < 0 ? true : raw.slice(eq + 1);
    key = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'allowWarnings' || key === 'verbose' || key === 'quiet' || key === 'autoIds') value = value !== 'false';
    out[key] = value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const log = (...a) => { if (!args.quiet) console.error(...a); };

function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function resolveInput(p, dflt) {
  const wanted = p === undefined || p === true ? dflt : String(p);
  const cands = [path.resolve(process.cwd(), wanted), path.resolve(ROOT, wanted)];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return cands[0];
}

const width = num(args.w, 1440);
const height = num(args.h, 900);
const dpr = num(args.dpr, 1);
const frameCount = Math.max(0, Math.floor(num(args.frames, 180)));
const stepMs = num(args.step, 1000 / 60);
const htmlPath = resolveInput(args.html, 'index.html');
const outPng = args.out === undefined ? path.resolve(ROOT, '_dev', 'render.png')
  : (args.out === '-' ? null : path.resolve(process.cwd(), String(args.out)));
const outSvg = args.dumpSvg && args.dumpSvg !== true ? path.resolve(process.cwd(), String(args.dumpSvg))
  : (args.dumpSvg === true ? path.resolve(ROOT, '_dev', 'render.svg') : null);

function emit(summary, code) {
  const text = JSON.stringify(summary, null, 2);
  if (args.json && args.json !== true) {
    try { fs.writeFileSync(path.resolve(process.cwd(), String(args.json)), text); } catch (e) { log('could not write --json: ' + e.message); }
  }
  process.stdout.write(text + '\n');
  process.exit(code);
}

function fatal(message, extra = {}) {
  emit({ ok: false, fatal: message, html: htmlPath, harness: VERSION, ...extra }, 2);
}

/* ------------------------------------------------------------------- run */

if (!fs.existsSync(htmlPath)) {
  fatal('HTML file not found: ' + htmlPath, { searched: [path.resolve(process.cwd(), String(args.html || 'index.html')), path.resolve(ROOT, String(args.html || 'index.html'))] });
}

log(`[mockdom] v${VERSION}  ${path.relative(ROOT, htmlPath) || htmlPath}  ${width}x${height} @${dpr}x  frames=${frameCount}`);

const page = createPage({
  width, height, devicePixelRatio: dpr,
  verbose: !!args.verbose,
  autoCreateMissingIds: !!args.autoIds,
  python: args.python && args.python !== true ? String(args.python) : null,
  rootDir: ROOT,
});

let fatalError = null;
try {
  page.loadHtml(htmlPath);
  const loaded = page.loadScriptsInOrder(htmlPath);
  log(`[mockdom] loaded ${loaded.length} script(s): ${loaded.map((p) => path.basename(String(p))).join(', ') || '(none)'}`);

  // interaction helpers are globals for --script/--pre-script bodies
  page.window.__mockdomPageRef = page;
  page.evalInPage(
    'globalThis.page = __mockdomPageRef;'
    + 'globalThis.click = function (x, y, o) { return page.click(x, y, o); };'
    + 'globalThis.move = function (x, y, o) { return page.move(x, y, o); };'
    + 'globalThis.drag = function (x1, y1, x2, y2, n, o) { return page.drag(x1, y1, x2, y2, n, o); };'
    + 'globalThis.wheel = function (x, y, dy, o) { return page.wheel(x, y, dy, o); };'
    + 'globalThis.press = function (k, o) { return page.press(k, o); };'
    + 'delete globalThis.__mockdomPageRef;',
    '<helpers>',
  );

  if (args.preScript && args.preScript !== true) {
    page.loadScript(String(args.preScript));
    log('[mockdom] ran --pre-script');
  }

  const t0 = process.hrtime.bigint();
  page.advance(frameCount * stepMs, { stepMs });
  const realMs = Number(process.hrtime.bigint() - t0) / 1e6;
  log(`[mockdom] advanced ${page.steps} steps / ${page.frameCount} rAF frames in ${realMs.toFixed(0)}ms wall`);

  if (args.script && args.script !== true) {
    page.loadScript(String(args.script));
    log('[mockdom] ran --script');
  }
  const extraFrames = Math.max(0, Math.floor(num(args.scriptFrames, 0)));
  if (extraFrames) page.advance(extraFrames * stepMs, { stepMs });

  const summary = page.summary();
  const renderFrame = args.frame === 'all' ? 'all' : 'last';
  const bg = args.bg && args.bg !== true ? String(args.bg) : '#ffffff';

  let png = null;
  let svg = null;
  try {
    if (outSvg) {
      const svgPath = page.renderToSVG({ width, height, background: bg, frame: renderFrame, path: outSvg });
      svg = page.lastRenderSVG;
      log(`[mockdom] SVG ${path.relative(ROOT, svgPath)} (${svg.elements} elements, ${svg.ops} ops)`);
    }
    if (outPng) {
      const pngPath = page.renderToPNG({ width, height, background: bg, frame: renderFrame, path: outPng });
      png = page.lastRenderPNG;
      log(`[mockdom] PNG ${path.relative(ROOT, pngPath)} (${png.bytes} bytes, ${png.ops} ops from #${png.from})`);
    }
  } catch (e) {
    fatalError = e;
  }

  const warnings = summary.warnings;
  const errors = summary.errors;
  const ok = !fatalError && errors.length === 0 && (args.allowWarnings || warnings.length === 0);

  const result = {
    ok,
    harness: VERSION,
    html: htmlPath,
    viewport: { width, height, devicePixelRatio: dpr },
    frames: summary.frames,
    steps: summary.steps,
    elapsedMs: summary.elapsedMs,
    fps_estimate: summary.fps_estimate,
    harness_fps: realMs > 0 ? Math.round((summary.frames / (realMs / 1000)) * 10) / 10 : null,
    errors,
    warnings,
    notes: summary.notes,
    missingIds: summary.missingIds,
    consoleErrors: summary.consoleErrors,
    canvas: summary.canvas,
    stats: summary.stats,
    finalize: summary.finalize ? {
      balanced: summary.finalize.balanced,
      saveDepth: summary.finalize.saveDepth,
      saves: summary.finalize.saves,
      restores: summary.finalize.restores,
      restoresUnderflow: summary.finalize.restoresUnderflow,
      calls: summary.finalize.calls,
      drawingOps: summary.finalize.drawingOps,
      frames: summary.finalize.frames,
      clipBox: summary.finalize.clipBox,
      assertionErrors: summary.finalize.assertionErrors,
    } : null,
    render: {
      frame: renderFrame,
      png: png ? { path: png.path, bytes: png.bytes, ops: png.ops, from: png.from, rasterErrors: (png.raster && png.raster.errors) || [], rasterWarnings: (png.raster && png.raster.warnings) || [] } : null,
      svg: svg ? { path: svg.path, bytes: svg.bytes, elements: svg.elements, ops: svg.ops } : null,
      notes: [...(png ? png.notes : []), ...(svg ? svg.notes : [])],
    },
    fatal: fatalError ? String(fatalError.message) : null,
  };

  if (!args.quiet) {
    for (const e of errors.slice(0, 8)) log(`[error] ${e.where}: ${e.message}`);
    for (const w of warnings.slice(0, 8)) log(`[warn ] ${w.op}: ${w.message}`);
    if (fatalError) log('[fatal] ' + fatalError.message);
  }
  emit(result, ok ? 0 : (fatalError && errors.length === 0 && warnings.length === 0 ? 2 : 1));
} catch (e) {
  fatal('harness exception: ' + (e && e.stack ? e.stack : e));
} finally {
  page.close();
}
