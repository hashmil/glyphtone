/** Themed motif sets, drawn in code.
 *
 * The original motif pack is a hand-drawn Gulf vocabulary: dallah, dhow,
 * barjeel, oryx. These are the same idea with other subjects. Each motif is a
 * filled silhouette described with a handful of primitives, sampled onto the
 * 16 px grid the original motifs use, and given thin, bold and solid weights by
 * the same outline derivation as the geometric pack, so a theme behaves in the
 * engine exactly like the hand-drawn set.
 *
 * Silhouettes rather than line drawings because the weights are derived from
 * them: the thin weight is the silhouette's one-pixel edge, and at 16 px an
 * interior line would only muddy that edge.
 *
 * Coordinates run 0 to 16 across and down, one unit per output pixel.
 */
import type { GlyphSet, Grid } from './types'
import type { ZoneId } from './palettes'

type Shape = (x: number, y: number) => boolean

const circle = (cx: number, cy: number, r: number): Shape =>
  (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

const ellipse = (cx: number, cy: number, rx: number, ry: number, deg = 0): Shape => {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return (x, y) => {
    const dx = x - cx
    const dy = y - cy
    const u = dx * c + dy * s
    const v = -dx * s + dy * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1
  }
}

const rect = (x0: number, y0: number, x1: number, y1: number): Shape =>
  (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1

/** Even-odd point in polygon. */
const poly = (pts: Array<[number, number]>): Shape => (x, y) => {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** A stroke with round ends, `w` wide. */
const seg = (x0: number, y0: number, x1: number, y1: number, w: number): Shape => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2))
    return (x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2 <= (w / 2) ** 2
  }
}

const union = (...s: Shape[]): Shape => (x, y) => s.some((f) => f(x, y))
const minus = (a: Shape, ...b: Shape[]): Shape => (x, y) => a(x, y) && !b.some((f) => f(x, y))
const within = (a: Shape, ...b: Shape[]): Shape => (x, y) => a(x, y) && b.every((f) => f(x, y))

/** An n-pointed star centred on (cx, cy). */
const star = (cx: number, cy: number, n: number, outer: number, inner: number, deg = -90): Shape => {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = ((deg + (i * 180) / n) * Math.PI) / 180
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return poly(pts)
}

/** A smooth stroke through a quadratic curve from a to b bent towards c. */
const curve = (
  a: [number, number], c: [number, number], b: [number, number], w: number, steps = 8,
): Shape => {
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return union(...pts.slice(1).map((p, i) => seg(pts[i][0], pts[i][1], p[0], p[1], w)))
}

// --- the themes ---------------------------------------------------------------

/** The Gulf set. Redrawn from the original hand-drawn pack, whose vocabulary
 *  this keeps (dallah, dhow, palm, camel, minaret) and extends with the finjan,
 *  the mabkhara, the lantern and the mashrabiya arch. */
