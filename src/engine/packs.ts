/** Glyph packs: the vocabulary of marks a mosaic is built from.
 *
 * A pack owns both the shapes and which of them each zone draws on. That used
 * to live on the palette, which was wrong: the colour ramp and the icon set
 * are independent choices, and coupling them meant a new pack needed a new
 * palette.
 *
 * Only the first pack is drawn by hand. The rest are generated, which keeps
 * them free of any licensing question, lets them regenerate at any grid size,
 * and costs a few lines each. What matters for the engine is not what a glyph
 * depicts but the ladder of ink coverages the pack offers: a dense, evenly
 * spaced ladder makes tone step smoothly, and several shapes at each step stop
 * a flat area resolving into one repeated mark.
 */
import type { GlyphSet, Grid } from './types'
import { coverageTable, DEFAULT_SET } from './glyphs'
import { ZONE_IDS, type ZoneId } from './palettes'
import asciiData from './ascii.json'
import emojiData from './emoji.json'

export interface GlyphPack {
  id: string
  label: string
  hint: string
  set: GlyphSet
  /** which glyphs and motif families each zone may use */
  zones: Record<ZoneId, string[]>
  /** `mask` glyphs are shapes tinted by the palette. `text` glyphs draw as
   *  themselves in their own colour, which is the only way emoji are worth
   *  having, and means the palette does nothing for those packs. */
  mode: 'mask' | 'text'
  /** ink coverage per glyph name, precomputed. For text packs this is measured
   *  at build time rather than derived from a pixel grid. */
  coverages: Record<string, number>
  /** glyph name to character, for text packs */
  chars?: Record<string, string>
  /** shown in the UI when a pack carries a caveat or attribution */
  note?: string
}

// --- generation helpers ------------------------------------------------------

type Mask = boolean[][]

function blank(n: number): Mask {
  return Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
}

/** Stamp a shape from a predicate in centred coordinates running -1 to 1, so
 *  the same definition works at any grid size. */
function stamp(n: number, pred: (x: number, y: number) => boolean): Mask {
  const m = blank(n)
  const c = n / 2
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      m[y][x] = pred((x - c + 0.5) / c, (y - c + 0.5) / c)
    }
  }
  return m
}

function erode(m: Mask): Mask {
  const n = m.length
  const out = blank(n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[y][x] =
        !!m[y][x] &&
        !!m[y - 1]?.[x] && !!m[y + 1]?.[x] &&
        !!m[y][x - 1] && !!m[y][x + 1]
    }
  }
  return out
}

/** The shape minus its eroded core: a thick outline at depth 2, a hairline at
 *  depth 1. Deriving weights rather than drawing them keeps a motif's three
 *  versions consistent and guarantees they sort in the right coverage order. */
function outline(m: Mask, depth: number): Mask {
  let core = m
  for (let i = 0; i < depth; i++) core = erode(core)
  return m.map((row, y) => row.map((v, x) => v && !core[y][x]))
}

function toGrid(m: Mask): Grid {
  return m.map((row) => row.map((v) => (v ? '#' : '.')).join(''))
}

const coverageOf = (m: Mask) =>
  m.reduce((s, r) => s + r.filter(Boolean).length, 0) / (m.length * m.length)

// --- shared small marks ------------------------------------------------------

/** Geometry simple enough to survive any size. Every pack needs something at
 *  the light end of the ladder, where a detailed shape has nothing to give. */
function smallMarks(n: number): Record<string, Mask> {
  return {
    micro: stamp(n, (x, y) => Math.abs(x) < 0.09 && Math.abs(y) < 0.09),
    dot: stamp(n, (x, y) => x * x + y * y < 0.22 ** 2),
    ring: stamp(n, (x, y) => x * x + y * y > 0.22 ** 2 && x * x + y * y < 0.34 ** 2),
    cross: stamp(n, (x, y) =>
      (Math.abs(x) < 0.1 && Math.abs(y) < 0.42) || (Math.abs(y) < 0.1 && Math.abs(x) < 0.42)),
    ex: stamp(n, (x, y) =>
      Math.abs(Math.abs(x) - Math.abs(y)) < 0.13 && Math.max(Math.abs(x), Math.abs(y)) < 0.38),
  }
}

const SMALL_NAMES = ['micro', 'dot', 'ring', 'cross', 'ex']

function assemble(
  grid: number, masks: Record<string, Mask>, families: Record<string, string[]>,
): GlyphSet {
  const glyphs: Record<string, Grid> = {}
  for (const [name, m] of Object.entries(masks)) glyphs[name] = toGrid(m)
  return { grid, glyphs, families, small: SMALL_NAMES }
}

// --- the generated packs -----------------------------------------------------

const N = 16

