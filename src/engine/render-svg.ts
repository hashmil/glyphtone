import type { GlyphSet, MosaicResult } from './types'
import { svgDefs } from './glyphs'

const hex = (n: number) => n.toString(16).padStart(2, '0')

/** Vector export. One <use> per placed icon, referencing a plain <g>.
 *
 * Built only on export, never for the live preview: a mosaic is routinely
 * 50,000-plus elements, which the canvas renderer handles fine and the DOM
 * does not.
 */
export function toSVG(
  result: MosaicResult, set: GlyphSet,
  opts: { background?: string; crop?: [number, number, number, number] } = {},
): string {
  const bg = opts.background ?? '#ffffff'
  const [vx, vy, vw, vh] = opts.crop ?? [0, 0, result.width, result.height]
  const cropped = !!opts.crop

  const parts: string[] = []
  // A tile has to contain only its own icons, or every tile is as heavy as the
  // whole piece and tiling buys nothing. The cell-sized bleed keeps glyphs that
  // straddle the edge, so joins do not lose marks.
  const bleed = result.cell
  const used = new Set<string>()
  for (const p of result.placements) {
    if (cropped && (p.x + bleed < vx || p.y + bleed < vy ||
                    p.x > vx + vw || p.y > vy + vh)) continue
    used.add(p.glyph)
    parts.push(
      `<use xlink:href="#${p.glyph}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) ` +
      `scale(${p.scale.toFixed(4)})" fill="#${hex(p.r)}${hex(p.g)}${hex(p.b)}"/>`,
    )
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" ' +
    `width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">` +
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>` +
    `<defs>${svgDefs(set, cropped ? used : result.used)}</defs>${parts.join('')}</svg>`
  )
}

/** Illustrator refuses artboards beyond this, so anything larger has to ship
 *  as tiles however it was produced. Worth telling the user before they wait
 *  on a render they cannot open. */
export const MAX_ARTBOARD_PX = 16383
