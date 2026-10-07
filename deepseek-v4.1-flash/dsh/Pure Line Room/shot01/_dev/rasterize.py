#!/usr/bin/env python
"""_dev/rasterize.py — replay harness draw ops into a PNG with Pillow.

Input JSON: {"w": int, "h": int, "calls": [ ... ]} where each call is one of
  {"op":"fill","sub":[[[x,y],...]],"style":color,"alpha":f,"clip":[x0,y0,x1,y1]}
  {"op":"stroke","sub":[[[x,y],...]],"style":color,"width":f,"alpha":f,"clip":[...]}
  {"op":"text","text":str,"a":[x,y],"style":color,"font":"12px x","alpha":f}
  {"op":"clear",...} / {"op":"save"} / {"op":"restore"} / anything else -> ignored
`style` is a CSS color string, or {"__gradient":true,"__stops":[[off,color]...]}
(gradients are approximated by their last stop, which is enough to judge layout).

Usage: python rasterize.py ops.json out.png [result.txt]
The result file receives "OK <path>" or "FAIL <traceback>" — needed because this
sandbox forbids capturing a child process's stdio through pipes.
"""
import json
import re
import sys
import traceback

from PIL import Image, ImageChops, ImageDraw, ImageFont

SS = 2  # supersample factor


def parse_color(c, alpha=1.0):
    if isinstance(c, dict):
        stops = c.get("__stops") or []
        c = stops[-1][1] if stops else "#cccccc"
    if not isinstance(c, str):
        return (0, 0, 0, 0)
    c = c.strip()
    if c.startswith("#"):
        if len(c) == 7:
            r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
            a = 255
        elif len(c) == 4:
            r, g, b = int(c[1] * 2, 16), int(c[2] * 2, 16), int(c[3] * 2, 16)
            a = 255
        else:
            return (0, 0, 0, 0)
    else:
        m = re.match(r"rgba?\(([^)]+)\)", c)
        if not m:
            return (0, 0, 0, 0)
        parts = [p.strip() for p in m.group(1).split(",")]
        r, g, b = (int(float(parts[i])) for i in range(3))
        a = int(float(parts[3]) * 255) if len(parts) > 3 else 255
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)),
            max(0, min(255, int(a * alpha))))


def bbox_of(subpaths, pad=2):
    mnx = mny = 1e18
    mxx = mxy = -1e18
    for sub in subpaths:
        for p in sub:
            if p[0] < mnx:
                mnx = p[0]
            if p[0] > mxx:
                mxx = p[0]
            if p[1] < mny:
                mny = p[1]
            if p[1] > mxy:
                mxy = p[1]
    if mnx > mxx:
        return None
    return (mnx - pad, mny - pad, mxx + pad, mxy + pad)


