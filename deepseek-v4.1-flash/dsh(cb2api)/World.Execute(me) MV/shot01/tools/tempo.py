"""Determine true tempo by autocorrelation + check against musical bar structure."""
import os, json
import numpy as np
import librosa

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(BASE, "audio", "song_48k.wav")
OUT = os.path.join(BASE, "analysis")
y, sr = librosa.load(WAV, sr=22050, mono=True)
DUR = len(y)/sr
hop = 512
oe = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
t = librosa.frames_to_time(np.arange(len(oe)), sr=sr, hop_length=hop)

# Autocorrelation of onset envelope over plausible lag range
lags = np.arange(int(0.25/(hop/sr)), int(1.6/(hop/sr)))
o = oe - oe.mean()
ac = np.array([np.dot(o[:-l], o[l:])/ (len(o)-l) for l in lags])
lag_t = lags * (hop/sr)
# print peaks
from scipy.signal import find_peaks
pk, pr = find_peaks(ac, prominence=ac.max()*0.05)
print("=== autocorrelation peaks ===")
for p in pk:
    print(f"  lag={lag_t[p]:.4f}s  bpm={60/lag_t[p]:7.2f}  ac={ac[p]:.4f}  rel={ac[p]/ac.max():.3f}")

# tempogram
tgram = librosa.feature.tempogram(onset_envelope=oe, sr=sr, hop_length=hop, win_length=384)
bpms = librosa.tempo_frequencies(tgram.shape[0], sr=sr, hop_length=hop)
tmean = tgram.mean(axis=1)
sel = (bpms>50)&(bpms<300)
top = np.argsort(tmean[sel])[::-1][:12]
print("\n=== tempogram top tempi ===")
for i in top:
    print(f"  bpm={bpms[sel][i]:7.2f}  w={tmean[sel][i]:.4f}")

# --- Structural: find repeated section length via self-similarity on chroma ---
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=2048)
n = chroma.shape[1]
S = chroma.T
S = (S - S.mean(0))/(S.std(0)+1e-8)
from scipy.spatial.distance import cdist
D = 1 - (S @ S.T)/S.shape[1]
# For each candidate bar length (in seconds), measure diagonal periodicity
print("\n=== periodicity by section length ===")
best=[]
for secs in np.arange(4, 40, 0.25):
    lag = int(secs/(2048/sr))
    if lag < 2 or lag >= n-2: continue
    d = np.mean([D[i, i+lag] for i in range(0, n-lag, 3)])
    best.append((secs, d))
best.sort(key=lambda x: x[1])
for secs,d in best[:15]:
    print(f"  len={secs:5.2f}s  dist={d:.4f}")
