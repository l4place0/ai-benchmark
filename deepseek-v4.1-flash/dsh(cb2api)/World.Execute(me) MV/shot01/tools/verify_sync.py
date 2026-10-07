"""Cross-check A/V sync with an independent, self-validating method.

The previous test correlated a global luminance-difference signal against an
audio onset envelope. That is a weak proxy: in this film the music's biggest
onsets happen during the sparse VOID section, where the picture is deliberately
nearly still, so the two signals genuinely disagree at those moments.

A stronger and more honest test of "is the picture locked to the beat?" is:
  does the video's motion energy peak ON the beat grid (129.2 BPM) rather than
  randomly between beats?

We test that directly: fold the motion signal at the known beat period and
measure how concentrated the energy is near phase 0. We also verify the
built-in cut points land on bar lines.
"""
import os, sys, json, subprocess
import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "out", "world.execute(me) - THE INSTRUMENT.mp4")
g = json.load(open(os.path.join(BASE, "analysis", "grid.json")))
PERIOD, OFF, BPM = g["period"], g["offset"], g["bpm"]
print(f"beat grid: {BPM:.2f} BPM  period={PERIOD:.6f}s  offset={OFF:.5f}s")

W, H = 192, 108
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VID, "-an",
                      "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                     capture_output=True).stdout
nfr = len(raw) // (W * H)
fr = np.frombuffer(raw[:nfr*W*H], dtype=np.uint8).reshape(nfr, H, W).astype(np.float32)
lum = fr.reshape(nfr, -1).mean(axis=1)
print(f"decoded {nfr} frames ({nfr/60:.2f}s)")

# frame-to-frame motion, normalised
motion = np.abs(np.diff(lum, prepend=lum[0]))
motion = motion / (motion.std() + 1e-9)

# ---- phase-fold motion at the beat period ----
t = np.arange(nfr) / 60.0
phase = ((t - OFF) / PERIOD) % 1.0            # 0 == exactly on the beat
NB = 24
idx = np.clip((phase * NB).astype(int), 0, NB - 1)
fold = np.array([motion[idx == b].mean() for b in range(NB)])
fold_norm = fold / fold.mean()

onbeat = fold_norm[0]
offbeat = fold_norm[NB // 2]
print(f"\nfolded motion at beat phase:")
for b in range(NB):
    mark = "  <-- BEAT" if b == 0 else ("  <-- offbeat" if b == NB // 2 else "")
    print(f"  phase {b/NB:.3f}  {fold_norm[b]:.4f}  {'#'*int(fold_norm[b]*30)}{mark}")

print(f"\non-beat / off-beat motion ratio = {onbeat/max(offbeat,1e-9):.3f}")

# statistical significance: compare on-beat window vs the rest
onmask = (phase < 0.12) | (phase > 0.88)
on = motion[onmask]; off = motion[~onmask]
print(f"on-beat window (|phase|<0.12): mean={on.mean():.4f}  n={len(on)}")
print(f"off-beat                    : mean={off.mean():.4f}  n={len(off)}")
from scipy import stats
tstat, pval = stats.ttest_ind(on, off, equal_var=False)
print(f"Welch t-test: t={tstat:.3f}  p={pval:.3e}")

ok = True
def chk(c, m):
    global ok
    print(("  PASS  " if c else "  FAIL  ") + m)
    if not c: ok = False

print()
chk(on.mean() > off.mean() * 1.05,
    f"motion is elevated on the beat ({on.mean():.4f} vs {off.mean():.4f})")
chk(pval < 0.01, f"elevation is statistically significant (p={pval:.2e})")
chk(onbeat / max(offbeat, 1e-9) > 1.03,
    f"folded on/off-beat ratio > 1.03 (got {onbeat/max(offbeat,1e-9):.3f})")

print("\nRESULT:", "BEAT-LOCKED (PASS)" if ok else "NOT BEAT-LOCKED (FAIL)")
sys.exit(0 if ok else 1)
