/* =========================================================================
   Rainy Corner — a miniature Japanese convenience-store street corner.
   Cel-shaded (三渲二) diorama, rainy night. Three.js r159 (UMD, global THREE).
   ========================================================================= */
(function () {
'use strict';
if (typeof THREE === 'undefined') { return; }
var T = THREE;

/* ---------------- seeded rng ---------------- */
var _s = 20261004 >>> 0;
function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }
function rr(a, b) { return a + (b - a) * rnd(); }
function pick(a) { return a[(rnd() * a.length) | 0]; }

/* ---------------- renderer / scene / camera ---------------- */
var canvas = document.getElementById('c');
var renderer;
try {
  renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true });
} catch (e) { return; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.useLegacyLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;

var scene = new T.Scene();
scene.background = new T.Color(0x0d1019);

var camera = new T.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 400);
camera.layers.enable(1);

var updaters = [];
function onUpdate(fn) { updaters.push(fn); }

/* ---------------- helpers ---------------- */
var geoCache = {};
function geoBox(w, h, d) {
  var k = 'b' + w + ',' + h + ',' + d;
  if (!geoCache[k]) geoCache[k] = new T.BoxGeometry(w, h, d);
  return geoCache[k];
}
function geoCyl(rt, rb, h, seg) {
  var k = 'c' + rt + ',' + rb + ',' + h + ',' + seg;
  if (!geoCache[k]) geoCache[k] = new T.CylinderGeometry(rt, rb, h, seg);
  return geoCache[k];
}

/* first step pure black: the toon shader samples the gradient for back-facing
   light too (dotNL<0 -> coord<0.5); a non-black first step would leak light
   through roofs and walls */
var gradientMap = new T.DataTexture(new Uint8Array([0, 30, 212, 255]), 4, 1, T.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = T.NearestFilter;
gradientMap.needsUpdate = true;

var OUTLINE = new T.LineBasicMaterial({ color: 0x241d31, transparent: true, opacity: 0.9 });
/* interior lights live on layer 1; meshes tagged with LIT=1 receive them so the
   shell (roof / outer walls) never picks up interior light through backfaces */
var LIT = 0;
var edgeCache = {};
function edge(mesh, thresh) {
  if (thresh === undefined) thresh = 18;
  var k = mesh.geometry.uuid + '|' + thresh;
  if (!edgeCache[k]) edgeCache[k] = new T.EdgesGeometry(mesh.geometry, thresh);
  var l = new T.LineSegments(edgeCache[k], OUTLINE);
  mesh.add(l);
  return mesh;
}

function toon(color, opts) {
  opts = opts || {};
  var m = new T.MeshToonMaterial({ color: color, gradientMap: gradientMap });
  if (opts.map) m.map = opts.map;
  if (opts.emissive !== undefined) {
    m.emissive = new T.Color(opts.emissive);
    if (opts.emissiveIntensity !== undefined) m.emissiveIntensity = opts.emissiveIntensity;
  }
  if (opts.transparent) { m.transparent = true; if (opts.opacity !== undefined) m.opacity = opts.opacity; }
  if (opts.side !== undefined) m.side = opts.side;
  if (opts.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
  return m;
}

function box(parent, w, h, d, mat, x, y, z, o) {
  o = o || {};
  var m = new T.Mesh(geoBox(w, h, d), mat);
  m.position.set(x, y, z);
  if (LIT) m.layers.enable(1);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  parent.add(m);
  if (o.edge) edge(m, o.edgeThresh);
  return m;
}
function cyl(parent, rt, rb, h, seg, mat, x, y, z, o) {
  o = o || {};
  var m = new T.Mesh(geoCyl(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  if (LIT) m.layers.enable(1);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  parent.add(m);
  if (o.edge) edge(m, o.edgeThresh);
  return m;
}
function tube(parent, x1, y1, z1, x2, y2, z2, r, mat, seg) {
  var v1 = new T.Vector3(x1, y1, z1), v2 = new T.Vector3(x2, y2, z2);
  var d = new T.Vector3().subVectors(v2, v1);
  var len = d.length();
  if (len < 1e-5) return null;
  var m = new T.Mesh(geoCyl(r, r, len, seg || 6), mat);
  m.position.copy(v1).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  m.castShadow = false;
  if (LIT) m.layers.enable(1);
  parent.add(m);
  return m;
}
function plane(parent, w, h, mat, x, y, z, rx, ry) {
  var m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  if (LIT) m.layers.enable(1);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}

/* ---------------- canvas textures ---------------- */
function ctex(w, h, fn, rx, ry) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  var t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  if (rx) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry || rx); }
  return t;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
var F = '"Meiryo","Yu Gothic","Noto Sans JP",sans-serif';

/* asphalt */
function asphaltTex(rx, ry) {
  return ctex(256, 256, function (g) {
    g.fillStyle = '#272c3c'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1300; i++) {
      g.fillStyle = pick(['rgba(20,24,36,0.5)', 'rgba(56,64,86,0.35)', 'rgba(38,44,62,0.5)']);
      g.fillRect(rnd() * 256, rnd() * 256, rr(1, 2.4), rr(1, 2.4));
    }
    g.strokeStyle = 'rgba(16,18,28,0.55)'; g.lineWidth = 1.2;
    for (var j = 0; j < 5; j++) {
      g.beginPath();
      var x = rnd() * 256, y = rnd() * 256;
      g.moveTo(x, y);
      for (var k = 0; k < 3; k++) { x += rr(-40, 40); y += rr(-40, 40); g.lineTo(x, y); }
      g.stroke();
    }
  }, rx, ry);
}
/* sidewalk tiles */
function walkTex(rx, ry) {
  return ctex(256, 256, function (g) {
    g.fillStyle = '#82868f'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 500; i++) {
      g.fillStyle = pick(['rgba(110,114,124,0.5)', 'rgba(150,154,163,0.35)']);
      g.fillRect(rnd() * 256, rnd() * 256, rr(1, 3), rr(1, 3));
    }
    g.strokeStyle = 'rgba(96,100,110,0.9)'; g.lineWidth = 2;
    for (var p = 0; p <= 256; p += 64) {
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
    }
  }, rx, ry);
}
/* interior floor */
var floorTex = ctex(256, 256, function (g) {
  g.fillStyle = '#d6cdbc'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#c1b7a6'; g.lineWidth = 3;
  for (var p = 0; p <= 256; p += 42) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
}, 10, 8);

/* store fascia sign */
var texSign = ctex(1536, 288, function (g, w, h) {
  var gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#124a37'); gr.addColorStop(1, '#0a3125');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6;
  g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 148px ' + F;
  g.fillText('ミナミマート', 540, h / 2 - 14);
  g.font = '700 46px ' + F;
  g.fillText('MINAMI MART', 540, h - 52);
  g.fillStyle = '#ff8c3a';
  rrect(g, 1050, 46, 420, 196, 20); g.fill();
  g.fillStyle = '#ffffff';
  g.font = '900 86px ' + F; g.fillText('24時間', 1260, 112);
  g.font = '900 58px ' + F; g.fillText('営業中', 1260, 200);
});

/* vending machine face */
function vendTex(base, top, label) {
  return ctex(256, 512, function (g, w, h) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = top; g.fillRect(0, 0, w, 64);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 34px ' + F; g.fillText(label, w / 2, 34);
    g.fillStyle = '#131c2a'; rrect(g, 20, 80, 216, 240, 8); g.fill();
    var cols = ['#ff6b6b', '#ffd23f', '#7ddf7d', '#5dc9e8', '#ff9ad5', '#f2f2f2'];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) {
      g.fillStyle = cols[(r * 3 + c) % cols.length];
      rrect(g, 32 + c * 70, 92 + r * 56, 54, 40, 5); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '700 15px ' + F;
    for (var p = 0; p < 4; p++) for (var q = 0; q < 3; q++) g.fillText('130', 59 + q * 70, 144 + p * 56);
    g.fillStyle = '#0d1420'; rrect(g, 20, 336, 216, 90, 8); g.fill();
    g.fillStyle = 'rgba(120,200,255,0.8)'; g.font = '700 26px ' + F;
    g.fillText('つめた〜い', w / 2, 362);
    g.fillStyle = '#39424f'; rrect(g, 60, 440, 136, 46, 6); g.fill();
    g.fillStyle = '#cfd6de'; rrect(g, 176, 440, 34, 46, 4); g.fill();
  });
}

/* posters */
function posterTex(bg, accent, big, small) {
  return ctex(256, 352, function (g, w, h) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.fillRect(0, 0, w, 70);
    g.fillRect(0, h - 46, w, 46);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var bf = Math.min(44, (w - 24) / big.length * 1.55);
    g.font = '900 ' + bf + 'px ' + F; g.fillText(big, w / 2, 37);
    var sf = Math.min(60, (w - 20) / small.length * 1.75);
    g.font = '900 ' + sf + 'px ' + F;
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
    g.fillText(small, w / 2, h / 2 + 14);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '700 24px ' + F;
    g.fillText('ミナミマート', w / 2, h - 24);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(28, 120 + i * 34); g.lineTo(w - 28, 120 + i * 34); g.stroke();
    }
  });
}

/* small utility sign textures */
function boardTex(w, h, bg, fg, lines, fontSize, border) {
  return ctex(w, h, function (g) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = Math.max(3, w * 0.02); g.strokeRect(w * 0.035, h * 0.035, w * 0.93, h * 0.93); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    var fs = fontSize || h / (lines.length + 0.8);
    g.font = '900 ' + fs + 'px ' + F;
    for (var i = 0; i < lines.length; i++) g.fillText(lines[i], w / 2, (h / (lines.length + 1)) * (i + 1));
  });
}
function verticalSignTex(bg, fg, chars, sub) {
  return ctex(128, 512, function (g, w, h) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 84px ' + F;
    for (var i = 0; i < chars.length; i++) g.fillText(chars[i], w / 2, 84 + i * 96);
    if (sub) { g.font = '700 30px ' + F; g.fillText(sub, w / 2, h - 36); }
  });
}

/* street sign */
var texStreetSign = ctex(512, 224, function (g, w, h) {
  g.fillStyle = '#1f4f9e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 74px ' + F; g.fillText('南町二丁目', w / 2 - 30, h / 2 - 22);
  g.font = '700 30px ' + F; g.fillText('MINAMI-CHO 2-CHOME', w / 2 - 30, h / 2 + 52);
  g.font = '900 110px ' + F; g.fillText('2', w - 66, h / 2);
});

