/* =========================================================================
   Pure Line Room — palette.js
   Two global looks (day / night) plus every material the room uses.
   Materials carry a fill, a stroke, a stroke weight in world units and an
   optional dash. Weights are design values: 1 ≈ a fine construction line,
   2.2 ≈ a main contour.
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    function h(x) {
      if (x[0] === '#') x = x.slice(1);
      if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
      var n = parseInt(x, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var a = h(c1), b = h(c2);
    var r = Math.round(lerp(a[0], b[0], t)), g = Math.round(lerp(a[1], b[1], t)), bl = Math.round(lerp(a[2], b[2], t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /* Material table: [fill, stroke, strokeWeight, fillOpacity, strokeOpacity]
     Stroke weight is in world units and is divided by depth when drawn, so
     with the default focal length (430) a face at 430cm renders at exactly
     this many pixels:  sil 2.5px, standard edge 1.8px, crease 1.35px,
     fine 0.95px, hair 0.7px, hidden construction line 0.75px. */
  var DAY = {
    /* surfaces */
    wall:      ['#fdfdfc', '#22242c', 1.8, 1, 1],
    wallSide:  ['#f8f8f6', '#22242c', 1.75, 1, 1],
    wallEx:    ['#f2f2ef', '#22242c', 1.2, 1, 1],
    floor:     ['#fbfbf9', '#22242c', 1.95, 1, 1],
    ceiling:   ['#fefefe', '#22242c', 1.6, 1, 1],
    ceilingEx: ['#f6f6f3', '#22242c', 1.2, 1, 1],
    trim:      ['#f5f5f2', '#22242c', 1.35, 1, 1],
    /* core object material */
    white:     ['#fefefe', '#1c1e26', 1.95, 0.985, 1],
    whiteSoft: ['#fcfcfb', '#1c1e26', 1.5, 0.985, 1],
    crease:    ['#fefefe', '#4a4d59', 0.95, 0.99, 0.85],
    /* materials */
    wood:      ['#f8f4ee', '#1c1e26', 1.95, 0.99, 1],
    woodDark:  ['#f0e9de', '#1c1e26', 1.8, 0.99, 1],
    woodGrain: ['#f7f3ec', '#8b8578', 0.7, 0.99, 0.7],
    metal:     ['#f2f3f4', '#1c1e26', 1.7, 0.99, 1],
    brass:     ['#f7f2e4', '#5a5138', 1.35, 0.99, 0.9],
    paper:     ['#ffffff', '#2a2c35', 1.15, 1, 0.95],
    fabric:    ['#f9f8f5', '#1c1e26', 1.8, 0.99, 1],
    fabric2:   ['#f4f2ed', '#1c1e26', 1.65, 0.99, 1],
    rug:       ['#f8f7f3', '#1c1e26', 1.75, 0.99, 1],
    glass:     ['#f4f8fb', '#5c6675', 1.1, 0.55, 0.9],
    dark:      ['#d9dae0', '#15161c', 1.85, 0.99, 1],
    leaf:      ['#f3f6f0', '#22242c', 1.4, 0.99, 1],
    /* lines only */
    ink:       ['#000000', '#1a1c24', 1.5, 0, 1],
    fine:      ['#000000', '#5a5d68', 0.95, 0, 0.9],
    hair:      ['#000000', '#9a9ca4', 0.7, 0, 0.8],
    sil:       ['#000000', '#14161d', 2.5, 0, 1],
    hidden:    ['#000000', '#6f727d', 0.75, 0, 0.4],
    glow:      ['#fff4d8', '#c9a24a', 1.0, 0.75, 0.5],
    shadow:    ['#000000', '#000000', 0.8, 0.055, 0],
    screen:    ['#eef2f6', '#20222a', 1.4, 0.95, 0.9],
    accent:    ['#eceae4', '#1c1e26', 1.65, 0.99, 1],
    /* emissive-ish */
    lampOn:    ['#fff7e2', '#8a7233', 1.5, 0.98, 0.9],
    shade:     ['#faf9f6', '#1c1e26', 1.9, 0.99, 1],
    shadeIn:   ['#fffaf0', '#8a8378', 1.0, 0.99, 0.7],
    bulb:      ['#fffdf6', '#8a7233', 1.15, 0.97, 0.8],
    /* seen through the window */
    sky:       ['#ffffff', '#c3ccd8', 0.9, 1, 0.5],
    hillFar:   ['#f3f5f7', '#8d97a6', 1.0, 1, 0.7],
    hillMid:   ['#eef1f3', '#6d7787', 1.05, 1, 0.85],
    ground:    ['#f5f6f4', '#5d6675', 1.1, 1, 0.9],
  };

  var NIGHT_OVERRIDES = {
    wall:      ['#2b2f3c', '#e6e9f2', 1.8, 1, 1],
    wallSide:  ['#262a36', '#e6e9f2', 1.75, 1, 1],
    wallEx:    ['#1e222c', '#c9cfdd', 1.2, 1, 1],
    floor:     ['#282c38', '#e6e9f2', 1.95, 1, 1],
    ceiling:   ['#23262f', '#e6e9f2', 1.6, 1, 1],
    ceilingEx: ['#1d2029', '#c9cfdd', 1.2, 1, 1],
    trim:      ['#2f333f', '#e6e9f2', 1.35, 1, 1],
    white:     ['#323644', '#eef1f8', 1.95, 0.99, 1],
    whiteSoft: ['#2e3240', '#e9ecf4', 1.5, 0.99, 1],
    wood:      ['#383226', '#f0e9dc', 1.95, 0.99, 1],
    woodDark:  ['#332e24', '#ece4d6', 1.8, 0.99, 1],
    fabric:    ['#333748', '#eaedf6', 1.8, 0.99, 1],
    fabric2:   ['#2f3342', '#e6e9f2', 1.65, 0.99, 1],
    rug:       ['#2c3040', '#e6e9f2', 1.75, 0.99, 1],
    glass:     ['#1d2a3a', '#9fb4cc', 1.1, 0.72, 0.95],
    dark:      ['#20232c', '#cfd4e2', 1.85, 0.99, 1],
    ink:       ['#000000', '#e8ebf4', 1.5, 0, 1],
    fine:      ['#000000', '#b9bec9', 0.95, 0, 0.9],
    hair:      ['#000000', '#7e838f', 0.7, 0, 0.8],
    sil:       ['#000000', '#f2f5fc', 2.5, 0, 1],
    hidden:    ['#000000', '#767b88', 0.75, 0, 0.3],
    metal:     ['#3a3f4d', '#eef1f8', 1.7, 0.99, 1],
    paper:     ['#3a3f4d', '#eef1f8', 1.15, 1, 0.95],
    brass:     ['#40382a', '#f4ead4', 1.35, 0.99, 0.95],
    leaf:      ['#2b3327', '#e0e6da', 1.4, 0.99, 1],
    accent:    ['#363a48', '#eceff7', 1.65, 0.99, 1],
    screen:    ['#2a3644', '#cfe0f2', 1.4, 0.95, 0.9],
    shade:     ['#3a3222', '#f2e6c8', 1.9, 0.99, 1],
    shadeIn:   ['#4a3d24', '#f6e2ae', 1.0, 0.99, 0.8],
    bulb:      ['#fff3cf', '#ffe6a8', 1.15, 0.99, 0.95],
    sky:       ['#131722', '#3d4a63', 0.9, 1, 0.45],
    hillFar:   ['#181d29', '#5d6a83', 1.0, 1, 0.65],
    hillMid:   ['#1c2230', '#6d7c99', 1.05, 1, 0.85],
    ground:    ['#1a1f2b', '#8794ab', 1.1, 1, 0.9],
  };

  function buildPalette(t) {
    var pal = {};
    var k;
    for (k in DAY) if (DAY.hasOwnProperty(k)) {
      var d = DAY[k];
      var n = NIGHT_OVERRIDES[k] || d;
      pal[k] = {
        fill: mix(d[0], n[0], t),
        stroke: mix(d[1], n[1], t),
        weight: lerp(d[2], n[2], t),
        fillOpacity: lerp(d[3], n[3], t),
        strokeOpacity: lerp(d[4], n[4], t),
        shade: 0,
      };
    }
    // global atmosphere
    pal.__bg = mix('#fbfbfa', '#161922', t);
    pal.__dark = 0;                        // colours are already mixed
    pal.__veil = lerp(0, 0.035, t);
    pal.__veilColor = mix('#ffffff', '#0d1018', t);
    pal.__time = t;
    return pal;
  }

  PLR.palette = {
    build: buildPalette,
    daily: DAY,
    night: NIGHT_OVERRIDES,
    mix: mix,
    // handy raw colours for overlays
    ink: function (t) { return mix('#1a1c24', '#e8ebf4', t); },
    paper: function (t) { return mix('#fbfbfa', '#161922', t); },
    warm: function (t) { return mix('#ffdca6', '#ffcf94', t); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
