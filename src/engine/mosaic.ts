/** Icon mosaic on a strict grid: uniform glyph size, no overlap.
 *
 * Every icon sits in its own cell of a fixed lattice at one constant size, so
 * nothing can ever collide. Tone is carried by three stacked axes instead of
 * by glyph size:
 *
 *   1. Which cells are filled at all   (coarse density)
 *   2. Which glyph fills them          (each glyph has its own ink coverage)
 *   3. How dark that glyph is drawn    (colour intensity)
 *
 * Axis 2 is the interesting one. Rather than picking a glyph at random, each
 * cell asks for a target ink coverage and gets the glyph that comes closest.
 * Light areas fill with dots and crosses, dark areas with solids, and the
 * tonal gradient emerges from the shapes themselves.
 *
 * Quantising a continuous target down to the handful of coverages actually
 * available is Floyd-Steinberg error diffusion on a serpentine scan. Rounding
 * each cell independently bands badly; diffusing the error into neighbours
 * keeps the local average exact and turns the banding into fine texture.
 *
 * A faithful port of the Python prototype's grid_mosaic.build.
 */
import type { GlyphSet, MosaicOptions, MosaicResult, Placement } from './types'
import type { GlyphPack } from './packs'
import type { Palette, ZoneId } from './palettes'
import { ZONE_IDS } from './palettes'
import { expand } from './glyphs'
import { mulberry32, randInt } from './rng'

export const DEFAULT_OPTIONS: MosaicOptions = {
  method: 'grid',
  // Was 2.0, chosen when organic had to beat a 420-column grid and could only
  // do it by placing a quarter of a million marks. With the ordered default now
  // at 150 columns, matching that would bury the image; organic's job is to
  // read as scattered, not as dense. 0.55 places roughly 19k marks against the
  // ordered default's 5k, and each of them is larger, so it is visibly the
  // sparser, looser of the two rather than a darker version of the same thing.
  density: 0.55,
  weightBias: 0.55,
  glyphScale: 1.6,
  sizeJitter: 0.13,
  // Was 420. Nobody can see a 420-column grid as icons; at that size it is a
  // halftone of something, and the whole point of the tool is that the marks
  // are legible one by one. 150 across the long edge is the coarsest setting
  // that still resolves a face, and the slider goes up from there.
  cols: 150,
  width: 6000,
  gutter: 1.0,
  gamma: 0.85,
  contrast: 1.0,
  floor: 0.06,
  vary: 0.05,
  valnoise: 0.0,
  seed: 7,
  knockout: false,
  figureBox: null,
}

/** Source pixels reduced to the three maps the mosaic actually decides from. */
export interface DensityMaps {
  width: number
  height: number
  /** 0-1, how much ink this pixel wants */
  ink: Float32Array
  /** red minus blue, the warm/cool split */
  warmth: Float32Array
  /** the source colour, kept to mix a little realism back into the ramp */
  rgb: Float32Array
}

/** RGBA bytes from a canvas to the maps. Matches the prototype's constants:
 *  Rec.709 luma, a 0.015 black point, and a 0.60 divisor that lets mid greys
 *  reach full ink well before true black. */
export function toDensityMaps(data: Uint8ClampedArray, width: number, height: number): DensityMaps {
  const n = width * height
  const ink = new Float32Array(n)
  const warmth = new Float32Array(n)
  const rgb = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    ink[i] = Math.min(1, Math.max(0, (1 - lum - 0.015) / 0.6))
    warmth[i] = r - b
    rgb[i * 3] = r * 255
    rgb[i * 3 + 1] = g * 255
    rgb[i * 3 + 2] = b * 255
  }
  return { width, height, ink, warmth, rgb }
}

/** Area-average a plane down to rows x cols.
 *
 * Area averaging, not nearest neighbour: each cell has to represent the mean
 * tone of everything under it, or fine detail drops out instead of being
 * absorbed into the cell's density.
 */
