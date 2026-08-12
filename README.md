# Glyphtone

Rebuilds an image out of thousands of tiny icons, and exports it as vector so
it can be printed at any size.

**[glyphtone.pages.dev](https://glyphtone.pages.dev)**

Everything runs in your browser. No image is uploaded, there is no backend, and
the whole thing deploys as static files.

---

## What it does

Drop in a photo or a piece of artwork. Pick a glyph pack, a placement method
and a palette. Adjust until it reads the way you want, then export an SVG for
print, a PNG to share, or a zip of tiles for anything too large to fit on one
artboard.

**Glyph packs** decide what the marks are made of:

| Pack | What it is |
|---|---|
| Motifs | Hand-drawn symbols. Each zone draws on its own family. |
| Geometric | Outlined and solid primitives. Reads as drawn. |
| Stipple | Dots only, growing with tone. The most photographic. |
| Hatching | Strokes at increasing weight and angle. Like engraving. |
| Blocks | Unicode block elements and ordered dither. The evenest ladder. |
| ASCII | 68 real characters from a monospace font. |
| Emoji | Drawn in their own colour, picked by how dark each one renders. |

**Placement** is either ordered or organic. Ordered puts one icon per cell of a
fixed lattice so nothing overlaps. Organic scatters marks at four scales with
varying size and overlap; it is messier, places far more marks, and can reach
darker than a grid ever can.

**Zones.** The image is split into cool areas, warm areas and an optional focal
region you drag on the picture. Each gets its own colour ramp and its own slice
of the glyph vocabulary, which is what stops the result reading as one flat
texture.

---

## How it works

Icons sit on a lattice, one per cell, all the same size. Tone comes from three
stacked axes:

1. which cells are filled at all
2. which glyph fills them, since each has its own ink coverage
3. how dark that glyph is drawn

The second is the interesting one. Each cell asks for a target ink coverage and
gets the glyph that comes closest, so light areas fill with dots and crosses
and dark areas with solids, and the tonal gradient emerges from the shapes
themselves.

Quantising a continuous target onto the handful of coverages a pack actually
offers is Floyd-Steinberg error diffusion on a serpentine scan. Rounding each
cell independently bands badly; pushing the rounding error into neighbouring
cells keeps the local average exact and turns that banding into fine texture.

This is weighted Voronoi stippling with the dot swapped for an icon. See
[Secord, *Weighted Voronoi Stippling*, NPAR 2002](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf),
and [Charis Tsevis](https://tsevis.com/mosaic-styles) for the best-known work
in the form.

### Photographs need preparing first

A photo carries tone everywhere. Fed in raw it fills every cell and reads as a
flat slab. The prep step divides out a heavily blurred copy to remove the broad
lighting while keeping local texture, then adds genuine darkness back on an
absolute threshold, because flat-fielding alone erases the subject: a large
dark shape is low frequency too.

On a test image, a photo straight in fills 84% of cells; prepped it fills 57%,
and that difference is the whole gap between a slab and an image. It turns
itself on automatically when the frame has little near-white in it.

---

## Design notes

Things that are not obvious and were arrived at by measuring.

**A non-overlapping grid cannot go darker than its heaviest single glyph.**
This is why every pack is checked for the range it spans. Rendering ASCII
characters into a square cell left each one surrounded by dead space and capped
the pack at 0.19 coverage, which reads grey however you tune it; rendering into
a real terminal cell aspect and stretching gives 0.031 to 0.449.

**Emoji have to be measured, not ordered.** Published ASCII density ramps are
orderings for one particular font. The engine measures each glyph's coverage
itself, so packs supply characters and let the ladder be derived. For emoji
that measurement is alpha coverage times darkness, taken inside each emoji's
own ink box: measuring the padded canvas instead understated everything and
squashed the ladder from 0.07–0.87 down to 0.01–0.22.

**Organic placement needs a higher density than you would guess.** Against a
260-column grid on the same source, density 1.0 places 61k marks and reads
*lighter* than the grid; density 2.0 places 242k and finally beats it. 2.0 is
the default for that reason.

**Preview and export are separate renderers.** A mosaic is routinely over
100,000 elements. Canvas handles that; the DOM does not. So the SVG is built
only when you export, and the preview is drawn with one `Path2D` per distinct
glyph, stamped per cell.

**Zoom re-renders rather than scaling the canvas.** The output is vector all
the way through, so magnifying a bitmap preview would show blur where the real
export has crisp icons, and checking the icons is the entire reason to zoom in.

---

## Export

| Format | Notes |
|---|---|
| SVG | Vector, sharp at any size. Opens in Illustrator. |
| SVGZ | The same file gzipped. Typically a fraction of the size; Illustrator opens it directly. |
| PNG | Pixels. Simpler to hand on, fixed at the chosen resolution. |

Sizes are offered as print decisions rather than pixel counts, because that is
the choice being made. Environmental graphics people walk past at two to three
metres need roughly 100 to 200 dpi, not the 15 to 30 dpi rule of thumb quoted
for roadside billboards. A 3 m panel at 150 dpi is 17,717 px on the long edge.

Two limits are enforced rather than discovered the hard way:

- **Illustrator caps artboards at 16,383 px.** Anything larger warns and points
  at tiling.
- **Browsers cap canvas area**, and Safari's cap is the low one. A PNG past it
  is blocked with a reason, since `toBlob` otherwise returns a blank.

Tiled exports arrive as one zip, written with `CompressionStream` so there is
no dependency. Tiles are crops of a single render, so tone lines up across the
joins, and each tile contains only its own icons.

SVG export uses `xlink:href` against plain `<g>` elements, never `<symbol>`.
Illustrator's parser is SVG 1.1: it will not size a `<use>` against a `<symbol>`
viewBox and renders the whole file blank, with no error.

---

## Layout

    src/engine/          framework-free, no DOM, fully testable in Node
      mosaic.ts          the lattice, the ladder, error diffusion
      free.ts            organic placement by importance sampling
      build.ts           one entry point, dispatches on method
      prep.ts            photograph to high-key density map
      packs.ts           the seven glyph packs
      palettes.ts        zone colour ramps
      glyphs.ts          coverage, SVG defs, Path2D
      render-canvas.ts   live preview
      render-svg.ts      vector export
    src/lib/             browser-side: image IO, zip, export, state
    tools/               one-off data generation (Python, not needed to run the app)

The engine has no DOM dependency and no React. `build()` returns a placement
list; the two renderers consume it. That is what makes the whole thing
testable, and what let the SVG and canvas paths stay honest with each other.

---

## Verification

The engine is a port of a Python prototype, and the tests check it against that
rather than against itself. The two use different PRNGs, so which glyph wins
among tonally interchangeable candidates differs by design and pixel equality
is not the bar.

| Fixture run | Python | TypeScript |
|---|---|---|
| cells filled | 12,116 | 12,116 |
| fill rate | 84.14% | 84.14% |
| mean ink coverage | 0.4920 | 0.4919 |
| distinct glyphs used | 61 | 61 |
| prep mean ink | 0.1964 | 0.1965 |
| prep coverage | 38.00% | 38.01% |
| prep max pixel difference | | 4 of 255 |

The fill decision is asserted **exactly**, because it depends only on the
downsampled ink and the floor with no randomness in it, so any drift there
means the downsample is wrong. The prep is held to near pixel equality for the
same reason; the residual 4 levels are Python quantising its blur input to
uint8.

There are also tests that each pack's ladder spans far enough to reach dark and
steps without a gap wide enough to band, and that a tiled export gives each
tile only its own icons.

    npm test

---

## Running it

    npm install
    npm run dev

    npm run build     # production build
    npm test          # engine tests
    npm run deploy    # Cloudflare Pages

Deployment is Cloudflare Pages by direct upload, no CI. Static assets on the
free plan are not metered for requests or bandwidth; the only quota that could
bite is Pages Functions, and there are none, which is the entire reason the
engine runs client-side. The limits that do apply are 500 builds a month,
20,000 files and 25 MiB per file. This ships ten files.

### Regenerating the data

Not needed to run or build the app; the generated JSON is committed.

The font-backed packs are rasterised by a Node script driving headless Chrome,
from the Fontsource packages pinned in package.json. Chrome rather than a
rasterising library because it is the same shaper the browser uses, and because
it can be asked what a glyph's ink box actually is. The script refuses any
codepoint outside the font subset's declared unicode-range, which is how it
caught box drawing being absent from Noto Sans Symbols 2 and quietly satisfied
by a macOS fallback.

    npm run packs

The remaining Python tools need Python with Pillow and a prototype checkout:

    uv run tools/export-glyphs.py --src <prototype> --out src/engine/glyphs.json
    uv run tools/make-fixture.py  --src <prototype>
    uv run tools/make-emoji-pack.py --out src/engine/emoji.json

---

## Licence

MIT. See [LICENSE](LICENSE).

The bundled glyph packs are original work or generated: the motif set is
hand-drawn, and the geometric, stipple, hatching, blocks, halftone, box-drawing
and braille packs are generated in code.

The ASCII and dingbat packs are rasterised at build time from Google Fonts
releases under the SIL Open Font License, IBM Plex Mono and Noto Sans Symbols 2,
self-hosted through Fontsource. Only the rasterised outlines are committed; no
font file ships in the app and none is loaded at runtime, so an exported SVG
needs no font on the machine that opens it.

The emoji pack references system emoji rather than shipping any, so what it
renders depends on the machine viewing it. That is why the UI steers emoji
exports towards PNG.

Images you put in stay on your device and are never uploaded.
