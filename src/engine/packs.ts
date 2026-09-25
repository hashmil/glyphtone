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
import dingbatData from './dingbats.json'
import emojiData from './emoji.json'
import { themes } from './themes'

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
  /** Width over height of the cell each glyph is designed for. 1 is square.
   *
   * ASCII is rasterised into a half-width terminal cell and stored square, so
   * drawn into a square cell every character came out twice as wide as the
   * font draws it. Laying it out in cells of its own shape restores the real
   * letterforms. Ink coverage is a fraction of the cell, so a non-uniform
   * scale leaves the tonal ladder exactly as measured. */
  aspect?: number
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

/** Box drawing, generated rather than rasterised.
 *
 * Not from Noto Sans Symbols 2: its shipped subsets run U+25A0-27BF and
 * U+2800-28FF, and U+2500-257F is in neither. Rasterising it anyway produced a
 * perfectly good pack drawn entirely from a macOS fallback font, which is the
 * exact failure the tool now refuses. Box drawing is strokes on a lattice, so
 * generating it costs less than sourcing a second face for it.
 *
 * The stems meet at the centre, which is what makes these tile into continuous
 * rule work across neighbouring cells when the grid is dense.
 */
function boxPack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const families: Record<string, string[]> = {}

  /** Arms as [up, right, down, left], at a given stroke half-width. */
  const arms = (u: boolean, r: boolean, d: boolean, l: boolean, t: number) =>
    stamp(N, (x, y) =>
      (Math.abs(y) <= t && ((r && x >= -t) || (l && x <= t))) ||
      (Math.abs(x) <= t && ((d && y >= -t) || (u && y <= t))))

  const SHAPES: Array<[string, boolean, boolean, boolean, boolean]> = [
    ['h', false, true, false, true],
    ['v', true, false, true, false],
    ['tl', false, true, true, false],
    ['tr', false, false, true, true],
    ['bl', true, true, false, false],
    ['br', true, false, false, true],
    ['teeR', true, true, true, false],
    ['teeL', true, false, true, true],
    ['teeD', false, true, true, true],
    ['teeU', true, true, false, true],
    ['cross', true, true, true, true],
  ]

  // Three weights per shape, so the pack has a ladder rather than one tone.
  for (const [name, u, r, d, l] of SHAPES) {
    const names: string[] = []
    // 0.09 is the thinnest that survives: at N=16 a half-width below about
    // 0.07 rounds to no lit cell at all, and the glyph ships blank.
    for (const [suffix, t] of [['light', 0.09], ['heavy', 0.19], ['fat', 0.34]] as const) {
      const key = `bx_${name}_${suffix}`
      masks[key] = arms(u, r, d, l, t)
      names.push(key)
    }
    families[name] = names
  }

  // Dashes: the same rules broken up, which reads much lighter than a thin
  // continuous rule and fills the gap at the pale end.
  const dash = (vertical: boolean, n: number) =>
    stamp(N, (x, y) => {
      const along = vertical ? y : x
      const across = vertical ? x : y
      return Math.abs(across) <= 0.09 && Math.abs(((along + 1) * n) % 2 - 1) > 0.45
    })
  families.dash = []
  for (const n of [2, 3, 4]) {
    for (const [k, vert] of [['h', false], ['v', true]] as const) {
      const key = `bx_dash${k}${n}`
      masks[key] = dash(vert, n)
      families.dash.push(key)
    }
  }

  Object.assign(masks, smallMarks(N))
  families.marks = SMALL_NAMES
  return assemble(N, masks, families)
}

/** Braille, all 256 patterns, generated rather than rasterised.
 *
 * Noto Sans Symbols 2 does carry U+2800-28FF, and it was rasterised and
 * measured: its heaviest cell, all eight dots, covers 0.188 of the grid. That
 * is below what the pack tests require to reach dark, and it shows, the whole
 * image comes out as a mid grey with no black anywhere. The dots are simply
 * drawn small, and nothing downstream can add ink that is not there.
 *
 * Generating them puts the dot radius under control while keeping every one of
 * the 256 real patterns, so the ladder steps one dot at a time from one dot to
 * eight and reaches 0.35 at the top.
 */
