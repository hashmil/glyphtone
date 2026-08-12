import type { Zone } from './types'

/** Zones are decided by the image, not by the user picking regions:
 *  warm pixels go one way, cool pixels the other, and anything inside the
 *  focal box overrides both. Each zone gets its own colour ramp and its own
 *  icon vocabulary, which is what stops a mosaic reading as one flat texture.
 */
export const ZONE_IDS = ['cool', 'warm', 'focus'] as const
export type ZoneId = (typeof ZONE_IDS)[number]

/** Geometric marks, shared by every zone. They sit at the light end of the
 *  ladder where a detailed motif has nothing left to give. */
export const SMALL_MARKS = ['micro', 'ex', 'ring', 'dot', 'cross']

const COOL_MOTIFS = [
  'falcon', 'tower', 'star', 'dome', 'barjeel', 'arrow', 'diamond',
  'rosette', 'minaret', 'chip', 'crescent',
]
const WARM_MOTIFS = [
  'palm', 'dhow', 'dallah', 'droplet', 'coin', 'diamond', 'camel',
  'oryx', 'tent', 'dunes', 'feather', 'fort',
]
const FOCUS_MOTIFS = [
  'dallah', 'palm', 'star', 'droplet', 'diamond', 'rosette',
  'feather', 'oryx', 'crescent', 'tent', 'dome',
]

export interface Palette {
  id: string
  label: string
  zones: Record<ZoneId, Zone>
}

function zones(
  cool: [readonly [number, number, number], readonly [number, number, number]],
  warm: [readonly [number, number, number], readonly [number, number, number]],
  focus: [readonly [number, number, number], readonly [number, number, number]],
): Record<ZoneId, Zone> {
  return {
    cool: { id: 'cool', label: 'Cool areas', ramp: cool, motifs: COOL_MOTIFS },
    warm: { id: 'warm', label: 'Warm areas', ramp: warm, motifs: WARM_MOTIFS },
    focus: { id: 'focus', label: 'Focal region', ramp: focus, motifs: FOCUS_MOTIFS },
  }
}

export const PALETTES: Palette[] = [
  {
    id: 'desert',
    label: 'Desert',
    zones: zones(
      [[222, 230, 246], [10, 16, 62]],
      [[246, 236, 214], [150, 100, 20]],
      [[206, 216, 238], [8, 12, 48]],
    ),
  },
  {
    id: 'ink',
    label: 'Ink',
    zones: zones(
      [[228, 228, 230], [12, 12, 14]],
      [[232, 230, 226], [28, 26, 22]],
      [[220, 220, 224], [0, 0, 0]],
    ),
  },
  {
    id: 'coral',
    label: 'Coral',
    zones: zones(
      [[226, 240, 242], [12, 68, 84]],
      [[254, 230, 222], [176, 54, 44]],
      [[240, 224, 226], [72, 12, 34]],
    ),
  },
  {
    id: 'forest',
    label: 'Forest',
    zones: zones(
      [[224, 238, 232], [10, 52, 44]],
      [[244, 240, 216], [122, 104, 24]],
      [[214, 230, 220], [6, 30, 24]],
    ),
  },
]

export const DEFAULT_PALETTE = PALETTES[0]
