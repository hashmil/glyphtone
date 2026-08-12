import type { Grid, GlyphSet } from './types'
import data from './glyphs.json'

export const DEFAULT_SET = data as GlyphSet

/** Fraction of the glyph box that is inked. Drives the whole tonal ladder. */
export function coverage(set: GlyphSet, name: string): number {
  const g = set.glyphs[name]
  if (!g) return 0
  let n = 0
  for (const row of g) for (const ch of row) if (ch === '#') n++
  return n / (set.grid * set.grid)
}

/** Cache coverages once per set; the mosaic loop asks for them constantly. */
export function coverageTable(set: GlyphSet): Record<string, number> {
  const out: Record<string, number> = {}
  for (const name of Object.keys(set.glyphs)) out[name] = coverage(set, name)
  return out
}

/** Turn a mixed list of motif families and bare glyph names into glyph names. */
export function expand(set: GlyphSet, names: string[]): string[] {
  const out: string[] = []
  for (const n of names) {
    const fam = set.families[n]
    if (fam) out.push(...fam)
    else if (set.glyphs[n]) out.push(n)
  }
  return out
}

/** Merge each row's filled cells into horizontal runs, so a glyph is a handful
 *  of rects rather than up to 256 of them. Matters for both SVG size and the
 *  cost of building a Path2D. */
export function runs(grid: Grid): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = []
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    let x = 0
    while (x < row.length) {
      if (row[x] === '#') {
        const start = x
        while (x < row.length && row[x] === '#') x++
        out.push([start, y, x - start, 1])
      } else x++
    }
  }
  return out
}

/** One <g> per glyph, referenced by xlink:href.
 *
 * Deliberately not <symbol>. Illustrator's parser is SVG 1.1: it will not size
 * a <use> against a <symbol> viewBox and renders the whole file blank with no
 * error. Plain groups plus a transform are the portable form, and large-format
 * print is the point of the export.
 */
export function svgDefs(set: GlyphSet, used: Iterable<string>): string {
  const names = [...used].sort()
  const parts: string[] = []
  for (const name of names) {
    const grid = set.glyphs[name]
    if (!grid) continue
    const rects = runs(grid)
      .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`)
      .join('')
    parts.push(`<g id="${name}">${rects}</g>`)
  }
  return parts.join('')
}

/** Path2D per glyph in grid units, built once and reused across every cell.
 *  Canvas-only, so it is created lazily by the canvas renderer. */
export function glyphPath(set: GlyphSet, name: string): Path2D {
  const p = new Path2D()
  const grid = set.glyphs[name]
  if (grid) for (const [x, y, w, h] of runs(grid)) p.rect(x, y, w, h)
  return p
}
