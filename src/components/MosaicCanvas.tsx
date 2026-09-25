import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns2, Maximize2, Minus, Plus } from 'lucide-react'

import { Slug } from '@/components/kit'
import { drawMosaic } from '@/engine/render-canvas'
import { DEFAULT_BACKGROUND, hasAlpha, type Background } from '@/engine/background'
import type { GlyphPack } from '@/engine/packs'
import type { MosaicResult } from '@/engine/types'
import type { SourcePixels } from '@/lib/image'
import { STATUS_LABEL, type Status } from '@/lib/useMosaic'
import { cn } from '@/lib/utils'

interface Props {
  result: MosaicResult | null
  pack: GlyphPack
  source: SourcePixels | null
  figureBox: [number, number, number, number] | null
  onFigureBox: (box: [number, number, number, number] | null) => void
  drawing: boolean
  status: Status
  className?: string
  /** What sits under the glyphs, drawn by the same renderer the export uses. */
  background?: Background
  /** `fit` sizes the piece to the box it is given, so the canvas never forces
   *  the page to scroll. `flow` is the old behaviour: full width, height by
   *  aspect, and whatever that costs vertically. */
  sizing?: 'fit' | 'flow'
}

const MAX_ZOOM = 12

/** Space kept clear around the trim for the crop marks, in CSS px. */
const CROP_MARGIN = 22

/** The preview, plus zoom, pan, and the focal-region interaction.
 *
 * Zoom re-renders rather than scaling the canvas up. The mosaic is vector all
 * the way to the export, so magnifying a bitmap preview would show blur where
 * the real output has crisp icons, and the whole point of zooming in is to
 * check the icons.
 */
