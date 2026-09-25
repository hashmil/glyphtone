import type { MosaicOptions } from './types'

/** Named starting points, so the first thing you see is a considered result
 *  rather than the defaults of a command line tool.
 *
 * These replace the folder-per-experiment archaeology of the prototype. Each
 * one is a combination that was actually worth keeping.
 *
 * A preset now carries the pack and the palette as well as the numbers. It has
 * to: the landing page offers these as one-click starting points, and a card
 * labelled "ASCII, fine" that changed the density but left the glyphs on
 * hand-drawn motifs would be lying about what it does.
 */
export interface Preset {
  id: string
  label: string
  hint: string
  /** seeded alongside the options; left unset means "leave as it is" */
  packId?: string
  paletteId?: string
  options: Partial<MosaicOptions>
  /** shown as a rendered card on the landing page. Four fit a phone in two
   *  rows, so this is a deliberate subset rather than the whole list. */
  card?: boolean
}

export const PRESETS: Preset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    hint: 'Even tone, icons still readable one by one',
    packId: 'motifs',
    paletteId: 'sherbet',
    card: true,
    options: {
      method: 'grid',
      cols: 150, gamma: 0.85, contrast: 1.0, floor: 0.06, vary: 0.05, valnoise: 0.0,
      gutter: 1.0, knockout: false,
    },
  },
  {
    id: 'ascii-fine',
    label: 'ASCII, fine',
    hint: 'Characters at small size, reading as a typed page',
    packId: 'ascii',
    paletteId: 'ink',
    card: true,
    options: {
      method: 'grid',
      cols: 260, gamma: 0.92, contrast: 1.05, floor: 0.04, vary: 0.06, valnoise: 0.08,
      gutter: 1.0, knockout: false,
    },
  },
  {
    id: 'emoji-coarse',
    label: 'Emoji, coarse',
    hint: 'Few and large, each one legible on its own',
    packId: 'emoji',
    paletteId: 'mono',
    card: true,
    options: {
      method: 'grid',
      cols: 80, gamma: 0.8, contrast: 1.1, floor: 0.07, vary: 0.05, valnoise: 0.0,
      gutter: 0.94, knockout: false,
    },
  },
  {
    id: 'organic-scatter',
    label: 'Organic scatter',
    hint: 'Sparse, large, overlapping marks with no lattice',
    packId: 'geometric',
    paletteId: 'risograph',
    card: true,
    options: {
      method: 'organic',
      density: 0.55, glyphScale: 1.6, sizeJitter: 0.2, weightBias: 0.55,
      gamma: 0.85, contrast: 1.0, floor: 0.07,
    },
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    hint: 'Per-cell lightness jitter, closest to a hand-made mosaic',
    options: {
      method: 'grid',
      cols: 170, gamma: 0.85, contrast: 1.05, floor: 0.05, vary: 0.07, valnoise: 0.28,
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    hint: 'Fewer, larger icons and a harder tonal step',
    options: {
      method: 'grid',
      cols: 100, gamma: 0.75, contrast: 1.15, floor: 0.08, vary: 0.04, valnoise: 0.12,
    },
  },
  {
    id: 'fine',
    label: 'Fine',
    hint: 'Dense and photographic, icons read as texture up close',
    options: {
      method: 'grid',
      cols: 300, gamma: 0.95, contrast: 1.0, floor: 0.04, vary: 0.06, valnoise: 0.1,
    },
  },
]

export const DEFAULT_PRESET = PRESETS[0]

/** The subset the landing page renders as thumbnails. */
export const CARD_PRESETS = PRESETS.filter((p) => p.card)
