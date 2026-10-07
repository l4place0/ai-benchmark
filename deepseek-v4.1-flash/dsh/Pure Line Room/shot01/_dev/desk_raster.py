"""desk_raster.py — replay _dev/desk_preview.ops.json with Pillow into desk_preview.png.

The ops are exactly the polygons/lines that _dev/smoke_desk.mjs derived from the
module's mesh (same painter order, same stroke weights as js/renderer.js), so the
PNG is a faithful look at what the room will draw for the desk zone.

Run: <python> _dev/desk_raster.py
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 2                      # supersample factor


def rgba(text, alpha=1.0):
    """'#rrggbb' | 'rgba(r,g,b,a)' -> (r,g,b,a)"""
    if text is None:
        return None
    t = str(text).strip()
    if t.startswith('#'):
        if len(t) == 4:
            t = '#' + t[1] * 2 + t[2] * 2 + t[3] * 2
        return (int(t[1:3], 16), int(t[3:5], 16), int(t[5:7], 16), int(round(alpha * 255)))
    if t.startswith('rgb'):
        body = t[t.index('(') + 1:t.rindex(')')]
        p = [float(x) for x in body.split(',')]
        while len(p) < 4:
            p.append(1.0)
        return (int(p[0]), int(p[1]), int(p[2]), int(round(max(0.0, min(1.0, p[3] * alpha)) * 255)))
    return None


def main():
    with open(os.path.join(HERE, 'desk_preview.ops.json'), 'r', encoding='utf-8') as fh:
        doc = json.load(fh)
    W, H = doc['width'], doc['height']
    paper = rgba(doc.get('paper', '#ffffff'))
    n_panels = max((op.get('panel', 0) for op in doc['ops']), default=0) + 1
    panel_w = W // n_panels
    try:
        font = ImageFont.load_default(size=13 * SS)
    except TypeError:                                    # very old Pillow
        font = ImageFont.load_default()

    n_poly = n_line = 0
    # one layer per panel: geometry that runs past its frame is clipped, exactly
    # like a canvas would clip it.
    for panel in range(n_panels):
        img = Image.new('RGBA', (panel_w * SS, H * SS), paper)
        dr = ImageDraw.Draw(img, 'RGBA')
        for op in doc['ops']:
            if op.get('panel', 0) != panel:
                continue
            t = op['t']
            if t == 'poly':
                pts = [(p[0] * SS, p[1] * SS) for p in op['pts']]
                fill = rgba(op.get('fill'), op.get('alpha', 1.0))
                stroke = rgba(op.get('stroke'), op.get('alpha', 1.0))
                w = max(1, int(round((op.get('w') or 1.0) * SS)))
                if fill:
                    dr.polygon(pts, fill=fill)
                if stroke:
                    dr.line(list(pts) + [pts[0]], fill=stroke, width=w, joint='curve')
                n_poly += 1
            elif t == 'line':
                pts = [(p[0] * SS, p[1] * SS) for p in op['pts']]
                stroke = rgba(op.get('stroke'))
                if stroke:
                    dr.line(pts, fill=stroke, width=max(1, int(round((op.get('w') or 1.0) * SS))))
                n_line += 1
            elif t == 'rect':
                b = op['box']
                dr.rectangle([b[0] * SS, b[1] * SS, b[2] * SS, b[3] * SS],
                             outline=rgba(op.get('stroke')), width=max(1, int(SS)))
            elif t == 'text':
                dr.text((op['x'] * SS, op['y'] * SS), op['text'], fill=(60, 60, 70, 255), font=font)
        out = img.convert('RGB').resize((panel_w, H), Image.LANCZOS)
        if panel == 0:
            full = Image.new('RGB', (panel_w * n_panels, H), (255, 255, 255))
        full.paste(out, (panel * panel_w, 0))

    path = os.path.join(HERE, 'desk_preview.png')
    full.save(path)
    print(f'wrote {path}  {W}x{H}  ({n_poly} polygons, {n_line} lines, {n_panels} panels)')


if __name__ == '__main__':
    main()
