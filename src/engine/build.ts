import type { MosaicOptions, MosaicResult } from './types'
import type { GlyphPack } from './packs'
import type { Palette } from './palettes'
import { buildMosaic, type DensityMaps } from './mosaic'
import { buildFree } from './free'

/** Single entry point. Both methods take the same inputs and return the same
 *  placement list, so everything downstream, preview, export and tiling, is
 *  identical whichever is chosen. */
export function build(
  maps: DensityMaps, pack: GlyphPack, palette: Palette, opts: MosaicOptions,
): MosaicResult {
  return opts.method === 'organic'
    ? buildFree(maps, pack, palette, opts)
    : buildMosaic(maps, pack, palette, opts)
}