function braillePack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const families: Record<string, string[]> = {}

  // Standard 8-dot layout: two columns, four rows. Dot 1 is top left, then
  // down the left column, then down the right, which is the bit order the
  // U+2800 block uses.
  const COLS = [-0.42, 0.42]
  const ROWS = [-0.66, -0.22, 0.22, 0.66]
  const DOTS: Array<[number, number]> = [
    [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3],
  ]
  const R = 0.24

  // One family per dot count, so glyphs of equal weight sit together and the
  // engine's variety tolerance has real alternatives to choose between.
  for (let bits = 1; bits < 256; bits++) {
    const on = DOTS.filter((_, i) => bits & (1 << i))
    const name = `br${bits.toString(16).padStart(2, '0')}`
    masks[name] = stamp(N, (x, y) =>
      on.some(([c, r]) =>
        (x - COLS[c]) ** 2 + (y - ROWS[r]) ** 2 <= R * R))
    const count = on.length
    ;(families[`dots${count}`] ??= []).push(name)
  }

  Object.assign(masks, smallMarks(N))
  families.marks = SMALL_NAMES
  return assemble(N, masks, families)
}

/** Halftone and dither ramps: the reprographic screens, as a tone ladder.
 *
 * Distinct from Stipple, which is one round dot growing on a 16x16 cell. These
 * are screens: a clustered dot on a rotated lattice, a line screen at four
 * angles, and ordered dither on both a Bayer matrix and a void-and-cluster-ish
 * spiral. That is what gives the printed, separated look rather than the
 * photographic one.
 */
function ditherPack(): GlyphSet {
  const masks: Record<string, Mask> = {}
  const families: Record<string, string[]> = {}

  // Clustered dot on a 45-degree lattice, the classic newspaper screen. Two
  // dots per cell so the screen frequency is visibly higher than the grid.
  const clustered: string[] = []
  for (let i = 1; i <= 12; i++) {
    const r = Math.sqrt(i / 12) * 0.62
    const name = `ht_dot${String(i).padStart(2, '0')}`
    masks[name] = stamp(N, (x, y) => {
      // Rotate 45 degrees, then tile: two centres per axis.
      const u = (x + y) / Math.SQRT2
      const v = (x - y) / Math.SQRT2
      const fu = ((u + 3) % 0.75) - 0.375
      const fv = ((v + 3) % 0.75) - 0.375
      return fu * fu + fv * fv <= (r * 0.75) ** 2
    })
    clustered.push(name)
  }
  families.clustered = clustered

  // Line screens. Four angles, six weights each: the other half of what a
  // repro camera could do, and a strong direction the dot screens lack.
  for (const [key, proj] of [
    ['screen0', (x: number) => x],
    ['screen45', (x: number, y: number) => (x + y) / Math.SQRT2],
    ['screen90', (_x: number, y: number) => y],
    ['screen135', (x: number, y: number) => (x - y) / Math.SQRT2],
  ] as const) {
    const names: string[] = []
    for (let i = 1; i <= 6; i++) {
      // Same floor as the box rules: below about 0.07 in centred coordinates
      // the stroke falls between cells and the glyph rasterises empty.
      const t = 0.07 + (i / 6) * 0.16
      const name = `${key}_${i}`
      masks[name] = stamp(N, (x, y) => {
        const p = proj(x, y)
        return Math.abs(((p + 4) % 0.5) - 0.25) <= t
      })
      names.push(name)
    }
    families[key] = names
  }

  // Ordered dither on an 8x8 Bayer matrix. Finer than the 4x4 the Blocks pack
  // uses, so this ramp has 63 steps rather than 15 and the light end is not a
  // sudden jump from nothing to one lit cell in sixteen.
  const bayer8 = (x: number, y: number) => {
    let v = 0
    let mask = 4
    let shift = 0
    while (mask > 0) {
      const bx = (x & mask) ? 1 : 0
      const by = (y & mask) ? 1 : 0
      v |= ((by ^ bx) << (2 * shift + 1)) | (by << (2 * shift))
      mask >>= 1
      shift++
    }
    return v
  }
  const ordered: string[] = []
  for (let level = 2; level <= 62; level += 4) {
    const name = `ht_bayer${String(level).padStart(2, '0')}`
    const m = blank(N)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) m[y][x] = bayer8(x % 8, y % 8) < level
    }
    masks[name] = m
    ordered.push(name)
  }
  families.ordered = ordered

  Object.assign(masks, smallMarks(N))
  families.marks = SMALL_NAMES
  return assemble(N, masks, families)
}