const GULF: Record<string, Shape> = {
  dallah: union(
    ellipse(8.8, 11.6, 4, 3.4),
    poly([[7.2, 8], [10.4, 8], [11.2, 10.4], [6.4, 10.4]]),
    poly([[6.8, 4.4], [10.8, 4.4], [10, 8.2], [7.6, 8.2]]),
    ellipse(8.8, 4.2, 2.8, 0.9),
    seg(8.8, 3.4, 8.8, 1.6, 0.9),
    circle(8.8, 1.3, 0.9),
    curve([6, 10.6], [3.4, 8.6], [0.6, 3.4], 1.2),
    within(minus(ellipse(12.4, 8.4, 2.6, 3.8), ellipse(12.4, 8.4, 1.3, 2.5)), rect(11, 0, 16, 16)),
    rect(5.8, 14.6, 11.8, 15.7),
  ),
  finjan: union(
    poly([[3.4, 8.4], [12.6, 8.4], [11.2, 13.6], [4.8, 13.6]]),
    rect(2, 13.8, 14, 15.2),
    curve([6, 7.2], [4.6, 5], [6.4, 2.8], 1.1),
    curve([9.6, 7.2], [8.2, 4.6], [10, 1.6], 1.1),
  ),
  mabkhara: union(
    poly([[2.6, 5.2], [13.4, 5.2], [11.6, 8.6], [4.4, 8.6]]),
    rect(6.4, 8.4, 9.6, 11.2),
    poly([[4.2, 11], [11.8, 11], [13, 15.6], [3, 15.6]]),
    curve([8, 4.8], [6.4, 3], [8.6, 0.4], 1.1),
  ),
  palm: union(
    curve([7.4, 15.8], [9.4, 11], [8.6, 5.6], 1.9),
    curve([8.6, 5.4], [4.4, 2.8], [0.6, 7.8], 1.4),
    curve([8.6, 5.4], [12.8, 2.8], [15.4, 7.8], 1.4),
    curve([8.6, 5.2], [5.6, 0.6], [2.4, 1.6], 1.3),
    curve([8.6, 5.2], [11.6, 0.6], [14.6, 1.8], 1.3),
    curve([8.6, 5.4], [8, 2.2], [8.8, 0.2], 1.2),
    circle(7.6, 7.2, 1.3), circle(9.8, 7.2, 1.1),
  ),
  dhow: union(
    poly([[0.4, 9.6], [2.4, 11], [15.6, 10.2], [13.2, 14.4], [3.6, 14.4]]),
    seg(9.2, 2, 9.2, 10.6, 1),
    seg(1.4, 5.6, 14.8, 0.6, 0.9),
    poly([[1.8, 5.6], [14.2, 1], [11, 9.6], [4.6, 9.2]]),
  ),
  camel: union(
    ellipse(8.8, 8.8, 4.8, 2.6),
    ellipse(9.2, 6.6, 2.8, 2.4),
    seg(4.6, 8.4, 2.6, 4.2, 2),
    ellipse(2, 3.8, 1.9, 1.15, -18),
    seg(5.8, 10, 5.4, 15.5, 1.15),
    seg(7.2, 10.6, 7.4, 15.5, 1.15),
    seg(10.6, 10.6, 10.4, 15.5, 1.15),
    seg(12.4, 10, 12.8, 15.5, 1.15),
    seg(13.4, 8, 14.4, 11.2, 0.8),
  ),
  oryx: union(
    poly([[6.2, 6], [9.8, 6], [9.2, 13], [8, 15.2], [6.8, 13]]),
    ellipse(4.6, 7, 1.9, 0.85, 22),
    ellipse(11.4, 7, 1.9, 0.85, -22),
    seg(7, 6.4, 4.8, 0.4, 1.1),
    seg(9, 6.4, 11.2, 0.4, 1.1),
  ),
  falcon: union(
    ellipse(8, 8.8, 1.9, 4),
    circle(8, 4.4, 1.8),
    poly([[7.2, 7.2], [0.4, 3.6], [1.4, 6], [0.4, 7.2], [2.2, 8.6], [1.4, 9.6], [7.2, 10.6]]),
    poly([[8.8, 7.2], [15.6, 3.6], [14.6, 6], [15.6, 7.2], [13.8, 8.6], [14.6, 9.6], [8.8, 10.6]]),
    poly([[6.6, 11.6], [9.4, 11.6], [10.4, 15.6], [5.6, 15.6]]),
  ),
  tent: union(
    minus(
      poly([[0.4, 13.8], [2, 8.4], [5, 6.6], [8, 4], [11, 6.6], [14, 8.4], [15.6, 13.8]]),
      poly([[6.2, 13.8], [8, 8.2], [9.8, 13.8]]),
    ),
    rect(0, 13.8, 16, 15),
  ),
  dunes: union(
    within(circle(4.6, 17.6, 8.6), rect(0, 0, 16, 15.6)),
    within(circle(13, 18.6, 7.4), rect(0, 0, 16, 15.6)),
    circle(12.4, 4.2, 2.6),
  ),
  barjeel: minus(
    union(
      rect(4.6, 4.4, 11.4, 15.6),
      rect(3.4, 2.4, 12.6, 4.8),
      rect(3.4, 0.6, 5.2, 2.6), rect(7.1, 0.6, 8.9, 2.6), rect(10.8, 0.6, 12.6, 2.6),
    ),
    rect(5.8, 5.6, 6.8, 10), rect(7.5, 5.6, 8.5, 10), rect(9.2, 5.6, 10.2, 10),
    union(rect(6.8, 12.4, 9.2, 15.6), circle(8, 12.4, 1.2)),
  ),
  minaret: union(
    rect(6.4, 5, 9.6, 15.6),
    rect(4.8, 12.8, 11.2, 15.6),
    rect(5, 6.4, 11, 7.6),
    rect(6.8, 3, 9.2, 6.4),
    poly([[6.4, 3.2], [9.6, 3.2], [8, 0.4]]),
  ),
  dome: minus(
    union(
      within(ellipse(8, 7.6, 5.8, 4.8), rect(0, 0, 16, 9.2)),
      poly([[8, 0.2], [6.2, 3.8], [9.8, 3.8]]),
      rect(3.2, 9, 12.8, 11.2),
      rect(1.6, 11, 14.4, 15.6),
    ),
    union(rect(6.6, 12.6, 9.4, 15.6), circle(8, 12.6, 1.4)),
  ),
  fort: minus(
    union(
      rect(2.6, 5, 13.4, 15.6),
      rect(2.6, 2.6, 4.6, 5.2), rect(5.8, 2.6, 7.8, 5.2), rect(9, 2.6, 11, 5.2), rect(12.2, 2.6, 13.4, 5.2),
    ),
    union(rect(6.6, 11, 9.4, 15.6), circle(8, 11, 1.4)),
    rect(4.4, 7, 5.4, 8.8), rect(10.6, 7, 11.6, 8.8),
  ),
  arch: minus(
    union(within(circle(11, 9, 9), circle(5, 9, 9), rect(0, 0, 16, 9.2)), rect(2, 9, 14, 15.6)),
    ...[4.4, 7.2, 10].flatMap((y) => [4.2, 7, 9.8].map((x) => rect(x, y + 1, x + 2, y + 3))),
  ),
  lantern: minus(
    union(
      minus(circle(8, 1.6, 1.3), circle(8, 1.6, 0.5)),
      poly([[4.4, 4.4], [11.6, 4.4], [8, 2]]),
      poly([[4.2, 4.4], [11.8, 4.4], [12.8, 8.6], [11.2, 12.8], [4.8, 12.8], [3.2, 8.6]]),
      rect(5.6, 12.8, 10.4, 14.4),
      poly([[4.8, 14.4], [11.2, 14.4], [10.6, 15.7], [5.4, 15.7]]),
    ),
    poly([[6.8, 6], [9.2, 6], [9.8, 8.6], [9.2, 11.2], [6.8, 11.2], [6.2, 8.6]]),
  ),
  crescent: union(
    minus(circle(7, 8, 7), circle(9.8, 6.6, 5.9)),
    star(12.8, 7.6, 5, 2.9, 1.2),
  ),
  rosette: minus(
    union(rect(2.4, 2.4, 13.6, 13.6), poly([[8, 0.1], [15.9, 8], [8, 15.9], [0.1, 8]])),
    circle(8, 8, 2.2),
  ),
}

