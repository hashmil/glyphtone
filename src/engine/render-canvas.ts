import type { MosaicResult } from './types'
import type { GlyphPack } from './packs'
import { glyphPath } from './glyphs'

/** Live preview renderer.
 *
 * One Path2D per distinct glyph, built once and stamped with a transform per
 * cell. The alternative, a fresh path or an image blit per cell, is what makes
 * naive versions of this crawl at 100,000 icons.
 *
 * Text packs take the other branch: emoji are drawn with fillText in their own
 * colour, since converting them to a tinted silhouette throws away the only
 * reason to use them.
 */
export function drawMosaic(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  result: MosaicResult,
  pack: GlyphPack,
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

  const text = pack.mode === 'text'
  const paths = new Map<string, Path2D>()
  if (!text) for (const name of result.used) paths.set(name, glyphPath(pack.set, name))

  if (text) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }

  let lastFill = ''
  let lastFont = ''
  const cell = result.cell * scale

  for (const p of result.placements) {
    const x = p.x * scale - ox
    const y = p.y * scale - oy
    // Skip anything outside the crop. On a tiled export most placements miss,
    // so this is what keeps per-tile cost proportional to the tile.
    if (x + cell < 0 || y + cell < 0 || x > w || y > h) continue

    if (text) {
      const size = p.scale * pack.set.grid * scale
      // Rounded so the font string repeats and the browser can cache it;
      // setting a distinct font per cell is ruinous.
      const font = `${Math.max(1, Math.round(size))}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
      if (font !== lastFont) {
        ctx.font = font
        lastFont = font
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillText(p.char ?? '', x + size / 2, y + size / 2)
      continue
    }

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
