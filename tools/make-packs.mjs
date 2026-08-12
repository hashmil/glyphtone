/** Regenerates every font-backed glyph pack. `npm run packs`.
 *
 * One entry point rather than four command lines in a README, because the
 * arguments matter: the ASCII pack is rendered into a terminal-aspect cell and
 * the symbol packs into a square one, and getting that wrong silently caps the
 * pack's darkest coverage and makes the whole mosaic read grey.
 */
import { execFileSync } from 'node:child_process'

const ASCII =
  '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'

const SYMBOLS = 'node_modules/@fontsource/noto-sans-symbols-2'
const PLEX = 'node_modules/@fontsource/ibm-plex-mono'

const JOBS = [
  {
    name: 'ascii',
    args: [
      '--font', `${PLEX}/files/ibm-plex-mono-latin-400-normal.woff2`,
      '--unicode', `${process.cwd()}/${PLEX}/unicode.json`, '--subset', 'latin',
      '--out', 'src/engine/ascii.json',
      '--chars', ASCII, '--key', 'ascii',
      // A terminal cell, which is what ASCII art is composed for.
      '--aspect', '0.5',
      '--label', 'IBM Plex Mono',
    ],
  },
  {
    name: 'dingbats',
    args: [
      '--font', `${SYMBOLS}/files/noto-sans-symbols-2-symbols-400-normal.woff2`,
      '--unicode', `${process.cwd()}/${SYMBOLS}/unicode.json`, '--subset', 'symbols',
      '--out', 'src/engine/dingbats.json',
      '--range', '2600-27bf', '--key', 'dingbats',
      // Symbols are drawn square; stretching them would distort every one.
      '--aspect', '1',
      '--label', 'Noto Sans Symbols 2',
    ],
  },
]

for (const job of JOBS) {
  console.log(`\n== ${job.name} ==`)
  execFileSync('node', ['tools/make-font-pack.mjs', ...job.args], { stdio: 'inherit' })
}

console.log(
  '\nBraille and box drawing are generated in src/engine/packs.ts, not here.\n' +
  'Noto Sans Symbols 2 has no box-drawing block at all, and its braille cells\n' +
  'top out at 0.19 ink coverage, which is too light to reach black.',
)
