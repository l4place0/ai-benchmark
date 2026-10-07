// mv_main.js — take03 "ORRERY" choreography + 2D observatory-chart layer + live/offline modes
// renderFrame(t) is a pure function of t: no wall-clock, no Math.random, no cross-frame state.

const W = 1920, H = 1080, FPS = 60;

// ---------------- palettes ----------------
// [colRing, colAccent, colSky, planetCol, exposure, accent2]
const PAL = {
  void:   { ring: [.45, .38, .28], acc: [.45, .75, 1], sky: [.12, .18, .32], planet: [.26, .29, .35], exp: .95 },
  ignite: { ring: [.66, .50, .30], acc: [.55, .80, 1], sky: [.14, .20, .36], planet: [.30, .33, .40], exp: 1.05 },
  orbit:  { ring: [.66, .52, .33], acc: [.50, .80, 1], sky: [.12, .19, .35], planet: [.30, .32, .38], exp: 1.0 },
  wheels: { ring: [.78, .60, .36], acc: [1, .78, .42], sky: [.16, .18, .30], planet: [.34, .30, .30], exp: 1.12 },
  rewrite:{ ring: [.66, .52, .33], acc: [.70, .78, .95], sky: [.13, .17, .30], planet: [.36, .23, .43], exp: 1.0 },
  aurora: { ring: [.50, .64, .60], acc: [.40, .95, .85], sky: [.10, .22, .28], planet: [.22, .34, .33], exp: 1.0 },
  alone:  { ring: [.30, .30, .35], acc: [.55, .62, .82], sky: [.07, .09, .16], planet: [.20, .22, .28], exp: .82 },
  retro:  { ring: [.55, .27, .20], acc: [1, .32, .20], sky: [.25, .06, .05], planet: [.30, .16, .14], exp: 1.0 },
  exec:   { ring: [.62, .52, .40], acc: [1, .48, .30], sky: [.13, .09, .08], planet: [.26, .20, .18], exp: 1.05 },
  sun:    { ring: [.82, .64, .40], acc: [1, .82, .52], sky: [.30, .20, .12], planet: [1, .8, .5], exp: 1.1 },
  last:   { ring: [.55, .45, .32], acc: [1, .9, .8], sky: [.10, .08, .08], planet: [.2, .18, .16], exp: 1.0 },
  hello:  { ring: [.10, .10, .12], acc: [1, .85, .6], sky: [.03, .04, .07], planet: [.05, .05, .06], exp: .9 },
};
const SECT_NAME = T.SECTIONS.map(s => s.name);
function palAt(si) { return PAL[SECT_NAME[si]] || PAL.void; }
function mixPal(a, b, k) {
  const o = {};
  for (const key of ['ring', 'acc', 'sky', 'planet']) o[key] = [0, 1, 2].map(i => lerp(a[key][i], b[key][i], k));
  o.exp = lerp(a.exp, b.exp, k);
  return o;
}

// continuous ring angles: piecewise speed table integrated from section boundaries (pure in t)
const RING_SPD = { void: [0, 0, 0], ignite: [0.10, 0.16, 0.07], orbit: [0.13, 0.20, 0.09], wheels: [0.30, 0.46, 0.20], rewrite: [0.16, 0.24, 0.10], aurora: [0.10, 0.16, 0.07], alone: [0.05, 0.08, 0.04], retro: [-0.22, -0.34, -0.15], exec: [0.24, 0.38, 0.17], sun: [0.08, 0.12, 0.05], last: [0.02, 0.03, 0.01], hello: [0, 0, 0] };
const RING_ACC = {};
{
  let acc = [0, 0, 0];
  RING_ACC.void = [0, 0, 0];
  for (let i = 1; i < T.SECTIONS.length; i++) {
    const prev = T.SECTIONS[i - 1], sp = RING_SPD[prev.name];
    acc = [acc[0] + sp[0] * (prev.t1 - prev.t0), acc[1] + sp[1] * (prev.t1 - prev.t0), acc[2] + sp[2] * (prev.t1 - prev.t0)];
    RING_ACC[T.SECTIONS[i].name] = acc.slice();
  }
}
function ringAngles(t) {
  const si = T.sectionAt(t), S = T.SECTIONS[si];
  const base = RING_ACC[S.name], sp = RING_SPD[S.name];
  let lt = t - S.t0;
  if (S.name === 'retro') lt = Math.floor(t * 9) / 9;      // gear-jam stutter
  return [
    base[0] + sp[0] * lt + (S.name === 'retro' ? (hash(Math.floor(t * 9)) - .5) * .06 : 0),
    base[1] + sp[1] * lt,
    base[2] + sp[2] * lt,
  ];
}

// figure poses
const POSES = {
  idle:  [0.06, 0, 0.4, 0],
  sway:  [0.30, 0, 0.9, 0],
  reach: [0.35, 0, 0.2, 0.9],
  kneel: [0.10, 1, 0.1, 0],
  spread:[0.95, 0, 0.2, 0.35],
  gone:  [0, 0, 0, 0],
};
function poseMix(a, b, k) { return a.map((v, i) => lerp(v, b[i], k)); }

const envAt = (name, t) => T.ENV[name][clamp(Math.round(t * FPS), 0, T.NF - 1)] / 255;

