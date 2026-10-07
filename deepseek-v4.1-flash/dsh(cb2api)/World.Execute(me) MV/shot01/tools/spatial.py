"""Spatial light analysis: where is the luminance in the frame?
Prints a 6x6 tile map so composition problems are visible without eyes."""
import sys, os
import numpy as np
from PIL import Image

def prof(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255
    lum = 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]
    h, w = lum.shape
    th, tw = h // 6, w // 6
    tiles = lum[:th*6, :tw*6].reshape(6, th, 6, tw).mean(axis=(1, 3))
    lines = [f"  {os.path.basename(path):22} mean={lum.mean():.3f} p99={np.percentile(lum,99):.3f}"]
    for r in range(6):
        lines.append('      ' + ' '.join(f'{tiles[r,c]:.3f}' for c in range(6)))
    my, mx = np.unravel_index(tiles.argmax(), tiles.shape)
    lines.append(f"      brightest tile: row{my} col{mx} = {tiles.max():.3f}")
    return '\n'.join(lines)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        if os.path.isdir(p):
            for f in sorted(os.listdir(p)):
                if f.endswith('.png'):
                    print(prof(os.path.join(p, f)))
        else:
            print(prof(p))
