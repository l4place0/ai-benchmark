/* =============================================================================
   _dev/room.mjs — drive the real project headlessly and look at the result.

   node _dev/room.mjs --out=_dev/shot.png [--frames=240] [--w=1440] [--h=900]
                      [--do=click@x,y;move@x,y;drag@x0,y0>x1,y1;wheel@x,y:-240]
                      [--hour=9.5] [--lights] [--lamp]
                      [--before=snippet.js] [--probe=snippet.js]
   ========================================================================== */
import { createPage } from './harness.mjs';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const has = (...names) => names.some((n) => args.includes(`--${n}`) || args.some((a) => a.startsWith(`--${n}=`)));

const W = parseInt(opt('w', '1440'), 10);
const H = parseInt(opt('h', '900'), 10);
const frames = parseInt(opt('frames', '240'), 10);
const out = opt('out', '_dev/shot.png');

const page = createPage({ width: W, height: H, dpr: 1 });
page.loadScriptsFrom('index.html');
if (page.win.PLR && page.win.PLR.app) page.win.PLR.app.recorder = page.recorder;

function runSnippet(file, label) {
  try {
    let src = readFileSync(file, 'utf8');
    src = src.replace(/__ISOLATE__/g, JSON.stringify(opt('isolate', 'fan')));
    const fn = new Function('window', 'document', 'PLR', 'app', 'page', src);
    const value = fn(page.win, page.doc, page.win.PLR, page.win.PLR.app, page);
    console.log(label + ': ' + JSON.stringify(value, null, 1));
  } catch (e) {
    console.log(label + '-ERROR: ' + (e && e.stack));
  }
}

// --before runs BEFORE the frames advance: place the camera, set the view mode,
// freeze the clock, seed the environment.
if (opt('before', '')) runSnippet(opt('before', ''), 'BEFORE');

// environment overrides must land before the frames are rendered
if (has('hour')) {
  const h = parseFloat(opt('hour', '21.8'));
  const A = page.win.PLR.app;
  A.env.autoTime = false;
  A.setEnv({
    hour: Math.floor(h), minute: Math.round((h % 1) * 60),
    day: A.twilight(h)
  });
}
if (has('lights')) page.win.PLR.app.setEnv({ lightsOn: true });
if (has('lamp')) page.win.PLR.app.setEnv({ lampOn: true });

page.advance(1000 / 60 * frames);

// optional deterministic interaction script
const doSpec = opt('do', '');
for (const step of doSpec.split(';').filter(Boolean)) {
  const [kind, rest] = step.split('@');
  const nums = (rest || '').split(/[,>:]/).map(Number);
  if (kind === 'click') { page.click(nums[0], nums[1]); page.advance(1400); }
  else if (kind === 'move') { page.move(nums[0], nums[1]); page.advance(700); }
  else if (kind === 'drag') { page.drag(nums[0], nums[1], nums[2], nums[3]); page.advance(600); }
  else if (kind === 'wheel') { page.wheel(nums[0], nums[1], nums[2]); page.advance(900); }
  else if (kind === 'key') { page.fire(page.win, 'keydown', { key: (rest || '').trim() }); page.advance(500); }
}

page.advance(200);
if (opt('probe', '')) runSnippet(opt('probe', ''), 'PROBE');

const png = page.writePNG(out);
page.writeSVG(out.replace(/\.png$/, '.svg'));

const sum = page.summary();
const app = page.win.PLR && page.win.PLR.app;
console.log(JSON.stringify({
  out: png, ...sum,
  app: app ? app.stats() : null,
  meshFaceTotal: app ? app.scene.meshes.reduce((n, m) => n + m.faces.length, 0) : null,
  meshes: app ? app.scene.meshes.map((m, i) => i + ':' + (m.name || '?') + '(' + m.faces.length + ')') : [],
  interact: app ? app.interact.reg.map((o) => o.id) : [],
  env: app ? {
    day: +app.env.day.toFixed(3), hour: app.env.hour,
    lightsOn: app.env.lightsOn, lampOn: app.env.lampOn
  } : null
}, null, 1));

if (sum.errors.length || sum.warningCount) process.exitCode = 1;