const SKY: Record<string, Shape> = {
  star: star(8, 8.6, 5, 7.6, 3.1),
  moon: minus(circle(8, 8, 7), circle(11.4, 5.6, 5.8)),
  sun: union(
    circle(8, 8, 3.6),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      return seg(8 + 5.1 * Math.cos(a), 8 + 5.1 * Math.sin(a),
        8 + 7.3 * Math.cos(a), 8 + 7.3 * Math.sin(a), 1.7)
    }),
  ),
  planet: union(
    circle(8, 8, 5.2),
    minus(ellipse(8, 8, 7.9, 2.3, -24), ellipse(8, 8, 6.3, 1.1, -24)),
  ),
  comet: union(circle(11, 5, 3.2), poly([[8.6, 3], [0.8, 14.8], [13, 7.4]])),
  sparkle: star(8, 8, 4, 7.6, 1.9),
  cloud: within(
    union(circle(4.8, 10, 3.2), circle(8.8, 7.4, 4.4), circle(12.4, 10.2, 3.1), rect(4.8, 9, 12.4, 13.2)),
    rect(0, 0, 16, 13.2),
  ),
  rocket: minus(
    union(
      poly([[8, 0.4], [11.2, 5], [11.2, 11.4], [4.8, 11.4], [4.8, 5]]),
      poly([[4.8, 7.6], [1.6, 13.4], [4.8, 12.2]]),
      poly([[11.2, 7.6], [14.4, 13.4], [11.2, 12.2]]),
      poly([[6.4, 11.4], [9.6, 11.4], [8, 15.6]]),
    ),
    circle(8, 6.2, 1.4),
  ),
}

