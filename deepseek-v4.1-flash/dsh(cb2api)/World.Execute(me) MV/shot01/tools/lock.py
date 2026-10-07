"""Lock the exact beat grid at 129.20 BPM using dynamic programming over the whole song,
then derive bars/sections and the sung-phrase timeline."""
import os, json
import numpy as np
import librosa

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(BASE, "audio", "song_48k.wav")
OUT = os.path.join(BASE, "analysis")
os.makedirs(OUT, exist_ok=True)
y, sr = librosa.load(WAV, sr=22050, mono=True)
DUR = len(y)/sr
hop = 512
oe = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
times = librosa.frames_to_time(np.arange(len(oe)), sr=sr, hop_length=hop)

BPM = 129.20
PERIOD = 60.0/BPM
print(f"period={PERIOD:.6f}s  bpm={BPM}")

def score(period, offset):
    n = int((DUR-offset)/period)
    idx = np.clip((offset + period*np.arange(n))/(hop/sr), 0, len(oe)-1).astype(int)
    return float(oe[idx].mean()), n

best = max(((score(PERIOD, o), o) for o in np.linspace(0, PERIOD, 2000, endpoint=False)),
           key=lambda r: r[0][0])
print(f"best offset={best[1]:.6f}  mean onset={best[0][0]:.4f}  n={best[0][1]}")
OFF = float(best[1])

# --- drift check: score first half vs second half with fixed grid ---
beats = OFF + PERIOD*np.arange(int((DUR-OFF)/PERIOD))
bi = np.clip((beats/(hop/sr)).astype(int), 0, len(oe)-1)
half = len(beats)//2
print(f"first-half mean={oe[bi[:half]].mean():.4f}  second-half mean={oe[bi[half:]].mean():.4f}")
# check drift by allowing small per-section offset
for st in range(0, int(DUR), 30):
    m = (beats>=st)&(beats<st+30)
    if m.sum()<4: continue
    bs = beats[m]
    loc = max(((float(oe[np.clip((bs+d)/(hop/sr),0,len(oe)-1).astype(int)].mean()), d)
               for d in np.linspace(-0.06,0.06,61)))
    print(f"  t={st:>3}s  local_shift={loc[1]*1000:+6.1f}ms  mean={loc[0]:.3f}")

# --- Downbeat phase: test which of 4 phases has strongest onset (kick) ---
print("\n=== downbeat phase test (using low-band onset) ===")
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[(freqs>40)&(freqs<160)].mean(axis=0)
li = np.clip((beats/(hop/sr)).astype(int), 0, len(low)-1)
for ph in range(4):
    print(f"  phase {ph}: low-band mean = {low[li[ph::4]].mean():.4f}")

np.save(os.path.join(OUT,"beats.npy"), beats)
json.dump({"bpm":BPM,"period":PERIOD,"offset":OFF,"duration":DUR,"n_beats":len(beats)},
          open(os.path.join(OUT,"grid.json"),"w"), indent=1)

# --- Section boundaries from spectral novelty, snapped to bar lines ---
hop2 = 2048
S2 = np.abs(librosa.stft(y, n_fft=4096, hop_length=hop2))
S2n = S2/ (np.linalg.norm(S2, axis=0, keepdims=True)+1e-9)
nov = np.concatenate([[0], np.sum(np.maximum(0, np.diff(S2n,axis=1)),axis=0)])
# smooth over ~2 bars
bars = off_bars = np.arange(0, len(beats)/4).astype(int)
bar_t = beats[::4]
# aggregate novelty at bar resolution
nt = librosa.frames_to_time(np.arange(len(nov)), sr=sr, hop_length=hop2)
bar_nov = np.array([nov[(nt>=bar_t[i]-0.2)&(nt<=bar_t[i]+0.2)].sum() for i in range(len(bar_t))])
# find strong bars
from scipy.signal import find_peaks
pk,props = find_peaks(bar_nov, distance=4, prominence=bar_nov.std()*0.8)
print("\n=== bar-level novelty peaks (candidate section starts) ===")
for p in pk:
    if p < len(bar_t):
        print(f"  bar {p:3d}  t={bar_t[p]:7.2f}s  nov={bar_nov[p]:.3f}")