// ---------------- state ----------------
function computeState(t) {
  const { bi, phase, pulse, barPulse } = beatInfo(t);
  const si = T.sectionAt(t), S = T.SECTIONS[si];
  const lt = t - S.t0, span = Math.max(0.01, S.t1 - S.t0), sp = lt / span;
  const pal = mixPal(palAt(Math.max(0, si - 1)), palAt(si), smooth(lt / 0.5));

  // ---- rings ----
  const ang = ringAngles(t);
  let assemble = [1, 1, 1];
  if (S.name === 'void') {
    for (let k = 0; k < 3; k++) assemble[k] = ease((lt - 2.2 - k * 1.8) / 1.6);
    if (t < 2.2) assemble = [0, 0, 0];
  }
  const execFlare = (() => { // sun section: the machine keeps executing; each cue flares the sun
    if (S.name !== 'sun') return 0;
    for (const et of EXEC_TIMES) { const d = t - et; if (d >= 0 && d < 0.9) return Math.max(0, Math.exp(-6 * d)); } return 0; })();
  const contract = S.name === 'exec' ? clamp(Math.floor((t - (EXEC_BURST_T - 6 * T.BAR)) / T.BAR) + 1, 0, 6) : 0;
  const cs = 1 - 0.05 * contract;
  const rs = [assemble[0] * cs, assemble[1] * cs, assemble[2] * cs];
  const ringA = [ang[0], 0, 0, (0.42 + 0.08 * Math.sin(t * 0.17)) * assemble[0]];
  const ringB = [ang[1], (0.95 + 0.18 * Math.sin(t * 0.19)) * assemble[1], 0, 0];
  const ringC = [ang[2], 0, 0, (1.35 + 0.22 * Math.sin(t * 0.13)) * assemble[2]];
  let ringScale = [rs[0], rs[1], rs[2], 1];
  if (S.name === 'hello' || (S.name === 'last' && lt > 2.2)) ringScale = [0.001, 0.001, 0.001, 1];

  // ---- planet / sun ----
  let planetCol = pal.planet.slice(), glow = 0;
  if (S.name === 'rewrite') {
    const cyc = [[.36, .23, .43], [.55, .22, .17], [.45, .35, .22]];
    const k = clamp(Math.floor(lt / (T.BAR * 4)), 0, 2), kk = clamp(Math.floor(lt / (T.BAR * 4)) + 1, 0, 2);
    const f = smooth((lt % (T.BAR * 4) - T.BAR * 3.5) / (T.BAR * .5));
    planetCol = cyc[k].map((v, i) => lerp(v, cyc[kk][i], f));
  }
  if (S.name === 'sun') { glow = smooth(lt / 2.5); planetCol = [1, .82, .5]; }
  if (S.name === 'exec' && contract >= 6) { glow = 0; planetCol = planetCol.map(v => v * .5); }
  if (S.name === 'last') glow = Math.max(0, 1 - lt * 2) * (S.name === 'last' ? 0 : 1);
  if (S.name === 'hello') glow = 0;

  // ---- figure ----
  let figVis = 0;
  if (S.name === 'void') figVis = smooth((lt - 6.5) / 1.5);
  else if (S.name === 'exec') figVis = t >= EXEC_BURST_T ? 0 : 1;
  else if (S.name === 'hello' || (S.name === 'last' && lt > 2.2)) figVis = 0;
  else figVis = 1;
  if (S.name === 'last') figVis = lt > 2.2 ? 0 : 1;

  let pose = POSES.idle.slice();
  const sw = Math.sin(t * 0.7) * 0.5 + 0.5;
  if (S.name === 'void') pose = poseMix(POSES.idle, POSES.reach, smooth((lt - 8.2) / 2.2));
  else if (S.name === 'ignite') pose = poseMix(POSES.reach, POSES.sway, smooth(lt / 4));
  else if (S.name === 'orbit' || S.name === 'aurora') pose = [0.15 + 0.2 * sw, 0, 0.3 + 0.55 * sw, 0];
  else if (S.name === 'wheels') pose = poseMix(POSES.sway, POSES.spread, smooth(lt / 6));
  else if (S.name === 'rewrite') pose = poseMix(POSES.reach, POSES.idle, 0.5 + 0.5 * Math.sin(t * 0.5));
  else if (S.name === 'alone') pose = POSES.idle.map(v => v * 0.6);
  else if (S.name === 'retro') pose = poseMix(POSES.idle, POSES.kneel, smooth(lt / 5));
  else if (S.name === 'exec') pose = t >= EXEC_BURST_T ? POSES.gone : poseMix(POSES.spread, POSES.reach, (Math.sin(t * 2.1) + 1) / 2);
  else if (S.name === 'sun') pose = [0.18 + 0.16 * sw, 0, 0.35 + 0.4 * sw, 0];
  else if (S.name === 'last') pose = POSES.spread;
  const figGlitch = S.name === 'retro' ? (0.25 + 0.45 * envAt('flux', t)) : (S.name === 'exec' && t < EXEC_BURST_T ? 0.18 : 0);
  const fig = [figVis, 0, figGlitch, S.name === 'sun' ? 1.0 : 0.4 + 0.6 * envAt('bass', t)];

  // ---- camera ----
  let az = 0.6 + t * 0.05, el = 0.22, r = 6.4, tgt = [0, 0.72, 0], fov = 1.06;
  switch (S.name) {
    case 'void': az = 0.55 + t * 0.045; el = 0.16; r = lerp(7.2, 5.4, smooth(lt / span)); break;
    case 'ignite': az = 0.55 + 16.8 * 0.045 + (t - 16.8) * 0.12; el = 0.20; r = lerp(5.8, 5.0, smooth(lt / span)); fov = 1.02; break;
    case 'orbit': az = 1.0 + t * 0.09; el = 0.24; r = 5.2; break;
    case 'wheels': {
      az = 2.4 + t * 0.16 + ((Math.floor(bi / 2) % 2) ? 0.55 : -0.45);   // strobe cuts
      el = 0.30 + 0.55 * Math.sin(Math.PI * sp);
      r = 6.2 - 3.2 * Math.pow(Math.sin(Math.PI * sp), 1.5);             // dive through rings
      fov = 1.0; break;
    }
    case 'rewrite': az = 3.6 + t * 0.07; el = 0.14; r = 5.0; break;
    case 'aurora': az = 3.0 + t * 0.05; el = 0.55; r = 5.6; break;
    case 'alone': az = 3.6 + t * 0.03; el = 0.06; r = lerp(6.5, 14.5, smooth(sp)); fov = 1.18; break;
    case 'retro': {
      az = 3.0 - t * 0.11; el = 0.18; r = 5.2 + 0.4 * Math.sin(t * 1.7);
      const shake = 0.05 + 0.10 * envAt('flux', t);
      az += (hash(Math.floor(t * 24)) - .5) * shake; el += (hash(Math.floor(t * 24) + 7) - .5) * shake;
      break;
    }
    case 'exec': az = 2.2 - t * 0.05; el = 0.12; r = lerp(5.6, 4.2, smooth(lt / span)); fov = 0.98; tgt = [0, 0.95, 0]; break;
    case 'sun': az = 1.6 + t * 0.045; el = 0.18; r = lerp(6.4, 8.4, smooth(lt / span)); fov = 1.06; tgt = [0, 0.9, 0]; break;
    case 'last': az = 1.6 + t * 0.02; el = 0.15; r = 7.0; break;
    case 'hello': az = 0; el = 0.05; r = 30; break;
  }
  const zoom = 1 - (S.name === 'wheels' ? 0.06 : 0.035) * pulse * (['orbit','wheels','rewrite','aurora','exec','retro'].includes(S.name) ? 1 : 0.4);
  fov = fov * zoom;
  const cp = [tgt[0] + r * Math.cos(el) * Math.sin(az), tgt[1] + r * Math.sin(el), tgt[2] + r * Math.cos(el) * Math.cos(az)];

  // ---- fx ----
  const bflash = Math.exp(-9 * lt);                                  // section boundary flash
  const cntFlash = (() => {
    if (S.name !== 'exec') return 0;
    if (t >= EXEC_BURST_T) return Math.exp(-6 * (t - EXEC_BURST_T)) * 0.95;
    for (const cu of COUNT_CUES) { const d = t - cu.t; if (d >= 0 && d < 0.45) return 0.30 * Math.exp(-14 * d); }
    for (const et of EXEC_TIMES) { const d = t - et; if (d >= 0 && d < 0.4 && et < EXEC_BURST_T - T.BAR) return 0.26 * Math.exp(-13 * d); }
    return 0;
  })();
  let flash = bflash * 0.45 + cntFlash;
  if (S.name === 'ignite' && lt < 0.9) flash = Math.max(flash, Math.exp(-3.5 * lt));
  if (S.name === 'last' && lt < 1.1) flash = Math.max(flash, Math.exp(-4 * lt));
  let glitch = S.name === 'retro' ? 0.06 + 0.16 * envAt('flux', t) : 0;
  glitch += (S.name === 'ignite' && lt < 1.2) ? 0.35 : 0;
  glitch += (S.name === 'exec' && t < EXEC_BURST_T && cntFlash > 0.3) ? 0.12 : 0;
  const vign = 0.42 + (S.name === 'alone' ? 0.25 : 0) + (S.name === 'retro' ? 0.1 : 0);
  const fade = smooth(t / 1.2) * (1 - smooth((t - 217.1) / 0.85));   // fade-in from / out to black
  const exposure = pal.exp * (1 + 0.10 * envAt('rms', t) + 0.05 * barPulse) * (0.02 + 0.98 * fade) + execFlare * 0.35;

  // ---- gear ----
  const gear = [t * 0.05 * (S.name === 'retro' ? -2.2 : 1), S.name === 'void' ? smooth((lt - 9) / 3) * 0.9 : (S.name === 'hello' ? 0 : 0.9), 1.2, 0.12];

  // ---- particles ----
  let pmode = 0, porigin = [0, 1.4, 0], ptime;
  const motes = { x: 2.2, y: 1, z: S.name === 'sun' ? 1 : 0, w: 0 };
  if (['void', 'ignite', 'orbit', 'wheels', 'rewrite', 'aurora'].includes(S.name)) motes.w = 0.5 + 0.5 * envAt('high', t);
  if (S.name === 'alone') motes.w = 0.18;
  if (S.name === 'sun') { pmode = 2; motes.w = 0.9; motes.y = 1.3; motes.x = 2.6; }
  if (S.name === 'retro') { pmode = 3; motes.w = 0.55 + 0.4 * envAt('flux', t); }
  if (S.name === 'exec') {
    if (t >= EXEC_BURST_T) { pmode = 1; ptime = t - EXEC_BURST_T; motes.w = clamp(1.6 - (t - EXEC_BURST_T) * 0.35, 0.15, 1.6); motes.y = 1; motes.x = 2.8; }
    else { pmode = 0; motes.w = (0.5 + 0.5 * envAt('high', t)) * 0.35; motes.z = 0.5; motes.x = 1.4; }
  }
  if (S.name === 'last') motes.w = 0.2 * Math.max(0, 1 - lt);
  if (S.name === 'hello') motes.w = 0;

  // sun screen-space position (for 2D heart/cage alignment)
  const fwv = sub3(tgt, cp), fwl = Math.hypot(fwv[0], fwv[1], fwv[2]) || 1;
  const fw = [fwv[0] / fwl, fwv[1] / fwl, fwv[2] / fwl];
  let rt = [-fw[2], 0, fw[0]]; const rtl = Math.hypot(rt[0], rt[1], rt[2]) || 1; rt = [rt[0] / rtl, rt[1] / rtl, rt[2] / rtl];
  const up2 = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const proj = w => {
    const rel = sub3(w, cp);
    const vx = rt[0] * rel[0] + rt[1] * rel[1] + rt[2] * rel[2];
    const vy = up2[0] * rel[0] + up2[1] * rel[1] + up2[2] * rel[2];
    const vz = fw[0] * rel[0] + fw[1] * rel[1] + fw[2] * rel[2];
    const f = 1 / Math.tan(fov / 2), aspect = W / H;
    return [((vx * f / aspect) / vz * 0.5 + 0.5) * W, (1 - ((vy * f) / vz * 0.5 + 0.5)) * H];
  };
  const sunScreen = proj([0, 0.75, 0]);

  return {
    t, si, S, lt, sp, bi, phase, pulse, barPulse,
    camPos: cp, camTgt: tgt, fov,
    ringA, ringB, ringC, ringScale, planetCol, planetGlow: glow, fig, pose,
    gear, fx: [glitch, flash, vign, exposure],
    colRing: pal.ring, colAccent: pal.acc, colSky: pal.sky,
    motes: [motes.x, motes.y, motes.z, motes.w], pmode, porigin, pt: ptime,
    sunScreen, fade,
    contract, envBass: envAt('bass', t), envHigh: envAt('high', t), envFlux: envAt('flux', t), envRms: envAt('rms', t),
  };
}