/* doormat */
var texMat = ctex(384, 192, function (g, w, h) {
  g.fillStyle = '#20402f'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(230,225,205,0.85)'; g.lineWidth = 6;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = 'rgba(235,230,210,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 42px ' + F; g.fillText('いらっしゃいませ', w / 2, h / 2);
});

/* bulletin board */
var texBulletin = ctex(512, 384, function (g, w, h) {
  g.fillStyle = '#5f6a72'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4a545c'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
  var papers = [['#f2ecd8', '回覧板'], ['#fdf6ea', '清掃日の\nお知らせ'], ['#eef2f8', '自治会\n加入のご案内'], ['#fbe9e2', '夜間は\nあかりを']];
  var pos = [[30, 44], [268, 44], [30, 200], [268, 200]];
  for (var i = 0; i < 4; i++) {
    g.save();
    g.translate(pos[i][0] + 107, pos[i][1] + 68);
    g.rotate(rr(-0.05, 0.05));
    g.fillStyle = papers[i][0];
    g.fillRect(-107, -68, 214, 136);
    g.strokeStyle = 'rgba(60,60,70,0.4)'; g.lineWidth = 2;
    g.strokeRect(-107, -68, 214, 136);
    g.fillStyle = '#333a44'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 26px ' + F;
    var ls = papers[i][1].split('\n');
    for (var j = 0; j < ls.length; j++) g.fillText(ls[j], 0, -30 + j * 40 + (ls.length === 1 ? 22 : 0));
    g.fillStyle = '#c0392b';
    g.beginPath(); g.arc(0, -62, 6, 0, 7); g.fill();
    g.restore();
  }
});

/* glass rain streaks */
var texGlassRain = ctex(256, 512, function (g, w, h) {
  g.clearRect(0, 0, w, h);
  for (var i = 0; i < 9; i++) {
    var x = rr(10, w - 10);
    g.strokeStyle = 'rgba(255,255,255,' + rr(0.25, 0.6).toFixed(2) + ')';
    g.lineWidth = rr(2, 5);
    g.beginPath(); g.moveTo(x, -10);
    var cx = x;
    for (var y = 0; y < h + 20; y += 40) { cx += rr(-6, 6); g.lineTo(cx, y); }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (var d = 0; d < 26; d++) {
      g.beginPath();
      g.arc(x + rr(-14, 14), rnd() * h, rr(1, 3.2), 0, 7);
      g.fill();
    }
  }
});
texGlassRain.wrapS = texGlassRain.wrapT = T.RepeatWrapping;

/* floor guide (interior) */
var texGuide = ctex(256, 256, function (g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(70,120,200,0.85)';
  g.beginPath(); g.moveTo(w / 2, 16); g.lineTo(w / 2 + 34, 70); g.lineTo(w / 2 - 34, 70); g.fill();
  g.fillRect(w / 2 - 8, 70, 16, 90);
  g.font = '700 34px ' + F; g.textAlign = 'center'; g.fillStyle = 'rgba(70,120,200,0.9)';
  g.fillText('レジへ', w / 2, 210);
});

/* window decal */
var texOpen = ctex(512, 128, function (g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = '900 66px ' + F; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('OPEN 24時間', w / 2, h / 2);
});

/* glow sprite */
var texGlow = ctex(128, 128, function (g) {
  var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
function glow(parent, color, x, y, z, s, op) {
  var m = new T.SpriteMaterial({ map: texGlow, color: color, transparent: true, opacity: op === undefined ? 0.5 : op, blending: T.AdditiveBlending, depthWrite: false });
  var sp = new T.Sprite(m);
  sp.scale.set(s, s, 1);
  sp.position.set(x, y, z);
  sp.renderOrder = 20;
  parent.add(sp);
  return sp;
}

/* wet-road light streaks */
var streakCache = {};
function streakTex(hex) {
  if (streakCache[hex]) return streakCache[hex];
  var c = document.createElement('canvas'); c.width = 64; c.height = 256;
  var g = c.getContext('2d');
  var col = new T.Color(hex);
  var r = (col.r * 255) | 0, gr = (col.g * 255) | 0, b = (col.b * 255) | 0;
  var vg = g.createLinearGradient(0, 0, 0, 256);
  vg.addColorStop(0, 'rgba(' + r + ',' + gr + ',' + b + ',0.95)');
  vg.addColorStop(0.55, 'rgba(' + r + ',' + gr + ',' + b + ',0.4)');
  vg.addColorStop(1, 'rgba(' + r + ',' + gr + ',' + b + ',0)');
  g.fillStyle = vg; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  var hg = g.createLinearGradient(0, 0, 64, 0);
  hg.addColorStop(0, 'rgba(0,0,0,0)');
  hg.addColorStop(0.5, 'rgba(0,0,0,1)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg; g.fillRect(0, 0, 64, 256);
  var t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  streakCache[hex] = t;
  return t;
}
function streak(parent, hex, w, len, x, y, z, ry, op) {
  var m = new T.Mesh(new T.PlaneGeometry(w, len),
    new T.MeshBasicMaterial({ map: streakTex(hex), transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = ry || 0;
  m.position.set(x, y, z);
  m.renderOrder = 6;
  m.userData.baseOp = op;
  m.userData.ph = rnd() * 6.28;
  parent.add(m);
  return m;
}

/* ---------------- environment map (for wet reflections) ---------------- */
var envTex = (function () {
  var es = new T.Scene();
  var sky = new T.Mesh(new T.SphereGeometry(60, 16, 12), new T.MeshBasicMaterial({ color: 0x222e52, side: T.BackSide }));
  es.add(sky);
  function dot(x, y, z, r, c) {
    var d = new T.Mesh(new T.SphereGeometry(r, 12, 8), new T.MeshBasicMaterial({ color: c }));
    d.position.set(x, y, z); es.add(d);
  }
  dot(0, 16, 12, 4.5, 0xfff0d0);      // store glow
  dot(-12, 9, 16, 1.8, 0xffd2a0);     // streetlight
  dot(-18, 7, 14, 1.2, 0xff5a5a);     // traffic red
  dot(-18, 7, 11, 1.0, 0x58e08a);     // traffic green
  dot(15, 9, 14, 1.3, 0xff6fd8);      // snack sign
  dot(14, 7, 16, 1.2, 0xbfe9ff);      // vending
  dot(8, 12, -14, 2.5, 0x8fb3ff);     // cool sky patch
  var pm = new T.PMREMGenerator(renderer);
  var rt = pm.fromScene(es, 0, 0.1, 300);
  pm.dispose();
  return rt.texture;
})();

/* ---------------- shared materials ---------------- */
var M = {};
M.asphaltF = new T.MeshStandardMaterial({ map: asphaltTex(12, 3), roughness: 0.42, metalness: 0.1, envMap: envTex, envMapIntensity: 0.5 });
M.asphaltL = new T.MeshStandardMaterial({ map: asphaltTex(3, 10), roughness: 0.42, metalness: 0.1, envMap: envTex, envMapIntensity: 0.5 });
M.walkF = toon(0xffffff, { map: walkTex(10, 1) });
M.walkL = toon(0xffffff, { map: walkTex(1, 10) });
M.curb = toon(0x9aa0ac);
M.walkDark = toon(0x6f737e);
M.gutter = toon(0x22262f);
M.grate = toon(0x2d323e);
M.markW = new T.MeshStandardMaterial({ color: 0xc3cad2, roughness: 0.3, metalness: 0.22, envMap: envTex, envMapIntensity: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
M.zebra = new T.MeshStandardMaterial({ color: 0xe3e8ee, roughness: 0.24, metalness: 0.28, envMap: envTex, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
M.zebraY = new T.MeshStandardMaterial({ color: 0xd8c56a, roughness: 0.3, metalness: 0.2, envMap: envTex, envMapIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
M.puddle = new T.MeshStandardMaterial({ color: 0x36466b, metalness: 1.0, roughness: 0.09, envMap: envTex, envMapIntensity: 2.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
M.wallStore = toon(0xe9e4d8);
M.wallSide = toon(0xd9d4c8);
M.alu = toon(0x5a6270);
M.steel = new T.MeshStandardMaterial({ color: 0xb6bdc9, metalness: 0.85, roughness: 0.35, envMap: envTex, envMapIntensity: 0.7 });
M.glass = new T.MeshPhysicalMaterial({ color: 0xa8cdea, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.07, envMap: envTex, envMapIntensity: 0.7, depthWrite: false, side: T.DoubleSide });
M.glassFridge = new T.MeshPhysicalMaterial({ color: 0xbfe0f0, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.3, envMap: envTex, envMapIntensity: 1.2, depthWrite: false, side: T.DoubleSide });
M.dark = toon(0x2c2f3a);
M.white = toon(0xf2efe7);
M.wood = toon(0x8a6f52);
M.leaf = toon(0x2f4a38);
M.interior = toon(0xf0ebdf);
M.ceil = toon(0xf2ede1);
M.lampHead = toon(0x333845);

/* =========================================================================
   BASE PLINTH
   ========================================================================= */
var plinth = box(scene, 44, 2.4, 44, toon(0x232030), 0, -1.2, 0, { edge: true, edgeThresh: 30, cast: false });
plinth.receiveShadow = true;
box(scene, 43.4, 0.1, 43.4, toon(0x2c2838), 0, -0.05, 0, { cast: false });
box(scene, 44, 0.06, 44, toon(0x17151f), 0, 0.0, 0, { cast: false, recv: true });

/* =========================================================================
   ROADS
   ========================================================================= */
box(scene, 44, 0.04, 9, M.asphaltF, 0, 0.02, 12.5);                    // front road
box(scene, 9, 0.04, 30, M.asphaltL, -17.5, 0.02, -7);                  // left road
/* sidewalks */
box(scene, 33, 0.16, 2.6, M.walkF, 5.5, 0.08, 7.2, { edge: true });    // front sidewalk
box(scene, 2, 0.16, 30, M.walkL, -12, 0.08, -7, { edge: true });       // left sidewalk
box(scene, 2, 0.16, 2.2, M.walkL, -12, 0.08, 9.1, { edge: true });     // corner island
box(scene, 44, 0.16, 5, M.walkF, 0, 0.08, 19.5, { edge: true });       // far sidewalk
/* plot pavement under store */
box(scene, 23.5, 0.14, 17.4, toon(0x7c7884, { map: walkTex(7, 5) }), -0.25, 0.07, -2.9, { cast: false });
/* alley ground */
box(scene, 4, 0.1, 28, toon(0x33323c, { map: asphaltTex(1, 7) }), 13.5, 0.05, -8);
/* back lot ground */
box(scene, 26.5, 0.06, 10.5, toon(0x1f1d29), 2.25, 0.03, -16.75, { cast: false });

/* curbs + gutters */
box(scene, 33, 0.14, 0.26, M.curb, 5.5, 0.07, 8.42, { cast: false });
box(scene, 0.26, 0.14, 30, M.curb, -12.87, 0.07, -7, { cast: false });
box(scene, 44, 0.14, 0.26, M.curb, 0, 0.07, 17.13, { cast: false });
box(scene, 33, 0.045, 0.5, M.gutter, 5.5, 0.023, 8.74, { cast: false });
box(scene, 0.5, 0.045, 30, M.gutter, -13.27, 0.023, -7, { cast: false });
box(scene, 44, 0.045, 0.5, M.gutter, 0, 0.023, 16.78, { cast: false });
/* grates — 0.55 across the gutter, 1.3 along it (gutters run along both roads) */
[[-7.5, 8.74], [-1.5, 8.74], [4.5, 8.74], [10.5, 8.74], [16.5, 8.74],
 [-13.27, -16], [-13.27, -8], [-13.27, -1], [-13.27, 5],
 [6, 16.78], [-6, 16.78]].forEach(function (p) {
  box(scene, 0.55, 0.05, 1.3, M.grate, p[0], 0.052, p[1], { cast: false, edge: true, edgeThresh: 30 });
});
/* manholes */
[[-5.5, 12.6], [-17.4, -2.5]].forEach(function (p) {
  var mh = new T.Mesh(new T.CircleGeometry(0.5, 20), toon(0x3a3f4c, { polygonOffset: true }));
  mh.rotation.x = -Math.PI / 2; mh.position.set(p[0], 0.05, p[1]);
  mh.receiveShadow = true; scene.add(mh);
  cyl(scene, 0.5, 0.5, 0.03, 20, M.dark, p[0], 0.055, p[1], { rx: Math.PI / 2, cast: false });
});

/* lane markings */
function dashes(x, z, n, horizontal) {
  for (var i = 0; i < n; i++) {
    if (horizontal) box(scene, 1.7, 0.006, 0.14, M.markW, x + i * 3.4, 0.045, z, { cast: false, recv: false });
    else box(scene, 0.14, 0.006, 1.7, M.markW, x, 0.045, z + i * 3.4, { cast: false, recv: false });
  }
}
dashes(-20.4, 12.5, 2, true); dashes(-10.2, 12.5, 9, true);
dashes(-17.5, -20.4, 8, false);
/* stop line */
box(scene, 0.4, 0.006, 3.6, M.markW, -3.6, 0.045, 14.4, { cast: false, recv: false });
/* crosswalks (reflective zebra) — stripes parallel to each road's traffic flow,
   repeating along the pedestrian walking direction */
for (var zi = 0; zi < 7; zi++) box(scene, 5, 0.006, 0.68, M.zebra, -6.5, 0.048, 8.8 + zi * 1.32, { cast: false, recv: true });
for (var xi = 0; xi < 7; xi++) box(scene, 0.6, 0.006, 3.8, M.zebra, -13.5 - xi * 1.2, 0.048, 2.7, { cast: false, recv: true });
/* parking bays */
box(scene, 7, 0.006, 0.12, M.markW, 4.5, 0.045, 16.45, { cast: false, recv: false });
[1, 4.5, 8].forEach(function (x) { box(scene, 0.12, 0.006, 3.1, M.markW, x, 0.045, 14.85, { cast: false, recv: false }); });
/* blue P sign */
(function () {
  var g = new T.Group(); g.position.set(0.6, 0.16, 17.35); scene.add(g);
  cyl(g, 0.03, 0.03, 1.1, 6, M.alu, 0, 0.55, 0);
  var b = box(g, 0.5, 0.5, 0.06, toon(0x2456c8), 0, 1.25, 0, { edge: true, edgeThresh: 30 });
  var t = ctex(64, 64, function (g2) {
    g2.fillStyle = '#2456c8'; g2.fillRect(0, 0, 64, 64);
    g2.fillStyle = '#fff'; g2.font = '900 48px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText('P', 32, 34);
  });
  b.material = new T.MeshBasicMaterial({ map: t });
})();

/* puddles */
var puddleZones = [];
function puddle(x, z, r, y, flat) {
  var geo = new T.CircleGeometry(1, 18);
  var pos = geo.attributes.position;
  for (var i = 1; i < pos.count; i++) {
    var s = rr(0.72, 1.28);
    pos.setX(i, pos.getX(i) * s);
    pos.setY(i, pos.getY(i) * s);
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  var m = new T.Mesh(geo, M.puddle);
  m.position.set(x, y, z);
  m.scale.set(r, 1, r * (flat || 0.8));
  m.receiveShadow = true;
  m.renderOrder = 1;
  scene.add(m);
  puddleZones.push({ x: x, z: z, r: r * 0.8, y: y });
  return m;
}
puddle(-7.5, 10.8, 2.0, 0.042);
puddle(-4.5, 15.0, 1.5, 0.042);
puddle(1.5, 11.5, 1.7, 0.042);
puddle(9.0, 14.6, 2.3, 0.042);
puddle(16.0, 12.0, 1.8, 0.042);
puddle(-18.5, 13.2, 2.4, 0.042);
puddle(-17.6, -3.5, 2.0, 0.042);
puddle(-15.8, 4.2, 1.4, 0.042);
puddle(-19.5, -12.0, 2.2, 0.042);
puddle(-7.2, 7.0, 1.1, 0.175);
puddle(9.8, 7.5, 1.0, 0.175);
puddle(2.4, 6.9, 0.8, 0.175);
puddle(18.0, 20.0, 1.4, 0.175);
puddle(-20.0, 19.0, 1.5, 0.175);
puddle(13.5, -5.0, 1.4, 0.115, 0.7);
puddle(12.6, 2.0, 0.9, 0.115, 0.7);
/* splash zones on bare road */
[[6, 13], [-14, 12.5], [-17, -8], [12, 10]].forEach(function (p) {
  puddleZones.push({ x: p[0], z: p[1], r: 1.2, y: 0.045, small: true });
});

/* =========================================================================
   STORE
   ========================================================================= */
var store = new T.Group();
scene.add(store);
LIT = 1;
/* floor / ceiling */
box(store, 22.3, 0.16, 17.3, toon(0xffffff, { map: floorTex }), 0.25, 0.16, -2.75, { cast: false });
var ceil = box(store, 22.3, 0.12, 17.3, M.ceil, 0.25, 3.06, -2.75, { cast: false, recv: false });
/* ceiling light panels */
var panelMat = new T.MeshBasicMaterial({ color: 0xfff6e2 });
[[-7, -8.5], [-7, -4], [-7, 0.5], [-7, 4.5], [0.25, -8.5], [0.25, -4], [0.25, 0.5], [0.25, 4.5], [7.5, -8.5], [7.5, -4], [7.5, 0.5], [7.5, 4.5]].forEach(function (p) {
  box(store, 2.0, 0.06, 0.95, panelMat, p[0], 2.99, p[1], { cast: false, recv: false });
});
LIT = 0;
/* walls */
box(store, 23, 4.7, 0.3, M.wallStore, 0.25, 2.35, -11.35);                       // back
box(store, 0.3, 4.7, 17.5, M.wallSide, 11.35, 2.35, -2.75);                      // right
box(store, 0.3, 4.7, 6.2, M.wallSide, -10.85, 2.35, -8.4);                       // left solid (back part)
box(store, 23, 0.45, 0.25, M.wallStore, 0.25, 0.225, 5.87, { cast: false });     // front spandrel
box(store, 23, 1.6, 0.3, M.wallStore, 0.25, 3.9, 5.87);                          // front header
/* left wall front part: spandrel + header only (glass zone between) */
box(store, 0.25, 0.45, 10.15, M.wallStore, -10.85, 0.225, -0.225, { cast: false });
box(store, 0.25, 1.6, 10.15, M.wallStore, -10.85, 3.9, -0.225, { cast: false });

/* front mullions + glass */
var mullXs = [-11, -8.6, -6.2, -3.6, -1.0, 1.6, 4.2, 6.8, 9.4, 11.5];
mullXs.forEach(function (x) {
  box(store, 0.14, 2.65, 0.16, M.alu, x, 1.775, 5.87);
});
for (var gi = 0; gi < mullXs.length - 1; gi++) {
  var x0 = mullXs[gi], x1 = mullXs[gi + 1];
  if (x0 <= -8.6 && x1 >= -6.2) continue; // door zone
  var w = x1 - x0 - 0.14;
  var gm = box(store, w, 2.6, 0.05, M.glass, (x0 + x1) / 2, 1.775, 5.87, { cast: false, recv: false });
  gm.renderOrder = 10;
}
/* left glass */
[-5, -2.5, 0, 2.5, 5].forEach(function (z) {
  box(store, 0.16, 2.65, 0.14, M.alu, -10.85, 1.775, z);
});
for (var gi2 = 0; gi2 < 4; gi2++) {
  var z0 = -5 + gi2 * 2.5, z1 = z0 + 2.5;
  var gm2 = box(store, 0.05, 2.6, 2.36, M.glass, -10.85, 1.775, (z0 + z1) / 2, { cast: false, recv: false });
  gm2.renderOrder = 10;
}
/* window decal */
(function () {
  var m = plane(store, 2.2, 0.55, new T.MeshBasicMaterial({ map: texOpen, transparent: true, opacity: 0.92 }), 1.0, 2.72, 5.92);
  m.renderOrder = 11;
})();

/* --- entrance automatic door (x -8.6 .. -6.2) --- */
var doorGroup = new T.Group();
store.add(doorGroup);
box(doorGroup, 2.7, 0.2, 0.24, M.alu, -7.4, 3.05, 5.9, { edge: true, edgeThresh: 30 });
box(doorGroup, 0.32, 0.14, 0.14, M.alu, -7.4, 3.2, 5.86);                 // sensor box
var entryLed = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), new T.MeshBasicMaterial({ color: 0x35d97c }));
entryLed.position.set(-7.4, 3.13, 5.95);
doorGroup.add(entryLed);
function doorPanel(px) {
  var g = new T.Group();
  g.position.set(px, 0, 0);
  box(g, 1.24, 0.16, 0.1, M.alu, 0, 2.9, 5.9);
  box(g, 1.24, 0.3, 0.1, M.alu, 0, 0.35, 5.9);
  var gl = box(g, 1.16, 2.3, 0.04, M.glass, 0, 1.68, 5.9, { cast: false, recv: false });
  gl.renderOrder = 10;
  box(g, 0.05, 0.9, 0.08, M.steel, -0.42, 1.5, 5.96);
  doorGroup.add(g);
  return g;
}
var panelL = doorPanel(-8.0);
var panelR = doorPanel(-6.8);
/* doormat outside + inside */
var matOut = box(store, 1.7, 0.03, 0.9, toon(0xffffff, { map: texMat }), -7.4, 0.175, 6.9, { cast: false });
box(store, 1.7, 0.03, 0.9, toon(0x35523f), -7.4, 0.25, 4.6, { cast: false });

/* --- awnings --- */
var awn = box(store, 23.0, 0.14, 1.7, toon(0x1c4a39), 0.25, 3.4, 6.85, { edge: true, edgeThresh: 30 });
box(store, 23.0, 0.42, 0.07, toon(0x173d30), 0.25, 3.16, 7.66);
box(store, 0.08, 0.5, 0.08, M.alu, -10.5, 3.1, 7.3, { cast: false });
box(store, 0.08, 0.5, 0.08, M.alu, 10.9, 3.1, 7.3, { cast: false });
var awnL = box(store, 1.7, 0.14, 10.6, toon(0x1c4a39), -11.75, 3.4, -0.05, { edge: true, edgeThresh: 30 });
box(store, 0.07, 0.42, 10.6, toon(0x173d30), -12.56, 3.16, -0.05);

/* --- fascia sign --- */
var fasciaMat = new T.MeshBasicMaterial({ map: texSign });
box(store, 23.4, 1.35, 0.5, toon(0x0c3628), 0.25, 4.55, 6.1, { edge: true, edgeThresh: 30 });
var signMesh = plane(store, 22.9, 1.18, fasciaMat, 0.25, 4.55, 6.37);
signMesh.renderOrder = 2;
plane(store, 0.5, 1.18, toon(0x0a2c20), -11.45, 4.55, 6.1, 0, Math.PI / 2);
/* blade sign by door */
(function () {
  var t = verticalSignTex('#0e3d2e', '#fff', ['営', '業', '中'], '24H');
  var m = box(store, 0.09, 1.3, 0.55, new T.MeshBasicMaterial({ map: t }), -5.95, 2.85, 6.45, { edge: true, edgeThresh: 30 });
  m.rotation.y = Math.PI / 2;
  cyl(store, 0.02, 0.02, 0.5, 6, M.alu, -5.95, 3.7, 6.0);
})();

/* --- roof --- */
/* unlit constant: the big flat roof must not pick up interior point light */
box(store, 22.3, 0.18, 17.3, new T.MeshBasicMaterial({ color: 0x56514a }), 0.25, 4.79, -2.75, { cast: false });
box(store, 22.6, 0.22, 0.2, M.wallStore, 0.25, 4.85, 6.0, { cast: false });
box(store, 22.6, 0.22, 0.2, M.wallStore, 0.25, 4.85, -11.5, { cast: false });
box(store, 0.2, 0.22, 17.6, M.wallStore, -11.05, 4.85, -2.75, { cast: false });
box(store, 0.2, 0.22, 17.6, M.wallStore, 11.55, 4.85, -2.75, { cast: false });
function acUnit(parent, x, y, z, ry) {
  var g = new T.Group();
  g.position.set(x, y, z); if (ry) g.rotation.y = ry;
  var b = box(g, 0.82, 0.62, 0.32, toon(0xd8dade), 0, 0.31, 0, { edge: true, edgeThresh: 30 });
  cyl(g, 0.2, 0.2, 0.05, 14, M.dark, 0, 0.36, 0.17, { rx: Math.PI / 2, cast: false });
  cyl(g, 0.07, 0.07, 0.3, 8, M.steel, -0.3, 0.1, -0.18);
  parent.add(g);
  return g;
}
acUnit(store, -5, 4.88, -4, 0);
acUnit(store, 4, 4.88, -7.5, 0.3);
cyl(store, 0.12, 0.12, 0.9, 8, M.steel, 8.5, 5.3, -9.5);
box(store, 1.0, 1.4, 0.85, toon(0x8d93a0), 8.5, 5.55, -10.8, { edge: true, edgeThresh: 30 });

/* --- interior: back wall fridges --- */
LIT = 1;
function fridgeUnit(x) {
  var g = new T.Group();
  g.position.set(x, 0.24, -10.7);
  box(g, 2.5, 2.35, 0.68, toon(0xe8ebef), 0, 1.175, 0, { edge: true, edgeThresh: 30 });
  box(g, 2.3, 0.28, 0.05, toon(0x0e6b4f), 0, 2.1, 0.36, { cast: false });
  box(g, 2.16, 1.8, 0.04, M.glassFridge, 0, 1.1, 0.36, { cast: false, recv: false }).renderOrder = 10;
  box(g, 2.16, 1.8, 0.02, new T.MeshBasicMaterial({ color: 0xdff2ff }), 0, 1.1, 0.05, { cast: false, recv: false });
  var band = plane(g, 2.3, 0.24, new T.MeshBasicMaterial({ color: 0xffffff }), 0, 2.1, 0.39);
  band.material = new T.MeshBasicMaterial({ map: boardTex(256, 40, '#0e6b4f', '#ffffff', ['きょうも いちばん しぼりたて'], 17) });
  g.add(band);
  store.add(g);
}
fridgeUnit(-8.4); fridgeUnit(-5.7); fridgeUnit(-3.0);
var bottleInst = new T.InstancedMesh(new T.CylinderGeometry(0.055, 0.055, 0.3, 8), toon(0xffffff), 96);
var bottleColors = [0xff6b6b, 0xffd23f, 0x7ddf7d, 0x5dc9e8, 0xf2f2f2, 0xff9ad5, 0x8f8ff0, 0x4dc98b];
(function () {
  var dummy = new T.Object3D(), col = new T.Color(), i = 0;
  [-8.4, -5.7, -3.0].forEach(function (fx) {
    for (var sh = 0; sh < 4; sh++) for (var b = 0; b < 6; b++) {
      if (i >= 96) return;
      dummy.position.set(fx - 1.0 + b * 0.4, 0.62 + sh * 0.42, -10.45);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bottleInst.setMatrixAt(i, dummy.matrix);
      bottleInst.setColorAt(i, col.setHex(pick(bottleColors)));
      i++;
    }
  });
  bottleInst.count = i;
  bottleInst.instanceMatrix.needsUpdate = true;
  if (bottleInst.instanceColor) bottleInst.instanceColor.needsUpdate = true;
})();
bottleInst.castShadow = false;
bottleInst.layers.enable(1);
store.add(bottleInst);
/* ice chest */
box(store, 1.9, 1.05, 0.8, toon(0xf2f4f7), 0.7, 0.76, -10.6, { edge: true, edgeThresh: 30 });
box(store, 1.7, 0.5, 0.06, M.glassFridge, 0.7, 1.06, -10.28, { cast: false, recv: false }).renderOrder = 10;
box(store, 1.7, 0.42, 0.02, new T.MeshBasicMaterial({ color: 0xeaf6ff }), 0.7, 1.08, -10.36, { cast: false, recv: false });

/* --- interior: back wall snack shelves --- */
var prodInst = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), toon(0xffffff), 420);
var prodCursor = 0;
var prodDummy = new T.Object3D();
var prodCol = new T.Color();
var prodPalette = [0xff6b6b, 0xffb84d, 0xffe66d, 0x7ddf7d, 0x5dc9e8, 0x8f8ff0, 0xff9ad5, 0xf2f2f2, 0x4dc98b, 0xe85d5d];
function putProd(x, y, z, sx, sy, sz, ry) {
  if (prodCursor >= 420) return;
  prodDummy.position.set(x, y, z);
  prodDummy.rotation.set(0, ry || 0, 0);
  prodDummy.scale.set(sx, sy, sz);
  prodDummy.updateMatrix();
  prodInst.setMatrixAt(prodCursor, prodDummy.matrix);
  prodInst.setColorAt(prodCursor, prodCol.setHex(pick(prodPalette)));
  prodCursor++;
}
function shelfRack(x, z, ry, w, levels, depth) {
  var g = new T.Group();
  g.position.set(x, 0.24, z); g.rotation.y = ry;
  store.add(g);
  g.updateWorldMatrix(true, false);
  box(g, w, 0.05, depth, M.white, 0, 0.02, 0, { cast: false });
  box(g, 0.05, 1.85, depth, M.white, -w / 2, 0.95, 0);
  box(g, 0.05, 1.85, depth, M.white, w / 2, 0.95, 0);
  box(g, w, 1.85, 0.04, toon(0xdcd6c8), 0, 0.95, -depth / 2 + 0.02, { cast: false });
  for (var s = 0; s < levels; s++) {
    var y = 0.38 + s * 0.44;
    box(g, w, 0.04, depth, M.white, 0, y, 0, { cast: false });
    box(g, w * 0.94, 0.05, 0.03, toon(0xfff8d8), 0, y + 0.04, depth / 2 - 0.02, { cast: false });
    var n = Math.floor(w / 0.16);
    for (var i = 0; i < n; i++) {
      var lx = (-w / 2 + 0.1) + i * (w - 0.2) / Math.max(1, n - 1);
      var wy = y + 0.14 + rr(0, 0.05);
      var wp = new T.Vector3(lx, wy, 0.02);
      g.localToWorld(wp);
      putProd(wp.x, wp.y, wp.z, 0.12, rr(0.16, 0.24), 0.1, ry + rr(-0.08, 0.08));
    }
  }
  return g;
}
shelfRack(2.8, -10.55, 0, 2.3, 4, 0.5);
shelfRack(5.4, -10.55, 0, 2.3, 4, 0.5);
/* hanging snack strips */
for (var hs = 0; hs < 5; hs++) {
  box(store, 0.09, 0.75, 0.02, toon(pick(prodPalette)), 2.1 + hs * 0.65, 2.45, -10.1, { cast: false });
  box(store, 0.03, 0.35, 0.03, M.alu, 2.1 + hs * 0.65, 3.0, -10.1, { cast: false });
}

/* --- interior: gondolas --- */
function gondola(x, z, ry, len) {
  var g = new T.Group();
  g.position.set(x, 0.24, z); g.rotation.y = ry;
  store.add(g);
  g.updateWorldMatrix(true, false);
  box(g, len, 0.06, 0.9, M.white, 0, 0.03, 0);
  box(g, 0.05, 1.5, 0.88, M.white, -len / 2, 0.78, 0);
  box(g, 0.05, 1.5, 0.88, M.white, len / 2, 0.78, 0);
  box(g, len, 1.5, 0.05, toon(0xe2ddd0), 0, 0.78, 0, { cast: false });
  for (var s = 0; s < 3; s++) {
    var y = 0.32 + s * 0.42;
    box(g, len, 0.04, 0.4, M.white, 0, y, 0.25, { cast: false });
    box(g, len, 0.04, 0.4, M.white, 0, y, -0.25, { cast: false });
    box(g, len, 0.045, 0.03, toon(0xfff8d8), 0, y + 0.045, 0.44, { cast: false });
    box(g, len, 0.045, 0.03, toon(0xfff8d8), 0, y + 0.045, -0.44, { cast: false });
    var n = Math.floor(len / 0.17);
    for (var i = 0; i < n; i++) {
      var lx = (-len / 2 + 0.12) + i * (len - 0.24) / Math.max(1, n - 1);
      var p1 = new T.Vector3(lx, y + 0.15 + rr(0, 0.04), 0.25);
      var p2 = new T.Vector3(lx, y + 0.15 + rr(0, 0.04), -0.25);
      g.localToWorld(p1); g.localToWorld(p2);
      putProd(p1.x, p1.y, p1.z, 0.13, rr(0.17, 0.25), 0.11, ry + rr(-0.1, 0.1));
      putProd(p2.x, p2.y, p2.z, 0.13, rr(0.17, 0.25), 0.11, ry + rr(-0.1, 0.1));
    }
  }
  /* top promo stack */
  box(g, 0.4, 0.24, 0.3, toon(0xe85d5d), -len / 4, 1.65, 0, { cast: false });
  box(g, 0.4, 0.18, 0.3, toon(0x5dc9e8), len / 4, 1.62, 0, { cast: false });
}
gondola(-6.2, -3.4, 0, 4.6);
gondola(-6.2, 0.9, 0, 4.6);
gondola(5.6, -3.2, Math.PI / 2, 4.2);

prodInst.count = prodCursor;
prodInst.instanceMatrix.needsUpdate = true;
if (prodInst.instanceColor) prodInst.instanceColor.needsUpdate = true;
prodInst.castShadow = false;
prodInst.layers.enable(1);
store.add(prodInst);

/* --- bento case (front right) --- */
(function () {
  var g = new T.Group(); g.position.set(4.9, 0.24, 4.35); store.add(g);
  box(g, 3.4, 0.55, 1.1, toon(0xf2f4f7), 0, 0.28, 0, { edge: true, edgeThresh: 30 });
  box(g, 3.4, 0.05, 1.1, new T.MeshBasicMaterial({ color: 0xeaf6ff }), 0, 0.6, 0, { cast: false });
  var gl1 = box(g, 3.3, 0.5, 0.04, M.glassFridge, 0, 0.85, 0.53, { cast: false, recv: false }); gl1.renderOrder = 10;
  box(g, 3.4, 0.06, 1.15, toon(0xd8dde5), 0, 1.12, 0);
  var bento = new T.InstancedMesh(new T.BoxGeometry(0.34, 0.12, 0.24), toon(0xffffff), 26);
  var onigiri = new T.InstancedMesh(new T.CylinderGeometry(0.1, 0.1, 0.16, 3), toon(0xf6f3ec), 14);
  var d = new T.Object3D(), c = new T.Color();
  for (var i = 0; i < 26; i++) {
    d.position.set(-1.45 + (i % 9) * 0.37, 0.72 + Math.floor(i / 9) * 0.0, 0.12 + Math.floor(i / 9) * 0.3 - 0.3 + 0.18);
    d.position.y = 0.72; d.position.z = 0.05 + Math.floor(i / 9) * 0.32;
    d.rotation.set(0, rr(-0.1, 0.1), 0); d.scale.set(1, 1, 1); d.updateMatrix();
    bento.setMatrixAt(i, d.matrix);
    bento.setColorAt(i, c.setHex(pick([0xffffff, 0xe85d5d, 0x2c2f3a, 0xffb84d, 0x7ddf7d])));
  }
  for (var j = 0; j < 14; j++) {
    d.position.set(-1.4 + (j % 7) * 0.42, 1.2, 0.1 + Math.floor(j / 7) * 0.3);
    d.rotation.set(0, rr(0, 3), 0); d.updateMatrix();
    onigiri.setMatrixAt(j, d.matrix);
  }
  bento.instanceMatrix.needsUpdate = true; if (bento.instanceColor) bento.instanceColor.needsUpdate = true;
  onigiri.instanceMatrix.needsUpdate = true;
  bento.castShadow = onigiri.castShadow = false;
  bento.layers.enable(1); onigiri.layers.enable(1);
  g.add(bento); g.add(onigiri);
})();

/* --- registers + coffee --- */
(function () {
  var g = new T.Group(); g.position.set(-3.2, 0.24, 4.5); store.add(g);
  box(g, 2.6, 0.95, 0.75, toon(0xded9cc), 0, 0.48, 0, { edge: true, edgeThresh: 30 });
  box(g, 2.6, 0.06, 0.85, toon(0x9aa2ae), 0, 0.98, 0);
  [[-0.6], [0.6]].forEach(function (p) {
    box(g, 0.34, 0.28, 0.3, toon(0x565e6b), p[0], 1.14, -0.1, { edge: true, edgeThresh: 30 });
    var sc = box(g, 0.3, 0.24, 0.03, new T.MeshBasicMaterial({ color: 0xbfe9d2 }), p[0], 1.35, 0.02, { cast: false });
    sc.rotation.x = -0.28;
  });
  /* coffee machine */
  box(g, 0.5, 0.75, 0.42, toon(0x4a3830), 1.05, 1.4, -0.05, { edge: true, edgeThresh: 30 });
  box(g, 0.36, 0.16, 0.06, new T.MeshBasicMaterial({ color: 0x2a2026 }), 1.05, 1.22, 0.17, { cast: false });
  box(g, 0.06, 0.06, 0.03, new T.MeshBasicMaterial({ color: 0xffb14d }), 1.2, 1.5, 0.17, { cast: false });
  cyl(g, 0.05, 0.04, 0.09, 8, M.white, 0.95, 1.13, 0.14, { cast: false });
  /* candy rack */
  var rack = new T.Group(); rack.position.set(2.0, 0, -0.4); g.add(rack);
  box(rack, 0.9, 1.5, 0.05, M.steel, 0, 0.75, 0);
  for (var s = 0; s < 4; s++) {
    box(rack, 0.85, 0.03, 0.22, M.steel, 0, 0.35 + s * 0.34, 0.1);
    for (var i2 = 0; i2 < 5; i2++) {
      box(rack, 0.13, 0.18, 0.03, toon(pick(prodPalette)), -0.32 + i2 * 0.16, 0.47 + s * 0.34, 0.2, { cast: false });
    }
  }
})();

/* --- oden counter (right back) --- */
(function () {
  var g = new T.Group(); g.position.set(10.35, 0.24, -7.2); store.add(g);
  box(g, 1.3, 1.0, 2.3, M.wood, 0, 0.5, 0, { edge: true, edgeThresh: 30 });
  box(g, 1.15, 0.35, 0.06, M.glassFridge, 0, 1.32, 1.0, { cast: false, recv: false }).renderOrder = 10;
  cyl(g, 0.48, 0.48, 0.3, 18, M.steel, 0, 1.14, 0.2);
  var broth = new T.Mesh(new T.CircleGeometry(0.44, 18), new T.MeshBasicMaterial({ color: 0xc97a2e }));
  broth.rotation.x = -Math.PI / 2; broth.position.set(0, 1.3, 0.2); g.add(broth);
  for (var i = 0; i < 6; i++) {
    var a = i * 1.05;
    cyl(g, 0.018, 0.018, 0.55, 5, toon(0xcdb28a), Math.cos(a) * 0.26, 1.42, 0.2 + Math.sin(a) * 0.26, { rz: rr(-0.2, 0.2), cast: false });
    g.children[g.children.length - 1].rotation.x = rr(-0.2, 0.2);
    var sp = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), toon(0xf2e8d8));
    sp.position.set(Math.cos(a) * 0.26, 1.52, 0.2 + Math.sin(a) * 0.26);
    g.add(sp);
  }
  box(g, 1.3, 0.5, 0.5, M.steel, 0, 1.24, -0.85, { edge: true, edgeThresh: 30 });   // steam case
  var st1 = glow(g, 0xffffff, 0, 1.7, -0.85, 0.9, 0.14);
  var st2 = glow(g, 0xffffff, 0.15, 1.9, -0.85, 0.7, 0.1);
  onUpdate(function (t) {
    st1.position.y = 1.7 + ((t * 0.35) % 0.7);
    st1.material.opacity = 0.16 * (1 - ((t * 0.35) % 0.7) / 0.7);
    st2.position.y = 1.85 + ((t * 0.28 + 0.4) % 0.6);
    st2.material.opacity = 0.12 * (1 - ((t * 0.28 + 0.4) % 0.6) / 0.6);
  });
})();

/* --- magazine rack + back door + storage --- */
(function () {
  var g = new T.Group(); g.position.set(10.9, 0.24, 1.6); g.rotation.y = -Math.PI / 2; store.add(g);
  box(g, 2.2, 1.7, 0.06, toon(0xcfc9bb), 0, 0.85, 0);
  box(g, 2.2, 0.04, 0.3, M.white, 0, 0.6, 0.15, { cast: false });
  box(g, 2.2, 0.04, 0.3, M.white, 0, 1.15, 0.15, { cast: false });
  for (var i = 0; i < 10; i++) {
    var mg = box(g, 0.17, 0.24, 0.02, toon(pick([0xff6b6b, 0x5dc9e8, 0xffe66d, 0x8f8ff0, 0xf2f2f2, 0xff9ad5])), -0.95 + i * 0.21, 0.74 + (i % 2) * 0.53, 0.19, { cast: false });
    mg.rotation.x = -0.12;
  }
  /* back door on right wall */
  box(store, 0.08, 2.1, 1.15, toon(0x8b93a0), 11.18, 1.29, -10.6, { edge: true, edgeThresh: 30 });
  box(store, 0.1, 0.24, 0.5, M.white, 11.1, 2.55, -10.6, { cast: false });
  var sg = plane(store, 0.55, 0.18, new T.MeshBasicMaterial({ map: boardTex(256, 64, '#39424f', '#fff', ['関係者以外 立入禁止'], 26) }), 11.1, 2.56, -10.6, 0, -Math.PI / 2);
  /* storage boxes */
  box(store, 0.6, 0.4, 0.5, toon(0xb09368), 10.4, 0.44, -9.7, { edge: true, edgeThresh: 30 });
  box(store, 0.5, 0.34, 0.44, toon(0xa08558), 10.45, 0.81, -9.72, { edge: true, edgeThresh: 30 });
})();
LIT = 0;

/* --- posters + hanging signs --- */
var swayGroup = [];
function hangPoster(x, z, tex) {
  var g = new T.Group(); g.position.set(x, 0, z); store.add(g);
  var m = plane(g, 0.78, 1.05, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }), 0, 2.12, 0);
  box(g, 0.84, 0.04, 0.04, M.alu, 0, 2.69, 0, { cast: false });
  tube(g, -0.36, 2.67, 0, -0.36, 2.95, 0, 0.012, M.dark);
  tube(g, 0.36, 2.67, 0, 0.36, 2.95, 0, 0.012, M.dark);
  g.userData.ph = rnd() * 6.28;
  swayGroup.push(g);
  return g;
}
hangPoster(-4.3, 5.35, posterTex('#ff7a5c', '#e8543a', '新発売', 'とろ〜り卵サンド'));
hangPoster(1.5, 5.35, posterTex('#4d8fd8', '#3a6fb8', 'セール', '20%OFF'));
hangPoster(7.9, 5.35, posterTex('#f2b23c', '#d89620', 'あったか〜い', 'おでん好評中'));
(function () {
  var g = new T.Group(); g.position.set(-3.0, 0, 5.45); store.add(g);
  box(g, 1.7, 0.62, 0.1, new T.MeshBasicMaterial({ map: boardTex(512, 192, '#0e3d2e', '#fff', ['24時間営業', 'MINAMI MART'], 62) }), 0, 2.58, 0, { edge: true, edgeThresh: 30 });
  tube(g, -0.7, 2.88, 0, -0.7, 3.0, 0, 0.015, M.dark);
  tube(g, 0.7, 2.88, 0, 0.7, 3.0, 0, 0.015, M.dark);
  g.userData.ph = 2; swayGroup.push(g);
  var g2 = new T.Group(); g2.position.set(-6.5, 0, -9.3); store.add(g2);
  box(g2, 0.9, 0.36, 0.08, new T.MeshBasicMaterial({ map: boardTex(256, 96, '#1f4f9e', '#fff', ['きょうの 飲料'], 40) }), 0, 2.6, 0);
  tube(g2, -0.35, 2.78, 0, -0.35, 2.98, 0, 0.012, M.dark);
  tube(g2, 0.35, 2.78, 0, 0.35, 2.98, 0, 0.012, M.dark);
  g2.userData.ph = 4; swayGroup.push(g2);
  var g3 = new T.Group(); g3.position.set(5.2, 0, 3.2); store.add(g3);
  box(g3, 0.9, 0.36, 0.08, new T.MeshBasicMaterial({ map: boardTex(256, 96, '#d8688a', '#fff', ['あたたかい お弁当'], 36) }), 0, 2.6, 0);
  tube(g3, -0.35, 2.78, 0, -0.35, 2.98, 0, 0.012, M.dark);
  tube(g3, 0.35, 2.78, 0, 0.35, 2.98, 0, 0.012, M.dark);
  g3.userData.ph = 5.2; swayGroup.push(g3);
})();
/* wall posters inside */
plane(store, 0.7, 0.95, new T.MeshBasicMaterial({ map: posterTex('#7dc46a', '#5aa84a', 'コーヒー', '100円'), side: T.DoubleSide }), 11.16, 2.2, -3.4, 0, -Math.PI / 2);
plane(store, 0.7, 0.95, new T.MeshBasicMaterial({ map: posterTex('#f2f2f2', '#39424f', 'アルコール', '20時から'), side: T.DoubleSide }), 11.16, 2.2, -4.6, 0, -Math.PI / 2);
/* floor guide */
(function () {
  var m = plane(store, 1.1, 1.1, new T.MeshBasicMaterial({ map: texGuide, transparent: true, opacity: 0.85 }), -7.3, 0.245, 2.9, -Math.PI / 2);
  m.rotation.z = Math.PI;
})();

/* interior lights */
function ptl(x, y, z, c, i, d) {
  var l = new T.PointLight(c, i, d, 2);
  l.layers.set(1);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}
ptl(-5, 2.75, -3, 0xffe9c8, 8, 20);
ptl(4.5, 2.75, -3, 0xffe9c8, 8, 20);
ptl(0, 2.7, 3.0, 0xfff1d9, 5.5, 15);
ptl(-5.7, 2.3, -9.4, 0xcfe8ff, 3.5, 8);
ptl(10.0, 1.8, -7.2, 0xffb35c, 2.5, 6);

/* (window glow bleed is produced by real interior lights; no sprite decals) */
/* =========================================================================
   ALLEY (between store & neighbors, x 11.5..15.5)
   ========================================================================= */
/* pipes on store right wall */
[[-4.2], [-5.4], [-6.6]].forEach(function (p) {
  cyl(scene, 0.05, 0.05, 3.6, 8, M.steel, 11.62, 1.96, p[0], { cast: false });
});
tube(scene, 11.62, 3.7, -4.2, 11.62, 3.7, -7.4, 0.05, M.steel);
box(scene, 0.3, 0.4, 0.16, toon(0x9aa0a8), 11.72, 1.6, -3.0, { edge: true, edgeThresh: 30 });
box(scene, 0.3, 0.4, 0.16, toon(0x9aa0a8), 11.72, 1.6, -3.5, { edge: true, edgeThresh: 30 });
acUnit(scene, 11.66, 2.4, -2.0, -Math.PI / 2);
/* neighbor alley-face items */
(function () {
  var g = new T.Group(); scene.add(g);
  /* vertical signs on neighbor's alley face */
  box(g, 0.12, 3.0, 0.5, new T.MeshBasicMaterial({ map: verticalSignTex('#1a3a8a', '#bfe0ff', ['カ', 'ラ', 'オ', 'ケ']) }), 15.56, 3.9, -4.5, { edge: true, edgeThresh: 30 });
  var snackG = new T.Group(); g.add(snackG);
  snackG.position.set(15.56, 0, 1.6);
  box(snackG, 0.12, 2.6, 0.5, toon(0x54123f), 0, 4.0, 0, { edge: true, edgeThresh: 30 });
  var letterMats = [];
  ['ス', 'ナ', 'ッ', 'ク'].forEach(function (ch, i) {
    var t = ctex(96, 96, function (g2) {
      g2.fillStyle = '#ff5fd0'; g2.fillRect(0, 0, 96, 96);
      g2.fillStyle = '#fff'; g2.font = '900 66px ' + F; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText(ch, 48, 52);
    });
    var lm = new T.MeshBasicMaterial({ map: t });
    var lmsh = plane(snackG, 0.44, 0.5, lm, 0.02, 4.92 - i * 0.55, 0.27);
    letterMats.push(lm);
  });
  /* flicker */
  letterMats.forEach(function (lm) { lm.userData.next = rr(1, 5); });
  onUpdate(function (t) {
    letterMats.forEach(function (lm) {
      if (lm.userData.dimUntil && t < lm.userData.dimUntil) return;
      if (lm.userData.dimUntil) { lm.color.setHex(0xffffff); lm.userData.dimUntil = 0; lm.userData.next = t + rr(1.5, 6); return; }
      if (t > lm.userData.next) { lm.color.setScalar(0.12); lm.userData.dimUntil = t + rr(0.08, 0.5); }
    });
  });
  /* lamp */
  var lampM = new T.MeshBasicMaterial({ color: 0xffe6b8 });
  box(g, 0.16, 0.1, 0.3, lampM, 15.42, 3.3, -7.6, { cast: false });
  glow(g, 0xffd9a0, 15.15, 3.2, -7.6, 1.6, 0.3);
  ptl(15.0, 3.0, -7.6, 0xffd9a0, 3.5, 7);
  /* poster on wall */
  plane(g, 0.7, 0.95, new T.MeshBasicMaterial({ map: posterTex('#8f8ff0', '#6a6ad8', 'ライブ', '今週末'), side: T.DoubleSide }), 15.34, 1.5, -6.4, 0, -Math.PI / 2);
  acUnit(g, 15.34, 2.5, -1.6, Math.PI / 2);
  tube(g, 15.42, 0.3, -8.6, 15.42, 4.6, -8.6, 0.04, M.steel);
  tube(g, 15.42, 4.6, -8.6, 15.42, 4.6, -6.0, 0.04, M.steel);
})();
/* junk */
cyl(scene, 0.35, 0.35, 0.85, 12, toon(0x3f5f8a), 13.4, 0.53, -13.5, { edge: true, edgeThresh: 30 });
(function () {
  var b1 = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), toon(0x26262e));
  b1.scale.set(1, 0.75, 1); b1.position.set(12.5, 0.28, -12.3); b1.castShadow = true; scene.add(b1);
  var b2 = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), toon(0x2c2c36));
  b2.scale.set(1, 0.72, 1); b2.position.set(12.2, 0.22, -11.7); b2.castShadow = true; scene.add(b2);
})();

/* =========================================================================
   NEIGHBOR BUILDINGS
   ========================================================================= */
/* A: front-right 2F (x 15.5..22, z -10..6, h 7.2) */
(function () {
  var g = new T.Group(); scene.add(g);
  box(g, 6.5, 7.2, 16, toon(0xcfc4b2), 18.75, 3.6, -2, { edge: true, edgeThresh: 25 });
  box(g, 6.7, 0.5, 16.2, toon(0xb5aa98), 18.75, 7.0, -2, { cast: false });
  /* 2F windows */
  [[16.8, 1], [19.0, 0], [21.2, 1]].forEach(function (p) {
    var lit = p[1] === 1;
    box(g, 1.2, 1.1, 0.08, toon(0x8d8577), p[0], 5.35, 6.02, { cast: false });
    plane(g, 1.05, 0.95, new T.MeshBasicMaterial({ color: lit ? 0xffd9a0 : 0x2a3448 }), p[0], 5.35, 6.06);
    if (lit) glow(g, 0xffd9a0, p[0], 5.35, 6.5, 2.2, 0.12);
  });
  /* 1F shutter + door */
  box(g, 3.4, 2.6, 0.1, toon(0x6d7480), 18.6, 1.54, 6.03, { edge: true, edgeThresh: 30 });
  for (var i = 0; i < 8; i++) box(g, 3.3, 0.04, 0.02, toon(0x5d6470), 18.6, 0.5 + i * 0.3, 6.1, { cast: false });
  plane(g, 0.7, 0.95, new T.MeshBasicMaterial({ map: posterTex('#d8b23c', '#b8922c', '貸しテナント', '募集中'), side: T.DoubleSide }), 17.0, 1.6, 6.1);
  box(g, 1.0, 2.2, 0.1, toon(0x4a4038), 21.2, 1.34, 6.03, { cast: false });
  box(g, 0.14, 0.1, 0.12, new T.MeshBasicMaterial({ color: 0xffe6b8 }), 20.6, 2.7, 6.05, { cast: false });
  glow(g, 0xffd9a0, 20.6, 2.6, 6.4, 1.2, 0.25);
  /* red lantern */
  var lan = cyl(g, 0.2, 0.2, 0.44, 12, new T.MeshBasicMaterial({ color: 0xd8453f }), 20.9, 2.3, 6.45, { cast: false });
  lan.scale.y = 0.85;
  var lt = ctex(64, 64, function (g2) {
    g2.fillStyle = '#d8453f'; g2.fillRect(0, 0, 64, 64);
    g2.fillStyle = '#fff'; g2.font = '900 44px ' + F; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText('酒', 32, 34);
  });
  plane(g, 0.3, 0.3, new T.MeshBasicMaterial({ map: lt, transparent: false }), 20.9, 2.3, 6.68);
  plane(g, 0.3, 0.3, new T.MeshBasicMaterial({ map: lt, transparent: false }), 20.9, 2.3, 6.22, 0, Math.PI);
  tube(g, 20.9, 2.55, 6.45, 20.9, 2.95, 6.45, 0.02, M.dark);
  glow(g, 0xff6a5a, 20.9, 2.3, 6.5, 1.6, 0.2);
  /* AC */
  acUnit(g, 16.6, 4.35, 6.16, 0);
  acUnit(g, 15.34, 2.6, -8.5, Math.PI / 2);
  /* roof stuff */
  cyl(g, 0.7, 0.7, 0.9, 14, toon(0x9aa4ae), 20.5, 7.7, -3);
  [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(function (p) {
    cyl(g, 0.05, 0.05, 0.5, 6, M.steel, 20.5 + p[0], 7.0, -3 + p[1], { cast: false });
  });
  cyl(g, 0.04, 0.04, 2.2, 6, M.dark, 17.0, 8.3, 2);
  [[0.9, 0], [0.6, 0.3], [0.35, -0.3]].forEach(function (p) {
    box(g, p[0] * 2, 0.04, 0.04, M.dark, 17.0, 8.3 + p[1] + 0.5, 2, { cast: false });
  });
  acUnit(g, 17.5, 7.25, -6, 0);
})();
/* B: back-right (x 15.5..22, z -22..-10, h 5.6) */
(function () {
  var g = new T.Group(); scene.add(g);
  box(g, 6.5, 5.6, 12, toon(0xb8ab9d), 18.75, 2.8, -16, { edge: true, edgeThresh: 25 });
  box(g, 6.7, 0.4, 12.2, toon(0xa3968a), 18.75, 5.6, -16, { cast: false });
  [[16.9, -13.5, 1], [16.9, -18.5, 0], [16.9, -15.9, 1]].forEach(function (p) {
    box(g, 0.08, 1.0, 1.1, toon(0x857a6e), 15.55, 3.4, p[1], { cast: false });
    plane(g, 0.95, 0.85, new T.MeshBasicMaterial({ color: p[2] ? 0xffd9a0 : 0x27304a }), 15.49, 3.4, p[1], 0, -Math.PI / 2);
    if (p[2]) glow(g, 0xffd9a0, 15.1, 3.4, p[1], 1.8, 0.1);
  });
  acUnit(g, 15.34, 2.5, -12.5, Math.PI / 2);
  tube(g, 15.42, 0.3, -16, 15.42, 4.4, -16, 0.04, M.steel);
})();
/* C: back-mid behind store (x -6..11.5, z -22..-11.5, h 6.6) */
(function () {
  var g = new T.Group(); scene.add(g);
  box(g, 17.5, 6.6, 10.5, toon(0xb2a898), 2.75, 3.3, -16.75, { edge: true, edgeThresh: 25 });
  box(g, 17.7, 0.45, 10.7, toon(0x9c9284), 2.75, 6.55, -16.75, { cast: false });
  /* windows on visible band above store roof */
  box(g, 1.2, 1.05, 0.1, toon(0x857a6e), -0.5, 5.9, -11.45, { cast: false });
  box(g, 1.2, 1.05, 0.1, toon(0x857a6e), 3.5, 5.9, -11.45, { cast: false });
  plane(g, 1.1, 0.95, new T.MeshBasicMaterial({ color: 0xffd9a0 }), -0.5, 5.9, -11.39);
  plane(g, 1.1, 0.95, new T.MeshBasicMaterial({ color: 0x2a3448 }), 3.5, 5.9, -11.39);
  glow(g, 0xffd9a0, -0.5, 5.9, -11.0, 2.0, 0.12);
  acUnit(g, 7.0, 6.7, -11.34, 0);
  /* east face (alley side) */
  plane(g, 1.0, 0.9, new T.MeshBasicMaterial({ color: 0x27304a }), 11.53, 3.6, -14, 0, Math.PI / 2);
  plane(g, 1.0, 0.9, new T.MeshBasicMaterial({ color: 0xffd9a0 }), 11.53, 3.6, -18, 0, Math.PI / 2);
  glow(g, 0xffd9a0, 11.9, 3.6, -18, 1.8, 0.1);
  tube(g, 11.58, 0.3, -15, 11.58, 5.6, -15, 0.04, M.steel);
})();
/* D: warehouse back-left (x -11..-6, z -22..-11.5, h 3.4) */
(function () {
  var g = new T.Group(); scene.add(g);
  box(g, 5, 3.4, 10.5, toon(0x8d8678), -8.5, 1.7, -16.75, { edge: true, edgeThresh: 25 });
  box(g, 5.2, 0.3, 10.7, toon(0x7a7466), -8.5, 3.5, -16.75, { cast: false });
  box(g, 2.2, 2.2, 0.1, toon(0x5d6470), -8.5, 1.34, -11.48, { cast: false });
  for (var i = 0; i < 7; i++) box(g, 2.1, 0.04, 0.02, toon(0x4d545e), -8.5, 0.4 + i * 0.3, -11.42, { cast: false });
  plane(g, 1.4, 0.4, new T.MeshBasicMaterial({ map: boardTex(320, 84, '#39424f', '#fff', ['南町倉庫'], 38) }), -8.5, 2.85, -11.42);
  box(g, 0.14, 0.1, 0.12, new T.MeshBasicMaterial({ color: 0xffe6b8 }), -9.8, 2.7, -11.45, { cast: false });
  glow(g, 0xffd9a0, -9.8, 2.6, -11.1, 1.2, 0.22);
  acUnit(g, -11.16, 1.2, -16, -Math.PI / 2);
  tube(g, -10.9, 0.3, -13.5, -10.9, 2.9, -13.5, 0.045, M.steel);
})();

/* =========================================================================
   PROPS
   ========================================================================= */
/* --- vending machines --- */
function vending(x, z, ry, bodyC, topC, label) {
  var g = new T.Group();
  g.position.set(x, 0.16, z); g.rotation.y = ry;
  box(g, 1.12, 1.85, 0.72, toon(bodyC), 0, 0.925, 0, { edge: true, edgeThresh: 30 });
  var face = plane(g, 1.0, 1.72, new T.MeshBasicMaterial({ map: vendTex(bodyC === 0xd8453f ? '#a83a34' : '#35599f', topC, label) }), 0, 0.95, 0.375);
  face.renderOrder = 2;
  box(g, 0.5, 0.16, 0.06, toon(0x2a2f38), 0, 0.35, 0.38, { cast: false });
  cyl(g, 0.09, 0.09, 0.5, 10, toon(0x39424f), 0, 0.5, 0.45, { rx: Math.PI / 2, cast: false });
  glow(g, 0xbfe9ff, 0, 1.3, 0.8, 1.1, 0.15);
  scene.add(g);
  return g;
}
vending(13.3, 7.0, 0, 0xd8453f, '#8a2c28', 'ドリンク');
vending(14.75, 7.0, 0, 0x3f6fd8, '#2c4f9e', 'コーヒー');
ptl(14.0, 1.5, 7.9, 0xbfe9ff, 3, 6);
streak(scene, 0xbfe9ff, 0.9, 3.6, 14.0, 0.06, 9.4, 0, 0.28);

/* --- bicycles --- */
function bike(x, z, ry, frameCol, lean) {
  var g = new T.Group();
  g.position.set(x, 0.16, z); g.rotation.y = ry;
  if (lean) g.rotation.z = lean;
  var fm = toon(frameCol);
  var tireM = toon(0x23252c);
  function wheel(wx) {
    var w = new T.Mesh(new T.TorusGeometry(0.3, 0.032, 8, 20), tireM);
    w.position.set(wx, 0.3, 0); g.add(w);
    cyl(g, 0.035, 0.035, 0.09, 8, M.steel, wx, 0.3, 0, { rz: Math.PI / 2, cast: false });
    for (var s = 0; s < 3; s++) {
      var sp = box(g, 0.56, 0.012, 0.012, toon(0x9aa0a8), wx, 0.3, 0, { cast: false });
      sp.rotation.z = s * 1.05;
    }
  }
  wheel(-0.52); wheel(0.52);
  tube(g, -0.52, 0.3, 0, -0.05, 0.34, 0, 0.024, fm);
  tube(g, -0.05, 0.34, 0, -0.18, 0.92, 0, 0.024, fm);
  tube(g, -0.05, 0.34, 0, 0.4, 0.88, 0, 0.024, fm);
  tube(g, -0.18, 0.9, 0, 0.4, 0.88, 0, 0.024, fm);
  tube(g, -0.52, 0.3, 0, -0.16, 0.88, 0, 0.02, fm);
  tube(g, 0.4, 0.88, 0, 0.52, 0.3, 0, 0.02, fm);
  tube(g, 0.4, 0.88, 0, 0.43, 1.02, 0, 0.02, fm);
  tube(g, 0.43, 1.02, -0.15, 0.43, 1.02, 0.15, 0.02, fm);
  box(g, 0.24, 0.05, 0.1, toon(0x2c2f3a), -0.18, 0.97, 0);
  if (frameCol !== 0xeae6dc) {
    box(g, 0.24, 0.17, 0.2, toon(0xcfd3da), 0.5, 0.78, 0, { cast: false });
  }
  scene.add(g);
  return g;
}
/* bike rack */
tube(scene, 16.4, 0.6, 6.35, 20.6, 0.6, 6.35, 0.035, M.steel);
[[16.4], [18.5], [20.6]].forEach(function (p) {
  cyl(scene, 0.035, 0.035, 0.45, 6, M.steel, p[0], 0.38, 6.35, { cast: false });
});
bike(16.9, 6.9, Math.PI / 2 + 0.06, 0xd8453f);
bike(18.4, 6.9, Math.PI / 2 - 0.04, 0x3f6fd8);
bike(19.9, 6.9, Math.PI / 2, 0xeae6dc);
bike(12.35, 3.4, 1.35, 0x4dc98b, 0.1);   // leaning in alley

/* --- utility poles + wires --- */
function pole(x, z, h) {
  var g = new T.Group();
  g.position.set(x, 0.16, z); scene.add(g);
  cyl(g, 0.13, 0.17, h, 10, toon(0x9aa0a8), 0, h / 2, 0, { edge: false });
  cyl(g, 0.3, 0.34, 0.5, 10, toon(0x8b919b), 0, 0.25, 0, { cast: false });
  return g;
}
var poleA = pole(20.8, 7.3, 7.4);
box(poleA, 1.7, 0.09, 0.09, M.dark, 0, 6.55, 0);
box(poleA, 1.7, 0.09, 0.09, M.dark, 0, 7.0, 0, { cast: false });
[[-0.6], [0], [0.6]].forEach(function (p) {
  cyl(poleA, 0.05, 0.05, 0.14, 6, toon(0x5a6270), p[0], 7.14, 0, { cast: false });
  cyl(poleA, 0.05, 0.05, 0.14, 6, toon(0x5a6270), p[0], 6.69, 0, { cast: false });
});
cyl(poleA, 0.26, 0.26, 0.6, 10, toon(0x8b919b), -0.25, 5.6, 0);
cyl(poleA, 0.26, 0.26, 0.6, 10, toon(0x8b919b), 0.3, 5.6, 0);
var poleB = pole(-12.1, -14, 7.0);
box(poleB, 1.5, 0.09, 0.09, M.dark, 0, 6.2, 0, { cast: false });
function wire(x1, y1, z1, x2, y2, z2, sag) {
  var mid = new T.Vector3((x1 + x2) / 2, (y1 + y2) / 2 - sag, (z1 + z2) / 2);
  var curve = new T.QuadraticBezierCurve3(new T.Vector3(x1, y1, z1), mid, new T.Vector3(x2, y2, z2));
  var geo = new T.TubeGeometry(curve, 16, 0.018, 4, false);
  var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0x191720 }));
  scene.add(m);
  return m;
}
var wy = 7.12, wy2 = 6.67;
wire(20.2, wy, 7.3, -11.5, wy, -14, 1.0);
wire(21.4, wy, 7.3, -12.7, wy, -14, 1.0);
wire(20.2, wy2, 7.3, -11.5, wy2, -14, 1.0);
wire(21.4, wy2, 7.3, -12.7, wy2, -14, 1.0);
wire(20.8, 6.6, 7.3, 19.0, 6.6, 4.6, 0.5);
wire(20.8, 6.6, 7.3, 18.9, 5.2, -11.5, 0.6);
wire(-12.1, 6.3, -14, -8.5, 3.3, -12.5, 0.4);

/* --- streetlights --- */
function streetlight(x, z, armDir, h, intensity, castSh) {
  var g = new T.Group();
  g.position.set(x, 0.16, z); scene.add(g);
  cyl(g, 0.09, 0.13, h, 10, toon(0x767e8a), 0, h / 2, 0, { edge: false });
  cyl(g, 0.26, 0.3, 0.45, 10, toon(0x676e7a), 0, 0.22, 0, { cast: false });
  var hx = armDir[0] * 1.5, hz = armDir[1] * 1.5;
  tube(g, 0, h - 0.05, 0, hx * 0.5, h + 0.35, hz * 0.5, 0.06, toon(0x767e8a));
  tube(g, hx * 0.5, h + 0.35, hz * 0.5, hx, h + 0.42, hz, 0.06, toon(0x767e8a));
  var head = box(g, 0.5, 0.16, 0.95, M.lampHead, hx, h + 0.38, hz, { cast: false });
  box(g, 0.4, 0.04, 0.8, new T.MeshBasicMaterial({ color: 0xffd9a6 }), hx, h + 0.29, hz, { cast: false });
  glow(g, 0xffd2a0, hx, h + 0.32, hz, 1.5, 0.26);
  var sp = new T.SpotLight(0xffd2a0, intensity, 26, 0.62, 0.45, 1.6);
  sp.position.set(hx, h + 0.3, hz);
  sp.target.position.set(hx * 1.6, 0, hz * 2.2);
  g.add(sp); g.add(sp.target);
  if (castSh) {
    sp.castShadow = true;
    sp.shadow.mapSize.set(1024, 1024);
    sp.shadow.camera.near = 1; sp.shadow.camera.far = 30;
    sp.shadow.bias = -0.0004;
  }
  return g;
}
streetlight(-3.5, 7.2, [0, 1], 6.4, 5.0, true);
streetlight(8.0, 20.8, [0, -1], 6.2, 3.0, false);
streetlight(-12.15, -6, [-1, 0], 6.2, 3.0, false);

/* --- traffic signals --- */
function trafficSignal(x, z, ry, phase) {
  var g = new T.Group();
  g.position.set(x, 0.16, z); g.rotation.y = ry; scene.add(g);
  cyl(g, 0.07, 0.09, 4.6, 8, toon(0x8f96a2), 0, 2.3, 0, { edge: false });
  cyl(g, 0.14, 0.16, 0.4, 8, toon(0x7d848f), 0, 0.2, 0, { cast: false });
  var head = box(g, 0.44, 1.34, 0.32, toon(0x2e3138), 0, 4.1, 0, { edge: true, edgeThresh: 30 });
  var back = box(g, 0.56, 1.46, 0.06, toon(0x23262c), 0, 4.1, -0.18, { cast: false });
  var lenses = {}, glows = {};
  [['R', 0.44, 0xff5252], ['Y', 0, 0xffd23f], ['G', -0.44, 0x51e08a]].forEach(function (p) {
    var lm = new T.MeshBasicMaterial({ color: 0x26262c });
    var lens = new T.Mesh(new T.CircleGeometry(0.13, 14), lm);
    lens.position.set(0, 4.1 + p[1], 0.17);
    g.add(lens);
    lenses[p[0]] = lm;
    glows[p[0]] = glow(g, p[2], 0, 4.1 + p[1], 0.45, 0.9, 0.55);
    glows[p[0]].visible = false;
    box(g, 0.32, 0.05, 0.2, toon(0x23262c), 0, 4.1 + p[1] + 0.15, 0.22, { cast: false });
  });
  var s = { lenses: lenses, glows: glows, phase: phase, mode: '', g: g };
  return s;
}
var sigN = trafficSignal(-12.15, 7.6, 1.05, 0);
var sigF = trafficSignal(-20.6, 18.2, 1.5, 8);
var strN_R = streak(scene, 0xff5a5a, 0.8, 5.5, -11.6, 0.05, 12.0, 0.25, 0);
var strN_G = streak(scene, 0x58e08a, 0.8, 5.5, -11.6, 0.05, 12.0, 0.25, 0);
var strF_R = streak(scene, 0xff5a5a, 0.8, 4.5, -20.0, 0.05, 15.3, -0.2, 0);
var strF_G = streak(scene, 0x58e08a, 0.8, 4.5, -20.0, 0.05, 15.3, -0.2, 0);
[strN_R, strN_G, strF_R, strF_G].forEach(function (s) { s.userData.isSignal = true; });
function setSigMode(s, m) {
  s.mode = m;
  s.lenses.R.color.setHex(m === 'R' ? 0xff5252 : 0x26262c);
  s.lenses.Y.color.setHex(m === 'Y' ? 0xffd23f : 0x26262c);
  s.lenses.G.color.setHex(m === 'G' ? 0x51e08a : 0x26262c);
  s.glows.R.visible = m === 'R';
  s.glows.Y.visible = m === 'Y';
  s.glows.G.visible = m === 'G';
}
onUpdate(function (t) {
  var c = (t * 0.85) % 16;
  var m = c < 6.5 ? 'G' : (c < 7.9 ? 'Y' : 'R');
  if (m !== sigN.mode) setSigMode(sigN, m);
  var c2 = (t * 0.85 + 8) % 16;
  var m2 = c2 < 6.5 ? 'G' : (c2 < 7.9 ? 'Y' : 'R');
  if (m2 !== sigF.mode) setSigMode(sigF, m2);
  strN_R.material.opacity = sigN.mode === 'R' ? 0.3 : (sigN.mode === 'Y' ? 0.1 : 0);
  strN_G.material.opacity = sigN.mode === 'G' ? 0.26 : 0;
  strF_R.material.opacity = sigF.mode === 'R' ? 0.3 : 0;
  strF_G.material.opacity = sigF.mode === 'G' ? 0.26 : 0;
});

/* --- convex mirror at corner --- */
(function () {
  var g = new T.Group(); g.position.set(-11.6, 0.16, 8.6); g.rotation.y = 0.9; scene.add(g);
  cyl(g, 0.04, 0.05, 2.3, 8, toon(0xd8b23c), 0, 1.15, 0);
  var back = new T.Mesh(new T.SphereGeometry(0.34, 16, 12), toon(0xff8c3a));
  back.scale.set(1, 1, 0.45); back.position.set(0, 2.25, -0.1); g.add(back);
  var mir = new T.Mesh(new T.SphereGeometry(0.31, 20, 14), new T.MeshStandardMaterial({ color: 0xcfe0ea, metalness: 1, roughness: 0.05, envMap: envTex, envMapIntensity: 1.6 }));
  mir.scale.set(1, 1, 0.4); mir.position.set(0, 2.25, 0.09); g.add(mir);
  var rim = new T.Mesh(new T.TorusGeometry(0.3, 0.035, 8, 20), toon(0xff8c3a));
  rim.position.set(0, 2.25, 0.12); g.add(rim);
})();

/* --- signs on left sidewalk --- */
(function () {
  var g = new T.Group(); g.position.set(-12.15, 0.16, 6.9); scene.add(g);
  cyl(g, 0.04, 0.05, 2.7, 8, M.steel, 0, 1.35, 0);
  var b = box(g, 1.3, 0.56, 0.07, new T.MeshBasicMaterial({ map: texStreetSign }), 0, 2.5, 0, { edge: true, edgeThresh: 30 });
  /* yellow warning sign */
  var g2 = new T.Group(); g2.position.set(-12.15, 0.16, 1.2); scene.add(g2);
  cyl(g2, 0.035, 0.04, 1.6, 8, M.steel, 0, 0.8, 0);
  var yt = ctex(128, 128, function (gc) {
    gc.fillStyle = '#ffd23f'; gc.beginPath();
    gc.moveTo(64, 6); gc.lineTo(120, 62); gc.lineTo(64, 118); gc.lineTo(8, 62);
    gc.closePath(); gc.fill();
    gc.strokeStyle = '#1a1a1a'; gc.lineWidth = 4; gc.stroke();
    gc.fillStyle = '#1a1a1a'; gc.font = '900 34px ' + F; gc.textAlign = 'center'; gc.textBaseline = 'middle';
    gc.fillText('徐行', 64, 66);
  });
  var yb = plane(g2, 0.52, 0.52, new T.MeshBasicMaterial({ map: yt, transparent: true }), 0, 1.85, 0.02);
  yb.rotation.y = -Math.PI / 2;
  var yb2 = plane(g2, 0.52, 0.52, new T.MeshBasicMaterial({ map: yt, transparent: true }), 0.02, 1.85, 0);
  yb2.rotation.y = 0;
  /* bulletin board */
  var g3 = new T.Group(); g3.position.set(-12.2, 0.16, 3.6); g3.rotation.y = -Math.PI / 2; scene.add(g3);
  cyl(g3, 0.045, 0.05, 1.9, 8, M.dark, -0.5, 0.95, -0.2);
  cyl(g3, 0.045, 0.05, 1.9, 8, M.dark, 0.5, 0.95, -0.2);
  box(g3, 1.3, 1.05, 0.08, toon(0x5f6a72), 0, 1.55, 0, { edge: true, edgeThresh: 30 });
  plane(g3, 1.14, 0.9, new T.MeshBasicMaterial({ map: texBulletin }), 0, 1.55, 0.05);
  box(g3, 1.4, 0.08, 0.12, toon(0x4a545c), 0, 2.12, 0, { cast: false });
})();

/* --- umbrella stand + trash --- */
(function () {
  var g = new T.Group(); g.position.set(-9.7, 0.16, 6.6); scene.add(g);
  cyl(g, 0.24, 0.28, 0.06, 12, M.dark, 0, 0.03, 0, { cast: false });
  tube(g, -0.2, 0.05, -0.2, -0.2, 0.62, -0.2, 0.02, M.steel);
  tube(g, 0.2, 0.05, -0.2, 0.2, 0.62, -0.2, 0.02, M.steel);
  tube(g, -0.2, 0.05, 0.2, -0.2, 0.62, 0.2, 0.02, M.steel);
  tube(g, 0.2, 0.05, 0.2, 0.2, 0.62, 0.2, 0.02, M.steel);
  var ring = new T.Mesh(new T.TorusGeometry(0.26, 0.018, 6, 18), M.steel);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.62; g.add(ring);
  var umCols = [0x3f6fd8, 0xd8453f, 0xffe66d];
  [[-0.08, 0.1], [0.02, 0.05], [0.1, -0.04]].forEach(function (p, i) {
    cyl(g, 0.035, 0.035, 0.85, 6, toon(umCols[i]), p[0], 0.42, p[1], { rx: rr(-0.06, 0.06), rz: rr(-0.06, 0.06), cast: false });
    cyl(g, 0.05, 0.02, 0.14, 6, toon(umCols[i]), p[0] + 0.03, 0.88, p[1], { cast: false });
  });
  /* trash bins */
  var g2 = new T.Group(); g2.position.set(-5.5, 0.16, 6.6); scene.add(g2);
  box(g2, 0.42, 0.95, 0.5, toon(0x2e5f46), -0.25, 0.48, 0, { edge: true, edgeThresh: 30 });
  box(g2, 0.42, 0.95, 0.5, toon(0x2e5f46), 0.25, 0.48, 0, { edge: true, edgeThresh: 30 });
  box(g2, 0.34, 0.03, 0.4, toon(0x1a1a20), -0.25, 0.96, 0, { cast: false });
  box(g2, 0.34, 0.03, 0.4, toon(0x1a1a20), 0.25, 0.96, 0, { cast: false });
  plane(g2, 0.2, 0.2, new T.MeshBasicMaterial({ map: boardTex(64, 64, '#f2f2f2', '#333', ['燃'], 40) }), -0.25, 0.62, 0.26);
  plane(g2, 0.2, 0.2, new T.MeshBasicMaterial({ map: boardTex(64, 64, '#f2f2f2', '#333', ['缶'], 40) }), 0.25, 0.62, 0.26);
})();

/* --- guardrails --- */
function guardrail(x1, z1, x2, z2) {
  var dx = x2 - x1, dz = z2 - z1;
  var len = Math.sqrt(dx * dx + dz * dz);
  var ang = Math.atan2(dx, dz);
  var n = Math.max(2, Math.round(len / 2.4) + 1);
  var postGeo = geoCyl(0.045, 0.05, 0.8, 8);
  var inst = new T.InstancedMesh(postGeo, toon(0xcfd4da), n);
  var d = new T.Object3D();
  for (var i = 0; i < n; i++) {
    var k = i / (n - 1);
    d.position.set(x1 + dx * k, 0.16 + 0.4, z1 + dz * k);
    d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = false;
  scene.add(inst);
  var cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  var r1 = box(scene, 0.075, 0.075, len, M.steel, cx, 0.16 + 0.44, cz, { ry: ang, cast: false });
  var r2 = box(scene, 0.075, 0.075, len, M.steel, cx, 0.16 + 0.68, cz, { ry: ang, cast: false });
  return [r1, r2];
}
guardrail(-21.6, -21.4, -21.6, -1.0);   /* gap where the left-road crosswalk lands */
guardrail(-21.6, 6.2, -21.6, 7.4);
guardrail(-21.0, 21.45, 21.4, 21.45);
/* corner pipe rail on island */
(function () {
  var g = new T.Group(); g.position.set(-12.15, 0.16, 9.1); scene.add(g);
  var arc1 = new T.Mesh(new T.TorusGeometry(1.15, 0.045, 6, 14, Math.PI * 0.55), M.steel);
  arc1.rotation.x = -Math.PI / 2; arc1.rotation.z = 1.15; arc1.position.y = 0.5; g.add(arc1);
  var arc2 = arc1.clone(); arc2.position.y = 0.74; g.add(arc2);
  [[0.95, 1.9], [1.95, 0.6]].forEach(function (p) {
    cyl(g, 0.04, 0.045, 0.75, 6, M.steel, Math.cos(p[1]) * p[0], 0.38, Math.sin(p[1]) * p[0], { cast: false });
  });
})();

/* --- parked kei van --- */
(function () {
  var g = new T.Group();
  g.position.set(2.9, 0.05, 14.8); g.rotation.y = Math.PI / 2 + 0.02;
  scene.add(g);
  var bodyM = toon(0xeae6dc);
  var b = box(g, 3.1, 0.95, 1.5, bodyM, 0, 0.72, 0, { edge: true, edgeThresh: 25 });
  var cab = box(g, 2.35, 0.62, 1.42, bodyM, -0.25, 1.5, 0, { edge: true, edgeThresh: 25 });
  box(g, 2.2, 0.36, 1.46, new T.MeshStandardMaterial({ color: 0x2a3448, metalness: 0.6, roughness: 0.15, envMap: envTex, envMapIntensity: 1.4 }), -0.25, 1.52, 0, { cast: false });
  box(g, 0.16, 0.18, 1.54, toon(0x39424f), 1.56, 0.42, 0, { cast: false });
  box(g, 0.16, 0.18, 1.54, toon(0x39424f), -1.56, 0.42, 0, { cast: false });
  box(g, 0.05, 0.12, 0.3, toon(0xe8e8d0), 1.58, 0.78, 0.45, { cast: false });
  box(g, 0.05, 0.12, 0.3, toon(0xe8e8d0), 1.58, 0.78, -0.45, { cast: false });
  box(g, 0.05, 0.12, 0.3, toon(0xd8453f), -1.58, 0.78, 0.45, { cast: false });
  box(g, 0.05, 0.12, 0.3, toon(0xd8453f), -1.58, 0.78, -0.45, { cast: false });
  box(g, 0.3, 0.14, 0.44, M.white, -1.6, 0.62, 0, { cast: false });
  [[1.05, 0.72], [1.05, -0.72], [-1.05, 0.72], [-1.05, -0.72]].forEach(function (p) {
    cyl(g, 0.3, 0.3, 0.2, 14, toon(0x1c1c22), p[0], 0.3, p[1], { rx: Math.PI / 2, cast: true });
    cyl(g, 0.14, 0.14, 0.22, 10, toon(0xb9bfc9), p[0], 0.3, p[1], { rx: Math.PI / 2, cast: false });
  });
  box(g, 0.06, 0.1, 0.14, toon(0x39424f), 0.55, 1.15, 0.78, { cast: false });
  box(g, 0.06, 0.1, 0.14, toon(0x39424f), 0.55, 1.15, -0.78, { cast: false });
})();

/* --- cat under the awning --- */
(function () {
  var g = new T.Group();
  g.position.set(11.2, 0.16, 6.8); g.rotation.y = -0.6;
  scene.add(g);
  var cm = toon(0x1d1d26);
  var body = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), cm);
  body.scale.set(1, 1.15, 0.85); body.position.y = 0.17; body.castShadow = true; g.add(body);
  var head = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), cm);
  head.position.set(0, 0.36, 0.05); g.add(head);
  [[-0.05], [0.05]].forEach(function (p) {
    var e = new T.Mesh(new T.ConeGeometry(0.035, 0.07, 4), cm);
    e.position.set(p[0], 0.44, 0.05); g.add(e);
  });
  var tail = new T.Mesh(new T.TorusGeometry(0.09, 0.022, 6, 12, 4.2), cm);
  tail.position.set(0, 0.12, -0.13); tail.rotation.x = 1.4; g.add(tail);
  g.userData.ph = rnd() * 6.28;
  onUpdate(function (t) {
    g.rotation.y = -0.6 + Math.sin(t * 0.4 + g.userData.ph) * 0.1;
  });
})();

