"""sky_raster.py - replay _dev/sky_ops.json with Pillow into _dev/sky_preview.png.

Run: <python> _dev/sky_raster.py
Panels are drawn with a supersampled mask per clipped draw so the recorded
ops stay inside their window-pane rectangles, exactly like the canvas clip.
"""
import json
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 3                      # supersample factor
WASH_ROWS = 2               # scanline step for the vertical gradient wash


def rgba(text):
    t = str(text).replace(' ', '')
    if t.startswith('rgba(') or t.startswith('rgb('):
        body = t[t.index('(') + 1:t.rindex(')')]
        p = [float(x) for x in body.split(',')]
        while len(p) < 4:
            p.append(1.0)
        return (int(p[0]), int(p[1]), int(p[2]), int(round(max(0.0, min(1.0, p[3])) * 255)))
    return (0, 0, 0, 255)


def blend(dst, src, alpha):
    if alpha <= 0:
        return dst
    if alpha >= 1:
        return src
    return tuple(int(round(dst[i] * (1 - alpha) + src[i] * alpha)) for i in range(4))


class Aff:
    """2D affine [a, b, c, d, e, f]; pt() maps local -> device pixels."""

    def __init__(self, m=(1, 0, 0, 1, 0, 0)):
        self.m = tuple(m)

    def mul(self, n):
        a, b, c, d, e, f = self.m
        return Aff((a * n[0] + c * n[1], b * n[0] + d * n[1],
                    a * n[2] + c * n[3], b * n[2] + d * n[3],
                    a * n[4] + c * n[5] + e, b * n[4] + d * n[5] + f))

    def tr(self, x, y):
        return self.mul((1, 0, 0, 1, x, y))

    def pt(self, x, y):
        a, b, c, d, e, f = self.m
        return (a * x + c * y + e, b * x + d * y + f)


K = 0.5522847498307936


