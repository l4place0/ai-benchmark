// probe: which operation paints a given pixel in the final frame?
const calls = app.recorder.calls;
let start = 0;
for (let i = calls.length - 1; i >= 0; i--) if (calls[i].op === 'clear') { start = i; break; }
const frame = calls.slice(start);
function inPoly(sub, x, y) {
  let inside = false;
  for (let i = 0, j = sub.length - 1; i < sub.length; j = i++) {
    const xi = sub[i][0], yi = sub[i][1], xj = sub[j][0], yj = sub[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const probes = [[600, 600], [430, 800], [500, 400], [900, 200]];
const out = {};
for (const [px, py] of probes) {
  const hits = [];
  for (const op of frame) {
    if (op.op !== 'fill') continue;
    for (const sub of (op.sub || [])) {
      if (sub.length >= 3 && inPoly(sub, px, py)) {
        hits.push({ style: typeof op.style === 'string' ? op.style : 'grad', alpha: op.alpha, n: sub.length });
        break;
      }
    }
  }
  out[px + ',' + py] = { count: hits.length, last3: hits.slice(-3), first3: hits.slice(0, 3) };
}
out.theme = { wall: app.theme().mat.wall, floor: app.theme().mat.floor, paper: app.theme().mat.paper, day: +app.theme().day.toFixed(2), ambient: +app.theme().ambient.toFixed(2) };
return out;
