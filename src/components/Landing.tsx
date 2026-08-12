import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Download, Grid2x2, ImageIcon, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dropzone } from '@/components/Dropzone'
import { build } from '@/engine/build'
import { DEFAULT_OPTIONS, toDensityMaps, type DensityMaps } from '@/engine/mosaic'
import { PACKS, DEFAULT_PACK } from '@/engine/packs'
import { PALETTES, DEFAULT_PALETTE } from '@/engine/palettes'
import { CARD_PRESETS, type Preset } from '@/engine/presets'
import { drawMosaic } from '@/engine/render-canvas'
import { DEFAULT_BACKGROUND } from '@/engine/background'
import type { SourcePixels } from '@/lib/image'
import { makeSample } from '@/lib/sample'
import { cn } from '@/lib/utils'

interface Props {
  onLoad: (px: SourcePixels) => void
  onPreset: (id: string) => void
  onError: (message: string) => void
}

/** The sample, small. Everything on this page is drawn from one set of density
 *  maps: four preset thumbnails and two of the three explainer tiles. Building
 *  it once at 560 px keeps the whole page under a frame's worth of work. */
const THUMB_SOURCE = 560

/** What a card renders at. */
const THUMB_WIDTH = 520

/** A card is about 270 px wide. Rendered at the preset's real column count a
 *  260-column ASCII grid puts one character per pixel there, and every card
 *  comes out as the same grey noise: technically the preset, visually a lie.
 *
 * So the thumbnail keeps the preset's *character*, its pack, palette, tone
 *  curve and its position relative to the other cards, at a column count the
 *  card can actually resolve. The ordering survives, the glyphs stay legible,
 *  and clicking still applies the real numbers.
 */
function thumbOptions(o: Partial<typeof DEFAULT_OPTIONS>): Partial<typeof DEFAULT_OPTIONS> {
  const out = { ...o }
  if (o.cols) out.cols = Math.max(36, Math.min(90, Math.round(o.cols * 0.32)))
  // Organic needs the opposite correction. Its mark *count* is scale-invariant,
  // because spacing is measured in units of the output width, but its mark
  // *size* is not: 19,000 marks at 520 px are two pixels each, and on a card a
  // quarter the width of the workspace canvas that is pale dust, on the one
  // card whose label promises sparse and large. So fewer marks, each bigger.
  if (o.density) {
    out.density = o.density * 0.5
    out.glyphScale = (o.glyphScale ?? DEFAULT_OPTIONS.glyphScale) * 2.6
  }
  return out
}

/** Module-level so its identity is stable: MosaicTile rebuilds whenever its
 *  options object changes, and an inline literal is a new object every render. */
const STEP_OPTIONS = { cols: 84, valnoise: 0.1 }

export function Landing({ onLoad, onPreset, onError }: Props) {
  const sample = useMemo(() => makeSample(THUMB_SOURCE, THUMB_SOURCE / 2), [])
  const maps = useMemo(
    () => toDensityMaps(sample.data, sample.width, sample.height),
    [sample],
  )

  const start = (preset?: Preset) => {
    if (preset) onPreset(preset.id)
    onLoad(makeSample())
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <h2 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">
        Turn an image into thousands of small glyphs, then export it at
        wall size.
      </h2>

      <Steps maps={maps} />

      <div className="mt-9">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-medium">Start from a look</h3>
            <p className="text-muted-foreground text-[13px]">
              Each one sets the glyphs, the density and the colour. Change
              anything afterwards.
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => start()}>
            <Sparkles className="size-3.5" />
            Try a sample
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARD_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              maps={maps}
              onClick={() => start(preset)}
            />
          ))}
        </div>
      </div>

      <Dropzone
        variant="compact"
        className="mt-8"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  )
}

/** Image, glyph grid, export. Two of the three are the real renderer rather
 *  than an illustration of it, because the middle step is the whole claim and
 *  a drawing of it would be a weaker version of something already cheap. */
