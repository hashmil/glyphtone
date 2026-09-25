import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { build } from '@/engine/build'
import { toDensityMaps, DEFAULT_OPTIONS, type DensityMaps } from '@/engine/mosaic'
import { PACKS, DEFAULT_PACK } from '@/engine/packs'
import { PALETTES, DEFAULT_PALETTE, CUSTOM_PALETTE_ID, isRamps, type Palette } from '@/engine/palettes'
import { DEFAULT_PRESET, PRESETS } from '@/engine/presets'
import { autoLift, liftPixels, prepPhoto, DEFAULT_PREP, type PrepOptions } from '@/engine/prep'
import type { MosaicOptions, MosaicResult } from '@/engine/types'
import { looksLikePhoto, type SourcePixels } from './image'

/** Width the preview is built at. The mosaic scales with cols, not with this,
 *  so the preview and the export differ only in output resolution. */
const PREVIEW_WIDTH = 1600

/** What the app is doing, so the UI can say so instead of freezing.
 *
 * Preparing a photograph blurs the whole frame and building a dense mosaic
 * places six figures of marks. Neither is slow enough to need a worker, but
 * both are long enough that going silent looks broken, especially on a phone.
 */
export type Status = 'idle' | 'reading' | 'preparing' | 'building'

export const STATUS_LABEL: Record<Exclude<Status, 'idle'>, string> = {
  reading: 'Reading image',
  preparing: 'Preparing photograph',
  building: 'Placing icons',
}

/** Let the browser paint before starting synchronous work, so a spinner that
 *  was just set actually appears rather than being batched away behind it. */
const yieldToPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))

/** Where the custom palette is kept between visits. Per browser, which is the
 *  right scope for a colour scheme someone is working on. */
const CUSTOM_KEY = 'glyphtone.customPalette'

function readCustom(): Palette['ramps'] | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? 'null')
    return isRamps(v) ? v : null
  } catch {
    return null
  }
}

