/** Getting pixels in and out of the browser, kept away from the engine so the
 *  engine stays testable in Node. */

/** Source resolution is capped before anything else touches it. The mosaic
 *  area-averages down to a few hundred cells regardless, so pixels beyond this
 *  cost time and buy nothing. Large enough that fine structure still survives
 *  the downsample. */
export const MAX_SOURCE_EDGE = 2000

export interface SourcePixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

function drawToCanvas(img: CanvasImageSource, w: number, h: number): SourcePixels {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser')
  // White rather than transparent: a PNG with alpha would otherwise read as
  // fully dark once the alpha channel is discarded, and fill every cell.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  return { data, width: w, height: h }
}

export async function decodeImage(blob: Blob): Promise<SourcePixels> {
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    return drawToCanvas(bitmap, w, h)
  } finally {
    bitmap.close()
  }
}

/** Rough test for whether an image is a photograph or already high-key artwork.
 *
 * A photo carries tone nearly everywhere; artwork built for this is a white
 * page with ink only where there is structure. Feeding a photo straight in
 * fills every cell and reads as a slab, so this decides whether to suggest the
 * prep step rather than letting the user find out from a bad result.
 */
export const loadImageFile = (file: File): Promise<SourcePixels> => decodeImage(file)

export function looksLikePhoto(px: SourcePixels): boolean {
  const { data, width, height } = px
  const n = width * height
  const step = Math.max(1, Math.floor(n / 20000))
  let near = 0
  let seen = 0
  for (let i = 0; i < n; i += step) {
    const lum =
      0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]
    if (lum > 242) near++
    seen++
  }
  // Under a fifth of the frame being near-white means there is no page showing
  // through, which is what separates a photograph from high-key artwork.
  return near / seen < 0.2
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type)
  })
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
