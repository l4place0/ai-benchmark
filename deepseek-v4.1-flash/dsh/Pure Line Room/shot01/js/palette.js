/* =============================================================================
   Pure Line Room — palette.js
   One material table for the whole room, re-derived whenever the environment
   changes (daylight outside, interior lights on/off, lamp on/off). Builders
   read colours from `theme.mat`, so nothing in the room hard-codes a hex value.
   ========================================================================== */
(function (global) {
  'use strict';

  var M = global.M3;
  var P = global.PLR = global.PLR || {};

  /** '#rrggbb' + alpha → 'rgba(...)' — used by the screen-space layers. */
  P.hexA = function (hex, alpha) {
    var c = P.geom.hexToRgb(hex);
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + alpha + ')';
  };

  // Materials, authored once in "daylight" values and re-tinted per state.
  var BASE = {
    line: '#191a22',   // ink
    paper: '#ffffff',
    wall: '#f6f6f7',
    ceiling: '#fbfbfc',
    floor: '#f1efe9',
    floorAlt: '#eae7e0',
    wood: '#efe6d6',
    woodDark: '#e2d5bd',
    metal: '#eef0f3',
    metalDark: '#dfe3e9',
    fabric: '#f4f1ec',
    fabricAlt: '#eae5dd',
    rug: '#f3ece0',
    rugAlt: '#e9dfcd',
    accent: '#e8c9a0',
    plant: '#e9efe2',
    screen: '#f7f7f4',
    sky: '#eef5fc'
  };

  // Materials that should read "cooler and deeper" at night, and how far.
  var NIGHT_PULL = {
    wall: 0.30, ceiling: 0.26, floor: 0.34, floorAlt: 0.36,
    wood: 0.26, woodDark: 0.28, metal: 0.20, metalDark: 0.24,
    fabric: 0.30, fabricAlt: 0.32, rug: 0.32, rugAlt: 0.34,
    paper: 0.16, screen: 0.30, plant: 0.28, accent: 0.22, sky: 0.55
  };

  // When the room light is on, warm it up a touch (tungsten spill).
  var WARM_PULL = 0.16;

  var NIGHT_LINE = '#2b3145';
  var NIGHT_INK = '#c9cfe0';   // ink used to bake shading toward, at night

  function build(env) {
    env = env || {};
    var day = env.day === undefined ? 1 : env.day;
    var lightsOn = !!env.lightsOn;
    var lampOn = !!env.lampOn;
    var hour = env.hour === undefined ? 12 : env.hour;

    // How "night" the room reads: the exterior matters, and so does the
    // fact that a dark window makes an unlit room feel dark.
    var night = 1 - M.smoothstep(day * 1.15);
    // Interior ambient: dark window + lights off + no lamp = dim room.
    var lit = (lightsOn ? 0.55 : 0) + (lampOn ? 0.16 : 0);
    var ambient = M.clamp(0.34 + 0.66 * day * day + lit * (1 - day * 0.45) - night * 0.10, 0.24, 1);

    var mat = {};
    for (var k in BASE) {
      if (!Object.prototype.hasOwnProperty.call(BASE, k)) continue;
      var c = BASE[k];
      var pull = NIGHT_PULL[k];
      if (pull === undefined) pull = 0.2;
      c = P.geom.mix(c, '#586180', night * pull);
      if (lightsOn) c = P.geom.mix(c, '#fff0d6', WARM_PULL * (1 - day * 0.35));
      // global darkness floor so the room never turns muddy or black
      c = P.geom.mix(c, '#ffffff', M.clamp((0.34 - ambient) * 0.35, 0, 0.2));
      mat[k] = c;
    }

    var line = P.geom.mix(BASE.line, NIGHT_LINE, night * 0.85);
    var ink = P.geom.mix('#1b1c24', NIGHT_INK, night * 0.75);

    return {
      hour: hour,
      day: day,
      night: night,
      ambient: ambient,
      lightsOn: lightsOn,
      lampOn: lampOn,
      mat: mat,
      line: line,
      ink: ink,
      accent: P.geom.mix('#c98b3f', '#f0b661', night * 0.3),
      hover: '#c98b3f',
      glow: '#ffd79a',
      lampGlow: '#ffe0ad',
      shadeAmt: M.clamp(0.085 * (1 - ambient * 0.6), 0.02, 0.1),
      skyEdge: line,
      // how strongly the room's own surfaces are pulled toward the ink colour
      texture: 0.5 + 0.5 * day
    };
  }

  P.palette = { build: build, BASE: BASE };
})(typeof window !== 'undefined' ? window : globalThis);