def flatten(segments, steps=20):
    """segments -> list of polylines (device coords). Consecutive M starts a new one."""
    out = []
    cur = []
    pen = (0.0, 0.0)
    start = (0.0, 0.0)

    def push(p):
        cur.append(p)

    for seg in segments:
        op, pts = seg[0], seg[1]
        if op == 'M':
            if len(cur) > 1:
                out.append(cur)
            cur = []
            pen = start = pts
            push(pen)
        elif op == 'L':
            pen = pts
            push(pen)
        elif op == 'Q':
            c, q = pts
            for i in range(1, steps + 1):
                t = i / steps
                mt = 1 - t
                push((mt * mt * pen[0] + 2 * mt * t * c[0] + t * t * q[0],
                      mt * mt * pen[1] + 2 * mt * t * c[1] + t * t * q[1]))
            pen = q
        elif op == 'C':
            c1, c2, q = pts
            for i in range(1, steps + 1):
                t = i / steps
                mt = 1 - t
                push((mt ** 3 * pen[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * q[0],
                      mt ** 3 * pen[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * q[1]))
            pen = q
        elif op == 'Z':
            if cur:
                push(start)
                out.append(cur)
                cur = []
            pen = start
    if len(cur) > 1:
        out.append(cur)
    return out


class Panel:
    def __init__(self, spec, gradients):
        self.box = spec['box']
        self.ops = spec['ops']
        self.grads = gradients
        self.aff = Aff()
        self.stack = []
        self.clip = None            # local (x0,y0,x1,y1)
        self.fill = (0, 0, 0, 255)
        self.stroke = (0, 0, 0, 255)
        self.lw = 1.0
        self.alpha = 1.0
        self.segments = []
        self.layer = None
        self.ldraw = None
        self.canvas = None
        self.cw = self.ch = 0
        self.px = []
        self.bbox = None

    # ---- layers (clip emulation) -------------------------------------------
    def open_layer(self):
        b = self.box
        x0 = int(math.floor(b['x'])) - 2
        y0 = int(math.floor(b['y'])) - 2
        x1 = int(math.ceil(b['x'] + b['w'])) + 2
        y1 = int(math.ceil(b['y'] + b['h'])) + 2
        self.canvas = (x0, y0)
        self.cw, self.ch = x1 - x0, y1 - y0
        self.layer = Image.new('RGBA', (self.cw * SS, self.ch * SS), (0, 0, 0, 0))
        self.ldraw = ImageDraw.Draw(self.layer)
        self.px = []
        self.bbox = None

    def note(self, px, py):
        self.px.append((px, py))
        b = self.bbox
        if b is None:
            self.bbox = [px, py, px, py]
        else:
            if px < b[0]: b[0] = px
            if py < b[1]: b[1] = py
            if px > b[2]: b[2] = px
            if py > b[3]: b[3] = py

    def to_layer(self, px, py):
        return ((px - self.canvas[0]) * SS, (py - self.canvas[1]) * SS)

    def compose(self):
        b = self.box
        if self.cw <= 0 or self.ch <= 0:
            return
        # tight bbox of everything actually drawn, padded and clipped to the pane
        bb = self.bbox
        if bb is None:
            return
        x0 = max(b['x'], bb[0] - 2.0)
        y0 = max(b['y'], bb[1] - 2.0)
        x1 = min(b['x'] + b['w'], bb[2] + 2.0)
        y1 = min(b['y'] + b['h'], bb[3] + 2.0)
        if x1 - x0 < 1 or y1 - y0 < 1:
            return
        # supersampled source window in layer-local pixels
        sx0 = (x0 - self.canvas[0]) * SS
        sy0 = (y0 - self.canvas[1]) * SS
        sx1 = (x1 - self.canvas[0]) * SS
        sy1 = (y1 - self.canvas[1]) * SS
        tw = max(1, int(round(x1 - x0)))
        th = max(1, int(round(y1 - y0)))
        patch = self.layer.crop((max(0, sx0), max(0, sy0), min(self.cw * SS, sx1), min(self.ch * SS, sy1)))
        patch = patch.resize((tw, th), Image.LANCZOS)
        mask = Image.new('L', (tw, th), 0)
        mx0 = max(0.0, (b['x'] - x0)) * 1.0
        my0 = max(0.0, (b['y'] - y0)) * 1.0
        mx1 = min(float(tw), (b['x'] + b['w'] - x0))
        my1 = min(float(th), (b['y'] + b['h'] - y0))
        if mx1 > mx0 and my1 > my0:
            ImageDraw.Draw(mask).rectangle([mx0, my0, mx1 - 1, my1 - 1], fill=255)
        base.paste(patch, (int(round(x0)), int(round(y0))), mask)

    # ---- how to apply a gradient -------------------------------------------
    def gradient_shape(self, grad):
        """-> (mode, axis_a, axis_b, bbox_or_None, stops)."""
        args = grad['args']
        stops = grad['stops']
        if grad['type'] == 'createRadialGradient':
            cx, cy, r = args[0], args[1], args[2]
            a = self.aff.pt(cx, cy)
            b = self.aff.pt(cx, cy + r)
            d = math.hypot(b[0] - a[0], b[1] - a[1]) or 1.0
            return ('radial', a, d, None, stops)
        a = self.aff.pt(args[0], args[1])
        b = self.aff.pt(args[2], args[3])
        bb = (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))
        return ('linear', a, b, bb, stops)

    def clip_r(self):
        if not self.clip:
            return None
        x0, y0 = self.aff.pt(self.clip[0], self.clip[1])
        x1, y1 = self.aff.pt(self.clip[2], self.clip[3])
        return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))

    def stop_color(self, stops, u):
        u = 0.0 if u < 0 else 1.0 if u > 1 else u
        prev = stops[0]
        for s in stops:
            if u <= s[0]:
                if s[0] == prev[0]:
                    return rgba(s[1])
                k = (u - prev[0]) / (s[0] - prev[0])
                c0, c1 = rgba(prev[1]), rgba(s[1])
                return tuple(int(round(c0[i] + (c1[i] - c0[i]) * k)) for i in range(4))
            prev = s
        return rgba(stops[-1][1])

    def paint_gradient(self, grad, want_stroke):
        mode, a, b, bb, stops = self.gradient_shape(grad)
        bx = self.box
        pane = (bx['x'], bx['y'], bx['x'] + bx['w'], bx['y'] + bx['h'])
        clip = self.clip_r()
        # region to paint: gradient bbox (radial -> whole pane) ∩ clip ∩ pane
        reg = pane if (mode == 'radial' or bb is None) else (
            max(bb[0], pane[0]), max(bb[1], pane[1]), min(bb[2], pane[2]), min(bb[3], pane[3]))
        if clip:
            reg = (max(reg[0], clip[0]), max(reg[1], clip[1]), min(reg[2], clip[2]), min(reg[3], clip[3]))
        x0, y0, x1, y1 = reg
        # a purely vertical/horizontal gradient has a zero-extent bbox: fill the region
        if x1 - x0 < 0.5:
            x0, x1 = pane[0], pane[2]
        if y1 - y0 < 0.5:
            y0, y1 = pane[1], pane[3]
        ix0, iy0 = int(math.floor(x0)), int(math.floor(y0))
        ix1, iy1 = int(math.ceil(x1)), int(math.ceil(y1))
        ax, ay = a
        if mode == 'linear':
            dx, dy = b[0] - ax, b[1] - ay
            den = dx * dx + dy * dy
            if den <= 1e-9:
                den = 1.0
            for y in range(iy0, iy1):
                for x in range(ix0, ix1):
                    col = self.stop_color(stops, ((x - ax) * dx + (y - ay) * dy) / den)
                    self.ldraw.rectangle([self.to_layer(x, y), self.to_layer(x + 1, y + 1)],
                                         fill=(col[0], col[1], col[2], int(col[3] * self.alpha)))
        else:
            rad = 1.0
            for k in range(len(stops) - 1, -1, -1):
                if stops[k][0] > 0.001:
                    rad = stops[k][0]
            rad = max(1e-6, rad)
            for y in range(iy0, iy1):
                for x in range(ix0, ix1):
                    lx, ly = self.inv(x, y)
                    d = math.hypot(lx - ax, ly - ay) / rad
                    col = self.stop_color(stops, d)
                    self.ldraw.rectangle([self.to_layer(x, y), self.to_layer(x + 1, y + 1)],
                                         fill=(col[0], col[1], col[2], int(col[3] * self.alpha)))
        self.note(ix0, iy0)
        self.note(ix1, iy1)

    def inv(self, x, y):
        a, b, c, d, e, f = self.aff.m
        det = a * d - b * c
        if abs(det) < 1e-9:
            det = 1e-9
        px, py = x - e, y - f
        return ((d * px - c * py) / det, (-b * px + a * py) / det)

    # ---- ops ---------------------------------------------------------------
    def run(self):
        self.open_layer()
        for e in self.ops:
            op = e['op']
            A = e.get('args', [])
            ga = e.get('globalAlpha', 1.0)
            if op == 'set:fillStyle':
                v = e['value']
                self.pending_fill = v
                if not isinstance(v, dict):
                    self.fill = rgba(v)
                continue
            if op == 'set:strokeStyle':
                v = e['value']
                if not isinstance(v, dict):
                    self.stroke = rgba(v)
                continue
            if op == 'set:lineWidth':
                self.lw = float(e['value'])
                continue
            if op == 'set:globalAlpha':
                self.alpha = float(e['value'])
                continue
            if op.startswith('set:') or op in ('beginPath', 'setLineDash'):
                if op == 'beginPath':
                    self.segments = []
                    self.pathbb = None
                continue
            if op == 'save':
                self.stack.append((self.aff, self.clip, self.fill, self.stroke, self.lw, self.alpha))
            elif op == 'restore':
                if self.stack:
                    self.aff, self.clip, self.fill, self.stroke, self.lw, self.alpha = self.stack.pop()
            elif op == 'translate':
                self.aff = self.aff.tr(A[0], A[1])
            elif op == 'rotate':
                ca, sa = math.cos(A[0]), math.sin(A[0])
                self.aff = self.aff.mul((ca, sa, -sa, ca, 0, 0))
            elif op == 'scale':
                self.aff = self.aff.mul((A[0], 0, 0, A[1], 0, 0))
            elif op == 'rect':
                self.rect_op(A)
            elif op == 'clip':
                self.do_clip(A, e)
            elif op in ('moveTo', 'lineTo'):
                self.push(op[0].upper(), self.aff.pt(A[0], A[1]))
            elif op == 'quadraticCurveTo':
                self.push('Q', (self.aff.pt(A[0], A[1]), self.aff.pt(A[2], A[3])))
            elif op == 'bezierCurveTo':
                self.push('C', (self.aff.pt(A[0], A[1]), self.aff.pt(A[2], A[3]), self.aff.pt(A[4], A[5])))
            elif op == 'closePath':
                self.push('Z', None)
            elif op == 'arc':
                self.arc(A, False)
            elif op == 'ellipse':
                self.arc(A, True)
            elif op == 'fill':
                g = e.get('fillStyle')
                if isinstance(g, dict):
                    self.paint_gradient(self.grads[g['grad']], False)
                else:
                    self.flush_fill(rgba(g))
            elif op == 'stroke':
                g = e.get('strokeStyle')
                if isinstance(g, dict):
                    self.paint_gradient(self.grads[g['grad']], True)
                else:
                    self.flush_stroke(rgba(g))
            elif op == 'fillRect':
                r = e['devRect']
                g = e.get('fillStyle')
                if isinstance(g, dict):
                    self.paint_gradient(self.grads[g['grad']], False)
                else:
                    c = rgba(g)
                    self.ldraw.rectangle([self.to_layer(r[0], r[1]), self.to_layer(r[2], r[3])],
                                         fill=(c[0], c[1], c[2], int(c[3] * self.alpha)))
                self.note(r[0], r[1]); self.note(r[2], r[3])
            elif op == 'strokeRect':
                r = e['devRect']
                c = rgba(e.get('strokeStyle'))
                w = max(1.0, self.lw) * SS
                self.ldraw.rectangle([self.to_layer(r[0], r[1]), self.to_layer(r[2], r[3])],
                                     outline=(c[0], c[1], c[2], int(c[3] * self.alpha)), width=int(round(w)))
                self.note(r[0], r[1]); self.note(r[2], r[3])
        self.compose()

    def push(self, op, pts):
        """Append a path segment and extend the current-path bbox."""
        self.segments.append((op, pts))
        bb = getattr(self, 'pathbb', None)
        if op == 'M':
            xs, ys = [pts[0]], [pts[1]]
        elif op == 'L':
            xs, ys = [pts[0]], [pts[1]]
        elif op == 'Q':
            xs = [pts[0][0], pts[1][0]]
            ys = [pts[0][1], pts[1][1]]
        elif op == 'C':
            xs = [pts[0][0], pts[1][0], pts[2][0]]
            ys = [pts[0][1], pts[1][1], pts[2][1]]
        else:
            return
        nb = (min(xs), min(ys), max(xs), max(ys))
        if bb is None:
            self.pathbb = nb
        else:
            self.pathbb = (min(bb[0], nb[0]), min(bb[1], nb[1]), max(bb[2], nb[2]), max(bb[3], nb[3]))

    def rect_op(self, A):
        x, y, w, h = A[0], A[1], A[2], A[3]
        pts = [self.aff.pt(x, y), self.aff.pt(x + w, y), self.aff.pt(x + w, y + h), self.aff.pt(x, y + h)]
        for p in pts:
            self.push('L', p)
        self.push('Z', None)
        return pts

    def do_clip(self, A, e):
        bb = getattr(self, 'pathbb', None)
        if bb is None and e.get('devRect'):
            r = e['devRect']
            bb = (r[0], r[1], r[2], r[3])
        if bb:
            if self.clip:
                self.clip = (max(self.clip[0], bb[0]), max(self.clip[1], bb[1]),
                             min(self.clip[2], bb[2]), min(self.clip[3], bb[3]))
            else:
                self.clip = bb

    def arc(self, A, is_ellipse):
        cx, cy, rx = A[0], A[1], A[2]
        ry = A[3] if is_ellipse else A[2]
        rot = A[4] if is_ellipse else 0.0
        sa = A[5] if is_ellipse else A[3]
        ea = A[6] if is_ellipse else A[4]
        pts = []
        n = max(6, int(abs(ea - sa) / (math.pi / 28)) + 1)
        for i in range(n + 1):
            ang = sa + (ea - sa) * i / n
            lx = rx * math.cos(ang)
            ly = ry * math.sin(ang)
            if is_ellipse and rot:
                lx, ly = lx * math.cos(rot) - ly * math.sin(rot), lx * math.sin(rot) + ly * math.cos(rot)
            pts.append(self.aff.pt(cx + lx, cy + ly))
        self.push('M', pts[0])
        for p in pts[1:]:
            self.push('L', p)
        if abs(ea - sa) >= 6.283:
            self.push('Z', None)

    def flush_fill(self, col):
        polys = flatten(self.segments)
        for pl in polys:
            if len(pl) < 3:
                continue
            pts = [self.to_layer(x, y) for x, y in pl]
            self.ldraw.polygon(pts, fill=(col[0], col[1], col[2], int(col[3] * self.alpha)))
            for (px, py) in pl:
                self.note(px, py)

    def flush_stroke(self, col):
        w = max(1.0, self.lw) * SS
        for pl in flatten(self.segments):
            if len(pl) < 2:
                continue
            self.ldraw.line([self.to_layer(x, y) for x, y in pl],
                            fill=(col[0], col[1], col[2], int(col[3] * self.alpha)),
                            width=int(round(w)), joint='curve')
            r = w / 2.0
            for (x, y) in (pl[0], pl[-1]):
                lx, ly = self.to_layer(x, y)
                self.ldraw.ellipse([lx - r, ly - r, lx + r, ly + r],
                                   fill=(col[0], col[1], col[2], int(col[3] * self.alpha)))
            for (x, y) in pl:
                self.note(x, y)


with open(os.path.join(HERE, 'sky_ops.json'), 'r', encoding='utf-8') as fh:
    data = json.load(fh)

panels = data['panels']
grads = data['gradients']
box = data['box']
W = int(box['w'] * len(panels))
H = int(box['h'])
base = Image.new('RGBA', (W, H), (205, 205, 205, 255))

for i, spec in enumerate(panels):
    gp = Panel(spec, grads[i])
    b = spec['box']
    gp.box = {'x': b['x'] + i * b['w'], 'y': b['y'], 'w': b['w'], 'h': b['h']}

    # ops are recorded in pane-local coordinates (the function does
    # ctx.translate(box.x, box.y)): place panel i by pre-translating the frame.
    _open = gp.open_layer

    def _shifted(_open=_open, _i=i, _b=b):
        _open()
        gp.aff = Aff((1, 0, 0, 1, _i * _b['w'], 0))

    gp.open_layer = _shifted
    gp.run()
    print('panel %d (%s): %d ops' % (i, spec['label'], len(spec['ops'])))

base.convert('RGB').save(os.path.join(HERE, 'sky_preview.png'))
print('wrote', os.path.join(HERE, 'sky_preview.png'), base.size)
