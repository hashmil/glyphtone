/** Rasterise characters from a self-hosted font into a glyph pack.
 *
 * Replaces tools/make-ascii-pack.py, which rasterised from Menlo: a macOS
 * system font, so the pack depended on the machine that happened to build it
 * and could not be reproduced anywhere else.
 *
 * The font now comes from a Fontsource package in node_modules, which is a
 * Google Fonts release under the OFL, pinned in package.json. Rasterising here
 * rather than shipping a webfont is a deliberate trade:
 *
 *   - the app loads no font at runtime for these packs, so nothing depends on
 *     a network request or on a FOUT
 *   - SVG export stays vector paths, which is what Illustrator wants; a <text>
 *     export would need the font on the recipient's machine
 *   - a glyph with no outline in the shipped subset is caught here, at build
 *     time, instead of appearing as an empty box in someone's poster
 *
 * Chrome does the rasterising, via Playwright, because it is the same shaper
 * the browser will use and it is already a dev dependency of this repo's
 * screenshot pass. It is not a runtime dependency of the app.
 *
 * Usage:
 *   node tools/make-font-pack.mjs --font <path-to-woff2> --out <json> \
 *        --chars <literal string> | --range <hex>-<hex> [--grid 16]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)


function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const fontPath = arg('font')
const outPath = arg('out')
const grid = Number(arg('grid', 16))
const family = arg('family', 'PackFont')
const literal = arg('chars')
const range = arg('range')
const label = arg('label', family)

if (!fontPath || !outPath) {
  console.error('need --font and --out')
  process.exit(1)
}

let chars = []
if (literal) chars = [...literal]
else if (range) {
  const [a, b] = range.split('-').map((h) => parseInt(h, 16))
  for (let c = a; c <= b; c++) chars.push(String.fromCodePoint(c))
} else {
  console.error('need --chars or --range')
  process.exit(1)
}

/** Fontsource ships the unicode-range of every subset. Checking against it is
 *  not optional politeness: Chrome silently falls back to a system font for a
 *  codepoint the pack font does not cover, and on macOS that fallback has most
 *  of the symbol blocks, so the rasteriser happily produces a pack of glyphs
 *  from a font that will not be shipped. This is how the box-drawing block was
 *  caught: it rendered perfectly and none of it was Noto. */
const unicodePath = arg('unicode')
const subset = arg('subset')
if (unicodePath && subset) {
  const ranges = String(require(unicodePath)[subset] ?? '')
    .split(',')
    .map((r) => r.replace('U+', '').split('-').map((h) => parseInt(h, 16)))
    .map(([a, b]) => [a, b ?? a])
  if (!ranges.length) {
    console.error(`subset ${subset} not found in ${unicodePath}`)
    process.exit(1)
  }
  const covered = (cp) => ranges.some(([a, b]) => cp >= a && cp <= b)
  const before = chars.length
  const missing = chars.filter((c) => !covered(c.codePointAt(0)))
  chars = chars.filter((c) => covered(c.codePointAt(0)))
  if (missing.length) {
    console.log(
      `  ${missing.length} of ${before} codepoints are outside the ${subset} ` +
      `subset and would have come from a fallback font. Skipped.`,
    )
  }
  if (!chars.length) {
    console.error(`nothing in that range is covered by the ${subset} subset`)
    process.exit(1)
  }
}

const mime = fontPath.endsWith('.woff2') ? 'font/woff2' : 'font/woff'
const dataUrl = `data:${mime};base64,${readFileSync(fontPath).toString('base64')}`

// Playwright resolved the same way the screenshot pass resolves it: from the
// globally installed CLI, so it never becomes a dependency of this project.
const playwrightPath = arg(
  'playwright',
  '/Users/hasmilha/.nvm/versions/node/v24.18.0/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs',
)
const { chromium } = await import(playwrightPath)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.setContent('<body style="margin:0"></body>')

