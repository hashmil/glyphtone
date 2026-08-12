"""Measure emoji so they can be used as mosaic marks.

Emoji carry their own colour, so unlike every other pack they are not tinted by
the zone ramp: they are drawn as themselves. That means tone cannot come from
the colour ramp and has to come from the choice of emoji instead, so each one
is rasterised here and its real visual weight measured.

Weight is alpha coverage times darkness, which is what a mark actually
contributes on a white page: a large pale cloud and a small black dot can end
up equally heavy, and only measuring tells you which is which.

    uv run tools/make-emoji-pack.py --out src/engine/emoji.json
"""

import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

# A spread chosen to span the tonal range rather than by theme. The ladder
# needs something at every level or the mosaic bands.
EMOJI = [
    "⬛", "⚫", "🖤", "🕳️", "🎩", "🕶️", "🐈‍⬛", "🌑", "♠️", "♣️",
    "🌚", "🎱", "📷", "🔌", "🎬", "🏴", "🖲️", "🎥", "🦇", "☕",
    "🍫", "🌰", "🏈", "🍞", "🐻", "🦁", "🍔", "🧱", "🦊", "🍁",
    "🔥", "🍊", "🏀", "🌇", "🍑", "🌞", "⭐", "🌟", "🍋", "🌻",
    "🐤", "🌽", "🧀", "🍌", "💛", "🥝", "🌿", "🍀", "🌱", "🐸",
    "💚", "🌊", "💧", "🔵", "💙", "🦋", "🐬", "❄️", "🩵", "☁️",
    "🤍", "⬜", "🕊️", "🥚", "🦢", "🍚", "◽", "▫️", "💠", "🔷",
    "🟣", "🟪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟫", "⬤", "✳️",
]

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="src/engine/emoji.json")
ap.add_argument("--font", default="/System/Library/Fonts/Apple Color Emoji.ttc")
ap.add_argument("--size", type=int, default=96,
                help="Apple Color Emoji is a bitmap font and only has strikes "
                     "at certain sizes; 96 is one of them")
a = ap.parse_args()

font = ImageFont.truetype(a.font, a.size)
box = a.size * 2

entries = []
skipped = []

for ch in EMOJI:
    img = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    try:
        d.text((box * 0.25, box * 0.25), ch, font=font, embedded_color=True)
    except Exception:
        skipped.append(ch)
        continue

    rgb = img.convert("RGB")
    alpha = img.split()[3]
    ap_px = alpha.load()
    rgb_px = rgb.load()

    # Measure inside the emoji's own ink box, not the padded canvas. The mark
    # gets drawn to fill its cell, so what matters is how dark it is at that
    # size; measuring the padding as well understates everything by the same
    # factor and squashes the ladder into the light end.
    bbox = alpha.getbbox()
    if bbox is None:
        skipped.append(ch)
        continue
    bx0, by0, bx1, by1 = bbox

    covered = 0
    ink = 0.0
    for y in range(by0, by1):
        for x in range(bx0, bx1):
            av = ap_px[x, y] / 255.0
            if av < 0.02:
                continue
            covered += 1
            r, g, b = rgb_px[x, y]
            lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
            # What this pixel contributes to darkness on a white page.
            ink += av * (1.0 - lum)

    total = max(1, (bx1 - bx0) * (by1 - by0))
    coverage = covered / total
    weight = ink / total
    if coverage < 0.01:
        skipped.append(ch)
        continue

    entries.append({"char": ch, "coverage": round(coverage, 5),
                    "weight": round(weight, 5)})

entries.sort(key=lambda e: e["weight"])

payload = {"font": os.path.basename(a.font), "emoji": entries}
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
with open(a.out, "w") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

print(f"{len(entries)} emoji measured -> {a.out} "
      f"({os.path.getsize(a.out)/1024:.0f} KB)")
print(f"weight {entries[0]['weight']:.4f} ({entries[0]['char']}) to "
      f"{entries[-1]['weight']:.4f} ({entries[-1]['char']})")
gaps = [entries[i + 1]["weight"] - entries[i]["weight"] for i in range(len(entries) - 1)]
print(f"largest gap in the ladder {max(gaps):.4f}")
if skipped:
    print(f"skipped {len(skipped)}: {' '.join(skipped)}")
