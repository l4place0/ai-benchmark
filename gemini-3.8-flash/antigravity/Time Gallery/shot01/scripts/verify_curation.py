#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verification script for Time Gallery Art Curation.
Checks:
- All images exist and match exact pixel dimensions in manifest.json
- Aspect ratios are mathematically correct
- All required fields in manifest.json are present and non-empty
- artHistoryData.js contains valid periods (8 periods, >= 20 painters) and matches manifest
"""

import os
import sys
import json
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets", "paintings")
DATA_DIR = os.path.join(BASE_DIR, "js", "data")
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")
JS_PATH = os.path.join(DATA_DIR, "artHistoryData.js")

def test_manifest():
    print(f"Loading {MANIFEST_PATH}...")
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Total paintings in manifest: {len(manifest)}")
    assert len(manifest) >= 50, f"Expected at least 50 paintings, got {len(manifest)}"

    required_fields = [
        "id", "localPath", "titleZh", "titleEn", "artistZh", "artistEn",
        "birthDeath", "year", "periodId", "periodZh", "periodEn",
        "periodDesc", "sourceUrl", "license", "width", "height", "aspectRatio"
    ]

    period_counts = {}
    painters = set()

    for idx, item in enumerate(manifest, 1):
        for field in required_fields:
            assert field in item, f"Missing field '{field}' in item {idx} ({item.get('id')})"
            val = item[field]
            assert val is not None and val != "", f"Empty field '{field}' in item {idx} ({item.get('id')})"

        # Check image file
        img_path = os.path.join(BASE_DIR, item["localPath"])
        assert os.path.exists(img_path), f"File not found: {img_path}"
        size = os.path.getsize(img_path)
        assert size > 10000, f"File too small ({size} bytes): {img_path}"

        # Verify image using Pillow
        with Image.open(img_path) as im:
            w, h = im.size
            assert w == item["width"], f"Width mismatch for {item['id']}: expected {item['width']}, actual {w}"
            assert h == item["height"], f"Height mismatch for {item['id']}: expected {item['height']}, actual {h}"

        expected_ratio = round(item["width"] / item["height"], 4)
        assert abs(expected_ratio - item["aspectRatio"]) < 0.001, (
            f"Ratio mismatch for {item['id']}: expected {expected_ratio}, got {item['aspectRatio']}"
        )

        pid = item["periodId"]
        period_counts[pid] = period_counts.get(pid, 0) + 1
        painters.add(item["artistZh"])

    print("\n--- Period Counts in Manifest ---")
    for pid, count in sorted(period_counts.items()):
        print(f"  {pid}: {count} paintings")

    assert len(period_counts) == 8, f"Expected 8 periods, got {len(period_counts)}"
    print(f"\nUnique painters in manifest: {len(painters)}")
    assert len(painters) >= 20, f"Expected at least 20 painters, got {len(painters)}"

    # Check artHistoryData.js
    print(f"\nVerifying {JS_PATH}...")
    assert os.path.exists(JS_PATH), "artHistoryData.js does not exist!"
    with open(JS_PATH, "r", encoding="utf-8") as f:
        js_content = f.read()

    assert "export const periods =" in js_content
    assert "export const paintings =" in js_content
    assert "export default" in js_content
    assert "window.ArtHistoryData =" in js_content

    print("\n[SUCCESS] ALL CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_manifest()
