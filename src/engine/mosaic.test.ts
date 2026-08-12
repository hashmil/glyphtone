/** Checks the TypeScript engine against the Python prototype it was ported
 *  from, on a fixture both sides ran.
 *
 * The two use different PRNGs, so which glyph gets picked among tonally
 * interchangeable candidates differs by design and pixel equality is not the
 * bar. What must hold:
 *
 *   - the fill/empty decision is exact, since it depends only on the
 *     downsampled ink and the floor, with no randomness anywhere in it. Any
 *     drift here means the downsample is wrong.
 *   - the mean ink coverage lands within a whisker, since that is the tonal
 *     result the whole algorithm exists to produce.
 *   - the geometry is identical.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildMosaic, toDensityMaps, DEFAULT_OPTIONS } from './mosaic'
import { DEFAULT_SET, coverageTable } from './glyphs'
import { PALETTES } from './palettes'
import type { MosaicOptions } from './types'

const DIR = join(import.meta.dirname, '__fixtures__')
const stats = JSON.parse(readFileSync(join(DIR, 'python-stats.json'), 'utf8'))

/** The fixture is raw RGB, deliberately: no PNG decoder needed in the test. */
function loadFixture() {
  const raw = readFileSync(join(DIR, 'source.raw'))
  const { width, height } = stats
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = raw[i * 3]
    rgba[i * 4 + 1] = raw[i * 3 + 1]
    rgba[i * 4 + 2] = raw[i * 3 + 2]
    rgba[i * 4 + 3] = 255
  }
  return { rgba, width, height }
}

function run() {
  const { rgba, width, height } = loadFixture()
  const maps = toDensityMaps(rgba, width, height)
  const o = stats.options
  const opts: MosaicOptions = {
    ...DEFAULT_OPTIONS,
    cols: o.cols, width: o.width, gutter: o.gutter, gamma: o.gamma,
    contrast: o.contrast, floor: o.floor, vary: o.vary, seed: o.seed,
    valnoise: o.valnoise, knockout: o.knockout,
    figureBox: o.figureBox as [number, number, number, number],
  }
  // 'desert' carries the ramps and zone vocabularies the prototype hardcoded.
  const palette = PALETTES.find((p) => p.id === 'desert')!
  return buildMosaic(maps, DEFAULT_SET, palette, opts)
}

describe('mosaic engine vs the Python prototype', () => {
  const result = run()

  it('produces identical geometry', () => {
    expect(result.total).toBe(stats.total)
    expect(result.width).toBe(stats.outWidth)
    expect(result.height).toBe(stats.outHeight)
    expect(result.cell).toBeCloseTo(stats.cell, 6)
  })

  it('makes the same fill/empty decision in every cell', () => {
    // Exact. This has no RNG in it, so any difference is a downsample bug.
    expect(result.filled).toBe(stats.filled)
  })

  it('lands on the same mean ink coverage', () => {
    const covs = coverageTable(DEFAULT_SET)
    const mean =
      result.placements.reduce((s, p) => s + covs[p.glyph], 0) / result.placements.length
    expect(mean).toBeCloseTo(stats.meanCoverage, 2)
  })

  it('draws on a comparable breadth of the vocabulary', () => {
    // Different RNG picks different members of a tie, so this is a range and
    // not an equality. A collapse to a handful would mean --vary is broken.
    expect(result.used.size).toBeGreaterThanOrEqual(stats.glyphCount - 6)
    expect(result.used.size).toBeLessThanOrEqual(Object.keys(DEFAULT_SET.glyphs).length)
  })

  it('is deterministic for a given seed', () => {
    const again = run()
    expect(again.placements.map((p) => p.glyph).join()).toBe(
      result.placements.map((p) => p.glyph).join(),
    )
  })
})