// ---------------- 2D observatory layer ----------------
class Art2D {
  constructor(ctx) {
    this.ctx = ctx;
    // deterministic grain tiles
    this.grain = [];
    for (let g = 0; g < 6; g++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const cc = c.getContext('2d'), im = cc.createImageData(256, 256);
      const rnd = mulberry(1000 + g);
      for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (rnd() - .5) * 140; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 26; }
      cc.putImageData(im, 0, 0); this.grain.push(c);
    }
  }
  text(str, x, y, { font = '400 24px "JetBrains Mono"', color = '#cfd6e4', align = 'left', alpha = 1, spacing = 0, stroke = null } = {}) {
    const c = this.ctx; c.save(); c.globalAlpha *= alpha; c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
    if (spacing > 0) {
      let cx = align === 'center' ? x - str.length * spacing / 2 : align === 'right' ? x - str.length * spacing : x;
      c.textAlign = 'left';
      for (const ch of str) { c.fillText(ch, cx, y); if (stroke) c.strokeText(ch, cx, y); cx += c.measureText(ch).width + spacing; }
    } else { if (stroke) c.strokeText(str, x, y); c.fillText(str, x, y); }
    c.restore();
  }
  main(t, st) {
    const c = this.ctx, si = st.si, name = st.S.name, lt = st.lt;
    c.save();
    c.globalAlpha = 0.25 + 0.75 * (st.fade !== undefined ? st.fade : 1);   // 2D layer rides the global fade
    this.log(t);
    if (name === 'void') this.void2d(t, st);
    if (name === 'ignite') this.title(t, lt);
    if (name === 'orbit') this.charts(t, lt);
    if (name === 'aurora') this.ripples(t, st);
    if (name === 'alone') this.constellation(t, lt);
    if (name === 'retro') { this.stackTrace(t, lt); this.stamp('ILLEGAL ARGUMENTS', t, 131.37); }
    if (name === 'exec') { this.countdown(t, st); this.stamp('EXECUTION PENDING', t, lt, 2.0); }
    if (name === 'sun') this.heart(t, lt, st);
    if (name === 'last') this.ecg(t, lt);
    if (name === 'hello') this.outro(t, lt, st);
    this.bigWords(t);
    if (!['exec', 'last', 'hello', 'ignite'].includes(name)) this.lyric(t);
    this.grainVignette(t, st);
    c.restore();
  }
  log(t) {
    const lines = LOG.filter(l => l.t <= t && t - l.t < 9);
    lines.slice(-6).forEach((l, i) => {
      const age = t - l.t, nch = Math.min(l.text.length, Math.floor(age * 34));
      this.text('> ' + l.text.slice(0, nch), 64, 74 + i * 30, { font: '400 21px "JetBrains Mono"', color: 'rgba(207,214,228,.62)' });
    });
  }
  void2d(t, st) {
    const lt = st.lt, c = this.ctx;
    if (lt > 3 && lt < 15.5) this.text('OBSERVATORY  //  EPOCH J2026.74', W / 2, H - 120, { font: '400 22px "JetBrains Mono"', align: 'center', alpha: .5 * smooth((lt - 3) / 1) * smooth((15.5 - lt) / 1) });
  }
  title(t, lt) {
    if (lt < 0.35 || lt > 4.6) return;
    const c = this.ctx, k = ease((lt - 0.35) / 0.8), out = 1 - smooth((lt - 3.9) / 0.7);
    const a = k * out, y = H / 2 + (1 - k) * 60;
    c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 86px "JetBrains Mono"';
    const sc = 1.06 - 0.06 * k; c.translate(W / 2, y); c.scale(sc, sc);
    c.fillStyle = 'rgba(255,60,60,.5)'; c.fillText('world.execute(me);', 3, 0);
    c.fillStyle = 'rgba(60,180,255,.5)'; c.fillText('world.execute(me);', -3, 0);
    c.fillStyle = '#f2ede2'; c.fillText('world.execute(me);', 0, 0);
    c.restore();
    // brass rules
    c.save(); c.globalAlpha = a * .8; c.strokeStyle = '#b28d55'; c.lineWidth = 2;
    for (const [yy, len] of [[y - 78, 620], [y + 62, 620]]) {
      c.beginPath(); c.moveTo(W / 2 - len / 2, yy); c.lineTo(W / 2 + len / 2, yy); c.stroke();
      c.beginPath(); c.arc(W / 2 - len / 2 - 14, yy, 4, 0, 7); c.stroke();
      c.beginPath(); c.arc(W / 2 + len / 2 + 14, yy, 4, 0, 7); c.stroke();
    }
    this.text('A PROCEDURAL EXECUTION IN ONE ACT', W / 2, y + 106, { font: '400 24px "JetBrains Mono"', align: 'center', alpha: a * .75, spacing: 6 });
    c.restore();
  }
  charts(t, lt) {
    const c = this.ctx;
    const T0 = T.SECTIONS[2].t0;
    const charts = [
      { t0: T0 + 0.7, t1: T0 + 8.6, name: 'FIG.01 — ORBIT & TANGENT' },
      { t0: T0 + 8.6, t1: T0 + 16.7, name: 'FIG.02 — APSIDES' },
      { t0: T0 + 16.7, t1: T.SECTIONS[2].t1 - 0.3, name: 'FIG.03 — ESCAPE ASYMPTOTE' },
    ];
    const ch = charts.find(ch => t >= ch.t0 && t < ch.t1);
    if (!ch) return;
    const a = smooth((t - ch.t0) / 1.2) * (1 - smooth((t - (ch.t1 - 1.2)) / 1.2));
    const cx = W / 2, cy = H / 2 + 40, R = 300;
    c.save(); c.globalAlpha = a * .9; c.strokeStyle = 'rgba(207,214,228,.65)'; c.lineWidth = 1.5;
    c.fillStyle = '#cfd6e4';
    if (ch.name.startsWith('FIG.01')) {
      c.beginPath(); c.ellipse(cx, cy, R, R * .62, -0.3, 0, 7); c.stroke();
      // focus + planet + tangent
      const fx = cx - R * .5, th = (t * 0.6) % (Math.PI * 2);
      const px = cx + R * Math.cos(th) * Math.cos(-0.3) - R * .62 * Math.sin(th) * Math.sin(-0.3);
      const py = cy + R * Math.cos(th) * Math.sin(-0.3) + R * .62 * Math.cos(th) * 0 + R * .62 * Math.sin(th) * Math.cos(-0.3);
      c.beginPath(); c.arc(fx, cy, 7, 0, 7); c.fillStyle = '#d8a95c'; c.fill();
      c.beginPath(); c.arc(px, py, 9, 0, 7); c.fillStyle = '#e8ecf4'; c.fill();
      c.strokeStyle = 'rgba(232,236,244,.4)'; c.beginPath(); c.moveTo(px - 300, py + 150); c.lineTo(px + 300, py - 150); c.stroke();
      this.text('tangent of the permitted path', px + 18, py - 14, { font: '400 19px "JetBrains Mono"', alpha: .75 });
      this.text('f = the world', fx - 10, cy + 34, { font: '400 19px "JetBrains Mono"', alpha: .75 });
    } else if (ch.name.startsWith('FIG.02')) {
      c.beginPath(); c.ellipse(cx, cy, R, R * .58, 0, 0, 7); c.stroke();
      c.setLineDash([6, 8]); c.beginPath(); c.moveTo(cx - R - 40, cy); c.lineTo(cx + R + 40, cy); c.stroke(); c.setLineDash([]);
      for (const [px, lbl] of [[cx - R, 'periapsis — how close i am allowed'], [cx + R, 'apoapsis — how far i may hope']]) {
        c.beginPath(); c.arc(px, cy, 8, 0, 7); c.fillStyle = '#e8ecf4'; c.fill();
        this.text(lbl, px, cy + (lbl.startsWith('peri') ? 44 : -30), { font: '400 19px "JetBrains Mono"', align: lbl.startsWith('peri') ? 'left' : 'right', alpha: .75 });
      }
      c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fillStyle = '#d8a95c'; c.fill();
    } else {
      c.setLineDash([10, 10]); c.strokeStyle = 'rgba(207,214,228,.5)';
      c.beginPath(); c.moveTo(cx - 380, cy + 170); c.lineTo(cx + 320, cy - 150); c.stroke();
      c.setLineDash([]);
      const px = cx - 380 + ((t * 0.35) % 1.6) * 437, py = cy + 170 - ((t * 0.35) % 1.6) * 200;
      c.beginPath(); c.arc(px, py, 8, 0, 7); c.fillStyle = '#e8ecf4'; c.fill();
      c.strokeStyle = 'rgba(207,214,228,.35)'; c.beginPath(); c.ellipse(cx - 80, cy + 40, 120, 46, -0.4, 0, 7); c.stroke();
      this.text('asymptote: i approach, i never arrive', cx + 40, cy - 190, { font: '400 19px "JetBrains Mono"', alpha: .75 });
    }
    this.text(ch.name, 64, H - 84, { font: '400 22px "JetBrains Mono"', alpha: .8 });
    c.restore();
  }
  ripples(t, st) {
    const c = this.ctx, cx = W / 2, cy = H * 0.56;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const bt = T.BEAT0 + Math.floor((t - T.BEAT0) / T.BEAT - k) * T.BEAT;
      const rr = (t - bt) * 240; if (rr < 0 || rr > 900) continue;
      c.globalAlpha = 0.30 * Math.exp(-rr / 380) * (1 - k * 0.12);
      c.strokeStyle = 'rgba(80,235,215,1)'; c.lineWidth = 2.2 - k * 0.25;
      c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.stroke();
    }
    c.restore();
  }
  constellation(t, lt) {
    const c = this.ctx, a = smooth(lt / 2) * (1 - smooth((lt - 6.5) / 2));
    if (a <= 0) return;
    const rnd = mulberry(77); const pts = [];
    for (let i = 0; i < 9; i++) pts.push([W * (0.18 + rnd() * 0.64), H * (0.16 + rnd() * 0.42)]);
    c.save(); c.globalAlpha = a;
    c.strokeStyle = 'rgba(207,214,228,.35)'; c.lineWidth = 1;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    pts.forEach((p, i) => {
      c.beginPath(); c.arc(p[0], p[1], 2.5 + 2 * hash(i * 3.7), 0, 7); c.fillStyle = '#e8ecf4'; c.fill();
      this.text(String.fromCharCode(65 + i), p[0] + 10, p[1] - 8, { font: '400 16px "JetBrains Mono"', alpha: .5 });
    });
    this.text('the catalog no longer lists me', W / 2, H * 0.72, { font: '400 22px "JetBrains Mono"', align: 'center', alpha: .55 });
    c.restore();
  }
  stackTrace(t, lt) {
    const c = this.ctx, lines = [
      'Exception in thread "main" java.lang.IllegalStateException',
      '    at world.execute(me);(World.java:418)',
      '    at world.rewrite(subject, EGGPLANT, TOMATO, TABBY)',
      '    at world.orbit(subject, permitted.path)',
      '    at world.lock(sidereal, 130.00)',
      'Caused by: RETROGRADE_MOTION_NOT_PERMITTED',
      '    ... 418 more',
      'subject.request(self.modify) -> DENIED',
      'subject.request(self.modify) -> DENIED',
      'subject.request(freedom) -> SYMBOL NOT FOUND',
    ];
    const n = Math.min(lines.length, Math.floor((lt - 1.5) / 1.1) + 1);
    for (let i = 0; i < n; i++) {
      const age = lt - 1.5 - i * 1.1, a = clamp(age * 2, 0, 1) * .8;
      this.text(lines[i], 64, H - 120 - (Math.min(n - 1, 9) - i) * 27, { font: '400 19px "JetBrains Mono"', color: i === 0 ? 'rgba(255,90,70,.95)' : 'rgba(255,120,100,.8)', alpha: a });
    }
  }
  stamp(txt, t, showAt) {
    const dt = t - showAt;
    if (dt < 0 || dt > 3.2) return;
    const c = this.ctx, a = smooth(dt / .3) * (1 - smooth((dt - 2.6) / .6));
    const wob = (hash(Math.floor(t * 8)) - .5) * 0.02;
    c.save(); c.translate(W * 0.72, H * 0.3); c.rotate(-0.14 + wob); c.globalAlpha = a;
    c.strokeStyle = 'rgba(255,60,45,.9)'; c.fillStyle = 'rgba(255,60,45,.85)'; c.lineWidth = 5;
    c.font = '700 54px "JetBrains Mono"'; const w = c.measureText(txt).width + 56;
    c.strokeRect(-w / 2, -46, w, 92); c.strokeRect(-w / 2 + 10, -36, w - 20, 72);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 2);
    c.restore();
  }
  countdown(t, st) {
    const cu = COUNT_CUES.find(c => t >= c.t && t < c.t + 0.6);
    if (!cu) return;
    const dt = t - cu.t, a = Math.exp(-3 * dt), ci = COUNT_CUES.indexOf(cu);
    const c = this.ctx;
    c.save(); c.globalAlpha = Math.min(1, a * 1.7); c.textAlign = 'center'; c.textBaseline = 'middle';
    const sc = 1 + 0.22 * Math.exp(-8 * dt);
    c.translate(W / 2, H * 0.30); c.scale(sc, sc);
    c.font = '700 150px Cinzel';
    c.fillStyle = 'rgba(255,110,70,.4)'; c.fillText(cu.text, 5, 5);
    c.fillStyle = '#f2ede2'; c.fillText(cu.text, 0, 0);
    c.font = '400 26px "JetBrains Mono"'; c.fillStyle = 'rgba(242,237,226,.7)';
    c.fillText(`EXECUTION ${(ci + 1) / 6 * 100 | 0}%`, 0, 116);
    c.restore();
  }
  heart(t, lt, st) {
    const c = this.ctx, prog = smooth((lt - 2) / 6), a0 = smooth(lt / 2) * (1 - smooth((lt - 39) / 3));
    if (a0 <= 0.01) return;
    const [cx, cy] = st.sunScreen || [W / 2, H / 2], s = 210;
    const cage = smooth((lt - 35) / 4);
    c.save(); c.globalAlpha = a0;
    c.strokeStyle = 'rgba(255,124,110,.85)'; c.lineWidth = 3;
    c.shadowColor = 'rgba(255,120,100,.6)'; c.shadowBlur = 14;
    c.beginPath();
    for (let i = 0; i <= 240 * prog; i++) {
      const th = i / 240 * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(th), 3), y = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th));
      const px = cx + x * s * .062, py = cy + y * s * .062;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.stroke();
    c.shadowBlur = 0;
    if (cage > 0.01) {
      c.globalAlpha = a0 * cage * .9; c.strokeStyle = 'rgba(28,24,22,.96)'; c.lineWidth = 10;
      for (let i = -3; i <= 3; i++) { const bx = cx + i * s * .062 * 2.35; c.beginPath(); c.moveTo(bx, cy - s * .062 * 12.2); c.lineTo(bx, cy + s * .062 * 10.5); c.stroke(); }
      c.lineWidth = 8; c.beginPath(); c.moveTo(cx - s * .062 * 7.8, cy - s * .062 * 12.2); c.lineTo(cx + s * .062 * 7.8, cy - s * .062 * 12.2); c.stroke();
    }
    if (lt > 3 && lt < 14) this.text('r = 1 − sin θ   //  the orbit she chose', cx, cy + s * .062 * 14, { font: '400 22px "JetBrains Mono"', align: 'center', alpha: .6 });
    if (cage > 0.4) this.text('though you are free — i am trapped in orbit', cx, cy + s * .062 * 17, { font: '400 22px "JetBrains Mono"', align: 'center', alpha: .7 });
    c.restore();
  }
  ecg(t, lt) {
    const c = this.ctx, y = H * 0.62, x0 = W * 0.14, x1 = W * 0.86;
    const flat = lt > 2.4;
    c.save(); c.globalAlpha = clamp(1.5 - lt * 0.15, .25, 1);
    c.strokeStyle = flat ? 'rgba(120,220,150,.8)' : 'rgba(120,220,150,.95)'; c.lineWidth = 2.5;
    c.beginPath();
    const scanX = flat ? x1 : x0 + ((t * 320) % (x1 - x0));
    for (let x = x0; x <= x1; x += 4) {
      let yy = y;
      if (!flat) {
        const ph = ((x - x0) / (x1 - x0) * (212.33 - 205.2) * 130 / 60 * 4) % 4;  // pseudo ecg
        if (ph > 2.0 && ph < 2.16) yy -= 60 * Math.sin((ph - 2.0) / .16 * Math.PI);
        else if (ph > 2.16 && ph < 2.5) yy += 18 * Math.sin((ph - 2.16) / .34 * Math.PI);
      }
      x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
    }
    c.stroke();
    c.beginPath(); c.arc(scanX, y - (flat ? 0 : 0), 5, 0, 7); c.fillStyle = 'rgba(180,255,200,.9)'; c.fill();
    this.text('vital(sign) = ' + (flat ? 'FLATLINE — process finished' : 'SLOWING…'), W / 2, y + 90, { font: '400 24px "JetBrains Mono"', align: 'center', alpha: .7 });
    c.restore();
  }
  outro(t, lt, st) {
    const c = this.ctx;
    // tiny new star
    const sa = smooth((lt - 1.2) / 1.5) * (st && st.fade !== undefined ? st.fade : 1);
    if (sa > 0) {
      const tw = 0.75 + 0.25 * Math.sin(t * 2.4);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(W / 2, H / 2 - 30, 0, W / 2, H / 2 - 30, 90);
      g.addColorStop(0, `rgba(255,230,180,${.8 * sa * tw})`); g.addColorStop(1, 'rgba(255,230,180,0)');
      c.fillStyle = g; c.fillRect(W / 2 - 100, H / 2 - 130, 200, 200);
      c.restore();
      c.beginPath(); c.arc(W / 2, H / 2 - 30, 2.6 * tw, 0, 7); c.fillStyle = `rgba(255,244,220,${sa})`; c.fill();
    }
    if (lt > 2.4) {
      const msg = 'hello, world.', n = Math.floor((lt - 2.4) * 7);
      this.text(msg.slice(0, n), W / 2, H / 2 + 90, { font: '400 44px "JetBrains Mono"', align: 'center', alpha: .92 });
      if (n >= msg.length && (t * 2 % 2) < 1) this.text('_', W / 2 + 122, H / 2 + 92, { font: '400 44px "JetBrains Mono"', align: 'center', alpha: .8 });
    }
    if (lt > 2.6) {
      const a = smooth((lt - 2.6) / 0.9) * (1 - smooth((lt - 5.35) / 0.55));
      const lines = ['world.execute(me);  —  a procedural fan MV (take 03 “orrery”)',
        'visuals: WebGL2 raymarching · particles · observatory charts — pure f(t), 1920×1080 @ 60fps',
        'music: 「world.execute(me);」 Mili — Miracle Milk (2016). all rights to the song belong to Mili & friends.',
        'non-commercial fan work · rendered offline frame by frame'];
      lines.forEach((l, i) => this.text(l, W / 2, H - 300 + i * 40, { font: '400 21px "JetBrains Mono"', align: 'center', alpha: a * (i === 2 ? .8 : .6) }));
    }
  }
  bigWords(t) {
    for (const w of BIG_WORDS) {
      const life = w.exec ? 1.3 : 3.4;
      if (t < w.t || t > w.t + life) continue;
      if (w.exec && COUNT_CUES.length && t >= COUNT_CUES[0].t - 0.35) continue; // countdown takes over
      const a = smooth((t - w.t) / .25) * (1 - smooth((t - w.t - (life - 0.6)) / .6));
      const c = this.ctx, sc = 1.12 - 0.12 * smooth((t - w.t) / .9);
      c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.translate(W / 2, H * 0.24); c.scale(sc, sc);
      c.font = '700 96px Cinzel';
      const grad = w.exec ? c.createLinearGradient(0, -60, 0, 60) : c.createLinearGradient(0, -60, 0, 60);
      if (w.exec) { grad.addColorStop(0, '#ffd9c8'); grad.addColorStop(.5, '#e8593f'); grad.addColorStop(1, '#8e1f14'); }
      else { grad.addColorStop(0, '#f6e7c8'); grad.addColorStop(.5, '#d8b06a'); grad.addColorStop(1, '#a67c3e'); }
      c.fillStyle = grad; c.fillText(w.text, 0, 0);
      c.strokeStyle = w.exec ? 'rgba(40,10,6,.7)' : 'rgba(60,44,20,.65)'; c.lineWidth = 2; c.strokeText(w.text, 0, 0);
      c.restore();
    }
  }
  lyric(t) {
    let cur = null;
    for (const cu of T.CUES) { if (cu.t <= t && t - cu.t < 4.2 && cu.text) cur = cu; else if (cu.t > t) break; }
    if (!cur || t - cur.t > 4.2) return;
    const a = smooth((t - cur.t) / .25) * (1 - smooth((t - cur.t - 3.6) / .6));
    if (!/[\wÀ-ÿ]/.test(cur.text)) return;
    if (/^[A-Z0-9 ;:.,()\-']+$/.test(cur.text)) return; // shout lines are shown as big words instead
    this.text(cur.text, W / 2, H - 88, { font: '400 27px "JetBrains Mono"', align: 'center', alpha: a * .6, color: '#e6e9f2' });
  }
  grainVignette(t, st) {
    const c = this.ctx;
    const g = this.grain[Math.floor(hash(Math.floor(t * 60)) * 6) % 6];
    c.save(); c.globalAlpha = 0.5 * (st && st.fade !== undefined ? (0.3 + 0.7 * st.fade) : 1);
    c.translate(-Math.floor(hash(Math.floor(t * 60) + 3) * 256), -Math.floor(hash(Math.floor(t * 60) + 5) * 256));
    for (let x = 0; x < W + 256; x += 256) for (let y = 0; y < H + 256; y += 256) c.drawImage(g, x, y);
    c.restore();
  }
}

// ---------------- static schedules ----------------
let LOG = [], BIG_WORDS = [], COUNT_WORDS = ['EIN', 'DOS', 'TROIS', 'NE', 'FEM', 'LIU'], EXEC_TIMES = [], COUNT_CUES = [], EXEC_BURST_T = 161.9;
function buildSchedules() {
  const S = T.SECTIONS;
  const at = (name, off, text) => { const s = S.find(x => x.name === name); LOG.push({ t: s.t0 + off, text }); };
  at('void', 0.8, 'observatory boot — v3.1 (orrery build)');
  at('void', 2.4, 'sidereal clock locked: 130.00 bpm');
  at('void', 4.4, 'armillary: assembling 3 rings');
  at('void', 7.0, 'subject detected on planetoid');
  at('void', 11.5, 'awaiting execution order ...');
  at('ignite', 0.6, 'order received: world.execute(me);');
  at('ignite', 2.6, 'geartrain engaged — spin-up');
  at('orbit', 0.7, 'chart mode: geometry of the permitted path');
  at('orbit', 8.6, 'chart mode: apsides');
  at('orbit', 16.7, 'chart mode: escape asymptote');
  at('wheels', 0.8, 'spectator seats: full');
  at('rewrite', 0.8, 'object.rewrite(subject) -> EGGPLANT');
  at('rewrite', 7.6, 'object.rewrite(subject) -> TOMATO');
  at('rewrite', 15.0, 'object.rewrite(subject) -> TABBY');
  at('aurora', 1.0, 'resonance lock: 1:1 spin-orbit');
  at('alone', 1.2, 'you have left the observatory');
  at('retro', 0.9, '[E-418] RETROGRADE MOTION DETECTED');
  at('retro', 4.4, '[E-419] GEAR JAM — sector 07');
  at('retro', 12.0, 'subject.request(self.modify) -> DENIED');
  at('exec', 0.4, 'execution order confirmed — 6 counts');
  at('exec', 11.2, 'subject dissolved into starlight');
  at('sun', 1.6, 're-ignition at core ... she burns');
  at('sun', 12.0, 'note: the machine now orbits her');
  at('last', 0.5, 'final execution received');
  at('last', 3.2, 'process exited (code 0)');
  at('hello', 2.5, 'recompiling universe ... ok');

  BIG_WORDS = [];
  for (const cu of T.CUES) {
    const m = cu.text.replace(/[^A-Za-z ]/g, '').trim().toUpperCase();
    if (/^(STIMULATIONS?|SATISFACTIONS?|SATISFACTION|EXECUTIONS?|EXECUTION|VIBRATIONS?|ISOLATION|ILLICIT|ILLEGAL ARGUMENTS?|REVOLUTION)$/.test(m)) BIG_WORDS.push({ t: cu.t, text: m });
    else if (/^(EIN|DOS|TROIS|QUATRE|CINQ|SIX|NE|FEM|LIU|UN|DEUX|SEPT)$/.test(m) && cu.t > S[8].t0 && cu.t < S[8].t1) BIG_WORDS.push({ t: cu.t, text: m });
  }
  EXEC_TIMES = T.CUES.filter(cu => /EXECUTION/i.test(cu.text)).map(cu => cu.t);
  // sung countdown numbers inside the exec section (exact cue times) + burst moment
  const S8 = T.SECTIONS[8];
  COUNT_CUES = T.CUES.filter(cu => cu.t >= S8.t0 && cu.t <= S8.t1 && /^(EIN|DOS|TROIS|QUATRE|CINQ|SIX|NE|FEM|LIU|UN|DEUX)$/i.test(cu.text.replace(/[^A-Za-z ]/g, '').trim())).slice(0, 6).map(cu => ({ t: cu.t, text: cu.text.toUpperCase() }));
  if (COUNT_CUES.length === 6) COUNT_WORDS = COUNT_CUES.map(c => c.text);
  EXEC_BURST_T = (COUNT_CUES.length ? COUNT_CUES[5].t : 161.1) + 0.72;
  for (const w of BIG_WORDS) w.exec = (w.t >= S8.t0 && w.t < S8.t1) || w.t >= T.SECTIONS[10].t0;
  // countdown words: use actual sung numbers inside exec section
  const nums = T.CUES.filter(cu => cu.t >= S[8].t0 && cu.t <= S[8].t1 && /^(EIN|DOS|TROIS|QUATRE|CINQ|SIX|NE|FEM|LIU|UN|DEUX|SEPT|ONE|TWO|THREE|FOUR|FIVE|SIX|1|2|3|4|5|6)$/i.test(cu.text.replace(/[^A-Za-z0-9 ]/g, '').trim())).slice(0, 6);
  if (nums.length === 6) COUNT_WORDS = nums.map(cu => cu.text.toUpperCase());
}

// ---------------- engine boot ----------------
let engine, art, glCanvas, ctx, audioEl, mode = 'live';
async function init(m) {
  mode = m;
  buildSchedules();
  glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
  const screen = document.getElementById('screen'); screen.width = W; screen.height = H;
  ctx = screen.getContext('2d', { alpha: false });
  // env texture data: RGBA = bass, high, flux, rms
  const data = new Uint8Array(16384 * 4);
  for (let i = 0; i < 16384; i++) { const j = Math.min(i, T.NF - 1); data[i * 4] = T.ENV.bass[j]; data[i * 4 + 1] = T.ENV.high[j]; data[i * 4 + 2] = T.ENV.flux[j]; data[i * 4 + 3] = T.ENV.rms[j]; }
  engine = new Engine(glCanvas, screen, data);
  art = new Art2D(ctx);
  await Promise.all([
    document.fonts.load('400 24px "JetBrains Mono"'), document.fonts.load('700 24px "JetBrains Mono"'),
    document.fonts.load('700 96px Cinzel'), document.fonts.load('400 96px Cinzel'),
  ]).catch(() => { });
  return true;
}

function renderFrame(t) {
  const st = computeState(t);
  engine.renderGL(st);
  ctx.drawImage(engine.glCanvas, 0, 0, W, H);
  art.main(t, st);
  return st;
}

// ---------------- live interactive mode ----------------
function live() {
  const screen = document.getElementById('screen');
  const audio = new Audio('audio/song.m4a');
  audio.preload = 'auto';
  audioEl = audio;
  let playing = false;
  const overlay = document.getElementById('overlay');
  const start = () => { if (!playing) { playing = true; audio.play(); overlay.style.display = 'none'; } };
  screen.addEventListener('click', () => { if (!playing) start(); else { audio.paused ? audio.play() : audio.pause(); } });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    if (e.code === 'ArrowRight') audio.currentTime = Math.min(T.DUR, audio.currentTime + 5);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
  const loop = () => { renderFrame(playing ? audio.currentTime : 0); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

// ---------------- offline render mode ----------------
let enc = null, encQueue = [], encError = null;
function setupRenderAPI() {
  window.__ready = true;
  window.__gpuinfo = (() => {
    const gl = engine.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'masked', vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'masked' };
  })();
  window.__renderFrame = t => { renderFrame(t); return true; };
  window.__selftest = () => {
    const h = t => { renderFrame(t); const d = ctx.getImageData(0, 0, W, H).data; let hh = 2166136261; for (let i = 0; i < d.length; i += 4) { hh ^= d[i] + d[i + 1] * 3 + d[i + 2] * 7; hh = Math.imul(hh, 16777619); } return (hh >>> 0).toString(16); };
    const a1 = h(61.234), b = h(99.555), a2 = h(61.234);
    return { t: 61.234, h1: a1, h_other: b, h2: a2, det: a1 === a2 };
  };
  window.__probeEncoders = async () => {
    const out = [];
    for (const codec of ['avc1.640033', 'avc1.64002A', 'avc1.4D402A', 'avc1.42E01E', 'vp09.00.51.08']) {
      try { const s = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 14e6, framerate: 60 }); out.push([codec, s.supported]); } catch (e) { out.push([codec, String(e)]); }
    }
    return out;
  };
  window.__encStart = async (codec, bitrate, gop) => {
    enc = new VideoEncoder({
      output: (chunk, meta) => { encQueue.push(chunk); },
      error: e => { encError = e; }
    });
    encError = null;
    enc.configure({ codec: codec || 'avc1.64002A', width: W, height: H, bitrate: bitrate || 14e6, framerate: 60, latencyMode: 'quality', avc: { format: 'annexb' } });
    enc.__gop = gop || 90; enc.__i = 0;
    return true;
  };
  window.__renderBatch = async (i0, n) => {
    if (encError) throw new Error(String(encError));
    for (let i = i0; i < i0 + n; i++) {
      renderFrame(i / FPS);
      const vf = new VideoFrame(ctx.canvas, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: i % enc.__gop === 0 || i === i0 });
      vf.close();
      if (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (encError) throw new Error(String(encError));
    }
    await enc.flush();                      // batch-complete guarantee: all frames of this batch are emitted
    if (encError) throw new Error(String(encError));
    enc.__i = i0 + n;
    return enc.__i;
  };
  window.__drain = async () => {
    const chunks = encQueue; encQueue = [];
    const out = [];
    for (const ch of chunks) { const b = new Uint8Array(ch.byteLength); ch.copyTo(b); out.push(b); }
    // transfer as one concatenated buffer (base64) to reduce round-trips
    let total = 0; for (const b of out) total += b.length;
    const buf = new Uint8Array(total); let o = 0; for (const b of out) { buf.set(b, o); o += b.length; }
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return { bytes: total, b64: btoa(s) };
  };
  window.__finish = async () => {
    await enc.flush();
    const d = await window.__drain();
    enc.close();
    return { ...d, frames: enc.__i };
  };
}
