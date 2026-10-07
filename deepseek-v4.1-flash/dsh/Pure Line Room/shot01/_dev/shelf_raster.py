"""shelf_raster.py — rasterise _dev/shelf_preview.json (written by smoke_shelf.mjs)
into _dev/shelf_preview.png, and the "everything open" pass into
_dev/shelf_preview_open.png.

Run:  <python> _dev/shelf_raster.py

The JSON is a painter-sorted polygon list (already projected and depth-sorted by
the harness), so this only has to fill + stroke each polygon in order.  Ink
alpha is pre-blended against the polygon's own fill (every fill in this room is
near-white, so that is visually exact) and the whole image is drawn at 2x and
downsampled for anti-aliasing.
"""
import json
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 2          # supersample factor


def rgb(text, fallback=(255, 255, 255)):
    t = str(text)
    if t.startswith('#') and len(t) == 7:
        return (int(t[1:3], 16), int(t[3:5], 16), int(t[5:7], 16))
    if t.startswith('#') and len(t) == 4:
        return (int(t[1] * 2, 16), int(t[2] * 2, 16), int(t[3] * 2, 16))
    return fallback


def blend(dst, src, a):
    if a >= 0.999:
        return src
    if a <= 0.0:
        return dst
    return tuple(int(round(dst[i] * (1 - a) + src[i] * a)) for i in range(3))


def render(name):
    with open(os.path.join(HERE, name + '.json'), 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    W, H = int(data['width']), int(data['height'])
    bg = rgb(data.get('bg', '#ffffff'))
    big = Image.new('RGB', (W * SS, H * SS), bg)
    draw = ImageDraw.Draw(big)

    for p in data['polys']:
        pts = [(x * SS, y * SS) for x, y in p['pts']]
        if len(pts) < 3:
            continue
        fill = rgb(p['fill']) if p.get('fill') else None
        if fill:
            draw.polygon(pts, fill=fill)
        ink = rgb(p.get('stroke') or '#000000', (0, 0, 0))
        under = fill if fill else bg
        col = blend(under, ink, float(p.get('alpha', 1.0)))
        w = max(1, int(round(float(p.get('width', 1.0)) * SS)))
        draw.line(pts + [pts[0]], fill=col, width=w, joint='curve')

    out = big.resize((W, H), Image.LANCZOS)
    path = os.path.join(HERE, name + '.png')
    out.save(path)
    print('wrote %s  %dx%d  from %d polygons' % (path, W, H, len(data['polys'])))


def crop(name, box, zoom, out):
    """Zoom into one region so the composition can be judged up close."""
    img = Image.open(os.path.join(HERE, name + '.png'))
    part = img.crop(box)
    part = part.resize((part.width * zoom, part.height * zoom), Image.NEAREST)
    path = os.path.join(HERE, out)
    part.save(path)
    print('wrote %s  %dx%d' % (path, part.width, part.height))


render('shelf_preview')
render('shelf_preview_open')
render('shelf_preview_pull')

# the shelves, and the cabinet with everything open
crop('shelf_preview', (592, 220, 935, 462), 3, 'shelf_preview_zoom_books.png')
crop('shelf_preview_open', (555, 400, 930, 585), 3, 'shelf_preview_zoom_cabinet.png')
# the two open drawers
crop('shelf_preview_open', (555, 450, 700, 520), 7, 'shelf_preview_zoom_drawer.png')
# shelf 1 (the flat stack) and shelf 2 (the bookend + leaning book)
crop('shelf_preview', (596, 392, 932, 462), 3, 'shelf_preview_zoom_shelf1.png')
crop('shelf_preview', (596, 350, 932, 412), 3, 'shelf_preview_zoom_shelf2.png')
# the flat stack on shelf 1, hard zoom
crop('shelf_preview', (705, 412, 775, 448), 12, 'shelf_preview_zoom_stack.png')
# the three pull-out books, drawn out
crop('shelf_preview_pull', (690, 262, 850, 356), 5, 'shelf_preview_zoom_pull.png')
