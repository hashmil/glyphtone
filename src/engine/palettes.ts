import type { Ramp } from './types'

/** Zones are decided by the image, not by the user picking regions: warm
 *  pixels go one way, cool pixels the other, and anything inside the focal box
 *  overrides both. Each zone gets its own colour ramp, and its own slice of
 *  the glyph pack's vocabulary, which is what stops a mosaic reading as one
 *  flat texture.
 */
export const ZONE_IDS = ['cool', 'warm', 'focus'] as const
export type ZoneId = (typeof ZONE_IDS)[number]

export const ZONE_LABELS: Record<ZoneId, string> = {
  cool: 'Cool areas',
  warm: 'Warm areas',
  focus: 'Focal region',
}

export interface Palette {
  id: string
  label: string
  /** pale-to-deep ramp per zone. The pale end is where a mark sits when the
   *  source is barely inked, the deep end where it is solid. */
  ramps: Record<ZoneId, Ramp>
}

export const PALETTES: Palette[] = [
  {
    // The default. Tangerine for warm areas and violet for cool, so a
    // portrait, which is almost all warm skin, comes out bright with its
    // darkest features picked out in the contrasting hue.
    id: 'sherbet',
    label: 'Sherbet',
    ramps: {
      cool: [[230, 234, 255], [88, 66, 240]],
      warm: [[255, 234, 218], [255, 96, 44]],
      focus: [[255, 226, 240], [214, 18, 108]],
    },
  },
  {
    id: 'arcade',
    label: 'Arcade',
    ramps: {
      cool: [[222, 248, 238], [0, 150, 112]],
      warm: [[255, 226, 240], [226, 16, 132]],
      focus: [[232, 230, 255], [72, 40, 230]],
    },
  },
  {
    id: 'desert',
    label: 'Desert',
    ramps: {
      cool: [[222, 230, 246], [10, 16, 62]],
      warm: [[246, 236, 214], [150, 100, 20]],
      focus: [[206, 216, 238], [8, 12, 48]],
    },
  },
  {
    id: 'ink',
    label: 'Ink',
    ramps: {
      cool: [[228, 228, 230], [12, 12, 14]],
      warm: [[232, 230, 226], [28, 26, 22]],
      focus: [[220, 220, 224], [0, 0, 0]],
    },
  },
  {
    id: 'coral',
    label: 'Coral',
    ramps: {
      cool: [[226, 240, 242], [12, 68, 84]],
      warm: [[254, 230, 222], [176, 54, 44]],
      focus: [[240, 224, 226], [72, 12, 34]],
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    ramps: {
      cool: [[224, 238, 232], [10, 52, 44]],
      warm: [[244, 240, 216], [122, 104, 24]],
      focus: [[214, 230, 220], [6, 30, 24]],
    },
  },
  {
    id: 'mono',
    label: 'Mono',
    ramps: {
      cool: [[225, 225, 225], [20, 20, 20]],
      warm: [[225, 225, 225], [20, 20, 20]],
      focus: [[210, 210, 210], [0, 0, 0]],
    },
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    ramps: {
      cool: [[214, 228, 246], [8, 42, 110]],
      warm: [[226, 234, 248], [22, 74, 150]],
      focus: [[200, 216, 240], [4, 20, 70]],
    },
  },
  {
    id: 'risograph',
    label: 'Risograph',
    ramps: {
      cool: [[236, 226, 246], [86, 32, 158]],
      warm: [[255, 226, 232], [232, 46, 108]],
      focus: [[240, 226, 240], [40, 14, 96]],
    },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    ramps: {
      cool: [[240, 232, 218], [78, 58, 38]],
      warm: [[246, 234, 208], [122, 78, 30]],
      focus: [[232, 220, 202], [44, 30, 18]],
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    ramps: {
      cool: [[214, 246, 246], [0, 132, 168]],
      warm: [[248, 232, 214], [226, 88, 18]],
      focus: [[236, 214, 246], [122, 0, 168]],
    },
  },
  {
    id: 'sea',
    label: 'Sea',
    ramps: {
      cool: [[216, 238, 244], [6, 58, 92]],
      warm: [[232, 244, 236], [18, 106, 96]],
      focus: [[206, 228, 236], [2, 32, 56]],
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    ramps: {
      cool: [[238, 226, 224], [72, 26, 34]],
      warm: [[254, 232, 206], [196, 66, 12]],
      focus: [[240, 220, 216], [40, 10, 14]],
    },
  },
  {
    id: 'moss',
    label: 'Moss',
    ramps: {
      cool: [[228, 236, 224], [44, 66, 44]],
      warm: [[242, 238, 214], [116, 118, 40]],
      focus: [[218, 228, 214], [22, 38, 24]],
    },
  },
  {
    id: 'candy',
    label: 'Candy',
    ramps: {
      cool: [[226, 240, 252], [42, 122, 214]],
      warm: [[255, 232, 240], [236, 84, 148]],
      focus: [[244, 232, 252], [126, 60, 200]],
    },
  },
  {
    id: 'dusk',
    label: 'Dusk',
    ramps: {
      cool: [[226, 226, 244], [42, 38, 96]],
      warm: [[250, 230, 232], [162, 68, 96]],
      focus: [[222, 218, 238], [18, 14, 48]],
    },
  },
]

export const DEFAULT_PALETTE = PALETTES[0]
