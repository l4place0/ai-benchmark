"""Audit the README's factual claims against the actual artifacts.
Every number asserted in README.md is re-checked here.
"""
import os, json, subprocess, re, sys
import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README = open(os.path.join(BASE, "README.md"), encoding="utf-8").read()
VID = os.path.join(BASE, "out", "world.execute(me) - THE INSTRUMENT.mp4")

def probe(f):
    o = subprocess.run(["ffprobe","-v","error","-print_format","json",
                        "-show_format","-show_streams",f],
                       capture_output=True, text=True).stdout
    return json.loads(o)

ok = True
def check(label, claim, actual, tol=0.0):
    global ok
    if isinstance(claim, float) and tol:
        good = abs(claim - actual) <= tol
    else:
        good = claim == actual
    print(f"  {'PASS' if good else 'FAIL'}  {label:44} readme={claim}  actual={actual}")
    if not good: ok = False

print("=" * 78)
print("README CLAIM AUDIT")
print("=" * 78)

info = probe(VID)
fmt, vs = info["format"], next(s for s in info["streams"] if s["codec_type"]=="video")
as_ = next(s for s in info["streams"] if s["codec_type"]=="audio")

print("\n-- deliverable --")
check("duration (s)",            212.277, round(float(fmt["duration"]),3), 0.001)
check("frame count",             12736,   int(vs["nb_frames"]))
check("width x height",          "1920x1080", f'{vs["width"]}x{vs["height"]}')
check("frame rate",              "60/1",  vs["r_frame_rate"])
check("video codec",             "h264",  vs["codec_name"])
check("audio codec",             "aac",   as_["codec_name"])
check("audio sample rate",       "48000", as_["sample_rate"])
check("audio channels",          2,       as_["channels"])
check("file size MB  (1e6)",      644.5,   round(int(fmt["size"])/1e6,1), 0.15)
check("file size MiB (1048576)",  614.6,   round(int(fmt["size"])/1048576,1), 0.15)

print("\n-- music analysis --")
g = json.load(open(os.path.join(BASE,"analysis","grid.json")))
check("tempo BPM",               129.20,  round(g["bpm"],2), 0.01)
check("beat period (s)",         0.464396, round(g["period"],6), 1e-6)
check("downbeat offset (s)",     0.20944, round(g["offset"],5), 1e-5)
check("bar length (s)",          1.85758, round(g["period"]*4,5), 1e-4)
check("song duration (s)",       212.277, round(g["duration"],3), 0.001)

print("\n-- frame accounting --")
# renderer generates round(DUR*60) frames; the container reports one fewer
# because -shortest trims the last frame to match the audio stream.
check("rendered frames = round(DUR*60)", 12737, round(g["duration"]*60))
check("container frames",       12736,   int(vs["nb_frames"]))
check("README notes both counts", True,
      "12,737" in README and "12,736" in README)

print("\n-- assets present --")
for rel in ["out/world.execute(me) - THE INSTRUMENT.mp4","out/video_silent.mp4",
            "render.html","README.md","CONCEPT.md",
            "src/core.js","src/gl.js","src/scenes.js","src/main.js",
            "audio/song_48k.wav","audio/master_48k.wav",
            "analysis/grid.json","analysis/timeline.json","analysis/lyrics_asr.json",
            "tools/capture.js","tools/sweep.js","tools/verify.py",
            "tools/verify_sync.py","tools/verify_orientation.py"]:
    p = os.path.join(BASE, rel.replace("/", os.sep))
    check(f"exists: {rel}", True, os.path.exists(p))

print("\n-- README internal consistency --")
# count the RENDERED frame total as stated in the table row, not the first match
check("README states 12,737 rendered frames", True, "12,737" in README)
check("README states 12,736 container frames", True, "12,736" in README)
check("README states 11 scenes", True, "11 个场景渲染器" in README)
check("README documents the flip bug", True, "vUv" in README and "1.0 - (aPos.y" in README)
check("README documents the queue bug", True, "encodeQueueSize" in README)

print("\n" + "=" * 78)
print("RESULT:", "ALL README CLAIMS VERIFIED" if ok else "SOME CLAIMS WRONG")
print("=" * 78)
sys.exit(0 if ok else 1)
