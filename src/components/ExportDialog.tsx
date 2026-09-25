import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Btn, Fader, Segmented, Slug, SwitchRow } from '@/components/kit'
import {
  backgroundWarnings, planExport, runExport,
  type ExportContext, type ExportFormat,
} from '@/lib/export'
import { DEFAULT_BACKGROUND, hasAlpha, type Background } from '@/engine/background'
import { build } from '@/engine/build'
import { drawMosaic } from '@/engine/render-canvas'
import { cn } from '@/lib/utils'

interface Props {
  ctx: ExportContext | null
  /** Whatever the preview is showing. The export has no background control of
   *  its own: two places to set it is two places for them to disagree, and the
   *  preview is where the decision is actually being looked at. */
  background?: Background
  disabled?: boolean
}

const BG_LABEL: Record<Background['kind'], string> = {
  transparent: 'no paper',
  solid: 'solid paper',
  gradient: 'blended paper',
  image: 'image paper',
}

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'svg', label: 'SVG', hint: 'Vector, sharp at any size. Opens in Illustrator.' },
  { id: 'svgz', label: 'SVGZ', hint: 'The same vector file compressed, usually a fraction of the size.' },
  { id: 'png', label: 'PNG', hint: 'Pixels. Simpler to hand on, but fixed at this resolution.' },
]

/** Print sizes rather than pixel counts, because that is the decision being
 *  made. Environmental graphics people walk past at two to three metres need
 *  roughly 100 to 200 dpi, which is far above the 15 to 30 dpi rule of thumb
 *  quoted for roadside billboards. */
const SIZES = [
  { id: 'screen', label: 'Screen', detail: 'Sharing, slides, a first look', px: 2400 },
  { id: 'a1', label: 'A1 poster', detail: '841 mm at 150 dpi', px: 4967 },
  { id: 'p1', label: '1 m panel', detail: '1,000 mm at 150 dpi', px: 5906 },
  { id: 'p3', label: '3 m panel', detail: '3,000 mm at 150 dpi', px: 17717 },
  { id: 'custom', label: 'Custom', detail: 'Any width', px: 0 },
]

