"""Analyze the song: tempo, beats, section boundaries, energy curve."""
import json, sys, os
import numpy as np
import librosa

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(BASE, "audio", "song_48k.wav")
OUT = os.path.join(BASE, "analysis")
os.makedirs(OUT, exist_ok=True)

y, sr = librosa.load(WAV, sr=22050, mono=True)
dur = len(y) / sr
print(f"duration={dur:.3f}s sr={sr}")

# --- Tempo / beats ---
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=512, trim=False)
tempo = float(np.atleast_1d(tempo)[0])
beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)
print(f"tempo={tempo:.3f} BPM  n_beats={len(beat_times)}")

# refine tempo via median inter-beat interval
if len(beat_times) > 4:
    ibi = np.diff(beat_times)
    ibi = ibi[(ibi > 0.2) & (ibi < 1.5)]
    med = float(np.median(ibi))
    print(f"median IBI={med:.4f}s -> {60/med:.3f} BPM")

# --- RMS energy curve (for section detection) ---
hop = 1024
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
rms_t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
# smooth
k = 9
rms_s = np.convolve(rms, np.ones(k)/k, mode="same")

# spectral centroid + flux for timbre change detection
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
flux = np.concatenate([[0], np.sum(np.maximum(0, np.diff(S, axis=1)), axis=0)])

# --- Chroma for key detection ---
chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
chroma_mean = chroma.mean(axis=1)
names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
key_order = np.argsort(chroma_mean)[::-1]
print("chroma top:", [(names[i], round(float(chroma_mean[i]),2)) for i in key_order[:6]])

# --- Self-similarity novelty for structural segmentation ---
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)
mfcc_sync = mfcc
# recurrence-based novelty
from scipy.spatial.distance import cdist
X = mfcc_sync[:, ::4].T
X = (X - X.mean(0)) / (X.std(0) + 1e-8)
D = cdist(X, X, metric='cosine')
# checkerboard kernel novelty
L = 32
nov = np.zeros(D.shape[0])
ks = np.arange(L)
for i in range(L, D.shape[0]-L):
    a = D[i-L:i, i-L:i]; b = D[i:i+L, i:i+L]
    c1 = D[i-L:i, i:i+L]; c2 = D[i:i+L, i-L:i]
    nov[i] = a.mean() + b.mean() - c1.mean() - c2.mean()
nov_t = librosa.frames_to_time(np.arange(len(nov))*4, sr=sr, hop_length=hop)

# find peaks
from scipy.signal import find_peaks
pk, props = find_peaks(nov, distance=int(4.0/ (hop/sr) /4), prominence=0.02)
boundaries = sorted(set([0.0] + [round(float(nov_t[p]),2) for p in pk] + [round(dur,2)]))

data = {
    "duration": dur,
    "tempo": tempo,
    "beat_times": [round(float(t),4) for t in beat_times],
    "boundaries": boundaries,
    "rms": {"t": rms_t[::4].tolist(), "v": rms_s[::4].tolist()},
    "flux": {"t": librosa.frames_to_time(np.arange(len(flux)), sr=sr, hop_length=hop)[::4].tolist(),
             "v": flux[::4].tolist()},
    "centroid": {"t": librosa.frames_to_time(np.arange(len(cent)), sr=sr, hop_length=hop)[::4].tolist(),
                 "v": cent[::4].tolist()},
    "chroma": {names[i]: float(chroma_mean[i]) for i in range(12)},
}
with open(os.path.join(OUT, "analysis.json"), "w") as f:
    json.dump(data, f)
print("boundaries:", boundaries)
print("saved", OUT)