export function boxDownsample(
  src: Float32Array, w: number, h: number, rows: number, cols: number,
  stride = 1, offset = 0,
): Float32Array {
  const out = new Float32Array(rows * cols)
  const ys = new Int32Array(rows + 1)
  const xs = new Int32Array(cols + 1)
  for (let j = 0; j <= rows; j++) ys[j] = Math.floor((j * h) / rows)
  for (let i = 0; i <= cols; i++) xs[i] = Math.floor((i * w) / cols)
  for (let j = 0; j < rows; j++) {
    const y0 = ys[j]
    const y1 = Math.max(ys[j + 1], y0 + 1)
    for (let i = 0; i < cols; i++) {
      const x0 = xs[i]
      const x1 = Math.max(xs[i + 1], x0 + 1)
      let sum = 0
      for (let y = y0; y < y1; y++) {
        const base = y * w
        for (let x = x0; x < x1; x++) sum += src[(base + x) * stride + offset]
      }
      out[j * cols + i] = sum / ((y1 - y0) * (x1 - x0))
    }
  }
  return out
}

type Ladder = Array<{ cov: number; name: string | null }>

/** Available coverage levels for a zone, ascending, with empty as level 0. */
function buildLadder(
  set: GlyphSet, motifs: string[], covs: Record<string, number>, knockout: boolean,
): Ladder {
  let names = [...expand(set, motifs), ...set.small.filter((m) => set.glyphs[m])]
  // Knockout tiles are the only way a non-overlapping grid reaches near-black,
  // but they read as stickers rather than as marks, so they stay off by default.
  if (!knockout) names = names.filter((n) => !n.endsWith('_rev'))
  names = [...new Set(names)].sort((a, b) => covs[a] - covs[b])
  return [{ cov: 0, name: null }, ...names.map((n) => ({ cov: covs[n], name: n }))]
}

