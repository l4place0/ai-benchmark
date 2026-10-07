"""lounge_raster.py - replay _dev/lounge_preview.svg with Pillow.

Run: <python> _dev/lounge_raster.py
Only the three primitives the projector emits are supported (rect, polygon,
polyline) plus fill / stroke / stroke-width / opacity, so the SVG stays a
faithful, dumb record of the projected faces.
"""
import os
import re
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 2                      # supersample factor
NS = '{http://www.w3.org/2000/svg}'


def rgba(text, opacity=1.0):
    if not text or text == 'none':
        return None
    t = str(text).strip()
    if t.startswith('#'):
        h = t[1:]
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = 255
    else:
        m = re.match(r'rgba?\(([^)]+)\)', t)
        if not m:
            return None
        p = [float(x) for x in m.group(1).replace(' ', '').split(',')]
        r, g, b = int(p[0]), int(p[1]), int(p[2])
        a = int(round((p[3] if len(p) > 3 else 1.0) * 255))
    a = int(round(a * opacity))
    return (r, g, b, a)


def parse_points(text):
    out = []
    for pair in text.replace(',', ' ').split():
        out.append(float(pair))
    return [(out[i], out[i + 1]) for i in range(0, len(out) - 1, 2)]


def num(el, name, default):
    v = el.get(name)
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


src = os.path.join(HERE, 'lounge_preview.svg')
tree = ET.parse(src)
root = tree.getroot()
W = int(float(root.get('width')))
H = int(float(root.get('height')))
base = Image.new('RGBA', (W * SS, H * SS), (255, 255, 255, 255))
draw = ImageDraw.Draw(base, 'RGBA')

counts = {'rect': 0, 'polygon': 0, 'polyline': 0}


def draw_all(node, target, dx=0.0):
    """Draw primitives into `target`, shifting by -dx (panel origin)."""
    for el in node:
        tag = el.tag.replace(NS, '')
        if tag == 'g':
            if el.get('data-panel') is not None:
                pw = float(el.get('data-w', W / 4))
                ph = float(el.get('data-h', H))
                ox = float(el.get('data-x', 0))
                layer = Image.new('RGBA', (int(pw * SS), int(ph * SS)), (0, 0, 0, 0))
                draw_all(el, ImageDraw.Draw(layer, 'RGBA'), dx=ox)
                mask = Image.new('L', layer.size, 0)
                ImageDraw.Draw(mask).rectangle([0, 0, layer.size[0] - 1, layer.size[1] - 1], fill=255)
                base.paste(layer, (int(ox * SS), 0), mask)
            else:
                draw_all(el, target, dx=dx)
            continue
        if tag == 'rect':
            x, y = num(el, 'x', 0) - dx, num(el, 'y', 0)
            w, h = num(el, 'width', 0), num(el, 'height', 0)
            col = rgba(el.get('fill'), num(el, 'fill-opacity', 1.0))
            if col:
                target.rectangle([x * SS, y * SS, (x + w) * SS - 1, (y + h) * SS - 1], fill=col)
                counts['rect'] += 1
        elif tag == 'polygon':
            p = [((x - dx) * SS, y * SS) for x, y in parse_points(el.get('points', ''))]
            if len(p) >= 3:
                fill = rgba(el.get('fill'), num(el, 'fill-opacity', 1.0))
                if fill:
                    target.polygon(p, fill=fill)
                stroke = rgba(el.get('stroke'), num(el, 'stroke-opacity', 1.0))
                lw = num(el, 'stroke-width', 1.0)
                if stroke and lw > 0:
                    target.line(p + [p[0]], fill=stroke, width=max(1, int(round(lw * SS))), joint='curve')
                counts['polygon'] += 1
        elif tag == 'polyline':
            p = [((x - dx) * SS, y * SS) for x, y in parse_points(el.get('points', ''))]
            stroke = rgba(el.get('stroke'), num(el, 'stroke-opacity', 1.0))
            lw = num(el, 'stroke-width', 1.0)
            if stroke and len(p) >= 2 and lw > 0:
                target.line(p, fill=stroke, width=max(1, int(round(lw * SS))), joint='curve')
                counts['polyline'] += 1


draw_all(root, draw)

out = base.resize((W, H), Image.LANCZOS).convert('RGB')
dst = os.path.join(HERE, 'lounge_preview.png')
out.save(dst)
print('elements: %s' % counts)
print('wrote %s  %dx%d' % (dst, W, H))
