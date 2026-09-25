import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

import { Btn, Slug } from '@/components/kit'
import { GlyphStrip } from '@/components/specimen'
import { build } from '@/engine/build'
import { DEFAULT_OPTIONS, toDensityMaps, type DensityMaps } from '@/engine/mosaic'
import { PACKS, DEFAULT_PACK, type GlyphPack } from '@/engine/packs'
import type { Palette } from '@/engine/palettes'
import { drawMosaic } from '@/engine/render-canvas'
import { DEFAULT_BACKGROUND } from '@/engine/background'
import type { MosaicResult } from '@/engine/types'
import { loadSample } from '@/lib/sample'
import { autoLift, liftPixels, prepPhoto, DEFAULT_PREP } from '@/engine/prep'
import { cn } from '@/lib/utils'

interface Props {
  packId: string
  palette: Palette
  onPack: (id: string) => void
  onChoose: () => void
  onSample: () => void
}

/** The hero is built at this output width. Big enough that the loupe, which
 *  draws the same placements at five times the on-screen scale, still shows
 *  real vector edges rather than an enlarged bitmap. */
const HERO_WIDTH = 1600
const HERO_OPTIONS = { cols: 120, valnoise: 0.08 }
const LOUPE = 176
const MAG = 5

export function Landing({ packId, palette, onPack, onChoose, onSample }: Props) {
  // The sample is a photograph, so it goes through the same prep the workspace
  // applies to photos. Fed in raw it would fill every cell and read as a slab.
  const [maps, setMaps] = useState<DensityMaps | null>(null)
  useEffect(() => {
    let live = true
    loadSample().then((px) => {
      if (!live) return
      const lifted = liftPixels(px.data, autoLift(px.data))
      const prepped = prepPhoto(lifted, px.width, px.height, DEFAULT_PREP)
      setMaps(toDensityMaps(prepped.data, px.width, px.height))
    }).catch(() => { /* the hero stays an empty sheet; the page still works */ })
    return () => { live = false }
  }, [])
  const pack = PACKS.find((p) => p.id === packId) ?? DEFAULT_PACK

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8">
      {/* Hero: the pitch on the left, a live proof on the right. */}
      <section className="grid grid-cols-1 gap-10 pt-10 pb-16 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pt-20 lg:pb-24">
        <div className="flex flex-col justify-center lg:col-span-5">
          <h1 className="font-display text-[clamp(44px,6.4vw,96px)] leading-[0.95]">
            Any image, rebuilt from thousands of glyphs.
          </h1>
          <p className="text-fg-2 mt-6 max-w-[34ch] text-lg">
            Pick a glyph set and a palette, tune the tone, and export a vector
            file that stays sharp on a three-metre wall.
          </p>
          <div className="mt-9 flex flex-wrap gap-2">
            <Btn tone="paper" size="lg" onClick={onChoose}>Choose an image</Btn>
            <Btn tone="line" size="lg" onClick={onSample}>Use the sample</Btn>
          </div>
          <p className="text-fg-2 mt-4 font-mono text-xs">
            Or drop one anywhere. It stays on this device.
          </p>
        </div>

        <div className="lg:col-span-7">
          <HeroProof maps={maps} pack={pack} palette={palette} />
          <div className="mt-8 flex flex-wrap gap-x-1 gap-y-1" role="radiogroup" aria-label="Glyph set">
            {PACKS.map((k) => {
              const on = k.id === pack.id
              return (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPack(k.id)}
                  className={cn(
                    'h-7 cursor-pointer rounded-sm px-2 font-mono text-xs transition-colors',
                    on ? 'bg-paper text-ink' : 'text-fg-2 hover:text-fg hover:bg-raise',
                  )}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <Specimen packId={pack.id} onPack={onPack} onChoose={onChoose} onSample={onSample} />
      <Notes />
      <Colophon />
    </div>
  )
}

/** The sample, drawn by the real renderer, with a loupe that re-renders the
 *  same placements at five times the scale. Zooming a bitmap would show blur
 *  where the export has crisp edges, and the edges are the point. */
function HeroProof({ maps, pack, palette }: { maps: DensityMaps | null; pack: GlyphPack; palette: Palette }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(0)
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null)

  const result = useMemo<MosaicResult | null>(() => {
    if (!maps) return null
    return build(maps, pack, palette, {
      ...DEFAULT_OPTIONS, ...HERO_OPTIONS, width: HERO_WIDTH, figureBox: null,
    })
  }, [maps, pack, palette])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const h = w && result ? (w * result.height) / result.width : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !w || !result) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawMosaic(ctx, result, pack, { scale: canvas.width / result.width, background: DEFAULT_BACKGROUND })
  }, [result, pack, w, h])

  // The loupe draws only its own slice, so a move costs one culled pass.
  useEffect(() => {
    const canvas = loupeRef.current
    if (!canvas || !lens || !w || !result) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(LOUPE * dpr)
    canvas.height = Math.round(LOUPE * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const onScreen = w / result.width // CSS px per output px
    const view = LOUPE / (onScreen * MAG) // output px visible in the lens
    const cx = (lens.x / w) * result.width
    const cy = (lens.y / h) * result.height
    drawMosaic(ctx, result, pack, {
      scale: canvas.width / view,
      background: DEFAULT_BACKGROUND,
      origin: { x: cx - view / 2, y: cy - view / 2 },
      size: { width: view, height: view },
    })
  }, [lens, result, pack, w, h])

  const move = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    setLens({ x: e.clientX - r.left, y: e.clientY - r.top })
  }, [])

  return (
    <figure>
      <div className="bg-table relative p-6 sm:p-10">
        <div
          ref={boxRef}
          className={cn('gt-sheet bg-paper relative', lens && 'cursor-none')}
          style={{ height: h || undefined, aspectRatio: h ? undefined : '1456 / 816' }}
          onPointerMove={move}
          onPointerLeave={() => setLens(null)}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
          {lens && (
            <div
              className="pointer-events-none absolute overflow-hidden rounded-full ring-1 ring-black/70"
              style={{
                width: LOUPE, height: LOUPE,
                left: lens.x - LOUPE / 2, top: lens.y - LOUPE / 2,
                boxShadow: '0 0 0 4px rgb(13 13 13 / 0.85), 0 12px 32px -8px rgb(0 0 0 / 0.6)',
              }}
            >
              <canvas ref={loupeRef} className="block size-full" />
            </div>
          )}
        </div>
        <HeroCrop />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Slug parts={result ? [
          'Sample',
          pack.label,
          `${result.cols} × ${result.rows} cells`,
          `${result.filled.toLocaleString()} glyphs`,
        ] : ['Loading the sample']} />
        <span className="text-fg-3 hidden font-mono text-xs sm:inline">Hover to inspect at {MAG}×</span>
      </figcaption>
    </figure>
  )
}

