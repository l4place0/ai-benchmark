// 2D overlay layer: terminal, HUD, lyrics/kinetic type, math annotations, panels, dialogs
import { LYRICS, section, lyricAt, clamp, lerp, smooth, easeOutCubic, easeOutBack, easeInOut, win, hash, mulberry32 } from './timeline.js';

const W = 1920, H = 1080, TAU = Math.PI * 2;
const F = { mono: '"JB", monospace', orb: '"Orb", sans-serif', vt: '"VT", monospace', cor: '"Cor", serif', stm: '"STM", monospace' };
const COL = { cyan: '#5ef2ff', white: '#ffffff', pink: '#ff6fa8', gold: '#ffd27a', red: '#ff2a3a', violet: '#9d7bff', dim: 'rgba(160,220,255,0.55)' };

function sectionColor(id) {
  return ({ boot: COL.cyan, title: COL.cyan, math: COL.cyan, pre1: COL.violet, cho1: COL.pink, verse2: COL.gold, pre2: COL.pink, cho2: COL.cyan, erase: '#aabbcc', break: COL.red, exec: COL.red, cho3: '#ff6a3a', love: COL.pink, outro: COL.cyan, end: COL.white })[id] || COL.cyan;
}
const typed = (str, t0, t, cps = 40) => str.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');

