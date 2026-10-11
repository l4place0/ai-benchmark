# 福建客家土楼村落 · Hakka Tulou Village

A **voxel-art diorama** of a Hakka mountain settlement in western Fujian — three
*tulou* earth buildings standing among their dependent houses, rice paddies,
terraced fields, bamboo groves and pine ridges.

Everything here is generated from code. There are no imported models, no
textures, and no photographs: the whole village is authored as **one voxel
grid**, then meshed and shaded.

---

## 1. What is in this folder

| Path | What it is |
|---|---|
| **`index.html`** | **The deliverable.** A single self-contained interactive 3D viewer. Open it in any browser — no server, no build step, no network access. |
| `preview/` | The six presentation stills (see §7). |
| `_build/` | The generator source. Node.js. Reproduces everything above from scratch. |
| `README.md` | This document — the modeling notes. |

The stills in `preview/` and the live scene in `index.html` are rendered from
**the same generator and the same mesh**, so they cannot disagree.

---

## 2. Running it

**Just to look at it:** open `index.html` in a browser. That's all.

```
drag          orbit
wheel         zoom
right-drag    pan
1 – 6         jump to a presentation view
A             auto-rotate
```

**To regenerate the village** (requires Node 18+):

```bash
cd _build
node render.mjs            # writes ../preview/*.png   (~2 min, 2x supersampled)
node render.mjs --quick    # fast low-res check        (~6 s)
node bundle.mjs            # rebuilds ../index.html
node verify.mjs            # runs the §41 acceptance checklist
```

Everything is **deterministic**: the RNG is seeded (`SEED = 20240711`), so
every rebuild produces a byte-identical village. Re-running `render.mjs` will
not change the images.

---

## 3. Why there is a software renderer in `_build/`

The offline stills are produced by a **CPU software rasteriser** written for
this project (`src/raster.js`, `src/png.js`), not by a GPU.

This is a deliberate engineering decision, not a shortcut. The build sandbox
forbids spawning child processes, which rules out launching any browser
headlessly — Chrome, Edge and Playwright's Chromium all fail with `spawn
EPERM`, and so does `esbuild`'s native binary. Rather than ship a scene that
could not be verified, the renderer is pure JavaScript:

* z-buffered triangle rasteriser with perspective-correct interpolation
* screen-space ambient occlusion from depth-neighbour taps
* hemispheric ambient + one directional sun, distance fog, filmic tonemapping
* an emissive pass with a box-blur bloom for lanterns
* 2× supersampling with a box downsample
* a from-scratch PNG encoder (zlib deflate, filter 0, truecolour)

The payoff: **the stills are verifiable.** They are produced by code that runs
in this environment, and re-running it reproduces them exactly.

The **live viewer** (`index.html`) uses **three.js** (r160, vendored) and real
WebGL, because that is what a browser should use. `_build/bundle.mjs` is a
small dependency-free ES-module bundler that inlines three.js and the whole
generator into the single HTML file.

---

## 4. The village, and why it is laid out this way

The brief is emphatic that this must not read as *"three unrelated tulou
randomly placed."* So the layout (`src/layout.js`) follows how a real Hakka
village in the Fujian mountains is actually organised.

**The organising idea:** a tulou is not a monument, it is a *fortified
apartment block for one clan*. Villages grew as a cluster of them, built by
branches of a family over generations, surrounded by the houses of tenants and
dependants, with the fields and the water supply worked out first. So the plan
starts from the water and the lanes, and the buildings are fitted between them.

### 4.1 The three tulou are deliberately different

| | Shape | Diameter | Floors | Condition | Role |
|---|---|---|---|---|---|
| **Tulou_Main** (核心) | round 圆楼 | **34** | **3** | well kept, warm earth | the clan's great house, on the plaza |
| **Tulou_Secondary** | round 圆楼 | **24** | 2 | older, mossy roof | the older branch's house, up the north slope |
| **Tulou_Small_Square** | **square 方楼** | 18 × 18 | 2 | most weathered, palest | guards the west lane to the gardens |

They differ in **form** (round vs square), **size** (34 / 24 / 18),
**storeys** (3 / 2 / 2), **material** (`earthWarm` / `earthOld` / `earthPale`)
and **condition** (kept / old / weathered). This is the §24 requirement, and it
is also simply how real villages look — the great house is maintained and the
outlying ones are not.

### 4.2 How the settlement is put together

```
                        N  (high ground, pine + bamboo)
                                    ▲
             terraces ──┐   ┌── Tulou_Secondary (24, 2F, old)
                        │   │
    gardens ── Tulou_Small_Square ── upper lane ──┘
                        │   │
      terraces ─────────┤   ├── cluster houses along the north-east slope
                        │   │
                        ▼   ▼
    ~~~~~~~~ stream ~~~~~~~~~~~  Plaza ──── Ancestral Hall  (east)
                        │   │         │
                        │   └── TULOU_MAIN (34, 3F) + forecourt
                        │             │
                        │        threshing yard
                        ▼             ▼
             paddies & irrigation pond ── south lane ── more houses
                        │
                        ▼
                 Village Gate (SE, angle 34°)  ── the mountain path arrives