export function MosaicCanvas({
  result, pack, source, figureBox, onFigureBox, drawing, status, className,
  background = DEFAULT_BACKGROUND, sizing = 'flow',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Redraw when the box changes rather than only when the mosaic does. In fit
  // mode the canvas is sized by its container, so a window resize alone
  // changes the resolution it should be drawn at.
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [drawMs, setDrawMs] = useState(0)

  // Zoom, and the centre of view as a fraction of the piece.
  const [zoom, setZoom] = useState(1)
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })
  const pan = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  const zoomed = zoom > 1.001

  // Before and after: the original photo on the left of a divider, the glyphs
  // on the right. `split` is the divider's position across the piece.
  const [compare, setCompare] = useState(false)
  const [split, setSplit] = useState(0.5)

  /** The source as a canvas, made once per image, so every redraw of the
   *  comparison is a single drawImage rather than a putImageData. */
  const sourceCanvas = useMemo(() => {
    if (!source) return null
    const c = document.createElement('canvas')
    c.width = source.width
    c.height = source.height
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0)
    return c
  }, [source])

  /** The piece's size on screen, in CSS px, derived only from the stage box and
   *  the piece's aspect. Nothing downstream measures the canvas, so there is no
   *  loop to settle. */
  const fitted = useMemo(() => {
    if (!result || box.w < 1) return { w: 0, h: 0 }
    const aspect = result.width / result.height
    // The stats line lives inside the measured stage, so its height comes out
    // of what the piece may use or the two together overflow.
    const STATS = 56
    // Room on every side for the crop marks, which sit outside the trim.
    const M = CROP_MARGIN * 2
    const availW = Math.max(1, box.w - M)
    const w = sizing === 'fit' && box.h > 1
      ? Math.min(availW, Math.max(1, box.h - STATS - M) * aspect)
      : availW
    return { w, h: w / aspect }
  }, [result, box, sizing])

  const clampCentre = useCallback((c: { x: number; y: number }, z: number) => {
    const half = 0.5 / z
    return {
      x: Math.min(1 - half, Math.max(half, c.x)),
      y: Math.min(1 - half, Math.max(half, c.y)),
    }
  }, [])

  // The stage is measured, not the canvas wrapper. Observing the wrapper is
  // circular: the wrapper is sized by the canvas, the canvas is sized from the
  // wrapper, and which one wins depends on the order the two settle in. That
  // showed up as the whole piece collapsing to a couple of hundred pixels after
  // an unrelated re-render. The stage's size comes from the shell alone, so it
  // is a fixed point.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1
        ? b
        : { w: r.width, h: r.height }))
    })
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !result) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { w: cssW, h: cssH } = fitted
    if (cssW < 1 || cssH < 1) return

    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Visible slice of the piece, in output px.
    const viewW = result.width / zoom
    const viewH = result.height / zoom
    const originX = centre.x * result.width - viewW / 2
    const originY = centre.y * result.height - viewH / 2
    // Scale that maps the visible slice onto the backing store, so zooming in
    // genuinely increases resolution instead of enlarging pixels.
    const scale = canvas.width / viewW

    const t0 = performance.now()
    drawMosaic(ctx, result, pack, {
      scale,
      background,
      origin: { x: originX, y: originY },
      size: { width: viewW, height: viewH },
    })
    setDrawMs(performance.now() - t0)
  }, [result, pack, zoom, centre, background, fitted])

  /** Pointer position as a fraction of the displayed element. */
  const rel = (e: React.PointerEvent) => {
    const el = wrapRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  /** Where a point on screen sits in the whole piece, accounting for zoom. */
  const toPiece = (p: { x: number; y: number }) => ({
    x: centre.x + (p.x - 0.5) / zoom,
    y: centre.y + (p.y - 0.5) / zoom,
  })

  const onDown = (e: React.PointerEvent) => {
    // The zoom control sits inside this element. Capturing the pointer here
    // retargets the rest of the sequence to the wrapper, so the click never
    // reaches the button and the zoom buttons silently do nothing. Let anything
    // that is itself a control handle its own press.
    if ((e.target as HTMLElement).closest('button')) return
    // Capture only when there is actually a gesture to follow. Capturing on
    // every press is what caused the above.
    if (drawing || zoomed) e.currentTarget.setPointerCapture(e.pointerId)
    if (drawing && source) {
      const p = toPiece(rel(e))
      setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
      return
    }
    if (zoomed) {
      const r = rel(e)
      pan.current = { px: r.x, py: r.y, cx: centre.x, cy: centre.y }
    }
  }

  const onMove = (e: React.PointerEvent) => {
    if (drag) {
      const p = toPiece(rel(e))
      setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d))
      return
    }
    if (pan.current) {
      const r = rel(e)
      setCentre(clampCentre({
        x: pan.current.cx - (r.x - pan.current.px) / zoom,
        y: pan.current.cy - (r.y - pan.current.py) / zoom,
      }, zoom))
    }
  }

  const onUp = () => {
    pan.current = null
    if (!drag || !source) return
    const { x0, y0, x1, y1 } = drag
    setDrag(null)
    // A stray tap clears the region rather than setting a degenerate one.
    if (Math.abs(x1 - x0) < 0.02 || Math.abs(y1 - y0) < 0.02) {
      onFigureBox(null)
      return
    }
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
    onFigureBox([
      Math.round(clamp01(Math.min(x0, x1)) * source.width),
      Math.round(clamp01(Math.min(y0, y1)) * source.height),
      Math.round(clamp01(Math.max(x0, x1)) * source.width),
      Math.round(clamp01(Math.max(y0, y1)) * source.height),
    ])
  }

  const zoomBy = useCallback((factor: number, at?: { x: number; y: number }) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, z * factor))
      setCentre((c) => {
        if (!at || next <= 1) return next <= 1 ? { x: 0.5, y: 0.5 } : c
        // Keep the point under the cursor fixed while the scale changes.
        const piece = { x: c.x + (at.x - 0.5) / z, y: c.y + (at.y - 0.5) / z }
        return clampCentre({
          x: piece.x - (at.x - 0.5) / next,
          y: piece.y - (at.y - 0.5) / next,
        }, next)
      })
      return next
    })
  }, [clampCentre])

  // Wheel and pinch. Registered natively because React's synthetic wheel
  // listener is passive and cannot preventDefault the page zoom.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 2) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomBy(Math.exp(-e.deltaY * 0.002), {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      })
    }

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), zoom }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch.current) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const factor = dist(e.touches) / pinch.current.dist
      pinch.current = { dist: dist(e.touches), zoom }
      zoomBy(factor, { x: (mx - r.left) / r.width, y: (my - r.top) / r.height })
    }
    const onTouchEnd = () => { pinch.current = null }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [zoom, zoomBy])

  // The original, drawn for exactly the slice of the piece in view, so the
  // comparison holds when zoomed and panned.
  useEffect(() => {
    const canvas = beforeRef.current
    if (!compare || !canvas || !sourceCanvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { w: cssW, h: cssH } = fitted
    if (cssW < 1 || cssH < 1) return
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sw = sourceCanvas.width / zoom
    const sh = sourceCanvas.height / zoom
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      sourceCanvas,
      (centre.x - 0.5 / zoom) * sourceCanvas.width,
      (centre.y - 0.5 / zoom) * sourceCanvas.height,
      sw, sh, 0, 0, canvas.width, canvas.height,
    )
  }, [compare, sourceCanvas, fitted, zoom, centre])

  // Keyboard zoom, the same keys every image tool uses. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '+' || e.key === '=') zoomBy(1.6)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.6)
      else if (e.key === '0') { setZoom(1); setCentre({ x: 0.5, y: 0.5 }) }
      else if (e.key === 'c' || e.key === 'C') setCompare((v) => !v)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomBy])

  // The focal box is stored in source pixels; the overlay needs screen
  // fractions, which depend on the current zoom.
  const toScreen = (fx: number, fy: number) => ({
    x: (fx - centre.x) * zoom + 0.5,
    y: (fy - centre.y) * zoom + 0.5,
  })

  let overlay: React.CSSProperties | null = null
  if (drag) {
    const a = toScreen(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1))
    const b = toScreen(Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1))
    overlay = {
      left: `${a.x * 100}%`, top: `${a.y * 100}%`,
      width: `${(b.x - a.x) * 100}%`, height: `${(b.y - a.y) * 100}%`,
    }
  } else if (figureBox && source) {
    const a = toScreen(figureBox[0] / source.width, figureBox[1] / source.height)
    const b = toScreen(figureBox[2] / source.width, figureBox[3] / source.height)
    overlay = {
      left: `${a.x * 100}%`, top: `${a.y * 100}%`,
      width: `${(b.x - a.x) * 100}%`, height: `${(b.y - a.y) * 100}%`,
    }
  }

  const busy = status !== 'idle'

  const fit = sizing === 'fit'

  return (
    <div className={cn('relative', fit && 'flex h-full min-h-0 flex-col', className)}>
      {/* The stage is what gets measured. It has a size of its own, from the
          shell, and never takes one from its contents. */}
      <div
        ref={stageRef}
        className={cn(
          'flex w-full flex-col items-center justify-center',
          // On a phone the controls come up as a sheet over the lower half, so
          // the piece sits at the top where it stays in view while adjusting.
          fit && 'min-h-0 flex-1 max-lg:justify-start max-lg:pt-2',
        )}
      >
        {/* Sheet plus crop marks. Sized in px from `fitted`, never measured. */}
        <div
          className="relative"
          style={{ width: fitted.w || undefined, height: fitted.h || undefined }}
        >
          <CropMarks active={drawing} />
          <div
            ref={wrapRef}
            className={cn(
              'gt-sheet relative h-full w-full touch-none overflow-hidden',
              // A checkerboard wherever the export will be transparent, so "no
              // background" is visibly a choice rather than a white one, and so
              // a contain-fitted image's bars read as bars rather than as paper.
              hasAlpha(background) ? 'gt-checker' : 'bg-paper',
              drawing ? 'cursor-crosshair' : zoomed ? 'cursor-grab active:cursor-grabbing' : '',
            )}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {/* Sized in JS, in px, alongside the backing store. Sizing it with
                w-full/h-full instead would make it read its parent while its
                parent reads it. */}
            <canvas ref={canvasRef} className="block select-none" />

            {compare && (
              <>
                <canvas
                  ref={beforeRef}
                  className="pointer-events-none absolute inset-0 size-full select-none"
                  style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
                />
                <span className="bg-ink/85 text-fg pointer-events-none absolute top-2 left-2 px-1.5 py-0.5 font-mono text-xs">
                  Original
                </span>
                <span className="bg-ink/85 text-fg pointer-events-none absolute top-2 right-2 px-1.5 py-0.5 font-mono text-xs">
                  Glyphs
                </span>
                <Divider split={split} onSplit={setSplit} wrapRef={wrapRef} />
              </>
            )}

            {overlay && (
              <div
                className="border-magenta pointer-events-none absolute border-[1.5px] border-dashed"
                style={overlay}
              />
            )}

            {busy && (
              <div className="pointer-events-none absolute inset-0 bg-white/35">
                <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
                  <div className="gt-scan bg-magenta h-full w-1/3" />
                </div>
              </div>
            )}
          </div>
        </div>

        {result && (
          <Slug
            className="mt-8 shrink-0 justify-center"
            parts={busy ? [
              <span key="s" className="text-fg">{STATUS_LABEL[status]}</span>,
            ] : [
              `${result.filled.toLocaleString()} glyphs`,
              result.cols > 0 && `${result.cols} × ${result.rows} cells`,
              result.total > 0 && result.cols > 0 &&
                `${Math.round((result.filled / result.total) * 100)}% filled`,
              { node: `drawn in ${drawMs.toFixed(0)} ms`, className: 'max-sm:hidden' },
              drawing
                ? <span key="d" className="text-magenta">drag to mark the focal region</span>
                : compare
                  ? <span key="c" className="text-fg">original on the left</span>
                  : zoomed && <span key="p" className="text-fg">drag to pan</span>,
            ]}
          />
        )}
      </div>

      <div className="border-rule-2 bg-ink/90 absolute right-0 bottom-0 flex items-center rounded-sm border backdrop-blur">
        <button
          type="button"
          aria-pressed={compare}
          title="Compare with the original (C)"
          onClick={() => setCompare((v) => !v)}
          className={cn(
            'border-rule-2 flex h-8 cursor-pointer items-center gap-1.5 border-r px-3 text-xs transition-colors [&_svg]:size-3.5',
            compare ? 'bg-paper text-ink' : 'text-fg-2 hover:text-fg hover:bg-raise',
          )}
        >
          <Columns2 />
          Compare
        </button>
        <ZoomBtn onClick={() => zoomBy(1 / 1.6)} disabled={!zoomed} label="Zoom out (−)">
          <Minus />
        </ZoomBtn>
        <span className="text-fg w-11 text-center font-mono text-xs tabular-nums">
          {zoom < 9.95 ? zoom.toFixed(1) : zoom.toFixed(0)}×
        </span>
        <ZoomBtn onClick={() => zoomBy(1.6)} disabled={zoom >= MAX_ZOOM} label="Zoom in (+)">
          <Plus />
        </ZoomBtn>
        <ZoomBtn
          onClick={() => { setZoom(1); setCentre({ x: 0.5, y: 0.5 }) }}
          disabled={!zoomed}
          label="Fit to view (0)"
        >
          <Maximize2 />
        </ZoomBtn>
      </div>
    </div>
  )
}