def intersects(a, b):
    if not a or not b:
        return True
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def clip_mask(size, box, shapes):
    """Clip mask: the bbox, intersected with every recorded clip polygon.

    A polygon clip matters here — the view through the window is clipped to the
    projected opening, which is a trapezoid, and using its bounding box would
    spill the sky across the wall beside it.
    """
    m = Image.new("L", size, 0)
    if not box:
        m.paste(255, (0, 0, size[0], size[1]))
    else:
        x0, y0, x1, y1 = [int(round(v * SS)) for v in box]
        x0 = max(0, min(size[0], x0)); x1 = max(0, min(size[0], x1))
        y0 = max(0, min(size[1], y0)); y1 = max(0, min(size[1], y1))
        if x1 > x0 and y1 > y0:
            m.paste(255, (x0, y0, x1, y1))
    for shape in (shapes or []):
        if not shape:
            continue
        if isinstance(shape[0], dict):      # a bbox-only entry
            b = shape[0]["box"]
            sub = [[(b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]]
        else:
            sub = shape
        poly = Image.new("L", size, 0)
        pd = ImageDraw.Draw(poly)
        for s in sub:
            if len(s) < 3:
                continue
            pd.polygon([(p[0] * SS, p[1] * SS) for p in s], fill=255)
        m = ImageChops.multiply(m, poly)
    return m


def run(src, dst):
    with open(src, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    w, h = int(data["w"]), int(data["h"])
    size = (w * SS, h * SS)
    img = Image.new("RGBA", size, (255, 255, 255, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    font_cache = {}
    whole = (0.0, 0.0, float(w), float(h))
    stats = {"fill": 0, "stroke": 0, "text": 0, "skip": 0}

    def region(op, pad):
        bb = bbox_of(op.get("sub", []), pad)
        clip = op.get("clip") or whole
        if bb is None or not intersects(bb, clip):
            return None
        x0 = max(0, int(max(bb[0], clip[0]) * SS))
        y0 = max(0, int(max(bb[1], clip[1]) * SS))
        x1 = min(size[0], int(min(bb[2], clip[2]) * SS) + 2)
        y1 = min(size[1], int(min(bb[3], clip[3]) * SS) + 2)
        if x1 <= x0 or y1 <= y0:
            return None
        return (x0, y0, x1, y1)

    for op in data.get("calls", []):
        kind = op.get("op")
        if kind == "fill":
            col = parse_color(op.get("style"), float(op.get("alpha", 1.0)))
            if col[3] == 0:
                stats["skip"] += 1
                continue
            box = region(op, 2)
            if not box:
                stats["skip"] += 1
                continue
            x0, y0, x1, y1 = box
            layer = Image.new("RGBA", (x1 - x0, y1 - y0), col[:3] + (0,))
            ld = ImageDraw.Draw(layer, "RGBA")
            for sub in op.get("sub", []):
                if len(sub) < 3:
                    continue
                ld.polygon([(p[0] * SS - x0, p[1] * SS - y0) for p in sub], fill=col)
            a = clip_mask(size, op.get("clip"), op.get("clipShapes"))
            if a is not None:
                a = a.crop((x0, y0, x1, y1))
                la = layer.split()[3]
                layer.putalpha(ImageChops.multiply(la, a))
            img.paste(layer, (x0, y0), layer)
            stats["fill"] += 1
        elif kind == "stroke":
            col = parse_color(op.get("style"), float(op.get("alpha", 1.0)))
            if col[3] == 0:
                stats["skip"] += 1
                continue
            width = max(1, int(round(float(op.get("width", 1)) * SS)))
            box = region(op, width + 2)
            if not box:
                stats["skip"] += 1
                continue
            x0, y0, x1, y1 = box
            layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer, "RGBA")
            for sub in op.get("sub", []):
                if len(sub) < 2:
                    continue
                pts = [(p[0] * SS - x0, p[1] * SS - y0) for p in sub]
                ld.line(pts, fill=col, width=width, joint="curve")
                r = width / 2.0
                for p in (pts[0], pts[-1]):
                    ld.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=col)
            a = clip_mask(size, op.get("clip"), op.get("clipShapes"))
            if a is not None:
                a = a.crop((x0, y0, x1, y1))
                layer.putalpha(ImageChops.multiply(layer.split()[3], a))
            img.paste(layer, (x0, y0), layer)
            stats["stroke"] += 1
        elif kind == "text":
            col = parse_color(op.get("style"), float(op.get("alpha", 1.0)))
            m = re.search(r"(\d+(?:\.\d+)?)px", op.get("font", ""))
            px = int((float(m.group(1)) if m else 10) * SS)
            f = font_cache.get(px)
            if f is None:
                try:
                    f = ImageFont.truetype("consola.ttf", px)
                except Exception:
                    f = ImageFont.load_default()
                font_cache[px] = f
            draw.text((op["a"][0] * SS, op["a"][1] * SS), op.get("text", ""), fill=col, font=f)
            stats["text"] += 1

    img = img.convert("RGB").resize((w, h), Image.LANCZOS)
    img.save(dst)
    return stats


def main():
    src, dst = sys.argv[1], sys.argv[2]
    result_file = sys.argv[3] if len(sys.argv) > 3 else None
    try:
        stats = run(src, dst)
        if result_file:
            with open(result_file, "w", encoding="utf-8") as fh:
                fh.write("OK " + dst + " " + json.dumps(stats))
    except Exception as exc:  # noqa: BLE001 - report, never crash the caller
        if result_file:
            with open(result_file, "w", encoding="utf-8") as fh:
                fh.write("FAIL " + repr(exc) + "\n" + traceback.format_exc()[-1500:])
        else:
            raise


if __name__ == "__main__":
    main()
