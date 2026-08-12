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
import { DEFAULT_SET } from './glyphs'
import { PALETTES } from './palettes'
import { toSVG } from './render-svg'
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
  return buildMosaic(toDensityMaps(rgba, width, height), DEFAULT_SET, PALETTES[0], {
    ...DEFAULT_OPTIONS, cols: 160, width: 3200,
  })
}

const countUses = (svg: string) => (svg.match(/<use /g) ?? []).length

describe('SVG export', () => {
  const r = result()

  it('writes every placement when uncropped', () => {
    expect(countUses(toSVG(r, DEFAULT_SET))).toBe(r.filled)
  })

  it('gives each tile only its own icons', () => {
    const hw = r.width / 2
    const hh = r.height / 2
    const quads = [
      [0, 0], [hw, 0], [0, hh], [hw, hh],
    ].map(([x, y]) =>
      countUses(toSVG(r, DEFAULT_SET, { crop: [x, y, hw, hh] as [number, number, number, number] })))

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
    const tile = toSVG(r, DEFAULT_SET, { crop: [0, 0, r.width / 4, r.height / 4] })
    const defs = (tile.match(/<g id="/g) ?? []).length
    expect(defs).toBeGreaterThan(0)
    expect(defs).toBeLessThanOrEqual(r.used.size)
  })

  it('uses the Illustrator-safe reference form', () => {
    const svg = toSVG(r, DEFAULT_SET)
    // <symbol> plus a sized <use> is valid SVG2 and renders blank in
    // Illustrator, which is the target for a print export.
    expect(svg).toContain('xmlns:xlink')
    expect(svg).toContain('xlink:href="#')
    expect(svg).not.toContain('<symbol')
    expect(svg).toContain('version="1.1"')
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