/** Crop marks for the hero sheet, sitting in the table's padding. */
function HeroCrop() {
  const cls = 'bg-fg-3 absolute'
  return (
    <div className="pointer-events-none absolute inset-6 sm:inset-10" aria-hidden>
      {(['top', 'bottom'] as const).flatMap((y) =>
        (['left', 'right'] as const).map((x) => (
          <div key={x + y}>
            <span className={cn(cls, 'h-px w-3.5')} style={{ [y]: 0, [x]: -20 }} />
            <span className={cn(cls, 'h-3.5 w-px')} style={{ [x]: 0, [y]: -20 }} />
          </div>
        )),
      )}
    </div>
  )
}

/** Each set shown the way a foundry shows a face: the full ladder, light to
 *  dark, from the pack's own measured coverages. */
function Specimen({
  packId, onPack, onChoose, onSample,
}: {
  packId: string
  onPack: (id: string) => void
  onChoose: () => void
  onSample: () => void
}) {
  return (
    <section className="border-rule border-t pt-12 pb-16 lg:pt-16">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-8">
        <h2 className="font-display text-xl lg:col-span-5">{PACKS.length} glyph sets</h2>
        <p className="text-fg-2 max-w-[56ch] text-sm lg:col-span-7">
          Every set is a ladder of ink coverage. Each cell of the image asks for
          a tone and gets the glyph whose coverage is closest, so light areas
          fill with the marks on the left of each row and dark areas with the
          marks on the right.
        </p>
      </div>

      <ul className="mt-10">
        {PACKS.map((k) => (
          <SpecimenRow
            key={k.id}
            pack={k}
            active={k.id === packId}
            onSelect={() => onPack(k.id)}
            onChoose={onChoose}
            onSample={onSample}
          />
        ))}
      </ul>
    </section>
  )
}

