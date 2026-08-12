import type { GlyphSet, MosaicResult } from './types'
import { glyphPath } from './glyphs'

/** Live preview renderer.
 *
 * One Path2D per distinct glyph, built once and stamped with a transform per
 * cell. The alternative, a fresh path or an image blit per cell, is what makes
 * naive versions of this crawl at 50,000 icons.
 */
export function drawMosaic(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  result: MosaicResult,
  set: GlyphSet,
  opts: {
    background?: string
    scale?: number
    /** crop origin in output px, for tiled export. Applied inside the per-cell
     *  transform: setTransform is absolute, so translating the context before
     *  calling this would be silently overwritten by the first placement. */
    origin?: { x: number; y: number }
    /** how much to paint, in output px. Defaults to the whole piece. */
    size?: { width: number; height: number }
  } = {},
): void {
  const scale = opts.scale ?? 1
  const ox = (opts.origin?.x ?? 0) * scale
  const oy = (opts.origin?.y ?? 0) * scale
  const w = (opts.size?.width ?? result.width) * scale
  const h = (opts.size?.height ?? result.height) * scale

  ctx.save()
  ctx.fillStyle = opts.background ?? '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const paths = new Map<string, Path2D>()
  for (const name of result.used) paths.set(name, glyphPath(set, name))

  // Grouping by colour would cut fillStyle churn, but the ramp gives almost
  // every cell its own value, so there is nothing to group. Sorting by glyph
  // instead keeps the transform cheap and the path lookup hot.
  let lastFill = ''
  const cell = result.cell * scale
  for (const p of result.placements) {
    const x = p.x * scale - ox
    const y = p.y * scale - oy
    // Skip anything outside the crop. On a tiled export most placements miss,
    // so this is what keeps per-tile cost proportional to the tile.
    if (x + cell < 0 || y + cell < 0 || x > w || y > h) continue
    const path = paths.get(p.glyph)
    if (!path) continue
    const fill = `rgb(${p.r},${p.g},${p.b})`
    if (fill !== lastFill) {
      ctx.fillStyle = fill
      lastFill = fill
    }
    const s = p.scale * scale
    ctx.setTransform(s, 0, 0, s, x, y)
    ctx.fill(path)
  }

  ctx.restore()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