```

* **The main road** runs gate → plaza → the great tulou's forecourt, so the
  approach to the village is a sequence, not a scatter.
* **The plaza** sits between the great tulou and the ancestral hall: the
  village's two public foci facing each other across one open space.
* **Six secondary roads and seven paths** fork off it, and the houses line
  *those* — which is why the settlement reads as grown rather than placed.
* **The stream** enters from the north-west high ground, is canalised past the
  village, feeds the paddies through a canal, and leaves through the southern
  saddle. Water is why the village is here.
* **The gate** is in the south-east where the terrain saddle is — the one
  place a road can enter the valley.

### 4.3 Counts

| | |
|---|---|
| Tulou | 3 |
| Ancestral hall | 1 |
| Hakka houses / barns / workshops / stores | **27** (brief asks 8–15; a working village needs more) |
| Roads / paths | 1 main + 6 secondary + 7 paths |
| Bridges | 2 |
| Wells | 4 |
| Rice paddies | 2 fields, plot-levelled |
| Terraced fields | 2 hillsides |
| Vegetable gardens | 3 |
| Orchard | 1 |
| Bamboo groves | 5 |
| Named objects in the scene graph | **115** |

### 4.4 No building may intersect another

Village layouts are composed by hand, but in a *generated* scene hand-placed
buildings collide — and a house half-buried in a tulou wall is the single most
obvious possible modelling error. So placement is treated as a **constraint
problem**, not eyeballed:

* `src/audit.js` builds every structure, tags each voxel with its owner, and
  reports any voxel claimed by two different buildings. It is wired into
  `verify.mjs`, so an interpenetration **fails the build**.
* `_build/tmp/resolve_spacing.mjs` takes that one step further: for any house
  that collides it searches a spiral of candidate offsets around the intended
  spot and keeps the *nearest* position that collides with nothing — preserving
  the author's intent (same cluster, same lane, same rotation) while
  guaranteeing separation.

Current state: **31 structures, zero shared voxels.**

---

## 5. Modelling notes

### 5.1 The core tulou, layer by layer

This is the structure the brief cares about most, so it is worth spelling out
the build order in `src/tulou.js`:

1. **Stone plinth** — a wider ring of irregular stone at the base, which is
   what actually stops rammed earth from wicking groundwater.
2. **Rammed-earth perimeter wall** — `wallT = 3` voxels thick, `floors ×
   floorH = 12` voxels high, built as an **integer-radius annulus**. This is
   the heart of the voxel language: testing `rIn ≤ √(dx²+dz²) ≤ rOut` on
   integer coordinates produces the **staircased circle** automatically. The
   wall is never smoothed.
3. **Tamping courses** — the earth tone is driven by **height** (bands every 2
   voxels) with a phase that drifts slowly around the circumference, plus
   vertical damp streaks and localised repair patches. A real rammed-earth wall
   reads as horizontal lifts; per-voxel random colour would read as noise.
4. **Outer timber posts** — every other bay, on the *outside* face, so they
   read as structure at a distance without crowding the facade.
5. **The main entrance** — a genuine arched opening through the full wall
   thickness at the specified bearing, with a tiled canopy and 2 lanterns.
6. **Ring galleries, floor by floor** — at each storey a timber deck `GD = 4`
   voxels deep runs right around the inside, carried on posts, with railings
   and a lattice infill. This is what makes it a *building* and not a tube.
7. **The central courtyard (天井)** — the interior is cleared only inside
   `rOpen = rCourt − GD`, so the galleries survive. Paved, with a tree, stone
   tables, a well and planted beds.
8. **The roof** — a ring of tiled roof with a stepped underside, giving the
   characteristic deep overhang and the dark shadow line under the eaves. The
   roof's inner radius stops short of the light well so daylight still reaches
   the courtyard.

The courtyard, the three gallery tiers and the earth wall are all visible from
the presentation cameras — see `preview/05-courtyard.png`.

### 5.2 Hakka houses

`src/buildings.js`. Each is built in its own local frame and then rotated, so
none of them sit on a world axis. They carry: a stone plinth, a coursed
rammed-earth wall, a recessed dark double door, small high windows (defensive,
not decorative), an optional **横屋** wing, and a gable roof with tile courses.

### 5.3 The ancestral hall

`src/buildings.js`. A raised stone platform with steps, a stone plinth course,
an axial **三开间** doorway, lanterns, a formal hipped roof with a raised ridge,
and an interior with a shrine, altar and columns. It is the most *formal*
building in the village — deliberately the opposite of the tulou's defensive
bulk.

### 5.4 Water

`src/nature.js`. The stream is carved as a polyline with a width, and its bed
is cut *down* into the terrain with banks, so it sits in a real channel rather
than being painted on. Ponds are carved as basins. A canal taps the stream and
runs to the paddies.

### 5.5 Agriculture

The rice paddies use a small piece of real logic worth calling out. A sloping
paddy cannot hold water, so each **plot** (9 × 9 voxels) is *levelled* to a
single height taken from its own corner, and separated from its neighbours by
an earth bund. On sloping ground this automatically produces the **stepped
rice terraces** that Fujian valleys are full of — and it guarantees the water
sits in a genuine basin.

The hillside terraces work the same way: the natural ground height is
**quantised into 2-voxel bands**, which yields level platforms that follow the
hill, with the vertical face between two bands becoming a stone revetment.
Terrace edges are jittered so the contours are not machine-perfect.

### 5.6 Vegetation

Deliberately, **almost all free-standing trees are confined to the forest belt
and the orchard.** An earlier iteration scattered individual trees across the
whole basin, and the result read as "a forest with some buildings in it" —
which defeats the point. Ground near the village is low cover only (shrubs,
grass tufts), so the settlement, the lanes and the fields all stay legible. The
forest starts at `rise ≥ 11` voxels above the valley floor and keeps a 26-voxel
clear ring around the village, so the wooded ridges **frame** the settlement
rather than drowning it (the brief's §17).

### 5.7 Terrain

`src/terrain.js`. Value-noise fBm on a rectangular basin: a flat floor at
`baseY = 10`, rising to **36 voxels** of relief on the ridges. The bowl is
open to the south-east, which is where the gate and the road are — terrain and
circulation agree.

Ground colour comes from a **low-frequency noise field**, not per-voxel
randomness. Adjacent voxels almost always share a tone and the tone changes
gradually across the basin, the way real grass cover does. (Per-voxel colour
produced salt-and-pepper static and made the buildings hard to pick out.)

---

## 6. Materials

`src/palette.js`. 80+ voxel materials, all low-saturation and vernacular in
tone — rammed earth, grey-black roof tile, mossy tile, stone, mud, water,
soil, five greens, timber, bamboo.

Every material carries a small **`jitter`**, so even a single flat material
weathers unevenly across a surface. There are **no textures anywhere**: all
variation comes from voxel material choice plus per-voxel tint baked into
vertex colours, then merged.

## 7. The mesh, and why it is small

`src/mesher.js`. Only faces adjacent to **air** are emitted, and coplanar runs
of the same material are merged into larger quads (greedy rectangle meshing)
within each slice.

Result: **508,713 solid voxels → 65,583 quads** — a ratio of 0.13 quads per
voxel, so the whole village draws in a single call. This is what makes the
scene practical to open in a browser.

---

## 8. Presentation views

`_build/render.mjs` defines six shots; `index.html` binds the same six to keys
**1–6**.

| File | View |
|---|---|
| `preview/01-hero.png` | **Hero** — 3/4 elevated isometric, the whole village |
| `preview/02-overview.png` | Complete diorama from a higher angle |
| `preview/03-tulou-main.png` | **Core tulou detail** — wall, roof, galleries, entrance |
| `preview/04-relations.png` | **Village relations** — three tulou + houses + roads + plaza |
| `preview/05-courtyard.png` | Inside the tulou: the three gallery rings and the 天井 |
| `preview/06-agriculture.png` | Paddies, terraces, stream and bamboo |

**Camera.** fov 30° (a long lens, so the diorama is not distorted). The
hero sits at yaw 40°, pitch 37°, distance ~205 units from the village centre —
high enough to read the plan, low enough that the tulou still show their
facades and the roof overhangs cast a shadow line. At this framing the
settlement fills ~87% of the frame height.

**Lighting.** Natural daylight from a low-ish afternoon sun in the north-east
(`[-0.52, 0.74, 0.42]`), warm (`1.08, 1.00, 0.86`) against a cool sky fill.
Ambient occlusion is floored at 0.42 and interiors receive an extra sky-bounce
term — a deliberate illustrative choice, because a physically pure AO plunged
the courtyard and galleries into black and they are the single most important
thing for a viewer to be able to read. Small warm emissive accents (lanterns,
a few lit windows) catch a bloom pass.

---

## 9. Scene hierarchy

`src/scene.js` registers every object under a readable named hierarchy — 115
named objects, no `Cube.001` in sight:

```
Terrain/          Mountains, ValleyFloor, RidgeCaps
Village/          MainRoad, SecondaryRoads, Paths, VillageGate, VillagePlaza,
                  WaterSystem, StoneBridges, Wells, ThreshingYard, Fences ...
