/** Every pack has to offer a usable ladder of ink coverages.
 *
 * This is the property that decides whether a pack works. The engine picks the
 * glyph whose coverage is nearest the tone it wants, so a pack that bunches
 * everything at the light end cannot go dark, and one with a wide gap bands
 * across it. Both look like a tuning problem in the finished image and are
 * actually a pack problem, so they get caught here.
 */
import { describe, expect, it } from 'vitest'

import { PACKS } from './packs'
import { ZONE_IDS } from './palettes'
import { expand } from './glyphs'

describe.each(PACKS.map((p) => [p.id, p] as const))('pack %s', (_id, pack) => {
  it('has a coverage for every glyph it offers', () => {
    for (const z of ZONE_IDS) {
      const names = expand(pack.set, pack.zones[z])
      expect(names.length).toBeGreaterThan(3)
      for (const n of names) {
        expect(pack.coverages[n], `${n} has no coverage`).toBeGreaterThan(0)
        expect(pack.coverages[n]).toBeLessThanOrEqual(1)
      }
    }
  })

  it('spans enough of the tonal range to reach dark', () => {
    const covs = Object.values(pack.coverages).sort((a, b) => a - b)
    expect(covs[0]).toBeLessThan(0.12)
    // A non-overlapping grid cannot render darker than its heaviest glyph, so
    // a pack topping out low can only ever produce grey.
    expect(covs[covs.length - 1]).toBeGreaterThan(0.3)
  })

  it('steps without a gap wide enough to band', () => {
    const covs = [...new Set(Object.values(pack.coverages))].sort((a, b) => a - b)
    const gaps = covs.slice(1).map((c, i) => c - covs[i])
    expect(Math.max(...gaps)).toBeLessThan(0.2)
  })

  it('declares characters exactly when it needs them', () => {
    if (pack.mode === 'text') {
      expect(pack.chars).toBeDefined()
      for (const n of Object.keys(pack.coverages)) {
        expect(pack.chars![n], `${n} has no character`).toBeTruthy()
      }
      // Text packs draw with fillText, so pixel grids would be dead weight.
      expect(Object.values(pack.set.glyphs).every((g) => g.length === 0)).toBe(true)
    } else {
      for (const g of Object.values(pack.set.glyphs)) {
        expect(g.length).toBe(pack.set.grid)
        for (const row of g) expect(row.length).toBe(pack.set.grid)
      }
    }
  })
})
