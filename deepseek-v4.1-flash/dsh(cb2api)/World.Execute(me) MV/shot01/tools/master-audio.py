"""Build the final audio master for the MV.

Decisions:
  * The song is the film's spine -- we do NOT remix or cut it.
  * Source true peak measures +0.8 dBTP (inter-sample clipping), so a gentle
    true-peak limiter is a genuine fix, not a stylistic choice.
  * Target -14 LUFS integrated / -1.0 dBTP: standard for web delivery.
  * The film is 212.277 s and the last audio ends at 208.60 s, so the final
    ~3.7 s are real silence -- the film ends on that silence, as the song does.
"""
import os, subprocess, sys
import numpy as np
import soundfile as sf

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "audio", "song_48k.wav")
DST = os.path.join(BASE, "audio", "master_48k.wav")

# Two-pass loudnorm for an accurate, linear-ish result.
def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        print(p.stderr[-3000:]); sys.exit(1)
    return p.stdout + p.stderr

# ---- pass 1: measure ----
out = run(["ffmpeg", "-hide_banner", "-i", SRC,
           "-af", "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json",
           "-f", "null", "-"])
import json, re
m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", out, re.S)
if not m:
    print("could not parse loudnorm output"); print(out[-2000:]); sys.exit(1)
meas = json.loads(m.group(0))
print("measured:", {k: meas[k] for k in
      ("input_i","input_tp","input_lra","input_thresh","target_offset")})

# ---- pass 2: apply ----
af = (f"loudnorm=I=-14:TP=-1.0:LRA=11"
      f":measured_I={meas['input_i']}:measured_TP={meas['input_tp']}"
      f":measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}"
      f":offset={meas['target_offset']}:linear=true:print_format=summary")
run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", SRC,
     "-af", af, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", DST])

y, sr = sf.read(DST, always_2d=True)
print(f"master: {len(y)/sr:.3f}s  peak={np.abs(y).max():.5f}  rms={np.sqrt((y.mean(1)**2).mean()):.4f}")
print("wrote", DST)
