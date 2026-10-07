// probe: find the last trapezoid clip in the recording (the window pane clip)
const calls = app.recorder.calls;
let trap = null, trapCount = 0;
for (let i = calls.length - 1; i >= 0 && i > calls.length - 40000; i--) {
  const op = calls[i];
  if (op.op !== 'clip' || !op.sub || !op.sub[0] || op.sub[0].length !== 4) continue;
  const s = op.sub[0];
  if (Math.abs(s[0][0] - s[2][0]) > 2) { trap = s.map((p) => [Math.round(p[0]), Math.round(p[1])]); trapCount++; break; }
}
return { trapezoidClip: trap, found: trapCount > 0 };
