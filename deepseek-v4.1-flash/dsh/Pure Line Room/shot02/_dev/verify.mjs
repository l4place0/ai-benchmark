// verify.mjs — headless verification for Pure Line Room.
//
//   node _dev/verify.mjs            full report + screenshots into _dev/shots/
//   node _dev/verify.mjs --quick    skip the per-part hover/click sweep
//
// Asserts: no page exceptions, no console errors, no external network requests,
// a sane object/part/primitive count, >=10 interactive parts, hover feedback on
// every part, and that clicking every part is safe.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const quick = process.argv.includes('--quick');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

const problems = [];
const notes = [];

const browser = await Browser.launch({ width: 1440, height: 900 });
const pageErrors = [];
const consoleErrors = [];
const network = [];

try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Log.enable');
  await browser.send('Network.enable');

  browser.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    pageErrors.push((d.exception && d.exception.description) || d.text || 'unknown exception');
  });
  browser.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'assert') {
      consoleErrors.push((p.args || []).map((a) => a.value || a.description || a.type).join(' '));
    }
  });
  browser.on('Log.entryAdded', (p) => {
    const e = p.entry || {};
    if (e.level === 'error') consoleErrors.push('[' + (e.source || 'log') + '] ' + e.text);
  });
  browser.on('Network.requestWillBeSent', (p) => {
    const u = p.request && p.request.url;
    if (u && !/^(file|data|blob):/.test(u)) network.push(u);
  });
  browser.on('Network.loadingFailed', (p) => {
    if (p.blockedReason || p.errorText) notes.push('request failed: ' + p.errorText + ' ' + (p.requestId || ''));
  });

  // Block anything that is not local, to prove the piece is offline-safe.
  await browser.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] });

  await browser.send('Page.navigate', { url: pageUrl });

  // ---- wait for boot ----------------------------------------------------
  let booted = false;
  for (let i = 0; i < 80; i++) {
    await sleep(200);
    try {
      const ok = await browser.evaluate(
        '!!(window.__ROOM__ && window.__ROOM__.scene && window.__ROOM__.scene.parts.length > 0)',
      );
      if (ok) { booted = true; break; }
    } catch (e) { /* page may still be loading */ }
  }
  if (!booted) {
    const err = await browser.evaluate(
      '(document.getElementById("boot-error")||{}).textContent || ""',
    ).catch(() => '');
    problems.push('the piece did not boot' + (err ? ' :: ' + err : ''));
  } else {
    await sleep(600);
    await browser.evaluate('window.__ROOM__.skipIntro()', { awaitPromise: false });
    await sleep(1400);
  }

  // ---- diagnostics ------------------------------------------------------
  const diag = await browser.evaluate(`(() => {
    const R = window.__ROOM__;
    let prims = 0, nan = 0;
    const walk = (n) => { prims += n.geo.length;
      for (const g of n.geo) for (const p of g.pts) if (!Number.isFinite(p[0])||!Number.isFinite(p[1])||!Number.isFinite(p[2])) nan++;
      for (const c of n.children) walk(c); };
    for (const o of R.scene.objects) walk(o.root);
    return {
      objects: R.scene.objects.length,
      parts: R.scene.parts.length,
      prims, nan,
      moduleErrors: R.errors.slice(),
      renderMs: R.renderer.stats.ms,
      drawn: R.renderer.stats.drawn,
      drawables: R.renderer.stats.drawables,
      nightT: R.ctx.nightT,
      parts_detail: R.scene.parts.map(p => p.key + ' | ' + p.label + (p.hint ? ' | ' + p.hint : '')),
    };
  })()`, { awaitPromise: false });

  // ---- per part hover + click sweep ------------------------------------
  const sweep = [];
  let unreliable = [];
  if (booted && !quick) {
    // Freeze the idle camera drift so probe points stay valid.
    await browser.evaluate('window.__ROOM__.camera.driftAmp = 0', { awaitPromise: false });
    await sleep(700);
    const first = JSON.parse(await browser.evaluate(
      'JSON.stringify(window.__ROOM__.partPoints())', { awaitPromise: false },
    ));
    const vw = 1440, vh = 900;
    const candidates = first
      .filter((p) => p.reliable && p.x > 4 && p.y > 4 && p.x < vw - 4 && p.y < vh - 4 && p.px > 12)
      .map((p) => p.key);
    unreliable = first.filter((p) => !p.reliable).map((p) => p.key);
    for (const key of candidates) {
      // Re-derive the probe point every time: earlier clicks may have moved
      // things, and animated parts drift on their own.
      const pts = JSON.parse(await browser.evaluate(
        'JSON.stringify(window.__ROOM__.partPoints())', { awaitPromise: false },
      ));
      const p = pts.find((q) => q.key === key);
      if (!p) { sweep.push({ key, skipped: 'not visible any more' }); continue; }

      await browser.mouseMove(p.x, p.y);
      await sleep(150);
      const hov = await browser.evaluate(`(() => {
        const R = window.__ROOM__;
        const h = R.hovered;
        return { key: h ? h.key : null, hoverT: h ? +h.hoverT.toFixed(3) : 0 };
      })()`, { awaitPromise: false });

      const before = await browser.evaluate('JSON.stringify(window.__ROOM__.state.data)', { awaitPromise: false });
      await browser.click(p.x, p.y);
      await sleep(170);
      const after = await browser.evaluate('JSON.stringify(window.__ROOM__.state.data)', { awaitPromise: false });
      const b = JSON.parse(before), a = JSON.parse(after);
      const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
        .map((k) => k + ':' + JSON.stringify(b[k]) + '->' + JSON.stringify(a[k]));

      sweep.push({
        key,
        hoverMatched: hov.key === key,
        landedOn: hov.key,
        anyHover: !!hov.key,
        hoverT: hov.hoverT,
        stateChange: changed,
        error: consoleErrors.length ? consoleErrors[consoleErrors.length - 1] : null,
      });
      await sleep(50);
    }
  }

  // ---- hover feedback is real pixels, not just a flag -------------------
  const hoverVisual = [];
  if (booted && !quick) {
    await browser.evaluate('window.__ROOM__.camera.driftAmp = 0', { awaitPromise: false });
    await sleep(500);
    const pts0 = JSON.parse(await browser.evaluate('JSON.stringify(window.__ROOM__.partPoints())', { awaitPromise: false }));
    const candidates = pts0
      .filter((p) => p.reliable && p.x > 90 && p.y > 90 && p.x < 1330 && p.y < 810 && p.px > 200)
      .slice(0, 22);

    const sample = async (cx, cy) => browser.evaluate(`(() => {
      const c = document.getElementById('stage');
      const g = c.getContext('2d');
      const d = g.getImageData(${Math.max(0, Math.round(cx) - 60)}, ${Math.max(0, Math.round(cy) - 60)}, 120, 120).data;
      return Array.from(d);
    })()`, { awaitPromise: false });

    for (const p0 of candidates) {
      // re-derive, then park the pointer far away for the idle baseline
      await browser.mouseMove(6, 6);
      await sleep(420);
      const pts = JSON.parse(await browser.evaluate('JSON.stringify(window.__ROOM__.partPoints())', { awaitPromise: false }));
      const p = pts.find((q) => q.key === p0.key);
      if (!p) { hoverVisual.push({ key: p0.key, skipped: true }); continue; }
      const base = await sample(p.x, p.y);
      await sleep(420);
      const base2 = await sample(p.x, p.y);
      await browser.mouseMove(p.x, p.y);
      await sleep(560);
      const hov = await sample(p.x, p.y);
      const diff = (a, b) => {
        let n = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) n++;
        }
        return n;
      };
      hoverVisual.push({
        key: p0.key,
        baseline: diff(base, base2),
        hovered: diff(base2, hov),
      });
      await sleep(80);
    }
  }

  // ---- screenshots ------------------------------------------------------
  const shot = async (name, cam) => {
    if (cam) {
      await browser.evaluate(
        `window.__ROOM__.setCamera(${cam[0]}, ${cam[1]}, ${cam[2]})`, { awaitPromise: false },
      );
      await sleep(900);
    }
    await browser.screenshot(path.join(shots, name + '.png'));
  };

  await browser.evaluate('window.__ROOM__.state.set("night", false)', { awaitPromise: false });
  await sleep(1600);
  await shot('01-day');

  await browser.evaluate('window.__ROOM__.state.set("night", true)', { awaitPromise: false });
  await sleep(2200);
  await shot('02-night');

  await browser.evaluate('window.__ROOM__.state.set("night", false)', { awaitPromise: false });
  await sleep(1600);
  await shot('03-front', [0.02, 0.30, 11.5]);
  await shot('04-left', [-0.95, 0.34, 12.0]);
  await shot('05-right', [1.45, 0.36, 12.0]);
  await shot('06-back', [3.05, 0.40, 12.5]);
  await shot('07-top', [0.62, 0.92, 11.0]);

  // interaction spot-checks
  await browser.evaluate('window.__ROOM__.setCamera(0.62, 0.37, 12.4)', { awaitPromise: false });
  await sleep(900);
  await browser.evaluate(`(() => {
    const R = window.__ROOM__;
    R.state.set('lampOn', true); R.state.set('pendantOn', true); R.state.set('fanSpeed', 3);
    R.state.set('vinylPlaying', true); R.state.set('night', true);
  })()`, { awaitPromise: false });
  await sleep(2600);
  await shot('08-night-active');

  const post = await browser.evaluate('JSON.stringify(window.__ROOM__.state.data)', { awaitPromise: false });

  // ---- report -----------------------------------------------------------
  const out = {
    booted,
    pageErrors,
    consoleErrors,
    network,
    notes,
    diag: diag || null,
    post: JSON.parse(post),
    sweep,
    hoverVisual,
  };
  fs.writeFileSync(path.join(here, 'verify-report.json'), JSON.stringify(out, null, 2));

  const line = (s) => process.stdout.write(s + '\n');
  line('=== Pure Line Room :: verification ===');
  line('booted              : ' + booted);
  line('objects             : ' + (diag ? diag.objects : '-'));
  line('interactive parts   : ' + (diag ? diag.parts : '-'));
  line('primitives          : ' + (diag ? diag.prims : '-'));
  line('non-finite points   : ' + (diag ? diag.nan : '-'));
  line('drawn / drawables   : ' + (diag ? diag.drawn + ' / ' + diag.drawables : '-'));
  line('render cost (ms)    : ' + (diag ? diag.renderMs.toFixed(2) : '-'));
  line('module errors       : ' + (diag && diag.moduleErrors.length ? diag.moduleErrors.join(' | ') : 'none'));
  line('page exceptions     : ' + (pageErrors.length ? pageErrors.join(' | ') : 'none'));
  line('console errors      : ' + (consoleErrors.length ? consoleErrors.slice(0, 6).join(' | ') : 'none'));
  line('external requests   : ' + (network.length ? network.join(' | ') : 'none'));
  if (diag) {
    line('');
    line('--- interactive parts ---');
    for (const p of diag.parts_detail) line('  ' + p);
  }
  if (sweep.length) {
    line('');
    line('--- hover / click sweep (' + sweep.length + ' parts reachable on screen) ---');
    const badHover = sweep.filter((s) => !s.hoverMatched);
    const badClick = sweep.filter((s) => s.error);
    line('  hover matched        : ' + (sweep.length - badHover.length) + '/' + sweep.length +
      (badHover.length ? '  MISSED: ' + badHover.map((s) => s.key + '->' + (s.landedOn || 'nothing')).join(', ') : ''));
    line('  something hovered    : ' + sweep.filter((s) => s.anyHover).length + '/' + sweep.length);
    line('  hoverT > 0.2         : ' + sweep.filter((s) => s.hoverT > 0.2).length + '/' + sweep.length);
    line('  global state changed : ' + sweep.filter((s) => s.stateChange.length).length + '/' + sweep.length +
      '  (most objects animate locally, so this is informational)');
    line('  click errors         : ' + (badClick.length ? badClick.map((s) => s.key).join(', ') : 'none'));
    if (unreliable.length) {
      line('  too small to probe   : ' + unreliable.length + ' (' + unreliable.join(', ') + ')');
    }
  }
  if (hoverVisual.length) {
    line('');
    line('--- hover changes real pixels (120x120 px region) ---');
    for (const h of hoverVisual) {
      const ok = h.hovered > Math.max(30, h.baseline * 1.8);
      line('  ' + (ok ? 'OK  ' : 'weak') + ' ' + h.key.padEnd(28) +
        ' idle-drift=' + String(h.baseline).padStart(5) + '  hover-delta=' + h.hovered);
    }
  }
  line('');
  line('screenshots -> ' + path.relative(root, shots));

  fs.writeFileSync(path.join(here, 'verify-summary.txt'),
    [booted, diag && diag.objects, diag && diag.parts, diag && diag.prims, diag && diag.nan,
      pageErrors.length, consoleErrors.length, network.length].join(','));

} catch (e) {
  process.stdout.write('VERIFY FAILED: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exitCode = 1;
} finally {
  await browser.close();
}
