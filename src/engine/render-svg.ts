import type { MosaicResult } from './types'
import type { GlyphPack } from './packs'
import { svgDefs } from './glyphs'
import { gradientLine, type Background } from './background'

const hex = (n: number) => n.toString(16).padStart(2, '0')

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Vector export. One <use> per placed icon, referencing a plain <g>.
 *
 * Built only on export, never for the live preview: a mosaic is routinely
 * 100,000-plus elements, which the canvas renderer handles fine and the DOM
 * does not.
 *
 * Text packs emit <text> instead. That keeps emoji in their own colour, at the
 * cost of depending on the viewer having an emoji font, which is why the UI
 * steers those exports towards PNG.
 */
export function toSVG(
  result: MosaicResult, pack: GlyphPack,
  opts: { background?: Background; crop?: [number, number, number, number] } = {},
): string {
  const [vx, vy, vw, vh] = opts.crop ?? [0, 0, result.width, result.height]
  const cropped = !!opts.crop
  const text = pack.mode === 'text'

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

    if (text) {
      const size = p.scale * pack.set.grid
      parts.push(
        `<text x="${(p.x + size / 2).toFixed(1)}" y="${(p.y + size / 2).toFixed(1)}" ` +
        `font-size="${size.toFixed(1)}" text-anchor="middle" ` +
        `dominant-baseline="central">${escapeXml(p.char ?? '')}</text>`,
      )
      continue
    }

    parts.push(
      `<use xlink:href="#${p.glyph}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) ` +
      `scale(${p.scaleY === undefined ? p.scale.toFixed(4) : `${p.scale.toFixed(4)},${p.scaleY.toFixed(4)}`})" fill="#${hex(p.r)}${hex(p.g)}${hex(p.b)}"/>`,
    )
  }

  const glyphDefs = text ? '' : svgDefs(pack.set, cropped ? used : result.used)
  const bg = backgroundSvg(opts.background, result.width, result.height, [vx, vy, vw, vh])
  const defs = bg.defs || glyphDefs ? `<defs>${bg.defs}${glyphDefs}</defs>` : ''

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" ' +
    `width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}">` +
    `${defs}${bg.body}${parts.join('')}</svg>`
  )
}

/** Background as SVG, in piece coordinates.
 *
 * Piece coordinates rather than tile coordinates for the same reason the
 * canvas renderer uses them: the viewBox already places the tile inside the
 * piece, so a gradient or an image declared across the whole piece is
 * automatically clipped to this tile's slice of it. Declaring it across the
 * tile instead would restart the gradient in every file.
 */
function backgroundSvg(
  bg: Background | undefined, pieceW: number, pieceH: number,
  [vx, vy, vw, vh]: [number, number, number, number],
): { defs: string; body: string } {
  if (!bg || bg.kind === 'transparent') return { defs: '', body: '' }
  const rect = (fill: string) =>
    `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${fill}"/>`

  if (bg.kind === 'solid') return { defs: '', body: rect(bg.color) }

  if (bg.kind === 'gradient') {
    const l = gradientLine(pieceW, pieceH, bg.angle)
    return {
      defs:
        `<linearGradient id="gt-bg" gradientUnits="userSpaceOnUse" ` +
        `x1="${l.x1.toFixed(2)}" y1="${l.y1.toFixed(2)}" ` +
        `x2="${l.x2.toFixed(2)}" y2="${l.y2.toFixed(2)}">` +
        `<stop offset="0" stop-color="${bg.from}"/>` +
        `<stop offset="1" stop-color="${bg.to}"/></linearGradient>`,
      body: rect('url(#gt-bg)'),
    }
  }

  // The image is embedded as a data URL and laid out across the whole piece,
  // with preserveAspectRatio doing the cover/contain fit. fitBox is not used
  // here: SVG can do the fit itself, and letting it means the numbers do not
  // depend on having decoded the image first.
  const par = (bg.fit ?? 'cover') === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
  return {
    defs: '',
    body:
      `<image x="0" y="0" width="${pieceW}" height="${pieceH}" ` +
      `preserveAspectRatio="${par}" href="${escapeXml(bg.src)}"/>`,
  }
}

/** Illustrator refuses artboards beyond this, so anything larger has to ship
 *  as tiles however it was produced. Worth telling the user before they wait
 *  on a render they cannot open. */
export const MAX_ARTBOARD_PX = 16383