export function buildMosaic(
  maps: DensityMaps, pack: GlyphPack, palette: Palette, opts: MosaicOptions,
): MosaicResult {
  const set = pack.set
  const { width: sw, height: sh } = maps
  const outW = opts.width
  const outH = Math.round((outW * sh) / sw)
  const cols = Math.max(1, Math.round(opts.cols))
  const cell = outW / cols
  const rows = Math.max(1, Math.round(outH / cell))

  // A figure mask at source resolution, so it downsamples with everything else
  // and its edge lands on cell boundaries the same way the image does.
  const fmask = new Float32Array(sw * sh)
  if (opts.figureBox) {
    const [bx0, by0, bx1, by1] = opts.figureBox
    const x0 = Math.max(0, Math.min(sw, Math.round(bx0)))
    const x1 = Math.max(0, Math.min(sw, Math.round(bx1)))
    const y0 = Math.max(0, Math.min(sh, Math.round(by0)))
    const y1 = Math.max(0, Math.min(sh, Math.round(by1)))
    for (let y = y0; y < y1; y++) fmask.fill(1, y * sw + x0, y * sw + x1)
  }

  // Everything drops to cell resolution before any decision is made.
  const inkC = boxDownsample(maps.ink, sw, sh, rows, cols)
  const warmC = boxDownsample(maps.warmth, sw, sh, rows, cols)
  const figC = boxDownsample(fmask, sw, sh, rows, cols)
  const srcR = boxDownsample(maps.rgb, sw, sh, rows, cols, 3, 0)
  const srcG = boxDownsample(maps.rgb, sw, sh, rows, cols, 3, 1)
  const srcB = boxDownsample(maps.rgb, sw, sh, rows, cols, 3, 2)

  const covs = pack.coverages
  const ladders: Ladder[] = ZONE_IDS.map((z) =>
    buildLadder(set, pack.zones[z], covs, opts.knockout))
  // Per zone, not global. Zones have different heaviest glyphs, and scaling
  // every zone by the darkest one available anywhere makes the lighter-topped
  // zones saturate and lose all internal tone.
  const zoneMax = ladders.map((l) => Math.max(...l.map((s) => s.cov)))

  const n = rows * cols
  const zoneC = new Uint8Array(n)
  for (let i = 0; i < n; i++) zoneC[i] = figC[i] > 0.5 ? 2 : warmC[i] > 0.012 ? 1 : 0

  const random = mulberry32(opts.seed)

  // Target ink coverage per cell, then error-diffuse onto the real ladder.
  const err = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, Math.pow(inkC[i], opts.gamma) * opts.contrast))
    err[i] = t * zoneMax[zoneC[i]]
  }

  const chosen: Array<string | null> = new Array(n).fill(null)

  for (let j = 0; j < rows; j++) {
    const fwd = j % 2 === 0 ? 1 : -1
    const start = j % 2 === 0 ? 0 : cols - 1
    for (let k = 0; k < cols; k++) {
      const i = start + k * fwd
      const idx = j * cols + i

      // Deadzone. Below the floor the page stays blank and the error is
      // dropped rather than diffused, otherwise the residual wanders off into
      // the empty background and speckles it with stray icons.
      if (inkC[idx] < opts.floor) {
        chosen[idx] = null
        err[idx] = 0
        continue
      }

      const want = err[idx]
      const lad = ladders[zoneC[idx]]
      let best = Infinity
      for (const step of lad) {
        const e = Math.abs(want - step.cov)
        if (e < best) best = e
      }
      // Any glyph within tol of the best is tonally interchangeable, so pick
      // among them at random. Without this a large flat area resolves to one
      // repeated glyph and reads as a texture rather than as a vocabulary.
      const near: number[] = []
      for (let s = 0; s < lad.length; s++) {
        if (Math.abs(want - lad[s].cov) <= best + opts.vary) near.push(s)
      }
      const pick = near.length > 1 ? near[randInt(random, near.length)] : near[0]
      const step = lad[pick]
      chosen[idx] = step.name
      const e = want - step.cov

      // Floyd-Steinberg weights, mirrored on the return leg.
      if (i + fwd >= 0 && i + fwd < cols) err[idx + fwd] += (e * 7) / 16
      if (j + 1 < rows) {
        const below = idx + cols
        if (i - fwd >= 0 && i - fwd < cols) err[below - fwd] += (e * 3) / 16
        err[below] += (e * 5) / 16
        if (i + fwd >= 0 && i + fwd < cols) err[below + fwd] += (e * 1) / 16
      }
    }
  }

  const size = cell * opts.gutter
  const off = (cell - size) / 2
  const scale = size / set.grid

  const placements: Placement[] = []
  const used = new Set<string>()
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i
      const name = chosen[idx]
      if (!name) continue
      used.add(name)
      const [pale, deep] = palette.ramps[ZONE_IDS[zoneC[idx]] as ZoneId]

      // Per-cell value jitter. Reference mosaics vary a lot from one cell to
      // the next, and that scatter is what makes them sparkle; a smooth ramp
      // reads as a flat wash instead.
      let t = Math.min(1, Math.max(0, Math.pow(inkC[idx] * 1.35, 0.6)))
      if (opts.valnoise) {
        t += (random() - 0.5) * 2 * opts.valnoise * (0.35 + 0.65 * t)
        t = Math.min(1, Math.max(0, t))
      }
      const mix = (p: number, d: number, s: number) =>
        Math.round(Math.min(255, Math.max(0, (p + (d - p) * t) * 0.88 + s * 0.12)))

      placements.push({
        glyph: name,
        char: pack.chars?.[name],
        x: i * cell + off,
        y: j * cell + off,
        scale,
        r: mix(pale[0], deep[0], srcR[idx]),
        g: mix(pale[1], deep[1], srcG[idx]),
        b: mix(pale[2], deep[2], srcB[idx]),
      })
    }
  }

  return {
    placements, used, width: outW, height: outH,
    rows, cols, cell, filled: placements.length, total: n,
  }
}
