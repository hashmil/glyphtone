import type { MosaicOptions } from './types'

/** Named starting points, so the first thing you see is a considered result
 *  rather than the defaults of a command line tool.
 *
 * These replace the folder-per-experiment archaeology of the prototype. Each
 * one is a combination that was actually worth keeping.
 */
export interface Preset {
  id: string
  label: string
  hint: string
  options: Partial<MosaicOptions>
}

export const PRESETS: Preset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    hint: 'Even tone, icons still readable one by one',
    options: { cols: 300, gamma: 0.85, contrast: 1.0, floor: 0.06, vary: 0.05, valnoise: 0.0 },
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    hint: 'Per-cell lightness jitter, closest to a hand-made mosaic',
    options: { cols: 340, gamma: 0.85, contrast: 1.05, floor: 0.05, vary: 0.07, valnoise: 0.28 },
  },
  {
    id: 'bold',
    label: 'Bold',
    hint: 'Fewer, larger icons and a harder tonal step',
    options: { cols: 170, gamma: 0.75, contrast: 1.15, floor: 0.08, vary: 0.04, valnoise: 0.12 },
  },
  {
    id: 'fine',
    label: 'Fine',
    hint: 'Dense and photographic, icons read as texture up close',
    options: { cols: 520, gamma: 0.95, contrast: 1.0, floor: 0.04, vary: 0.06, valnoise: 0.1 },
  },
]

export const DEFAULT_PRESET = PRESETS[0]
