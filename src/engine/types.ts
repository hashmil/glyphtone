/** A 16x16 (or 32x32) icon as row strings. '#' is ink, anything else is empty. */
export type Grid = string[]

export interface GlyphSet {
  grid: number
  glyphs: Record<string, Grid>
  /** motif name -> its thin/bold/solid weights */
  families: Record<string, string[]>
  /** the geometric marks at the light end of the ladder */
  small: string[]
}

/** Pale-to-deep colour ramp for one zone, as RGB 0-255. */
export type Ramp = [readonly [number, number, number], readonly [number, number, number]]

/** How marks are placed.
 *
 * `grid` puts one icon per cell of a fixed lattice, so nothing overlaps and
 * the result reads as ordered. `organic` scatters them by importance sampling
 * at several scales with varying size and overlap, which is messier and is the
 * only way to reach a genuinely near-black core, since a non-overlapping grid
 * is capped by the coverage of its heaviest single glyph.
 */
export type Method = 'grid' | 'organic'

export interface MosaicOptions {
  method: Method
  /** organic only: how many marks get placed, scaling every pass together */
  density: number
  /** organic only: how strongly local darkness picks a heavier glyph versus
   *  picking at random */
  weightBias: number
  /** organic only: overall mark size, as a multiplier on each pass's own size.
   *
   * Size and count used to be the same slider: fewer marks only ever meant
   * smaller marks, so sparse-and-large, which is the most useful thing organic
   * placement can do, was unreachable. */
  glyphScale: number
  /** organic only: mark-to-mark size spread, as a fraction either side of the
   *  size the pass asked for. 0 makes every mark in a pass identical. */
  sizeJitter: number
  /** cells across. The single strongest control over how the piece reads. */
  cols: number
  /** output width in px. Height follows the source aspect. */
  width: number
  /** glyph size as a fraction of its cell. 1.0 fills edge to edge. */
  gutter: number
  /** tone curve on the density map before it hits the ladder */
  gamma: number
  contrast: number
  /** cells below this ink level stay empty, keeping the page high-key */
  floor: number
  /** coverage tolerance within which glyphs count as interchangeable */
  vary: number
  /** per-cell lightness jitter. What makes the result sparkle. */
  valnoise: number
  seed: number
  /** allow solid tiles with the motif punched out, for near-black areas */
  knockout: boolean
  /** region forced to the third zone, in source-image pixels */
  figureBox: [number, number, number, number] | null
}

/** One placed icon. Renderer-agnostic: SVG and canvas both consume this. */
export interface Placement {
  glyph: string
  x: number
  y: number
  /** multiplier from glyph grid units to output px, horizontally */
  scale: number
  /** vertical multiplier, when it differs. Set only for packs drawn into a
   *  non-square cell, such as ASCII in a terminal-shaped cell. */
  scaleY?: number
  r: number
  g: number
  b: number
  /** set for text packs (emoji), which draw as themselves in their own colour
   *  rather than as a tinted shape */
  char?: string
}

export interface MosaicResult {
  placements: Placement[]
  used: Set<string>
  width: number
  height: number
  rows: number
  cols: number
  cell: number
  /** cells actually filled, and the total. The headline diagnostic. */
  filled: number
  total: number
}
