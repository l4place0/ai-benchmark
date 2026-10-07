"""ceiling_raster.py — rasterise _dev/ceiling_preview.svg with Pillow.

The SVG emitted by _dev/ceiling_preview.mjs is deliberately restricted to
<polygon>, <polyline> and <text> with absolute coordinates, so this script can
replay it op-for-op (document order == painter order) with a supersampled
drawing pass.  Each <g id="panel-N"> ... </g> block is replayed into its own
layer and then pasted, which reproduces the per-panel clipping of the SVG.
Painter's algorithm: later elements paint over earlier ones — exactly what the
real canvas renderer does.

Run: <python> _dev/ceiling_raster.py
"""
import os
import re

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, 'ceiling_preview.svg')
PNG = os.path.join(HERE, 'ceiling_preview.png')
SS = 3                      # supersample factor

HEAD = re.compile(r'<svg[^>]*width="(\d+)"[^>]*height="(\d+)"')
OPEN = re.compile(r'<g id="panel-(\d+)">')
ELEM = re.compile(r'<(polygon|polyline)\b([^>]*?)/?>')
TEXT = re.compile(r'<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</text>')
ATTR = re.compile(r'([a-zA-Z-]+)="([^"]*)"')


def attrs_of(text):
    return dict(ATTR.findall(text))


def color_of(value, opacity):
    value = (value or '').strip()
    if value in ('none', ''):
        return None
    a = float(opacity) if opacity not in (None, '') else 1.0
    m = re.fullmatch(r'#([0-9a-fA-F]{6})', value)
    if m:
        v = int(m.group(1), 16)
        rgb = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
    else:
        m = re.fullmatch(r'#([0-9a-fA-F]{3})', value)
        if not m:
            return None
        rgb = tuple(int(c + c, 16) for c in m.group(1))
    return rgb + (max(0, min(255, int(round(a * 255)))),)


def points_of(raw):
    pts = []
    for pair in raw.split():
        if ',' not in pair:
            continue
        x, y = pair.split(',')
        pts.append((float(x), float(y)))
    return pts


class Panel:
    """One 800x660 cell, rasterised into its own supersampled layer."""

    def __init__(self, index, rect):
        self.index = index
        self.rect = rect                       # (x0, y0, x1, y1) in user units
        self.w = int(round(rect[2] - rect[0]))
        self.h = int(round(rect[3] - rect[1]))
        self.layer = Image.new('RGB', (self.w * SS, self.h * SS), (255, 255, 255))
        self.draw = ImageDraw.Draw(self.layer, 'RGBA')
        self.poly = 0
        self.line = 0

    def local(self, pts):
        x0, y0 = self.rect[0], self.rect[1]
        return [((x - x0) * SS, (y - y0) * SS) for (x, y) in pts]

    def element(self, tag, at):
        pts = points_of(at.get('points', ''))
        if len(pts) < 2:
            return
        lpts = self.local(pts)
        fill = color_of(at.get('fill'), at.get('fill-opacity'))
        stroke = color_of(at.get('stroke'), at.get('stroke-opacity'))
        width = float(at.get('stroke-width', '1'))
        if tag == 'polygon' and fill and len(lpts) >= 3:
            self.draw.polygon(lpts, fill=fill)
            self.poly += 1
        if stroke:
            w = max(1, int(round(width * SS)))
            seq = lpts + [lpts[0]] if tag == 'polygon' else lpts
            self.draw.line(seq, fill=stroke, width=w, joint='curve')
            r = w / 2.0
            for (x, y) in (seq[0], seq[-1]):
                self.draw.ellipse([x - r, y - r, x + r, y + r], fill=stroke)
            self.line += 1

    def paste(self, base):
        small = self.layer.resize((self.w, self.h), Image.LANCZOS) if SS != 1 else self.layer
        base.paste(small, (int(round(self.rect[0])), int(round(self.rect[1]))))


def main():
    with open(SVG, 'r', encoding='utf-8') as fh:
        lines = fh.read().split('\n')
    head = HEAD.search('\n'.join(lines[:1]))
    W, H = int(head.group(1)), int(head.group(2))
    base = Image.new('RGB', (W, H), (255, 255, 255))

    panel = None
    panels = []
    for line in lines:
        line = line.strip()
        if OPEN.match(line):
            panel = None                       # rect is taken from the first polygon
            pending = int(OPEN.match(line).group(1))
            continue
        if line == '</g>':
            if panel is not None:
                panel.paste(base)
                panels.append(panel)
            panel = None
            continue
        m = ELEM.search(line)
        if not m:
            continue
        if panel is None:
            at = attrs_of(m.group(2))
            pts = points_of(at.get('points', ''))
            if len(pts) >= 3:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                panel = Panel(pending, (min(xs), min(ys), max(xs), max(ys)))
        if panel is not None:
            panel.element(m.group(1), attrs_of(m.group(2)))

    draw = ImageDraw.Draw(base, 'RGBA')
    for m in TEXT.finditer('\n'.join(lines)):
        draw.text((float(m.group(1)), float(m.group(2)) - 14), m.group(3), fill=(40, 40, 48, 255))

    base.save(PNG)
    print('replayed %d polygons and %d strokes into %d panels -> %s (%dx%d)'
          % (sum(p.poly for p in panels), sum(p.line for p in panels), len(panels), PNG, W, H))


if __name__ == '__main__':
    main()
