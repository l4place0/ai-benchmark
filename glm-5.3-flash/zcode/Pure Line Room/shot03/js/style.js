/* 线之屋 · 昼夜调色与线宽 */
(function () {
  function hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(h1, h2, t) {
    const a = hex2rgb(h1), b = hex2rgb(h2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function mixA(h1, h2, t, a) {
    const c = mix(h1, h2, t);
    return c.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
  }
  const DAY = {
    paper: '#fbfaf5', shade: '#e7e2d4', section: '#ded8c6', ink: '#23262b', inkSoft: '#565b63',
    sky: '#e0ebf1', skyLow: '#f4f1e4', sun: '#d9a53f', hill: '#a8b3a6', corridor: '#37352e'
  };
  const NIGHT = {
    paper: '#252833', shade: '#1a1d27', section: '#171a23', ink: '#c4cad8', inkSoft: '#8b93a6',
    sky: '#141a2c', skyLow: '#1b2338', sun: '#dfe2ea', hill: '#2b3247', corridor: '#0f1218'
  };
  const STYLE = {
    widths: { outline: 2.3, edge: 1.45, detail: 0.95, hair: 0.62 },
    DAY, NIGHT, mix, mixA, hex2rgb,
    font: px => px + 'px Georgia, "Times New Roman", serif',
    c(key, t) { const tt = t == null ? (window.RLR && RLR.Engine ? RLR.Engine.env.t : 0) : t; return mix(DAY[key], NIGHT[key], tt); },
    c2(dayHex, nightHex, t) { const tt = t == null ? (window.RLR && RLR.Engine ? RLR.Engine.env.t : 0) : t; return mix(dayHex, nightHex, tt); },
    /* 按"背光程度 k"给出面填充色（跨昼夜调色板插值） */
    shadeFill(k) {
      const tt = window.RLR && RLR.Engine ? RLR.Engine.env.t : 0;
      const kk = Math.min(0.62, k * 0.58);
      const da = hex2rgb(DAY.paper), db = hex2rgb(DAY.shade);
      const na = hex2rgb(NIGHT.paper), nb = hex2rgb(NIGHT.shade);
      const r1 = [da[0] + (db[0] - da[0]) * kk, da[1] + (db[1] - da[1]) * kk, da[2] + (db[2] - da[2]) * kk];
      const r2 = [na[0] + (nb[0] - na[0]) * kk, na[1] + (nb[1] - na[1]) * kk, na[2] + (nb[2] - na[2]) * kk];
      const f = [r1[0] + (r2[0] - r1[0]) * tt, r1[1] + (r2[1] - r1[1]) * tt, r1[2] + (r2[2] - r1[2]) * tt];
      return 'rgb(' + Math.round(f[0]) + ',' + Math.round(f[1]) + ',' + Math.round(f[2]) + ')';
    }
  };
  window.RLR = window.RLR || {};
  RLR.STYLE = STYLE;
})();
