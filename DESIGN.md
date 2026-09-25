# Glyphtone design

## Overview

Glyphtone turns an image into a print file made of glyphs. The person using it
is deciding how a piece will look on a wall, so the interface is modelled on the
place where that decision is made in print: **the proofing booth and the job
docket**.

- **Artefact, workspace:** a press check. The piece is a trimmed proof sitting on
  a neutral grey surround, with crop marks at its corners and a slug line under
  it. The controls are the job docket beside it.
- **Artefact, landing:** a type specimen. The glyph sets are shown the way a
  foundry shows a face: set large, with the full ladder of weights beneath.
- **Macrostructure:** workbench (workspace), specimen (landing). The previous
  build was a generic docked rail and a card grid; neither is reused.
- **Visual direction:** technical document meets print production. Achromatic
  chrome, one process colour, mono for every number.

Provenance of the idiom: the export dialog already speaks in print decisions
(A1 at 150 dpi, a 3 m panel at 17,717 px). The interface now looks like the
room those decisions belong to.

## Colors

The surround is fully achromatic. ISO 3664 viewing booths use neutral grey so
the eye makes no colour judgement against the room; the same logic applies to
judging a palette on screen. It is darker than a real booth so white paper and
white type hold contrast.

| Token | Hex | Source |
|---|---|---|
| `--gt-ink` | `#0d0d0d` | Chrome: masthead, docket. Near-black, neutral |
| `--gt-table` | `#1b1b1b` | The proofing surround behind the piece. Neutral, no hue |
| `--gt-raise` | `#242424` | Hover and pressed fills on the docket |
| `--gt-rule` | `#2c2c2c` | Hairlines between docket sections |
| `--gt-rule-2` | `#3d3d3d` | Input borders, slider track |
| `--gt-fg` | `#ededeb` | Primary text |
| `--gt-fg-2` | `#9b9b98` | Secondary text, hints |
| `--gt-fg-3` | `#62625f` | Tertiary: slug line separators, disabled |
| `--gt-paper` | `#ffffff` | The sheet. Default background of the piece |
| `--gt-magenta` | `#ec008c` | Process magenta, the M of the CMYK colour bar printed on every proof. The single accent: focus, active state, focal region, crop marks on hover |
| `--gt-yellow` | `#fff200` | Process yellow. Warnings only, never decoration |

Gradients exist in exactly two places and both encode data: a palette's
pale-to-deep ramp per zone, and the user's own two-stop paper gradient.

## Typography

Two faces from one family.

- **IBM Plex Sans** (variable, `wght` 100 to 700, `wdth` 85 to 100). UI text and display.
  Display uses `wdth 85` for the condensed cut, which reads as press type.
- **IBM Plex Mono**. Every number, the slug line, values beside sliders, labels
  in the docket. Provenance: the ASCII pack is rasterised from Plex Mono, so the
  interface and the glyphs are the same face.

Scale, ratio ~1.25 with a jump for display:

| Step | Size | Use |
|---|---|---|
| xs | 11px | Mono labels, slug line, hints |
| sm | 13px | UI body, control labels |
| md | 16px | Section titles in the landing, dialog titles |
| lg | 20px | Landing subhead |
| xl | 31px | Landing section heads |
| display | clamp(44px, 7vw, 96px) | The landing headline only, `wdth 85`, weight 600 |

Line height 1.45 for body, 0.95 for display. Tracking tight on display only.

## Layout

- Shell is exactly the viewport and never scrolls; each region scrolls itself.
- Desktop workspace: masthead 48px, table fills, docket 344px on the right.
- Docket rhythm: 20px section padding, 12px between a label and its control,
  8px inside compound controls. Sections separated by a 1px rule, not gaps.
- Landing: 12-column grid, 32px gutter at 1440, 16px side gutter on phones.
  Hero splits 5 / 7 (copy / proof).
- Phone: masthead, table, a four-way section bar at the bottom opening a sheet.

## Elevation

None in the chrome. Everything is flat and separated by rules. The only object
with depth is the proof itself: a tight, dark contact shadow as paper on a
table has, no glow, no blur halo.

## Shapes

- Paper: square corners. A trimmed sheet has no radius.
- Controls: 2px radius. Enough to avoid aliasing, small enough to read as square.
- Chips and swatch tiles: 2px, same reason.
- No pills anywhere.
- Two circles, both because the real object is round: the loupe (a lens) and
  the radio marks in the export size list.

## Components

- **Proof.** The canvas on the table, crop marks at the four corners offset 8px,
  slug line under it in mono.
- **Loupe.** A circular magnifier over the proof on the landing, drawn by the
  real renderer at 6x, because inspecting the glyphs is the point of zooming.
- **Docket section.** Label left in mono xs, current value right in mono xs,
  control below.
- **Glyph tile.** A pack shown as its own glyphs sampled across its ladder,
  light to dark, with the name under. Three across.
- **Ramp swatch.** A palette shown as its three zone ramps, each a pale-to-deep
  strip.
- **Segmented control.** Two to four options, hairline border, active option in
  paper white with ink text.
- **Slider.** 1px track, active range in `--gt-fg`, 10px square thumb.
- **Print order.** The export dialog: sizes as a list of physical sizes with the
  pixel count in mono, a tile preview drawn to the piece's aspect.
