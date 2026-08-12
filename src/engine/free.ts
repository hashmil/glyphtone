/** Icon mosaic with no grid at all: free placement, varying size, overlap.
 *
 * Marks are scattered by importance sampling rather than laid on a lattice,
 * they vary continuously in size, and they are allowed to pile on top of each
 * other.
 *
 * Overlap is the point, not a defect. It is the only way to get a genuinely
 * near-black core and a delicate sparse edge in the same image: a
 * non-overlapping grid is capped by the coverage of its single heaviest glyph,
 * this is not.
 *
 * Several passes run at different scales. The coarse pass lays down large,
 * sparse marks that give the halo at the edges of a form; each finer pass adds
 * density only where the source is dark, and those small dark marks land on
 * top. Sorting back to front by size stops the big pale ones burying the small
 * dark ones.
 *
 * Placement is a jittered grid rather than pure random, which gives roughly
 * blue-noise spacing: no clumps, no gaps, and no visible lattice.
 *
 * A faithful port of the Python prototype's free_mosaic.build.
 */
import type { MosaicOptions, MosaicResult, Placement } from './types'
import type { GlyphPack } from './packs'
import type { Palette, ZoneId } from './palettes'
import { ZONE_IDS } from './palettes'
import { expand } from './glyphs'
import { mulberry32 } from './rng'
import type { DensityMaps } from './mosaic'

/** Spacing, glyph size, ink exponent, all in units of output width / 4000.
 *
 * Size is absolute rather than a fraction of spacing. Tying it to spacing
 * makes the coarse pass eight times bigger than the fine one, which reads as
 * clutter. Reference mosaics keep their marks close to one size and get their
 * range from density and overlap instead, so these stay in a narrow band while
 * the spacing varies widely.
 */
const PASSES: Array<[number, number, number]> = [
  [44.0, 9.0, 0.65],
  [20.0, 7.4, 0.95],
  [10.0, 6.0, 1.30],
  [5.2, 5.0, 1.75],
]

export function buildFree(
  maps: DensityMaps, pack: GlyphPack, palette: Palette, opts: MosaicOptions,
): MosaicResult {
  const { width: sw, height: sh } = maps
  const outW = opts.width
  const outH = Math.round((outW * sh) / sw)
  const scale = outW / sw
  const unit = outW / 4000

  const covs = pack.coverages
  // Per zone, sorted light to heavy, so a mark can be picked by weight.
  // Knockout tiles are dropped here: with overlap they stack into solid blocks
  // and swallow everything underneath.
  const ladders = ZONE_IDS.map((z) =>
    [...new Set(expand(pack.set, pack.zones[z]))]
      .filter((n) => !n.endsWith('_rev'))
      .sort((a, b) => covs[a] - covs[b]))

  const random = mulberry32(opts.seed)
  const placements: Placement[] = []
  const used = new Set<string>()
  let maxSize = 0

  const fig = opts.figureBox

  for (const [spacing, glyphSize, expo] of PASSES) {
    const step = (spacing * unit) / Math.max(opts.density, 0.05)
    const nx = Math.ceil(outW / step) + 1
    const ny = Math.ceil(outH / step) + 1

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const ox = (i + random()) * step
        const oy = (j + random()) * step
        const sx = Math.min(sw - 1, Math.max(0, Math.floor(ox / scale)))
        const sy = Math.min(sh - 1, Math.max(0, Math.floor(oy / scale)))
        const idx = sy * sw + sx

        const k = Math.pow(maps.ink[idx], opts.gamma)
        // Importance sampling: a mark survives with probability set by how
        // dark the source is here, raised to the pass's own exponent. Coarse
        // passes keep marks in pale areas, fine passes only in dark ones.
        if (k < opts.floor || random() > Math.pow(k, expo)) continue

        const inFig = fig ? sx >= fig[0] && sx < fig[2] && sy >= fig[1] && sy < fig[3] : false
        const zi = inFig ? 2 : maps.warmth[idx] > 0.012 ? 1 : 0
        const ladder = ladders[zi]
        if (!ladder.length) continue

        // Darker source gives smaller, tighter marks; lighter gives larger,
        // sparser ones. glyphScale then sets the overall size independently of
        // how many marks there are, and sizeJitter the spread around it.
        const jit = opts.sizeJitter
        const size = glyphSize * unit * opts.glyphScale *
          (1.18 - 0.3 * k) * (1 - jit + 2 * jit * random())
        if (size > maxSize) maxSize = size

        // Heavier glyphs where it is dark, on top of the density already
        // there. weightBias sets how much darkness decides versus chance.
        const t = Math.min(0.999, Math.max(0,
          k * opts.weightBias + random() * (1 - opts.weightBias)))
        const name = ladder[Math.floor(t * ladder.length)]
        used.add(name)

        const [pale, deep] = palette.ramps[ZONE_IDS[zi] as ZoneId]
        const tt = Math.min(1, Math.max(0, Math.pow(k * 1.35, 0.6)))
        const mix = (p: number, d: number, s: number) =>
          Math.round(Math.min(255, Math.max(0, (p + (d - p) * tt) * 0.86 + s * 0.14)))

        placements.push({
          glyph: name,
          char: pack.chars?.[name],
          x: ox - size / 2,
          y: oy - size / 2,
          scale: size / pack.set.grid,
          r: mix(pale[0], deep[0], maps.rgb[idx * 3]),
          g: mix(pale[1], deep[1], maps.rgb[idx * 3 + 1]),
          b: mix(pale[2], deep[2], maps.rgb[idx * 3 + 2]),
        })
      }
    }
  }

  // Big pale marks first, small dark ones on top. Without this the coarse
  // pass paints over the detail every finer pass just added.
  placements.sort((a, b) => b.scale - a.scale)

  return {
    placements, used, width: outW, height: outH,
    rows: 0, cols: 0,
    // Used as the bleed when cropping a tile, so it has to be the largest
    // mark rather than a lattice cell, which this method does not have.
    cell: maxSize,
    filled: placements.length,
    total: placements.length,
  }
}