/** Outlined and solid primitives. Reads as a drawn diagram rather than as a
 *  photograph, and holds up when the cells get large. */
function geometricPack(): GlyphSet {
  const shapes: Record<string, Mask> = {
    circle: stamp(N, (x, y) => x * x + y * y <= 0.92 ** 2),
    square: stamp(N, (x, y) => Math.abs(x) <= 0.86 && Math.abs(y) <= 0.86),
    diamond: stamp(N, (x, y) => Math.abs(x) + Math.abs(y) <= 0.96),
    triangle: stamp(N, (x, y) => y <= 0.82 && y >= -0.86 && Math.abs(x) <= (y + 0.86) * 0.62),
    hexagon: stamp(N, (x, y) =>
      Math.abs(y) <= 0.84 && Math.abs(x) * 0.87 + Math.abs(y) * 0.5 <= 0.84),
    chevron: stamp(N, (x, y) =>
      Math.abs(Math.abs(x) - (y + 0.9) * 0.7) < 0.28 && y > -0.9 && y < 0.85),
  }

  const masks: Record<string, Mask> = { ...smallMarks(N) }
  const families: Record<string, string[]> = {}
  for (const [name, m] of Object.entries(shapes)) {
    masks[`${name}_thin`] = outline(m, 1)
    masks[`${name}_bold`] = outline(m, 2)
    masks[`${name}_solid`] = m
    families[name] = [`${name}_thin`, `${name}_bold`, `${name}_solid`]
  }
  return assemble(N, masks, families)
}

/** Dots only, growing with tone. The classic halftone, and the most
 *  photographic of the packs because nothing competes with the image. */
function stipplePack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const names: string[] = []
  // Radii chosen so coverage steps roughly evenly rather than by area.
  for (let i = 0; i < 14; i++) {
    const r = Math.sqrt((i + 1) / 14) * 0.98
    const name = `dot${String(i).padStart(2, '0')}`
    masks[name] = stamp(N, (x, y) => x * x + y * y <= r * r)
    names.push(name)
  }
  masks.micro = smallMarks(N).micro
  return assemble(N, masks, { dots: names })
}

/** Strokes at increasing weight and angle. Reads like engraving or hatching,
 *  and gives a strong direction the other packs do not. */
function barsPack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const families: Record<string, string[]> = {}
  const build = (key: string, pred: (t: number) => (x: number, y: number) => boolean) => {
    const names: string[] = []
    for (let i = 1; i <= 6; i++) {
      const t = i / 7
      const name = `${key}${i}`
      masks[name] = stamp(N, pred(t))
      names.push(name)
    }
    families[key] = names
  }
  build('hbar', (t) => (_x, y) => Math.abs(y) <= t)
  build('vbar', (t) => (x) => Math.abs(x) <= t)
  build('slash', (t) => (x, y) => Math.abs(x - y) <= t * 1.4)
  build('backslash', (t) => (x, y) => Math.abs(x + y) <= t * 1.4)
  build('grid', (t) => (x, y) => Math.abs(x) <= t || Math.abs(y) <= t)
  masks.micro = smallMarks(N).micro
  masks.dot = smallMarks(N).dot
  return assemble(N, masks, families)
}

// --- pack definitions --------------------------------------------------------

/** Zone vocabularies for the hand-drawn set: three different families so the
 *  sky, the ground and the subject are built from visibly different marks. */
const MOTIF_ZONES: Record<ZoneId, string[]> = {
  cool: ['falcon', 'tower', 'star', 'dome', 'barjeel', 'arrow', 'diamond',
    'rosette', 'minaret', 'chip', 'crescent'],
  warm: ['palm', 'dhow', 'dallah', 'droplet', 'coin', 'diamond', 'camel',
    'oryx', 'tent', 'dunes', 'feather', 'fort'],
  focus: ['dallah', 'palm', 'star', 'droplet', 'diamond', 'rosette',
    'feather', 'oryx', 'crescent', 'tent', 'dome'],
}

/** For the generated packs the shapes are abstract, so every zone draws on the
 *  whole vocabulary and the zones differ by colour alone. */
function allZones(set: GlyphSet): Record<ZoneId, string[]> {
  const names = Object.keys(set.families)
  const out = {} as Record<ZoneId, string[]>
  for (const z of ZONE_IDS) out[z] = names
  return out
}

/** Unicode block elements, generated rather than rasterised: they are pure
 *  geometry, so a font would only add a dependency and a rendering risk. Gives
 *  the cleanest, most even ladder of any pack. */
