import type { SourcePixels } from './image'

/** A procedural demo image, so the tool has something to show on first load
 *  without shipping a photograph, licensing one, or asking permission to use
 *  anyone's artwork.
 *
 * Deliberately built to exercise every branch of the engine: a cool sky and
 * warm ground either side of the warmth split, a full white-to-dark tonal
 * sweep so the deadzone and the whole ladder are in play, and one dark subject
 * for the focal region to sit on.
 */
/** Cheap deterministic value noise. Without texture at several scales the
 *  sample is a pure mathematical gradient, and the prep step's flat-field
 *  correctly removes all of it, leaving an almost empty page. Real photographs
 *  carry detail at every scale, so the sample has to as well or it
 *  misrepresents what the tool does. */
function noise(x: number, y: number, freq: number): number {
  const s = Math.sin(x * freq * 12.9898 + y * freq * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function texture(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 0.05
  for (let o = 0; o < 4; o++) {
    // Smoothed by sampling on a lattice and blending, so it reads as grain
    // and cloud rather than as per-pixel static.
    const xi = Math.floor(x * freq)
    const yi = Math.floor(y * freq)
    const fx = x * freq - xi
    const fy = y * freq - yi
    const a = noise(xi, yi, 1)
    const b = noise(xi + 1, yi, 1)
    const c = noise(xi, yi + 1, 1)
    const d = noise(xi + 1, yi + 1, 1)
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    sum += amp * ((a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy)
    amp *= 0.5
    freq *= 2.4
  }
  return sum
}

export function makeSample(width = 1400, height = 700): SourcePixels {
  const data = new Uint8ClampedArray(width * height * 4)
  const horizon = height * 0.56

  // Ridge line, a couple of summed sines. Enough shape to read as landscape
  // without pretending to be terrain.
  const ridge = (x: number) => {
    const u = x / width
    return (
      horizon -
      height * 0.10 * Math.sin(u * 2.1 + 0.6) -
      height * 0.05 * Math.sin(u * 5.3 + 2.2) -
      height * 0.02 * Math.sin(u * 11.0 + 1.1)
    )
  }

  const sunX = width * 0.70
  const sunY = horizon - height * 0.30

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let r: number, g: number, b: number
      const tex = texture(x, y) - 0.45

      if (y < ridge(x)) {
        // Sky: pale at the horizon, deepening upward, with a soft glow.
        const t = Math.pow(1 - y / horizon, 1.4)
        const d = Math.hypot(x - sunX, y - sunY) / (width * 0.42)
        const glow = Math.max(0, 1 - d) ** 2.2
        // Cloud, mostly high up where the sky has tone to lose. Tuned to a
        // photograph's range rather than to artwork on white: an evenly light
        // frame gives the prep step's darkness threshold nothing to hold on
        // to, and the result comes out nearly empty.
        const cloud = tex * 54 * (0.25 + t)
        r = 214 - t * 132 + glow * 30 - cloud
        g = 224 - t * 118 + glow * 22 - cloud
        b = 238 - t * 84 + glow * 6 - cloud * 0.7
      } else {
        // Ground: warm, darkening with depth, with banding that gives the
        // downsample some real local texture to average.
        const t = Math.pow((y - ridge(x)) / Math.max(1, height - ridge(x)), 0.8)
        const band = 0.5 + 0.5 * Math.sin((y * 0.11) + Math.sin(x * 0.004) * 3)
        // Grain that coarsens with depth, so the ground has structure the
        // flat-field will keep rather than one smooth ramp it will erase.
        const grain = tex * (30 + t * 62)
        const shade = t * 0.80 + band * 0.12 * (0.3 + t)
        r = 236 - shade * 176 - grain
        g = 216 - shade * 178 - grain
        b = 182 - shade * 160 - grain * 0.8
      }

      // A standing figure, well below the horizon, dark enough to survive.
      const fx = width * 0.30
      const fy = horizon + height * 0.20
      const dx = Math.abs(x - fx)
      const dy = y - fy
      const bodyW = height * 0.036 * (1 + Math.max(0, dy) / (height * 0.34))
      const inBody = dy > -height * 0.10 && dy < height * 0.20 && dx < bodyW
      const inHead = Math.hypot(dx, dy + height * 0.135) < height * 0.028
      if (inBody || inHead) {
        const k = 0.86
        r *= 1 - k
        g *= 1 - k
        b = b * (1 - k) + 26 * k
      }

      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }

  return { data, width, height }
}
