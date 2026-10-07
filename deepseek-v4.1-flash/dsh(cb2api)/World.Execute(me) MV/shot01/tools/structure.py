"""Detect precise vocal-phrase onsets (better than ASR segment boundaries),
then build the master timeline: sections, bars, phrases."""
import os, json
import numpy as np
import librosa

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(BASE, "audio", "song_48k.wav")
OUT = os.path.join(BASE, "analysis")
grid = json.load(open(os.path.join(OUT, "grid.json")))
PERIOD, OFF, DUR = grid["period"], grid["offset"], grid["duration"]
BPM = grid["bpm"]

y, sr = librosa.load(WAV, sr=22050, mono=True)
hop = 512
# harmonic separation helps isolate the vocal
y_h = librosa.effects.harmonic(y, margin=3.0)

# vocal-band energy (200-5000 Hz) on harmonic component
S = np.abs(librosa.stft(y_h, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
band = (freqs > 200) & (freqs < 5000)
vb = S[band].mean(axis=0)
t = librosa.frames_to_time(np.arange(len(vb)), sr=sr, hop_length=hop)

# smooth + normalize -> vocal activity curve
k = 5
vbs = np.convolve(vb, np.ones(k)/k, mode="same")
vn = (vbs - vbs.min())/(vbs.max()-vbs.min()+1e-9)

# ASR speech segments (union of word spans) -> used to gate activity
asr = json.load(open(os.path.join(OUT, "lyrics_asr.json")))
speech = np.zeros_like(vn)
for seg in asr:
    speech[(t >= seg["start"]-0.15) & (t <= seg["end"]+0.15)] = 1

np.save(os.path.join(OUT, "vocalact.npy"), vn)
np.save(os.path.join(OUT, "vocal_t.npy"), t)

# ---- section boundaries: pick by ASR silence gaps + energy + bar snapping ----
# Build "sung blocks" = maximal runs of speech
blocks = []
cur = None
for seg in asr:
    if "Thanks" in seg["text"]:
        continue
    if cur is None:
        cur = [seg["start"], seg["end"]]
    elif seg["start"] - cur[1] < 1.2:
        cur[1] = seg["end"]
    else:
        blocks.append(cur); cur = [seg["start"], seg["end"]]
if cur: blocks.append(cur)

print("=== vocal blocks (sung passages) ===")
for a, b in blocks:
    bar_a = (a - OFF)/PERIOD/4
    bar_b = (b - OFF)/PERIOD/4
    print(f"  {a:7.2f}s - {b:7.2f}s   (bar {bar_a:6.2f} .. {bar_b:6.2f})   len={b-a:5.2f}s")

# ---- Bar grid ----
n_bars = int((DUR - OFF)/(PERIOD*4))
bar_t = OFF + PERIOD*4*np.arange(n_bars)
print(f"\nbars={n_bars}  bar_len={PERIOD*4:.4f}s  last bar t={bar_t[-1]:.2f}s")

json.dump({"bpm": BPM, "period": PERIOD, "offset": OFF, "duration": DUR,
           "n_bars": n_bars, "bar_times": [round(float(x),4) for x in bar_t],
           "vocal_blocks": [[round(a,3), round(b,3)] for a,b in blocks]},
          open(os.path.join(OUT,"timeline.json"),"w"), indent=1)
print("saved timeline.json")