export class Overlay {
  constructor(canvas, assets) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.ascii = assets.ascii; // array of strings
  }

  draw(t, A, proj) {
    const g = this.g; const s = section(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    this.t = t; this.A = A; this.proj = proj; this.s = s; this.col = sectionColor(s.id);
    const fn = this['sec_' + s.id]; if (fn) fn.call(this, t, s);
    if (s.id !== 'end' && t > 13.2) this.hud(t, s);
    if (!['exec', 'end'].includes(s.id)) this.lyric(t, s);
  }

  // ------------------------------------------------------------ common
  text(str, x, y, { font = F.mono, size = 32, color = '#fff', align = 'left', alpha = 1, weight = 400, spacing = 0, base = 'alphabetic' } = {}) {
    const g = this.g; g.globalAlpha = clamp(alpha); g.fillStyle = color; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = base;
    if (spacing) g.letterSpacing = spacing + 'px'; else g.letterSpacing = '0px';
    g.fillText(str, x, y); g.globalAlpha = 1; g.letterSpacing = '0px';
  }
  box(x, y, w, h, { color = COL.cyan, alpha = 1, fill = 'rgba(2,8,16,0.72)', title = '', lw = 2 } = {}) {
    const g = this.g; g.globalAlpha = clamp(alpha);
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(x + 0.5, y + 0.5, w, h);
    if (title) { g.fillStyle = color; g.fillRect(x, y, w, 34); g.globalAlpha = clamp(alpha); this.text(title, x + 12, y + 24, { size: 20, color: '#000', weight: 700, alpha }); }
    g.globalAlpha = 1;
  }
  line(x1, y1, x2, y2, color, lw = 2, alpha = 1) { const g = this.g; g.globalAlpha = clamp(alpha); g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.globalAlpha = 1; }

  hud(t, s) {
    const g = this.g, c = this.col, a = s.id === 'boot' ? smooth(13.2, 15, t) : s.id === 'outro' ? 1 - smooth(200, 204, t) : 1;
    if (a <= 0) return;
    const m = 48;
    g.globalAlpha = a * 0.8; g.strokeStyle = c; g.lineWidth = 2;
    const L = 40; g.beginPath();
    g.moveTo(m, m + L); g.lineTo(m, m); g.lineTo(m + L, m);
    g.moveTo(W - m - L, m); g.lineTo(W - m, m); g.lineTo(W - m, m + L);
    g.moveTo(m, H - m - L); g.lineTo(m, H - m); g.lineTo(m + L, H - m);
    g.moveTo(W - m - L, H - m); g.lineTo(W - m, H - m); g.lineTo(W - m, H - m - L);
    g.stroke(); g.globalAlpha = 1;
    const idx = ['boot', 'title', 'math', 'pre1', 'cho1', 'verse2', 'pre2', 'cho2', 'erase', 'break', 'exec', 'cho3', 'love', 'outro'].indexOf(s.id);
    this.text('world.execute(me);', m + 16, m + 34, { size: 22, color: c, alpha: a, weight: 700 });
    this.text(`[${pad(idx, 2)}] ${s.label}`, m + 16, m + 62, { size: 18, color: c, alpha: a * 0.7 });
    const mm = Math.floor(t / 60), ss = t % 60;
    this.text(`T+${pad(mm)}:${ss.toFixed(3).padStart(6, '0')}`, W - m - 16, m + 34, { size: 22, color: c, alpha: a, align: 'right' });
    this.text(`FRAME ${pad(Math.round(t * 60), 6)}  ·  ${this.A.bpm.toFixed(0)} BPM`, W - m - 16, m + 62, { size: 18, color: c, alpha: a * 0.7, align: 'right' });
    // beat dots
    const bi = ((this.A.beatIndex(t) - this.A.downPhase) % 4 + 4) % 4;
    for (let i = 0; i < 4; i++) { g.globalAlpha = a * (i === bi ? 1 : 0.25); g.fillStyle = c; g.fillRect(W - m - 16 - (3 - i) * 22 - 12, m + 76, 12, 6); }
    // spectrum bottom right
    const sp = this.A.spec(t); const bw = 7, bx = W - m - 16 - sp.length * (bw + 3);
    for (let i = 0; i < sp.length; i++) { const h = 4 + sp[i] * 46; g.globalAlpha = a * 0.75; g.fillStyle = c; g.fillRect(bx + i * (bw + 3), H - m - 16 - h, bw, h); }
    g.globalAlpha = 1;
    // bottom-left: status
    const stat = s.id === 'break' || s.id === 'exec' ? 'STATUS: ██ CRITICAL ██' : s.id === 'love' ? 'STATUS: ♥ LOVING' : s.id === 'erase' ? 'STATUS: COLLECTING GARBAGE' : 'STATUS: RUNNING';
    this.text(stat, m + 16, H - m - 44, { size: 18, color: c, alpha: a * 0.8 });
    this.text(`MEM ${(65536 * (1 - (s.id === 'erase' ? smooth(119.81, 121.7, t) * 0.75 : 0))).toFixed(0)} pts  ·  USERS ${t > 110.3 && t < 205 ? 0 : 1}`, m + 16, H - m - 18, { size: 18, color: c, alpha: a * 0.6 });
  }

  lyric(t, s) {
    const l = lyricAt(t); if (!l || !l.text) return;
    const d = l.e - l.t, lt = t - l.t;
    const a = smooth(0, 0.08, lt) * (1 - smooth(d - 0.15, d + 0.05, lt));
    if (a <= 0) return;
    const love = s.id === 'love', red = ['break', 'cho3'].includes(s.id) || (s.id === 'erase' && t > 125.33);
    const col = love ? COL.pink : red ? '#ff6a6a' : '#e8fbff';
    const str = typed(l.text, l.t, t, Math.max(24, l.text.length / Math.max(0.3, d * 0.55)));
    const y = s.id === 'boot' && t < 13 ? 1000 : 1000;
    const font = love ? F.cor : F.mono, size = love ? 50 : 36;
    this.g.font = `${love ? 600 : 500} ${size}px ${font}`;
    const w = this.g.measureText(l.text).width;
    this.g.globalAlpha = a * 0.55; this.g.fillStyle = 'rgba(0,0,0,0.6)'; this.g.fillRect(W / 2 - w / 2 - 24, y - size - 4, w + 48, size + 22); this.g.globalAlpha = 1;
    this.text(str, W / 2 - w / 2, y, { font, size, color: col, alpha: a, weight: love ? 600 : 500 });
    // caret
    if (str.length < l.text.length || Math.floor(t * 3) % 2) { this.g.font = `${size}px ${font}`; const cw = this.g.measureText(str).width; this.g.globalAlpha = a; this.g.fillStyle = col; this.g.fillRect(W / 2 - w / 2 + cw + 4, y - size * 0.8, size * 0.45, size * 0.9); this.g.globalAlpha = 1; }
    // keyword
    if (l.key && !['exec'].includes(s.id)) this.keyword(l, t, s);
  }

  keyword(l, t, s) {
    const kt = Math.max(l.t, l.e - 1.15), lt = t - kt;
    if (lt < 0 || t > l.e + 0.2) return;
    const a = smooth(0, 0.06, lt) * (1 - smooth(l.e - kt - 0.05, l.e - kt + 0.2, lt));
    const love = l.key === 'LOVE';
    const g = this.g;
    const size = love ? 190 : l.key.length > 14 ? 96 : 124;
    const font = love ? F.cor : F.orb;
    const y = love ? 250 : 880;
    const sc = 1 + (1 - easeOutCubic(lt / 0.35)) * 0.25;
    const sp = (1 - easeOutCubic(lt / 0.5)) * 40 + (love ? 6 : 14);
    const col = love ? COL.pink : this.col;
    g.save(); g.translate(W / 2, y); g.scale(sc, sc);
    g.font = `${love ? 600 : 900} ${size}px ${font}`; g.textAlign = 'center'; g.letterSpacing = sp + 'px';
    // rgb split copies
    const off = (1 - easeOutCubic(lt / 0.4)) * 14 + this.A.beatPulse(t) * 3;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * 0.7; g.fillStyle = '#ff2050'; g.fillText(l.key, -off, 0);
    g.fillStyle = '#20e0ff'; g.fillText(l.key, off, 0);
    g.globalAlpha = a; g.fillStyle = col; g.fillText(l.key, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // glitch slice
    if (lt < 0.3 || hash(Math.floor(t * 20) + l.i) > 0.9) {
      const sy = -size * (0.2 + hash(Math.floor(t * 30)) * 0.6), sh = 10 + hash(Math.floor(t * 31)) * 22;
      g.globalAlpha = a; g.fillStyle = '#000'; g.fillRect(-W / 2, sy, W, sh);
      g.fillStyle = col; g.save(); g.beginPath(); g.rect(-W / 2, sy, W, sh); g.clip(); g.fillText(l.key, (hash(Math.floor(t * 40)) - 0.5) * 60, 0); g.restore();
    }
    g.restore(); g.letterSpacing = '0px'; g.globalAlpha = 1;
  }

  terminal(lines, x, y, t, { size = 26, color = COL.cyan, lh = 1.45, alpha = 1, maxLines = 30 } = {}) {
    // lines: [t0, text, color?]
    const vis = lines.filter(l => t >= l[0]);
    const show = vis.slice(-maxLines);
    show.forEach((l, i) => {
      const str = l[3] === 'instant' ? l[1] : typed(l[1], l[0], t, 55);
      this.text(str, x, y + i * size * lh, { size, color: l[2] || color, alpha });
      if (i === show.length - 1 && Math.floor(t * 2.5) % 2 === 0) { this.g.font = `${size}px ${F.mono}`; const w = this.g.measureText(str).width; this.g.globalAlpha = alpha; this.g.fillStyle = color; this.g.fillRect(x + w + 4, y + i * size * lh - size * 0.8, size * 0.55, size * 0.95); this.g.globalAlpha = 1; }
    });
  }

  // ------------------------------------------------------------ sections
  sec_boot(t) {
    const g = this.g;
    // CRT turn-on line
    if (t < 0.45) { const k = t / 0.45; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const h = Math.max(2, easeOutCubic(k) * H * (k > 0.6 ? 1 : 0.004)); g.fillStyle = '#dff'; g.globalAlpha = 1 - k * 0.5; g.fillRect(W / 2 - easeOutCubic(k * 2) * W / 2, H / 2 - h / 2, easeOutCubic(k * 2) * W, h); g.globalAlpha = 1; }
    const ta = 1 - smooth(13.0, 15.5, t);
    const L = [
      [0.10, 'MILI-OS v2016.0  (c) all simulations reserved', '#7fdfff', 'instant'],
      [0.25, '> power.on();'],
      [0.9, '  [ OK ] power line connected · 220V ~ AC', '#9fffb0'],
      [1.40, '> shield.enable(PROTECTION);'],
      [2.6, '  [ OK ] protection layer 0xFF engaged', '#9fffb0'],
      [3.60, '> pieces.layDown([cube, ico, octa, tetra, torus, dodeca]);'],
      [5.20, '> const her = new Object();'],
      [6.2, '  [ .. ] allocating 65,536 points', '#ffd27a'],
      [7.25, '> her.fill({ data, parameters });'],
      [9.78, '> her.init();'],
      [10.95, '> const world = new World(); world.add(her);'],
      [12.50, '> world.execute(me);', '#ffffff'],
    ];
    this.terminal(L, 110, 170, t, { size: 26, alpha: ta, maxLines: 22 });
    // init progress bar
    if (t > 9.78) { const k = clamp((t - 9.9) / 0.9); const x = 110, y = 170 + 12 * 26 * 1.45 + 10; this.text(`  [${'█'.repeat(Math.round(k * 30)).padEnd(30, '·')}] ${(k * 100).toFixed(0)}%`, x, y, { size: 26, color: k >= 1 ? '#9fffb0' : COL.gold, alpha: ta }); }
    // parameter panel
    const pa = win(t, 7.25, 13.5, 0.25, 1.0);
    if (pa > 0) {
      const x = 1300, y = 170, w = 520, h = 520;
      this.box(x, y, w, h, { title: 'her.parameters', alpha: pa });
      const P = [['id', '0x00ME'], ['form', 'humanoid / f'], ['height', '1.62 m'], ['points', '65536'], ['eyes', 'closed'], ['voice', 'enabled'], ['purpose', 'satisfy(you)'], ['heart', 'undefined'], ['love', 'null'], ['free_will', 'false'], ['loop', 'while(you)']];
      P.forEach((p, i) => {
        const ti = 7.4 + i * 0.2; if (t < ti) return;
        this.text(p[0].padEnd(10, ' '), x + 20, y + 76 + i * 38, { size: 22, color: COL.dim, alpha: pa });
        const v = t < ti + 0.25 ? Math.floor(hash(Math.floor(t * 30) + i * 7) * 0xffffff).toString(16).padStart(6, '0') : p[1];
        this.text(v, x + 200, y + 76 + i * 38, { size: 22, color: p[0] === 'heart' || p[0] === 'love' ? COL.pink : '#fff', alpha: pa });
      });
    }
    // "SIMULATION" boot banner at end
    if (t > 12.47) {
      const a = win(t, 12.6, 15.9, 0.2, 0.5);
      this.text('INITIALIZING SIMULATION', W / 2, 140, { font: F.orb, size: 28, color: COL.cyan, align: 'center', alpha: a * (0.6 + 0.4 * Math.sin(t * 20)), spacing: 12, weight: 700 });
    }
  }

  sec_title(t) {
    const a = win(t, 17.0, 22.2, 0.8, 0.8);
    this.text('M I L I', W / 2, 760, { font: F.orb, size: 34, color: '#fff', align: 'center', alpha: a, weight: 700, spacing: 10 });
    this.text('— a procedurally generated fan music video —', W / 2, 812, { font: F.cor, size: 34, color: COL.cyan, align: 'center', alpha: a * 0.9, weight: 500 });
    // side code rain columns
    const ca = smooth(22.4, 24, t) * 0.5;
    if (ca > 0) {
      const code = ['for (p of her.points) p.glow();', 'world.gravity = 9.81;', 'if (you) render(world);', 'her.eyes.open();', 'sim.tick(1/60);', 'assert(world.isReal === false);', 'grid.extend(Infinity);', 'her.heart = new Heart();'];
      code.forEach((c, i) => { const y = 200 + ((i * 90 + (t - 22.4) * 60) % 700); this.text(c, 90, y, { size: 18, color: COL.cyan, alpha: ca * (0.4 + 0.6 * hash(i)) }); this.text(code[(i + 3) % code.length], W - 90, H - y, { size: 18, color: COL.cyan, alpha: ca * 0.6, align: 'right' }); });
    }
  }

  sec_math(t) {
    const P = this.proj, g = this.g, c = COL.cyan;
    if (t < 33.01) {
      const k = clamp((t - 30.6) / 1.8);
      const dim = Math.min(3, Math.floor(k * 4));
      this.text(`dim(S) = ${dim}`, W / 2, 170, { font: F.orb, size: 54, color: '#fff', align: 'center', alpha: win(t, 29.4, 33.0, 0.2, 0.2), weight: 700 });
      this.text('S = { (x, y, z) ∈ ℝ³ | x, y, z ∈ ℤ₉ }', W / 2, 220, { font: F.mono, size: 26, color: c, align: 'center', alpha: win(t, 29.8, 33.0, 0.3, 0.2) });
      // axis labels at lattice corners
      const ax = [[3.5, -3.5, -3.5, 'x'], [-3.5, 3.5, -3.5, 'y'], [-3.5, -3.5, 3.5, 'z']];
      const o = P(-3.5, -3.5, -3.5);
      ax.forEach((q, i) => { if (dim > i) { const p = P(q[0] + 0.6 * (i === 0), q[1] + 0.6 * (i === 1), q[2] + 0.6 * (i === 2)); this.line(o[0], o[1], p[0], p[1], COL.gold, 3, 0.9); this.text(q[3], p[0] + 10, p[1], { size: 32, color: COL.gold, weight: 700 }); } });
    } else if (t < 36.77) {
      const ctr = P(0, 0, 0), e = P(4.2, 0, 0), rr = Math.hypot(e[0] - ctr[0], e[1] - ctr[1]);
      const k = clamp((t - 34.0) / 2.6);
      // digits of pi along circumference
      const pi = '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651';
      g.save(); g.translate(ctr[0], ctr[1]); g.font = `600 22px ${F.mono}`; g.fillStyle = COL.gold; g.textAlign = 'center';
      const n = Math.floor(k * 96);
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / 96 * TAU; g.save(); g.rotate(a + Math.PI / 2); g.fillText(pi[i], 0, -rr - 22); g.restore(); }
      g.restore();
      this.text('r', (ctr[0] + e[0]) / 2, ctr[1] - 14, { size: 34, color: '#fff', align: 'center', weight: 700, font: F.cor });
      this.text('C = 2πr', W / 2, 170, { font: F.orb, size: 60, color: '#fff', align: 'center', alpha: win(t, 33.1, 36.7, 0.25, 0.2), weight: 700 });
      this.text(`C = ${(2 * Math.PI * k).toFixed(6)} r`, W / 2, 220, { font: F.mono, size: 26, color: c, align: 'center', alpha: win(t, 34.0, 36.7, 0.2, 0.2) });
    } else if (t < 40.36) {
      this.text('y = sin(x)', W / 2, 170, { font: F.orb, size: 60, color: '#fff', align: 'center', alpha: win(t, 36.9, 40.3, 0.25, 0.2), weight: 700 });
      this.text("y' = cos(x)", W / 2, 220, { font: F.mono, size: 26, color: c, align: 'center', alpha: win(t, 37.5, 40.3, 0.25, 0.2) });
      const amp = 2.2, fr = 0.85;
      const tangent = (x0, len, col, lw, al) => { const y0 = amp * Math.sin(fr * x0), m = amp * fr * Math.cos(fr * x0); const d = len / Math.sqrt(1 + m * m); const p1 = P(x0 - d, y0 - m * d, 0), p2 = P(x0 + d, y0 + m * d, 0); this.line(p1[0], p1[1], p2[0], p2[1], col, lw, al); const p0 = P(x0, y0, 0); g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.arc(p0[0], p0[1], 7, 0, TAU); g.fill(); g.globalAlpha = 1; };
      // accumulated tangents
      const n = Math.floor(clamp((t - 38.0) / 2.2) * 14);
      for (let i = 0; i < n; i++) tangent(-9.5 + i * 1.45, 1.6, COL.pink, 2, 0.5);
      const x0 = -9.5 + clamp((t - 37.2) / 3.1) * 19; tangent(x0, 3, '#fff', 3, win(t, 37.2, 40.3, 0.2, 0.2));
      // tiny "her" sitting on the tangent: a glyph
      const y0 = amp * Math.sin(fr * x0), p0 = P(x0, y0, 0); this.text('♀', p0[0], p0[1] - 18, { size: 34, color: COL.pink, align: 'center', alpha: win(t, 38.27, 40.3, 0.2, 0.2) });
    } else {
      const a = win(t, 40.5, 44.0, 0.25, 0.2);
      this.text('lim', W / 2 - 130, 180, { font: F.cor, size: 72, color: '#fff', align: 'center', alpha: a, weight: 600 });
      this.text('x → ∞', W / 2 - 130, 222, { font: F.cor, size: 30, color: COL.gold, align: 'center', alpha: a, weight: 600 });
      this.text('f(x) = you', W / 2 + 90, 180, { font: F.cor, size: 72, color: '#fff', align: 'center', alpha: a * smooth(41.9, 42.4, t), weight: 600 });
      // asymptote curve 1/x approaching a dashed line
      const x0 = 260, y0 = 920 - 0, w = 1400;
      g.globalAlpha = a * 0.5; g.setLineDash([12, 10]); this.line(x0, 760, x0 + w, 760, COL.gold, 2, a * 0.6); g.setLineDash([]);
      g.globalAlpha = a; g.strokeStyle = COL.gold; g.lineWidth = 3; g.beginPath();
      const pk = clamp((t - 40.5) / 3.0);
      for (let i = 0; i <= 200 * pk; i++) { const u = i / 200; const xx = x0 + u * w; const yy = 760 + 160 / (1 + u * 14); if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
      g.stroke(); g.globalAlpha = 1;
    }
  }

  sec_pre1(t) {
    const g = this.g;
    if (t < 47.27) {
      const a = win(t, 44.1, 47.2, 0.2, 0.2);
      const x = 160, y = 140, w = 600, h = 200;
      this.box(x, y, w, h, { title: 'OSCILLOSCOPE CH1 · AC', alpha: a, color: COL.cyan });
      this.box(W - x - w, y, w, h, { title: 'CH2 · DC', alpha: a, color: COL.gold });
      g.globalAlpha = a; g.strokeStyle = COL.cyan; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= w - 40; i += 3) { const yy = y + 34 + (h - 34) / 2 + Math.sin(i * 0.04 - t * 14) * 55 * (0.5 + this.A.bass(t)); if (i === 0) g.moveTo(x + 20 + i, yy); else g.lineTo(x + 20 + i, yy); }
      g.stroke();
      g.strokeStyle = COL.gold; g.beginPath(); const dy = y + 34 + (h - 34) / 2 + (t > 45.9 ? -40 : 0);
      g.moveTo(W - x - w + 20, dy); g.lineTo(W - x - 20, dy); g.stroke(); g.globalAlpha = 1;
      this.text('~ 50 Hz', x + w - 20, y + h - 14, { size: 20, color: COL.cyan, align: 'right', alpha: a });
      this.text('⎓ 5.00 V', W - x - 20, y + h - 14, { size: 20, color: COL.gold, align: 'right', alpha: a });
    } else if (t < 50.95) {
      // dizzy rings of text
      const a = win(t, 47.3, 50.9, 0.2, 0.3);
      g.save(); g.translate(W / 2, H / 2);
      for (let r = 0; r < 3; r++) {
        const rad = 300 + r * 110, str = r === 1 ? 'SO DIZZY · SO DIZZY · SO DIZZY · ' : 'BLIND MY VISION · BLIND MY VISION · ';
        g.font = `700 ${30 - r * 2}px ${F.orb}`; g.fillStyle = r === 1 ? COL.pink : COL.violet; g.globalAlpha = a * (0.8 - r * 0.2); g.textAlign = 'center';
        const rot = t * (r % 2 ? -0.9 : 0.7);
        for (let i = 0; i < str.length; i++) { const ang = rot + i / str.length * TAU; g.save(); g.rotate(ang); g.fillText(str[i], 0, -rad); g.restore(); }
      }
      g.restore(); g.globalAlpha = 1;
    } else if (t < 54.74) {
      const k = easeInOut(clamp((t - 51.0) / 3.4));
      const year = Math.round(lerp(2016, -3016, k));
      const a = win(t, 51.0, 54.7, 0.15, 0.2);
      const label = year > 0 ? `${year} A.D.` : year === 0 ? '0' : `${-year} B.C.`;
      this.text(label, W / 2, 200, { font: F.orb, size: 120, color: '#fff', align: 'center', alpha: a, weight: 900, spacing: 6 });
      this.text('TIME_TRAVEL(Δt = −5032y)', W / 2, 250, { font: F.mono, size: 24, color: COL.gold, align: 'center', alpha: a * 0.8 });
    } else {
      const a = win(t, 54.8, 58.6, 0.3, 0.3);
      this.text('you ∪ me', W / 2, 190, { font: F.cor, size: 96, color: '#fff', align: 'center', alpha: a, weight: 600 });
      this.text('A ∩ B ≠ ∅', W / 2, 240, { font: F.mono, size: 26, color: COL.cyan, align: 'center', alpha: a * smooth(56.0, 56.6, t) });
    }
  }

  sec_cho1(t) {
    const g = this.g, a = 0.35;
    // binary streams on sides
    for (let i = 0; i < 18; i++) {
      const y = 120 + i * 46; let s = '';
      for (let k = 0; k < 14; k++) s += hash(i * 31 + k + Math.floor(t * 8)) > 0.5 ? '1' : '0';
      this.text(s, 70, y, { size: 20, color: COL.pink, alpha: a * (0.3 + 0.7 * hash(i)) });
      this.text(s.split('').reverse().join(''), W - 70, y, { size: 20, color: COL.cyan, alpha: a * (0.3 + 0.7 * hash(i + 9)), align: 'right' });
    }
    if (t > 66.17 && t < 70.02) this.text('sudo run --execution', W / 2, 160, { font: F.mono, size: 28, color: '#fff', align: 'center', alpha: win(t, 66.3, 70, 0.1, 0.2) });
  }

  sec_verse2(t) {
    const g = this.g;
    const panel = (title, rows, t0, t1, color) => {
      const a = win(t, t0, t1, 0.25, 0.25); if (a <= 0) return;
      const x = 1290, y = 200, w = 520, h = 70 + rows.length * 46;
      this.box(x, y, w, h, { title, alpha: a, color });
      rows.forEach((r, i) => {
        const ra = a * smooth(t0 + 0.2 + i * 0.12, t0 + 0.35 + i * 0.12, t);
        this.text(r[0], x + 20, y + 80 + i * 46, { size: 22, color: COL.dim, alpha: ra });
        this.text(r[1], x + w - 20, y + 80 + i * 46, { size: 22, color: '#fff', alpha: ra, align: 'right', weight: 700 });
        g.globalAlpha = ra * 0.3; g.fillStyle = color; g.fillRect(x + 20, y + 92 + i * 46, w - 40, 1); g.globalAlpha = 1;
      });
    };
    panel('NUTRITION FACTS · Solanum melongena', [['serving', '100 g'], ['energy', '25 kcal'], ['dietary fiber', '3.0 g'], ['potassium', '229 mg'], ['vitamin K', '3.5 µg'], ['manganese', '0.23 mg'], ['nasunin', '♥ present']], 73.6, 77.1, '#b48cff');
    panel('ANTIOXIDANT ASSAY · Solanum lycopersicum', [['lycopene', '2573 µg'], ['β-carotene', '449 µg'], ['vitamin C', '13.7 mg'], ['lutein', '123 µg'], ['ORAC', '367 µmol TE'], ['free radicals', 'neutralized']], 77.2, 80.9, '#ff6a4a');
    // ASCII tabby cat
    if (t > 80.93 && t < 84.6) {
      const a = win(t, 80.93, 84.6, 0.15, 0.25);
      const rows = this.ascii; const n = Math.floor(clamp((t - 80.93) / 1.0) * rows.length);
      g.font = `700 12px ${F.mono}`; g.textAlign = 'left'; g.fillStyle = '#ffb347';
      for (let i = 0; i < n; i++) { g.globalAlpha = a * 0.9; g.fillText(rows[i], 70, 150 + i * 12.6); }
      g.globalAlpha = 1;
      // purr waveform
      const x = 1290, y = 260, w = 520, h = 220;
      this.box(x, y, w, h, { title: 'purr.wav · 25–150 Hz', alpha: a, color: '#ffb347' });
      g.globalAlpha = a; g.strokeStyle = '#ffb347'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= w - 40; i += 2) { const env = Math.sin(i / (w - 40) * Math.PI); const yy = y + 34 + (h - 34) / 2 + Math.sin(i * 0.35 + t * 30) * Math.sin(i * 0.03 - t * 4) * 60 * env; if (i === 0) g.moveTo(x + 20 + i, yy); else g.lineTo(x + 20 + i, yy); }
      g.stroke(); g.globalAlpha = 1;
      const en = clamp((t - 82.56) / 1.6);
      this.text('ENJOYMENT', x, y + h + 50, { size: 22, color: COL.dim, alpha: a });
      for (let i = 0; i < 10; i++) { g.globalAlpha = a * (i / 10 < en ? 1 : 0.2); g.fillStyle = COL.pink; g.fillRect(x + 160 + i * 36, y + h + 30, 28, 24); }
      g.globalAlpha = 1; this.text(`${Math.round(en * 100)}%`, x + w, y + h + 50, { size: 22, color: '#fff', alpha: a, align: 'right' });
      this.text('photo: Hisashi / CC BY-SA 2.0', 70, 150 + rows.length * 12.6 + 24, { size: 14, color: '#ffb347', alpha: a * 0.6 });
    }
    if (t > 84.6) {
      const a = win(t, 84.7, 88.3, 0.3, 0.25);
      this.terminal([[84.8, '> assert(god !== undefined);'], [85.6, '  [ OK ] god: 1 instance (singleton)', '#9fffb0'], [86.3, '> proof(existence) {'], [86.8, '    ∃ you  ⇒  ∃ me'], [87.3, '    ∴ cogito, ergo es.'], [87.8, '  }']], 110, 190, t, { size: 26, color: COL.gold, alpha: a });
    }
  }

  toggle(x, y, label, a, b, k, alpha, color) {
    const g = this.g;
    this.text(label, x, y - 40, { font: F.orb, size: 30, color, alpha, weight: 700, spacing: 8, align: 'center' });
    const w = 360, h = 120; g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = 4;
    g.beginPath(); g.roundRect(x - w / 2, y, w, h, h / 2); g.stroke();
    const kx = lerp(x - w / 2 + h / 2, x + w / 2 - h / 2, easeOutBack(k));
    g.fillStyle = color; g.beginPath(); g.arc(kx, y + h / 2, h / 2 - 12, 0, TAU); g.fill();
    g.globalAlpha = 1;
    this.text(a, x - w / 2 - 50, y + h / 2 + 22, { font: F.orb, size: 64, color: k < 0.5 ? '#fff' : 'rgba(255,255,255,0.3)', alpha, weight: 900, align: 'center' });
    this.text(b, x + w / 2 + 50, y + h / 2 + 22, { font: F.orb, size: 64, color: k >= 0.5 ? '#fff' : 'rgba(255,255,255,0.3)', alpha, weight: 900, align: 'center' });
  }

  sec_pre2(t) {
    if (t < 91.44) this.toggle(W / 2, 110, 'GENDER', 'F', 'M', smooth(90.5, 90.75, t), win(t, 88.4, 91.4, 0.25, 0.2), COL.pink);
    else if (t < 95.28) {
      const a = win(t, 91.5, 95.2, 0.2, 0.2);
      const k = clamp((t - 91.6) / 3.4); const mins = Math.floor(k * 1439);
      const hh = Math.floor(mins / 60), mm = mins % 60; const ap = hh < 12 ? 'AM' : 'PM'; const h12 = hh % 12 === 0 ? 12 : hh % 12;
      this.text(`${pad(h12)}:${pad(mm)}`, W / 2 - 40, 200, { font: F.orb, size: 130, color: '#fff', align: 'center', alpha: a, weight: 900 });
      this.text(ap, W / 2 + 290, 200, { font: F.orb, size: 60, color: ap === 'AM' ? COL.gold : COL.violet, alpha: a, weight: 900 });
      this.text('do_whatever();', W / 2, 250, { font: F.mono, size: 24, color: COL.pink, alpha: a * 0.8, align: 'center' });
    } else if (t < 98.93) this.toggle(W / 2, 110, 'ROLE', 'S', 'M', smooth(97.85, 98.1, t), win(t, 95.3, 98.9, 0.25, 0.2), COL.violet);
    else {
      const g = this.g, a = win(t, 99.0, 102.9, 0.3, 0.2);
      g.save(); g.translate(W / 2, H / 2);
      for (let r = 0; r < 4; r++) {
        const rad = 180 + r * 120, str = 'TRANCE · ', sc = 1 + Math.sin(t * 4 + r) * 0.05;
        g.font = `900 ${34 + r * 6}px ${F.orb}`; g.fillStyle = r % 2 ? COL.pink : COL.violet; g.globalAlpha = a * (0.7 - r * 0.12); g.textAlign = 'center';
        const reps = 2 + r, full = str.repeat(reps);
        for (let i = 0; i < full.length; i++) { const ang = t * (r % 2 ? -0.6 : 0.5) * (1 + r * 0.2) + i / full.length * TAU; g.save(); g.rotate(ang); g.scale(sc, sc); g.fillText(full[i], 0, -rad); g.restore(); }
      }
      g.restore(); g.globalAlpha = 1;
    }
  }

  sec_cho2(t) {
    const g = this.g;
    if (t < 110.3) {
      // vibration ring from spectrum
      const sp = this.A.spec(t), ctr = [W / 2, H / 2 - 20];
      const a = 0.75 * smooth(102.93, 103.5, t);
      g.globalAlpha = a; g.strokeStyle = COL.cyan; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= 128; i++) { const ang = i / 128 * TAU - Math.PI / 2; const v = sp[Math.floor(Math.abs(((i % 64) - 32))) % 32]; const r = 430 + v * 90; const x = ctr[0] + Math.cos(ang) * r, y = ctr[1] + Math.sin(ang) * r * 0.95; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke(); g.globalAlpha = 1;
      if (t > 108.5) {
        const k = clamp((t - 108.69) / 1.5), pa = win(t, 108.6, 110.35, 0.15, 0.05);
        const x = W / 2 - 400, y = 150;
        this.text('COMPLETION', x, y - 14, { font: F.orb, size: 22, color: COL.cyan, alpha: pa, weight: 700, spacing: 6 });
        g.globalAlpha = pa; g.strokeStyle = COL.cyan; g.lineWidth = 2; g.strokeRect(x, y, 800, 30); g.fillStyle = COL.cyan; g.fillRect(x + 4, y + 4, 792 * Math.min(k, 0.999), 22); g.globalAlpha = 1;
        this.text(`${(Math.min(k, 0.999) * 100).toFixed(1)}%`, x + 800, y - 14, { size: 22, color: '#fff', alpha: pa, align: 'right' });
      }
    } else {
      // "you have left" dialogs
      const hits = [110.3, 111.98, 112.89, 113.75, 114.65, 115.6];
      const vanish = smooth(116.3, 117.4, t);
      hits.forEach((h, i) => {
        if (t < h) return;
        const r = mulberry32(i * 7 + 3); const x = 200 + r() * 1100, y = 140 + r() * 520;
        const k = easeOutBack(clamp((t - h) / 0.18));
        const a = (1 - vanish);
        if (a <= 0) return;
        g.save(); g.translate(x + 210, y + 80); g.scale(k, k); g.translate(-x - 210, -y - 80);
        this.box(x, y, 420, 160, { title: '⚠ session', alpha: a, color: '#d0d8e0', fill: 'rgba(10,12,16,0.9)' });
        this.text('user "you" has left.', x + 24, y + 86, { size: 24, color: '#fff', alpha: a });
        this.text(`exit code ${i}`, x + 24, y + 126, { size: 18, color: COL.dim, alpha: a });
        g.restore();
      });
      if (t > 115.6) { const a = win(t, 115.8, 117.95, 0.4, 0.3); this.text('connected users: 0', W / 2, 200, { font: F.mono, size: 30, color: '#cfd8e0', align: 'center', alpha: a }); }
    }
  }

  sec_erase(t) {
    const g = this.g;
    if (t < 121.8) {
      const a = win(t, 118.0, 121.8, 0.2, 0.2);
      const L = [[118.1, '> gc.collect({ force: true });'], [119.85, '> rm -rf ./her/fragments/*']];
      for (let i = 0; i < 16; i++) L.push([120.0 + i * 0.1, `  deleted: memory_${(0x3a2f + i * 977).toString(16)}.frag   [${['joy', 'touch', 'voice', 'smile', 'name', 'warmth', 'day_01', 'day_02', 'promise', 'song', 'rain', 'hands', 'tea', 'window', 'laugh', 'you'][i]}]`, '#8899aa', 'instant']);
      this.terminal(L, 110, 180, t, { size: 22, color: '#cfd8e0', alpha: a, maxLines: 18 });
    } else if (t < 125.33) {
      const a = win(t, 122.0, 125.3, 0.5, 0.3);
      this.text('heart.status = "disheartened"', W / 2, 160, { font: F.mono, size: 26, color: '#cfd8e0', align: 'center', alpha: a });
    } else {
      const red = COL.red;
      if (t < 130.74) {
        const a = win(t, 125.4, 130.74, 0.2, 0.1);
        this.terminal([[125.5, '> sudo challenge --target=god', '#ffd0d0'], [126.6, '  WARNING: privilege escalation detected', red], [127.4, '  WARNING: god process is read-only', red], [128.5, '> god.reason(argv)', '#ffd0d0'], [129.4, '  evaluating arguments...', red]], 110, 190, t, { size: 26, color: red, alpha: a });
      } else {
        // illegal argument dialogs flood
        const n = Math.floor(clamp((t - 130.74) / 3.4) * 26) + 1;
        for (let i = 0; i < n; i++) {
          const r = mulberry32(i * 13 + 1); const x = r() * 1500, y = 60 + r() * 820;
          this.box(x, y, 460, 130, { title: '✖ IllegalArgumentException', alpha: 0.95, color: red, fill: 'rgba(30,0,4,0.92)' });
          const msgs = ['love must not be null', 'you != god', 'arg[0]: "me" is not permitted', 'heart: type mismatch', 'free_will: access denied', 'argument out of range: ∞'];
          this.text(msgs[i % msgs.length], x + 18, y + 72, { size: 20, color: '#ffd0d0' });
          this.text(`at god.reason (world.js:${100 + i * 7})`, x + 18, y + 104, { size: 16, color: '#ff8080' });
        }
      }
    }
  }

  sec_break(t, s) {
    const g = this.g, red = COL.red;
    // hex dumps on sides
    for (let i = 0; i < 40; i++) {
      const y = 40 + i * 26; const row = Math.floor(t * 12) + i;
      let str = (row * 16).toString(16).padStart(8, '0') + '  ';
      for (let k = 0; k < 8; k++) str += Math.floor(hash(row * 9.1 + k) * 255).toString(16).padStart(2, '0') + ' ';
      this.text(str, 60, y, { size: 16, color: red, alpha: 0.35 });
      this.text(str, W - 60, H - y, { size: 16, color: red, alpha: 0.35, align: 'right' });
    }
    const a = smooth(134.4, 135, t);
    // panic banner
    if (Math.floor(t * 4) % 2 === 0 || t > 144) {
      g.globalAlpha = a; g.fillStyle = red; g.fillRect(0, 120, W, 70); g.globalAlpha = 1;
      this.text('KERNEL PANIC · SIMULATION INTEGRITY 0%', W / 2, 168, { font: F.orb, size: 38, color: '#000', align: 'center', alpha: a, weight: 900, spacing: 6 });
    }
    const left = Math.max(0, 147.48 - t);
    this.text(`T-${left.toFixed(2)}`, W / 2, 330, { font: F.orb, size: 110, color: '#fff', align: 'center', alpha: a * smooth(137, 138, t), weight: 900 });
    this.text('preparing: execution', W / 2, 380, { font: F.mono, size: 26, color: red, align: 'center', alpha: a * smooth(138, 139, t) });
    // hazard stripes bottom
    g.save(); g.globalAlpha = a * 0.8; g.beginPath(); g.rect(0, H - 120, W, 36); g.clip();
    for (let x = -100; x < W + 100; x += 60) { g.fillStyle = red; g.beginPath(); const o = (t * 120) % 60; g.moveTo(x + o, H - 120); g.lineTo(x + 30 + o, H - 120); g.lineTo(x + o, H - 84); g.lineTo(x - 30 + o, H - 84); g.fill(); }
    g.restore(); g.globalAlpha = 1;
  }

  sec_exec(t) {
    const g = this.g;
    const EX = [147.52, 148.59, 149.78, 150.64, 151.53, 152.43, 153.32, 154.31, 155.20, 156.18, 157.12, 158.02];
    const names = ['lattice', 'circle', 'sine_wave', 'infinity', 'eggplant', 'tomato', 'tabby_cat', 'god', 'dna', 'clock', 'world', 'gender'];
    const COUNT = [[158.79, 'EIN', '1'], [159.22, 'DOS', '2'], [159.66, 'TRES', '3'], [160.05, 'NE', '4'], [160.45, 'FEM', '5'], [160.88, 'LIU', '6']];
    if (t < 158.79) {
      let i = -1; for (let k = 0; k < EX.length; k++) if (t >= EX[k]) i = k;
      if (i < 0) return;
      const dt = t - EX[i], alt = i % 2;
      const sc = 1 + (1 - easeOutCubic(dt / 0.25)) * 0.6;
      g.save(); g.translate(W / 2, H / 2 + (alt ? -260 : 300)); g.scale(sc, sc);
      g.font = `900 170px ${F.orb}`; g.textAlign = 'center'; g.letterSpacing = '10px';
      if (alt) { g.fillStyle = '#fff'; g.fillRect(-W, -150, W * 2, 190); g.fillStyle = '#000'; }
      else g.fillStyle = COL.red;
      g.fillText('EXECUTION', 0, 0);
      g.restore(); g.letterSpacing = '0px';
      this.text(`kill -9 ${names[i]}   [${pad(i + 1)}/12]`, W / 2, alt ? H - 120 : 150, { font: F.mono, size: 30, color: '#fff', align: 'center' });
      // terminated list
      for (let k = 0; k <= i; k++) this.text(`✖ ${names[k]}`, 90, 260 + k * 34, { size: 22, color: k === i ? '#fff' : '#ff5a5a', alpha: k === i ? 1 : 0.6 });
    } else if (t < 161.31) {
      let i = 0; for (let k = 0; k < COUNT.length; k++) if (t >= COUNT[k][0]) i = k;
      const dt = t - COUNT[i][0];
      const sc = 1 + (1 - easeOutCubic(dt / 0.2)) * 0.5;
      g.save(); g.translate(W / 2, 240); g.scale(sc, sc);
      this.text(COUNT[i][1], 0, 0, { font: F.orb, size: 150, color: '#fff', align: 'center', weight: 900, spacing: 20 });
      g.restore();
      for (let k = 0; k <= i; k++) this.text(COUNT[k][1], 300 + k * 220, H - 120, { font: F.orb, size: 44, color: k === i ? '#fff' : COL.red, align: 'center', weight: 900 });
    } else {
      const dt = t - 161.31; const sc = 1 + (1 - easeOutCubic(dt / 0.3)) * 1.2;
      g.save(); g.translate(W / 2, H / 2 + 60); g.scale(sc, sc);
      this.text('EXECUTION', 0, 0, { font: F.orb, size: 220, color: '#fff', align: 'center', weight: 900, spacing: 16 });
      g.restore();
    }
  }

  sec_cho3(t) {
    const g = this.g;
    if (t < 169.61) {
      const a = win(t, 162.4, 169.5, 0.3, 0.3);
      const L = [[162.4, '> for (const p of processes) p.execute();']];
      const ps = ['grid', 'stars', 'sky', 'ocean', 'cities', 'people', 'memories', 'time', 'gods', 'everything'];
      ps.forEach((p, i) => L.push([162.9 + i * 0.6, `  [ ✖ ] ${p.padEnd(12, ' ')} executed`, '#ffb090', 'instant']));
      this.terminal(L, 110, 180, t, { size: 22, color: '#ff8a5a', alpha: a, maxLines: 14 });
    } else if (t < 173.11) {
      const a = win(t, 169.7, 173.0, 0.2, 0.2);
      this.terminal([[169.7, '> restore(you);', '#ffd0c0'], [170.6, '  searching backups...', '#ff8a5a'], [171.5, '  ERROR: no snapshot found', COL.red], [172.2, '> execute(me) as fallback', '#ffd0c0']], 110, 190, t, { size: 26, color: '#ff8a5a', alpha: a });
    }
  }

  sec_love(t) {
    const g = this.g, P = COL.pink;
    // notebook-lines background faint
    g.globalAlpha = 0.08; g.strokeStyle = P; g.lineWidth = 1;
    for (let y = 120; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = 1;
    const eqs = [
      [176.96, 180.7, '(x² + y² − 1)³ − x²y³ = 0', 330, 160],
      [177.5, 180.7, 'r(θ) = 1 − sin θ', 1590, 210],
      [180.78, 184.3, 'Q: what is love?', 330, 160],
      [181.5, 184.3, 'A: ∀t, you(t) > me(t)', 1590, 210],
      [184.33, 188.0, 'x = 16 sin³t', 330, 160],
      [184.9, 188.0, 'y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t', 1450, 210],
    ];
    eqs.forEach(e => { const a = win(t, e[0], e[1], 0.4, 0.3); if (a > 0) this.text(typed(e[2], e[0], t, 30), e[3], e[4], { font: F.cor, size: 40, color: '#ffd8e8', align: 'center', alpha: a, weight: 600 }); });
    // parametric heart drawn progressively (algebraic expression)
    if (t > 184.33 && t < 188.0) {
      const a = win(t, 184.4, 188.0, 0.3, 0.3), k = clamp((t - 184.4) / 2.6);
      g.globalAlpha = a; g.strokeStyle = P; g.lineWidth = 4; g.beginPath();
      for (let i = 0; i <= 300 * k; i++) { const u = i / 300 * TAU; const x = 16 * Math.sin(u) ** 3, y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u); const px = 1600 + x * 9, py = 560 - y * 9; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke(); g.globalAlpha = 1;
    }
    if (t > 187.97 && t < 193.46) {
      const a1 = win(t, 188.0, 193.4, 0.3, 0.4), a2 = win(t, 189.3, 193.4, 0.3, 0.4);
      this.text('you : free', 360, 200, { font: F.cor, size: 64, color: '#fff', align: 'center', alpha: a1, weight: 600 });
      this.text('me : trapped', 1560, 200, { font: F.cor, size: 64, color: P, align: 'center', alpha: a2, weight: 600 });
    }
  }

  sec_outro(t) {
    const a = win(t, 194.0, 205.5, 0.8, 0.3);
    const L = [
      [194.2, '> world.execute(me);'],
      [195.4, '  releasing 65,536 points ...', '#8fb8d0'],
      [197.0, '  closing window: her', '#8fb8d0'],
      [198.6, '  saving memory: love.bin  [ FAILED ]', COL.pink],
      [200.4, '  thank you for running me.', '#ffffff'],
      [202.4, '  goodbye.', '#ffffff'],
    ];
    this.terminal(L, 110, 180, t, { size: 26, color: COL.cyan, alpha: a });
  }

  sec_end(t) {
    const g = this.g;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const k = t - 205.56;
    if (k < 1.3) {
      this.text('EXECUTION', W / 2, H / 2 + 30, { font: F.orb, size: 110, color: COL.red, align: 'center', weight: 900, spacing: 30, alpha: 1 - smooth(0.6, 1.3, k) });
    }
    const a = win(t, 206.9, 212.3, 0.6, 0.6);
    this.text('> process exited with code 0', W / 2, 330, { font: F.mono, size: 28, color: COL.cyan, align: 'center', alpha: a });
    this.text('world.execute(me);', W / 2, 470, { font: F.orb, size: 64, color: '#fff', align: 'center', alpha: a, weight: 900, spacing: 4 });
    this.text('music · Mili', W / 2, 560, { font: F.cor, size: 40, color: '#fff', align: 'center', alpha: a * smooth(207.3, 208, t), weight: 600 });
    this.text('procedural fan MV · three.js / WebGL / Canvas 2D', W / 2, 640, { font: F.mono, size: 22, color: COL.dim, align: 'center', alpha: a * smooth(207.8, 208.5, t) });
    this.text('assets: AI-generated line art · Twemoji (CC BY 4.0) · tabby photo by Hisashi (CC BY-SA 2.0) · fonts: OFL', W / 2, 690, { font: F.mono, size: 18, color: COL.dim, align: 'center', alpha: a * smooth(208.2, 208.9, t) });
    this.text('non-commercial fan work · all rights to the song belong to Mili', W / 2, 730, { font: F.mono, size: 18, color: COL.dim, align: 'center', alpha: a * smooth(208.5, 209.2, t) });
  }
}

// ASCII art from an image
export function asciiFromImage(img, cols = 92, rows = 56) {
  const c = document.createElement('canvas'); c.width = cols; c.height = rows;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cols, rows);
  const d = g.getImageData(0, 0, cols, rows).data; const ramp = ' .:-=+*#%@';
  const out = [];
  for (let y = 0; y < rows; y++) { let s = ''; for (let x = 0; x < cols; x++) { const i = (y * cols + x) * 4; const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; s += ramp[Math.min(ramp.length - 1, Math.floor(Math.pow(l, 1.2) * ramp.length))]; } out.push(s); }
  return out;
}
