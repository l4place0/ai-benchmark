"""QC a frame or video numerically (no eyes needed): brightness, color, entropy, motion."""
import sys, os, json
import numpy as np
from PIL import Image

def stats(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w, _ = a.shape
    lum = 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]
    # histogram entropy
    hist, _ = np.histogram((lum*255).astype(np.uint8), bins=256, range=(0,255))
    p = hist / hist.sum()
    p = p[p > 0]
    ent = float(-(p*np.log2(p)).sum())
    return {
        'file': os.path.basename(path), 'w': w, 'h': h,
        'mean_lum': float(lum.mean()), 'std_lum': float(lum.std()),
        'min': float(lum.min()), 'max': float(lum.max()),
        'p01': float(np.percentile(lum,1)), 'p99': float(np.percentile(lum,99)),
        'mean_rgb': [float(a[:,:,i].mean()) for i in range(3)],
        'sat': float((a.max(2)-a.min(2)).mean()),
        'entropy': ent,
        'unique_colors_est': int(len(np.unique((a*63).astype(np.uint8).reshape(-1,3), axis=0))),
    }

if __name__ == '__main__':
    out = []
    for p in sys.argv[1:]:
        if os.path.isdir(p):
            for f in sorted(os.listdir(p)):
                if f.lower().endswith(('.png','.jpg')) and not f.startswith('_'):
                    out.append(stats(os.path.join(p,f)))
        else:
            out.append(stats(p))
    for s in out:
        print(f"{s['file'][:34]:34} {s['w']}x{s['h']}  lum={s['mean_lum']:.4f} sd={s['std_lum']:.4f} "
              f"[{s['p01']:.3f},{s['p99']:.3f}] sat={s['sat']:.4f} ent={s['entropy']:.2f} "
              f"rgb=({s['mean_rgb'][0]:.3f},{s['mean_rgb'][1]:.3f},{s['mean_rgb'][2]:.3f}) uc={s['unique_colors_est']}")
    if len(sys.argv) > 2 and os.path.isdir(sys.argv[1]):
        json.dump(out, open(os.path.join(sys.argv[1], '_stats.json'),'w'), indent=1)
