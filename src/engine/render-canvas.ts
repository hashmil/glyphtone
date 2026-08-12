import type { MosaicResult } from './types'
import type { GlyphPack } from './packs'
import { glyphPath } from './glyphs'
import { fitBox, gradientLine, type Background } from './background'

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
    background?: Background
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
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Always clear first. A tiled or zoomed redraw reuses the same context, and
  // a transparent background that skipped this would show the previous frame.
  ctx.clearRect(0, 0, w, h)
  paintBackground(ctx, opts.background, {
    // Piece coordinates, so a crop shows its slice of one whole-piece gradient
    // rather than a gradient of its own.
    pieceW: result.width * scale, pieceH: result.height * scale,
    ox, oy, w, h,
  })

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

/** Paints the background into a `w x h` viewport whose top-left sits at
 *  (ox, oy) within a `pieceW x pieceH` piece. */
function paintBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bg: Background | undefined,
  box: { pieceW: number; pieceH: number; ox: number; oy: number; w: number; h: number },
): void {
  if (!bg || bg.kind === 'transparent') return
  const { pieceW, pieceH, ox, oy, w, h } = box

  if (bg.kind === 'solid') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (bg.kind === 'gradient') {
    const l = gradientLine(pieceW, pieceH, bg.angle)
    const g = ctx.createLinearGradient(l.x1 - ox, l.y1 - oy, l.x2 - ox, l.y2 - oy)
    g.addColorStop(0, bg.from)
    g.addColorStop(1, bg.to)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    return
  }

  const img = bg.image
  if (!img) return
  const iw = 'width' in img ? Number(img.width) : 0
  const ih = 'height' in img ? Number(img.height) : 0
  const f = fitBox(iw, ih, pieceW, pieceH, bg.fit ?? 'cover')
  ctx.drawImage(img, f.x - ox, f.y - oy, f.width, f.height)
}
