# Glyphtone

Turns an image into a mosaic built from thousands of tiny icons, and exports it
as vector for large-format print.

Everything runs in the browser. No image is ever uploaded, there is no backend,
and the whole thing deploys as static files.

## How it works

Icons sit on a strict lattice, one per cell, all at the same size, so nothing
ever overlaps. Tone comes from three stacked axes:

1. which cells are filled at all
2. which glyph fills them, since each has its own ink coverage
3. how dark that glyph is drawn

Axis 2 is the interesting one. Each cell asks for a target ink coverage and
gets the glyph that comes closest, so light areas fill with dots and crosses
and dark areas with solids. Quantising a continuous target onto the handful of
coverages actually available is Floyd-Steinberg error diffusion on a serpentine
scan: rounding each cell independently bands badly, and diffusing the error
into neighbours turns that banding into fine texture.

Photographs need `prep` first. A photo has tone everywhere, so fed in raw it
fills every cell and reads as a slab. Prep divides out a heavily blurred copy
to remove the broad lighting, then adds genuine darkness back on an absolute
threshold, because flat-fielding alone erases the subject.

## Layout

    src/engine/          framework-free, no DOM, fully testable
      mosaic.ts          the lattice, the ladder, error diffusion
      prep.ts            photograph to high-key density map
      glyphs.ts          vocabulary, coverage, SVG defs, Path2D
      palettes.ts        zone colour ramps and icon vocabularies
      render-canvas.ts   live preview
      render-svg.ts      vector export
    tools/               one-off data export and fixture generation

Preview and export are deliberately separate renderers. A mosaic is routinely
over 100,000 elements, which canvas handles and the DOM does not.

## Verification

The engine is a port of a Python prototype. The two use different PRNGs, so
which glyph wins among tonally interchangeable candidates differs by design and
pixel equality is not the bar. `npm test` checks against a fixture both sides
ran:

| | Python | TypeScript |
|---|---|---|
| cells filled | 12,116 | 12,116 |
| fill rate | 84.14% | 84.14% |
| mean ink coverage | 0.4920 | 0.4919 |
| distinct glyphs used | 61 | 61 |

The fill decision is checked exactly, since it depends only on the downsampled
ink and the floor with no randomness in it. Any drift there means the
downsample is wrong.

Regenerate the fixture and the glyph data with the scripts in `tools/`.

## Export notes

SVG export uses `xlink:href` against plain `<g>` elements, not `<symbol>`.
Illustrator's parser is SVG 1.1: it will not size a `<use>` against a
`<symbol>` viewBox and renders the file blank with no error. Illustrator also
caps artboards at 16,383 px, so anything larger has to ship as tiles.

## Licence

Code MIT. The bundled icon set is original work. Icons you supply yourself stay
yours and are processed locally.
