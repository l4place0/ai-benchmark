# world.execute(me); — procedural fan MV

Fan MV for Mili's *world.execute(me);*, generated entirely by code (three.js WebGL + Canvas 2D), rendered offline frame by frame.

## Result
| item | value |
|---|---|
| file | `out/world.execute(me)_procedural_MV_1080p60.mp4` (tracked by **Git LFS**, rule `out/*.mp4`) |
| video | 1920×1080, 60 fps, H.264 (x264 CRF16, yuv420p), 12,737 frames |
| audio | AAC 320k, source `audio/song.wav` (official upload, 48 kHz) |
| duration | 212.28 s (= full song) |
| render time | ~30 min (3 headless Chrome workers, GTX 960, ~7 fps total) |

## Concept
A simulation "boots" a girl out of 65,536 particles. Everything she becomes (lattice, sine wave, eggplant, tomato, cat, god's eye, switches, clock) is a particle morph synced to lyrics and beat (130 BPM).
Chorus = the simulation running. "You have left" = users disconnecting, memories garbage-collected.
"Illegal arguments / EXECUTION" = kernel panic, every object is killed. Ending = love as an equation, then the process exits and her points are released.

## Process
1. **Song analysis** — lyrics/theme/structure studied; synced LRC lyrics from lrclib; `tools/analyze.js` extracts 60 fps rms / onset / 5 bands / 32-bin spectrum + BPM (130.15) → `audio/analysis.json`.
2. **Assets** — AI-generated white line-art girl + face (2 images), Twemoji SVGs, one CC tabby photo (rendered as ASCII art), OFL fonts. Everything sampled into particle clouds (`src/shapes.js`).
3. **Scene** — `src/world.js` (particle morph schedule, shaders, wireframe polyhedra, per-section camera/FX), `src/overlay.js` (terminal/HUD/lyrics/dialogs/math overlay), `src/timeline.js` (lyrics + sections), `src/main.js` (EffectComposer: background → particles → bloom → overlay → CRT/RGB-split FX).
4. **Review loop** — `tools/snap.js` stills at ~40 timestamps → contact sheets. Fixed: dim particles (density-normalised brightness), blown-out chorus (nebula cap, lower kaleido/bloom), overlay projection bug, `dim(S)` counter timing.
5. **Render** — `tools/render.js`: deterministic `renderFrame(f)` per frame in headless Chrome (ANGLE/D3D11), canvas → JPEG → x264 segments of 600 frames (resumable), concat + audio mux with ffmpeg.

Notes: headless screenshots via CDP are ~1 s/frame, so frames are grabbed with `canvas.toDataURL` (~45 ms). Image-gen quota ran out after the two girl images, so remaining visuals are procedural / downloaded.

## Layout
- `src/` scene, shapes, overlay, timeline, entry
- `assets/` img, emoji, fonts
- `audio/` `song.wav`, `analysis.json`
- `tools/` analyze, render, snap, server, chrome finder, probe
- `out/` final MP4 (LFS)

Cleaned after delivery (all reproducible): `node_modules/`, `tools/browsers/` (Chrome for Testing), `tools/yt-dlp.exe`, `.cache/`, `package-lock.json`, `out/segments|snaps|sheets|*.log`.

## Re-render
Everything must stay inside this folder.
```powershell
$env:npm_config_cache="$PWD\.cache\npm"
npm install                                   # puppeteer-core, three, ffmpeg-static, ffprobe-static ...
node node_modules/ffmpeg-static/install.js    # fetch ffmpeg binary if postinstall skipped
# Chrome for Testing (v154, win64) -> tools/browsers/chrome/chrome-win64/chrome.exe
node tools/render.js --workers 3              # -> out/world.execute(me)_procedural_MV_1080p60.mp4
```
Preview: `node tools/server.js`, open `src/index.html?preview`; stills: `node tools/snap.js 31.8 62 ...`.

## Credits
- Music: Mili — "world.execute(me);" (all rights to Mili; non-commercial fan work)
- Twemoji (CC BY 4.0); tabby photo by Hisashi, Wikimedia (CC BY-SA 2.0)
- Fonts: JetBrains Mono, Orbitron, VT323, Cormorant Garamond, Share Tech Mono (SIL OFL)
- Line-art girl / face: AI-generated
- Lyric timing: lrclib.net
- Libraries: three.js, puppeteer-core, ffmpeg