/* =========================================================================
   WET FX: light pools, ripples, drips, rain
   ========================================================================= */
/* window light pools + streetlight streaks */
streak(scene, 0xffe9c8, 5.5, 6.5, -4, 0.04, 11.0, 0, 0.13);
streak(scene, 0xffe9c8, 5.5, 6.5, 4, 0.04, 11.0, 0, 0.13);
streak(scene, 0xffe9c8, 4.5, 5.5, -14.6, 0.04, 0.5, Math.PI / 2, 0.11);
streak(scene, 0xffd2a0, 1.0, 7.5, -3.5, 0.05, 13.5, 0, 0.32);
streak(scene, 0xffd2a0, 1.0, 6.0, -16.5, 0.05, -6, Math.PI / 2, 0.24);
streak(scene, 0xffd9a0, 0.9, 4.0, 8.0, 0.05, 18.6, 0, 0.2);
streak(scene, 0xff5fd0, 0.7, 3.5, 13.5, 0.12, -2.5, 0, 0.26);
streak(scene, 0xffe2b8, 1.7, 2.0, -7.4, 0.185, 7.6, 0, 0.0);   // door spill (animated)
var doorSpill = scene.children[scene.children.length - 1];
/* shimmer */
onUpdate(function (t) {
  for (var i = 0; i < scene.children.length; i++) {
    var c = scene.children[i];
    if (c.isMesh && c.userData.baseOp !== undefined && c !== doorSpill && !c.userData.isSignal) {
      c.material.opacity = c.userData.baseOp * (0.82 + 0.18 * Math.sin(t * 2.3 + c.userData.ph));
    }
  }
});

