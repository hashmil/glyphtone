import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildMosaic, toDensityMaps, DEFAULT_OPTIONS } from '@/engine/mosaic'
import { DEFAULT_SET } from '@/engine/glyphs'
import { PALETTES, DEFAULT_PALETTE } from '@/engine/palettes'
import { DEFAULT_PRESET, PRESETS } from '@/engine/presets'
import { prepPhoto, DEFAULT_PREP, type PrepOptions } from '@/engine/prep'
import type { MosaicOptions, MosaicResult } from '@/engine/types'
import { looksLikePhoto, type SourcePixels } from './image'

/** Width the preview is built at. The mosaic scales with cols, not with this,
 *  so the preview and the export differ only in output resolution. */
const PREVIEW_WIDTH = 1600

export interface MosaicState {
  source: SourcePixels | null
  result: MosaicResult | null
  options: MosaicOptions
  paletteId: string
  presetId: string
  prep: PrepOptions
  prepEnabled: boolean
  /** set when the source looks like a photo but prep is off, so the UI can say
   *  so rather than letting the user wonder why it reads as a slab */
  suggestPrep: boolean
  busy: boolean
  buildMs: number
}

export function useMosaic() {
  const [source, setSource] = useState<SourcePixels | null>(null)
  const [result, setResult] = useState<MosaicResult | null>(null)
  const [options, setOptions] = useState<MosaicOptions>({
    ...DEFAULT_OPTIONS,
    ...DEFAULT_PRESET.options,
    width: PREVIEW_WIDTH,
  })
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id)
  const [prep, setPrep] = useState<PrepOptions>(DEFAULT_PREP)
  const [prepEnabled, setPrepEnabled] = useState(false)
  const [suggestPrep, setSuggestPrep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [buildMs, setBuildMs] = useState(0)

  const palette = useMemo(
    () => PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE,
    [paletteId],
  )

  /** Prep is the expensive half and only depends on the photo controls, so it
   *  is cached separately from the mosaic. Dragging a density slider should
   *  not re-run a blur over two megapixels. */
  const prepped = useMemo(() => {
    if (!source) return null
    if (!prepEnabled) return source
    const out = prepPhoto(source.data, source.width, source.height, prep)
    return { data: out.data, width: source.width, height: source.height }
  }, [source, prepEnabled, prep])

  const maps = useMemo(
    () => (prepped ? toDensityMaps(prepped.data, prepped.width, prepped.height) : null),
    [prepped],
  )

  // Debounced rebuild. The engine is fast enough that this is about not
  // blocking paint mid-drag rather than about the build itself being slow.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!maps) {
      setResult(null)
      return
    }
    setBusy(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const t0 = performance.now()
      const r = buildMosaic(maps, DEFAULT_SET, palette, options)
      setBuildMs(performance.now() - t0)
      setResult(r)
      setBusy(false)
    }, 60)
    return () => window.clearTimeout(timer.current)
  }, [maps, palette, options])

  const load = useCallback((px: SourcePixels) => {
    setSource(px)
    const photo = looksLikePhoto(px)
    setSuggestPrep(photo)
    setPrepEnabled(photo)
    // A fresh image invalidates any focal box, which was drawn in the previous
    // image's pixel coordinates.
    setOptions((o) => ({ ...o, figureBox: null }))
  }, [])

  const applyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setOptions((o) => ({ ...o, ...preset.options }))
  }, [])

  const update = useCallback((patch: Partial<MosaicOptions>) => {
    setOptions((o) => ({ ...o, ...patch }))
    // Any manual change means the result is no longer that preset.
    setPresetId('custom')
  }, [])

  const reset = useCallback(() => {
    setSource(null)
    setResult(null)
    setSuggestPrep(false)
    setPrepEnabled(false)
  }, [])

  return {
    source, result, options, palette, paletteId, presetId,
    prep, prepEnabled, suggestPrep, busy, buildMs,
    load, update, applyPreset, reset,
    setPaletteId, setPrep, setPrepEnabled,
  }
}
