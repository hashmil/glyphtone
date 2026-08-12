/** What sits under the glyphs.
 *
 * One description, consumed by both renderers, so the preview, the PNG, the
 * SVG and every tile of a tiled export agree. The alternative, a colour string
 * threaded through each exporter, could only ever express a flat fill, and it
 * quietly defaulted to white even when the caller wanted nothing at all.
 *
 * Geometry is always given in *piece* coordinates, never tile coordinates: a
 * gradient has to run across the whole finished piece, so a tile shows its own
 * slice of it rather than a fresh gradient of its own. That is the single rule
 * that makes tiled export of a gradient or an image work at all.
 */
export type Background =
  | { kind: 'transparent' }
  | { kind: 'solid'; color: string }
  /** angle in degrees, 0 = left to right, 90 = top to bottom */
  | { kind: 'gradient'; from: string; to: string; angle: number }
  /** `src` is a data URL, so an exported SVG carries the image with it rather
   *  than referencing a file the recipient does not have. `image` is the
   *  decoded form the canvas renderer needs; the SVG path never uses it. */
  | { kind: 'image'; src: string; image?: CanvasImageSource; fit?: 'cover' | 'contain' }

export const DEFAULT_BACKGROUND: Background = { kind: 'solid', color: '#ffffff' }

/** Gradient endpoints across a w x h box, for a given angle in degrees.
 *
 * Both renderers need the same two points or the SVG and the PNG disagree, so
 * this is computed once here. The vector runs through the centre and is scaled
 * so the gradient just covers the box's diagonal projection, which is what CSS
 * `linear-gradient` does and therefore what people expect.
 */
export function gradientLine(
  w: number, h: number, angle: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  // Half-length of the box's projection onto the gradient direction.
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  const cx = w / 2
  const cy = h / 2
  return {
    x1: cx - dx * half, y1: cy - dy * half,
    x2: cx + dx * half, y2: cy + dy * half,
  }
}

/** Cover/contain box for an image of `iw x ih` inside a `w x h` piece. */
export function fitBox(
  iw: number, ih: number, w: number, h: number, fit: 'cover' | 'contain',
): { x: number; y: number; width: number; height: number } {
  if (!iw || !ih) return { x: 0, y: 0, width: w, height: h }
  const s = fit === 'contain'
    ? Math.min(w / iw, h / ih)
    : Math.max(w / iw, h / ih)
  const width = iw * s
  const height = ih * s
  return { x: (w - width) / 2, y: (h - height) / 2, width, height }
}

/** True when the background paints nothing, so a renderer can skip it and
 *  leave real transparency rather than painting white over it. */
export const isTransparent = (bg: Background | undefined): boolean =>
  !bg || bg.kind === 'transparent'

/** True when some of the finished piece will be transparent.
 *
 * Not the same question as isTransparent. An image fitted with `contain`
 * letterboxes, and those bars are genuinely transparent in the export. The
 * preview used to paint them white, so what you decided from and what came out
 * of the exporter disagreed on the one thing the setting is about. */
export const hasAlpha = (bg: Background | undefined): boolean =>
  isTransparent(bg) || (bg!.kind === 'image' && (bg as { fit?: string }).fit === 'contain')