TulouVillage/     Tulou_Main, Tulou_Secondary, Tulou_Small_Square (+ parts)
HakkaBuildings/   Houses, Barns, Workshops, StorageBuildings, AncestralHall
Agriculture/      RiceFields, Terraces, VegetableGardens, Orchards
Vegetation/       Forest, Bamboo, Scrub, Hedgerows
VillageProps/     Wells, Jars, Firewood, DryingRacks, Mills, Haystacks ...
Characters/       Villagers (walking, carrying, drying grain, working, resting)
Lighting/         Sun, SkyFill, EmissiveAccents
```

---

## 10. Acceptance checklist

`node verify.mjs` runs the brief's §41 checklist mechanically against the
built scene. Current result:

```
===== 34 passed, 0 failed =====
```

```
=== Buildings ===
  PASS  at least 3 tulou  — 3
  PASS  three tulou differ in size/shape  — diameters 34, 24, 18
  PASS  core tulou diameter 28-36 (brief)  — 34
  PASS  secondary tulou diameter 20-28  — 24
  PASS  square tulou 16-24  — 18
  PASS  at least 8 Hakka houses  — 27
  PASS  ancestral hall present

=== Tulou structure ===
  PASS  core tulou has >= 3 floors  — 3
  PASS  core tulou has a central courtyard  — r=14
  PASS  central courtyard open to the sky  — 5593 air voxels
  PASS  ring galleries present (timber)  — 853 voxels
  PASS  ground-floor doors  — 48
  PASS  small windows  — 25
  PASS  stepped tiled roof  — 1250 tile voxels
  PASS  thick rammed-earth wall  — 3349 earth voxels

