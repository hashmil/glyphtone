/** Checks the photograph prep against the Python original it was ported from.
 *
 * Unlike the mosaic, prep has no randomness in it at all, so this can be held
 * to near pixel equality. The only expected difference is that Python blurs a
 * uint8 copy of the luminance while this works in float, which costs a couple
 * of levels out of 255.
 *
 * This test exists because the first version of the port was wrong and looked
 * plausible: a subtly asymmetric box blur shifted the flat-field by two pixels
 * and pushed coverage from 38% to 55%, which reads as "slightly different
 * tuning" rather than as a bug.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { blurLuma, prepPhoto } from './prep'

const DIR = join(import.meta.dirname, '__fixtures__')
const stats = JSON.parse(readFileSync(join(DIR, 'python-stats.json'), 'utf8'))
const { width, height } = stats

function source() {
  const raw = readFileSync(join(DIR, 'source.raw'))
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = raw[i * 3]
    rgba[i * 4 + 1] = raw[i * 3 + 1]
    rgba[i * 4 + 2] = raw[i * 3 + 2]
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

describe('photograph prep vs the Python original', () => {
  const result = prepPhoto(source(), width, height, stats.prep.options)

  it('reports the same mean ink', () => {
    expect(result.meanInk).toBeCloseTo(stats.prep.meanInk, 3)
  })

  it('reports the same coverage', () => {
    // The headline number: a photo straight in fills nearly every cell, and
    // this is what brings it back to something with white space in it.
    expect(result.coverage).toBeCloseTo(stats.prep.coverage, 3)
  })

  it('produces the same pixels', () => {
    const py = readFileSync(join(DIR, 'prepped.raw'))
    let max = 0
    let sum = 0
    for (let i = 0; i < width * height; i++) {
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(result.data[i * 4 + c] - py[i * 3 + c])
        if (d > max) max = d
        sum += d
      }
    }
    expect(max).toBeLessThanOrEqual(6)
    expect(sum / (width * height * 3)).toBeLessThan(1)
  })
})

describe('the blur underneath it', () => {
  const N = 201
  const C = Math.floor(N / 2)

  /** Sigma and centre of the blurred response to a step edge. A blur that is
   *  correct has the right width, is centred where the edge was, and moves no
   *  mass. All three of these were wrong in the box-blur version. */
  function measure(step: (x: number, y: number) => number, along: 'x' | 'y', sigma: number) {
    const a = new Float32Array(N * N)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[y * N + x] = step(x, y)
    const b = blurLuma(a, N, N, sigma)
    const line = Array.from({ length: N }, (_, i) =>
      along === 'x' ? b[C * N + i] : b[i * N + C])
    const d = line.map((_, i) => (i === 0 || i === N - 1 ? 0 : (line[i + 1] - line[i - 1]) / 2))
    const s = d.reduce((p, c) => p + c, 0)
    const mu = d.reduce((p, c, i) => p + c * (i - C), 0) / s
    const va = d.reduce((p, c, i) => p + c * (i - C - mu) ** 2, 0) / s
    return { sigma: Math.sqrt(va), mu, mass: s }
  }

  for (const sigma of [3, 9.6]) {
    it(`is symmetric and unshifted at sigma ${sigma}`, () => {
      const hx = measure((x) => (x >= C ? 1 : 0), 'x', sigma)
      const vy = measure((_, y) => (y >= C ? 1 : 0), 'y', sigma)
      // The edge sits at C - 0.5, so that is where the centre should land.
      expect(hx.mu).toBeCloseTo(-0.5, 1)
      expect(vy.mu).toBeCloseTo(-0.5, 1)
      expect(hx.sigma).toBeCloseTo(sigma, 0)
      expect(vy.sigma).toBeCloseTo(sigma, 0)
      // Horizontal and vertical must behave identically.
      expect(hx.sigma).toBeCloseTo(vy.sigma, 3)
      expect(hx.mass).toBeCloseTo(vy.mass, 3)
    })
  }
})
