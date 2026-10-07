/* =========================================================================
   Pure Line Room — build.js
   Assembles the room from the object modules. Each module registers itself as
   PLR.objects.<name> = { id, build(app) }.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  PLR.objects = PLR.objects || {};

  var order = [
    'room',       // shell: walls, floor, ceiling, outside
    'rug',        // the ground plane of the living area
    'art',        // wall pieces
    'window',     // frame, glass, blinds, curtain
    'door',       // opening, leaf, handle
    'shelf',      // bookcase + books
    'sideboard',  // drawers + cupboard + globe
    'desk',       // desk
    'chair',      // desk chair
    'cup',        // mug + steam
    'lamp',       // desk lamp
    'clock',      // wall clock
    'sofa',       // sofa + cushions
    'table',      // coffee table
    'record',     // turntable
    'fan',        // ceiling fan
    'chime',      // wind chime
    'switch',     // wall switch
  ];

  PLR.objects.build = function (app) {
    for (var i = 0; i < order.length; i++) {
      var name = order[i];
      var mod = PLR.objects[name];
      if (!mod || typeof mod.build !== 'function') continue;
      try {
        mod.build(app);
      } catch (err) {
        root.console && console.error('[PLR] failed to build "' + name + '":', err);
      }
    }
    return app.scene;
  };
})(typeof window !== 'undefined' ? window : globalThis);