export function useMosaic() {
  const [source, setSource] = useState<SourcePixels | null>(null)
  const [result, setResult] = useState<MosaicResult | null>(null)
  const [maps, setMaps] = useState<DensityMaps | null>(null)
  const [options, setOptions] = useState<MosaicOptions>({
    ...DEFAULT_OPTIONS,
    ...DEFAULT_PRESET.options,
    width: PREVIEW_WIDTH,
  })
  const [packId, setPackId] = useState(DEFAULT_PACK.id)
  const [paletteId, setPaletteIdRaw] = useState(DEFAULT_PALETTE.id)
  // The last preset palette chosen. Custom starts from it, and resets to it.
  const [basePaletteId, setBasePaletteId] = useState(DEFAULT_PALETTE.id)
  const [customRamps, setCustomRampsRaw] = useState<Palette['ramps'] | null>(readCustom)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id)
  const [prep, setPrep] = useState<PrepOptions>(DEFAULT_PREP)
  const [prepEnabled, setPrepEnabled] = useState(false)
  const [lift, setLift] = useState(1)
  const [suggestPrep, setSuggestPrep] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [buildMs, setBuildMs] = useState(0)

  const pack = useMemo(() => PACKS.find((p) => p.id === packId) ?? DEFAULT_PACK, [packId])
  const basePalette = useMemo(
    () => PALETTES.find((p) => p.id === basePaletteId) ?? DEFAULT_PALETTE,
    [basePaletteId],
  )
  const palette = useMemo<Palette>(
    () => paletteId === CUSTOM_PALETTE_ID
      ? { id: CUSTOM_PALETTE_ID, label: 'Custom', ramps: customRamps ?? basePalette.ramps }
      : PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE,
    [paletteId, customRamps, basePalette],
  )

  const setCustomRamps = useCallback((ramps: Palette['ramps']) => {
    setCustomRampsRaw(ramps)
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(ramps))
    } catch {
      // Storage can be blocked or full. The palette still works this session.
    }
  }, [])

  /** Choosing Custom for the first time copies the palette on screen, so it
   *  starts from something that already works rather than from nothing. */
  const setPaletteId = useCallback((id: string) => {
    if (id === CUSTOM_PALETTE_ID) {
      if (!customRamps) setCustomRamps(basePalette.ramps)
    } else {
      setBasePaletteId(id)
    }
    setPaletteIdRaw(id)
  }, [customRamps, basePalette, setCustomRamps])

  const resetCustom = useCallback(
    () => setCustomRamps(basePalette.ramps),
    [basePalette, setCustomRamps],
  )

  // Prep is the expensive half and depends only on the photo controls, so it
  // is cached against them. Dragging a density slider must not re-run a blur
  // over two megapixels.
  const prepKey = `${lift.toFixed(3)}:${prepEnabled ? JSON.stringify(prep) : 'off'}`
  const prepCache = useRef<{ key: string; src: SourcePixels | null; maps: DensityMaps } | null>(null)

  const run = useRef(0)

  useEffect(() => {
    if (!source) {
      setResult(null)
      setMaps(null)
      return
    }
    const token = ++run.current
    let cancelled = false

    ;(async () => {
      let m = prepCache.current?.key === prepKey && prepCache.current.src === source
        ? prepCache.current.maps
        : null

      if (!m) {
        const lifted = liftPixels(source.data, lift)
        if (prepEnabled) {
          setStatus('preparing')
          await yieldToPaint()
          if (cancelled || token !== run.current) return
          const out = prepPhoto(lifted, source.width, source.height, prep)
          m = toDensityMaps(out.data, source.width, source.height)
        } else {
          m = toDensityMaps(lifted, source.width, source.height)
        }
        prepCache.current = { key: prepKey, src: source, maps: m }
      }

      setStatus('building')
      await yieldToPaint()
      if (cancelled || token !== run.current) return

      const t0 = performance.now()
      const r = build(m, pack, palette, options)
      if (cancelled || token !== run.current) return
      setBuildMs(performance.now() - t0)
      setMaps(m)
      setResult(r)
      setStatus('idle')
    })()

    return () => { cancelled = true }
  }, [source, prepKey, prepEnabled, prep, lift, pack, palette, options])

  const load = useCallback(async (px: SourcePixels) => {
    setStatus('reading')
    await yieldToPaint()
    setSource(px)
    const photo = looksLikePhoto(px)
    setSuggestPrep(photo)
    setPrepEnabled(photo)
    // Artwork is left alone; a photo gets its mid-tones lifted into range.
    setLift(photo ? autoLift(px.data) : 1)
    // A fresh image invalidates any focal box, drawn in the old image's pixels.
    setOptions((o) => ({ ...o, figureBox: null }))
  }, [])

  const applyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setOptions((o) => ({ ...o, ...preset.options }))
    // A preset that names a pack or a palette seeds those too. Without this a
    // landing-page card called "ASCII, fine" would set the density and leave
    // the glyphs on whatever was already selected.
    if (preset.packId) setPackId(preset.packId)
    if (preset.paletteId) setPaletteId(preset.paletteId)
  }, [setPaletteId])

  const update = useCallback((patch: Partial<MosaicOptions>) => {
    setOptions((o) => ({ ...o, ...patch }))
    // Any manual change means the result is no longer that preset.
    if (!('figureBox' in patch)) setPresetId('custom')
  }, [])

  const reset = useCallback(() => {
    setSource(null)
    setResult(null)
    setMaps(null)
    prepCache.current = null
    setSuggestPrep(false)
    setPrepEnabled(false)
    setStatus('idle')
  }, [])

  return {
    source, result, maps, options, pack, packId, palette, paletteId, presetId,
    customRamps, setCustomRamps, resetCustom, basePalette,
    prep, prepEnabled, suggestPrep, status, buildMs, lift,
    busy: status !== 'idle',
    load, update, applyPreset, reset,
    setPackId, setPaletteId, setPrep, setPrepEnabled, setLift,
  }
}
