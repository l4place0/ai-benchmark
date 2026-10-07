// Audio structure analysis: BPM / beat phase / energy envelope / spectral centroid
// stdin: f32le mono 22050Hz ; writes analysis.json next to script + prints report
const FS = 22050, HOP = 441, WIN = 2048, FPS = FS / HOP; // 50 fps analysis rate
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', run);
function run() {
  const buf = Buffer.concat(chunks), N = buf.length >> 2, x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = buf.readFloatLE(i * 4);
  const dur = N / FS, nF = Math.max(1, Math.floor((N - WIN) / HOP));
  const fft = makeFFT(WIN), hann = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1));
  const rms = new Float32Array(nF), flux = new Float32Array(nF), cent = new Float32Array(nF);
  let prev = null;
  for (let f = 0; f < nF; f++) {
    const re = new Float32Array(WIN), im = new Float32Array(WIN);
    let e = 0; const off = f * HOP;
    for (let i = 0; i < WIN; i++) { const v = x[off + i] * hann[i]; re[i] = v; e += v * v; }
    rms[f] = Math.sqrt(e / WIN);
    fft(re, im);
    let fl = 0, cw = 0, ce = 0;
    const bins = WIN >> 1;
    for (let k = 1; k < bins; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      if (prev) { const d = m - prev[k]; if (d > 0) fl += d; }
      ce += m * k; cw += m;
    }
    flux[f] = fl; cent[f] = cw ? ce / cw : 0;
    prev = new Float32Array(bins);
    for (let k = 1; k < bins; k++) prev[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  // ---- BPM via autocorrelation of onset flux ----
  const fl2 = Float32Array.from(flux);
  let mean = 0; for (const v of fl2) mean += v; mean /= nF;
  for (let i = 0; i < nF; i++) fl2[i] -= mean;
  const cands = [];
  for (let bpm = 50; bpm <= 200.001; bpm += 0.25) {
    const P = FPS * 60 / bpm; let s = 0, c = 0;
    for (let i = 0; i + P < nF; i++) { const j = Math.round(i + P); s += fl2[i] * fl2[j]; c++; }
    cands.push({ bpm, s: s / Math.max(1, c) });
  }
  cands.sort((a, b) => b.s - a.s);
  const top = cands.slice(0, 6);
  // ---- beat phase for best candidate ----
  function phaseFor(bpm) {
    const P = FPS * 60 / bpm; let bestOff = 0, bestScore = -1;
    for (let off = 0; off < P; off += 0.5) {
      let s = 0, c = 0;
      for (let k = 0; ; k++) { const i = Math.round(off + k * P); if (i >= nF) break; s += Math.max(0, fl2[i]); c++; }
      if (s / c > bestScore) { bestScore = s / c; bestOff = off; }
    }
    return { off: bestOff / FPS, score: bestScore };
  }
  const bpm = top[0].bpm, ph = phaseFor(bpm);
  // ---- energy at 0.5 s resolution (max rms per half-second) ----
  const half = Math.ceil(dur * 2), E50 = new Float32Array(half), C50 = new Float32Array(half), F50 = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    const a = Math.floor(i * FPS / 2), b = Math.min(nF, Math.floor((i + 1) * FPS / 2));
    let mx = 0, cs = 0, fs = 0, c = 0;
    for (let f = a; f < b; f++) { if (rms[f] > mx) mx = rms[f]; cs += cent[f]; fs += flux[f]; c++; }
    E50[i] = mx; C50[i] = c ? cs / c : 0; F50[i] = c ? fs / c : 0;
  }
  // ---- report ----
  const lv = ' .:-=+*#@';
  let spark = '';
  for (let i = 0; i < half; i += 4) { // 2 s per char
    let mx = 0; for (let j = i; j < Math.min(half, i + 4); j++) mx = Math.max(mx, E50[j]);
    const eMax = Math.max(...E50);
    spark += lv[Math.min(7, Math.floor(8 * mx / (eMax || 1)))];
  }
  const tail = E50.slice(Math.max(0, half - 8), half);
  const tailAvg = tail.reduce((a, b) => a + b, 0) / Math.max(1, tail.length);
  const peak = Math.max(...E50);
  console.log('DURATION: ' + dur.toFixed(2) + ' s');
  console.log('BPM_TOP: ' + top.map(t => t.bpm.toFixed(2) + '(' + t.s.toFixed(1) + ')').join(' '));
  console.log('BEAT0: ' + ph.off.toFixed(3) + ' s  score=' + ph.score.toFixed(1));
  console.log('PEAK_RMS: ' + peak.toFixed(3) + '  TAIL(4s): ' + tailAvg.toFixed(3) + '  tail/peak=' + (tailAvg / peak).toFixed(3));
  console.log('ENERGY(2s/char):');
  for (let i = 0; i < spark.length; i += 80) console.log(String(Math.round(i * 2)).padStart(4) + ' |' + spark.slice(i, i + 80) + '|');
  // first 20 s detail (vocal onset check)
  console.log('FIRST20S rms/0.5s:');
  let line = '';
  for (let i = 0; i < 40 && i < half; i++) line += lv[Math.min(7, Math.floor(8 * E50[i] / (peak || 1)))];
  console.log('  ' + line);
  const out = { duration: dur, bpm, beat0: ph.off, energy: Array.from(E50), centroid: Array.from(C50), flux: Array.from(F50), bpmCandidates: top.map(t => t.bpm) };
  require('fs').writeFileSync(require('path').join(__dirname, 'analysis.json'), JSON.stringify(out));
  console.log('SAVED analysis.json');
}
function makeFFT(n) {
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) { let r = 0, xx = i; for (let b = 1; b < n; b <<= 1) { r = (r << 1) | (xx & 1); xx >>= 1; } rev[i] = r; }
  const cosT = new Float32Array(n / 2), sinT = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cosT[i] = Math.cos(-2 * Math.PI * i / n); sinT[i] = Math.sin(-2 * Math.PI * i / n); }
  return function (re, im) {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) for (let j = 0; j < half; j++) {
        const k = j * step, c = cosT[k], s = sinT[k];
        const xr = re[i + j + half] * c - im[i + j + half] * s;
        const xi = re[i + j + half] * s + im[i + j + half] * c;
        re[i + j + half] = re[i + j] - xr; im[i + j + half] = im[i + j] - xi;
        re[i + j] += xr; im[i + j] += xi;
      }
    }
  };
}
