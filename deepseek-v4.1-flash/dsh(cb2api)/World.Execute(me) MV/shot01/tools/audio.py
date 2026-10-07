"""Audio QC + prepare the final master track.
We keep the song intact (it is the film) and only normalise level for the web."""
import os, subprocess, json, sys
import numpy as np
import soundfile as sf

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(BASE, "audio", "song_48k.wav")
y, sr = sf.read(WAV, always_2d=True)
dur = len(y)/sr
print(f"source: {dur:.3f}s  {sr}Hz  {y.shape[1]}ch")

mono = y.mean(axis=1)
print(f"peak={np.abs(y).max():.4f}  rms={np.sqrt((mono**2).mean()):.4f}")
# silence analysis
w = int(sr*0.1)
n = len(mono)//w
blk = np.abs(mono[:n*w].reshape(n,w)).max(axis=1)
sil = blk < 1e-4
print(f"truly silent 0.1s blocks: {sil.sum()} (last at {(np.where(sil)[0].max()*0.1) if sil.any() else -1:.1f}s)")
# where does it end?
nz = np.where(blk > 1e-4)[0]
print(f"first audio at {nz[0]*0.1:.2f}s, last audio at {nz[-1]*0.1:.2f}s")