function SpecimenRow({
  pack, active, onSelect, onChoose, onSample,
}: {
  pack: GlyphPack
  active: boolean
  onSelect: () => void
  onChoose: () => void
  onSample: () => void
}) {
  const covs = Object.values(pack.coverages).filter((c) => c > 0)
  const lo = Math.min(...covs)
  const hi = Math.max(...covs)
  return (
    <li className={cn('border-rule group border-b first:border-t', active && 'bg-table')}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={active}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className="grid cursor-pointer grid-cols-1 items-center gap-4 px-0 py-6 sm:px-4 lg:grid-cols-12 lg:gap-8"
      >
        <div className="flex items-baseline gap-4 lg:col-span-4">
          <span
            className={cn('size-1.5 shrink-0 -translate-y-1', active ? 'bg-magenta' : 'bg-transparent')}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="font-display text-[clamp(22px,2.4vw,31px)] leading-none">{pack.label}</h3>
            <p className="text-fg-2 mt-2 text-sm">{pack.hint}</p>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden pl-5.5 lg:col-span-6 lg:pl-0">
          <div className="hidden xl:block">
            <GlyphStrip pack={pack} count={18} size={24} gap={0.5} color={active ? '#ffffff' : '#ededeb'} />
          </div>
          <div className="hidden sm:block xl:hidden">
            <GlyphStrip pack={pack} count={14} size={22} gap={0.5} />
          </div>
          <div className="sm:hidden">
            <GlyphStrip pack={pack} count={10} size={20} gap={0.4} />
          </div>
          <p className="text-fg-3 mt-3 font-mono text-xs tabular-nums">
            {covs.length} glyphs, {lo.toFixed(2)} to {hi.toFixed(2)} ink
          </p>
        </div>
        <div className="flex gap-2 pl-5.5 lg:col-span-2 lg:justify-end lg:pl-0">
          {active ? (
            <>
              <Btn tone="paper" size="sm" onClick={(e) => { e.stopPropagation(); onChoose() }}>
                Choose image
              </Btn>
              <Btn tone="line" size="sm" onClick={(e) => { e.stopPropagation(); onSample() }}>
                Sample
              </Btn>
            </>
          ) : (
            <span className="text-fg-3 group-hover:text-fg-2 font-mono text-xs transition-colors">Select</span>
          )}
        </div>
      </div>
    </li>
  )
}

const NOTES = [
  {
    title: 'Tone comes from the shape',
    body: 'Glyphs sit on a lattice, one per cell, all the same size. Each cell gets the glyph whose ink coverage is closest to the tone it needs, and the rounding error is pushed into its neighbours, so a gradient stays smooth instead of banding.',
  },
  {
    title: 'Photographs are prepared first',
    body: 'A photo carries tone everywhere. Fed in raw, the test image filled 84% of cells and read as a slab; prepared, it filled 57% and read as a picture. It switches on by itself when a frame has little white in it.',
  },
  {
    title: 'Sized as print decisions',
    body: 'Export sizes are posters and panels, not pixel counts. A 3 m panel at 150 dpi is 17,717 px on the long edge, past Illustrator’s 16,383 px artboard limit, so large exports split into tiles that line up at the joins.',
  },
]

function Notes() {
  return (
    <section className="border-rule grid grid-cols-1 gap-10 border-t py-14 md:grid-cols-3 md:gap-8">
      {NOTES.map((n) => (
        <div key={n.title}>
          <h3 className="text-md font-medium">{n.title}</h3>
          <p className="text-fg-2 mt-3 max-w-[44ch] text-sm">{n.body}</p>
        </div>
      ))}
    </section>
  )
}

function Colophon() {
  return (
    <footer className="border-rule text-fg-3 flex flex-col gap-3 border-t py-8 font-mono text-xs sm:flex-row sm:items-center sm:justify-between">
      <p>Glyphtone. Everything runs in your browser; no image is uploaded. MIT licence.</p>
      <a
        href="https://github.com/hashmil/glyphtone"
        target="_blank"
        rel="noreferrer"
        className="hover:text-fg inline-flex items-center gap-1 transition-colors"
      >
        Source on GitHub <ArrowUpRight className="size-3" />
      </a>
    </footer>
  )
}
