(function () {
  var r = window.PLR && window.PLR.app && window.PLR.app.renderer;
  var s = window.PLR && window.PLR.app && window.PLR.app.scene;
  if (!r) return { error: 'PLR not booted' };
  return {
    faces: r.debug.faces,
    solids: r.debug.solidCount,
    sceneSolids: s.solids.length,
    totalFaces: s.countFaces(),
    interactive: window.PLR.interact.Act.list.length,
    phase: +window.PLR.state.phase.toFixed(3),
    ms: +r.debug.ms.toFixed(2),
    cam: r.cam.pos.map(function (v) { return +v.toFixed(1); }),
    canvas: [r.canvas.width, r.canvas.height],
  };
})();