/** The before/after divider. A button so the canvas's own pointer handling
 *  leaves it alone, with its own capture for the drag and arrow keys for
 *  anyone not using a pointer. */
function Divider({
  split, onSplit, wrapRef,
}: {
  split: number
  onSplit: (v: number) => void
  wrapRef: React.RefObject<HTMLDivElement | null>
}) {
  const dragging = useRef(false)
  const at = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return split
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  return (
    <div
      className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
      style={{ left: `${split * 100}%` }}
    >
      <button
        type="button"
        role="slider"
        aria-label="Before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split * 100)}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          dragging.current = true
        }}
        onPointerMove={(e) => { if (dragging.current) onSplit(at(e.clientX)) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02
          if (e.key === 'ArrowLeft') onSplit(Math.max(0, split - step))
          else if (e.key === 'ArrowRight') onSplit(Math.min(1, split + step))
          else return
          e.preventDefault()
        }}
        className="bg-ink text-fg border-rule-2 absolute top-1/2 left-1/2 flex h-9 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center gap-[3px] pointer-events-auto rounded-sm border"
      >
        <span className="bg-fg-2 h-3.5 w-px" />
        <span className="bg-fg-2 h-3.5 w-px" />
      </button>
    </div>
  )
}

function ZoomBtn({
  children, label, ...props
}: React.ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="text-fg-2 hover:text-fg hover:bg-raise flex size-8 cursor-pointer items-center justify-center disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5"
      {...props}
    >
      {children}
    </button>
  )
}

/** Printer's crop marks at the four corners of the trim, offset so they never
 *  touch the artwork. They mark the edge of what gets exported. */
function CropMarks({ active }: { active: boolean }) {
  const L = 14
  const G = 6
  const corners = [
    { x: 'left', y: 'top', sx: -1, sy: -1 },
    { x: 'right', y: 'top', sx: 1, sy: -1 },
    { x: 'left', y: 'bottom', sx: -1, sy: 1 },
    { x: 'right', y: 'bottom', sx: 1, sy: 1 },
  ] as const
  const tone = active ? 'bg-magenta' : 'bg-fg-3'
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {corners.map((c) => (
        <div key={`${c.x}${c.y}`}>
          {/* horizontal mark, in line with the top or bottom edge */}
          <span
            className={cn('absolute h-px transition-colors', tone)}
            style={{ width: L, [c.y]: 0, [c.x]: -(G + L) }}
          />
          {/* vertical mark, in line with the left or right edge */}
          <span
            className={cn('absolute w-px transition-colors', tone)}
            style={{ height: L, [c.x]: 0, [c.y]: -(G + L) }}
          />
        </div>
      ))}
    </div>
  )
}
