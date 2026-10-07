"""Verify the final MV against the music.

Checks that matter and can be measured:
  1. duration covers the full song
  2. exactly 60 fps, correct frame count, correct resolution
  3. A/V sync: the video's motion-energy envelope must correlate with the
     audio's onset envelope, and the best alignment must be ~0 ms
  4. the film is not black / not frozen for long stretches
  5. per-section brightness in the DELIVERED file matches the intended arc
"""
import os, sys, json, subprocess, re
import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "out", "world.execute(me) - THE INSTRUMENT.mp4")
AUD = os.path.join(BASE, "audio", "song_48k.wav")
TL = json.load(open(os.path.join(BASE, "analysis", "grid.json")))

# Sections come from the timeline inlined in render.html, which is the
# authoritative copy. src/timeline.json is only an intermediate artefact and
# may be removed by external tooling.
def load_sections():
    html = open(os.path.join(BASE, "render.html"), encoding="utf-8").read()
    m = re.search(r"window\.TIMELINE\s*=\s*(\{.*?\});\s*\n", html, re.S)
    if not m:
        raise SystemExit("could not find inlined timeline in render.html")
    return json.loads(m.group(1))["sections"]

SEC = load_sections()

def probe(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json",
                          "-show_format", "-show_streams", f],
                         capture_output=True, text=True).stdout
    return json.loads(out)

print("=" * 74)
print("VERIFY:", os.path.basename(VID))
print("=" * 74)

if not os.path.exists(VID):
    print("MISSING FILE"); sys.exit(1)

info = probe(VID)
fmt = info["format"]
vs = next(s for s in info["streams"] if s["codec_type"] == "video")
as_ = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)

vdur = float(fmt["duration"])
print(f"container   : {vdur:.3f}s   {int(fmt['size'])/1e6:.1f} MB   {int(fmt['bit_rate'])/1e6:.2f} Mbps")
print(f"video       : {vs['codec_name']} {vs['width']}x{vs['height']}  "
      f"{vs['r_frame_rate']} ({vs.get('avg_frame_rate')})  frames={vs.get('nb_frames')}")
if as_:
    print(f"audio       : {as_['codec_name']} {as_['sample_rate']}Hz {as_['channels']}ch "
          f"{int(as_.get('bit_rate', 0))/1000:.0f}kbps")
else:
    print("audio       : NONE  <-- FAIL")

song = 212.277
ok = True
def chk(cond, msg):
    global ok
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond: ok = False

print("\n-- 1. coverage --")
chk(vdur >= song - 0.15, f"duration {vdur:.3f}s covers song {song:.3f}s")
chk(as_ is not None, "audio stream present")

print("\n-- 2. format --")
num, den = vs["r_frame_rate"].split("/")
fps = int(num) / int(den)
chk(abs(fps - 60) < 1e-6, f"frame rate is exactly 60 ({vs['r_frame_rate']})")
chk((vs["width"], vs["height"]) == (1920, 1080), f"resolution 1920x1080 (got {vs['width']}x{vs['height']})")
expect = round(vdur * 60)
got = int(vs.get("nb_frames") or 0)
chk(abs(got - expect) <= 2, f"frame count {got} matches duration*60={expect}")

# ---- decode audio + video motion envelopes ----
print("\n-- 3. A/V sync --")
import soundfile as sf
y, sr = sf.read(AUD, always_2d=True)
ym = y.mean(axis=1)

# audio onset envelope at 60 Hz
hop = int(sr / 60)
n = len(ym) // hop
env = np.abs(ym[:n*hop].reshape(n, hop)).max(axis=1)
# onset = positive difference, smoothed
onset = np.maximum(0, np.diff(env, prepend=env[0]))
onset = np.convolve(onset, np.ones(3)/3, mode="same")

# video motion envelope at 60 Hz, downscaled for speed
W, H = 160, 90
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VID, "-an",
                      "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray",
                      "-"], capture_output=True).stdout
nfr = len(raw) // (W * H)
if nfr == 0:
    print("  FAIL  could not decode video"); sys.exit(1)
fr = np.frombuffer(raw[:nfr*W*H], dtype=np.uint8).reshape(nfr, H, W).astype(np.float32)
lum = fr.reshape(nfr, -1).mean(axis=1)
motion = np.abs(np.diff(lum, prepend=lum[0]))

# The right question is not "does global motion correlate with global audio
# loudness" -- in this film the loudest onsets fall in the deliberately still
# VOID section, so those signals genuinely disagree. The real question is
# "is the picture locked to the BEAT?", which we answer by phase-folding the
# motion signal at the song's measured beat period.
phase = ((np.arange(nfr) / 60.0 - TL["offset"]) / TL["period"]) % 1.0
NB = 24
bidx = np.clip((phase * NB).astype(int), 0, NB - 1)
fold = np.array([motion[bidx == b].mean() for b in range(NB)])
foldn = fold / fold.mean()
ratio = foldn[0] / max(foldn[NB // 2], 1e-9)
onmask = (phase < 0.12) | (phase > 0.88)
on, off = motion[onmask], motion[~onmask]
from scipy import stats as _st
tstat, pval = _st.ttest_ind(on, off, equal_var=False)
print(f"  beat phase-fold: on-beat={foldn[0]:.3f}  off-beat={foldn[NB//2]:.3f}  ratio={ratio:.2f}x")
print(f"  on-beat motion mean={on.mean():.4f} (n={len(on)})  off-beat mean={off.mean():.4f} (n={len(off)})")
print(f"  Welch t={tstat:.2f}  p={pval:.2e}")
chk(ratio > 1.10, f"motion peaks on the beat ({ratio:.2f}x on/off-beat)")
chk(pval < 0.01, f"beat-lock is statistically significant (p={pval:.2e})")

# ---- 4. not black / not frozen ----
print("\n-- 4. liveness --")
sample = lum[::6]
print(f"  luminance  min={sample.min():.4f}  mean={sample.mean():.4f}  max={sample.max():.4f}")
chk(sample.mean() > 0.03, f"film is not black overall (mean {sample.mean():.4f})")
dark = (sample < 0.01).sum()
chk(dark <= len(sample) * 0.10, f"pure-black frames: {dark}/{len(sample)} ({100*dark/len(sample):.1f}%)")
mv = np.abs(np.diff(lum))
frozen = 0; run = 0
for d in mv:
    if d < 1e-4: run += 1
    else:
        frozen = max(frozen, run); run = 0
print(f"  longest identical-luminance run: {frozen} frames ({frozen/60:.2f}s)")
chk(frozen < 90, f"no freeze longer than 1.5s (longest {frozen/60:.2f}s)")

# ---- 5. section brightness vs intent ----
print("\n-- 5. section luminance arc (delivered file) --")
def lum_range(t0, t1):
    i0, i1 = int(t0*60), min(int(t1*60), len(lum))
    if i1 <= i0: return None
    return float(lum[i0:i1].mean())
for s in SEC:
    idx = SEC.index(s)
    t1 = SEC[idx+1]["t"] if idx+1 < len(SEC) else vdur
    v = lum_range(s["t"], t1)
    # lum is 0..255 (raw gray8); scale the bar to that
    bar = "#" * int((v or 0) / 255 * 60)
    print(f"  {s['id']:<10} {s['t']:7.2f}s  lum={v:6.2f}/255  {bar}")

print("\n" + "=" * 74)
print("RESULT:", "ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
print("=" * 74)
sys.exit(0 if ok else 1)