const geometric = geometricPack()
const stipple = stipplePack()
const bars = barsPack()
const blocks = blocksPack()
const box = boxPack()
const dither = ditherPack()
const braille = braillePack()

/** Characters rasterised from a monospace font at build time, so the pack is
 *  deterministic and needs no webfont. No published density ramp is used: the
 *  engine measures each character's coverage and sorts by that, which is
 *  correct for whatever font was actually rasterised. */
type FontPackData = GlyphSet & { chars: Record<string, string>; font: string }

const asciiSet = asciiData as unknown as FontPackData
const dingbatSet = dingbatData as unknown as FontPackData

/** A pack rasterised from a font by tools/make-font-pack.mjs.
 *
 * Registers exactly like a generated pack: the JSON is already a GlyphSet, so
 * nothing in the engine needs to know a font was involved. It is a mask pack
 * like any other, which is what keeps SVG export as vector paths and means no
 * webfont has to load, or be present on the recipient's machine, for the
 * export to be correct. */
function fontPack(
  id: string, label: string, hint: string, set: FontPackData, aspect = 1,
): GlyphPack {
  return {
    id, label, hint, set, aspect,
    zones: allZones(set),
    mode: 'mask',
    coverages: coverageTable(set),
    chars: set.chars,
    note: `Rasterised from ${set.font} (SIL Open Font License) at build time, ` +
      `so the export needs no font and every glyph shipped was checked to have ` +
      `an outline.`,
  }
}

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
  // Motif sets drawn in code: Gulf first, then the other themes. See themes.ts.
  ...themes(Object.fromEntries(
    Object.entries(smallMarks(24)).map(([k, m]) => [k, toGrid(m)]),
  )).map((t) => maskPack(t.id, t.label, t.hint, t.set, t.zones)),
  maskPack('geometric', 'Geometric',
    'Outlined and solid primitives. Reads as drawn.', geometric),
  maskPack('stipple', 'Stipple',
    'Dots only, growing with tone. The most photographic.', stipple),
  maskPack('bars', 'Hatching',
    'Strokes at increasing weight and angle. Like engraving.', bars),
  maskPack('blocks', 'Blocks',
    'Unicode block elements and ordered dither. The evenest ladder.', blocks),
  maskPack('dither', 'Halftone',
    'Repro screens: clustered dot, line screens, ordered dither.', dither),
  maskPack('box', 'Box drawing',
    'Rules, corners and junctions. Joins up across neighbouring cells.', box),
  fontPack('ascii', 'ASCII',
    'Characters from a monospace face, sorted by measured density.', asciiSet,
    // Must match --aspect in tools/make-packs.mjs, which the pack was
    // rasterised at.
    0.5),
  maskPack('braille', 'Braille',
    'All 256 eight-dot cells, so tone steps one dot at a time.', braille),
  fontPack('dingbats', 'Dingbats',
    'Arrows, stars, ornaments and weather marks.', dingbatSet),
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

/** The Python prototype's hand-drawn vocabulary, 16 px. No longer offered in
 *  the app, which uses the redrawn Gulf set, but kept because the engine's
 *  parity tests compare against runs of the prototype made with exactly these
 *  glyphs. */
export const PROTOTYPE_MOTIFS = maskPack('prototype', 'Prototype motifs',
  'The prototype\'s hand-drawn set.', DEFAULT_SET, MOTIF_ZONES)

/** Coverage ladder a pack offers, for showing the user what they are picking
 *  and for checking a generated pack is not lumpy. */
export function packLadder(pack: GlyphPack): number[] {
  return [...new Set(Object.values(pack.set.glyphs).map((g) =>
    g.reduce((s, r) => s + [...r].filter((c) => c === '#').length, 0) /
    (pack.set.grid * pack.set.grid)))].sort((a, b) => a - b)
}

export { coverageOf }
