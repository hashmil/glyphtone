/** Convert a photograph into a density map the mosaic can use.
 *
 * A photo and high-key artwork have completely different tonal distributions.
 * Artwork built for this is a white page with ink only where there is
 * structure. A photo has tone everywhere, so feeding one in straight fills
 * every cell and the result is a solid slab with no white space and no drama.
 *
 * Two things have to happen:
 *
 *   Flat-field the broad tone. Dividing out a heavily blurred copy removes the
 *   slow gradients (evenly lit ground, a graduated sky) while keeping local
 *   texture (a ridge line, the edge of a building). Same trick as background
 *   subtraction in microscopy. Without it a large even area reads as one flat
 *   mass, because it is one flat mass.
 *
 *   Keep genuine darkness separately. Flat-fielding alone would erase the
 *   subject, since a large dark shape is low frequency too. So real darkness
 *   is measured against an absolute threshold and added back on top.
 *
 * A faithful port of the Python prototype's prep.py.
 */

export interface PrepOptions {
  /** lower keeps more local texture */
  detail: number
  /** luminance below which something counts as genuinely dark and survives
   *  the flat-field regardless */
  dark: number
  darkGain: number
  /** flat-field blur radius as a fraction of the long edge */
  radius: number
  /** red-minus-blue above which a pixel counts as warm */
  warmSplit: number
  saturation: number
}

export const DEFAULT_PREP: PrepOptions = {
  detail: 0.55,
  dark: 0.62,
  darkGain: 1.35,
  radius: 0.03,
  warmSplit: 0.02,
  saturation: 1.0,
}

/** Colours the artwork gets pushed towards. Anything genuinely dark goes to
 *  DEEP whatever its hue: keying on hue alone makes a dark subject sit
 *  warm-on-warm against warm ground and disappear, which is the one thing a
 *  composition cannot afford. */
const COOL = [70, 92, 170] as const
const WARM = [196, 148, 58] as const
const DEEP = [18, 26, 82] as const

/** Separable box blur, three passes, which converges close enough to a
 *  Gaussian for a flat-field and costs the same whatever the radius. The
 *  radius that makes three boxes match a Gaussian of this sigma is
 *  (sqrt(4*sigma^2 + 1) - 1) / 2. */
function blurLuma(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2))
  const a = Float32Array.from(src)
  const b = new Float32Array(w * h)
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(a, b, w, h, r)
    boxBlurV(b, a, w, h, r)
  }
  return a
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const norm = 1 / (r + r + 1)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = src[row] * (r + 1)
    for (let x = 0; x < r; x++) sum += src[row + Math.min(x, w - 1)]
    for (let x = 0; x < w; x++) {
      sum += src[row + Math.min(x + r, w - 1)] - src[row + Math.max(x - r, 0)]
      dst[row + x] = sum * norm
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const norm = 1 / (r + r + 1)
  for (let x = 0; x < w; x++) {
    let sum = src[x] * (r + 1)
    for (let y = 0; y < r; y++) sum += src[Math.min(y, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      sum += src[Math.min(y + r, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x]
      dst[y * w + x] = sum * norm
    }
  }
}

export interface PrepResult {
  data: Uint8ClampedArray
  /** mean ink and the fraction of pixels above the floor. The prototype's two
   *  diagnostics: a photo straight in reads about 84% covered, prepped about
   *  57%, and that gap is the whole difference between a slab and an image. */
  meanInk: number
  coverage: number
}

export function prepPhoto(
  data: Uint8ClampedArray, w: number, h: number, o: PrepOptions = DEFAULT_PREP,
): PrepResult {
  const n = w * h
  const lum = new Float32Array(n)
  const warmth = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    warmth[i] = r - b
  }

  // Radius large enough to be "the lighting" and not "the subject".
  const sigma = Math.max(2, o.radius * Math.max(w, h))
  const blur = blurLuma(lum, w, h, sigma)

  const out = new Uint8ClampedArray(n * 4)
  let inkSum = 0
  let above = 0
  const invDetail = 1 / Math.max(o.detail, 1e-3)
  const invDark = 1 / Math.max(o.dark, 1e-3)

  for (let i = 0; i < n; i++) {
    // Local texture: positive where the pixel is darker than its surroundings.
    const local = Math.min(1, Math.max(0, (blur[i] - lum[i]) * invDetail))
    // Absolute darkness, so large dark shapes survive the flat-field.
    const deep = Math.min(1, Math.max(0, (o.dark - lum[i]) * invDark)) * o.darkGain
    const ink = Math.min(1, Math.max(0, local * 0.85 + deep))

    inkSum += ink
    if (ink > 0.06) above++

    // Hue rebuilt rather than sampled, so the warm/cool split stays clean
    // after flat-fielding has scrambled the original tone.
    const base = warmth[i] > o.warmSplit ? WARM : COOL
    const pull = Math.pow(Math.min(1, Math.max(0, (ink - 0.55) / 0.45)), 1.2)

    let tr = base[0] * (1 - pull) + DEEP[0] * pull
    let tg = base[1] * (1 - pull) + DEEP[1] * pull
    let tb = base[2] * (1 - pull) + DEEP[2] * pull

    if (o.saturation !== 1) {
      const grey = (tr + tg + tb) / 3
      tr = grey + (tr - grey) * o.saturation
      tg = grey + (tg - grey) * o.saturation
      tb = grey + (tb - grey) * o.saturation
    }

    out[i * 4] = 255 - (255 - tr) * ink
    out[i * 4 + 1] = 255 - (255 - tg) * ink
    out[i * 4 + 2] = 255 - (255 - tb) * ink
    out[i * 4 + 3] = 255
  }

  return { data: out, meanInk: inkSum / n, coverage: above / n }
}