const GARDEN: Record<string, Shape> = {
  leaf: union(
    within(circle(3.2, 12.8, 11.2), circle(12.8, 3.2, 11.2)),
    seg(1.2, 14.8, 4.4, 11.6, 1.3),
  ),
  flower: union(
    ...Array.from({ length: 5 }, (_, i) => {
      const a = ((i * 72 - 90) * Math.PI) / 180
      return circle(8 + 4.3 * Math.cos(a), 8.2 + 4.3 * Math.sin(a), 3.2)
    }),
    circle(8, 8.2, 2.6),
  ),
  tulip: union(
    poly([[3, 2.4], [5.6, 5.4], [8, 1.6], [10.4, 5.4], [13, 2.4], [12.6, 8.6], [8, 11.2], [3.4, 8.6]]),
    seg(8, 10.6, 8, 15.4, 1.5),
    ellipse(10.8, 13, 3, 1.1, -38),
  ),
  mushroom: union(
    within(ellipse(8, 7.6, 7.6, 6.4), rect(0, 0, 16, 7.8)),
    seg(8, 7.6, 8, 14, 3.8),
    rect(5.4, 13.6, 10.6, 15.2),
  ),
  pine: union(
    poly([[8, 0.4], [12, 5.4], [4, 5.4]]),
    poly([[8, 3], [13.6, 9.4], [2.4, 9.4]]),
    poly([[8, 6.4], [15.2, 13.2], [0.8, 13.2]]),
    rect(6.8, 13, 9.2, 15.6),
  ),
  cactus: union(
    seg(8, 2, 8, 14.8, 3.8),
    seg(3.4, 5, 3.4, 9.2, 2.6), seg(3.4, 9.2, 8, 9.2, 2.6),
    seg(12.6, 3.6, 12.6, 7.4, 2.6), seg(12.6, 7.4, 8, 7.4, 2.6),
    rect(4.4, 14.4, 11.6, 15.6),
  ),
  acorn: union(
    within(ellipse(8, 6.2, 7.2, 3.4), rect(0, 0, 16, 6.6)),
    within(ellipse(8, 8, 4.8, 5.8), rect(0, 6.2, 16, 16)),
    poly([[4, 10.6], [12, 10.6], [8, 15.8]]),
    seg(8, 3, 9.4, 0.6, 1.3),
  ),
  // Leaves angled up and out from the stem. In these coordinates y runs down,
  // so a positive angle tilts a leaf's long axis up towards the left.
  sprout: union(
    ellipse(4.4, 6, 4.2, 2.6, 26),
    ellipse(11.6, 6, 4.2, 2.6, -26),
    seg(8, 7.6, 8, 15.4, 1.7),
    rect(4.4, 14.4, 11.6, 15.6),
  ),
}

const SEASIDE: Record<string, Shape> = {
  fish: minus(
    union(ellipse(6.8, 8, 5.8, 4), poly([[10.8, 8], [15.6, 3.2], [15.6, 12.8]])),
    circle(4, 6.8, 1),
  ),
  anchor: union(
    minus(circle(8, 2.8, 2), circle(8, 2.8, 0.9)),
    seg(8, 4.4, 8, 14.2, 1.7),
    seg(4.4, 6.2, 11.6, 6.2, 1.6),
    within(minus(circle(8, 7.4, 7.2), circle(8, 7.4, 5.5)), rect(0, 9.6, 16, 16)),
    poly([[0.4, 8.8], [3.4, 9.6], [1.6, 11.8]]),
    poly([[15.6, 8.8], [12.6, 9.6], [14.4, 11.8]]),
  ),
  wave: (x, y) => {
    const crest = 7.4 - 3.4 * Math.sin((x / 16) * 2 * Math.PI)
    return y >= crest && y <= crest + 4.2 + (x / 16) * 1.6 && y <= 15.6
  },
  shell: minus(
    union(within(circle(8, 11, 7.4), rect(0, 0, 16, 11)), poly([[4.6, 10.8], [11.4, 10.8], [9.8, 15], [6.2, 15]])),
    ...[-54, -27, 0, 27, 54].map((d) => {
      const a = ((d - 90) * Math.PI) / 180
      return seg(8 + 2.2 * Math.cos(a), 11 + 2.2 * Math.sin(a), 8 + 7.6 * Math.cos(a), 11 + 7.6 * Math.sin(a), 0.7)
    }),
  ),
  boat: union(
    poly([[0.8, 10.8], [15.2, 10.8], [12.6, 14.6], [3.4, 14.6]]),
    seg(8, 1, 8, 11, 1.1),
    poly([[8.8, 1.4], [14, 9.8], [8.8, 9.8]]),
    poly([[7.2, 3.6], [7.2, 9.8], [2.6, 9.8]]),
  ),
  drop: union(circle(8, 10.2, 5.2), poly([[8, 0.4], [3.1, 8.6], [12.9, 8.6]])),
  starfish: star(8, 8.8, 5, 7.9, 3.7),
  lighthouse: minus(
    union(
      poly([[5, 4.4], [11, 4.4], [12.8, 15.6], [3.2, 15.6]]),
      rect(5.8, 1.8, 10.2, 4.4),
      poly([[4.8, 2.2], [8, 0], [11.2, 2.2]]),
    ),
    rect(0, 8.4, 16, 9.8),
    rect(7, 2.4, 9, 3.8),
  ),
}

// --- rasterising --------------------------------------------------------------

