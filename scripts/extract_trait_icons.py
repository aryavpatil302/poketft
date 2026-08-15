#!/usr/bin/env python3
"""
extract_trait_icons.py — Slice a sprite-sheet of trait icons into individual PNGs.

Usage:
  python scripts/extract_trait_icons.py \\
    --src  "public/visuals/trait icons/Stalwart_icons.png" \\
    --out  "public/visuals/trait icons" \\
    --name stalwart \\
    --cols 3 --rows 2 \\
    [--height 230] \\
    [--bg 237,154,219] \\
    [--tolerance 60] \\
    [--defringe 2] \\
    [--start 1]

Column separators are detected per-row so rows with different icon widths
are handled correctly.  After background removal a defringe pass erodes the
alpha channel slightly to eliminate anti-aliased pink edges.
"""

import argparse
import os
import numpy as np
from PIL import Image


def parse_color(s: str) -> np.ndarray:
    parts = [int(x.strip()) for x in s.split(',')]
    if len(parts) != 3:
        raise ValueError(f"Color must be R,G,B — got '{s}'")
    return np.array(parts, dtype=int)


def is_bg_mask(arr: np.ndarray, bg: np.ndarray, tol: int) -> np.ndarray:
    """Boolean mask (H×W) — True where a pixel is within `tol` of background."""
    diff = np.abs(arr[:, :, :3].astype(int) - bg)
    return np.all(diff <= tol, axis=2)


def find_row_cuts(arr: np.ndarray, bg: np.ndarray, tol: int, n: int) -> list[int]:
    """Find n+1 y-cut positions by scanning the full image width."""
    mask_bg  = is_bg_mask(arr, bg, tol)
    non_bg   = (~mask_bg).sum(axis=1).astype(float)   # H: pixels per row
    return _find_cuts(non_bg, n)


def find_col_cuts_in_band(arr: np.ndarray, bg: np.ndarray, tol: int,
                          n: int, y0: int, y1: int) -> list[int]:
    """Find n+1 x-cut positions using only the pixels within y0:y1."""
    band    = arr[y0:y1, :, :]
    mask_bg = is_bg_mask(band, bg, tol)
    non_bg  = (~mask_bg).sum(axis=0).astype(float)    # W: pixels per column
    return _find_cuts(non_bg, n)


def _find_cuts(non_bg: np.ndarray, n: int) -> list[int]:
    """
    Detect n-1 separator positions in a 1-D density array.

    Smooths with a box filter (~10% cell width) so wide sustained troughs
    (real gaps) are preferred over narrow edge dips.
    """
    total     = int(len(non_bg))
    cell_size = total / n
    win       = max(5, int(cell_size * 0.10))
    kernel    = np.ones(win) / win
    smoothed  = np.convolve(non_bg, kernel, mode='same')
    radius    = max(1, int(cell_size * 0.40))

    cuts = [0]
    for k in range(1, n):
        ideal = round(k * cell_size)
        lo    = max(1, ideal - radius)
        hi    = min(total - 1, ideal + radius)
        best  = int(np.argmin(smoothed[lo:hi + 1])) + lo
        cuts.append(best)
    cuts.append(total)
    return cuts


def remove_bg(arr: np.ndarray, bg: np.ndarray, tol: int) -> np.ndarray:
    out = arr.copy()
    out[is_bg_mask(arr, bg, tol)] = [0, 0, 0, 0]
    return out


def defringe(arr: np.ndarray, bg: np.ndarray, tol: int, radius: int) -> np.ndarray:
    """
    Remove anti-aliased background fringe.  Each pass zeros any visible pixel
    that (a) is within `tol` of the background colour AND (b) has at least one
    fully-transparent neighbour.  Uses the same tolerance as the main removal
    so blended edge pixels are caught consistently.
    """
    if radius <= 0:
        return arr
    out = arr.copy()

    for _ in range(radius):
        diff   = np.abs(out[:, :, :3].astype(int) - bg)
        is_bg  = np.all(diff <= tol, axis=2)
        empty  = (out[:, :, 3] == 0)
        has_empty_nb = (
            np.roll(empty, 1,  axis=0) |
            np.roll(empty, -1, axis=0) |
            np.roll(empty, 1,  axis=1) |
            np.roll(empty, -1, axis=1)
        )
        mask = is_bg & has_empty_nb & (out[:, :, 3] > 0)
        out[mask] = [0, 0, 0, 0]

    return out


