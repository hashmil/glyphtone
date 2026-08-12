"""Rasterise a set of characters into glyph masks for the ASCII pack.

Done at build time rather than in the browser so the pack is deterministic,
needs no webfont at runtime, and can be tested in Node like every other pack.

No character ordering is baked in. Published ASCII ramps (Paul Bourke's
70-character sequence, the classic '@%#*+=-:. ') are orderings of perceived
density for one particular font, and the engine measures each glyph's ink
coverage itself and sorts by that. Supplying the characters and letting it
derive the ladder is both simpler and correct for whatever font was used here.

    uv run tools/make-ascii-pack.py --out src/engine/ascii.json
"""

import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

# Paul Bourke's standard ramp, minus the characters that vanish or that carry
# no usable ink at 16 px. Kept broad on purpose: the engine wants a dense
# ladder of coverages and several shapes at each step.
CHARS = (
    "@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft"
    "/\\|()1{}[]?-_+~<>i!lI;:,\"^`'."
)

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="src/engine/ascii.json")
ap.add_argument("--grid", type=int, default=16)
ap.add_argument("--font", default="/System/Library/Fonts/Menlo.ttc")
ap.add_argument("--supersample", type=int, default=8,
                help="render this many times larger, then area-average down. "
                     "Thresholding a 16px render directly loses the thin "
                     "characters entirely.")
a = ap.parse_args()

N = a.grid
S = a.supersample
big = N * S
# A terminal cell is roughly half as wide as it is tall, and ASCII art is
# composed for that. Rendering into a square cell instead leaves every
# character surrounded by dead space, which caps the pack's darkest coverage
# at about 0.19 and makes the whole mosaic read grey. So render into the real
# cell aspect and stretch to square, which is also what a terminal does
# visually when the art is viewed at square pixel scale.
cell_w = big // 2
cell_h = big

font = ImageFont.truetype(a.font, int(cell_h * 0.98))

glyphs = {}
skipped = []

for ch in CHARS:
    img = Image.new("L", (cell_w, cell_h), 0)
    d = ImageDraw.Draw(img)
    # Centre on the character's own ink box, not on its advance width, so a
    # comma and a hash both sit in the middle of the cell.
    box = d.textbbox((0, 0), ch, font=font)
    w = box[2] - box[0]
    h = box[3] - box[1]
    d.text(((cell_w - w) / 2 - box[0], (cell_h - h) / 2 - box[1]), ch, fill=255, font=font)

    small = img.resize((N, N), Image.BOX)
    px = small.load()
    # A low threshold: these are thin shapes and the aim is to keep them
    # present in the ladder, not to render them faithfully.
    rows = ["".join("#" if px[x, y] > 96 else "." for x in range(N))
            for y in range(N)]
    ink = sum(r.count("#") for r in rows)
    if ink == 0:
        skipped.append(ch)
        continue

    # Name by codepoint: the character itself is not safe in a JSON key we
    # later use as an SVG element id.
    glyphs[f"c{ord(ch):02x}"] = rows

payload = {
    "grid": N,
    "glyphs": glyphs,
    # One family, since these are not motifs with derived weights. The engine
    # sorts the whole set by coverage regardless.
    "families": {"ascii": sorted(glyphs)},
    "small": [],
    "chars": {f"c{ord(c):02x}": c for c in CHARS if f"c{ord(c):02x}" in glyphs},
    "font": os.path.basename(a.font),
}

os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
with open(a.out, "w") as f:
    json.dump(payload, f, separators=(",", ":"), sort_keys=True)

covs = sorted(sum(r.count("#") for r in g) / (N * N) for g in glyphs.values())
print(f"{len(glyphs)} characters at {N}x{N} from {os.path.basename(a.font)} "
      f"-> {a.out} ({os.path.getsize(a.out)/1024:.0f} KB)")
print(f"coverage {covs[0]:.3f} to {covs[-1]:.3f}, "
      f"median {covs[len(covs)//2]:.3f}")
if skipped:
    print(f"dropped {len(skipped)} blank at this size: {''.join(skipped)}")
