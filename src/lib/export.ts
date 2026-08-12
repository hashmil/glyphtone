import { build } from '@/engine/build'
import type { DensityMaps } from '@/engine/mosaic'
import type { GlyphPack } from '@/engine/packs'
import { drawMosaic } from '@/engine/render-canvas'
import { toSVG, MAX_ARTBOARD_PX } from '@/engine/render-svg'
import type { Palette } from '@/engine/palettes'
import type { MosaicOptions } from '@/engine/types'
import { canvasToBlob, download } from './image'
import { gzip, makeZip, type ZipEntry } from './zip'

export type ExportFormat = 'svg' | 'svgz' | 'png'

export interface ExportRequest {
  format: ExportFormat
  /** long edge of the finished piece, in pixels */
  width: number
  /** split into tiles of at most this many pixels on a side; 0 means one file */
  tile: number
  background: string
  basename: string
}

/** Browsers cap canvas area, and Safari's cap is the low one. Past it,
 *  toBlob quietly returns a blank or fails, so PNG requests get checked
 *  against it up front rather than producing an empty file. */
export const MAX_CANVAS_AREA = 16_777_216

export interface ExportPlan {
  outWidth: number
  outHeight: number
  tiles: number
  cols: number
  rows: number
  /** things the user should know before waiting on the render */
  warnings: string[]
  blocked: string | null
}

export function planExport(
  req: ExportRequest, sourceAspect: number,
): ExportPlan {
  const outWidth = Math.round(req.width)
  const outHeight = Math.round(outWidth / sourceAspect)
  const warnings: string[] = []

  let cols = 1
  let rows = 1
  if (req.tile > 0) {
    cols = Math.ceil(outWidth / req.tile)
    rows = Math.ceil(outHeight / req.tile)
  }
  const tiles = cols * rows

  if (tiles === 1 && Math.max(outWidth, outHeight) > MAX_ARTBOARD_PX) {
    warnings.push(
      `Illustrator caps artboards at ${MAX_ARTBOARD_PX.toLocaleString()} px, and this is ` +
      `${Math.max(outWidth, outHeight).toLocaleString()} px. It will open in a browser but ` +
      `not as a single artboard. Turn on tiling to split it.`,
    )
  }

  let blocked: string | null = null
  if (req.format === 'png') {
    const tileW = tiles === 1 ? outWidth : Math.ceil(outWidth / cols)
    const tileH = tiles === 1 ? outHeight : Math.ceil(outHeight / rows)
    if (tileW * tileH > MAX_CANVAS_AREA) {
      blocked =
        `A ${tileW.toLocaleString()} x ${tileH.toLocaleString()} px PNG is past what ` +
        `browsers will rasterise. Reduce the width, turn on tiling, or export SVG, ` +
        `which has no such limit.`
    }
  }

  if (tiles > 40) {
    warnings.push(`${tiles} tiles is a lot of files. Consider larger tiles.`)
  }

  return { outWidth, outHeight, tiles, cols, rows, warnings, blocked }
}

export interface ExportContext {
  maps: DensityMaps
  pack: GlyphPack
  palette: Palette
  options: MosaicOptions
}

/** Renders at full output size and hands back a finished file.
 *
 * The preview and the export share one engine and differ only in width, so
 * what is on screen is what comes out, at whatever resolution was asked for.
 */
export async function runExport(
  req: ExportRequest,
  ctx: ExportContext,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const plan = planExport(req, ctx.maps.width / ctx.maps.height)
  if (plan.blocked) throw new Error(plan.blocked)

  // One build at full size, then tiles are crops of it. Building per tile
  // would re-run the error diffusion per tile and seam the tone at the joins.
  const result = build(ctx.maps, ctx.pack, ctx.palette, {
    ...ctx.options,
    width: plan.outWidth,
  })

  const stamp = `${req.basename}-${plan.outWidth}px`

  if (plan.tiles === 1) {
    onProgress?.(0, 1)
    if (req.format === 'png') {
      download(await renderPNG(result, ctx.pack, req.background), `${stamp}.png`)
    } else {
      const svg = toSVG(result, ctx.pack, { background: req.background })
      if (req.format === 'svgz') download(await gzip(svg), `${stamp}.svgz`)
      else download(new Blob([svg], { type: 'image/svg+xml' }), `${stamp}.svg`)
    }
    onProgress?.(1, 1)
    return
  }

  const tileW = Math.ceil(plan.outWidth / plan.cols)
  const tileH = Math.ceil(plan.outHeight / plan.rows)
  const entries: ZipEntry[] = []
  let done = 0

  for (let ty = 0; ty < plan.rows; ty++) {
    for (let tx = 0; tx < plan.cols; tx++) {
      const x = tx * tileW
      const y = ty * tileH
      const w = Math.min(tileW, plan.outWidth - x)
      const h = Math.min(tileH, plan.outHeight - y)
      const name = `${stamp}-r${ty + 1}c${tx + 1}`

      if (req.format === 'png') {
        const blob = await renderPNG(result, ctx.pack, req.background, [x, y, w, h])
        entries.push({ name: `${name}.png`, data: new Uint8Array(await blob.arrayBuffer()) })
      } else {
        const svg = toSVG(result, ctx.pack, {
          background: req.background,
          crop: [x, y, w, h],
        })
        entries.push({ name: `${name}.svg`, data: svg })
      }

      onProgress?.(++done, plan.tiles)
      // Yield so the progress bar can actually paint between tiles.
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  entries.push({
    name: 'README.txt',
    data:
      `${plan.cols} x ${plan.rows} tiles of a ${plan.outWidth} x ${plan.outHeight} px piece.\n` +
      `Files are named rRcC, row then column, counting from the top left.\n` +
      `Each tile is a crop of one render, so tones line up across the joins.\n`,
  })

  download(await makeZip(entries), `${stamp}-tiles.zip`)
}

async function renderPNG(
  result: Parameters<typeof drawMosaic>[1],
  pack: GlyphPack,
  background: string,
  crop?: [number, number, number, number],
): Promise<Blob> {
  const [cx, cy, cw, ch] = crop ?? [0, 0, result.width, result.height]
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser')
  drawMosaic(ctx, result, pack, {
    background,
    origin: { x: cx, y: cy },
    size: { width: cw, height: ch },
  })
  return canvasToBlob(canvas)
}