/* ripple rings */
var rippleGeo = new T.RingGeometry(0.85, 1.0, 26);
rippleGeo.rotateX(-Math.PI / 2);
var ripples = [];
for (var ri = 0; ri < 44; ri++) {
  var rm = new T.Mesh(rippleGeo, new T.MeshBasicMaterial({ color: 0xaecdff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  rm.visible = false; rm.renderOrder = 7;
  scene.add(rm);
  ripples.push({ m: rm, t0: 0, dur: 1, active: false, s0: 0.2, s1: 1.2 });
}
function spawnRipple(x, y, z, scale) {
  for (var i = 0; i < ripples.length; i++) {
    var r = ripples[i];
    if (!r.active) {
      r.active = true; r.t0 = clockT + rr(0, 0.1);
      r.dur = rr(0.7, 1.1);
      r.s0 = 0.1 * (scale || 1); r.s1 = rr(0.8, 1.3) * (scale || 1);
      r.m.position.set(x, y, z);
      r.m.visible = true;
      return;
    }
  }
}
var rippleAcc = 0;
onUpdate(function (t, dt) {
  rippleAcc += dt;
  while (rippleAcc > 0.045) {
    rippleAcc -= 0.045;
    var z = pick(puddleZones);
    var a = rnd() * 6.28, rd = Math.sqrt(rnd()) * z.r;
    spawnRipple(z.x + Math.cos(a) * rd, z.y, z.z + Math.sin(a) * rd * (z.small ? 1 : 0.85), z.small ? 0.45 : rr(0.7, 1.1));
  }
  for (var i = 0; i < ripples.length; i++) {
    var r = ripples[i];
    if (!r.active) continue;
    var k = (clockT - r.t0) / r.dur;
    if (k >= 1) { r.active = false; r.m.visible = false; continue; }
    var s = r.s0 + (r.s1 - r.s0) * k;
    r.m.scale.set(s, 1, s);
    r.m.material.opacity = 0.5 * (1 - k);
  }
});

/* drips */
var dripGeo = new T.CapsuleGeometry(0.028, 0.14, 3, 6);
var drips = [];
for (var di = 0; di < 22; di++) {
  var dm = new T.Mesh(dripGeo, new T.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false }));
  dm.visible = false; dm.renderOrder = 8;
  scene.add(dm);
  drips.push({ m: dm, active: false, vy: 0, ground: 0, next: 0 });
}
var dripEmitters = [];
for (var ax = -10.2; ax <= 10.8; ax += 2.1) dripEmitters.push({ x: ax, y: 3.02, z: 7.62, g: 0.17 });
for (var az = -4.6; az <= 4.6; az += 2.3) dripEmitters.push({ x: -12.5, y: 3.02, z: az, g: 0.17 });
dripEmitters.push({ x: 15.4, y: 5.0, z: 0.4, g: 0.12 });
dripEmitters.push({ x: 15.4, y: 5.0, z: -2.8, g: 0.12 });
dripEmitters.push({ x: 11.9, y: 6.5, z: -11.2, g: 0.12 });
dripEmitters.forEach(function (e) { e.next = rr(0.3, 3.5); });
onUpdate(function (t, dt) {
  dripEmitters.forEach(function (e) {
    e.next -= dt;
    if (e.next <= 0) {
      for (var i = 0; i < drips.length; i++) {
        var d = drips[i];
        if (!d.active) {
          d.active = true; d.vy = 0;
          d.m.position.set(e.x + rr(-0.05, 0.05), e.y, e.z + rr(-0.05, 0.05));
          d.ground = e.g;
          d.m.visible = true;
          break;
        }
      }
      e.next = rr(0.7, 3.2);
    }
  });
  drips.forEach(function (d) {
    if (!d.active) return;
    d.vy -= 22 * dt;
    d.m.position.y += d.vy * dt;
    if (d.m.position.y <= d.ground) {
      spawnRipple(d.m.position.x, d.ground + 0.004, d.m.position.z, 0.5);
      d.active = false; d.m.visible = false;
    }
  });
});

/* rain (GPU line segments) */
var RAIN_N = 1300, RAIN_H = 30;
var rainGeo = new T.BufferGeometry();
(function () {
  var base = new Float32Array(RAIN_N * 2 * 3);
  var info = new Float32Array(RAIN_N * 2 * 3);
  var pos = new Float32Array(RAIN_N * 2 * 3);
  for (var i = 0; i < RAIN_N; i++) {
    var bx = rr(-30, 30), bz = rr(-30, 30), ph = rnd(), spd = rr(13, 21), len = rr(1.5, 2.9);
    for (var v = 0; v < 2; v++) {
      var o = (i * 2 + v) * 3;
      base[o] = bx; base[o + 1] = bz; base[o + 2] = ph;
      info[o] = spd; info[o + 1] = len; info[o + 2] = v;
    }
  }
  rainGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  rainGeo.setAttribute('aBase', new T.BufferAttribute(base, 3));
  rainGeo.setAttribute('aInfo', new T.BufferAttribute(info, 3));
})();
var rainMat = new T.ShaderMaterial({
  uniforms: { uT: { value: 0 } },
  vertexShader: [
    'uniform float uT;',
    'attribute vec3 aBase;',
    'attribute vec3 aInfo;',
    'varying float vA;',
    'void main(){',
  '  float fall = mod(aBase.z * 97.0 + uT * aInfo.x, ' + RAIN_H + '.0);',
  '  vec3 p = vec3(aBase.x + fall * 0.11, ' + RAIN_H + '.0 - fall, aBase.y + fall * 0.05);',
  '  vec3 dir = normalize(vec3(0.11, -1.0, 0.05));',
  '  p -= aInfo.z * dir * aInfo.y;',
    '  vA = 1.0 - aInfo.z * 0.85;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n'),
  fragmentShader: [
    'varying float vA;',
    'void main(){',
    '  gl_FragColor = vec4(0.62, 0.72, 0.9, 0.36 * vA);',
    '}'
  ].join('\n'),
  transparent: true,
  blending: T.AdditiveBlending,
  depthWrite: false
});
var rain = new T.LineSegments(rainGeo, rainMat);
rain.frustumCulled = false;
rain.renderOrder = 15;
scene.add(rain);
onUpdate(function (t) { rainMat.uniforms.uT.value = t; });

/* glass rain overlay */
var glassRainMats = [];
function glassRainOverlay(w, h, x, y, z, ry, speed, op) {
  var t2 = texGlassRain.clone();
  t2.needsUpdate = true;
  t2.wrapS = t2.wrapT = T.RepeatWrapping;
  var m = new T.MeshBasicMaterial({ map: t2, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  var mesh = plane(scene, w, h, m, x, y, z, 0, ry);
  mesh.renderOrder = 12;
  glassRainMats.push({ mat: m, speed: speed });
  return mesh;
}
glassRainOverlay(10.5, 2.55, -5.5, 1.78, 5.93, 0, 0.07, 0.06);
glassRainOverlay(9.0, 2.55, 6.3, 1.78, 5.93, 0, 0.05, 0.05);
glassRainOverlay(2.4, 2.55, -10.9, 1.78, -0.05, Math.PI / 2, 0.06, 0.05);
onUpdate(function (t, dt) {
  glassRainMats.forEach(function (o) { o.mat.map.offset.y += dt * o.speed; });
});

/* =========================================================================
   DOOR ANIMATION
   ========================================================================= */
var doorState = { phase: 'closed', timer: rr(2.5, 5), amt: 0 };
onUpdate(function (t, dt) {
  var s = doorState;
  s.timer -= dt;
  if (s.phase === 'closed' && s.timer <= 0) { s.phase = 'opening'; s.timer = 0.9; }
  else if (s.phase === 'opening') { s.amt = Math.min(1, s.amt + dt / 0.9); if (s.amt >= 1) { s.phase = 'open'; s.timer = rr(2.2, 3.2); } }
  else if (s.phase === 'open' && s.timer <= 0) { s.phase = 'closing'; s.timer = 1.0; }
  else if (s.phase === 'closing') { s.amt = Math.max(0, s.amt - dt / 1.0); if (s.amt <= 0) { s.phase = 'closed'; s.timer = rr(5, 11); } }
  var e = s.amt * s.amt * (3 - 2 * s.amt);
  panelL.position.x = -8.0 - 1.12 * e;
  panelR.position.x = -6.8 + 1.12 * e;
  entryLed.material.color.setHex((s.phase === 'opening' || s.phase === 'closing') && (t * 6 % 2 < 1) ? 0xffd23f : 0x35d97c);
  if (doorSpill && doorSpill.material) doorSpill.material.opacity = 0.05 + 0.3 * e;
});

/* sign flicker */
var fasciaBase = fasciaMat.color.getHex();
onUpdate(function (t) {
  var f = 0.9 + 0.07 * Math.sin(t * 5.3) + 0.04 * Math.sin(t * 13.1);
  if (Math.sin(t * 3.1) > 0.995) f -= 0.35;
  fasciaMat.color.setScalar(Math.max(0.35, f));
});

/* poster sway */
onUpdate(function (t) {
  for (var i = 0; i < swayGroup.length; i++) {
    var g = swayGroup[i];
    g.rotation.z = Math.sin(t * 0.8 + g.userData.ph) * 0.035;
  }
});

/* =========================================================================
   LIGHTS (exterior)
   ========================================================================= */
scene.add(new T.HemisphereLight(0x46527d, 0x23202c, 0.55));
var moon = new T.DirectionalLight(0x7f93d9, 0.25);
moon.position.set(-18, 26, -8);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -30; moon.shadow.camera.right = 30;
moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30;
moon.shadow.camera.near = 2; moon.shadow.camera.far = 80;
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.03;
scene.add(moon);
scene.add(moon.target);

/* =========================================================================
   CAMERA CONTROLS (custom orbit: drag rotate, wheel zoom, right-drag pan)
   ========================================================================= */
var ctl = {
  target: new T.Vector3(-0.5, 1.6, 0.5),
  tTarget: new T.Vector3(-0.5, 1.6, 0.5),
  r: 62, tR: 50,
  phi: 1.0, tPhi: 1.0,
  theta: 0.62, tTheta: 0.62
};
function clampCtl() {
  ctl.tPhi = Math.max(0.18, Math.min(1.45, ctl.tPhi));
  ctl.tR = Math.max(13, Math.min(80, ctl.tR));
  ctl.tTarget.x = Math.max(-17, Math.min(17, ctl.tTarget.x));
  ctl.tTarget.y = Math.max(0.2, Math.min(9, ctl.tTarget.y));
  ctl.tTarget.z = Math.max(-17, Math.min(17, ctl.tTarget.z));
}
var panV1 = new T.Vector3(), panV2 = new T.Vector3(), panV3 = new T.Vector3();
function panBy(dx, dy) {
  var s = ctl.r * 0.0016;
  panV1.subVectors(ctl.target, camera.position); panV1.y = 0; panV1.normalize();
  panV2.crossVectors(panV1, panV3.set(0, 1, 0)).normalize().negate();
  ctl.tTarget.addScaledVector(panV2, -dx * s);
  ctl.tTarget.y += dy * s;
  clampCtl();
}
var pts = new Map();
var pinchD = 0;
canvas.addEventListener('pointerdown', function (e) {
  canvas.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
  pinchD = 0;
});
canvas.addEventListener('pointermove', function (e) {
  if (!pts.has(e.pointerId)) return;
  var p = pts.get(e.pointerId);
  var dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 1) {
    if (p.b === 2 || e.shiftKey) panBy(dx, dy);
    else {
      ctl.tTheta -= dx * 0.0052;
      ctl.tPhi -= dy * 0.0052;
      clampCtl();
    }
  } else if (pts.size === 2) {
    var arr = [];
    pts.forEach(function (q) { arr.push(q); });
    var dNow = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (pinchD > 0) ctl.tR *= pinchD / dNow;
    pinchD = dNow;
    panBy(dx * 0.5, dy * 0.5);
    clampCtl();
  }
});
function ptUp(e) { pts.delete(e.pointerId); pinchD = 0; }
canvas.addEventListener('pointerup', ptUp);
canvas.addEventListener('pointercancel', ptUp);
canvas.addEventListener('wheel', function (e) {
  e.preventDefault();
  ctl.tR *= Math.pow(1.0013, e.deltaY);
  clampCtl();
}, { passive: false });
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
/* debug hook for automated screenshots (not a UI element) */
window.__cam = function (theta, phi, r, tx, ty, tz, snap) {
  ctl.tTheta = theta; ctl.tPhi = phi; ctl.tR = r;
  ctl.tTarget.set(tx, ty, tz);
  clampCtl();
  if (snap) {
    ctl.theta = ctl.tTheta; ctl.phi = ctl.tPhi; ctl.r = ctl.tR;
    ctl.target.copy(ctl.tTarget);
  }
};
window.__dbg = { scene: scene, camera: camera, renderer: renderer };

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
var clock = new T.Clock();
var clockT = 0;
var firstFrame = true;
function updateCamera(dt) {
  var k = 1 - Math.exp(-dt * 6.5);
  ctl.r += (ctl.tR - ctl.r) * k;
  ctl.phi += (ctl.tPhi - ctl.phi) * k;
  ctl.theta += (ctl.tTheta - ctl.theta) * k;
  ctl.target.lerp(ctl.tTarget, k);
  var sp = Math.sin(ctl.phi);
  camera.position.set(
    ctl.target.x + ctl.r * sp * Math.sin(ctl.theta),
    ctl.target.y + ctl.r * Math.cos(ctl.phi),
    ctl.target.z + ctl.r * sp * Math.cos(ctl.theta)
  );
  camera.lookAt(ctl.target);
}
function step() {
  try {
    var dt = Math.min(clock.getDelta(), 0.05);
    clockT = clock.elapsedTime;
    for (var i = 0; i < updaters.length; i++) updaters[i](clockT, dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; canvas.classList.add('on'); }
  } catch (e) {
    if (!window.__sceneError) window.__sceneError = (e && (e.stack || e.message)) || String(e);
  }
}
renderer.setAnimationLoop(step);
/* keep animating in hidden/background tabs where rAF is throttled */
window.__renderOnce = step;
setInterval(function () { if (document.hidden) step(); }, 100);
})();
