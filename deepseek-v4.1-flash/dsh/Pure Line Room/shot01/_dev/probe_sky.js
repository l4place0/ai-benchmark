// probe: is drawSky running, and what box does it compute?
const calls = app.recorder.calls;
let start = 0;
for (let i = calls.length - 1; i >= 0; i--) if (calls[i].op === 'clear') { start = i; break; }
const frameOps = calls.slice(start);
let clipCount = 0, restoreIdx = -1;
for (let i = 0; i < frameOps.length; i++) {
  if (frameOps[i].op === 'clip') { clipCount++; if (clipCount === 1) restoreIdx = i; }
}
return {
  trace: window.PLR.trace || null,
  frameOpCount: frameOps.length,
  firstClipAt: restoreIdx,
  firstSix: frameOps.slice(0, 6).map((o) => o.op + (o.a ? ' ' + JSON.stringify(o.a) : '')),
  firstClipBox: frameOps.find((o) => o.op === 'clip') ? frameOps.find((o) => o.op === 'clip').box.map(Math.round) : null
};
