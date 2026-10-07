#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
mockdom_raster.py — replay a mockdom.mjs drawing digest into a PNG with Pillow.

    python mockdom_raster.py <ops.json> <out.png> [<log.json>]

NOTE ON THE FILENAME
--------------------
The task brief asked for this file to be called `_dev/rasterize.py`, but another
agent was concurrently writing its own `_dev/rasterize.py` (different JSON
schema, driven by their `_dev/harness.mjs`). Overwriting it would have broken a
running pipeline, so this harness uses its own name. mockdom.mjs looks for
`mockdom_raster.py` (override with opts.rasterizeScript or $MOCKDOM_RASTER).

--------------------------------------------------------------------------
JSON SCHEMA (written by mockdom.mjs -> RecordingContext2D.__digest)
--------------------------------------------------------------------------
{
  "w": 1440, "h": 900,                  # output bitmap size in pixels
  "background": "#ffffff",              # any PIL colour string
  "frame": "last" | "all",              # which animation frame was replayed
  "from": 1234,                         # first op index of the replay
  "notes": ["..."],                     # harness notes (approximations used)
  "ops": [ <op>, ... ]                  # drawing ops in device space, in order
}

Coordinates are already device pixels (the recorder bakes the CTM into every
path point), so this script only needs a matrix for text/image placement.

<op> is one of:
  {"t":"save"} / {"t":"restore"}        # clip (and only clip) state stack
  {"t":"clip","subpaths":[<sp>,...]}
  {"t":"fill",  "subpaths":[...], "paint":<paint>, "alpha":1.0,
                "rule":"nonzero"|"evenodd", "shadow":<shadow>|null,
                "composite":"source-over"}
  {"t":"stroke","subpaths":[...], "paint":<paint>, "alpha":1.0, "width":2.0,
                "cap":"butt|round|square", "join":"miter|round|bevel",
                "miter":10, "dash":[5,3], "dashOffset":0,
                "shadow":<shadow>|null, "composite":"source-over"}
  {"t":"rect",  "x":..,"y":..,"w":..,"h":.., "fill":<paint>|null,
                "stroke":<paint>|null, "width":2, "cap":.., "join":.., "dash":[..],
                "alpha":1.0, "shadow":<shadow>|null, "composite":..}
  {"t":"text",  "text":"hi", "x":..,"y":.., "matrix":[a,b,c,d,e,f],
                "font":{"size":16,"family":"sans-serif","weight":"normal","style":"normal"},
                "align":"start|left|center|right|end",
                "baseline":"alphabetic|top|middle|bottom|hanging|ideographic",
                "fill":<paint>|null, "stroke":<paint>|null, "strokeWidth":1,
                "alpha":1.0, "shadow":<shadow>|null}
  {"t":"image", "x":..,"y":..,"w":..,"h":.., "matrix":[a,b,c,d,e,f], "alpha":1.0, "label":".."}
  {"t":"clear", "x":..,"y":..,"w":..,"h":..}

<sp>     = {"pts":[[x,y],...], "closed":true, "kind":"poly|rect|arc|roundRect"}
<paint>  = {"kind":"color","rgba":[r,g,b,a]}
         | {"kind":"gradient","grad":{"type":"linear|radial|conic",
              "x0","y0","x1","y1","r0","r1","x","y","startAngle",
              "stops":[[offset,[r,g,b,a]],...]}}
<shadow> = {"rgba":[r,g,b,a],"blur":8,"dx":2,"dy":2}

--------------------------------------------------------------------------
APPROXIMATIONS (deliberate and documented)
--------------------------------------------------------------------------
* Multi-subpath fills are XOR-combined (even-odd approximation). For the usual
  "ring" case (inner contour wound the other way) that matches a browser; two
  overlapping same-winding subpaths would differ under a true nonzero fill.
* `clearRect` paints the background colour (an opaque canvas cannot be punched
  transparent in the output PNG).
