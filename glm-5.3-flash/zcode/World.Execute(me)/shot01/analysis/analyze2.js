// Audio analysis v2 — stdin: f32le mono 22050Hz. Writes analysis_<tag>.json + prints report.
const FS = 22050, HOP = 441, WIN = 2048, FPS = FS / HOP; // 50 fps
const tag = process.argv[2] || 'x';
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', run);
function run() {
  const buf = Buffer.concat(chunks), N = buf.length >> 2, x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = buf.readFloatLE(i * 4);
  const dur = N / FS, nF = Math.max(1, Math.floor((N - WIN) / HOP));
  const fft = makeFFT(WIN), hann = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1));
  const bins = WIN >> 1;
  const rms = new Float32Array(nF), flux = new Float32Array(nF), cent = new Float32Array(nF);
  let prev = new Float32Array(bins);
  const re = new Float32Array(WIN), im = new Float32Array(WIN);
  for (let f = 0; f < nF; f++) {
    const off = f * HOP; let e = 0;
    for (let i = 0; i < WIN; i++) { const v = x[off + i] * hann[i]; re[i] = v; im[i] = 0; e += v * v; }
    rms[f] = Math.sqrt(e / WIN);
    fft(re, im);
    let fl = 0, cw = 0, ce = 0;
    for (let k = 1; k < bins; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const d = m - prev[k]; if (d > 0) fl += d;
      ce += m * k; cw += m; prev[k] = m;
    }
    flux[f] = fl; cent[f] = cw ? ce / cw : 0;
  }
  // tempo via autocorrelation
  const fl2 = Float32Array.from(flux);
  let mean = 0; for (const v of fl2) mean += v; mean /= nF;
  for (let i = 0; i < nF; i++) fl2[i] -= mean;
  const cand = [];
  for (let bpm = 60; bpm <= 200.001; bpm += 0.5) {
    const lag = Math.round(FPS * 60 / bpm); let s = 0, c = 0;
    for (let i = lag; i < nF; i++) { s += fl2[i] * fl2[i - lag]; c++; }
    cand.push({ bpm, s: c ? s / c : 0 });
  }
  cand.sort((a, b) => b.s - a.s);
  let bpm = cand[0].bpm;
  for (let b = bpm - 0.5; b <= bpm + 0.5; b += 0.05) { // refine
    const P = FPS * 60 / b; let s = 0, c = 0;
    for (let i = 0; i + P < nF; i++) { const j = i + P, j0 = Math.floor(j), fr = j - j0; s += fl2[i] * (fl2[j0] * (1 - fr) + fl2[j0 + 1] * fr); c++; }
    if (c && s / c > (cand._r || 0)) { cand._r = s / c; bpm = b; }
  }
  // beat phase
  const P = FPS * 60 / bpm; let beat0 = 0, bs = -1;
  for (let off = 0; off < P; off += 0.5) {
    let s = 0, c = 0;
    for (let k = 0; ; k++) { const i = Math.round(off + k * P); if (i >= nF) break; if (fl2[i] > 0) { s += fl2[i]; c++; } }
    if (c && s / c > bs) { bs = s / c; beat0 = off / FPS; }
  }
  // half-second energy
  const half = Math.ceil(dur * 2), E50 = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    const a = Math.floor(i * FPS / 2), b = Math.min(nF, Math.floor((i + 1) * FPS / 2));
    let mx = 0; for (let f = a; f < b; f++) if (rms[f] > mx) mx = rms[f];
    E50[i] = mx;
  }
  const peak = Math.max(...E50);
  const lv = ' .:-=+*#%@';
  let spark = '';
  for (let i = 0; i < half; i += 4) { let mx = 0; for (let j = i; j < Math.min(half, i + 4); j++) mx = Math.max(mx, E50[j]); spark += lv[Math.min(9, Math.round(9 * mx / peak))]; }
  const tailAvg = E50.slice(Math.max(0, half - 8)).reduce((a, b) => a + b, 0) / Math.min(8, half);
  console.log('TAG=' + tag + ' DUR=' + dur.toFixed(2) + ' BPM=' + bpm.toFixed(2) + ' BEAT0=' + beat0.toFixed(3) + ' PEAK=' + peak.toFixed(3) + ' TAIL4S=' + tailAvg.toFixed(4) + ' SAMPLES=' + N);
  console.log('CANDS=' + cand.slice(0, 5).map(c2 => c2.bpm.toFixed(1) + ':' + c2.s.toFixed(1)).join(' '));
  console.log('E2S=' + spark);
  let l20 = ''; for (let i = 0; i < Math.min(40, half); i++) l20 += lv[Math.min(9, Math.round(9 * E50[i] / peak))];
  console.log('FIRST20=' + l20);
  const out = { tag, duration: dur, bpm, beat0, energy: Array.from(E50), flux: Array.from(flux), rms: Array.from(rms) };
  require('fs').writeFileSync(require('path').join(__dirname, 'analysis_' + tag + '.json'), JSON.stringify(out));
  console.log('SAVED=analysis_' + tag + '.json');
}
function makeFFT(n) {
  return function (re, im) {
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cwr = 1, cwi = 0;
        for (let j = 0; j < len / 2; j++) {
          const ur = re[i + j], ui = im[i + j];
          const vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi;
          const vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr;
          re[i + j] = ur + vr; im[i + j] = ui + vi;
          re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
          const nwr = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nwr;
        }
      }
    }
  };
}