function blocksPack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const families: Record<string, string[]> = {}

  const halves: Record<string, (x: number, y: number) => boolean> = {
    full: () => true,
    upper: (_x, y) => y < 0,
    lower: (_x, y) => y >= 0,
    left: (x) => x < 0,
    right: (x) => x >= 0,
    quad: (x, y) => x < 0 === y < 0,
  }
  for (const [name, pred] of Object.entries(halves)) {
    masks[`b_${name}`] = stamp(N, pred)
  }
  families.solid = Object.keys(halves).map((k) => `b_${k}`)

  // Ordered dither at four levels, which is what ░ ▒ ▓ are doing.
  const bayer = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ]
  // One level per threshold step, so the lightest is a single lit cell in
  // sixteen. Scaling the threshold instead made level 1 light two cells and
  // left the pack with nothing below 0.125, which is too heavy to sit at the
  // pale end of a high-key image.
  const shades: string[] = []
  for (let level = 1; level <= 15; level++) {
    const name = `b_shade${String(level).padStart(2, '0')}`
    const m = blank(N)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        m[y][x] = bayer[y % 4][x % 4] < level
      }
    }
    masks[name] = m
    shades.push(name)
  }
  families.shade = shades
  // The dither pattern bottoms out at one cell in sixteen, so the geometric
  // small marks carry the very light end.
  Object.assign(masks, smallMarks(N))
  families.marks = SMALL_NAMES
  return assemble(N, masks, families)
}

const geometric = geometricPack()
const stipple = stipplePack()
const bars = barsPack()
const blocks = blocksPack()

/** Characters rasterised from a monospace font at build time, so the pack is
 *  deterministic and needs no webfont. No published density ramp is used: the
 *  engine measures each character's coverage and sorts by that, which is
 *  correct for whatever font was actually rasterised. */
const asciiSet = asciiData as unknown as GlyphSet & { chars: Record<string, string> }

/** Emoji, measured at build time for how dark each one actually renders,
 *  since with a text pack the tone has to come from which emoji is picked
 *  rather than from the colour ramp. */
const emojiRaw = emojiData as { font: string; emoji: Array<{ char: string; weight: number }> }
const emojiCoverages: Record<string, number> = {}
const emojiChars: Record<string, string> = {}
const emojiNames: string[] = []
emojiRaw.emoji.forEach((e, i) => {
  const name = `e${String(i).padStart(2, '0')}`
  emojiCoverages[name] = e.weight
  emojiChars[name] = e.char
  emojiNames.push(name)
})
const emojiSet: GlyphSet = {
  grid: 16,
  // No pixel grids: a text pack is drawn with fillText and <text>, not paths.
  glyphs: Object.fromEntries(emojiNames.map((n) => [n, [] as Grid])),
  families: { emoji: emojiNames },
  small: [],
}

function maskPack(
  id: string, label: string, hint: string, set: GlyphSet,
  zones?: Record<ZoneId, string[]>,
): GlyphPack {
  return {
    id, label, hint, set,
    zones: zones ?? allZones(set),
    mode: 'mask',
    coverages: coverageTable(set),
  }
}

export const PACKS: GlyphPack[] = [
  maskPack('motifs', 'Motifs',
    'Hand-drawn symbols. Each zone gets its own family.', DEFAULT_SET, MOTIF_ZONES),
  maskPack('geometric', 'Geometric',
    'Outlined and solid primitives. Reads as drawn.', geometric),
  maskPack('stipple', 'Stipple',
    'Dots only, growing with tone. The most photographic.', stipple),
  maskPack('bars', 'Hatching',
    'Strokes at increasing weight and angle. Like engraving.', bars),
  maskPack('blocks', 'Blocks',
    'Unicode block elements and ordered dither. The evenest ladder.', blocks),
  {
    id: 'ascii',
    label: 'ASCII',
    hint: 'Real characters from a monospace font, sorted by measured density.',
    set: asciiSet,
    zones: allZones(asciiSet),
    mode: 'mask',
    coverages: coverageTable(asciiSet),
    chars: asciiSet.chars,
  },
  {
    id: 'emoji',
    label: 'Emoji',
    hint: 'Drawn in their own colour, picked by how dark each one renders.',
    set: emojiSet,
    zones: allZones(emojiSet),
    mode: 'text',
    coverages: emojiCoverages,
    chars: emojiChars,
    note: 'Emoji keep their own colour, so the palette has no effect. In an ' +
      'exported SVG they rely on the viewer having an emoji font; PNG is safer ' +
      'for sharing.',
  },
]

export const DEFAULT_PACK = PACKS[0]

/** Coverage ladder a pack offers, for showing the user what they are picking
 *  and for checking a generated pack is not lumpy. */
export function packLadder(pack: GlyphPack): number[] {
  return [...new Set(Object.values(pack.set.glyphs).map((g) =>
    g.reduce((s, r) => s + [...r].filter((c) => c === '#').length, 0) /
    (pack.set.grid * pack.set.grid)))].sort((a, b) => a - b)
}

export { coverageOf }