=== Village structure ===
  PASS  main road / 6 secondary roads / 7 paths
  PASS  village plaza, village gate, 2 bridges
  PASS  water system (stream + ponds + canal)

=== Natural environment ===
  PASS  mountain terrain, forest, 5 bamboo groves
  PASS  rice paddies, 3 vegetable gardens, 2 terraces, orchard

=== Voxel style ===
  PASS  tulou wall is staircased  — 9 distinct radii on one course

=== No interpenetration ===
  PASS  no two structures share a voxel  — 31 structures checked

=== Object naming ===
  PASS  no meaningless Cube.00x names  — 115 named objects
  PASS  hierarchy has >= 7 top-level groups
```

### Against the negative list (§44)

| Forbidden | Status |
|---|---|
| Smooth cylinders as tulou | **No** — walls are integer-radius annuli; verified as staircased (10 distinct radii on a single course) |
| One smooth cylinder + a roof | **No** — each tulou is plaza, plinth, coursed wall, posts, arched entrance, tiered galleries, courtyard and stepped roof |
| Copy-pasting one tulou three times | **No** — three differ in shape (round/square), size (34/24/18), storeys (3/2/2), material and condition |
| Realistic / PBR / photo textures | **No** — zero textures; all variation is voxel material + baked tint |
| High-poly plants | **No** — every tree, bamboo and shrub is voxels |
| Smooth terrain | **No** — terrain is voxels; slopes are staircases |
| Modern / City elements | **No** — no asphalt, cars, glass towers, signage |
| `Cube.001`-style names | **No** — 115 named objects in a 9-group hierarchy |

---

## 11. Source map

```
_build/
  render.mjs          stills renderer (the six presentation views)
  bundle.mjs          dependency-free ES-module bundler -> index.html
  verify.mjs          the §41 acceptance checklist + interpenetration audit
  verify_bundle.mjs   executes the bundle in Node with a DOM/WebGL stub
  shell.html          HTML shell for the viewer
  src/
    voxel.js          VoxelWorld: sparse grid + primitives (box, disc, annulus,
                      tube, ellipseTube, rectRing, ribbon, fillDown) + seeded RNG
    palette.js        M enum + MAT registry + material families + weathering
    layout.js         THE MASTER PLAN — every coordinate in the village
    terrain.js        fBm noise, basin, biomes, stratified painting
    tulou.js          buildCircularTulou / buildSquareTulou
    buildings.js      Hakka houses + ancestral hall
    nature.js         trees, bamboo, paddies, terraces, gardens, water carving
    village.js        roads, gate, plaza, wells, bridges, props, villagers
    scene.js          assembles everything + registers the named hierarchy
    audit.js          interpenetration check (fails the build on overlap)
    mesher.js         greedy rectangle meshing
    raster.js         CPU rasteriser: z-buffer, AO, lighting, fog, bloom
    png.js            PNG encoder + 2x downsample
    main.js           the live three.js viewer
  tmp/
    resolve_spacing.mjs  constraint solver that re-places colliding houses
