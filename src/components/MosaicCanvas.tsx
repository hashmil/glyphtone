import { useEffect, useRef, useState } from 'react'

import { drawMosaic } from '@/engine/render-canvas'
import { DEFAULT_SET } from '@/engine/glyphs'
import type { MosaicResult } from '@/engine/types'
import type { SourcePixels } from '@/lib/image'
import { cn } from '@/lib/utils'

interface Props {
  result: MosaicResult | null
  source: SourcePixels | null
  /** in source-image pixels, the region forced to the third zone */
  figureBox: [number, number, number, number] | null
  onFigureBox: (box: [number, number, number, number] | null) => void
  drawing: boolean
  className?: string
}

/** The preview, plus the focal-region interaction.
 *
 * The prototype had this region as a rectangle hardcoded in source pixels and
 * tuned by eye to one image, which meant every new image needed the constant
 * editing. Dragging it on the picture removes that limitation rather than
 * carrying it over.
 */
export function MosaicCanvas({
  result, source, figureBox, onFigureBox, drawing, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [drawMs, setDrawMs] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Cap the backing store: past a point more pixels cost time and add
    // nothing a screen can show.
    const targetW = Math.min(result.width, 1600 * dpr)
    const scale = targetW / result.width
    canvas.width = Math.round(result.width * scale)
    canvas.height = Math.round(result.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const t0 = performance.now()
    drawMosaic(ctx, result, DEFAULT_SET, { scale })
    setDrawMs(performance.now() - t0)
  }, [result])

  /** Pointer position as a fraction of the displayed image. */
  const rel = (e: React.PointerEvent) => {
    const el = wrapRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!drawing || !source) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = rel(e)
    setDrag({ x0: x, y0: y, x1: x, y1: y })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const { x, y } = rel(e)
    setDrag((d) => (d ? { ...d, x1: x, y1: y } : d))
  }

  const onUp = () => {
    if (!drag || !source) return
    const { x0, y0, x1, y1 } = drag
    setDrag(null)
    // A stray click clears the region rather than setting a degenerate one.
    if (Math.abs(x1 - x0) < 0.02 || Math.abs(y1 - y0) < 0.02) {
      onFigureBox(null)
      return
    }
    onFigureBox([
      Math.round(Math.min(x0, x1) * source.width),
      Math.round(Math.min(y0, y1) * source.height),
      Math.round(Math.max(x0, x1) * source.width),
      Math.round(Math.max(y0, y1) * source.height),
    ])
  }

  // The stored box is in source pixels; the overlay needs fractions.
  const shown = drag
    ? {
        left: `${Math.min(drag.x0, drag.x1) * 100}%`,
        top: `${Math.min(drag.y0, drag.y1) * 100}%`,
        width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
        height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
      }
    : figureBox && source
      ? {
          left: `${(figureBox[0] / source.width) * 100}%`,
          top: `${(figureBox[1] / source.height) * 100}%`,
          width: `${((figureBox[2] - figureBox[0]) / source.width) * 100}%`,
          height: `${((figureBox[3] - figureBox[1]) / source.height) * 100}%`,
        }
      : null

  return (
    <div className={cn('relative', className)}>
      <div
        ref={wrapRef}
        className={cn(
          'relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10',
          drawing && 'cursor-crosshair',
        )}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <canvas ref={canvasRef} className="block h-auto w-full select-none" />
        {shown && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-sky-500/80 bg-sky-500/10"
            style={shown}
          />
        )}
      </div>
      {result && (
        <p className="text-muted-foreground mt-2 font-mono text-[11px] tabular-nums">
          {result.filled.toLocaleString()} icons · {result.cols}x{result.rows} cells ·{' '}
          {Math.round((result.filled / result.total) * 100)}% filled · draw {drawMs.toFixed(0)}ms
        </p>
      )}
    </div>
  )
}
