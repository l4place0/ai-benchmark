// probe.mjs — transform-aware geometry audit.
//   node _dev/probe.mjs [objectId ...]
//
// Reports, per object, the TRUE world bounding box (object matrix x node
// matrices x the geometry's own builder matrix — exactly what renderer._walk
// composes) plus screen bounds. With object ids on the command line it also
// prints per-node boxes and the largest primitives.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const want = process.argv.slice(2);

const browser = await Browser.launch({ width: 1440, height: 900 });
try {
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  await browser.send('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (await browser.evaluate('!!window.__ROOM__', { awaitPromise: false }).catch(() => false)) break;
  }
  await browser.evaluate('window.__ROOM__.skipIntro()', { awaitPromise: false });
  await sleep(1400);

  const out = await browser.evaluate(`(() => {
    const R = window.__ROOM__;
    const WANT = ${JSON.stringify(want)};
    const I = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    const rows = [];
    for (const o of R.scene.objects) {
      const nodes = [];
      let n = 0;
      const bb = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
      const sb = [Infinity,Infinity,-Infinity,-Infinity];
      const big = [];
      const rec = (m, node, path) => {
        let nbb = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
        for (let gi = 0; gi < node.geo.length; gi++) {
          const g = node.geo[gi];
          const gm = R.mul(m, g.mat);
          let gbb = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
          for (const p of g.pts) {
            const w = [gm[0]*p[0]+gm[4]*p[1]+gm[8]*p[2]+gm[12],
                       gm[1]*p[0]+gm[5]*p[1]+gm[9]*p[2]+gm[13],
                       gm[2]*p[0]+gm[6]*p[1]+gm[10]*p[2]+gm[14]];
            for (let k = 0; k < 3; k++) {
              if (w[k] < gbb[k]) gbb[k] = w[k];
              if (w[k] > gbb[k+3]) gbb[k+3] = w[k];
            }
            const s = R.renderer.project(R.camera, w);
            if (!s.behind) {
              if (s.x < sb[0]) sb[0] = s.x; if (s.y < sb[1]) sb[1] = s.y;
              if (s.x > sb[2]) sb[2] = s.x; if (s.y > sb[3]) sb[3] = s.y;
            }
          }
          n++;
          for (let k = 0; k < 3; k++) {
            if (gbb[k] < bb[k]) bb[k] = gbb[k];
            if (gbb[k+3] > bb[k+3]) bb[k+3] = gbb[k+3];
            if (gbb[k] < nbb[k]) nbb[k] = gbb[k];
            if (gbb[k+3] > nbb[k+3]) nbb[k+3] = gbb[k+3];
          }
          const diag = Math.hypot(gbb[3]-gbb[0], gbb[4]-gbb[1], gbb[5]-gbb[2]);
          big.push({ path, gi, kind: g.kind, pts: g.pts.length, diag: +diag.toFixed(2),
            bb: gbb.map(v => +v.toFixed(2)), fill: g.style.fill, stroke: g.style.stroke });
        }
        if (node.geo.length) nodes.push({ path, count: node.geo.length,
          bb: nbb.map(v => +v.toFixed(3)), pos: node.pos.map(v => +v.toFixed(3)) });
        for (const c of node.children) rec(R.mul(m, c.matrix), c, path + '/' + (c.id || c.name));
      };
      rec(R.mul(I, R.trs(o.pos, o.rot, o.scale)), o.root, o.id);
      big.sort((a,b) => b.diag - a.diag);
      rows.push({
        id: o.id, prims: n,
        world: bb.map(v => +v.toFixed(3)),
        screen: sb.map(v => +v.toFixed(0)),
        pos: o.pos.map(v => +v.toFixed(3)),
        size: [+(bb[3]-bb[0]).toFixed(2), +(bb[4]-bb[1]).toFixed(2), +(bb[5]-bb[2]).toFixed(2)],
        nodes: WANT.indexOf(o.id) >= 0 ? nodes : null,
        big: WANT.indexOf(o.id) >= 0 ? big.slice(0, 6) : null,
      });
    }
    return JSON.stringify(rows);
  })()`, { awaitPromise: false });

  const rows = JSON.parse(out);
  process.stdout.write('id'.padEnd(15) + 'prims'.padStart(6) + '  ' +
    'world [x,y,z]min -> max'.padEnd(44) + 'size(w,h,d)'.padEnd(18) + 'screen\n');
  for (const r of rows) {
    const w = r.world;
    process.stdout.write(
      r.id.padEnd(15) + String(r.prims).padStart(6) + '  ' +
      `[${w[0]},${w[1]},${w[2]}] -> [${w[3]},${w[4]},${w[5]}]`.padEnd(44) +
      `${r.size.join(' x ')}`.padEnd(18) +
      `[${r.screen[0]},${r.screen[1]}]->[${r.screen[2]},${r.screen[3]}]\n`);
  }

  for (const r of rows) {
    if (!r.nodes) continue;
    process.stdout.write('\n--- ' + r.id + ' :: nodes ---\n');
    for (const nd of r.nodes) {
      process.stdout.write('  ' + nd.path.padEnd(30) + String(nd.count).padStart(4) + '  [' +
        nd.bb.join(',') + ']  nodePos=' + nd.pos.join(',') + '\n');
    }
    process.stdout.write('--- ' + r.id + ' :: biggest primitives ---\n');
    for (const b of r.big) {
      process.stdout.write('  ' + b.path.padEnd(30) + '#' + String(b.gi).padStart(4) +
        ' kind=' + b.kind + ' pts=' + String(b.pts).padStart(2) + ' diag=' + b.diag +
        ' [' + b.bb.join(',') + ']  fill=' + b.fill + ' stroke=' + b.stroke + '\n');
    }
  }
} finally {
  await browser.close();
}
