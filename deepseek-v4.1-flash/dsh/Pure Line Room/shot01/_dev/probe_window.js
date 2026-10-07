// probe: what is actually drawn in the window area of the last frame?
const r = app.renderer;
const wb = app.sctx.windowBox;
const corners = [
  [wb[0] + 0.03, wb[1], wb[2]], [wb[0] + 0.03, wb[1], wb[4]],
  [wb[0] + 0.03, wb[3], wb[4]], [wb[0] + 0.03, wb[3], wb[2]]
].map((c) => r.project(c));
const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
const box = [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
const calls = app.recorder.calls;
let start = 0;
for (let i = calls.length - 1; i >= 0; i--) if (calls[i].op === 'clear') { start = i; break; }
const frame = calls.slice(start);
const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
const covering = [];
for (let i = 0; i < frame.length; i++) {
  const op = frame[i];
  if (op.op !== 'fill' && op.op !== 'stroke') continue;
  let hit = false;
  for (const sub of (op.sub || [])) for (const p of sub) {
    if (p[0] >= box[0] - 2 && p[0] <= box[2] + 2 && p[1] >= box[1] - 2 && p[1] <= box[3] + 2) { hit = true; break; }
    if (hit) break;
  }
  if (hit) {
    covering.push({
      i, op: op.op,
      style: typeof op.style === 'string' ? op.style : 'grad',
      alpha: op.alpha === undefined ? 1 : +op.alpha.toFixed(2),
      w: op.width
    });
  }
}
// what colour is actually at the window centre in our recording?
let topMost = null;
for (let i = covering.length - 1; i >= 0; i--) {
  const c = covering[i];
  if (c.alpha > 0.85 && c.op === 'fill') { topMost = c; break; }
}
return {
  windowPanePx: box.map(Math.round),
  paneCentre: [Math.round(cx), Math.round(cy)],
  opsTouchingPane: covering.length,
  first8: covering.slice(0, 8),
  last8: covering.slice(-8),
  topMostOpaqueFill: topMost,
  frontOpen: app.sctx.frontOpen,
  curtainGathered: app.sctx.curtainGathered
};