function Steps({ maps }: { maps: DensityMaps }) {
  return (
    <ol className="mt-6 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-3">
      <Step n={1} label="Your image" icon={ImageIcon}>
        <SourceTile maps={maps} />
      </Step>
      <Chevron />
      <Step n={2} label="Glyph grid" icon={Grid2x2}>
        <MosaicTile maps={maps} packId="motifs" paletteId="desert" options={STEP_OPTIONS} />
      </Step>
      <Chevron />
      <Step n={3} label="SVG or PNG" icon={Download}>
        <div className="text-muted-foreground flex h-full items-center justify-center gap-1.5">
          <Download className="size-5" strokeWidth={1.5} />
          <span className="font-mono text-[10px]">17,717 px</span>
        </div>
      </Step>
    </ol>
  )
}

const Chevron = () => (
  <ArrowRight className="text-muted-foreground/60 size-4 shrink-0" aria-hidden />
)

function Step({
  n, label, icon: Icon, children,
}: {
  n: number
  label: string
  icon: typeof ImageIcon
  children: React.ReactNode
}) {
  return (
    <li className="min-w-0">
      <div className="bg-muted/40 aspect-[2/1] overflow-hidden rounded-lg ring-1 ring-black/5">
        {children}
      </div>
      <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11px]">
        <Icon className="size-3" aria-hidden />
        <span className="truncate">
          <span className="tabular-nums">{n}.</span> {label}
        </span>
      </p>
    </li>
  )
}

/** The source, drawn straight from the same pixels the mosaic is built from,
 *  so step 1 and step 2 are demonstrably the same image. */
function SourceTile({ maps }: { maps: DensityMaps }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const { width, height, rgb } = maps
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      img.data[i * 4] = rgb[i * 3]
      img.data[i * 4 + 1] = rgb[i * 3 + 1]
      img.data[i * 4 + 2] = rgb[i * 3 + 2]
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [maps])
  return <canvas ref={ref} className="block h-full w-full object-cover" />
}

/** One real mosaic, built and drawn on a canvas.
 *
 * Deferred a frame so the page paints before four mosaics are built. They are
 * small, but four builds back to back on the first paint is exactly the kind
 * of thing that makes a landing page feel broken on a phone.
 */
function MosaicTile({
  maps, packId, paletteId, options, width = THUMB_WIDTH,
}: {
  maps: DensityMaps
  packId?: string
  paletteId?: string
  options: Partial<typeof DEFAULT_OPTIONS>
  width?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      const canvas = ref.current
      if (!canvas || cancelled) return
      const pack = PACKS.find((p) => p.id === packId) ?? DEFAULT_PACK
      const palette = PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE
      const opts = { ...DEFAULT_OPTIONS, ...options, width, figureBox: null }
      const result = build(maps, pack, palette, opts)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(result.width * 0.5 * dpr)
      canvas.height = Math.round(result.height * 0.5 * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawMosaic(ctx, result, pack, {
        scale: canvas.width / result.width,
        background: DEFAULT_BACKGROUND,
      })
      setDrawn(true)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [maps, packId, paletteId, options, width])

  return (
    <canvas
      ref={ref}
      className={cn(
        'block h-full w-full transition-opacity duration-200',
        drawn ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

function PresetCard({
  preset, maps, onClick,
}: {
  preset: Preset
  maps: DensityMaps
  onClick: () => void
}) {
  const options = useMemo(() => thumbOptions(preset.options), [preset.options])
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group focus-visible:ring-ring overflow-hidden rounded-lg border text-left transition-colors',
        'hover:border-foreground/30 hover:bg-accent/40 focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <div className="aspect-[2/1] overflow-hidden bg-white">
        <MosaicTile
          maps={maps}
          packId={preset.packId}
          paletteId={preset.paletteId}
          options={options}
        />
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[13px] font-medium">{preset.label}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
          {preset.hint}
        </p>
      </div>
    </button>
  )
}
