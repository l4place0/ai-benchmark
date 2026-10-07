"""Authoritative orientation check for the delivered MV.

The earlier check compared the video against the renderer's own toDataURL output.
That was circular: both shared the same WebGL flip bug, so they agreed with each
other while both being upside down.

This version uses a ground truth that CANNOT be flipped by the same bug: the
lyric/UI text is drawn on the 2D scene canvas in normal top-down screen
coordinates, and specific sections have known asymmetric layouts:

  * BOOT   -- the boot log text is anchored near y=150..320 (TOP-LEFT)
  * COMPILE -- the "OBJECT CREATION" caption is near y=120 (TOP)
  * VOID   -- the "world.execute(me)" card is near H-220 (BOTTOM)

So we assert: the caption band for a section must be brighter than the opposite
band. If the film were flipped, every one of these tests inverts.
"""
import sys, os, json, subprocess
import numpy as np
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "out", "world.execute(me) - THE INSTRUMENT.mp4")
TMP = os.path.join(BASE, "frames", "_orient")

def grab(t):
    os.makedirs(TMP, exist_ok=True)
    p = os.path.join(TMP, f"t{t}.png")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", VID,
                    "-frames:v", "1", p], check=True)
    a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32) / 255
    return 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]

# (time, description, band that must be brighter, comparator band)
# "top" means rows 0..H/3, "bottom" means rows 2H/3..H
CASES = [
    (6.0,  "BOOT boot-log text sits at the top-left",      "top",    "bottom"),
    (18.0, "COMPILE 'OBJECT CREATION' caption at top",     "top",    "bottom"),
    (150.0,"VOID title card sits near the bottom",         "bottom", "top"),
]

print("=" * 72)
print("ORIENTATION CHECK (ground truth = 2D canvas top-down text placement)")
print("=" * 72)

ok = True
for t, desc, band, other in CASES:
    lum = grab(t)
    H = lum.shape[0]
    top = float(lum[:H//3].mean())
    bottom = float(lum[2*H//3:].mean())
    want = top if band == "top" else bottom
    cmp_ = bottom if band == "top" else top
    good = want > cmp_
    ok &= good
    print(f"\nt={t}s  {desc}")
    print(f"  top third    = {top:.4f}")
    print(f"  bottom third = {bottom:.4f}")
    print(f"  expected brighter: {band}  ->  {'PASS' if good else 'FAIL'}"
          f"  (delta {want-cmp_:+.4f})")

print("\n" + "=" * 72)
print("RESULT:", "ORIENTATION CORRECT" if ok else "ORIENTATION IS FLIPPED")
print("=" * 72)
sys.exit(0 if ok else 1)