* Gradients are interpolated per scanline in sRGB with no dithering; conic
  gradients fall back to a flat first-stop colour.
* Composite modes honoured: source-over, destination-out, lighter, copy.
  Anything else falls back to source-over and is recorded in the log.
* Shadows are a Gaussian-blurred copy of the shape.
* Text metrics come from the mock's measureText estimate and whichever TrueType
  face is available (FONT_CANDIDATES); positions/sizes are faithful, glyph
  shapes and exact advance widths are not.
* drawImage is a placeholder box (the harness cannot decode images).
"""

import json
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\verdana.ttf",
    r"C:\Windows\Fonts\DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial.ttf",
]
FONT_BOLD_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\verdanab.ttf",
]
FONT_ITALIC_CANDIDATES = [
    r"C:\Windows\Fonts\segoeuii.ttf",
    r"C:\Windows\Fonts\ariali.ttf",
]

_LOGS = {"errors": [], "warnings": [], "drawn": 0, "ops": 0}


def log_error(msg):
    if len(_LOGS["errors"]) < 100:
        _LOGS["errors"].append(str(msg)[:500])


def log_warn(msg):
    if len(_LOGS["warnings"]) < 200 and str(msg) not in _LOGS["warnings"]:
        _LOGS["warnings"].append(str(msg)[:300])


# ------------------------------------------------------------------ colours

def rgba_from_stop(c):
    return (int(round(c[0])), int(round(c[1])), int(round(c[2])), int(round(float(c[3]) * 255)))


def rgba(paint, alpha=1.0):
    """Resolve a <paint> to a flat RGBA tuple (a gradient -> its first stop)."""
    if not paint:
        return None
    if paint.get("kind") == "gradient":
        stops = (paint.get("grad") or {}).get("stops") or []
        if not stops:
            return (0, 0, 0, 0)
        c = stops[0][1]
        a = max(0.0, min(1.0, float(alpha) * float(c[3])))
        return (int(round(c[0])), int(round(c[1])), int(round(c[2])), int(round(a * 255)))
    c = paint.get("rgba") or [0, 0, 0, 1]
    a = max(0.0, min(1.0, float(alpha) * float(c[3])))
    return (int(round(c[0])), int(round(c[1])), int(round(c[2])), int(round(a * 255)))


def lerp_colour(c0, c1, t):
    return tuple(c0[i] + (c1[i] - c0[i]) * t for i in range(4))


def gradient_colour_at(stops, t):
    t = max(0.0, min(1.0, t))
    if not stops:
        return (0, 0, 0, 255)
    if t <= stops[0][0]:
        return rgba_from_stop(stops[0][1])
    if t >= stops[-1][0]:
        return rgba_from_stop(stops[-1][1])
    for i in range(1, len(stops)):
        o0, c0 = stops[i - 1]
        o1, c1 = stops[i]
        if t <= o1:
            span = (o1 - o0) or 1e-6
            return tuple(int(round(v)) for v in lerp_colour(rgba_from_stop(c0), rgba_from_stop(c1), (t - o0) / span))
    return rgba_from_stop(stops[-1][1])


# ------------------------------------------------------------------- masks

def bbox_of(subpaths):
    x0 = y0 = float("inf")
    x1 = y1 = float("-inf")
    n = 0
    for sp in subpaths:
        for p in sp.get("pts", []):
            n += 1
            x0 = min(x0, p[0]); y0 = min(y0, p[1])
            x1 = max(x1, p[0]); y1 = max(y1, p[1])
    if not n:
        return None
    return (x0, y0, x1, y1)


def clamp_bbox(box, size, pad=0):
    if box is None:
        return None
    w, h = size
    x0 = max(0, int(math.floor(box[0] - pad)))
    y0 = max(0, int(math.floor(box[1] - pad)))
    x1 = min(w, int(math.ceil(box[2] + pad)) + 1)
    y1 = min(h, int(math.ceil(box[3] + pad)) + 1)
    if x1 <= x0 or y1 <= y0:
        return None
    return (x0, y0, x1, y1)


def poly_points(sp):
    pts = [(float(p[0]), float(p[1])) for p in sp.get("pts", [])]
    out = []
    for p in pts:
        if not out or abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9:
            out.append(p)
    return out


def mask_for(subpaths, box):
    """Rasterise subpaths into an 'L' mask cropped to box (XOR across subpaths)."""
    x0, y0, x1, y1 = box
    size = (x1 - x0, y1 - y0)
    mask = Image.new("L", size, 0)
    off = (-x0, -y0)
    multi = len(subpaths) > 1
    for sp in subpaths:
        pts = [(p[0] + off[0], p[1] + off[1]) for p in poly_points(sp)]
        if len(pts) < 2:
            continue
        sub = Image.new("L", size, 0)
        d = ImageDraw.Draw(sub)
        if len(pts) == 2:
            d.line([pts[0], pts[1]], fill=255, width=1)
        else:
            d.polygon(pts, fill=255)
        mask = ImageChops.logical_xor(mask, sub) if multi else sub
    return mask


# ----------------------------------------------------------------- strokes

def stroke_points(sp):
    pts = poly_points(sp)
    if len(pts) < 2:
        return []
    if sp.get("closed") and len(pts) > 2:
        pts = pts + [pts[0]]
    return pts


def apply_dash(pts, dash, offset):
    if not dash or len(pts) < 2:
        return [pts]
    out = []
    cur = []
    idx = 0
    dpos = -float(offset or 0.0)
    while dpos < 0:
        dpos += dash[idx % len(dash)]
        idx += 1
    on = (idx % 2) == 0
    remaining = dash[idx % len(dash)] - dpos
    for i in range(1, len(pts)):
        x0, y0 = pts[i - 1]
        x1, y1 = pts[i]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg <= 0:
            continue
        travelled = 0.0
        while travelled < seg - 1e-12:
            step = min(remaining, seg - travelled)
            f0 = travelled / seg
            f1 = (travelled + step) / seg
            p0 = (x0 + (x1 - x0) * f0, y0 + (y1 - y0) * f0)
            p1 = (x0 + (x1 - x0) * f1, y0 + (y1 - y0) * f1)
            if on:
                if not cur:
                    cur = [p0]
                cur.append(p1)
            else:
                if len(cur) > 1:
                    out.append(cur)
                cur = []
            travelled += step
            remaining -= step
            if remaining <= 1e-9:
                idx += 1
                on = not on
                remaining = dash[idx % len(dash)] or 1.0
    if len(cur) > 1:
        out.append(cur)
    return out


# ------------------------------------------------------------------- fonts

_font_cache = {}


def load_font(size, weight, style):
    key = (round(size), str(weight), str(style))
    if key in _font_cache:
        return _font_cache[key]
    bold = str(weight) in ("bold", "bolder") or (str(weight).isdigit() and int(weight) >= 600)
    italic = str(style) in ("italic", "oblique")
    if bold and italic:
        cands = [r"C:\Windows\Fonts\segoeuiz.ttf", r"C:\Windows\Fonts\arialbi.ttf"]
    elif bold:
        cands = FONT_BOLD_CANDIDATES
    elif italic:
        cands = FONT_ITALIC_CANDIDATES
    else:
        cands = []
    cands = cands + FONT_CANDIDATES
    px = max(1, int(round(size)))
    font = None
    for c in cands:
        if os.path.exists(c):
            try:
                font = ImageFont.truetype(c, px)
                break
            except Exception as exc:  # pragma: no cover
                log_warn("font %s failed: %s" % (c, exc))
    if font is None:
        try:
            font = ImageFont.load_default(size=px)
            log_warn("using Pillow's default bitmap font for size %s" % px)
        except Exception:
            font = ImageFont.load_default()
    _font_cache[key] = font
    return font


def text_anchor(align, baseline):
    h = {"start": "l", "left": "l", "center": "m", "right": "r", "end": "r"}.get(align, "l")
    v = {"alphabetic": "s", "top": "a", "hanging": "a", "middle": "m", "bottom": "d",
         "ideographic": "d"}.get(baseline, "s")
    return h + v


def measure(draw, text, font):
    try:
        return draw.textlength(text, font=font)
    except Exception:
        try:
            return font.getlength(text)
        except Exception:
            return len(text) * 6.0


# ----------------------------------------------------------------- drawing

class Raster(object):
    def __init__(self, w, h, background):
        self.size = (int(w), int(h))
        self.background = background
        self.base = Image.new("RGBA", self.size, parse_bg(background))
        self.clip = None
        self.stack = []

    def composite(self, layer, box, composite="source-over"):
        x0, y0, x1, y1 = box
        want = (x1 - x0, y1 - y0)
        if layer.size != want:
            layer = layer.resize(want)
        alpha = layer.getchannel("A")
        if self.clip is not None:
            alpha = ImageChops.multiply(alpha, self.clip.crop(box))
            layer.putalpha(alpha)
        if composite == "destination-out":
            region = self.base.crop(box)
            region.putalpha(ImageChops.multiply(region.getchannel("A"), ImageChops.invert(alpha)))
            self.base.paste(region, (x0, y0))
            return
        if composite == "lighter":
            region = self.base.crop(box)
            self.base.paste(ImageChops.add(region, layer), (x0, y0))
            return
        if composite == "copy":
            self.base.paste(layer, (x0, y0))
            return
        if composite not in ("source-over", "", None):
            log_warn("composite '%s' approximated as source-over" % composite)
        self.base.alpha_composite(layer, dest=(x0, y0))

    def shadow_pass(self, box, paint_fn, shadow, composite="source-over"):
        if not shadow:
            return
        blur = max(0.0, float(shadow.get("blur", 0) or 0))
        dx = float(shadow.get("dx", 0) or 0)
        dy = float(shadow.get("dy", 0) or 0)
        col = tuple(int(round(v)) for v in (shadow.get("rgba") or [0, 0, 0, 0.5]))
        pad = int(math.ceil(blur * 2 + abs(dx) + abs(dy) + 3))
        sbox = clamp_bbox((box[0] - pad + min(dx, 0), box[1] - pad + min(dy, 0),
                           box[2] + pad + max(dx, 0), box[3] + pad + max(dy, 0)), self.size)
        if sbox is None:
            return
        x0, y0, x1, y1 = sbox
        layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        try:
            paint_fn(d, (-x0, -y0), col)
        except Exception as exc:
            log_error("shadow pass failed: %s" % exc)
            return
        a = layer.getchannel("A")
        if blur > 0:
            a = a.filter(ImageFilter.GaussianBlur(blur / 2.0))
        tinted = Image.new("RGBA", layer.size, (col[0], col[1], col[2], 0))
        tinted.putalpha(a.point(lambda v: int(v * (col[3] / 255.0))))
        tinted = ImageChops.offset(tinted, int(round(dx)), int(round(dy)))
        self.composite(tinted, sbox, "source-over")

    def paint_layer(self, box, paint, alpha, mask=None):
        x0, y0, x1, y1 = box
        w, h = x1 - x0, y1 - y0
        if paint.get("kind") == "gradient":
            layer = gradient_image(paint.get("grad") or {}, (w, h), (x0, y0))
        else:
            layer = Image.new("RGBA", (w, h), rgba(paint, alpha))
        if alpha != 1.0 and paint.get("kind") == "gradient":
            a = layer.getchannel("A").point(lambda v: int(v * max(0.0, min(1.0, alpha))))
            layer.putalpha(a)
        if mask is not None:
            layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
        return layer


def parse_bg(background):
    try:
        from PIL import ImageColor
        c = ImageColor.getrgb(str(background))
        return (c[0], c[1], c[2], 255)
    except Exception:
        return (255, 255, 255, 255)


def gradient_image(grad, size, origin):
    w, h = size
    stops = grad.get("stops") or []
    if not stops:
        return Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if len(stops) == 1:
        return Image.new("RGBA", (w, h), rgba_from_stop(stops[0][1]))
    gtype = grad.get("type", "linear")
    if gtype == "conic":
        log_warn("conic gradient flattened to its first stop")
        return Image.new("RGBA", (w, h), rgba_from_stop(stops[0][1]))
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    if gtype == "radial":
        cx = float(grad.get("x0", 0)) - origin[0]
        cy = float(grad.get("y0", 0)) - origin[1]
        r0 = max(0.0, float(grad.get("r0", 0) or 0))
        r1 = max(1e-6, float(grad.get("r1", 1) or 1))
        for y in range(h):
            dy = y - cy
            for x in range(w):
                t = (math.hypot(x - cx, dy) - r0) / (r1 - r0)
                px[x, y] = gradient_colour_at(stops, t)
        return img
    x0 = float(grad.get("x0", 0)) - origin[0]
    y0 = float(grad.get("y0", 0)) - origin[1]
    x1 = float(grad.get("x1", w)) - origin[0]
    y1 = float(grad.get("y1", h)) - origin[1]
    dx, dy = x1 - x0, y1 - y0
    denom = dx * dx + dy * dy
    if denom < 1e-9:
        return Image.new("RGBA", (w, h), rgba_from_stop(stops[-1][1]))
    for y in range(h):
        for x in range(w):
            px[x, y] = gradient_colour_at(stops, ((x - x0) * dx + (y - y0) * dy) / denom)
    return img


def draw_stroke_into(draw, subpaths, width, cap, join, colour, dash, dash_offset, off=(0, 0)):
    wpx = max(1, int(round(width)))
    for sp in subpaths:
        pts = stroke_points(sp)
        if len(pts) < 2:
            continue
        shifted = [(p[0] + off[0], p[1] + off[1]) for p in pts]
        for seg in apply_dash(shifted, dash, dash_offset):
            if len(seg) < 2:
                continue
            if join == "round":
                try:
                    draw.line(seg, fill=colour, width=wpx, joint="curve")
                except TypeError:
                    draw.line(seg, fill=colour, width=wpx)
            else:
                draw.line(seg, fill=colour, width=wpx)
        if wpx > 2 and (cap == "round" or join == "round"):
            r = wpx / 2.0
            for p in shifted:
                draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=colour)


def op_fill(ras, op):
    subpaths = op.get("subpaths") or []
    if not subpaths:
        return
    paint = op.get("paint") or {"kind": "color", "rgba": [0, 0, 0, 1]}
    alpha = float(op.get("alpha", 1.0))
    composite = op.get("composite", "source-over")
    box = clamp_bbox(bbox_of(subpaths), ras.size)
    if box is None:
        return
    if len(subpaths) > 1:
        log_warn("multi-subpath fill XOR-combined (even-odd approximation)")

    def paint_into(d, off, colour):
        for sp in subpaths:
            pts = [(p[0] + off[0], p[1] + off[1]) for p in poly_points(sp)]
            if len(pts) >= 3:
                d.polygon(pts, fill=colour)
            elif len(pts) == 2:
                d.line(pts, fill=colour, width=1)

    if op.get("shadow"):
        ras.shadow_pass(box, paint_into, op["shadow"], composite)

    flat = paint.get("kind") != "gradient"
    if flat and composite in ("source-over", "", None) and ras.clip is None:
        d = ImageDraw.Draw(ras.base)
        paint_into(d, (0, 0), rgba(paint, alpha))
        return

    mask = mask_for(subpaths, box)
    layer = ras.paint_layer(box, paint, alpha, mask)
    ras.composite(layer, box, composite)


def op_stroke(ras, op):
    subpaths = op.get("subpaths") or []
    if not subpaths:
        return
    paint = op.get("paint") or {"kind": "color", "rgba": [0, 0, 0, 1]}
    alpha = float(op.get("alpha", 1.0))
    width = float(op.get("width", 1.0))
    cap = op.get("cap", "butt")
    join = op.get("join", "miter")
    dash = op.get("dash") or []
    dash_offset = float(op.get("dashOffset", 0) or 0)
    composite = op.get("composite", "source-over")
    box = clamp_bbox(bbox_of(subpaths), ras.size, width + 4)
    if box is None:
        return

    def stroke_into(d, off, colour):
        draw_stroke_into(d, subpaths, width, cap, join, colour, dash, dash_offset, off)

    if op.get("shadow"):
        ras.shadow_pass(box, stroke_into, op["shadow"], composite)

    flat = paint.get("kind") != "gradient"
    if flat and composite in ("source-over", "", None) and ras.clip is None:
        stroke_into(ImageDraw.Draw(ras.base), (0, 0), rgba(paint, alpha))
        return

    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    stroke_into(ImageDraw.Draw(layer), (-x0, -y0), rgba(paint, alpha) if flat else (255, 255, 255, 255))
    if not flat:
        grad_layer = ras.paint_layer(box, paint, alpha, None)
        grad_layer.putalpha(ImageChops.multiply(grad_layer.getchannel("A"), layer.getchannel("A")))
        layer = grad_layer
    ras.composite(layer, box, composite)


def op_rect(ras, op):
    x, y, w, h = op["x"], op["y"], op["w"], op["h"]
    alpha = float(op.get("alpha", 1.0))
    composite = op.get("composite", "source-over")
    if op.get("fill"):
        sub = [{"pts": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "closed": True, "kind": "rect"}]
        op_fill(ras, {"subpaths": sub, "paint": op["fill"], "alpha": alpha, "rule": "nonzero",
                      "shadow": op.get("shadow"), "composite": composite})
    if op.get("stroke"):
        sub = [{"pts": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "closed": True, "kind": "rect"}]
        op_stroke(ras, {"subpaths": sub, "paint": op["stroke"], "alpha": alpha,
                        "width": op.get("width", 1), "cap": op.get("cap", "butt"),
                        "join": op.get("join", "miter"), "dash": op.get("dash") or [],
                        "dashOffset": op.get("dashOffset", 0), "shadow": op.get("shadow"),
                        "composite": composite})


def op_text(ras, op):
    text = op.get("text", "")
    if not text:
        return
    font_info = op.get("font") or {}
    m = op.get("matrix") or [1, 0, 0, 1, 0, 0]
    a, b, c, d, e, f = m
    scale = math.hypot(a, b) or 1.0
    angle = math.degrees(math.atan2(b, a))
    size = max(1.0, float(font_info.get("size", 10)) * scale)
    font = load_font(size, font_info.get("weight", "normal"), font_info.get("style", "normal"))
    anchor = text_anchor(op.get("align", "start"), op.get("baseline", "alphabetic"))
    alpha = float(op.get("alpha", 1.0))
    fill = op.get("fill")
    stroke = op.get("stroke")
    if fill is None and stroke is None:
        return

    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    tw = max(4.0, measure(probe, text, font))
    try:
        asc, desc = font.getmetrics()
    except Exception:
        asc, desc = size, size * 0.25
    pad = int(math.ceil(max(tw, size * 2) + abs(e) + 16))
    box = clamp_bbox((op["x"] - pad, op["y"] - pad - abs(f), op["x"] + pad, op["y"] + pad + abs(f)), ras.size)
    if box is None:
        return
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pos = (op["x"] - x0, op["y"] - y0)
    col = rgba(fill, alpha) if fill else None
    try:
        if col:
            d.text(pos, text, font=font, fill=col, anchor=anchor)
        if stroke:
            sc = rgba(stroke, alpha)
            try:
                d.text(pos, text, font=font, fill=None,
                       stroke_width=max(1, int(round(float(op.get("strokeWidth", 1))))),
                       stroke_fill=sc, anchor=anchor)
            except Exception:
                d.text(pos, text, font=font, fill=sc, anchor=anchor)
    except Exception:
        ax = {"l": 0.0, "m": -tw / 2.0, "r": -tw}.get(anchor[0], 0.0)
        ay = {"a": 0.0, "t": 0.0, "m": -asc / 2.0, "s": -asc, "d": -asc - desc * 0.2}.get(anchor[1], 0.0)
        d.text((pos[0] + ax, pos[1] + ay), text, font=font, fill=col or rgba(stroke, alpha))
    if abs(angle) > 0.05:
        layer = layer.rotate(-angle, resample=Image.BICUBIC, expand=False)
    ras.composite(layer, box, "source-over")


def op_image(ras, op):
    x, y, w, h = op["x"], op["y"], op["w"], op["h"]
    if w <= 0 or h <= 0:
        return
    box = clamp_bbox((min(x, x + w), min(y, y + h), max(x, x + w), max(y, y + h)), ras.size)
    if box is None:
        return
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (176, 176, 176, 90))
    ImageDraw.Draw(layer).rectangle([0, 0, x1 - x0 - 1, y1 - y0 - 1], outline=(128, 128, 128, 255), width=1)
    ras.composite(layer, box, "source-over")


def op_clear(ras, op):
    box = clamp_bbox((op["x"], op["y"], op["x"] + op["w"], op["y"] + op["h"]), ras.size)
    if box is None:
        return
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([0, 0, x1 - x0 - 1, y1 - y0 - 1], fill=parse_bg(ras.background))
    ras.composite(layer, box, "source-over")


def run(data):
    ras = Raster(data["w"], data["h"], data.get("background", "#ffffff"))
    for op in data.get("ops", []):
        _LOGS["ops"] += 1
        t = op.get("t")
        try:
            if t == "save":
                ras.stack.append(ras.clip)
            elif t == "restore":
                ras.clip = ras.stack.pop() if ras.stack else None
            elif t == "clip":
                subs = op.get("subpaths") or []
                box = clamp_bbox(bbox_of(subs), ras.size)
                if box is None:
                    ras.clip = Image.new("L", ras.size, 0)
                else:
                    m = mask_for(subs, box)
                    full = Image.new("L", ras.size, 0)
                    full.paste(m, (box[0], box[1]))
                    ras.clip = full if ras.clip is None else ImageChops.multiply(ras.clip, full)
            elif t == "fill":
                op_fill(ras, op)
            elif t == "stroke":
                op_stroke(ras, op)
            elif t == "rect":
                op_rect(ras, op)
            elif t == "text":
                op_text(ras, op)
            elif t == "image":
                op_image(ras, op)
            elif t == "clear":
                op_clear(ras, op)
            else:
                log_warn("unknown op '%s'" % t)
            _LOGS["drawn"] += 1
        except Exception as exc:  # one bad op must not kill the shot
            log_error("op %s failed: %s" % (t, exc))
    return ras.base


def main(argv):
    if len(argv) < 3:
        sys.stderr.write("usage: mockdom_raster.py <ops.json> <out.png> [log.json]\n")
        return 2
    json_path, out_path = argv[1], argv[2]
    log_path = argv[3] if len(argv) > 3 else None
    with open(json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    img = run(data)
    out_dir = os.path.dirname(os.path.abspath(out_path))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG")
    if log_path:
        try:
            with open(log_path, "w", encoding="utf-8") as fh:
                json.dump({"ok": len(_LOGS["errors"]) == 0, "ops": _LOGS["ops"], "drawn": _LOGS["drawn"],
                           "errors": _LOGS["errors"], "warnings": _LOGS["warnings"],
                           "w": data["w"], "h": data["h"]}, fh, indent=1)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