export function ExportDialog({ ctx, background = DEFAULT_BACKGROUND, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('svg')
  const [sizeId, setSizeId] = useState('screen')
  const [custom, setCustom] = useState(6000)
  const [tiling, setTiling] = useState(false)
  const [tile, setTile] = useState(4000)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number]>([0, 0])

  const width = sizeId === 'custom' ? custom : (SIZES.find((s) => s.id === sizeId)?.px ?? 2400)

  const req = useMemo(
    () => ({ format, width, tile: tiling ? tile : 0, background, basename: 'glyphtone' }),
    [format, width, tiling, tile, background],
  )
  const bgWarnings = useMemo(() => backgroundWarnings(format, background), [format, background])
  const aspect = ctx ? ctx.maps.width / ctx.maps.height : 2
  const plan = useMemo(() => (ctx ? planExport(req, aspect) : null), [ctx, req, aspect])

  async function go() {
    if (!ctx || !plan) return
    setBusy(true)
    setProgress([0, plan.tiles])
    try {
      await runExport(req, ctx, (done, total) => setProgress([done, total]))
      toast.success(plan.tiles > 1 ? `${plan.tiles} tiles exported` : 'Exported')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const fmt = FORMATS.find((f) => f.id === format)!

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Btn tone="paper" disabled={disabled}>
          <ArrowDownToLine />
          Export
        </Btn>
      </DialogTrigger>
      <DialogContent className="bg-ink scroll-quiet max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[720px]">
        <div className="border-rule border-b px-6 pt-5 pb-4">
          <DialogTitle className="font-display text-xl">Export</DialogTitle>
          <DialogDescription className="text-fg-2 mt-1.5 text-sm">
            Rendered on this device at full resolution. Nothing is uploaded.
          </DialogDescription>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_300px]">
          {/* Left: what comes out, drawn to the piece's aspect with the tile
              grid on it, so the split is visible before anything renders. */}
          <div className="bg-table border-rule flex flex-col justify-between gap-6 border-b p-6 sm:border-r sm:border-b-0">
            <div className="flex flex-1 items-center justify-center py-2">
              {plan && ctx && open && (
                <TilePreview ctx={ctx} background={background} aspect={aspect} cols={plan.cols} rows={plan.rows} />
              )}
            </div>
            {plan && (
              <div className="space-y-1">
                <p className="font-display text-xl tabular-nums">
                  {plan.outWidth.toLocaleString()} × {plan.outHeight.toLocaleString()}
                  <span className="text-fg-2 ml-1.5 font-sans text-sm font-normal">px</span>
                </p>
                <Slug parts={[
                  fmt.label,
                  plan.tiles > 1 ? `${plan.cols} × ${plan.rows} tiles in a zip` : 'one file',
                  BG_LABEL[background.kind],
                ]} />
              </div>
            )}
          </div>

          <div className="divide-rule divide-y">
            <div className="space-y-3 p-5">
              <h3 className="text-fg-2 font-mono text-xs">Format</h3>
              <Segmented value={format} onChange={setFormat} options={FORMATS} />
              <p className="text-fg-2 text-xs">{fmt.hint}</p>
            </div>

            <div className="p-5">
              <h3 className="text-fg-2 mb-2 font-mono text-xs">Size</h3>
              <div role="radiogroup" className="-mx-2">
                {SIZES.map((s) => {
                  const on = s.id === sizeId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSizeId(s.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors',
                        on ? 'bg-raise' : 'hover:bg-raise/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-3 shrink-0 items-center justify-center rounded-full border',
                          on ? 'border-paper' : 'border-rule-2',
                        )}
                      >
                        {on && <span className="bg-paper size-1.5 rounded-full" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{s.label}</span>
                        <span className="text-fg-2 block text-xs">{s.detail}</span>
                      </span>
                      {s.px > 0 && (
                        <span className="text-fg-2 font-mono text-xs tabular-nums">
                          {s.px.toLocaleString()}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {sizeId === 'custom' && (
                <div className="mt-4">
                  <Fader
                    label="Width"
                    value={custom} min={800} max={30000} step={100}
                    format={(v) => `${v.toLocaleString()} px`}
                    onChange={setCustom}
                  />
                </div>
              )}
            </div>

            <div className="space-y-5 p-5">
              <SwitchRow
                label="Split into tiles"
                checked={tiling}
                onChange={setTiling}
                hint="Delivered as one zip. Tiles are crops of a single render, so tone lines up across the joins."
              />
              {tiling && (
                <Fader
                  label="Tile size"
                  value={tile} min={1000} max={16000} step={500}
                  format={(v) => `${v.toLocaleString()} px`}
                  onChange={setTile}
                />
              )}
            </div>
          </div>
        </div>

        <div className="border-rule bg-ink sticky bottom-0 space-y-3 border-t px-6 py-4">
          {plan?.blocked && (
            <p className="text-magenta text-xs">{plan.blocked}</p>
          )}
          {plan && [...plan.warnings, ...bgWarnings].map((w) => (
            <p key={w} className="text-yellow text-xs">{w}</p>
          ))}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {busy && progress[1] > 1 ? (
                <div className="space-y-1.5">
                  <div className="bg-rule-2 h-px w-full">
                    <div
                      className="bg-magenta h-px transition-[width]"
                      style={{ width: `${(progress[0] / progress[1]) * 100}%` }}
                    />
                  </div>
                  <p className="text-fg-2 font-mono text-xs tabular-nums">
                    tile {progress[0]} of {progress[1]}
                  </p>
                </div>
              ) : (
                <p className="text-fg-3 font-mono text-xs">
                  {busy ? 'Rendering' : 'Saved to your downloads folder'}
                </p>
              )}
            </div>
            <Btn tone="paper" size="lg" onClick={go} disabled={busy || !!plan?.blocked || !ctx}>
              <ArrowDownToLine />
              {busy ? 'Rendering' : `Export ${fmt.label}`}
            </Btn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The piece itself, rebuilt small with the real settings, with the tile
 *  joins drawn over it. Building at preview size keeps the placement choices
 *  identical to the export; only the output width differs. */
function TilePreview({
  ctx, background, aspect, cols, rows,
}: {
  ctx: ExportContext
  background: Background
  aspect: number
  cols: number
  rows: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const maxW = 300
  const maxH = 200
  const w = Math.min(maxW, maxH * aspect)
  const h = w / aspect

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const c = canvas.getContext('2d')
    if (!c) return
    const result = build(ctx.maps, ctx.pack, ctx.palette, { ...ctx.options, width: 1200 })
    drawMosaic(c, result, ctx.pack, { scale: canvas.width / result.width, background })
  }, [ctx, background, w, h])

  return (
    <div
      className={cn('gt-sheet relative', hasAlpha(background) ? 'gt-checker' : 'bg-paper')}
      style={{ width: w, height: h }}
    >
      <canvas ref={ref} className="block size-full" />
      {Array.from({ length: cols - 1 }, (_, i) => (
        <span
          key={`c${i}`}
          className="border-magenta absolute inset-y-0 border-l border-dashed"
          style={{ left: `${((i + 1) / cols) * 100}%` }}
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <span
          key={`r${i}`}
          className="border-magenta absolute inset-x-0 border-t border-dashed"
          style={{ top: `${((i + 1) / rows) * 100}%` }}
        />
      ))}
    </div>
  )
}
