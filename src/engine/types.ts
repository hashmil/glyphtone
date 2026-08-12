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

export interface Zone {
  id: string
  label: string
  ramp: Ramp
  /** motif families and bare glyph names; families expand to their weights */
  motifs: string[]
}

export interface MosaicOptions {
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
  /** multiplier from glyph grid units to output px */
  scale: number
  r: number
  g: number
  b: number
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