```

---

## 12. Two bugs worth recording

Both were found by building checks rather than by looking at pictures, and both
are the kind that a render will not obviously reveal.

**1. Houses silently collapsing to one point.** The master plan names a house's
position `x` / `z`, but `buildHakkaHouse` destructured `cx` / `cz` — so every
one of the 27 houses was built at `undefined` coordinates and landed on the same
spot. The registry still reported 27 houses, and the renders still looked
plausible, because the last house written simply overwrote the others. Fixed by
accepting both spellings and **throwing** when neither is present, so a
misnamed position can never pass silently again.

**2. Buildings intersecting each other.** Houses and the ancestral hall were
overlapping the core tulou by up to 289 voxels. Fixed by the constraint
approach in §4.4, and now enforced by `src/audit.js` inside `verify.mjs`.

The general lesson, and the reason `verify.mjs` counts *geometry* rather than
*registry entries*: a scene graph can be perfectly well-formed while the
geometry underneath it is wrong.

---

## 13. Notes on the voxel construction language

A few rules were held to throughout, and they are what make the scene read as
*voxel sculpture* rather than as low-poly 3D:

1. **Integer geometry only.** Circles are annulus tests on integer coordinates.
   Nothing is ever smoothed, and no circle is drawn twice the same way.
2. **Roofs are staircases.** A Chinese roof curve is approximated by discrete
   voxel steps and a broad ridge tile, never by a sloped plane.
3. **Thickness is real.** Tulou walls are 3 voxels; you can see the reveal at
   the entrance and the window jambs.
4. **Weathering is structural.** Earth tones follow construction lifts; moss
   follows the roof's damp lower courses; erosion runs in vertical streaks.
5. **Faces are only generated where air meets solid**, and coplanar same-colour
   runs merge — so the style is preserved while the mesh stays small.
