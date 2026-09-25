import sampleUrl from '@/assets/sample.webp'
import { decodeImage, type SourcePixels } from './image'

/** The demo image: a close-up portrait in raking light. Chosen because it
 *  exercises the parts of the engine a flat test card never does: skin tone
 *  on both sides of the warm/cool split, hard shadow edges, fine texture in
 *  the freckles and lashes, and a subject that clearly needs photo prep.
 *
 * Fetched and decoded once, then shared by the landing page and "Use the
 * sample", so the second use costs nothing. */
let cached: Promise<SourcePixels> | null = null

export function loadSample(): Promise<SourcePixels> {
  cached ??= fetch(sampleUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`Sample image failed to load (${r.status})`)
      return r.blob()
    })
    .then(decodeImage)
    .catch((e) => {
      cached = null
      throw e
    })
  return cached
}
