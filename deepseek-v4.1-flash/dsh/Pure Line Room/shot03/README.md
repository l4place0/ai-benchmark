# Pure Line Room · 线稿房间

A single-page, fully offline interactive artwork: a room drawn entirely with
vector lines, which you can look around, walk up to, and operate — doors,
drawers, blinds, lamps, a sofa, a record player, a ceiling fan, a wind chime,
a wall clock that keeps your real local time.

Everything is generated at runtime from geometry and code. There are no
images, no 3D models, no audio files, no fonts, no CDN, no network access of
any kind.

## Running it

Open `index.html` in any modern browser. That is the whole installation:

```
shot03/index.html      ← double-click this
```

It works from `file://`, so no web server is needed. Sound starts on your first
click (browsers require a gesture before audio); press <kbd>M</kbd> to mute.

### Controls

| input | action |
|---|---|
| drag | turn your head (orbit the view) |
| wheel / <kbd>W</kbd> <kbd>S</kbd> | move closer / further back |
| arrow keys | fine look adjustment |
| click | operate whatever is under the pointer |
| drag a chair or the globe | move / spin it |
| <kbd>Tab</kbd> · <kbd>Shift</kbd>+<kbd>Tab</kbd> | step through every interactive object |
| <kbd>Enter</kbd> | operate the focused object |
| <kbd>R</kbd> | recentre the view |
| <kbd>M</kbd> | mute / unmute |

## What is in the room

Architecture: floor of boards, beamed ceiling, four walls with skirting and
cornice, a window opening cut into the back wall with a landscape outside, a
door opening in the left wall, a threshold.

Furniture and props: desk, desk chair, bookcase with books, sideboard with
drawers and cupboards, sofa with cushions and throw pillows, coffee table with
magazines, rug, desk lamp, mug, globe, wall clock, framed pictures, ceiling
fan, wind chime, wall light switch, and a turntable on the coffee table.

## Interactions

Every one of these is discovered by pointing at it: the object is outlined and
labelled while hovered, and clicking sets off an animation particular to that
object.

| object | what happens |
|---|---|
| door | swings open / shut on its hinge |
| cupboard doors | swing open / shut |
| drawers (3 on the sideboard) | slide out / in |
| venetian blind | open → blades shut → lifted, three states |
| curtain | drawn aside / closed |
| desk lamp | on / off, with a warm pool of light |
| wall light switch | the whole room changes from day to night and back |
| mug | hops, sloshes, and the steam thickens for a moment |
| desk chair | drag it across the floor |
| books | any volume slides out of the shelf and back |
| wall clock | keeps the real local time, sweeping second hand |
| turntable | spins up, tonearm drops, music bed fades in |
| globe | drag to spin it, with inertia |
| ceiling fan | spins up and coasts down, with motion blur at speed |
| wind chime | swings and rings, and sways gently all the time |
| framed pictures | tilt and settle back |
| sofa cushions & pillows | sink, then spring back |
| coffee table | a soft wooden knock and a settling bounce |
| rug | a corner flattens, fabric rustles |

## Always moving

Even with nobody touching it, the room is alive: the clock hands track the
real time, steam drifts off the mug, the ceiling fan and record keep turning
once started, the chime sways, curtains and rugs breathe very slightly, and
the camera itself has a slow handheld float.

## Day and night

The room follows your computer's local clock: it is day between 06:24 and
19:36 and night otherwise. The wall switch overrides it in either direction.
The change is global and damped — paper, ink, glass and the landscape outside
all shift, the ambient bed darkens, and the desk lamp becomes the brightest
thing in the frame.

## Sound

Synthesised live with the Web Audio API, with no samples: room tone, a fan
that rises in pitch with its speed, vinyl crackle and a slow pentatonic music
bed for the turntable, a sparse clock tick, plus one-shots for switches,
hinges, drawers, blinds, curtain rings, pages, crockery and the chime.

## How it is drawn

`js/renderer.js` is a small hidden-line renderer written for this piece:

* every face is a flat polygon with a material, filled with a near-white paper
  colour so it occludes whatever was drawn before it;
* faces are painted far to near, ordered by the distance from the camera to the
  face plane, which is exact for the convex boxes, panels and room shell that
  make up the scene;
* that same signed plane distance is the facing test — faces turned toward the
  camera are drawn crisp, the rest get a light construction stroke that shows
  only where nothing covers it;
* authored detail lines (floor boards, book spines, wires, stitching) are
  classified against the faces that share their endpoints: a line on the
  silhouette takes the heavy weight, one that is purely internal stays light,
  and one turned away becomes a faint construction line;
* stroke weight is a property of the material expressed in world units and
  divided by the face's depth, so a contour keeps its visual weight at any
  distance while perspective foreshortening still reads;
* all lines are pooled per (material, depth band) and emitted as a handful of
  paths rather than tens of thousands of single segments, which is what keeps a
  frame with ~8,400 visible faces interactive;
* geometry crossing the camera plane is clipped rather than dropped, which is
  what lets you stand anywhere in the room and look around.

## Layout of the source

```
index.html            the page
css/style.css         page chrome (there is almost none)
js/math.js            vectors, matrices, transforms, easing
js/scene.js           scene graph: transforms, children, meshes, behaviours
js/graphics.js        mesh authoring: boxes, prisms, lathes, panels
js/renderer.js        the hidden-line renderer, picking, overlays
js/palette.js         day and night material tables
js/state.js           global environment + device state
js/audio.js           procedural Web Audio engine
js/interact.js        hover / press / drag / focus layer
js/layout.js          one authoritative map of the room
js/objects/*.js       one module per object group (19 modules)
js/build.js           assembly order
js/main.js            boot, camera, animation loop
_tools/               development-only: offscreen renderer + test harness
INTERFACES.md         the contract the object modules are written against
```

## Verifying it

`_tools/` is not needed to run the piece — the artwork is `index.html` and `js/`
alone. It exists because this piece was built and checked in an environment
where no browser could be launched, so the harness runs the real client scripts
inside a Node VM against a recording canvas, replays that call stream through a
small software rasteriser, and inspects the result:

| command | what it proves |
|---|---|
| `node _tools/preview.mjs out.png --day` | renders a frame offscreen at any size/time |
| `node _tools/sheet.mjs out.png` | tiles six camera angles into one contact sheet |
| `node _tools/analyze.mjs --day` | per-solid screen coverage; flags anything that should be visible but draws nothing, anything off-plate, and over-inked regions |
| `node _tools/interact.mjs` | clicks, hovers and animates **every** interactive object and checks the picture actually changes |
| `node _tools/strict-boot.mjs` | drives ~2,700 frames plus every pointer, wheel, key and resize path, with a canvas/audio context that **throws** on any non-standard member |
| `node _tools/offline.mjs` | asserts there is no fetch/XHR/WebSocket, no external URL, no media or font binary anywhere in the tree |
| `node _tools/api-audit.mjs` | checks every Canvas2D and Web Audio member used against the real API surface |
| `node _tools/strays.mjs` | finds non-finite or absurd coordinates before they can erase a solid |
| `node _tools/visibility.mjs` | reports which solids fall outside the camera's frustum |

Final results on the committed state: 86 solids / 8,435 visible faces / 66
interactive objects, no build errors, no non-finite geometry, day and night both
render clean, every click and hover responds, and the piece is offline-clean.