def content_bbox(arr: np.ndarray, bg: np.ndarray, tol: int):
    """Tight bounding box (top, left, bottom, right) of non-background pixels."""
    mask = ~is_bg_mask(arr, bg, tol)
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any():
        return None
    rmin = int(np.where(rows)[0][0]);  rmax = int(np.where(rows)[0][-1])
    cmin = int(np.where(cols)[0][0]);  cmax = int(np.where(cols)[0][-1])
    return rmin, cmin, rmax + 1, cmax + 1


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument('--src',       required=True,  help='Source sprite sheet PNG')
    ap.add_argument('--out',       required=True,  help='Output directory')
    ap.add_argument('--name',      required=True,  help='Output filename prefix (e.g. "stalwart")')
    ap.add_argument('--cols',      type=int, required=True, help='Number of icon columns')
    ap.add_argument('--rows',      type=int, required=True, help='Number of icon rows')
    ap.add_argument('--height',    type=int, default=230,          help='Output height in px (default 230)')
    ap.add_argument('--bg',        default='116,251,76',           help='Background colour R,G,B (default 116,251,76 = green)')
    ap.add_argument('--tolerance', type=int, default=60,           help='Background removal tolerance (default 60)')
    ap.add_argument('--defringe',     type=int,   default=2,   help='Defringe passes to remove AA edge (default 2)')
    ap.add_argument('--defringe-tol', type=float, default=1.4, help='Defringe tolerance multiplier vs main tolerance (default 1.4)')
    ap.add_argument('--start',     type=int, default=1,            help='Starting output index (default 1)')
    args = ap.parse_args()

    bg  = parse_color(args.bg)
    tol = args.tolerance

    src_path = args.src if os.path.isabs(args.src) else os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', args.src))
    out_dir  = args.out if os.path.isabs(args.out) else os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', args.out))
    os.makedirs(out_dir, exist_ok=True)

    img = Image.open(src_path).convert('RGBA')
    arr = np.array(img)

    # Row cuts: use full image width
    y_cuts = find_row_cuts(arr, bg, tol, args.rows)
    print(f'Row cuts: {y_cuts}')

    idx = args.start
    for ri in range(args.rows):
        y0, y1 = y_cuts[ri], y_cuts[ri + 1]

        # Column cuts: computed per-row so different row widths are handled
        x_cuts = find_col_cuts_in_band(arr, bg, tol, args.cols, y0, y1)
        print(f'Row {ri} column cuts: {x_cuts}')

        for ci in range(args.cols):
            x0, x1 = x_cuts[ci], x_cuts[ci + 1]

            cell = arr[y0:y1, x0:x1]
            bbox = content_bbox(cell, bg, tol)
            if bbox is None:
                print(f'  [--] row={ri} col={ci}: no content — skipping (idx stays {idx})')
                continue

            top, left, bottom, right = bbox
            cropped  = remove_bg(cell[top:bottom, left:right], bg, tol)
            df_tol   = int(tol * args.defringe_tol)
            cropped  = defringe(cropped, bg, df_tol, args.defringe)
            th, tw   = cropped.shape[:2]
            new_w    = max(1, round(tw * args.height / th))
            final    = Image.fromarray(cropped).resize((new_w, args.height), Image.LANCZOS)

            out_path = os.path.join(out_dir, f'{args.name}_{idx}.png')
            final.save(out_path, 'PNG')
            print(f'  [{idx}] {args.name}_{idx}.png  {new_w}×{args.height}'
                  f'  (cell {tw}×{th} at sheet {x0+left},{y0+top})')
            idx += 1

    print('Done.')


if __name__ == '__main__':
    main()
