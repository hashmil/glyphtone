import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Maximize2, Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
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

  /** The piece's size on screen, in CSS px, derived only from the stage box and
   *  the piece's aspect. Nothing downstream measures the canvas, so there is no
   *  loop to settle. */
  const fitted = useMemo(() => {
    if (!result || box.w < 1) return { w: 0, h: 0 }
    const aspect = result.width / result.height
    // The stats line lives inside the measured stage, so its height comes out
    // of what the piece may use or the two together overflow.
    const STATS = 26
    const w = sizing === 'fit' && box.h > 1
      ? Math.min(box.w, Math.max(1, box.h - STATS) * aspect)
      : box.w
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
    <div
      className={cn(
        'relative',
        fit && 'flex h-full min-h-0 flex-col gap-2',
        className,
      )}
    >
      {/* The stage is what gets measured. It has a size of its own, from the
          shell, and never takes one from its contents. */}
      <div
        ref={stageRef}
        className={cn(
          'flex w-full flex-col items-center justify-center',
          fit && 'min-h-0 flex-1',
        )}
      >
      <div
        ref={wrapRef}
        style={{ width: fitted.w || undefined, height: fitted.h || undefined }}
        className={cn(
          'relative touch-none overflow-hidden rounded-lg shadow-sm ring-1 ring-black/10',
          // A checkerboard wherever the export will be transparent, so "no
          // background" is visibly a choice rather than a white one, and so a
          // contain-fitted image's bars read as bars rather than as paper.
          hasAlpha(background) ? 'gt-checker' : 'bg-white',
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

        {overlay && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-sky-500/80 bg-sky-500/10"
            style={overlay}
          />
        )}

        {busy && (
          <div className="bg-background/70 pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-sm ring-1 ring-black/10">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="text-[12px] font-medium">{STATUS_LABEL[status]}</span>
            </div>
          </div>
        )}

        <div className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-sm ring-1 ring-black/10">
          <Button
            size="icon" variant="ghost" className="size-7"
            onClick={() => zoomBy(1 / 1.6)} disabled={!zoomed} aria-label="Zoom out"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-9 text-center font-mono text-[11px] tabular-nums">
            {zoom.toFixed(1)}x
          </span>
          <Button
            size="icon" variant="ghost" className="size-7"
            onClick={() => zoomBy(1.6)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in"
          >
            <Plus className="size-3.5" />
          </Button>
          {zoomed && (
            <Button
              size="icon" variant="ghost" className="size-7"
              onClick={() => { setZoom(1); setCentre({ x: 0.5, y: 0.5 }) }}
              aria-label="Fit to view"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {result && (
        // Inside the stage, directly under the piece. Left outside it, this sat
        // at the bottom of a tall pane with the canvas centred far above, which
        // read as a caption for nothing.
        <p className={cn(
          'text-muted-foreground font-mono text-[11px] tabular-nums',
          fit ? 'mt-2 shrink-0 text-center' : 'mt-2',
        )}>
          {result.filled.toLocaleString()} icons
          {result.cols > 0 && ` · ${result.cols}x${result.rows} cells`}
          {result.total > 0 && result.cols > 0 &&
            ` · ${Math.round((result.filled / result.total) * 100)}% filled`}
          {' · '}draw {drawMs.toFixed(0)}ms
          {zoomed && ' · drag to pan'}
        </p>
      )}
      </div>
    </div>
  )
}