const measured = await page.evaluate(
  async ({ dataUrl, chars, grid, aspect, threshold }) => {
    const face = new FontFace('PackFont', `url(${dataUrl})`)
    await face.load()
    document.fonts.add(face)
    await document.fonts.ready

    // Rasterise at 8x the target grid then box-average down. Thresholding a
    // 16 px render directly loses every thin stroke, which is exactly the
    // distinction between i, l and 1 that the face was chosen for.
    const SS = 8
    // A terminal cell is about half as wide as it is tall and ASCII art is
    // composed for that, so the characters are rendered into that aspect and
    // stretched to square, which is what a terminal does visually. Rendering
    // into a square cell instead surrounds every character with dead space and
    // caps the pack's darkest coverage near 0.15, which makes the whole mosaic
    // read grey however the sliders are set. Symbol packs pass aspect 1.
    const cellH = grid * SS
    const cellW = Math.round(cellH * aspect)

    const canvas = document.createElement('canvas')
    canvas.width = cellW
    canvas.height = cellH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Pass one: find the size at which the widest and tallest glyph in the set
    // just fit the cell. One factor for the whole pack, so relative weights
    // survive; fitting each glyph to the cell individually would make a full
    // stop as dark as an @ and destroy the ladder the engine runs on.
    const REF = 100
    ctx.font = `${REF}px PackFont`
    let maxW = 1
    let maxH = 1
    const boxes = new Map()
    for (const ch of chars) {
      const m = ctx.measureText(ch)
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      boxes.set(ch, m)
      if (w > maxW) maxW = w
      if (h > maxH) maxH = h
    }
    const size = Math.max(
      4,
      Math.floor(REF * Math.min((cellW * 0.98) / maxW, (cellH * 0.98) / maxH)),
    )
    ctx.font = `${size}px PackFont`

    const out = []
    for (const ch of chars) {
      ctx.clearRect(0, 0, cellW, cellH)
      ctx.fillStyle = '#000'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      // Centre on the character's own ink box rather than its advance width,
      // so a comma and a hash both sit in the middle of the cell.
      const m = ctx.measureText(ch)
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      ctx.fillText(
        ch,
        (cellW - w) / 2 + m.actualBoundingBoxLeft,
        (cellH - h) / 2 + m.actualBoundingBoxAscent,
      )

      const px = ctx.getImageData(0, 0, cellW, cellH).data
      const sw = cellW / grid
      const sh = cellH / grid
      const rows = []
      let ink = 0
      for (let y = 0; y < grid; y++) {
        let row = ''
        for (let x = 0; x < grid; x++) {
          let sum = 0
          let n = 0
          for (let sy = Math.floor(y * sh); sy < Math.floor((y + 1) * sh); sy++) {
            for (let sx = Math.floor(x * sw); sx < Math.floor((x + 1) * sw); sx++) {
              sum += px[(sy * cellW + sx) * 4 + 3]
              n++
            }
          }
          const cov = n ? sum / (n * 255) : 0
          // A low threshold on purpose: these are thin shapes and the aim is
          // to keep them present in the ladder, not to render them faithfully.
          const on = cov >= threshold
          if (on) ink++
          row += on ? '#' : '.'
        }
        rows.push(row)
      }
      out.push({ ch, rows, coverage: ink / (grid * grid) })
    }
    return out
  },
  {
    dataUrl, chars, grid,
    aspect: Number(arg('aspect', 0.5)),
    threshold: Number(arg('threshold', 0.376)),
  },
)

await browser.close()

// An empty grid means the shipped subset has no outline for that codepoint and
// the browser drew nothing, or drew a fallback box. Either way it is not a
// glyph, and shipping it would put a hole or a box in the mosaic.
const empty = measured.filter((m) => m.coverage === 0)
const solidBox = measured.filter((m) => m.coverage > 0.86)
const kept = measured.filter((m) => m.coverage > 0 && m.coverage <= 0.86)

const glyphs = {}
const charmap = {}
const names = []
for (const m of kept) {
  const name = `c${m.ch.codePointAt(0).toString(16)}`
  glyphs[name] = m.rows
  charmap[name] = m.ch
  names.push(name)
}

const pack = {
  font: label,
  source: fontPath.replace(/^.*node_modules\//, 'node_modules/'),
  grid,
  glyphs,
  chars: charmap,
  families: { [arg('key', 'glyphs')]: names },
  small: [],
}

writeFileSync(outPath, JSON.stringify(pack))

console.log(`${outPath}: kept ${kept.length} of ${measured.length}`)
if (empty.length) {
  console.log(`  dropped ${empty.length} with no glyph in this subset: ` +
    empty.map((m) => 'U+' + m.ch.codePointAt(0).toString(16).toUpperCase()).join(' '))
}
if (solidBox.length) {
  console.log(`  dropped ${solidBox.length} that rasterised as a solid block: ` +
    solidBox.map((m) => 'U+' + m.ch.codePointAt(0).toString(16).toUpperCase()).join(' '))
}
