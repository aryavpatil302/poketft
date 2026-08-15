#!/usr/bin/env python3
"""
extract_icons.py — extract trait badge icons from a screenshot.

Usage:
  python3 scripts/extract_icons.py [image1.png image2.png ...]

If no files are given, a file-picker dialog opens so you can select one or more images.
Each detected icon is saved as   <stem>_1.png, <stem>_2.png, …  next to the source file
(or to --outdir if specified).

Options:
  --outdir PATH   Directory to write output PNGs (default: same folder as input)
  --prefix NAME   Override output filename prefix (default: input stem)
  --bg R,G,B      Background colour to remove (default: auto-detect from corners)
  --tol N         Colour tolerance for background detection (default: 80)
  --pad N         Padding in pixels added around each icon (default: 4)
"""

import sys
import os
import argparse
from pathlib import Path
from collections import deque

try:
    from PIL import Image, ImageFilter
    import numpy as np
except ImportError:
    sys.exit("Missing dependencies. Run:  pip3 install Pillow numpy")


# ─── Background removal ────────────────────────────────────────────────────────

def detect_bg_color(arr):
    """Sample the four corners to determine the background colour."""
    corners = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    return tuple(int(np.median([c[i] for c in corners])) for i in range(3))


def flood_fill_bg(arr, bg, tol):
    """BFS from every edge pixel that matches `bg` within `tol`."""
    h, w = arr.shape[:2]
    mask = np.zeros((h, w), dtype=bool)
    br, bg_, bb = bg

    def matches(r, c):
        return (abs(int(arr[r, c, 0]) - br) < tol and
                abs(int(arr[r, c, 1]) - bg_) < tol and
                abs(int(arr[r, c, 2]) - bb) < tol)

    q = deque()
    for col in range(w):
        for row in [0, h - 1]:
            if matches(row, col) and not mask[row, col]:
                mask[row, col] = True
                q.append((row, col))
    for row in range(h):
        for col in [0, w - 1]:
            if matches(row, col) and not mask[row, col]:
                mask[row, col] = True
                q.append((row, col))

    while q:
        r, c = q.popleft()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and not mask[nr, nc] and matches(nr, nc):
                mask[nr, nc] = True
                q.append((nr, nc))

    return mask


# ─── Icon detection ────────────────────────────────────────────────────────────

def find_icon_boxes(is_content, merge_gap=20):
    """Find bounding boxes of distinct icon groups (row-major order).

    merge_gap: column groups separated by fewer than this many pixels of
               background are merged into one icon (handles inactive icons
               where the hexagon and pill badge have a small gap between them).
    """
    row_has = is_content.any(axis=1)

    # Split into horizontal bands
    row_groups = []
    in_band = False
    for i, has in enumerate(row_has):
        if has and not in_band:
            start = i; in_band = True
        elif not has and in_band:
            row_groups.append((start, i - 1)); in_band = False
    if in_band:
        row_groups.append((start, len(row_has) - 1))

    boxes = []
    for r0, r1 in row_groups:
        col_has = is_content[r0:r1 + 1, :].any(axis=0)

        # Collect raw column segments
        segments = []
        in_col = False
        for i, has in enumerate(col_has):
            if has and not in_col:
                cs = i; in_col = True
            elif not has and in_col:
                segments.append((cs, i - 1)); in_col = False
        if in_col:
            segments.append((cs, len(col_has) - 1))

        # Merge segments whose gap is smaller than merge_gap
        merged = []
        for seg in segments:
            if merged and seg[0] - merged[-1][1] <= merge_gap:
                merged[-1] = (merged[-1][0], seg[1])
            else:
                merged.append(list(seg))

        for c0, c1 in merged:
            boxes.append((r0, r1, c0, c1))

    return boxes


# ─── Extraction ────────────────────────────────────────────────────────────────

def extract_icons(src_path, outdir, prefix, bg_override, tol, pad, merge_gap=20):
    img = Image.open(src_path).convert('RGBA')
    arr = np.array(img)

    bg = bg_override if bg_override else detect_bg_color(arr)
    print(f"  background colour detected as RGB{bg}")

    bg_mask = flood_fill_bg(arr, bg, tol)
    is_content = ~bg_mask

    boxes = find_icon_boxes(is_content, merge_gap=merge_gap)
    print(f"  found {len(boxes)} icon(s)")

    saved = []
    for idx, (r0, r1, c0, c1) in enumerate(boxes, start=1):
        r0p = max(0, r0 - pad);  r1p = min(arr.shape[0], r1 + pad + 1)
        c0p = max(0, c0 - pad);  c1p = min(arr.shape[1], c1 + pad + 1)

        crop = arr[r0p:r1p, c0p:c1p].copy()
        crop[bg_mask[r0p:r1p, c0p:c1p], 3] = 0

        # Erode opaque region by 2px (two passes of MinFilter) to kill
        # any anti-aliased fringe that survived the flood-fill.
        alpha = Image.fromarray(crop[:, :, 3])
        alpha = alpha.filter(ImageFilter.MinFilter(3))
        alpha = alpha.filter(ImageFilter.MinFilter(3))
        crop[:, :, 3] = np.array(alpha)

        stem = prefix or Path(src_path).stem
        out_path = Path(outdir) / f"{stem}_{idx}.png"
        Image.fromarray(crop, 'RGBA').save(out_path)
        saved.append(out_path)
        print(f"    [{idx}] {out_path.name}  ({c1p-c0p}×{r1p-r0p})")

    return saved


# ─── File picker (fallback when no CLI args) ───────────────────────────────────

def pick_files():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        paths = filedialog.askopenfilenames(
            title="Select icon sheet(s)",
            filetypes=[("Images", "*.png *.jpg *.jpeg *.webp"), ("All files", "*.*")],
        )
        root.destroy()
        return list(paths)
    except Exception as e:
        sys.exit(f"No input files given and file picker failed: {e}\n"
                 "Usage: python3 extract_icons.py image1.png image2.png …")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_color(s):
    parts = s.split(',')
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("Colour must be R,G,B  e.g. 237,154,219")
    return tuple(int(p) for p in parts)


def main():
    parser = argparse.ArgumentParser(
        description="Extract trait badge icons from a screenshot with transparent background.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument('files', nargs='*', help='Input image file(s)')
    parser.add_argument('--outdir', default=None,
                        help='Output directory (default: same folder as each input)')
    parser.add_argument('--prefix', default=None,
                        help='Output filename prefix (default: input filename stem)')
    parser.add_argument('--bg', type=parse_color, default=None, metavar='R,G,B',
                        help='Background colour to remove (default: auto from corners)')
    parser.add_argument('--tol', type=int, default=50,
                        help='Colour tolerance 0-255 (default: 80)')
    parser.add_argument('--pad', type=int, default=4,
                        help='Pixel padding around each icon (default: 4)')
    parser.add_argument('--merge-gap', type=int, default=20, dest='merge_gap',
                        help='Max pixel gap between column segments to merge into one icon (default: 20)')
    args = parser.parse_args()

    files = args.files or pick_files()
    if not files:
        sys.exit("No files selected.")

    total = 0
    for src in files:
        src = Path(src)
        if not src.exists():
            print(f"WARNING: {src} not found — skipping")
            continue
        outdir = args.outdir or src.parent
        os.makedirs(outdir, exist_ok=True)
        print(f"\nProcessing: {src.name}")
        saved = extract_icons(src, outdir, args.prefix, args.bg, args.tol, args.pad, args.merge_gap)
        total += len(saved)

    print(f"\nDone — {total} icon(s) saved.")


if __name__ == '__main__':
    main()