/** Output grid. Shapes are authored in 16 units and sampled at 24, which gives
 *  them enough pixels to hold a spout or a horn, and prints cleaner large. */
const N = 24
const U = 16 / N
/** Samples per pixel edge. A pixel is ink when at least half of its samples
 *  are, which rounds a curve to its nearest pixel instead of always outward. */
const SS = 4

function raster(shape: Shape): boolean[][] {
  const m: boolean[][] = []
  for (let py = 0; py < N; py++) {
    const row: boolean[] = []
    for (let px = 0; px < N; px++) {
      let hit = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (shape((px + (sx + 0.5) / SS) * U, (py + (sy + 0.5) / SS) * U)) hit++
        }
      }
      row.push(hit * 2 >= SS * SS)
    }
    m.push(row)
  }
  return m
}

function erode(m: boolean[][]): boolean[][] {
  return m.map((row, y) => row.map((v, x) =>
    v && !!m[y - 1]?.[x] && !!m[y + 1]?.[x] && !!row[x - 1] && !!row[x + 1]))
}

/** The silhouette minus its eroded core: a hairline at depth 1, heavier
 *  outlines deeper in. The same derivation the geometric pack uses. */
function outline(m: boolean[][], depth: number): boolean[][] {
  let core = m
  for (let i = 0; i < depth; i++) core = erode(core)
  return m.map((row, y) => row.map((v, x) => v && !core[y][x]))
}

const toGrid = (m: boolean[][]): Grid => m.map((r) => r.map((v) => (v ? '#' : '.')).join(''))

export interface Theme {
  id: string
  label: string
  hint: string
  set: GlyphSet
  zones: Record<ZoneId, string[]>
}

function theme(
  id: string, label: string, hint: string,
  shapes: Record<string, Shape>,
  small: Record<string, Grid>,
  zones: Record<ZoneId, string[]>,
): Theme {
  const glyphs: Record<string, Grid> = { ...small }
  const families: Record<string, string[]> = {}
  for (const [name, shape] of Object.entries(shapes)) {
    const solid = raster(shape)
    // Four weights rather than the three a 16 px pack gets: at 24 px a
    // two-pixel outline is still light, and the step from it straight to solid
    // would leave a gap in the ladder wide enough to band.
    glyphs[`${name}_thin`] = toGrid(outline(solid, 1))
    glyphs[`${name}_bold`] = toGrid(outline(solid, 2))
    glyphs[`${name}_heavy`] = toGrid(outline(solid, 3))
    glyphs[`${name}_solid`] = toGrid(solid)
    families[name] = [`${name}_thin`, `${name}_bold`, `${name}_heavy`, `${name}_solid`]
  }
  return { id, label, hint, set: { grid: N, glyphs, families, small: Object.keys(small) }, zones }
}

/** Builds the themed sets. `small` is the shared light-end vocabulary (dots,
 *  crosses) every pack needs, passed in so there is one definition of it. */
export function themes(small: Record<string, Grid>): Theme[] {
  return [
    theme('motifs', 'Gulf', 'Dallah, dhow, palm, camel, minaret and mashrabiya.', GULF, small, {
      // Architecture and sky in cool areas, desert and hospitality in warm,
      // and the most recognisable shapes kept for the subject.
      cool: ['minaret', 'dome', 'barjeel', 'fort', 'arch', 'lantern', 'crescent', 'rosette', 'falcon'],
      warm: ['palm', 'camel', 'dhow', 'tent', 'dunes', 'oryx', 'dallah', 'finjan', 'mabkhara'],
      focus: ['dallah', 'falcon', 'rosette', 'lantern', 'oryx', 'palm', 'crescent', 'camel'],
    }),
    theme('sky', 'Night sky', 'Stars, moons, planets and comets.', SKY, small, {
      cool: ['star', 'moon', 'sparkle', 'cloud', 'planet'],
      warm: ['sun', 'comet', 'rocket', 'star'],
      focus: ['planet', 'moon', 'rocket', 'sparkle'],
    }),
    theme('garden', 'Garden', 'Leaves, flowers, sprouts and pines.', GARDEN, small, {
      cool: ['leaf', 'sprout', 'pine', 'cactus'],
      warm: ['flower', 'tulip', 'mushroom', 'acorn'],
      focus: ['flower', 'tulip', 'leaf', 'pine'],
    }),
    theme('seaside', 'Seaside', 'Fish, anchors, shells and boats.', SEASIDE, small, {
      cool: ['wave', 'fish', 'drop', 'anchor'],
      warm: ['shell', 'starfish', 'boat', 'lighthouse'],
      focus: ['fish', 'anchor', 'lighthouse', 'starfish'],
    }),
  ]
}
