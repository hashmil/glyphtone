/** Seeded PRNG.
 *
 * The Python prototype uses numpy's PCG64, which has no compact JS equivalent.
 * Reproducing its exact stream is not worth the code, so the port instead uses
 * mulberry32 on both sides when comparing outputs. Same seed gives the same
 * result within this engine; it will not match a numpy run bit for bit, and
 * the port is verified on ink statistics rather than on pixel equality.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function random(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in [0, n). */
export function randInt(random: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(random() * n))
}
