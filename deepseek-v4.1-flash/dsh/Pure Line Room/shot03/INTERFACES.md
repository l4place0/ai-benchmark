# Pure Line Room — object module interface

This is the authoritative contract for every file in `js/objects/`.
Read it fully before writing code. The engine files (`math.js`, `scene.js`,
`graphics.js`, `renderer.js`, `palette.js`, `state.js`, `audio.js`,
`interact.js`, `layout.js`, `build.js`, `main.js`) are **finished** — do not
edit them. Only create/replace the one file you are asked to write.

## 1. Coordinate system

Units are centimetres. `+Y` is up, `+X` is right, `+Z` points toward the front
of the room (toward the viewer's default camera).

```
x0 = -252  x1 = +252      (left / right wall)
y0 = 0     y1 = 286       (floor / ceiling)
z0 = -230  z1 = +430      (back wall / front wall)
```

Sizes of everything are in `js/layout.js` (`PLR.layout`). Read that file: use
`L.desk`, `L.window`, `L.sofa`, `L.bookcase`, … instead of hard-coded numbers so
the room stays consistent between modules.

## 2. Module shape

```js
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});
  var L = PLR.layout;

  PLR.objects.<name> = {
    id: '<name>',
    build: function (app) {
      var scene = app.scene;
      var state = app.state;
      var node = scene.group(scene.root, {
        name: 'window',            // unique node name
        p: [x, y, z],              // optional local transform
        yaw: 0, pitch: 0, roll: 0,
        s: [1, 1, 1],
        layer: 0,                  // optional draw-order bias
        behavior: { ... },         // optional; see §4
      });
      var g = node._g;             // the Graphics authoring object
      // ... build geometry with g ...
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

`scene.group(parent, opts)` attaches a node, creates its `Graphics` object as
`node._g`, runs `behavior.init(node, g, scene)` if a behavior is given, and
registers the node as a drawable solid. **Never construct
`new PLR.graphics.Graphics(x)` for a node other than the one receiving the
geometry** — always use `node._g`.

A module that builds several independent things should create one group per
thing (all parented to `scene.root` or to a shared parent group) so each can be
animated and picked separately.

## 3. Graphics (mesh authoring)

Every call is in the node's **local** space.

```js
g.v(x, y, z)                    // add a vertex, returns its id (number)
g.face([ids...], material, opts) // filled polygon; fill occludes things behind
                                 // opts: {name, hit, glow}
g.edge(a, b, material)          // a stroked line
g.ring([ids...], material)      // closed polyline of edges
g.polyline([ids...], material)  // open polyline
g.box(x0, y0, z0, x1, y1, z1, mats, edgeMat)
g.boxAt(cx, cy, cz, sx, sy, sz, mats, edgeMat)
g.prism(profileXY, z0, z1, mat, {capMat, caps, wallEdges, edgeMat, name})
g.lathe(profileRY, {segments, arc, mat, capMat, edges, edgeMat, meridians, name})
g.cylinder(cx, cy, cz, radius, height, {side, cap, segments, edges, edge})
g.panel(origin, du, dv, mat, {nu, nv, uvFn, edges, edgeMat, outline, name})
g.ringIds(centre, radius, axis, segments, phase)   // -> [ids]
g.disc(centre, radius, axis, mat, segments)
g.circleOutline(centre, radius, axis, mat, segments)
```

* `mats` for `box` is either one material name, or
  `{back, left, bottom, right, top, front, all, edge}` where `edge` sets the
  edge material for the whole box.
* `axis` is `'x' | 'y' | 'z'`.
* `panel(origin, du, dv, mat, opts)`: `du`/`dv` are vectors from the origin;
  `opts.uvFn(u, v, i, j) -> [x,y,z]` overrides the flat placement (use it for
  curved or wavy surfaces such as curtains and cloth). `mat` may be a function
  `(i, j, u, v) -> material` to vary each cell.
* `lathe` profile points are `[radius, y]`, ordered along Y.
* `prism` profiles are convex and given counter-clockwise in XY.

### Winding rule (critical)

A face is only drawn when its geometric normal — computed as
`cross(v1 - v0, v2 - v0)` — points **toward the camera**. So every face must be
wound counter-clockwise as seen from the side you want to be visible (the
outside of a solid, or the room-facing side of a surface). A backwards face is
silently dropped: this is the single most common mistake. Check every face you
write. `g.box` and `g.cylinder` already handle this for you.

### Lines vs fills

* Every face is filled with its material colour and occludes whatever was drawn
  before it (painter's algorithm, far to near).
* **Every face's outline is also stroked automatically**, in the face's
  material colour/weight. You do *not* need `g.edge` along a box.
* Use `g.edge`/`g.ring`/`g.polyline` only for genuine interior detail lines
  (floor boards, drawer reveals, book spines, wire outlines, hatching).
* Pick the right material for a line: `'sil'` for main contours, `'fine'` and
  `'hair'` for internal detail, `'hidden'` for construction lines, `'crease'`
  for soft interior edges.

## 4. Behaviours (interactive + animated objects)

```js
var behavior = {
  dynamic: true,                     // rebuild geometry from build() every frame
  init: function (node, g, scene) { /* author initial geometry */ },
  build: function (node, g, state, scene) { /* re-author geometry (dynamic) */ },
  update: function (dt, t, node, state, scene) { /* advance animation */ },
  post: function (node, renderer, scene) { /* immediate-mode detail + picking */ },
};
```

* `update` runs **before** transforms are recomputed, once per frame.
  Use it to advance your own eased state (`PLR.math.ease.damp`) and to write
  `node.tf.yaw` / `node.setTransform({...})`, then `node.touch()`.
* `build` (only when `dynamic !== false`) clears and re-authors the mesh every
  frame *after* transforms are current. Use it for geometry that genuinely
  changes shape (fan blades at an angle, steam, a swinging chime, blinds whose
  slats rotate). Static objects should omit `build` entirely so their mesh is
  authored once in `init`.
* `post` is where you draw immediate-mode detail in world space (clock hands,
  artwork, steam, glowing filaments) with `renderer.overlay(function (o) {...})`
  and where you register picking with `pr.hitRegion(renderer)`.
* Set `node.keyOverride` (a very negative number) only for things that must
  always draw first, like the room shell.

### Interaction proxy

Create it in `build` (not `init`) so the module can capture `app`:

```js
var pr = PLR.interact.make(scene, node, {
  id: 'blinds',                         // stable id, unique
  label: '百叶帘',                       // shown in the hover tag
  hit: 'main',                          // tag used for pickable faces
  hintDims: [w, h, d],
  enter: function (pr) { /* hover in  */ },
  leave: function (pr) { /* hover out */ },
  press: function (pr, down, ev) { /* pointer down/up */ },
  onClick: function (pr, ev) { /* toggle / advance */ },
  onDrag: function (pr, dx, dy, dt, ev) { return false; },  // optional
  update: function (pr, dt, time) { /* per-frame, e.g. easing visuals */ },
});
pr.setStatus('半开');                    // short state word for the hover tag
```

`PLR.interact.Act.list` holds every proxy; `Act.byId('blinds')` finds one.

Give an object's pickable faces `{hit: 'main'}` (or another tag) in `g.face(...)`
or via `g.box(..., {faces: {front: {m:'wood', hit:'main'}}, ...})`. Then, in
`post`, call `pr.hitRegion(renderer)` — that also draws the hover highlight and
the label tag. If a handler needs a finer target (e.g. one drawer out of three),
pass a tag: `pr.hitRegion(renderer, 'drawer2')` and branch on
`renderer.pick(x, y).face.hit` if you need to know which one.

## 5. Global state (`app.state` / `PLR.state`)

Read these; toggle them from `onClick`:

```
state.phase          0 = daylight … 1 = night (damped, read-only)
state.ch.room        damped room-light channel
state.ch.lamp        damped desk-lamp channel
state.ch.fan         damped ceiling-fan speed
state.ch.blinds      damped blinds-open channel (1 open, 0 closed)
state.ch.curtain     damped curtain channel
state.ch.record      damped turntable channel
state.lightOn, state.lampOn, state.fanOn, state.blindsOpen,
state.curtainOpen, state.recordOn              // booleans you may flip
state.toggleLight()  state.clock()  state.clockText()  state.seconds
```

Global state changes must be animated by damping (use `PLR.math.ease.damp`),
never snapped.

## 6. Audio (`PLR.audio`)

Call these from interaction handlers (they are safe no-ops before the first
user gesture):

```
PLR.audio.resume()        // call on the first click if unsure
PLR.audio.click()  tick(strong)  switchOn()  switchOff()  woodTap(pitch)
PLR.audio.drawerOpen()  drawerClose()  doorSwing(open)  blindRustle(open)
PLR.audio.curtainSweep(open)  chime(scaleIndex)  page(i)  lampSwitch(on)
PLR.audio.recordStart()  recordStop()  cupClink()  pour()
```

Reuse the closest existing sound rather than inventing new ones. If you need a
sound that does not exist, build it in your module with a local `AudioContext`
only as a last resort — and say so in your report.

## 7. Materials

Use only these palette keys (they exist in `js/palette.js`):

```
wall wallSide wallEx floor ceiling ceilingEx trim
white whiteSoft crease
wood woodDark woodGrain metal brass paper
fabric fabric2 rug glass dark leaf
ink fine hair sil hidden glow shadow screen accent lampOn
sky hillFar hillMid ground
```

Any face may override parts of a material with an object:
`{m: 'wood', fill: '#ffffff', stroke: '#101014', weight: 2.4, fillOpacity: 0.8}`.
Line weight is in world centimetres before the depth divide: `1.95` is the
standard edge, `2.5` a heavy silhouette, `1.35` a crease, `0.7` a hairline.

## 8. Style requirements

* Pure line-art look: white/near-white fills, dark strokes, generous negative
  space. No large solid black areas.
* Detail matters: drawer reveals, joints, handles, hinges, book spines, grain,
  stitching, rims, wires. An object should read as a drawing, not a block.
* Vary line weight by role: outline heavy, internal structure light.
* Proportions must be believable for real furniture (desk height ~74cm, seat
  ~45cm, sofa seat ~42cm, table ~40cm, ceiling 286cm).
* Everything must be *inside* the shell and must not interpenetrate other
  objects. Check `js/layout.js` and keep clear of the volumes listed there.
* Animations ease; nothing snaps. Use different speeds for different objects.

## 9. Definition of done for a module

1. `node _tools/preview.mjs _shots/<name>.png --day --time 6` renders with no
   entries in the `errors` array of its JSON output, and the object appears in
   the image where expected.
2. `node _tools/preview.mjs _shots/<name>-n.png --night --time 6` also looks
   correct (the palette flips to a dark room).
3. The object is clickable: its `post()` registers hit regions and `onClick`
   changes something visible over several frames.
4. No console warnings. No use of `console.log` left in the final file.
