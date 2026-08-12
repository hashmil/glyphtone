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
  opts: { background?: string; scale?: number } = {},
): void {
  const scale = opts.scale ?? 1
  const w = result.width * scale
  const h = result.height * scale

  ctx.save()
  ctx.fillStyle = opts.background ?? '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const paths = new Map<string, Path2D>()
  for (const name of result.used) paths.set(name, glyphPath(set, name))

  // Grouping by colour would cut fillStyle churn, but the ramp gives almost
  // every cell its own value, so there is nothing to group. Sorting by glyph
  // instead keeps the transform cheap and the path lookup hot.
  let lastFill = ''
  for (const p of result.placements) {
    const path = paths.get(p.glyph)
    if (!path) continue
    const fill = `rgb(${p.r},${p.g},${p.b})`
    if (fill !== lastFill) {
      ctx.fillStyle = fill
      lastFill = fill
    }
    const s = p.scale * scale
    ctx.setTransform(s, 0, 0, s, p.x * scale, p.y * scale)
    ctx.fill(path)
  }

  ctx.restore()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
