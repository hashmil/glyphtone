"""Dump a glyph module's vocabulary to JSON for the TypeScript engine.

The Python prototype authors icons as ASCII pixel grids and derives the
lighter weights by erosion at import time. Rather than reimplement erosion in
TS and risk the two drifting, the derived set is exported once and shipped as
data. Re-run this if the source grids change.

    uv run tools/export-glyphs.py --src /path/to/prototype --out src/engine/glyphs.json
"""

import argparse
import json
import os
import sys

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True, help="folder containing glyphs.py")
ap.add_argument("--out", default="src/engine/glyphs.json")
a = ap.parse_args()

sys.path.insert(0, os.path.abspath(a.src))
import glyphs as G  # noqa: E402

payload = {
    "grid": G.GRID,
    # Every derived weight plus the small marks, as row strings. '#' is ink.
    "glyphs": {name: list(grid) for name, grid in G.GLYPHS.items()},
    # Motif -> its thin/bold/solid weights, so a zone list can name a family.
    "families": {name: list(weights) for name, weights in G.FAMILIES.items()},
    "small": sorted(G.SMALL),
}

bad = G.validate()
if bad:
    raise SystemExit(f"refusing to export, malformed grids: {bad}")

os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
with open(a.out, "w") as f:
    json.dump(payload, f, separators=(",", ":"), sort_keys=True)

n = len(payload["glyphs"])
kb = os.path.getsize(a.out) / 1024
print(f"{n} glyphs at {payload['grid']}x{payload['grid']}, "
      f"{len(payload['families'])} families -> {a.out} ({kb:.0f} KB)")
