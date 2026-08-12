/** Export-path checks.
 *
 * The tiled export exists so a piece too large for one artboard can still be
 * produced, and the thing that makes it worth having is that each tile costs
 * only its own share. The first version of the crop set the viewBox but still
 * wrote every icon into every tile, so four tiles were each the size of the
 * whole piece: visually right, completely pointless.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildMosaic, toDensityMaps, DEFAULT_OPTIONS } from './mosaic'
import { PACKS } from './packs'
import { PALETTES } from './palettes'
import { toSVG } from './render-svg'
import { fitBox, gradientLine, isTransparent } from './background'
import { makeZip } from '../lib/zip'

const DIR = join(import.meta.dirname, '__fixtures__')
const stats = JSON.parse(readFileSync(join(DIR, 'python-stats.json'), 'utf8'))

function result() {
  const raw = readFileSync(join(DIR, 'source.raw'))
  const { width, height } = stats
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = raw[i * 3]
    rgba[i * 4 + 1] = raw[i * 3 + 1]
    rgba[i * 4 + 2] = raw[i * 3 + 2]
    rgba[i * 4 + 3] = 255
  }
  return buildMosaic(toDensityMaps(rgba, width, height), MOTIFS, PALETTES[0], {
    ...DEFAULT_OPTIONS, cols: 160, width: 3200,
  })
}

const MOTIFS = PACKS.find((p) => p.id === 'motifs')!
const countUses = (svg: string) => (svg.match(/<use /g) ?? []).length

describe('SVG export', () => {
  const r = result()

  it('writes every placement when uncropped', () => {
    expect(countUses(toSVG(r, MOTIFS))).toBe(r.filled)
  })

  it('gives each tile only its own icons', () => {
    const hw = r.width / 2
    const hh = r.height / 2
    const quads = [
      [0, 0], [hw, 0], [0, hh], [hw, hh],
    ].map(([x, y]) =>
      countUses(toSVG(r, MOTIFS, { crop: [x, y, hw, hh] as [number, number, number, number] })))

    for (const n of quads) {
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThan(r.filled)
    }
    // Every icon lands in some tile, and the small excess is the deliberate
    // one-cell bleed that stops marks disappearing at the joins.
    const total = quads.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThanOrEqual(r.filled)
    expect(total).toBeLessThan(r.filled * 1.1)
  })

  it('only declares the glyphs a tile actually uses', () => {
    const tile = toSVG(r, MOTIFS, { crop: [0, 0, r.width / 4, r.height / 4] })
    const defs = (tile.match(/<g id="/g) ?? []).length
    expect(defs).toBeGreaterThan(0)
    expect(defs).toBeLessThanOrEqual(r.used.size)
  })

  it('uses the Illustrator-safe reference form', () => {
    const svg = toSVG(r, MOTIFS)
    // <symbol> plus a sized <use> is valid SVG2 and renders blank in
    // Illustrator, which is the target for a print export.
    expect(svg).toContain('xmlns:xlink')
    expect(svg).toContain('xlink:href="#')
    expect(svg).not.toContain('<symbol')
    expect(svg).toContain('version="1.1"')
  })
})

describe('background', () => {
  const r = result()
  const crop: [number, number, number, number] = [0, 0, r.width / 2, r.height / 2]

  // A mask glyph is itself drawn as <rect> runs, so the check has to be for a
  // rect the size of the viewport rather than for any rect at all.
  const bgRect = (svg: string) =>
    svg.match(new RegExp(`<rect x="0" y="0" width="${r.width}" height="${r.height}" fill="[^"]+"/>`))

  it('paints nothing at all when transparent', () => {
    const svg = toSVG(r, MOTIFS, { background: { kind: 'transparent' } })
    expect(bgRect(svg)).toBeNull()
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('linearGradient')
  })

  it('defaults to transparent rather than to white', () => {
    // The old signature defaulted to '#ffffff', which meant an export with no
    // background chosen silently gained one and could never be composited.
    expect(bgRect(toSVG(r, MOTIFS))).toBeNull()
  })

  it('fills the viewport for a solid colour', () => {
    const svg = toSVG(r, MOTIFS, { background: { kind: 'solid', color: '#ff0000' } })
    expect(svg).toContain(`<rect x="0" y="0" width="${r.width}" height="${r.height}" fill="#ff0000"/>`)
  })

  it('declares a gradient in piece coordinates, not tile coordinates', () => {
    const bg = { kind: 'gradient' as const, from: '#000000', to: '#ffffff', angle: 90 }
    const whole = toSVG(r, MOTIFS, { background: bg })
    const tile = toSVG(r, MOTIFS, { background: bg, crop })

    const line = (svg: string) =>
      svg.match(/x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/)!.slice(1)
    // Identical in both: the tile shows its slice of one gradient across the
    // whole piece. Recomputing it per tile is what seams a tiled export.
    expect(line(tile)).toEqual(line(whole))
    // 90 degrees runs top to bottom across the full height.
    const [, y1, , y2] = line(whole).map(Number)
    expect(y1).toBeCloseTo(0, 5)
    expect(y2).toBeCloseTo(r.height, 5)
    expect(tile).toContain('stop-color="#000000"')
    expect(tile).toContain('fill="url(#gt-bg)"')
  })

  it('turns the gradient with the angle', () => {
    const at = (angle: number) => {
      const svg = toSVG(r, MOTIFS, {
        background: { kind: 'gradient', from: '#000', to: '#fff', angle },
      })
      return svg.match(/x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/)!
        .slice(1).map(Number)
    }
    const [x1, , x2] = at(0)
    expect(x1).toBeCloseTo(0, 5)
    expect(x2).toBeCloseTo(r.width, 5)
    // 180 is the same line reversed.
    const [rx1, , rx2] = at(180)
    expect(rx1).toBeCloseTo(r.width, 5)
    expect(rx2).toBeCloseTo(0, 5)
  })

  it('embeds an image across the whole piece and lets tiles crop it', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    const bg = { kind: 'image' as const, src }
    const whole = toSVG(r, MOTIFS, { background: bg })
    expect(whole).toContain(`width="${r.width}" height="${r.height}"`)
    expect(whole).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(whole).toContain(`href="${src}"`)

    const tile = toSVG(r, MOTIFS, { background: bg, crop })
    // Same <image> element in the tile, positioned in piece coordinates; the
    // viewBox is what restricts it to this tile's share.
    expect(tile).toContain(`<image x="0" y="0" width="${r.width}" height="${r.height}"`)
    expect(tile).toContain(`viewBox="0 0 ${crop[2]} ${crop[3]}"`)
  })

  it('honours contain as well as cover', () => {
    const svg = toSVG(r, MOTIFS, {
      background: { kind: 'image', src: 'data:,', fit: 'contain' },
    })
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
  })

  it('escapes a data URL that contains XML metacharacters', () => {
    const svg = toSVG(r, MOTIFS, {
      background: { kind: 'image', src: 'data:image/svg+xml,<svg a="b"&c/>' },
    })
    expect(svg).toContain('&lt;svg')
    expect(svg).toContain('&amp;c')
  })

  it('places the background behind every glyph', () => {
    const svg = toSVG(r, MOTIFS, { background: { kind: 'solid', color: '#123456' } })
    expect(svg.indexOf('#123456')).toBeLessThan(svg.indexOf('<use '))
  })

  it('computes the same gradient line as the canvas renderer would', () => {
    // Both renderers call gradientLine, so this pins the shared contract: a
    // 45 degree gradient on a square runs corner to corner.
    const l = gradientLine(100, 100, 45)
    expect(l.x1).toBeCloseTo(0, 5)
    expect(l.y1).toBeCloseTo(0, 5)
    expect(l.x2).toBeCloseTo(100, 5)
    expect(l.y2).toBeCloseTo(100, 5)
  })

  it('fits a background image the way cover and contain are defined', () => {
    // Wide image into a square piece.
    const cover = fitBox(200, 100, 100, 100, 'cover')
    expect(cover.height).toBeCloseTo(100, 5)
    expect(cover.width).toBeCloseTo(200, 5)
    expect(cover.x).toBeCloseTo(-50, 5)

    const contain = fitBox(200, 100, 100, 100, 'contain')
    expect(contain.width).toBeCloseTo(100, 5)
    expect(contain.height).toBeCloseTo(50, 5)
    expect(contain.y).toBeCloseTo(25, 5)
  })

  it('treats a missing background as transparent', () => {
    expect(isTransparent(undefined)).toBe(true)
    expect(isTransparent({ kind: 'transparent' })).toBe(true)
    expect(isTransparent({ kind: 'solid', color: '#fff' })).toBe(false)
  })
})

describe('zip writer', () => {
  it('produces an archive with the expected structure', async () => {
    const blob = await makeZip([
      { name: 'a.txt', data: 'hello' },
      { name: 'b.txt', data: 'world' },
    ])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    // local file header, and an end-of-central-directory claiming two entries
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const eocd = bytes.length - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054b50)
    expect(view.getUint16(eocd + 8, true)).toBe(2)
    expect(view.getUint16(eocd + 10, true)).toBe(2)
  })
})
