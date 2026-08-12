"""Generate a shared fixture so the TS port can be checked against the Python.

Writes raw RGB bytes (no image format, so the TS side needs no decoder) plus
the Python engine's own statistics for the same input and settings. The port is
verified on those statistics, not on pixel equality: the two use different
PRNGs, so the glyph picked among tonally interchangeable candidates will
differ. What must match is the tonal behaviour, which is what the numbers
below measure.

    uv run tools/make-fixture.py --src /path/to/prototype
"""

import argparse
import json
import os
import sys
from collections import Counter

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True, help="folder containing grid_mosaic.py")
ap.add_argument("--out", default="src/engine/__fixtures__")
ap.add_argument("--size", type=int, default=320)
a = ap.parse_args()

sys.path.insert(0, os.path.abspath(a.src))
import glyphs as G  # noqa: E402
import grid_mosaic as GM  # noqa: E402

# --- a synthetic source, defined by formula so both sides build it identically
W = H = a.size
yy, xx = np.mgrid[0:H, 0:W]
u = xx / (W - 1.0)
v = yy / (H - 1.0)

# Vertical tonal sweep from paper-white to near-black, a soft dark blob, and a
# warm lower half. The sweep has to reach true white at the top or the deadzone
# and the light end of the ladder never get exercised, which was wrong in the
# first version of this fixture.
tone = np.power(v, 1.6) * 0.88
blob = np.exp(-(((u - 0.34) ** 2 + (v - 0.30) ** 2) / 0.010)) * 0.5
lum = np.clip(1.0 - (tone + blob), 0.0, 1.0)

warm = (v > 0.55).astype(float)
r = np.clip(lum + warm * 0.10, 0, 1)
g = np.clip(lum + warm * 0.02, 0, 1)
b = np.clip(lum - warm * 0.10, 0, 1)
rgb = (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)

os.makedirs(a.out, exist_ok=True)
raw_path = os.path.join(a.out, "source.raw")
with open(raw_path, "wb") as f:
    f.write(rgb.tobytes())

# --- run the Python engine on exactly those pixels --------------------------
from PIL import Image  # noqa: E402

png_path = os.path.join(a.out, "source.png")
Image.fromarray(rgb).save(png_path)

GM.use_vocabulary("drawn", knockout=False)

OPTS = dict(cols=120, gutter=1.0, gamma=0.85, contrast=1.0,
            floor=0.06, vary=0.05, seed=7, valnoise=0.0)
FIGURE = (90, 60, 170, 150)

svg_path = os.path.join(a.out, "python.svg")
filled, total, ow, oh, cell = GM.build(
    png_path, svg_path, 1200, figure_box=FIGURE, **OPTS)

# Re-derive the per-cell decisions so the ladder distribution can be compared.
# Cheaper than parsing the SVG and it reads the same values the build used.
import re  # noqa: E402

with open(svg_path) as f:
    svg = f.read()
names = re.findall(r'xlink:href="#([^"]+)"', svg)
cov = Counter()
for n in names:
    cov[round(G.coverage(n), 4)] += 1

# --- and the photograph prep, on the same pixels ----------------------------
import prep as PREP  # noqa: E402

PREP_OPTS = dict(detail=0.55, dark=0.62, dark_gain=1.35, radius=0.030, sat=1.0)
prep_png = os.path.join(a.out, "python-prepped.png")
prep_mean, prep_cover = PREP.prep(png_path, prep_png, **PREP_OPTS)

prep_rgb = np.asarray(Image.open(prep_png).convert("RGB"), dtype=np.uint8)
with open(os.path.join(a.out, "prepped.raw"), "wb") as f:
    f.write(prep_rgb.tobytes())

stats = {
    "width": W, "height": H,
    "prep": {
        "options": {"detail": 0.55, "dark": 0.62, "darkGain": 1.35,
                    "radius": 0.030, "warmSplit": 0.02, "saturation": 1.0},
        "meanInk": prep_mean,
        "coverage": prep_cover,
    },
    "options": {**OPTS, "width": 1200, "knockout": False,
                "figureBox": list(FIGURE)},
    "filled": filled,
    "total": total,
    "fillRate": filled / total,
    "outWidth": ow, "outHeight": oh, "cell": cell,
    "glyphCount": len(set(names)),
    # coverage level -> how many cells landed on it, the tonal ladder in use
    "coverageHistogram": {str(k): v for k, v in sorted(cov.items())},
    "meanCoverage": sum(G.coverage(n) for n in names) / max(1, len(names)),
}

with open(os.path.join(a.out, "python-stats.json"), "w") as f:
    json.dump(stats, f, indent=2, sort_keys=True)

print(f"{W}x{H} source -> {raw_path}")
print(f"python: {filled:,}/{total:,} cells filled ({100*filled/total:.1f}%), "
      f"{len(set(names))} distinct glyphs, "
      f"mean coverage {stats['meanCoverage']:.4f}")
